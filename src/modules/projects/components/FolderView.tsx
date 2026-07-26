import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, Share2, Edit, Filter, LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Tooltip } from '@/components/ui/tooltip'
import {
  EnterpriseViewControlButton,
  EnterpriseViewControlRail,
  EnterpriseViewControlSeparator,
} from '@/components/enterprise/EnterpriseViewControlRail'
import { SelectionActionBar } from './SelectionActionBar'
import { ProjectsSection } from './ProjectsSection'
import {
  FiltersBar,
  ALL_PROJECT_STATUS_FILTER_TAGS,
  type ProjectStatusFilterTag,
  type ProjectTypeFilterTag,
  type SortOrder,
} from './FiltersBar'
import { useProjectStore, useFolderStore } from '@/modules/projects'
import { useToast } from '@/components/ui/toast'
import { notifyEvent } from '@/lib/api/notificationApi'
import type { Folder, Project } from '@/modules/projects'
import type { LayoutMode } from './FoldersSection'

const FOLDER_VIEW_TYPE_FILTER_TAGS = new Set<ProjectTypeFilterTag>(['projects'])

interface FolderViewProps {
  folder: Folder
  onBack: () => void
  onShare: (folder: Folder) => void
  onRename?: (folder: Folder) => void
  selectedProjectIds: Set<string>
  onSelectProject: (projectId: string, selected: boolean, shiftKey?: boolean) => void
  onMoveSelectedToFolder: (folderId: string | null) => void
  onClearSelection: () => void
  onArchiveSelected?: () => void | Promise<void>
  onRestoreSelected?: () => void | Promise<void>
  onDeleteSelected?: () => void | Promise<void>
  archivedSelectedCount?: number
  sortOrder: SortOrder
  onSortOrderChange: (order: SortOrder) => void
  /** Sama seperti di luar folder: drag state dan urutan untuk reorder, create project di folder ini */
  isDragActive?: boolean
  draggedProjectIds?: Set<string>
  orderedProjectIds?: string[]
  onCreateProject?: () => void
  layout?: LayoutMode
  /** Mirip halaman root: icon dan panel search & filter */
  showFiltersPanel?: boolean
  onShowFiltersPanelChange?: (show: boolean) => void
  onLayoutChange?: (layout: LayoutMode) => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
  statusFilterTags?: Set<ProjectStatusFilterTag>
  onStatusFilterTagsChange?: React.Dispatch<React.SetStateAction<Set<ProjectStatusFilterTag>>>
  /** Project yang sudah di-filter oleh parent (search + status); jika tidak ada, pakai semua project di folder */
  projects?: Project[]
  totalProjects?: number
  activeProjects?: number
  archivedProjects?: number
  selectionBar?: React.ReactNode
}

