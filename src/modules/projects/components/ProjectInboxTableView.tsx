import { useEffect, useMemo, useState } from 'react'
import {
  Building2,
  CalendarClock,
  Check,
  Layers3,
  ListChecks,
  Radio,
  Signal,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ProjectInboxRouteApiModel, WorkItemApiModel } from '@/lib/api/workApi'
import { WorkItemTypeIcon } from '@/lib/work/workItemTypeMeta'
import { cn } from '@/lib/utils'
import {
  formatInboxDate,
  getInboxRouteForItem,
  INBOX_CHANNEL_LABELS,
  inboxAgeDays,
} from '../lib/projectInboxWorkItems'
import {
  PROJECT_LIST_FIRST_COLUMN_TINT_BODY_CLASS,
  PROJECT_LIST_TABLE_BODY_CELL_CLASS,
  PROJECT_LIST_TABLE_SCROLL_CLASS,
  PROJECT_LIST_PAGE_SIZE_OPTIONS,
  ProjectWorkItemPriorityBadge,
  ProjectWorkItemTableHeaderCell,
  type ProjectWorkItemTableRowsMeta,
} from './projectWorkItemTableShared'

type InboxSortKey = 'title' | 'type' | 'source' | 'channel' | 'priority' | 'received'

type InboxTableRow = {
  item: WorkItemApiModel
  meta: ProjectInboxRouteApiModel
}

function sortRows(rows: InboxTableRow[], sortKey: InboxSortKey, direction: 'asc' | 'desc'): InboxTableRow[] {
  const sorted = [...rows]
  const priorityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 } as const

  sorted.sort((left, right) => {
    let compareValue = 0
    if (sortKey === 'priority') {
      compareValue = priorityOrder[left.item.priority] - priorityOrder[right.item.priority]
    } else if (sortKey === 'received') {
      compareValue = left.meta.routedAt.localeCompare(right.meta.routedAt)
    } else if (sortKey === 'title') {
      compareValue = left.item.title.localeCompare(right.item.title)
    } else if (sortKey === 'type') {
      compareValue = left.item.type.localeCompare(right.item.type)
    } else if (sortKey === 'source') {
      compareValue = left.meta.sourceTeam.localeCompare(right.meta.sourceTeam)
    } else if (sortKey === 'channel') {
      compareValue = left.meta.sourceChannel.localeCompare(right.meta.sourceChannel)
    }
    if (compareValue === 0) compareValue = left.item.id.localeCompare(right.item.id)
    return direction === 'asc' ? compareValue : -compareValue
  })
  return sorted
}

type ProjectInboxTableViewProps = {
  inboxRoutes: ProjectInboxRouteApiModel[]
  items: WorkItemApiModel[]
  onAccept: (item: WorkItemApiModel) => void
  onDecline: (item: WorkItemApiModel) => void
  page: number
  pageSize: (typeof PROJECT_LIST_PAGE_SIZE_OPTIONS)[number]
  onPageChange: (page: number) => void
  onRowsMetaChange?: (meta: ProjectWorkItemTableRowsMeta) => void
}

