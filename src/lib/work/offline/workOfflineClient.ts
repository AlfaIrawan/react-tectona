import {
  createWorkItem as createWorkItemRemote,
  deleteWorkItem as deleteWorkItemRemote,
  getWorkItem as getWorkItemRemote,
  listWorkItems as listWorkItemsRemote,
  patchWorkItem as patchWorkItemRemote,
  WORK_API_BASE,
  WorkItemVersionConflictError,
  type WorkItemApiModel,
  type WorkItemCreateBody,
  type WorkItemPatchBody,
} from '@/lib/api/workApi'
import { apiFetch, tectonaServiceHeaders } from '@/lib/api/httpClient'
import {
  countPendingOutbox,
  countStoredConflicts,
  enqueueOutboxEntry,
  getCachedWorkItem,
  getCachedWorkItems,
  getLastPulledAt,
  getLastSyncedAt,
  listOutboxEntries,
  listStoredConflicts,
  mergeCachedWorkItems,
  removeCachedWorkItem,
  removeCachedWorkItems,
  removeConflict,
  removeOutboxEntry,
  replaceCachedWorkItems,
  saveConflict,
  touchLastPulledAt,
  touchLastSyncedAt,
  updateOutboxEntry,
  upsertCachedWorkItem,
} from './workOfflineStore'
import type { WorkConflictResolution, WorkSyncActivityEvent, WorkSyncConflict, WorkSyncStatus } from './types'
import { WORK_CONFLICT_FIELD_LABELS } from './types'
import { isWorkApiUnavailableError, isWorkDataOnline } from './workApiReachability'
import { emitWorkSyncDataChanged, emitWorkSyncOpenConflict } from './workSyncEvents'
import { randomUuid } from '@/lib/randomId'

type StatusListener = (status: WorkSyncStatus) => void
type ConflictListener = (conflicts: WorkSyncConflict[]) => void
type ActivityListener = (event: WorkSyncActivityEvent) => void

const statusListeners = new Set<StatusListener>()
const conflictListeners = new Set<ConflictListener>()
const activityListeners = new Set<ActivityListener>()

let flushInFlight: Promise<void> | null = null
let pullInFlight: Promise<WorkItemApiModel[]> | null = null
let offlineSyncSubscriberCount = 0
let offlineSyncTeardown: (() => void) | null = null
let workApiReachable = true
let healthProbeIntervalId: number | null = null
let probeFailureStreak = 0
let probeSuccessStreak = 0

/** Require consecutive probe failures before flipping to offline — avoids toast flapping on transient errors. */
const PROBE_OFFLINE_STREAK_THRESHOLD = 2
const PROBE_ONLINE_STREAK_THRESHOLD = 1

function createOpId(): string {
  return randomUuid()
}

function isBrowserOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

function markWorkApiReachable(reachable: boolean): void {
  workApiReachable = reachable
}

function applyProbeReachability(ok: boolean): void {
  if (ok) {
    probeFailureStreak = 0
    probeSuccessStreak += 1
    if (!workApiReachable && probeSuccessStreak >= PROBE_ONLINE_STREAK_THRESHOLD) {
      markWorkApiReachable(true)
    }
    return
  }

  probeSuccessStreak = 0
  probeFailureStreak += 1
  if (workApiReachable && probeFailureStreak >= PROBE_OFFLINE_STREAK_THRESHOLD) {
    markWorkApiReachable(false)
  }
}

async function probeWorkApiHealth(): Promise<boolean> {
  if (!isBrowserOnline()) return false
  try {
    // Must use a path under Vite's `/api/work` proxy — root `/health` is not forwarded.
    const response = await apiFetch(`${WORK_API_BASE}/api/work/v1/work-items?limit=1`, {
      headers: tectonaServiceHeaders(),
    })
    return response.ok
  } catch {
    return false
  }
}

