import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  approveWorkflowRun,
  listIdeaWorkflowRuns,
  listWorkflowApprovals,
  rejectWorkflowRun,
  requestIdeaApproval,
  type IdeaWorkflowRunDto,
  type WorkflowApprovalDto,
} from '@/lib/api/workflowAutomationApi'

type Status = {
  awaitingRequest: boolean
  approverText: string
  pending: WorkflowApprovalDto[]
  outcome: string | null
  comment: string
  busy: boolean
  error: string
  request: () => Promise<void>
  decide: (approval: WorkflowApprovalDto, mode: 'approve' | 'reject' | 'revision', note: string) => Promise<void>
}

export function useIdeaApprovalStatus(ideaId: string, workspaceId: string | undefined, reloadKey: number, onChanged: () => void): Status {
  const [runs, setRuns] = useState<IdeaWorkflowRunDto[]>([])
  const [approvals, setApprovals] = useState<WorkflowApprovalDto[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    const [runRows, approvalRows] = await Promise.all([
      listIdeaWorkflowRuns(ideaId).catch(() => [] as IdeaWorkflowRunDto[]),
      listWorkflowApprovals({ mine: false, subjectContextKey: 'idea_id', subjectContextValue: ideaId, limit: 50 }).catch(() => [] as WorkflowApprovalDto[]),
    ])
    setRuns(runRows)
    setApprovals(approvalRows)
  }, [ideaId])

  useEffect(() => {
    void reload()
  }, [reload, reloadKey])

  const requestedRun = runs.find((run) => run.approval_requested)
  const pending = approvals.filter((item) => item.status === 'pending' && item.run_id === requestedRun?.id)
  const decided = approvals.find((item) => item.run_id === requestedRun?.id && (item.status === 'approved' || item.status === 'rejected'))
  const labels = (requestedRun?.approver_labels ?? []).map((label) => label.trim()).filter(Boolean)
  const approverText = labels.join(', ')
  const comment = (decided?.decision_note || requestedRun?.decision_note || '').trim()

  const request = async () => {
    setBusy(true)
    setError('')
    try {
      await requestIdeaApproval(ideaId, workspaceId)
      await reload()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request for Approval failed.')
    } finally {
      setBusy(false)
    }
  }

  const decide = async (approval: WorkflowApprovalDto, mode: 'approve' | 'reject' | 'revision', note: string) => {
    setBusy(true)
    setError('')
    try {
      if (mode === 'approve') await approveWorkflowRun(approval.run_id, note.trim() || undefined)
      else await rejectWorkflowRun(approval.run_id, note.trim(), mode)
      await reload()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The decision could not be saved.')
      throw err
    } finally {
      setBusy(false)
    }
  }

  return {
    awaitingRequest: !requestedRun,
    approverText,
    pending,
    outcome: requestedRun?.approval_decision ?? (decided?.status === 'approved' ? 'approved' : decided?.status === 'rejected' ? 'revision' : null),
    comment,
    busy,
    error,
    request,
    decide,
  }
}

export function IdeaApprovalBanner({
  status,
  currentUserId,
  nameOf,
}: {
  status: Status
  currentUserId: string
  nameOf: (userId: string) => string
}) {
  const [note, setNote] = useState('')
  const [mode, setMode] = useState<'approve' | 'reject' | 'revision' | null>(null)
  const [localError, setLocalError] = useState('')
  if (status.awaitingRequest) return null

  const names = status.approverText || status.pending.map((item) => nameOf(item.subject_id) || item.subject_id).filter(Boolean).join(', ')
  if (status.pending.length > 0) {
    const mine = status.pending.find((item) => item.subject_id === currentUserId) ?? null
    return (
      <div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
        <p>Pending approval{names ? ` from ${names}` : ''}.</p>
        {mine ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" className="h-7 text-xs" onClick={() => setMode('approve')} disabled={status.busy}>Approve</Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setMode('revision')} disabled={status.busy}>Revision</Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setMode('reject')} disabled={status.busy}>Reject</Button>
            </div>
            {mode ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={mode === 'approve' ? 'Comment (optional)' : 'Comment'}
                  className="h-8 min-w-[16rem] flex-1 rounded-md border border-sky-200 bg-white px-2 text-xs text-slate-800"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={status.busy}
                  onClick={() => {
                    if ((mode === 'reject' || mode === 'revision') && !note.trim()) {
                      setLocalError(mode === 'reject' ? 'A reject comment is required.' : 'A revision comment is required.')
                      return
                    }
                    setLocalError('')
                    void status.decide(mine, mode, note).then(() => {
                      setMode(null)
                      setNote('')
                    }).catch(() => undefined)
                  }}
                >
                  {status.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Send'}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
        {localError || status.error ? <p className="text-rose-700">{localError || status.error}</p> : null}
      </div>
    )
  }

  if (status.outcome === 'approved') {
    return <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">Approved{status.comment ? `. ${status.comment}` : '.'}</p>
  }
  if (status.outcome === 'revision') {
    return <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">Revision{status.comment ? `: ${status.comment}` : '.'}</p>
  }
  if (status.outcome === 'reject') {
    return <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">Rejected{status.comment ? `: ${status.comment}` : '.'}</p>
  }
  return null
}
