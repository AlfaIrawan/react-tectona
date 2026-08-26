/**
 * Project service API client.
 * Uses python-project-service-fastapi (http://localhost:8500).
 * In development, Vite proxies /api/project-service -> localhost:8500 (set VITE_PROJECT_API_URL to override).
 */

import { getSession } from '@/auth/authService'
import { resolveWorkspaceApiId } from '@/lib/tenantWorkspaceScope'
import { serviceApiBase } from './gatewayBase'
import { apiFetch, tectonaServiceHeaders } from './httpClient'

const BASE_URL = serviceApiBase('/api/project-service', import.meta.env.VITE_PROJECT_API_URL)

/** App GUID for Tectona project-context requests (shared service tenancy). */
export const TECTONA_PROJECT_APP_ID = '00000000-0000-0000-0000-000000000941'

export type ProjectStatus = 'active' | 'archived'

export interface ProjectApi {
  id: string
  workspace_id?: string | null
  name: string
  description: string | null
  status_id: string
  status_code: string
  owner_id: string
  owner_name: string
  created_by: string
  created_date: string
  created_from: string
  updated_by: string | null
  updated_date: string | null
  updated_from: string | null
  tags: string[]
  icon_name: string | null
  border_color: string | null
  folder_id: string | null
  folder_name: string | null
  members: {
    user_id: string
    display_name: string
    role_code: string
    role_name: string
  }[]
}

export interface ProjectListResponse {
  projects: ProjectApi[]
  total: number
  page: number
  page_size: number
}

const activeStatusId = '550e8400-e29b-41d4-a716-446655440101'
const archivedStatusId = '550e8400-e29b-41d4-a716-446655440102'
const dummyOwnerId = '00000000-0000-0000-0000-000000000001'

