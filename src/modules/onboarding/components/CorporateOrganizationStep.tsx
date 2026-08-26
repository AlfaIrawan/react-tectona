import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  resolveOrganizationByEmail,
  activateCorporateOnboardingWithoutEmail,
  completeCorporateOnboardingWithAdminApproval,
  completeCorporateOnboardingWithEmail,
  fetchOnboardingStatus,
  type DomainResolveResponse,
} from '@/lib/api/onboardingApi'
import { fetchCorporateOnboardingProgress } from '@/lib/api/workspaceOrgApi'
import { TECTONA_AUTHZ_APP_ID } from '@/lib/constants/tectonaAuthz'
import {
  isCorporateEmailVerificationRequired,
  isCorporateAdminApprovalRequired,
  isCorporateOnboardingMethodChoiceEnabled,
} from '@/lib/onboardingFeature'
import type { CorporateOnboardingFinishMethod } from '@/lib/corporateOnboardingSession'
import {
  isCorporatePersonalWorkspaceCreated,
  isCorporateJoinStepCompleted,
  isCorporateWizardComplete,
  markCorporateJoinStepCompleted,
  markCorporatePersonalWorkspaceCreated,
} from '@/lib/corporateOnboardingSession'
import { getSession } from '@/auth/authService'
import { TENANT_STORAGE_KEY, type StoredTenantSelection } from '@/lib/onboardingFeature'
import { CreatePersonalWorkspaceStep } from '@/modules/onboarding/components/CreatePersonalWorkspaceStep'
import { CorporateOptionalJoinStep } from '@/modules/onboarding/components/CorporateOptionalJoinStep'
import { CorporateOrgReadyStep } from '@/modules/onboarding/components/CorporateOrgReadyStep'
import { JoinWorkspaceStep } from '@/modules/onboarding/components/JoinWorkspaceStep'
import {
  OnboardingWizardSteps,
  type WizardStepItem,
} from '@/modules/onboarding/components/OnboardingWizardSteps'

type CorporateOrganizationStepProps = {
  email: string
  onBack: () => void
  onCreateOrgPersonal: (input: { displayName: string; slug: string }) => Promise<void>
  onJoinSubmit: (input: {
    workspaceId: string
    slug: string
    displayName: string
    message?: string
  }) => Promise<void>
  onEmailVerificationReady: () => void | Promise<void>
  onAdminApprovalPending: () => void
  onCorporateOnboardingComplete: () => void
  onUnmatchedCorporateComplete?: () => void
  submitting: boolean
  error: string
}

type Phase = 'bootstrapping' | 'org-ready' | 'personal' | 'optional-join' | 'join'

const BOOTSTRAP_TIMEOUT_MS = 30_000

const MATCHED_WIZARD_STEPS: WizardStepItem[] = [
  { id: 'org', label: 'Organization' },
  { id: 'personal', label: 'Personal' },
  { id: 'join', label: 'Access' },
  { id: 'finish', label: 'Confirm' },
]

