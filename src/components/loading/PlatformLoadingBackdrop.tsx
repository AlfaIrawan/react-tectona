import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Shared gradient + grid backdrop (selaras react-tilia RouteLoadingFallback). */
export function PlatformLoadingBackdrop({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden px-6',
        'bg-[radial-gradient(circle_at_15%_20%,rgba(99,102,241,0.16),transparent_38%),radial-gradient(circle_at_85%_18%,rgba(14,165,233,0.14),transparent_42%),radial-gradient(circle_at_50%_100%,rgba(139,92,246,0.12),transparent_42%),linear-gradient(180deg,#eef2ff_0%,#f8fafc_45%,#f1f5f9_100%)]',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:42px_42px]" />
      <div className="pointer-events-none absolute -left-16 top-20 h-56 w-56 rounded-full bg-violet-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-16 h-64 w-64 rounded-full bg-sky-300/20 blur-3xl" />
      {children}
    </div>
  )
}

export function PlatformLoadingCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="relative w-full max-w-sm rounded-3xl border border-slate-200/70 bg-white/86 px-6 py-8 text-center shadow-[0_28px_80px_-48px_rgba(15,23,42,0.5)] backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-950/86">
      <div
        className="mx-auto h-11 w-11 animate-spin rounded-full border-2 border-slate-200 border-t-violet-600 dark:border-slate-700 dark:border-t-violet-500"
        aria-hidden
      />
      <p className="mt-4 text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
    </div>
  )
}
