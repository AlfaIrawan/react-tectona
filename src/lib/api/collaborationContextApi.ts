/**
 * Shared collaboration-context-service (port 8429).
 * Multi-tenant via app_id — same pattern as notification-service.
 */

import { decodePeopleChatBody } from '@/lib/chat/peopleChatMessagePayload'
import { apiFetch, tectonaServiceHeaders } from './httpClient'
import { TECTONA_APP_ID } from './notificationApi'
import { TECTONA_CHAT_WORKSPACE_ID } from './tectonaAgentRuntimeApi'

export { TECTONA_APP_ID as TECTONA_CHAT_COLLABORATION_APP_ID }
export { TECTONA_CHAT_WORKSPACE_ID }

function collaborationContextBaseUrl(): string {
  const override = import.meta.env.VITE_COLLABORATION_CONTEXT_API_URL?.trim()
  if (override) return override.replace(/\/$/, '')
  // Same-origin — nginx/Vite proxy → collaboration-context (8429).
  return '/api/collaboration-context'
}

const BASE_URL = collaborationContextBaseUrl()

function extractCollaborationApiError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const body = err as { error?: { message?: unknown }; detail?: unknown; message?: unknown }
    const nested = body.error?.message
    if (typeof nested === 'string' && nested.trim()) return nested
    if (typeof body.detail === 'string' && body.detail.trim()) return body.detail
    if (typeof body.message === 'string' && body.message.trim()) return body.message
  }
  return fallback
}

function withAppId(path: string, appId: string = TECTONA_APP_ID): string {
  const sep = path.includes('?') ? '&' : '?'
  return `${BASE_URL}${path}${sep}app_id=${encodeURIComponent(appId)}`
}

export interface CollaborationChannelApi {
  id: string
  app_id?: string
  workspace_id: string
  channel_type: string
  title?: string | null
  context_type?: string | null
  context_id?: string | null
  last_message_at?: string | null
  last_read_sequence?: number
  peer_user_id?: string | null
  peer_last_read_sequence?: number
  peer_last_delivered_sequence?: number
  last_message_preview?: string | null
  last_sequence_no?: number
  unread_count?: number
  disappearing_messages_ttl?: string
  is_chat_locked?: boolean
  has_chat_lock_password?: boolean
}

export interface CollaborationMessageApi {
  id: string
  channel_id: string
  sender_user_id: string
  message_role: string
  body: string
  sequence_no: number
  message_at: string
  expires_at?: string | null
  client_message_id?: string | null
}

export async function createDirectChannel(
  workspaceId: string,
  peerUserId: string,
  appId: string = TECTONA_APP_ID,
): Promise<CollaborationChannelApi> {
  const res = await apiFetch(
    withAppId(`/v1/workspaces/${encodeURIComponent(workspaceId)}/channels/direct`, appId),
    {
      method: 'POST',
      headers: tectonaServiceHeaders(),
      body: JSON.stringify({ peer_user_id: peerUserId }),
    },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } })?.error?.message ?? res.statusText)
  }
  return res.json()
}

export async function listChannelMessages(
  channelId: string,
  options?: { afterSequence?: number; limit?: number; appId?: string },
): Promise<CollaborationMessageApi[]> {
  const appId = options?.appId ?? TECTONA_APP_ID
  const params = new URLSearchParams({ app_id: appId })
  if (options?.afterSequence != null) params.set('after_sequence', String(options.afterSequence))
  if (options?.limit != null) params.set('limit', String(options.limit))
  const res = await apiFetch(
    `${BASE_URL}/v1/channels/${encodeURIComponent(channelId)}/messages?${params}`,
    { headers: tectonaServiceHeaders() },
  )
  if (!res.ok) throw new Error(`list messages failed: ${res.status}`)
  return res.json()
}

export interface CollaborationChannelListResponse {
  items: CollaborationChannelApi[]
  total: number
  page: number
  page_size: number
}

export interface CollaborationMentionApi {
  id: string
  workspace_id: string
  message_id: string
  channel_id: string
  status: string
  message_preview: string
  sender_user_id: string
  message_at: string
}

export interface CollaborationMentionListResponse {
  items: CollaborationMentionApi[]
  total: number
  page: number
  page_size: number
}

