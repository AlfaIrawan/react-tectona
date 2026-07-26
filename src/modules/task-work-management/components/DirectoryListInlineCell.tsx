import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

const inlineInputClass =
  'w-full min-w-0 rounded-md border-0 bg-transparent px-0 py-0 text-xs font-medium text-foreground shadow-none outline-none ring-0 focus-visible:ring-0'

const inlineSelectClass =
  'w-full min-w-0 max-w-full rounded-md border border-border/70 bg-background px-2 py-1 text-xs font-medium text-foreground shadow-sm outline-none ring-0 focus-visible:ring-0'

const inlineTriggerClass =
  'w-full min-w-0 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted/40 outline-none ring-0 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60'

export function toDirectoryDateInputValue(raw: string): string {
  if (!raw?.trim()) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
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
      className={cn(inlineTriggerClass, className)}
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
}

export function DirectoryInlineDateCell({
  value,
  onCommit,
  disabled = false,
  ariaLabel,
  className,
}: DirectoryInlineDateCellProps) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputValue = toDirectoryDateInputValue(value)

  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
  }, [editing])

  const commit = async (next: string) => {
    setEditing(false)
    if (!next || next === inputValue) return
    await onCommit(next)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        data-directory-inline-cell
        defaultValue={inputValue}
        aria-label={ariaLabel}
        className={cn(inlineInputClass, 'tabular-nums', className)}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => {
          void commit(event.currentTarget.value)
        }}
        onBlur={(event) => {
          void commit(event.currentTarget.value)
        }}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Escape') {
            event.preventDefault()
            setEditing(false)
          }
        }}
      />
    )
  }

  return (
    <button
      type="button"
      data-directory-inline-cell
      disabled={disabled}
      aria-label={`${ariaLabel} — click to edit`}
      title={`${value || 'No date'} — click to edit`}
      className={cn(inlineTriggerClass, 'tabular-nums text-foreground', className)}
      onClick={(event) => {
        event.stopPropagation()
        if (!disabled) setEditing(true)
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {value || <span className="text-[11px] text-muted-foreground">—</span>}
    </button>
  )
}
