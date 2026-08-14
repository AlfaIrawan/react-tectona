import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSession } from '@/auth/authService'
import { useOnboardingStatus } from '@/auth/useOnboardingStatus'
import { TECTONA_AUTHZ_APP_ID } from '@/lib/constants/tectonaAuthz'
import { isConsumerEmail, isCorporateEmailVerificationRequired, isCorporateAdminApprovalRequired } from '@/lib/onboardingFeature'
import { fetchCorporateOnboardingProgress, type CorporateOnboardingProgress } from '@/lib/api/workspaceOrgApi'
import {
  isCorporatePersonalWorkspaceCreated,
  isCorporateJoinStepCompleted,
  isCorporateWizardComplete,
  isCorporateEmailVerificationPending,
  isCorporateEmailFinishMethodSelected,
  markCorporatePersonalWorkspaceCreated,
  markCorporateJoinStepCompleted,
  markCorporateWizardComplete,
  clearCorporateEmailVerificationPending,
} from '@/lib/corporateOnboardingSession'

function isEmailVerificationPathActive(
  subjectId: string | undefined,
  globalEmailVerificationRequired: boolean,
  onboardingStatus?: string,
): boolean {
  return (
    globalEmailVerificationRequired ||
    onboardingStatus === 'email_verify_pending' ||
    isCorporateEmailFinishMethodSelected(subjectId)
  )
}

