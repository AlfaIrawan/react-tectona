import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  useDroppable,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Activity,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Circle,
  Eye,
  FolderKanban,
  GripVertical,
  Inbox,
  Tag,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { WorkStatus } from '@/lib/api/workApi'
import {
  loadBoardColumnLabels,
  persistBoardColumnLabels,
  resolveWorkStatusDisplayLabel,
  isCustomWorkStatusLabel,
  WORK_STATUS_VALUES,
  type BoardColumnLabels,
} from '@/lib/work/kanbanBoardColumnLabels'
import { cn } from '@/lib/utils'

const KANBAN_COLUMNS = WORK_STATUS_VALUES
const KANBAN_COLUMN_DND_PREFIX = 'kanban-column:'
const KANBAN_BOARD_COLUMN_PREFIX = 'kanban-board-column:'

type Priority = 'Critical' | 'High' | 'Medium' | 'Low'

export type DirectoryKanbanItem = {
  id: string
  title: string
  type: string
  status: WorkStatus
  priority: Priority
  assignee: string
  workspace: string
  project?: string
  label?: string
  dueDate: string
  progress: number
  syncOrigin?: string
  externalLinks?: Array<{ provider: string }>
}

const KANBAN_UNIDENTIFIED_PROJECT = 'Unidentified'
const KANBAN_UNIDENTIFIED_PROJECT_KEY = '__unidentified__'

type KanbanProjectOption = {
  key: string
  label: string
  count: number
  isUnidentified: boolean
}

function resolveKanbanProjectKey(project?: string | null): string {
  const trimmed = project?.trim()
  return trimmed ? trimmed : KANBAN_UNIDENTIFIED_PROJECT_KEY
}

function resolveKanbanProjectLabel(project?: string | null): string {
  const trimmed = project?.trim()
  return trimmed ? trimmed : KANBAN_UNIDENTIFIED_PROJECT
}

function itemMatchesProjectKey(item: DirectoryKanbanItem, projectKey: string): boolean {
  return resolveKanbanProjectKey(item.project) === projectKey
}

function buildKanbanProjectOptions(items: DirectoryKanbanItem[]): KanbanProjectOption[] {
  const counts = new Map<string, KanbanProjectOption>()

  for (const item of items) {
    const key = resolveKanbanProjectKey(item.project)
    const label = resolveKanbanProjectLabel(item.project)
    const existing = counts.get(key)
    if (existing) {
      existing.count += 1
    } else {
      counts.set(key, {
        key,
        label,
        count: 1,
        isUnidentified: key === KANBAN_UNIDENTIFIED_PROJECT_KEY,
      })
    }
  }

  const identified = [...counts.values()]
    .filter((entry) => !entry.isUnidentified)
    .sort((a, b) => a.label.localeCompare(b.label))

  const unidentified = counts.get(KANBAN_UNIDENTIFIED_PROJECT_KEY)
  return unidentified ? [...identified, unidentified] : identified
}

function boardColumnSortableId(status: WorkStatus): string {
  return `${KANBAN_BOARD_COLUMN_PREFIX}${status}`
}

function resolveBoardColumnStatus(sortableId: string): WorkStatus | null {
  if (!sortableId.startsWith(KANBAN_BOARD_COLUMN_PREFIX)) return null
  return sortableId.slice(KANBAN_BOARD_COLUMN_PREFIX.length) as WorkStatus
}

type ColumnOrderState = Record<WorkStatus, string[]>

type DropTargetHint = {
  status: WorkStatus
  itemId: string | null
  side: 'before' | 'after'
}

const KANBAN_DROP_FADE_MS = 180
const KANBAN_RETURN_DROP_MS = 220

const dropFadeInPlaceRef = { current: false }

const KANBAN_DROP_ANIMATION: DropAnimation = {
  duration: KANBAN_RETURN_DROP_MS,
  easing: 'cubic-bezier(0.2, 0.85, 0.3, 1)',
  keyframes({ transform }) {
    if (dropFadeInPlaceRef.current) {
      const holdTransform = CSS.Transform.toString(transform.initial)
      return [
        { opacity: 1, transform: holdTransform },
        { opacity: 0, transform: holdTransform },
      ]
    }

    return [
      { opacity: 1, transform: CSS.Transform.toString(transform.initial) },
      { opacity: 0.5, transform: CSS.Transform.toString(transform.final) },
    ]
  },
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: { opacity: '0' },
      dragOverlay: { opacity: '0' },
    },
  }),
}

const STATUS_META: Record<
  WorkStatus,
  {
    chip: string
    icon: LucideIcon
    accentBar: string
    columnShell: string
    columnHeader: string
    columnBody: string
    iconWrap: string
    countPill: string
    progressBar: string
  }
