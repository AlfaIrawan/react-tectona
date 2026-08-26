import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  activateCorporateOnboardingWithoutEmail,
  submitCorporateOnboardingForAdminApproval,
  fetchOnboardingStatus,
} from '@/lib/api/onboardingApi'
import { isCorporateAdminApprovalRequired } from '@/lib/onboardingFeature'
import { TECTONA_AUTHZ_APP_ID } from '@/lib/constants/tectonaAuthz'
import {
  isCorporateJoinStepCompleted,
  isCorporatePersonalWorkspaceCreated,
  isCorporateWizardComplete,
  markCorporateJoinStepCompleted,
  markCorporatePersonalWorkspaceCreated,
} from '@/lib/corporateOnboardingSession'
import { getSession } from '@/auth/authService'
import { TENANT_STORAGE_KEY, type StoredTenantSelection } from '@/lib/onboardingFeature'
import { CreatePersonalWorkspaceStep } from '@/modules/onboarding/components/CreatePersonalWorkspaceStep'
import { CorporateOptionalJoinStep } from '@/modules/onboarding/components/CorporateOptionalJoinStep'
import { JoinWorkspaceStep } from '@/modules/onboarding/components/JoinWorkspaceStep'
import {
  OnboardingWizardSteps,
  type WizardStepItem,
} from '@/modules/onboarding/components/OnboardingWizardSteps'

type PersonalOnboardingStepProps = {
  email: string
  onBack: () => void
  onCreatePersonal: (input: { displayName: string; slug: string }) => Promise<void>
  onJoinSubmit: (input: {
    workspaceId: string
    slug: string
    displayName: string
    message?: string
  }) => Promise<void>
  onComplete: () => void
  onAdminApprovalPending: () => void
  submitting: boolean
  error: string
}

type Phase = 'bootstrapping' | 'personal' | 'optional-join' | 'join'

const BOOTSTRAP_TIMEOUT_MS = 30_000

const WIZARD_STEPS: WizardStepItem[] = [
  { id: 'personal', label: 'Personal' },
  { id: 'join', label: 'Join workspace' },
  { id: 'finish', label: 'Confirm' },
]

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), ms)
    }),
  ])
}

function wizardStepIndex(phase: Phase, finalizing: boolean): number {
  if (finalizing) return 2
  if (phase === 'personal') return 0
  if (phase === 'optional-join' || phase === 'join') return 1
  return 0
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  )
}

