export interface DocumentContextLinkResponse {
  id: string
  link_type_code: string
  linked_entity_id: string
  linked_entity_name?: string | null
}

export interface DocumentResponse {
  id: string
  project_id: string
  workspace_id?: string | null
  title: string
  summary?: string | null
  document_type_code: string
  category_code: string
  capability_code?: string | null
  status_code: string
  template_id?: string | null
  folder_id?: string | null
  current_version_no: number
  metadata: Record<string, unknown>
  version: number
  tags: string[]
  access_scope_codes: string[]
  context_links: DocumentContextLinkResponse[]
  created_date: string
  updated_date?: string | null
  /** Present on some payloads (e.g. index snapshot); list endpoints usually omit it. */
  content?: string | null
}

export interface DocumentIndexSnapshotResponse {
  id: string
  project_id: string
  workspace_id?: string | null
  title: string
  summary?: string | null
  document_type_code: string
  category_code: string
  capability_code?: string | null
  status_code: string
  current_version_no: number
  content: string
  attachment_text?: string | null
  metadata: Record<string, unknown>
  updated_date?: string | null
}

export interface DocumentListResponse {
  items: DocumentResponse[]
  total: number
  page: number
  page_size: number
}

export interface DocumentContextLinkInput {
  link_type_code: string
  linked_entity_id: string
  linked_entity_name?: string | null
}

export interface DocumentCreateRequest {
  workspace_id?: string | null
  title: string
  summary?: string | null
  content: string
  document_type_code: string
  category_code: string
  capability_code?: string | null
  status_code?: string
  template_id?: string | null
  tags?: string[]
  access_scope_codes?: string[]
  context_links?: DocumentContextLinkInput[]
  metadata?: Record<string, unknown>
  version_notes?: string | null
  folder_id?: string | null
}

export interface DocumentCapabilityLookupItem {
  code: string
  name: string
  display_order?: number
  is_active?: boolean
}

export interface DocumentCapabilityLookupResponse {
  items: DocumentCapabilityLookupItem[]
}

export interface DocumentNoteResponse {
  id: string
  document_id: string
  title: string
  content: string
  note_type_code: string
  status_code: string
  metadata: Record<string, unknown>
  version: number
  created_date: string
  updated_date?: string | null
}

export interface DocumentAuditEntryResponse {
  id: string
  document_id?: string | null
  action_code: string
  actor_id?: string | null
  details: Record<string, unknown>
  correlation_id?: string | null
  created_date: string
}

export interface DocumentAttachmentResponse {
  id: string
  document_id: string
  file_name: string
  content_type: string
  file_size: number
  object_key: string
  etag?: string | null
  metadata: Record<string, unknown>
  created_date: string
}

export interface DocumentAttachmentDownloadResponse {
  attachment_id: string
  document_id: string
  file_name: string
  content_type: string
  download_url: string
  expires_in_seconds: number
}

import { serviceApiBase } from './gatewayBase'
import { actorHeaders, apiFetch, authHeaders, tectonaServiceHeaders } from './httpClient'

function getV1Base(): string {
  const env = import.meta.env.VITE_DOCUMENT_KNOWLEDGE_API_URL?.trim()
  if (env) return env.replace(/\/+$/, '')
  return `${serviceApiBase('/api/document-knowledge', import.meta.env.VITE_DOCUMENT_KNOWLEDGE_API_URL)}/v1`
}

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

function normalizeDocumentAttachmentList(payload: unknown): DocumentAttachmentResponse[] {
  if (Array.isArray(payload)) return payload as DocumentAttachmentResponse[]
  if (!payload || typeof payload !== 'object') return []

  const record = payload as Record<string, unknown>
  if (Array.isArray(record.items)) return record.items as DocumentAttachmentResponse[]
  if (Array.isArray(record.attachments)) return record.attachments as DocumentAttachmentResponse[]
  if (Array.isArray(record.data)) return record.data as DocumentAttachmentResponse[]
  return []
}

async function fetchDocumentAttachmentList(documentId: string, projectId?: string | null): Promise<DocumentAttachmentResponse[]> {
  const base = getV1Base()
  let primary: DocumentAttachmentResponse[] = []
  try {
    const res = await apiFetch(`${base}/documents/${encodeURIComponent(documentId)}/attachments`, {
      headers: { Accept: 'application/json' },
    })
    primary = normalizeDocumentAttachmentList(await handleJson<unknown>(res))
  } catch {
    primary = []
  }
  if (primary.length > 0 || !projectId) return primary

  const projectRes = await apiFetch(
    `${base}/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/attachments`,
    { headers: { Accept: 'application/json' } },
  )
  return normalizeDocumentAttachmentList(await handleJson<unknown>(projectRes))
}

