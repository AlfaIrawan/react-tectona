import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, CornerDownLeft, User } from 'lucide-react'
import type { WorkItemType } from '@/lib/api/workApi'
import { cn } from '@/lib/utils'
import { resolveWorkItemTypeIconMeta } from '@/modules/task-work-management/components/DirectoryGanttGridCells'

const QUICK_ADD_TYPES: WorkItemType[] = ['Task', 'Bug', 'Epic', 'Feature', 'Subtask']

export function CalendarQuickAddPopover({
  dayKey,
  anchorEl,
  assigneeLabel,
  initialType = 'Task',
  isSubmitting,
  onClose,
  onCreate,
}: {
  dayKey: string
  anchorEl: HTMLElement
  assigneeLabel: string
  initialType?: WorkItemType
  isSubmitting: boolean
  onClose: () => void
  onCreate: (input: { title: string; type: WorkItemType; dayKey: string }) => void | Promise<void>
}) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const typeMenuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<WorkItemType>(initialType)
  const [typeMenuOpen, setTypeMenuOpen] = useState(false)
  const [position, setPosition] = useState<{
    top: number
    left: number
    width: number
    placement: 'above' | 'below'
  } | null>(null)

  const typeMeta = resolveWorkItemTypeIconMeta(type)
  const TypeIcon = typeMeta.icon
  const canCreate = title.trim().length > 0 && !isSubmitting

  const updatePosition = () => {
    const rect = anchorEl.getBoundingClientRect()
    const width = Math.min(300, Math.max(240, rect.width + 48))
    let left = rect.right - width
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12))
    const estimatedHeight = 132
    const spaceAbove = rect.top - 12
    const placement = spaceAbove >= estimatedHeight ? 'above' : 'below'
    const top = placement === 'above' ? rect.top - 8 : rect.bottom + 8
    setPosition({ top, left, width, placement })
  }

  useLayoutEffect(() => {
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorEl, dayKey])

  useEffect(() => {
    setTitle('')
    setType(initialType)
    setTypeMenuOpen(false)
  }, [dayKey, initialType])

  useEffect(() => {
    inputRef.current?.focus()
  }, [dayKey, initialType])

  useEffect(() => {
    const openedAt = Date.now()
    const closeIfOutsidePopover = (event: MouseEvent) => {
      if (Date.now() - openedAt < 120) return
      const target = event.target as Node
      if (popoverRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('[data-calendar-quick-add-trigger]')) return
      if (target instanceof Element && target.closest('[data-context-menu-root]')) return
      onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', closeIfOutsidePopover)
    document.addEventListener('click', closeIfOutsidePopover)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', closeIfOutsidePopover)
      document.removeEventListener('click', closeIfOutsidePopover)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  useEffect(() => {
    if (!typeMenuOpen) return
    const closeTypeMenuIfOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (typeMenuRef.current?.contains(target)) return
      setTypeMenuOpen(false)
    }
    document.addEventListener('mousedown', closeTypeMenuIfOutside)
    document.addEventListener('click', closeTypeMenuIfOutside)
    return () => {
      document.removeEventListener('mousedown', closeTypeMenuIfOutside)
      document.removeEventListener('click', closeTypeMenuIfOutside)
    }
  }, [typeMenuOpen])

  const submit = () => {
    if (!canCreate) return
    void onCreate({ title: title.trim(), type, dayKey })
  }

  if (!position) return null

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Create work item"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: position.width,
        transform: position.placement === 'above' ? 'translateY(-100%)' : undefined,
        zIndex: 110,
      }}
      className="rounded-xl border border-sky-300/80 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.14)] ring-2 ring-sky-400/20 dark:border-sky-700/50 dark:bg-slate-950 dark:ring-sky-500/15"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="p-3">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
          placeholder="What needs to be done?"
          className="w-full border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          disabled={isSubmitting}
        />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-2.5 py-2 dark:border-slate-800">
        <div ref={typeMenuRef} className="relative flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTypeMenuOpen((open) => !open)}
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs font-semibold text-foreground transition hover:bg-slate-100 dark:hover:bg-slate-900"
            aria-haspopup="listbox"
            aria-expanded={typeMenuOpen}
          >
            <span
              className={cn(
                'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200/80 bg-slate-50 dark:border-slate-700 dark:bg-slate-900',
                typeMeta.className,
              )}
            >
              <TypeIcon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="truncate">{type}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </button>
          {typeMenuOpen ? (
            <div
              role="listbox"
              className="absolute bottom-full left-0 z-10 mb-1 min-w-[9rem] overflow-hidden rounded-lg border border-slate-200/90 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-950"
            >
              {QUICK_ADD_TYPES.map((option) => {
                const optionMeta = resolveWorkItemTypeIconMeta(option)
                const OptionIcon = optionMeta.icon
                return (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={option === type}
                    onClick={() => {
                      setType(option)
                      setTypeMenuOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-900',
                      option === type && 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200',
                    )}
                  >
                    <OptionIcon className={cn('h-3.5 w-3.5', optionMeta.className)} aria-hidden />
                    {option}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400"
            title={assigneeLabel}
          >
            <User className="h-3.5 w-3.5" aria-hidden />
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={!canCreate}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition',
              canCreate
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-600',
            )}
          >
            Create
            <CornerDownLeft className="h-3 w-3 opacity-80" aria-hidden />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
