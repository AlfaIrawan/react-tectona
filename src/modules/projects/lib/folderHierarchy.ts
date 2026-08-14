import type { Folder } from '../store/folderStore'

export function normalizeFolderParentId(parentId?: string | null): string | null {
  return parentId ?? null
}

export function filterFoldersByParent(folders: Folder[], parentId: string | null): Folder[] {
  return folders.filter((folder) => normalizeFolderParentId(folder.parentId) === parentId)
}

export function buildFolderAncestorChain(
  folderId: string,
  getFolder: (id: string) => Folder | undefined,
): Folder[] {
  const chain: Folder[] = []
  const visited = new Set<string>()
  let current = getFolder(folderId)

  while (current) {
    if (visited.has(current.id)) break
    visited.add(current.id)
    chain.unshift(current)
    const parentId = normalizeFolderParentId(current.parentId)
    current = parentId ? getFolder(parentId) : undefined
  }

  return chain
}

export function countChildFolders(folders: Folder[], folderId: string): number {
  return filterFoldersByParent(folders, folderId).length
}

export function resolveChildFolderCount(folder: Folder, folders: Folder[]): number {
  return Math.max(countChildFolders(folders, folder.id), folder.childrenCount ?? 0)
}

export function formatFolderContentsLabel(projectCount: number, childFolderCount: number): string {
  const folderLabel = `${childFolderCount} ${childFolderCount === 1 ? 'folder' : 'folders'}`
  const projectLabel = `${projectCount} ${projectCount === 1 ? 'project' : 'projects'}`
  return `${folderLabel} · ${projectLabel}`
}

export function getFolderDepth(folderId: string, folders: Folder[]): number {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  let depth = 0
  let current = byId.get(folderId)
  const visited = new Set<string>()

  while (current?.parentId) {
    if (visited.has(current.id)) break
    visited.add(current.id)
    depth += 1
    current = byId.get(current.parentId)
  }

  return depth
}

/** Post-order: deepest descendants first, then direct children. */
export function collectDescendantFolderIds(folderId: string, folders: Folder[]): string[] {
  const result: string[] = []
  for (const child of filterFoldersByParent(folders, folderId)) {
    result.push(...collectDescendantFolderIds(child.id, folders))
    result.push(child.id)
  }
  return result
}

/** Folder ids to delete deepest-first (subfolders before parents), deduped across roots. */
export function collectFolderDeletionOrder(rootFolderIds: string[], folders: Folder[]): string[] {
  const deleteSet = new Set<string>()

  for (const rootId of rootFolderIds) {
    for (const descendantId of collectDescendantFolderIds(rootId, folders)) {
      deleteSet.add(descendantId)
    }
    deleteSet.add(rootId)
  }

  return Array.from(deleteSet).sort(
    (left, right) => getFolderDepth(right, folders) - getFolderDepth(left, folders),
  )
}
