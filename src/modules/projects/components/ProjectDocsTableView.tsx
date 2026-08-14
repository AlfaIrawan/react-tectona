import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import {
  BarChart3,
  CalendarClock,
  CheckSquare2,
  FileText,
  Folder,
  Layers3,
  Shield,
  Square,
  Users,
  Workflow,
} from 'lucide-react'
import type { DocumentFolder } from '@/lib/api/documentFolderApi'
import { getFileTypeIcon } from '@/modules/document-knowledge-management/fileTypeIcon'
import {
  formatRelativeTimestamp,
  statusBadgeClass,
  type RepositoryItem,
} from '@/modules/document-knowledge-management/lib/documentRepositoryPresentation'
import { cn } from '@/lib/utils'
import {
  PROJECT_LIST_FIRST_COLUMN_TINT_BODY_CLASS,
  PROJECT_LIST_OTHER_COLUMN_TINT_HEADER_CLASS,
  PROJECT_LIST_TABLE_BODY_CELL_CLASS,
  PROJECT_LIST_TABLE_HEAD_CELL_CLASS,
  PROJECT_LIST_TABLE_SCROLL_CLASS,
} from '../lib/projectListTableClasses'
import {
  PROJECT_LIST_PAGE_SIZE_OPTIONS,
  ProjectWorkItemPersonAvatar,
  ProjectWorkItemTableHeaderCell,
  type ProjectWorkItemTableRowsMeta,
} from './projectWorkItemTableShared'

type DocsSortKey = 'document' | 'type' | 'owner' | 'version' | 'status' | 'kb' | 'updated' | 'access'

type ProjectDocsTableRow =
  | { kind: 'folder'; folder: DocumentFolder }
  | { kind: 'document'; item: RepositoryItem }

function sortFolders(
  folders: DocumentFolder[],
  sortKey: DocsSortKey,
  direction: 'asc' | 'desc',
  resolveOwnerDisplayName: (actorRef: string | null | undefined) => string,
): DocumentFolder[] {
  const sorted = [...folders]
  sorted.sort((left, right) => {
    let compareValue = 0
    if (sortKey === 'document') {
      compareValue = left.name.localeCompare(right.name)
    } else if (sortKey === 'type') {
      compareValue = 'folder'.localeCompare('folder')
    } else if (sortKey === 'owner') {
      compareValue = resolveOwnerDisplayName(left.owner_id).localeCompare(
        resolveOwnerDisplayName(right.owner_id),
      )
    } else if (sortKey === 'updated') {
      compareValue = (left.updated_date || left.created_date || '').localeCompare(
        right.updated_date || right.created_date || '',
      )
    } else {
      compareValue = left.name.localeCompare(right.name)
    }
    if (compareValue === 0) compareValue = left.id.localeCompare(right.id)
    return direction === 'asc' ? compareValue : -compareValue
  })
  return sorted
}

function FileTypeIconImg({ fileName }: { fileName: string }) {
  return (
    <img
      src={getFileTypeIcon(fileName)}
      alt=""
      className="size-14 shrink-0 object-contain object-center"
      loading="lazy"
      draggable={false}
      aria-hidden
    />
  )
}

function FolderTypeIcon() {
  return (
    <span className="inline-flex size-14 shrink-0 items-center justify-center">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-200">
        <Folder className="h-5 w-5" aria-hidden />
      </span>
    </span>
  )
}

