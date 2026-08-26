import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { TECTONA_TENANT_CHANGED_EVENT } from '@/lib/tenantEvents'
import { useTenantContext } from '@/auth/TenantContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  DndContext,
  pointerWithin,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useProjectStore, useFolderStore } from '@/modules/projects'
import { useDisplayOrderStore } from '@/modules/projects/store/displayOrderStore'
import { arrayMove } from '@dnd-kit/sortable'
import { EmptyState } from '../components/EmptyState'
import { CreateProjectFlow } from '@/modules/projects'
import { CreateFolderModal } from '../components/CreateFolderModal'
import { AddFolderMembersDrawer } from '../components/AddFolderMembersDrawer'
import { DeleteFolderConfirmModal } from '../components/DeleteFolderConfirmModal'
import { FolderNotesDrawer } from '../components/FolderNotesDrawer'
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
import { ProjectsFoldersListTable } from '../components/ProjectsFoldersListTable'
import { FolderView } from '../components/FolderView'
import { ProjectDragLayer } from '../components/ProjectDragLayer'
import { PlatformDataLoadingState } from '@/components/loading'
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
import { FolderPlus, Plus, ListTodo, StickyNote, Filter, EyeOff, LayoutGrid, List, Folder as FolderIcon, ClipboardPaste } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Folder, Project } from '@/modules/projects'
import { applyOrderedGridSelection, type GridSelectionModifiers } from '../lib/gridSelection'
import { copyFolderToClipboard, isEditableKeyboardTarget, canMoveFolderToTarget } from '../lib/folderActions'
import { hasFolderClipboard } from '../lib/folderClipboard'
import { buildFolderAncestorChain, filterFoldersByParent, resolveChildFolderCount } from '../lib/folderHierarchy'

function isNestDropId(id: string) {
  return id.startsWith('folder-nest-')
}

function isProjectDropId(id: string) {
  return id.startsWith('folder-drop-')
}

function parseNestDropId(id: string) {
  return id.replace('folder-nest-', '')
}

function parseProjectDropId(id: string) {
  return id.replace('folder-drop-', '')
}

function createFolderDropCollisionDetection(folders: Folder[]): CollisionDetection {
  return (args) => {
    const activeId = String(args.active.id)

    if (activeId.startsWith('project-')) {
      const collisions = pointerWithin(args)
      const dropHits = collisions.filter((collision) => isProjectDropId(String(collision.id)))
      if (dropHits.length > 0) return dropHits
      return collisions
    }

    if (activeId.startsWith('folder-')) {
      const sourceId = activeId.replace('folder-', '')
      const pointerCollisions = pointerWithin(args)
      const nestHits = pointerCollisions.filter((collision) => {
        const id = String(collision.id)
        if (!isNestDropId(id)) return false
        const targetId = parseNestDropId(id)
        return (
          sourceId !== targetId &&
          canMoveFolderToTarget(sourceId, targetId, folders)
        )
      })
      if (nestHits.length > 0) return nestHits

      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((container) => {
          const id = String(container.id)
          return !isProjectDropId(id) && !isNestDropId(id)
        }),
      })
    }

    return pointerWithin(args)
  }
}

