/**
 * Onboarding orchestration helpers — WAC onboarding status + join requests.
 */

import { TECTONA_AUTHZ_APP_ID } from '@/lib/constants/tectonaAuthz'
import {
  fetchOnboardingStatus as fetchWacOnboardingStatus,
  submitAccessRequest,
  confirmEmailVerifiedOnboarding as confirmWacEmailVerifiedOnboarding,
  requestCorporateOnboardingAdminApproval,
  switchCorporateOnboardingToAdminApproval as switchWacCorporateOnboardingToAdminApproval,
  type OnboardingStatusResponse,
  type AccessRequestSubmitPayload,
  type AccessRequestDto,
} from './workspaceAccessControlApi'

export type { OnboardingStatusResponse }
import {
  createPersonalWorkspace,
  createOrgPersonalWorkspaceOnboarding,
  deferPersonalWorkspaceForAdminApproval,
  domainHomeOnboarding,
  sendDomainHomeVerification,
  resolveOrganizationByEmail,
  fetchCorporateOnboardingProgress,
  type PersonalWorkspaceResponse,
  type DomainResolveResponse,
  type DomainHomeResponse,
  type OrgPersonalWorkspaceResponse,
} from './workspaceOrgApi'
import { verifyEmailToken as verifyIdentityEmailToken, type VerifyEmailResponse } from './identityApi'
import {
  isCorporateAdminApprovalRequired,
  isCorporateOnboardingMethodChoiceEnabled,
} from '@/lib/onboardingFeature'
import {
  markCorporateEmailVerificationPending,
  clearCorporateEmailVerificationPending,
  setCorporateOnboardingFinishMethod,
} from '@/lib/corporateOnboardingSession'

export type { DomainResolveResponse, DomainHomeResponse, VerifyEmailResponse }

export { resolveOrganizationByEmail }

export type OnboardingStatus = OnboardingStatusResponse['onboarding_status']

export { fetchWacOnboardingStatus as fetchOnboardingStatus }

export async function createPersonalWorkspaceOnboarding(input: {
  displayName: string
  slug: string
  corporateOnboarding?: boolean
}): Promise<PersonalWorkspaceResponse> {
  return createPersonalWorkspace({
    display_name: input.displayName,
    slug: input.slug,
    app_id: TECTONA_AUTHZ_APP_ID,
    corporate_onboarding: input.corporateOnboarding === true,
  })
}

export async function domainHomeOnboardingForUser(
  email: string,
  opts?: { deferVerificationEmail?: boolean },
): Promise<DomainHomeResponse> {
  return domainHomeOnboarding(TECTONA_AUTHZ_APP_ID, email, opts)
}

export async function sendDomainHomeVerificationForUser(
  email: string,
  workspaceId: string,
): Promise<{ email_verification_sent: boolean }> {
  return sendDomainHomeVerification(TECTONA_AUTHZ_APP_ID, email, workspaceId)
}

export async function verifyEmailToken(token: string): Promise<VerifyEmailResponse> {
  return verifyIdentityEmailToken(token)
}

export async function confirmEmailVerifiedOnboarding(input: {
  appId: string
  workspaceId: string
  subjectId: string
}) {
  return confirmWacEmailVerifiedOnboarding(input)
}

export async function createOrgPersonalWorkspaceOnboardingForUser(input: {
  email: string
  organizationId: string
  displayName: string
  slug: string
}): Promise<OrgPersonalWorkspaceResponse> {
  return createOrgPersonalWorkspaceOnboarding(input.email, {
    organization_id: input.organizationId,
    display_name: input.displayName,
    slug: input.slug,
    app_id: TECTONA_AUTHZ_APP_ID,
    defer_org_tree_link:
      isCorporateAdminApprovalRequired() || isCorporateOnboardingMethodChoiceEnabled(),
  })
}

/** Email finish — join org workspace (pending) and send verification link. */
export async function completeCorporateOnboardingWithEmail(input: {
  email: string
  subjectId: string
}): Promise<DomainHomeResponse> {
  setCorporateOnboardingFinishMethod(input.subjectId, 'email')
  markCorporateEmailVerificationPending(input.subjectId)
  return domainHomeOnboardingForUser(input.email, { deferVerificationEmail: false })
}

