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
  actionLabel?: string
  rootDestinationLabel?: string
  hideAction?: boolean
  onBrowseChange?: (folderId: string | null) => void
  onSelect: (folderId: string | null) => void
}

export function RepositoryMoveFolderPicker({
  folders,
  initialParentId,
  excludeFolderId = null,
  currentParentId = null,
  showRootDestination = true,
  actionLabel = 'Move here',
  rootDestinationLabel = 'All documents (root)',
  hideAction = false,
  onBrowseChange,
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
  const browsePath = useMemo(() => {
    const ancestors: string[] = []
    const visited = new Set<string>()
    let folderId = browseParentId

    while (folderId && !visited.has(folderId)) {
      visited.add(folderId)
      const folder = folders.find((candidate) => candidate.id === folderId)
      if (!folder) break
      ancestors.unshift(folder.name)
      folderId = folderParentId(folders, folderId)
    }

    return ['Repository home', ...ancestors]
  }, [browseParentId, folders])

  const canMoveHere = browseParentId === null
    ? currentParentId !== null
    : browseParentId !== currentParentId
      && browseParentId !== excludeFolderId
      && !(excludeFolderId && isDocumentFolderDescendant(folders, excludeFolderId, browseParentId))

  useEffect(() => {
    onBrowseChange?.(browseParentId)
  }, [browseParentId, onBrowseChange])

  return (
    <div className="w-full">
      <div className="mb-3 flex min-w-0 items-center gap-1.5 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <FolderOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 truncate font-medium text-foreground" title={browsePath.join(' / ')}>{browsePath.join(' / ')}</span>
      </div>
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
      {showRootDestination ? (
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left text-sm hover:bg-accent/80 hover:text-accent-foreground"
          onClick={() => setBrowseParentId(null)}
        >
          <Folder className="h-4 w-4 shrink-0" aria-hidden />
          {rootDestinationLabel}
        </button>
      ) : null}
      {canMoveHere && !hideAction ? (
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-3 rounded-lg border border-primary/30 bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          onClick={() => onSelect(browseParentId)}
        >
          <FolderInput className="h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 truncate">{browseParentId ? `${actionLabel} (${browseFolder?.name ?? 'folder'})` : `${actionLabel} (repository root)`}</span>
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
              onClick={() => setBrowseParentId(folder.id)}
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
      {siblings.length === 0 && !canMoveHere ? (
        <div className="px-4 py-2.5 text-sm text-muted-foreground">No folders at this level.</div>
      ) : null}
    </div>
  )
}
