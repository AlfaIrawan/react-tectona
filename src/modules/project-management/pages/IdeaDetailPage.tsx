
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bot,
  Brain,
  Briefcase,
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Copy,
  Cpu,
  CircleHelp,
  DollarSign,
  Download,
  Eraser,
  FileText,
  Gauge,
  GitBranch,
  IndentDecrease,
  IndentIncrease,
  Layers,
  List,
  PaintBucket,
  ListChevronsUpDown,
  ListOrdered,
  ListTree,
  MoveRight,
  Type,
  RefreshCcw,
  Sparkles,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  Target,
  TriangleAlert,
  TrendingUp,
  UserRound,
  Wand2,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  type Edge,
  MarkerType,
  type Node,
  type NodeProps,
  type NodeTypes,
  Position,
  ReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  analyzeIdeaScoring,
  generateBenefitAnalysis,
  generateIdeaBrd,
  generateIdeaConversion,
  formatAgentRoleLabel,
  generateIdeaSummary,
  isMultiRoleSummaryMode,
  shortMaasModelName,
  type GenerateBenefitAnalysisResponse,
  type GenerateIdeaConversionResponse,
  type RuntimeSummaryDecisionSignal,
  type RuntimeSummaryKpiCard,
  type RuntimeSummaryReadinessSignal,
  type RuntimeSummaryResponse,
  type RuntimeSummaryStrategicFramingItem,
} from '@/lib/api/tectonaAgentRuntimeApi'
import {
  extractScoringDimensions,
  getIdeaById,
  patchIdea,
  getPersistentIdeaSummary,
  type ScoringResponseApi,
  upsertPersistentIdeaSummary,
  toBackendStatus,
  toDisplayStatus,
  type IdeaApi,
  type IdeaSummaryPersistent,
} from '@/lib/api/ideaBacklogApi'
import { fetchIdentityUsers, type IdentityUserDto } from '@/lib/api/identityAdminApi'
import {
  fetchWorkspaceMembers,
  TECTONA_WAC_APP_ID,
  wacRoleCodeToUiRole,
  type WacMembershipDto,
} from '@/lib/api/workspaceAccessControlApi'
import { useTectonaPageContextReporter } from '@/lib/chat/useTectonaPageContextReporter'
import { extractProcessDiagramsFromText } from '@/lib/chat/extractProcessDiagrams'
import { AssistantMermaidBlock } from '@/modules/core-shell/components/AssistantMermaidBlock'
import { IdeaConversionTimeline } from '@/modules/project-management/components/IdeaConversionTimeline'

type IdeaStatus = 'New Submission' | 'Under Review' | 'Approved' | 'Rejected' | 'Converted to Project'
type IdeaType = 'Innovation' | 'Improvement' | 'Request' | 'Issue'

type Idea = {
  id: string
  title: string
  description: string
  businessObjective?: string
  scopeSummary?: string
  riskSummary?: string
  type: IdeaType
  submittedBy: string
  workspace?: string
  tags: string[]
  createdAt: string
  reviewer: string
  status: IdeaStatus
  latestScoring?: ScoringResponseApi | null
  scoring: {
    businessValue: number
    effort: number
    risk: number
    roi: number
  }
  version: number
}

type IdeaReviewerOption = {
  subjectId: string
  displayName: string
  roleLabel: string
}

type BrdTemplate = {
  id: string
  name: string
  header: string
  body: string
}

type PanelKey =
  | 'summary'
  | 'brd'
  | 'scoring'
  | 'impact'
  | 'integration'
  | 'process'
  | 'costBenefit'
  | 'conversion'

type BrdSection = {
  key: string
  title: string
  content: string
}

type BpmnKind = 'start' | 'end' | 'task' | 'gateway' | 'dataStore'

type BpmnNodeData = {
  label: string
  kind: BpmnKind
}

type ArchimateLayer = 'business' | 'application' | 'data' | 'technology'

type ArchimateElementNodeData = {
  kind: 'element'
  layer: ArchimateLayer
  stereotype: string
  title: string
  description: string[]
  variant: 'business-role' | 'application-component' | 'application-service' | 'data-object' | 'technology-node'
}

type ArchimateBoundaryNodeData = {
  kind: 'boundary'
  title: string
}

type ArchimateNoteNodeData = {
  kind: 'note'
  title: string
  lines: string[]
}

type ArchimateLegendNodeData = {
  kind: 'legend'
}

type ArchimateNodeData =
  | ArchimateElementNodeData
  | ArchimateBoundaryNodeData
  | ArchimateNoteNodeData
  | ArchimateLegendNodeData

const IDEA_TYPES: IdeaType[] = ['Innovation', 'Improvement', 'Request', 'Issue']

function ideaFromApi(api: IdeaApi): Idea {
  const type: IdeaType = IDEA_TYPES.includes(api.category as IdeaType)
    ? (api.category as IdeaType)
    : 'Innovation'

  return {
    id: api.id,
    title: api.title,
    description: api.description ?? '',
    businessObjective: api.business_objective ?? undefined,
    scopeSummary: api.scope_summary ?? undefined,
    riskSummary: api.risk_summary ?? undefined,
    type,
    submittedBy: api.owner_id?.trim() ?? '',
    workspace: api.workspace_id ?? undefined,
    tags: api.tags,
    createdAt: api.created_date.slice(0, 10),
    reviewer: api.assignee_id ?? 'â€”',
    status: toDisplayStatus(api.status_code),
    latestScoring: api.latest_scoring ?? null,
    scoring: extractScoringDimensions(api.latest_scoring),
    version: api.version,
  }
}

function mapIdentityUserDisplayNames(users: IdentityUserDto[] | null | undefined): Record<string, string> {
  const byId: Record<string, string> = {}
  for (const user of users ?? []) {
    const name = user.display_name?.trim() || user.email?.trim()
    if (!name) continue
    byId[user.id] = name
  }
  return byId
}

const FALLBACK_IDEA: Idea = {
  id: 'IDEA-3105',
  title: 'Deteksi dini risiko keterlambatan persetujuan KPR',
  description:
    'Membangun sistem peringatan dini keterlambatan persetujuan KPR berbasis sinyal SLA dokumen, antrean reviewer, dan validasi lintas entitas multi finance.',
  businessObjective: undefined,
  scopeSummary: undefined,
  riskSummary: undefined,
  type: 'Innovation',
  submittedBy: 'Rani Pramudita',
  workspace: 'Operasi Kredit Ritel',
  tags: ['KPR', 'SLA', 'AI', 'Multi Finance'],
  createdAt: '2026-04-21',
  reviewer: 'Komite Intake Multi Finance',
  status: 'Under Review',
  latestScoring: null,
  scoring: { businessValue: 9, effort: 6, risk: 4, roi: 8 },
  version: 1,
}

const DEFAULT_SUMMARY: RuntimeSummaryResponse = {
  summary_title: 'Sistem deteksi dini keterlambatan persetujuan KPR multi finance',
  executive_brief:
    'Inisiatif ini membangun lapisan peringatan dini berbasis AI yang menggabungkan sinyal SLA dokumen, beban reviewer, dan bottleneck dependensi lintas tim agar intervensi dapat dilakukan sebelum keterlambatan menjadi kritikal.',
  core_pressure:
    'Banyak kasus KPR melewati SLA karena sinyal keterlambatan terlambat terlihat dan prioritas eskalasi antar fungsi belum konsisten.',
  strategic_response:
    'Terapkan sinyal AI untuk memunculkan early warning dan rekomendasi aksi sehingga tim operasional bisa bertindak sebelum antrean memburuk.',
  value_thesis:
    'Menurunkan pelanggaran SLA persetujuan, mempercepat keputusan eskalasi, dan meningkatkan konsistensi layanan pada seluruh entitas multi finance.',
  decision_signal: {
    overall_score: '75',
    decision_bias: 'Accelerate',
    decision_bias_detail: 'Suitable for conversion into structured backlog and delivery planning.',
    priority: 'Medium Priority',
  },
  board_note:
    'AI assessment indicates strong business leverage with manageable delivery risk, making this proposal a credible candidate for executive-backed prioritization.',
  kpi_cards: [
    {
      label: 'Penurunan Pelanggaran SLA',
      value: '-20%',
      detail: 'Target pengurangan kasus approval KPR yang melewati SLA.',
    },
    {
      label: 'Lead Time Intervensi',
      value: '+2.4w',
      detail: 'Tambahan waktu respons sebelum keterlambatan masuk kategori kritikal.',
    },
    {
      label: 'Cakupan Keputusan',
      value: 'Lintas Entitas',
      detail: 'Dampak lintas PMO, Operasi, Risk, Legal, dan Finance Governance.',
    },
    {
      label: 'Postur Eksekusi',
      value: 'Ready',
      detail: 'Cukup matang untuk backlog shaping dan elaborasi BRD.',
    },
  ],
  strategic_framing: [
    {
      title: 'Visibilitas Multi Finance',
      detail: 'Mengkonsolidasikan sinyal keterlambatan persetujuan KPR dari berbagai sistem menjadi satu tampilan operasional.',
    },
    {
      title: 'Disiplin Operasional',
      detail: 'Meningkatkan kualitas pengendalian proses approval sebelum dampak keterlambatan meluas ke tahap pencairan.',
    },
    {
      title: 'Kesesuaian Model Operasi',
      detail: 'Selaras dengan alur intake terstruktur, konversi backlog, dan checkpoint governance yang sudah ada.',
    },
  ],
  governance_readiness: {
    title: 'Signals supporting next-stage approval',
    badge: 'Reviewable',
  },
  readiness_signals: [
    {
        title: 'Business case ready for review',
        detail: 'The value proposition narrative is aligned for cross-functional decision making.',
      tone: 'positive',
    },
    {
        title: 'Integration dependencies need early validation',
        detail: 'Data source confirmation and delivery orchestration should be validated in the BRD phase.',
      tone: 'warning',
    },
    {
        title: 'Stakeholder adoption path is credible',
        detail: 'PMO, Operations, Risk, Legal, and Finance Governance are clearly defined as target users.',
      tone: 'positive',
    },
  ],
  confidence_score: 0.92,
  evidence: [],
  warnings: [],
  correlation_id: '',
}

const EMPTY_RUNTIME_SUMMARY: RuntimeSummaryResponse = {
  summary_title: '',
  executive_brief: '',
  core_pressure: '',
  strategic_response: '',
  value_thesis: '',
  decision_signal: {
    overall_score: '',
    decision_bias: '',
    decision_bias_detail: '',
    priority: '',
  },
  board_note: '',
  kpi_cards: [],
  strategic_framing: [],
  governance_readiness: { title: '', badge: '' },
  readiness_signals: [],
  confidence_score: 0,
  evidence: [],
  warnings: [],
  correlation_id: '',
}

function summaryFromPersistentRecord(record: IdeaSummaryPersistent): RuntimeSummaryResponse {
  const summary = record.summary_json as unknown as RuntimeSummaryResponse
  const generatedAt = summary.generated_at || record.generated_at
  return generatedAt ? { ...summary, generated_at: generatedAt } : summary
}

function buildIdeaSummaryFallback(idea: Idea): RuntimeSummaryResponse {
  const totalScore = idea.scoring.businessValue * 3 + idea.scoring.roi * 3 + (11 - idea.scoring.effort) * 2 + (11 - idea.scoring.risk) * 2
  const priority = totalScore >= 80 ? 'High Priority' : totalScore >= 60 ? 'Medium Priority' : 'Low Priority'
  const decisionBias = totalScore >= 80 ? 'Accelerate' : totalScore >= 60 ? 'Shape First' : 'Refine First'
  const executionPosture = idea.scoring.effort <= 5 && idea.scoring.risk <= 5 ? 'Ready' : idea.scoring.effort <= 7 && idea.scoring.risk <= 7 ? 'Controlled' : 'Caution'
  const workspaceLabel = idea.workspace?.trim() || 'Cross-functional'
  const tagsLabel = idea.tags.length > 0 ? idea.tags.slice(0, 3).join(', ') : 'Priority initiative'

  return {
    summary_title: idea.title,
    executive_brief: `This initiative focuses on ${idea.description.charAt(0).toLowerCase()}${idea.description.slice(1)}. The panel is currently using a local fallback generated from idea data because the AI runtime is not yet available.`,
    core_pressure: `The main need is in the ${tagsLabel} area, with business pressure to improve decision quality, progress visibility, and execution consistency in a ${workspaceLabel} context.`,
    strategic_response: 'Run structured backlog shaping, validate key dependencies, then continue to BRD elaboration so business narrative, execution controls, and implementation readiness stay aligned.',
    value_thesis: `Expected value comes from improving business value ${idea.scoring.businessValue}/10 and ROI ${idea.scoring.roi}/10, while keeping effort ${idea.scoring.effort}/10 and risk ${idea.scoring.risk}/10 manageable.`,
    decision_signal: {
      overall_score: String(totalScore),
      decision_bias: decisionBias,
      decision_bias_detail: 'This local fallback is generated directly from the active idea attributes and intake scores.',
      priority,
    },
    board_note: `The local fallback summary indicates this proposal is currently in ${idea.status} status and still needs the AI runtime for richer evidence-first analysis.`,
    kpi_cards: [
      {
        label: 'Business Value',
        value: `${idea.scoring.businessValue}/10`,
        detail: 'Business impact signal from current intake scoring.',
      },
      {
        label: 'ROI Signal',
        value: `${idea.scoring.roi}/10`,
        detail: 'Indicates potential value leverage and payback.',
      },
      {
        label: 'Execution Context',
        value: workspaceLabel,
        detail: 'Primary workspace or domain affected.',
      },
      {
        label: 'Execution Posture',
        value: executionPosture,
        detail: 'Derived locally from available effort and risk scoring.',
      },
    ],
    strategic_framing: [
      {
        title: 'Context from Intake',
        detail: idea.description,
      },
      {
        title: 'Current Stage',
        detail: `The idea is currently at ${idea.status} stage and waiting for runtime enrichment for a fuller executive narrative.`,
      },
      {
        title: 'Primary Tags',
        detail: tagsLabel,
      },
    ],
    governance_readiness: {
      title: 'Signals supporting next-stage approval',
      badge: totalScore >= 60 ? 'Reviewable' : 'Needs Refinement',
    },
    readiness_signals: [
      {
        title: 'Intake data is available',
        detail: 'Title, description, status, tags, and core scoring are available to generate a local fallback.',
        tone: 'positive',
      },
      {
        title: 'AI runtime is not yet synchronized',
        detail: 'Evidence-first narrative is not available yet, so the panel temporarily uses a local idea-based summary.',
        tone: 'warning',
      },
      {
        title: 'Regeneration needed after runtime recovery',
        detail: 'Run regenerate so summary, KPIs, and board note come from the live runtime.',
        tone: 'warning',
      },
    ],
    confidence_score: 0.92,
    evidence: [],
    warnings: [],
    correlation_id: '',
  }
}

const FALLBACK_KPI_CARDS: RuntimeSummaryKpiCard[] = DEFAULT_SUMMARY.kpi_cards
const FALLBACK_DECISION_SIGNAL: RuntimeSummaryDecisionSignal = DEFAULT_SUMMARY.decision_signal
const FALLBACK_STRATEGIC_FRAMING: RuntimeSummaryStrategicFramingItem[] = DEFAULT_SUMMARY.strategic_framing
const FALLBACK_READINESS_SIGNALS: RuntimeSummaryReadinessSignal[] = DEFAULT_SUMMARY.readiness_signals
const FALLBACK_GOVERNANCE_READINESS = DEFAULT_SUMMARY.governance_readiness

type SummaryWarningTone = 'critical' | 'degraded' | 'info'

type SummaryWarningUi = {
  code: string
  label: string
  detail: string
  tone: SummaryWarningTone
}

const SUMMARY_WARNING_CATALOG: Record<string, Omit<SummaryWarningUi, 'code'>> = {
  RUNTIME_UNAVAILABLE: {
    label: 'Runtime unavailable',
    detail: 'Summary service is unreachable. The panel is showing a local fallback.',
    tone: 'critical',
  },
  IDEA_INTELLIGENCE_TIMEOUT_OR_ERROR: {
    label: 'AI intelligence not connected',
    detail: 'The ai-idea-prioritization dependency is not responding. Summary is generated using available evidence.',
    tone: 'degraded',
  },
  PROJECT_DELIVERY_TIMEOUT_OR_ERROR: {
    label: 'Delivery context not connected',
    detail: 'The project-delivery dependency is not responding. Delivery readiness signals are partial.',
    tone: 'degraded',
  },
  INSUFFICIENT_EVIDENCE: {
    label: 'Limited evidence',
    detail: 'Confidence is not yet optimal because some data sources are incomplete.',
    tone: 'degraded',
  },
  SUMMARY_GENERATION_FAILED: {
    label: 'AI summary failed',
    detail: 'The agent runtime could not produce a summary. See the error message and try Regenerate.',
    tone: 'critical',
  },
  SCORING_GENERATION_FAILED: {
    label: 'AI scoring failed',
    detail: 'The agent runtime could not produce a scoring analysis. See the error message and try Regenerate.',
    tone: 'critical',
  },
  SCORING_DATA_UNAVAILABLE: {
    label: 'Scoring data unavailable',
    detail: 'Direct backlog scoring is absent and runtime also lacks enough cross-system evidence for an honest AI assessment.',
    tone: 'degraded',
  },
  SUMMARY_PERSISTENCE_FAILED: {
    label: 'Summary not saved to database',
    detail:
      'Generation succeeded but idea-backlog rejected the save (version, auth, or schema). Refresh will show empty until Regenerate succeeds with persistence.',
    tone: 'critical',
  },
  ROLE_MULTI_LLM_ACTIVE: {
    label: 'Multi-agent synthesis',
    detail: 'Summary was composed by Business Analyst, Project Manager, and Scrum Master using dedicated models per role.',
    tone: 'info',
  },
  IDEA_BACKLOG_NOT_FOUND: {
    label: 'Backlog data not found',
    detail: 'The idea was not found in backlog service for the current context.',
    tone: 'degraded',
  },
  IDEA_BACKLOG_TIMEOUT: {
    label: 'Backlog access timeout',
    detail: 'Request to backlog service exceeded timeout.',
    tone: 'degraded',
  },
  IDEA_BACKLOG_INVALID_REQUEST: {
    label: 'Invalid backlog request',
    detail: 'Request format to backlog service does not match endpoint contract.',
    tone: 'degraded',
  },
  IDEA_BACKLOG_UPSTREAM_ERROR: {
    label: 'Backlog service error',
    detail: 'Backlog service returned an error while fetching evidence.',
    tone: 'degraded',
  },
  IDEA_BACKLOG_UNAUTHORIZED: {
    label: 'Backlog access denied',
    detail: 'Agent runtime could not authenticate to backlog service. Sign in again or check service token configuration.',
    tone: 'degraded',
  },
  IDEA_BACKLOG_ERROR: {
    label: 'Backlog access issue',
    detail: 'An unexpected issue occurred while fetching backlog evidence.',
    tone: 'degraded',
  },
}

const SUMMARY_WARNING_BADGE_CLASS: Record<SummaryWarningTone, string> = {
  critical: 'border-rose-300 bg-rose-50 text-rose-700',
  degraded: 'border-amber-300 bg-amber-50 text-amber-700',
  info: 'border-sky-300 bg-sky-50 text-sky-700',
}

const ROLE_WARNING_KEY_MAP: Record<string, string> = {
  BUSINESS_ANALYST: 'business_analyst',
  PROJECT_MANAGER: 'project_manager',
  SCRUM_MASTER: 'scrum_master',
}

function summaryHasLlmFallbackWarnings(warnings: string[] | undefined): boolean {
  if (!warnings?.length) return false
  return warnings.some(
    (code) =>
      code === 'LLM_FALLBACK_USED' ||
      code === 'LLM_RESPONSE_PARSE_FALLBACK' ||
      /^ROLE_[A-Z_]+_LLM_FALLBACK$/.test(code) ||
      /^ROLE_[A-Z_]+_LLM_PARSE_FAILED$/.test(code),
  )
}

function parseSummaryGenerationError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  return 'Summary generation failed. Please try again.'
}

function toSummaryWarningUi(code: string): SummaryWarningUi {
  const mapped = SUMMARY_WARNING_CATALOG[code]
  if (mapped) {
    return { code, ...mapped }
  }

  const roleFallback = code.match(/^ROLE_(BUSINESS_ANALYST|PROJECT_MANAGER|SCRUM_MASTER)_LLM_FALLBACK$/)
  if (roleFallback) {
    const roleId = ROLE_WARNING_KEY_MAP[roleFallback[1]] ?? roleFallback[1].toLowerCase()
    const roleLabel = formatAgentRoleLabel(roleId)
    return {
      code,
      label: `${roleLabel} fallback`,
      detail: `The ${roleLabel} model did not return a valid response; that section uses the deterministic draft.`,
      tone: 'degraded',
    }
  }

  const roleParseFailed = code.match(/^ROLE_(BUSINESS_ANALYST|PROJECT_MANAGER|SCRUM_MASTER)_LLM_PARSE_FAILED$/)
  if (roleParseFailed) {
    const roleId = ROLE_WARNING_KEY_MAP[roleParseFailed[1]] ?? roleParseFailed[1].toLowerCase()
    const roleLabel = formatAgentRoleLabel(roleId)
    return {
      code,
      label: `${roleLabel} parse issue`,
      detail: `The ${roleLabel} model responded but JSON could not be parsed; deterministic draft was kept for that role.`,
      tone: 'degraded',
    }
  }

  return {
    code,
    label: 'Other runtime status',
    detail: `Runtime code: ${code}`,
    tone: 'info',
  }
}

type RuntimeScoringCard = {
  label: string
  value: string
  detail: string
}

type RuntimeScoringAnalysis = {
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
  kpi_cards: RuntimeScoringCard[]
}

const EMPTY_RUNTIME_SCORING_ANALYSIS: RuntimeScoringAnalysis = {
  status: 'insufficient_data',
  summary_title: '',
  executive_brief: '',
  priority: '',
  overall_score: '',
  score_posture: '',
  decision_bias: '',
  decision_bias_detail: '',
  primary_strength: '',
  primary_strength_detail: '',
  execution_posture: '',
  execution_posture_detail: '',
  main_watchpoint: '',
  main_watchpoint_detail: '',
  recommended_action: '',
  commentary: '',
  positive_signal_title: '',
  positive_signal_detail: '',
  watchpoint_signal_title: '',
  watchpoint_signal_detail: '',
  missing_fields: [],
  kpi_cards: [],
}

function parseScoringGenerationError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  return 'Scoring analysis failed. Please try again.'
}

function stripCodeFence(value: string): string {
  return value
    .replace(/^```(?:json|markdown|text)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function extractBalancedJsonObject(value: string, startIndex: number): string | null {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = startIndex; i < value.length; i += 1) {
    const ch = value[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth += 1
    if (ch === '}') {
      depth -= 1
      if (depth === 0) return value.slice(startIndex, i + 1)
    }
  }
  return null
}

function extractJsonObject(value: string): string | null {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    const fromFence = extractBalancedJsonObject(fenced[1].trim(), fenced[1].trim().indexOf('{'))
    if (fromFence) return fromFence
  }

  const stripped = stripCodeFence(value)
  if (!stripped) return null
  const first = stripped.indexOf('{')
  if (first === -1) return null
  return extractBalancedJsonObject(stripped, first)
}

function isFallbackLikeRuntimeAnswer(answer: string, warnings: string[] = []): boolean {
  const haystack = `${answer}\n${warnings.join('\n')}`.toLowerCase()
  return [
    'llm_fallback_used',
    'llm_fallback_reason',
    'upstream_auth',
    'billing_disabled',
    'primary_unavailable',
    'saya dapat membantu',
    'i can help',
    'ringkasan keputusan',
    'kesjapan eksekusi',
  ].some((marker) => haystack.includes(marker))
}

function parseRuntimeScoringAnalysis(answer: string): RuntimeScoringAnalysis {
  const jsonText = extractJsonObject(answer)
  if (!jsonText) {
    throw new Error('Scoring analysis did not return valid JSON.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    try {
      parsed = JSON.parse(jsonText.replace(/,\s*([}\]])/g, '$1'))
    } catch {
      throw new Error('Scoring analysis returned malformed JSON.')
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Scoring analysis payload is invalid.')
  }

  const payload = parsed as Record<string, unknown>
  const status = payload.status === 'ok' ? 'ok' : payload.status === 'insufficient_data' ? 'insufficient_data' : null
  if (!status) {
    throw new Error('Scoring analysis status is missing.')
  }

  const toText = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
  const missingFields = Array.isArray(payload.missing_fields)
    ? payload.missing_fields.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
  const kpiCards = Array.isArray(payload.kpi_cards)
    ? payload.kpi_cards
        .map((item) => {
          if (!item || typeof item !== 'object') return null
          const record = item as Record<string, unknown>
          const label = toText(record.label)
          const value = toText(record.value)
          const detail = toText(record.detail)
          if (!label || !value || !detail) return null
          return { label, value, detail }
        })
        .filter((item): item is RuntimeScoringCard => item !== null)
    : []

  return {
    status,
    summary_title: toText(payload.summary_title),
    executive_brief: toText(payload.executive_brief),
    priority: toText(payload.priority),
    overall_score: toText(payload.overall_score),
    score_posture: toText(payload.score_posture),
    decision_bias: toText(payload.decision_bias),
    decision_bias_detail: toText(payload.decision_bias_detail),
    primary_strength: toText(payload.primary_strength),
    primary_strength_detail: toText(payload.primary_strength_detail),
    execution_posture: toText(payload.execution_posture),
    execution_posture_detail: toText(payload.execution_posture_detail),
    main_watchpoint: toText(payload.main_watchpoint),
    main_watchpoint_detail: toText(payload.main_watchpoint_detail),
    recommended_action: toText(payload.recommended_action),
    commentary: toText(payload.commentary),
    positive_signal_title: toText(payload.positive_signal_title),
    positive_signal_detail: toText(payload.positive_signal_detail),
    watchpoint_signal_title: toText(payload.watchpoint_signal_title),
    watchpoint_signal_detail: toText(payload.watchpoint_signal_detail),
    missing_fields: missingFields,
    kpi_cards: kpiCards,
  }
}

function buildScoringAnalysisPrompt(idea: Idea): string {
  const scoring = idea.latestScoring
  const scoringDimensions = (scoring?.score_dimensions ?? []).map((dimension) => ({
    key: dimension.key,
    label: dimension.label,
    score: dimension.score,
    weight: dimension.weight ?? null,
    reason: dimension.reason ?? null,
  }))

  const payload = {
    idea: {
      id: idea.id,
      title: idea.title,
      description: idea.description || null,
      business_objective: idea.businessObjective ?? null,
      scope_summary: idea.scopeSummary ?? null,
      risk_summary: idea.riskSummary ?? null,
      status: idea.status,
      tags: idea.tags,
    },
    scoring: scoring
      ? {
          source_mode: scoring.source_mode,
          total_score: scoring.total_score ?? null,
          score_dimensions: scoringDimensions,
          reason_codes: scoring.reason_codes ?? [],
          explainability_summary: scoring.explainability_summary ?? null,
          summary: scoring.summary ?? null,
          scored_at: scoring.scored_at,
        }
      : null,
  }

  return [
    'Anda adalah analis portfolio dan governance untuk Idea & Backlog.',
    'Gunakan seluruh evidence yang bisa diakses runtime dari Tectona untuk ide ini, termasuk Idea & Backlog, Knowledge Base, dokumen terkait, dan context workspace/delivery bila tersedia.',
    'Analisis HARUS tetap jujur. Jangan mengarang data, jangan pakai fallback, jangan menutup error dengan narasi umum.',
    'Jika direct scoring belum tersedia, Anda tetap boleh menganalisis scoring posture dari evidence lintas Tectona yang berhasil Anda akses. Namun jika evidence nyata tetap tidak cukup, set status = "insufficient_data" dan sebutkan field atau evidence yang kurang di missing_fields.',
    'Jika data cukup, set status = "ok" dan berikan analisa scoring yang tajam, singkat, dan bisa dipakai board.',
    'Jangan menyebut model, fallback, prompt, atau instruksi internal.',
    'Balas STRICT JSON tanpa markdown/code fence dengan schema ini:',
    '{"status":"ok|insufficient_data","summary_title":"","executive_brief":"","priority":"","overall_score":"","score_posture":"","decision_bias":"","decision_bias_detail":"","primary_strength":"","primary_strength_detail":"","execution_posture":"","execution_posture_detail":"","main_watchpoint":"","main_watchpoint_detail":"","recommended_action":"","commentary":"","positive_signal_title":"","positive_signal_detail":"","watchpoint_signal_title":"","watchpoint_signal_detail":"","missing_fields":[""],"kpi_cards":[{"label":"","value":"","detail":""}]}',
    'Aturan:',
    '- overall_score boleh string kosong jika memang tidak ada angka score yang valid atau belum bisa dihitung jujur dari evidence.',
    '- priority, score_posture, decision_bias, primary_strength, execution_posture, main_watchpoint harus sesuai data yang ada; jangan melebih-lebihkan.',
    '- commentary maksimal 3 kalimat.',
    '- kpi_cards maksimal 4 item.',
    '',
    'Data input:',
    JSON.stringify(payload, null, 2),
  ].join('\n')
}

function hasUsableScoringSource(idea: Idea): { ok: boolean; missingFields: string[] } {
  const missingFields: string[] = []
  if (!idea.title.trim()) missingFields.push('idea.title')
  const hasNarrativeContext =
    !!idea.description.trim() ||
    !!(idea.businessObjective ?? '').trim() ||
    !!(idea.scopeSummary ?? '').trim() ||
    !!(idea.riskSummary ?? '').trim() ||
    idea.tags.length > 0
  const hasDirectScoring =
    !!idea.latestScoring?.score_dimensions?.length ||
    typeof idea.latestScoring?.total_score === 'number' ||
    !!idea.latestScoring?.summary?.trim() ||
    !!idea.latestScoring?.explainability_summary?.trim()

  if (!hasNarrativeContext && !hasDirectScoring) {
    missingFields.push('idea_context')
    missingFields.push('scoring_or_kb_evidence')
  }
  return { ok: missingFields.length === 0, missingFields }
}

const statusClass: Record<IdeaStatus, string> = {
  'New Submission': 'bg-amber-50 text-amber-700 border-amber-200',
  'Under Review': 'bg-blue-50 text-blue-700 border-blue-200',
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  'Converted to Project': 'bg-violet-50 text-violet-700 border-violet-200',
}

const typeClass: Record<IdeaType, string> = {
  Innovation: 'bg-sky-100 text-sky-700 border-sky-200',
  Improvement: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Request: 'bg-violet-100 text-violet-700 border-violet-200',
  Issue: 'bg-rose-100 text-rose-700 border-rose-200',
}

const typeAccent: Record<IdeaType, string> = {
  Innovation: '#0ea5e9',
  Improvement: '#10b981',
  Request: '#8b5cf6',
  Issue: '#f43f5e',
}

const INITIAL_BRD_SECTIONS: BrdSection[] = [
  {
    key: 'document-control',
    title: 'Kontrol dokumen',
    content:
      'Document ID: BRD-IDEA-3105. Versi: 0.9 (Draft). Pemilik: Komite Intake Multi Finance. Siklus review: mingguan hingga siap handoff ke eksekusi.',
  },
  {
    key: 'revision-history',
    title: 'Riwayat revisi',
    content:
      'v0.7: Draft awal dari konteks intake. v0.8: Menambah batasan integrasi lintas entitas multi finance. v0.9: Memperjelas kebutuhan fungsional dan kriteria penerimaan.',
  },
  {
    key: 'stakeholders-raci',
    title: 'Stakeholder dan RACI',
    content:
      'Business owner: Head Operasi Kredit Multi Finance. Accountable: Komite Intake Multi Finance. Responsible: Tim Delivery Tectona dan Tim Integrasi. Consulted: Risk, Legal, Finance Controller, Enterprise Architecture. Informed: PMO dan Lead Delivery domain.',
  },
  {
    key: 'executive-summary',
    title: 'Ringkasan eksekutif',
    content:
      'Inisiatif pembangunan sistem deteksi dini keterlambatan persetujuan KPR pada lingkungan multi finance agar keputusan intervensi dapat dilakukan lebih cepat, konsisten, dan terukur.',
  },
  {
    key: 'business-background',
    title: 'Latar belakang bisnis',
    content:
      'Saat ini sinyal keterlambatan persetujuan KPR tersebar di banyak sistem (dokumen, underwriting, legal, dan cabang), sehingga eskalasi sering terlambat dan SLA lintas entitas tidak stabil.',
  },
  {
    key: 'business-case',
    title: 'Business case dan hipotesis nilai',
    content:
      'Outcome utama: penurunan kasus lewat SLA, peningkatan kecepatan keputusan eskalasi, dan penurunan rework operasional. Nilai bisnis datang dari proses persetujuan yang lebih cepat dan konsisten di seluruh entitas multi finance.',
  },
  {
    key: 'problem-statement',
    title: 'Pernyataan masalah',
    content:
      'Pengambilan keputusan masih reaktif sehingga tindakan mitigasi terlambat, volume eskalasi meningkat, dan prediksi pencapaian SLA menjadi kurang andal.',
  },
  {
    key: 'current-state',
    title: 'Analisis kondisi saat ini (as-is)',
    content:
      'Pemantauan antrean dan SLA masih dilakukan manual di beberapa dashboard terpisah. Dampaknya adalah keterlambatan visibilitas, interpretasi tidak seragam antar tim, dan tidak ada standar waktu intervensi.',
  },
  {
    key: 'target-state',
    title: 'Kondisi target (to-be)',
    content:
      'Sistem terpadu berbasis AI menyediakan skor risiko keterlambatan, rekomendasi aksi prioritas, serta evidence audit yang terintegrasi dari intake ide hingga konversi backlog dan eksekusi.',
  },
  {
    key: 'objectives',
    title: 'Tujuan',
    content:
      'Menurunkan pelanggaran SLA persetujuan KPR, mempercepat respons eskalasi lintas fungsi, dan memberi rekomendasi proaktif untuk PMO, Operasi, Risk, dan Finance Governance.',
  },
  {
    key: 'scope-in-out',
    title: 'Ruang lingkup (in/out)',
    content:
      'In scope: akuisisi sinyal SLA, scoring risiko keterlambatan, dashboard operasional, dan orkestrasi eskalasi. Out of scope: perubahan inti transaksi LOS/ERP pada fase pertama.',
  },
  {
    key: 'functional-requirements',
    title: 'Kebutuhan fungsional',
    content:
      'Membangun layanan prediksi keterlambatan, aturan prioritas alert, dan alur keputusan eskalasi yang dapat dikonversi otomatis menjadi epic-story-task di workspace delivery.',
  },
  {
    key: 'data-requirements',
    title: 'Kebutuhan data',
    content:
      'Data wajib mencakup SLA dokumen, durasi approval per tahap, antrean reviewer, status dependensi legal/risk, dan histori outcome persetujuan KPR. Ambang kualitas data dan frekuensi refresh harus ditetapkan.',
  },
  {
    key: 'reporting-requirements',
    title: 'Kebutuhan pelaporan dan dashboard',
    content:
      'Dashboard wajib menampilkan tren skor risiko keterlambatan, faktor penyebab utama, unit/cabang terdampak, rekomendasi aksi, serta jejak audit waktu keputusan.',
  },
  {
    key: 'non-functional-requirements',
    title: 'Kebutuhan non-fungsional',
    content:
      'Mendukung akses API aman, rekomendasi yang dapat diaudit, latensi pembaruan mendekati real-time, dan ketersediaan layanan tinggi.',
  },
  {
    key: 'security-compliance',
    title: 'Kebutuhan keamanan dan kepatuhan',
    content:
      'Kontrol akses berbasis peran, auditability keputusan, serta pengelolaan data harus selaras dengan kebijakan enterprise, regulasi internal, dan standar kontrol audit.',
  },
  {
    key: 'assumptions',
    title: 'Asumsi',
    content:
      'Data historis SLA cukup representatif dan seluruh entitas multi finance bersedia mengadopsi checkpoint review yang seragam.',
  },
  {
    key: 'dependencies',
    title: 'Dependensi',
    content:
      'Ketergantungan utama: API Gateway, pipeline Data Platform, endpoint integrasi LOS/CRM/Legal, serta sinkronisasi workflow ke workspace eksekusi.',
  },
  {
    key: 'constraints',
    title: 'Batasan',
    content:
      'Rollout awal wajib memakai kontrak integrasi yang sudah ada dan cadence governance saat ini, tanpa perubahan skema transaksi inti pada fase pertama.',
  },
  {
    key: 'risk-mitigation',
    title: 'Risiko dan rencana mitigasi',
    content:
      'Risiko utama mencakup drift model, adopsi proses yang tidak seragam, dan latensi integrasi lintas sistem. Mitigasi dilakukan melalui monitoring model, rollout bertahap, dan fallback checkpoint manual.',
  },
  {
    key: 'success-metrics',
    title: 'Metrik keberhasilan (KPI)',
    content:
      'Target KPI: menurunkan kasus pelanggaran SLA persetujuan KPR sebesar 20%, meningkatkan ketepatan prioritas eskalasi, dan menambah waktu intervensi rata-rata sebelum kasus kritikal.',
  },
  {
    key: 'acceptance-criteria',
    title: 'Kriteria penerimaan',
    content:
      'Solusi dinyatakan diterima saat skor risiko terhasilkan stabil, rekomendasi dapat ditelusuri end-to-end, dashboard dipakai pada review rutin, dan perbaikan KPI baseline terbukti terukur.',
  },
  {
    key: 'implementation-plan',
    title: 'Rencana implementasi dan rollout',
    content:
      'Fase 1: integrasi data SLA lintas sistem dan baseline scoring. Fase 2: dashboard operasional dan workflow eskalasi rekomendasi. Fase 3: adopsi lintas entitas multi finance dan optimasi berkelanjutan.',
  },
]

function shortPhrase(text: string, fallback: string) {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return fallback
  const firstSentence = cleaned.split(/[.!?]/)[0]?.trim() || fallback
  return firstSentence.length > 34 ? `${firstSentence.slice(0, 31).trim()}...` : firstSentence
}

function mermaidSafe(label: string) {
  return label.replace(/"/g, "'")
}

function inferBpmnKind(label: string, index: number, total: number): BpmnKind {
  const text = label.toLowerCase()
  if (index === 0) return 'start'
  if (index === total - 1) return 'end'
  if (/(decision|approve|review|priorit|gate)/.test(text)) return 'gateway'
  if (/(dependenc|data|api|platform|integration)/.test(text)) return 'dataStore'
  return 'task'
}

function BpmnNode({ data }: NodeProps<BpmnNodeData>) {
  const baseLabel = (
    <span className="text-[11px] leading-tight text-slate-800 font-medium text-center px-2">{data.label}</span>
  )

  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-slate-600 !border-0 !opacity-0" />

      {data.kind === 'start' && (
        <div className="h-16 w-16 rounded-full border-[2px] border-slate-700 bg-white shadow-[0_8px_20px_-16px_rgba(15,23,42,0.55)] flex items-center justify-center">
          <span className="text-[10px] font-semibold text-slate-700">Start</span>
        </div>
      )}

      {data.kind === 'end' && (
        <div className="relative h-16 w-16 rounded-full border-[2px] border-slate-800 bg-white shadow-[0_8px_20px_-16px_rgba(15,23,42,0.55)] flex items-center justify-center">
          <div className="absolute inset-[8px] rounded-full border-[2px] border-slate-800" />
          <span className="text-[10px] font-semibold text-slate-700">End</span>
        </div>
      )}

      {data.kind === 'task' && (
        <div className="min-h-[62px] w-[220px] rounded-[10px] border border-slate-600 bg-white shadow-[0_10px_22px_-18px_rgba(15,23,42,0.55)] flex items-center justify-center px-2 py-2">
          {baseLabel}
        </div>
      )}

      {data.kind === 'gateway' && (
        <div className="h-[96px] w-[96px] rotate-45 rounded-[8px] border-[1.5px] border-slate-700 bg-white shadow-[0_10px_22px_-18px_rgba(15,23,42,0.55)] flex items-center justify-center">
          <div className="-rotate-45 flex items-center justify-center px-2">
            <span className="text-[10px] leading-tight text-slate-800 font-semibold text-center">{data.label}</span>
          </div>
        </div>
      )}

      {data.kind === 'dataStore' && (
        <div className="min-h-[64px] w-[220px] rounded-[10px] border border-slate-600 bg-white shadow-[0_10px_22px_-18px_rgba(15,23,42,0.55)] overflow-hidden">
          <div className="h-3.5 border-b border-slate-300 bg-slate-100" />
          <div className="flex items-center justify-center px-2 py-2">{baseLabel}</div>
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-slate-600 !border-0 !opacity-0" />
    </div>
  )
}

const bpmnNodeTypes: NodeTypes = { bpmn: BpmnNode }

const archimateLayerStyles: Record<ArchimateLayer, { bg: string; border: string; accent: string; text: string }> = {
  business: { bg: '#f9c78f', border: '#9a6a22', accent: '#9a6a22', text: '#0f172a' },
  application: { bg: '#bfe0ff', border: '#4f7ca8', accent: '#4f7ca8', text: '#0f172a' },
  data: { bg: '#bfe0ff', border: '#4f7ca8', accent: '#4f7ca8', text: '#0f172a' },
  technology: { bg: '#c4f0cb', border: '#4a8a56', accent: '#4a8a56', text: '#0f172a' },
}

function ArchimateElementNode({ data }: NodeProps<ArchimateElementNodeData>) {
  const style = archimateLayerStyles[data.layer]
  const handleClassName = '!h-2 !w-2 !border-0 !bg-slate-600 !opacity-0'

  return (
    <div className="relative">
      <Handle id="target-left" type="target" position={Position.Left} className={handleClassName} />
      <Handle id="target-top" type="target" position={Position.Top} className={handleClassName} />
      <Handle id="target-right" type="target" position={Position.Right} className={handleClassName} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} className={handleClassName} />

      <div
        className="relative overflow-hidden rounded-[18px] border shadow-[0_12px_30px_-22px_rgba(15,23,42,0.45)]"
        style={{ backgroundColor: style.bg, borderColor: style.border, color: style.text }}
      >
        {data.variant === 'technology-node' && (
          <div
            className="absolute left-4 top-0 h-[14px] w-[96px] -translate-y-1/2 rounded-[3px] border"
            style={{ backgroundColor: '#dff7e4', borderColor: style.border }}
          />
        )}

        {data.variant === 'application-component' && (
          <div
            className="absolute left-4 top-4 h-[14px] w-[22px] rounded-[3px] border"
            style={{ backgroundColor: 'rgba(255,255,255,0.72)', borderColor: style.border }}
          />
        )}

        {data.variant === 'application-service' && (
          <div className="absolute left-6 top-5 space-y-1">
            <div className="h-[2px] w-5 rounded-full" style={{ backgroundColor: style.border }} />
            <div className="h-[2px] w-5 rounded-full" style={{ backgroundColor: style.border }} />
          </div>
        )}

        {data.variant === 'business-role' && (
          <div className="absolute left-4 top-4 space-y-1">
            <div className="h-[2px] w-6 rounded-full" style={{ backgroundColor: style.accent }} />
            <div className="h-[2px] w-4 rounded-full" style={{ backgroundColor: style.accent }} />
          </div>
        )}

        {data.variant === 'data-object' && (
          <div
            className="absolute right-4 top-4 h-[14px] w-[18px] rounded-[1px] border"
            style={{ backgroundColor: 'rgba(255,255,255,0.72)', borderColor: style.border }}
          />
        )}

        <div className="flex min-h-[78px] w-full flex-col items-center justify-center px-4 py-4 text-center">
          <p className="text-[11px] font-semibold">{data.stereotype}</p>
          <p className="mt-2 text-[13px] font-semibold leading-tight">{data.title}</p>
          {data.description.map((line) => (
            <p key={line} className="mt-1 text-[11px] leading-4 text-slate-600">
              {line}
            </p>
          ))}
        </div>
      </div>

      <Handle id="source-left" type="source" position={Position.Left} className={handleClassName} />
      <Handle id="source-top" type="source" position={Position.Top} className={handleClassName} />
      <Handle id="source-right" type="source" position={Position.Right} className={handleClassName} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} className={handleClassName} />
    </div>
  )
}

function ArchimateBoundaryNode({ data }: NodeProps<ArchimateBoundaryNodeData>) {
  return (
    <div className="h-full w-full rounded-[18px] border-2 border-dashed border-slate-400/80 bg-white/15 px-4 py-3">
      <p className="text-xs font-semibold text-slate-600">{data.title}</p>
    </div>
  )
}

function ArchimateNoteNode({ data }: NodeProps<ArchimateNoteNodeData>) {
  return (
    <div className="h-full w-full rounded-[16px] border border-slate-200 bg-white/88 px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold text-slate-900">{data.title}</p>
      {data.lines.map((line) => (
        <p key={line} className="mt-1 text-[11px] leading-4 text-slate-600">
          {line}
        </p>
      ))}
    </div>
  )
}

function ArchimateLegendNode() {
  return (
    <div className="h-full w-full rounded-[18px] border border-slate-200 bg-white/92 px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold text-slate-900">Legend Inside Canvas</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-slate-600">
        <span className="rounded-lg border border-[#9a6a22] bg-[#f9c78f] px-3 py-1 font-semibold text-slate-900">Business Role</span>
        <span className="rounded-lg border border-[#4f7ca8] bg-[#bfe0ff] px-3 py-1 font-semibold text-slate-900">App Component / Service</span>
        <span className="rounded-lg border border-[#4f7ca8] bg-[#bfe0ff] px-3 py-1 font-semibold text-slate-900">Data Object</span>
        <span className="rounded-lg border border-[#4a8a56] bg-[#c4f0cb] px-3 py-1 font-semibold text-slate-900">Technology Node</span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-[2px] w-8 bg-slate-900" />
          Serving
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-[2px] w-8 border-t-2 border-dashed border-slate-600" />
          Flow
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-[2px] w-8 border-t-2 border-dotted border-slate-500" />
          Access
        </span>
        <span className="rounded-lg border border-slate-300 border-dashed px-3 py-1 font-semibold text-slate-900">Boundary / Grouping</span>
        <span>ArchiMate-inspired notation</span>
      </div>
    </div>
  )
}

const archimateNodeTypes: NodeTypes = {
  archimateElement: ArchimateElementNode,
  archimateBoundary: ArchimateBoundaryNode,
  archimateNote: ArchimateNoteNode,
  archimateLegend: ArchimateLegendNode,
}

function parseMermaidToReactFlow(mermaidSource: string) {
  const lines = mermaidSource.split('\n').map((line) => line.trim())
  const nodeOrder: string[] = []
  const labels = new Map<string, string>()
  const parsedEdges: Array<{ source: string; target: string }> = []

  const nodeRegex = /^([A-Za-z0-9_]+)\["(.+)"\]$/
  const edgeRegex = /^([A-Za-z0-9_]+)\s*-->\s*([A-Za-z0-9_]+)$/

  for (const line of lines) {
    const nodeMatch = line.match(nodeRegex)
    if (nodeMatch) {
      const [, id, label] = nodeMatch
      if (!labels.has(id)) {
        nodeOrder.push(id)
      }
      labels.set(id, label)
      continue
    }

    const edgeMatch = line.match(edgeRegex)
    if (edgeMatch) {
      const [, source, target] = edgeMatch
      parsedEdges.push({ source, target })
    }
  }

  const maxCols = 4
  const colGap = 260
  const rowGap = 120
  const baseX = 80
  const baseY = 60
  const nodeKindMap = new Map<string, BpmnKind>()

  const nodes: Node[] = nodeOrder.map((id, index) => {
    const row = Math.floor(index / maxCols)
    const col = index % maxCols
    const label = labels.get(id) ?? id
    const kind = inferBpmnKind(label, index, nodeOrder.length)
    nodeKindMap.set(id, kind)

    return {
      id,
      type: 'bpmn',
      position: { x: baseX + col * colGap, y: baseY + row * rowGap },
      data: { label, kind },
      draggable: false,
      selectable: false,
    }
  })

  const edges: Edge[] = parsedEdges.map((edge, index) => ({
    id: `e-${edge.source}-${edge.target}-${index}`,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#334155' },
    style:
      nodeKindMap.get(edge.source) === 'dataStore' || nodeKindMap.get(edge.target) === 'dataStore'
        ? { stroke: '#475569', strokeWidth: 1.7, strokeDasharray: '6 5' }
        : { stroke: '#334155', strokeWidth: 1.8 },
  }))

  return { nodes, edges }
}

function confidenceClass(value: number) {
  if (value >= 90) return 'text-emerald-700 bg-emerald-50 border-emerald-200'
  if (value >= 80) return 'text-blue-700 bg-blue-50 border-blue-200'
  if (value >= 70) return 'text-amber-700 bg-amber-50 border-amber-200'
  return 'text-rose-700 bg-rose-50 border-rose-200'
}

function CollapsiblePanel({
  panelKey,
  title,
  description,
  isOpen,
  onToggle,
  showToggle = true,
  confidence,
  children,
}: {
  panelKey: PanelKey
  title: string
  description: string
  isOpen: boolean
  onToggle: (key: PanelKey) => void
  showToggle?: boolean
  confidence?: number
  children: React.ReactNode
}) {
  return (
    <Card className="glass-card rounded-2xl border-border/30 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base text-slate-900 flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-border/40 bg-white/90">
                <Sparkles className="h-3 w-3 text-slate-600" />
              </span>
              {title}
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {typeof confidence === 'number' && (
              <Badge variant="outline" className={cn('text-[10px] font-semibold', confidenceClass(confidence))}>
                Confidence {confidence}%
              </Badge>
            )}
            {showToggle && (
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => onToggle(panelKey)}>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {isOpen && <CardContent>{children}</CardContent>}
    </Card>
  )
}

const IDEA_DETAIL_SIDEBAR_STORAGE_KEY = 'idea-detail-context-sidebar-collapsed'
const IDEA_DETAIL_BRD_POLISH_MODE_STORAGE_KEY = 'idea-detail-brd-polish-mode'

const IDEA_MENU_ITEMS: Array<{ key: PanelKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'summary', label: 'Summary', icon: ClipboardList },
  { key: 'scoring', label: 'Scoring', icon: Gauge },
  { key: 'impact', label: 'Impact', icon: TrendingUp },
  { key: 'integration', label: 'Integration', icon: Cpu },
  { key: 'process', label: 'Process', icon: GitBranch },
  { key: 'costBenefit', label: 'Cost Benefit', icon: DollarSign },
  { key: 'conversion', label: 'Conversion', icon: Layers },
  { key: 'brd', label: 'BRD', icon: FileText },
]

type IdeaDetailSidebarProps = {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  activePanel: PanelKey
  onNavigatePanel: (key: PanelKey) => void
  status: IdeaStatus
  reviewer: string
  isMetaSaving: boolean
  metaSaveError: string | null
  metaSavedAtLabel: string | null
  reviewerOptions: IdeaReviewerOption[]
  isReviewerOptionsLoading: boolean
  reviewerOptionsError: string
  onStatusChange: (status: IdeaStatus) => void
  onReviewerChange: (value: string) => void
  activeConfidence: number
  isRegenerating: boolean
  onRegenerate: (key: PanelKey) => void
  brdTemplates?: BrdTemplate[]
  brdSelectedTemplateId?: string
  onSelectBrdTemplate?: (templateId: string) => void
  onManageBrdTemplates?: () => void
  brdLayoutPolishMode?: 'conservative' | 'aggressive'
  onBrdLayoutPolishModeChange?: (mode: 'conservative' | 'aggressive') => void
}

function BrdTemplateHeader({
  ideaId,
  title,
  reviewer,
  priority,
  version,
  page,
  totalPages,
}: {
  ideaId: string
  title: string
  reviewer: string
  priority: string
  version: string
  page: number
  totalPages: number
}) {
  return (
    <div className="border border-slate-500">
      <div className="grid grid-cols-[1.15fr_2fr] border-b border-slate-500">
        <div className="border-r border-slate-500 px-2 py-1 text-[10px] leading-4 text-slate-700 font-['Arial',sans-serif]">
          <p>BRD #: {ideaId}</p>
          <p>Priority: {priority}</p>
          <p>Date: {new Date().toLocaleDateString('en-GB')}</p>
          <p>Version: {version}</p>
        </div>
        <div className="px-2 py-1 text-center font-['Arial',sans-serif]">
          <p className="text-[28px] font-semibold leading-8 text-slate-700">Business Requirement Document</p>
          <p className="mt-1 text-[14px] leading-5 text-sky-700">
            Nama System: <span className="font-semibold">{title}</span>
          </p>
        </div>
      </div>
      <div className="px-2 py-1 text-right text-[10px] text-slate-600 font-['Arial',sans-serif]">
        Page {page} of {totalPages} {String.fromCharCode(0xb7)} Owner: {reviewer}
      </div>
    </div>
  )
}
/*
function BrdCanvasText({
  value,
  editable,
  className,
  onChange,
}: {
  value: string
  editable: boolean
  className?: string
  onChange: (nextValue: string) => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!ref.current) return
    // Avoid fighting the user's cursor while typing.
    if (editable && document.activeElement === ref.current) return
    const next = value ?? ''
    if (ref.current.innerText !== next) {
      ref.current.innerText = next
    }
  }, [editable, value])

  return (
    <div
      ref={ref}
      contentEditable={editable}
      suppressContentEditableWarning
      spellCheck={false}
      tabIndex={editable ? 0 : -1}
      role="textbox"
      aria-multiline="true"
      onInput={(event) => onChange(event.currentTarget.innerText.replace(/\u00A0/g, ' '))}
      className={cn(
        'whitespace-pre-wrap rounded-md',
        editable
          ? 'bg-white outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-300/70 focus:bg-white selection:bg-sky-200/60'
          : 'bg-transparent ring-0',
        className
      )}
    />
  )
}

function BrdEditablePlugin({ editable }: { editable: boolean }) {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    editor.setEditable(editable)
  }, [editor, editable])
  return null
}

function BrdLexicalToolbar({ disabled }: { disabled: boolean }) {
  const [editor] = useLexicalComposerContext()

  const insertTable = () => {
    editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows: '4', columns: '5', includeHeaders: true })
  }

  const insertImage = () => {
    const src = window.prompt('Image URL')
    if (!src) return
    const altText = window.prompt('Alt text (optional)') ?? ''
    editor.dispatchCommand(INSERT_BRD_IMAGE_COMMAND, { src, altText })
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1 border border-slate-300 border-b-0 bg-gradient-to-b from-white to-slate-50 px-2 py-1.5', disabled && 'opacity-60 pointer-events-none')}>
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}>
        Undo
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}>
        Redo
      </Button>
      <span className="mx-1 h-4 w-px bg-slate-300" />
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}>
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}>
        <ItalicIcon className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}>
        <UnderlineIcon className="h-3.5 w-3.5" />
      </Button>
      <span className="mx-1 h-4 w-px bg-slate-300" />
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}>
        <List className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}>
        <ListOrdered className="h-3.5 w-3.5" />
      </Button>
      <span className="mx-1 h-4 w-px bg-slate-300" />
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={insertTable}>
        Table
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={insertImage}>
        <ImageIcon className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function BrdPageCanvasEditor({
  page,
  editable,
  value,
  onChange,
}: {
  page: number
  editable: boolean
  value: string
  onChange: (nextValue: string) => void
}) {
  const [initialHtml] = useState(() => value || '<p></p>')
  const initialConfig = useMemo(
    () => ({
      namespace: `brd-page-canvas-${page}`,
      editable,
      onError: (error: Error) => {
        throw error
      },
      nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, TableNode, TableRowNode, TableCellNode, BrdImageNode],
      editorState: (editor: any) => {
        const parser = new DOMParser()
        const dom = parser.parseFromString(initialHtml, 'text/html')
        const nodes = $generateNodesFromDOM(editor, dom)
        const root = $getRoot()
        root.clear()
        if (nodes.length) {
          root.append(...nodes)
        } else {
          const paragraph = $createParagraphNode()
          paragraph.append($createTextNode(''))
          root.append(paragraph)
        }
      },
    }),
    [editable, initialHtml, page]
  )

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="mt-4">
        <BrdLexicalToolbar disabled={!editable} />
        <div className="border border-slate-300 bg-white shadow-inner">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className={cn(
                  "min-h-[860px] px-8 py-6 font-['Aptos','Arial',sans-serif] text-[15px] leading-[1.7] text-slate-900 outline-none",
                  '[&_h1]:mb-2 [&_h1]:text-3xl [&_h1]:font-bold',
                  '[&_h2]:mb-2 [&_h2]:text-2xl [&_h2]:font-semibold',
                  '[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[13px]',
                  '[&_th]:border [&_th]:border-slate-700 [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left',
                  '[&_td]:border [&_td]:border-slate-700 [&_td]:px-2 [&_td]:py-1',
                  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-2'
                )}
              />
            }
            placeholder={<div className="pointer-events-none px-4 py-3 text-sm text-slate-400">Start writing...</div>}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <TablePlugin />
          <BrdImagePlugin />
          <BrdEditablePlugin editable={editable} />
          <OnChangePlugin
            onChange={(editorState, editor) => {
              editorState.read(() => {
                const html = $generateHtmlFromNodes(editor, null)
                onChange(html)
              })
            }}
          />
        </div>
      </div>
    </LexicalComposer>
  )
}
*/
function IdeaDetailSidebar({
  collapsed,
  onCollapsedChange,
  activePanel,
  onNavigatePanel,
  status,
  reviewer,
  isMetaSaving,
  metaSaveError,
  metaSavedAtLabel,
  reviewerOptions,
  isReviewerOptionsLoading,
  reviewerOptionsError,
  onStatusChange,
  onReviewerChange,
  activeConfidence,
  isRegenerating,
  onRegenerate,
  brdTemplates,
  brdSelectedTemplateId,
  onSelectBrdTemplate,
  onManageBrdTemplates,
  brdLayoutPolishMode,
  onBrdLayoutPolishModeChange,
}: IdeaDetailSidebarProps) {
  const activeMenu = IDEA_MENU_ITEMS.find((item) => item.key === activePanel)

  return (
    <aside
      className={cn(
        'fixed right-0 top-12 h-[calc(100vh-3rem)] glass-sidebar border-l border-border/20 transition-all duration-300 z-40',
        collapsed ? 'w-12' : 'w-72'
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border/20 p-2">
          {!collapsed && <span className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Idea Menu</span>}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onCollapsedChange(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        <div
          className="flex-1 overflow-y-auto p-2 space-y-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
        >
          {IDEA_MENU_ITEMS.map((item) => {
            const Icon = item.icon
            const active = activePanel === item.key
            return (
              <Button
                key={item.key}
                type="button"
                variant="ghost"
                onClick={() => onNavigatePanel(item.key)}
                className={cn(
                  'w-full justify-start gap-2 h-9 rounded-lg',
                  collapsed && 'justify-center px-0',
                  active ? 'bg-primary/12 text-primary hover:bg-primary/15' : 'text-muted-foreground hover:text-foreground'
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Button>
            )
          })}

          {!collapsed && (
            <>
              {activePanel === 'brd' && (
                <Card className="mt-2 border-border/30 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">BRD Template</CardTitle>
                    <CardDescription className="text-[11px]">Pilih template atau kelola template BRD.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {(brdTemplates ?? []).map((t) => {
                        const selected = (brdSelectedTemplateId ?? '') === t.id
                        const header = (t.header ?? '').trim()
                        const body = (t.body ?? '').replace(/\u00A0/g, ' ').trim()
                        const bodyPreview = body ? body.split('\n').filter(Boolean).slice(0, 4).join('\n') : ''
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => onSelectBrdTemplate?.(t.id)}
                            className={cn(
                              'group rounded-xl border bg-white p-2 text-left shadow-sm transition',
                              'hover:border-slate-300 hover:bg-slate-50',
                              selected ? 'border-primary/40 ring-2 ring-primary/20' : 'border-slate-200'
                            )}
                            aria-label={`Select BRD template: ${t.name}`}
                            title={t.name}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-[11px] font-semibold text-slate-900">{t.name}</p>
                              {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                            </div>
                            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                              <div className="aspect-[3/4] w-full rounded-md bg-white p-2 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]">
                                {header ? (
                                  <div className="text-[9px] font-semibold text-slate-700 line-clamp-1">{header}</div>
                                ) : (
                                  <div className="text-[9px] text-slate-400">(No header)</div>
                                )}
                                <div className="mt-1 space-y-1">
                                  {(bodyPreview ? bodyPreview.split('\n') : ['']).map((line, idx) => (
                                    <div
                                      key={idx}
                                      className={cn(
                                        'h-2 rounded-sm',
                                        line ? 'bg-slate-200' : 'bg-transparent'
                                      )}
                                      style={{ width: `${Math.max(45, Math.min(100, 92 - idx * 8))}%` }}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    <Button variant="outline" className="w-full h-9" onClick={() => onManageBrdTemplates?.()}>
                      Manage Template BRD
                    </Button>
                  </CardContent>
                </Card>
              )}

            <Card className="mt-2 border-border/30 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Action & Control</CardTitle>
                <CardDescription className="text-[11px]">Status and reviewer updates.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-600">Idea status</p>
                  <select
                    value={status}
                    onChange={(e) => onStatusChange(e.target.value as IdeaStatus)}
                    disabled={isMetaSaving}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="New Submission">New Submission</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Converted to Project">Converted to Project</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-600">Reviewer</p>
                  <select
                    value={reviewer}
                    onChange={(e) => onReviewerChange(e.target.value)}
                    disabled={isMetaSaving || isReviewerOptionsLoading || reviewerOptions.length === 0}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">
                      {isReviewerOptionsLoading
                        ? 'Loading workspace members...'
                        : reviewerOptionsError
                          ? 'Failed to load members'
                          : 'Select workspace member'}
                    </option>
                    {reviewer && !reviewerOptions.some((option) => option.subjectId === reviewer) ? (
                      <option value={reviewer}>{reviewer}</option>
                    ) : null}
                    {reviewerOptions.map((option) => (
                      <option key={option.subjectId} value={option.subjectId}>
                        {option.displayName} ({option.roleLabel})
                      </option>
                    ))}
                  </select>
                  {reviewerOptionsError ? (
                    <p className="text-[11px] text-rose-600">{reviewerOptionsError}</p>
                  ) : null}
                  {isMetaSaving ? (
                    <p className="inline-flex items-center gap-1.5 text-[11px] text-blue-700">
                      <RefreshCcw className="h-3 w-3 animate-spin" />
                      Saving metadata update...
                    </p>
                  ) : null}
                  {!isMetaSaving && !metaSaveError && metaSavedAtLabel ? (
                    <p className="text-[11px] text-emerald-700">Last saved: {metaSavedAtLabel}</p>
                  ) : null}
                  {!isMetaSaving && metaSaveError ? (
                    <p className="text-[11px] text-rose-600">Last update failed: {metaSaveError}</p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">AI Refresh</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {activeMenu ? `${activeMenu.label} panel refresh` : 'Refresh current panel'}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn('text-[10px] font-semibold', confidenceClass(activeConfidence))}>
                      {activeConfidence}%
                    </Badge>
                  </div>

                  {activePanel === 'brd' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-medium text-slate-600">BRD polish mode</p>
                        <CircleHelp
                          className="h-3.5 w-3.5 text-slate-400"
                          aria-label="Conservative: perubahan minimal, menjaga redaksi asli. Aggressive: perapihan lebih kuat untuk keterbacaan dan ketahanan pagination."
                        />
                      </div>
                      <select
                        value={brdLayoutPolishMode ?? 'aggressive'}
                        onChange={(e) => onBrdLayoutPolishModeChange?.(e.target.value as 'conservative' | 'aggressive')}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        disabled={isRegenerating}
                      >
                        <option value="conservative">Conservative (minimal rewrite)</option>
                        <option value="aggressive">Aggressive (strong readability polish)</option>
                      </select>
                      <p className="text-[11px] leading-4 text-slate-500">
                        {(brdLayoutPolishMode ?? 'aggressive') === 'aggressive'
                          ? 'Aggressive cocok saat hasil BRD masih panjang, padat, atau sering rawan terpotong di pergantian halaman.'
                          : 'Conservative cocok saat struktur BRD sudah baik dan Anda hanya ingin perapihan ringan tanpa banyak perubahan redaksi.'}
                      </p>
                      <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-2 py-1.5">
                        <p className="text-[11px] font-medium text-slate-600">Selected mode</p>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-semibold',
                            (brdLayoutPolishMode ?? 'aggressive') === 'aggressive'
                              ? 'border-sky-200 bg-sky-50 text-sky-700'
                              : 'border-slate-300 bg-slate-50 text-slate-700'
                          )}
                        >
                          {(brdLayoutPolishMode ?? 'aggressive') === 'aggressive' ? 'Aggressive' : 'Conservative'}
                        </Badge>
                      </div>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    className="w-full h-9"
                    onClick={() => onRegenerate(activePanel)}
                    disabled={isRegenerating}
                  >
                    <RefreshCcw className={cn('h-3.5 w-3.5 mr-1.5', isRegenerating && 'animate-spin')} />
                    {isRegenerating ? 'Regenerating...' : `Regenerate ${activeMenu?.label ?? 'Panel'}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

export function IdeaDetailPage() {
  const { ideaId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { addToast } = useToast()
  const fromState = location.state as { idea?: Idea } | undefined

  const initialIdea = fromState?.idea ?? { ...FALLBACK_IDEA, id: ideaId ?? FALLBACK_IDEA.id }

  const [idea, setIdea] = useState<Idea>(initialIdea)
  const [identityUserNameById, setIdentityUserNameById] = useState<Record<string, string>>({})
  const [reviewerMemberships, setReviewerMemberships] = useState<WacMembershipDto[]>([])
  const [isReviewerOptionsLoading, setIsReviewerOptionsLoading] = useState(false)
  const [reviewerOptionsError, setReviewerOptionsError] = useState('')
  const [isMetaPatchSaving, setIsMetaPatchSaving] = useState(false)
  const [metaPatchInlineError, setMetaPatchInlineError] = useState<string | null>(null)
  const [metaPatchLastSavedAt, setMetaPatchLastSavedAt] = useState<Date | null>(null)
  const lastMetaToastRef = useRef<{ key: string; at: number } | null>(null)

  const [brdPages, setBrdPages] = useState<string[]>([''])
  const brdPagesRef = useRef<string[]>([''])
  const brdContentNormalizationRef = useRef(false)
  const [brdHeaders, setBrdHeaders] = useState<string[]>([''])
  const brdHeadersRef = useRef<string[]>([''])
  const [editingHeaderIndex, setEditingHeaderIndex] = useState<number | null>(null)
  // Use the same minimum as the ResizeObserver clamp to avoid a one-time re-render
  // that can steal the caret on the first keystroke in the body.
  const [brdHeaderHeights, setBrdHeaderHeights] = useState<number[]>([18])
  const brdHeaderHeightsRef = useRef<number[]>([18])
  const brdPageEditableRefs = useRef<Array<HTMLDivElement | null>>([])
  const brdPageSectionRefs = useRef<Array<HTMLElement | null>>([])
  const brdAutoPaginatingRef = useRef(false)
  const brdMeasureRef = useRef<HTMLDivElement | null>(null)
  const brdWordCountRaf = useRef<number | null>(null)
  const brdWordCountUpdateFnRef = useRef<(count: number) => void>(() => {})
  const [brdActivePageIndex, setBrdActivePageIndex] = useState(0)
  const [brdZoom, setBrdZoom] = useState(0.9)
  const brdViewportRef = useRef<HTMLDivElement | null>(null)
  const [brdMaxZoomFit, setBrdMaxZoomFit] = useState(1.5)
  const [brdFontFamily, setBrdFontFamily] = useState<"Aptos" | "Arial" | "Calibri" | "Times New Roman">('Aptos')
  const [brdFontSize, setBrdFontSize] = useState<11 | 12 | 14 | 15 | 16 | 18>(12)
  const [brdLineHeight, setBrdLineHeight] = useState<1.5 | 1.7 | 2>(1.7)
  const [brdLayoutPolishMode, setBrdLayoutPolishMode] = useState<'conservative' | 'aggressive'>(() => {
    const raw = localStorage.getItem(IDEA_DETAIL_BRD_POLISH_MODE_STORAGE_KEY)
    return raw === 'conservative' || raw === 'aggressive' ? raw : 'aggressive'
  })
  const brdLastFocusedPage = useRef<number>(0)
  const [brdTextColor, setBrdTextColor] = useState('#0f172a')
  const brdTextColorInputRef = useRef<HTMLInputElement | null>(null)
  const brdTextColorButtonRef = useRef<HTMLButtonElement | null>(null)
  const [brdTextColorMenuOpen, setBrdTextColorMenuOpen] = useState(false)
  const brdTextColorMenuRef = useRef<HTMLDivElement | null>(null)
  const [brdTextColorMenuPos, setBrdTextColorMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [brdHighlightColor, setBrdHighlightColor] = useState('#fde047') // yellow-300
  const [brdHighlightMenuOpen, setBrdHighlightMenuOpen] = useState(false)
  const brdHighlightButtonRef = useRef<HTMLButtonElement | null>(null)
  const brdHighlightMenuRef = useRef<HTMLDivElement | null>(null)
  const [brdHighlightMenuPos, setBrdHighlightMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [brdShadingColor, setBrdShadingColor] = useState('#ffffff')
  const [brdShadingMenuOpen, setBrdShadingMenuOpen] = useState(false)
  const brdShadingButtonRef = useRef<HTMLButtonElement | null>(null)
  const brdShadingMenuRef = useRef<HTMLDivElement | null>(null)
  const [brdShadingMenuPos, setBrdShadingMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [brdCaseMenuOpen, setBrdCaseMenuOpen] = useState(false)
  const brdCaseButtonRef = useRef<HTMLButtonElement | null>(null)
  const brdCaseMenuRef = useRef<HTMLDivElement | null>(null)
  const [brdCaseMenuPos, setBrdCaseMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [brdNumberMenuOpen, setBrdNumberMenuOpen] = useState(false)
  const brdNumberButtonRef = useRef<HTMLButtonElement | null>(null)
  const brdNumberMenuRef = useRef<HTMLDivElement | null>(null)
  const [brdNumberMenuPos, setBrdNumberMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [brdBulletMenuOpen, setBrdBulletMenuOpen] = useState(false)
  const brdBulletButtonRef = useRef<HTMLButtonElement | null>(null)
  const brdBulletMenuRef = useRef<HTMLDivElement | null>(null)
  const [brdBulletMenuPos, setBrdBulletMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [brdMultilevelMenuOpen, setBrdMultilevelMenuOpen] = useState(false)
  const brdMultilevelButtonRef = useRef<HTMLButtonElement | null>(null)
  const brdMultilevelMenuRef = useRef<HTMLDivElement | null>(null)
  const [brdMultilevelMenuPos, setBrdMultilevelMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [brdSpacingMenuOpen, setBrdSpacingMenuOpen] = useState(false)
  const brdSpacingButtonRef = useRef<HTMLButtonElement | null>(null)
  const brdSpacingMenuRef = useRef<HTMLDivElement | null>(null)
  const [brdSpacingMenuPos, setBrdSpacingMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [brdStylesMenuOpen, setBrdStylesMenuOpen] = useState(false)
  const brdStylesButtonRef = useRef<HTMLButtonElement | null>(null)
  const brdStylesMenuRef = useRef<HTMLDivElement | null>(null)
  const [brdStylesMenuPos, setBrdStylesMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [brdTableMenuOpen, setBrdTableMenuOpen] = useState(false)
  const brdTableButtonRef = useRef<HTMLButtonElement | null>(null)
  const brdTableMenuRef = useRef<HTMLDivElement | null>(null)
  const [brdTableMenuPos, setBrdTableMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [brdTableHover, setBrdTableHover] = useState<{ rows: number; cols: number } | null>(null)
  const brdLastSelectionRangeRef = useRef<Range | null>(null)
  const [brdExportOpen, setBrdExportOpen] = useState(false)
  const brdExportMenuRef = useRef<HTMLDivElement | null>(null)
  const brdExportButtonRef = useRef<HTMLButtonElement | null>(null)
  const [brdExportMenuPos, setBrdExportMenuPos] = useState<{ top: number; right: number } | null>(null)
  const BRD_TEMPLATE_STORAGE_KEY = 'tectona_brd_templates_v1'
  const BRD_TEMPLATE_SELECTED_KEY = 'tectona_brd_templates_selected_v1'
  const defaultBrdTemplates: BrdTemplate[] = useMemo(
    () => [
      { id: 'blank', name: 'Blank', header: '', body: '' },
      {
        id: 'standard',
        name: 'Standard BRD',
        header: 'Business Requirement Document',
        body:
          '1) Latar Belakang\n- ...\n\n2) Tujuan\n- ...\n\n3) Ruang Lingkup\n- In scope: ...\n- Out of scope: ...\n\n4) Requirement\n- Functional:\n  - ...\n- Non-functional:\n  - ...\n\n5) Asumsi & Risiko\n- ...\n\n6) Kriteria Penerimaan\n- ...',
      },
    ],
    []
  )
  const [brdTemplates, setBrdTemplates] = useState<BrdTemplate[]>(defaultBrdTemplates)
  const [brdSelectedTemplateId, setBrdSelectedTemplateId] = useState<string>('blank')
  const [manageBrdTemplatesOpen, setManageBrdTemplatesOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<BrdTemplate | null>(null)
  const [collapsed, setCollapsed] = useState<Record<PanelKey, boolean>>({
    summary: true,
    brd: true,
    scoring: true,
    impact: true,
    integration: true,
    process: true,
    costBenefit: true,
    conversion: true,
  })
  const [regenerating, setRegenerating] = useState<Record<PanelKey, boolean>>({
    summary: false,
    brd: false,
    scoring: false,
    impact: false,
    integration: false,
    process: false,
    costBenefit: false,
    conversion: false,
  })
  const [confidence, setConfidence] = useState<Record<PanelKey, number>>({
    summary: 92,
    brd: 89,
    scoring: 91,
    impact: 86,
    integration: 82,
    process: 88,
    costBenefit: 79,
    conversion: 90,
  })
  const isBrdGenerating = regenerating.brd
  const [isBrdRenderLocked, setIsBrdRenderLocked] = useState(false)
  const isBrdRenderLockedRef = useRef(false)

  const isUnknownIdentityToken = useCallback((value: string | null | undefined) => {
    const normalized = (value ?? '').trim().toLowerCase()
    return !normalized || normalized === 'unknown' || normalized === 'n/a' || normalized === 'null' || normalized === 'undefined'
  }, [])

  const resolveIdentityDisplayName = useCallback((subjectOrName: string): string => {
    const raw = (subjectOrName ?? '').trim()
    if (isUnknownIdentityToken(raw)) return ''
    const resolved = (identityUserNameById[raw] ?? raw).trim()
    return isUnknownIdentityToken(resolved) ? '' : resolved
  }, [identityUserNameById, isUnknownIdentityToken])

  const runtimeUserId = useMemo(() => {
    const raw = (idea.submittedBy ?? '').trim()
    return isUnknownIdentityToken(raw) ? 'tectona-ui' : raw
  }, [idea.submittedBy, isUnknownIdentityToken])

  const submittedByDisplayName = useMemo(
    () =>
      resolveIdentityDisplayName(idea.submittedBy)
      || resolveIdentityDisplayName(fromState?.idea?.submittedBy ?? '')
      || 'Root',
    [idea.submittedBy, fromState?.idea?.submittedBy, resolveIdentityDisplayName]
  )

  const reviewerDisplayName = useMemo(
    () => resolveIdentityDisplayName(idea.reviewer) || 'â€”',
    [idea.reviewer, resolveIdentityDisplayName]
  )

  // BRD and summary storage keys


  // BRD state (mirrors summary)
  const [runtimeBrd, setRuntimeBrd] = useState<{
    brd_title: string
    brd_document: string
    confidence_score: number
    warnings: string[]
    correlation_id?: string
  }>({
    brd_title: 'Business Requirements Document (BRD)',
    brd_document: buildLocalBrdFallback(),
    confidence_score: 0.89,
    warnings: [],
  })
  const [brdWarnings, setBrdWarnings] = useState<string[]>([])
  const [brdLastRefreshedAt, setBrdLastRefreshedAt] = useState<Date | null>(null)

  // Loader for BRD (mirrors loadRuntimeSummary)
  const loadRuntimeBrd = useCallback(async (
    options: { forceRefresh?: boolean } = {},
  ) => {
    try {
      const response = await generateIdeaBrd({
        idea_id: idea.id,
        context: {
          workspace_id: idea.workspace ?? null,
          user_id: runtimeUserId,
          session_id: `idea-detail-${idea.id}`,
        },
        idea_context: {
          title: idea.title,
          description: idea.description,
          status: idea.status,
          scoring: {
            businessValue: idea.scoring.businessValue,
            effort: idea.scoring.effort,
            risk: idea.scoring.risk,
            roi: idea.scoring.roi,
          },
          tags: idea.tags,
        },
        options: {
          allow_llm: true,
          detail_level: 'very_high',
          layout_polish_mode: brdLayoutPolishMode,
          force_refresh: options.forceRefresh ?? false,
        },
      })
      setRuntimeBrd(response)
      setBrdWarnings(response.warnings)
      const refreshedAt = new Date()
      setBrdLastRefreshedAt(refreshedAt)
      setConfidence((prev) => ({
        ...prev,
        brd: Math.round(Math.max(0, Math.min(1, response.confidence_score)) * 100),
      }))
      return response
    } catch {
      const fallback = {
        brd_title: 'Business Requirements Document (BRD)',
        brd_document: buildLocalBrdFallback(),
        confidence_score: 0.72,
        warnings: ['RUNTIME_UNAVAILABLE'],
      }
      setRuntimeBrd(fallback)
      setBrdWarnings(['RUNTIME_UNAVAILABLE'])
      setBrdLastRefreshedAt(new Date())
      setConfidence((prev) => ({ ...prev, brd: 72 }))
      return fallback
    }
  }, [
    idea.description,
    idea.id,
    idea.scoring.businessValue,
    idea.scoring.effort,
    idea.scoring.risk,
    idea.scoring.roi,
    idea.status,
    runtimeUserId,
    idea.tags,
    idea.title,
    idea.workspace,
    brdLayoutPolishMode,
  ])

  const [runtimeSummary, setRuntimeSummary] = useState<RuntimeSummaryResponse>(EMPTY_RUNTIME_SUMMARY)
  const [summaryLoaded, setSummaryLoaded] = useState(false)
  const [summaryMissing, setSummaryMissing] = useState(false)
  const [summaryWarnings, setSummaryWarnings] = useState<string[]>([])
  const [summaryGenerationError, setSummaryGenerationError] = useState<string | null>(null)
  const [summaryLastRefreshedAt, setSummaryLastRefreshedAt] = useState<Date | null>(null)
  const [runtimeScoringAnalysis, setRuntimeScoringAnalysis] = useState<RuntimeScoringAnalysis>(EMPTY_RUNTIME_SCORING_ANALYSIS)
  const [scoringLoaded, setScoringLoaded] = useState(false)
  const [scoringMissing, setScoringMissing] = useState(false)
  const [scoringWarnings, setScoringWarnings] = useState<string[]>([])
  const [scoringGenerationError, setScoringGenerationError] = useState<string | null>(null)
  const [scoringLastRefreshedAt, setScoringLastRefreshedAt] = useState<Date | null>(null)
  const [benefitAnalysis, setBenefitAnalysis] = useState<GenerateBenefitAnalysisResponse | null>(null)
  const [benefitError, setBenefitError] = useState<string | null>(null)
  const [conversionTimeline, setConversionTimeline] = useState<GenerateIdeaConversionResponse | null>(null)
  const [conversionError, setConversionError] = useState<string | null>(null)
  const [isFreshIdea, setIsFreshIdea] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      const isFresh = !!window.sessionStorage.getItem(`tectona-fresh-idea-${initialIdea.id}`)
      return isFresh
    } catch {
      return false
    }
  })

  function buildLocalBrdFallback() {
    return [
      'I. Overview',
      '',
      'A. Latar Belakang/Background',
      `Inisiatif "${idea.title}" disusun untuk merespons kebutuhan peningkatan kecepatan keputusan, konsistensi proses, dan kendali operasional lintas fungsi. Kondisi saat ini menunjukkan adanya potensi bottleneck pada alur kerja, terutama ketika volume kasus meningkat dan koordinasi antar peran bisnis bergantung pada validasi manual.`,
      '',
      `Secara bisnis, kebutuhan ini dipicu oleh konteks berikut: ${idea.description}. Tanpa perbaikan proses yang terstruktur, organisasi berisiko mengalami peningkatan lead time, ketidaktercapaian SLA, dan meningkatnya biaya rework akibat keputusan yang terlambat atau tidak konsisten.`,
      '',
      'B. Keuntungan/Benefit',
      `Manfaat utama yang ditargetkan meliputi peningkatan akurasi prioritisasi, percepatan eskalasi kasus kritikal, serta peningkatan transparansi status proses bagi seluruh stakeholder terkait. Dari sisi nilai bisnis, indikator business value ${idea.scoring.businessValue}/10 dan ROI ${idea.scoring.roi}/10 menunjukkan peluang manfaat yang kuat bila implementasi dijalankan dengan governance yang disiplin.`,
      '',
      'Selain manfaat finansial, inisiatif ini juga memperkuat ketertelusuran keputusan, memperjelas akuntabilitas antar tim, dan mengurangi ketergantungan terhadap proses ad-hoc. Dampak jangka menengahnya adalah stabilitas proses, kualitas layanan yang lebih konsisten, serta peningkatan kesiapan audit operasional.',
      '',
      'C. Resiko/Risk* (jika diperlukan - Diisi oleh Risk Management)',
      `Risiko awal yang teridentifikasi mencakup risiko kualitas data, mismatch proses lintas unit, dan risiko adopsi pengguna saat transisi ke proses baru. Dengan skor risiko saat ini ${idea.scoring.risk}/10, inisiatif ini masuk kategori terkelola, namun tetap memerlukan risk register formal sebelum implementasi penuh.`,
      '',
      'Bagian ini perlu diperdalam oleh Risk Management untuk menetapkan risk owner, probabilitas dan dampak, kontrol eksisting, kontrol tambahan yang dibutuhkan, trigger eskalasi, serta target residual risk per fase implementasi.',
      '',
      'II. User Requirements',
      '',
      'A. Proses Sebelumnya/Current Process',
      'Proses berjalan saat ini masih bersifat fragmented: intake informasi dilakukan dari beberapa sumber, validasi dilakukan berulang secara manual, dan keputusan eskalasi sangat bergantung pada kapasitas reviewer. Akibatnya, terdapat variasi outcome antar kasus yang seharusnya memiliki karakteristik serupa.',
      '',
      'Urutan proses saat ini secara umum: (1) pengumpulan data dari sumber terpisah, (2) konsolidasi manual oleh tim operasional, (3) review berlapis tanpa SLA keputusan yang seragam, (4) tindakan tindak lanjut yang tidak selalu memiliki owner tunggal, dan (5) pelaporan status yang belum real-time.',
      '',
      'B. Proses yang diharapkan/Modified Process',
      'Proses target dirancang lebih terintegrasi dan berbasis evidence: sistem menerima input terstruktur, memproses prioritas berdasarkan rule dan indikator risiko, menghasilkan rekomendasi aksi, lalu meneruskan keputusan ke owner yang sesuai berdasarkan matriks peran. Setiap tahapan memiliki SLA, checkpoint governance, dan output yang dapat diukur.',
      '',
      'Urutan proses yang diharapkan: (1) intake data otomatis dan tervalidasi, (2) normalisasi data dan scoring terpusat, (3) rekomendasi keputusan berbasis evidence, (4) approval/eskalasi sesuai otorisasi, (5) monitoring KPI dan feedback loop untuk continuous improvement.',
      '',
      'C. Bisnis Divisi Terdampak/Impacted Division Business',
      'Divisi terdampak utama meliputi Operasional, PMO/Delivery, Risk Management, Legal/Compliance, serta tim Platform/Data. Setiap divisi memerlukan kejelasan peran pada input, validasi, keputusan, dan pelaporan agar transisi proses tidak menimbulkan gap eksekusi.',
      '',
      'Perubahan proses akan memengaruhi ritme kerja harian, kebutuhan standar data minimum, mekanisme handoff lintas fungsi, dan jalur eskalasi resmi. Oleh karena itu, perlu disiapkan readiness plan per divisi mencakup sosialisasi proses baru, alignment SOP, dan kriteria kesiapan go-live.',
      '',
      'D. Desain Matriks User/Design User Matrix',
      '| Peran | Tujuan Utama | Akses Sistem | Aksi Utama | Otorisasi |',
      '|---|---|---|---|---|',
      '| Business Owner | Menjaga target outcome bisnis dan SLA | Dashboard KPI, ringkasan status lintas divisi | Menetapkan prioritas dan arah keputusan | Approve prioritas strategis |',
      '| Operational Analyst | Triase dan monitoring harian | Detail kasus, indikator risiko, histori tindakan | Validasi sinyal, eksekusi tindakan awal | Execute sesuai SOP |',
      '| Delivery/PMO Lead | Menjaga orkestrasi implementasi | Backlog, progress, dependensi | Menyusun rencana implementasi dan tracking | Approve rencana kerja |',
      '| Risk Management | Menilai eksposur dan mitigasi | Risk log, audit trail, evidence keputusan | Menetapkan mitigasi dan kontrol tambahan | Approve risk treatment |',
      '| Compliance/Legal | Menjaga kepatuhan kebijakan | Dokumen kontrol, histori persetujuan | Review kepatuhan dan advis regulasi | Approve compliance gate |',
      '| Platform/Data Engineer | Menjamin kualitas data dan integrasi | Pipeline, data quality monitor, integrasi service | Perbaikan alur data dan stabilitas integrasi | Deploy perubahan teknis sesuai kebijakan change |',
    ].join('\n')
  }

  const [brdSections, setBrdSections] = useState<BrdSection[]>(INITIAL_BRD_SECTIONS)
  const [showMermaidCode, setShowMermaidCode] = useState(false)
  const [developModalOpen, setDevelopModalOpen] = useState(false)
  const [targetWorkspace, setTargetWorkspace] = useState('Virea / Delivery Excellence')
  const [developStep, setDevelopStep] = useState<'idle' | 'generating' | 'creating' | 'sending' | 'done'>('idle')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem(IDEA_DETAIL_SIDEBAR_STORAGE_KEY)
    return stored ? JSON.parse(stored) : false
  })
  const [activePanel, setActivePanel] = useState<PanelKey>('summary')

  const ideaPageContext = useMemo(() => {
    const panelItem = IDEA_MENU_ITEMS.find((item) => item.key === activePanel)
    const viewLabel =
      activePanel === 'brd' ? 'BRD (AI-Generated)' : (panelItem?.label ?? 'Detail Ide')
    const fieldState = (value?: string) => ((value ?? '').trim() ? 'terisi' : 'kosong')
    return {
      view_label: viewLabel,
      entity_type: 'idea',
      entity_id: idea.id,
      entity_title: idea.title,
      entity_status: idea.status,
      workspace_name: idea.workspace ?? null,
      data_summary: [
        `scope_summary=${fieldState(idea.scopeSummary)}`,
        `business_objective=${fieldState(idea.businessObjective)}`,
        `risk_summary=${fieldState(idea.riskSummary)}`,
        `description=${fieldState(idea.description)}`,
      ].join('; '),
      notes:
        activePanel === 'brd'
          ? ['panel BRD aktif — editor dokumen AI-Generated BRD']
          : undefined,
    }
  }, [
    activePanel,
    idea.id,
    idea.title,
    idea.status,
    idea.workspace,
    idea.scopeSummary,
    idea.businessObjective,
    idea.riskSummary,
    idea.description,
  ])
  useTectonaPageContextReporter(location.pathname, ideaPageContext)

  const metaSavedAtLabel = useMemo(() => {
    if (!metaPatchLastSavedAt) return null
    return metaPatchLastSavedAt.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }, [metaPatchLastSavedAt])

  const reviewerOptions = useMemo((): IdeaReviewerOption[] => {
    const dedup = new Map<string, IdeaReviewerOption>()
    for (const row of reviewerMemberships) {
      if (dedup.has(row.subject_id)) continue
      const displayName =
        identityUserNameById[row.subject_id]
        || `User ${row.subject_id.slice(0, 8)}`
      const roleLabel = row.role_display_name?.trim() || wacRoleCodeToUiRole(row.role_code)
      dedup.set(row.subject_id, {
        subjectId: row.subject_id,
        displayName,
        roleLabel,
      })
    }
    return [...dedup.values()].sort((a, b) => a.displayName.localeCompare(b.displayName))
  }, [reviewerMemberships, identityUserNameById])

  useEffect(() => {
    let cancelled = false
    setIsReviewerOptionsLoading(true)
    setReviewerOptionsError('')

    const defaultWorkspaceId = 'react-tectona'
    const workspaceCandidates = [idea.workspace?.trim() || '', defaultWorkspaceId]
      .filter((value, index, arr): value is string => !!value && arr.indexOf(value) === index)

    void (async () => {
      let lastError: unknown = null
      for (const workspaceId of workspaceCandidates) {
        try {
          const membersRes = await fetchWorkspaceMembers(TECTONA_WAC_APP_ID, workspaceId)
          if (cancelled) return
          const activeRows = membersRes.items.filter((row) => {
            const status = (row.membership_status ?? row.status_code ?? '').toLowerCase().trim()
            return status === '' || status === 'active'
          })
          setReviewerMemberships(activeRows.length > 0 ? activeRows : membersRes.items)
          setReviewerOptionsError('')
          setIsReviewerOptionsLoading(false)
          return
        } catch (error) {
          lastError = error
        }
      }

      if (cancelled) return
      setReviewerMemberships([])
      setReviewerOptionsError(lastError instanceof Error ? lastError.message : 'Failed to load workspace members.')
      setIsReviewerOptionsLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [idea.workspace])

  useEffect(() => {
    if (reviewerOptions.length === 0) return
    setIdea((prev) => {
      const reviewer = prev.reviewer.trim()
      if (!reviewer || reviewer === 'â€”') {
        return { ...prev, reviewer: reviewerOptions[0].subjectId }
      }
      const hasSubjectMatch = reviewerOptions.some((option) => option.subjectId === reviewer)
      if (hasSubjectMatch) return prev
      const nameMatch = reviewerOptions.find(
        (option) => option.displayName.toLowerCase() === reviewer.toLowerCase()
      )
      if (!nameMatch) return prev
      return { ...prev, reviewer: nameMatch.subjectId }
    })
  }, [reviewerOptions])

  useEffect(() => {
    localStorage.setItem(IDEA_DETAIL_SIDEBAR_STORAGE_KEY, JSON.stringify(sidebarCollapsed))
  }, [sidebarCollapsed])

  useEffect(() => {
    localStorage.setItem(IDEA_DETAIL_BRD_POLISH_MODE_STORAGE_KEY, brdLayoutPolishMode)
  }, [brdLayoutPolishMode])

  const applyRuntimeSummary = useCallback((summary: RuntimeSummaryResponse) => {
    setRuntimeSummary(summary)
    setSummaryWarnings(summary.warnings || [])
    setSummaryLoaded(true)
    setSummaryMissing(false)
    const generatedAt = summary.generated_at ? new Date(summary.generated_at) : null
    setSummaryLastRefreshedAt(
      generatedAt && !Number.isNaN(generatedAt.getTime()) ? generatedAt : null,
    )
    setConfidence((prev) => ({
      ...prev,
      summary: Math.round(Math.max(0, Math.min(1, summary.confidence_score ?? 0)) * 100),
    }))
  }, [])

  const loadRuntimeSummary = useCallback(async (
    mode: 'deterministic_first' | 'llm_first' = 'deterministic_first',
    options: { forceRefresh?: boolean; autoGenerateIfMissing?: boolean } = {},
  ) => {
    setSummaryGenerationError(null)
    try {
      // Refresh / normal visit: load from idea_summary (idea-backlog DB) only.
      // Agent runtime is called only when forceRefresh (Regenerate) or autoGenerateIfMissing (new idea).
      if (!options.forceRefresh) {
        const persistentSummary = await getPersistentIdeaSummary(idea.id)
        if (persistentSummary) {
          const summary = summaryFromPersistentRecord(persistentSummary)
          if (summaryHasLlmFallbackWarnings(summary.warnings)) {
            setSummaryLoaded(false)
            setSummaryMissing(true)
            setRuntimeSummary(EMPTY_RUNTIME_SUMMARY)
            setSummaryGenerationError(
              'Stored summary was generated with a fallback draft. Click Regenerate Summary to run AI again.',
            )
            setSummaryWarnings(['SUMMARY_GENERATION_FAILED'])
            setSummaryLastRefreshedAt(null)
            setConfidence((prev) => ({ ...prev, summary: 0 }))
            return
          }
          applyRuntimeSummary(summary)
          return
        }
        if (!options.autoGenerateIfMissing) {
          setSummaryLoaded(false)
          setSummaryMissing(true)
          setRuntimeSummary(EMPTY_RUNTIME_SUMMARY)
          setSummaryWarnings([])
          setSummaryLastRefreshedAt(null)
          setConfidence((prev) => ({ ...prev, summary: 0 }))
          return
        }
      }

      setSummaryMissing(false)
      const response = await generateIdeaSummary({
        idea_id: idea.id,
        context: {
          workspace_id: idea.workspace ?? null,
          user_id: runtimeUserId,
          session_id: `idea-detail-${idea.id}`,
        },
        idea_context: {
          title: idea.title,
          description: idea.description,
          status: idea.status,
          scoring: {
            businessValue: idea.scoring.businessValue,
            effort: idea.scoring.effort,
            risk: idea.scoring.risk,
            roi: idea.scoring.roi,
          },
          tags: idea.tags,
        },
        options: {
          mode,
          allow_llm: true,
          max_evidence: 10,
          force_refresh: options.forceRefresh ?? false,
        },
      })
      
      applyRuntimeSummary(response)

      const persistMode =
        response.summary_mode === 'deterministic_first' ||
        response.summary_mode === 'llm_first' ||
        response.summary_mode === 'hybrid' ||
        response.summary_mode === 'role_multi_llm'
          ? response.summary_mode
          : 'llm_first'
      let ideaVersion = idea.version ?? 1
      try {
        const freshIdea = await getIdeaById(idea.id)
        ideaVersion = freshIdea.version
        setIdea(ideaFromApi(freshIdea))
      } catch {
        // use cached idea.version when refresh fails
      }
      try {
        await upsertPersistentIdeaSummary(idea.id, {
          summary_json: response as unknown as Record<string, unknown>,
          summary_mode: persistMode,
          confidence_score: response.confidence_score,
          generated_by: runtimeUserId,
          source_session_id: response.correlation_id ?? `idea-detail-${idea.id}`,
          version: ideaVersion,
        })
      } catch (persistError) {
        console.warn('[IdeaDetail] summary persistence from UI failed', persistError)
        setSummaryWarnings((prev) =>
          prev.includes('SUMMARY_PERSISTENCE_FAILED') ? prev : [...prev, 'SUMMARY_PERSISTENCE_FAILED'],
        )
      }
    } catch (error) {
      const message = parseSummaryGenerationError(error)
      const isNetwork =
        error instanceof TypeError ||
        (error instanceof Error &&
          (/fetch|network|timed out|abort/i.test(error.message) || message === 'Failed to fetch'))
      setSummaryLoaded(false)
      setSummaryMissing(!options.forceRefresh)
      setRuntimeSummary(EMPTY_RUNTIME_SUMMARY)
      setSummaryGenerationError(message)
      setSummaryWarnings([isNetwork ? 'RUNTIME_UNAVAILABLE' : 'SUMMARY_GENERATION_FAILED'])
      setSummaryLastRefreshedAt(null)
      setConfidence((prev) => ({ ...prev, summary: 0 }))
    }
  }, [
    applyRuntimeSummary,
    idea.description,
    idea.id,
    idea.scoring.businessValue,
    idea.scoring.effort,
    idea.scoring.risk,
    idea.scoring.roi,
    idea.status,
    runtimeUserId,
    idea.tags,
    idea.title,
    idea.workspace,
  ])

  const applyRuntimeScoringAnalysis = useCallback((analysis: RuntimeScoringAnalysis, warnings: string[] = []) => {
    setRuntimeScoringAnalysis(analysis)
    setScoringLoaded(analysis.status === 'ok')
    setScoringMissing(analysis.status !== 'ok')
    setScoringWarnings(warnings)
    setScoringGenerationError(null)
    setScoringLastRefreshedAt(new Date())
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ ideaId?: string }>).detail
      if (detail?.ideaId !== idea.id) return
      void (async () => {
        try {
          const api = await getIdeaById(idea.id)
          setIdea(ideaFromApi(api))
          const persistentSummary = await getPersistentIdeaSummary(idea.id)
          if (persistentSummary) {
            applyRuntimeSummary(summaryFromPersistentRecord(persistentSummary))
          }
        } catch {
          // Best-effort refresh after assistant inject.
        }
      })()
    }
    window.addEventListener('tectona:idea-updated', handler)
    return () => window.removeEventListener('tectona:idea-updated', handler)
  }, [applyRuntimeSummary, idea.id])

  const loadRuntimeScoring = useCallback(async (
    sourceIdea: Idea = idea,
    options: { forceRefresh?: boolean } = {},
  ) => {
    setScoringGenerationError(null)

    const scoringSourceCheck = hasUsableScoringSource(sourceIdea)
    if (!scoringSourceCheck.ok) {
      setRuntimeScoringAnalysis({
        ...EMPTY_RUNTIME_SCORING_ANALYSIS,
        status: 'insufficient_data',
        summary_title: 'Scoring evidence is not sufficient yet',
        executive_brief: 'Idea & Backlog belum memiliki data scoring yang cukup untuk dianalisis secara jujur.',
        missing_fields: scoringSourceCheck.missingFields,
        commentary: 'Belum ada analisa AI karena data scoring inti belum tersedia.',
      })
      setScoringLoaded(false)
      setScoringMissing(true)
      setScoringWarnings(['SCORING_DATA_UNAVAILABLE'])
      setScoringLastRefreshedAt(null)
      setConfidence((prev) => ({ ...prev, scoring: 0 }))
      return
    }

    try {
      const latestScoring = sourceIdea.latestScoring
      const response = await analyzeIdeaScoring(
        {
          idea_id: sourceIdea.id,
          context: {
            workspace_id: sourceIdea.workspace ?? null,
            user_id: runtimeUserId,
            session_id: null,
          },
          idea: {
            id: sourceIdea.id,
            title: sourceIdea.title,
            description: sourceIdea.description || null,
            business_objective: sourceIdea.businessObjective ?? null,
            scope_summary: sourceIdea.scopeSummary ?? null,
            risk_summary: sourceIdea.riskSummary ?? null,
            status: sourceIdea.status,
            tags: sourceIdea.tags,
          },
          scoring: latestScoring
            ? {
                source_mode: latestScoring.source_mode,
                total_score: latestScoring.total_score ?? null,
                score_dimensions: (latestScoring.score_dimensions ?? []).map((dimension) => ({
                  key: dimension.key,
                  label: dimension.label,
                  score: dimension.score,
                  weight: dimension.weight ?? null,
                  reason: dimension.reason ?? null,
                })),
                reason_codes: latestScoring.reason_codes ?? [],
                explainability_summary: latestScoring.explainability_summary ?? null,
                summary: latestScoring.summary ?? null,
                scored_at: latestScoring.scored_at,
              }
            : null,
        },
        150_000,
      )

      const analysis: RuntimeScoringAnalysis = {
        status: response.status,
        summary_title: response.summary_title,
        executive_brief: response.executive_brief,
        priority: response.priority,
        overall_score: response.overall_score,
        score_posture: response.score_posture,
        decision_bias: response.decision_bias,
        decision_bias_detail: response.decision_bias_detail,
        primary_strength: response.primary_strength,
        primary_strength_detail: response.primary_strength_detail,
        execution_posture: response.execution_posture,
        execution_posture_detail: response.execution_posture_detail,
        main_watchpoint: response.main_watchpoint,
        main_watchpoint_detail: response.main_watchpoint_detail,
        recommended_action: response.recommended_action,
        commentary: response.commentary,
        positive_signal_title: response.positive_signal_title,
        positive_signal_detail: response.positive_signal_detail,
        watchpoint_signal_title: response.watchpoint_signal_title,
        watchpoint_signal_detail: response.watchpoint_signal_detail,
        missing_fields: response.missing_fields ?? [],
        kpi_cards: response.kpi_cards ?? [],
      }
      applyRuntimeScoringAnalysis(analysis, response.warnings ?? [])
      setConfidence((prev) => ({
        ...prev,
        scoring: analysis.status === 'ok'
          ? Math.round(Math.max(0, Math.min(1, response.confidence_score ?? 0)) * 100)
          : 0,
      }))
    } catch (error) {
      const message = parseScoringGenerationError(error)
      const isNetwork =
        error instanceof TypeError ||
        (error instanceof Error && /fetch|network|timed out|abort/i.test(error.message))
      setRuntimeScoringAnalysis(EMPTY_RUNTIME_SCORING_ANALYSIS)
      setScoringLoaded(false)
      setScoringMissing(false)
      setScoringGenerationError(message)
      setScoringWarnings([isNetwork ? 'RUNTIME_UNAVAILABLE' : 'SCORING_GENERATION_FAILED'])
      setScoringLastRefreshedAt(null)
      setConfidence((prev) => ({ ...prev, scoring: 0 }))
    }
  }, [
    applyRuntimeScoringAnalysis,
    idea,
    runtimeUserId,
  ])

  const loadRuntimeBenefit = useCallback(async (sourceIdea: Idea = idea) => {
    setBenefitError(null)
    try {
      const response = await generateBenefitAnalysis({
        idea_id: sourceIdea.id,
        title: sourceIdea.title,
        description: sourceIdea.description || sourceIdea.title,
        scoring_roi: sourceIdea.scoring.roi,
        scoring_business_value: sourceIdea.scoring.businessValue,
        scoring_effort: sourceIdea.scoring.effort,
        allow_llm: true,
        generate_scenario_analysis: true,
        workspace_id: sourceIdea.workspace ?? null,
        user_id: runtimeUserId,
        session_id: null,
      })
      setBenefitAnalysis(response)
      setConfidence((prev) => ({
        ...prev,
        costBenefit: Math.round(Math.max(0, Math.min(1, response.confidence_score ?? 0)) * 100),
      }))
    } catch (error) {
      setBenefitAnalysis(null)
      setBenefitError(error instanceof Error ? error.message : 'Cost benefit analysis failed.')
      setConfidence((prev) => ({ ...prev, costBenefit: 0 }))
    }
  }, [idea, runtimeUserId])

  const loadRuntimeConversion = useCallback(async (sourceIdea: Idea = idea) => {
    setConversionError(null)
    try {
      const response = await generateIdeaConversion({
        idea_id: sourceIdea.id,
        title: sourceIdea.title,
        description: sourceIdea.description || '',
        tags: sourceIdea.tags,
        scoring_business_value: sourceIdea.scoring.businessValue,
        scoring_effort: sourceIdea.scoring.effort,
        scoring_risk: sourceIdea.scoring.risk,
        scoring_roi: sourceIdea.scoring.roi,
        context: {
          workspace_id: sourceIdea.workspace ?? null,
          user_id: runtimeUserId,
          session_id: null,
        },
        allow_llm: true,
      })
      setConversionTimeline(response)
      setConfidence((prev) => ({
        ...prev,
        conversion: Math.round(Math.max(0, Math.min(1, response.confidence_score ?? 0)) * 100),
      }))
    } catch (error) {
      setConversionTimeline(null)
      setConversionError(error instanceof Error ? error.message : 'Conversion timeline failed.')
      setConfidence((prev) => ({ ...prev, conversion: 0 }))
    }
  }, [idea, runtimeUserId])

  const loadRuntimeSummaryRef = useRef(loadRuntimeSummary)
  const loadRuntimeBrdRef = useRef(loadRuntimeBrd)
  const loadRuntimeScoringRef = useRef(loadRuntimeScoring)
  const loadRuntimeBenefitRef = useRef(loadRuntimeBenefit)
  const loadRuntimeConversionRef = useRef(loadRuntimeConversion)

  useEffect(() => {
    loadRuntimeSummaryRef.current = loadRuntimeSummary
  }, [loadRuntimeSummary])

  useEffect(() => {
    loadRuntimeBrdRef.current = loadRuntimeBrd
  }, [loadRuntimeBrd])

  useEffect(() => {
    loadRuntimeScoringRef.current = loadRuntimeScoring
  }, [loadRuntimeScoring])

  useEffect(() => {
    loadRuntimeBenefitRef.current = loadRuntimeBenefit
  }, [loadRuntimeBenefit])

  useEffect(() => {
    loadRuntimeConversionRef.current = loadRuntimeConversion
  }, [loadRuntimeConversion])

  // Initial load: hydrate idea from API, then read idea_summary from DB (no agent on refresh).
  useEffect(() => {
    let cancelled = false
    void fetchIdentityUsers({ limit: 500, offset: 0 })
      .then((res) => {
        if (cancelled) return
        const identityNames = mapIdentityUserDisplayNames(res.items)
        if (Object.keys(identityNames).length > 0) {
          setIdentityUserNameById(identityNames)
        }
      })
      .catch(() => {
        // non-fatal: keep raw subject ids when identity service is unavailable
      })

    void (async () => {
      let hydratedIdea = idea
      if (ideaId && /^[0-9a-f-]{36}$/i.test(ideaId)) {
        try {
          const api = await getIdeaById(ideaId)
          hydratedIdea = ideaFromApi(api)
          setIdea(hydratedIdea)
        } catch {
          // Keep navigation state or fallback when backlog is unavailable.
        }
      }

      let wasFreshIdea = false
      if (typeof window !== 'undefined' && ideaId) {
        try {
          wasFreshIdea = !!window.sessionStorage.getItem(`tectona-fresh-idea-${ideaId}`)
          window.sessionStorage.removeItem(`tectona-fresh-idea-${ideaId}`)
          setIsFreshIdea(wasFreshIdea)
        } catch {
          // non-fatal
        }
      }
      if (wasFreshIdea) {
        setRegenerating((prev) => ({ ...prev, summary: true }))
      }
      try {
        await loadRuntimeSummaryRef.current('llm_first', {
          forceRefresh: wasFreshIdea,
          autoGenerateIfMissing: wasFreshIdea,
        })
        await loadRuntimeBrdRef.current({ forceRefresh: false })
        await loadRuntimeScoringRef.current(hydratedIdea, { forceRefresh: wasFreshIdea })
        await loadRuntimeBenefitRef.current(hydratedIdea)
        await loadRuntimeConversionRef.current(hydratedIdea)
      } finally {
        if (wasFreshIdea) {
          setRegenerating((prev) => ({ ...prev, summary: false }))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [ideaId])

  const summaryKpiCards =
    summaryLoaded && Array.isArray(runtimeSummary.kpi_cards) && runtimeSummary.kpi_cards.length > 0
      ? runtimeSummary.kpi_cards
      : []
  const summaryDecisionSignal = summaryLoaded ? runtimeSummary.decision_signal : null
  const summaryStrategicFraming =
    summaryLoaded &&
    Array.isArray(runtimeSummary.strategic_framing) &&
    runtimeSummary.strategic_framing.length > 0
      ? runtimeSummary.strategic_framing
      : []
  const summaryReadinessSignals =
    summaryLoaded &&
    Array.isArray(runtimeSummary.readiness_signals) &&
    runtimeSummary.readiness_signals.length > 0
      ? runtimeSummary.readiness_signals
      : []
  const summaryGovernanceReadiness = summaryLoaded ? runtimeSummary.governance_readiness : null
  const isSummaryRefreshing = regenerating.summary
  const summaryRefreshLabel = summaryLastRefreshedAt
    ? summaryLastRefreshedAt.toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null
  const summaryWarningItems = useMemo(() => summaryWarnings.map(toSummaryWarningUi), [summaryWarnings])
  const scoringWarningItems = useMemo(() => scoringWarnings.map(toSummaryWarningUi), [scoringWarnings])
  const summaryRoleModels = useMemo(() => {
    const models = runtimeSummary.role_models_used
    if (!models || typeof models !== 'object') return []
    return Object.entries(models).map(([roleId, modelId]) => ({
      roleId,
      roleLabel: formatAgentRoleLabel(roleId),
      modelShort: shortMaasModelName(modelId),
      modelId,
    }))
  }, [runtimeSummary.role_models_used])
  const usesMultiRoleAgents =
    isMultiRoleSummaryMode(runtimeSummary) || summaryRoleModels.length > 0
  const isScoringRefreshing = regenerating.scoring
  const scoringRefreshLabel = scoringLastRefreshedAt
    ? scoringLastRefreshedAt.toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null

  const totalScore = useMemo(() => {
    const { businessValue, effort, risk, roi } = idea.scoring
    return businessValue * 3 + roi * 3 + (11 - effort) * 2 + (11 - risk) * 2
  }, [idea])

  const priorityLabel = useMemo(() => {
    if (totalScore >= 80) return 'High Priority'
    if (totalScore >= 60) return 'Medium Priority'
    return 'Low Priority'
  }, [totalScore])

  const scorePercent = useMemo(() => Math.max(0, Math.min(100, totalScore)), [totalScore])

  const scoringOutlook = useMemo(() => {
    const { businessValue, effort, risk, roi } = idea.scoring

    return {
      strongestDriver: businessValue >= roi ? 'Business Value' : 'ROI',
      mainWatchpoint: effort >= risk ? 'Delivery Effort' : 'Execution Risk',
      executionReadiness:
        effort <= 5 && risk <= 5 ? 'Favorable' : effort <= 7 && risk <= 7 ? 'Controlled' : 'Constrained',
      scorePosture:
        totalScore >= 80 ? 'Executive Ready' : totalScore >= 60 ? 'Strategic Candidate' : 'Needs Refinement',
      recommendedAction:
        totalScore >= 80
          ? 'Advance to backlog shaping and approval review.'
          : totalScore >= 60
            ? 'Tighten BRD assumptions and validate dependencies before acceleration.'
            : 'Strengthen the business case and de-risk the operating model first.',
    }
  }, [idea.scoring, totalScore])

  const brdContentLookup = useMemo<Record<string, string>>(() => {
    return brdSections.reduce<Record<string, string>>((acc, section) => {
      acc[section.key] = section.content
      return acc
    }, {})
  }, [brdSections])

  const scoreData = [
    { label: 'Business Value', score: idea.scoring.businessValue, fill: '#5f7de0', detail: 'Enterprise upside and strategic relevance.' },
    { label: 'Effort', score: idea.scoring.effort, fill: '#e2a234', detail: 'Delivery load required to operationalize the idea.' },
    { label: 'Risk', score: idea.scoring.risk, fill: '#d97706', detail: 'Execution exposure and governance watchpoints.' },
    { label: 'ROI', score: idea.scoring.roi, fill: '#4f46e5', detail: 'Commercial return signal and payback strength.' },
  ]
  const hasNumericScoring = scoreData.some((item) => item.score > 0)

  const costBenefitChartData = useMemo(() => {
    if (!benefitAnalysis) return []
    const narrativeOnly =
      benefitAnalysis.presentation_mode === 'narrative' &&
      benefitAnalysis.total_development_cost <= 0 &&
      benefitAnalysis.total_benefit_5year <= 0
    if (narrativeOnly) {
      return [
        { name: 'Business Value', value: idea.scoring.businessValue * 10, fill: '#5f7de0' },
        { name: 'Effort', value: idea.scoring.effort * 10, fill: '#e2a234' },
        { name: 'Risk', value: idea.scoring.risk * 10, fill: '#d97706' },
        { name: 'ROI score', value: idea.scoring.roi * 10, fill: '#4f46e5' },
      ].filter((item) => item.value > 0)
    }
    return [
      { name: 'Development Cost', value: Math.round(benefitAnalysis.total_development_cost / 1000), fill: '#fb7185' },
      {
        name: 'Operational Cost',
        value: Math.round(Math.max(0, benefitAnalysis.total_cost_5year - benefitAnalysis.total_development_cost) / 1000),
        fill: '#f59e0b',
      },
      {
        name: 'Revenue Gain',
        value: Math.round(
          (benefitAnalysis.annual_breakdown?.reduce((sum, year) => sum + (year.revenue_gains || 0), 0) || 0) / 1000,
        ),
        fill: '#10b981',
      },
      {
        name: 'Efficiency Gain',
        value: Math.round(
          (benefitAnalysis.annual_breakdown?.reduce((sum, year) => sum + (year.efficiency_gains || 0), 0) || 0) / 1000,
        ),
        fill: '#3b82f6',
      },
    ]
  }, [benefitAnalysis, idea.scoring])

  const brainstormProcessDiagrams = useMemo(
    () => extractProcessDiagramsFromText(idea.description || ''),
    [idea.description],
  )

  const processFlowNodes = useMemo(() => {
    const byKey = new Map(brdSections.map((section) => [section.key, section.content]))
    return [
      'Idea intake',
      shortPhrase(byKey.get('problem-statement') ?? '', 'Problem analysis'),
      shortPhrase(byKey.get('objectives') ?? '', 'Define objectives'),
      shortPhrase(byKey.get('functional-requirements') ?? '', 'Design solution workflow'),
      shortPhrase(byKey.get('dependencies') ?? '', 'Integrate dependencies'),
      'Backlog conversion',
      'Project and task delivery',
    ]
  }, [brdSections])

  const processDiagram = useMemo(() => {
    return {
      client: processFlowNodes[0],
      orchestrator: processFlowNodes[1],
      aiRuntime: processFlowNodes[2],
      mcpService: processFlowNodes[3],
      integrationHub: processFlowNodes[4],
      backlog: processFlowNodes[5],
      delivery: processFlowNodes[6],
    }
  }, [processFlowNodes])

  const fallbackMermaidCode = useMemo(() => {
    const nodeLines = processFlowNodes
      .map((label, idx) => `  N${idx + 1}["${mermaidSafe(label)}"]`)
      .join('\n')
    const edgeLines = processFlowNodes
      .slice(0, -1)
      .map((_, idx) => `  N${idx + 1} --> N${idx + 2}`)
      .join('\n')
    return `flowchart LR\n${nodeLines}\n${edgeLines}`
  }, [processFlowNodes])

  const mermaidCode = useMemo(() => {
    if (brainstormProcessDiagrams.length === 0) return fallbackMermaidCode
    return brainstormProcessDiagrams
      .map((diagram) => `%% ${diagram.label}\n${diagram.source}`)
      .join('\n\n')
  }, [brainstormProcessDiagrams, fallbackMermaidCode])

  const reactFlowFromMermaid = useMemo(
    () => parseMermaidToReactFlow(fallbackMermaidCode),
    [fallbackMermaidCode],
  )

  const integrationArchitecture = useMemo(() => {
    const nodes: Node<ArchimateNodeData>[] = [
      {
        id: 'boundary-business-app',
        type: 'archimateBoundary',
        position: { x: 40, y: 120 },
        data: { kind: 'boundary', title: 'Business / Application Collaboration Boundary' },
        style: { width: 770, height: 430 },
        draggable: false,
        selectable: false,
        connectable: false,
        zIndex: 0,
      },
      {
        id: 'boundary-tech',
        type: 'archimateBoundary',
        position: { x: 860, y: 120 },
        data: { kind: 'boundary', title: 'Technology / External System Boundary' },
        style: { width: 440, height: 430 },
        draggable: false,
        selectable: false,
        connectable: false,
        zIndex: 0,
      },
      {
        id: 'canvas-notes',
        type: 'archimateNote',
        position: { x: 840, y: 20 },
        data: {
          kind: 'note',
          title: 'Canvas Notes',
          lines: [
            'Modeled with ArchiMate-inspired layers: business role, application components and services, application data objects, and technology nodes.',
            'Primary routes: synchronous serving, asynchronous flow, and controlled data access into internal and external delivery targets.',
          ],
        },
        style: { width: 470, height: 78 },
        draggable: false,
        selectable: false,
        connectable: false,
        zIndex: 2,
      },
      {
        id: 'legend',
        type: 'archimateLegend',
        position: { x: 40, y: 580 },
        data: { kind: 'legend' },
        style: { width: 1270, height: 82 },
        draggable: false,
        selectable: false,
        connectable: false,
        zIndex: 2,
      },
      {
        id: 'portfolio-governance',
        type: 'archimateElement',
        position: { x: 70, y: 195 },
        data: {
          kind: 'element',
          layer: 'business',
          stereotype: 'Business Role',
          title: 'Komite Multi Finance',
          description: ['Sponsor ide, review,', 'dan pemilik prioritas'],
          variant: 'business-role',
        },
        style: { width: 180 },
        draggable: false,
        selectable: false,
      },
      {
        id: 'idea-engine',
        type: 'archimateElement',
        position: { x: 310, y: 160 },
        data: {
          kind: 'element',
          layer: 'application',
          stereotype: 'Application Component',
          title: 'Idea Intelligence Engine',
          description: ['Pengayaan AI, scoring risiko,', 'dan orkestrasi rekomendasi'],
          variant: 'application-component',
        },
        style: { width: 210 },
        draggable: false,
        selectable: false,
      },
      {
        id: 'api-gateway',
        type: 'archimateElement',
        position: { x: 570, y: 160 },
        data: {
          kind: 'element',
          layer: 'application',
          stereotype: 'Application Component',
          title: 'API Gateway',
          description: ['Enforcement kebijakan, authz,', 'routing, dan observability'],
          variant: 'application-component',
        },
        style: { width: 210 },
        draggable: false,
        selectable: false,
      },
      {
        id: 'recommendation-api',
        type: 'archimateElement',
        position: { x: 310, y: 300 },
        data: {
          kind: 'element',
          layer: 'application',
          stereotype: 'Application Service',
          title: 'API Rekomendasi AI',
          description: ['Permukaan eksekusi sinkron'],
          variant: 'application-service',
        },
        style: { width: 210 },
        draggable: false,
        selectable: false,
      },
      {
        id: 'integration-hub',
        type: 'archimateElement',
        position: { x: 570, y: 300 },
        data: {
          kind: 'element',
          layer: 'application',
          stereotype: 'Application Service',
          title: 'Hub Integrasi',
          description: ['Orkestrasi API, event, dan batch'],
          variant: 'application-service',
        },
        style: { width: 210 },
        draggable: false,
        selectable: false,
      },
      {
        id: 'forecast-signal-package',
        type: 'archimateElement',
        position: { x: 310, y: 450 },
        data: {
          kind: 'element',
          layer: 'data',
          stereotype: 'Data Object',
          title: 'Paket Sinyal SLA KPR',
          description: ['Indikator historis dan real-time', 'keterlambatan persetujuan'],
          variant: 'data-object',
        },
        style: { width: 210 },
        draggable: false,
        selectable: false,
      },
      {
        id: 'insight-outcome',
        type: 'archimateElement',
        position: { x: 570, y: 450 },
        data: {
          kind: 'element',
          layer: 'data',
          stereotype: 'Data Object',
          title: 'Hasil Insight',
          description: ['Paket keputusan untuk', 'consumer downstream'],
          variant: 'data-object',
        },
        style: { width: 210 },
        draggable: false,
        selectable: false,
      },
      {
        id: 'crm-platform',
        type: 'archimateElement',
        position: { x: 900, y: 170 },
        data: {
          kind: 'element',
          layer: 'technology',
          stereotype: 'Technology Node',
          title: 'Platform CRM',
          description: ['Pertukaran data nasabah', 'dan status persetujuan'],
          variant: 'technology-node',
        },
        style: { width: 150 },
        draggable: false,
        selectable: false,
      },
      {
        id: 'erp-platform',
        type: 'archimateElement',
        position: { x: 1108, y: 170 },
        data: {
          kind: 'element',
          layer: 'technology',
          stereotype: 'Technology Node',
          title: 'Platform LOS/ERP',
          description: ['Publikasi event approval', 'dan konfirmasi finansial'],
          variant: 'technology-node',
        },
        style: { width: 150 },
        draggable: false,
        selectable: false,
      },
      {
        id: 'data-platform',
        type: 'archimateElement',
        position: { x: 900, y: 300 },
        data: {
          kind: 'element',
          layer: 'technology',
          stereotype: 'Technology Node',
          title: 'Data Platform',
          description: ['Konsolidasi histori SLA dan', 'dataset feature engineering'],
          variant: 'technology-node',
        },
        style: { width: 150 },
        draggable: false,
        selectable: false,
      },
      {
        id: 'external-services',
        type: 'archimateElement',
        position: { x: 1108, y: 300 },
        data: {
          kind: 'element',
          layer: 'technology',
          stereotype: 'Technology Node',
          title: 'Layanan Eksternal',
          description: ['Verifikasi dokumen eksternal', 'dan data pendukung risiko'],
          variant: 'technology-node',
        },
        style: { width: 150 },
        draggable: false,
        selectable: false,
      },
      {
        id: 'virea-delivery',
        type: 'archimateElement',
        position: { x: 1004, y: 430 },
        data: {
          kind: 'element',
          layer: 'technology',
          stereotype: 'Technology Node',
          title: 'Workspace Delivery',
          description: ['Workspace eksekusi dan', 'target aksi downstream'],
          variant: 'technology-node',
        },
        style: { width: 150 },
        draggable: false,
        selectable: false,
      },
    ]

    const edges: Edge[] = [
      {
        id: 'serving-governance-idea-engine',
        source: 'portfolio-governance',
        target: 'idea-engine',
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
        type: 'smoothstep',
        label: 'Serving',
        labelStyle: { fill: '#334155', fontSize: 10, fontWeight: 500 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
        labelBgPadding: [4, 2],
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' },
        style: { stroke: '#0f172a', strokeWidth: 2 },
      },
      {
        id: 'serving-idea-engine-api-gateway',
        source: 'idea-engine',
        target: 'api-gateway',
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
        type: 'smoothstep',
        label: 'Serving',
        labelStyle: { fill: '#334155', fontSize: 10, fontWeight: 500 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
        labelBgPadding: [4, 2],
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' },
        style: { stroke: '#0f172a', strokeWidth: 2 },
      },
      {
        id: 'serving-idea-engine-recommendation-api',
        source: 'idea-engine',
        target: 'recommendation-api',
        sourceHandle: 'source-bottom',
        targetHandle: 'target-top',
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' },
        style: { stroke: '#0f172a', strokeWidth: 2 },
      },
      {
        id: 'serving-api-gateway-integration-hub',
        source: 'api-gateway',
        target: 'integration-hub',
        sourceHandle: 'source-bottom',
        targetHandle: 'target-top',
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' },
        style: { stroke: '#0f172a', strokeWidth: 2 },
      },
      {
        id: 'flow-recommendation-api-integration-hub',
        source: 'recommendation-api',
        target: 'integration-hub',
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
        type: 'smoothstep',
        label: 'Flow',
        labelStyle: { fill: '#475569', fontSize: 10, fontWeight: 500 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
        labelBgPadding: [4, 2],
        markerEnd: { type: MarkerType.ArrowClosed, color: '#334155' },
        style: { stroke: '#334155', strokeWidth: 2, strokeDasharray: '6 6' },
      },
      {
        id: 'access-recommendation-api-forecast-signal',
        source: 'recommendation-api',
        target: 'forecast-signal-package',
        sourceHandle: 'source-bottom',
        targetHandle: 'target-top',
        type: 'smoothstep',
        label: 'Access',
        labelStyle: { fill: '#475569', fontSize: 10, fontWeight: 500 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
        labelBgPadding: [4, 2],
        markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
        style: { stroke: '#475569', strokeWidth: 2, strokeDasharray: '3 5' },
      },
      {
        id: 'access-integration-hub-insight-outcome',
        source: 'integration-hub',
        target: 'insight-outcome',
        sourceHandle: 'source-bottom',
        targetHandle: 'target-top',
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
        style: { stroke: '#475569', strokeWidth: 2, strokeDasharray: '3 5' },
      },
      {
        id: 'serving-integration-hub-crm',
        source: 'integration-hub',
        target: 'crm-platform',
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
        type: 'smoothstep',
        label: 'Serving',
        labelStyle: { fill: '#334155', fontSize: 10, fontWeight: 500 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
        labelBgPadding: [4, 2],
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' },
        style: { stroke: '#0f172a', strokeWidth: 2 },
      },
      {
        id: 'flow-integration-hub-erp',
        source: 'integration-hub',
        target: 'erp-platform',
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
        type: 'smoothstep',
        label: 'Flow',
        labelStyle: { fill: '#475569', fontSize: 10, fontWeight: 500 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
        labelBgPadding: [4, 2],
        markerEnd: { type: MarkerType.ArrowClosed, color: '#334155' },
        style: { stroke: '#334155', strokeWidth: 2, strokeDasharray: '6 6' },
      },
      {
        id: 'access-integration-hub-data-platform',
        source: 'integration-hub',
        target: 'data-platform',
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
        type: 'smoothstep',
        label: 'Access',
        labelStyle: { fill: '#475569', fontSize: 10, fontWeight: 500 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
        labelBgPadding: [4, 2],
        markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
        style: { stroke: '#475569', strokeWidth: 2, strokeDasharray: '3 5' },
      },
      {
        id: 'flow-integration-hub-external-services',
        source: 'integration-hub',
        target: 'external-services',
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
        type: 'smoothstep',
        label: 'Flow',
        labelStyle: { fill: '#475569', fontSize: 10, fontWeight: 500 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
        labelBgPadding: [4, 2],
        markerEnd: { type: MarkerType.ArrowClosed, color: '#334155' },
        style: { stroke: '#334155', strokeWidth: 2, strokeDasharray: '6 6' },
      },
      {
        id: 'serving-insight-outcome-virea',
        source: 'insight-outcome',
        target: 'virea-delivery',
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
        type: 'smoothstep',
        label: 'Serving',
        labelStyle: { fill: '#334155', fontSize: 10, fontWeight: 500 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
        labelBgPadding: [4, 2],
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' },
        style: { stroke: '#0f172a', strokeWidth: 2 },
      },
    ]

    return { nodes, edges }
  }, [])

  // Sync render lock state to ref for immediate rebalance gating
  useEffect(() => {
    isBrdRenderLockedRef.current = isBrdRenderLocked
  }, [isBrdRenderLocked])

  const togglePanel = (key: PanelKey) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const regeneratePanel = (key: PanelKey) => {
    setRegenerating((prev) => ({ ...prev, [key]: true }))

    if (key === 'summary') {
      void (async () => {
        const startedAt = Date.now()
        try {
          await loadRuntimeSummary('llm_first', { forceRefresh: true, autoGenerateIfMissing: true })
        } finally {
          const elapsedMs = Date.now() - startedAt
          const minLoadingMs = 700
          if (elapsedMs < minLoadingMs) {
            await new Promise((resolve) => window.setTimeout(resolve, minLoadingMs - elapsedMs))
          }
          setRegenerating((prev) => ({ ...prev, [key]: false }))
        }
      })()
      return
    }

    if (key === 'brd') {
      void (async () => {
        // Use ref for immediate locking to prevent rebalance during generation
        isBrdRenderLockedRef.current = true
        setIsBrdRenderLocked(true)
        const startedAt = Date.now()
        try {
          // Reset to one blank page while generation is in progress.
          const blankHeader = 'Business Requirements Document (BRD)'
          setEditingHeaderIndex(null)
          setBrdStylesMenuOpen(false)
          setBrdTableMenuOpen(false)
          setBrdSpacingMenuOpen(false)
          setBrdTextColorMenuOpen(false)
          setBrdHighlightMenuOpen(false)
          setBrdShadingMenuOpen(false)
          setBrdCaseMenuOpen(false)
          setBrdMultilevelMenuOpen(false)
          setBrdBulletMenuOpen(false)
          setBrdNumberMenuOpen(false)
          brdPagesRef.current = ['']
          setBrdPages([''])
          brdHeadersRef.current = [blankHeader]
          setBrdHeaders([blankHeader])
          brdHeaderHeightsRef.current = [18]
          setBrdHeaderHeights([18])
          scheduleWordCountUpdate()

          const result = await loadRuntimeBrd({ forceRefresh: true })
          // Use the freshly returned data (not stale closure state)
          setEditingHeaderIndex(null)
          const nextHeader = (result.brd_title ?? 'Business Requirements Document (BRD)').trim()
          // IMPORTANT: Convert plain text to HTML only, skip full normalization to preserve all content.
          const rawBody = (result.brd_document ?? buildLocalBrdFallback()).trim()
          const nextBody = brdBodyHasHtmlMarkup(rawBody) ? rawBody : convertPlainTextBrdToHtml(rawBody)
          brdPagesRef.current = [nextBody]
          setBrdPages([nextBody])
          brdHeadersRef.current = [nextHeader]
          setBrdHeaders([nextHeader])
          brdHeaderHeightsRef.current = [18]
          setBrdHeaderHeights([18])
          scheduleWordCountUpdate()
        } catch {
          // IMPORTANT: Convert plain text to HTML on fallback too
          const rawFallback = (buildLocalBrdFallback()).trim()
          const fallbackBody = brdBodyHasHtmlMarkup(rawFallback) ? rawFallback : convertPlainTextBrdToHtml(rawFallback)
          setEditingHeaderIndex(null)
          brdPagesRef.current = [fallbackBody]
          setBrdPages([fallbackBody])
          brdHeadersRef.current = ['Business Requirements Document (BRD)']
          setBrdHeaders(['Business Requirements Document (BRD)'])
          brdHeaderHeightsRef.current = [18]
          setBrdHeaderHeights([18])
          scheduleWordCountUpdate()
          setConfidence((prev) => ({ ...prev, brd: Math.max(72, prev.brd - 4) }))
        } finally {
          const elapsedMs = Date.now() - startedAt
          const minLoadingMs = 900
          if (elapsedMs < minLoadingMs) {
            await new Promise((resolve) => window.setTimeout(resolve, minLoadingMs - elapsedMs))
          }
          // Keep cover/TOC hidden until the editor has committed the refreshed BRD page state.
          // IMPORTANT: Unlock immediately via ref FIRST to allow rebalance, then clear both state flags.
          isBrdRenderLockedRef.current = false
          setIsBrdRenderLocked(false)
          setRegenerating((prev) => ({ ...prev, [key]: false }))
        }
      })()
      return
    }

    if (key === 'scoring') {
      void (async () => {
        const startedAt = Date.now()
        try {
          let refreshedIdea = idea
          try {
            const api = await getIdeaById(idea.id)
            refreshedIdea = ideaFromApi(api)
            setIdea(refreshedIdea)
          } catch {
            // keep current idea snapshot if refresh fails
          }
          await loadRuntimeScoringRef.current(refreshedIdea, { forceRefresh: true })
        } finally {
          const elapsedMs = Date.now() - startedAt
          const minLoadingMs = 700
          if (elapsedMs < minLoadingMs) {
            await new Promise((resolve) => window.setTimeout(resolve, minLoadingMs - elapsedMs))
          }
          setRegenerating((prev) => ({ ...prev, [key]: false }))
        }
      })()
      return
    }

    if (key === 'costBenefit') {
      void (async () => {
        const startedAt = Date.now()
        try {
          await loadRuntimeBenefitRef.current(idea)
        } finally {
          const elapsedMs = Date.now() - startedAt
          if (elapsedMs < 700) {
            await new Promise((resolve) => window.setTimeout(resolve, 700 - elapsedMs))
          }
          setRegenerating((prev) => ({ ...prev, [key]: false }))
        }
      })()
      return
    }

    if (key === 'conversion') {
      void (async () => {
        const startedAt = Date.now()
        try {
          await loadRuntimeConversionRef.current(idea)
        } finally {
          const elapsedMs = Date.now() - startedAt
          if (elapsedMs < 700) {
            await new Promise((resolve) => window.setTimeout(resolve, 700 - elapsedMs))
          }
          setRegenerating((prev) => ({ ...prev, [key]: false }))
        }
      })()
      return
    }

    window.setTimeout(() => {
      setConfidence((prev) => {
        const next = Math.min(98, Math.max(70, prev[key] + (Math.random() > 0.5 ? 1 : -1) * 3))
        return { ...prev, [key]: next }
      })
      setRegenerating((prev) => ({ ...prev, [key]: false }))
    }, 900)
  }

  const startDevelop = () => {
    setDevelopStep('generating')
    window.setTimeout(() => setDevelopStep('creating'), 1000)
    window.setTimeout(() => setDevelopStep('sending'), 2200)
    window.setTimeout(() => setDevelopStep('done'), 3600)
  }

  const addMetaToast = useCallback((
    key: string,
    toast: { variant: 'success' | 'error'; title: string; description: string }
  ) => {
    const now = Date.now()
    const recent = lastMetaToastRef.current
    if (recent && recent.key === key && now - recent.at < 1200) return
    lastMetaToastRef.current = { key, at: now }
    addToast(toast)
  }, [addToast])

  const persistIdeaMetaPatch = useCallback(async (patch: { status?: IdeaStatus; reviewer?: string }) => {
    setIsMetaPatchSaving(true)
    const baseVersion = idea.version
    try {
      const updated = await patchIdea(idea.id, {
        status_code: patch.status ? toBackendStatus(patch.status) : undefined,
        assignee_id: patch.reviewer,
        version: baseVersion,
      })
      setIdea(ideaFromApi(updated))
      return { ok: true as const }
    } catch (firstError) {
      try {
        const latest = await getIdeaById(idea.id)
        const retried = await patchIdea(idea.id, {
          status_code: patch.status ? toBackendStatus(patch.status) : undefined,
          assignee_id: patch.reviewer,
          version: latest.version,
        })
        setIdea(ideaFromApi(retried))
        return { ok: true as const }
      } catch (retryError) {
        console.warn('[IdeaDetail] failed to persist status/reviewer update', retryError || firstError)
        const message =
          retryError instanceof Error
            ? retryError.message
            : firstError instanceof Error
              ? firstError.message
              : 'Failed to persist idea updates.'
        return { ok: false as const, message }
      }
    } finally {
      setIsMetaPatchSaving(false)
    }
  }, [idea.id, idea.version])

  const quickUpdateStatus = (status: IdeaStatus) => {
    if (isMetaPatchSaving || status === idea.status) return
    const previousStatus = idea.status
    setMetaPatchInlineError(null)
    setIdea((prev) => ({ ...prev, status }))
    void persistIdeaMetaPatch({ status, reviewer: idea.reviewer }).then((result) => {
      if (result.ok) {
        setMetaPatchLastSavedAt(new Date())
        setMetaPatchInlineError(null)
        addMetaToast(`status:${status}:ok`, {
          variant: 'success',
          title: 'Status updated',
          description: `Idea status changed to ${status}.`,
        })
        return
      }
      setIdea((prev) => ({ ...prev, status: previousStatus }))
      setMetaPatchInlineError(result.message)
      addMetaToast('status:error', {
        variant: 'error',
        title: 'Status update failed',
        description: result.message,
      })
    })
  }

  const quickUpdateReviewer = (reviewer: string) => {
    if (isMetaPatchSaving || reviewer === idea.reviewer) return
    const previousReviewer = idea.reviewer
    setMetaPatchInlineError(null)
    setIdea((prev) => ({ ...prev, reviewer }))
    void persistIdeaMetaPatch({ status: idea.status, reviewer }).then((result) => {
      if (result.ok) {
        setMetaPatchLastSavedAt(new Date())
        setMetaPatchInlineError(null)
        addMetaToast('reviewer:ok', {
          variant: 'success',
          title: 'Reviewer updated',
          description: 'Reviewer assignment has been saved.',
        })
        return
      }
      setIdea((prev) => ({ ...prev, reviewer: previousReviewer }))
      setMetaPatchInlineError(result.message)
      addMetaToast('reviewer:error', {
        variant: 'error',
        title: 'Reviewer update failed',
        description: result.message,
      })
    })
  }

  const updateBrdSection = (sectionKey: string, nextContent: string) => {
    setBrdSections((prev) =>
      prev.map((section) => (section.key === sectionKey ? { ...section, content: nextContent } : section))
    )
  }

  const navigateToPanel = (panel: PanelKey) => {
    setActivePanel(panel)
    setCollapsed((prev) => ({ ...prev, [panel]: true }))
    const target = document.getElementById(`panel-${panel}`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const BRD_PAGE_WIDTH_PX = 794
  const BRD_PAGE_HEIGHT_PX = 1123
  const BRD_PAGE_PADDING_X_PX = 64 * 2
  const BRD_CONTENT_WIDTH_PX = BRD_PAGE_WIDTH_PX - BRD_PAGE_PADDING_X_PX
  const BRD_CONTENT_HEIGHT_PX = 995
  const BRD_HEADER_TOP_PX = 24
  const BRD_HEADER_BODY_GAP_PX = 6
  const BRD_BOTTOM_PADDING_PX = 40 // Safety margin at bottom to prevent overflow
  const BRD_ZOOM_MIN = 0.5
  const BRD_ZOOM_MAX = 1.5
  const BRD_ZOOM_STEP = 0.05
  const BRD_PAGE_GAP_PX = 24

  useEffect(() => {
    brdPagesRef.current = brdPages
  }, [brdPages])

  useEffect(() => {
    brdHeadersRef.current = brdHeaders
  }, [brdHeaders])

  useEffect(() => {
    // Keep headers aligned with page count.
    setBrdHeaders((prev) => {
      if (prev.length === brdPages.length) return prev
      const next = [...prev]
      while (next.length < brdPages.length) next.push('')
      while (next.length > brdPages.length) next.pop()
      brdHeadersRef.current = next
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brdPages.length])

  useEffect(() => {
    brdHeaderHeightsRef.current = brdHeaderHeights
  }, [brdHeaderHeights])

  useEffect(() => {
    // Keep header heights aligned with page count.
    setBrdHeaderHeights((prev) => {
      if (prev.length === brdPages.length) return prev
      const next = [...prev]
      while (next.length < brdPages.length) next.push(24)
      while (next.length > brdPages.length) next.pop()
      brdHeaderHeightsRef.current = next
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brdPages.length])

  useEffect(() => {
    const recalc = () => {
      const el = brdViewportRef.current
      if (!el) return
      // Available width inside the scroll viewport; keep a small padding so it never triggers overflow.
      const available = Math.max(320, el.clientWidth - 24)
      const fit = available / BRD_PAGE_WIDTH_PX
      const nextMax = Math.min(BRD_ZOOM_MAX, Math.max(BRD_ZOOM_MIN, Math.floor(fit / BRD_ZOOM_STEP) * BRD_ZOOM_STEP))
      setBrdMaxZoomFit(nextMax)
      setBrdZoom((z) => Math.min(z, nextMax))
    }

    recalc()
    window.addEventListener('resize', recalc)
    return () => window.removeEventListener('resize', recalc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const countWords = (text: string) => {
    const trimmed = text.replace(/\u00A0/g, ' ').trim()
    if (!trimmed) return 0
    return trimmed.split(/\s+/g).filter(Boolean).length
  }

  /** True when serialized page body includes a table (store innerHTML, not innerText). */
  const brdBodyHasTableMarkup = (s: string) => /<\s*table[\s>]/i.test(s)
  const brdBodyHasHtmlMarkup = (s: string) => /<\s*[a-z][^>]*>/i.test(s)

  const escapeBrdHtml = (text: string) => {
    const wrapper = document.createElement('div')
    wrapper.textContent = text
    return wrapper.innerHTML
  }

  // Renders **bold** and *italic* inline markdown in content
  const convertInlineMarkdown = (text: string) => {
    const escaped = escapeBrdHtml(text)
    return escaped
      .replace(/\*\*([^*<]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*<\n]+)\*/g, '<em>$1</em>')
      .replace(/__([^_<]+)__/g, '<strong>$1</strong>')
      .replace(/_([^_<\n]+)_/g, '<em>$1</em>')
  }

  const brdPagePlainTextForWordCount = (pageContent: string) => {
    if (!pageContent.includes('<')) return pageContent
    const div = document.createElement('div')
    div.innerHTML = pageContent
    return div.innerText
  }

  const measureBrdBodyHeight = (pageContent: string) => {
    const el = brdMeasureRef.current
    if (!el) return 0
    if (brdBodyHasHtmlMarkup(pageContent)) {
      el.innerHTML = pageContent || ''
    } else {
      el.innerText = pageContent || ''
    }
    return el.scrollHeight
  }

  const isBrdSectionHeadingLine = (line: string) => {
    const raw = line.trim()
    if (!raw) return false
    // Strip bold markdown wrapper e.g. **A. Heading** before testing
    const trimmed = raw.replace(/^\*{1,2}/, '').replace(/\*{1,2}$/, '').trim() || raw
    return /^(?:#{1,6}\s+|[A-Z]\.|[IVXLC]+\.|\d+(?:\.\d+)*\.?\s+).+/i.test(trimmed)
  }

  const getBrdHeadingMeta = (line: string): { level: 2 | 3 | 4; signature: string } | null => {
    const raw = line.trim()
    if (!raw) return null
    // Strip bold markdown wrapper e.g. **A. Heading** or **## Heading**
    const trimmed = raw.replace(/^\*{1,2}/, '').replace(/\*{1,2}$/, '').trim() || raw

    const normalizeHeadingSignature = (raw: string) => {
      const withoutHashes = raw.trim().replace(/^#{1,6}\s+/, '')
      const withoutPrefix = withoutHashes.replace(/^((?:[IVXLC]+\.)|(?:[A-Z]\.)|(?:\d+(?:\.\d+)*\.?))\s+/i, '$1 ')
      const withoutParen = withoutPrefix.replace(/\([^)]*\)/g, ' ')
      const withoutAsterisk = withoutParen.replace(/\*/g, ' ')
      const beforeDash = withoutAsterisk.split(/\s+[â€“-]\s+/)[0] ?? withoutAsterisk
      return beforeDash.toLowerCase().replace(/\s+/g, ' ').trim()
    }

    const inferPrefixLevel = (raw: string): 2 | 3 | 4 | null => {
      const normalized = raw.trim().replace(/^#{1,6}\s+/, '')
      if (/^(?:[IVXLCDM]{2,}|[IVX])\.\s+/i.test(normalized)) return 2
      if (/^[A-Z]\.\s+/.test(normalized)) return 3
      if (/^\d+(?:\.\d+)+\s+/.test(normalized)) return 4
      return null
    }

    const markdownMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (markdownMatch) {
      const inferred = inferPrefixLevel(markdownMatch[2])
      const weight = inferred ?? (Math.min(4, markdownMatch[1].length + 1) as 2 | 3 | 4)
      return {
        level: weight,
        signature: normalizeHeadingSignature(markdownMatch[2]),
      }
    }

    if (/^(?:[IVXLCDM]{2,}|[IVX])\.\s+/i.test(trimmed)) {
      return { level: 2, signature: normalizeHeadingSignature(trimmed) }
    }

    if (/^[A-Z]\.\s+/.test(trimmed)) {
      return { level: 3, signature: normalizeHeadingSignature(trimmed) }
    }

    if (/^\d+(?:\.\d+)+\s+/.test(trimmed)) {
      return { level: 4, signature: normalizeHeadingSignature(trimmed) }
    }

    return null
  }

  const isBrdHeadingOnlyBlock = (block: string) => {
    const lines = block
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    return lines.length > 0 && lines.every((line) => isBrdSectionHeadingLine(line))
  }

  const isBrdListItemStartLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return false
    return /^(?:[-*â€¢â–ªâ—¦â€£â—â—‹â– â–âœ“âž¤]|\d+[.)]|[A-Za-z][.)]|[ivxlcdm]+[.)])\s+/i.test(trimmed)
  }

  const getBrdListItemMeta = (line: string): { listType: 'ul' | 'ol'; listClassName?: string; content: string } | null => {
    const trimmed = line.trim()
    if (!trimmed) return null

    const unorderedMatch = trimmed.match(/^(?:[-*â€¢â–ªâ—¦â€£â—â—‹â– â–âœ“âž¤])\s+(.+)$/)
    if (unorderedMatch) {
      const content = unorderedMatch[1].trim()
      return { listType: 'ul', listClassName: 'brd-editor-ul', content: content }
    }

    const decimalMatch = trimmed.match(/^\d+[.)]\s+(.+)$/)
    if (decimalMatch) {
      return { listType: 'ol', listClassName: 'brd-editor-ol-decimal', content: decimalMatch[1].trim() }
    }

    const upperAlphaMatch = trimmed.match(/^[A-Z][.)]\s+(.+)$/)
    if (upperAlphaMatch) {
      return { listType: 'ol', listClassName: 'brd-editor-ol-upper-alpha', content: upperAlphaMatch[1].trim() }
    }

    const lowerAlphaMatch = trimmed.match(/^[a-z][.)]\s+(.+)$/)
    if (lowerAlphaMatch) {
      return { listType: 'ol', listClassName: 'brd-editor-ol-lower-alpha', content: lowerAlphaMatch[1].trim() }
    }

    const romanMatch = trimmed.match(/^[ivxlcdm]+[.)]\s+(.+)$/i)
    if (romanMatch) {
      return { listType: 'ol', listClassName: 'brd-editor-ol-lower-roman', content: romanMatch[1].trim() }
    }

    return null
  }

  // Returns true if two consecutive heading signatures represent the same section.
  // Handles the case where normalizeHeadingSignature strips the dash-subtitle,
  // so "c. foo bar" and "c. foo bar baz" (or "c. foo") are treated as duplicates.
  const isSectionDuplicate = (a: string, b: string | null): boolean => {
    if (!b) return false
    if (a === b) return true
    // One is a leading-prefix of the other â†’ same section heading
    const longer = a.length >= b.length ? a : b
    const shorter = a.length < b.length ? a : b
    return longer.startsWith(shorter + ' ') || longer.startsWith(shorter + '/')
  }

  const normalizeBrdHtmlContent = (html: string) => {
    const container = document.createElement('div')
    container.innerHTML = html.trim()

    const isMermaidNoiseText = (input: string) => {
      const text = input.trim()
      if (!text) return false
      if (/^```/.test(text)) return true
      if (/^mermaid$/i.test(text)) return true
      if (/^graph\s+(?:td|lr|rl|bt)\b/i.test(text)) return true
      if (/^subgraph\b/i.test(text)) return true
      if (/^end\b/i.test(text)) return true
      return /-->|==>|-\.->|---/.test(text)
    }

    Array.from(container.querySelectorAll('pre, code, p, li')).forEach((node) => {
      const text = node.textContent ?? ''
      if (!isMermaidNoiseText(text)) return
      if (node.tagName.toLowerCase() === 'code' && node.parentElement?.tagName.toLowerCase() === 'pre') return
      node.remove()
    })

    Array.from(container.querySelectorAll('pre')).forEach((pre) => {
      const text = pre.textContent ?? ''
      if (isMermaidNoiseText(text)) pre.remove()
    })

    let previousHeadingSignature: string | null = null
    const nodesToRemove: HTMLElement[] = []

    Array.from(container.children).forEach((child) => {
      const tag = child.tagName.toLowerCase()
      if (/^h[1-6]$/.test(tag)) {
        const headingText = child.textContent?.trim() ?? ''
        const headingMeta = getBrdHeadingMeta(headingText)
        const signature = headingMeta?.signature ?? headingText.toLowerCase().replace(/\s+/g, ' ')

        // Harmonize heading level so A/B/C/D always share the same visual style.
        if (headingMeta && tag !== `h${headingMeta.level}`) {
          const replacement = document.createElement(`h${headingMeta.level}`)
          replacement.innerHTML = child.innerHTML
          ;(child as HTMLElement).replaceWith(replacement)
          child = replacement
        }

        // Remove heading if it's a duplicate (exact or prefix match)
        if (signature && isSectionDuplicate(signature, previousHeadingSignature)) {
          nodesToRemove.push(child as HTMLElement)
          return
        }
        previousHeadingSignature = signature
        return
      }

      // Reset signature tracking on non-heading, non-empty content
      if (child.textContent?.trim()) previousHeadingSignature = null
    })
    
    // Remove all marked nodes
    nodesToRemove.forEach((node) => node.remove())

    return container.innerHTML.trim()
  }

  const convertPlainTextBrdToHtml = (text: string) => {
    const isMermaidFlowLine = (line: string) => {
      const trimmed = line.trim()
      if (!trimmed) return false
      if (/^graph\s+(?:td|lr|rl|bt)\b/i.test(trimmed)) return true
      if (/^subgraph\b/i.test(trimmed)) return true
      if (/^end\b/i.test(trimmed)) return true
      return /-->|==>|-\.->|---/.test(trimmed)
    }

    const stripCodeFenceAndMermaidNoise = (input: string) => {
      const lines = input.replace(/\r\n/g, '\n').split('\n')
      const cleaned: string[] = []
      let inFence = false

      for (const rawLine of lines) {
        const trimmed = rawLine.trim()
        const withoutListPrefix = trimmed.replace(/^[-*+]\s+/, '')

        if (/^```/.test(withoutListPrefix)) {
          inFence = !inFence
          continue
        }

        if (inFence) continue
        if (isMermaidFlowLine(withoutListPrefix)) continue

        cleaned.push(rawLine)
      }

      return cleaned.join('\n')
    }

    // Expand lines that contain multiple inline numbered items into separate lines
    // e.g. "intro: 1. Foo 2. Bar 3. Baz" â†’ ["intro:", "1. Foo", "2. Bar", "3. Baz"]
    const expandInlineNumberedList = (line: string): string[] => {
      const matches = [...line.matchAll(/(?:^|\s)(\d+)\.\s+/g)]
      if (matches.length < 2) return [line]
      const nums = matches.map((m) => parseInt(m[1]))
      const isSequential = nums[0] === 1 && nums.every((n, i) => i === 0 || n === nums[i - 1] + 1)
      if (!isSequential) return [line]
      const result: string[] = []
      const firstIdx = matches[0].index! + (matches[0][0].startsWith(' ') ? 1 : 0)
      const intro = line.substring(0, firstIdx).trim()
      if (intro) result.push(intro)
      for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index! + (matches[i][0].startsWith(' ') ? 1 : 0)
        const end = i + 1 < matches.length ? matches[i + 1].index! + (matches[i + 1][0].startsWith(' ') ? 1 : 0) : line.length
        result.push(line.substring(start, end).trim())
      }
      return result
    }

    const lines = stripCodeFenceAndMermaidNoise(text)
      .replace(/\r\n/g, '\n')
      .split('\n')
      .flatMap((line) => expandInlineNumberedList(line))
    const blocks: string[] = []
    let paragraphLines: string[] = []
    let listItems: string[] = []
    let listType: 'ul' | 'ol' | null = null
    let listClassName = 'brd-editor-ul'
    let previousHeadingSignature: string | null = null

    const flushParagraph = () => {
      if (!paragraphLines.length) return
      // Heuristic: 2+ short lines (â‰¤180 chars each) that look like implicit list items
      // â†’ render as <ul> even though LLM forgot to add "- " prefix
      const isImplicitList =
        paragraphLines.length >= 2 &&
        paragraphLines.every((l) => l.trim().length <= 180 && /[^:]\s*$/.test(l.trim()))
      if (isImplicitList) {
        blocks.push(
          `<ul class="brd-editor-ul">${paragraphLines.map((l) => `<li>${convertInlineMarkdown(l.trim())}</li>`).join('')}</ul>`
        )
      } else {
        blocks.push(`<p>${paragraphLines.map((line) => convertInlineMarkdown(line.trim())).join('<br />')}</p>`)
      }
      paragraphLines = []
      previousHeadingSignature = null
    }

    const flushList = () => {
      if (!listItems.length || !listType) return
      const tag = listType
      blocks.push(`<${tag} class="${listClassName}">${listItems.join('')}</${tag}>`)
      listItems = []
      listType = null
      listClassName = 'brd-editor-ul'
      previousHeadingSignature = null
    }

    let tableRows: string[][] = []
    let tableHasHeader = false

    const isMarkdownTableRow = (line: string) => line.trim().startsWith('|') && line.trim().endsWith('|')
    const isMarkdownTableSeparator = (line: string) => /^\|[\s|:-]+\|$/.test(line.trim())

    const parseMarkdownTableRow = (line: string): string[] =>
      line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim())

    const flushTable = () => {
      if (!tableRows.length) return
      const rows = tableRows
      tableRows = []
      const hasHeader = tableHasHeader
      tableHasHeader = false

      let html = '<table class="brd-table"><tbody>'
      rows.forEach((cells, i) => {
        const tag = (hasHeader && i === 0) ? 'th' : 'td'
        html += '<tr>' + cells.map((c) => `<${tag}>${convertInlineMarkdown(c)}</${tag}>`).join('') + '</tr>'
      })
      html += '</tbody></table>'
      blocks.push(html)
      previousHeadingSignature = null
    }

    lines.forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed) {
        flushParagraph()
        flushTable()
        // Don't flush list on blank lines so consecutive numbered items stay in one <ol>
        return
      }

      // Markdown table row
      if (isMarkdownTableRow(trimmed)) {
        flushParagraph()
        flushList()
        if (isMarkdownTableSeparator(trimmed)) {
          // separator row â€” mark that first row is header, skip this row
          tableHasHeader = true
          return
        }
        tableRows.push(parseMarkdownTableRow(trimmed))
        previousHeadingSignature = null
        return
      }

      // Non-table line â†’ flush any pending table
      flushTable()

      const headingMeta = getBrdHeadingMeta(trimmed)
      if (headingMeta) {
        flushParagraph()
        flushList()
        if (isSectionDuplicate(headingMeta.signature, previousHeadingSignature)) return
        const headingContent = trimmed.replace(/^#{1,6}\s+/, '').replace(/^\*{1,2}/, '').replace(/\*{1,2}$/, '').trim()
        blocks.push(`<h${headingMeta.level}>${convertInlineMarkdown(headingContent)}</h${headingMeta.level}>`)
        previousHeadingSignature = headingMeta.signature
        return
      }

      const listMeta = getBrdListItemMeta(trimmed)
      if (listMeta) {
        flushParagraph()
        if (listType && (listType !== listMeta.listType || listClassName !== (listMeta.listClassName ?? 'brd-editor-ul'))) {
          flushList()
        }
        listType = listMeta.listType
        listClassName = listMeta.listClassName ?? 'brd-editor-ul'
        listItems.push(`<li>${convertInlineMarkdown(listMeta.content)}</li>`)
        previousHeadingSignature = null
        return
      }

      flushList()
      paragraphLines.push(line)
    })

    flushParagraph()
    flushList()
    flushTable()
    return blocks.join('')
  }

  const normalizeBrdBodyContent = useCallback((content: string) => {
    const trimmed = (content ?? '').replace(/\u00A0/g, ' ').trim()
    if (!trimmed) return ''
    return brdBodyHasHtmlMarkup(trimmed) ? normalizeBrdHtmlContent(trimmed) : convertPlainTextBrdToHtml(trimmed)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const generateBrdCoverPage = () => {
    const coverHtml = `
      <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; text-align: center; padding: 80px 60px;">
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <div style="font-size: 14px; color: #94a3b8; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 40px; font-weight: 500; font-family: 'Aptos', 'Calibri', Arial, sans-serif;">Business Requirements Document</div>
          <h1 style="font-size: 48px; font-weight: 700; color: #0f172a; margin: 0; line-height: 1.2; margin-bottom: 50px; font-family: 'Aptos', 'Calibri', Arial, sans-serif; letter-spacing: -0.5px;">${escapeBrdHtml(idea.title)}</h1>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; width: 100%;">
          <div style="border-top: 1px solid #e2e8f0; padding-top: 30px; text-align: center;">
            <div style="font-size: 13px; color: #64748b; font-family: 'Aptos', 'Calibri', Arial, sans-serif; letter-spacing: 0.3px;">Submitted by</div>
            <div style="font-size: 14px; font-weight: 500; color: #0f172a; margin-top: 8px; font-family: 'Aptos', 'Calibri', Arial, sans-serif;">${escapeBrdHtml(submittedByDisplayName)}</div>
          </div>
        </div>
      </div>
    `
    return coverHtml.trim()
  }

  const extractBrdHeadings = (pages: string[]): Array<{ level: number; text: string; pageNum: number }> => {
    const headings: Array<{ level: number; text: string; pageNum: number }> = []

    const stripMarkdownHeadingPrefix = (text: string) => text.trim().replace(/^#{1,6}\s+/, '')

    const inferTocLevel = (text: string, fallbackLevel: number) => {
      const trimmed = stripMarkdownHeadingPrefix(text)
      if (/^(?:[IVXLCDM]{2,}|[IVX])\.\s+/i.test(trimmed)) return 2
      if (/^[A-Z]\.\s+/.test(trimmed)) return 3
      if (/^\d+\.\d+\.\d+\s+/.test(trimmed)) return 4
      if (/^\d+\.\d+\s+/.test(trimmed)) return 3
      return fallbackLevel
    }

    pages.forEach((pageContent, pageIdx) => {
      if (!pageContent) return

      if (brdBodyHasHtmlMarkup(pageContent)) {
        const container = document.createElement('div')
        container.innerHTML = pageContent
        Array.from(container.querySelectorAll('h2, h3, h4')).forEach((el) => {
          const domLevel = parseInt(el.tagName[1])
          const text = el.textContent?.trim() || ''
          if (text) {
            const level = inferTocLevel(text, domLevel)
            headings.push({ level, text, pageNum: pageIdx + 1 }) // +1 for 1-based page numbering
          }
        })
      } else {
        const lines = pageContent.split('\n')
        lines.forEach((line) => {
          const meta = getBrdHeadingMeta(line)
          if (meta) {
            const text = line.trim()
            const level = inferTocLevel(text, meta.level)
            headings.push({ level, text, pageNum: pageIdx + 1 })
          }
        })
      }
    })

    const getHeadingPrefixToken = (text: string) => {
      const trimmed = stripMarkdownHeadingPrefix(text)
      const match = trimmed.match(/^((?:[IVXLCDM]+\.)|(?:[A-Z]\.)|(?:\d+(?:\.\d+)*\.?))\s+/i)
      return (match?.[1] ?? '').toUpperCase()
    }

    const normalizeHeadingBase = (text: string) => {
      const withoutPrefix = text
        .trim()
        .replace(/^((?:[IVXLCDM]+\.)|(?:[A-Z]\.)|(?:\d+(?:\.\d+)*\.?))\s+/i, '')
      const withoutParen = withoutPrefix.replace(/\([^)]*\)/g, ' ')
      const withoutAsterisk = withoutParen.replace(/\*/g, ' ')
      const beforeDash = withoutAsterisk.split(/\s+[â€“-]\s+/)[0] ?? withoutAsterisk
      return beforeDash
        .toLowerCase()
        .replace(/[^a-z0-9\s/]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    // Normalize hierarchy context so lettered sections (A/B/C/D)
    // are consistently treated as children of active Roman sections (I/II/III).
    const normalizedHeadings: Array<{ level: number; text: string; pageNum: number }> = []
    let hasRomanContext = false
    for (const heading of headings) {
      const text = stripMarkdownHeadingPrefix(heading.text)
      const next = { ...heading }

      if (/^(?:[IVXLCDM]{2,}|[IVX])\.\s+/i.test(text)) {
        next.level = 2
        hasRomanContext = true
      } else if (/^[A-Z]\.\s+/.test(text)) {
        next.level = hasRomanContext ? 3 : Math.max(3, heading.level)
      } else if (/^\d+\.\d+\.\d+\s+/.test(text)) {
        next.level = 4
      } else if (/^\d+\.\d+\s+/.test(text)) {
        next.level = 3
      }

      normalizedHeadings.push(next)
    }

    // Remove duplicates that can appear from page reflow/splitting
    // and variant heading text for the same section key.
    const deduped: Array<{ level: number; text: string; pageNum: number }> = []
    for (const heading of normalizedHeadings) {
      const prev = deduped[deduped.length - 1]
      if (!prev) {
        deduped.push(heading)
        continue
      }

      const sameLevel = prev.level === heading.level
      const nearPage = heading.pageNum === prev.pageNum || heading.pageNum === prev.pageNum + 1
      if (sameLevel && nearPage) {
        const prevText = prev.text.trim().toLowerCase()
        const nextText = heading.text.trim().toLowerCase()
        const sameText = prevText === nextText
        if (sameText) continue

        const prevPrefix = getHeadingPrefixToken(prev.text)
        const nextPrefix = getHeadingPrefixToken(heading.text)
        const samePrefix = Boolean(prevPrefix) && prevPrefix === nextPrefix

        const prevBase = normalizeHeadingBase(prev.text)
        const nextBase = normalizeHeadingBase(heading.text)
        const sameBase = Boolean(prevBase) && prevBase === nextBase
        const baseOverlaps =
          Boolean(prevBase) &&
          Boolean(nextBase) &&
          (prevBase.startsWith(nextBase) || nextBase.startsWith(prevBase))

        if ((samePrefix && sameBase) || (samePrefix && baseOverlaps)) continue
      }

      deduped.push(heading)
    }

    return deduped
  }

  const generateBrdTableOfContents = (allPages: string[]) => {
    const headings = extractBrdHeadings(allPages)
    if (!headings.length) {
      return '<div style="padding: 20px; color: #94a3b8; font-family: Aptos, Arial, sans-serif;"><p>No sections found in document.</p></div>'
    }

    const sanitizeHeadingForPrefix = (text: string) =>
      text
        .trim()
        .replace(/^#{1,6}\s+/, '')
        .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, ' ')
        .replace(/^[\s"'`~*_\-â€“â€”â€¢â–ªâ—¦â€£â—â—‹â– â–âœ“âž¤:;,.()\[\]{}]+/, '')
        .replace(/\s+/g, ' ')
        .trim()

    const isRomanSectionPrefix = (text: string) => {
      const match = text.match(/^([IVXLCDM]+)\s*[.)]\s*/i)
      if (!match) return false
      const token = match[1].toUpperCase()
      // Prevent alpha sections like C. / D. from being treated as Roman headings.
      if (token.length === 1 && token !== 'I' && token !== 'V' && token !== 'X') return false
      return true
    }
    const isAlphaSectionPrefix = (text: string) => /^[A-Z]\s*[.)]\s*/i.test(text)
    const isNumericSubPrefix = (text: string) => /^\d+\.\d+\s*/.test(text)
    const isNumericSubSubPrefix = (text: string) => /^\d+\.\d+\.\d+\s*/.test(text)

    const resolveDisplayLevel = (text: string, fallbackLevel: number) => {
      const normalized = sanitizeHeadingForPrefix(text)
      if (isRomanSectionPrefix(normalized)) return 2
      if (isAlphaSectionPrefix(normalized)) return 3
      if (isNumericSubSubPrefix(normalized)) return 4
      if (isNumericSubPrefix(normalized)) return 3
      return fallbackLevel
    }

    let tocHtml = '<div style="font-family: Aptos, Arial, sans-serif; color: #0f172a; padding: 0;">'
    tocHtml += '<h2 style="font-size: 20px; font-weight: 700; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin: 0 0 24px 0; text-transform: uppercase; letter-spacing: 1px;">Table of Contents</h2>'
    tocHtml += '<table style="width: 100%; border-collapse: collapse; border: none; table-layout: fixed;">'
    tocHtml += '<colgroup><col style="width: auto;" /><col style="width: 40px;" /></colgroup>'

    headings.forEach((heading) => {
      const headingText = sanitizeHeadingForPrefix(heading.text)
      const displayLevel = resolveDisplayLevel(headingText, heading.level)

      const paddingLeft = displayLevel === 2 ? '0px' : displayLevel === 3 ? '24px' : '48px'
      const fontSize = displayLevel === 2 ? '14px' : displayLevel === 3 ? '13px' : '12px'
      const fontWeight = displayLevel === 2 ? '600' : '400'
      const paddingTop = displayLevel === 2 ? '10px' : '5px'
      const paddingBottom = displayLevel === 2 ? '10px' : '5px'
      const borderTop = displayLevel === 2 ? 'border-top: 1px solid #e2e8f0;' : ''
      const sectionText = escapeBrdHtml(headingText)
      const color = displayLevel === 2 ? '#0f172a' : '#334155'

      tocHtml += `
        <tr style="${borderTop}">
          <td style="border: none; padding: ${paddingTop} 0 ${paddingBottom} ${paddingLeft}; font-size: ${fontSize}; font-weight: ${fontWeight}; color: ${color}; vertical-align: bottom; white-space: nowrap; overflow: hidden; text-overflow: clip;">
            <span>${sectionText}</span><span style="display: inline-block; width: 100%; overflow: hidden; color: #cbd5e1; letter-spacing: 2px; font-weight: 400; font-size: 11px; padding-left: 6px; vertical-align: bottom; line-height: 1.8;">&nbsp;${`${String.fromCharCode(0xb7)} `.repeat(80).trimEnd()}</span>
          </td>
          <td style="border: none; padding: ${paddingTop} 0 ${paddingBottom} 8px; font-size: ${fontSize}; font-weight: ${fontWeight}; color: #64748b; text-align: right; vertical-align: bottom; white-space: nowrap; width: 40px;">${heading.pageNum}</td>
        </tr>
      `
    })

    tocHtml += '</table>'
    tocHtml += '</div>'
    return tocHtml
  }

  const splitBrdBlockIntoStickyUnits = (block: string) => {
    const lines = block.replace(/\r\n/g, '\n').split('\n')
    const trimmedLines = lines.map((line) => line.trim())
    const headingPrefix: string[] = []
    let idx = 0

    while (idx < trimmedLines.length && isBrdSectionHeadingLine(trimmedLines[idx])) {
      headingPrefix.push(lines[idx])
      idx += 1
    }

    const contentLines = lines.slice(idx)
    const nonEmptyContent = contentLines.filter((line) => line.trim())
    if (!nonEmptyContent.length) return [block.trim()]
    if (!isBrdListItemStartLine(nonEmptyContent[0])) return [block.trim()]

    const items: string[] = []
    let current: string[] = []
    let itemStarts = 0

    for (const line of contentLines) {
      const trimmed = line.trim()
      if (!trimmed) {
        if (current.length > 0) current.push(line)
        continue
      }

      if (isBrdListItemStartLine(trimmed)) {
        itemStarts += 1
        if (current.length > 0) items.push(current.join('\n').trim())
        current = [line]
        continue
      }

      if (!current.length) return [block.trim()]
      current.push(line)
    }

    if (current.length > 0) items.push(current.join('\n').trim())
    if (!items.length || itemStarts === 0) return [block.trim()]

    if (headingPrefix.length > 0) {
      items[0] = `${headingPrefix.join('\n')}\n${items[0]}`.trim()
    }

    return items.map((item) => item.trim()).filter(Boolean)
  }

  const htmlTextToParagraph = (text: string) => {
    const escaped = text
      .split('\n')
      .map((line) => {
        return escapeBrdHtml(line)
      })
      .join('<br />')

    return `<p>${escaped}</p>`
  }

  const splitBrdHtmlIntoBlocks = (html: string) => {
    const container = document.createElement('div')
    container.innerHTML = html.trim()

    const blocks: string[] = []
    for (const node of Array.from(container.childNodes)) {
      if (node.nodeType === globalThis.Node.TEXT_NODE) {
        const text = node.textContent?.trim() ?? ''
        if (text) blocks.push(htmlTextToParagraph(text))
        continue
      }

      if (node.nodeType === globalThis.Node.ELEMENT_NODE) {
        blocks.push((node as HTMLElement).outerHTML)
      }
    }

    if (!blocks.length && html.trim()) return [html.trim()]

    const stickyBlocks: string[] = []
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i]
      const tag = /^<\s*([a-z0-9]+)/i.exec(block)?.[1]?.toLowerCase() ?? ''
      const isHeadingTag = /^h[1-6]$/.test(tag)

      if (isHeadingTag && i + 1 < blocks.length) {
        stickyBlocks.push(`${block}${blocks[i + 1]}`)
        i += 1
        continue
      }

      stickyBlocks.push(block)
    }

    return stickyBlocks
  }

  const joinBrdHtmlBlocks = (blocks: string[]) => blocks.filter((block) => block.trim()).join('')

  const convertBrdTextBlocksToHtmlBlocks = (text: string) => splitBrdTextIntoBlocks(text).map((block) => htmlTextToParagraph(block))

  useEffect(() => {
    if (activePanel !== 'brd') return
    if (brdContentNormalizationRef.current) return

    const normalizedPages = brdPagesRef.current.map((page) => normalizeBrdBodyContent(page))
    const changed = normalizedPages.some((page, idx) => page !== (brdPagesRef.current[idx] ?? ''))
    if (!changed) return

    brdContentNormalizationRef.current = true
    brdPagesRef.current = normalizedPages
    setBrdPages(normalizedPages)
    window.requestAnimationFrame(() => {
      brdContentNormalizationRef.current = false
    })
  }, [activePanel])

  const splitBrdTextIntoBlocks = (text: string) => {
    const normalized = text.replace(/\r\n/g, '\n').trim()
    if (!normalized) return [] as string[]

    const lines = normalized.split('\n')
    const blocks: string[] = []
    let current: string[] = []

    const flush = () => {
      const nextBlock = current.join('\n').trim()
      if (nextBlock) blocks.push(nextBlock)
      current = []
    }

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        flush()
        continue
      }

      if (isBrdSectionHeadingLine(trimmed) && current.length > 0) {
        flush()
      }

      current.push(line)
    }

    flush()

    const stickyBlocks: string[] = []
    for (let i = 0; i < blocks.length; i += 1) {
      const currentBlock = blocks[i]
      if (isBrdHeadingOnlyBlock(currentBlock) && i + 1 < blocks.length) {
        stickyBlocks.push(`${currentBlock}\n\n${blocks[i + 1]}`.trim())
        i += 1
        continue
      }
      stickyBlocks.push(currentBlock)
    }

    return stickyBlocks.flatMap((block) => splitBrdBlockIntoStickyUnits(block))
  }

  const joinBrdTextBlocks = (blocks: string[]) => blocks.filter((block) => block.trim()).join('\n\n')

  const scheduleWordCountUpdate = () => {
    if (brdWordCountRaf.current != null) return
    brdWordCountRaf.current = window.requestAnimationFrame(() => {
      brdWordCountRaf.current = null
      const total = brdPagesRef.current.reduce(
        (acc, page) => acc + countWords(brdPagePlainTextForWordCount(page ?? '')),
        0
      )
      // Update the footer badge without forcing the whole page to re-render.
      brdWordCountUpdateFnRef.current(total)
    })
  }

  useEffect(() => {
    if (!runtimeBrd) return
    const nextHeader = (runtimeBrd.brd_title ?? 'Business Requirements Document (BRD)').trim()
    const nextBody = normalizeBrdBodyContent(runtimeBrd.brd_document ?? buildLocalBrdFallback())
    brdPagesRef.current = [nextBody]
    setBrdPages([nextBody])
    brdHeadersRef.current = [nextHeader]
    setBrdHeaders([nextHeader])
    brdHeaderHeightsRef.current = [18]
    setBrdHeaderHeights([18])
    scheduleWordCountUpdate()
  }, [normalizeBrdBodyContent, runtimeBrd])

  useEffect(() => {
    if (!brdExportOpen) return
    const updatePos = () => {
      const btn = brdExportButtonRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      setBrdExportMenuPos({
        top: r.bottom + 8,
        right: Math.max(8, window.innerWidth - r.right),
      })
    }
    updatePos()
    const onDown = (e: MouseEvent) => {
      const el = brdExportMenuRef.current
      if (!el) return
      if (el.contains(e.target as globalThis.Node)) return
      setBrdExportOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [brdExportOpen])

  useEffect(() => {
    if (!brdTextColorMenuOpen) return
    const updatePos = () => {
      const btn = brdTextColorButtonRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const desiredLeft = r.left
      const desiredTop = r.bottom + 8
      const width = 220
      const height = 150
      setBrdTextColorMenuPos({
        left: Math.max(8, Math.min(window.innerWidth - width - 8, desiredLeft)),
        top: Math.max(8, Math.min(window.innerHeight - height - 8, desiredTop)),
      })
    }
    updatePos()
    const onDown = (e: MouseEvent) => {
      const menu = brdTextColorMenuRef.current
      const btn = brdTextColorButtonRef.current
      const target = e.target as globalThis.Node
      if (menu && menu.contains(target)) return
      if (btn && btn.contains(target)) return
      setBrdTextColorMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [brdTextColorMenuOpen])

  useEffect(() => {
    if (!brdHighlightMenuOpen) return
    const updatePos = () => {
      const btn = brdHighlightButtonRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const desiredLeft = r.left
      const desiredTop = r.bottom + 8
      const width = 220
      const height = 170
      setBrdHighlightMenuPos({
        left: Math.max(8, Math.min(window.innerWidth - width - 8, desiredLeft)),
        top: Math.max(8, Math.min(window.innerHeight - height - 8, desiredTop)),
      })
    }
    updatePos()
    const onDown = (e: MouseEvent) => {
      const menu = brdHighlightMenuRef.current
      const btn = brdHighlightButtonRef.current
      const target = e.target as globalThis.Node
      if (menu && menu.contains(target)) return
      if (btn && btn.contains(target)) return
      setBrdHighlightMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [brdHighlightMenuOpen])

  useEffect(() => {
    if (!brdShadingMenuOpen) return
    const updatePos = () => {
      const btn = brdShadingButtonRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const desiredLeft = r.left
      const desiredTop = r.bottom + 8
      const width = 260
      const height = 260
      setBrdShadingMenuPos({
        left: Math.max(8, Math.min(window.innerWidth - width - 8, desiredLeft)),
        top: Math.max(8, Math.min(window.innerHeight - height - 8, desiredTop)),
      })
    }
    updatePos()
    const onDown = (e: MouseEvent) => {
      const menu = brdShadingMenuRef.current
      const btn = brdShadingButtonRef.current
      const target = e.target as globalThis.Node
      if (menu && menu.contains(target)) return
      if (btn && btn.contains(target)) return
      setBrdShadingMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [brdShadingMenuOpen])

  useEffect(() => {
    if (!brdCaseMenuOpen) return
    const updatePos = () => {
      const btn = brdCaseButtonRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const desiredLeft = r.left
      const desiredTop = r.bottom + 8
      const width = 240
      const height = 220
      setBrdCaseMenuPos({
        left: Math.max(8, Math.min(window.innerWidth - width - 8, desiredLeft)),
        top: Math.max(8, Math.min(window.innerHeight - height - 8, desiredTop)),
      })
    }
    updatePos()
    const onDown = (e: MouseEvent) => {
      const menu = brdCaseMenuRef.current
      const btn = brdCaseButtonRef.current
      const target = e.target as globalThis.Node
      if (menu && menu.contains(target)) return
      if (btn && btn.contains(target)) return
      setBrdCaseMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [brdCaseMenuOpen])

  useEffect(() => {
    if (!brdNumberMenuOpen) return
    const updatePos = () => {
      const btn = brdNumberButtonRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const desiredLeft = r.left
      const desiredTop = r.bottom + 8
      const width = 280
      const height = 360
      setBrdNumberMenuPos({
        left: Math.max(8, Math.min(window.innerWidth - width - 8, desiredLeft)),
        top: Math.max(8, Math.min(window.innerHeight - height - 8, desiredTop)),
      })
    }
    updatePos()
    const onDown = (e: MouseEvent) => {
      const menu = brdNumberMenuRef.current
      const btn = brdNumberButtonRef.current
      const target = e.target as globalThis.Node
      if (menu && menu.contains(target)) return
      if (btn && btn.contains(target)) return
      setBrdNumberMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [brdNumberMenuOpen])

  useEffect(() => {
    if (!brdBulletMenuOpen) return
    const updatePos = () => {
      const btn = brdBulletButtonRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const desiredLeft = r.left
      const desiredTop = r.bottom + 8
      const width = 300
      const height = 240
      setBrdBulletMenuPos({
        left: Math.max(8, Math.min(window.innerWidth - width - 8, desiredLeft)),
        top: Math.max(8, Math.min(window.innerHeight - height - 8, desiredTop)),
      })
    }
    updatePos()
    const onDown = (e: MouseEvent) => {
      const menu = brdBulletMenuRef.current
      const btn = brdBulletButtonRef.current
      const target = e.target as globalThis.Node
      if (menu && menu.contains(target)) return
      if (btn && btn.contains(target)) return
      setBrdBulletMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [brdBulletMenuOpen])

  useEffect(() => {
    if (!brdMultilevelMenuOpen) return
    const updatePos = () => {
      const btn = brdMultilevelButtonRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const desiredLeft = r.left
      const desiredTop = r.bottom + 8
      const width = 280
      const height = 220
      setBrdMultilevelMenuPos({
        left: Math.max(8, Math.min(window.innerWidth - width - 8, desiredLeft)),
        top: Math.max(8, Math.min(window.innerHeight - height - 8, desiredTop)),
      })
    }
    updatePos()
    const onDown = (e: MouseEvent) => {
      const menu = brdMultilevelMenuRef.current
      const btn = brdMultilevelButtonRef.current
      const target = e.target as globalThis.Node
      if (menu && menu.contains(target)) return
      if (btn && btn.contains(target)) return
      setBrdMultilevelMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [brdMultilevelMenuOpen])

  useEffect(() => {
    if (!brdSpacingMenuOpen) return
    const updatePos = () => {
      const btn = brdSpacingButtonRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const desiredLeft = r.left
      const desiredTop = r.bottom + 8
      const width = 260
      const height = 320
      setBrdSpacingMenuPos({
        left: Math.max(8, Math.min(window.innerWidth - width - 8, desiredLeft)),
        top: Math.max(8, Math.min(window.innerHeight - height - 8, desiredTop)),
      })
    }
    updatePos()
    const onDown = (e: MouseEvent) => {
      const menu = brdSpacingMenuRef.current
      const btn = brdSpacingButtonRef.current
      const target = e.target as globalThis.Node
      if (menu && menu.contains(target)) return
      if (btn && btn.contains(target)) return
      setBrdSpacingMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [brdSpacingMenuOpen])

  useEffect(() => {
    if (!brdStylesMenuOpen) return
    const updatePos = () => {
      const btn = brdStylesButtonRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const desiredLeft = r.left
      const desiredTop = r.bottom + 8
      const width = 520
      const height = 260
      setBrdStylesMenuPos({
        left: Math.max(8, Math.min(window.innerWidth - width - 8, desiredLeft)),
        top: Math.max(8, Math.min(window.innerHeight - height - 8, desiredTop)),
      })
    }
    updatePos()
    const onDown = (e: MouseEvent) => {
      const menu = brdStylesMenuRef.current
      const btn = brdStylesButtonRef.current
      const target = e.target as globalThis.Node
      if (menu && menu.contains(target)) return
      if (btn && btn.contains(target)) return
      setBrdStylesMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [brdStylesMenuOpen])

  useEffect(() => {
    if (!brdTableMenuOpen) return
    const updatePos = () => {
      const btn = brdTableButtonRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const desiredLeft = r.left
      const desiredTop = r.bottom + 8
      const width = 280
      const height = 280
      setBrdTableMenuPos({
        left: Math.max(8, Math.min(window.innerWidth - width - 8, desiredLeft)),
        top: Math.max(8, Math.min(window.innerHeight - height - 8, desiredTop)),
      })
    }
    updatePos()
    const onDown = (e: MouseEvent) => {
      const menu = brdTableMenuRef.current
      const btn = brdTableButtonRef.current
      const target = e.target as globalThis.Node
      if (menu && menu.contains(target)) return
      if (btn && btn.contains(target)) return
      setBrdTableMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [brdTableMenuOpen])

  useEffect(() => {
    if (activePanel !== 'brd') return
    const onSelectionChange = () => {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return
      const range = selection.getRangeAt(0)
      const startNode = range.startContainer
      const anyNode = startNode as unknown as { nodeType?: number; parentElement?: HTMLElement | null }
      const element =
        anyNode.nodeType === globalThis.Node.ELEMENT_NODE ? (startNode as unknown as HTMLElement) : (anyNode.parentElement ?? null)
      if (!element) return
      // Only store selection if it's inside any BRD page body.
      const inside = brdPageEditableRefs.current.some((pageEl) => pageEl && pageEl.contains(element))
      if (!inside) return
      brdLastSelectionRangeRef.current = range.cloneRange()
    }

    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [activePanel])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BRD_TEMPLATE_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as BrdTemplate[]
        if (Array.isArray(parsed) && parsed.length) setBrdTemplates(parsed)
      }
      const selected = localStorage.getItem(BRD_TEMPLATE_SELECTED_KEY)
      if (selected) setBrdSelectedTemplateId(selected)
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(BRD_TEMPLATE_STORAGE_KEY, JSON.stringify(brdTemplates))
    } catch {
      // ignore
    }
  }, [brdTemplates])

  useEffect(() => {
    try {
      localStorage.setItem(BRD_TEMPLATE_SELECTED_KEY, brdSelectedTemplateId)
    } catch {
      // ignore
    }
  }, [brdSelectedTemplateId])

  const applyBrdTemplateById = (templateId: string) => {
    const t = brdTemplates.find((x) => x.id === templateId) ?? defaultBrdTemplates.find((x) => x.id === templateId) ?? null
    setBrdSelectedTemplateId(templateId)
    if (!t) return
    setEditingHeaderIndex(null)
    const normalizedBody = normalizeBrdBodyContent(t.body ?? '')
    brdPagesRef.current = [normalizedBody]
    setBrdPages([normalizedBody])
    brdHeadersRef.current = [t.header ?? '']
    setBrdHeaders([t.header ?? ''])
    brdHeaderHeightsRef.current = [18]
    setBrdHeaderHeights([18])
    scheduleWordCountUpdate()
    window.requestAnimationFrame(() => {
      brdPageEditableRefs.current[0]?.focus()
    })
  }

  const newTemplateId = () => {
    const id = globalThis.crypto?.randomUUID?.()
    return id ?? `tpl_${Date.now()}_${Math.random().toString(16).slice(2)}`
  }

  const brdTextColorMenu = brdTextColorMenuOpen
    ? createPortal(
        <div
          ref={brdTextColorMenuRef}
          className="fixed z-[1000] w-[220px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
          style={
            brdTextColorMenuPos ? { top: brdTextColorMenuPos.top, left: brdTextColorMenuPos.left } : { top: 0, left: 0, visibility: 'hidden' }
          }
        >
          <p className="text-[11px] font-semibold text-slate-600">Text color</p>
          <div className="mt-2 grid grid-cols-8 gap-1.5">
            {[
              '#0f172a',
              '#334155',
              '#64748b',
              '#94a3b8',
              '#e2e8f0',
              '#111827',
              '#000000',
              '#ffffff',
              '#ef4444',
              '#f97316',
              '#f59e0b',
              '#84cc16',
              '#22c55e',
              '#14b8a6',
              '#3b82f6',
              '#6366f1',
              '#8b5cf6',
              '#d946ef',
              '#ec4899',
              '#f43f5e',
              '#7c2d12',
              '#14532d',
              '#0c4a6e',
              '#1e3a8a',
            ].map((c) => (
              <button
                key={c}
                type="button"
                className={cn('h-5 w-5 rounded-md border border-slate-200', c.toLowerCase() === brdTextColor.toLowerCase() && 'ring-2 ring-primary/30')}
                style={{ backgroundColor: c }}
                onClick={() => {
                  setBrdTextColor(c)
                  execBrdCommand('foreColor', c)
                  setBrdTextColorMenuOpen(false)
                }}
                aria-label={`Set text color ${c}`}
                title={c}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <label className="relative cursor-pointer text-xs font-medium text-slate-700 hover:text-slate-900">
              Customâ€¦
              <input
                type="color"
                value={brdTextColor}
                onChange={(e) => {
                  const next = e.target.value
                  setBrdTextColor(next)
                  execBrdCommand('foreColor', next)
                  setBrdTextColorMenuOpen(false)
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Custom text color"
              />
            </label>
            <button type="button" className="text-xs font-medium text-slate-500 hover:text-slate-700" onClick={() => setBrdTextColorMenuOpen(false)}>
              Close
            </button>
          </div>
        </div>,
        document.body
      )
    : null

  const applyBrdHighlight = (color: string) => {
    // Prefer hiliteColor; fallback to backColor for older browsers.
    execBrdCommand('hiliteColor', color)
    execBrdCommand('backColor', color)
  }

  const sentenceCase = (text: string) => {
    const lower = text.toLowerCase()
    let result = ''
    let capNext = true
    for (let i = 0; i < lower.length; i += 1) {
      const ch = lower[i]
      if (capNext && /[a-zA-Z\u00C0-\u024F]/.test(ch)) {
        result += ch.toUpperCase()
        capNext = false
        continue
      }
      result += ch
      if (/[.!?]/.test(ch)) capNext = true
      if (ch === '\n') capNext = true
    }
    return result
  }

  const titleCase = (text: string) =>
    text.replace(/\b([A-Za-z\u00C0-\u024F])([A-Za-z\u00C0-\u024F]*)\b/g, (_, a: string, b: string) => a.toUpperCase() + b.toLowerCase())

  const toggleCase = (text: string) =>
    [...text]
      .map((ch) => {
        const up = ch.toUpperCase()
        const low = ch.toLowerCase()
        if (ch === up && ch !== low) return low
        if (ch === low && ch !== up) return up
        return ch
      })
      .join('')

  const applyCaseTransformToSelection = (transform: (text: string) => string) => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    if (selection.isCollapsed) return

    const range = selection.getRangeAt(0)
    // Ensure selection is inside BRD pages.
    const startNode = range.startContainer
    const endNode = range.endContainer
    const isInsideAnyPage = (node: globalThis.Node | null) => {
      if (!node) return false
      const anyNode = node as unknown as { nodeType?: number; parentElement?: HTMLElement | null }
      const element =
        anyNode.nodeType === globalThis.Node.ELEMENT_NODE ? (node as unknown as HTMLElement) : (anyNode.parentElement ?? null)
      if (!element) return false
      return brdPageEditableRefs.current.some((pageEl) => pageEl && pageEl.contains(element))
    }
    if (!isInsideAnyPage(startNode) && !isInsideAnyPage(endNode)) return

    const selectedText = selection.toString()
    const nextText = transform(selectedText)
    focusActiveBrdPage()

    // Replace selection while keeping undo stack as much as possible.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ok = (document as any).execCommand?.('insertText', false, nextText)
    if (!ok) {
      range.deleteContents()
      range.insertNode(document.createTextNode(nextText))
      selection.removeAllRanges()
      const newRange = document.createRange()
      newRange.selectNodeContents(range.endContainer)
      selection.addRange(newRange)
    }
  }

  const getClosestOl = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null
    const range = selection.getRangeAt(0)
    const node = range.startContainer
    const anyNode = node as unknown as { nodeType?: number; parentElement?: HTMLElement | null }
    let el: HTMLElement | null =
      anyNode.nodeType === globalThis.Node.ELEMENT_NODE ? (node as unknown as HTMLElement) : (anyNode.parentElement ?? null)
    while (el) {
      if (el.tagName === 'OL') return el as HTMLOListElement
      el = el.parentElement
    }
    return null
  }

  const getClosestUl = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null
    const range = selection.getRangeAt(0)
    const node = range.startContainer
    const anyNode = node as unknown as { nodeType?: number; parentElement?: HTMLElement | null }
    let el: HTMLElement | null =
      anyNode.nodeType === globalThis.Node.ELEMENT_NODE ? (node as unknown as HTMLElement) : (anyNode.parentElement ?? null)
    while (el) {
      if (el.tagName === 'UL') return el as HTMLUListElement
      el = el.parentElement
    }
    return null
  }

  const clearBrdUlClasses = (ul: HTMLUListElement) => {
    ul.classList.remove('brd-ul-arrow', 'brd-ul-check', 'brd-ul-diamond')
  }

  const applyBrdBulletedListStyle = (style: 'none' | 'disc' | 'circle' | 'square' | 'arrow' | 'check' | 'diamond') => {
    focusActiveBrdPage()

    if (style === 'none') {
      execBrdCommand('insertUnorderedList')
      return
    }

    execBrdCommand('insertUnorderedList')

    window.requestAnimationFrame(() => {
      const ul = getClosestUl()
      if (!ul) return
      clearBrdUlClasses(ul)
      ul.style.listStyleType = 'disc'

      if (style === 'arrow') {
        ul.classList.add('brd-ul-arrow')
        return
      }
      if (style === 'check') {
        ul.classList.add('brd-ul-check')
        return
      }
      if (style === 'diamond') {
        ul.classList.add('brd-ul-diamond')
        return
      }

      ul.style.listStyleType = style
    })
  }

  const getSelectedBrdBlocks = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return [] as HTMLElement[]
    const range = selection.getRangeAt(0)
    const start = range.startContainer
    const end = range.endContainer

    const findRootPage = (node: globalThis.Node | null) => {
      if (!node) return null
      const anyNode = node as unknown as { nodeType?: number; parentElement?: HTMLElement | null }
      let el: HTMLElement | null =
        anyNode.nodeType === globalThis.Node.ELEMENT_NODE ? (node as unknown as HTMLElement) : (anyNode.parentElement ?? null)
      while (el) {
        if (brdPageEditableRefs.current.some((pageEl) => pageEl === el)) return el
        el = el.parentElement
      }
      return null
    }

    const root = findRootPage(start) ?? findRootPage(end)
    if (!root) return []

    const isBlock = (el: HTMLElement) => {
      const tag = el.tagName
      return tag === 'P' || tag === 'DIV' || tag === 'LI'
    }

    const blocks = new Set<HTMLElement>()
    const addClosestBlock = (node: globalThis.Node | null) => {
      if (!node) return
      const anyNode = node as unknown as { nodeType?: number; parentElement?: HTMLElement | null }
      let el: HTMLElement | null =
        anyNode.nodeType === globalThis.Node.ELEMENT_NODE ? (node as unknown as HTMLElement) : (anyNode.parentElement ?? null)
      while (el && el !== root) {
        if (isBlock(el)) {
          blocks.add(el)
          return
        }
        el = el.parentElement
      }
      if (el && isBlock(el)) blocks.add(el)
    }

    if (selection.isCollapsed) {
      addClosestBlock(start)
      return [...blocks]
    }

    // Collect blocks that intersect the selection range.
    const walker = document.createTreeWalker(root, globalThis.NodeFilter.SHOW_ELEMENT)
    let current = walker.currentNode as HTMLElement
    while (current) {
      const el = current as HTMLElement
      if (isBlock(el)) {
        try {
          if (range.intersectsNode(el)) blocks.add(el)
        } catch {
          // intersectsNode can throw on some nodes; ignore.
        }
      }
      current = walker.nextNode() as HTMLElement
    }
    if (!blocks.size) {
      addClosestBlock(start)
      addClosestBlock(end)
    }
    return [...blocks]
  }

  const applyLineSpacingToSelection = (spacing: number) => {
    const blocks = getSelectedBrdBlocks()
    if (!blocks.length) return
    blocks.forEach((el) => {
      el.style.lineHeight = String(spacing)
    })
  }

  const addSpaceBeforeParagraph = () => {
    const blocks = getSelectedBrdBlocks()
    if (!blocks.length) return
    blocks.forEach((el) => {
      el.style.marginTop = '0.6em'
    })
  }

  const removeSpaceAfterParagraph = () => {
    const blocks = getSelectedBrdBlocks()
    if (!blocks.length) return
    blocks.forEach((el) => {
      el.style.marginBottom = '0'
    })
  }

  const applyShadingToSelection = (color: string | null) => {
    const blocks = getSelectedBrdBlocks()
    if (!blocks.length) return
    blocks.forEach((el) => {
      if (!color) el.style.backgroundColor = ''
      else el.style.backgroundColor = color
    })
  }

  const applyBrdStyle = (style: 'normal' | 'no-spacing' | 'title' | 'subtitle' | 'heading1' | 'heading2' | 'quote') => {
    focusActiveBrdPage()

    if (style === 'no-spacing') {
      const blocks = getSelectedBrdBlocks()
      blocks.forEach((el) => {
        el.style.marginTop = '0'
        el.style.marginBottom = '0'
        el.style.lineHeight = String(brdLineHeight)
      })
      return
    }

    const tag =
      style === 'heading1'
        ? 'H1'
        : style === 'heading2'
          ? 'H2'
          : style === 'title'
            ? 'H1'
            : style === 'subtitle'
              ? 'H3'
              : style === 'quote'
                ? 'BLOCKQUOTE'
                : 'P'

    // execCommand formatBlock expects a tag name like 'H1' or '<h1>' depending on browser.
    execBrdCommand('formatBlock', tag)

    // Apply a few inline tweaks on the current block for consistency.
    window.requestAnimationFrame(() => {
      const blocks = getSelectedBrdBlocks()
      blocks.forEach((el) => {
        if (style === 'title') {
          el.style.fontWeight = '700'
          el.style.fontSize = '28px'
          el.style.marginTop = '0'
          el.style.marginBottom = '0.6em'
        } else if (style === 'subtitle') {
          el.style.fontStyle = 'italic'
          el.style.color = '#475569'
          el.style.marginTop = '0'
          el.style.marginBottom = '0.6em'
        } else if (style === 'heading1') {
          el.style.fontWeight = '700'
          el.style.fontSize = '22px'
          el.style.marginTop = '0.9em'
          el.style.marginBottom = '0.35em'
        } else if (style === 'heading2') {
          el.style.fontWeight = '700'
          el.style.fontSize = '18px'
          el.style.marginTop = '0.75em'
          el.style.marginBottom = '0.3em'
        } else if (style === 'quote') {
          el.style.borderLeft = '3px solid #cbd5e1'
          el.style.paddingLeft = '0.75rem'
          el.style.color = '#334155'
          el.style.fontStyle = 'italic'
          el.style.marginTop = '0.5em'
          el.style.marginBottom = '0.5em'
        } else {
          // normal
          el.style.fontSize = ''
          el.style.fontWeight = ''
          el.style.fontStyle = ''
          el.style.color = ''
          el.style.borderLeft = ''
          el.style.paddingLeft = ''
          el.style.marginTop = ''
          el.style.marginBottom = ''
          el.style.lineHeight = String(brdLineHeight)
        }
      })
    })
  }

  const insertBrdTable = (rows: number, cols: number) => {
    if (isBrdGenerating) return
    const pageIndex = brdLastFocusedPage.current ?? brdActivePageIndex
    const host = focusActiveBrdPage()
    const safeRows = Math.max(1, Math.min(12, Math.floor(rows)))
    const safeCols = Math.max(1, Math.min(12, Math.floor(cols)))
    if (!host) return

    const selection = window.getSelection()
    // Restore last editor selection (toolbar clicks steal focus).
    if (selection && brdLastSelectionRangeRef.current) {
      try {
        const clone = brdLastSelectionRangeRef.current.cloneRange()
        selection.removeAllRanges()
        selection.addRange(clone)
      } catch {
        // ignore
      }
    }
    const range =
      (selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null) ??
      brdLastSelectionRangeRef.current ??
      null
    if (!range) return
    // Only insert if the caret/selection is inside the active BRD page.
    const containerNode = range.startContainer
    const anyNode = containerNode as unknown as { nodeType?: number; parentElement?: HTMLElement | null }
    const element =
      anyNode.nodeType === globalThis.Node.ELEMENT_NODE ? (containerNode as unknown as HTMLElement) : (anyNode.parentElement ?? null)
    // If selection is not inside the body anymore (because toolbar stole focus), fallback to the end of host.
    const insertRange = range.cloneRange()
    if (!element || !host.contains(element)) {
      insertRange.selectNodeContents(host)
      insertRange.collapse(false)
    }

    const table = document.createElement('table')
    table.className = 'brd-table'
    table.style.width = '100%'
    table.style.borderCollapse = 'collapse'
    table.style.tableLayout = 'fixed'
    table.style.margin = '0.5rem 0'
    const tbody = document.createElement('tbody')
    table.appendChild(tbody)

    for (let r = 0; r < safeRows; r += 1) {
      const tr = document.createElement('tr')
      for (let c = 0; c < safeCols; c += 1) {
        const td = document.createElement('td')
        td.style.border = '1px solid #334155'
        td.style.padding = '6px 8px'
        td.style.verticalAlign = 'top'
        td.style.minWidth = '48px'
        td.appendChild(document.createElement('br'))
        tr.appendChild(td)
      }
      tbody.appendChild(tr)
    }

    const after = document.createElement('p')
    after.appendChild(document.createElement('br'))

    // Replace current selection with the table.
    insertRange.deleteContents()
    insertRange.insertNode(after)
    insertRange.insertNode(table)

    // Move caret into the first cell.
    const firstCell = tbody.querySelector('td')
    if (firstCell) {
      const newRange = document.createRange()
      newRange.selectNodeContents(firstCell)
      newRange.collapse(true)
      const sel = window.getSelection()
      if (sel) {
        sel.removeAllRanges()
        sel.addRange(newRange)
      }
    }

    // Commit HTML so a re-render won't strip the table (innerText-only state removes <table> from the DOM).
    const nextContent = host.innerHTML
    brdPagesRef.current[pageIndex] = nextContent
    setBrdPages([...brdPagesRef.current])
    scheduleWordCountUpdate()
  }

  const clearBrdOlClasses = (ol: HTMLOListElement) => {
    ol.classList.remove('brd-ol-decimal-paren', 'brd-ol-upper-alpha-paren', 'brd-ol-lower-alpha-paren', 'brd-ol-multilevel-decimal')
  }

  const applyBrdOrderedListStyle = (
    style:
      | 'none'
      | 'decimal'
      | 'upper-alpha'
      | 'lower-alpha'
      | 'upper-roman'
      | 'lower-roman'
      | 'decimal-paren'
      | 'upper-alpha-paren'
      | 'lower-alpha-paren'
      | 'multilevel-decimal'
  ) => {
    focusActiveBrdPage()

    if (style === 'none') {
      execBrdCommand('insertOrderedList')
      return
    }

    // Ensure we are in an ordered list first.
    execBrdCommand('insertOrderedList')

    window.requestAnimationFrame(() => {
      const ol = getClosestOl()
      if (!ol) return
      clearBrdOlClasses(ol)

      if (style === 'decimal-paren') {
        ol.classList.add('brd-ol-decimal-paren')
        return
      }
      if (style === 'upper-alpha-paren') {
        ol.classList.add('brd-ol-upper-alpha-paren')
        return
      }
      if (style === 'lower-alpha-paren') {
        ol.classList.add('brd-ol-lower-alpha-paren')
        return
      }
      if (style === 'multilevel-decimal') {
        ol.classList.add('brd-ol-multilevel-decimal')
        return
      }

      ol.style.listStyleType = style
    })
  }

  const brdCaseMenu = brdCaseMenuOpen
    ? createPortal(
        <div
          ref={brdCaseMenuRef}
          className="fixed z-[1000] w-[240px] overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
          style={brdCaseMenuPos ? { top: brdCaseMenuPos.top, left: brdCaseMenuPos.left } : { top: 0, left: 0, visibility: 'hidden' }}
        >
          <button
            type="button"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
            onClick={() => {
              applyCaseTransformToSelection(sentenceCase)
              setBrdCaseMenuOpen(false)
            }}
          >
            Sentence case.
          </button>
          <button
            type="button"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
            onClick={() => {
              applyCaseTransformToSelection((t) => t.toLowerCase())
              setBrdCaseMenuOpen(false)
            }}
          >
            lowercase
          </button>
          <button
            type="button"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
            onClick={() => {
              applyCaseTransformToSelection((t) => t.toUpperCase())
              setBrdCaseMenuOpen(false)
            }}
          >
            UPPERCASE
          </button>
          <button
            type="button"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
            onClick={() => {
              applyCaseTransformToSelection(titleCase)
              setBrdCaseMenuOpen(false)
            }}
          >
            Capitalize Each Word
          </button>
          <button
            type="button"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
            onClick={() => {
              applyCaseTransformToSelection(toggleCase)
              setBrdCaseMenuOpen(false)
            }}
          >
            tOGGLE cASE
          </button>
        </div>,
        document.body
      )
    : null

  const brdNumberMenu = brdNumberMenuOpen
    ? createPortal(
        <div
          ref={brdNumberMenuRef}
          className="fixed z-[1000] w-[280px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          style={
            brdNumberMenuPos ? { top: brdNumberMenuPos.top, left: brdNumberMenuPos.left } : { top: 0, left: 0, visibility: 'hidden' }
          }
        >
          <div className="px-3 py-2 text-[11px] font-semibold text-slate-600">Numbering</div>
          <div className="grid grid-cols-2 gap-2 px-3 pb-3">
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-2 text-left hover:bg-slate-50"
              onClick={() => {
                applyBrdOrderedListStyle('none')
                setBrdNumberMenuOpen(false)
              }}
            >
              <div className="text-[11px] font-semibold text-slate-800">None</div>
              <div className="mt-1 text-[11px] text-slate-500">Remove numbering</div>
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-2 text-left hover:bg-slate-50"
              onClick={() => {
                applyBrdOrderedListStyle('decimal')
                setBrdNumberMenuOpen(false)
              }}
            >
              <div className="text-[11px] font-semibold text-slate-800">1. 2. 3.</div>
              <div className="mt-1 text-[11px] text-slate-500">Decimal</div>
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-2 text-left hover:bg-slate-50"
              onClick={() => {
                applyBrdOrderedListStyle('decimal-paren')
                setBrdNumberMenuOpen(false)
              }}
            >
              <div className="text-[11px] font-semibold text-slate-800">1) 2) 3)</div>
              <div className="mt-1 text-[11px] text-slate-500">Decimal ( )</div>
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-2 text-left hover:bg-slate-50"
              onClick={() => {
                applyBrdOrderedListStyle('upper-alpha')
                setBrdNumberMenuOpen(false)
              }}
            >
              <div className="text-[11px] font-semibold text-slate-800">A. B. C.</div>
              <div className="mt-1 text-[11px] text-slate-500">Upper alpha</div>
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-2 text-left hover:bg-slate-50"
              onClick={() => {
                applyBrdOrderedListStyle('lower-alpha')
                setBrdNumberMenuOpen(false)
              }}
            >
              <div className="text-[11px] font-semibold text-slate-800">a. b. c.</div>
              <div className="mt-1 text-[11px] text-slate-500">Lower alpha</div>
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-2 text-left hover:bg-slate-50"
              onClick={() => {
                applyBrdOrderedListStyle('upper-roman')
                setBrdNumberMenuOpen(false)
              }}
            >
              <div className="text-[11px] font-semibold text-slate-800">I. II. III.</div>
              <div className="mt-1 text-[11px] text-slate-500">Upper roman</div>
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-2 text-left hover:bg-slate-50"
              onClick={() => {
                applyBrdOrderedListStyle('lower-roman')
                setBrdNumberMenuOpen(false)
              }}
            >
              <div className="text-[11px] font-semibold text-slate-800">i. ii. iii.</div>
              <div className="mt-1 text-[11px] text-slate-500">Lower roman</div>
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-2 text-left hover:bg-slate-50"
              onClick={() => {
                applyBrdOrderedListStyle('upper-alpha-paren')
                setBrdNumberMenuOpen(false)
              }}
            >
              <div className="text-[11px] font-semibold text-slate-800">A) B) C)</div>
              <div className="mt-1 text-[11px] text-slate-500">Upper alpha ( )</div>
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-2 text-left hover:bg-slate-50"
              onClick={() => {
                applyBrdOrderedListStyle('lower-alpha-paren')
                setBrdNumberMenuOpen(false)
              }}
            >
              <div className="text-[11px] font-semibold text-slate-800">a) b) c)</div>
              <div className="mt-1 text-[11px] text-slate-500">Lower alpha ( )</div>
            </button>
          </div>
        </div>,
        document.body
      )
    : null

  const brdBulletMenu = brdBulletMenuOpen
    ? createPortal(
        <div
          ref={brdBulletMenuRef}
          className="fixed z-[1000] w-[300px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          style={
            brdBulletMenuPos ? { top: brdBulletMenuPos.top, left: brdBulletMenuPos.left } : { top: 0, left: 0, visibility: 'hidden' }
          }
        >
          <div className="px-3 py-2 text-[11px] font-semibold text-slate-600">Bullet Library</div>
          <div className="grid grid-cols-6 gap-2 px-3 pb-3">
            {[
              { key: 'none' as const, label: 'None', preview: 'None' },
              { key: 'disc' as const, label: 'â—', preview: 'â—' },
              { key: 'circle' as const, label: 'â—‹', preview: 'â—‹' },
              { key: 'square' as const, label: 'â– ', preview: 'â– ' },
              { key: 'arrow' as const, label: 'âž¤', preview: 'âž¤' },
              { key: 'diamond' as const, label: 'â–', preview: 'â–' },
              { key: 'check' as const, label: 'âœ“', preview: 'âœ“' },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={cn(
                  'flex h-12 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-900 hover:bg-slate-50',
                  opt.key === 'none' && 'text-[11px] font-semibold'
                )}
                onClick={() => {
                  applyBrdBulletedListStyle(opt.key)
                  setBrdBulletMenuOpen(false)
                }}
                aria-label={`Bulleted list style ${opt.label}`}
                title={opt.label}
              >
                <span className={cn('text-lg', opt.key === 'none' && 'text-sm')}>{opt.preview}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">Change List Level (coming soon)</div>
        </div>,
        document.body
      )
    : null

  const brdMultilevelMenu = brdMultilevelMenuOpen
    ? createPortal(
        <div
          ref={brdMultilevelMenuRef}
          className="fixed z-[1000] w-[280px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          style={
            brdMultilevelMenuPos ? { top: brdMultilevelMenuPos.top, left: brdMultilevelMenuPos.left } : { top: 0, left: 0, visibility: 'hidden' }
          }
        >
          <div className="px-3 py-2 text-[11px] font-semibold text-slate-600">Multilevel List</div>
          <div className="grid grid-cols-2 gap-2 px-3 pb-3">
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-2 text-left hover:bg-slate-50"
              onClick={() => {
                applyBrdOrderedListStyle('none')
                setBrdMultilevelMenuOpen(false)
              }}
            >
              <div className="text-[11px] font-semibold text-slate-800">None</div>
              <div className="mt-1 text-[11px] text-slate-500">Remove list</div>
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-2 text-left hover:bg-slate-50"
              onClick={() => {
                applyBrdOrderedListStyle('multilevel-decimal')
                setBrdMultilevelMenuOpen(false)
              }}
            >
              <div className="text-[11px] font-semibold text-slate-800">1.1.1</div>
              <div className="mt-1 text-[11px] text-slate-500">Decimal multilevel</div>
            </button>
          </div>

          <div className="border-t border-slate-200 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600">Change List Level</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  onClick={() => execBrdCommand('outdent')}
                >
                  âˆ’
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  onClick={() => execBrdCommand('indent')}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )
    : null

  const brdSpacingMenu = brdSpacingMenuOpen
    ? createPortal(
        <div
          ref={brdSpacingMenuRef}
          className="fixed z-[1000] w-[260px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          style={brdSpacingMenuPos ? { top: brdSpacingMenuPos.top, left: brdSpacingMenuPos.left } : { top: 0, left: 0, visibility: 'hidden' }}
        >
          <div className="px-3 py-2 text-[11px] font-semibold text-slate-600">Line &amp; Paragraph Spacing</div>
          <div className="px-2 pb-2">
            {[1.0, 1.15, 1.5, 2.0, 2.5, 3.0].map((v) => (
              <button
                key={v}
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                onClick={() => {
                  applyLineSpacingToSelection(v)
                  setBrdSpacingMenuOpen(false)
                }}
              >
                {String(v).replace('.', ',')}
              </button>
            ))}
          </div>
          <div className="border-t border-slate-200 px-2 py-2">
            <button
              type="button"
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
              onClick={() => {
                addSpaceBeforeParagraph()
                setBrdSpacingMenuOpen(false)
              }}
            >
              Add Space Before Paragraph
            </button>
            <button
              type="button"
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
              onClick={() => {
                removeSpaceAfterParagraph()
                setBrdSpacingMenuOpen(false)
              }}
            >
              Remove Space After Paragraph
            </button>
          </div>
        </div>,
        document.body
      )
    : null

  const brdStylesMenu = brdStylesMenuOpen
    ? createPortal(
        <div
          ref={brdStylesMenuRef}
          className="fixed z-[1000] w-[520px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          style={brdStylesMenuPos ? { top: brdStylesMenuPos.top, left: brdStylesMenuPos.left } : { top: 0, left: 0, visibility: 'hidden' }}
        >
          <div className="px-4 py-2 text-[11px] font-semibold text-slate-600">Styles</div>
          <div className="grid grid-cols-3 gap-2 px-4 pb-4">
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50"
              onClick={() => {
                applyBrdStyle('normal')
                setBrdStylesMenuOpen(false)
              }}
            >
              <div className="text-sm font-medium text-slate-900">Normal</div>
              <div className="mt-1 text-[11px] text-slate-500">Body text</div>
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50"
              onClick={() => {
                applyBrdStyle('no-spacing')
                setBrdStylesMenuOpen(false)
              }}
            >
              <div className="text-sm font-medium text-slate-900">No Spacing</div>
              <div className="mt-1 text-[11px] text-slate-500">Remove paragraph spacing</div>
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50"
              onClick={() => {
                applyBrdStyle('title')
                setBrdStylesMenuOpen(false)
              }}
            >
              <div className="text-lg font-bold text-slate-900 leading-tight">Title</div>
              <div className="mt-1 text-[11px] text-slate-500">Document title</div>
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50"
              onClick={() => {
                applyBrdStyle('heading1')
                setBrdStylesMenuOpen(false)
              }}
            >
              <div className="text-base font-bold text-slate-900">Heading</div>
              <div className="mt-1 text-[11px] text-slate-500">Section heading</div>
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50"
              onClick={() => {
                applyBrdStyle('heading2')
                setBrdStylesMenuOpen(false)
              }}
            >
              <div className="text-sm font-bold text-slate-900">Heading 2</div>
              <div className="mt-1 text-[11px] text-slate-500">Subheading</div>
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50"
              onClick={() => {
                applyBrdStyle('subtitle')
                setBrdStylesMenuOpen(false)
              }}
            >
              <div className="text-sm italic text-slate-700">Subtitle</div>
              <div className="mt-1 text-[11px] text-slate-500">Secondary title</div>
            </button>
            <button
              type="button"
              className="col-span-3 rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50"
              onClick={() => {
                applyBrdStyle('quote')
                setBrdStylesMenuOpen(false)
              }}
            >
              <div className="border-l-2 border-slate-300 pl-3 text-sm italic text-slate-700">Quote</div>
              <div className="mt-1 text-[11px] text-slate-500">Emphasized quotation</div>
            </button>
          </div>
        </div>,
        document.body
      )
    : null

  const brdTableMenu = brdTableMenuOpen
    ? createPortal(
        <div
          ref={brdTableMenuRef}
          className="fixed z-[1000] w-[280px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          style={brdTableMenuPos ? { top: brdTableMenuPos.top, left: brdTableMenuPos.left } : { top: 0, left: 0, visibility: 'hidden' }}
          onMouseLeave={() => setBrdTableHover(null)}
        >
          <div className="px-3 py-2 text-[11px] font-semibold text-slate-600">Insert Table</div>
          <div className="px-3 pb-3">
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: 80 }).map((_, idx) => {
                const r = Math.floor(idx / 10) + 1
                const c = (idx % 10) + 1
                const active = brdTableHover ? r <= brdTableHover.rows && c <= brdTableHover.cols : false
                return (
                  <button
                    key={idx}
                    type="button"
                    className={cn('h-5 w-5 rounded-[3px] border', active ? 'border-sky-400 bg-sky-100' : 'border-slate-200 bg-white')}
                    onMouseDown={(e) => {
                      // Keep the editor selection/caret when choosing table size.
                      e.preventDefault()
                    }}
                    onMouseEnter={() => setBrdTableHover({ rows: r, cols: c })}
                    onFocus={() => setBrdTableHover({ rows: r, cols: c })}
                    onClick={() => {
                      insertBrdTable(r, c)
                      setBrdTableMenuOpen(false)
                      setBrdTableHover(null)
                    }}
                    aria-label={`Insert table ${r} by ${c}`}
                    title={`${r} x ${c}`}
                  />
                )
              })}
            </div>
            <div className="mt-2 text-xs text-slate-600">
              {brdTableHover ? `${brdTableHover.cols} x ${brdTableHover.rows}` : 'Select size'}
            </div>
          </div>
        </div>,
        document.body
      )
    : null

  const brdHighlightMenu = brdHighlightMenuOpen
    ? createPortal(
        <div
          ref={brdHighlightMenuRef}
          className="fixed z-[1000] w-[220px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
          style={
            brdHighlightMenuPos
              ? { top: brdHighlightMenuPos.top, left: brdHighlightMenuPos.left }
              : { top: 0, left: 0, visibility: 'hidden' }
          }
        >
          <p className="text-[11px] font-semibold text-slate-600">Highlight</p>
          <div className="mt-2 grid grid-cols-8 gap-1.5">
            {[
              '#fde047',
              '#fef08a',
              '#86efac',
              '#67e8f9',
              '#93c5fd',
              '#c4b5fd',
              '#fda4af',
              '#fdba74',
              '#fff7ed',
              '#f1f5f9',
              '#e2e8f0',
              '#cbd5e1',
              '#fecaca',
              '#fed7aa',
              '#bbf7d0',
              '#cffafe',
              '#dbeafe',
              '#ede9fe',
              '#fae8ff',
              '#fce7f3',
              '#fef3c7',
              '#dcfce7',
              '#e0f2fe',
              '#eef2ff',
            ].map((c) => (
              <button
                key={c}
                type="button"
                className={cn(
                  'h-5 w-5 rounded-md border border-slate-200',
                  c.toLowerCase() === brdHighlightColor.toLowerCase() && 'ring-2 ring-primary/30'
                )}
                style={{ backgroundColor: c }}
                onClick={() => {
                  setBrdHighlightColor(c)
                  applyBrdHighlight(c)
                  setBrdHighlightMenuOpen(false)
                }}
                aria-label={`Set highlight color ${c}`}
                title={c}
              />
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              className="text-xs font-medium text-slate-700 hover:text-slate-900"
              onClick={() => {
                applyBrdHighlight('transparent')
                setBrdHighlightMenuOpen(false)
              }}
            >
              No Color
            </button>
            <label className="relative cursor-pointer text-xs font-medium text-slate-700 hover:text-slate-900">
              Customâ€¦
              <input
                type="color"
                value={brdHighlightColor}
                onChange={(e) => {
                  const next = e.target.value
                  setBrdHighlightColor(next)
                  applyBrdHighlight(next)
                  setBrdHighlightMenuOpen(false)
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Custom highlight color"
              />
            </label>
          </div>
        </div>,
        document.body
      )
    : null

  const brdShadingMenu = brdShadingMenuOpen
    ? createPortal(
        <div
          ref={brdShadingMenuRef}
          className="fixed z-[1000] w-[260px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          style={brdShadingMenuPos ? { top: brdShadingMenuPos.top, left: brdShadingMenuPos.left } : { top: 0, left: 0, visibility: 'hidden' }}
        >
          <div className="px-3 py-2 text-[11px] font-semibold text-slate-600">Shading</div>
          <div className="grid grid-cols-10 gap-1.5 px-3 pb-3">
            {[
              '#ffffff',
              '#f1f5f9',
              '#e2e8f0',
              '#cbd5e1',
              '#94a3b8',
              '#0f172a',
              '#000000',
              '#fde047',
              '#fef08a',
              '#fecaca',
              '#fdba74',
              '#bbf7d0',
              '#cffafe',
              '#dbeafe',
              '#ede9fe',
              '#fae8ff',
              '#fce7f3',
              '#f97316',
              '#22c55e',
              '#3b82f6',
            ].map((c) => (
              <button
                key={c}
                type="button"
                className={cn(
                  'h-5 w-5 rounded-md border border-slate-200',
                  c.toLowerCase() === brdShadingColor.toLowerCase() && 'ring-2 ring-primary/30'
                )}
                style={{ backgroundColor: c }}
                onClick={() => {
                  setBrdShadingColor(c)
                  applyShadingToSelection(c)
                  setBrdShadingMenuOpen(false)
                }}
                aria-label={`Set shading ${c}`}
                title={c}
              />
            ))}
          </div>
          <div className="border-t border-slate-200 px-3 py-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="text-xs font-medium text-slate-700 hover:text-slate-900"
                onClick={() => {
                  applyShadingToSelection(null)
                  setBrdShadingMenuOpen(false)
                }}
              >
                No Color
              </button>
              <label className="relative cursor-pointer text-xs font-medium text-slate-700 hover:text-slate-900">
                More Colorsâ€¦
                <input
                  type="color"
                  value={brdShadingColor}
                  onChange={(e) => {
                    const next = e.target.value
                    setBrdShadingColor(next)
                    applyShadingToSelection(next)
                    setBrdShadingMenuOpen(false)
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Custom shading color"
                />
              </label>
            </div>
          </div>
        </div>,
        document.body
      )
    : null

  const getBrdExportPages = () => {
    const pages = brdPagesRef.current
    const headers = brdHeadersRef.current
    return pages.map((body, idx) => ({
      header: (headers[idx] ?? '').trim(),
      body: (body ?? '').replace(/\u00A0/g, ' ').trimEnd(),
    }))
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const exportBrdMarkdown = () => {
    const pages = getBrdExportPages()
    const md = pages
      .map(({ header, body }, idx) => {
        const parts: string[] = []
        if (header) parts.push(`#### ${header}`)
        if (body) parts.push(body)
        if (!header && !body) parts.push('')
        // Page separator
        if (idx < pages.length - 1) parts.push('\n---\n')
        return parts.join('\n\n')
      })
      .join('\n\n')

    downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), 'BRD.md')
  }

  const getBrdExportBlocks = (body: string): Array<{ type: 'paragraph'; lines: string[] } | { type: 'table'; rows: string[][] }> => {
    const normalized = (body ?? '').replace(/\u00A0/g, ' ').trim()
    if (!normalized) return []

    if (!brdBodyHasHtmlMarkup(normalized)) {
      return normalized
        .split(/\n\s*\n/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block) => ({
          type: 'paragraph' as const,
          lines: block.split('\n').map((line) => line.trimEnd()),
        }))
    }

    const container = document.createElement('div')
    container.innerHTML = normalized
    const blocks: Array<{ type: 'paragraph'; lines: string[] } | { type: 'table'; rows: string[][] }> = []

    const appendParagraphFromText = (text: string) => {
      const cleaned = text.replace(/\u00A0/g, ' ').trim()
      if (!cleaned) return
      blocks.push({
        type: 'paragraph',
        lines: cleaned.split('\n').map((line) => line.trimEnd()),
      })
    }

    for (const node of Array.from(container.childNodes)) {
      if (node.nodeType === globalThis.Node.TEXT_NODE) {
        appendParagraphFromText(node.textContent ?? '')
        continue
      }

      if (node.nodeType !== globalThis.Node.ELEMENT_NODE) continue
      const el = node as HTMLElement
      if (el.tagName.toLowerCase() === 'table') {
        const rows = Array.from(el.querySelectorAll('tr'))
          .map((row) =>
            Array.from(row.querySelectorAll('th,td')).map((cell) => (cell as HTMLElement).innerText.replace(/\u00A0/g, ' ').trim())
          )
          .filter((row) => row.length > 0)
        if (rows.length) {
          blocks.push({ type: 'table', rows })
          continue
        }
      }

      appendParagraphFromText(el.innerText)
    }

    return blocks
  }

  const exportBrdWord = async () => {
    const pages = getBrdExportPages()
    const { Document, Packer, Paragraph, TextRun, PageBreak, Table, TableRow, TableCell, WidthType } = await import('docx')

    const children: unknown[] = []
    pages.forEach(({ header, body }, idx) => {
      if (header) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: header, bold: true })],
            spacing: { after: 180 },
          })
        )
      }

      const blocks = getBrdExportBlocks(body)
      blocks.forEach((block) => {
        if (block.type === 'paragraph') {
          block.lines.forEach((line) => {
            children.push(new Paragraph({ text: line || '' }))
          })
          children.push(new Paragraph({ text: '' }))
          return
        }

        const columnCount = Math.max(...block.rows.map((row) => row.length), 1)
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: block.rows.map(
              (row) =>
                new TableRow({
                  children: Array.from({ length: columnCount }).map((_, cellIndex) =>
                    new TableCell({
                      width: { size: Math.floor(100 / columnCount), type: WidthType.PERCENTAGE },
                      children: [new Paragraph({ text: row[cellIndex] ?? '' })],
                    })
                  ),
                })
            ),
          })
        )
        children.push(new Paragraph({ text: '' }))
      })

      if (idx < pages.length - 1) children.push(new Paragraph({ children: [new PageBreak()] }))
    })

    const doc = new Document({
      sections: [{ properties: {}, children: children as any }],
    })

    const blob = await Packer.toBlob(doc)
    downloadBlob(
      blob,
      'BRD.docx'
    )
  }

  const exportBrdPdf = async () => {
    const pages = getBrdExportPages()
    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' })

    const marginX = 56
    const marginTop = 64
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const usableWidth = pageWidth - marginX * 2
    const lineGap = 16
    const bottomMargin = 64

    const addTextBlock = (text: string, startY: number, maxWidth = usableWidth) => {
      const lines = pdf.splitTextToSize(text, usableWidth)
      let y = startY
      for (const line of lines) {
        if (y > pageHeight - bottomMargin) {
          pdf.addPage()
          y = marginTop
        }
        pdf.text(line, marginX, y, { maxWidth })
        y += lineGap
      }
      return y
    }

    const addTableBlock = (rows: string[][], startY: number) => {
      let y = startY
      const columnCount = Math.max(...rows.map((row) => row.length), 1)
      const cellWidth = usableWidth / columnCount

      for (const row of rows) {
        const cellLines = Array.from({ length: columnCount }).map((_, cellIndex) =>
          pdf.splitTextToSize(row[cellIndex] ?? '', Math.max(24, cellWidth - 10)) as string[]
        )
        const lineCount = Math.max(...cellLines.map((lines) => Math.max(lines.length, 1)), 1)
        const rowHeight = Math.max(22, lineCount * 12 + 10)

        if (y + rowHeight > pageHeight - bottomMargin) {
          pdf.addPage()
          y = marginTop
        }

        let x = marginX
        cellLines.forEach((lines, cellIndex) => {
          pdf.rect(x, y - 12, cellWidth, rowHeight)
          const textYStart = y + 2
          lines.forEach((line, lineIndex) => {
            pdf.text(line, x + 4, textYStart + lineIndex * 12, { maxWidth: cellWidth - 8 })
          })
          x += cellWidth
        })

        y += rowHeight
      }

      return y + 8
    }

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(12)

    let first = true
    pages.forEach(({ header, body }) => {
      if (!first) pdf.addPage()
      first = false

      let y = marginTop
      if (header) {
        pdf.setFont('helvetica', 'bold')
        y = addTextBlock(header, y)
        y += 8
        pdf.setFont('helvetica', 'normal')
      }

      const blocks = getBrdExportBlocks(body)
      blocks.forEach((block) => {
        if (block.type === 'paragraph') {
          const text = block.lines.join('\n')
          if (text.trim()) {
            y = addTextBlock(text, y)
            y += 6
          }
          return
        }

        y = addTableBlock(block.rows, y)
      })
    })

    const blob = pdf.output('blob')
    downloadBlob(blob, 'BRD.pdf')
  }

  const BrdFooter = () => {
    const [wordCount, setWordCount] = useState(0)

    useEffect(() => {
      brdWordCountUpdateFnRef.current = setWordCount
      // Ensure badge is correct after mount.
      scheduleWordCountUpdate()
      return () => {
        brdWordCountUpdateFnRef.current = () => {}
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
      // Ensure badge is correct after pagination changes.
      scheduleWordCountUpdate()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [brdPages.length])

    return (
      <div className="sticky bottom-3 z-10 w-full px-3">
        <div className="flex w-full items-center justify-between">
          <div className="w-fit rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[12px] text-slate-700 shadow-sm">
            Page {Math.min(brdActivePageIndex + 1, brdPages.length)} of {brdPages.length} &nbsp;&nbsp; {wordCount} words
          </div>

          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[12px] text-slate-700 shadow-sm">
            <button
              type="button"
              className="h-6 w-6 rounded-full border border-slate-200 bg-white text-slate-700 leading-none"
              onClick={() => setBrdZoom((z) => Math.max(BRD_ZOOM_MIN, Number((z - BRD_ZOOM_STEP).toFixed(2))))}
              aria-label="Zoom out"
            >
              âˆ’
            </button>
            <input
              type="range"
              min={BRD_ZOOM_MIN}
              max={brdMaxZoomFit}
              step={BRD_ZOOM_STEP}
              value={brdZoom}
              onChange={(e) => setBrdZoom(Number(e.target.value))}
              className={cn(
                'w-28 h-1 appearance-none rounded-full bg-slate-200',
                '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-700',
                '[&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(15,23,42,0.25)]',
                '[&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-slate-700',
                '[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-slate-200'
              )}
            />
            <div className="w-12 text-right tabular-nums">{Math.round(brdZoom * 100)}%</div>
            <button
              type="button"
              className="h-6 w-6 rounded-full border border-slate-200 bg-white text-slate-700 leading-none"
              onClick={() => setBrdZoom((z) => Math.min(brdMaxZoomFit, Number((z + BRD_ZOOM_STEP).toFixed(2))))}
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
        </div>
      </div>
    )
  }

  useEffect(() => {
    if (activePanel !== 'brd') return
    const sections = brdPageSectionRefs.current.filter(Boolean) as HTMLElement[]
    if (!sections.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        let best: { idx: number; ratio: number } | null = null
        for (const entry of entries) {
          const idxAttr = (entry.target as HTMLElement).dataset.pageIndex
          const idx = idxAttr ? Number(idxAttr) : NaN
          if (!Number.isFinite(idx)) continue
          const ratio = entry.intersectionRatio
          if (!best || ratio > best.ratio) best = { idx, ratio }
        }
        if (best && best.ratio > 0) setBrdActivePageIndex(best.idx)
      },
      { root: null, threshold: [0.15, 0.25, 0.4, 0.55, 0.7] }
    )

    for (const el of sections) observer.observe(el)
    return () => observer.disconnect()
  }, [activePanel, brdPages.length])

  const getBodyMaxHeightPx = (pageIndex: number) => {
    const headerH = brdHeaderHeightsRef.current[pageIndex] ?? 18
    // Body area shrinks as header grows, with safety bottom padding to prevent overflow
    return Math.max(180, BRD_CONTENT_HEIGHT_PX - headerH - BRD_HEADER_BODY_GAP_PX - BRD_BOTTOM_PADDING_PX)
  }

  const focusActiveBrdPage = () => {
    if (isBrdGenerating) return null
    const idx = brdLastFocusedPage.current ?? brdActivePageIndex
    const el = brdPageEditableRefs.current[idx] ?? brdPageEditableRefs.current[brdActivePageIndex] ?? null
    el?.focus()
    return el
  }

  const execBrdCommand = (command: string, value?: string) => {
    if (isBrdGenerating) return
    focusActiveBrdPage()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(document as any).execCommand?.(command, false, value)
  }

  const clearBrdFormatting = () => {
    if (isBrdGenerating) return
    focusActiveBrdPage()
    execBrdCommand('removeFormat')
    execBrdCommand('unlink')
    // Ensure highlight/background is cleared across browsers.
    execBrdCommand('hiliteColor', 'transparent')
    execBrdCommand('backColor', 'transparent')
  }

  const commitHeaderToState = (index: number) => {
    setBrdHeaders((prev) => {
      const next = [...prev]
      next[index] = brdHeadersRef.current[index] ?? ''
      return next
    })
  }

  const findLargestFittingPrefix = (text: string, maxHeight: number) => {
    if (!text) return 0
    let lo = 0
    let hi = text.length
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      const h = measureBrdBodyHeight(text.slice(0, mid))
      if (h <= maxHeight) lo = mid
      else hi = mid - 1
    }
    return lo
  }

  const splitForPage = (text: string, maxHeightPx: number) => {
    const fitLen = findLargestFittingPrefix(text, maxHeightPx)
    if (fitLen >= text.length) return { head: text, tail: '' }
    const candidate = text.slice(0, fitLen)
    const lastNl = candidate.lastIndexOf('\n')
    const lastSpace = candidate.lastIndexOf(' ')
    const cut = Math.max(lastNl, lastSpace, 0)
    const safeCut = cut > 0 ? cut : Math.max(1, fitLen)
    return { head: text.slice(0, safeCut).replace(/\s+$/g, ''), tail: text.slice(safeCut).replace(/^\s+/g, '') }
  }

  const splitOversizedBrdBlock = (block: string, maxHeightPx: number) => {
    const lines = block.replace(/\r\n/g, '\n').split('\n').filter((line) => line.trim())
    const leadingHeadingLines = (() => {
      let count = 0
      for (const line of lines) {
        if (!isBrdSectionHeadingLine(line)) break
        count += 1
      }
      return count
    })()

    if (lines.length > 1) {
      let lo = Math.max(1, Math.min(lines.length, leadingHeadingLines > 0 ? leadingHeadingLines + 1 : 1))
      let hi = lines.length
      let best = lo

      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2)
        const candidate = lines.slice(0, mid).join('\n')
        if (measureBrdBodyHeight(candidate) <= maxHeightPx) {
          best = mid
          lo = mid + 1
        } else {
          hi = mid - 1
        }
      }

      if (best > 0 && best < lines.length) {
        return {
          head: lines.slice(0, best).join('\n').replace(/\s+$/g, ''),
          tail: lines.slice(best).join('\n').replace(/^\s+/g, ''),
        }
      }

      if (leadingHeadingLines > 0 && best <= leadingHeadingLines) {
        const minStickySplit = leadingHeadingLines + 1
        const stickyCandidate = lines.slice(0, minStickySplit).join('\n')
        if (minStickySplit < lines.length && measureBrdBodyHeight(stickyCandidate) <= maxHeightPx) {
          return {
            head: stickyCandidate.replace(/\s+$/g, ''),
            tail: lines.slice(minStickySplit).join('\n').replace(/^\s+/g, ''),
          }
        }
      }
    }

    return splitForPage(block, maxHeightPx)
  }

  const splitForPageParagraphAware = (text: string, maxHeightPx: number) => {
    const blocks = splitBrdTextIntoBlocks(text)
    if (blocks.length <= 1) return splitOversizedBrdBlock(text, maxHeightPx)

    const fittedBlocks: string[] = []

    for (let i = 0; i < blocks.length; i += 1) {
      const candidateBlocks = [...fittedBlocks, blocks[i]]
      if (measureBrdBodyHeight(joinBrdTextBlocks(candidateBlocks)) <= maxHeightPx) {
        fittedBlocks.push(blocks[i])
        continue
      }

      if (!fittedBlocks.length) {
        return splitOversizedBrdBlock(blocks[i], maxHeightPx)
      }

      return {
        head: joinBrdTextBlocks(fittedBlocks),
        tail: joinBrdTextBlocks(blocks.slice(i)),
      }
    }

    return { head: joinBrdTextBlocks(blocks), tail: '' }
  }

  const splitOversizedHtmlBlock = (blockHtml: string, maxHeightPx: number) => {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = blockHtml.trim()
    const table = wrapper.querySelector('table')
    if (!table) return { head: blockHtml, tail: '' }

    const tbody = table.querySelector('tbody')
    const thead = table.querySelector('thead')

    const decodeCarriedHeaderHtml = (raw: string | null) => {
      if (!raw) return null
      try {
        return decodeURIComponent(raw)
      } catch {
        return null
      }
    }

    const carriedHeaderHtml = decodeCarriedHeaderHtml(table.getAttribute('data-brd-header-html'))
    let headerRows: HTMLTableRowElement[] = thead
      ? Array.from(thead.querySelectorAll('tr')) as HTMLTableRowElement[]
      : []
    let dataRows: HTMLTableRowElement[] = tbody
      ? (Array.from(tbody.querySelectorAll('tr')) as HTMLTableRowElement[])
      : (Array.from(table.querySelectorAll(':scope > tr')) as HTMLTableRowElement[])

    if (!headerRows.length && carriedHeaderHtml) {
      const headContainer = document.createElement('thead')
      headContainer.innerHTML = carriedHeaderHtml
      const restoredHeaderRows = Array.from(headContainer.querySelectorAll('tr')) as HTMLTableRowElement[]
      if (restoredHeaderRows.length > 0) {
        headerRows.push(...restoredHeaderRows)
      }
    }

    if (!thead && dataRows.length > 1) {
      const firstRowCells = Array.from(dataRows[0].querySelectorAll('th, td'))
      const firstLooksHeader = firstRowCells.length > 0 && firstRowCells.every((cell) => cell.tagName.toLowerCase() === 'th')
      if (firstLooksHeader) {
        headerRows.push(dataRows[0])
        dataRows = dataRows.slice(1)
      }
    }

    if (!dataRows.length) return { head: blockHtml, tail: '' }

    const buildTableHtml = (rows: HTMLTableRowElement[]) => {
      const clonedTable = table.cloneNode(false) as HTMLTableElement

      Array.from(table.childNodes).forEach((child) => {
        const tag = child.nodeType === globalThis.Node.ELEMENT_NODE ? (child as HTMLElement).tagName.toLowerCase() : ''
        if (tag === 'caption' || tag === 'colgroup') {
          clonedTable.appendChild(child.cloneNode(true))
        }
      })

      if (headerRows.length > 0) {
        const clonedHead = document.createElement('thead')
        headerRows.forEach((row) => clonedHead.appendChild(row.cloneNode(true)))
        clonedTable.appendChild(clonedHead)
        const headerHtml = headerRows.map((row) => row.outerHTML).join('')
        clonedTable.setAttribute('data-brd-header-html', encodeURIComponent(headerHtml))
      }

      if (tbody || rows.length > 0) {
        const clonedBody = document.createElement('tbody')
        rows.forEach((row) => clonedBody.appendChild(row.cloneNode(true)))
        clonedTable.appendChild(clonedBody)
      }

      return clonedTable.outerHTML
    }

    let lo = 1
    let hi = dataRows.length
    let best = 1

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2)
      const candidate = buildTableHtml(dataRows.slice(0, mid))
      if (measureBrdBodyHeight(candidate) <= maxHeightPx) {
        best = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }

    const safeCount = Math.max(1, Math.min(best, dataRows.length))
    const headHtml = buildTableHtml(dataRows.slice(0, safeCount))
    const tailRows = dataRows.slice(safeCount)
    const tailHtml = tailRows.length > 0 ? buildTableHtml(tailRows) : ''

    return { head: headHtml, tail: tailHtml }
  }

  const splitForPageHtmlAware = (html: string, maxHeightPx: number) => {
    const blocks = splitBrdHtmlIntoBlocks(html)
    if (blocks.length <= 1) return splitOversizedHtmlBlock(html, maxHeightPx)

    const fittedBlocks: string[] = []

    for (let i = 0; i < blocks.length; i += 1) {
      const candidateBlocks = [...fittedBlocks, blocks[i]]
      if (measureBrdBodyHeight(joinBrdHtmlBlocks(candidateBlocks)) <= maxHeightPx) {
        fittedBlocks.push(blocks[i])
        continue
      }

      if (!fittedBlocks.length) {
        const splitOversized = splitOversizedHtmlBlock(blocks[i], maxHeightPx)
        if (!splitOversized.tail) {
          return {
            head: blocks[0],
            tail: joinBrdHtmlBlocks(blocks.slice(1)),
          }
        }
        return {
          head: splitOversized.head,
          tail: joinBrdHtmlBlocks([splitOversized.tail, ...blocks.slice(i + 1)]),
        }
      }

      // If the last fitted block is a heading, move it to the next page
      // so heading is never orphaned at the bottom of a page.
      const lastFitted = fittedBlocks[fittedBlocks.length - 1]
      const lastTag = /^<\s*([a-z0-9]+)/i.exec(lastFitted)?.[1]?.toLowerCase() ?? ''
      if (/^h[1-6]$/.test(lastTag)) {
        const orphanHeading = fittedBlocks.pop()!
        return {
          head: joinBrdHtmlBlocks(fittedBlocks),
          tail: joinBrdHtmlBlocks([orphanHeading, ...blocks.slice(i)]),
        }
      }

      return {
        head: joinBrdHtmlBlocks(fittedBlocks),
        tail: joinBrdHtmlBlocks(blocks.slice(i)),
      }
    }

    return { head: joinBrdHtmlBlocks(blocks), tail: '' }
  }

  const rebalancePagesFrom = (pages: string[], startIndex: number) => {
    const next = [...pages]

    // Push overflow forward, creating pages if needed.
    for (let i = startIndex; i < next.length; i += 1) {
      const current = next[i] ?? ''
      const maxHeight = getBodyMaxHeightPx(i)
      if (measureBrdBodyHeight(current) <= maxHeight) continue
      const { head, tail } = brdBodyHasHtmlMarkup(current)
        ? splitForPageHtmlAware(current, maxHeight)
        : splitForPageParagraphAware(current, maxHeight)
      next[i] = head
      if (!tail) continue
      if (i + 1 >= next.length) next.push(tail)
      else next[i + 1] = brdBodyHasHtmlMarkup(tail) || brdBodyHasHtmlMarkup(next[i + 1] ?? '') ? `${tail}${next[i + 1] ?? ''}` : tail + (next[i + 1] ? '\n' + next[i + 1] : '')
    }

    // Pull content back if there is room (for deletions).
    for (let i = Math.max(0, startIndex - 1); i < next.length - 1; i += 1) {
      const current = next[i] ?? ''
      const following = next[i + 1] ?? ''
      if (!following) continue
      const maxHeight = getBodyMaxHeightPx(i)
      if (measureBrdBodyHeight(current) >= maxHeight) continue

      if (brdBodyHasHtmlMarkup(current) || brdBodyHasHtmlMarkup(following)) {
        const currentBlocks = brdBodyHasHtmlMarkup(current) ? splitBrdHtmlIntoBlocks(current) : convertBrdTextBlocksToHtmlBlocks(current)
        const followingBlocks = brdBodyHasHtmlMarkup(following) ? splitBrdHtmlIntoBlocks(following) : convertBrdTextBlocksToHtmlBlocks(following)

        if (!followingBlocks.length) continue

        const mergedBlocks = [...currentBlocks]
        let movedCount = 0

        while (movedCount < followingBlocks.length) {
          const candidateBlocks = [...mergedBlocks, followingBlocks[movedCount]]
          if (measureBrdBodyHeight(joinBrdHtmlBlocks(candidateBlocks)) > maxHeight) break
          // Don't pull if it would leave a heading as the last block on this page
          const lastCandidateTag = /^<\s*([a-z0-9]+)/i.exec(followingBlocks[movedCount])?.[1]?.toLowerCase() ?? ''
          if (/^h[1-6]$/.test(lastCandidateTag) && movedCount + 1 < followingBlocks.length) {
            // Only allow pulling heading if its following block also fits
            const withFollowingContent = [...candidateBlocks, followingBlocks[movedCount + 1]]
            if (measureBrdBodyHeight(joinBrdHtmlBlocks(withFollowingContent)) > maxHeight) break
          }
          mergedBlocks.push(followingBlocks[movedCount])
          movedCount += 1
        }

        // Walk back if the last pulled block ended up being an orphaned heading
        while (mergedBlocks.length > currentBlocks.length) {
          const lastBlock = mergedBlocks[mergedBlocks.length - 1]
          const lastTag = /^<\s*([a-z0-9]+)/i.exec(lastBlock)?.[1]?.toLowerCase() ?? ''
          if (!/^h[1-6]$/.test(lastTag)) break
          mergedBlocks.pop()
          movedCount -= 1
        }

        if (movedCount > 0) {
          next[i] = joinBrdHtmlBlocks(mergedBlocks)
          next[i + 1] = joinBrdHtmlBlocks(followingBlocks.slice(movedCount))
        }

        continue
      }

      const separator = current ? '\n' : ''
      const maxPrefixLen = findLargestFittingPrefix(current + separator + following, maxHeight)
      const movable = maxPrefixLen - (current + separator).length
      if (movable <= 0) continue
      const movedText = following.slice(0, movable).replace(/\s+$/g, '')
      const remainText = following.slice(movable).replace(/^\s+/g, '')
      next[i] = (current + separator + movedText).replace(/\s+$/g, '')
      next[i + 1] = remainText
    }

    while (next.length > 1 && !next[next.length - 1].trim()) next.pop()
    return next
  }

  useEffect(() => {
    if (activePanel !== 'brd') return
    // Gate both by ref (immediate) and state (for safety)
    if (isBrdGenerating || isBrdRenderLockedRef.current) return

    const raf = window.requestAnimationFrame(() => {
      if (brdAutoPaginatingRef.current) return

      const currentPages = [...brdPagesRef.current]
      const rebalanced = rebalancePagesFrom(currentPages, 0)
      const unchanged =
        rebalanced.length === currentPages.length &&
        rebalanced.every((page, idx) => page === currentPages[idx])

      if (unchanged) return

      brdAutoPaginatingRef.current = true
      brdPagesRef.current = rebalanced
      setBrdPages(rebalanced)
      scheduleWordCountUpdate()
      window.requestAnimationFrame(() => {
        brdAutoPaginatingRef.current = false
      })
    })

    return () => window.cancelAnimationFrame(raf)
  }, [
    activePanel,
    brdFontFamily,
    brdFontSize,
    brdLineHeight,
    brdHeaderHeights,
    brdPages,
    isBrdGenerating,
    isBrdRenderLocked,
  ])

  const BrdPage = ({ index }: { index: number }) => {
    const ref = useRef<HTMLDivElement | null>(null)
    const headerRef = useRef<HTMLDivElement | null>(null)
    const value = brdPages[index] ?? ''
    const headerValue = brdHeaders[index] ?? ''
    const isEditingHeader = editingHeaderIndex === index

    useEffect(() => {
      if (!ref.current) return
      brdPageEditableRefs.current[index] = ref.current
      if (document.activeElement === ref.current) return
      const el = ref.current
      if (brdBodyHasHtmlMarkup(value)) {
        if (el.innerHTML !== value) el.innerHTML = value
      } else if (el.innerText !== value) {
        el.innerText = value
      }
    }, [value, index])

    useEffect(() => {
      if (!headerRef.current) return
      if (isEditingHeader && document.activeElement === headerRef.current) return
      if (headerRef.current.innerText !== headerValue) headerRef.current.innerText = headerValue
    }, [headerValue, isEditingHeader])

    useEffect(() => {
      const el = headerRef.current
      if (!el) return
      const update = () => {
        const h = Math.max(18, Math.min(120, el.scrollHeight))
        setBrdHeaderHeights((prev) => {
          if ((prev[index] ?? 18) === h) return prev
          const copy = [...prev]
          copy[index] = h
          brdHeaderHeightsRef.current = copy
          return copy
        })
      }

      update()
      if (!isEditingHeader) return
      const ro = new ResizeObserver(() => update())
      ro.observe(el)
      return () => ro.disconnect()
    }, [headerValue, index, isEditingHeader])

    return (
      <section
        ref={(node) => {
          brdPageSectionRefs.current[index] = node
        }}
        data-page-index={index}
        className="relative h-[1123px] w-[794px] border border-slate-300 bg-white px-16 py-14 shadow-[0_28px_58px_-38px_rgba(15,23,42,0.45)] overflow-hidden"
      >
        {/* Header (non-editable unless double-clicked) */}
        <div className="absolute left-16 right-16" style={{ top: BRD_HEADER_TOP_PX }}>
          {isEditingHeader && (
            <>
              <div
                className="pointer-events-none absolute -left-14 rounded-sm border border-slate-300 bg-slate-100 px-2 py-1 text-[12px] leading-4 text-slate-700 shadow-sm"
                style={{ top: (brdHeaderHeights[index] ?? 18) + 8 }}
              >
                Header
              </div>
              <div
                className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-slate-400"
                style={{ top: (brdHeaderHeights[index] ?? 18) + 10 }}
                aria-hidden="true"
              />
            </>
          )}
          <div
            ref={headerRef}
            contentEditable={!isBrdGenerating && isEditingHeader}
            suppressContentEditableWarning
            spellCheck={false}
            className={cn(
              "min-h-6 whitespace-pre-wrap font-['Aptos','Arial',sans-serif] text-[12px] leading-5 outline-none",
              isEditingHeader ? 'text-slate-700' : 'text-slate-400',
              !isEditingHeader && 'pointer-events-none select-none'
            )}
            onInput={(e) => {
              const nextHeader = e.currentTarget.innerText
              brdHeadersRef.current[index] = nextHeader
            }}
            onBlur={() => {
              // Avoid exiting edit mode on transient focus loss (e.g. reflow/resize observer updates).
              window.requestAnimationFrame(() => {
                if (editingHeaderIndex !== index) return
                const active = document.activeElement
                const bodyEl = brdPageEditableRefs.current[index]
                // Exit header edit only when focus clearly moved to the page body.
                if (bodyEl && active === bodyEl) {
                  commitHeaderToState(index)
                  setEditingHeaderIndex(null)
                }
              })
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                commitHeaderToState(index)
                setEditingHeaderIndex(null)
                // Return focus to body.
                window.requestAnimationFrame(() => {
                  brdPageEditableRefs.current[index]?.focus()
                })
              }
            }}
          />

          {!isEditingHeader && !isBrdGenerating && (
            <div
              className="absolute -inset-x-2 -inset-y-2 cursor-text"
              onDoubleClick={() => {
                setEditingHeaderIndex(index)
                window.requestAnimationFrame(() => {
                  headerRef.current?.focus()
                })
              }}
              title="Double-click to edit header"
              aria-label="Double-click to edit header"
            />
          )}
        </div>

        <div
          ref={ref}
          contentEditable={!isBrdGenerating && !isEditingHeader}
          suppressContentEditableWarning
          spellCheck={false}
          className={cn(
            "min-h-[995px] whitespace-pre-wrap text-slate-900 outline-none [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline",
            '[&_h2]:mb-4 [&_h2]:mt-7 [&_h2]:border-b [&_h2]:border-slate-300 [&_h2]:pb-2 [&_h2]:text-[19px] [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-[0.08em] [&_h2]:text-slate-800 [&_h2:first-child]:mt-0',
            '[&_h3]:mb-3 [&_h3]:mt-5 [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:text-sky-900 [&_h3:first-child]:mt-0',
            '[&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:text-[14px] [&_h4]:font-semibold [&_h4]:text-slate-800 [&_h4:first-child]:mt-0',
            '[&_p]:mb-3 [&_p]:mt-0 [&_p]:text-justify',
            '[&_ul]:mb-4 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-8',
            '[&_ol]:mb-4 [&_ol]:mt-2 [&_ol]:pl-8',
            '[&_li]:mb-1.5 [&_li]:pl-1',
            '[&_ul>li::marker]:text-sky-700 [&_ol>li::marker]:font-semibold [&_ol>li::marker]:text-slate-700',
            isEditingHeader && 'select-none text-slate-400'
          )}
          style={{
            fontFamily: brdFontFamily === 'Aptos' ? "Aptos, Arial, sans-serif" : `${brdFontFamily}, Arial, sans-serif`,
            fontSize: `${brdFontSize}px`,
            lineHeight: String(brdLineHeight),
            // Keep header layout unchanged; only control the body gap here.
            paddingTop: (brdHeaderHeights[index] ?? 18) + BRD_HEADER_BODY_GAP_PX,
            minHeight: getBodyMaxHeightPx(index),
            maxHeight: getBodyMaxHeightPx(index),
            overflow: 'hidden',
          }}
          onDoubleClick={() => {
            if (!isEditingHeader) return
            commitHeaderToState(index)
            setEditingHeaderIndex(null)
            window.requestAnimationFrame(() => {
              brdPageEditableRefs.current[index]?.focus()
            })
          }}
          onFocus={() => {
            brdLastFocusedPage.current = index
          }}
          onKeyDown={(e) => {
            const isSelectAll =
              (e.ctrlKey || e.metaKey) &&
              (e.key === 'a' || e.key === 'A') &&
              !e.shiftKey &&
              !e.altKey
            if (!isSelectAll) return
            e.preventDefault()

            const first = brdPageEditableRefs.current.find((node) => node != null) ?? null
            const last = [...brdPageEditableRefs.current].reverse().find((node) => node != null) ?? null
            if (!first || !last) return

            const selection = window.getSelection()
            if (!selection) return
            selection.removeAllRanges()

            const range = document.createRange()
            range.setStart(first, 0)
            range.setEnd(last, last.childNodes.length)
            selection.addRange(range)
          }}
          onInput={(e) => {
            const host = e.currentTarget
            const next = host.innerHTML
            brdPagesRef.current[index] = next
            scheduleWordCountUpdate()

            // Paginate if content exceeds max height (with safety margin)
            const maxHeight = getBodyMaxHeightPx(index)
            const contentHeight = measureBrdBodyHeight(next)
            
            // Use slightly stricter threshold (95%) to catch overflow early
            if (contentHeight <= maxHeight * 0.95) {
              // Always persist typing to state so re-renders don't reset the DOM
              setBrdPages((prev) => {
                if (prev[index] === next) return prev
                const copy = [...prev]
                copy[index] = next
                return copy
              })
              return
            }

            const rebalanced = rebalancePagesFrom(brdPagesRef.current, index)
            brdPagesRef.current = rebalanced
            setBrdPages(rebalanced)
          }}
          onKeyDownCapture={(e) => {
            if (e.key !== 'Backspace' && e.key !== 'Delete') return
            const selection = window.getSelection()
            if (!selection || selection.isCollapsed) return

            const findPageIndexForNode = (node: globalThis.Node | null) => {
              if (!node) return -1
              const anyNode = node as unknown as { nodeType?: number; parentElement?: HTMLElement | null }
              const element =
                anyNode.nodeType === globalThis.Node.ELEMENT_NODE
                  ? (node as unknown as HTMLElement)
                  : (anyNode.parentElement ?? null)
              if (!element) return -1
              for (let i = 0; i < brdPageEditableRefs.current.length; i += 1) {
                const pageEl = brdPageEditableRefs.current[i]
                if (pageEl && pageEl.contains(element)) return i
              }
              return -1
            }

            const startIdx = findPageIndexForNode(selection.anchorNode as unknown as globalThis.Node | null)
            const endIdx = findPageIndexForNode(selection.focusNode as unknown as globalThis.Node | null)

            // If selection spans multiple pages, delete everything.
            if (startIdx !== -1 && endIdx !== -1 && startIdx !== endIdx) {
              e.preventDefault()
              brdPagesRef.current = ['']
              setBrdPages([''])

              window.requestAnimationFrame(() => {
                const first = brdPageEditableRefs.current[0]
                if (!first) return
                first.focus()
                const sel = window.getSelection()
                if (!sel) return
                sel.removeAllRanges()
                const range = document.createRange()
                range.setStart(first, 0)
                range.collapse(true)
                sel.addRange(range)
              })
            }
          }}
          onKeyUp={(e) => {
            if (e.key !== 'Backspace' && e.key !== 'Delete') return
            const current = brdPagesRef.current[index] ?? ''
            const following = brdPagesRef.current[index + 1] ?? ''
            if (!following) return
            if (brdBodyHasTableMarkup(current) || brdBodyHasTableMarkup(following)) return
            if (measureBrdBodyHeight(current) >= getBodyMaxHeightPx(index)) return
            const rebalanced = rebalancePagesFrom(brdPagesRef.current, index)
            if (rebalanced.length !== brdPagesRef.current.length || rebalanced[index + 1] !== brdPagesRef.current[index + 1]) {
              brdPagesRef.current = rebalanced
              setBrdPages(rebalanced)
            }
          }}
        />
      </section>
    )
  }

  const hasBrdBodyContent = brdPages.some((page) => page.trim())
  const showBrdCoverPage = !isBrdGenerating && !isBrdRenderLocked && hasBrdBodyContent
  const showBrdTocPage = !isBrdGenerating && !isBrdRenderLocked && hasBrdBodyContent
  const brdVisiblePageCount = brdPages.length + (showBrdCoverPage ? 1 : 0) + (showBrdTocPage ? 1 : 0)
  const brdCanvasHeightPx =
    Math.max(1, brdVisiblePageCount) * BRD_PAGE_HEIGHT_PX +
    Math.max(0, brdVisiblePageCount - 1) * BRD_PAGE_GAP_PX

  return (
    <>
      {brdBulletMenu}
      {brdNumberMenu}
      {brdMultilevelMenu}
      {brdSpacingMenu}
      {brdStylesMenu}
      {brdTableMenu}
      {brdCaseMenu}
      {brdShadingMenu}
      {brdHighlightMenu}
      {brdTextColorMenu}
      <IdeaDetailSidebar
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        activePanel={activePanel}
        onNavigatePanel={navigateToPanel}
        status={idea.status}
        reviewer={idea.reviewer}
        isMetaSaving={isMetaPatchSaving}
        metaSaveError={metaPatchInlineError}
        metaSavedAtLabel={metaSavedAtLabel}
        reviewerOptions={reviewerOptions}
        isReviewerOptionsLoading={isReviewerOptionsLoading}
        reviewerOptionsError={reviewerOptionsError}
        onStatusChange={quickUpdateStatus}
        onReviewerChange={quickUpdateReviewer}
        activeConfidence={confidence[activePanel]}
        isRegenerating={regenerating[activePanel]}
        onRegenerate={regeneratePanel}
        brdTemplates={brdTemplates}
        brdSelectedTemplateId={brdSelectedTemplateId}
        onSelectBrdTemplate={(id) => applyBrdTemplateById(id)}
        brdLayoutPolishMode={brdLayoutPolishMode}
        onBrdLayoutPolishModeChange={setBrdLayoutPolishMode}
        onManageBrdTemplates={() => {
          setManageBrdTemplatesOpen(true)
          setEditingTemplate(null)
        }}
      />

      <div
        className={cn(
          'space-y-5 pb-8 transition-all duration-300',
          'mr-0 md:mr-12',
          sidebarCollapsed ? 'lg:mr-12' : 'lg:mr-72'
        )}
      >
        <Breadcrumb
        items={[
          { label: 'Workspace', href: '/' },
          { label: 'Idea & Backlog', href: '/idea-backlog' },
          { label: idea.id },
        ]}
        />

      <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/idea-backlog')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div
                className="self-stretch w-[10px]"
                style={{ backgroundColor: typeAccent[idea.type] }}
                aria-hidden="true"
              />
              <div className="space-y-2 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] font-semibold bg-white/90">
                  {idea.id}
                </Badge>
                <Badge variant="outline" className={cn('text-[10px] font-semibold', statusClass[idea.status])}>
                  {idea.status}
                </Badge>
                <Badge variant="outline" className={cn('text-[10px] font-semibold', typeClass[idea.type])}>
                  {idea.type}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-semibold border-blue-200 bg-blue-50 text-blue-700">
                  AI Transformation Engine
                </Badge>
              </div>
              <h1 className="text-2xl font-semibold text-slate-900 leading-tight">{idea.title}</h1>
              <p className="text-sm text-muted-foreground">
                Workspace: <span className="font-medium text-slate-700">{idea.workspace ?? 'General'}</span>
                <span className="mx-2 text-slate-400" aria-hidden="true">{String.fromCharCode(0xb7)}</span>
                Submitted by <span className="font-medium text-slate-700">{submittedByDisplayName}</span>
                <span className="mx-2 text-slate-400" aria-hidden="true">{String.fromCharCode(0xb7)}</span>
                Reviewer <span className="font-medium text-slate-700">{reviewerDisplayName}</span>
                <span className="mx-2 text-slate-400" aria-hidden="true">{String.fromCharCode(0xb7)}</span>
                {idea.createdAt}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {idea.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-border/50 px-2 py-0.5 text-[11px] text-slate-600 bg-white/80">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-1.5 shadow-sm flex-nowrap">
                <button
                  type="button"
                  onClick={() => quickUpdateStatus('Approved')}
                  disabled={isMetaPatchSaving}
                  className={cn(
                    'flex items-center justify-center rounded-lg p-2.5 text-emerald-600 transition-all duration-200 hover:bg-background hover:shadow-sm',
                    isMetaPatchSaving && 'cursor-not-allowed opacity-55 hover:bg-transparent hover:shadow-none'
                  )}
                  aria-label="Approve idea"
                  title="Approve idea"
                >
                  <Check className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => quickUpdateStatus('Rejected')}
                  disabled={isMetaPatchSaving}
                  className={cn(
                    'flex items-center justify-center rounded-lg p-2.5 text-rose-600 transition-all duration-200 hover:bg-background hover:shadow-sm',
                    isMetaPatchSaving && 'cursor-not-allowed opacity-55 hover:bg-transparent hover:shadow-none'
                  )}
                  aria-label="Reject idea"
                  title="Reject idea"
                >
                  <X className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => quickUpdateStatus('Under Review')}
                  disabled={isMetaPatchSaving}
                  className={cn(
                    'flex items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-all duration-200 hover:bg-background hover:text-foreground hover:shadow-sm',
                    isMetaPatchSaving && 'cursor-not-allowed opacity-55 hover:bg-transparent hover:text-muted-foreground hover:shadow-none'
                  )}
                  aria-label="Move to backlog"
                  title="Move to backlog"
                >
                  <ClipboardList className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => setDevelopModalOpen(true)}
                  className="flex items-center justify-center rounded-lg p-2.5 text-[#5f7de0] transition-all duration-200 hover:bg-background hover:shadow-sm"
                  aria-label="Develop"
                  title="Develop"
                >
                  <Wand2 className="w-5 h-5" />
                </button>

                <div ref={brdExportMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setBrdExportOpen((v) => !v)}
                    ref={brdExportButtonRef}
                    className="flex items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-all duration-200 hover:bg-background hover:text-foreground hover:shadow-sm"
                    aria-label="Export BRD"
                    title="Export"
                  >
                    <Download className="w-5 h-5" />
                  </button>

                  {brdExportOpen && (
                    <div
                      className="fixed z-[100] w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                      style={
                        brdExportMenuPos
                          ? { top: brdExportMenuPos.top, right: brdExportMenuPos.right }
                          : { top: 0, right: 0, visibility: 'hidden' }
                      }
                    >
                      <button
                        type="button"
                        onClick={async () => {
                          setBrdExportOpen(false)
                          await exportBrdPdf()
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                      >
                        <FileText className="h-4 w-4 text-slate-500" />
                        Export PDF
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setBrdExportOpen(false)
                          await exportBrdWord()
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                      >
                        <FileText className="h-4 w-4 text-slate-500" />
                        Export Word
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBrdExportOpen(false)
                          exportBrdMarkdown()
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                      >
                        <FileText className="h-4 w-4 text-slate-500" />
                        Export Markdown
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {activePanel === 'summary' && (
                <div className="self-end text-[11px] text-slate-600">
                  <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-right">
                    <p>Latest AI Strategic Insight: {summaryRefreshLabel ?? '-'}</p>
                  </div>
                  {summaryWarningItems.length > 0 && (
                    <div className="mt-1 flex items-center justify-end gap-2 overflow-x-auto">
                      <div className="flex shrink-0 gap-2">
                        {summaryWarningItems.map((warning) => (
                          <Badge
                            key={warning.code}
                            variant="outline"
                            className={cn('whitespace-nowrap text-[10px] font-semibold', SUMMARY_WARNING_BADGE_CLASS[warning.tone])}
                          >
                            {warning.label}
                          </Badge>
                        ))}
                      </div>
                      <p className="truncate text-right text-[11px] text-slate-600">{summaryWarningItems[0]?.detail}</p>
                    </div>
                  )}
                </div>
              )}

              {activePanel === 'scoring' && (
                <div className="self-end text-[11px] text-slate-600">
                  <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-right">
                    <p>Latest AI Scoring Analysis: {scoringRefreshLabel ?? '-'}</p>
                  </div>
                  {scoringWarningItems.length > 0 && (
                    <div className="mt-1 flex items-center justify-end gap-2 overflow-x-auto">
                      <div className="flex shrink-0 gap-2">
                        {scoringWarningItems.map((warning) => (
                          <Badge
                            key={warning.code}
                            variant="outline"
                            className={cn('whitespace-nowrap text-[10px] font-semibold', SUMMARY_WARNING_BADGE_CLASS[warning.tone])}
                          >
                            {warning.label}
                          </Badge>
                        ))}
                      </div>
                      <p className="truncate text-right text-[11px] text-slate-600">{scoringWarningItems[0]?.detail}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

      </div>

      <div className="space-y-4">
        {activePanel === 'summary' && (
        <div id="panel-summary" className="scroll-mt-24">
          <CollapsiblePanel
            panelKey="summary"
            title="AI-Powered Idea Summary"
            description="AI insights that transform raw ideas into decision-ready context."
            isOpen
            onToggle={togglePanel}
            showToggle={false}
            confidence={confidence.summary}
          >
            <div className="space-y-4">
              {isSummaryRefreshing && (
                <div className="flex items-center gap-3 rounded-2xl border border-sky-200/80 bg-gradient-to-r from-sky-50 via-white to-indigo-50 px-4 py-2.5 text-sm text-sky-900 shadow-[0_8px_24px_-18px_rgba(14,165,233,0.45)]">
                  <RefreshCcw className="h-4 w-4 animate-spin text-sky-600" />
                  <span className="flex flex-col leading-tight">
                    <span className="text-[13px] font-semibold tracking-tight text-slate-900">
                      {usesMultiRoleAgents || isSummaryRefreshing
                        ? 'Tectona Assistant is orchestrating specialist agents'
                        : 'Tectona Assistant is composing your executive narrative'}
                    </span>
                    <span className="text-[12px] text-slate-600">
                      {usesMultiRoleAgents || isSummaryRefreshing
                        ? 'Business Analyst, Project Manager, and Scrum Master are analyzing evidence in parallel \u2014 this may take several minutes.'
                        : 'Synthesizing evidence, calibrating KPIs, and shaping decision-ready insights \u2014 this takes a brief moment.'}
                    </span>
                  </span>
                </div>
              )}

              {summaryGenerationError && !isSummaryRefreshing && (
                <div
                  role="alert"
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-900"
                >
                  <p className="font-semibold text-rose-800">AI summary could not be generated</p>
                  <p className="mt-1.5 leading-6 text-rose-700">{summaryGenerationError}</p>
                </div>
              )}

              {summaryMissing && !summaryGenerationError && !isSummaryRefreshing && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">No AI summary saved yet</p>
                  <p className="mt-1.5 leading-6">
                    Open this page again after generation, or click <strong>Regenerate Summary</strong> to create and
                    store the analysis in the database.
                  </p>
                </div>
              )}

              {!summaryGenerationError && !summaryMissing && summaryLoaded && !isSummaryRefreshing && summaryRoleModels.length > 0 && (
                <div className="rounded-2xl border border-indigo-200/70 bg-indigo-50/40 px-4 py-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-800">
                    AI agents &amp; models
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {summaryRoleModels.map((entry) => (
                      <Badge
                        key={entry.roleId}
                        variant="outline"
                        title={entry.modelId}
                        className="border-indigo-200 bg-white/90 text-[11px] font-medium text-slate-800"
                      >
                        <span className="font-semibold text-indigo-900">{entry.roleLabel}</span>
                        {/* fromCharCode keeps ASCII-only source/bundle — avoids Â· mojibake if JS is mis-decoded */}
                        <span className="mx-1 text-slate-400" aria-hidden>
                          {String.fromCharCode(0xb7)}
                        </span>
                        <span className="text-slate-600">{entry.modelShort}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {!summaryGenerationError && summaryLoaded && (
              <>
              <div className="grid grid-cols-1 xl:grid-cols-[1.55fr_0.85fr] gap-4">
                <Card className="overflow-hidden border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,246,255,0.92)_45%,rgba(248,250,252,0.98))] shadow-[0_22px_60px_-34px_rgba(15,23,42,0.35)]">
                  <CardContent className="p-0">
                    <div className="border-b border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.15),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0.72))] px-6 py-5">
                      <div className="min-w-0 space-y-3">
                          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                            <Bot className="h-3.5 w-3.5" />
                            Executive AI Brief
                          </div>
                          {isSummaryRefreshing ? (
                            <div className="space-y-2 animate-pulse">
                              <div className="h-8 w-4/5 rounded-md bg-slate-200" />
                              <div className="h-4 w-full rounded-md bg-slate-200" />
                              <div className="h-4 w-11/12 rounded-md bg-slate-200" />
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <h3 className="text-[22px] font-semibold leading-tight text-slate-950" dangerouslySetInnerHTML={{ __html: convertInlineMarkdown(runtimeSummary.summary_title ?? '') }} />
                              <p className="w-full text-sm leading-7 text-slate-700" dangerouslySetInnerHTML={{ __html: convertInlineMarkdown(runtimeSummary.executive_brief ?? '') }} />
                            </div>
                          )}
                        </div>

                      </div>

                    <div className="grid grid-cols-1 gap-3 px-6 py-5 md:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          <TriangleAlert className="h-3.5 w-3.5 text-amber-600" />
                          Core Pressure
                        </div>
                        {isSummaryRefreshing ? (
                          <div className="space-y-2 animate-pulse">
                            <div className="h-4 w-full rounded-md bg-slate-200" />
                            <div className="h-4 w-10/12 rounded-md bg-slate-200" />
                          </div>
                        ) : (
                          <p className="text-sm leading-6 text-slate-700" dangerouslySetInnerHTML={{ __html: convertInlineMarkdown(runtimeSummary.core_pressure ?? '') }} />
                        )}
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          <Target className="h-3.5 w-3.5 text-sky-700" />
                          Strategic Response
                        </div>
                        {isSummaryRefreshing ? (
                          <div className="space-y-2 animate-pulse">
                            <div className="h-4 w-full rounded-md bg-slate-200" />
                            <div className="h-4 w-9/12 rounded-md bg-slate-200" />
                          </div>
                        ) : (
                          <p className="text-sm leading-6 text-slate-700" dangerouslySetInnerHTML={{ __html: convertInlineMarkdown(runtimeSummary.strategic_response ?? '') }} />
                        )}
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          <Briefcase className="h-3.5 w-3.5 text-emerald-700" />
                          Value Thesis
                        </div>
                        {isSummaryRefreshing ? (
                          <div className="space-y-2 animate-pulse">
                            <div className="h-4 w-full rounded-md bg-slate-200" />
                            <div className="h-4 w-8/12 rounded-md bg-slate-200" />
                          </div>
                        ) : (
                          <p className="text-sm leading-6 text-slate-700" dangerouslySetInnerHTML={{ __html: convertInlineMarkdown(runtimeSummary.value_thesis ?? '') }} />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 border-t border-slate-200/80 bg-white/55 px-6 py-5 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
                      {summaryKpiCards.slice(0, 4).map((card, index) => (
                        <div key={`${card.label}-${index}`} className="rounded-2xl border border-slate-200/80 bg-white/90 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{card.label}</p>
                          {isSummaryRefreshing ? (
                            <div className="mt-2 space-y-2 animate-pulse">
                              <div className="h-7 w-2/3 rounded-md bg-slate-200" />
                              <div className="h-3.5 w-full rounded-md bg-slate-200" />
                            </div>
                          ) : (
                            <>
                              <p className="mt-2 text-2xl font-semibold text-slate-950">{card.value}</p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">{card.detail}</p>
                              {card.reason && (
                                <p className="mt-2 border-t border-slate-200/70 pt-2 text-[11px] leading-4 text-slate-400 italic">{card.reason}</p>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {summaryDecisionSignal && (
                  <Card className="border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.98))] shadow-[0_20px_50px_-36px_rgba(15,23,42,0.4)]">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Decision Signal</p>
                          <h3 className="mt-1 text-base font-semibold text-slate-950">Enterprise Readiness</h3>
                        </div>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-right">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Priority</p>
                          {isSummaryRefreshing ? (
                            <div className="mt-1 h-4 w-20 rounded-md bg-emerald-100 animate-pulse" />
                          ) : (
                            <p className="text-sm font-semibold text-emerald-800">{summaryDecisionSignal.priority}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Overall Score</p>
                          {isSummaryRefreshing ? (
                            <div className="mt-2 space-y-2 animate-pulse">
                              <div className="h-8 w-16 rounded-md bg-slate-200" />
                              <div className="h-3 w-full rounded-md bg-slate-200" />
                              <div className="h-3 w-10/12 rounded-md bg-slate-200" />
                            </div>
                          ) : (
                            <>
                              <p className="mt-2 text-3xl font-semibold leading-none text-slate-950">{summaryDecisionSignal.overall_score}</p>
                              <p className="mt-2 text-xs text-slate-500">Composite signal from value, ROI, effort, and execution risk.</p>
                            </>
                          )}
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Decision Bias</p>
                          {isSummaryRefreshing ? (
                            <div className="mt-2 space-y-2 animate-pulse">
                              <div className="h-5 w-28 rounded-md bg-slate-200" />
                              <div className="h-3 w-full rounded-md bg-slate-200" />
                              <div className="h-3 w-9/12 rounded-md bg-slate-200" />
                            </div>
                          ) : (
                            <>
                              <p className="mt-2 text-lg font-semibold text-slate-950">{summaryDecisionSignal.decision_bias}</p>
                              <p className="mt-2 text-xs text-slate-500">{summaryDecisionSignal.decision_bias_detail}</p>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-4 text-slate-50 shadow-inner">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200/80">Board Note</p>
                        {isSummaryRefreshing ? (
                          <div className="mt-2 space-y-2 animate-pulse">
                            <div className="h-3 w-full rounded-md bg-slate-700/60" />
                            <div className="h-3 w-11/12 rounded-md bg-slate-700/60" />
                            <div className="h-3 w-9/12 rounded-md bg-slate-700/60" />
                          </div>
                        ) : (
                          <p className="mt-2 text-sm leading-6 text-slate-200" dangerouslySetInnerHTML={{ __html: convertInlineMarkdown(runtimeSummary.board_note ?? '') }} />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <Card className="border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_20px_50px_-38px_rgba(15,23,42,0.3)]">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Strategic Framing</p>
                        <h3 className="mt-1 text-base font-semibold text-slate-950">Where enterprise value is expected</h3>
                      </div>
                      <Badge variant="outline" className="border-slate-200 bg-white text-[10px] font-semibold text-slate-600">
                        Executive Lens
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {summaryStrategicFraming.slice(0, 3).map((item, index) => {
                        const icon =
                          index === 0 ? (
                            <TrendingUp className="h-4 w-4 text-sky-700" />
                          ) : index === 1 ? (
                            <DollarSign className="h-4 w-4 text-emerald-700" />
                          ) : (
                            <Cpu className="h-4 w-4 text-violet-700" />
                          )

                        return (
                          <div key={`${item.title}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                              {icon}
                              {isSummaryRefreshing ? (
                                <div className="h-4 w-28 rounded-md bg-slate-200 animate-pulse" />
                              ) : (
                                item.title
                              )}
                            </div>
                            {isSummaryRefreshing ? (
                              <div className="space-y-2 animate-pulse">
                                <div className="h-3.5 w-full rounded-md bg-slate-200" />
                                <div className="h-3.5 w-5/6 rounded-md bg-slate-200" />
                                <div className="h-3.5 w-4/6 rounded-md bg-slate-200" />
                              </div>
                            ) : (
                              <p
                                className="text-sm leading-6 text-slate-700 line-clamp-[8] overflow-hidden"
                                title={item.detail}
                              >
                                {item.detail}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_20px_50px_-38px_rgba(15,23,42,0.3)]">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Governance Readiness</p>
                        {isSummaryRefreshing ? (
                          <div className="mt-1 h-5 w-52 rounded-md bg-slate-200 animate-pulse" />
                        ) : (
                          <h3 className="mt-1 text-base font-semibold text-slate-950">{summaryGovernanceReadiness.title}</h3>
                        )}
                      </div>
                      {isSummaryRefreshing ? (
                        <div className="h-6 w-20 rounded-full bg-slate-200 animate-pulse" />
                      ) : (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-700">
                          {summaryGovernanceReadiness.badge}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-3">
                      {summaryReadinessSignals.slice(0, 3).map((signal, index) => {
                        const tone = signal.tone.toLowerCase()
                        const iconWrapClass =
                          tone === 'positive'
                            ? 'bg-emerald-50 text-emerald-700'
                            : tone === 'warning' || tone === 'watch'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-sky-50 text-sky-700'

                        return (
                          <div key={`${signal.title}-${index}`} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3.5">
                            <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', iconWrapClass)}>
                              {tone === 'positive' ? (
                                <Check className="h-4 w-4" />
                              ) : tone === 'warning' || tone === 'watch' ? (
                                <TriangleAlert className="h-4 w-4" />
                              ) : (
                                <UserRound className="h-4 w-4" />
                              )}
                            </div>
                            <div>
                              {isSummaryRefreshing ? (
                                <div className="space-y-2 animate-pulse">
                                  <div className="h-4 w-44 rounded-md bg-slate-200" />
                                  <div className="h-4 w-64 rounded-md bg-slate-200" />
                                </div>
                              ) : (
                                <>
                                  <p className="text-sm font-semibold text-slate-900">{signal.title}</p>
                                  <p className="mt-1 text-sm leading-6 text-slate-600">{signal.detail}</p>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
              </>
              )}
            </div>
          </CollapsiblePanel>
        </div>
        )}

        {activePanel === 'brd' && (
        <div id="panel-brd" className="scroll-mt-24">
          <CollapsiblePanel
            panelKey="brd"
            title="AI-Generated BRD"
            description="Structured BRD generated from idea context with controlled edit mode."
            isOpen={collapsed.brd}
            onToggle={togglePanel}
            confidence={confidence.brd}
          >
            <div className="flex flex-col items-center">
              <div className="w-full max-w-[980px]">
                <div
                  className={cn(
                    'rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-sm',
                    isBrdGenerating && 'pointer-events-none opacity-70'
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => setBrdStylesMenuOpen((v) => !v)}
                        aria-label="Styles"
                        title="Styles"
                        ref={brdStylesButtonRef}
                      >
                        <Type className="h-4 w-4 mr-1.5" />
                        <span className="text-sm">Styles</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setBrdTableMenuOpen((v) => !v)}
                        aria-label="Insert table"
                        title="Insert table"
                        ref={brdTableButtonRef}
                      >
                        <Table className="h-4 w-4" />
                      </Button>
                      <select
                        value={brdFontFamily}
                        onChange={(e) => setBrdFontFamily(e.target.value as any)}
                        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm"
                        aria-label="Font family"
                      >
                        <option value="Aptos">Aptos (Body)</option>
                        <option value="Calibri">Calibri</option>
                        <option value="Arial">Arial</option>
                        <option value="Times New Roman">Times New Roman</option>
                      </select>

                      <select
                        value={brdFontSize}
                        onChange={(e) => setBrdFontSize(Number(e.target.value) as any)}
                        className="h-8 w-20 rounded-md border border-slate-200 bg-white px-2 text-sm"
                        aria-label="Font size"
                      >
                        {[11, 12, 14, 15, 16, 18].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>

                      <select
                        value={brdLineHeight}
                        onChange={(e) => setBrdLineHeight(Number(e.target.value) as any)}
                        className="h-8 w-20 rounded-md border border-slate-200 bg-white px-2 text-sm"
                        aria-label="Line height"
                      >
                        <option value={1.5}>1.5</option>
                        <option value={1.7}>1.7</option>
                        <option value={2}>2.0</option>
                      </select>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setBrdSpacingMenuOpen((v) => !v)}
                        aria-label="Line and paragraph spacing"
                        title="Line and paragraph spacing"
                        ref={brdSpacingButtonRef}
                      >
                        <ListChevronsUpDown className="h-4 w-4" />
                      </Button>
                    </div>

                    <span className="mx-1 h-6 w-px bg-slate-200" />

                    <div className="flex items-center gap-1">
                      <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => execBrdCommand('bold')}>
                        <span className="font-bold">B</span>
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => execBrdCommand('italic')}>
                        <span className="italic">I</span>
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => execBrdCommand('underline')}>
                        <span className="underline">U</span>
                      </Button>
                      <div className="relative">
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
                          aria-label="Text color"
                          title="Text color"
                          onClick={() => {
                            setBrdTextColorMenuOpen((v) => !v)
                          }}
                          ref={brdTextColorButtonRef}
                        >
                          <span className="text-[12px] font-semibold text-slate-800">A</span>
                          <span
                            className="absolute bottom-1 left-2 right-2 h-[3px] rounded-full"
                            style={{ backgroundColor: brdTextColor }}
                          />
                        </button>
                      </div>

                      <div className="relative">
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
                          aria-label="Highlight"
                          title="Highlight"
                          onClick={() => setBrdHighlightMenuOpen((v) => !v)}
                          ref={brdHighlightButtonRef}
                        >
                          <span className="text-[11px] font-semibold text-slate-800">HL</span>
                          <span
                            className="absolute bottom-1 left-2 right-2 h-[3px] rounded-full"
                            style={{ backgroundColor: brdHighlightColor }}
                          />
                        </button>
                      </div>
                      <div className="relative">
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
                          aria-label="Shading"
                          title="Shading"
                          onClick={() => setBrdShadingMenuOpen((v) => !v)}
                          ref={brdShadingButtonRef}
                        >
                          <PaintBucket className="h-4 w-4" />
                          <span
                            className="absolute bottom-1 left-2 right-2 h-[3px] rounded-full"
                            style={{ backgroundColor: brdShadingColor }}
                          />
                        </button>
                      </div>
                      <div className="relative">
                        <button
                          type="button"
                          className="flex h-8 items-center justify-center rounded-md px-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
                          aria-label="Change case"
                          title="Change case"
                          onClick={() => setBrdCaseMenuOpen((v) => !v)}
                          ref={brdCaseButtonRef}
                        >
                          Aa
                        </button>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => execBrdCommand('strikeThrough')}
                        aria-label="Strikethrough"
                        title="Strikethrough"
                      >
                        <Strikethrough className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => execBrdCommand('subscript')}
                        aria-label="Subscript"
                        title="Subscript"
                      >
                        <Subscript className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => execBrdCommand('superscript')}
                        aria-label="Superscript"
                        title="Superscript"
                      >
                        <Superscript className="h-4 w-4" />
                      </Button>
                    </div>

                    <span className="mx-1 h-6 w-px bg-slate-200" />

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => execBrdCommand('justifyLeft')}
                        aria-label="Align left"
                        title="Align left"
                      >
                        <AlignLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => execBrdCommand('justifyCenter')}
                        aria-label="Align center"
                        title="Align center"
                      >
                        <AlignCenter className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => execBrdCommand('justifyRight')}
                        aria-label="Align right"
                        title="Align right"
                      >
                        <AlignRight className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => execBrdCommand('outdent')}
                        aria-label="Decrease indent"
                        title="Decrease indent"
                      >
                        <IndentDecrease className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => execBrdCommand('indent')}
                        aria-label="Increase indent"
                        title="Increase indent"
                      >
                        <IndentIncrease className="h-4 w-4" />
                      </Button>
                    </div>

                    <span className="mx-1 h-6 w-px bg-slate-200" />

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={clearBrdFormatting}
                        aria-label="Clear formatting"
                        title="Clear formatting"
                      >
                        <Eraser className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setBrdMultilevelMenuOpen((v) => !v)}
                        aria-label="Multilevel list options"
                        title="Multilevel list"
                        ref={brdMultilevelButtonRef}
                      >
                        <ListTree className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setBrdBulletMenuOpen((v) => !v)}
                        aria-label="Bulleted list options"
                        title="Bulleted list"
                        ref={brdBulletButtonRef}
                      >
                        <List className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setBrdNumberMenuOpen((v) => !v)}
                        aria-label="Numbered list options"
                        title="Numbered list"
                        ref={brdNumberButtonRef}
                      >
                        <ListOrdered className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

              {/* Keep the native color picker anchored away from the toolbar to avoid overlap */}
              <input
                ref={brdTextColorInputRef}
                type="color"
                value={brdTextColor}
                onChange={(e) => {
                  const next = e.target.value
                  setBrdTextColor(next)
                  execBrdCommand('foreColor', next)
                }}
                className="fixed left-[-9999px] top-[-9999px] h-0 w-0 opacity-0"
                aria-hidden="true"
                tabIndex={-1}
              />
                </div>
              </div>

              <style>{`
                ol.brd-editor-ol-decimal { list-style-type: decimal; }
                ol.brd-editor-ol-upper-alpha { list-style-type: upper-alpha; }
                ol.brd-editor-ol-lower-alpha { list-style-type: lower-alpha; }
                ol.brd-editor-ol-lower-roman { list-style-type: lower-roman; }
                ul.brd-editor-ul,
                ol.brd-editor-ol-decimal,
                ol.brd-editor-ol-upper-alpha,
                ol.brd-editor-ol-lower-alpha,
                ol.brd-editor-ol-lower-roman {
                  margin: 0.5rem 0 1rem;
                  padding-left: 1.75rem;
                }

                ul.brd-editor-ul > li,
                ol.brd-editor-ol-decimal > li,
                ol.brd-editor-ol-upper-alpha > li,
                ol.brd-editor-ol-lower-alpha > li,
                ol.brd-editor-ol-lower-roman > li {
                  padding-left: 0.25rem;
                }

                /* Custom numbering variants not supported by list-style-type */
                ol.brd-ol-decimal-paren,
                ol.brd-ol-upper-alpha-paren,
                ol.brd-ol-lower-alpha-paren {
                  list-style: none;
                  padding-left: 1.5rem;
                  margin-left: 0;
                }
                ol.brd-ol-decimal-paren { counter-reset: brd_item; }
                ol.brd-ol-decimal-paren > li { counter-increment: brd_item; }
                ol.brd-ol-decimal-paren > li::before { content: counter(brd_item) ") "; }

                ol.brd-ol-upper-alpha-paren { counter-reset: brd_item; }
                ol.brd-ol-upper-alpha-paren > li { counter-increment: brd_item; }
                ol.brd-ol-upper-alpha-paren > li::before { content: counter(brd_item, upper-alpha) ") "; }

                ol.brd-ol-lower-alpha-paren { counter-reset: brd_item; }
                ol.brd-ol-lower-alpha-paren > li { counter-increment: brd_item; }
                ol.brd-ol-lower-alpha-paren > li::before { content: counter(brd_item, lower-alpha) ") "; }

                ol.brd-ol-decimal-paren > li::before,
                ol.brd-ol-upper-alpha-paren > li::before,
                ol.brd-ol-lower-alpha-paren > li::before {
                  display: inline-block;
                  width: auto;
                  margin-right: 0.25rem;
                  color: inherit;
                }

                /* Multilevel decimal: 1.1.1 */
                ol.brd-ol-multilevel-decimal {
                  list-style: none;
                  padding-left: 1.5rem;
                  margin-left: 0;
                  counter-reset: brd_ml;
                }
                ol.brd-ol-multilevel-decimal li {
                  counter-increment: brd_ml;
                }
                ol.brd-ol-multilevel-decimal li::before {
                  content: counters(brd_ml, ".") ". ";
                  margin-right: 0.25rem;
                }
                ol.brd-ol-multilevel-decimal ol {
                  list-style: none;
                  padding-left: 1.5rem;
                  margin-left: 0;
                  counter-reset: brd_ml;
                }

                /* Custom bullet variants */
                ul.brd-ul-arrow,
                ul.brd-ul-check,
                ul.brd-ul-diamond {
                  list-style: none;
                  padding-left: 1.5rem;
                  margin-left: 0;
                }
                ul.brd-ul-arrow > li::before { content: "âž¤ "; }
                ul.brd-ul-check > li::before { content: "âœ“ "; }
                ul.brd-ul-diamond > li::before { content: "â– "; }
                ul.brd-ul-arrow > li::before,
                ul.brd-ul-check > li::before,
                ul.brd-ul-diamond > li::before {
                  display: inline-block;
                  margin-right: 0.25rem;
                  color: inherit;
                }

                /* Table styling */
                table.brd-table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 0.75rem 0;
                  table-layout: fixed;
                  font-size: inherit;
                }
                table.brd-table td, table.brd-table th {
                  border: 1px solid #cbd5e1;
                  padding: 7px 10px;
                  vertical-align: top;
                  min-width: 48px;
                  line-height: 1.55;
                }
                table.brd-table th {
                  background-color: #f1f5f9;
                  font-weight: 600;
                  color: #1e293b;
                  text-align: left;
                  border-color: #94a3b8;
                }
                table.brd-table tr:nth-child(even) td {
                  background-color: #fafbfc;
                }
              `}</style>

              <div
                ref={brdViewportRef}
                className="mt-4 w-full overflow-x-auto rounded-3xl border border-slate-200 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.1),transparent_42%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] p-4 pb-10 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0"
              >
                {isBrdGenerating && (
                  <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
                    Generating BRD... editor is temporarily locked until generation is complete.
                  </div>
                )}
                <div
                  ref={brdMeasureRef}
                  className="pointer-events-none fixed left-[-99999px] top-0 w-0 overflow-hidden whitespace-pre-wrap font-['Aptos','Arial',sans-serif] text-[15px] leading-[1.7] text-slate-900 [&_h2]:mb-4 [&_h2]:mt-7 [&_h2]:border-b [&_h2]:border-slate-300 [&_h2]:pb-2 [&_h2]:text-[19px] [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-[0.08em] [&_h2]:text-slate-800 [&_h2:first-child]:mt-0 [&_h3]:mb-3 [&_h3]:mt-5 [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:text-sky-900 [&_h3:first-child]:mt-0 [&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:text-[14px] [&_h4]:font-semibold [&_h4]:text-slate-800 [&_h4:first-child]:mt-0 [&_p]:mb-3 [&_p]:mt-0 [&_p]:text-justify [&_ul]:mb-4 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-8 [&_ol]:mb-4 [&_ol]:mt-2 [&_ol]:pl-8 [&_li]:mb-1.5 [&_li]:pl-1"
                  style={{
                    width: BRD_CONTENT_WIDTH_PX,
                    fontFamily: brdFontFamily === 'Aptos' ? "Aptos, Arial, sans-serif" : `${brdFontFamily}, Arial, sans-serif`,
                    fontSize: `${brdFontSize}px`,
                    lineHeight: String(brdLineHeight),
                  }}
                  aria-hidden="true"
                />
                <div
                  className="mx-auto space-y-6"
                  style={{
                    width: BRD_PAGE_WIDTH_PX * brdZoom,
                  }}
                >
                  <div
                    style={{
                      height: brdCanvasHeightPx * brdZoom,
                    }}
                  >
                    <div style={{ transform: `scale(${brdZoom})`, transformOrigin: 'top left' }} className="space-y-6">
                      {/* Cover Page */}
                      {showBrdCoverPage && <section className="relative h-[1123px] w-[794px] border border-slate-300 bg-white px-16 py-14 shadow-[0_28px_58px_-38px_rgba(15,23,42,0.45)]">
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            height: '100%',
                            textAlign: 'center',
                            padding: '80px 60px',
                          }}
                        >
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                            <div style={{
                              fontSize: '14px',
                              color: '#94a3b8',
                              textTransform: 'uppercase',
                              letterSpacing: '3px',
                              marginBottom: '40px',
                              fontWeight: 500,
                              fontFamily: "'Aptos', 'Calibri', Arial, sans-serif",
                            }}>
                              Business Requirements Document
                            </div>
                            <div style={{
                              display: 'inline-block',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#0369a1',
                              background: '#e0f2fe',
                              borderRadius: '4px',
                              padding: '4px 12px',
                              letterSpacing: '1.5px',
                              textTransform: 'uppercase',
                              marginBottom: '24px',
                              fontFamily: "'Aptos', 'Calibri', Arial, sans-serif",
                            }}>
                              {idea.type}
                            </div>
                            <h1 style={{
                              fontSize: '42px',
                              fontWeight: 700,
                              color: '#0f172a',
                              margin: 0,
                              lineHeight: 1.25,
                              marginBottom: '32px',
                              fontFamily: "'Aptos', 'Calibri', Arial, sans-serif",
                              letterSpacing: '-0.5px',
                            }}>
                              {idea.title}
                            </h1>
                            <div style={{
                              fontSize: '12px',
                              color: '#94a3b8',
                              fontFamily: "'Aptos', 'Calibri', Arial, sans-serif",
                              letterSpacing: '0.5px',
                            }}>
                              {idea.createdAt}
                            </div>
                          </div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
                            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '30px', textAlign: 'center' }}>
                              <div style={{
                                fontSize: '13px',
                                color: '#64748b',
                                fontFamily: "'Aptos', 'Calibri', Arial, sans-serif",
                                letterSpacing: '0.3px',
                              }}>
                                Submitted by
                              </div>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: 500,
                                color: '#0f172a',
                                marginTop: '8px',
                                fontFamily: "'Aptos', 'Calibri', Arial, sans-serif",
                              }}>
                                {submittedByDisplayName && submittedByDisplayName.toLowerCase() !== 'unknown' ? submittedByDisplayName : 'â€”'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>}

                      {/* Table of Contents Page â€” only shown when BRD has content */}
                      {showBrdTocPage && <section className="relative h-[1123px] w-[794px] border border-slate-300 bg-white px-16 py-14 shadow-[0_28px_58px_-38px_rgba(15,23,42,0.45)]">
                        <div
                          style={{
                            fontFamily: brdFontFamily === 'Aptos' ? "Aptos, Arial, sans-serif" : `${brdFontFamily}, Arial, sans-serif`,
                            fontSize: `${brdFontSize}px`,
                            lineHeight: String(brdLineHeight),
                            color: '#0f172a',
                            paddingTop: BRD_HEADER_TOP_PX,
                            minHeight: BRD_CONTENT_HEIGHT_PX,
                            maxHeight: BRD_CONTENT_HEIGHT_PX,
                            overflow: 'auto',
                          }}
                          dangerouslySetInnerHTML={{
                            __html: generateBrdTableOfContents(brdPages),
                          }}
                        />
                      </section>}

                      {/* Main Content Pages */}
                      {brdPages.map((_, index) => (
                        <BrdPage key={index} index={index} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <BrdFooter />
            </div>
          </CollapsiblePanel>
        </div>
        )}

        {activePanel === 'scoring' && (
        <div id="panel-scoring" className="scroll-mt-24">
          <CollapsiblePanel
            panelKey="scoring"
            title="AI Evaluation & Scoring"
            description="Feasibility and priority scoring with AI explanation."
            isOpen={collapsed.scoring}
            onToggle={togglePanel}
            confidence={confidence.scoring}
          >
            <div className="space-y-4">
              {isScoringRefreshing && (
                <div className="flex items-center gap-3 rounded-2xl border border-violet-200/80 bg-gradient-to-r from-violet-50 via-white to-sky-50 px-4 py-2.5 text-sm text-violet-900 shadow-[0_8px_24px_-18px_rgba(139,92,246,0.35)]">
                  <RefreshCcw className="h-4 w-4 animate-spin text-violet-600" />
                  <span className="flex flex-col leading-tight">
                    <span className="text-[13px] font-semibold tracking-tight text-slate-900">
                      Tectona Assistant is analyzing scoring evidence
                    </span>
                    <span className="text-[12px] text-slate-600">
                      Re-reading Idea & Backlog scoring inputs and forming a board-ready assessment.
                    </span>
                  </span>
                </div>
              )}

              {scoringGenerationError && !isScoringRefreshing && (
                <div
                  role="alert"
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-900"
                >
                  <p className="font-semibold text-rose-800">AI scoring analysis could not be generated</p>
                  <p className="mt-1.5 leading-6 text-rose-700">{scoringGenerationError}</p>
                </div>
              )}

              {scoringMissing && !scoringGenerationError && !isScoringRefreshing && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">{runtimeScoringAnalysis.summary_title || 'Scoring data is not ready yet'}</p>
                  <p className="mt-1.5 leading-6">
                    {runtimeScoringAnalysis.executive_brief || 'Panel ini tidak menampilkan fallback. Analisa AI baru akan muncul setelah data scoring Idea & Backlog benar-benar tersedia.'}
                  </p>
                  {!hasNumericScoring ? (
                    <p className="mt-2 text-xs text-amber-700">
                      Dimensi skor backlog saat ini masih 0 / kosong — tidak ada angka yang dikarang.
                    </p>
                  ) : null}
                  {runtimeScoringAnalysis.missing_fields.length > 0 && (
                    <p className="mt-2 text-xs text-slate-500">
                      Missing fields: {runtimeScoringAnalysis.missing_fields.join(', ')}
                    </p>
                  )}
                </div>
              )}

              {!scoringGenerationError && scoringLoaded && (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.55fr_0.95fr]">
                  <Card className="border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_20px_50px_-38px_rgba(15,23,42,0.3)]">
                    <CardContent className="p-3.5 space-y-3">
                      <div className="flex flex-col gap-2.5 border-b border-slate-200/80 pb-2.5 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                            Enterprise Scoring Signal
                          </div>
                          <h3 className="mt-1.5 text-base font-semibold text-slate-950">
                            {runtimeScoringAnalysis.summary_title || 'Executive priority and feasibility readout'}
                          </h3>
                          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-600">
                            {runtimeScoringAnalysis.executive_brief}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {runtimeScoringAnalysis.score_posture && (
                            <Badge variant="outline" className="border-violet-200 bg-violet-50 text-[10px] font-semibold text-violet-700">
                              {runtimeScoringAnalysis.score_posture}
                            </Badge>
                          )}
                          {runtimeScoringAnalysis.priority && (
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] font-semibold',
                                priorityLabel === 'High Priority'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : priorityLabel === 'Medium Priority'
                                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                                    : 'border-rose-200 bg-rose-50 text-rose-700'
                              )}
                            >
                              {runtimeScoringAnalysis.priority}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Overall Score</p>
                          <div className="mt-2.5 flex items-end gap-2">
                            <p className="text-3xl font-semibold leading-none text-slate-950">
                              {runtimeScoringAnalysis.overall_score || totalScore}
                            </p>
                            <span className="pb-1 text-xs font-medium text-slate-500">/ 100</span>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                scorePercent >= 80
                                  ? 'bg-gradient-to-r from-emerald-500 to-sky-500'
                                  : scorePercent >= 60
                                    ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                                    : 'bg-gradient-to-r from-rose-500 to-red-500'
                              )}
                              style={{ width: `${scorePercent}%` }}
                            />
                          </div>
                          <p className="mt-2 text-[11px] leading-4.5 text-slate-500">
                            {runtimeScoringAnalysis.decision_bias_detail || 'Composite signal normalized for enterprise prioritization and steering conversations.'}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Primary Strength</p>
                          <div className="mt-2.5 flex items-center gap-2 text-slate-950">
                            <TrendingUp className="h-4 w-4 text-sky-700" />
                            <p className="text-base font-semibold">
                              {runtimeScoringAnalysis.primary_strength || scoringOutlook.strongestDriver}
                            </p>
                          </div>
                          <p className="mt-2 text-[11px] leading-4.5 text-slate-500">
                            {runtimeScoringAnalysis.primary_strength_detail}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Execution Posture</p>
                          <div className="mt-2.5 flex items-center gap-2 text-slate-950">
                            <Gauge className="h-4 w-4 text-violet-700" />
                            <p className="text-base font-semibold">
                              {runtimeScoringAnalysis.execution_posture || scoringOutlook.executionReadiness}
                            </p>
                          </div>
                          <p className="mt-2 text-[11px] leading-4.5 text-slate-500">
                            {runtimeScoringAnalysis.execution_posture_detail}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-[1.3fr_0.7fr]">
                        <div className="rounded-[24px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(95,125,224,0.14),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Scoring Composition</p>
                              <h4 className="mt-1 text-sm font-semibold text-slate-950">Raw score dimensions from Idea &amp; Backlog</h4>
                            </div>
                            <Badge variant="outline" className="border-slate-200 bg-white text-[10px] font-semibold text-slate-600">
                              Backlog Source
                            </Badge>
                          </div>
                          <div className="h-[165px] lg:h-[150px] xl:h-[165px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={scoreData} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <RechartsTooltip
                                  cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                                  contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 18px 40px -28px rgba(15,23,42,0.45)' }}
                                  formatter={(value) => [`${value}/10`, 'Score']}
                                />
                                <Bar dataKey="score" radius={[10, 10, 0, 0]} barSize={42}>
                                  {scoreData.map((item) => (
                                    <Cell key={item.label} fill={item.fill} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {(runtimeScoringAnalysis.kpi_cards.length > 0 ? runtimeScoringAnalysis.kpi_cards : scoreData.map((item) => ({
                            label: item.label,
                            value: `${item.score}/10`,
                            detail: item.detail,
                          }))).slice(0, 4).map((item) => (
                            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[13px] font-semibold text-slate-900">{item.label}</p>
                                  <p className="mt-1 text-[11px] leading-4 text-slate-500">{item.detail}</p>
                                </div>
                                <div className="rounded-xl bg-slate-950 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                                  {item.value}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.98))] shadow-[0_20px_50px_-36px_rgba(15,23,42,0.4)]">
                    <CardContent className="p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Board Recommendation</p>
                          <h3 className="mt-1 text-sm font-semibold text-slate-950">Enterprise investment signal</h3>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-right">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Priority</p>
                          <p className="text-sm font-semibold text-slate-900">
                            {runtimeScoringAnalysis.priority || priorityLabel}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-slate-200 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.16),transparent_58%),linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.98))] p-3.5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Scoring Posture</p>
                            <p className="mt-1.5 text-xl font-semibold text-slate-950">
                              {runtimeScoringAnalysis.score_posture}
                            </p>
                          </div>
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
                            <Target className="h-4.5 w-4.5" />
                          </div>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-slate-600">
                          {runtimeScoringAnalysis.recommended_action}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Primary Strength</p>
                          <p className="mt-1.5 text-sm font-semibold text-slate-950">
                            {runtimeScoringAnalysis.primary_strength}
                          </p>
                          <p className="mt-1.5 text-xs leading-5 text-slate-500">
                            {runtimeScoringAnalysis.primary_strength_detail}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Main Watchpoint</p>
                          <p className="mt-1.5 text-sm font-semibold text-slate-950">
                            {runtimeScoringAnalysis.main_watchpoint}
                          </p>
                          <p className="mt-1.5 text-xs leading-5 text-slate-500">
                            {runtimeScoringAnalysis.main_watchpoint_detail}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                            <TrendingUp className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {runtimeScoringAnalysis.positive_signal_title}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                              {runtimeScoringAnalysis.positive_signal_detail}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                            <TriangleAlert className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {runtimeScoringAnalysis.watchpoint_signal_title}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                              {runtimeScoringAnalysis.watchpoint_signal_detail}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-slate-50 shadow-inner">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200/80">AI Commentary</p>
                        <p className="mt-2 text-xs leading-5 text-slate-200">
                          {runtimeScoringAnalysis.commentary}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </CollapsiblePanel>
        </div>
        )}

        {activePanel === 'impact' && (
        <div id="panel-impact" className="scroll-mt-24">
          <CollapsiblePanel
            panelKey="impact"
            title="Analisis Dampak AI"
            description="Penilaian dampak multi dimensi dengan indikator positif dan area kontrol."
            isOpen={collapsed.impact}
            onToggle={togglePanel}
            confidence={confidence.impact}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.52fr_0.88fr]">
                <Card className="glass-card relative overflow-hidden border-white/50 bg-white/35 shadow-[0_30px_80px_-46px_rgba(15,23,42,0.4)] backdrop-blur-2xl">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.85),transparent_26%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.22),transparent_28%),radial-gradient(circle_at_50%_120%,rgba(59,130,246,0.16),transparent_45%)]" />
                  <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/80" />
                  <div className="relative z-10 border-b border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.36),rgba(255,255,255,0.18))] px-4 py-4 backdrop-blur-xl">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                      <div className="max-w-3xl">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          <Sparkles className="h-3.5 w-3.5 text-cyan-700" />
                          Executive Impact Canvas
                        </div>
                        <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950">Nilai transformasi multi finance dengan guardrail yang terukur</h3>
                        <p className="mt-1.5 text-sm leading-5 text-slate-600">
                          Proposal ini bernilai tinggi untuk operasi multi finance karena meningkatkan ketepatan waktu intervensi, mengurangi antrean kritikal, dan memperkuat visibilitas layanan, dengan syarat adopsi proses dan governance model dijaga disiplin.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[400px]">
                        <div className="rounded-2xl border border-white/70 bg-white/45 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_12px_28px_-20px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Reach</p>
                          <p className="mt-1.5 text-xl font-semibold text-slate-950">5</p>
                          <p className="text-[11px] text-slate-500">domains</p>
                        </div>
                        <div className="rounded-2xl border border-white/70 bg-white/45 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_12px_28px_-20px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Bias</p>
                          <p className="mt-1.5 text-sm font-semibold text-emerald-700">Upside-led</p>
                          <p className="text-[11px] text-slate-500">value posture</p>
                        </div>
                        <div className="rounded-2xl border border-white/70 bg-white/45 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_12px_28px_-20px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Watch</p>
                          <p className="mt-1.5 text-sm font-semibold text-amber-700">Adoption</p>
                          <p className="text-[11px] text-slate-500">operating fit</p>
                        </div>
                        <div className="rounded-2xl border border-white/70 bg-white/45 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_12px_28px_-20px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Board View</p>
                          <p className="mt-1.5 text-sm font-semibold text-sky-700">Sponsor</p>
                          <p className="text-[11px] text-slate-500">with controls</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <CardContent className="relative z-10 p-4 space-y-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.15fr_0.85fr]">
                      <div className="rounded-[26px] border border-white/60 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.18),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.56),rgba(255,255,255,0.28))] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_20px_40px_-30px_rgba(15,23,42,0.24)] backdrop-blur-xl">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Investment Narrative</p>
                            <h4 className="mt-1 text-base font-semibold text-slate-950">The strongest value comes from timing, not just automation</h4>
                          </div>
                          <Badge variant="outline" className="border-cyan-200/80 bg-white/55 text-[10px] font-semibold text-cyan-700 backdrop-blur-md">
                            Multi-domain signal
                          </Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                          <div className="rounded-2xl border border-white/65 bg-white/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-lg">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Strategic value</p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-emerald-700" />
                              <p className="text-sm font-semibold text-slate-950">Predictive control</p>
                            </div>
                            <p className="mt-1.5 text-[12px] leading-5 text-slate-500">Memajukan respons eskalasi lebih awal dalam siklus approval.</p>
                          </div>
                          <div className="rounded-2xl border border-white/65 bg-white/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-lg">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Operating effect</p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <Cpu className="h-4 w-4 text-indigo-700" />
                              <p className="text-sm font-semibold text-slate-950">Earlier intervention</p>
                            </div>
                            <p className="mt-1.5 text-[12px] leading-5 text-slate-500">Creates room for action before escalation pressure builds.</p>
                          </div>
                          <div className="rounded-2xl border border-white/65 bg-white/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-lg">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Governance focus</p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <TriangleAlert className="h-4 w-4 text-amber-700" />
                              <p className="text-sm font-semibold text-slate-950">Adoption and drift</p>
                            </div>
                            <p className="mt-1.5 text-[12px] leading-5 text-slate-500">Control quality decides how much of the upside is retained.</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[26px] border border-slate-200/80 bg-slate-950 p-3.5 text-slate-50 shadow-[0_22px_50px_-34px_rgba(15,23,42,0.55)]">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200/75">Board Signal</p>
                            <h4 className="mt-1 text-base font-semibold text-white">Advance with controlled rollout</h4>
                          </div>
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-200">
                            <Target className="h-4.5 w-4.5" />
                          </div>
                        </div>
                        <p className="mt-2.5 text-sm leading-5 text-slate-300">
                          Sponsor the initiative as a governance-enhancing capability, with rollout checkpoints for calibration, ownership, and operational adoption.
                        </p>
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
                            <span className="text-xs font-medium text-slate-300">Executive confidence</span>
                            <span className="text-sm font-semibold text-white">High with guardrails</span>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
                            <span className="text-xs font-medium text-slate-300">Funding logic</span>
                            <span className="text-sm font-semibold text-white">Variance reduction</span>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
                            <span className="text-xs font-medium text-slate-300">Control requirement</span>
                            <span className="text-sm font-semibold text-white">Adoption governance</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                      {[
                        {
                          icon: Briefcase,
                          title: 'Business impact',
                          lens: 'Steering multi finance',
                          positive: 'Meningkatkan prediktabilitas SLA approval',
                          negative: 'Requires change adoption',
                          signal: 'High upside',
                          accent: '#0ea5e9',
                          backgroundImage:
                            'radial-gradient(circle at top left, rgba(14, 165, 233, 0.12), transparent 42%), linear-gradient(180deg, rgba(255,255,255,0.99), rgba(248,250,252,0.98))',
                        },
                        {
                          icon: Cpu,
                          title: 'Operational impact',
                          lens: 'Process control',
                          positive: 'Earlier intervention capability',
                          negative: 'Beban workflow governance baru',
                          signal: 'Medium effort',
                          accent: '#6366f1',
                          backgroundImage:
                            'radial-gradient(circle at top left, rgba(99, 102, 241, 0.12), transparent 42%), linear-gradient(180deg, rgba(255,255,255,0.99), rgba(248,250,252,0.98))',
                        },
                        {
                          icon: UserRound,
                          title: 'Customer impact',
                          lens: 'Experience continuity',
                          positive: 'Mengurangi keterlambatan pada proses lanjutan',
                          negative: 'Initial model calibration period',
                          signal: 'Visible benefit',
                          accent: '#10b981',
                          backgroundImage:
                            'radial-gradient(circle at top left, rgba(16, 185, 129, 0.12), transparent 42%), linear-gradient(180deg, rgba(255,255,255,0.99), rgba(248,250,252,0.98))',
                        },
                        {
                          icon: DollarSign,
                          title: 'Financial impact',
                          lens: 'Cost resilience',
                          positive: 'Menurunkan varians proses dan biaya rework',
                          negative: 'Upfront implementation spend',
                          signal: 'ROI case',
                          accent: '#f59e0b',
                          backgroundImage:
                            'radial-gradient(circle at top left, rgba(245, 158, 11, 0.12), transparent 42%), linear-gradient(180deg, rgba(255,255,255,0.99), rgba(248,250,252,0.98))',
                        },
                        {
                          icon: TriangleAlert,
                          title: 'Risk impact',
                          lens: 'Kesiapan governance',
                          positive: 'Risk exposure becomes visible sooner',
                          negative: 'Drift model perlu monitoring rutin',
                          signal: 'Managed exposure',
                          accent: '#f43f5e',
                          backgroundImage:
                            'radial-gradient(circle at top left, rgba(244, 63, 94, 0.12), transparent 42%), linear-gradient(180deg, rgba(255,255,255,0.99), rgba(248,250,252,0.98))',
                        },
                      ].map((item, index) => (
                        <Card
                          key={item.title}
                          className={cn(
                            'relative overflow-hidden border-slate-200/80 shadow-[0_24px_50px_-40px_rgba(15,23,42,0.32)]',
                            index === 4 && 'md:col-span-2 xl:col-span-2'
                          )}
                          style={{ backgroundImage: item.backgroundImage }}
                        >
                          <div className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: item.accent }} />
                          <CardContent className="p-3.5 pl-4.5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/90 bg-white/90 shadow-sm" style={{ color: item.accent }}>
                                  <item.icon className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.lens}</p>
                                  <h4 className="mt-1 text-base font-semibold text-slate-950">{item.title}</h4>
                                </div>
                              </div>
                              <Badge variant="outline" className="border-white/90 bg-white/85 text-[10px] font-semibold text-slate-700 shadow-sm">
                                {item.signal}
                              </Badge>
                            </div>

                            <div className={cn('mt-3 space-y-2.5', index === 4 && 'xl:grid xl:grid-cols-2 xl:gap-3 xl:space-y-0')}>
                              <div className="rounded-2xl border border-emerald-200/80 bg-white/88 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Value unlock</p>
                                <p className="mt-1 text-sm leading-5 text-slate-900">{item.positive}</p>
                              </div>
                              <div className="rounded-2xl border border-rose-200/80 bg-white/88 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-700">Control condition</p>
                                <p className="mt-1 text-sm leading-5 text-slate-900">{item.negative}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden border-slate-200/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.94))] text-slate-50 shadow-[0_30px_70px_-40px_rgba(15,23,42,0.6)]">
                  <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-200/70">Impact Recommendation</p>
                        <h3 className="mt-1 text-xl font-semibold tracking-tight text-white">Executive action frame</h3>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-200 shadow-sm">
                        <Target className="h-5 w-5" />
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-4 space-y-3">
                    <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200/75">Decision stance</p>
                        <p className="mt-1.5 text-[24px] font-semibold leading-tight text-white">Dorong sebagai kapabilitas AI berbasis kontrol operasional</p>
                      <p className="mt-2.5 text-sm leading-5 text-slate-300">
                        Business case kuat, namun hasil optimal datang jika adopsi perubahan, desain ownership, dan kualitas kalibrasi diperlakukan sebagai kontrol delivery yang didanai.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Best-case outcome</p>
                        <p className="mt-2 text-base font-semibold text-white">Earlier intervention, lower variance</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Critical control</p>
                        <p className="mt-2 text-base font-semibold text-white">Governance adopsi dan drift model</p>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-300">
                            <TrendingUp className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">Impact is strongest where timing matters most</p>
                            <p className="mt-1 text-sm leading-5 text-slate-300">Model memberi nilai dengan menampilkan sinyal risiko keterlambatan sebelum kasus menjadi eskalasi kritikal.</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/12 text-amber-300">
                            <TriangleAlert className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">Change enablement should be funded from the start</p>
                            <p className="mt-1 text-sm leading-5 text-slate-300">Without clear operating ownership, workflow load can offset part of the projected upside.</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-sky-300">
                            <Sparkles className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">Recommended next step</p>
                            <p className="mt-1 text-sm leading-5 text-slate-300">Posisikan sebagai penguatan governance bertahap, bukan sekadar deployment fitur AI.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/8 px-4 py-3.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">AI Commentary</p>
                      <p className="mt-2 text-sm leading-5 text-slate-200">
                        Penilaian AI menunjukkan proposal ini memiliki manfaat lintas fungsi yang tinggi dengan downside terkelola, selama model operasi menetapkan kualitas adopsi dan kalibrasi sebagai kontrol eksekutif yang eksplisit.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CollapsiblePanel>
        </div>
        )}

        {activePanel === 'integration' && (
        <div id="panel-integration" className="scroll-mt-24">
          <CollapsiblePanel
            panelKey="integration"
            title="AI Integration Recommendation"
            description="System and data integration recommendations for execution readiness."
            isOpen={collapsed.integration}
            onToggle={togglePanel}
            confidence={confidence.integration}
          >
            <div className="rounded-2xl border border-border/40 bg-white/80 p-3">
              <div className="h-[620px] rounded-[22px] border border-slate-200/80 overflow-hidden bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.22)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.96))] [background-size:22px_22px]">
                <ReactFlow
                  nodes={integrationArchitecture.nodes}
                  edges={integrationArchitecture.edges}
                  nodeTypes={archimateNodeTypes}
                  fitView
                  fitViewOptions={{ padding: 0.08, minZoom: 0.7 }}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable={false}
                  panOnDrag
                  zoomOnScroll
                  zoomOnPinch
                  minZoom={0.55}
                  maxZoom={1.4}
                  proOptions={{ hideAttribution: true }}
                  defaultEdgeOptions={{ type: 'smoothstep' }}
                >
                  <MiniMap
                    zoomable
                    pannable
                    nodeColor={(node) => {
                      if (node.type === 'archimateBoundary') return '#e2e8f0'
                      if (node.id === 'legend' || node.id === 'canvas-notes') return '#f8fafc'
                      const data = node.data as Partial<ArchimateElementNodeData>
                      if (data.layer === 'business') return '#f9c78f'
                      if (data.layer === 'technology') return '#c4f0cb'
                      return '#bfe0ff'
                    }}
                    maskColor="rgba(15, 23, 42, 0.08)"
                    className="!bg-white/95 !border !border-slate-200"
                  />
                  <Controls showInteractive={false} />
                  <Background color="#d7dee8" gap={22} />
                </ReactFlow>
              </div>
            </div>
          </CollapsiblePanel>
        </div>
        )}

        {activePanel === 'process' && (
        <div id="panel-process" className="scroll-mt-24">
          <CollapsiblePanel
            panelKey="process"
            title="AI Business Process Visualization"
            description="AS-IS / TO-BE process view from brainstorming and BRD analysis."
            isOpen={collapsed.process}
            onToggle={togglePanel}
            confidence={confidence.process}
          >
            <div className="space-y-3">
              {brainstormProcessDiagrams.length > 0 ? (
                <Card className="border-border/40 bg-white/85">
                  <CardContent className="pt-4 space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-600 mb-1">Diagram proses dari brainstorming</p>
                      <p className="text-[11px] text-slate-500">
                        Sumber: diagram AS-IS / TO-BE yang disepakati saat Create Idea, tersimpan di deskripsi ide.
                      </p>
                    </div>
                    {brainstormProcessDiagrams.map((diagram) => (
                      <div key={`${diagram.label}-${diagram.source.slice(0, 48)}`} className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {diagram.label}
                        </p>
                        <AssistantMermaidBlock source={diagram.source} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-border/40 bg-white/85">
                  <CardContent className="pt-4">
                    <p className="text-xs font-semibold text-slate-600 mb-3">Business architecture diagram preview</p>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Belum ada diagram AS-IS/TO-BE di deskripsi ide. Menampilkan alur ringkas dari section BRD
                      (Problem statement, Objectives, Functional requirements, Dependencies).
                    </p>

                    <div className="rounded-xl border border-border/40 bg-white/70 p-3">
                      <div className="h-[500px] rounded-xl border border-slate-200/80 overflow-hidden">
                        <ReactFlow
                          nodes={reactFlowFromMermaid.nodes}
                          edges={reactFlowFromMermaid.edges}
                          nodeTypes={bpmnNodeTypes}
                          fitView
                          fitViewOptions={{ padding: 0.2 }}
                          nodesDraggable={false}
                          nodesConnectable={false}
                          elementsSelectable={false}
                          panOnDrag
                          zoomOnScroll
                          zoomOnPinch
                          minZoom={0.5}
                          maxZoom={1.6}
                          proOptions={{ hideAttribution: true }}
                        >
                          <MiniMap
                            zoomable
                            pannable
                            nodeColor="#cbd5e1"
                            maskColor="rgba(15, 23, 42, 0.08)"
                            className="!bg-white/95 !border !border-slate-200"
                          />
                          <Controls showInteractive={false} />
                          <Background color="#dbeafe" gap={22} />
                        </ReactFlow>
                      </div>

                      <div className="mt-3 rounded-lg border border-border/40 bg-white/90 px-3 py-2 text-[11px] text-slate-600 flex flex-wrap items-center gap-3">
                        <span className="font-semibold text-slate-700">BPMN-style rendering on React Flow</span>
                        <span>Start/End events: circle and double-circle</span>
                        <span>Task: rounded rectangle</span>
                        <span>Gateway: diamond shape</span>
                        <span>Data store/object: dashed integration flow</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowMermaidCode((v) => !v)}>
                  {showMermaidCode ? 'Hide diagram source' : 'Show diagram source'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      void navigator.clipboard.writeText(mermaidCode)
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy diagram
                </Button>
              </div>

              {showMermaidCode && (
                <pre className="rounded-xl border border-border/40 bg-slate-950 p-3 text-xs text-slate-100 overflow-auto">
                  {mermaidCode}
                </pre>
              )}
            </div>
          </CollapsiblePanel>
        </div>
        )}

        {activePanel === 'costBenefit' && (
        <div id="panel-costBenefit" className="scroll-mt-24">
          <CollapsiblePanel
            panelKey="costBenefit"
            title="AI Cost & Benefit Analysis"
            description="Numeric model when finance evidence exists; otherwise honest narrative / percentage points."
            isOpen={collapsed.costBenefit}
            onToggle={togglePanel}
            confidence={confidence.costBenefit}
          >
            <div className="space-y-3">
              {benefitError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {benefitError}
                </div>
              ) : null}

              {!benefitAnalysis && !benefitError ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Belum ada hasil cost–benefit. Gunakan Regenerate Cost Benefit.
                </div>
              ) : null}

              {benefitAnalysis ? (
                <>
                  <p className="text-sm text-slate-700">{benefitAnalysis.executive_summary}</p>
                  {(benefitAnalysis.narrative_points?.length ?? 0) > 0 ? (
                    <Card className="border-amber-200/70 bg-amber-50/50">
                      <CardContent className="pt-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
                          Narasi / persentase (tanpa angka keuangan absolut)
                        </p>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {benefitAnalysis.narrative_points?.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ) : null}

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                    <Card className="border-border/40 bg-white/80 lg:col-span-2">
                      <CardContent className="pt-4 h-[240px]">
                        {costBenefitChartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={costBenefitChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <RechartsTooltip />
                              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                {costBenefitChartData.map((item) => (
                                  <Cell key={item.name} fill={item.fill} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <p className="text-sm text-slate-500">Tidak ada metrik numerik yang bisa ditampilkan secara jujur.</p>
                        )}
                      </CardContent>
                    </Card>
                    <Card className="border-border/40 bg-white/80">
                      <CardContent className="pt-4 space-y-2 text-sm">
                        {benefitAnalysis.presentation_mode === 'narrative' ? (
                          <>
                            <p className="rounded-lg border border-border/40 bg-white px-3 py-2 text-slate-600">
                              Mode: narasi / % (asumsi default atau tanpa SoR keuangan)
                            </p>
                            {benefitAnalysis.roi_percentage > 0 ? (
                              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
                                <span className="font-semibold">ROI model (hipotesis):</span> {benefitAnalysis.roi_percentage.toFixed(0)}%
                              </p>
                            ) : null}
                            {benefitAnalysis.payback_period_months > 0 && benefitAnalysis.payback_period_months < 1e9 ? (
                              <p className="rounded-lg border border-border/40 bg-white px-3 py-2">
                                <span className="text-slate-500">Payback model:</span> {benefitAnalysis.payback_period_months.toFixed(0)} months
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <p className="rounded-lg border border-border/40 bg-white px-3 py-2">
                              <span className="text-slate-500">Estimated cost:</span> ${(benefitAnalysis.total_cost_5year / 1000).toFixed(0)}K
                            </p>
                            <p className="rounded-lg border border-border/40 bg-white px-3 py-2">
                              <span className="text-slate-500">Expected benefit:</span> ${(benefitAnalysis.total_benefit_5year / 1000).toFixed(0)}K
                            </p>
                            <p className="rounded-lg border border-border/40 bg-white px-3 py-2">
                              <span className="text-slate-500">Payback period:</span> {benefitAnalysis.payback_period_months.toFixed(0)} months
                            </p>
                            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
                              <span className="font-semibold">ROI:</span> {benefitAnalysis.roi_percentage.toFixed(0)}%
                            </p>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : null}
            </div>
          </CollapsiblePanel>
        </div>
        )}

        {activePanel === 'conversion' && (
        <div id="panel-conversion" className="scroll-mt-24">
          <CollapsiblePanel
            panelKey="conversion"
            title="Konversi Ide ke Eksekusi"
            description="Timeline Sprint → Epic → Task → Sub-task untuk handoff delivery."
            isOpen={collapsed.conversion}
            onToggle={togglePanel}
            confidence={confidence.conversion}
          >
            <div className="space-y-3">
              {conversionError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {conversionError}
                </div>
              ) : null}
              {conversionTimeline?.summary ? (
                <p className="text-sm text-slate-700">{conversionTimeline.summary}</p>
              ) : null}
              {(conversionTimeline?.warnings?.length ?? 0) > 0 ? (
                <p className="text-xs text-amber-700">
                  Catatan: {conversionTimeline?.warnings.join(', ')}
                </p>
              ) : null}
              {conversionTimeline?.sprints?.length ? (
                <IdeaConversionTimeline sprints={conversionTimeline.sprints} />
              ) : (
                !conversionError && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Belum ada timeline konversi. Gunakan Regenerate Conversion.
                  </div>
                )
              )}
            </div>
          </CollapsiblePanel>
        </div>
        )}
      </div>

      <Dialog open={developModalOpen} onOpenChange={setDevelopModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Develop with AI</DialogTitle>
            <DialogDescription>
              Preview generated structure, choose target, and trigger Virea workflow.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card className="border-border/40 bg-white/80">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Generated structure preview</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-slate-700">
                  <p>Project: Multi Finance Approval Intelligence</p>
                  <p>Epics: 3</p>
                  <p>Stories: 11</p>
                  <p>Tasks: 38</p>
                </CardContent>
              </Card>
              <Card className="border-border/40 bg-white/80">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Target workspace/project</CardTitle></CardHeader>
                <CardContent>
                  <select
                    value={targetWorkspace}
                    onChange={(e) => setTargetWorkspace(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option>Virea / Delivery Multi Finance</option>
                    <option>Virea / PMO Kredit Ritel</option>
                    <option>Virea / Transformasi Proses Persetujuan</option>
                  </select>
                </CardContent>
              </Card>
            </div>

            <div className="rounded-xl border border-border/40 bg-white/80 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600">Progress status</p>
              <div className="space-y-1.5 text-xs">
                <p className={cn(developStep === 'generating' && 'text-blue-700 font-semibold', (developStep === 'creating' || developStep === 'sending' || developStep === 'done') && 'text-emerald-700')}>1. Generating artifacts...</p>
                <p className={cn(developStep === 'creating' && 'text-blue-700 font-semibold', (developStep === 'sending' || developStep === 'done') && 'text-emerald-700')}>2. Creating project / epics / stories / tasks...</p>
                <p className={cn(developStep === 'sending' && 'text-blue-700 font-semibold', developStep === 'done' && 'text-emerald-700')}>3. Sending to Virea...</p>
                <p className={cn(developStep === 'done' ? 'text-emerald-700 font-semibold' : 'text-slate-500')}>4. Workflow triggered successfully.</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDevelopModalOpen(false)}>
              Close
            </Button>
            <Button onClick={startDevelop} disabled={developStep !== 'idle' && developStep !== 'done'}>
              <Wand2 className="h-4 w-4 mr-1.5" /> Start Develop Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageBrdTemplatesOpen} onOpenChange={setManageBrdTemplatesOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Manage Template BRD</DialogTitle>
            <DialogDescription>Buat, edit, atau hapus template BRD untuk canvas.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.1fr_1.4fr]">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Templates</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditingTemplate({
                      id: newTemplateId(),
                      name: 'New template',
                      header: '',
                      body: '',
                    })
                  }
                >
                  + New
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                {brdTemplates.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{t.name}</p>
                      <p className="truncate text-[11px] text-slate-500">{t.header || '(no header)'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => setEditingTemplate(t)}>
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-rose-600 hover:text-rose-700"
                        onClick={() => {
                          setBrdTemplates((prev) => prev.filter((x) => x.id !== t.id))
                          if (brdSelectedTemplateId === t.id) setBrdSelectedTemplateId('blank')
                          if (editingTemplate?.id === t.id) setEditingTemplate(null)
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-sm font-semibold text-slate-900">Editor</p>
              {!editingTemplate ? (
                <p className="mt-3 text-sm text-slate-500">Pilih template lalu klik Edit, atau klik + New.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-slate-600">Nama template</p>
                    <Input value={editingTemplate.name} onChange={(e) => setEditingTemplate((p) => (p ? { ...p, name: e.target.value } : p))} />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-slate-600">Header</p>
                    <Input
                      value={editingTemplate.header}
                      onChange={(e) => setEditingTemplate((p) => (p ? { ...p, header: e.target.value } : p))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-slate-600">Body (plain text)</p>
                    <Textarea
                      value={editingTemplate.body}
                      onChange={(e) => setEditingTemplate((p) => (p ? { ...p, body: e.target.value } : p))}
                      className="min-h-[260px]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        const t = editingTemplate
                        setBrdTemplates((prev) => {
                          const idx = prev.findIndex((x) => x.id === t.id)
                          if (idx === -1) return [...prev, t]
                          const next = [...prev]
                          next[idx] = t
                          return next
                        })
                        setEditingTemplate(null)
                      }}
                    >
                      Save
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setEditingTemplate(null)}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        // Preview/apply into canvas immediately.
                        applyBrdTemplateById(editingTemplate.id)
                        setManageBrdTemplatesOpen(false)
                      }}
                    >
                      Apply to Canvas
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManageBrdTemplatesOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  )
}
