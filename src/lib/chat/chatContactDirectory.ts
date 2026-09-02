/**
 * Chat contact directory — workspace-scoped members enriched via identity-lite + Tectona Assistant.
 * Membership SoR: workspace-access-control (not the full identity directory).
 */

import { getSession } from '@/auth/authService'
import { fetchIdentityUser, fetchIdentityUsers, type IdentityUserDto } from '@/lib/api/identityAdminApi'
import {
  listWorkspacePresence,
  type CollaborationPresenceApi,
  TECTONA_CHAT_WORKSPACE_ID,
  upsertMyWorkspacePresence,
  upsertWorkspacePresenceWithToken,
} from '@/lib/api/collaborationContextApi'
import {
  fetchSubjectMemberships,
  fetchWorkspaceMembers,
  TECTONA_WAC_APP_ID,
  type WacMembershipDto,
} from '@/lib/api/workspaceAccessControlApi'
import { fetchAllWorkspaceOrgWorkspaces } from '@/lib/api/workspaceOrgApi'
import { readAccessibleWorkspaceIds } from '@/lib/corporateWorkspaceAccess'
import {
  buildWorkspaceScopeFromTenant,
  readStoredTenantSelection,
} from '@/lib/tenantWorkspaceScope'
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

export function resolveActiveWorkspaceMembershipRows(rows: WacMembershipDto[]): WacMembershipDto[] {
  const activeRows = rows.filter((row) => {
    const status = (row.membership_status ?? row.status_code ?? '').toLowerCase().trim()
    return status === '' || status === 'active'
  })
  return activeRows.length > 0 ? activeRows : rows
}

/** Membership workspace IDs for the signed-in subject (chat directory never lists catalog-wide). */
async function fetchActiveMembershipWorkspaceIds(userId: string): Promise<string[]> {
  const res = await fetchSubjectMemberships(TECTONA_WAC_APP_ID, userId, { activeOnly: true }).catch(
    () => ({ items: [] as WacMembershipDto[] }),
  )
  return [
    ...new Set(
      (res.items ?? [])
        .map((row) => row.workspace_id)
        .filter((workspaceId): workspaceId is string => Boolean(workspaceId?.trim())),
    ),
  ]
}

/** Workspaces whose members may appear in New chat (membership, switcher, or org directory). */
export function pickChatDirectoryWorkspaceIds(input: {
  scope: ReturnType<typeof buildWorkspaceScopeFromTenant>
  membershipWorkspaceIds: string[]
  orgWorkspaceIds?: string[] | null
  accessibleWorkspaceIds?: string[] | null
}): string[] {
  const membership = new Set(input.membershipWorkspaceIds.filter(Boolean))
  const accessible = (input.accessibleWorkspaceIds ?? []).filter(Boolean)
  let workspaceIds: string[] = []

  if (input.scope.mode === 'single') {
    workspaceIds = [input.scope.workspaceId]
  } else {
    const selected = (input.scope.mode === 'all' ? input.scope.workspaceIds : undefined)?.filter(Boolean)
    if (selected?.length) {
      const inMembership = selected.filter((id) => membership.has(id))
      workspaceIds = inMembership.length > 0 ? inMembership : selected
    } else {
      workspaceIds = [...new Set([...membership, ...accessible])]
    }
  }

  const orgIds = input.orgWorkspaceIds?.filter(Boolean) ?? []
  if (orgIds.length > 0 && workspaceIds.length > 0) {
    const orgSet = new Set(orgIds)
    const scoped = workspaceIds.filter((id) => orgSet.has(id))
    if (scoped.length > 0) workspaceIds = scoped
  }

  if (workspaceIds.length === 0 && accessible.length > 0) {
    workspaceIds = [...new Set(accessible)]
  }
  if (workspaceIds.length === 0 && orgIds.length > 0) {
    workspaceIds = [...orgIds]
  }

  return workspaceIds
}

