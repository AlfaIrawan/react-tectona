import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { PlanningGanttZoomLevel } from './planningTodayHighlight'

export type TimelineScrollExtensionDirection = 'both' | 'forward'

/** `month` = +1 calendar month per edge hit (paged timeline). `default` = zoom-sized chunks. */
export type TimelineScrollExtensionStep = 'default' | 'month'

export type TimelineBounds = { start: Date; end: Date }

export type TimelinePagingViewportState = {
  windowStart: Date
  windowEnd: Date
  viewportStart: Date
  viewportEnd: Date
  canExtendForward: boolean
  atRightEdge: boolean
}

export type TimelineScrollExtensionResult = {
  activeWindow: TimelineBounds
  canExtendForward: boolean
  extendForwardMonth: () => boolean
}

export const TIMELINE_SCROLL_EDGE_THRESHOLD_PX = 48
export const TIMELINE_SCROLL_EXTEND_COOLDOWN_MS = 900

type TimelineExtension = { start?: Date; end?: Date }

type PendingScrollFix =
  | {
      kind: 'prepend'
      scrollLeft: number
      scrollWidth: number
    }
  | {
      kind: 'append'
      scrollLeft: number
      scrollWidth: number
      /** After extend, scroll to show the newly appended range (toolbar “Next month”). */
      revealNewMonth?: boolean
    }

export function mergeTimelineBounds(
  base: TimelineBounds,
  extension: TimelineExtension,
): TimelineBounds {
  return {
    start:
      extension.start && extension.start.getTime() < base.start.getTime()
        ? extension.start
        : base.start,
    end:
      extension.end && extension.end.getTime() > base.end.getTime() ? extension.end : base.end,
  }
}

export function extendTimelineEndByMonths(currentEnd: Date, months: number): Date {
  const year = currentEnd.getUTCFullYear()
  const month = currentEnd.getUTCMonth()
  const day = currentEnd.getUTCDate()
  return new Date(Date.UTC(year, month + months, day))
}

export function extendTimelineEndByYears(currentEnd: Date, years: number): Date {
  const year = currentEnd.getUTCFullYear()
  const month = currentEnd.getUTCMonth()
  const day = currentEnd.getUTCDate()
  return new Date(Date.UTC(year + years, month, day))
}

export function extendTimelineEnd(currentEnd: Date, zoom: PlanningGanttZoomLevel): Date {
  const year = currentEnd.getUTCFullYear()
  const month = currentEnd.getUTCMonth()
  const day = currentEnd.getUTCDate()

  switch (zoom) {
    case 'Quarter':
      return new Date(Date.UTC(year, month + 24, day))
    case 'Month':
      return new Date(Date.UTC(year, month + 12, 0))
    case 'Week':
      return new Date(currentEnd.getTime() + 26 * 7 * 86_400_000)
    case 'Day':
      return new Date(currentEnd.getTime() + 60 * 86_400_000)
    default:
      return new Date(currentEnd.getTime() + 30 * 86_400_000)
  }
}

export function extendTimelineStart(currentStart: Date, zoom: PlanningGanttZoomLevel): Date {
  const year = currentStart.getUTCFullYear()
  const month = currentStart.getUTCMonth()
  const day = currentStart.getUTCDate()

  switch (zoom) {
    case 'Quarter':
      return new Date(Date.UTC(year, month - 24, day))
    case 'Month':
      return new Date(Date.UTC(year, month - 12, 1))
    case 'Week':
      return new Date(currentStart.getTime() - 26 * 7 * 86_400_000)
    case 'Day':
      return new Date(currentStart.getTime() - 60 * 86_400_000)
    default:
      return new Date(currentStart.getTime() - 30 * 86_400_000)
  }
}

/** Hard cap so Day view stays responsive; coarse zooms allow multi-year exploration. */
export function maxTimelineEnd(initialEnd: Date, zoom: PlanningGanttZoomLevel): Date {
  const cap = new Date(initialEnd)
  switch (zoom) {
    case 'Day':
      cap.setUTCDate(cap.getUTCDate() + 365)
      break
    case 'Week':
      cap.setUTCMonth(cap.getUTCMonth() + 36)
      break
    case 'Month':
      cap.setUTCFullYear(cap.getUTCFullYear() + 10)
      break
    case 'Quarter':
      cap.setUTCFullYear(cap.getUTCFullYear() + 15)
      break
    default:
      cap.setUTCFullYear(cap.getUTCFullYear() + 5)
  }
  return cap
}

