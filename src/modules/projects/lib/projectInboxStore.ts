export type InboxSourceChannel = 'team' | 'idea' | 'form' | 'system'

export type InboxItemStatus = 'pending' | 'declined'

export interface InboxWorkItemRecord {
  routedAt: string
  routedBy: string
  sourceTeam: string
  sourceChannel: InboxSourceChannel
  status: InboxItemStatus
  requestNote?: string
}

type InboxStoreSnapshot = Record<string, InboxWorkItemRecord>

const STORAGE_KEY_PREFIX = 'tectona-project-inbox-v1'

function storageKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}:${projectId}`
}

function readStore(projectId: string): InboxStoreSnapshot {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(storageKey(projectId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as InboxStoreSnapshot
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(projectId: string, snapshot: InboxStoreSnapshot): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey(projectId), JSON.stringify(snapshot))
}

export function listInboxWorkItemRecords(projectId: string): InboxStoreSnapshot {
  return readStore(projectId)
}

export function isWorkItemInPendingInbox(projectId: string, workItemId: string): boolean {
  const record = readStore(projectId)[workItemId]
  return record?.status === 'pending'
}

export function upsertInboxWorkItemRecord(
  projectId: string,
  workItemId: string,
  record: InboxWorkItemRecord,
): void {
  const next = { ...readStore(projectId), [workItemId]: record }
  writeStore(projectId, next)
}

export function removeInboxWorkItemRecord(projectId: string, workItemId: string): void {
  const current = readStore(projectId)
  if (!current[workItemId]) return
  const next = { ...current }
  delete next[workItemId]
  writeStore(projectId, next)
}

export function listPendingInboxWorkItemIds(projectId: string): string[] {
  const store = readStore(projectId)
  return Object.keys(store).filter((id) => store[id]?.status === 'pending')
}
