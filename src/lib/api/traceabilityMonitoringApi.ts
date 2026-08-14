/**
 * Traceability & Monitoring API client.
 * Uses python-tectona-activity-lineage-service-fastapi (http://localhost:8435).
 * In development, Vite proxies /api/tectona-activity -> localhost:8435
 * (set VITE_TECTONA_ACTIVITY_API_URL to override).
 *
 * Scope note (Federated Capability Charter): this client talks to a
 * business/PM activity + entity-lineage store, NOT a log/metric observability
 * SoR (that is Salix/Acerra). Platform Health here is a thin read-only
 * summary — see PlatformHealthPage for the Salix deep-link.
 */

import { resolveWorkspaceApiId } from '@/lib/tenantWorkspaceScope'
import { serviceApiBase } from './gatewayBase'
import { apiFetch, parseApiErrorMessage, tectonaServiceHeaders } from './httpClient'

const BASE_URL = serviceApiBase('/api/tectona-activity', import.meta.env.VITE_TECTONA_ACTIVITY_API_URL)

export interface RelatedRefApi {
  type: string
  id: string
  label?: string | null
}

export interface ActivityApi {
  id: string
  workspace_id: string
  actor_id: string
  actor_email?: string | null
  action: string
  entity_type: string
  entity_id: string
  entity_label?: string | null
  occurred_at: string
  correlation_id?: string | null
  related: RelatedRefApi[]
  metadata: Record<string, unknown>
  created_by: string
  created_date: string
  created_from: string
}

export interface ActivityListResponse {
  items: ActivityApi[]
  total: number
  page: number
  page_size: number
}

export interface LineageNodeApi {
  id: string
  type: string
  label: string
  data: Record<string, unknown>
}

export interface LineageEdgeApi {
  id: string
  source: string
  target: string
  relation: string
}

export interface LineageGraphResponse {
  nodes: LineageNodeApi[]
  edges: LineageEdgeApi[]
  truncated: boolean
}

export interface LineageNeighborsResponse {
  node: LineageNodeApi
  incoming: LineageEdgeApi[]
  outgoing: LineageEdgeApi[]
  neighbors: LineageNodeApi[]
}

export interface PlatformHealthServiceStatus {
  service: string
  status: 'up' | 'degraded' | 'down'
  http_status: number | null
  latency_ms: number
}

export interface PlatformHealthSummaryResponse {
  services: PlatformHealthServiceStatus[]
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(parseApiErrorMessage(text, `HTTP ${res.status}`))
  }
  return res.json() as Promise<T>
}

function scopedServiceHeaders(workspaceId?: string | null): HeadersInit {
  const resolved = resolveWorkspaceApiId(workspaceId)
  return tectonaServiceHeaders(resolved ? { 'X-Workspace-Id': resolved } : undefined)
}

export interface FetchActivitiesParams {
  workspaceId?: string | null
  actorId?: string
  action?: string
  entityType?: string
  entityId?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export async function fetchActivities(params: FetchActivitiesParams): Promise<ActivityListResponse> {
  const workspaceId = resolveWorkspaceApiId(params.workspaceId)
  if (!workspaceId) return { items: [], total: 0, page: params.page ?? 1, page_size: params.pageSize ?? 20 }

  const sp = new URLSearchParams()
  sp.set('workspace_id', workspaceId)
  if (params.actorId) sp.set('actor_id', params.actorId)
  if (params.action) sp.set('action', params.action)
  if (params.entityType) sp.set('entity_type', params.entityType)
  if (params.entityId) sp.set('entity_id', params.entityId)
  if (params.from) sp.set('from', params.from)
  if (params.to) sp.set('to', params.to)
  sp.set('page', String(params.page ?? 1))
  sp.set('page_size', String(params.pageSize ?? 20))

  const res = await apiFetch(`${BASE_URL}/v1/activities?${sp}`, {
    headers: scopedServiceHeaders(params.workspaceId),
  })
  return handleResponse<ActivityListResponse>(res)
}

export async function fetchActivity(id: string): Promise<ActivityApi> {
  const res = await apiFetch(`${BASE_URL}/v1/activities/${id}`, { headers: tectonaServiceHeaders() })
  return handleResponse<ActivityApi>(res)
}

export interface CreateActivityPayload {
  workspace_id: string
  actor_id: string
  actor_email?: string
  action: string
  entity_type: string
  entity_id: string
  entity_label?: string
  correlation_id?: string
  related?: RelatedRefApi[]
  metadata?: Record<string, unknown>
}

export async function createActivity(payload: CreateActivityPayload): Promise<ActivityApi> {
  const res = await apiFetch(`${BASE_URL}/v1/activities`, {
    method: 'POST',
    headers: scopedServiceHeaders(payload.workspace_id),
    body: JSON.stringify(payload),
  })
  return handleResponse<ActivityApi>(res)
}

export interface FetchLineageGraphParams {
  workspaceId?: string | null
  rootType: string
  rootId: string
  depth?: number
}

export async function fetchLineageGraph(params: FetchLineageGraphParams): Promise<LineageGraphResponse> {
  const workspaceId = resolveWorkspaceApiId(params.workspaceId)
  if (!workspaceId) return { nodes: [], edges: [], truncated: false }

  const sp = new URLSearchParams()
  sp.set('workspace_id', workspaceId)
  sp.set('root_type', params.rootType)
  sp.set('root_id', params.rootId)
  if (params.depth) sp.set('depth', String(params.depth))

  const res = await apiFetch(`${BASE_URL}/v1/lineage/graph?${sp}`, {
    headers: scopedServiceHeaders(params.workspaceId),
  })
  return handleResponse<LineageGraphResponse>(res)
}

export async function fetchLineageNode(
  entityType: string,
  entityId: string,
  workspaceId?: string | null,
): Promise<LineageNeighborsResponse | null> {
  const resolved = resolveWorkspaceApiId(workspaceId)
  if (!resolved) return null

  const sp = new URLSearchParams()
  sp.set('workspace_id', resolved)
  const res = await apiFetch(
    `${BASE_URL}/v1/lineage/nodes/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}?${sp}`,
    { headers: scopedServiceHeaders(workspaceId) },
  )
  if (res.status === 404) return null
  return handleResponse<LineageNeighborsResponse>(res)
}

export async function fetchPlatformHealthSummary(): Promise<PlatformHealthSummaryResponse> {
  const res = await apiFetch(`${BASE_URL}/v1/health-summary`, { headers: tectonaServiceHeaders() })
  return handleResponse<PlatformHealthSummaryResponse>(res)
}