function pickLatestAttachment(attachments: DocumentAttachmentResponse[]): DocumentAttachmentResponse | null {
  if (attachments.length === 0) return null
  return [...attachments].sort(
    (left, right) => new Date(right.created_date).getTime() - new Date(left.created_date).getTime(),
  )[0]
}

async function fetchAttachmentBlobFromUrl(
  downloadUrl: string,
  fileName: string,
  contentType: string,
): Promise<{ blob: Blob; fileName: string; contentType: string }> {
  const useAuthenticatedFetch = downloadUrl.startsWith('/api/') || downloadUrl.includes('/api/gateway-runtime/')
  const fileRes = useAuthenticatedFetch
    ? await apiFetch(downloadUrl, { headers: authHeaders({ Accept: '*/*' }) })
    : await fetch(downloadUrl, { credentials: 'omit' })
  if (!fileRes.ok) {
    throw new Error(`Failed to load attachment stream (HTTP ${fileRes.status}).`)
  }

  const responseType = fileRes.headers.get('content-type') ?? ''
  if (responseType.includes('application/json')) {
    const payload = JSON.parse(await fileRes.text()) as DocumentAttachmentDownloadResponse
    if (payload.download_url) {
      return fetchAttachmentBlobFromUrl(payload.download_url, payload.file_name || fileName, payload.content_type || contentType)
    }
    throw new Error('Download response did not include a file URL.')
  }

  const blob = await fileRes.blob()
  return {
    blob,
    fileName,
    contentType: contentType || blob.type || 'application/octet-stream',
  }
}

