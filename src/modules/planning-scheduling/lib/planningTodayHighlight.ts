import type { IApi, IMarker, IScaleConfig } from '@svar-ui/react-gantt'
import { buildTimelineColumnLayouts } from './planningTimelineColumnLayout'
import { dayColumnTone, isPublicHoliday, isWeekend } from './planningTimelineCalendar'

export type PlanningGanttZoomLevel = 'Day' | 'Week' | 'Month' | 'Quarter'

export const PLANNING_TODAY_COLUMN_OVERLAY_CLASS = 'planning-today-column-overlay'
export const PLANNING_WEEKEND_COLUMN_OVERLAY_CLASS = 'planning-weekend-column-overlay'
export const PLANNING_HOLIDAY_COLUMN_OVERLAY_CLASS = 'planning-holiday-column-overlay'

const TIMELINE_COLUMN_OVERLAY_CLASSES = [
  PLANNING_TODAY_COLUMN_OVERLAY_CLASS,
  PLANNING_WEEKEND_COLUMN_OVERLAY_CLASS,
  PLANNING_HOLIDAY_COLUMN_OVERLAY_CLASS,
] as const

export function todayLocalMidnight(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function isSameLocalMonth(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth()
}

function startOfLocalWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const weekday = start.getDay()
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday
  start.setDate(start.getDate() + mondayOffset)
  return start
}

function isSameLocalWeek(left: Date, right: Date): boolean {
  return startOfLocalWeek(left).getTime() === startOfLocalWeek(right).getTime()
}

function isInLocalQuarterColumn(columnStart: Date, today: Date): boolean {
  const start = new Date(columnStart.getFullYear(), columnStart.getMonth(), 1)
  const end = new Date(columnStart.getFullYear(), columnStart.getMonth() + 3, 0, 23, 59, 59, 999)
  return today.getTime() >= start.getTime() && today.getTime() <= end.getTime()
}

export function isTodayTimelineColumn(
  zoom: PlanningGanttZoomLevel,
  columnStart: Date,
  today: Date = todayLocalMidnight(),
): boolean {
  switch (zoom) {
    case 'Day':
      return isSameLocalDay(columnStart, today)
    case 'Week':
      return isSameLocalWeek(columnStart, today)
    case 'Month':
      return isSameLocalMonth(columnStart, today)
    case 'Quarter':
      return isInLocalQuarterColumn(columnStart, today)
    default:
      return false
  }
}

function scaleCssClassForDayColumn(date: Date, today: Date): string {
  const classes: string[] = []
  if (isSameLocalDay(date, today)) classes.push('planning-today-scale--day')
  if (isPublicHoliday(date)) classes.push('planning-holiday-scale--day')
  else if (isWeekend(date)) classes.push('planning-weekend-scale--day')
  return classes.join(' ')
}

function scaleCssClassForToday(zoom: PlanningGanttZoomLevel, today: Date): (date: Date) => string {
  switch (zoom) {
    case 'Day':
      return (date) => scaleCssClassForDayColumn(date, today)
    case 'Week':
      return (date) => (isSameLocalWeek(date, today) ? 'planning-today-scale--week' : '')
    case 'Month':
      return (date) => (isSameLocalMonth(date, today) ? 'planning-today-scale--month' : '')
    case 'Quarter':
      return (date) =>
        isInLocalQuarterColumn(date, today) ? 'planning-today-scale--quarter' : ''
    default:
      return () => ''
  }
}

function coarseScaleCssClassForToday(zoom: PlanningGanttZoomLevel, today: Date): (date: Date) => string {
  if (zoom === 'Week') {
    return (date) => (isSameLocalMonth(date, today) ? 'planning-today-scale-coarse--week' : '')
  }
  return () => ''
}

const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'long' })
const WEEKDAY_LABEL_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'short' })

function formatMonthLabel(date: Date): string {
  return MONTH_LABEL_FORMAT.format(date)
}

export function formatDayColumnLabel(date: Date): string {
  const weekday = WEEKDAY_LABEL_FORMAT.format(date)
  const day = String(date.getDate()).padStart(2, '0')
  return `${weekday}\n${day}`
}

/** e.g. "July - September", "January - March '27" — matches enterprise Gantt quarter headers. */
export function formatQuarterColumnLabel(start: Date, _next?: Date): string {
  const endMonthDate = new Date(start.getFullYear(), start.getMonth() + 2, 1)
  const prevQuarterStart = new Date(start.getFullYear(), start.getMonth() - 3, 1)
  const yearSuffix =
    start.getFullYear() !== prevQuarterStart.getFullYear()
      ? ` '${String(start.getFullYear()).slice(-2)}`
      : ''

  return `${formatMonthLabel(start)} - ${formatMonthLabel(endMonthDate)}${yearSuffix}`
}

