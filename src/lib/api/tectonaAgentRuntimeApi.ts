/**
 * Tectona Agent Runtime API client.
 * In development, Vite proxies /api/tectona-agent-runtime -> python-tectona-agent-runtime-service-fastapi.
 */

import { getSession } from '@/auth/authService'
import { serviceApiBase } from './gatewayBase'
import { apiFetch, tectonaServiceHeaders } from './httpClient'
import type { LlmUsagePayload } from '@/lib/tokenTelemetry'

/** Default workspace slug for sidebar Gen AI sessions until workspace context is wired from shell. */
export const TECTONA_CHAT_WORKSPACE_ID = 'react-tectona'

/** Greet is LLM-only on backend — allow enough time for GCP/Ollama. */
const GREET_LLM_TIMEOUT_MS = 18_000
/** Sidebar Gen AI chat — Ollama gemma4:31b on dev can exceed 60s (cold start + long context). */
const SIDEBAR_CHAT_TIMEOUT_MS = 180_000
const GENAI_SESSION_FETCH_TIMEOUT_MS = 5000

const BASE_URL = serviceApiBase(
  '/api/tectona-agent-runtime',
  import.meta.env.VITE_TECTONA_AGENT_RUNTIME_API_URL,
)

export interface RuntimeSummaryScoring {
  businessValue: number
  effort: number
  risk: number
  roi: number
}

export interface RuntimeSummaryIdeaContext {
  title: string
  description: string
  status: string
  scoring: RuntimeSummaryScoring
  tags: string[]
}

export interface RuntimeSummaryRequest {
  idea_id: string
  context: {
    workspace_id?: string | null
    user_id?: string | null
    session_id?: string | null
  }
  idea_context: RuntimeSummaryIdeaContext
  options: {
    mode: 'deterministic_first' | 'llm_first'
    allow_llm: boolean
    max_evidence: number
    force_refresh?: boolean
  }
}

export interface RuntimeSummaryEvidence {
  source_service: string
  endpoint: string
  key_ref?: string | null
  details?: Record<string, unknown> | null
}

export interface RuntimeSummaryKpiCard {
  label: string
  value: string
  detail: string
  reason?: string
}

export interface RuntimeSummaryReadinessSignal {
  title: string
  detail: string
  tone: string
}

export interface RuntimeSummaryStrategicFramingItem {
  title: string
  detail: string
}

export interface RuntimeSummaryDecisionSignal {
  overall_score: string
  decision_bias: string
  decision_bias_detail: string
  priority: string
}

export interface RuntimeSummaryGovernanceReadiness {
  title: string
  badge: string
}

export interface RuntimeSummaryResponse {
  summary_title: string
  executive_brief: string
  core_pressure: string
  strategic_response: string
  value_thesis: string
  decision_signal: RuntimeSummaryDecisionSignal
  board_note: string
  kpi_cards: RuntimeSummaryKpiCard[]
  strategic_framing: RuntimeSummaryStrategicFramingItem[]
  governance_readiness: RuntimeSummaryGovernanceReadiness
  readiness_signals: RuntimeSummaryReadinessSignal[]
  confidence_score: number
  evidence: RuntimeSummaryEvidence[]
  warnings: string[]
  correlation_id: string
  generated_at?: string
  summary_mode?: string | null
  role_models_used?: Record<string, string> | null
}

export type IdeaSummaryAnalysisStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export interface IdeaSummaryAnalysisStatusResponse {
  status: IdeaSummaryAnalysisStatus
  progress_percent?: number
  error_message?: string | null
  correlation_id?: string | null
}

/** Multi-role Vertex MaaS (3 parallel calls); align with BA timeout on runtime. */
export const MULTI_ROLE_SUMMARY_TIMEOUT_MS = 420_000

const AGENT_ROLE_LABELS: Record<string, string> = {
  business_analyst: 'Business Analyst',
  project_manager: 'Project Manager',
  scrum_master: 'Scrum Master',
}

export function formatAgentRoleLabel(roleId: string): string {
  return AGENT_ROLE_LABELS[roleId] ?? roleId.replace(/_/g, ' ')
}

export function shortMaasModelName(modelId: string): string {
  const segment = modelId.includes('/') ? modelId.split('/').pop() ?? modelId : modelId
  return segment.replace(/-maas$/i, '').replace(/-/g, ' ')
}

export function isMultiRoleSummaryMode(summary: Pick<RuntimeSummaryResponse, 'summary_mode' | 'warnings'>): boolean {
  if (summary.summary_mode === 'role_multi_llm') return true
  return Array.isArray(summary.warnings) && summary.warnings.includes('ROLE_MULTI_LLM_ACTIVE')
}

export interface RoleLlmPrecheckRole {
  role_id: string
  model: string
  status: string
  used_fallback?: boolean
  reason?: string | null
}

export interface RoleLlmPrecheckResponse {
  status: string
  enabled?: boolean
  gcp_project_id?: string
  roles?: RoleLlmPrecheckRole[]
  profiles?: Record<string, Record<string, string | number>>
  message?: string
}

export interface RuntimeBrdRequest {
  idea_id: string
  context: {
    workspace_id?: string | null
    user_id?: string | null
    session_id?: string | null
  }
  idea_context: RuntimeSummaryIdeaContext
  options: {
    allow_llm: boolean
    detail_level?: 'high' | 'very_high'
    layout_polish_mode?: 'conservative' | 'aggressive'
    force_refresh?: boolean
  }
}

export interface RuntimeBrdResponse {
  brd_title: string
  brd_document: string
  confidence_score: number
  warnings: string[]
  correlation_id: string
}

export interface AnalyzeIdeaScoringDimension {
  key: string
  label: string
  score: number
  weight?: number | null
  reason?: string | null
}

export interface AnalyzeIdeaScoringLatest {
  source_mode?: string | null
  total_score?: number | null
  score_dimensions?: AnalyzeIdeaScoringDimension[]
  reason_codes?: string[]
  explainability_summary?: string | null
  summary?: string | null
  scored_at?: string | null
}

export interface AnalyzeIdeaScoringRequest {
  idea_id: string
  context: {
    workspace_id?: string | null
    user_id?: string | null
    session_id?: string | null
  }
  idea: {
    id: string
    title: string
    description?: string | null
    business_objective?: string | null
    scope_summary?: string | null
    risk_summary?: string | null
    status: string
    tags: string[]
  }
  scoring?: AnalyzeIdeaScoringLatest | null
}

export interface AnalyzeIdeaScoringKpiCard {
  label: string
  value: string
  detail: string
}

export interface AnalyzeIdeaScoringResponse {
  status: 'ok' | 'insufficient_data'
  summary_title: string
  executive_brief: string
  priority: string
  overall_score: string
  score_posture: string
  decision_bias: string
  decision_bias_detail: string
  primary_strength: string
  primary_strength_detail: string
  execution_posture: string
  execution_posture_detail: string
  main_watchpoint: string
  main_watchpoint_detail: string
  recommended_action: string
  commentary: string
  positive_signal_title: string
  positive_signal_detail: string
  watchpoint_signal_title: string
  watchpoint_signal_detail: string
  missing_fields: string[]
  kpi_cards: AnalyzeIdeaScoringKpiCard[]
  confidence_score: number
  warnings: string[]
  correlation_id: string
}

