import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Maximize2,
  Minimize2,
  Plus,
  User,
} from 'lucide-react'
import type { Priority, WorkItemApiModel, WorkItemType, WorkStatus } from '@/lib/api/workApi'
import { createWorkItem, deleteWorkItem, patchWorkItem, TECTONA_PROJECT_WORKSPACE } from '@/lib/api/workApi'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CalendarTaskDetailPanel } from './CalendarTaskDetailPanel'
import { resolveWorkItemTypeIconMeta } from '@/modules/task-work-management/components/DirectoryGanttGridCells'
import type { ProjectTemplate } from '../data/projectTemplates'
import type { Project } from '../store/projectStore'
import {
  buildMonthGridCells,
  buildProjectCalendarEvents,
  addCalendarDays,
  formatCalendarDayKey,
  formatCalendarMonthLabel,
  groupCalendarEventsByDay,
  isSameCalendarDay,
  parseCalendarIsoDate,
  resolveWorkItemSchedule,
  type ProjectCalendarEvent,
} from '../lib/buildProjectCalendarEvents'
import {
  getCalendarTaskClipboard,
  setCalendarTaskClipboard,
} from '../lib/calendarTaskClipboard'
import {
  applyCalendarDayOrder,
  buildCalendarDayOrderFromEvents,
  loadCalendarDayOrderMap,
  moveCalendarDayItemToEnd,
  moveCalendarDayItemToStart,
  normalizeCalendarReorderPosition,
  reorderCalendarDayItems,
  saveCalendarDayOrder,
  type CalendarDayOrderMap,
} from '../lib/calendarDayEventOrder'
import {
  applyCalendarRescheduleToWorkItem,
  resolveCalendarTaskReschedule,
} from '../lib/resolveCalendarTaskReschedule'
import {
  measureProjectPanelHeight,
  PROJECT_PANEL_MIN_HEIGHT_PX,
} from '../lib/projectPanelLayout'
import { projectWorkItemBusinessKeyPrefix } from '../lib/projectWorkItemUtils'
import { CalendarContextMenu, type CalendarContextMenuTarget } from './CalendarContextMenu'
import { CalendarPickDatePopover } from './CalendarPickDatePopover'
import { CalendarQuickAddPopover } from './CalendarQuickAddPopover'
import { CalendarTaskDeleteConfirmModal } from './CalendarTaskDeleteConfirmModal'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MAX_EVENTS_PER_CELL = 3
const CALENDAR_TASK_DRAG_MIME = 'application/x-tectona-calendar-task'

type CalendarTaskDragPayload = {
  workItemId: string
  viewDayKey: string
}

type CalendarReorderInsertHint = {
  dayKey: string
  workItemId: string
  position: 'before' | 'after'
}

type CalendarDayReorderTarget =
  | { type: 'before'; targetId: string }
  | { type: 'after'; targetId: string }
  | { type: 'start' }
  | { type: 'end' }

function resolveSameDayReorderTarget(
  dayKey: string,
  clientY: number,
  draggedId: string,
): CalendarDayReorderTarget | null {
  const cell = document.querySelector(`[data-calendar-day="${dayKey}"]`)
  if (!cell) return null

  const taskElements = [...cell.querySelectorAll('[data-calendar-task-id]')] as HTMLElement[]
  const otherTasks = taskElements
    .map((element) => ({
      id: element.dataset.calendarTaskId ?? '',
      rect: element.getBoundingClientRect(),
    }))
    .filter((task) => task.id && task.id !== draggedId)

  if (otherTasks.length === 0) return { type: 'end' }

  if (clientY <= otherTasks[0].rect.top + 4) {
    return { type: 'before', targetId: otherTasks[0].id }
  }

  for (const task of otherTasks) {
    const midpoint = task.rect.top + task.rect.height / 2
    if (clientY < midpoint) {
      return { type: 'before', targetId: task.id }
    }
    if (clientY <= task.rect.bottom) {
      return { type: 'after', targetId: task.id }
    }
  }

  return { type: 'after', targetId: otherTasks[otherTasks.length - 1].id }
}

function reorderHintFromTarget(dayKey: string, target: CalendarDayReorderTarget): CalendarReorderInsertHint | null {
  if (target.type === 'before') {
    return { dayKey, workItemId: target.targetId, position: 'before' }
  }
  if (target.type === 'after') {
    return { dayKey, workItemId: target.targetId, position: 'after' }
  }
  return null
}

