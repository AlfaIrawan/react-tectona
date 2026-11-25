import { useEffect, useMemo, useState } from 'react'
import { getWorkflowOverview, type WorkflowOverviewDto } from '@/lib/api/workflowAutomationApi'

export function useWorkflowOverview(workspaceId: string | undefined, enabled: boolean) {
  const request = useMemo(() => ({ workspaceId, enabled }), [workspaceId, enabled])
  const [snapshot, setSnapshot] = useState<{
    request: typeof request
    overview: WorkflowOverviewDto | null
    overviewState: 'ready' | 'error'
  } | null>(null)

  useEffect(() => {
    if (!request.enabled) return
    let current = true
    void getWorkflowOverview({ workspaceId: request.workspaceId, days: 7 }).then(
      (overview) => {
        if (current) setSnapshot({ request, overview, overviewState: 'ready' })
      },
      () => {
        if (current) setSnapshot({ request, overview: null, overviewState: 'error' })
      },
    )
    return () => { current = false }
  }, [request])

  return snapshot?.request === request
    ? { overview: snapshot.overview, overviewState: snapshot.overviewState }
    : { overview: null, overviewState: 'loading' as const }
}