async function tryStreamAttachmentDownload(
  documentId: string,
  attachmentId: string,
): Promise<{ blob: Blob; fileName: string; contentType: string } | null> {
  const base = getV1Base()
  const streamPaths = [
    `${base}/documents/${encodeURIComponent(documentId)}/attachments/${encodeURIComponent(attachmentId)}/content`,
    `${base}/documents/${encodeURIComponent(documentId)}/attachments/${encodeURIComponent(attachmentId)}:download`,
    `${base}/documents/${encodeURIComponent(documentId)}/attachments/${encodeURIComponent(attachmentId)}/download`,
  ]

  for (const path of streamPaths) {
    try {
      const res = await apiFetch(path, {
        headers: authHeaders({ Accept: '*/*' }),
        redirect: 'follow',
      })
      if (!res.ok) continue

      const responseType = res.headers.get('content-type') ?? ''
      if (responseType.includes('application/json')) continue

      const blob = await res.blob()
      if (blob.size === 0) continue

      const disposition = res.headers.get('content-disposition') ?? ''
      const fileNameMatch = disposition.match(/filename=\"?([^\";]+)\"?/i)
      return {
        blob,
        fileName: fileNameMatch?.[1] ?? 'repository-document',
        contentType: responseType || blob.type || 'application/octet-stream',
      }
    } catch {
      continue
    }
  }

  return null
}

export async function listProjectDocuments(
  projectId: string,
  params?: {
    status?: string
    document_type?: string
    category?: string
    capability?: string
    capability_code?: string
    tag?: string
    access_scope?: string
    /** Folder UUID, or 'null'/'none' for documents not assigned to any folder. */
    folder_id?: string
    page?: number
    page_size?: number
  }
): Promise<DocumentListResponse> {
  const base = getV1Base()
  const sp = new URLSearchParams()
  if (params?.status) sp.set('status', params.status)
  if (params?.document_type) sp.set('document_type', params.document_type)
  if (params?.category) sp.set('category', params.category)
  if (params?.capability) sp.set('capability', params.capability)
  if (params?.capability_code) sp.set('capability_code', params.capability_code)
  if (params?.tag) sp.set('tag', params.tag)
  if (params?.access_scope) sp.set('access_scope', params.access_scope)
  if (params?.folder_id !== undefined) sp.set('folder_id', params.folder_id)
  sp.set('page', String(params?.page ?? 1))
  sp.set('page_size', String(params?.page_size ?? 100))
  const q = sp.toString()
  const res = await apiFetch(`${base}/projects/${encodeURIComponent(projectId)}/documents${q ? `?${q}` : ''}`, {
    headers: { Accept: 'application/json' },
  })
  return handleJson<DocumentListResponse>(res)
}

/**
 * List documents across ALL projects (incl. project-less / orphaned ones). Use for the
 * repository view so documents not tied to a valid project still appear (attributed to
 * "Unidentified Project" by the caller).
 */
export async function listAllDocuments(params?: {
  workspace_id?: string
  status?: string
  document_type?: string
  category?: string
  capability?: string
  capability_code?: string
  /** Folder UUID, or 'null'/'none' for documents not assigned to any folder. */
  folder_id?: string
  page?: number
  page_size?: number
}): Promise<DocumentListResponse> {
  const base = getV1Base()
  const sp = new URLSearchParams()
  if (params?.workspace_id) sp.set('workspace_id', params.workspace_id)
  if (params?.status) sp.set('status', params.status)
  if (params?.document_type) sp.set('document_type', params.document_type)
  if (params?.category) sp.set('category', params.category)
  if (params?.capability) sp.set('capability', params.capability)
  if (params?.capability_code) sp.set('capability_code', params.capability_code)
  if (params?.folder_id !== undefined) sp.set('folder_id', params.folder_id)
  sp.set('page', String(params?.page ?? 1))
  sp.set('page_size', String(params?.page_size ?? 100))
  const res = await apiFetch(`${base}/documents?${sp.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  return handleJson<DocumentListResponse>(res)
}

export async function listDocumentCapabilities(): Promise<DocumentCapabilityLookupResponse> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/lookups/capabilities`, {
    headers: { Accept: 'application/json' },
  })
  return handleJson<DocumentCapabilityLookupResponse>(res)
}

export async function createProjectDocument(projectId: string, body: DocumentCreateRequest): Promise<DocumentResponse> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/projects/${encodeURIComponent(projectId)}/documents`, {
    method: 'POST',
    headers: tectonaServiceHeaders({ Accept: 'application/json' }),
    body: JSON.stringify({
      workspace_id: body.workspace_id ?? null,
      title: body.title,
      summary: body.summary ?? null,
      content: body.content,
      document_type_code: body.document_type_code,
      category_code: body.category_code,
      capability_code: body.capability_code ?? null,
      status_code: body.status_code ?? 'draft',
      template_id: body.template_id ?? null,
      tags: body.tags ?? [],
      access_scope_codes: body.access_scope_codes ?? ['project_team'],
      context_links: body.context_links ?? [],
      metadata: body.metadata ?? {},
      version_notes: body.version_notes ?? null,
      folder_id: body.folder_id ?? null,
    }),
  })
  return handleJson<DocumentResponse>(res)
}

/**
 * Patch a document. `version` is required (optimistic lock) and the backend REPLACES the metadata
 * object wholesale, so callers must pass the full merged metadata. Pass `folder_id` (or null to
 * move to root) to change the document's folder. Pass `capability_code` (or null to clear).
 */
export async function patchDocument(
  documentId: string,
  body: {
    version: number
    metadata?: Record<string, unknown>
    title?: string
    summary?: string
    content?: string
    version_notes?: string
    folder_id?: string | null
    capability_code?: string | null
  },
): Promise<DocumentResponse> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/documents/${encodeURIComponent(documentId)}`, {
    method: 'PATCH',
    headers: tectonaServiceHeaders({ Accept: 'application/json' }),
    body: JSON.stringify(body),
  })
  return handleJson<DocumentResponse>(res)
}

export async function getDocument(documentId: string): Promise<DocumentResponse> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/documents/${encodeURIComponent(documentId)}`, {
    headers: { Accept: 'application/json' },
  })
  return handleJson<DocumentResponse>(res)
}

/** Current version body (+ metadata) for reading meeting notes / KB index text. */
export async function getDocumentIndexSnapshot(documentId: string): Promise<DocumentIndexSnapshotResponse> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/documents/${encodeURIComponent(documentId)}/index-snapshot`, {
    headers: { Accept: 'application/json' },
  })
  return handleJson<DocumentIndexSnapshotResponse>(res)
}

