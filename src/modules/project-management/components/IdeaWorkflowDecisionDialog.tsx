import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, Undo2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { approveWorkflowRun, rejectWorkflowRun, type WorkflowApprovalDto } from '@/lib/api/workflowAutomationApi'
import { loadIdeaDecisionGates, type IdeaDecisionMode } from '../lib/ideaWorkflowDecisions'

export function IdeaWorkflowDecisionDialog({ idea, mode, userId, onClose, onSaved }: {
  idea: { id: string; title: string }
  mode: IdeaDecisionMode
  userId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [gates, setGates] = useState<WorkflowApprovalDto[]>([])
  const [gateId, setGateId] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const label = mode === 'approve' ? 'Approve' : mode === 'reject' ? 'Reject' : 'Request Revision'
  const Icon = mode === 'approve' ? Check : mode === 'reject' ? X : Undo2

  useEffect(() => {
    let active = true
    void loadIdeaDecisionGates(idea.id, userId).then((rows) => {
      if (!active) return
      setGates(rows)
      setGateId(rows.length === 1 ? rows[0].id : '')
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : 'Could not check workflow approvals.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [idea.id, userId])

  const submit = async () => {
    if (submitting.current || !gateId || (mode !== 'approve' && !note.trim())) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      // Recheck the assignment and parked node before sending a decision.
      const latest = await loadIdeaDecisionGates(idea.id, userId)
      const gate = latest.find((item) => item.id === gateId)
      if (!gate) throw new Error('This approval is no longer assigned to you or has already been decided.')
      if (mode === 'approve') await approveWorkflowRun(gate.run_id, note.trim() || undefined, gate.id)
      else await rejectWorkflowRun(gate.run_id, note.trim(), mode, gate.id)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The workflow decision could not be saved.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !submitting.current) onClose() }}>
      <DialogContent role="dialog" aria-modal="true" aria-labelledby="idea-decision-title" className="w-[min(32rem,calc(100vw-2rem))] space-y-4 rounded-lg">
        <DialogHeader><DialogTitle id="idea-decision-title" className="text-base">{label} Idea</DialogTitle></DialogHeader>
        <p className="break-words text-sm font-medium">{idea.title}</p>
        {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Checking approvals" /> : !gates.length && !error ? (
          <p className="text-sm text-muted-foreground">No active idea approval is assigned to you. Decisions are managed by Workflow Automation.</p>
        ) : null}
        {gates.length > 1 ? (
          <div className="space-y-2">
            <Label htmlFor="idea-decision-gate">Approval step</Label>
            <select id="idea-decision-gate" value={gateId} disabled={busy} onChange={(event) => setGateId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Select an approval step</option>
              {gates.map((gate) => <option key={gate.id} value={gate.id}>{String(gate.subject_context.gate_label || 'Approval')} ({gate.run_id})</option>)}
            </select>
          </div>
        ) : null}
        {gates.length ? <div className="space-y-2">
          <Label htmlFor="idea-decision-note">{mode === 'approve' ? 'Comment (optional)' : 'Reason (required)'}</Label>
          <Textarea id="idea-decision-note" value={note} onChange={(event) => setNote(event.target.value)} disabled={busy} maxLength={2000} />
        </div> : null}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant={mode === 'reject' ? 'destructive' : 'default'} onClick={() => void submit()} disabled={loading || busy || !gateId || (mode !== 'approve' && !note.trim())} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}{label}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