export interface AnalyzeIdeaIntegrationRequest {
  idea_id: string
  context: {
    workspace_id?: string | null
    user_id?: string | null
    session_id?: string | null
  }
  idea: {
    id: string
    title: string
    description?: string | null
    business_objective?: string | null
    scope_summary?: string | null
    risk_summary?: string | null
    status: string
    tags: string[]
  }
}

export interface RecommendedIntegrationSystem {
  name: string
  role: string
  source: 'kb' | 'inferred' | ''
  integration_pattern: string
}

export interface AnalyzeIdeaIntegrationResponse {
  status: 'ok' | 'insufficient_data'
  summary_title: string
  executive_brief: string
  plantuml_source: string
  integration_patterns: string[]
  recommended_systems: RecommendedIntegrationSystem[]
  missing_evidence: string[]
  confidence_score: number
  warnings: string[]
  correlation_id: string
}

export type C4ArchitectureLevel = 'L1' | 'L2'

export interface AnalyzeIdeaC4ArchitectureRequest {
  idea_id: string
  level: C4ArchitectureLevel
  context: {
    workspace_id?: string | null
    user_id?: string | null
    session_id?: string | null
  }
  idea: {
    id: string
    title: string
    description?: string | null
    business_objective?: string | null
    scope_summary?: string | null
    risk_summary?: string | null
    status: string
    tags: string[]
  }
}

export interface C4ArchitectureElement {
  name: string
  role: string
  source: 'kb' | 'inferred' | ''
}

export interface AnalyzeIdeaC4ArchitectureResponse {
  status: 'ok' | 'insufficient_data'
  level: C4ArchitectureLevel
  summary_title: string
  executive_brief: string
  plantuml_source: string
  elements: C4ArchitectureElement[]
  missing_evidence: string[]
  confidence_score: number
  warnings: string[]
  correlation_id: string
}

export interface AnalyzeIdeaProcessRequest {
  idea_id: string
  context: {
    workspace_id?: string | null
    user_id?: string | null
    session_id?: string | null
  }
  idea: {
    id: string
    title: string
    description?: string | null
    business_objective?: string | null
    scope_summary?: string | null
    risk_summary?: string | null
    status: string
    tags: string[]
  }
}

export interface ProcessSubTask {
  key: string
  label: string
}

export interface AnalyzeIdeaProcessResponse {
  status: 'ok' | 'insufficient_data'
  summary_title: string
  executive_brief: string
  bpmn_xml: string
  rendered_png_base64: string | null
  sub_processes: ProcessSubTask[]
  missing_evidence: string[]
  confidence_score: number
  warnings: string[]
  correlation_id: string
}

export interface AnalyzeIdeaProcessDetailRequest {
  idea_id: string
  context: {
    workspace_id?: string | null
    user_id?: string | null
    session_id?: string | null
  }
  idea: {
    id: string
    title: string
    description?: string | null
    business_objective?: string | null
    scope_summary?: string | null
    risk_summary?: string | null
    status: string
    tags: string[]
  }
  task_key: string
  task_label: string
  high_level_bpmn_xml: string
}

export interface GenerateBenefitAnalysisRequest {
  idea_id: string
  title: string
  description: string
  scoring_roi: number
  scoring_business_value: number
  scoring_effort: number
  financial_assumptions?: Record<string, number> | null
  mode?: 'deterministic_first' | 'llm_first'
  allow_llm?: boolean
  generate_scenario_analysis?: boolean
  workspace_id?: string | null
  user_id?: string | null
  session_id?: string | null
}

export interface GenerateBenefitAnalysisResponse {
  idea_id: string
  analysis_title: string
  executive_summary: string
  assumptions: Array<{ assumption_key: string; assumption_value: unknown; rationale: string; impact: string }>
  key_metrics: Array<{ metric_name: string; value: number; unit: string; interpretation: string; confidence: number }>
  annual_breakdown: Array<{
    year: number
    costs: number
    efficiency_gains: number
    revenue_gains: number
    net_benefit: number
    cumulative_benefit: number
  }>
  total_development_cost: number
  total_cost_5year: number
  total_benefit_5year: number
  roi_percentage: number
  payback_period_months: number
  npv_5year: number
  benefit_cost_ratio: number
  costs: Array<{ category: string; description: string; amount: number; timing: string; source: string }>
  benefits: Array<{ category: string; description: string; amount: number; timing: string; source: string }>
  scenarios: unknown[]
  calculation_method: string
  confidence_score: number
  presentation_mode?: 'numeric' | 'narrative'
  uses_default_assumptions?: boolean
  narrative_points?: string[]
  llm_insights: string
  key_risks_to_monitor: string[]
  recommendations: string[]
  calculated_at: string
  generated_by: string
  warnings: string[]
}

export interface IdeaConversionSubTask {
  id: string
  title: string
  start_date: string
  end_date: string
  duration_days: number
}

export interface IdeaConversionTask {
  id: string
  title: string
  start_date: string
  end_date: string
  duration_days: number
  sub_tasks: IdeaConversionSubTask[]
}

export interface IdeaConversionEpic {
  id: string
  title: string
  start_date: string
  end_date: string
  duration_days: number
  tasks: IdeaConversionTask[]
}

export interface IdeaConversionSprint {
  id: string
  title: string
  start_date: string
  end_date: string
  duration_days: number
  epics: IdeaConversionEpic[]
}

export interface GenerateIdeaConversionRequest {
  idea_id: string
  title: string
  description?: string
  tags?: string[]
  scoring_business_value?: number
  scoring_effort?: number
  scoring_risk?: number
  scoring_roi?: number
  context?: {
    workspace_id?: string | null
    user_id?: string | null
    user_name?: string | null
    session_id?: string | null
  }
  allow_llm?: boolean
  start_date?: string | null
}

export interface GenerateIdeaConversionResponse {
  idea_id: string
  status: 'ok' | 'insufficient_data'
  summary: string
  sprints: IdeaConversionSprint[]
  confidence_score: number
  warnings: string[]
  correlation_id: string
  generated_at: string
}

export interface GenerateIdeaDraftRequest {
  title: string
  tags?: string[]
  context?: {
    workspace_id?: string | null
    user_id?: string | null
    user_name?: string | null
    session_id?: string | null
  }
}

export interface GenerateIdeaDraftResponse {
  draft_text: string
  language: 'id' | 'en'
  confidence_score: number
  warnings: string[]
  correlation_id: string
}

export type IdeaDraftJobStatus = 'queued' | 'running' | 'awaiting_input' | 'completed' | 'failed' | 'cancelled'
export type IdeaDraftStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface IdeaDraftPlanStep {
  id: string
  label: string
  status: IdeaDraftStepStatus
  detail: string
}

export interface IdeaDraftSimilarItem {
  kind: 'idea' | 'brd' | 'document'
  id: string
  title: string
  similarity_score: number
  status?: string | null
  project_name?: string | null
}

export interface IdeaDraftEvidenceSummary {
  kb_entries: number
  context_entries: number
  standards_used: boolean
  ideas_checked: boolean
  brds_checked: boolean
  sufficient: boolean | null
  quality_score: number
  gaps: string[]
  rationale: string
}

export type IdeaDraftChecklistItemStatus = 'pending' | 'asked' | 'answered' | 'skipped'
export type IdeaDraftEvidenceStatus = 'missing' | 'inferred' | 'partial' | 'confirmed'

