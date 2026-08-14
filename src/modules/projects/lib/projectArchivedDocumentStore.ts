export type ArchivedDocumentReason = 'manual' | 'sample'

/** Snapshot kept for read-only audit when the live document list is filtered. */
export interface ArchivedDocumentSnapshot {
  id: string
  name: string
  fileName: string
  type: string
  capability: string
  linkedContext: string
  owner: string
  version: string
  status: string
  updated: string
  accessScope: string
  folderId: string | null
  storageProjectId: string
}

export interface ArchivedDocumentRecord {
  archivedAt: string
  archivedBy: string
  reason: ArchivedDocumentReason
  snapshot: ArchivedDocumentSnapshot
}

type ArchivedDocumentStoreSnapshot = Record<string, ArchivedDocumentRecord>

const STORAGE_KEY_PREFIX = 'tectona-project-archived-docs-v1'

function storageKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}:${projectId}`
}

function readStore(projectId: string): ArchivedDocumentStoreSnapshot {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(storageKey(projectId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as ArchivedDocumentStoreSnapshot
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(projectId: string, snapshot: ArchivedDocumentStoreSnapshot): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey(projectId), JSON.stringify(snapshot))
}

export function listArchivedDocumentRecords(projectId: string): ArchivedDocumentStoreSnapshot {
  return readStore(projectId)
}

export function isDocumentArchived(projectId: string, documentId: string): boolean {
  return Boolean(readStore(projectId)[documentId])
}

export function archiveDocumentRecord(
  projectId: string,
  documentId: string,
  record: ArchivedDocumentRecord,
): void {
  const next = { ...readStore(projectId), [documentId]: record }
  writeStore(projectId, next)
}

export function restoreDocumentRecord(projectId: string, documentId: string): void {
  const current = readStore(projectId)
  if (!current[documentId]) return
  const next = { ...current }
  delete next[documentId]
  writeStore(projectId, next)
}

export function listArchivedDocumentIds(projectId: string): string[] {
  return Object.keys(readStore(projectId))
}