function sortDocsItems(
  items: RepositoryItem[],
  sortKey: DocsSortKey,
  direction: 'asc' | 'desc',
  isKbGenerated: (item: RepositoryItem) => boolean,
  resolveOwnerDisplayName: (actorRef: string | null | undefined) => string,
): RepositoryItem[] {
  const sorted = [...items]
  sorted.sort((left, right) => {
    let compareValue = 0
    if (sortKey === 'document') {
      compareValue = left.name.localeCompare(right.name)
    } else if (sortKey === 'type') {
      compareValue = left.type.localeCompare(right.type)
    } else if (sortKey === 'owner') {
      compareValue = resolveOwnerDisplayName(left.owner).localeCompare(resolveOwnerDisplayName(right.owner))
    } else if (sortKey === 'version') {
      compareValue = left.version.localeCompare(right.version)
    } else if (sortKey === 'status') {
      compareValue = left.status.localeCompare(right.status)
    } else if (sortKey === 'kb') {
      compareValue = Number(isKbGenerated(left)) - Number(isKbGenerated(right))
    } else if (sortKey === 'updated') {
      compareValue = (left.updatedAt || '').localeCompare(right.updatedAt || '')
    } else if (sortKey === 'access') {
      compareValue = left.accessScope.localeCompare(right.accessScope)
    }
    if (compareValue === 0) compareValue = left.id.localeCompare(right.id)
    return direction === 'asc' ? compareValue : -compareValue
  })
  return sorted
}

type ProjectDocsTableViewProps = {
  folders?: DocumentFolder[]
  onOpenFolder?: (folder: DocumentFolder) => void
  onDocumentClick?: (item: RepositoryItem) => void
  items: RepositoryItem[]
  resolveOwnerDisplayName?: (actorRef: string | null | undefined) => string
  loading?: boolean
  emptyMessage?: string
  isKbGenerated: (item: RepositoryItem) => boolean
  page: number
  pageSize: (typeof PROJECT_LIST_PAGE_SIZE_OPTIONS)[number]
  onPageChange: (page: number) => void
  onRowsMetaChange?: (meta: ProjectWorkItemTableRowsMeta) => void
  onRowContextMenu?: (event: MouseEvent<HTMLTableRowElement>, item: RepositoryItem) => void
  showSelection?: boolean
  selectedIds?: string[]
  onToggleRow?: (itemId: string) => void
  onTogglePageSelection?: () => void
  allPageSelected?: boolean
  somePageSelected?: boolean
  onPagedItemIdsChange?: (itemIds: string[]) => void
}

