import { Building2, MailCheck, Search, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { authCardButtonClass } from '@/lib/authUiClasses'
import {
  isCorporateEmailVerificationRequired,
  isCorporateAdminApprovalRequired,
  isCorporateOnboardingMethodChoiceEnabled,
  isCorporateEmailVerificationOptionAvailable,
} from '@/lib/onboardingFeature'
import type { CorporateOnboardingFinishMethod } from '@/lib/corporateOnboardingSession'

const onboardingStackButtonClass = authCardButtonClass

type CorporateOptionalJoinStepProps = {
  organizationName?: string
  /** Consumer personal onboarding — softer copy without org-domain wording. */
  consumerPersonal?: boolean
  /** Matched corporate domain — enables admin vs email finish choice. */
  showFinishMethodChoice?: boolean
  finishMethod: CorporateOnboardingFinishMethod
  onFinishMethodChange: (method: CorporateOnboardingFinishMethod) => void
  defaultWorkspace?: {
    workspaceId: string
    slug: string
    displayName: string
  } | null
  onJoinBySlug: () => void
  onContinue: () => void
  submitting: boolean
}

function FinishMethodCard({
  selected,
  title,
  description,
  icon: Icon,
  onSelect,
}: {
  selected: boolean
  title: string
  description: string
  icon: typeof ShieldCheck
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-xl border p-4 text-left transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        selected
          ? 'border-indigo-400/70 bg-gradient-to-br from-indigo-50/90 via-background to-violet-50/40 shadow-[0_8px_24px_rgba(79,70,229,0.12)] dark:border-indigo-600/50 dark:from-indigo-950/30 dark:to-violet-950/20'
          : 'border-border/70 bg-background/80 hover:border-indigo-200/60 hover:bg-muted/20',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1',
            selected
              ? 'bg-indigo-500/15 text-indigo-700 ring-indigo-300/50 dark:text-indigo-200'
              : 'bg-muted/50 text-muted-foreground ring-border/60',
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
    </button>
  )
}

export function CorporateOptionalJoinStep({
  organizationName,
  consumerPersonal = false,
  showFinishMethodChoice = false,
  finishMethod,
  onFinishMethodChange,
  defaultWorkspace,
  onJoinBySlug,
  onContinue,
  submitting,
}: CorporateOptionalJoinStepProps) {
  const orgLabel = organizationName ?? 'your organization'
  const emailVerificationRequired = isCorporateEmailVerificationRequired()
  const adminApprovalRequired = isCorporateAdminApprovalRequired()
  const choiceEnabled =
    showFinishMethodChoice &&
    isCorporateOnboardingMethodChoiceEnabled() &&
    isCorporateEmailVerificationOptionAvailable()
  const matchedWithDefault = Boolean(defaultWorkspace && organizationName)

  const continueLabel = (() => {
    if (submitting) return 'Please wait…'
    if (choiceEnabled) {
      return finishMethod === 'email' ? 'Send verification email' : 'Submit for admin approval'
    }
    if (emailVerificationRequired) return 'Send verification email'
    if (adminApprovalRequired) return 'Submit for admin approval'
    return 'Continue to Tectona'
  })()

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h2 className="text-lg font-semibold">
          {matchedWithDefault ? 'Almost done' : 'Join a team workspace'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {matchedWithDefault ? (
            <>
              Your email belongs to <span className="font-medium text-foreground">{organizationName}</span>.
              Choose how you want to activate access to your organization.
            </>
          ) : organizationName ? (
            <>
              Your email belongs to <span className="font-medium text-foreground">{organizationName}</span>.
              You can ask to join another workspace if you have its short name (slug).
            </>
          ) : consumerPersonal ? (
            'Optionally join an existing team workspace using its short name (slug), or continue with your personal workspace only.'
          ) : adminApprovalRequired ? (
            'We could not match your email to an organization yet. Ask to join a workspace using its short name (slug). An admin must approve before you can sign in.'
          ) : (
            'We could not match your email to an organization yet. Ask to join a workspace using its short name (slug), or continue with your personal workspace only.'
          )}
        </p>
      </div>

      {matchedWithDefault && defaultWorkspace ? (
        <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm">
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <p className="font-medium">{defaultWorkspace.displayName}</p>
              <p className="text-muted-foreground">
                Short name: <code className="font-mono">{defaultWorkspace.slug}</code> · {orgLabel}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {choiceEnabled ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            How would you like to activate access?
          </p>
          <FinishMethodCard
            selected={finishMethod === 'admin'}
            title="Admin approval"
            description="An organization admin reviews and approves your access before you can sign in."
            icon={ShieldCheck}
            onSelect={() => onFinishMethodChange('admin')}
          />
          <FinishMethodCard
            selected={finishMethod === 'email'}
            title="Verify by email"
            description="We email you a confirmation link. After you verify, you join the organization immediately — no admin approval needed."
            icon={MailCheck}
            onSelect={() => onFinishMethodChange('email')}
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <Button
          type="button"
          className={onboardingStackButtonClass}
          disabled={submitting}
          onClick={() => void onContinue()}
        >
          {continueLabel}
        </Button>

        <Button
          type="button"
          variant="outline"
          className={onboardingStackButtonClass}
          disabled={submitting}
          onClick={onJoinBySlug}
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <span>Ask to join another workspace</span>
        </Button>
      </div>
    </div>
  )
}
