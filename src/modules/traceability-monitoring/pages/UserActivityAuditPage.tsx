import { useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTenantContextOptional } from '@/auth/TenantContext'
import { useWorkspaceNavigate, useWorkspacePath } from '@/hooks/useWorkspaceNavigate'
import type { ActivityApi } from '@/lib/api/traceabilityMonitoringApi'
import { ActivityDetailDrawer } from '@/modules/traceability-monitoring/components/ActivityDetailDrawer'
import { ActivityFiltersBar } from '@/modules/traceability-monitoring/components/ActivityFiltersBar'
import { ActivityTimelineTable } from '@/modules/traceability-monitoring/components/ActivityTimelineTable'
import { useActivitiesQuery } from '@/modules/traceability-monitoring/hooks/useActivitiesQuery'
import { EMPTY_ACTIVITY_FILTERS, type ActivityFilters } from '@/modules/traceability-monitoring/lib/activityMappers'
import { TRACEABILITY_LINEAGE_PATH } from '@/modules/traceability-monitoring/paths'

const PAGE_SIZE = 20

export function UserActivityAuditPage() {
  const tenant = useTenantContextOptional()
  const workspaceNavigate = useWorkspaceNavigate()
  const egmAuditHref = useWorkspacePath('/enterprise-governance-model/traceability/audit')

  const [filters, setFilters] = useState<ActivityFilters>(EMPTY_ACTIVITY_FILTERS)
  const [page, setPage] = useState(1)
  const [selectedActivity, setSelectedActivity] = useState<ActivityApi | null>(null)

  const queryParams = useMemo(
    () => ({
      workspaceId: tenant?.workspaceId,
      actorId: filters.actorId || undefined,
      action: filters.action || undefined,
      entityType: filters.entityType || undefined,
      from: filters.from ? new Date(filters.from).toISOString() : undefined,
      to: filters.to ? new Date(filters.to).toISOString() : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [tenant?.workspaceId, filters, page],
  )

  const { data, isLoading, isError } = useActivitiesQuery(queryParams)

  const handleFiltersChange = (next: ActivityFilters) => {
    setFilters(next)
    setPage(1)
  }

  const handleShowInLineage = (activity: ActivityApi) => {
    setSelectedActivity(null)
    const search = new URLSearchParams({ rootType: activity.entity_type, rootId: activity.entity_id })
    workspaceNavigate(`${TRACEABILITY_LINEAGE_PATH}?${search.toString()}`)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <ActivityFiltersBar filters={filters} onChange={handleFiltersChange} />
        <a
          href={egmAuditHref}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0 gap-1.5 no-underline')}
        >
          EGM governance audit
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {isError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load activity. Confirm the Tectona Activity & Lineage service is running.
        </div>
      ) : (
        <ActivityTimelineTable activities={data?.items ?? []} loading={isLoading} onSelect={setSelectedActivity} />
      )}

      {total > PAGE_SIZE ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {totalPages} · {total} activities
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <ActivityDetailDrawer
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
        onShowInLineage={handleShowInLineage}
      />
    </div>
  )
}
