import { useEffect, useState } from 'react'
import { Loader2, MailCheck } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { verifyEmailToken, confirmEmailVerifiedOnboarding } from '@/lib/api/onboardingApi'
import {
  clearCorporateEmailVerificationPending,
  markCorporateJoinStepCompleted,
  markCorporateWizardComplete,
} from '@/lib/corporateOnboardingSession'
import { authCardButtonClass } from '@/lib/authUiClasses'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const token = searchParams.get('token') ?? ''
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [verified, setVerified] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('')

  useEffect(() => {
    if (!token) {
      setError('Missing verification token.')
      setLoading(false)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const result = await verifyEmailToken(token)
        if (!result.verified || !result.workspace_id || !result.subject_id || !result.app_id) {
          throw new Error('Invalid verification response.')
        }

        await confirmEmailVerifiedOnboarding({
          appId: result.app_id,
          workspaceId: result.workspace_id,
          subjectId: result.subject_id,
        })

        clearCorporateEmailVerificationPending(result.subject_id)
        markCorporateJoinStepCompleted(result.subject_id)
        markCorporateWizardComplete(result.subject_id)

        if (cancelled) return

        const label = result.workspace_name ?? result.organization_name ?? 'your organization'
        setWorkspaceName(label)
        setVerified(true)
        await queryClient.invalidateQueries({ queryKey: ['tectona-onboarding-status'] })

        window.open('/login?reason=email_verified', '_blank', 'noopener,noreferrer')
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">Verifying your email…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="liquid-glass-enterprise-panel w-full max-w-md rounded-lg p-8 space-y-4 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button asChild variant="outline" className={authCardButtonClass}>
            <Link to="/login">Go to sign in</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (verified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="liquid-glass-enterprise-panel w-full max-w-md rounded-lg p-8 space-y-4 text-center">
          <MailCheck className="mx-auto h-10 w-10 text-primary" aria-hidden />
          <div className="space-y-2">
            <p className="text-base font-semibold">Email verified</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You have joined <span className="font-medium text-foreground">{workspaceName}</span>.
              A new tab should open so you can sign in. If it did not, use the button below.
            </p>
          </div>
          <Button
            type="button"
            className={authCardButtonClass}
            onClick={() => window.open('/login?reason=email_verified', '_blank', 'noopener,noreferrer')}
          >
            Open sign in
          </Button>
        </div>
      </div>
    )
  }

  return null
}
