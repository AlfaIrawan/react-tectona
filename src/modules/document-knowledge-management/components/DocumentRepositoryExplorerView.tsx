import { useMemo, useState, type DragEvent, type MouseEvent, type ReactNode } from 'react'
import {
  ArrowUpDown,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  Folder,
  FolderOpen,
  GripVertical,
  HardDrive,
  Layers3,
  Upload,
} from 'lucide-react'
import { EnterpriseColumnFilterDropdown } from '@/components/enterprise/EnterpriseColumnFilterDropdown'
import { getEnterpriseGroupTint } from '@/components/enterprise/enterpriseTableGroupTint'
import { cn } from '@/lib/utils'
import type { DocumentFolder } from '@/lib/api/documentFolderApi'
import {
  PROJECT_LIST_FIRST_COLUMN_TINT_BODY_CLASS,
  PROJECT_LIST_FIRST_COLUMN_TINT_HEADER_CLASS,
} from '@/modules/projects/lib/projectListTableClasses'
import {
  EXPLORER_FOLDER_TYPE_LABEL,
  formatExplorerDateTime,
  getExplorerFileTypeLabel,
  getFileTypeIcon,
} from '../fileTypeIcon'

export type RepositoryExplorerDocument = {
  id: string
  name: string
  fileName: string
  updatedAt: string
  fileSize?: number | null
}

type ExplorerSortKey = 'name' | 'dateModified' | 'type' | 'size'
type ExplorerSortDir = 'asc' | 'desc'

type DocumentRepositoryExplorerViewProps = {
  folders: DocumentFolder[]
  documents: RepositoryExplorerDocument[]
  selectedDocumentId: string | null
  dropTargetFolderId: string | null
  onOpenFolder: (folderId: string) => void
  onOpenDocument: (documentId: string) => void
  onFolderContextMenu: (event: MouseEvent, folder: DocumentFolder) => void
  onDocumentContextMenu: (event: MouseEvent, documentId: string) => void
  onFolderDragOver: (event: DragEvent, folderId: string) => void
  onFolderDragLeave: (folderId: string) => void
  onFolderDrop: (event: DragEvent, folderId: string) => void
  groupByType?: boolean
  showSelection?: boolean
  selectedIds?: string[]
  onToggleRowSelection?: (documentId: string) => void
  onToggleAllVisible?: (documentIds: string[]) => void
}

type ExplorerRow =
  | { kind: 'folder'; id: string; folder: DocumentFolder }
  | { kind: 'document'; id: string; document: RepositoryExplorerDocument; typeLabel: string }

const HEADER_CELL_CLASS =
  'select-none border-b-[3px] border-double border-slate-300/90 px-3 py-2 text-left font-semibold backdrop-blur dark:border-slate-600/80'
const BODY_CELL_CLASS =
  'border-b border-slate-200/20 px-3 py-2 align-middle transition-colors dark:border-slate-700/20'

function FileTypeIconImg({ fileName }: { fileName: string }) {
  return (
    <img
      src={getFileTypeIcon(fileName)}
      alt=""
      className="h-4 w-4 shrink-0 object-contain object-center"
      draggable={false}
      aria-hidden
    />
  )
}

