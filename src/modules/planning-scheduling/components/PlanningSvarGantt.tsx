import { useCallback, useEffect, useMemo, useRef, useState, startTransition, type CSSProperties, type RefObject } from 'react'
import { Gantt, Willow, type IApi, type ILink, type IScaleConfig, type ITask, type TID } from '@svar-ui/react-gantt'
import '@svar-ui/react-gantt/all.css'
import { cn } from '@/lib/utils'
import { buildGanttSelectionColumnWithRefs, isSyntheticGanttSummaryId } from '@/modules/task-work-management/components/DirectoryGanttGridCells'
import { syncVariableTimelineLayout } from '../lib/planningTimelineColumnLayout'
import {
  findGanttChart,
  shouldPublishTimelinePaging,
  TIMELINE_SCROLL_EDGE_THRESHOLD_PX,
  useTimelineScrollExtension,
  type TimelinePagingViewportState,
} from '../lib/planningGanttTimelineScroll'
import {
  PLANNING_TODAY_HIGHLIGHT_STYLES,
  scalesForZoomWithTodayHighlight,
  syncTodayColumnHighlight,
  todayMarkerForZoom,
} from '../lib/planningTodayHighlight'


export type PlanningGanttZoomLevel = 'Day' | 'Week' | 'Month' | 'Quarter'

export type PlanningGanttItem = {
  id: string
  title: string
  workspace: string
  project: string
  team: string
  owner: string
  sprint: string
  type: 'Phase' | 'Milestone' | 'Workstream'
  startDate: string
  endDate: string
  progress: number
  predecessorId?: string
  /** Parent work item id for tree layout (Task Directory). */
  parentId?: string | null
  /** monday | jira | tectona — directory Gantt source indicator. */
  itemSource?: 'monday' | 'jira' | 'tectona'
  /** Original work item type (Epic, Task, …) for directory Gantt icons. */
  workItemType?: string
  /** Label name for directory Gantt icons. */
  label?: string
  /** Original list order for stable tree sibling sorting. */
  listOrder?: number
}

function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
}

/** Reads a `data-row-id`/`data-col-id` attribute set by @svar-ui/react-grid's Cell, undoing
 * its `setID` string-id prefix (`:` for strings) — mirrors @svar-ui/lib-dom's `locateID`. */
function locateGanttCellAttr(target: EventTarget | null, attr: string): string | null {
  let node = target as HTMLElement | null
  while (node) {
    const value = node.getAttribute?.(attr)
    if (value) return value.startsWith(':') ? value.slice(1) : value
    node = node.parentElement
  }
  return null
}

function durationDays(start: Date, end: Date, isMilestone: boolean): number {
  if (isMilestone) return 0
  const span = Math.round((end.getTime() - start.getTime()) / 86_400_000)
  return Math.max(1, span)
}

function computeGanttWindow(items: PlanningGanttItem[]): { start: Date; end: Date } {
  if (items.length === 0) {
    const now = new Date()
    return {
      start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 0)),
    }
  }

  let minMs = Number.POSITIVE_INFINITY
  let maxMs = Number.NEGATIVE_INFINITY
  for (const item of items) {
    const start = parseIsoDate(item.startDate).getTime()
    const end = parseIsoDate(item.endDate).getTime()
    minMs = Math.min(minMs, start, end)
    maxMs = Math.max(maxMs, start, end)
  }

  const padMs = 7 * 86_400_000
  return {
    start: new Date(minMs - padMs),
    end: new Date(maxMs + padMs),
  }
}

function scaleHeightForZoom(zoom: PlanningGanttZoomLevel): number {
  switch (zoom) {
    case 'Day':
    case 'Week':
    case 'Month':
    case 'Quarter':
      return 56
    default:
      return 36
  }
}

function cellWidthForZoom(zoom: PlanningGanttZoomLevel): number {
  switch (zoom) {
    case 'Day':
      return 36
    case 'Week':
      return 88
    case 'Quarter':
      return 120
    case 'Month':
      return 100
    default:
      return 44
  }
}

function cellWidthBoundsForZoom(zoom: PlanningGanttZoomLevel): { min: number; max: number } {
  switch (zoom) {
    case 'Day':
      return { min: 20, max: 72 }
    case 'Week':
      return { min: 48, max: 180 }
    case 'Month':
      return { min: 64, max: 220 }
    case 'Quarter':
      return { min: 40, max: 140 }
    default:
      return { min: 24, max: 200 }
  }
}

function initialColumnOverridesByZoom(): Record<PlanningGanttZoomLevel, Record<number, number>> {
  return { Day: {}, Week: {}, Month: {}, Quarter: {} }
}

const SCALE_COL_RESIZE_HIT_ZONE_PX = 6

/** Drag a single bottom scale column border — only that column width changes. */
function useTimelineScaleColumnResize(
  hostRef: RefObject<HTMLDivElement | null>,
  zoomLevel: PlanningGanttZoomLevel,
  baseCellWidth: number,
  columnOverrides: Record<number, number>,
  onColumnWidthChange: (columnIndex: number, width: number) => void,
  enabled: boolean,
) {
  const baseCellWidthRef = useRef(baseCellWidth)
  const columnOverridesRef = useRef(columnOverrides)
  const onColumnWidthChangeRef = useRef(onColumnWidthChange)
  const boundsRef = useRef(cellWidthBoundsForZoom(zoomLevel))

  useEffect(() => {
    baseCellWidthRef.current = baseCellWidth
  }, [baseCellWidth])

  useEffect(() => {
    columnOverridesRef.current = columnOverrides
  }, [columnOverrides])

  useEffect(() => {
    onColumnWidthChangeRef.current = onColumnWidthChange
  }, [onColumnWidthChange])

  useEffect(() => {
    boundsRef.current = cellWidthBoundsForZoom(zoomLevel)
  }, [zoomLevel])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !enabled) return

    let cancelled = false
    let unbindScale: (() => void) | null = null
    let dragStartX = 0
    let dragStartWidth = 0
    let dragColumnIndex = -1
    let isDragging = false
    let rafId = 0
    let pending: { index: number; width: number } | null = null

    const clampWidth = (value: number) => {
      const { min, max } = boundsRef.current
      return Math.round(Math.min(max, Math.max(min, value)))
    }

    const flushPendingWidth = () => {
      rafId = 0
      if (!pending) return
      onColumnWidthChangeRef.current(pending.index, pending.width)
      pending = null
    }

    const queueWidth = (index: number, width: number) => {
      pending = { index, width }
      if (!rafId) rafId = requestAnimationFrame(flushPendingWidth)
    }

    const findBottomScaleCell = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof HTMLElement)) return null
      return target.closest('.wx-scale .wx-row:last-child .wx-cell')
    }

    const columnIndexOf = (cell: HTMLElement): number => {
      const rowCells = cell.parentElement?.querySelectorAll('.wx-cell')
      if (!rowCells) return -1
      return Array.from(rowCells).indexOf(cell)
    }

    const isNearCellRightEdge = (cell: HTMLElement, clientX: number): boolean => {
      const rowCells = cell.parentElement?.querySelectorAll('.wx-cell')
      if (!rowCells || cell === rowCells[rowCells.length - 1]) return false
      const rect = cell.getBoundingClientRect()
      return (
        clientX >= rect.right - SCALE_COL_RESIZE_HIT_ZONE_PX &&
        clientX <= rect.right + SCALE_COL_RESIZE_HIT_ZONE_PX
      )
    }

    const stopDrag = () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
      if (pending) {
        onColumnWidthChangeRef.current(pending.index, pending.width)
        pending = null
      }
      isDragging = false
      dragColumnIndex = -1
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      host.style.cursor = ''
      window.removeEventListener('mousemove', onWindowMouseMove)
      window.removeEventListener('mouseup', stopDrag)
    }

    const onWindowMouseMove = (event: MouseEvent) => {
      if (!isDragging || dragColumnIndex < 0) return
      queueWidth(
        dragColumnIndex,
        clampWidth(dragStartWidth + (event.clientX - dragStartX)),
      )
    }

    const onScaleMouseDown = (event: MouseEvent) => {
      const cell = findBottomScaleCell(event.target)
      if (!cell || !isNearCellRightEdge(cell, event.clientX)) return

      const columnIndex = columnIndexOf(cell)
      if (columnIndex < 0) return

      event.preventDefault()
      event.stopPropagation()
      isDragging = true
      dragColumnIndex = columnIndex
      dragStartX = event.clientX
      dragStartWidth =
        columnOverridesRef.current[columnIndex] ?? baseCellWidthRef.current
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('mousemove', onWindowMouseMove)
      window.addEventListener('mouseup', stopDrag)
    }

    const onScaleMouseMove = (event: MouseEvent) => {
      if (isDragging) return
      const cell = findBottomScaleCell(event.target)
      host.style.cursor = cell && isNearCellRightEdge(cell, event.clientX) ? 'col-resize' : ''
    }

    const onScaleMouseLeave = () => {
      if (!isDragging) host.style.cursor = ''
    }

    const bindScale = (): boolean => {
      const scale = host.querySelector('.wx-scale')
      if (!scale) return false

      scale.addEventListener('mousedown', onScaleMouseDown)
      scale.addEventListener('mousemove', onScaleMouseMove)
      scale.addEventListener('mouseleave', onScaleMouseLeave)
      unbindScale = () => {
        scale.removeEventListener('mousedown', onScaleMouseDown)
        scale.removeEventListener('mousemove', onScaleMouseMove)
        scale.removeEventListener('mouseleave', onScaleMouseLeave)
      }
      return true
    }

    let bindAttempts = 0
    const tryBindScale = () => {
      if (cancelled) return
      if (bindScale()) return
      bindAttempts += 1
      if (bindAttempts < 30) requestAnimationFrame(tryBindScale)
    }

    tryBindScale()

    return () => {
      cancelled = true
      if (rafId) cancelAnimationFrame(rafId)
      unbindScale?.()
      stopDrag()
    }
  }, [enabled, hostRef, zoomLevel])
}