function scopedServiceHeaders(workspaceId?: string | null): HeadersInit {
  const resolved = resolveWorkspaceApiId(workspaceId)
  return tectonaServiceHeaders(resolved ? { 'X-Workspace-Id': resolved } : undefined)
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

const PROJECT_LIST_MAX_PAGE_SIZE = 100

export async function fetchProjects(params?: {
  page?: number
  page_size?: number
  status_id?: string
  folder_id?: string | null
  app_id?: string
  workspace_id?: string | null
}): Promise<ProjectListResponse> {
  const sp = new URLSearchParams()
  sp.set('page', String(params?.page ?? 1))
  sp.set(
    'page_size',
    String(Math.min(params?.page_size ?? PROJECT_LIST_MAX_PAGE_SIZE, PROJECT_LIST_MAX_PAGE_SIZE))
  )
  if (params?.app_id) sp.set('app_id', params.app_id)
  if (params?.status_id) sp.set('status_id', params.status_id)
  const workspaceId = resolveWorkspaceApiId(params?.workspace_id)
  if (workspaceId) sp.set('workspace_id', workspaceId)
  if (params?.folder_id !== undefined) {
    sp.set('folder_id', params.folder_id === null ? 'null' : params.folder_id)
  }
  const res = await apiFetch(`${BASE_URL}/v1/projects?${sp}`, {
    headers: scopedServiceHeaders(params?.workspace_id),
  })
  return handleResponse<ProjectListResponse>(res)
}

/** Loads all project pages (API caps page_size at 100). */
export async function fetchAllProjects(params?: {
  status_id?: string
  folder_id?: string | null
  app_id?: string
  workspace_id?: string | null
}): Promise<ProjectApi[]> {
  const page_size = PROJECT_LIST_MAX_PAGE_SIZE
  const all: ProjectApi[] = []
  let page = 1
  let total = Number.POSITIVE_INFINITY

  while (all.length < total) {
    const res = await fetchProjects({ ...params, page, page_size })
    all.push(...res.projects)
    total = res.total
    if (res.projects.length < page_size) break
    page += 1
  }

  return all
}

export async function fetchProject(id: string): Promise<ProjectApi | null> {
  const sp = new URLSearchParams()
  sp.set('app_id', TECTONA_PROJECT_APP_ID)
  const res = await apiFetch(`${BASE_URL}/v1/projects/${id}?${sp}`)
  if (res.status === 404) return null
  return handleResponse<ProjectApi>(res)
}

export interface CreateProjectPayload {
  name: string
  description?: string
  tags?: string[]
  icon_name?: string
  border_color?: string
  folder_id?: string | null
  workspace_id?: string | null
}

export async function createProject(payload: CreateProjectPayload): Promise<ProjectApi> {
  const sp = new URLSearchParams()
  sp.set('app_id', TECTONA_PROJECT_APP_ID)
  const workspaceId = resolveWorkspaceApiId(payload.workspace_id)
  if (workspaceId) sp.set('workspace_id', workspaceId)
  const session = getSession()
  const ownerId = session?.user.id ?? dummyOwnerId
  const res = await apiFetch(`${BASE_URL}/v1/projects?${sp}`, {
    method: 'POST',
    headers: scopedServiceHeaders(payload.workspace_id),
    body: JSON.stringify({
      name: payload.name,
      description: payload.description ?? null,
      status_id: activeStatusId,
      owner_id: ownerId,
      tags: payload.tags ?? [],
      icon_name: payload.icon_name ?? null,
      border_color: payload.border_color ?? null,
      folder_id: payload.folder_id ?? null,
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
    }),
  })
  return handleResponse<ProjectApi>(res)
}

export interface UpdateProjectPayload {
  name?: string
  description?: string
  status_id?: string
  tags?: string[]
  icon_name?: string
  border_color?: string
  folder_id?: string | null
  workspace_id?: string | null
}

export async function updateProject(id: string, payload: UpdateProjectPayload): Promise<ProjectApi> {
  const sp = new URLSearchParams()
  sp.set('app_id', TECTONA_PROJECT_APP_ID)
  const res = await apiFetch(`${BASE_URL}/v1/projects/${id}?${sp}`, {
    method: 'PUT',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse<ProjectApi>(res)
}

export async function archiveProject(id: string): Promise<ProjectApi> {
  return updateProject(id, { status_id: archivedStatusId })
}

export async function deleteProject(id: string): Promise<void> {
  const sp = new URLSearchParams()
  sp.set('app_id', TECTONA_PROJECT_APP_ID)
  const res = await apiFetch(`${BASE_URL}/v1/projects/${id}?${sp}`, { method: 'DELETE' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
}

export type ProjectMemberRoleCode = 'admin' | 'member' | 'viewer'

export interface ProjectMemberPayload {
  user_id: string
  role_code: ProjectMemberRoleCode
}

function projectQueryParams(): URLSearchParams {
  const sp = new URLSearchParams()
  sp.set('app_id', TECTONA_PROJECT_APP_ID)
  return sp
}

export async function addProjectMember(
  projectId: string,
  payload: ProjectMemberPayload,
): Promise<ProjectApi> {
  const sp = projectQueryParams()
  const res = await apiFetch(`${BASE_URL}/v1/projects/${projectId}/members?${sp}`, {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse<ProjectApi>(res)
}

export async function removeProjectMember(projectId: string, userId: string): Promise<ProjectApi> {
  const sp = projectQueryParams()
  const res = await apiFetch(`${BASE_URL}/v1/projects/${projectId}/members/${userId}?${sp}`, {
    method: 'DELETE',
    headers: tectonaServiceHeaders(),
  })
  return handleResponse<ProjectApi>(res)
}

export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  roleCode: ProjectMemberRoleCode,
): Promise<ProjectApi> {
  const sp = projectQueryParams()
  const res = await apiFetch(`${BASE_URL}/v1/projects/${projectId}/members/${userId}?${sp}`, {
    method: 'PATCH',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({ role_code: roleCode }),
  })
  return handleResponse<ProjectApi>(res)
}
