import * as React from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function toDate(iso: string | null): Date | null {
  if (!iso) return null
  const d = new Date(iso + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}

function toISO(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isToday(d: Date): boolean {
  const t = new Date()
  return isSameDay(d, t)
}

function buildMonthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startDow = first.getDay()
  const daysInMonth = last.getDate()
  const rows: (Date | null)[][] = []
  let row: (Date | null)[] = []
  // leading empty cells
  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, month, 1 - (startDow - i))
    row.push(d)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    row.push(new Date(year, month, day))
    if (row.length === 7) {
      rows.push(row)
      row = []
    }
  }
  if (row.length) {
    let nextDay = 1
    while (row.length < 7) {
      row.push(new Date(year, month + 1, nextDay++))
    }
    rows.push(row)
  }
  return rows
}

export interface DatePickerPopupProps {
  value: string | null
  onChange: (value: string | null) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Reference element to position the popup relative to */
  anchorEl?: HTMLElement | null
}

export function DatePickerPopup({
  value,
  onChange,
  open,
  onOpenChange,
  anchorEl,
}: DatePickerPopupProps) {
  const valueDate = toDate(value)
  const [viewDate, setViewDate] = React.useState<Date>(() => valueDate ?? new Date())
  const [isAnimating, setIsAnimating] = React.useState(false)
  const [isMonthTransitioning, setIsMonthTransitioning] = React.useState(false)
  const popupRef = React.useRef<HTMLDivElement>(null)
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null)

  React.useEffect(() => {
    if (valueDate) setViewDate(valueDate)
  }, [value])

  // Calculate position when open or anchor changes
  React.useEffect(() => {
    if (!open || !anchorEl) {
      setPosition(null)
      return
    }

    const updatePosition = () => {
      const rect = anchorEl.getBoundingClientRect()
      const popupWidth = 320
      const popupHeight = 380
      const spacing = 8

      let left = rect.left
      let top = rect.bottom + spacing

      // Adjust if would overflow right
      if (left + popupWidth > window.innerWidth - 16) {
        left = window.innerWidth - popupWidth - 16
      }

      // Adjust if would overflow bottom (show above instead)
      if (top + popupHeight > window.innerHeight - 16) {
        top = rect.top - popupHeight - spacing
      }

      // Ensure minimum left margin
      if (left < 16) left = 16

      setPosition({ top, left })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, anchorEl])

  // Animation on open
  React.useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        setIsAnimating(true)
      })
    } else {
      setIsAnimating(false)
    }
  }, [open])

  // Close on click outside
  React.useEffect(() => {
    if (!open) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        anchorEl &&
        !anchorEl.contains(e.target as Node)
      ) {
        onOpenChange(false)
      }
    }

    // Delay to avoid immediate close when opening
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, anchorEl, onOpenChange])

  // Close on Escape
  React.useEffect(() => {
    if (!open) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onOpenChange])

  const prevMonth = () => {
    setIsMonthTransitioning(true)
    setTimeout(() => {
      setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1))
      setIsMonthTransitioning(false)
    }, 150)
  }
  const nextMonth = () => {
    setIsMonthTransitioning(true)
    setTimeout(() => {
      setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1))
      setIsMonthTransitioning(false)
    }, 150)
  }
  const goToday = () => {
    const t = new Date()
    setViewDate(t)
    onChange(toISO(t))
    onOpenChange(false)
  }
  const clear = () => {
    onChange(null)
    onOpenChange(false)
  }

  const handleDateClick = (d: Date) => {
    onChange(toISO(d))
    onOpenChange(false)
  }

  const grid = React.useMemo(
    () => buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate.getFullYear(), viewDate.getMonth()]
  )
  const currentMonth = viewDate.getMonth()

  if (!open || !position) return null

  const popupContent = (
    <div
      ref={popupRef}
      className={cn(
        'fixed z-[2000] bg-white rounded-2xl border border-slate-200',
        'transition-all duration-200 ease-out',
        isAnimating
          ? 'opacity-100 scale-100 translate-y-0'
          : 'opacity-0 scale-95 translate-y-1'
      )}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: '320px',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.03)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-5">
        <div className="flex items-baseline gap-2">
          <span className={cn(
            'text-base font-semibold text-slate-900 transition-opacity duration-150',
            isMonthTransitioning && 'opacity-50'
          )}>
            {MONTHS[viewDate.getMonth()]}
          </span>
          <span className={cn(
            'text-base font-normal text-slate-500 transition-opacity duration-150',
            isMonthTransitioning && 'opacity-50'
          )}>
            {viewDate.getFullYear()}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all duration-150 active:scale-95"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all duration-150 active:scale-95"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday row */}
      <div className="grid grid-cols-7 gap-0 px-6 pb-3">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-medium text-slate-400 uppercase tracking-[0.05em] py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="px-6 pb-5">
        <div className={cn(
          'grid grid-cols-7 gap-1.5 transition-opacity duration-150',
          isMonthTransitioning && 'opacity-50'
        )}>
          {grid.flat().map((d, i) => {
            if (!d) return <div key={i} />
            const isCurrentMonth = d.getMonth() === currentMonth
            const selected = valueDate && isSameDay(d, valueDate)
            const today = isToday(d)

            return (
              <button
                key={d.getTime()}
                type="button"
                onClick={() => handleDateClick(d)}
                className={cn(
                  'aspect-square flex items-center justify-center text-sm font-normal rounded-[10px]',
                  'transition-all duration-150 ease-out',
                  'min-w-0',
                  isCurrentMonth ? 'text-slate-900' : 'text-slate-300',
                  selected
                    ? 'bg-slate-900 text-white shadow-sm hover:bg-slate-800'
                    : 'hover:bg-slate-50 hover:scale-[1.05] active:scale-[0.98]',
                  today && !selected && 'ring-1 ring-slate-300'
                )}
              >
                {d.getDate()}
              </button>
            )
          })}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="flex items-center justify-between px-6 pb-5 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={clear}
          className="text-xs font-normal text-slate-500 hover:text-slate-700 transition-colors duration-150 px-2 py-1.5 -mx-2 rounded-md hover:bg-slate-50 active:scale-[0.98]"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={goToday}
          className="text-xs font-normal text-slate-500 hover:text-slate-700 transition-colors duration-150 px-2 py-1.5 -mx-2 rounded-md hover:bg-slate-50 active:scale-[0.98]"
        >
          Today
        </button>
      </div>
    </div>
  )

  return createPortal(popupContent, document.body)
}
