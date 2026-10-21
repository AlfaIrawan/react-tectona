import { fetchIdentityUsers } from '@/lib/api/identityAdminApi'
import { getSession } from '@/auth/authService'
import { hasOrganizationAdminAccess, isPlatformAdminJwtRole } from '@/lib/auth/platformAccess'
import { fetchAllWorkspaceOrgWorkspaces } from '@/lib/api/workspaceOrgApi'
import {
  fetchWorkspaceMembers,
  fetchSubjectMemberships,
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
  const session = getSession()
  const [identityResponse, workspaces, ownMemberships] = await Promise.all([
    fetchIdentityUsers({ limit: 500, offset: 0 }),
    fetchAllWorkspaceOrgWorkspaces({ status: 'active' }),
    session
      ? fetchSubjectMemberships(TECTONA_WAC_APP_ID, session.user.id, { activeOnly: true })
      : Promise.resolve({ items: [], total: 0 }),
  ])

  const identityUsers = identityResponse.items ?? []
  const identityById = new Map(identityUsers.map((user) => [user.id, user]))
  const displayNameByUserId = buildIdentityDisplayNameMap(identityUsers)
  const workspaceNamesBySubjectId = new Map<string, Set<string>>()
  const ownWorkspaceIds = new Set(
    resolveActiveWorkspaceMembershipRows(ownMemberships.items).map((membership) => membership.workspace_id),
  )
  const roles = session?.user.roles ?? []
  const canReadAllWorkspaceMembers =
    isPlatformAdminJwtRole(roles)
    || roles.includes('admin')
    || roles.includes('workspace_access_control_read')
    || roles.includes('workspace_access_control_admin')
  const canReadOrganizationWorkspaceMembers = hasOrganizationAdminAccess(roles)
  const readableWorkspaces = workspaces.filter((workspace) =>
    canReadAllWorkspaceMembers
    || ownWorkspaceIds.has(workspace.id)
    || (canReadOrganizationWorkspaceMembers && workspace.tenant_mode === 'organization'),
  )

  await Promise.all(
    readableWorkspaces.map(async (workspace) => {
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
