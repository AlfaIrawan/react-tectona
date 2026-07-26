import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppAccessGate } from '@/auth/useAppAccessGate'

const BYPASS_PATHS = new Set(['/no-workspace-access'])

/**
 * After authentication, blocks users without workspace membership (unless platform admin).
 * `/no-workspace-access` is always reachable when authenticated.
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
      <div className="flex min-h-screen items-center justify-center bg-background" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">Checking workspace access</span>
      </div>
    )
  }

  if (!hasAppAccess) {
    return <Navigate to="/no-workspace-access" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
