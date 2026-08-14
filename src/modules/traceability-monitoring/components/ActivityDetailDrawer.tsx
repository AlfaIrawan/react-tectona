import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ActivityApi } from '@/lib/api/traceabilityMonitoringApi'
import {
  activityActorDisplay,
  formatActionLabel,
  formatEntityTypeLabel,
  formatOccurredAt,
} from '@/modules/traceability-monitoring/lib/activityMappers'

interface ActivityDetailDrawerProps {
  activity: ActivityApi | null
  onClose: () => void
  onShowInLineage: (activity: ActivityApi) => void
}

export function ActivityDetailDrawer({ activity, onClose, onShowInLineage }: ActivityDetailDrawerProps) {
  const open = activity !== null

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-[1090] bg-black/20 backdrop-blur-sm transition-opacity',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          'fixed right-0 top-0 z-[1100] h-full w-full max-w-md transform border-l border-border bg-card shadow-2xl transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-label="Activity detail"
      >
        {activity ? (
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {formatOccurredAt(activity.occurred_at)}
                </div>
                <h2 className="mt-1 truncate text-lg font-semibold">{formatActionLabel(activity.action)}</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actor</div>
                <div className="mt-1">{activityActorDisplay(activity)}</div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entity</div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="secondary">{formatEntityTypeLabel(activity.entity_type)}</Badge>
                  <span>{activity.entity_label ?? activity.entity_id}</span>
                </div>
              </div>

              {activity.related.length > 0 ? (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Related entities</div>
                  <ul className="mt-2 space-y-1.5">
                    {activity.related.map((ref, index) => (
                      <li key={`${ref.type}-${ref.id}-${index}`} className="flex items-center gap-2 text-xs">
                        <Badge variant="outline">{formatEntityTypeLabel(ref.type)}</Badge>
                        <span className="truncate text-muted-foreground">{ref.label ?? ref.id}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {activity.correlation_id ? (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Correlation ID</div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">{activity.correlation_id}</div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-border p-4">
              <Button className="w-full" onClick={() => onShowInLineage(activity)}>
                Show in lineage
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