> = {
  Backlog: {
    chip: 'border-violet-200/80 bg-violet-50/90 text-violet-800 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-200',
    icon: Inbox,
    accentBar: 'bg-violet-500',
    columnShell: 'border-violet-200/60 bg-white dark:border-violet-900/50 dark:bg-slate-950',
    columnHeader: 'border-violet-200/50 bg-violet-50 dark:border-violet-900/40 dark:bg-violet-950/45',
    columnBody: 'bg-violet-50/30 dark:bg-violet-950/20',
    iconWrap: 'bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300',
    countPill: 'bg-violet-500/10 text-violet-800 ring-violet-500/15 dark:text-violet-200',
    progressBar: 'bg-violet-500',
  },
  'To Do': {
    chip: 'border-slate-200/80 bg-slate-100/90 text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200',
    icon: Circle,
    accentBar: 'bg-slate-400',
    columnShell: 'border-slate-200/70 bg-white dark:border-slate-700/60 dark:bg-slate-950',
    columnHeader: 'border-slate-200/60 bg-slate-50 dark:border-slate-700/50 dark:bg-slate-900',
    columnBody: 'bg-slate-50/40 dark:bg-slate-950/30',
    iconWrap: 'bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300',
    countPill: 'bg-slate-500/10 text-slate-700 ring-slate-500/15 dark:text-slate-200',
    progressBar: 'bg-slate-500',
  },
  'In Progress': {
    chip: 'border-sky-200/80 bg-sky-50/90 text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/50 dark:text-sky-200',
    icon: Activity,
    accentBar: 'bg-sky-500',
    columnShell: 'border-sky-200/60 bg-white dark:border-sky-900/50 dark:bg-slate-950',
    columnHeader: 'border-sky-200/50 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/50',
    columnBody: 'bg-sky-50/30 dark:bg-sky-950/20',
    iconWrap: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300',
    countPill: 'bg-sky-500/10 text-sky-800 ring-sky-500/15 dark:text-sky-200',
    progressBar: 'bg-sky-500',
  },
  'In Review': {
    chip: 'border-amber-200/80 bg-amber-50/90 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200',
    icon: Eye,
    accentBar: 'bg-amber-500',
    columnShell: 'border-amber-200/60 bg-white dark:border-amber-900/50 dark:bg-slate-950',
    columnHeader: 'border-amber-200/50 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/45',
    columnBody: 'bg-amber-50/30 dark:bg-amber-950/20',
    iconWrap: 'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300',
    countPill: 'bg-amber-500/10 text-amber-800 ring-amber-500/15 dark:text-amber-200',
    progressBar: 'bg-amber-500',
  },
  Done: {
    chip: 'border-emerald-200/80 bg-emerald-50/90 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200',
    icon: CheckCircle2,
    accentBar: 'bg-emerald-500',
    columnShell: 'border-emerald-200/60 bg-white dark:border-emerald-900/50 dark:bg-slate-950',
    columnHeader: 'border-emerald-200/50 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/45',
    columnBody: 'bg-emerald-50/30 dark:bg-emerald-950/20',
    iconWrap: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
    countPill: 'bg-emerald-500/10 text-emerald-800 ring-emerald-500/15 dark:text-emerald-200',
    progressBar: 'bg-emerald-500',
  },
}

const PRIORITY_CHIP: Record<Priority, string> = {
  Critical: 'border-rose-200/80 bg-rose-50/95 text-rose-800 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/50 dark:text-rose-200',
  High: 'border-orange-200/80 bg-orange-50/95 text-orange-800 shadow-sm dark:border-orange-900/50 dark:bg-orange-950/50 dark:text-orange-200',
  Medium: 'border-amber-200/80 bg-amber-50/95 text-amber-800 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-200',
  Low: 'border-slate-200/80 bg-slate-50/95 text-slate-700 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/50 dark:text-slate-200',
}

function emptyColumnOrder(): ColumnOrderState {
  return { Backlog: [], 'To Do': [], 'In Progress': [], 'In Review': [], Done: [] }
}

function syncColumnOrder(
  items: DirectoryKanbanItem[],
  previous: ColumnOrderState | null
): ColumnOrderState {
  const idsByStatus = KANBAN_COLUMNS.reduce<Record<WorkStatus, string[]>>((acc, status) => {
    acc[status] = items.filter((item) => item.status === status).map((item) => item.id)
    return acc
  }, emptyColumnOrder())

  return KANBAN_COLUMNS.reduce<ColumnOrderState>((acc, status) => {
    const validIds = new Set(idsByStatus[status])
    const preserved = (previous?.[status] ?? []).filter((id) => validIds.has(id))
    for (const id of idsByStatus[status]) {
      if (!preserved.includes(id)) preserved.push(id)
    }
    acc[status] = preserved
    return acc
  }, emptyColumnOrder())
}

function findContainerForItemId(itemId: string, order: ColumnOrderState): WorkStatus | null {
  for (const status of KANBAN_COLUMNS) {
    if (order[status].includes(itemId)) return status
  }
  return null
}

function resolveOverTarget(
  overId: string,
  overData: unknown
): { status: WorkStatus; itemId: string | null } | null {
  if (overId.startsWith(KANBAN_COLUMN_DND_PREFIX)) {
    return {
      status: overId.slice(KANBAN_COLUMN_DND_PREFIX.length) as WorkStatus,
      itemId: null,
    }
  }

  const data = overData as { status?: WorkStatus; itemId?: string } | undefined
  if (data?.status && data.itemId) {
    return { status: data.status, itemId: data.itemId }
  }

  return null
}

function resolveInsertSide(
  activeCenterY: number | null,
  overTop: number,
  overHeight: number
): 'before' | 'after' {
  if (activeCenterY === null) return 'before'
  const overMidY = overTop + overHeight / 2
  return activeCenterY > overMidY ? 'after' : 'before'
}

