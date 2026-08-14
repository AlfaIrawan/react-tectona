import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, FileText, Layers3, RotateCcw, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getFileTypeIcon } from '@/modules/document-knowledge-management/fileTypeIcon'
import { statusBadgeClass } from '@/modules/document-knowledge-management/lib/documentRepositoryPresentation'
import { cn } from '@/lib/utils'
import type { ArchivedDocumentRow } from '../lib/projectArchivedDocuments'
import { formatArchivedDate } from '../lib/projectArchivedDocuments'
import {
  PROJECT_LIST_FIRST_COLUMN_TINT_BODY_CLASS,
  PROJECT_LIST_TABLE_BODY_CELL_CLASS,
  PROJECT_LIST_TABLE_SCROLL_CLASS,
  PROJECT_LIST_PAGE_SIZE_OPTIONS,
  ProjectWorkItemPersonAvatar,
  type ProjectWorkItemTableRowsMeta,
} from './projectWorkItemTableShared'

type DocSortKey = 'name' | 'type' | 'owner' | 'status' | 'archived'

function FileTypeIconImg({ fileName }: { fileName: string }) {
  return (
    <img
      src={getFileTypeIcon(fileName)}
      alt=""
      className="h-4 w-4 shrink-0 object-contain"
      loading="lazy"
      draggable={false}
    />
  )
}

function sortRows(rows: ArchivedDocumentRow[], sortKey: DocSortKey, direction: 'asc' | 'desc'): ArchivedDocumentRow[] {
  const sorted = [...rows]
  sorted.sort((left, right) => {
    const leftSnap = left.snapshot
    const rightSnap = right.snapshot
    let compareValue = 0
    if (sortKey === 'name') {
      compareValue = leftSnap.name.localeCompare(rightSnap.name)
    } else if (sortKey === 'type') {
      compareValue = leftSnap.type.localeCompare(rightSnap.type)
    } else if (sortKey === 'owner') {
      compareValue = leftSnap.owner.localeCompare(rightSnap.owner)
    } else if (sortKey === 'status') {
      compareValue = leftSnap.status.localeCompare(rightSnap.status)
    } else if (sortKey === 'archived') {
      compareValue = left.meta.archivedAt.localeCompare(right.meta.archivedAt)
    }
    if (compareValue === 0) compareValue = leftSnap.id.localeCompare(rightSnap.id)
    return direction === 'asc' ? compareValue : -compareValue
  })
  return sorted
}

type ProjectArchivedDocumentsTableViewProps = {
  rows: ArchivedDocumentRow[]
  onRestore: (row: ArchivedDocumentRow) => void
  page: number
  pageSize: (typeof PROJECT_LIST_PAGE_SIZE_OPTIONS)[number]
  onPageChange: (page: number) => void
  onRowsMetaChange?: (meta: ProjectWorkItemTableRowsMeta) => void
}

const HEADERS: Array<{ key: DocSortKey | 'action'; label: string; icon: typeof FileText; sortable?: boolean }> = [
  { key: 'name', label: 'Document', icon: FileText },
  { key: 'type', label: 'Type', icon: Layers3 },
  { key: 'owner', label: 'Owner', icon: UserRound },
  { key: 'status', label: 'Status', icon: FileText },
  { key: 'archived', label: 'Archived', icon: CalendarClock },
  { key: 'action', label: '', icon: RotateCcw, sortable: false },
]

export function ProjectArchivedDocumentsTableView({
  rows,
  onRestore,
  page,
  pageSize,
  onPageChange,
  onRowsMetaChange,
}: ProjectArchivedDocumentsTableViewProps) {
  const [sortKey, setSortKey] = useState<DocSortKey>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const sortedRows = useMemo(() => sortRows(rows, sortKey, sortDirection), [rows, sortDirection, sortKey])

  const total = sortedRows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pageSafe = Math.min(Math.max(1, page), totalPages)
  const pageStart = total === 0 ? 0 : (pageSafe - 1) * pageSize + 1
  const pageEnd = Math.min(pageSafe * pageSize, total)
  const pagedRows = sortedRows.slice((pageSafe - 1) * pageSize, pageSafe * pageSize)

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
  }, [onRowsMetaChange, pageEnd, pageSafe, pageStart, total, totalPages])

  const handleSort = (key: DocSortKey) => {
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
    'group-hover:bg-accent/20',
  )

  return (
    <div className={PROJECT_LIST_TABLE_SCROLL_CLASS}>
      <table className="w-full table-fixed border-collapse text-xs select-none">
        <colgroup>
          <col className="w-[32%]" />
          <col className="w-[10%]" />
          <col className="w-[16%]" />
          <col className="w-[12%]" />
          <col className="w-[14%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
          <tr className="text-left text-muted-foreground">
            {HEADERS.map((header) => {
              const isAction = header.key === 'action'
              const isActiveSort = !isAction && sortKey === header.key
              return (
                <th
                  key={header.key}
                  className={cn(
                    'border-b border-border/50 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide',
                    isAction && 'text-right',
                  )}
                >
                  {isAction || header.sortable === false ? (
                    header.label ? <span>{header.label}</span> : null
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 hover:text-foreground"
                      onClick={() => handleSort(header.key as DocSortKey)}
                    >
                      <header.icon className="h-3.5 w-3.5" aria-hidden />
                      {header.label}
                      {isActiveSort ? (
                        <span className="text-[10px] font-normal normal-case">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      ) : null}
                    </button>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {pagedRows.length === 0 ? (
            <tr>
              <td colSpan={HEADERS.length} className="px-6 py-16 text-center text-sm text-muted-foreground">
                No archived documents match the current filters.
              </td>
            </tr>
          ) : (
            pagedRows.map((row) => {
              const { snapshot, meta } = row
              return (
                <tr key={snapshot.id} className="group transition-colors">
                  <td className={titleCellClass}>
                    <div className="flex min-w-0 items-start gap-2">
                      <FileTypeIconImg fileName={snapshot.fileName || snapshot.name} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-foreground">{snapshot.name}</div>
                        <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{snapshot.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className={cn(cellClass, 'whitespace-nowrap')}>
                    <span className="text-[11px] font-medium text-foreground">{snapshot.type}</span>
                  </td>
                  <td className={cn(cellClass, 'whitespace-nowrap')}>
                    <div className="flex min-w-0 items-center gap-2">
                      <ProjectWorkItemPersonAvatar name={snapshot.owner} />
                      <span className="truncate font-semibold text-foreground">{snapshot.owner}</span>
                    </div>
                  </td>
                  <td className={cn(cellClass, 'whitespace-nowrap')}>
                    <span
                      className={cn(
                        'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium',
                        statusBadgeClass(snapshot.status),
                      )}
                    >
                      {snapshot.status}
                    </span>
                  </td>
                  <td className={cn(cellClass, 'whitespace-nowrap')}>
                    <div className="space-y-0.5">
                      <div className="font-semibold text-foreground">{formatArchivedDate(meta.archivedAt)}</div>
                      <div className="text-[11px] text-muted-foreground">by {meta.archivedBy}</div>
                    </div>
                  </td>
                  <td className={cn(cellClass, 'whitespace-nowrap text-right')}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => onRestore(row)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                      Restore
                    </Button>
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