export interface CollaborationSummaryApi {
  workspace_id: string
  app_id?: string
  thread_count: number
  unread_mentions: number
  open_threads: number
}

export async function enableChannelChatLock(
  channelId: string,
  appId: string = TECTONA_APP_ID,
): Promise<CollaborationChannelApi> {
  const path = withAppId(`/v1/channels/${encodeURIComponent(channelId)}/chat-lock/enable`, appId)
  const res = await apiFetch(path, {
    method: 'POST',
    headers: tectonaServiceHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(extractCollaborationApiError(err, res.statusText || 'Failed to enable chat lock'))
  }
  return res.json()
}

export async function setChannelChatLock(
  channelId: string,
  password: string,
  appId: string = TECTONA_APP_ID,
): Promise<CollaborationChannelApi> {
  const path = withAppId(`/v1/channels/${encodeURIComponent(channelId)}/chat-lock`, appId)
  const init = {
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({ password }),
  }
  let res = await apiFetch(path, { method: 'POST', ...init })
  if (res.status === 404 || res.status === 405) {
    res = await apiFetch(path, { method: 'PUT', ...init })
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(extractCollaborationApiError(err, res.statusText || 'Failed to set chat lock'))
  }
  return res.json()
}

export async function verifyChannelChatLock(
  channelId: string,
  password: string,
  appId: string = TECTONA_APP_ID,
): Promise<boolean> {
  const res = await apiFetch(
    withAppId(`/v1/channels/${encodeURIComponent(channelId)}/chat-lock/verify`, appId),
    {
      method: 'POST',
      headers: tectonaServiceHeaders(),
      body: JSON.stringify({ password }),
    },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(extractCollaborationApiError(err, res.statusText || 'Failed to verify chat lock'))
  }
  const body = (await res.json()) as { valid?: boolean }
  return body.valid === true
}

export async function removeChannelChatLock(
  channelId: string,
  password?: string,
  appId: string = TECTONA_APP_ID,
): Promise<CollaborationChannelApi> {
  const path = withAppId(`/v1/channels/${encodeURIComponent(channelId)}/chat-lock`, appId)
  if (password) {
    const res = await apiFetch(
      withAppId(`/v1/channels/${encodeURIComponent(channelId)}/chat-lock/remove`, appId),
      {
        method: 'POST',
        headers: tectonaServiceHeaders(),
        body: JSON.stringify({ password }),
      },
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(extractCollaborationApiError(err, res.statusText || 'Failed to remove chat lock'))
    }
    return res.json()
  }
  const res = await apiFetch(path, { method: 'DELETE', headers: tectonaServiceHeaders() })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(extractCollaborationApiError(err, res.statusText || 'Failed to remove chat lock'))
  }
  return res.json()
}

export async function patchChannelDisappearingMessages(
  channelId: string,
  duration: 'off' | '24h' | '7d' | '90d',
  appId: string = TECTONA_APP_ID,
): Promise<CollaborationChannelApi> {
  const path = withAppId(`/v1/channels/${encodeURIComponent(channelId)}/disappearing-messages`, appId)
  const init = {
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({ duration }),
  }
  let res = await apiFetch(path, { method: 'POST', ...init })
  if (res.status === 404 || res.status === 405) {
    res = await apiFetch(path, { method: 'PATCH', ...init })
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(extractCollaborationApiError(err, res.statusText || 'Request failed'))
  }
  return res.json()
}

export async function fetchCollaborationChannel(
  channelId: string,
  appId: string = TECTONA_APP_ID,
): Promise<CollaborationChannelApi> {
  const res = await apiFetch(
    withAppId(`/v1/channels/${encodeURIComponent(channelId)}`, appId),
    { headers: tectonaServiceHeaders() },
  )
  if (!res.ok) throw new Error(`fetch channel failed: ${res.status}`)
  return res.json()
}

