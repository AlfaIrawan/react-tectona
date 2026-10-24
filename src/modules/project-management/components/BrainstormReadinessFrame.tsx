import type { ReactNode } from 'react'
import { PanelLeftClose, PanelLeftOpen, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BRAINSTORM_FLOATING_HEADER_CLASS, BRAINSTORM_FLOATING_PANEL_CLASS } from '../lib/brainstormFloatingPanel'

export function BrainstormReadinessFrame({ collapsed, onToggleCollapsed, confidence, inline = false, children }: {
  collapsed: boolean
  onToggleCollapsed: () => void
  confidence: number
  inline?: boolean
  children: ReactNode
}) {
  return (
    <div data-readiness-space className={cn('relative min-h-0 shrink-0 transition-[width] duration-[240ms] motion-reduce:transition-none', inline ? 'w-full' : collapsed ? 'w-[72px]' : 'w-[432px]')}>
      <aside aria-label="Draft Readiness" data-readiness-floating className={cn(
        BRAINSTORM_FLOATING_PANEL_CLASS,
        'flex',
        inline ? 'relative m-3 max-h-[calc(42vh_-_1.5rem)] w-[calc(100%_-_1.5rem)]' : 'left-6 top-6 z-20',
        !inline && (collapsed ? 'h-12 w-12' : 'max-h-[min(760px,calc(100%_-_3rem))] w-96'),
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
            <div role="region" aria-label="Draft readiness details" tabIndex={0} className="scrollbar-hide min-h-0 flex-1 space-y-4 overflow-y-auto p-4" data-readiness-scroll>
              {children}
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
