import type { WorkItemApiModel } from '@/lib/api/workApi'
import {
  addCalendarDays,
  formatCalendarDayKey,
  parseCalendarIsoDate,
  resolveWorkItemSchedule,
} from './buildProjectCalendarEvents'
import {
  applyScheduleToWorkItem,
  workItemHasChildren,
  type TimelineTaskScheduleUpdateEvent,
} from './resolveTimelineTaskSchedule'

export type ResolvedCalendarTaskReschedule = {
  valid: boolean
  message: string
  update: TimelineTaskScheduleUpdateEvent | null
}

function calendarDayDelta(fromDayKey: string, toDayKey: string): number {
  const from = parseCalendarIsoDate(fromDayKey)
  const to = parseCalendarIsoDate(toDayKey)
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

function shiftIsoDate(iso: string, days: number): string {
  return formatCalendarDayKey(addCalendarDays(parseCalendarIsoDate(iso), days))
}

function durationDaysBetweenStartAndDue(startDate: string, dueDate: string): number {
  const span = calendarDayDelta(startDate, dueDate)
  return Math.max(1, span + 1)
}

export function resolveCalendarTaskReschedule(
  workItemId: string,
  sourceDayKey: string,
  targetDayKey: string,
  items: WorkItemApiModel[],
): ResolvedCalendarTaskReschedule {
  if (sourceDayKey === targetDayKey) {
    return { valid: true, message: '', update: null }
  }

  const workItem = items.find((item) => item.id === workItemId)
  if (!workItem) {
    return { valid: false, message: 'Work item not found.', update: null }
  }

  if (workItemHasChildren(workItemId, items)) {
    return {
      valid: false,
      message: 'Parent items inherit dates from children — drag a leaf task instead.',
      update: null,
    }
  }

  const schedule = resolveWorkItemSchedule(workItem)
  if (!schedule) {
    return { valid: false, message: 'This task has no scheduled dates.', update: null }
  }

  const deltaDays = calendarDayDelta(sourceDayKey, targetDayKey)
  const nextStartDate = shiftIsoDate(schedule.startDate, deltaDays)
  const nextDueDate = shiftIsoDate(schedule.dueDate, deltaDays)

  return {
    valid: true,
    message: '',
    update: {
      id: workItemId,
      startDate: nextStartDate,
      endDate: nextDueDate,
      durationDays: durationDaysBetweenStartAndDue(nextStartDate, nextDueDate),
    },
  }
}

export function applyCalendarRescheduleToWorkItem(
  item: WorkItemApiModel,
  update: TimelineTaskScheduleUpdateEvent,
): WorkItemApiModel {
  return applyScheduleToWorkItem(item, update)
}
