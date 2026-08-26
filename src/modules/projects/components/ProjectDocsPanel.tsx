import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Archive, ChevronLeft, ChevronRight, FolderPlus, Loader2, Maximize2, Minimize2, PencilLine, Search, Sparkles } from 'lucide-react'
import { getSession } from '@/auth/authService'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import {
  enterpriseCyanGradientActionButtonClass,
  enterpriseIndigoGradientActionButtonClass,
} from '@/lib/enterpriseButtonClasses'
import { createDocumentFolder, fetchDocumentFolders, type DocumentFolder } from '@/lib/api/documentFolderApi'
import { listProjectDocuments } from '@/lib/api/documentKnowledgeApi'
import { listAllKbEntries } from '@/lib/api/tectonaKbApi'
import { findRepositoryTraceEntryByDocumentId } from '@/lib/kb/repositoryKbFromDocument'
import { cn } from '@/lib/utils'
import { normalizeUserDisplayName } from '@/lib/userDisplayName'
import { nextUntitledDocumentFolderName } from '@/modules/document-knowledge-management/lib/documentFolderUtils'
import {
  mapDocumentToRepositoryItem,
  type RepositoryItem,
} from '@/modules/document-knowledge-management/lib/documentRepositoryPresentation'
import { DocumentOnlyOfficeEditor } from '@/modules/document-knowledge-management/components/DocumentOnlyOfficeEditor'
import { fetchDocumentsLinkedToIdea } from '../lib/ideaLinkedDocuments'
import { ensureProjectDocumentFolder } from '../lib/ensureProjectDocumentFolder'
import { fetchIdentityDisplayNameMap, resolveActorDisplayName } from '../lib/projectMemberIdentity'
import { archiveDocumentManual, filterActiveRepositoryItems } from '../lib/projectArchivedDocuments'
import { getProjectPanelCatalogEntry } from '../lib/projectPanelCatalog'
import {
  measureProjectPanelHeight,
  PROJECT_PANEL_MIN_HEIGHT_PX,
} from '../lib/projectPanelLayout'
import { ProjectDocGenerateFromTemplateDialog } from './ProjectDocGenerateFromTemplateDialog'
import { ProjectDocsTableView } from './ProjectDocsTableView'
import {
  PROJECT_LIST_PAGE_SIZE_OPTIONS,
  ProjectWorkItemTablePaginationToolbar,
  type ProjectWorkItemTableRowsMeta,
} from './projectWorkItemTableShared'
import { useProjectDocsStore } from '../store/projectDocsStore'
import type { Project } from '../store/projectStore'

const EMPTY_ROWS_META: ProjectWorkItemTableRowsMeta = {
  total: 0,
  pageStart: 0,
  pageEnd: 0,
  pageSafe: 1,
  totalPages: 1,
}

const DOCS_FETCH_PAGE_SIZE = 100
const FOLDERS_FETCH_PAGE_SIZE = 100

const listToolbarFocusClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30 focus-visible:ring-offset-0'

interface ProjectDocsPanelProps {
  project: Project
  linkedIdeaId?: string | null
  linkedIdeaTitle?: string | null
  linkedIdeaDescription?: string | null
  linkedIdeaWorkspaceId?: string | null
  archivedBy: string
  archiveRevision: number
  onArchiveChange?: () => void
  onNavigateArchived?: () => void
}

type FolderStackEntry = {
  id: string
  name: string
}

