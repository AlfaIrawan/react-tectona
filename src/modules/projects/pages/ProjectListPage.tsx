import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useProjectStore, useFolderStore } from '@/modules/projects'
import { useDisplayOrderStore } from '@/modules/projects/store/displayOrderStore'
import { arrayMove } from '@dnd-kit/sortable'
import { EmptyState } from '../components/EmptyState'
import { CreateProjectFlow } from '@/modules/projects'
import { CreateFolderModal } from '../components/CreateFolderModal'
import { ShareFolderModal } from '../components/ShareFolderModal'
import { DeleteFolderConfirmModal } from '../components/DeleteFolderConfirmModal'
import { DeleteProjectsConfirmModal } from '../components/DeleteProjectsConfirmModal'
import { RenameFolderModal } from '../components/RenameFolderModal'
import { SelectionActionBar } from '../components/SelectionActionBar'
import {
  FiltersBar,
  ALL_PROJECT_STATUS_FILTER_TAGS,
  ALL_PROJECT_TYPE_FILTER_TAGS,
  type ProjectStatusFilterTag,
  type ProjectTypeFilterTag,
  type SortOrder,
} from '../components/FiltersBar'
import { FoldersSection } from '../components/FoldersSection'
import { ProjectsSection } from '../components/ProjectsSection'
import { FolderView } from '../components/FolderView'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  EnterpriseViewControlButton,
  EnterpriseViewControlRail,
  EnterpriseViewControlSeparator,
} from '@/components/enterprise/EnterpriseViewControlRail'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { useSettingsPanelStore } from '@/stores/settings-panel-store'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import { Tooltip } from '@/components/ui/tooltip'
import { notifyEvent } from '@/lib/api/notificationApi'
import { FolderPlus, Plus, ListTodo, StickyNote, Filter, EyeOff, LayoutGrid, List, Folder as FolderIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Folder, Project } from '@/modules/projects'
import { ProjectsErrorBoundary } from '../components/ProjectsErrorBoundary'

