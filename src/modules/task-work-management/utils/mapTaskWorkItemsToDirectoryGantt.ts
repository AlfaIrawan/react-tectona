import {
  normalizeGanttProjectName,
  type PlanningGanttItem,
} from '@/modules/planning-scheduling/components/PlanningSvarGantt'
import type { WorkItemSourceKind } from '@/modules/task-work-management/components/DirectoryGanttGridCells'

type WorkItemExternalLink = {
  provider: string
}

type DirectoryGanttWorkItem = {
  id: string
  title: string
  type: string
  project: string
  workspace: string
  label?: string
  team: string
  assignee: string
  owner: string
  startDate?: string
  dueDate?: string
  progress: number
  parentId?: string | null
  epicId?: string | null
  featureId?: string | null
  syncOrigin?: string
  externalLinks?: WorkItemExternalLink[]
}

function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
}

function mapWorkTypeToScheduleType(type: string, start: Date, end: Date): PlanningGanttItem['type'] {
  const spanDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000))
  if (start.getTime() === end.getTime() || spanDays === 0) return 'Milestone'
  if (type === 'Epic' || type === 'Feature') return 'Phase'
  return 'Workstream'
}

function resolveWorkItemParentId(item: DirectoryGanttWorkItem, itemIds: Set<string>): string | null {
  if (item.parentId && itemIds.has(item.parentId)) return item.parentId
  if (item.featureId && itemIds.has(item.featureId)) return item.featureId
  if (item.epicId && itemIds.has(item.epicId)) return item.epicId
  return null
}

function resolveWorkItemSource(item: DirectoryGanttWorkItem): WorkItemSourceKind {
  const providers = new Set(item.externalLinks?.map((link) => link.provider) ?? [])
  if (item.syncOrigin === 'monday' || providers.has('monday')) return 'monday'
  if (item.syncOrigin === 'jira' || providers.has('jira')) return 'jira'
  return 'tectona'
}

/** Map filtered directory work items → Planning Gantt rows with parent-child tree metadata. */
export function mapTaskWorkItemsToDirectoryGantt(items: DirectoryGanttWorkItem[]): PlanningGanttItem[] {
  const itemIds = new Set(items.map((entry) => entry.id))
  const result: PlanningGanttItem[] = []

  items.forEach((item, listOrder) => {
    const hasDueDate = Boolean(item.dueDate?.trim())
    const hasStartDate = Boolean(item.startDate?.trim())

    let startDate = ''
    let endDate = ''
    let scheduleType: PlanningGanttItem['type'] = 'Workstream'

    if (hasDueDate || hasStartDate) {
      const end = parseIsoDate(item.dueDate?.trim() || item.startDate!.trim())
      const start = hasStartDate ? parseIsoDate(item.startDate!.trim()) : end
      const rangeStart = start.getTime() <= end.getTime() ? start : end
      const rangeEnd = start.getTime() <= end.getTime() ? end : start
      startDate = rangeStart.toISOString().slice(0, 10)
      endDate = rangeEnd.toISOString().slice(0, 10)
      scheduleType = mapWorkTypeToScheduleType(item.type, rangeStart, rangeEnd)
    }

    result.push({
      id: item.id,
      title: item.title,
      workspace: item.workspace?.trim() || '—',
      project: normalizeGanttProjectName(item.project),
      team: item.team?.trim() || '—',
      owner: item.owner?.trim() || item.assignee?.trim() || '—',
      sprint: item.label?.trim() || '—',
      type: scheduleType,
      startDate,
      endDate,
      progress: Math.max(0, Math.min(100, item.progress ?? 0)),
      parentId: resolveWorkItemParentId(item, itemIds),
      listOrder,
      workItemType: item.type,
      label: item.label?.trim() || '',
      itemSource: resolveWorkItemSource(item),
    })
  })

  return result
}
