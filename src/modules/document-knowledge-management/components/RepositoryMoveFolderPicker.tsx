import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, CornerLeftUp, Folder, FolderInput, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  folderHasVisibleChildren,
  folderParentId,
  isDocumentFolderDescendant,
  listSiblingFolders,
  type FolderNavItem,
} from '@/modules/document-knowledge-management/lib/repositoryFolderNav'

export type RepositoryMoveFolderPickerProps = {
  folders: readonly FolderNavItem[]
  /** Parent whose children are shown first (siblings of the item being moved). */
  initialParentId: string | null
  /** When moving a folder, omit it and its subtree. */
  excludeFolderId?: string | null
  /** Current parent of the moved item — hide no-op destinations. */
  currentParentId?: string | null
  showRootDestination?: boolean
  onSelect: (folderId: string | null) => void
}

export function RepositoryMoveFolderPicker({
  folders,
  initialParentId,
  excludeFolderId = null,
  currentParentId = null,
  showRootDestination = true,
  onSelect,
}: RepositoryMoveFolderPickerProps) {
  const [browseParentId, setBrowseParentId] = useState<string | null>(initialParentId)

  useEffect(() => {
    setBrowseParentId(initialParentId)
  }, [initialParentId])

  const siblings = useMemo(
    () => listSiblingFolders(folders, browseParentId, { excludeFolderId }),
    [folders, browseParentId, excludeFolderId],
  )
  const browseFolder = browseParentId
    ? folders.find((folder) => folder.id === browseParentId) ?? null
    : null
  const upParentId = folderParentId(folders, browseParentId)
  const upLabel = browseParentId
    ? (folders.find((folder) => folder.id === upParentId)?.name ?? 'All documents')
    : null

  const canMoveHere = Boolean(
    browseParentId
    && browseParentId !== currentParentId
    && browseParentId !== excludeFolderId
    && !(excludeFolderId && isDocumentFolderDescendant(folders, excludeFolderId, browseParentId)),
  )
  const canMoveToRoot = showRootDestination && currentParentId !== null

  return (
    <div className="w-full">
      {browseParentId ? (
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left text-sm hover:bg-accent/80 hover:text-accent-foreground"
          onClick={() => setBrowseParentId(upParentId)}
        >
          <CornerLeftUp className="h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 truncate">../ {upLabel}</span>
        </button>
      ) : null}
      {canMoveToRoot ? (
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left text-sm hover:bg-accent/80 hover:text-accent-foreground"
          onClick={() => onSelect(null)}
        >
          <Folder className="h-4 w-4 shrink-0" aria-hidden />
          All documents (root)
        </button>
      ) : null}
      {canMoveHere ? (
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left text-sm hover:bg-accent/80 hover:text-accent-foreground"
          onClick={() => onSelect(browseParentId)}
        >
          <FolderInput className="h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 truncate">Move here ({browseFolder?.name ?? 'folder'})</span>
        </button>
      ) : null}
      {siblings.map((folder) => {
        const canEnter = folderHasVisibleChildren(folders, folder.id, { excludeFolderId })
        return (
          <div
            key={folder.id}
            className="mx-1 flex items-stretch rounded-lg hover:bg-accent/80 hover:text-accent-foreground"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left text-sm"
              onClick={() => onSelect(folder.id)}
            >
              <FolderOpen className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">{folder.name}</span>
            </button>
            {canEnter ? (
              <button
                type="button"
                className={cn(
                  'flex shrink-0 items-center px-2 text-muted-foreground hover:text-foreground',
                )}
                title={`Open ${folder.name}`}
                aria-label={`Open ${folder.name}`}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setBrowseParentId(folder.id)
                }}
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>
        )
      })}
      {siblings.length === 0 && !canMoveHere && !canMoveToRoot ? (
        <div className="px-4 py-2.5 text-sm text-muted-foreground">No folders at this level.</div>
      ) : null}
    </div>
  )
}
