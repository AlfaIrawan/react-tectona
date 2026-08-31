import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, startTransition, type ComponentProps } from 'react'
import { createPortal } from 'react-dom'
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  CheckSquare2,
  ChevronDown,
  GanttChartSquare,
  LayoutGrid,
  Maximize2,
  Minimize2,
  ListChecks,
  Plus,
  Save,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { WorkItemApiModel, WorkItemType, WorkStatus, Priority } from '@/lib/api/workApi'
import { createWorkItem, patchWorkItem, TECTONA_PROJECT_WORKSPACE } from '@/lib/api/workApi'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { EnterpriseRichTextEditor } from '@/components/enterprise/EnterpriseRichTextEditor'
import {
  PlanningSvarGantt,
  type PlanningGanttItem,
  type PlanningGanttTaskGridEditEvent,
  type PlanningGanttTaskMoveEvent,
  type PlanningGanttTaskScheduleUpdateEvent,
  type PlanningGanttZoomLevel,
} from '@/modules/planning-scheduling/components/PlanningSvarGantt'
import { TIMELINE_GANTT_GRID_COLUMNS } from '@/modules/task-work-management/components/DirectoryGanttGridCells'
import { applyDirectorySiblingOrder, type DirectorySiblingOrderMap } from '@/modules/task-work-management/utils/directorySiblingOrder'
import { cn } from '@/lib/utils'
import { enterpriseSecondaryButtonClass, registerServicePrimaryButtonClass } from '@/lib/enterpriseButtonClasses'
import type { ProjectTemplate } from '../data/projectTemplates'
import { buildProjectTimelineGanttItemsFromWorkItems } from '../lib/buildProjectTimelineGanttItems'
import {
  applyReparentToWorkItem,
  resolveTimelineTaskMove,
} from '../lib/resolveTimelineTaskMove'
import {
  applyScheduleToWorkItem,
  resolveTimelineTaskScheduleUpdate,
} from '../lib/resolveTimelineTaskSchedule'
import { resolveTimelineTaskInlineEdit } from '../lib/resolveTimelineTaskInlineEdit'
import type { Project } from '../store/projectStore'
import {
  measureProjectPanelHeight,
  PROJECT_PANEL_MIN_HEIGHT_PX,
} from '../lib/projectPanelLayout'

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

const timelineToolbarFocusClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30 focus-visible:ring-offset-0'

