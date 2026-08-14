import { useMemo, useRef, useLayoutEffect, useState, useEffect, type CSSProperties, type HTMLAttributes } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpDown,
  CalendarClock,
  CheckCircle2,
  CheckSquare2,
  ChevronDown,
  FileText,
  Folder as FolderIcon,
  GripVertical,
  Layers3,
  List,
  ListChecks,
  Square,
  StickyNote,
  Workflow,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Folder, Project } from '@/modules/projects'
import type { SortOrder } from './FiltersBar'
import type { GridSelectionModifiers } from '../lib/gridSelection'
import { formatFolderContentsLabel } from '../lib/folderHierarchy'
import { extractPlainTextFromHtml } from '@/lib/richHtmlEditor'
import { useFolderNotesStore } from '../store/folderNotesStore'
import { ContextMenu } from '@/components/ui/context-menu'
import { FolderContextMenuContent } from './FolderContextMenuContent'
import {
  measureProjectPanelHeight,
  PROJECT_PANEL_MIN_HEIGHT_PX,
} from '../lib/projectPanelLayout'
import {
  PROJECT_LIST_DRAG_HANDLE_CLASS,
  PROJECT_LIST_FIRST_COLUMN_TINT_BODY_CLASS,
  PROJECT_LIST_FIRST_COLUMN_TINT_HEADER_CLASS,
  PROJECT_LIST_HEADER_ICON_CLASS,
  PROJECT_LIST_OTHER_COLUMN_TINT_HEADER_CLASS,
  PROJECT_LIST_TABLE_BODY_CELL_CLASS,
  PROJECT_LIST_TABLE_HEAD_CELL_CLASS,
  PROJECT_LIST_TABLE_PANEL_INNER_CLASS,
  PROJECT_LIST_TABLE_SCROLL_CLASS,
  PROJECT_LIST_TABLE_WRAPPER_CLASS,
} from '../lib/projectListTableClasses'

interface ProjectsFoldersListTableProps {
  folders: Folder[]
  projects: Project[]
  getProjectCount: (folderId: string) => number
  getChildFolderCount: (folderId: string) => number
  sortOrder: SortOrder
  onSortOrderChange: (order: SortOrder) => void
  showSortControl: boolean
  showFolders: boolean
  showProjects: boolean
  selectedFolderIds: Set<string>
  selectedProjectIds: Set<string>
  onSelectFolder: (folderId: string, modifiers: GridSelectionModifiers) => void
  onSelectProject: (projectId: string, modifiers: GridSelectionModifiers) => void
  onOpenFolder: (folderId: string) => void
  onClearSelection: () => void
  onSelectFoldersBulk: (folderIds: string[]) => void
  onSelectProjectsBulk: (projectIds: string[]) => void
  isDragActive?: boolean
  draggedProjectIds?: Set<string>
  orderedFolderIds?: string[]
  orderedProjectIds?: string[]
  onShareFolder?: (folder: Folder) => void
  onDeleteFolder?: (folder: Folder) => void
  onRenameFolder?: (folder: Folder) => void
  onAddProject?: (folder: Folder) => void
  onOpenFolderNotes?: (folder: Folder, options?: { autoFocusComposer?: boolean }) => void
  multiSelectActive?: boolean
  onDeleteSelectedFolders?: () => void
  onAddTodo?: () => void
}

const TYPE_CHIP_FOLDER =
  'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800/50 dark:bg-indigo-950/50 dark:text-indigo-100'
const TYPE_CHIP_PROJECT =
  'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/50 dark:bg-sky-950/50 dark:text-sky-100'
const STATUS_CHIP_ACTIVE =
  'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-100'
const STATUS_CHIP_ARCHIVED =
  'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700/50 dark:bg-slate-900/50 dark:text-slate-100'
const STATUS_CHIP_FOLDER_COUNT =
  'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/50 dark:bg-violet-950/50 dark:text-violet-100'

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const
const PAGE_SIZE_MENU_CLASS =
  'w-[7.5rem] min-w-[7.5rem] !bg-white !text-slate-900 dark:!bg-slate-950 dark:!text-slate-100 border border-slate-300 dark:border-slate-700 shadow-lg !backdrop-blur-none'

