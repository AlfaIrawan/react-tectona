/**
 * API client for Document Repository folders (document-knowledge service).
 * Distinct from the project-service `folderApi.ts` — these folders group DOCUMENTS, not projects.
 */
import { serviceApiBase } from './gatewayBase'
import { apiFetch } from './httpClient'

export interface DocumentFolder {
  id: string
  name: string
  description: string | null
  parent_id: string | null
  owner_id: string
  document_count: number
  children_count: number
  created_date: string
  updated_date: string | null
}

export interface DocumentFolderListResponse {
  folders: DocumentFolder[]
  total: number
  page: number
  page_size: number
}

export interface DocumentFolderTreeItem {
  id: string
  name: string
  description: string | null
  parent_id: string | null
  document_count: number
  children: DocumentFolderTreeItem[]
}

export interface CreateDocumentFolderPayload {
  name: string
  description?: string | null
  parent_id?: string | null
  owner_id?: string | null
}

export interface UpdateDocumentFolderPayload {
  name?: string
  description?: string | null
  parent_id?: string | null
}

function getV1Base(): string {
  const env = import.meta.env.VITE_DOCUMENT_KNOWLEDGE_API_URL?.trim()
  const base = (env || serviceApiBase('/api/document-knowledge', undefined)).replace(/\/+$/, '')
  return /\/v1$/i.test(base) ? base : `${base}/v1`
}

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Actor-Id': 'react-tectona-ui' }

async function handleJson<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!res.ok) {
    let detail = text
    try {
      const parsed = JSON.parse(text) as { detail?: unknown; error?: { message?: string } }
      if (typeof parsed.detail === 'string') detail = parsed.detail
      else if (typeof parsed.error?.message === 'string') detail = parsed.error.message
    } catch {
      // keep raw text
    }
    throw new Error(detail || `HTTP ${res.status}`)
  }
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export async function createDocumentFolder(payload: CreateDocumentFolderPayload): Promise<DocumentFolder> {
  const res = await apiFetch(`${getV1Base()}/folders`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      name: payload.name,
      description: payload.description ?? null,
      parent_id: payload.parent_id ?? null,
      owner_id: payload.owner_id ?? null,
    }),
  })
  return handleJson<DocumentFolder>(res)
}

export async function fetchDocumentFolders(params?: {
  owner_id?: string
  parent_id?: string | null
  include_all?: boolean
  page?: number
  page_size?: number
}): Promise<DocumentFolderListResponse> {
  const sp = new URLSearchParams()
  if (params?.owner_id) sp.set('owner_id', params.owner_id)
  if (params?.parent_id !== undefined) sp.set('parent_id', params.parent_id === null ? 'null' : params.parent_id)
  if (params?.include_all) sp.set('include_all', 'true')
  sp.set('page', String(params?.page ?? 1))
  sp.set('page_size', String(params?.page_size ?? 200))
  const res = await apiFetch(`${getV1Base()}/folders?${sp.toString()}`, { headers: { Accept: 'application/json' } })
  return handleJson<DocumentFolderListResponse>(res)
}

/** All folders (every level), for building a tree / grouping client-side. */
export async function fetchAllDocumentFolders(): Promise<DocumentFolder[]> {
  const res = await fetchDocumentFolders({ include_all: true, page: 1, page_size: 500 })
  return res.folders
}

export async function fetchDocumentFolderTree(owner_id?: string): Promise<DocumentFolderTreeItem[]> {
  const sp = new URLSearchParams()
  if (owner_id) sp.set('owner_id', owner_id)
  const q = sp.toString()
  const res = await apiFetch(`${getV1Base()}/folders/tree${q ? `?${q}` : ''}`, { headers: { Accept: 'application/json' } })
  return handleJson<DocumentFolderTreeItem[]>(res)
}

export async function getDocumentFolder(id: string): Promise<DocumentFolder | null> {
  try {
    const res = await apiFetch(`${getV1Base()}/folders/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } })
    return await handleJson<DocumentFolder>(res)
  } catch (error) {
    if (error instanceof Error && /HTTP 404|not found/i.test(error.message)) return null
    throw error
  }
}

export async function updateDocumentFolder(id: string, payload: UpdateDocumentFolderPayload): Promise<DocumentFolder> {
  const res = await apiFetch(`${getV1Base()}/folders/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  })
  return handleJson<DocumentFolder>(res)
}

export async function deleteDocumentFolder(id: string): Promise<void> {
  const res = await apiFetch(`${getV1Base()}/folders/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json', 'X-Actor-Id': 'react-tectona-ui' },
  })
  await handleJson<void>(res)
}
