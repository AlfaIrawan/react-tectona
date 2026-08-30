import { useState, useRef, useEffect, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import styles from '@/modules/projects/components/FolderCard.module.css'
import { buildFolderCardThemeVariables } from '@/modules/projects/lib/folderColorPalette'
import { ContextMenu } from '@/components/ui/context-menu'
import { useToast } from '@/components/ui/toast'
import { getSession } from '@/auth/authService'
import { createTodo, TECTONA_TODO_APP_ID, buildTodoEntityLinks } from '@/lib/api/todoApi'
import type { IdeaBacklogFolder } from '../store/ideaFolderStore'
import { IdeaFolderContextMenuContent } from './IdeaFolderContextMenuContent'
import { IdeaFolderNotesDrawer } from './IdeaFolderNotesDrawer'
import { ShareIdeaFolderDrawer } from './ShareIdeaFolderDrawer'

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
  const { addToast } = useToast()
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(folder.name)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const hasIdeas = folder.ideaCount > 0
  const hasChildFolders = folder.childrenCount > 0
  const contentsLabel = `${folder.childrenCount} ${folder.childrenCount === 1 ? 'folder' : 'folders'} · ${folder.ideaCount} ${folder.ideaCount === 1 ? 'idea' : 'ideas'}`
  const themedStyle = folder.borderColor
    ? (buildFolderCardThemeVariables(folder.borderColor, hasIdeas) as CSSProperties)
    : undefined

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

  const [notesOpen, setNotesOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const [addTodoPopover, setAddTodoPopover] = useState<{ x: number; y: number } | null>(null)
  const [addTodoTitle, setAddTodoTitle] = useState('')
  const addTodoInputRef = useRef<HTMLInputElement>(null)
  const addTodoPopoverRef = useRef<HTMLDivElement>(null)
  const [addTodoSubmitting, setAddTodoSubmitting] = useState(false)

  useEffect(() => {
    if (addTodoPopover) {
      setAddTodoTitle(`Todo for ${folder.name}`)
      const t = requestAnimationFrame(() => addTodoInputRef.current?.focus())
      return () => cancelAnimationFrame(t)
    }
  }, [addTodoPopover, folder.name])

  useEffect(() => {
    if (!addTodoPopover) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAddTodoPopover(null)
    }
    const onMouseDown = (e: MouseEvent) => {
      if (addTodoPopoverRef.current?.contains(e.target as Node)) return
      setAddTodoPopover(null)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown, true)
    }
  }, [addTodoPopover])

  const submitAddTodo = () => {
    if (!addTodoTitle.trim()) return
    const userId = getSession()?.user.id
    if (!userId) {
      addToast({
        title: 'Failed to add todo',
        description: 'Sesi tidak ditemukan. Silakan login ulang.',
        variant: 'error',
      })
      return
    }
    setAddTodoSubmitting(true)
    createTodo({
      title: addTodoTitle.trim(),
      app_id: TECTONA_TODO_APP_ID,
      owned_by: userId,
      entity_links: buildTodoEntityLinks(null),
    })
      .then(() => {
        addToast({ title: 'Todo added', variant: 'success' })
        setAddTodoPopover(null)
        window.dispatchEvent(new CustomEvent('tectona-todos-changed'))
        window.dispatchEvent(new CustomEvent('sequoia-todos-changed'))
      })
      .catch((err) => {
        addToast({
          title: 'Failed to add todo',
          description: err instanceof Error ? err.message : 'Error',
          variant: 'error',
        })
      })
      .finally(() => setAddTodoSubmitting(false))
  }

  return (
    <div className={cn(styles.folderCardWrapper, isDropOver && styles.projectDropTargetWrapper)}>
      <div
        className={cn(
          styles.folderCard,
          'folder-card',
          folder.borderColor && styles.folderCardThemed,
          hasIdeas && styles.hasProjects,
          isDropOver && styles.projectDropTarget,
        )}
        style={themedStyle}
        role="button"
        tabIndex={0}
        aria-label={`Open folder ${folder.name}`}
        onClick={(event) => {
          if (isRenaming) return
          if ((event.target as HTMLElement).closest('[role="menuitem"]')) return
          onOpen()
        }}
        onDoubleClick={(event) => {
          event.preventDefault()
          if (isRenaming) return
          if ((event.target as HTMLElement).closest('[role="menuitem"]')) return
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
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                className={cn(
                  styles.folderTitle,
                  'folder-title w-full min-w-0 select-text cursor-text rounded border border-primary/50 bg-background px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/30',
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
            <IdeaFolderContextMenuContent
              folder={{
                id: folder.id,
                name: folder.name,
                parentId: folder.parentId,
                borderColor: folder.borderColor,
              }}
              onClose={() => setContextMenu(null)}
              onOpen={onOpen}
              onRenameFolder={onRename ? () => setIsRenaming(true) : undefined}
              onDelete={onDelete}
              onAddTodo={() => {
                const pos = contextMenu ? { x: contextMenu.x, y: contextMenu.y } : { x: 0, y: 0 }
                setAddTodoPopover(pos)
              }}
              onAddNotes={() => setNotesOpen(true)}
              onShare={() => setShareOpen(true)}
            />
          </ContextMenu>

          <IdeaFolderNotesDrawer
            open={notesOpen}
            folder={{ id: folder.id, name: folder.name }}
            onOpenChange={setNotesOpen}
            autoFocusComposer
          />

          <ShareIdeaFolderDrawer open={shareOpen} onOpenChange={setShareOpen} folder={folder} />

          {addTodoPopover &&
            createPortal(
              <div
                ref={addTodoPopoverRef}
                className="fixed z-[1200] w-[280px] rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-xl p-3 flex flex-col gap-3"
                style={{
                  left: Math.min(addTodoPopover.x, window.innerWidth - 296),
                  top: addTodoPopover.y + 8,
                }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <p className="text-xs font-medium text-muted-foreground">Add todo</p>
                <input
                  ref={addTodoInputRef}
                  type="text"
                  value={addTodoTitle}
                  onChange={(e) => setAddTodoTitle(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      submitAddTodo()
                    }
                  }}
                  placeholder="Todo title..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAddTodoPopover(null)}
                    className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!addTodoTitle.trim() || addTodoSubmitting}
                    onClick={submitAddTodo}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    {addTodoSubmitting ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </div>,
              document.body,
            )}

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
