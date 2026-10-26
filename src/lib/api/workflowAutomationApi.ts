/**
 * Workflow & Automation service API client.
 * Uses python-tectona-workflow-automation-service-fastapi (http://localhost:8521).
 * In development, Vite proxies /api/workflow-automation -> localhost:8521
 * (set VITE_WORKFLOW_AUTOMATION_API_URL to override).
 *
 * NOTE: the backend responds in snake_case (matching the idea-backlog convention).
 */

import { apiFetch, parseApiErrorMessage, tectonaServiceHeaders } from './httpClient'
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
  /** Teams/roles that still see a hidden section, and who sees each diagram type. Set on the Idea trigger. */
  ideaSectionAudience?: {
    alsoShowTo?: Partial<Record<string, string[]>>
    diagramTypes?: Partial<Record<string, string[]>>
  }
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
  /** Where the workflow fires: its organization, only listed workspaces, or the organization minus some. */
  scope_mode?: 'organization' | 'include' | 'exclude'
  scope_workspace_ids?: string[]
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
  scope_mode?: 'organization' | 'include' | 'exclude'
  scope_workspace_ids?: string[]
  trigger?: WorkflowApiTrigger
  status?: WorkflowApiStatus
  definition?: WorkflowGraph
  workspace_id?: string | null
}