export async function listDocumentNotes(documentId: string): Promise<DocumentNoteResponse[]> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/documents/${encodeURIComponent(documentId)}/notes`, {
    headers: { Accept: 'application/json' },
  })
  return handleJson<DocumentNoteResponse[]>(res)
}

export async function listDocumentAudit(documentId: string, limit = 50): Promise<DocumentAuditEntryResponse[]> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/documents/${encodeURIComponent(documentId)}/audit?limit=${encodeURIComponent(String(limit))}`, {
    headers: { Accept: 'application/json' },
  })
  return handleJson<DocumentAuditEntryResponse[]>(res)
}

export async function listDocumentAttachments(
  documentId: string,
  projectId?: string | null,
): Promise<DocumentAttachmentResponse[]> {
  return fetchDocumentAttachmentList(documentId, projectId)
}

function humanizeAttachmentLoadError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  if (
    lower.includes('object storage')
    || lower.includes('minio')
    || lower === 'internal server error'
    || lower.includes('failed to read object')
    || lower.includes('failed to generate download')
    || lower.includes('failed to load attachment stream')
  ) {
    return 'Object storage (MinIO) is unavailable. Start the minio container, then reopen this revision.'
  }
  return message || 'Unable to load attachment for preview.'
}

export async function downloadDocumentAttachmentBlob(
  documentId: string,
  attachmentId: string,
): Promise<{ blob: Blob; fileName: string; contentType: string }> {
  const streamed = await tryStreamAttachmentDownload(documentId, attachmentId)
  if (streamed) return streamed

  try {
    const payload = await getDocumentAttachmentDownloadUrl(documentId, attachmentId)
    return await fetchAttachmentBlobFromUrl(
      payload.download_url,
      payload.file_name,
      payload.content_type,
    )
  } catch (error) {
    throw new Error(humanizeAttachmentLoadError(error))
  }
}

export async function resolveLatestDocumentAttachmentBlob(
  documentId: string,
  options?: {
    projectId?: string | null
    attachmentId?: string | null
    fileNameHint?: string | null
  },
): Promise<{ blob: Blob; fileName: string; contentType: string; attachmentId: string }> {
  if (options?.attachmentId) {
    const downloaded = await downloadDocumentAttachmentBlob(documentId, options.attachmentId)
    return {
      ...downloaded,
      fileName: downloaded.fileName || options.fileNameHint || 'repository-document',
      attachmentId: options.attachmentId,
    }
  }

  const attachments = await fetchDocumentAttachmentList(documentId, options?.projectId)
  const latest = pickLatestAttachment(attachments)
  if (!latest) {
    throw new Error('This document does not have an attachment file yet.')
  }

  const downloaded = await downloadDocumentAttachmentBlob(documentId, latest.id)
  return {
    blob: downloaded.blob,
    fileName: downloaded.fileName || latest.file_name || options?.fileNameHint || 'repository-document',
    contentType: downloaded.contentType || latest.content_type || 'application/octet-stream',
    attachmentId: latest.id,
  }
}

/**
 * Fetch an accurate PDF rendering of the document's latest attachment. The backend converts
 * Office documents to PDF via LibreOffice/Gotenberg and caches the result, so the preview
 * matches the original document exactly (pagination, tables split across pages, logos/headers).
 */
