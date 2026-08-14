import { getPasswordRequirements, getPasswordStrengthScore } from '@/lib/passwordPolicy'
import { cn } from '@/lib/utils'

type PasswordStrengthProgressProps = {
  password: string
  className?: string
}

function strengthLabel(passed: number, total: number): string {
  if (passed >= total) return 'Strong'
  if (passed >= total - 1) return 'Almost there'
  if (passed >= total / 2) return 'Fair'
  return 'Weak'
}

export function PasswordStrengthProgress({ password, className }: PasswordStrengthProgressProps) {
  if (!password) return null

  const requirements = getPasswordRequirements(password)
  const { passed, total } = getPasswordStrengthScore(password)
  const firstMissing = requirements.find((req) => !req.passed)

  return (
    <div className={cn('space-y-1.5', className)} aria-live="polite">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">Password strength</span>
        <span
          className={cn(
            'font-medium tabular-nums',
            passed >= total && 'text-emerald-700 dark:text-emerald-300',
            passed < total && passed >= total / 2 && 'text-amber-700 dark:text-amber-300',
            passed < total / 2 && 'text-muted-foreground',
          )}
        >
          {strengthLabel(passed, total)} ({passed}/{total})
        </span>
      </div>

      <div
        className="flex gap-1"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={passed}
        aria-label={`Password strength ${passed} of ${total} requirements met`}
      >
        {requirements.map((req) => (
          <div
            key={req.id}
            title={req.passed ? req.label : `Still needed: ${req.label}`}
            className={cn(
              'h-1.5 min-w-0 flex-1 rounded-full transition-colors duration-200',
              req.passed
                ? 'bg-emerald-500 dark:bg-emerald-400'
                : 'bg-muted-foreground/20',
            )}
          />
        ))}
      </div>

      {firstMissing ? (
        <p className="text-xs text-muted-foreground">
          Next: {firstMissing.label}
        </p>
      ) : null}
    </div>
  )
}