function itemMatchesTimelineSearch(item: PlanningGanttItem, query: string): boolean {
  const haystack = [
    item.title,
    item.id,
    item.project,
    item.workspace,
    item.owner,
    item.team,
    item.sprint,
    item.type,
    item.workItemType,
    item.label,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function filterTimelineGanttItems(items: PlanningGanttItem[], rawQuery: string): PlanningGanttItem[] {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return items

  const byId = new Map(items.map((item) => [item.id, item]))
  const visibleIds = new Set<string>()

  for (const item of items) {
    if (!itemMatchesTimelineSearch(item, query)) continue

    visibleIds.add(item.id)
    let parentId = item.parentId
    while (parentId && byId.has(parentId)) {
      visibleIds.add(parentId)
      parentId = byId.get(parentId)?.parentId ?? null
    }
  }

  return items.filter((item) => visibleIds.has(item.id))
}

/** Keep the project chart anchored to its actual work-item dates, like Idea Conversion.
 * This prevents the header from opening on an unrelated future window while the task rows
 * are already scheduled in the current project delivery period. */
function computeProjectTimelineWindow(items: PlanningGanttItem[]): { start: Date; end: Date } {
  let minMs = Number.POSITIVE_INFINITY
  for (const item of items) {
    if (!item.startDate?.trim()) continue
    const start = Date.parse(`${item.startDate.slice(0, 10)}T00:00:00Z`)
    if (Number.isFinite(start)) minMs = Math.min(minMs, start)
  }

  const now = new Date()
  const currentYear = now.getUTCFullYear()
  const rollingStart = new Date(Date.UTC(currentYear, 0, 1))
  const rollingEnd = new Date(Date.UTC(currentYear + 5, 11, 31))

  if (!Number.isFinite(minMs)) return { start: rollingStart, end: rollingEnd }

  const taskAnchoredStart = new Date(minMs - 14 * 86_400_000)
  return {
    start: taskAnchoredStart.getTime() < rollingStart.getTime() ? taskAnchoredStart : rollingStart,
    end: rollingEnd,
  }
}

type AddTaskDraft = {
  title: string
  type: WorkItemType
  status: WorkStatus
  priority: Priority
  startDate: string
  dueDate: string
  assignee: string
  parentId: string
  description: string
}

const ADD_TASK_TYPES: WorkItemType[] = ['Task', 'Epic', 'Feature', 'Subtask', 'Checklist', 'Bug']
const ADD_TASK_STATUSES: WorkStatus[] = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done']
const ADD_TASK_PRIORITIES: Priority[] = ['Critical', 'High', 'Medium', 'Low']

function addDaysToIsoDate(startDate: string, days: number): string {
  const date = new Date(`${startDate}T00:00:00Z`)
  if (!Number.isFinite(date.getTime())) return startDate
  date.setUTCDate(date.getUTCDate() + Math.max(0, days))
  return date.toISOString().slice(0, 10)
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function ProjectTimelinePanel({
  project,
  ownerName,
  workItems,
  usesApiItems = false,
  onWorkItemsChange,
  openAddTaskRequest,
}: {
  project: Project
  template?: ProjectTemplate
  ownerName: string
  workItems: WorkItemApiModel[]
  usesApiItems?: boolean
  onWorkItemsChange?: () => void | Promise<void>
  openAddTaskRequest?: number
}) {
  const { addToast } = useToast()
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelHeightPx, setPanelHeightPx] = useState<number | null>(null)
  const [zoomLevel, setZoomLevel] = useState<PlanningGanttZoomLevel>('Week')
  const [selectedId, setSelectedId] = useState('')
  const [timelineSelectMode, setTimelineSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [localWorkItems, setLocalWorkItems] = useState(workItems)
  const [siblingOrder, setSiblingOrder] = useState<DirectorySiblingOrderMap>({})
  const [timelineMoveHint, setTimelineMoveHint] = useState<string | null>(null)
  const [taskStructureRevision, setTaskStructureRevision] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [addTaskSaving, setAddTaskSaving] = useState(false)
  const [addTaskDraft, setAddTaskDraft] = useState<AddTaskDraft>(() => {
    const today = todayIsoDate()
    return {
      title: '',
      type: 'Task',
      status: 'To Do',
      priority: 'Medium',
      startDate: today,
      dueDate: addDaysToIsoDate(today, 1),
      assignee: ownerName || 'Unassigned',
      parentId: '',
      description: '',
    }
  })
  const localWorkItemsRef = useRef(workItems)
  const siblingOrderRef = useRef<DirectorySiblingOrderMap>({})

  useEffect(() => {
    localWorkItemsRef.current = localWorkItems
  }, [localWorkItems])

  useEffect(() => {
    siblingOrderRef.current = siblingOrder
  }, [siblingOrder])

  useEffect(() => {
    setLocalWorkItems(workItems)
  }, [workItems])

  useEffect(() => {
    if (!timelineMoveHint) return
    const timer = window.setTimeout(() => setTimelineMoveHint(null), 5000)
    return () => window.clearTimeout(timer)
  }, [timelineMoveHint])

  useEffect(() => {
    if (!timelineSelectMode && selectedIds.length > 0) setSelectedIds([])
  }, [selectedIds.length, timelineSelectMode])

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

  const orderedWorkItems = useMemo(
    () => applyDirectorySiblingOrder(localWorkItems, siblingOrder, null),
    [localWorkItems, siblingOrder],
  )

  const ganttItems = useMemo(
    () => buildProjectTimelineGanttItemsFromWorkItems(orderedWorkItems, project, { ownerName }),
    [orderedWorkItems, ownerName, project],
  )

  const filteredGanttItems = useMemo(
    () => filterTimelineGanttItems(ganttItems, deferredSearch),
    [deferredSearch, ganttItems],
  )

  const timelineWindow = useMemo(
    () => computeProjectTimelineWindow(ganttItems),
    [ganttItems],
  )

  useEffect(() => {
    const visibleIds = new Set(filteredGanttItems.map((item) => item.id))
    if (selectedId && !visibleIds.has(selectedId)) setSelectedId('')
    setSelectedIds((prev) => {
      const next = prev.filter((id) => visibleIds.has(id))
      return next.length === prev.length ? prev : next
    })
  }, [filteredGanttItems, selectedId])

  const schedulableCount = useMemo(
    () => filteredGanttItems.filter((item) => item.startDate && item.endDate).length,
    [filteredGanttItems],
  )

  const hasActiveSearch = deferredSearch.trim().length > 0
  const hasActiveSearchRef = useRef(hasActiveSearch)

  const resetAddTaskDraft = useCallback(() => {
    const today = todayIsoDate()
    setAddTaskDraft({
      title: '',
      type: 'Task',
      status: 'To Do',
      priority: 'Medium',
      startDate: today,
      dueDate: addDaysToIsoDate(today, 1),
      assignee: ownerName || 'Unassigned',
      parentId: '',
      description: '',
    })
  }, [ownerName])

  useEffect(() => {
    if (openAddTaskRequest == null || openAddTaskRequest === 0) return
    resetAddTaskDraft()
    setAddTaskOpen(true)
  }, [openAddTaskRequest, resetAddTaskDraft])

  const handleCreateTask = useCallback(async () => {
    const title = addTaskDraft.title.trim()
    if (!title || addTaskSaving) return

    const startDate = addTaskDraft.startDate || todayIsoDate()
    const dueDate = addTaskDraft.dueDate || startDate
    setAddTaskSaving(true)
    try {
      if (usesApiItems) {
        await createWorkItem({
          title,
          type: addTaskDraft.type,
          project: project.name,
          workspace: TECTONA_PROJECT_WORKSPACE,
          assignee: addTaskDraft.assignee.trim() || ownerName || 'Unassigned',
          priority: addTaskDraft.priority,
          status: addTaskDraft.status,
          startDate,
          dueDate,
          parentId: addTaskDraft.parentId || null,
          description: addTaskDraft.description.trim(),
        })
        await onWorkItemsChange?.()
      } else {
        const localId = `timeline-new-${Date.now()}`
        const localItem: WorkItemApiModel = {
          id: localId,
          title,
          type: addTaskDraft.type,
          project: project.name,
          workspace: TECTONA_PROJECT_WORKSPACE,
          assignee: addTaskDraft.assignee.trim() || ownerName || 'Unassigned',
          owner: addTaskDraft.assignee.trim() || ownerName || 'Unassigned',
          role: 'Contributor',
          team: 'Delivery Squad',
          priority: addTaskDraft.priority,
          status: addTaskDraft.status,
          startDate,
          dueDate,
          parentId: addTaskDraft.parentId || null,
          dependencyStatus: 'Clear',
          progress: addTaskDraft.status === 'Done' ? 100 : 0,
          estimatedHours: 8,
          actualHours: 0,
          lastUpdated: new Date().toISOString(),
          description: addTaskDraft.description.trim(),
        }
        setLocalWorkItems((previous) => [...previous, localItem])
      }

      setAddTaskOpen(false)
      resetAddTaskDraft()
      addToast({ title: 'Task created', description: `"${title}" is now available in Timeline, List, Board, and Calendar.`, variant: 'success' })
    } catch (error) {
      addToast({ title: 'Failed to create task', description: error instanceof Error ? error.message : 'Please try again.', variant: 'error' })
    } finally {
      setAddTaskSaving(false)
    }
  }, [addTaskDraft, addTaskSaving, addToast, onWorkItemsChange, ownerName, project.name, resetAddTaskDraft, usesApiItems])

  useEffect(() => {
    hasActiveSearchRef.current = hasActiveSearch
  }, [hasActiveSearch])

  const handleTaskMoveCommit = useCallback(
    (event: PlanningGanttTaskMoveEvent): boolean => {
      if (hasActiveSearchRef.current) {
        startTransition(() => {
          setTimelineMoveHint('Clear search before reordering or reparenting tasks.')
          setTaskStructureRevision((value) => value + 1)
        })
        return false
      }

      const previousItems = localWorkItemsRef.current
      const previousOrder = siblingOrderRef.current

      const resolved = resolveTimelineTaskMove(event, previousItems, previousOrder)
      if (!resolved?.valid) {
        // SVAR already applied the move during drag; remount to restore props tree.
        startTransition(() => {
          setTimelineMoveHint(resolved?.message ?? 'This move is not allowed.')
          setTaskStructureRevision((value) => value + 1)
        })
        return false
      }

      siblingOrderRef.current = resolved.siblingOrder

      if (resolved.parentChanged) {
        const dragged = previousItems.find((item) => item.id === resolved.draggedId)
        if (!dragged) {
          startTransition(() => setSiblingOrder(resolved.siblingOrder))
          return true
        }

        const newParent = resolved.newParentId
          ? previousItems.find((item) => item.id === resolved.newParentId) ?? null
          : null
        const nextItems = previousItems.map((item) =>
          item.id === resolved.draggedId ? applyReparentToWorkItem(dragged, newParent) : item,
        )
        localWorkItemsRef.current = nextItems

        startTransition(() => {
          setSiblingOrder(resolved.siblingOrder)
          setLocalWorkItems(nextItems)
          setTimelineMoveHint(null)
        })

        if (usesApiItems) {
          void patchWorkItem(resolved.draggedId, { parentId: resolved.newParentId }).catch(() => {
            localWorkItemsRef.current = previousItems
            siblingOrderRef.current = previousOrder
            startTransition(() => {
              setTimelineMoveHint('Failed to save move — reverted to previous order.')
              setLocalWorkItems(previousItems)
              setSiblingOrder(previousOrder)
              setTaskStructureRevision((value) => value + 1)
            })
          })
        }

        return true
      }

      startTransition(() => {
        setSiblingOrder(resolved.siblingOrder)
        setTimelineMoveHint(null)
      })
      return true
    },
    [usesApiItems],
  )

  const handleTaskScheduleCommit = useCallback(
    (event: PlanningGanttTaskScheduleUpdateEvent): boolean => {
      if (hasActiveSearchRef.current) {
        startTransition(() => {
          setTimelineMoveHint('Clear search before editing dates on the chart.')
          setTaskStructureRevision((value) => value + 1)
        })
        return false
      }

      const previousItems = localWorkItemsRef.current
      const resolved = resolveTimelineTaskScheduleUpdate(
        event.id,
        {
          start: new Date(`${event.startDate}T00:00:00`),
          end: new Date(`${event.endDate}T00:00:00`),
          progress: event.progress,
        },
        previousItems,
      )

      if (!resolved.valid || !resolved.update) {
        startTransition(() => {
          setTimelineMoveHint(resolved.message || 'This schedule change is not allowed.')
          setTaskStructureRevision((value) => value + 1)
        })
        return false
      }

      const workItem = previousItems.find((item) => item.id === resolved.update!.id)
      if (!workItem) return false

      const nextItems = previousItems.map((item) =>
        item.id === resolved.update!.id ? applyScheduleToWorkItem(item, resolved.update!) : item,
      )
      localWorkItemsRef.current = nextItems

      startTransition(() => {
        setLocalWorkItems(nextItems)
        setTimelineMoveHint(null)
      })

      if (usesApiItems) {
        void patchWorkItem(resolved.update.id, {
          startDate: resolved.update.startDate,
          dueDate: resolved.update.endDate,
          progress: resolved.update.progress,
        }).catch(() => {
          localWorkItemsRef.current = previousItems
          startTransition(() => {
            setLocalWorkItems(previousItems)
            setTimelineMoveHint('Failed to save schedule — reverted to previous dates.')
            setTaskStructureRevision((value) => value + 1)
          })
        })
      }

      return true
    },
    [usesApiItems],
  )

  const handleTaskGridEditCommit = useCallback(
    (event: PlanningGanttTaskGridEditEvent): boolean => {
      if (hasActiveSearchRef.current) {
        startTransition(() => {
          setTimelineMoveHint('Clear search before editing tasks inline.')
        })
        return false
      }

      const previousItems = localWorkItemsRef.current
      const resolved = resolveTimelineTaskInlineEdit(event, previousItems)
      if (!resolved.valid || !resolved.nextItem) {
        if (resolved.message) {
          startTransition(() => setTimelineMoveHint(resolved.message))
        }
        return false
      }
      if (!resolved.patchBody) return true

      const nextItems = previousItems.map((item) =>
        item.id === resolved.nextItem!.id ? resolved.nextItem! : item,
      )
      localWorkItemsRef.current = nextItems

      startTransition(() => {
        setLocalWorkItems(nextItems)
        setTimelineMoveHint(null)
      })

      if (usesApiItems) {
        void patchWorkItem(resolved.nextItem.id, resolved.patchBody).catch(() => {
          localWorkItemsRef.current = previousItems
          startTransition(() => {
            setLocalWorkItems(previousItems)
            setTimelineMoveHint('Failed to save inline edit — reverted.')
            setTaskStructureRevision((value) => value + 1)
          })
        })
      }

      return true
    },
    [usesApiItems],
  )

  const timelineGanttColumns = useMemo(
    () => TIMELINE_GANTT_GRID_COLUMNS as ComponentProps<typeof PlanningSvarGantt>['columns'],
    [],
  )

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

  const panel = (
    <div
      ref={panelRef}
      id="panel-timeline"
      style={
        isFullscreen
          ? { height: 'calc(var(--app-vh, 100dvh) - 3rem)', maxHeight: 'calc(var(--app-vh, 100dvh) - 3rem)' }
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
                <GanttChartSquare className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                <h2 className="text-lg font-semibold text-foreground">Project Timeline</h2>
              </div>
              <button
                type="button"
                aria-pressed={isFullscreen}
                aria-label={isFullscreen ? 'Exit timeline fullscreen' : 'Expand timeline to fullscreen'}
                title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen (header stays visible)'}
                onClick={() => setIsFullscreen((prev) => !prev)}
                className={cn(
                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/40 hover:text-foreground',
                  timelineToolbarFocusClass,
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

            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-xl text-[11px] leading-snug text-muted-foreground">
                Gantt of milestones and workstreams for this project. Edit title, start, or duration inline;
                drag bars for dates and rows to reorder or reparent (Epic → Feature → Task).
              </p>

              <div className="flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto px-1 py-1 text-xs text-muted-foreground scrollbar-hide lg:ml-auto">
                <div className="relative w-[168px] shrink-0">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    type="search"
                    value={search}
                    onChange={(event) => startTransition(() => setSearch(event.target.value))}
                    placeholder="Search tasks…"
                    aria-label="Search timeline tasks"
                    className={cn(
                      'h-8 w-full rounded-full border border-border bg-background/80 pl-8 pr-3 text-[11px] shadow-sm',
                      timelineToolbarFocusClass,
                    )}
                  />
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={timelineSelectMode}
                  onClick={() => setTimelineSelectMode((prev) => !prev)}
                  className={cn(
                    'group inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-background/80 px-2 py-1 shadow-sm transition hover:bg-muted/40',
                    timelineToolbarFocusClass,
                  )}
                  title="Enable multi-select on timeline rows"
                >
                  <span className="text-[11px] font-medium text-muted-foreground">Select</span>
                  <span
                    className={cn(
                      'relative h-5 w-9 rounded-full transition-colors',
                      timelineSelectMode ? 'bg-primary' : 'bg-muted',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-4 w-4 rounded-full bg-background shadow-sm transition-transform',
                        timelineSelectMode ? 'left-0.5 translate-x-4' : 'left-0.5 translate-x-0',
                      )}
                    />
                  </span>
                </button>
                <div
                  className="inline-flex shrink-0 items-center rounded-lg border border-border bg-background/80 p-0.5 shadow-sm"
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
                        onClick={() => setZoomLevel(level)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition',
                          timelineToolbarFocusClass,
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
                  Showing <span className="font-semibold text-foreground">{schedulableCount}</span> work items
                  {hasActiveSearch ? (
                    <>
                      {' '}
                      <span className="text-muted-foreground">·</span>{' '}
                      <span className="font-semibold text-foreground">&quot;{deferredSearch.trim()}&quot;</span>
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            {timelineMoveHint ? (
              <div className="mt-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                {timelineMoveHint}
              </div>
            ) : null}
            {timelineSelectMode && selectedIds.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200/80 bg-sky-50/80 px-3 py-2 text-[11px] text-slate-800 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100">
                <span>
                  <span className="font-semibold">
                    {selectedIds.length} work item{selectedIds.length !== 1 ? 's' : ''} selected
                  </span>
                  <span className="mx-1 text-muted-foreground">—</span>
                  <span className="text-muted-foreground">Click rows or bars to add or remove from selection.</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="rounded-md border border-border bg-background/80 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm transition hover:bg-muted/40"
                >
                  Clear
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl">
            {ganttItems.length === 0 ? (
              <div className="flex w-full flex-1 flex-col items-center justify-center px-6 py-12">
                <GanttChartSquare className="h-10 w-10 text-muted-foreground" aria-hidden />
                <p className="mt-4 text-sm font-semibold text-foreground">No schedule items</p>
                <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
                  Add dated work items to this project to populate the Gantt timeline.
                </p>
              </div>
            ) : filteredGanttItems.length === 0 ? (
              <div className="flex w-full flex-1 flex-col items-center justify-center px-6 py-12">
                <Search className="h-10 w-10 text-muted-foreground" aria-hidden />
                <p className="mt-4 text-sm font-semibold text-foreground">No matching tasks</p>
                <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
                  Try another keyword for task title, type, assignee, or label.
                </p>
              </div>
            ) : (
              <PlanningSvarGantt
                items={filteredGanttItems}
                layout="project-tree"
                columns={timelineGanttColumns}
                zoomLevel={zoomLevel}
                selectedId={selectedId}
                onSelect={setSelectedId}
                multiSelect={timelineSelectMode}
                selectedIds={selectedIds}
                onSelectedIdsChange={setSelectedIds}
                enableRowReorder={!hasActiveSearch}
                onTaskMoveCommit={handleTaskMoveCommit}
                enableChartEdit={!hasActiveSearch}
                onTaskScheduleCommit={handleTaskScheduleCommit}
                enableGridEdit={!hasActiveSearch}
                onTaskGridEditCommit={handleTaskGridEditCommit}
                taskStructureRevision={taskStructureRevision}
                timelineScaleResize={false}
                enableTimelineScrollExtension={false}
                timelineWindowOverride={timelineWindow}
                scrollToTaskWindowOnMount
                surface="solid"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )

  const addTaskDrawer = typeof document !== 'undefined'
    ? createPortal(
        <>
          <div
            className={cn(
              'fixed inset-0 z-[1050] bg-black/20 backdrop-blur-sm transition-opacity',
              addTaskOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
            )}
            onClick={() => !addTaskSaving && setAddTaskOpen(false)}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-task-drawer-title"
            className={cn(
              'fixed right-0 top-0 z-[1100] flex h-screen w-[460px] max-w-[92vw] flex-col',
              'border-l border-border bg-background/95 text-foreground shadow-2xl backdrop-blur-xl transition-transform duration-300',
              addTaskOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full',
            )}
            style={{ boxShadow: '0 0 60px rgba(0, 0, 0, 0.3), inset 1px 0 0 rgba(255, 255, 255, 0.1)' }}
          >
            <div className="flex shrink-0 items-start justify-between border-b border-border px-5 py-4">
              <div className="pr-3">
                <h2 id="add-task-drawer-title" className="flex items-center gap-2 text-xl font-semibold">
                  <Plus className="h-5 w-5 text-primary" aria-hidden />
                  Add Work Item
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create execution work items for tasks, subtasks, epics, and checklist entries across projects and workspaces.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setAddTaskOpen(false)}
                disabled={addTaskSaving}
                aria-label="Close add task drawer"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                void handleCreateTask()
              }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 scrollbar-hide">
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground">Type <span className="text-red-500">*</span></span>
            <div className="relative">
              <CheckSquare2 className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-primary" aria-hidden />
              <select className="h-10 w-full appearance-none rounded-md border border-input bg-background px-9 pr-10 text-sm" value={addTaskDraft.type} disabled={addTaskSaving} onChange={(event) => setAddTaskDraft((previous) => ({ ...previous, type: event.target.value as WorkItemType }))}>
                {ADD_TASK_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            </div>
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground">Title <span className="text-red-500">*</span></span>
            <Input autoFocus value={addTaskDraft.title} disabled={addTaskSaving} placeholder="Short and descriptive" onChange={(event) => setAddTaskDraft((previous) => ({ ...previous, title: event.target.value }))} className="h-10 text-sm" />
          </label>
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-[11px] font-semibold text-muted-foreground">Description</span>
            <EnterpriseRichTextEditor
              id="project-add-task-description"
              value={addTaskDraft.description}
              onChange={(description) => setAddTaskDraft((previous) => ({ ...previous, description }))}
              placeholder="Execution context, acceptance notes, or delivery scope"
              maxPlainTextLength={2000}
              disabled={addTaskSaving}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2 md:col-span-2">
            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground">
                Project <span className="font-normal text-muted-foreground/60">(optional)</span>
              </span>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={project.name} disabled aria-label="Project">
                <option value={project.name}>{project.name}</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground">
                Workspace <span className="text-red-500">*</span>
              </span>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={TECTONA_PROJECT_WORKSPACE} disabled aria-label="Workspace">
                <option value={TECTONA_PROJECT_WORKSPACE}>{TECTONA_PROJECT_WORKSPACE}</option>
              </select>
            </label>
          </div>
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground">
              Parent <span className="font-normal text-muted-foreground/60">(optional)</span>
            </span>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={addTaskDraft.parentId} disabled={addTaskSaving} onChange={(event) => setAddTaskDraft((previous) => ({ ...previous, parentId: event.target.value }))}>
              <option value="">No parent (root level)</option>
              {localWorkItems.filter((item) => item.type !== 'Checklist').map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <p className="text-[11px] text-muted-foreground">Allowed parents: Epic, Feature.</p>
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground">Assignee</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-muted text-[11px] text-muted-foreground">?</span>
              <select className="h-10 w-full appearance-none rounded-md border border-input bg-background pl-11 pr-10 text-sm" value={addTaskDraft.assignee} disabled={addTaskSaving} onChange={(event) => setAddTaskDraft((previous) => ({ ...previous, assignee: event.target.value }))}>
                <option value="Unassigned">Unassigned</option>
                {ownerName && ownerName !== 'Unassigned' ? <option value={ownerName}>{ownerName}</option> : null}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            </div>
          </label>
          <div className="grid gap-3 sm:grid-cols-2 md:col-span-2">
            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground">Start date</span>
              <Input type="date" value={addTaskDraft.startDate} disabled={addTaskSaving} onChange={(event) => setAddTaskDraft((previous) => ({ ...previous, startDate: event.target.value, dueDate: previous.dueDate < event.target.value ? event.target.value : previous.dueDate }))} className="h-10 text-sm" />
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground">Due date</span>
              <Input type="date" value={addTaskDraft.dueDate} min={addTaskDraft.startDate} disabled={addTaskSaving} onChange={(event) => setAddTaskDraft((previous) => ({ ...previous, dueDate: event.target.value }))} className="h-10 text-sm" />
            </label>
          </div>
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground">Status</span>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={addTaskDraft.status} disabled={addTaskSaving} onChange={(event) => setAddTaskDraft((previous) => ({ ...previous, status: event.target.value as WorkStatus }))}>
              {ADD_TASK_STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground">Priority</span>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={addTaskDraft.priority} disabled={addTaskSaving} onChange={(event) => setAddTaskDraft((previous) => ({ ...previous, priority: event.target.value as Priority }))}>
              {ADD_TASK_PRIORITIES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
              </div>
              <div className="flex shrink-0 gap-3 border-t border-border bg-background/95 px-5 py-4 backdrop-blur-sm">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
                  disabled={addTaskSaving}
                  onClick={() => void handleCreateTask()}
                >
                  <ListChecks className="h-4 w-4 shrink-0" aria-hidden />
                  Save &amp; open detail
                </Button>
                <Button
                  type="submit"
                  className={cn(registerServicePrimaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
                  disabled={addTaskSaving || !addTaskDraft.title.trim()}
                >
                  <Save className="h-4 w-4 shrink-0" aria-hidden />
                  {addTaskSaving ? 'Saving...' : 'Save work item'}
                </Button>
              </div>
            </form>
          </aside>
        </>,
        document.body,
      )
    : null

  if (isFullscreen && typeof document !== 'undefined') {
    return (
      <>
        <div className="min-h-[50vh]" aria-hidden />
        {createPortal(panel, document.body)}
        {addTaskDrawer}
      </>
    )
  }

  return (
    <>
      {panel}
      {addTaskDrawer}
    </>
  )
}
