import type { WorkItemApiModel } from '@/lib/api/workApi'
import type { PlanningGanttItem } from '@/modules/planning-scheduling/components/PlanningSvarGantt'
import { TECTONA_PROJECT_WORKSPACE } from '@/lib/api/workApi'
import type { ProjectTemplate } from '../data/projectTemplates'
import type { Project } from '../store/projectStore'

function hashProjectSeed(projectId: string): number {
  let hash = 0
  for (let i = 0; i < projectId.length; i += 1) {
    hash = (hash * 31 + projectId.charCodeAt(i)) >>> 0
  }
  return hash
}

function seededValue(seed: number, min: number, max: number, salt = 0): number {
  const normalized = ((seed + salt * 9973) % 1000) / 1000
  return Math.round(min + normalized * (max - min))
}

function addDaysFromIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function resolveAnchorDate(project: Project): string {
  const fromCreated = project.createdAt?.slice(0, 10)
  if (fromCreated && /^\d{4}-\d{2}-\d{2}$/.test(fromCreated)) return fromCreated
  return new Date().toISOString().slice(0, 10)
}

/** Build schedule rows for the project Timeline Gantt (project-tree layout). */
export function buildProjectTimelineGanttItems(
  project: Project,
  options?: { ownerName?: string; template?: ProjectTemplate },
): PlanningGanttItem[] {
  const seed = hashProjectSeed(project.id)
  const anchor = resolveAnchorDate(project)
  const owner = options?.ownerName?.trim() || 'Unassigned'
  const team = 'Delivery Squad'
  const workspace = 'Tectona Workspace'
  const sprint = 'Sprint 1'
  const label = options?.template?.name ?? 'Delivery'

  const epicId = `${project.id}-timeline-epic`
  const epicDuration = seededValue(seed, 48, 78, 1)
  const epicStart = anchor
  const epicEnd = addDaysFromIso(anchor, epicDuration)

  const childBlueprints: Array<{
    idSuffix: string
    title: string
    type: PlanningGanttItem['type']
    workItemType: string
    startOffset: number
    duration: number
    progress: number
    predecessorSuffix?: string
  }> = [
    {
      idSuffix: 'm-kickoff',
      title: 'Kickoff checkpoint',
      type: 'Milestone',
      workItemType: 'Milestone',
      startOffset: 0,
      duration: 0,
      progress: 100,
    },
    {
      idSuffix: 'f-board',
      title: 'Board baseline & workflow',
      type: 'Workstream',
      workItemType: 'Feature',
      startOffset: 2,
      duration: seededValue(seed, 10, 18, 2),
      progress: seededValue(seed, 55, 92, 3),
    },
    {
      idSuffix: 't-wip',
      title: 'WIP policy rollout',
      type: 'Workstream',
      workItemType: 'Task',
      startOffset: 8,
      duration: seededValue(seed, 8, 14, 4),
      progress: seededValue(seed, 40, 78, 5),
      predecessorSuffix: 'f-board',
    },
    {
      idSuffix: 't-assign',
      title: 'Assignment & ownership mapping',
      type: 'Workstream',
      workItemType: 'Task',
      startOffset: 12,
      duration: seededValue(seed, 6, 12, 6),
      progress: seededValue(seed, 35, 70, 7),
    },
    {
      idSuffix: 'm-wip-live',
      title: 'WIP policy live',
      type: 'Milestone',
      workItemType: 'Milestone',
      startOffset: seededValue(seed, 20, 28, 8),
      duration: 0,
      progress: seededValue(seed, 0, 45, 9),
      predecessorSuffix: 't-wip',
    },
    {
      idSuffix: 'f-throughput',
      title: 'Throughput instrumentation',
      type: 'Workstream',
      workItemType: 'Feature',
      startOffset: 18,
      duration: seededValue(seed, 12, 20, 10),
      progress: seededValue(seed, 20, 55, 11),
    },
    {
      idSuffix: 't-blockers',
      title: 'Blocker register integration',
      type: 'Workstream',
      workItemType: 'Task',
      startOffset: 24,
      duration: seededValue(seed, 7, 13, 12),
      progress: seededValue(seed, 15, 48, 13),
    },
    {
      idSuffix: 'm-rc',
      title: 'Release candidate',
      type: 'Milestone',
      workItemType: 'Milestone',
      startOffset: seededValue(seed, 38, 52, 14),
      duration: 0,
      progress: 0,
    },
    {
      idSuffix: 't-hardening',
      title: 'Flow hardening & QA pass',
      type: 'Workstream',
      workItemType: 'Task',
      startOffset: 32,
      duration: seededValue(seed, 10, 16, 15),
      progress: seededValue(seed, 5, 35, 16),
      predecessorSuffix: 'f-throughput',
    },
  ]

  const epicTitle = options?.template?.name
    ? `${options.template.name} delivery track`
    : `${project.name} delivery track`

  const items: PlanningGanttItem[] = [
    {
      id: epicId,
      title: epicTitle,
      workspace,
      project: project.name,
      team,
      owner,
      sprint,
      type: 'Phase',
      startDate: epicStart,
      endDate: epicEnd,
      progress: seededValue(seed, 38, 68, 17),
      parentId: null,
      listOrder: 0,
      workItemType: 'Epic',
      label,
      itemSource: 'tectona',
    },
  ]

  childBlueprints.forEach((blueprint, index) => {
    const id = `${project.id}-timeline-${blueprint.idSuffix}`
    const startDate = addDaysFromIso(anchor, blueprint.startOffset)
    const endDate =
      blueprint.type === 'Milestone' ? startDate : addDaysFromIso(startDate, Math.max(1, blueprint.duration))

    items.push({
      id,
      title: blueprint.title,
      workspace,
      project: project.name,
      team,
      owner,
      sprint,
      type: blueprint.type,
      startDate,
      endDate,
      progress: blueprint.progress,
      parentId: epicId,
      predecessorId: blueprint.predecessorSuffix
        ? `${project.id}-timeline-${blueprint.predecessorSuffix}`
        : undefined,
      listOrder: index + 1,
      workItemType: blueprint.workItemType,
      label,
      itemSource: 'tectona',
    })
  })

  return items
}

