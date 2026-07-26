import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Mic, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  acceptRemoteVoiceRecord,
  TECTONA_CHAT_WORKSPACE_ID,
} from '@/lib/api/collaborationContextApi'
import { resolveChatContactName } from '@/lib/chat/chatContactDirectory'
import {
  enterpriseCyanGradientActionButtonClass,
  enterpriseSecondaryButtonClass,
} from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'
import { useVoiceRecordRequestStore } from '@/stores/voice-record-request-store'

const DKM_PATH = '/document-knowledge-management'
const DIALOG_TITLE_ID = 'voice-record-request-dialog-title'

export function VoiceRecordRequestPrompt() {
  const pending = useVoiceRecordRequestStore((s) => s.pending)
  const dismiss = useVoiceRecordRequestStore((s) => s.dismiss)
  const accept = useVoiceRecordRequestStore((s) => s.accept)

  const open = pending != null
  const fromName = pending ? resolveChatContactName(pending.fromUserId) : 'A teammate'
  const [titleDraft, setTitleDraft] = useState('')
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    if (!pending) {
      setTitleDraft('')
      setAccepting(false)
      return
    }
    setTitleDraft(pending.noteHint?.trim() || '')
  }, [pending])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || accepting) return
      event.preventDefault()
      event.stopPropagation()
      dismiss()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, dismiss, accepting])

  const handleAccept = useCallback(async () => {
    if (!pending || accepting) return
    setAccepting(true)
    const noteHint = titleDraft.trim() || null
    try {
      await acceptRemoteVoiceRecord(
        pending.workspaceId || TECTONA_CHAT_WORKSPACE_ID,
        pending.fromUserId,
        { noteHint: noteHint || undefined },
      )
    } catch {
      // Still open local recorder; requester may miss Joined if WS/API failed.
    }
    accept(noteHint)
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith(DKM_PATH)) {
      window.dispatchEvent(
        new CustomEvent('tectona:navigate', {
          detail: { pathname: DKM_PATH },
        }),
      )
    }
  }, [accept, accepting, pending, titleDraft])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        aria-label="Dismiss voice record request"
        onClick={dismiss}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={DIALOG_TITLE_ID}
        className="relative z-[1401] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card via-card to-card/95 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]"
      >
        <div className="border-b border-border/70 bg-muted/25 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/12 text-indigo-700 ring-1 ring-indigo-500/25 dark:text-indigo-300">
              <Mic className="h-5 w-5" aria-hidden />
            </div>
            <div className="space-y-1">
              <h3 id={DIALOG_TITLE_ID} className="text-base font-semibold tracking-tight text-foreground">
                Voice record request
              </h3>
              <p className="text-sm text-muted-foreground">
                {fromName} asks you to record a meeting voice on your device. You control the mic — nothing is streamed live.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-6 py-5">
          <div className="rounded-xl border border-border bg-background/70 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              From
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-foreground">{fromName}</p>
          </div>

          <div className="rounded-xl border border-border bg-background/70 px-4 py-3">
            <label
              htmlFor="voice-record-request-title"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
            >
              Suggested title
            </label>
            <Input
              id="voice-record-request-title"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              placeholder="Voice meeting title"
              className="mt-2 h-10"
              autoFocus
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || accepting) return
                e.preventDefault()
                void handleAccept()
              }}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Accepting opens Voice record in Document &amp; Knowledge Management on this device.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border/70 bg-muted/20 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
            onClick={dismiss}
            disabled={accepting}
          >
            <X className="h-4 w-4 shrink-0" aria-hidden />
            Dismiss
          </Button>
          <Button
            type="button"
            className={cn(enterpriseCyanGradientActionButtonClass(), 'min-w-0 basis-0 flex-1 justify-center')}
            onClick={() => void handleAccept()}
            disabled={accepting}
          >
            <Mic className="h-4 w-4 shrink-0" aria-hidden />
            {accepting ? 'Joining…' : 'Start recording'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
