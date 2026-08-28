/**
 * Notification service API client.
 * Integrates with python-notification-service-fastapi (e.g. http://localhost:8700).
 * Set VITE_NOTIFICATION_API_URL in .env to point to your notification service.
 * All list/count/read endpoints require app_id and user_id (query params).
 */

import { getSession } from '@/auth/authService'
import { emitNotificationsUpdated } from '@/lib/chat/chatRealtimeEvents'
import { createClientUuid } from '@/lib/createClientUuid'
import { apiFetch, authHeaders } from './httpClient'

import { serviceApiBase } from './gatewayBase'

const BASE_URL = serviceApiBase('/api/notification-service', import.meta.env.VITE_NOTIFICATION_API_URL)

function notificationWebSocketBaseUrl(): string {
  const override = (import.meta.env.VITE_NOTIFICATION_API_URL as string | undefined)?.replace(/\/$/, '')
  if (override) return override
  return '/api/notification-service'
}

/** App GUID for Tectona (notification service expects app_id per platform). */
export const TECTONA_APP_ID = '00000000-0000-0000-0000-000000000941'

/** Dev: WS uses Vite proxy `/api/notification-service` → notification :8700. */
export function createNotificationWebSocketUrl(options?: { token?: string }): string {
  const rawBase = notificationWebSocketBaseUrl()
  const url =
    rawBase.startsWith('http://') || rawBase.startsWith('https://')
      ? new URL(rawBase)
      : new URL(rawBase, window.location.origin)

  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/v1/notifications/ws/notifications`
  url.search = ''
  url.searchParams.set('app_id', TECTONA_APP_ID)
  if (options?.token) {
    url.searchParams.set('token', options.token)
  }
  return url.toString()
}

/** Backend notification item (raw from API). */
export interface NotificationApiBackend {
  id: string
  app_id: string
  user_id: string
  type_id: string
  type_code: string
  title: string
  body: string | null
  is_read: boolean
  read_at: string | null
  link_url: string | null
  metadata: Record<string, unknown> | null
  created_date: string
}

/** Frontend notification shape (used by UI). */
export interface NotificationApi {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  created_at: string
  link?: string | null
  metadata?: Record<string, unknown> | null
}

export interface NotificationListResponse {
  notifications: NotificationApi[]
  total: number
  page: number
  page_size: number
  unread_count: number
}

export interface UnreadCountResponse {
  unread_count: number
}

function humanizeNotificationBody(body: string | null): string {
  const raw = body?.trim() ?? ''
  if (!raw) return ''
  const cleaned = raw
    .replace(/\s*\[(?:personal_workspace_id|operational_workspace_id)=[^\]]+\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (/^corporate onboarding complete\s*[—-]\s*awaiting admin approval\.?$/i.test(cleaned)) {
    return 'Corporate onboarding is complete and awaiting admin approval.'
  }
  if (/^request to join organization directory\.?$/i.test(cleaned)) {
    return 'A workspace access request is waiting for admin approval.'
  }
  return cleaned
}

function mapBackendToFrontend(n: NotificationApiBackend): NotificationApi {
  return {
    id: n.id,
    title: n.title,
    message: humanizeNotificationBody(n.body),
    type: typeCodeToUi(n.type_code),
    read: n.is_read,
    created_at: n.created_date,
    link: n.link_url,
    metadata: n.metadata ?? undefined,
  }
}

function typeCodeToUi(typeCode: string): NotificationApi['type'] {
  switch (typeCode) {
    case 'connector':
      return 'warning'
    case 'dataset':
      return 'success'
    case 'folder':
      return 'info'
    case 'workspace_access':
      return 'warning'
    default:
      return 'info'
  }
}

export interface NotificationListParams {
  app_id: string
  user_id: string
  page?: number
  page_size?: number
  is_read?: boolean
  type_code?: string
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

/**
 * List notifications. Requires app_id and user_id.
 */
export async function fetchNotifications(params: NotificationListParams & {
  page?: number
  page_size?: number
  unread_only?: boolean
}): Promise<NotificationListResponse> {
  const { app_id, user_id, page = 1, page_size = 20, unread_only } = params
  const sp = new URLSearchParams()
  sp.set('app_id', app_id)
  sp.set('user_id', user_id)
  sp.set('page', String(page))
  sp.set('page_size', String(page_size))
  if (unread_only) sp.set('is_read', 'false')
  const res = await apiFetch(`${BASE_URL}/v1/notifications?${sp}`)
  const data = await handleResponse<{
    notifications: NotificationApiBackend[]
    total: number
    page: number
    page_size: number
  }>(res)
  const unreadRes = await apiFetch(
    `${BASE_URL}/v1/notifications/unread-count?app_id=${encodeURIComponent(app_id)}&user_id=${encodeURIComponent(user_id)}`
  )
  const unreadData = await handleResponse<{ unread_count: number }>(unreadRes)
  return {
    notifications: data.notifications.map(mapBackendToFrontend),
    total: data.total,
    page: data.page,
    page_size: data.page_size,
    unread_count: unreadData.unread_count,
  }
}

/**
 * Get unread notification count. Requires app_id and user_id.
 */
export async function fetchUnreadCount(params: { app_id: string; user_id: string }): Promise<UnreadCountResponse> {
  const sp = new URLSearchParams()
  sp.set('app_id', params.app_id)
  sp.set('user_id', params.user_id)
  const res = await apiFetch(`${BASE_URL}/v1/notifications/unread-count?${sp}`)
  const data = await handleResponse<{ unread_count: number }>(res)
  return { unread_count: data.unread_count }
}

/**
 * Mark a notification as read. Requires app_id and user_id (query).
 */
export async function markNotificationRead(
  id: string,
  params: { app_id: string; user_id: string }
): Promise<void> {
  const sp = new URLSearchParams()
  sp.set('app_id', params.app_id)
  sp.set('user_id', params.user_id)
  sp.set('is_read', 'true')
  const res = await apiFetch(`${BASE_URL}/v1/notifications/${id}/read?${sp}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
}

