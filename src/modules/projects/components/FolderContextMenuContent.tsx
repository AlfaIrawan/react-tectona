import {
  FolderOpen,
  Pencil,
  Share2,
  StickyNote,
  MessageSquare,
  ListTodo,
  Palette,
  FolderPlus,
  Trash2,
  FolderInput,
  ChevronRight,
  Copy,
  ClipboardPaste,
  ExternalLink,
} from 'lucide-react'
import { ContextMenuItem, ContextMenuSeparator, ContextMenuSubmenu } from '@/components/ui/context-menu'
import { useToast } from '@/components/ui/toast'
import { notifyEvent } from '@/lib/api/notificationApi'
import { useFolderStore } from '@/modules/projects'
import type { Folder } from '@/modules/projects'
import { cn } from '@/lib/utils'
import {
  canMoveFolderToTarget,
  copyFolderToClipboard,
  openFolderInNewTab,
} from '../lib/folderActions'
import { getFolderClipboard, hasFolderClipboard } from '../lib/folderClipboard'
import { DEFAULT_FOLDER_COLOR, FOLDER_COLOR_PALETTE } from '../lib/folderColorPalette'

export interface FolderContextMenuContentProps {
  folder: Pick<Folder, 'id' | 'name' | 'parentId' | 'description' | 'borderColor' | 'isShared'>
  multiSelectActive?: boolean
  onClose: () => void
  onOpen: () => void
  onRenameFolder?: () => void
  onAddProject?: () => void
  onShare?: () => void
  onDelete?: () => void
  onDeleteSelected?: () => void
  onAddTodo?: () => void
  onAddNotes?: () => void
  /** Parent folder for paste-into-this-folder; defaults to folder.id */
  pasteTargetParentId?: string | null
}

