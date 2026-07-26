import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  listStoredConflicts,
  subscribeWorkSyncConflicts,
} from '@/lib/work/offline/workOfflineClient'
import { WORK_SYNC_OPEN_CONFLICT_EVENT, emitWorkSyncDataChanged } from '@/lib/work/offline/workSyncEvents'
import type { WorkSyncConflict } from '@/lib/work/offline/types'
import { WorkItemConflictDialog } from '@/modules/task-work-management/components/WorkItemConflictDialog'

/** Global host for work sync conflicts — banner + merge dialog on any route. */
export function WorkSyncConflictHost() {
  const [conflicts, setConflicts] = useState<WorkSyncConflict[]>([])
  const [activeConflict, setActiveConflict] = useState<WorkSyncConflict | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeWorkSyncConflicts((next) => {
      setConflicts(next)
      setActiveConflict((current) => {
        if (!current) return current
        return next.find((entry) => entry.id === current.id) ?? null
      })
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const openNext = () => {
      void (async () => {
        const next = await listStoredConflicts()
        setConflicts(next)
        setActiveConflict(next[0] ?? null)
      })()
    }
    window.addEventListener(WORK_SYNC_OPEN_CONFLICT_EVENT, openNext)
    return () => window.removeEventListener(WORK_SYNC_OPEN_CONFLICT_EVENT, openNext)
  }, [])

  return (
    <>
      {conflicts.length > 0 ? (
        <div className="fixed bottom-4 left-1/2 z-[120] w-[min(92vw,520px)] -translate-x-1/2">
          <div className="flex items-start gap-3 rounded-xl border border-rose-200/90 bg-rose-50/95 px-4 py-3 text-rose-950 shadow-lg backdrop-blur-sm dark:border-rose-900/50 dark:bg-rose-950/90 dark:text-rose-50">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">
                {conflicts.length} sync conflict{conflicts.length === 1 ? '' : 's'} need your decision
              </p>
              <p className="mt-0.5 text-[11px] text-rose-800/90 dark:text-rose-100/80">
                Local edits clash with server changes. Resolve to continue syncing.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 shrink-0 border-rose-300 bg-white/80 text-[11px] text-rose-900 hover:bg-white dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100"
              onClick={() => setActiveConflict(conflicts[0] ?? null)}
            >
              Resolve
            </Button>
          </div>
        </div>
      ) : null}

      <WorkItemConflictDialog
        conflict={activeConflict}
        onResolved={(updated) => {
          if (updated) {
            emitWorkSyncDataChanged({ silent: true, item: updated })
          }
          setActiveConflict(null)
        }}
      />
    </>
  )
}
