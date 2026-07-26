import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSession } from '@/auth/authService'
import { authorizeTectona } from '@/lib/api/authzApi'
import {
  TECTONA_AUTHZ_ACTIONS,
  TECTONA_AUTHZ_RESOURCES,
  type TectonaAuthzResource,
} from '@/lib/constants/tectonaAuthz'
import { hasPlatformAdminAccess } from '@/lib/auth/platformAccess'

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

const FULL_ACCESS: Omit<WorkspaceManagementAccess, 'loading' | 'isPlatformAdmin' | 'canAccessPanel' | 'canMutate'> = {
  canViewOverview: true,
  canViewDirectory: true,
  canViewGovernance: true,
  canManageWorkspace: true,
  canManageOrganization: true,
  canManageGovernance: true,
}

function sessionRoles(): string[] {
  const session = getSession()
  if (!session) return []
  if (session.user.roles?.length) return session.user.roles
  if (session.user.role === 'root') return ['tectona_root']
  if (session.user.role === 'admin') return ['tectona_admin']
  return []
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
  access: Omit<WorkspaceManagementAccess, 'loading' | 'isPlatformAdmin' | 'canAccessPanel' | 'canMutate'>,
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
 * root / administrator: full access via JWT roles (no authz round-trip).
 */
export function useWorkspaceManagementAuthorization(scope = 'global'): WorkspaceManagementAccess {
  const session = getSession()
  const sub = session?.user.id
  const jwtRoles = sessionRoles()
  const uiRole = session?.user.role

  const isPlatformAdmin = useMemo(
    () => hasPlatformAdminAccess(jwtRoles, uiRole),
    [jwtRoles, uiRole],
  )

  const [loading, setLoading] = useState(!isPlatformAdmin)
  const [access, setAccess] = useState(FULL_ACCESS)

  useEffect(() => {
    if (isPlatformAdmin) {
      setAccess(FULL_ACCESS)
      setLoading(false)
      return
    }
    if (!sub) {
      setAccess({
        canViewOverview: false,
        canViewDirectory: false,
        canViewGovernance: false,
        canManageWorkspace: false,
        canManageOrganization: false,
        canManageGovernance: false,
      })
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    ;(async () => {
      const [
        workspaceView,
        workspaceManage,
        orgView,
        orgManage,
        govView,
        govManage,
      ] = await Promise.all([
        checkAllowed(sub, TECTONA_AUTHZ_RESOURCES.workspace, TECTONA_AUTHZ_ACTIONS.view, scope),
        checkAllowed(sub, TECTONA_AUTHZ_RESOURCES.workspace, TECTONA_AUTHZ_ACTIONS.manage, scope),
        checkAllowed(sub, TECTONA_AUTHZ_RESOURCES.organization, TECTONA_AUTHZ_ACTIONS.view, scope),
        checkAllowed(sub, TECTONA_AUTHZ_RESOURCES.organization, TECTONA_AUTHZ_ACTIONS.manage, scope),
        checkAllowed(sub, TECTONA_AUTHZ_RESOURCES.governance, TECTONA_AUTHZ_ACTIONS.view, scope),
        checkAllowed(sub, TECTONA_AUTHZ_RESOURCES.governance, TECTONA_AUTHZ_ACTIONS.manage, scope),
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
  }, [isPlatformAdmin, sub, scope])

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
