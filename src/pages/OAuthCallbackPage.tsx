import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PlatformRouteLoadingFallback } from '@/components/loading'
import { loginWithAuthorizationCode, getSession, logoutAsync } from '@/auth/authService'
import { sanitizePostLoginPath, buildLoginSearchParams } from '@/auth/loginRedirect'
import { formatAuthErrorMessage, formatOAuthExchangeError } from '@/lib/authErrorMessages'
import { clearOAuthSession, readOAuthSession, readOAuthIntent } from '@/lib/oauthPkce'
import { clearOAuthProvider, persistAuthMethod, readOAuthProvider } from '@/lib/authMethodSession'
import { isExistingAccountForOAuthSignup } from '@/lib/oauthSignupGuard'
import { fetchOnboardingStatus } from '@/lib/api/onboardingApi'
import { TECTONA_WAC_APP_ID } from '@/lib/api/workspaceAccessControlApi'
import { SessionConflictModal } from '@/modules/auth/components/SessionConflictModal'
import { isSessionConflictError, type ActiveSessionInfo } from '@/lib/sessionConflict'
import { OidcTokenExchangeError } from '@/lib/api/identityApi'

const OAUTH_PROCESSED_CODE_KEY = 'tectona:oauth-processed-code'
const OAUTH_PENDING_CONFLICT_KEY = 'tectona:oauth-pending-conflict'
const OAUTH_EXCHANGE_LOCK_PREFIX = 'tectona:oauth-exchange:'

type PendingOAuthConflict = {
  code: string
  redirectUri: string
  verifier: string
  next: string
  activeSession: ActiveSessionInfo
}

