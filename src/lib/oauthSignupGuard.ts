import type { OnboardingStatusResponse } from '@/lib/api/workspaceAccessControlApi'

/** True when OAuth started from /register but the subject already has (or had) Tectona onboarding. */
export function isExistingAccountForOAuthSignup(status: OnboardingStatusResponse): boolean {
  if ((status.active_membership_count ?? 0) > 0) return true
  return status.onboarding_status !== 'none'
}