/** Workspace IDs whose WAC members may appear in New chat / group pickers. */
export async function resolveChatDirectoryWorkspaceIds(): Promise<string[]> {
  const session = getSession()
  if (!session?.user.id) return []

  const tenant = readStoredTenantSelection()
  const scope = buildWorkspaceScopeFromTenant(tenant)
  const membershipWorkspaceIds = await fetchActiveMembershipWorkspaceIds(session.user.id)

  let orgWorkspaceIds: string[] | null = null
  if (tenant?.orgId) {
    const workspaces = await fetchAllWorkspaceOrgWorkspaces().catch(() => [])
    orgWorkspaceIds = workspaces
      .filter((workspace) => workspace.organization_id === tenant.orgId)
      .map((workspace) => workspace.id)
  }

  return pickChatDirectoryWorkspaceIds({
    scope,
    membershipWorkspaceIds,
    orgWorkspaceIds,
    accessibleWorkspaceIds: readAccessibleWorkspaceIds(),
  })
}

export async function collectChatDirectorySubjectIds(workspaceIds: string[]): Promise<Set<string>> {
  const subjectIds = new Set<string>()
  const session = getSession()
  if (session?.user.id) subjectIds.add(session.user.id)
  if (workspaceIds.length === 0) return subjectIds

  const settled = await Promise.allSettled(
    workspaceIds.map((workspaceId) => fetchWorkspaceMembers(TECTONA_WAC_APP_ID, workspaceId)),
  )

  for (const result of settled) {
    if (result.status !== 'fulfilled') continue
    for (const row of resolveActiveWorkspaceMembershipRows(result.value.items ?? [])) {
      if (row.subject_id?.trim()) subjectIds.add(row.subject_id.trim())
    }
  }

  return subjectIds
}

const IDENTITY_ENRICH_BATCH = 40

async function loadIdentityUsersForSubjects(subjectIds: ReadonlySet<string>): Promise<IdentityUserDto[]> {
  if (subjectIds.size === 0) return []

  const listed = await fetchIdentityUsers({ limit: 500 }).catch(() => ({ items: [] as IdentityUserDto[] }))
  const byId = new Map((listed.items ?? []).map((user) => [user.id, user]))

  const missing = [...subjectIds].filter((id) => !byId.has(id))
  const toFetch = missing.slice(0, IDENTITY_ENRICH_BATCH)
  if (toFetch.length > 0) {
    const extras = await Promise.all(toFetch.map((id) => fetchIdentityUser(id).catch(() => null)))
    for (const user of extras) {
      if (user) byId.set(user.id, user)
    }
  }

  return [...byId.values()]
}

