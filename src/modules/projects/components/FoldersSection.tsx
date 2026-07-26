import { useMemo, useState, useEffect, useCallback } from 'react'
import { ArrowUpDown, Folder as FolderIcon, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { FolderCard } from './FolderCard'
import { fetchTodos, TECTONA_TODO_APP_ID, TODO_ENTITY_TYPE } from '@/lib/api/todoApi'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import type { Folder } from '@/modules/projects'
import type { SortOrder } from './FiltersBar'

export type LayoutMode = 'grid' | 'list'

interface FoldersSectionProps {
  folders: Folder[]
  getProjectCount: (folderId: string) => number
  onOpenFolder: (folderId: string) => void
  onShareFolder: (folder: Folder) => void
  onDeleteFolder: (folder: Folder) => void
  sortOrder: SortOrder
  onSortOrderChange: (order: SortOrder) => void
  showSortControl: boolean
  isDraggingFromFolderView?: boolean
  selectedFolderIds?: Set<string>
  onSelectFolder?: (folderId: string, selected: boolean) => void
  /** IDs folder dalam urutan tampilan (untuk reorder). Kosong = pakai urutan dari sortOrder saja. */
  orderedFolderIds?: string[]
  onRenameFolder?: (folder: Folder) => void
  onAddProject?: (folder: Folder) => void
  layout?: LayoutMode
}

export function FoldersSection({
  folders,
  getProjectCount,
  onOpenFolder,
  onShareFolder,
  onDeleteFolder,
  sortOrder,
  onSortOrderChange,
  showSortControl,
  isDraggingFromFolderView = false,
  selectedFolderIds = new Set(),
  onSelectFolder,
  orderedFolderIds,
  onRenameFolder,
  onAddProject,
  layout = 'grid',
}: FoldersSectionProps) {
  // If no folders exist, render nothing (no header/placeholder)
  if (!folders || folders.length === 0) return null

  const [folderTodoTitles, setFolderTodoTitles] = useState<Map<string, string>>(new Map())

  const loadFolderTodos = useCallback(() => {
    fetchTodos({ app_id: TECTONA_TODO_APP_ID, page_size: 100 })
      .then((res) => {
        const byFolderName = new Map<string, string[]>()
        const prefix = 'Todo for '
        for (const t of res.todos || []) {
          const generalLinks = (t.entity_links || []).filter(
            (l) =>
              l.entity_type_id === TODO_ENTITY_TYPE.general ||
              l.entity_type_code === 'general'
          )
          if (generalLinks.length === 0) continue
          if (!t.title.startsWith(prefix)) continue
          const after = t.title.slice(prefix.length)
          const folderName = after.split(':')[0].trim()
          if (!folderName) continue
          const list = byFolderName.get(folderName) ?? []
          list.push(t.title)
          byFolderName.set(folderName, list)
        }
        setFolderTodoTitles(
          new Map([...byFolderName.entries()].map(([name, list]) => [name, list.join('\n')]))
        )
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadFolderTodos()
  }, [loadFolderTodos, folders.length])

  useEffect(() => {
    const onFocus = () => loadFolderTodos()
    const onTodosChanged = () => loadFolderTodos()
    window.addEventListener('focus', onFocus)
    window.addEventListener('sequoia-todos-changed', onTodosChanged)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('sequoia-todos-changed', onTodosChanged)
    }
  }, [loadFolderTodos])

  const byId = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders])
  const sortedFolders = useMemo(() => {
    if (!folders || folders.length === 0) return []
    if (orderedFolderIds && orderedFolderIds.length > 0) {
      const ordered = orderedFolderIds.map((id) => byId.get(id)).filter(Boolean) as Folder[]
      const rest = folders.filter((f) => !orderedFolderIds.includes(f.id))
      const restSorted = rest.sort((a, b) => {
        const nameA = a.name.toLowerCase()
        const nameB = b.name.toLowerCase()
        return sortOrder === 'name-asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
      })
      return [...ordered, ...restSorted]
    }
    return [...folders].sort((a, b) => {
      const nameA = a.name.toLowerCase()
      const nameB = b.name.toLowerCase()
      if (sortOrder === 'name-asc') return nameA.localeCompare(nameB)
      return nameB.localeCompare(nameA)
    })
  }, [folders, sortOrder, orderedFolderIds, byId])

  const sortableFolderIds = useMemo(
    () => sortedFolders.map((f) => `folder-${f.id}`),
    [sortedFolders]
  )

  // If folders exist but are filtered down to zero, render nothing as well
  if (!sortedFolders || sortedFolders.length === 0) return null

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          Folders ({sortedFolders?.length ?? folders?.length ?? 0})
        </h2>
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

      {/* Folders Grid / List (table-style when list) */}
      {layout === 'list' ? (
        <div className="glass-card rounded-xl border border-border/50 overflow-hidden">
          <div
            className="grid gap-2 px-4 py-3 text-xs font-medium text-muted-foreground border-b bg-muted/30 items-center"
            style={{ gridTemplateColumns: 'auto minmax(0,1fr) 80px' }}
          >
            <div className="w-4" />
            <div>Name</div>
            <div>Projects</div>
          </div>
          <SortableContext items={sortableFolderIds} strategy={rectSortingStrategy}>
            <div className="divide-y divide-border/50">
              {sortedFolders.map((folder) => {
                if (!folder || !folder.id) return null
                const projectCount = getProjectCount(folder.id)
                return (
                  <SortableFolderRow
                    key={folder.id}
                    folder={folder}
                    projectCount={projectCount}
                    isSelected={selectedFolderIds.has(folder.id)}
                    onSelect={onSelectFolder}
                    onOpen={() => onOpenFolder(folder.id)}
                  />
                )
              })}
            </div>
          </SortableContext>
        </div>
      ) : (
        <SortableContext items={sortableFolderIds} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(120px,168px))] gap-2">
            {sortedFolders.map((folder) => {
              if (!folder || !folder.id) return null
              const projectCount = getProjectCount(folder.id)
              return (
                <SortableDroppableFolderCard
                  key={folder.id}
                  folder={folder}
                  projectCount={projectCount}
                  hasTodos={folderTodoTitles.has(folder.name)}
                  todoListTooltip={folderTodoTitles.get(folder.name) ?? ''}
                  onOpen={onOpenFolder}
                  onShare={onShareFolder}
                  onDelete={onDeleteFolder}
                  isSelected={selectedFolderIds.has(folder.id)}
                  onSelect={onSelectFolder}
                  onRenameFolder={onRenameFolder}
                  onAddProject={onAddProject}
                />
              )
            })}
          </div>
        </SortableContext>
      )}
    </div>
  )
}

