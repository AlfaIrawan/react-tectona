import type { ActivityApi } from '@/lib/api/traceabilityMonitoringApi'

export interface ActivityFilters {
  actorId: string
  action: string
  entityType: string
  from: string
  to: string
}

export const EMPTY_ACTIVITY_FILTERS: ActivityFilters = {
  actorId: '',
  action: '',
  entityType: '',
  from: '',
  to: '',
}

/** "work_item.updated" -> "Work Item Updated" */
export function formatActionLabel(action: string): string {
  return action
    .split('.')
    .join(' ')
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function formatEntityTypeLabel(entityType: string): string {
  return entityType
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function formatOccurredAt(occurredAt: string): string {
  const date = new Date(occurredAt)
  if (Number.isNaN(date.getTime())) return occurredAt
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function activityActorDisplay(activity: ActivityApi): string {
  return activity.actor_email || activity.actor_id
}