export async function fetchDocumentPreviewPdfBlob(
  documentId: string,
): Promise<{ blob: Blob; fileName: string }> {
  const base = getV1Base()
  const res = await apiFetch(
    `${base}/documents/${encodeURIComponent(documentId)}/preview-pdf`,
    // no-store: after an edit the URL is unchanged but the content differs (new version), so the
    // browser HTTP cache must never serve a stale PDF here.
    { headers: authHeaders({ Accept: 'application/pdf' }), redirect: 'follow', cache: 'no-store' },
  )
  if (!res.ok) {
    let detail = `Preview unavailable (HTTP ${res.status}).`
    try {
      const body = await res.json()
      if (body?.detail) detail = String(body.detail)
    } catch {
      // non-JSON error body — keep the default message
    }
    throw new Error(detail)
  }

  const blob = await res.blob()
  if (blob.size === 0) throw new Error('Preview document was empty.')

  const disposition = res.headers.get('content-disposition') ?? ''
  const fileNameMatch = disposition.match(/filename=\"?([^\";]+)\"?/i)
  return {
    blob: blob.type ? blob : new Blob([blob], { type: 'application/pdf' }),
    fileName: fileNameMatch?.[1] ?? 'document.pdf',
  }
}

export type OnlyOfficeEditorConfig = {
  documentServerUrl: string
  // Signed DocEditor config (server-side JWT `token`). Passed verbatim to DocsAPI.
  config: Record<string, unknown>
}

/**
 * Fetch a signed document editor config for the document's latest attachment. The backend points
 * the document server at internal download/callback URLs; edits are saved back as a new version.
 */
export async function fetchOnlyOfficeEditorConfig(documentId: string): Promise<OnlyOfficeEditorConfig> {
  const base = getV1Base()
  const res = await apiFetch(
    `${base}/documents/${encodeURIComponent(documentId)}/onlyoffice/config`,
    // Send the logged-in user (X-Actor-Id/X-Actor-Name) so the editor shows their real name, not the
    // backend "Tectona user" fallback.
    { headers: tectonaServiceHeaders({ Accept: 'application/json' }) },
  )
  if (!res.ok) {
    let detail = `Editor unavailable (HTTP ${res.status}).`
    try {
      const body = await res.json()
      if (body?.detail) detail = String(body.detail)
    } catch {
      // keep default message
    }
    throw new Error(detail)
  }
  return (await res.json()) as OnlyOfficeEditorConfig
}

/** Id of the document's most recent attachment version (used to detect a save produced by editing). */
export async function fetchLatestAttachmentId(
  documentId: string,
  projectId?: string | null,
): Promise<string | null> {
  const attachments = await fetchDocumentAttachmentList(documentId, projectId)
  return pickLatestAttachment(attachments)?.id ?? null
}

export async function uploadDocumentAttachment(
  documentId: string,
  file: File,
  metadata?: Record<string, unknown>
): Promise<DocumentAttachmentResponse> {
  const base = getV1Base()
  const formData = new FormData()
  formData.append('file', file)
  if (metadata && Object.keys(metadata).length > 0) {
    formData.append('metadata_json', JSON.stringify(metadata))
  }

  const res = await apiFetch(`${base}/documents/${encodeURIComponent(documentId)}/attachments`, {
    method: 'POST',
    headers: actorHeaders({ Accept: 'application/json' }),
    body: formData,
  })
  return handleJson<DocumentAttachmentResponse>(res)
}

export interface ApplyDocumentChatEditRequest {
  location: { table_index: number; row_index: number }
  original_text: string
  proposed_text: string
}

export interface ApplyDocumentChatEditResponse {
  document_id: string
  attachment_id: string
  file_name: string
}

/** Apply a Tectona Assistant chat-proposed section transform back into the document's live
 * .docx attachment (new attachment version). Throws (via `handleJson`) with the backend's
 * `detail` message on a 409 staleness conflict — the document changed since the chat turn
 * generated this suggestion. */
export async function applyDocumentChatEdit(
  documentId: string,
  body: ApplyDocumentChatEditRequest,
): Promise<ApplyDocumentChatEditResponse> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/documents/${encodeURIComponent(documentId)}:apply-chat-edit`, {
    method: 'POST',
    headers: actorHeaders({ Accept: 'application/json', 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  return handleJson<ApplyDocumentChatEditResponse>(res)
}

export async function getDocumentAttachmentDownloadUrl(documentId: string, attachmentId: string): Promise<DocumentAttachmentDownloadResponse> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/documents/${encodeURIComponent(documentId)}/attachments/${encodeURIComponent(attachmentId)}:download`, {
    headers: { Accept: 'application/json' },
  })
  return handleJson<DocumentAttachmentDownloadResponse>(res)
}

