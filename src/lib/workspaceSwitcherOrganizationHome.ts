import { isOrganizationHomeWorkspace } from '@/lib/workspaceOwnershipVisibility'

/** Minimal catalog row for organization-home switcher selection. */
export type SwitcherCatalogWorkspace = {
  id: string
  organization_id: string
  tenant_mode?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Organization home (e.g. Adira Finance WS) stays in the workspace switcher for
 * directory admins. User-scoped listing must not drop that root tenant.
 */
export function selectOrganizationHomesForSwitcher<T extends SwitcherCatalogWorkspace>(
  activeWorkspaces: readonly T[],
  opts: {
    isPlatformAdmin: boolean
    isOrganizationAdmin: boolean
    alreadyListedOrganizationIds: ReadonlySet<string>
  },
): T[] {
  if (!opts.isPlatformAdmin && !opts.isOrganizationAdmin) return []

  return activeWorkspaces.filter((workspace) => {
    if (!isOrganizationHomeWorkspace(workspace)) return false
    if (opts.isPlatformAdmin) return true
    return opts.alreadyListedOrganizationIds.has(workspace.organization_id)
  })
}

/**
 * Organization / platform admins may switch into every non-personal workspace in
 * organizations they already administer (membership, ownership, or org home).
 * Personal workspaces stay owner-only.
 */
export function selectAdministeredOrgWorkspacesForSwitcher<T extends SwitcherCatalogWorkspace>(
  activeWorkspaces: readonly T[],
  opts: {
    isPlatformAdmin: boolean
    isOrganizationAdmin: boolean
    alreadyListedOrganizationIds: ReadonlySet<string>
  },
): T[] {
  if (!opts.isPlatformAdmin && !opts.isOrganizationAdmin) return []

  return activeWorkspaces.filter((workspace) => {
    if (workspace.tenant_mode === 'personal') return false
    if (opts.isPlatformAdmin) return true
    return opts.alreadyListedOrganizationIds.has(workspace.organization_id)
  })
}

export function collectSwitcherOrganizationIds(
  organizationIds: Array<string | null | undefined>,
): Set<string> {
  const next = new Set<string>()
  for (const id of organizationIds) {
    const trimmed = id?.trim()
    if (trimmed) next.add(trimmed)
  }
  return next
}
