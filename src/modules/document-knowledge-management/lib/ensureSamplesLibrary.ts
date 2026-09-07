import {
  createDocumentFolder,
  deleteDocumentFolder,
  fetchAllDocumentFolders,
  type DocumentFolder,
} from '@/lib/api/documentFolderApi'
import { matchSampleCategoryName } from '@/modules/document-knowledge-management/lib/sampleDocumentKind'
import { parseSamplesShareWorkspaceIds } from '@/modules/document-knowledge-management/lib/samplesShare'
import { isSamplesRootFolder, SAMPLES_ROOT_NAME } from '@/modules/document-knowledge-management/lib/samplesFolder'

/** Create only the Samples root — category folders are user-created or appear after an explicit share. */
export async function bootstrapSamplesLibraryIfMissing(
  workspaceId: string,
  ownerId: string | null | undefined,
): Promise<DocumentFolder[]> {
  const folders = await fetchAllDocumentFolders(workspaceId)
  if (folders.some((folder) => isSamplesRootFolder(folder))) return folders
  const actor = (ownerId || '').trim() || 'system'
  await createDocumentFolder({
    name: SAMPLES_ROOT_NAME,
    parent_id: null,
    owner_id: actor,
    workspace_id: workspaceId,
  })
  return fetchAllDocumentFolders(workspaceId)
}

export function listEmptySeededSampleCategoryFolders<T extends {
  id: string
  name: string
  parent_id?: string | null
  document_count?: number
  description?: string | null
}>(
  folders: readonly T[],
  occupiedFolderIds: ReadonlySet<string>,
): T[] {
  const root = folders.find((folder) => isSamplesRootFolder(folder))
  if (!root) return []
  const childIds = new Set(folders.filter((folder) => folder.parent_id === root.id).map((folder) => folder.id))
  return folders.filter((folder) => {
    if (folder.parent_id !== root.id) return false
    if (!matchSampleCategoryName(folder.name)) return false
    if ((folder.document_count ?? 0) > 0) return false
    if (occupiedFolderIds.has(folder.id)) return false
    if (folders.some((child) => child.parent_id === folder.id)) return false
    if (parseSamplesShareWorkspaceIds(folder.description).length > 0) return false
    return childIds.has(folder.id)
  })
}

/** Remove leftover empty BPKB/BRD/SOP/… racks that the old Samples bootstrap created. */
export async function pruneEmptySeededSampleCategoryFolders(
  folders: DocumentFolder[],
  occupiedFolderIds: ReadonlySet<string>,
): Promise<boolean> {
  const doomed = listEmptySeededSampleCategoryFolders(folders, occupiedFolderIds)
  if (doomed.length === 0) return false
  await Promise.allSettled(doomed.map((folder) => deleteDocumentFolder(folder.id)))
  return true
}
