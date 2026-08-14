import { cn } from '@/lib/utils'

export type WizardStepItem = {
  id: string
  label: string
}

type OnboardingWizardStepsProps = {
  steps: WizardStepItem[]
  currentIndex: number
}

export function OnboardingWizardSteps({ steps, currentIndex }: OnboardingWizardStepsProps) {
  return (
    <nav aria-label="Onboarding progress" className="mb-6">
      <ol className="flex items-center justify-center gap-2">
        {steps.map((step, index) => {
          const isComplete = index < currentIndex
          const isCurrent = index === currentIndex
          return (
            <li key={step.id} className="flex items-center gap-2">
              {index > 0 && (
                <span
                  className={cn(
                    'hidden h-px w-6 sm:block',
                    isComplete ? 'bg-primary' : 'bg-border',
                  )}
                  aria-hidden
                />
              )}
              <div className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                    isComplete && 'bg-primary text-primary-foreground',
                    isCurrent && 'border-2 border-primary bg-primary/10 text-primary',
                    !isComplete && !isCurrent && 'border border-border bg-muted/40 text-muted-foreground',
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isComplete ? '✓' : index + 1}
                </span>
                <span
                  className={cn(
                    'hidden text-[10px] font-medium sm:block',
                    isCurrent ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