async function syncWorkApiReachabilityFromProbe(): Promise<void> {
  if (!isBrowserOnline()) {
    markWorkApiReachable(false)
    await emitStatus()
    return
  }

  const ok = await probeWorkApiHealth()
  const wasReachable = workApiReachable
  applyProbeReachability(ok)
  await emitStatus()

  if (!ok) return

  const pendingCount = await countPendingOutbox()
  const reconnected = !wasReachable

  // Sync data only on reconnect or when local changes are waiting — not on idle health checks.
  if (!reconnected && pendingCount === 0) return

  await flushWorkOutbox()
  await pullWorkItemsDelta({ notifyUi: true })
}

function describeQueuedPatch(
  body: WorkItemPatchBody,
  businessKey: string,
  optimistic?: WorkItemApiModel,
): { title: string; description: string } {
  const syncHint = 'Will sync when the work service is back.'
  const itemLabel = optimistic?.title?.trim() || businessKey

  if (body.title !== undefined) {
    return {
      title: 'Title saved locally',
      description: `"${body.title}" on ${itemLabel} — ${syncHint}`,
    }
  }

  const patchKeys = Object.keys(body).filter(
    (key) => key !== 'expectedVersion' && key !== 'expected_version' && key !== 'syncOrigin' && key !== 'handoffFieldsToTectona',
  )
  if (patchKeys.length === 1) {
    const field = patchKeys[0]!
    const label = WORK_CONFLICT_FIELD_LABELS[field] ?? field
    const value = (body as Record<string, unknown>)[field]
    const valueText = value == null || value === '' ? 'cleared' : String(value)
    return {
      title: `${label} saved locally`,
      description: `${itemLabel}: ${label.toLowerCase()} set to ${valueText} — ${syncHint}`,
    }
  }

  return {
    title: 'Changes saved locally',
    description: `${itemLabel} — ${syncHint}`,
  }
}

function describeQueuedCreate(body: WorkItemCreateBody): { title: string; description: string } {
  return {
    title: 'Work item saved locally',
    description: `"${body.title}" will sync when the work service is back.`,
  }
}

function describeQueuedDelete(businessKey: string, cached?: WorkItemApiModel): { title: string; description: string } {
  const itemLabel = cached?.title?.trim() || businessKey
  return {
    title: 'Deletion saved locally',
    description: `"${itemLabel}" will be removed when the work service is back.`,
  }
}

async function queuePatchOutbox(params: {
  businessKey: string
  body: WorkItemPatchBody
  baseVersion: number
  optimistic: WorkItemApiModel
}): Promise<WorkItemApiModel> {
  let queued = false
  try {
    await enqueueOutboxEntry({
      opId: createOpId(),
      type: 'patch',
      businessKey: params.businessKey,
      body: params.body,
      baseVersion: params.baseVersion,
      createdAt: new Date().toISOString(),
      status: 'pending',
    })
    queued = true
  } catch {
    // Outbox is best-effort — UI should still keep the optimistic edit.
  }
  markWorkApiReachable(false)
  await emitStatus()
  if (queued) {
    const feedback = describeQueuedPatch(params.body, params.businessKey, params.optimistic)
    emitWorkSyncActivity({
      kind: 'local_queued',
      opType: 'patch',
      businessKey: params.businessKey,
      title: feedback.title,
      description: feedback.description,
    })
  }
  return params.optimistic
}

async function buildOfflineCreateItem(body: WorkItemCreateBody): Promise<WorkItemApiModel> {
  const tempId = `local-${createOpId()}`
  const optimistic: WorkItemApiModel = {
    id: tempId,
    title: body.title,
    type: body.type,
    project: body.project ?? '',
    workspace: body.workspace,
    assignee: body.assignee ?? 'Unassigned',
    owner: body.assignee ?? 'Unassigned',
    role: 'Contributor',
    team: body.team ?? 'Delivery Squad',
    reporter: body.reporter ?? 'Unassigned',
    labels: body.labels ?? [],
    priority: body.priority ?? 'Medium',
    status: body.status ?? 'To Do',
    startDate: body.startDate,
    dueDate: body.dueDate,
    dependencyStatus: 'Clear',
    progress: 0,
    estimatedHours: body.estimatedHours ?? 0,
    actualHours: 0,
    lastUpdated: new Date().toISOString().slice(0, 16).replace('T', ' '),
    version: 1,
    parentId: body.parentId ?? undefined,
    description: body.description ?? '',
    checklist: [],
    externalLinks: [],
    syncOrigin: 'tectona',
  }
  await upsertCachedWorkItem(optimistic)
  let queued = false
  try {
    await enqueueOutboxEntry({
      opId: createOpId(),
      type: 'create',
      businessKey: tempId,
      body,
      createdAt: new Date().toISOString(),
      status: 'pending',
    })
    queued = true
  } catch {
    // Outbox is best-effort.
  }
  markWorkApiReachable(false)
  await emitStatus()
  if (queued) {
    const feedback = describeQueuedCreate(body)
    emitWorkSyncActivity({
      kind: 'local_queued',
      opType: 'create',
      businessKey: tempId,
      title: feedback.title,
      description: feedback.description,
    })
  }
  return optimistic
}

