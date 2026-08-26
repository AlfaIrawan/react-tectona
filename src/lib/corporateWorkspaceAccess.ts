import type { TenantMode } from '@/lib/onboardingFeature'
import { normalizeParticipationScopeCode, PARTICIPATION_SCOPE_CODE } from '@/lib/participationScopeRules'

export const ACCESSIBLE_WORKSPACE_IDS_KEY = 'tectona:accessible-workspace-ids'

export type CorporateWorkspaceVisibilityInput = {
  isPlatformAdmin: boolean
  isOrganizationAdmin?: boolean
  isCorporateUser: boolean
  /** True when the user already has an active WAC membership on this workspace. */
  hasActiveMembership?: boolean
  /** Organization workspace access requires the full WAC scope. */
  membershipParticipationScopeCode?: string | null
  /** True when workspace-org metadata or directory role marks this user as owner. */
  isWorkspaceOwner?: boolean
  /** True only for the organization home node (e.g. Adira Finance WS). */
  isOrganizationHomeWorkspace?: boolean
}

/** Only the full organization WAC grant may activate an organization workspace. */
export function membershipGrantsOrganizationWorkspaceSwitcherAccess(
  participationScopeCode: string | null | undefined,
): boolean {
  if (!participationScopeCode?.trim()) return false
  return normalizeParticipationScopeCode(participationScopeCode.trim().toLowerCase())
    === PARTICIPATION_SCOPE_CODE.ALL
}

export function isOrganizationTenantMode(tenantMode: TenantMode | null | undefined): boolean {
  // Unknown tenant metadata is treated as organization-scoped. The switcher
  // labels every non-personal option as an organization workspace, so access
  // must fail closed until WAC confirms membership.
  return tenantMode !== 'personal'
}

/**
 * Organization workspace access is granted by an active WAC membership. Platform
 * administration and directory ownership do not implicitly grant tenant access.
 * Personal workspaces remain owner-accessible.
 */
export function isOrganizationWorkspaceHiddenByDefault(
  tenantMode: TenantMode | null | undefined,
  opts: CorporateWorkspaceVisibilityInput,
): boolean {
  if (!isOrganizationTenantMode(tenantMode)) return false
  if (opts.isPlatformAdmin || opts.isOrganizationAdmin) return false
  // Ownership never grants access to an organization workspace. It still allows
  // a user's personal workspace through the non-organization path above.
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

/** True when a non-admin user may activate this workspace as active tenant. */
export function canActivateWorkspaceAsTenant(
  tenantMode: TenantMode | null | undefined,
  opts: CorporateWorkspaceVisibilityInput,
): boolean {
  if ((opts.isPlatformAdmin || opts.isOrganizationAdmin) && isOrganizationTenantMode(tenantMode)) return true
  if (
    opts.isWorkspaceOwner
    && (
      !isOrganizationTenantMode(tenantMode)
      || opts.isOrganizationHomeWorkspace === false
    )
  ) return true
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
