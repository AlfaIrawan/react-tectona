import type { IdeaBacklogFolder } from '../store/ideaFolderStore'
import { setIdeaFolderClipboard, type IdeaFolderClipboardEntry } from './ideaFolderClipboard'

export function copyIdeaFolderToClipboard(
  folder: Pick<IdeaBacklogFolder, 'id' | 'name' | 'parentId'>,
): IdeaFolderClipboardEntry {
  const entry: IdeaFolderClipboardEntry = {
    folderId: folder.id,
    folderName: folder.name,
    sourceParentId: folder.parentId ?? null,
  }
  setIdeaFolderClipboard(entry)
  return entry
}

export function buildIdeaFolderOpenUrl(folderId: string): string {
  const url = new URL(window.location.href)
  url.pathname = '/idea-backlog'
  url.search = ''
  url.searchParams.set('folder', folderId)
  return url.toString()
}

export function openIdeaFolderInNewTab(folderId: string) {
  window.open(buildIdeaFolderOpenUrl(folderId), '_blank', 'noopener,noreferrer')
}

export function isIdeaFolderDescendantOf(
  nodeId: string,
  ancestorId: string,
  folders: IdeaBacklogFolder[],
): boolean {
  const byId = new Map(folders.map((f) => [f.id, f]))
  let current = byId.get(nodeId)
  while (current) {
    if (current.id === ancestorId) return true
    if (!current.parentId) return false
    current = byId.get(current.parentId)
  }
  return false
}

export function canMoveIdeaFolderToTarget(
  folderId: string,
  targetParentId: string | null,
  folders: IdeaBacklogFolder[],
): boolean {
  if (targetParentId === folderId) return false
  if (targetParentId && isIdeaFolderDescendantOf(targetParentId, folderId, folders)) {
    return false
  }
  return true
}

export function buildDuplicateIdeaFolderName(
  baseName: string,
  parentId: string | null,
  isNameUnique: (name: string, excludeId?: string, parentId?: string | null) => boolean,
): string {
  const trimmed = baseName.trim()
  let candidate = `${trimmed} (copy)`
  let suffix = 2
  while (!isNameUnique(candidate, undefined, parentId)) {
    candidate = `${trimmed} (copy ${suffix})`
    suffix += 1
  }
  return candidate
}