export function formatTimelinePagingRange(start: Date, end: Date): string {
  const monthYear: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric', timeZone: 'UTC' }
  const monthOnly: Intl.DateTimeFormatOptions = { month: 'short', timeZone: 'UTC' }
  const startYear = start.getUTCFullYear()
  const startMonth = start.getUTCMonth()
  const endYear = end.getUTCFullYear()
  const endMonth = end.getUTCMonth()

  if (startYear === endYear && startMonth === endMonth) {
    return new Intl.DateTimeFormat('en-US', monthYear).format(start)
  }
  if (startYear === endYear) {
    const left = new Intl.DateTimeFormat('en-US', monthOnly).format(start)
    const right = new Intl.DateTimeFormat('en-US', monthYear).format(end)
    return `${left} – ${right}`
  }
  const left = new Intl.DateTimeFormat('en-US', monthYear).format(start)
  const right = new Intl.DateTimeFormat('en-US', monthYear).format(end)
  return `${left} – ${right}`
}

export function shouldPublishTimelinePaging(
  previous: TimelinePagingViewportState | null,
  next: TimelinePagingViewportState | null,
): boolean {
  if (previous === next) return false
  if (!previous || !next) return true
  if (previous.canExtendForward !== next.canExtendForward) return true
  if (previous.atRightEdge !== next.atRightEdge) return true

  const dayMs = 86_400_000
  if (
    Math.floor(previous.viewportStart.getTime() / dayMs) !==
    Math.floor(next.viewportStart.getTime() / dayMs)
  ) {
    return true
  }
  if (
    Math.floor(previous.viewportEnd.getTime() / dayMs) !==
    Math.floor(next.viewportEnd.getTime() / dayMs)
  ) {
    return true
  }
  return false
}

export function maxTimelineStart(initialStart: Date, zoom: PlanningGanttZoomLevel): Date {
  const cap = new Date(initialStart)
  switch (zoom) {
    case 'Day':
      cap.setUTCDate(cap.getUTCDate() - 365)
      break
    case 'Week':
      cap.setUTCMonth(cap.getUTCMonth() - 36)
      break
    case 'Month':
      cap.setUTCFullYear(cap.getUTCFullYear() - 10)
      break
    case 'Quarter':
      cap.setUTCFullYear(cap.getUTCFullYear() - 15)
      break
    default:
      cap.setUTCFullYear(cap.getUTCFullYear() - 5)
  }
  return cap
}

function isNearScrollRight(chart: HTMLElement): boolean {
  const remaining = chart.scrollWidth - chart.scrollLeft - chart.clientWidth
  return remaining <= TIMELINE_SCROLL_EDGE_THRESHOLD_PX
}

function isNearScrollLeft(chart: HTMLElement): boolean {
  return chart.scrollLeft <= TIMELINE_SCROLL_EDGE_THRESHOLD_PX
}

function findGanttChart(host: HTMLElement | null): HTMLElement | null {
  return host?.querySelector<HTMLElement>('.wx-chart') ?? null
}

export { findGanttChart }

/**
 * Extends timeline start/end while the user scrolls near the chart edges.
 * Returns the active window passed to `<Gantt start={…} end={…} />`.
 */