function SourceBadge({ item }: { item: DirectoryKanbanItem }) {
  const isMonday =
    item.syncOrigin === 'monday' || (item.externalLinks ?? []).some((link) => link.provider === 'monday')
  const isJira =
    item.syncOrigin === 'jira' || (item.externalLinks ?? []).some((link) => link.provider === 'jira')
  if (!isMonday && !isJira) return null
  return (
    <span
      className={cn(
        'inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] shadow-sm',
        isMonday
          ? 'border-violet-200/80 bg-violet-50/95 text-violet-800 dark:border-violet-800/50 dark:bg-violet-950/50 dark:text-violet-200'
          : 'border-sky-200/80 bg-sky-50/95 text-sky-800 dark:border-sky-800/50 dark:bg-sky-950/50 dark:text-sky-200'
      )}
    >
      {isMonday ? 'Monday' : 'Jira'}
    </span>
  )
}

function KanbanCardTitle({
  title,
  compact,
  isEditing,
  onStartEdit,
  onCommit,
  onCancel,
}: {
  title: string
  compact?: boolean
  isEditing: boolean
  onStartEdit: () => void
  onCommit: (value: string) => void
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isEditing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isEditing])

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        defaultValue={title}
        maxLength={255}
        aria-label="Rename task"
        className={cn(
          'w-full rounded-md border border-border/70 bg-background px-2 py-1 text-[13px] font-semibold leading-snug text-foreground shadow-sm outline-none ring-primary/30 focus-visible:ring-2',
          compact && 'line-clamp-none'
        )}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Enter') {
            event.preventDefault()
            onCommit(event.currentTarget.value)
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
          }
        }}
        onBlur={(event) => onCommit(event.currentTarget.value)}
      />
    )
  }

  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-md px-1 py-0.5 text-left text-[13px] font-semibold leading-snug tracking-tight text-foreground transition-colors',
        'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35',
        compact && 'line-clamp-2'
      )}
      title={`${title} — click to rename`}
      aria-label={`${title} — click to rename`}
      onClick={(event) => {
        event.stopPropagation()
        onStartEdit()
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {title}
    </button>
  )
}

function KanbanCardContent({
  item,
  compact,
  progressBarClass,
  isEditingTitle = false,
  onStartTitleEdit,
  onCommitTitleEdit,
  onCancelTitleEdit,
}: {
  item: DirectoryKanbanItem
  compact?: boolean
  progressBarClass?: string
  isEditingTitle?: boolean
  onStartTitleEdit?: () => void
  onCommitTitleEdit?: (value: string) => void
  onCancelTitleEdit?: () => void
}) {
  const titleEditable = Boolean(onStartTitleEdit && onCommitTitleEdit && onCancelTitleEdit)

  return (
    <>
      {titleEditable ? (
        <KanbanCardTitle
          title={item.title}
          compact={compact}
          isEditing={isEditingTitle}
          onStartEdit={onStartTitleEdit!}
          onCommit={onCommitTitleEdit!}
          onCancel={onCancelTitleEdit!}
        />
      ) : (
        <div className={cn('text-[13px] font-semibold leading-snug tracking-tight text-foreground', compact && 'line-clamp-2')}>
          {item.title}
        </div>
      )}
      {!compact ? (
        <>
          <div className="mt-1 font-mono text-[10px] tracking-wide text-muted-foreground/80">{item.id}</div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <SourceBadge item={item} />
            <Badge variant="outline" className="rounded-md border-border/60 bg-background/80 px-1.5 py-0 text-[9px] font-medium shadow-sm">
              {item.type}
            </Badge>
            <Badge className={cn('rounded-full border px-1.5 py-0 text-[9px] font-semibold', PRIORITY_CHIP[item.priority])}>
              {item.priority}
            </Badge>
          </div>
          <div className="mt-3 space-y-1.5 rounded-lg border border-border/40 bg-muted/20 px-2.5 py-2 text-[10px] text-muted-foreground">
            <div className="truncate font-medium text-foreground/80">{item.workspace}</div>
            {(item.label?.trim() || (item as DirectoryKanbanItem & { board?: string }).board?.trim()) ? (
              <div className="flex items-center gap-1.5 truncate">
                <Tag className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                <span>{item.label?.trim() || (item as DirectoryKanbanItem & { board?: string }).board?.trim()}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="inline-flex min-w-0 items-center gap-1 truncate">
                <UserRound className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                {item.assignee}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
                <CalendarClock className="h-3 w-3 text-slate-400" aria-hidden />
                {item.dueDate}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/80 ring-1 ring-border/30">
              <div
                className={cn('h-full rounded-full shadow-sm', progressBarClass ?? 'bg-sky-500')}
                style={{ width: `${item.progress}%` }}
              />
            </div>
            <span className="shrink-0 text-[9px] font-semibold tabular-nums text-muted-foreground">{item.progress}%</span>
          </div>
        </>
      ) : null}
    </>
  )
}

function KanbanInsertIndicator() {
  return (
    <div className="pointer-events-none relative mx-1 py-1" aria-hidden>
      <div className="h-0.5 rounded-full bg-primary/70" />
      <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
    </div>
  )
}

function KanbanSortableCard({
  item,
  onItemClick,
  isEditingTitle,
  onStartTitleEdit,
  onCommitTitleEdit,
  onCancelTitleEdit,
}: {
  item: DirectoryKanbanItem
  onItemClick: (id: string) => void
  isEditingTitle: boolean
  onStartTitleEdit: () => void
  onCommitTitleEdit: (value: string) => void
  onCancelTitleEdit: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { type: 'item', itemId: item.id, status: item.status },
  })

  const meta = STATUS_META[item.status]

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn('touch-none', isDragging && 'invisible')}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!isEditingTitle) onItemClick(item.id)
        }}
        onKeyDown={(event) => {
          if (isEditingTitle) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onItemClick(item.id)
          }
        }}
        className={cn(
          'group relative w-full cursor-grab overflow-hidden rounded-xl border border-border/50',
          'bg-card p-3.5 text-left shadow-sm transition-all duration-200',
          'hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md',
          'active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35'
        )}
      >
        <KanbanCardContent
          item={item}
          progressBarClass={meta.progressBar}
          isEditingTitle={isEditingTitle}
          onStartTitleEdit={onStartTitleEdit}
          onCommitTitleEdit={onCommitTitleEdit}
          onCancelTitleEdit={onCancelTitleEdit}
        />
      </div>
    </div>
  )
}

