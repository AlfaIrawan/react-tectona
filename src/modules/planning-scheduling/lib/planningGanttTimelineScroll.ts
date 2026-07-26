import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { PlanningGanttZoomLevel } from './planningTodayHighlight'

export type TimelineBounds = { start: Date; end: Date }

export const TIMELINE_SCROLL_EDGE_THRESHOLD_PX = 160
export const TIMELINE_SCROLL_EXTEND_COOLDOWN_MS = 350

type TimelineExtension = { start?: Date; end?: Date }

type PendingScrollFix = {
  scrollLeft: number
  scrollWidth: number
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
): TimelineBounds {
  const [extension, setExtension] = useState<TimelineExtension>({})
  const extensionRef = useRef(extension)
  const baseWindowRef = useRef(baseWindow)
  const lastExtendAtRef = useRef(0)
  const pendingScrollFixRef = useRef<PendingScrollFix | null>(null)
  const zoomRef = useRef(zoom)

  useEffect(() => {
    extensionRef.current = extension
  }, [extension])

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

  const tryExtend = useCallback((chart: HTMLElement) => {
    const now = Date.now()
    if (now - lastExtendAtRef.current < TIMELINE_SCROLL_EXTEND_COOLDOWN_MS) return

    const currentZoom = zoomRef.current
    const bounds = mergeTimelineBounds(baseWindowRef.current, extensionRef.current)
    const maxEnd = maxTimelineEnd(baseWindowRef.current.end, currentZoom)
    const minStart = maxTimelineStart(baseWindowRef.current.start, currentZoom)

    if (isNearScrollRight(chart) && bounds.end.getTime() < maxEnd.getTime()) {
      const nextEnd = extendTimelineEnd(bounds.end, currentZoom)
      if (nextEnd.getTime() <= bounds.end.getTime()) return

      lastExtendAtRef.current = now
      setExtension((prev) => ({
        ...prev,
        end: new Date(Math.min(nextEnd.getTime(), maxEnd.getTime())),
      }))
      return
    }

    if (isNearScrollLeft(chart) && bounds.start.getTime() > minStart.getTime()) {
      const nextStart = extendTimelineStart(bounds.start, currentZoom)
      if (nextStart.getTime() >= bounds.start.getTime()) return

      pendingScrollFixRef.current = {
        scrollLeft: chart.scrollLeft,
        scrollWidth: chart.scrollWidth,
      }
      lastExtendAtRef.current = now
      setExtension((prev) => ({
        ...prev,
        start: new Date(Math.max(nextStart.getTime(), minStart.getTime())),
      }))
    }
  }, [])

  useLayoutEffect(() => {
    const fix = pendingScrollFixRef.current
    if (!fix) return

    const chart = findGanttChart(hostRef.current)
    if (!chart) return

    pendingScrollFixRef.current = null
    const addedWidth = chart.scrollWidth - fix.scrollWidth
    if (addedWidth > 0) {
      chart.scrollLeft = fix.scrollLeft + addedWidth
    }
  }, [activeWindow.start.getTime(), hostRef])

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

  return activeWindow
}