type DirectoryListRow =
  | { kind: 'folder'; folder: Folder }
  | { kind: 'project'; project: Project }

function formatDateModified(dateStr?: string) {
  if (!dateStr?.trim()) return '—'
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function sortByName<T extends { name: string }>(items: T[], sortOrder: SortOrder): T[] {
  return [...items].sort((a, b) => {
    const nameA = a.name.toLowerCase()
    const nameB = b.name.toLowerCase()
    return sortOrder === 'name-asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
  })
}

function orderedItems<T extends { id: string; name: string }>(
  items: T[],
  orderedIds: string[] | undefined,
  sortOrder: SortOrder,
): T[] {
  if (!items.length) return []
  const byId = new Map(items.map((item) => [item.id, item]))
  if (orderedIds && orderedIds.length > 0) {
    const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as T[]
    const rest = items.filter((item) => !orderedIds.includes(item.id))
    return [...ordered, ...sortByName(rest, sortOrder)]
  }
  return sortByName(items, sortOrder)
}

function ListTableHeaderCell({
  label,
  icon: Icon,
  isFirstColumn = false,
  sortActive,
  sortDirection,
  onSort,
}: {
  label: string
  icon: typeof ListChecks
  isFirstColumn?: boolean
  sortActive?: boolean
  sortDirection?: 'asc' | 'desc'
  onSort?: () => void
}) {
  return (
    <th
      className={cn(
        TABLE_HEAD_CELL,
        isFirstColumn ? FIRST_COLUMN_HEAD : OTHER_COLUMN_HEAD,
        !isFirstColumn && 'whitespace-nowrap',
      )}
    >
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground hover:text-foreground"
          title={
            sortActive
              ? `Sorted ${sortDirection === 'asc' ? 'ascending' : 'descending'} — click to toggle`
              : 'Sort column'
          }
          aria-label={`Sort by ${label}`}
        >
          <Icon className={HEADER_ICON} aria-hidden />
          <span>{label}</span>
          <ArrowUpDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-transform',
              sortActive ? 'text-foreground opacity-100' : 'opacity-60',
              sortActive && sortDirection === 'desc' && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
      ) : (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Icon className={HEADER_ICON} aria-hidden />
          <span>{label}</span>
        </span>
      )}
    </th>
  )
}

const TABLE_HEAD_CELL = PROJECT_LIST_TABLE_HEAD_CELL_CLASS
const FIRST_COLUMN_HEAD = PROJECT_LIST_FIRST_COLUMN_TINT_HEADER_CLASS
const OTHER_COLUMN_HEAD = PROJECT_LIST_OTHER_COLUMN_TINT_HEADER_CLASS
const TABLE_BODY_CELL = PROJECT_LIST_TABLE_BODY_CELL_CLASS
const FIRST_COLUMN_BODY = PROJECT_LIST_FIRST_COLUMN_TINT_BODY_CLASS
const HEADER_ICON = PROJECT_LIST_HEADER_ICON_CLASS
const DRAG_HANDLE = PROJECT_LIST_DRAG_HANDLE_CLASS
const SELECT_COLUMN_WIDTH_PX = 28
const SELECT_CELL_CLASS =
  'box-border w-7 min-w-7 max-w-7 shrink-0 !px-1 whitespace-nowrap border-b border-slate-200/20 py-2 align-top transition-colors dark:border-slate-700/20'

