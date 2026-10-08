/**
 * Workflow & Automation service API client.
 * Uses python-tectona-workflow-automation-service-fastapi (http://localhost:8521).
 * In development, Vite proxies /api/workflow-automation -> localhost:8521
 * (set VITE_WORKFLOW_AUTOMATION_API_URL to override).
 *
 * NOTE: the backend responds in snake_case (matching the idea-backlog convention).
 */

import { apiFetch, tectonaServiceHeaders } from './httpClient'
import { serviceApiBase } from './gatewayBase'

const BASE_URL = (() => {
  const override = (import.meta.env.VITE_WORKFLOW_AUTOMATION_API_URL as string | undefined)?.trim()
  if (override) return override.replace(/\/$/, '')

  // The workflow service is exposed by the local Vite proxy in development. This
  // keeps the feature usable even when gateway-control-plane has not published
  // the workflow route yet. Production still follows the platform gateway path.
  if (import.meta.env.DEV) return '/api/workflow-automation'
  return serviceApiBase('/api/workflow-automation')
})()

export type WorkflowApiTrigger = 'Manual' | 'Schedule' | 'Event' | 'Webhook'
export type WorkflowApiStatus = 'Active' | 'Paused' | 'Draft' | 'Needs Approval' | 'Failed'

export type WorkflowGraph = {
  nodes: unknown[]
  edges: unknown[]
  schema_version?: number
  /** Idea Detail sidebar visibility. The executor ignores this; the editor and Idea Detail read it. */
  ideaSections?: Partial<Record<string, 'show' | 'hide'>>
}

/** Row shape returned by GET /workflows (no heavy `definition`). */
export type WorkflowSummaryDto = {
  id: string
  name: string
  category: string
  owner: string
  trigger: WorkflowApiTrigger
  status: WorkflowApiStatus
  success_rate: number
  executions: number
  is_published: boolean
  version: number
  last_updated: string
  updated_date?: string
  /** Owning workspace; present so the catalog can mark rows inherited from the
      organization home, which the listing now includes. */
  workspace_id?: string | null
}

/** Full record returned by GET /workflows/{id} (includes `definition`). */
export type WorkflowDto = WorkflowSummaryDto & {
  definition: WorkflowGraph
  /** Newest published snapshot. The draft in `definition` is what the builder edits. */
  published_definition?: WorkflowGraph | null
  created_date: string
}

export type WorkflowVersionDto = {
  id: string
  workflow_id: string
  version: number
  name: string
  created_by: string
  created_date: string
  definition?: WorkflowGraph
}

export type WorkflowCreateInput = {
  name: string
  category?: string
  owner?: string
  trigger?: WorkflowApiTrigger
  status?: WorkflowApiStatus
  definition?: WorkflowGraph
  workspace_id?: string | null
}

export type WorkflowUpdateInput = Partial<{
  name: string
  category: string
  owner: string
  trigger: WorkflowApiTrigger
  status: WorkflowApiStatus
  success_rate: number
  executions: number
  definition: WorkflowGraph
}>

function defaultHeaders(extra?: Record<string, string>): HeadersInit {
  return tectonaServiceHeaders(extra)
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

export async function listWorkflows(workspaceId?: string): Promise<WorkflowSummaryDto[]> {
  const qs = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ''
  const res = await apiFetch(`${BASE_URL}/v1/workflows${qs}`, { headers: defaultHeaders() })
  return readJson<WorkflowSummaryDto[]>(res)
}

/** Everything the engine dashboard shows, computed by the backend from runs, steps and
    approvals. Fields that the data cannot back (retries, per-day queue history) are absent. */
export type WorkflowOverviewDto = {
  window: { days: number; from: string; to: string }
  kpis: {
    workflows_total: number
    workflows_active: number
    runs_total: number
    runs_completed: number
    runs_failed: number
    runs_cancelled: number
    waiting_now: number
    success_rate: number | null
    median_duration_seconds: number | null
  }
  trend: Array<{ date: string; total: number; completed: number; failed: number; cancelled: number }>
  funnel: Array<{ label: string; value: number; pct: number }>
  approvals: {
    approved: number
    rejected: number
    cancelled: number
    pending: number
    median_decision_minutes: number | null
  }
  triggers: Array<{ label: string; value: number; pct: number }>
  status_mix: Array<{ label: string; value: number }>
  queue: { waiting_approval: number; waiting_delay: number; running: number; pending_approvals: number }
  insights: Array<{ level: 'Critical' | 'Warning' | 'Info'; text: string }>
}

export async function getWorkflowOverview(params: { workspaceId?: string; days?: number } = {}): Promise<WorkflowOverviewDto> {
  const query = new URLSearchParams()
  if (params.workspaceId) query.set('workspace_id', params.workspaceId)
  if (params.days) query.set('days', String(params.days))
  const qs = query.toString() ? `?${query.toString()}` : ''
  const res = await apiFetch(`${BASE_URL}/v1/workflows/overview${qs}`, { headers: defaultHeaders() })
  return readJson<WorkflowOverviewDto>(res)
}

export async function getWorkflow(id: string): Promise<WorkflowDto> {
  const res = await apiFetch(`${BASE_URL}/v1/workflows/${encodeURIComponent(id)}`, { headers: defaultHeaders() })
  return readJson<WorkflowDto>(res)
}

export async function createWorkflow(body: WorkflowCreateInput): Promise<WorkflowDto> {
  const res = await apiFetch(`${BASE_URL}/v1/workflows`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify(body),
  })
  return readJson<WorkflowDto>(res)
}