export interface IdeaDraftChecklistItem {
  id: string
  prompt: string
  required?: boolean
  status?: IdeaDraftChecklistItemStatus
  // Additive — how good the answer actually is, separate from `status` (workflow position).
  // See the backend IdeaDraftChecklistItem model docstring for what each value means.
  evidence_status?: IdeaDraftEvidenceStatus
  evidence_text?: string | null
}

export interface IdeaDraftEvidenceProgress {
  total: number
  answered: number
  required_total: number
  required_answered: number
  items: IdeaDraftChecklistItem[]
}

// Stage 5 (explainable readiness): how many deep-discovery dimensions (the post-checklist
// "Continue Discovery" loop) have been covered so far — just a count, not which ones.
export interface IdeaDraftDiscoveryProgress {
  covered: number
  total: number
}

export interface IdeaDraftBrainstormMessage {
  role: 'user' | 'assistant'
  text: string
}

export interface IdeaDraftBrainstormResponse {
  messages: IdeaDraftBrainstormMessage[]
  ready_to_continue: boolean
  remaining_gaps: string[]
  intake_checklist?: IdeaDraftChecklistItem[]
  evidence_progress?: IdeaDraftEvidenceProgress
  discovery_progress?: IdeaDraftDiscoveryProgress
  confidence_percent?: number
  offer_generate_anyway?: boolean
}

export interface RestoreIdeaDraftBrainstormRequest {
  title: string
  tags?: string[]
  context?: {
    workspace_id?: string | null
    user_id?: string | null
    user_name?: string | null
    session_id?: string | null
  }
  messages: IdeaDraftBrainstormMessage[]
  remaining_gaps?: string[]
  ready_to_continue?: boolean
}

export interface CreateIdeaDraftJobResponse {
  job_id: string
  status: IdeaDraftJobStatus
  progress_percent: number
  correlation_id: string
}

export interface IdeaDraftJobStatusResponse {
  job_id: string
  status: IdeaDraftJobStatus
  progress_percent: number
  current_step?: string | null
  plan: IdeaDraftPlanStep[]
  similar_documents: IdeaDraftSimilarItem[]
  similar_ideas: IdeaDraftSimilarItem[]
  evidence_summary: IdeaDraftEvidenceSummary
  result?: GenerateIdeaDraftResponse | null
  error_message?: string | null
  warnings: string[]
  brainstorm_messages: IdeaDraftBrainstormMessage[]
  brainstorm_ready?: boolean
  brainstorm_remaining_gaps?: string[]
  intake_checklist?: IdeaDraftChecklistItem[]
  evidence_progress?: IdeaDraftEvidenceProgress
  discovery_progress?: IdeaDraftDiscoveryProgress
  confidence_percent?: number
  offer_generate_anyway?: boolean
  correlation_id: string
}

export interface RuntimeChatUiContext {
  pathname?: string | null
  search?: string | null
  page_title?: string | null
  module_label?: string | null
  view_label?: string | null
  entity_type?: string | null
  entity_id?: string | null
  entity_title?: string | null
  entity_status?: string | null
  workspace_code?: string | null
  workspace_name?: string | null
  project_id?: string | null
  user_display_name?: string | null
  chat_panel_open?: boolean | null
  chat_screen?: string | null
  active_conversation_title?: string | null
  active_conversation_mode?: string | null
  filters_summary?: string | null
  selection_summary?: string | null
  data_summary?: string | null
  extra_notes?: string[]
  preferred_language?: string | null
  platform_roles?: string[] | null
  is_platform_admin?: boolean | null
  workspace_role?: string | null
  can_view_governance?: boolean | null
  can_manage_workspace?: boolean | null
  can_manage_governance?: boolean | null
  can_manage_members?: boolean | null
  active_tenant_workspace_id?: string | null
  active_tenant_workspace_name?: string | null
  accessible_workspaces_summary?: string | null
}

export interface RuntimeChatAttachment {
  id: string
  kind: 'image' | 'document' | 'audio' | 'video' | 'contact' | 'poll' | 'event'
  name: string
  url: string
  mime_type?: string
  subtitle?: string
  event_description?: string
  event_location?: string
}

export interface PersistedChatAttachment {
  id: string
  kind: 'image' | 'document' | 'audio' | 'video' | 'contact' | 'poll' | 'event'
  name: string
  url: string
  mimeType?: string
  subtitle?: string
  eventDescription?: string
  eventLocation?: string
}

export interface RuntimeChatRequest {
  message: string
  context?: {
    workspace_id?: string | null
    user_id?: string | null
    session_id?: string | null
    carryover_from_session_id?: string | null
    ui?: RuntimeChatUiContext | null
    user_attachments?: RuntimeChatAttachment[]
    assistant_attachments?: RuntimeChatAttachment[]
    document_id?: string | null
    document_title?: string | null
  }
  options?: {
    mode?: 'deterministic_first' | 'llm_first'
    allow_llm?: boolean
    max_evidence?: number
  }
}

export type ContextUsageLevel = 'ok' | 'warning' | 'reached'

export interface ContextUsageCategoryItem {
  key: string
  label: string
  chars: number
  tokens: number
  color: string
  share_percent: number
}

export interface ContextUsageReport {
  estimated_chars: number
  estimated_tokens: number
  max_chars: number
  max_tokens: number
  warn_chars: number
  usage_percent: number
  level: ContextUsageLevel
  categories: ContextUsageCategoryItem[]
}

export interface ChatContextUsagePreviewRequest {
  message?: string
  context?: RuntimeChatRequest['context']
}

export interface RuntimeChatEvidence {
  source_service: string
  endpoint: string
  key_ref?: string | null
  details?: Record<string, unknown> | null
}

export interface RuntimePendingDocumentEdit {
  document_id: string
  section_title: string
  location: { table_index: number; row_index: number }
  original_text: string
  proposed_text: string
}

export interface RuntimeChatResponse {
  answer: string
  confidence_score: number
  evidence: RuntimeChatEvidence[]
  warnings: string[]
  correlation_id: string
  session_id?: string | null
  session_title?: string | null
  proposed_actions?: TectonaProposedAction[]
  context_limit_status?: ContextUsageLevel | null
  suggest_new_chat?: boolean
  handoff_available?: boolean
  handoff_from_session_id?: string | null
  context_usage?: ContextUsageReport | null
  usage?: LlmUsagePayload | null
  llm_usage?: LlmUsagePayload | null
  pending_document_edit?: RuntimePendingDocumentEdit | null
}

export type TectonaProposedAction = {
  action_id: string
  action_code:
    | 'app.navigate'
    | 'workspace.create'
    | 'workspace.update'
    | 'workspace.delete'
    | 'workspace.governance.apply'
    | 'workspace.member.add'
    | 'idea.content.inject'
    | 'idea.section.revision'
    | 'document.apply_chat_edit'
    | 'document.transform'
    | 'knowledge.person_alias.add'
  summary: string
  payload: Record<string, unknown>
  risk_level?: 'low' | 'medium' | 'high'
  requires_confirmation?: boolean
}

export interface TectonaAgentGreetRequest {
  session_id?: string | null
  workspace_id?: string | null
  user_id?: string | null
  user_display_name?: string | null
}

