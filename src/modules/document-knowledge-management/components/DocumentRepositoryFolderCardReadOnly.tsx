import type { CSSProperties } from 'react'
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

type DocumentRepositoryFolderCardReadOnlyProps = {
  folder: DocumentFolder
  onOpen: () => void
}

export function DocumentRepositoryFolderCardReadOnly({
  folder,
  onOpen,
}: DocumentRepositoryFolderCardReadOnlyProps) {
  const hasDocuments = folder.document_count > 0
  const metaLabel = `${folder.document_count} docs · ${folder.children_count} subfolders`
  const isProjectFolder = isProjectLinkedDocumentFolder(folder.description)
  const themedStyle = isProjectFolder
    ? (buildFolderCardThemeVariables(PROJECT_DOCUMENT_FOLDER_ACCENT_COLOR, hasDocuments) as CSSProperties)
    : undefined

  return (
    <div
      className={cn(
        folderCardStyles.folderCard,
        compactStyles.compactCard,
        isProjectFolder && folderCardStyles.folderCardThemed,
        hasDocuments && folderCardStyles.hasProjects,
        'cursor-pointer',
      )}
      style={themedStyle}
      onDoubleClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
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
          <button
            type="button"
            className={cn(
              folderCardStyles.folderTitle,
              compactStyles.compactTitle,
              'min-w-0 flex-1 text-left',
              isProjectFolder ? 'flex items-center gap-1' : 'hover:text-sky-700',
            )}
            title={folder.name}
            onClick={(event) => {
              event.stopPropagation()
              onOpen()
            }}
          >
            {isProjectFolder ? <Lock className="h-3 w-3 shrink-0 opacity-70" aria-hidden /> : null}
            <span className="min-w-0 truncate">{folder.name}</span>
          </button>
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
      </div>
    </div>
  )
}
