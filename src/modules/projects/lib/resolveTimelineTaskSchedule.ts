import type { WorkItemApiModel } from '@/lib/api/workApi'
import { isSyntheticGanttSummaryId } from '@/modules/task-work-management/components/DirectoryGanttGridCells'
import { resolveWorkItemParentId } from '@/modules/task-work-management/lib/workItemTreeValidation'

export type TimelineTaskScheduleUpdateEvent = {
  id: string
  startDate: string
  endDate: string
  durationDays: number
  progress?: number
}

export type ResolvedTimelineTaskSchedule = {
  valid: boolean
  message: string
  update: TimelineTaskScheduleUpdateEvent | null
}

function ganttDateToIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function durationDaysBetween(start: Date, end: Date): number {
  const span = Math.round((end.getTime() - start.getTime()) / 86_400_000)
  if (span <= 0) return 0
  return Math.max(1, span)
}

export function workItemHasChildren(itemId: string, items: WorkItemApiModel[]): boolean {
  const itemIds = new Set(items.map((item) => item.id))
  return items.some((item) => resolveWorkItemParentId(item, itemIds) === itemId)
}

export function resolveTimelineTaskScheduleUpdate(
  id: string,
  task: { start?: Date; end?: Date; progress?: number },
  items: WorkItemApiModel[],
): ResolvedTimelineTaskSchedule {
  const taskId = String(id)
  if (isSyntheticGanttSummaryId(taskId)) {
    return {
      valid: false,
      message: 'Summary rows cannot be rescheduled on the chart.',
      update: null,
    }
  }

  const workItem = items.find((item) => item.id === taskId)
  if (!workItem) {
    return { valid: false, message: 'Work item not found.', update: null }
  }

  if (workItemHasChildren(taskId, items)) {
    return {
      valid: false,
      message: 'Parent items inherit dates from children — edit a leaf task bar instead.',
      update: null,
    }
  }

  const start = task.start
  const end = task.end ?? task.start
  if (!start || !end) {
    return { valid: false, message: 'Start and end dates are required.', update: null }
  }

  if (end.getTime() < start.getTime()) {
    return { valid: false, message: 'End date cannot be before start date.', update: null }
  }

  return {
    valid: true,
    message: '',
    update: {
      id: taskId,
      startDate: ganttDateToIso(start),
      endDate: ganttDateToIso(end),
      durationDays: durationDaysBetween(start, end),
      progress: task.progress,
    },
  }
}

export function applyScheduleToWorkItem(
  item: WorkItemApiModel,
  update: TimelineTaskScheduleUpdateEvent,
): WorkItemApiModel {
  return {
    ...item,
    startDate: update.startDate,
    dueDate: update.endDate,
    progress: update.progress ?? item.progress,
  }
}