function scalesForZoom(zoom: PlanningGanttZoomLevel): IScaleConfig[] {
  return scalesForZoomWithTodayHighlight(zoom)
}

const WORKSPACE_SUMMARY_PREFIX = 'ws:'
const PROJECT_SUMMARY_PREFIX = 'proj:'

function isGanttSummaryId(id: string): boolean {
  return isSyntheticGanttSummaryId(id)
}

export function normalizeGanttProjectName(project?: string): string {
  const trimmed = project?.trim()
  return trimmed || 'Unidentified'
}

function sortGanttProjectNames(left: string, right: string): number {
  if (left === 'Unidentified') return 1
  if (right === 'Unidentified') return -1
  return left.localeCompare(right)
}

function pushSummaryTask(
  tasks: ITask[],
  id: string,
  text: string,
  children: PlanningGanttItem[],
  parent?: string,
) {
  const starts = children.map((child) => parseIsoDate(child.startDate))
  const ends = children.map((child) => parseIsoDate(child.endDate))
  const minStart = new Date(Math.min(...starts.map((d) => d.getTime())))
  const maxEnd = new Date(Math.max(...ends.map((d) => d.getTime())))

  tasks.push({
    id,
    text,
    parent,
    type: 'summary',
    start: minStart,
    end: maxEnd,
    duration: durationDays(minStart, maxEnd, false),
    progress: Math.round(children.reduce((sum, child) => sum + child.progress, 0) / children.length),
    open: true,
  })
}

/** Workspace → project → schedule item (not flat project/task tree). */
function buildSvarGanttModel(items: PlanningGanttItem[], workspaceOrder: string[] = []) {
  const tasks: ITask[] = []
  const links: ILink[] = []
  let linkSeq = 1

  const byWorkspace = new Map<string, Map<string, PlanningGanttItem[]>>()
  for (const item of items) {
    const projectsInWorkspace = byWorkspace.get(item.workspace) ?? new Map<string, PlanningGanttItem[]>()
    const list = projectsInWorkspace.get(item.project) ?? []
    list.push(item)
    projectsInWorkspace.set(item.project, list)
    byWorkspace.set(item.workspace, projectsInWorkspace)
  }

  const orderedWorkspaces: string[] = []
  const seen = new Set<string>()
  for (const ws of workspaceOrder) {
    if (seen.has(ws)) continue
    seen.add(ws)
    orderedWorkspaces.push(ws)
  }
  for (const ws of [...byWorkspace.keys()].sort((a, b) => a.localeCompare(b))) {
    if (seen.has(ws)) continue
    seen.add(ws)
    orderedWorkspaces.push(ws)
  }

  for (const workspace of orderedWorkspaces) {
    const workspaceId = `${WORKSPACE_SUMMARY_PREFIX}${workspace}`
    const projectsMap = byWorkspace.get(workspace)

    if (!projectsMap || projectsMap.size === 0) continue

    const allInWorkspace = [...projectsMap.values()].flat()
    pushSummaryTask(tasks, workspaceId, workspace, allInWorkspace)

    for (const [project, children] of projectsMap) {
      const projectId = `${PROJECT_SUMMARY_PREFIX}${workspace}::${project}`
      pushSummaryTask(tasks, projectId, project, children, workspaceId)

      for (const item of children) {
        const isMilestone = item.type === 'Milestone'
        const start = parseIsoDate(item.startDate)
        const end = parseIsoDate(item.endDate)

        tasks.push({
          id: item.id,
          text: item.title,
          parent: projectId,
          type: isMilestone ? 'milestone' : 'task',
          start,
          end: isMilestone ? start : end,
          duration: durationDays(start, end, isMilestone),
          progress: item.progress,
          details: `${item.project} · ${item.owner} · ${item.team} · ${item.sprint}`,
          ...directoryGanttFields(item),
        })

        if (item.predecessorId) {
          links.push({
            id: linkSeq++,
            source: item.predecessorId,
            target: item.id,
            type: 'e2e',
          })
        }
      }
    }
  }

  return { tasks, links }
}

function directoryGanttFields(item: PlanningGanttItem) {
  return {
    ganttLabel: item.label?.trim() || item.sprint?.trim() || '',
    ganttWorkItemType: item.workItemType?.trim() || '',
    ganttSource: item.itemSource ?? 'tectona',
  }
}

/** One Gantt row per work item — no workspace/project summary grouping. */
function buildFlatGanttModel(items: PlanningGanttItem[]) {
  const tasks: ITask[] = []

  for (const item of items) {
    const isMilestone = item.type === 'Milestone'
    const start = parseIsoDate(item.startDate)
    const end = parseIsoDate(item.endDate)

    tasks.push({
      id: item.id,
      text: item.title,
      type: isMilestone ? 'milestone' : 'task',
      start,
      end: isMilestone ? start : end,
      duration: durationDays(start, end, isMilestone),
      progress: item.progress,
      details: `${item.id} · ${item.workspace} · ${item.project}`,
      ...directoryGanttFields(item),
    })
  }

  return { tasks, links: [] as ILink[] }
}

type TreeScheduleRange = { start: Date; end: Date; isMilestone: boolean }

function hasOwnSchedule(item: PlanningGanttItem): boolean {
  return Boolean(item.endDate?.trim() || item.startDate?.trim())
}

function resolveTreeItemSchedule(item: PlanningGanttItem, childRanges: TreeScheduleRange[]): TreeScheduleRange {
  if (childRanges.length > 0) {
    const minStart = Math.min(...childRanges.map((range) => range.start.getTime()))
    const maxEnd = Math.max(...childRanges.map((range) => range.end.getTime()))
    return { start: new Date(minStart), end: new Date(maxEnd), isMilestone: false }
  }

  if (hasOwnSchedule(item)) {
    const end = parseIsoDate(item.endDate || item.startDate)
    const start = item.startDate?.trim() ? parseIsoDate(item.startDate) : end
    const rangeStart = start.getTime() <= end.getTime() ? start : end
    const rangeEnd = start.getTime() <= end.getTime() ? end : start
    const isMilestone =
      item.type === 'Milestone' || rangeStart.getTime() === rangeEnd.getTime()
    return { start: rangeStart, end: rangeEnd, isMilestone }
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return { start: today, end: today, isMilestone: true }
}

function computeGanttWindowFromTasks(tasks: ITask[]): { start: Date; end: Date } {
  if (tasks.length === 0) {
    const now = new Date()
    return {
      start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 0)),
    }
  }

  let minMs = Number.POSITIVE_INFINITY
  let maxMs = Number.NEGATIVE_INFINITY
  for (const task of tasks) {
    const start = task.start instanceof Date ? task.start.getTime() : parseIsoDate(String(task.start)).getTime()
    const end = task.end instanceof Date ? task.end.getTime() : parseIsoDate(String(task.end)).getTime()
    minMs = Math.min(minMs, start, end)
    maxMs = Math.max(maxMs, start, end)
  }

  const padMs = 7 * 86_400_000
  return {
    start: new Date(minMs - padMs),
    end: new Date(maxMs + padMs),
  }
}

