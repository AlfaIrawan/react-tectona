import type { ReactNode } from 'react'
import {
  Bug,
  CheckSquare2,
  ClipboardList,
  CornerDownRight,
  GitBranch,
  Layers3,
  Tag,
  TreePine,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type WorkItemSourceKind = 'monday' | 'jira' | 'tectona'

export type DirectoryGanttTaskRow = {
  id?: string | number
  text?: string
  ganttLabel?: string
  ganttWorkItemType?: string
  ganttSource?: WorkItemSourceKind
}

const WORKSPACE_SUMMARY_PREFIX = 'ws:'
const PROJECT_SUMMARY_PREFIX = 'proj:'

export function isSyntheticGanttSummaryId(id: string): boolean {
  return id.startsWith(WORKSPACE_SUMMARY_PREFIX) || id.startsWith(PROJECT_SUMMARY_PREFIX)
}

const MONDAY_LOGO_SRC = '/images/logo-mondays.png'
const JIRA_LOGO_SRC = '/images/logo-jira.png'

const WORK_ITEM_TYPE_ICONS: Record<string, { icon: LucideIcon; className: string }> = {
  Epic: { icon: Layers3, className: 'text-violet-600' },
  Feature: { icon: GitBranch, className: 'text-sky-600' },
  Task: { icon: CheckSquare2, className: 'text-blue-600' },
  Subtask: { icon: CornerDownRight, className: 'text-amber-600' },
  Checklist: { icon: ClipboardList, className: 'text-emerald-600' },
  Bug: { icon: Bug, className: 'text-rose-600' },
}

function readGanttRow(row: unknown): DirectoryGanttTaskRow {
  if (!row || typeof row !== 'object') return {}
  return row as DirectoryGanttTaskRow
}

function GanttIconButton({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children: ReactNode
}) {
  return (
    <span
      title={title}
      aria-label={title}
      className={cn(
        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function DirectoryGanttLabelCell({ row }: { row?: unknown }) {
  const { ganttLabel } = readGanttRow(row)
  const label = ganttLabel?.trim()

  if (!label) {
    return <span className="inline-block h-5 w-5 shrink-0" aria-hidden />
  }

  return (
    <GanttIconButton title={`Label: ${label}`} className="text-slate-500">
      <Tag className="h-3.5 w-3.5" aria-hidden />
    </GanttIconButton>
  )
}

export function DirectoryGanttTypeCell({ row }: { row?: unknown }) {
  const { ganttWorkItemType } = readGanttRow(row)
  const type = ganttWorkItemType?.trim()

  if (!type) {
    return <span className="inline-block h-5 w-5 shrink-0" aria-hidden />
  }

  const meta = WORK_ITEM_TYPE_ICONS[type] ?? { icon: CheckSquare2, className: 'text-slate-500' }
  const Icon = meta.icon

  return (
    <GanttIconButton title={`Type: ${type}`} className={meta.className}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </GanttIconButton>
  )
}

export function DirectoryGanttSourceCell({ row }: { row?: unknown }) {
  const { ganttSource } = readGanttRow(row)

  if (!ganttSource) {
    return <span className="inline-block h-5 w-5 shrink-0" aria-hidden />
  }

  if (ganttSource === 'monday') {
    return (
      <GanttIconButton title="Source: Monday" className="p-0">
        <img src={MONDAY_LOGO_SRC} alt="" aria-hidden className="h-3.5 w-3.5 object-contain" draggable={false} />
      </GanttIconButton>
    )
  }

  if (ganttSource === 'jira') {
    return (
      <GanttIconButton title="Source: Jira" className="p-0">
        <img src={JIRA_LOGO_SRC} alt="" aria-hidden className="h-3.5 w-3.5 object-contain" draggable={false} />
      </GanttIconButton>
    )
  }

  return (
    <GanttIconButton title="Source: Tectona" className="text-emerald-600">
      <TreePine className="h-3.5 w-3.5" aria-hidden />
    </GanttIconButton>
  )
}

const GANTT_ICON_COLUMNS = [
  { id: 'ganttType', header: '', width: 30, align: 'center' as const, cell: DirectoryGanttTypeCell },
  { id: 'ganttLabel', header: '', width: 30, align: 'center' as const, cell: DirectoryGanttLabelCell },
  { id: 'ganttSource', header: '', width: 30, align: 'center' as const, cell: DirectoryGanttSourceCell },
] as const

export const DIRECTORY_GANTT_GRID_COLUMNS = [
  ...GANTT_ICON_COLUMNS.map((col) => ({ ...col, resize: false as const })),
  { id: 'text', header: 'Task title', width: 240, resize: true as const },
  { id: 'start', header: 'Start', width: 110, align: 'center' as const, resize: true as const },
  { id: 'duration', header: 'Duration', width: 90, align: 'center' as const, resize: true as const },
]

/** Project Timeline — fixed column widths so resize only affects the dragged column. */
export const PROJECT_TIMELINE_GANTT_COLUMNS = DIRECTORY_GANTT_GRID_COLUMNS

export type GanttSelectionColumnOptions = {
  selectedIds: string[]
  selectableIds: string[]
  onSelectedIdsChange: (ids: string[]) => void
}

export function buildGanttSelectionColumn({
  selectedIds,
  selectableIds,
  onSelectedIdsChange,
}: GanttSelectionColumnOptions) {
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id))
  const someSelected = selectableIds.some((id) => selectedIds.includes(id))

  function GanttSelectionHeaderCell() {
    return (
      <input
        type="checkbox"
        checked={allSelected}
        ref={(element) => {
          if (element) element.indeterminate = someSelected && !allSelected
        }}
        onChange={() => onSelectedIdsChange(allSelected ? [] : [...selectableIds])}
        onClick={(event) => event.stopPropagation()}
        aria-label="Select all rows"
      />
    )
  }

  function GanttSelectionBodyCell({ row }: { row?: unknown }) {
    const { id: rowId } = readGanttRow(row)
    const id = rowId != null ? String(rowId) : ''
    if (!id || isSyntheticGanttSummaryId(id)) {
      return <span className="inline-block h-5 w-5 shrink-0" aria-hidden />
    }

    const checked = selectedIds.includes(id)
    return (
      <input
        type="checkbox"
        checked={checked}
        onChange={() =>
          onSelectedIdsChange(
            checked ? selectedIds.filter((existingId) => existingId !== id) : [...selectedIds, id],
          )
        }
        onClick={(event) => event.stopPropagation()}
        aria-label={`Select ${readGanttRow(row).text?.trim() || 'row'}`}
      />
    )
  }

  return {
    id: 'ganttSelect',
    header: GanttSelectionHeaderCell,
    width: 36,
    align: 'center' as const,
    resize: false as const,
    cell: GanttSelectionBodyCell,
  }
}

/** Planning timeline — workspace hierarchy with type / label / source icons. */
export const PLANNING_TIMELINE_GANTT_COLUMNS = [
  ...GANTT_ICON_COLUMNS,
  { id: 'text', header: 'Workspace', flexgrow: 2 },
  { id: 'start', header: 'Start', flexgrow: 1, align: 'center' as const },
  { id: 'duration', header: 'Duration', align: 'center' as const, flexgrow: 1 },
  { id: 'add-task', header: '', width: 50, align: 'center' as const },
]
