import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, startTransition, type ComponentProps } from 'react'
import { createPortal } from 'react-dom'
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  GanttChartSquare,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Search,
  type LucideIcon,
} from 'lucide-react'
import type { WorkItemApiModel } from '@/lib/api/workApi'
import { patchWorkItem } from '@/lib/api/workApi'
import { Input } from '@/components/ui/input'
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

export function ProjectTimelinePanel({
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
          ? { height: 'calc(100dvh - 3rem)', maxHeight: 'calc(100dvh - 3rem)' }
          : panelHeightPx != null
            ? { height: panelHeightPx, maxHeight: panelHeightPx, minHeight: PROJECT_PANEL_MIN_HEIGHT_PX }
            : undefined
      }
      className={cn(
        'scroll-mt-24',
        'glass-card flex min-h-0 flex-col overflow-hidden border border-border/40',
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
                surface="transparent"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )

  if (isFullscreen && typeof document !== 'undefined') {
    return (
      <>
        <div className="min-h-[50vh]" aria-hidden />
        {createPortal(panel, document.body)}
      </>
    )
  }

  return panel
}
