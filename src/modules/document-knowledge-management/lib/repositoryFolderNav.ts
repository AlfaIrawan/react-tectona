/** Hierarchical folder navigation for Document Repository move pickers. */

export type FolderNavItem = {
  id: string
  name: string
  parent_id?: string | null
}

export function isDocumentFolderDescendant(
  folders: readonly FolderNavItem[],
  ancestorId: string,
  candidateId: string,
): boolean {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  let cursor: string | null = candidateId
  let guard = 0
  while (cursor && guard < 64) {
    if (cursor === ancestorId) return true
    cursor = byId.get(cursor)?.parent_id ?? null
    guard += 1
  }
  return false
}

export function folderParentId(
  folders: readonly FolderNavItem[],
  folderId: string | null | undefined,
): string | null {
  if (!folderId) return null
  return folders.find((folder) => folder.id === folderId)?.parent_id ?? null
}

export function listSiblingFolders(
  folders: readonly FolderNavItem[],
  parentId: string | null,
  options?: { excludeFolderId?: string | null },
): FolderNavItem[] {
  const excludeId = options?.excludeFolderId ?? null
  return folders
    .filter((folder) => (folder.parent_id ?? null) === parentId)
    .filter((folder) => {
      if (!excludeId) return true
      if (folder.id === excludeId) return false
      return !isDocumentFolderDescendant(folders, excludeId, folder.id)
    })
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
}

export function folderHasVisibleChildren(
  folders: readonly FolderNavItem[],
  folderId: string,
  options?: { excludeFolderId?: string | null },
): boolean {
  return listSiblingFolders(folders, folderId, options).length > 0
}
