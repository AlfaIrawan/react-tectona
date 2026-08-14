import type { CSSProperties, ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Activity,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  Circle,
  Eye,
  GripVertical,
  Inbox,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Priority, WorkStatus } from '@/lib/api/workApi'
import { resolveWorkStatusDisplayLabel } from '@/lib/work/kanbanBoardColumnLabels'
import { cn } from '@/lib/utils'
import {
  PROJECT_LIST_DRAG_HANDLE_CLASS,
  PROJECT_LIST_FIRST_COLUMN_TINT_BODY_CLASS,
  PROJECT_LIST_FIRST_COLUMN_TINT_HEADER_CLASS,
  PROJECT_LIST_HEADER_ICON_CLASS,
  PROJECT_LIST_OTHER_COLUMN_TINT_HEADER_CLASS,
  PROJECT_LIST_TABLE_BODY_CELL_CLASS,
  PROJECT_LIST_TABLE_HEAD_CELL_CLASS,
} from '../lib/projectListTableClasses'

export {
  PROJECT_LIST_DRAG_HANDLE_CLASS,
  PROJECT_LIST_FIRST_COLUMN_TINT_BODY_CLASS,
  PROJECT_LIST_FIRST_COLUMN_TINT_HEADER_CLASS,
  PROJECT_LIST_TABLE_BODY_CELL_CLASS,
  PROJECT_LIST_TABLE_HEAD_CELL_CLASS,
}

export const PROJECT_WORK_ITEM_STATUS_CHIP: Record<WorkStatus, string> = {
  Backlog:
    'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/50 dark:bg-violet-950/50 dark:text-violet-100',
  'To Do':
    'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700/50 dark:bg-slate-900/50 dark:text-slate-100',
  'In Progress':
    'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/50 dark:bg-blue-950/50 dark:text-blue-100',
  'In Review':
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/50 dark:text-amber-100',
  Done:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-100',
}

export const PROJECT_WORK_ITEM_PRIORITY_CHIP: Record<Priority, string> = {
  Critical:
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/50 dark:text-rose-100',
  High:
    'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800/50 dark:bg-orange-950/50 dark:text-orange-100',
  Medium:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/50 dark:text-amber-100',
  Low:
    'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700/50 dark:bg-slate-900/50 dark:text-slate-100',
}

const PERSON_AVATAR_PALETTE = [
  'bg-rose-500 text-white',
  'bg-orange-500 text-white',
  'bg-amber-500 text-white',
  'bg-lime-600 text-white',
  'bg-emerald-500 text-white',
  'bg-teal-500 text-white',
  'bg-cyan-600 text-white',
  'bg-sky-500 text-white',
  'bg-blue-600 text-white',
  'bg-indigo-500 text-white',
  'bg-violet-500 text-white',
  'bg-fuchsia-500 text-white',
  'bg-pink-500 text-white',
] as const

function hashLabel(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function personInitials(name: string): string {
  const normalized = name.trim()
  if (!normalized || normalized === 'Unassigned') return '?'
  const parts = normalized.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

function personAvatarClass(name: string): string {
  const normalized = name.trim()
  if (!normalized || normalized === 'Unassigned') {
    return 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200'
  }
  return PERSON_AVATAR_PALETTE[hashLabel(normalized.toLowerCase()) % PERSON_AVATAR_PALETTE.length]
}

export function ProjectWorkItemPersonAvatar({ name }: { name: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold uppercase',
        personAvatarClass(name),
      )}
      aria-hidden
    >
      {personInitials(name)}
    </span>
  )
}

export function normalizeProjectWorkItemStatus(status: string): WorkStatus {
  return (status as string) === 'Blocked' ? 'Backlog' : (status as WorkStatus)
}

export function formatProjectWorkItemDueDateLabel(raw: string | null | undefined): string {
  if (!raw?.trim()) return '—'
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

export function ProjectWorkItemStatusBadge({ status }: { status: WorkStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        PROJECT_WORK_ITEM_STATUS_CHIP[status],
      )}
    >
      {status === 'In Progress' ? (
        <Activity className="h-3 w-3" aria-hidden />
      ) : status === 'Done' ? (
        <CheckCircle2 className="h-3 w-3" aria-hidden />
      ) : status === 'In Review' ? (
        <Eye className="h-3 w-3" aria-hidden />
      ) : status === 'Backlog' ? (
        <Inbox className="h-3 w-3" aria-hidden />
      ) : (
        <Circle className="h-3 w-3" aria-hidden />
      )}
      {resolveWorkStatusDisplayLabel(status)}
    </Badge>
  )
}

