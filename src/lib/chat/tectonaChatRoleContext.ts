/**
 * Workspace / platform role snapshot for Tectona Assistant (governance-aware chat).
 */

import { getSession } from '@/auth/authService'
import { useTenantContextOptional } from '@/auth/TenantContext'
import { hasPlatformAdminAccess } from '@/lib/auth/platformAccess'
import {
  wacRoleCodeToUiRole,
  type WacMembershipDto,
} from '@/lib/api/workspaceAccessControlApi'
import { fetchSubjectMembershipsCached } from '@/lib/wacMembershipCache'
import { fetchAllWorkspaceOrgWorkspacesCached } from '@/lib/workspaceOrgDirectoryCache'
import type { WorkspaceOrgWorkspaceDto } from '@/lib/api/workspaceOrgApi'
import { isAllWorkspacesSelection } from '@/lib/tenantWorkspaceScope'
import { useEffect } from 'react'
import { create } from 'zustand'
import { TECTONA_TENANT_CHANGED_EVENT } from '@/lib/tenantEvents'

export type TectonaChatWacRole = 'Admin' | 'Manager' | 'Member' | 'Viewer' | 'None'

export type TectonaAccessibleWorkspace = {
  workspace_id: string
  name: string
  role: TectonaChatWacRole
}

export type TectonaChatRoleSnapshot = {
  platform_roles: string[]
  is_platform_admin: boolean
  workspace_id: string | null
  workspace_role: TectonaChatWacRole
  can_view_governance: boolean
  can_manage_workspace: boolean
  can_manage_governance: boolean
  can_manage_members: boolean
  active_tenant_workspace_id: string | null
  active_tenant_workspace_name: string | null
  accessible_workspaces: TectonaAccessibleWorkspace[]
  accessible_workspaces_summary: string | null
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

function buildAccessibleWorkspaces(
  memberships: WacMembershipDto[],
  nameById: Map<string, string>,
): TectonaAccessibleWorkspace[] {
  const byId = new Map<string, TectonaAccessibleWorkspace>()
  for (const row of memberships) {
    const role = wacRoleCodeToUiRole(row.role_code) as TectonaChatWacRole
    const existing = byId.get(row.workspace_id)
    if (!existing || roleRank(role) > roleRank(existing.role)) {
      byId.set(row.workspace_id, {
        workspace_id: row.workspace_id,
        name: nameById.get(row.workspace_id) ?? row.workspace_id.slice(0, 8),
        role,
      })
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function buildAccessibleWorkspacesSummary(
  entries: TectonaAccessibleWorkspace[],
  activeName: string | null,
): string | null {
  if (entries.length === 0) return null
  const list = entries
    .slice(0, 10)
    .map((entry) => `${entry.name} (${entry.role})`)
    .join('; ')
  const active = activeName ? `active=${activeName}; ` : ''
  return `count=${entries.length}; ${active}list=${list}`
}

export function buildChatRoleSnapshot(input: {
  platformRoles: string[]
  uiRole?: string
  workspaceId: string | null
  tenantDisplayName?: string | null
  memberships: WacMembershipDto[]
  workspaceNameById?: Map<string, string>
}): TectonaChatRoleSnapshot {
  const isPlatformAdmin = hasPlatformAdminAccess(input.platformRoles, input.uiRole)
  const workspaceRole = isPlatformAdmin ? 'Admin' : maxRoleForWorkspace(input.memberships, input.workspaceId)
  const nameById = input.workspaceNameById ?? new Map<string, string>()
  const accessibleWorkspaces = buildAccessibleWorkspaces(input.memberships, nameById)
  const singleTenant = input.workspaceId && !isAllWorkspacesSelection(input.workspaceId)
  const activeTenantWorkspaceId = singleTenant ? input.workspaceId : null
  const activeTenantWorkspaceName = singleTenant
    ? (input.tenantDisplayName?.trim() || nameById.get(input.workspaceId!) || null)
    : null
  const accessibleSummary = buildAccessibleWorkspacesSummary(
    accessibleWorkspaces,
    activeTenantWorkspaceName,
  )

  const scopeFields = {
    active_tenant_workspace_id: activeTenantWorkspaceId,
    active_tenant_workspace_name: activeTenantWorkspaceName,
    accessible_workspaces: accessibleWorkspaces,
    accessible_workspaces_summary: accessibleSummary,
  }

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
      ...scopeFields,
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
    ...scopeFields,
  }
}

export async function refreshTectonaChatRoleSnapshot(
  workspaceId: string | null,
  options?: { tenantDisplayName?: string | null },
): Promise<TectonaChatRoleSnapshot | null> {
  const session = getSession()
  if (!session?.user.id) {
    useTectonaChatRoleStore.getState().setSnapshot(null)
    return null
  }

  const platformRoles = sessionPlatformRoles()
  const [membershipsRes, directory] = await Promise.all([
    fetchSubjectMembershipsCached(session.user.id, { activeOnly: true }).catch(() => ({
      items: [] as WacMembershipDto[],
    })),
    fetchAllWorkspaceOrgWorkspacesCached().catch((): WorkspaceOrgWorkspaceDto[] => []),
  ])
  const workspaceNameById = new Map<string, string>(directory.map((row) => [row.id, row.name]))

  const snapshot = buildChatRoleSnapshot({
    platformRoles,
    uiRole: session.user.role,
    workspaceId,
    tenantDisplayName: options?.tenantDisplayName ?? null,
    memberships: membershipsRes.items ?? [],
    workspaceNameById,
  })
  useTectonaChatRoleStore.getState().setSnapshot(snapshot)
  return snapshot
}

/** Keep assistant role context aligned with active tenant / session. */
export function useTectonaChatRoleSync(): void {
  const tenant = useTenantContextOptional()
  const workspaceId = tenant?.workspaceId ?? null
  const tenantDisplayName = tenant?.displayName ?? null

  useEffect(() => {
    let cancelled = false
    useTectonaChatRoleStore.getState().setLoading(true)
    void refreshTectonaChatRoleSnapshot(workspaceId, { tenantDisplayName })
      .catch(() => {
        if (!cancelled) useTectonaChatRoleStore.getState().setSnapshot(null)
      })
      .finally(() => {
        if (!cancelled) useTectonaChatRoleStore.getState().setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [workspaceId, tenant?.orgId, tenantDisplayName])

  useEffect(() => {
    const onTenantChanged = () => {
      void refreshTectonaChatRoleSnapshot(workspaceId, { tenantDisplayName })
    }
    window.addEventListener(TECTONA_TENANT_CHANGED_EVENT, onTenantChanged)
    return () => window.removeEventListener(TECTONA_TENANT_CHANGED_EVENT, onTenantChanged)
  }, [workspaceId, tenantDisplayName])
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
    active_tenant_workspace_id: role.active_tenant_workspace_id,
    active_tenant_workspace_name: role.active_tenant_workspace_name,
    accessible_workspaces_summary: role.accessible_workspaces_summary,
  }
}
