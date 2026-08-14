import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Fingerprint } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login, ensureFreshSession, getSession, acknowledgeIntentionalSignOut, loginWithPasskey } from '@/auth/authService'
import { passkeyErrorMessage } from '@/lib/api/webauthnApi'
import {
  parseLoginAuthNotice,
  sanitizePostLoginPath,
  type LoginAuthNotice,
} from '@/auth/loginRedirect'
import { persistAuthMethod } from '@/lib/authMethodSession'
import { AuthSocialProviders } from '@/modules/auth/components/AuthSocialProviders'
import { AuthTransientAlert } from '@/modules/auth/components/AuthTransientAlert'
import { SessionConflictModal } from '@/modules/auth/components/SessionConflictModal'
import {
  isSessionConflictError,
  shouldPromptSessionConflict,
  type ActiveSessionInfo,
} from '@/lib/sessionConflict'
import { cn } from '@/lib/utils'
import { authCardButtonClass, authCardInputClass } from '@/lib/authUiClasses'
import { AuthTourButton } from '@/modules/auth/components/AuthTourButton'
import { AuthCopyrightNotice } from '@/modules/auth/components/AuthCopyrightNotice'

const LOGIN_NOTICE_COPY: Record<LoginAuthNotice, string> = {
  session_expired: 'Your session has expired. Please sign in again.',
  session_revoked_elsewhere:
    'You were signed out because this account was used to sign in on another device or browser.',
  oauth_signin_retry:
    'Microsoft sign-in was interrupted. Click Microsoft below to start again.',
  account_already_exists:
    'This account is already registered. Sign in with your existing credentials instead.',
  account_not_registered:
    'This account is not registered. Sign up first before signing in with Microsoft.',
  check_email:
    'We sent a confirmation link to your email. Verify your email before signing in — you cannot access Tectona until the link is confirmed.',
  email_verified:
    'Your email is verified and you have joined your organization. Sign in to continue.',
}

