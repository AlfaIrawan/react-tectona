import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import type { ProjectMemberRoleCode } from '@/lib/api/projectApi'
import { cn } from '@/lib/utils'

export const PROJECT_MEMBER_ROLE_OPTIONS: {
  value: ProjectMemberRoleCode
  label: string
  description: string
}[] = [
  { value: 'admin', label: 'Admin', description: 'Manage settings and members' },
  { value: 'member', label: 'Member', description: 'Edit project work items' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
]

type ProjectMemberRoleSelectProps = {
  value: ProjectMemberRoleCode
  onChange: (value: ProjectMemberRoleCode) => void
  disabled?: boolean
  className?: string
  id?: string
  'aria-label'?: string
}

export function projectMemberRoleLabel(roleCode: string): string {
  return PROJECT_MEMBER_ROLE_OPTIONS.find((role) => role.value === roleCode)?.label ?? roleCode
}

export function ProjectMemberRoleSelect({
  value,
  onChange,
  disabled = false,
  className,
  id,
  'aria-label': ariaLabel = 'Project role',
}: ProjectMemberRoleSelectProps) {
  const listboxId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<{ left: number; top: number; width: number } | null>(null)

  const selected = PROJECT_MEMBER_ROLE_OPTIONS.find((role) => role.value === value)

  const updateMenuAnchor = () => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setMenuAnchor({
      left: rect.left,
      top: rect.bottom + 6,
      width: Math.max(rect.width, 220),
    })
  }

  useLayoutEffect(() => {
    if (!open) return
    updateMenuAnchor()
    const onScroll = () => updateMenuAnchor()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className={cn(
          'inline-flex h-9 min-w-[7.5rem] items-center justify-between gap-2 rounded-xl border border-slate-200/90',
          'bg-white/95 px-3 text-xs font-semibold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.05)]',
          'transition hover:border-slate-300 hover:bg-slate-50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-60',
          'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
          open && 'border-sky-300/80 ring-2 ring-sky-100/80 dark:ring-sky-900/40',
          className,
        )}
        onClick={() => {
          if (disabled) return
          setOpen((current) => !current)
        }}
      >
        <span>{selected?.label ?? value}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-slate-400 transition', open && 'rotate-180')} />
      </button>

      {open && menuAnchor && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel}
              className="fixed z-[1500] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-1 shadow-[0_16px_40px_-20px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-950/95"
              style={{
                left: menuAnchor.left,
                top: menuAnchor.top,
                width: menuAnchor.width,
              }}
            >
              {PROJECT_MEMBER_ROLE_OPTIONS.map((role) => {
                const isSelected = role.value === value
                return (
                  <button
                    key={role.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      'flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition',
                      isSelected
                        ? 'bg-sky-50 text-sky-900 ring-1 ring-sky-200/70 dark:bg-sky-950/40 dark:text-sky-100 dark:ring-sky-800/60'
                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-900/70',
                    )}
                    onClick={() => {
                      setOpen(false)
                      if (!isSelected) onChange(role.value)
                    }}
                  >
                    <span>
                      <span className="block text-sm font-semibold">{role.label}</span>
                      <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">{role.description}</span>
                    </span>
                    {isSelected ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" /> : null}
                  </button>
                )
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
