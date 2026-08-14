import type { WorkItemApiModel } from '@/lib/api/workApi'
import { isSyntheticGanttSummaryId } from '@/modules/task-work-management/components/DirectoryGanttGridCells'
import type { PlanningGanttTaskGridEditEvent } from '@/modules/planning-scheduling/components/PlanningSvarGantt'
import { workItemHasChildren } from './resolveTimelineTaskSchedule'

function addDaysFromIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function defaultDurationDays(type: WorkItemApiModel['type']): number {
  if (type === 'Epic') return 90
  if (type === 'Feature') return 21
  return 10
}

function resolveItemStartDate(item: WorkItemApiModel): string {
  if (item.startDate?.trim()) return item.startDate.slice(0, 10)
  return addDaysFromIso(item.dueDate.slice(0, 10), -defaultDurationDays(item.type))
}

function durationDaysBetween(startDate: string, dueDate: string): number {
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime()
  const end = new Date(`${dueDate}T00:00:00.000Z`).getTime()
  const span = Math.round((end - start) / 86_400_000)
  if (span <= 0) return 0
  return Math.max(1, span)
}

export type ResolvedTimelineTaskInlineEdit = {
  valid: boolean
  message: string
  nextItem: WorkItemApiModel | null
  patchBody: {
    title?: string
    startDate?: string
    dueDate?: string
  } | null
}

export function resolveTimelineTaskInlineEdit(
  event: PlanningGanttTaskGridEditEvent,
  items: WorkItemApiModel[],
): ResolvedTimelineTaskInlineEdit {
  const taskId = String(event.id)
  if (isSyntheticGanttSummaryId(taskId)) {
    return { valid: false, message: 'This row cannot be edited.', nextItem: null, patchBody: null }
  }

  const item = items.find((entry) => entry.id === taskId)
  if (!item) {
    return { valid: false, message: 'Work item not found.', nextItem: null, patchBody: null }
  }

  if (event.field === 'title') {
    const title = String(event.value).trim()
    if (!title) {
      return { valid: false, message: 'Task title cannot be empty.', nextItem: null, patchBody: null }
    }
    if (title === item.title) {
      return { valid: true, message: '', nextItem: item, patchBody: null }
    }
    return {
      valid: true,
      message: '',
      nextItem: { ...item, title },
      patchBody: { title },
    }
  }

  if (workItemHasChildren(taskId, items)) {
    return {
      valid: false,
      message: 'Parent items inherit dates from children — edit a leaf task instead.',
      nextItem: null,
      patchBody: null,
    }
  }

  const currentStart = resolveItemStartDate(item)
  const currentDuration = durationDaysBetween(currentStart, item.dueDate.slice(0, 10))

  if (event.field === 'startDate') {
    const startDate = String(event.value).trim().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return { valid: false, message: 'Enter a valid start date.', nextItem: null, patchBody: null }
    }
    const dueDate =
      currentDuration === 0 ? startDate : addDaysFromIso(startDate, currentDuration)
    if (startDate === item.startDate && dueDate === item.dueDate.slice(0, 10)) {
      return { valid: true, message: '', nextItem: item, patchBody: null }
    }
    return {
      valid: true,
      message: '',
      nextItem: { ...item, startDate, dueDate },
      patchBody: { startDate, dueDate },
    }
  }

  if (event.field === 'durationDays') {
    const durationDays = Number(event.value)
    if (!Number.isFinite(durationDays) || durationDays < 0) {
      return { valid: false, message: 'Duration must be zero or greater.', nextItem: null, patchBody: null }
    }
    const dueDate = durationDays === 0 ? currentStart : addDaysFromIso(currentStart, durationDays)
    if (item.startDate === currentStart && item.dueDate.slice(0, 10) === dueDate) {
      return { valid: true, message: '', nextItem: item, patchBody: null }
    }
    return {
      valid: true,
      message: '',
      nextItem: { ...item, startDate: currentStart, dueDate },
      patchBody: { startDate: currentStart, dueDate },
    }
  }

  return { valid: false, message: 'Unsupported inline edit.', nextItem: null, patchBody: null }
}