function isWeekendDate(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function isWeekendColumnIndex(index: number): boolean {
  return index === 0 || index === 6
}

const calendarToolbarFocusClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30 focus-visible:ring-offset-0'

const STATUS_CHIP: Record<WorkStatus, string> = {
  Backlog: 'border-violet-200/80 bg-violet-50/95 text-violet-800 dark:border-violet-800/50 dark:bg-violet-950/45 dark:text-violet-200',
  'To Do': 'border-slate-200/80 bg-slate-100/95 text-slate-700 dark:border-slate-700/50 dark:bg-slate-900/50 dark:text-slate-200',
  'In Progress': 'border-sky-200/80 bg-sky-50/95 text-sky-800 dark:border-sky-800/50 dark:bg-sky-950/45 dark:text-sky-200',
  'In Review': 'border-amber-200/80 bg-amber-50/95 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/45 dark:text-amber-200',
  Done: 'border-emerald-200/80 bg-emerald-50/95 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/45 dark:text-emerald-200',
}

const TYPE_ICON_SURFACE: Record<string, string> = {
  Epic: 'border-violet-200/80 bg-gradient-to-br from-violet-50 to-white text-violet-700 dark:border-violet-800/40 dark:from-violet-950/40 dark:to-background dark:text-violet-300',
  Feature: 'border-sky-200/80 bg-gradient-to-br from-sky-50 to-white text-sky-700 dark:border-sky-800/40 dark:from-sky-950/40 dark:to-background dark:text-sky-300',
  Task: 'border-blue-200/80 bg-gradient-to-br from-blue-50 to-white text-blue-700 dark:border-blue-800/40 dark:from-blue-950/40 dark:to-background dark:text-blue-300',
  Subtask: 'border-amber-200/80 bg-gradient-to-br from-amber-50 to-white text-amber-700 dark:border-amber-800/40 dark:from-amber-950/40 dark:to-background dark:text-amber-300',
  Checklist: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white text-emerald-700 dark:border-emerald-800/40 dark:from-emerald-950/40 dark:to-background dark:text-emerald-300',
  Bug: 'border-rose-200/80 bg-gradient-to-br from-rose-50 to-white text-rose-700 dark:border-rose-800/40 dark:from-rose-950/40 dark:to-background dark:text-rose-300',
}

function resolveTypeIconSurface(type: ProjectCalendarEvent['type']): string {
  return TYPE_ICON_SURFACE[type] ?? 'border-slate-200/80 bg-gradient-to-br from-slate-50 to-white text-slate-600 dark:border-slate-700/50 dark:from-slate-900/40 dark:to-background dark:text-slate-300'
}

function parseSelectedDayParts(dayKey: string | null, today: Date) {
  if (!dayKey) return null

  const [year, month, day] = dayKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  return {
    dayNumber: day,
    weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
    monthYear: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    isToday: isSameCalendarDay(date, today),
  }
}

function CalendarSelectedDaySidebar({
  selectedDayKey,
  selectedDayEvents,
  selectedTaskId,
  selectedWorkItem,
  today,
  isDeletingTask,
  onBackToDay,
  onTaskSelect,
  onPatchWorkItem,
  onDeleteWorkItem,
}: {
  selectedDayKey: string | null
  selectedDayEvents: ProjectCalendarEvent[]
  selectedTaskId: string | null
  selectedWorkItem: WorkItemApiModel | null
  today: Date
  isDeletingTask: boolean
  onBackToDay: () => void
  onTaskSelect: (taskId: string) => void
  onPatchWorkItem: (itemId: string, patch: Partial<WorkItemApiModel>) => void | Promise<void>
  onDeleteWorkItem: (itemId: string) => void | Promise<void>
}) {
  const dayParts = parseSelectedDayParts(selectedDayKey, today)

  if (selectedTaskId && selectedWorkItem) {
    return (
      <CalendarTaskDetailPanel
        workItem={selectedWorkItem}
        onBackToDay={onBackToDay}
        onPatch={(patch) => onPatchWorkItem(selectedWorkItem.id, patch)}
        onDelete={() => onDeleteWorkItem(selectedWorkItem.id)}
        isDeleting={isDeletingTask}
      />
    )
  }

  return (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50/70 shadow-[0_16px_44px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04] dark:border-slate-700/60 dark:from-background dark:via-background dark:to-slate-950/40 dark:ring-white/[0.04] lg:w-80">
      <div className="relative overflow-hidden border-b border-slate-200/70 px-4 py-4 dark:border-slate-700/60">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-50/90 via-white to-indigo-50/35 dark:from-sky-950/25 dark:via-background dark:to-indigo-950/15"
          aria-hidden
        />
        <div className="relative space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              Selected day
            </p>
            {dayParts?.isToday ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-primary-foreground shadow-sm">
                Today
              </span>
            ) : null}
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border border-white/80 bg-white/95 shadow-[0_8px_24px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04] dark:border-slate-700/60 dark:bg-slate-900/80">
              <span className="text-[1.65rem] font-bold tabular-nums leading-none text-foreground">
                {dayParts?.dayNumber ?? '—'}
              </span>
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold leading-snug text-foreground">
                {dayParts?.weekday ?? 'Pick a day'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {dayParts?.monthYear ?? 'Select a date on the calendar'}
              </p>
              <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/75 px-2 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-300">
                <ListTodo className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                <span>
                  {selectedDayEvents.length} work item{selectedDayEvents.length === 1 ? '' : 's'}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3.5">
        {selectedDayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200/90 bg-gradient-to-b from-slate-50/50 to-white px-4 py-10 text-center dark:border-slate-700/60 dark:from-slate-900/20 dark:to-background">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.06)] dark:border-slate-700/60 dark:bg-slate-900/60">
              <CalendarDays className="h-5 w-5 text-slate-400" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-foreground">No scheduled work</p>
            <p className="mt-1 max-w-[14rem] text-xs leading-relaxed text-muted-foreground">
              This day is clear. Drag tasks from other dates to schedule work here.
            </p>
          </div>
        ) : (
          selectedDayEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => onTaskSelect(event.id)}
              className={cn(
                'group relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3.5 text-left shadow-[0_10px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.03] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(15,23,42,0.10)] dark:border-slate-700/60 dark:bg-slate-900/40 dark:ring-white/[0.03]',
                calendarToolbarFocusClass,
                selectedTaskId === event.id && 'ring-2 ring-primary/30',
              )}
            >
              <div
                className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-sky-400/80 via-indigo-400/50 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                aria-hidden
              />
              <div className="flex gap-3">
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-[0_4px_14px_rgba(15,23,42,0.05)]',
                    resolveTypeIconSurface(event.type),
                  )}
                  title={event.type}
                >
                  <CalendarWorkItemTypeIcon type={event.type} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">
                    {event.title}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className="rounded-md border-slate-200/80 bg-slate-50/80 px-1.5 py-0 text-[9px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300"
                    >
                      {event.type}
                    </Badge>
                    <Badge
                      className={cn(
                        'rounded-full border px-1.5 py-0 text-[9px] font-semibold shadow-sm',
                        STATUS_CHIP[event.status],
                      )}
                    >
                      {event.status}
                    </Badge>
                  </div>
                  <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <dt className="text-slate-500 dark:text-slate-400">Schedule</dt>
                      <dd className="truncate font-medium text-slate-700 dark:text-slate-200">
                        {event.startDate === event.dueDate
                          ? event.dueDate
                          : `${event.startDate} → ${event.dueDate}`}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <dt className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <User className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                        Assignee
                      </dt>
                      <dd className="truncate font-medium text-slate-700 dark:text-slate-200">{event.assignee}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  )
}

function CalendarWorkItemTypeIcon({
  type,
  compact,
}: {
  type: ProjectCalendarEvent['type']
  compact?: boolean
}) {
  const meta = resolveWorkItemTypeIconMeta(type)
  const Icon = meta.icon

  return (
    <Icon
      className={cn(
        'shrink-0',
        compact ? 'h-3 w-3' : 'h-3.5 w-3.5',
        meta.className,
      )}
      aria-hidden
    />
  )
}

function CalendarEventChip({
  event,
  compact,
  isDueDay,
  className,
}: {
  event: ProjectCalendarEvent
  compact?: boolean
  isDueDay: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-tight shadow-sm',
        'box-border w-full max-w-full',
        STATUS_CHIP[event.status],
        isDueDay && 'ring-1 ring-primary/25',
        compact && 'px-1 py-0 text-[9px]',
        className,
      )}
      title={`${event.type} · ${event.title} · due ${event.dueDate}`}
    >
      <CalendarWorkItemTypeIcon type={event.type} compact={compact} />
      <span className="min-w-0 truncate">{event.title}</span>
    </div>
  )
}

function DraggableCalendarEventChip({
  event,
  dayKey,
  compact,
  isDueDay,
  isDragging,
  isSelected,
  reorderHint,
  onDragStart,
  onDragEnd,
  onTaskDragOver,
  onTaskDrop,
  onTaskSelect,
  onTaskContextMenu,
}: {
  event: ProjectCalendarEvent
  dayKey: string
  compact?: boolean
  isDueDay: boolean
  isDragging: boolean
  isSelected: boolean
  reorderHint: CalendarReorderInsertHint | null
  onDragStart: (payload: CalendarTaskDragPayload) => void
  onDragEnd: () => void
  onTaskDragOver: (dayKey: string, workItemId: string, event: ReactDragEvent<HTMLDivElement>) => void
  onTaskDrop: (dayKey: string, workItemId: string, event: ReactDragEvent<HTMLDivElement>) => void
  onTaskSelect: (taskId: string, dayKey: string) => void
  onTaskContextMenu: (taskId: string, dayKey: string, clientX: number, clientY: number) => void
}) {
  const didDragRef = useRef(false)

  const handleDragStart = (dragEvent: ReactDragEvent<HTMLDivElement>) => {
    didDragRef.current = true
    dragEvent.stopPropagation()
    const payload: CalendarTaskDragPayload = {
      workItemId: event.id,
      viewDayKey: dayKey,
    }
    dragEvent.dataTransfer.effectAllowed = 'move'
    dragEvent.dataTransfer.setData(CALENDAR_TASK_DRAG_MIME, JSON.stringify(payload))
    dragEvent.dataTransfer.setData('text/plain', event.title)
    onDragStart(payload)
  }

  const showInsertBefore =
    reorderHint?.dayKey === dayKey &&
    reorderHint.workItemId === event.id &&
    reorderHint.position === 'before'
  const showInsertAfter =
    reorderHint?.dayKey === dayKey &&
    reorderHint.workItemId === event.id &&
    reorderHint.position === 'after'

  return (
    <div className="relative min-w-0 w-full max-w-full">
      {showInsertBefore ? (
        <div className="pointer-events-none absolute inset-x-0 -top-0.5 z-10 h-0.5 rounded-full bg-primary" aria-hidden />
      ) : null}
      <div
        draggable
        data-calendar-task-id={event.id}
        onDragStart={handleDragStart}
        onDragEnd={(dragEvent) => {
          dragEvent.stopPropagation()
          onDragEnd()
          window.setTimeout(() => {
            didDragRef.current = false
          }, 0)
        }}
        onDragOver={(dragEvent) => {
          dragEvent.stopPropagation()
          onTaskDragOver(dayKey, event.id, dragEvent)
        }}
        onDrop={(dragEvent) => {
          dragEvent.stopPropagation()
          onTaskDrop(dayKey, event.id, dragEvent)
        }}
        className={cn('min-w-0 w-full max-w-full touch-none select-none', isDragging && 'opacity-30')}
        onClick={(clickEvent) => {
          clickEvent.stopPropagation()
          if (didDragRef.current) return
          onTaskSelect(event.id, dayKey)
        }}
        onContextMenu={(contextEvent) => {
          contextEvent.preventDefault()
          contextEvent.stopPropagation()
          onTaskContextMenu(event.id, dayKey, contextEvent.clientX, contextEvent.clientY)
        }}
        onKeyDown={(keydownEvent) => keydownEvent.stopPropagation()}
      >
        <CalendarEventChip
          event={event}
          compact={compact}
          isDueDay={isDueDay}
          className={cn(
            'w-full max-w-full cursor-pointer active:cursor-grabbing',
            isSelected && 'ring-2 ring-primary/35',
          )}
        />
      </div>
      {showInsertAfter ? (
        <div className="pointer-events-none absolute inset-x-0 -bottom-0.5 z-10 h-0.5 rounded-full bg-primary" aria-hidden />
      ) : null}
    </div>
  )
}

