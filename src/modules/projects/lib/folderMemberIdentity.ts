import { getSession } from '@/auth/authService'
import type { Folder } from '../store/folderStore'
import { isLegacyPlaceholderUserId } from './projectMemberIdentity'

const LEGACY_DUMMY_DISPLAY_NAMES = new Set([
  'Admin User',
  'Budi Santoso',
  'Siti Aminah',
  'Dewi Lestari',
])

function sessionFallbackName(userId: string): string | null {
  const session = getSession()?.user
  if (!session || session.id !== userId) return null
  return session.name?.trim() || session.email?.trim() || null
}

export function resolveFolderMemberDisplayName(
  userId: string,
  apiDisplayName: string | undefined,
  displayNameByUserId: Map<string, string>,
): string {
  const fromIdentity = displayNameByUserId.get(userId)
  if (fromIdentity) return fromIdentity

  const fromSession = sessionFallbackName(userId)
  if (fromSession) return fromSession

  const trimmedApi = apiDisplayName?.trim() ?? ''
  if (trimmedApi && !LEGACY_DUMMY_DISPLAY_NAMES.has(trimmedApi) && !trimmedApi.startsWith('User ')) {
    return trimmedApi
  }

  if (isLegacyPlaceholderUserId(userId)) return 'Unknown member'
  return userId ? `User ${userId.slice(0, 8)}` : 'Unknown'
}

export function enrichFolderWithIdentityNames(
  folder: Folder,
  displayNameByUserId: Map<string, string>,
): Folder {
  const members = folder.members?.map((member) => ({
    ...member,
    displayName: resolveFolderMemberDisplayName(member.userId, member.displayName, displayNameByUserId),
  }))

  return {
    ...folder,
    members,
  }
}
