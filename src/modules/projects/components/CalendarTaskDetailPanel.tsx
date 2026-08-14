import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  Check,
  ChevronDown,
  ChevronLeft,
  Circle,
  CircleDot,
  Eye,
  Inbox,
  Minus,
  Trash2,
  User,
} from 'lucide-react'
import type { Priority, WorkItemApiModel, WorkItemType, WorkStatus } from '@/lib/api/workApi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { registerServicePrimaryButtonClass } from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'
import { resolveWorkItemTypeIconMeta } from '@/modules/task-work-management/components/DirectoryGanttGridCells'
import { resolveWorkItemSchedule } from '../lib/buildProjectCalendarEvents'
import { CalendarTaskDeleteConfirmModal } from './CalendarTaskDeleteConfirmModal'

const WORK_STATUSES: WorkStatus[] = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done']
const PRIORITIES: Priority[] = ['Critical', 'High', 'Medium', 'Low']
const WORK_TYPES: WorkItemType[] = ['Task', 'Bug', 'Epic', 'Feature', 'Subtask', 'Checklist']

const STATUS_CHIP: Record<WorkStatus, string> = {
  Backlog: 'border-violet-200/80 bg-violet-50/95 text-violet-800 dark:border-violet-800/50 dark:bg-violet-950/45 dark:text-violet-200',
  'To Do': 'border-slate-200/80 bg-slate-100/95 text-slate-700 dark:border-slate-700/50 dark:bg-slate-900/50 dark:text-slate-200',
  'In Progress': 'border-sky-200/80 bg-sky-50/95 text-sky-800 dark:border-sky-800/50 dark:bg-sky-950/45 dark:text-sky-200',
  'In Review': 'border-amber-200/80 bg-amber-50/95 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/45 dark:text-amber-200',
  Done: 'border-emerald-200/80 bg-emerald-50/95 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/45 dark:text-emerald-200',
}

const TYPE_ICON_SURFACE: Record<string, string> = {
  Epic: 'border-violet-200/80 bg-gradient-to-br from-violet-50 to-white text-violet-700 dark:border-violet-800/40 dark:from-violet-950/40 dark:to-background dark:text-violet-300',
  Feature: 'border-sky-200/80 bg-gradient-to-br from-sky-50 to-white text-sky-700 dark:border-sky-800/40 dark:from-sky-950/40 dark:to-background dark:text-sky-300',
  Task: 'border-blue-200/80 bg-gradient-to-br from-blue-50 to-white text-blue-700 dark:border-blue-800/40 dark:from-blue-950/40 dark:to-background dark:text-blue-300',
  Subtask: 'border-amber-200/80 bg-gradient-to-br from-amber-50 to-white text-amber-700 dark:border-amber-800/40 dark:from-amber-950/40 dark:to-background dark:text-amber-300',
  Checklist: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white text-emerald-700 dark:border-emerald-800/40 dark:from-emerald-950/40 dark:to-background dark:text-emerald-300',
  Bug: 'border-rose-200/80 bg-gradient-to-br from-rose-50 to-white text-rose-700 dark:border-rose-800/40 dark:from-rose-950/40 dark:to-background dark:text-rose-300',
}

const focusClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30 focus-visible:ring-offset-0'

const deleteTaskButtonClass = cn(
  registerServicePrimaryButtonClass(),
  'w-full justify-center bg-rose-500 text-white hover:bg-rose-600 focus-visible:ring-rose-400 dark:bg-rose-600 dark:hover:bg-rose-700',
)

function WorkItemTypeIcon({ type }: { type: WorkItemType }) {
  const meta = resolveWorkItemTypeIconMeta(type)
  const Icon = meta.icon
  return <Icon className={cn('h-3.5 w-3.5', meta.className)} aria-hidden />
}

function InlineFieldLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground', className)}>
      {children}
    </p>
  )
}

function InlineFieldRow({
  label,
  children,
  className,
  labelClassName,
}: {
  label: React.ReactNode
  children: React.ReactNode
  className?: string
  labelClassName?: string
}) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <InlineFieldLabel className={cn('w-[4.75rem] shrink-0', labelClassName)}>{label}</InlineFieldLabel>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function inlineInputClassName() {
  return cn(
    'h-8 border-transparent bg-transparent px-2 text-xs shadow-none transition hover:border-border/60 hover:bg-muted/20 focus-visible:border-border focus-visible:bg-background',
    focusClass,
  )
}

