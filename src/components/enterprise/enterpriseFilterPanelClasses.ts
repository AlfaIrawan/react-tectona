import { cn } from '@/lib/utils'

/** Search & filter panel shell — matches Workspace Management. */
export const enterpriseFilterPanelClass = cn(
  'glass-card mb-0 shrink-0 space-y-3 rounded-2xl p-4',
  'border border-white/40 dark:border-white/10',
  'ring-1 ring-black/[0.04] dark:ring-white/[0.06]',
  'shadow-[0_16px_44px_rgba(15,23,42,0.10)] dark:shadow-[0_18px_52px_rgba(0,0,0,0.35)]',
  'bg-gradient-to-br from-white/70 via-background/75 to-slate-50/70 dark:from-slate-900/45 dark:via-background/40 dark:to-slate-950/20'
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
