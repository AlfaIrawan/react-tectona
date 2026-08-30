/**
 * Idea Backlog folder API client.
 * Uses python-idea-backlog-service-fastapi (http://localhost:8511).
 */

import { resolveWorkspaceApiId } from '@/lib/tenantWorkspaceScope'
import { serviceApiBase } from './gatewayBase'
import { apiFetch, parseApiErrorMessage, tectonaServiceHeaders } from './httpClient'

const BASE_URL = serviceApiBase('/api/idea-backlog', import.meta.env.VITE_IDEA_BACKLOG_API_URL)

const dummyOwnerId = '00000000-0000-0000-0000-000000000001'

export interface IdeaFolderApi {
  id: string
  workspace_id?: string | null
  name: string
  description: string | null
  owner_id: string
  parent_id: string | null
  border_color?: string | null
  idea_count: number
  children_count: number
  members?: {
    user_id: string
    display_name: string
    role_code: string
    role_name: string
  }[]
  created_by: string
  created_date: string
  created_from: string
  updated_by: string | null
  updated_date: string | null
  updated_from: string | null
}

export interface IdeaFolderListResponse {
  folders: IdeaFolderApi[]
  total: number
  page: number
  page_size: number
}

function scopedServiceHeaders(workspaceId?: string | null): HeadersInit {
  const resolved = resolveWorkspaceApiId(workspaceId)
  return tectonaServiceHeaders(resolved ? { 'X-Workspace-Id': resolved } : undefined)
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(parseApiErrorMessage(text, `HTTP ${res.status}`))
  }
  return res.json() as Promise<T>
}

const FOLDER_LIST_MAX_PAGE_SIZE = 100

export async function fetchIdeaFolders(params?: {
  page?: number
  page_size?: number
  owner_id?: string
  parent_id?: string | null
  workspace_id?: string | null
}): Promise<IdeaFolderListResponse> {
  const sp = new URLSearchParams()
  sp.set('page', String(params?.page ?? 1))
  sp.set(
    'page_size',
    String(Math.min(params?.page_size ?? FOLDER_LIST_MAX_PAGE_SIZE, FOLDER_LIST_MAX_PAGE_SIZE)),
  )
  if (params?.owner_id) sp.set('owner_id', params.owner_id)
  const workspaceId = resolveWorkspaceApiId(params?.workspace_id)
  if (workspaceId) sp.set('workspace_id', workspaceId)
  if (params?.parent_id !== undefined) {
    sp.set('parent_id', params.parent_id === null ? 'null' : params.parent_id)
  }
  const res = await apiFetch(`${BASE_URL}/v1/folders?${sp}`, {
    headers: scopedServiceHeaders(params?.workspace_id),
  })
  return handleResponse<IdeaFolderListResponse>(res)
}

export async function fetchAllIdeaFolders(params?: {
  owner_id?: string
  parent_id?: string | null
  workspace_id?: string | null
}): Promise<IdeaFolderApi[]> {
  const page_size = FOLDER_LIST_MAX_PAGE_SIZE
  const all: IdeaFolderApi[] = []
  let page = 1
  let total = Number.POSITIVE_INFINITY

  while (all.length < total) {
    const res = await fetchIdeaFolders({ ...params, page, page_size })
    all.push(...res.folders)
    total = res.total
    if (res.folders.length < page_size) break
    page += 1
  }

  return all
}

export async function fetchIdeaFolder(id: string): Promise<IdeaFolderApi | null> {
  const res = await apiFetch(`${BASE_URL}/v1/folders/${id}`)
  if (res.status === 404) return null
  return handleResponse<IdeaFolderApi>(res)
}

export interface CreateIdeaFolderPayload {
  name: string
  description?: string
  parent_id?: string | null
  owner_id?: string
  workspace_id?: string | null
  border_color?: string | null
}

export async function createIdeaFolder(payload: CreateIdeaFolderPayload): Promise<IdeaFolderApi> {
  const workspaceId = resolveWorkspaceApiId(payload.workspace_id)
  const res = await apiFetch(`${BASE_URL}/v1/folders`, {
    method: 'POST',
    headers: scopedServiceHeaders(payload.workspace_id),
    body: JSON.stringify({
      name: payload.name,
      description: payload.description ?? null,
      parent_id: payload.parent_id ?? null,
      owner_id: payload.owner_id ?? dummyOwnerId,
      border_color: payload.border_color ?? null,
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
    }),
  })
  return handleResponse<IdeaFolderApi>(res)
}

export interface UpdateIdeaFolderPayload {
  name?: string
  description?: string
  parent_id?: string | null
  border_color?: string | null
}

export async function updateIdeaFolder(id: string, payload: UpdateIdeaFolderPayload): Promise<IdeaFolderApi> {
  const res = await apiFetch(`${BASE_URL}/v1/folders/${id}`, {
    method: 'PUT',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse<IdeaFolderApi>(res)
}

export async function deleteIdeaFolder(id: string): Promise<void> {
  const res = await apiFetch(`${BASE_URL}/v1/folders/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(parseApiErrorMessage(text, `HTTP ${res.status}`))
  }
}

/** Same role vocabulary as Projects folders (owner reserved, admin/member/viewer assignable). */
export type IdeaFolderMemberRoleCode = 'admin' | 'member' | 'viewer'

export interface IdeaFolderMemberPayload {
  user_id: string
  role_code: IdeaFolderMemberRoleCode
}

export async function addIdeaFolderMember(
  folderId: string,
  payload: IdeaFolderMemberPayload,
): Promise<IdeaFolderApi> {
  const res = await apiFetch(`${BASE_URL}/v1/folders/${folderId}/members`, {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse<IdeaFolderApi>(res)
}

export async function removeIdeaFolderMember(folderId: string, userId: string): Promise<IdeaFolderApi> {
  const res = await apiFetch(`${BASE_URL}/v1/folders/${folderId}/members/${userId}`, {
    method: 'DELETE',
    headers: tectonaServiceHeaders(),
  })
  return handleResponse<IdeaFolderApi>(res)
}

export async function updateIdeaFolderMemberRole(
  folderId: string,
  userId: string,
  roleCode: IdeaFolderMemberRoleCode,
): Promise<IdeaFolderApi> {
  const res = await apiFetch(`${BASE_URL}/v1/folders/${folderId}/members/${userId}`, {
    method: 'PATCH',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({ role_code: roleCode }),
  })
  return handleResponse<IdeaFolderApi>(res)
}

export { dummyOwnerId as IDEA_BACKLOG_FOLDER_DUMMY_OWNER_ID }
