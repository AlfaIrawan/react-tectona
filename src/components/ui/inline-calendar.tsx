import * as React from 'react'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
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

function formatDisplay(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
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

export interface InlineCalendarProps {
  value: string | null
  onChange: (value: string | null) => void
  className?: string
  /** When true, calendar starts expanded */
  defaultExpanded?: boolean
}

export function InlineCalendar({
  value,
  onChange,
  className,
  defaultExpanded = false,
}: InlineCalendarProps) {
  const valueDate = toDate(value)
  const [viewDate, setViewDate] = React.useState<Date>(() => valueDate ?? new Date())
  const [expanded, setExpanded] = React.useState(defaultExpanded)

  React.useEffect(() => {
    if (valueDate) setViewDate(valueDate)
  }, [value])

  const prevMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1))
  const nextMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1))
  const goToday = () => {
    const t = new Date()
    setViewDate(t)
    onChange(toISO(t))
  }
  const clear = () => onChange(null)

  const grid = React.useMemo(
    () => buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate.getFullYear(), viewDate.getMonth()]
  )
  const currentMonth = viewDate.getMonth()

  const displayLabel = valueDate ? formatDisplay(valueDate) : 'Select date'

  return (
    <div className={cn('rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 shadow-sm overflow-hidden', className)}>
      {/* Collapsed row: date + chevron — click to expand */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm text-foreground hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors rounded-t-2xl"
      >
        <span className={valueDate ? 'font-medium' : 'text-muted-foreground'}>{displayLabel}</span>
        <ChevronDown
          className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200', expanded && 'rotate-180')}
          aria-hidden
        />
      </button>

      {/* Separator above calendar — smooth height animation */}
      <div
        className={cn(
          'border-t border-slate-200/80 dark:border-slate-700/80 overflow-hidden transition-[max-height] duration-300 ease-out',
          expanded ? 'max-h-[380px] opacity-100' : 'max-h-0 opacity-0 border-t-0'
        )}
      >
        <div className="px-3 pt-4 pb-2">
          {/* Month title left, nav arrows right */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-base font-semibold text-foreground">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={prevMonth}
                className="p-2 rounded-xl text-slate-500 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="p-2 rounded-xl text-slate-500 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Date grid — scrollable when small */}
          <div className="max-h-[min(280px,50vh)] overflow-y-auto overscroll-contain">
            <div className="grid grid-cols-7 gap-1.5">
              {grid.flat().map((d, i) => {
                if (!d) return <div key={i} />
                const isCurrentMonth = d.getMonth() === currentMonth
                const selected = valueDate && isSameDay(d, valueDate)
                const today = isToday(d)
                return (
                  <button
                    key={d.getTime()}
                    type="button"
                    onClick={() => {
                      onChange(toISO(d))
                      setViewDate(d)
                    }}
                    className={cn(
                      'aspect-square flex items-center justify-center text-sm rounded-[18px] transition-colors min-w-0',
                      isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/70',
                      selected
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/20 hover:from-blue-600 hover:to-blue-700'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700/50',
                      today && !selected && 'ring-1 ring-slate-300 dark:ring-slate-600'
                    )}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Clear + Today */}
          <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-700/80">
            <button
              type="button"
              onClick={clear}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={goToday}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
