/**
 * Idea Backlog service API client.
 * Uses python-idea-backlog-service-fastapi (http://localhost:8511).
 * In development, Vite proxies /api/idea-backlog -> localhost:8511 (set VITE_IDEA_BACKLOG_API_URL to override).
 */

import {
  getIdeaDraftJob,
  startIdeaDraftJob,
  getIdeaExtractionJob,
  startIdeaExtractionJob,
  type IdeaExtractionCandidate,
  type IdeaExtractionDocumentContext,
  type RuntimeChatResponse,
} from '@/lib/api/tectonaAgentRuntimeApi'
import { apiFetch, tectonaServiceHeaders } from './httpClient'

import { serviceApiBase, tectonaAgentRuntimeApiBase } from './gatewayBase'

const BASE_URL = serviceApiBase('/api/idea-backlog', import.meta.env.VITE_IDEA_BACKLOG_API_URL)

// ── Backend status codes ──────────────────────────────────────────────────────
export type BackendIdeaStatus =
  | 'draft'
  | 'submitted'
  | 'gate1_approved'
  | 'gate1_rejected'
  | 'gate2_approved'
  | 'gate2_rejected'
  | 'converted'
  | 'on_hold'

// ── Frontend display labels (UI) ──────────────────────────────────────────────
export type IdeaDisplayStatus =
  | 'New Submission'
  | 'Under Review'
  | 'Approved'
  | 'Rejected'
  | 'Converted to Project'

export function toDisplayStatus(code: BackendIdeaStatus): IdeaDisplayStatus {
  switch (code) {
    case 'draft':
      return 'New Submission'
    case 'submitted':
    case 'on_hold':
      return 'Under Review'
    case 'gate1_approved':
    case 'gate2_approved':
      return 'Approved'
    case 'gate1_rejected':
    case 'gate2_rejected':
      return 'Rejected'
    case 'converted':
      return 'Converted to Project'
    default:
      return 'New Submission'
  }
}

export function toBackendStatus(display: IdeaDisplayStatus): BackendIdeaStatus {
  switch (display) {
    case 'New Submission':
      return 'submitted'
    case 'Under Review':
      return 'on_hold'
    case 'Approved':
      return 'gate1_approved'
    case 'Rejected':
      return 'gate1_rejected'
    case 'Converted to Project':
      return 'converted'
    default:
      return 'submitted'
  }
}

// ── Scoring helpers ───────────────────────────────────────────────────────────
export interface ScoreDimensionApi {
  key: string
  label: string
  score: number
  weight?: number | null
  reason?: string | null
}

export interface ScoringResponseApi {
  id: string
  idea_id: string
  source_mode: string
  total_score?: number | null
  score_dimensions: ScoreDimensionApi[]
  reason_codes: string[]
  explainability_summary?: string | null
  summary?: string | null
  scored_at: string
}

/** Extract the four canonical scoring dimensions from a scoring response. */
export function extractScoringDimensions(scoring: ScoringResponseApi | null | undefined): {
  businessValue: number
  effort: number
  risk: number
  roi: number
} {
  if (!scoring || !scoring.score_dimensions.length) {
    return { businessValue: 0, effort: 0, risk: 0, roi: 0 }
  }
  const find = (key: string) =>
    scoring.score_dimensions.find((d) => d.key === key)?.score ?? 0

  return {
    businessValue: find('value') || find('business_value') || find('businessValue') || 0,
    effort: find('effort') || 0,
    risk: find('risk') || 0,
    roi: find('roi') || 0,
  }
}

// ── API response shapes ───────────────────────────────────────────────────────
export interface GateDecisionApi {
  id: string
  idea_id: string
  gate_name: 'gate1' | 'gate2'
  decision: 'approved' | 'rejected' | 'needs_changes'
  notes?: string | null
  reviewer_id: string
  decided_at: string
}

