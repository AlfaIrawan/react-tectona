
import { getSession } from '@/auth/authService'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bot,
  Brain,
  Briefcase,
  Building2,
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
  Files,
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
  X,
  Loader2,
  Maximize2,
  Minimize2,
  Plus,
  Folder,
  FolderPlus,
  PencilLine,
  Trash2,
  CheckCircle2,
  Circle,
  Info,
  GripVertical,
  Workflow,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { enterpriseCyanGradientActionButtonClass, enterpriseIndigoGradientActionButtonClass, enterpriseSecondaryButtonClass, enterpriseControlFocusClass, registerServicePrimaryButtonClass } from '@/lib/enterpriseButtonClasses'
import {
  analyzeIdeaScoring,
  analyzeIdeaIntegration,
  analyzeIdeaC4Architecture,
  type C4ArchitectureLevel,
  analyzeIdeaProcess,
  analyzeIdeaProcessDetail,
  type ProcessSubTask,
  fillDkmTemplate,
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
  createProjectDocument,
  deleteDocument,
  instantiateTemplateFromProject,
  listAllDocuments,
  listTemplates,
  patchDocument,
  resolveLatestDocumentAttachmentBlob,
  type DocumentResponse,
  type DocumentTemplateResponse,
} from '@/lib/api/documentKnowledgeApi'
import { belongsToDkmTemplateScope } from '@/modules/document-knowledge-management/lib/templateWorkspaceScope'
import { useUserWorkspaceOptions } from '@/modules/core-shell/hooks/useUserWorkspaceOptions'
import {
  createDocumentFolder,
  deleteDocumentFolder,
  fetchDocumentFolders,
  updateDocumentFolder,
  type DocumentFolder,
} from '@/lib/api/documentFolderApi'
import { createProject, fetchProjects, TECTONA_PROJECT_APP_ID } from '@/lib/api/projectApi'
import { ensureProjectDocumentFolder } from '@/modules/projects/lib/ensureProjectDocumentFolder'
import { nextUntitledDocumentFolderName } from '@/modules/document-knowledge-management/lib/documentFolderUtils'
import { listAllKbEntries } from '@/lib/api/tectonaKbApi'
import { findRepositoryTraceEntryByDocumentId } from '@/lib/kb/repositoryKbFromDocument'
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu'
import { EnterpriseDeleteConfirmModal } from '@/components/enterprise/EnterpriseDeleteConfirmModal'
import { DocumentOnlyOfficeEditor } from '@/modules/document-knowledge-management/components/DocumentOnlyOfficeEditor'
import {
  DocumentRepositoryPaginationControls,
  DocumentRepositoryTableView,
} from '@/modules/document-knowledge-management/components/DocumentRepositoryTableView'
import {
  mapDocumentToRepositoryItem,
  type RepositoryItem,
} from '@/modules/document-knowledge-management/lib/documentRepositoryPresentation'
import { generateIdeaDocKb } from '@/modules/project-management/lib/ideaDocKbGeneration'
import {
  measureProjectPanelHeight,
  PROJECT_PANEL_MIN_HEIGHT_PX,
} from '@/modules/projects/lib/projectPanelLayout'
import { Label } from '@/components/ui/label'
import {
  extractScoringDimensions,
  getIdeaById,
  patchIdea,
  getPersistentIdeaSummary,
  getPersistentIdeaIntegration,
  upsertPersistentIdeaIntegration,
  getPersistentIdeaC4Architecture,
  upsertPersistentIdeaC4Architecture,
  getPersistentIdeaProcessDiagram,
  upsertPersistentIdeaProcessDiagram,
  type ScoringResponseApi,
  upsertPersistentIdeaSummary,
  toBackendStatus,
  toDisplayStatus,
  type IdeaApi,
  type IdeaSummaryPersistent,
} from '@/lib/api/ideaBacklogApi'
import { useTenantContextOptional } from '@/auth/TenantContext'
import { fetchIdentityUsers, type IdentityUserDto } from '@/lib/api/identityAdminApi'
import { fetchWorkspaceOrgWorkspaceById } from '@/lib/api/workspaceOrgApi'
import { resolveWorkspaceApiId } from '@/lib/tenantWorkspaceScope'
import { workspaceScopedPath } from '@/lib/workspaceRouting'
import {
  fetchWorkspaceMembers,
  TECTONA_WAC_APP_ID,
  wacRoleCodeToUiRole,
  type WacMembershipDto,
} from '@/lib/api/workspaceAccessControlApi'
import { useTectonaPageContextReporter } from '@/lib/chat/useTectonaPageContextReporter'
import { extractProcessDiagramsFromText } from '@/lib/chat/extractProcessDiagrams'
import { AssistantMermaidBlock } from '@/modules/core-shell/components/AssistantMermaidBlock'
import { EditableIntegrationArchitectureCanvas } from '@/modules/project-management/components/EditableIntegrationArchitectureCanvas'
import { integrationArchimateNodeTypes } from '@/modules/project-management/components/integrationArchimateNodeTypes'
import { loadIntegrationGraph } from '@/modules/project-management/lib/integrationGraphStorage'
import { ReactFlow } from 'reactflow'
import { IdeaSectionReviewWorkspace } from '@/modules/project-management/components/IdeaSectionReviewWorkspace'
import {
  formatConversionReviewContent,
  formatCostBenefitReviewContent,
} from '@/modules/project-management/lib/ideaSectionReviewContent'
import {
  buildPersistentIntegrationPayload,
  EMPTY_RUNTIME_INTEGRATION_ANALYSIS,
  graphRecordFromIntegrationAnalysis,
  graphRecordFromPersistentIntegration,
  runtimeIntegrationFromAgentResponse,
  runtimeIntegrationFromPersistent,
  type RuntimeIntegrationAnalysis,
} from '@/modules/project-management/lib/integrationArchitectureService'
import type { IntegrationGraphRecord } from '@/modules/project-management/lib/integrationGraphStorage'
import { saveIntegrationGraph } from '@/modules/project-management/lib/integrationGraphStorage'
import {
  buildPersistentC4Payload,
  emptyRuntimeC4Analysis,
  runtimeC4FromAgentResponse,
  runtimeC4FromPersistent,
  type RuntimeC4Analysis,
} from '@/modules/project-management/lib/c4ArchitectureService'
import { usePlantUmlPngPreview } from '@/modules/project-management/lib/usePlantUmlPngPreview'
import {
  buildPersistentProcessDiagramPayload,
  emptyRuntimeProcessDiagramAnalysis,
  runtimeProcessDiagramFromAgentResponse,
  runtimeProcessDiagramFromPersistent,
  type RuntimeProcessDiagramAnalysis,
} from '@/modules/project-management/lib/processDiagramService'
import {
  IdeaConversionGanttToolbar,
  IdeaConversionGanttWorkspace,
} from '@/modules/project-management/components/IdeaConversionTimeline'
import type { PlanningGanttZoomLevel } from '@/modules/planning-scheduling/components/PlanningSvarGantt'
import { ManageCustomStatusesModal } from '@/modules/project-management/components/ManageCustomStatusesModal'
import { ManageActionControlListModal } from '@/modules/project-management/components/ManageActionControlListModal'
import {
  DEFAULT_IDEA_NAV_SECTIONS,
  getIdeaPanelCatalogEntry,
  resolveIdeaNavSections,
  type IdeaPanelKey,
} from '@/modules/project-management/lib/ideaPanelCatalog'
import { useIdeaNavSectionsStore } from '@/modules/project-management/store/ideaNavSectionsStore'
import { DEFAULT_RIGHT_DRAWER_WIDTH, useRightDrawerStore } from '@/stores/right-drawer-store'

type IdeaStatus = 'New Submission' | 'Under Review' | 'Approved' | 'Rejected' | 'Converted to Project'
type IdeaType = 'Innovation' | 'Improvement' | 'Request' | 'Transformation' | 'Issue'

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

type PanelKey = IdeaPanelKey

type BrdSection = {
  key: string
  title: string
  content: string
}

const IDEA_TYPES: IdeaType[] = ['Innovation', 'Improvement', 'Request', 'Transformation', 'Issue']
const WORKSPACE_GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i


function isWorkspaceUuid(value: string | null | undefined): value is string {
  const trimmed = value?.trim()
  return !!trimmed && WORKSPACE_GUID_RE.test(trimmed)
}

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
    reviewer: api.assignee_id?.trim() ?? '',
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

/** Pull supporting-doc bullets / file refs from idea description for the Document panel. */
function extractSupportingDocumentsFromText(text: string): string[] {
  const src = (text || '').trim()
  if (!src) return []

  const sectionMatch = src.match(
    /(?:^|\n)\s*(?:#{1,6}\s*)?(?:Dokumen Pendukung|Supporting Documents)\s*\n([\s\S]*?)(?=\n\s*(?:#{1,6}\s*)?(?:Tujuan|Permasalahan|Solusi|Risiko|Objective|Problem Statement|Solution|Risk)\b|\n\s*#{1,3}\s+\S|$)/i,
  )
  const chunk = sectionMatch?.[1] ?? ''
  const items: string[] = []

  const pushUnique = (value: string) => {
    const cleaned = value.replace(/\s+/g, ' ').trim()
    if (!cleaned) return
    if (items.some((existing) => existing.toLowerCase() === cleaned.toLowerCase())) return
    items.push(cleaned)
  }

  for (const line of chunk.split('\n')) {
    const bullet = line.match(/^\s*(?:[-*]|\d+[.)])\s+(.+)$/)
    if (bullet) pushUnique(bullet[1])
  }

  for (const match of src.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    pushUnique(`${match[1]} - ${match[2]}`)
  }

  for (const match of src.matchAll(/\b[\w./-]+\.(?:pdf|docx?|xlsx?|pptx?|md)\b/gi)) {
    pushUnique(match[0])
  }

  return items.slice(0, 40)
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
  confidence_score: 0,
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

function hasNumericIntakeScoring(idea: Idea): boolean {
  const { businessValue, effort, risk, roi } = idea.scoring
  return businessValue > 0 || effort > 0 || risk > 0 || roi > 0
}

function displaySummaryOverallScore(raw: string | undefined, idea: Idea): string {
  const value = (raw ?? '').trim()
  if (!hasNumericIntakeScoring(idea) && (value === '' || value === '44' || value === '44.0')) {
    return '—'
  }
  return value || '—'
}

function displaySummaryPriority(raw: string | undefined, idea: Idea): string {
  const value = (raw ?? '').trim()
  if (
    !hasNumericIntakeScoring(idea) &&
    ['High Priority', 'Medium Priority', 'Low Priority', 'High', 'Medium', 'Low'].includes(value)
  ) {
    return 'Pending scoring'
  }
  return value || '—'
}

function displaySummaryDecisionBias(raw: string | undefined, idea: Idea): string {
  const value = (raw ?? '').trim()
  if (!hasNumericIntakeScoring(idea) && ['Accelerate', 'Balance', 'Caution'].includes(value)) {
    return 'Awaiting scores'
  }
  return value || '—'
}

function displaySummaryKpiCard<T extends { label: string; value: string; detail: string }>(card: T, idea: Idea): T {
  if (hasNumericIntakeScoring(idea)) return card
  const label = card.label.toLowerCase()
  const value = card.value.trim()
  if (label.includes('composite') && (value === '44' || value === '44.0')) {
    return {
      ...card,
      value: 'Pending',
      detail: 'Composite is not calculated from empty BV/ROI/Effort/Risk scores.',
    }
  }
  if (label.includes('sla') && ['-35%', '-25%', '-15%', '-10%'].includes(value)) {
    return {
      ...card,
      value: 'Pending',
      detail: 'SLA target is not derived from 0/10 scores.',
    }
  }
  if (label.includes('priority') && ['high', 'medium', 'low', 'watch'].includes(value.toLowerCase())) {
    return {
      ...card,
      value: 'Pending',
      detail: 'Priority band waits for backlog score dimensions.',
    }
  }
  return card
}

function weightedIntakeScore(idea: Idea): number | null {
  if (!hasNumericIntakeScoring(idea)) return null
  const { businessValue, effort, risk, roi } = idea.scoring
  return businessValue * 3 + roi * 3 + (11 - effort) * 2 + (11 - risk) * 2
}

function buildIdeaSummaryFallback(idea: Idea): RuntimeSummaryResponse {
  const totalScore = weightedIntakeScore(idea)
  const priority = totalScore == null
    ? 'Pending scoring'
    : totalScore >= 80
      ? 'High Priority'
      : totalScore >= 60
        ? 'Medium Priority'
        : 'Low Priority'
  const decisionBias = totalScore == null
    ? 'Awaiting scores'
    : totalScore >= 80
      ? 'Accelerate'
      : totalScore >= 60
        ? 'Shape First'
        : 'Refine First'
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
      overall_score: totalScore == null ? '' : String(totalScore),
      decision_bias: decisionBias,
      decision_bias_detail: totalScore == null
        ? 'Intake scores are still empty, so no composite overall score is calculated.'
        : 'This local fallback is generated directly from the active idea attributes and intake scores.',
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
      badge: totalScore != null && totalScore >= 60 ? 'Reviewable' : 'Needs Refinement',
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
    confidence_score: 0,
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

const IDEA_SUMMARY_LIQUID_GLASS_SHELL =
  'liquid-glass-enterprise-filter-bar flex min-h-0 flex-col overflow-hidden border'

const IDEA_SUMMARY_LIQUID_GLASS_CARD =
  'relative overflow-hidden rounded-2xl border border-white/50 bg-white/35 shadow-[0_30px_80px_-46px_rgba(15,23,42,0.4)] backdrop-blur-2xl'

const IDEA_SUMMARY_LIQUID_GLASS_INNER =
  'rounded-2xl border border-white/70 bg-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_12px_28px_-20px_rgba(15,23,42,0.35)] backdrop-blur-xl'

const IDEA_SUMMARY_LIQUID_GLASS_TILE =
  'rounded-2xl border border-white/60 bg-white/40 backdrop-blur-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]'

const IDEA_SUMMARY_LIQUID_GLASS_AGENTS_BAR =
  'rounded-2xl border border-white/55 bg-white/25 px-4 py-3 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_12px_32px_-24px_rgba(15,23,42,0.2)]'

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
  confidence_score: number
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
  confidence_score: 0,
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

function agentConfidencePercent(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 0 && value <= 1) return Math.round(value * 100)
    if (value > 1 && value <= 100) return Math.round(value)
  }
  if (typeof value === 'string') {
    const raw = value.trim().replace(/%$/, '')
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) return agentConfidencePercent(parsed)
  }
  return 0
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
    confidence_score: agentConfidencePercent(
      payload.analysis_confidence ?? payload.confidence_score ?? payload.confidence,
    ) / 100,
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
    '{"status":"ok|insufficient_data","analysis_confidence":0.0,"summary_title":"","executive_brief":"","priority":"","overall_score":"","score_posture":"","decision_bias":"","decision_bias_detail":"","primary_strength":"","primary_strength_detail":"","execution_posture":"","execution_posture_detail":"","main_watchpoint":"","main_watchpoint_detail":"","recommended_action":"","commentary":"","positive_signal_title":"","positive_signal_detail":"","watchpoint_signal_title":"","watchpoint_signal_detail":"","missing_fields":[""],"kpi_cards":[{"label":"","value":"","detail":""}]}',
    'Aturan:',
    '- analysis_confidence: 0.0–1.0 keyakinan analisa berdasarkan evidence nyata, bukan kelengkapan form.',
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

const intakeStatusClass = 'bg-slate-50 text-slate-700 border-slate-200'

const typeClass: Record<IdeaType, string> = {
  Innovation: 'bg-sky-100 text-sky-700 border-sky-200',
  Improvement: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Request: 'bg-violet-100 text-violet-700 border-violet-200',
  Transformation: 'bg-amber-100 text-amber-700 border-amber-200',
  Issue: 'bg-rose-100 text-rose-700 border-rose-200',
}

