import { useEffect, useMemo, useState } from 'react'
import { getSession } from '@/auth/authService'
import { useTenantContextOptional } from '@/auth/TenantContext'
import { hasPlatformAdminAccess } from '@/lib/auth/platformAccess'
import { isAllWorkspacesSelection } from '@/lib/tenantWorkspaceScope'
import {
  type WacMembershipDto,
  wacRoleCodeToUiRole,
} from '@/lib/api/workspaceAccessControlApi'
import {
  fetchSubjectMembershipsCached,
  peekCachedSubjectMemberships,
} from '@/lib/wacMembershipCache'
import { fetchAllWorkspaceOrgWorkspaces, type WorkspaceOrgWorkspaceDto } from '@/lib/api/workspaceOrgApi'
import { isOrganizationHomeWorkspace, isWorkspaceOwnedBySubject } from '@/lib/workspaceOwnershipVisibility'

export type ModuleId =
  | 'workspace'
  | 'project'
  | 'idea_backlog'
  | 'task_work'
  | 'planning'
  | 'workflow'
  | 'resource'
  | 'portfolio_governance'
  | 'enterprise_governance_model'
  | 'reporting'
  | 'document_knowledge'
  | 'integration_api'
  | 'security_access'
  | 'identity_lite'
  | 'ai_project'
  | 'ai_idea'
  | 'platform_settings'
  | 'traceability_monitoring'

export type ModuleAccessState = {
  loading: boolean
  isPlatformAdmin: boolean
  maxWorkspaceRole: 'Admin' | 'Manager' | 'Member' | 'Viewer' | 'None'
  canAccessSecurityAccess: boolean
  canAccess: (moduleId: ModuleId) => boolean
}

function sessionRoles(): string[] {
  const session = getSession()
  if (!session) return []
  if (session.user.roles?.length) return session.user.roles
  if (session.user.role === 'root') return ['tectona_root']
  if (session.user.role === 'admin') return ['tectona_admin']
  return []
}

function roleRank(role: ModuleAccessState['maxWorkspaceRole']): number {
  switch (role) {
    case 'Admin':
      return 4
    case 'Manager':
      return 3
    case 'Member':
      return 2
    case 'Viewer':
      return 1
    default:
      return 0
  }
}

function maxRoleInMemberships(
  items: WacMembershipDto[] | undefined,
  workspaceId: string | null | undefined,
): ModuleAccessState['maxWorkspaceRole'] {
  const scoped =
    workspaceId && !isAllWorkspacesSelection(workspaceId)
      ? items?.filter((membership) => membership.workspace_id === workspaceId)
      : items

  let max: ModuleAccessState['maxWorkspaceRole'] = 'None'
  for (const membership of scoped ?? []) {
    const role = wacRoleCodeToUiRole(membership.role_code)
    if (roleRank(role) > roleRank(max)) max = role
  }
  return max
}

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

/**
 * Module access policy (production-like default):
 * - Root/Administrator bypass everything (platform admin).
 * - All other modules require at least one active WAC membership (AppAccessGate already enforces this).
 * - End-user GA launcher always includes Workspace + Document (see END_USER_GA_MODULE_IDS).
 * - Workspace module stays available in multi-select scope; WM page aggregates selected workspaces.
 * - Security & Access Control is available to standalone users, organization admins,
 *   and creator/admin users within their personal workspace tree.
 * - GA-pending modules hidden via tenantUiProfile.
 */