export function ProjectWorkItemPriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full border px-2 py-0.5 text-[11px] font-medium',
        PROJECT_WORK_ITEM_PRIORITY_CHIP[priority],
      )}
    >
      {priority}
    </Badge>
  )
}

type ProjectWorkItemTableHeaderCellProps<K extends string, S extends string> = {
  columnKey: K
  pinnedFirstKey: K
  label: string
  icon: LucideIcon
  sortKey: S
  activeSortKey: S
  sortDirection: 'asc' | 'desc'
  onSort: (sortKey: S) => void
  sortable?: boolean
  filterSlot?: ReactNode
  rowDragActive?: boolean
  isLastColumn: boolean
  columnWidthStyle?: CSSProperties
  columnResizingKey: K | null
  onBeginResize: (columnKey: K, startX: number, thElement: HTMLTableCellElement) => void
  draggable?: boolean
}

export function ProjectWorkItemTableHeaderCell<K extends string, S extends string>({
  columnKey,
  pinnedFirstKey,
  label,
  icon: HeaderIcon,
  sortKey,
  activeSortKey,
  sortDirection,
  onSort,
  sortable = true,
  filterSlot,
  rowDragActive = false,
  isLastColumn,
  columnWidthStyle,
  columnResizingKey,
  onBeginResize,
  draggable = true,
}: ProjectWorkItemTableHeaderCellProps<K, S>) {
  const isPinnedFirstColumn = columnKey === pinnedFirstKey
  const isSorted = sortable && activeSortKey === sortKey
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: columnKey,
    disabled: isPinnedFirstColumn || rowDragActive || columnResizingKey != null || !draggable,
  })
  const style: CSSProperties = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    ...columnWidthStyle,
  }

  return (
    <th
      ref={setNodeRef}
      style={style}
      aria-sort={isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(
        'relative',
        PROJECT_LIST_TABLE_HEAD_CELL_CLASS,
        isPinnedFirstColumn
          ? PROJECT_LIST_FIRST_COLUMN_TINT_HEADER_CLASS
          : cn(PROJECT_LIST_OTHER_COLUMN_TINT_HEADER_CLASS, 'whitespace-nowrap'),
        isDragging && 'opacity-70',
      )}
    >
      <div className="flex items-center gap-1.5">
        {!isPinnedFirstColumn && draggable ? (
          <button
            type="button"
            className={cn(
              'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500',
              'hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100',
              'cursor-grab active:cursor-grabbing',
            )}
            aria-label={`Arrange column: ${label}`}
            title="Drag to rearrange columns"
            {...attributes}
            {...listeners}
            onPointerDown={(event) => {
              listeners.onPointerDown?.(event)
              event.stopPropagation()
            }}
          >
            <GripVertical className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
        {sortable ? (
          <button
            type="button"
            onClick={() => onSort(sortKey)}
            className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground hover:text-foreground"
            title={
              isSorted
                ? `Sorted ${sortDirection === 'asc' ? 'ascending' : 'descending'} — click to toggle`
                : 'Sort column'
            }
            aria-label={`Sort by ${label}`}
          >
            <HeaderIcon className={PROJECT_LIST_HEADER_ICON_CLASS} aria-hidden />
            <span>{label}</span>
            <ArrowUpDown
              className={cn(
                'h-3.5 w-3.5 shrink-0 transition-transform',
                isSorted ? 'text-foreground opacity-100' : 'opacity-60',
                isSorted && sortDirection === 'desc' && 'rotate-180',
              )}
              aria-hidden
            />
          </button>
        ) : label ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <HeaderIcon className={PROJECT_LIST_HEADER_ICON_CLASS} aria-hidden />
            <span>{label}</span>
          </span>
        ) : (
          <span className="sr-only">Actions</span>
        )}
        {filterSlot}
      </div>
      {!isLastColumn ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${label} column`}
          title="Drag to resize column"
          className={cn(
            'absolute top-0 right-0 z-30 h-full w-3 translate-x-1/2 cursor-col-resize touch-none',
            'hover:bg-sky-400/15 active:bg-sky-400/25',
            columnResizingKey === columnKey && 'bg-sky-400/30',
          )}
          onMouseDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
            const th = event.currentTarget.closest('th')
            if (!th) return
            onBeginResize(columnKey, event.clientX, th)
          }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.stopPropagation()}
        />
      ) : null}
    </th>
  )
}

export const PROJECT_LIST_PAGE_SIZE_OPTIONS = [10, 25, 50] as const

export const PROJECT_LIST_COLUMN_FILTER_BUTTON_CLASS = cn(
  'inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors',
  'outline-none focus:outline-none focus-visible:outline-none',
  'focus-visible:ring-2 focus-visible:ring-sky-400/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
)

export const PROJECT_LIST_COLUMN_FILTER_MENU_CLASS =
  'w-56 !bg-white !text-slate-900 dark:!bg-slate-950 dark:!text-slate-100 border border-slate-300 dark:border-slate-700 shadow-lg !backdrop-blur-none'

export const PROJECT_LIST_PAGE_SIZE_MENU_CLASS =
  'w-[7.5rem] min-w-[7.5rem] !bg-white !text-slate-900 dark:!bg-slate-950 dark:!text-slate-100 border border-slate-300 dark:border-slate-700 shadow-lg !backdrop-blur-none'

export const PROJECT_LIST_TABLE_SCROLL_CLASS = 'scrollbar-hide min-h-0 flex-1 overflow-auto'

export function clampProjectListColumnWidthPx(px: number): number {
  return Math.max(80, Math.min(520, Math.round(px)))
}

export type ProjectWorkItemTableRowsMeta = {
  total: number
  pageStart: number
  pageEnd: number
  pageSafe: number
  totalPages: number
}

export function ProjectListSelectToggle({
  showSelection,
  onShowSelectionChange,
}: {
  showSelection: boolean
  onShowSelectionChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={showSelection}
      onClick={() => onShowSelectionChange(!showSelection)}
      className="group inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-2 py-1 shadow-sm transition hover:bg-muted/40"
      title="Show/Hide selection checkboxes"
    >
      <span className="text-[11px] font-medium text-muted-foreground">Select</span>
      <span
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors',
          showSelection ? 'bg-primary' : 'bg-muted',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-background shadow-sm transition-transform',
            showSelection ? 'left-0.5 translate-x-4' : 'left-0.5 translate-x-0',
          )}
        />
      </span>
    </button>
  )
}

export function ProjectWorkItemTablePaginationToolbar({
  rowsMeta,
  pageSize,
  onPageSizeChange,
  onPrevPage,
  onNextPage,
  showSelection,
  onShowSelectionChange,
}: {
  rowsMeta: ProjectWorkItemTableRowsMeta
  pageSize: (typeof PROJECT_LIST_PAGE_SIZE_OPTIONS)[number]
  onPageSizeChange: (size: (typeof PROJECT_LIST_PAGE_SIZE_OPTIONS)[number]) => void
  onPrevPage: () => void
  onNextPage: () => void
  showSelection?: boolean
  onShowSelectionChange?: (value: boolean) => void
}) {
  const { pageStart, pageEnd, total, pageSafe, totalPages } = rowsMeta

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {onShowSelectionChange != null && showSelection != null ? (
        <ProjectListSelectToggle
          showSelection={showSelection}
          onShowSelectionChange={onShowSelectionChange}
        />
      ) : null}
      <span>
        Showing{' '}
        <span className="font-semibold text-foreground">
          {pageStart}-{pageEnd}
        </span>{' '}
        of <span className="font-semibold text-foreground">{total}</span>
      </span>
      <span className="text-xs text-muted-foreground">Rows:</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm transition',
              'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30',
            )}
            aria-label="Rows per page"
          >
            <span className="min-w-[20px] text-left tabular-nums">{pageSize}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={PROJECT_LIST_PAGE_SIZE_MENU_CLASS}>
          <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground">
            Rows per page
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PROJECT_LIST_PAGE_SIZE_OPTIONS.map((size) => (
            <DropdownMenuItem
              key={size}
              onClick={() => onPageSizeChange(size)}
              className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs"
            >
              <span className="tabular-nums">{size}</span>
              {pageSize === size ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="flex h-8 items-stretch overflow-hidden rounded-lg border border-border bg-background/80">
        <button
          type="button"
          className="px-2 hover:bg-muted/40 disabled:opacity-50"
          disabled={pageSafe <= 1}
          onClick={onPrevPage}
        >
          Prev
        </button>
        <span className="flex items-center px-2 tabular-nums">
          {pageSafe}/{totalPages}
        </span>
        <button
          type="button"
          className="px-2 hover:bg-muted/40 disabled:opacity-50"
          disabled={pageSafe >= totalPages}
          onClick={onNextPage}
        >
          Next
        </button>
      </div>
    </div>
  )
}
