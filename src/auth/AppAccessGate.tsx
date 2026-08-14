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
  const { loading, gateEnabled, hasAppAccess } = useAppAccessGate()

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
    return <Navigate to={target} replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
