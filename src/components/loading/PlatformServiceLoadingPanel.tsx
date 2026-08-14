import { cn } from '@/lib/utils'

export type PlatformServiceLoadingPanelProps = {
  title: string
  description?: string
  className?: string
  compact?: boolean
}

/** In-panel data/API loader — glass card. Not for full-page route loading. */
export function PlatformServiceLoadingPanel({
  title,
  description,
  className,
  compact = false,
}: PlatformServiceLoadingPanelProps) {
  return (
    <div
      className={cn(
        'relative w-full max-w-[22rem] overflow-hidden rounded-2xl text-center',
        'border border-white/70 bg-white/55 shadow-[0_8px_40px_-12px_rgba(15,23,42,0.18)]',
        'backdrop-blur-2xl backdrop-saturate-150',
        'dark:border-white/10 dark:bg-slate-950/45 dark:shadow-[0_12px_48px_-16px_rgba(0,0,0,0.55)]',
        compact ? 'px-7 py-8' : 'px-8 py-10',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={title}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/50 via-transparent to-slate-100/20 dark:from-white/[0.06] dark:to-transparent" />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/20" />

      <div className="relative">
        <div
          className={cn(
            'mx-auto rounded-full border border-slate-300/70 border-t-slate-800 animate-spin',
            'dark:border-slate-600 dark:border-t-slate-100',
            compact ? 'h-8 w-8 border-[1.5px]' : 'h-9 w-9 border-2',
          )}
          aria-hidden
        />
        <p
          className={cn(
            'font-medium tracking-[-0.01em] text-slate-900 dark:text-slate-50',
            compact ? 'mt-4 text-[13px]' : 'mt-5 text-sm',
          )}
        >
          {title}
        </p>
        {description ? (
          <p
            className={cn(
              'mx-auto max-w-[18rem] leading-relaxed text-slate-500 dark:text-slate-400',
              compact ? 'mt-1.5 text-[11px]' : 'mt-2 text-xs',
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
    </div>
  )
}
