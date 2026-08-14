import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  Filter,
  GripVertical,
  Layers3,
  ListChecks,
  RotateCcw,
  Signal,
  Users,
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
import type { ProjectArchivedWorkItemApiModel, WorkItemApiModel } from '@/lib/api/workApi'
import { WORK_ITEM_TYPE_OPTIONS, WorkItemTypeIcon } from '@/lib/work/workItemTypeMeta'
import { cn } from '@/lib/utils'
import {
  formatArchivedDate,
  getArchivedWorkItemRecordFromApi,
} from '../lib/projectArchivedWorkItems'
import type { ArchivedWorkItemRecord } from '../lib/projectArchivedStore'
import {
  PROJECT_LIST_COLUMN_FILTER_BUTTON_CLASS,
  PROJECT_LIST_COLUMN_FILTER_MENU_CLASS,
  PROJECT_LIST_DRAG_HANDLE_CLASS,
  PROJECT_LIST_FIRST_COLUMN_TINT_BODY_CLASS,
  PROJECT_LIST_TABLE_BODY_CELL_CLASS,
  PROJECT_LIST_TABLE_SCROLL_CLASS,
  PROJECT_LIST_PAGE_SIZE_OPTIONS,
  PROJECT_WORK_ITEM_PRIORITY_CHIP,
  ProjectWorkItemPersonAvatar,
  ProjectWorkItemPriorityBadge,
  ProjectWorkItemStatusBadge,
  ProjectWorkItemTableHeaderCell,
  clampProjectListColumnWidthPx,
  normalizeProjectWorkItemStatus,
  type ProjectWorkItemTableRowsMeta,
} from './projectWorkItemTableShared'

type ArchivedColumnKey = 'title' | 'type' | 'status' | 'priority' | 'assignee' | 'archived' | 'action'
type ArchivedSortKey = 'title' | 'type' | 'status' | 'priority' | 'assignee' | 'archived'
type ArchivedFilterKey = 'type' | 'status' | 'priority' | 'assignee'

const ARCHIVED_PINNED_FIRST_COLUMN: ArchivedColumnKey = 'title'

const DEFAULT_ARCHIVED_COLUMN_ORDER: ArchivedColumnKey[] = [
  'title',
  'type',
  'status',
  'priority',
  'assignee',
  'archived',
  'action',
]

const ARCHIVED_TABLE_HEADERS: Array<{
  key: ArchivedColumnKey
  sortKey?: ArchivedSortKey
  filterKey?: ArchivedFilterKey
  label: string
  icon: typeof ListChecks
  colClassName: string
  sortable?: boolean
}> = [
  { key: 'title', sortKey: 'title', label: 'Task title', icon: ListChecks, colClassName: 'w-[28%]' },
  { key: 'type', sortKey: 'type', filterKey: 'type', label: 'Type', icon: Layers3, colClassName: 'w-[9%]' },
  { key: 'status', sortKey: 'status', filterKey: 'status', label: 'Status', icon: Archive, colClassName: 'w-[12%]' },
  { key: 'priority', sortKey: 'priority', filterKey: 'priority', label: 'Priority', icon: Signal, colClassName: 'w-[9%]' },
  { key: 'assignee', sortKey: 'assignee', filterKey: 'assignee', label: 'Assignee', icon: Users, colClassName: 'w-[14%]' },
  { key: 'archived', sortKey: 'archived', label: 'Archived', icon: CalendarClock, colClassName: 'w-[13%]' },
  { key: 'action', label: '', icon: RotateCcw, colClassName: 'w-[10%]', sortable: false },
]

const ARCHIVED_HEADER_BY_KEY = Object.fromEntries(
  ARCHIVED_TABLE_HEADERS.map((header) => [header.key, header]),
) as Record<ArchivedColumnKey, (typeof ARCHIVED_TABLE_HEADERS)[number]>

