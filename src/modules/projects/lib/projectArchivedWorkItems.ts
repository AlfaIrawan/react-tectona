import type { WorkItemApiModel } from '@/lib/api/workApi'
import type { ProjectArchivedWorkItemApiModel } from '@/lib/api/workApi'
import {
  archiveWorkItemRecord,
  isWorkItemArchived,
  listArchivedWorkItemIds,
  listArchivedWorkItemRecords,
  restoreWorkItemRecord,
  type ArchivedWorkItemRecord,
} from './projectArchivedStore'

/** Keep in sync with projectWorkItemUtils.projectWorkItemBusinessKeyPrefix */
function projectWorkItemBusinessKeyPrefix(projectId: string): string {
  return `PT-${projectId.replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

/** Done template tasks seeded as sample archive for Kanban demo projects. */
export const SAMPLE_ARCHIVED_WORK_ITEM_SUFFIXES = [
  'task-charter',
  'task-business-case',
  'task-rfp-published',
] as const

function itemMatchesSampleSuffix(item: WorkItemApiModel, projectId: string): boolean {
  const prefix = projectWorkItemBusinessKeyPrefix(projectId)
  return SAMPLE_ARCHIVED_WORK_ITEM_SUFFIXES.some((suffix) => item.id === `${prefix}-${suffix}`)
}

function defaultSampleArchivedAt(projectCreatedAt: string | undefined, index: number): string {
  const base = projectCreatedAt ? new Date(projectCreatedAt) : new Date()
  base.setDate(base.getDate() - (18 - index * 4))
  return base.toISOString()
}

export function seedSampleArchivedWorkItems(input: {
  projectId: string
  workItems: WorkItemApiModel[]
  archivedBy: string
  projectCreatedAt?: string
}): boolean {
  const existing = listArchivedWorkItemIds(input.projectId)
  if (existing.length > 0) return false

  const candidates = input.workItems.filter(
    (item) => item.status === 'Done' || itemMatchesSampleSuffix(item, input.projectId),
  )
  const sampleItems = candidates.filter((item) => itemMatchesSampleSuffix(item, input.projectId))
  const toArchive = sampleItems.length > 0 ? sampleItems : candidates.filter((item) => item.status === 'Done').slice(0, 3)

  if (toArchive.length === 0) return false

  toArchive.forEach((item, index) => {
    archiveWorkItemRecord(input.projectId, item.id, {
      archivedAt: defaultSampleArchivedAt(input.projectCreatedAt, index),
      archivedBy: input.archivedBy,
      reason: 'sample',
    })
  })

  return true
}

export function filterActiveWorkItems(workItems: WorkItemApiModel[], projectId: string): WorkItemApiModel[] {
  return workItems.filter((item) => !isWorkItemArchived(projectId, item.id))
}

export function filterActiveWorkItemsWithOverlays(
  workItems: WorkItemApiModel[],
  pendingInboxKeys: Set<string>,
  archivedKeys: Set<string>,
): WorkItemApiModel[] {
  return workItems.filter((item) => !pendingInboxKeys.has(item.id) && !archivedKeys.has(item.id))
}

export function filterArchivedWorkItems(workItems: WorkItemApiModel[], projectId: string): WorkItemApiModel[] {
  const archivedIds = new Set(listArchivedWorkItemIds(projectId))
  return workItems.filter((item) => archivedIds.has(item.id))
}

export function filterArchivedWorkItemsByKeys(
  workItems: WorkItemApiModel[],
  archivedKeys: Set<string>,
): WorkItemApiModel[] {
  return workItems.filter((item) => archivedKeys.has(item.id))
}

export function getArchivedWorkItemRecord(
  projectId: string,
  workItemId: string,
): ArchivedWorkItemRecord | undefined {
  return listArchivedWorkItemRecords(projectId)[workItemId]
}

export function getArchivedWorkItemRecordFromApi(
  records: ProjectArchivedWorkItemApiModel[],
  workItemId: string,
): ArchivedWorkItemRecord | undefined {
  const match = records.find((record) => record.businessKey === workItemId)
  if (!match) return undefined
  return {
    archivedAt: match.archivedAt,
    archivedBy: match.archivedBy,
    reason: match.reason,
  }
}

export function restoreArchivedWorkItem(projectId: string, workItemId: string): void {
  restoreWorkItemRecord(projectId, workItemId)
}

export function isWorkItemArchivable(item: WorkItemApiModel): boolean {
  const status = item.status === 'Blocked' ? 'Backlog' : item.status
  return status === 'Done'
}

export function archiveWorkItemManual(input: {
  projectId: string
  workItemId: string
  archivedBy: string
}): void {
  archiveWorkItemRecord(input.projectId, input.workItemId, {
    archivedAt: new Date().toISOString(),
    archivedBy: input.archivedBy,
    reason: 'manual',
  })
}

export function archiveWorkItemsManual(input: {
  projectId: string
  workItemIds: string[]
  workItems: WorkItemApiModel[]
  archivedBy: string
}): { archivedIds: string[]; skippedIds: string[] } {
  const itemById = new Map(input.workItems.map((item) => [item.id, item]))
  const archivedIds: string[] = []
  const skippedIds: string[] = []

  for (const workItemId of input.workItemIds) {
    const item = itemById.get(workItemId)
    if (!item || !isWorkItemArchivable(item) || isWorkItemArchived(input.projectId, workItemId)) {
      skippedIds.push(workItemId)
      continue
    }
    archiveWorkItemManual({
      projectId: input.projectId,
      workItemId,
      archivedBy: input.archivedBy,
    })
    archivedIds.push(workItemId)
  }

  return { archivedIds, skippedIds }
}

export function formatArchivedDate(iso: string | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}
