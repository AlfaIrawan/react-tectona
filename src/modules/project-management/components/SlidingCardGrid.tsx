import { useCallback, useLayoutEffect, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Space kept free under the grid so the page's bottom edge is never cut off. */
export const SLIDING_GRID_BOTTOM_RESERVE_PX = 24
/** Blank space on each page lets selection rings and blurred shadows fade before the horizontal clip. */
export const SLIDING_GRID_SHADOW_BLEED_PX = 48
/** Height assumed before the first card has been measured. */
const FALLBACK_ROW_HEIGHT_PX = 220
/** Movement of the two fingers' midpoint before a swipe is recognised as horizontal. */
const SWIPE_START_PX = 8
/** A swipe past this share of the viewport width (and at least a minimum) turns the page. */
const SWIPE_COMMIT_RATIO = 0.15
const SWIPE_COMMIT_MIN_PX = 60
/** A trackpad flick turns one page; further flicks wait this long. */
const WHEEL_PAGE_LOCK_MS = 450
const WHEEL_COMMIT_PX = 40
const WHEEL_GESTURE_GAP_MS = 180

/** Normalize mouse wheels (including Shift+wheel) and trackpad horizontal movement. */
export function wheelPageDelta(event: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'ctrlKey' | 'metaKey'>, viewportHeight: number): number {
  if (event.ctrlKey || event.metaKey) return 0
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
  return delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewportHeight : 1)
}

function hasNestedWheelTarget(target: EventTarget | null, viewport: HTMLElement): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="spinbutton"]')) return true
  for (let node = target; node !== viewport && viewport.contains(node); node = node.parentElement!) {
    const style = getComputedStyle(node)
    if ((/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight)
        || (/(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth)) return true
  }
  return false
}

/** Columns at a viewport-based width, matching the grid breakpoints (md = 768px, lg = 1024px). */
export function columnsForWidth(width: number, listView: boolean): number {
  if (listView) return 1
  if (width >= 1024) return 4
  if (width >= 768) return 2
  return 1
}

export type SlidingLayout = {
  /** Whole rows of cards that fit in the space below the grid. */
  rowsFit: number
  /** Rows the full set of cards needs. */
  totalRows: number
  /** True when the full grid does not fit on screen: paging and sliding are then active. */
  sliding: boolean
  /** Cards per page (columns × rows that fit). */
  pageSize: number
  pageCount: number
}

/**
 * Measures the grid against the space it has. Sliding is only on when the whole grid is taller
 * than that space; otherwise every card is shown at once and there is no pager.
 */
export function gridAvailableLayoutHeight(input: { viewportHeight: number; top: number; renderedWidth: number; layoutWidth: number }): number {
  const scale = input.layoutWidth > 0 && input.renderedWidth > 0 ? input.renderedWidth / input.layoutWidth : 1
  return Math.max(0, input.viewportHeight - input.top - SLIDING_GRID_BOTTOM_RESERVE_PX) / scale
}

/** Keep decorative bleed inside the page scroller; it must never widen the scrollable page. */
export function gridShadowBleed(input: { left: number; right: number; renderedWidth: number; layoutWidth: number; boundaryLeft: number; boundaryRight: number }): number {
  const scale = input.layoutWidth > 0 && input.renderedWidth > 0 ? input.renderedWidth / input.layoutWidth : 1
  return Math.max(0, Math.min(SLIDING_GRID_SHADOW_BLEED_PX, (input.left - input.boundaryLeft) / scale, (input.boundaryRight - input.right) / scale))
}

export function slidingLayout(input: {
  itemCount: number; columns: number; rowHeight: number; rowHeights?: number[]; gap: number; availableHeight: number
}): SlidingLayout {
  const columns = Math.max(1, input.columns), gap = Math.max(0, input.gap)
  const totalRows = Math.ceil(input.itemCount / columns)
  const heights = Array.from({ length: totalRows }, (_, i) => Math.max(1, input.rowHeights?.[i] ?? input.rowHeight))
  const prefix = [0]
  for (const height of heights) prefix.push(prefix[prefix.length - 1] + height)
  const heightOf = (start: number, end: number) => prefix[end] - prefix[start] + Math.max(0, end - start - 1) * gap
  const fits = (height: number) => height <= input.availableHeight + 0.001
  const sliding = totalRows > 1 && !fits(heightOf(0, totalRows))
  let rowsFit = Math.max(1, totalRows)
  if (sliding) {
    rowsFit = 1
    // A uniform page size must fit every page, including later pages with taller cards.
    for (let rows = totalRows - 1; rows > 1; rows--) {
      let allFit = true
      for (let start = 0; start < totalRows; start += rows) if (!fits(heightOf(start, Math.min(totalRows, start + rows)))) { allFit = false; break }
      if (allFit) { rowsFit = rows; break }
    }
  }
  const pageSize = columns * rowsFit
  return { rowsFit, totalRows, sliding, pageSize, pageCount: sliding ? Math.ceil(input.itemCount / pageSize) : 1 }
}

