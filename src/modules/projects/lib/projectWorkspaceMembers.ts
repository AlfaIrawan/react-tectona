import { fetchIdentityUsers } from '@/lib/api/identityAdminApi'
import { fetchAllWorkspaceOrgWorkspaces } from '@/lib/api/workspaceOrgApi'
import {
  fetchWorkspaceMembers,
  TECTONA_WAC_APP_ID,
  type WacMembershipDto,
} from '@/lib/api/workspaceAccessControlApi'
import {
  identityUserDisplayName,
  resolveActiveWorkspaceMembershipRows,
} from '@/modules/task-work-management/utils/tectonaAssigneeOptions'
import { buildIdentityDisplayNameMap } from './projectMemberIdentity'

export type ProjectWorkspaceDirectoryUser = {
  id: string
  name: string
  email: string
  subtitle: string
  workspaceNames: string[]
}

function collectWorkspaceMemberRows(
  rows: WacMembershipDto[],
  workspaceName: string,
  bySubjectId: Map<string, Set<string>>,
): void {
  for (const row of resolveActiveWorkspaceMembershipRows(rows)) {
    const workspaces = bySubjectId.get(row.subject_id) ?? new Set<string>()
    workspaces.add(workspaceName)
    bySubjectId.set(row.subject_id, workspaces)
  }
}

export async function fetchProjectWorkspaceDirectoryUsers(): Promise<{
  users: ProjectWorkspaceDirectoryUser[]
  displayNameByUserId: Map<string, string>
}> {
  const [identityResponse, workspaces] = await Promise.all([
    fetchIdentityUsers({ limit: 500, offset: 0 }),
    fetchAllWorkspaceOrgWorkspaces({ status: 'active' }),
  ])

  const identityUsers = identityResponse.items ?? []
  const identityById = new Map(identityUsers.map((user) => [user.id, user]))
  const displayNameByUserId = buildIdentityDisplayNameMap(identityUsers)
  const workspaceNamesBySubjectId = new Map<string, Set<string>>()

  await Promise.all(
    workspaces.map(async (workspace) => {
      try {
        const response = await fetchWorkspaceMembers(TECTONA_WAC_APP_ID, workspace.id)
        collectWorkspaceMemberRows(response.items, workspace.name, workspaceNamesBySubjectId)
      } catch {
        // Workspace may not have WAC membership catalog yet — skip silently.
      }
    }),
  )

  const users: ProjectWorkspaceDirectoryUser[] = []
  for (const [subjectId, workspaceNames] of workspaceNamesBySubjectId) {
    const identityUser = identityById.get(subjectId)
    const name = identityUser ? identityUserDisplayName(identityUser) : null
    if (!name) continue

    const sortedWorkspaceNames = Array.from(workspaceNames).sort((left, right) => left.localeCompare(right))
    users.push({
      id: subjectId,
      name,
      email: identityUser?.email ?? '',
      subtitle: sortedWorkspaceNames.join(' · '),
      workspaceNames: sortedWorkspaceNames,
    })
  }

  users.sort((left, right) => left.name.localeCompare(right.name))

  return { users, displayNameByUserId }
}
