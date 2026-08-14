import { Navigate, Outlet } from 'react-router-dom'
import { PlatformRouteLoadingFallback } from '@/components/loading'
import { getSession } from '@/auth/authService'
import { useCorporateOnboardingRouting } from '@/auth/useCorporateOnboardingRouting'
import { isCorporateEmailFinishMethodSelected } from '@/lib/corporateOnboardingSession'
import { isCorporateEmailVerificationRequired, isCorporateAdminApprovalRequired } from '@/lib/onboardingFeature'

/**
 * Blocks the application shell until onboarding is complete.
 * Platform admins bypass. Onboarding routes live outside this gate.
 */
export function OnboardingGate() {
  const {
    loading,
    bypass,
    status,
    limitedShellWhileJoinPending,
    shouldShowOnboardingStatus,
    shouldShowOnboardingWizard,
    shouldShowEmailVerification,
    onboardingStatusReason,
    requiresOnboardingGate,
  } = useCorporateOnboardingRouting()

  if (bypass) {
    return <Outlet />
  }

  if (loading) {
    return (
      <PlatformRouteLoadingFallback
        title="Loading page…"
        description="Checking onboarding status."
      />
    )
  }

  if (status === 'personal_provisioning') {
    return (
      <PlatformRouteLoadingFallback
        title="Loading page…"
        description="Setting up your personal workspace."
      />
    )
  }

  const session = getSession()
  const emailVerificationPathActive =
    isCorporateEmailVerificationRequired() ||
    status === 'email_verify_pending' ||
    isCorporateEmailFinishMethodSelected(session?.user.id)

  if (requiresOnboardingGate) {
    if (
      emailVerificationPathActive &&
      (shouldShowEmailVerification || status === 'email_verify_pending')
    ) {
      return <Navigate to="/onboarding/status?reason=email_verify_pending" replace />
    }
    if (shouldShowOnboardingWizard || status === 'corporate_setup_pending' || status === 'none') {
      return <Navigate to="/onboarding" replace />
    }
    if (
      shouldShowOnboardingStatus ||
      status === 'blocked' ||
      (emailVerificationPathActive && status === 'join_pending') ||
      (isCorporateAdminApprovalRequired() && status === 'join_pending' && !limitedShellWhileJoinPending)
    ) {
      const reason =
        onboardingStatusReason ??
        (status === 'join_pending' || status === 'blocked' ? status : 'email_verify_pending')
      return <Navigate to={`/onboarding/status?reason=${reason}`} replace />
    }
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
