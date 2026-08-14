/**
 * Folder service API client.
 * Uses python-project-service-fastapi (http://localhost:8500).
 * In development, Vite proxies /api/project-service -> localhost:8500 (set VITE_PROJECT_API_URL to override).
 */

import { resolveWorkspaceApiId } from '@/lib/tenantWorkspaceScope'
import { serviceApiBase } from './gatewayBase'
import { apiFetch, parseApiErrorMessage, tectonaServiceHeaders } from './httpClient'

const BASE_URL = serviceApiBase('/api/project-service', import.meta.env.VITE_PROJECT_API_URL)

const dummyOwnerId = '00000000-0000-0000-0000-000000000001'

export interface FolderApi {
  id: string
  workspace_id?: string | null
  name: string
  description: string | null
  owner_id: string
  parent_id: string | null
  created_by: string
  created_date: string
  created_from: string
  updated_by: string | null
  updated_date: string | null
  updated_from: string | null
  project_count: number
  children_count: number
  members: {
    user_id: string
    display_name: string
    role_code: string
    role_name: string
  }[]
}

export interface FolderListResponse {
  folders: FolderApi[]
  total: number
  page: number
  page_size: number
}

export interface FolderTreeItem {
  id: string
  name: string
  description: string | null
  parent_id: string | null
  project_count: number
  children: FolderTreeItem[]
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

export async function fetchFolders(params?: {
  page?: number
  page_size?: number
  owner_id?: string
  parent_id?: string | null
  workspace_id?: string | null
}): Promise<FolderListResponse> {
  const sp = new URLSearchParams()
  sp.set('page', String(params?.page ?? 1))
  sp.set(
    'page_size',
    String(Math.min(params?.page_size ?? FOLDER_LIST_MAX_PAGE_SIZE, FOLDER_LIST_MAX_PAGE_SIZE))
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
  return handleResponse<FolderListResponse>(res)
}

/** Loads all folder pages (program/portfolio grouping from project-service). */
export async function fetchAllFolders(params?: {
  owner_id?: string
  parent_id?: string | null
  workspace_id?: string | null
}): Promise<FolderApi[]> {
  const page_size = FOLDER_LIST_MAX_PAGE_SIZE
  const all: FolderApi[] = []
  let page = 1
  let total = Number.POSITIVE_INFINITY

  while (all.length < total) {
    const res = await fetchFolders({ ...params, page, page_size })
    all.push(...res.folders)
    total = res.total
    if (res.folders.length < page_size) break
    page += 1
  }

  return all
}

export async function fetchFolder(id: string): Promise<FolderApi | null> {
  const res = await apiFetch(`${BASE_URL}/v1/folders/${id}`)
  if (res.status === 404) return null
  return handleResponse<FolderApi>(res)
}

export async function fetchFolderTree(owner_id?: string): Promise<FolderTreeItem[]> {
  const sp = new URLSearchParams()
  if (owner_id) sp.set('owner_id', owner_id)
  const res = await apiFetch(`${BASE_URL}/v1/folders/tree?${sp}`)
  return handleResponse<FolderTreeItem[]>(res)
}

export interface CreateFolderPayload {
  name: string
  description?: string
  parent_id?: string | null
  owner_id?: string
  workspace_id?: string | null
}

export async function createFolder(payload: CreateFolderPayload): Promise<FolderApi> {
  const workspaceId = resolveWorkspaceApiId(payload.workspace_id)
  const res = await apiFetch(`${BASE_URL}/v1/folders`, {
    method: 'POST',
    headers: scopedServiceHeaders(payload.workspace_id),
    body: JSON.stringify({
      name: payload.name,
      description: payload.description ?? null,
      parent_id: payload.parent_id ?? null,
      owner_id: payload.owner_id ?? dummyOwnerId,
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
    }),
  })
  return handleResponse<FolderApi>(res)
}

export interface UpdateFolderPayload {
  name?: string
  description?: string
  parent_id?: string | null
}

export async function updateFolder(id: string, payload: UpdateFolderPayload): Promise<FolderApi> {
  const res = await apiFetch(`${BASE_URL}/v1/folders/${id}`, {
    method: 'PUT',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse<FolderApi>(res)
}

export async function deleteFolder(id: string): Promise<void> {
  const res = await apiFetch(`${BASE_URL}/v1/folders/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(parseApiErrorMessage(text, `HTTP ${res.status}`))
  }
}

/** Same role vocabulary as projects (owner reserved, admin/member/viewer assignable). */
export type FolderMemberRoleCode = 'admin' | 'member' | 'viewer'

export interface FolderMemberPayload {
  user_id: string
  role_code: FolderMemberRoleCode
}

export async function addFolderMember(
  folderId: string,
  payload: FolderMemberPayload,
): Promise<FolderApi> {
  const res = await apiFetch(`${BASE_URL}/v1/folders/${folderId}/members`, {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse<FolderApi>(res)
}

export async function removeFolderMember(folderId: string, userId: string): Promise<FolderApi> {
  const res = await apiFetch(`${BASE_URL}/v1/folders/${folderId}/members/${userId}`, {
    method: 'DELETE',
    headers: tectonaServiceHeaders(),
  })
  return handleResponse<FolderApi>(res)
}

export async function updateFolderMemberRole(
  folderId: string,
  userId: string,
  roleCode: FolderMemberRoleCode,
): Promise<FolderApi> {
  const res = await apiFetch(`${BASE_URL}/v1/folders/${folderId}/members/${userId}`, {
    method: 'PATCH',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({ role_code: roleCode }),
  })
  return handleResponse<FolderApi>(res)
}