export function buildChatContactsFromWorkspaceMembers(
  allowedSubjectIds: ReadonlySet<string>,
  identityUsers: IdentityUserDto[],
): ChatContact[] {
  const identityById = new Map(identityUsers.map((user) => [user.id, user]))
  const enrichedUsers: IdentityUserDto[] = []
  for (const subjectId of allowedSubjectIds) {
    const user = identityById.get(subjectId)
    if (user && isActiveIdentityUser(user)) enrichedUsers.push(user)
  }

  const contacts = buildChatContactsFromIdentityUsers(enrichedUsers)
  const presentIds = new Set(contacts.map((contact) => contact.id))
  const session = getSession()
  const extras: ChatContact[] = []

  for (const subjectId of allowedSubjectIds) {
    if (presentIds.has(subjectId)) continue
    if (session?.user.id === subjectId) continue
    extras.push({
      id: subjectId,
      name: `Member ${subjectId.slice(0, 8)}`,
      mode: 'team',
      initials: initialsFromDisplayName(subjectId),
      avatarClassName: avatarClassForUserId(subjectId),
    })
  }

  if (extras.length === 0) return contacts

  const teamUsers = [
    ...contacts.filter((contact) => contact.mode === 'team' && !contact.isAssistant),
    ...extras,
  ].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  return [TECTONA_ASSISTANT_CONTACT, ...teamUsers]
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PLACEHOLDER_CHAT_NAME = 'Team member'

function cacheChatContacts(contacts: ChatContact[]): void {
  cachedContactsById = new Map(contacts.map((contact) => [contact.id, contact]))
}

export function isPlaceholderChatContactName(name: string | null | undefined): boolean {
  const trimmed = name?.trim() ?? ''
  if (!trimmed) return true
  if (trimmed === PLACEHOLDER_CHAT_NAME) return true
  if (/^Member [0-9a-f]{8}$/i.test(trimmed)) return true
  if (UUID_RE.test(trimmed)) return true
  return false
}

function rememberChatContact(contact: ChatContact): void {
  const current = cachedContactsById.get(contact.id)
  if (current && !isPlaceholderChatContactName(current.name) && isPlaceholderChatContactName(contact.name)) {
    return
  }
  cachedContactsById.set(contact.id, contact)
}

export function mergeChatContactLists(base: ChatContact[], extra: ChatContact[]): ChatContact[] {
  const byId = new Map<string, ChatContact>()
  for (const contact of [...base, ...extra]) {
    const prev = byId.get(contact.id)
    if (!prev || isPlaceholderChatContactName(prev.name)) {
      byId.set(contact.id, contact)
    }
    rememberChatContact(byId.get(contact.id)!)
  }
  const teamUsers = [...byId.values()]
    .filter((contact) => contact.mode === 'team' && !contact.isAssistant)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  return [TECTONA_ASSISTANT_CONTACT, ...teamUsers]
}

/** Resolve DM/group peers that are not in the WAC directory via identity-lite. */
export async function hydrateChatContactsForUserIds(userIds: string[]): Promise<ChatContact[]> {
  const unique = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))]
  const missing = unique.filter((id) => {
    const existing = cachedContactsById.get(id)
    return !existing || isPlaceholderChatContactName(existing.name) || existing.name.toLowerCase() === id.toLowerCase()
  })
  if (missing.length === 0) return []

  const fetched = await Promise.all(missing.map((id) => fetchIdentityUser(id).catch(() => null)))
  const added: ChatContact[] = []
  for (const user of fetched) {
    if (!user) continue
    const contact = mapIdentityUserToChatContact(user)
    rememberChatContact(contact)
    added.push(contact)
  }
  return added
}

/** People contact for DM — from the directory or synthesized from a user id. */
export function buildTeamChatContactForUserId(userId: string, contacts: ChatContact[]): ChatContact {
  const found = contacts.find((c) => c.id === userId)
  const cached = cachedContactsById.get(userId)
  const named = [found, cached].find((contact) => contact && !isPlaceholderChatContactName(contact.name))
  if (named) return named
  const name = resolveChatContactName(userId)
  return {
    id: userId,
    name,
    mode: 'team',
    initials: initialsFromDisplayName(name),
    avatarClassName: avatarClassForUserId(userId),
    ...(cached?.avatarSrc ? { avatarSrc: cached.avatarSrc } : {}),
  }
}

export function resolveChatContactName(userId: string): string {
  const name = cachedContactsById.get(userId)?.name?.trim()
  if (name && name.toLowerCase() !== userId.toLowerCase() && !isPlaceholderChatContactName(name)) {
    return name
  }
  return PLACEHOLDER_CHAT_NAME
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

  const workspaceIds = await resolveChatDirectoryWorkspaceIds()
  const allowedSubjectIds = await collectChatDirectorySubjectIds(workspaceIds)
  const identityUsers = await loadIdentityUsersForSubjects(allowedSubjectIds)
  let contacts = buildChatContactsFromWorkspaceMembers(allowedSubjectIds, identityUsers)

  try {
    contacts = await mergePresenceIntoContacts(contacts, workspaceId)
  } catch {
    // presence is optional when collaboration-context is down
  }

  const merged = mergeChatContactLists([...cachedContactsById.values()], contacts)
  cacheChatContacts(merged)
  return merged
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
