import { useState } from 'react'
import { OnboardingUnavailable } from '@/auth/OnboardingUnavailable'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
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
    statusUnavailable,
    retryStatus,
    retrying,
    bypass,
    status,
    limitedShellWhileJoinPending,
    shouldShowOnboardingStatus,
    shouldShowOnboardingWizard,
    shouldShowEmailVerification,
    onboardingStatusReason,
    requiresOnboardingGate,
  } = useCorporateOnboardingRouting()

  const location = useLocation()
  const identity = `${getSession()?.user.id ?? ''}:${location.pathname}${location.search}${location.hash}`
  const [mountedIdentity, setMountedIdentity] = useState<string | null>(null)
  const verified = bypass || (!loading && !statusUnavailable && !requiresOnboardingGate && status !== 'personal_provisioning')
  if (verified && mountedIdentity !== identity) setMountedIdentity(identity)
  else if (!verified && !statusUnavailable && mountedIdentity !== null) setMountedIdentity(null)

  // Keep only an already-mounted page for this identity and URL. Hide and make
  // it inert until a fresh server check succeeds; cached flags never grant access.
  if (verified || statusUnavailable) {
    return (
      <>
        <div hidden={statusUnavailable} inert={statusUnavailable} style={{ display: statusUnavailable ? 'none' : 'contents' }}>
          {(verified || mountedIdentity === identity) && <Outlet />}
        </div>
        {statusUnavailable && <OnboardingUnavailable onRetry={retryStatus} retrying={retrying} />}
      </>
    )
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
      return <Navigate to="/onboarding/status?reason=email_verify_pending" replace state={{ returnTo: location.pathname + location.search + location.hash }} />
    }
    if (shouldShowOnboardingWizard || status === 'corporate_setup_pending' || status === 'none') {
      return <Navigate to="/onboarding" replace state={{ returnTo: location.pathname + location.search + location.hash }} />
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
      return <Navigate to={`/onboarding/status?reason=${reason}`} replace state={{ returnTo: location.pathname + location.search + location.hash }} />
    }
    return <Navigate to="/onboarding" replace state={{ returnTo: location.pathname + location.search + location.hash }} />
  }

  return <Outlet />
}