function applyPatchToItem(item: WorkItemApiModel, patch: WorkItemPatchBody): WorkItemApiModel {
  return {
    ...item,
    ...patch,
    version: item.version,
    lastUpdated: new Date().toISOString().slice(0, 16).replace('T', ' '),
  }
}

async function buildStatus(): Promise<WorkSyncStatus> {
  return {
    isOnline: isWorkDataOnline(isBrowserOnline(), workApiReachable),
    pendingCount: await countPendingOutbox(),
    conflictCount: await countStoredConflicts(),
    lastSyncedAt: await getLastSyncedAt(),
  }
}

async function emitStatus(): Promise<void> {
  const status = await buildStatus()
  statusListeners.forEach((listener) => listener(status))
}

async function emitConflicts(): Promise<void> {
  const conflicts = await listStoredConflicts()
  conflictListeners.forEach((listener) => listener(conflicts))
}

function emitWorkSyncActivity(event: WorkSyncActivityEvent): void {
  activityListeners.forEach((listener) => listener(event))
}

export function subscribeWorkSyncActivity(listener: ActivityListener): () => void {
  activityListeners.add(listener)
  return () => activityListeners.delete(listener)
}

export function subscribeWorkOfflineStatus(listener: StatusListener): () => void {
  statusListeners.add(listener)
  void emitStatus()
  return () => statusListeners.delete(listener)
}

export async function getWorkOfflineStatusSnapshot(): Promise<WorkSyncStatus> {
  return buildStatus()
}

export function subscribeWorkSyncConflicts(listener: ConflictListener): () => void {
  conflictListeners.add(listener)
  void emitConflicts()
  return () => conflictListeners.delete(listener)
}

/** Reload conflicts from IndexedDB, refresh badge count, open resolve dialog when present. */
export async function requestOpenWorkSyncConflicts(): Promise<void> {
  const conflicts = await listStoredConflicts()
  await emitConflicts()
  if (conflicts.length === 0) {
    await emitStatus()
    return
  }
  emitWorkSyncOpenConflict()
}

export function initWorkOfflineSync(): () => void {
  if (typeof window === 'undefined') return () => undefined

  offlineSyncSubscriberCount += 1
  if (offlineSyncSubscriberCount > 1) {
    return () => {
      offlineSyncSubscriberCount = Math.max(0, offlineSyncSubscriberCount - 1)
      if (offlineSyncSubscriberCount > 0) return
      offlineSyncTeardown?.()
      offlineSyncTeardown = null
    }
  }

  const onOnline = () => {
    void emitStatus()
    void (async () => {
      await flushWorkOutbox()
      await pullWorkItemsDelta({ notifyUi: true })
    })()
  }
  const onOffline = () => {
    markWorkApiReachable(false)
    probeFailureStreak = PROBE_OFFLINE_STREAK_THRESHOLD
    probeSuccessStreak = 0
    void emitStatus()
  }

  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)

  void syncWorkApiReachabilityFromProbe()

  healthProbeIntervalId = window.setInterval(() => {
    void syncWorkApiReachabilityFromProbe()
  }, 15_000)

  if (isBrowserOnline()) {
    void (async () => {
      await flushWorkOutbox()
      const cached = await getCachedWorkItems()
      if (cached.length === 0) {
        await pullWorkItemsDelta()
      }
    })()
  }

  offlineSyncTeardown = () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    if (healthProbeIntervalId != null) {
      window.clearInterval(healthProbeIntervalId)
      healthProbeIntervalId = null
    }
    probeFailureStreak = 0
    probeSuccessStreak = 0
  }

  return () => {
    offlineSyncSubscriberCount = Math.max(0, offlineSyncSubscriberCount - 1)
    if (offlineSyncSubscriberCount > 0) return
    offlineSyncTeardown?.()
    offlineSyncTeardown = null
  }
}

