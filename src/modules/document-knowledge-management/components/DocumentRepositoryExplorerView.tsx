import { useMemo, useState, type DragEvent, type MouseEvent } from 'react'
import { ChevronDown, ChevronRight, Folder, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocumentFolder } from '@/lib/api/documentFolderApi'
import {
  EXPLORER_FOLDER_TYPE_LABEL,
  formatExplorerDateTime,
  getExplorerFileTypeLabel,
  getFileTypeIcon,
} from '../fileTypeIcon'

export type RepositoryExplorerDocument = {
  id: string
  name: string
  fileName: string
  updatedAt: string
}

type DocumentRepositoryExplorerViewProps = {
  folders: DocumentFolder[]
  documents: RepositoryExplorerDocument[]
  selectedDocumentId: string | null
  dropTargetFolderId: string | null
  onOpenFolder: (folderId: string) => void
  onOpenDocument: (documentId: string) => void
  onFolderContextMenu: (event: MouseEvent, folder: DocumentFolder) => void
  onDocumentContextMenu: (event: MouseEvent, documentId: string) => void
  onFolderDragOver: (event: DragEvent, folderId: string) => void
  onFolderDragLeave: (folderId: string) => void
  onFolderDrop: (event: DragEvent, folderId: string) => void
}

type ExplorerRow =
  | { kind: 'folder'; id: string; folder: DocumentFolder }
  | { kind: 'document'; id: string; document: RepositoryExplorerDocument; typeLabel: string }

function FileTypeIconImg({ fileName }: { fileName: string }) {
  return (
    <img
      src={getFileTypeIcon(fileName)}
      alt=""
      className="h-4 w-4 shrink-0 object-contain object-center"
      draggable={false}
      aria-hidden
    />
  )
}

function buildExplorerGroups(folders: DocumentFolder[], documents: RepositoryExplorerDocument[]) {
  const groups: { label: string; rows: ExplorerRow[] }[] = []
  if (folders.length > 0) {
    groups.push({
      label: EXPLORER_FOLDER_TYPE_LABEL,
      rows: [...folders]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        .map((folder) => ({ kind: 'folder' as const, id: folder.id, folder })),
    })
  }
  const byType = new Map<string, ExplorerRow[]>()
  for (const document of documents) {
    const typeLabel = getExplorerFileTypeLabel(document.fileName || document.name)
    const rows = byType.get(typeLabel) ?? []
    rows.push({ kind: 'document', id: document.id, document, typeLabel })
    byType.set(typeLabel, rows)
  }
  const typeLabels = [...byType.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  for (const label of typeLabels) {
    const rows = (byType.get(label) ?? []).sort((a, b) => {
      const left = a.kind === 'document' ? a.document.name : ''
      const right = b.kind === 'document' ? b.document.name : ''
      return left.localeCompare(right, undefined, { sensitivity: 'base' })
    })
    groups.push({ label, rows })
  }
  return groups
}

export function DocumentRepositoryExplorerView({
  folders,
  documents,
  selectedDocumentId,
  dropTargetFolderId,
  onOpenFolder,
  onOpenDocument,
  onFolderContextMenu,
  onDocumentContextMenu,
  onFolderDragOver,
  onFolderDragLeave,
  onFolderDrop,
}: DocumentRepositoryExplorerViewProps) {
  const groups = useMemo(() => buildExplorerGroups(folders, documents), [folders, documents])
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  const toggleGroup = (label: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const isEmpty = folders.length === 0 && documents.length === 0

  return (
    <div className="min-h-0 w-full min-w-0 flex-1 overflow-auto scrollbar-hide rounded-xl border border-slate-200/80 bg-white dark:border-slate-700/70 dark:bg-slate-950">
      <table className="w-full table-fixed border-collapse text-[13px] leading-snug">
        <colgroup>
          <col className="w-[44%]" />
          <col className="w-[20%]" />
          <col className="w-[26%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-[12px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <th className="px-3 py-1.5 font-semibold">Name</th>
            <th className="px-3 py-1.5 font-semibold">Date modified</th>
            <th className="px-3 py-1.5 font-semibold">Type</th>
            <th className="px-3 py-1.5 text-right font-semibold">Size</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.label)
            return (
              <ExplorerGroup
                key={group.label}
                label={group.label}
                rows={group.rows}
                collapsed={isCollapsed}
                selectedDocumentId={selectedDocumentId}
                dropTargetFolderId={dropTargetFolderId}
                onToggle={() => toggleGroup(group.label)}
                onOpenFolder={onOpenFolder}
                onOpenDocument={onOpenDocument}
                onFolderContextMenu={onFolderContextMenu}
                onDocumentContextMenu={onDocumentContextMenu}
                onFolderDragOver={onFolderDragOver}
                onFolderDragLeave={onFolderDragLeave}
                onFolderDrop={onFolderDrop}
              />
            )
          })}
        </tbody>
      </table>
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
          <Upload className="mb-3 h-8 w-8 text-muted-foreground/60" strokeWidth={1.75} />
          <p className="text-sm font-medium text-muted-foreground">Drag and drop documents anywhere in this panel to upload</p>
          <p className="mt-1 text-xs text-muted-foreground/80">Or drop directly onto a folder · Or use Upload document repository above</p>
        </div>
      ) : null}
    </div>
  )
}

