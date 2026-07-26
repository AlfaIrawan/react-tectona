/**
 * Chat contact directory — identity-lite users + Tectona Assistant.
 */

import { getSession } from '@/auth/authService'
import { fetchIdentityUsers, type IdentityUserDto } from '@/lib/api/identityAdminApi'
import {
  listWorkspacePresence,
  type CollaborationPresenceApi,
  TECTONA_CHAT_WORKSPACE_ID,
  upsertMyWorkspacePresence,
  upsertWorkspacePresenceWithToken,
} from '@/lib/api/collaborationContextApi'
import { useCollaborationPresenceStore } from '@/stores/collaboration-presence-store'
import { useMyPresenceStore } from '@/stores/my-presence-store'

export type ChatMode = 'team' | 'genai' | 'group'

export interface ChatContact {
  id: string
  name: string
  subtitle?: string
  mode: ChatMode
  avatarSrc?: string
  initials: string
  avatarClassName?: string
  isAssistant?: boolean
  presence?: 'online' | 'away' | 'offline'
}

export const TECTONA_ASSISTANT_CONTACT: ChatContact = {
  id: 'tectona-assistant',
  name: 'Tectona Assistant',
  subtitle: 'Gen AI assistant · Ask about projects, delivery, and platform context',
  mode: 'genai',
  avatarSrc: '/images/logo.png',
  initials: 'TA',
  isAssistant: true,
  avatarClassName: 'bg-gradient-to-br from-violet-500/20 to-sky-500/20 ring-2 ring-violet-400/30',
  presence: 'online',
}

const AVATAR_GRADIENTS = [
  'bg-gradient-to-br from-emerald-500 to-teal-600 text-white',
  'bg-gradient-to-br from-amber-500 to-orange-600 text-white',
  'bg-gradient-to-br from-sky-500 to-indigo-600 text-white',
  'bg-gradient-to-br from-rose-500 to-pink-600 text-white',
  'bg-gradient-to-br from-violet-500 to-purple-600 text-white',
  'bg-gradient-to-br from-cyan-500 to-blue-600 text-white',
] as const

export function initialsFromDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

function avatarClassForUserId(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash + userId.charCodeAt(i)) % AVATAR_GRADIENTS.length
  }
  return AVATAR_GRADIENTS[hash] ?? AVATAR_GRADIENTS[0]
}

function isActiveIdentityUser(user: IdentityUserDto): boolean {
  const code = (user.status_code ?? '').toLowerCase()
  return code === '' || code === 'active'
}

export function mapIdentityUserToChatContact(user: IdentityUserDto): ChatContact {
  const subtitle = [user.job_title, user.organizational_unit].filter(Boolean).join(' · ') || user.email
  return {
    id: user.id,
    name: user.display_name?.trim() || user.email,
    subtitle,
    mode: 'team',
    initials: initialsFromDisplayName(user.display_name || user.email),
    avatarClassName: avatarClassForUserId(user.id),
  }
}

export function sessionUserToChatContact(session: NonNullable<ReturnType<typeof getSession>>): ChatContact {
  return {
    id: session.user.id,
    name: session.user.name,
    subtitle: 'You',
    mode: 'team',
    initials: initialsFromDisplayName(session.user.name),
    avatarClassName: 'bg-gradient-to-br from-slate-600 to-slate-800 text-white',
    presence: 'online',
  }
}

export function buildChatContactsFromIdentityUsers(users: IdentityUserDto[]): ChatContact[] {
  const session = getSession()
  const currentUserId = session?.user.id
  const byId = new Map<string, ChatContact>()

  byId.set(TECTONA_ASSISTANT_CONTACT.id, TECTONA_ASSISTANT_CONTACT)

  if (session) {
    byId.set(session.user.id, sessionUserToChatContact(session))
  }

  for (const user of users) {
    if (!isActiveIdentityUser(user)) continue
    if (currentUserId && user.id === currentUserId) {
      byId.set(user.id, sessionUserToChatContact(session!))
      continue
    }
    byId.set(user.id, mapIdentityUserToChatContact(user))
  }

  const teamUsers = [...byId.values()].filter((c) => c.mode === 'team' && !c.isAssistant)
  teamUsers.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  return [TECTONA_ASSISTANT_CONTACT, ...teamUsers]
}

function mapPresenceStatus(code: string): ChatContact['presence'] | undefined {
  if (code === 'online' || code === 'away') return code
  return undefined
}

/** Stale presence rows are treated as offline (align with server list_presence TTL). */
const PRESENCE_ONLINE_TTL_MS = 90 * 1000

/** Fallback REST poll when WebSocket is disconnected. */
export const CHAT_PRESENCE_FALLBACK_POLL_MS = 15_000

function isPresenceRowFresh(lastSeenAt: string | undefined): boolean {
  if (!lastSeenAt) return false
  const ms = Date.parse(lastSeenAt)
  if (!Number.isFinite(ms)) return false
  return Date.now() - ms <= PRESENCE_ONLINE_TTL_MS
}

