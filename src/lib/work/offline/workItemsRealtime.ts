import { getSession } from '@/auth/authService'
import { onSessionActive } from '@/auth/sessionEvents'
import { createWorkEventsWebSocketUrl } from '@/lib/api/workApi'
import { pullWorkItemsDelta } from './workOfflineClient'

type WorkItemRealtimePayload = {
  workspace?: string
  business_key?: string
  action?: string
  version?: number
  actor_id?: string
  occurred_at?: string
}

const PULL_DEBOUNCE_MS = 900
const FOCUS_PULL_COOLDOWN_MS = 2_000

type ConnectionListener = (connected: boolean) => void

let pullTimer: number | null = null
let lastFocusPullAt = 0

const connectionListeners = new Set<ConnectionListener>()
let lastConnected = false

function notifyConnection(connected: boolean): void {
  lastConnected = connected
  connectionListeners.forEach((listener) => listener(connected))
}

export function subscribeWorkItemsRealtimeConnected(listener: ConnectionListener): () => void {
  connectionListeners.add(listener)
  listener(lastConnected)
  return () => connectionListeners.delete(listener)
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

function shouldPullForEvent(payload: WorkItemRealtimePayload | undefined): boolean {
  if (!payload) return true
  const actorId = payload.actor_id?.trim()
  if (actorId?.startsWith('integration:')) return true
  const session = getSession()
  const userId = session?.user?.id?.trim()
  if (actorId && userId && actorId === userId) {
    return false
  }
  return true
}

function scheduleDeltaPullFromServer(payload?: WorkItemRealtimePayload): void {
  if (!shouldPullForEvent(payload)) return
  if (pullTimer !== null) {
    window.clearTimeout(pullTimer)
  }
  const workspace = payload?.workspace?.trim() || undefined
  pullTimer = window.setTimeout(() => {
    pullTimer = null
    void pullWorkItemsDelta({ notifyUi: true, workspace })
  }, PULL_DEBOUNCE_MS)
}

function pullOnFocusIfStale(workspace?: string): void {
  const now = Date.now()
  if (now - lastFocusPullAt < FOCUS_PULL_COOLDOWN_MS) return
  lastFocusPullAt = now
  void pullWorkItemsDelta({ notifyUi: true, workspace })
}

class WorkItemsRealtimeController {
  private disposed = true
  private refCount = 0
  private socket: WebSocket | null = null
  private socketGeneration = 0
  private reconnectTimer: number | null = null
  private reconnectAttempt = 0
  private stopSessionActive: (() => void) | undefined
  private connected = false
  private cleanup: (() => void) | null = null

  workspaceScope: string | null = null

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private setConnected(next: boolean): void {
    if (this.connected === next) return
    this.connected = next
    notifyConnection(next)
  }

  private scheduleReconnect(): void {
    if (this.disposed) return
    const delay = Math.min(30_000, 1000 * 2 ** this.reconnectAttempt)
    this.reconnectAttempt += 1
    this.clearReconnect()
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay)
  }

  setWorkspaceScope(scope: string | null): void {
    const normalized = scope?.trim() ? scope.trim() : null
    if (this.workspaceScope === normalized) return
    this.workspaceScope = normalized
    if (this.disposed) return
    this.reconnectAttempt = 0
    this.connect()
  }

  private connect(): void {
    if (this.disposed || !navigator.onLine) return

    if (this.socket) {
      closeWebSocketQuietly(this.socket)
      this.socket = null
    }
    this.setConnected(false)

    const session = getSession()
    const url = createWorkEventsWebSocketUrl({
      token: session?.token,
      workspace: this.workspaceScope ?? undefined,
    })
    const generation = ++this.socketGeneration
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
          payload?: WorkItemRealtimePayload
        }
        if (!parsed.type?.startsWith('work.item.')) return
        scheduleDeltaPullFromServer(parsed.payload)
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
  }

  ensureStarted(): void {
    this.refCount += 1
    if (!this.disposed) return

    this.disposed = false
    this.reconnectAttempt = 0

    const onOnline = () => {
      this.reconnectAttempt = 0
      this.connect()
    }

    const onOffline = () => {
      this.clearReconnect()
      closeWebSocketQuietly(this.socket)
      this.socket = null
      this.setConnected(false)
    }

    const onVisibilityOrFocus = () => {
      if (document.visibilityState !== 'visible') return
      if (this.socket?.readyState === WebSocket.OPEN) return
      pullOnFocusIfStale(this.workspaceScope ?? undefined)
      if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
        this.reconnectAttempt = 0
        this.connect()
      }
    }

    this.connect()
    this.stopSessionActive = onSessionActive(() => this.connect())
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisibilityOrFocus)
    window.addEventListener('focus', onVisibilityOrFocus)

    this.cleanup = () => {
      this.disposed = true
      this.socketGeneration += 1
      this.stopSessionActive?.()
      this.clearReconnect()
      if (pullTimer !== null) {
        window.clearTimeout(pullTimer)
        pullTimer = null
      }
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisibilityOrFocus)
      window.removeEventListener('focus', onVisibilityOrFocus)
      closeWebSocketQuietly(this.socket)
      this.socket = null
      this.setConnected(false)
    }
  }

  stop(): void {
    this.refCount = Math.max(0, this.refCount - 1)
    if (this.refCount > 0) return
    this.cleanup?.()
    this.cleanup = null
    this.disposed = true
  }
}

const controller = new WorkItemsRealtimeController()

/** Set workspace-scoped WS subscription (`null` = global, all workspaces). */
export function setWorkItemsRealtimeWorkspace(workspace: string | null): void {
  controller.setWorkspaceScope(workspace)
}

/** WebSocket listener for work.item.* events — triggers background delta sync. */
export function initWorkItemsRealtime(): () => void {
  if (typeof window === 'undefined') return () => undefined
  controller.ensureStarted()
  return () => controller.stop()
}
