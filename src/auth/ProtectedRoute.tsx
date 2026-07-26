import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { ensureFreshSession } from './authService'
import { sanitizePostLoginPath } from './loginRedirect'

/**
 * Requires a valid identity-lite session. Uses layout route pattern with Outlet.
 */
export function ProtectedRoute() {
  const location = useLocation()
  const [checking, setChecking] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    let cancelled = false
    ensureFreshSession()
      .then((session) => {
        if (!cancelled) {
          setAuthenticated(session != null)
          setChecking(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthenticated(false)
          setChecking(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">Loading session</span>
      </div>
    )
  }

  if (!authenticated) {
    const next = sanitizePostLoginPath(location.pathname + location.search)
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }

  return <Outlet />
}