export interface ArtifactApi {
  id: string
  idea_id: string
  artifact_type: string
  title: string
  version_label?: string | null
  status_code: string
  artifact_uri: string
}

export interface IdeaApi {
  id: string
  workspace_id?: string | null
  project_id?: string | null
  portfolio_id?: string | null
  title: string
  description?: string | null
  business_objective?: string | null
  scope_summary?: string | null
  risk_summary?: string | null
  category?: string | null
  card_accent_color?: string | null
  tags: string[]
  owner_id?: string | null
  assignee_id?: string | null
  folder_id?: string | null
  status_code: BackendIdeaStatus
  delivery_id?: string | null
  work_item_id?: string | null
  converted_at?: string | null
  version: number
  gate1_decision?: GateDecisionApi | null
  gate2_decision?: GateDecisionApi | null
  latest_scoring?: ScoringResponseApi | null
  artifacts: ArtifactApi[]
  created_date: string
  updated_date?: string | null
}

export interface IdeaListApi {
  items: IdeaApi[]
  total: number
  page: number
  page_size: number
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function parseApiErrorMessage(status: number, body: string): string {
  const trimmed = body.trim()
  if (!trimmed) return `Request failed (HTTP ${status}).`

  try {
    const parsed = JSON.parse(trimmed) as {
      error?: { message?: string; code?: number }
      detail?: string
      message?: string
    }
    const nested = parsed.error?.message
    if (nested) {
      if (status === 403 && nested.includes('idea_backlog')) {
        return (
          'Your current token does not have Idea & Backlog API permission yet. '
          + 'Reload the page, or sign out and sign in again so your latest role is loaded. '
          + 'If it still fails, ask an admin to add the idea_backlog role to your account.'
        )
      }
      return nested
    }
    if (typeof parsed.detail === 'string' && parsed.detail) return parsed.detail
    if (typeof parsed.message === 'string' && parsed.message) return parsed.message
  } catch {
    /* plain text */
  }
  return trimmed
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(parseApiErrorMessage(res.status, text))
  }
  return res.json() as Promise<T>
}

async function handleEmptyResponse(res: Response): Promise<void> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
}

function defaultHeaders(extra?: Record<string, string>): HeadersInit {
  return tectonaServiceHeaders(extra)
}

// ── Persistent summary ────────────────────────────────────────────────────────

export interface IdeaSummaryPersistent {
  id: string
  idea_id: string
  summary_json: Record<string, unknown>
  summary_mode: string
  confidence_score: number
  generated_at: string
  generated_by: string
  source_session_id?: string | null
  version: number
  created_date: string
  updated_date?: string | null
}

/**
 * Retrieve persistent AI-generated summary for an idea.
 * Returns `null` when no summary has been saved yet (204 / legacy 404).
 */
export async function getPersistentIdeaSummary(ideaId: string): Promise<IdeaSummaryPersistent | null> {
  const res = await apiFetch(
    `${BASE_URL}/v1/ideas/${ideaId}/summary`,
    { headers: defaultHeaders() }
  )
  if (res.status === 204 || res.status === 404) return null
  return handleResponse<IdeaSummaryPersistent>(res)
}

