import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { listWorkflows, listWorkflowVersions, type WorkflowSummaryDto, type WorkflowVersionDto } from '@/lib/api/workflowAutomationApi'

export function CallWorkflowFields({ workspaceId, currentWorkflowId, config, onChange, onOpen }: {
  onOpen: () => void
  workspaceId: string | null
  currentWorkflowId: string | null
  config: Record<string, string>
  onChange: (config: Record<string, string>) => void
}) {
  const [workflows, setWorkflows] = useState<WorkflowSummaryDto[]>([])
  const [versions, setVersions] = useState<WorkflowVersionDto[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    setError('')
    listWorkflows(workspaceId || undefined).then((rows) => { if (!cancelled) setWorkflows(rows.filter((row) => row.id !== currentWorkflowId && row.is_published && row.status === 'Active')) }).catch(() => { if (!cancelled) setError('Could not load child workflows.') })
    return () => { cancelled = true }
  }, [workspaceId, currentWorkflowId])
  useEffect(() => {
    let cancelled = false
    setError('')
    setVersions([])
    if (config.workflowId) listWorkflowVersions(config.workflowId).then((rows) => { if (!cancelled) setVersions(rows) }).catch(() => { if (!cancelled) setError('Could not load published versions.') })
    return () => { cancelled = true }
  }, [config.workflowId])
  return <div className="space-y-3">
    <label className="block space-y-1.5 text-xs text-muted-foreground">
      <span>Child Workflow</span>
      <select aria-label="Child Workflow" className="h-9 w-full rounded-lg border border-input bg-background px-2 text-foreground" value={config.workflowId || ''} onChange={(event) => onChange({ workflowId: event.target.value, workflowVersion: '', workflowName: workflows.find((row) => row.id === event.target.value)?.name || '' })}>
        <option value="">Select workflow</option>
        {config.workflowId && !workflows.some((row) => row.id === config.workflowId) ? <option value={config.workflowId}>{config.workflowName || config.workflowId}</option> : null}
        {workflows.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select>
    </label>
    <Button type="button" variant="outline" size="icon" disabled={!config.workflowId} title="Open child workflow" aria-label="Open child workflow" onClick={onOpen}><ExternalLink className="h-4 w-4" /></Button>
    <label className="block space-y-1.5 text-xs text-muted-foreground">
      <span>Published Version</span>
      <select aria-label="Published Version" className="h-9 w-full rounded-lg border border-input bg-background px-2 text-foreground" value={config.workflowVersion || ''} disabled={!config.workflowId} onChange={(event) => onChange({ workflowVersion: event.target.value })}>
        <option value="">Select version</option>
        {versions.map((row) => <option key={row.id} value={String(row.version)}>v{row.version}</option>)}
      </select>
    </label>
    {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
  </div>
}
