import type { WorkItemApiModel, WorkItemCreateBody, WorkItemPatchBody } from '@/lib/api/workApi'

export type WorkOutboxOpType = 'patch' | 'create' | 'delete'

export type WorkOutboxEntry = {
  id?: number
  opId: string
  type: WorkOutboxOpType
  businessKey: string
  body?: WorkItemPatchBody | WorkItemCreateBody
  baseVersion?: number
  createdAt: string
  status: 'pending' | 'conflict'
}

export type WorkSyncStatus = {
  isOnline: boolean
  pendingCount: number
  conflictCount: number
  lastSyncedAt: string | null
}

export type WorkOfflineStatus = WorkSyncStatus & {
  /** WebSocket to work-management realtime is open. */
  realtimeConnected: boolean
}

export type WorkSyncActivityEvent =
  | { kind: 'push_success'; count: number }
  | { kind: 'push_failed'; pendingCount: number; message?: string }
  | { kind: 'pull_success'; updatedCount: number; deletedCount: number }
  | { kind: 'pull_failed' }
  | {
      kind: 'local_queued'
      opType: WorkOutboxOpType
      businessKey: string
      title: string
      description: string
    }

export type WorkSyncConflict = {
  id: string
  outboxId?: number
  businessKey: string
  localItem: WorkItemApiModel
  serverItem: WorkItemApiModel
  pendingPatch: WorkItemPatchBody
  baseVersion: number
  createdAt: string
}

export type WorkConflictFieldChoice = 'local' | 'remote'

export type WorkConflictResolution =
  | { strategy: 'theirs' }
  | { strategy: 'ours' }
  | { strategy: 'merge'; fields: Record<string, WorkConflictFieldChoice> }

export const WORK_CONFLICT_FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  type: 'Type',
  project: 'Project',
  workspace: 'Workspace',
  label: 'Label',
  assignee: 'Assignee',
  team: 'Team',
  reporter: 'Reporter',
  priority: 'Priority',
  status: 'Status',
  startDate: 'Start date',
  dueDate: 'Due date',
  estimatedHours: 'Estimated hours',
  description: 'Description',
  parentId: 'Parent',
  progress: 'Progress',
  labels: 'Labels',
}
