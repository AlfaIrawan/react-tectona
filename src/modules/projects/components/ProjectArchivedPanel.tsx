import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Archive, ArrowUpRight, FileText, ListChecks, Maximize2, Minimize2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import type { ProjectArchivedWorkItemApiModel, WorkItemApiModel } from '@/lib/api/workApi'
import { restoreProjectArchivedWorkItem } from '@/lib/api/workApi'
import { cn } from '@/lib/utils'
import { getProjectPanelCatalogEntry } from '../lib/projectPanelCatalog'
import {
  filterArchivedWorkItemsByKeys,
  getArchivedWorkItemRecordFromApi,
  restoreArchivedWorkItem,
} from '../lib/projectArchivedWorkItems'
import {
  listArchivedDocumentRows,
  restoreArchivedDocument,
  type ArchivedDocumentRow,
} from '../lib/projectArchivedDocuments'
import {
  measureProjectPanelHeight,
  PROJECT_PANEL_MIN_HEIGHT_PX,
} from '../lib/projectPanelLayout'
import type { Project } from '../store/projectStore'
import { ProjectArchivedDocumentsTableView } from './ProjectArchivedDocumentsTableView'
import { ProjectArchivedTableView } from './ProjectArchivedTableView'
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

export type ProjectArchivedTab = 'work-items' | 'documents'

