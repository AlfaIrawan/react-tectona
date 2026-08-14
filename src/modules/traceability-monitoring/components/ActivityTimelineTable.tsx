import { Badge } from '@/components/ui/badge'
import type { ActivityApi } from '@/lib/api/traceabilityMonitoringApi'
import {
  activityActorDisplay,
  formatActionLabel,
  formatEntityTypeLabel,
  formatOccurredAt,
} from '@/modules/traceability-monitoring/lib/activityMappers'

interface ActivityTimelineTableProps {
  activities: ActivityApi[]
  loading?: boolean
  onSelect: (activity: ActivityApi) => void
}

export function ActivityTimelineTable({ activities, loading, onSelect }: ActivityTimelineTableProps) {
  if (loading) {
    return <div className="rounded-xl border border-border/60 p-8 text-center text-sm text-muted-foreground">Loading activity…</div>
  }

  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
        No activity recorded yet for this workspace and filter selection.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-semibold">Time</th>
            <th className="px-3 py-2 font-semibold">Actor</th>
            <th className="px-3 py-2 font-semibold">Action</th>
            <th className="px-3 py-2 font-semibold">Entity</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {activities.map((activity) => (
            <tr
              key={activity.id}
              className="cursor-pointer bg-card/40 transition-colors hover:bg-muted/40"
              onClick={() => onSelect(activity)}
            >
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatOccurredAt(activity.occurred_at)}</td>
              <td className="px-3 py-2">{activityActorDisplay(activity)}</td>
              <td className="px-3 py-2 font-medium">{formatActionLabel(activity.action)}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-normal">
                    {formatEntityTypeLabel(activity.entity_type)}
                  </Badge>
                  <span className="truncate text-muted-foreground">{activity.entity_label ?? activity.entity_id}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
