import { useMemo } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { IdeaBacklogFolderCard } from './IdeaBacklogFolderCard'
import type { IdeaBacklogFolder } from '../store/ideaFolderStore'

export type IdeaFolderSortOrder = 'name-asc' | 'name-desc'

interface IdeaBacklogFoldersSectionProps {
  folders: IdeaBacklogFolder[]
  sortOrder: IdeaFolderSortOrder
  onSortOrderChange: (order: IdeaFolderSortOrder) => void
  onOpenFolder: (folderId: string) => void
  onRenameFolder: (folderId: string, name: string) => Promise<void>
  onDeleteFolder: (folder: IdeaBacklogFolder) => void
  orderedFolderIds?: string[]
  isIdeaDragActive?: boolean
  dropTargetFolderId?: string | null
}

export function IdeaBacklogFoldersSection({
  folders,
  sortOrder,
  onSortOrderChange,
  onOpenFolder,
  onRenameFolder,
  onDeleteFolder,
  orderedFolderIds,
  isIdeaDragActive = false,
  dropTargetFolderId = null,
}: IdeaBacklogFoldersSectionProps) {
  const sortedFolders = useMemo(() => {
    if (orderedFolderIds && orderedFolderIds.length > 0) {
      const byId = new Map(folders.map((folder) => [folder.id, folder]))
      const ordered = orderedFolderIds.map((id) => byId.get(id)).filter(Boolean) as IdeaBacklogFolder[]
      const rest = folders.filter((folder) => !orderedFolderIds.includes(folder.id))
      const restSorted = [...rest].sort((a, b) => {
        const nameA = a.name.toLowerCase()
        const nameB = b.name.toLowerCase()
        return sortOrder === 'name-asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
      })
      return [...ordered, ...restSorted]
    }
    return [...folders].sort((a, b) => {
      const nameA = a.name.toLowerCase()
      const nameB = b.name.toLowerCase()
      return sortOrder === 'name-asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
    })
  }, [folders, sortOrder, orderedFolderIds])

  const sortableFolderIds = useMemo(
    () => sortedFolders.map((folder) => `folder-${folder.id}`),
    [sortedFolders],
  )

  if (sortedFolders.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Folders ({sortedFolders.length})</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 shrink-0">
              <ArrowUpDown className="w-4 h-4" />
              {sortOrder === 'name-asc' ? 'A → Z' : 'Z → A'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onSortOrderChange('name-asc')}>A → Z</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortOrderChange('name-desc')}>Z → A</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <SortableContext items={sortableFolderIds} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 gap-x-3 gap-y-6 pt-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(140px,168px))]">
          {sortedFolders.map((folder) => (
            <SortableDroppableIdeaFolderCard
              key={folder.id}
              folder={folder}
              isIdeaDragActive={isIdeaDragActive}
              isDropOver={dropTargetFolderId === folder.id}
              onOpen={() => onOpenFolder(folder.id)}
              onRename={(name) => onRenameFolder(folder.id, name)}
              onDelete={() => onDeleteFolder(folder)}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

function SortableDroppableIdeaFolderCard({
  folder,
  isIdeaDragActive,
  isDropOver,
  onOpen,
  onRename,
  onDelete,
}: {
  folder: IdeaBacklogFolder
  isIdeaDragActive: boolean
  isDropOver: boolean
  onOpen: () => void
  onRename: (name: string) => Promise<void>
  onDelete: () => void
}) {
  const sortableId = `folder-${folder.id}`
  const ideaDropId = `folder-drop-${folder.id}`
  const nestDropId = `folder-nest-${folder.id}`
  const { setNodeRef: setIdeaDropRef } = useDroppable({
    id: ideaDropId,
    data: { type: 'folder-drop', folder, accepts: ['idea'] },
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
    disabled: isIdeaDragActive,
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
      <div ref={setIdeaDropRef} className="pointer-events-none absolute inset-0 z-0" aria-hidden />
      <div
        ref={setNestDropRef}
        className="pointer-events-none absolute bottom-[16%] left-[8%] right-[8%] top-[18%] z-[1]"
        aria-hidden
      />
      <div className="relative z-[2] w-full">
        <IdeaBacklogFolderCard
          folder={folder}
          isDropOver={isDropOver}
          onOpen={onOpen}
          onRename={onRename}
          onDelete={onDelete}
        />
      </div>
    </div>
  )
}
