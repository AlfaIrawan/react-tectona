export type ArchivedWorkItemReason = 'manual' | 'auto' | 'sample'

export interface ArchivedWorkItemRecord {
  archivedAt: string
  archivedBy: string
  reason: ArchivedWorkItemReason
}

type ArchivedStoreSnapshot = Record<string, ArchivedWorkItemRecord>

const STORAGE_KEY_PREFIX = 'tectona-project-archived-v1'

function storageKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}:${projectId}`
}

function readStore(projectId: string): ArchivedStoreSnapshot {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(storageKey(projectId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as ArchivedStoreSnapshot
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(projectId: string, snapshot: ArchivedStoreSnapshot): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey(projectId), JSON.stringify(snapshot))
}

export function listArchivedWorkItemRecords(projectId: string): ArchivedStoreSnapshot {
  return readStore(projectId)
}

export function isWorkItemArchived(projectId: string, workItemId: string): boolean {
  return Boolean(readStore(projectId)[workItemId])
}

export function archiveWorkItemRecord(
  projectId: string,
  workItemId: string,
  record: ArchivedWorkItemRecord,
): void {
  const next = { ...readStore(projectId), [workItemId]: record }
  writeStore(projectId, next)
}

export function restoreWorkItemRecord(projectId: string, workItemId: string): void {
  const current = readStore(projectId)
  if (!current[workItemId]) return
  const next = { ...current }
  delete next[workItemId]
  writeStore(projectId, next)
}

export function listArchivedWorkItemIds(projectId: string): string[] {
  return Object.keys(readStore(projectId))
}