export async function deleteDocument(documentId: string): Promise<void> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/documents/${encodeURIComponent(documentId)}`, {
    method: 'DELETE',
    headers: tectonaServiceHeaders({ Accept: 'application/json' }),
  })
  await handleJson<void>(res)
}

export interface DocumentTemplateResponse {
  id: string
  template_code: string
  name: string
  description?: string | null
  category_code: string
  document_type_code: string
  body_template: string
  status_code: string
  workspace_id?: string | null
  metadata: Record<string, unknown>
  version: number
  created_date: string
  updated_date?: string | null
  has_attachment?: boolean
  latest_attachment_id?: string | null
  latest_file_name?: string | null
}

export interface TemplateAgentSchema {
  document_kind?: string
  placeholders?: Array<{
    key: string
    label?: string
    type?: string
    required?: boolean
    /** Table cell this placeholder maps to (table_index/row_index) — enables precise write-back. */
    location?: { table_index: number; row_index: number } | null
    /** Literal instructional/prompt text from the source cell (e.g. "Provide the project name…"). */
    instruction?: string | null
  }>
  sections?: Array<{
    id: string
    heading?: string
    kind?: string
    min_paragraphs?: number
  }>
}

export interface DocumentTemplatePatchRequest {
  name?: string
  description?: string | null
  body_template?: string
  status_code?: string
  metadata?: Record<string, unknown>
  version?: number
}

export interface TemplateInstantiateRequest {
  title?: string
  summary?: string | null
  workspace_id?: string | null
  folder_id?: string | null
  document_type_code?: string
  category_code?: string
  status_code?: string
  capability_code?: string | null
  tags?: string[]
  access_scope_codes?: string[]
  attachment_file_name?: string
  metadata?: Record<string, unknown>
  version_notes?: string
  /** Optional LLM fill maps from agent-runtime `/fill-template`. */
  fills?: Record<string, string>
  sections?: Record<string, string>
  agent_schema?: Record<string, unknown>
  /** Base64-encoded PNGs of rendered PlantUML diagrams, keyed by placeholder key. */
  diagrams?: Record<string, string>
}

export interface TemplateAttachmentResponse {
  id: string
  template_id: string
  file_name: string
  content_type: string
  file_size: number
  object_key: string
  etag?: string | null
  metadata: Record<string, unknown>
  created_date: string
}

export interface DocumentTemplateCreateRequest {
  template_code: string
  name: string
  description?: string | null
  category_code: string
  document_type_code: string
  body_template: string
  status_code?: string
  workspace_id?: string | null
  metadata?: Record<string, unknown>
}

export async function listTemplates(params?: {
  category?: string
  document_type?: string
  status?: string
  workspace_id?: string
  workspace_ids?: string[]
}): Promise<DocumentTemplateResponse[]> {
  const base = getV1Base()
  const sp = new URLSearchParams()
  if (params?.category) sp.set('category', params.category)
  if (params?.document_type) sp.set('document_type', params.document_type)
  if (params?.status) sp.set('status', params.status)
  if (params?.workspace_id) sp.set('workspace_id', params.workspace_id)
  if (params?.workspace_ids?.length) sp.set('workspace_ids', params.workspace_ids.join(','))
  const q = sp.toString()
  const res = await apiFetch(`${base}/templates${q ? `?${q}` : ''}`, {
    headers: { Accept: 'application/json' },
  })
  return handleJson<DocumentTemplateResponse[]>(res)
}

export async function createTemplate(body: DocumentTemplateCreateRequest): Promise<DocumentTemplateResponse> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/templates`, {
    method: 'POST',
    headers: tectonaServiceHeaders({ Accept: 'application/json' }),
    body: JSON.stringify({
      template_code: body.template_code,
      name: body.name,
      description: body.description ?? null,
      category_code: body.category_code,
      document_type_code: body.document_type_code,
      body_template: body.body_template,
      status_code: body.status_code ?? 'active',
      workspace_id: body.workspace_id ?? null,
      metadata: body.metadata ?? {},
    }),
  })
  return handleJson<DocumentTemplateResponse>(res)
}

export async function getTemplate(templateId: string): Promise<DocumentTemplateResponse> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/templates/${encodeURIComponent(templateId)}`, {
    headers: { Accept: 'application/json' },
  })
  return handleJson<DocumentTemplateResponse>(res)
}

export async function patchTemplate(
  templateId: string,
  body: DocumentTemplatePatchRequest,
): Promise<DocumentTemplateResponse> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/templates/${encodeURIComponent(templateId)}`, {
    method: 'PATCH',
    headers: tectonaServiceHeaders({ Accept: 'application/json' }),
    body: JSON.stringify(body),
  })
  return handleJson<DocumentTemplateResponse>(res)
}

export async function bootstrapTemplateAttachment(templateId: string): Promise<TemplateAttachmentResponse> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/templates/${encodeURIComponent(templateId)}/attachments/bootstrap`, {
    method: 'POST',
    headers: actorHeaders({ Accept: 'application/json' }),
  })
  return handleJson<TemplateAttachmentResponse>(res)
}

export async function uploadTemplateAttachment(
  templateId: string,
  file: File,
  metadata?: Record<string, unknown>,
): Promise<TemplateAttachmentResponse> {
  const base = getV1Base()
  const formData = new FormData()
  formData.append('file', file)
  if (metadata && Object.keys(metadata).length > 0) {
    formData.append('metadata_json', JSON.stringify(metadata))
  }
  const res = await apiFetch(`${base}/templates/${encodeURIComponent(templateId)}/attachments`, {
    method: 'POST',
    headers: actorHeaders({ Accept: 'application/json' }),
    body: formData,
  })
  return handleJson<TemplateAttachmentResponse>(res)
}

export async function fetchTemplateAttachmentList(templateId: string): Promise<TemplateAttachmentResponse[]> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/templates/${encodeURIComponent(templateId)}/attachments`, {
    headers: { Accept: 'application/json' },
  })
  return handleJson<TemplateAttachmentResponse[]>(res)
}