export function useModuleAccess(): ModuleAccessState {
  const session = getSession()
  const subjectId = session?.user.id
  const tenant = useTenantContextOptional()

  const isPlatformAdmin = useMemo(
    () => hasPlatformAdminAccess(sessionRoles(), session?.user.role),
    [session?.user.id, session?.user.role],
  )

  const cachedMemberships = subjectId ? peekCachedSubjectMemberships(subjectId) : null

  const [loading, setLoading] = useState(
    !isPlatformAdmin && Boolean(subjectId),
  )
  const [maxWorkspaceRole, setMaxWorkspaceRole] = useState<ModuleAccessState['maxWorkspaceRole']>(() => {
    if (!cachedMemberships || !subjectId) return 'None'
    let role = maxRoleInMemberships(cachedMemberships.items, tenant?.workspaceId ?? null)
    if (role === 'None' && cachedMemberships.items.length > 0) {
      role = maxRoleInMemberships(cachedMemberships.items, null)
    }
    return role
  })
  const [canAccessSecurityAccess, setCanAccessSecurityAccess] = useState(isPlatformAdmin)

  const activeWorkspaceId = tenant?.workspaceId ?? null

  useEffect(() => {
    if (isPlatformAdmin || !subjectId) {
      setLoading(false)
      setMaxWorkspaceRole('None')
      setCanAccessSecurityAccess(isPlatformAdmin)
      return
    }
    let cancelled = false
    setLoading(true)
    void Promise.all([
      fetchSubjectMembershipsCached(subjectId, { activeOnly: true }),
      fetchAllWorkspaceOrgWorkspaces().catch(() => [] as WorkspaceOrgWorkspaceDto[]),
    ])
      .then(([res, workspaces]) => {
        if (cancelled) return
        const items = res.items ?? []
        let role = maxRoleInMemberships(items, activeWorkspaceId)
        if (role === 'None' && items.length > 0) {
          role = maxRoleInMemberships(items, null)
        }
        setMaxWorkspaceRole(role)
        const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId)
        const isNonOrganizationUser = tenant?.tenantMode !== 'organization'
        const organizationWorkspaceIds = new Set(
          workspaces.filter((workspace) => isOrganizationHomeWorkspace(workspace)).map((workspace) => workspace.id),
        )
        const hasOrganizationAdmin = hasAdminMembership(items, organizationWorkspaceIds)
        const personalRoot = activeWorkspace && !isOrganizationHomeWorkspace(activeWorkspace)
          ? ownedPersonalWorkspaceRoot(activeWorkspace, workspaces, {
              id: subjectId,
              name: session?.user.name,
              email: session?.user.email,
            })
          : null
        const personalScopeIds = new Set(
          [activeWorkspace?.id, personalRoot?.id].filter((id): id is string => Boolean(id)),
        )
        const hasPersonalAdminScope = Boolean(
          activeWorkspace
          && !isOrganizationHomeWorkspace(activeWorkspace)
          && personalRoot
          && hasAdminMembership(items, personalScopeIds),
        )
        setCanAccessSecurityAccess(isNonOrganizationUser || hasOrganizationAdmin || hasPersonalAdminScope)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setMaxWorkspaceRole('None')
        setCanAccessSecurityAccess(false)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    isPlatformAdmin,
    subjectId,
    activeWorkspaceId,
    tenant?.tenantMode,
    session?.user.name,
    session?.user.email,
  ])

  const canAccess = useMemo(() => {
    return (moduleId: ModuleId) => {
      if (isPlatformAdmin) return true
      if (moduleId === 'security_access' || moduleId === 'identity_lite') return canAccessSecurityAccess
      if (moduleId === 'platform_settings') return false

      if (moduleId === 'workspace' && tenant?.uiProfile.hideWorkspaceModule) return false

      if (tenant?.uiProfile.hiddenModuleIds.includes(moduleId)) return false

      if (moduleId === 'workspace') {
        // End-user GA menu always includes Workspace (personal + multi-select aggregated view).
        return true
      }

      if (moduleId === 'document_knowledge') {
        // End-user GA menu always includes Document & Knowledge.
        return true
      }

      return true
    }
  }, [
    isPlatformAdmin,
    canAccessSecurityAccess,
    tenant?.workspaceId,
    tenant?.uiProfile.hideWorkspaceModule,
    tenant?.uiProfile.hiddenModuleIds,
  ])

  return {
    loading,
    isPlatformAdmin,
    maxWorkspaceRole,
    canAccessSecurityAccess,
    canAccess,
  }
}
