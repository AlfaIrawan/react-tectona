import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSession } from '@/auth/authService'
import { useTenantContextOptional } from '@/auth/TenantContext'
import { authorizeTectona } from '@/lib/api/authzApi'
import {
  fetchSubjectMemberships,
  TECTONA_WAC_APP_ID,
  type WacMembershipDto,
  wacRoleCodeToUiRole,
} from '@/lib/api/workspaceAccessControlApi'
import {
  TECTONA_AUTHZ_ACTIONS,
  TECTONA_AUTHZ_RESOURCES,
  type TectonaAuthzResource,
} from '@/lib/constants/tectonaAuthz'
import { hasPlatformAdminAccess } from '@/lib/auth/platformAccess'
import { isAllWorkspacesSelection } from '@/lib/tenantWorkspaceScope'

export type WorkspacePanelAuth = 'overview' | 'directory' | 'governance' | 'members' | 'assets' | 'activity'

export interface WorkspaceManagementAccess {
  canViewOverview: boolean
  canViewDirectory: boolean
  canViewGovernance: boolean
  canManageWorkspace: boolean
  canManageOrganization: boolean
  canManageGovernance: boolean
  isPlatformAdmin: boolean
  loading: boolean
  canAccessPanel: (panel: WorkspacePanelAuth) => boolean
  canMutate: boolean
}

type AccessFlags = Omit<
  WorkspaceManagementAccess,
  'loading' | 'isPlatformAdmin' | 'canAccessPanel' | 'canMutate'
>

type WacUiRole = 'Admin' | 'Manager' | 'Member' | 'Viewer' | 'None'

const FULL_ACCESS: AccessFlags = {
  canViewOverview: true,
  canViewDirectory: true,
  canViewGovernance: true,
  canManageWorkspace: true,
  canManageOrganization: true,
  canManageGovernance: true,
}

const NO_ACCESS: AccessFlags = {
  canViewOverview: false,
  canViewDirectory: false,
  canViewGovernance: false,
  canManageWorkspace: false,
  canManageOrganization: false,
  canManageGovernance: false,
}

function sessionRoles(): string[] {
  const session = getSession()
  if (!session) return []
  if (session.user.roles?.length) return session.user.roles
  if (session.user.role === 'root') return ['tectona_root']
  if (session.user.role === 'admin') return ['tectona_admin']
  return []
}

function roleRank(role: WacUiRole): number {
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
): WacUiRole {
  const scoped =
    workspaceId && !isAllWorkspacesSelection(workspaceId)
      ? items?.filter((membership) => membership.workspace_id === workspaceId)
      : items

  let max: WacUiRole = 'None'
  for (const membership of scoped ?? []) {
    const role = wacRoleCodeToUiRole(membership.role_code) as WacUiRole
    if (roleRank(role) > roleRank(max)) max = role
  }
  return max
}

/** Map WAC role on the active workspace → Workspace Management panel flags. */
function accessFromWacRole(role: WacUiRole): AccessFlags | null {
  if (roleRank(role) >= roleRank('Admin')) {
    return FULL_ACCESS
  }
  if (roleRank(role) >= roleRank('Manager')) {
    return {
      canViewOverview: true,
      canViewDirectory: true,
      canViewGovernance: true,
      canManageWorkspace: false,
      canManageOrganization: false,
      canManageGovernance: false,
    }
  }
  if (roleRank(role) >= roleRank('Member')) {
    return {
      canViewOverview: true,
      canViewDirectory: true,
      canViewGovernance: false,
      canManageWorkspace: false,
      canManageOrganization: false,
      canManageGovernance: false,
    }
  }
  if (role === 'Viewer') {
    return {
      canViewOverview: true,
      canViewDirectory: false,
      canViewGovernance: false,
      canManageWorkspace: false,
      canManageOrganization: false,
      canManageGovernance: false,
    }
  }
  return null
}

async function checkAllowed(
  sub: string,
  resourceType: TectonaAuthzResource,
  action: string,
  scope: string,
): Promise<boolean> {
  try {
    const result = await authorizeTectona(sub, resourceType, action, scope)
    return Boolean(result.allowed)
  } catch {
    return false
  }
}

function buildCanAccessPanel(
  access: AccessFlags,
  isPlatformAdmin: boolean,
): (panel: WorkspacePanelAuth) => boolean {
  return (panel) => {
    if (isPlatformAdmin) return true
    switch (panel) {
      case 'overview':
        return access.canViewOverview
      case 'directory':
        return access.canViewDirectory
      case 'governance':
        return access.canViewGovernance
      case 'members':
        return access.canViewDirectory
      case 'assets':
      case 'activity':
        return access.canManageWorkspace
      default:
        return false
    }
  }
}