export async function updateWorkflow(id: string, patch: WorkflowUpdateInput): Promise<WorkflowDto> {
  const res = await apiFetch(`${BASE_URL}/v1/workflows/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: defaultHeaders(),
    body: JSON.stringify(patch),
  })
  return readJson<WorkflowDto>(res)
}

export async function duplicateWorkflowApi(id: string): Promise<WorkflowDto> {
  const res = await apiFetch(`${BASE_URL}/v1/workflows/${encodeURIComponent(id)}/duplicate`, {
    method: 'POST',
    headers: defaultHeaders(),
  })
  return readJson<WorkflowDto>(res)
}

export async function deleteWorkflowApi(id: string): Promise<void> {
  const res = await apiFetch(`${BASE_URL}/v1/workflows/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: defaultHeaders(),
  })
  if (!res.ok && res.status !== 204 && res.status !== 404) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
}

export async function publishWorkflowApi(id: string): Promise<WorkflowDto> {
  const res = await apiFetch(`${BASE_URL}/v1/workflows/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
    headers: defaultHeaders(),
  })
  return readJson<WorkflowDto>(res)
}

export async function listWorkflowVersions(id: string): Promise<WorkflowVersionDto[]> {
  const res = await apiFetch(`${BASE_URL}/v1/workflows/${encodeURIComponent(id)}/versions`, { headers: defaultHeaders() })
  return readJson<WorkflowVersionDto[]>(res)
}

export async function getWorkflowVersion(id: string, version: number): Promise<WorkflowVersionDto> {
  const res = await apiFetch(`${BASE_URL}/v1/workflows/${encodeURIComponent(id)}/versions/${version}`, { headers: defaultHeaders() })
  return readJson<WorkflowVersionDto>(res)
}

export async function dispatchWorkflowEvent(body: {
  event_type: string
  domain?: string
  entity?: string
  context?: Record<string, unknown>
}): Promise<string[]> {
  const res = await apiFetch(`${BASE_URL}/v1/events`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify(body),
  })
  return readJson<string[]>(res)
}

export async function dispatchWorkflowWebhook(eventName: string, context: Record<string, unknown> = {}): Promise<string[]> {
  const res = await apiFetch(`${BASE_URL}/v1/webhooks/${encodeURIComponent(eventName)}`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify(context),
  })
  return readJson<string[]>(res)
}

// ── Execution engine (Phase B) ────────────────────────────────────────────

export type WorkflowRunStatus = 'running' | 'waiting_approval' | 'waiting_delay' | 'completed' | 'failed' | 'cancelled'
export type WorkflowRunStepStatus = 'succeeded' | 'failed' | 'skipped' | 'waiting' | 'running'

export type WorkflowRunStepDto = {
  id: string
  run_id: string
  node_id: string
  kind: string
  label?: string | null
  status: WorkflowRunStepStatus
  branch?: string | null
  output?: unknown
  message?: string | null
  started_at?: string | null
  finished_at?: string | null
}

export type WorkflowParallelBranchDto = {
  run_id: string
  parallel_node_id: string
  branch_id: string
  join_node_id: string
  branch_root_id: string
  current_node_id?: string | null
  resume_target?: string | null
  status: string
  error?: string | null
}

export type WorkflowRunSummaryDto = {
  id: string
  workflow_id: string
  status: WorkflowRunStatus
  trigger_type: string
  current_node_id?: string | null
  error?: string | null
  started_at?: string | null
  finished_at?: string | null
}

export type WorkflowRunDto = WorkflowRunSummaryDto & {
  context: Record<string, unknown>
  steps: WorkflowRunStepDto[]
  parallel_branches: WorkflowParallelBranchDto[]
}

export async function runWorkflow(id: string, body?: { trigger_type?: string; context?: Record<string, unknown>; start_node_id?: string; use_draft?: boolean }): Promise<WorkflowRunDto> {
  const res = await apiFetch(`${BASE_URL}/v1/workflows/${encodeURIComponent(id)}/run`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify(body ?? {}),
  })
  return readJson<WorkflowRunDto>(res)
}

export async function listWorkflowRuns(id: string): Promise<WorkflowRunSummaryDto[]> {
  const res = await apiFetch(`${BASE_URL}/v1/workflows/${encodeURIComponent(id)}/runs`, { headers: defaultHeaders() })
  return readJson<WorkflowRunSummaryDto[]>(res)
}

export async function retryFailedDocumentActions(runId: string): Promise<WorkflowRunDto> {
  const res = await apiFetch(`${BASE_URL}/v1/runs/${encodeURIComponent(runId)}/retry-document-actions`, {
    method: 'POST',
    headers: defaultHeaders(),
  })
  return readJson<WorkflowRunDto>(res)
}

export async function getWorkflowRun(runId: string): Promise<WorkflowRunDto> {
  const res = await apiFetch(`${BASE_URL}/v1/runs/${encodeURIComponent(runId)}`, { headers: defaultHeaders() })
  return readJson<WorkflowRunDto>(res)
}

export async function approveWorkflowRun(runId: string, note?: string): Promise<WorkflowRunDto> {
  const res = await apiFetch(`${BASE_URL}/v1/runs/${encodeURIComponent(runId)}/approve`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify({ note: note ?? null }),
  })
  return readJson<WorkflowRunDto>(res)
}

export async function rejectWorkflowRun(runId: string, note?: string, outcome?: 'reject' | 'revision'): Promise<WorkflowRunDto> {
  const res = await apiFetch(`${BASE_URL}/v1/runs/${encodeURIComponent(runId)}/reject`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify({ note: note ?? null, outcome: outcome ?? 'revision' }),
  })
  return readJson<WorkflowRunDto>(res)
}

export type IdeaWorkflowRunDto = {
  id: string
  workflow_id: string
  status: string
  current_node_id?: string | null
  approval_request_pending: boolean
  approval_requested?: boolean
  approval_decision?: string | null
  decision_note?: string | null
  approver_labels: string[]
  requested_by?: string | null
}

export async function listIdeaWorkflowRuns(ideaId: string): Promise<IdeaWorkflowRunDto[]> {
  const res = await apiFetch(`${BASE_URL}/v1/runs?idea_id=${encodeURIComponent(ideaId)}`, { headers: defaultHeaders() })
  return readJson<IdeaWorkflowRunDto[]>(res)
}

export async function requestIdeaApproval(ideaId: string, workspaceId?: string | null): Promise<WorkflowRunDto> {
  const res = await apiFetch(`${BASE_URL}/v1/ideas/${encodeURIComponent(ideaId)}/request-approval`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify({ workspace_id: workspaceId ?? null }),
  })
  return readJson<WorkflowRunDto>(res)
}

export async function requestWorkflowApproval(runId: string): Promise<WorkflowRunDto> {
  const res = await apiFetch(`${BASE_URL}/v1/runs/${encodeURIComponent(runId)}/request-approval`, {
    method: 'POST',
    headers: defaultHeaders(),
  })
  return readJson<WorkflowRunDto>(res)
}

/** One person's approval request on a parked workflow run. */
export type WorkflowApprovalDto = {
  id: string
  run_id: string
  workflow_id: string
  node_id: string
  attempt: number
  subject_id: string
  role_code?: string | null
  quorum: 'all' | 'any'
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  subject_context: Record<string, string | number | null>
  requested_by?: string | null
  requested_at?: string | null
  decided_at?: string | null
  decision_note?: string | null
}

/** The caller's approval inbox (`mine`), or every approval of one document / idea. */
export async function listWorkflowApprovals(params: {
  mine?: boolean
  subjectContextKey?: string
  subjectContextValue?: string
  limit?: number
} = {}): Promise<WorkflowApprovalDto[]> {
  const query = new URLSearchParams()
  if (params.mine === false) query.set('mine', 'false')
  if (params.subjectContextKey) query.set('subject_context_key', params.subjectContextKey)
  if (params.subjectContextValue) query.set('subject_context_value', params.subjectContextValue)
  if (params.limit) query.set('limit', String(params.limit))
  const res = await apiFetch(`${BASE_URL}/v1/approvals?${query.toString()}`, { headers: defaultHeaders() })
  return readJson<WorkflowApprovalDto[]>(res)
}

export type WorkflowApprovalRoleDto = {
  id: string
  workspace_id: string
  role_code: string
  role_name: string
  subject_id: string
}

/** Who holds a business role ("Business Owner") in a workspace — what approval nodes name. */
export async function listWorkflowApprovalRoles(workspaceId?: string): Promise<WorkflowApprovalRoleDto[]> {
  const query = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ''
  const res = await apiFetch(`${BASE_URL}/v1/approval-roles${query}`, { headers: defaultHeaders() })
  return readJson<WorkflowApprovalRoleDto[]>(res)
}

export async function assignWorkflowApprovalRole(body: {
  workspace_id: string
  role_code: string
  role_name?: string
  subject_id: string
}): Promise<WorkflowApprovalRoleDto> {
  const res = await apiFetch(`${BASE_URL}/v1/approval-roles`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify(body),
  })
  return readJson<WorkflowApprovalRoleDto>(res)
}

export async function unassignWorkflowApprovalRole(params: {
  workspace_id: string
  role_code: string
  subject_id: string
}): Promise<void> {
  const query = new URLSearchParams(params).toString()
  await apiFetch(`${BASE_URL}/v1/approval-roles?${query}`, { method: 'DELETE', headers: defaultHeaders() })
}