const UNMATCHED_WIZARD_STEPS: WizardStepItem[] = [
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

function wizardStepIndex(phase: Phase, matched: boolean, finalizing: boolean): number {
  const joinIndex = matched ? 2 : 1
  const confirmIndex = matched ? 3 : 2

  if (finalizing) return confirmIndex

  if (!matched) {
    if (phase === 'personal') return 0
    if (phase === 'optional-join' || phase === 'join') return joinIndex
    return 0
  }
  if (phase === 'org-ready') return 0
  if (phase === 'personal') return 1
  if (phase === 'optional-join' || phase === 'join') return joinIndex
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
  wizardSteps,
  currentStepIndex,
  errorMessage,
  children,
}: {
  wizardSteps: WizardStepItem[]
  currentStepIndex: number
  errorMessage?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      <OnboardingWizardSteps steps={wizardSteps} currentIndex={currentStepIndex} />
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

export function CorporateOrganizationStep({
  email,
  onBack,
  onCreateOrgPersonal,
  onJoinSubmit,
  onEmailVerificationReady,
  onAdminApprovalPending,
  onCorporateOnboardingComplete,
  submitting,
  error,
}: CorporateOrganizationStepProps) {
  const [phase, setPhase] = useState<Phase>('bootstrapping')
  const [domainInfo, setDomainInfo] = useState<DomainResolveResponse | null>(null)
  const [loadError, setLoadError] = useState('')
  const [localError, setLocalError] = useState('')
  const [finalizing, setFinalizing] = useState(false)
  const [finishMethod, setFinishMethod] = useState<CorporateOnboardingFinishMethod>('admin')

  const orgMatched = Boolean(domainInfo?.matched)

  const defaultOrgWorkspace =
    orgMatched &&
    domainInfo?.default_workspace_id &&
    domainInfo.default_workspace_slug
      ? {
          workspaceId: domainInfo.default_workspace_id,
          slug: domainInfo.default_workspace_slug,
          displayName:
            domainInfo.default_workspace_name ?? domainInfo.organization_name ?? 'Organization workspace',
        }
      : null

  const wizardSteps = orgMatched ? MATCHED_WIZARD_STEPS : UNMATCHED_WIZARD_STEPS
  const currentStepIndex = wizardStepIndex(phase, orgMatched, finalizing)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoadError('')
      try {
        const subjectId = getSession()?.user.id ?? ''
        const [resolved, progress, onboardingStatus] = await withTimeout(
          Promise.all([
            resolveOrganizationByEmail(email),
            fetchCorporateOnboardingProgress(email, TECTONA_AUTHZ_APP_ID),
            subjectId
              ? fetchOnboardingStatus(TECTONA_AUTHZ_APP_ID, subjectId)
              : Promise.resolve({
                  onboarding_status: 'none' as const,
                  active_membership_count: 0,
                }),
          ]),
          BOOTSTRAP_TIMEOUT_MS,
          'Organization setup timed out. Check that workspace-org service is running, then try again.',
        )
        if (cancelled) return
        setDomainInfo(resolved)

        const hasActivePersonalMembership =
          onboardingStatus.onboarding_status === 'active' &&
          onboardingStatus.active_membership_count > 0

        const setupStillRequired =
          onboardingStatus.onboarding_status === 'corporate_setup_pending'

        if (hasActivePersonalMembership && subjectId) {
          markCorporatePersonalWorkspaceCreated(subjectId)
        }

        if (
          setupStillRequired &&
          (hasActivePersonalMembership ||
            Boolean(readActiveWorkspaceId()) ||
            (progress.personal_workspace_created && progress.setup_phase !== 'none'))
        ) {
          setPhase('optional-join')
          return
        }

        if (
          setupStillRequired &&
          !resolved.matched &&
          subjectId &&
          isCorporatePersonalWorkspaceCreated(subjectId) &&
          !isCorporateJoinStepCompleted(subjectId) &&
          !isCorporateWizardComplete(subjectId)
        ) {
          setPhase('optional-join')
          return
        }

        setPhase(resolved.matched ? 'org-ready' : 'personal')
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to prepare organization onboarding.')
          setDomainInfo({ email_domain: email.split('@')[1] ?? '', matched: false })
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

    const useEmailFinish =
      isCorporateEmailVerificationRequired() ||
      (isCorporateOnboardingMethodChoiceEnabled() &&
        orgMatched &&
        finishMethod === 'email')

    const useAdminFinish =
      !useEmailFinish &&
      (isCorporateAdminApprovalRequired() ||
        (isCorporateOnboardingMethodChoiceEnabled() && orgMatched && finishMethod === 'admin'))

    if (useEmailFinish) {
      await completeCorporateOnboardingWithEmail({ email, subjectId })
      await onEmailVerificationReady()
      return
    }

    if (useAdminFinish) {
      await completeCorporateOnboardingWithAdminApproval({
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
    onCorporateOnboardingComplete()
  }

  const handlePersonalSubmit = async (input: { displayName: string; slug: string }) => {
    setLocalError('')
    try {
      await onCreateOrgPersonal(input)
      setPhase('optional-join')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to create personal workspace.')
    }
  }

  const handleOptionalContinue = async () => {
    setLocalError('')
    setFinalizing(true)
    try {
      // The organization match was resolved during bootstrap.  The optional
      // step has no form input; use the matched organization's default
      // workspace so signup submits the corporate approval request and the
      // server can place the personal workspace in the organization tree.
      await completeAfterJoinStep(defaultOrgWorkspace?.workspaceId)
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
      // Preserve the workspace selected in the signup join step so the
      // corporate approval handler can link the personal workspace to this
      // organization tree instead of treating it as standalone.
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
      <StepLayout wizardSteps={wizardSteps} currentStepIndex={currentStepIndex} errorMessage={bannerError}>
        <JoinWorkspaceStep
          onBack={() => setPhase('optional-join')}
          onSubmit={handleJoinSubmit}
          submitting={busy}
          error=""
          organizationHint={domainInfo?.matched ? domainInfo.organization_name ?? undefined : undefined}
        />
      </StepLayout>
    )
  }

  if (phase === 'optional-join') {
    return (
      <StepLayout wizardSteps={wizardSteps} currentStepIndex={currentStepIndex} errorMessage={bannerError}>
        <CorporateOptionalJoinStep
          organizationName={domainInfo?.organization_name ?? undefined}
          showFinishMethodChoice={orgMatched}
          finishMethod={finishMethod}
          onFinishMethodChange={setFinishMethod}
          defaultWorkspace={defaultOrgWorkspace}
          onJoinBySlug={() => setPhase('join')}
          onContinue={handleOptionalContinue}
          submitting={busy}
        />
      </StepLayout>
    )
  }

  if (phase === 'org-ready' && domainInfo?.matched) {
    return (
      <StepLayout wizardSteps={wizardSteps} currentStepIndex={currentStepIndex} errorMessage={bannerError}>
        <CorporateOrgReadyStep
          organizationName={domainInfo.organization_name ?? 'Organization'}
          emailDomain={domainInfo.email_domain}
          defaultWorkspaceName={domainInfo.default_workspace_name}
          onContinue={() => setPhase('personal')}
        />
      </StepLayout>
    )
  }

  return (
    <StepLayout wizardSteps={wizardSteps} currentStepIndex={currentStepIndex}>
      <CreatePersonalWorkspaceStep
        email={email}
        title="Create your personal workspace"
        description={
          orgMatched && domainInfo?.organization_name
            ? `Your domain is verified for ${domainInfo.organization_name}. A personal workspace is still required before you can join the organization workspace.`
            : 'Required for corporate accounts — your private workspace for projects and day-to-day work in Tectona.'
        }
        submitLabel="Create and continue"
        required
        onBack={orgMatched ? () => setPhase('org-ready') : onBack}
        onSubmit={handlePersonalSubmit}
        submitting={busy}
        error={combinedError}
      />
    </StepLayout>
  )
}

export function tenantFromDomainHome(result: {
  workspace_id: string
  organization_id: string
  slug: string
  tenant_mode: 'personal' | 'organization'
  display_name: string
}): {
  workspaceId: string
  orgId: string
  slug: string
  tenantMode: 'personal' | 'organization'
  displayName: string
} {
  return {
    workspaceId: result.workspace_id,
    orgId: result.organization_id,
    slug: result.slug,
    tenantMode: result.tenant_mode,
    displayName: result.display_name,
  }
}
