import { useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { DndContext } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import {
  BookOpenText,
  BrainCircuit,
  FileStack,
  FileType,
  GitBranch,
  Link2,
  Loader2,
  Lock,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { EnterpriseColumnFilterDropdown } from '@/components/enterprise/EnterpriseColumnFilterDropdown'
import { EnterpriseSortableHeaderCell } from '@/components/enterprise/EnterpriseSortableHeaderCell'
import { useEnterpriseSortableColumns } from '@/components/enterprise/useEnterpriseSortableColumns'
import { cn } from '@/lib/utils'
import {
  PROJECT_LIST_FIRST_COLUMN_TINT_BODY_CLASS,
  PROJECT_LIST_FIRST_COLUMN_TINT_HEADER_CLASS,
  PROJECT_LIST_HEADER_ICON_CLASS,
  PROJECT_LIST_OTHER_COLUMN_TINT_HEADER_CLASS,
  PROJECT_LIST_TABLE_BODY_CELL_CLASS,
  PROJECT_LIST_TABLE_HEAD_CELL_CLASS,
} from '@/modules/projects/lib/projectListTableClasses'
import { getFileTypeIcon } from '../fileTypeIcon'
import {
  statusBadgeClass,
  type RepositoryItem,
} from '../lib/documentRepositoryPresentation'

function FileTypeIconImg({ fileName, compact = false }: { fileName: string; compact?: boolean }) {
  return (
    <img
      src={getFileTypeIcon(fileName)}
      alt=""
      className={cn(
        'shrink-0 object-contain object-center',
        compact ? 'h-8 w-8' : 'size-14',
      )}
      draggable={false}
      aria-hidden
    />
  )
}

const PROJECT_LIST_DOCS_HEADERS = [
  { key: 'document', label: 'Document', icon: FileStack, colClass: 'w-[26%]', isFirst: true },
  { key: 'type', label: 'Type', icon: FileType, colClass: 'w-[9%]' },
  { key: 'capability', label: 'Capability', icon: BrainCircuit, colClass: 'w-[9%]' },
  { key: 'linked', label: 'Linked project / task', icon: Link2, colClass: 'w-[14%]' },
  { key: 'owner', label: 'Owner', icon: Users, colClass: 'w-[11%]' },
  { key: 'version', label: 'Version', icon: GitBranch, colClass: 'w-[7%]' },
  { key: 'status', label: 'Status', icon: ShieldCheck, colClass: 'w-[9%]' },
  { key: 'kb', label: 'KB progress', icon: BookOpenText, colClass: 'w-[18%]' },
  { key: 'access', label: 'Access', icon: Lock, colClass: 'w-[7%]' },
] as const

type RepositoryColumnKey = (typeof PROJECT_LIST_DOCS_HEADERS)[number]['key']

const REPOSITORY_HEADER_BY_KEY = Object.fromEntries(
  PROJECT_LIST_DOCS_HEADERS.map((header) => [header.key, header]),
) as Record<RepositoryColumnKey, (typeof PROJECT_LIST_DOCS_HEADERS)[number]>

const REPOSITORY_FILTER_COLUMNS = new Set<RepositoryColumnKey>(['type', 'capability', 'status'])

const REPOSITORY_BODY_CELL_CLASS =
  'border-b border-slate-200/20 px-3 py-2 align-top transition-colors group-hover:bg-accent/20 dark:border-slate-700/20'

function repositoryColumnValue(item: RepositoryItem, key: RepositoryColumnKey): string {
  switch (key) {
    case 'document':
      return item.displayName || item.name
    case 'type':
      return item.type
    case 'capability':
      return item.capability
    case 'linked':
      return item.linkedContext
    case 'owner':
      return item.owner
    case 'version':
      return item.version
    case 'status':
      return item.status
    case 'kb':
      return ''
    case 'access':
      return item.accessScope
  }
}

function countColumnOptions(values: string[]) {
  const counts = new Map<string, number>()
  for (const value of values) {
    const label = value.trim()
    if (!label) continue
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value))
}

export const REPOSITORY_HEADER_CELL_CLASS =
  'select-none border-b-[3px] border-double border-slate-300/90 bg-white/90 px-3 py-2 text-left font-semibold backdrop-blur dark:border-slate-600/80 dark:bg-slate-900/90'

export type DocumentRepositoryPaginationProps = {
  page: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  loading?: boolean
}

export function DocumentRepositoryPaginationControls({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  loading = false,
}: DocumentRepositoryPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const pageSafe = Math.min(Math.max(1, page), totalPages)
  const start = totalCount === 0 ? 0 : (pageSafe - 1) * pageSize + 1
  const end = totalCount === 0 ? 0 : Math.min(pageSafe * pageSize, totalCount)

  return (
    <div className="flex items-center justify-end gap-3 overflow-x-auto py-1 whitespace-nowrap text-xs text-muted-foreground scrollbar-hide">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{start}</span>-
        <span className="font-semibold text-foreground">{end}</span> of{' '}
        <span className="font-semibold text-foreground">{totalCount}</span>
      </p>
      <span className="text-xs text-muted-foreground">Rows:</span>
      <Select
        value={String(pageSize)}
        onChange={(event) => onPageSizeChange(parseInt(event.target.value, 10))}
        className="h-10 w-[84px] text-sm"
      >
        <option value="5">5</option>
        <option value="10">10</option>
        <option value="15">15</option>
        <option value="25">25</option>
      </Select>
      <div className="flex h-10 items-stretch gap-0.5 rounded-lg border border-border bg-background/80 p-0.5 shadow-sm">
        <button
          type="button"
          className="flex items-center justify-center rounded-md px-2 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
          onClick={() => onPageChange(Math.max(1, pageSafe - 1))}
          disabled={pageSafe <= 1}
        >
          Previous
        </button>
        <div className="flex items-center justify-center px-2 text-xs text-muted-foreground tabular-nums">
          {pageSafe} / {totalPages}
        </div>
        <button
          type="button"
          className="flex items-center justify-center rounded-md px-2 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
          onClick={() => onPageChange(Math.min(totalPages, pageSafe + 1))}
          disabled={pageSafe >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  )
}

type DocumentRepositoryTableViewProps = {
  items: RepositoryItem[]
  showKbProgressColumn?: boolean
  loading?: boolean
  emptyMessage?: string
  onDocumentClick?: (item: RepositoryItem) => void
  /** Opens the document's revision timeline from its visible version label. */
  onVersionClick?: (item: RepositoryItem) => void
  showTags?: boolean
  /** When provided, the KB progress cell reflects real generated status instead of the static "Not Generated" placeholder. */
  isKbGenerated?: (item: RepositoryItem) => boolean
  /** When provided, right-clicking a row calls this instead of showing the browser's context menu. */
  onRowContextMenu?: (event: MouseEvent<HTMLTableRowElement>, item: RepositoryItem) => void
  /** Extra control under the document name. Idea Docs uses it for Request for Approval. */
  rowAction?: (item: RepositoryItem) => ReactNode
  /** `project-list` matches Project Detail → List table styling. */
  variant?: 'repository' | 'project-list'
  /** Header keys to omit. Idea Docs hides Linked project and Access so the table matches Document repository. */
  hiddenColumnKeys?: Array<(typeof PROJECT_LIST_DOCS_HEADERS)[number]['key']>
  /** Detail keeps the Idle / Ready to generate KB readout used by Document repository. */
  kbLayout?: 'compact' | 'detail'
}

export function DocumentRepositoryTableView({
  items,
  showKbProgressColumn = true,
  loading = false,
  emptyMessage = 'No documents in this folder.',
  onDocumentClick,
  onVersionClick,
  showTags = true,
  isKbGenerated,
  onRowContextMenu,
  rowAction,
  variant = 'repository',
  hiddenColumnKeys = [],
  kbLayout = 'compact',
}: DocumentRepositoryTableViewProps) {
  const isProjectListVariant = variant === 'project-list'
  const hidden = new Set(hiddenColumnKeys)
  const visibleHeaders = PROJECT_LIST_DOCS_HEADERS.filter(
    (header) => (header.key !== 'kb' || showKbProgressColumn) && !hidden.has(header.key),
  )
  const showLinked = !hidden.has('linked')
  const showAccess = !hidden.has('access')
  const showDetailKb = !isProjectListVariant || kbLayout === 'detail'
  const repositoryColumns = useEnterpriseSortableColumns<RepositoryColumnKey>({
    initialOrder: PROJECT_LIST_DOCS_HEADERS.map((header) => header.key),
    pinnedFirstKey: 'document',
    initialHiddenColumns: [
      ...hiddenColumnKeys,
      ...(showKbProgressColumn ? [] : (['kb'] as RepositoryColumnKey[])),
    ],
    hasSelectionColumn: false,
  })
  const [repositorySort, setRepositorySort] = useState<{ key: RepositoryColumnKey; dir: 'asc' | 'desc' } | null>(null)
  const [repositoryFilters, setRepositoryFilters] = useState<Partial<Record<RepositoryColumnKey, Set<string>>>>({})

  const toggleRepositorySort = (key: RepositoryColumnKey) => {
    setRepositorySort((current) => {
      if (!current || current.key !== key) return { key, dir: 'asc' }
      if (current.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  const toggleRepositoryFilter = (key: RepositoryColumnKey, value: string) => {
    setRepositoryFilters((current) => {
      const next = new Set(current[key] ?? [])
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return { ...current, [key]: next }
    })
  }

  const repositoryRows = useMemo(() => {
    if (isProjectListVariant) return items
    const filtered = items.filter((item) =>
      (['type', 'capability', 'status'] as const).every((key) => {
        const selected = repositoryFilters[key]
        return !selected || selected.size === 0 || selected.has(repositoryColumnValue(item, key))
      }),
    )
    if (!repositorySort) return filtered
    const { key, dir } = repositorySort
    return [...filtered].sort((left, right) => {
      const compared = repositoryColumnValue(left, key).localeCompare(repositoryColumnValue(right, key), undefined, {
        numeric: true,
        sensitivity: 'base',
      })
      return dir === 'asc' ? compared : -compared
    })
  }, [isProjectListVariant, items, repositoryFilters, repositorySort])
  if (!isProjectListVariant && loading && items.length === 0) {
    return (
      <div className="flex h-full min-h-[12rem] w-full flex-1 items-center justify-center rounded-xl border border-dashed border-border/50 px-4 py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isProjectListVariant && items.length === 0) {
    return (
      <div className="flex h-full min-h-[12rem] w-full flex-1 items-center justify-center rounded-xl border border-dashed border-border/50 px-4 py-10 text-center">
        <p className="text-sm font-medium text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  const table = (
    <table
      ref={isProjectListVariant ? undefined : repositoryColumns.tableRef}
      className={cn(
        'border-collapse text-xs select-none',
        isProjectListVariant
          ? 'table-fixed w-full'
          : repositoryColumns.hasAnyCustomWidth || repositoryColumns.resizingKey
            ? 'table-fixed w-full'
            : 'w-full',
      )}
    >
      {isProjectListVariant ? (
        <colgroup>
          {visibleHeaders.map((header) => (
            <col key={header.key} className={header.colClass} />
          ))}
        </colgroup>
      ) : (
        <colgroup>
          {repositoryColumns.visibleColumnOrder.map((key) => (
            <col key={key} style={repositoryColumns.columnWidthStyle(key)} />
          ))}
        </colgroup>
      )}
      <thead className="sticky top-0 z-10">
        <tr className="text-left text-muted-foreground">
          {isProjectListVariant ? visibleHeaders.map((header) => {
            const Icon = header.icon
            return (
              <th
                key={header.key}
                className={cn(
                  PROJECT_LIST_TABLE_HEAD_CELL_CLASS,
                  header.isFirst
                    ? PROJECT_LIST_FIRST_COLUMN_TINT_HEADER_CLASS
                    : cn(PROJECT_LIST_OTHER_COLUMN_TINT_HEADER_CLASS, 'whitespace-nowrap'),
                )}
              >
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Icon className={PROJECT_LIST_HEADER_ICON_CLASS} aria-hidden />
                  <span>{header.label}</span>
                </span>
              </th>
            )
          }) : (
            <SortableContext items={repositoryColumns.visibleColumnOrder} strategy={rectSortingStrategy}>
              {repositoryColumns.visibleColumnOrder.map((key) => {
                const header = REPOSITORY_HEADER_BY_KEY[key]
                const selected = repositoryFilters[key] ?? new Set<string>()
                return (
                  <EnterpriseSortableHeaderCell
                    key={key}
                    columnKey={key}
                    label={header.label}
                    icon={header.icon}
                    isPinned={repositoryColumns.isPinnedColumn(key)}
                    isFirstColumn={repositoryColumns.isFirstColumn(key)}
                    isLastColumn={repositoryColumns.isLastColumn(key)}
                    widthStyle={repositoryColumns.columnWidthStyle(key)}
                    sortDir={repositorySort?.key === key ? repositorySort.dir : null}
                    onToggleSort={toggleRepositorySort}
                    filterSlot={
                      REPOSITORY_FILTER_COLUMNS.has(key) ? (
                        <EnterpriseColumnFilterDropdown
                          label={header.label}
                          ariaLabel={`Filter ${header.label} in table`}
                          options={countColumnOptions(items.map((item) => repositoryColumnValue(item, key)))}
                          selected={selected}
                          onShowAll={() =>
                            setRepositoryFilters((current) => ({ ...current, [key]: new Set() }))
                          }
                          onToggleOption={(value) => toggleRepositoryFilter(key, value)}
                        />
                      ) : undefined
                    }
                    frozenColumnClass={repositoryColumns.frozenColumnHeaderClass}
                    firstColumnTintClass={repositoryColumns.firstColumnTintHeaderClass}
                    isResizing={repositoryColumns.resizingKey === key}
                    onBeginResize={repositoryColumns.beginColumnResize}
                    onContextMenu={(event, columnKey) =>
                      repositoryColumns.setHeaderContextMenu({ x: event.clientX, y: event.clientY, columnKey })
                    }
                  />
                )
              })}
            </SortableContext>
          )}
        </tr>
      </thead>
      <tbody>
        {isProjectListVariant && loading && items.length === 0 ? (
          <tr>
            <td colSpan={visibleHeaders.length} className="px-6 py-16 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden />
              Loading documents…
            </td>
          </tr>
        ) : items.length === 0 || (!isProjectListVariant && repositoryRows.length === 0) ? (
          <tr>
            <td
              colSpan={isProjectListVariant ? visibleHeaders.length : repositoryColumns.visibleColumnOrder.length}
              className="px-6 py-16 text-center text-sm text-muted-foreground"
            >
              {emptyMessage}
            </td>
          </tr>
        ) : !isProjectListVariant ? (
          repositoryRows.map((item) => {
            const generated = isKbGenerated?.(item) ?? false
            const progress = generated ? 100 : 0
            return (
              <tr
                key={item.id}
                className="group transition-colors"
                onContextMenu={
                  onRowContextMenu
                    ? (event) => {
                        event.preventDefault()
                        onRowContextMenu(event, item)
                      }
                    : undefined
                }
              >
                {repositoryColumns.visibleColumnOrder.map((key) => {
                  const isFirst = repositoryColumns.isFirstColumn(key)
                  return (
                    <td
                      key={key}
                      className={cn(
                        REPOSITORY_BODY_CELL_CLASS,
                        isFirst && repositoryColumns.firstColumnTintBodyClass,
                        isFirst && repositoryColumns.freezeFirstColumn && repositoryColumns.frozenColumnBodyClass,
                        key === 'type' && 'max-w-[8.5rem] whitespace-normal leading-4 text-foreground',
                        key === 'kb' && showDetailKb && 'min-w-[300px]',
                      )}
                    >
                      {renderRepositoryColumnCell({
                        item,
                        key,
                        showTags,
                        showDetailKb,
                        generated,
                        progress,
                        onDocumentClick,
                        onVersionClick,
                        rowAction,
                      })}
                    </td>
                  )
                })}
              </tr>
            )
          })
        ) : (
          items.map((item) => {
            const generated = isKbGenerated?.(item) ?? false
            const progress = generated ? 100 : 0
            const titleCellClass = cn(
              PROJECT_LIST_TABLE_BODY_CELL_CLASS,
              PROJECT_LIST_FIRST_COLUMN_TINT_BODY_CLASS,
              'group-hover:bg-accent/20',
            )
            const cellClass = cn(PROJECT_LIST_TABLE_BODY_CELL_CLASS, 'group-hover:bg-accent/20')

            return (
              <tr
                key={item.id}
                className={cn(
                  'transition-colors',
                  isProjectListVariant ? 'group hover:bg-transparent' : 'border-t border-border/25 hover:bg-accent/20',
                )}
                onContextMenu={
                  onRowContextMenu
                    ? (event) => {
                        event.preventDefault()
                        onRowContextMenu(event, item)
                      }
                    : undefined
                }
              >
                <td className={isProjectListVariant ? titleCellClass : 'px-3 py-2 align-top'}>
                  {onDocumentClick ? (
                    <button type="button" className="min-w-0 text-left" onClick={() => onDocumentClick(item)}>
                      <DocumentCellContent item={item} compact={isProjectListVariant} showTags={showTags} />
                    </button>
                  ) : (
                    <DocumentCellContent item={item} compact={isProjectListVariant} showTags={showTags} />
                  )}
                  {rowAction?.(item)}
                </td>
                <td
                  className={cn(
                    isProjectListVariant
                      ? cn(cellClass, 'whitespace-nowrap text-foreground')
                      : 'max-w-[8.5rem] px-3 py-2 align-top whitespace-normal leading-4 text-foreground',
                  )}
                >
                  {item.type}
                </td>
                <td className={isProjectListVariant ? cn(cellClass, 'text-foreground') : 'px-3 py-2 align-top text-foreground'}>
                  {item.capability}
                </td>
                {showLinked ? (
                  <td className={isProjectListVariant ? cn(cellClass, 'text-foreground') : 'px-3 py-2 align-top text-foreground'}>
                    {item.linkedContext}
                  </td>
                ) : null}
                <td className={isProjectListVariant ? cn(cellClass, 'whitespace-nowrap text-foreground') : 'px-3 py-2 align-top text-foreground'}>
                  {item.owner}
                </td>
                <td
                  className={cn(
                    isProjectListVariant ? cn(cellClass, 'font-semibold text-foreground') : 'px-3 py-2 align-top font-semibold text-foreground',
                  )}
                >
                  {onVersionClick ? (
                    <button
                      type="button"
                      className="rounded font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => onVersionClick(item)}
                      aria-label={`Open version history for ${item.displayName || item.name}`}
                    >
                      {item.version}
                    </button>
                  ) : item.version}
                </td>
                <td className={isProjectListVariant ? cellClass : 'px-3 py-2 align-top'}>
                  <Badge
                    variant="outline"
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-medium',
                      statusBadgeClass(item.status),
                    )}
                  >
                    {item.status}
                  </Badge>
                </td>
                {showKbProgressColumn ? (
                  <td className={isProjectListVariant && !showDetailKb ? cellClass : 'min-w-[300px] px-3 py-2 align-top'}>
                    {isProjectListVariant && !showDetailKb ? (
                      <div className="flex w-full min-w-0 items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-full rounded-full transition-[width] duration-300',
                              generated ? 'bg-emerald-600' : 'bg-blue-600',
                            )}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">{progress}%</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
                          <div
                            className={cn(
                              'h-full rounded-full transition-[width] duration-300',
                              generated ? 'w-full bg-emerald-500' : 'w-0 bg-slate-300',
                            )}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                'text-[10px] font-medium',
                                generated ? 'text-emerald-700' : 'text-slate-500',
                              )}
                            >
                              {generated ? 'Completed' : 'Idle'}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-600">{progress}%</span>
                          </div>
                          <Badge
                            className={cn(
                              'flex-shrink-0 rounded-full px-2 py-0 text-[9px] font-semibold whitespace-nowrap',
                              generated
                                ? 'border border-emerald-300 bg-emerald-100 text-emerald-700'
                                : 'border border-slate-300 bg-slate-100 text-slate-600',
                            )}
                          >
                            {generated ? '✓ Generated' : '○ Not Generated'}
                          </Badge>
                        </div>
                        <p className="line-clamp-2 text-[10px] leading-tight text-slate-500">
                          {generated ? 'Knowledge base entry available.' : 'Ready to generate KB'}
                        </p>
                      </div>
                    )}
                  </td>
                ) : null}
                {showAccess ? (
                  <td className={isProjectListVariant ? cellClass : 'px-3 py-2 align-top'}>
                    <Badge
                      variant="outline"
                      className="rounded-full border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200"
                    >
                      {item.accessScope}
                    </Badge>
                  </td>
                ) : null}
              </tr>
            )
          })
        )}
      </tbody>
    </table>
  )

  if (isProjectListVariant) return table

  return (
    <DndContext sensors={repositoryColumns.dndSensors} onDragEnd={repositoryColumns.handleColumnDragEnd}>
      {table}
    </DndContext>
  )
}

function renderRepositoryColumnCell({
  item,
  key,
  showTags,
  showDetailKb,
  generated,
  progress,
  onDocumentClick,
  onVersionClick,
  rowAction,
}: {
  item: RepositoryItem
  key: RepositoryColumnKey
  showTags: boolean
  showDetailKb: boolean
  generated: boolean
  progress: number
  onDocumentClick?: (item: RepositoryItem) => void
  onVersionClick?: (item: RepositoryItem) => void
  rowAction?: (item: RepositoryItem) => ReactNode
}) {
  switch (key) {
    case 'document':
      return (
        <div>
          {onDocumentClick ? (
            <button type="button" className="min-w-0 text-left" onClick={() => onDocumentClick(item)}>
              <DocumentCellContent item={item} showTags={showTags} />
            </button>
          ) : (
            <DocumentCellContent item={item} showTags={showTags} />
          )}
          {rowAction?.(item)}
        </div>
      )
    case 'type':
      return item.type
    case 'capability':
      return item.capability
    case 'linked':
      return item.linkedContext
    case 'owner':
      return item.owner
    case 'version':
      return onVersionClick ? (
        <button
          type="button"
          className="rounded font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onVersionClick(item)}
          aria-label={`Open version history for ${item.displayName || item.name}`}
        >
          {item.version}
        </button>
      ) : (
        item.version
      )
    case 'status':
      return (
        <Badge variant="outline" className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', statusBadgeClass(item.status))}>
          {item.status}
        </Badge>
      )
    case 'kb':
      return showDetailKb ? (
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
            <div className={cn('h-full rounded-full transition-[width] duration-300', generated ? 'w-full bg-emerald-500' : 'w-0 bg-slate-300')} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('text-[10px] font-medium', generated ? 'text-emerald-700' : 'text-slate-500')}>
                {generated ? 'Completed' : 'Idle'}
              </span>
              <span className="text-[10px] font-semibold text-slate-600">{progress}%</span>
            </div>
            <Badge
              className={cn(
                'flex-shrink-0 rounded-full px-2 py-0 text-[9px] font-semibold whitespace-nowrap',
                generated
                  ? 'border border-emerald-300 bg-emerald-100 text-emerald-700'
                  : 'border border-slate-300 bg-slate-100 text-slate-600',
              )}
            >
              {generated ? '✓ Generated' : '○ Not Generated'}
            </Badge>
          </div>
          <p className="line-clamp-2 text-[10px] leading-tight text-slate-500">
            {generated ? 'Knowledge base entry available.' : 'Ready to generate KB'}
          </p>
        </div>
      ) : (
        <div className="flex w-full min-w-0 items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-[width] duration-300', generated ? 'bg-emerald-600' : 'bg-blue-600')}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">{progress}%</span>
        </div>
      )
    case 'access':
      return (
        <Badge
          variant="outline"
          className="rounded-full border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200"
        >
          {item.accessScope}
        </Badge>
      )
  }
}

function DocumentCellContent({ item, compact = false, showTags = true }: { item: RepositoryItem; compact?: boolean; showTags?: boolean }) {
  return (
    <div className={cn('flex items-start', compact ? 'gap-2' : 'gap-3')}>
      <FileTypeIconImg fileName={item.fileName || item.name} compact={compact} />
      <div className="min-w-0">
        <p
          className={cn(
            'font-semibold text-foreground',
            compact ? 'line-clamp-2 text-xs leading-snug' : 'line-clamp-1 text-sm leading-snug text-slate-900',
          )}
        >
          {item.displayName || item.name}
        </p>
        {!compact && item.fileName && item.fileName !== (item.displayName || item.name) ? (
          <p className="mt-0.5 truncate text-[11px] text-slate-500">{item.fileName}</p>
        ) : null}
        {showTags && item.tags.length > 0 ? (
          <div className={cn('flex flex-wrap gap-1', compact ? 'mt-0.5' : 'mt-1 gap-1.5')}>
            {item.tags.map((tagItem) => (
              <Badge
                key={tagItem}
                variant="outline"
                className="rounded-full border-slate-200 bg-slate-50 px-2 py-0 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300"
              >
                {tagItem}
              </Badge>
            ))}
          </div>
        ) : null}
        <p className={cn('text-[11px] text-muted-foreground', compact ? 'mt-0.5' : 'mt-0.5 text-slate-500')}>
          Updated {item.updated}
        </p>
      </div>
    </div>
  )
}
