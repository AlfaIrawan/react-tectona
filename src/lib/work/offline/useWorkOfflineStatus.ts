import { useEffect, useState } from 'react'
import { initWorkItemsRealtime, subscribeWorkItemsRealtimeConnected } from './workItemsRealtime'
import { initWorkOfflineSync, subscribeWorkOfflineStatus } from './workOfflineClient'
import { initWorkSyncNotifications } from './workSyncNotifications'
import type { WorkOfflineStatus } from './types'

const DEFAULT_STATUS: WorkOfflineStatus = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingCount: 0,
  conflictCount: 0,
  lastSyncedAt: null,
  realtimeConnected: false,
}

export function useWorkOfflineStatus(): WorkOfflineStatus {
  const [status, setStatus] = useState<WorkOfflineStatus>(DEFAULT_STATUS)

  useEffect(() => {
    const stopSync = initWorkOfflineSync()
    const stopRealtime = initWorkItemsRealtime()
    const stopNotifications = initWorkSyncNotifications()
    const unsubscribe = subscribeWorkOfflineStatus((next) => {
      setStatus((current) => {
        if (
          current.isOnline === next.isOnline
          && current.pendingCount === next.pendingCount
          && current.conflictCount === next.conflictCount
          && current.lastSyncedAt === next.lastSyncedAt
        ) {
          return current
        }
        return {
          ...current,
          isOnline: next.isOnline,
          pendingCount: next.pendingCount,
          conflictCount: next.conflictCount,
          lastSyncedAt: next.lastSyncedAt,
        }
      })
    })
    const unsubscribeRealtime = subscribeWorkItemsRealtimeConnected((realtimeConnected) => {
      setStatus((current) => (current.realtimeConnected === realtimeConnected ? current : { ...current, realtimeConnected }))
    })
    return () => {
      unsubscribe()
      unsubscribeRealtime()
      stopNotifications()
      stopRealtime()
      stopSync()
    }
  }, [])

  return status
}