export async function upsertPersistentIdeaSummary(
  ideaId: string,
  body: {
    summary_json: Record<string, unknown>
    summary_mode: 'deterministic_first' | 'llm_first' | 'hybrid' | 'role_multi_llm'
    confidence_score: number
    generated_by: string
    source_session_id?: string | null
    version: number
  },
): Promise<IdeaSummaryPersistent> {
  const res = await apiFetch(`${BASE_URL}/v1/ideas/${ideaId}/summary`, {
    method: 'PUT',
    headers: defaultHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse<IdeaSummaryPersistent>(res)
}

export type IdeaSectionKey =
  | 'summary'
  | 'scoring'
  | 'impact'
  | 'integration'
  | 'process'
  | 'costBenefit'
  | 'conversion'
  | 'document'

export type IdeaSectionRevisionStatus =
  | 'proposed'
  | 'accepted'
  | 'rejected'
  | 'approved'
  | 'superseded'

export interface IdeaSectionRevisionApi {
  id: string
  idea_id: string
  section_key: IdeaSectionKey
  revision_number: number
  base_idea_version: number
  content_json: Record<string, unknown>
  source: 'human' | 'ai'
  status: IdeaSectionRevisionStatus
  author_id: string
  approved_by?: string | null
  model_id?: string | null
  confidence_score?: number | null
  evidence_json: Array<Record<string, unknown>>
  source_session_id?: string | null
  approved_at?: string | null
  created_date: string
  updated_date?: string | null
}

export async function listIdeaSectionRevisions(
  ideaId: string,
  sectionKey: IdeaSectionKey,
): Promise<IdeaSectionRevisionApi[]> {
  const res = await apiFetch(
    `${BASE_URL}/v1/ideas/${ideaId}/sections/${sectionKey}/revisions`,
    { headers: defaultHeaders() },
  )
  return handleResponse<IdeaSectionRevisionApi[]>(res)
}

export async function getActiveIdeaSectionRevision(
  ideaId: string,
  sectionKey: IdeaSectionKey,
): Promise<IdeaSectionRevisionApi | null> {
  const res = await apiFetch(
    `${BASE_URL}/v1/ideas/${ideaId}/sections/${sectionKey}/active`,
    { headers: defaultHeaders() },
  )
  if (res.status === 204 || res.status === 404) return null
  return handleResponse<IdeaSectionRevisionApi>(res)
}

export async function createIdeaSectionRevision(
  ideaId: string,
  sectionKey: IdeaSectionKey,
  body: {
    content_json: Record<string, unknown>
    source: 'human' | 'ai'
    base_idea_version?: number
    model_id?: string | null
    confidence_score?: number | null
    evidence_json?: Array<Record<string, unknown>>
    source_session_id?: string | null
  },
): Promise<IdeaSectionRevisionApi> {
  const res = await apiFetch(
    `${BASE_URL}/v1/ideas/${ideaId}/sections/${sectionKey}/revisions`,
    {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(body),
    },
  )
  return handleResponse<IdeaSectionRevisionApi>(res)
}

export async function transitionIdeaSectionRevision(
  ideaId: string,
  sectionKey: IdeaSectionKey,
  revisionId: string,
  transition: 'accept' | 'reject' | 'approve',
): Promise<IdeaSectionRevisionApi> {
  const res = await apiFetch(
    `${BASE_URL}/v1/ideas/${ideaId}/sections/${sectionKey}/revisions/${revisionId}/${transition}`,
    { method: 'POST', headers: defaultHeaders() },
  )
  return handleResponse<IdeaSectionRevisionApi>(res)
}

export interface IdeaIntegrationPersistent {
  id: string
  idea_id: string
  integration_json: Record<string, unknown>
  status: 'ok' | 'insufficient_data' | 'draft' | string
  confidence_score: number
  generated_at: string
  generated_by: string
  source_correlation_id?: string | null
  version: number
  created_date: string
  updated_date?: string | null
}

export async function getPersistentIdeaIntegration(ideaId: string): Promise<IdeaIntegrationPersistent | null> {
  const res = await apiFetch(`${BASE_URL}/v1/ideas/${ideaId}/integration`, { headers: defaultHeaders() })
  // 204 = intentionally empty (no architecture saved yet); 404 kept for older backends.
  if (res.status === 204 || res.status === 404) return null
  return handleResponse<IdeaIntegrationPersistent>(res)
}

export async function upsertPersistentIdeaIntegration(
  ideaId: string,
  body: {
    integration_json: Record<string, unknown>
    status: 'ok' | 'insufficient_data' | 'draft'
    confidence_score: number
    generated_by: string
    source_correlation_id?: string | null
    version: number
  },
): Promise<IdeaIntegrationPersistent> {
  const res = await apiFetch(`${BASE_URL}/v1/ideas/${ideaId}/integration`, {
    method: 'PUT',
    headers: defaultHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse<IdeaIntegrationPersistent>(res)
}

export type C4ArchitectureLevel = 'L1' | 'L2'

export interface IdeaC4ArchitecturePersistent {
  id: string
  idea_id: string
  level: C4ArchitectureLevel
  c4_json: Record<string, unknown>
  status: 'ok' | 'insufficient_data' | 'draft' | string
  confidence_score: number
  generated_at: string
  generated_by: string
  source_correlation_id?: string | null
  version: number
  created_date: string
  updated_date?: string | null
}

export async function getPersistentIdeaC4Architecture(
  ideaId: string,
  level: C4ArchitectureLevel,
): Promise<IdeaC4ArchitecturePersistent | null> {
  const res = await apiFetch(`${BASE_URL}/v1/ideas/${ideaId}/c4-architecture/${level}`, { headers: defaultHeaders() })
  // 204 = intentionally empty (no diagram saved yet for this level); 404 kept for older backends.
  if (res.status === 204 || res.status === 404) return null
  return handleResponse<IdeaC4ArchitecturePersistent>(res)
}

export async function upsertPersistentIdeaC4Architecture(
  ideaId: string,
  level: C4ArchitectureLevel,
  body: {
    c4_json: Record<string, unknown>
    status: 'ok' | 'insufficient_data' | 'draft'
    confidence_score: number
    generated_by: string
    source_correlation_id?: string | null
    version: number
  },
): Promise<IdeaC4ArchitecturePersistent> {
  const res = await apiFetch(`${BASE_URL}/v1/ideas/${ideaId}/c4-architecture/${level}`, {
    method: 'PUT',
    headers: defaultHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse<IdeaC4ArchitecturePersistent>(res)
}

export interface IdeaProcessDiagramPersistent {
  id: string
  idea_id: string
  process_key: string
  process_json: Record<string, unknown>
  status: 'ok' | 'insufficient_data' | 'draft' | string
  confidence_score: number
  generated_at: string
  generated_by: string
  source_correlation_id?: string | null
  version: number
  created_date: string
  updated_date?: string | null
}

export async function getPersistentIdeaProcessDiagram(
  ideaId: string,
  processKey: string,
): Promise<IdeaProcessDiagramPersistent | null> {
  const res = await apiFetch(`${BASE_URL}/v1/ideas/${ideaId}/process-diagram/${processKey}`, { headers: defaultHeaders() })
  // 204 = intentionally empty (no diagram saved yet for this key); 404 kept for older backends.
  if (res.status === 204 || res.status === 404) return null
  return handleResponse<IdeaProcessDiagramPersistent>(res)
}

export async function upsertPersistentIdeaProcessDiagram(
  ideaId: string,
  processKey: string,
  body: {
    process_json: Record<string, unknown>
    status: 'ok' | 'insufficient_data' | 'draft'
    confidence_score: number
    generated_by: string
    source_correlation_id?: string | null
    version: number
  },
): Promise<IdeaProcessDiagramPersistent> {
  const res = await apiFetch(`${BASE_URL}/v1/ideas/${ideaId}/process-diagram/${processKey}`, {
    method: 'PUT',
    headers: defaultHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse<IdeaProcessDiagramPersistent>(res)
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function getIdeaById(ideaId: string): Promise<IdeaApi> {
  const res = await apiFetch(`${BASE_URL}/v1/ideas/${ideaId}`, {
    headers: defaultHeaders(),
  })
  return handleResponse<IdeaApi>(res)
}

export async function listIdeas(params?: {
  status?: BackendIdeaStatus
  workspace_id?: string
  project_id?: string
  folder_id?: string | null
  q?: string
  tag?: string
  page?: number
  page_size?: number
}): Promise<IdeaListApi> {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.workspace_id) qs.set('workspace_id', params.workspace_id)
  if (params?.project_id) qs.set('project_id', params.project_id)
  if (params?.folder_id !== undefined) {
    qs.set('folder_id', params.folder_id === null ? 'null' : params.folder_id)
  }
  if (params?.q) qs.set('q', params.q)
  if (params?.tag) qs.set('tag', params.tag)
  if (params?.page !== undefined) qs.set('page', String(params.page))
  if (params?.page_size !== undefined) qs.set('page_size', String(params.page_size))

  const res = await apiFetch(
    `${BASE_URL}/v1/ideas${qs.toString() ? `?${qs}` : ''}`,
    { headers: defaultHeaders() }
  )
  return handleResponse<IdeaListApi>(res)
}

const IDEA_LIST_MAX_PAGE_SIZE = 200

export async function fetchAllIdeas(
  params?: Omit<NonNullable<Parameters<typeof listIdeas>[0]>, 'page' | 'page_size'>,
): Promise<IdeaApi[]> {
  const page_size = IDEA_LIST_MAX_PAGE_SIZE
  const all: IdeaApi[] = []
  let page = 1
  let total = Number.POSITIVE_INFINITY

  while (all.length < total) {
    const res = await listIdeas({ ...params, page, page_size })
    all.push(...res.items)
    total = res.total
    if (res.items.length < page_size) break
    page += 1
  }

  return all
}

export async function createIdea(body: {
  title: string
  description?: string
  category?: string
  card_accent_color?: string
  tags?: string[]
  workspace_id?: string
  owner_id?: string
  assignee_id?: string
  folder_id?: string | null
  status_code?: BackendIdeaStatus
}): Promise<IdeaApi> {
  const res = await apiFetch(`${BASE_URL}/v1/ideas`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify({ status_code: 'submitted', ...body }),
  })
  return handleResponse<IdeaApi>(res)
}

export async function patchIdea(
  ideaId: string,
  body: {
    status_code?: BackendIdeaStatus
    title?: string
    description?: string
    business_objective?: string | null
    scope_summary?: string | null
    risk_summary?: string | null
    category?: string
    card_accent_color?: string
    tags?: string[]
    workspace_id?: string
    project_id?: string | null
    folder_id?: string | null
    version: number
  }
): Promise<IdeaApi> {
  const res = await apiFetch(`${BASE_URL}/v1/ideas/${ideaId}`, {
    method: 'PATCH',
    headers: defaultHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse<IdeaApi>(res)
}

export async function deleteIdea(ideaId: string, version: number): Promise<void> {
  const qs = new URLSearchParams({ version: String(version) })
  const res = await apiFetch(`${BASE_URL}/v1/ideas/${ideaId}?${qs.toString()}`, {
    method: 'DELETE',
    headers: defaultHeaders(),
  })
  return handleEmptyResponse(res)
}

// ── Tectona Agent AI Assistance ───────────────────────────────────────────────

export type IdeaAiAssistanceMode = 'generate_draft' | 'improve_writing' | 'suggest_structure'

export interface IdeaAiAssistanceResult {
  mode: IdeaAiAssistanceMode
  result: string
}

export interface GenerateIdeaDraftOptions {
  workspace_id?: string
  user_id?: string
  session_id?: string
  tags?: string[]
}

/**
 * Convenience wrapper around the staged Idea Draft job API.
 * Prefer `startIdeaDraftJob` + polling in UI when progress must be shown.
 */
export async function generateIdeaDraftFromTitle(
  title: string,
  options: GenerateIdeaDraftOptions = {},
): Promise<string> {
  const started = await startIdeaDraftJob({
    title: title.trim(),
    tags: options.tags ?? [],
    context: {
      workspace_id: options.workspace_id ?? null,
      user_id: options.user_id ?? null,
      session_id: options.session_id ?? null,
    },
  })

  for (let attempt = 0; attempt < 240; attempt += 1) {
    const status = await getIdeaDraftJob(started.job_id)
    if (status.status === 'completed') {
      const draftText = status.result?.draft_text?.trim()
      if (!draftText) {
        throw new Error('Failed to generate draft. Please try again.')
      }
      return draftText
    }
    if (status.status === 'failed') {
      throw new Error(status.error_message || 'AI draft generation failed.')
    }
    if (status.status === 'cancelled') {
      throw new Error('Generate Draft was cancelled.')
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 1250))
  }

  throw new Error('Generate Draft is still running. Please try again shortly.')
}

export interface ExtractIdeaCandidatesOptions {
  workspace_id?: string
  user_id?: string
  session_id?: string
}

/**
 * Convenience wrapper around the staged Idea Extraction job API — extracts one or more Idea
 * candidates from an already-extracted document text (see `IdeaUploadReviewPanel`).
 * Prefer `startIdeaExtractionJob` + polling in UI when live progress must be shown.
 */
export async function extractIdeaCandidatesFromDocument(
  document: IdeaExtractionDocumentContext,
  options: ExtractIdeaCandidatesOptions = {},
): Promise<IdeaExtractionCandidate[]> {
  const started = await startIdeaExtractionJob({
    document,
    context: {
      workspace_id: options.workspace_id ?? null,
      user_id: options.user_id ?? null,
      session_id: options.session_id ?? null,
    },
  })

  for (let attempt = 0; attempt < 240; attempt += 1) {
    const status = await getIdeaExtractionJob(started.job_id)
    if (status.status === 'completed') return status.result?.candidates ?? []
    if (status.status === 'failed') throw new Error(status.error_message || 'Idea extraction failed.')
    if (status.status === 'cancelled') throw new Error('Idea extraction was cancelled.')
    await new Promise<void>((resolve) => setTimeout(resolve, 1250))
  }

  throw new Error('Idea extraction is still running. Please try again shortly.')
}

/**
 * Call Tectona Agent Runtime to generate AI-assisted idea descriptions.
 * Modes:
 * - generate_draft: Generate description from idea title
 * - improve_writing: Improve/polish existing description
 * - suggest_structure: Suggest structured content (Tujuan→Permasalahan→Solusi→Risiko)
 */
export async function generateIdeaDescriptionWithAI(
  mode: IdeaAiAssistanceMode,
  title: string,
  existingDescription?: string,
  workspace_id?: string
): Promise<IdeaAiAssistanceResult> {
  const agentBase = tectonaAgentRuntimeApiBase(
    (import.meta.env.VITE_TECTONA_AGENT_API_URL as string | undefined)
      ?? (import.meta.env.VITE_TECTONA_AGENT_RUNTIME_API_URL as string | undefined),
  )

  const prompt = buildIdeaAssistancePrompt(mode, title, existingDescription)

  const res = await apiFetch(`${agentBase}/v1/agent/chat`, {
    method: 'POST',
    headers: tectonaServiceHeaders({
      'X-App-Role': 'admin',
      ...(workspace_id ? { 'X-Workspace-Id': workspace_id } : {}),
    }),
    body: JSON.stringify({
      message: prompt,
      mode: 'deterministic',
      context: {
        workspace_id,
        idea_title: title,
      },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`AI assistance failed: ${text || `HTTP ${res.status}`}`)
  }

  const data = (await res.json()) as any
  const responseText = typeof data?.response === 'string' ? data.response : JSON.stringify(data?.response || data || '')
  const result = extractAgentResponseText(responseText)

  if (isFallbackLikeResponse({
    answer: `${responseText}\n${typeof result === 'string' ? result : JSON.stringify(result)}`,
    confidence_score: 0,
    evidence: [],
    warnings: [],
    correlation_id: '',
  })) {
    throw new Error('AI response was a fallback reply. Please try again when KB context is available.')
  }

  return {
    mode,
    result: typeof result === 'string' ? result : JSON.stringify(result),
  }
}

type IdeaDraftLanguage = 'id' | 'en'

const INDONESIAN_HINT_WORDS = new Set([
  'dan',
  'di',
  'ke',
  'dari',
  'untuk',
  'dengan',
  'pada',
  'yang',
  'atau',
  'adalah',
  'fitur',
  'membangun',
  'pembayaran',
  'sistem',
  'aplikasi',
  'modul',
  'integrasi',
  'pengguna',
  'bisnis',
  'proses',
  'layanan',
  'tim',
  'proyek',
  'ide',
  'baru',
  'dalam',
  'akan',
  'harus',
  'perlu',
  'melalui',
  'antar',
  'peningkatan',
  'pengembangan',
  'implementasi',
])

/**
 * Infer draft language from idea title (and optional existing description).
 * Used so AI Assist matches Bahasa Indonesia when the user writes in Indonesian.
 */
function detectIdeaDraftLanguage(title: string, existingDescription?: string): IdeaDraftLanguage {
  const source = [title, existingDescription].filter(Boolean).join(' ').trim().toLowerCase()
  if (!source) {
    return 'en'
  }

  const words = source.split(/\s+/).filter(Boolean)
  let score = 0

  for (const word of words) {
    if (INDONESIAN_HINT_WORDS.has(word)) {
      score += 2
    }
    if (/^(me|mem|ber|pe|di|ter|se|meng|men|pen)[a-z]{2,}/i.test(word)) {
      score += 1
    }
  }

  return score >= 2 ? 'id' : 'en'
}

function ideaDraftLanguageInstruction(language: IdeaDraftLanguage): string {
  return language === 'id'
    ? 'Tulis seluruh isi draft dalam Bahasa Indonesia profesional dan jelas. Gunakan heading section persis seperti template di bawah.'
    : 'Write the entire draft in clear professional English. Use the section headings exactly as shown below.'
}

function buildIdeaDraftStructureTemplate(language: IdeaDraftLanguage): string {
  if (language === 'id') {
    return [
      'Tujuan',
      'Apa outcome yang diinginkan? Apa indikator keberhasilan?',
      '',
      'Permasalahan',
      'Jelaskan masalah pengguna, mengapa urgent, dan dampak bisnis.',
      '',
      'Solusi',
      'Ringkas solusi yang diusulkan dan status validasi awal.',
      '',
      'Risiko',
      'Uraikan risiko utama dan strategi mitigasi.',
      '',
      'Dokumen Pendukung',
      'Referensi dokumen, desain, atau file PDF yang relevan (opsional).',
    ].join('\n')
  }

  return [
    'Objective',
    'What outcomes are desired? What are success indicators?',
    '',
    'Problem Statement',
    'Explain the user problem, why it is urgent, and the business impact.',
    '',
    'Solution',
    'Summarize the proposed solution and the initial validation status.',
    '',
    'Risk',
    'List key risks and mitigation strategies.',
    '',
    'Supporting Documents',
    'Relevant document references, designs, or PDF files (optional).',
  ].join('\n')
}

/**
 * Build prompt for Tectona Agent based on assistance mode.
 */
function buildIdeaAssistancePrompt(
  mode: IdeaAiAssistanceMode,
  title: string,
  existingDescription?: string
): string {
  const baseContext = `Idea Title: ${title}`
  const language = detectIdeaDraftLanguage(title, existingDescription)
  const structureTemplate = buildIdeaDraftStructureTemplate(language)
  const languageInstruction = ideaDraftLanguageInstruction(language)

  switch (mode) {
    case 'generate_draft':
      return `${baseContext}

Analyze the idea title and generate a draft description for strategic intake.

Instructions:
- First, check whether there is enough context or supporting knowledge from the knowledge base.
- If relevant KB information is available, use it to shape the draft.
- If KB context is not available, make reasonable general assumptions based on the title.
- Do not return JSON.
- Return only the final description text.
- ${languageInstruction}

Use this structure exactly:
${structureTemplate}`

    case 'improve_writing':
      return `${baseContext}

Current description:
${existingDescription || '(empty)'}

Please improve this idea description by:
1. Enhancing clarity and professionalism
2. Fixing grammar and language flow
3. Ensuring logical structure (Tujuan/Objective → Permasalahan/Problem Statement → Solusi/Solution → Risiko/Risk)
4. Adding missing details or context where appropriate

Keep the same structure but improve the writing quality.
${languageInstruction}`

    case 'suggest_structure':
      return `${baseContext}

Current description:
${existingDescription || '(empty)'}

Suggest a structured description format with these sections:
- Tujuan / Objective (clear objectives and success metrics)
- Permasalahan / Problem Statement (user problem and business impact)
- Solusi / Solution (proposed solution with validation status)
- Risiko / Risk (key risks and mitigation strategies)
- Dokumen Pendukung / Supporting Documents (needed supporting documents)

Format as a well-organized outline.
${languageInstruction}`
  }
}

/**
 * Extract plain text from agent response, preferring the answer field when the
 * runtime returns a JSON envelope.
 */
function extractAgentResponseText(response: any): string {
  if (!response) {
    return ''
  }

  if (typeof response === 'string') {
    const trimmed = response.trim()

    if (!trimmed) {
      return ''
    }

    const parsed = tryParseJson(trimmed)
    if (parsed && typeof parsed === 'object') {
      const answer = pickAgentAnswer(parsed)
      if (answer) {
        return answer
      }
    }

    return stripCodeFences(trimmed)
  }

  if (typeof response === 'object') {
    const answer = pickAgentAnswer(response)
    if (answer) {
      return answer
    }

    return stripCodeFences(JSON.stringify(response, null, 2))
  }

  return String(response)
}

function pickAgentAnswer(payload: any): string {
  const visited = new WeakSet<object>()

  const search = (value: any): string => {
    if (!value) {
      return ''
    }

    if (typeof value === 'string') {
      const parsed = tryParseJson(value.trim())
      if (parsed && typeof parsed === 'object') {
        return search(parsed)
      }
      return value.trim()
    }

    if (typeof value !== 'object') {
      return ''
    }

    if (visited.has(value)) {
      return ''
    }
    visited.add(value)

    const directCandidates = [
      value.answer,
      value.result,
      value.content,
      value.message,
      value.text,
      value.data?.answer,
      value.data?.result,
      value.data?.content,
      value.data?.message,
      value.data?.text,
      value.response?.answer,
      value.response?.result,
      value.response?.content,
      value.response?.message,
      value.response?.text,
    ]

    for (const candidate of directCandidates) {
      const extracted = search(candidate)
      if (extracted) {
        return extracted
      }
    }

    for (const nestedValue of Object.values(value)) {
      if (nestedValue && typeof nestedValue === 'object') {
        const extracted = search(nestedValue)
        if (extracted) {
          return extracted
        }
      }
    }

    return ''
  }

  return search(payload)
}

function tryParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function stripCodeFences(value: string): string {
  return value
    .replace(/^```(?:json|markdown|text)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function isFallbackLikeResponse(response: RuntimeChatResponse): boolean {
  const haystack = `${response.answer}\n${response.warnings.join('\n')}`.toLowerCase()
  return [
    'llm_fallback_used',
    'llm_fallback_reason',
    'upstream_auth',
    'billing_disabled',
    'primary_unavailable',
    'saya dapat membantu analisis ide',
    'saya dapat membantu',
    'i can help analyze',
    'i can help',
  ].some((marker) => haystack.includes(marker))
}