export async function listWorkspaceChannels(
  workspaceId: string,
  options?: { channelType?: string; page?: number; pageSize?: number; appId?: string },
): Promise<CollaborationChannelListResponse> {
  const appId = options?.appId ?? TECTONA_APP_ID
  const params = new URLSearchParams({ app_id: appId, page: String(options?.page ?? 1), page_size: String(options?.pageSize ?? 50) })
  if (options?.channelType) params.set('channel_type', options.channelType)
  const res = await apiFetch(
    `${BASE_URL}/v1/workspaces/${encodeURIComponent(workspaceId)}/channels?${params}`,
    { headers: tectonaServiceHeaders() },
  )
  if (!res.ok) throw new Error(`list channels failed: ${res.status}`)
  return res.json()
}

export async function createGroupChannel(
  workspaceId: string,
  title: string,
  memberUserIds: string[],
  appId: string = TECTONA_APP_ID,
): Promise<CollaborationChannelApi> {
  const res = await apiFetch(
    withAppId(`/v1/workspaces/${encodeURIComponent(workspaceId)}/channels/group`, appId),
    {
      method: 'POST',
      headers: tectonaServiceHeaders(),
      body: JSON.stringify({ title, member_user_ids: memberUserIds }),
    },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } })?.error?.message ?? res.statusText)
  }
  return res.json()
}

export async function fetchCollaborationSummary(
  workspaceId: string,
  appId: string = TECTONA_APP_ID,
): Promise<CollaborationSummaryApi> {
  const res = await apiFetch(
    withAppId(`/v1/workspaces/${encodeURIComponent(workspaceId)}/collaboration-summary`, appId),
    { headers: tectonaServiceHeaders() },
  )
  if (!res.ok) throw new Error(`collaboration summary failed: ${res.status}`)
  return res.json()
}

export async function listWorkspaceMentions(
  workspaceId: string,
  options?: { status?: string; page?: number; pageSize?: number; appId?: string },
): Promise<CollaborationMentionListResponse> {
  const appId = options?.appId ?? TECTONA_APP_ID
  const params = new URLSearchParams({ app_id: appId, page: String(options?.page ?? 1), page_size: String(options?.pageSize ?? 50) })
  if (options?.status) params.set('status', options.status)
  const res = await apiFetch(
    `${BASE_URL}/v1/workspaces/${encodeURIComponent(workspaceId)}/mentions?${params}`,
    { headers: tectonaServiceHeaders() },
  )
  if (!res.ok) throw new Error(`list mentions failed: ${res.status}`)
  return res.json()
}

export async function markChannelRead(
  channelId: string,
  sequenceNo: number,
  appId: string = TECTONA_APP_ID,
): Promise<void> {
  const res = await apiFetch(withAppId(`/v1/channels/${encodeURIComponent(channelId)}/read`, appId), {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({ sequence_no: sequenceNo }),
  })
  if (!res.ok) throw new Error(`mark read failed: ${res.status}`)
}

export async function markChannelDelivered(
  channelId: string,
  sequenceNo: number,
  appId: string = TECTONA_APP_ID,
): Promise<void> {
  const res = await apiFetch(withAppId(`/v1/channels/${encodeURIComponent(channelId)}/delivered`, appId), {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({ sequence_no: sequenceNo }),
  })
  if (!res.ok) throw new Error(`mark delivered failed: ${res.status}`)
}

export type CollaborationChatMessageRole = 'user' | 'assistant' | 'system'

export interface CollaborationUiMessage {
  id: string
  role: CollaborationChatMessageRole
  text: string
  at: number
  sequenceNo?: number
  expiresAt?: number
  senderContactId?: string
  attachments?: {
    id: string
    kind: 'image' | 'document' | 'audio' | 'video' | 'contact' | 'poll' | 'event'
    name: string
    url: string
    mimeType?: string
    subtitle?: string
    eventDescription?: string
    eventLocation?: string
  }[]
}

type PeopleUiAttachmentKind = NonNullable<CollaborationUiMessage['attachments']>[number]['kind']

function asChatAttachmentKind(kind: string): PeopleUiAttachmentKind {
  if (
    kind === 'image' ||
    kind === 'document' ||
    kind === 'audio' ||
    kind === 'video' ||
    kind === 'contact' ||
    kind === 'poll' ||
    kind === 'event'
  ) {
    return kind
  }
  return 'document'
}