function StepLayout({
  currentStepIndex,
  errorMessage,
  children,
}: {
  currentStepIndex: number
  errorMessage?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      <OnboardingWizardSteps steps={WIZARD_STEPS} currentIndex={currentStepIndex} />
      {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
      {children}
    </div>
  )
}

function readActiveWorkspaceId(): string | null {
  try {
    const raw = sessionStorage.getItem(TENANT_STORAGE_KEY)
    if (!raw) return null
    const tenant = JSON.parse(raw) as StoredTenantSelection
    return tenant.workspaceId?.trim() || null
  } catch {
    return null
  }
}

export function PersonalOnboardingStep({
  email,
  onBack,
  onCreatePersonal,
  onJoinSubmit,
  onComplete,
  onAdminApprovalPending,
  submitting,
  error,
}: PersonalOnboardingStepProps) {
  const [phase, setPhase] = useState<Phase>('bootstrapping')
  const [loadError, setLoadError] = useState('')
  const [localError, setLocalError] = useState('')
  const [finalizing, setFinalizing] = useState(false)

  const currentStepIndex = wizardStepIndex(phase, finalizing)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoadError('')
      try {
        const subjectId = getSession()?.user.id ?? ''
        const onboardingStatus = subjectId
          ? await withTimeout(
              fetchOnboardingStatus(TECTONA_AUTHZ_APP_ID, subjectId),
              BOOTSTRAP_TIMEOUT_MS,
              'Onboarding setup timed out. Check that services are running, then try again.',
            )
          : { onboarding_status: 'none' as const, active_membership_count: 0 }

        if (cancelled) return

        const setupStillRequired = onboardingStatus.onboarding_status === 'corporate_setup_pending'
        const hasPersonalWorkspace =
          Boolean(readActiveWorkspaceId()) ||
          (onboardingStatus.active_membership_count > 0 &&
            onboardingStatus.onboarding_status !== 'none')

        if (hasPersonalWorkspace && subjectId) {
          markCorporatePersonalWorkspaceCreated(subjectId)
        }

        if (
          setupStillRequired &&
          (hasPersonalWorkspace ||
            (subjectId &&
              isCorporatePersonalWorkspaceCreated(subjectId) &&
              !isCorporateJoinStepCompleted(subjectId) &&
              !isCorporateWizardComplete(subjectId)))
        ) {
          setPhase('optional-join')
          return
        }

        setPhase('personal')
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to prepare onboarding.')
          setPhase('personal')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [email])

  const completeAfterJoinStep = async (orgWorkspaceId?: string) => {
    const subjectId = getSession()?.user.id
    if (!subjectId) throw new Error('Session expired. Sign in again.')

    if (isCorporateAdminApprovalRequired()) {
      await submitCorporateOnboardingForAdminApproval({
        email,
        subjectId,
        workspaceId: readActiveWorkspaceId(),
        orgWorkspaceId,
        message: 'Corporate onboarding complete — awaiting admin approval.',
      })
      onAdminApprovalPending()
      return
    }

    await activateCorporateOnboardingWithoutEmail({
      email,
      subjectId,
      workspaceId: readActiveWorkspaceId(),
    })
    onComplete()
  }

  const handlePersonalSubmit = async (input: { displayName: string; slug: string }) => {
    setLocalError('')
    try {
      await onCreatePersonal(input)
      setPhase('optional-join')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to create personal workspace.')
    }
  }

  const handleOptionalContinue = async () => {
    setLocalError('')
    setFinalizing(true)
    try {
      // Consumer/personal onboarding has no organization workspace to join.
      // Never reference a non-existent form input here; continue with the
      // personal workspace already stored in the active tenant.
      await completeAfterJoinStep()
      const subjectId = getSession()?.user.id
      if (subjectId) markCorporateJoinStepCompleted(subjectId)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to continue onboarding.')
    } finally {
      setFinalizing(false)
    }
  }

  const handleJoinSubmit = async (input: {
    workspaceId: string
    slug: string
    displayName: string
    message?: string
  }) => {
    setLocalError('')
    setFinalizing(true)
    try {
      await onJoinSubmit(input)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to submit join request.')
      setFinalizing(false)
      return
    }

    try {
      // Keep the selected organization workspace attached to the approval
      // request; this is what allows the personal workspace to enter the tree
      // after approval.
      await completeAfterJoinStep(input.workspaceId)
      const subjectId = getSession()?.user.id
      if (subjectId) markCorporateJoinStepCompleted(subjectId)
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Join request sent, but onboarding could not be completed.',
      )
    } finally {
      setFinalizing(false)
    }
  }

  const busy = submitting || finalizing
  const combinedError = error || loadError || localError
  const bannerError = phase !== 'personal' ? combinedError : undefined

  if (phase === 'bootstrapping') {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        <p className="text-sm">Preparing your onboarding…</p>
        <p className="text-xs text-muted-foreground/80">This usually takes a few seconds.</p>
      </div>
    )
  }

  if (phase === 'join') {
    return (
      <StepLayout currentStepIndex={currentStepIndex} errorMessage={bannerError}>
        <JoinWorkspaceStep
          onBack={() => setPhase('optional-join')}
          onSubmit={handleJoinSubmit}
          submitting={busy}
          error=""
        />
      </StepLayout>
    )
  }

  if (phase === 'optional-join') {
    return (
      <StepLayout currentStepIndex={currentStepIndex} errorMessage={bannerError}>
        <CorporateOptionalJoinStep
          consumerPersonal
          finishMethod="admin"
          onFinishMethodChange={() => undefined}
          onJoinBySlug={() => setPhase('join')}
          onContinue={handleOptionalContinue}
          submitting={busy}
        />
      </StepLayout>
    )
  }

  return (
    <StepLayout currentStepIndex={currentStepIndex}>
      <CreatePersonalWorkspaceStep
        email={email}
        title="Create your personal workspace"
        description="Your private workspace for projects and day-to-day work in Tectona."
        submitLabel="Create and continue"
        required
        onBack={onBack}
        onSubmit={handlePersonalSubmit}
        submitting={busy}
        error={combinedError}
      />
    </StepLayout>
  )
}