export function ProjectDocsPanel({
  project,
  linkedIdeaId,
  linkedIdeaTitle,
  linkedIdeaDescription,
  linkedIdeaWorkspaceId,
  archivedBy,
  archiveRevision,
  onArchiveChange,
  onNavigateArchived,
}: ProjectDocsPanelProps) {
  const panelMeta = getProjectPanelCatalogEntry('docs')
  const PanelIcon = panelMeta.icon
  const { addToast } = useToast()
  const bumpDocsRefresh = useProjectDocsStore((state) => state.bumpRefresh)
  const refreshVersion = useProjectDocsStore((state) => state.refreshVersion)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelHeightPx, setPanelHeightPx] = useState<number | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showSelection, setShowSelection] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [folderStack, setFolderStack] = useState<FolderStackEntry[]>([])
  const [subfolders, setSubfolders] = useState<DocumentFolder[]>([])
  const [repositoryItems, setRepositoryItems] = useState<RepositoryItem[]>([])
  const [kbGeneratedIds, setKbGeneratedIds] = useState<Set<string>>(() => new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PROJECT_LIST_PAGE_SIZE_OPTIONS)[number]>(25)
  const [rowsMeta, setRowsMeta] = useState<ProjectWorkItemTableRowsMeta>(EMPTY_ROWS_META)
  const [pagedItemIds, setPagedItemIds] = useState<string[]>([])
  const [folderCreateBusy, setFolderCreateBusy] = useState(false)
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
  const [docEditId, setDocEditId] = useState<string | null>(null)
  const [docEditTitle, setDocEditTitle] = useState<string | null>(null)
  const [ownerDisplayNameByUserId, setOwnerDisplayNameByUserId] = useState<Map<string, string>>(() => new Map())
  const [rowContextMenu, setRowContextMenu] = useState<{
    x: number
    y: number
    item: RepositoryItem
  } | null>(null)

  const currentFolder = folderStack[folderStack.length - 1] ?? null
  const isAtProjectRoot = folderStack.length <= 1

  useEffect(() => {
    let cancelled = false
    void fetchIdentityDisplayNameMap().then((map) => {
      if (!cancelled) setOwnerDisplayNameByUserId(map)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const resolveOwnerDisplayName = useCallback(
    (actorRef: string | null | undefined) => {
      const resolved = resolveActorDisplayName(actorRef, ownerDisplayNameByUserId)
      if (resolved !== 'Unknown' && !resolved.startsWith('User ')) return resolved
      if (actorRef && project.ownerId && actorRef === project.ownerId && project.ownerName) {
        return normalizeUserDisplayName(project.ownerName)
      }
      return resolved
    },
    [ownerDisplayNameByUserId, project.ownerId, project.ownerName],
  )

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

  useEffect(() => {
    if (!showSelection && selectedIds.length > 0) setSelectedIds([])
  }, [selectedIds.length, showSelection])

  useEffect(() => {
    let cancelled = false

    async function initProjectFolder() {
      setLoading(true)
      try {
        const resolvedFolderId = await ensureProjectDocumentFolder({
          id: project.id,
          name: project.name,
        })
        if (!cancelled) {
          setFolderStack([{ id: resolvedFolderId, name: project.name }])
          setPage(1)
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Failed to load project documents'
          addToast({ title: 'Error', description: message, variant: 'error' })
          setFolderStack([])
          setSubfolders([])
          setRepositoryItems([])
          setLoading(false)
        }
      }
    }

    void initProjectFolder()
    return () => {
      cancelled = true
    }
  }, [addToast, project.id, project.name])

  const loadRepositoryView = useCallback(async () => {
    if (!currentFolder) return

    setLoading(true)
    try {
      const [folderResponse, documentResponse] = await Promise.all([
        fetchDocumentFolders({ parent_id: currentFolder.id, page: 1, page_size: FOLDERS_FETCH_PAGE_SIZE }),
        listProjectDocuments(project.id, {
          folder_id: currentFolder.id,
          page: 1,
          page_size: DOCS_FETCH_PAGE_SIZE,
        }),
      ])

      let allDocumentItems = [...documentResponse.items]
      const documentTotal = documentResponse.total ?? allDocumentItems.length
      if (documentTotal > allDocumentItems.length) {
        const totalPages = Math.ceil(documentTotal / DOCS_FETCH_PAGE_SIZE)
        const extraPages = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) =>
            listProjectDocuments(project.id, {
              folder_id: currentFolder.id,
              page: index + 2,
              page_size: DOCS_FETCH_PAGE_SIZE,
            }),
          ),
        )
        for (const pageResponse of extraPages) {
          allDocumentItems = allDocumentItems.concat(pageResponse.items)
        }
      }

      const items = allDocumentItems.map((doc) => mapDocumentToRepositoryItem(doc, project.name))
      let activeItems = filterActiveRepositoryItems(items, project.id)

      if (linkedIdeaId && isAtProjectRoot) {
        try {
          const ideaLinkedDocs = await fetchDocumentsLinkedToIdea({
            ideaId: linkedIdeaId,
            projectId: project.id,
            workspaceId: linkedIdeaWorkspaceId ?? project.workspaceId,
          })
          const existingIds = new Set(activeItems.map((item) => item.id))
          for (const doc of ideaLinkedDocs) {
            if (existingIds.has(doc.id)) continue
            activeItems = [
              ...activeItems,
              ...filterActiveRepositoryItems([mapDocumentToRepositoryItem(doc, project.name)], project.id),
            ]
            existingIds.add(doc.id)
          }
          activeItems = activeItems.sort(
            (a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime(),
          )
        } catch {
          // Idea merge is best-effort; folder documents still render when this fails.
        }
      }

      setSubfolders(folderResponse.folders)
      setRepositoryItems(activeItems)

      if (activeItems.length === 0) {
        setKbGeneratedIds(new Set())
      } else {
        try {
          const { items: kbEntries } = await listAllKbEntries()
          const generated = new Set(
            activeItems
              .filter((item) => findRepositoryTraceEntryByDocumentId(kbEntries, item.id, item.name))
              .map((item) => item.id),
          )
          setKbGeneratedIds(generated)
        } catch {
          setKbGeneratedIds(new Set())
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load project documents'
      addToast({ title: 'Error', description: message, variant: 'error' })
      setSubfolders([])
      setRepositoryItems([])
      setKbGeneratedIds(new Set())
    } finally {
      setLoading(false)
    }
  }, [addToast, archiveRevision, currentFolder, isAtProjectRoot, linkedIdeaId, linkedIdeaWorkspaceId, project.id, project.name, project.workspaceId])

  useEffect(() => {
    if (!currentFolder) return
    void loadRepositoryView()
  }, [archiveRevision, currentFolder, loadRepositoryView, refreshVersion])

  useEffect(() => {
    setPage(1)
  }, [currentFolder?.id, deferredSearch, project.id])

  useEffect(() => {
    if (loading || (repositoryItems.length === 0 && subfolders.length === 0)) {
      setRowsMeta(EMPTY_ROWS_META)
    }
  }, [loading, repositoryItems.length, subfolders.length])

  const filteredItems = useMemo(() => {
    if (!deferredSearch) return repositoryItems
    return repositoryItems.filter((item) => {
      const haystack = [
        item.name,
        item.id,
        item.type,
        item.owner,
        item.version,
        item.status,
        item.accessScope,
        item.updated,
        ...item.tags,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(deferredSearch)
    })
  }, [deferredSearch, repositoryItems])

  const filteredFolders = useMemo(() => {
    if (!deferredSearch) return subfolders
    return subfolders.filter((folder) => {
      const haystack = [folder.name, folder.id, folder.owner_id, 'folder'].join(' ').toLowerCase()
      return haystack.includes(deferredSearch)
    })
  }, [deferredSearch, subfolders])

  const openSubfolder = useCallback((folder: DocumentFolder) => {
    setFolderStack((prev) => [...prev, { id: folder.id, name: folder.name }])
    setPage(1)
  }, [])

  const navigateToFolderIndex = useCallback((index: number) => {
    setFolderStack((prev) => prev.slice(0, index + 1))
    setPage(1)
  }, [])

  const goToParentFolder = useCallback(() => {
    setFolderStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
    setPage(1)
  }, [])

  const handleCreateFolder = useCallback(async () => {
    if (!currentFolder || folderCreateBusy) return

    setFolderCreateBusy(true)
    try {
      const session = getSession()
      const name = nextUntitledDocumentFolderName(subfolders)
      const created = await createDocumentFolder({
        name,
        description: null,
        parent_id: currentFolder.id,
        owner_id: session?.user.id || session?.user.email || archivedBy || project.ownerName || null,
      })

      const folderResponse = await fetchDocumentFolders({
        parent_id: currentFolder.id,
        page: 1,
        page_size: FOLDERS_FETCH_PAGE_SIZE,
      })
      setSubfolders(folderResponse.folders)

      addToast({
        title: 'Folder created',
        description: `"${created.name}" is ready in this project folder.`,
        variant: 'success',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create folder'
      addToast({ title: 'Failed to create folder', description: message, variant: 'error' })
    } finally {
      setFolderCreateBusy(false)
    }
  }, [addToast, archivedBy, currentFolder, folderCreateBusy, project.ownerName, subfolders])

  const handleArchiveDocuments = useCallback(
    (itemIds: string[]) => {
      if (itemIds.length === 0) return

      const archivedByName = archivedBy || project.ownerName || 'system'
      let archivedCount = 0

      for (const itemId of itemIds) {
        const item = repositoryItems.find((row) => row.id === itemId)
        if (!item) continue
        archiveDocumentManual({
          projectId: project.id,
          item,
          archivedBy: archivedByName,
        })
        archivedCount += 1
      }

      if (archivedCount === 0) return

      setRepositoryItems((previous) => previous.filter((row) => !itemIds.includes(row.id)))
      setSelectedIds((previous) => previous.filter((id) => !itemIds.includes(id)))
      onArchiveChange?.()
      addToast({
        title: 'Documents archived',
        description: `${archivedCount} document${archivedCount === 1 ? '' : 's'} moved to Archived.`,
        variant: 'success',
      })
    },
    [addToast, archivedBy, onArchiveChange, project.id, project.ownerName, repositoryItems],
  )

  const handleArchiveDocument = useCallback(
    (item: RepositoryItem) => {
      setRowContextMenu(null)
      archiveDocumentManual({
        projectId: project.id,
        item,
        archivedBy: archivedBy || project.ownerName || 'system',
      })
      setRepositoryItems((previous) => previous.filter((row) => row.id !== item.id))
      onArchiveChange?.()
      addToast({
        title: 'Document archived',
        description: `"${item.name}" is hidden from Docs. Open Archived → Documents to restore.`,
        variant: 'success',
      })
    },
    [addToast, archivedBy, onArchiveChange, project.id, project.ownerName],
  )

  const showRootEmptyState = !loading && subfolders.length === 0 && repositoryItems.length === 0 && isAtProjectRoot

  const pagedItemIdsForSelection = pagedItemIds

  const allPageSelected =
    pagedItemIdsForSelection.length > 0 &&
    pagedItemIdsForSelection.every((id) => selectedIds.includes(id))
  const somePageSelected = pagedItemIdsForSelection.some((id) => selectedIds.includes(id))

  const toggleRowSelection = useCallback((itemId: string) => {
    setSelectedIds((previous) =>
      previous.includes(itemId) ? previous.filter((id) => id !== itemId) : [...previous, itemId],
    )
  }, [])

  const togglePageSelection = useCallback(() => {
    if (allPageSelected) {
      const pageIdSet = new Set(pagedItemIdsForSelection)
      setSelectedIds((previous) => previous.filter((id) => !pageIdSet.has(id)))
      return
    }
    setSelectedIds((previous) => Array.from(new Set([...previous, ...pagedItemIdsForSelection])))
  }, [allPageSelected, pagedItemIdsForSelection])

  const openProjectDocument = useCallback((item: RepositoryItem) => {
    setDocEditId(item.id)
    setDocEditTitle(item.name)
  }, [])

  const closeProjectDocumentEditor = useCallback(() => {
    setDocEditId(null)
    setDocEditTitle(null)
  }, [])

  const panel = (
    <div
      ref={panelRef}
      id="panel-docs"
      style={
        isFullscreen
          ? { height: 'calc(100dvh - 3rem)', maxHeight: 'calc(100dvh - 3rem)' }
          : panelHeightPx != null
            ? { height: panelHeightPx, maxHeight: panelHeightPx, minHeight: PROJECT_PANEL_MIN_HEIGHT_PX }
            : undefined
      }
      className={cn(
        'scroll-mt-24',
        'liquid-glass-enterprise-panel flex min-h-0 flex-col overflow-hidden border border-border/40',
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
                aria-label={isFullscreen ? 'Exit docs fullscreen' : 'Expand docs to fullscreen'}
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

            <div className="flex items-start justify-between gap-3">
              <p className="max-w-2xl flex-1 text-[11px] leading-snug text-muted-foreground">
                {panelMeta.description} Documents in this project are synced from the matching folder in Document
                Repository.
              </p>
              {currentFolder ? (
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    className={enterpriseIndigoGradientActionButtonClass()}
                    title="Generate a document from a DKM master template"
                    onClick={() => setGenerateDialogOpen(true)}
                  >
                    <Sparkles className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" strokeWidth={2.5} />
                    Generate from template
                  </button>
                  <button
                    type="button"
                    className={enterpriseCyanGradientActionButtonClass()}
                    disabled={folderCreateBusy}
                    onClick={() => void handleCreateFolder()}
                    title="Create a subfolder to organize documents"
                  >
                    {folderCreateBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
                    ) : (
                      <FolderPlus className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" strokeWidth={2.5} />
                    )}
                    New folder
                  </button>
                </div>
              ) : null}
            </div>

            {!isAtProjectRoot && folderStack.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1 text-sm">
                <button
                  type="button"
                  className="inline-flex items-center rounded-md px-1.5 py-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  title="Back to parent folder"
                  onClick={goToParentFolder}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {folderStack.map((folder, index) => (
                  <span key={folder.id} className="flex items-center gap-1">
                    {index > 0 ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" /> : null}
                    <button
                      type="button"
                      className={cn(
                        'rounded-md px-2 py-1 font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                        index === folderStack.length - 1 && 'text-foreground',
                      )}
                      onClick={() => navigateToFolderIndex(index)}
                    >
                      {folder.name}
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            {(!showRootEmptyState || loading) && currentFolder ? (
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search document, owner, type…"
                    className="h-9 pl-8 text-sm"
                    aria-label="Search project documents"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden /> : null}
                  <ProjectWorkItemTablePaginationToolbar
                    rowsMeta={rowsMeta}
                    pageSize={pageSize}
                    showSelection={showSelection}
                    onShowSelectionChange={setShowSelection}
                    onPageSizeChange={(nextSize) => {
                      setPageSize(nextSize)
                      setPage(1)
                    }}
                    onPrevPage={() => setPage((prev) => Math.max(1, prev - 1))}
                    onNextPage={() => setPage((prev) => Math.min(rowsMeta.totalPages, prev + 1))}
                  />
                </div>
              </div>
            ) : null}

            {showSelection && selectedIds.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                <span className="text-xs font-medium text-foreground">{selectedIds.length} selected</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                  onClick={() => handleArchiveDocuments(selectedIds)}
                >
                  <Archive className="h-3.5 w-3.5" aria-hidden />
                  Archive
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

          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col overflow-hidden',
              showRootEmptyState && 'rounded-xl border border-border/40 bg-muted/10',
            )}
          >
            {loading && repositoryItems.length === 0 && subfolders.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading project documents…
              </div>
            ) : showRootEmptyState ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-6 py-10">
                {panelMeta.illustrationSrc ? (
                  <div className="flex w-full max-w-[19.2rem] flex-col items-center gap-4 text-center">
                    <img
                      src={panelMeta.illustrationSrc}
                      alt=""
                      className="h-auto w-full object-contain object-center"
                      loading="lazy"
                    />
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold text-foreground">No documents yet</h3>
                      <p className="text-sm text-muted-foreground">{panelMeta.description}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex max-w-md flex-col items-center gap-3 text-center">
                    <PanelIcon className="h-10 w-10 text-muted-foreground/70" strokeWidth={1.5} aria-hidden />
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold text-foreground">No documents yet</h3>
                      <p className="text-sm text-muted-foreground">{panelMeta.description}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <ProjectDocsTableView
                folders={filteredFolders}
                onOpenFolder={openSubfolder}
                onDocumentClick={openProjectDocument}
                items={filteredItems}
                resolveOwnerDisplayName={resolveOwnerDisplayName}
                loading={loading}
                emptyMessage={
                  deferredSearch
                    ? 'No documents match the current search.'
                    : isAtProjectRoot
                      ? 'No documents in this project folder yet.'
                      : 'No documents in this folder.'
                }
                isKbGenerated={(item) => kbGeneratedIds.has(item.id)}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onRowsMetaChange={setRowsMeta}
                onPagedItemIdsChange={setPagedItemIds}
                showSelection={showSelection}
                selectedIds={selectedIds}
                onToggleRow={toggleRowSelection}
                onTogglePageSelection={togglePageSelection}
                allPageSelected={allPageSelected}
                somePageSelected={somePageSelected}
                onRowContextMenu={(event: MouseEvent<HTMLTableRowElement>, item: RepositoryItem) => {
                  event.preventDefault()
                  setRowContextMenu({
                    x: event.clientX,
                    y: event.clientY,
                    item,
                  })
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )

  const contextMenu = rowContextMenu ? (
    <ContextMenu
      open
      x={rowContextMenu.x}
      y={rowContextMenu.y}
      onClose={() => setRowContextMenu(null)}
    >
      <ContextMenuItem
        onClick={() => {
          openProjectDocument(rowContextMenu.item)
          setRowContextMenu(null)
        }}
      >
        <PencilLine className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        Open document
      </ContextMenuItem>
      <ContextMenuItem onClick={() => handleArchiveDocument(rowContextMenu.item)}>
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
  ) : null

  const generateDialog = (
    <ProjectDocGenerateFromTemplateDialog
      open={generateDialogOpen}
      onOpenChange={setGenerateDialogOpen}
      project={{
        id: project.id,
        name: project.name,
        description: project.description,
        workspaceId: project.workspaceId,
      }}
      linkedIdeaId={linkedIdeaId}
      linkedIdeaTitle={linkedIdeaTitle}
      linkedIdeaDescription={linkedIdeaDescription}
      linkedIdeaWorkspaceId={linkedIdeaWorkspaceId}
      targetFolderId={currentFolder?.id ?? null}
      onGenerated={(created) => {
        bumpDocsRefresh()
        if (created) {
          setDocEditId(created.id)
          setDocEditTitle(created.title)
        }
      }}
    />
  )

  const documentEditor = (
    <DocumentOnlyOfficeEditor
      open={Boolean(docEditId)}
      documentId={docEditId}
      documentTitle={docEditTitle}
      onClose={closeProjectDocumentEditor}
      onEdited={() => bumpDocsRefresh()}
    />
  )

  if (isFullscreen && typeof document !== 'undefined') {
    return (
      <>
        <div className="min-h-[50vh]" aria-hidden />
        {createPortal(panel, document.body)}
        {contextMenu}
        {generateDialog}
        {documentEditor}
      </>
    )
  }

  return (
    <>
      {panel}
      {contextMenu}
      {generateDialog}
      {documentEditor}
    </>
  )
}