export function ProjectListPage() {
  const { workspaceId, loading: tenantLoading } = useTenantContext()
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
  const { folders, getFolder, fetchFolders, addFolder, pasteFolderFromClipboard, moveFolderToParent } = useFolderStore()
  const {
    rootProjectOrder,
    folderOrder,
    folderOrderByParent,
    projectOrderByFolder,
    getOrderedIds,
    setRootProjectOrder,
    setFolderOrder,
    setFolderOrderForParent,
    setProjectOrderForFolder,
  } = useDisplayOrderStore()
  const { addToast } = useToast()
  const openTodoPanel = useSettingsPanelStore((s) => s.openTodoPanel)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

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
  const lastFolderAnchorRef = useRef<string | null>(null)
  const lastProjectAnchorRef = useRef<string | null>(null)

  // Modal state
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false)
  const [createProjectFolderId, setCreateProjectFolderId] = useState<string | null>(null)
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false)
  const [shareFolder, setShareFolder] = useState<Folder | null>(null)
  const [deleteFolderData, setDeleteFolderData] = useState<{
    folders: Folder[]
    totalProjectCount: number
  } | null>(null)
  const [renameFolder, setRenameFolder] = useState<Folder | null>(null)
  const [folderNotesTarget, setFolderNotesTarget] = useState<Folder | null>(null)
  const [folderNotesAutoCompose, setFolderNotesAutoCompose] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([])
  const [isDeletingProjects, setIsDeletingProjects] = useState(false)

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null)
  const [dropTargetFolderName, setDropTargetFolderName] = useState<string | null>(null)
  const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null)

  const folderDropCollisionDetection = useMemo(
    () => createFolderDropCollisionDetection(folders),
    [folders],
  )

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
  const isProjectDragActive = activeId !== null && activeId.startsWith('project-')
  const isAnyItemDragActive = isProjectDragActive || (activeId !== null && activeId.startsWith('folder-'))

  useEffect(() => {
    if (!isAnyItemDragActive) {
      setDragPointer(null)
      setDropTargetFolderId(null)
      setDropTargetFolderName(null)
      return
    }
    const onPointerMove = (event: PointerEvent) => {
      setDragPointer({ x: event.clientX, y: event.clientY })
    }
    window.addEventListener('pointermove', onPointerMove)
    return () => window.removeEventListener('pointermove', onPointerMove)
  }, [isAnyItemDragActive])

  const draggedProjectIds = useMemo(() => {
    if (!isProjectDragActive) return new Set<string>()
    const draggedProjectId = activeId?.replace('project-', '') || ''
    
    // If we have multiple selection AND the dragged project is part of it, return all selected
    if (selectedProjectIds.size > 1 && selectedProjectIds.has(draggedProjectId)) {
      return selectedProjectIds
    }
    
    // Single drag - only the dragged project
    return new Set([draggedProjectId])
  }, [isProjectDragActive, activeId, selectedProjectIds])

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
    if (tenantLoading) return
    fetchProjects()
    fetchFolders()
  }, [fetchProjects, fetchFolders, tenantLoading, workspaceId])

  useEffect(() => {
    const onTenantChanged = () => {
      fetchProjects()
      fetchFolders()
    }
    window.addEventListener(TECTONA_TENANT_CHANGED_EVENT, onTenantChanged)
    return () => window.removeEventListener(TECTONA_TENANT_CHANGED_EVENT, onTenantChanged)
  }, [fetchProjects, fetchFolders])

  useEffect(() => {
    if (!currentFolderId) return
    void fetchFolders(undefined, currentFolderId)
  }, [currentFolderId, fetchFolders])

  useEffect(() => {
    const folderParam = searchParams.get('folder')
    if (folderParam) {
      if (getFolder(folderParam)) {
        setCurrentFolderId(folderParam)
      } else if (folders.length > 0) {
        setCurrentFolderId(null)
        setSearchParams({}, { replace: true })
      }
      return
    }
    setCurrentFolderId(null)
  }, [searchParams, folders, getFolder])

  // Keyboard shortcut: Esc to exit selection mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSelectionMode) {
        setSelectedProjectIds(new Set())
        setSelectedFolderIds(new Set())
        lastFolderAnchorRef.current = null
        lastProjectAnchorRef.current = null
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

  const getChildFolderCount = useCallback(
    (folderId: string) => {
      const folder = getFolder(folderId)
      return folder
        ? resolveChildFolderCount(folder, folders)
        : filterFoldersByParent(folders, folderId).length
    },
    [folders, getFolder],
  )

  const currentParentId = currentFolderId ?? null

  // Filter folders for the current level (root or inside a folder)
  const filteredFolders = useMemo(() => {
    if (!folders || folders.length === 0) return []
    let filtered = filterFoldersByParent(folders, currentParentId)

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (folder) =>
          folder.name.toLowerCase().includes(lowerQuery) ||
          folder.description?.toLowerCase().includes(lowerQuery),
      )
    }

    return filtered
  }, [folders, currentParentId, searchQuery])

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
  const folderOrderParentKey = currentParentId ?? '__root__'
  const orderedFolderIds = useMemo(() => {
    const ids = filteredFolders.map((f) => f.id)
    const savedOrder = folderOrderByParent[folderOrderParentKey] ?? folderOrder
    return getOrderedIds(ids, savedOrder)
  }, [filteredFolders, folderOrder, folderOrderByParent, folderOrderParentKey, getOrderedIds])

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

  // Selection handlers: plain click = single; Ctrl/Cmd = toggle; Shift = range in display order.
  const handleSelectProject = useCallback(
    (projectId: string, modifiers: GridSelectionModifiers) => {
      setSelectedFolderIds(new Set())
      lastFolderAnchorRef.current = null
      const orderedIds = currentFolderId
        ? getOrderedIds(filteredFolderProjects.map((p) => p.id), projectOrderByFolder[currentFolderId] ?? [])
        : orderedRootProjectIds

      setSelectedProjectIds((prev) => {
        const result = applyOrderedGridSelection(
          projectId,
          orderedIds,
          prev,
          lastProjectAnchorRef.current,
          modifiers,
        )
        lastProjectAnchorRef.current = result.anchorId
        setIsSelectionMode(result.isSelectionMode)
        return result.next
      })
    },
    [
      currentFolderId,
      filteredFolderProjects,
      projectOrderByFolder,
      orderedRootProjectIds,
      getOrderedIds,
    ],
  )

  const handleClearSelection = useCallback(() => {
    setSelectedProjectIds(new Set())
    setSelectedFolderIds(new Set())
    lastFolderAnchorRef.current = null
    lastProjectAnchorRef.current = null
    setIsSelectionMode(false)
  }, [])

  const handleSelectFoldersBulk = useCallback((folderIds: string[]) => {
    setSelectedProjectIds(new Set())
    lastProjectAnchorRef.current = null
    setSelectedFolderIds(new Set(folderIds))
    lastFolderAnchorRef.current = folderIds[0] ?? null
    setIsSelectionMode(folderIds.length > 0)
  }, [])

  const handleSelectProjectsBulk = useCallback((projectIds: string[]) => {
    setSelectedFolderIds(new Set())
    lastFolderAnchorRef.current = null
    setSelectedProjectIds(new Set(projectIds))
    lastProjectAnchorRef.current = projectIds[0] ?? null
    setIsSelectionMode(projectIds.length > 0)
  }, [])

  const selectedArchivedCount = useMemo(() => {
    return Array.from(selectedProjectIds).filter(
      (id) => projects.find((p) => p.id === id)?.status === 'archived'
    ).length
  }, [selectedProjectIds, projects])

  const handleSelectFolder = useCallback(
    (folderId: string, modifiers: GridSelectionModifiers) => {
      setSelectedProjectIds(new Set())
      lastProjectAnchorRef.current = null
      setSelectedFolderIds((prev) => {
        const result = applyOrderedGridSelection(
          folderId,
          orderedFolderIds,
          prev,
          lastFolderAnchorRef.current,
          modifiers,
        )
        lastFolderAnchorRef.current = result.anchorId
        setIsSelectionMode(result.isSelectionMode)
        return result.next
      })
    },
    [orderedFolderIds],
  )

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
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
    const activator = event.activatorEvent
    if (activator && 'clientX' in activator && 'clientY' in activator) {
      setDragPointer({
        x: (activator as PointerEvent).clientX,
        y: (activator as PointerEvent).clientY,
      })
    }
  }

  const clearDragState = () => {
    setActiveId(null)
    setDropTargetFolderId(null)
    setDropTargetFolderName(null)
  }

  const handleDragEnd = async (event: { active: { id: string | number }; over: { id: string | number } | null }) => {
    const { active, over } = event

    if (!over) {
      clearDragState()
      return
    }

    const activeId = active.id as string
    const overId = over.id as string

    try {
      // Folder dropped into another folder (center nest zone)
      if (activeId.startsWith('folder-') && isNestDropId(overId)) {
        const sourceId = activeId.replace('folder-', '')
        const targetId = parseNestDropId(overId)
        if (
          sourceId !== targetId &&
          canMoveFolderToTarget(sourceId, targetId, folders)
        ) {
          await moveFolderToParent(sourceId, targetId)
          const targetName = getFolder(targetId)?.name ?? 'folder'
          addToast({
            title: 'Folder dipindahkan',
            description: `Dipindahkan ke "${targetName}".`,
            variant: 'success',
          })
        }
        clearDragState()
        return
      }

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
        clearDragState()
        return
      }

      // Reorder folders (sortable — folder-{id}, not nest/drop zones)
      if (
        activeId.startsWith('folder-') &&
        overId.startsWith('folder-') &&
        !isNestDropId(overId) &&
        !isProjectDropId(overId)
      ) {
        const siblingIds = filteredFolders.map((f) => f.id)
        const savedOrder = folderOrderByParent[folderOrderParentKey] ?? folderOrder
        const orderedIds = getOrderedIds(siblingIds, savedOrder)
        const oldIndex = orderedIds.indexOf(activeId.replace('folder-', ''))
        const newIndex = orderedIds.indexOf(overId.replace('folder-', ''))
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const next = arrayMove(orderedIds, oldIndex, newIndex)
          setFolderOrderForParent(currentParentId, next)
          addToast({
            title: 'Urutan diubah',
            description: 'Posisi folder telah diperbarui.',
            variant: 'success',
          })
        }
        clearDragState()
        return
      }

      // Project dropped on folder
      if (activeId.startsWith('project-') && isProjectDropId(overId)) {
        const projectId = activeId.replace('project-', '')
        const folderId = parseProjectDropId(overId)
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
        clearDragState()
        return
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
        clearDragState()
        return
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to move project'
      addToast({
        title: 'Error',
        description: msg,
        variant: 'error',
      })
    }

    clearDragState()
  }

  const handleDragOver = (event: DragOverEvent) => {
    const draggingId = String(event.active.id)
    const overId = event.over?.id ? String(event.over.id) : null

    if (!overId) {
      setDropTargetFolderId(null)
      setDropTargetFolderName(null)
      return
    }

    if (draggingId.startsWith('project-') && isProjectDropId(overId)) {
      const folderId = parseProjectDropId(overId)
      const folder = getFolder(folderId)
      setDropTargetFolderId(folderId)
      setDropTargetFolderName(folder?.name ?? null)
      return
    }

    if (draggingId.startsWith('folder-') && isNestDropId(overId)) {
      const sourceId = draggingId.replace('folder-', '')
      const folderId = parseNestDropId(overId)
      if (
        sourceId === folderId ||
        !canMoveFolderToTarget(sourceId, folderId, folders)
      ) {
        setDropTargetFolderId(null)
        setDropTargetFolderName(null)
        return
      }
      const folder = getFolder(folderId)
      setDropTargetFolderId(folderId)
      setDropTargetFolderName(folder?.name ?? null)
      return
    }

    setDropTargetFolderId(null)
    setDropTargetFolderName(null)
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
    setSearchParams({ folder: folderId }, { replace: true })
  }

  const handleBackToRoot = () => {
    setCurrentFolderId(null)
    handleClearSelection()
    setSearchParams({}, { replace: true })
  }

  const handleNavigateBack = useCallback(() => {
    if (!currentFolderId) return
    const folder = getFolder(currentFolderId)
    const parentId = folder?.parentId ?? null
    if (parentId) {
      handleOpenFolder(parentId)
      return
    }
    handleBackToRoot()
  }, [currentFolderId, getFolder])

  const handleCopySelectedFolder = useCallback(() => {
    if (selectedFolderIds.size === 0) return false
    const folderId = lastFolderAnchorRef.current ?? Array.from(selectedFolderIds)[0]
    const folder = folderId ? getFolder(folderId) : undefined
    if (!folder) return false
    copyFolderToClipboard(folder)
    addToast({
      title: 'Folder disalin',
      description: `"${folder.name}" siap untuk Paste (Ctrl+V).`,
      variant: 'success',
    })
    return true
  }, [selectedFolderIds, getFolder, addToast])

  const handlePasteFolderToBackground = useCallback(async () => {
    if (!hasFolderClipboard()) {
      addToast({
        title: 'Clipboard kosong',
        description: 'Copy folder terlebih dahulu (Ctrl+C).',
        variant: 'default',
      })
      return false
    }
    const targetParentId = currentFolderId
    try {
      const created = await pasteFolderFromClipboard(targetParentId)
      addToast({
        title: 'Folder ditempel',
        description: `"${created.name}" dibuat.`,
        variant: 'success',
      })
      notifyEvent({
        type_code: 'folder',
        title: 'Folder ditempel',
        body: `"${created.name}" dibuat.`,
      })
      return true
    } catch (e) {
      addToast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Gagal menempel folder',
        variant: 'error',
      })
      return false
    }
  }, [addToast, currentFolderId, pasteFolderFromClipboard])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (isEditableKeyboardTarget(e.target)) return

      const key = e.key.toLowerCase()
      if (key === 'c') {
        if (selectedFolderIds.size === 0) return
        e.preventDefault()
        handleCopySelectedFolder()
        return
      }
      if (key === 'v') {
        if (!hasFolderClipboard()) return
        e.preventDefault()
        void handlePasteFolderToBackground()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedFolderIds, handleCopySelectedFolder, handlePasteFolderToBackground])

  const handleCreateFolderWithDefaultName = useCallback(async () => {
    const parentId = currentFolderId ?? null
    const siblings = folders.filter((folder) => (folder.parentId ?? null) === parentId)
    const usedNumbers = siblings
      .filter((f) => /^Untitled \d+$/.test(f.name))
      .map((f) => parseInt(f.name.replace('Untitled ', ''), 10))
    const nextNum = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1
    const defaultName = `Untitled ${nextNum}`
    try {
      await addFolder({
        name: defaultName,
        parentId,
        ownerId: '00000000-0000-0000-0000-000000000001',
      })
      addToast({
        title: 'Folder created',
        description: `"${defaultName}" has been created. Rename via right-click.`,
        variant: 'success',
      })
      notifyEvent({
        type_code: 'folder',
        title: 'Folder created',
        body: `"${defaultName}" has been created. Rename via right-click.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create folder'
      addToast({ title: 'Error', description: msg, variant: 'error' })
    }
  }, [folders, addFolder, addToast, currentFolderId])

  const handleShareFolder = (folder: Folder) => {
    setShareFolder(folder)
  }

  const handleOpenFolderNotes = useCallback(
    (folder: Folder, options?: { autoFocusComposer?: boolean }) => {
      setFolderNotesTarget(folder)
      setFolderNotesAutoCompose(options?.autoFocusComposer ?? false)
    },
    [],
  )

  const handleCloseFolderNotes = useCallback(() => {
    setFolderNotesTarget(null)
    setFolderNotesAutoCompose(false)
  }, [])

  const handleDeleteFolder = (folder: Folder) => {
    const count = getProjectsByFolder(folder.id).length
    setDeleteFolderData({ folders: [folder], totalProjectCount: count })
  }

  const handleDeleteSelectedFolders = useCallback(() => {
    if (selectedFolderIds.size === 0) return
    const foldersToDelete = Array.from(selectedFolderIds)
      .map((id) => getFolder(id))
      .filter((folder): folder is Folder => folder != null)
    if (foldersToDelete.length === 0) return
    const totalProjectCount = foldersToDelete.reduce(
      (sum, folder) => sum + getProjectsByFolder(folder.id).length,
      0,
    )
    setDeleteFolderData({ folders: foldersToDelete, totalProjectCount })
  }, [selectedFolderIds, getFolder, getProjectsByFolder])

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
    const folderAncestors = buildFolderAncestorChain(folder.id, getFolder)
    const childFolders = filteredFolders
    const orderedChildFolderIds = orderedFolderIds
    const orderedFolderProjectIds = getOrderedIds(
      filteredFolderProjects.map((p) => p.id),
      projectOrderByFolder[folder.id] ?? [],
    )
    const folderProjectsAll = folderProjects
    const folderActiveCount = folderProjectsAll.filter((p) => p.status === 'active').length
    const folderArchivedCount = folderProjectsAll.filter((p) => p.status === 'archived').length

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={folderDropCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
        <div onClick={handleContentAreaClick} onContextMenu={handleContentAreaContextMenu} className="min-h-[200px]">
          <FolderView
            folder={folder}
            folderAncestors={folderAncestors}
            childFolders={childFolders}
            orderedChildFolderIds={orderedChildFolderIds}
            getChildFolderCount={getChildFolderCount}
            onBack={handleNavigateBack}
            onOpenFolder={handleOpenFolder}
            onCreateFolder={handleCreateFolderWithDefaultName}
            onShare={handleShareFolder}
            onShareFolder={handleShareFolder}
            onDeleteFolder={handleDeleteFolder}
            onRename={(f) => setRenameFolder(f)}
            onRenameFolder={(f) => setRenameFolder(f)}
            onAddProjectToFolder={(targetFolder) => {
              setCreateProjectFolderId(targetFolder.id)
              setIsCreateProjectModalOpen(true)
            }}
            onOpenFolderNotes={() => handleOpenFolderNotes(folder)}
            onOpenChildFolderNotes={handleOpenFolderNotes}
            selectedFolderIds={selectedFolderIds}
            onSelectFolder={handleSelectFolder}
            multiSelectActiveFolders={selectedFolderIds.size > 1}
            onDeleteSelectedFolders={handleDeleteSelectedFolders}
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
            isDragActive={isProjectDragActive}
            dropTargetFolderId={dropTargetFolderId}
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
                  selectedFolderCount={selectedFolderIds.size}
                  onMoveToFolder={handleMoveSelectedToFolder}
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
            <ContextMenuItem
              className={cn(!hasFolderClipboard() && 'opacity-50')}
              onClick={() => {
                void handlePasteFolderToBackground()
                setBackgroundContextMenu(null)
              }}
            >
              <ClipboardPaste className="w-4 h-4 mr-2" />
              Paste
            </ContextMenuItem>
            <ContextMenuItem onClick={() => { setCreateProjectFolderId(folder.id); setIsCreateProjectModalOpen(true); setBackgroundContextMenu(null); }}>
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
        <ProjectDragLayer
          activeId={activeId}
          project={draggedProject}
          projectCount={draggedProjectsData.count}
          overFolderName={dropTargetFolderName}
          pointer={dragPointer}
        />

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
          <AddFolderMembersDrawer
            open={!!shareFolder}
            onOpenChange={(open) => !open && setShareFolder(null)}
            folder={shareFolder}
            onFolderUpdated={(updated) => {
              setShareFolder(updated)
              void fetchFolders(undefined, currentFolderId)
            }}
          />
        )}
        {deleteFolderData && (
          <DeleteFolderConfirmModal
            open={!!deleteFolderData}
            onOpenChange={(open) => !open && setDeleteFolderData(null)}
            folders={deleteFolderData.folders}
            totalProjectCount={deleteFolderData.totalProjectCount}
            onDeleted={handleClearSelection}
          />
        )}
        {renameFolder && (
          <RenameFolderModal
            open={!!renameFolder}
            onOpenChange={(open) => !open && setRenameFolder(null)}
            folder={renameFolder}
          />
        )}
        <FolderNotesDrawer
          open={!!folderNotesTarget}
          folder={folderNotesTarget}
          onOpenChange={(open) => {
            if (!open) handleCloseFolderNotes()
          }}
          autoFocusComposer={folderNotesAutoCompose}
        />
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
      <DndContext
        sensors={sensors}
        collisionDetection={folderDropCollisionDetection}
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
          description="Manage project delivery, folders, and execution status from one place."
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
            totalFolders={filteredFolders.length}
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
                  onMoveToFolder={handleMoveSelectedToFolder}
                />
              ) : null
            }
          />
        </div>
        )}

        {/* Loading/Error States */}
        {projectsLoading ? (
          <PlatformDataLoadingState
            title="Loading project data"
            description="Retrieving projects and folders from the service."
          />
        ) : projectsError ? (
          <div className="liquid-glass-enterprise-panel rounded-2xl p-12 text-center">
            <p className="text-destructive mb-4">{projectsError}</p>
            <Button onClick={() => fetchProjects()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {layout === 'list' ? (
              <>
                {(showFoldersSection && showFoldersSectionVisible) || showProjectsSection ? (
                  <ProjectsFoldersListTable
                    folders={filteredFolders}
                    projects={filteredProjects}
                    getProjectCount={getProjectCount}
                    getChildFolderCount={getChildFolderCount}
                    sortOrder={sortOrder}
                    onSortOrderChange={setSortOrder}
                    showSortControl={showSortInFolders || showSortInProjects}
                    showFolders={showFoldersSection && showFoldersSectionVisible}
                    showProjects={showProjectsSection}
                    selectedFolderIds={selectedFolderIds}
                    selectedProjectIds={selectedProjectIds}
                    onSelectFolder={handleSelectFolder}
                    onSelectProject={handleSelectProject}
                    onOpenFolder={handleOpenFolder}
                    onClearSelection={handleClearSelection}
                    onSelectFoldersBulk={handleSelectFoldersBulk}
                    onSelectProjectsBulk={handleSelectProjectsBulk}
                    isDragActive={isProjectDragActive}
                    draggedProjectIds={draggedProjectIds}
                    orderedFolderIds={orderedFolderIds}
                    orderedProjectIds={orderedRootProjectIds}
                    onShareFolder={handleShareFolder}
                    onDeleteFolder={handleDeleteFolder}
                    onRenameFolder={(folder) => setRenameFolder(folder)}
                    onAddProject={(folder) => {
                      setCreateProjectFolderId(folder.id)
                      setIsCreateProjectModalOpen(true)
                    }}
                    onOpenFolderNotes={handleOpenFolderNotes}
                    multiSelectActive={selectedFolderIds.size > 1}
                    onDeleteSelectedFolders={handleDeleteSelectedFolders}
                    onAddTodo={openTodoPanel}
                  />
                ) : null}

                {!showFoldersSection && !showProjectsSection && (
                  <div className="liquid-glass-enterprise-panel rounded-2xl p-12">
                    <EmptyState
                      title="No items found"
                      description="Try adjusting your search or filter criteria."
                    />
                  </div>
                )}
              </>
            ) : (
              <>
            {/* Folders Section */}
            {showFoldersSection && showFoldersSectionVisible && Array.isArray(filteredFolders) && (
              <FoldersSection
                folders={filteredFolders}
                getProjectCount={getProjectCount}
                getChildFolderCount={getChildFolderCount}
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
                onOpenFolderNotes={handleOpenFolderNotes}
                layout={layout}
                multiSelectActive={selectedFolderIds.size > 1}
                onDeleteSelected={handleDeleteSelectedFolders}
                isProjectDragActive={isProjectDragActive}
                dropTargetFolderId={dropTargetFolderId}
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
                isDragActive={isProjectDragActive}
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
              <div className="liquid-glass-enterprise-panel rounded-2xl p-12">
                <EmptyState
                  title="No items found"
                  description="Try adjusting your search or filter criteria."
                />
              </div>
            )}
              </>
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
          <AddFolderMembersDrawer
            open={!!shareFolder}
            onOpenChange={(open) => !open && setShareFolder(null)}
            folder={shareFolder}
            onFolderUpdated={(updated) => {
              setShareFolder(updated)
              void fetchFolders(undefined, currentFolderId)
            }}
          />
        )}
        {deleteFolderData && (
          <DeleteFolderConfirmModal
            open={!!deleteFolderData}
            onOpenChange={(open) => !open && setDeleteFolderData(null)}
            folders={deleteFolderData.folders}
            totalProjectCount={deleteFolderData.totalProjectCount}
            onDeleted={handleClearSelection}
          />
        )}
        {renameFolder && (
          <RenameFolderModal
            open={!!renameFolder}
            onOpenChange={(open) => !open && setRenameFolder(null)}
            folder={renameFolder}
          />
        )}
        <FolderNotesDrawer
          open={!!folderNotesTarget}
          folder={folderNotesTarget}
          onOpenChange={(open) => {
            if (!open) handleCloseFolderNotes()
          }}
          autoFocusComposer={folderNotesAutoCompose}
        />
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
            <ContextMenuItem
              className={cn(!hasFolderClipboard() && 'opacity-50')}
              onClick={() => {
                void handlePasteFolderToBackground()
                setBackgroundContextMenu(null)
              }}
            >
              <ClipboardPaste className="w-4 h-4 mr-2" />
              Paste
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

        <ProjectDragLayer
          activeId={activeId}
          project={draggedProject}
          projectCount={draggedProjectsData.count}
          overFolderName={dropTargetFolderName}
          pointer={dragPointer}
        />
        </div>
      </DndContext>
  )
}
