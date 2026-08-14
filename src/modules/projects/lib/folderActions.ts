import type { Folder } from '@/modules/projects'
import { setFolderClipboard, type FolderClipboardEntry } from './folderClipboard'

export function copyFolderToClipboard(
  folder: Pick<Folder, 'id' | 'name' | 'parentId'>,
): FolderClipboardEntry {
  const entry: FolderClipboardEntry = {
    folderId: folder.id,
    folderName: folder.name,
    sourceParentId: folder.parentId ?? null,
  }
  setFolderClipboard(entry)
  return entry
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'),
  )
}

export function buildFolderOpenUrl(folderId: string): string {
  const url = new URL(window.location.href)
  url.pathname = '/projects'
  url.search = ''
  url.searchParams.set('folder', folderId)
  return url.toString()
}

export function openFolderInNewTab(folderId: string) {
  window.open(buildFolderOpenUrl(folderId), '_blank', 'noopener,noreferrer')
}

export function isFolderDescendantOf(
  nodeId: string,
  ancestorId: string,
  folders: Folder[],
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

export function canMoveFolderToTarget(
  folderId: string,
  targetParentId: string | null,
  folders: Folder[],
): boolean {
  if (targetParentId === folderId) return false
  if (targetParentId && isFolderDescendantOf(targetParentId, folderId, folders)) {
    return false
  }
  return true
}

export function buildDuplicateFolderName(
  baseName: string,
  folders: Folder[],
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

export function buildDuplicateProjectName(
  baseName: string,
  usedNames: Set<string>,
): string {
  const lower = baseName.toLowerCase()
  if (!usedNames.has(lower)) return baseName
  let candidate = `${baseName} (copy)`
  let suffix = 2
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${baseName} (copy ${suffix})`
    suffix += 1
  }
  return candidate
}