export function ProjectDocsTableView({
  folders = [],
  onOpenFolder,
  onDocumentClick,
  items,
  resolveOwnerDisplayName: resolveOwnerDisplayNameProp,
  loading = false,
  emptyMessage = 'No documents match the current search.',
  isKbGenerated,
  page,
  pageSize,
  onPageChange,
  onRowsMetaChange,
  onRowContextMenu,
  showSelection = false,
  selectedIds = [],
  onToggleRow,
  onTogglePageSelection,
  allPageSelected = false,
  somePageSelected = false,
  onPagedItemIdsChange,
}: ProjectDocsTableViewProps) {
  const [sortKey, setSortKey] = useState<DocsSortKey>('document')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const resolveOwnerDisplayName = useMemo(
    () => resolveOwnerDisplayNameProp ?? ((value: string | null | undefined) => value?.trim() || 'Unknown'),
    [resolveOwnerDisplayNameProp],
  )

  const sortedFolders = useMemo(
    () => sortFolders(folders, sortKey, sortDirection, resolveOwnerDisplayName),
    [folders, resolveOwnerDisplayName, sortDirection, sortKey],
  )

  const sortedItems = useMemo(
    () => sortDocsItems(items, sortKey, sortDirection, isKbGenerated, resolveOwnerDisplayName),
    [isKbGenerated, items, resolveOwnerDisplayName, sortDirection, sortKey],
  )

  const tableRows = useMemo<ProjectDocsTableRow[]>(
    () => [
      ...sortedFolders.map((folder) => ({ kind: 'folder' as const, folder })),
      ...sortedItems.map((item) => ({ kind: 'document' as const, item })),
    ],
    [sortedFolders, sortedItems],
  )

  const total = tableRows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pageSafe = Math.min(Math.max(1, page), totalPages)
  const pageStart = total === 0 ? 0 : (pageSafe - 1) * pageSize + 1
  const pageEnd = Math.min(pageSafe * pageSize, total)
  const pagedRows = tableRows.slice((pageSafe - 1) * pageSize, pageSafe * pageSize)

  useEffect(() => {
    if (page !== pageSafe) onPageChange(pageSafe)
  }, [onPageChange, page, pageSafe])

  useEffect(() => {
    onRowsMetaChange?.({
      total,
      pageStart,
      pageEnd,
      pageSafe,
      totalPages,
    })
    onPagedItemIdsChange?.(
      pagedRows
        .filter((row): row is { kind: 'document'; item: RepositoryItem } => row.kind === 'document')
        .map((row) => row.item.id),
    )
  }, [onPagedItemIdsChange, onRowsMetaChange, pageEnd, pageSafe, pageStart, pagedRows, total, totalPages])

  const handleSort = (key: DocsSortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDirection('asc')
  }

  const cellClass = cn(PROJECT_LIST_TABLE_BODY_CELL_CLASS, 'group-hover:bg-accent/20')
  const titleCellClass = cn(
    PROJECT_LIST_TABLE_BODY_CELL_CLASS,
    PROJECT_LIST_FIRST_COLUMN_TINT_BODY_CLASS,
    'group-hover:bg-accent/20 max-w-0 overflow-hidden',
  )
  const titleButtonClass = 'block w-full min-w-0 max-w-full text-left'
  const titleContentClass = 'min-w-0 flex-1 overflow-hidden'
  const titleTextClass = 'truncate font-semibold'
  const selectCellClass = cn(cellClass, 'w-10 whitespace-nowrap')
  const tableColSpan = 8 + (showSelection ? 1 : 0)

  return (
    <div className={PROJECT_LIST_TABLE_SCROLL_CLASS}>
      <table className="w-full table-fixed border-collapse text-xs select-none">
        <colgroup>
          {showSelection ? <col className="w-10" /> : null}
          <col className="w-[28%]" />
          <col className="w-[9%]" />
          <col className="w-[14%]" />
          <col className="w-[8%]" />
          <col className="w-[10%]" />
          <col className="w-[12%]" />
          <col className="w-[11%]" />
          <col className="w-[8%]" />
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr className="text-left text-muted-foreground">
            {showSelection ? (
              <th className={cn('w-10', PROJECT_LIST_TABLE_HEAD_CELL_CLASS, PROJECT_LIST_OTHER_COLUMN_TINT_HEADER_CLASS)}>
                <button
                  type="button"
                  aria-label={allPageSelected ? 'Deselect page' : 'Select page'}
                  className="inline-flex text-muted-foreground hover:text-foreground"
                  onClick={onTogglePageSelection}
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
            <ProjectWorkItemTableHeaderCell
              columnKey="document"
              pinnedFirstKey="document"
              label="Document"
              icon={FileText}
              sortKey="document"
              activeSortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
              isLastColumn={false}
              columnResizingKey={null}
              onBeginResize={() => {}}
              draggable={false}
            />
            <ProjectWorkItemTableHeaderCell
              columnKey="type"
              pinnedFirstKey="document"
              label="Type"
              icon={Layers3}
              sortKey="type"
              activeSortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
              isLastColumn={false}
              columnResizingKey={null}
              onBeginResize={() => {}}
              draggable={false}
            />
            <ProjectWorkItemTableHeaderCell
              columnKey="owner"
              pinnedFirstKey="document"
              label="Owner"
              icon={Users}
              sortKey="owner"
              activeSortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
              isLastColumn={false}
              columnResizingKey={null}
              onBeginResize={() => {}}
              draggable={false}
            />
            <ProjectWorkItemTableHeaderCell
              columnKey="version"
              pinnedFirstKey="document"
              label="Version"
              icon={FileText}
              sortKey="version"
              activeSortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
              isLastColumn={false}
              columnResizingKey={null}
              onBeginResize={() => {}}
              draggable={false}
            />
            <ProjectWorkItemTableHeaderCell
              columnKey="status"
              pinnedFirstKey="document"
              label="Status"
              icon={Workflow}
              sortKey="status"
              activeSortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
              isLastColumn={false}
              columnResizingKey={null}
              onBeginResize={() => {}}
              draggable={false}
            />
            <ProjectWorkItemTableHeaderCell
              columnKey="kb"
              pinnedFirstKey="document"
              label="KB progress"
              icon={BarChart3}
              sortKey="kb"
              activeSortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
              isLastColumn={false}
              columnResizingKey={null}
              onBeginResize={() => {}}
              draggable={false}
            />
            <ProjectWorkItemTableHeaderCell
              columnKey="updated"
              pinnedFirstKey="document"
              label="Updated"
              icon={CalendarClock}
              sortKey="updated"
              activeSortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
              isLastColumn={false}
              columnResizingKey={null}
              onBeginResize={() => {}}
              draggable={false}
            />
            <ProjectWorkItemTableHeaderCell
              columnKey="access"
              pinnedFirstKey="document"
              label="Access"
              icon={Shield}
              sortKey="access"
              activeSortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
              isLastColumn
              columnResizingKey={null}
              onBeginResize={() => {}}
              draggable={false}
            />
          </tr>
        </thead>
        <tbody>
          {loading && pagedRows.length === 0 ? (
            <tr>
              <td colSpan={tableColSpan} className="px-6 py-16 text-center text-sm text-muted-foreground">
                Loading documents…
              </td>
            </tr>
          ) : pagedRows.length === 0 ? (
            <tr>
              <td colSpan={tableColSpan} className="px-6 py-16 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            pagedRows.map((row) => {
              if (row.kind === 'folder') {
                const folder = row.folder
                const folderOwnerLabel = resolveOwnerDisplayName(folder.owner_id)
                const metaLabel = `${folder.document_count} docs · ${folder.children_count} subfolders`
                const updatedLabel = formatRelativeTimestamp(folder.updated_date || folder.created_date)

                return (
                  <tr
                    key={`folder-${folder.id}`}
                    className="group cursor-pointer transition-colors hover:bg-accent/10"
                    onDoubleClick={() => onOpenFolder?.(folder)}
                  >
                    {showSelection ? <td className={selectCellClass} aria-hidden /> : null}
                    <td className={titleCellClass}>
                      <button
                        type="button"
                        className={titleButtonClass}
                        title={`Open ${folder.name}`}
                        onClick={() => onOpenFolder?.(folder)}
                      >
                        <div className="flex min-w-0 items-start gap-3 overflow-hidden">
                          <FolderTypeIcon />
                          <div className={titleContentClass}>
                            <div className={cn(titleTextClass, 'text-foreground')}>{folder.name}</div>
                            <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{folder.id}</div>
                            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{metaLabel}</div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span className="rounded-full border border-sky-200/70 bg-sky-50/80 px-2 py-0 text-[10px] font-medium text-sky-700 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-200">
                                folder
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    </td>
                    <td className={cn(cellClass, 'whitespace-nowrap')}>
                      <span className="text-[11px] font-medium text-foreground">Folder</span>
                    </td>
                    <td className={cn(cellClass, 'whitespace-nowrap')}>
                      <div className="flex min-w-0 items-center gap-2">
                        <ProjectWorkItemPersonAvatar name={folderOwnerLabel} />
                        <span className="truncate font-semibold text-foreground">{folderOwnerLabel}</span>
                      </div>
                    </td>
                    <td className={cn(cellClass, 'whitespace-nowrap text-muted-foreground')}>—</td>
                    <td className={cn(cellClass, 'whitespace-nowrap')}>
                      <span className="inline-flex rounded-full border border-sky-200/70 bg-sky-50/80 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-200">
                        Folder
                      </span>
                    </td>
                    <td className={cellClass}>
                      <span className="text-[11px] text-muted-foreground">—</span>
                    </td>
                    <td className={cn(cellClass, 'whitespace-nowrap')}>
                      <div className="font-semibold text-foreground">{updatedLabel}</div>
                    </td>
                    <td className={cn(cellClass, 'whitespace-nowrap text-muted-foreground')}>—</td>
                  </tr>
                )
              }

              const item = row.item
              const generated = isKbGenerated(item)
              const progress = generated ? 100 : 0
              const selected = selectedIds.includes(item.id)
              const documentOwnerLabel = resolveOwnerDisplayName(item.owner)

              return (
                <tr
                  key={item.id}
                  className={cn(
                    'group transition-colors',
                    onDocumentClick && 'cursor-pointer hover:bg-accent/10',
                    showSelection && selected && 'bg-primary/5',
                  )}
                  onDoubleClick={onDocumentClick ? () => onDocumentClick(item) : undefined}
                  onContextMenu={
                    onRowContextMenu
                      ? (event) => {
                          event.preventDefault()
                          onRowContextMenu(event, item)
                        }
                      : undefined
                  }
                >
                  {showSelection ? (
                    <td className={selectCellClass}>
                      <button
                        type="button"
                        aria-label={selected ? `Deselect ${item.name}` : `Select ${item.name}`}
                        className="inline-flex text-muted-foreground hover:text-foreground"
                        onClick={() => onToggleRow?.(item.id)}
                      >
                        {selected ? (
                          <CheckSquare2 className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                  ) : null}
                  <td className={cn(titleCellClass, showSelection && selected && 'bg-primary/10')}>
                    {onDocumentClick ? (
                      <button
                        type="button"
                        className={titleButtonClass}
                        title={`Open ${item.name}`}
                        onClick={() => onDocumentClick(item)}
                      >
                        <div className="flex min-w-0 items-start gap-3 overflow-hidden">
                          <FileTypeIconImg fileName={item.fileName || item.name} />
                          <div className={titleContentClass}>
                            <div className={cn(titleTextClass, 'text-primary hover:underline')}>{item.name}</div>
                            <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{item.id}</div>
                            {item.tags.length > 0 ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {item.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="rounded-full border border-border/60 bg-muted/30 px-2 py-0 text-[10px] font-medium text-muted-foreground"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    ) : (
                      <div className="flex min-w-0 items-start gap-3 overflow-hidden">
                        <FileTypeIconImg fileName={item.fileName || item.name} />
                        <div className={titleContentClass}>
                          <div className={cn(titleTextClass, 'text-foreground')}>{item.name}</div>
                          <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{item.id}</div>
                          {item.tags.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full border border-border/60 bg-muted/30 px-2 py-0 text-[10px] font-medium text-muted-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className={cn(cellClass, showSelection && selected && 'bg-primary/10', 'whitespace-nowrap')}>
                    <span className="text-[11px] font-medium text-foreground">{item.type}</span>
                  </td>
                  <td className={cn(cellClass, showSelection && selected && 'bg-primary/10', 'whitespace-nowrap')}>
                    <div className="flex min-w-0 items-center gap-2">
                      <ProjectWorkItemPersonAvatar name={documentOwnerLabel} />
                      <span className="truncate font-semibold text-foreground">{documentOwnerLabel}</span>
                    </div>
                  </td>
                  <td className={cn(cellClass, showSelection && selected && 'bg-primary/10', 'whitespace-nowrap font-semibold text-foreground')}>
                    {item.version}
                  </td>
                  <td className={cn(cellClass, showSelection && selected && 'bg-primary/10', 'whitespace-nowrap')}>
                    <span
                      className={cn(
                        'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium',
                        statusBadgeClass(item.status),
                      )}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className={cn(cellClass, showSelection && selected && 'bg-primary/10')}>
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
                  </td>
                  <td className={cn(cellClass, showSelection && selected && 'bg-primary/10', 'whitespace-nowrap')}>
                    <div className="font-semibold text-foreground">{item.updated}</div>
                  </td>
                  <td className={cn(cellClass, showSelection && selected && 'bg-primary/10', 'whitespace-nowrap')}>
                    <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-foreground">
                      {item.accessScope}
                    </span>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
