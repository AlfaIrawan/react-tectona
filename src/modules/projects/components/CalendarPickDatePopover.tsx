import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  buildMonthGridCells,
  formatCalendarDayKey,
  formatCalendarMonthLabel,
  isSameCalendarDay,
  parseCalendarIsoDate,
} from '../lib/buildProjectCalendarEvents'

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const
const POPOVER_WIDTH = 280
const POPOVER_HEIGHT = 320

function resolvePickDatePopoverPosition(anchorRect: DOMRect) {
  const padding = 12
  const gap = 8

  let left = anchorRect.left + anchorRect.width / 2 - POPOVER_WIDTH / 2
  let top = anchorRect.bottom + gap

  if (left + POPOVER_WIDTH > window.innerWidth - padding) {
    left = window.innerWidth - POPOVER_WIDTH - padding
  }
  if (left < padding) left = padding

  if (top + POPOVER_HEIGHT > window.innerHeight - padding) {
    top = anchorRect.top - POPOVER_HEIGHT - gap
  }
  if (top < padding) top = padding

  return { left, top, width: POPOVER_WIDTH }
}

export function CalendarPickDatePopover({
  anchorEl,
  initialDayKey,
  onClose,
  onSelect,
}: {
  anchorEl: HTMLElement
  initialDayKey: string
  onClose: () => void
  onSelect: (dayKey: string) => void
}) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const initialDate = parseCalendarIsoDate(initialDayKey)
  const [viewYear, setViewYear] = useState(initialDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth())
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null)

  const today = useMemo(() => new Date(), [])
  const todayKey = formatCalendarDayKey(today)
  const monthCells = useMemo(() => buildMonthGridCells(viewYear, viewMonth), [viewYear, viewMonth])

  const updatePosition = () => {
    if (!anchorEl.isConnected) return
    setPosition(resolvePickDatePopoverPosition(anchorEl.getBoundingClientRect()))
  }

  useLayoutEffect(() => {
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorEl, initialDayKey])

  useEffect(() => {
    const openedAt = Date.now()
    const closeIfOutside = (event: MouseEvent) => {
      if (Date.now() - openedAt < 120) return
      const target = event.target as Node
      if (popoverRef.current?.contains(target)) return
      onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', closeIfOutside)
    document.addEventListener('click', closeIfOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', closeIfOutside)
      document.removeEventListener('click', closeIfOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  if (!position) return null

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Pick date"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: position.width,
        zIndex: 110,
      }}
      className="overflow-hidden rounded-xl border border-border/50 bg-white shadow-2xl backdrop-blur-xl dark:bg-slate-950"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
          aria-label="Previous month"
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-semibold text-foreground">
          {formatCalendarMonthLabel(viewYear, viewMonth)}
        </div>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
          aria-label="Next month"
          onClick={() => shiftMonth(1)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0 border-b border-border/40 px-2 py-1.5">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0 px-2 py-2">
        {monthCells.map((cell) => {
          const isSelected = cell.dayKey === initialDayKey
          const isToday = isSameCalendarDay(cell.date, today)
          return (
            <button
              key={cell.dayKey}
              type="button"
              className={cn(
                'mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs transition',
                cell.inCurrentMonth ? 'text-foreground' : 'text-muted-foreground/45',
                isSelected && 'bg-primary text-primary-foreground hover:bg-primary',
                !isSelected && isToday && 'ring-1 ring-primary/40',
                !isSelected && 'hover:bg-muted/70',
              )}
              onClick={() => onSelect(cell.dayKey)}
            >
              {cell.date.getDate()}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-end border-t border-border/60 px-3 py-2">
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs font-medium text-primary transition hover:bg-primary/10"
          onClick={() => onSelect(todayKey)}
        >
          Today
        </button>
      </div>
    </div>,
    document.body,
  )
}