function CalendarDayCell({
  dayKey,
  date,
  inCurrentMonth,
  isToday,
  isSelected,
  isWeekendDay,
  isDropTarget,
  isQuickAddOpen,
  dayEvents,
  dragPayload,
  reorderHint,
  selectedTaskId,
  onSelect,
  onQuickAddOpen,
  onTaskSelect,
  onDayContextMenu,
  onTaskContextMenu,
  onDayDragStart,
  onDayDragEnd,
  onDayDragEnter,
  onDayDragOver,
  onDayDragLeave,
  onDayDrop,
  onTaskDragOver,
  onTaskDrop,
}: {
  dayKey: string
  date: Date
  inCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
  isWeekendDay: boolean
  isDropTarget: boolean
  isQuickAddOpen: boolean
  dayEvents: ProjectCalendarEvent[]
  dragPayload: CalendarTaskDragPayload | null
  reorderHint: CalendarReorderInsertHint | null
  selectedTaskId: string | null
  onSelect: (dayKey: string) => void
  onQuickAddOpen: (dayKey: string, anchorEl: HTMLElement) => void
  onTaskSelect: (taskId: string, dayKey: string) => void
  onDayContextMenu: (dayKey: string, clientX: number, clientY: number, anchorEl: HTMLElement) => void
  onTaskContextMenu: (taskId: string, dayKey: string, clientX: number, clientY: number) => void
  onDayDragStart: (payload: CalendarTaskDragPayload) => void
  onDayDragEnd: () => void
  onDayDragEnter: (dayKey: string, event: ReactDragEvent<HTMLDivElement>) => void
  onDayDragOver: (dayKey: string, event: ReactDragEvent<HTMLDivElement>) => void
  onDayDragLeave: (dayKey: string, event: ReactDragEvent<HTMLDivElement>) => void
  onDayDrop: (dayKey: string, event: ReactDragEvent<HTMLDivElement>) => void
  onTaskDragOver: (dayKey: string, workItemId: string, event: ReactDragEvent<HTMLDivElement>) => void
  onTaskDrop: (dayKey: string, workItemId: string, event: ReactDragEvent<HTMLDivElement>) => void
}) {
  const cellRef = useRef<HTMLDivElement>(null)
  const visibleEvents = dayEvents.slice(0, MAX_EVENTS_PER_CELL)
  const hiddenCount = dayEvents.length - visibleEvents.length

  return (
    <div
      ref={cellRef}
      data-calendar-day={dayKey}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(dayKey)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(dayKey)
        }
      }}
      onDragEnter={(event) => {
        onDayDragEnter(dayKey, event)
      }}
      onDragOver={(event) => onDayDragOver(dayKey, event)}
      onDragLeave={(event) => onDayDragLeave(dayKey, event)}
      onDrop={(event) => onDayDrop(dayKey, event)}
      onContextMenu={(event) => {
        event.preventDefault()
        if (cellRef.current) {
          onDayContextMenu(dayKey, event.clientX, event.clientY, cellRef.current)
        }
      }}
      className={cn(
        'group/cell flex min-h-[5.5rem] min-w-0 flex-col overflow-hidden border-b border-r border-border/30 p-1.5 text-left transition-colors',
        !inCurrentMonth && !isWeekendDay && 'bg-muted/20 text-muted-foreground/70',
        !inCurrentMonth && isWeekendDay && 'bg-red-50/40 text-muted-foreground/70 dark:bg-red-950/25',
        inCurrentMonth && !isWeekendDay && 'bg-background/40',
        inCurrentMonth && isWeekendDay && 'bg-red-50/90 dark:bg-red-950/30',
        isSelected && 'bg-primary/5 ring-1 ring-inset ring-primary/25',
        isToday && 'bg-sky-50/80 dark:bg-sky-950/25',
        isDropTarget && 'ring-2 ring-inset ring-primary/45 bg-primary/10',
      )}
    >
      <div className="mb-1 flex items-start justify-between gap-1">
        <span
          className={cn(
            'inline-flex h-7 min-w-7 items-center justify-center rounded-full text-sm font-bold tabular-nums leading-none',
            isToday
              ? 'bg-primary px-1.5 text-primary-foreground'
              : inCurrentMonth
                ? 'text-foreground'
                : 'text-muted-foreground',
          )}
          aria-label={`Day ${date.getDate()}`}
        >
          {date.getDate()}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            data-calendar-quick-add-trigger
            aria-label={`Add task on ${dayKey}`}
            title="Add task"
            onClick={(event) => {
              event.stopPropagation()
              if (cellRef.current) onQuickAddOpen(dayKey, cellRef.current)
            }}
            onMouseDown={(event) => event.stopPropagation()}
            className={cn(
              'inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/80 hover:text-foreground',
              isQuickAddOpen
                ? 'opacity-100'
                : 'opacity-0 group-hover/cell:opacity-100 focus-visible:opacity-100',
            )}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </button>
          {dayEvents.length > 0 ? (
            <span
              className="inline-flex max-w-[4.5rem] items-center gap-0.5 rounded-full bg-muted/90 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-muted-foreground ring-1 ring-border/50"
              title={`${dayEvents.length} task${dayEvents.length === 1 ? '' : 's'} on this day`}
              aria-label={`${dayEvents.length} task${dayEvents.length === 1 ? '' : 's'}`}
            >
              <ListTodo className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
              <span className="tabular-nums">{dayEvents.length}</span>
            </span>
          ) : null}
        </div>
      </div>
      <div className="min-w-0 space-y-0.5" data-calendar-task-list>
        {visibleEvents.map((event) => {
          const isSameTaskBeingDraggedElsewhere =
            dragPayload != null &&
            dragPayload.workItemId === event.id &&
            dragPayload.viewDayKey !== dayKey

          if (isSameTaskBeingDraggedElsewhere) {
            return null
          }

          return (
            <DraggableCalendarEventChip
              key={`${event.id}@${dayKey}`}
              event={event}
              dayKey={dayKey}
              compact
              isDueDay={event.dueDate === dayKey}
              isDragging={
                dragPayload?.workItemId === event.id && dragPayload.viewDayKey === dayKey
              }
              isSelected={selectedTaskId === event.id}
              reorderHint={reorderHint}
              onDragStart={onDayDragStart}
              onDragEnd={onDayDragEnd}
              onTaskDragOver={onTaskDragOver}
              onTaskDrop={onTaskDrop}
              onTaskSelect={onTaskSelect}
              onTaskContextMenu={onTaskContextMenu}
            />
          )
        })}
        {hiddenCount > 0 ? (
          <span className="block px-1 text-[9px] font-semibold text-muted-foreground">
            +{hiddenCount} more
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function ProjectCalendarPanel({
  project,
  template: _template,
  ownerName,
  workItems,
  usesApiItems = false,
  onWorkItemsChange,
}: {
  project: Project
  template?: ProjectTemplate
  ownerName: string
  workItems: WorkItemApiModel[]
  usesApiItems?: boolean
  onWorkItemsChange?: () => void | Promise<void>
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const localWorkItemsRef = useRef(workItems)
  const [panelHeightPx, setPanelHeightPx] = useState<number | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [localWorkItems, setLocalWorkItems] = useState(workItems)
  const [dragPayload, setDragPayload] = useState<CalendarTaskDragPayload | null>(null)
  const [overDayKey, setOverDayKey] = useState<string | null>(null)
  const [reorderHint, setReorderHint] = useState<CalendarReorderInsertHint | null>(null)
  const [calendarDragHint, setCalendarDragHint] = useState<string | null>(null)
  const [dayOrderMap, setDayOrderMap] = useState<CalendarDayOrderMap>(() => loadCalendarDayOrderMap(project.id))
  const calendarGridRef = useRef<HTMLDivElement>(null)
  const dragPayloadRef = useRef<CalendarTaskDragPayload | null>(null)
  const today = useMemo(() => new Date(), [])
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(() => formatCalendarDayKey(today))
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [quickAdd, setQuickAdd] = useState<{
    dayKey: string
    anchorEl: HTMLElement
    initialType?: WorkItemType
  } | null>(null)
  const [isQuickAddSubmitting, setIsQuickAddSubmitting] = useState(false)
  const [isDeletingTask, setIsDeletingTask] = useState(false)
  const [contextMenu, setContextMenu] = useState<CalendarContextMenuTarget | null>(null)
  const [pickDateMove, setPickDateMove] = useState<{
    taskId: string
    viewDayKey: string
    anchorEl: HTMLElement
  } | null>(null)
  const [hasTaskClipboard, setHasTaskClipboard] = useState(false)
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ taskId: string; taskTitle: string } | null>(null)

  const goToToday = useCallback(() => {
    const now = new Date()
    setViewYear(now.getFullYear())
    setViewMonth(now.getMonth())
    setSelectedDayKey(formatCalendarDayKey(now))
  }, [])

  useEffect(() => {
    localWorkItemsRef.current = workItems
    setLocalWorkItems(workItems)
  }, [workItems])

  useEffect(() => {
    setDayOrderMap(loadCalendarDayOrderMap(project.id))
  }, [project.id])

  const readDragPayload = useCallback((event: ReactDragEvent): CalendarTaskDragPayload | null => {
    const raw = event.dataTransfer.getData(CALENDAR_TASK_DRAG_MIME)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as CalendarTaskDragPayload
        if (parsed.workItemId && parsed.viewDayKey) return parsed
      } catch {
        // fall through to ref
      }
    }
    return dragPayloadRef.current
  }, [])

  const isCalendarTaskDrag = useCallback((event: ReactDragEvent) => {
    return event.dataTransfer.types.includes(CALENDAR_TASK_DRAG_MIME)
  }, [])

  const resolveDayKeyFromPoint = useCallback((clientX: number, clientY: number): string | null => {
    const elements = document.elementsFromPoint(clientX, clientY)
    for (const element of elements) {
      const cell = element.closest('[data-calendar-day]') as HTMLElement | null
      if (cell?.dataset.calendarDay) return cell.dataset.calendarDay
    }
    return null
  }, [])

  const commitCalendarReschedule = useCallback(
    (workItemId: string, viewDayKey: string, targetDayKey: string) => {
      const previousItems = localWorkItemsRef.current
      const resolved = resolveCalendarTaskReschedule(workItemId, viewDayKey, targetDayKey, previousItems)

      if (!resolved.valid) {
        setCalendarDragHint(resolved.message)
        return
      }
      if (!resolved.update) return

      const nextItems = previousItems.map((item) =>
        item.id === resolved.update!.id ? applyCalendarRescheduleToWorkItem(item, resolved.update!) : item,
      )
      localWorkItemsRef.current = nextItems
      setLocalWorkItems(nextItems)
      setCalendarDragHint(null)
      setSelectedDayKey(targetDayKey)

      if (usesApiItems) {
        void patchWorkItem(resolved.update.id, {
          startDate: resolved.update.startDate,
          dueDate: resolved.update.endDate,
        }).catch(() => {
          localWorkItemsRef.current = previousItems
          setLocalWorkItems(previousItems)
          setCalendarDragHint('Failed to save schedule — reverted to previous dates.')
        })
      }
    },
    [usesApiItems],
  )

  const handleTaskDragStart = useCallback((payload: CalendarTaskDragPayload) => {
    dragPayloadRef.current = payload
    setDragPayload(payload)
    setCalendarDragHint(null)
  }, [])

  const calendarEvents = useMemo(() => buildProjectCalendarEvents(localWorkItems), [localWorkItems])
  const baseEventsByDay = useMemo(() => groupCalendarEventsByDay(calendarEvents), [calendarEvents])
  const eventsByDay = useMemo(() => {
    const ordered = new Map<string, ProjectCalendarEvent[]>()
    for (const [dayKey, events] of baseEventsByDay.entries()) {
      ordered.set(dayKey, applyCalendarDayOrder(events, dayOrderMap[dayKey]))
    }
    return ordered
  }, [baseEventsByDay, dayOrderMap])

  const commitDayReorder = useCallback(
    (
      dayKey: string,
      draggedId: string,
      targetId: string | null,
      position: 'before' | 'after' | 'end' | 'start',
    ) => {
      const events = baseEventsByDay.get(dayKey) ?? []
      const currentOrder = dayOrderMap[dayKey] ?? buildCalendarDayOrderFromEvents(events)
      let nextOrder: string[]

      if (position === 'start') {
        nextOrder = moveCalendarDayItemToStart(currentOrder, draggedId)
      } else if (position === 'end' || !targetId) {
        nextOrder = moveCalendarDayItemToEnd(currentOrder, draggedId)
      } else {
        nextOrder = reorderCalendarDayItems(currentOrder, draggedId, targetId, position)
      }

      setDayOrderMap(saveCalendarDayOrder(project.id, dayKey, nextOrder))
      setCalendarDragHint(null)
    },
    [baseEventsByDay, dayOrderMap, project.id],
  )

  const handleTaskDragEnd = useCallback(() => {
    dragPayloadRef.current = null
    setDragPayload(null)
    setOverDayKey(null)
    setReorderHint(null)
  }, [])

  const applySameDayReorderTarget = useCallback(
    (dayKey: string, draggedId: string, target: CalendarDayReorderTarget) => {
      if (target.type === 'start') {
        commitDayReorder(dayKey, draggedId, null, 'start')
        return
      }
      if (target.type === 'end') {
        commitDayReorder(dayKey, draggedId, null, 'end')
        return
      }
      commitDayReorder(dayKey, draggedId, target.targetId, target.type)
    },
    [commitDayReorder],
  )

  const handleTaskDragOver = useCallback(
    (dayKey: string, workItemId: string, event: ReactDragEvent<HTMLDivElement>) => {
      if (!isCalendarTaskDrag(event)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'

      const payload = dragPayloadRef.current
      if (!payload) return

      if (payload.viewDayKey === dayKey && payload.workItemId !== workItemId) {
        const rect = event.currentTarget.getBoundingClientRect()
        const pointerPosition = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
        const events = baseEventsByDay.get(dayKey) ?? []
        const currentOrder = dayOrderMap[dayKey] ?? buildCalendarDayOrderFromEvents(events)
        const position = normalizeCalendarReorderPosition(
          currentOrder,
          payload.workItemId,
          workItemId,
          pointerPosition,
        )
        setReorderHint({ dayKey, workItemId, position })
        setOverDayKey(null)
        return
      }

      setReorderHint(null)
      setOverDayKey(dayKey)
    },
    [baseEventsByDay, dayOrderMap, isCalendarTaskDrag],
  )

  const handleTaskDrop = useCallback(
    (dayKey: string, targetWorkItemId: string, event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault()

      const payload = readDragPayload(event)
      dragPayloadRef.current = null
      setDragPayload(null)
      setReorderHint(null)
      setOverDayKey(null)
      if (!payload) return

      if (payload.viewDayKey === dayKey) {
        if (payload.workItemId === targetWorkItemId) return
        const rect = event.currentTarget.getBoundingClientRect()
        const pointerPosition = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
        const events = baseEventsByDay.get(dayKey) ?? []
        const currentOrder = dayOrderMap[dayKey] ?? buildCalendarDayOrderFromEvents(events)
        const position = normalizeCalendarReorderPosition(
          currentOrder,
          payload.workItemId,
          targetWorkItemId,
          pointerPosition,
        )
        commitDayReorder(dayKey, payload.workItemId, targetWorkItemId, position)
        return
      }

      commitCalendarReschedule(payload.workItemId, payload.viewDayKey, dayKey)
    },
    [baseEventsByDay, commitCalendarReschedule, commitDayReorder, dayOrderMap, readDragPayload],
  )

  const handleDayDragEnter = useCallback(
    (dayKey: string, event: ReactDragEvent<HTMLDivElement>) => {
      if (!isCalendarTaskDrag(event)) return
      setOverDayKey(dayKey)
    },
    [isCalendarTaskDrag],
  )

  const handleDayDragOver = useCallback(
    (dayKey: string, event: ReactDragEvent<HTMLDivElement>) => {
      if (!isCalendarTaskDrag(event)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'

      const payload = dragPayloadRef.current
      const resolvedDayKey = resolveDayKeyFromPoint(event.clientX, event.clientY) ?? dayKey

      if (payload?.viewDayKey === resolvedDayKey) {
        const target = resolveSameDayReorderTarget(resolvedDayKey, event.clientY, payload.workItemId)
        setReorderHint(target ? reorderHintFromTarget(resolvedDayKey, target) : null)
        setOverDayKey(null)
        return
      }

      setReorderHint(null)
      setOverDayKey(resolvedDayKey)
    },
    [isCalendarTaskDrag, resolveDayKeyFromPoint],
  )

  const handleDayDragLeave = useCallback(
    (dayKey: string, event: ReactDragEvent<HTMLDivElement>) => {
      if (overDayKey !== dayKey) return
      const related = event.relatedTarget as Node | null
      const currentCell = event.currentTarget
      if (related && currentCell.contains(related)) return
      setOverDayKey(null)
    },
    [overDayKey],
  )

  const handleDayDrop = useCallback(
    (dayKey: string, event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()

      const payload = readDragPayload(event)
      dragPayloadRef.current = null
      setDragPayload(null)
      setOverDayKey(null)
      setReorderHint(null)
      if (!payload) return

      const targetDayKey = resolveDayKeyFromPoint(event.clientX, event.clientY) ?? dayKey
      if (payload.viewDayKey === targetDayKey) {
        const target = resolveSameDayReorderTarget(targetDayKey, event.clientY, payload.workItemId)
        if (target) {
          applySameDayReorderTarget(targetDayKey, payload.workItemId, target)
        }
        return
      }

      commitCalendarReschedule(payload.workItemId, payload.viewDayKey, targetDayKey)
    },
    [applySameDayReorderTarget, commitCalendarReschedule, readDragPayload, resolveDayKeyFromPoint],
  )

  const monthCells = useMemo(
    () => buildMonthGridCells(viewYear, viewMonth),
    [viewMonth, viewYear],
  )

  const unscheduledCount = localWorkItems.length - calendarEvents.length
  const selectedDayEvents = selectedDayKey ? eventsByDay.get(selectedDayKey) ?? [] : []
  const selectedWorkItem = useMemo(
    () => (selectedTaskId ? localWorkItems.find((item) => item.id === selectedTaskId) ?? null : null),
    [localWorkItems, selectedTaskId],
  )
  const assigneeLabel = ownerName.trim() || 'Unassigned'

  const handleDaySelect = useCallback((dayKey: string) => {
    setSelectedDayKey(dayKey)
    setSelectedTaskId(null)
  }, [])

  const handleTaskSelect = useCallback((taskId: string, dayKey: string) => {
    setSelectedDayKey(dayKey)
    setSelectedTaskId(taskId)
  }, [])

  const handleBackToDay = useCallback(() => {
    setSelectedTaskId(null)
  }, [])

  const commitWorkItemPatch = useCallback(
    async (itemId: string, patch: Partial<WorkItemApiModel>) => {
      const previousItems = localWorkItemsRef.current
      const nextItems = previousItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...patch,
              lastUpdated: new Date().toISOString(),
            }
          : item,
      )
      localWorkItemsRef.current = nextItems
      setLocalWorkItems(nextItems)
      setCalendarDragHint(null)

      if (!usesApiItems) return

      try {
        await patchWorkItem(itemId, patch)
        await onWorkItemsChange?.()
      } catch {
        localWorkItemsRef.current = previousItems
        setLocalWorkItems(previousItems)
        setCalendarDragHint('Failed to save changes — reverted.')
      }
    },
    [onWorkItemsChange, usesApiItems],
  )

  const handleDeleteWorkItem = useCallback(
    async (itemId: string) => {
      setIsDeletingTask(true)
      const previousItems = localWorkItemsRef.current
      const nextItems = previousItems.filter((item) => item.id !== itemId)
      localWorkItemsRef.current = nextItems
      setLocalWorkItems(nextItems)
      setSelectedTaskId(null)
      setCalendarDragHint(null)

      try {
        if (usesApiItems) {
          await deleteWorkItem(itemId)
          await onWorkItemsChange?.()
        }
      } catch {
        localWorkItemsRef.current = previousItems
        setLocalWorkItems(previousItems)
        setCalendarDragHint('Failed to delete task — restored.')
      } finally {
        setIsDeletingTask(false)
      }
    },
    [onWorkItemsChange, usesApiItems],
  )

  const handleQuickAddOpen = useCallback(
    (dayKey: string, anchorEl: HTMLElement, forceOpen = false, initialType: WorkItemType = 'Task') => {
      setContextMenu(null)
      setQuickAdd((current) => {
        if (!forceOpen && current?.dayKey === dayKey && (current.initialType ?? 'Task') === initialType) {
          return null
        }
        return { dayKey, anchorEl, initialType }
      })
      setSelectedDayKey(dayKey)
    },
    [],
  )

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const handleDayContextMenu = useCallback(
    (dayKey: string, clientX: number, clientY: number, anchorEl: HTMLElement) => {
      setQuickAdd(null)
      setContextMenu({ kind: 'day', dayKey, x: clientX, y: clientY, anchorEl })
    },
    [],
  )

  const handleTaskContextMenu = useCallback(
    (taskId: string, dayKey: string, clientX: number, clientY: number) => {
      const workItem = localWorkItemsRef.current.find((item) => item.id === taskId)
      if (!workItem) return

      setQuickAdd(null)
      setContextMenu({
        kind: 'task',
        dayKey,
        taskId,
        taskTitle: workItem.title,
        taskType: workItem.type,
        status: workItem.status,
        priority: workItem.priority,
        x: clientX,
        y: clientY,
      })
    },
    [],
  )

  const handleContextMenuAddTask = useCallback(
    (dayKey: string, anchorEl: HTMLElement) => {
      setContextMenu(null)
      window.setTimeout(() => {
        if (!anchorEl.isConnected) {
          const cell = document.querySelector(`[data-calendar-day="${dayKey}"]`) as HTMLElement | null
          if (cell) {
            handleQuickAddOpen(dayKey, cell, true)
            return
          }
          setSelectedDayKey(dayKey)
          return
        }
        handleQuickAddOpen(dayKey, anchorEl, true)
      }, 0)
    },
    [handleQuickAddOpen],
  )

  const handleContextMenuAddTaskWithType = useCallback(
    (dayKey: string, anchorEl: HTMLElement, type: WorkItemType) => {
      setContextMenu(null)
      window.setTimeout(() => {
        handleQuickAddOpen(dayKey, anchorEl, true, type)
      }, 0)
    },
    [handleQuickAddOpen],
  )

  const handleContextMenuGoToToday = useCallback(() => {
    setContextMenu(null)
    goToToday()
  }, [goToToday])

  const handleContextMenuMarkDone = useCallback(
    (taskId: string) => {
      setContextMenu(null)
      void commitWorkItemPatch(taskId, { status: 'Done', progress: 100 })
    },
    [commitWorkItemPatch],
  )

  const handleContextMenuSetType = useCallback(
    (taskId: string, type: WorkItemType) => {
      setContextMenu(null)
      void commitWorkItemPatch(taskId, { type })
    },
    [commitWorkItemPatch],
  )

  const handleContextMenuMoveTask = useCallback(
    (taskId: string, viewDayKey: string, preset: 'tomorrow' | 'next-week') => {
      setContextMenu(null)
      const deltaDays = preset === 'tomorrow' ? 1 : 7
      const targetDayKey = formatCalendarDayKey(addCalendarDays(parseCalendarIsoDate(viewDayKey), deltaDays))
      commitCalendarReschedule(taskId, viewDayKey, targetDayKey)
    },
    [commitCalendarReschedule],
  )

  const handleContextMenuPickDateMove = useCallback(
    (taskId: string, viewDayKey: string) => {
      setContextMenu(null)
      window.setTimeout(() => {
        const taskEl = document.querySelector(`[data-calendar-task-id="${taskId}"]`) as HTMLElement | null
        if (!taskEl) return
        setPickDateMove({ taskId, viewDayKey, anchorEl: taskEl })
      }, 0)
    },
    [],
  )

  const handlePickDateMoveClose = useCallback(() => {
    setPickDateMove(null)
  }, [])

  const handlePickDateMoveSelect = useCallback(
    (targetDayKey: string) => {
      if (!pickDateMove) return
      commitCalendarReschedule(pickDateMove.taskId, pickDateMove.viewDayKey, targetDayKey)
      setPickDateMove(null)
    },
    [commitCalendarReschedule, pickDateMove],
  )

  const createLocalWorkItemFromSource = useCallback(
    (source: WorkItemApiModel, overrides: Partial<WorkItemApiModel> & { id: string; title: string }) => {
      const nowIso = new Date().toISOString()
      const item: WorkItemApiModel = {
        ...source,
        ...overrides,
        lastUpdated: nowIso,
        parentId: null,
        epicId: null,
        featureId: null,
      }
      const nextItems = [...localWorkItemsRef.current, item]
      localWorkItemsRef.current = nextItems
      setLocalWorkItems(nextItems)
      const schedule = resolveWorkItemSchedule(item)
      const orderDayKey = schedule?.startDate ?? item.dueDate?.slice(0, 10)
      if (orderDayKey) {
        const currentOrder = dayOrderMap[orderDayKey] ?? []
        setDayOrderMap(
          saveCalendarDayOrder(project.id, orderDayKey, [item.id, ...currentOrder.filter((entry) => entry !== item.id)]),
        )
        setSelectedDayKey(orderDayKey)
      }
      return item
    },
    [dayOrderMap, project.id],
  )

  const handleContextMenuDuplicate = useCallback(
    async (taskId: string, viewDayKey: string) => {
      setContextMenu(null)
      const source = localWorkItemsRef.current.find((item) => item.id === taskId)
      if (!source) return

      const schedule = resolveWorkItemSchedule(source)
      if (!schedule) {
        setCalendarDragHint('Cannot duplicate — task has no scheduled dates.')
        return
      }

      const title = source.title.trim().endsWith('(copy)') ? `${source.title.trim()} 2` : `${source.title} (copy)`

      if (usesApiItems) {
        try {
          await createWorkItem({
            title,
            type: source.type,
            project: project.name,
            workspace: TECTONA_PROJECT_WORKSPACE,
            assignee: source.assignee,
            startDate: schedule.startDate,
            dueDate: schedule.dueDate,
            status: source.status,
          })
          setCalendarDragHint(null)
          setSelectedDayKey(viewDayKey)
          await onWorkItemsChange?.()
        } catch {
          setCalendarDragHint('Failed to duplicate task — please try again.')
        }
        return
      }

      const prefix = projectWorkItemBusinessKeyPrefix(project.id)
      createLocalWorkItemFromSource(source, {
        id: `${prefix}-dup-${Date.now()}`,
        title,
        progress: source.progress ?? 0,
      })
      setCalendarDragHint(null)
      setSelectedDayKey(viewDayKey)
    },
    [createLocalWorkItemFromSource, onWorkItemsChange, project.id, project.name, usesApiItems],
  )

  const handleContextMenuCopyTitle = useCallback((title: string) => {
    setContextMenu(null)
    void navigator.clipboard?.writeText(title).catch(() => {
      setCalendarDragHint('Could not copy title to clipboard.')
    })
  }, [])

  const handleContextMenuCopyTask = useCallback((taskId: string) => {
    setContextMenu(null)
    const source = localWorkItemsRef.current.find((item) => item.id === taskId)
    if (!source) return
    setCalendarTaskClipboard(source)
    setHasTaskClipboard(true)
    setCalendarDragHint(null)
  }, [])

  const handleContextMenuPasteTask = useCallback(
    async (dayKey: string) => {
      setContextMenu(null)
      const source = getCalendarTaskClipboard()
      if (!source) return

      const title = source.title

      if (usesApiItems) {
        try {
          await createWorkItem({
            title,
            type: source.type,
            project: project.name,
            workspace: TECTONA_PROJECT_WORKSPACE,
            assignee: source.assignee,
            startDate: dayKey,
            dueDate: dayKey,
            status: source.status,
          })
          setSelectedDayKey(dayKey)
          setCalendarDragHint(null)
          await onWorkItemsChange?.()
        } catch {
          setCalendarDragHint('Failed to paste task — please try again.')
        }
        return
      }

      const prefix = projectWorkItemBusinessKeyPrefix(project.id)
      createLocalWorkItemFromSource(source, {
        id: `${prefix}-paste-${Date.now()}`,
        title,
        startDate: dayKey,
        dueDate: dayKey,
        progress: source.progress ?? 0,
      })
      setCalendarDragHint(null)
    },
    [createLocalWorkItemFromSource, onWorkItemsChange, project.id, project.name, usesApiItems],
  )

  const handleContextMenuViewDay = useCallback(
    (dayKey: string) => {
      setContextMenu(null)
      handleDaySelect(dayKey)
    },
    [handleDaySelect],
  )

  const handleContextMenuOpenDetail = useCallback(
    (taskId: string, dayKey: string) => {
      setContextMenu(null)
      handleTaskSelect(taskId, dayKey)
    },
    [handleTaskSelect],
  )

  const handleContextMenuSetStatus = useCallback(
    (taskId: string, status: WorkStatus) => {
      setContextMenu(null)
      void commitWorkItemPatch(taskId, { status })
    },
    [commitWorkItemPatch],
  )

  const handleContextMenuSetPriority = useCallback(
    (taskId: string, priority: Priority) => {
      setContextMenu(null)
      void commitWorkItemPatch(taskId, { priority })
    },
    [commitWorkItemPatch],
  )

  const handleContextMenuDelete = useCallback((taskId: string, taskTitle: string) => {
    setContextMenu(null)
    setDeleteConfirmTarget({ taskId, taskTitle })
  }, [])

  const closeDeleteConfirm = useCallback(() => {
    if (isDeletingTask) return
    setDeleteConfirmTarget(null)
  }, [isDeletingTask])

  const submitDeleteConfirm = useCallback(async () => {
    if (!deleteConfirmTarget || isDeletingTask) return
    await handleDeleteWorkItem(deleteConfirmTarget.taskId)
    setDeleteConfirmTarget(null)
  }, [deleteConfirmTarget, handleDeleteWorkItem, isDeletingTask])

  const deleteConfirmWorkItem = useMemo(() => {
    if (!deleteConfirmTarget) return null
    return localWorkItems.find((item) => item.id === deleteConfirmTarget.taskId) ?? null
  }, [deleteConfirmTarget, localWorkItems])

  const handleQuickAddClose = useCallback(() => {
    setQuickAdd(null)
  }, [])

  const handleQuickAddCreate = useCallback(
    async ({ title, type, dayKey }: { title: string; type: WorkItemType; dayKey: string }) => {
      setIsQuickAddSubmitting(true)
      try {
        if (usesApiItems) {
          await createWorkItem({
            title,
            type,
            project: project.name,
            workspace: TECTONA_PROJECT_WORKSPACE,
            assignee: assigneeLabel,
            startDate: dayKey,
            dueDate: dayKey,
            status: 'To Do',
          })
          setQuickAdd(null)
          setSelectedDayKey(dayKey)
          setCalendarDragHint(null)
          await onWorkItemsChange?.()
          return
        }

        const prefix = projectWorkItemBusinessKeyPrefix(project.id)
        const id = `${prefix}-new-${Date.now()}`
        const nowIso = new Date().toISOString()
        const newItem: WorkItemApiModel = {
          id,
          title,
          type,
          project: project.name,
          workspace: TECTONA_PROJECT_WORKSPACE,
          label: '',
          assignee: assigneeLabel,
          owner: assigneeLabel,
          role: 'Contributor',
          team: 'Delivery Squad',
          priority: 'Medium',
          status: 'To Do',
          startDate: dayKey,
          dueDate: dayKey,
          dependencyStatus: 'Clear',
          progress: 0,
          estimatedHours: 0,
          actualHours: 0,
          lastUpdated: nowIso,
          parentId: null,
          epicId: null,
          featureId: null,
          description: '',
        }
        const nextItems = [...localWorkItemsRef.current, newItem]
        localWorkItemsRef.current = nextItems
        setLocalWorkItems(nextItems)
        const currentOrder = dayOrderMap[dayKey] ?? []
        setDayOrderMap(saveCalendarDayOrder(project.id, dayKey, [id, ...currentOrder.filter((entry) => entry !== id)]))
        setQuickAdd(null)
        setSelectedDayKey(dayKey)
        setCalendarDragHint(null)
      } catch {
        setCalendarDragHint('Failed to create task — please try again.')
      } finally {
        setIsQuickAddSubmitting(false)
      }
    },
    [assigneeLabel, dayOrderMap, onWorkItemsChange, project.id, project.name, usesApiItems],
  )

  useEffect(() => {
    if (!isFullscreen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isFullscreen])

  useLayoutEffect(() => {
    if (isFullscreen) {
      setPanelHeightPx(null)
      return
    }

    const panelEl = panelRef.current
    if (!panelEl) return

    const updateHeight = () => {
      setPanelHeightPx(measureProjectPanelHeight(panelEl))
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)
    window.addEventListener('scroll', updateHeight, { passive: true })

    const observer = new ResizeObserver(updateHeight)
    observer.observe(panelEl)
    if (panelEl.parentElement) observer.observe(panelEl.parentElement)

    return () => {
      window.removeEventListener('resize', updateHeight)
      window.removeEventListener('scroll', updateHeight)
      observer.disconnect()
    }
  }, [isFullscreen])

  const goToPreviousMonth = () => {
    setViewMonth((current) => {
      if (current === 0) {
        setViewYear((year) => year - 1)
        return 11
      }
      return current - 1
    })
  }

  const goToNextMonth = () => {
    setViewMonth((current) => {
      if (current === 11) {
        setViewYear((year) => year + 1)
        return 0
      }
      return current + 1
    })
  }

  const panel = (
    <div
      ref={panelRef}
      id="panel-calendar"
      style={
        isFullscreen
          ? { height: 'calc(100dvh - 3rem)', maxHeight: 'calc(100dvh - 3rem)' }
          : panelHeightPx != null
            ? { height: panelHeightPx, maxHeight: panelHeightPx, minHeight: PROJECT_PANEL_MIN_HEIGHT_PX }
            : undefined
      }
      className={cn(
        'scroll-mt-24',
        'liquid-glass-enterprise-panel flex min-h-0 flex-col overflow-hidden border border-border/40',
        'shadow-[0_14px_40px_rgba(15,23,42,0.06)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]',
        isFullscreen
          ? 'fixed inset-x-0 top-12 bottom-0 z-50 rounded-none border-0 bg-background'
          : 'rounded-2xl',
      )}
    >
      <div className="flex h-full min-h-0 w-full flex-col">
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden',
            isFullscreen ? 'px-4 pb-3 pt-2 lg:px-5 lg:pb-4 lg:pt-2' : 'p-4 lg:p-5',
          )}
        >
          <div className="shrink-0 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <CalendarDays className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                <h2 className="text-lg font-semibold text-foreground">Project Calendar</h2>
              </div>
              <button
                type="button"
                aria-pressed={isFullscreen}
                aria-label={isFullscreen ? 'Exit calendar fullscreen' : 'Expand calendar to fullscreen'}
                title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen (header stays visible)'}
                onClick={() => setIsFullscreen((prev) => !prev)}
                className={cn(
                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/40 hover:text-foreground',
                  calendarToolbarFocusClass,
                  isFullscreen && 'bg-foreground text-background hover:bg-foreground/90 hover:text-background',
                )}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
              <p className="min-w-0 max-w-2xl flex-1 text-[11px] leading-snug text-muted-foreground">
                Month view of scheduled work — tasks appear on each day from start through due date. Drag to another day to reschedule, or drag up/down within a day to reorder; click a day to inspect items.
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 lg:shrink-0 lg:justify-end">
                <p className="shrink-0 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{calendarEvents.length}</span> scheduled
                  {unscheduledCount > 0 ? (
                    <>
                      {' '}
                      · <span className="font-semibold text-foreground">{unscheduledCount}</span> without dates
                    </>
                  ) : null}
                </p>
                <div className="hidden h-5 w-px shrink-0 bg-border/60 lg:block" aria-hidden />
                <p className="shrink-0 text-sm font-semibold text-foreground">
                  {formatCalendarMonthLabel(viewYear, viewMonth)}
                </p>
                <div className="hidden h-5 w-px shrink-0 bg-border/60 lg:block" aria-hidden />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={goToPreviousMonth}
                    className={cn(
                      'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background/80 text-muted-foreground transition hover:bg-muted/40 hover:text-foreground',
                      calendarToolbarFocusClass,
                    )}
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={goToToday}
                    className={cn(
                      'rounded-lg border border-border/60 bg-background/80 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted/40',
                      calendarToolbarFocusClass,
                    )}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={goToNextMonth}
                    className={cn(
                      'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background/80 text-muted-foreground transition hover:bg-muted/40 hover:text-foreground',
                      calendarToolbarFocusClass,
                    )}
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            </div>
            {calendarDragHint ? (
              <p className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                {calendarDragHint}
              </p>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/40 bg-muted/10">
              <div className="grid shrink-0 grid-cols-7 border-b border-border/40 bg-background/70">
                {WEEKDAY_LABELS.map((label, index) => {
                  const isWeekendColumn = isWeekendColumnIndex(index)
                  return (
                    <div
                      key={label}
                      className={cn(
                        'px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em]',
                        isWeekendColumn
                          ? 'bg-red-50/95 text-red-600 dark:bg-red-950/45 dark:text-red-300'
                          : 'text-muted-foreground',
                      )}
                    >
                      {label}
                    </div>
                  )
                })}
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div
                  ref={calendarGridRef}
                  className="grid min-h-0 min-w-0 flex-1 auto-rows-fr grid-cols-7 overflow-y-auto overflow-x-hidden"
                >
                  {monthCells.map(({ date, dayKey, inCurrentMonth }) => {
                    const dayEvents = eventsByDay.get(dayKey) ?? []
                    const isToday = isSameCalendarDay(date, today)
                    const isSelected = selectedDayKey === dayKey
                    const isWeekendDay = isWeekendDate(date)

                    return (
                      <CalendarDayCell
                        key={dayKey}
                        dayKey={dayKey}
                        date={date}
                        inCurrentMonth={inCurrentMonth}
                        isToday={isToday}
                        isSelected={isSelected}
                        isWeekendDay={isWeekendDay}
                        isDropTarget={overDayKey === dayKey && dragPayload?.viewDayKey !== dayKey}
                        isQuickAddOpen={quickAdd?.dayKey === dayKey}
                        dayEvents={dayEvents}
                        dragPayload={dragPayload}
                        reorderHint={reorderHint}
                        selectedTaskId={selectedTaskId}
                        onSelect={handleDaySelect}
                        onQuickAddOpen={handleQuickAddOpen}
                        onTaskSelect={handleTaskSelect}
                        onDayContextMenu={handleDayContextMenu}
                        onTaskContextMenu={handleTaskContextMenu}
                        onDayDragStart={handleTaskDragStart}
                        onDayDragEnd={handleTaskDragEnd}
                        onDayDragEnter={handleDayDragEnter}
                        onDayDragOver={handleDayDragOver}
                        onDayDragLeave={handleDayDragLeave}
                        onDayDrop={handleDayDrop}
                        onTaskDragOver={handleTaskDragOver}
                        onTaskDrop={handleTaskDrop}
                      />
                    )
                  })}
                </div>
              </div>
            </div>

            <CalendarSelectedDaySidebar
              selectedDayKey={selectedDayKey}
              selectedDayEvents={selectedDayEvents}
              selectedTaskId={selectedTaskId}
              selectedWorkItem={selectedWorkItem}
              today={today}
              isDeletingTask={isDeletingTask}
              onBackToDay={handleBackToDay}
              onTaskSelect={(taskId) => {
                if (selectedDayKey) handleTaskSelect(taskId, selectedDayKey)
              }}
              onPatchWorkItem={commitWorkItemPatch}
              onDeleteWorkItem={handleDeleteWorkItem}
            />
          </div>
        </div>
      </div>
    </div>
  )

  const quickAddPopover =
    quickAdd && typeof document !== 'undefined' ? (
      <CalendarQuickAddPopover
        dayKey={quickAdd.dayKey}
        anchorEl={quickAdd.anchorEl}
        assigneeLabel={assigneeLabel}
        initialType={quickAdd.initialType}
        isSubmitting={isQuickAddSubmitting}
        onClose={handleQuickAddClose}
        onCreate={handleQuickAddCreate}
      />
    ) : null

  const pickDatePopover =
    pickDateMove && typeof document !== 'undefined' ? (
      <CalendarPickDatePopover
        anchorEl={pickDateMove.anchorEl}
        initialDayKey={pickDateMove.viewDayKey}
        onClose={handlePickDateMoveClose}
        onSelect={handlePickDateMoveSelect}
      />
    ) : null

  const contextMenuPortal =
    typeof document !== 'undefined' ? (
      <CalendarContextMenu
        target={contextMenu}
        hasTaskClipboard={hasTaskClipboard}
        onClose={handleCloseContextMenu}
        onDayAddTask={handleContextMenuAddTask}
        onDayAddTaskWithType={handleContextMenuAddTaskWithType}
        onDayView={handleContextMenuViewDay}
        onDayGoToToday={handleContextMenuGoToToday}
        onDayPasteTask={handleContextMenuPasteTask}
        onTaskOpenDetail={handleContextMenuOpenDetail}
        onTaskMarkDone={handleContextMenuMarkDone}
        onTaskSetStatus={handleContextMenuSetStatus}
        onTaskSetPriority={handleContextMenuSetPriority}
        onTaskSetType={handleContextMenuSetType}
        onTaskMoveTo={handleContextMenuMoveTask}
        onTaskPickDateMove={handleContextMenuPickDateMove}
        onTaskDuplicate={handleContextMenuDuplicate}
        onTaskCopyTitle={handleContextMenuCopyTitle}
        onTaskCopyTask={handleContextMenuCopyTask}
        onTaskDelete={handleContextMenuDelete}
      />
    ) : null

  const deleteConfirmPortal =
    typeof document !== 'undefined' ? (
      <CalendarTaskDeleteConfirmModal
        open={deleteConfirmTarget !== null}
        workItem={
          deleteConfirmWorkItem ??
          (deleteConfirmTarget
            ? {
                id: deleteConfirmTarget.taskId,
                title: deleteConfirmTarget.taskTitle,
                type: 'Task',
                status: 'To Do',
                assignee: '',
                startDate: undefined,
                dueDate: undefined,
              }
            : null)
        }
        busy={isDeletingTask}
        onClose={closeDeleteConfirm}
        onConfirm={() => void submitDeleteConfirm()}
      />
    ) : null

  if (isFullscreen && typeof document !== 'undefined') {
    return (
      <>
        <div className="min-h-[50vh]" aria-hidden />
        {createPortal(panel, document.body)}
        {quickAddPopover}
        {contextMenuPortal}
        {pickDatePopover}
        {deleteConfirmPortal}
      </>
    )
  }

  return (
    <>
      {panel}
      {quickAddPopover}
      {contextMenuPortal}
      {pickDatePopover}
      {deleteConfirmPortal}
    </>
  )
}
