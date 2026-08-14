/**
 * Work Management service API (python-work-management-service-fastapi).
 * Dev: Vite proxies /api/work → http://localhost:8432
 */

import { apiFetch, tectonaServiceHeaders } from './httpClient'

// Origin only — the `/api/work` route prefix lives in each endpoint path below.
// Dev: empty so calls are same-origin and Vite proxies `/api/work` → :8432.
export const WORK_API_BASE = (
  (import.meta.env.VITE_WORK_API_URL as string | undefined) ?? ''
).replace(/\/$/, '')

/** Default workspace slug for Tectona project board & template seeds. */
export const TECTONA_PROJECT_WORKSPACE = 'Tectona Workspace'

function workWebSocketBaseUrl(): string {
  const override = (import.meta.env.VITE_WORK_API_URL as string | undefined)?.replace(/\/$/, '')
  if (override) return override
  // Same-origin — nginx/Vite proxy /api/work → :8432
  return '/api/work'
}

/** Dev: WS uses Vite proxy `/api/work` → work-management :8432. */
export function createWorkEventsWebSocketUrl(options?: { token?: string; workspace?: string }): string {
  const rawBase = workWebSocketBaseUrl()
  const url =
    rawBase.startsWith('http://') || rawBase.startsWith('https://')
      ? new URL(rawBase)
      : new URL(rawBase, window.location.origin)

  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/v1/ws/events`
  url.search = ''
  if (options?.workspace?.trim()) {
    url.searchParams.set('workspace', options.workspace.trim())
  }
  if (options?.token) {
    url.searchParams.set('token', options.token)
  }
  return url.toString()
}

export type WorkItemType = 'Epic' | 'Feature' | 'Task' | 'Subtask' | 'Checklist' | 'Bug'
export type WorkStatus = 'Backlog' | 'To Do' | 'In Progress' | 'In Review' | 'Done'
export type Priority = 'Critical' | 'High' | 'Medium' | 'Low'
export type ExternalProvider = 'monday' | 'jira' | 'asana'

export interface WorkItemExternalLink {
  provider: ExternalProvider
  external_id: string
  external_key?: string | null
  external_url?: string | null
  link_role: string
  last_synced_at?: string | null
}

export interface WorkItemApiModel {
  id: string
  title: string
  type: WorkItemType
  project: string
  workspace: string
  label?: string | null
  assignee: string
  owner: string
  role: string
  team: string
  reporter?: string | null
  labels?: string[]
  priority: Priority
  status: WorkStatus
  startDate?: string | null
  dueDate: string
  dependencyStatus: string
  progress: number
  estimatedHours: number
  actualHours: number
  lastUpdated: string
  version?: number
  epicId?: string | null
  featureId?: string | null
  parentId?: string | null
  description: string
  checklist?: { id: string; label: string; done: boolean }[]
  externalLinks?: WorkItemExternalLink[]
  syncOrigin?: string | null
}

export interface WorkItemListResponse {
  items: WorkItemApiModel[]
  total: number
  deleted?: string[]
  syncedAt?: string
}

export interface WorkItemCreateBody {
  title: string
  type: WorkItemType
  project?: string
  workspace: string
  assignee?: string
  team?: string
  reporter?: string
  labels?: string[]
  priority?: Priority
  status?: WorkStatus
  startDate?: string
  dueDate: string
  estimatedHours?: number
  description?: string
  parentId?: string | null
}

export interface WorkItemPatchBody {
  title?: string
  type?: WorkItemType
  project?: string
  workspace?: string
  label?: string
  assignee?: string
  team?: string
  reporter?: string
  labels?: string[]
  priority?: Priority
  status?: WorkStatus
  startDate?: string
  dueDate?: string
  estimatedHours?: number
  description?: string
  parentId?: string | null
  progress?: number
  dependencyStatus?: 'Clear' | 'Blocked' | 'At Risk'
  expectedVersion?: number
  syncOrigin?: string
  handoffFieldsToTectona?: string[]
}

export type WorkDependencyType = 'FS' | 'SS' | 'FF'
export type WorkDependencyState = 'Clear' | 'Blocked' | 'At Risk'

export interface WorkItemDependencyApiModel {
  id: string
  blockingId: string
  dependentId: string
  type: WorkDependencyType
  status: WorkDependencyState
  delayDays: number
}

export interface WorkItemDependencyListResponse {
  items: WorkItemDependencyApiModel[]
  total: number
}

export interface WorkItemDependencyCreateBody {
  blockingId: string
  dependentId: string
  type?: WorkDependencyType
  status?: WorkDependencyState
  delayDays?: number
}

export interface WorkItemDependencyPatchBody {
  type?: WorkDependencyType
  status?: WorkDependencyState
  delayDays?: number
}

export interface IntegrationProfileResponse {
  workspace: string
  profile_code: 'tectona_native' | 'federated_pm_dev'
  config: Record<string, unknown>
}

export class WorkItemVersionConflictError extends Error {
  readonly code = 'VERSION_CONFLICT'
  readonly current: WorkItemApiModel

  constructor(current: WorkItemApiModel) {
    super('Work item was modified elsewhere')
    this.name = 'WorkItemVersionConflictError'
    this.current = current
  }
}

function extractVersionConflictCurrent(payload: unknown): WorkItemApiModel | null {
  if (!payload || typeof payload !== 'object') return null

  const root = payload as Record<string, unknown>
  const detail = root.detail
  if (detail && typeof detail === 'object' && detail !== null && 'current' in detail) {
    const current = (detail as { current: unknown }).current
    if (current && typeof current === 'object' && current !== null && 'id' in current) {
      return current as WorkItemApiModel
    }
  }

  return null
}

/** Network / proxy failure — work service not reachable (distinct from HTTP 4xx/5xx business errors). */
export class WorkApiTransportError extends Error {
  readonly code = 'WORK_API_TRANSPORT'

  constructor(message = 'Work service unavailable', cause?: unknown) {
    super(message)
    this.name = 'WorkApiTransportError'
    if (cause !== undefined) {
      ;(this as Error & { cause?: unknown }).cause = cause
    }
  }
}

async function workApiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await apiFetch(input, init)
  } catch (error) {
    throw new WorkApiTransportError(
      error instanceof Error ? error.message : 'Work service unavailable',
      error,
    )
  }
}

function isProxyOrGatewayFailure(status: number, body: string, contentType: string): boolean {
  if (status >= 502) return true
  if (status === 500 && (!body.trim() || !contentType.includes('json'))) return true
  return false
}

async function parseJson<T>(response: Response): Promise<T> {
  if (response.status === 409) {
    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      throw new Error('Version conflict')
    }
    const current = extractVersionConflictCurrent(payload)
    if (current) {
      throw new WorkItemVersionConflictError(current)
    }
    throw new Error('Version conflict')
  }

  if (!response.ok) {
    const text = await response.text()
    const contentType = response.headers.get('content-type') ?? ''
    if (isProxyOrGatewayFailure(response.status, text, contentType)) {
      throw new WorkApiTransportError(`Work service unavailable (${response.status})`)
    }
    throw new Error(text || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export async function listWorkItems(params?: {
  workspace?: string
  project?: string
  updatedSince?: string
}): Promise<WorkItemListResponse> {
  const query = new URLSearchParams()
  if (params?.workspace) query.set('workspace', params.workspace)
  if (params?.project) query.set('project', params.project)
  if (params?.updatedSince) query.set('updated_since', params.updatedSince)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const response = await workApiFetch(`${WORK_API_BASE}/api/work/v1/work-items${suffix}`, {
    headers: tectonaServiceHeaders(),
  })
  return parseJson<WorkItemListResponse>(response)
}

export async function createWorkItem(body: WorkItemCreateBody): Promise<WorkItemApiModel> {
  const response = await workApiFetch(`${WORK_API_BASE}/api/work/v1/work-items`, {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(body),
  })
  return parseJson<WorkItemApiModel>(response)
}

export async function getWorkItem(businessKey: string): Promise<WorkItemApiModel> {
  const response = await workApiFetch(
    `${WORK_API_BASE}/api/work/v1/work-items/${encodeURIComponent(businessKey)}`,
    { headers: tectonaServiceHeaders() }
  )
  return parseJson<WorkItemApiModel>(response)
}

export async function batchPatchWorkItems(body: {
  ids: string[]
  status?: WorkStatus
  assignee?: string
  priority?: Priority
}): Promise<{
  updated: WorkItemApiModel[]
  failed: Array<{ id: string; message: string }>
}> {
  const response = await workApiFetch(`${WORK_API_BASE}/api/work/v1/work-items/batch-patch`, {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(body),
  })
  return parseJson(response)
}

export async function patchWorkItem(
  businessKey: string,
  body: WorkItemPatchBody
): Promise<WorkItemApiModel> {
  const response = await workApiFetch(`${WORK_API_BASE}/api/work/v1/work-items/${encodeURIComponent(businessKey)}`, {
    method: 'PATCH',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(body),
  })
  return parseJson<WorkItemApiModel>(response)
}

export async function deleteWorkItem(businessKey: string): Promise<{ id: string; deleted: number }> {
  const response = await workApiFetch(`${WORK_API_BASE}/api/work/v1/work-items/${encodeURIComponent(businessKey)}`, {
    method: 'DELETE',
    headers: tectonaServiceHeaders(),
  })
  return parseJson<{ id: string; deleted: number }>(response)
}

/** Move an item (and its descendants) to a Tectona workspace; keeps external links,
 *  hands workspace ownership to Tectona so inbound sync won't revert the move. */
export async function moveWorkItemWorkspace(
  businessKey: string,
  workspace: string,
): Promise<{ workspace: string; moved: string[]; count: number }> {
  const response = await workApiFetch(
    `${WORK_API_BASE}/api/work/v1/work-items/${encodeURIComponent(businessKey)}/move-workspace`,
    {
      method: 'POST',
      headers: tectonaServiceHeaders(),
      body: JSON.stringify({ workspace }),
    },
  )
  return parseJson<{ workspace: string; moved: string[]; count: number }>(response)
}

export async function getIntegrationProfile(workspaceSlug: string): Promise<IntegrationProfileResponse> {
  const response = await workApiFetch(
    `${WORK_API_BASE}/api/work/v1/workspaces/${encodeURIComponent(workspaceSlug)}/integration-profile`,
    { headers: tectonaServiceHeaders() }
  )
  return parseJson<IntegrationProfileResponse>(response)
}

export interface ProjectTemplateSeedBody {
  templateCode: string
  projectId: string
  projectName: string
  workspace?: string
  assignee?: string
  anchorDate?: string
}

export interface ProjectTemplateSeedResponse {
  seeded: boolean
  templateCode: string
  total: number
  items: WorkItemApiModel[]
}

/** Clone Kanban (or other) template work items into Postgres for a new project. */
export async function seedProjectFromTemplate(
  body: ProjectTemplateSeedBody,
): Promise<ProjectTemplateSeedResponse> {
  const response = await workApiFetch(`${WORK_API_BASE}/api/work/v1/internal/project-template-seed`, {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({
      templateCode: body.templateCode,
      projectId: body.projectId,
      projectName: body.projectName,
      workspace: body.workspace ?? TECTONA_PROJECT_WORKSPACE,
      assignee: body.assignee ?? 'Unassigned',
      anchorDate: body.anchorDate,
    }),
  })
  return parseJson<ProjectTemplateSeedResponse>(response)
}

export type InboxSourceChannel = 'team' | 'idea' | 'form' | 'system'
export type ArchiveReason = 'manual' | 'auto' | 'sample'

export interface ProjectInboxRouteApiModel {
  businessKey: string
  routedAt: string
  routedBy: string
  sourceTeam: string
  sourceChannel: InboxSourceChannel
  requestNote?: string | null
  status: 'pending' | 'declined'
}

export interface ProjectInboxListResponse {
  items: ProjectInboxRouteApiModel[]
  total: number
}

export interface ProjectArchivedWorkItemApiModel {
  businessKey: string
  archivedAt: string
  archivedBy: string
  reason: ArchiveReason
}

export interface ProjectArchivedWorkItemListResponse {
  items: ProjectArchivedWorkItemApiModel[]
  total: number
}

export async function listProjectInboxRoutes(projectId: string): Promise<ProjectInboxListResponse> {
  const response = await workApiFetch(
    `${WORK_API_BASE}/api/work/v1/projects/${encodeURIComponent(projectId)}/inbox`,
    { headers: tectonaServiceHeaders() },
  )
  return parseJson<ProjectInboxListResponse>(response)
}

export async function acceptProjectInboxItem(projectId: string, businessKey: string): Promise<void> {
  const response = await workApiFetch(
    `${WORK_API_BASE}/api/work/v1/projects/${encodeURIComponent(projectId)}/inbox/${encodeURIComponent(businessKey)}/accept`,
    { method: 'POST', headers: tectonaServiceHeaders() },
  )
  if (!response.ok && response.status !== 204) {
    await parseJson(response)
  }
}

export async function declineProjectInboxItem(
  projectId: string,
  businessKey: string,
  declinedBy: string,
): Promise<void> {
  const response = await workApiFetch(
    `${WORK_API_BASE}/api/work/v1/projects/${encodeURIComponent(projectId)}/inbox/${encodeURIComponent(businessKey)}/decline`,
    {
      method: 'POST',
      headers: tectonaServiceHeaders(),
      body: JSON.stringify({ declinedBy }),
    },
  )
  if (!response.ok && response.status !== 204) {
    await parseJson(response)
  }
}

export async function listProjectArchivedWorkItems(
  projectId: string,
): Promise<ProjectArchivedWorkItemListResponse> {
  const response = await workApiFetch(
    `${WORK_API_BASE}/api/work/v1/projects/${encodeURIComponent(projectId)}/archived-work-items`,
    { headers: tectonaServiceHeaders() },
  )
  return parseJson<ProjectArchivedWorkItemListResponse>(response)
}

export async function archiveProjectWorkItemApi(input: {
  projectId: string
  businessKey: string
  archivedBy: string
  reason?: ArchiveReason
}): Promise<void> {
  const response = await workApiFetch(
    `${WORK_API_BASE}/api/work/v1/projects/${encodeURIComponent(input.projectId)}/archived-work-items/${encodeURIComponent(input.businessKey)}`,
    {
      method: 'POST',
      headers: tectonaServiceHeaders(),
      body: JSON.stringify({
        archivedBy: input.archivedBy,
        reason: input.reason ?? 'manual',
      }),
    },
  )
  if (!response.ok && response.status !== 204) {
    await parseJson(response)
  }
}

export async function restoreProjectArchivedWorkItem(projectId: string, businessKey: string): Promise<void> {
  const response = await workApiFetch(
    `${WORK_API_BASE}/api/work/v1/projects/${encodeURIComponent(projectId)}/archived-work-items/${encodeURIComponent(businessKey)}/restore`,
    { method: 'POST', headers: tectonaServiceHeaders() },
  )
  if (!response.ok && response.status !== 204) {
    await parseJson(response)
  }
}

export async function listWorkItemDependencies(params?: {
  workspace?: string
}): Promise<WorkItemDependencyListResponse> {
  const query = new URLSearchParams()
  if (params?.workspace) query.set('workspace', params.workspace)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const response = await workApiFetch(`${WORK_API_BASE}/api/work/v1/dependencies${suffix}`, {
    headers: tectonaServiceHeaders(),
  })
  if (!response.ok) {
    await parseJson(response)
  }
  return (await response.json()) as WorkItemDependencyListResponse
}

export async function createWorkItemDependency(
  body: WorkItemDependencyCreateBody,
): Promise<WorkItemDependencyApiModel> {
  const response = await workApiFetch(`${WORK_API_BASE}/api/work/v1/dependencies`, {
    method: 'POST',
    headers: { ...tectonaServiceHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    await parseJson(response)
  }
  return (await response.json()) as WorkItemDependencyApiModel
}

export async function patchWorkItemDependency(
  dependencyId: string,
  body: WorkItemDependencyPatchBody,
): Promise<WorkItemDependencyApiModel> {
  const response = await workApiFetch(
    `${WORK_API_BASE}/api/work/v1/dependencies/${encodeURIComponent(dependencyId)}`,
    {
      method: 'PATCH',
      headers: { ...tectonaServiceHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  if (!response.ok) {
    await parseJson(response)
  }
  return (await response.json()) as WorkItemDependencyApiModel
}

export async function deleteWorkItemDependency(dependencyId: string): Promise<void> {
  const response = await workApiFetch(
    `${WORK_API_BASE}/api/work/v1/dependencies/${encodeURIComponent(dependencyId)}`,
    { method: 'DELETE', headers: tectonaServiceHeaders() },
  )
  if (!response.ok && response.status !== 204) {
    await parseJson(response)
  }
}

/** Map API model to page WorkItem shape (defaults for UI-only fields). */
export function mapApiWorkItemToPage(item: WorkItemApiModel) {
  // Accept legacy API field `board` during rename rollout (board_name → label_name).
  const directoryLabel =
    item.label ??
    (item as WorkItemApiModel & { board?: string | null }).board ??
    ''

  return {
    id: item.id,
    title: item.title,
    type: item.type,
    project: item.project,
    workspace: item.workspace,
    label: directoryLabel,
    assignee: item.assignee,
    owner: item.owner || item.assignee,
    role: item.role || 'Contributor',
    team: item.team,
    reporter: item.reporter ?? item.owner,
    labels: item.labels ?? [],
    priority: item.priority,
    status: item.status,
    startDate: item.startDate ?? undefined,
    dueDate: item.dueDate,
    dependencyStatus: (item.dependencyStatus as 'Clear' | 'Blocked' | 'At Risk') || 'Clear',
    progress: item.progress ?? 0,
    estimatedHours: item.estimatedHours ?? 0,
    actualHours: item.actualHours ?? 0,
    lastUpdated: item.lastUpdated,
    version: item.version ?? 1,
    epicId: item.epicId ?? undefined,
    featureId: item.featureId ?? undefined,
    parentId: item.parentId ?? undefined,
    description: item.description,
    checklist: item.checklist ?? [],
    externalLinks: item.externalLinks,
    syncOrigin: item.syncOrigin ?? undefined,
  }
}
