import { useEffect } from 'react'
import { setWorkItemsRealtimeWorkspace } from './workItemsRealtime'

/** Subscribe to workspace-scoped work events while mounted; resets to global on unmount. */
export function useWorkItemsRealtimeScope(workspace: string | null): void {
  useEffect(() => {
    setWorkItemsRealtimeWorkspace(workspace)
    return () => setWorkItemsRealtimeWorkspace(null)
  }, [workspace])
}