/** Extra timeline room per zoom so the chart can scroll past the last task (SVAR autoScale only pads ~1 unit). */
function padGanttWindowForZoom(
  window: { start: Date; end: Date },
  zoom: PlanningGanttZoomLevel,
  extraPadding = false,
): { start: Date; end: Date } {
  const start = new Date(window.start)
  const end = new Date(window.end)

  switch (zoom) {
    case 'Day':
      start.setUTCDate(start.getUTCDate() - (extraPadding ? 28 : 7))
      end.setUTCDate(end.getUTCDate() + (extraPadding ? 56 : 14))
      break
    case 'Week':
      start.setUTCDate(start.getUTCDate() - (extraPadding ? 84 : 14))
      end.setUTCDate(end.getUTCDate() + (extraPadding ? 126 : 28))
      break
    case 'Month': {
      start.setUTCDate(1)
      start.setUTCMonth(start.getUTCMonth() - (extraPadding ? 4 : 2))
      const endYear = end.getUTCFullYear()
      const endMonth = end.getUTCMonth()
      return {
        start,
        end: new Date(Date.UTC(endYear, endMonth + (extraPadding ? 10 : 7), 0)),
      }
    }
    case 'Quarter': {
      start.setUTCDate(1)
      start.setUTCMonth(start.getUTCMonth() - (extraPadding ? 6 : 3))
      const endYear = end.getUTCFullYear()
      const endMonth = end.getUTCMonth()
      return {
        start,
        end: new Date(Date.UTC(endYear, endMonth + (extraPadding ? 18 : 12), 0)),
      }
    }
    default:
      break
  }

  return { start, end }
}

/** Paged timeline: small past buffer + at least `initialSpanMonths` forward from start. */
function padGanttWindowPaged(
  window: { start: Date; end: Date },
  initialSpanMonths: number,
): { start: Date; end: Date } {
  const start = new Date(window.start)
  start.setUTCDate(start.getUTCDate() - 14)

  const minEndBySpan = new Date(start)
  minEndBySpan.setUTCMonth(minEndBySpan.getUTCMonth() + initialSpanMonths)

  const taskEnd = new Date(window.end)
  taskEnd.setUTCDate(taskEnd.getUTCDate() + 14)

  return {
    start,
    end: taskEnd.getTime() > minEndBySpan.getTime() ? taskEnd : minEndBySpan,
  }
}

/** Parent-child tree — one row per work item, nested like List view. */
function appendWorkItemTreeTasks(
  items: PlanningGanttItem[],
  rootParentId: string | undefined,
  tasks: ITask[],
  links: ILink[],
  linkSeq: { value: number },
) {
  const itemIds = new Set(items.map((entry) => entry.id))
  const childrenByParent = new Map<string, PlanningGanttItem[]>()
  const roots: PlanningGanttItem[] = []
  const itemOrder = new Map(items.map((entry, index) => [entry.id, entry.listOrder ?? index]))
  const scheduleById = new Map<string, TreeScheduleRange>()

  for (const item of items) {
    const parentId = item.parentId && itemIds.has(item.parentId) ? item.parentId : null
    if (parentId) {
      const siblings = childrenByParent.get(parentId) ?? []
      siblings.push(item)
      childrenByParent.set(parentId, siblings)
    } else {
      roots.push(item)
    }
  }

  const sortByListOrder = (left: PlanningGanttItem, right: PlanningGanttItem) =>
    (itemOrder.get(left.id) ?? 0) - (itemOrder.get(right.id) ?? 0)

  const resolveSchedule = (item: PlanningGanttItem): TreeScheduleRange => {
    const cached = scheduleById.get(item.id)
    if (cached) return cached

    const childItems = childrenByParent.get(item.id) ?? []
    const childRanges = childItems.map((child) => resolveSchedule(child))
    const schedule = resolveTreeItemSchedule(item, childRanges)
    scheduleById.set(item.id, schedule)
    return schedule
  }

  const walk = (list: PlanningGanttItem[], parent?: string) => {
    for (const item of [...list].sort(sortByListOrder)) {
      const childItems = childrenByParent.get(item.id) ?? []
      const hasChildren = childItems.length > 0
      const schedule = resolveSchedule(item)

      if (hasChildren) {
        // Use type "task" (not "summary") so SVAR does not run resetSummaryDates on
        // every drag frame — that cascade freezes the tab on nested Epic/Feature trees.
        tasks.push({
          id: item.id,
          text: item.title,
          parent,
          type: 'task',
          start: schedule.start,
          end: schedule.end,
          duration: durationDays(schedule.start, schedule.end, false),
          progress: item.progress,
          open: true,
          details: `${item.workspace} · ${item.project}`,
          ...directoryGanttFields(item),
          ganttIsParent: true,
        })
        walk(childItems, item.id)
        continue
      }

      tasks.push({
        id: item.id,
        text: item.title,
        parent,
        type: schedule.isMilestone ? 'milestone' : 'task',
        start: schedule.start,
        end: schedule.isMilestone ? schedule.start : schedule.end,
        duration: durationDays(schedule.start, schedule.end, schedule.isMilestone),
        progress: item.progress,
        details: `${item.workspace} · ${item.project}`,
        ...directoryGanttFields(item),
      })

      if (item.predecessorId && itemIds.has(item.predecessorId)) {
        links.push({
          id: linkSeq.value++,
          source: item.predecessorId,
          target: item.id,
          type: 'e2e',
        })
      }
    }
  }

  walk(roots, rootParentId)
}

function taskDateValue(value: Date | string | undefined): Date {
  if (value instanceof Date) return value
  if (typeof value === 'string' && value.trim()) return parseIsoDate(value)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return today
}

function insertProjectSummaryTask(
  tasks: ITask[],
  projectId: string,
  projectName: string,
  fromIndex: number,
) {
  const projectChildren = tasks.slice(fromIndex).filter((task) => task.parent === projectId)
  if (projectChildren.length === 0) return

  const starts = projectChildren.map((task) => taskDateValue(task.start))
  const ends = projectChildren.map((task) => taskDateValue(task.end))
  const minStart = new Date(Math.min(...starts.map((date) => date.getTime())))
  const maxEnd = new Date(Math.max(...ends.map((date) => date.getTime())))
  const avgProgress = Math.round(
    projectChildren.reduce((sum, task) => sum + (task.progress ?? 0), 0) / projectChildren.length,
  )

  tasks.splice(fromIndex, 0, {
    id: projectId,
    text: projectName,
    type: 'summary',
    start: minStart,
    end: maxEnd,
    duration: durationDays(minStart, maxEnd, false),
    progress: avgProgress,
    open: true,
  })
}

/** Project → work item tree (directory Gantt). Empty project → Unidentified. */
function buildProjectTreeGanttModel(items: PlanningGanttItem[]) {
  const tasks: ITask[] = []
  const links: ILink[] = []
  const linkSeq = { value: 1 }

  const byProject = new Map<string, PlanningGanttItem[]>()
  for (const item of items) {
    const projectName = normalizeGanttProjectName(item.project)
    const bucket = byProject.get(projectName) ?? []
    bucket.push(item)
    byProject.set(projectName, bucket)
  }

  for (const projectName of [...byProject.keys()].sort(sortGanttProjectNames)) {
    const projectItems = byProject.get(projectName)!
    const projectId = `${PROJECT_SUMMARY_PREFIX}${projectName}`
    const startIndex = tasks.length

    appendWorkItemTreeTasks(projectItems, projectId, tasks, links, linkSeq)
    insertProjectSummaryTask(tasks, projectId, projectName, startIndex)
  }

  return { tasks, links }
}

function buildTreeGanttModel(items: PlanningGanttItem[]) {
  const tasks: ITask[] = []
  const links: ILink[] = []
  const linkSeq = { value: 1 }
  appendWorkItemTreeTasks(items, undefined, tasks, links, linkSeq)
  return { tasks, links }
}

const GANTT_ROW_HEIGHT = 34

const GANTT_COMPACT_FONT =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

