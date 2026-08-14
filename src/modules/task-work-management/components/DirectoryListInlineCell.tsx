import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const inlineInputClass =
  'w-full min-w-0 rounded-md border-0 bg-transparent px-0 py-0 text-xs font-medium text-foreground shadow-none outline-none ring-0 focus-visible:ring-0'

const inlineSelectClass =
  'w-full min-w-0 max-w-full rounded-md border border-border/70 bg-background px-2 py-1 text-xs font-medium text-foreground shadow-sm outline-none ring-0 focus-visible:ring-0'

const inlineTriggerClass =
  'w-full min-w-0 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/40 outline-none ring-0 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60'

export function toDirectoryDateInputValue(raw: string): string {
  if (!raw?.trim()) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return ''
  return localDateInputValue(parsed)
}

function localDateInputValue(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseLocalDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

type CalendarDayCell = {
  date: Date
  inMonth: boolean
}

function buildCalendarWeeks(viewDate: Date): CalendarDayCell[][] {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const start = new Date(year, month, 1 - firstOfMonth.getDay())
  const weeks: CalendarDayCell[][] = []

  for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
    const week: CalendarDayCell[] = []
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = new Date(start)
      date.setDate(start.getDate() + weekIndex * 7 + dayIndex)
      week.push({ date, inMonth: date.getMonth() === month })
    }
    weeks.push(week)
  }

  return weeks
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const

type DirectoryInlineDatePickerPanelProps = {
  value: string
  onSelect: (isoDate: string) => void
  onClear: () => void
}

function DirectoryInlineDatePickerPanel({ value, onSelect, onClear }: DirectoryInlineDatePickerPanelProps) {
  const selectedDate = parseLocalDateInput(toDirectoryDateInputValue(value))
  const today = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }, [])
  const [viewDate, setViewDate] = useState(() => selectedDate ?? today)

  const weeks = useMemo(() => buildCalendarWeeks(viewDate), [viewDate])
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  const shiftMonth = (delta: number) => {
    setViewDate((previous) => new Date(previous.getFullYear(), previous.getMonth() + delta, 1))
  }

  return (
    <div className="w-[280px] select-none">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
        <p className="text-sm font-semibold text-foreground">{monthLabel}</p>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="px-3 pt-3">
        <div className="mb-2 grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="flex h-7 items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="space-y-1 pb-3">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map(({ date, inMonth }) => {
                const isSelected = selectedDate ? isSameLocalDay(date, selectedDate) : false
                const isToday = isSameLocalDay(date, today)
                const isoDate = localDateInputValue(date)

                return (
                  <button
                    key={isoDate}
                    type="button"
                    aria-label={date.toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    aria-pressed={isSelected}
                    className={cn(
                      'mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition',
                      !inMonth && 'text-muted-foreground/45 hover:bg-muted/50',
                      inMonth && !isSelected && 'text-foreground hover:bg-muted/70',
                      isToday && !isSelected && 'font-semibold text-primary ring-1 ring-primary/30',
                      isSelected &&
                        'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground',
                    )}
                    onClick={() => onSelect(isoDate)}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 px-3 py-2">
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
          onClick={onClear}
        >
          Clear
        </button>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs font-semibold text-primary transition hover:bg-primary/10"
          onClick={() => onSelect(localDateInputValue(today))}
        >
          Today
        </button>
      </div>
    </div>
  )
}

type DirectoryInlineTextCellProps = {
  value: string
  placeholder?: string
  onCommit: (value: string) => void | Promise<void>
  disabled?: boolean
  ariaLabel: string
  className?: string
  inputClassName?: string
  maxLength?: number
  emptyDisplay?: ReactNode
  display?: ReactNode
}

export function DirectoryInlineTextCell({
  value,
  placeholder = '—',
  onCommit,
  disabled = false,
  ariaLabel,
  className,
  inputClassName,
  maxLength = 255,
  emptyDisplay,
  display: customDisplay,
}: DirectoryInlineTextCellProps) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  const commit = async (nextRaw: string) => {
    const next = nextRaw.trim()
    const previous = value.trim()
    setEditing(false)
    if (next === previous) return
    await onCommit(next)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        data-directory-inline-cell
        defaultValue={value}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(inlineInputClass, inputClassName)}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Enter') {
            event.preventDefault()
            void commit(event.currentTarget.value)
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            setEditing(false)
          }
        }}
        onBlur={(event) => {
          void commit(event.currentTarget.value)
        }}
      />
    )
  }

  const trimmedValue = value.trim()

  return (
    <button
      type="button"
      data-directory-inline-cell
      disabled={disabled}
      aria-label={`${ariaLabel} — click to edit`}
      title={`${trimmedValue || placeholder} — click to edit`}
      className={cn(inlineTriggerClass, 'text-left', className)}
      onClick={(event) => {
        event.stopPropagation()
        if (!disabled) setEditing(true)
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {customDisplay ??
        (trimmedValue ? (
          <span className="block truncate">{value}</span>
        ) : (
          (emptyDisplay ?? <span className="text-[11px] text-muted-foreground">{placeholder}</span>)
        ))}
    </button>
  )
}

type DirectoryInlineSelectCellProps<T extends string> = {
  value: T
  options: Array<{ value: T; label: string }>
  onCommit: (value: T) => void | Promise<void>
  disabled?: boolean
  ariaLabel: string
  children: ReactNode
  className?: string
  renderOption?: (option: { value: T; label: string }, selected: boolean) => ReactNode
  menuMinWidth?: number
}

export function DirectoryInlineSelectCell<T extends string>({
  value,
  options,
  onCommit,
  disabled = false,
  ariaLabel,
  children,
  className,
  renderOption,
  menuMinWidth = 180,
}: DirectoryInlineSelectCellProps<T>) {
  const [editing, setEditing] = useState(false)
  const selectRef = useRef<HTMLSelectElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [menuAnchor, setMenuAnchor] = useState<{ left: number; top: number; width: number } | null>(null)

  useEffect(() => {
    if (!editing || renderOption) return
    selectRef.current?.focus()
  }, [editing, renderOption])

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setMenuAnchor({
      left: rect.left,
      top: rect.bottom + 4,
      width: Math.max(rect.width, menuMinWidth),
    })
    setEditing(true)
  }

  const updateMenuAnchor = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setMenuAnchor({
      left: rect.left,
      top: rect.bottom + 4,
      width: Math.max(rect.width, menuMinWidth),
    })
  }

  useEffect(() => {
    if (!editing || !renderOption) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setEditing(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEditing(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [editing, renderOption])

  useLayoutEffect(() => {
    if (!editing || !renderOption) return

    updateMenuAnchor()

    const onScroll = (event: Event) => {
      const target = event.target as Node | null
      if (target && panelRef.current?.contains(target)) return
      updateMenuAnchor()
    }

    const onResize = () => updateMenuAnchor()

    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [editing, renderOption, menuMinWidth])

  if (editing && renderOption && menuAnchor && typeof document !== 'undefined') {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          data-directory-inline-cell
          disabled={disabled}
          aria-label={`${ariaLabel} — click to edit`}
          aria-expanded
          className={cn(inlineTriggerClass, 'inline-flex items-center', className)}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {children}
        </button>
        {createPortal(
          <div
            ref={panelRef}
            data-directory-inline-cell
            className="fixed z-[1200] overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
            style={{
              left: menuAnchor.left,
              top: menuAnchor.top,
              width: menuAnchor.width,
            }}
            role="listbox"
            aria-label={ariaLabel}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="max-h-64 overflow-auto py-1 text-sm">
              {options.map((option) => {
                const selected = option.value === value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-muted/50',
                      selected && 'bg-primary text-primary-foreground hover:bg-primary'
                    )}
                    onClick={() => {
                      setEditing(false)
                      if (!selected) void onCommit(option.value)
                    }}
                  >
                    {renderOption(option, selected)}
                  </button>
                )
              })}
            </div>
          </div>,
          document.body
        )}
      </>
    )
  }

  if (editing && !renderOption) {
    return (
      <select
        ref={selectRef}
        data-directory-inline-cell
        value={value}
        aria-label={ariaLabel}
        className={cn(inlineSelectClass, className)}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => {
          const next = event.target.value as T
          setEditing(false)
          if (next !== value) void onCommit(next)
        }}
        onBlur={() => setEditing(false)}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Escape') {
            event.preventDefault()
            setEditing(false)
          }
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <button
      ref={triggerRef}
      type="button"
      data-directory-inline-cell
      disabled={disabled}
      aria-label={`${ariaLabel} — click to edit`}
      title={`${ariaLabel} — click to edit`}
      className={cn(inlineTriggerClass, 'inline-flex items-center', className)}
      onClick={(event) => {
        event.stopPropagation()
        if (disabled) return
        if (renderOption) openMenu()
        else setEditing(true)
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {children}
    </button>
  )
}

