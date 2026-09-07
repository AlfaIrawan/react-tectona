import {
  createProjectDocument,
  getDocument,
  getDocumentIndexSnapshot,
  listAllDocuments,
  patchDocument,
  resolveLatestDocumentAttachmentBlob,
  uploadDocumentAttachment,
  type DocumentResponse,
} from '@/lib/api/documentKnowledgeApi'
import { createDocumentFolder, fetchAllDocumentFolders, type DocumentFolder } from '@/lib/api/documentFolderApi'
import { bootstrapSamplesLibraryIfMissing } from '@/modules/document-knowledge-management/lib/ensureSamplesLibrary'
import { isSamplesRootFolder } from '@/modules/document-knowledge-management/lib/samplesFolder'
import { samplesRelativeFolderNames } from '@/modules/document-knowledge-management/lib/samplesShare'

const SAMPLES_SHARE_SOURCE_META = 'samples_share_source_id'

async function ensureFolderPath(input: {
  workspaceId: string
  ownerId: string | null
  relativeNames: readonly string[]
}): Promise<string> {
  let folders = await bootstrapSamplesLibraryIfMissing(input.workspaceId, input.ownerId)
  let parent = folders.find((folder) => isSamplesRootFolder(folder))
  if (!parent) {
    folders = await fetchAllDocumentFolders(input.workspaceId)
    parent = folders.find((folder) => isSamplesRootFolder(folder))
  }
  if (!parent) throw new Error('Samples folder is missing in the target workspace.')

  for (const name of input.relativeNames) {
    const needle = name.trim()
    if (!needle) continue
    let child = folders.find(
      (folder) => folder.parent_id === parent!.id && folder.name.trim().toLowerCase() === needle.toLowerCase(),
    )
    if (!child) {
      child = await createDocumentFolder({
        name: needle,
        parent_id: parent.id,
        owner_id: input.ownerId,
        workspace_id: input.workspaceId,
      })
      folders.push(child)
    }
    parent = child
  }
  return parent.id
}

async function documentAlreadyCopied(workspaceId: string, sourceDocumentId: string): Promise<boolean> {
  let page = 1
  while (page <= 8) {
    const res = await listAllDocuments({ workspace_id: workspaceId, page, page_size: 100 })
    if (res.items.some((doc) => doc.metadata?.[SAMPLES_SHARE_SOURCE_META] === sourceDocumentId)) return true
    if (res.items.length === 0 || page * 100 >= res.total) break
    page += 1
  }
  return false
}

async function copyDocumentToWorkspace(input: {
  source: DocumentResponse
  targetWorkspaceId: string
  targetFolderId: string
  ownerId: string | null
}): Promise<boolean> {
  if (await documentAlreadyCopied(input.targetWorkspaceId, input.source.id)) return false
  const snapshot = await getDocumentIndexSnapshot(input.source.id).catch(() => null)
  const created = await createProjectDocument(input.source.project_id, {
    workspace_id: input.targetWorkspaceId,
    title: input.source.title,
    summary: input.source.summary ?? snapshot?.summary ?? null,
    content: snapshot?.content || input.source.content || `Shared Samples copy of ${input.source.title}`,
    document_type_code: input.source.document_type_code,
    category_code: input.source.category_code,
    capability_code: input.source.capability_code ?? null,
    status_code: input.source.status_code,
    tags: input.source.tags,
    access_scope_codes: input.source.access_scope_codes,
    folder_id: input.targetFolderId,
    metadata: {
      ...(input.source.metadata ?? {}),
      [SAMPLES_SHARE_SOURCE_META]: input.source.id,
      shared_from_workspace_id: input.source.workspace_id ?? null,
    },
    version_notes: 'Copied from shared Samples library',
  })

  try {
    const attachment = await resolveLatestDocumentAttachmentBlob(input.source.id, {
      projectId: input.source.project_id,
      fileNameHint: typeof input.source.metadata?.original_file_name === 'string'
        ? input.source.metadata.original_file_name
        : input.source.title,
    })
    const file = new File([attachment.blob], attachment.fileName, { type: attachment.contentType })
    const uploaded = await uploadDocumentAttachment(created.id, file, { source: 'samples-share-sync' })
    try {
      await patchDocument(created.id, {
        version: created.version,
        metadata: { ...created.metadata, primary_attachment_id: uploaded.id },
      })
    } catch {
      /* copy exists even if metadata patch fails */
    }
  } catch {
    /* text-only copy is still useful as a gold-set excerpt */
  }
  return true
}

export async function syncSamplesShareToWorkspaces(input: {
  kind: 'folder' | 'document'
  sourceWorkspaceId: string
  ownerId: string | null
  folderId: string | null
  documentId?: string
  targetWorkspaceIds: readonly string[]
  folders: DocumentFolder[]
}): Promise<{ copied: number; skipped: number }> {
  const targets = [...new Set(input.targetWorkspaceIds.map((id) => id.trim()).filter(Boolean))]
  let copied = 0
  let skipped = 0

  const sourceDocs: DocumentResponse[] = []
  if (input.kind === 'document' && input.documentId) {
    sourceDocs.push(await getDocument(input.documentId))
  } else if (input.kind === 'folder' && input.folderId) {
    const folderIds = new Set(
      input.folders
        .filter((folder) => {
          let cursor: string | null = folder.id
          let guard = 0
          while (cursor && guard < 64) {
            if (cursor === input.folderId) return true
            cursor = input.folders.find((row) => row.id === cursor)?.parent_id ?? null
            guard += 1
          }
          return false
        })
        .map((folder) => folder.id),
    )
    let page = 1
    while (page <= 8) {
      const res = await listAllDocuments({ workspace_id: input.sourceWorkspaceId, page, page_size: 100 })
      sourceDocs.push(...res.items.filter((doc) => doc.folder_id && folderIds.has(doc.folder_id)))
      if (res.items.length === 0 || page * 100 >= res.total) break
      page += 1
    }
  }

  for (const workspaceId of targets) {
    if (input.kind === 'folder' && input.folderId) {
      const relative = samplesRelativeFolderNames(input.folderId, input.folders) ?? []
      await ensureFolderPath({ workspaceId, ownerId: input.ownerId, relativeNames: relative })
    }

    for (const doc of sourceDocs) {
      const relative = samplesRelativeFolderNames(doc.folder_id ?? input.folderId, input.folders) ?? []
      try {
        const targetFolderId = await ensureFolderPath({
          workspaceId,
          ownerId: input.ownerId,
          relativeNames: relative,
        })
        const didCopy = await copyDocumentToWorkspace({
          source: doc,
          targetWorkspaceId: workspaceId,
          targetFolderId,
          ownerId: input.ownerId,
        })
        if (didCopy) copied += 1
        else skipped += 1
      } catch {
        skipped += 1
      }
    }

    if (input.kind === 'folder' && sourceDocs.length === 0 && input.folderId) {
      const relative = samplesRelativeFolderNames(input.folderId, input.folders) ?? []
      await ensureFolderPath({ workspaceId, ownerId: input.ownerId, relativeNames: relative })
    }
  }

  return { copied, skipped }
}
