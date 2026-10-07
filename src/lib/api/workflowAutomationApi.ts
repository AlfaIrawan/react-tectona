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
  created_date: string
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

export async function runWorkflow(id: string, body?: { trigger_type?: string; context?: Record<string, unknown>; start_node_id?: string }): Promise<WorkflowRunDto> {
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

export async function rejectWorkflowRun(runId: string, note?: string): Promise<WorkflowRunDto> {
  const res = await apiFetch(`${BASE_URL}/v1/runs/${encodeURIComponent(runId)}/reject`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify({ note: note ?? null }),
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