export function FolderView({
  folder,
  onBack,
  onShare,
  onRename,
  selectedProjectIds,
  onSelectProject,
  onMoveSelectedToFolder,
  onClearSelection,
  onArchiveSelected,
  onRestoreSelected,
  onDeleteSelected,
  archivedSelectedCount = 0,
  sortOrder,
  onSortOrderChange,
  isDragActive = false,
  draggedProjectIds,
  orderedProjectIds,
  onCreateProject,
  layout = 'grid',
  showFiltersPanel = true,
  onShowFiltersPanelChange,
  onLayoutChange,
  searchQuery = '',
  onSearchChange,
  statusFilterTags: statusFilterTagsProp,
  onStatusFilterTagsChange,
  projects: projectsProp,
  totalProjects: totalProjectsProp,
  activeProjects: activeProjectsProp,
  archivedProjects: archivedProjectsProp,
  selectionBar,
}: FolderViewProps) {
  const statusFilterTags = statusFilterTagsProp ?? new Set(ALL_PROJECT_STATUS_FILTER_TAGS)
  const { getProjectsByFolder } = useProjectStore()
  const { updateFolder, isFolderNameUnique } = useFolderStore()
  const { addToast } = useToast()
  const allFolderProjects = getProjectsByFolder(folder.id)
  const projects = projectsProp ?? allFolderProjects

  const totalProjects = totalProjectsProp ?? allFolderProjects.length
  const activeProjects = activeProjectsProp ?? allFolderProjects.filter((p) => p.status === 'active').length
  const archivedProjects = archivedProjectsProp ?? allFolderProjects.filter((p) => p.status === 'archived').length

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(folder.name)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setRenameValue(folder.name)
  }, [folder.name])

  useEffect(() => {
    if (isRenaming) {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }
  }, [isRenaming])

  const saveRename = async () => {
    const trimmed = renameValue.trim()
    if (trimmed === '' || trimmed === folder.name) {
      setIsRenaming(false)
      return
    }
    if (trimmed.length < 3) {
      addToast({ title: 'Nama folder minimal 3 karakter', variant: 'error' })
      return
    }
    if (trimmed.length > 40) {
      addToast({ title: 'Nama folder maksimal 40 karakter', variant: 'error' })
      return
    }
    if (!isFolderNameUnique(trimmed, folder.id, folder.parentId ?? null)) {
      addToast({ title: 'Nama folder sudah dipakai', variant: 'error' })
      return
    }
    try {
      await updateFolder(folder.id, { name: trimmed })
      addToast({ title: 'Folder diubah', description: `Menjadi "${trimmed}".`, variant: 'success' })
      notifyEvent({ type_code: 'folder', title: 'Folder diubah', body: `Menjadi "${trimmed}".` })
      setIsRenaming(false)
    } catch (e) {
      addToast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Gagal mengubah folder',
        variant: 'error',
      })
    }
  }

  const cancelRename = () => {
    setRenameValue(folder.name)
    setIsRenaming(false)
  }

  const displayName = isRenaming ? renameValue : folder.name

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Projects', href: '/projects' },
          { label: displayName },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            {isRenaming ? (
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={saveRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') {
                    cancelRename()
                    e.currentTarget.blur()
                  }
                }}
                className="text-2xl font-bold text-foreground w-full min-w-0 px-2 py-1 rounded border border-primary/50 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Folder name"
              />
            ) : (
              <h1 className="text-2xl font-bold text-foreground truncate">{folder.name}</h1>
            )}
            {!isRenaming && folder.description && (
              <p className="text-sm text-muted-foreground mt-1">{folder.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(onShowFiltersPanelChange || onLayoutChange) && (
            <EnterpriseViewControlRail>
              {onShowFiltersPanelChange && (
                <>
                  <Tooltip content={showFiltersPanel ? 'Hide search & filter panel' : 'Show search & filter panel'} side="bottom">
                    <EnterpriseViewControlButton
                      active={showFiltersPanel}
                      onClick={() => onShowFiltersPanelChange(!showFiltersPanel)}
                      aria-label={showFiltersPanel ? 'Hide panel' : 'Show panel'}
                    >
                      <Filter className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    </EnterpriseViewControlButton>
                  </Tooltip>
                  {onLayoutChange ? <EnterpriseViewControlSeparator /> : null}
                </>
              )}
              {onLayoutChange && (
                <Tooltip content={layout === 'grid' ? 'Show as list' : 'Show as grid'} side="bottom">
                  <EnterpriseViewControlButton
                    active={layout === 'grid'}
                    onClick={() => onLayoutChange(layout === 'grid' ? 'list' : 'grid')}
                    aria-label={layout === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
                  >
                    {layout === 'grid' ? (
                      <List className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    ) : (
                      <LayoutGrid className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    )}
                  </EnterpriseViewControlButton>
                </Tooltip>
              )}
            </EnterpriseViewControlRail>
          )}
          <Button variant="outline" size="sm" onClick={() => onShare(folder)}>
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
          {onRename && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRenaming(true)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Rename
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters — sama seperti halaman root */}
      {showFiltersPanel && onSearchChange && onStatusFilterTagsChange && (
        <FiltersBar
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          statusFilterTags={statusFilterTags}
          onStatusFilterTagsChange={onStatusFilterTagsChange}
          typeFilterTags={FOLDER_VIEW_TYPE_FILTER_TAGS}
          onTypeFilterTagsChange={() => {}}
          sortOrder={sortOrder}
          onSortOrderChange={onSortOrderChange}
          totalProjects={totalProjects}
          activeProjects={activeProjects}
          archivedProjects={archivedProjects}
          totalFolders={0}
          onCreateProject={onCreateProject}
          selectionBar={selectionBar}
          folderMode
        />
      )}

      {/* Projects Section — kemampuan sama seperti di luar folder: sort, drag/reorder, create */}
      <ProjectsSection
        projects={projects}
        onSelectProject={onSelectProject}
        selectedProjectIds={selectedProjectIds}
        showCheckbox={true}
        sortOrder={sortOrder}
        onSortOrderChange={onSortOrderChange}
        showSortControl={true}
        showDropZone={false}
        onCreateProject={onCreateProject}
        isDragActive={isDragActive}
        draggedProjectIds={draggedProjectIds}
        orderedProjectIds={orderedProjectIds}
        layout={layout}
        multiSelectActive={selectedProjectIds.size > 1}
        onMoveSelectedToFolder={onMoveSelectedToFolder}
        onArchiveSelected={onArchiveSelected}
        onRestoreSelected={onRestoreSelected}
        onDeleteSelected={onDeleteSelected}
      />

      {/* Selection Action Bar */}
      <SelectionActionBar
        selectedProjectCount={selectedProjectIds.size}
        selectedFolderCount={0}
        onClear={onClearSelection}
        onMoveToFolder={onMoveSelectedToFolder}
        archivedSelectedCount={archivedSelectedCount}
        onDeleteSelected={onDeleteSelected}
      />
    </div>
  )
}