export function ProjectsFoldersListTable({
  folders,
  projects,
  getProjectCount,
  getChildFolderCount,
  sortOrder,
  onSortOrderChange,
  showFolders,
  showProjects,
  selectedFolderIds,
  selectedProjectIds,
  onSelectFolder,
  onSelectProject,
  onOpenFolder,
  onClearSelection,
  onSelectFoldersBulk,
  onSelectProjectsBulk,
  isDragActive = false,
  draggedProjectIds,
  orderedFolderIds,
  orderedProjectIds,
  onShareFolder,
  onDeleteFolder,
  onRenameFolder,
  onAddProject,
  onOpenFolderNotes,
  multiSelectActive = false,
  onDeleteSelectedFolders,
  onAddTodo,
}: ProjectsFoldersListTableProps) {
  const navigate = useNavigate()
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelHeightPx, setPanelHeightPx] = useState<number | null>(null)
  const [showSelection, setShowSelection] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25)

  useLayoutEffect(() => {
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
  }, [])

  const sortedFolders = useMemo(
    () => (showFolders ? orderedItems(folders, orderedFolderIds, sortOrder) : []),
    [folders, orderedFolderIds, showFolders, sortOrder],
  )
  const sortedProjects = useMemo(
    () => (showProjects ? orderedItems(projects, orderedProjectIds, sortOrder) : []),
    [projects, orderedProjectIds, showProjects, sortOrder],
  )

  const totalCount = sortedFolders.length + sortedProjects.length

  const allRows = useMemo<DirectoryListRow[]>(
    () => [
      ...sortedFolders.map((folder) => ({ kind: 'folder' as const, folder })),
      ...sortedProjects.map((project) => ({ kind: 'project' as const, project })),
    ],
    [sortedFolders, sortedProjects],
  )

  useEffect(() => {
    setPage(1)
  }, [totalCount, sortOrder, pageSize, showFolders, showProjects])

  useEffect(() => {
    if (!showSelection && (selectedFolderIds.size > 0 || selectedProjectIds.size > 0)) {
      onClearSelection()
    }
  }, [showSelection, selectedFolderIds.size, selectedProjectIds.size, onClearSelection])

  const totalPages = Math.max(1, Math.ceil(Math.max(allRows.length, 1) / pageSize))
  const pageSafe = Math.min(page, totalPages)

  const pagedRows = useMemo(
    () => allRows.slice((pageSafe - 1) * pageSize, pageSafe * pageSize),
    [allRows, pageSafe, pageSize],
  )

  const sortableIds = useMemo(
    () =>
      pagedRows.map((row) =>
        row.kind === 'folder' ? `folder-${row.folder.id}` : `project-${row.project.id}`,
      ),
    [pagedRows],
  )

  if (totalCount === 0) return null

  const pageStart = (pageSafe - 1) * pageSize + 1
  const pageEnd = Math.min(pageSafe * pageSize, allRows.length)

  const pageFolderIds = pagedRows
    .filter((row): row is Extract<DirectoryListRow, { kind: 'folder' }> => row.kind === 'folder')
    .map((row) => row.folder.id)
  const pageProjectIds = pagedRows
    .filter((row): row is Extract<DirectoryListRow, { kind: 'project' }> => row.kind === 'project')
    .map((row) => row.project.id)

  const allPageSelected =
    pageFolderIds.length > 0
      ? pageFolderIds.every((id) => selectedFolderIds.has(id)) && selectedProjectIds.size === 0
      : pageProjectIds.length > 0
        ? pageProjectIds.every((id) => selectedProjectIds.has(id)) && selectedFolderIds.size === 0
        : false

  const somePageSelected =
    pageFolderIds.some((id) => selectedFolderIds.has(id)) ||
    pageProjectIds.some((id) => selectedProjectIds.has(id))

  const togglePageSelection = () => {
    if (allPageSelected) {
      onClearSelection()
      return
    }
    if (pageFolderIds.length > 0) {
      onSelectFoldersBulk(pageFolderIds)
      return
    }
    if (pageProjectIds.length > 0) {
      onSelectProjectsBulk(pageProjectIds)
    }
  }

  const panelTitle = (() => {
    if (showFolders && showProjects) return 'Projects directory'
    if (showFolders) return 'Folders'
    return 'Projects'
  })()

  const panelDescription = (() => {
    if (showFolders && showProjects) {
      return 'Folders and root projects in one searchable list.'
    }
    if (showFolders) return 'Folder directory for organizing projects.'
    return 'Root projects not assigned to any folder.'
  })()

  const toggleNameSort = () => {
    onSortOrderChange(sortOrder === 'name-asc' ? 'name-desc' : 'name-asc')
  }

  return (
    <div
      ref={panelRef}
      style={
        panelHeightPx != null
          ? {
              height: panelHeightPx,
              maxHeight: panelHeightPx,
              minHeight: PROJECT_PANEL_MIN_HEIGHT_PX,
            }
          : undefined
      }
      className={PROJECT_LIST_TABLE_WRAPPER_CLASS}
    >
      <div className="flex h-full min-h-0 w-full flex-col">
        <div className={PROJECT_LIST_TABLE_PANEL_INNER_CLASS}>
          <div className="shrink-0">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex min-w-0 items-center gap-2">
                  <List className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                  <h2 className="text-lg font-semibold text-foreground">{panelTitle}</h2>
                </div>
                <p className="max-w-2xl text-[11px] leading-snug text-muted-foreground">{panelDescription}</p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
              <button
                type="button"
                role="switch"
                aria-checked={showSelection}
                onClick={() => setShowSelection((prev) => !prev)}
                className="group inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-2 py-1 shadow-sm transition hover:bg-muted/40"
                title="Show/Hide selection checkboxes"
              >
                <span className="text-[11px] font-medium text-muted-foreground">Select</span>
                <span
                  className={cn(
                    'relative h-5 w-9 rounded-full transition-colors',
                    showSelection ? 'bg-primary' : 'bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-4 w-4 rounded-full bg-background shadow-sm transition-transform',
                      showSelection ? 'left-0.5 translate-x-4' : 'left-0.5 translate-x-0',
                    )}
                  />
                </span>
              </button>
              <span>
                Showing{' '}
                <span className="font-semibold text-foreground">
                  {pageStart}-{pageEnd}
                </span>{' '}
                of <span className="font-semibold text-foreground">{allRows.length}</span>
              </span>
              <span className="text-xs text-muted-foreground">Rows:</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm transition',
                      'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30',
                    )}
                    aria-label="Rows per page"
                  >
                    <span className="min-w-[20px] text-left tabular-nums">{pageSize}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={PAGE_SIZE_MENU_CLASS}>
                  <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground">
                    Rows per page
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <DropdownMenuItem
                      key={size}
                      onClick={() => {
                        setPageSize(size)
                        setPage(1)
                      }}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs"
                    >
                      <span className="tabular-nums">{size}</span>
                      {pageSize === size ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="flex h-8 items-stretch overflow-hidden rounded-lg border border-border bg-background/80">
                <button
                  type="button"
                  className="px-2 hover:bg-muted/40 disabled:opacity-50"
                  disabled={pageSafe <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Prev
                </button>
                <span className="flex items-center px-2 tabular-nums">
                  {pageSafe}/{totalPages}
                </span>
                <button
                  type="button"
                  className="px-2 hover:bg-muted/40 disabled:opacity-50"
                  disabled={pageSafe >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Next
                </button>
              </div>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
            <div className={PROJECT_LIST_TABLE_SCROLL_CLASS}>
              <table className="w-full table-fixed border-collapse text-xs select-none">
            <colgroup>
              {showSelection ? <col style={{ width: '1%' }} /> : null}
              <col style={{ width: showSelection ? '27%' : '28%' }} />
              <col className="w-[9%]" />
              <col className="w-[30%]" />
              <col className="w-[13%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-muted-foreground">
                {showSelection ? (
                  <th
                    className={cn(TABLE_HEAD_CELL, OTHER_COLUMN_HEAD, SELECT_CELL_CLASS)}
                    style={{ width: SELECT_COLUMN_WIDTH_PX, maxWidth: SELECT_COLUMN_WIDTH_PX }}
                  >
                    <button
                      type="button"
                      aria-label={allPageSelected ? 'Deselect page' : 'Select page'}
                      className="inline-flex text-muted-foreground hover:text-foreground"
                      onClick={togglePageSelection}
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
                <ListTableHeaderCell
                  label="Name"
                  icon={ListChecks}
                  isFirstColumn
                  sortActive
                  sortDirection={sortOrder === 'name-asc' ? 'asc' : 'desc'}
                  onSort={toggleNameSort}
                />
                <ListTableHeaderCell label="Type" icon={Layers3} />
                <ListTableHeaderCell label="Description" icon={FileText} />
                <ListTableHeaderCell label="Date modified" icon={CalendarClock} />
                <ListTableHeaderCell label="Status" icon={Workflow} />
              </tr>
            </thead>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <tbody>
                {pagedRows.map((row) =>
                  row.kind === 'folder' ? (
                    <FolderListRow
                      key={row.folder.id}
                      folder={row.folder}
                      projectCount={getProjectCount(row.folder.id)}
                      childFolderCount={getChildFolderCount(row.folder.id)}
                      isSelected={selectedFolderIds.has(row.folder.id)}
                      onSelect={onSelectFolder}
                      onOpen={() => onOpenFolder(row.folder.id)}
                      showCheckbox={showSelection}
                      onShare={onShareFolder ? () => onShareFolder(row.folder) : undefined}
                      onDelete={onDeleteFolder ? () => onDeleteFolder(row.folder) : undefined}
                      onRenameFolder={onRenameFolder ? () => onRenameFolder(row.folder) : undefined}
                      onAddProject={onAddProject ? () => onAddProject(row.folder) : undefined}
                      onOpenFolderNotes={
                        onOpenFolderNotes
                          ? (options) => onOpenFolderNotes(row.folder, options)
                          : undefined
                      }
                      multiSelectActive={multiSelectActive && selectedFolderIds.has(row.folder.id)}
                      onDeleteSelected={onDeleteSelectedFolders}
                      onAddTodo={onAddTodo}
                    />
                  ) : (
                    <ProjectListRow
                      key={row.project.id}
                      project={row.project}
                      isSelected={selectedProjectIds.has(row.project.id)}
                      onSelect={onSelectProject}
                      onDoubleClick={() => navigate(`/projects/${row.project.id}`)}
                      showCheckbox={showSelection}
                      isDragActive={isDragActive}
                      draggedProjectIds={draggedProjectIds}
                    />
                  ),
                )}
              </tbody>
            </SortableContext>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FolderListRow({
  folder,
  projectCount,
  childFolderCount,
  isSelected,
  onSelect,
  onOpen,
  showCheckbox,
  onShare,
  onDelete,
  onRenameFolder,
  onAddProject,
  onOpenFolderNotes,
  multiSelectActive = false,
  onDeleteSelected,
  onAddTodo,
}: {
  folder: Folder
  projectCount: number
  childFolderCount: number
  isSelected: boolean
  onSelect: (folderId: string, modifiers: GridSelectionModifiers) => void
  onOpen: () => void
  showCheckbox: boolean
  onShare?: () => void
  onDelete?: () => void
  onRenameFolder?: () => void
  onAddProject?: () => void
  onOpenFolderNotes?: (options?: { autoFocusComposer?: boolean }) => void
  multiSelectActive?: boolean
  onDeleteSelected?: () => void
  onAddTodo?: () => void
}) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const noteCount = useFolderNotesStore(
    (state) => state.notesByFolderId[folder.id]?.length ?? 0,
  )
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `folder-${folder.id}`,
    data: { type: 'folder', folder },
  })

  const rowStyle: CSSProperties = isDragging
    ? { opacity: 0.25 }
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      }

  const cellClass = cn(TABLE_BODY_CELL, isSelected ? 'bg-primary/10' : 'group-hover:bg-accent/20')
  const titleCellClass = cn(
    TABLE_BODY_CELL,
    isSelected ? 'bg-primary/10' : cn(FIRST_COLUMN_BODY, 'group-hover:bg-accent/20'),
  )

  return (
    <>
      <SortableTableRow
        setNodeRef={setNodeRef}
        rowStyle={rowStyle}
        isSelected={isSelected}
        isDragging={isDragging}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setContextMenu({ x: e.clientX, y: e.clientY })
        }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('[data-directory-drag-handle]')) return
          onSelect(folder.id, {
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            metaKey: e.metaKey,
          })
        }}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest('[data-directory-drag-handle]')) return
          e.preventDefault()
          onOpen()
        }}
        dragHandleProps={{ ...attributes, ...listeners }}
        showCheckbox={showCheckbox}
        checkboxSelected={isSelected}
        onToggleCheckbox={() =>
          onSelect(folder.id, { ctrlKey: true, shiftKey: false, metaKey: false })
        }
        titleCell={titleCellClass}
        bodyCell={cellClass}
        nameTitle={folder.name}
        nameSubtitle="Folder"
        nameIcon={
        <FolderIcon
          className="h-3.5 w-3.5 shrink-0 text-primary"
          style={folder.borderColor ? { color: folder.borderColor } : undefined}
          aria-hidden
        />
      }
        typeCell={
          <Badge
            variant="outline"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
              TYPE_CHIP_FOLDER,
            )}
          >
            <FolderIcon className="h-3 w-3" aria-hidden />
            Folder
          </Badge>
        }
        description={folder.description || '—'}
        dateModified={formatDateModified((folder as Folder & { updatedAt?: string }).updatedAt)}
      statusCell={
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'rounded-full border px-2 py-0.5 text-[11px] font-medium',
              STATUS_CHIP_FOLDER_COUNT,
            )}
          >
            {formatFolderContentsLabel(projectCount, childFolderCount)}
          </Badge>
          {noteCount > 0 ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200"
              onClick={(event) => {
                event.stopPropagation()
                onOpenFolderNotes?.()
              }}
            >
              <StickyNote className="h-3 w-3" aria-hidden />
              {noteCount}
            </button>
          ) : null}
        </div>
      }
      />
      <ContextMenu
        open={!!contextMenu}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        onClose={() => setContextMenu(null)}
      >
        <FolderContextMenuContent
          folder={folder}
          multiSelectActive={multiSelectActive}
          onClose={() => setContextMenu(null)}
          onOpen={onOpen}
          onRenameFolder={onRenameFolder}
          onAddProject={onAddProject}
          onShare={onShare}
          onDelete={onDelete}
          onDeleteSelected={onDeleteSelected}
          onAddTodo={onAddTodo}
          onAddNotes={
            onOpenFolderNotes ? () => onOpenFolderNotes({ autoFocusComposer: true }) : undefined
          }
          pasteTargetParentId={folder.id}
        />
      </ContextMenu>
    </>
  )
}

