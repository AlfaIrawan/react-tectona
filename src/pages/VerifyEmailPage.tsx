import { useEffect, useState, type ReactNode } from 'react'
import { Loader2, MailCheck } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { getSession } from '@/auth/authService'
import { verifyEmailToken, confirmEmailVerifiedOnboarding } from '@/lib/api/onboardingApi'
import {
  clearCorporateEmailVerificationPending,
  markCorporateJoinStepCompleted,
  markCorporateWizardComplete,
  storePendingEmailVerifiedOnboarding,
} from '@/lib/corporateOnboardingSession'

function VerifyShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(180deg, #dcd6c8 0%, #efece3 42%, #e8e4d9 100%)' }}
    >
      <div className="w-full max-w-[520px] overflow-hidden rounded-sm shadow-2xl">
        <div className="h-[5px] bg-[#c9a227]" />
        <div className="bg-[#0b1f3a] px-8 py-8 text-center">
          <img
            src="/images/logo-white.png"
            alt="Tectona"
            className="mx-auto h-14 w-auto object-contain"
          />
          <p className="mt-3 text-[11px] uppercase tracking-[0.36em] text-[#c9a227]">
            Project Management Platform
          </p>
        </div>
        <div className="bg-[#fffcf7] px-8 py-8 space-y-5 text-center">{children}</div>
      </div>
    </div>
  )
}

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const token = searchParams.get('token') ?? ''
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [verified, setVerified] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('')
  const [needsSignIn, setNeedsSignIn] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('This confirmation link is missing a token. Open the latest email from Tectona and use Confirm email.')
      setLoading(false)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const result = await verifyEmailToken(token)
        if (!result.verified || !result.workspace_id || !result.subject_id || !result.app_id) {
          throw new Error('This confirmation link could not be completed. Request a new verification email.')
        }

        const pending = {
          appId: result.app_id,
          workspaceId: result.workspace_id,
          subjectId: result.subject_id,
        }
        clearCorporateEmailVerificationPending(result.subject_id)
        markCorporateJoinStepCompleted(result.subject_id)
        markCorporateWizardComplete(result.subject_id)

        const session = getSession()
        if (session?.token && session.user.id === result.subject_id) {
          await confirmEmailVerifiedOnboarding(pending)
        } else {
          storePendingEmailVerifiedOnboarding(pending)
        }

        if (cancelled) return

        const label = result.workspace_name ?? result.organization_name ?? 'your organization'
        setWorkspaceName(label)
        setNeedsSignIn(!session?.token)
        setVerified(true)
        await queryClient.invalidateQueries({ queryKey: ['tectona-onboarding-status'] })
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Email verification failed.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token, queryClient])

  if (loading) {
    return (
      <VerifyShell>
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#0b1f3a]" aria-hidden />
        <p className="text-sm text-[#6b6254]">Confirming your email…</p>
      </VerifyShell>
    )
  }

  if (error) {
    return (
      <VerifyShell>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c9a227]">Email confirmation</p>
        <h1 className="font-serif text-2xl text-[#0b1f3a]">Link could not be confirmed</h1>
        <p className="text-sm leading-relaxed text-[#4a453c]">{error}</p>
        <Link
          to="/login"
          className="inline-block bg-[#0b1f3a] px-8 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#f7efd4]"
        >
          Go to sign-in
        </Link>
      </VerifyShell>
    )
  }

  if (verified) {
    return (
      <VerifyShell>
        <MailCheck className="mx-auto h-10 w-10 text-[#c9a227]" aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c9a227]">Email confirmation</p>
        <h1 className="font-serif text-2xl text-[#0b1f3a]">Email verified</h1>
        <p className="text-sm leading-relaxed text-[#4a453c]">
          You have confirmed access to <span className="font-medium text-[#0b1f3a]">{workspaceName}</span>.
          {needsSignIn
            ? ' Sign in with the same account to continue.'
            : ' You can continue in Tectona.'}
        </p>
        <Link
          to={needsSignIn ? '/login?reason=email_verified' : '/onboarding'}
          className="inline-block bg-[#0b1f3a] px-8 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#f7efd4]"
        >
          {needsSignIn ? 'Sign in' : 'Continue'}
        </Link>
      </VerifyShell>
    )
  }

  return null
}
