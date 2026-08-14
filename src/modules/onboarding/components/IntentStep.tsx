import { Building2, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'

export type OnboardingIntent = 'personal' | 'organization'

type IntentStepProps = {
  value: OnboardingIntent
  onChange: (intent: OnboardingIntent) => void
  onContinue: () => void
}

export function IntentStep({ value, onChange, onContinue }: IntentStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h2 className="text-lg font-semibold">How will you use Tectona?</h2>
        <p className="text-sm text-muted-foreground">
          Choose the option that fits best. You can change this later if needed.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onChange('personal')}
          className={cn(
            'rounded-lg border p-4 text-left transition-colors hover:bg-muted/40',
            value === 'personal' ? 'border-primary ring-2 ring-primary/20' : 'border-border',
          )}
        >
          <UserRound className="mb-2 h-5 w-5 text-primary" aria-hidden />
          <p className="font-medium">Personal / small team</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create a private workspace for your own projects and ideas.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChange('organization')}
          className={cn(
            'rounded-lg border p-4 text-left transition-colors hover:bg-muted/40',
            value === 'organization' ? 'border-primary ring-2 ring-primary/20' : 'border-border',
          )}
        >
          <Building2 className="mb-2 h-5 w-5 text-primary" aria-hidden />
          <p className="font-medium">I&apos;m from a company</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Join an existing organization workspace.
          </p>
        </button>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Continue
      </button>
    </div>
  )
}
