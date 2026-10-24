import { getDocumentFolder, type DocumentFolder } from '@/lib/api/documentFolderApi'
import { parseProjectIdFromDocumentFolderDescription } from './projectDocumentFolder'

/** Resolve only folders referenced by this idea's documents, using DKM's access checks. */
export async function resolveExistingIdeaDocsFolder(input: {
  ideaId: string
  workspaceId?: string | null
  documents: Array<{ folder_id?: string | null; project_id?: string | null; tags: string[]; metadata?: Record<string, unknown> | null }>
}): Promise<DocumentFolder | null> {
  const linked = input.documents.filter((doc) => doc.metadata?.idea_id === input.ideaId || doc.tags.includes(input.ideaId))
  const folderIds = [...new Set(linked.map((doc) => doc.folder_id).filter((id): id is string => Boolean(id)))]
  if (!folderIds.length) return null
  const projectIds = new Set(linked.map((doc) => doc.project_id).filter(Boolean))
  const cache = new Map<string, DocumentFolder | null>()
  const paths: DocumentFolder[][] = []
  for (const folderId of folderIds) {
    const path: DocumentFolder[] = []
    let cursor: string | null = folderId
    const visited = new Set<string>()
    while (cursor) {
      if (visited.has(cursor) || visited.size >= 64) throw new Error('Invalid document folder hierarchy.')
      visited.add(cursor)
      if (!cache.has(cursor)) cache.set(cursor, await getDocumentFolder(cursor))
      const folder = cache.get(cursor)
      if (!folder) return null
      if (input.workspaceId && folder.workspace_id && folder.workspace_id !== input.workspaceId) return null
      path.push(folder)
      if (projectIds.has(parseProjectIdFromDocumentFolderDescription(folder.description))) break
      cursor = folder.parent_id
    }
    paths.push(path)
  }
  const common = paths[0].filter((folder) => paths.every((path) => path.some((item) => item.id === folder.id)))
  return common.find((folder) => projectIds.has(parseProjectIdFromDocumentFolderDescription(folder.description)))
    ?? common[0] ?? null
}
