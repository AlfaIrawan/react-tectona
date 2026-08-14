import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  type CSSProperties,
  type Dispatch,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { createPortal } from 'react-dom'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Activity,
  Archive,
  ArrowUpDown,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CheckSquare2,
  ChevronDown,
  Circle,
  Eye,
  Filter,
  GripVertical,
  Inbox,
  Layers3,
  List,
  ListChecks,
  Maximize2,
  Minimize2,
  Search,
  Signal,
  Square,
  Users,
  Workflow,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectItem } from '@/components/ui/select'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { useToast } from '@/components/ui/toast'
import {
  archiveProjectWorkItemApi,
  batchPatchWorkItems,
  createWorkItem,
  patchWorkItem,
  TECTONA_PROJECT_WORKSPACE,
  type Priority,
  type WorkItemApiModel,
  type WorkItemType,
  type WorkStatus,
} from '@/lib/api/workApi'
import { WORK_STATUS_VALUES, resolveWorkStatusDisplayLabel } from '@/lib/work/kanbanBoardColumnLabels'
import {
  WORK_ITEM_TYPE_OPTIONS,
  WorkItemTypeIcon,
  renderWorkItemTypeSelectOption,
} from '@/lib/work/workItemTypeMeta'
import {
  DirectoryInlineDateCell,
  DirectoryInlineSelectCell,
  DirectoryInlineTextCell,
} from '@/modules/task-work-management/components/DirectoryListInlineCell'
import { reorderDirectoryFlatRowIds } from '@/modules/task-work-management/utils/directorySiblingOrder'
import { cn } from '@/lib/utils'
import type { ProjectTemplate } from '../data/projectTemplates'
import type { Project } from '../store/projectStore'
import {
  measureProjectPanelHeight,
  PROJECT_PANEL_MIN_HEIGHT_PX,
} from '../lib/projectPanelLayout'
import {
  archiveWorkItemManual,
  isWorkItemArchivable,
} from '../lib/projectArchivedWorkItems'
import { resolveProjectMemberAvatars } from '../lib/projectDisplay'
import { projectWorkItemBusinessKeyPrefix } from '../lib/projectWorkItemUtils'

const listToolbarFocusClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30 focus-visible:ring-offset-0'

const STATUS_OPTIONS = WORK_STATUS_VALUES
const PRIORITY_OPTIONS: Priority[] = ['Critical', 'High', 'Medium', 'Low']
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const

const HEADER_ICON_CLASS = 'h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400'

type ProjectListSortKey =
  | 'title'
  | 'type'
  | 'status'
  | 'priority'
  | 'assignee'
  | 'dueDate'
  | 'progress'
  | 'manual'

type ProjectListRowDropTarget = {
  itemId: string
  side: 'before' | 'after'
}

type ProjectListFilterKey = 'type' | 'status' | 'priority' | 'assignee'

const COLUMN_FILTER_BUTTON_CLASS = cn(
  'inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors',
  'outline-none focus:outline-none focus-visible:outline-none',
  'focus-visible:ring-2 focus-visible:ring-sky-400/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
)

const COLUMN_FILTER_MENU_CLASS =
  'w-56 !bg-white !text-slate-900 dark:!bg-slate-950 dark:!text-slate-100 border border-slate-300 dark:border-slate-700 shadow-lg !backdrop-blur-none'

const PAGE_SIZE_MENU_CLASS =
  'w-[7.5rem] min-w-[7.5rem] !bg-white !text-slate-900 dark:!bg-slate-950 dark:!text-slate-100 border border-slate-300 dark:border-slate-700 shadow-lg !backdrop-blur-none'

const STATUS_ORDER: Record<WorkStatus, number> = {
  Backlog: 0,
  'To Do': 1,
  'In Progress': 2,
  'In Review': 3,
  Done: 4,
}

const PRIORITY_ORDER: Record<Priority, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
}

type ProjectListColumnKey = 'title' | 'type' | 'status' | 'priority' | 'assignee' | 'due' | 'progress'

const PROJECT_LIST_PINNED_FIRST_COLUMN: ProjectListColumnKey = 'title'

const DEFAULT_PROJECT_LIST_COLUMN_ORDER: ProjectListColumnKey[] = [
  'title',
  'type',
  'status',
  'priority',
  'assignee',
  'due',
  'progress',
]

const PROJECT_LIST_COLUMN_ID_SET = new Set<string>(DEFAULT_PROJECT_LIST_COLUMN_ORDER)

function isProjectListColumnId(id: string): id is ProjectListColumnKey {
  return PROJECT_LIST_COLUMN_ID_SET.has(id)
}

const PROJECT_LIST_COLUMN_WIDTH_MIN_PX = 80
const PROJECT_LIST_COLUMN_WIDTH_MAX_PX = 520

function clampProjectListColumnWidthPx(px: number): number {
  return Math.max(
    PROJECT_LIST_COLUMN_WIDTH_MIN_PX,
    Math.min(PROJECT_LIST_COLUMN_WIDTH_MAX_PX, Math.round(px)),
  )
}

const TABLE_HEADERS: Array<{
  key: ProjectListColumnKey
  sortKey: ProjectListSortKey
  filterKey?: ProjectListFilterKey
  label: string
  icon: typeof ListChecks
  colClassName: string
}> = [
  {
    key: 'title',
    sortKey: 'title',
    label: 'Task title',
    icon: ListChecks,
    colClassName: 'w-[28%]',
  },
  {
    key: 'type',
    sortKey: 'type',
    filterKey: 'type',
    label: 'Type',
    icon: Layers3,
    colClassName: 'w-[9%]',
  },
  {
    key: 'status',
    sortKey: 'status',
    filterKey: 'status',
    label: 'Status',
    icon: Workflow,
    colClassName: 'w-[12%]',
  },
  {
    key: 'priority',
    sortKey: 'priority',
    filterKey: 'priority',
    label: 'Priority',
    icon: Signal,
    colClassName: 'w-[9%]',
  },
  {
    key: 'assignee',
    sortKey: 'assignee',
    filterKey: 'assignee',
    label: 'Assignee',
    icon: Users,
    colClassName: 'w-[14%]',
  },
  {
    key: 'due',
    sortKey: 'dueDate',
    label: 'Due date',
    icon: CalendarClock,
    colClassName: 'w-[13%]',
  },
  {
    key: 'progress',
    sortKey: 'progress',
    label: 'Progress',
    icon: BarChart3,
    colClassName: 'w-[15%]',
  },
]

const PROJECT_LIST_HEADER_BY_KEY = Object.fromEntries(
  TABLE_HEADERS.map((header) => [header.key, header]),
) as Record<ProjectListColumnKey, (typeof TABLE_HEADERS)[number]>

const TABLE_HEAD_CELL_CLASS =
  'select-none border-b-[3px] border-double border-slate-300/90 px-2 py-2 text-left font-semibold backdrop-blur dark:border-slate-600/80'

const PROJECT_LIST_FIRST_COLUMN_TINT_HEADER_CLASS = 'bg-slate-50/95 dark:bg-slate-800/55'
const PROJECT_LIST_FIRST_COLUMN_TINT_BODY_CLASS = 'bg-slate-50/70 dark:bg-slate-800/35'
const PROJECT_LIST_OTHER_COLUMN_TINT_HEADER_CLASS = 'bg-white/90 dark:bg-slate-900/90'

const TABLE_BODY_CELL_CLASS =
  'border-b border-slate-200/20 px-2 py-2 align-top transition-colors dark:border-slate-700/20'

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

