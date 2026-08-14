import type { ProjectInboxRouteApiModel, WorkItemApiModel } from '@/lib/api/workApi'
import { archiveWorkItemManual } from './projectArchivedWorkItems'
import {
  isWorkItemInPendingInbox,
  listInboxWorkItemRecords,
  listPendingInboxWorkItemIds,
  removeInboxWorkItemRecord,
  upsertInboxWorkItemRecord,
  type InboxSourceChannel,
  type InboxWorkItemRecord,
} from './projectInboxStore'

/** Keep in sync with projectWorkItemUtils.projectWorkItemBusinessKeyPrefix */
function projectWorkItemBusinessKeyPrefix(projectId: string): string {
  return `PT-${projectId.replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

export const SAMPLE_INBOX_WORK_ITEM_SUFFIXES = [
  'bug-vendor-api-gap',
  'task-integration-blueprint',
  'task-sla-draft',
] as const

const SAMPLE_INBOX_META: Record<
  (typeof SAMPLE_INBOX_WORK_ITEM_SUFFIXES)[number],
  Pick<InboxWorkItemRecord, 'sourceTeam' | 'sourceChannel' | 'requestNote' | 'routedBy'>
> = {
  'bug-vendor-api-gap': {
    sourceTeam: 'Platform Engineering',
    sourceChannel: 'system',
    routedBy: 'ci-monitor',
    requestNote: 'Vendor API gap flagged during integration smoke test.',
  },
  'task-integration-blueprint': {
    sourceTeam: 'Enterprise Architecture',
    sourceChannel: 'team',
    routedBy: 'siti.rahayu',
    requestNote: 'Please review core banking API integration blueprint before sprint zero.',
  },
  'task-sla-draft': {
    sourceTeam: 'Legal & Procurement',
    sourceChannel: 'form',
    routedBy: 'budi.santoso',
    requestNote: 'SLA draft needs delivery squad input on penalty clauses.',
  },
}

function itemMatchesSampleSuffix(item: WorkItemApiModel, projectId: string, suffix: string): boolean {
  const prefix = projectWorkItemBusinessKeyPrefix(projectId)
  return item.id === `${prefix}-${suffix}`
}

function defaultSampleRoutedAt(projectCreatedAt: string | undefined, index: number): string {
  const base = projectCreatedAt ? new Date(projectCreatedAt) : new Date()
  base.setDate(base.getDate() - (5 - index))
  return base.toISOString()
}

export function seedSampleInboxWorkItems(input: {
  projectId: string
  workItems: WorkItemApiModel[]
  projectCreatedAt?: string
}): boolean {
  const existing = listPendingInboxWorkItemIds(input.projectId)
  if (existing.length > 0) return false

  let seeded = 0
  SAMPLE_INBOX_WORK_ITEM_SUFFIXES.forEach((suffix, index) => {
    const item = input.workItems.find((row) => itemMatchesSampleSuffix(row, input.projectId, suffix))
    if (!item) return

    const meta = SAMPLE_INBOX_META[suffix]
    upsertInboxWorkItemRecord(input.projectId, item.id, {
      routedAt: defaultSampleRoutedAt(input.projectCreatedAt, index),
      routedBy: meta.routedBy,
      sourceTeam: meta.sourceTeam,
      sourceChannel: meta.sourceChannel,
      requestNote: meta.requestNote,
      status: 'pending',
    })
    seeded += 1
  })

  return seeded > 0
}

export function filterNonInboxWorkItems(workItems: WorkItemApiModel[], projectId: string): WorkItemApiModel[] {
  return workItems.filter((item) => !isWorkItemInPendingInbox(projectId, item.id))
}

export function filterNonInboxWorkItemsByKeys(
  workItems: WorkItemApiModel[],
  pendingInboxKeys: Set<string>,
): WorkItemApiModel[] {
  return workItems.filter((item) => !pendingInboxKeys.has(item.id))
}

export function filterPendingInboxWorkItems(workItems: WorkItemApiModel[], projectId: string): WorkItemApiModel[] {
  const pendingIds = new Set(listPendingInboxWorkItemIds(projectId))
  return workItems.filter((item) => pendingIds.has(item.id))
}

export function filterPendingInboxWorkItemsByKeys(
  workItems: WorkItemApiModel[],
  pendingInboxKeys: Set<string>,
): WorkItemApiModel[] {
  return workItems.filter((item) => pendingInboxKeys.has(item.id))
}

export function countPendingInboxWorkItemsByKeys(pendingInboxKeys: Set<string>): number {
  return pendingInboxKeys.size
}

export function getInboxWorkItemRecord(
  projectId: string,
  workItemId: string,
): InboxWorkItemRecord | undefined {
  return listInboxWorkItemRecords(projectId)[workItemId]
}

export function getInboxRouteForItem(
  routes: ProjectInboxRouteApiModel[],
  workItemId: string,
): ProjectInboxRouteApiModel | undefined {
  return routes.find((route) => route.businessKey === workItemId)
}

export function acceptInboxWorkItem(projectId: string, workItemId: string): void {
  removeInboxWorkItemRecord(projectId, workItemId)
}

export function declineInboxWorkItem(input: {
  projectId: string
  workItemId: string
  declinedBy: string
}): void {
  removeInboxWorkItemRecord(input.projectId, input.workItemId)
  archiveWorkItemManual({
    projectId: input.projectId,
    workItemId: input.workItemId,
    archivedBy: input.declinedBy,
  })
}

export function routeWorkItemToInbox(input: {
  projectId: string
  workItemId: string
  routedBy: string
  sourceTeam: string
  sourceChannel?: InboxSourceChannel
  requestNote?: string
}): void {
  upsertInboxWorkItemRecord(input.projectId, input.workItemId, {
    routedAt: new Date().toISOString(),
    routedBy: input.routedBy,
    sourceTeam: input.sourceTeam,
    sourceChannel: input.sourceChannel ?? 'team',
    requestNote: input.requestNote,
    status: 'pending',
  })
}

export function formatInboxDate(iso: string | undefined): string {
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

export function inboxAgeDays(iso: string | undefined): number {
  if (!iso) return 0
  const routed = new Date(iso)
  if (Number.isNaN(routed.getTime())) return 0
  return Math.max(0, Math.floor((Date.now() - routed.getTime()) / 86400000))
}

export const INBOX_CHANNEL_LABELS: Record<InboxSourceChannel, string> = {
  team: 'Team',
  idea: 'Idea',
  form: 'Form',
  system: 'System',
}
