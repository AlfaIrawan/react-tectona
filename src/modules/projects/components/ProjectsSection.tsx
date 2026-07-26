import { useMemo, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpDown, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { ProjectCard } from './ProjectCard'
import { fetchTodos, TECTONA_TODO_APP_ID, TODO_ENTITY_TYPE } from '@/lib/api/todoApi'
import { EmptyState } from './EmptyState'
import { DropZone } from './DropZone'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import type { Project } from '@/modules/projects'
import type { SortOrder } from './FiltersBar'
import type { LayoutMode } from './FoldersSection'

interface ProjectsSectionProps {
  projects: Project[]
  onSelectProject: (projectId: string, selected: boolean, shiftKey?: boolean) => void
  selectedProjectIds: Set<string>
  showCheckbox: boolean
  sortOrder: SortOrder
  onSortOrderChange: (order: SortOrder) => void
  showSortControl: boolean
  showDropZone?: boolean
  onCreateProject?: () => void
  isDragActive?: boolean
  draggedProjectIds?: Set<string>
  /** IDs dalam urutan tampilan (untuk reorder). Kosong = pakai urutan dari sortOrder saja. */
  orderedProjectIds?: string[]
  layout?: LayoutMode
  /** When true, project card context menu shows Archive/Restore, Move to folder, Add member, Share, and Delete (archived). */
  multiSelectActive?: boolean
  /** Callback untuk bulk move (semua project terpilih) ke folder; dipanggil dari context menu saat multiSelectActive. */
  onMoveSelectedToFolder?: (folderId: string | null) => void | Promise<void>
  /** Callback untuk bulk archive (semua project terpilih); dipanggil dari context menu saat multiSelectActive. */
  onArchiveSelected?: () => void | Promise<void>
  /** Callback untuk bulk restore (semua project terpilih); dipanggil dari context menu saat multiSelectActive. */
  onRestoreSelected?: () => void | Promise<void>
  /** Callback untuk bulk delete (project archived terpilih); dipanggil dari context menu saat multiSelectActive. */
  onDeleteSelected?: () => void | Promise<void>
}

export function ProjectsSection({
  projects,
  onSelectProject,
  selectedProjectIds,
  showCheckbox,
  sortOrder,
  onSortOrderChange,
  showSortControl,
  showDropZone = false,
  onCreateProject,
  isDragActive = false,
  draggedProjectIds,
  orderedProjectIds,
  layout = 'grid',
  multiSelectActive = false,
  onMoveSelectedToFolder,
  onArchiveSelected,
  onRestoreSelected,
  onDeleteSelected,
}: ProjectsSectionProps) {
  const navigate = useNavigate()
  const [projectIdsWithTodos, setProjectIdsWithTodos] = useState<Set<string>>(new Set())
  const [projectTodoTitles, setProjectTodoTitles] = useState<Map<string, string>>(new Map())

  const loadProjectIdsWithTodos = useCallback(() => {
    fetchTodos({ app_id: TECTONA_TODO_APP_ID, page_size: 100 })
      .then((res) => {
        const ids = new Set<string>()
        const titlesByProject = new Map<string, string[]>()
        for (const t of res.todos) {
          const projectLinks = (t.entity_links || []).filter(
            (l) =>
              l.entity_type_id === TODO_ENTITY_TYPE.project ||
              l.entity_type_code === 'project'
          )
          for (const l of projectLinks) {
            ids.add(l.entity_id)
            const list = titlesByProject.get(l.entity_id) ?? []
            list.push(t.title)
            titlesByProject.set(l.entity_id, list)
          }
        }
        setProjectIdsWithTodos(ids)
        setProjectTodoTitles(
          new Map([...titlesByProject.entries()].map(([id, list]) => [id, list.join('\n')]))
        )
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadProjectIdsWithTodos()
  }, [loadProjectIdsWithTodos, projects.length])

  useEffect(() => {
    const onFocus = () => loadProjectIdsWithTodos()
    const onTodosChanged = () => loadProjectIdsWithTodos()
    window.addEventListener('focus', onFocus)
    window.addEventListener('sequoia-todos-changed', onTodosChanged)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('sequoia-todos-changed', onTodosChanged)
    }
  }, [loadProjectIdsWithTodos])

  // Urutan tampilan: pakai orderedProjectIds bila ada, lalu urutkan sisanya by name
  const sortedProjects = useMemo(() => {
    if (!projects || projects.length === 0) return []
    const byId = new Map(projects.map((p) => [p.id, p]))
    if (orderedProjectIds && orderedProjectIds.length > 0) {
      const ordered = orderedProjectIds.map((id) => byId.get(id)).filter(Boolean) as Project[]
      const restIds = projects.filter((p) => !orderedProjectIds.includes(p.id)).map((p) => p.id)
      const rest = restIds.map((id) => byId.get(id)).filter(Boolean) as Project[]
      const restSorted = rest.sort((a, b) => {
        const nameA = a.name.toLowerCase()
        const nameB = b.name.toLowerCase()
        return sortOrder === 'name-asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
      })
      return [...ordered, ...restSorted]
    }
    return [...projects].sort((a, b) => {
      const nameA = a.name.toLowerCase()
      const nameB = b.name.toLowerCase()
      if (sortOrder === 'name-asc') return nameA.localeCompare(nameB)
      return nameB.localeCompare(nameA)
    })
  }, [projects, sortOrder, orderedProjectIds])

  const sortableIds = useMemo(
    () => sortedProjects.map((p) => `project-${p.id}`),
    [sortedProjects]
  )

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          Projects ({sortedProjects?.length ?? projects?.length ?? 0})
        </h2>
        <div className="flex items-center gap-2">
          {showSortControl && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowUpDown className="w-4 h-4" />
                  {sortOrder === 'name-asc' ? 'A → Z' : 'Z → A'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onSortOrderChange('name-asc')}>
                  A → Z
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSortOrderChange('name-desc')}>
                  Z → A
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Drop Zone for moving out of folder - shown at top of section */}
      {showDropZone && <AllProjectsDropZone />}

      {/* Projects Grid / List (table-style when list) */}
      {!sortedProjects || sortedProjects.length === 0 ? (
        <div className="glass-card rounded-xl p-8">
          <EmptyState
            title="No projects found"
            description="Try adjusting your search or filter criteria."
            imageSrc="/images/project.png"
          />
        </div>
      ) : layout === 'list' ? (
        <div className="glass-card rounded-xl border border-border/50 overflow-hidden">
          {/* Table-style list: header row (columns match row: [checkbox?] grip, Name, Description, Date, Status) */}
          <div
            className="grid gap-2 px-4 py-3 text-xs font-medium text-muted-foreground border-b bg-muted/30 items-center"
            style={{
              gridTemplateColumns: showCheckbox
                ? 'auto auto minmax(0,1fr) minmax(0,2fr) 120px 90px'
                : 'auto minmax(0,1fr) minmax(0,2fr) 120px 90px',
            }}
          >
            {showCheckbox && <div className="w-8" />}
            <div className="w-4" />
            <div>Name</div>
            <div>Description</div>
            <div>Date modified</div>
            <div>Status</div>
          </div>
          <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
            <div className="divide-y divide-border/50">
              {sortedProjects.map((project) => {
                if (!project || !project.id) return null
                return (
                  <SortableProjectRow
                    key={project.id}
                    project={project}
                    isSelected={selectedProjectIds.has(project.id)}
                    onSelect={onSelectProject}
                    showCheckbox={showCheckbox}
                    onDoubleClick={() => navigate(`/projects/${project.id}`)}
                    isDragActive={isDragActive}
                    draggedProjectIds={draggedProjectIds}
                  />
                )
              })}
            </div>
          </SortableContext>
        </div>
      ) : (
        <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {sortedProjects.map((project) => {
              if (!project || !project.id) return null
              return (
                <SortableProjectCard
                  key={project.id}
                  project={project}
                  hasTodos={projectIdsWithTodos.has(project.id)}
                  todoListTooltip={projectTodoTitles.get(project.id) ?? ''}
                  isSelected={selectedProjectIds.has(project.id)}
                  onSelect={onSelectProject}
                  showCheckbox={showCheckbox}
                  onDoubleClick={() => navigate(`/projects/${project.id}`)}
                  isDragActive={isDragActive}
                  draggedProjectIds={draggedProjectIds}
                  multiSelectActive={multiSelectActive}
                  onMoveSelectedToFolder={onMoveSelectedToFolder}
                  onArchiveSelected={onArchiveSelected}
                  onRestoreSelected={onRestoreSelected}
                  onDeleteSelected={onDeleteSelected}
                />
              )
            })}
          </div>
        </SortableContext>
      )}
    </div>
  )
}

