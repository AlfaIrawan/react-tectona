import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Mail, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { enterpriseSecondaryButtonClass } from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'
import {
  approveWorkflowRun,
  listIdeaWorkflowRuns,
  listRunApprovalEmails,
  listWorkflowApprovals,
  rejectWorkflowRun,
  requestIdeaApproval,
  type ApprovalEmailConversationDto,
  type ApprovalEmailDeliveryDto,
  type IdeaWorkflowRunDto,
  type WorkflowApprovalDto,
} from '@/lib/api/workflowAutomationApi'

type Status = {
  awaitingRequest: boolean
  /** No request yet, or requested and no approver has answered: the owner may (re)send it. */
  canRequest: boolean
  requestedBy: string
  /** The run the latest request belongs to; its email conversation is behind the mail icon. */
  requestedRunId: string
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
    requestedRunId: requestedRun?.id ?? '',
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

/** Mail icon that opens what the approvers and Tectona wrote by email on this run. */
function ApprovalEmailButton({ runId }: { runId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [conversations, setConversations] = useState<ApprovalEmailConversationDto[]>([])

  const show = async () => {
    setOpen(true)
    setLoading(true)
    setError('')
    try {
      setConversations(await listRunApprovalEmails(runId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The email conversation could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  const withReplies = conversations.filter((item) => item.messages.some((message) => message.direction === 'in'))
  const shown = withReplies.length > 0 ? withReplies : conversations
  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          void show()
        }}
        className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/12 text-blue-700 ring-1 ring-blue-500/25 transition-colors hover:bg-blue-500/20"
        title="Show the approval email conversation"
        aria-label="Show the approval email conversation"
      >
        <Mail className="h-4 w-4" aria-hidden />
      </button>
      {open
        ? createPortal(
          // Same frame as "Generate document from template": portal, dimmed backdrop, header, footer.
          <div
            className="z-[1400] flex items-center justify-center p-4 sm:p-6"
            style={{ position: 'fixed', inset: 0, zIndex: 1400 }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
              aria-label="Close email conversation"
              onClick={() => setOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="approval-email-title"
              className="relative z-[1401] w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card via-card to-card/95 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]"
            >
              <div className="border-b border-border/70 bg-muted/25 px-6 py-5">
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/12 text-blue-700 ring-1 ring-blue-500/25">
                    <Mail className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h3 id="approval-email-title" className="text-base font-semibold tracking-tight text-foreground">
                      Approval by email
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      What the approvers and Tectona wrote by email for this request.
                    </p>
                  </div>
                </div>
              </div>

              <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
                {loading ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
                  </p>
                ) : null}
                {error ? <p className="text-sm text-rose-700">{error}</p> : null}
                {!loading && !error && shown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No email conversation for this request.</p>
                ) : null}
                {shown.map((conversation) => (
                  <div key={conversation.code} className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {conversation.approver_name || 'Approver'}
                    </p>
                    {conversation.messages.map((message, index) => (
                      <div
                        key={index}
                        className={message.direction === 'in'
                          ? 'mr-8 rounded-xl border border-border bg-card px-4 py-3'
                          : 'ml-8 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] px-4 py-3'}
                      >
                        <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                          {message.direction === 'in' ? conversation.approver_name || 'Approver' : 'Tectona'}
                          {message.created_at ? ` · ${new Date(message.created_at).toLocaleString()}` : ''}
                        </p>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{message.body}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-border/70 bg-muted/20 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4 shrink-0" aria-hidden />
                  Close
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  )
}

/**
 * A run's raw error as one readable sentence, plus the document kind it was making.
 * The raw text (URLs, HTTP codes) stays available as a tooltip.
 */
export function describeRunFailure(error: string): { kind: string | null; text: string } {
  const raw = (error || '').trim()
  const generation = /^(URD|BRD|FSD)\s+generation failed/i.exec(raw)
  if (generation) {
    const kind = generation[1].toUpperCase()
    return { kind, text: `Generate ${kind} failed. Generate it from the template to continue the approval.` }
  }
  const template = /no active (URD|BRD|FSD) template/i.exec(raw)
  if (template) {
    const kind = template[1].toUpperCase()
    return { kind, text: `No active ${kind} template was found for this workspace.` }
  }
  return { kind: null, text: 'A step after the approval failed.' }
}

export function IdeaApprovalBanner({
  status,
  currentUserId,
  nameOf,
  compact = false,
  existingDocumentKinds = [],
}: {
  status: Status
  currentUserId: string
  nameOf: (userId: string) => string
  /** Inside a document table row: plain text lines instead of a boxed banner. */
  compact?: boolean
  /** Document kinds the idea already has; a failure to make one of them is no longer news. */
  existingDocumentKinds?: string[]
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
        <p className="flex items-center gap-1.5">
          <span>Pending approval{names ? ` from ${names}` : ''}.</span>
          {status.requestedRunId && status.emailDeliveries.length > 0 ? <ApprovalEmailButton runId={status.requestedRunId} /> : null}
        </p>
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
  const failure = status.failedAfterDecision ? describeRunFailure(status.failedAfterDecision) : null
  if (shown) {
    return (
      <div className={compact ? 'space-y-1 text-[11px]' : `space-y-1 rounded-lg border px-3 py-2 text-xs ${shown.box}`}>
        <p className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${shown.badge}`}>{shown.label}</span>
          {/* A decision made by email is read behind the mail icon, not repeated on the row. */}
          {status.requestedRunId && /^via email/i.test(status.comment)
            ? <ApprovalEmailButton runId={status.requestedRunId} />
            : status.comment ? <span className="text-slate-700">{status.comment}</span> : null}
        </p>
        {failure && !(failure.kind && existingDocumentKinds.includes(failure.kind)) ? (
          <p className="text-rose-700" title={status.failedAfterDecision}>{failure.text}</p>
        ) : null}
      </div>
    )
  }
  return null
}
