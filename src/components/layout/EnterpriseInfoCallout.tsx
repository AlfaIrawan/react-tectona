import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type EnterpriseInfoCalloutProps = {
  children: ReactNode
  className?: string
  title?: string
}

/** Subtle enterprise info banner for architecture / separation-of-concerns hints. */
export function EnterpriseInfoCallout({ children, className, title }: EnterpriseInfoCalloutProps) {
  return (
    <div
      role="note"
      className={cn(
        'rounded-lg border border-sky-200/70 bg-gradient-to-r from-sky-50/90 via-background/90 to-blue-50/50 px-2.5 py-2 text-slate-700',
        'dark:border-sky-800/50 dark:from-sky-950/30 dark:via-background/80 dark:to-blue-950/20 dark:text-slate-300',
        className
      )}
    >
      <div className="flex gap-2">
        <Info className="mt-px h-3 w-3 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
        <div className="min-w-0 space-y-0.5">
          {title ? (
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-sky-800 dark:text-sky-200">{title}</p>
          ) : null}
          <div className="text-[10px] leading-snug text-slate-700 dark:text-slate-300 [&_a]:text-[10px]">{children}</div>
        </div>
      </div>
    </div>
  )
}