function StatusMenuIcon({ status }: { status: WorkStatus }) {
  const className = 'h-3.5 w-3.5 shrink-0'
  if (status === 'Backlog') return <Inbox className={cn(className, 'text-violet-600')} aria-hidden />
  if (status === 'To Do') return <Circle className={cn(className, 'text-slate-500')} aria-hidden />
  if (status === 'In Progress') return <CircleDot className={cn(className, 'text-sky-600')} aria-hidden />
  if (status === 'In Review') return <Eye className={cn(className, 'text-amber-600')} aria-hidden />
  return <Check className={cn(className, 'text-emerald-600')} aria-hidden />
}

function PriorityMenuIcon({ priority }: { priority: Priority }) {
  if (priority === 'Critical') {
    return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" aria-hidden />
  }
  if (priority === 'High') {
    return <ArrowDown className="h-3.5 w-3.5 shrink-0 rotate-180 text-orange-600" aria-hidden />
  }
  if (priority === 'Low') {
    return <ArrowDown className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
  }
  return <Minus className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
}

function TaskDetailSelectMenu<T extends string>({
  label,
  value,
  options,
  onChange,
  ariaLabel,
  renderIcon,
  getTriggerClassName,
  getOptionClassName,
}: {
  label: string
  value: T
  options: readonly T[]
  onChange: (value: T) => void
  ariaLabel: string
  renderIcon?: (option: T) => React.ReactNode
  getTriggerClassName?: (value: T) => string
  getOptionClassName?: (option: T, selected: boolean) => string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div ref={rootRef} className="flex items-center gap-2.5">
      <InlineFieldLabel className="w-[4.75rem] shrink-0">{label}</InlineFieldLabel>
      <div className="relative min-w-0 flex-1">
        <button
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            'flex h-8 w-full items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-2 text-left text-[10px] font-semibold text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:bg-slate-50/90 dark:border-slate-700/60 dark:bg-slate-900/40 dark:hover:bg-slate-900/70',
            getTriggerClassName?.(value),
            focusClass,
          )}
        >
          {renderIcon?.(value)}
          <span className="min-w-0 flex-1 truncate">{value}</span>
          <ChevronDown
            className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition', open && 'rotate-180')}
            aria-hidden
          />
        </button>

        {open ? (
          <div
            role="listbox"
            aria-label={ariaLabel}
            className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-30 overflow-hidden rounded-xl border border-slate-200/90 bg-white p-1 shadow-[0_18px_44px_rgba(15,23,42,0.14)] ring-1 ring-slate-900/[0.04] dark:border-slate-700/70 dark:bg-slate-950 dark:ring-white/[0.04]"
          >
            {options.map((option) => {
              const selected = option === value
              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(option)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[11px] font-medium transition',
                    selected
                      ? 'bg-sky-50 text-sky-900 ring-1 ring-sky-200/70 dark:bg-sky-950/40 dark:text-sky-100 dark:ring-sky-800/50'
                      : 'text-foreground hover:bg-slate-50 dark:hover:bg-slate-900/70',
                    getOptionClassName?.(option, selected),
                  )}
                >
                  {renderIcon?.(option)}
                  <span className="min-w-0 flex-1 truncate">{option}</span>
                  {selected ? <Check className="h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden /> : null}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function TypeSelectIcon({ type }: { type: WorkItemType }) {
  const meta = resolveWorkItemTypeIconMeta(type)
  const Icon = meta.icon
  return (
    <span
      className={cn(
        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-200/80 bg-slate-50 dark:border-slate-700 dark:bg-slate-900',
        meta.className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
    </span>
  )
}

export function CalendarTaskDetailPanel({
  workItem,
  onBackToDay,
  onPatch,
  onDelete,
  isDeleting,
}: {
  workItem: WorkItemApiModel
  onBackToDay: () => void
  onPatch: (patch: Partial<WorkItemApiModel>) => void | Promise<void>
  onDelete: () => void | Promise<void>
  isDeleting?: boolean
}) {
  const schedule = resolveWorkItemSchedule(workItem)
  const startDate = workItem.startDate?.slice(0, 10) ?? schedule?.startDate ?? workItem.dueDate
  const dueDate = workItem.dueDate?.slice(0, 10) ?? schedule?.dueDate ?? ''

  const [title, setTitle] = useState(workItem.title)
  const [assignee, setAssignee] = useState(workItem.assignee)
  const [team, setTeam] = useState(workItem.team ?? '')
  const [label, setLabel] = useState(workItem.label ?? '')
  const [description, setDescription] = useState(workItem.description ?? '')
  const [startDraft, setStartDraft] = useState(startDate)
  const [dueDraft, setDueDraft] = useState(dueDate)
  const [progressDraft, setProgressDraft] = useState(String(workItem.progress ?? 0))
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  useEffect(() => {
    setTitle(workItem.title)
    setAssignee(workItem.assignee)
    setTeam(workItem.team ?? '')
    setLabel(workItem.label ?? '')
    setDescription(workItem.description ?? '')
    setStartDraft(workItem.startDate?.slice(0, 10) ?? schedule?.startDate ?? workItem.dueDate)
    setDueDraft(workItem.dueDate?.slice(0, 10) ?? schedule?.dueDate ?? '')
    setProgressDraft(String(workItem.progress ?? 0))
    setDeleteConfirmOpen(false)
  }, [workItem.id, workItem.title, workItem.assignee, workItem.team, workItem.label, workItem.description, workItem.startDate, workItem.dueDate, workItem.progress, schedule?.dueDate, schedule?.startDate])

  const commitTitle = () => {
    const trimmed = title.trim()
    if (!trimmed || trimmed === workItem.title) {
      setTitle(workItem.title)
      return
    }
    void onPatch({ title: trimmed })
  }

  const commitAssignee = () => {
    const trimmed = assignee.trim()
    if (!trimmed || trimmed === workItem.assignee) {
      setAssignee(workItem.assignee)
      return
    }
    void onPatch({ assignee: trimmed, owner: trimmed })
  }

  const commitTeam = () => {
    const trimmed = team.trim()
    if (trimmed === (workItem.team ?? '').trim()) {
      setTeam(workItem.team ?? '')
      return
    }
    void onPatch({ team: trimmed })
  }

  const commitLabel = () => {
    const trimmed = label.trim()
    if (trimmed === (workItem.label ?? '').trim()) {
      setLabel(workItem.label ?? '')
      return
    }
    void onPatch({ label: trimmed })
  }

  const commitDescription = () => {
    const normalized = description.trim()
    if (normalized === (workItem.description ?? '').trim()) return
    void onPatch({ description: normalized })
  }

  const commitSchedule = () => {
    if (!dueDraft.trim()) {
      setDueDraft(workItem.dueDate?.slice(0, 10) ?? '')
      return
    }
    const nextStart = startDraft.trim() || dueDraft
    const nextDue = dueDraft.trim()
    if (nextStart === (workItem.startDate?.slice(0, 10) ?? schedule?.startDate) && nextDue === workItem.dueDate?.slice(0, 10)) {
      return
    }
    void onPatch({ startDate: nextStart, dueDate: nextDue })
  }

  const commitProgress = () => {
    const parsed = Number(progressDraft)
    if (!Number.isFinite(parsed)) {
      setProgressDraft(String(workItem.progress ?? 0))
      return
    }
    const clamped = Math.max(0, Math.min(100, Math.round(parsed)))
    setProgressDraft(String(clamped))
    if (clamped === (workItem.progress ?? 0)) return
    void onPatch({ progress: clamped })
  }

  const typeSurface = TYPE_ICON_SURFACE[workItem.type] ?? TYPE_ICON_SURFACE.Task

  return (
    <aside className="group flex w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50/70 shadow-[0_16px_44px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04] dark:border-slate-700/60 dark:from-background dark:via-background dark:to-slate-950/40 dark:ring-white/[0.04] lg:w-80">
      <div className="relative overflow-hidden border-b border-slate-200/70 px-4 py-4 dark:border-slate-700/60">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-50/90 via-white to-sky-50/35 dark:from-indigo-950/25 dark:via-background dark:to-sky-950/15"
          aria-hidden
        />
        <div className="relative space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onBackToDay}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 transition hover:bg-white/80 hover:text-foreground dark:text-slate-400 dark:hover:bg-slate-900/60',
                focusClass,
              )}
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              Back to day
            </button>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              Task detail
            </p>
          </div>

          <div className="flex gap-3">
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-[0_8px_24px_rgba(15,23,42,0.08)]',
                typeSurface,
              )}
              title={workItem.type}
            >
              <WorkItemTypeIcon type={workItem.type} />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={commitTitle}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    event.currentTarget.blur()
                  }
                }}
                className={cn(
                  'h-auto min-h-8 border-transparent bg-white/70 px-2 py-1 text-base font-semibold leading-snug shadow-none hover:border-border/60 focus-visible:border-border',
                  focusClass,
                )}
                aria-label="Task title"
              />
              <p className="px-2 font-mono text-[10px] text-muted-foreground">{workItem.id}</p>
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          'min-h-0 flex-1 space-y-4 overflow-y-auto p-4',
          '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
          'group-hover:[scrollbar-width:thin] group-hover:[scrollbar-color:rgba(148,163,184,0.75)_transparent]',
          'group-hover:[&::-webkit-scrollbar]:block group-hover:[&::-webkit-scrollbar]:w-1.5',
          'group-hover:[&::-webkit-scrollbar-track]:bg-transparent',
          'group-hover:[&::-webkit-scrollbar-thumb]:rounded-full group-hover:[&::-webkit-scrollbar-thumb]:bg-slate-300/80',
          'group-hover:[&::-webkit-scrollbar-thumb]:hover:bg-slate-400/90',
          'dark:group-hover:[scrollbar-color:rgba(100,116,139,0.65)_transparent]',
          'dark:group-hover:[&::-webkit-scrollbar-thumb]:bg-slate-600/80',
          'dark:group-hover:[&::-webkit-scrollbar-thumb]:hover:bg-slate-500/90',
        )}
      >
        <div className="space-y-3">
          <TaskDetailSelectMenu
            label="Type"
            value={workItem.type}
            options={WORK_TYPES}
            ariaLabel="Task type"
            onChange={(type) => void onPatch({ type })}
            renderIcon={(type) => <TypeSelectIcon type={type} />}
          />
          <TaskDetailSelectMenu
            label="Status"
            value={workItem.status}
            options={WORK_STATUSES}
            ariaLabel="Task status"
            onChange={(status) => void onPatch({ status })}
            renderIcon={(status) => <StatusMenuIcon status={status} />}
            getTriggerClassName={(status) => STATUS_CHIP[status]}
          />
          <TaskDetailSelectMenu
            label="Priority"
            value={workItem.priority}
            options={PRIORITIES}
            ariaLabel="Task priority"
            onChange={(priority) => void onPatch({ priority })}
            renderIcon={(priority) => <PriorityMenuIcon priority={priority} />}
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/40">
          <InlineFieldRow label="Start">
            <Input
              type="date"
              value={startDraft}
              onChange={(event) => setStartDraft(event.target.value)}
              onBlur={commitSchedule}
              className={inlineInputClassName()}
              aria-label="Start date"
            />
          </InlineFieldRow>

          <InlineFieldRow label="Due">
            <Input
              type="date"
              value={dueDraft}
              onChange={(event) => setDueDraft(event.target.value)}
              onBlur={commitSchedule}
              className={inlineInputClassName()}
              aria-label="Due date"
            />
          </InlineFieldRow>

          <InlineFieldRow
            label={
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3 opacity-70" aria-hidden />
                Assignee
              </span>
            }
          >
            <Input
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
              onBlur={commitAssignee}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
              className={inlineInputClassName()}
              aria-label="Assignee"
            />
          </InlineFieldRow>

          <InlineFieldRow label="Team">
            <Input
              value={team}
              onChange={(event) => setTeam(event.target.value)}
              onBlur={commitTeam}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
              placeholder="Delivery Squad"
              className={inlineInputClassName()}
              aria-label="Team"
            />
          </InlineFieldRow>

          <InlineFieldRow label="Label">
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              onBlur={commitLabel}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
              placeholder="Banking System"
              className={inlineInputClassName()}
              aria-label="Label"
            />
          </InlineFieldRow>

          <div className="space-y-1.5">
            <InlineFieldRow label="Progress (%)">
              <Input
                type="number"
                min={0}
                max={100}
                value={progressDraft}
                onChange={(event) => setProgressDraft(event.target.value)}
                onBlur={commitProgress}
                className={inlineInputClassName()}
                aria-label="Progress percent"
              />
            </InlineFieldRow>
            <div className="flex gap-2.5">
              <div className="w-[4.75rem] shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, workItem.progress ?? 0))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/40">
          <InlineFieldLabel>Description</InlineFieldLabel>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={commitDescription}
            rows={4}
            placeholder="Add a description…"
            className={cn(
              'mt-2 w-full resize-y rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-xs leading-5 text-foreground placeholder:text-muted-foreground transition hover:border-border/60 hover:bg-muted/20 focus-visible:border-border focus-visible:bg-background',
              focusClass,
            )}
            aria-label="Task description"
          />
        </div>

        <Button
          type="button"
          className={deleteTaskButtonClass}
          onClick={() => setDeleteConfirmOpen(true)}
        >
          <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
          Delete task
        </Button>
      </div>

      <CalendarTaskDeleteConfirmModal
        open={deleteConfirmOpen}
        workItem={workItem}
        busy={isDeleting}
        onClose={() => {
          if (isDeleting) return
          setDeleteConfirmOpen(false)
        }}
        onConfirm={() => void onDelete()}
      />
    </aside>
  )
}
