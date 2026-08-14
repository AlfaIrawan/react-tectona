import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { PlatformRouteLoadingFallback } from '@/components/loading'
import { maintainActiveSession, attemptSilentSso, getSession } from './authService'
import { onSessionActive, onSessionCleared, onSessionExpired } from './sessionEvents'
import { sanitizePostLoginPath } from './loginRedirect'
import { TenantContextProvider } from './TenantContext'
import { UserWorkspaceOptionsProvider } from '@/modules/core-shell/hooks/useUserWorkspaceOptions'

const SESSION_VERIFY_TIMEOUT_MS = 15_000

/**
 * Requires a valid identity-lite session. Uses layout route pattern with Outlet.
 */
export function ProtectedRoute() {
  const location = useLocation()
  const [checking, setChecking] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    let cancelled = false

    const verify = () => {
      setChecking(true)
      const verifySession = maintainActiveSession({ forceStatusCheck: true }).then(async () => {
        let session = getSession()
        if (!session) {
          session = await attemptSilentSso()
        }
        return session
      })
      const timeout = new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), SESSION_VERIFY_TIMEOUT_MS)
      })

      void Promise.race([verifySession, timeout])
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
    }

    verify()

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) verify()
    }
    window.addEventListener('pageshow', onPageShow)

    const stopActive = onSessionActive(() => {
      if (!cancelled) {
        setAuthenticated(getSession() != null)
        setChecking(false)
      }
    })
    const stopCleared = onSessionCleared(() => {
      if (!cancelled) {
        setAuthenticated(false)
        setChecking(false)
      }
    })
    const stopExpired = onSessionExpired(() => {
      if (!cancelled) {
        setAuthenticated(false)
        setChecking(false)
      }
    })

    return () => {
      cancelled = true
      stopActive()
      stopCleared()
      stopExpired()
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])

  if (checking) {
    return (
      <PlatformRouteLoadingFallback
        title="Loading page…"
        description="Verifying your Tectona session."
      />
    )
  }

  if (!authenticated) {
    const next = sanitizePostLoginPath(location.pathname + location.search)
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }

  return (
    <TenantContextProvider>
      <UserWorkspaceOptionsProvider>
        <Outlet />
      </UserWorkspaceOptionsProvider>
    </TenantContextProvider>
  )
}