export interface TectonaAgentGreetResponse {
  greeting: string
  agent_id: string
  agent_name: string
  capabilities: string[]
  session_id: string
  /** Backend marker: must be "llm" for LLM-only greet contract. */
  greeting_source?: 'llm' | 'deterministic' | string
}

export interface GenAiChatSessionSummary {
  session_id: string
  title: string
  preview: string
  updated_at: string
  business_workspace_id?: string | null
  business_workspace_name?: string | null
}

export interface GenAiChatSessionMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  at: number
  attachments?: PersistedChatAttachment[]
}

export interface UploadChatAttachmentRequest {
  workspace_id: string
  session_id: string
  kind: RuntimeChatAttachment['kind']
  name: string
  data_url: string
  mime_type?: string
  subtitle?: string
  event_description?: string
  event_location?: string
}

export interface UploadChatAttachmentResponse {
  attachment: RuntimeChatAttachment
}

function parseErrorMessage(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return 'Unknown runtime error'

  const value = raw as {
    detail?: unknown
    error?: { message?: unknown }
    message?: unknown
  }

  if (typeof value.error?.message === 'string' && value.error.message.trim()) return value.error.message
  if (typeof value.message === 'string' && value.message.trim()) return value.message
  if (typeof value.detail === 'string' && value.detail.trim()) return value.detail

  return 'Unknown runtime error'
}

function chatContext(
  context?: RuntimeChatRequest['context'],
): NonNullable<RuntimeChatRequest['context']> {
  const session = getSession()
  return {
    workspace_id: context?.workspace_id ?? context?.ui?.workspace_code ?? null,
    user_id: context?.user_id ?? session?.user?.id,
    session_id: context?.session_id,
    carryover_from_session_id: context?.carryover_from_session_id ?? null,
    ui: context?.ui ?? undefined,
    user_attachments: context?.user_attachments ?? [],
    assistant_attachments: context?.assistant_attachments ?? [],
  }
}

function parseRuntimeErrorBody(text: string, status: number): string {
  const trimmed = text.trim()
  if (!trimmed) return `HTTP ${status}`
  const looksLikeGatewayHtml =
    /gateway time-?out/i.test(trimmed) ||
    (trimmed.includes('<html') && /504|502|503/.test(trimmed) && /nginx/i.test(trimmed))
  if (status === 504 || looksLikeGatewayHtml) {
    return 'Generate dokumen melewati batas waktu gateway (504). Template URD butuh beberapa menit — coba lagi, atau generate saat LLM tidak sedang antri.'
  }
  if (status === 502 || status === 503) {
    if (looksLikeGatewayHtml || /bad gateway|service unavailable/i.test(trimmed)) {
      return 'Layanan AI generate dokumen sedang tidak merespons. Coba lagi beberapa saat.'
    }
  }
  try {
    const body = JSON.parse(trimmed) as {
      error?: { message?: string | unknown }
      detail?: string | unknown
      message?: string | unknown
    }
    const candidates = [body?.error?.message, body?.detail, body?.message]
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        const message = candidate.trim()
        if (message === 'IDEA_DRAFT_INVALID_RESPONSE') {
          return 'AI draft response was not usable. Please try Generate Draft again.'
        }
        if (message === 'LLM_DISABLED') {
          return 'AI Assist is temporarily disabled on the agent runtime.'
        }
        return message
      }
    }
  } catch {
    // plain text from proxy or legacy handlers
  }
  if (trimmed === 'IDEA_DRAFT_INVALID_RESPONSE') {
    return 'AI draft response was not usable. Please try Generate Draft again.'
  }
  if (trimmed.startsWith('<') && trimmed.includes('</')) {
    return `HTTP ${status}: layanan AI tidak mengembalikan JSON. Coba lagi.`
  }
  return trimmed
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(parseRuntimeErrorBody(text, res.status))
  }
  return res.json() as Promise<T>
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = 60000): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  const headers = new Headers(tectonaServiceHeaders())
  if (init.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value))
  }

  try {
    return await fetch(input, { ...init, headers, signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s. Please try again.`)
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

export async function generateIdeaSummary(payload: RuntimeSummaryRequest): Promise<RuntimeSummaryResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/v1/agent/generate-idea-summary`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, MULTI_ROLE_SUMMARY_TIMEOUT_MS)
  return handleResponse<RuntimeSummaryResponse>(res)
}

function normalizeIdeaSummaryAnalysisStatus(value: unknown): IdeaSummaryAnalysisStatus | null {
  if (typeof value !== 'string') return null
  const status = value.trim().toLowerCase()
  if (['queued', 'pending', 'created', 'accepted'].includes(status)) return 'queued'
  if (['running', 'processing', 'in_progress', 'analyzing'].includes(status)) return 'running'
  if (['succeeded', 'success', 'completed', 'done', 'ready'].includes(status)) return 'succeeded'
  if (['failed', 'error', 'aborted', 'cancelled'].includes(status)) return 'failed'
  return null
}

function normalizeIdeaSummaryProgress(value: unknown): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined
  if (value <= 1) return Math.round(Math.max(0, Math.min(1, value)) * 100)
  return Math.round(Math.max(0, Math.min(100, value)))
}

/**
 * Optional status polling for idea summary generation.
 * Returns null when status endpoint is unavailable (404/405/501), so callers can fallback safely.
 */
export async function getIdeaSummaryAnalysisStatus(
  ideaId: string,
  correlationId?: string,
): Promise<IdeaSummaryAnalysisStatusResponse | null> {
  const encodedIdeaId = encodeURIComponent(ideaId)
  const candidates = [
    `${BASE_URL}/v1/agent/generate-idea-summary/status/${encodedIdeaId}`,
    `${BASE_URL}/v1/agent/idea-summary-status/${encodedIdeaId}`,
    `${BASE_URL}/v1/agent/ideas/${encodedIdeaId}/summary-status`,
    `${BASE_URL}/v1/agent/ideas/${encodedIdeaId}/summary/status`,
  ]

  for (const endpoint of candidates) {
    const res = await fetchWithTimeout(
      endpoint,
      {
        method: 'GET',
        headers: tectonaServiceHeaders(correlationId ? { 'X-Correlation-Id': correlationId } : undefined),
      },
      15_000,
    )

    if (res.status === 404 || res.status === 405 || res.status === 501) {
      continue
    }
    if (!res.ok) {
      const text = await res.text()
      throw new Error(parseRuntimeErrorBody(text, res.status))
    }

    const payload = (await res.json()) as Record<string, unknown>
    const status =
      normalizeIdeaSummaryAnalysisStatus(payload.status) ??
      normalizeIdeaSummaryAnalysisStatus(payload.state) ??
      normalizeIdeaSummaryAnalysisStatus(payload.analysis_status)

    if (!status) return null

    const progress =
      normalizeIdeaSummaryProgress(payload.progress_percent) ??
      normalizeIdeaSummaryProgress(payload.progress) ??
      normalizeIdeaSummaryProgress(payload.percent) ??
      normalizeIdeaSummaryProgress(payload.completion)

    return {
      status,
      progress_percent: progress,
      error_message:
        typeof payload.error_message === 'string'
          ? payload.error_message
          : typeof payload.error === 'string'
            ? payload.error
            : null,
      correlation_id: typeof payload.correlation_id === 'string' ? payload.correlation_id : null,
    }
  }

  return null
}