const GANTT_COMPACT_STYLES = `
  .planning-svar-gantt-host,
  .planning-svar-gantt-host .wx-willow-theme {
    /* Pastel enterprise palette — soft mint summaries, baby-blue tasks, lavender milestones. */
    --wx-gantt-bar-border-radius: 6px;
    --wx-gantt-task-color: #c8dcfa;
    --wx-gantt-task-font-color: #475569;
    --wx-gantt-task-fill-color: #a8c8f5;
    --wx-gantt-task-border-color: #b8cff0;
    --wx-gantt-task-border: 1px solid #b8cff0;
    --wx-gantt-summary-color: #b8ead8;
    --wx-gantt-summary-font-color: #475569;
    --wx-gantt-summary-fill-color: #8fdcc4;
    --wx-gantt-summary-border-color: #9fd9c8;
    --wx-gantt-summary-border: 1px solid #9fd9c8;
    --wx-gantt-milestone-color: #e2cff7;
    --wx-gantt-select-color: rgba(238, 244, 255, 0.92);
    --wx-gantt-link-color: #c8d3e0;
    --wx-gantt-link-color-hovered: #94a3b8;
    --wx-gantt-link-marker-background: #f1f5f9;
    --wx-gantt-link-marker-color: #b8c4d4;
    --wx-gantt-bar-shadow: 0 1px 2px rgba(100, 116, 139, 0.08), 0 2px 6px rgba(100, 116, 139, 0.06);
    --wx-gantt-holiday-background: #fafbfd;
    --wx-gantt-holiday-color: #cbd5e1;
    --wx-gantt-marker-color: rgba(252, 165, 165, 0.72);
    --wx-gantt-marker-font-color: #7f1d1d;
    --wx-gantt-progress-border-color: #e2e8f0;
    --wx-gantt-task-slack-color: #f8fafc;
    --wx-gantt-task-slack-border-color: #dbeafe;
  }

  .planning-svar-gantt-host {
    --wx-scrollbar-width: 0px;
    --wx-font-size: 12px;
    --wx-font-size-sm: 12px;
    --wx-icon-size: 14px;
    --wx-input-font-size: 12px;
    --wx-input-line-height: 1.25;
    --wx-grid-header-font: 600 10px/1.2 ${GANTT_COMPACT_FONT};
    --wx-grid-header-text-transform: uppercase;
    --wx-grid-header-font-color: #64748b;
    --wx-grid-body-font: 400 12px/1.25 ${GANTT_COMPACT_FONT};
    --wx-grid-body-font-color: #334155;
    --wx-timescale-font: 600 10px/1.2 ${GANTT_COMPACT_FONT};
    --wx-timescale-font-color: #64748b;
    --wx-gantt-bar-font: 500 10px/1.2 ${GANTT_COMPACT_FONT};
    --wx-gantt-marker-font: 600 9px/1.2 ${GANTT_COMPACT_FONT};
    --wx-gantt-border: 1px solid #e2e8f0;
    --wx-grid-body-row-border: none;
    --wx-grid-body-cell-border: none;
    --wx-timescale-border: 1px solid #94a3b8;
    --wx-timescale-shadow: none;
    --wx-table-cell-border: none;
    --wx-table-header-border: none;
    --wx-table-header-cell-border: 1px solid #94a3b8;
    --wx-table-border: none;
    --planning-gantt-row-height: ${GANTT_ROW_HEIGHT}px;
    --planning-gantt-row-border-color: #e2e8f0;
    height: 100%;
    min-height: 0;
  }

  .planning-svar-gantt-host .planning-svar-gantt-inner,
  .planning-svar-gantt-host .wx-willow-theme {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  }

  .planning-svar-gantt-host .wx-gantt,
  .planning-svar-gantt-host .wx-stuck,
  .planning-svar-gantt-host .wx-layout {
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
    max-height: 100%;
  }

  .planning-svar-gantt-host .wx-layout > .wx-content,
  .planning-svar-gantt-host .wx-table-container {
    min-height: 0;
    height: 100%;
  }

  /* Left task grid — one size for every column (text, start, duration). */
  .planning-svar-gantt-host .wx-table-container .wx-grid .wx-header .wx-cell {
    font: 600 10px/1.2 ${GANTT_COMPACT_FONT} !important;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #64748b !important;
  }

  .planning-svar-gantt-host .wx-table-container .wx-grid .wx-header .wx-cell .wx-text {
    font: inherit !important;
    font-size: 10px !important;
    line-height: 1.2 !important;
  }

  .planning-svar-gantt-host .wx-table-container .wx-grid .wx-body .wx-cell {
    font: 400 12px/1.25 ${GANTT_COMPACT_FONT} !important;
    color: #334155 !important;
  }

  /* Task title must clip — never bleed into Start/Duration. */
  .planning-svar-gantt-host .wx-grid .wx-body .wx-cell[data-col-id="text"],
  .planning-svar-gantt-host .wx-grid .wx-body .wx-cell[data-col-id="text"] .wx-content,
  .planning-svar-gantt-host .wx-grid .wx-body .wx-cell[data-col-id="text"] .wx-text {
    overflow: hidden !important;
    max-width: 100% !important;
  }

  .planning-svar-gantt-host .wx-table-container .wx-grid .wx-body .wx-cell .wx-text,
  .planning-svar-gantt-host .wx-table-container .wx-grid .wx-body .wx-cell .wx-value,
  .planning-svar-gantt-host .wx-table-container .wx-grid .wx-body .wx-cell .wx-content,
  .planning-svar-gantt-host .wx-table-container .wx-grid .wx-body .wx-cell .wx-name,
  .planning-svar-gantt-host .wx-table-container .wx-grid .wx-body .wx-cell input {
    font: inherit !important;
    font-size: 12px !important;
    line-height: 1.25 !important;
    color: inherit !important;
  }

  .planning-svar-gantt-host .wx-table-container .wx-grid .wx-body .wx-cell .wx-value {
    padding: 0 5px !important;
  }

  .planning-svar-gantt-host .wx-table-container .wx-grid .wx-body .wx-cell:has(input, .wx-value) {
    padding: 0 !important;
  }

  .planning-svar-gantt-host .wx-table-container .wx-grid .wx-body .wx-cell input {
    padding: 0 5px !important;
    height: 100% !important;
  }

  /* Timeline header stays slightly smaller than grid body. */
  .planning-svar-gantt-host .wx-scale .wx-cell-value,
  .planning-svar-gantt-host .wx-scale .wx-cell {
    font: 600 10px/1.2 ${GANTT_COMPACT_FONT} !important;
    font-size: 10px !important;
    color: #64748b !important;
  }

  .planning-svar-gantt-host .wx-bar .wx-content,
  .planning-svar-gantt-host .wx-bar .wx-text-out {
    font-size: 10px !important;
  }

  /* Keep task labels inside the bar — external labels stack awkwardly on dense trees. */
  .planning-svar-gantt-host .wx-bar.wx-task .wx-text-out {
    display: none !important;
  }

  .planning-svar-gantt-host .wx-bar.wx-summary .wx-content,
  .planning-svar-gantt-host .wx-bar.wx-task .wx-content {
    font-weight: 500;
  }

  .planning-svar-gantt-host .wx-milestone .wx-text-out {
    color: #64748b !important;
  }

  .planning-svar-gantt-host .wx-line > .wx-line-draw {
    stroke: #c8d3e0;
  }

  .planning-svar-gantt-host .wx-line-selectable:hover > .wx-line-draw {
    stroke: #94a3b8;
  }

  /* Row separators — left: per-row border; right: gradient capped to task row count. */
  .planning-svar-gantt-host .wx-grid .wx-header .wx-row {
    border-bottom: 1px solid var(--planning-gantt-row-border-color) !important;
  }

  .planning-svar-gantt-host .wx-grid .wx-body .wx-row {
    border-bottom: 1px solid var(--planning-gantt-row-border-color) !important;
    background: transparent !important;
  }

  .planning-svar-gantt-host .wx-grid .wx-body .wx-cell {
    background: transparent !important;
  }

  .planning-svar-gantt-host .wx-chart .wx-area {
    position: relative;
  }

  .planning-svar-gantt-host .wx-chart .wx-area::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    z-index: 0;
    width: 100%;
    height: var(--planning-gantt-content-height, 100%);
    pointer-events: none;
    background-image: repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent calc(var(--planning-gantt-row-height) - 1px),
      var(--planning-gantt-row-border-color) calc(var(--planning-gantt-row-height) - 1px),
      var(--planning-gantt-row-border-color) var(--planning-gantt-row-height)
    );
    background-size: 100% var(--planning-gantt-row-height);
  }

  .planning-svar-gantt-host .wx-chart .wx-row {
    border-bottom: 1px solid var(--planning-gantt-row-border-color) !important;
  }

  .planning-svar-gantt-host .wx-table-container,
  .planning-svar-gantt-host .wx-resizer,
  .planning-svar-gantt-host .wx-table-box {
    border-top: none !important;
    border-left: none !important;
    border-right: none !important;
    box-shadow: none !important;
  }

  .planning-svar-gantt-host .wx-grid .wx-header .wx-cell {
    border-top: none !important;
    border-left: none !important;
    box-shadow: none !important;
  }

  .planning-svar-gantt-host .wx-grid .wx-body .wx-cell,
  .planning-svar-gantt-host .wx-scale .wx-row {
    border-top: none !important;
    border-left: none !important;
    border-right: none !important;
    box-shadow: none !important;
  }

  /* Timeline scale — no right border on the last column in each row. */
  .planning-svar-gantt-host .wx-scale .wx-row .wx-cell:last-child {
    border-right: none !important;
    box-shadow: none !important;
  }

  /* Hide default chart cell grid (vertical lines); keep timeline column overlays. */
  .planning-svar-gantt-host .wx-chart .wx-area > div[style*="background"]:not(.wx-gantt-holidays):not(.planning-today-column-overlay):not(.planning-weekend-column-overlay):not(.planning-holiday-column-overlay) {
    background: none !important;
  }

  /* Scrollbars hidden by default; horizontal bar when hovering timeline/chart column. */
  .planning-svar-gantt-host .wx-gantt,
  .planning-svar-gantt-host .wx-table-container,
  .planning-svar-gantt-host .wx-scroll,
  .planning-svar-gantt-host .wx-grid .wx-scroll {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .planning-svar-gantt-host .wx-gantt::-webkit-scrollbar,
  .planning-svar-gantt-host .wx-table-container::-webkit-scrollbar,
  .planning-svar-gantt-host .wx-scroll::-webkit-scrollbar,
  .planning-svar-gantt-host .wx-grid .wx-scroll::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }

  .planning-svar-gantt-host .wx-chart {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .planning-svar-gantt-host .wx-chart::-webkit-scrollbar {
    height: 0;
  }

  .planning-svar-gantt-host .wx-layout > .wx-content:hover .wx-chart,
  .planning-svar-gantt-host .wx-chart:hover {
    scrollbar-width: thin;
    scrollbar-color: rgba(100, 116, 139, 0.55) transparent;
  }

  .planning-svar-gantt-host .wx-layout > .wx-content:hover .wx-chart::-webkit-scrollbar,
  .planning-svar-gantt-host .wx-chart:hover::-webkit-scrollbar {
    height: 7px;
  }

  .planning-svar-gantt-host .wx-layout > .wx-content:hover .wx-chart::-webkit-scrollbar-track,
  .planning-svar-gantt-host .wx-chart:hover::-webkit-scrollbar-track {
    background: rgba(241, 245, 249, 0.65);
    border-radius: 9999px;
  }

  .planning-svar-gantt-host .wx-layout > .wx-content:hover .wx-chart::-webkit-scrollbar-thumb,
  .planning-svar-gantt-host .wx-chart:hover::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.8);
    border-radius: 9999px;
  }

  .planning-svar-gantt-host .wx-layout > .wx-content:hover .wx-chart::-webkit-scrollbar-thumb:hover,
  .planning-svar-gantt-host .wx-chart:hover::-webkit-scrollbar-thumb:hover {
    background: rgba(100, 116, 139, 0.95);
  }

  .planning-svar-gantt-host--row-reorder .wx-table .wx-body .wx-row {
    cursor: grab;
  }

  .planning-svar-gantt-host--row-reorder .wx-reorder-task {
    cursor: grabbing;
  }

  .planning-svar-gantt-host--chart-edit .wx-bar.wx-task,
  .planning-svar-gantt-host--chart-edit .wx-bar.wx-milestone {
    cursor: grab;
  }

  .planning-svar-gantt-host--chart-edit .wx-bar.wx-task:active,
  .planning-svar-gantt-host--chart-edit .wx-bar.wx-milestone:active {
    cursor: grabbing;
  }
`