export function ProjectListPage() {
  const {
    projects,
    searchProjects,
    fetchProjects,
    projectsLoading,
    projectsError,
    moveProjectToFolder,
    moveProjectsToFolder,
    archiveProjects,
    restoreProjects,
    deleteProjects,
    getProjectsByFolder,
  } = useProjectStore()
  const { folders, getFolder, fetchFolders, addFolder } = useFolderStore()
  const {
    rootProjectOrder,
    folderOrder,
    projectOrderByFolder,
    getOrderedIds,
    setRootProjectOrder,
    setFolderOrder,
    setProjectOrderForFolder,
  } = useDisplayOrderStore()
  const { addToast } = useToast()
  const openTodoPanel = useSettingsPanelStore((s) => s.openTodoPanel)
  const navigate = useNavigate()

  // View state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [showFiltersPanel, setShowFiltersPanel] = useState(true)
  const [showFoldersSectionVisible, setShowFoldersSectionVisible] = useState(true)
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilterTags, setStatusFilterTags] = useState<Set<ProjectStatusFilterTag>>(
    () => new Set(ALL_PROJECT_STATUS_FILTER_TAGS)
  )
  const [typeFilterTags, setTypeFilterTags] = useState<Set<ProjectTypeFilterTag>>(
    () => new Set(ALL_PROJECT_TYPE_FILTER_TAGS)
  )
  const [sortOrder, setSortOrder] = useState<SortOrder>('name-asc')

  // Selection state
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set())
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)

  // Modal state
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false)
  const [createProjectFolderId, setCreateProjectFolderId] = useState<string | null>(null)
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false)
  const [shareFolder, setShareFolder] = useState<Folder | null>(null)
  const [deleteFolderData, setDeleteFolderData] = useState<{ folder: Folder; count: number } | null>(null)
  const [renameFolder, setRenameFolder] = useState<Folder | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([])
  const [isDeletingProjects, setIsDeletingProjects] = useState(false)

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null)

  // Context menu when right-clicking on empty area (not on folder/project card)
  const [backgroundContextMenu, setBackgroundContextMenu] = useState<{ x: number; y: number } | null>(null)
  // Context menu when right-clicking on search/filter panel
  const [panelContextMenu, setPanelContextMenu] = useState<{ x: number; y: number } | null>(null)
  
  // Get dragged project data for overlay
  const draggedProject = useMemo(() => {
    if (!activeId || !activeId.startsWith('project-')) return null
    const projectId = activeId.replace('project-', '')
    return projects.find(p => p.id === projectId) || null
  }, [activeId, projects])

  // Check if drag is active and get dragged project IDs
  const isDragActive = activeId !== null && activeId.startsWith('project-')
  const draggedProjectIds = useMemo(() => {
    if (!isDragActive) return new Set<string>()
    const draggedProjectId = activeId?.replace('project-', '') || ''
    
    // If we have multiple selection AND the dragged project is part of it, return all selected
    if (selectedProjectIds.size > 1 && selectedProjectIds.has(draggedProjectId)) {
      return selectedProjectIds
    }
    
    // Single drag - only the dragged project
    return new Set([draggedProjectId])
  }, [isDragActive, activeId, selectedProjectIds])

  // Get dragged projects count and list (if multiple selection)
  const draggedProjectsData = useMemo(() => {
    if (!activeId || !activeId.startsWith('project-')) {
      return { count: 0, projects: [] }
    }
    
    const draggedProjectId = activeId.replace('project-', '')
    
    // Check if we have multiple selection AND the dragged project is part of it
    if (selectedProjectIds.size > 1 && selectedProjectIds.has(draggedProjectId)) {
      // Get all selected projects
      const selectedProjects = Array.from(selectedProjectIds)
        .map(id => projects.find(p => p.id === id))
        .filter((p): p is Project => p !== undefined)
      
      return {
        count: selectedProjectIds.size,
        projects: selectedProjects.slice(0, 3) // Show max 3 in preview for stacked effect
      }
    }
    
    // Single drag - no multiple selection or dragged project not in selection
    return {
      count: 1,
      projects: draggedProject ? [draggedProject] : []
    }
  }, [activeId, selectedProjectIds, projects, draggedProject])

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  useEffect(() => {
    fetchProjects()
    fetchFolders() // Fetch folders on mount
  }, [fetchProjects, fetchFolders])

  // Keyboard shortcut: Esc to exit selection mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSelectionMode) {
        setSelectedProjectIds(new Set())
        setIsSelectionMode(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSelectionMode])

  // Get root projects (not in any folder)
  const rootProjects = useMemo(() => {
    return projects.filter((p) => !p.folderId)
  }, [projects])

  // Helper function to get project count for a folder
  const getProjectCount = useCallback((folderId: string) => {
    return getProjectsByFolder(folderId).length
  }, [getProjectsByFolder])

  // Filter folders with search
  const filteredFolders = useMemo(() => {
    if (!folders || folders.length === 0) return []
    let filtered = folders

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (folder) =>
          folder.name.toLowerCase().includes(lowerQuery) ||
          folder.description?.toLowerCase().includes(lowerQuery)
      )
    }

    return filtered
  }, [folders, searchQuery])

  // Filter projects with search and status
  const filteredProjects = useMemo(() => {
    if (!rootProjects || rootProjects.length === 0) return []
    let filtered = rootProjects

    // Apply status filter
    filtered = filtered.filter((p) => statusFilterTags.has(p.status))

    // Apply search
    if (searchQuery) {
      const searchResults = searchProjects(searchQuery)
      filtered = filtered.filter((p) =>
        searchResults.some((r) => r.id === p.id)
      )
    }

    return filtered
  }, [rootProjects, statusFilterTags, searchQuery, searchProjects])

  // Filter folder projects (saat di dalam folder) — logic sama dengan root
  const folderProjects = useMemo(() => {
    if (!currentFolderId) return []
    return getProjectsByFolder(currentFolderId)
  }, [currentFolderId, getProjectsByFolder])

  const filteredFolderProjects = useMemo(() => {
    if (folderProjects.length === 0) return []
    let filtered = folderProjects

    filtered = filtered.filter((p) => statusFilterTags.has(p.status))

    if (searchQuery) {
      const searchResults = searchProjects(searchQuery)
      filtered = filtered.filter((p) => searchResults.some((r) => r.id === p.id))
    }

    return filtered
  }, [folderProjects, statusFilterTags, searchQuery, searchProjects])

  // Urutan tampilan untuk reorder (root projects & folders)
  const orderedRootProjectIds = useMemo(
    () => getOrderedIds(filteredProjects.map((p) => p.id), rootProjectOrder),
    [filteredProjects, rootProjectOrder, getOrderedIds]
  )
  const orderedFolderIds = useMemo(
    () => getOrderedIds(filteredFolders.map((f) => f.id), folderOrder),
    [filteredFolders, folderOrder, getOrderedIds]
  )

  // Sync selection dengan daftar project di view saat ini: hapus dari selection project yang sudah tidak ada di view (mis. setelah di-move ke folder lain)
  const currentViewProjectIds = useMemo(() => {
    if (currentFolderId) return filteredFolderProjects.map((p) => p.id)
    return filteredProjects.map((p) => p.id)
  }, [currentFolderId, filteredFolderProjects, filteredProjects])

  useEffect(() => {
    if (selectedProjectIds.size === 0) return
    const currentSet = new Set(currentViewProjectIds)
    const stillSelected = Array.from(selectedProjectIds).filter((id) => currentSet.has(id))
    if (stillSelected.length === selectedProjectIds.size) return
    setSelectedProjectIds(new Set(stillSelected))
    if (stillSelected.length === 0) setIsSelectionMode(false)
  }, [currentViewProjectIds, selectedProjectIds])

  // Selection handlers: hanya satu tipe saja (folder saja ATAU project saja).
  // Tanpa Shift = single selection (hanya card yang diklik). Dengan Shift = multi-select (tambah/kurang dari selection).
  const handleSelectProject = useCallback((projectId: string, selected: boolean, shiftKey?: boolean) => {
    if (selected) {
      setSelectedFolderIds(new Set()) // clear folder agar hanya project yang terpilih
    }
    if (shiftKey) {
      // Multi-select: toggle project ini di selection
      setSelectedProjectIds((prev) => {
        const next = new Set(prev)
        if (selected) next.add(projectId)
        else next.delete(projectId)
        setIsSelectionMode(next.size > 0)
        return next
      })
    } else {
      // Single selection: tanpa Shift hanya card yang diklik yang terpilih (atau clear jika diklik lagi)
      if (selected) {
        setSelectedProjectIds(new Set([projectId]))
        setIsSelectionMode(true)
      } else {
        setSelectedProjectIds((prev) => {
          const next = new Set(prev)
          next.delete(projectId)
          setIsSelectionMode(next.size > 0)
          return next
        })
      }
    }
  }, [])

  const handleClearSelection = useCallback(() => {
    setSelectedProjectIds(new Set())
    setSelectedFolderIds(new Set())
    setIsSelectionMode(false)
  }, [])

  const selectedArchivedCount = useMemo(() => {
    return Array.from(selectedProjectIds).filter(
      (id) => projects.find((p) => p.id === id)?.status === 'archived'
    ).length
  }, [selectedProjectIds, projects])

  const handleSelectFolder = useCallback((folderId: string, selected: boolean) => {
    if (selected) {
      setSelectedProjectIds(new Set()) // clear project agar hanya folder yang terpilih
    }
    setSelectedFolderIds((prev) => {
      const next = new Set(prev)
      if (selected) {
        next.add(folderId)
      } else {
        next.delete(folderId)
      }
      setIsSelectionMode(next.size > 0)
      return next
    })
  }, [])

  const handleMoveSelectedToFolder = useCallback(
    async (folderId: string | null) => {
      if (selectedProjectIds.size === 0) return

      const projectIds = Array.from(selectedProjectIds)
      try {
        await moveProjectsToFolder(projectIds, folderId)
        addToast({
          title: 'Projects dipindahkan',
          description: `${projectIds.length} project telah dipindahkan.`,
          variant: 'success',
        })
        notifyEvent({
          type_code: 'project',
          title: 'Projects dipindahkan',
          body: `${projectIds.length} project telah dipindahkan.`,
        })
        handleClearSelection()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to move projects'
        addToast({
          title: 'Error',
          description: msg,
          variant: 'error',
        })
      }
    },
    [selectedProjectIds, moveProjectsToFolder, addToast, handleClearSelection]
  )

  const handleArchiveSelected = useCallback(
    async () => {
      if (selectedProjectIds.size === 0) return
      const projectIds = Array.from(selectedProjectIds)
      try {
        await archiveProjects(projectIds)
        addToast({
          title: 'Projects diarchive',
          description: `${projectIds.length} project telah diarchive.`,
          variant: 'success',
        })
        notifyEvent({
          type_code: 'project',
          title: 'Projects diarchive',
          body: `${projectIds.length} project telah diarchive.`,
        })
        handleClearSelection()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to archive projects'
        addToast({ title: 'Error', description: msg, variant: 'error' })
      }
    },
    [selectedProjectIds, archiveProjects, addToast, handleClearSelection]
  )

  const handleRestoreSelected = useCallback(
    async () => {
      if (selectedProjectIds.size === 0) return
      const projectIds = Array.from(selectedProjectIds)
      try {
        await restoreProjects(projectIds)
        addToast({
          title: 'Projects direstore',
          description: `${projectIds.length} project telah direstore.`,
          variant: 'success',
        })
        notifyEvent({
          type_code: 'project',
          title: 'Projects direstore',
          body: `${projectIds.length} project telah direstore.`,
        })
        handleClearSelection()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to restore projects'
        addToast({ title: 'Error', description: msg, variant: 'error' })
      }
    },
    [selectedProjectIds, restoreProjects, addToast, handleClearSelection]
  )

  const handleDeleteSelected = useCallback(() => {
      if (selectedProjectIds.size === 0) return
      const archivedIds = Array.from(selectedProjectIds).filter(
        (id) => projects.find((p) => p.id === id)?.status === 'archived'
      )
      if (archivedIds.length === 0) {
        addToast({
          title: 'Tidak ada project archived',
          description: 'Hanya project archived yang dapat dihapus.',
          variant: 'default',
        })
        return
      }
      setPendingDeleteIds(archivedIds)
      setDeleteConfirmOpen(true)
    },
    [selectedProjectIds, projects, addToast]
  )

  const closeDeleteConfirm = useCallback(() => {
    if (isDeletingProjects) return
    setDeleteConfirmOpen(false)
    setPendingDeleteIds([])
  }, [isDeletingProjects])

  const pendingDeleteProjects = useMemo(
    () =>
      pendingDeleteIds
        .map((id) => projects.find((p) => p.id === id))
        .filter((p): p is Project => p != null),
    [pendingDeleteIds, projects]
  )

  const confirmDeleteProjects = useCallback(
    async () => {
      if (pendingDeleteIds.length === 0) return
      setIsDeletingProjects(true)
      try {
        await deleteProjects(pendingDeleteIds)
        addToast({
          title: 'Projects dihapus',
          description: `${pendingDeleteIds.length} project telah dihapus.`,
          variant: 'success',
        })
        const deletedNames = pendingDeleteProjects.map((p) => p.name)
        notifyEvent({
          type_code: 'project',
          title: 'Projects dihapus',
          body:
            pendingDeleteIds.length === 1
              ? `Project "${deletedNames[0]}" telah dihapus.`
              : `${pendingDeleteIds.length} project telah dihapus.`,
        })
        setDeleteConfirmOpen(false)
        setPendingDeleteIds([])
        handleClearSelection()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to delete projects'
        addToast({ title: 'Error', description: msg, variant: 'error' })
      } finally {
        setIsDeletingProjects(false)
      }
    },
    [pendingDeleteIds, pendingDeleteProjects, deleteProjects, addToast, handleClearSelection]
  )

  // Drag handlers
  const handleDragStart = (event: { active: { id: string | number } }) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: { active: { id: string | number }; over: { id: string | number } | null }) => {
    const { active, over } = event

    if (!over) {
      setActiveId(null)
      return
    }

    const activeId = active.id as string
    const overId = over.id as string

    try {
      // Reorder projects (drop project on another project)
      if (activeId.startsWith('project-') && overId.startsWith('project-')) {
        const projectIdActive = activeId.replace('project-', '')
        const projectIdOver = overId.replace('project-', '')

        if (currentFolderId) {
          // Reorder inside folder
          const folderProjectIds = getProjectsByFolder(currentFolderId).map((p) => p.id)
          const savedOrder = projectOrderByFolder[currentFolderId] ?? []
          const orderedIds = getOrderedIds(folderProjectIds, savedOrder)
          const oldIndex = orderedIds.indexOf(projectIdActive)
          const newIndex = orderedIds.indexOf(projectIdOver)
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const next = arrayMove(orderedIds, oldIndex, newIndex)
            setProjectOrderForFolder(currentFolderId, next)
            addToast({
              title: 'Urutan diubah',
              description: 'Posisi project telah diperbarui.',
              variant: 'success',
            })
          }
        } else {
          // Reorder at root
          const oldIndex = orderedRootProjectIds.indexOf(projectIdActive)
          const newIndex = orderedRootProjectIds.indexOf(projectIdOver)
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const next = arrayMove(orderedRootProjectIds, oldIndex, newIndex)
            setRootProjectOrder(next)
            addToast({
              title: 'Urutan diubah',
              description: 'Posisi project telah diperbarui.',
              variant: 'success',
            })
          }
        }
        setActiveId(null)
        return
      }

      // Reorder folders (drop folder on another folder)
      if (activeId.startsWith('folder-') && overId.startsWith('folder-')) {
        const oldIndex = orderedFolderIds.indexOf(activeId.replace('folder-', ''))
        const newIndex = orderedFolderIds.indexOf(overId.replace('folder-', ''))
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const next = arrayMove(orderedFolderIds, oldIndex, newIndex)
          setFolderOrder(next)
          addToast({
            title: 'Urutan diubah',
            description: 'Posisi folder telah diperbarui.',
            variant: 'success',
          })
        }
        setActiveId(null)
        return
      }

      // Handle project dropped on folder
      if (activeId.startsWith('project-') && overId.startsWith('folder-')) {
        const projectId = activeId.replace('project-', '')
        const folderId = overId.replace('folder-', '')
        await moveProjectToFolder(projectId, folderId)
        addToast({
          title: 'Project dipindahkan',
          description: 'Project telah dipindahkan ke folder.',
          variant: 'success',
        })
        notifyEvent({
          type_code: 'project',
          title: 'Project dipindahkan',
          body: 'Project telah dipindahkan ke folder.',
        })
      }

      // Handle project dropped on "all-projects" zone (from board view or folder view)
      if (activeId.startsWith('project-') && (overId === 'all-projects' || overId === 'all-projects-from-folder')) {
        const projectId = activeId.replace('project-', '')
        await moveProjectToFolder(projectId, null)
        addToast({
          title: 'Project dipindahkan',
          description: 'Project telah dipindahkan ke All Projects.',
          variant: 'success',
        })
        notifyEvent({
          type_code: 'project',
          title: 'Project dipindahkan',
          body: 'Project telah dipindahkan ke All Projects.',
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to move project'
      addToast({
        title: 'Error',
        description: msg,
        variant: 'error',
      })
    }

    setActiveId(null)
  }

  const handleDragOver = (_event: { active: { id: string | number }; over: { id: string | number } | null }) => {
    // Visual feedback is handled by droppable components
  }

  // Klik di luar card/folder → clear selection bila ada yang terpilih
  const handleContentAreaClick = useCallback(
    (e: React.MouseEvent) => {
      if (selectedProjectIds.size === 0 && selectedFolderIds.size === 0) return
      const target = e.target as HTMLElement
      if (
        target.closest('[data-folder-id]') ||
        target.closest('[data-project-card]') ||
        target.closest('button, a, input, select, [role="button"], [role="menuitem"], [data-radix-ui-collection-item]')
      ) {
        return
      }
      handleClearSelection()
    },
    [selectedProjectIds.size, selectedFolderIds.size, handleClearSelection]
  )

  // Right-click on empty area → show context menu (New Folder, Create Project, Add Todo, Add Notes)
  const handleContentAreaContextMenu = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('[data-filters-panel]')) return
    if (
      target.closest('[data-folder-id]') ||
      target.closest('[data-project-card]') ||
      target.closest('button, a, input, select, [role="button"], [role="menuitem"], [data-radix-ui-collection-item]')
    ) {
      return
    }
    e.preventDefault()
    setBackgroundContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  // Enter saat project terpilih → buka detail project (yang pertama jika banyak)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || selectedProjectIds.size === 0) return
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable="true"]')) return
      e.preventDefault()
      const firstId = Array.from(selectedProjectIds)[0]
      navigate(`/projects/${firstId}`)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedProjectIds, navigate])

  // Folder handlers
  const handleOpenFolder = (folderId: string) => {
    setCurrentFolderId(folderId)
    handleClearSelection()
  }

  const handleBackToRoot = () => {
    setCurrentFolderId(null)
    handleClearSelection()
  }

  const handleCreateFolderWithDefaultName = useCallback(async () => {
    const usedNumbers = folders
      .filter((f) => /^Untitled \d+$/.test(f.name))
      .map((f) => parseInt(f.name.replace('Untitled ', ''), 10))
    const nextNum = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1
    const defaultName = `Untitled ${nextNum}`
    try {
      await addFolder({
        name: defaultName,
        parentId: null,
        ownerId: '00000000-0000-0000-0000-000000000001',
      })
      addToast({
        title: 'Folder dibuat',
        description: `"${defaultName}" telah dibuat. Bisa rename via klik kanan.`,
        variant: 'success',
      })
      notifyEvent({
        type_code: 'folder',
        title: 'Folder dibuat',
        body: `"${defaultName}" telah dibuat. Bisa rename via klik kanan.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat folder'
      addToast({ title: 'Error', description: msg, variant: 'error' })
    }
  }, [folders, addFolder, addToast])

  const handleShareFolder = (folder: Folder) => {
    setShareFolder(folder)
  }

  const handleDeleteFolder = (folder: Folder) => {
    const count = getProjectsByFolder(folder.id).length
    setDeleteFolderData({ folder, count })
  }

  const deleteProjectsConfirmModal = (
    <DeleteProjectsConfirmModal
      open={deleteConfirmOpen}
      onClose={closeDeleteConfirm}
      onConfirm={() => void confirmDeleteProjects()}
      busy={isDeletingProjects}
      projects={pendingDeleteProjects}
    />
  )

  // If viewing a folder, show FolderView
  if (currentFolderId) {
    const folder = getFolder(currentFolderId)
    if (!folder) {
      handleBackToRoot()
      return null
    }
    const orderedFolderProjectIds = getOrderedIds(
      filteredFolderProjects.map((p) => p.id),
      projectOrderByFolder[folder.id] ?? []
    )
    const folderProjectsAll = folderProjects
    const folderActiveCount = folderProjectsAll.filter((p) => p.status === 'active').length
    const folderArchivedCount = folderProjectsAll.filter((p) => p.status === 'archived').length

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
        <div onClick={handleContentAreaClick} onContextMenu={handleContentAreaContextMenu} className="min-h-[200px]">
          <FolderView
            folder={folder}
            onBack={handleBackToRoot}
            onShare={handleShareFolder}
            onRename={(f) => setRenameFolder(f)}
            selectedProjectIds={selectedProjectIds}
            onSelectProject={handleSelectProject}
            onMoveSelectedToFolder={handleMoveSelectedToFolder}
            onClearSelection={handleClearSelection}
            onArchiveSelected={handleArchiveSelected}
            onRestoreSelected={handleRestoreSelected}
            onDeleteSelected={handleDeleteSelected}
            archivedSelectedCount={selectedArchivedCount}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            isDragActive={isDragActive}
            draggedProjectIds={draggedProjectIds}
            orderedProjectIds={orderedFolderProjectIds}
            onCreateProject={() => {
              setCreateProjectFolderId(folder.id)
              setIsCreateProjectModalOpen(true)
            }}
            layout={layout}
            showFiltersPanel={showFiltersPanel}
            onShowFiltersPanelChange={(v) => setShowFiltersPanel(v)}
            onLayoutChange={(l) => setLayout(l)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilterTags={statusFilterTags}
            onStatusFilterTagsChange={setStatusFilterTags}
            projects={filteredFolderProjects}
            totalProjects={folderProjectsAll.length}
            activeProjects={folderActiveCount}
            archivedProjects={folderArchivedCount}
            selectionBar={
              isSelectionMode ? (
                <SelectionActionBar
                  inline
                  selectedProjectCount={selectedProjectIds.size}
                  selectedFolderCount={0}
                  onClear={handleClearSelection}
                  onMoveToFolder={handleMoveSelectedToFolder}
                  archivedSelectedCount={selectedArchivedCount}
                  onDeleteSelected={handleDeleteSelected}
                />
              ) : undefined
            }
          />
        </div>
        {backgroundContextMenu && (
          <ContextMenu
            open={!!backgroundContextMenu}
            x={backgroundContextMenu.x}
            y={backgroundContextMenu.y}
            onClose={() => setBackgroundContextMenu(null)}
          >
            <ContextMenuItem onClick={() => { handleCreateFolderWithDefaultName(); setBackgroundContextMenu(null); }}>
              <FolderPlus className="w-4 h-4 mr-2" />
              New Folder
            </ContextMenuItem>
            <ContextMenuItem onClick={() => { setCreateProjectFolderId(null); setIsCreateProjectModalOpen(true); setBackgroundContextMenu(null); }}>
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </ContextMenuItem>
            <ContextMenuItem onClick={() => { openTodoPanel(); setBackgroundContextMenu(null); }}>
              <ListTodo className="w-4 h-4 mr-2" />
              Add Todo
            </ContextMenuItem>
            <ContextMenuItem onClick={() => { addToast({ title: 'Add Notes', description: 'Fitur akan segera hadir.', variant: 'default' }); setBackgroundContextMenu(null); }}>
              <StickyNote className="w-4 h-4 mr-2" />
              Add Notes
            </ContextMenuItem>
          </ContextMenu>
        )}
        {createPortal(
          <DragOverlay>
            {draggedProject && draggedProjectsData.count > 0 ? (
              <div className="relative">
                <div style={{ transform: 'rotate(2deg)' }}>
                {/* Stacked cards effect for multiple selection */}
                {draggedProjectsData.count > 1 ? (
                  <div className="relative" style={{ width: '320px', minHeight: '140px', paddingBottom: `${Math.min(draggedProjectsData.projects.length - 1, 2) * 20}px` }}>
                    {/* Background cards (stacked effect) - show cards behind main card */}
                    {draggedProjectsData.projects.length > 1 && draggedProjectsData.projects.slice(1, Math.min(3, draggedProjectsData.projects.length)).map((project, index) => (
                      <div
                        key={project.id}
                        className="glass-card rounded-xl p-3 absolute"
                        style={{
                          top: `${(index + 1) * 20}px`,
                          left: `${(index + 1) * 20}px`,
                          width: '280px',
                          transform: `scale(${1 - (index + 1) * 0.12})`,
                          zIndex: 15 - (index + 1),
                          border: '2px solid rgba(59, 130, 246, 0.6)',
                          background: 'rgba(255, 255, 255, 0.98)',
                          boxShadow: '0 15px 35px rgba(0, 0, 0, 0.25)',
                          opacity: 0.85 - (index * 0.1),
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-primary/40 flex-shrink-0" />
                          <span className="text-sm font-semibold text-foreground truncate">
                            {project.name}
                          </span>
                        </div>
                      </div>
                    ))}
                    {/* Main card - always show first project from selection */}
                    <div 
                      className="glass-card rounded-xl p-4 scale-110 shadow-2xl border-2 border-primary relative"
                      style={{
                        boxShadow: '0 25px 70px rgba(0, 0, 0, 0.35), 0 0 0 4px rgba(59, 130, 246, 0.4)',
                        zIndex: 20,
                        background: 'rgba(255, 255, 255, 1)',
                      }}
                    >
                      {/* Badge showing count */}
                      <div className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-primary border-3 border-white flex items-center justify-center shadow-xl z-30">
                        <span className="text-base font-bold text-white">{draggedProjectsData.count}</span>
                      </div>
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <div className="p-1.5 rounded-lg bg-primary/10 flex-shrink-0">
                          <div className="w-4 h-4 bg-primary/20 rounded" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-bold text-foreground mb-1">
                            {draggedProjectsData.count} projects
                          </h3>
                          <p className="text-xs text-muted-foreground font-medium">
                            {draggedProjectsData.projects[0]?.name || draggedProject.name}
                            {draggedProjectsData.count > 1 && ` + ${draggedProjectsData.count - 1} more`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Single card */
                  <div 
                    className="glass-card rounded-xl p-4 opacity-95 scale-105 shadow-2xl border-2 border-primary/30"
                    style={{
                      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 2px rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <div className="p-1.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <div className="w-4 h-4 bg-primary/20 rounded" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-foreground mb-1 truncate">
                          {draggedProject.name}
                        </h3>
                        {draggedProject.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {draggedProject.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
          </DragOverlay>,
          document.body
        )}

        {/* Modals — harus ada di folder view agar Create Project berfungsi */}
        <CreateProjectFlow
          open={isCreateProjectModalOpen}
          onOpenChange={(open) => {
            setIsCreateProjectModalOpen(open)
            if (!open) setCreateProjectFolderId(null)
          }}
          initialFolderId={createProjectFolderId}
          autoNavigate={true}
        />
        <CreateFolderModal
          open={isCreateFolderModalOpen}
          onOpenChange={setIsCreateFolderModalOpen}
        />
        {shareFolder && (
          <ShareFolderModal
            open={!!shareFolder}
            onOpenChange={(open) => !open && setShareFolder(null)}
            folder={shareFolder}
          />
        )}
        {deleteFolderData && (
          <DeleteFolderConfirmModal
            open={!!deleteFolderData}
            onOpenChange={(open) => !open && setDeleteFolderData(null)}
            folder={deleteFolderData.folder}
            projectCount={deleteFolderData.count}
          />
        )}
        {renameFolder && (
          <RenameFolderModal
            open={!!renameFolder}
            onOpenChange={(open) => !open && setRenameFolder(null)}
            folder={renameFolder}
          />
        )}
        {deleteProjectsConfirmModal}
      </DndContext>
    )
  }

  // Main Projects Board View
  const activeProjects = projects.filter((p) => p.status === 'active')
  const archivedProjects = projects.filter((p) => p.status === 'archived')

  // Determine which sections to show based on typeFilter
  const showFoldersSection = typeFilterTags.has('folders')
  const showProjectsSection = typeFilterTags.has('projects')

  const showSortInFolders = typeFilterTags.has('folders')
  const showSortInProjects = typeFilterTags.has('projects')

  return (
    <ProjectsErrorBoundary>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
        <div className="space-y-6" onClick={handleContentAreaClick} onContextMenu={handleContentAreaContextMenu}>
        {/* Breadcrumb */}
        <Breadcrumb items={[{ label: 'Projects' }]} />

        {/* Header */}
        <PageHeader
          title="Projects"
          description="Projects are workspaces for managing AI training pipelines, experiments, and models. Create folders, organize projects, and track status from a single place."
          right={
            <EnterpriseViewControlRail className="flex-nowrap shrink-0">
              <Tooltip content={showFoldersSectionVisible ? 'Hide Folders section' : 'Show Folders section'} side="bottom">
                <EnterpriseViewControlButton
                  active={showFoldersSectionVisible}
                  onClick={() => setShowFoldersSectionVisible((v) => !v)}
                  aria-label={showFoldersSectionVisible ? 'Hide Folders section' : 'Show Folders section'}
                >
                  <FolderIcon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </EnterpriseViewControlButton>
              </Tooltip>
              <EnterpriseViewControlSeparator />
              <Tooltip content={layout === 'grid' ? 'Show as list' : 'Show as grid'} side="bottom">
                <EnterpriseViewControlButton
                  active={layout === 'grid'}
                  onClick={() => setLayout((v) => (v === 'grid' ? 'list' : 'grid'))}
                  aria-label={layout === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
                >
                  {layout === 'grid' ? (
                    <List className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  ) : (
                    <LayoutGrid className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  )}
                </EnterpriseViewControlButton>
              </Tooltip>
              <EnterpriseViewControlSeparator />
              <Tooltip content={showFiltersPanel ? 'Hide search & filter panel' : 'Show search & filter panel'} side="bottom">
                <EnterpriseViewControlButton
                  active={showFiltersPanel}
                  onClick={() => setShowFiltersPanel((v) => !v)}
                  aria-label={showFiltersPanel ? 'Hide panel' : 'Show panel'}
                >
                  <Filter className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </EnterpriseViewControlButton>
              </Tooltip>
            </EnterpriseViewControlRail>
          }
        />

        {/* Search and Filters - Single Panel */}
        {showFiltersPanel && (
        <div
          data-filters-panel
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setPanelContextMenu({ x: e.clientX, y: e.clientY })
          }}
        >
          <FiltersBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilterTags={statusFilterTags}
            onStatusFilterTagsChange={setStatusFilterTags}
            typeFilterTags={typeFilterTags}
            onTypeFilterTagsChange={setTypeFilterTags}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            totalProjects={projects.length}
            activeProjects={activeProjects.length}
            archivedProjects={archivedProjects.length}
            totalFolders={folders.length}
            onCreateFolder={handleCreateFolderWithDefaultName}
            onCreateProject={() => {
              setCreateProjectFolderId(null)
              setIsCreateProjectModalOpen(true)
            }}
            selectionBar={
              isSelectionMode ? (
                <SelectionActionBar
                  inline
                  selectedProjectCount={selectedProjectIds.size}
                  selectedFolderCount={selectedFolderIds.size}
                  onClear={handleClearSelection}
                  onMoveToFolder={handleMoveSelectedToFolder}
                  archivedSelectedCount={selectedArchivedCount}
                  onDeleteSelected={handleDeleteSelected}
                />
              ) : null
            }
          />
        </div>
        )}

        {/* Loading/Error States */}
        {projectsLoading ? (
          <div className="glass-card rounded-2xl p-12 text-center text-muted-foreground">
            Loading projects…
          </div>
        ) : projectsError ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <p className="text-destructive mb-4">{projectsError}</p>
            <Button onClick={() => fetchProjects()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Folders Section */}
            {showFoldersSection && showFoldersSectionVisible && Array.isArray(filteredFolders) && (
              <FoldersSection
                folders={filteredFolders}
                getProjectCount={getProjectCount}
                onOpenFolder={handleOpenFolder}
                onShareFolder={handleShareFolder}
                onDeleteFolder={handleDeleteFolder}
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
                showSortControl={showSortInFolders}
                selectedFolderIds={selectedFolderIds}
                onSelectFolder={handleSelectFolder}
                orderedFolderIds={orderedFolderIds}
                onRenameFolder={(folder) => setRenameFolder(folder)}
                onAddProject={(folder) => {
                  setCreateProjectFolderId(folder.id)
                  setIsCreateProjectModalOpen(true)
                }}
                layout={layout}
              />
            )}

            {/* Projects Section */}
            {showProjectsSection && Array.isArray(filteredProjects) && (
              <ProjectsSection
                projects={filteredProjects}
                onSelectProject={handleSelectProject}
                selectedProjectIds={selectedProjectIds}
                showCheckbox={isSelectionMode}
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
                showSortControl={showSortInProjects}
                showDropZone={false} // Only show in folder view
                onCreateProject={() => {
                  setCreateProjectFolderId(null)
                  setIsCreateProjectModalOpen(true)
                }}
                isDragActive={isDragActive}
                draggedProjectIds={draggedProjectIds}
                orderedProjectIds={orderedRootProjectIds}
                layout={layout}
                multiSelectActive={selectedProjectIds.size + selectedFolderIds.size > 1}
                onMoveSelectedToFolder={handleMoveSelectedToFolder}
                onArchiveSelected={handleArchiveSelected}
                onRestoreSelected={handleRestoreSelected}
                onDeleteSelected={handleDeleteSelected}
              />
            )}

            {/* Empty State for both sections */}
            {!showFoldersSection && !showProjectsSection && (
              <div className="glass-card rounded-2xl p-12">
                <EmptyState
                  title="No items found"
                  description="Try adjusting your search or filter criteria."
                />
              </div>
            )}
          </div>
        )}

        {/* Modals */}
        <CreateProjectFlow
          open={isCreateProjectModalOpen}
          onOpenChange={(open) => {
            setIsCreateProjectModalOpen(open)
            if (!open) setCreateProjectFolderId(null)
          }}
          initialFolderId={createProjectFolderId}
          autoNavigate={true}
        />
        <CreateFolderModal
          open={isCreateFolderModalOpen}
          onOpenChange={setIsCreateFolderModalOpen}
        />
        {shareFolder && (
          <ShareFolderModal
            open={!!shareFolder}
            onOpenChange={(open) => !open && setShareFolder(null)}
            folder={shareFolder}
          />
        )}
        {deleteFolderData && (
          <DeleteFolderConfirmModal
            open={!!deleteFolderData}
            onOpenChange={(open) => !open && setDeleteFolderData(null)}
            folder={deleteFolderData.folder}
            projectCount={deleteFolderData.count}
          />
        )}
        {renameFolder && (
          <RenameFolderModal
            open={!!renameFolder}
            onOpenChange={(open) => !open && setRenameFolder(null)}
            folder={renameFolder}
          />
        )}
        {deleteProjectsConfirmModal}

        {panelContextMenu && (
          <ContextMenu
            open={!!panelContextMenu}
            x={panelContextMenu.x}
            y={panelContextMenu.y}
            onClose={() => setPanelContextMenu(null)}
          >
            <ContextMenuItem
              onClick={() => {
                setShowFiltersPanel(false)
                setPanelContextMenu(null)
              }}
            >
              <EyeOff className="w-4 h-4 mr-2" />
              Hide Search and Filter
            </ContextMenuItem>
          </ContextMenu>
        )}
        {backgroundContextMenu && (
          <ContextMenu
            open={!!backgroundContextMenu}
            x={backgroundContextMenu.x}
            y={backgroundContextMenu.y}
            onClose={() => setBackgroundContextMenu(null)}
          >
            <ContextMenuItem onClick={() => { handleCreateFolderWithDefaultName(); setBackgroundContextMenu(null); }}>
              <FolderPlus className="w-4 h-4 mr-2" />
              New Folder
            </ContextMenuItem>
            <ContextMenuItem onClick={() => { setCreateProjectFolderId(null); setIsCreateProjectModalOpen(true); setBackgroundContextMenu(null); }}>
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </ContextMenuItem>
            <ContextMenuItem onClick={() => { openTodoPanel(); setBackgroundContextMenu(null); }}>
              <ListTodo className="w-4 h-4 mr-2" />
              Add Todo
            </ContextMenuItem>
            <ContextMenuItem onClick={() => { addToast({ title: 'Add Notes', description: 'Fitur akan segera hadir.', variant: 'default' }); setBackgroundContextMenu(null); }}>
              <StickyNote className="w-4 h-4 mr-2" />
              Add Notes
            </ContextMenuItem>
          </ContextMenu>
        )}

        {createPortal(
          <DragOverlay>
            {draggedProject && draggedProjectsData.count > 0 ? (
              <div className="relative">
                <div style={{ transform: 'rotate(2deg)' }}>
                {/* Stacked cards effect for multiple selection */}
                {draggedProjectsData.count > 1 ? (
                  <div className="relative" style={{ width: '320px', minHeight: '140px', paddingBottom: `${Math.min(draggedProjectsData.projects.length - 1, 2) * 20}px` }}>
                    {/* Background cards (stacked effect) - show cards behind main card */}
                    {draggedProjectsData.projects.length > 1 && draggedProjectsData.projects.slice(1, Math.min(3, draggedProjectsData.projects.length)).map((project, index) => (
                      <div
                        key={project.id}
                        className="glass-card rounded-xl p-3 absolute"
                        style={{
                          top: `${(index + 1) * 20}px`,
                          left: `${(index + 1) * 20}px`,
                          width: '280px',
                          transform: `scale(${1 - (index + 1) * 0.12})`,
                          zIndex: 15 - (index + 1),
                          border: '2px solid rgba(59, 130, 246, 0.6)',
                          background: 'rgba(255, 255, 255, 0.98)',
                          boxShadow: '0 15px 35px rgba(0, 0, 0, 0.25)',
                          opacity: 0.85 - (index * 0.1),
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-primary/40 flex-shrink-0" />
                          <span className="text-sm font-semibold text-foreground truncate">
                            {project.name}
                          </span>
                        </div>
                      </div>
                    ))}
                    {/* Main card - always show first project from selection */}
                    <div 
                      className="glass-card rounded-xl p-4 scale-110 shadow-2xl border-2 border-primary relative"
                      style={{
                        boxShadow: '0 25px 70px rgba(0, 0, 0, 0.35), 0 0 0 4px rgba(59, 130, 246, 0.4)',
                        zIndex: 20,
                        background: 'rgba(255, 255, 255, 1)',
                      }}
                    >
                      {/* Badge showing count */}
                      <div className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-primary border-3 border-white flex items-center justify-center shadow-xl z-30">
                        <span className="text-base font-bold text-white">{draggedProjectsData.count}</span>
                      </div>
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <div className="p-1.5 rounded-lg bg-primary/10 flex-shrink-0">
                          <div className="w-4 h-4 bg-primary/20 rounded" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-bold text-foreground mb-1">
                            {draggedProjectsData.count} projects
                          </h3>
                          <p className="text-xs text-muted-foreground font-medium">
                            {draggedProjectsData.projects[0]?.name || draggedProject.name}
                            {draggedProjectsData.count > 1 && ` + ${draggedProjectsData.count - 1} more`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Single card */
                  <div 
                    className="glass-card rounded-xl p-4 opacity-95 scale-105 shadow-2xl border-2 border-primary/30"
                    style={{
                      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 2px rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <div className="p-1.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <div className="w-4 h-4 bg-primary/20 rounded" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-foreground mb-1 truncate">
                          {draggedProject.name}
                        </h3>
                        {draggedProject.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {draggedProject.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
          </DragOverlay>,
          document.body
        )}
        </div>
      </DndContext>
    </ProjectsErrorBoundary>
  )
}