/** Admin finish — queue access request for org workspace admin review. */
export async function completeCorporateOnboardingWithAdminApproval(input: {
  subjectId: string
  workspaceId?: string | null
  email: string
  message?: string
}): Promise<OnboardingStatusResponse> {
  setCorporateOnboardingFinishMethod(input.subjectId, 'admin')
  return submitCorporateOnboardingForAdminApproval(input)
}

export async function submitJoinRequestBySlug(
  slug: string,
  message?: string,
): Promise<AccessRequestDto> {
  const payload: AccessRequestSubmitPayload = {
    workspace_slug: slug,
    message,
  }
  return submitAccessRequest(TECTONA_AUTHZ_APP_ID, payload)
}

export async function submitJoinRequestByWorkspaceId(
  workspaceId: string,
  message?: string,
): Promise<AccessRequestDto> {
  const payload: AccessRequestSubmitPayload = {
    workspace_id: workspaceId,
    message,
  }
  return submitAccessRequest(TECTONA_AUTHZ_APP_ID, payload)
}

/** Dev / interim: activate personal workspace access without inbox confirmation. */
export async function activateCorporateOnboardingWithoutEmail(input: {
  email: string
  subjectId: string
  workspaceId?: string | null
}): Promise<OnboardingStatusResponse> {
  const progress = await fetchCorporateOnboardingProgress(input.email, TECTONA_AUTHZ_APP_ID)
  const workspaceId = input.workspaceId?.trim() || progress.personal_workspace_id?.trim()
  if (!workspaceId) {
    throw new Error('Personal workspace not found. Create your personal workspace first.')
  }
  await confirmEmailVerifiedOnboarding({
    appId: TECTONA_AUTHZ_APP_ID,
    workspaceId,
    subjectId: input.subjectId,
  })
  return fetchWacOnboardingStatus(TECTONA_AUTHZ_APP_ID, input.subjectId)
}

/** Corporate wizard complete — submit access request; admin must approve before sign-in. */
export async function submitCorporateOnboardingForAdminApproval(input: {
  subjectId: string
  workspaceId?: string | null
  email: string
  message?: string
}): Promise<OnboardingStatusResponse> {
  const progress = await fetchCorporateOnboardingProgress(input.email, TECTONA_AUTHZ_APP_ID)
  const workspaceId = input.workspaceId?.trim() || progress.personal_workspace_id?.trim()
  const orgWorkspaceId = progress.default_workspace_id?.trim() || null
  if (!workspaceId) {
    throw new Error('Personal workspace not found. Create your personal workspace first.')
  }
  await requestCorporateOnboardingAdminApproval({
    appId: TECTONA_AUTHZ_APP_ID,
    workspaceId,
    orgWorkspaceId,
    subjectId: input.subjectId,
    message: input.message,
  })
  try {
    await deferPersonalWorkspaceForAdminApproval(
      workspaceId,
      { identity_ref: input.subjectId },
      { actorId: input.subjectId },
    )
  } catch {
    // WAC onboarding request succeeded; directory defer is best-effort for legacy rows.
  }
  return fetchWacOnboardingStatus(TECTONA_AUTHZ_APP_ID, input.subjectId)
}

/** Option A — switch from email verification to admin approval on the status page. */
export async function switchCorporateOnboardingToAdminApproval(input: {
  subjectId: string
  workspaceId?: string | null
  email: string
  message?: string
}): Promise<OnboardingStatusResponse> {
  const progress = await fetchCorporateOnboardingProgress(input.email, TECTONA_AUTHZ_APP_ID)
  const workspaceId = input.workspaceId?.trim() || progress.personal_workspace_id?.trim()
  const orgWorkspaceId = progress.default_workspace_id?.trim() || null
  if (!workspaceId) {
    throw new Error('Personal workspace not found. Create your personal workspace first.')
  }
  setCorporateOnboardingFinishMethod(input.subjectId, 'admin')
  clearCorporateEmailVerificationPending(input.subjectId)
  const status = await switchWacCorporateOnboardingToAdminApproval({
    appId: TECTONA_AUTHZ_APP_ID,
    workspaceId,
    orgWorkspaceId,
    subjectId: input.subjectId,
    message: input.message ?? 'Switched from email verification to admin approval.',
  })
  try {
    await deferPersonalWorkspaceForAdminApproval(
      workspaceId,
      { identity_ref: input.subjectId },
      { actorId: input.subjectId },
    )
  } catch {
    // WAC switch succeeded; directory defer is best-effort for legacy rows.
  }
  return status
}