type DirectoryInlineDateCellProps = {
  value: string
  onCommit: (value: string) => void | Promise<void>
  disabled?: boolean
  ariaLabel: string
  className?: string
  /** Optional closed-state label (e.g. DD-MM-YYYY) while `value` stays ISO for the date input. */
  display?: ReactNode
}

export function DirectoryInlineDateCell({
  value,
  onCommit,
  disabled = false,
  ariaLabel,
  className,
  display,
}: DirectoryInlineDateCellProps) {
  const [editing, setEditing] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [menuAnchor, setMenuAnchor] = useState<{ left: number; top: number } | null>(null)
  const inputValue = toDirectoryDateInputValue(value)

  const openPicker = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const panelWidth = 280
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - panelWidth - 8)
    const top = rect.bottom + 6
    setMenuAnchor({ left, top })
    setEditing(true)
  }

  const updateMenuAnchor = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const panelWidth = 280
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - panelWidth - 8)
    setMenuAnchor({ left, top: rect.bottom + 6 })
  }

  useEffect(() => {
    if (!editing) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setEditing(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEditing(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [editing])

  useLayoutEffect(() => {
    if (!editing) return

    updateMenuAnchor()

    const onScroll = (event: Event) => {
      const target = event.target as Node | null
      if (target && panelRef.current?.contains(target)) return
      updateMenuAnchor()
    }

    const onResize = () => updateMenuAnchor()

    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [editing])

  const commit = async (next: string) => {
    setEditing(false)
    if (next === inputValue) return
    await onCommit(next)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-directory-inline-cell
        disabled={disabled}
        aria-label={`${ariaLabel} — click to edit`}
        aria-expanded={editing}
        title={`${value || 'No date'} — click to edit`}
        className={cn(inlineTriggerClass, 'tabular-nums text-foreground', className)}
        onClick={(event) => {
          event.stopPropagation()
          if (disabled) return
          if (editing) setEditing(false)
          else openPicker()
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {display ?? (value || <span className="text-[11px] text-muted-foreground">—</span>)}
      </button>
      {editing && menuAnchor && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              data-directory-inline-cell
              className="fixed z-[1200] overflow-hidden rounded-xl border border-border/80 bg-popover shadow-[0_16px_40px_rgba(15,23,42,0.14)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
              style={{
                left: menuAnchor.left,
                top: menuAnchor.top,
              }}
              role="dialog"
              aria-label={ariaLabel}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <DirectoryInlineDatePickerPanel
                value={value}
                onSelect={(isoDate) => {
                  void commit(isoDate)
                }}
                onClear={() => {
                  void commit('')
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
