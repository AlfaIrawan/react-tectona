import { apiFetch, tectonaServiceHeaders } from './httpClient'
import { serviceApiBase } from './gatewayBase'

const BASE_URL = import.meta.env.DEV
  ? '/api/workflow-automation'
  : serviceApiBase('/api/workflow-automation')

export type AgentCatalogEntryDto = {
  agent_ref: string
  display_name: string
  agent_type: 'general' | 'knowledge' | 'operational' | 'composite'
  runtime: string
  external_ref?: string | null
  description: string
  capabilities: string[]
  required_permissions: string[]
  workspace_id?: string | null
  enabled: boolean
}

export type AgentWorkflowGraph = { nodes: unknown[]; edges: unknown[] }
export type AgentWorkflowDto = {
  id: string
  name: string
  description: string
  workspace_id?: string | null
  status: 'Draft' | 'Active' | 'Paused' | 'Failed'
  version: number
  is_published: boolean
  definition: AgentWorkflowGraph
  created_date: string
  updated_date?: string | null
}
export type AgentWorkflowSummaryDto = Omit<AgentWorkflowDto, 'definition' | 'created_date'>
export type AgentWorkflowReviewDto = {
  id: string
  workflow_id: string
  candidate_version: number
  definition_checksum: string
  status: 'pending' | 'approved' | 'rejected'
  requested_by: string
  requested_at: string
  decided_by?: string | null
  decided_at?: string | null
  decision_note?: string | null
}
export type AgentWorkflowRunDto = {
  id: string
  workflow_id: string
  workflow_version: number
  status: 'queued' | 'running' | 'waiting_approval' | 'completed' | 'cancelled' | 'failed'
  input: Record<string, unknown>
  output?: { answer?: string | null; evidence?: Array<Record<string, unknown>>; warnings?: string[]; next_route?: string | null } | null
  created_date: string
  started_at?: string | null
  finished_at?: string | null
  steps: Array<{ id: string; node_id: string; agent_ref?: string | null; status: string; output: Record<string, unknown>; warnings: string[] }>
  actions: Array<{ id: string; node_id: string; agent_ref: string; action_code: string; status: string; idempotency_key: string; payload: Record<string, unknown>; result?: Record<string, unknown> | null; requested_by: string; approved_by?: string | null; rejection_reason?: string | null }>
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error((await response.text()) || `HTTP ${response.status}`)
  return response.json() as Promise<T>
}

const headers = () => tectonaServiceHeaders()
const endpoint = (path = '') => `${BASE_URL}/v1/agent-workflows${path}`

export async function listAgentCatalog(workspaceId?: string): Promise<AgentCatalogEntryDto[]> {
  const query = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ''
  return readJson(await apiFetch(`${endpoint('/catalog')}${query}`, { headers: headers() }))
}

export async function listAgentWorkflows(workspaceId?: string): Promise<AgentWorkflowSummaryDto[]> {
  const query = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ''
  return readJson(await apiFetch(`${endpoint()}${query}`, { headers: headers() }))
}

export async function getAgentWorkflow(id: string): Promise<AgentWorkflowDto> {
  return readJson(await apiFetch(endpoint(`/${encodeURIComponent(id)}`), { headers: headers() }))
}

export async function createAgentWorkflow(input: { name: string; description?: string; workspace_id?: string | null; definition: AgentWorkflowGraph }): Promise<AgentWorkflowDto> {
  return readJson(await apiFetch(endpoint(), { method: 'POST', headers: headers(), body: JSON.stringify(input) }))
}

export async function updateAgentWorkflow(id: string, patch: Partial<Pick<AgentWorkflowDto, 'name' | 'description' | 'definition' | 'status'>>): Promise<AgentWorkflowDto> {
  return readJson(await apiFetch(endpoint(`/${encodeURIComponent(id)}`), { method: 'PUT', headers: headers(), body: JSON.stringify(patch) }))
}

export async function publishAgentWorkflow(id: string): Promise<AgentWorkflowDto> {
  return readJson(await apiFetch(endpoint(`/${encodeURIComponent(id)}/publish`), { method: 'POST', headers: headers() }))
}

export async function listAgentWorkflowReviews(id: string): Promise<AgentWorkflowReviewDto[]> {
  return readJson(await apiFetch(endpoint(`/${encodeURIComponent(id)}/reviews`), { headers: headers() }))
}

export async function requestAgentWorkflowReview(id: string): Promise<AgentWorkflowReviewDto> {
  return readJson(await apiFetch(endpoint(`/${encodeURIComponent(id)}/reviews`), { method: 'POST', headers: headers() }))
}

export async function approveAgentWorkflowReview(id: string): Promise<AgentWorkflowReviewDto> {
  return readJson(await apiFetch(endpoint(`/reviews/${encodeURIComponent(id)}/approve`), { method: 'POST', headers: headers() }))
}

export async function rejectAgentWorkflowReview(id: string, note?: string): Promise<AgentWorkflowReviewDto> {
  const query = note ? `?note=${encodeURIComponent(note)}` : ''
  return readJson(await apiFetch(endpoint(`/reviews/${encodeURIComponent(id)}/reject${query}`), { method: 'POST', headers: headers() }))
}

export async function deleteAgentWorkflow(id: string): Promise<void> {
  const response = await apiFetch(endpoint(`/${encodeURIComponent(id)}`), { method: 'DELETE', headers: headers() })
  if (!response.ok && response.status !== 404) throw new Error((await response.text()) || `HTTP ${response.status}`)
}

export async function runAgentWorkflow(id: string, message: string): Promise<AgentWorkflowRunDto> {
  return readJson(await apiFetch(endpoint(`/${encodeURIComponent(id)}/run`), {
    method: 'POST', headers: headers(), body: JSON.stringify({ message }),
  }))
}

export async function approveAgentWorkflowAction(actionId: string): Promise<AgentWorkflowRunDto> {
  return readJson(await apiFetch(endpoint(`/actions/${encodeURIComponent(actionId)}/approve`), { method: 'POST', headers: headers() }))
}

export async function rejectAgentWorkflowAction(actionId: string, reason?: string): Promise<AgentWorkflowRunDto> {
  const query = reason ? `?reason=${encodeURIComponent(reason)}` : ''
  return readJson(await apiFetch(endpoint(`/actions/${encodeURIComponent(actionId)}/reject${query}`), { method: 'POST', headers: headers() }))
}
