import { useEffect, useRef } from 'react'

import { getSession } from '@/auth/authService'
import {
  createCollaborationPresenceWebSocketUrl,
  listChannelMessages,
  listWorkspaceChannels,
  markChannelDelivered,
  type CollaborationPresenceApi,
  type VoiceRecordRequestRealtimePayload,
  TECTONA_CHAT_WORKSPACE_ID,
} from '@/lib/api/collaborationContextApi'
import { useChatPanelStore } from '@/stores/chat-panel-store'
import { useChatNotificationTargetStore } from '@/stores/chat-notification-target-store'
import { useVoiceRecordRequestStore } from '@/stores/voice-record-request-store'
import { onSessionActive } from '@/auth/sessionEvents'
import {
  emitChatChannelReceipt,
  emitChatMessageReceived,
  type ChatMessageRealtimePayload,
} from '@/lib/chat/chatRealtimeEvents'
import { notifyIncomingChatMessage } from '@/lib/notifications/notifyChatMessage'
import { ensureDesktopNotificationPermission } from '@/lib/notifications/desktopNotification'

export type PresenceRealtimeHandler = (update: CollaborationPresenceApi) => void

type MessageSentPayload = ChatMessageRealtimePayload & {
  app_id?: string
}

/** Poll inbox for new messages (fallback when WebSocket is down). */
const INBOX_POLL_MS = 5_000

function detachWebSocketHandlers(ws: WebSocket): void {
  ws.onopen = null
  ws.onmessage = null
  ws.onerror = null
  ws.onclose = null
}

/** Avoid "closed before connection is established" when tearing down a CONNECTING socket. */
function closeWebSocketQuietly(ws: WebSocket | null): void {
  if (!ws) return
  const { readyState } = ws
  if (readyState === WebSocket.CLOSED) return

  if (readyState === WebSocket.CONNECTING) {
    ws.onopen = () => {
      detachWebSocketHandlers(ws)
      ws.close()
    }
    ws.onerror = () => {
      detachWebSocketHandlers(ws)
    }
    ws.onclose = () => {
      detachWebSocketHandlers(ws)
    }
    return
  }

  detachWebSocketHandlers(ws)
  ws.close()
}

/** Delivered ack when chat thread UI is not actively viewing this channel. */
function shouldAckDeliveredOutsideThread(channelId: string): boolean {
  if (!useChatPanelStore.getState().open) return true
  const activeChannelId = useChatNotificationTargetStore.getState().activeChannelId
  return activeChannelId !== channelId
}

/**
 * Workspace WebSocket (presence + chat messages) with inbox poll fallback.
 */