function readPendingConflict(code: string): PendingOAuthConflict | null {
  try {
    const raw = sessionStorage.getItem(OAUTH_PENDING_CONFLICT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingOAuthConflict
    return parsed.code === code ? parsed : null
  } catch {
    return null
  }
}

function writePendingConflict(payload: PendingOAuthConflict): void {
  sessionStorage.setItem(OAUTH_PENDING_CONFLICT_KEY, JSON.stringify(payload))
}

function clearPendingConflict(): void {
  sessionStorage.removeItem(OAUTH_PENDING_CONFLICT_KEY)
}

function exchangeLockKey(code: string): string {
  return `${OAUTH_EXCHANGE_LOCK_PREFIX}${code}`
}

function isOAuthInvalidGrant(err: unknown): boolean {
  if (err instanceof OidcTokenExchangeError && err.errorCode === 'invalid_grant') return true
  const raw = err instanceof Error ? err.message : String(err)
  const lower = raw.toLowerCase()
  return lower.includes('invalid_grant') || lower.includes('incorrect email or password')
}

export function OAuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [conflictOpen, setConflictOpen] = useState(false)
  const [conflictSession, setConflictSession] = useState<ActiveSessionInfo | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const oauthContextRef = useRef<{
    code: string
    redirectUri: string
    verifier: string
    next: string
  } | null>(null)
  const exchangeInFlightRef = useRef(false)

  const openConflictState = (ctx: PendingOAuthConflict) => {
    oauthContextRef.current = {
      code: ctx.code,
      redirectUri: ctx.redirectUri,
      verifier: ctx.verifier,
      next: ctx.next,
    }
    setConflictSession(ctx.activeSession)
    setConflictOpen(true)
    setError('')
    setActionError('')
  }

  const redirectToLoginAfterOAuthFailure = (next: string) => {
    clearOAuthSession()
    clearPendingConflict()
    const params = buildLoginSearchParams({ next, reason: 'oauth_signin_retry' })
    navigate(`/login?${params.toString()}`, { replace: true })
  }

  const redirectToLoginForExistingAccount = () => {
    clearOAuthSession()
    clearPendingConflict()
    const params = buildLoginSearchParams({ reason: 'account_already_exists' })
    navigate(`/login?${params.toString()}`, { replace: true })
  }

  const attemptOAuthLogin = async (replaceExisting = false) => {
    const ctx = oauthContextRef.current
    if (!ctx) {
      setActionError('Sign-in context expired. Go back and sign in with Microsoft again.')
      return
    }
    if (exchangeInFlightRef.current) return
    exchangeInFlightRef.current = true
    setIsSubmitting(true)
    setError('')
    setActionError('')
    sessionStorage.setItem(exchangeLockKey(ctx.code), 'in-flight')
    try {
      await loginWithAuthorizationCode(
        ctx.code,
        ctx.redirectUri,
        ctx.verifier,
        replaceExisting ? { sessionPolicy: 'replace' } : undefined,
      )
      const oauthIntent = readOAuthIntent()
      if (oauthIntent === 'signup') {
        const session = getSession()
        if (session?.user.id) {
          try {
            const onboarding = await fetchOnboardingStatus(TECTONA_WAC_APP_ID, session.user.id)
            if (isExistingAccountForOAuthSignup(onboarding)) {
              clearPendingConflict()
              sessionStorage.removeItem(exchangeLockKey(ctx.code))
              sessionStorage.setItem(OAUTH_PROCESSED_CODE_KEY, ctx.code)
              await logoutAsync()
              setConflictOpen(false)
              redirectToLoginForExistingAccount()
              return
            }
          } catch {
            /* status unavailable — treat as new registration */
          }
        }
      }
      clearPendingConflict()
      sessionStorage.removeItem(exchangeLockKey(ctx.code))
      clearOAuthSession()
      const oauthProvider = readOAuthProvider()
      if (oauthProvider) persistAuthMethod(oauthProvider)
      clearOAuthProvider()
      sessionStorage.setItem(OAUTH_PROCESSED_CODE_KEY, ctx.code)
      setConflictOpen(false)
      navigate(ctx.next, { replace: true })
    } catch (err) {
      if (isSessionConflictError(err)) {
        writePendingConflict({
          code: ctx.code,
          redirectUri: ctx.redirectUri,
          verifier: ctx.verifier,
          next: ctx.next,
          activeSession: err.activeSession,
        })
        sessionStorage.setItem(exchangeLockKey(ctx.code), 'conflict')
        setConflictSession(err.activeSession)
        setConflictOpen(true)
        if (replaceExisting) {
          setActionError('Could not replace the existing session. Try again or keep the other session.')
        }
        return
      }
      sessionStorage.removeItem(OAUTH_PROCESSED_CODE_KEY)
      sessionStorage.removeItem(exchangeLockKey(ctx.code))
      clearPendingConflict()
      const rawMsg = err instanceof Error ? err.message : 'OAuth sign-in failed.'
      const httpStatus = err instanceof OidcTokenExchangeError ? err.httpStatus : undefined
      const isInvalidGrant = isOAuthInvalidGrant(err)
      const msg = isInvalidGrant
        ? formatOAuthExchangeError('invalid_grant', httpStatus)
        : formatOAuthExchangeError(rawMsg, httpStatus)
      if (replaceExisting && isInvalidGrant) {
        sessionStorage.removeItem(exchangeLockKey(ctx.code))
        sessionStorage.removeItem(OAUTH_PROCESSED_CODE_KEY)
        redirectToLoginAfterOAuthFailure(ctx.next)
        return
      }
      if (replaceExisting) {
        setActionError(msg)
        return
      }
      if (isInvalidGrant) {
        sessionStorage.removeItem(exchangeLockKey(ctx.code))
        sessionStorage.removeItem(OAUTH_PROCESSED_CODE_KEY)
        redirectToLoginAfterOAuthFailure(ctx.next)
        return
      }
      setConflictOpen(false)
      setError(msg)
    } finally {
      exchangeInFlightRef.current = false
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const oauthError = searchParams.get('error')
    const next = sanitizePostLoginPath(sessionStorage.getItem('tectona:oauth-next') ?? '/')

    if (oauthError === 'account_not_registered') {
      clearOAuthSession()
      clearPendingConflict()
      const params = buildLoginSearchParams({ reason: 'account_not_registered' })
      navigate(`/login?${params.toString()}`, { replace: true })
      return
    }
    if (oauthError) {
      setError(formatAuthErrorMessage(searchParams.get('error_description') ?? oauthError))
      return
    }
    if (!code) {
      setError('Authorization code not found.')
      return
    }

    const processedCode = sessionStorage.getItem(OAUTH_PROCESSED_CODE_KEY)
    if (processedCode === code && getSession()) {
      sessionStorage.removeItem('tectona:oauth-next')
      sessionStorage.removeItem(OAUTH_PROCESSED_CODE_KEY)
      clearPendingConflict()
      clearOAuthSession()
      navigate(next, { replace: true })
      return
    }

    const pendingConflict = readPendingConflict(code)
    if (pendingConflict) {
      openConflictState(pendingConflict)
      return
    }

    const exchangeLock = sessionStorage.getItem(exchangeLockKey(code))
    if (exchangeLock === 'conflict') {
      const lockedPending = readPendingConflict(code)
      if (lockedPending) openConflictState(lockedPending)
      return
    }
    if (exchangeLock === 'in-flight') {
      const retryPending = readPendingConflict(code)
      if (retryPending) {
        openConflictState(retryPending)
      }
      return
    }

    const { verifier, state: expectedState } = readOAuthSession()
    if (!verifier) {
      if (getSession()) {
        sessionStorage.removeItem('tectona:oauth-next')
        navigate(next, { replace: true })
        return
      }
      setError('OAuth session expired. Please sign in again.')
      return
    }
    if (expectedState && state && expectedState !== state) {
      setError('Invalid OAuth state.')
      return
    }

    if (processedCode === code) {
      return
    }

    const redirectUri = `${window.location.origin}/login/oauth/callback`
    sessionStorage.removeItem('tectona:oauth-next')

    oauthContextRef.current = { code, redirectUri, verifier, next }
    sessionStorage.setItem(exchangeLockKey(code), 'in-flight')
    void attemptOAuthLogin(false)
  }, [navigate, searchParams])

  useEffect(() => {
    if (conflictOpen) return
    const code = searchParams.get('code')
    if (!code) return
    if (sessionStorage.getItem(exchangeLockKey(code)) !== 'in-flight') return

    const timer = window.setInterval(() => {
      const pending = readPendingConflict(code)
      if (pending) {
        openConflictState(pending)
        window.clearInterval(timer)
      }
    }, 150)

    return () => window.clearInterval(timer)
  }, [conflictOpen, searchParams])

  if (error && !conflictOpen) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4">
        <div className="liquid-glass-enterprise-panel w-full max-w-md mx-auto rounded-lg p-8 space-y-4 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Link to="/login" className="text-sm text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <PlatformRouteLoadingFallback
        title="Loading page…"
        description={conflictOpen ? 'Choose how to continue sign-in.' : 'Completing sign-in.'}
      />
      <SessionConflictModal
        open={conflictOpen}
        busy={isSubmitting}
        actionError={actionError}
        activeSession={conflictSession}
        onUseNewSession={() => void attemptOAuthLogin(true)}
        onKeepExisting={() => {
          const ctx = oauthContextRef.current
          if (ctx) sessionStorage.removeItem(exchangeLockKey(ctx.code))
          clearPendingConflict()
          clearOAuthSession()
          setConflictOpen(false)
          setConflictSession(null)
          setActionError('')
          navigate('/login', { replace: true })
        }}
      />
    </>
  )
}