export function mapCollaborationMessagesToUi(
  messages: CollaborationMessageApi[],
  currentUserId: string,
): CollaborationUiMessage[] {
  return messages.map((m) => {
    const decoded = decodePeopleChatBody(m.body)
    const attachments = decoded.attachments.map((item) => ({
      id: item.id,
      kind: asChatAttachmentKind(String(item.kind || 'document')),
      name: item.name,
      url: item.url,
      ...(item.mimeType ? { mimeType: item.mimeType } : {}),
      ...(item.subtitle ? { subtitle: item.subtitle } : {}),
      ...(item.eventDescription ? { eventDescription: item.eventDescription } : {}),
      ...(item.eventLocation ? { eventLocation: item.eventLocation } : {}),
    }))
    return {
      id: m.id,
      role: m.message_role === 'system' ? 'system' : m.sender_user_id === currentUserId ? 'user' : 'assistant',
      text: decoded.text,
      at: new Date(m.message_at).getTime(),
      sequenceNo: m.sequence_no,
      ...(m.expires_at ? { expiresAt: new Date(m.expires_at).getTime() } : {}),
      ...(m.sender_user_id ? { senderContactId: m.sender_user_id } : {}),
      ...(attachments.length ? { attachments } : {}),
    }
  })
}

export interface CollaborationPresenceApi {
  user_id: string
  status: string
  last_seen_at: string
}

export interface CollaborationPresenceRealtimeEvent {
  type: 'presence.updated' | 'collaboration.presence.connected' | string
  payload?: CollaborationPresenceApi & {
    app_id?: string
    workspace_id?: string
    sub?: string
  }
}

function collaborationWebSocketBaseUrl(): string {
  const override = (import.meta.env.VITE_COLLABORATION_CONTEXT_WS_URL as string | undefined)?.trim()
  if (override) return override.replace(/\/$/, '')
  // Dev: WS must use Vite proxy → collaboration-context directly; gateway-runtime WS upgrade is unreliable.
  if (import.meta.env.DEV) return '/api/collaboration-context'
  return BASE_URL.trim()
}

