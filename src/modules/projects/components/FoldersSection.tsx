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
import { getSession } from '@/auth/authService'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import type { Folder } from '@/modules/projects'
import type { GridSelectionModifiers } from '../lib/gridSelection'
import { buildFolderNotesTooltip } from '../lib/folderNotesLimits'
import { formatFolderContentsLabel } from '../lib/folderHierarchy'
import { EMPTY_FOLDER_NOTES, useFolderNotesStore } from '../store/folderNotesStore'
import type { SortOrder } from './FiltersBar'

export type LayoutMode = 'grid' | 'list'

interface FoldersSectionProps {
  folders: Folder[]
  getProjectCount: (folderId: string) => number
  getChildFolderCount: (folderId: string) => number
  onOpenFolder: (folderId: string) => void
  onShareFolder: (folder: Folder) => void
  onDeleteFolder: (folder: Folder) => void
  sortOrder: SortOrder
  onSortOrderChange: (order: SortOrder) => void
  showSortControl: boolean
  isDraggingFromFolderView?: boolean
  isProjectDragActive?: boolean
  dropTargetFolderId?: string | null
  selectedFolderIds?: Set<string>
  onSelectFolder?: (folderId: string, modifiers: GridSelectionModifiers) => void
  /** IDs folder dalam urutan tampilan (untuk reorder). Kosong = pakai urutan dari sortOrder saja. */
  orderedFolderIds?: string[]
  onRenameFolder?: (folder: Folder) => void
  onAddProject?: (folder: Folder) => void
  onOpenFolderNotes?: (folder: Folder, options?: { autoFocusComposer?: boolean }) => void
  layout?: LayoutMode
  multiSelectActive?: boolean
  onDeleteSelected?: () => void
}

