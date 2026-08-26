import { cn } from '@/lib/utils'

/** Hilangkan outline hitam browser; ring halus hanya saat keyboard focus-visible. */
export function enterpriseControlFocusClass(): string {
  return cn(
    'outline-none focus:outline-none focus-visible:outline-none',
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
  )
}

/** Primary CTA — selaras Tilia `registerServicePrimaryButtonClass`. */
export function registerServicePrimaryButtonClass(): string {
  return cn('gap-2 h-10 px-4 rounded-lg text-sm font-semibold tracking-tight', enterpriseControlFocusClass())
}

const GRADIENT_ACTION_FOCUS = enterpriseControlFocusClass()

/** Tombol aksi gradient (Assign Governance, New Workspace, …) — tanpa outline hitam browser saat fokus. */
export function enterpriseCyanGradientActionButtonClass(): string {
  return cn(
    'group relative inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap overflow-hidden rounded-2xl px-4 text-[13.5px] font-semibold tracking-tight text-white',
    GRADIENT_ACTION_FOCUS,
    'border border-cyan-200/80 bg-gradient-to-br from-sky-400 via-blue-500 to-blue-700',
    'shadow-[0_6px_16px_rgba(37,99,235,0.24),0_0_0_1px_rgba(103,232,249,0.28)] ring-1 ring-sky-300/35',
    'transition-all duration-200',
    'hover:from-sky-400 hover:via-blue-500 hover:to-blue-600',
    'hover:shadow-[0_8px_18px_rgba(37,99,235,0.28),0_0_0_1px_rgba(125,211,252,0.38),0_0_18px_rgba(56,189,248,0.18)] hover:ring-sky-300/45',
    'active:scale-[0.98] active:shadow-[0_4px_10px_rgba(37,99,235,0.22),0_0_0_1px_rgba(103,232,249,0.24)]',
    'focus-visible:ring-2 focus-visible:ring-sky-400/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
  )
}

export function enterpriseIndigoGradientActionButtonClass(): string {
  return cn(
    'group relative inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap overflow-hidden rounded-2xl px-4 text-[13.5px] font-semibold tracking-tight text-white',
    GRADIENT_ACTION_FOCUS,
    'border border-indigo-200/80 bg-gradient-to-br from-indigo-400 via-violet-500 to-purple-700',
    'shadow-[0_6px_16px_rgba(99,102,241,0.24),0_0_0_1px_rgba(167,139,250,0.28)] ring-1 ring-indigo-300/35',
    'transition-all duration-200',
    'hover:from-indigo-400 hover:via-violet-500 hover:to-purple-600',
    'hover:shadow-[0_8px_18px_rgba(99,102,241,0.28),0_0_0_1px_rgba(167,139,250,0.38),0_0_18px_rgba(139,92,246,0.18)] hover:ring-indigo-300/45',
    'active:scale-[0.98] active:shadow-[0_4px_10px_rgba(99,102,241,0.22),0_0_0_1px_rgba(167,139,250,0.24)]',
    'focus-visible:ring-2 focus-visible:ring-indigo-400/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
  )
}

/** Destructive gradient CTA — selaras cyan/indigo pill (Reject, Delete, …). */
export function enterpriseRoseGradientActionButtonClass(): string {
  return cn(
    'group relative inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap overflow-hidden rounded-2xl px-4 text-[13.5px] font-semibold tracking-tight text-white',
    GRADIENT_ACTION_FOCUS,
    'border border-rose-200/80 bg-gradient-to-br from-rose-400 via-rose-500 to-red-700',
    'shadow-[0_6px_16px_rgba(225,29,72,0.22),0_0_0_1px_rgba(253,164,175,0.28)] ring-1 ring-rose-300/35',
    'transition-all duration-200',
    'hover:from-rose-400 hover:via-rose-500 hover:to-red-600',
    'hover:shadow-[0_8px_18px_rgba(225,29,72,0.28),0_0_0_1px_rgba(253,164,175,0.38),0_0_18px_rgba(244,63,94,0.16)] hover:ring-rose-300/45',
    'active:scale-[0.98] active:shadow-[0_4px_10px_rgba(225,29,72,0.2),0_0_0_1px_rgba(253,164,175,0.24)]',
    'focus-visible:ring-2 focus-visible:ring-rose-400/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
  )
}

/** Secondary / cancel — selaras Tilia `enterpriseSecondaryButtonClass`. */
export function enterpriseSecondaryButtonClass(): string {
  return cn(
    'inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap px-4 rounded-lg text-sm font-semibold tracking-tight',
    'border border-slate-300/90 bg-background/95 text-foreground',
    'shadow-sm hover:shadow-md',
    'hover:!bg-slate-100 hover:!text-foreground dark:hover:!bg-slate-800/70 dark:hover:!text-foreground',
    'hover:border-slate-400/90 dark:hover:border-slate-500/80',
    'transition-[transform,box-shadow,background-color,border-color,color] duration-200 ease-out',
    'hover:-translate-y-px active:translate-y-0',
    enterpriseControlFocusClass()
  )
}