const typeAccent: Record<IdeaType, string> = {
  Innovation: '#0ea5e9',
  Improvement: '#10b981',
  Request: '#8b5cf6',
  Transformation: '#f59e0b',
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

function confidenceClass(value: number) {
  if (value >= 90) return 'text-emerald-700 bg-emerald-50 border-emerald-200'
  if (value >= 80) return 'text-blue-700 bg-blue-50 border-blue-200'
  if (value >= 70) return 'text-amber-700 bg-amber-50 border-amber-200'
  return 'text-rose-700 bg-rose-50 border-rose-200'
}

type ScoringDimensionKey = 'businessValue' | 'effort' | 'risk' | 'roi'

type ScoringDimensionRow = {
  key: ScoringDimensionKey
  label: string
  score: number
  fill: string
  fillMuted: string
  detail: string
  borderClass: string
  bgClass: string
  textClass: string
  barTrackClass: string
}

const SCORING_DIMENSION_THEMES: Record<
  ScoringDimensionKey,
  Omit<ScoringDimensionRow, 'key' | 'score'> & { weightLabel: string; weightPercent: string }
> = {
  businessValue: {
    label: 'Business Value',
    fill: '#5f7de0',
    fillMuted: '#b8c7f2',
    detail: 'Enterprise upside and strategic relevance.',
    borderClass: 'border-[#5f7de0]/30',
    bgClass: 'bg-[#5f7de0]/10',
    textClass: 'text-[#4f6bd0]',
    barTrackClass: 'bg-[#5f7de0]/15',
    weightLabel: 'Value weight',
    weightPercent: '30%',
  },
  effort: {
    label: 'Effort',
    fill: '#e2a234',
    fillMuted: '#f3d38a',
    detail: 'Delivery load required to operationalize the idea.',
    borderClass: 'border-[#e2a234]/35',
    bgClass: 'bg-[#e2a234]/12',
    textClass: 'text-[#b45309]',
    barTrackClass: 'bg-[#e2a234]/18',
    weightLabel: 'Effort adjuster',
    weightPercent: '20%',
  },
  risk: {
    label: 'Risk',
    fill: '#d97706',
    fillMuted: '#fdba74',
    detail: 'Execution exposure and governance watchpoints.',
    borderClass: 'border-[#d97706]/35',
    bgClass: 'bg-[#d97706]/10',
    textClass: 'text-[#c2410c]',
    barTrackClass: 'bg-[#d97706]/15',
    weightLabel: 'Risk adjuster',
    weightPercent: '20%',
  },
  roi: {
    label: 'ROI',
    fill: '#4f46e5',
    fillMuted: '#c4b5fd',
    detail: 'Commercial return signal and payback strength.',
    borderClass: 'border-[#4f46e5]/30',
    bgClass: 'bg-[#4f46e5]/10',
    textClass: 'text-[#4338ca]',
    barTrackClass: 'bg-[#4f46e5]/15',
    weightLabel: 'ROI weight',
    weightPercent: '30%',
  },
}

/** Single display order for weight cards, dimension cards, and chart — Value → ROI → Effort → Risk. */
const SCORING_DISPLAY_ORDER: ScoringDimensionKey[] = ['businessValue', 'roi', 'effort', 'risk']

function buildScoreDataFromIdea(idea: Idea): ScoringDimensionRow[] {
  return SCORING_DISPLAY_ORDER.map((key) => {
    const theme = SCORING_DIMENSION_THEMES[key]
    return {
      key,
      label: theme.label,
      score: idea.scoring[key],
      fill: theme.fill,
      fillMuted: theme.fillMuted,
      detail: theme.detail,
      borderClass: theme.borderClass,
      bgClass: theme.bgClass,
      textClass: theme.textClass,
      barTrackClass: theme.barTrackClass,
    }
  })
}

function scoringBarFill(item: ScoringDimensionRow, hasNumericScoring: boolean): string {
  if (hasNumericScoring && item.score > 0) return item.fill
  return item.fillMuted
}

function scoringBarWidth(item: ScoringDimensionRow, hasNumericScoring: boolean): string {
  if (hasNumericScoring && item.score > 0) return `${(item.score / 10) * 100}%`
  return '12%'
}

type ScoringEvidenceItem = {
  id: string
  label: string
  detail: string
  complete: boolean
  ctaPanel?: PanelKey
  ctaBacklog?: boolean
}

function ideaHasNumericScoring(idea: Idea): boolean {
  const { businessValue, effort, risk, roi } = idea.scoring
  if (businessValue > 0 || effort > 0 || risk > 0 || roi > 0) return true
  return (idea.latestScoring?.score_dimensions ?? []).some((dimension) => dimension.score > 0)
}

function buildScoringEvidenceChecklist(idea: Idea): ScoringEvidenceItem[] {
  return [
    {
      id: 'title',
      label: 'Idea title',
      detail: 'Clear naming for board prioritization.',
      complete: Boolean(idea.title.trim()),
      ctaPanel: 'summary',
    },
    {
      id: 'description',
      label: 'Problem & solution narrative',
      detail: 'Description that explains the business need.',
      complete: Boolean(idea.description.trim()),
      ctaPanel: 'summary',
    },
    {
      id: 'business_objective',
      label: 'Business objective',
      detail: 'Expected outcome and value hypothesis.',
      complete: Boolean((idea.businessObjective ?? '').trim()),
      ctaPanel: 'summary',
    },
    {
      id: 'scope',
      label: 'Scope summary',
      detail: 'In/out boundaries for feasibility scoring.',
      complete: Boolean((idea.scopeSummary ?? '').trim()),
      ctaPanel: 'summary',
    },
    {
      id: 'risk',
      label: 'Risk summary',
      detail: 'Execution and governance watchpoints.',
      complete: Boolean((idea.riskSummary ?? '').trim()),
      ctaPanel: 'summary',
    },
    {
      id: 'dimensions',
      label: 'Backlog score dimensions',
      detail: 'Value, effort, risk, and ROI from Idea & Backlog.',
      complete: ideaHasNumericScoring(idea),
      ctaBacklog: true,
    },
  ]
}

type CostBenefitEvidenceItem = {
  id: string
  label: string
  detail: string
  complete: boolean
  ctaPanel?: PanelKey
  ctaBacklog?: boolean
}

type CostBenefitValueEffortPosture = {
  label: string
  description: string
  accent: string
  quadrant: string
}

type BenefitScenarioBand = {
  name: string
  roiLabel: string
  description?: string
}

function hasBenefitFinancialEvidence(analysis: GenerateBenefitAnalysisResponse | null): boolean {
  if (!analysis) return false
  if (analysis.presentation_mode !== 'narrative') return true
  return (
    analysis.total_development_cost > 0 ||
    analysis.total_benefit_5year > 0 ||
    analysis.total_cost_5year > 0
  )
}

function buildCostBenefitEvidenceChecklist(
  idea: Idea,
  benefitAnalysis: GenerateBenefitAnalysisResponse | null,
  supportingDocCount: number,
): CostBenefitEvidenceItem[] {
  return [
    {
      id: 'financial',
      label: 'Financial evidence',
      detail: 'Absolute cost/benefit figures from Idea, scoring, or knowledge base.',
      complete: hasBenefitFinancialEvidence(benefitAnalysis),
      ctaPanel: 'summary',
    },
    {
      id: 'dimensions',
      label: 'Scoring dimensions',
      detail: 'Business value, effort, risk, and ROI as finance proxy inputs.',
      complete: ideaHasNumericScoring(idea),
      ctaPanel: 'scoring',
    },
    {
      id: 'assumptions',
      label: 'Business assumptions',
      detail: 'Objective, scope, and risk framing for the cost narrative.',
      complete:
        Boolean((idea.businessObjective ?? '').trim()) &&
        Boolean((idea.scopeSummary ?? '').trim()) &&
        Boolean((idea.riskSummary ?? '').trim()),
      ctaPanel: 'summary',
    },
    {
      id: 'documents',
      label: 'Supporting documents',
      detail: 'Finance notes, BRD, or templates linked to this idea.',
      complete: supportingDocCount > 0,
      ctaPanel: 'document',
    },
  ]
}

function buildCostBenefitValueEffortPosture(
  idea: Idea,
  hasNumericScoring: boolean,
): CostBenefitValueEffortPosture {
  if (!hasNumericScoring) {
    return {
      label: 'Awaiting scoring',
      description: 'Value–effort positioning unlocks after backlog dimensions are populated.',
      accent: '#94a3b8',
      quadrant: 'Pending evidence',
    }
  }

  const { businessValue, effort } = idea.scoring
  const valueHigh = businessValue >= 6
  const effortLow = effort <= 5

  if (valueHigh && effortLow) {
    return {
      label: 'Quick win candidate',
      description: 'Strong relative value with manageable delivery effort — good for phased funding.',
      accent: '#10b981',
      quadrant: 'High value · Lower effort',
    }
  }
  if (valueHigh && !effortLow) {
    return {
      label: 'Strategic bet',
      description: 'Compelling upside but heavier delivery — fund governance and change enablement upfront.',
      accent: '#6366f1',
      quadrant: 'High value · Higher effort',
    }
  }
  if (!valueHigh && effortLow) {
    return {
      label: 'Operational tune-up',
      description: 'Modest strategic lift with lighter delivery — validate incremental benefit clearly.',
      accent: '#0ea5e9',
      quadrant: 'Moderate value · Lower effort',
    }
  }
  return {
    label: 'Reframe or defer',
    description: 'Value thesis is thin relative to effort — tighten scope or strengthen evidence first.',
    accent: '#f59e0b',
    quadrant: 'Lower value · Higher effort',
  }
}

function buildCostBenefitQualitativeLevers(
  idea: Idea,
  benefitAnalysis: GenerateBenefitAnalysisResponse | null,
): { costDrivers: string[]; benefitLevers: string[] } {
  const extended = benefitAnalysis as GenerateBenefitAnalysisResponse & {
    recommendations?: string[]
    key_risks_to_monitor?: string[]
  }

  const costDrivers = [
    idea.scoring.effort >= 7
      ? 'Delivery effort and cross-team coordination load'
      : 'Implementation, integration, and rollout effort',
    idea.scoring.risk >= 7
      ? 'Governance, compliance, and model drift monitoring'
      : 'Change adoption and operating ownership design',
    'Data quality, workflow redesign, and enablement funding',
  ]

  const benefitLevers = [
    idea.scoring.businessValue >= 6
      ? 'Earlier intervention timing and process efficiency gains'
      : 'Incremental visibility and coordination improvements',
    idea.scoring.roi >= 6
      ? 'Reduced escalation cost and rework avoidance'
      : 'Clearer stakeholder signals before cases turn critical',
    'Stronger executive control over operational variance',
  ]

  if (extended?.key_risks_to_monitor?.[0]) {
    costDrivers[0] = extended.key_risks_to_monitor[0]
  }
  if (extended?.recommendations?.[0]) {
    benefitLevers[0] = extended.recommendations[0]
  }

  return {
    costDrivers: costDrivers.slice(0, 3),
    benefitLevers: benefitLevers.slice(0, 3),
  }
}

function buildCostBenefitScenarioBands(
  benefitAnalysis: GenerateBenefitAnalysisResponse | null,
): BenefitScenarioBand[] {
  const extended = benefitAnalysis as GenerateBenefitAnalysisResponse & {
    scenarios?: Array<{
      name?: string
      scenario_name?: string
      roi_percentage?: number
      description?: string
      label?: string
    }>
  }

  const scenarios = extended?.scenarios ?? []
  if (scenarios.length === 0) return []

  return scenarios.slice(0, 3).map((scenario, index) => {
    const name = scenario.name || scenario.scenario_name || scenario.label || `Scenario ${index + 1}`
    const roi = scenario.roi_percentage
    return {
      name,
      roiLabel: typeof roi === 'number' && roi > 0 ? `${roi.toFixed(0)}% ROI (hipotesis)` : 'Qualitative band',
      description: scenario.description,
    }
  })
}

function buildCostBenefitUpgradeHint(
  evidenceItems: CostBenefitEvidenceItem[],
  confidencePercent: number,
): string {
  const incomplete = evidenceItems.filter((item) => !item.complete)
  if (incomplete.length === 0) {
    return 'Evidence cukup lengkap — regenerate analysis untuk meningkatkan confidence model numerik.'
  }
  const labels = incomplete.map((item) => item.label.toLowerCase()).join(', ')
  return `Lengkapi ${labels}, lalu regenerate analysis untuk menaikkan confidence dari ${confidencePercent}%.`
}

function CostBenefitEvidenceSection({
  evidenceItems,
  readinessPercent,
  onNavigateToPanel,
  onOpenBacklog,
}: {
  evidenceItems: CostBenefitEvidenceItem[]
  readinessPercent: number
  onNavigateToPanel: (panel: PanelKey) => void
  onOpenBacklog: () => void
}) {
  const completedCount = evidenceItems.filter((item) => item.complete).length

  return (
    <Card className={IDEA_SUMMARY_LIQUID_GLASS_CARD}>
      <CardContent className="relative z-10 space-y-3 p-3.5 sm:p-4">
        <div className="grid gap-3 border-b border-white/45 pb-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-white/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-900 backdrop-blur-md">
                <ClipboardList className="h-3.5 w-3.5" />
                Evidence readiness
              </div>
              <h3 className="text-sm font-semibold text-slate-950">Finance upgrade path</h3>
            </div>
            <p className="mt-1.5 text-xs leading-5 text-slate-600">
              Cost–benefit stays in narrative mode until the evidence below supports an honest numeric model.
            </p>
          </div>
          <div className="rounded-lg border border-white/65 bg-white/45 px-3 py-2 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="font-semibold text-slate-700">
                {completedCount}/{evidenceItems.length} signals ready
              </span>
              <span className="font-bold tabular-nums text-slate-900">{readinessPercent}%</span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/90"
              role="progressbar"
              aria-label="Cost benefit evidence readiness"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={readinessPercent}
            >
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-300',
                  readinessPercent === 100 ? 'bg-emerald-500' : 'bg-amber-500',
                )}
                style={{ width: `${readinessPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
          {evidenceItems.map((item) => (
            <div
              key={item.id}
              className={cn(
                'min-w-0 rounded-lg border px-3 py-2.5 backdrop-blur-md',
                item.complete
                  ? 'border-emerald-200/80 bg-emerald-50/40'
                  : cn(IDEA_SUMMARY_LIQUID_GLASS_TILE, 'border-white/60'),
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                {item.complete ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                )}
                <p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-900" title={item.label}>
                  {item.label}
                </p>
                {item.complete ? (
                  <span className="shrink-0 text-[10px] font-semibold uppercase text-emerald-700">Ready</span>
                ) : null}
                {!item.complete && item.ctaPanel ? (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto shrink-0 gap-0.5 px-0 py-0 text-[10px] font-semibold text-violet-700"
                    onClick={() => onNavigateToPanel(item.ctaPanel!)}
                  >
                    {item.ctaPanel === 'summary'
                      ? 'Complete Summary'
                      : item.ctaPanel === 'scoring'
                        ? 'Open Scoring'
                        : item.ctaPanel === 'document'
                          ? 'Open Docs'
                          : 'Open panel'}
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                ) : null}
                {!item.complete && item.ctaBacklog ? (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto shrink-0 gap-0.5 px-0 py-0 text-[10px] font-semibold text-violet-700"
                    onClick={onOpenBacklog}
                  >
                    Open Backlog
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                ) : null}
              </div>
              <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-slate-500">{item.detail}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function formatScoringDimensionValue(score: number, hasNumericScoring: boolean): string {
  if (!hasNumericScoring || score <= 0) return 'Pending'
  return `${score}/10`
}

function ScoringFrameworkSection({
  ideaTitle,
  scoreData,
  totalScore,
  hasNumericScoring,
  priorityLabel,
}: {
  ideaTitle: string
  scoreData: ScoringDimensionRow[]
  totalScore: number
  hasNumericScoring: boolean
  priorityLabel: string
}) {
  const scoreTierLabel = !hasNumericScoring
    ? 'Awaiting intake'
    : totalScore >= 80
      ? 'Executive ready'
      : totalScore >= 60
        ? 'Strategic candidate'
        : 'Needs refinement'

  return (
    <Card className={IDEA_SUMMARY_LIQUID_GLASS_CARD}>
      <CardContent className="relative z-10 space-y-4 p-4">
        <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-3.5')}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 backdrop-blur-md">
                <Gauge className="h-3.5 w-3.5" />
                Scoring framework
              </div>
              <p className="text-sm font-semibold text-slate-900 truncate">{ideaTitle}</p>
              <p className="text-[11px] text-slate-500">
                Weighted model for enterprise prioritization — numbers appear only when backlog evidence exists.
              </p>
            </div>
            <div className="flex flex-wrap items-stretch justify-end gap-2 shrink-0">
              <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_TILE, 'min-w-[168px] px-4 py-2.5 text-right')}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Weighted score</p>
                <p className="text-3xl font-bold text-slate-900 leading-none mt-1 tabular-nums">
                  {hasNumericScoring ? totalScore : '—'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  {hasNumericScoring ? priorityLabel : 'Pending intake scoring'}
                </p>
              </div>
              <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_TILE, 'flex min-w-[168px] flex-col justify-center gap-2 px-4 py-2.5')}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Decision signal</p>
                <Badge variant="outline" className={cn(
                  'w-fit text-[10px] font-semibold',
                  hasNumericScoring
                    ? totalScore >= 80
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : totalScore >= 60
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600',
                )}
                >
                  {scoreTierLabel}
                </Badge>
                <p className="text-[11px] leading-5 text-slate-600">
                  Decision SLA: target within 2 business days from intake review.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto pb-0.5">
            <div className="grid min-w-[640px] grid-cols-4 gap-3">
              {SCORING_DISPLAY_ORDER.map((key) => {
                const theme = SCORING_DIMENSION_THEMES[key]
                const item = scoreData.find((row) => row.key === key)
                if (!item) return null
                return (
                  <div key={key} className="flex min-w-0 flex-col gap-2">
                    <div
                      className={cn(
                        'rounded-lg border px-3 py-2',
                        theme.borderClass,
                        theme.bgClass,
                      )}
                    >
                      <p className={cn('text-[10px] font-medium uppercase tracking-wide', theme.textClass)}>
                        {theme.weightLabel}
                      </p>
                      <p className={cn('text-sm font-semibold tabular-nums', theme.textClass)}>{theme.weightPercent}</p>
                    </div>
                    <div
                      className={cn(
                        'flex flex-1 flex-col rounded-xl border px-3 py-2.5',
                        item.borderClass,
                        item.bgClass,
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className={cn('font-semibold', item.textClass)}>{item.label}</span>
                        <span className={cn(
                          'font-semibold tabular-nums',
                          hasNumericScoring && item.score > 0 ? item.textClass : 'text-slate-400',
                        )}
                        >
                          {formatScoringDimensionValue(item.score, hasNumericScoring)}
                        </span>
                      </div>
                      <div className={cn('h-2 overflow-hidden rounded-full', item.barTrackClass)}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: scoringBarWidth(item, hasNumericScoring),
                            backgroundColor: scoringBarFill(item, hasNumericScoring),
                          }}
                        />
                      </div>
                      <p className="mt-2 text-[10px] leading-4 text-slate-600">{item.detail}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'h-[150px] px-2 pb-2 pt-3')}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scoreData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tick={({ x, y, payload }) => {
                  const row = scoreData.find((item) => item.label === payload.value)
                  return (
                    <text x={x} y={y} dy={12} textAnchor="middle" fontSize={11} fill={row?.fill ?? '#64748b'}>
                      {payload.value}
                    </text>
                  )
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis domain={[0, 10]} ticks={[0, 3, 6, 10]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <RechartsTooltip
                formatter={(value, _name, props) => {
                  const row = props.payload as ScoringDimensionRow | undefined
                  const label = row?.label ?? 'Score'
                  const display = hasNumericScoring && Number(value) > 0 ? `${value}/10` : 'Pending'
                  return [display, label]
                }}
              />
              <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                {scoreData.map((row) => (
                  <Cell
                    key={row.label}
                    fill={scoringBarFill(row, hasNumericScoring)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function ScoringDraftReadinessCard({
  title,
  executiveBrief,
  missingFields,
  evidenceItems,
  readinessPercent,
  hasNumericScoring,
  onNavigateToPanel,
  onOpenBacklog,
}: {
  title: string
  executiveBrief: string
  missingFields: string[]
  evidenceItems: ScoringEvidenceItem[]
  readinessPercent: number
  hasNumericScoring: boolean
  onNavigateToPanel: (panel: PanelKey) => void
  onOpenBacklog: () => void
}) {
  const completedCount = evidenceItems.filter((item) => item.complete).length

  return (
    <Card className={IDEA_SUMMARY_LIQUID_GLASS_CARD}>
      <CardContent className="relative z-10 space-y-4 p-4">
        <div className="flex flex-col gap-3 border-b border-white/45 pb-4 lg:flex-row lg:items-start lg:gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-white/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-900 backdrop-blur-md">
              <ClipboardList className="h-3.5 w-3.5" />
              Draft readiness
            </div>
            <h3 className="text-base font-semibold text-slate-950">{title}</h3>
            <p className="w-full text-sm leading-6 text-slate-600">{executiveBrief}</p>
            {!hasNumericScoring ? (
              <p className="w-full text-xs text-amber-800">
                Backlog score dimensions are empty — the panel does not invent numbers until evidence is available.
              </p>
            ) : null}
          </div>
          <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_TILE, 'flex shrink-0 flex-col items-center gap-1 px-4 py-3 lg:mt-0')}>
            <div
              className="relative flex h-16 w-16 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(#f59e0b ${readinessPercent * 3.6}deg, #e2e8f0 0deg)`,
              }}
            >
              <div className="flex h-[52px] w-[52px] flex-col items-center justify-center rounded-full bg-white text-center">
                <span className="text-sm font-bold tabular-nums text-slate-900">{readinessPercent}%</span>
              </div>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">AI confidence</p>
            <p className="text-[11px] text-slate-600">{completedCount}/{evidenceItems.length} intake fields</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {evidenceItems.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex items-start gap-3 rounded-xl border px-3 py-2.5 backdrop-blur-md',
                item.complete
                  ? 'border-emerald-200/80 bg-emerald-50/40'
                  : cn(IDEA_SUMMARY_LIQUID_GLASS_TILE, 'border-white/60'),
              )}
            >
              {item.complete ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{item.detail}</p>
                {!item.complete && item.ctaPanel ? (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto px-0 py-0 mt-1 text-[11px] font-semibold text-violet-700"
                    onClick={() => onNavigateToPanel(item.ctaPanel!)}
                  >
                    Complete in Summary
                  </Button>
                ) : null}
                {!item.complete && item.ctaBacklog ? (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto px-0 py-0 mt-1 text-[11px] font-semibold text-violet-700"
                    onClick={onOpenBacklog}
                  >
                    Open Idea &amp; Backlog
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {missingFields.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Runtime missing signals</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{missingFields.join(', ')}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function DiagramGalleryCard({
  title,
  icon: Icon,
  description,
  imageSrc,
  imageLoading = false,
  imageError = null,
  missing,
  generationError,
  confidence,
  isRegenerating,
  onRegenerate,
}: {
  title: string
  icon: LucideIcon
  description: string
  imageSrc: string | null
  imageLoading?: boolean
  imageError?: string | null
  missing: boolean
  generationError: string | null
  confidence: number | null
  isRegenerating: boolean
  onRegenerate: () => void
}) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (!isFullscreen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isFullscreen])

  const hasDiagram = Boolean(imageSrc)

  return (
    <div className="flex flex-col rounded-2xl border border-border/40 bg-white/85 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-foreground" aria-hidden />
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        {typeof confidence === 'number' && confidence > 0 ? (
          <Badge variant="outline" className={cn('shrink-0 text-[10px] font-semibold', confidenceClass(confidence))}>
            {confidence}%
          </Badge>
        ) : null}
      </div>
      <div className="relative mt-2 h-32 overflow-hidden rounded-xl border border-border/30 bg-slate-50">
        {hasDiagram ? (
          <img
            src={imageSrc ?? undefined}
            alt={title}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-3 text-center text-[11px] text-muted-foreground">
            {isRegenerating || imageLoading ? (
              <>
                <RefreshCcw className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Building diagram…
              </>
            ) : imageError || generationError ? (
              <span className="text-rose-600">{imageError || generationError}</span>
            ) : missing ? (
              "AI couldn't produce a diagram — not enough evidence in this idea yet"
            ) : (
              'No diagram yet'
            )}
          </div>
        )}
        <button
          type="button"
          aria-label={`Open ${title}`}
          onClick={() => setIsFullscreen(true)}
          className="absolute inset-0 z-10"
        />
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{description}</p>

      {isFullscreen && (
        <div className="fixed inset-x-0 top-12 bottom-0 z-50">
          <div className="liquid-glass-enterprise-filter-bar flex h-full min-h-0 flex-col overflow-hidden rounded-none border-0 bg-background shadow-[0_18px_44px_rgba(15,23,42,0.12)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden px-4 pb-3 pt-2 lg:px-5 lg:pb-4 lg:pt-2">
              <div className="flex shrink-0 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                  <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {typeof confidence === 'number' && confidence > 0 ? (
                    <Badge variant="outline" className={cn('text-[10px] font-semibold', confidenceClass(confidence))}>
                      Confidence {confidence}%
                    </Badge>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={onRegenerate} disabled={isRegenerating}>
                    <RefreshCcw className={cn('mr-1.5 h-3.5 w-3.5', isRegenerating && 'animate-spin')} aria-hidden />
                    Regenerate
                  </Button>
                  <button
                    type="button"
                    aria-label={`Exit ${title} fullscreen`}
                    title="Exit fullscreen (Esc)"
                    onClick={() => setIsFullscreen(false)}
                    className={cn(
                      'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/40 hover:text-foreground',
                      enterpriseControlFocusClass,
                      'bg-foreground text-background hover:bg-foreground/90 hover:text-background',
                    )}
                  >
                    <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border/30 bg-slate-50 p-4">
                {imageSrc ? (
                  <img src={imageSrc} alt={title} className="mx-auto max-w-full" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
                    {isRegenerating || imageLoading ? (
                      <>
                        <RefreshCcw className="h-4 w-4 animate-spin" aria-hidden />
                        Building diagram…
                      </>
                    ) : imageError || generationError ? (
                      <span className="text-rose-600">{imageError || generationError}</span>
                    ) : missing ? (
                      "AI couldn't produce a diagram — not enough evidence in this idea yet"
                    ) : (
                      'No diagram yet'
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CollapsiblePanel({
  panelKey,
  title,
  description,
  isOpen,
  onToggle,
  showToggle = true,
  confidence,
  statusBadge,
  headerActions,
  fillHeight = false,
  immersive = false,
  children,
}: {
  panelKey: PanelKey
  title: string
  description: string
  isOpen: boolean
  onToggle: (key: PanelKey) => void
  showToggle?: boolean
  confidence?: number
  statusBadge?: { label: string; className: string }
  headerActions?: React.ReactNode
  fillHeight?: boolean
  immersive?: boolean
  children: React.ReactNode
}) {
  return (
    <Card
      className={cn(
        'liquid-glass-enterprise-panel rounded-2xl border-border/30 shadow-sm',
        fillHeight && 'flex h-full min-h-0 flex-col overflow-hidden',
        immersive && 'overflow-hidden',
      )}
    >
      {!immersive && (
      <CardHeader className={cn('pb-3', fillHeight && 'shrink-0')}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base leading-tight text-slate-900">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-border/40 bg-white/90">
                <Sparkles className="h-3 w-3 text-slate-600" />
              </span>
              {title}
            </CardTitle>
            <CardDescription className="mt-0.5 leading-tight">{description}</CardDescription>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {statusBadge ? (
              <Badge variant="outline" className={cn('text-[10px] font-semibold', statusBadge.className)}>
                {statusBadge.label}
              </Badge>
            ) : typeof confidence === 'number' ? (
              <Badge variant="outline" className={cn('text-[10px] font-semibold', confidenceClass(confidence))}>
                Confidence {confidence}%
              </Badge>
            ) : null}
            {headerActions}
            {showToggle && (
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => onToggle(panelKey)}>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      )}
      {isOpen && (
        <CardContent
          className={cn(
            immersive && 'min-h-0 flex-1 overflow-hidden p-0',
            !immersive &&
              fillHeight &&
              'min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
          )}
        >
          {children}
        </CardContent>
      )}
    </Card>
  )
}

const IDEA_DETAIL_SIDEBAR_STORAGE_KEY = 'idea-detail-context-sidebar-collapsed'
const IDEA_DETAIL_BRD_POLISH_MODE_STORAGE_KEY = 'idea-detail-brd-polish-mode'

const IDEA_STATUSES: IdeaStatus[] = [
  'New Submission',
  'Under Review',
  'Approved',
  'Rejected',
  'Converted to Project',
]

const IDEA_ACTION_CONTROLS_STORAGE_KEY = 'tectona-idea-detail-action-controls-v1'
const IDEA_ACTION_CONTROL_ORG_SHARES_KEY = 'tectona-idea-detail-org-shares-v1'
const IDEA_ORG_PUBLISHED_KEY = 'tectona-idea-org-published-v1'

type IdeaActionControlGroup = {
  id: string
  status: string
  role: string
  department: string
  reviewerUserId: string
  reviewerDisplayName: string
}

type IdeaActionControlStore = {
  panels: Partial<Record<PanelKey, IdeaActionControlGroup[]>>
  customStatuses: string[]
  customRoles: string[]
  customDepartments: string[]
  publishedToOrgAt?: string
  lastSubmittedAt?: string
}

type IdeaOrgPublishedRecord = {
  organization_id: string
  published_at: string
  published_by: string
}

type IdeaOrgShareRecord = {
  id: string
  organization_id: string
  idea_id: string
  idea_title: string
  submitted_by: string
  submitted_at: string
  panels: Partial<Record<PanelKey, IdeaActionControlGroup[]>>
  custom_statuses: string[]
  custom_roles: string[]
  custom_departments: string[]
}

function createActionControlGroup(): IdeaActionControlGroup {
  return {
    id: `ac-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: '',
    role: '',
    department: '',
    reviewerUserId: '',
    reviewerDisplayName: '',
  }
}

function normalizeActionControlGroup(raw: Partial<IdeaActionControlGroup> & { reviewerId?: string }): IdeaActionControlGroup {
  return {
    id: raw.id ?? createActionControlGroup().id,
    status: raw.status ?? '',
    role: typeof raw.role === 'string' ? raw.role : '',
    department: raw.department ?? '',
    reviewerUserId: raw.reviewerUserId ?? raw.reviewerId ?? '',
    reviewerDisplayName: raw.reviewerDisplayName ?? '',
  }
}

function defaultActionControlStore(seed?: Partial<IdeaActionControlStore>): IdeaActionControlStore {
  const panels = seed?.panels ?? {}
  const normalizedPanels = Object.fromEntries(
    Object.entries(panels).map(([key, groups]) => [
      key,
      (groups ?? []).map((group) => normalizeActionControlGroup(group)),
    ]),
  ) as Partial<Record<PanelKey, IdeaActionControlGroup[]>>

  return {
    panels: normalizedPanels,
    customStatuses: seed?.customStatuses ?? [],
    customRoles: seed?.customRoles ?? [],
    customDepartments: seed?.customDepartments ?? [],
    publishedToOrgAt: seed?.publishedToOrgAt,
    lastSubmittedAt: seed?.lastSubmittedAt,
  }
}

function readActionControlStore(ideaId: string): IdeaActionControlStore {
  if (typeof window === 'undefined') return defaultActionControlStore()
  try {
    const raw = localStorage.getItem(IDEA_ACTION_CONTROLS_STORAGE_KEY)
    if (!raw) return defaultActionControlStore()
    const parsed = JSON.parse(raw) as Record<string, IdeaActionControlStore>
    return defaultActionControlStore(parsed[ideaId])
  } catch {
    return defaultActionControlStore()
  }
}

function writeActionControlStore(ideaId: string, store: IdeaActionControlStore) {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(IDEA_ACTION_CONTROLS_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Record<string, IdeaActionControlStore>) : {}
    parsed[ideaId] = store
    localStorage.setItem(IDEA_ACTION_CONTROLS_STORAGE_KEY, JSON.stringify(parsed))
  } catch {
    // non-fatal
  }
}

function readIdeaOrgPublished(ideaId: string): IdeaOrgPublishedRecord | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(IDEA_ORG_PUBLISHED_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, IdeaOrgPublishedRecord>
    return parsed[ideaId] ?? null
  } catch {
    return null
  }
}

function writeIdeaOrgPublished(ideaId: string, record: IdeaOrgPublishedRecord) {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(IDEA_ORG_PUBLISHED_KEY)
    const parsed = raw ? (JSON.parse(raw) as Record<string, IdeaOrgPublishedRecord>) : {}
    parsed[ideaId] = record
    localStorage.setItem(IDEA_ORG_PUBLISHED_KEY, JSON.stringify(parsed))
  } catch {
    // non-fatal
  }
}

function appendOrgShareRecord(record: IdeaOrgShareRecord) {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(IDEA_ACTION_CONTROL_ORG_SHARES_KEY)
    const parsed = raw ? (JSON.parse(raw) as IdeaOrgShareRecord[]) : []
    parsed.unshift(record)
    localStorage.setItem(IDEA_ACTION_CONTROL_ORG_SHARES_KEY, JSON.stringify(parsed.slice(0, 200)))
  } catch {
    // non-fatal
  }
}

function groupsForPanel(store: IdeaActionControlStore, panel: PanelKey): IdeaActionControlGroup[] {
  const existing = store.panels[panel]
  if (existing && existing.length > 0) return existing
  return [createActionControlGroup()]
}

function remapActionControlFieldInPanels(
  panels: Partial<Record<PanelKey, IdeaActionControlGroup[]>>,
  field: 'status' | 'role' | 'department',
  fromValue: string,
  toValue: string,
): Partial<Record<PanelKey, IdeaActionControlGroup[]>> {
  const next: Partial<Record<PanelKey, IdeaActionControlGroup[]>> = {}
  for (const [key, groups] of Object.entries(panels)) {
    next[key as PanelKey] = (groups ?? []).map((group) => (
      group[field] === fromValue ? { ...group, [field]: toValue } : group
    ))
  }
  return next
}

function remapActionControlStatusInPanels(
  panels: Partial<Record<PanelKey, IdeaActionControlGroup[]>>,
  fromStatus: string,
  toStatus: string,
): Partial<Record<PanelKey, IdeaActionControlGroup[]>> {
  return remapActionControlFieldInPanels(panels, 'status', fromStatus, toStatus)
}

type ActionControlSidebarMode = 'hidden' | 'readonly' | 'editable'

function renderIdeaPanelWithOptionalFullscreen(
  isFullscreen: boolean,
  panel: React.ReactNode,
): React.ReactNode {
  if (isFullscreen) {
    // Deliberately NOT a `createPortal(..., document.body)` — matches every other fullscreen
    // idea-panel wrapper in this file (Integration, Cost Benefit, Conversion, Idea Docs — all
    // plain `fixed inset-x-0 top-12 bottom-0 z-50` in place). `#root` (the whole React app's
    // mount node) has its own `position: relative; z-index: 1`, which makes it a stacking
    // context — a portal to `document.body` escapes that context entirely and becomes a true
    // sibling of `#root`, so it always paints above EVERYTHING inside `#root` (topbar dropdowns,
    // chat/email panels, notifications, todo — all far higher z-index, but trapped inside
    // `#root`) regardless of what z-index is set here. Rendering in place keeps this panel inside
    // the same stacking context as that topbar UI, so z-50 vs. their z-60+ actually behaves as
    // intended: those menus render above it, the way "fullscreen content, chrome-level UI on top"
    // is supposed to work.
    return (
      <div className="fixed inset-x-0 top-12 bottom-0 z-50 flex min-h-0 w-screen flex-col overflow-hidden bg-background">
        {panel}
      </div>
    )
  }
  return panel
}

type IdeaDetailSidebarProps = {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  activePanel: PanelKey
  onNavigatePanel: (key: PanelKey) => void
  menuSections: PanelKey[]
  onReorderMenuSections: (orderedKeys: PanelKey[]) => void
  actionControlMode: ActionControlSidebarMode
  actionControlGroups: IdeaActionControlGroup[]
  customStatuses: string[]
  customRoles: string[]
  customDepartments: string[]
  onUpdateActionControlGroup: (groupId: string, patch: Partial<IdeaActionControlGroup>) => void
  onAddCustomStatus: (label: string) => void
  onUpdateCustomStatus: (previousLabel: string, nextLabel: string) => void
  onRemoveCustomStatus: (label: string) => void
  onAddCustomRole: (label: string) => void
  onUpdateCustomRole: (previousLabel: string, nextLabel: string) => void
  onRemoveCustomRole: (label: string) => void
  onAddCustomDepartment: (label: string) => void
  onUpdateCustomDepartment: (previousLabel: string, nextLabel: string) => void
  onRemoveCustomDepartment: (label: string) => void
  onPublishToOrganization: () => void
  isPublishingToOrganization: boolean
  canPublishToOrganization: boolean
  publishShareHint: string
  showManualPublishFooter: boolean
  orgWorkspaceNotice: string | null
  publishedAtLabel?: string | null
  onWidthChange: (width: number) => void
}

const enterpriseSidebarSelectClass = cn(
  'h-10 w-full appearance-none rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/90',
  'px-3.5 pr-9 text-[13px] font-medium tracking-tight text-slate-800',
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_1px_2px_rgba(15,23,42,0.05)]',
  'transition-[border-color,box-shadow,background-color] duration-200',
  'hover:border-slate-300 hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_2px_6px_rgba(15,23,42,0.06)]',
  'focus:border-primary/35 focus:outline-none focus:ring-2 focus:ring-primary/15',
  'disabled:cursor-not-allowed disabled:opacity-55',
  'dark:border-slate-700/70 dark:from-slate-900/50 dark:to-slate-950/40 dark:text-slate-100',
)

function ActionControlField({
  label,
  icon: Icon,
  action,
  children,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function ActionControlReadonlyBadge({
  value,
  emptyLabel,
  tone = 'neutral',
}: {
  value: string
  emptyLabel: string
  tone?: 'neutral' | 'status' | 'role' | 'department' | 'reviewer'
}) {
  const trimmed = value.trim()
  if (!trimmed) {
    return (
      <span className="inline-flex max-w-full items-center rounded-full border border-dashed border-slate-300/90 bg-slate-50/60 px-3 py-1 text-[11px] font-medium text-slate-400 dark:border-slate-600/70 dark:bg-slate-900/20 dark:text-slate-500">
        {emptyLabel}
      </span>
    )
  }

  const toneClass = {
    neutral: 'border-slate-200/90 bg-slate-100/90 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100',
    status: 'border-sky-200/90 bg-sky-50 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100',
    role: 'border-emerald-200/90 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100',
    department: 'border-violet-200/90 bg-violet-50 text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-100',
    reviewer: 'border-slate-300/90 bg-slate-900 text-white dark:border-slate-600 dark:bg-slate-100 dark:text-slate-900',
  }[tone]

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-tight',
        toneClass,
      )}
    >
      <span className="truncate">{trimmed}</span>
    </span>
  )
}

function ActionControlManageButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary transition-colors hover:bg-primary/8',
        enterpriseControlFocusClass(),
      )}
      onClick={onClick}
    >
      Manage
    </button>
  )
}

function ActionControlReviewerInfo({
  reviewerDisplayName,
  reviewerUserId,
  isEditable,
}: {
  reviewerDisplayName: string
  reviewerUserId: string
  isEditable: boolean
}) {
  const hasReviewer = Boolean(reviewerDisplayName.trim() || reviewerUserId.trim())
  if (hasReviewer) {
    return (
      <ActionControlReadonlyBadge
        value={reviewerDisplayName.trim() || reviewerUserId}
        emptyLabel="No reviewer yet"
        tone="reviewer"
      />
    )
  }

  return (
    <div className="rounded-xl border border-dashed border-amber-200/80 bg-amber-50/70 px-3.5 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/20">
      <p className="text-[12px] font-semibold text-amber-900 dark:text-amber-200">No reviewer yet</p>
      <p className="mt-1 text-[11px] leading-5 text-amber-800/90 dark:text-amber-200/80">
        {isEditable
          ? 'You will be recorded as the reviewer once you update Status, Role, or Department in this section.'
          : 'A reviewer appears here after an organization member completes Action & Control for this section.'}
      </p>
    </div>
  )
}

type ActionControlGroupCardProps = {
  group: IdeaActionControlGroup
  index: number
  isEditable: boolean
  statusOptions: string[]
  customRoles: string[]
  customDepartments: string[]
  onUpdateActionControlGroup: (groupId: string, patch: Partial<IdeaActionControlGroup>) => void
  onManageStatus: () => void
  onManageRole: () => void
  onManageDepartment: () => void
}

function ActionControlGroupCard({
  group,
  index,
  isEditable,
  statusOptions,
  customRoles,
  customDepartments,
  onUpdateActionControlGroup,
  onManageStatus,
  onManageRole,
  onManageDepartment,
}: ActionControlGroupCardProps) {
  const [expanded, setExpanded] = useState(false)
  const filledCount = [group.status, group.role, group.department].filter(Boolean).length

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-slate-200/75 bg-gradient-to-br from-white via-white to-slate-50/80 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.35)] dark:border-slate-800/70 dark:from-slate-900/45 dark:to-slate-950/50"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <button
        type="button"
        className={cn(
          'flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-900/30',
          expanded && 'border-b border-slate-100/90 dark:border-slate-800/60',
        )}
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls={`action-control-group-${group.id}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-6 min-w-[1.75rem] shrink-0 items-center justify-center rounded-lg bg-slate-900 px-1.5 text-[10px] font-bold tracking-wide text-white shadow-sm">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Control group
            </p>
            <p className="text-[10px] text-slate-400">{filledCount}/3 fields set</p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200',
            expanded && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div id={`action-control-group-${group.id}`} className="space-y-3.5 p-3.5 pt-3">
          <ActionControlField
            label="Status"
            icon={ClipboardList}
            action={isEditable ? <ActionControlManageButton onClick={onManageStatus} /> : undefined}
          >
            {isEditable ? (
              <div className="relative">
                <select
                  value={group.status}
                  onChange={(event) => onUpdateActionControlGroup(group.id, { status: event.target.value })}
                  className={enterpriseSidebarSelectClass}
                >
                  <option value="">Select status</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              </div>
            ) : (
              <ActionControlReadonlyBadge value={group.status} emptyLabel="No status yet" tone="status" />
            )}
          </ActionControlField>

          <ActionControlField
            label="Role"
            icon={Briefcase}
            action={isEditable ? <ActionControlManageButton onClick={onManageRole} /> : undefined}
          >
            {isEditable ? (
              <div className="relative">
                <select
                  value={group.role}
                  onChange={(event) => onUpdateActionControlGroup(group.id, { role: event.target.value })}
                  className={enterpriseSidebarSelectClass}
                >
                  <option value="">Select role</option>
                  {customRoles.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              </div>
            ) : (
              <ActionControlReadonlyBadge value={group.role} emptyLabel="No role yet" tone="role" />
            )}
          </ActionControlField>

          <ActionControlField
            label="Department"
            icon={Building2}
            action={isEditable ? <ActionControlManageButton onClick={onManageDepartment} /> : undefined}
          >
            {isEditable ? (
              <div className="relative">
                <select
                  value={group.department}
                  onChange={(event) => onUpdateActionControlGroup(group.id, { department: event.target.value })}
                  className={enterpriseSidebarSelectClass}
                >
                  <option value="">Select department</option>
                  {customDepartments.map((department) => (
                    <option key={department} value={department}>{department}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              </div>
            ) : (
              <ActionControlReadonlyBadge value={group.department} emptyLabel="No department yet" tone="department" />
            )}
          </ActionControlField>

          <ActionControlField label="Reviewer" icon={UserRound}>
            <ActionControlReviewerInfo
              reviewerDisplayName={group.reviewerDisplayName}
              reviewerUserId={group.reviewerUserId}
              isEditable={isEditable}
            />
          </ActionControlField>
        </div>
      ) : null}
    </div>
  )
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
            System Name: <span className="font-semibold">{title}</span>
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
function SortableIdeaNavItem({
  sectionKey,
  collapsed,
  active,
  onNavigate,
}: {
  sectionKey: PanelKey
  collapsed: boolean
  active: boolean
  onNavigate: (key: PanelKey) => void
}) {
  const item = getIdeaPanelCatalogEntry(sectionKey)
  const Icon = item.icon
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sectionKey,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && 'z-10 opacity-70')}>
      <Button
        type="button"
        variant="ghost"
        onClick={() => onNavigate(sectionKey)}
        className={cn(
          'group h-9 w-full justify-start gap-1 rounded-lg pr-2 pl-1',
          collapsed && 'justify-center px-0',
          active ? 'bg-primary/12 text-primary hover:bg-primary/15' : 'text-muted-foreground hover:text-foreground',
        )}
        title={collapsed ? item.label : undefined}
      >
        {!collapsed && (
          <span
            {...attributes}
            {...listeners}
            className="flex h-6 w-4 shrink-0 cursor-grab items-center justify-center text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
            aria-label={`Drag to reorder ${item.label}`}
            onClick={(event) => event.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
        )}
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Button>
    </div>
  )
}

function IdeaDetailSidebar({
  collapsed,
  onCollapsedChange,
  activePanel,
  onNavigatePanel,
  menuSections,
  onReorderMenuSections,
  actionControlMode,
  actionControlGroups,
  customStatuses,
  customRoles,
  customDepartments,
  onUpdateActionControlGroup,
  onAddCustomStatus,
  onUpdateCustomStatus,
  onRemoveCustomStatus,
  onAddCustomRole,
  onUpdateCustomRole,
  onRemoveCustomRole,
  onAddCustomDepartment,
  onUpdateCustomDepartment,
  onRemoveCustomDepartment,
  showManualPublishFooter,
  orgWorkspaceNotice,
  onPublishToOrganization,
  isPublishingToOrganization,
  canPublishToOrganization,
  publishShareHint,
  publishedAtLabel,
  onWidthChange,
}: IdeaDetailSidebarProps) {
  const asideRef = useRef<HTMLElement>(null)
  const activeMenu = getIdeaPanelCatalogEntry(activePanel)
  const isEditable = actionControlMode === 'editable'
  const isReadonly = actionControlMode === 'readonly'
  const showActionControl = isEditable || isReadonly
  const showActionControlSection = showActionControl || showManualPublishFooter || Boolean(orgWorkspaceNotice)
  const [statusManagerOpen, setStatusManagerOpen] = useState(false)
  const [roleManagerOpen, setRoleManagerOpen] = useState(false)
  const [departmentManagerOpen, setDepartmentManagerOpen] = useState(false)
  const statusOptions = useMemo(
    () => [...IDEA_STATUSES, ...customStatuses.filter((item) => !IDEA_STATUSES.includes(item as IdeaStatus))],
    [customStatuses],
  )
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useLayoutEffect(() => {
    const el = asideRef.current
    if (el) onWidthChange(el.getBoundingClientRect().width)
  }, [collapsed, onWidthChange])

  useEffect(() => {
    const el = asideRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) onWidthChange(width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [onWidthChange])

  const handleMenuDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = menuSections.indexOf(active.id as PanelKey)
    const newIndex = menuSections.indexOf(over.id as PanelKey)
    if (oldIndex === -1 || newIndex === -1) return
    onReorderMenuSections(arrayMove(menuSections, oldIndex, newIndex))
  }

  return (
    <aside
      ref={asideRef}
      className={cn(
        'fixed right-0 top-12 z-40 flex h-[calc(var(--app-vh,100vh)-3rem)] flex-col border-l border-slate-200/70',
        'bg-gradient-to-b from-slate-50/95 via-white to-slate-100/80 backdrop-blur-xl',
        'shadow-[-8px_0_32px_-12px_rgba(15,23,42,0.12)] transition-all duration-300 dark:border-slate-800/80 dark:from-slate-950/95 dark:via-slate-950 dark:to-slate-900/90',
        collapsed ? 'w-12' : 'w-72',
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border/20 p-2">
          {!collapsed && (
            <span className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Idea Menu
            </span>
          )}
          <div className={cn('flex items-center', collapsed ? 'w-full justify-center' : 'ml-auto')}>
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
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMenuDragEnd}>
            <SortableContext items={menuSections} strategy={verticalListSortingStrategy}>
              {menuSections.map((sectionKey) => (
                <SortableIdeaNavItem
                  key={sectionKey}
                  sectionKey={sectionKey}
                  collapsed={collapsed}
                  active={activePanel === sectionKey}
                  onNavigate={onNavigatePanel}
                                    />
                                  ))}
            </SortableContext>
          </DndContext>

          {!collapsed && showActionControlSection ? (
            <div className="mt-3 space-y-3 border-t border-slate-200/70 pt-3 dark:border-slate-800/70">
              <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white via-white to-slate-50/90 p-3 shadow-[0_10px_28px_-18px_rgba(15,23,42,0.28)] dark:border-slate-800/70 dark:from-slate-900/50 dark:to-slate-950/40">
                <div className="flex min-w-0 items-start gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.55)] ring-1 ring-white/10">
                    <Target className="h-4 w-4" aria-hidden />
                                </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                      Action & Control
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {activeMenu ? `${activeMenu.label} section` : 'Current section'}
                    </p>
                    {isReadonly ? (
                      <Badge
                        variant="outline"
                        className="mt-2 h-5 rounded-full border-slate-200/80 bg-slate-50 px-2 text-[10px] font-semibold text-slate-600"
                      >
                        Read-only
                      </Badge>
                    ) : null}
                    {isEditable ? (
                      <Badge
                        variant="outline"
                        className="mt-2 h-5 rounded-full border-emerald-200/80 bg-emerald-50 px-2 text-[10px] font-semibold text-emerald-700"
                      >
                        Reviewer mode
                      </Badge>
                    ) : null}
                              </div>
                            </div>
                    </div>

              {showManualPublishFooter && !showActionControl ? (
                <p className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2.5 text-[11px] leading-5 text-slate-500 dark:border-slate-800/70 dark:bg-slate-900/30 dark:text-slate-400">
                  Submit this idea to the organization to unlock Action & Control for organization reviewers.
                </p>
                    ) : null}

              {orgWorkspaceNotice && !showActionControl ? (
                <p className="rounded-xl border border-sky-200/70 bg-sky-50/80 px-3 py-2.5 text-[11px] leading-5 text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-100">
                  {orgWorkspaceNotice}
                    </p>
                  ) : null}

              {showActionControl ? actionControlGroups.map((group, index) => (
                <ActionControlGroupCard
                  key={group.id}
                  group={group}
                  index={index}
                  isEditable={isEditable}
                  statusOptions={statusOptions}
                  customRoles={customRoles}
                  customDepartments={customDepartments}
                  onUpdateActionControlGroup={onUpdateActionControlGroup}
                  onManageStatus={() => setStatusManagerOpen(true)}
                  onManageRole={() => setRoleManagerOpen(true)}
                  onManageDepartment={() => setDepartmentManagerOpen(true)}
                />
              )) : null}

              {publishedAtLabel ? (
                <p className="flex items-center gap-1.5 rounded-xl border border-emerald-200/70 bg-emerald-50/70 px-3 py-2 text-[11px] font-medium text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Published {publishedAtLabel}
                </p>
              ) : null}
                    </div>
          ) : null}
                  </div>

        {!collapsed && showManualPublishFooter ? (
          <div className="shrink-0 border-t border-slate-200/70 bg-gradient-to-t from-slate-100/90 via-white to-white p-3.5 backdrop-blur-md dark:border-slate-800/70 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
            <div className="mb-3 rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2.5 dark:border-slate-800/70 dark:bg-slate-900/40">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Organization</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">{publishShareHint}</p>
                      </div>
            <Button
              type="button"
                          className={cn(
                enterpriseCyanGradientActionButtonClass(),
                'h-11 w-full justify-center rounded-xl text-sm',
                (!canPublishToOrganization || isPublishingToOrganization) && 'opacity-55 saturate-75',
              )}
              disabled={!canPublishToOrganization || isPublishingToOrganization}
              onClick={onPublishToOrganization}
            >
              {isPublishingToOrganization ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <MoveRight className="h-4 w-4" />
                  Submit to organization
                </>
              )}
                  </Button>
                </div>
        ) : null}

        {!collapsed && orgWorkspaceNotice ? (
          <div className="shrink-0 border-t border-slate-200/70 bg-gradient-to-t from-sky-50/90 via-white to-white p-3.5 backdrop-blur-md dark:border-slate-800/70 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
            <div className="rounded-xl border border-sky-200/70 bg-sky-50/80 px-3 py-2.5 dark:border-sky-900/40 dark:bg-sky-950/20">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-800 dark:text-sky-200">
                    Organization workspace
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-sky-900/90 dark:text-sky-100/90">
                    {orgWorkspaceNotice}
                  </p>
        </div>
      </div>
            </div>
          </div>
        ) : null}
      </div>

      <ManageCustomStatusesModal
        open={statusManagerOpen}
        onClose={() => setStatusManagerOpen(false)}
        customStatuses={customStatuses}
        reservedStatuses={[...IDEA_STATUSES]}
        onCreateStatus={onAddCustomStatus}
        onUpdateStatus={onUpdateCustomStatus}
        onDeleteStatus={onRemoveCustomStatus}
      />
      <ManageActionControlListModal
        open={roleManagerOpen}
        onClose={() => setRoleManagerOpen(false)}
        title="Manage Roles"
        description="Add, rename, or delete organizational role titles used in Action & Control."
        placeholder="New role (e.g., Head of IT Architecture, Product Owner)..."
        emptyMessage="No roles yet. Add position titles that reviewers can select."
        footerNote="Note: roles describe the reviewer's position (not workspace access level). Changes apply to this idea's Action & Control catalog."
        items={customRoles}
        onCreateItem={onAddCustomRole}
        onUpdateItem={onUpdateCustomRole}
        onDeleteItem={onRemoveCustomRole}
      />
      <ManageActionControlListModal
        open={departmentManagerOpen}
        onClose={() => setDepartmentManagerOpen(false)}
        title="Manage Departments"
        description="Add, rename, or delete department options for Action & Control."
        placeholder="New department (e.g., IT Architecture, Operations)..."
        emptyMessage="No departments yet. Add departments reviewers can assign."
        footerNote="Note: department options are stored locally for this idea and shared with organization reviewers after publish."
        items={customDepartments}
        onCreateItem={onAddCustomDepartment}
        onUpdateItem={onUpdateCustomDepartment}
        onDeleteItem={onRemoveCustomDepartment}
      />
    </aside>
  )
}

/**
 * Simulated progress steps shown while generating a document from a template. The actual backend
 * pipeline runs a planning LLM call then a fill LLM call inside one request/response, so there is no
 * real granular progress signal to poll — this timed sequence mirrors the KB-generation progress
 * pattern used elsewhere in the app (Document Repository) rather than introducing a new job/polling
 * architecture just for this.
 */
const IDEA_DOC_GENERATE_STEPS = [
  { key: 'analyze', label: 'Analyzing template structure' },
  { key: 'plan', label: 'Planning content for each field' },
  { key: 'write', label: 'Writing document content' },
  { key: 'finish', label: 'Finalizing document' },
] as const

const IDEA_DOC_GENERATE_STEP_INTERVAL_MS = 2200

export function IdeaDetailPage() {
  const { ideaId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const tenant = useTenantContextOptional()
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

  const { options: userWorkspaceOptions } = useUserWorkspaceOptions()

  const [brdPages, setBrdPages] = useState<string[]>([''])
  const [ideaDocTemplates, setIdeaDocTemplates] = useState<DocumentTemplateResponse[]>([])
  const [ideaDocTemplatesLoading, setIdeaDocTemplatesLoading] = useState(false)
  const [ideaGeneratedDocs, setIdeaGeneratedDocs] = useState<DocumentResponse[]>([])
  const [ideaDocsLoading, setIdeaDocsLoading] = useState(false)
  const [ideaDocsPage, setIdeaDocsPage] = useState(1)
  const [ideaDocsPageSize, setIdeaDocsPageSize] = useState(10)
  const ideaDocsPanelRef = useRef<HTMLDivElement>(null)
  const [ideaDocsPanelHeightPx, setIdeaDocsPanelHeightPx] = useState<number | null>(null)
  const [isIdeaDocsPanelFullscreen, setIsIdeaDocsPanelFullscreen] = useState(false)
  const ideaConversionPanelRef = useRef<HTMLDivElement>(null)
  const [ideaConversionPanelHeightPx, setIdeaConversionPanelHeightPx] = useState<number | null>(null)
  const [isConversionPanelFullscreen, setIsConversionPanelFullscreen] = useState(false)
  const ideaSummaryPanelRef = useRef<HTMLDivElement>(null)
  const [ideaSummaryPanelHeightPx, setIdeaSummaryPanelHeightPx] = useState<number | null>(null)
  const [isSummaryPanelFullscreen, setIsSummaryPanelFullscreen] = useState(false)
  const ideaDiagramsPanelRef = useRef<HTMLDivElement>(null)
  const [ideaDiagramsPanelHeightPx, setIdeaDiagramsPanelHeightPx] = useState<number | null>(null)
  const [isDiagramsPanelFullscreen, setIsDiagramsPanelFullscreen] = useState(false)
  const ideaScoringPanelRef = useRef<HTMLDivElement>(null)
  const [ideaScoringPanelHeightPx, setIdeaScoringPanelHeightPx] = useState<number | null>(null)
  const [isScoringPanelFullscreen, setIsScoringPanelFullscreen] = useState(false)
  const ideaImpactPanelRef = useRef<HTMLDivElement>(null)
  const [ideaImpactPanelHeightPx, setIdeaImpactPanelHeightPx] = useState<number | null>(null)
  const [isImpactPanelFullscreen, setIsImpactPanelFullscreen] = useState(false)
  const [isIntegrationPanelFullscreen, setIsIntegrationPanelFullscreen] = useState(false)
  const ideaCostBenefitPanelRef = useRef<HTMLDivElement>(null)
  const [ideaCostBenefitPanelHeightPx, setIdeaCostBenefitPanelHeightPx] = useState<number | null>(null)
  const [isCostBenefitPanelFullscreen, setIsCostBenefitPanelFullscreen] = useState(false)
  const [ideaDocKbGeneratedIds, setIdeaDocKbGeneratedIds] = useState<Set<string>>(() => new Set())
  const [ideaDocContextMenu, setIdeaDocContextMenu] = useState<{ item: RepositoryItem; x: number; y: number } | null>(null)
  const [ideaDocDownloadBusyId, setIdeaDocDownloadBusyId] = useState<string | null>(null)
  const [ideaDocKbBusyId, setIdeaDocKbBusyId] = useState<string | null>(null)
  const [ideaDocRenameTarget, setIdeaDocRenameTarget] = useState<RepositoryItem | null>(null)
  const [ideaDocRenameValue, setIdeaDocRenameValue] = useState('')
  const [ideaDocRenameBusy, setIdeaDocRenameBusy] = useState(false)
  const [ideaDocDeleteTarget, setIdeaDocDeleteTarget] = useState<RepositoryItem | null>(null)
  const [ideaDocDeleteBusy, setIdeaDocDeleteBusy] = useState(false)
  const [ideaDocGenerateOpen, setIdeaDocGenerateOpen] = useState(false)
  const [ideaDocGenerateTemplateId, setIdeaDocGenerateTemplateId] = useState('')
  const [ideaDocGenerateSource, setIdeaDocGenerateSource] = useState('')
  const [ideaDocGenerateBusy, setIdeaDocGenerateBusy] = useState(false)
  const [ideaDocGenerateStepIndex, setIdeaDocGenerateStepIndex] = useState(0)
  const ideaDocGenerateTimerRef = useRef<number | null>(null)
  type IdeaDocFolderStackEntry = { id: string; name: string }
  const [ideaDocFolderStack, setIdeaDocFolderStack] = useState<IdeaDocFolderStackEntry[]>([])
  const [ideaDocSubfolders, setIdeaDocSubfolders] = useState<DocumentFolder[]>([])
  const [ideaDocFolderCreateBusy, setIdeaDocFolderCreateBusy] = useState(false)
  const [ideaDocFolderInitBusy, setIdeaDocFolderInitBusy] = useState(false)
  const [ideaDocFolderContextMenu, setIdeaDocFolderContextMenu] = useState<{
    folder: DocumentFolder
    x: number
    y: number
  } | null>(null)
  const [ideaDocFolderRenameTarget, setIdeaDocFolderRenameTarget] = useState<DocumentFolder | null>(null)
  const [ideaDocFolderRenameValue, setIdeaDocFolderRenameValue] = useState('')
  const [ideaDocFolderRenameBusy, setIdeaDocFolderRenameBusy] = useState(false)
  const [ideaDocFolderDeleteTarget, setIdeaDocFolderDeleteTarget] = useState<DocumentFolder | null>(null)
  const [ideaDocFolderDeleteBusy, setIdeaDocFolderDeleteBusy] = useState(false)
  const selectedIdeaDocGenerateTemplate = ideaDocTemplates.find((item) => item.id === ideaDocGenerateTemplateId) ?? null
  const ideaDocGenerateSourceChars = ideaDocGenerateSource.trim().length
  const [ideaDocEditId, setIdeaDocEditId] = useState<string | null>(null)
  const [ideaDocEditTitle, setIdeaDocEditTitle] = useState<string | null>(null)
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
          '1) Background\n- ...\n\n2) Objective\n- ...\n\n3) Scope\n- In scope: ...\n- Out of scope: ...\n\n4) Requirement\n- Functional:\n  - ...\n- Non-functional:\n  - ...\n\n5) Assumptions & Risks\n- ...\n\n6) Acceptance Criteria\n- ...',
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
    scoring: true,
    impact: true,
    diagrams: true,
    integration: true,
    process: true,
    c4Level1: true,
    c4Level2: true,
    bpmnHigh: true,
    costBenefit: true,
    conversion: true,
    document: true,
  })
  const [regenerating, setRegenerating] = useState<Record<PanelKey, boolean>>({
    summary: false,
    scoring: false,
    impact: false,
    diagrams: false,
    integration: false,
    process: false,
    c4Level1: false,
    c4Level2: false,
    bpmnHigh: false,
    costBenefit: false,
    conversion: false,
    document: false,
  })
  const [confidence, setConfidence] = useState<Record<PanelKey, number>>({
    summary: 0,
    scoring: 0,
    impact: 0,
    diagrams: 0,
    integration: 0,
    process: 0,
    c4Level1: 0,
    c4Level2: 0,
    bpmnHigh: 0,
    costBenefit: 0,
    conversion: 0,
    document: 0,
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

  const currentUserId = useMemo(() => getSession()?.user.id?.trim() ?? '', [])

  const currentUserDisplayName = useMemo(() => {
    if (currentUserId) {
      const resolved = resolveIdentityDisplayName(currentUserId)
      if (resolved) return resolved
    }
    const session = getSession()
    return session?.user.email?.split('@')[0]?.trim() ?? ''
  }, [currentUserId, resolveIdentityDisplayName])

  const isIdeaCreator = useMemo(() => {
    const ownerRaw = (idea.submittedBy ?? '').trim()
    if (!ownerRaw) return true
    if (currentUserId && ownerRaw === currentUserId) return true

    const ownerDisplay = resolveIdentityDisplayName(ownerRaw)
    if (
      currentUserDisplayName
      && ownerDisplay
      && currentUserDisplayName.toLowerCase() === ownerDisplay.toLowerCase()
    ) {
      return true
    }
    if (
      currentUserDisplayName
      && ownerRaw.toLowerCase() === currentUserDisplayName.toLowerCase()
    ) {
      return true
    }
    if (
      currentUserDisplayName
      && ownerRaw.toLowerCase().includes(currentUserDisplayName.toLowerCase())
    ) {
      return true
    }

    return !currentUserId
  }, [idea.submittedBy, currentUserId, currentUserDisplayName, resolveIdentityDisplayName])

  const reviewerDisplayName = useMemo(
    () => resolveIdentityDisplayName(idea.reviewer),
    [idea.reviewer, resolveIdentityDisplayName]
  )

  const [resolvedWorkspaceName, setResolvedWorkspaceName] = useState<string | null>(null)

  useEffect(() => {
    const raw = (idea.workspace ?? '').trim()
    if (!isWorkspaceUuid(raw)) {
      setResolvedWorkspaceName(null)
      return
    }

    const tenantName = tenant?.displayName?.trim()
    if (tenant?.workspaceId === raw && tenantName) {
      setResolvedWorkspaceName(tenantName)
      return
    }

    let cancelled = false
    void fetchWorkspaceOrgWorkspaceById(raw)
      .then((workspace) => {
        if (cancelled) return
        setResolvedWorkspaceName(workspace.name?.trim() || null)
      })
      .catch(() => {
        if (!cancelled) setResolvedWorkspaceName(null)
      })

    return () => {
      cancelled = true
    }
  }, [idea.workspace, tenant?.displayName, tenant?.workspaceId])

  const workspaceDisplayName = useMemo(() => {
    const raw = (idea.workspace ?? '').trim()
    if (!raw) return tenant?.displayName?.trim() || 'General'
    if (isWorkspaceUuid(raw)) {
      return resolvedWorkspaceName
        || (tenant?.workspaceId === raw ? tenant?.displayName?.trim() : null)
        || tenant?.displayName?.trim()
        || 'Organization workspace'
    }
    return raw
  }, [idea.workspace, tenant?.displayName, tenant?.workspaceId, resolvedWorkspaceName])

  const workspaceManagementPath = useMemo(
    () => workspaceScopedPath(tenant?.slug ?? null, '/workspace-management', tenant?.workspaceId),
    [tenant?.slug, tenant?.workspaceId],
  )
  const ideaBacklogPath = useMemo(
    () => workspaceScopedPath(tenant?.slug ?? null, '/idea-backlog', tenant?.workspaceId),
    [tenant?.slug, tenant?.workspaceId],
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
  const [conversionZoomLevel, setConversionZoomLevel] = useState<PlanningGanttZoomLevel>('Week')
  const [runtimeIntegrationAnalysis, setRuntimeIntegrationAnalysis] = useState<RuntimeIntegrationAnalysis>(
    EMPTY_RUNTIME_INTEGRATION_ANALYSIS,
  )
  const [integrationLoaded, setIntegrationLoaded] = useState(false)
  const [integrationMissing, setIntegrationMissing] = useState(false)
  const [integrationWarnings, setIntegrationWarnings] = useState<string[]>([])
  const [integrationGenerationError, setIntegrationGenerationError] = useState<string | null>(null)
  const [integrationBootstrapRecord, setIntegrationBootstrapRecord] = useState<IntegrationGraphRecord | null>(null)
  const [integrationBootstrapKey, setIntegrationBootstrapKey] = useState(0)
  const [integrationBriefExpanded, setIntegrationBriefExpanded] = useState(false)
  const [c4Level1Analysis, setC4Level1Analysis] = useState<RuntimeC4Analysis>(emptyRuntimeC4Analysis('L1'))
  const [c4Level1Loaded, setC4Level1Loaded] = useState(false)
  const [c4Level1Missing, setC4Level1Missing] = useState(false)
  const [c4Level1GenerationError, setC4Level1GenerationError] = useState<string | null>(null)
  const [c4Level2Analysis, setC4Level2Analysis] = useState<RuntimeC4Analysis>(emptyRuntimeC4Analysis('L2'))
  const [c4Level2Loaded, setC4Level2Loaded] = useState(false)
  const [c4Level2Missing, setC4Level2Missing] = useState(false)
  const [c4Level2GenerationError, setC4Level2GenerationError] = useState<string | null>(null)
  const c4Level1Preview = usePlantUmlPngPreview(c4Level1Analysis.plantumlSource)
  const c4Level2Preview = usePlantUmlPngPreview(c4Level2Analysis.plantumlSource)
  const [bpmnHighAnalysis, setBpmnHighAnalysis] = useState<RuntimeProcessDiagramAnalysis>(
    emptyRuntimeProcessDiagramAnalysis(),
  )
  const [bpmnHighLoaded, setBpmnHighLoaded] = useState(false)
  const [bpmnHighMissing, setBpmnHighMissing] = useState(false)
  const [bpmnHighGenerationError, setBpmnHighGenerationError] = useState<string | null>(null)
  type ProcessDetailState = {
    analysis: RuntimeProcessDiagramAnalysis
    loaded: boolean
    missing: boolean
    generationError: string | null
    isRegenerating: boolean
  }
  const [processDetailsByKey, setProcessDetailsByKey] = useState<Record<string, ProcessDetailState>>({})
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem(IDEA_DETAIL_SIDEBAR_STORAGE_KEY)
    return stored ? JSON.parse(stored) : false
  })
  // Idea Menu is a fixed right panel — float chat and reserve this sidebar width (same as Project Detail).
  const setRightDrawerOpen = useRightDrawerStore((s) => s.setOpen)
  const setRightDrawerWidth = useRightDrawerStore((s) => s.setWidth)
  useEffect(() => {
    setRightDrawerOpen(true)
    return () => {
      setRightDrawerOpen(false)
      setRightDrawerWidth(DEFAULT_RIGHT_DRAWER_WIDTH)
    }
  }, [setRightDrawerOpen, setRightDrawerWidth])
  const [activePanel, setActivePanel] = useState<PanelKey>('summary')
  const reorderIdeaMenuSections = useIdeaNavSectionsStore((state) => state.reorderSections)
  const savedMenuSections = useIdeaNavSectionsStore((state) => state.sectionsByIdea[idea.id])
  const menuSections = useMemo(
    () => resolveIdeaNavSections(savedMenuSections),
    [savedMenuSections],
  )
  const [actionControlStore, setActionControlStore] = useState<IdeaActionControlStore>(() => (
    readActionControlStore(initialIdea.id)
  ))
  const [isPublishingToOrganization, setIsPublishingToOrganization] = useState(false)

  useEffect(() => {
    setActionControlStore(readActionControlStore(idea.id))
  }, [idea.id])

  const persistActionControlStore = useCallback((next: IdeaActionControlStore) => {
    setActionControlStore(next)
    writeActionControlStore(idea.id, next)
  }, [idea.id])

  const activeActionControlGroups = useMemo(
    () => groupsForPanel(actionControlStore, activePanel),
    [actionControlStore, activePanel],
  )

  const actionControlReviewerLabel = useMemo(() => {
    for (const key of DEFAULT_IDEA_NAV_SECTIONS) {
      for (const group of groupsForPanel(actionControlStore, key)) {
        const displayName = group.reviewerDisplayName.trim()
        if (displayName) return displayName
        const userId = group.reviewerUserId.trim()
        if (userId) return resolveIdentityDisplayName(userId) || userId
      }
    }
    return ''
  }, [actionControlStore, resolveIdentityDisplayName])

  const hasActionControlActivity = useMemo(() => (
    DEFAULT_IDEA_NAV_SECTIONS.some((key) => {
      const groups = groupsForPanel(actionControlStore, key)
      return groups.some((group) => (
        Boolean(group.status.trim())
        || Boolean(group.role.trim())
        || Boolean(group.department.trim())
        || Boolean(group.reviewerDisplayName.trim())
        || Boolean(group.reviewerUserId.trim())
      ))
    })
  ), [actionControlStore])

  const headerStatusLabel = useMemo(() => {
    if (idea.status === 'Under Review' && !hasActionControlActivity) return 'Intake'
    return idea.status
  }, [idea.status, hasActionControlActivity])

  const headerStatusBadgeClass = headerStatusLabel === 'Intake'
    ? intakeStatusClass
    : statusClass[idea.status]

  const headerDisplayTags = useMemo(() => {
    const statusNorm = headerStatusLabel.trim().toLowerCase()
    return idea.tags.filter((tag) => tag.trim().toLowerCase() !== statusNorm)
  }, [idea.tags, headerStatusLabel])

  const ideaOrgPublishedRecord = useMemo(
    () => readIdeaOrgPublished(idea.id),
    [idea.id, actionControlStore.publishedToOrgAt],
  )

  const isOrganizationWorkspaceContext = useMemo(() => (
    tenant?.tenantMode === 'organization' && Boolean(tenant?.workspaceId)
  ), [tenant?.tenantMode, tenant?.workspaceId])

  const isIdeaPublishedToOrg = useMemo(() => {
    if (ideaOrgPublishedRecord?.organization_id && tenant?.orgId) {
      if (ideaOrgPublishedRecord.organization_id === tenant.orgId) return true
    }
    return Boolean(actionControlStore.publishedToOrgAt)
  }, [tenant?.orgId, ideaOrgPublishedRecord, actionControlStore.publishedToOrgAt])

  const isActionControlUnlocked = useMemo(() => {
    if (isOrganizationWorkspaceContext) return true
    if (!tenant?.orgId) return false
    return isIdeaPublishedToOrg
  }, [isOrganizationWorkspaceContext, tenant?.orgId, isIdeaPublishedToOrg])

  const actionControlSidebarMode = useMemo((): ActionControlSidebarMode => {
    if (!isActionControlUnlocked) return 'hidden'
    if (isOrganizationWorkspaceContext || tenant?.orgId) {
      return isIdeaCreator ? 'readonly' : 'editable'
    }
    return 'hidden'
  }, [isActionControlUnlocked, isOrganizationWorkspaceContext, tenant?.orgId, isIdeaCreator])

  const showActionControlManualPublishFooter = !isOrganizationWorkspaceContext && !isIdeaPublishedToOrg

  const canPublishIdeaToOrganization = Boolean(tenant?.orgId) && isIdeaCreator && !isOrganizationWorkspaceContext

  const publishShareHint = !tenant?.orgId
    ? 'Join your organization workspace before you can publish this idea.'
    : !isIdeaCreator
      ? 'Waiting for the idea owner to publish this idea to the organization.'
      : 'Publish this idea to your organization so reviewers can complete Action & Control on each section.'

  const orgWorkspaceNotice = useMemo((): string | null => {
    if (!isOrganizationWorkspaceContext) return null
    const workspaceLabel = tenant?.displayName?.trim() || 'this organization workspace'
    if (isIdeaCreator) {
      return `${workspaceLabel}: already shared with your organization. No submit needed — read-only while members review.`
    }
    return `${workspaceLabel}: complete Action & Control here. No submit needed — you're recorded as reviewer on update.`
  }, [isOrganizationWorkspaceContext, isIdeaCreator, tenant?.displayName])

  const publishedAtLabel = useMemo(() => {
    const publishedAt = actionControlStore.publishedToOrgAt ?? ideaOrgPublishedRecord?.published_at
    if (!publishedAt) return null
    try {
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(publishedAt))
    } catch {
      return publishedAt
    }
  }, [actionControlStore.publishedToOrgAt, ideaOrgPublishedRecord?.published_at])

  const ideaPageContext = useMemo(() => {
    const panelItem = getIdeaPanelCatalogEntry(activePanel)
    const viewLabel = panelItem.label
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
      notes: undefined,
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

    const workspaceCandidates = [
      resolveWorkspaceApiId(tenant?.workspaceId),
      isWorkspaceUuid(idea.workspace) ? idea.workspace.trim() : null,
    ].filter((value, index, arr): value is string => !!value && arr.indexOf(value) === index)

    if (workspaceCandidates.length === 0) {
      setReviewerMemberships([])
      setReviewerOptionsError('Workspace UUID belum tersedia — pilih workspace di topbar terlebih dahulu.')
      setIsReviewerOptionsLoading(false)
      return () => {
        cancelled = true
      }
    }

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
  }, [idea.workspace, tenant?.workspaceId])

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
        executive_brief: 'This idea does not yet have enough scoring data in Idea & Backlog for an honest analysis.',
        missing_fields: scoringSourceCheck.missingFields,
        commentary: 'No AI analysis yet because core scoring data is not available.',
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
        confidence_score: response.confidence_score ?? 0,
      }
      applyRuntimeScoringAnalysis(analysis, response.warnings ?? [])
      setConfidence((prev) => ({
        ...prev,
        scoring: agentConfidencePercent(response.confidence_score),
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

  const applyIntegrationState = useCallback(
    (analysis: RuntimeIntegrationAnalysis, record: IntegrationGraphRecord | null, ideaId: string) => {
      setRuntimeIntegrationAnalysis(analysis)
      setIntegrationWarnings(analysis.warnings)
      setIntegrationLoaded(true)
      setIntegrationMissing(analysis.status === 'insufficient_data')
      setConfidence((prev) => ({
        ...prev,
        integration: Math.round(Math.max(0, Math.min(1, analysis.confidenceScore ?? 0)) * 100),
      }))
      if (record) {
        setIntegrationBootstrapRecord(record)
        setIntegrationBootstrapKey((current) => current + 1)
        saveIntegrationGraph(ideaId, record)
      }
    },
    [],
  )

  const loadRuntimeIntegration = useCallback(
    async (
      sourceIdea: Idea = idea,
      options: { forceRefresh?: boolean; autoGenerateIfMissing?: boolean } = {},
    ) => {
      setIntegrationGenerationError(null)

      if (!options.forceRefresh) {
        try {
          const persistent = await getPersistentIdeaIntegration(sourceIdea.id)
          if (persistent) {
            const analysis = runtimeIntegrationFromPersistent(persistent)
            const record = graphRecordFromPersistentIntegration(persistent)
            applyIntegrationState(analysis, record, sourceIdea.id)
            return
          }
        } catch (error) {
          setIntegrationGenerationError(
            error instanceof Error ? error.message : 'Failed to load stored integration architecture.',
          )
        }

      }

      // Nothing persisted (and not a forced regenerate) — generate now rather than showing a
      // manual "Generate" button. The only way this diagram is truly "missing" going forward is if
      // the AI itself reports insufficient_data after actually trying.
      setIntegrationMissing(false)
      setRegenerating((prev) => ({ ...prev, integration: true }))
      try {
        const response = await analyzeIdeaIntegration(
          {
            idea_id: sourceIdea.id,
            context: {
              workspace_id: sourceIdea.workspace ?? null,
              user_id: runtimeUserId,
              session_id: `idea-detail-integration-${sourceIdea.id}`,
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
          },
          150_000,
        )

        const analysis = runtimeIntegrationFromAgentResponse(response)
        const record = graphRecordFromIntegrationAnalysis(analysis, { userCustomized: false })

        try {
          await upsertPersistentIdeaIntegration(sourceIdea.id, {
            ...buildPersistentIntegrationPayload(analysis, record, runtimeUserId || 'tectona-agent'),
            version: sourceIdea.version,
          })
        } catch (persistError) {
          analysis.warnings = [
            ...analysis.warnings,
            persistError instanceof Error ? persistError.message : 'INTEGRATION_PERSIST_FAILED',
          ]
        }

        applyIntegrationState(analysis, record, sourceIdea.id)
      } catch (error) {
        setRuntimeIntegrationAnalysis(EMPTY_RUNTIME_INTEGRATION_ANALYSIS)
        setIntegrationLoaded(false)
        setIntegrationMissing(false)
        setIntegrationBootstrapRecord(null)
        setIntegrationGenerationError(
          error instanceof Error ? error.message : 'AI integration analysis failed.',
        )
        setIntegrationWarnings(['INTEGRATION_GENERATION_FAILED'])
        setConfidence((prev) => ({ ...prev, integration: 0 }))
      } finally {
        setRegenerating((prev) => ({ ...prev, integration: false }))
      }
    },
    [applyIntegrationState, idea, runtimeUserId],
  )

  const applyC4ArchitectureState = useCallback((level: C4ArchitectureLevel, analysis: RuntimeC4Analysis) => {
    const setAnalysis = level === 'L1' ? setC4Level1Analysis : setC4Level2Analysis
    const setLoaded = level === 'L1' ? setC4Level1Loaded : setC4Level2Loaded
    const setMissing = level === 'L1' ? setC4Level1Missing : setC4Level2Missing
    const confidenceKey = level === 'L1' ? 'c4Level1' : 'c4Level2'
    setAnalysis(analysis)
    setLoaded(true)
    setMissing(analysis.status === 'insufficient_data')
    setConfidence((prev) => ({
      ...prev,
      [confidenceKey]: Math.round(Math.max(0, Math.min(1, analysis.confidenceScore ?? 0)) * 100),
    }))
  }, [])

  const loadRuntimeC4Architecture = useCallback(
    async (
      level: C4ArchitectureLevel,
      sourceIdea: Idea = idea,
      options: { forceRefresh?: boolean; autoGenerateIfMissing?: boolean } = {},
    ) => {
      const setGenerationError = level === 'L1' ? setC4Level1GenerationError : setC4Level2GenerationError
      const setLoaded = level === 'L1' ? setC4Level1Loaded : setC4Level2Loaded
      const setMissing = level === 'L1' ? setC4Level1Missing : setC4Level2Missing
      const setAnalysis = level === 'L1' ? setC4Level1Analysis : setC4Level2Analysis
      const confidenceKey = level === 'L1' ? 'c4Level1' : 'c4Level2'
      setGenerationError(null)

      if (!options.forceRefresh) {
        try {
          const persistent = await getPersistentIdeaC4Architecture(sourceIdea.id, level)
          if (persistent) {
            applyC4ArchitectureState(level, runtimeC4FromPersistent(persistent))
            return
          }
        } catch (error) {
          setGenerationError(error instanceof Error ? error.message : `Failed to load stored C4 ${level} architecture.`)
        }

      }

      // Nothing persisted (and not a forced regenerate) — generate now rather than showing a
      // manual "Generate" button.
      setMissing(false)
      const regeneratingKey = level === 'L1' ? 'c4Level1' : 'c4Level2'
      setRegenerating((prev) => ({ ...prev, [regeneratingKey]: true }))
      try {
        const response = await analyzeIdeaC4Architecture(
          {
            idea_id: sourceIdea.id,
            level,
            context: {
              workspace_id: sourceIdea.workspace ?? null,
              user_id: runtimeUserId,
              session_id: `idea-detail-c4-${level.toLowerCase()}-${sourceIdea.id}`,
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
          },
          150_000,
        )

        const analysis = runtimeC4FromAgentResponse(response)

        try {
          await upsertPersistentIdeaC4Architecture(sourceIdea.id, level, {
            ...buildPersistentC4Payload(analysis, runtimeUserId || 'tectona-agent'),
            version: sourceIdea.version,
          })
        } catch (persistError) {
          analysis.warnings = [
            ...analysis.warnings,
            persistError instanceof Error ? persistError.message : 'C4_ARCHITECTURE_PERSIST_FAILED',
          ]
        }

        applyC4ArchitectureState(level, analysis)
      } catch (error) {
        setAnalysis(emptyRuntimeC4Analysis(level))
        setLoaded(false)
        setMissing(false)
        setGenerationError(error instanceof Error ? error.message : `AI C4 ${level} architecture analysis failed.`)
        setConfidence((prev) => ({ ...prev, [confidenceKey]: 0 }))
      } finally {
        setRegenerating((prev) => ({ ...prev, [regeneratingKey]: false }))
      }
    },
    [applyC4ArchitectureState, idea, runtimeUserId],
  )

  const applyProcessDiagramState = useCallback((analysis: RuntimeProcessDiagramAnalysis) => {
    setBpmnHighAnalysis(analysis)
    setBpmnHighLoaded(true)
    setBpmnHighMissing(analysis.status === 'insufficient_data')
    setConfidence((prev) => ({
      ...prev,
      bpmnHigh: Math.round(Math.max(0, Math.min(1, analysis.confidenceScore ?? 0)) * 100),
    }))
  }, [])

  const loadRuntimeProcessDiagram = useCallback(
    async (
      sourceIdea: Idea = idea,
      options: { forceRefresh?: boolean; autoGenerateIfMissing?: boolean } = {},
    ) => {
      const processKey = 'high'
      setBpmnHighGenerationError(null)

      if (!options.forceRefresh) {
        try {
          const persistent = await getPersistentIdeaProcessDiagram(sourceIdea.id, processKey)
          if (persistent) {
            applyProcessDiagramState(runtimeProcessDiagramFromPersistent(persistent))
            return
          }
        } catch (error) {
          setBpmnHighGenerationError(
            error instanceof Error ? error.message : 'Failed to load stored process diagram.',
          )
        }

      }

      // Nothing persisted (and not a forced regenerate) — generate now rather than showing a
      // manual "Generate" button.
      setBpmnHighMissing(false)
      setRegenerating((prev) => ({ ...prev, bpmnHigh: true }))
      try {
        const response = await analyzeIdeaProcess(
          {
            idea_id: sourceIdea.id,
            context: {
              workspace_id: sourceIdea.workspace ?? null,
              user_id: runtimeUserId,
              session_id: `idea-detail-process-${sourceIdea.id}`,
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
          },
          180_000,
        )

        const analysis = runtimeProcessDiagramFromAgentResponse(response)

        try {
          await upsertPersistentIdeaProcessDiagram(sourceIdea.id, processKey, {
            ...buildPersistentProcessDiagramPayload(analysis, runtimeUserId || 'tectona-agent'),
            version: sourceIdea.version,
          })
        } catch (persistError) {
          analysis.warnings = [
            ...analysis.warnings,
            persistError instanceof Error ? persistError.message : 'PROCESS_DIAGRAM_PERSIST_FAILED',
          ]
        }

        applyProcessDiagramState(analysis)
      } catch (error) {
        setBpmnHighAnalysis(emptyRuntimeProcessDiagramAnalysis())
        setBpmnHighLoaded(false)
        setBpmnHighMissing(false)
        setBpmnHighGenerationError(error instanceof Error ? error.message : 'AI process analysis failed.')
        setConfidence((prev) => ({ ...prev, bpmnHigh: 0 }))
      } finally {
        setRegenerating((prev) => ({ ...prev, bpmnHigh: false }))
      }
    },
    [applyProcessDiagramState, idea, runtimeUserId],
  )

  const setProcessDetailState = useCallback((taskKey: string, state: ProcessDetailState) => {
    setProcessDetailsByKey((prev) => ({ ...prev, [taskKey]: state }))
  }, [])

  const loadRuntimeProcessDetail = useCallback(
    async (
      taskKey: string,
      taskLabel: string,
      sourceIdea: Idea = idea,
      options: { forceRefresh?: boolean } = {},
    ) => {
      if (!options.forceRefresh) {
        try {
          const persistent = await getPersistentIdeaProcessDiagram(sourceIdea.id, taskKey)
          if (persistent) {
            const analysis = runtimeProcessDiagramFromPersistent(persistent)
            setProcessDetailState(taskKey, {
              analysis,
              loaded: true,
              missing: analysis.status === 'insufficient_data',
              generationError: null,
              isRegenerating: false,
            })
            return
          }
        } catch {
          // no persisted detail yet for this task — fall through to the "missing" empty state
        }
        setProcessDetailState(taskKey, {
          analysis: emptyRuntimeProcessDiagramAnalysis(),
          loaded: false,
          missing: true,
          generationError: null,
          isRegenerating: false,
        })
        return
      }

      setProcessDetailState(taskKey, {
        analysis: processDetailsByKey[taskKey]?.analysis ?? emptyRuntimeProcessDiagramAnalysis(),
        loaded: processDetailsByKey[taskKey]?.loaded ?? false,
        missing: false,
        generationError: null,
        isRegenerating: true,
      })
      try {
        const response = await analyzeIdeaProcessDetail(
          {
            idea_id: sourceIdea.id,
            context: {
              workspace_id: sourceIdea.workspace ?? null,
              user_id: runtimeUserId,
              session_id: `idea-detail-process-detail-${taskKey}-${sourceIdea.id}`,
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
            task_key: taskKey,
            task_label: taskLabel,
            high_level_bpmn_xml: bpmnHighAnalysis.bpmnXml,
          },
          180_000,
        )

        const analysis = runtimeProcessDiagramFromAgentResponse(response)

        try {
          await upsertPersistentIdeaProcessDiagram(sourceIdea.id, taskKey, {
            ...buildPersistentProcessDiagramPayload(analysis, runtimeUserId || 'tectona-agent'),
            version: sourceIdea.version,
          })
        } catch (persistError) {
          analysis.warnings = [
            ...analysis.warnings,
            persistError instanceof Error ? persistError.message : 'PROCESS_DETAIL_PERSIST_FAILED',
          ]
        }

        setProcessDetailState(taskKey, {
          analysis,
          loaded: true,
          missing: analysis.status === 'insufficient_data',
          generationError: null,
          isRegenerating: false,
        })
      } catch (error) {
        setProcessDetailState(taskKey, {
          analysis: emptyRuntimeProcessDiagramAnalysis(),
          loaded: false,
          missing: false,
          generationError: error instanceof Error ? error.message : 'AI process detail analysis failed.',
          isRegenerating: false,
        })
      }
    },
    [idea, runtimeUserId, bpmnHighAnalysis.bpmnXml, processDetailsByKey, setProcessDetailState],
  )

  const loadRuntimeSummaryRef = useRef(loadRuntimeSummary)
  const loadRuntimeBrdRef = useRef(loadRuntimeBrd)
  const loadRuntimeScoringRef = useRef(loadRuntimeScoring)
  const loadRuntimeBenefitRef = useRef(loadRuntimeBenefit)
  const loadRuntimeConversionRef = useRef(loadRuntimeConversion)
  const loadRuntimeIntegrationRef = useRef(loadRuntimeIntegration)
  const loadRuntimeC4ArchitectureRef = useRef(loadRuntimeC4Architecture)
  const loadRuntimeProcessDiagramRef = useRef(loadRuntimeProcessDiagram)
  const loadRuntimeProcessDetailRef = useRef(loadRuntimeProcessDetail)

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

  useEffect(() => {
    loadRuntimeIntegrationRef.current = loadRuntimeIntegration
  }, [loadRuntimeIntegration])

  useEffect(() => {
    loadRuntimeC4ArchitectureRef.current = loadRuntimeC4Architecture
  }, [loadRuntimeC4Architecture])

  useEffect(() => {
    loadRuntimeProcessDiagramRef.current = loadRuntimeProcessDiagram
  }, [loadRuntimeProcessDiagram])

  useEffect(() => {
    loadRuntimeProcessDetailRef.current = loadRuntimeProcessDetail
  }, [loadRuntimeProcessDetail])

  // BPMN Detail is lazy — never auto-generated — but once the high-level diagram names its
  // sub-processes, check (check-only, no forceRefresh) whether any of them were already generated
  // on a previous visit, so persisted details reappear instead of resetting to "click Generate"
  // every time the page reloads.
  useEffect(() => {
    for (const task of bpmnHighAnalysis.subProcesses) {
      void loadRuntimeProcessDetailRef.current(task.key, task.label, idea)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpmnHighAnalysis.subProcesses])

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
        await loadRuntimeScoringRef.current(hydratedIdea, { forceRefresh: wasFreshIdea })
        await loadRuntimeBenefitRef.current(hydratedIdea)
        await loadRuntimeConversionRef.current(hydratedIdea)
        await loadRuntimeIntegrationRef.current(hydratedIdea)
        await loadRuntimeC4ArchitectureRef.current('L1', hydratedIdea)
        await loadRuntimeC4ArchitectureRef.current('L2', hydratedIdea)
        await loadRuntimeProcessDiagramRef.current(hydratedIdea)
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
  const isIntegrationRefreshing = regenerating.integration
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

  const totalScore = useMemo(() => weightedIntakeScore(idea) ?? 0, [idea])

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

  const scoreData = useMemo(() => buildScoreDataFromIdea(idea), [idea])
  const hasNumericScoring = scoreData.some((item) => item.score > 0)

  const scoringEvidenceItems = useMemo(() => buildScoringEvidenceChecklist(idea), [idea])
  const showScoringFrameworkDraft = !scoringLoaded || scoringMissing
  const openIdeaBacklogForScoring = useCallback(() => {
    navigate('/idea-backlog', { state: { selectedIdeaId: idea.id } })
  }, [navigate, idea.id])

  const supportingDocuments = useMemo(
    () => extractSupportingDocumentsFromText(idea.description || ''),
    [idea.description],
  )

  const costBenefitChartData = useMemo(() => {
    if (!benefitAnalysis) return []
    const narrativeOnly =
      benefitAnalysis.presentation_mode === 'narrative' &&
      benefitAnalysis.total_development_cost <= 0 &&
      benefitAnalysis.total_benefit_5year <= 0
    if (narrativeOnly) {
      return [
        { name: 'Business Value', value: idea.scoring.businessValue * 10, fill: '#5f7de0', score: idea.scoring.businessValue },
        { name: 'Effort', value: idea.scoring.effort * 10, fill: '#e2a234', score: idea.scoring.effort },
        { name: 'Risk', value: idea.scoring.risk * 10, fill: '#d97706', score: idea.scoring.risk },
        { name: 'ROI score', value: idea.scoring.roi * 10, fill: '#4f46e5', score: idea.scoring.roi },
      ]
    }
    return [
      { name: 'Development Cost', value: Math.round(benefitAnalysis.total_development_cost / 1000), fill: '#fb7185', score: null as number | null },
      {
        name: 'Operational Cost',
        value: Math.round(Math.max(0, benefitAnalysis.total_cost_5year - benefitAnalysis.total_development_cost) / 1000),
        fill: '#f59e0b',
        score: null as number | null,
      },
      {
        name: 'Revenue Gain',
        value: Math.round(
          (benefitAnalysis.annual_breakdown?.reduce((sum, year) => sum + (year.revenue_gains || 0), 0) || 0) / 1000,
        ),
        fill: '#10b981',
        score: null as number | null,
      },
      {
        name: 'Efficiency Gain',
        value: Math.round(
          (benefitAnalysis.annual_breakdown?.reduce((sum, year) => sum + (year.efficiency_gains || 0), 0) || 0) / 1000,
        ),
        fill: '#3b82f6',
        score: null as number | null,
      },
    ].filter((item) => item.value > 0)
  }, [benefitAnalysis, idea.scoring])

  const costBenefitIsNarrativeOnly = useMemo(() => {
    if (!benefitAnalysis) return false
    return (
      benefitAnalysis.presentation_mode === 'narrative' &&
      benefitAnalysis.total_development_cost <= 0 &&
      benefitAnalysis.total_benefit_5year <= 0
    )
  }, [benefitAnalysis])

  const costBenefitSupportingDocCount = useMemo(
    () => supportingDocuments.length + ideaGeneratedDocs.length,
    [supportingDocuments.length, ideaGeneratedDocs.length],
  )

  const costBenefitEvidenceItems = useMemo(
    () => buildCostBenefitEvidenceChecklist(idea, benefitAnalysis, costBenefitSupportingDocCount),
    [benefitAnalysis, costBenefitSupportingDocCount, idea],
  )

  const costBenefitEvidenceReadinessPercent = useMemo(() => {
    const complete = costBenefitEvidenceItems.filter((item) => item.complete).length
    return costBenefitEvidenceItems.length === 0
      ? 0
      : Math.round((complete / costBenefitEvidenceItems.length) * 100)
  }, [costBenefitEvidenceItems])

  const costBenefitValueEffortPosture = useMemo(
    () => buildCostBenefitValueEffortPosture(idea, hasNumericScoring),
    [hasNumericScoring, idea],
  )

  const costBenefitQualitativeLevers = useMemo(
    () => buildCostBenefitQualitativeLevers(idea, benefitAnalysis),
    [benefitAnalysis, idea],
  )

  const costBenefitScenarioBands = useMemo(
    () => buildCostBenefitScenarioBands(benefitAnalysis),
    [benefitAnalysis],
  )

  const costBenefitUpgradeHint = useMemo(
    () => buildCostBenefitUpgradeHint(costBenefitEvidenceItems, confidence.costBenefit ?? 0),
    [confidence.costBenefit, costBenefitEvidenceItems],
  )

  const brainstormProcessDiagrams = useMemo(
    () => extractProcessDiagramsFromText(idea.description || ''),
    [idea.description],
  )

  useEffect(() => {
    if (activePanel !== 'document') return
    let cancelled = false
    setIdeaDocTemplatesLoading(true)
    // Fetch without a workspace filter, then scope client-side with the SAME resolution used by
    // the Document Repository's own template library (`belongsToDkmTemplateScope`) — it infers a
    // template's workspace from its naming convention (e.g. "URD_AdiraFinanceWs_...") when the
    // workspace_id column/metadata is empty, instead of naively treating every unscoped row as a
    // shared "global" template. Without this, a template that visibly belongs to one workspace's
    // repository (by name) could still appear — and be unusable, since it was never prepared for
    // agent use in this workspace — in every other workspace's "Generate from template" list.
    const workspaceCandidates = userWorkspaceOptions.map((option) => ({
      id: option.workspaceId,
      name: option.workspaceName,
      organizationId: option.organizationId,
      tenantMode: option.tenantMode,
    }))
    const scope = idea.workspace
      ? ({ mode: 'single', workspaceId: idea.workspace, tenantMode: null } as const)
      : ({ mode: 'all' } as const)
    void listTemplates({ status: 'active' })
      .then((items) => {
        if (cancelled) return
        setIdeaDocTemplates(
          items.filter(
            (item) => item.has_attachment && belongsToDkmTemplateScope(item, scope, workspaceCandidates),
          ),
        )
      })
      .catch(() => {
        if (!cancelled) setIdeaDocTemplates([])
      })
      .finally(() => {
        if (!cancelled) setIdeaDocTemplatesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activePanel, idea.workspace, userWorkspaceOptions])

  useEffect(() => {
    if (activePanel !== 'document') return
    let cancelled = false
    setIdeaDocsLoading(true)
    // Load the repository without a workspace filter so legacy documents that
    // were created before workspace metadata was populated remain discoverable.
    // The Idea tag/metadata filter below still scopes the result to this Idea.
    void listAllDocuments({ page: 1, page_size: 100 })
      .then((response) => {
        if (cancelled) return
        const linked = response.items.filter(
          (item) => item.tags.includes(idea.id) || item.metadata?.idea_id === idea.id,
        )
        setIdeaGeneratedDocs((prev) => {
          const merged = [...prev, ...linked].filter(
            (doc, index, arr) => arr.findIndex((other) => other.id === doc.id) === index,
          )
          return merged.sort(
            (a, b) =>
              new Date(b.updated_date || b.created_date).getTime() -
              new Date(a.updated_date || a.created_date).getTime(),
          )
        })
      })
      .catch(() => {
        // Best-effort — the Docs table still works with session-generated documents only.
      })
      .finally(() => {
        if (!cancelled) setIdeaDocsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activePanel, idea.id, idea.workspace])

  useEffect(() => {
    if (activePanel !== 'document') return
    if (ideaGeneratedDocs.length === 0) {
      setIdeaDocKbGeneratedIds(new Set())
      return
    }
    let cancelled = false
    void listAllKbEntries()
      .then(({ items: kbEntries }) => {
        if (cancelled) return
        setIdeaDocKbGeneratedIds(
          new Set(
            ideaGeneratedDocs
              .filter((doc) => findRepositoryTraceEntryByDocumentId(kbEntries, doc.id, doc.title))
              .map((doc) => doc.id),
          ),
        )
      })
      .catch(() => {
        // Best-effort — KB status is a display enhancement, not required to view documents.
      })
    return () => {
      cancelled = true
    }
  }, [activePanel, ideaGeneratedDocs])

  useLayoutEffect(() => {
    if (activePanel !== 'summary') return
    if (isSummaryPanelFullscreen) {
      setIdeaSummaryPanelHeightPx(null)
      return
    }
    const panelEl = ideaSummaryPanelRef.current
    if (!panelEl) return

    const updateHeight = () => {
      setIdeaSummaryPanelHeightPx(measureProjectPanelHeight(panelEl))
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)
    window.addEventListener('scroll', updateHeight, { passive: true })

    const observer = new ResizeObserver(updateHeight)
    observer.observe(panelEl)
    if (panelEl.parentElement) observer.observe(panelEl.parentElement)

    return () => {
      window.removeEventListener('resize', updateHeight)
      window.removeEventListener('scroll', updateHeight)
      observer.disconnect()
    }
  }, [activePanel, isSummaryPanelFullscreen, summaryLoaded, summaryRefreshLabel, summaryWarningItems.length])

  useEffect(() => {
    if (activePanel !== 'summary' && isSummaryPanelFullscreen) {
      setIsSummaryPanelFullscreen(false)
    }
  }, [activePanel, isSummaryPanelFullscreen])

  useEffect(() => {
    if (!isSummaryPanelFullscreen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSummaryPanelFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isSummaryPanelFullscreen])

  useLayoutEffect(() => {
    if (activePanel !== 'diagrams') return
    if (isDiagramsPanelFullscreen) {
      setIdeaDiagramsPanelHeightPx(null)
      return
    }
    const panelEl = ideaDiagramsPanelRef.current
    if (!panelEl) return

    const updateHeight = () => {
      setIdeaDiagramsPanelHeightPx(measureProjectPanelHeight(panelEl))
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)
    window.addEventListener('scroll', updateHeight, { passive: true })

    const observer = new ResizeObserver(updateHeight)
    observer.observe(panelEl)
    if (panelEl.parentElement) observer.observe(panelEl.parentElement)

    return () => {
      window.removeEventListener('resize', updateHeight)
      window.removeEventListener('scroll', updateHeight)
      observer.disconnect()
    }
  }, [activePanel, isDiagramsPanelFullscreen])

  useEffect(() => {
    if (activePanel !== 'diagrams' && isDiagramsPanelFullscreen) {
      setIsDiagramsPanelFullscreen(false)
    }
  }, [activePanel, isDiagramsPanelFullscreen])

  useEffect(() => {
    if (!isDiagramsPanelFullscreen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsDiagramsPanelFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isDiagramsPanelFullscreen])

  useLayoutEffect(() => {
    if (activePanel !== 'scoring') return
    if (isScoringPanelFullscreen) {
      setIdeaScoringPanelHeightPx(null)
      return
    }
    const panelEl = ideaScoringPanelRef.current
    if (!panelEl) return

    const updateHeight = () => {
      setIdeaScoringPanelHeightPx(measureProjectPanelHeight(panelEl))
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)
    window.addEventListener('scroll', updateHeight, { passive: true })

    const observer = new ResizeObserver(updateHeight)
    observer.observe(panelEl)
    if (panelEl.parentElement) observer.observe(panelEl.parentElement)

    return () => {
      window.removeEventListener('resize', updateHeight)
      window.removeEventListener('scroll', updateHeight)
      observer.disconnect()
    }
  }, [activePanel, isScoringPanelFullscreen])

  useEffect(() => {
    if (activePanel !== 'scoring' && isScoringPanelFullscreen) {
      setIsScoringPanelFullscreen(false)
    }
  }, [activePanel, isScoringPanelFullscreen])

  useEffect(() => {
    if (!isScoringPanelFullscreen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsScoringPanelFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isScoringPanelFullscreen])

  useLayoutEffect(() => {
    if (activePanel !== 'impact') return
    if (isImpactPanelFullscreen) {
      setIdeaImpactPanelHeightPx(null)
      return
    }
    const panelEl = ideaImpactPanelRef.current
    if (!panelEl) return

    const updateHeight = () => {
      setIdeaImpactPanelHeightPx(measureProjectPanelHeight(panelEl))
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)
    window.addEventListener('scroll', updateHeight, { passive: true })

    const observer = new ResizeObserver(updateHeight)
    observer.observe(panelEl)
    if (panelEl.parentElement) observer.observe(panelEl.parentElement)

    return () => {
      window.removeEventListener('resize', updateHeight)
      window.removeEventListener('scroll', updateHeight)
      observer.disconnect()
    }
  }, [activePanel, isImpactPanelFullscreen])

  useEffect(() => {
    if (activePanel !== 'impact' && isImpactPanelFullscreen) {
      setIsImpactPanelFullscreen(false)
    }
  }, [activePanel, isImpactPanelFullscreen])

  useEffect(() => {
    if (!isImpactPanelFullscreen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsImpactPanelFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isImpactPanelFullscreen])

  useLayoutEffect(() => {
    if (activePanel !== 'costBenefit') return
    if (isCostBenefitPanelFullscreen) {
      setIdeaCostBenefitPanelHeightPx(null)
      return
    }
    const panelEl = ideaCostBenefitPanelRef.current
    if (!panelEl) return

    const updateHeight = () => {
      setIdeaCostBenefitPanelHeightPx(measureProjectPanelHeight(panelEl))
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)

    const observer = new ResizeObserver(updateHeight)
    observer.observe(panelEl)
    if (panelEl.parentElement) observer.observe(panelEl.parentElement)

    return () => {
      window.removeEventListener('resize', updateHeight)
      observer.disconnect()
    }
  }, [activePanel, isCostBenefitPanelFullscreen])

  useEffect(() => {
    if (activePanel !== 'costBenefit' && isCostBenefitPanelFullscreen) {
      setIsCostBenefitPanelFullscreen(false)
    }
  }, [activePanel, isCostBenefitPanelFullscreen])

  useEffect(() => {
    if (!isCostBenefitPanelFullscreen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCostBenefitPanelFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isCostBenefitPanelFullscreen])

  useEffect(() => {
    if (activePanel !== 'diagrams' && isIntegrationPanelFullscreen) {
      setIsIntegrationPanelFullscreen(false)
    }
  }, [activePanel, isIntegrationPanelFullscreen])

  useEffect(() => {
    if (!isIntegrationPanelFullscreen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsIntegrationPanelFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isIntegrationPanelFullscreen])

  useLayoutEffect(() => {
    if (activePanel !== 'document') return
    if (isIdeaDocsPanelFullscreen) {
      setIdeaDocsPanelHeightPx(null)
      return
    }
    const panelEl = ideaDocsPanelRef.current
    if (!panelEl) return

    const updateHeight = () => {
      setIdeaDocsPanelHeightPx(measureProjectPanelHeight(panelEl))
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)
    window.addEventListener('scroll', updateHeight, { passive: true })

    const observer = new ResizeObserver(updateHeight)
    observer.observe(panelEl)
    if (panelEl.parentElement) observer.observe(panelEl.parentElement)

    return () => {
      window.removeEventListener('resize', updateHeight)
      window.removeEventListener('scroll', updateHeight)
      observer.disconnect()
    }
  }, [activePanel, isIdeaDocsPanelFullscreen])

  useEffect(() => {
    if (activePanel !== 'document' && isIdeaDocsPanelFullscreen) {
      setIsIdeaDocsPanelFullscreen(false)
    }
  }, [activePanel, isIdeaDocsPanelFullscreen])

  useEffect(() => {
    if (!isIdeaDocsPanelFullscreen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsIdeaDocsPanelFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isIdeaDocsPanelFullscreen])

  useLayoutEffect(() => {
    if (activePanel !== 'conversion') return
    if (isConversionPanelFullscreen) {
      setIdeaConversionPanelHeightPx(null)
      return
    }
    const panelEl = ideaConversionPanelRef.current
    if (!panelEl) return

    const updateHeight = () => {
      setIdeaConversionPanelHeightPx(measureProjectPanelHeight(panelEl))
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)

    const observer = new ResizeObserver(updateHeight)
    observer.observe(panelEl)
    if (panelEl.parentElement) observer.observe(panelEl.parentElement)

    return () => {
      window.removeEventListener('resize', updateHeight)
      observer.disconnect()
    }
  }, [activePanel, isConversionPanelFullscreen])

  useEffect(() => {
    if (activePanel !== 'conversion' && isConversionPanelFullscreen) {
      setIsConversionPanelFullscreen(false)
    }
  }, [activePanel, isConversionPanelFullscreen])

  useEffect(() => {
    if (!isConversionPanelFullscreen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsConversionPanelFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isConversionPanelFullscreen])

  const ideaDocCurrentFolder = ideaDocFolderStack[ideaDocFolderStack.length - 1] ?? null
  const isIdeaDocAtProjectRoot = ideaDocFolderStack.length <= 1
  const ideaDocsInCurrentFolder = useMemo(() => {
    if (!ideaDocCurrentFolder) return ideaGeneratedDocs
    // Keep documents visible at the Idea root even when they were created
    // before the current project-backed root folder was initialized.
    if (isIdeaDocAtProjectRoot) return ideaGeneratedDocs
    return ideaGeneratedDocs.filter((doc) => doc.folder_id === ideaDocCurrentFolder.id)
  }, [ideaDocCurrentFolder, ideaGeneratedDocs, isIdeaDocAtProjectRoot])

  const ideaRepositoryItems = useMemo(
    () => ideaDocsInCurrentFolder.map((doc) => mapDocumentToRepositoryItem(doc, idea.title)),
    [ideaDocsInCurrentFolder, idea.title],
  )

  const ideaDocsTotalCount = ideaRepositoryItems.length
  const showIdeaDocEmptyState =
    !ideaDocFolderInitBusy &&
    !ideaDocsLoading &&
    ideaRepositoryItems.length === 0 &&
    ideaDocSubfolders.length === 0 &&
    Boolean(ideaDocCurrentFolder)

  const ideaDocsPaginatedItems = useMemo(() => {
    const start = (ideaDocsPage - 1) * ideaDocsPageSize
    return ideaRepositoryItems.slice(start, start + ideaDocsPageSize)
  }, [ideaRepositoryItems, ideaDocsPage, ideaDocsPageSize])

  const resolveIdeaTargetProject = useCallback(async () => {
    const projectList = await fetchProjects({
      page: 1,
      page_size: 100,
      app_id: TECTONA_PROJECT_APP_ID,
      workspace_id: idea.workspace ?? null,
    })

    if (idea.project_id) {
      const linkedProject = projectList.projects?.find((item) => item.id === idea.project_id)
      if (linkedProject?.id) return linkedProject
    }

    const targetProject = projectList.projects?.[0]
    if (targetProject?.id) return targetProject

    // Ideas can be documented before they are converted into a user-created
    // project. Create a workspace-scoped document container so Docs remains
    // usable without requiring a separate conversion step first.
    return createProject({
      name: idea.title.trim().slice(0, 255) || 'Idea workspace project',
      description: `Document container for idea: ${idea.title.trim() || idea.id}`,
      tags: ['idea-docs', idea.id],
      workspace_id: idea.workspace ?? null,
    })
  }, [idea.id, idea.project_id, idea.title, idea.workspace])

  useEffect(() => {
    if (activePanel !== 'document') return
    let cancelled = false
    setIdeaDocFolderInitBusy(true)
    void (async () => {
      try {
        const targetProject = await resolveIdeaTargetProject()
        const folderId = await ensureProjectDocumentFolder({
          id: targetProject.id,
          name: targetProject.name,
        })
        if (!cancelled) {
          setIdeaDocFolderStack([{ id: folderId, name: targetProject.name }])
        }
      } catch (error) {
        if (!cancelled) {
          setIdeaDocFolderStack([])
          setIdeaDocSubfolders([])
          addToast({
            title: 'Failed to load idea docs folder',
            description: error instanceof Error ? error.message : '',
            variant: 'error',
          })
        }
      } finally {
        if (!cancelled) setIdeaDocFolderInitBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activePanel, addToast, idea.id, idea.project_id, idea.workspace, resolveIdeaTargetProject])

  useEffect(() => {
    if (activePanel !== 'document' || !ideaDocCurrentFolder) return
    let cancelled = false
    void fetchDocumentFolders({
      parent_id: ideaDocCurrentFolder.id,
      page: 1,
      page_size: 100,
    })
      .then((response) => {
        if (!cancelled) setIdeaDocSubfolders(response.folders)
      })
      .catch(() => {
        if (!cancelled) setIdeaDocSubfolders([])
      })
    return () => {
      cancelled = true
    }
  }, [activePanel, ideaDocCurrentFolder?.id])

  const openIdeaDocSubfolder = useCallback((folder: DocumentFolder) => {
    setIdeaDocFolderStack((prev) => [...prev, { id: folder.id, name: folder.name }])
    setIdeaDocsPage(1)
  }, [])

  const goToIdeaDocParentFolder = useCallback(() => {
    setIdeaDocFolderStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
    setIdeaDocsPage(1)
  }, [])

  const navigateIdeaDocFolderIndex = useCallback((index: number) => {
    setIdeaDocFolderStack((prev) => prev.slice(0, index + 1))
    setIdeaDocsPage(1)
  }, [])

  const openIdeaDocFolderContextMenu = useCallback((folder: DocumentFolder, x: number, y: number) => {
    setIdeaDocContextMenu(null)
    setIdeaDocFolderContextMenu({ folder, x, y })
  }, [])

  const handleIdeaDocCreateFolder = useCallback(async () => {
    if (!ideaDocCurrentFolder || ideaDocFolderCreateBusy) return

    setIdeaDocFolderCreateBusy(true)
    try {
      const session = getSession()
      const name = nextUntitledDocumentFolderName(ideaDocSubfolders)
      await createDocumentFolder({
        name,
        description: null,
        parent_id: ideaDocCurrentFolder.id,
        owner_id: session?.user.id || session?.user.email || idea.submittedBy || null,
      })

      const folderResponse = await fetchDocumentFolders({
        parent_id: ideaDocCurrentFolder.id,
        page: 1,
        page_size: 100,
      })
      setIdeaDocSubfolders(folderResponse.folders)

      addToast({
        title: 'Folder created',
        description: `"${name}" is ready in this idea folder.`,
        variant: 'success',
      })
    } catch (error) {
      addToast({
        title: 'Failed to create folder',
        description: error instanceof Error ? error.message : '',
        variant: 'error',
      })
    } finally {
      setIdeaDocFolderCreateBusy(false)
    }
  }, [addToast, idea.submittedBy, ideaDocCurrentFolder, ideaDocFolderCreateBusy, ideaDocSubfolders])

  const handleIdeaDocCreateSubfolder = useCallback(async (parentFolder: DocumentFolder) => {
    if (ideaDocFolderCreateBusy) return

    setIdeaDocFolderCreateBusy(true)
    try {
      const existingChildren = await fetchDocumentFolders({
        parent_id: parentFolder.id,
        page: 1,
        page_size: 100,
      })
      const session = getSession()
      const name = nextUntitledDocumentFolderName(existingChildren.folders)
      await createDocumentFolder({
        name,
        description: null,
        parent_id: parentFolder.id,
        owner_id: session?.user.id || session?.user.email || idea.submittedBy || null,
      })
      setIdeaDocSubfolders((prev) => prev.map((folder) => (
        folder.id === parentFolder.id
          ? { ...folder, children_count: folder.children_count + 1 }
          : folder
      )))
      addToast({
        title: 'Subfolder created',
        description: `"${name}" was created inside ${parentFolder.name}.`,
        variant: 'success',
      })
    } catch (error) {
      addToast({
        title: 'Failed to create subfolder',
        description: error instanceof Error ? error.message : '',
        variant: 'error',
      })
    } finally {
      setIdeaDocFolderCreateBusy(false)
    }
  }, [addToast, idea.submittedBy, ideaDocFolderCreateBusy])

  const handleIdeaDocFolderRenameConfirm = useCallback(async () => {
    if (!ideaDocFolderRenameTarget) return
    const nextName = ideaDocFolderRenameValue.trim()
    if (!nextName) {
      addToast({ title: 'Folder name required', description: 'Enter a folder name.', variant: 'error' })
      return
    }

    setIdeaDocFolderRenameBusy(true)
    try {
      const updated = await updateDocumentFolder(ideaDocFolderRenameTarget.id, { name: nextName })
      setIdeaDocSubfolders((prev) => prev.map((folder) => (folder.id === updated.id ? updated : folder)))
      setIdeaDocFolderStack((prev) => prev.map((folder) => (
        folder.id === updated.id ? { ...folder, name: updated.name } : folder
      )))
      setIdeaDocFolderRenameTarget(null)
      addToast({ title: 'Folder renamed', description: updated.name, variant: 'success' })
    } catch (error) {
      addToast({
        title: 'Rename failed',
        description: error instanceof Error ? error.message : '',
        variant: 'error',
      })
    } finally {
      setIdeaDocFolderRenameBusy(false)
    }
  }, [addToast, ideaDocFolderRenameTarget, ideaDocFolderRenameValue])

  const handleIdeaDocFolderDeleteConfirm = useCallback(async () => {
    if (!ideaDocFolderDeleteTarget) return
    if (ideaDocFolderDeleteTarget.document_count > 0 || ideaDocFolderDeleteTarget.children_count > 0) {
      addToast({
        title: 'Folder is not empty',
        description: 'Move or delete its documents and subfolders first.',
        variant: 'error',
      })
      return
    }

    setIdeaDocFolderDeleteBusy(true)
    try {
      await deleteDocumentFolder(ideaDocFolderDeleteTarget.id)
      setIdeaDocSubfolders((prev) => prev.filter((folder) => folder.id !== ideaDocFolderDeleteTarget.id))
      setIdeaDocFolderDeleteTarget(null)
      addToast({ title: 'Folder deleted', description: ideaDocFolderDeleteTarget.name, variant: 'success' })
    } catch (error) {
      addToast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : '',
        variant: 'error',
      })
    } finally {
      setIdeaDocFolderDeleteBusy(false)
    }
  }, [addToast, ideaDocFolderDeleteTarget])

  const copyIdeaDocFolderPath = useCallback(async (folder: DocumentFolder) => {
    const path = [...ideaDocFolderStack.map((item) => item.name), folder.name].join(' / ')
    try {
      await navigator.clipboard.writeText(path)
      addToast({ title: 'Folder path copied', description: path, variant: 'success' })
    } catch (error) {
      addToast({
        title: 'Copy failed',
        description: error instanceof Error ? error.message : 'Clipboard access is unavailable.',
        variant: 'error',
      })
    }
  }, [addToast, ideaDocFolderStack])

  const openIdeaDocGenerateDialog = useCallback(() => {
    const firstTemplate = ideaDocTemplates[0]
    setIdeaDocGenerateTemplateId(firstTemplate?.id ?? '')
    setIdeaDocGenerateSource((idea.description || idea.title || '').trim())
    setIdeaDocGenerateOpen(true)
  }, [idea.description, idea.title, ideaDocTemplates])

  const handleIdeaDocGenerate = useCallback(async () => {
    const template = ideaDocTemplates.find((item) => item.id === ideaDocGenerateTemplateId)
    if (!template) {
      addToast({ title: 'Select a template', description: 'Pick a DKM master template first.', variant: 'error' })
      return
    }
    const sourceText = ideaDocGenerateSource.trim()
    if (!sourceText) {
      addToast({
        title: 'Source context required',
        description: 'Provide idea notes or requirements for the agent to fill the template.',
        variant: 'error',
      })
      return
    }
    if (ideaDocGenerateBusy) return
    setIdeaDocGenerateBusy(true)
    setIdeaDocGenerateStepIndex(0)
    let stepIdx = 0
    ideaDocGenerateTimerRef.current = window.setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, IDEA_DOC_GENERATE_STEPS.length - 1)
      setIdeaDocGenerateStepIndex(stepIdx)
    }, IDEA_DOC_GENERATE_STEP_INTERVAL_MS)
    try {
      const targetProject = await resolveIdeaTargetProject()
      const targetFolderId = ideaDocCurrentFolder?.id ?? await ensureProjectDocumentFolder({
        id: targetProject.id,
        name: targetProject.name,
      })

      const filled = await fillDkmTemplate({
        template_id: template.id,
        source_text: sourceText.slice(0, 12000),
        context: { workspace_id: idea.workspace ?? null },
        options: { allow_llm: true },
      })

      const created = await instantiateTemplateFromProject(targetProject.id, template.id, {
        title: `${template.name} — ${idea.title}`.slice(0, 255),
        summary: filled.payload.summary?.trim() || template.description || undefined,
        workspace_id: idea.workspace ?? null,
        folder_id: targetFolderId,
        document_type_code: template.document_type_code,
        category_code: template.category_code,
        status_code: 'draft',
        tags: ['from-template', 'ai-generated', 'idea-docs', template.template_code, idea.id],
        access_scope_codes: ['project_team'],
        metadata: {
          source: 'idea-docs-ai-generate',
          idea_id: idea.id,
          template_code: template.template_code,
          ai_generated: true,
          fill_correlation_id: filled.correlation_id,
          storage_project_id: targetProject.id,
          storage_project_name: targetProject.name,
        },
        version_notes: `AI-generated from template ${template.template_code} for idea ${idea.id}`,
        fills: filled.payload.fills ?? {},
        sections: filled.payload.sections ?? {},
        collections: filled.payload.collections ?? {},
        agent_schema: filled.agent_schema,
        diagrams: filled.rendered_diagrams ?? {},
      })

      setIdeaGeneratedDocs((prev) => [created, ...prev.filter((doc) => doc.id !== created.id)])
      setIdeaDocsPage(1)
      setIdeaDocGenerateOpen(false)
      setIdeaDocEditId(created.id)
      setIdeaDocEditTitle(created.title)
      addToast({
        title: 'Document generated',
        description: `${created.title} opened in the document editor. Download remains available from the Docs list.`,
        variant: 'success',
      })
    } catch (error) {
      addToast({
        title: 'Failed to generate document',
        description: error instanceof Error ? error.message : '',
        variant: 'error',
      })
    } finally {
      if (ideaDocGenerateTimerRef.current) {
        window.clearInterval(ideaDocGenerateTimerRef.current)
        ideaDocGenerateTimerRef.current = null
      }
      setIdeaDocGenerateBusy(false)
    }
  }, [
    addToast,
    idea.description,
    idea.id,
    idea.title,
    idea.workspace,
    ideaDocCurrentFolder?.id,
    ideaDocGenerateBusy,
    ideaDocGenerateSource,
    ideaDocGenerateTemplateId,
    ideaDocTemplates,
    resolveIdeaTargetProject,
  ])

  useEffect(() => {
    return () => {
      if (ideaDocGenerateTimerRef.current) {
        window.clearInterval(ideaDocGenerateTimerRef.current)
      }
    }
  }, [])

  const openIdeaDocContextMenu = useCallback((event: { clientX: number; clientY: number }, item: RepositoryItem) => {
    const menuWidth = 224
    const menuHeight = 260
    const gap = 8
    const x = Math.min(event.clientX, window.innerWidth - menuWidth - gap)
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - gap)
    setIdeaDocContextMenu({ item, x: Math.max(gap, x), y: Math.max(gap, y) })
  }, [])

  const handleIdeaDocDownload = useCallback(async (item: RepositoryItem) => {
    setIdeaDocDownloadBusyId(item.id)
    try {
      const { blob, fileName } = await resolveLatestDocumentAttachmentBlob(item.id, {
        fileNameHint: item.fileName || item.name,
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName || item.fileName || 'document.docx'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      addToast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : '',
        variant: 'error',
      })
    } finally {
      setIdeaDocDownloadBusyId(null)
    }
  }, [addToast])

  const handleIdeaDocRenameConfirm = useCallback(async () => {
    if (!ideaDocRenameTarget) return
    const nextTitle = ideaDocRenameValue.trim()
    if (!nextTitle) {
      addToast({ title: 'Title required', description: 'Enter a document title.', variant: 'error' })
      return
    }
    setIdeaDocRenameBusy(true)
    try {
      const updated = await patchDocument(ideaDocRenameTarget.id, {
        version: ideaDocRenameTarget.documentVersion,
        title: nextTitle,
      })
      setIdeaGeneratedDocs((prev) => prev.map((doc) => (doc.id === updated.id ? updated : doc)))
      setIdeaDocRenameTarget(null)
      addToast({ title: 'Document renamed', description: nextTitle, variant: 'success' })
    } catch (error) {
      addToast({
        title: 'Rename failed',
        description: error instanceof Error ? error.message : '',
        variant: 'error',
      })
    } finally {
      setIdeaDocRenameBusy(false)
    }
  }, [addToast, ideaDocRenameTarget, ideaDocRenameValue])

  const handleIdeaDocRegenerateKb = useCallback(async (item: RepositoryItem) => {
    const document_ = ideaGeneratedDocs.find((doc) => doc.id === item.id)
    if (!document_) return
    setIdeaDocKbBusyId(item.id)
    try {
      const { blob, fileName, contentType } = await resolveLatestDocumentAttachmentBlob(item.id, {
        fileNameHint: item.fileName || item.name,
      })
      const file = new File([blob], fileName || item.fileName || item.name, {
        type: contentType || 'application/octet-stream',
      })
      const kbResult = await generateIdeaDocKb({
        file,
        document: document_,
        ideaId: idea.id,
        ideaTitle: idea.title,
        workspaceId: idea.workspace ?? null,
        existingKbEntries: [],
      })
      if (kbResult.status === 'generated') {
        setIdeaDocKbGeneratedIds((prev) => new Set(prev).add(item.id))
        addToast({ title: 'KB generated', description: `Knowledge base entry created for ${item.name}.`, variant: 'success' })
      } else if (kbResult.status === 'unsupported') {
        addToast({
          title: 'KB generation unavailable',
          description: `${item.name}: ${kbResult.message}`,
          variant: 'info',
        })
      } else {
        addToast({ title: 'KB generation failed', description: `${item.name}: ${kbResult.message}`, variant: 'error' })
      }
    } catch (error) {
      addToast({
        title: 'KB generation failed',
        description: error instanceof Error ? error.message : '',
        variant: 'error',
      })
    } finally {
      setIdeaDocKbBusyId(null)
    }
  }, [addToast, idea.id, idea.title, idea.workspace, ideaGeneratedDocs])

  const handleIdeaDocDeleteConfirm = useCallback(async () => {
    if (!ideaDocDeleteTarget) return
    setIdeaDocDeleteBusy(true)
    try {
      await deleteDocument(ideaDocDeleteTarget.id)
      setIdeaGeneratedDocs((prev) => prev.filter((doc) => doc.id !== ideaDocDeleteTarget.id))
      setIdeaDocKbGeneratedIds((prev) => {
        const next = new Set(prev)
        next.delete(ideaDocDeleteTarget.id)
        return next
      })
      setIdeaDocDeleteTarget(null)
      addToast({ title: 'Document deleted', description: ideaDocDeleteTarget.name, variant: 'success' })
    } catch (error) {
      addToast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : '',
        variant: 'error',
      })
    } finally {
      setIdeaDocDeleteBusy(false)
    }
  }, [addToast, ideaDocDeleteTarget])

  const mermaidCode = useMemo(() => {
    if (brainstormProcessDiagrams.length === 0) return ''
    return brainstormProcessDiagrams
      .map((diagram) => `%% ${diagram.label}\n${diagram.source}`)
      .join('\n\n')
  }, [brainstormProcessDiagrams])

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

    if (key === 'integration') {
      void (async () => {
        const startedAt = Date.now()
        try {
          let refreshedIdea = idea
          try {
            const api = await getIdeaById(idea.id)
            refreshedIdea = ideaFromApi(api)
            setIdea(refreshedIdea)
          } catch {
            // keep current snapshot
          }
          await loadRuntimeIntegrationRef.current(refreshedIdea, { forceRefresh: true })
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

    if (key === 'c4Level1' || key === 'c4Level2') {
      const level: C4ArchitectureLevel = key === 'c4Level1' ? 'L1' : 'L2'
      void (async () => {
        const startedAt = Date.now()
        try {
          let refreshedIdea = idea
          try {
            const api = await getIdeaById(idea.id)
            refreshedIdea = ideaFromApi(api)
            setIdea(refreshedIdea)
          } catch {
            // keep current snapshot
          }
          await loadRuntimeC4ArchitectureRef.current(level, refreshedIdea, { forceRefresh: true })
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

    if (key === 'bpmnHigh') {
      void (async () => {
        const startedAt = Date.now()
        try {
          let refreshedIdea = idea
          try {
            const api = await getIdeaById(idea.id)
            refreshedIdea = ideaFromApi(api)
            setIdea(refreshedIdea)
          } catch {
            // keep current snapshot
          }
          await loadRuntimeProcessDiagramRef.current(refreshedIdea, { forceRefresh: true })
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

    window.setTimeout(() => {
      setConfidence((prev) => {
        const next = Math.min(98, Math.max(70, prev[key] + (Math.random() > 0.5 ? 1 : -1) * 3))
        return { ...prev, [key]: next }
      })
      setRegenerating((prev) => ({ ...prev, [key]: false }))
    }, 900)
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

  const updateActivePanelActionGroups = useCallback((groups: IdeaActionControlGroup[]) => {
    persistActionControlStore({
      ...actionControlStore,
      panels: {
        ...actionControlStore.panels,
        [activePanel]: groups,
      },
    })
  }, [actionControlStore, activePanel, persistActionControlStore])

  const handleUpdateActionControlGroup = useCallback((
    groupId: string,
    patch: Partial<IdeaActionControlGroup>,
  ) => {
    const session = getSession()
    const userId = session?.user.id?.trim() ?? ''
    const displayName = resolveIdentityDisplayName(userId)
      || session?.user.email?.split('@')[0]?.trim()
      || 'Reviewer'
    updateActivePanelActionGroups(
      activeActionControlGroups.map((group) => (
        group.id === groupId ? {
          ...group,
          ...patch,
          reviewerUserId: userId,
          reviewerDisplayName: displayName,
        } : group
      )),
    )
  }, [activeActionControlGroups, resolveIdentityDisplayName, updateActivePanelActionGroups])

  const handleAddCustomActionStatus = useCallback((label: string) => {
    const normalized = label.trim()
    if (!normalized) return
    if (IDEA_STATUSES.includes(normalized as IdeaStatus) || actionControlStore.customStatuses.includes(normalized)) {
      return
    }
    persistActionControlStore({
      ...actionControlStore,
      customStatuses: [...actionControlStore.customStatuses, normalized],
    })
  }, [actionControlStore, persistActionControlStore])

  const handleUpdateCustomActionStatus = useCallback((previousLabel: string, nextLabel: string) => {
    const normalized = nextLabel.trim()
    if (!normalized || previousLabel === normalized) return
    if (
      IDEA_STATUSES.includes(normalized as IdeaStatus)
      || actionControlStore.customStatuses.some(
        (item) => item !== previousLabel && item.toLowerCase() === normalized.toLowerCase(),
      )
    ) {
      return
    }
    persistActionControlStore({
      ...actionControlStore,
      panels: remapActionControlStatusInPanels(actionControlStore.panels, previousLabel, normalized),
      customStatuses: actionControlStore.customStatuses.map((item) => (
        item === previousLabel ? normalized : item
      )),
    })
  }, [actionControlStore, persistActionControlStore])

  const handleRemoveCustomActionStatus = useCallback((label: string) => {
    persistActionControlStore({
      ...actionControlStore,
      panels: remapActionControlStatusInPanels(actionControlStore.panels, label, ''),
      customStatuses: actionControlStore.customStatuses.filter((item) => item !== label),
    })
  }, [actionControlStore, persistActionControlStore])

  const handleAddCustomActionRole = useCallback((label: string) => {
    const normalized = label.trim()
    if (!normalized || actionControlStore.customRoles.includes(normalized)) return
    persistActionControlStore({
      ...actionControlStore,
      customRoles: [...actionControlStore.customRoles, normalized],
    })
  }, [actionControlStore, persistActionControlStore])

  const handleUpdateCustomActionRole = useCallback((previousLabel: string, nextLabel: string) => {
    const normalized = nextLabel.trim()
    if (!normalized || previousLabel === normalized) return
    if (actionControlStore.customRoles.some(
      (item) => item !== previousLabel && item.toLowerCase() === normalized.toLowerCase(),
    )) {
      return
    }
    persistActionControlStore({
      ...actionControlStore,
      panels: remapActionControlFieldInPanels(actionControlStore.panels, 'role', previousLabel, normalized),
      customRoles: actionControlStore.customRoles.map((item) => (
        item === previousLabel ? normalized : item
      )),
    })
  }, [actionControlStore, persistActionControlStore])

  const handleRemoveCustomActionRole = useCallback((label: string) => {
    persistActionControlStore({
      ...actionControlStore,
      panels: remapActionControlFieldInPanels(actionControlStore.panels, 'role', label, ''),
      customRoles: actionControlStore.customRoles.filter((item) => item !== label),
    })
  }, [actionControlStore, persistActionControlStore])

  const handleAddCustomActionDepartment = useCallback((label: string) => {
    const normalized = label.trim()
    if (!normalized || actionControlStore.customDepartments.includes(normalized)) return
    persistActionControlStore({
      ...actionControlStore,
      customDepartments: [...actionControlStore.customDepartments, normalized],
    })
  }, [actionControlStore, persistActionControlStore])

  const handleUpdateCustomActionDepartment = useCallback((previousLabel: string, nextLabel: string) => {
    const normalized = nextLabel.trim()
    if (!normalized || previousLabel === normalized) return
    if (actionControlStore.customDepartments.some(
      (item) => item !== previousLabel && item.toLowerCase() === normalized.toLowerCase(),
    )) {
      return
    }
    persistActionControlStore({
      ...actionControlStore,
      panels: remapActionControlFieldInPanels(actionControlStore.panels, 'department', previousLabel, normalized),
      customDepartments: actionControlStore.customDepartments.map((item) => (
        item === previousLabel ? normalized : item
      )),
    })
  }, [actionControlStore, persistActionControlStore])

  const handleRemoveCustomActionDepartment = useCallback((label: string) => {
    persistActionControlStore({
      ...actionControlStore,
      panels: remapActionControlFieldInPanels(actionControlStore.panels, 'department', label, ''),
      customDepartments: actionControlStore.customDepartments.filter((item) => item !== label),
    })
  }, [actionControlStore, persistActionControlStore])

  const handlePublishIdeaToOrganization = useCallback(async () => {
    if (!canPublishIdeaToOrganization || !tenant?.orgId) {
      addToast({
        variant: 'error',
        title: 'Publish unavailable',
        description: 'Join your organization workspace before publishing this idea.',
      })
      return
    }

    const session = getSession()
    const publishedBy = session?.user.id?.trim() ?? 'unknown'
    const publishedAt = new Date().toISOString()
    const panelsSnapshot = DEFAULT_IDEA_NAV_SECTIONS.reduce<Partial<Record<PanelKey, IdeaActionControlGroup[]>>>((acc, key) => {
      acc[key] = groupsForPanel(actionControlStore, key).map((group) => ({ ...group }))
      return acc
    }, {})

    setIsPublishingToOrganization(true)
    try {
      writeIdeaOrgPublished(idea.id, {
        organization_id: tenant.orgId,
        published_at: publishedAt,
        published_by: publishedBy,
      })

      appendOrgShareRecord({
        id: `share-${Date.now()}`,
        organization_id: tenant.orgId,
        idea_id: idea.id,
        idea_title: idea.title,
        submitted_by: publishedBy,
        submitted_at: publishedAt,
        panels: panelsSnapshot,
        custom_statuses: [...actionControlStore.customStatuses],
        custom_roles: [...actionControlStore.customRoles],
        custom_departments: [...actionControlStore.customDepartments],
      })

      persistActionControlStore({
        ...actionControlStore,
        panels: panelsSnapshot,
        publishedToOrgAt: publishedAt,
        lastSubmittedAt: publishedAt,
      })

      addToast({
        variant: 'success',
        title: 'Published to organization',
        description: 'Organization reviewers can now complete Action & Control for this idea.',
      })
    } catch (error) {
      addToast({
        variant: 'error',
        title: 'Publish failed',
        description: error instanceof Error ? error.message : 'Unable to publish this idea to the organization.',
      })
    } finally {
      setIsPublishingToOrganization(false)
    }
  }, [
    actionControlStore,
    addToast,
    canPublishIdeaToOrganization,
    idea.id,
    idea.title,
    persistActionControlStore,
    tenant?.orgId,
  ])

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

  const getSectionReviewContent = (sectionKey: PanelKey): string => {
    if (sectionKey === 'summary') {
      return [
        runtimeSummary.summary_title,
        runtimeSummary.executive_brief,
        runtimeSummary.core_pressure && `Core pressure: ${runtimeSummary.core_pressure}`,
        runtimeSummary.strategic_response && `Strategic response: ${runtimeSummary.strategic_response}`,
        runtimeSummary.value_thesis && `Value thesis: ${runtimeSummary.value_thesis}`,
        runtimeSummary.board_note && `Board note: ${runtimeSummary.board_note}`,
      ].filter(Boolean).join('\n\n')
    }
    if (sectionKey === 'scoring') {
      return [
        runtimeScoringAnalysis.summary_title,
        runtimeScoringAnalysis.executive_brief,
        runtimeScoringAnalysis.recommended_action && `Recommended action: ${runtimeScoringAnalysis.recommended_action}`,
        runtimeScoringAnalysis.commentary,
      ].filter(Boolean).join('\n\n')
    }
    if (sectionKey === 'impact') {
      return [
        `Idea: ${idea.title}`,
        `Business value: ${idea.scoring.businessValue}/10`,
        `Effort: ${idea.scoring.effort}/10`,
        `Risk: ${idea.scoring.risk}/10`,
        `ROI: ${idea.scoring.roi}/10`,
        idea.businessObjective && `Business objective: ${idea.businessObjective}`,
        idea.riskSummary && `Risk summary: ${idea.riskSummary}`,
      ].filter(Boolean).join('\n')
    }
    if (sectionKey === 'integration') {
      return [
        runtimeIntegrationAnalysis.summaryTitle,
        runtimeIntegrationAnalysis.executiveBrief,
        runtimeIntegrationAnalysis.integrationPatterns.length
          ? `Integration patterns: ${runtimeIntegrationAnalysis.integrationPatterns.join(', ')}`
          : '',
        runtimeIntegrationAnalysis.missingEvidence.length
          ? `Missing evidence: ${runtimeIntegrationAnalysis.missingEvidence.join(', ')}`
          : '',
      ].filter(Boolean).join('\n\n')
    }
    if (sectionKey === 'process') return mermaidCode
    if (sectionKey === 'costBenefit') {
      return benefitAnalysis
        ? formatCostBenefitReviewContent(benefitAnalysis)
        : 'No cost and benefit analysis is available yet.'
    }
    if (sectionKey === 'conversion') {
      return conversionTimeline
        ? formatConversionReviewContent(conversionTimeline)
        : 'No conversion timeline is available yet.'
    }
    return ideaRepositoryItems.length
      ? `Supporting documents:\n${ideaRepositoryItems.map((item) => `- ${item.name}`).join('\n')}`
      : 'No supporting documents are linked to this idea yet.'
  }

  const renderSectionReviewWorkspace = (sectionKey: PanelKey, sectionLabel: string) => (
    <IdeaSectionReviewWorkspace
      ideaId={idea.id}
      ideaTitle={idea.title}
      ideaDescription={idea.description}
      workspaceId={idea.workspace}
      userId={currentUserId || runtimeUserId}
      userName={currentUserDisplayName || submittedByDisplayName}
      sectionKey={sectionKey}
      sectionLabel={sectionLabel}
      currentContent={getSectionReviewContent(sectionKey)}
      ideaVersion={idea.version}
    />
  )

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
        onWidthChange={setRightDrawerWidth}
        activePanel={activePanel}
        onNavigatePanel={navigateToPanel}
        menuSections={menuSections}
        onReorderMenuSections={(orderedKeys) => reorderIdeaMenuSections(idea.id, orderedKeys)}
        actionControlMode={actionControlSidebarMode}
        showManualPublishFooter={showActionControlManualPublishFooter}
        orgWorkspaceNotice={orgWorkspaceNotice}
        actionControlGroups={activeActionControlGroups}
        customStatuses={actionControlStore.customStatuses}
        customRoles={actionControlStore.customRoles}
        customDepartments={actionControlStore.customDepartments}
        onUpdateActionControlGroup={handleUpdateActionControlGroup}
        onAddCustomStatus={handleAddCustomActionStatus}
        onUpdateCustomStatus={handleUpdateCustomActionStatus}
        onRemoveCustomStatus={handleRemoveCustomActionStatus}
        onAddCustomRole={handleAddCustomActionRole}
        onUpdateCustomRole={handleUpdateCustomActionRole}
        onRemoveCustomRole={handleRemoveCustomActionRole}
        onAddCustomDepartment={handleAddCustomActionDepartment}
        onUpdateCustomDepartment={handleUpdateCustomActionDepartment}
        onRemoveCustomDepartment={handleRemoveCustomActionDepartment}
        onPublishToOrganization={() => void handlePublishIdeaToOrganization()}
        isPublishingToOrganization={isPublishingToOrganization}
        canPublishToOrganization={canPublishIdeaToOrganization}
        publishShareHint={publishShareHint}
        publishedAtLabel={publishedAtLabel}
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
          { label: 'Workspace', href: workspaceManagementPath },
          { label: 'Idea & Backlog', href: ideaBacklogPath },
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
                <Badge variant="outline" className={cn('text-[10px] font-semibold', headerStatusBadgeClass)}>
                  {headerStatusLabel}
                </Badge>
                <Badge variant="outline" className={cn('text-[10px] font-semibold', typeClass[idea.type])}>
                  {idea.type}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-semibold border-blue-200 bg-blue-50 text-blue-700">
                  AI Transformation Engine
                </Badge>
                {headerDisplayTags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px] font-semibold bg-white/90 text-slate-600">
                    {tag}
                  </Badge>
                ))}
              </div>
              <h1 className="text-2xl font-semibold text-slate-900 leading-tight">{idea.title}</h1>
              <p className="text-sm text-muted-foreground">
                Workspace: <span className="font-medium text-slate-700">{workspaceDisplayName}</span>
                <span className="mx-2 text-slate-400" aria-hidden="true">{String.fromCharCode(0xb7)}</span>
                Submitted by <span className="font-medium text-slate-700">{submittedByDisplayName}</span>
                {actionControlReviewerLabel ? (
                  <>
                <span className="mx-2 text-slate-400" aria-hidden="true">{String.fromCharCode(0xb7)}</span>
                    Reviewer <span className="font-medium text-slate-700">{actionControlReviewerLabel}</span>
                  </>
                ) : null}
                <span className="mx-2 text-slate-400" aria-hidden="true">{String.fromCharCode(0xb7)}</span>
                {idea.createdAt}
              </p>
            </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
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
        {activePanel === 'summary' &&
          renderIdeaPanelWithOptionalFullscreen(
            isSummaryPanelFullscreen,
            (
        <div
            ref={ideaSummaryPanelRef}
            id="panel-summary"
            style={
              isSummaryPanelFullscreen
                ? { height: 'calc(var(--app-vh, 100dvh) - 3rem)', maxHeight: 'calc(var(--app-vh, 100dvh) - 3rem)' }
                : ideaSummaryPanelHeightPx != null
                  ? { height: ideaSummaryPanelHeightPx, maxHeight: ideaSummaryPanelHeightPx, minHeight: PROJECT_PANEL_MIN_HEIGHT_PX }
                  : undefined
            }
            className={cn(
              'scroll-mt-24',
              IDEA_SUMMARY_LIQUID_GLASS_SHELL,
              isSummaryPanelFullscreen
                ? 'h-full rounded-none border-0 bg-background'
                : 'rounded-2xl',
            )}
          >
            <div className="flex h-full min-h-0 w-full flex-col">
              <div
                className={cn(
                  'flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden',
                  isSummaryPanelFullscreen ? 'px-4 pb-3 pt-2 lg:px-5 lg:pb-4 lg:pt-2' : 'p-4 lg:p-5',
                )}
              >
                <div className="shrink-0 space-y-0 [&_h2]:leading-tight">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Sparkles className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                      <h2 className="text-lg font-semibold text-foreground">AI-Powered Idea Summary</h2>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {typeof confidence.summary === 'number' && confidence.summary > 0 ? (
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] font-semibold', confidenceClass(confidence.summary))}
                        >
                          Confidence {confidence.summary}%
                        </Badge>
                      ) : null}
                      {renderSectionReviewWorkspace('summary', 'Summary')}
                      <button
                        type="button"
                        aria-pressed={isSummaryPanelFullscreen}
                        aria-label={isSummaryPanelFullscreen ? 'Exit summary fullscreen' : 'Expand summary to fullscreen'}
                        title={isSummaryPanelFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
                        onClick={() => setIsSummaryPanelFullscreen((prev) => !prev)}
                        className={cn(
                          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/40 hover:text-foreground',
                          enterpriseControlFocusClass,
                          isSummaryPanelFullscreen &&
                            'bg-foreground text-background hover:bg-foreground/90 hover:text-background',
                        )}
                      >
                        {isSummaryPanelFullscreen ? (
                          <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="max-w-2xl text-[11px] leading-snug text-muted-foreground">
                    AI insights that transform raw ideas into decision-ready context.
                  </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-4">
              {isSummaryRefreshing && (
                <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_AGENTS_BAR, 'flex items-center gap-3 text-sm text-slate-900')}>
                  <RefreshCcw className="h-4 w-4 animate-spin text-slate-600" />
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
                <div className={IDEA_SUMMARY_LIQUID_GLASS_AGENTS_BAR}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    AI agents &amp; models
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {summaryRoleModels.map((entry) => (
                      <Badge
                        key={entry.roleId}
                        variant="outline"
                        title={entry.modelId}
                        className="border-white/70 bg-white/55 text-[11px] font-medium text-slate-800 backdrop-blur-md"
                      >
                        <span className="font-semibold text-slate-900">{entry.roleLabel}</span>
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
                <Card className={IDEA_SUMMARY_LIQUID_GLASS_CARD}>
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.82),transparent_30%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.38),transparent_34%)]" />
                  <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/80" />
                  <CardContent className="relative z-10 p-0">
                    <div className="border-b border-white/45 bg-white/20 px-6 py-5 backdrop-blur-xl">
                      <div className="min-w-0 space-y-3">
                          <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 backdrop-blur-md">
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
                      <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-4')}>
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

                      <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-4')}>
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

                      <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-4')}>
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

                    <div className="grid grid-cols-1 gap-3 border-t border-white/45 bg-white/20 px-6 py-5 backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
                      {summaryKpiCards.slice(0, 4).map((card, index) => {
                        const shown = displaySummaryKpiCard(card, idea)
                        return (
                        <div key={`${card.label}-${index}`} className={cn(IDEA_SUMMARY_LIQUID_GLASS_TILE, 'p-4')}>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{shown.label}</p>
                          {isSummaryRefreshing ? (
                            <div className="mt-2 space-y-2 animate-pulse">
                              <div className="h-7 w-2/3 rounded-md bg-slate-200" />
                              <div className="h-3.5 w-full rounded-md bg-slate-200" />
                            </div>
                          ) : (
                            <>
                              <p className="mt-2 text-2xl font-semibold text-slate-950">{shown.value}</p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">{shown.detail}</p>
                              {shown.reason && (
                                <p className="mt-2 border-t border-slate-200/70 pt-2 text-[11px] leading-4 text-slate-400 italic">{shown.reason}</p>
                              )}
                            </>
                          )}
                        </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>

                {summaryDecisionSignal && (
                  <Card className={IDEA_SUMMARY_LIQUID_GLASS_CARD}>
                    <CardContent className="relative z-10 space-y-4 p-5">
                      <div className="flex items-center justify-between border-b border-white/45 pb-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Decision Signal</p>
                          <h3 className="mt-1 text-base font-semibold text-slate-950">Enterprise Readiness</h3>
                        </div>
                        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-3 py-1.5 text-right backdrop-blur-md">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Priority</p>
                          {isSummaryRefreshing ? (
                            <div className="mt-1 h-4 w-20 rounded-md bg-emerald-100 animate-pulse" />
                          ) : (
                            <p className="text-sm font-semibold text-emerald-800">{displaySummaryPriority(summaryDecisionSignal.priority, idea)}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-3.5')}>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Overall Score</p>
                          {isSummaryRefreshing ? (
                            <div className="mt-2 space-y-2 animate-pulse">
                              <div className="h-8 w-16 rounded-md bg-slate-200" />
                              <div className="h-3 w-full rounded-md bg-slate-200" />
                              <div className="h-3 w-10/12 rounded-md bg-slate-200" />
                            </div>
                          ) : (
                            <>
                              <p className="mt-2 text-3xl font-semibold leading-none text-slate-950">
                                {displaySummaryOverallScore(summaryDecisionSignal.overall_score, idea)}
                              </p>
                              <p className="mt-2 text-xs text-slate-500">Composite signal from value, ROI, effort, and execution risk.</p>
                            </>
                          )}
                        </div>
                        <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-3.5')}>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Decision Bias</p>
                          {isSummaryRefreshing ? (
                            <div className="mt-2 space-y-2 animate-pulse">
                              <div className="h-5 w-28 rounded-md bg-slate-200" />
                              <div className="h-3 w-full rounded-md bg-slate-200" />
                              <div className="h-3 w-9/12 rounded-md bg-slate-200" />
                            </div>
                          ) : (
                            <>
                              <p className="mt-2 text-lg font-semibold text-slate-950">{displaySummaryDecisionBias(summaryDecisionSignal.decision_bias, idea)}</p>
                              <p className="mt-2 text-xs text-slate-500">
                                {hasNumericIntakeScoring(idea)
                                  ? summaryDecisionSignal.decision_bias_detail
                                  : 'BV, ROI, Effort, and Risk are still 0, so the composite score is not calculated.'}
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-4 text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md">
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
                <Card className={IDEA_SUMMARY_LIQUID_GLASS_CARD}>
                  <CardContent className="relative z-10 space-y-4 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Strategic Framing</p>
                        <h3 className="mt-1 text-base font-semibold text-slate-950">Where enterprise value is expected</h3>
                      </div>
                      <Badge variant="outline" className="border-white/70 bg-white/55 text-[10px] font-semibold text-slate-600 backdrop-blur-md">
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
                          <div key={`${item.title}-${index}`} className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-4')}>
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

                <Card className={IDEA_SUMMARY_LIQUID_GLASS_CARD}>
                  <CardContent className="relative z-10 space-y-4 p-5">
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
                        <Badge variant="outline" className="border-emerald-200/80 bg-emerald-50/70 text-[10px] font-semibold text-emerald-700 backdrop-blur-md">
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
                          <div key={`${signal.title}-${index}`} className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'flex gap-3 p-3.5')}>
                            <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl backdrop-blur-md', iconWrapClass)}>
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
                </div>
              </div>
            </div>
          </div>
            ),
          )}


        {activePanel === 'scoring' &&
          renderIdeaPanelWithOptionalFullscreen(
            isScoringPanelFullscreen,
            (
        <div
            ref={ideaScoringPanelRef}
            id="panel-scoring"
            style={
              isScoringPanelFullscreen
                ? { height: 'calc(var(--app-vh, 100dvh) - 3rem)', maxHeight: 'calc(var(--app-vh, 100dvh) - 3rem)' }
                : ideaScoringPanelHeightPx != null
                  ? { height: ideaScoringPanelHeightPx, maxHeight: ideaScoringPanelHeightPx, minHeight: PROJECT_PANEL_MIN_HEIGHT_PX }
                  : undefined
            }
            className={cn(
              'scroll-mt-24',
              IDEA_SUMMARY_LIQUID_GLASS_SHELL,
              isScoringPanelFullscreen
                ? 'h-full rounded-none border-0 bg-background'
                : 'rounded-2xl',
            )}
          >
            <div className="flex h-full min-h-0 w-full flex-col">
              <div
                className={cn(
                  'flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden',
                  isScoringPanelFullscreen ? 'px-4 pb-3 pt-2 lg:px-5 lg:pb-4 lg:pt-2' : 'p-4 lg:p-5',
                )}
              >
                <div className="shrink-0 space-y-0 [&_h2]:leading-tight">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Gauge className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                      <h2 className="text-lg font-semibold text-foreground">AI Evaluation &amp; Scoring</h2>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {showScoringFrameworkDraft && !isScoringRefreshing ? (
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-50 text-[10px] font-semibold text-amber-800"
                        >
                          Pending evidence
                        </Badge>
                      ) : null}
                      {typeof confidence.scoring === 'number' && confidence.scoring > 0 ? (
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] font-semibold', confidenceClass(confidence.scoring))}
                        >
                          Confidence {confidence.scoring}%
                        </Badge>
                      ) : null}
                      {renderSectionReviewWorkspace('scoring', 'Scoring')}
                      <button
                        type="button"
                        aria-pressed={isScoringPanelFullscreen}
                        aria-label={isScoringPanelFullscreen ? 'Exit scoring fullscreen' : 'Expand scoring to fullscreen'}
                        title={isScoringPanelFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
                        onClick={() => setIsScoringPanelFullscreen((prev) => !prev)}
                        className={cn(
                          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/40 hover:text-foreground',
                          enterpriseControlFocusClass,
                          isScoringPanelFullscreen &&
                            'bg-foreground text-background hover:bg-foreground/90 hover:text-background',
                        )}
                      >
                        {isScoringPanelFullscreen ? (
                          <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="max-w-2xl text-[11px] leading-snug text-muted-foreground">
                    Feasibility and priority scoring with AI explanation.
                  </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-4">
              {isScoringRefreshing && (
                <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_AGENTS_BAR, 'flex items-center gap-3 text-sm text-slate-900')}>
                  <RefreshCcw className="h-4 w-4 animate-spin text-slate-600" />
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

              {showScoringFrameworkDraft && !isScoringRefreshing ? (
                <ScoringFrameworkSection
                  ideaTitle={idea.title}
                  scoreData={scoreData}
                  totalScore={totalScore}
                  hasNumericScoring={hasNumericScoring}
                  priorityLabel={priorityLabel}
                />
              ) : null}

              {scoringMissing && !scoringGenerationError && !isScoringRefreshing && (
                <ScoringDraftReadinessCard
                  title={runtimeScoringAnalysis.summary_title || 'Scoring evidence is not sufficient yet'}
                  executiveBrief={
                    runtimeScoringAnalysis.executive_brief
                    || 'Complete intake evidence below so AI can produce an honest scoring assessment without inventing numbers.'
                  }
                  missingFields={runtimeScoringAnalysis.missing_fields}
                  evidenceItems={scoringEvidenceItems}
                  readinessPercent={confidence.scoring}
                  hasNumericScoring={hasNumericScoring}
                  onNavigateToPanel={navigateToPanel}
                  onOpenBacklog={openIdeaBacklogForScoring}
                />
              )}

              {!scoringGenerationError && scoringLoaded && (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.55fr_0.95fr]">
                  <Card className={IDEA_SUMMARY_LIQUID_GLASS_CARD}>
                    <CardContent className="relative z-10 space-y-3 p-3.5">
                      <div className="flex flex-col gap-2.5 border-b border-white/45 pb-2.5 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            <Sparkles className="h-3.5 w-3.5 text-slate-600" />
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
                        <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-3')}>
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

                        <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-3')}>
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

                        <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-3')}>
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
                        <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'rounded-[24px] p-3.5')}>
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Scoring Composition</p>
                              <h4 className="mt-1 text-sm font-semibold text-slate-950">Raw score dimensions from Idea &amp; Backlog</h4>
                            </div>
                            <Badge variant="outline" className="border-white/70 bg-white/55 text-[10px] font-semibold text-slate-600 backdrop-blur-md">
                              Backlog Source
                            </Badge>
                          </div>
                          <div className="h-[165px] lg:h-[150px] xl:h-[165px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={scoreData} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis
                                  dataKey="label"
                                  tick={({ x, y, payload }) => {
                                    const row = scoreData.find((item) => item.label === payload.value)
                                    return (
                                      <text x={x} y={y} dy={12} textAnchor="middle" fontSize={11} fill={row?.fill ?? '#64748b'}>
                                        {payload.value}
                                      </text>
                                    )
                                  }}
                                  axisLine={false}
                                  tickLine={false}
                                />
                                <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <RechartsTooltip
                                  cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                                  contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 18px 40px -28px rgba(15,23,42,0.45)' }}
                                  formatter={(value, _name, props) => {
                                    const row = props.payload as ScoringDimensionRow | undefined
                                    return [`${value}/10`, row?.label ?? 'Score']
                                  }}
                                />
                                <Bar dataKey="score" radius={[10, 10, 0, 0]} barSize={42}>
                                  {scoreData.map((item) => (
                                    <Cell key={item.label} fill={scoringBarFill(item, hasNumericScoring)} />
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
                          }))).slice(0, 4).map((item) => {
                            const theme = scoreData.find((row) => row.label === item.label)
                            return (
                            <div
                              key={item.label}
                              className={cn(
                                IDEA_SUMMARY_LIQUID_GLASS_TILE,
                                'rounded-2xl border p-3',
                                theme?.borderClass ?? 'border-white/60',
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className={cn('text-[13px] font-semibold', theme?.textClass ?? 'text-slate-900')}>{item.label}</p>
                                  <p className="mt-1 text-[11px] leading-4 text-slate-500">{item.detail}</p>
                                </div>
                                <div
                                  className="rounded-xl px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
                                  style={{ backgroundColor: theme?.fill ?? '#334155' }}
                                >
                                  {item.value}
                                </div>
                              </div>
                            </div>
                            )
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={IDEA_SUMMARY_LIQUID_GLASS_CARD}>
                    <CardContent className="relative z-10 space-y-2.5 p-3.5">
                      <div className="flex items-center justify-between border-b border-white/45 pb-2.5">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Board Recommendation</p>
                          <h3 className="mt-1 text-sm font-semibold text-slate-950">Enterprise investment signal</h3>
                        </div>
                        <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_TILE, 'rounded-xl px-3 py-1.5 text-right')}>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Priority</p>
                          <p className="text-sm font-semibold text-slate-900">
                            {runtimeScoringAnalysis.priority || priorityLabel}
                          </p>
                        </div>
                      </div>

                      <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'rounded-[24px] p-3.5')}>
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
                        <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-3')}>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Primary Strength</p>
                          <p className="mt-1.5 text-sm font-semibold text-slate-950">
                            {runtimeScoringAnalysis.primary_strength}
                          </p>
                          <p className="mt-1.5 text-xs leading-5 text-slate-500">
                            {runtimeScoringAnalysis.primary_strength_detail}
                          </p>
                        </div>
                        <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-3')}>
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
                        <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'flex gap-3 p-3')}>
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50/80 text-emerald-700 backdrop-blur-md">
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

                        <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'flex gap-3 p-3')}>
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50/80 text-amber-700 backdrop-blur-md">
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

                      <div className="rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">AI Commentary</p>
                        <p className="mt-2 text-xs leading-5 text-slate-200">
                          {runtimeScoringAnalysis.commentary}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
                </div>
              </div>
            </div>
          </div>
            ),
          )}

        {activePanel === 'impact' &&
          renderIdeaPanelWithOptionalFullscreen(
            isImpactPanelFullscreen,
            (
        <div
            ref={ideaImpactPanelRef}
            id="panel-impact"
            style={
              isImpactPanelFullscreen
                ? { height: 'calc(var(--app-vh, 100dvh) - 3rem)', maxHeight: 'calc(var(--app-vh, 100dvh) - 3rem)' }
                : ideaImpactPanelHeightPx != null
                  ? { height: ideaImpactPanelHeightPx, maxHeight: ideaImpactPanelHeightPx, minHeight: PROJECT_PANEL_MIN_HEIGHT_PX }
                  : undefined
            }
            className={cn(
              'scroll-mt-24',
              IDEA_SUMMARY_LIQUID_GLASS_SHELL,
              isImpactPanelFullscreen
                ? 'h-full rounded-none border-0 bg-background'
                : 'rounded-2xl',
            )}
          >
            <div className="flex h-full min-h-0 w-full flex-col">
              <div
                className={cn(
                  'flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden',
                  isImpactPanelFullscreen ? 'px-4 pb-3 pt-2 lg:px-5 lg:pb-4 lg:pt-2' : 'p-4 lg:p-5',
                )}
              >
                <div className="shrink-0 space-y-0 [&_h2]:leading-tight">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Target className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                      <h2 className="text-lg font-semibold text-foreground">AI Impact Analysis</h2>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {typeof confidence.impact === 'number' ? (
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] font-semibold', confidenceClass(confidence.impact))}
                        >
                          Confidence {confidence.impact}%
                        </Badge>
                      ) : null}
                      {renderSectionReviewWorkspace('impact', 'Impact')}
                      <button
                        type="button"
                        aria-pressed={isImpactPanelFullscreen}
                        aria-label={isImpactPanelFullscreen ? 'Exit impact fullscreen' : 'Expand impact to fullscreen'}
                        title={isImpactPanelFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
                        onClick={() => setIsImpactPanelFullscreen((prev) => !prev)}
                        className={cn(
                          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/40 hover:text-foreground',
                          enterpriseControlFocusClass,
                          isImpactPanelFullscreen &&
                            'bg-foreground text-background hover:bg-foreground/90 hover:text-background',
                        )}
                      >
                        {isImpactPanelFullscreen ? (
                          <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="max-w-2xl text-[11px] leading-snug text-muted-foreground">
                    Multi-dimensional impact assessment with positive indicators and control areas.
                  </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.52fr_0.88fr]">
                <Card className={IDEA_SUMMARY_LIQUID_GLASS_CARD}>
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.82),transparent_30%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.38),transparent_34%)]" />
                  <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/80" />
                  <div className="relative z-10 border-b border-white/45 bg-white/20 px-4 py-4 backdrop-blur-xl">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                      <div className="max-w-3xl">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          <Sparkles className="h-3.5 w-3.5 text-slate-600" />
                          Executive Impact Canvas
                        </div>
                        <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950">Multi finance transformation value with measurable guardrails</h3>
                        <p className="mt-1.5 text-sm leading-5 text-slate-600">
                          This proposal delivers high value for multi finance operations by improving intervention timing, reducing critical case backlogs, and strengthening service visibility, provided process adoption and the governance model are kept disciplined.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[400px]">
                        <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_TILE, 'px-3 py-2.5')}>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Reach</p>
                          <p className="mt-1.5 text-xl font-semibold text-slate-950">5</p>
                          <p className="text-[11px] text-slate-500">domains</p>
                        </div>
                        <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_TILE, 'px-3 py-2.5')}>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Bias</p>
                          <p className="mt-1.5 text-sm font-semibold text-emerald-700">Upside-led</p>
                          <p className="text-[11px] text-slate-500">value posture</p>
                        </div>
                        <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_TILE, 'px-3 py-2.5')}>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Watch</p>
                          <p className="mt-1.5 text-sm font-semibold text-amber-700">Adoption</p>
                          <p className="text-[11px] text-slate-500">operating fit</p>
                        </div>
                        <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_TILE, 'px-3 py-2.5')}>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Board View</p>
                          <p className="mt-1.5 text-sm font-semibold text-sky-700">Sponsor</p>
                          <p className="text-[11px] text-slate-500">with controls</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <CardContent className="relative z-10 p-4 space-y-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.15fr_0.85fr]">
                      <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'rounded-[26px] p-3.5')}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Investment Narrative</p>
                            <h4 className="mt-1 text-base font-semibold text-slate-950">The strongest value comes from timing, not just automation</h4>
                          </div>
                          <Badge variant="outline" className="border-white/70 bg-white/55 text-[10px] font-semibold text-slate-700 backdrop-blur-md">
                            Multi-domain signal
                          </Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                          <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_TILE, 'p-3')}>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Strategic value</p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-emerald-700" />
                              <p className="text-sm font-semibold text-slate-950">Predictive control</p>
                            </div>
                            <p className="mt-1.5 text-[12px] leading-5 text-slate-500">Brings escalation response earlier in the approval cycle.</p>
                          </div>
                          <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_TILE, 'p-3')}>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Operating effect</p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <Cpu className="h-4 w-4 text-indigo-700" />
                              <p className="text-sm font-semibold text-slate-950">Earlier intervention</p>
                            </div>
                            <p className="mt-1.5 text-[12px] leading-5 text-slate-500">Creates room for action before escalation pressure builds.</p>
                          </div>
                          <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_TILE, 'p-3')}>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Governance focus</p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <TriangleAlert className="h-4 w-4 text-amber-700" />
                              <p className="text-sm font-semibold text-slate-950">Adoption and drift</p>
                            </div>
                            <p className="mt-1.5 text-[12px] leading-5 text-slate-500">Control quality decides how much of the upside is retained.</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[26px] border border-white/10 bg-slate-950/90 p-3.5 text-slate-50 shadow-[0_22px_50px_-34px_rgba(15,23,42,0.55)] backdrop-blur-md">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Board Signal</p>
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
                          positive: 'Improves approval SLA predictability',
                          negative: 'Requires change adoption',
                          signal: 'High upside',
                          accent: '#0ea5e9',
                        },
                        {
                          icon: Cpu,
                          title: 'Operational impact',
                          lens: 'Process control',
                          positive: 'Earlier intervention capability',
                          negative: 'New governance workflow overhead',
                          signal: 'Medium effort',
                          accent: '#6366f1',
                        },
                        {
                          icon: UserRound,
                          title: 'Customer impact',
                          lens: 'Experience continuity',
                          positive: 'Reduces delays in downstream processes',
                          negative: 'Initial model calibration period',
                          signal: 'Visible benefit',
                          accent: '#10b981',
                        },
                        {
                          icon: DollarSign,
                          title: 'Financial impact',
                          lens: 'Cost resilience',
                          positive: 'Reduces process variance and rework cost',
                          negative: 'Upfront implementation spend',
                          signal: 'ROI case',
                          accent: '#f59e0b',
                        },
                        {
                          icon: TriangleAlert,
                          title: 'Risk impact',
                          lens: 'Governance readiness',
                          positive: 'Risk exposure becomes visible sooner',
                          negative: 'Model drift needs routine monitoring',
                          signal: 'Managed exposure',
                          accent: '#f43f5e',
                        },
                      ].map((item, index) => (
                        <Card
                          key={item.title}
                          className={cn(
                            IDEA_SUMMARY_LIQUID_GLASS_CARD,
                            'relative overflow-hidden',
                            index === 4 && 'md:col-span-2 xl:col-span-2',
                          )}
                        >
                          <div className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: item.accent }} />
                          <CardContent className="relative z-10 p-3.5 pl-4.5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_TILE, 'flex h-11 w-11 items-center justify-center rounded-2xl')} style={{ color: item.accent }}>
                                  <item.icon className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.lens}</p>
                                  <h4 className="mt-1 text-base font-semibold text-slate-950">{item.title}</h4>
                                </div>
                              </div>
                              <Badge variant="outline" className="border-white/70 bg-white/55 text-[10px] font-semibold text-slate-700 backdrop-blur-md">
                                {item.signal}
                              </Badge>
                            </div>

                            <div className={cn('mt-3 space-y-2.5', index === 4 && 'xl:grid xl:grid-cols-2 xl:gap-3 xl:space-y-0')}>
                              <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_TILE, 'border-emerald-200/80 p-3')}>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Value unlock</p>
                                <p className="mt-1 text-sm leading-5 text-slate-900">{item.positive}</p>
                              </div>
                              <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_TILE, 'border-rose-200/80 p-3')}>
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

                <Card className={IDEA_SUMMARY_LIQUID_GLASS_CARD}>
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.82),transparent_30%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.38),transparent_34%)]" />
                  <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/80" />
                  <div className="relative z-10 border-b border-white/45 bg-white/20 px-4 py-4 backdrop-blur-xl">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Impact Recommendation</p>
                        <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Executive action frame</h3>
                      </div>
                      <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_TILE, 'flex h-11 w-11 items-center justify-center rounded-2xl text-slate-700')}>
                        <Target className="h-5 w-5" />
                      </div>
                    </div>
                  </div>

                  <CardContent className="relative z-10 space-y-3 p-4">
                    <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'rounded-[26px] p-3.5')}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Decision stance</p>
                      <p className="mt-1.5 text-[24px] font-semibold leading-tight text-slate-950">
                        Advance as an AI capability grounded in operational control
                      </p>
                      <p className="mt-2.5 text-sm leading-5 text-slate-600">
                        The business case is strong, but the best outcome depends on treating change adoption, ownership design, and calibration quality as funded delivery controls.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-3.5')}>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Best-case outcome</p>
                        <p className="mt-2 text-base font-semibold text-slate-950">Earlier intervention, lower variance</p>
                      </div>
                      <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-3.5')}>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Critical control</p>
                        <p className="mt-2 text-base font-semibold text-slate-950">Adoption governance and model drift</p>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-3')}>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50/90 text-emerald-700 backdrop-blur-md">
                            <TrendingUp className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-950">Impact is strongest where timing matters most</p>
                            <p className="mt-1 text-sm leading-5 text-slate-600">
                              The model creates value by surfacing delay risk signals before a case turns into a critical escalation.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-3')}>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50/90 text-amber-700 backdrop-blur-md">
                            <TriangleAlert className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-950">Change enablement should be funded from the start</p>
                            <p className="mt-1 text-sm leading-5 text-slate-600">
                              Without clear operating ownership, workflow load can offset part of the projected upside.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-3')}>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50/90 text-sky-700 backdrop-blur-md">
                            <Sparkles className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-950">Recommended next step</p>
                            <p className="mt-1 text-sm leading-5 text-slate-600">
                              Position this as a phased governance strengthening effort, not just an AI feature deployment.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'rounded-[26px] p-3.5')}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">AI Commentary</p>
                      <p className="mt-2 text-sm leading-5 text-slate-600">
                        The AI assessment indicates this proposal has high cross-functional benefit with managed downside, as long as the operating model sets adoption quality and calibration as explicit executive controls.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
                </div>
              </div>
            </div>
          </div>
            ),
          )}

        {activePanel === 'diagrams' && (
        <div id="panel-diagrams" className="scroll-mt-24">
        {renderIdeaPanelWithOptionalFullscreen(
          isDiagramsPanelFullscreen,
          (
        <div
            ref={ideaDiagramsPanelRef}
            style={
              isDiagramsPanelFullscreen
                ? { height: 'calc(var(--app-vh, 100dvh) - 3rem)', maxHeight: 'calc(var(--app-vh, 100dvh) - 3rem)' }
                : ideaDiagramsPanelHeightPx != null
                  ? { height: ideaDiagramsPanelHeightPx, maxHeight: ideaDiagramsPanelHeightPx, minHeight: PROJECT_PANEL_MIN_HEIGHT_PX }
                  : undefined
            }
            className={cn(
              IDEA_SUMMARY_LIQUID_GLASS_SHELL,
              isDiagramsPanelFullscreen ? 'h-full rounded-none border-0 bg-background' : 'rounded-2xl',
            )}
          >
            <div className="flex h-full min-h-0 w-full flex-col">
              <div
                className={cn(
                  'flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden',
                  isDiagramsPanelFullscreen ? 'px-4 pb-3 pt-2 lg:px-5 lg:pb-4 lg:pt-2' : 'p-4 lg:p-5',
                )}
              >
                <div className="shrink-0 space-y-0 [&_h2]:leading-tight">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Workflow className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                      <h2 className="text-lg font-semibold text-foreground">Diagrams</h2>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {/* No single confidence badge here — each diagram family below (ArchiMate,
                          C4 L1/L2, BPMN) is generated independently and shows its own confidence
                          on its own card, so one number at this level would misrepresent the rest. */}
                      {renderSectionReviewWorkspace('integration', 'Integration')}
                      <button
                        type="button"
                        aria-pressed={isDiagramsPanelFullscreen}
                        aria-label={isDiagramsPanelFullscreen ? 'Exit diagrams fullscreen' : 'Expand diagrams to fullscreen'}
                        title={isDiagramsPanelFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
                        onClick={() => setIsDiagramsPanelFullscreen((prev) => !prev)}
                        className={cn(
                          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/40 hover:text-foreground',
                          enterpriseControlFocusClass,
                          isDiagramsPanelFullscreen &&
                            'bg-foreground text-background hover:bg-foreground/90 hover:text-background',
                        )}
                      >
                        {isDiagramsPanelFullscreen ? (
                          <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="max-w-2xl text-[11px] leading-snug text-muted-foreground">
                    AI-generated architecture and business process diagrams for this idea.
                  </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col rounded-2xl border border-border/40 bg-white/85 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 shrink-0 text-foreground" aria-hidden />
                    <span className="text-sm font-semibold text-foreground">ArchiMate Integration</span>
                  </div>
                  {integrationLoaded && typeof confidence.integration === 'number' && confidence.integration > 0 ? (
                    <Badge variant="outline" className={cn('shrink-0 text-[10px] font-semibold', confidenceClass(confidence.integration))}>
                      {confidence.integration}%
                    </Badge>
                  ) : null}
                </div>
                <div className="relative mt-2 h-32 overflow-hidden rounded-xl border border-border/30 bg-slate-50">
                  {(() => {
                    // The canvas itself falls back to its own localStorage cache
                    // (`loadIntegrationGraph`) when the backend-synced `integrationBootstrapRecord`
                    // hasn't resolved yet on this mount — mirror that same fallback here so the
                    // thumbnail doesn't flash "no diagram" while the canvas is already showing one.
                    // Once the fetch has genuinely completed (`integrationLoaded`), stop consulting
                    // localStorage even if the record is null/empty — otherwise a stale cached
                    // diagram from a previous (possibly pre-bugfix, possibly unrelated) session can
                    // silently outlive a fresh "insufficient_data" or parse-failed result, which is
                    // exactly the "still showing a mockup" confusion this was causing.
                    const graph = integrationBootstrapRecord ?? (integrationLoaded ? null : loadIntegrationGraph(idea.id))
                    if (graph && graph.nodes.length > 0) {
                      return (
                        <ReactFlow
                          nodes={graph.nodes}
                          edges={graph.edges}
                          nodeTypes={integrationArchimateNodeTypes}
                          fitView
                          fitViewOptions={{ padding: 0.15 }}
                          nodesDraggable={false}
                          nodesConnectable={false}
                          elementsSelectable={false}
                          panOnDrag={false}
                          zoomOnScroll={false}
                          zoomOnPinch={false}
                          zoomOnDoubleClick={false}
                          proOptions={{ hideAttribution: true }}
                        />
                      )
                    }
                    return (
                      <div className="flex h-full w-full items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                        {isIntegrationRefreshing ? (
                          <>
                            <RefreshCcw className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            Building diagram…
                          </>
                        ) : integrationGenerationError ? (
                          <span className="text-rose-600">{integrationGenerationError}</span>
                        ) : (
                          "AI couldn't produce a diagram — not enough evidence in this idea yet"
                        )}
                      </div>
                    )
                  })()}
                  <button
                    type="button"
                    aria-label="Open ArchiMate canvas"
                    onClick={() => setIsIntegrationPanelFullscreen(true)}
                    className="absolute inset-0 z-10"
                  />
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                  Integration architecture recommendation with ArchiMate canvas and PlantUML source.
                </p>
              </div>

              {brainstormProcessDiagrams.length > 0 ? (
                brainstormProcessDiagrams.map((diagram) => (
                  <div
                    key={`${diagram.label}-${diagram.source.slice(0, 48)}`}
                    className="flex flex-col rounded-2xl border border-border/40 bg-white/85 p-4 shadow-sm"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{diagram.label}</p>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                      Process diagram from brainstorming during Create Idea.
                    </p>
                    <div className="mt-2">
                      <AssistantMermaidBlock source={diagram.source} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border/50 bg-white/60 p-6 text-center">
                  <Workflow className="h-5 w-5 text-muted-foreground" aria-hidden />
                  <p className="text-xs font-semibold text-slate-600">No process diagram from brainstorming yet</p>
                  <p className="text-[11px] text-muted-foreground">
                    AS-IS/TO-BE diagrams will appear here once they're drawn during Create Idea.
                  </p>
                </div>
              )}

              <DiagramGalleryCard
                title="C4 Level 1"
                icon={Layers}
                description="System context diagram (C4)."
                imageSrc={c4Level1Preview.objectUrl}
                imageLoading={c4Level1Preview.isLoading}
                imageError={c4Level1Preview.error}
                missing={c4Level1Missing}
                generationError={c4Level1GenerationError}
                confidence={c4Level1Loaded ? confidence.c4Level1 : null}
                isRegenerating={regenerating.c4Level1}
                onRegenerate={() => regeneratePanel('c4Level1')}
              />
              <DiagramGalleryCard
                title="C4 Level 2"
                icon={Cpu}
                description="Container diagram (C4)."
                imageSrc={c4Level2Preview.objectUrl}
                imageLoading={c4Level2Preview.isLoading}
                imageError={c4Level2Preview.error}
                missing={c4Level2Missing}
                generationError={c4Level2GenerationError}
                confidence={c4Level2Loaded ? confidence.c4Level2 : null}
                isRegenerating={regenerating.c4Level2}
                onRegenerate={() => regeneratePanel('c4Level2')}
              />
              <DiagramGalleryCard
                title="BPMN High-Level"
                icon={Workflow}
                description="BPMN 2.0 business process diagram."
                imageSrc={bpmnHighAnalysis.renderedPngBase64 ? `data:image/png;base64,${bpmnHighAnalysis.renderedPngBase64}` : null}
                missing={bpmnHighMissing}
                generationError={bpmnHighGenerationError}
                confidence={bpmnHighLoaded ? confidence.bpmnHigh : null}
                isRegenerating={regenerating.bpmnHigh}
                onRegenerate={() => regeneratePanel('bpmnHigh')}
              />

              {bpmnHighAnalysis.subProcesses.length === 0 ? (
                <div className="flex flex-col justify-between rounded-2xl border border-dashed border-border/40 bg-muted/10 p-4 opacity-60">
                  <div className="flex items-center gap-2">
                    <ListTree className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="text-sm font-semibold text-muted-foreground">BPMN Detail</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                    Generate BPMN High-Level first to see per-step detail.
                  </p>
                </div>
              ) : (
                bpmnHighAnalysis.subProcesses.map((task: ProcessSubTask) => {
                  const detail = processDetailsByKey[task.key]
                  return (
                    <DiagramGalleryCard
                      key={task.key}
                      title={`Detail: ${task.label}`}
                      icon={ListTree}
                      description="Per-step process detail (BPMN)."
                      imageSrc={
                        detail?.analysis.renderedPngBase64
                          ? `data:image/png;base64,${detail.analysis.renderedPngBase64}`
                          : null
                      }
                      missing={detail?.missing ?? true}
                      generationError={detail?.generationError ?? null}
                      confidence={detail?.loaded ? Math.round(Math.max(0, Math.min(1, detail.analysis.confidenceScore)) * 100) : null}
                      isRegenerating={detail?.isRegenerating ?? false}
                      onRegenerate={() => void loadRuntimeProcessDetail(task.key, task.label, idea, { forceRefresh: true })}
                    />
                  )
                })
              )}
            </div>

            {brainstormProcessDiagrams.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
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
            )}

            {showMermaidCode && brainstormProcessDiagrams.length > 0 && (
              <pre className="mt-3 rounded-xl border border-border/40 bg-slate-950 p-3 text-xs text-slate-100 overflow-auto">
                {mermaidCode}
              </pre>
            )}
                </div>
              </div>
            </div>
          </div>
          ),
        )}

          {isIntegrationPanelFullscreen && (
            <div className="fixed inset-x-0 top-12 bottom-0 z-50">
              <div className="liquid-glass-enterprise-filter-bar flex h-full min-h-0 flex-col overflow-hidden rounded-none border-0 bg-background shadow-[0_18px_44px_rgba(15,23,42,0.12)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden px-4 pb-3 pt-2 lg:px-5 lg:pb-4 lg:pt-2">
                  <div className="shrink-0 space-y-0 [&_h2]:leading-tight">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <GitBranch className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                        <h2 className="text-lg font-semibold text-foreground">AI Integration Recommendation</h2>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {integrationLoaded && typeof confidence.integration === 'number' ? (
                          <Badge
                            variant="outline"
                            className={cn('text-[10px] font-semibold', confidenceClass(confidence.integration))}
                          >
                            Confidence {confidence.integration}%
                          </Badge>
                        ) : null}
                        {renderSectionReviewWorkspace('integration', 'Integration')}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => regeneratePanel('integration')}
                          disabled={isIntegrationRefreshing}
                        >
                          <RefreshCcw className={cn('mr-1.5 h-3.5 w-3.5', isIntegrationRefreshing && 'animate-spin')} aria-hidden />
                          Regenerate
                        </Button>
                        <button
                          type="button"
                          aria-label="Exit integration fullscreen"
                          title="Exit fullscreen (Esc)"
                          onClick={() => setIsIntegrationPanelFullscreen(false)}
                          className={cn(
                            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/40 hover:text-foreground',
                            enterpriseControlFocusClass,
                            'bg-foreground text-background hover:bg-foreground/90 hover:text-background',
                          )}
                        >
                          <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>
                    <p className="max-w-2xl text-[11px] leading-snug text-muted-foreground">
                      Integration architecture recommendation with ArchiMate canvas and PlantUML source.
                    </p>
                  </div>

                  <div className="min-h-0 flex-1 overflow-hidden">
                    <EditableIntegrationArchitectureCanvas
                      ideaId={idea.id}
                      bootstrapKey={integrationBootstrapKey}
                      bootstrapRecord={integrationBootstrapRecord}
                      isGenerating={isIntegrationRefreshing}
                      fillHeight
                      hideStudioHeader
                      studioOverlay={false ? (
                        <>
                          {runtimeIntegrationAnalysis.status === 'insufficient_data' &&
                          integrationLoaded &&
                          !isIntegrationRefreshing ? (
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] text-amber-800">
                                Evidence kurang
                              </Badge>
                            </div>
                          ) : null}

                          {isIntegrationRefreshing && (
                            <div className="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs text-sky-900">
                              <RefreshCcw className="h-3.5 w-3.5 animate-spin text-sky-600" />
                              <span>Tectona Assistant menyusun rekomendasi integrasi…</span>
                            </div>
                          )}

                          {integrationGenerationError && !isIntegrationRefreshing && (
                            <div
                              role="alert"
                              className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-900"
                            >
                              <span className="font-semibold text-rose-800">Analisis integrasi gagal — </span>
                              {integrationGenerationError}
                            </div>
                          )}

                          {integrationLoaded && !integrationGenerationError && (
                            <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50"
                                onClick={() => setIntegrationBriefExpanded((prev) => !prev)}
                              >
                                <ChevronDown
                                  className={cn(
                                    'h-4 w-4 shrink-0 text-slate-500 transition-transform',
                                    integrationBriefExpanded && 'rotate-180',
                                  )}
                                />
                                <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800">
                                  {runtimeIntegrationAnalysis.summaryTitle}
                                </span>
                              </button>
                              {integrationBriefExpanded && (
                                <div className="max-h-32 space-y-2 overflow-y-auto border-t border-border/30 px-3 py-2 text-xs text-slate-600">
                                  <p className="leading-5">{runtimeIntegrationAnalysis.executiveBrief}</p>
                                  {runtimeIntegrationAnalysis.integrationPatterns.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                      {runtimeIntegrationAnalysis.integrationPatterns.map((pattern) => (
                                        <Badge key={pattern} variant="outline" className="border-sky-200 bg-sky-50 text-[10px] text-sky-800">
                                          {pattern}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  {runtimeIntegrationAnalysis.missingEvidence.length > 0 && (
                                    <ul className="list-disc pl-4 text-amber-900">
                                      {runtimeIntegrationAnalysis.missingEvidence.map((item) => (
                                        <li key={item}>{item}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      ) : null}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {activePanel === 'costBenefit' && (
        <div id="panel-costBenefit" className="scroll-mt-24">
          <div
            ref={ideaCostBenefitPanelRef}
            style={
              isCostBenefitPanelFullscreen
                ? { height: 'calc(var(--app-vh, 100dvh) - 3rem)', maxHeight: 'calc(var(--app-vh, 100dvh) - 3rem)' }
                : ideaCostBenefitPanelHeightPx != null
                  ? { height: ideaCostBenefitPanelHeightPx, maxHeight: ideaCostBenefitPanelHeightPx, minHeight: PROJECT_PANEL_MIN_HEIGHT_PX }
                  : undefined
            }
            className={cn('min-h-0', isCostBenefitPanelFullscreen && 'fixed inset-x-0 top-12 bottom-0 z-50')}
          >
            <div
              className={cn(
                'liquid-glass-enterprise-filter-bar flex h-full min-h-0 flex-col overflow-hidden border',
                'shadow-[0_18px_44px_rgba(15,23,42,0.12)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]',
                isCostBenefitPanelFullscreen ? 'rounded-none border-0 bg-background' : 'rounded-2xl',
              )}
            >
              <div
                className={cn(
                  'flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden',
                  isCostBenefitPanelFullscreen ? 'px-4 pb-3 pt-2 lg:px-5 lg:pb-4 lg:pt-2' : 'p-4 lg:p-5',
                )}
              >
                <div className="shrink-0 space-y-0 [&_h2]:leading-tight">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <DollarSign className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                      <h2 className="text-lg font-semibold text-foreground">AI Cost &amp; Benefit Analysis</h2>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {typeof confidence.costBenefit === 'number' ? (
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] font-semibold', confidenceClass(confidence.costBenefit))}
                        >
                          Confidence {confidence.costBenefit}%
                        </Badge>
                      ) : null}
                      {renderSectionReviewWorkspace('costBenefit', 'Cost Benefit')}
                      <button
                        type="button"
                        aria-pressed={isCostBenefitPanelFullscreen}
                        aria-label={
                          isCostBenefitPanelFullscreen
                            ? 'Exit cost benefit fullscreen'
                            : 'Expand cost benefit to fullscreen'
                        }
                        title={isCostBenefitPanelFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
                        onClick={() => setIsCostBenefitPanelFullscreen((prev) => !prev)}
                        className={cn(
                          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/40 hover:text-foreground',
                          enterpriseControlFocusClass,
                          isCostBenefitPanelFullscreen &&
                            'bg-foreground text-background hover:bg-foreground/90 hover:text-background',
                        )}
                      >
                        {isCostBenefitPanelFullscreen ? (
                          <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="max-w-2xl text-[11px] leading-snug text-muted-foreground">
                    Numeric model when finance evidence exists; otherwise honest narrative / percentage points.
                  </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <div className="space-y-3">
                    {benefitError ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                        {benefitError}
                      </div>
                    ) : null}

                    {!benefitAnalysis && !benefitError ? (
                      <Card className={IDEA_SUMMARY_LIQUID_GLASS_CARD}>
                        <CardContent className="relative z-10 px-4 py-8 text-center">
                          <DollarSign className="mx-auto h-10 w-10 text-slate-400" aria-hidden />
                          <p className="mt-3 text-sm font-semibold text-slate-900">No cost-benefit results yet</p>
                          <p className="mt-1 text-sm text-slate-600">
                            Open this panel after intake or regenerate from Action &amp; Control.
                          </p>
                        </CardContent>
                      </Card>
                    ) : null}

                    {benefitAnalysis ? (
                      <>
                        <Card className={IDEA_SUMMARY_LIQUID_GLASS_CARD}>
                          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.82),transparent_30%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.38),transparent_34%)]" />
                          <CardContent className="relative z-10 space-y-4 p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'border-white/70 bg-white/55 text-[10px] font-semibold backdrop-blur-md',
                                      costBenefitIsNarrativeOnly
                                        ? 'text-amber-800'
                                        : 'text-emerald-800',
                                    )}
                                  >
                                    {costBenefitIsNarrativeOnly
                                      ? 'Narrative / % mode'
                                      : 'Numeric finance model'}
                                  </Badge>
                                  {typeof confidence.costBenefit === 'number' ? (
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        'border-white/70 bg-white/55 text-[10px] font-semibold backdrop-blur-md',
                                        confidenceClass(confidence.costBenefit),
                                      )}
                                    >
                                      Confidence {confidence.costBenefit}%
                                    </Badge>
                                  ) : null}
                                </div>
                                <h3 className="text-base font-semibold text-slate-950">Executive cost–benefit frame</h3>
                                <p className="text-sm leading-6 text-slate-700">{benefitAnalysis.executive_summary}</p>
                              </div>
                              <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_TILE, 'w-full shrink-0 px-4 py-3 lg:max-w-[220px]')}>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Decision stance</p>
                                <p className="mt-1.5 text-sm font-semibold leading-5 text-slate-950">
                                  {costBenefitIsNarrativeOnly
                                    ? 'Proceed with qualitative business case until finance evidence is complete.'
                                    : 'Proceed with quantified ROI review and funded control gates.'}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {costBenefitIsNarrativeOnly ? (
                          <CostBenefitEvidenceSection
                            evidenceItems={costBenefitEvidenceItems}
                            readinessPercent={costBenefitEvidenceReadinessPercent}
                            onNavigateToPanel={navigateToPanel}
                            onOpenBacklog={openIdeaBacklogForScoring}
                          />
                        ) : null}

                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.45fr_0.85fr]">
                          <div className="space-y-3">
                            <Card className={IDEA_SUMMARY_LIQUID_GLASS_CARD}>
                              <CardContent className="relative z-10 space-y-3 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                      {costBenefitIsNarrativeOnly ? 'Scoring proxy chart' : 'Financial breakdown'}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-600">
                                      {costBenefitIsNarrativeOnly
                                        ? 'Relative dimensions only — bukan model keuangan absolut.'
                                        : 'Estimated cost and benefit composition (USD thousands).'}
                                    </p>
                                  </div>
                                  {!hasNumericScoring && costBenefitIsNarrativeOnly ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 shrink-0 rounded-full border-violet-200 bg-white/70 text-[11px] font-semibold text-violet-700"
                                      onClick={() => navigateToPanel('scoring')}
                                    >
                                      Open Scoring
                                    </Button>
                                  ) : null}
                                </div>
                                <div className="h-[240px]">
                                  {costBenefitChartData.length > 0 && (hasNumericScoring || !costBenefitIsNarrativeOnly) ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                      <BarChart data={costBenefitChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                        <YAxis
                                          tick={{ fontSize: 11, fill: '#64748b' }}
                                          axisLine={false}
                                          tickLine={false}
                                          domain={costBenefitIsNarrativeOnly ? [0, 100] : undefined}
                                        />
                                        <RechartsTooltip
                                          formatter={(value: number, _name, item) => {
                                            const payload = item?.payload as { score?: number | null }
                                            if (costBenefitIsNarrativeOnly && typeof payload?.score === 'number') {
                                              return [`${payload.score}/10`, 'Score']
                                            }
                                            return [`${value}K`, costBenefitIsNarrativeOnly ? 'Proxy' : 'USD thousands']
                                          }}
                                        />
                                        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                          {costBenefitChartData.map((item) => (
                                            <Cell key={item.name} fill={item.fill} />
                                          ))}
                                        </Bar>
                                      </BarChart>
                                    </ResponsiveContainer>
                                  ) : (
                                    <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'flex h-full flex-col items-center justify-center gap-2 px-4 text-center')}>
                                      <Gauge className="h-8 w-8 text-slate-400" aria-hidden />
                                      <p className="text-sm font-semibold text-slate-900">Skor dimensi belum tersedia</p>
                                      <p className="text-sm text-slate-600">
                                        Lengkapi Business Value, Effort, Risk, dan ROI di Scoring untuk mengisi proxy chart.
                                      </p>
                                      <Button
                                        type="button"
                                        variant="link"
                                        className="h-auto px-0 text-[11px] font-semibold text-violet-700"
                                        onClick={() => navigateToPanel('scoring')}
                                      >
                                        Buka Scoring
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>

                            <Card className={IDEA_SUMMARY_LIQUID_GLASS_CARD}>
                              <CardContent className="relative z-10 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Value–effort posture</p>
                                    <h4 className="mt-1 text-base font-semibold text-slate-950">{costBenefitValueEffortPosture.label}</h4>
                                    <p className="mt-1 text-sm leading-5 text-slate-600">{costBenefitValueEffortPosture.description}</p>
                                  </div>
                                  <div
                                    className={cn(IDEA_SUMMARY_LIQUID_GLASS_TILE, 'shrink-0 px-4 py-3 text-center sm:min-w-[160px]')}
                                    style={{ borderColor: `${costBenefitValueEffortPosture.accent}33` }}
                                  >
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Quadrant</p>
                                    <p
                                      className="mt-1 text-sm font-semibold"
                                      style={{ color: costBenefitValueEffortPosture.accent }}
                                    >
                                      {costBenefitValueEffortPosture.quadrant}
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <Card className={IDEA_SUMMARY_LIQUID_GLASS_CARD}>
                                <CardContent className="relative z-10 space-y-3 p-4">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700">Cost drivers</p>
                                  <ul className="space-y-2">
                                    {costBenefitQualitativeLevers.costDrivers.map((driver) => (
                                      <li
                                        key={driver}
                                        className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'border-rose-200/70 px-3 py-2.5 text-sm leading-5 text-slate-800')}
                                      >
                                        {driver}
                                      </li>
                                    ))}
                                  </ul>
                                </CardContent>
                              </Card>
                              <Card className={IDEA_SUMMARY_LIQUID_GLASS_CARD}>
                                <CardContent className="relative z-10 space-y-3 p-4">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Benefit levers</p>
                                  <ul className="space-y-2">
                                    {costBenefitQualitativeLevers.benefitLevers.map((lever) => (
                                      <li
                                        key={lever}
                                        className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'border-emerald-200/70 px-3 py-2.5 text-sm leading-5 text-slate-800')}
                                      >
                                        {lever}
                                      </li>
                                    ))}
                                  </ul>
                                </CardContent>
                              </Card>
                            </div>
                          </div>

                          <Card className={IDEA_SUMMARY_LIQUID_GLASS_CARD}>
                            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/80" />
                            <CardContent className="relative z-10 space-y-3 p-4">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Finance signals</p>
                              <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-3.5')}>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Presentation mode</p>
                                <p className="mt-1 text-sm font-semibold text-slate-950">
                                  {costBenefitIsNarrativeOnly ? 'Narrative / %' : 'Numeric model'}
                                </p>
                                <p className="mt-1 text-[11px] leading-4 text-slate-600">
                                  {costBenefitIsNarrativeOnly
                                    ? 'Default assumptions or no financial system of record.'
                                    : 'Absolute figures available for executive review.'}
                                </p>
                              </div>
                              <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-3.5')}>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Evidence readiness</p>
                                <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">
                                  {costBenefitEvidenceReadinessPercent}%
                                </p>
                                <p className="mt-1 text-[11px] leading-4 text-slate-600">{costBenefitUpgradeHint}</p>
                              </div>
                              <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-3.5')}>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">ROI signal</p>
                                <p className="mt-1 text-sm font-semibold text-slate-950">
                                  {benefitAnalysis.roi_percentage > 0
                                    ? `${benefitAnalysis.roi_percentage.toFixed(0)}% ${costBenefitIsNarrativeOnly ? '(hipotesis)' : ''}`
                                    : 'Menunggu evidence'}
                                </p>
                              </div>
                              <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-3.5')}>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Payback signal</p>
                                <p className="mt-1 text-sm font-semibold text-slate-950">
                                  {benefitAnalysis.payback_period_months > 0 &&
                                  benefitAnalysis.payback_period_months < 1e9
                                    ? `${benefitAnalysis.payback_period_months.toFixed(0)} months`
                                    : 'Menunggu evidence'}
                                </p>
                              </div>
                              {!costBenefitIsNarrativeOnly ? (
                                <>
                                  <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-3.5')}>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Estimated cost (5y)</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-950">
                                      ${(benefitAnalysis.total_cost_5year / 1000).toFixed(0)}K
                                    </p>
                                  </div>
                                  <div className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-3.5')}>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Expected benefit (5y)</p>
                                    <p className="mt-1 text-sm font-semibold text-emerald-800">
                                      ${(benefitAnalysis.total_benefit_5year / 1000).toFixed(0)}K
                                    </p>
                                  </div>
                                </>
                              ) : null}
                            </CardContent>
                          </Card>
                        </div>

                        {costBenefitScenarioBands.length > 0 ? (
                          <Card className={IDEA_SUMMARY_LIQUID_GLASS_CARD}>
                            <CardContent className="relative z-10 space-y-3 p-4">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Scenario bands</p>
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                {costBenefitScenarioBands.map((scenario) => (
                                  <div key={scenario.name} className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'p-3.5')}>
                                    <p className="text-sm font-semibold text-slate-950">{scenario.name}</p>
                                    <p className="mt-1 text-xs font-semibold text-indigo-700">{scenario.roiLabel}</p>
                                    {scenario.description ? (
                                      <p className="mt-2 text-sm leading-5 text-slate-600">{scenario.description}</p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        ) : null}

                        {(benefitAnalysis.narrative_points?.length ?? 0) > 0 && costBenefitIsNarrativeOnly ? (
                          <Card className={IDEA_SUMMARY_LIQUID_GLASS_CARD}>
                            <CardContent className="relative z-10 space-y-3 p-4">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                                Narrative guardrails (no absolute financial figures)
                              </p>
                              <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                {benefitAnalysis.narrative_points?.map((point) => (
                                  <li
                                    key={point}
                                    className={cn(IDEA_SUMMARY_LIQUID_GLASS_INNER, 'border-amber-200/70 px-3 py-2.5 text-sm leading-5 text-slate-700')}
                                  >
                                    {point}
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {activePanel === 'conversion' && (
        <div id="panel-conversion" className="scroll-mt-24">
          <div
            ref={ideaConversionPanelRef}
            style={
              isConversionPanelFullscreen
                ? { height: 'calc(var(--app-vh, 100dvh) - 3rem)', maxHeight: 'calc(var(--app-vh, 100dvh) - 3rem)' }
                : ideaConversionPanelHeightPx != null
                  ? { height: ideaConversionPanelHeightPx, maxHeight: ideaConversionPanelHeightPx, minHeight: PROJECT_PANEL_MIN_HEIGHT_PX }
                  : undefined
            }
            className={cn('min-h-0', isConversionPanelFullscreen && 'fixed inset-x-0 top-12 bottom-0 z-50')}
          >
            <div
              className={cn(
                'liquid-glass-enterprise-filter-bar flex h-full min-h-0 flex-col overflow-hidden border',
                'shadow-[0_18px_44px_rgba(15,23,42,0.12)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]',
                isConversionPanelFullscreen ? 'rounded-none border-0 bg-background' : 'rounded-2xl',
              )}
            >
              <div className="flex h-full min-h-0 w-full flex-col">
              <div
                className={cn(
                  'flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden',
                  isConversionPanelFullscreen ? 'px-4 pb-3 pt-2 lg:px-5 lg:pb-4 lg:pt-2' : 'p-4 lg:p-5',
                )}
              >
                <div className="shrink-0 space-y-0 [&_h2]:leading-tight">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Layers className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                        <h2 className="text-lg font-semibold text-foreground">Idea to Execution Conversion</h2>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {typeof confidence.conversion === 'number' ? (
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] font-semibold', confidenceClass(confidence.conversion))}
                        >
                          Confidence {confidence.conversion}%
                        </Badge>
                      ) : null}
                      {renderSectionReviewWorkspace('conversion', 'Conversion')}
                      <button
                        type="button"
                        aria-pressed={isConversionPanelFullscreen}
                        aria-label={
                          isConversionPanelFullscreen ? 'Exit conversion fullscreen' : 'Expand conversion to fullscreen'
                        }
                        title={isConversionPanelFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
                        onClick={() => setIsConversionPanelFullscreen((prev) => !prev)}
                        className={cn(
                          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/40 hover:text-foreground',
                          enterpriseControlFocusClass,
                          isConversionPanelFullscreen &&
                            'bg-foreground text-background hover:bg-foreground/90 hover:text-background',
                        )}
                      >
                        {isConversionPanelFullscreen ? (
                          <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="mt-0.5 flex flex-col gap-2 pl-7 lg:flex-row lg:items-center lg:justify-between">
                    <p className="max-w-xl text-[11px] leading-tight text-muted-foreground">
                        Sprint → Epic → Task → Sub-task timeline for delivery handoff. Drag bars or edit inline;
                        scroll the chart to pan within the rolling year window.
                    </p>
                    {conversionTimeline?.sprints?.length ? (
                      <IdeaConversionGanttToolbar
                        sprints={conversionTimeline.sprints}
                        projectName={idea.title}
                        zoomLevel={conversionZoomLevel}
                        onZoomLevelChange={setConversionZoomLevel}
                        className="!p-0"
                      />
                    ) : null}
                  </div>
                </div>

                <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
                  {conversionError ? (
                    <div className="shrink-0 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                      {conversionError}
                    </div>
                  ) : null}
                  {conversionTimeline?.sprints?.length ? (
                    <IdeaConversionGanttWorkspace
                      sprints={conversionTimeline.sprints}
                      projectName={idea.title}
                      zoomLevel={conversionZoomLevel}
                      onZoomLevelChange={setConversionZoomLevel}
                    />
                  ) : (
                    !conversionError && (
                      <div className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        No conversion timeline yet.
                      </div>
                    )
                  )}
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {activePanel === 'document' && (
        <div id="panel-document" className="scroll-mt-24">
          <div
            ref={ideaDocsPanelRef}
            style={
              isIdeaDocsPanelFullscreen
                ? { height: 'calc(var(--app-vh, 100dvh) - 3rem)', maxHeight: 'calc(var(--app-vh, 100dvh) - 3rem)' }
                : ideaDocsPanelHeightPx != null
                  ? { height: ideaDocsPanelHeightPx, maxHeight: ideaDocsPanelHeightPx, minHeight: PROJECT_PANEL_MIN_HEIGHT_PX }
                  : undefined
            }
            className={cn('min-h-0', isIdeaDocsPanelFullscreen && 'fixed inset-x-0 top-12 bottom-0 z-50')}
          >
            <div
              className={cn(
                'liquid-glass-enterprise-filter-bar flex h-full min-h-0 flex-col overflow-hidden border',
                'shadow-[0_18px_44px_rgba(15,23,42,0.12)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]',
                isIdeaDocsPanelFullscreen ? 'rounded-none border-0 bg-background' : 'rounded-2xl',
              )}
            >
              <div
                className={cn(
                  'flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden',
                  isIdeaDocsPanelFullscreen ? 'px-4 pb-3 pt-2 lg:px-5 lg:pb-4 lg:pt-2' : 'p-4 lg:p-5',
                )}
              >
              <div className="shrink-0 space-y-0 [&_h2]:leading-tight">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                    <h2 className="text-lg font-semibold text-foreground">Idea Docs</h2>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {renderSectionReviewWorkspace('document', 'Docs')}
                    <button
                      type="button"
                      aria-pressed={isIdeaDocsPanelFullscreen}
                      aria-label={isIdeaDocsPanelFullscreen ? 'Exit docs fullscreen' : 'Expand docs to fullscreen'}
                      title={isIdeaDocsPanelFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
                      onClick={() => setIsIdeaDocsPanelFullscreen((prev) => !prev)}
                      className={cn(
                        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/40 hover:text-foreground',
                        enterpriseControlFocusClass,
                        isIdeaDocsPanelFullscreen &&
                          'bg-foreground text-background hover:bg-foreground/90 hover:text-background',
                      )}
                    >
                      {isIdeaDocsPanelFullscreen ? (
                        <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-2 pb-4">
                  <p className="max-w-2xl text-[11px] leading-snug text-muted-foreground">
                    Upload supporting documents or diagrams to auto-generate a knowledge base entry, or
                    pick a Document & Knowledge Management template to draft a new document for this idea.
                  </p>
                </div>
                {!isIdeaDocAtProjectRoot && ideaDocFolderStack.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1 text-sm">
                    <button
                      type="button"
                      className="inline-flex items-center rounded-md px-1.5 py-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      title="Back to parent folder"
                      onClick={goToIdeaDocParentFolder}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {ideaDocFolderStack.map((folder, index) => (
                      <span key={folder.id} className="flex items-center gap-1">
                        {index > 0 ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" /> : null}
                        <button
                          type="button"
                          className={cn(
                            'rounded-md px-2 py-1 font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                            index === ideaDocFolderStack.length - 1 && 'text-foreground',
                          )}
                          onClick={() => navigateIdeaDocFolderIndex(index)}
                        >
                          {folder.name}
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {ideaDocCurrentFolder ? (
                      <>
                        <button
                          type="button"
                          className={enterpriseIndigoGradientActionButtonClass()}
                          title="Generate a document from a DKM master template"
                          disabled={ideaDocTemplatesLoading || ideaDocGenerateBusy}
                          onClick={openIdeaDocGenerateDialog}
                        >
                          {ideaDocGenerateBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
                          ) : (
                            <Sparkles className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" strokeWidth={2.5} />
                          )}
                          Generate from template
                        </button>
                        <button
                          type="button"
                          className={enterpriseCyanGradientActionButtonClass()}
                          disabled={ideaDocFolderCreateBusy}
                          onClick={() => void handleIdeaDocCreateFolder()}
                          title="Create a subfolder to organize documents"
                        >
                          {ideaDocFolderCreateBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
                          ) : (
                            <FolderPlus className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" strokeWidth={2.5} />
                          )}
                          New folder
                        </button>
                      </>
                    ) : null}
                  </div>
                  {ideaDocsTotalCount > 0 ? (
                    <DocumentRepositoryPaginationControls
                      page={ideaDocsPage}
                      pageSize={ideaDocsPageSize}
                      totalCount={ideaDocsTotalCount}
                      loading={ideaDocsLoading}
                      onPageChange={setIdeaDocsPage}
                      onPageSizeChange={(nextSize) => {
                        setIdeaDocsPageSize(nextSize)
                        setIdeaDocsPage(1)
                      }}
                    />
                  ) : null}
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                <div
                  className={cn(
                    'flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl',
                    showIdeaDocEmptyState &&
                      'border border-white/60 bg-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl',
                  )}
                >
                  {(ideaDocTemplatesLoading || ideaDocsLoading || ideaDocFolderInitBusy) &&
                  ideaRepositoryItems.length === 0 &&
                  ideaDocSubfolders.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading documents…
                    </div>
                  ) : showIdeaDocEmptyState ? (
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-6 py-10">
                      <div className="flex w-full max-w-[19.2rem] flex-col items-center gap-4 text-center">
                        <img
                          src="/images/project-templates-section/document.png"
                          alt=""
                          className="h-auto w-full object-contain object-center"
                          loading="lazy"
                        />
                        <div className="space-y-1">
                          <h3 className="text-base font-semibold text-foreground">No documents yet</h3>
                          <p className="text-sm text-muted-foreground">
                            Upload a supporting document or generate one from a DKM master template.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                      {ideaDocSubfolders.length > 0 ? (
                        <div className="shrink-0 border-b border-border/40 px-3 py-2">
                          <div className="space-y-1">
                            {ideaDocSubfolders.map((folder) => (
                              <button
                                key={folder.id}
                                type="button"
                                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-muted/40"
                                title={`Open ${folder.name}`}
                                onClick={() => openIdeaDocSubfolder(folder)}
                                onContextMenu={(event) => {
                                  event.preventDefault()
                                  openIdeaDocFolderContextMenu(folder, event.clientX, event.clientY)
                                }}
                                onKeyDown={(event) => {
                                  if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
                                    event.preventDefault()
                                    const rect = event.currentTarget.getBoundingClientRect()
                                    openIdeaDocFolderContextMenu(folder, rect.left + 24, rect.top + rect.height / 2)
                                  }
                                }}
                              >
                                <Folder className="h-4 w-4 shrink-0 text-sky-600" aria-hidden />
                                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{folder.name}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {folder.document_count} docs · {folder.children_count} subfolders
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {ideaRepositoryItems.length > 0 ? (
                        <DocumentRepositoryTableView
                          items={ideaDocsPaginatedItems}
                          loading={ideaDocsLoading}
                          emptyMessage={
                            isIdeaDocAtProjectRoot
                              ? 'No documents in this idea folder yet.'
                              : 'No documents in this folder.'
                          }
                          isKbGenerated={(item) => ideaDocKbGeneratedIds.has(item.id)}
                          onDocumentClick={(item) => {
                            setIdeaDocEditId(item.id)
                            setIdeaDocEditTitle(item.name)
                          }}
                          onRowContextMenu={(event, item) => openIdeaDocContextMenu(event, item)}
                        />
                      ) : null}
                    </div>
                  )}
                </div>

                {supportingDocuments.length > 0 ? (
                  <ul className="shrink-0 space-y-2">
                    {supportingDocuments.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 rounded-xl border border-border/50 bg-background/80 px-3 py-2.5 text-sm text-foreground"
                      >
                        <Files className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 break-words">{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
            </div>
          </div>

          {ideaDocGenerateOpen && typeof document !== 'undefined'
            ? createPortal(
                <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 sm:p-6">
                  <button
                    type="button"
                    className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
                    aria-label="Close generate dialog"
                    disabled={ideaDocGenerateBusy}
                    onClick={() => {
                      if (!ideaDocGenerateBusy) setIdeaDocGenerateOpen(false)
                    }}
                  />

                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="idea-doc-generate-title"
                    className="relative z-[1401] w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card via-card to-card/95 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]"
                  >
                    <div className="border-b border-border/70 bg-muted/25 px-6 py-5">
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/12 text-blue-700 ring-1 ring-blue-500/25">
                          <Sparkles className="h-5 w-5" aria-hidden />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <h3
                            id="idea-doc-generate-title"
                            className="text-base font-semibold tracking-tight text-foreground"
                          >
                            Generate document from template
                          </h3>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            Agent fills placeholders from this idea, saves to Document repository, then opens
                            it in the document editor.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 px-6 py-5">
                      <div className="space-y-2">
                        <Label
                          htmlFor="idea-doc-template"
                          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                        >
                          Template
                        </Label>
                        <Select
                          id="idea-doc-template"
                          className="rounded-xl"
                          value={ideaDocGenerateTemplateId}
                          disabled={ideaDocGenerateBusy || ideaDocTemplatesLoading}
                          onChange={(event) => setIdeaDocGenerateTemplateId(event.target.value)}
                        >
                          <option value="" disabled>
                            {ideaDocTemplatesLoading ? 'Loading templates…' : 'Select template…'}
                          </option>
                          {ideaDocTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </Select>
                        {selectedIdeaDocGenerateTemplate ? (
                          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-background text-blue-700 ring-1 ring-border">
                              <FileText className="h-3.5 w-3.5" aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">
                                {selectedIdeaDocGenerateTemplate.name}
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {(selectedIdeaDocGenerateTemplate.document_type_code || 'document').toUpperCase()}
                                {' · '}
                                v{selectedIdeaDocGenerateTemplate.version}
                                {selectedIdeaDocGenerateTemplate.category_code
                                  ? ` · ${selectedIdeaDocGenerateTemplate.category_code}`
                                  : ''}
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <Label
                            htmlFor="idea-doc-source"
                            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                          >
                            Source context
                          </Label>
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {ideaDocGenerateSourceChars.toLocaleString('en-US')} chars
                          </span>
                        </div>
                        <Textarea
                          id="idea-doc-source"
                          rows={9}
                          className="min-h-[180px] resize-none rounded-xl border-border/80 bg-muted/20 px-3.5 py-3 text-sm leading-relaxed shadow-none"
                          value={ideaDocGenerateSource}
                          disabled={ideaDocGenerateBusy}
                          onChange={(event) => setIdeaDocGenerateSource(event.target.value)}
                          placeholder="Idea description / requirements used to fill the template"
                        />
                      </div>

                      {ideaDocGenerateBusy ? (
                        <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Agent progress
                          </p>
                          <ul className="space-y-1.5">
                            {IDEA_DOC_GENERATE_STEPS.map((step, index) => {
                              const isDone = index < ideaDocGenerateStepIndex
                              const isRunning = index === ideaDocGenerateStepIndex
                              return (
                                <li key={step.key} className="flex items-center gap-2.5 text-sm">
                                  {isDone ? (
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                                  ) : isRunning ? (
                                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" aria-hidden />
                                  ) : (
                                    <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" aria-hidden />
                                  )}
                                  <span
                                    className={cn(
                                      isDone && 'text-foreground',
                                      isRunning && 'font-medium text-foreground',
                                      !isDone && !isRunning && 'text-muted-foreground',
                                    )}
                                  >
                                    {step.label}
                                  </span>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Enterprise note: generated files are saved to Document repository and can be downloaded
                          after the editor opens.
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-border/70 bg-muted/20 px-6 py-4">
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
                        disabled={ideaDocGenerateBusy}
                        onClick={() => setIdeaDocGenerateOpen(false)}
                      >
                        <X className="h-4 w-4 shrink-0" aria-hidden />
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className={cn(registerServicePrimaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
                        disabled={ideaDocGenerateBusy || !ideaDocGenerateTemplateId || !ideaDocGenerateSource.trim()}
                        onClick={() => { void handleIdeaDocGenerate() }}
                      >
                        {ideaDocGenerateBusy ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                        ) : (
                          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
                        )}
                        {ideaDocGenerateBusy ? 'Generating…' : 'Generate & open'}
                      </Button>
                    </div>
                  </div>
                </div>,
                document.body,
              )
            : null}

          <DocumentOnlyOfficeEditor
            open={Boolean(ideaDocEditId)}
            documentId={ideaDocEditId}
            documentTitle={ideaDocEditTitle}
            onClose={() => {
              setIdeaDocEditId(null)
              setIdeaDocEditTitle(null)
            }}
          />

          {ideaDocFolderContextMenu ? (
            <ContextMenu
              open
              x={ideaDocFolderContextMenu.x}
              y={ideaDocFolderContextMenu.y}
              onClose={() => setIdeaDocFolderContextMenu(null)}
              zIndex={1300}
            >
              <ContextMenuItem
                onSelect={() => {
                  const { folder } = ideaDocFolderContextMenu
                  setIdeaDocFolderContextMenu(null)
                  openIdeaDocSubfolder(folder)
                }}
              >
                <Folder className="h-4 w-4 shrink-0 text-sky-600" />
                Open folder
              </ContextMenuItem>
              <ContextMenuItem
                className={cn(ideaDocFolderCreateBusy && 'pointer-events-none opacity-50')}
                aria-disabled={ideaDocFolderCreateBusy}
                onSelect={() => {
                  const { folder } = ideaDocFolderContextMenu
                  setIdeaDocFolderContextMenu(null)
                  void handleIdeaDocCreateSubfolder(folder)
                }}
              >
                {ideaDocFolderCreateBusy ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <FolderPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                New subfolder
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => {
                  const { folder } = ideaDocFolderContextMenu
                  setIdeaDocFolderContextMenu(null)
                  openIdeaDocSubfolder(folder)
                  openIdeaDocGenerateDialog()
                }}
              >
                <Sparkles className="h-4 w-4 shrink-0 text-violet-600" />
                Generate document here
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => {
                  const { folder } = ideaDocFolderContextMenu
                  setIdeaDocFolderContextMenu(null)
                  setIdeaDocFolderRenameTarget(folder)
                  setIdeaDocFolderRenameValue(folder.name)
                }}
              >
                <PencilLine className="h-4 w-4 shrink-0 text-muted-foreground" />
                Rename
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                onSelect={() => {
                  const { folder } = ideaDocFolderContextMenu
                  setIdeaDocFolderContextMenu(null)
                  void copyIdeaDocFolderPath(folder)
                }}
              >
                <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
                Copy folder path
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => {
                  const { folder } = ideaDocFolderContextMenu
                  setIdeaDocFolderContextMenu(null)
                  addToast({
                    title: folder.name,
                    description: `${folder.document_count} documents · ${folder.children_count} subfolders`,
                    variant: 'info',
                  })
                }}
              >
                <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
                Folder details
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                className={cn(
                  'text-rose-600 hover:bg-rose-50',
                  (ideaDocFolderContextMenu.folder.document_count > 0
                    || ideaDocFolderContextMenu.folder.children_count > 0)
                    && 'pointer-events-none opacity-45',
                )}
                aria-disabled={
                  ideaDocFolderContextMenu.folder.document_count > 0
                  || ideaDocFolderContextMenu.folder.children_count > 0
                }
                title={
                  ideaDocFolderContextMenu.folder.document_count > 0
                  || ideaDocFolderContextMenu.folder.children_count > 0
                    ? 'Only empty folders can be deleted.'
                    : 'Delete folder'
                }
                onSelect={() => {
                  const { folder } = ideaDocFolderContextMenu
                  setIdeaDocFolderContextMenu(null)
                  setIdeaDocFolderDeleteTarget(folder)
                }}
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                Delete folder
              </ContextMenuItem>
            </ContextMenu>
          ) : null}

          <Dialog
            open={Boolean(ideaDocFolderRenameTarget)}
            onOpenChange={(open) => {
              if (!open && !ideaDocFolderRenameBusy) setIdeaDocFolderRenameTarget(null)
            }}
          >
            <DialogContent className="max-w-md overflow-hidden rounded-2xl p-0">
              <DialogHeader className="mb-0 border-b border-border/70 bg-muted/25 px-6 py-5">
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-sky-700 ring-1 ring-sky-500/25">
                    <PencilLine className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="space-y-1 text-left">
                    <DialogTitle className="text-base font-semibold tracking-tight">Rename folder</DialogTitle>
                    <DialogDescription>Update the folder name without changing its contents or location.</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="px-6 py-5">
                <div className="rounded-xl border border-border bg-background/70 px-4 py-3">
                  <Label
                    htmlFor="idea-doc-folder-rename-input"
                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    Folder name
                  </Label>
                  <Input
                    id="idea-doc-folder-rename-input"
                    className="mt-1.5"
                    value={ideaDocFolderRenameValue}
                    disabled={ideaDocFolderRenameBusy}
                    autoFocus
                    onChange={(event) => setIdeaDocFolderRenameValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void handleIdeaDocFolderRenameConfirm()
                    }}
                  />
                </div>
              </div>
              <DialogFooter className="gap-3 border-t border-border/70 bg-muted/20 px-6 py-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
                  disabled={ideaDocFolderRenameBusy}
                  onClick={() => setIdeaDocFolderRenameTarget(null)}
                >
                  <X className="h-4 w-4" aria-hidden />
                  Cancel
                </Button>
                <Button
                  type="button"
                  className={cn(registerServicePrimaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
                  disabled={ideaDocFolderRenameBusy || !ideaDocFolderRenameValue.trim()}
                  onClick={() => void handleIdeaDocFolderRenameConfirm()}
                >
                  {ideaDocFolderRenameBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {ideaDocFolderRenameBusy ? 'Saving…' : 'Save changes'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <EnterpriseDeleteConfirmModal
            open={Boolean(ideaDocFolderDeleteTarget)}
            onClose={() => {
              if (!ideaDocFolderDeleteBusy) setIdeaDocFolderDeleteTarget(null)
            }}
            onConfirm={() => void handleIdeaDocFolderDeleteConfirm()}
            busy={ideaDocFolderDeleteBusy}
            title="Delete folder"
            description="This permanently removes the empty folder and cannot be undone."
            entityLabel="Folder"
            entityValue={ideaDocFolderDeleteTarget?.name ?? '—'}
            impactSummary={
              <>
                <div className="font-medium text-foreground">Impact summary</div>
                <div className="mt-1">Documents: {ideaDocFolderDeleteTarget?.document_count ?? 0}</div>
                <div>Subfolders: {ideaDocFolderDeleteTarget?.children_count ?? 0}</div>
              </>
            }
            enterpriseNote="Enterprise note: only empty folders can be deleted. Documents and subfolders are never removed implicitly."
            confirmLabel="Delete folder"
            confirmBusyLabel="Deleting..."
            dialogTitleId="idea-doc-delete-folder-dialog-title"
          />

          {ideaDocContextMenu ? (
            <ContextMenu
              open
              x={ideaDocContextMenu.x}
              y={ideaDocContextMenu.y}
              onClose={() => setIdeaDocContextMenu(null)}
            >
              <ContextMenuItem
                onSelect={() => {
                  const { item } = ideaDocContextMenu
                  setIdeaDocContextMenu(null)
                  setIdeaDocEditId(item.id)
                  setIdeaDocEditTitle(item.name)
                }}
              >
                <PencilLine className="h-4 w-4 shrink-0 text-muted-foreground" />
                Open document
              </ContextMenuItem>
              <ContextMenuItem
                className={cn(ideaDocDownloadBusyId === ideaDocContextMenu.item.id && 'pointer-events-none opacity-50')}
                onSelect={() => {
                  const { item } = ideaDocContextMenu
                  setIdeaDocContextMenu(null)
                  void handleIdeaDocDownload(item)
                }}
              >
                {ideaDocDownloadBusyId === ideaDocContextMenu.item.id ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                Download
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => {
                  const { item } = ideaDocContextMenu
                  setIdeaDocContextMenu(null)
                  setIdeaDocRenameTarget(item)
                  setIdeaDocRenameValue(item.name)
                }}
              >
                <PencilLine className="h-4 w-4 shrink-0 text-muted-foreground" />
                Rename
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                className={cn(
                  'text-blue-700 hover:bg-blue-50',
                  ideaDocKbBusyId === ideaDocContextMenu.item.id && 'pointer-events-none opacity-50',
                )}
                onSelect={() => {
                  const { item } = ideaDocContextMenu
                  setIdeaDocContextMenu(null)
                  void handleIdeaDocRegenerateKb(item)
                }}
              >
                {ideaDocKbBusyId === ideaDocContextMenu.item.id ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 shrink-0" />
                )}
                {ideaDocKbGeneratedIds.has(ideaDocContextMenu.item.id) ? 'Regenerate KB' : 'Generate KB'}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                className="text-rose-600 hover:bg-rose-50"
                onSelect={() => {
                  const { item } = ideaDocContextMenu
                  setIdeaDocContextMenu(null)
                  setIdeaDocDeleteTarget(item)
                }}
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                Delete
              </ContextMenuItem>
            </ContextMenu>
          ) : null}

          <Dialog
            open={Boolean(ideaDocRenameTarget)}
            onOpenChange={(open) => {
              if (!open) setIdeaDocRenameTarget(null)
            }}
          >
            <DialogContent className="max-w-md overflow-hidden rounded-2xl p-0">
              <div className="border-b border-border/70 bg-muted/25 px-6 py-5">
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/12 text-blue-700 ring-1 ring-blue-500/25">
                    <PencilLine className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="space-y-1">
                    <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                      Rename document
                    </DialogTitle>
                    <DialogDescription>Choose a new title for this document.</DialogDescription>
                  </div>
                </div>
              </div>
              <div className="px-6 py-5">
                <div className="rounded-xl border border-border bg-background/70 px-4 py-3">
                  <Label
                    htmlFor="idea-doc-rename-input"
                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    Title
                  </Label>
                  <Input
                    id="idea-doc-rename-input"
                    className="mt-1.5"
                    value={ideaDocRenameValue}
                    disabled={ideaDocRenameBusy}
                    onChange={(event) => setIdeaDocRenameValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void handleIdeaDocRenameConfirm()
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-border/70 bg-muted/20 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
                  disabled={ideaDocRenameBusy}
                  onClick={() => setIdeaDocRenameTarget(null)}
                >
                  <X className="h-4 w-4 shrink-0" aria-hidden />
                  Cancel
                </Button>
                <Button
                  type="button"
                  className={cn(registerServicePrimaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
                  disabled={ideaDocRenameBusy || !ideaDocRenameValue.trim()}
                  onClick={() => { void handleIdeaDocRenameConfirm() }}
                >
                  {ideaDocRenameBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PencilLine className="h-4 w-4" />}
                  {ideaDocRenameBusy ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {ideaDocDeleteTarget && typeof document !== 'undefined'
            ? createPortal(
                <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 sm:p-6">
                  <button
                    type="button"
                    className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
                    aria-label="Close delete confirmation"
                    disabled={ideaDocDeleteBusy}
                    onClick={() => {
                      if (!ideaDocDeleteBusy) setIdeaDocDeleteTarget(null)
                    }}
                  />

                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="idea-doc-delete-dialog-title"
                    className="relative z-[1401] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card via-card to-card/95 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]"
                  >
                    <div className="border-b border-border/70 bg-muted/25 px-6 py-5">
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/12 text-red-700 ring-1 ring-red-500/25">
                          <Trash2 className="h-5 w-5" aria-hidden />
                        </div>
                        <div className="space-y-1">
                          <h3
                            id="idea-doc-delete-dialog-title"
                            className="text-base font-semibold tracking-tight text-foreground"
                          >
                            Delete document
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            This action permanently removes the document and cannot be undone.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 px-6 py-5">
                      <div className="rounded-xl border border-border bg-background/70 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Document
                        </p>
                        <p className="mt-1 break-words text-sm font-semibold text-foreground">
                          {ideaDocDeleteTarget.name}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Enterprise note: deleting this file removes it from Idea Docs and Document repository
                        access for this idea.
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-border/70 bg-muted/20 px-6 py-4">
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
                        disabled={ideaDocDeleteBusy}
                        onClick={() => setIdeaDocDeleteTarget(null)}
                      >
                        <X className="h-4 w-4 shrink-0" aria-hidden />
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className={cn(
                          registerServicePrimaryButtonClass(),
                          'min-w-0 basis-0 flex-1 justify-center gap-2 bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
                        )}
                        disabled={ideaDocDeleteBusy}
                        onClick={() => { void handleIdeaDocDeleteConfirm() }}
                      >
                        {ideaDocDeleteBusy ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                        )}
                        {ideaDocDeleteBusy ? 'Deleting…' : 'Delete document'}
                      </Button>
                    </div>
                  </div>
                </div>,
                document.body,
              )
            : null}
        </div>
        )}
      </div>
      </div>
    </>
  )
}
