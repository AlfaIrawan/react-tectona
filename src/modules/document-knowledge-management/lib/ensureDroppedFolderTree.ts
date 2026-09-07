import type { DocumentFolder } from '@/lib/api/documentFolderApi'
import { uniqueDirectoryPaths, type DroppedUploadItem } from './droppedFolderUpload'

export async function ensureDroppedFolderTree(input: {
  parentFolderId: string | null
  items: readonly DroppedUploadItem[]
  workspaceId: string | null
  ownerId: string | null
  folders: readonly DocumentFolder[]
  createFolder: (payload: {
    name: string
    parent_id: string | null
    owner_id: string | null
    workspace_id: string | null
  }) => Promise<DocumentFolder>
}): Promise<Map<string, string | null>> {
  const folderByKey = new Map<string, string | null>()
  folderByKey.set('', input.parentFolderId)

  const known: DocumentFolder[] = [...input.folders]
  const paths = uniqueDirectoryPaths(input.items)

  const findChild = (parentId: string | null, name: string) =>
    known.find((folder) => (folder.parent_id ?? null) === parentId
      && folder.name.trim().toLowerCase() === name.trim().toLowerCase())

  for (const parts of paths) {
    let parentId = input.parentFolderId
    for (let index = 0; index < parts.length; index += 1) {
      const slice = parts.slice(0, index + 1)
      const key = slice.map((part) => part.toLowerCase()).join('\0')
      const cached = folderByKey.get(key)
      if (cached !== undefined) {
        parentId = cached
        continue
      }
      const name = parts[index] ?? ''
      const existing = findChild(parentId, name)
      if (existing) {
        folderByKey.set(key, existing.id)
        parentId = existing.id
        continue
      }
      const created = await input.createFolder({
        name,
        parent_id: parentId,
        owner_id: input.ownerId,
        workspace_id: input.workspaceId,
      })
      known.push(created)
      folderByKey.set(key, created.id)
      parentId = created.id
    }
  }

  return folderByKey
}

export function folderKeyFromRelativeDirectory(relativeDirectory: readonly string[]): string {
  return relativeDirectory.map((part) => part.toLowerCase()).join('\0')
}
