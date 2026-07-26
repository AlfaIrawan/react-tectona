import type { WorkItemApiModel } from '@/lib/api/workApi'

export const WORK_SYNC_DATA_CHANGED_EVENT = 'tectona:work-sync-data-changed'
export const WORK_SYNC_OPEN_CONFLICT_EVENT = 'tectona:work-sync-open-conflict'

export type WorkSyncDataChangedDetail = {
  item?: WorkItemApiModel | null
  items?: WorkItemApiModel[]
  deletedIds?: string[]
  fullRefresh?: boolean
  /** Background merge — UI should update state without a loading spinner. */
  silent?: boolean
}

export function emitWorkSyncDataChanged(detail: WorkSyncDataChangedDetail = {}): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(WORK_SYNC_DATA_CHANGED_EVENT, { detail }))
}

export function emitWorkSyncOpenConflict(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(WORK_SYNC_OPEN_CONFLICT_EVENT))
}