export type PullWorkItemsDeltaOptions = {
  /** Emit a silent background UI merge when server data changes. Default false. */
  notifyUi?: boolean
  /** Limit delta pull to one workspace slug (lighter when WS is workspace-scoped). */
  workspace?: string
}

export async function readCachedWorkItems(): Promise<WorkItemApiModel[]> {
  return getCachedWorkItems()
}

export async function pullWorkItemsDelta(options?: PullWorkItemsDeltaOptions): Promise<WorkItemApiModel[]> {
  if (!isBrowserOnline()) {
    return getCachedWorkItems()
  }
  if (pullInFlight) return pullInFlight

  pullInFlight = (async () => {
    const cached = await getCachedWorkItems()
    const lastPulledAt = await getLastPulledAt()
    const useDelta = Boolean(lastPulledAt) && cached.length > 0

    try {
      if (!useDelta) {
        const response = await listWorkItemsRemote(
          options?.workspace ? { workspace: options.workspace } : undefined,
        )
        markWorkApiReachable(true)
        try {
          await replaceCachedWorkItems(response.items)
        } catch {
          // Cache is best-effort.
        }
        const syncedAt = response.syncedAt ?? new Date().toISOString()
        await touchLastPulledAt(syncedAt)
        await touchLastSyncedAt(syncedAt)
        await emitStatus()
        if (options?.notifyUi) {
          emitWorkSyncDataChanged({ silent: true, fullRefresh: true })
        }
        return response.items
      }

      const response = await listWorkItemsRemote({
        updatedSince: lastPulledAt!,
        ...(options?.workspace ? { workspace: options.workspace } : {}),
      })
      markWorkApiReachable(true)
      const deleted = response.deleted ?? []
      try {
        if (response.items.length > 0) {
          await mergeServerItemsPreservingLocalPending(response.items)
        }
        if (deleted.length > 0) {
          await removeCachedWorkItems(deleted)
        }
      } catch {
        // Cache is best-effort.
      }

      const syncedAt = response.syncedAt ?? new Date().toISOString()
      await touchLastPulledAt(syncedAt)
      if (response.items.length > 0 || deleted.length > 0) {
        await touchLastSyncedAt(syncedAt)
      }

      await emitStatus()
      if (options?.notifyUi && (response.items.length > 0 || deleted.length > 0)) {
        emitWorkSyncDataChanged({
          silent: true,
          items: response.items,
          deletedIds: deleted,
          fullRefresh: deleted.length > 0,
        })
      }

      return getCachedWorkItems()
    } catch (error) {
      if (isWorkApiUnavailableError(error)) {
        // Leave reachability to the periodic health probe — avoids offline/online toast flapping
        // when a background sync fails once while the service is still up.
      }
      await emitStatus()
      return cached
    }
  })().finally(() => {
    pullInFlight = null
  })

  return pullInFlight
}

export async function loadWorkItemsWithCache(): Promise<{
  items: WorkItemApiModel[]
  fromCache: boolean
}> {
  const cached = await getCachedWorkItems()

  if (!isBrowserOnline()) {
    return { items: cached, fromCache: true }
  }

  try {
    const items = await pullWorkItemsDelta()
    return { items, fromCache: false }
  } catch (error) {
    if (cached.length > 0) {
      await emitStatus()
      return { items: cached, fromCache: true }
    }
    if (isWorkApiUnavailableError(error)) {
      throw new Error('WORK_API_UNAVAILABLE')
    }
    throw error
  }
}

export async function refreshWorkItemsCache(): Promise<WorkItemApiModel[]> {
  const { items } = await loadWorkItemsWithCache()
  return items
}