const GANTT_TRANSPARENT_SURFACE_STYLES = `
  .planning-svar-gantt-host--transparent {
    --planning-gantt-header-bg: rgba(255, 255, 255, 0.75);
    background: transparent !important;
  }

  .planning-svar-gantt-host--transparent .wx-willow-theme {
    --wx-gantt-holiday-background: transparent;
    --wx-gantt-task-slack-color: transparent;
    --wx-gantt-link-marker-background: transparent;
  }

  /* Body / chart — transparent so parent liquid-glass-enterprise-panel shows through. */
  .planning-svar-gantt-host--transparent .wx-gantt,
  .planning-svar-gantt-host--transparent .wx-willow-theme,
  .planning-svar-gantt-host--transparent .wx-table-container,
  .planning-svar-gantt-host--transparent .wx-table-box,
  .planning-svar-gantt-host--transparent .wx-chart,
  .planning-svar-gantt-host--transparent .wx-chart .wx-area,
  .planning-svar-gantt-host--transparent .wx-grid .wx-body,
  .planning-svar-gantt-host--transparent .wx-grid .wx-body .wx-row,
  .planning-svar-gantt-host--transparent .wx-grid .wx-body .wx-cell,
  .planning-svar-gantt-host--transparent .wx-layout,
  .planning-svar-gantt-host--transparent .wx-content,
  .planning-svar-gantt-host--transparent .wx-stuck {
    background: transparent !important;
    background-color: transparent !important;
  }

  /* Header only — same tone as liquid-glass-enterprise-panel (bg-white/75). */
  .planning-svar-gantt-host--transparent .wx-grid .wx-header,
  .planning-svar-gantt-host--transparent .wx-grid .wx-header .wx-row,
  .planning-svar-gantt-host--transparent .wx-grid .wx-header .wx-cell,
  .planning-svar-gantt-host--transparent .wx-stuck .wx-grid .wx-header,
  .planning-svar-gantt-host--transparent .wx-stuck .wx-grid .wx-header .wx-row,
  .planning-svar-gantt-host--transparent .wx-stuck .wx-grid .wx-header .wx-cell,
  .planning-svar-gantt-host--transparent .wx-scale,
  .planning-svar-gantt-host--transparent .wx-scale .wx-row,
  .planning-svar-gantt-host--transparent .wx-scale .wx-cell,
  .planning-svar-gantt-host--transparent .wx-scale .wx-cell-value {
    background: var(--planning-gantt-header-bg) !important;
    background-color: var(--planning-gantt-header-bg) !important;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
`

const GANTT_COLUMNS = [
  { id: 'text', header: 'Workspace', flexgrow: 2 },
  { id: 'start', header: 'Start', flexgrow: 1, align: 'center' as const },
  { id: 'duration', header: 'Duration', align: 'center' as const, flexgrow: 1 },
  { id: 'add-task', header: '', width: 50, align: 'center' as const },
]

const FLAT_GANTT_COLUMNS = [
  { id: 'text', header: 'Task title', width: 240, resize: true as const },
  { id: 'start', header: 'Start', width: 110, align: 'center' as const, resize: true as const },
  { id: 'duration', header: 'Duration', width: 90, align: 'center' as const, resize: true as const },
]

export type PlanningGanttLayout = 'hierarchical' | 'flat' | 'tree' | 'project-tree'

export type PlanningGanttTaskMoveEvent = {
  id: string
  target?: string
  mode: 'before' | 'after' | 'up' | 'down' | 'child'
  inProgress?: boolean
}

export type PlanningGanttTaskScheduleUpdateEvent = {
  id: string
  startDate: string
  endDate: string
  durationDays: number
  progress?: number
}

export type PlanningGanttTaskGridEditEvent = {
  id: string
  field: 'title' | 'startDate' | 'durationDays'
  value: string | number
}

type PlanningSvarGanttProps = {
  items: PlanningGanttItem[]
  workspaceOrder?: string[]
  layout?: PlanningGanttLayout
  /** Override default grid columns (e.g. directory icon columns). */
  columns?: typeof FLAT_GANTT_COLUMNS
  zoomLevel: PlanningGanttZoomLevel
  selectedId: string
  onSelect: (id: string) => void
  /** When true, clicks toggle tasks in `selectedIds` instead of single-select. */
  multiSelect?: boolean
  selectedIds?: string[]
  onSelectedIdsChange?: (ids: string[]) => void
  /** Enable drag-and-drop row reorder/reparent in the grid. */
  enableRowReorder?: boolean
  /** Called once when a row drag ends; return false to revert the Gantt tree. */
  onTaskMoveCommit?: (event: PlanningGanttTaskMoveEvent) => boolean | void
  /** Allow drag/move/resize of task bars on the timeline chart. */
  enableChartEdit?: boolean
  /** Allow double-click inline edit in the grid (native SVAR editors). */
  enableGridEdit?: boolean
  /** Called once when a chart bar edit ends; return false to revert. */
  onTaskScheduleCommit?: (event: PlanningGanttTaskScheduleUpdateEvent) => boolean | void
  /** Called when a grid cell edit is committed; return false to revert. */
  onTaskGridEditCommit?: (event: PlanningGanttTaskGridEditEvent) => boolean | void
  /** Bump to rebuild the Gantt task tree from props (e.g. after rejected move). */
  taskStructureRevision?: number
  /** `transparent` lets parent liquid-glass-enterprise-panel background show through (Project Timeline). */
  surface?: 'solid' | 'transparent'
  /** Allow drag-resize on timeline scale header (uniform cellWidth). Default true. */
  timelineScaleResize?: boolean
  /** Extend timeline when scrolling near chart edges. Disable for bounded readonly views. */
  enableTimelineScrollExtension?: boolean
  /** `forward` extends only into the future — avoids left-edge scroll jolt/flicker. */
  timelineScrollExtensionDirection?: 'both' | 'forward'
  /** `month` loads +1 calendar month per right-edge scroll (paged timeline). */
  timelineScrollExtensionStep?: 'default' | 'month'
  /** Initial forward span when `timelineScrollExtensionStep` is `month`. Default 6. */
  timelineInitialSpanMonths?: number
  /** Extra start/end padding when scroll extension is disabled (bounded previews). */
  boundedTimelinePadding?: boolean
  /** Fixed timeline window — disables scroll-edge extension (Conversion paging). */
  timelineWindowOverride?: { start: Date; end: Date }
  /** Scroll chart to the task date range once after mount (readonly previews). */
  scrollToTaskWindowOnMount?: boolean
  /** Fired when chart scroll / timeline window changes (paged timeline UX). */
  onTimelinePagingChange?: (state: TimelinePagingViewportState | null) => void
  /** Imperative paging controls (e.g. toolbar “Next month”). */
  onTimelinePagingApiReady?: (api: { extendForwardMonth: () => boolean } | null) => void
}