// Table-style row for list layout
function SortableFolderRow({
  folder,
  projectCount,
  isSelected,
  onSelect,
  onOpen,
}: {
  folder: Folder
  projectCount: number
  isSelected: boolean
  onSelect?: (folderId: string, selected: boolean) => void
  onOpen: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: `folder-${folder.id}`,
    data: { type: 'folder', folder },
  })
  const rowStyle: React.CSSProperties = {
    gridTemplateColumns: 'auto minmax(0,1fr) 80px',
    ...(transform ? { transform: CSS.Transform.toString(transform), transition } : {}),
  }
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'grid gap-2 px-4 py-2.5 items-center text-sm cursor-pointer transition-colors',
        'hover:bg-muted/50',
        isSelected && 'bg-primary/10'
      )}
      style={rowStyle}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-grip]')) return
        onSelect?.(folder.id, !isSelected)
      }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-grip]')) return
        e.preventDefault()
        onOpen()
      }}
      {...attributes}
    >
      <div className="flex items-center touch-none" data-grip {...listeners}>
        <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <FolderIcon className="w-4 h-4 text-primary shrink-0" />
        <span className="font-medium text-foreground truncate">{folder.name}</span>
      </div>
      <div className="text-muted-foreground text-xs shrink-0">
        {projectCount} {projectCount === 1 ? 'project' : 'projects'}
      </div>
    </div>
  )
}

// Sortable + droppable: folder bisa di-drag untuk reorder dan bisa di-drop project
function SortableDroppableFolderCard({
  folder,
  projectCount,
  hasTodos = false,
  todoListTooltip = '',
  onOpen,
  onShare,
  onDelete,
  isSelected = false,
  onSelect,
  onRenameFolder,
  onAddProject,
}: {
  folder: Folder
  projectCount: number
  hasTodos?: boolean
  todoListTooltip?: string
  onOpen: (folderId: string) => void
  onShare: (folder: Folder) => void
  onDelete: (folder: Folder) => void
  isSelected?: boolean
  onSelect?: (folderId: string, selected: boolean) => void
  onRenameFolder?: (folder: Folder) => void
  onAddProject?: (folder: Folder) => void
}) {
  const id = `folder-${folder.id}`
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id,
    data: { type: 'folder', folder },
  })
  const {
    setNodeRef: setSortableRef,
    listeners,
    attributes,
    transform,
    transition,
  } = useSortable({
    id,
    data: { type: 'folder', folder },
  })
  const setRef = (node: HTMLElement | null) => {
    setDroppableRef(node)
    setSortableRef(node)
  }
  const style = transform
    ? { transform: CSS.Transform.toString(transform), transition }
    : undefined

  return (
    <div ref={setRef} style={style} {...listeners} {...attributes}>
      <FolderCard
        id={folder.id}
        name={folder.name}
        projectCount={projectCount}
        hasTodos={hasTodos}
        todoListTooltip={todoListTooltip}
        parentId={folder.parentId}
        isShared={folder.isShared}
        isSelected={isSelected}
        isDragOver={isOver}
        onOpen={() => onOpen(folder.id)}
        onShare={() => onShare(folder)}
        onDelete={() => onDelete(folder)}
        onSelect={onSelect}
        onRenameFolder={onRenameFolder ? () => onRenameFolder(folder) : undefined}
        onAddProject={onAddProject ? () => onAddProject(folder) : undefined}
      />
    </div>
  )
}