function mergePatchBodies(...patches: WorkItemPatchBody[]): WorkItemPatchBody {
  const merged: WorkItemPatchBody = {}
  for (const patch of patches) {
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'expectedVersion' || key === 'expected_version') continue
      if (value !== undefined) {
        ;(merged as Record<string, unknown>)[key] = value
      }
    }
  }
  return merged
}

async function collectMergedPendingPatches(
  businessKey: string,
  extraPatch?: WorkItemPatchBody,
): Promise<WorkItemPatchBody> {
  const entries = await listOutboxEntries()
  const patches: WorkItemPatchBody[] = []
  if (extraPatch) patches.push(extraPatch)
  for (const entry of entries) {
    if (entry.businessKey !== businessKey) continue
    if (entry.status !== 'pending' && entry.status !== 'conflict') continue
    if (entry.type !== 'patch' || !entry.body) continue
    patches.push(entry.body as WorkItemPatchBody)
  }
  return mergePatchBodies(...patches)
}

function buildEffectiveLocalItem(
  serverItem: WorkItemApiModel,
  cached: WorkItemApiModel | undefined,
  mergedPending: WorkItemPatchBody,
  fallbackLocal?: WorkItemApiModel,
): WorkItemApiModel {
  const seed = cached ?? fallbackLocal ?? serverItem
  return applyPatchToItem(seed, mergedPending)
}

async function mergeServerItemsPreservingLocalPending(items: WorkItemApiModel[]): Promise<void> {
  if (items.length === 0) return

  const outbox = await listOutboxEntries()
  const pendingPatchesByKey = new Map<string, WorkItemPatchBody>()
  for (const entry of outbox) {
    if (entry.status !== 'pending' || entry.type !== 'patch' || !entry.body) continue
    const existing = pendingPatchesByKey.get(entry.businessKey) ?? {}
    pendingPatchesByKey.set(
      entry.businessKey,
      mergePatchBodies(existing, entry.body as WorkItemPatchBody),
    )
  }

  const merged: WorkItemApiModel[] = []
  for (const item of items) {
    const pendingPatch = pendingPatchesByKey.get(item.id)
    if (pendingPatch && Object.keys(pendingPatch).length > 0) {
      const cached = await getCachedWorkItem(item.id)
      merged.push(buildEffectiveLocalItem(item, cached, pendingPatch))
      continue
    }
    merged.push(item)
  }

  await mergeCachedWorkItems(merged)
}

async function recordConflict(params: {
  outboxId?: number
  businessKey: string
  localItem: WorkItemApiModel
  serverItem: WorkItemApiModel
  pendingPatch: WorkItemPatchBody
  baseVersion: number
}): Promise<WorkSyncConflict> {
  const cached = await getCachedWorkItem(params.businessKey)
  const mergedPending = await collectMergedPendingPatches(params.businessKey, params.pendingPatch)
  const localItem = buildEffectiveLocalItem(
    params.serverItem,
    cached,
    mergedPending,
    params.localItem,
  )

  const conflict: WorkSyncConflict = {
    id: createOpId(),
    outboxId: params.outboxId,
    businessKey: params.businessKey,
    localItem,
    serverItem: params.serverItem,
    pendingPatch: mergedPending,
    baseVersion: params.baseVersion,
    createdAt: new Date().toISOString(),
  }
  await saveConflict(conflict)
  const rows = await listOutboxEntries()
  for (const entry of rows) {
    if (entry.businessKey !== params.businessKey) continue
    if (entry.status !== 'pending') continue
    await updateOutboxEntry({ ...entry, status: 'conflict' })
  }
  await emitConflicts()
  await emitStatus()
  emitWorkSyncOpenConflict()
  return conflict
}

