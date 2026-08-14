/**
 * Realtime Directory / Members sync via workspace-org + WAC WebSockets.
 * On mutation events (including own actor / other tabs), debounces a silent live refresh
 * so open Directory/Members panels update without a manual reload or loading flash.
 */

import { ensureFreshSession, getSession } from '@/auth/authService'
import { onSessionActive } from '@/auth/sessionEvents'
import { createWacEventsWebSocketUrl } from '@/lib/api/workspaceAccessControlApi'
import { createWorkspaceOrgEventsWebSocketUrl } from '@/lib/api/workspaceOrgApi'

type RealtimePayload = {
  actor_id?: string
  entity?: string
  action?: string
  workspace_id?: string
  organization_id?: string
  occurred_at?: string
}

const PULL_DEBOUNCE_MS = 180

type RefreshHandler = () => void | Promise<void>
type ConnectionListener = (connected: boolean) => void

let refreshHandler: RefreshHandler | null = null
let pullTimer: number | null = null

const connectionListeners = new Set<ConnectionListener>()
let lastConnected = false

function notifyConnection(connected: boolean): void {
  lastConnected = connected
  connectionListeners.forEach((listener) => listener(connected))
}

export function subscribeWorkspaceDirectoryRealtimeConnected(
  listener: ConnectionListener
): () => void {
  connectionListeners.add(listener)
  listener(lastConnected)
  return () => connectionListeners.delete(listener)
}

export function setWorkspaceDirectoryRealtimeRefreshHandler(handler: RefreshHandler | null): void {
  refreshHandler = handler
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

function shouldRefreshForEvent(_payload: RealtimePayload | undefined): boolean {
  // Always refresh — including own actor — so other tabs/windows of the same user
  // (and Members panel open elsewhere) stay in sync without a manual reload.
  return true
}

function scheduleRefresh(payload?: RealtimePayload): void {
  if (!shouldRefreshForEvent(payload)) return
  if (!refreshHandler) return
  if (pullTimer !== null) {
    window.clearTimeout(pullTimer)
  }
  pullTimer = window.setTimeout(() => {
    pullTimer = null
    void refreshHandler?.()
  }, PULL_DEBOUNCE_MS)
}

class SingleSocketController {
  private disposed = true
  private socket: WebSocket | null = null
  private socketGeneration = 0
  private reconnectTimer: number | null = null
  private reconnectAttempt = 0
  private connected = false
  private readonly buildUrl: (token?: string) => string
  private readonly eventPrefix: string
  private readonly onConnectionChange: (connected: boolean) => void

  constructor(
    buildUrl: (token?: string) => string,
    eventPrefix: string,
    onConnectionChange: (connected: boolean) => void
  ) {
    this.buildUrl = buildUrl
    this.eventPrefix = eventPrefix
    this.onConnectionChange = onConnectionChange
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private setConnected(next: boolean): void {
    if (this.connected === next) return
    this.connected = next
    this.onConnectionChange(next)
  }

  get isConnected(): boolean {
    return this.connected
  }

  private scheduleReconnect(): void {
    if (this.disposed) return
    const delay = Math.min(30_000, 1000 * 2 ** this.reconnectAttempt)
    this.reconnectAttempt += 1
    this.clearReconnect()
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay)
  }

  connect(): void {
    if (this.disposed || !navigator.onLine) return

    // Keep a healthy socket open — do not tear down on focus/session noise.
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
    this.setConnected(false)

    const generation = ++this.socketGeneration
    void (async () => {
      if (this.disposed || generation !== this.socketGeneration) return
      const session = (await ensureFreshSession()) ?? getSession()
      if (this.disposed || generation !== this.socketGeneration) return
      const url = this.buildUrl(session?.token)
      const ws = new WebSocket(url)
      this.socket = ws

      ws.onopen = () => {
        if (this.disposed || generation !== this.socketGeneration || this.socket !== ws) return
        this.reconnectAttempt = 0
        this.setConnected(true)
      }

      ws.onmessage = (event) => {
        if (this.disposed || generation !== this.socketGeneration || this.socket !== ws) return
        try {
          const parsed = JSON.parse(String(event.data)) as {
            type?: string
            payload?: RealtimePayload
          }
          if (!parsed.type?.startsWith(this.eventPrefix)) return
          if (parsed.type.endsWith('.realtime.connected')) return
          scheduleRefresh(parsed.payload)
        } catch {
          // ignore malformed frames
        }
      }

      ws.onclose = () => {
        if (this.socket === ws) this.socket = null
        this.setConnected(false)
        if (this.disposed || generation !== this.socketGeneration) return
        this.scheduleReconnect()
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
    this.setConnected(false)
  }
}

class WorkspaceDirectoryRealtimeController {
  private refCount = 0
  private cleanup: (() => void) | null = null
  private orgConnected = false
  private wacConnected = false

  private readonly orgSocket = new SingleSocketController(
    (token) => createWorkspaceOrgEventsWebSocketUrl({ token }),
    'workspace_org.',
    (connected) => {
      this.orgConnected = connected
      notifyConnection(this.orgConnected || this.wacConnected)
    }
  )

  private readonly wacSocket = new SingleSocketController(
    (token) => createWacEventsWebSocketUrl({ token }),
    'wac.',
    (connected) => {
      this.wacConnected = connected
      notifyConnection(this.orgConnected || this.wacConnected)
    }
  )

  ensureStarted(): void {
    this.refCount += 1
    if (this.cleanup) return

    const onOnline = () => {
      this.orgSocket.connect()
      this.wacSocket.connect()
    }
    const onOffline = () => {
      // Sockets will drop; reconnect when back online.
      notifyConnection(false)
    }
    const onVisibilityOrFocus = () => {
      if (document.visibilityState !== 'visible') return
      if (!this.orgSocket.isConnected) this.orgSocket.connect()
      if (!this.wacSocket.isConnected) this.wacSocket.connect()
    }

    this.orgSocket.start()
    this.wacSocket.start()
    const stopSessionActive = onSessionActive(() => {
      this.orgSocket.connect()
      this.wacSocket.connect()
    })

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisibilityOrFocus)
    window.addEventListener('focus', onVisibilityOrFocus)

    this.cleanup = () => {
      stopSessionActive?.()
      if (pullTimer !== null) {
        window.clearTimeout(pullTimer)
        pullTimer = null
      }
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisibilityOrFocus)
      window.removeEventListener('focus', onVisibilityOrFocus)
      this.orgSocket.stop()
      this.wacSocket.stop()
      notifyConnection(false)
    }
  }

  stop(): void {
    this.refCount = Math.max(0, this.refCount - 1)
    if (this.refCount > 0) return
    this.cleanup?.()
    this.cleanup = null
  }
}

const controller = new WorkspaceDirectoryRealtimeController()

/** Start workspace-org + WAC WebSocket listeners while Workspace Management is mounted. */
export function initWorkspaceDirectoryRealtime(): () => void {
  if (typeof window === 'undefined') return () => undefined
  controller.ensureStarted()
  return () => controller.stop()
}
