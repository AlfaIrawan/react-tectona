import {
  listAllDocuments,
  listProjectDocuments,
  patchDocument,
  type DocumentResponse,
} from '@/lib/api/documentKnowledgeApi'
import { fetchProjects, TECTONA_PROJECT_APP_ID } from '@/lib/api/projectApi'
import { ensureProjectDocumentFolder } from './ensureProjectDocumentFolder'

const DOCUMENTS_PAGE_SIZE = 100

export function isDocumentLinkedToIdea(doc: DocumentResponse, ideaId: string): boolean {
  const normalizedIdeaId = ideaId.trim().toLowerCase()
  if (!normalizedIdeaId) return false

  const metadataIdeaId = doc.metadata?.idea_id
  if (metadataIdeaId != null && String(metadataIdeaId).trim().toLowerCase() === normalizedIdeaId) {
    return true
  }

  return doc.tags.some((tag) => tag.trim().toLowerCase() === normalizedIdeaId)
}

async function paginateProjectDocuments(
  projectId: string,
  params?: {
    tag?: string
    folder_id?: string
  },
): Promise<DocumentResponse[]> {
  const byId = new Map<string, DocumentResponse>()
  let page = 1

  while (true) {
    const response = await listProjectDocuments(projectId, {
      ...params,
      page,
      page_size: DOCUMENTS_PAGE_SIZE,
    })

    for (const item of response.items) {
      byId.set(item.id, item)
    }

    const total = response.total ?? response.items.length
    if (page * DOCUMENTS_PAGE_SIZE >= total || response.items.length < DOCUMENTS_PAGE_SIZE) {
      break
    }
    page += 1
  }

  return Array.from(byId.values())
}

async function absorbDocumentsFromGlobalList(
  ideaId: string,
  workspaceId: string | null | undefined,
  sink: Map<string, DocumentResponse>,
): Promise<void> {
  let page = 1

  while (true) {
    const response = await listAllDocuments({
      workspace_id: workspaceId ?? undefined,
      page,
      page_size: DOCUMENTS_PAGE_SIZE,
    })

    for (const item of response.items) {
      if (isDocumentLinkedToIdea(item, ideaId)) {
        sink.set(item.id, item)
      }
    }

    const total = response.total ?? response.items.length
    if (page * DOCUMENTS_PAGE_SIZE >= total || response.items.length < DOCUMENTS_PAGE_SIZE) {
      break
    }
    page += 1
  }
}

async function absorbDocumentsFromWorkspaceProjects(
  ideaId: string,
  workspaceId: string | null | undefined,
  sink: Map<string, DocumentResponse>,
): Promise<void> {
  const projectList = await fetchProjects({
    page: 1,
    page_size: 100,
    app_id: TECTONA_PROJECT_APP_ID,
    workspace_id: workspaceId ?? null,
  })

  for (const project of projectList.projects ?? []) {
    try {
      const docs = await paginateProjectDocuments(project.id)
      for (const doc of docs) {
        if (isDocumentLinkedToIdea(doc, ideaId)) {
          sink.set(doc.id, doc)
        }
      }
    } catch {
      continue
    }
  }
}

/**
 * Resolves all documents for an idea, including those stored under another project
 * in the same workspace (legacy Idea Docs stored on the first project in the list).
 */
export async function fetchDocumentsLinkedToIdea(input: {
  ideaId: string
  projectId?: string | null
  workspaceId?: string | null
}): Promise<DocumentResponse[]> {
  const byId = new Map<string, DocumentResponse>()
  const workspaceCandidates = Array.from(
    new Set([input.workspaceId ?? null, null].filter((value, index, arr) => arr.indexOf(value) === index)),
  )

  for (const workspaceId of workspaceCandidates) {
    try {
      await absorbDocumentsFromGlobalList(input.ideaId, workspaceId, byId)
    } catch {
      // Global list may be unavailable for this workspace filter.
    }
  }

  for (const workspaceId of workspaceCandidates) {
    try {
      await absorbDocumentsFromWorkspaceProjects(input.ideaId, workspaceId, byId)
    } catch {
      continue
    }
  }

  if (input.projectId) {
    try {
      const docs = await paginateProjectDocuments(input.projectId)
      for (const doc of docs) {
        if (isDocumentLinkedToIdea(doc, input.ideaId)) {
          byId.set(doc.id, doc)
        }
      }
    } catch {
      // Best-effort enrichment for the linked project.
    }
  }

  return Array.from(byId.values())
}

export async function syncIdeaDocumentsToProjectFolder(input: {
  project: { id: string; name: string }
  ideaId: string
  workspaceId?: string | null
}): Promise<{ syncedCount: number; skippedCount: number }> {
  const folderId = await ensureProjectDocumentFolder(input.project)
  const docs = await fetchDocumentsLinkedToIdea({
    ideaId: input.ideaId,
    projectId: input.project.id,
    workspaceId: input.workspaceId,
  })

  let syncedCount = 0
  let skippedCount = 0

  for (const doc of docs) {
    const needsFolder = doc.folder_id !== folderId
    const needsMetadata =
      String(doc.metadata?.idea_id ?? '') !== input.ideaId
      || String(doc.metadata?.storage_project_id ?? '') !== input.project.id
      || String(doc.metadata?.storage_project_name ?? '') !== input.project.name

    if (!needsFolder && !needsMetadata) continue

    try {
      await patchDocument(doc.id, {
        version: doc.version,
        folder_id: folderId,
        metadata: {
          ...doc.metadata,
          idea_id: input.ideaId,
          storage_project_id: input.project.id,
          storage_project_name: input.project.name,
        },
      })
      syncedCount += 1
    } catch {
      skippedCount += 1
    }
  }

  return { syncedCount, skippedCount }
}