export function ProjectInboxTableView({
  inboxRoutes,
  items,
  onAccept,
  onDecline,
  page,
  pageSize,
  onPageChange,
  onRowsMetaChange,
}: ProjectInboxTableViewProps) {
  const [sortKey, setSortKey] = useState<InboxSortKey>('received')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const rows = useMemo(
    () =>
      items
        .map((item) => {
          const meta = getInboxRouteForItem(inboxRoutes, item.id)
          if (!meta || meta.status !== 'pending') return null
          return { item, meta }
        })
        .filter((row): row is InboxTableRow => row != null),
    [inboxRoutes, items],
  )

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

  const handleSort = (key: InboxSortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDirection(key === 'received' ? 'desc' : 'asc')
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
          <col className="w-[28%]" />
          <col className="w-[8%]" />
          <col className="w-[14%]" />
          <col className="w-[9%]" />
          <col className="w-[9%]" />
          <col className="w-[12%]" />
          <col className="w-[20%]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
          <tr className="text-left text-muted-foreground">
            <ProjectWorkItemTableHeaderCell
              columnKey="title"
              pinnedFirstKey="title"
              label="Request"
              icon={ListChecks}
              sortKey="title"
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
              pinnedFirstKey="title"
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
              columnKey="source"
              pinnedFirstKey="title"
              label="Source"
              icon={Building2}
              sortKey="source"
              activeSortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
              isLastColumn={false}
              columnResizingKey={null}
              onBeginResize={() => {}}
              draggable={false}
            />
            <ProjectWorkItemTableHeaderCell
              columnKey="channel"
              pinnedFirstKey="title"
              label="Channel"
              icon={Radio}
              sortKey="channel"
              activeSortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
              isLastColumn={false}
              columnResizingKey={null}
              onBeginResize={() => {}}
              draggable={false}
            />
            <ProjectWorkItemTableHeaderCell
              columnKey="priority"
              pinnedFirstKey="title"
              label="Priority"
              icon={Signal}
              sortKey="priority"
              activeSortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
              isLastColumn={false}
              columnResizingKey={null}
              onBeginResize={() => {}}
              draggable={false}
            />
            <ProjectWorkItemTableHeaderCell
              columnKey="received"
              pinnedFirstKey="title"
              label="Received"
              icon={CalendarClock}
              sortKey="received"
              activeSortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
              isLastColumn={false}
              columnResizingKey={null}
              onBeginResize={() => {}}
              draggable={false}
            />
            <th className="border-b border-border/50 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide" />
          </tr>
        </thead>
        <tbody>
          {pagedRows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-6 py-16 text-center text-sm text-muted-foreground">
                No inbox items match the current filters.
              </td>
            </tr>
          ) : (
            pagedRows.map(({ item, meta }) => {
              const ageDays = inboxAgeDays(meta.routedAt)
              const isStale = ageDays >= 5

              return (
                <tr key={item.id} className="group transition-colors">
                  <td className={titleCellClass}>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-foreground">{item.title}</div>
                      <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{item.id}</div>
                      {meta.requestNote ? (
                        <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                          {meta.requestNote}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className={cn(cellClass, 'whitespace-nowrap')}>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                      <WorkItemTypeIcon type={item.type} className="h-3.5 w-3.5" />
                      {item.type}
                    </span>
                  </td>
                  <td className={cn(cellClass, 'whitespace-nowrap')}>
                    <div className="truncate font-semibold text-foreground">{meta.sourceTeam}</div>
                    <div className="truncate text-[11px] text-muted-foreground">by {meta.routedBy}</div>
                  </td>
                  <td className={cn(cellClass, 'whitespace-nowrap')}>
                    <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] font-medium">
                      {INBOX_CHANNEL_LABELS[meta.sourceChannel]}
                    </span>
                  </td>
                  <td className={cn(cellClass, 'whitespace-nowrap')}>
                    <ProjectWorkItemPriorityBadge priority={item.priority} />
                  </td>
                  <td className={cn(cellClass, 'whitespace-nowrap')}>
                    <div className="space-y-0.5">
                      <div className="font-semibold text-foreground">{formatInboxDate(meta.routedAt)}</div>
                      <div className={cn('text-[11px]', isStale ? 'font-medium text-amber-600' : 'text-muted-foreground')}>
                        {ageDays === 0 ? 'Today' : `${ageDays}d waiting`}
                      </div>
                    </div>
                  </td>
                  <td className={cn(cellClass, 'whitespace-nowrap text-right')}>
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                        onClick={() => onAccept(item)}
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden />
                        Accept
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1"
                        onClick={() => onDecline(item)}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                        Decline
                      </Button>
                    </div>
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