function PersonAvatar({ name }: { name: string }) {
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

function formatDueDateLabel(raw: string): string {
  if (!raw?.trim()) return '—'
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function ProjectListStatusIcon({ status, className }: { status: WorkStatus; className?: string }) {
  const iconClass = cn('h-3.5 w-3.5 shrink-0', className)
  if (status === 'In Progress') return <Activity className={iconClass} aria-hidden />
  if (status === 'Done') return <CheckCircle2 className={iconClass} aria-hidden />
  if (status === 'In Review') return <Eye className={iconClass} aria-hidden />
  if (status === 'Backlog') return <Inbox className={iconClass} aria-hidden />
  return <Circle className={iconClass} aria-hidden />
}

function renderProjectListStatusSelectOption(
  option: { value: WorkStatus; label: string },
  selected: boolean,
) {
  return (
    <>
      <span className="inline-flex items-center gap-2">
        <ProjectListStatusIcon status={option.value} />
        {option.label}
      </span>
      {selected ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> : null}
    </>
  )
}

function renderProjectListPrioritySelectOption(
  option: { value: Priority; label: string },
  selected: boolean,
) {
  return (
    <>
      <span className="inline-flex items-center gap-2">
        <Signal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        {option.label}
      </span>
      {selected ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> : null}
    </>
  )
}

function renderProjectListAssigneeSelectOption(
  option: { value: string; label: string },
  selected: boolean,
) {
  return (
    <>
      <span className="flex items-center gap-2">
        <PersonAvatar name={option.label} />
        <span>{option.label}</span>
      </span>
      {selected ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> : null}
    </>
  )
}

function ProjectListInlineSelectDisplay({
  icon,
  label,
}: {
  icon: ReactNode
  label: string
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-foreground">
      {icon}
      <span className="truncate">{label}</span>
    </span>
  )
}

function normalizeStatus(status: string): WorkStatus {
  return (status as string) === 'Blocked' ? 'Backlog' : (status as WorkStatus)
}

type ProjectListCreateDraft = {
  title: string
  type: WorkItemType | ''
  status: WorkStatus | ''
  priority: Priority | ''
  assignee: string
  dueDate: string
}

function createDefaultProjectListDraft(): ProjectListCreateDraft {
  return {
    title: '',
    type: '',
    status: '',
    priority: '',
    assignee: '',
    dueDate: '',
  }
}

const PROJECT_LIST_CREATE_EMPTY_DISPLAY = (
  <span className="text-[11px] text-muted-foreground">—</span>
)

function ProjectListColumnFilterMenu({
  label,
  options,
  selected,
  onToggle,
  onClearAll,
  renderOption,
}: {
  label: string
  options: string[]
  selected: Set<string>
  onToggle: (value: string) => void
  onClearAll: () => void
  renderOption?: (value: string) => ReactNode
}) {
  const active = selected.size > 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            COLUMN_FILTER_BUTTON_CLASS,
            active
              ? 'bg-blue-600 text-white dark:bg-blue-500 dark:text-slate-900'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100',
          )}
          aria-label={`Filter ${label.toLowerCase()} in table`}
          title={`Filter ${label.toLowerCase()}`}
        >
          <Filter className="h-3.5 w-3.5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={COLUMN_FILTER_MENU_CLASS}>
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{label} filter</span>
          <span className="text-[10px] font-medium text-muted-foreground">
            {selected.size === 0 ? 'All' : `${selected.size} selected`}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onClearAll} className="flex items-center justify-between">
          Show all
          {selected.size === 0 ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
          ) : null}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {options.length === 0 ? (
          <DropdownMenuItem className="pointer-events-none opacity-60">No values</DropdownMenuItem>
        ) : (
          options.map((option) => {
            const isActive = selected.size > 0 && selected.has(option)
            return (
              <DropdownMenuItem
                key={option}
                onClick={() => onToggle(option)}
                className="flex items-center justify-between"
              >
                <span className="truncate">{renderOption ? renderOption(option) : option}</span>
                {isActive ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                ) : null}
              </DropdownMenuItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function resolveProjectListInsertSide(
  activeCenterY: number | null,
  overTop: number,
  overHeight: number,
): 'before' | 'after' {
  if (activeCenterY === null) return 'before'
  const overMidY = overTop + overHeight / 2
  return activeCenterY > overMidY ? 'after' : 'before'
}

function ProjectListInsertIndicator() {
  return (
    <div className="pointer-events-none relative px-1 py-0.5" aria-hidden>
      <div className="h-0.5 rounded-full bg-primary/70" />
      <div className="absolute left-4 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
    </div>
  )
}

type ProjectListSortableRowShellProps = {
  rowId: string
  disabled?: boolean
  className?: string
  onContextMenu?: (event: MouseEvent<HTMLTableRowElement>) => void
  children: (props: {
    dragHandleProps: HTMLAttributes<HTMLButtonElement>
    isDragging: boolean
  }) => ReactNode
}

function ProjectListSortableRowShell({
  rowId,
  disabled = false,
  className,
  onContextMenu,
  children,
}: ProjectListSortableRowShellProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rowId,
    disabled,
  })
  const style: CSSProperties = isDragging
    ? { opacity: 0.25 }
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(className, isDragging && 'relative z-10')}
      onContextMenu={onContextMenu}
    >
      {children({
        dragHandleProps: {
          ...attributes,
          ...listeners,
          onClick: (event) => {
            listeners.onClick?.(event)
            event.stopPropagation()
          },
        },
        isDragging,
      })}
    </tr>
  )
}

function applyManualProjectListOrder(
  items: WorkItemApiModel[],
  orderIds: string[],
): WorkItemApiModel[] {
  if (orderIds.length === 0) return items

  const itemById = new Map(items.map((item) => [item.id, item]))
  const ordered: WorkItemApiModel[] = []
  for (const id of orderIds) {
    const item = itemById.get(id)
    if (item) {
      ordered.push(item)
      itemById.delete(id)
    }
  }
  for (const item of items) {
    if (itemById.has(item.id)) ordered.push(item)
  }

  return ordered.length === items.length ? ordered : items
}

function sortProjectListItems(
  items: WorkItemApiModel[],
  sortKey: Exclude<ProjectListSortKey, 'manual'>,
  direction: 'asc' | 'desc',
): WorkItemApiModel[] {
  return [...items].sort((left, right) => {
    let compareValue = 0

    if (sortKey === 'priority') {
      compareValue = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority]
    } else if (sortKey === 'status') {
      compareValue =
        STATUS_ORDER[normalizeStatus(left.status)] - STATUS_ORDER[normalizeStatus(right.status)]
    } else if (sortKey === 'progress') {
      compareValue = (left.progress ?? 0) - (right.progress ?? 0)
    } else if (sortKey === 'dueDate') {
      compareValue = new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime()
    } else if (sortKey === 'assignee') {
      compareValue = (left.assignee?.trim() || 'Unassigned').localeCompare(
        right.assignee?.trim() || 'Unassigned',
      )
    } else if (sortKey === 'title') {
      compareValue = left.title.localeCompare(right.title)
    } else if (sortKey === 'type') {
      compareValue = left.type.localeCompare(right.type)
    }

    if (compareValue === 0) {
      compareValue = left.id.localeCompare(right.id)
    }

    return direction === 'asc' ? compareValue : -compareValue
  })
}

type SortableProjectListHeaderCellProps = {
  columnKey: ProjectListColumnKey
  sortKey: ProjectListSortKey
  sortDirection: 'asc' | 'desc'
  onSort: (column: Exclude<ProjectListSortKey, 'manual'>) => void
  renderColumnFilter: (filterKey: ProjectListFilterKey) => ReactNode
  rowDragActive: boolean
  isLastColumn: boolean
  columnWidthStyle?: CSSProperties
  columnResizingKey: ProjectListColumnKey | null
  onBeginResize: (columnKey: ProjectListColumnKey, startX: number, thElement: HTMLTableCellElement) => void
}