export async function patchWorkItemWithOffline(
  businessKey: string,
  body: WorkItemPatchBody,
): Promise<WorkItemApiModel> {
  const cached = (await getCachedWorkItem(businessKey)) ?? {
    id: businessKey,
    title: businessKey,
    type: 'Task',
    project: '',
    workspace: '',
    assignee: 'Unassigned',
    owner: 'Unassigned',
    role: 'Contributor',
    team: 'Delivery Squad',
    priority: 'Medium',
    status: 'To Do',
    dueDate: '',
    dependencyStatus: 'Clear',
    progress: 0,
    estimatedHours: 0,
    actualHours: 0,
    lastUpdated: '',
    version: 1,
    description: '',
  }

  const baseVersion = cached.version ?? 1
  const optimistic = applyPatchToItem(cached, body)
  try {
    await upsertCachedWorkItem(optimistic)
  } catch {
    // Cache is best-effort — never block offline edits when IndexedDB fails.
  }

  if (!isBrowserOnline()) {
    return queuePatchOutbox({ businessKey, body, baseVersion, optimistic })
  }

  try {
    const updated = await patchWorkItemRemote(businessKey, { ...body, expectedVersion: baseVersion })
    markWorkApiReachable(true)
    await upsertCachedWorkItem(updated)
    await emitStatus()
    return updated
  } catch (error) {
    if (error instanceof WorkItemVersionConflictError) {
      await recordConflict({
        businessKey,
        localItem: optimistic,
        serverItem: error.current,
        pendingPatch: body,
        baseVersion,
      })
      await upsertCachedWorkItem(error.current)
      throw error
    }

    if (isWorkApiUnavailableError(error)) {
      return queuePatchOutbox({ businessKey, body, baseVersion, optimistic })
    }

    await upsertCachedWorkItem(cached)
    throw error
  }
}

export async function createWorkItemWithOffline(body: WorkItemCreateBody): Promise<WorkItemApiModel> {
  if (!isBrowserOnline()) {
    return buildOfflineCreateItem(body)
  }

  try {
    const created = await createWorkItemRemote(body)
    markWorkApiReachable(true)
    await upsertCachedWorkItem(created)
    await emitStatus()
    return created
  } catch (error) {
    if (isWorkApiUnavailableError(error)) {
      return buildOfflineCreateItem(body)
    }
    throw error
  }
}

export async function deleteWorkItemWithOffline(businessKey: string): Promise<{ id: string; deleted: number }> {
  const cached = await getCachedWorkItem(businessKey)
  await removeCachedWorkItem(businessKey)

  const queueDelete = async (): Promise<{ id: string; deleted: number }> => {
    let queued = false
    try {
      await enqueueOutboxEntry({
        opId: createOpId(),
        type: 'delete',
        businessKey,
        createdAt: new Date().toISOString(),
        status: 'pending',
      })
      queued = true
    } catch {
      // Outbox is best-effort.
    }
    markWorkApiReachable(false)
    await emitStatus()
    if (queued) {
      const feedback = describeQueuedDelete(businessKey, cached)
      emitWorkSyncActivity({
        kind: 'local_queued',
        opType: 'delete',
        businessKey,
        title: feedback.title,
        description: feedback.description,
      })
    }
    return { id: businessKey, deleted: 1 }
  }

  if (!isBrowserOnline()) {
    return queueDelete()
  }

  try {
    const result = await deleteWorkItemRemote(businessKey)
    markWorkApiReachable(true)
    await emitStatus()
    return result
  } catch (error) {
    if (isWorkApiUnavailableError(error)) {
      return queueDelete()
    }
    if (cached) {
      await upsertCachedWorkItem(cached)
    }
    throw error
  }
}

function buildMergedPatch(
  conflict: WorkSyncConflict,
  resolution: WorkConflictResolution,
): WorkItemPatchBody | null {
  if (resolution.strategy === 'theirs') return null

  if (resolution.strategy === 'ours') {
    return buildOursPatch(conflict)
  }

  const merged: WorkItemPatchBody = {}
  for (const [field, choice] of Object.entries(resolution.fields)) {
    const localValue = (conflict.localItem as unknown as Record<string, unknown>)[field]
    const remoteValue = (conflict.serverItem as unknown as Record<string, unknown>)[field]
    const value = choice === 'local' ? localValue : remoteValue
    if (value !== undefined) {
      ;(merged as Record<string, unknown>)[field] = value
    }
  }
  return merged
}

