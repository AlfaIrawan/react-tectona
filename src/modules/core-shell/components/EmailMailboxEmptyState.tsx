import { Link2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { enterpriseCyanGradientActionButtonClass } from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'

interface EmailMailboxEmptyStateProps {
  onConnect: () => void
  errorMessage?: string | null
}

export function EmailMailboxEmptyState({ onConnect, errorMessage }: EmailMailboxEmptyStateProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-muted/30">
        <Mail className="h-7 w-7 text-muted-foreground" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-foreground">Mailbox not connected</h3>
      <p className="mt-2 max-w-[260px] text-xs leading-relaxed text-muted-foreground">
        Connect your work email (Outlook/M365) to read your inbox and send messages without leaving Tectona.
      </p>
      {errorMessage ? <p className="mt-3 max-w-[280px] text-xs text-destructive">{errorMessage}</p> : null}
      <Button
        type="button"
        className={cn(enterpriseCyanGradientActionButtonClass(), 'mt-6 min-h-11 w-full max-w-[240px] justify-center gap-2 rounded-lg sm:min-h-10')}
        onClick={onConnect}
      >
        <Link2 className="h-4 w-4 shrink-0" aria-hidden />
        Connect mailbox
      </Button>
    </div>
  )
}