function formatExplorerSize(bytes?: number | null) {
  if (bytes == null || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  const mb = kb / 1024
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
}

function compareText(left: string, right: string, dir: ExplorerSortDir) {
  const result = left.localeCompare(right, undefined, { sensitivity: 'base' })
  return dir === 'asc' ? result : -result
}

function rowName(row: ExplorerRow) {
  return row.kind === 'folder' ? row.folder.name : row.document.fileName || row.document.name
}

function rowDate(row: ExplorerRow) {
  return row.kind === 'folder'
    ? row.folder.updated_date || row.folder.created_date || ''
    : row.document.updatedAt || ''
}

function rowType(row: ExplorerRow) {
  return row.kind === 'folder' ? EXPLORER_FOLDER_TYPE_LABEL : row.typeLabel
}

function rowSize(row: ExplorerRow) {
  return row.kind === 'folder' ? -1 : row.document.fileSize ?? 0
}

function sortRows(rows: ExplorerRow[], sortKey: ExplorerSortKey, sortDir: ExplorerSortDir) {
  return [...rows].sort((left, right) => {
    if (sortKey === 'dateModified') {
      const delta = new Date(rowDate(left)).getTime() - new Date(rowDate(right)).getTime()
      const safe = Number.isNaN(delta) ? compareText(rowDate(left), rowDate(right), sortDir) : delta
      return sortDir === 'asc' ? safe : -safe
    }
    if (sortKey === 'size') {
      const delta = rowSize(left) - rowSize(right)
      return sortDir === 'asc' ? delta : -delta
    }
    if (sortKey === 'type') return compareText(rowType(left), rowType(right), sortDir)
    return compareText(rowName(left), rowName(right), sortDir)
  })
}

function toExplorerRows(folders: DocumentFolder[], documents: RepositoryExplorerDocument[]): ExplorerRow[] {
  return [
    ...folders.map((folder) => ({ kind: 'folder' as const, id: folder.id, folder })),
    ...documents.map((document) => ({
      kind: 'document' as const,
      id: document.id,
      document,
      typeLabel: getExplorerFileTypeLabel(document.fileName || document.name),
    })),
  ]
}

function applyTypeFilter(rows: ExplorerRow[], typeFilters: Set<string>) {
  if (typeFilters.size === 0) return rows
  return rows.filter((row) => typeFilters.has(rowType(row)))
}

function defaultExplorerOrder(rows: ExplorerRow[]) {
  const folders = sortRows(
    rows.filter((row) => row.kind === 'folder'),
    'name',
    'asc',
  )
  const files = sortRows(
    rows.filter((row) => row.kind === 'document'),
    'name',
    'asc',
  )
  return [...folders, ...files]
}

function buildExplorerGroups(
  folders: DocumentFolder[],
  documents: RepositoryExplorerDocument[],
  typeFilters: Set<string>,
  sort: { key: ExplorerSortKey; dir: ExplorerSortDir } | null,
  groupByType: boolean,
) {
  const allRows = applyTypeFilter(toExplorerRows(folders, documents), typeFilters)
  if (!groupByType) {
    return [
      {
        label: '',
        rows: sort ? sortRows(allRows, sort.key, sort.dir) : defaultExplorerOrder(allRows),
      },
    ]
  }

  const byType = new Map<string, ExplorerRow[]>()
  for (const row of allRows) {
    const label = rowType(row)
    const rows = byType.get(label) ?? []
    rows.push(row)
    byType.set(label, rows)
  }
  const typeLabels = [...byType.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  const groups = typeLabels.map((label) => ({ label, rows: byType.get(label) ?? [] }))
  const sortedGroups = sort?.key === 'type'
    ? [...groups].sort((a, b) => compareText(a.label, b.label, sort.dir))
    : groups

  return sortedGroups.map((group) => ({
    ...group,
    rows: sort ? sortRows(group.rows, sort.key === 'type' ? 'name' : sort.key, sort.dir) : sortRows(group.rows, 'name', 'asc'),
  }))
}

export function DocumentRepositoryExplorerView({
  folders,
  documents,
  selectedDocumentId,
  dropTargetFolderId,
  onOpenFolder,
  onOpenDocument,
  onFolderContextMenu,
  onDocumentContextMenu,
  onFolderDragOver,
  onFolderDragLeave,
  onFolderDrop,
  groupByType = false,
  showSelection = false,
  selectedIds = [],
  onToggleRowSelection,
  onToggleAllVisible,
}: DocumentRepositoryExplorerViewProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [sort, setSort] = useState<{ key: ExplorerSortKey; dir: ExplorerSortDir } | null>(null)
  const [typeFilters, setTypeFilters] = useState<Set<string>>(() => new Set())

  const typeOptions = useMemo(() => {
    const counts = new Map<string, number>()
    if (folders.length > 0) counts.set(EXPLORER_FOLDER_TYPE_LABEL, folders.length)
    for (const document of documents) {
      const label = getExplorerFileTypeLabel(document.fileName || document.name)
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
      .map(([value, count]) => ({ value, count }))
  }, [folders, documents])

  const groups = useMemo(
    () => buildExplorerGroups(folders, documents, typeFilters, sort, groupByType),
    [folders, documents, typeFilters, sort, groupByType],
  )

  const visibleDocumentIds = useMemo(
    () =>
      groups.flatMap((group) =>
        group.label && collapsed.has(group.label)
          ? []
          : group.rows.filter((row) => row.kind === 'document').map((row) => row.id),
      ),
    [groups, collapsed],
  )

  const toggleGroup = (label: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const toggleSort = (key: ExplorerSortKey) => {
    setSort((current) => {
      if (!current || current.key !== key) return { key, dir: 'asc' }
      if (current.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  const colSpan = 4 + (showSelection ? 1 : 0)
  const isEmpty = folders.length === 0 && documents.length === 0
  const allVisibleSelected =
    visibleDocumentIds.length > 0 && visibleDocumentIds.every((id) => selectedIds.includes(id))

  return (
    <div className="min-h-0 w-full flex-1 overflow-auto rounded-xl scrollbar-hide">
      <table className="w-full min-w-[720px] table-fixed border-collapse select-none text-xs">
        <colgroup>
          {showSelection ? <col className="w-10" /> : null}
          <col className="w-[38%]" />
          <col className="w-[18%]" />
          <col className="w-[28%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr className="text-left text-muted-foreground">
            {showSelection ? (
              <th className={cn(HEADER_CELL_CLASS, 'w-10 bg-white/90 dark:bg-slate-900/90')}>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={() => onToggleAllVisible?.(visibleDocumentIds)}
                  aria-label="Select all visible documents"
                />
              </th>
            ) : null}
            <ExplorerHeaderCell
              label="Name"
              icon={FileText}
              sortKey="name"
              sort={sort}
              onToggleSort={toggleSort}
              firstColumn
            />
            <ExplorerHeaderCell
              label="Date modified"
              icon={CalendarClock}
              sortKey="dateModified"
              sort={sort}
              onToggleSort={toggleSort}
            />
            <ExplorerHeaderCell
              label="Type"
              icon={Layers3}
              sortKey="type"
              sort={sort}
              onToggleSort={toggleSort}
              filterSlot={
                <EnterpriseColumnFilterDropdown
                  label="Type"
                  ariaLabel="Filter type in table"
                  options={typeOptions}
                  selected={typeFilters}
                  onToggleOption={(value) => {
                    setTypeFilters((prev) => {
                      const next = new Set(prev)
                      if (next.has(value)) next.delete(value)
                      else next.add(value)
                      return next
                    })
                  }}
                  onShowAll={() => setTypeFilters(new Set())}
                />
              }
            />
            <ExplorerHeaderCell
              label="Size"
              icon={HardDrive}
              sortKey="size"
              sort={sort}
              onToggleSort={toggleSort}
              alignRight
            />
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const grouped = Boolean(group.label)
            const isCollapsed = grouped && collapsed.has(group.label)
            const groupTint = grouped ? getEnterpriseGroupTint('type', group.label) : null
            return (
              <ExplorerGroup
                key={group.label || 'all'}
                label={group.label}
                rows={group.rows}
                collapsed={isCollapsed}
                colSpan={colSpan}
                groupTint={groupTint}
                showSelection={showSelection}
                selectedIds={selectedIds}
                selectedDocumentId={selectedDocumentId}
                dropTargetFolderId={dropTargetFolderId}
                onToggle={() => toggleGroup(group.label)}
                onOpenFolder={onOpenFolder}
                onOpenDocument={onOpenDocument}
                onToggleRowSelection={onToggleRowSelection}
                onFolderContextMenu={onFolderContextMenu}
                onDocumentContextMenu={onDocumentContextMenu}
                onFolderDragOver={onFolderDragOver}
                onFolderDragLeave={onFolderDragLeave}
                onFolderDrop={onFolderDrop}
              />
            )
          })}
        </tbody>
      </table>
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
          <Upload className="mb-3 h-8 w-8 text-muted-foreground/60" strokeWidth={1.75} />
          <p className="text-sm font-medium text-muted-foreground">Drag and drop documents anywhere in this panel to upload</p>
          <p className="mt-1 text-xs text-muted-foreground/80">Or drop directly onto a folder · Or use Upload document repository above</p>
        </div>
      ) : null}
    </div>
  )
}

function ExplorerHeaderCell({
  label,
  icon: HeaderIcon,
  sortKey,
  sort,
  onToggleSort,
  firstColumn = false,
  alignRight = false,
  filterSlot,
}: {
  label: string
  icon: typeof FileText
  sortKey: ExplorerSortKey
  sort: { key: ExplorerSortKey; dir: ExplorerSortDir } | null
  onToggleSort: (key: ExplorerSortKey) => void
  firstColumn?: boolean
  alignRight?: boolean
  filterSlot?: ReactNode
}) {
  const isSorted = sort?.key === sortKey
  return (
    <th
      className={cn(
        HEADER_CELL_CLASS,
        firstColumn ? PROJECT_LIST_FIRST_COLUMN_TINT_HEADER_CLASS : 'bg-white/90 dark:bg-slate-900/90',
      )}
    >
      <div className={cn('flex items-center gap-1.5', alignRight && 'justify-end')}>
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-400/80" aria-hidden />
        <button
          type="button"
          onClick={() => onToggleSort(sortKey)}
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          title="Sort: ascending → descending → default"
        >
          <HeaderIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" aria-hidden />
          <span>{label}</span>
          {isSorted ? (
            sort?.dir === 'asc' ? (
              <ChevronUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          )}
        </button>
        {filterSlot}
      </div>
    </th>
  )
}

function ExplorerGroup({
  label,
  rows,
  collapsed,
  colSpan,
  groupTint,
  showSelection,
  selectedIds,
  selectedDocumentId,
  dropTargetFolderId,
  onToggle,
  onOpenFolder,
  onOpenDocument,
  onToggleRowSelection,
  onFolderContextMenu,
  onDocumentContextMenu,
  onFolderDragOver,
  onFolderDragLeave,
  onFolderDrop,
}: {
  label: string
  rows: ExplorerRow[]
  collapsed: boolean
  colSpan: number
  groupTint: { row: string; first: string } | null
  showSelection: boolean
  selectedIds: string[]
  selectedDocumentId: string | null
  dropTargetFolderId: string | null
  onToggle: () => void
  onOpenFolder: (folderId: string) => void
  onOpenDocument: (documentId: string) => void
  onToggleRowSelection?: (documentId: string) => void
  onFolderContextMenu: (event: MouseEvent, folder: DocumentFolder) => void
  onDocumentContextMenu: (event: MouseEvent, documentId: string) => void
  onFolderDragOver: (event: DragEvent, folderId: string) => void
  onFolderDragLeave: (folderId: string) => void
  onFolderDrop: (event: DragEvent, folderId: string) => void
}) {
  return (
    <>
      {label ? (
      <tr>
        <td colSpan={colSpan} className={cn('px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground', groupTint?.first)}>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-background/60"
            aria-expanded={!collapsed}
            onClick={onToggle}
          >
            {collapsed ? (
              <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <FolderOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
            <span>Type: {label}</span>
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', !collapsed && 'rotate-90')} aria-hidden />
          </button>
        </td>
      </tr>
      ) : null}
      {collapsed
        ? null
        : rows.map((row) => {
            const tintRow = groupTint?.row
            const tintFirst = groupTint?.first ?? PROJECT_LIST_FIRST_COLUMN_TINT_BODY_CLASS
            if (row.kind === 'folder') {
              const isDropTarget = dropTargetFolderId === row.folder.id
              return (
                <tr
                  key={`folder-${row.id}`}
                  className={cn(
                    'group cursor-pointer transition-colors',
                    isDropTarget ? 'bg-primary/10 ring-1 ring-inset ring-primary/20' : tintRow ?? 'hover:bg-accent/20',
                    !isDropTarget && tintRow && 'hover:brightness-[0.98] dark:hover:brightness-110',
                  )}
                  onDoubleClick={() => onOpenFolder(row.folder.id)}
                  onClick={() => onOpenFolder(row.folder.id)}
                  onContextMenu={(event) => onFolderContextMenu(event, row.folder)}
                  onDragOver={(event) => onFolderDragOver(event, row.folder.id)}
                  onDragLeave={() => onFolderDragLeave(row.folder.id)}
                  onDrop={(event) => onFolderDrop(event, row.folder.id)}
                >
                  {showSelection ? <td className={cn(BODY_CELL_CLASS, tintRow)} /> : null}
                  <td className={cn(BODY_CELL_CLASS, tintFirst)}>
                    <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                      <Folder className="h-4 w-4 shrink-0 fill-amber-400 text-amber-500" aria-hidden />
                      <span className="truncate">{row.folder.name}</span>
                    </span>
                  </td>
                  <td className={cn(BODY_CELL_CLASS, 'whitespace-nowrap text-muted-foreground', tintRow)}>
                    {formatExplorerDateTime(row.folder.updated_date || row.folder.created_date)}
                  </td>
                  <td className={cn(BODY_CELL_CLASS, 'truncate text-muted-foreground', tintRow)}>
                    {EXPLORER_FOLDER_TYPE_LABEL}
                  </td>
                  <td className={cn(BODY_CELL_CLASS, 'text-right text-muted-foreground', tintRow)}>—</td>
                </tr>
              )
            }
            const selected = selectedDocumentId === row.document.id
            const checked = selectedIds.includes(row.document.id)
            return (
              <tr
                key={`doc-${row.id}`}
                className={cn(
                  'group cursor-pointer transition-colors',
                  selected || checked
                    ? 'bg-primary/10 hover:bg-primary/12 ring-1 ring-inset ring-primary/20'
                    : tintRow
                      ? cn(tintRow, 'hover:brightness-[0.98] dark:hover:brightness-110')
                      : 'hover:bg-accent/20',
                )}
                onClick={() => onOpenDocument(row.document.id)}
                onContextMenu={(event) => onDocumentContextMenu(event, row.document.id)}
              >
                {showSelection ? (
                  <td
                    className={cn(BODY_CELL_CLASS, selected || checked ? 'bg-primary/10' : tintRow)}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleRowSelection?.(row.document.id)}
                      aria-label={`Select ${row.document.fileName || row.document.name}`}
                    />
                  </td>
                ) : null}
                <td className={cn(BODY_CELL_CLASS, selected || checked ? 'bg-primary/10' : tintFirst)}>
                  <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                    <FileTypeIconImg fileName={row.document.fileName || row.document.name} />
                    <span className="truncate">{row.document.fileName || row.document.name}</span>
                  </span>
                </td>
                <td className={cn(BODY_CELL_CLASS, 'whitespace-nowrap text-muted-foreground')}>
                  {formatExplorerDateTime(row.document.updatedAt)}
                </td>
                <td className={cn(BODY_CELL_CLASS, 'truncate text-muted-foreground')}>{row.typeLabel}</td>
                <td className={cn(BODY_CELL_CLASS, 'text-right tabular-nums text-muted-foreground')}>
                  {formatExplorerSize(row.document.fileSize)}
                </td>
              </tr>
            )
          })}
    </>
  )
}