function SortableProjectListHeaderCell({
  columnKey,
  sortKey,
  sortDirection,
  onSort,
  renderColumnFilter,
  rowDragActive,
  isLastColumn,
  columnWidthStyle,
  columnResizingKey,
  onBeginResize,
}: SortableProjectListHeaderCellProps) {
  const header = PROJECT_LIST_HEADER_BY_KEY[columnKey]
  const Icon = header.icon
  const isSorted = sortKey === header.sortKey
  const isPinnedFirstColumn = columnKey === PROJECT_LIST_PINNED_FIRST_COLUMN
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: columnKey,
    disabled: isPinnedFirstColumn || rowDragActive || columnResizingKey != null,
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
        TABLE_HEAD_CELL_CLASS,
        isPinnedFirstColumn
          ? PROJECT_LIST_FIRST_COLUMN_TINT_HEADER_CLASS
          : cn(PROJECT_LIST_OTHER_COLUMN_TINT_HEADER_CLASS, 'whitespace-nowrap'),
        isDragging && 'opacity-70',
      )}
    >
      <div className="flex items-center gap-1.5">
        {!isPinnedFirstColumn ? (
          <button
            type="button"
            className={cn(
              'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500',
              'hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100',
              'cursor-grab active:cursor-grabbing',
            )}
            aria-label={`Arrange column: ${header.label}`}
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
        <button
          type="button"
          onClick={() => onSort(header.sortKey)}
          className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground hover:text-foreground"
          title={
            isSorted
              ? `Sorted ${sortDirection === 'asc' ? 'ascending' : 'descending'} — click to toggle`
              : 'Sort column'
          }
          aria-label={`Sort by ${header.label}`}
        >
          <Icon className={HEADER_ICON_CLASS} aria-hidden />
          <span>{header.label}</span>
          <ArrowUpDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-transform',
              isSorted ? 'text-foreground opacity-100' : 'opacity-60',
              isSorted && sortDirection === 'desc' && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
        {header.filterKey ? renderColumnFilter(header.filterKey) : null}
      </div>
      {!isLastColumn ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${header.label} column`}
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

export function ProjectListPanel({
  project,
  template: _template,
  ownerName,
  workItems,
  usesApiItems,
  onWorkItemsChange,
  onArchiveChange,
  onNavigateArchived,
  usesOverlayApi = false,
}: {
  project: Project
  template?: ProjectTemplate
  ownerName: string
  workItems: WorkItemApiModel[]
  usesApiItems: boolean
  onWorkItemsChange?: () => void | Promise<void>
  onArchiveChange?: () => void
  onNavigateArchived?: () => void
  usesOverlayApi?: boolean
}) {
  const { addToast } = useToast()
  const panelRef = useRef<HTMLDivElement>(null)
  const rowDragJustEndedRef = useRef(false)
  const [panelHeightPx, setPanelHeightPx] = useState<number | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [localItems, setLocalItems] = useState<WorkItemApiModel[]>(workItems)
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25)
  const [sortKey, setSortKey] = useState<ProjectListSortKey>('title')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [manualRowOrder, setManualRowOrder] = useState<string[]>([])
  const [rowDragId, setRowDragId] = useState<string | null>(null)
  const [columnDragId, setColumnDragId] = useState<ProjectListColumnKey | null>(null)
  const [rowDropTarget, setRowDropTarget] = useState<ProjectListRowDropTarget | null>(null)
  const [rowDragWidthPx, setRowDragWidthPx] = useState(640)
  const [showSelection, setShowSelection] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [typeFilterTags, setTypeFilterTags] = useState<Set<string>>(() => new Set())
  const [statusFilterTags, setStatusFilterTags] = useState<Set<string>>(() => new Set())
  const [priorityFilterTags, setPriorityFilterTags] = useState<Set<string>>(() => new Set())
  const [assigneeFilterTags, setAssigneeFilterTags] = useState<Set<string>>(() => new Set())
  const [bulkStatus, setBulkStatus] = useState<WorkStatus>('In Progress')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [createDraft, setCreateDraft] = useState<ProjectListCreateDraft>(() => createDefaultProjectListDraft())
  const [createSaving, setCreateSaving] = useState(false)
  const createTitleInputRef = useRef<HTMLInputElement>(null)
  const [rowContextMenu, setRowContextMenu] = useState<{
    x: number
    y: number
    item: WorkItemApiModel
  } | null>(null)
  const [columnOrder, setColumnOrder] = useState<ProjectListColumnKey[]>(() => [
    ...DEFAULT_PROJECT_LIST_COLUMN_ORDER,
  ])
  const [columnWidthsPx, setColumnWidthsPx] = useState<Partial<Record<ProjectListColumnKey, number>>>({})
  const [columnResizingKey, setColumnResizingKey] = useState<ProjectListColumnKey | null>(null)
  const columnResizeRef = useRef<{
    columnKey: ProjectListColumnKey
    startX: number
    startWidth: number
  } | null>(null)

  useEffect(() => {
    setLocalItems(workItems)
  }, [workItems])

  useEffect(() => {
    setManualRowOrder([])
    setSortKey('title')
    setSortDirection('asc')
    setPage(1)
  }, [project.id])

  useEffect(() => {
    setCreateDraft(createDefaultProjectListDraft())
  }, [project.id])

  useEffect(() => {
    if (!showSelection && selectedIds.length > 0) setSelectedIds([])
  }, [selectedIds.length, showSelection])

  useEffect(() => {
    if (!isFullscreen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isFullscreen])

  useLayoutEffect(() => {
    if (isFullscreen) {
      setPanelHeightPx(null)
      return
    }

    const panelEl = panelRef.current
    if (!panelEl) return

    const updateHeight = () => {
      setPanelHeightPx(measureProjectPanelHeight(panelEl))
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)
    window.addEventListener('scroll', updateHeight, { passive: true })

    const observer = new ResizeObserver(updateHeight)
    observer.observe(panelEl)
    if (panelEl.parentElement) observer.observe(panelEl.parentElement)

    return () => {
      window.removeEventListener('resize', updateHeight)
      window.removeEventListener('scroll', updateHeight)
      observer.disconnect()
    }
  }, [isFullscreen])

  const assigneeOptions = useMemo(() => {
    const names = new Set<string>(['Unassigned'])

    localItems.forEach((item) => {
      const assignee = item.assignee?.trim()
      if (assignee) names.add(assignee)
    })

    const ownerLabel = ownerName.trim()
    if (ownerLabel && ownerLabel !== 'Unknown') names.add(ownerLabel)

    const projectOwnerLabel = project.ownerName?.trim()
    if (projectOwnerLabel) names.add(projectOwnerLabel)

    for (const member of resolveProjectMemberAvatars(project)) {
      names.add(member.name)
    }

    const others = Array.from(names)
      .filter((name) => name !== 'Unassigned')
      .sort((a, b) => a.localeCompare(b))

    const ownerFirst =
      ownerLabel && ownerLabel !== 'Unknown' && ownerLabel !== 'Unassigned'
        ? [ownerLabel, ...others.filter((name) => name !== ownerLabel)]
        : others

    return ['Unassigned', ...ownerFirst]
  }, [localItems, ownerName, project])

  const typeFilterOptions = useMemo(() => {
    const fromCatalog = WORK_ITEM_TYPE_OPTIONS.map((option) => option.type)
    const fromData = localItems.map((item) => item.type)
    return Array.from(new Set([...fromCatalog, ...fromData])).sort((a, b) => a.localeCompare(b))
  }, [localItems])

  const statusFilterOptions = useMemo(() => [...STATUS_OPTIONS], [])

  const priorityFilterOptions = useMemo(() => [...PRIORITY_OPTIONS], [])

  const toggleColumnFilter = (
    setter: Dispatch<SetStateAction<Set<string>>>,
    value: string,
  ) => {
    setter((previous) => {
      const next = new Set(previous)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
    setPage(1)
  }

  const filteredItems = useMemo(() => {
    return localItems.filter((item) => {
      if (typeFilterTags.size > 0 && !typeFilterTags.has(item.type)) return false
      if (statusFilterTags.size > 0 && !statusFilterTags.has(normalizeStatus(item.status))) {
        return false
      }
      if (priorityFilterTags.size > 0 && !priorityFilterTags.has(item.priority)) return false
      const assigneeName = item.assignee?.trim() || 'Unassigned'
      if (assigneeFilterTags.size > 0 && !assigneeFilterTags.has(assigneeName)) return false

      if (!deferredSearch) return true
      const haystack = [
        item.title,
        item.id,
        item.assignee,
        item.type,
        item.status,
        item.priority,
        item.label ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(deferredSearch)
    })
  }, [
    assigneeFilterTags,
    deferredSearch,
    localItems,
    priorityFilterTags,
    statusFilterTags,
    typeFilterTags,
  ])

  const sortedItems = useMemo(() => {
    if (sortKey === 'manual') {
      return applyManualProjectListOrder(filteredItems, manualRowOrder)
    }
    return sortProjectListItems(filteredItems, sortKey, sortDirection)
  }, [filteredItems, manualRowOrder, sortDirection, sortKey])

  useEffect(() => {
    setManualRowOrder((previous) => {
      const visibleIds = new Set(filteredItems.map((item) => item.id))
      const next = previous.filter((id) => visibleIds.has(id))
      return next.length === previous.length ? previous : next
    })
  }, [filteredItems])

  useEffect(() => {
    setPage(1)
  }, [
    assigneeFilterTags,
    deferredSearch,
    pageSize,
    priorityFilterTags,
    sortDirection,
    sortKey,
    statusFilterTags,
    typeFilterTags,
  ])

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize))
  const pageSafe = Math.min(page, totalPages)
  const pageStart = sortedItems.length === 0 ? 0 : (pageSafe - 1) * pageSize + 1
  const pageEnd = Math.min(pageSafe * pageSize, sortedItems.length)
  const pagedItems = useMemo(
    () => sortedItems.slice((pageSafe - 1) * pageSize, pageSafe * pageSize),
    [pageSafe, pageSize, sortedItems],
  )

  const rowSortableIds = useMemo(() => pagedItems.map((item) => item.id), [pagedItems])

  const columnWidthStyle = useCallback(
    (columnKey: ProjectListColumnKey): CSSProperties | undefined => {
      const px = columnWidthsPx[columnKey]
      if (!px || px <= 0) return undefined
      return { width: px, minWidth: px, maxWidth: px }
    },
    [columnWidthsPx],
  )

  const beginColumnResize = useCallback(
    (columnKey: ProjectListColumnKey, startX: number, thElement: HTMLTableCellElement) => {
      const measuredWidth = Math.round(thElement.getBoundingClientRect().width)
      const startWidth = columnWidthsPx[columnKey] ?? measuredWidth
      setColumnWidthsPx((previous) => ({
        ...previous,
        [columnKey]: clampProjectListColumnWidthPx(previous[columnKey] ?? measuredWidth),
      }))
      columnResizeRef.current = { columnKey, startX, startWidth }
      setColumnResizingKey(columnKey)
    },
    [columnWidthsPx],
  )

  useEffect(() => {
    if (!columnResizingKey) return

    const onMove = (event: MouseEvent) => {
      const active = columnResizeRef.current
      if (!active) return
      const next = clampProjectListColumnWidthPx(active.startWidth + (event.clientX - active.startX))
      setColumnWidthsPx((previous) => ({ ...previous, [active.columnKey]: next }))
    }

    const onUp = () => {
      columnResizeRef.current = null
      setColumnResizingKey(null)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [columnResizingKey])

  const rowDragOverlayItem = useMemo(
    () => (rowDragId ? sortedItems.find((item) => item.id === rowDragId) ?? null : null),
    [rowDragId, sortedItems],
  )

  const rowDndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const handleColumnDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    if (active.id === over.id) return

    const activeId = active.id as ProjectListColumnKey
    const overId = over.id as ProjectListColumnKey
    if (activeId === PROJECT_LIST_PINNED_FIRST_COLUMN) return

    setColumnOrder((previous) => {
      const oldIndex = previous.indexOf(activeId)
      const newIndex = previous.indexOf(overId)
      if (oldIndex < 0 || newIndex < 0) return previous
      if (newIndex === 0 || overId === PROJECT_LIST_PINNED_FIRST_COLUMN) return previous

      const next = arrayMove(previous, oldIndex, newIndex)
      const pinnedIndex = next.indexOf(PROJECT_LIST_PINNED_FIRST_COLUMN)
      if (pinnedIndex !== 0) {
        const rest = next.filter((key) => key !== PROJECT_LIST_PINNED_FIRST_COLUMN)
        return [PROJECT_LIST_PINNED_FIRST_COLUMN, ...rest]
      }
      return next
    })
  }, [])

  const rowCollisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const rowContainers = args.droppableContainers.filter((container) =>
        rowSortableIds.includes(String(container.id)),
      )
      const pointerHits = pointerWithin({ ...args, droppableContainers: rowContainers })
      if (pointerHits.length > 0) return pointerHits
      return closestCenter({ ...args, droppableContainers: rowContainers })
    },
    [rowSortableIds],
  )

  const applyRowReorder = useCallback(
    (activeId: string, overId: string, side: 'before' | 'after') => {
      const flatIds = sortedItems.map((item) => item.id)
      const nextIds = reorderDirectoryFlatRowIds(flatIds, activeId, overId, side)
      if (!nextIds) return

      setManualRowOrder((previous) => {
        if (previous.length === nextIds.length && previous.every((id, index) => id === nextIds[index])) {
          return previous
        }
        return nextIds
      })
      setSortKey('manual')
      setSortDirection('asc')
    },
    [sortedItems],
  )

  const handleRowDragStart = useCallback((event: DragStartEvent) => {
    setRowDragId(String(event.active.id))
    setRowDropTarget(null)
    const measuredWidth = event.active.rect.current.initial?.width
    setRowDragWidthPx(measuredWidth && measuredWidth > 0 ? measuredWidth : 640)
  }, [])

  const handleRowDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (!over) {
        setRowDropTarget(null)
        return
      }

      const activeId = String(active.id)
      const overId = String(over.id)
      if (!sortedItems.some((item) => item.id === activeId) || !sortedItems.some((item) => item.id === overId)) {
        setRowDropTarget(null)
        return
      }

      const activeTranslated = active.rect.current.translated
      const activeCenterY =
        activeTranslated !== null ? activeTranslated.top + activeTranslated.height / 2 : null
      const side = resolveProjectListInsertSide(activeCenterY, over.rect.top, over.rect.height)

      setRowDropTarget({ itemId: overId, side })
      applyRowReorder(activeId, overId, side)
    },
    [applyRowReorder, sortedItems],
  )

  const handleRowDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      const dropTarget = rowDropTarget
      setRowDragId(null)
      setRowDragWidthPx(640)
      setRowDropTarget(null)
      rowDragJustEndedRef.current = true
      window.setTimeout(() => {
        rowDragJustEndedRef.current = false
      }, 0)

      if (!over) return

      const activeId = String(active.id)
      const overId = String(over.id)
      if (!sortedItems.some((item) => item.id === activeId) || !sortedItems.some((item) => item.id === overId)) {
        return
      }

      const activeTranslated = active.rect.current.translated
      const activeCenterY =
        activeTranslated !== null ? activeTranslated.top + activeTranslated.height / 2 : null
      const side =
        dropTarget?.itemId === overId
          ? dropTarget.side
          : resolveProjectListInsertSide(activeCenterY, over.rect.top, over.rect.height)

      applyRowReorder(activeId, overId, side)
    },
    [applyRowReorder, rowDropTarget, sortedItems],
  )

  const handleRowDragCancel = useCallback(() => {
    setRowDragId(null)
    setRowDragWidthPx(640)
    setRowDropTarget(null)
  }, [])

  const tableCollisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const activeId = String(args.active.id)
      if (isProjectListColumnId(activeId)) {
        const columnContainers = args.droppableContainers.filter((container) =>
          columnOrder.includes(container.id as ProjectListColumnKey),
        )
        return closestCenter({ ...args, droppableContainers: columnContainers })
      }
      return rowCollisionDetection(args)
    },
    [columnOrder, rowCollisionDetection],
  )

  const handleTableDragStart = useCallback(
    (event: DragStartEvent) => {
      const activeId = String(event.active.id)
      if (isProjectListColumnId(activeId)) {
        if (activeId === PROJECT_LIST_PINNED_FIRST_COLUMN) return
        setColumnDragId(activeId)
        return
      }
      handleRowDragStart(event)
    },
    [handleRowDragStart],
  )

  const handleTableDragOver = useCallback(
    (event: DragOverEvent) => {
      const activeId = String(event.active.id)
      if (isProjectListColumnId(activeId)) return
      handleRowDragOver(event)
    },
    [handleRowDragOver],
  )

  const handleTableDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeId = String(event.active.id)
      if (isProjectListColumnId(activeId)) {
        setColumnDragId(null)
        handleColumnDragEnd(event)
        return
      }
      handleRowDragEnd(event)
    },
    [handleColumnDragEnd, handleRowDragEnd],
  )

  const handleTableDragCancel = useCallback(() => {
    setColumnDragId(null)
    handleRowDragCancel()
  }, [handleRowDragCancel])

  const allPageSelected =
    pagedItems.length > 0 && pagedItems.every((item) => selectedIds.includes(item.id))
  const somePageSelected = pagedItems.some((item) => selectedIds.includes(item.id))

  const patchItem = useCallback(
    async (itemId: string, patch: Parameters<typeof patchWorkItem>[1]) => {
      setLocalItems((previous) =>
        previous.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
      )
      if (!usesApiItems) return
      try {
        await patchWorkItem(itemId, patch)
        await onWorkItemsChange?.()
      } catch {
        setLocalItems(workItems)
      }
    },
    [onWorkItemsChange, usesApiItems, workItems],
  )

  const handleCreateFromComposer = useCallback(async () => {
    const title = createDraft.title.trim()
    if (!title || createSaving) return

    const dueDate = createDraft.dueDate.trim() || new Date().toISOString().slice(0, 10)
    const assignee = createDraft.assignee.trim() || ownerName.trim() || 'Unassigned'
    const type = createDraft.type || 'Task'
    const status = createDraft.status || 'To Do'
    const priority = createDraft.priority || 'Medium'

    setCreateSaving(true)
    try {
      if (usesApiItems) {
        const created = await createWorkItem({
          title,
          type,
          project: project.name,
          workspace: TECTONA_PROJECT_WORKSPACE,
          assignee,
          priority,
          status,
          dueDate,
        })
        setCreateDraft(createDefaultProjectListDraft())
        await onWorkItemsChange?.()
        addToast({
          title: 'Work item created',
          description: `"${created.title}" added to the project list.`,
          variant: 'success',
        })
        createTitleInputRef.current?.focus()
        return
      }

      const prefix = projectWorkItemBusinessKeyPrefix(project.id)
      const id = `${prefix}-new-${Date.now()}`
      const nowIso = new Date().toISOString()
      const newItem: WorkItemApiModel = {
        id,
        title,
        type,
        project: project.name,
        workspace: TECTONA_PROJECT_WORKSPACE,
        label: '',
        assignee,
        owner: assignee,
        role: 'Contributor',
        team: 'Delivery Squad',
        priority,
        status,
        startDate: dueDate,
        dueDate,
        dependencyStatus: 'Clear',
        progress: 0,
        estimatedHours: 8,
        actualHours: 0,
        lastUpdated: nowIso,
        parentId: null,
        epicId: null,
        featureId: null,
        description: '',
      }
      setLocalItems((previous) => [newItem, ...previous])
      setCreateDraft(createDefaultProjectListDraft())
      addToast({
        title: 'Work item created',
        description: `"${title}" added to the project list.`,
        variant: 'success',
      })
      createTitleInputRef.current?.focus()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create work item'
      addToast({ title: 'Failed to create work item', description: message, variant: 'error' })
    } finally {
      setCreateSaving(false)
    }
  }, [
    addToast,
    createDraft,
    createSaving,
    onWorkItemsChange,
    ownerName,
    project.id,
    project.name,
    usesApiItems,
  ])

  const handleBulkStatus = async () => {
    if (selectedIds.length === 0) return
    setBulkSaving(true)
    setLocalItems((previous) =>
      previous.map((item) =>
        selectedIds.includes(item.id) ? { ...item, status: bulkStatus } : item,
      ),
    )
    if (usesApiItems) {
      try {
        await batchPatchWorkItems({ ids: selectedIds, status: bulkStatus })
        await onWorkItemsChange?.()
      } catch {
        setLocalItems(workItems)
      }
    }
    setBulkSaving(false)
    setSelectedIds([])
  }

  const publishArchiveToast = useCallback(
    (archivedCount: number, skippedCount: number) => {
      if (archivedCount === 0) {
        addToast({
          title: 'Nothing to archive',
          description: 'Only completed (Done) work items can be archived.',
          variant: 'default',
        })
        return
      }

      const description =
        skippedCount > 0
          ? `${archivedCount} archived, ${skippedCount} skipped (not Done). View them in the Archived tab.`
          : `${archivedCount} work item${archivedCount === 1 ? '' : 's'} moved to Archived.`

      addToast({
        title: 'Work items archived',
        description,
        variant: 'success',
      })
    },
    [addToast],
  )

  const handleArchiveItems = useCallback(
    (itemIds: string[]) => {
      if (itemIds.length === 0) return

      void (async () => {
        const archivedIds: string[] = []
        const skippedIds: string[] = []

        for (const workItemId of itemIds) {
          const item = localItems.find((entry) => entry.id === workItemId)
          if (!item || !isWorkItemArchivable(item)) {
            skippedIds.push(workItemId)
            continue
          }
          try {
            if (usesOverlayApi) {
              await archiveProjectWorkItemApi({
                projectId: project.id,
                businessKey: workItemId,
                archivedBy: ownerName || 'system',
              })
            } else {
              archiveWorkItemManual({
                projectId: project.id,
                workItemId,
                archivedBy: ownerName || 'system',
              })
            }
            archivedIds.push(workItemId)
          } catch {
            skippedIds.push(workItemId)
          }
        }

        if (archivedIds.length > 0) {
          onArchiveChange?.()
          setSelectedIds((previous) => previous.filter((id) => !archivedIds.includes(id)))
        }

        publishArchiveToast(archivedIds.length, skippedIds.length)
      })()
    },
    [localItems, onArchiveChange, ownerName, project.id, publishArchiveToast, usesOverlayApi],
  )

  const handleArchiveSingle = useCallback(
    (item: WorkItemApiModel) => {
      setRowContextMenu(null)
      if (!isWorkItemArchivable(item)) {
        addToast({
          title: 'Cannot archive yet',
          description: 'Mark the work item as Done before archiving.',
          variant: 'default',
        })
        return
      }

      void (async () => {
        try {
          if (usesOverlayApi) {
            await archiveProjectWorkItemApi({
              projectId: project.id,
              businessKey: item.id,
              archivedBy: ownerName || 'system',
            })
          } else {
            archiveWorkItemManual({
              projectId: project.id,
              workItemId: item.id,
              archivedBy: ownerName || 'system',
            })
          }
          onArchiveChange?.()
          addToast({
            title: 'Work item archived',
            description: `"${item.title}" is hidden from active views. Open Archived to restore.`,
            variant: 'success',
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to archive work item'
          addToast({ title: 'Archive failed', description: message, variant: 'error' })
        }
      })()
    },
    [addToast, onArchiveChange, ownerName, project.id, usesOverlayApi],
  )

  const archivableSelectedCount = useMemo(
    () => selectedIds.filter((id) => {
      const item = localItems.find((entry) => entry.id === id)
      return item ? isWorkItemArchivable(item) : false
    }).length,
    [localItems, selectedIds],
  )

  const toggleRow = (itemId: string) => {
    setSelectedIds((previous) =>
      previous.includes(itemId) ? previous.filter((id) => id !== itemId) : [...previous, itemId],
    )
  }

  const togglePageSelection = () => {
    if (allPageSelected) {
      const pageIds = new Set(pagedItems.map((item) => item.id))
      setSelectedIds((previous) => previous.filter((id) => !pageIds.has(id)))
      return
    }
    const pageIds = pagedItems.map((item) => item.id)
    setSelectedIds((previous) => Array.from(new Set([...previous, ...pageIds])))
  }

  const handleSort = (column: Exclude<ProjectListSortKey, 'manual'>) => {
    if (sortKey === column) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(column)
    setSortDirection('asc')
  }

  const renderColumnFilter = (filterKey: ProjectListFilterKey) => {
    switch (filterKey) {
      case 'type':
        return (
          <ProjectListColumnFilterMenu
            label="Type"
            options={typeFilterOptions}
            selected={typeFilterTags}
            onClearAll={() => {
              setTypeFilterTags(new Set())
              setPage(1)
            }}
            onToggle={(value) => toggleColumnFilter(setTypeFilterTags, value)}
            renderOption={(value) => (
              <span className="inline-flex items-center gap-1.5">
                <WorkItemTypeIcon type={value as WorkItemApiModel['type']} className="h-3.5 w-3.5" />
                {value}
              </span>
            )}
          />
        )
      case 'status':
        return (
          <ProjectListColumnFilterMenu
            label="Status"
            options={statusFilterOptions}
            selected={statusFilterTags}
            onClearAll={() => {
              setStatusFilterTags(new Set())
              setPage(1)
            }}
            onToggle={(value) => toggleColumnFilter(setStatusFilterTags, value)}
            renderOption={(value) => resolveWorkStatusDisplayLabel(value as WorkStatus)}
          />
        )
      case 'priority':
        return (
          <ProjectListColumnFilterMenu
            label="Priority"
            options={priorityFilterOptions}
            selected={priorityFilterTags}
            onClearAll={() => {
              setPriorityFilterTags(new Set())
              setPage(1)
            }}
            onToggle={(value) => toggleColumnFilter(setPriorityFilterTags, value)}
          />
        )
      case 'assignee':
        return (
          <ProjectListColumnFilterMenu
            label="Assignee"
            options={assigneeOptions}
            selected={assigneeFilterTags}
            onClearAll={() => {
              setAssigneeFilterTags(new Set())
              setPage(1)
            }}
            onToggle={(value) => toggleColumnFilter(setAssigneeFilterTags, value)}
            renderOption={(value) => (
              <span className="inline-flex items-center gap-2">
                <PersonAvatar name={value} />
                <span>{value}</span>
              </span>
            )}
          />
        )
      default:
        return null
    }
  }

  const renderProjectListBodyCell = (
    columnKey: ProjectListColumnKey,
    {
      item,
      status,
      assigneeName,
      progress,
      cellClass,
      titleCellClass,
      dragHandleProps,
      cellStyle,
    }: {
      item: WorkItemApiModel
      status: WorkStatus
      assigneeName: string
      progress: number
      cellClass: string
      titleCellClass: string
      dragHandleProps: HTMLAttributes<HTMLButtonElement>
      cellStyle?: CSSProperties
    },
  ) => {
    switch (columnKey) {
      case 'title':
        return (
          <td key={columnKey} className={titleCellClass} style={cellStyle}>
            <div className="flex min-w-0 items-start gap-1.5">
              <button
                type="button"
                data-directory-drag-handle
                className="mt-0.5 inline-flex h-5 w-5 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground/70 transition hover:bg-muted/60 hover:text-foreground active:cursor-grabbing"
                title="Drag to reorder row"
                aria-label={`Drag to reorder ${item.title}`}
                {...dragHandleProps}
              >
                <GripVertical className="h-3.5 w-3.5" aria-hidden />
              </button>
              <div className="min-w-0 flex-1">
                <DirectoryInlineTextCell
                  value={item.title}
                  ariaLabel={`Title for ${item.id}`}
                  onCommit={(title) => patchItem(item.id, { title })}
                  className="truncate font-semibold text-foreground"
                  inputClassName="text-sm font-semibold"
                />
                <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{item.id}</div>
              </div>
            </div>
          </td>
        )
      case 'type':
        return (
          <td key={columnKey} className={cn(cellClass, 'whitespace-nowrap')} style={cellStyle}>
            <DirectoryInlineSelectCell
              value={item.type}
              options={WORK_ITEM_TYPE_OPTIONS.map((option) => ({
                value: option.type,
                label: option.label,
              }))}
              renderOption={(option, selectedOption) =>
                renderWorkItemTypeSelectOption(
                  { value: option.value, label: option.label },
                  selectedOption,
                )
              }
              ariaLabel={`Type for ${item.title}`}
              onCommit={(type) => patchItem(item.id, { type })}
            >
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                <WorkItemTypeIcon type={item.type} className="h-3.5 w-3.5" />
                {item.type}
              </span>
            </DirectoryInlineSelectCell>
          </td>
        )
      case 'status':
        return (
          <td key={columnKey} className={cn(cellClass, 'whitespace-nowrap')} style={cellStyle}>
            <DirectoryInlineSelectCell
              value={status}
              options={STATUS_OPTIONS.map((option) => ({
                value: option,
                label: resolveWorkStatusDisplayLabel(option),
              }))}
              renderOption={(option, selectedOption) =>
                renderProjectListStatusSelectOption(
                  { value: option.value, label: option.label },
                  selectedOption,
                )
              }
              ariaLabel={`Status for ${item.title}`}
              onCommit={(nextStatus) => patchItem(item.id, { status: nextStatus })}
            >
              <ProjectListInlineSelectDisplay
                icon={<ProjectListStatusIcon status={status} />}
                label={resolveWorkStatusDisplayLabel(status)}
              />
            </DirectoryInlineSelectCell>
          </td>
        )
      case 'priority':
        return (
          <td key={columnKey} className={cn(cellClass, 'whitespace-nowrap')} style={cellStyle}>
            <DirectoryInlineSelectCell
              value={item.priority}
              options={PRIORITY_OPTIONS.map((priority) => ({
                value: priority,
                label: priority,
              }))}
              renderOption={(option, selectedOption) =>
                renderProjectListPrioritySelectOption(
                  { value: option.value, label: option.label },
                  selectedOption,
                )
              }
              ariaLabel={`Priority for ${item.title}`}
              onCommit={(priority) => patchItem(item.id, { priority })}
            >
              <ProjectListInlineSelectDisplay
                icon={<Signal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                label={item.priority}
              />
            </DirectoryInlineSelectCell>
          </td>
        )
      case 'assignee':
        return (
          <td key={columnKey} className={cn(cellClass, 'whitespace-nowrap')} style={cellStyle}>
            <DirectoryInlineSelectCell
              value={assigneeName}
              options={assigneeOptions.map((name) => ({ value: name, label: name }))}
              renderOption={(option, selectedOption) =>
                renderProjectListAssigneeSelectOption(option, selectedOption)
              }
              ariaLabel={`Assignee for ${item.title}`}
              menuMinWidth={220}
              onCommit={(assignee) =>
                patchItem(item.id, {
                  assignee: assignee === 'Unassigned' ? 'Unassigned' : assignee,
                })
              }
            >
              <ProjectListInlineSelectDisplay
                icon={<PersonAvatar name={assigneeName} />}
                label={assigneeName}
              />
            </DirectoryInlineSelectCell>
          </td>
        )
      case 'due':
        return (
          <td key={columnKey} className={cn(cellClass, 'whitespace-nowrap')} style={cellStyle}>
            <DirectoryInlineDateCell
              value={item.dueDate}
              ariaLabel={`Due date for ${item.title}`}
              display={formatDueDateLabel(item.dueDate)}
              onCommit={(dueDate) => patchItem(item.id, { dueDate })}
            />
          </td>
        )
      case 'progress':
        return (
          <td key={columnKey} className={cellClass} style={cellStyle}>
            <div className="flex w-full min-w-0 items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
              </div>
              <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">{progress}%</span>
            </div>
          </td>
        )
      default:
        return null
    }
  }

  const renderProjectListCreateCell = (
    columnKey: ProjectListColumnKey,
    {
      cellClass,
      titleCellClass,
      cellStyle,
    }: {
      cellClass: string
      titleCellClass: string
      cellStyle?: CSSProperties
    },
  ) => {
    const createCellClass = cn(cellClass, 'bg-sky-50/25 group-hover:bg-sky-50/35 dark:bg-sky-950/10')
    const createTitleCellClass = cn(
      titleCellClass,
      'bg-sky-50/40 group-hover:bg-sky-50/45 dark:bg-sky-950/15',
    )

    switch (columnKey) {
      case 'title':
        return (
          <td key={columnKey} className={createTitleCellClass} style={cellStyle}>
            <div className="flex min-w-0 items-start gap-1.5">
              <span
                className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground/35"
                aria-hidden
              >
                <GripVertical className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <Input
                  ref={createTitleInputRef}
                  value={createDraft.title}
                  disabled={createSaving}
                  placeholder="Enter task title…"
                  aria-label="New task title"
                  className="h-8 border-dashed border-border/70 bg-background/90 text-sm font-semibold shadow-none focus-visible:ring-1"
                  onChange={(event) =>
                    setCreateDraft((previous) => ({ ...previous, title: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void handleCreateFromComposer()
                    }
                  }}
                />
                <p className="mt-1 text-[10px] text-muted-foreground">Press Enter to add a row</p>
              </div>
            </div>
          </td>
        )
      case 'type':
        return (
          <td key={columnKey} className={cn(createCellClass, 'whitespace-nowrap')} style={cellStyle}>
            <DirectoryInlineSelectCell
              value={createDraft.type}
              disabled={createSaving}
              options={WORK_ITEM_TYPE_OPTIONS.map((option) => ({
                value: option.type,
                label: option.label,
              }))}
              renderOption={(option, selectedOption) =>
                renderWorkItemTypeSelectOption(
                  { value: option.value, label: option.label },
                  selectedOption,
                )
              }
              ariaLabel="Type for new task"
              onCommit={(type) => setCreateDraft((previous) => ({ ...previous, type }))}
            >
              {createDraft.type ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                  <WorkItemTypeIcon type={createDraft.type} className="h-3.5 w-3.5" />
                  {createDraft.type}
                </span>
              ) : (
                PROJECT_LIST_CREATE_EMPTY_DISPLAY
              )}
            </DirectoryInlineSelectCell>
          </td>
        )
      case 'status':
        return (
          <td key={columnKey} className={cn(createCellClass, 'whitespace-nowrap')} style={cellStyle}>
            <DirectoryInlineSelectCell
              value={createDraft.status}
              disabled={createSaving}
              options={STATUS_OPTIONS.map((option) => ({
                value: option,
                label: resolveWorkStatusDisplayLabel(option),
              }))}
              renderOption={(option, selectedOption) =>
                renderProjectListStatusSelectOption(
                  { value: option.value, label: option.label },
                  selectedOption,
                )
              }
              ariaLabel="Status for new task"
              onCommit={(status) => setCreateDraft((previous) => ({ ...previous, status }))}
            >
              {createDraft.status ? (
                <ProjectListInlineSelectDisplay
                  icon={<ProjectListStatusIcon status={createDraft.status} />}
                  label={resolveWorkStatusDisplayLabel(createDraft.status)}
                />
              ) : (
                PROJECT_LIST_CREATE_EMPTY_DISPLAY
              )}
            </DirectoryInlineSelectCell>
          </td>
        )
      case 'priority':
        return (
          <td key={columnKey} className={cn(createCellClass, 'whitespace-nowrap')} style={cellStyle}>
            <DirectoryInlineSelectCell
              value={createDraft.priority}
              disabled={createSaving}
              options={PRIORITY_OPTIONS.map((priority) => ({
                value: priority,
                label: priority,
              }))}
              renderOption={(option, selectedOption) =>
                renderProjectListPrioritySelectOption(
                  { value: option.value, label: option.label },
                  selectedOption,
                )
              }
              ariaLabel="Priority for new task"
              onCommit={(priority) => setCreateDraft((previous) => ({ ...previous, priority }))}
            >
              {createDraft.priority ? (
                <ProjectListInlineSelectDisplay
                  icon={<Signal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                  label={createDraft.priority}
                />
              ) : (
                PROJECT_LIST_CREATE_EMPTY_DISPLAY
              )}
            </DirectoryInlineSelectCell>
          </td>
        )
      case 'assignee':
        return (
          <td key={columnKey} className={cn(createCellClass, 'whitespace-nowrap')} style={cellStyle}>
            <DirectoryInlineSelectCell
              value={createDraft.assignee}
              disabled={createSaving}
              options={assigneeOptions.map((name) => ({ value: name, label: name }))}
              renderOption={(option, selectedOption) =>
                renderProjectListAssigneeSelectOption(option, selectedOption)
              }
              ariaLabel="Assignee for new task"
              menuMinWidth={220}
              onCommit={(assignee) => setCreateDraft((previous) => ({ ...previous, assignee }))}
            >
              {createDraft.assignee ? (
                <ProjectListInlineSelectDisplay
                  icon={<PersonAvatar name={createDraft.assignee} />}
                  label={createDraft.assignee}
                />
              ) : (
                PROJECT_LIST_CREATE_EMPTY_DISPLAY
              )}
            </DirectoryInlineSelectCell>
          </td>
        )
      case 'due':
        return (
          <td key={columnKey} className={cn(createCellClass, 'whitespace-nowrap')} style={cellStyle}>
            <DirectoryInlineDateCell
              value={createDraft.dueDate}
              disabled={createSaving}
              ariaLabel="Due date for new task"
              display={
                createDraft.dueDate ? formatDueDateLabel(createDraft.dueDate) : PROJECT_LIST_CREATE_EMPTY_DISPLAY
              }
              onCommit={(dueDate) => setCreateDraft((previous) => ({ ...previous, dueDate }))}
            />
          </td>
        )
      case 'progress':
        return (
          <td key={columnKey} className={createCellClass} style={cellStyle}>
            {PROJECT_LIST_CREATE_EMPTY_DISPLAY}
          </td>
        )
      default:
        return null
    }
  }

  const panel = (
    <div
      ref={panelRef}
      id="panel-list"
      style={
        isFullscreen
          ? { height: 'calc(100dvh - 3rem)', maxHeight: 'calc(100dvh - 3rem)' }
          : panelHeightPx != null
            ? { height: panelHeightPx, maxHeight: panelHeightPx, minHeight: PROJECT_PANEL_MIN_HEIGHT_PX }
            : undefined
      }
      className={cn(
        'scroll-mt-24',
        'glass-card flex min-h-0 flex-col overflow-hidden border border-border/40',
        'shadow-[0_14px_40px_rgba(15,23,42,0.06)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]',
        isFullscreen
          ? 'fixed inset-x-0 top-12 bottom-0 z-50 rounded-none border-0 bg-background'
          : 'rounded-2xl',
      )}
    >
      <div className="flex h-full min-h-0 w-full flex-col">
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden',
            isFullscreen ? 'px-4 pb-3 pt-2 lg:px-5 lg:pb-4 lg:pt-2' : 'p-4 lg:p-5',
          )}
        >
          <div className="shrink-0 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <List className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                <h2 className="text-lg font-semibold text-foreground">Project List</h2>
              </div>
              <button
                type="button"
                aria-pressed={isFullscreen}
                aria-label={isFullscreen ? 'Exit list fullscreen' : 'Expand list to fullscreen'}
                title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
                onClick={() => setIsFullscreen((prev) => !prev)}
                className={cn(
                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/40 hover:text-foreground',
                  listToolbarFocusClass,
                  isFullscreen && 'bg-foreground text-background hover:bg-foreground/90 hover:text-background',
                )}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            </div>

            <p className="max-w-2xl text-[11px] leading-snug text-muted-foreground">
              Flat work-item directory with search, bulk actions, and archive for completed items.
            </p>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search title, ID, assignee…"
                  className="h-9 pl-8 text-sm"
                  aria-label="Search work items"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <button
                  type="button"
                  role="switch"
                  aria-checked={showSelection}
                  onClick={() => setShowSelection((prev) => !prev)}
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
                <span>
                  Showing{' '}
                  <span className="font-semibold text-foreground">
                    {pageStart}-{pageEnd}
                  </span>{' '}
                  of <span className="font-semibold text-foreground">{sortedItems.length}</span>
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
                  <DropdownMenuContent align="end" className={PAGE_SIZE_MENU_CLASS}>
                    <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground">
                      Rows per page
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <DropdownMenuItem
                        key={size}
                        onClick={() => {
                          setPageSize(size)
                          setPage(1)
                        }}
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
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
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
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            {showSelection && selectedIds.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                <span className="text-xs font-medium text-foreground">
                  {selectedIds.length} selected
                </span>
                <Select
                  value={bulkStatus}
                  onChange={(event) => setBulkStatus(event.target.value as WorkStatus)}
                  className="h-8 w-[150px] text-xs"
                  aria-label="Bulk status"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {resolveWorkStatusDisplayLabel(status)}
                    </SelectItem>
                  ))}
                </Select>
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  disabled={bulkSaving}
                  onClick={() => void handleBulkStatus()}
                >
                  Update status
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                  disabled={bulkSaving || archivableSelectedCount === 0}
                  onClick={() => handleArchiveItems(selectedIds)}
                  title={
                    archivableSelectedCount === 0
                      ? 'Select Done items to archive'
                      : `Archive ${archivableSelectedCount} Done item${archivableSelectedCount === 1 ? '' : 's'}`
                  }
                >
                  <Archive className="h-3.5 w-3.5" aria-hidden />
                  Archive{archivableSelectedCount > 0 ? ` (${archivableSelectedCount})` : ''}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => setSelectedIds([])}
                >
                  Clear
                </Button>
              </div>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
            <div className="scrollbar-hide min-h-0 flex-1 overflow-auto">
              <DndContext
                sensors={rowDndSensors}
                collisionDetection={tableCollisionDetection}
                onDragStart={handleTableDragStart}
                onDragOver={handleTableDragOver}
                onDragEnd={handleTableDragEnd}
                onDragCancel={handleTableDragCancel}
              >
                <table className="w-full table-fixed border-collapse text-xs select-none">
                  <colgroup>
                    {showSelection ? <col className="w-10" /> : null}
                    {columnOrder.map((columnKey) => {
                      const widthStyle = columnWidthStyle(columnKey)
                      return (
                        <col
                          key={columnKey}
                          className={widthStyle ? undefined : PROJECT_LIST_HEADER_BY_KEY[columnKey].colClassName}
                          style={widthStyle}
                        />
                      )
                    })}
                  </colgroup>
                    <thead className="sticky top-0 z-10">
                      <tr className="text-left text-muted-foreground">
                        {showSelection ? (
                          <th className={cn('w-10', TABLE_HEAD_CELL_CLASS, PROJECT_LIST_OTHER_COLUMN_TINT_HEADER_CLASS)}>
                            <button
                              type="button"
                              aria-label={allPageSelected ? 'Deselect page' : 'Select page'}
                              className="inline-flex text-muted-foreground hover:text-foreground"
                              onClick={togglePageSelection}
                            >
                              {allPageSelected ? (
                                <CheckSquare2 className="h-4 w-4 text-primary" />
                              ) : somePageSelected ? (
                                <CheckSquare2 className="h-4 w-4 text-primary/50" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                          </th>
                        ) : null}
                        <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                          {columnOrder.map((columnKey) => (
                            <SortableProjectListHeaderCell
                              key={columnKey}
                              columnKey={columnKey}
                              sortKey={sortKey}
                              sortDirection={sortDirection}
                              onSort={handleSort}
                              renderColumnFilter={renderColumnFilter}
                              rowDragActive={Boolean(rowDragId)}
                              isLastColumn={columnOrder[columnOrder.length - 1] === columnKey}
                              columnWidthStyle={columnWidthStyle(columnKey)}
                              columnResizingKey={columnResizingKey}
                              onBeginResize={beginColumnResize}
                            />
                          ))}
                        </SortableContext>
                      </tr>
                    </thead>
                    <SortableContext items={rowSortableIds} strategy={verticalListSortingStrategy}>
                      <tbody>
                        <tr className="group border-b border-sky-100/80 dark:border-sky-900/40">
                          {showSelection ? (
                            <td
                              className={cn(
                                TABLE_BODY_CELL_CLASS,
                                'w-10 bg-sky-50/25 group-hover:bg-sky-50/35 dark:bg-sky-950/10',
                              )}
                              aria-hidden
                            />
                          ) : null}
                          {columnOrder.map((columnKey) =>
                            renderProjectListCreateCell(columnKey, {
                              cellClass: TABLE_BODY_CELL_CLASS,
                              titleCellClass: cn(
                                TABLE_BODY_CELL_CLASS,
                                PROJECT_LIST_FIRST_COLUMN_TINT_BODY_CLASS,
                              ),
                              cellStyle: columnWidthStyle(columnKey),
                            }),
                          )}
                        </tr>
                        {pagedItems.length === 0 ? (
                          <tr>
                            <td
                              colSpan={TABLE_HEADERS.length + (showSelection ? 1 : 0)}
                              className="px-6 py-16 text-center text-sm text-muted-foreground"
                            >
                              No work items match the current search.
                            </td>
                          </tr>
                        ) : (
                          pagedItems.map((item) => {
                            const status = normalizeStatus(item.status)
                            const selected = selectedIds.includes(item.id)
                            const assigneeName = item.assignee?.trim() || 'Unassigned'
                            const progress = item.progress ?? 0
                            const tableColSpan = TABLE_HEADERS.length + (showSelection ? 1 : 0)
                            const showDropBefore =
                              rowDropTarget?.itemId === item.id && rowDropTarget.side === 'before'
                            const showDropAfter =
                              rowDropTarget?.itemId === item.id && rowDropTarget.side === 'after'
                            const cellClass = cn(
                              TABLE_BODY_CELL_CLASS,
                              selected ? 'bg-primary/10' : 'group-hover:bg-accent/20',
                            )
                            const titleCellClass = cn(
                              TABLE_BODY_CELL_CLASS,
                              selected
                                ? 'bg-primary/10'
                                : cn(PROJECT_LIST_FIRST_COLUMN_TINT_BODY_CLASS, 'group-hover:bg-accent/20'),
                            )
                            return (
                              <Fragment key={item.id}>
                                {showDropBefore ? (
                                  <tr className="pointer-events-none">
                                    <td colSpan={tableColSpan} className="border-none p-0">
                                      <ProjectListInsertIndicator />
                                    </td>
                                  </tr>
                                ) : null}
                                <ProjectListSortableRowShell
                                  rowId={item.id}
                                  disabled={Boolean(columnDragId || columnResizingKey)}
                                  className={cn(
                                    'group transition-colors',
                                    showSelection && selected && 'bg-primary/5',
                                  )}
                                  onContextMenu={(event) => {
                                    if (rowDragJustEndedRef.current) return
                                    event.preventDefault()
                                    setRowContextMenu({
                                      x: event.clientX,
                                      y: event.clientY,
                                      item,
                                    })
                                  }}
                                >
                                  {({ dragHandleProps }) => (
                                    <>
                                      {showSelection ? (
                                        <td className={cellClass}>
                                          <button
                                            type="button"
                                            aria-label={
                                              selected ? `Deselect ${item.title}` : `Select ${item.title}`
                                            }
                                            className="inline-flex text-muted-foreground hover:text-foreground"
                                            onClick={() => {
                                              if (rowDragJustEndedRef.current) return
                                              toggleRow(item.id)
                                            }}
                                          >
                                            {selected ? (
                                              <CheckSquare2 className="h-4 w-4 text-primary" />
                                            ) : (
                                              <Square className="h-4 w-4" />
                                            )}
                                          </button>
                                        </td>
                                      ) : null}
                                      {columnOrder.map((columnKey) =>
                                        renderProjectListBodyCell(columnKey, {
                                          item,
                                          status,
                                          assigneeName,
                                          progress,
                                          cellClass,
                                          titleCellClass,
                                          dragHandleProps,
                                          cellStyle: columnWidthStyle(columnKey),
                                        }),
                                      )}
                                    </>
                                  )}
                                </ProjectListSortableRowShell>
                                {showDropAfter ? (
                                  <tr className="pointer-events-none">
                                    <td colSpan={tableColSpan} className="border-none p-0">
                                      <ProjectListInsertIndicator />
                                    </td>
                                  </tr>
                                ) : null}
                              </Fragment>
                            )
                          })
                        )}
                      </tbody>
                    </SortableContext>
                  </table>
                  {typeof document !== 'undefined'
                    ? createPortal(
                        <DragOverlay
                          zIndex={1500}
                          dropAnimation={null}
                          adjustScale={false}
                          className="cursor-grabbing"
                        >
                          {rowDragOverlayItem ? (
                            <div
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-[0_18px_40px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900"
                              style={{ width: rowDragWidthPx, maxWidth: '96vw' }}
                            >
                              <div className="text-sm font-semibold text-foreground">
                                {rowDragOverlayItem.title}
                              </div>
                              <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                                {rowDragOverlayItem.id}
                              </div>
                            </div>
                          ) : null}
                        </DragOverlay>,
                        document.body,
                      )
                    : null}
              </DndContext>
            </div>
          </div>
        </div>
      </div>

      {rowContextMenu ? (
        <ContextMenu
          open
          x={rowContextMenu.x}
          y={rowContextMenu.y}
          onClose={() => setRowContextMenu(null)}
        >
          <ContextMenuItem
            className={cn(!isWorkItemArchivable(rowContextMenu.item) && 'pointer-events-none opacity-40')}
            onClick={() => {
              if (!isWorkItemArchivable(rowContextMenu.item)) return
              handleArchiveSingle(rowContextMenu.item)
            }}
          >
            <Archive className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Archive
          </ContextMenuItem>
          {onNavigateArchived ? (
            <ContextMenuItem
              onClick={() => {
                setRowContextMenu(null)
                onNavigateArchived()
              }}
            >
              Open Archived tab
            </ContextMenuItem>
          ) : null}
        </ContextMenu>
      ) : null}
    </div>
  )

  if (isFullscreen && typeof document !== 'undefined') {
    return (
      <>
        <div className="min-h-[50vh]" aria-hidden />
        {createPortal(panel, document.body)}
      </>
    )
  }

  return panel
}
