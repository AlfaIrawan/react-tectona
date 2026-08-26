import { FolderOpen } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { useFolderStore } from '@/modules/projects'
import { enterpriseIndigoGradientActionButtonClass } from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'

interface SelectionActionBarProps {
  selectedProjectCount: number
  selectedFolderCount: number
  onMoveToFolder: (folderId: string | null) => void
  className?: string
  /** Saat true, render di dalam panel search (tanpa sticky/liquid-glass-enterprise-panel). */
  inline?: boolean
}

export function SelectionActionBar({
  selectedProjectCount,
  selectedFolderCount,
  onMoveToFolder,
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
          : 'sticky bottom-4 z-40 liquid-glass-enterprise-panel rounded-xl p-4 shadow-lg border-2 border-primary/20',
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
                  <button type="button" className={enterpriseIndigoGradientActionButtonClass()}>
                    <FolderOpen
                      className="h-4 w-4 transition-transform duration-200 group-hover:scale-110"
                      strokeWidth={2.5}
                    />
                    Move to Folder
                  </button>
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
