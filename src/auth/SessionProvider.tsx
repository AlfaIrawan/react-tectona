import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { maintainActiveSession, clearSession, getSession, shouldPropagateSessionExpired } from '@/auth/authService'
import { emitSessionActive } from '@/auth/sessionEvents'
import { useMyPresenceStore } from '@/stores/my-presence-store'
import { buildLoginSearchParams, resolveLoginAuthNoticeReason } from '@/auth/loginRedirect'
import { onSessionExpired, onSessionActive, onSessionCleared } from '@/auth/sessionEvents'
import { initIdentitySessionRealtime } from '@/lib/sessionRealtime'
import { initNotificationRealtime } from '@/lib/notificationRealtime'

/** Fallback poll when WebSocket is unavailable (offline / proxy issue). */
const SESSION_MAINTENANCE_INTERVAL_MS = 30_000

interface SessionProviderProps {
  children: React.ReactNode
}

/**
 * Keeps OIDC access tokens fresh while the app is open and redirects on hard session loss.
 */
export function SessionProvider({ children }: SessionProviderProps) {
  const navigate = useNavigate()

  useEffect(() => {
    let stopRealtime = () => {}
    let stopNotificationRealtime = () => {}
    const startRealtime = () => {
      stopRealtime()
      stopNotificationRealtime()
      if (getSession()) {
        stopRealtime = initIdentitySessionRealtime()
        stopNotificationRealtime = initNotificationRealtime()
      }
    }

    void maintainActiveSession({ forceStatusCheck: true }).then(() => {
      if (getSession()) {
        useMyPresenceStore.getState().setStatus('online')
        emitSessionActive()
        startRealtime()
      }
    })

    const stopSessionActive = onSessionActive(startRealtime)
    const stopSessionCleared = onSessionCleared(() => {
      stopRealtime()
      stopNotificationRealtime()
      stopRealtime = () => {}
      stopNotificationRealtime = () => {}
    })

    const runMaintenance = (forceStatusCheck: boolean) => {
      void maintainActiveSession({ forceStatusCheck })
    }

    const interval = window.setInterval(
      () => runMaintenance(true),
      SESSION_MAINTENANCE_INTERVAL_MS,
    )

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runMaintenance(true)
      }
    }

    const onWindowFocus = () => runMaintenance(true)

    /** BFCache restore can replay a stale in-memory session; re-validate before API queries run. */
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        runMaintenance(true)
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onWindowFocus)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      stopSessionActive()
      stopSessionCleared()
      stopRealtime()
      stopNotificationRealtime()
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onWindowFocus)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])

  useEffect(() => {
    return onSessionExpired((detail) => {
      if (!shouldPropagateSessionExpired()) return

      clearSession()
      if (typeof window === 'undefined') return

      const onLoginPage = window.location.pathname.startsWith('/login')
      const returnPath = onLoginPage
        ? null
        : `${window.location.pathname}${window.location.search}`

      const authNotice = resolveLoginAuthNoticeReason(detail)
      if (!authNotice) return

      const params = buildLoginSearchParams({
        next: returnPath,
        reason: authNotice,
      })
      navigate(`/login?${params.toString()}`, { replace: true })
    })
  }, [navigate])

  return <>{children}</>
}
