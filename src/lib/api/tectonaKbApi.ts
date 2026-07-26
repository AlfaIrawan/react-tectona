/**
 * Tectona Knowledge Base service API (python-tectona-knowledge-base-service-fastapi).
 * OpenAPI: GET/POST /api/tectona-kb/v1/entries
 *
 * Dev: Vite proxies /api/tectona-kb → http://localhost:8415 (see vite.config.ts).
 * Atur base URL lengkap di Platform Settings → Knowledge Base untuk override browser.
 */

import { readKbConfig } from '@/lib/kb/kbConfig'
import { convertPipeTablesToHtml } from '@/lib/kb/pipeTableToHtml'
import { serviceApiBase } from './gatewayBase'
import { apiFetch, tectonaServiceHeaders } from './httpClient'

export const KB_CATEGORIES = [
  { value: 'platform_context', label: 'Platform context' },
  { value: 'org_structure', label: 'Org structure' },
  { value: 'stakeholders', label: 'Stakeholders' },
  { value: 'domain_glossary', label: 'Domain glossary' },
  { value: 'strategic_priorities', label: 'Strategic priorities' },
  { value: 'business_rules', label: 'Business rules' },
] as const

export type KbCategoryValue = (typeof KB_CATEGORIES)[number]['value']

export interface KbEntryResponse {
  id: string
  category: string
  title: string
  content: string
  is_active: boolean
  priority: number
  workspace_id: string | null
  department_id: string | null
  department_name_snapshot: string | null
  division_id: string | null
  division_name_snapshot: string | null
  owner_department_id: string | null
  audience_departments: string[]
  visibility_scope: 'public' | 'internal' | 'restricted'
  created_at: string
  updated_at: string
}

export interface KbEntryListResponse {
  items: KbEntryResponse[]
  total: number
  page: number
  page_size: number
}

export interface KbEntryVersionResponse {
  id: string
  entry_id: string
  version_no: number
  category: string
  title: string
  content: string
  is_active: boolean
  priority: number
  workspace_id: string | null
  department_id: string | null
  department_name_snapshot: string | null
  division_id: string | null
  division_name_snapshot: string | null
  owner_department_id: string | null
  audience_departments: string[]
  visibility_scope: 'public' | 'internal' | 'restricted'
  change_type: string
  created_at: string
}

export interface KbEntryVersionListResponse {
  items: KbEntryVersionResponse[]
  total: number
}

export interface KbEntryCreateBody {
  category: string
  title: string
  content: string
  is_active?: boolean
  priority?: number
  workspace_id?: string | null
  department_id?: string | null
  department_name_snapshot?: string | null
  division_id?: string | null
  division_name_snapshot?: string | null
  owner_department_id?: string | null
  audience_departments?: string[]
  visibility_scope?: 'public' | 'internal' | 'restricted'
}

export interface KbSourceEntryUpsertBody {
  source_system: string
  source_entity_type: string
  source_entity_ref: string
  source_parent_ref?: string | null
  category: string
  title: string
  content: string
  is_active?: boolean
  priority?: number
  workspace_id?: string | null
  visibility_scope?: 'public' | 'internal' | 'restricted'
}

export interface KbSourceEntryUpsertResponse {
  entry: KbEntryResponse
  created: boolean
  relations_created: number
  relations_skipped: number
  missing_targets: string[]
}

export interface KbWorkspaceMirrorDeleteResponse {
  workspace_id: string
  deleted_count: number
}