export function useCorporateOnboardingRouting() {
  const session = getSession()
  const email = session?.user.email?.trim().toLowerCase() ?? ''
  const subjectId = session?.user.id
  const isCorporateEmail = Boolean(email) && !isConsumerEmail(email)

  const onboarding = useOnboardingStatus()

  const progressQuery = useQuery({
    queryKey: ['corporate-onboarding-progress', email, subjectId],
    queryFn: () => fetchCorporateOnboardingProgress(email, TECTONA_AUTHZ_APP_ID),
    enabled:
      onboarding.enabled
      && !onboarding.bypass
      && isCorporateEmail
      && Boolean(subjectId)
      && Boolean(session?.token?.trim() || session?.refreshToken?.trim()),
    staleTime: 5_000,
    retry: 1,
  })

  const progress = progressQuery.data ?? null
  const loading = onboarding.loading || (isCorporateEmail && progressQuery.isLoading)
  const emailVerificationRequired = isCorporateEmailVerificationRequired()
  const adminApprovalRequired = isCorporateAdminApprovalRequired()
  const emailVerificationPathActive = isEmailVerificationPathActive(
    subjectId,
    emailVerificationRequired,
    onboarding.status,
  )

  /** Personal workspace stays usable while org join request awaits admin approval. */
  const limitedShellWhileJoinPending =
    onboarding.status === 'join_pending' &&
    (onboarding.limitedShellAllowed ||
      onboarding.activeMembershipCount > 0 ||
      Boolean(progress?.personal_workspace_created))

  /**
   * WAC status drives completion: `active` = done (including legacy users who onboarded
   * before corporate_setup_pending existed). Only `corporate_setup_pending` keeps users
   * in the wizard after personal workspace creation (step 1 → step 2).
   */
  const hasBackendCorporateOnboardingComplete =
    isCorporateEmail &&
    (onboarding.status === 'active' ||
      (!emailVerificationRequired &&
        !adminApprovalRequired &&
        onboarding.status === 'join_pending'))

  useEffect(() => {
    if (!subjectId || !isCorporateEmail) return
    if (progress?.personal_workspace_created) {
      markCorporatePersonalWorkspaceCreated(subjectId)
    }
    if (!hasBackendCorporateOnboardingComplete) return
    markCorporateJoinStepCompleted(subjectId)
    markCorporateWizardComplete(subjectId)
    clearCorporateEmailVerificationPending(subjectId)
  }, [
    subjectId,
    isCorporateEmail,
    hasBackendCorporateOnboardingComplete,
    progress?.personal_workspace_created,
  ])

  const corporateWizardIncomplete =
    isCorporateEmail &&
    Boolean(subjectId) &&
    !hasBackendCorporateOnboardingComplete &&
    !isCorporateWizardComplete(subjectId) &&
    onboarding.status !== 'join_pending' &&
    onboarding.status !== 'blocked'

  const unmatchedSetupIncomplete =
    isCorporateEmail &&
    !progress?.matched &&
    Boolean(subjectId) &&
    (!isCorporatePersonalWorkspaceCreated(subjectId) ||
      !isCorporateJoinStepCompleted(subjectId) ||
      !isCorporateWizardComplete(subjectId))

  const shouldCompleteCorporateSetup =
    corporateWizardIncomplete &&
    (unmatchedSetupIncomplete ||
      (Boolean(progress?.matched) &&
        (!progress?.personal_workspace_created ||
          onboarding.status === 'corporate_setup_pending' ||
          progress?.setup_phase === 'personal' ||
          progress?.setup_phase === 'optional_join' ||
          !isCorporateJoinStepCompleted(subjectId ?? ''))))

  const joinStepResolved =
    Boolean(subjectId && isCorporateJoinStepCompleted(subjectId)) ||
    onboarding.status === 'join_pending' ||
    onboarding.status === 'email_verify_pending' ||
    Boolean(progress?.org_workspace_joined)

  const shouldShowEmailVerification =
    emailVerificationPathActive &&
    (joinStepResolved ||
      onboarding.status === 'email_verify_pending' ||
      progress?.setup_phase === 'email_verify') &&
    (onboarding.status === 'email_verify_pending' ||
      Boolean(subjectId && isCorporateEmailVerificationPending(subjectId)) ||
      progress?.setup_phase === 'email_verify')

  const shouldShowOnboardingStatus =
    onboarding.status === 'blocked' ||
    shouldShowEmailVerification ||
    (emailVerificationPathActive && onboarding.status === 'join_pending') ||
    (adminApprovalRequired && onboarding.status === 'join_pending' && !limitedShellWhileJoinPending)

  const onboardingStatusReason = shouldShowEmailVerification
    ? 'email_verify_pending'
    : onboarding.status === 'join_pending'
      ? 'join_pending'
      : onboarding.status === 'blocked'
        ? 'blocked'
        : null

  const shouldShowOnboardingWizard =
    !shouldShowEmailVerification &&
    onboarding.status !== 'email_verify_pending' &&
    onboarding.status !== 'active' &&
    (onboarding.status === 'none' ||
      onboarding.status === 'corporate_setup_pending' ||
      shouldCompleteCorporateSetup ||
      corporateWizardIncomplete)

  const corporateOnboardingFinished =
    !isCorporateEmail ||
    hasBackendCorporateOnboardingComplete ||
    limitedShellWhileJoinPending ||
    Boolean(
      subjectId &&
        isCorporateWizardComplete(subjectId) &&
        (emailVerificationPathActive
          ? !isCorporateEmailVerificationPending(subjectId) && onboarding.status === 'active'
          : adminApprovalRequired
            ? onboarding.status === 'active'
            : onboarding.status === 'active' || onboarding.status === 'join_pending'),
    )

  const requiresOnboardingGate =
    !onboarding.bypass &&
    onboarding.enabled &&
    (onboarding.statusUnavailable ||
      (emailVerificationPathActive && onboarding.status === 'email_verify_pending') ||
      onboarding.status === 'corporate_setup_pending' ||
      (emailVerificationPathActive && onboarding.status === 'join_pending') ||
      (adminApprovalRequired && onboarding.status === 'join_pending' && !limitedShellWhileJoinPending) ||
      onboarding.status === 'blocked' ||
      onboarding.status === 'none' ||
      shouldShowOnboardingWizard ||
      shouldShowOnboardingStatus ||
      (isCorporateEmail && !corporateOnboardingFinished))

  const canAccessMainApp =
    (onboarding.status === 'active' || limitedShellWhileJoinPending) &&
    !requiresOnboardingGate &&
    (!isCorporateEmail || corporateOnboardingFinished)

  return {
    loading,
    bypass: onboarding.bypass,
    status: onboarding.status,
    progress,
    limitedShellWhileJoinPending,
    isCorporateEmail,
    shouldCompleteCorporateSetup,
    shouldShowEmailVerification,
    shouldShowOnboardingStatus,
    shouldShowOnboardingWizard,
    canAccessMainApp,
    requiresOnboardingGate,
    onboardingStatusReason,
    refetchProgress: () => void progressQuery.refetch(),
  }
}

export type { CorporateOnboardingProgress }
