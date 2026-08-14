import type { DocumentResponse } from '@/lib/api/documentKnowledgeApi'
import { listProjectDocuments } from '@/lib/api/documentKnowledgeApi'
import { mapDocumentToRepositoryItem } from '@/modules/document-knowledge-management/lib/documentRepositoryPresentation'
import { fetchDocumentsLinkedToIdea } from './ideaLinkedDocuments'
import { filterActiveRepositoryItems } from './projectArchivedDocuments'

const PAGE_SIZE = 100

async function paginateProjectDocuments(projectId: string): Promise<DocumentResponse[]> {
  const byId = new Map<string, DocumentResponse>()
  let page = 1

  while (true) {
    const response = await listProjectDocuments(projectId, { page, page_size: PAGE_SIZE })
    for (const item of response.items) {
      byId.set(item.id, item)
    }
    const total = response.total ?? response.items.length
    if (page * PAGE_SIZE >= total || response.items.length < PAGE_SIZE) break
    page += 1
  }

  return Array.from(byId.values())
}

export function buildProjectDocsFingerprint(documents: DocumentResponse[]): string {
  return documents
    .map((doc) => `${doc.id}:${doc.updated_date ?? doc.created_date}:${doc.current_version_no}`)
    .sort()
    .join('|')
}

export type ProjectScenarioDocumentContext = {
  documents: DocumentResponse[]
  fingerprint: string
  repositoryNamesById: Map<string, string>
}

export async function fetchProjectDocumentsForScenarios(input: {
  projectId: string
  projectName: string
  linkedIdeaId?: string | null
  linkedIdeaWorkspaceId?: string | null
  workspaceId?: string | null
}): Promise<ProjectScenarioDocumentContext> {
  const byId = new Map<string, DocumentResponse>()

  const projectDocs = await paginateProjectDocuments(input.projectId)
  for (const doc of projectDocs) {
    byId.set(doc.id, doc)
  }

  if (input.linkedIdeaId) {
    try {
      const ideaDocs = await fetchDocumentsLinkedToIdea({
        ideaId: input.linkedIdeaId,
        projectId: input.projectId,
        workspaceId: input.linkedIdeaWorkspaceId ?? input.workspaceId ?? null,
      })
      for (const doc of ideaDocs) {
        byId.set(doc.id, doc)
      }
    } catch {
      // best-effort merge
    }
  }

  const documents = Array.from(byId.values()).sort(
    (left, right) =>
      new Date(right.updated_date ?? right.created_date).getTime() -
      new Date(left.updated_date ?? left.created_date).getTime(),
  )

  const activeRepositoryItems = filterActiveRepositoryItems(
    documents.map((doc) => mapDocumentToRepositoryItem(doc, input.projectName)),
    input.projectId,
  )
  const activeIds = new Set(activeRepositoryItems.map((item) => item.id))
  const activeDocuments = documents.filter((doc) => activeIds.has(doc.id))

  const repositoryNamesById = new Map(activeRepositoryItems.map((item) => [item.id, item.name]))

  return {
    documents: activeDocuments,
    fingerprint: buildProjectDocsFingerprint(activeDocuments),
    repositoryNamesById,
  }
}