function KanbanColumnDropZone({
  status,
  children,
  className,
}: {
  status: WorkStatus
  children: ReactNode
  className?: string
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${KANBAN_COLUMN_DND_PREFIX}${status}`,
    data: { type: 'column', status },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        isOver && 'bg-primary/[0.04] ring-2 ring-inset ring-primary/20'
      )}
    >
      {children}
    </div>
  )
}

function BoardColumnHeaderTitle({
  status,
  displayLabel,
  isCustomLabel,
  isEditing,
  onStartEdit,
  onCommit,
  onCancel,
}: {
  status: WorkStatus
  displayLabel: string
  isCustomLabel: boolean
  isEditing: boolean
  onStartEdit: () => void
  onCommit: (value: string) => void
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isEditing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isEditing])

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        defaultValue={displayLabel}
        maxLength={48}
        aria-label={`Rename ${status} column`}
        className="h-6 min-w-0 max-w-[9rem] rounded-md border border-border/70 bg-background px-1.5 text-[11px] font-semibold text-foreground shadow-sm outline-none ring-primary/30 focus-visible:ring-2"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Enter') {
            event.preventDefault()
            onCommit(event.currentTarget.value)
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
          }
        }}
        onBlur={(event) => onCommit(event.currentTarget.value)}
      />
    )
  }

  return (
    <button
      type="button"
      className={cn(
        'max-w-[9rem] truncate rounded-md px-1 py-0.5 text-left text-[11px] font-semibold tracking-[0.1em] text-foreground/90 transition-colors',
        'hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35',
        isCustomLabel ? 'normal-case' : 'uppercase'
      )}
      title={`${displayLabel} — click to rename`}
      aria-label={`${displayLabel} column title — click to rename`}
      onClick={(event) => {
        event.stopPropagation()
        onStartEdit()
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {displayLabel}
    </button>
  )
}

function KanbanSortableBoardColumn({
  status,
  meta,
  itemCount,
  displayLabel,
  isCustomLabel,
  isEditingTitle,
  onStartTitleEdit,
  onCommitTitleEdit,
  onCancelTitleEdit,
  children,
}: {
  status: WorkStatus
  meta: (typeof STATUS_META)[WorkStatus]
  itemCount: number
  displayLabel: string
  isCustomLabel: boolean
  isEditingTitle: boolean
  onStartTitleEdit: () => void
  onCommitTitleEdit: (value: string) => void
  onCancelTitleEdit: () => void
  children: ReactNode
}) {
  const StatusIcon = meta.icon
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: boardColumnSortableId(status),
    data: { type: 'board-column', status },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/column relative flex min-h-0 min-w-[13rem] flex-1 flex-col overflow-hidden rounded-2xl border shadow-sm',
        meta.columnShell,
        isDragging && 'z-10 opacity-90 ring-2 ring-primary/25'
      )}
    >
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-1', meta.accentBar)} />
      <div className={cn('flex items-center justify-between gap-2 border-b px-3 py-3', meta.columnHeader)}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className={cn(
              'flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground/70 transition-colors',
              'hover:bg-background/80 hover:text-foreground active:cursor-grabbing',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35'
            )}
            aria-label={`Drag ${status} column`}
            title="Drag to reorder column"
          >
            <GripVertical className="h-4 w-4" aria-hidden />
          </button>
          <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1', meta.iconWrap)}>
            <StatusIcon className="h-3.5 w-3.5" aria-hidden />
          </div>
          <div className="min-w-0">
            <BoardColumnHeaderTitle
              status={status}
              displayLabel={displayLabel}
              isCustomLabel={isCustomLabel}
              isEditing={isEditingTitle}
              onStartEdit={onStartTitleEdit}
              onCommit={onCommitTitleEdit}
              onCancel={onCancelTitleEdit}
            />
          </div>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ring-1', meta.countPill)}>
          {itemCount}
        </span>
      </div>
      {children}
    </div>
  )
}

function KanbanBoardColumnOverlay({
  status,
  itemCount,
  displayLabel,
  isCustomLabel,
}: {
  status: WorkStatus
  itemCount: number
  displayLabel: string
  isCustomLabel: boolean
}) {
  const meta = STATUS_META[status]
  const StatusIcon = meta.icon
  return (
    <div
      className={cn(
        'pointer-events-none w-[13rem] overflow-hidden rounded-2xl border shadow-[0_24px_60px_-20px_rgba(15,23,42,0.45)]',
        meta.columnShell
      )}
    >
      <div className={cn('pointer-events-none h-1', meta.accentBar)} />
      <div className={cn('flex items-center justify-between gap-2 border-b px-3 py-3', meta.columnHeader)}>
        <div className="flex min-w-0 items-center gap-2">
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1', meta.iconWrap)}>
            <StatusIcon className="h-3.5 w-3.5" aria-hidden />
          </div>
          <p
            className={cn(
              'truncate text-[11px] font-semibold tracking-[0.1em] text-foreground/90',
              isCustomLabel ? 'normal-case' : 'uppercase'
            )}
          >
            {displayLabel}
          </p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ring-1', meta.countPill)}>
          {itemCount}
        </span>
      </div>
      <div className={cn('px-3 py-4 text-[10px] font-medium text-muted-foreground', meta.columnBody)}>
        Reordering status columns…
      </div>
    </div>
  )
}

function KanbanProjectSidebar({
  options,
  selectedProjectKey,
  onSelectProject,
}: {
  options: KanbanProjectOption[]
  selectedProjectKey: string | null
  onSelectProject: (projectKey: string) => void
}) {
  return (
    <nav
      className="relative flex shrink-0 flex-col border-b border-border/50 bg-muted/20 lg:w-64 lg:min-h-0 lg:border-b-0 lg:border-r"
      aria-label="Board project filter"
    >
      <div className="border-b border-border/40 px-4 pb-3 pt-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900/[0.04] ring-1 ring-border/60 dark:bg-white/[0.05]">
            <Briefcase className="h-4 w-4 text-slate-600 dark:text-slate-300" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-foreground">Projects</div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Filter the board by project. Column headers use the same Status values as List view.
            </p>
          </div>
        </div>
      </div>
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-3 py-3 lg:px-4 lg:py-4">
        {options.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/50 bg-background/40 px-3 py-4 text-center text-[11px] text-muted-foreground">
            No projects in the current view.
          </p>
        ) : (
          <div className="space-y-1">
            {options.map((option) => {
              const active = selectedProjectKey === option.key
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => onSelectProject(option.key)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200',
                    option.isUnidentified
                      ? active
                        ? 'border border-amber-500/35 bg-amber-50 text-amber-950 ring-1 ring-amber-500/20 dark:bg-amber-950/40 dark:text-amber-100'
                        : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
                      : active
                        ? 'border border-border/60 bg-background text-foreground ring-1 ring-border/70'
                        : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
                  )}
                >
                  <span className={cn('min-w-0 truncate', option.isUnidentified && !active && 'text-amber-800/90 dark:text-amber-200/90')}>
                    {option.label}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ring-1',
                      active
                        ? option.isUnidentified
                          ? 'bg-amber-500/15 text-amber-900 ring-amber-500/20 dark:text-amber-100'
                          : 'bg-slate-900/5 text-foreground ring-border/50 dark:bg-white/10'
                        : 'bg-muted/60 text-muted-foreground ring-transparent'
                    )}
                  >
                    {option.count}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </nav>
  )
}

type DirectoryKanbanViewProps = {
  items: DirectoryKanbanItem[]
  onItemClick: (id: string) => void
  onStatusChange?: (itemId: string, status: WorkStatus) => void | Promise<void>
  onTitleChange?: (itemId: string, title: string) => void | Promise<void>
  /** Hide project filter sidebar + active-project banner (single-project embedded board). */
  hideProjectChrome?: boolean
}

function KanbanDragOverlayCard({
  item,
  widthPx,
}: {
  item: DirectoryKanbanItem
  widthPx: number
}) {
  const meta = STATUS_META[item.status]
  return (
    <div className="pointer-events-none" style={{ width: widthPx }}>
      <div className="kanban-drag-overlay-inner overflow-hidden rounded-xl border border-primary/35 bg-card p-3.5 shadow-lg ring-1 ring-primary/20">
        <KanbanCardContent item={item} progressBarClass={meta.progressBar} />
      </div>
    </div>
  )
}

export function DirectoryKanbanView({
  items,
  onItemClick,
  onStatusChange,
  onTitleChange,
  hideProjectChrome = false,
}: DirectoryKanbanViewProps) {
  const [selectedProjectKey, setSelectedProjectKey] = useState<string | null>(null)
  const [boardColumnSequence, setBoardColumnSequence] = useState<WorkStatus[]>(() => [...KANBAN_COLUMNS])
  const [boardColumnLabels, setBoardColumnLabels] = useState<BoardColumnLabels>(() => loadBoardColumnLabels())
  const [editingBoardColumnStatus, setEditingBoardColumnStatus] = useState<WorkStatus | null>(null)
  const [editingKanbanItemId, setEditingKanbanItemId] = useState<string | null>(null)
  const [activeItem, setActiveItem] = useState<DirectoryKanbanItem | null>(null)
  const [activeBoardColumn, setActiveBoardColumn] = useState<WorkStatus | null>(null)
  const [activeItemWidthPx, setActiveItemWidthPx] = useState(240)
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() => syncColumnOrder(items, null))
  const [dropTarget, setDropTarget] = useState<DropTargetHint | null>(null)
  const [pendingStatuses, setPendingStatuses] = useState<Record<string, WorkStatus>>({})
  const clearOverlayTimerRef = useRef<number | null>(null)
  const dragStartStatusRef = useRef<WorkStatus | null>(null)

  const commitBoardColumnLabel = useCallback((status: WorkStatus, value: string) => {
    setEditingBoardColumnStatus(null)
    const trimmed = value.trim()
    setBoardColumnLabels((previous) => {
      const next = { ...previous }
      if (!trimmed || trimmed === status) {
        delete next[status]
      } else {
        next[status] = trimmed
      }
      persistBoardColumnLabels(next)
      return next
    })
  }, [])

  const commitKanbanItemTitle = useCallback(
    async (itemId: string, value: string) => {
      setEditingKanbanItemId(null)
      const trimmed = value.trim()
      const item = items.find((entry) => entry.id === itemId)
      if (!item || !trimmed || trimmed === item.title) return

      try {
        await onTitleChange?.(itemId, trimmed)
      } catch {
        // Parent rolls back optimistic state.
      }
    },
    [items, onTitleChange]
  )

  const projectOptions = useMemo(() => buildKanbanProjectOptions(items), [items])

  const selectedProject = useMemo(
    () => projectOptions.find((option) => option.key === selectedProjectKey) ?? null,
    [projectOptions, selectedProjectKey]
  )

  const visibleItems = useMemo(() => {
    if (hideProjectChrome) return items
    if (!selectedProjectKey) return []
    return items.filter((item) => itemMatchesProjectKey(item, selectedProjectKey))
  }, [hideProjectChrome, items, selectedProjectKey])

  useEffect(() => {
    if (projectOptions.length === 0) {
      setSelectedProjectKey(null)
      return
    }
    setSelectedProjectKey((current) =>
      current && projectOptions.some((option) => option.key === current) ? current : projectOptions[0].key
    )
  }, [projectOptions])

  const itemsById = useMemo(() => {
    return new Map(
      visibleItems.map((item) => {
        const pendingStatus = pendingStatuses[item.id]
        return [item.id, pendingStatus ? { ...item, status: pendingStatus } : item] as const
      })
    )
  }, [visibleItems, pendingStatuses])

  useEffect(() => {
    if (activeItem) return
    setColumnOrder((previous) => syncColumnOrder(visibleItems, previous))
  }, [activeItem, visibleItems])

  useEffect(() => {
    setPendingStatuses((current) => {
      if (Object.keys(current).length === 0) return current
      const next: Record<string, WorkStatus> = {}
      for (const [itemId, status] of Object.entries(current)) {
        const item = visibleItems.find((entry) => entry.id === itemId)
        if (item && item.status !== status) next[itemId] = status
      }
      return next
    })
  }, [visibleItems])

  useEffect(
    () => () => {
      if (clearOverlayTimerRef.current !== null) {
        window.clearTimeout(clearOverlayTimerRef.current)
      }
    },
    []
  )

  const boardColumnSortableIds = useMemo(
    () => boardColumnSequence.map((status) => boardColumnSortableId(status)),
    [boardColumnSequence]
  )

  const boardColumnItemCounts = useMemo(() => {
    return boardColumnSequence.reduce<Record<WorkStatus, number>>((acc, status) => {
      acc[status] = columnOrder[status].filter((id) => itemsById.has(id)).length
      return acc
    }, emptyColumnOrder())
  }, [boardColumnSequence, columnOrder, itemsById])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const scheduleOverlayClear = (delayMs: number) => {
    if (clearOverlayTimerRef.current !== null) {
      window.clearTimeout(clearOverlayTimerRef.current)
    }
    clearOverlayTimerRef.current = window.setTimeout(() => {
      dropFadeInPlaceRef.current = false
      setActiveItem(null)
      setActiveItemWidthPx(240)
      dragStartStatusRef.current = null
      clearOverlayTimerRef.current = null
    }, delayMs)
  }

  const resetDragUi = () => {
    if (clearOverlayTimerRef.current !== null) {
      window.clearTimeout(clearOverlayTimerRef.current)
      clearOverlayTimerRef.current = null
    }
    dropFadeInPlaceRef.current = false
    setActiveItem(null)
    setActiveBoardColumn(null)
    setActiveItemWidthPx(240)
    setDropTarget(null)
    dragStartStatusRef.current = null
  }

  const handleDragStart = (event: DragStartEvent) => {
    const dragType = event.active.data.current?.type
    if (dragType === 'board-column') {
      setActiveBoardColumn((event.active.data.current?.status as WorkStatus) ?? null)
      return
    }

    const itemId = String(event.active.id)
    const item = visibleItems.find((entry) => entry.id === itemId) ?? null
    const measuredWidth = event.active.rect.current.initial?.width
    dragStartStatusRef.current = findContainerForItemId(itemId, columnOrder)
    setActiveItemWidthPx(measuredWidth && measuredWidth > 0 ? measuredWidth : 240)
    setActiveItem(item)
  }

  const handleDragOver = (event: DragOverEvent) => {
    if (event.active.data.current?.type === 'board-column') return

    const { active, over } = event
    if (!over) {
      setDropTarget(null)
      return
    }

    const activeItemId = String(active.id)
    const target = resolveOverTarget(String(over.id), over.data.current)
    if (!target) return

    const activeContainer = findContainerForItemId(activeItemId, columnOrder)
    if (!activeContainer) return

    const activeTranslated = active.rect.current.translated
    const activeCenterY =
      activeTranslated !== null
        ? activeTranslated.top + activeTranslated.height / 2
        : null

    let insertSide: 'before' | 'after' = 'before'
    let insertIndex = columnOrder[target.status].length

    if (target.itemId && target.itemId !== activeItemId) {
      insertSide = resolveInsertSide(activeCenterY, over.rect.top, over.rect.height)
      const overIndex = columnOrder[target.status].indexOf(target.itemId)
      if (overIndex >= 0) {
        insertIndex = insertSide === 'after' ? overIndex + 1 : overIndex
      }
    } else if (target.itemId === activeItemId) {
      setDropTarget({
        status: target.status,
        itemId: target.itemId,
        side: resolveInsertSide(activeCenterY, over.rect.top, over.rect.height),
      })
      return
    } else if (!target.itemId) {
      insertSide = columnOrder[target.status].length === 0 ? 'before' : 'after'
      insertIndex = columnOrder[target.status].length
    }

    setDropTarget({
      status: target.status,
      itemId: target.itemId,
      side: insertSide,
    })

    setColumnOrder((previous) => {
      const sourceItems = [...previous[activeContainer]]
      const activeIndex = sourceItems.indexOf(activeItemId)
      if (activeIndex === -1) return previous

      const destinationItems =
        activeContainer === target.status
          ? sourceItems
          : [...previous[target.status].filter((id) => id !== activeItemId)]

      let nextIndex = insertIndex
      if (activeContainer === target.status && activeIndex < insertIndex) {
        nextIndex -= 1
      }
      nextIndex = Math.max(0, Math.min(nextIndex, destinationItems.length))

      const nextSourceItems =
        activeContainer === target.status
          ? destinationItems.filter((id) => id !== activeItemId)
          : sourceItems.filter((id) => id !== activeItemId)

      const nextDestinationItems = [...destinationItems.filter((id) => id !== activeItemId)]
      nextDestinationItems.splice(nextIndex, 0, activeItemId)

      const unchanged =
        activeContainer === target.status
          ? nextDestinationItems.length === previous[target.status].length &&
            nextDestinationItems.every((id, index) => id === previous[target.status][index])
          : previous[activeContainer].join('|') === nextSourceItems.join('|') &&
            previous[target.status].join('|') === nextDestinationItems.join('|')

      if (unchanged) return previous

      if (activeContainer === target.status) {
        return { ...previous, [target.status]: nextDestinationItems }
      }

      return {
        ...previous,
        [activeContainer]: nextSourceItems,
        [target.status]: nextDestinationItems,
      }
    })

    if (activeContainer !== target.status) {
      setPendingStatuses((current) => ({ ...current, [activeItemId]: target.status }))
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (active.data.current?.type === 'board-column') {
      const activeStatus = active.data.current.status as WorkStatus
      const overStatus = over ? resolveBoardColumnStatus(String(over.id)) : null
      if (overStatus && overStatus !== activeStatus) {
        setBoardColumnSequence((previous) => {
          const oldIndex = previous.indexOf(activeStatus)
          const newIndex = previous.indexOf(overStatus)
          if (oldIndex === -1 || newIndex === -1) return previous
          const next = arrayMove(previous, oldIndex, newIndex)
          return next
        })
      }
      setActiveBoardColumn(null)
      return
    }

    const itemId = String(active.id)
    const item = visibleItems.find((entry) => entry.id === itemId)
    const finalStatus = findContainerForItemId(itemId, columnOrder)
    const startStatus = dragStartStatusRef.current
    const statusChanged = Boolean(
      item && finalStatus && startStatus && finalStatus !== startStatus && onStatusChange
    )

    setDropTarget(null)

    if (!over || !item || !finalStatus) {
      dropFadeInPlaceRef.current = false
      setColumnOrder((previous) => syncColumnOrder(visibleItems, previous))
      setPendingStatuses({})
      scheduleOverlayClear(KANBAN_RETURN_DROP_MS)
      return
    }

    dropFadeInPlaceRef.current = true
    scheduleOverlayClear(KANBAN_DROP_FADE_MS)

    if (statusChanged && finalStatus) {
      void (async () => {
        try {
          await onStatusChange?.(itemId, finalStatus)
        } catch {
          setColumnOrder((previous) => syncColumnOrder(visibleItems, previous))
          setPendingStatuses({})
        }
      })()
    }
  }

  const handleDragCancel = (_event: DragCancelEvent) => {
    setColumnOrder((previous) => syncColumnOrder(visibleItems, previous))
    setPendingStatuses({})
    resetDragUi()
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col lg:flex-row">
      {!hideProjectChrome ? (
        <KanbanProjectSidebar
          options={projectOptions}
          selectedProjectKey={selectedProjectKey}
          onSelectProject={setSelectedProjectKey}
        />
      ) : null}

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-muted/15 p-4 dark:bg-muted/10">
        {!hideProjectChrome && selectedProject ? (
          <div className="mb-3 flex shrink-0 items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/70 px-4 py-2.5 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.15)] backdrop-blur-sm">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900/[0.04] ring-1 ring-border/60 dark:bg-white/[0.05]">
                <FolderKanban className="h-4 w-4 text-slate-600 dark:text-slate-300" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Active project</p>
                <p className="truncate text-sm font-semibold tracking-tight text-foreground">{selectedProject.label}</p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-muted/70 px-2.5 py-1 text-[10px] font-semibold tabular-nums text-muted-foreground ring-1 ring-border/40">
              {selectedProject.count} items
            </span>
          </div>
        ) : null}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={boardColumnSortableIds} strategy={horizontalListSortingStrategy}>
            <div className="flex h-full min-h-0 w-full min-w-0 flex-1 gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {boardColumnSequence.map((status) => {
                const columnItemIds = columnOrder[status]
                const columnItems = columnItemIds
                  .map((id) => itemsById.get(id))
                  .filter((item): item is DirectoryKanbanItem => Boolean(item))
                const meta = STATUS_META[status]
                const StatusIcon = meta.icon
                const showEndIndicator =
                  dropTarget?.status === status &&
                  dropTarget.itemId === null &&
                  dropTarget.side === 'after' &&
                  columnItems.length > 0

                return (
                  <KanbanSortableBoardColumn
                    key={status}
                    status={status}
                    meta={meta}
                    itemCount={boardColumnItemCounts[status]}
                    displayLabel={resolveWorkStatusDisplayLabel(status, boardColumnLabels)}
                    isCustomLabel={isCustomWorkStatusLabel(status, boardColumnLabels)}
                    isEditingTitle={editingBoardColumnStatus === status}
                    onStartTitleEdit={() => {
                      setEditingKanbanItemId(null)
                      setEditingBoardColumnStatus(status)
                    }}
                    onCommitTitleEdit={(value) => commitBoardColumnLabel(status, value)}
                    onCancelTitleEdit={() => setEditingBoardColumnStatus(null)}
                  >
                    <KanbanColumnDropZone
                      status={status}
                      className={cn(
                        'scrollbar-hide flex min-h-[140px] flex-1 flex-col gap-2.5 overflow-y-auto p-2.5 transition-colors',
                        meta.columnBody
                      )}
                    >
                      <SortableContext items={columnItemIds} strategy={verticalListSortingStrategy}>
                        {columnItems.length === 0 ? (
                          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-background/35 px-4 py-8 text-center backdrop-blur-sm">
                            {dropTarget?.status === status ? (
                              <div className="mb-3 w-full">
                                <KanbanInsertIndicator />
                              </div>
                            ) : (
                              <div className={cn('mb-2.5 flex h-10 w-10 items-center justify-center rounded-full ring-1', meta.iconWrap)}>
                                <StatusIcon className="h-4 w-4 opacity-70" aria-hidden />
                              </div>
                            )}
                            <span className="text-[11px] font-medium text-muted-foreground/85">Drop tasks here</span>
                          </div>
                        ) : (
                          <>
                            {columnItems.map((item) => (
                              <Fragment key={item.id}>
                                {dropTarget?.status === status &&
                                dropTarget.itemId === item.id &&
                                dropTarget.side === 'before' ? (
                                  <KanbanInsertIndicator />
                                ) : null}
                                <KanbanSortableCard
                                  item={item}
                                  onItemClick={onItemClick}
                                  isEditingTitle={editingKanbanItemId === item.id}
                                  onStartTitleEdit={() => {
                                    setEditingBoardColumnStatus(null)
                                    setEditingKanbanItemId(item.id)
                                  }}
                                  onCommitTitleEdit={(value) => void commitKanbanItemTitle(item.id, value)}
                                  onCancelTitleEdit={() => setEditingKanbanItemId(null)}
                                />
                                {dropTarget?.status === status &&
                                dropTarget.itemId === item.id &&
                                dropTarget.side === 'after' ? (
                                  <KanbanInsertIndicator />
                                ) : null}
                              </Fragment>
                            ))}
                            {showEndIndicator ? <KanbanInsertIndicator /> : null}
                          </>
                        )}
                      </SortableContext>
                    </KanbanColumnDropZone>
                  </KanbanSortableBoardColumn>
                )
              })}
            </div>
          </SortableContext>

          {typeof document !== 'undefined'
            ? createPortal(
                <DragOverlay
                  zIndex={1500}
                  dropAnimation={activeBoardColumn ? null : KANBAN_DROP_ANIMATION}
                  className="cursor-grabbing"
                >
                  {activeItem ? (
                    <KanbanDragOverlayCard item={activeItem} widthPx={activeItemWidthPx} />
                  ) : activeBoardColumn ? (
                    <KanbanBoardColumnOverlay
                      status={activeBoardColumn}
                      itemCount={boardColumnItemCounts[activeBoardColumn]}
                      displayLabel={resolveWorkStatusDisplayLabel(activeBoardColumn, boardColumnLabels)}
                      isCustomLabel={isCustomWorkStatusLabel(activeBoardColumn, boardColumnLabels)}
                    />
                  ) : null}
                </DragOverlay>,
                document.body
              )
            : null}

          <style>{`
            @keyframes kanban-drag-lift {
              from {
                opacity: 0.88;
                box-shadow: 0 8px 20px rgba(15, 23, 42, 0.14);
              }
              to {
                opacity: 1;
                box-shadow: 0 22px 50px rgba(15, 23, 42, 0.38);
              }
            }
            .kanban-drag-overlay-inner {
              transform: rotate(1.5deg) scale(1.02);
              transform-origin: center center;
              animation: kanban-drag-lift 160ms cubic-bezier(0.2, 0.85, 0.3, 1) forwards;
            }
          `}</style>
        </DndContext>
      </div>
    </div>
  )
}
