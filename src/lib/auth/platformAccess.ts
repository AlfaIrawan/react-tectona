/** JWT platform roles from identity-lite (full access to Workspace Management). */
export const PLATFORM_ADMIN_JWT_ROLES = [
  'tectona_root',
  'tectona_admin',
] as const

export const ORGANIZATION_ADMIN_JWT_ROLE = 'tectona_organization_admin'

/** AuthZ / identity-lite aliases for the same organization-admin grant. */
export const ORGANIZATION_ADMIN_JWT_ROLES = [
  ORGANIZATION_ADMIN_JWT_ROLE,
  'tectona.organization_admin',
  'organization_admin',
] as const

export function isPlatformAdminJwtRole(roles: string[] | undefined): boolean {
  if (!roles?.length) return false
  return PLATFORM_ADMIN_JWT_ROLES.some((r) => roles.includes(r))
}

export function isPlatformAdminUiRole(role: string | undefined): boolean {
  return role === 'root' || role === 'admin'
}

export function hasPlatformAdminAccess(roles: string[] | undefined, uiRole?: string): boolean {
  return isPlatformAdminJwtRole(roles) || isPlatformAdminUiRole(uiRole)
}

export function hasOrganizationAdminAccess(roles: string[] | undefined): boolean {
  if (!roles?.length) return false
  return ORGANIZATION_ADMIN_JWT_ROLES.some((role) => roles.includes(role))
}
