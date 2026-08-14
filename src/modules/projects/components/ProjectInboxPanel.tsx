import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Inbox, Maximize2, Minimize2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { patchWorkItem, acceptProjectInboxItem, declineProjectInboxItem } from '@/lib/api/workApi'
import type { ProjectInboxRouteApiModel, WorkItemApiModel } from '@/lib/api/workApi'
import { cn } from '@/lib/utils'
import { getProjectPanelCatalogEntry } from '../lib/projectPanelCatalog'
import {
  acceptInboxWorkItem,
  declineInboxWorkItem,
  filterPendingInboxWorkItemsByKeys,
  getInboxRouteForItem,
  inboxAgeDays,
} from '../lib/projectInboxWorkItems'
import {
  measureProjectPanelHeight,
  PROJECT_PANEL_MIN_HEIGHT_PX,
} from '../lib/projectPanelLayout'
import type { Project } from '../store/projectStore'
import { ProjectInboxTableView } from './ProjectInboxTableView'
import {
  PROJECT_LIST_PAGE_SIZE_OPTIONS,
  ProjectWorkItemTablePaginationToolbar,
  type ProjectWorkItemTableRowsMeta,
} from './projectWorkItemTableShared'

const listToolbarFocusClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30 focus-visible:ring-offset-0'

const EMPTY_ROWS_META: ProjectWorkItemTableRowsMeta = {
  total: 0,
  pageStart: 0,
  pageEnd: 0,
  pageSafe: 1,
  totalPages: 1,
}

