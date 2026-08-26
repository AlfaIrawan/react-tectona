/**
 * Realtime notification delivery via notification-service WebSocket.
 * Refreshes the topbar badge and notification panel when new items arrive.
 */

import { ensureFreshSession, getSession } from '@/auth/authService'
import { onSessionActive, onSessionCleared, onSessionTokenRefreshed } from '@/auth/sessionEvents'
import { consumeSelfCreatedNotification, createNotificationWebSocketUrl } from '@/lib/api/notificationApi'
import { emitNotificationsUpdated } from '@/lib/chat/chatRealtimeEvents'
import {
  showNotificationCreatedToast,
  type NotificationCreatedRealtimePayload,
} from '@/lib/notifications/notificationToast'

function detachWebSocketHandlers(ws: WebSocket): void {
  ws.onopen = null
  ws.onmessage = null
  ws.onerror = null
  ws.onclose = null
}

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

class NotificationRealtimeController {
  private disposed = true
  private socket: WebSocket | null = null
  private socketGeneration = 0
  private reconnectTimer: number | null = null
  private reconnectAttempt = 0

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed || !getSession()) return
    const delay = Math.min(30_000, 1000 * 2 ** this.reconnectAttempt)
    this.reconnectAttempt += 1
    this.clearReconnect()
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay)
  }

  connect(): void {
    if (this.disposed || !navigator.onLine || !getSession()) return

    if (
      this.socket
      && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    if (this.socket) {
      closeWebSocketQuietly(this.socket)
      this.socket = null
    }

    const generation = ++this.socketGeneration
    void (async () => {
      if (this.disposed || generation !== this.socketGeneration) return
      const session = (await ensureFreshSession()) ?? getSession()
      if (this.disposed || generation !== this.socketGeneration || !session?.token) return

      const url = createNotificationWebSocketUrl({ token: session.token })
      const ws = new WebSocket(url)
      this.socket = ws

      ws.onopen = () => {
        if (this.disposed || generation !== this.socketGeneration || this.socket !== ws) return
        this.reconnectAttempt = 0
      }

      ws.onmessage = (event) => {
        if (this.disposed || generation !== this.socketGeneration || this.socket !== ws) return
        try {
          const parsed = JSON.parse(String(event.data)) as {
            type?: string
            payload?: NotificationCreatedRealtimePayload
          }
          if (parsed.type === 'notification.created') {
            emitNotificationsUpdated(parsed.payload)
            // Skip the toast if this tab already showed one via notifyEvent() for the same
            // notification (see consumeSelfCreatedNotification) — avoids a double toast.
            const dedupeKey = parsed.payload?.metadata?.__client_dedupe_key
            if (parsed.payload && !consumeSelfCreatedNotification(typeof dedupeKey === 'string' ? dedupeKey : undefined)) {
              showNotificationCreatedToast(parsed.payload)
            }
          }
        } catch {
          // ignore malformed frames
        }
      }

      ws.onclose = () => {
        if (this.socket === ws) this.socket = null
        if (this.disposed || generation !== this.socketGeneration) return
        if (getSession()) this.scheduleReconnect()
      }

      ws.onerror = () => {
        if (this.disposed || generation !== this.socketGeneration || this.socket !== ws) return
        closeWebSocketQuietly(ws)
      }
    })()
  }

  start(): void {
    if (!this.disposed) {
      this.connect()
      return
    }
    this.disposed = false
    this.reconnectAttempt = 0
    this.connect()
  }

  stop(): void {
    this.disposed = true
    this.socketGeneration += 1
    this.clearReconnect()
    closeWebSocketQuietly(this.socket)
    this.socket = null
  }
}

const controller = new NotificationRealtimeController()

/** Start notification-service WebSocket while the user is signed in. */
export function initNotificationRealtime(): () => void {
  if (typeof window === 'undefined') return () => undefined

  const onOnline = () => controller.connect()
  const onVisibilityOrFocus = () => {
    if (document.visibilityState !== 'visible') return
    controller.connect()
  }

  controller.start()
  const stopSessionActive = onSessionActive(() => controller.connect())
  const stopSessionCleared = onSessionCleared(() => controller.stop())
  const stopSessionTokenRefreshed = onSessionTokenRefreshed(() => controller.connect())

  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisibilityOrFocus)
  window.addEventListener('focus', onVisibilityOrFocus)

  return () => {
    stopSessionActive?.()
    stopSessionCleared?.()
    stopSessionTokenRefreshed?.()
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisibilityOrFocus)
    window.removeEventListener('focus', onVisibilityOrFocus)
    controller.stop()
  }
}
