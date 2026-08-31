import { useState } from 'react'
import { Loader2, LogOut, MailCheck, ShieldCheck } from 'lucide-react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { logoutAsync, getSession } from '@/auth/authService'
import { useCorporateOnboardingRouting } from '@/auth/useCorporateOnboardingRouting'
import {
  isCorporateEmailVerificationPending,
  isCorporateEmailFinishMethodSelected,
} from '@/lib/corporateOnboardingSession'
import {
  isCorporateEmailVerificationRequired,
  isCorporateOnboardingMethodChoiceEnabled,
} from '@/lib/onboardingFeature'
import { resendDomainOnboardingVerificationEmail } from '@/lib/api/identityApi'
import { switchCorporateOnboardingToAdminApproval } from '@/lib/api/onboardingApi'
import { authCardButtonClass } from '@/lib/authUiClasses'

export function OnboardingStatusPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const session = getSession()
  const subjectId = session?.user.id ?? ''
  const reason = searchParams.get('reason')
  const pendingEmailFromNavigation = reason === 'email_verify_pending'
  const pendingJoinFromNavigation = reason === 'join_pending'
  const {
    loading,
    bypass,
    status,
    progress,
    shouldShowOnboardingWizard,
    shouldShowOnboardingStatus,
    shouldShowEmailVerification,
    canAccessMainApp,
  } = useCorporateOnboardingRouting()
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [resendError, setResendError] = useState('')
  const [switchingToAdmin, setSwitchingToAdmin] = useState(false)
  const [switchError, setSwitchError] = useState('')

  if (
    !loading &&
    !bypass &&
    shouldShowOnboardingWizard &&
    !shouldShowOnboardingStatus &&
    !pendingEmailFromNavigation &&
    !pendingJoinFromNavigation
  ) {
    return <Navigate to="/onboarding" replace />
  }

  if (!loading && !bypass && canAccessMainApp) {
    return <Navigate to="/projects" replace />
  }

  const emailVerificationPathActive =
    isCorporateEmailVerificationRequired() ||
    status === 'email_verify_pending' ||
    isCorporateEmailFinishMethodSelected(subjectId)

  if (
    !loading &&
    !bypass &&
    !emailVerificationPathActive &&
    pendingEmailFromNavigation
  ) {
    return <Navigate to="/onboarding" replace />
  }

  const isBlocked = status === 'blocked'
  const needsEmailConfirm =
    emailVerificationPathActive &&
    (shouldShowEmailVerification ||
      status === 'email_verify_pending' ||
      pendingEmailFromNavigation ||
      progress?.setup_phase === 'email_verify' ||
      (Boolean(subjectId) && isCorporateEmailVerificationPending(subjectId)))
  const isJoinPending = status === 'join_pending' || reason === 'join_pending'
  const isEmailVerify = needsEmailConfirm && !isBlocked
  const isPending = isJoinPending && !isBlocked && !needsEmailConfirm
  const canSwitchToAdminApproval =
    isEmailVerify &&
    !isBlocked &&
    isCorporateOnboardingMethodChoiceEnabled() &&
    (isCorporateEmailFinishMethodSelected(subjectId) || pendingEmailFromNavigation)

  const handleSignOut = async () => {
    await logoutAsync()
    window.location.href = '/login'
  }

  const handleResend = async () => {
    if (!session?.user.email || !session.user.id) return
    setResending(true)
    setResendError('')
    setResendMessage('')
    try {
      await resendDomainOnboardingVerificationEmail({
        email: session.user.email,
        subjectId: session.user.id,
      })
      setResendMessage('Confirmation email sent. Check your inbox and spam folder.')
    } catch (err) {
      setResendError(err instanceof Error ? err.message : 'Failed to resend confirmation email.')
    } finally {
      setResending(false)
    }
  }

  const handleSwitchToAdminApproval = async () => {
    if (!session?.user.email || !session.user.id) return
    setSwitchingToAdmin(true)
    setSwitchError('')
    try {
      await switchCorporateOnboardingToAdminApproval({
        email: session.user.email,
        subjectId: session.user.id,
      })
      navigate('/onboarding/status?reason=join_pending', { replace: true })
      window.location.reload()
    } catch (err) {
      setSwitchError(err instanceof Error ? err.message : 'Failed to switch to admin approval.')
    } finally {
      setSwitchingToAdmin(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto">
        <div className="liquid-glass-enterprise-panel rounded-lg p-8 space-y-6">
          <div className="space-y-2 text-center">
            <img src="/images/logo.png" alt="Tectona" className="mx-auto h-24 w-auto object-contain" />
          </div>

          {isEmailVerify && !isBlocked && (
            <div className="flex items-start gap-3 rounded-md bg-blue-500/10 border border-blue-500/30 px-4 py-3">
              <MailCheck className="h-5 w-5 shrink-0 mt-0.5 text-blue-600" aria-hidden />
              <div className="space-y-1 text-sm">
                <p className="font-semibold">Confirm your email to sign in</p>
                <p className="text-muted-foreground leading-relaxed">
                  We sent a confirmation link to{' '}
                  <span className="font-medium text-foreground">{session?.user.email}</span>. Open the link in your
                  inbox to activate your account and access Tectona.
                </p>
              </div>
            </div>
          )}

          {isJoinPending && !isBlocked && isEmailVerify && (
            <div className="flex items-start gap-3 rounded-md bg-muted/60 border border-border px-4 py-3">
              <Loader2 className="h-5 w-5 shrink-0 mt-0.5 text-muted-foreground animate-spin" aria-hidden />
              <div className="space-y-1 text-sm">
                <p className="font-semibold">Join request pending approval</p>
                <p className="text-muted-foreground leading-relaxed">
                  Your request to join the organization workspace was sent. An administrator will review it after
                  you confirm your email.
                </p>
              </div>
            </div>
          )}

          {isPending && !isBlocked && !isEmailVerify && (
            <div className="flex items-start gap-3 rounded-md bg-blue-500/10 border border-blue-500/30 px-4 py-3">
              <Loader2 className="h-5 w-5 shrink-0 mt-0.5 text-blue-600 animate-spin" aria-hidden />
              <div className="space-y-1 text-sm">
                <p className="font-semibold">Waiting for admin approval</p>
                <p className="text-muted-foreground leading-relaxed">
                  Your join request has been sent. Waiting for the workspace administrator to approve it.
                </p>
              </div>
            </div>
          )}

          {isBlocked && (
            <div className="flex items-start gap-3 rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3">
              <div className="space-y-1 text-sm">
                <p className="font-semibold">Request declined</p>
                <p className="text-muted-foreground leading-relaxed">
                  Your request was declined. Contact the workspace administrator or submit again from onboarding.
                </p>
              </div>
            </div>
          )}

          {isEmailVerify && resendMessage && (
            <p className="text-sm text-green-700 dark:text-green-400">{resendMessage}</p>
          )}
          {isEmailVerify && resendError && (
            <p className="text-sm text-destructive">{resendError}</p>
          )}
          {canSwitchToAdminApproval && switchError && (
            <p className="text-sm text-destructive">{switchError}</p>
          )}

          <div className="flex flex-col gap-2">
            {isEmailVerify && (
              <Button
                type="button"
                className={authCardButtonClass}
                disabled={resending}
                onClick={() => void handleResend()}
              >
                {resending ? 'Sending…' : 'Resend confirmation email'}
              </Button>
            )}
            {canSwitchToAdminApproval && (
              <Button
                type="button"
                variant="outline"
                className={authCardButtonClass}
                disabled={switchingToAdmin}
                onClick={() => void handleSwitchToAdminApproval()}
              >
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
                {switchingToAdmin ? 'Submitting…' : 'Use admin approval instead'}
              </Button>
            )}
            {isBlocked && (
              <Button asChild variant="default" className={authCardButtonClass}>
                <Link to="/onboarding">Back to onboarding</Link>
              </Button>
            )}
            <Button asChild variant="outline" className={authCardButtonClass}>
              <Link to="/profile">My profile</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className={authCardButtonClass}
              onClick={() => void handleSignOut()}
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
