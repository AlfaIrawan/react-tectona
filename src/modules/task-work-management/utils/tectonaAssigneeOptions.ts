import type { IdentityUserDto } from '@/lib/api/identityAdminApi'
import { normalizeUserDisplayName } from '@/lib/userDisplayName'
import type { WacMembershipDto } from '@/lib/api/workspaceAccessControlApi'

export function identityUserDisplayName(user: IdentityUserDto): string | null {
  const raw = user.display_name?.trim() || user.email?.trim() || null
  return raw ? normalizeUserDisplayName(raw) : null
}

function sortAssigneeNames(names: Iterable<string>): string[] {
  return Array.from(names).sort((left, right) => {
    if (left === 'Unassigned') return -1
    if (right === 'Unassigned') return 1
    return left.localeCompare(right)
  })
}

export function buildWorkspaceMemberAssigneeOptions(
  memberNames: string[],
  currentAssignee?: string | null,
): string[] {
  const names = new Set<string>(['Unassigned'])
  for (const name of memberNames) {
    const trimmed = name?.trim()
    if (trimmed) names.add(trimmed)
  }
  const current = currentAssignee?.trim()
  if (current && current !== 'Unassigned') names.add(current)
  return sortAssigneeNames(names)
}

export function resolveActiveWorkspaceMembershipRows(rows: WacMembershipDto[]): WacMembershipDto[] {
  const activeRows = rows.filter((row) => {
    const status = (row.membership_status ?? row.status_code ?? '').toLowerCase().trim()
    return status === '' || status === 'active'
  })
  return activeRows.length > 0 ? activeRows : rows
}

export function mapWorkspaceMembersToAssigneeNames(
  rows: WacMembershipDto[],
  identityUsers: IdentityUserDto[],
): string[] {
  const userBySubjectId = new Map(identityUsers.map((user) => [user.id, user]))
  const names = new Set<string>()

  for (const row of resolveActiveWorkspaceMembershipRows(rows)) {
    const user = userBySubjectId.get(row.subject_id)
    const name = user ? identityUserDisplayName(user) : null
    if (name) names.add(name)
  }

  return sortAssigneeNames(names)
}

export function mergeWorkspaceAssigneeDirectory(
  directory: Record<string, string[]>,
  extraNames: string[] = [],
): string[] {
  const names = new Set<string>(['Unassigned'])
  for (const memberNames of Object.values(directory)) {
    for (const name of memberNames) {
      if (name?.trim()) names.add(name.trim())
    }
  }
  for (const name of extraNames) {
    if (name?.trim()) names.add(name.trim())
  }
  return sortAssigneeNames(names)
}

export function registerWorkspaceAssigneeAliases(
  directory: Record<string, string[]>,
  workspaceName: string,
  workspaceKey: string,
  memberNames: string[],
): void {
  const label = workspaceName.trim() || workspaceKey.trim()
  if (!label) return
  directory[label] = memberNames
  const key = workspaceKey.trim()
  if (key && key !== label) directory[key] = memberNames
}
