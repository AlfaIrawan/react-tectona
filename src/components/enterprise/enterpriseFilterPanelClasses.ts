import { cn } from '@/lib/utils'

/** Search & filter panel shell — matches Workspace Management. */
export const enterpriseFilterPanelClass = cn(
  'liquid-glass-enterprise-panel mb-0 shrink-0 space-y-3 rounded-2xl p-4',
  'border border-white/40 dark:border-white/10',
  'ring-1 ring-black/[0.04] dark:ring-white/[0.06]',
  'shadow-[0_16px_44px_rgba(15,23,42,0.10)] dark:shadow-[0_18px_52px_rgba(0,0,0,0.35)]',
  'bg-gradient-to-br from-white/70 via-background/75 to-slate-50/70 dark:from-slate-900/45 dark:via-background/40 dark:to-slate-950/20'
)

/** Idea Backlog — liquid glass filter panel shell (panel container only). */
export const ideaBacklogLiquidGlassFilterPanelClass = cn(
  'liquid-glass-enterprise-filter-bar mb-0 shrink-0 space-y-3 rounded-[1.35rem] border p-4',
)

export const ideaBacklogLiquidGlassFilterInputClass = cn(
  'liquid-glass-filter-input h-10 w-full pl-9',
  'bg-transparent shadow-none',
  'placeholder:text-slate-500/75 dark:placeholder:text-slate-400/70',
  'focus-visible:ring-0 focus-visible:ring-offset-0',
)

/** Idea Backlog — liquid glass card shell (grid cards + drag overlay). */
export const ideaBacklogLiquidGlassCardClass = cn(
  'liquid-glass-idea-card rounded-xl border p-4 transition-all h-full flex flex-col',
  'cursor-pointer select-none outline-none focus:outline-none',
)

export const ideaBacklogLiquidGlassCardMetaClass = cn(
  'mt-3 rounded-lg border border-white/45 bg-white/22 px-2 py-1.5 backdrop-blur-md',
  'dark:border-white/12 dark:bg-slate-950/28',
)

export const ideaBacklogLiquidGlassCardTagClass = cn(
  'rounded-full border border-white/50 bg-white/32 px-2 py-0.5 text-[11px] text-slate-600 backdrop-blur-sm',
  'dark:border-white/14 dark:bg-slate-950/32 dark:text-slate-300',
)

export const ideaBacklogLiquidGlassFilterPanelDividerClass =
  'pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.18)_14%,rgba(255,255,255,0.72)_50%,rgba(255,255,255,0.18)_86%,transparent_100%)] dark:bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.06)_14%,rgba(255,255,255,0.22)_50%,rgba(255,255,255,0.06)_86%,transparent_100%)]'

/** Idea Backlog — liquid glass shell for scoring / queue / intake panels (neutral, no blue tint). */
export const ideaBacklogLiquidGlassPanelClass = cn(
  'liquid-glass-enterprise-filter-bar rounded-2xl border bg-transparent shadow-sm',
)

export const ideaBacklogLiquidGlassPanelIconClass = cn(
  'inline-flex h-5 w-5 items-center justify-center rounded-md border border-white/50 bg-white/30 backdrop-blur-sm',
  'dark:border-white/14 dark:bg-slate-950/32',
)

export const ideaBacklogLiquidGlassPanelInsetClass = cn(
  'rounded-xl border border-white/45 bg-white/22 p-3.5 backdrop-blur-md',
  'dark:border-white/12 dark:bg-slate-950/28',
)

export const ideaBacklogLiquidGlassPanelStatClass = cn(
  'rounded-lg border border-white/45 bg-white/22 px-3 py-2 backdrop-blur-md',
  'dark:border-white/12 dark:bg-slate-950/28',
)

export const ideaBacklogLiquidGlassQueueItemClass = cn(
  'liquid-glass-idea-card w-full text-left rounded-xl border p-3 transition-all outline-none focus:outline-none',
)

export const ideaBacklogLiquidGlassQueueItemSelectedClass = cn(
  'liquid-glass-idea-card--selected',
)

export const ideaBacklogLiquidGlassMetricCardClass = cn(
  'group relative overflow-hidden rounded-2xl border px-4 py-3.5 backdrop-blur-md transition-all duration-300',
  'border-white/45 bg-white/22 hover:-translate-y-0.5 hover:bg-white/28',
  'shadow-[0_10px_30px_-22px_rgba(15,23,42,0.55)] hover:shadow-[0_18px_36px_-24px_rgba(15,23,42,0.52)]',
  'dark:border-white/12 dark:bg-slate-950/28 dark:hover:bg-slate-950/34',
)

export const enterpriseFilterPanelDividerClass =
  'pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent_0%,hsl(var(--border)/0.2)_18%,hsl(var(--border)/0.75)_50%,hsl(var(--border)/0.2)_82%,transparent_100%)]'

const filterTagBase =
  'inline-flex select-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm transition-all'

const filterTagOff =
  'border-border/60 bg-background/65 text-muted-foreground hover:bg-background/80 hover:text-foreground'

const filterTagOnRing =
  'ring-2 ring-offset-1 ring-offset-background hover:brightness-95 dark:hover:brightness-110'

type FilterTagVariant = 'sky' | 'emerald' | 'slate' | 'violet' | 'cyan' | 'amber'

const filterTagActiveVariants: Record<FilterTagVariant, string> = {
  sky: 'border-sky-400/30 bg-gradient-to-r from-sky-500/18 to-cyan-500/18 text-sky-950 ring-sky-500/25 dark:text-sky-100',
  emerald:
    'border-emerald-400/25 bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-950 ring-emerald-500/20 dark:text-emerald-100',
  slate:
    'border-slate-400/25 bg-gradient-to-r from-slate-400/15 to-slate-500/15 text-slate-900 ring-slate-500/20 dark:text-slate-100',
  violet:
    'border-violet-400/25 bg-gradient-to-r from-violet-500/14 to-purple-500/14 text-violet-950 ring-violet-500/20 dark:text-violet-100',
  cyan: 'border-cyan-400/25 bg-gradient-to-r from-cyan-500/15 to-sky-500/15 text-cyan-950 ring-cyan-500/20 dark:text-cyan-100',
  amber:
    'border-amber-400/25 bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-950 ring-amber-500/20 dark:text-amber-100',
}

export function enterpriseFilterTagClass(active: boolean, variant: FilterTagVariant): string {
  if (!active) return cn(filterTagBase, filterTagOff)
  return cn(filterTagBase, filterTagOnRing, filterTagActiveVariants[variant])
}
