import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  approveWorkflowRun,
  listIdeaWorkflowRuns,
  listWorkflowApprovals,
  rejectWorkflowRun,
  requestIdeaApproval,
  type ApprovalEmailDeliveryDto,
  type IdeaWorkflowRunDto,
  type WorkflowApprovalDto,
} from '@/lib/api/workflowAutomationApi'

type Status = {
  awaitingRequest: boolean
  /** No request yet, or requested and no approver has answered: the owner may (re)send it. */
  canRequest: boolean
  requestedBy: string
  emailDeliveries: ApprovalEmailDeliveryDto[]
  /** A step after the decision failed (the decision itself stands). */
  failedAfterDecision: string
  approverText: string
  pending: WorkflowApprovalDto[]
  outcome: string | null
  comment: string
  busy: boolean
  error: string
  /** Resolves with who the approval email reached, for the caller's toast. */
  request: () => Promise<ApprovalEmailDeliveryDto[] | null>
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
    return runRows
  }, [ideaId])

  useEffect(() => {
    void reload()
  }, [reload, reloadKey])

  // A run that failed or was cancelled after the request (e.g. no approver matched) leaves
  // nothing to wait for, so the owner must be able to request approval again.
  // A run that failed or was cancelled before anyone decided (e.g. no approver matched) leaves
  // nothing to wait for, so the owner may request again. One that failed AFTER a decision
  // (a later step such as Generate BRD) still carries that decision.
  const decidedRunIds = new Set(
    approvals.filter((item) => item.status === 'approved' || item.status === 'rejected').map((item) => item.run_id),
  )
  const requestedRun = runs.find((run) => run.approval_requested
    && ((run.status !== 'failed' && run.status !== 'cancelled') || decidedRunIds.has(run.id)))
  const pending = approvals.filter((item) => item.status === 'pending' && item.run_id === requestedRun?.id)
  const decided = approvals.find((item) => item.run_id === requestedRun?.id && (item.status === 'approved' || item.status === 'rejected'))
  const labels = (requestedRun?.approver_labels ?? []).map((label) => label.trim()).filter(Boolean)
  const approverText = labels.join(', ')
  const comment = (decided?.decision_note || requestedRun?.decision_note || '').trim()

  const request = async () => {
    setBusy(true)
    setError('')
    try {
      const run = await requestIdeaApproval(ideaId, workspaceId)
      const rows = await reload()
      onChanged()
      return rows.find((item) => item.id === run.id)?.email_deliveries ?? []
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request for Approval failed.')
      return null
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

  const answered = approvals.some((item) => item.run_id === requestedRun?.id && (item.status === 'approved' || item.status === 'rejected'))
  return {
    awaitingRequest: !requestedRun,
    canRequest: !requestedRun || (requestedRun.status === 'waiting_approval' && !answered && !requestedRun.approval_decision),
    requestedBy: requestedRun?.requested_by ?? '',
    emailDeliveries: requestedRun?.email_deliveries ?? [],
    failedAfterDecision: requestedRun?.status === 'failed' && decidedRunIds.has(requestedRun.id) ? (requestedRun.error || 'a later step failed') : '',
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

/** "henry.halim@gmail.com" -> "he***@gmail.com": enough to recognise, not to copy. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  return `${local.slice(0, 2)}***@${domain}`
}

/** Toast text for one approval round: who the email reached, and who it did not. */
export function describeEmailDeliveries(deliveries: ApprovalEmailDeliveryDto[]): { sent: string; failed: string } {
  const sent = deliveries
    .filter((item) => item.ok)
    .map((item) => `${item.name} (${maskEmail(item.email)}${item.via === 'secondary' ? `, secondary email${item.verified ? '' : ', not verified'}` : ''})`)
    .join(', ')
  const failed = deliveries
    .filter((item) => !item.ok)
    .map((item) => `${item.name}${item.reason ? `: ${item.reason}` : ''}`)
    .join('; ')
  return { sent, failed }
}

export function IdeaApprovalBanner({
  status,
  currentUserId,
  nameOf,
  compact = false,
}: {
  status: Status
  currentUserId: string
  nameOf: (userId: string) => string
  /** Inside a document table row: plain text lines instead of a boxed banner. */
  compact?: boolean
}) {
  const [note, setNote] = useState('')
  const [mode, setMode] = useState<'approve' | 'reject' | 'revision' | null>(null)
  const [localError, setLocalError] = useState('')
  if (status.awaitingRequest) return null

  const names = status.pending.map((item) => nameOf(item.subject_id) || item.subject_id).filter(Boolean).join(', ') || status.approverText
  if (status.pending.length > 0) {
    const mine = status.pending.find((item) => item.subject_id === currentUserId) ?? null
    return (
      <div className={compact ? 'space-y-1.5 text-[11px] text-sky-900' : 'space-y-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950'}>
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

  const outcomes: Record<string, { label: string; badge: string; box: string }> = {
    approved: { label: 'Approved', badge: 'bg-emerald-100 text-emerald-800', box: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
    revision: { label: 'Revision', badge: 'bg-amber-100 text-amber-800', box: 'border-amber-200 bg-amber-50 text-amber-950' },
    reject: { label: 'Rejected', badge: 'bg-rose-100 text-rose-800', box: 'border-rose-200 bg-rose-50 text-rose-900' },
  }
  const shown = status.outcome ? outcomes[status.outcome] : undefined
  if (shown) {
    return (
      <div className={compact ? 'space-y-1 text-[11px]' : `space-y-1 rounded-lg border px-3 py-2 text-xs ${shown.box}`}>
        <p className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${shown.badge}`}>{shown.label}</span>
          {status.comment ? <span className="text-slate-700">{status.comment}</span> : null}
        </p>
        {status.failedAfterDecision ? (
          <p className="text-rose-700" title={status.failedAfterDecision}>
            The next step failed: {status.failedAfterDecision.slice(0, 160)}
          </p>
        ) : null}
      </div>
    )
  }
  return null
}