function ExplorerGroup({
  label,
  rows,
  collapsed,
  selectedDocumentId,
  dropTargetFolderId,
  onToggle,
  onOpenFolder,
  onOpenDocument,
  onFolderContextMenu,
  onDocumentContextMenu,
  onFolderDragOver,
  onFolderDragLeave,
  onFolderDrop,
}: {
  label: string
  rows: ExplorerRow[]
  collapsed: boolean
  selectedDocumentId: string | null
  dropTargetFolderId: string | null
  onToggle: () => void
  onOpenFolder: (folderId: string) => void
  onOpenDocument: (documentId: string) => void
  onFolderContextMenu: (event: MouseEvent, folder: DocumentFolder) => void
  onDocumentContextMenu: (event: MouseEvent, documentId: string) => void
  onFolderDragOver: (event: DragEvent, folderId: string) => void
  onFolderDragLeave: (folderId: string) => void
  onFolderDrop: (event: DragEvent, folderId: string) => void
}) {
  return (
    <>
      <tr>
        <td colSpan={4} className="border-b border-slate-200 bg-white px-1 py-0.5 dark:border-slate-800 dark:bg-slate-950">
          <button
            type="button"
            className="inline-flex w-full items-center gap-1 rounded-sm px-2 py-1 text-left text-[13px] font-semibold text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
            aria-expanded={!collapsed}
            onClick={onToggle}
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
            )}
            <span className="truncate">{label}</span>
          </button>
        </td>
      </tr>
      {collapsed
        ? null
        : rows.map((row) => {
            if (row.kind === 'folder') {
              const isDropTarget = dropTargetFolderId === row.folder.id
              return (
                <tr
                  key={`folder-${row.id}`}
                  className={cn(
                    'cursor-pointer border-b border-slate-100 text-slate-800 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-100 dark:hover:bg-slate-800/80',
                    isDropTarget && 'bg-blue-50 dark:bg-blue-950/40',
                  )}
                  onDoubleClick={() => onOpenFolder(row.folder.id)}
                  onClick={() => onOpenFolder(row.folder.id)}
                  onContextMenu={(event) => onFolderContextMenu(event, row.folder)}
                  onDragOver={(event) => onFolderDragOver(event, row.folder.id)}
                  onDragLeave={() => onFolderDragLeave(row.folder.id)}
                  onDrop={(event) => onFolderDrop(event, row.folder.id)}
                >
                  <td className="px-3 py-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <Folder className="h-4 w-4 shrink-0 fill-amber-400 text-amber-500" aria-hidden />
                      <span className="truncate">{row.folder.name}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-1 text-slate-600 dark:text-slate-300">
                    {formatExplorerDateTime(row.folder.updated_date || row.folder.created_date)}
                  </td>
                  <td className="truncate px-3 py-1 text-slate-600 dark:text-slate-300">{EXPLORER_FOLDER_TYPE_LABEL}</td>
                  <td className="px-3 py-1 text-right text-slate-500" />
                </tr>
              )
            }
            const selected = selectedDocumentId === row.document.id
            return (
              <tr
                key={`doc-${row.id}`}
                className={cn(
                  'cursor-pointer border-b border-slate-100 text-slate-800 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-100 dark:hover:bg-slate-800/80',
                  selected && 'bg-blue-100 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-950/50',
                )}
                onClick={() => onOpenDocument(row.document.id)}
                onContextMenu={(event) => onDocumentContextMenu(event, row.document.id)}
              >
                <td className="px-3 py-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileTypeIconImg fileName={row.document.fileName || row.document.name} />
                    <span className="truncate">{row.document.fileName || row.document.name}</span>
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-1 text-slate-600 dark:text-slate-300">
                  {formatExplorerDateTime(row.document.updatedAt)}
                </td>
                <td className="truncate px-3 py-1 text-slate-600 dark:text-slate-300">{row.typeLabel}</td>
                <td className="px-3 py-1 text-right text-slate-500" />
              </tr>
            )
          })}
    </>
  )
}
