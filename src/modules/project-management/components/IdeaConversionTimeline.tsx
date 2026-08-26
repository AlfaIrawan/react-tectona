import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react'
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  GanttChartSquare,
  LayoutGrid,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IdeaConversionSprint } from '@/lib/api/tectonaAgentRuntimeApi'
import {
  PlanningSvarGantt,
  type PlanningGanttItem,
  type PlanningGanttTaskGridEditEvent,
  type PlanningGanttTaskMoveEvent,
  type PlanningGanttTaskScheduleUpdateEvent,
  type PlanningGanttZoomLevel,
} from '@/modules/planning-scheduling/components/PlanningSvarGantt'
import { TIMELINE_GANTT_GRID_COLUMNS } from '@/modules/task-work-management/components/DirectoryGanttGridCells'

function computeConversionTimelineWindow(
  items: PlanningGanttItem[],
): { start: Date; end: Date } {
  let minMs = Number.POSITIVE_INFINITY

  for (const item of items) {
    if (!item.startDate) continue
    const start = Date.parse(`${item.startDate}T00:00:00Z`)
    if (Number.isFinite(start)) minMs = Math.min(minMs, start)
  }

  const now = new Date()
  const currentYear = now.getUTCFullYear()
  const rollingStart = new Date(Date.UTC(currentYear, 0, 1))
  const rollingEnd = new Date(Date.UTC(currentYear + 5, 11, 31))

  if (!Number.isFinite(minMs)) {
    return {
      start: rollingStart,
      end: rollingEnd,
    }
  }

  const taskAnchoredStart = new Date(minMs - 14 * 86_400_000)
  const start = taskAnchoredStart.getTime() < rollingStart.getTime() ? taskAnchoredStart : rollingStart

  return { start, end: rollingEnd }
}

const GANTT_ZOOM_OPTIONS: {
  level: PlanningGanttZoomLevel
  label: string
  icon: LucideIcon
}[] = [
  { level: 'Day', label: 'Day', icon: CalendarDays },
  { level: 'Week', label: 'Week', icon: CalendarRange },
  { level: 'Month', label: 'Month', icon: Calendar },
  { level: 'Quarter', label: 'Quarter', icon: LayoutGrid },
]

const toolbarFocusClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30 focus-visible:ring-offset-0'

const CONVERSION_GANTT_SCROLL_STYLES = `
  .idea-conversion-gantt-host .wx-chart {
    overscroll-behavior-x: none;
    scrollbar-width: thin;
    scrollbar-color: rgba(148, 163, 184, 0.75) rgba(241, 245, 249, 0.65);
  }

  .idea-conversion-gantt-host .wx-chart::-webkit-scrollbar {
    height: 8px;
  }

  .idea-conversion-gantt-host .wx-chart::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.75);
    border-radius: 9999px;
  }
`