export async function fetchRoleLlmPrecheck(): Promise<RoleLlmPrecheckResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/health/role-llm-precheck`, { method: 'GET' }, 120_000)
  return handleResponse<RoleLlmPrecheckResponse>(res)
}

export async function generateIdeaBrd(payload: RuntimeBrdRequest): Promise<RuntimeBrdResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/v1/agent/generate-brd`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 90000)
  return handleResponse<RuntimeBrdResponse>(res)
}

export interface GenerateRepositoryKbDocumentContext {
  file_name: string
  file_type?: string
  file_size?: number
  project_name: string
  project_id: string
  document_id: string
  document_title: string
  document_version_label?: string | null
  document_version_no?: number | null
  existing_summary?: string
  extracted_char_count?: number
  extract_method?: string
  file_truncated?: boolean
  document_text_excerpt?: string
  excerpt_truncated?: boolean
  /** Fuller extracted text (incl. "--- DOCX BODY ---"); used server-side for section assembly only. */
  document_full_text?: string
}

export type RepositoryKbDocumentKind = 'brd' | 'memo_internal' | 'auto'

export interface RepositoryKbDetectedMemoMetadata {
  memo_number?: string | null
  subject?: string | null
  from_unit?: string | null
  to_audience?: string | null
  classification?: string | null
  issued_date?: string | null
  effective_date?: string | null
  supersedes_memo?: string | null
  policy_summary?: string | null
}

export interface RepositoryKbDetectedAttachmentEntry {
  id: string
  title: string
  status?: 'linked' | 'inline' | 'pending_upload' | 'external_ref'
  note?: string | null
}

export interface GenerateRepositoryKbRequest {
  usage_source?: 'user' | 'system'
  context?: {
    workspace_id?: string | null
    user_id?: string | null
    user_name?: string | null
    session_id?: string | null
  }
  document: GenerateRepositoryKbDocumentContext
  document_kind?: RepositoryKbDocumentKind
  detected_toc_entries?: string[]
  detected_applications?: Array<{ name: string; impact?: string | null }>
  detected_stakeholders?: Array<{ name: string; role: string }>
  detected_memo_metadata?: RepositoryKbDetectedMemoMetadata
  detected_attachment_entries?: RepositoryKbDetectedAttachmentEntry[]
  allowed_categories?: Array<{ value: string; label: string }>
  dkm_template_id?: string | null
  options?: { allow_llm?: boolean }
}

export interface RepositoryKbGeneratedPayload {
  kb_title?: string
  kb_naming_class?: string
  kb_primary_name?: string
  kb_secondary_name?: string
  kb_category?: string
  kb_priority?: number
  kb_summary?: string
  kb_content_html?: string
  relation_target_title?: string
  relation_predicate?: string
  relation_reason?: string
}

export interface GenerateRepositoryKbResponse {
  payload: RepositoryKbGeneratedPayload
  warnings: string[]
  correlation_id: string
  used_repair?: boolean
  /** When true, the server already assembled ALL required sections; do not re-assemble them client-side. */
  sections_assembled_server_side?: boolean
}

export interface BrdPurposeDocPayload {
  id?: string
  title?: string
  summary?: string
  purpose?: string
}

export interface CompareBrdPurposeRequest {
  subject: BrdPurposeDocPayload
  candidates: BrdPurposeDocPayload[]
}

export interface BrdPurposeMatchResult {
  id: string
  same_purpose: boolean
  confidence: number
  reason: string
}

export interface CompareBrdPurposeResponse {
  matches: BrdPurposeMatchResult[]
  correlation_id?: string
}

/** LLM judgment of whether candidate BRDs share the same core purpose as the subject. */
export async function compareBrdPurpose(
  payload: CompareBrdPurposeRequest,
  timeoutMs: number = 60_000,
): Promise<CompareBrdPurposeResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/compare-brd-purpose`,
    { method: 'POST', body: JSON.stringify(payload) },
    timeoutMs,
  )
  return handleResponse<CompareBrdPurposeResponse>(res)
}

export interface ExtractRepositoryDocxResponse {
  text: string
  toc_entries: string[]
}

/**
 * Parse Word uploads server-side into marker-delimited text + TOC outline.
 * Supports `.docx` (python-docx) and legacy `.doc` (Gotenberg/LibreOffice → PDF → text).
 * Uses multipart upload, so Content-Type must be left to the browser (boundary).
 */
export async function extractRepositoryDocxStructure(
  file: File,
  timeoutMs: number = 60_000,
): Promise<ExtractRepositoryDocxResponse> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const headers = new Headers(tectonaServiceHeaders())
    headers.delete('Content-Type') // browser sets multipart/form-data with boundary
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE_URL}/v1/agent/extract-repository-docx`, {
      method: 'POST',
      headers,
      body: form,
      signal: controller.signal,
    })
    return handleResponse<ExtractRepositoryDocxResponse>(res)
  } finally {
    window.clearTimeout(timer)
  }
}

export interface ExtractRepositoryPdfResponse {
  text: string
}

/**
 * Extract text from PDF uploads server-side (pypdf).
 */
export async function extractRepositoryPdfText(
  file: File,
  timeoutMs: number = 120_000,
): Promise<ExtractRepositoryPdfResponse> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const headers = new Headers(tectonaServiceHeaders())
    headers.delete('Content-Type')
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE_URL}/v1/agent/extract-repository-pdf`, {
      method: 'POST',
      headers,
      body: form,
      signal: controller.signal,
    })
    return handleResponse<ExtractRepositoryPdfResponse>(res)
  } finally {
    window.clearTimeout(timer)
  }
}

export interface ExtractRepositoryPptxResponse {
  text: string
  toc_entries: string[]
}

/**
 * Parse PowerPoint uploads server-side (python-pptx): slide titles/body/notes/tables.
 * Supports `.pptx` only.
 */
export async function extractRepositoryPptxStructure(
  file: File,
  timeoutMs: number = 60_000,
): Promise<ExtractRepositoryPptxResponse> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const headers = new Headers(tectonaServiceHeaders())
    headers.delete('Content-Type')
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE_URL}/v1/agent/extract-repository-pptx`, {
      method: 'POST',
      headers,
      body: form,
      signal: controller.signal,
    })
    return handleResponse<ExtractRepositoryPptxResponse>(res)
  } finally {
    window.clearTimeout(timer)
  }
}

export interface DescribeImageResponse {
  text: string
}

/**
 * Vision-LLM description of an uploaded image (diagram/screenshot/photo) for KB ingestion —
 * transcribes visible text and describes diagrams/UI/architecture in structured prose.
 */
export async function describeImageViaVision(
  file: File,
  timeoutMs: number = 120_000,
): Promise<DescribeImageResponse> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const headers = new Headers(tectonaServiceHeaders())
    headers.delete('Content-Type')
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE_URL}/v1/agent/describe-image`, {
      method: 'POST',
      headers,
      body: form,
      signal: controller.signal,
    })
    return handleResponse<DescribeImageResponse>(res)
  } finally {
    window.clearTimeout(timer)
  }
}

export async function generateRepositoryKbFromDocument(
  payload: GenerateRepositoryKbRequest,
  timeoutMs: number = 120_000,
): Promise<GenerateRepositoryKbResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/generate-repository-kb`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    timeoutMs,
  )
  return handleResponse<GenerateRepositoryKbResponse>(res)
}