function formatDateModified(dateStr: string) {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function SortableProjectRow({
  project,
  isSelected,
  onSelect,
  showCheckbox,
  onDoubleClick,
  isDragActive,
  draggedProjectIds,
}: {
  project: Project
  isSelected: boolean
  onSelect: (projectId: string, selected: boolean, shiftKey?: boolean) => void
  showCheckbox: boolean
  onDoubleClick: () => void
  isDragActive: boolean
  draggedProjectIds?: Set<string>
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: `project-${project.id}`,
    data: { type: 'project', project },
  })
  const transformStyle = transform
    ? { transform: CSS.Transform.toString(transform), transition }
    : {}
  const isDragging = isDragActive && draggedProjectIds?.has(project.id)
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'grid gap-2 px-4 py-2.5 items-center text-sm cursor-pointer transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
        'hover:bg-muted/50',
        isSelected && 'bg-primary/10',
        isDragging && 'opacity-50'
      )}
      style={{
        ...transformStyle,
        gridTemplateColumns: showCheckbox
          ? 'auto auto minmax(0,1fr) minmax(0,2fr) 120px 90px'
          : 'auto minmax(0,1fr) minmax(0,2fr) 120px 90px',
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return
        onSelect(project.id, !isSelected, e.shiftKey)
      }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return
        e.preventDefault()
        onDoubleClick()
      }}
      {...attributes}
    >
      {showCheckbox && (
        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(project.id, e.target.checked)}
            className="rounded border-input"
          />
        </div>
      )}
      <div className="flex items-center touch-none" {...listeners}>
        <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
      </div>
      <div className="font-medium text-foreground truncate min-w-0">{project.name}</div>
      <div className="text-muted-foreground truncate min-w-0">
        {project.description || '—'}
      </div>
      <div className="text-muted-foreground text-xs shrink-0">
        {formatDateModified(project.updatedAt)}
      </div>
      <div className="shrink-0">
        <span
          className={cn(
            'inline-flex px-2 py-0.5 rounded text-xs font-medium',
            project.status === 'active'
              ? 'bg-green-500/15 text-green-700 dark:text-green-400'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {project.status === 'active' ? 'Active' : 'Archived'}
        </span>
      </div>
    </div>
  )
}

