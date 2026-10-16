import { useCallback, useLayoutEffect, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Space kept free under the grid so the page's bottom edge is never cut off. */
export const SLIDING_GRID_BOTTOM_RESERVE_PX = 24
/** Height assumed before the first card has been measured. */
const FALLBACK_ROW_HEIGHT_PX = 220

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
export function slidingLayout(input: {
  itemCount: number
  columns: number
  rowHeight: number
  gap: number
  availableHeight: number
}): SlidingLayout {
  const { itemCount, columns, rowHeight, gap, availableHeight } = input
  const rowStep = Math.max(1, rowHeight + gap)
  const rowsFit = Math.max(1, Math.floor((availableHeight + gap) / rowStep))
  const totalRows = Math.ceil(itemCount / Math.max(1, columns))
  const sliding = totalRows > rowsFit
  const pageSize = Math.max(1, columns) * rowsFit
  const pageCount = sliding ? Math.ceil(itemCount / pageSize) : 1
  return { rowsFit, totalRows, sliding, pageSize, pageCount }
}

type SlidingCardGridProps<T> = {
  items: T[]
  getKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  isListView?: boolean
  gap?: number
}

export function SlidingCardGrid<T>({ items, getKey, renderItem, isListView = false, gap = 16 }: SlidingCardGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [availableHeight, setAvailableHeight] = useState(Number.POSITIVE_INFINITY)
  const [rowHeight, setRowHeight] = useState(FALLBACK_ROW_HEIGHT_PX)
  const [page, setPage] = useState(0)

  const measure = useCallback(() => {
    const element = containerRef.current
    if (!element) return
    setWidth(element.clientWidth)
    const top = element.getBoundingClientRect().top
    setAvailableHeight(Math.max(0, window.innerHeight - top - SLIDING_GRID_BOTTOM_RESERVE_PX))
    // The tallest card of the first row stands for a row.
    const firstRow = Array.from(element.querySelectorAll<HTMLElement>('[data-sliding-card]')).slice(0, 4)
    if (firstRow.length > 0) {
      setRowHeight(Math.max(...firstRow.map((card) => card.offsetHeight)) || FALLBACK_ROW_HEIGHT_PX)
    }
  }, [])

  useLayoutEffect(() => {
    measure()
  }, [measure, items.length, isListView])

  useEffect(() => {
    window.addEventListener('resize', measure)
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (observer && containerRef.current) observer.observe(containerRef.current)
    return () => {
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [measure])

  const columns = columnsForWidth(width, isListView)
  const layout = slidingLayout({ itemCount: items.length, columns, rowHeight, gap, availableHeight })
  const currentPage = Math.min(page, Math.max(0, layout.pageCount - 1))
  const gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`

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
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{
            width: `${layout.pageCount * 100}%`,
            transform: `translateX(-${(currentPage * 100) / layout.pageCount}%)`,
          }}
        >
          {pages.map((pageItems, pageIndex) => (
            <div
              key={pageIndex}
              className="grid min-w-0 shrink-0 content-start"
              style={{ width: `${100 / layout.pageCount}%`, gridTemplateColumns, gap }}
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
            onClick={() => setPage(Math.max(0, currentPage - 1))}
          >
            <ChevronLeft className={cn('h-4 w-4')} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Next page"
            disabled={currentPage >= layout.pageCount - 1}
            onClick={() => setPage(Math.min(layout.pageCount - 1, currentPage + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