/**
 * Resolves Tectona Workspace Management permissions.
 *
 * Priority:
 * 1. Platform admin (JWT) → full access
 * 2. WAC role on the active workspace (Admin/Owner → full panel access) — aligns with module gate
 * 3. Authorization-policy checks scoped to the active workspace (fallback)
 */
export function useWorkspaceManagementAuthorization(scopeOverride?: string): WorkspaceManagementAccess {
  const session = getSession()
  const sub = session?.user.id
  const jwtRoles = sessionRoles()
  const uiRole = session?.user.role
  const tenant = useTenantContextOptional()
  const activeWorkspaceId = tenant?.workspaceId ?? null
  const authzScope =
    scopeOverride
    ?? (activeWorkspaceId && !isAllWorkspacesSelection(activeWorkspaceId)
      ? activeWorkspaceId
      : 'global')

  const isPlatformAdmin = useMemo(
    () => hasPlatformAdminAccess(jwtRoles, uiRole),
    [jwtRoles, uiRole],
  )

  const [loading, setLoading] = useState(!isPlatformAdmin)
  const [access, setAccess] = useState<AccessFlags>(FULL_ACCESS)

  useEffect(() => {
    if (isPlatformAdmin) {
      setAccess(FULL_ACCESS)
      setLoading(false)
      return
    }
    if (!sub) {
      setAccess(NO_ACCESS)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void (async () => {
      // Prefer WAC membership on the active workspace (same source as useModuleAccess).
      try {
        const memberships = await fetchSubjectMemberships(TECTONA_WAC_APP_ID, sub, { activeOnly: true })
        if (cancelled) return
        const wacRole = maxRoleInMemberships(memberships.items, activeWorkspaceId)
        const fromWac = accessFromWacRole(wacRole)
        if (fromWac) {
          setAccess(fromWac)
          setLoading(false)
          return
        }
      } catch {
        // Fall through to authz policy.
      }

      const [
        workspaceView,
        workspaceManage,
        orgView,
        orgManage,
        govView,
        govManage,
      ] = await Promise.all([
        checkAllowed(sub, TECTONA_AUTHZ_RESOURCES.workspace, TECTONA_AUTHZ_ACTIONS.view, authzScope),
        checkAllowed(sub, TECTONA_AUTHZ_RESOURCES.workspace, TECTONA_AUTHZ_ACTIONS.manage, authzScope),
        checkAllowed(sub, TECTONA_AUTHZ_RESOURCES.organization, TECTONA_AUTHZ_ACTIONS.view, authzScope),
        checkAllowed(sub, TECTONA_AUTHZ_RESOURCES.organization, TECTONA_AUTHZ_ACTIONS.manage, authzScope),
        checkAllowed(sub, TECTONA_AUTHZ_RESOURCES.governance, TECTONA_AUTHZ_ACTIONS.view, authzScope),
        checkAllowed(sub, TECTONA_AUTHZ_RESOURCES.governance, TECTONA_AUTHZ_ACTIONS.manage, authzScope),
      ])
      if (cancelled) return
      const canViewDirectory = workspaceView || orgView
      setAccess({
        canViewOverview: workspaceView,
        canViewDirectory,
        canViewGovernance: govView,
        canManageWorkspace: workspaceManage,
        canManageOrganization: orgManage,
        canManageGovernance: govManage,
      })
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [isPlatformAdmin, sub, authzScope, activeWorkspaceId])

  const canAccessPanel = useMemo(
    () => buildCanAccessPanel(access, isPlatformAdmin),
    [access, isPlatformAdmin],
  )

  const canMutate =
    isPlatformAdmin ||
    access.canManageWorkspace ||
    access.canManageOrganization ||
    access.canManageGovernance

  return {
    ...access,
    isPlatformAdmin,
    loading,
    canAccessPanel,
    canMutate,
  }
}

export function useAuthorization() {
  const session = getSession()
  const jwtRoles = sessionRoles()
  const isPlatformAdmin = hasPlatformAdminAccess(jwtRoles, session?.user.role)

  const authorize = useCallback(
    async (resourceType: string, action: string, scope = 'global') => {
      if (isPlatformAdmin) return true
      if (!session?.user.id) return false
      const result = await authorizeTectona(session.user.id, resourceType, action, scope)
      return Boolean(result.allowed)
    },
    [isPlatformAdmin, session?.user.id],
  )

  return { isPlatformAdmin, authorize }
}
