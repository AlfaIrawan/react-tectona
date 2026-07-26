import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ensureFreshSession, logout } from '@/auth/authService'
import { emitSessionActive } from '@/auth/sessionEvents'
import { useMyPresenceStore } from '@/stores/my-presence-store'
import { buildLoginSearchParams } from '@/auth/loginRedirect'
import { onSessionExpired } from '@/auth/sessionEvents'

const PROACTIVE_REFRESH_INTERVAL_MS = 60_000

interface SessionProviderProps {
  children: React.ReactNode
}

/**
 * Keeps OIDC access tokens fresh while the app is open and redirects on hard session loss.
 */
export function SessionProvider({ children }: SessionProviderProps) {
  const navigate = useNavigate()

  useEffect(() => {
    void ensureFreshSession().then((session) => {
      if (session) {
        useMyPresenceStore.getState().setStatus('online')
        emitSessionActive()
      }
    })
    const interval = window.setInterval(() => {
      void ensureFreshSession()
    }, PROACTIVE_REFRESH_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    return onSessionExpired(() => {
      logout()
      if (typeof window === 'undefined') return

      const onLoginPage = window.location.pathname.startsWith('/login')
      const returnPath = onLoginPage
        ? null
        : `${window.location.pathname}${window.location.search}`

      const params = buildLoginSearchParams({
        next: returnPath,
        reason: 'session_expired',
      })
      navigate(`/login?${params.toString()}`, { replace: true })
    })
  }, [navigate])

  return <>{children}</>
}
