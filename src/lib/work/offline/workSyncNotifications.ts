import { pushGlobalToast } from '@/components/ui/toast'
import { getSession } from '@/auth/authService'
import { notifyEvent } from '@/lib/api/notificationApi'
import { subscribeWorkOfflineStatus, subscribeWorkSyncActivity } from './workOfflineClient'
import type { WorkSyncActivityEvent, WorkSyncStatus } from './types'

const WORK_SYNC_LINK = '/task-work-management'

/** Minimum gap between connectivity toasts — prevents offline/online spam on flaky probes. */
const CONNECTIVITY_TOAST_COOLDOWN_MS = 90_000

let subscriberCount = 0
let teardownNotifications: (() => void) | null = null
let lastOnline: boolean | null = null
let pendingNotified = false
let lastConnectivityToastAt = 0

function persistWorkSyncNotification(params: {
  title: string
  body?: string
  metadata?: Record<string, unknown>
}): void {
  if (!getSession()?.user?.id) return
  notifyEvent({
    type_code: 'project',
    title: params.title,
    body: params.body ?? null,
    link_url: WORK_SYNC_LINK,
    metadata: {
      module: 'task-work-management',
      source: 'work-offline-sync',
      ...params.metadata,
    },
  })
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

  const now = Date.now()
  const withinCooldown = now - lastConnectivityToastAt < CONNECTIVITY_TOAST_COOLDOWN_MS

  if (status.isOnline) {
    if (!withinCooldown) {
      publishWorkSyncFeedback({
        variant: 'success',
        title: 'Back online',
        description: 'Work service is reachable. Sync will resume automatically.',
        metadata: { action: 'work_connectivity_online' },
      })
      lastConnectivityToastAt = now
    }
  } else if (!withinCooldown) {
    publishWorkSyncFeedback({
      variant: 'warning',
      title: 'You are offline',
      description: 'Edits are saved locally until the work service is back.',
      metadata: { action: 'work_connectivity_offline' },
    })
    lastConnectivityToastAt = now
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

  subscriberCount += 1
  if (subscriberCount === 1) {
    const unsubscribeStatus = subscribeWorkOfflineStatus((status) => {
      handleConnectivityChange(status)
      handlePendingChange(status)
    })
    const unsubscribeActivity = subscribeWorkSyncActivity(handleLocalQueued)
    teardownNotifications = () => {
      unsubscribeStatus()
      unsubscribeActivity()
    }
  }

  return () => {
    subscriberCount = Math.max(0, subscriberCount - 1)
    if (subscriberCount > 0) return
    teardownNotifications?.()
    teardownNotifications = null
    lastOnline = null
    pendingNotified = false
    lastConnectivityToastAt = 0
  }
}
