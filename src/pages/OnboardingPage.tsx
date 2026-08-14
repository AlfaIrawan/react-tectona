import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { getSession, logoutAsync } from '@/auth/authService'
import { useTenantContext } from '@/auth/TenantContext'
import { useCorporateOnboardingRouting } from '@/auth/useCorporateOnboardingRouting'
import { useAppAccessGate } from '@/auth/useAppAccessGate'
import { PlatformRouteLoadingFallback } from '@/components/loading'
import {
  markCorporatePersonalWorkspaceCreated,
  markCorporateJoinStepCompleted,
  markCorporateWizardComplete,
  markCorporateEmailVerificationPending,
  clearCorporateEmailVerificationPending,
} from '@/lib/corporateOnboardingSession'
import {
  createPersonalWorkspaceOnboarding,
  createOrgPersonalWorkspaceOnboardingForUser,
  resolveOrganizationByEmail,
  submitJoinRequestByWorkspaceId,
} from '@/lib/api/onboardingApi'
import { IntentStep, type OnboardingIntent } from '@/modules/onboarding/components/IntentStep'
import { PersonalOnboardingStep } from '@/modules/onboarding/components/PersonalOnboardingStep'
import { CorporateOrganizationStep } from '@/modules/onboarding/components/CorporateOrganizationStep'
import { isConsumerEmail } from '@/lib/onboardingFeature'

type WizardStep = 'intent' | 'personal' | 'corporate'

