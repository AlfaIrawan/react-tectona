import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import styles from '@/modules/projects/components/FolderCard.module.css'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import type { IdeaBacklogFolder } from '../store/ideaFolderStore'

export interface IdeaBacklogFolderCardProps {
  folder: IdeaBacklogFolder
  onOpen: () => void
  onRename?: (name: string) => Promise<void>
  onDelete?: () => void
  isDropOver?: boolean
}

export function IdeaBacklogFolderCard({
  folder,
  onOpen,
  onRename,
  onDelete,
  isDropOver = false,
}: IdeaBacklogFolderCardProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(folder.name)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const hasIdeas = folder.ideaCount > 0
  const hasChildFolders = folder.childrenCount > 0
  const contentsLabel = `${folder.childrenCount} ${folder.childrenCount === 1 ? 'folder' : 'folders'} · ${folder.ideaCount} ${folder.ideaCount === 1 ? 'idea' : 'ideas'}`

  useEffect(() => {
    setRenameValue(folder.name)
  }, [folder.name])

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(folder.name)
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }
  }, [isRenaming, folder.name])

  const commitRename = async () => {
    const next = renameValue.trim()
    if (next === '' || next === folder.name) {
      setIsRenaming(false)
      return
    }
    setIsRenaming(false)
    if (!onRename) return
    await onRename(next)
  }

  const cancelRename = () => {
    setRenameValue(folder.name)
    setIsRenaming(false)
  }

  return (
    <div className={cn(styles.folderCardWrapper, isDropOver && styles.projectDropTargetWrapper)}>
      <div
        className={cn(
          styles.folderCard,
          'folder-card',
          hasIdeas && styles.hasProjects,
          isDropOver && styles.projectDropTarget,
        )}
        role="button"
        tabIndex={0}
        aria-label={`Open folder ${folder.name}`}
        onClick={() => {
          if (isRenaming) return
          onOpen()
        }}
        onDoubleClick={(event) => {
          event.preventDefault()
          if (isRenaming) return
          onOpen()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpen()
          }
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setContextMenu({ x: event.clientX, y: event.clientY })
        }}
      >
        <div className={cn(styles.folderTab, 'folder-tab')} aria-hidden="true" />

        <div className={cn(styles.folderBody, 'folder-body')}>
          {(hasIdeas || hasChildFolders) && (
            <div className={styles.folderPapers} aria-hidden="true">
              <span className={styles.paper} />
              <span className={styles.paper} />
              <span className={styles.paper} />
              <span className={styles.paper} />
            </div>
          )}

          <div className={styles.folderTitleRow}>
            {isRenaming ? (
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onBlur={() => void commitRename()}
                onKeyDown={(event) => {
                  event.stopPropagation()
                  if (event.key === 'Enter') event.currentTarget.blur()
                  if (event.key === 'Escape') {
                    cancelRename()
                    event.currentTarget.blur()
                  }
                }}
                onClick={(event) => event.stopPropagation()}
                className={cn(
                  styles.folderTitle,
                  'folder-title w-full min-w-0 rounded border border-primary/50 bg-background px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/30',
                )}
                placeholder="Folder name"
              />
            ) : (
              <div className={cn(styles.folderTitle, 'folder-title min-w-0 flex-1')}>{folder.name}</div>
            )}
          </div>

          <ContextMenu
            open={!!contextMenu}
            x={contextMenu?.x ?? 0}
            y={contextMenu?.y ?? 0}
            onClose={() => setContextMenu(null)}
          >
            <ContextMenuItem
              onClick={() => {
                onOpen()
                setContextMenu(null)
              }}
            >
              Open folder
            </ContextMenuItem>
            {onRename && (
              <ContextMenuItem
                onClick={() => {
                  setIsRenaming(true)
                  setContextMenu(null)
                }}
              >
                Rename
              </ContextMenuItem>
            )}
            {onDelete && (
              <ContextMenuItem
                onClick={() => {
                  onDelete()
                  setContextMenu(null)
                }}
              >
                Delete folder
              </ContextMenuItem>
            )}
          </ContextMenu>

          <div
            className={cn(
              styles.folderMeta,
              'folder-meta',
              !hasIdeas && !hasChildFolders && styles.folderMetaMuted,
            )}
          >
            {contentsLabel}
          </div>
        </div>
      </div>
      {isDropOver ? (
        <div className={styles.dropHintBelow} aria-hidden>
          <span className={styles.dropHintArrow}>→</span>
          Move to {folder.name}
        </div>
      ) : null}
    </div>
  )
}
