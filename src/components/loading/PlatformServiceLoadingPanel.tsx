import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PlatformServiceLoadingPanelProps = {
  title: string
  description?: string
  className?: string
  compact?: boolean
}

/** Loader in-panel saat fetch backend / microservice — bukan fullscreen route/page. */
export function PlatformServiceLoadingPanel({
  title,
  description,
  className,
  compact = false,
}: PlatformServiceLoadingPanelProps) {
  return (
    <div
      className={cn(
        'relative w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-card/80 px-8 py-12 text-center shadow-[0_22px_55px_-18px_rgba(15,23,42,0.14)] backdrop-blur-md dark:border-white/[0.08] dark:bg-slate-950/75 dark:shadow-[0_28px_64px_-24px_rgba(0,0,0,0.55)]',
        compact && 'px-6 py-8',
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={title}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />
      <div
        className={cn(
          'mx-auto flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/15 to-indigo-500/10 ring-1 ring-sky-500/20 dark:from-sky-400/20 dark:to-indigo-500/15 dark:ring-sky-400/25',
          compact ? 'h-12 w-12' : 'h-16 w-16'
        )}
      >
        <Loader2
          className={cn('animate-spin text-sky-600 dark:text-sky-400', compact ? 'h-6 w-6' : 'h-8 w-8')}
          aria-hidden
        />
      </div>
      <p className={cn('font-semibold tracking-tight text-foreground', compact ? 'mt-4 text-base' : 'mt-6 text-lg')}>
        {title}
      </p>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}
