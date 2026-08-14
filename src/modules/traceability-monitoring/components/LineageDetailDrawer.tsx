import { ExternalLink, X } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { LineageNeighborsResponse } from '@/lib/api/traceabilityMonitoringApi'
import { lineageEntityStyle } from '@/modules/traceability-monitoring/lib/lineageLayout'
import { formatEntityTypeLabel } from '@/modules/traceability-monitoring/lib/activityMappers'

interface LineageDetailDrawerProps {
  open: boolean
  loading: boolean
  neighbors: LineageNeighborsResponse | null
  sorHref: string | null
  onClose: () => void
  onSelectNode: (entityType: string, entityId: string) => void
}

export function LineageDetailDrawer({ open, loading, neighbors, sorHref, onClose, onSelectNode }: LineageDetailDrawerProps) {
  const style = neighbors ? lineageEntityStyle(neighbors.node.type) : null

  return (
    <div
      className={cn(
        'absolute right-3 top-3 bottom-3 z-30 w-full max-w-sm transform overflow-hidden rounded-2xl border border-border/70 bg-card/98 shadow-2xl backdrop-blur transition-transform duration-200',
        open ? 'translate-x-0' : 'pointer-events-none translate-x-[calc(100%+1rem)]'
      )}
      role="dialog"
      aria-label="Lineage node detail"
    >
      {neighbors ? (
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-2 border-b border-border/70 p-4">
            <div className="min-w-0">
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ backgroundColor: style?.chipBg, color: style?.chipText }}
              >
                {formatEntityTypeLabel(neighbors.node.type)}
              </span>
              <h3 className="mt-1.5 truncate text-base font-semibold">{neighbors.node.label}</h3>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
            {neighbors.incoming.length > 0 ? (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Incoming</div>
                <ul className="mt-2 space-y-1.5">
                  {neighbors.incoming.map((edge) => {
                    const [type, ...rest] = edge.source.split(':')
                    return (
                      <li key={edge.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg border border-border/60 px-2.5 py-1.5 text-left text-xs hover:bg-muted/50"
                          onClick={() => onSelectNode(type, rest.join(':'))}
                        >
                          <Badge variant="outline">{edge.relation}</Badge>
                          <span className="truncate text-muted-foreground">from {formatEntityTypeLabel(type)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}

            {neighbors.outgoing.length > 0 ? (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outgoing</div>
                <ul className="mt-2 space-y-1.5">
                  {neighbors.outgoing.map((edge) => {
                    const [type, ...rest] = edge.target.split(':')
                    return (
                      <li key={edge.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg border border-border/60 px-2.5 py-1.5 text-left text-xs hover:bg-muted/50"
                          onClick={() => onSelectNode(type, rest.join(':'))}
                        >
                          <Badge variant="outline">{edge.relation}</Badge>
                          <span className="truncate text-muted-foreground">to {formatEntityTypeLabel(type)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}

            {neighbors.incoming.length === 0 && neighbors.outgoing.length === 0 ? (
              <p className="text-xs text-muted-foreground">No direct relations recorded for this entity yet.</p>
            ) : null}
          </div>

          {sorHref ? (
            <div className="border-t border-border/70 p-4">
              <a
                href={sorHref}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: 'default' }), 'w-full gap-1.5 no-underline')}
              >
                Open in source module
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : null}
        </div>
      ) : loading ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading node…</div>
      ) : null}
    </div>
  )
}