export interface KbOrgDepartmentResponse {
  department_id: string
  department_name: string
  source_system: string
  external_hr_ref: string | null
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface KbOrgDepartmentUpsertBody {
  department_id: string
  department_name: string
  source_system?: string
  external_hr_ref?: string | null
  is_active?: boolean
  display_order?: number
}

export interface KbOrgDivisionResponse {
  division_id: string
  division_name: string
  department_id: string
  source_system: string
  external_hr_ref: string | null
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface KbOrgDivisionUpsertBody {
  division_id: string
  division_name: string
  department_id: string
  source_system?: string
  external_hr_ref?: string | null
  is_active?: boolean
  display_order?: number
}

export const KB_PREDICATES = [
  { value: 'defines', label: 'defines' },
  { value: 'references', label: 'references' },
  { value: 'supports', label: 'supports' },
  { value: 'depends_on', label: 'depends_on' },
  { value: 'related_to', label: 'related_to' },
  { value: 'same_as', label: 'same_as' },
] as const

export type KbPredicateValue = string

export interface KbRelationResponse {
  id: string
  source_entry_id: string
  predicate: string
  target_entry_id: string
  workspace_id: string | null
  properties: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface KbRelationListResponse {
  items: KbRelationResponse[]
  total: number
}

export interface KbRelationCreateBody {
  source_entry_id: string
  predicate: string
  target_entry_id: string
  workspace_id?: string | null
  properties?: Record<string, unknown>
}

export interface KbRelationPatchBody {
  predicate?: string
  target_entry_id?: string
  workspace_id?: string | null
  properties?: Record<string, unknown>
}

function getV1Base(): string {
  const env = import.meta.env.VITE_TECTONA_KB_API_URL?.trim()
  if (env) return env.replace(/\/+$/, '')

  const cfg = readKbConfig()
  if (cfg.baseUrl.trim()) {
    const base = cfg.baseUrl.trim().replace(/\/+$/, '')
    // Platform Settings stores gateway prefix ending in /api/tectona-kb — do not append twice.
    if (base.endsWith('/api/tectona-kb')) {
      return `${base}/v1`
    }
    return `${base}/api/tectona-kb/v1`
  }
  // Same-origin — nginx/Vite proxy /api/tectona-kb → :8415
  return '/api/tectona-kb/v1'
}

async function handleJson<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!res.ok) {
    let detail = text
    try {
      const j = JSON.parse(text) as { detail?: unknown }
      detail = typeof j.detail === 'string' ? j.detail : text
    } catch {
      /* keep text */
    }
    throw new Error(detail || `HTTP ${res.status}`)
  }
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export async function getKbEntry(entryId: string): Promise<KbEntryResponse> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/entries/${encodeURIComponent(entryId)}`, {
    headers: tectonaServiceHeaders(),
  })
  return handleJson<KbEntryResponse>(res)
}

export async function listKbEntries(params?: {
  category?: KbCategoryValue
  workspace_id?: string
  department_id?: string
  division_id?: string
  visibility_scope?: 'public' | 'internal' | 'restricted'
  is_active?: boolean
  page?: number
  page_size?: number
}): Promise<KbEntryListResponse> {
  const base = getV1Base()
  const sp = new URLSearchParams()
  if (params?.category) sp.set('category', params.category)
  if (params?.workspace_id) sp.set('workspace_id', params.workspace_id)
  if (params?.department_id) sp.set('department_id', params.department_id)
  if (params?.division_id) sp.set('division_id', params.division_id)
  if (params?.visibility_scope) sp.set('visibility_scope', params.visibility_scope)
  if (params?.is_active !== undefined) sp.set('is_active', String(params.is_active))
  sp.set('page', String(params?.page ?? 1))
  sp.set('page_size', String(params?.page_size ?? 50))
  const q = sp.toString()
  const res = await apiFetch(`${base}/entries${q ? `?${q}` : ''}`, {
    headers: tectonaServiceHeaders(),
  })
  return handleJson<KbEntryListResponse>(res)
}

/** Load all KB entries (paginated) for overview graph and tables. */
export async function listAllKbEntries(params?: {
  category?: KbCategoryValue
  workspace_id?: string
  department_id?: string
  division_id?: string
  visibility_scope?: 'public' | 'internal' | 'restricted'
  is_active?: boolean
}): Promise<{ items: KbEntryResponse[]; total: number }> {
  const pageSize = 200
  const all: KbEntryResponse[] = []
  let total = 0
  let page = 1

  while (page <= 50) {
    const res = await listKbEntries({ ...params, page, page_size: pageSize })
    total = res.total
    all.push(...res.items)
    if (all.length >= total || res.items.length < pageSize) {
      break
    }
    page += 1
  }

  return { items: all, total }
}

/**
 * Create a KB entry and report whether the server actually created it or returned an existing
 * duplicate. The KB service responds 201 on create and 200 when content matched an existing entry
 * (server-side content dedup), so `deduplicated` reflects that without relying on custom headers.
 */
export async function createKbEntryChecked(
  body: KbEntryCreateBody,
): Promise<{ entry: KbEntryResponse; deduplicated: boolean }> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/entries`, {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({
      category: body.category,
      title: body.title,
      content: convertPipeTablesToHtml(body.content),
      is_active: body.is_active ?? true,
      priority: body.priority ?? 0,
      workspace_id: body.workspace_id ?? null,
      department_id: body.department_id ?? null,
      department_name_snapshot: body.department_name_snapshot ?? null,
      division_id: body.division_id ?? null,
      division_name_snapshot: body.division_name_snapshot ?? null,
      owner_department_id: body.owner_department_id ?? null,
      audience_departments: body.audience_departments ?? [],
      visibility_scope: body.visibility_scope ?? 'internal',
    }),
  })
  const deduplicated = res.status === 200
  const entry = await handleJson<KbEntryResponse>(res)
  return { entry, deduplicated }
}

export async function createKbEntry(body: KbEntryCreateBody): Promise<KbEntryResponse> {
  return (await createKbEntryChecked(body)).entry
}

