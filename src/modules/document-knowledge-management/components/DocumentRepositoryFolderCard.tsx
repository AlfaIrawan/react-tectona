import { useEffect, useRef, type CSSProperties, type DragEvent, type MouseEvent } from 'react'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocumentFolder } from '@/lib/api/documentFolderApi'
import folderCardStyles from '@/modules/projects/components/FolderCard.module.css'
import { buildFolderCardThemeVariables } from '@/modules/projects/lib/folderColorPalette'
import {
  isProjectLinkedDocumentFolder,
  PROJECT_DOCUMENT_FOLDER_ACCENT_COLOR,
} from '@/modules/projects/lib/projectDocumentFolder'
import compactStyles from './DocumentRepositoryFolderCard.module.css'

type DocumentRepositoryFolderCardProps = {
  folder: DocumentFolder
  isRenaming: boolean
  isDragOver: boolean
  onOpen: () => void
  onStartRename: () => void
  onRename: (name: string) => void
  onCancelRename: () => void
  onContextMenu: (event: MouseEvent) => void
  onDragOver: (event: DragEvent) => void
  onDragLeave: () => void
  onDrop: (event: DragEvent) => void
}

export function DocumentRepositoryFolderCard({
  folder,
  isRenaming,
  isDragOver,
  onOpen,
  onStartRename,
  onRename,
  onCancelRename,
  onContextMenu,
  onDragOver,
  onDragLeave,
  onDrop,
}: DocumentRepositoryFolderCardProps) {
  const renameInputRef = useRef<HTMLInputElement>(null)
  const hasDocuments = folder.document_count > 0
  const metaLabel = `${folder.document_count} docs · ${folder.children_count} subfolders`
  const isProjectFolder = isProjectLinkedDocumentFolder(folder.description)
  const themedStyle = isProjectFolder
    ? (buildFolderCardThemeVariables(PROJECT_DOCUMENT_FOLDER_ACCENT_COLOR, hasDocuments) as CSSProperties)
    : undefined
  const showRenameInput = isRenaming && !isProjectFolder

  useEffect(() => {
    if (!showRenameInput) return
    renameInputRef.current?.focus()
    renameInputRef.current?.select()
  }, [showRenameInput])

  return (
    <div
      className={cn(
        folderCardStyles.folderCard,
        compactStyles.compactCard,
        'group/folder',
        isProjectFolder && folderCardStyles.folderCardThemed,
        hasDocuments && folderCardStyles.hasProjects,
        isDragOver && folderCardStyles.dragOver,
      )}
      style={themedStyle}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDoubleClick={(event) => {
        if (showRenameInput) return
        if ((event.target as HTMLElement).closest('button,input')) return
        onOpen()
      }}
    >
      <div className={cn(folderCardStyles.folderTab, compactStyles.compactTab, 'folder-tab')} aria-hidden="true" />

      <div className={cn(folderCardStyles.folderBody, compactStyles.compactBody, 'folder-body')}>
        {hasDocuments ? (
          <div className={cn(folderCardStyles.folderPapers, compactStyles.compactPapers)} aria-hidden="true">
            <span className={folderCardStyles.paper} />
            <span className={folderCardStyles.paper} />
            <span className={folderCardStyles.paper} />
            <span className={folderCardStyles.paper} />
          </div>
        ) : null}

        <div className={cn(folderCardStyles.folderTitleRow, compactStyles.compactTitleRow)}>
          {showRenameInput ? (
            <input
              ref={renameInputRef}
              type="text"
              defaultValue={folder.name}
              className={cn(
                folderCardStyles.folderTitle,
                compactStyles.compactTitle,
                'w-full min-w-0 rounded border border-sky-300/70 bg-white/90 px-1 py-0 focus:outline-none focus:ring-2 focus:ring-sky-300/40',
              )}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                event.stopPropagation()
                if (event.key === 'Enter') onRename(event.currentTarget.value)
                if (event.key === 'Escape') onCancelRename()
              }}
              onBlur={(event) => onRename(event.currentTarget.value)}
            />
          ) : (
            <button
              type="button"
              className={cn(
                folderCardStyles.folderTitle,
                compactStyles.compactTitle,
                'min-w-0 flex-1 text-left',
                isProjectFolder ? 'flex items-center gap-1 cursor-pointer' : 'hover:text-sky-700',
              )}
              title={isProjectFolder ? `${folder.name} (linked to project — name and color are locked)` : folder.name}
              onClick={(event) => {
                event.stopPropagation()
                if (isProjectFolder) {
                  onOpen()
                  return
                }
                onStartRename()
              }}
            >
              {isProjectFolder ? <Lock className="h-3 w-3 shrink-0 opacity-70" aria-hidden /> : null}
              <span className="min-w-0 truncate">{folder.name}</span>
            </button>
          )}
        </div>

        <button
          type="button"
          className={cn(
            folderCardStyles.folderMeta,
            compactStyles.compactMeta,
            'folder-meta block w-full text-left',
            folder.document_count === 0 && folder.children_count === 0 && folderCardStyles.folderMetaMuted,
          )}
          title="Open folder"
          onClick={(event) => {
            event.stopPropagation()
            onOpen()
          }}
        >
          {metaLabel}
        </button>

        {isDragOver ? (
          <div className={cn(folderCardStyles.dragOverOverlay, compactStyles.compactDragOverlay)} aria-hidden="true">
            <div className={cn(folderCardStyles.dragOverText, compactStyles.compactDragText)}>Drop to move</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