function normalizeConversionDateRange(
  startDate: string,
  endDate: string,
  durationDays: number,
): { startDate: string; endDate: string; durationDays: number } {
  const start = startDate?.trim() || endDate?.trim() || ''
  let end = endDate?.trim() || start
  if (!start) {
    const today = new Date()
    const iso = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`
    return { startDate: iso, endDate: iso, durationDays: Math.max(0, durationDays) }
  }
  if (end < start) end = start
  return { startDate: start, endDate: end, durationDays: Math.max(0, durationDays) }
}

function isoAddDays(startDate: string, days: number): string {
  const [y, m, d] = startDate.split('-').map(Number)
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
  if (days <= 0) return startDate
  date.setUTCDate(date.getUTCDate() + days)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function mapConversionSprintsToGanttItems(
  sprints: IdeaConversionSprint[],
  projectName: string,
): PlanningGanttItem[] {
  const items: PlanningGanttItem[] = []
  let listOrder = 0
  const project = projectName.trim() || 'Idea Conversion'

  const pushItem = (
    id: string,
    title: string,
    parentId: string | null,
    startDate: string,
    endDate: string,
    durationDays: number,
    type: PlanningGanttItem['type'],
    workItemType: string,
  ) => {
    const schedule = normalizeConversionDateRange(startDate, endDate, durationDays)
    items.push({
      id,
      title,
      workspace: project,
      project,
      team: '',
      owner: '',
      sprint: '',
      type: schedule.durationDays <= 0 ? 'Milestone' : type,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      progress: 0,
      parentId,
      listOrder: listOrder++,
      workItemType,
      itemSource: 'tectona',
    })
  }

  for (const sprint of sprints) {
    pushItem(
      sprint.id,
      sprint.title,
      null,
      sprint.start_date,
      sprint.end_date,
      sprint.duration_days,
      'Phase',
      'Sprint',
    )
    for (const epic of sprint.epics) {
      pushItem(
        epic.id,
        epic.title,
        sprint.id,
        epic.start_date,
        epic.end_date,
        epic.duration_days,
        'Workstream',
        'Epic',
      )
      for (const task of epic.tasks) {
        pushItem(
          task.id,
          task.title,
          epic.id,
          task.start_date,
          task.end_date,
          task.duration_days,
          'Workstream',
          'Task',
        )
        for (const sub of task.sub_tasks) {
          pushItem(
            sub.id,
            sub.title,
            task.id,
            sub.start_date,
            sub.end_date,
            sub.duration_days,
            'Workstream',
            'Sub-task',
          )
        }
      }
    }
  }

  return items
}

function applyConversionGanttMove(
  items: PlanningGanttItem[],
  event: PlanningGanttTaskMoveEvent,
): PlanningGanttItem[] | null {
  const dragged = items.find((item) => item.id === event.id)
  if (!dragged) return null

  if (event.mode === 'child' && event.target) {
    return items.map((item) =>
      item.id === event.id ? { ...item, parentId: event.target ?? null } : item,
    )
  }

  if ((event.mode === 'before' || event.mode === 'after') && event.target) {
    const target = items.find((item) => item.id === event.target)
    if (!target) return null
    const parentId = target.parentId ?? null
    const targetOrder = target.listOrder ?? 0
    const nextOrder = event.mode === 'before' ? targetOrder - 0.5 : targetOrder + 0.5
    return items.map((item) =>
      item.id === event.id ? { ...item, parentId, listOrder: nextOrder } : item,
    )
  }

  if (event.mode === 'up' || event.mode === 'down') {
    const parentId = dragged.parentId ?? null
    const siblings = items
      .filter((item) => (item.parentId ?? null) === parentId)
      .sort((left, right) => (left.listOrder ?? 0) - (right.listOrder ?? 0))
    const index = siblings.findIndex((item) => item.id === event.id)
    if (index < 0) return null
    const swapIndex = event.mode === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= siblings.length) return items
    const swapOrder = siblings[swapIndex].listOrder ?? swapIndex
    const currentOrder = dragged.listOrder ?? index
    return items.map((item) => {
      if (item.id === event.id) return { ...item, listOrder: swapOrder }
      if (item.id === siblings[swapIndex].id) return { ...item, listOrder: currentOrder }
      return item
    })
  }

  return items
}

export function scrollConversionGanttChart(
  host: HTMLElement | null,
  direction: 'prev' | 'next',
  zoomLevel: PlanningGanttZoomLevel,
) {
  const chart = host?.querySelector<HTMLElement>('.wx-chart')
  if (!chart) return

  const stepRatio =
    zoomLevel === 'Day' ? 0.45 : zoomLevel === 'Week' ? 0.55 : zoomLevel === 'Month' ? 0.65 : 0.75
  const delta = chart.clientWidth * stepRatio * (direction === 'prev' ? -1 : 1)
  const maxScroll = Math.max(0, chart.scrollWidth - chart.clientWidth)
  chart.scrollLeft = Math.max(0, Math.min(maxScroll, chart.scrollLeft + delta))
}

type IdeaConversionGanttToolbarProps = {
  sprints: IdeaConversionSprint[]
  projectName?: string
  zoomLevel: PlanningGanttZoomLevel
  onZoomLevelChange: (level: PlanningGanttZoomLevel) => void
  className?: string
}

export function IdeaConversionGanttToolbar({
  sprints,
  projectName,
  zoomLevel,
  onZoomLevelChange,
  className,
}: IdeaConversionGanttToolbarProps) {
  const itemCount = useMemo(
    () => mapConversionSprintsToGanttItems(sprints, projectName ?? 'Idea Conversion').length,
    [projectName, sprints],
  )

  return (
    <div
      className={cn(
        'flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto px-1 py-1 text-xs text-muted-foreground scrollbar-hide lg:ml-auto',
        className,
      )}
    >
      <div
        className="inline-flex shrink-0 rounded-lg border border-border/60 bg-muted/20 p-0.5"
        role="group"
        aria-label="Gantt zoom level"
      >
        {GANTT_ZOOM_OPTIONS.map(({ level, label, icon: Icon }) => {
          const active = zoomLevel === level
          return (
            <button
              key={level}
              type="button"
              aria-pressed={active}
              aria-label={`${label} view`}
              onClick={() => onZoomLevelChange(level)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition',
                toolbarFocusClass,
                active
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {label}
            </button>
          )
        })}
      </div>
      <p className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{itemCount}</span> work items
      </p>
    </div>
  )
}

type IdeaConversionTimelineProps = {
  sprints: IdeaConversionSprint[]
  projectName?: string
  zoomLevel: PlanningGanttZoomLevel
  timelineWindowOverride: { start: Date; end: Date }
  className?: string
}

export const IdeaConversionTimeline = memo(function IdeaConversionTimeline({
  sprints,
  projectName,
  zoomLevel,
  timelineWindowOverride,
  className,
}: IdeaConversionTimelineProps) {
  const [selectedId, setSelectedId] = useState('')
  const [taskStructureRevision, setTaskStructureRevision] = useState(0)
  const [ganttItems, setGanttItems] = useState<PlanningGanttItem[]>(() =>
    mapConversionSprintsToGanttItems(sprints, projectName ?? 'Idea Conversion'),
  )
  const chartHostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setGanttItems(mapConversionSprintsToGanttItems(sprints, projectName ?? 'Idea Conversion'))
    setTaskStructureRevision((value) => value + 1)
  }, [projectName, sprints])

  const handleTaskScheduleCommit = useCallback((event: PlanningGanttTaskScheduleUpdateEvent) => {
    setGanttItems((prev) =>
      prev.map((item) =>
        item.id === event.id
          ? { ...item, startDate: event.startDate, endDate: event.endDate }
          : item,
      ),
    )
    return true
  }, [])

  const handleTaskGridEditCommit = useCallback((event: PlanningGanttTaskGridEditEvent) => {
    setGanttItems((prev) =>
      prev.map((item) => {
        if (item.id !== event.id) return item
        if (event.field === 'title') {
          return { ...item, title: String(event.value) }
        }
        if (event.field === 'startDate') {
          const startDate = String(event.value).slice(0, 10)
          const endDate = item.endDate >= startDate ? item.endDate : startDate
          return { ...item, startDate, endDate }
        }
        if (event.field === 'durationDays') {
          const durationDays = Math.max(0, Number(event.value) || 0)
          const endDate =
            durationDays <= 0 ? item.startDate : isoAddDays(item.startDate, durationDays)
          return {
            ...item,
            endDate,
            type: durationDays <= 0 ? 'Milestone' : item.type === 'Milestone' ? 'Workstream' : item.type,
          }
        }
        return item
      }),
    )
    return true
  }, [])

  const handleTaskMoveCommit = useCallback((event: PlanningGanttTaskMoveEvent) => {
    setGanttItems((prev) => {
      const next = applyConversionGanttMove(prev, event)
      if (!next) {
        setTaskStructureRevision((value) => value + 1)
        return prev
      }
      return next
    })
    return true
  }, [])

  return (
    <div
      ref={chartHostRef}
      className={cn('idea-conversion-gantt-host flex h-full min-h-0 w-full flex-col', className)}
    >
      <style>{CONVERSION_GANTT_SCROLL_STYLES}</style>
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl">
        {ganttItems.length === 0 ? (
          <div className="flex w-full flex-1 flex-col items-center justify-center px-6 py-12">
            <GanttChartSquare className="h-10 w-10 text-muted-foreground" aria-hidden />
            <p className="mt-4 text-sm font-semibold text-foreground">No schedule items</p>
            <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
              Conversion timeline will appear here once generated.
            </p>
          </div>
        ) : (
          <PlanningSvarGantt
            items={ganttItems}
            layout="project-tree"
            columns={TIMELINE_GANTT_GRID_COLUMNS}
            zoomLevel={zoomLevel}
            selectedId={selectedId}
            onSelect={setSelectedId}
            enableRowReorder
            onTaskMoveCommit={handleTaskMoveCommit}
            enableChartEdit
            onTaskScheduleCommit={handleTaskScheduleCommit}
            enableGridEdit
            onTaskGridEditCommit={handleTaskGridEditCommit}
            taskStructureRevision={taskStructureRevision}
            timelineScaleResize={false}
            enableTimelineScrollExtension={false}
            timelineWindowOverride={timelineWindowOverride}
            scrollToTaskWindowOnMount
            surface="solid"
          />
        )}
      </div>
    </div>
  )
})

type IdeaConversionGanttWorkspaceProps = {
  sprints: IdeaConversionSprint[]
  projectName?: string
  zoomLevel: PlanningGanttZoomLevel
  onZoomLevelChange: (level: PlanningGanttZoomLevel) => void
  className?: string
}

/** Self-contained conversion Gantt: toolbar + timeline share paging state without IdeaDetail re-renders. */
export function IdeaConversionGanttWorkspace({
  sprints,
  projectName,
  zoomLevel,
  onZoomLevelChange,
  className,
}: IdeaConversionGanttWorkspaceProps) {
  const ganttItems = useMemo(
    () => mapConversionSprintsToGanttItems(sprints, projectName ?? 'Idea Conversion'),
    [projectName, sprints],
  )

  const timelineWindow = useMemo(
    () => computeConversionTimelineWindow(ganttItems),
    [ganttItems],
  )

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-3 overflow-hidden', className)}>
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <IdeaConversionTimeline
          sprints={sprints}
          projectName={projectName}
          zoomLevel={zoomLevel}
          timelineWindowOverride={timelineWindow}
        />
      </div>
    </div>
  )
}