function buildOursPatch(conflict: WorkSyncConflict): WorkItemPatchBody {
  const patch: WorkItemPatchBody = {}
  const pending = { ...(conflict.pendingPatch as Record<string, unknown>) }
  delete pending.expectedVersion
  delete pending.expected_version

  for (const field of getConflictFields(conflict)) {
    const pendingValue = pending[field]
    const localValue = (conflict.localItem as unknown as Record<string, unknown>)[field]
    ;(patch as Record<string, unknown>)[field] =
      pendingValue !== undefined ? pendingValue : localValue
  }

  for (const [key, value] of Object.entries(pending)) {
    if (key === 'expectedVersion' || key === 'expected_version') continue
    if ((patch as Record<string, unknown>)[key] === undefined && value !== undefined) {
      ;(patch as Record<string, unknown>)[key] = value
    }
  }

  return patch
}

function handoffFieldsForResolution(
  conflict: WorkSyncConflict,
  resolution: WorkConflictResolution,
): string[] {
  if (resolution.strategy === 'theirs') return []
  if (resolution.strategy === 'ours') {
    return getConflictFields(conflict)
  }
  return Object.entries(resolution.fields)
    .filter(([, choice]) => choice === 'local')
    .map(([field]) => field)
}

export async function resolveWorkSyncConflict(
  conflictId: string,
  resolution: WorkConflictResolution,
): Promise<WorkItemApiModel | null> {
  const conflicts = await listStoredConflicts()
  const conflict = conflicts.find((entry) => entry.id === conflictId)
  if (!conflict) return null

  if (resolution.strategy === 'theirs') {
    await upsertCachedWorkItem(conflict.serverItem)
    if (conflict.outboxId != null) await removeOutboxEntry(conflict.outboxId)
    await removeConflict(conflictId)
    await emitConflicts()
    await emitStatus()
    emitWorkSyncDataChanged({ silent: true, item: conflict.serverItem })
    return conflict.serverItem
  }

  const patchBody = buildMergedPatch(conflict, resolution)
  if (!patchBody || Object.keys(patchBody).length === 0) {
    throw new Error('Nothing to apply — choose Accept incoming or edit the item again.')
  }

  try {
    const serverCurrent = await getWorkItemRemote(conflict.businessKey)
    const handoffFields = handoffFieldsForResolution(conflict, resolution)
    const updated = await patchWorkItemRemote(conflict.businessKey, {
      ...patchBody,
      syncOrigin: 'tectona',
      handoffFieldsToTectona: handoffFields,
      expectedVersion: serverCurrent.version ?? conflict.serverItem.version ?? conflict.baseVersion,
    })
    await upsertCachedWorkItem(updated)
    if (conflict.outboxId != null) await removeOutboxEntry(conflict.outboxId)
    await removeConflict(conflictId)
    await emitConflicts()
    await emitStatus()
    emitWorkSyncDataChanged({ silent: true, item: updated })
    return updated
  } catch (error) {
    if (error instanceof WorkItemVersionConflictError) {
      const refreshed: WorkSyncConflict = {
        ...conflict,
        serverItem: error.current,
        baseVersion: error.current.version ?? conflict.baseVersion,
      }
      await saveConflict(refreshed)
      await emitConflicts()
      await emitStatus()
      throw new Error('Server changed again while resolving. Review the updated values and retry.')
    }
    throw error
  }
}

