import {
  deleteKbEntry,
  deleteKbRelation,
  listAllKbEntries,
  listKbRelations,
} from '@/lib/api/tectonaKbApi'
import { repositoryTraceEntryTitle } from '@/lib/kb/repositoryKbFromDocument'

type KbEntryLike = { id: string; title: string; content?: string | null }

/**
 * Deletes the KB generated from one document: its trace entry ("<title> Source Document",
 * content naming the document id) and the KB entries linked to it by a
 * `document_traceability` relation for that document. A trace of another document with the
 * same title is only used to reach relations that name this document. Best effort: one
 * failed lookup or delete does not stop the rest. Returns the ids of the deleted entries.
 */
export async function deleteDocumentGeneratedKb(params: {
  documentId: string
  documentTitle: string
  /** KB entries already loaded by the page; fetched when empty. */
  entries?: KbEntryLike[]
}): Promise<Set<string>> {
  const documentIdNeedle = params.documentId.trim().toLowerCase()
  if (!documentIdNeedle) return new Set()

  let entries: KbEntryLike[] = params.entries ?? []
  if (entries.length === 0) {
    try {
      entries = (await listAllKbEntries()).items
    } catch {
      return new Set()
    }
  }

  const traceTitleNeedle = repositoryTraceEntryTitle(params.documentTitle).trim().toLowerCase()
  const traceCandidates = entries.filter((entry) => {
    const title = entry.title.trim().toLowerCase()
    const content = (entry.content ?? '').toLowerCase()
    return title === traceTitleNeedle || content.includes(documentIdNeedle)
  })
  if (traceCandidates.length === 0) return new Set()

  const relationIdsToDelete = new Set<string>()
  const entryIdsToDelete = new Set<string>()

  for (const traceEntry of traceCandidates) {
    if ((traceEntry.content ?? '').toLowerCase().includes(documentIdNeedle)) {
      entryIdsToDelete.add(traceEntry.id)
    }
    try {
      const relationPage = await listKbRelations({ entry_id: traceEntry.id, direction: 'any', page: 1, page_size: 200 })
      relationPage.items.forEach((relation) => {
        const relationDocumentId = typeof relation.properties?.document_id === 'string'
          ? relation.properties.document_id.trim().toLowerCase()
          : ''
        const relationKind = typeof relation.properties?.relation_kind === 'string'
          ? relation.properties.relation_kind.trim().toLowerCase()
          : ''
        if (relationDocumentId !== documentIdNeedle || relationKind !== 'document_traceability') return

        relationIdsToDelete.add(relation.id)
        entryIdsToDelete.add(traceEntry.id)
        if (relation.source_entry_id !== traceEntry.id) entryIdsToDelete.add(relation.source_entry_id)
        if (relation.target_entry_id !== traceEntry.id) entryIdsToDelete.add(relation.target_entry_id)
      })
    } catch {
      // Keep best-effort cleanup even if relation listing fails for one candidate.
    }
  }

  if (relationIdsToDelete.size > 0) {
    await Promise.allSettled(Array.from(relationIdsToDelete).map((id) => deleteKbRelation(id)))
  }
  if (entryIdsToDelete.size > 0) {
    await Promise.allSettled(Array.from(entryIdsToDelete).map((id) => deleteKbEntry(id)))
  }
  return entryIdsToDelete
}