function defaultDurationDays(type: WorkItemApiModel['type']): number {
  if (type === 'Epic') return 90
  if (type === 'Feature') return 21
  return 10
}

function mapWorkItemGanttType(item: WorkItemApiModel): PlanningGanttItem['type'] {
  if (item.type === 'Epic') return 'Phase'
  if (item.progress >= 100 && item.type === 'Task') return 'Milestone'
  return 'Workstream'
}

/** Build Gantt rows from the same work items used by Board & Summary. */
export function buildProjectTimelineGanttItemsFromWorkItems(
  workItems: WorkItemApiModel[],
  project: Project,
  options?: { ownerName?: string },
): PlanningGanttItem[] {
  if (workItems.length === 0) return []

  const owner = options?.ownerName?.trim() || 'Unassigned'
  const workspace = TECTONA_PROJECT_WORKSPACE
  const team = 'Delivery Squad'
  const sprint = 'Banking Delivery'
  const label = workItems[0]?.label ?? 'Banking System'

  const sorted = [...workItems].sort((a, b) => {
    const typeOrder = { Epic: 0, Feature: 1, Task: 2, Bug: 2, Subtask: 3, Checklist: 4 }
    const left = typeOrder[a.type] ?? 5
    const right = typeOrder[b.type] ?? 5
    if (left !== right) return left - right
    return a.dueDate.localeCompare(b.dueDate)
  })

  const items: PlanningGanttItem[] = []
  sorted.forEach((item, index) => {
    const duration = defaultDurationDays(item.type)
    const endDate = item.dueDate
    const startDate = item.startDate ?? addDaysFromIso(endDate, -duration)
    const ganttType = mapWorkItemGanttType(item)

    items.push({
      id: item.id,
      title: item.title,
      workspace,
      project: project.name,
      team,
      owner: item.assignee || owner,
      sprint,
      type: ganttType,
      startDate: ganttType === 'Milestone' ? endDate : startDate,
      endDate,
      progress: item.progress ?? 0,
      parentId: item.parentId ?? null,
      listOrder: index,
      workItemType: item.type,
      label: item.label ?? label,
      itemSource: 'tectona',
    })
  })

  return items
}
