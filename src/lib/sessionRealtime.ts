/**
 * Realtime identity session lifecycle via identity-lite WebSocket.
 * Instantly signs the user out when the server revokes their refresh session.
 */

import { ensureFreshSession, getSession, notifySessionExpiredIfNeeded } from '@/auth/authService'
import { onSessionActive, onSessionCleared, onSessionTokenRefreshed } from '@/auth/sessionEvents'
import { createIdentitySessionWebSocketUrl } from '@/lib/api/identityApi'

type SessionRevokedPayload = {
  reason?: string
  except_session_id?: string | null
}

function sessionIdFromAccessToken(token: string): string | null {
  try {
    const segment = token.split('.')[1]
    if (!segment) return null
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(normalized)) as { sid?: string }
    return typeof json.sid === 'string' ? json.sid : null
  } catch {
    return null
  }
}

function shouldHandleRevoked(payload: SessionRevokedPayload | undefined, accessToken: string): boolean {
  const exceptSid = payload?.except_session_id
  if (!exceptSid) return true
  const mySid = sessionIdFromAccessToken(accessToken)
  return !mySid || mySid !== exceptSid
}

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

class IdentitySessionRealtimeController {
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

  private handleRevoked(payload: SessionRevokedPayload | undefined, boundAccessToken: string): void {
    const currentSession = getSession()
    if (!currentSession?.token) return

    const boundSid = sessionIdFromAccessToken(boundAccessToken)
    const currentSid = sessionIdFromAccessToken(currentSession.token)
    // Token rotation issues a new access token; ignore revoke events tied to the old sid.
    if (boundSid && currentSid && boundSid !== currentSid) {
      this.connect()
      return
    }

    if (!shouldHandleRevoked(payload, currentSession.token)) return
    notifySessionExpiredIfNeeded({
      reason: payload?.reason ?? 'session_revoked_elsewhere',
    })
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

      const url = createIdentitySessionWebSocketUrl({ token: session.token })
      const ws = new WebSocket(url)
      this.socket = ws
      const accessToken = session.token

      ws.onopen = () => {
        if (this.disposed || generation !== this.socketGeneration || this.socket !== ws) return
        this.reconnectAttempt = 0
      }

      ws.onmessage = (event) => {
        if (this.disposed || generation !== this.socketGeneration || this.socket !== ws) return
        try {
          const parsed = JSON.parse(String(event.data)) as {
            type?: string
            payload?: SessionRevokedPayload
          }
          if (parsed.type === 'identity.session.revoked') {
            this.handleRevoked(parsed.payload, accessToken)
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

const controller = new IdentitySessionRealtimeController()

/** Start identity-lite session WebSocket while the user is signed in. */
export function initIdentitySessionRealtime(): () => void {
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