export function PlanningSvarGantt({
  items,
  workspaceOrder = [],
  layout = 'hierarchical',
  columns: columnsOverride,
  zoomLevel,
  selectedId,
  onSelect,
  multiSelect = false,
  selectedIds = [],
  onSelectedIdsChange,
  enableRowReorder = false,
  onTaskMoveCommit,
  enableChartEdit = false,
  enableGridEdit = false,
  onTaskScheduleCommit,
  onTaskGridEditCommit,
  taskStructureRevision = 0,
  surface = 'solid',
  timelineScaleResize = true,
  enableTimelineScrollExtension = true,
  timelineScrollExtensionDirection = 'both',
  timelineScrollExtensionStep = 'default',
  timelineInitialSpanMonths = 6,
  boundedTimelinePadding = false,
  timelineWindowOverride,
  scrollToTaskWindowOnMount = false,
  onTimelinePagingChange,
  onTimelinePagingApiReady,
}: PlanningSvarGanttProps) {
  const { tasks, links } = useMemo(() => {
    if (layout === 'flat') return buildFlatGanttModel(items)
    if (layout === 'project-tree') return buildProjectTreeGanttModel(items)
    if (layout === 'tree') return buildTreeGanttModel(items)
    return buildSvarGanttModel(items, workspaceOrder)
  }, [items, layout, workspaceOrder])
  // SVAR's grid dispatches 'update-task' with a FULL copy of the row (every field, not just the
  // edited one) — see @svar-ui/react-gantt Grid.jsx's 'update-cell' handler, which spreads `{...task}`
  // and overwrites only the one changed key. Field *presence* on ev.task is therefore useless for
  // figuring out what the user actually edited; this ref lets us diff against the prior value instead.
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks
  const columns =
    columnsOverride ??
    (layout === 'flat' || layout === 'tree' || layout === 'project-tree'
      ? FLAT_GANTT_COLUMNS
      : GANTT_COLUMNS)

  const ganttInnerRef = useRef<HTMLDivElement>(null)
  const ganttApiRef = useRef<IApi | null>(null)
  const pendingTaskMoveRef = useRef<PlanningGanttTaskMoveEvent | null>(null)
  const pendingScheduleUpdateRef = useRef<PlanningGanttTaskScheduleUpdateEvent | null>(null)
  const rowDragActiveRef = useRef(false)
  const chartEditActiveRef = useRef(false)
  const postDropQuietUntilRef = useRef(0)
  const postDropSyncTimerRef = useRef(0)
  const visualSyncRafRef = useRef(0)
  const enableRowReorderRef = useRef(enableRowReorder)
  const enableChartEditRef = useRef(enableChartEdit)
  const enableGridEditRef = useRef(enableGridEdit)
  const onTaskMoveCommitRef = useRef(onTaskMoveCommit)
  const onTaskScheduleCommitRef = useRef(onTaskScheduleCommit)
  const onTaskGridEditCommitRef = useRef(onTaskGridEditCommit)
  const moveDropHandlingRef = useRef(false)
  const selectedIdsRef = useRef(selectedIds)
  const onSelectedIdsChangeRef = useRef(onSelectedIdsChange)
  const selectableTaskIdsRef = useRef<string[]>([])
  const bindTimelineScrollRef = useRef<(() => void) | null>(null)
  const bindPagingScrollRef = useRef<(() => void) | null>(null)

  const selectableTaskIds = useMemo(
    () => tasks.map((task) => String(task.id)).filter((id) => !isGanttSummaryId(id)),
    [tasks],
  )

  selectedIdsRef.current = selectedIds
  onSelectedIdsChangeRef.current = onSelectedIdsChange ?? (() => {})
  selectableTaskIdsRef.current = selectableTaskIds

  const selectionColumn = useMemo(
    () =>
      buildGanttSelectionColumnWithRefs({
        selectedIdsRef,
        selectableIdsRef: selectableTaskIdsRef,
        onSelectedIdsChangeRef,
      }),
    [],
  )

  const ganttColumns = useMemo(() => {
    if (!multiSelect || !onSelectedIdsChange) return columns

    return [selectionColumn, ...columns]
  }, [columns, multiSelect, onSelectedIdsChange, selectionColumn])
  const scales = useMemo(() => scalesForZoom(zoomLevel), [zoomLevel])
  const baseTimelineCellWidth = useMemo(() => cellWidthForZoom(zoomLevel), [zoomLevel])
  const [columnWidthOverridesByZoom, setColumnWidthOverridesByZoom] = useState(
    initialColumnOverridesByZoom,
  )
  const columnWidthOverrides = columnWidthOverridesByZoom[zoomLevel]
  const layoutSyncRef = useRef({
    overrides: columnWidthOverrides,
    baseWidth: baseTimelineCellWidth,
    zoom: zoomLevel,
  })

  useEffect(() => {
    layoutSyncRef.current = {
      overrides: columnWidthOverrides,
      baseWidth: baseTimelineCellWidth,
      zoom: zoomLevel,
    }
  }, [baseTimelineCellWidth, columnWidthOverrides, zoomLevel])

  const runGanttVisualSync = useCallback(() => {
    const host = ganttInnerRef.current
    const api = ganttApiRef.current
    const { overrides, baseWidth, zoom } = layoutSyncRef.current
    syncVariableTimelineLayout(host, api, overrides, baseWidth)
    syncTodayColumnHighlight(host, api, zoom, overrides, baseWidth)
  }, [])

  const scheduleGanttVisualSync = useCallback(() => {
    if (rowDragActiveRef.current || chartEditActiveRef.current) return

    const quietRemaining = postDropQuietUntilRef.current - performance.now()
    if (quietRemaining > 0) {
      if (!postDropSyncTimerRef.current) {
        postDropSyncTimerRef.current = window.setTimeout(() => {
          postDropSyncTimerRef.current = 0
          scheduleGanttVisualSync()
        }, quietRemaining + 16)
      }
      return
    }

    if (visualSyncRafRef.current) return
    visualSyncRafRef.current = requestAnimationFrame(() => {
      visualSyncRafRef.current = 0
      if (rowDragActiveRef.current || chartEditActiveRef.current) return
      runGanttVisualSync()
      bindTimelineScrollRef.current?.()
      bindPagingScrollRef.current?.()
    })
  }, [runGanttVisualSync])

  const handleTimelineColumnWidthChange = useCallback(
    (columnIndex: number, width: number) => {
      setColumnWidthOverridesByZoom((prev) => {
        const current = prev[zoomLevel]
        if (current[columnIndex] === width) return prev
        const nextZoomOverrides = { ...current, [columnIndex]: width }
        layoutSyncRef.current = {
          overrides: nextZoomOverrides,
          baseWidth: baseTimelineCellWidth,
          zoom: zoomLevel,
        }
        return {
          ...prev,
          [zoomLevel]: nextZoomOverrides,
        }
      })
      requestAnimationFrame(scheduleGanttVisualSync)
    },
    [baseTimelineCellWidth, scheduleGanttVisualSync, zoomLevel],
  )

  useEffect(() => {
    enableRowReorderRef.current = enableRowReorder
  }, [enableRowReorder])

  useEffect(() => {
    enableChartEditRef.current = enableChartEdit
  }, [enableChartEdit])

  useEffect(() => {
    enableGridEditRef.current = enableGridEdit
  }, [enableGridEdit])

  useEffect(() => {
    onTaskMoveCommitRef.current = onTaskMoveCommit
  }, [onTaskMoveCommit])

  useEffect(() => {
    onTaskScheduleCommitRef.current = onTaskScheduleCommit
  }, [onTaskScheduleCommit])

  useEffect(() => {
    onTaskGridEditCommitRef.current = onTaskGridEditCommit
  }, [onTaskGridEditCommit])

  const normalizeMoveEvent = useCallback((ev: {
    id: TID
    target?: TID
    mode: PlanningGanttTaskMoveEvent['mode']
    inProgress?: boolean
  }): PlanningGanttTaskMoveEvent => ({
    id: String(ev.id),
    target: ev.target != null ? String(ev.target) : undefined,
    mode: ev.mode,
    inProgress: ev.inProgress,
  }), [])

  const normalizeScheduleUpdate = useCallback((ev: {
    id: TID
    task: Partial<ITask>
  }): PlanningGanttTaskScheduleUpdateEvent | null => {
    const start = ev.task.start
    const end = ev.task.end ?? ev.task.start
    if (!start || !end) return null

    const startDate =
      start instanceof Date
        ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
        : String(start).slice(0, 10)
    const endDate =
      end instanceof Date
        ? `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
        : String(end).slice(0, 10)
    const span = Math.round((end.getTime() - start.getTime()) / 86_400_000)

    return {
      id: String(ev.id),
      startDate,
      endDate,
      durationDays: span <= 0 ? 0 : Math.max(1, span),
      progress: ev.task.progress,
    }
  }, [])

  const normalizeGridTaskUpdate = useCallback((ev: {
    id: TID
    task: Partial<ITask>
  }): PlanningGanttTaskGridEditEvent | null => {
    const id = String(ev.id)
    // ev.task is a full copy of the row with only the edited column changed (see the
    // tasksRef comment above) — diff against the previous task to find which field it was,
    // instead of checking presence (every field is always present).
    const prevTask = tasksRef.current.find((task) => String(task.id) === id)

    const toTime = (value: unknown): number | null => {
      if (value == null) return null
      const date = value instanceof Date ? value : new Date(String(value))
      return Number.isNaN(date.getTime()) ? null : date.getTime()
    }

    if (ev.task.text != null && String(ev.task.text) !== String(prevTask?.text ?? '')) {
      return { id, field: 'title', value: String(ev.task.text) }
    }

    const nextStartTime = toTime(ev.task.start)
    const prevStartTime = prevTask ? toTime(prevTask.start) : null
    if (nextStartTime != null && nextStartTime !== prevStartTime) {
      const start = new Date(nextStartTime)
      const iso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
      return { id, field: 'startDate', value: iso }
    }

    if (ev.task.duration != null) {
      const duration = Number(ev.task.duration)
      const prevDuration = prevTask ? Number(prevTask.duration) : NaN
      if (Number.isFinite(duration) && duration >= 0 && duration !== prevDuration) {
        return { id, field: 'durationDays', value: Math.round(duration) }
      }
    }

    return null
  }, [])

  const handleGanttInit = useCallback(
    (api: IApi) => {
      ganttApiRef.current = api
      pendingTaskMoveRef.current = null
      pendingScheduleUpdateRef.current = null
      rowDragActiveRef.current = false
      chartEditActiveRef.current = false
      moveDropHandlingRef.current = false

      /**
       * SVAR move-task semantics (from @svar-ui/gantt-store):
       * - inProgress === true  → applies the tree move + setState every drag frame
       * - inProgress === false → ONLY clears $reorder; move already committed
       *
       * Returning false on the drop frame blocks $reorder cleanup and freezes the UI.
       * Never reject drop — validate after and remount if the business rules fail.
       */
      api.intercept('move-task', (ev) => {
        if (!enableRowReorderRef.current) return false

        const payload = normalizeMoveEvent(ev)

        if (ev.inProgress !== false) {
          rowDragActiveRef.current = true
          pendingTaskMoveRef.current = payload
          return true
        }

        // Drop frame: always allow SVAR to clear $reorder.
        rowDragActiveRef.current = false
        postDropQuietUntilRef.current = performance.now() + 1500
        const dropPayload = pendingTaskMoveRef.current ?? payload
        pendingTaskMoveRef.current = null

        if (!moveDropHandlingRef.current) {
          moveDropHandlingRef.current = true
          queueMicrotask(() => {
            moveDropHandlingRef.current = false
            onTaskMoveCommitRef.current?.(dropPayload)
          })
        }

        return true
      })

      api.intercept('update-task', (ev) => {
        // Drop/commit frame that ends an in-progress chart-bar drag. This MUST be checked
        // before the general "in-progress" exclusion below: chartEditActiveRef is set true
        // on the first in-progress frame and included in that exclusion's condition, so if
        // the reset lived there it would never run — the flag would gate the very branch
        // meant to clear it, permanently stuck true and silently swallowing every later
        // update-task event (including unrelated grid edits like the Start-date column).
        if (chartEditActiveRef.current && enableChartEditRef.current && ev.inProgress === false) {
          chartEditActiveRef.current = false
          postDropQuietUntilRef.current = performance.now() + 1200
          const pending = pendingScheduleUpdateRef.current
          pendingScheduleUpdateRef.current = null
          const normalized = pending ?? normalizeScheduleUpdate(ev)
          if (normalized) {
            // Always allow store commit; revert via remount if business rules reject.
            queueMicrotask(() => {
              const accepted = onTaskScheduleCommitRef.current?.(normalized) !== false
              if (!accepted) {
                // Caller bumps taskStructureRevision on reject.
              }
            })
          }
          return true
        }

        // Never block store maintenance (summary dates, drag previews, move side-effects).
        if (
          ev.inProgress === true ||
          rowDragActiveRef.current ||
          chartEditActiveRef.current ||
          isGanttSummaryId(String(ev.id)) ||
          ev.task?.type === 'summary' ||
          ev.eventSource === 'move-task' ||
          ev.eventSource === 'drag-task'
        ) {
          if (ev.inProgress === true && enableChartEditRef.current) {
            chartEditActiveRef.current = true
            const normalized = normalizeScheduleUpdate(ev)
            if (normalized) pendingScheduleUpdateRef.current = normalized
          }
          return true
        }

        if (enableGridEditRef.current) {
          const normalized = normalizeGridTaskUpdate(ev)
          if (normalized) {
            postDropQuietUntilRef.current = performance.now() + 400
            queueMicrotask(() => {
              onTaskGridEditCommitRef.current?.(normalized)
            })
          }
        }

        return true
      })
    },
    [normalizeGridTaskUpdate, normalizeMoveEvent, normalizeScheduleUpdate],
  )

  useEffect(() => {
    const host = ganttInnerRef.current
    if (!host || !enableGridEdit) return undefined

    // SVAR's own grid never wires click/double-click to open a per-cell editor for columns
    // that declare one (react-gantt's dblclick handler explicitly skips them; the grid-store
    // only opens the editor via the F2 hotkey — see @svar-ui/grid-store DataStore.ts's
    // "hotkey" handler). That leaves editing our Task title / Start / Duration cells
    // undiscoverable via the conventional double-click. Wire it up directly. 'open-editor' is
    // an action on the INNER react-grid table API (getTable()), not the outer Gantt api.
    const onDblClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      // The tree expand/collapse toggle lives inside the same "text" cell — don't hijack it.
      if (target?.closest('[data-action="toggle-row"]')) return
      const rowId = locateGanttCellAttr(event.target, 'data-row-id')
      const columnId = locateGanttCellAttr(event.target, 'data-col-id')
      if (!rowId || !columnId || isGanttSummaryId(rowId)) return
      const tableApi = ganttApiRef.current?.getTable()
      if (!tableApi || tableApi instanceof Promise) return
      tableApi.exec('open-editor', { id: rowId, column: columnId })
    }

    host.addEventListener('dblclick', onDblClick)
    return () => host.removeEventListener('dblclick', onDblClick)
  }, [enableGridEdit])

  useTimelineScaleColumnResize(
    ganttInnerRef,
    zoomLevel,
    baseTimelineCellWidth,
    columnWidthOverrides,
    handleTimelineColumnWidthChange,
    timelineScaleResize && tasks.length > 0,
  )

  const baseGanttWindow = useMemo(() => {
    const base =
      layout === 'tree' || layout === 'project-tree'
        ? computeGanttWindowFromTasks(tasks)
        : computeGanttWindow(items)
    if (timelineScrollExtensionStep === 'month') {
      return padGanttWindowPaged(base, timelineInitialSpanMonths)
    }
    return padGanttWindowForZoom(
      base,
      zoomLevel,
      boundedTimelinePadding || timelineScrollExtensionDirection === 'forward',
    )
  }, [
    boundedTimelinePadding,
    items,
    layout,
    tasks,
    timelineInitialSpanMonths,
    timelineScrollExtensionDirection,
    timelineScrollExtensionStep,
    zoomLevel,
  ])

  const {
    activeWindow: extendedGanttWindow,
    canExtendForward,
    extendForwardMonth,
  } = useTimelineScrollExtension(
    ganttInnerRef,
    baseGanttWindow,
    zoomLevel,
    enableTimelineScrollExtension && tasks.length > 0 && !timelineWindowOverride,
    bindTimelineScrollRef,
    timelineScrollExtensionDirection,
    timelineScrollExtensionStep,
  )

  const ganttWindow = timelineWindowOverride ?? extendedGanttWindow
  const ganttWindowRef = useRef(ganttWindow)
  ganttWindowRef.current = ganttWindow

  const extendForwardMonthRef = useRef(extendForwardMonth)
  extendForwardMonthRef.current = extendForwardMonth
  const onTimelinePagingApiReadyRef = useRef(onTimelinePagingApiReady)
  onTimelinePagingApiReadyRef.current = onTimelinePagingApiReady

  useEffect(() => {
    if (!onTimelinePagingApiReadyRef.current || timelineWindowOverride) return undefined
    onTimelinePagingApiReadyRef.current({
      extendForwardMonth: () => extendForwardMonthRef.current(),
    })
    return () => onTimelinePagingApiReadyRef.current?.(null)
  }, [canExtendForward, extendForwardMonth, timelineWindowOverride])

  useEffect(() => {
    if (!onTimelinePagingChange || timelineWindowOverride) return undefined

    let chart: HTMLElement | null = null
    let raf = 0
    const lastPublishedRef = { current: null as TimelinePagingViewportState | null }

    const publish = () => {
      if (!chart) chart = findGanttChart(ganttInnerRef.current)
      if (!chart || chart.scrollWidth === 0 || chart.clientWidth === 0) {
        if (shouldPublishTimelinePaging(lastPublishedRef.current, null)) {
          lastPublishedRef.current = null
          startTransition(() => onTimelinePagingChange(null))
        }
        return
      }

      const windowStart = ganttWindow.start.getTime()
      const windowEnd = ganttWindow.end.getTime()
      const span = windowEnd - windowStart
      if (span <= 0) {
        if (shouldPublishTimelinePaging(lastPublishedRef.current, null)) {
          lastPublishedRef.current = null
          startTransition(() => onTimelinePagingChange(null))
        }
        return
      }

      const fractionStart = chart.scrollLeft / chart.scrollWidth
      const fractionEnd = Math.min(1, (chart.scrollLeft + chart.clientWidth) / chart.scrollWidth)
      const remaining = chart.scrollWidth - chart.scrollLeft - chart.clientWidth

      const nextState: TimelinePagingViewportState = {
        windowStart: ganttWindow.start,
        windowEnd: ganttWindow.end,
        viewportStart: new Date(windowStart + fractionStart * span),
        viewportEnd: new Date(windowStart + fractionEnd * span),
        canExtendForward,
        atRightEdge: remaining <= TIMELINE_SCROLL_EDGE_THRESHOLD_PX,
      }

      if (!shouldPublishTimelinePaging(lastPublishedRef.current, nextState)) return
      lastPublishedRef.current = nextState
      startTransition(() => onTimelinePagingChange(nextState))
    }

    const schedulePublish = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(publish)
    }

    const bind = () => {
      const next = findGanttChart(ganttInnerRef.current)
      if (next === chart) return
      if (chart) chart.removeEventListener('scroll', schedulePublish)
      chart = next
      chart?.addEventListener('scroll', schedulePublish, { passive: true })
      schedulePublish()
    }

    bind()
    schedulePublish()
    bindPagingScrollRef.current = bind

    return () => {
      cancelAnimationFrame(raf)
      bindPagingScrollRef.current = null
      if (chart) chart.removeEventListener('scroll', schedulePublish)
    }
  }, [canExtendForward, ganttWindow.end, ganttWindow.start, onTimelinePagingChange])

  const initialScrollDoneRef = useRef(false)

  useEffect(() => {
    initialScrollDoneRef.current = false
  }, [tasks, zoomLevel, taskStructureRevision])

  useEffect(() => {
    if (!scrollToTaskWindowOnMount || tasks.length === 0) return
    if (initialScrollDoneRef.current) return

    const host = ganttInnerRef.current
    if (!host) return

    let cancelled = false
    let attempts = 0

    const applyInitialScroll = () => {
      if (cancelled || initialScrollDoneRef.current) return

      const chart = host.querySelector<HTMLElement>('.wx-chart')
      if (!chart || chart.scrollWidth <= chart.clientWidth) {
        if (attempts < 8) {
          attempts += 1
          requestAnimationFrame(applyInitialScroll)
        }
        return
      }

      let minMs = Number.POSITIVE_INFINITY
      for (const task of tasks) {
        const rawStart = task.start
        const start =
          rawStart instanceof Date
            ? rawStart
            : typeof rawStart === 'string' && rawStart.trim()
              ? parseIsoDate(rawStart)
              : null
        if (!start) continue
        minMs = Math.min(minMs, start.getTime())
      }
      if (!Number.isFinite(minMs)) return

      const windowStart = ganttWindowRef.current.start.getTime()
      const windowEnd = ganttWindowRef.current.end.getTime()
      const span = windowEnd - windowStart
      if (span <= 0) return

      const fraction = Math.max(0, Math.min(1, (minMs - windowStart) / span))
      chart.scrollLeft = Math.max(0, fraction * chart.scrollWidth - chart.clientWidth * 0.08)
      initialScrollDoneRef.current = true
    }

    const raf = requestAnimationFrame(applyInitialScroll)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [scrollToTaskWindowOnMount, taskStructureRevision, tasks, zoomLevel])

  useEffect(() => {
    scheduleGanttVisualSync()
  }, [baseTimelineCellWidth, columnWidthOverrides, scheduleGanttVisualSync, zoomLevel])

  const todayMarker = useMemo(
    () => todayMarkerForZoom(zoomLevel, ganttWindow),
    [ganttWindow, zoomLevel],
  )

  const ganttSelected = multiSelect
    ? selectedIds
    : selectedId
      ? [selectedId]
      : []

  const handleSelectTask = useCallback(
    (ev: { id?: TID }) => {
      if (rowDragActiveRef.current) return

      const id = ev?.id != null ? String(ev.id) : ''
      if (!id || isGanttSummaryId(id)) return

      if (multiSelect && onSelectedIdsChange) {
        onSelectedIdsChange(
          selectedIds.includes(id)
            ? selectedIds.filter((existingId) => existingId !== id)
            : [...selectedIds, id],
        )
        return
      }

      onSelect(id)
    },
    [multiSelect, onSelect, onSelectedIdsChange, selectedIds],
  )

  const hostStyle = useMemo(
    () =>
      ({
        '--planning-gantt-content-height': `${tasks.length * GANTT_ROW_HEIGHT}px`,
      }) as CSSProperties,
    [tasks.length],
  )

  return (
    <div
      className={cn(
        'planning-svar-gantt-host flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl',
        zoomLevel === 'Quarter' && 'planning-svar-gantt-host--zoom-quarter',
        zoomLevel === 'Month' && 'planning-svar-gantt-host--zoom-month',
        zoomLevel === 'Day' && 'planning-svar-gantt-host--zoom-day',
        enableRowReorder && 'planning-svar-gantt-host--row-reorder',
        enableChartEdit && 'planning-svar-gantt-host--chart-edit',
        surface === 'transparent'
          ? 'planning-svar-gantt-host--transparent bg-transparent'
          : 'bg-white',
      )}
      style={tasks.length > 0 ? hostStyle : undefined}
    >
      <style>
        {GANTT_COMPACT_STYLES}
        {PLANNING_TODAY_HIGHLIGHT_STYLES}
        {surface === 'transparent' ? GANTT_TRANSPARENT_SURFACE_STYLES : ''}
      </style>
      {tasks.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-10 text-sm text-slate-400">
          No schedule items match the current filters.
        </div>
      ) : (
        <div ref={ganttInnerRef} className="planning-svar-gantt-inner flex min-h-0 flex-1 flex-col overflow-hidden">
          <Willow fonts={false}>
            <Gantt
              key={`${zoomLevel}-${taskStructureRevision}`}
              init={handleGanttInit}
              tasks={tasks}
              links={links}
              scales={scales}
              columns={ganttColumns}
              selected={ganttSelected}
              start={ganttWindow.start}
              end={ganttWindow.end}
              autoScale={false}
              markers={todayMarker}
              cellHeight={GANTT_ROW_HEIGHT}
              cellWidth={baseTimelineCellWidth}
              scaleHeight={scaleHeightForZoom(zoomLevel)}
              zoom
              readonly={!(enableChartEdit || enableGridEdit || enableRowReorder)}
              onSelectTask={handleSelectTask}
            />
          </Willow>
        </div>
      )}
    </div>
  )
}