function SortableProjectCard({
  project,
  hasTodos,
  todoListTooltip,
  isSelected,
  onSelect,
  showCheckbox,
  onDoubleClick,
  isDragActive,
  draggedProjectIds,
  multiSelectActive,
  onMoveSelectedToFolder,
  onArchiveSelected,
  onRestoreSelected,
  onDeleteSelected,
}: {
  project: Project
  hasTodos?: boolean
  todoListTooltip?: string
  isSelected: boolean
  onSelect: (projectId: string, selected: boolean, shiftKey?: boolean) => void
  showCheckbox: boolean
  onDoubleClick: () => void
  isDragActive: boolean
  draggedProjectIds?: Set<string>
  multiSelectActive?: boolean
  onMoveSelectedToFolder?: (folderId: string | null) => void | Promise<void>
  onArchiveSelected?: () => void | Promise<void>
  onRestoreSelected?: () => void | Promise<void>
  onDeleteSelected?: () => void | Promise<void>
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: `project-${project.id}`,
    data: { type: 'project', project },
  })
  const style = transform
    ? { transform: CSS.Transform.toString(transform), transition }
    : undefined
  return (
    <div
      ref={setNodeRef}
      style={{ ...style, outline: 'none' }}
      className="h-full outline-none focus:outline-none"
      {...listeners}
      {...attributes}
    >
      <ProjectCard
        project={project}
        hasTodos={hasTodos}
        todoListTooltip={todoListTooltip}
        isSelected={isSelected}
        onSelect={onSelect}
        showCheckbox={showCheckbox}
        onDoubleClick={onDoubleClick}
        isDragActive={isDragActive}
        draggedProjectIds={draggedProjectIds}
        sortableMode
        multiSelectActive={multiSelectActive}
        onMoveSelectedToFolder={onMoveSelectedToFolder}
        onArchiveSelected={onArchiveSelected}
        onRestoreSelected={onRestoreSelected}
        onDeleteSelected={onDeleteSelected}
      />
    </div>
  )
}

// Helper component for All Projects drop zone
function AllProjectsDropZone() {
  const { setNodeRef, isOver } = useDroppable({
    id: 'all-projects-from-folder',
    data: {
      type: 'dropzone',
      target: 'all-projects',
    },
  })

  return (
    <div ref={setNodeRef} className="mb-4">
      <DropZone isOver={isOver}>
        <div className="text-center text-muted-foreground py-4">
          <p className="text-sm font-medium mb-1">All Projects</p>
          <p className="text-xs">Drop projects here to remove them from folders</p>
        </div>
      </DropZone>
    </div>
  )
}
