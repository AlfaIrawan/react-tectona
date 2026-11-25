import { ChevronRight, Folder, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface FolderItem { id: string; name: string; ideaCount: number }
export function MobileIdeaFolders<T extends FolderItem>({ folders, onOpen, onRename, onDelete }: {
  folders: T[]
  onOpen: (id: string) => void
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (folder: T) => void
}) {
  return <ul className="divide-y divide-border rounded-md bg-background/90">
    {folders.map((folder) => <li key={folder.id} className="flex items-center">
      <button type="button" className="flex min-h-14 min-w-0 flex-1 items-center gap-3 p-3 text-left" onClick={() => onOpen(folder.id)}>
        <Folder className="h-5 w-5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 break-words text-sm font-medium">{folder.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{folder.ideaCount} ideas</span>
        <ChevronRight className="h-4 w-4 shrink-0" />
      </button>
      <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center" aria-label={`Actions for ${folder.name}`} title="Folder actions"><MoreHorizontal className="h-5 w-5" /></button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => { const name = window.prompt('Folder name', folder.name); if (name?.trim() && name.trim() !== folder.name) void onRename(folder.id, name.trim()) }}><Pencil className="mr-2 h-4 w-4" />Rename folder</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDelete(folder)}><Trash2 className="mr-2 h-4 w-4" />Delete folder</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>)}
  </ul>
}
