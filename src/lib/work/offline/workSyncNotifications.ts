import { pushGlobalToast } from '@/components/ui/toast'
import { getSession } from '@/auth/authService'
import { createNotification, TECTONA_APP_ID } from '@/lib/api/notificationApi'
import { emitNotificationsUpdated } from '@/lib/chat/chatRealtimeEvents'
import { subscribeWorkOfflineStatus, subscribeWorkSyncActivity } from './workOfflineClient'
import type { WorkSyncActivityEvent, WorkSyncStatus } from './types'

const WORK_SYNC_LINK = '/task-work-management'

let initialized = false
let lastOnline: boolean | null = null
let pendingNotified = false

function persistWorkSyncNotification(params: {
  title: string
  body?: string
  metadata?: Record<string, unknown>
}): void {
  const session = getSession()
  if (!session?.user?.id) return
  void createNotification({
    app_id: TECTONA_APP_ID,
    user_id: session.user.id,
    type_code: 'project',
    title: params.title,
    body: params.body ?? null,
    link_url: WORK_SYNC_LINK,
    metadata: {
      module: 'task-work-management',
      source: 'work-offline-sync',
      ...params.metadata,
    },
    created_from: 'tectona-frontend',
  })
    .then(() => emitNotificationsUpdated())
    .catch(() => {})
}

function publishWorkSyncFeedback(params: {
  variant: 'default' | 'success' | 'error' | 'info' | 'warning'
  title: string
  description?: string
  notify?: boolean
  metadata?: Record<string, unknown>
}): void {
  pushGlobalToast({
    variant: params.variant,
    title: params.title,
    description: params.description,
  })
  if (params.notify === false) return
  persistWorkSyncNotification({
    title: params.title,
    body: params.description,
    metadata: params.metadata,
  })
}

function handleConnectivityChange(status: WorkSyncStatus): void {
  if (lastOnline === null) {
    lastOnline = status.isOnline
    return
  }
  if (lastOnline === status.isOnline) return

  if (status.isOnline) {
    publishWorkSyncFeedback({
      variant: 'success',
      title: 'Back online',
      description: 'Work service is reachable. Sync will resume automatically.',
      metadata: { action: 'work_connectivity_online' },
    })
  } else {
    publishWorkSyncFeedback({
      variant: 'warning',
      title: 'You are offline',
      description: 'Edits are saved locally until the work service is back.',
      metadata: { action: 'work_connectivity_offline' },
    })
  }

  lastOnline = status.isOnline
}

function handlePendingChange(status: WorkSyncStatus): void {
  if (status.pendingCount === 0) {
    pendingNotified = false
    return
  }
  // Per-edit toast + notification panel entries come from local_queued activity events.
  pendingNotified = true
}

function handleLocalQueued(event: WorkSyncActivityEvent): void {
  if (event.kind !== 'local_queued') return
  publishWorkSyncFeedback({
    variant: 'info',
    title: event.title,
    description: event.description,
    metadata: {
      action: 'work_local_queued',
      op_type: event.opType,
      business_key: event.businessKey,
    },
  })
}

/** Toast + notification panel hooks for connectivity and queued local edits. */
export function initWorkSyncNotifications(): () => void {
  if (typeof window === 'undefined') return () => undefined
  if (initialized) return () => undefined
  initialized = true

  const unsubscribeStatus = subscribeWorkOfflineStatus((status) => {
    handleConnectivityChange(status)
    handlePendingChange(status)
  })
  const unsubscribeActivity = subscribeWorkSyncActivity(handleLocalQueued)

  return () => {
    unsubscribeStatus()
    unsubscribeActivity()
    initialized = false
    lastOnline = null
    pendingNotified = false
  }
}
