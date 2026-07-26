import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2, Mic, Search } from 'lucide-react'

import { getSession } from '@/auth/authService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  listRemoteVoiceRecordAcceptances,
  requestRemoteVoiceRecord,
  TECTONA_CHAT_WORKSPACE_ID,
} from '@/lib/api/collaborationContextApi'
import {
  loadChatContactDirectory,
  resolveChatContactName,
  type ChatContact,
} from '@/lib/chat/chatContactDirectory'
import { notifyRemoteVoiceRecordRequested } from '@/lib/notifications/notifyVoiceRecordRequest'
import { cn } from '@/lib/utils'
import { useCollaborationPresenceStore } from '@/stores/collaboration-presence-store'
import { useVoiceRecordRequestStore } from '@/stores/voice-record-request-store'
import { useToast } from '@/components/ui/toast'

type MeetingVoiceOnlinePeersPanelProps = {
  noteHint?: string
  disabled?: boolean
}

const ACCEPTANCE_POLL_MS = 2_000

function presenceDotClass(presence: ChatContact['presence']): string {
  if (presence === 'online') return 'bg-emerald-500'
  if (presence === 'away') return 'bg-amber-400'
  return 'bg-slate-300'
}

export function MeetingVoiceOnlinePeersPanel({
  noteHint,
  disabled = false,
}: MeetingVoiceOnlinePeersPanelProps) {
  const { addToast } = useToast()
  const presenceByUserId = useCollaborationPresenceStore((s) => s.byUserId)
  const outboundByTargetId = useVoiceRecordRequestStore((s) => s.outboundByTargetId)
  const markOutboundPending = useVoiceRecordRequestStore((s) => s.markOutboundPending)
  const markOutboundJoined = useVoiceRecordRequestStore((s) => s.markOutboundJoined)
  const [contacts, setContacts] = useState<ChatContact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [busyByUserId, setBusyByUserId] = useState<Record<string, boolean>>({})
  const toastedJoinedRef = useRef<Set<string>>(new Set())

  const sessionUserId = getSession()?.user?.id ?? ''
  const hasPendingOutbound = Object.values(outboundByTargetId).some((s) => s === 'pending')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void loadChatContactDirectory(TECTONA_CHAT_WORKSPACE_ID, { publishSelf: false })
      .then((rows) => {
        if (!cancelled) setContacts(rows)
      })
      .catch(() => {
        if (!cancelled) setContacts([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Poll acceptances while Waiting — reliable when WS fan-out is missed.
  useEffect(() => {
    if (!hasPendingOutbound || !sessionUserId) return
    let cancelled = false

    const syncAcceptances = async () => {
      try {
        const items = await listRemoteVoiceRecordAcceptances(TECTONA_CHAT_WORKSPACE_ID)
        if (cancelled) return
        for (const item of items) {
          const targetId = item.target_user_id
          if (!targetId) continue
          if (item.from_user_id && item.from_user_id !== sessionUserId) continue
          const prev = useVoiceRecordRequestStore.getState().outboundByTargetId[targetId]
          markOutboundJoined(targetId)
          if (prev !== 'joined' && !toastedJoinedRef.current.has(targetId)) {
            toastedJoinedRef.current.add(targetId)
            addToast({
              variant: 'success',
              title: 'Teammate joined',
              description: `${resolveChatContactName(targetId)} started voice record.`,
            })
          }
        }
      } catch {
        // collaboration-context may be briefly unavailable
      }
    }

    void syncAcceptances()
    const timer = window.setInterval(() => void syncAcceptances(), ACCEPTANCE_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [addToast, hasPendingOutbound, markOutboundJoined, sessionUserId])

  // Toast when Joined arrives via WS (store update without poll).
  useEffect(() => {
    for (const [targetId, status] of Object.entries(outboundByTargetId)) {
      if (status !== 'joined') continue
      if (toastedJoinedRef.current.has(targetId)) continue
      toastedJoinedRef.current.add(targetId)
      addToast({
        variant: 'success',
        title: 'Teammate joined',
        description: `${resolveChatContactName(targetId)} started voice record.`,
      })
    }
  }, [addToast, outboundByTargetId])

  const onlinePeers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contacts
      .filter((c) => c.mode === 'team' && !c.isAssistant && c.id !== sessionUserId)
      .map((c) => {
        const row = presenceByUserId[c.id]
        const status =
          row?.status === 'online' || row?.status === 'away'
            ? (row.status as 'online' | 'away')
            : c.presence === 'online' || c.presence === 'away'
              ? c.presence
              : undefined
        return status ? { ...c, presence: status } : null
      })
      .filter((c): c is ChatContact & { presence: 'online' | 'away' } => c != null)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.subtitle ?? '').toLowerCase().includes(q))
      .sort((a, b) => {
        const inviteA = outboundByTargetId[a.id]
        const inviteB = outboundByTargetId[b.id]
        if (inviteA === 'joined' && inviteB !== 'joined') return -1
        if (inviteB === 'joined' && inviteA !== 'joined') return 1
        if (a.presence !== b.presence) return a.presence === 'online' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }, [contacts, outboundByTargetId, presenceByUserId, search, sessionUserId])

  const handleRequest = useCallback(
    async (peer: ChatContact) => {
      if (disabled || busyByUserId[peer.id]) return
      if (outboundByTargetId[peer.id] === 'joined') return
      setBusyByUserId((prev) => ({ ...prev, [peer.id]: true }))
      try {
        await requestRemoteVoiceRecord(TECTONA_CHAT_WORKSPACE_ID, peer.id, {
          noteHint: noteHint?.trim() || undefined,
        })
        markOutboundPending(peer.id)
        notifyRemoteVoiceRecordRequested({
          fromUserId: sessionUserId,
          targetUserId: peer.id,
          noteHint: noteHint?.trim() || null,
          workspaceId: TECTONA_CHAT_WORKSPACE_ID,
        })
        addToast({
          variant: 'success',
          title: 'Record request sent',
          description: `${peer.name} will get a prompt to open Voice record.`,
        })
      } catch (error) {
        addToast({
          variant: 'error',
          title: 'Could not send request',
          description: error instanceof Error ? error.message : 'Try again in a moment.',
        })
      } finally {
        window.setTimeout(() => {
          setBusyByUserId((prev) => {
            const next = { ...prev }
            delete next[peer.id]
            return next
          })
        }, 2500)
      }
    },
    [addToast, busyByUserId, disabled, markOutboundPending, noteHint, outboundByTargetId, sessionUserId],
  )

  return (
    <div className="space-y-2.5 rounded-xl border border-border/70 bg-slate-50/80 px-3 py-3">
      <div>
        <p className="text-xs font-semibold text-slate-900">Request teammate to record</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          Online peers record on their own device. This is not live listen.
        </p>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search online teammates…"
          className="h-8 pl-8 text-xs"
          disabled={disabled}
        />
      </div>
      <div className="max-h-44 space-y-1.5 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading teammates…
          </div>
        ) : onlinePeers.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-muted-foreground">
            {search.trim() ? 'No online matches.' : 'No teammates online right now.'}
          </p>
        ) : (
          onlinePeers.map((peer) => {
            const busy = Boolean(busyByUserId[peer.id])
            const invite = outboundByTargetId[peer.id]
            const joined = invite === 'joined'
            const waiting = invite === 'pending'
            return (
              <div
                key={peer.id}
                className={cn(
                  'flex items-center gap-2 rounded-lg border bg-white px-2 py-1.5',
                  joined ? 'border-emerald-200/90 bg-emerald-50/40' : 'border-border/50',
                )}
              >
                <div
                  className={cn(
                    'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                    peer.avatarClassName ?? 'bg-slate-200 text-slate-700',
                  )}
                >
                  {peer.initials}
                  <span
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white',
                      presenceDotClass(peer.presence),
                    )}
                    aria-hidden
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-900">{peer.name}</p>
                  <p
                    className={cn(
                      'truncate text-[10px] capitalize',
                      joined ? 'font-semibold text-emerald-700' : 'text-muted-foreground',
                    )}
                  >
                    {joined ? 'Joined' : waiting ? 'Waiting…' : peer.presence}
                  </p>
                </div>
                {joined ? (
                  <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-800">
                    <Check className="h-3 w-3" aria-hidden />
                    Joined
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 gap-1 px-2 text-[11px]"
                    disabled={disabled || busy || waiting}
                    onClick={() => void handleRequest(peer)}
                  >
                    {busy || waiting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Mic className="h-3 w-3" />
                    )}
                    {busy ? 'Sent' : waiting ? 'Waiting' : 'Request record'}
                  </Button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
