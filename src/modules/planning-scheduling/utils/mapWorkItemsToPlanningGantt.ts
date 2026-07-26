import type { WorkItemApiModel, WorkItemType } from '@/lib/api/workApi'
import type { WorkspaceOrgWorkspaceDto } from '@/lib/api/workspaceOrgApi'
import {
  allWorkspacePickerNames,
  buildWorkspaceLabelLookup,
  buildWorkspacePickerGroups,
  resolveWorkItemWorkspaceLabel,
  UNIDENTIFIED_WORKSPACE_LABEL,
} from '@/lib/work/workspacePickerGroups'
import type { PlanningGanttItem } from '@/modules/planning-scheduling/components/PlanningSvarGantt'
import type { WorkItemSourceKind } from '@/modules/task-work-management/components/DirectoryGanttGridCells'

function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
}

function daySpanInclusive(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime()
  return Math.max(0, Math.round(ms / 86_400_000))
}

function mapWorkTypeToScheduleType(
  type: WorkItemType,
  start: Date,
  end: Date,
): PlanningGanttItem['type'] {
  if (start.getTime() === end.getTime() || daySpanInclusive(start, end) === 0) {
    return 'Milestone'
  }
  if (type === 'Epic' || type === 'Feature') return 'Phase'
  return 'Workstream'
}

export type PlanningGanttModel = {
  items: PlanningGanttItem[]
  /** Tectona workspaces first, then Monday — matches workspace picker order. */
  workspaceOrder: string[]
}

function resolveWorkItemSource(item: WorkItemApiModel): WorkItemSourceKind {
  const providers = new Set(item.externalLinks?.map((link) => link.provider) ?? [])
  if (item.syncOrigin === 'monday' || providers.has('monday')) return 'monday'
  if (item.syncOrigin === 'jira' || providers.has('jira')) return 'jira'
  return 'tectona'
}

/** Map Work Management API rows → workspace-owned Gantt timeline items (picker-aligned labels). */
export function mapWorkItemsToPlanningGantt(
  items: WorkItemApiModel[],
  orgWorkspaces: Array<Pick<WorkspaceOrgWorkspaceDto, 'workspace_key' | 'name'>>,
): PlanningGanttModel {
  const pickerGroups = buildWorkspacePickerGroups(orgWorkspaces, items)
  const labelLookup = buildWorkspaceLabelLookup(orgWorkspaces)
  const result: PlanningGanttItem[] = []

  for (const item of items) {
    if (!item.dueDate?.trim()) continue

    const workspaceLabel = resolveWorkItemWorkspaceLabel(item, labelLookup, pickerGroups)

    const end = parseIsoDate(item.dueDate)
    const start = item.startDate?.trim() ? parseIsoDate(item.startDate) : end
    const rangeStart = start.getTime() <= end.getTime() ? start : end
    const rangeEnd = start.getTime() <= end.getTime() ? end : start

    result.push({
      id: item.id,
      title: item.title,
      workspace: workspaceLabel,
      project: item.project?.trim() || 'Unassigned project',
      team: item.team?.trim() || '—',
      owner: item.owner?.trim() || item.assignee?.trim() || '—',
      sprint: item.label?.trim() || '—',
      type: mapWorkTypeToScheduleType(item.type, rangeStart, rangeEnd),
      startDate: rangeStart.toISOString().slice(0, 10),
      endDate: rangeEnd.toISOString().slice(0, 10),
      progress: Math.max(0, Math.min(100, item.progress ?? 0)),
      workItemType: item.type,
      label: item.label?.trim() || '',
      itemSource: resolveWorkItemSource(item),
    })
  }

  result.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title))

  const workspaceOrder = [...allWorkspacePickerNames(pickerGroups)]
  if (result.some((item) => item.workspace === UNIDENTIFIED_WORKSPACE_LABEL)) {
    workspaceOrder.push(UNIDENTIFIED_WORKSPACE_LABEL)
  }

  return { items: result, workspaceOrder }
}
