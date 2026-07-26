/**
 * Workspace Org Service API client.
 * Integrates with python-workspace-org-service-fastapi (default http://localhost:8424).
 * Dev: Vite proxies `/api/workspace-org` → backend root (see vite.config.ts).
 */

import { serviceApiBase } from './gatewayBase'
import { apiFetch, tectonaServiceHeaders } from './httpClient'

const BASE_URL = serviceApiBase('/api/workspace-org', import.meta.env.VITE_WORKSPACE_ORG_API_URL)

function orgMutationHeaders(opts?: {
  actorId?: string
  correlationId?: string
  idempotencyKey?: string
}): Headers {
  const extra: Record<string, string> = {}
  if (opts?.actorId) extra['X-Actor-Id'] = opts.actorId
  if (opts?.correlationId) extra['X-Correlation-Id'] = opts.correlationId
  if (opts?.idempotencyKey) extra['Idempotency-Key'] = opts.idempotencyKey
  return new Headers(tectonaServiceHeaders(extra))
}

export interface WorkspaceOrgOrganizationDto {
  id: string
  organization_code: string
  name: string
  description: string | null
  status_code: string
  external_org_ref: string | null
  metadata: Record<string, unknown>
  version: number
  created_date: string
  updated_date: string | null
}

export interface WorkspaceOrgOrganizationListResponse {
  items: WorkspaceOrgOrganizationDto[]
  total: number
  page: number
  page_size: number
}

export interface WorkspaceOrgOrganizationCreatePayload {
  organization_code: string
  name: string
  description?: string | null
  status_code?: 'active' | 'inactive' | 'archived'
  external_org_ref?: string | null
  metadata?: Record<string, unknown>
}

export interface WorkspaceOrgWorkspaceDto {
  id: string
  organization_id: string
  organization_code: string
  organization_name: string
  workspace_key: string
  name: string
  description: string | null
  status_code: string
  external_workspace_ref: string | null
  metadata: Record<string, unknown>
  version: number
  created_date: string
  updated_date: string | null
}

export interface WorkspaceOrgWorkspaceListResponse {
  items: WorkspaceOrgWorkspaceDto[]
  total: number
  page: number
  page_size: number
}

export interface WorkspaceOrgWorkspaceCreatePayload {
  organization_id: string
  workspace_key: string
  name: string
  description?: string | null
  status_code?: 'active' | 'inactive' | 'archived'
  external_workspace_ref?: string | null
  metadata?: Record<string, unknown>
}

