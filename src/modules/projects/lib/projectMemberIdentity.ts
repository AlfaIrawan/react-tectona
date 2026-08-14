import { getSession } from '@/auth/authService'
import { fetchIdentityUsers } from '@/lib/api/identityAdminApi'
import { normalizeUserDisplayName } from '@/lib/userDisplayName'
import { identityUserDisplayName } from '@/modules/task-work-management/utils/tectonaAssigneeOptions'
import type { Project } from '../store/projectStore'

/** Legacy demo names from removed backend dummy directory — always prefer Identity. */
const LEGACY_DUMMY_DISPLAY_NAMES = new Set([
  'Admin User',
  'Budi Santoso',
  'Siti Aminah',
  'Dewi Lestari',
])

/** Dev seed placeholder UUIDs (00000000-0000-0000-0000-00000000000x). */
const LEGACY_PLACEHOLDER_USER_ID_PATTERN = /^00000000-0000-0000-0000-00000000000/i

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuidLike(value: string | null | undefined): boolean {
  return UUID_PATTERN.test((value ?? '').trim())
}

export function isLegacyPlaceholderUserId(userId: string): boolean {
  return LEGACY_PLACEHOLDER_USER_ID_PATTERN.test(userId.trim())
}

export function stripLegacyDemoMembers(project: Project): Project {
  if (!project.members?.length) return project
  const ownerId = project.ownerId
  return {
    ...project,
    members: project.members.filter((member) => {
      if (!isLegacyPlaceholderUserId(member.userId)) return true
      return member.userId === ownerId && member.roleCode === 'owner'
    }),
  }
}

export function buildIdentityDisplayNameMap(
  users: { id: string; email: string; display_name: string }[],
): Map<string, string> {
  const map = new Map<string, string>()
  for (const user of users) {
    const name = normalizeUserDisplayName(identityUserDisplayName(user) ?? user.email)
    map.set(user.id, name)
    const email = user.email?.trim().toLowerCase()
    if (email) map.set(email, name)
  }
  return map
}

export async function fetchIdentityDisplayNameMap(): Promise<Map<string, string>> {
  try {
    const response = await fetchIdentityUsers({ limit: 500, offset: 0 })
    return buildIdentityDisplayNameMap(response.items ?? [])
  } catch {
    return new Map()
  }
}

function sessionFallbackName(userId: string): string | null {
  const session = getSession()?.user
  if (!session || session.id !== userId) return null
  return session.name?.trim() || session.email?.trim() || null
}

export function resolveMemberDisplayName(
  userId: string,
  apiDisplayName: string | undefined,
  displayNameByUserId: Map<string, string>,
): string {
  const fromIdentity = displayNameByUserId.get(userId)
  if (fromIdentity) return fromIdentity

  const fromSession = sessionFallbackName(userId)
  if (fromSession) return normalizeUserDisplayName(fromSession)

  const trimmedApi = apiDisplayName?.trim() ?? ''
  if (trimmedApi && !LEGACY_DUMMY_DISPLAY_NAMES.has(trimmedApi) && !trimmedApi.startsWith('User ')) {
    return normalizeUserDisplayName(trimmedApi)
  }

  if (isLegacyPlaceholderUserId(userId)) return 'Unknown member'
  return userId ? `User ${userId.slice(0, 8)}` : 'Unknown'
}

/** Resolve folder/document owner refs (user id, email, or legacy username) for UI display. */
export function resolveActorDisplayName(
  actorRef: string | null | undefined,
  displayNameByUserId: Map<string, string>,
): string {
  const raw = actorRef?.trim() ?? ''
  if (!raw) return 'Unknown'
  if (raw.toLowerCase() === 'system') return 'System'

  if (!isUuidLike(raw)) {
    const byEmail = displayNameByUserId.get(raw.toLowerCase())
    if (byEmail) return byEmail
    return normalizeUserDisplayName(raw)
  }

  return resolveMemberDisplayName(raw, undefined, displayNameByUserId)
}

export function enrichProjectWithIdentityNames(
  project: Project,
  displayNameByUserId: Map<string, string>,
): Project {
  const normalized = stripLegacyDemoMembers(project)
  const ownerId = normalized.ownerId
  const ownerName = ownerId
    ? resolveMemberDisplayName(ownerId, normalized.ownerName, displayNameByUserId)
    : normalized.ownerName

  const members = normalized.members?.map((member) => ({
    ...member,
    displayName: resolveMemberDisplayName(member.userId, member.displayName, displayNameByUserId),
  }))

  return {
    ...normalized,
    ownerName,
    members,
  }
}