export function formatMonthColumnLabel(start: Date, next?: Date): string {
  const label = formatMonthLabel(start)
  if (!next) return label

  const endYear = start.getFullYear()
  const nextYear = next.getFullYear()
  if (nextYear > endYear) {
    return `${label} '${String(endYear).slice(-2)}`
  }
  return label
}

export function scalesForZoomWithTodayHighlight(zoom: PlanningGanttZoomLevel): IScaleConfig[] {
  const today = todayLocalMidnight()
  const fineCss = scaleCssClassForToday(zoom, today)
  const coarseCss = coarseScaleCssClassForToday(zoom, today)

  switch (zoom) {
    case 'Day':
      return [
        { unit: 'month', step: 1, format: '%F %Y' },
        { unit: 'day', step: 1, format: formatDayColumnLabel, css: fineCss },
      ]
    case 'Week':
      return [
        { unit: 'month', step: 1, format: '%F %Y', css: coarseCss },
        { unit: 'week', step: 1, format: 'W%W', css: fineCss },
      ]
    case 'Month':
      return [
        { unit: 'year', step: 1, format: '%Y' },
        { unit: 'month', step: 1, format: formatMonthColumnLabel, css: fineCss },
      ]
    case 'Quarter':
      return [
        { unit: 'year', step: 1, format: '%Y' },
        { unit: 'month', step: 3, format: formatQuarterColumnLabel, css: fineCss },
      ]
    default:
      return [
        { unit: 'month', step: 1, format: '%F %Y' },
        { unit: 'day', step: 1, format: '%d', css: fineCss },
      ]
  }
}

/**
 * Chart column overlays (today / weekend / holiday).
 * SVAR native highlight only works when minUnit is day/hour — we paint all tones via DOM.
 */
export function syncTodayColumnHighlight(
  host: HTMLElement | null,
  api: IApi | null,
  zoom: PlanningGanttZoomLevel,
  overrides: Record<number, number>,
  fallbackWidth: number,
): void {
  if (!host || !api) return

  const scales = api.getState()._scales
  if (!scales?.rows?.length) return

  const columns = buildTimelineColumnLayouts(scales, overrides, fallbackWidth)
  if (columns.length === 0) return

  const area = host.querySelector('.wx-chart .wx-area')
  if (!area) return

  const today = todayLocalMidnight()
  const desiredOverlays: Array<{ className: string; left: number; width: number }> = []

  let offsetX = 0
  for (const column of columns) {
    const tone = zoom === 'Day' ? dayColumnTone(column.start, today) : null
    const isToday =
      zoom !== 'Day' ? isTodayTimelineColumn(zoom, column.start, today) : tone === 'today'

    let overlayClass: string | null = null
    if (zoom === 'Day') {
      if (tone === 'today') overlayClass = PLANNING_TODAY_COLUMN_OVERLAY_CLASS
      else if (tone === 'holiday') overlayClass = PLANNING_HOLIDAY_COLUMN_OVERLAY_CLASS
      else if (tone === 'weekend') overlayClass = PLANNING_WEEKEND_COLUMN_OVERLAY_CLASS
    } else if (isToday) {
      overlayClass = PLANNING_TODAY_COLUMN_OVERLAY_CLASS
    }

    if (overlayClass) {
      desiredOverlays.push({
        className: overlayClass,
        left: Math.round(offsetX),
        width: Math.round(column.width),
      })
    }
    offsetX += column.width
  }

  const existingOverlays = Array.from(
    area.querySelectorAll<HTMLElement>(
      TIMELINE_COLUMN_OVERLAY_CLASSES.map((className) => `.${className}`).join(','),
    ),
  )

  while (existingOverlays.length > desiredOverlays.length) {
    existingOverlays.pop()?.remove()
  }

  desiredOverlays.forEach((spec, index) => {
    let overlay = existingOverlays[index]
    if (!overlay) {
      overlay = document.createElement('div')
      overlay.style.position = 'absolute'
      overlay.style.top = '0'
      overlay.style.height = '100%'
      overlay.style.pointerEvents = 'none'
      area.appendChild(overlay)
    }

    overlay.className = spec.className
    overlay.style.left = `${spec.left}px`
    overlay.style.width = `${spec.width}px`
  })
}

export function todayMarkerForZoom(
  zoom: PlanningGanttZoomLevel,
  window: { start: Date; end: Date },
): IMarker[] {
  const today = todayLocalMidnight()
  if (today.getTime() < window.start.getTime() || today.getTime() > window.end.getTime()) {
    return []
  }
  return [
    {
      start: today,
      text: '',
      css: 'planning-today-marker',
    },
  ]
}

