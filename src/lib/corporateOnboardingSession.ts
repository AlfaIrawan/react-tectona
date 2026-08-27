/** Session flags for unmatched-domain corporate onboarding (until backend tracks setup_phase). */

const PERSONAL_DONE_KEY = 'tectona:corporate-personal-done'
const JOIN_STEP_DONE_KEY = 'tectona:corporate-join-step-done'
const WIZARD_DONE_KEY = 'tectona:corporate-wizard-done'
const EMAIL_VERIFY_PENDING_KEY = 'tectona:corporate-email-verify-pending'

function scopedKey(base: string, subjectId: string): string {
  return `${base}:${subjectId.trim()}`
}

export function markCorporatePersonalWorkspaceCreated(subjectId: string): void {
  sessionStorage.setItem(scopedKey(PERSONAL_DONE_KEY, subjectId), '1')
}

export function isCorporatePersonalWorkspaceCreated(subjectId: string): boolean {
  return sessionStorage.getItem(scopedKey(PERSONAL_DONE_KEY, subjectId)) === '1'
}

/** User finished optional-join (submitted join or chose continue without joining). */
export function markCorporateJoinStepCompleted(subjectId: string): void {
  sessionStorage.setItem(scopedKey(JOIN_STEP_DONE_KEY, subjectId), '1')
}

export function isCorporateJoinStepCompleted(subjectId: string): boolean {
  return sessionStorage.getItem(scopedKey(JOIN_STEP_DONE_KEY, subjectId)) === '1'
}

export function markCorporateWizardComplete(subjectId: string): void {
  sessionStorage.setItem(scopedKey(WIZARD_DONE_KEY, subjectId), '1')
}

export function isCorporateWizardComplete(subjectId: string): boolean {
  return sessionStorage.getItem(scopedKey(WIZARD_DONE_KEY, subjectId)) === '1'
}

export function markCorporateEmailVerificationPending(subjectId: string): void {
  sessionStorage.setItem(scopedKey(EMAIL_VERIFY_PENDING_KEY, subjectId), '1')
}

export function isCorporateEmailVerificationPending(subjectId: string): boolean {
  return sessionStorage.getItem(scopedKey(EMAIL_VERIFY_PENDING_KEY, subjectId)) === '1'
}

export function clearCorporateEmailVerificationPending(subjectId: string): void {
  sessionStorage.removeItem(scopedKey(EMAIL_VERIFY_PENDING_KEY, subjectId))
}

export function clearCorporateOnboardingSession(subjectId: string): void {
  const id = subjectId.trim()
  if (!id) return
  sessionStorage.removeItem(scopedKey(PERSONAL_DONE_KEY, id))
  sessionStorage.removeItem(scopedKey(JOIN_STEP_DONE_KEY, id))
  sessionStorage.removeItem(scopedKey(WIZARD_DONE_KEY, id))
  sessionStorage.removeItem(scopedKey(EMAIL_VERIFY_PENDING_KEY, id))
  sessionStorage.removeItem(scopedKey(FINISH_METHOD_KEY, id))
}

export type CorporateOnboardingFinishMethod = 'admin' | 'email'

const FINISH_METHOD_KEY = 'tectona:corporate-finish-method'

export function setCorporateOnboardingFinishMethod(
  subjectId: string,
  method: CorporateOnboardingFinishMethod,
): void {
  sessionStorage.setItem(scopedKey(FINISH_METHOD_KEY, subjectId), method)
}

export function getCorporateOnboardingFinishMethod(
  subjectId: string,
): CorporateOnboardingFinishMethod | null {
  const raw = sessionStorage.getItem(scopedKey(FINISH_METHOD_KEY, subjectId))
  return raw === 'admin' || raw === 'email' ? raw : null
}

export function clearCorporateOnboardingFinishMethod(subjectId: string): void {
  sessionStorage.removeItem(scopedKey(FINISH_METHOD_KEY, subjectId))
}

export function isCorporateEmailFinishMethodSelected(subjectId: string | null | undefined): boolean {
  if (!subjectId?.trim()) return false
  return getCorporateOnboardingFinishMethod(subjectId) === 'email'
}

export function isCorporateAdminFinishMethodSelected(subjectId: string | null | undefined): boolean {
  if (!subjectId?.trim()) return false
  return getCorporateOnboardingFinishMethod(subjectId) === 'admin'
}

const PENDING_EMAIL_CONFIRM_KEY = 'tectona:pending-email-verified-onboarding'

export type PendingEmailVerifiedOnboarding = {
  appId: string
  workspaceId: string
  subjectId: string
}

export function storePendingEmailVerifiedOnboarding(payload: PendingEmailVerifiedOnboarding): void {
  sessionStorage.setItem(PENDING_EMAIL_CONFIRM_KEY, JSON.stringify(payload))
}

export function takePendingEmailVerifiedOnboarding(): PendingEmailVerifiedOnboarding | null {
  try {
    const raw = sessionStorage.getItem(PENDING_EMAIL_CONFIRM_KEY)
    sessionStorage.removeItem(PENDING_EMAIL_CONFIRM_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingEmailVerifiedOnboarding
    if (!parsed.appId || !parsed.workspaceId || !parsed.subjectId) return null
    return parsed
  } catch {
    sessionStorage.removeItem(PENDING_EMAIL_CONFIRM_KEY)
    return null
  }
}
