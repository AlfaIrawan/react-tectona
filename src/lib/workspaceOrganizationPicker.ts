/**
 * Organization picker helpers — exclude personal onboarding wrapper orgs from corporate pickers.
 */

export type OrganizationPickerSource = {
  organization_type?: string | null
  organization_code?: string | null
}

/** Personal P0 onboarding creates org rows named like "{User} WS" with type/code personal-* — not corporate orgs. */
export function isPersonalOnboardingOrganization(org: OrganizationPickerSource): boolean {
  const type = String(org.organization_type ?? '').trim().toLowerCase()
  if (type === 'personal') return true
  const code = String(org.organization_code ?? '').trim().toLowerCase()
  return code.startsWith('personal-')
}

export function isCorporateOrganizationForPicker(org: OrganizationPickerSource): boolean {
  return !isPersonalOnboardingOrganization(org)
}
