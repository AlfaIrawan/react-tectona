import { listAllDocuments, getDocumentIndexSnapshot } from '@/lib/api/documentKnowledgeApi'
import { fetchAllDocumentFolders } from '@/lib/api/documentFolderApi'
import { embedKnowledgeIndexTexts } from '@/lib/api/knowledgeIndexApi'
import {
  classifyAgainstSampleGoldSet,
  clipSampleExcerpt,
  collectTextsForSampleClassifyEmbed,
  excerptFromIndexSnapshot,
  selectSampleGoldItems,
  type SampleGoldDocument,
  type SampleKindClassification,
} from '@/modules/document-knowledge-management/lib/classifyFromSamples'
import type { SampleGoldWorkspaceRef } from '@/modules/document-knowledge-management/lib/resolveSampleGoldWorkspacePlan'
import {
  reconcileOrgSampleKindVotes,
  sampleKindVoteFromClassification,
  type OrgSampleKindReconcile,
  type WorkspaceSampleKindVote,
} from '@/modules/document-knowledge-management/lib/reconcileOrgSampleKindVotes'

const MAX_OVERLAYS = 12
const MAX_DOC_PAGES = 4

async function listWorkspaceDocuments(workspaceId: string) {
  const items: Array<{ id: string; folderId: string | null; name: string; fileName: string }> = []
  for (let page = 1; page <= MAX_DOC_PAGES; page += 1) {
    const res = await listAllDocuments({ workspace_id: workspaceId, page, page_size: 100 })
    for (const doc of res.items) {
      const fileName = typeof doc.metadata?.original_file_name === 'string' && doc.metadata.original_file_name.trim()
        ? doc.metadata.original_file_name
        : doc.title
      items.push({
        id: doc.id,
        folderId: typeof doc.folder_id === 'string' ? doc.folder_id : null,
        name: doc.title,
        fileName,
      })
    }
    if (res.items.length === 0 || page * 100 >= res.total) break
  }
  return items
}

async function loadGoldDocsForWorkspace(workspaceId: string): Promise<SampleGoldDocument[]> {
  const [folders, docs] = await Promise.all([
    fetchAllDocumentFolders(workspaceId),
    listWorkspaceDocuments(workspaceId),
  ])
  const goldItems = selectSampleGoldItems(docs, folders)
  const goldDocs: SampleGoldDocument[] = []
  await Promise.all(goldItems.map(async (item) => {
    try {
      const snapshot = await getDocumentIndexSnapshot(item.id)
      const text = excerptFromIndexSnapshot(snapshot) || clipSampleExcerpt(`${item.name} ${item.fileName}`)
      if (text.length >= 24) goldDocs.push({ id: item.id, kind: item.sampleKind, text })
    } catch {
      const text = clipSampleExcerpt(`${item.name} ${item.fileName}`)
      if (text.length >= 24) goldDocs.push({ id: item.id, kind: item.sampleKind, text })
    }
  }))
  return goldDocs
}

const EMPTY_CLASSIFICATION: SampleKindClassification = {
  kind: 'unknown',
  source: 'unknown',
  confidence: 0,
  reason: 'Samples library has no comparable excerpts yet.',
}

export async function classifyQueryAgainstOrgSampleWorkspaces(input: {
  queryText: string
  fileName?: string
  home: SampleGoldWorkspaceRef
  overlays: readonly SampleGoldWorkspaceRef[]
}): Promise<OrgSampleKindReconcile> {
  const overlaySlice = input.overlays.slice(0, MAX_OVERLAYS)
  const targets: SampleGoldWorkspaceRef[] = [input.home, ...overlaySlice]
  const goldByWorkspace = new Map<string, SampleGoldDocument[]>()

  await Promise.all(targets.map(async (workspace) => {
    try {
      goldByWorkspace.set(workspace.id, await loadGoldDocsForWorkspace(workspace.id))
    } catch {
      goldByWorkspace.set(workspace.id, [])
    }
  }))

  const allGold = [...goldByWorkspace.values()].flat()
  let vectorsByText: Map<string, number[]> | null = null
  if (allGold.length > 0 && input.queryText.trim()) {
    try {
      const uniqueTexts = collectTextsForSampleClassifyEmbed(input.queryText, allGold)
      vectorsByText = await embedKnowledgeIndexTexts(uniqueTexts)
      if (vectorsByText.size === 0) vectorsByText = null
    } catch {
      vectorsByText = null
    }
  }

  const voteFor = (workspace: SampleGoldWorkspaceRef): WorkspaceSampleKindVote => {
    const goldDocs = goldByWorkspace.get(workspace.id) ?? []
    const classification = goldDocs.length > 0 && input.queryText.trim()
      ? classifyAgainstSampleGoldSet(input.queryText, goldDocs, vectorsByText, { fileName: input.fileName })
      : EMPTY_CLASSIFICATION
    return sampleKindVoteFromClassification(workspace, goldDocs.length > 0, classification)
  }

  return reconcileOrgSampleKindVotes(voteFor(input.home), overlaySlice.map(voteFor))
}