function ProjectListRow({
  project,
  isSelected,
  onSelect,
  onDoubleClick,
  showCheckbox,
  isDragActive,
  draggedProjectIds,
}: {
  project: Project
  isSelected: boolean
  onSelect: (projectId: string, modifiers: GridSelectionModifiers) => void
  onDoubleClick: () => void
  showCheckbox: boolean
  isDragActive: boolean
  draggedProjectIds?: Set<string>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `project-${project.id}`,
    data: { type: 'project', project },
  })

  const isGhostDragging = isDragActive && draggedProjectIds?.has(project.id)
  const rowStyle: CSSProperties = isDragging || isGhostDragging
    ? { opacity: 0.25 }
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      }

  const cellClass = cn(TABLE_BODY_CELL, isSelected ? 'bg-primary/10' : 'group-hover:bg-accent/20')
  const titleCellClass = cn(
    TABLE_BODY_CELL,
    isSelected ? 'bg-primary/10' : cn(FIRST_COLUMN_BODY, 'group-hover:bg-accent/20'),
  )

  return (
    <SortableTableRow
      setNodeRef={setNodeRef}
      rowStyle={rowStyle}
      isSelected={isSelected}
      isDragging={isDragging}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-directory-drag-handle]')) return
        if ((e.target as HTMLElement).closest('[data-row-checkbox]')) return
        onSelect(project.id, {
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          metaKey: e.metaKey,
        })
      }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-directory-drag-handle]')) return
        if ((e.target as HTMLElement).closest('[data-row-checkbox]')) return
        e.preventDefault()
        onDoubleClick()
      }}
      dragHandleProps={{ ...attributes, ...listeners }}
      showCheckbox={showCheckbox}
      checkboxSelected={isSelected}
      onToggleCheckbox={() =>
        onSelect(project.id, { ctrlKey: true, shiftKey: false, metaKey: false })
      }
      titleCell={titleCellClass}
      bodyCell={cellClass}
      nameTitle={project.name}
      nameSubtitle={project.id}
      typeCell={
        <Badge
          variant="outline"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
            TYPE_CHIP_PROJECT,
          )}
        >
          Project
        </Badge>
      }
      description={project.description || '—'}
      dateModified={formatDateModified(project.updatedAt)}
      statusCell={
        <Badge
          variant="outline"
          className={cn(
            'rounded-full border px-2 py-0.5 text-[11px] font-medium',
            project.status === 'active' ? STATUS_CHIP_ACTIVE : STATUS_CHIP_ARCHIVED,
          )}
        >
          {project.status === 'active' ? 'Active' : 'Archived'}
        </Badge>
      }
    />
  )
}