export function ProjectInboxPanel({
  project,
  workItems,
  loading,
  inboxRoutes,
  pendingInboxKeys,
  onOverlayChange,
  usesOverlayApi,
  usesApiItems,
  onWorkItemsChange,
  ownerName,
}: {
  project: Project
  workItems: WorkItemApiModel[]
  loading: boolean
  inboxRoutes: ProjectInboxRouteApiModel[]
  pendingInboxKeys: Set<string>
  onOverlayChange: () => void
  usesOverlayApi: boolean
  usesApiItems: boolean
  onWorkItemsChange?: () => void
  ownerName: string
}) {
  const { addToast } = useToast()
  const panelMeta = getProjectPanelCatalogEntry('inbox')
  const PanelIcon = panelMeta.icon
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelHeightPx, setPanelHeightPx] = useState<number | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PROJECT_LIST_PAGE_SIZE_OPTIONS)[number]>(25)
  const [rowsMeta, setRowsMeta] = useState<ProjectWorkItemTableRowsMeta>(EMPTY_ROWS_META)

  const pendingItems = useMemo(
    () => filterPendingInboxWorkItemsByKeys(workItems, pendingInboxKeys),
    [pendingInboxKeys, workItems],
  )

  const filteredItems = useMemo(() => {
    if (!deferredSearch) return pendingItems
    return pendingItems.filter((item) => {
      const meta = getInboxRouteForItem(inboxRoutes, item.id)
      const haystack = [
        item.title,
        item.id,
        item.type,
        item.priority,
        meta?.sourceTeam,
        meta?.routedBy,
        meta?.requestNote,
        meta?.sourceChannel,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(deferredSearch)
    })
  }, [deferredSearch, inboxRoutes, pendingItems])

  const pendingCount = pendingInboxKeys.size

  const staleCount = useMemo(
    () =>
      pendingItems.filter((item) => {
        const meta = getInboxRouteForItem(inboxRoutes, item.id)
        return inboxAgeDays(meta?.routedAt) >= 5
      }).length,
    [inboxRoutes, pendingItems],
  )

  useEffect(() => {
    setPage(1)
  }, [deferredSearch, project.id])

  useEffect(() => {
    if (loading || filteredItems.length === 0) {
      setRowsMeta(EMPTY_ROWS_META)
    }
  }, [filteredItems.length, loading])

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

    const updateHeight = () => setPanelHeightPx(measureProjectPanelHeight(panelEl))
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

  const handleAccept = async (item: WorkItemApiModel) => {
    try {
      if (usesOverlayApi) {
        await acceptProjectInboxItem(project.id, item.id)
      } else {
        acceptInboxWorkItem(project.id, item.id)
      }
      if (usesApiItems && (item.status === 'Backlog' || item.status === 'Blocked')) {
        await patchWorkItem(item.id, { status: 'To Do' })
        onWorkItemsChange?.()
      }
      onOverlayChange()
      addToast({
        title: 'Request accepted',
        description: `"${item.title}" is now in active delivery views.`,
        variant: 'success',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to accept inbox item'
      addToast({ title: 'Accept failed', description: message, variant: 'error' })
    }
  }

  const handleDecline = async (item: WorkItemApiModel) => {
    try {
      const declinedBy = ownerName || project.ownerName || 'system'
      if (usesOverlayApi) {
        await declineProjectInboxItem(project.id, item.id, declinedBy)
      } else {
        declineInboxWorkItem({
          projectId: project.id,
          workItemId: item.id,
          declinedBy,
        })
      }
      onOverlayChange()
      addToast({
        title: 'Request declined',
        description: `"${item.title}" was moved to Archived.`,
        variant: 'success',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to decline inbox item'
      addToast({ title: 'Decline failed', description: message, variant: 'error' })
    }
  }

  const panel = (
    <div
      ref={panelRef}
      id="panel-inbox"
      style={
        isFullscreen
          ? { height: 'calc(100dvh - 3rem)', maxHeight: 'calc(100dvh - 3rem)' }
          : panelHeightPx != null
            ? { height: panelHeightPx, maxHeight: panelHeightPx, minHeight: PROJECT_PANEL_MIN_HEIGHT_PX }
            : undefined
      }
      className={cn(
        'scroll-mt-24 glass-card flex min-h-0 flex-col overflow-hidden border border-border/40',
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
                <PanelIcon className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                <h2 className="text-lg font-semibold text-foreground">Project {panelMeta.label}</h2>
              </div>
              <button
                type="button"
                aria-pressed={isFullscreen}
                aria-label={isFullscreen ? 'Exit inbox fullscreen' : 'Expand inbox to fullscreen'}
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

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <p className="max-w-2xl flex-1 text-[11px] leading-snug text-muted-foreground">
                {panelMeta.description}
              </p>

              {pendingCount > 0 ? (
                <div className="flex shrink-0 flex-wrap gap-2 sm:ml-4">
                  <span className="inline-flex items-center rounded-full border border-border/50 bg-muted/20 px-2.5 py-1 text-[11px] font-medium text-foreground">
                    {pendingCount} pending
                  </span>
                  {staleCount > 0 ? (
                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                      {staleCount} waiting 5d+
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search request, source, channel…"
                  className="h-9 pl-8 text-sm"
                  aria-label="Search inbox requests"
                />
              </div>

              <ProjectWorkItemTablePaginationToolbar
                rowsMeta={rowsMeta}
                pageSize={pageSize}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setPage(1)
                }}
                onPrevPage={() => setPage((prev) => Math.max(1, prev - 1))}
                onNextPage={() => setPage((prev) => Math.min(rowsMeta.totalPages, prev + 1))}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-16 text-sm text-muted-foreground">
              Loading inbox…
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/50 px-6 py-10 text-center">
              {panelMeta.illustrationSrc ? (
                <img
                  src={panelMeta.illustrationSrc}
                  alt=""
                  className="h-auto w-full max-w-[14rem] object-contain opacity-90"
                />
              ) : (
                <Inbox className="h-10 w-10 text-muted-foreground/70" strokeWidth={1.5} aria-hidden />
              )}
              <div className="max-w-md space-y-1">
                <h3 className="text-base font-semibold text-foreground">
                  {pendingItems.length === 0 ? 'Inbox is clear' : 'No matches for your search'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {pendingItems.length === 0
                    ? 'Incoming requests from partner teams will appear here for triage before they enter active delivery.'
                    : 'Try a different keyword or clear the search field.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
              <ProjectInboxTableView
                inboxRoutes={inboxRoutes}
                items={filteredItems}
                onAccept={(item) => void handleAccept(item)}
                onDecline={(item) => void handleDecline(item)}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onRowsMetaChange={setRowsMeta}
              />
            </div>
          )}
        </div>
      </div>
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