type SlidingCardGridProps<T> = {
  items: T[]
  getKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  isListView?: boolean
  gap?: number
}

type Point = { x: number; y: number }
type Gesture = { startMid: Point; active: boolean }

export function SlidingCardGrid<T>({ items, getKey, renderItem, isListView = false, gap = 16 }: SlidingCardGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [availableHeight, setAvailableHeight] = useState(Number.POSITIVE_INFINITY)
  const [rowHeights, setRowHeights] = useState<number[]>([])
  const [page, setPage] = useState(0)
  const [dragOffset, setDragOffset] = useState(0)
  const [shadowBleed, setShadowBleed] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const dragOffsetRef = useRef(0)
  // Fingers currently on the viewport, by pointer id. A swipe is made by exactly two of them.
  const pointersRef = useRef(new Map<number, Point>())
  const gestureRef = useRef<Gesture | null>(null)
  const swipeEndedRef = useRef(false)
  const wheelLockedUntilRef = useRef(0)
  const wheelGestureRef = useRef({ delta: 0, lastAt: 0 })

  const measure = useCallback(() => {
    const element = containerRef.current
    if (!element) return
    const rect = element.getBoundingClientRect(), layoutWidth = element.clientWidth
    const scroller = element.closest<HTMLElement>('[data-app-main-body]')
    const boundary = scroller?.getBoundingClientRect()
    const scale = layoutWidth > 0 && rect.width > 0 ? rect.width / layoutWidth : 1
    const boundaryLeft = boundary ? boundary.left + (scroller?.clientLeft ?? 0) * scale : 0
    const boundaryRight = boundary ? boundaryLeft + scroller!.clientWidth * scale : window.innerWidth
    setShadowBleed(gridShadowBleed({ left: rect.left, right: rect.right, renderedWidth: rect.width, layoutWidth, boundaryLeft, boundaryRight }))
    setWidth(layoutWidth)
    setAvailableHeight(gridAvailableLayoutHeight({ viewportHeight: window.innerHeight, top: rect.top, renderedWidth: rect.width, layoutWidth }))
    const columns = columnsForWidth(layoutWidth, isListView)
    const cards = Array.from(element.querySelectorAll<HTMLElement>('[data-sliding-card]'))
    const heights: number[] = []
    for (let index = 0; index < cards.length; index += columns) heights.push(Math.max(...cards.slice(index, index + columns).map(card => card.offsetHeight || FALLBACK_ROW_HEIGHT_PX)))
    setRowHeights(current => current.length === heights.length && current.every((value, index) => value === heights[index]) ? current : heights)
  }, [isListView])

  // Also remeasure when surrounding panels move the grid without changing its own dimensions.
  useLayoutEffect(() => { measure() })

  const columns = columnsForWidth(width, isListView)
  const layout = slidingLayout({ itemCount: items.length, columns, rowHeight: FALLBACK_ROW_HEIGHT_PX, rowHeights, gap, availableHeight })

  useEffect(() => {
    let frame = 0
    const schedule = () => { window.cancelAnimationFrame(frame); frame = window.requestAnimationFrame(measure) }
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null
    if (observer && containerRef.current) {
      observer.observe(containerRef.current)
      for (const card of containerRef.current.querySelectorAll<HTMLElement>('[data-sliding-card]')) observer.observe(card)
    }
    return () => {
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [measure, items.length, layout.sliding, layout.pageSize])

  const currentPage = Math.min(page, Math.max(0, layout.pageCount - 1))
  const gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`

  useEffect(() => {
    const viewport = viewportRef.current
    if (!layout.sliding || !viewport) return
    // React wheel handlers are passive. Cancel native page scroll only when this
    // grid can consume the gesture; release it at either end and for nested controls.
    const handleWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || isSwiping || hasNestedWheelTarget(event.target, viewport)) return
      const delta = wheelPageDelta(event, viewport.clientHeight)
      if (!delta) return
      const now = Date.now()
      if (now < wheelLockedUntilRef.current) {
        event.preventDefault()
        return
      }
      const next = currentPage + Math.sign(delta)
      if (next < 0 || next >= layout.pageCount) {
        wheelGestureRef.current.delta = 0
        return
      }
      event.preventDefault()
      const gesture = wheelGestureRef.current
      if (now - gesture.lastAt > WHEEL_GESTURE_GAP_MS || Math.sign(gesture.delta) !== Math.sign(delta)) gesture.delta = 0
      gesture.delta += delta
      gesture.lastAt = now
      if (Math.abs(gesture.delta) < WHEEL_COMMIT_PX) return
      gesture.delta = 0
      wheelLockedUntilRef.current = now + WHEEL_PAGE_LOCK_MS
      setPage(next)
    }
    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [currentPage, layout.pageCount, layout.sliding, isSwiping])

  const goToPage = (next: number) => {
    setPage(Math.min(Math.max(0, next), Math.max(0, layout.pageCount - 1)))
  }

  const midpoint = (): Point => {
    const [first, second] = Array.from(pointersRef.current.values())
    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
  }

  // Two fingers start a swipe. A single finger keeps its normal job: a click, or a drag of the card.
  // Mouse is left alone too, since a mouse drag belongs to drag-and-drop.
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') return
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointersRef.current.size === 2) {
      swipeEndedRef.current = false
      gestureRef.current = { startMid: midpoint(), active: false }
    } else if (pointersRef.current.size > 2) {
      gestureRef.current = null
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const gesture = gestureRef.current
    if (!gesture || pointersRef.current.size !== 2) return
    const mid = midpoint()
    const dx = mid.x - gesture.startMid.x
    const dy = mid.y - gesture.startMid.y
    if (!gesture.active) {
      // Two fingers moving up or down is the page scrolling; leave it alone.
      if (Math.abs(dy) > SWIPE_START_PX && Math.abs(dy) > Math.abs(dx)) {
        gestureRef.current = null
        return
      }
      if (Math.abs(dx) < SWIPE_START_PX || Math.abs(dx) < Math.abs(dy)) return
      gesture.active = true
      setIsSwiping(true)
    }
    // Resist at the first and last page, so the grid does not drag past its ends.
    const atStart = currentPage === 0 && dx > 0
    const atEnd = currentPage >= layout.pageCount - 1 && dx < 0
    const offset = atStart || atEnd ? dx * 0.3 : dx
    dragOffsetRef.current = offset
    setDragOffset(offset)
  }

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId)
    const gesture = gestureRef.current
    // The swipe ends as soon as one of its two fingers lifts.
    if (!gesture || pointersRef.current.size >= 2) return
    gestureRef.current = null
    if (!gesture.active) return
    swipeEndedRef.current = true
    setIsSwiping(false)
    const offset = dragOffsetRef.current
    const threshold = Math.max(SWIPE_COMMIT_MIN_PX, (viewportRef.current?.clientWidth ?? 0) * SWIPE_COMMIT_RATIO)
    if (offset <= -threshold) goToPage(currentPage + 1)
    else if (offset >= threshold) goToPage(currentPage - 1)
    dragOffsetRef.current = 0
    setDragOffset(0)
  }

  // A two-finger swipe must not also click the card it started on.
  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (swipeEndedRef.current) {
      swipeEndedRef.current = false
      event.stopPropagation()
      event.preventDefault()
    }
  }

  if (!layout.sliding) {
    return (
      <div ref={containerRef}>
        <div className="grid" style={{ gridTemplateColumns, gap }}>
          {items.map((item) => (
            <div key={getKey(item)} data-sliding-card className="min-w-0">
              {renderItem(item)}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const pages: T[][] = []
  for (let index = 0; index < items.length; index += layout.pageSize) {
    pages.push(items.slice(index, index + layout.pageSize))
  }
  const firstShown = currentPage * layout.pageSize + 1
  const lastShown = Math.min(items.length, (currentPage + 1) * layout.pageSize)

  return (
    <div ref={containerRef} className="space-y-3">
      <div
        ref={viewportRef}
        // Clip neighboring pages horizontally while letting card shadows fade vertically.
        className="overflow-x-clip overflow-y-visible"
        // Vertical scrolling stays native; the two-finger horizontal swipe is handled here.
        style={{ touchAction: 'pan-y', marginInline: -shadowBleed, width: `calc(100% + ${shadowBleed * 2}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClickCapture={handleClickCapture}
      >
        <div
          className={isSwiping ? 'flex' : 'flex transition-transform duration-300 ease-out motion-reduce:transition-none'}
          style={{
            width: `${layout.pageCount * 100}%`,
            transform: `translateX(calc(-${(currentPage * 100) / layout.pageCount}% + ${dragOffset}px))`,
          }}
        >
          {pages.map((pageItems, pageIndex) => (
            <div
              key={pageIndex}
              className="grid min-w-0 shrink-0 content-start"
              style={{ width: `${100 / layout.pageCount}%`, gridTemplateColumns, gap, paddingInline: shadowBleed }}
              aria-hidden={pageIndex !== currentPage}
            >
              {pageItems.map((item) => (
                <div key={getKey(item)} data-sliding-card className="min-w-0">
                  {renderItem(item)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground tabular-nums">
          {firstShown}–{lastShown} of {items.length} · Page {currentPage + 1} of {layout.pageCount}
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Previous page"
            disabled={currentPage === 0}
            onClick={() => goToPage(currentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Next page"
            disabled={currentPage >= layout.pageCount - 1}
            onClick={() => goToPage(currentPage + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