export function FoldersSection({
  folders,
  getProjectCount,
  getChildFolderCount,
  onOpenFolder,
  onShareFolder,
  onDeleteFolder,
  sortOrder,
  onSortOrderChange,
  showSortControl,
  isDraggingFromFolderView = false,
  isProjectDragActive = false,
  dropTargetFolderId = null,
  selectedFolderIds = new Set(),
  onSelectFolder,
  orderedFolderIds,
  onRenameFolder,
  onAddProject,
  onOpenFolderNotes,
  layout = 'grid',
  multiSelectActive = false,
  onDeleteSelected,
}: FoldersSectionProps) {
  const notesByFolderId = useFolderNotesStore((state) => state.notesByFolderId)
  const [folderTodoTitles, setFolderTodoTitles] = useState<Map<string, string>>(new Map())

  const loadFolderTodos = useCallback(() => {
    const userId = getSession()?.user.id
    if (!userId) {
      setFolderTodoTitles(new Map())
      return
    }
    fetchTodos({ app_id: TECTONA_TODO_APP_ID, owned_by: userId, page_size: 100 })
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
    window.addEventListener('tectona-todos-changed', onTodosChanged)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('sequoia-todos-changed', onTodosChanged)
      window.removeEventListener('tectona-todos-changed', onTodosChanged)
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

  if (!folders || folders.length === 0) return null
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
            style={{ gridTemplateColumns: 'auto minmax(0,1fr) 140px' }}
          >
            <div className="w-4" />
            <div>Name</div>
            <div>Contents</div>
          </div>
          <SortableContext items={sortableFolderIds} strategy={rectSortingStrategy}>
            <div className="divide-y divide-border/50">
              {sortedFolders.map((folder) => {
                if (!folder || !folder.id) return null
                const projectCount = getProjectCount(folder.id)
                const childFolderCount = getChildFolderCount(folder.id)
                return (
                  <SortableFolderRow
                    key={folder.id}
                    folder={folder}
                    projectCount={projectCount}
                    childFolderCount={childFolderCount}
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
          <div className="grid grid-cols-1 gap-x-3 gap-y-6 pt-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(140px,168px))]">
            {sortedFolders.map((folder) => {
              if (!folder || !folder.id) return null
                const projectCount = getProjectCount(folder.id)
                const childFolderCount = getChildFolderCount(folder.id)
                const folderNotes = notesByFolderId[folder.id] ?? EMPTY_FOLDER_NOTES
                const noteCount = folderNotes.length
                const notesTooltip = buildFolderNotesTooltip(folderNotes.map((note) => note.title))
                return (
                  <SortableDroppableFolderCard
                    key={folder.id}
                    folder={folder}
                    projectCount={projectCount}
                    childFolderCount={childFolderCount}
                    isProjectDragActive={isProjectDragActive}
                    dropTargetFolderId={dropTargetFolderId}
                    noteCount={noteCount}
                    notesTooltip={notesTooltip}
                  hasTodos={folderTodoTitles.has(folder.name)}
                  todoListTooltip={folderTodoTitles.get(folder.name) ?? ''}
                  onOpen={onOpenFolder}
                  onShare={onShareFolder}
                  onDelete={onDeleteFolder}
                  isSelected={selectedFolderIds.has(folder.id)}
                  onSelect={onSelectFolder}
                  onRenameFolder={onRenameFolder}
                    onAddProject={onAddProject}
                    onOpenFolderNotes={onOpenFolderNotes}
                    multiSelectActive={multiSelectActive}
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

// Table-style row for list layout
function SortableFolderRow({
  folder,
  projectCount,
  childFolderCount,
  isSelected,
  onSelect,
  onOpen,
}: {
  folder: Folder
  projectCount: number
  childFolderCount: number
  isSelected: boolean
  onSelect?: (folderId: string, modifiers: GridSelectionModifiers) => void
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
    gridTemplateColumns: 'auto minmax(0,1fr) 140px',
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
        onSelect?.(folder.id, {
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          metaKey: e.metaKey,
        })
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
      <div className="text-muted-foreground text-xs shrink-0 text-right">
        {formatFolderContentsLabel(projectCount, childFolderCount)}
      </div>
    </div>
  )
}

// Sortable + droppable: folder bisa di-drag untuk reorder dan bisa di-drop project
function SortableDroppableFolderCard({
  folder,
  projectCount,
  childFolderCount = 0,
  isProjectDragActive = false,
  dropTargetFolderId = null,
  noteCount = 0,
  notesTooltip = '',
  hasTodos = false,
  todoListTooltip = '',
  onOpen,
  onShare,
  onDelete,
  isSelected = false,
  onSelect,
  onRenameFolder,
  onAddProject,
  onOpenFolderNotes,
  multiSelectActive = false,
  onDeleteSelected,
}: {
  folder: Folder
  projectCount: number
  childFolderCount?: number
  isProjectDragActive?: boolean
  dropTargetFolderId?: string | null
  noteCount?: number
  notesTooltip?: string
  hasTodos?: boolean
  todoListTooltip?: string
  onOpen: (folderId: string) => void
  onShare: (folder: Folder) => void
  onDelete: (folder: Folder) => void
  isSelected?: boolean
  onSelect?: (folderId: string, modifiers: GridSelectionModifiers) => void
  onRenameFolder?: (folder: Folder) => void
  onAddProject?: (folder: Folder) => void
  onOpenFolderNotes?: (folder: Folder, options?: { autoFocusComposer?: boolean }) => void
  multiSelectActive?: boolean
  onDeleteSelected?: () => void
}) {
  const sortableId = `folder-${folder.id}`
  const projectDropId = `folder-drop-${folder.id}`
  const nestDropId = `folder-nest-${folder.id}`
  const { setNodeRef: setProjectDropRef } = useDroppable({
    id: projectDropId,
    data: { type: 'folder-drop', folder, accepts: ['project'] },
  })
  const { setNodeRef: setNestDropRef } = useDroppable({
    id: nestDropId,
    data: { type: 'folder-nest', folder, accepts: ['folder'] },
  })
  const {
    setNodeRef: setSortableRef,
    listeners,
    attributes,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sortableId,
    data: { type: 'folder', folder },
    disabled: isProjectDragActive,
  })
  const style = transform
    ? { transform: CSS.Transform.toString(transform), transition }
    : undefined

  return (
    <div
      ref={setSortableRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn('relative w-full max-w-[168px]', isDragging && 'opacity-60')}
    >
      {/* Droppable hit areas — pointer-events-none so clicks reach FolderCard */}
      <div ref={setProjectDropRef} className="absolute inset-0 z-0 pointer-events-none" aria-hidden />
      <div
        ref={setNestDropRef}
        className="absolute left-[8%] top-[18%] right-[8%] bottom-[16%] z-[1] pointer-events-none"
        aria-hidden
      />
      <div className="relative z-[2] w-full">
      <FolderCard
        id={folder.id}
        name={folder.name}
        projectCount={projectCount}
        childFolderCount={childFolderCount}
        noteCount={noteCount}
        notesTooltip={notesTooltip}
        hasTodos={hasTodos}
        todoListTooltip={todoListTooltip}
        parentId={folder.parentId}
        isShared={folder.isShared}
        borderColor={folder.borderColor}
        isSelected={isSelected}
        isProjectDropOver={dropTargetFolderId === folder.id}
        onOpen={() => onOpen(folder.id)}
        onShare={() => onShare(folder)}
        onDelete={() => onDelete(folder)}
        onSelect={onSelect}
        onRenameFolder={onRenameFolder ? () => onRenameFolder(folder) : undefined}
        onAddProject={onAddProject ? () => onAddProject(folder) : undefined}
        onOpenFolderNotes={
          onOpenFolderNotes
            ? (options) => onOpenFolderNotes(folder, options)
            : undefined
        }
        multiSelectActive={multiSelectActive}
        onDeleteSelected={onDeleteSelected}
      />
      </div>
    </div>
  )
}