/** Backend workspace-org uses `error.message`; stock FastAPI uses `detail`. */
async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    // IMPORTANT: response body can only be read once; always read as text first.
    const raw = await res.text().catch(() => '')
    let detail = ''
    if (raw) {
      try {
        const body = JSON.parse(raw) as Record<string, unknown>
        if (typeof body?.detail === 'string') detail = body.detail
        else if (Array.isArray(body?.detail))
          detail = body.detail.map((x: { msg?: string }) => x?.msg ?? JSON.stringify(x)).join('; ')
        else if (body?.detail != null) detail = JSON.stringify(body.detail)
        if (!detail) {
          const err = body?.error as { message?: unknown } | undefined
          if (err?.message != null) {
            detail = typeof err.message === 'string' ? err.message : JSON.stringify(err.message)
          }
        }
      } catch {
        detail = raw
      }
    }
    throw new Error(detail || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

function workspaceOrgUrl(path: string): string {
  const base = BASE_URL.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  if (!base) return p
  return `${base}${p}`
}

/** Service caps page_size at 200 (`le=200` on list endpoints). */
const WORKSPACE_ORG_MAX_PAGE_SIZE = 200

export async function fetchWorkspaceOrgOrganizations(params?: {
  page?: number
  page_size?: number
  status?: string
}): Promise<WorkspaceOrgOrganizationListResponse> {
  const page = params?.page ?? 1
  const page_size = Math.min(params?.page_size ?? WORKSPACE_ORG_MAX_PAGE_SIZE, WORKSPACE_ORG_MAX_PAGE_SIZE)
  const sp = new URLSearchParams()
  sp.set('page', String(page))
  sp.set('page_size', String(page_size))
  if (params?.status) sp.set('status', params.status)
  const res = await apiFetch(workspaceOrgUrl(`/v1/organizations?${sp}`))
  return handleJson<WorkspaceOrgOrganizationListResponse>(res)
}

export interface WorkspaceOrgOrganizationPatchPayload {
  name?: string
  description?: string | null
  status_code?: 'active' | 'inactive' | 'archived'
  external_org_ref?: string | null
  metadata?: Record<string, unknown>
  version: number
}

export interface WorkspaceOrgWorkspaceTypeDto {
  id: string
  type_code: string
  label: string
  sort_order: number
  is_active: boolean
  version: number
  created_date: string
  updated_date: string | null
}

export interface WorkspaceOrgWorkspaceTypeListResponse {
  items: WorkspaceOrgWorkspaceTypeDto[]
  total: number
}

export async function fetchWorkspaceOrgWorkspaceTypes(): Promise<WorkspaceOrgWorkspaceTypeListResponse> {
  const res = await apiFetch(workspaceOrgUrl('/v1/workspace-types'))
  return handleJson<WorkspaceOrgWorkspaceTypeListResponse>(res)
}

export async function createWorkspaceOrgWorkspaceType(
  payload: { type_code: string; label: string; sort_order?: number },
  headers?: { actorId?: string }
): Promise<WorkspaceOrgWorkspaceTypeDto> {
  const res = await apiFetch(workspaceOrgUrl('/v1/workspace-types'), {
    method: 'POST',
    headers: orgMutationHeaders(headers),
    body: JSON.stringify(payload),
  })
  return handleJson<WorkspaceOrgWorkspaceTypeDto>(res)
}

export async function patchWorkspaceOrgWorkspaceType(
  typeId: string,
  payload: { label?: string; sort_order?: number; is_active?: boolean; version: number },
  headers?: { actorId?: string }
): Promise<WorkspaceOrgWorkspaceTypeDto> {
  const res = await apiFetch(workspaceOrgUrl(`/v1/workspace-types/${typeId}`), {
    method: 'PATCH',
    headers: orgMutationHeaders(headers),
    body: JSON.stringify(payload),
  })
  return handleJson<WorkspaceOrgWorkspaceTypeDto>(res)
}

export async function deleteWorkspaceOrgWorkspaceType(typeId: string): Promise<void> {
  const res = await apiFetch(workspaceOrgUrl(`/v1/workspace-types/${typeId}`), {
    method: 'DELETE',
  })
  if (!res.ok && res.status !== 204) {
    const raw = await res.text().catch(() => '')
    throw new Error(raw || `HTTP ${res.status}`)
  }
}

export async function patchWorkspaceOrgOrganization(
  organizationId: string,
  payload: WorkspaceOrgOrganizationPatchPayload,
  headers?: { actorId?: string; correlationId?: string }
): Promise<WorkspaceOrgOrganizationDto> {
  const res = await apiFetch(workspaceOrgUrl(`/v1/organizations/${organizationId}`), {
    method: 'PATCH',
    headers: orgMutationHeaders(headers),
    body: JSON.stringify(payload),
  })
  return handleJson<WorkspaceOrgOrganizationDto>(res)
}

export async function createWorkspaceOrgOrganization(
  payload: WorkspaceOrgOrganizationCreatePayload,
  headers?: { actorId?: string; correlationId?: string; idempotencyKey?: string }
): Promise<WorkspaceOrgOrganizationDto> {
  const h = new Headers({ 'Content-Type': 'application/json' })
  if (headers?.actorId) h.set('X-Actor-Id', headers.actorId)
  if (headers?.correlationId) h.set('X-Correlation-Id', headers.correlationId)
  if (headers?.idempotencyKey) h.set('Idempotency-Key', headers.idempotencyKey)
  const res = await apiFetch(workspaceOrgUrl('/v1/organizations'), {
    method: 'POST',
    headers: h,
    body: JSON.stringify({
      organization_code: payload.organization_code,
      name: payload.name,
      description: payload.description ?? null,
      status_code: payload.status_code ?? 'active',
      external_org_ref: payload.external_org_ref ?? null,
      metadata: payload.metadata ?? {},
    }),
  })
  return handleJson<WorkspaceOrgOrganizationDto>(res)
}

export async function fetchWorkspaceOrgWorkspaces(params?: {
  page?: number
  page_size?: number
  organization_id?: string
  status?: string
}): Promise<WorkspaceOrgWorkspaceListResponse> {
  const page = params?.page ?? 1
  const page_size = Math.min(params?.page_size ?? WORKSPACE_ORG_MAX_PAGE_SIZE, WORKSPACE_ORG_MAX_PAGE_SIZE)
  const sp = new URLSearchParams()
  sp.set('page', String(page))
  sp.set('page_size', String(page_size))
  if (params?.organization_id) sp.set('organization_id', params.organization_id)
  if (params?.status) sp.set('status', params.status)
  const res = await apiFetch(workspaceOrgUrl(`/v1/workspaces?${sp}`))
  return handleJson<WorkspaceOrgWorkspaceListResponse>(res)
}

/**
 * Loads all workspace rows by paging (API `page_size` is capped at {@link WORKSPACE_ORG_MAX_PAGE_SIZE}).
 */
export async function fetchAllWorkspaceOrgWorkspaces(params?: {
  organization_id?: string
  status?: string
}): Promise<WorkspaceOrgWorkspaceDto[]> {
  const items: WorkspaceOrgWorkspaceDto[] = []
  let page = 1
  const page_size = WORKSPACE_ORG_MAX_PAGE_SIZE
  while (true) {
    const res = await fetchWorkspaceOrgWorkspaces({
      ...params,
      page,
      page_size,
    })
    items.push(...res.items)
    if (res.items.length === 0 || items.length >= res.total) break
    page += 1
    if (page > 500) break
  }
  return items
}

export async function createWorkspaceOrgWorkspace(
  payload: WorkspaceOrgWorkspaceCreatePayload,
  headers?: { actorId?: string; correlationId?: string; idempotencyKey?: string }
): Promise<WorkspaceOrgWorkspaceDto> {
  const res = await apiFetch(workspaceOrgUrl('/v1/workspaces'), {
    method: 'POST',
    headers: orgMutationHeaders(headers),
    body: JSON.stringify({
      organization_id: payload.organization_id,
      workspace_key: payload.workspace_key,
      name: payload.name,
      description: payload.description ?? null,
      status_code: payload.status_code ?? 'active',
      external_workspace_ref: payload.external_workspace_ref ?? null,
      metadata: payload.metadata ?? {},
    }),
  })
  return handleJson<WorkspaceOrgWorkspaceDto>(res)
}

export interface WorkspaceOrgWorkspacePatchPayload {
  name?: string
  description?: string | null
  status_code?: 'active' | 'inactive' | 'archived'
  external_workspace_ref?: string | null
  metadata?: Record<string, unknown>
  version: number
}

export async function patchWorkspaceOrgWorkspace(
  workspaceId: string,
  payload: WorkspaceOrgWorkspacePatchPayload,
  headers?: { actorId?: string; correlationId?: string }
): Promise<WorkspaceOrgWorkspaceDto> {
  const res = await apiFetch(workspaceOrgUrl(`/v1/workspaces/${workspaceId}`), {
    method: 'PATCH',
    headers: orgMutationHeaders(headers),
    body: JSON.stringify(payload),
  })
  return handleJson<WorkspaceOrgWorkspaceDto>(res)
}

export async function deleteWorkspaceOrgWorkspace(
  workspaceId: string,
  headers?: { actorId?: string; correlationId?: string }
): Promise<void> {
  const res = await apiFetch(workspaceOrgUrl(`/v1/workspaces/${workspaceId}`), {
    method: 'DELETE',
    headers: orgMutationHeaders(headers),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
}