export function useCollaborationPresenceRealtime(onPresenceUpdated: PresenceRealtimeHandler): void {
  const handlerRef = useRef(onPresenceUpdated)
  handlerRef.current = onPresenceUpdated
  const lastSequenceByChannelRef = useRef<Map<string, number>>(new Map())
  const seenMessageIdsRef = useRef<Set<string>>(new Set())
  const inboxSeededRef = useRef(false)

  useEffect(() => {
    void ensureDesktopNotificationPermission()
  }, [])

  useEffect(() => {
    let disposed = false
    let socket: WebSocket | null = null
    let socketGeneration = 0
    let reconnectTimer: number | null = null
    let inboxPollTimer: number | null = null
    let reconnectAttempt = 0
    let stopSessionActive: (() => void) | undefined

    const clearReconnect = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    const clearInboxPoll = () => {
      if (inboxPollTimer !== null) {
        window.clearInterval(inboxPollTimer)
        inboxPollTimer = null
      }
    }

    const rememberMessage = (messageId: string): boolean => {
      const seen = seenMessageIdsRef.current
      if (seen.has(messageId)) return false
      seen.add(messageId)
      if (seen.size > 500) {
        const drop = [...seen].slice(0, seen.size - 400)
        for (const id of drop) seen.delete(id)
      }
      return true
    }

    const dispatchIncomingMessage = (payload: MessageSentPayload, notify: boolean) => {
      const session = getSession()
      if (!session?.user?.id) return
      if (payload.sender_user_id === session.user.id) return
      if (!rememberMessage(payload.message_id)) return

      lastSequenceByChannelRef.current.set(payload.channel_id, payload.sequence_no)
      emitChatMessageReceived(payload)
      if (shouldAckDeliveredOutsideThread(payload.channel_id)) {
        void markChannelDelivered(payload.channel_id, payload.sequence_no).catch(() => undefined)
      }
      if (!notify) return

      notifyIncomingChatMessage({
        channelId: payload.channel_id,
        senderUserId: payload.sender_user_id,
        body: payload.body,
        channelType: payload.channel_type,
        channelTitle: payload.channel_title,
      })
    }

    const pollInboxForNewMessages = async () => {
      const session = getSession()
      if (!session?.user?.id) return
      try {
        const res = await listWorkspaceChannels(TECTONA_CHAT_WORKSPACE_ID, { pageSize: 100 })
        const seeding = !inboxSeededRef.current

        for (const ch of res.items) {
          const latestSeq = ch.last_sequence_no ?? 0
          const prevSeq = lastSequenceByChannelRef.current.get(ch.id)
          if (seeding || prevSeq === undefined) {
            lastSequenceByChannelRef.current.set(ch.id, latestSeq)
            continue
          }
          if (latestSeq <= prevSeq) continue

          lastSequenceByChannelRef.current.set(ch.id, latestSeq)

          let newMessages: Awaited<ReturnType<typeof listChannelMessages>> = []
          try {
            newMessages = await listChannelMessages(ch.id, { afterSequence: prevSeq, limit: 20 })
          } catch {
            const peerId = ch.peer_user_id
            if (ch.last_message_preview?.trim() && peerId) {
              newMessages = [
                {
                  id: `${ch.id}:${latestSeq}`,
                  channel_id: ch.id,
                  sender_user_id: peerId,
                  message_role: 'user',
                  body: ch.last_message_preview,
                  sequence_no: latestSeq,
                  message_at: ch.last_message_at ?? new Date().toISOString(),
                },
              ]
            }
          }

          for (const msg of newMessages) {
            dispatchIncomingMessage(
              {
                channel_id: ch.id,
                message_id: msg.id,
                sender_user_id: msg.sender_user_id,
                body: msg.body,
                sequence_no: msg.sequence_no,
                channel_type: ch.channel_type,
                channel_title: ch.title,
              },
              !seeding,
            )
          }
        }

        inboxSeededRef.current = true
      } catch {
        // collaboration-context may be down
      }
    }

    const scheduleReconnect = () => {
      if (disposed) return
      const delay = Math.min(30_000, 1000 * 2 ** reconnectAttempt)
      reconnectAttempt += 1
      clearReconnect()
      reconnectTimer = window.setTimeout(connect, delay)
    }

    const connect = () => {
      if (disposed) return
      const session = getSession()
      if (!session?.token) return

      if (socket) {
        closeWebSocketQuietly(socket)
        socket = null
      }

      const url = createCollaborationPresenceWebSocketUrl({
        workspaceId: TECTONA_CHAT_WORKSPACE_ID,
        token: session.token,
      })
      const generation = ++socketGeneration
      const ws = new WebSocket(url)
      socket = ws

      ws.onopen = () => {
        if (disposed || generation !== socketGeneration || socket !== ws) return
        reconnectAttempt = 0
      }

      ws.onmessage = (event) => {
        if (disposed || generation !== socketGeneration || socket !== ws) return
        try {
          const parsed = JSON.parse(String(event.data)) as {
            type?: string
            payload?: CollaborationPresenceApi & MessageSentPayload
          }
          if (parsed.type === 'presence.updated' && parsed.payload?.user_id) {
            handlerRef.current(parsed.payload)
            return
          }
          if (parsed.type === 'message.sent' && parsed.payload?.channel_id && parsed.payload.message_id) {
            dispatchIncomingMessage(parsed.payload, true)
            return
          }
          if (parsed.type === 'channel.read' && parsed.payload?.channel_id) {
            const p = parsed.payload as {
              channel_id?: string
              user_id?: string
              sequence_no?: number
            }
            if (p.channel_id && p.user_id && p.sequence_no != null) {
              emitChatChannelReceipt({
                channel_id: p.channel_id,
                user_id: p.user_id,
                sequence_no: Number(p.sequence_no),
                kind: 'read',
              })
            }
            return
          }
          if (parsed.type === 'channel.delivered' && parsed.payload?.channel_id) {
            const p = parsed.payload as {
              channel_id?: string
              user_id?: string
              sequence_no?: number
            }
            if (p.channel_id && p.user_id && p.sequence_no != null) {
              emitChatChannelReceipt({
                channel_id: p.channel_id,
                user_id: p.user_id,
                sequence_no: Number(p.sequence_no),
                kind: 'delivered',
              })
            }
            return
          }
          if (parsed.type === 'voice.record_request' && parsed.payload) {
            const p = parsed.payload as VoiceRecordRequestRealtimePayload
            const sessionUserId = getSession()?.user?.id
            if (
              sessionUserId
              && p.target_user_id === sessionUserId
              && p.from_user_id
              && p.from_user_id !== sessionUserId
            ) {
              useVoiceRecordRequestStore.getState().setPendingFromRealtime(p)
            }
            return
          }
          if (parsed.type === 'voice.record_accepted' && parsed.payload) {
            const p = parsed.payload as VoiceRecordRequestRealtimePayload
            const sessionUserId = getSession()?.user?.id
            if (sessionUserId) {
              useVoiceRecordRequestStore.getState().applyAcceptedFromRealtime(p, sessionUserId)
            }
          }
        } catch {
          // ignore malformed frames
        }
      }

      ws.onclose = () => {
        if (socket === ws) socket = null
        if (disposed || generation !== socketGeneration) return
        scheduleReconnect()
      }

      ws.onerror = () => {
        if (disposed || generation !== socketGeneration || socket !== ws) return
        closeWebSocketQuietly(ws)
      }
    }

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') void pollInboxForNewMessages()
    }

    connect()
    stopSessionActive = onSessionActive(connect)
    void pollInboxForNewMessages()
    inboxPollTimer = window.setInterval(() => void pollInboxForNewMessages(), INBOX_POLL_MS)
    document.addEventListener('visibilitychange', onVisibilityOrFocus)
    window.addEventListener('focus', onVisibilityOrFocus)

    return () => {
      disposed = true
      socketGeneration += 1
      stopSessionActive?.()
      clearReconnect()
      clearInboxPoll()
      document.removeEventListener('visibilitychange', onVisibilityOrFocus)
      window.removeEventListener('focus', onVisibilityOrFocus)
      closeWebSocketQuietly(socket)
      socket = null
    }
  }, [])
}
