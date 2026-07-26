import type { WorkItemApiModel } from '@/lib/api/workApi'
import { openWorkOfflineDb } from './workOfflineDb'
import type { WorkOutboxEntry, WorkSyncConflict } from './types'

const META_LAST_SYNC_KEY = 'lastSyncedAt'
const META_LAST_PULL_KEY = 'lastPulledAt'

function readAll<T>(storeName: 'items' | 'outbox' | 'conflicts'): Promise<T[]> {
  return openWorkOfflineDb().then(
    (db) =>
      new Promise<T[]>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly')
        const request = tx.objectStore(storeName).getAll()
        request.onsuccess = () => resolve((request.result ?? []) as T[])
        request.onerror = () => reject(request.error ?? new Error(`Failed to read ${storeName}`))
      }),
  )
}

function readOne<T>(storeName: 'items' | 'meta' | 'conflicts', key: IDBValidKey): Promise<T | undefined> {
  return openWorkOfflineDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly')
        const request = tx.objectStore(storeName).get(key)
        request.onsuccess = () => resolve(request.result as T | undefined)
        request.onerror = () => reject(request.error ?? new Error(`Failed to read ${storeName}`))
      }),
  )
}

export async function getCachedWorkItems(): Promise<WorkItemApiModel[]> {
  try {
    return await readAll<WorkItemApiModel>('items')
  } catch {
    return []
  }
}

export async function getCachedWorkItem(businessKey: string): Promise<WorkItemApiModel | undefined> {
  try {
    return await readOne<WorkItemApiModel>('items', businessKey)
  } catch {
    return undefined
  }
}

export async function replaceCachedWorkItems(items: WorkItemApiModel[]): Promise<void> {
  const db = await openWorkOfflineDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['items', 'meta'], 'readwrite')
    const itemStore = tx.objectStore('items')
    const metaStore = tx.objectStore('meta')
    const clearRequest = itemStore.clear()

    clearRequest.onerror = () => reject(clearRequest.error ?? new Error('Failed to clear work item cache'))
    clearRequest.onsuccess = () => {
      for (const item of items) {
        itemStore.put(item)
      }
      metaStore.put({ key: META_LAST_SYNC_KEY, value: new Date().toISOString() })
    }

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to write work item cache'))
    tx.onabort = () => reject(tx.error ?? new Error('Work item cache transaction aborted'))
  })
}

export async function upsertCachedWorkItem(item: WorkItemApiModel): Promise<void> {
  const db = await openWorkOfflineDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('items', 'readwrite')
    const request = tx.objectStore('items').put(item)
    request.onerror = () => reject(request.error ?? new Error('Failed to upsert work item cache'))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to upsert work item cache'))
  })
}

export async function removeCachedWorkItem(businessKey: string): Promise<void> {
  const db = await openWorkOfflineDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('items', 'readwrite')
    const request = tx.objectStore('items').delete(businessKey)
    request.onerror = () => reject(request.error ?? new Error('Failed to delete cached work item'))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to delete cached work item'))
  })
}

export async function getLastSyncedAt(): Promise<string | null> {
  try {
    const row = await readOne<{ key: string; value: string }>('meta', META_LAST_SYNC_KEY)
    return row?.value ?? null
  } catch {
    return null
  }
}

export async function touchLastSyncedAt(isoString?: string): Promise<void> {
  const db = await openWorkOfflineDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite')
    const request = tx.objectStore('meta').put({
      key: META_LAST_SYNC_KEY,
      value: isoString ?? new Date().toISOString(),
    })
    request.onerror = () => reject(request.error ?? new Error('Failed to update last sync time'))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to update last sync time'))
  })
}

export async function getLastPulledAt(): Promise<string | null> {
  try {
    const row = await readOne<{ key: string; value: string }>('meta', META_LAST_PULL_KEY)
    return row?.value ?? null
  } catch {
    return null
  }
}

export async function touchLastPulledAt(isoString?: string): Promise<void> {
  const db = await openWorkOfflineDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite')
    const request = tx.objectStore('meta').put({
      key: META_LAST_PULL_KEY,
      value: isoString ?? new Date().toISOString(),
    })
    request.onerror = () => reject(request.error ?? new Error('Failed to update last pull time'))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to update last pull time'))
  })
}

export async function mergeCachedWorkItems(items: WorkItemApiModel[]): Promise<void> {
  if (items.length === 0) return
  const db = await openWorkOfflineDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('items', 'readwrite')
    const store = tx.objectStore('items')
    for (const item of items) {
      store.put(item)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to merge work item cache'))
  })
}

export async function removeCachedWorkItems(businessKeys: string[]): Promise<void> {
  if (businessKeys.length === 0) return
  const db = await openWorkOfflineDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('items', 'readwrite')
    const store = tx.objectStore('items')
    for (const key of businessKeys) {
      store.delete(key)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to remove cached work items'))
  })
}

export async function listOutboxEntries(): Promise<WorkOutboxEntry[]> {
  try {
    const rows = await readAll<WorkOutboxEntry>('outbox')
    return rows.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  } catch {
    return []
  }
}

export async function enqueueOutboxEntry(entry: Omit<WorkOutboxEntry, 'id'>): Promise<WorkOutboxEntry> {
  const db = await openWorkOfflineDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite')
    const request = tx.objectStore('outbox').add(entry)
    request.onerror = () => reject(request.error ?? new Error('Failed to enqueue outbox entry'))
    request.onsuccess = () => resolve({ ...entry, id: request.result as number })
  })
}

export async function removeOutboxEntry(id: number): Promise<void> {
  const db = await openWorkOfflineDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite')
    const request = tx.objectStore('outbox').delete(id)
    request.onerror = () => reject(request.error ?? new Error('Failed to remove outbox entry'))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to remove outbox entry'))
  })
}

export async function updateOutboxEntry(entry: WorkOutboxEntry): Promise<void> {
  const db = await openWorkOfflineDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite')
    const request = tx.objectStore('outbox').put(entry)
    request.onerror = () => reject(request.error ?? new Error('Failed to update outbox entry'))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to update outbox entry'))
  })
}

export async function listStoredConflicts(): Promise<WorkSyncConflict[]> {
  try {
    return await readAll<WorkSyncConflict>('conflicts')
  } catch {
    return []
  }
}

export async function saveConflict(conflict: WorkSyncConflict): Promise<void> {
  const db = await openWorkOfflineDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('conflicts', 'readwrite')
    const request = tx.objectStore('conflicts').put(conflict)
    request.onerror = () => reject(request.error ?? new Error('Failed to save sync conflict'))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save sync conflict'))
  })
}

export async function removeConflict(conflictId: string): Promise<void> {
  const db = await openWorkOfflineDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('conflicts', 'readwrite')
    const request = tx.objectStore('conflicts').delete(conflictId)
    request.onerror = () => reject(request.error ?? new Error('Failed to remove sync conflict'))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to remove sync conflict'))
  })
}

export async function countPendingOutbox(): Promise<number> {
  const rows = await listOutboxEntries()
  return rows.filter((row) => row.status === 'pending').length
}

export async function countStoredConflicts(): Promise<number> {
  const rows = await listStoredConflicts()
  return rows.length
}