export const PLANNING_TODAY_HIGHLIGHT_STYLES = `
  .planning-svar-gantt-host {
    --planning-today-accent: #3b82f6;
    --planning-today-accent-soft: rgba(59, 130, 246, 0.14);
    --planning-weekend-accent: #64748b;
    --planning-weekend-soft: rgba(100, 116, 139, 0.11);
    --planning-holiday-accent: #e11d48;
    --planning-holiday-soft: rgba(225, 29, 72, 0.11);
  }

  /* Full-height column shading */
  .planning-svar-gantt-host .wx-chart .wx-area .planning-weekend-column-overlay {
    background: var(--planning-weekend-soft) !important;
    z-index: 0;
  }

  .planning-svar-gantt-host .wx-chart .wx-area .planning-holiday-column-overlay {
    background: var(--planning-holiday-soft) !important;
    z-index: 0;
  }

  .planning-svar-gantt-host .wx-chart .wx-area .planning-today-column-overlay {
    background: var(--planning-today-accent-soft) !important;
    z-index: 1;
  }

  /* Vertical today line */
  .planning-svar-gantt-host .wx-marker.planning-today-marker {
    width: 2px !important;
    min-width: 2px !important;
    background: var(--planning-today-accent) !important;
    color: transparent !important;
    font-size: 0 !important;
    opacity: 1 !important;
    z-index: 4;
    pointer-events: none;
  }

  .planning-svar-gantt-host .wx-marker.planning-today-marker::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid var(--planning-today-accent);
  }

  /* Header — today */
  .planning-svar-gantt-host .wx-scale .wx-cell.planning-today-scale--day,
  .planning-svar-gantt-host .wx-scale .wx-cell.planning-today-scale--week,
  .planning-svar-gantt-host .wx-scale .wx-cell.planning-today-scale--month,
  .planning-svar-gantt-host .wx-scale .wx-cell.planning-today-scale--quarter {
    background: var(--planning-today-accent-soft) !important;
    color: var(--planning-today-accent) !important;
    font-weight: 700;
  }

  /* Header — weekend (Day view) */
  .planning-svar-gantt-host .wx-scale .wx-cell.planning-weekend-scale--day:not(.planning-today-scale--day):not(.planning-holiday-scale--day) {
    background: var(--planning-weekend-soft) !important;
    color: var(--planning-weekend-accent) !important;
  }

  /* Header — public holiday (Day view) */
  .planning-svar-gantt-host .wx-scale .wx-cell.planning-holiday-scale--day:not(.planning-today-scale--day) {
    background: var(--planning-holiday-soft) !important;
    color: var(--planning-holiday-accent) !important;
    font-weight: 700;
  }

  .planning-svar-gantt-host .wx-scale .wx-cell.planning-today-scale-coarse--week {
    box-shadow: inset 0 -2px 0 var(--planning-today-accent);
  }

  /* Transparent surface resets scale header bg — restore today tint */
  .planning-svar-gantt-host--transparent .wx-scale .wx-cell.planning-today-scale--day,
  .planning-svar-gantt-host--transparent .wx-scale .wx-cell.planning-today-scale--week,
  .planning-svar-gantt-host--transparent .wx-scale .wx-cell.planning-today-scale--month,
  .planning-svar-gantt-host--transparent .wx-scale .wx-cell.planning-today-scale--quarter {
    background: var(--planning-today-accent-soft) !important;
    background-color: var(--planning-today-accent-soft) !important;
  }

  .planning-svar-gantt-host--transparent .wx-scale .wx-cell.planning-weekend-scale--day:not(.planning-today-scale--day):not(.planning-holiday-scale--day) {
    background: var(--planning-weekend-soft) !important;
    background-color: var(--planning-weekend-soft) !important;
  }

  .planning-svar-gantt-host--transparent .wx-scale .wx-cell.planning-holiday-scale--day:not(.planning-today-scale--day) {
    background: var(--planning-holiday-soft) !important;
    background-color: var(--planning-holiday-soft) !important;
  }

  /* Quarter — wide month-range labels (July - September, …) */
  .planning-svar-gantt-host--zoom-quarter .wx-scale .wx-row:last-child .wx-cell,
  .planning-svar-gantt-host--zoom-quarter .wx-scale .wx-row:last-child .wx-cell-value {
    white-space: nowrap;
    letter-spacing: 0;
    text-transform: none;
    padding-inline: 6px;
  }

  /* Month — full month names on the fine scale row */
  .planning-svar-gantt-host--zoom-month .wx-scale .wx-row:last-child .wx-cell,
  .planning-svar-gantt-host--zoom-month .wx-scale .wx-row:last-child .wx-cell-value {
    white-space: nowrap;
    letter-spacing: 0;
    text-transform: none;
    padding-inline: 4px;
  }

  /* Day — weekday + date stacked in one scale cell (Sun / 01) */
  .planning-svar-gantt-host--zoom-day .wx-scale .wx-row:last-child .wx-cell,
  .planning-svar-gantt-host--zoom-day .wx-scale .wx-row:last-child .wx-cell-value {
    white-space: pre-line;
    text-align: center;
    line-height: 1.15;
    padding-block: 2px;
  }

  .planning-svar-gantt-host--zoom-day .wx-scale .wx-row:last-child .wx-cell-value {
    font-size: 10px !important;
    font-weight: 600 !important;
  }
`
