import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Columns2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

/** Generic "show/hide columns" control — same trigger icon + searchable portal checklist as the
 * Workspace Directory table's column visibility manager, parameterized over any column key type. */

export interface EnterpriseColumnVisibilityOption<K extends string> {
  key: K
  label: string
}

export interface EnterpriseColumnVisibilityControlProps<K extends string> {
  columns: readonly EnterpriseColumnVisibilityOption<K>[]
  hidden: Set<K>
  visibleCount: number
  onToggle: (key: K) => void
  onShowAll: () => void
  /** Whether showing this (currently hidden) column would exceed the table's column limit.
   * Omit to always allow. */
  canEnable?: (key: K) => boolean
  /** Shown as a persistent note (not just a per-option hover tooltip) whenever at least one hidden
   * column is currently blocked by `canEnable` — so the limit is explained up front instead of the
   * user having to guess why an option won't check. E.g. "Maximum 6 columns shown at once — hide one
   * to show another." */
  limitReachedMessage?: string
}

export function EnterpriseColumnVisibilityControl<K extends string>({
  columns,
  hidden,
  visibleCount,
  onToggle,
  onShowAll,
  canEnable,
  limitReachedMessage,
}: EnterpriseColumnVisibilityControlProps<K>) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null)

  const updateAnchor = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setAnchor({ left: rect.right - 260, top: rect.bottom + 12 })
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
      setSearch('')
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      setSearch('')
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    updateAnchor()
    const onReposition = () => updateAnchor()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, updateAnchor])

  const filteredColumns = columns.filter((col) =>
    col.label.toLowerCase().includes(search.trim().toLowerCase()),
  )

  const isLimitReached = useMemo(
    () => Boolean(canEnable) && columns.some((col) => hidden.has(col.key) && !canEnable!(col.key)),
    [columns, hidden, canEnable],
  )

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        ref={triggerRef}
        className={cn(
          'inline-flex items-center justify-center text-muted-foreground transition',
          'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
          open && 'text-foreground',
        )}
        onClick={() => {
          if (open) {
            setOpen(false)
            setSearch('')
            return
          }
          setOpen(true)
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Show or hide columns"
        title="Show or hide columns"
      >
        <Columns2 className="h-6 w-6 text-muted-foreground" aria-hidden />
      </button>

      {open && anchor
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-[80] w-[260px] overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
              style={{ left: anchor.left, top: anchor.top }}
              role="listbox"
              aria-label="Column visibility options"
            >
              <div className="border-b border-border px-3 pb-2.5 pt-3.5">
                <p className="text-xs font-semibold text-foreground">Columns</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Show or hide table columns</p>
              </div>
              {isLimitReached && limitReachedMessage ? (
                <div className="flex items-start gap-1.5 border-b border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{limitReachedMessage}</span>
                </div>
              ) : null}
              <div className="px-3 pb-2.5 pt-2.5">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search columns"
                  className="h-9 text-sm"
                  autoFocus
                />
              </div>
              <div className="enterprise-popover-scroll max-h-64 overflow-auto py-1 text-sm">
                {filteredColumns.map((col) => {
                  const isVisible = !hidden.has(col.key)
                  const isOnlyVisibleColumn = isVisible && visibleCount <= 1
                  const blockedByLimit = !isVisible && canEnable ? !canEnable(col.key) : false
                  const disabled = isOnlyVisibleColumn || blockedByLimit
                  return (
                    <button
                      key={col.key}
                      type="button"
                      role="option"
                      aria-selected={isVisible}
                      disabled={disabled}
                      title={blockedByLimit ? (limitReachedMessage ?? 'Column limit reached — hide another column first') : undefined}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-muted/50',
                        isVisible && 'font-medium text-foreground',
                        disabled && 'cursor-not-allowed opacity-60',
                      )}
                      onClick={() => onToggle(col.key)}
                    >
                      <span>{col.label}</span>
                      {isVisible ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                      ) : (
                        <span className="h-4 w-4 shrink-0 rounded-full border border-border" aria-hidden />
                      )}
                    </button>
                  )
                })}
              </div>
              {hidden.size > 0 ? (
                <div className="border-t border-border">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={() => {
                      onShowAll()
                      setOpen(false)
                      setSearch('')
                    }}
                  >
                    <span>Show all columns</span>
                  </button>
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