function SortableTableRow({
  setNodeRef,
  rowStyle,
  isSelected,
  isDragging,
  onClick,
  onDoubleClick,
  onContextMenu,
  dragHandleProps,
  showCheckbox,
  checkboxSelected,
  onToggleCheckbox,
  titleCell,
  bodyCell,
  nameTitle,
  nameSubtitle,
  nameIcon,
  typeCell,
  description,
  dateModified,
  statusCell,
}: {
  setNodeRef: (node: HTMLElement | null) => void
  rowStyle: CSSProperties
  isSelected: boolean
  isDragging: boolean
  onClick: (e: React.MouseEvent<HTMLTableRowElement>) => void
  onDoubleClick: (e: React.MouseEvent<HTMLTableRowElement>) => void
  onContextMenu?: (e: React.MouseEvent<HTMLTableRowElement>) => void
  dragHandleProps: HTMLAttributes<HTMLButtonElement>
  showCheckbox: boolean
  checkboxSelected: boolean
  onToggleCheckbox?: () => void
  titleCell: string
  bodyCell: string
  nameTitle: string
  nameSubtitle: string
  nameIcon?: React.ReactNode
  typeCell: React.ReactNode
  description: string
  dateModified: string
  statusCell: React.ReactNode
}) {
  return (
    <tr
      ref={setNodeRef}
      style={rowStyle}
      className={cn(
        'group cursor-pointer transition-colors',
        showCheckbox && isSelected && 'bg-primary/5',
        isDragging && 'relative z-10',
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      {showCheckbox ? (
        <td
          className={cn(SELECT_CELL_CLASS, isSelected ? 'bg-primary/10' : 'group-hover:bg-accent/20')}
          style={{ width: SELECT_COLUMN_WIDTH_PX, maxWidth: SELECT_COLUMN_WIDTH_PX }}
        >
          {onToggleCheckbox ? (
            <button
              type="button"
              data-row-checkbox
              aria-label={checkboxSelected ? `Deselect ${nameTitle}` : `Select ${nameTitle}`}
              className="inline-flex text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                onToggleCheckbox()
              }}
            >
              {checkboxSelected ? (
                <CheckSquare2 className="h-4 w-4 text-primary" />
              ) : (
                <Square className="h-4 w-4" />
              )}
            </button>
          ) : null}
        </td>
      ) : null}
      <td className={titleCell}>
        <div className="flex min-w-0 items-start gap-1.5">
          <button
            type="button"
            data-directory-drag-handle
            className={DRAG_HANDLE}
            title="Drag to reorder row"
            aria-label={`Drag to reorder ${nameTitle}`}
            {...dragHandleProps}
            onClick={(e) => {
              dragHandleProps.onClick?.(e)
              e.stopPropagation()
            }}
          >
            <GripVertical className="h-3.5 w-3.5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              {nameIcon}
              <span className="truncate font-semibold text-foreground">{nameTitle}</span>
            </div>
            <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{nameSubtitle}</div>
          </div>
        </div>
      </td>
      <td className={cn(bodyCell, 'whitespace-nowrap')}>{typeCell}</td>
      <td className={cn(bodyCell, 'min-w-0')}>
        <span className="line-clamp-2 text-[11px] text-muted-foreground">
          {extractPlainTextFromHtml(description).trim() || description}
        </span>
      </td>
      <td className={cn(bodyCell, 'whitespace-nowrap text-[11px] text-muted-foreground')}>{dateModified}</td>
      <td className={cn(bodyCell, 'whitespace-nowrap')}>{statusCell}</td>
    </tr>
  )
}