export function FolderContextMenuContent({
  folder,
  multiSelectActive = false,
  onClose,
  onOpen,
  onRenameFolder,
  onAddProject,
  onShare,
  onDelete,
  onDeleteSelected,
  onAddTodo,
  onAddNotes,
  pasteTargetParentId,
}: FolderContextMenuContentProps) {
  const { addToast } = useToast()
  const { folders, moveFolderToParent, pasteFolderFromClipboard, updateFolder } =
    useFolderStore()
  const clipboardReady = hasFolderClipboard()
  const resolvedPasteParentId = pasteTargetParentId !== undefined ? pasteTargetParentId : folder.id
  const isShared = Boolean(
    folder.isShared ?? folders.find((f) => f.id === folder.id)?.isShared,
  )

  const moveTargets = folders.filter(
    (f) => f.id !== folder.id && canMoveFolderToTarget(folder.id, f.id, folders),
  )
  const canMoveToRoot = canMoveFolderToTarget(folder.id, null, folders)
  const currentParentId = folder.parentId ?? null

  const closePreservingScroll = (scroll = { x: window.scrollX, y: window.scrollY }) => {
    onClose()
    requestAnimationFrame(() => window.scrollTo(scroll.x, scroll.y))
  }

  const handleMoveTo = async (targetParentId: string | null) => {
    const scroll = { x: window.scrollX, y: window.scrollY }
    if (!canMoveFolderToTarget(folder.id, targetParentId, folders)) {
      addToast({ title: 'Cannot move folder', description: 'Target folder is not valid.', variant: 'error' })
      return
    }
    if ((folder.parentId ?? null) === targetParentId) {
      addToast({ title: 'Folder is already in this location', variant: 'default' })
      closePreservingScroll(scroll)
      return
    }
    try {
      await moveFolderToParent(folder.id, targetParentId)
      const label = targetParentId
        ? folders.find((f) => f.id === targetParentId)?.name ?? 'folder'
        : 'All Projects'
      addToast({
        title: 'Folder moved',
        description: `Moved to "${label}".`,
        variant: 'success',
      })
      notifyEvent({ type_code: 'folder', title: 'Folder moved', body: `Moved to "${label}".` })
      closePreservingScroll(scroll)
    } catch (e) {
      addToast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to move folder',
        variant: 'error',
      })
    }
  }

  const handleCopy = () => {
    copyFolderToClipboard(folder)
    addToast({
      title: 'Folder copied',
      description: `"${folder.name}" is ready to Paste (Ctrl+V).`,
      variant: 'success',
    })
    onClose()
  }

  const handlePaste = async () => {
    const clip = getFolderClipboard()
    if (!clip) {
      addToast({ title: 'Clipboard is empty', description: 'Copy a folder first.', variant: 'default' })
      onClose()
      return
    }
    const scroll = { x: window.scrollX, y: window.scrollY }
    try {
      const created = await pasteFolderFromClipboard(resolvedPasteParentId)
      addToast({
        title: 'Folder pasted',
        description: `"${created.name}" was created.`,
        variant: 'success',
      })
      notifyEvent({
        type_code: 'folder',
        title: 'Folder pasted',
        body: `"${created.name}" was created.`,
      })
      closePreservingScroll(scroll)
    } catch (e) {
      addToast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to paste folder',
        variant: 'error',
      })
    }
  }

  const currentFolderColor = folder.borderColor?.trim() || DEFAULT_FOLDER_COLOR

  const handleChangeColor = async (color: string) => {
    const scroll = { x: window.scrollX, y: window.scrollY }
    try {
      await updateFolder(folder.id, { borderColor: color })
      addToast({ title: 'Folder color updated', variant: 'success' })
      notifyEvent({
        type_code: 'folder',
        title: 'Folder color updated',
        body: `Color for "${folder.name}" was updated.`,
      })
      closePreservingScroll(scroll)
    } catch (e) {
      addToast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to update folder color',
        variant: 'error',
      })
    }
  }

  if (multiSelectActive) {
    return (
      <ContextMenuItem
        className="text-destructive"
        onClick={() => {
          onDeleteSelected?.()
          onClose()
        }}
      >
        <Trash2 className="w-4 h-4 mr-2" />
        Delete
      </ContextMenuItem>
    )
  }

  return (
    <>
      <ContextMenuItem
        onClick={() => {
          onOpen()
          onClose()
        }}
      >
        <FolderOpen className="w-4 h-4 mr-2" />
        Open
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => {
          openFolderInNewTab(folder.id)
          onClose()
        }}
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        Open in new tab
      </ContextMenuItem>
      {onRenameFolder && (
        <ContextMenuItem
          onClick={() => {
            onClose()
            onRenameFolder()
          }}
        >
          <Pencil className="w-4 h-4 mr-2" />
          Rename Folder
        </ContextMenuItem>
      )}
      {onAddProject && (
        <ContextMenuItem
          onClick={() => {
            onAddProject()
            onClose()
          }}
        >
          <FolderPlus className="w-4 h-4 mr-2" />
          Add Project
        </ContextMenuItem>
      )}
      <ContextMenuSeparator />
      <ContextMenuSubmenu
        trigger={
          <>
            <FolderInput className="w-4 h-4 mr-2" />
            Move to folder
            <ChevronRight className="w-4 h-4 ml-auto" />
          </>
        }
      >
        <div className="py-1 max-h-60 overflow-y-auto min-w-[10rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {canMoveToRoot && currentParentId !== null && (
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer rounded-lg mx-1 hover:bg-accent/80 hover:text-accent-foreground text-left"
              onClick={() => void handleMoveTo(null)}
            >
              All Projects
            </button>
          )}
          {moveTargets.map((f) => (
            <button
              key={f.id}
              type="button"
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer rounded-lg mx-1 hover:bg-accent/80 hover:text-accent-foreground text-left"
              onClick={() => void handleMoveTo(f.id)}
            >
              {f.name}
            </button>
          ))}
          {!canMoveToRoot && moveTargets.length === 0 && (
            <p className="px-4 py-2 text-xs text-muted-foreground">No destination folders available</p>
          )}
        </div>
      </ContextMenuSubmenu>
      <ContextMenuItem onClick={handleCopy}>
        <Copy className="w-4 h-4 mr-2" />
        Copy
      </ContextMenuItem>
      <ContextMenuItem
        className={cn(!clipboardReady && 'opacity-50')}
        onClick={() => {
          if (!clipboardReady) {
            addToast({
              title: 'Clipboard is empty',
              description: 'Copy a folder first.',
              variant: 'default',
            })
            onClose()
            return
          }
          void handlePaste()
        }}
      >
        <ClipboardPaste className="w-4 h-4 mr-2" />
        Paste
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={() => {
          onClose()
          onAddNotes?.()
        }}
      >
        <StickyNote className="w-4 h-4 mr-2" />
        Add notes
      </ContextMenuItem>
      {isShared ? (
        <ContextMenuItem
          onClick={() => {
            addToast({ title: 'Add Comment', description: 'This feature is coming soon.', variant: 'default' })
            onClose()
          }}
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          Add Comment
        </ContextMenuItem>
      ) : null}
      <ContextMenuItem
        onClick={() => {
          onClose()
          onAddTodo?.()
        }}
      >
        <ListTodo className="w-4 h-4 mr-2" />
        Add Todo
      </ContextMenuItem>
      <ContextMenuSubmenu
        trigger={
          <>
            <Palette className="w-4 h-4 mr-2" />
            Change color
            <ChevronRight className="w-4 h-4 ml-auto" />
          </>
        }
      >
        <div className="w-[13rem] grid grid-cols-6 gap-3 p-3">
          {FOLDER_COLOR_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              className={cn(
                'w-7 h-7 rounded-full border-2 transition shrink-0 flex items-center justify-center',
                currentFolderColor === color
                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                  : 'border-border hover:scale-110',
              )}
              style={{ backgroundColor: color }}
              aria-label={`Set folder color ${color}`}
              onClick={(e) => {
                e.stopPropagation()
                void handleChangeColor(color)
              }}
            />
          ))}
        </div>
      </ContextMenuSubmenu>
      {onShare && (
        <ContextMenuItem
          onClick={() => {
            onShare()
            onClose()
          }}
        >
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </ContextMenuItem>
      )}
      <ContextMenuSeparator />
      {onDelete && (
        <ContextMenuItem
          className="text-destructive"
          onClick={() => {
            onDelete()
            onClose()
          }}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </ContextMenuItem>
      )}
    </>
  )
}