/**
 * Mark all notifications as read. Requires app_id and user_id (query).
 */
export async function markAllNotificationsRead(params: {
  app_id: string
  user_id: string
}): Promise<void> {
  const sp = new URLSearchParams()
  sp.set('app_id', params.app_id)
  sp.set('user_id', params.user_id)
  const res = await apiFetch(`${BASE_URL}/v1/notifications/mark-all-read?${sp}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
}

/** Payload for creating a notification (POST /v1/notifications). */
export interface CreateNotificationPayload {
  app_id: string
  user_id: string
  type_code: string
  title: string
  body?: string | null
  link_url?: string | null
  metadata?: Record<string, unknown> | null
  created_by?: string | null
  created_from: string
}

/**
 * Dedupe keys for notifications this tab just created via `notifyEvent` — the caller already
 * showed its own success toast, so the realtime WebSocket echo of the same notification must
 * not toast again.
 *
 * The key is generated and registered *before* the create request is even sent, not after it
 * resolves: the WebSocket push can (and does, in practice) reach the client before the HTTP
 * response of the very request that triggered it, since the backend broadcasts synchronously
 * inside the request handler while the client's fetch() still has a full round trip left. Keying
 * off the server-assigned notification id (known only after the response resolves) loses that
 * race. Keying off a client-generated id present in `metadata` from the start does not.
 * Entries self-expire; they only need to survive the brief window until the echo arrives.
 */
const selfCreatedDedupeKeys = new Set<string>()

function registerSelfCreatedDedupeKey(): string {
  const key = createClientUuid()
  selfCreatedDedupeKeys.add(key)
  window.setTimeout(() => selfCreatedDedupeKeys.delete(key), 10_000)
  return key
}

/** True (and consumes the entry) if this notification was just created by `notifyEvent` in this tab. */
export function consumeSelfCreatedNotification(dedupeKey: string | undefined | null): boolean {
  if (!dedupeKey || !selfCreatedDedupeKeys.has(dedupeKey)) return false
  selfCreatedDedupeKeys.delete(dedupeKey)
  return true
}

/**
 * Create a notification. Used when e.g. folder/project is created so it appears in the notification panel.
 */
export async function createNotification(payload: CreateNotificationPayload): Promise<{ id: string }> {
  const res = await apiFetch(`${BASE_URL}/v1/notifications`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      app_id: payload.app_id,
      user_id: payload.user_id,
      type_code: payload.type_code,
      title: payload.title,
      body: payload.body ?? null,
      link_url: payload.link_url ?? null,
      metadata: payload.metadata ?? null,
      created_by: payload.created_by ?? null,
      created_from: payload.created_from,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Helper: create a notification for the current user (non-blocking).
 * Call after success toasts so the event also appears in the Notifications panel.
 * The caller's own toast already covers immediate feedback, so the realtime WebSocket
 * echo of this same notification is marked to skip its toast (see `consumeSelfCreatedNotification`).
 */
export function notifyEvent(params: {
  type_code: 'project' | 'connector' | 'dataset' | 'folder' | 'todo' | 'workspace_access'
  title: string
  body?: string | null
  link_url?: string | null
  metadata?: Record<string, unknown> | null
}): void {
  try {
    const session = getSession()
    if (!session?.user?.id) return
    // Register the dedupe key before the request is sent — see selfCreatedDedupeKeys comment above.
    const dedupeKey = registerSelfCreatedDedupeKey()
    createNotification({
      app_id: TECTONA_APP_ID,
      user_id: session.user.id,
      type_code: params.type_code,
      title: params.title,
      body: params.body ?? null,
      link_url: params.link_url ?? null,
      metadata: { ...params.metadata, __client_dedupe_key: dedupeKey },
      created_from: 'tectona-frontend',
    })
      .then(() => emitNotificationsUpdated())
      .catch(() => {
        selfCreatedDedupeKeys.delete(dedupeKey)
      })
  } catch {
    // Fan-out must never fail the caller (e.g. HTTP origins without crypto.randomUUID).
  }
}