export async function flushWorkOutbox(): Promise<void> {
  if (!isBrowserOnline()) return
  if (flushInFlight) return flushInFlight

  flushInFlight = (async () => {
    const entries = await listOutboxEntries()
    let syncedCount = 0

    for (const entry of entries) {
      if (entry.status !== 'pending') continue

      try {
        if (entry.type === 'patch' && entry.body) {
          const patchBody = entry.body as WorkItemPatchBody
          const cached = await getCachedWorkItem(entry.businessKey)
          const serverCurrent = await getWorkItemRemote(entry.businessKey)
          const mergedPending = await collectMergedPendingPatches(entry.businessKey, patchBody)

          if (patchFieldsOverlapServerChanges(cached, serverCurrent, mergedPending)) {
            await recordConflict({
              outboxId: entry.id,
              businessKey: entry.businessKey,
              localItem: cached ?? applyPatchToItem(serverCurrent, mergedPending),
              serverItem: serverCurrent,
              pendingPatch: patchBody,
              baseVersion: entry.baseVersion ?? serverCurrent.version ?? 1,
            })
            continue
          }

          const baseVersion = serverCurrent.version ?? entry.baseVersion ?? cached?.version ?? 1
          const updated = await patchWorkItemRemote(entry.businessKey, {
            ...patchBody,
            expectedVersion: baseVersion,
          })
          markWorkApiReachable(true)
          await upsertCachedWorkItem(updated)
          if (entry.id != null) await removeOutboxEntry(entry.id)
          syncedCount += 1
        } else if (entry.type === 'create' && entry.body) {
          const created = await createWorkItemRemote(entry.body as WorkItemCreateBody)
          markWorkApiReachable(true)
          if (entry.businessKey.startsWith('local-')) {
            await removeCachedWorkItem(entry.businessKey)
          }
          await upsertCachedWorkItem(created)
          if (entry.id != null) await removeOutboxEntry(entry.id)
          syncedCount += 1
        } else if (entry.type === 'delete') {
          await deleteWorkItemRemote(entry.businessKey)
          markWorkApiReachable(true)
          if (entry.id != null) await removeOutboxEntry(entry.id)
          syncedCount += 1
        }
      } catch (error) {
        if (error instanceof WorkItemVersionConflictError) {
          const cached = await getCachedWorkItem(entry.businessKey)
          await recordConflict({
            outboxId: entry.id,
            businessKey: entry.businessKey,
            localItem: cached ?? error.current,
            serverItem: error.current,
            pendingPatch: (entry.body as WorkItemPatchBody) ?? {},
            baseVersion: entry.baseVersion ?? error.current.version ?? 1,
          })
          continue
        }
        if (isWorkApiUnavailableError(error)) {
          markWorkApiReachable(false)
        }
        break
      }
    }

    if (syncedCount > 0) {
      await touchLastSyncedAt()
    }

    await emitStatus()
  })().finally(() => {
    flushInFlight = null
  })

  return flushInFlight
}

export function getConflictFields(conflict: WorkSyncConflict): string[] {
  const fields = new Set<string>()

  for (const field of Object.keys(conflict.pendingPatch)) {
    if (field === 'expectedVersion' || field === 'expected_version') continue
    if (field === 'syncOrigin' || field === 'handoffFieldsToTectona') continue
    fields.add(field)
  }

  for (const field of Object.keys(WORK_CONFLICT_FIELD_LABELS)) {
    if (field === 'expectedVersion' || field === 'expected_version') continue
    const localValue = (conflict.localItem as unknown as Record<string, unknown>)[field]
    const remoteValue = (conflict.serverItem as unknown as Record<string, unknown>)[field]
    if (JSON.stringify(localValue) !== JSON.stringify(remoteValue)) {
      fields.add(field)
    }
  }

  for (const [field, pendingValue] of Object.entries(conflict.pendingPatch)) {
    if (field === 'expectedVersion' || field === 'expected_version') continue
    if (field === 'syncOrigin' || field === 'handoffFieldsToTectona') continue
    const remoteValue = (conflict.serverItem as unknown as Record<string, unknown>)[field]
    if (JSON.stringify(pendingValue) !== JSON.stringify(remoteValue)) {
      fields.add(field)
    }
  }

  return Array.from(fields)
}

export function formatConflictValue(value: unknown): string {
  if (value == null || value === '') return '—'
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

function patchFieldsOverlapServerChanges(
  cached: WorkItemApiModel | undefined,
  server: WorkItemApiModel,
  patch: WorkItemPatchBody,
): boolean {
  if (!cached) return false
  for (const field of Object.keys(patch)) {
    if (field === 'expectedVersion' || field === 'expected_version') continue
    if (field === 'syncOrigin' || field === 'handoffFieldsToTectona') continue
    const serverValue = (server as unknown as Record<string, unknown>)[field]
    const cachedValue = (cached as unknown as Record<string, unknown>)[field]
    if (JSON.stringify(serverValue) !== JSON.stringify(cachedValue)) {
      return true
    }
  }
  return false
}

export { listStoredConflicts } from './workOfflineStore'
