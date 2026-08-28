/**
 * Workspace / platform role snapshot for Tectona Assistant (governance-aware chat).
 */

import { getSession } from '@/auth/authService'
import { useTenantContextOptional } from '@/auth/TenantContext'
import { hasPlatformAdminAccess } from '@/lib/auth/platformAccess'
import {
  fetchSubjectMemberships,
  TECTONA_WAC_APP_ID,
  wacRoleCodeToUiRole,
  type WacMembershipDto,
} from '@/lib/api/workspaceAccessControlApi'
import { isAllWorkspacesSelection } from '@/lib/tenantWorkspaceScope'
import { useEffect } from 'react'
import { create } from 'zustand'
import { TECTONA_TENANT_CHANGED_EVENT } from '@/lib/tenantEvents'

export type TectonaChatWacRole = 'Admin' | 'Manager' | 'Member' | 'Viewer' | 'None'

export type TectonaChatRoleSnapshot = {
  platform_roles: string[]
  is_platform_admin: boolean
  workspace_id: string | null
  workspace_role: TectonaChatWacRole
  can_view_governance: boolean
  can_manage_workspace: boolean
  can_manage_governance: boolean
  can_manage_members: boolean
}

type TectonaChatRoleStore = {
  snapshot: TectonaChatRoleSnapshot | null
  loading: boolean
  setSnapshot: (snapshot: TectonaChatRoleSnapshot | null) => void
  setLoading: (loading: boolean) => void
}

export const useTectonaChatRoleStore = create<TectonaChatRoleStore>((set) => ({
  snapshot: null,
  loading: false,
  setSnapshot: (snapshot) => set({ snapshot }),
  setLoading: (loading) => set({ loading }),
}))

function sessionPlatformRoles(): string[] {
  const session = getSession()
  if (!session) return []
  if (session.user.roles?.length) return [...session.user.roles]
  if (session.user.role === 'root') return ['tectona_root']
  if (session.user.role === 'admin') return ['tectona_admin']
  return []
}

function roleRank(role: TectonaChatWacRole): number {
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

function maxRoleForWorkspace(
  memberships: WacMembershipDto[],
  workspaceId: string | null | undefined,
): TectonaChatWacRole {
  const scoped =
    workspaceId && !isAllWorkspacesSelection(workspaceId)
      ? memberships.filter((row) => row.workspace_id === workspaceId)
      : memberships

  let max: TectonaChatWacRole = 'None'
  for (const row of scoped) {
    const role = wacRoleCodeToUiRole(row.role_code) as TectonaChatWacRole
    if (roleRank(role) > roleRank(max)) max = role
  }
  return max
}

export function buildChatRoleSnapshot(input: {
  platformRoles: string[]
  uiRole?: string
  workspaceId: string | null
  memberships: WacMembershipDto[]
}): TectonaChatRoleSnapshot {
  const isPlatformAdmin = hasPlatformAdminAccess(input.platformRoles, input.uiRole)
  const workspaceRole = isPlatformAdmin ? 'Admin' : maxRoleForWorkspace(input.memberships, input.workspaceId)

  if (isPlatformAdmin) {
    return {
      platform_roles: input.platformRoles,
      is_platform_admin: true,
      workspace_id: input.workspaceId,
      workspace_role: 'Admin',
      can_view_governance: true,
      can_manage_workspace: true,
      can_manage_governance: true,
      can_manage_members: true,
    }
  }

  const rank = roleRank(workspaceRole)
  return {
    platform_roles: input.platformRoles,
    is_platform_admin: false,
    workspace_id: input.workspaceId,
    workspace_role: workspaceRole,
    can_view_governance: rank >= roleRank('Manager'),
    can_manage_workspace: rank >= roleRank('Admin'),
    can_manage_governance: rank >= roleRank('Admin'),
    can_manage_members: rank >= roleRank('Admin'),
  }
}

export async function refreshTectonaChatRoleSnapshot(workspaceId: string | null): Promise<TectonaChatRoleSnapshot | null> {
  const session = getSession()
  if (!session?.user.id) {
    useTectonaChatRoleStore.getState().setSnapshot(null)
    return null
  }

  const platformRoles = sessionPlatformRoles()
  const membershipsRes = await fetchSubjectMemberships(TECTONA_WAC_APP_ID, session.user.id, {
    activeOnly: true,
  }).catch(() => ({ items: [] as WacMembershipDto[] }))

  const snapshot = buildChatRoleSnapshot({
    platformRoles,
    uiRole: session.user.role,
    workspaceId,
    memberships: membershipsRes.items ?? [],
  })
  useTectonaChatRoleStore.getState().setSnapshot(snapshot)
  return snapshot
}

/** Keep assistant role context aligned with active tenant / session. */
export function useTectonaChatRoleSync(): void {
  const tenant = useTenantContextOptional()
  const workspaceId = tenant?.workspaceId ?? null

  useEffect(() => {
    let cancelled = false
    useTectonaChatRoleStore.getState().setLoading(true)
    void refreshTectonaChatRoleSnapshot(workspaceId)
      .catch(() => {
        if (!cancelled) useTectonaChatRoleStore.getState().setSnapshot(null)
      })
      .finally(() => {
        if (!cancelled) useTectonaChatRoleStore.getState().setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [workspaceId, tenant?.orgId])

  useEffect(() => {
    const onTenantChanged = () => {
      void refreshTectonaChatRoleSnapshot(workspaceId)
    }
    window.addEventListener(TECTONA_TENANT_CHANGED_EVENT, onTenantChanged)
    return () => window.removeEventListener(TECTONA_TENANT_CHANGED_EVENT, onTenantChanged)
  }, [workspaceId])
}

export function readTectonaChatRoleSnapshot(): TectonaChatRoleSnapshot | null {
  return useTectonaChatRoleStore.getState().snapshot
}

export function mergeRoleFieldsIntoUiContext<T extends Record<string, unknown>>(base: T): T & Partial<TectonaChatRoleSnapshot> {
  const role = readTectonaChatRoleSnapshot()
  if (!role) return base
  return {
    ...base,
    platform_roles: role.platform_roles,
    is_platform_admin: role.is_platform_admin,
    workspace_role: role.workspace_role,
    can_view_governance: role.can_view_governance,
    can_manage_workspace: role.can_manage_workspace,
    can_manage_governance: role.can_manage_governance,
    can_manage_members: role.can_manage_members,
  }
}
