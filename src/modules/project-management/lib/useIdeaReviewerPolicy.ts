import { useEffect, useState } from 'react'
import { loadIdeaReviewerPolicy } from './ideaWorkspaceSelection'

export function useIdeaReviewerPolicy(open: boolean, workspaceId: string, sourceWorkspaceId?: string | null) {
  const key = JSON.stringify([workspaceId, sourceWorkspaceId])
  const [result, setResult] = useState<{ key: string; managed: boolean; error: string } | null>(null)
  useEffect(() => {
    setResult(null)
    if (!open || !workspaceId) return
    let cancelled = false
    loadIdeaReviewerPolicy(workspaceId, sourceWorkspaceId).then(
      (managed) => { if (!cancelled) setResult({ key, managed, error: '' }) },
      (error) => { if (!cancelled) setResult({ key, managed: false, error: error instanceof Error ? error.message : 'Could not verify reviewer assignment.' }) },
    )
    return () => { cancelled = true }
  }, [open, workspaceId, sourceWorkspaceId, key])
  const current = open && result?.key === key ? result : null
  return { managed: current?.managed ?? false, loading: open && !!workspaceId && !current, error: current?.error ?? '' }
}
