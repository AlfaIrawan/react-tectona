export {
  batchPatchWorkItems,
  createWorkItem,
  deleteWorkItem,
  getIntegrationProfile,
  getWorkItem,
  listWorkItems,
  mapApiWorkItemToPage,
  moveWorkItemWorkspace,
  patchWorkItem,
  WorkItemVersionConflictError,
  WORK_API_BASE,
} from '@/lib/api/workApi'

export type {
  ExternalProvider,
  IntegrationProfileResponse,
  Priority,
  WorkItemApiModel,
  WorkItemCreateBody,
  WorkItemExternalLink,
  WorkItemListResponse,
  WorkItemPatchBody,
  WorkItemType,
  WorkStatus,
} from '@/lib/api/workApi'

export {
  createWorkItemWithOffline as createWorkItemOffline,
  deleteWorkItemWithOffline as deleteWorkItemOffline,
  flushWorkOutbox,
  getWorkOfflineStatusSnapshot,
  initWorkOfflineSync,
  loadWorkItemsWithCache,
  patchWorkItemWithOffline as patchWorkItemOffline,
  pullWorkItemsDelta,
  readCachedWorkItems,
  refreshWorkItemsCache,
  requestOpenWorkSyncConflicts,
  subscribeWorkOfflineStatus,
  subscribeWorkSyncActivity,
  subscribeWorkSyncConflicts,
} from '@/lib/work/offline/workOfflineClient'

export { initWorkItemsRealtime, setWorkItemsRealtimeWorkspace, subscribeWorkItemsRealtimeConnected } from '@/lib/work/offline/workItemsRealtime'
export { useWorkItemsRealtimeScope } from '@/lib/work/offline/useWorkItemsRealtimeScope'

export type { WorkOfflineStatus, WorkSyncActivityEvent, WorkSyncConflict, WorkSyncStatus } from '@/lib/work/offline/types'
