/** Feature flag: Tectona self-service onboarding (P0). */

function envFlag(name: string): string | undefined {
  return (import.meta.env[name] as string | undefined)?.trim()
}

export function isOnboardingEnabled(): boolean {
  const override = envFlag('VITE_TECTONA_ONBOARDING_ENABLED')
  if (override === 'false') return false
  if (override === 'true') return true
  return true
}

/** Corporate onboarding email gate — off until SMTP / production verify flow is ready. */
export function isCorporateEmailVerificationRequired(): boolean {
  const override = envFlag('VITE_TECTONA_REQUIRE_EMAIL_VERIFICATION')
  if (override === 'true') return true
  if (override === 'false') return false
  return false
}

/** When email verification is off, corporate users wait for workspace admin approval. */
export function isCorporateAdminApprovalRequired(): boolean {
  if (isCorporateEmailVerificationRequired()) return false
  const override = envFlag('VITE_TECTONA_CORPORATE_ADMIN_APPROVAL')
  if (override === 'false') return false
  if (override === 'true') return true
  return true
}

/** Corporate matched-domain users may choose admin approval vs email verification at finish. */
export function isCorporateOnboardingMethodChoiceEnabled(): boolean {
  if (isCorporateEmailVerificationRequired()) return false
  const override = envFlag('VITE_TECTONA_CORPORATE_ONBOARDING_CHOICE')
  if (override === 'false') return false
  if (override === 'true') return true
  return isCorporateEmailVerificationOptionAvailable()
}

/** Email verification finish option (requires SMTP on identity-lite). */
export function isCorporateEmailVerificationOptionAvailable(): boolean {
  const override = envFlag('VITE_TECTONA_CORPORATE_EMAIL_OPTION')
  if (override === 'false') return false
  if (override === 'true') return true
  return true
}

/**
 * Skip inbox confirmation when the user already proved identity via corporate IdP
 * (e.g. Microsoft / Entra / hybrid AD) and may not have an M365 mailbox.
 * Only applies while email verification remains enabled.
 */
export function shouldBypassCorporateEmailVerification(
  authMethod: string | null | undefined,
  email?: string,
): boolean {
  if (!isCorporateEmailVerificationRequired()) return false
  const override = envFlag('VITE_TECTONA_SKIP_EMAIL_VERIFY_FOR_FEDERATED')
  if (override === 'false') return false
  if (authMethod === 'microsoft') return true
  if (override === 'true' && authMethod === 'google') return true
  if (!authMethod && email && !isConsumerEmail(email)) return true
  return false
}

const CONSUMER_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.id',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
  'mail.com',
])

export function isConsumerEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1]
  if (!domain) return true
  return CONSUMER_EMAIL_DOMAINS.has(domain)
}

export const TENANT_STORAGE_KEY = 'tectona:active-tenant'

/** Sentinel stored in session when user views data across all accessible workspaces. */
export const ALL_WORKSPACES_ID = '__all__'

export type TenantMode = 'personal' | 'organization'

export type StoredTenantSelection = {
  workspaceId: string
  orgId: string | null
  slug: string | null
  tenantMode: TenantMode | null
  displayName?: string | null
  /**
   * When `workspaceId` is ALL_WORKSPACES_ID, optional subset of workspace IDs
   * checked in the switcher. Empty/omitted = all accessible memberships.
   */
  selectedWorkspaceIds?: string[]
}

export function suggestSlugFromName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!base) return ''
  if (base.length <= 63) return base
  return base.slice(0, 63).replace(/-+$/g, '')
}

export function isValidSlugFormat(slug: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/.test(slug)
}
