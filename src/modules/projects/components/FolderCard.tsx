import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, StickyNote, MessageSquare, ListTodo, Palette, UserPlus, FolderPlus } from 'lucide-react'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import styles from './FolderCard.module.css'
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu'
import { useToast } from '@/components/ui/toast'
import { useFolderStore } from '@/modules/projects'
import { notifyEvent } from '@/lib/api/notificationApi'
import { createTodo, TECTONA_TODO_APP_ID, buildTodoEntityLinks } from '@/lib/api/todoApi'

export interface FolderCardProps {
  id: string
  name: string
  projectCount: number
  /** Folder has todos (title starts with "Todo for {name}") */
  hasTodos?: boolean
  /** Newline-joined todo titles for tooltip */
  todoListTooltip?: string
  parentId?: string | null
  isShared?: boolean
  isSelected?: boolean
  isDragOver?: boolean
  onClick?: () => void
  onOpen?: () => void
  onShare?: () => void
  onDelete?: () => void
  onSelect?: (folderId: string, selected: boolean) => void
  onRenameFolder?: () => void
  onAddProject?: () => void
}

export function FolderCard({
  id,
  name,
  projectCount,
  hasTodos = false,
  todoListTooltip = '',
  parentId = null,
  isShared = false,
  isSelected = false,
  isDragOver = false,
  onClick,
  onOpen,
  onShare,
  onDelete,
  onSelect,
  onRenameFolder,
  onAddProject,
}: FolderCardProps) {
  const { addToast } = useToast()
  const { updateFolder, isFolderNameUnique } = useFolderStore()
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(name)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(name)
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }
  }, [isRenaming, name])

  const saveRename = async () => {
    const trimmed = renameValue.trim()
    if (trimmed === '' || trimmed === name) {
      setIsRenaming(false)
      return
    }
    if (trimmed.length < 3) {
      addToast({ title: 'Nama folder minimal 3 karakter', variant: 'error' })
      return
    }
    if (trimmed.length > 40) {
      addToast({ title: 'Nama folder maksimal 40 karakter', variant: 'error' })
      return
    }
    if (!isFolderNameUnique(trimmed, id, parentId ?? null)) {
      addToast({ title: 'Nama folder sudah dipakai', variant: 'error' })
      return
    }
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    try {
      await updateFolder(id, { name: trimmed })
      addToast({ title: 'Folder diubah', description: `Menjadi "${trimmed}".`, variant: 'success' })
      notifyEvent({ type_code: 'folder', title: 'Folder diubah', body: `Menjadi "${trimmed}".` })
    } catch (e) {
      addToast({ title: 'Error', description: e instanceof Error ? e.message : 'Gagal mengubah folder', variant: 'error' })
    }
    setIsRenaming(false)
    requestAnimationFrame(() => window.scrollTo(scrollX, scrollY))
  }

  const cancelRename = () => {
    setRenameValue(name)
    setIsRenaming(false)
  }

  const open = () => {
    if (onOpen) return onOpen()
    onClick?.()
  }

  const handleClick = (e: React.MouseEvent) => {
    if (isRenaming) return
    if ((e.target as HTMLElement).closest('[role="menuitem"]')) return
    onSelect?.(id, !isSelected)
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isRenaming) return
    if ((e.target as HTMLElement).closest('[role="menuitem"]')) return
    open()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (addTodoPopover) return // jangan tangkap Enter/Space saat modal Add todo terbuka
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open()
    }
  }

  const metaLabel = `${projectCount} ${projectCount === 1 ? 'project' : 'projects'}`
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const closeContextMenu = () => setContextMenu(null)

  const [addTodoPopover, setAddTodoPopover] = useState<{ x: number; y: number } | null>(null)
  const [addTodoTitle, setAddTodoTitle] = useState('')
  const addTodoInputRef = useRef<HTMLInputElement>(null)
  const addTodoPopoverRef = useRef<HTMLDivElement>(null)
  const [addTodoSubmitting, setAddTodoSubmitting] = useState(false)

  useEffect(() => {
    if (addTodoPopover) {
      setAddTodoTitle(`Todo for ${name}`)
      const t = requestAnimationFrame(() => addTodoInputRef.current?.focus())
      return () => cancelAnimationFrame(t)
    }
  }, [addTodoPopover, name])

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

  const hasProjects = projectCount > 0

  return (
    <div
      className={cn(
        styles.folderCard,
        'folder-card',
        isSelected && styles.selected,
        isDragOver && styles.dragOver,
        hasProjects && styles.hasProjects
      )}
      role="button"
      tabIndex={0}
      aria-label={`Open folder ${name}`}
      data-folder-id={id}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setContextMenu({ x: e.clientX, y: e.clientY })
      }}
    >
      <div className={cn(styles.folderTab, 'folder-tab')} aria-hidden="true" />

      <div className={cn(styles.folderBody, 'folder-body')}>
        {hasProjects && (
          <div className={styles.folderPapers} aria-hidden="true">
            <span className={styles.paper} />
            <span className={styles.paper} />
            <span className={styles.paper} />
            <span className={styles.paper} />
          </div>
        )}
        {isShared && (
          <div className={styles.sharedBadge} aria-label="Shared folder">
            Shared
          </div>
        )}

        <div className={styles.folderTitleRow}>
          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={saveRename}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') {
                  cancelRename()
                  e.currentTarget.blur()
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className={cn(styles.folderTitle, 'folder-title w-full min-w-0 px-1 py-0.5 rounded border border-primary/50 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30')}
              placeholder="Folder name"
            />
          ) : (
            <div className={cn(styles.folderTitle, 'folder-title min-w-0 flex-1')}>
              {name}
            </div>
          )}
          {hasTodos && (() => {
            const todoCount = todoListTooltip ? todoListTooltip.split('\n').filter(Boolean).length : 0
            const iconBox = (
              <div
                className="shrink-0 relative flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary cursor-default"
                role="img"
                aria-label={todoCount ? `Folder todos (${todoCount})` : 'Folder has todos'}
              >
                <ListTodo className="w-3.5 h-3.5" aria-hidden />
                {todoCount > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-0.5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-semibold"
                    aria-hidden
                  >
                    {todoCount > 99 ? '99+' : todoCount}
                  </span>
                )}
              </div>
            )
            return todoListTooltip ? (
              <Tooltip
                content={
                  <>
                    <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                      Todo for {name}
                    </div>
                    <div className="border-t border-slate-200/80 dark:border-slate-600/80 mt-2 pt-2" />
                    <ul className="space-y-1.5 text-[13px] font-normal text-slate-700 dark:text-slate-300 leading-relaxed list-none mt-2">
                      {todoListTooltip.split('\n').filter(Boolean).map((line, i) => {
                        const colon = line.indexOf(': ')
                        const label = colon >= 0 ? line.slice(colon + 2) : line
                        return (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-slate-400 dark:text-slate-500 shrink-0">•</span>
                            <span>{label}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                }
                side="bottom"
              >
                {iconBox}
              </Tooltip>
            ) : (
              iconBox
            )
          })()}
        </div>

        <ContextMenu
          open={!!contextMenu}
          x={contextMenu?.x ?? 0}
          y={contextMenu?.y ?? 0}
          onClose={closeContextMenu}
        >
          <ContextMenuItem
            onClick={() => {
              open()
              closeContextMenu()
            }}
          >
            Open
          </ContextMenuItem>
          {onRenameFolder && (
            <ContextMenuItem onClick={() => { closeContextMenu(); setIsRenaming(true); }}>
              <Pencil className="w-4 h-4 mr-2" />
              Rename Folder
            </ContextMenuItem>
          )}
          {onAddProject && (
            <ContextMenuItem onClick={() => { onAddProject(); closeContextMenu(); }}>
              <FolderPlus className="w-4 h-4 mr-2" />
              Add Project
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => { addToast({ title: 'Add notes', description: 'Fitur akan segera hadir.', variant: 'default' }); closeContextMenu(); }}>
            <StickyNote className="w-4 h-4 mr-2" />
            Add notes
          </ContextMenuItem>
          <ContextMenuItem onClick={() => { addToast({ title: 'Add Comment', description: 'Fitur akan segera hadir.', variant: 'default' }); closeContextMenu(); }}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Add Comment
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              const pos = contextMenu ? { x: contextMenu.x, y: contextMenu.y } : { x: 0, y: 0 }
              closeContextMenu()
              setAddTodoPopover(pos)
            }}
          >
            <ListTodo className="w-4 h-4 mr-2" />
            Add Todo
          </ContextMenuItem>
          <ContextMenuItem onClick={() => { addToast({ title: 'Change color', description: 'Fitur akan segera hadir.', variant: 'default' }); closeContextMenu(); }}>
            <Palette className="w-4 h-4 mr-2" />
            Change color
          </ContextMenuItem>
          <ContextMenuItem onClick={() => { addToast({ title: 'Add member', description: 'Fitur akan segera hadir.', variant: 'default' }); closeContextMenu(); }}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add member
          </ContextMenuItem>
          {onShare && (
            <ContextMenuItem onClick={() => { onShare(); closeContextMenu(); }}>
              Share
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          {onDelete && (
            <ContextMenuItem
              className="text-destructive"
              onClick={() => {
                onDelete()
                closeContextMenu()
              }}
            >
              Delete
            </ContextMenuItem>
          )}
        </ContextMenu>

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
                  if (addTodoTitle.trim()) {
                    setAddTodoSubmitting(true)
                    createTodo({
                      title: addTodoTitle.trim(),
                      app_id: TECTONA_TODO_APP_ID,
                      entity_links: buildTodoEntityLinks(null),
                    })
                      .then(() => {
                        addToast({ title: 'Todo added', variant: 'success' })
                        setAddTodoPopover(null)
                        window.dispatchEvent(new CustomEvent('sequoia-todos-changed'))
                      })
                      .catch((err) => {
                        addToast({ title: 'Failed to add todo', description: err instanceof Error ? err.message : 'Error', variant: 'error' })
                      })
                      .finally(() => setAddTodoSubmitting(false))
                  }
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
                onClick={() => {
                  if (!addTodoTitle.trim()) return
                  setAddTodoSubmitting(true)
                  createTodo({
                    title: addTodoTitle.trim(),
                    app_id: TECTONA_TODO_APP_ID,
                    entity_links: buildTodoEntityLinks(null),
                  })
                    .then(() => {
                      addToast({ title: 'Todo added', variant: 'success' })
                      setAddTodoPopover(null)
                      window.dispatchEvent(new CustomEvent('sequoia-todos-changed'))
                    })
                    .catch((err) => {
                      addToast({ title: 'Failed to add todo', description: err instanceof Error ? err.message : 'Error', variant: 'error' })
                    })
                    .finally(() => setAddTodoSubmitting(false))
                }}
                className="px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {addTodoSubmitting ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>,
          document.body
        )}

        <div
          className={cn(
            styles.folderMeta,
            'folder-meta',
            projectCount === 0 && styles.folderMetaMuted
          )}
        >
          {metaLabel}
        </div>

        {isDragOver && (
          <div className={styles.dragOverOverlay} aria-hidden="true">
            <div className={styles.dragOverText}>Drop to add</div>
          </div>
        )}
      </div>
    </div>
  )
}
