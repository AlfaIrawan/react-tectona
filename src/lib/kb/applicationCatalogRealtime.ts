import { ensureFreshSession, getSession } from '@/auth/authService'
import { createTectonaKbEventsWebSocketUrl } from '@/lib/api/tectonaKbApi'

export const APPLICATION_CATALOG_CHANGED_EVENT = 'tectona:application-catalog-changed'

const APPLICATION_CATALOG_CHANNEL = 'tectona:application-catalog-changed'

export type ApplicationCatalogChangedDetail = {
  workspaceId?: string | null
}

function canUseBrowserEvents() {
  return typeof window !== 'undefined'
}

function emitApplicationCatalogChanged(detail: ApplicationCatalogChangedDetail) {
  window.dispatchEvent(new CustomEvent<ApplicationCatalogChangedDetail>(APPLICATION_CATALOG_CHANGED_EVENT, { detail }))
}

export function publishApplicationCatalogChanged(detail: ApplicationCatalogChangedDetail = {}) {
  if (!canUseBrowserEvents()) return

  emitApplicationCatalogChanged(detail)

  if (typeof BroadcastChannel === 'undefined') return
  const channel = new BroadcastChannel(APPLICATION_CATALOG_CHANNEL)
  channel.postMessage(detail)
  channel.close()
}

function isKnowledgeBaseChange(message: unknown): message is Record<string, unknown> {
  if (!message || typeof message !== 'object') return false
  const event = message as Record<string, unknown>
  const type = typeof event.type === 'string' ? event.type.toLowerCase() : ''
  const payload = (event.payload ?? event.data ?? event.detail) as Record<string, unknown> | undefined
  const category = typeof payload?.category === 'string'
    ? payload.category
    : typeof event.category === 'string'
      ? event.category
      : ''
  return category === 'application_catalog' || /^(kb|knowledge[._-]?base)\.(entry|catalog)\./.test(type)
}

function workspaceIdFromMessage(message: Record<string, unknown>): string | null | undefined {
  const payload = (message.payload ?? message.data ?? message.detail) as Record<string, unknown> | undefined
  const workspaceId = payload?.workspace_id ?? payload?.workspaceId ?? message.workspace_id ?? message.workspaceId
  return typeof workspaceId === 'string' || workspaceId === null ? workspaceId : undefined
}

class ApplicationCatalogRealtimeController {
  private socket: WebSocket | null = null
  private reconnectTimer: number | null = null
  private subscribers = 0
  private stopped = true

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer !== null) return
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, 10_000)
  }

  private connect() {
    if (this.stopped || !navigator.onLine || this.socket) return
    void (async () => {
      const session = (await ensureFreshSession()) ?? getSession()
      if (this.stopped || !session?.token || this.socket) return
      const url = createTectonaKbEventsWebSocketUrl({ token: session.token })
      if (!url) return
      const socket = new WebSocket(url)
      this.socket = socket
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as unknown
          if (isKnowledgeBaseChange(message)) {
            emitApplicationCatalogChanged({ workspaceId: workspaceIdFromMessage(message) })
          }
        } catch {
          // Ignore malformed service events.
        }
      }
      socket.onclose = () => {
        if (this.socket !== socket) return
        this.socket = null
        this.scheduleReconnect()
      }
      socket.onerror = () => socket.close()
    })().catch(() => this.scheduleReconnect())
  }

  subscribe() {
    this.subscribers += 1
    this.stopped = false
    this.connect()
    return () => {
      this.subscribers = Math.max(0, this.subscribers - 1)
      if (this.subscribers > 0) return
      this.stopped = true
      if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
      this.socket?.close()
      this.socket = null
    }
  }
}

const realtimeController = new ApplicationCatalogRealtimeController()

export function subscribeToApplicationCatalogChanges(
  onChange: (detail: ApplicationCatalogChangedDetail) => void,
) {
  if (!canUseBrowserEvents()) return () => undefined

  const handleWindowChange = (event: Event) => {
    onChange((event as CustomEvent<ApplicationCatalogChangedDetail>).detail ?? {})
  }
  window.addEventListener(APPLICATION_CATALOG_CHANGED_EVENT, handleWindowChange)

  const channel = typeof BroadcastChannel === 'undefined'
    ? null
    : new BroadcastChannel(APPLICATION_CATALOG_CHANNEL)
  const handleBroadcastChange = (event: MessageEvent<ApplicationCatalogChangedDetail>) => {
    onChange(event.data ?? {})
  }
  channel?.addEventListener('message', handleBroadcastChange)
  const unsubscribeRealtime = realtimeController.subscribe()

  return () => {
    window.removeEventListener(APPLICATION_CATALOG_CHANGED_EVENT, handleWindowChange)
    channel?.removeEventListener('message', handleBroadcastChange)
    channel?.close()
    unsubscribeRealtime()
  }
}