export async function fetchLatestTemplateAttachmentId(templateId: string): Promise<string | null> {
  const attachments = await fetchTemplateAttachmentList(templateId)
  return attachments[0]?.id ?? null
}

export interface TemplateAttachmentDownloadResponse {
  attachment_id: string
  template_id: string
  file_name: string
  content_type: string
  download_url: string
  expires_in_seconds: number
}

export async function getTemplateAttachmentDownloadUrl(
  templateId: string,
  attachmentId: string,
): Promise<TemplateAttachmentDownloadResponse> {
  const base = getV1Base()
  const res = await apiFetch(
    `${base}/templates/${encodeURIComponent(templateId)}/attachments/${encodeURIComponent(attachmentId)}:download`,
    { headers: { Accept: 'application/json' } },
  )
  return handleJson<TemplateAttachmentDownloadResponse>(res)
}

async function tryStreamTemplateAttachmentDownload(
  templateId: string,
  attachmentId: string,
): Promise<{ blob: Blob; fileName: string; contentType: string } | null> {
  const base = getV1Base()
  const streamPaths = [
    `${base}/templates/${encodeURIComponent(templateId)}/attachments/${encodeURIComponent(attachmentId)}/content`,
    `${base}/templates/${encodeURIComponent(templateId)}/attachments/${encodeURIComponent(attachmentId)}:download`,
    `${base}/templates/${encodeURIComponent(templateId)}/attachments/${encodeURIComponent(attachmentId)}/download`,
  ]

  for (const path of streamPaths) {
    try {
      const res = await apiFetch(path, {
        headers: authHeaders({ Accept: '*/*' }),
        redirect: 'follow',
      })
      if (!res.ok) continue

      const responseType = res.headers.get('content-type') ?? ''
      if (responseType.includes('application/json')) continue

      const blob = await res.blob()
      if (blob.size === 0) continue

      const disposition = res.headers.get('content-disposition') ?? ''
      const fileNameMatch = disposition.match(/filename=\"?([^\";]+)\"?/i)
      return {
        blob,
        fileName: fileNameMatch?.[1] ?? 'template.docx',
        contentType: responseType || blob.type || 'application/octet-stream',
      }
    } catch {
      continue
    }
  }

  return null
}

export async function downloadTemplateAttachmentBlob(
  templateId: string,
  attachmentId?: string | null,
): Promise<{ blob: Blob; fileName: string; contentType: string }> {
  let resolvedAttachmentId = attachmentId?.trim() || null
  if (!resolvedAttachmentId) {
    resolvedAttachmentId = await fetchLatestTemplateAttachmentId(templateId)
  }
  if (!resolvedAttachmentId) {
    throw new Error('This template does not have a file attachment yet.')
  }

  const streamed = await tryStreamTemplateAttachmentDownload(templateId, resolvedAttachmentId)
  if (streamed) return streamed

  try {
    const payload = await getTemplateAttachmentDownloadUrl(templateId, resolvedAttachmentId)
    return await fetchAttachmentBlobFromUrl(
      payload.download_url,
      payload.file_name,
      payload.content_type,
    )
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to download template file.')
  }
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const base = getV1Base()
  const res = await apiFetch(`${base}/templates/${encodeURIComponent(templateId)}`, {
    method: 'DELETE',
    headers: tectonaServiceHeaders({ Accept: 'application/json' }),
  })
  await handleJson<void>(res)
}

export async function instantiateTemplateFromProject(
  projectId: string,
  templateId: string,
  body: TemplateInstantiateRequest,
): Promise<DocumentResponse> {
  const base = getV1Base()
  const res = await apiFetch(
    `${base}/projects/${encodeURIComponent(projectId)}/templates/${encodeURIComponent(templateId)}:instantiate`,
    {
      method: 'POST',
      headers: tectonaServiceHeaders({ Accept: 'application/json' }),
      body: JSON.stringify(body),
    },
  )
  return handleJson<DocumentResponse>(res)
}

export interface TemplatePreviewRequest {
  fills?: Record<string, string>
  sections?: Record<string, string>
  agent_schema?: Record<string, unknown>
  /** Base64-encoded PNGs of rendered PlantUML diagrams, keyed by placeholder key. */
  diagrams?: Record<string, string>
}

export interface TemplatePreviewStagingResponse {
  staging_id: string
  file_name: string
}

/** Fill the template's Word file with the given contract (typically AI-generated mock data) and
 * stage it briefly (short TTL) so OnlyOffice can open it read-only. Nothing is persisted as a
 * document/attachment. */
export async function stageMasterTemplatePreview(
  templateId: string,
  body: TemplatePreviewRequest,
): Promise<TemplatePreviewStagingResponse> {
  const base = getV1Base()
  const res = await apiFetch(
    `${base}/templates/${encodeURIComponent(templateId)}/preview-staging`,
    {
      method: 'POST',
      headers: tectonaServiceHeaders({ Accept: 'application/json' }),
      body: JSON.stringify(body),
    },
  )
  return handleJson<TemplatePreviewStagingResponse>(res)
}

/** Signed, read-only OnlyOffice editor config for a staged template preview render. */
export async function fetchTemplatePreviewOnlyOfficeConfig(
  stagingId: string,
): Promise<OnlyOfficeEditorConfig> {
  const base = getV1Base()
  const res = await apiFetch(
    `${base}/templates/preview-staging/${encodeURIComponent(stagingId)}/onlyoffice/view-config`,
    { headers: tectonaServiceHeaders({ Accept: 'application/json' }) },
  )
  if (!res.ok) {
    let detail = `Preview unavailable (HTTP ${res.status}).`
    try {
      const errBody = await res.json()
      if (errBody?.detail) detail = String(errBody.detail)
    } catch {
      // non-JSON error body — keep the default message
    }
    throw new Error(detail)
  }
  return (await res.json()) as OnlyOfficeEditorConfig
}

export async function fetchTemplateOnlyOfficeEditorConfig(templateId: string): Promise<OnlyOfficeEditorConfig> {
  const base = getV1Base()
  const res = await apiFetch(
    `${base}/templates/${encodeURIComponent(templateId)}/onlyoffice/config`,
    { headers: tectonaServiceHeaders({ Accept: 'application/json' }) },
  )
  if (!res.ok) {
    let detail = `Editor unavailable (HTTP ${res.status}).`
    try {
      const payload = await res.json()
      if (payload?.detail) detail = String(payload.detail)
    } catch {
      // keep default
    }
    throw new Error(detail)
  }
  return (await res.json()) as OnlyOfficeEditorConfig
}

export type TemplateCompareOnlyOfficeConfig = OnlyOfficeEditorConfig & {
  compareDocument: {
    c: 'compare' | 'combine' | 'insert-text'
    fileType: string
    url: string
    token: string
  }
  labels: {
    serverTitle: string
    uploadTitle: string
  }
  serverViewConfig: Record<string, unknown>
  uploadViewConfig: Record<string, unknown>
}

export async function stageTemplateCompareUpload(
  file: File,
): Promise<{ staging_id: string; file_name: string }> {
  const base = getV1Base()
  const formData = new FormData()
  formData.append('file', file)
  const res = await apiFetch(`${base}/templates/compare-upload/staging`, {
    method: 'POST',
    headers: actorHeaders({ Accept: 'application/json' }),
    body: formData,
  })
  return handleJson<{ staging_id: string; file_name: string }>(res)
}

export async function fetchTemplateCompareOnlyOfficeConfig(
  templateId: string,
  stagingId: string,
): Promise<TemplateCompareOnlyOfficeConfig> {
  const base = getV1Base()
  const sp = new URLSearchParams({ staging_id: stagingId })
  const res = await apiFetch(
    `${base}/templates/${encodeURIComponent(templateId)}/onlyoffice/compare-config?${sp.toString()}`,
    { headers: tectonaServiceHeaders({ Accept: 'application/json' }) },
  )
  if (!res.ok) {
    let detail = `Compare editor unavailable (HTTP ${res.status}).`
    try {
      const payload = await res.json()
      if (payload?.detail) detail = String(payload.detail)
    } catch {
      // keep default
    }
    throw new Error(detail)
  }
  return (await res.json()) as TemplateCompareOnlyOfficeConfig
}
