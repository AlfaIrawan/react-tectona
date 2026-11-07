import { useState } from 'react'
import { getSession } from '@/auth/authService'
import { OnboardingUnavailable } from '@/auth/OnboardingUnavailable'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { PlatformRouteLoadingFallback } from '@/components/loading'
import { useAppAccessGate } from '@/auth/useAppAccessGate'
import { isOnboardingEnabled } from '@/lib/onboardingFeature'

const BYPASS_PATHS = new Set(['/no-workspace-access'])

/**
 * After authentication, blocks users without workspace membership (unless platform admin).
 * When onboarding is enabled, redirects to `/onboarding` instead of dead-end page.
 */
export function AppAccessGate() {
  const location = useLocation()
  const { loading, gateEnabled, hasAppAccess, statusUnavailable, refetch, retrying } = useAppAccessGate()

  const identity = `${getSession()?.user.id ?? ''}:${location.pathname}${location.search}${location.hash}`
  const [mountedIdentity, setMountedIdentity] = useState<string | null>(null)
  const verified = BYPASS_PATHS.has(location.pathname) || !gateEnabled || (!loading && !statusUnavailable && hasAppAccess)
  if (verified && mountedIdentity !== identity) setMountedIdentity(identity)
  else if (!verified && !statusUnavailable && mountedIdentity !== null) setMountedIdentity(null)

  if (verified || statusUnavailable) {
    return (
      <>
        <div hidden={statusUnavailable} inert={statusUnavailable} style={{ display: statusUnavailable ? 'none' : 'contents' }}>
          {(verified || mountedIdentity === identity) && <Outlet />}
        </div>
        {statusUnavailable && <OnboardingUnavailable onRetry={refetch} retrying={retrying} />}
      </>
    )
  }

  if (BYPASS_PATHS.has(location.pathname)) {
    return <Outlet />
  }

  if (!gateEnabled) {
    return <Outlet />
  }

  if (loading) {
    return (
      <PlatformRouteLoadingFallback
        title="Loading page…"
        description="Checking workspace access."
      />
    )
  }

  if (!hasAppAccess) {
    const target = isOnboardingEnabled() ? '/onboarding' : '/no-workspace-access'
    return <Navigate to={target} replace state={{ returnTo: location.pathname + location.search + location.hash }} />
  }

  return <Outlet />
}
