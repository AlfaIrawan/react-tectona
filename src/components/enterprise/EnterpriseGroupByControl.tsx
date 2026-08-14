import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

/** Generic "Group by" dropdown — same trigger button + searchable portal panel as the Workspace
 * Directory table, parameterized over any set of group-by option keys. */

export interface EnterpriseGroupByOption<K extends string> {
  key: K
  label: string
}

export interface EnterpriseGroupByControlProps<K extends string> {
  options: readonly EnterpriseGroupByOption<K>[]
  value: K | null
  onChange: (key: K | null) => void
}

export function EnterpriseGroupByControl<K extends string>({
  options,
  value,
  onChange,
}: EnterpriseGroupByControlProps<K>) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [anchor, setAnchor] = useState<{ left: number; top: number; width: number } | null>(null)

  const displayLabel = options.find((opt) => opt.key === value)?.label ?? 'None'

  const updateAnchor = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setAnchor({ left: rect.left, top: rect.bottom + 8, width: rect.width })
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

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.trim().toLowerCase()),
  )

  return (
    <div className="relative shrink-0">
      <div className="inline-flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Group by</span>
        <button
          type="button"
          ref={triggerRef}
          className={cn(
            'inline-flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm transition',
            'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
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
        >
          <span className="min-w-[84px] text-left">{displayLabel}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
        </button>
      </div>

      {open && anchor
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-[80] w-[260px] overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
              style={{ left: anchor.left, top: anchor.top }}
              role="listbox"
              aria-label="Group by options"
            >
              <div className="p-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search grouping options"
                  className="h-9 text-sm"
                  autoFocus
                />
              </div>
              <div className="enterprise-popover-scroll max-h-64 overflow-auto py-1 text-sm">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
                  Recently used
                </div>
                {filteredOptions.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    role="option"
                    aria-selected={value === opt.key}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-muted/50',
                      value === opt.key && 'bg-muted/40 font-semibold text-foreground',
                    )}
                    onClick={() => {
                      onChange(opt.key)
                      setOpen(false)
                      setSearch('')
                    }}
                  >
                    <span>{opt.label}</span>
                    {value === opt.key ? <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden /> : null}
                  </button>
                ))}
              </div>
              <div className="border-t border-border">
                <button
                  type="button"
                  disabled={!value}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition',
                    value
                      ? 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      : 'cursor-not-allowed text-muted-foreground/50',
                  )}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={() => {
                    onChange(null)
                    setOpen(false)
                    setSearch('')
                  }}
                >
                  <span>Clear selection</span>
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
