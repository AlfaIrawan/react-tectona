import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  listWorkflowApprovals,
  type WorkflowApprovalDto,
} from '@/lib/api/workflowAutomationApi'

/** What the Docs panel may offer for one document, given its status and the approvals on it. */
export type DocApprovalState = {
  /** The caller's own pending request — the one they may decide. */
  mine: WorkflowApprovalDto | null
  /** Everyone still being waited on, including the caller. */
  pending: WorkflowApprovalDto[]
  /** The last settled decision, newest first. */
  decided: WorkflowApprovalDto[]
  canSubmit: boolean
  canDecide: boolean
}

const SUBMITTABLE = new Set(['draft', 'rejected', ''])

export function docApprovalState(
  document: { status_code?: string | null } | null | undefined,
  approvals: WorkflowApprovalDto[],
  userId: string,
): DocApprovalState {
  const pending = approvals.filter((item) => item.status === 'pending')
  const decided = approvals.filter((item) => item.status === 'approved' || item.status === 'rejected')
  const mine = pending.find((item) => item.subject_id === userId) ?? null
  const status = (document?.status_code ?? '').toLowerCase()
  return {
    mine,
    pending,
    decided,
    // Already in review: asking again would start a second workflow for the same document.
    canSubmit: pending.length === 0 && SUBMITTABLE.has(status),
    canDecide: Boolean(mine),
  }
}

/**
 * Approvals of every document of one idea, keyed by document id.
 *
 * The approval lives in Workflow Automation (the drawn flow owns who approves), so the Docs
 * panel reads it from there rather than from the document itself.
 */
export function useIdeaDocApprovals(ideaId: string, enabled: boolean) {
  const [byDocument, setByDocument] = useState<Record<string, WorkflowApprovalDto[]>>({})
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!enabled || !ideaId) return
    setLoading(true)
    try {
      const items = await listWorkflowApprovals({
        subjectContextKey: 'idea_id',
        subjectContextValue: ideaId,
        limit: 200,
      })
      const grouped: Record<string, WorkflowApprovalDto[]> = {}
      for (const item of items) {
        const documentId = String(item.subject_context?.document_id ?? '')
        if (!documentId) continue
        ;(grouped[documentId] ??= []).push(item)
      }
      setByDocument(grouped)
    } catch {
      // Workflow Automation unreachable: the panel still works, just without approvals.
      setByDocument({})
    } finally {
      setLoading(false)
    }
  }, [enabled, ideaId])

  useEffect(() => {
    void reload()
  }, [reload])

  return useMemo(() => ({ byDocument, loading, reload }), [byDocument, loading, reload])
}
