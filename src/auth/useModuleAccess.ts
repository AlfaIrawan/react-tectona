import { useEffect, useMemo, useState } from 'react'
import { getSession } from '@/auth/authService'
import { useTenantContextOptional } from '@/auth/TenantContext'
import { hasOrganizationAdminAccess, hasPlatformAdminAccess } from '@/lib/auth/platformAccess'
import { isAllWorkspacesSelection } from '@/lib/tenantWorkspaceScope'
import {
  type WacMembershipDto,
  wacRoleCodeToUiRole,
} from '@/lib/api/workspaceAccessControlApi'
import {
  fetchSubjectMembershipsCached,
  peekCachedSubjectMemberships,
} from '@/lib/wacMembershipCache'
import {
  fetchAllWorkspaceOrgWorkspacesCached,
  peekCachedWorkspaceOrgDirectory,
} from '@/lib/workspaceOrgDirectoryCache'
import {
  peekModuleAccessSnapshot,
  writeModuleAccessSnapshot,
} from '@/lib/moduleAccessSnapshot'
import { type WorkspaceOrgWorkspaceDto } from '@/lib/api/workspaceOrgApi'
import { resolveSecurityAccess } from '@/auth/securityAccessPolicy'

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

function resolveRoleFromMemberships(
  items: WacMembershipDto[] | undefined,
  workspaceId: string | null | undefined,
): ModuleAccessState['maxWorkspaceRole'] {
  let role = maxRoleInMemberships(items, workspaceId)
  if (role === 'None' && (items?.length ?? 0) > 0) {
    role = maxRoleInMemberships(items, null)
  }
  return role
}

/**
 * Module access policy (production-like default):
 * - Root/Administrator bypass everything (platform admin).
 * - All other modules require at least one active WAC membership (AppAccessGate already enforces this).
 * - End-user GA launcher always includes Workspace + Document (see END_USER_GA_MODULE_IDS).
 * - Workspace module stays available in multi-select scope; WM page aggregates selected workspaces.
 * - Security & Access Control is available to standalone users, JWT Organization Admins
 *   in an organization tenant (org home and descendants), WAC Admin on org home,
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
  const isOrganizationAdmin = useMemo(
    () => hasOrganizationAdminAccess(sessionRoles()),
    [session?.user.id, session?.user.roles],
  )

  const cachedMemberships = subjectId
    ? peekCachedSubjectMemberships(subjectId, { allowStale: true })
    : null
  const cachedWorkspaces = peekCachedWorkspaceOrgDirectory({ allowStale: true })
  const snapshot = subjectId ? peekModuleAccessSnapshot(subjectId) : null
  const hasWarmAccess = Boolean(cachedMemberships || snapshot)

  const [loading, setLoading] = useState(
    !isPlatformAdmin && Boolean(subjectId) && !hasWarmAccess,
  )
  const [maxWorkspaceRole, setMaxWorkspaceRole] = useState<ModuleAccessState['maxWorkspaceRole']>(() => {
    if (cachedMemberships && subjectId) {
      return resolveRoleFromMemberships(cachedMemberships.items, tenant?.workspaceId ?? null)
    }
    if (snapshot) return snapshot.maxWorkspaceRole
    return 'None'
  })
  const [canAccessSecurityAccess, setCanAccessSecurityAccess] = useState(() => {
    if (isPlatformAdmin) return true
    if (cachedMemberships && cachedWorkspaces) {
      return resolveSecurityAccess({
        isPlatformAdmin: false,
        isOrganizationAdmin,
        items: cachedMemberships.items ?? [],
        workspaces: cachedWorkspaces,
        activeWorkspaceId: tenant?.workspaceId ?? null,
        tenantMode: tenant?.tenantMode,
        subject: { id: subjectId, name: session?.user.name, email: session?.user.email },
      })
    }
    if (snapshot) return snapshot.canAccessSecurityAccess
    return false
  })

  const activeWorkspaceId = tenant?.workspaceId ?? null

  useEffect(() => {
    if (isPlatformAdmin || !subjectId) {
      setLoading(false)
      setMaxWorkspaceRole('None')
      setCanAccessSecurityAccess(isPlatformAdmin)
      return
    }

    const applyResolved = (
      items: WacMembershipDto[],
      workspaces: WorkspaceOrgWorkspaceDto[],
    ) => {
      const role = resolveRoleFromMemberships(items, activeWorkspaceId)
      const securityAccess = resolveSecurityAccess({
        isPlatformAdmin: false,
        isOrganizationAdmin,
        items,
        workspaces,
        activeWorkspaceId,
        tenantMode: tenant?.tenantMode,
        subject: {
          id: subjectId,
          name: session?.user.name,
          email: session?.user.email,
        },
      })
      setMaxWorkspaceRole(role)
      setCanAccessSecurityAccess(securityAccess)
      writeModuleAccessSnapshot({
        subjectId,
        workspaceId: activeWorkspaceId,
        tenantMode: tenant?.tenantMode,
        maxWorkspaceRole: role,
        canAccessSecurityAccess: securityAccess,
      })
    }

    const warmMemberships = peekCachedSubjectMemberships(subjectId, { allowStale: true })
    const warmWorkspaces = peekCachedWorkspaceOrgDirectory({ allowStale: true }) ?? []
    if (warmMemberships) {
      applyResolved(warmMemberships.items ?? [], warmWorkspaces)
      setLoading(false)
    } else if (peekModuleAccessSnapshot(subjectId)) {
      setLoading(false)
    } else {
      setLoading(true)
    }

    let cancelled = false
    void Promise.all([
      fetchSubjectMembershipsCached(subjectId, { activeOnly: true }),
      fetchAllWorkspaceOrgWorkspacesCached().catch(
        () => peekCachedWorkspaceOrgDirectory({ allowStale: true }) ?? ([] as WorkspaceOrgWorkspaceDto[]),
      ),
    ])
      .then(([res, workspaces]) => {
        if (cancelled) return
        applyResolved(res.items ?? [], workspaces)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        if (!peekCachedSubjectMemberships(subjectId, { allowStale: true }) && !peekModuleAccessSnapshot(subjectId)) {
          setMaxWorkspaceRole('None')
          setCanAccessSecurityAccess(false)
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    isPlatformAdmin,
    isOrganizationAdmin,
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
