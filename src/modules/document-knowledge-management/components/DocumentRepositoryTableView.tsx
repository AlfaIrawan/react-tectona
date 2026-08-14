import type { MouseEvent } from 'react'
import {
  BarChart3,
  FileText,
  Layers3,
  ListChecks,
  Loader2,
  Shield,
  Tag,
  Users,
  Workflow,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
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
  { key: 'document', label: 'Document', icon: FileText, colClass: 'w-[26%]', isFirst: true },
  { key: 'type', label: 'Type', icon: Layers3, colClass: 'w-[7%]' },
  { key: 'capability', label: 'Capability', icon: Tag, colClass: 'w-[9%]' },
  { key: 'linked', label: 'Linked project / task', icon: ListChecks, colClass: 'w-[14%]' },
  { key: 'owner', label: 'Owner', icon: Users, colClass: 'w-[11%]' },
  { key: 'version', label: 'Version', icon: FileText, colClass: 'w-[7%]' },
  { key: 'status', label: 'Status', icon: Workflow, colClass: 'w-[9%]' },
  { key: 'kb', label: 'KB progress', icon: BarChart3, colClass: 'w-[10%]' },
  { key: 'access', label: 'Access', icon: Shield, colClass: 'w-[7%]' },
] as const

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
  /** When provided, the KB progress cell reflects real generated status instead of the static "Not Generated" placeholder. */
  isKbGenerated?: (item: RepositoryItem) => boolean
  /** When provided, right-clicking a row calls this instead of showing the browser's context menu. */
  onRowContextMenu?: (event: MouseEvent<HTMLTableRowElement>, item: RepositoryItem) => void
  /** `project-list` matches Project Detail → List table styling. */
  variant?: 'repository' | 'project-list'
}

export function DocumentRepositoryTableView({
  items,
  showKbProgressColumn = true,
  loading = false,
  emptyMessage = 'No documents in this folder.',
  onDocumentClick,
  isKbGenerated,
  onRowContextMenu,
  variant = 'repository',
}: DocumentRepositoryTableViewProps) {
  const isProjectListVariant = variant === 'project-list'
  const visibleHeaders = PROJECT_LIST_DOCS_HEADERS.filter(
    (header) => header.key !== 'kb' || showKbProgressColumn,
  )
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
      className={cn(
        'w-full text-xs select-none',
        isProjectListVariant && 'table-fixed border-collapse',
      )}
    >
      {isProjectListVariant ? (
        <colgroup>
          {visibleHeaders.map((header) => (
            <col key={header.key} className={header.colClass} />
          ))}
        </colgroup>
      ) : null}
      <thead className={cn('sticky top-0 z-10', !isProjectListVariant && 'border-b border-border/40 bg-white/90 backdrop-blur dark:bg-slate-900/90')}>
        <tr className="text-left text-muted-foreground">
          {isProjectListVariant
            ? visibleHeaders.map((header) => {
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
              })
            : (
              <>
                <th className="px-3 py-2 text-left font-semibold">Document</th>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-left font-semibold">Capability</th>
                <th className="px-3 py-2 text-left font-semibold">Linked project / task</th>
                <th className="px-3 py-2 text-left font-semibold">Owner</th>
                <th className="px-3 py-2 text-left font-semibold">Version</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                {showKbProgressColumn ? <th className="px-3 py-2 text-left font-semibold">KB progress</th> : null}
                <th className="px-3 py-2 text-left font-semibold">Access</th>
              </>
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
        ) : items.length === 0 ? (
          <tr>
            <td
              colSpan={isProjectListVariant ? visibleHeaders.length : showKbProgressColumn ? 9 : 8}
              className="px-6 py-16 text-center text-sm text-muted-foreground"
            >
              {emptyMessage}
            </td>
          </tr>
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
                      <DocumentCellContent item={item} compact={isProjectListVariant} />
                    </button>
                  ) : (
                    <DocumentCellContent item={item} compact={isProjectListVariant} />
                  )}
                </td>
                <td
                  className={cn(
                    isProjectListVariant ? cn(cellClass, 'whitespace-nowrap text-foreground') : 'px-3 py-2 align-top text-foreground',
                  )}
                >
                  {item.type}
                </td>
                <td className={isProjectListVariant ? cn(cellClass, 'text-foreground') : 'px-3 py-2 align-top text-foreground'}>
                  {item.capability}
                </td>
                <td className={isProjectListVariant ? cn(cellClass, 'text-foreground') : 'px-3 py-2 align-top text-foreground'}>
                  {item.linkedContext}
                </td>
                <td className={isProjectListVariant ? cn(cellClass, 'whitespace-nowrap text-foreground') : 'px-3 py-2 align-top text-foreground'}>
                  {item.owner}
                </td>
                <td
                  className={cn(
                    isProjectListVariant ? cn(cellClass, 'font-semibold text-foreground') : 'px-3 py-2 align-top font-semibold text-foreground',
                  )}
                >
                  {item.version}
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
                  <td className={isProjectListVariant ? cellClass : 'min-w-[300px] px-3 py-2 align-top'}>
                    {isProjectListVariant ? (
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
                <td className={isProjectListVariant ? cellClass : 'px-3 py-2 align-top'}>
                  <Badge
                    variant="outline"
                    className="rounded-full border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200"
                  >
                    {item.accessScope}
                  </Badge>
                </td>
              </tr>
            )
          })
        )}
      </tbody>
    </table>
  )

  if (isProjectListVariant) {
    return table
  }

  return (
    <div className="min-h-0 w-full flex-1 overflow-auto rounded-xl border-2 border-border/30 scrollbar-hide">
      {table}
    </div>
  )
}

function DocumentCellContent({ item, compact = false }: { item: RepositoryItem; compact?: boolean }) {
  return (
    <div className={cn('flex items-start', compact ? 'gap-2' : 'gap-3')}>
      <FileTypeIconImg fileName={item.fileName || item.name} compact={compact} />
      <div className="min-w-0">
        <p
          className={cn(
            'line-clamp-2 font-semibold text-foreground',
            compact ? 'text-xs leading-snug' : 'text-sm text-slate-900',
          )}
        >
          {item.name}
        </p>
        {item.tags.length > 0 ? (
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
