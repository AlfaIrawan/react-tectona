import { useState, useRef, useEffect, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ListTodo, StickyNote } from 'lucide-react'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import styles from './FolderCard.module.css'
import { ContextMenu } from '@/components/ui/context-menu'
import { useToast } from '@/components/ui/toast'
import { useFolderStore } from '@/modules/projects'
import { notifyEvent } from '@/lib/api/notificationApi'
import { createTodo, TECTONA_TODO_APP_ID, buildTodoEntityLinks } from '@/lib/api/todoApi'
import { getSession } from '@/auth/authService'
import type { GridSelectionModifiers } from '../lib/gridSelection'
import { FolderContextMenuContent } from './FolderContextMenuContent'
import { buildFolderCardThemeVariables } from '../lib/folderColorPalette'
import { formatFolderContentsLabel } from '../lib/folderHierarchy'

export interface FolderCardProps {
  id: string
  name: string
  projectCount: number
  childFolderCount?: number
  /** Folder has todos (title starts with "Todo for {name}") */
  hasTodos?: boolean
  /** Newline-joined todo titles for tooltip */
  todoListTooltip?: string
  /** Newline-joined note titles for tooltip */
  notesTooltip?: string
  noteCount?: number
  parentId?: string | null
  borderColor?: string
  isShared?: boolean
  isSelected?: boolean
  /** True when a project is dragged over this folder (not folder reorder). */
  isProjectDropOver?: boolean
  isDragOver?: boolean
  onClick?: () => void
  onOpen?: () => void
  onShare?: () => void
  onDelete?: () => void
  onSelect?: (folderId: string, modifiers: GridSelectionModifiers) => void
  onRenameFolder?: () => void
  onAddProject?: () => void
  onOpenFolderNotes?: (options?: { autoFocusComposer?: boolean }) => void
  multiSelectActive?: boolean
  onDeleteSelected?: () => void
}

export function FolderCard({
  id,
  name,
  projectCount,
  childFolderCount = 0,
  hasTodos = false,
  todoListTooltip = '',
  notesTooltip = '',
  noteCount = 0,
  parentId = null,
  borderColor,
  isShared = false,
  isSelected = false,
  isProjectDropOver = false,
  isDragOver = false,
  onClick,
  onOpen,
  onShare,
  onDelete,
  onSelect,
  onRenameFolder,
  onAddProject,
  onOpenFolderNotes,
  multiSelectActive = false,
  onDeleteSelected,
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
      addToast({ title: 'Folder name must be at least 3 characters', variant: 'error' })
      return
    }
    if (trimmed.length > 40) {
      addToast({ title: 'Folder name must be at most 40 characters', variant: 'error' })
      return
    }
    if (!isFolderNameUnique(trimmed, id, parentId ?? null)) {
      addToast({ title: 'Folder name already exists', variant: 'error' })
      return
    }
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    try {
      await updateFolder(id, { name: trimmed })
      addToast({ title: 'Folder updated', description: `Renamed to "${trimmed}".`, variant: 'success' })
      notifyEvent({ type_code: 'folder', title: 'Folder updated', body: `Renamed to "${trimmed}".` })
    } catch (e) {
      addToast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to update folder', variant: 'error' })
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
    onSelect?.(id, {
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
    })
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

  const metaLabel = formatFolderContentsLabel(projectCount, childFolderCount)
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
  const hasChildFolders = childFolderCount > 0
  const themedStyle = borderColor
    ? (buildFolderCardThemeVariables(borderColor, hasProjects) as CSSProperties)
    : undefined

  const showProjectDropTarget = isProjectDropOver

  return (
    <div
      className={cn(styles.folderCardWrapper, showProjectDropTarget && styles.projectDropTargetWrapper)}
    >
    <div
      className={cn(
        styles.folderCard,
        'folder-card',
        borderColor && styles.folderCardThemed,
        isSelected && styles.selected,
        showProjectDropTarget && styles.projectDropTarget,
        hasProjects && styles.hasProjects
      )}
      style={themedStyle}
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
        {(hasProjects || hasChildFolders) && (
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
          {noteCount > 0 && onOpenFolderNotes && (() => {
            const notesIcon = (
              <button
                type="button"
                className="shrink-0 relative flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/12 text-amber-700 hover:bg-amber-500/20 transition-colors"
                aria-label={`Folder notes (${noteCount})`}
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenFolderNotes()
                }}
              >
                <StickyNote className="w-3.5 h-3.5" aria-hidden />
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-0.5 flex items-center justify-center rounded-full bg-amber-600 text-white text-[9px] font-semibold"
                  aria-hidden
                >
                  {noteCount > 99 ? '99+' : noteCount}
                </span>
              </button>
            )
            return notesTooltip ? (
              <Tooltip
                content={
                  <>
                    <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                      Notes for {name}
                    </div>
                    <div className="border-t border-slate-200/80 dark:border-slate-600/80 mt-2 pt-2" />
                    <ul className="space-y-1.5 text-[13px] font-normal text-slate-700 dark:text-slate-300 leading-relaxed list-none mt-2">
                      {notesTooltip.split('\n').filter(Boolean).map((line, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-slate-400 dark:text-slate-500 shrink-0">•</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                }
                side="bottom"
              >
                {notesIcon}
              </Tooltip>
            ) : (
              notesIcon
            )
          })()}
        </div>

        <ContextMenu
          open={!!contextMenu}
          x={contextMenu?.x ?? 0}
          y={contextMenu?.y ?? 0}
          onClose={closeContextMenu}
        >
          <FolderContextMenuContent
            folder={{ id, name, parentId, borderColor, isShared }}
            multiSelectActive={multiSelectActive}
            onClose={closeContextMenu}
            onOpen={open}
            onRenameFolder={onRenameFolder ? () => setIsRenaming(true) : undefined}
            onAddProject={onAddProject}
            onShare={onShare}
            onDelete={onDelete}
            onDeleteSelected={onDeleteSelected}
            onAddTodo={() => {
              const pos = contextMenu ? { x: contextMenu.x, y: contextMenu.y } : { x: 0, y: 0 }
              setAddTodoPopover(pos)
            }}
            onAddNotes={
              onOpenFolderNotes ? () => onOpenFolderNotes({ autoFocusComposer: true }) : undefined
            }
            pasteTargetParentId={id}
          />
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
                    const userId = getSession()?.user.id
                    if (!userId) {
                      addToast({ title: 'Failed to add todo', description: 'Sesi tidak ditemukan. Silakan login ulang.', variant: 'error' })
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
                  const userId = getSession()?.user.id
                  if (!userId) {
                    addToast({ title: 'Failed to add todo', description: 'Sesi tidak ditemukan. Silakan login ulang.', variant: 'error' })
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
            projectCount === 0 && childFolderCount === 0 && styles.folderMetaMuted
          )}
        >
          {metaLabel}
        </div>

      </div>
    </div>

      {showProjectDropTarget ? (
        <div className={styles.dropHintBelow} aria-hidden>
          <span className={styles.dropHintArrow}>→</span>
          Move to {name}
        </div>
      ) : null}
    </div>
  )
}