export async function upsertKbSourceEntry(body: KbSourceEntryUpsertBody): Promise<KbSourceEntryUpsertResponse> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/entries/source-upsert`, {
    method: 'POST',
    headers: tectonaServiceHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  return handleJson<KbSourceEntryUpsertResponse>(res)
}

export async function deleteKbWorkspaceMirror(workspaceId: string): Promise<KbWorkspaceMirrorDeleteResponse> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/entries/workspace-mirror-delete`, {
    method: 'POST',
    headers: tectonaServiceHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ workspace_id: workspaceId }),
  })
  return handleJson<KbWorkspaceMirrorDeleteResponse>(res)
}

export interface KbEntryPatchBody {
  title?: string
  category?: string
  content?: string
  is_active?: boolean
  priority?: number
  workspace_id?: string | null
  department_id?: string | null
  department_name_snapshot?: string | null
  division_id?: string | null
  division_name_snapshot?: string | null
  owner_department_id?: string | null
  audience_departments?: string[]
  visibility_scope?: 'public' | 'internal' | 'restricted'
}

export async function patchKbEntry(entryId: string, body: KbEntryPatchBody): Promise<KbEntryResponse> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/entries/${entryId}`, {
    method: 'PATCH',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(body),
  })
  return handleJson<KbEntryResponse>(res)
}

export async function listKbEntryVersions(entryId: string): Promise<KbEntryVersionListResponse> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/entries/${entryId}/versions`, {
  })
  return handleJson<KbEntryVersionListResponse>(res)
}

export async function rollbackKbEntry(entryId: string, versionNo: number): Promise<KbEntryResponse> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/entries/${entryId}/rollback/${versionNo}`, {
    method: 'POST',
  })
  return handleJson<KbEntryResponse>(res)
}

export async function deleteKbEntry(entryId: string): Promise<void> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/entries/${entryId}`, { method: 'DELETE' })
  await handleJson<void>(res)
}

export async function listKbRelations(params?: {
  entry_id?: string
  direction?: 'any' | 'out' | 'in'
  workspace_id?: string
  page?: number
  page_size?: number
}): Promise<KbRelationListResponse> {
  const base = getV1Base()
  const sp = new URLSearchParams()
  if (params?.entry_id) sp.set('entry_id', params.entry_id)
  if (params?.direction) sp.set('direction', params.direction)
  if (params?.workspace_id) sp.set('workspace_id', params.workspace_id)
  sp.set('page', String(params?.page ?? 1))
  sp.set('page_size', String(params?.page_size ?? 100))
  const q = sp.toString()
  const res = await apiFetch(`${base}/relations${q ? `?${q}` : ''}`, {
    headers: tectonaServiceHeaders(),
  })
  return handleJson<KbRelationListResponse>(res)
}

export async function createKbRelation(body: KbRelationCreateBody): Promise<KbRelationResponse> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/relations`, {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({
      source_entry_id: body.source_entry_id,
      predicate: body.predicate,
      target_entry_id: body.target_entry_id,
      workspace_id: body.workspace_id ?? null,
      properties: body.properties ?? {},
    }),
  })
  return handleJson<KbRelationResponse>(res)
}

export async function deleteKbRelation(relationId: string): Promise<void> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/relations/${relationId}`, { method: 'DELETE' })
  await handleJson<void>(res)
}

export async function patchKbRelation(relationId: string, body: KbRelationPatchBody): Promise<KbRelationResponse> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/relations/${relationId}`, {
    method: 'PATCH',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(body),
  })
  return handleJson<KbRelationResponse>(res)
}

export async function listKbDepartments(params?: { active_only?: boolean }): Promise<KbOrgDepartmentResponse[]> {
  const base = getV1Base()
  const sp = new URLSearchParams()
  if (params?.active_only !== undefined) sp.set('active_only', String(params.active_only))
  const q = sp.toString()
  const res = await apiFetch(`${base}/org/departments${q ? `?${q}` : ''}`, {
    headers: tectonaServiceHeaders(),
  })
  return handleJson<KbOrgDepartmentResponse[]>(res)
}

export async function upsertKbDepartment(body: KbOrgDepartmentUpsertBody): Promise<KbOrgDepartmentResponse> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/org/departments`, {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(body),
  })
  return handleJson<KbOrgDepartmentResponse>(res)
}

export async function listKbDivisions(params?: { department_id?: string; active_only?: boolean }): Promise<KbOrgDivisionResponse[]> {
  const base = getV1Base()
  const sp = new URLSearchParams()
  if (params?.department_id) sp.set('department_id', params.department_id)
  if (params?.active_only !== undefined) sp.set('active_only', String(params.active_only))
  const q = sp.toString()
  const res = await apiFetch(`${base}/org/divisions${q ? `?${q}` : ''}`, {
    headers: tectonaServiceHeaders(),
  })
  return handleJson<KbOrgDivisionResponse[]>(res)
}

export async function upsertKbDivision(body: KbOrgDivisionUpsertBody): Promise<KbOrgDivisionResponse> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/org/divisions`, {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(body),
  })
  return handleJson<KbOrgDivisionResponse>(res)
}