export function createCollaborationPresenceWebSocketUrl(options: {
  workspaceId: string
  appId?: string
  token?: string
}): string {
  const appId = options.appId ?? TECTONA_APP_ID
  const rawBase = collaborationWebSocketBaseUrl()
  const url =
    rawBase.startsWith('http://') || rawBase.startsWith('https://')
      ? new URL(rawBase)
      : new URL(rawBase, window.location.origin)

  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/v1/ws/presence`
  url.search = ''
  url.searchParams.set('app_id', appId)
  url.searchParams.set('workspace_id', options.workspaceId)
  if (options.token) {
    url.searchParams.set('token', options.token)
  }
  return url.toString()
}

function presenceMeUrl(workspaceId: string, appId: string = TECTONA_APP_ID): string {
  return withAppId(`/v1/workspaces/${encodeURIComponent(workspaceId)}/presence/me`, appId)
}

export async function upsertWorkspacePresenceWithToken(
  token: string,
  workspaceId: string,
  status: 'online' | 'away' | 'offline' = 'online',
  appId: string = TECTONA_APP_ID,
): Promise<void> {
  const res = await fetch(presenceMeUrl(workspaceId, appId), {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error(`upsert presence failed: ${res.status}`)
}

/** Best-effort offline signal when the tab closes (keepalive survives pagehide). */
export function sendOfflinePresenceBeacon(
  token: string,
  workspaceId: string = TECTONA_CHAT_WORKSPACE_ID,
  appId: string = TECTONA_APP_ID,
): void {
  const url = presenceMeUrl(workspaceId, appId)
  void fetch(url, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status: 'offline' }),
    keepalive: true,
  }).catch(() => undefined)
}

export async function upsertMyWorkspacePresence(
  workspaceId: string,
  status: 'online' | 'away' | 'offline' = 'online',
  appId: string = TECTONA_APP_ID,
): Promise<void> {
  const res = await apiFetch(
    withAppId(`/v1/workspaces/${encodeURIComponent(workspaceId)}/presence/me`, appId),
    {
      method: 'PUT',
      headers: tectonaServiceHeaders(),
      body: JSON.stringify({ status }),
    },
  )
  if (!res.ok) throw new Error(`upsert presence failed: ${res.status}`)
}

export async function listWorkspacePresence(
  workspaceId: string,
  userIds?: string[],
  appId: string = TECTONA_APP_ID,
): Promise<CollaborationPresenceApi[]> {
  const params = new URLSearchParams({ app_id: appId })
  for (const id of userIds ?? []) {
    params.append('user_id', id)
  }
  const res = await apiFetch(
    `${BASE_URL}/v1/workspaces/${encodeURIComponent(workspaceId)}/presence?${params}`,
    { headers: tectonaServiceHeaders() },
  )
  if (!res.ok) throw new Error(`list presence failed: ${res.status}`)
  return res.json()
}

export interface VoiceRecordRequestApi {
  app_id: string
  workspace_id: string
  from_user_id: string
  target_user_id: string
  note_hint?: string | null
  requested_at: string
}

export interface VoiceRecordRequestRealtimePayload {
  app_id?: string
  workspace_id?: string
  from_user_id: string
  target_user_id: string
  note_hint?: string | null
  requested_at?: string
  accepted_at?: string
}

/** Ask a peer to open Voice record and record on their own device (not live listen). */
export async function requestRemoteVoiceRecord(
  workspaceId: string,
  targetUserId: string,
  options?: { noteHint?: string; appId?: string },
): Promise<VoiceRecordRequestApi> {
  const appId = options?.appId ?? TECTONA_APP_ID
  const res = await apiFetch(
    withAppId(`/v1/workspaces/${encodeURIComponent(workspaceId)}/voice/record-requests`, appId),
    {
      method: 'POST',
      headers: tectonaServiceHeaders(),
      body: JSON.stringify({
        target_user_id: targetUserId,
        ...(options?.noteHint?.trim() ? { note_hint: options.noteHint.trim() } : {}),
      }),
    },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(extractCollaborationApiError(err, res.statusText || 'request voice record failed'))
  }
  return res.json()
}

/** Target accepts a remote record request so the requester can show Joined. */
export async function acceptRemoteVoiceRecord(
  workspaceId: string,
  fromUserId: string,
  options?: { noteHint?: string; appId?: string },
): Promise<VoiceRecordRequestApi & { accepted_at?: string }> {
  const appId = options?.appId ?? TECTONA_APP_ID
  const res = await apiFetch(
    withAppId(`/v1/workspaces/${encodeURIComponent(workspaceId)}/voice/record-acceptances`, appId),
    {
      method: 'POST',
      headers: tectonaServiceHeaders(),
      body: JSON.stringify({
        from_user_id: fromUserId,
        ...(options?.noteHint?.trim() ? { note_hint: options.noteHint.trim() } : {}),
      }),
    },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(extractCollaborationApiError(err, res.statusText || 'accept voice record failed'))
  }
  return res.json()
}

/** Requester polls acceptances (WS fallback for Joined). */
export async function listRemoteVoiceRecordAcceptances(
  workspaceId: string,
  appId: string = TECTONA_APP_ID,
): Promise<Array<VoiceRecordRequestApi & { accepted_at?: string }>> {
  const res = await apiFetch(
    withAppId(`/v1/workspaces/${encodeURIComponent(workspaceId)}/voice/record-acceptances`, appId),
    { headers: tectonaServiceHeaders() },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(extractCollaborationApiError(err, res.statusText || 'list voice acceptances failed'))
  }
  const body = (await res.json()) as { items?: Array<VoiceRecordRequestApi & { accepted_at?: string }> }
  return body.items ?? []
}

export async function sendChannelMessage(
  channelId: string,
  body: string,
  options?: { clientMessageId?: string; mentionedUserIds?: string[]; appId?: string },
): Promise<CollaborationMessageApi> {
  const appId = options?.appId ?? TECTONA_APP_ID
  const res = await apiFetch(withAppId(`/v1/channels/${encodeURIComponent(channelId)}/messages`, appId), {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({
      body,
      client_message_id: options?.clientMessageId,
      mentioned_user_ids: options?.mentionedUserIds ?? [],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } })?.error?.message ?? res.statusText)
  }
  return res.json()
}
