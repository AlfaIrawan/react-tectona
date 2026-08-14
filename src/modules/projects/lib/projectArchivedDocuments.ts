import type { RepositoryItem } from '@/modules/document-knowledge-management/lib/documentRepositoryPresentation'
import {
  archiveDocumentRecord,
  isDocumentArchived,
  listArchivedDocumentIds,
  listArchivedDocumentRecords,
  restoreDocumentRecord,
  type ArchivedDocumentRecord,
  type ArchivedDocumentSnapshot,
} from './projectArchivedDocumentStore'
import { formatArchivedDate } from './projectArchivedWorkItems'

function toSnapshot(item: RepositoryItem): ArchivedDocumentSnapshot {
  return {
    id: item.id,
    name: item.name,
    fileName: item.fileName,
    type: item.type,
    capability: item.capability,
    linkedContext: item.linkedContext,
    owner: item.owner,
    version: item.version,
    status: item.status,
    updated: item.updated,
    accessScope: item.accessScope,
    folderId: item.folderId,
    storageProjectId: item.storageProjectId,
  }
}

export function filterActiveRepositoryItems(items: RepositoryItem[], projectId: string): RepositoryItem[] {
  return items.filter((item) => !isDocumentArchived(projectId, item.id))
}

export function listArchivedDocumentSnapshots(projectId: string): ArchivedDocumentSnapshot[] {
  const store = listArchivedDocumentRecords(projectId)
  return listArchivedDocumentIds(projectId)
    .map((id) => store[id]?.snapshot)
    .filter((snapshot): snapshot is ArchivedDocumentSnapshot => Boolean(snapshot))
}

export type ArchivedDocumentRow = {
  snapshot: ArchivedDocumentSnapshot
  meta: ArchivedDocumentRecord
}

export function listArchivedDocumentRows(projectId: string): ArchivedDocumentRow[] {
  const store = listArchivedDocumentRecords(projectId)
  return listArchivedDocumentIds(projectId)
    .map((id) => {
      const meta = store[id]
      if (!meta?.snapshot) return null
      return { snapshot: meta.snapshot, meta }
    })
    .filter((row): row is ArchivedDocumentRow => row != null)
}

export function archiveDocumentManual(input: {
  projectId: string
  item: RepositoryItem
  archivedBy: string
}): void {
  archiveDocumentRecord(input.projectId, input.item.id, {
    archivedAt: new Date().toISOString(),
    archivedBy: input.archivedBy,
    reason: 'manual',
    snapshot: toSnapshot(input.item),
  })
}

export function restoreArchivedDocument(projectId: string, documentId: string): void {
  restoreDocumentRecord(projectId, documentId)
}

export function getArchivedDocumentRecord(
  projectId: string,
  documentId: string,
): ArchivedDocumentRecord | undefined {
  return listArchivedDocumentRecords(projectId)[documentId]
}

export { formatArchivedDate }
