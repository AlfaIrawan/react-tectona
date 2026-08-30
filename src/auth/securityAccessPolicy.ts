import {
  type WacMembershipDto,
  wacRoleCodeToUiRole,
} from '@/lib/api/workspaceAccessControlApi'
import { type WorkspaceOrgWorkspaceDto } from '@/lib/api/workspaceOrgApi'
import { isOrganizationHomeWorkspace, isWorkspaceOwnedBySubject } from '@/lib/workspaceOwnershipVisibility'

function hasAdminMembership(
  memberships: WacMembershipDto[],
  workspaceIds: ReadonlySet<string>,
): boolean {
  return memberships.some(
    (membership) => workspaceIds.has(membership.workspace_id) && wacRoleCodeToUiRole(membership.role_code) === 'Admin',
  )
}

function ownedPersonalWorkspaceRoot(
  workspace: WorkspaceOrgWorkspaceDto,
  workspaces: ReadonlyArray<WorkspaceOrgWorkspaceDto>,
  subject: { id?: string; name?: string | null; email?: string | null },
): WorkspaceOrgWorkspaceDto | null {
  const byId = new Map(workspaces.map((item) => [item.id, item]))
  let current: WorkspaceOrgWorkspaceDto | undefined = workspace
  let rootPersonal: WorkspaceOrgWorkspaceDto | undefined

  while (current) {
    if (current.tenant_mode === 'personal') {
      rootPersonal = current
      break
    }
    const parentId = typeof current.metadata?.parent_workspace_id === 'string'
      ? current.metadata.parent_workspace_id.trim()
      : ''
    current = parentId ? byId.get(parentId) : undefined
  }

  if (!rootPersonal) return null
  return isWorkspaceOwnedBySubject(
      {
        id: rootPersonal.id,
        metadata: rootPersonal.metadata,
        createdBy: rootPersonal.created_by ?? null,
        tenantMode: rootPersonal.tenant_mode ?? null,
      },
      subject,
    )
    ? rootPersonal
    : null
}

export function resolveSecurityAccess(args: {
  isPlatformAdmin: boolean
  isOrganizationAdmin: boolean
  items: WacMembershipDto[]
  workspaces: WorkspaceOrgWorkspaceDto[]
  activeWorkspaceId: string | null
  tenantMode: string | null | undefined
  subject: { id?: string; name?: string | null; email?: string | null }
}): boolean {
  if (args.isPlatformAdmin) return true
  // AuthZ Organization Admin is org-scoped: org home and every descendant tenant.
  if (args.isOrganizationAdmin && args.tenantMode === 'organization') return true

  const activeWorkspace = args.workspaces.find((workspace) => workspace.id === args.activeWorkspaceId)
  const isNonOrganizationUser = args.tenantMode !== 'organization'
  const organizationWorkspaceIds = new Set(
    args.workspaces.filter((workspace) => isOrganizationHomeWorkspace(workspace)).map((workspace) => workspace.id),
  )
  const hasOrganizationHomeAdmin = hasAdminMembership(args.items, organizationWorkspaceIds)
  const personalRoot = activeWorkspace && !isOrganizationHomeWorkspace(activeWorkspace)
    ? ownedPersonalWorkspaceRoot(activeWorkspace, args.workspaces, args.subject)
    : null
  const personalScopeIds = new Set(
    [activeWorkspace?.id, personalRoot?.id].filter((id): id is string => Boolean(id)),
  )
  const hasPersonalAdminScope = Boolean(
    activeWorkspace
    && !isOrganizationHomeWorkspace(activeWorkspace)
    && personalRoot
    && hasAdminMembership(args.items, personalScopeIds),
  )
  return isNonOrganizationUser || hasOrganizationHomeAdmin || hasPersonalAdminScope
}