export function useTimelineScrollExtension(
  hostRef: RefObject<HTMLDivElement | null>,
  baseWindow: TimelineBounds,
  zoom: PlanningGanttZoomLevel,
  enabled: boolean,
  bindScrollRef?: RefObject<(() => void) | null>,
  direction: TimelineScrollExtensionDirection = 'both',
  step: TimelineScrollExtensionStep = 'default',
): TimelineScrollExtensionResult {
  const [extension, setExtension] = useState<TimelineExtension>({})
  const extensionRef = useRef(extension)
  const baseWindowRef = useRef(baseWindow)
  const lastExtendAtRef = useRef(0)
  const pendingScrollFixRef = useRef<PendingScrollFix | null>(null)
  const scrollExtendLockedRef = useRef(false)
  const zoomRef = useRef(zoom)
  const directionRef = useRef(direction)
  const stepRef = useRef(step)

  useEffect(() => {
    extensionRef.current = extension
  }, [extension])

  useEffect(() => {
    directionRef.current = direction
  }, [direction])

  useEffect(() => {
    stepRef.current = step
  }, [step])

  useEffect(() => {
    baseWindowRef.current = baseWindow
    zoomRef.current = zoom
    setExtension({})
    pendingScrollFixRef.current = null
  }, [baseWindow.end.getTime(), baseWindow.start.getTime(), zoom])

  const activeWindow = useMemo(
    () => mergeTimelineBounds(baseWindow, extension),
    [baseWindow, extension],
  )

  const canExtendForward = useMemo(() => {
    const maxEnd = maxTimelineEnd(baseWindow.end, zoom)
    return activeWindow.end.getTime() < maxEnd.getTime()
  }, [activeWindow.end, baseWindow.end, zoom])

  const applyForwardExtension = useCallback(
    (chart: HTMLElement | null, revealNewMonth: boolean): boolean => {
      if (scrollExtendLockedRef.current) return false

      const now = Date.now()
      if (now - lastExtendAtRef.current < TIMELINE_SCROLL_EXTEND_COOLDOWN_MS) return false

      const currentZoom = zoomRef.current
      const bounds = mergeTimelineBounds(baseWindowRef.current, extensionRef.current)
      const maxEnd = maxTimelineEnd(baseWindowRef.current.end, currentZoom)
      if (bounds.end.getTime() >= maxEnd.getTime()) return false

      const nextEnd =
        stepRef.current === 'month'
          ? extendTimelineEndByMonths(bounds.end, 1)
          : extendTimelineEnd(bounds.end, currentZoom)
      if (nextEnd.getTime() <= bounds.end.getTime()) return false

      scrollExtendLockedRef.current = true
      pendingScrollFixRef.current = {
        kind: 'append',
        scrollLeft: chart && chart.scrollWidth > 0 ? chart.scrollLeft : 0,
        scrollWidth: chart && chart.scrollWidth > 0 ? chart.scrollWidth : 0,
        revealNewMonth,
      }

      lastExtendAtRef.current = now
      setExtension((prev) => ({
        ...prev,
        end: new Date(Math.min(nextEnd.getTime(), maxEnd.getTime())),
      }))
      return true
    },
    [],
  )

  const extendForwardMonth = useCallback((): boolean => {
    if (!enabled) return false
    return applyForwardExtension(findGanttChart(hostRef.current), true)
  }, [applyForwardExtension, enabled, hostRef])

  const tryExtend = useCallback((chart: HTMLElement) => {
    // Paged month timelines extend only via the toolbar button — edge auto-extend
    // fights SVAR scroll restoration and reads as a bounce loop at the right edge.
    if (stepRef.current === 'month') return
    if (scrollExtendLockedRef.current) return
    // The underlying @svar-ui/react-gantt chart element gets torn down and recreated on certain
    // interactions (confirmed live: clicking the Previous/Next period button re-binds the scroll
    // listener to a NEW element), and a stray 'scroll' event can fire on the brand-new element
    // before the browser has laid it out — at that instant `scrollWidth`/`clientWidth` both read
    // as 0. With everything zero, `isNearScrollLeft`/`isNearScrollRight` both evaluate true (0 <=
    // threshold), which can kick off a bogus extension with a nonsense compensation width later —
    // a real contributor to the reported scroll "jolt". Ignore scroll events from an element that
    // hasn't been laid out yet; a genuinely resized-to-nothing chart isn't scrollable anyway, so
    // there's nothing legitimate to extend for in that state either.
    if (chart.clientWidth === 0 || chart.scrollWidth === 0) return

    const now = Date.now()
    if (now - lastExtendAtRef.current < TIMELINE_SCROLL_EXTEND_COOLDOWN_MS) return

    const currentZoom = zoomRef.current
    const bounds = mergeTimelineBounds(baseWindowRef.current, extensionRef.current)
    const maxEnd = maxTimelineEnd(baseWindowRef.current.end, currentZoom)
    const minStart = maxTimelineStart(baseWindowRef.current.start, currentZoom)

    if (isNearScrollRight(chart) && bounds.end.getTime() < maxEnd.getTime()) {
      applyForwardExtension(chart, false)
    }

    if (
      directionRef.current !== 'forward' &&
      isNearScrollLeft(chart) &&
      bounds.start.getTime() > minStart.getTime()
    ) {
      const nextStart = extendTimelineStart(bounds.start, currentZoom)
      if (nextStart.getTime() >= bounds.start.getTime()) return

      pendingScrollFixRef.current = {
        kind: 'prepend',
        scrollLeft: chart.scrollLeft,
        scrollWidth: chart.scrollWidth,
      }
      lastExtendAtRef.current = now
      setExtension((prev) => ({
        ...prev,
        start: new Date(Math.max(nextStart.getTime(), minStart.getTime())),
      }))
    }
  }, [applyForwardExtension])

  useLayoutEffect(() => {
    const fix = pendingScrollFixRef.current
    if (!fix) return
    pendingScrollFixRef.current = null

    const chart = findGanttChart(hostRef.current)
    if (!chart) return

    if (fix.kind === 'append') {
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const maxScroll = Math.max(0, chart.scrollWidth - chart.clientWidth)
          const addedWidth = chart.scrollWidth - fix.scrollWidth

          if (fix.revealNewMonth) {
            chart.scrollLeft = Math.max(0, maxScroll - 48)
          } else if (addedWidth > 0 && chart.scrollLeft < Math.max(16, fix.scrollLeft * 0.2)) {
            chart.scrollLeft = Math.min(maxScroll, fix.scrollLeft + addedWidth)
          } else if (addedWidth > 0) {
            chart.scrollLeft = Math.min(maxScroll, fix.scrollLeft + addedWidth)
          } else {
            chart.scrollLeft = fix.scrollLeft
          }

          scrollExtendLockedRef.current = false
        })
      })
      return () => {
        cancelAnimationFrame(raf)
        scrollExtendLockedRef.current = false
      }
    }

    // The underlying @svar-ui/react-gantt chart does not reflow to the new `start`/`end` window
    // synchronously within this same React commit (this file's `scheduleGanttVisualSync` relies
    // on the same one-frame delay elsewhere, for the same reason) — reading `chart.scrollWidth`
    // right here would still see the PRE-extension width, so `addedWidth` under-counts (often to
    // 0) and the compensating scrollLeft adjustment falls short. That under-correction is exactly
    // what reads as the timeline suddenly "jumping backward" when scrolling left near the edge:
    // new (earlier) days get prepended, but the viewport isn't shifted right enough to compensate,
    // so it now shows earlier content than before the scroll. Deferring one frame lets the chart
    // actually expand first, so `scrollWidth` reflects the real added width.
    //
    // Deferring alone still lets the browser PAINT one frame of the chart already expanded but NOT
    // yet re-centered (confirmed live: this is what read as a visible "jolt/flicker" mid-scroll,
    // even though the position was correct one frame later). Hiding the chart for that single frame
    // and revealing it only once the corrected scrollLeft is applied means the user never sees the
    // in-between frame at all — the correction still happens, it's just never visible. The reveal
    // is guaranteed on every exit path (rAF fires normally, chart goes missing, or the effect gets
    // cleaned up before the rAF runs) so the chart can never get stuck hidden.
    chart.style.visibility = 'hidden'

    const raf = requestAnimationFrame(() => {
      const addedWidth = chart.scrollWidth - fix.scrollWidth
      if (addedWidth > 0) {
        chart.scrollLeft = fix.scrollLeft + addedWidth
      }
      chart.style.visibility = ''
      scrollExtendLockedRef.current = false
    })
    return () => {
      cancelAnimationFrame(raf)
      chart.style.visibility = ''
      scrollExtendLockedRef.current = false
    }
  }, [activeWindow.end.getTime(), activeWindow.start.getTime(), hostRef])

  useEffect(() => {
    if (!enabled) {
      if (bindScrollRef) bindScrollRef.current = null
      return undefined
    }

    let chart: HTMLElement | null = null
    let onScroll: (() => void) | undefined

    const bind = () => {
      const next = findGanttChart(hostRef.current)
      if (!next) return
      if (next === chart && onScroll) return

      if (chart && onScroll) {
        chart.removeEventListener('scroll', onScroll)
      }

      chart = next
      onScroll = () => tryExtend(chart!)
      chart.addEventListener('scroll', onScroll, { passive: true })
    }

    if (bindScrollRef) {
      bindScrollRef.current = bind
    }

    bind()

    return () => {
      if (bindScrollRef) {
        bindScrollRef.current = null
      }
      if (chart && onScroll) {
        chart.removeEventListener('scroll', onScroll)
      }
    }
  }, [bindScrollRef, enabled, hostRef, tryExtend, zoom])

  return { activeWindow, canExtendForward, extendForwardMonth }
}