function readInitialAuthNotice(): LoginAuthNotice | null {
  if (typeof window === 'undefined') return null
  return parseLoginAuthNotice(new URLSearchParams(window.location.search).get('reason')) ?? null
}

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  const [conflictSession, setConflictSession] = useState<ActiveSessionInfo | null>(null)
  const [pendingCredentials, setPendingCredentials] = useState<{ email: string; password: string } | null>(null)
  const [authNotice] = useState<LoginAuthNotice | null>(readInitialAuthNotice)

  const localSession = getSession()
  const signedInAs = localSession?.user.email?.trim() || null
  const next = sanitizePostLoginPath(searchParams.get('next'))

  useEffect(() => {
    if (authNotice) {
      const params = new URLSearchParams(window.location.search)
      params.delete('reason')
      const query = params.toString()
      navigate({ pathname: '/login', search: query ? `?${query}` : '' }, { replace: true })
      return
    }
    acknowledgeIntentionalSignOut()
  }, [authNotice, navigate])

  useEffect(() => {
    if (authNotice) return
    let cancelled = false
    ensureFreshSession()
      .then((session) => {
        if (!cancelled && session) navigate(next, { replace: true })
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Sign-in service is not responding. Restart identity-lite, then try again.',
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [navigate, next, authNotice])

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const isEmailValid = email.length === 0 || emailRegex.test(email)
  const isPasswordValid = password.length > 0
  const isFormValid = isEmailValid && isPasswordValid && !isSubmitting

  const completeLogin = async (loginEmail: string, loginPassword: string, replaceExisting = false) => {
    const replaceStaleServerSession =
      replaceExisting
      || authNotice === 'session_expired'
      || authNotice === 'session_revoked_elsewhere'
    await login(
      loginEmail,
      loginPassword,
      replaceStaleServerSession ? { sessionPolicy: 'replace' } : undefined,
    )
    persistAuthMethod('password')
    setConflictOpen(false)
    setPendingCredentials(null)
    navigate(next, { replace: true })
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    if (!isFormValid) {
      return
    }

    setIsSubmitting(true)

    try {
      await completeLogin(email, password)
    } catch (err) {
      if (isSessionConflictError(err)) {
        if (!shouldPromptSessionConflict(err.activeSession)) {
          await completeLogin(email, password, true)
          return
        }
        setPendingCredentials({ email, password })
        setConflictSession(err.activeSession)
        setConflictOpen(true)
        return
      }
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePasskeyLogin = async () => {
    setError('')
    setIsSubmitting(true)
    try {
      await loginWithPasskey()
      navigate(next, { replace: true })
    } catch (err) {
      setError(passkeyErrorMessage(err, 'signin'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUseNewSession = async () => {
    if (!pendingCredentials) return
    setIsSubmitting(true)
    setError('')
    try {
      await completeLogin(pendingCredentials.email, pendingCredentials.password, true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="min-h-screen w-full flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto">
          <div className="glass-card rounded-lg shadow-2xl p-8 space-y-6">
            <div id="login-card-header" className="space-y-2 text-center">
              <img
                src="/images/logo.png"
                alt="Tectona"
                className="mx-auto h-24 w-auto object-contain"
              />
              <p className="text-sm text-muted-foreground">
                Sign in to your account
              </p>
            </div>

            {authNotice && !error && (
              <div
                className={cn(
                  'px-4 py-3 rounded-md text-sm border',
                  authNotice === 'session_revoked_elsewhere'
                    ? 'bg-sky-500/10 border-sky-500/30 text-sky-950 dark:text-sky-100'
                    :                   authNotice === 'email_verified'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100'
                    : authNotice === 'account_not_registered'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-100'
                      : authNotice === 'check_email'
                      || authNotice === 'oauth_signin_retry'
                      || authNotice === 'account_already_exists'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-100'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-100',
                )}
                role="status"
              >
                {LOGIN_NOTICE_COPY[authNotice]}
              </div>
            )}

            {signedInAs && !authNotice && (
              <div className="rounded-md border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                This browser is signed in as{' '}
                <span className="font-medium text-foreground">{signedInAs}</span>. Signing in with a
                different email switches to that account.
              </div>
            )}

            <AuthTransientAlert message={error} onDismiss={() => setError('')} />

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError('')
                  }}
                  className={cn(
                    authCardInputClass,
                    !isEmailValid && email.length > 0 && 'border-destructive focus-visible:ring-destructive',
                  )}
                  disabled={isSubmitting}
                  autoComplete="email"
                  required
                />
                {!isEmailValid && email.length > 0 && (
                  <p className="text-xs text-destructive">Please enter a valid email address</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError('')
                    }}
                    disabled={isSubmitting}
                    autoComplete="current-password"
                    required
                    className={cn(authCardInputClass, 'pr-10')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    disabled={isSubmitting}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                id="login-submit"
                type="submit"
                className={authCardButtonClass}
                disabled={!isFormValid}
              >
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>

            <Button
              id="login-passkey"
              type="button"
              variant="outline"
              className={cn(authCardButtonClass, 'mt-3')}
              onClick={() => void handlePasskeyLogin()}
              disabled={isSubmitting}
            >
              <Fingerprint className="h-4 w-4" />
              Sign in with a passkey
            </Button>

            <AuthSocialProviders id="login-social" mode="signin" />

            <p id="login-signup-link" className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <a href="/register" className="text-primary hover:underline" onClick={(e) => { e.preventDefault(); navigate('/register') }}>
                Sign up
              </a>
            </p>
          </div>
        </div>
      </div>

      <AuthTourButton page="login" />
      <AuthCopyrightNotice />

      <SessionConflictModal
        open={conflictOpen}
        busy={isSubmitting}
        accountEmail={pendingCredentials?.email}
        activeSession={conflictSession}
        onUseNewSession={() => void handleUseNewSession()}
        onKeepExisting={() => {
          setConflictOpen(false)
          setPendingCredentials(null)
          setConflictSession(null)
        }}
      />
    </>
  )
}