export function ProjectArchivedPanel({
  project,
  workItems,
  loading,
  archivedWorkItems,
  archivedWorkItemKeys,
  overlayRevision,
  onOverlayChange,
  usesOverlayApi,
  onNavigateList,
  preferredTab = 'work-items',
}: {
  project: Project
  workItems: WorkItemApiModel[]
  loading: boolean
  archivedWorkItems: ProjectArchivedWorkItemApiModel[]
  archivedWorkItemKeys: Set<string>
  overlayRevision: number
  onOverlayChange: () => void
  usesOverlayApi: boolean
  onNavigateList?: () => void
  preferredTab?: ProjectArchivedTab
}) {
  const { addToast } = useToast()
  const panelMeta = getProjectPanelCatalogEntry('archived')
  const PanelIcon = panelMeta.icon
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelHeightPx, setPanelHeightPx] = useState<number | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeTab, setActiveTab] = useState<ProjectArchivedTab>(preferredTab)
  const [workItemsSearchQuery, setWorkItemsSearchQuery] = useState('')
  const [documentsSearchQuery, setDocumentsSearchQuery] = useState('')
  const deferredWorkItemsSearch = useDeferredValue(workItemsSearchQuery.trim().toLowerCase())
  const deferredDocumentsSearch = useDeferredValue(documentsSearchQuery.trim().toLowerCase())
  const [workItemsPage, setWorkItemsPage] = useState(1)
  const [documentsPage, setDocumentsPage] = useState(1)
  const [workItemsPageSize, setWorkItemsPageSize] =
    useState<(typeof PROJECT_LIST_PAGE_SIZE_OPTIONS)[number]>(25)
  const [documentsPageSize, setDocumentsPageSize] =
    useState<(typeof PROJECT_LIST_PAGE_SIZE_OPTIONS)[number]>(25)
  const [workItemsRowsMeta, setWorkItemsRowsMeta] = useState<ProjectWorkItemTableRowsMeta>(EMPTY_ROWS_META)
  const [documentsRowsMeta, setDocumentsRowsMeta] = useState<ProjectWorkItemTableRowsMeta>(EMPTY_ROWS_META)

  useEffect(() => {
    setActiveTab(preferredTab)
  }, [preferredTab])

  const archivedWorkItemsList = useMemo(
    () => filterArchivedWorkItemsByKeys(workItems, archivedWorkItemKeys),
    [archivedWorkItemKeys, workItems],
  )

  const archivedDocumentRows = useMemo(
    () => listArchivedDocumentRows(project.id),
    [overlayRevision, project.id],
  )

  const filteredWorkItems = useMemo(() => {
    if (!deferredWorkItemsSearch) return archivedWorkItemsList
    return archivedWorkItemsList.filter((item) => {
      const haystack = [item.title, item.id, item.type, item.status, item.assignee, item.priority]
        .join(' ')
        .toLowerCase()
      return haystack.includes(deferredWorkItemsSearch)
    })
  }, [archivedWorkItemsList, deferredWorkItemsSearch])

  const filteredDocumentRows = useMemo(() => {
    if (!deferredDocumentsSearch) return archivedDocumentRows
    return archivedDocumentRows.filter((row) => {
      const { snapshot } = row
      const haystack = [
        snapshot.name,
        snapshot.id,
        snapshot.type,
        snapshot.status,
        snapshot.owner,
        snapshot.capability,
        snapshot.linkedContext,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(deferredDocumentsSearch)
    })
  }, [archivedDocumentRows, deferredDocumentsSearch])

  const searchQuery = activeTab === 'work-items' ? workItemsSearchQuery : documentsSearchQuery
  const setSearchQuery = activeTab === 'work-items' ? setWorkItemsSearchQuery : setDocumentsSearchQuery
  const page = activeTab === 'work-items' ? workItemsPage : documentsPage
  const setPage = activeTab === 'work-items' ? setWorkItemsPage : setDocumentsPage
  const pageSize = activeTab === 'work-items' ? workItemsPageSize : documentsPageSize
  const setPageSize = activeTab === 'work-items' ? setWorkItemsPageSize : setDocumentsPageSize
  const rowsMeta = activeTab === 'work-items' ? workItemsRowsMeta : documentsRowsMeta
  const filteredCount = activeTab === 'work-items' ? filteredWorkItems.length : filteredDocumentRows.length
  const totalArchivedCount =
    activeTab === 'work-items' ? archivedWorkItemsList.length : archivedDocumentRows.length

  useEffect(() => {
    setWorkItemsPage(1)
  }, [deferredWorkItemsSearch, project.id])

  useEffect(() => {
    setDocumentsPage(1)
  }, [deferredDocumentsSearch, project.id])

  useEffect(() => {
    if (loading || filteredWorkItems.length === 0) {
      setWorkItemsRowsMeta(EMPTY_ROWS_META)
    }
  }, [filteredWorkItems.length, loading])

  useEffect(() => {
    if (filteredDocumentRows.length === 0) {
      setDocumentsRowsMeta(EMPTY_ROWS_META)
    }
  }, [filteredDocumentRows.length])

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

  const handleRestoreWorkItem = async (item: WorkItemApiModel) => {
    try {
      if (usesOverlayApi) {
        await restoreProjectArchivedWorkItem(project.id, item.id)
      } else {
        restoreArchivedWorkItem(project.id, item.id)
      }
      onOverlayChange()
      addToast({
        title: 'Work item restored',
        description: `"${item.title}" is visible again in List, Board, and Timeline.`,
        variant: 'success',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to restore work item'
      addToast({ title: 'Restore failed', description: message, variant: 'error' })
    }
  }

  const handleRestoreDocument = (row: ArchivedDocumentRow) => {
    restoreArchivedDocument(project.id, row.snapshot.id)
    onOverlayChange()
    addToast({
      title: 'Document restored',
      description: `"${row.snapshot.name}" is visible again in Docs.`,
      variant: 'success',
    })
  }

  const goToList = () => {
    onNavigateList?.()
  }

  const panel = (
    <div
      ref={panelRef}
      id="panel-archived"
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
                aria-label={isFullscreen ? 'Exit archived fullscreen' : 'Expand archived to fullscreen'}
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
                {panelMeta.description} Restored items return to active delivery views unchanged.
              </p>

              <div
                className="inline-flex w-fit max-w-full shrink-0 flex-wrap gap-1 self-start rounded-lg border border-border/50 bg-muted/20 p-1 sm:ml-4"
                role="tablist"
                aria-label="Archived content type"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'work-items'}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition',
                    activeTab === 'work-items'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setActiveTab('work-items')}
                >
                  <ListChecks className="h-3.5 w-3.5" aria-hidden />
                  Work items
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                    {archivedWorkItemsList.length}
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'documents'}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition',
                    activeTab === 'documents'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setActiveTab('documents')}
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                  Documents
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                    {archivedDocumentRows.length}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={
                    activeTab === 'work-items'
                      ? 'Search title, ID, assignee…'
                      : 'Search document, owner, type…'
                  }
                  className="h-9 pl-8 text-sm"
                  aria-label={
                    activeTab === 'work-items' ? 'Search archived work items' : 'Search archived documents'
                  }
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

          {activeTab === 'work-items' && loading ? (
            <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-16 text-sm text-muted-foreground">
              Loading work items…
            </div>
          ) : filteredCount === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/50 px-6 py-10 text-center">
              {panelMeta.illustrationSrc ? (
                <img
                  src={panelMeta.illustrationSrc}
                  alt=""
                  className="h-auto w-full max-w-[14rem] object-contain opacity-90"
                />
              ) : (
                <Archive className="h-10 w-10 text-muted-foreground/70" strokeWidth={1.5} aria-hidden />
              )}
              <div className="max-w-md space-y-1">
                <h3 className="text-base font-semibold text-foreground">
                  {totalArchivedCount === 0
                    ? activeTab === 'work-items'
                      ? 'No archived work items yet'
                      : 'No archived documents yet'
                    : 'No matches for your search'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {totalArchivedCount === 0
                    ? activeTab === 'work-items'
                      ? 'Completed tasks can be archived from List to keep Board and Timeline focused on active delivery.'
                      : 'Documents can be archived from Docs to hide them from the active repository view.'
                    : 'Try a different keyword or clear the search field.'}
                </p>
              </div>
              {totalArchivedCount === 0 && activeTab === 'work-items' ? (
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={goToList}>
                  Open List view
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ) : activeTab === 'work-items' ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
              <ProjectArchivedTableView
                archivedRecords={archivedWorkItems}
                items={filteredWorkItems}
                onRestore={(item) => void handleRestoreWorkItem(item)}
                page={workItemsPage}
                pageSize={workItemsPageSize}
                onPageChange={setWorkItemsPage}
                onRowsMetaChange={setWorkItemsRowsMeta}
              />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
              <ProjectArchivedDocumentsTableView
                rows={filteredDocumentRows}
                onRestore={handleRestoreDocument}
                page={documentsPage}
                pageSize={documentsPageSize}
                onPageChange={setDocumentsPage}
                onRowsMetaChange={setDocumentsRowsMeta}
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