export function OnboardingPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = getSession()
  const {
    loading,
    bypass,
    isCorporateEmail,
    shouldShowOnboardingStatus,
    shouldShowOnboardingWizard,
    canAccessMainApp,
    onboardingStatusReason,
    progress,
  } = useCorporateOnboardingRouting()
  const appAccess = useAppAccessGate()
  const { setActiveTenant } = useTenantContext()

  const [step, setStep] = useState<WizardStep>(() =>
    session?.user.email && !isConsumerEmail(session.user.email) ? 'corporate' : 'intent',
  )
  const [intent, setIntent] = useState<OnboardingIntent>(() =>
    session?.user.email && isConsumerEmail(session.user.email) ? 'personal' : 'organization',
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isCorporateEmail && progress?.matched) {
      setIntent('organization')
      setStep('corporate')
      return
    }
    if (intent === 'personal') setStep('personal')
    else setStep('corporate')
  }, [intent, isCorporateEmail, progress?.matched])

  if (loading || (appAccess.gateEnabled && appAccess.loading && !bypass)) {
    return (
      <PlatformRouteLoadingFallback
        title="Loading onboarding…"
        description="Checking your organization setup."
      />
    )
  }

  if (!bypass && shouldShowOnboardingStatus) {
    const reason = onboardingStatusReason ?? 'join_pending'
    return <Navigate to={`/onboarding/status?reason=${reason}`} replace />
  }

  if (
    !bypass &&
    canAccessMainApp &&
    (!appAccess.gateEnabled || appAccess.hasAppAccess)
  ) {
    return <Navigate to="/projects" replace />
  }

  const userEmail = session?.user.email ?? ''

  const handleCreatePersonalForWizard = async (input: { displayName: string; slug: string }) => {
    setSubmitting(true)
    setError('')
    try {
      const created = await createPersonalWorkspaceOnboarding({ ...input, corporateOnboarding: true })
      setActiveTenant({
        workspaceId: created.workspace_id,
        orgId: created.organization_id,
        slug: created.slug,
        tenantMode: created.tenant_mode,
        displayName: created.display_name,
      })
      if (session?.user.id) {
        markCorporatePersonalWorkspaceCreated(session.user.id)
      }
      await queryClient.invalidateQueries({ queryKey: ['tectona-onboarding-status'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create personal workspace.')
      const normalizedSlug = input.slug.trim().toLowerCase()
      await queryClient.invalidateQueries({ queryKey: ['slug-availability', normalizedSlug] })
      await queryClient.invalidateQueries({ queryKey: ['slug-availability'] })
      throw err
    } finally {
      setSubmitting(false)
    }
  }

  const handlePersonalOnboardingComplete = () => {
    const subjectId = getSession()?.user.id
    if (subjectId) {
      markCorporateJoinStepCompleted(subjectId)
      markCorporateWizardComplete(subjectId)
      clearCorporateEmailVerificationPending(subjectId)
    }
    void queryClient.invalidateQueries({ queryKey: ['tectona-onboarding-status'] })
    navigate('/projects', { replace: true })
  }

  const handleCreateOrgPersonal = async (input: { displayName: string; slug: string }) => {
    if (!userEmail) return
    setSubmitting(true)
    setError('')
    try {
      const domain = await resolveOrganizationByEmail(userEmail)
      const created =
        domain.matched && domain.organization_id
          ? await createOrgPersonalWorkspaceOnboardingForUser({
              email: userEmail,
              organizationId: domain.organization_id,
              displayName: input.displayName,
              slug: input.slug,
            })
          : await createPersonalWorkspaceOnboarding({ ...input, corporateOnboarding: true })

      setActiveTenant({
        workspaceId: created.workspace_id,
        orgId: created.organization_id,
        slug: created.slug,
        tenantMode: created.tenant_mode,
        displayName: created.display_name,
      })
      if (session?.user.id) {
        markCorporatePersonalWorkspaceCreated(session.user.id)
      }
      await queryClient.invalidateQueries({ queryKey: ['tectona-onboarding-status'] })
      await queryClient.invalidateQueries({ queryKey: ['corporate-onboarding-progress'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create personal workspace.')
      const normalizedSlug = input.slug.trim().toLowerCase()
      await queryClient.invalidateQueries({ queryKey: ['slug-availability', normalizedSlug] })
      await queryClient.invalidateQueries({ queryKey: ['slug-availability'] })
      throw err
    } finally {
      setSubmitting(false)
    }
  }

  const handleCorporateOnboardingComplete = () => {
    const subjectId = getSession()?.user.id
    if (subjectId) {
      markCorporateJoinStepCompleted(subjectId)
      markCorporateWizardComplete(subjectId)
      clearCorporateEmailVerificationPending(subjectId)
    }
    void queryClient.invalidateQueries({ queryKey: ['tectona-onboarding-status'] })
    void queryClient.invalidateQueries({ queryKey: ['corporate-onboarding-progress'] })
    navigate('/projects', { replace: true })
  }

  const handleJoinSubmit = async (input: {
    workspaceId: string
    slug: string
    displayName: string
    message?: string
  }) => {
    setSubmitting(true)
    setError('')
    try {
      await submitJoinRequestByWorkspaceId(input.workspaceId, input.message)
      await queryClient.invalidateQueries({ queryKey: ['tectona-onboarding-status'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit join request.')
      throw err
    } finally {
      setSubmitting(false)
    }
  }

  const handleAdminApprovalPending = () => {
    const subjectId = getSession()?.user.id
    if (subjectId) {
      markCorporateJoinStepCompleted(subjectId)
      markCorporateWizardComplete(subjectId)
      clearCorporateEmailVerificationPending(subjectId)
    }
    void queryClient.invalidateQueries({ queryKey: ['tectona-onboarding-status'] })
    void queryClient.invalidateQueries({ queryKey: ['corporate-onboarding-progress'] })
    navigate('/onboarding/status?reason=join_pending', { replace: true })
  }

  const handleEmailVerificationReady = async () => {
    const subjectId = getSession()?.user.id
    if (subjectId) {
      markCorporateJoinStepCompleted(subjectId)
      markCorporateWizardComplete(subjectId)
      markCorporateEmailVerificationPending(subjectId)
    }
    await queryClient.invalidateQueries({ queryKey: ['tectona-onboarding-status'] })
    await queryClient.invalidateQueries({ queryKey: ['corporate-onboarding-progress'] })
    await logoutAsync()
    window.location.href = '/login?reason=check_email'
  }

  const handleSignOut = async () => {
    await logoutAsync()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <div className="w-full max-w-lg mx-auto">
        <div className="glass-card rounded-lg shadow-2xl p-8">
          <div className="mb-6 space-y-2 text-center">
            <img src="/images/logo.png" alt="Tectona" className="mx-auto h-20 w-auto object-contain" />
            <p className="text-sm text-muted-foreground">Complete onboarding to start using Tectona</p>
            {session?.user.email && (
              <p className="text-xs text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{session.user.email}</span>
              </p>
            )}
          </div>

          {step === 'intent' && !isCorporateEmail && (
            <IntentStep
              value={intent}
              onChange={setIntent}
              onContinue={() => setStep(intent === 'personal' ? 'personal' : 'corporate')}
            />
          )}

          {step === 'personal' && !isCorporateEmail && userEmail && (
            <PersonalOnboardingStep
              email={userEmail}
              onBack={() => setStep('intent')}
              onCreatePersonal={handleCreatePersonalForWizard}
              onJoinSubmit={handleJoinSubmit}
              onComplete={handlePersonalOnboardingComplete}
              onAdminApprovalPending={handleAdminApprovalPending}
              submitting={submitting}
              error={error}
            />
          )}

          {step === 'corporate' && userEmail && (
            <CorporateOrganizationStep
              email={userEmail}
              onBack={() => setStep('intent')}
              onCreateOrgPersonal={handleCreateOrgPersonal}
              onJoinSubmit={handleJoinSubmit}
              onEmailVerificationReady={handleEmailVerificationReady}
              onAdminApprovalPending={handleAdminApprovalPending}
              onCorporateOnboardingComplete={handleCorporateOnboardingComplete}
              submitting={submitting}
              error={error}
            />
          )}

          <div className="mt-6 flex justify-center border-t border-border/40 pt-4">
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out and use a different account
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