export async function publishMyCollaborationPresence(
  workspaceId: string = TECTONA_CHAT_WORKSPACE_ID,
  status?: 'online' | 'away' | 'offline',
): Promise<void> {
  if (!getCurrentChatActorId()) return
  const resolved =
    status
    ?? (useMyPresenceStore.getState().status === 'away' ? 'away' : 'online')
  if (resolved === 'offline') return
  await upsertMyWorkspacePresence(workspaceId, resolved)
}

/** Publish presence using an explicit token (login/logout before session storage changes). */
export async function publishCollaborationPresenceWithToken(
  token: string,
  status: 'online' | 'away' | 'offline',
  workspaceId: string = TECTONA_CHAT_WORKSPACE_ID,
): Promise<void> {
  await upsertWorkspacePresenceWithToken(token, workspaceId, status)
}

/** Strip REST-embedded presence so realtime store is the single source of truth for others. */
export function stripTeamPresenceFromContacts(contacts: ChatContact[]): ChatContact[] {
  return contacts.map((contact) => {
    if (contact.mode !== 'team' || contact.isAssistant || contact.subtitle === 'You') {
      return contact
    }
    if (!contact.presence) return contact
    const { presence: _removed, ...rest } = contact
    return rest as ChatContact
  })
}

export function mergeRealtimePresenceStore(
  contacts: ChatContact[],
  byUserId: Record<string, CollaborationPresenceApi>,
): ChatContact[] {
  const base = stripTeamPresenceFromContacts(contacts)
  if (Object.keys(byUserId).length === 0) return base
  return base.map((contact) => {
    const row = byUserId[contact.id]
    if (!row) return contact
    if (row.status === 'offline' || !isPresenceRowFresh(row.last_seen_at)) {
      const { presence: _removed, ...rest } = contact
      return rest as ChatContact
    }
    const presence = mapPresenceStatus(row.status)
    if (!presence) {
      const { presence: _removed, ...rest } = contact
      return rest as ChatContact
    }
    return { ...contact, presence }
  })
}

async function mergePresenceIntoContacts(
  contacts: ChatContact[],
  workspaceId: string,
): Promise<ChatContact[]> {
  const teamIds = contacts.filter((c) => c.mode === 'team' && !c.isAssistant).map((c) => c.id)
  if (teamIds.length === 0) return contacts

  // List all workspace presence rows (avoids huge query strings when directory is large).
  const presenceRows = await listWorkspacePresence(workspaceId)
  const teamIdSet = new Set(teamIds)
  const byUser = new Map(
    presenceRows
      .filter((row) => teamIdSet.has(row.user_id))
      .map((row) => [
        row.user_id,
        { status: row.status, fresh: isPresenceRowFresh(row.last_seen_at) },
      ] as const),
  )

  return contacts.map((contact) => {
    const row = byUser.get(contact.id)
    if (!row || !row.fresh) return contact
    const presence = mapPresenceStatus(row.status)
    return presence ? { ...contact, presence } : contact
  })
}

let cachedContactsById = new Map<string, ChatContact>()

function cacheChatContacts(contacts: ChatContact[]): void {
  cachedContactsById = new Map(contacts.map((c) => [c.id, c]))
}

/** Kontak People untuk DM — dari directory atau sintetis dari user id. */
export function buildTeamChatContactForUserId(userId: string, contacts: ChatContact[]): ChatContact {
  const found = contacts.find((c) => c.id === userId)
  if (found) return found
  const name = resolveChatContactName(userId)
  return {
    id: userId,
    name,
    mode: 'team',
    initials: initialsFromDisplayName(name),
    avatarClassName: avatarClassForUserId(userId),
  }
}

export function resolveChatContactName(userId: string): string {
  return cachedContactsById.get(userId)?.name ?? 'Team member'
}

export async function loadChatContactDirectory(
  workspaceId: string = TECTONA_CHAT_WORKSPACE_ID,
  options?: { publishSelf?: boolean },
): Promise<ChatContact[]> {
  if (options?.publishSelf !== false) {
    try {
      await publishMyCollaborationPresence(workspaceId)
    } catch {
      // collaboration-context may be down in dev
    }
  }

  const res = await fetchIdentityUsers({ limit: 300 })
  let contacts = buildChatContactsFromIdentityUsers(res.items ?? [])

  try {
    contacts = await mergePresenceIntoContacts(contacts, workspaceId)
  } catch {
    // presence is optional when collaboration-context is down
  }

  cacheChatContacts(contacts)
  return contacts
}

export async function refreshChatContactPresence(
  contacts: ChatContact[],
  workspaceId: string = TECTONA_CHAT_WORKSPACE_ID,
): Promise<ChatContact[]> {
  try {
    return await mergePresenceIntoContacts(contacts, workspaceId)
  } catch {
    return contacts
  }
}

/** Sync REST presence into the global store (fallback when WebSocket misses an offline event). */
export async function syncWorkspacePresenceStore(
  workspaceId: string = TECTONA_CHAT_WORKSPACE_ID,
): Promise<void> {
  const rows = await listWorkspacePresence(workspaceId)
  useCollaborationPresenceStore.getState().replaceFromApiRows(rows)
}


export function getCurrentChatActorId(): string {
  return getSession()?.user.id ?? ''
}

export function canPickContactForGroupChat(c: ChatContact, currentUserId: string): boolean {
  return c.mode === 'team' && !c.isAssistant && c.id !== currentUserId
}