export interface FillDkmTemplatePayload {
  fills?: Record<string, string>
  sections?: Record<string, string>
  collections?: Record<string, Array<Record<string, unknown>>>
  summary?: string
}

export interface FillDkmTemplateRequest {
  template_id: string
  source_text?: string
  instructions?: string
  context?: {
    workspace_id?: string | null
    user_id?: string | null
    session_id?: string | null
  }
  options?: { allow_llm?: boolean }
}

export interface FillDkmTemplateResponse {
  payload: FillDkmTemplatePayload
  template_name?: string
  template_code?: string
  agent_schema?: Record<string, unknown>
  /** Per-placeholder/section facts extracted from the source text before the actual fill call. */
  plan?: Record<string, string>
  warnings: string[]
  correlation_id: string
  used_repair?: boolean
  /** Base64-encoded PNGs of any LLM-authored PlantUML diagrams, keyed by placeholder key. */
  rendered_diagrams?: Record<string, string>
}

export async function fillDkmTemplate(
  payload: FillDkmTemplateRequest,
  timeoutMs: number = 420_000,
): Promise<FillDkmTemplateResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/fill-template`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    timeoutMs,
  )
  return handleResponse<FillDkmTemplateResponse>(res)
}

export interface TemplateSchemaPlaceholderRecommendation {
  key: string
  label?: string
  type?: string
  required?: boolean
  source?: string
  confidence?: number
  reason?: string
  /** Table cell this placeholder maps to (table_index/row_index) — enables precise write-back. */
  location?: { table_index: number; row_index: number } | null
  /** Literal instructional/prompt text from the source cell (e.g. "Provide the project name…"). */
  instruction?: string | null
}

export interface TemplateSchemaSectionRecommendation {
  id: string
  heading?: string
  kind?: string
  min_paragraphs?: number
  source?: string
  confidence?: number
  reason?: string
}

export interface TemplateSchemaRepeaterRecommendation {
  id: string
  collection: string
  kind: 'row' | 'section' | 'table_row' | string
  fields?: string[]
  image_fields?: string[]
  marker?: string | null
  start_marker?: string | null
  end_marker?: string | null
  numbering_prefix?: string | null
  parent_collection?: string | null
  source?: string
  confidence?: number
  reason?: string
  /** Set only for a CANDIDATE repeater (source === 'table_row_repeat_candidate') that has no
   * marker in the document yet — a table shaped like "header row + exactly one data row".
   * Tells the DKM service exactly which table/row to mark once the user confirms it. */
  location?: { table_index?: number; row_index?: number } | null
  /** Human-readable column header text for a table_row candidate, shown in the review UI
   * alongside `fields` (the slugged key form used as the actual marker/schema key). */
  field_labels?: string[]
}

export interface AnalyzeDkmTemplateSchemaRequest {
  template_id: string
  usage_source?: 'user' | 'system'
  document_text?: string
  toc_entries?: string[]
  context?: {
    workspace_id?: string | null
    user_id?: string | null
    session_id?: string | null
  }
  options?: { allow_llm?: boolean }
}

export interface AnalyzeDkmTemplateSchemaResponse {
  document_kind: string
  document_kind_confidence: number
  document_kind_reason: string
  template_format: 'formatted' | 'unformatted' | 'mixed' | string
  summary: string
  placeholders: TemplateSchemaPlaceholderRecommendation[]
  sections: TemplateSchemaSectionRecommendation[]
  repeaters: TemplateSchemaRepeaterRecommendation[]
  compiler: import('@/lib/api/documentKnowledgeApi').TemplateSchemaCompilerResult
  heuristics?: Record<string, unknown>
  warnings: string[]
  correlation_id: string
  used_repair?: boolean
}

export async function analyzeDkmTemplateSchema(
  payload: AnalyzeDkmTemplateSchemaRequest,
  timeoutMs: number = 120_000,
): Promise<AnalyzeDkmTemplateSchemaResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/analyze-template-schema`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    timeoutMs,
  )
  return handleResponse<AnalyzeDkmTemplateSchemaResponse>(res)
}

export interface KbRelationSuggestionEntryInput {
  id: string
  title?: string
  category?: string
  workspace_id?: string | null
  /** Short plain-text excerpt (HTML already stripped by the caller). */
  excerpt?: string
}

export interface KbRelationSuggestionExistingRelationInput {
  source_entry_id: string
  target_entry_id: string
  predicate?: string
}

export interface SuggestKbRelationsRequest {
  context?: {
    workspace_id?: string | null
    user_id?: string | null
    session_id?: string | null
  }
  entries: KbRelationSuggestionEntryInput[]
  existing_relations?: KbRelationSuggestionExistingRelationInput[]
  predicates?: string[]
  options?: { allow_llm?: boolean }
}

export interface KbRelationSuggestion {
  source_entry_id: string
  target_entry_id: string
  predicate: string
  reason: string
  confidence: number
}

export interface SuggestKbRelationsResponse {
  suggestions: KbRelationSuggestion[]
  scanned_entry_count: number
  warnings: string[]
  correlation_id: string
  used_repair?: boolean
}

/** AI scan of a Knowledge Base graph's nodes + existing relations, proposing additional relations
 * between topically-related entries that aren't yet linked. Pure analysis — the caller decides
 * which suggestions to actually create via the KB relations API. */
export async function suggestKbRelations(
  payload: SuggestKbRelationsRequest,
  timeoutMs: number = 120_000,
): Promise<SuggestKbRelationsResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/suggest-kb-relations`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    timeoutMs,
  )
  return handleResponse<SuggestKbRelationsResponse>(res)
}

export async function analyzeIdeaScoring(
  payload: AnalyzeIdeaScoringRequest,
  timeoutMs: number = 150_000,
): Promise<AnalyzeIdeaScoringResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/analyze-idea-scoring`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    timeoutMs,
  )
  return handleResponse<AnalyzeIdeaScoringResponse>(res)
}

export async function analyzeIdeaIntegration(
  payload: AnalyzeIdeaIntegrationRequest,
  timeoutMs: number = 150_000,
): Promise<AnalyzeIdeaIntegrationResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/analyze-idea-integration`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    timeoutMs,
  )
  return handleResponse<AnalyzeIdeaIntegrationResponse>(res)
}

export async function analyzeIdeaC4Architecture(
  payload: AnalyzeIdeaC4ArchitectureRequest,
  timeoutMs: number = 150_000,
): Promise<AnalyzeIdeaC4ArchitectureResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/analyze-idea-c4-architecture`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    timeoutMs,
  )
  return handleResponse<AnalyzeIdeaC4ArchitectureResponse>(res)
}

export async function analyzeIdeaProcess(
  payload: AnalyzeIdeaProcessRequest,
  timeoutMs: number = 180_000,
): Promise<AnalyzeIdeaProcessResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/analyze-idea-process`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    timeoutMs,
  )
  return handleResponse<AnalyzeIdeaProcessResponse>(res)
}

export async function analyzeIdeaProcessDetail(
  payload: AnalyzeIdeaProcessDetailRequest,
  timeoutMs: number = 180_000,
): Promise<AnalyzeIdeaProcessResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/analyze-idea-process-detail`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    timeoutMs,
  )
  return handleResponse<AnalyzeIdeaProcessResponse>(res)
}