const STATUS_ORDER = { Backlog: 0, 'To Do': 1, 'In Progress': 2, 'In Review': 3, Done: 4 } as const
const PRIORITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 } as const

type ArchivedTableRow = {
  item: WorkItemApiModel
  meta: ArchivedWorkItemRecord | null
}

function ArchivedColumnFilterMenu({
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
            PROJECT_LIST_COLUMN_FILTER_BUTTON_CLASS,
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
      <DropdownMenuContent align="start" className={PROJECT_LIST_COLUMN_FILTER_MENU_CLASS}>
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{label} filter</span>
          <span className="text-[10px] font-medium text-muted-foreground">
            {selected.size === 0 ? 'All' : `${selected.size} selected`}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onClearAll} className="flex items-center justify-between">
          Show all
          {selected.size === 0 ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden /> : null}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {options.map((option) => {
          const checked = selected.has(option)
          return (
            <DropdownMenuItem
              key={option}
              onClick={() => onToggle(option)}
              className="flex items-center justify-between gap-2"
            >
              <span className="min-w-0 truncate">{renderOption ? renderOption(option) : option}</span>
              {checked ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function sortArchivedRows(rows: ArchivedTableRow[], sortKey: ArchivedSortKey, direction: 'asc' | 'desc'): ArchivedTableRow[] {
  const sorted = [...rows]
  sorted.sort((left, right) => {
    let compareValue = 0
    if (sortKey === 'priority') {
      compareValue = PRIORITY_ORDER[left.item.priority] - PRIORITY_ORDER[right.item.priority]
    } else if (sortKey === 'status') {
      compareValue =
        STATUS_ORDER[normalizeProjectWorkItemStatus(left.item.status)] -
        STATUS_ORDER[normalizeProjectWorkItemStatus(right.item.status)]
    } else if (sortKey === 'assignee') {
      compareValue = (left.item.assignee?.trim() || 'Unassigned').localeCompare(
        right.item.assignee?.trim() || 'Unassigned',
      )
    } else if (sortKey === 'archived') {
      compareValue = (left.meta?.archivedAt || '').localeCompare(right.meta?.archivedAt || '')
    } else if (sortKey === 'title') {
      compareValue = left.item.title.localeCompare(right.item.title)
    } else if (sortKey === 'type') {
      compareValue = left.item.type.localeCompare(right.item.type)
    }
    if (compareValue === 0) compareValue = left.item.id.localeCompare(right.item.id)
    return direction === 'asc' ? compareValue : -compareValue
  })
  return sorted
}

type ProjectArchivedTableViewProps = {
  archivedRecords: ProjectArchivedWorkItemApiModel[]
  items: WorkItemApiModel[]
  onRestore: (item: WorkItemApiModel) => void
  page: number
  pageSize: (typeof PROJECT_LIST_PAGE_SIZE_OPTIONS)[number]
  onPageChange: (page: number) => void
  onRowsMetaChange?: (meta: ProjectWorkItemTableRowsMeta) => void
}

export function ProjectArchivedTableView({
  archivedRecords,
  items,
  onRestore,
  page,
  pageSize,
  onPageChange,
  onRowsMetaChange,
}: ProjectArchivedTableViewProps) {
  const [sortKey, setSortKey] = useState<ArchivedSortKey>('title')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [columnOrder, setColumnOrder] = useState<ArchivedColumnKey[]>(() => [...DEFAULT_ARCHIVED_COLUMN_ORDER])
  const [columnWidthsPx, setColumnWidthsPx] = useState<Partial<Record<ArchivedColumnKey, number>>>({})
  const [columnResizingKey, setColumnResizingKey] = useState<ArchivedColumnKey | null>(null)
  const [typeFilterTags, setTypeFilterTags] = useState<Set<string>>(() => new Set())
  const [statusFilterTags, setStatusFilterTags] = useState<Set<string>>(() => new Set())
  const [priorityFilterTags, setPriorityFilterTags] = useState<Set<string>>(() => new Set())
  const [assigneeFilterTags, setAssigneeFilterTags] = useState<Set<string>>(() => new Set())
  const columnResizeRef = useRef<{
    columnKey: ArchivedColumnKey
    startX: number
    startWidth: number
  } | null>(null)

  const columnDndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const rows = useMemo(
    () =>
      items.map((item) => ({
        item,
        meta: getArchivedWorkItemRecordFromApi(archivedRecords, item.id) ?? null,
      })),
    [archivedRecords, items],
  )

  const assigneeOptions = useMemo(() => {
    const names = new Set<string>()
    rows.forEach(({ item }) => names.add(item.assignee?.trim() || 'Unassigned'))
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const typeFilterOptions = useMemo(() => {
    const fromCatalog = WORK_ITEM_TYPE_OPTIONS.map((option) => option.type)
    const fromData = rows.map(({ item }) => item.type)
    return Array.from(new Set([...fromCatalog, ...fromData])).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const statusFilterOptions = useMemo(
    () => Array.from(new Set(rows.map(({ item }) => normalizeProjectWorkItemStatus(item.status)))).sort(),
    [rows],
  )

  const priorityFilterOptions = useMemo(
    () => Array.from(new Set(rows.map(({ item }) => item.priority))).sort(),
    [rows],
  )

  const toggleColumnFilter = (setter: Dispatch<SetStateAction<Set<string>>>, value: string) => {
    setter((previous) => {
      const next = new Set(previous)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
    onPageChange(1)
  }

  const filteredRows = useMemo(() => {
    return rows.filter(({ item }) => {
      if (typeFilterTags.size > 0 && !typeFilterTags.has(item.type)) return false
      if (
        statusFilterTags.size > 0 &&
        !statusFilterTags.has(normalizeProjectWorkItemStatus(item.status))
      ) {
        return false
      }
      if (priorityFilterTags.size > 0 && !priorityFilterTags.has(item.priority)) return false
      const assigneeName = item.assignee?.trim() || 'Unassigned'
      if (assigneeFilterTags.size > 0 && !assigneeFilterTags.has(assigneeName)) return false
      return true
    })
  }, [assigneeFilterTags, priorityFilterTags, rows, statusFilterTags, typeFilterTags])

  const sortedRows = useMemo(
    () => sortArchivedRows(filteredRows, sortKey, sortDirection),
    [filteredRows, sortDirection, sortKey],
  )

  useEffect(() => {
    onPageChange(1)
  }, [items.length, pageSize, sortDirection, sortKey, typeFilterTags, statusFilterTags, priorityFilterTags, assigneeFilterTags, onPageChange])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const pageSafe = Math.min(page, totalPages)
  const pageStart = sortedRows.length === 0 ? 0 : (pageSafe - 1) * pageSize + 1
  const pageEnd = Math.min(pageSafe * pageSize, sortedRows.length)
  const pagedRows = useMemo(
    () => sortedRows.slice((pageSafe - 1) * pageSize, pageSafe * pageSize),
    [pageSafe, pageSize, sortedRows],
  )

  useEffect(() => {
    if (page > totalPages) onPageChange(totalPages)
  }, [onPageChange, page, totalPages])

  useEffect(() => {
    onRowsMetaChange?.({
      total: sortedRows.length,
      pageStart,
      pageEnd,
      pageSafe,
      totalPages,
    })
  }, [onRowsMetaChange, pageEnd, pageSafe, pageStart, sortedRows.length, totalPages])

  const columnWidthStyle = useCallback(
    (columnKey: ArchivedColumnKey): CSSProperties | undefined => {
      const px = columnWidthsPx[columnKey]
      if (!px || px <= 0) return undefined
      return { width: px, minWidth: px, maxWidth: px }
    },
    [columnWidthsPx],
  )

  const beginColumnResize = useCallback(
    (columnKey: ArchivedColumnKey, startX: number, thElement: HTMLTableCellElement) => {
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

  const handleSort = (nextSortKey: ArchivedSortKey) => {
    if (sortKey === nextSortKey) {
      setSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(nextSortKey)
    setSortDirection('asc')
    onPageChange(1)
  }

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    if (active.id === ARCHIVED_PINNED_FIRST_COLUMN) return
    setColumnOrder((previous) => {
      const oldIndex = previous.indexOf(active.id as ArchivedColumnKey)
      let newIndex = previous.indexOf(over.id as ArchivedColumnKey)
      if (oldIndex < 0 || newIndex < 0) return previous
      if (newIndex === 0) newIndex = 1
      const next = arrayMove(previous, oldIndex, newIndex)
      if (next[0] === ARCHIVED_PINNED_FIRST_COLUMN) return next
      const rest = next.filter((key) => key !== ARCHIVED_PINNED_FIRST_COLUMN)
      return [ARCHIVED_PINNED_FIRST_COLUMN, ...rest]
    })
  }

  const renderColumnFilter = (filterKey: ArchivedFilterKey) => {
    switch (filterKey) {
      case 'type':
        return (
          <ArchivedColumnFilterMenu
            label="Type"
            options={typeFilterOptions}
            selected={typeFilterTags}
            onToggle={(value) => toggleColumnFilter(setTypeFilterTags, value)}
            onClearAll={() => setTypeFilterTags(new Set())}
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
          <ArchivedColumnFilterMenu
            label="Status"
            options={statusFilterOptions}
            selected={statusFilterTags}
            onToggle={(value) => toggleColumnFilter(setStatusFilterTags, value)}
            onClearAll={() => setStatusFilterTags(new Set())}
            renderOption={(value) => <ProjectWorkItemStatusBadge status={value as WorkItemApiModel['status']} />}
          />
        )
      case 'priority':
        return (
          <ArchivedColumnFilterMenu
            label="Priority"
            options={priorityFilterOptions}
            selected={priorityFilterTags}
            onToggle={(value) => toggleColumnFilter(setPriorityFilterTags, value)}
            onClearAll={() => setPriorityFilterTags(new Set())}
            renderOption={(value) => (
              <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', PROJECT_WORK_ITEM_PRIORITY_CHIP[value as Priority])}>
                {value}
              </span>
            )}
          />
        )
      case 'assignee':
        return (
          <ArchivedColumnFilterMenu
            label="Assignee"
            options={assigneeOptions}
            selected={assigneeFilterTags}
            onToggle={(value) => toggleColumnFilter(setAssigneeFilterTags, value)}
            onClearAll={() => setAssigneeFilterTags(new Set())}
            renderOption={(value) => (
              <span className="inline-flex items-center gap-2">
                <ProjectWorkItemPersonAvatar name={value} />
                {value}
              </span>
            )}
          />
        )
    }
  }

  const renderBodyCell = (
    row: ArchivedTableRow,
    columnKey: ArchivedColumnKey,
    cellClass: string,
    titleCellClass: string,
    cellStyle?: CSSProperties,
  ) => {
    const { item, meta } = row
    const status = normalizeProjectWorkItemStatus(item.status)
    const assigneeName = item.assignee?.trim() || 'Unassigned'

    switch (columnKey) {
      case 'title':
        return (
          <td key={columnKey} className={titleCellClass} style={cellStyle}>
            <div className="flex min-w-0 items-start gap-1.5">
              <span className={PROJECT_LIST_DRAG_HANDLE_CLASS} aria-hidden title="Archived row">
                <GripVertical className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-foreground">{item.title}</div>
                <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{item.id}</div>
              </div>
            </div>
          </td>
        )
      case 'type':
        return (
          <td key={columnKey} className={cn(cellClass, 'whitespace-nowrap')} style={cellStyle}>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground">
              <WorkItemTypeIcon type={item.type} className="h-3.5 w-3.5" />
              {item.type}
            </span>
          </td>
        )
      case 'status':
        return (
          <td key={columnKey} className={cn(cellClass, 'whitespace-nowrap')} style={cellStyle}>
            <ProjectWorkItemStatusBadge status={status} />
          </td>
        )
      case 'priority':
        return (
          <td key={columnKey} className={cn(cellClass, 'whitespace-nowrap')} style={cellStyle}>
            <ProjectWorkItemPriorityBadge priority={item.priority} />
          </td>
        )
      case 'assignee':
        return (
          <td key={columnKey} className={cn(cellClass, 'whitespace-nowrap')} style={cellStyle}>
            <div className="flex min-w-0 items-center gap-2">
              <ProjectWorkItemPersonAvatar name={assigneeName} />
              <span className="truncate font-semibold text-foreground">{assigneeName}</span>
            </div>
          </td>
        )
      case 'archived':
        return (
          <td key={columnKey} className={cn(cellClass, 'whitespace-nowrap')} style={cellStyle}>
            <div className="space-y-0.5">
              <div className="font-semibold text-foreground">{formatArchivedDate(meta?.archivedAt)}</div>
              <div className="text-[11px] text-muted-foreground">by {meta?.archivedBy ?? '—'}</div>
            </div>
          </td>
        )
      case 'action':
        return (
          <td key={columnKey} className={cn(cellClass, 'whitespace-nowrap text-right')} style={cellStyle}>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => onRestore(item)}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Restore
            </Button>
          </td>
        )
      default:
        return null
    }
  }

  return (
    <div className={PROJECT_LIST_TABLE_SCROLL_CLASS}>
        <DndContext sensors={columnDndSensors} onDragEnd={handleColumnDragEnd}>
          <table className="w-full table-fixed border-collapse text-xs select-none">
            <colgroup>
              {columnOrder.map((columnKey) => {
                const widthStyle = columnWidthStyle(columnKey)
                return (
                  <col
                    key={columnKey}
                    className={widthStyle ? undefined : ARCHIVED_HEADER_BY_KEY[columnKey].colClassName}
                    style={widthStyle}
                  />
                )
              })}
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-muted-foreground">
                <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                  {columnOrder.map((columnKey) => {
                    const header = ARCHIVED_HEADER_BY_KEY[columnKey]
                    return (
                      <ProjectWorkItemTableHeaderCell
                        key={columnKey}
                        columnKey={columnKey}
                        pinnedFirstKey={ARCHIVED_PINNED_FIRST_COLUMN}
                        label={header.label}
                        icon={header.icon}
                        sortKey={header.sortKey ?? 'title'}
                        activeSortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        sortable={header.sortable !== false && Boolean(header.sortKey)}
                        filterSlot={header.filterKey ? renderColumnFilter(header.filterKey) : undefined}
                        isLastColumn={columnOrder[columnOrder.length - 1] === columnKey}
                        columnWidthStyle={columnWidthStyle(columnKey)}
                        columnResizingKey={columnResizingKey}
                        onBeginResize={beginColumnResize}
                        draggable={columnKey !== 'action'}
                      />
                    )
                  })}
                </SortableContext>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={columnOrder.length} className="px-6 py-16 text-center text-sm text-muted-foreground">
                    No archived items match the current filters.
                  </td>
                </tr>
              ) : (
                pagedRows.map((row) => {
                  const cellClass = cn(PROJECT_LIST_TABLE_BODY_CELL_CLASS, 'group-hover:bg-accent/20')
                  const titleCellClass = cn(
                    PROJECT_LIST_TABLE_BODY_CELL_CLASS,
                    PROJECT_LIST_FIRST_COLUMN_TINT_BODY_CLASS,
                    'group-hover:bg-accent/20',
                  )
                  return (
                    <tr key={row.item.id} className="group transition-colors">
                      {columnOrder.map((columnKey) =>
                        renderBodyCell(row, columnKey, cellClass, titleCellClass, columnWidthStyle(columnKey)),
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </DndContext>
    </div>
  )
}