export type WorkflowUpdateInput = Partial<{
  name: string
  category: string
  owner: string
  scope_mode: 'organization' | 'include' | 'exclude'
  scope_workspace_ids: string[]
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
    // Errors arrive as {"detail": ...} or, behind the error middleware, {"error": {"message": ...}}.
    throw new Error(parseApiErrorMessage(text, `HTTP ${res.status}`))
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
  /** What the run figures cover: every workspace, or the selected one plus all under it. */
  scope?: { runs: 'all' | 'workspace'; workspaces: number | null }
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

/** `?workspace_id=` naming the workspace the caller acts from. The backend refuses to change a
    workflow from a workspace that only inherits it (403). */
function actingWorkspaceQuery(workspaceId?: string | null, prefix: '?' | '&' = '?'): string {
  const id = workspaceId?.trim()
  return id ? `${prefix}workspace_id=${encodeURIComponent(id)}` : ''
}

export async function updateWorkflow(id: string, patch: WorkflowUpdateInput, workspaceId?: string | null): Promise<WorkflowDto> {
  const res = await apiFetch(`${BASE_URL}/v1/workflows/${encodeURIComponent(id)}${actingWorkspaceQuery(workspaceId)}`, {
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

export async function deleteWorkflowApi(id: string, workspaceId?: string | null): Promise<void> {
  const res = await apiFetch(`${BASE_URL}/v1/workflows/${encodeURIComponent(id)}${actingWorkspaceQuery(workspaceId)}`, {
    method: 'DELETE',
    headers: defaultHeaders(),
  })
  if (!res.ok && res.status !== 204 && res.status !== 404) {
    const text = await res.text().catch(() => '')
    throw new Error(parseApiErrorMessage(text, `HTTP ${res.status}`))
  }
}

/** One thing the publish check found: an error blocks publishing, a warning needs acknowledgement. */
export type WorkflowPublishProblem = {
  level: 'error' | 'warning'
  code: string
  message: string
  node_id?: string | null
  node_label?: string | null
}

/** Publishing was refused by the publish check; `problems` says why. */
export class WorkflowPublishCheckError extends Error {
  problems: WorkflowPublishProblem[]
  blocking: boolean

  constructor(problems: WorkflowPublishProblem[], blocking: boolean) {
    super(blocking ? 'The workflow has problems that would fail its runs.' : 'The workflow has warnings to acknowledge.')
    this.problems = problems
    this.blocking = blocking
  }
}

export async function publishWorkflowApi(id: string, options: { acknowledgeWarnings?: boolean; workspaceId?: string | null } = {}): Promise<WorkflowDto> {
  const qs = options.acknowledgeWarnings
    ? `?acknowledge_warnings=true${actingWorkspaceQuery(options.workspaceId, '&')}`
    : actingWorkspaceQuery(options.workspaceId)
  const res = await apiFetch(`${BASE_URL}/v1/workflows/${encodeURIComponent(id)}/publish${qs}`, {
    method: 'POST',
    headers: defaultHeaders(),
  })
  if (res.status === 422 || res.status === 409) {
    const body = await res.clone().json().catch(() => null) as { error?: { details?: { code?: string; problems?: WorkflowPublishProblem[] } } } | null
    const details = body?.error?.details
    if (details?.problems?.length) throw new WorkflowPublishCheckError(details.problems, details.code === 'PUBLISH_CHECK_FAILED')
  }
  return readJson<WorkflowDto>(res)
}

/** Resume a failed run from the step that failed, with the context it had. */
export async function retryWorkflowRun(runId: string): Promise<WorkflowRunDto> {
  const res = await apiFetch(`${BASE_URL}/v1/runs/${encodeURIComponent(runId)}/retry`, {
    method: 'POST',
    headers: defaultHeaders(),
  })
  return readJson<WorkflowRunDto>(res)
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

/**
 * Tell the idea's approval workflow that the Generate dialog made a URD/BRD/FSD. When the workflow
 * had stopped because generating that document failed, it continues with this one (its approval
 * is requested next); otherwise nothing changes.
 */
export async function continueWorkflowAfterGeneratedDocument(
  ideaId: string,
  documentKind: 'URD' | 'BRD' | 'FSD',
  documentId: string,
): Promise<{ continued: boolean; run_id?: string | null; reason?: string | null }> {
  const res = await apiFetch(`${BASE_URL}/v1/ideas/${encodeURIComponent(ideaId)}/document-generated`, {
    method: 'POST',
    headers: { ...defaultHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_kind: documentKind, document_id: documentId }),
  })
  return readJson<{ continued: boolean; run_id?: string | null; reason?: string | null }>(res)
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
  /** Why the run stopped, when it failed (e.g. a step after the approval). */
  error?: string | null
  /** Who the latest approval round emailed. via: primary | secondary. */
  email_deliveries?: ApprovalEmailDeliveryDto[]
  /** Sections the run's "Set Section Visibility" nodes showed or hid, laid over the workflow's map. */
  idea_sections?: Record<string, IdeaSectionOverrideDto>
}

/** One "Set Section Visibility" change on a run (workflow-automation engine/idea_sections.py). */
export type IdeaSectionOverrideDto = {
  visibility: 'show' | 'hide'
  /** show: only these teams/roles (empty: everyone) · hide: these still see it (empty: nobody). */
  audience?: string[]
  /** How audience is matched: name, jobTitle, department, team, role, workspace (group); empty: team/role names. */
  audience_by?: string
  /** Diagrams only: who sees each diagram type inside it (empty: everyone who sees Diagrams). */
  diagram_types?: { technical?: string[]; bpmn?: string[] }
  node_id?: string
  label?: string
  at?: string
  retroactive?: boolean
}

export type SectionNodeApplication = {
  applied: boolean
  ideas: Array<{ idea_id: string; idea_title: string; run_id: string; changes: Array<{ section: string; visibility: string; label: string }> }>
}

/**
 * "Set Section Visibility" nodes that ideas' runs went past before the node was published: which
 * ideas they change (dryRun) or apply the change.
 */
export async function applyWorkflowSectionNodes(workflowId: string, dryRun: boolean, workspaceId?: string | null): Promise<SectionNodeApplication> {
  const res = await apiFetch(
    `${BASE_URL}/v1/workflows/${encodeURIComponent(workflowId)}/apply-section-nodes?dry_run=${dryRun ? 'true' : 'false'}${actingWorkspaceQuery(workspaceId, '&')}`,
    { method: 'POST', headers: defaultHeaders() },
  )
  return readJson<SectionNodeApplication>(res)
}

export type ApprovalEmailDeliveryDto = {
  name: string
  email: string
  ok: boolean
  via?: 'primary' | 'secondary'
  verified?: boolean
  reason?: string
}

export type ApprovalEmailConversationDto = {
  code: string
  node_id: string
  attempt: number
  approver_name?: string | null
  /** open: waiting for a reply; decided: a decision was recorded; closed: no longer usable. */
  status: string
  created_at?: string | null
  messages: { direction: 'in' | 'out'; body: string; created_at?: string | null }[]
}

/** What approvers and Tectona wrote by email on one run (addresses left out). */
export async function listRunApprovalEmails(runId: string): Promise<ApprovalEmailConversationDto[]> {
  const res = await apiFetch(`${BASE_URL}/v1/runs/${encodeURIComponent(runId)}/approval-emails`, { headers: defaultHeaders() })
  return readJson<ApprovalEmailConversationDto[]>(res)
}

export async function listIdeaWorkflowRuns(ideaId: string): Promise<IdeaWorkflowRunDto[]> {
  const res = await apiFetch(`${BASE_URL}/v1/runs?idea_id=${encodeURIComponent(ideaId)}`, { headers: defaultHeaders() })
  return readJson<IdeaWorkflowRunDto[]>(res)
}

/** What deleting an idea also removes: its documents and the KB entries generated from them. */
export type IdeaGeneratedArtifactsDto = {
  documents: { id: string; title: string; doc_type: string }[]
  kb_entries: number
}

export type IdeaDeleteResultDto = {
  documents_deleted: number
  kb_entries_deleted: number
  runs_cancelled: number
  /** What could not be removed; the idea itself is deleted either way. */
  failures: string[]
}

export async function fetchIdeaGeneratedArtifacts(ideaId: string): Promise<IdeaGeneratedArtifactsDto> {
  const res = await apiFetch(`${BASE_URL}/v1/ideas/${encodeURIComponent(ideaId)}/generated-artifacts`, { headers: defaultHeaders() })
  return readJson<IdeaGeneratedArtifactsDto>(res)
}

/** Deletes the idea in Idea Backlog, then its documents, their generated KB and its waiting runs. */
export async function deleteIdeaWithArtifacts(ideaId: string, version: number): Promise<IdeaDeleteResultDto> {
  const res = await apiFetch(`${BASE_URL}/v1/ideas/${encodeURIComponent(ideaId)}?version=${version}`, {
    method: 'DELETE',
    headers: defaultHeaders(),
  })
  return readJson<IdeaDeleteResultDto>(res)
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