export async function generateBenefitAnalysis(
  payload: GenerateBenefitAnalysisRequest,
  timeoutMs: number = 150_000,
): Promise<GenerateBenefitAnalysisResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/generate-benefit-analysis`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    timeoutMs,
  )
  return handleResponse<GenerateBenefitAnalysisResponse>(res)
}

export async function generateIdeaConversion(
  payload: GenerateIdeaConversionRequest,
  timeoutMs: number = 150_000,
): Promise<GenerateIdeaConversionResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/generate-idea-conversion`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    timeoutMs,
  )
  return handleResponse<GenerateIdeaConversionResponse>(res)
}

export async function generateIdeaDraft(
  payload: GenerateIdeaDraftRequest,
  timeoutMs: number = 150_000,
): Promise<GenerateIdeaDraftResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/generate-idea-draft`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    timeoutMs,
  )
  return handleResponse<GenerateIdeaDraftResponse>(res)
}

export async function startIdeaDraftJob(
  payload: GenerateIdeaDraftRequest,
): Promise<CreateIdeaDraftJobResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/idea-draft-jobs`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    // Job creation should normally be immediate, but the gateway/runtime can be
    // briefly busy while the request is authenticated and queued. Keep this
    // above the old 30s cutoff so the UI does not abort a valid draft request
    // before polling can begin.
    120_000,
  )
  return handleResponse<CreateIdeaDraftJobResponse>(res)
}

export async function getIdeaDraftJob(
  jobId: string,
): Promise<IdeaDraftJobStatusResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/idea-draft-jobs/${encodeURIComponent(jobId)}`,
    { method: 'GET' },
    15_000,
  )
  return handleResponse<IdeaDraftJobStatusResponse>(res)
}

export async function cancelIdeaDraftJob(
  jobId: string,
): Promise<IdeaDraftJobStatusResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/idea-draft-jobs/${encodeURIComponent(jobId)}/cancel`,
    { method: 'POST' },
    15_000,
  )
  return handleResponse<IdeaDraftJobStatusResponse>(res)
}

// ── Idea extraction from an uploaded document (Upload Idea) ──────────────────

export type IdeaExtractionCategory = 'Innovation' | 'Improvement' | 'Request' | 'Transformation'

export interface IdeaExtractionCandidate {
  title: string
  category: IdeaExtractionCategory
  description: string
  tags: string[]
  confidence: number
  source_excerpt: string
}

export interface IdeaExtractionDocumentContext {
  file_name: string
  file_type?: string
  file_size?: number
  extract_method?: string
  document_text: string
}

export interface GenerateIdeaExtractionRequest {
  context?: {
    workspace_id?: string | null
    user_id?: string | null
    session_id?: string | null
  }
  document: IdeaExtractionDocumentContext
}

export interface GenerateIdeaExtractionResponse {
  candidates: IdeaExtractionCandidate[]
  warnings: string[]
  correlation_id: string
}

export type IdeaExtractionJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface IdeaExtractionPlanStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  detail: string
}

export interface CreateIdeaExtractionJobResponse {
  job_id: string
  status: IdeaExtractionJobStatus
  progress_percent: number
  correlation_id: string
}

export interface IdeaExtractionJobStatusResponse {
  job_id: string
  status: IdeaExtractionJobStatus
  progress_percent: number
  current_step?: string | null
  plan: IdeaExtractionPlanStep[]
  result?: GenerateIdeaExtractionResponse | null
  error_message?: string | null
  warnings: string[]
  correlation_id: string
}

export async function startIdeaExtractionJob(
  payload: GenerateIdeaExtractionRequest,
): Promise<CreateIdeaExtractionJobResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/idea-extraction-jobs`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    30_000,
  )
  return handleResponse<CreateIdeaExtractionJobResponse>(res)
}

export async function getIdeaExtractionJob(
  jobId: string,
): Promise<IdeaExtractionJobStatusResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/idea-extraction-jobs/${encodeURIComponent(jobId)}`,
    { method: 'GET' },
    15_000,
  )
  return handleResponse<IdeaExtractionJobStatusResponse>(res)
}

export async function renderMermaidFlowchartAsBpmnPng(
  mermaidSource: string,
  language: 'id' | 'en' = 'id',
): Promise<string> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/render-mermaid-bpmn`,
    {
      method: 'POST',
      body: JSON.stringify({ mermaid_source: mermaidSource, language }),
    },
    50_000,
  )
  if (!res.ok) {
    throw new Error(`BPMN render failed (HTTP ${res.status})`)
  }
  const blob = await res.blob()
  if (!blob.size || !/^image\//i.test(blob.type || 'image/png')) {
    throw new Error('BPMN render returned an empty image')
  }
  return URL.createObjectURL(blob)
}

export async function brainstormIdeaDraftJob(
  jobId: string,
  message: string,
): Promise<IdeaDraftBrainstormResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/idea-draft-jobs/${encodeURIComponent(jobId)}/brainstorm`,
    {
      method: 'POST',
      body: JSON.stringify({ message }),
    },
    MULTI_ROLE_SUMMARY_TIMEOUT_MS,
  )
  return handleResponse<IdeaDraftBrainstormResponse>(res)
}

export async function restoreIdeaDraftBrainstormSession(
  payload: RestoreIdeaDraftBrainstormRequest,
): Promise<IdeaDraftJobStatusResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/idea-draft-jobs/restore-brainstorm`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    30_000,
  )
  return handleResponse<IdeaDraftJobStatusResponse>(res)
}

export async function continueIdeaDraftJob(
  jobId: string,
  action: 'generate_anyway' | 'use_brainstorm',
): Promise<IdeaDraftJobStatusResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/idea-draft-jobs/${encodeURIComponent(jobId)}/continue`,
    {
      method: 'POST',
      body: JSON.stringify({ action }),
    },
    30_000,
  )
  return handleResponse<IdeaDraftJobStatusResponse>(res)
}

export type IdeaSummaryJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
export type IdeaSummaryStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface IdeaSummaryPlanStep {
  id: string
  label: string
  status: IdeaSummaryStepStatus
  detail: string
}

export interface CreateIdeaSummaryJobResponse {
  job_id: string
  status: IdeaSummaryJobStatus
  progress_percent: number
  correlation_id: string
  idea_id: string
}

export interface IdeaSummaryJobStatusResponse {
  job_id: string
  status: IdeaSummaryJobStatus
  progress_percent: number
  current_step: string | null
  plan: IdeaSummaryPlanStep[]
  idea_id: string
  result: RuntimeSummaryResponse | null
  error_message: string | null
  warnings: string[]
  correlation_id: string
}

export async function startIdeaSummaryJob(
  payload: RuntimeSummaryRequest,
): Promise<CreateIdeaSummaryJobResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/idea-summary-jobs`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    30_000,
  )
  return handleResponse<CreateIdeaSummaryJobResponse>(res)
}

export async function getIdeaSummaryJob(
  jobId: string,
): Promise<IdeaSummaryJobStatusResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/idea-summary-jobs/${encodeURIComponent(jobId)}`,
    { method: 'GET' },
    15_000,
  )
  return handleResponse<IdeaSummaryJobStatusResponse>(res)
}

