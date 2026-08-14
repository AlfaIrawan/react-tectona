import type { TenantMode } from '@/lib/onboardingFeature'

export const ACCESSIBLE_WORKSPACE_IDS_KEY = 'tectona:accessible-workspace-ids'

export type CorporateWorkspaceVisibilityInput = {
  isPlatformAdmin: boolean
  isCorporateUser: boolean
  /**
   * True when the user already has an active WAC membership on this workspace.
   * Domain-verified corporate users may nest under the org Directory tree without
   * membership; org workspace content stays hidden until membership is granted.
   */
  hasActiveMembership?: boolean
  /**
   * When set with org tenant + active membership, `read_only_workspace` does not
   * grant org switcher / tenant activation (directory join only).
   */
  membershipParticipationScopeCode?: string | null
  /** True when workspace-org metadata or directory role marks this user as owner. */
  isWorkspaceOwner?: boolean
}

/** Join-approve external tier — directory tree only, not org workspace switcher. */
export function membershipGrantsOrganizationWorkspaceSwitcherAccess(
  participationScopeCode: string | null | undefined,
): boolean {
  const code = (participationScopeCode ?? '').trim().toLowerCase()
  if (!code) return true
  return code !== 'read_only_workspace'
}

export function isOrganizationTenantMode(tenantMode: TenantMode | null | undefined): boolean {
  return tenantMode === 'organization'
}

/**
 * Corporate users cannot open organization workspaces until granted (active membership).
 * Platform admins always see them. Personal / other tenant modes are never hidden by this rule.
 */
export function isOrganizationWorkspaceHiddenByDefault(
  tenantMode: TenantMode | null | undefined,
  opts: CorporateWorkspaceVisibilityInput,
): boolean {
  if (opts.isPlatformAdmin) return false
  if (!opts.isCorporateUser) return false
  if (!isOrganizationTenantMode(tenantMode)) return false
  if (opts.isWorkspaceOwner) return false
  if (!opts.hasActiveMembership) return true
  if (
    opts.membershipParticipationScopeCode !== undefined
    && !membershipGrantsOrganizationWorkspaceSwitcherAccess(opts.membershipParticipationScopeCode)
  ) {
    return true
  }
  return false
}

export function isWorkspaceListedForUser(
  tenantMode: TenantMode | null | undefined,
  opts: CorporateWorkspaceVisibilityInput,
): boolean {
  return !isOrganizationWorkspaceHiddenByDefault(tenantMode, opts)
}

/** True when a corporate user may activate this workspace as active tenant. */
export function canActivateWorkspaceAsTenant(
  tenantMode: TenantMode | null | undefined,
  opts: CorporateWorkspaceVisibilityInput,
): boolean {
  if (opts.isPlatformAdmin) return true
  if (opts.isWorkspaceOwner) return true
  if (!opts.hasActiveMembership) return false
  return isWorkspaceListedForUser(tenantMode, opts)
}

export function persistAccessibleWorkspaceIds(workspaceIds: string[]): void {
  try {
    if (!workspaceIds.length) {
      sessionStorage.removeItem(ACCESSIBLE_WORKSPACE_IDS_KEY)
      return
    }
    sessionStorage.setItem(ACCESSIBLE_WORKSPACE_IDS_KEY, JSON.stringify(workspaceIds))
  } catch {
    // ignore storage failures
  }
}

export function readAccessibleWorkspaceIds(): string[] | null {
  try {
    const raw = sessionStorage.getItem(ACCESSIBLE_WORKSPACE_IDS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
  } catch {
    return null
  }
}

export function pickPreferredCorporateWorkspaceId(
  options: Array<{ workspaceId: string; tenantMode: TenantMode | null }>,
): string | null {
  const personal = options.find((option) => option.tenantMode === 'personal')
  return personal?.workspaceId ?? options[0]?.workspaceId ?? null
}
