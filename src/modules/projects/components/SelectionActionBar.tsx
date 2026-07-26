import { FolderOpen, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { useFolderStore } from '@/modules/projects'
import { cn } from '@/lib/utils'

interface SelectionActionBarProps {
  selectedProjectCount: number
  selectedFolderCount: number
  onClear: () => void
  onMoveToFolder: (folderId: string | null) => void
  /** Jumlah project archived di antara yang terpilih; tombol Delete tampil jika > 0. */
  archivedSelectedCount?: number
  onDeleteSelected?: () => void
  className?: string
  /** Saat true, render di dalam panel search (tanpa sticky/glass-card). */
  inline?: boolean
}

export function SelectionActionBar({
  selectedProjectCount,
  selectedFolderCount,
  onClear,
  onMoveToFolder,
  archivedSelectedCount = 0,
  onDeleteSelected,
  className,
  inline = false,
}: SelectionActionBarProps) {
  const { folders } = useFolderStore()
  const totalSelected = selectedProjectCount + selectedFolderCount

  if (totalSelected === 0) return null

  const isProjectsSelected = selectedProjectCount > 0

  return (
    <div
      className={cn(
        inline
          ? 'flex items-center gap-2 shrink-0'
          : 'sticky bottom-4 z-40 glass-card rounded-xl p-4 shadow-lg border-2 border-primary/20',
        className
      )}
    >
      <div className={inline ? 'flex items-center gap-2' : 'flex items-center justify-between'}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">
            {isProjectsSelected
              ? `${selectedProjectCount} ${selectedProjectCount === 1 ? 'project' : 'projects'} selected`
              : `${selectedFolderCount} ${selectedFolderCount === 1 ? 'folder' : 'folders'} selected`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isProjectsSelected && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" size="sm">
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Move to Folder
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top">
                  <DropdownMenuItem onClick={() => onMoveToFolder(null)}>
                    All Projects
                  </DropdownMenuItem>
                  {folders.map((folder) => (
                    <DropdownMenuItem
                      key={folder.id}
                      onClick={() => onMoveToFolder(folder.id)}
                    >
                      {folder.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {archivedSelectedCount > 0 && onDeleteSelected && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onDeleteSelected}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete{archivedSelectedCount > 1 ? ` (${archivedSelectedCount})` : ''}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
