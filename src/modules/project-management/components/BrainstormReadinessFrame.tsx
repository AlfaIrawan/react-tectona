import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BRAINSTORM_FLOATING_HEADER_CLASS, BRAINSTORM_FLOATING_PANEL_CLASS } from '../lib/brainstormFloatingPanel'

export function BrainstormReadinessFrame({ collapsed, onToggleCollapsed, confidence, inline = false, inlineExpanded, onToggleInline, children }: {
  collapsed: boolean
  onToggleCollapsed: () => void
  confidence: number
  inline?: boolean
  inlineExpanded?: boolean
  onToggleInline?: () => void
  children: ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const bodyId = useId()
  const inlineOpen = inlineExpanded ?? expanded
  if (inline) {
    return (
      <aside aria-label="Draft Readiness" className="brainstorm-readiness-inline min-w-0 border-b border-border/70 bg-background/70 backdrop-blur-xl">
        <button type="button" aria-expanded={inlineOpen} aria-controls={bodyId} onClick={onToggleInline ?? (() => setExpanded(value => !value))} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left" title={inlineOpen ? 'Collapse readiness panel' : 'Expand readiness panel'}>
          <Target className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Draft Readiness</span>
            <span className="block text-xs tabular-nums text-muted-foreground">{confidence}% confidence</span>
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', inlineOpen && 'rotate-180')} aria-hidden />
        </button>
        <div className="mx-4 mb-2 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Draft confidence" aria-valuemin={0} aria-valuemax={100} aria-valuenow={confidence}>
          <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.max(0, Math.min(100, confidence))}%` }} />
        </div>
        <div id={bodyId} hidden={!inlineOpen} className="max-h-[32dvh] overflow-y-auto overscroll-contain border-t border-border/60" tabIndex={inlineOpen ? 0 : undefined}>
          <div data-readiness-body className="flex flex-col gap-3 p-4">{children}</div>
        </div>
      </aside>
    )
  }
  return (
    <div data-readiness-space className={cn('relative min-h-0 shrink-0 transition-[width] duration-[240ms] motion-reduce:transition-none', inline ? 'w-full' : collapsed ? 'w-[72px]' : 'w-[432px]')}>
      <aside aria-label="Draft Readiness" data-readiness-floating className={cn(
        BRAINSTORM_FLOATING_PANEL_CLASS,
        'flex',
        inline ? 'relative m-3 w-[calc(100%_-_1.5rem)]' : 'left-6 top-6 z-20',
        collapsed ? 'h-12 w-12' : inline ? 'h-[calc(42vh_-_1.5rem)]' : 'bottom-6 w-96',
      )}>
        {collapsed ? (
          <button type="button" onClick={onToggleCollapsed} title={`Expand readiness panel (${confidence}% confidence)`} aria-label="Expand readiness panel" className="m-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-muted">
            <PanelLeftOpen className="h-4 w-4" />
            <span className="sr-only">{confidence}% confidence</span>
          </button>
        ) : (
          <>
            <header className={BRAINSTORM_FLOATING_HEADER_CLASS}>
              <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground"><Target className="h-4 w-4 shrink-0" aria-hidden />Draft Readiness</h2>
              <button type="button" onClick={onToggleCollapsed} title="Collapse readiness panel" aria-label="Collapse readiness panel" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted"><PanelLeftClose className="h-4 w-4" /></button>
            </header>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4" data-readiness-body>
              {children}
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