export async function cancelIdeaSummaryJob(
  jobId: string,
): Promise<IdeaSummaryJobStatusResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/idea-summary-jobs/${encodeURIComponent(jobId)}/cancel`,
    { method: 'POST' },
    15_000,
  )
  return handleResponse<IdeaSummaryJobStatusResponse>(res)
}

export async function chatWithTectonaAgentRuntime(
  payload: RuntimeChatRequest,
  timeoutMs: number = 90_000,
): Promise<RuntimeChatResponse> {
  const merged: RuntimeChatRequest = {
    ...payload,
    context: chatContext(payload.context),
  }
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/chat`,
    {
      method: 'POST',
      body: JSON.stringify(merged),
    },
    timeoutMs,
  )
  const data = await handleResponse<RuntimeChatResponse>(res)
  return data
}

/** Sidebar chat — uses apiFetch for auth headers and gateway dev routing. */
export async function sendTectonaAgentRuntimeMessage(
  payload: RuntimeChatRequest,
): Promise<RuntimeChatResponse> {
  const merged: RuntimeChatRequest = {
    ...payload,
    context: chatContext(payload.context),
  }

  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/chat`,
    {
      method: 'POST',
      body: JSON.stringify(merged),
    },
    SIDEBAR_CHAT_TIMEOUT_MS,
  )

  if (!res.ok) {
    let errPayload: unknown = null
    try {
      errPayload = await res.json()
    } catch {
      // ignore
    }
    throw new Error(parseErrorMessage(errPayload) || `Runtime request failed (HTTP ${res.status})`)
  }

  const data = (await res.json()) as RuntimeChatResponse
  return data
}

/** Live context budget preview for Gen AI composer (ring + detail panel). */
export async function previewChatContextUsage(
  payload: ChatContextUsagePreviewRequest,
  signal?: AbortSignal,
): Promise<ContextUsageReport> {
  const merged: ChatContextUsagePreviewRequest = {
    ...payload,
    context: chatContext(payload.context),
  }

  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/chat/context-usage/preview`,
    {
      method: 'POST',
      body: JSON.stringify(merged),
      signal,
    },
    15_000,
  )

  if (!res.ok) {
    let errPayload: unknown = null
    try {
      errPayload = await res.json()
    } catch {
      // ignore
    }
    throw new Error(parseErrorMessage(errPayload) || `Context usage preview failed (HTTP ${res.status})`)
  }

  return res.json() as Promise<ContextUsageReport>
}

function assertLlmGreetResponse(data: TectonaAgentGreetResponse): TectonaAgentGreetResponse {
  if (data.greeting_source && data.greeting_source !== 'llm') {
    throw new Error(
      `Sapaan bukan dari LLM (greeting_source=${data.greeting_source}). Restart backend agent runtime.`,
    )
  }
  return data
}

export async function greetTectonaAgent(payload: TectonaAgentGreetRequest): Promise<TectonaAgentGreetResponse> {
  const session = getSession()
  const body: TectonaAgentGreetRequest = {
    session_id: payload.session_id ?? null,
    workspace_id: payload.workspace_id ?? TECTONA_CHAT_WORKSPACE_ID,
    user_id: payload.user_id ?? session?.user?.id ?? null,
    user_display_name: payload.user_display_name ?? session?.user?.name ?? null,
  }

  const postRes = await fetchWithTimeout(
    `${BASE_URL}/v1/agent/greet`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    GREET_LLM_TIMEOUT_MS,
  )
  if (!postRes.ok) {
    let errPayload: unknown = null
    try {
      errPayload = await postRes.json()
    } catch {
      // ignore
    }
    throw new Error(parseErrorMessage(errPayload) || `Greet request failed (HTTP ${postRes.status})`)
  }
  const data = (await postRes.json()) as TectonaAgentGreetResponse
  return assertLlmGreetResponse(data)
}

export async function listGenAiChatSessions(
  workspaceId: string = TECTONA_CHAT_WORKSPACE_ID,
): Promise<GenAiChatSessionSummary[]> {
  const session = getSession()
  const query = new URLSearchParams({ workspace_id: workspaceId })
  if (session?.user?.id) {
    query.set('user_id', session.user.id)
  }
  const res = await apiFetch(`${BASE_URL}/v1/chat/sessions?${query.toString()}`, {
    method: 'GET',
    headers: tectonaServiceHeaders(),
  })
  if (!res.ok) {
    return []
  }
  const data = (await res.json()) as { sessions?: GenAiChatSessionSummary[] }
  return data.sessions ?? []
}

export async function fetchGenAiChatSessionMessages(
  sessionId: string,
  workspaceId: string = TECTONA_CHAT_WORKSPACE_ID,
): Promise<GenAiChatSessionMessage[]> {
  const session = getSession()
  const query = new URLSearchParams({ workspace_id: workspaceId })
  if (session?.user?.id) {
    query.set('user_id', session.user.id)
  }
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/chat/sessions/${encodeURIComponent(sessionId)}/messages?${query.toString()}`,
    { method: 'GET' },
    GENAI_SESSION_FETCH_TIMEOUT_MS,
  )
  if (!res.ok) {
    return []
  }
  const data = (await res.json()) as {
    messages?: Array<
      Omit<GenAiChatSessionMessage, 'attachments'> & {
        attachments?: Array<
          {
            id: string
            kind: string
            name: string
            url: string
            mime_type?: string
            subtitle?: string
            event_description?: string
            event_location?: string
          }
        >
      }
    >
  }
  return (data.messages ?? []).map((m) => ({
    ...m,
    role: m.role === 'user' || m.role === 'assistant' || m.role === 'system' ? m.role : 'assistant',
    attachments: Array.isArray(m.attachments)
      ? m.attachments
          .filter((a) => a && typeof a.url === 'string' && typeof a.name === 'string')
          .map((a) => ({
            id: a.id,
            name: a.name,
            url: a.url,
            kind:
              a.kind === 'image' ||
              a.kind === 'document' ||
              a.kind === 'audio' ||
              a.kind === 'video' ||
              a.kind === 'contact' ||
              a.kind === 'poll' ||
              a.kind === 'event'
                ? a.kind
                : 'document',
            ...(a.mime_type ? { mimeType: a.mime_type } : {}),
            ...(a.subtitle ? { subtitle: a.subtitle } : {}),
            ...(a.event_description ? { eventDescription: a.event_description } : {}),
            ...(a.event_location ? { eventLocation: a.event_location } : {}),
          }))
      : [],
  }))
}

export async function deleteGenAiChatSession(
  sessionId: string,
  workspaceId: string = TECTONA_CHAT_WORKSPACE_ID,
): Promise<boolean> {
  const session = getSession()
  const query = new URLSearchParams({ workspace_id: workspaceId })
  if (session?.user?.id) {
    query.set('user_id', session.user.id)
  }
  const res = await apiFetch(
    `${BASE_URL}/v1/chat/sessions/${encodeURIComponent(sessionId)}?${query.toString()}`,
    {
      method: 'DELETE',
      headers: tectonaServiceHeaders(),
    },
  )
  if (!res.ok) {
    return false
  }
  const data = (await res.json()) as { deleted?: boolean }
  return data.deleted === true
}

export async function uploadChatAttachment(
  payload: UploadChatAttachmentRequest,
): Promise<UploadChatAttachmentResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/v1/chat/attachments/upload`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    60_000,
  )
  return handleResponse<UploadChatAttachmentResponse>(res)
}
