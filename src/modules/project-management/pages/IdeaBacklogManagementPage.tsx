import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { getSession } from '@/auth/authService'
import { useTenantContextOptional } from '@/auth/TenantContext'
import {
  belongsToActiveWorkspaceScope,
  readActiveWorkspaceScope,
  resolveWorkspaceApiId,
} from '@/lib/tenantWorkspaceScope'
import { workspaceScopedPath } from '@/lib/workspaceRouting'
import { useIdeaDraftBrainstormPointerStore } from '@/stores/idea-draft-brainstorm-pointer-store'
import {
  GripVertical,
  Eye,
  Calendar,
  ClipboardList,
  BarChart3,
  Check,
  ArrowUpDown,
  Plus,
  List,
  ListOrdered,
  CheckCircle,
  Filter,
  Search,
  UserRound,
  MoveRight,
  Trash2,
  X,
  Wand2,
  Loader2,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  CircleHelp,
  Building2,
  Sparkles,
  Users,
  Tags,
  ArrowLeft,
  ArrowUp,
  Mic,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  Target,
  FolderKanban,
  Palette,
  Upload,
  FolderPlus,
  Folder as FolderIcon,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PlatformDataLoadingState } from '@/components/loading'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip } from '@/components/ui/tooltip'
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, ContextMenuSubmenu } from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import {
  enterpriseCyanGradientActionButtonClass,
  enterpriseEmeraldGradientActionButtonClass,
  enterpriseIndigoGradientActionButtonClass,
  enterpriseRoseGradientActionButtonClass,
  enterpriseSecondaryButtonClass,
  registerServicePrimaryButtonClass,
} from '@/lib/enterpriseButtonClasses'
import {
  enterpriseFilterTagClass,
  ideaBacklogLiquidGlassFilterInputClass,
  ideaBacklogLiquidGlassFilterPanelClass,
  ideaBacklogLiquidGlassFilterPanelDividerClass,
  ideaBacklogLiquidGlassCardClass,
  ideaBacklogLiquidGlassCardMetaClass,
  ideaBacklogLiquidGlassCardTagClass,
  ideaBacklogLiquidGlassPanelClass,
  ideaBacklogLiquidGlassPanelIconClass,
  ideaBacklogLiquidGlassPanelInsetClass,
  ideaBacklogLiquidGlassPanelStatClass,
  ideaBacklogLiquidGlassQueueItemClass,
  ideaBacklogLiquidGlassQueueItemSelectedClass,
  ideaBacklogLiquidGlassMetricCardClass,
} from '@/components/enterprise/enterpriseFilterPanelClasses'
import {
  deleteIdea,
  fetchAllIdeas,
  createIdea as apiCreateIdea,
  patchIdea,
  getIdeaById,
  upsertPersistentIdeaSummary,
  toDisplayStatus,
  toBackendStatus,
  extractScoringDimensions,
  generateIdeaDescriptionWithAI,
  type IdeaApi,
  type IdeaAiAssistanceMode,
} from '@/lib/api/ideaBacklogApi'
import {
  brainstormIdeaDraftJob,
  cancelIdeaDraftJob,
  continueIdeaDraftJob,
  getIdeaDraftJob,
  getIdeaSummaryJob,
  restoreIdeaDraftBrainstormSession,
  startIdeaDraftJob,
  startIdeaSummaryJob,
  type IdeaDraftBrainstormMessage,
  type IdeaDraftChecklistItem,
  type IdeaDraftDiscoveryProgress,
  type IdeaDraftEvidenceProgress,
  type IdeaDraftJobStatusResponse,
} from '@/lib/api/tectonaAgentRuntimeApi'

type BrainstormUiMessage = IdeaDraftBrainstormMessage & {
  sentAt?: string
  respondedAt?: string
}

const BRAINSTORM_GAP_LABELS: Record<string, string> = {
  as_is_actors: 'People involved in the current process',
  as_is_steps: 'Current AS-IS process steps from start to finish',
  as_is_systems: 'Systems or applications used today',
  pain_points: 'Main pain points or bottlenecks',
  to_be_process: 'Expected TO-BE process overview',
  diagram_validation: 'Business process diagram validation',
  'diagram validation': 'Business process diagram validation',
  to_be: 'Expected TO-BE process',
  as_is: 'Current AS-IS business process',
  discovery_business_value: 'Business Value scoring evidence',
  discovery_roi: 'ROI scoring evidence',
  discovery_effort: 'Effort scoring evidence',
  discovery_risk: 'Risk scoring evidence',
}

function normalizeBrainstormGapKey(gap: string): string {
  return gap.trim().toLowerCase().replace(/\s+/g, '_')
}

function formatBrainstormGapLabel(gap: string): string {
  const trimmed = gap.trim()
  if (!trimmed) return trimmed
  const normalized = normalizeBrainstormGapKey(trimmed)
  if (BRAINSTORM_GAP_LABELS[normalized]) return BRAINSTORM_GAP_LABELS[normalized]
  if (BRAINSTORM_GAP_LABELS[trimmed.toLowerCase()]) return BRAINSTORM_GAP_LABELS[trimmed.toLowerCase()]
  if (!trimmed.includes('_') && /\s/.test(trimmed) && trimmed.length > 24) return trimmed
  return trimmed
    .replace(/_/g, ' ')
    .replace(/\bas is\b/gi, 'AS-IS')
    .replace(/\bto be\b/gi, 'TO-BE')
    .replace(/\broa\b/gi, 'ROA')
    .replace(/^\w/, (char) => char.toUpperCase())
}

function formatBrainstormChecklistPrompt(prompt: string): string {
  const trimmed = prompt.trim()
  if (!trimmed) return trimmed
  const normalized = normalizeBrainstormGapKey(trimmed)
  if (BRAINSTORM_GAP_LABELS[normalized]) return BRAINSTORM_GAP_LABELS[normalized]
  if (/^proses manajemen proyek/i.test(trimmed)) return 'Current project management process'
  if (/^pain point/i.test(trimmed)) return 'Pain points to address'
  if (/^sistem atau peran/i.test(trimmed)) return 'Related systems or roles'
  if (/^kriteria keberhasilan/i.test(trimmed)) return 'Measurable success criteria'
  return trimmed
}

function formatBrainstormExploringNext(gaps: string[]): string {
  return gaps.slice(0, 3).map(formatBrainstormGapLabel).join(' · ')
}

function isBrainstormThreadIndonesian(messages: Array<{ role: string; text: string }>): boolean {
  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant' && message.text.trim())
  const sample = lastAssistant?.text ?? ''
  return /(?:\baku\b|\bkamu\b|\byang\b|\bdengan\b|\buntuk\b|\bsudah\b|\bapakah\b|\bproses\b|\blanjut\b)/i.test(sample)
}

function brainstormContinueDiscoveryMessage(messages: Array<{ role: string; text: string }>): string {
  return isBrainstormThreadIndonesian(messages) ? 'Lanjut ditanya' : 'Continue questions'
}

function formatBrainstormTimestamp(iso?: string): string {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

function formatBrainstormLatencyMs(sentAt?: string, respondedAt?: string): string {
  if (!sentAt || !respondedAt) return ''
  const ms = new Date(respondedAt).getTime() - new Date(sentAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return ''
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} dtk`
}

function mergeBrainstormUiMessages(
  previous: BrainstormUiMessage[],
  incoming: IdeaDraftBrainstormMessage[],
  responseReceivedAt: string,
): BrainstormUiMessage[] {
  const userSentAtByText = new Map<string, string>()
  const assistantRespondedAtByText = new Map<string, string>()
  for (const message of previous) {
    if (message.role === 'user' && message.sentAt) userSentAtByText.set(message.text, message.sentAt)
    if (message.role === 'assistant' && message.respondedAt) {
      assistantRespondedAtByText.set(message.text, message.respondedAt)
    }
  }
  let lastAssistantIndex = -1
  for (let index = incoming.length - 1; index >= 0; index -= 1) {
    if (incoming[index]?.role === 'assistant') {
      lastAssistantIndex = index
      break
    }
  }
  return incoming.map((message, index) => ({
    ...message,
    ...(message.role === 'user' && userSentAtByText.has(message.text)
      ? { sentAt: userSentAtByText.get(message.text) }
      : {}),
    ...(message.role === 'assistant' && assistantRespondedAtByText.has(message.text)
      ? { respondedAt: assistantRespondedAtByText.get(message.text) }
      : message.role === 'assistant' && index === lastAssistantIndex
        ? { respondedAt: responseReceivedAt }
        : {}),
  }))
}

function isIdeaDraftJobLostError(message: string): boolean {
  const text = message.trim()
  return (
    text.includes('IDEA_DRAFT_JOB_NOT_FOUND')
    || /^HTTP 404\b/i.test(text)
  )
}

function friendlyBrainstormError(rawMessage: string): string {
  if (
    rawMessage.includes('SCORING_JSON_NOT_FOUND')
    || rawMessage.includes('IDEA_DRAFT_BRAINSTORM_INVALID_RESPONSE')
    || rawMessage.includes('SCORING_JSON_NOT_OBJECT')
  ) {
    return 'Tectona Assistant returned an unusable reply. Please send your message again.'
  }
  if (isIdeaDraftJobLostError(rawMessage)) {
    return 'The brainstorm session was interrupted. Resend your message — the session will recover automatically.'
  }
  if (/^HTTP 500\b/i.test(rawMessage) || rawMessage.includes('Internal Server Error')) {
    return 'Tectona Assistant is having a brief issue. Please resend your message.'
  }
  return rawMessage
}

type BrainstormTextBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }

/** Turn inline "(1) … (2) …" / "1. …" into paragraph + ordered-list blocks for chat rendering. */
function parseBrainstormAssistantBlocks(text: string): BrainstormTextBlock[] {
  const normalized = text
    .replace(/\s*(?:atau|or|,)?\s*\((\d+)\)\s+/gi, '\n$1. ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!normalized) return []

  const lines = normalized.split('\n')
  const blocks: BrainstormTextBlock[] = []
  let paragraphParts: string[] = []
  let listItems: string[] = []

  const flushParagraph = () => {
    const joined = paragraphParts.join(' ').replace(/\s+/g, ' ').trim()
    if (joined) blocks.push({ type: 'paragraph', text: joined })
    paragraphParts = []
  }
  const flushList = () => {
    if (listItems.length > 0) blocks.push({ type: 'list', items: listItems })
    listItems = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flushList()
      flushParagraph()
      continue
    }
    const numbered = line.match(/^\d+[\.\)]\s+(.+)$/)
    if (numbered?.[1]) {
      flushParagraph()
      listItems.push(numbered[1].trim())
      continue
    }
    flushList()
    paragraphParts.push(line)
  }

  // Peel a trailing question off the last list item so it stays as its own paragraph.
  if (listItems.length >= 2) {
    const last = listItems[listItems.length - 1]
    const sentences = last.split(/(?<=[.!])\s+(?=[A-ZÀ-ÖØ-Þ])/u)
    if (sentences.length >= 2) {
      const maybeQuestion = sentences[sentences.length - 1]?.trim() ?? ''
      if (maybeQuestion.endsWith('?')) {
        listItems[listItems.length - 1] = sentences.slice(0, -1).join(' ').trim()
        flushList()
        paragraphParts.push(maybeQuestion)
      }
    }
  }

  flushList()
  flushParagraph()
  return blocks
}

function formatBrainstormProse(chunk: string): string {
  const blocks = parseBrainstormAssistantBlocks(chunk)
  if (blocks.length === 0) return chunk
  return blocks
    .map((block) => {
      if (block.type === 'paragraph') return block.text
      return block.items.map((item, index) => `${index + 1}. ${item}`).join('\n')
    })
    .join('\n\n')
}

const BRAINSTORM_DIAGRAM_APPROVAL_RE =
  /(?:sudah sesuai|sudah (?:ok|oke|benar|betul)|setuju|sepakat|approve(?:d)?|looks good|that(?:'s| is) (?:correct|right|fine)|ya[,!]?\s*(?:sudah|benar|ok|oke)|ok(?:e)?(?:\s*,)?\s*(?:lanjut|generate|sip)|ok(?:e)?(?:\s+\w+){0,8}\s*(?:aja|saja|lanjut|ikut|setuju|sip|gas)|ikut\s+(?:kamu|saja|aja)|baik(?:lah)?|silakan|boleh\s+(?:lanjut|terus|ya)|gas(?:\s+aja)?|iya[,!]?\s*(?:lanjut|setuju|ok|oke)?|sip[,!]?\s*(?:lanjut|sudah)|validated|validation ok|go\s*ahead|lgtm|sounds good|yes(?:[,!]?\s*(?:please|go\s*ahead|continue|ok|okay))?|yep|yeah|yup|sure|alright|all right|fine by me|agreed|ok je|okay je|teruskan|de acuerdo|está bien|vale|correcto|perfecto|sí|está correto|pode seguir|concordo|d'accord|oui|parfait|c'est bon|stimmt|in ordnung|genau|va bene|perfetto|sì|akkoord|sige|tama|okay lang|đúng|được|ok luôn|vâng|はい|大丈夫|好的|可以|没问题|沒問題|네|좋아요|حسنا|موافق|تمام|نعم|(?:^|\s)(?:ok|okay|oke|y|yy|👍|👌|✅)(?:$|[\s,.!]))/i

const BRAINSTORM_DIAGRAM_REJECTION_RE =
  /(?:(?:tidak|nggak|enggak|belum)\s+(?:sesuai|benar|betul|ok|oke|setuju)|masih\s+(?:salah|kurang|belum)|(?:salah|kurang|revisi|perbaiki|ubah|ganti)|not\s+(?:yet|correct|right|ok|okay)|still\s+(?:wrong|incorrect)|(?:please\s+)?(?:revise|fix|change)|(?:don't|do\s+not|jangan)|(?:wrong|incorrect)|いいえ|違う|不行|不对)/i

function userTextApprovesDiagram(text: string): boolean {
  const raw = (text || '').trim().replace(/\s+/g, ' ')
  if (!raw) return false
  const shortOk =
    /^(ok|okay|oke|yes|yep|yeah|yup|sure|ya|iya|sip|baik|boleh|setuju|sí|si|sim|oui|ja|네|好的|可以|はい|大丈夫|موافق|تمام)$/i.test(
      raw.replace(/[^\p{L}\p{N}\s👍👌✅]/gu, '').trim(),
    )
  const approved = BRAINSTORM_DIAGRAM_APPROVAL_RE.test(raw) || shortOk
  if (!approved) return false
  if (/\b(?:tapi|but|however|masih|still|kecuali|except)\b/i.test(raw) && BRAINSTORM_DIAGRAM_REJECTION_RE.test(raw)) {
    return false
  }
  if (
    /\b(?:revisi|perbaiki|ubah|ganti|revise|fix|change)\b/i.test(raw) &&
    !/\b(?:no\s+(?:need|changes?)|tidak\s+perlu\s+(?:ubah|revisi))\b/i.test(raw)
  ) {
    return false
  }
  if (
    /(?:tidak|nggak|enggak|belum)\s+(?:sesuai|benar|betul|ok|oke|setuju)|(?:not\s+(?:yet|correct|right)|still\s+(?:wrong|incorrect)|wrong|incorrect)/i.test(
      raw,
    )
  ) {
    return false
  }
  return true
}

function brainstormMessageHasDiagram(text: string): boolean {
  const lowered = (text || '').toLowerCase()
  return lowered.includes('```mermaid') || /\bflowchart\s+(td|lr|tb|rl)\b/i.test(lowered)
}

/** Client-side unlock when backend forgot ready_to_continue but chat evidence is complete. */
function inferBrainstormReadyFromMessages(messages: IdeaDraftBrainstormMessage[]): boolean {
  if (!messages.length) return false
  const hasDiagram = messages.some((m) => m.role === 'assistant' && brainstormMessageHasDiagram(m.text))
  if (!hasDiagram) return false
  let lastUser = ''
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') {
      lastUser = messages[i].text || ''
      break
    }
  }
  if (!userTextApprovesDiagram(lastUser)) return false
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  // If the latest assistant turn still presents a new diagram, wait for the next approval.
  if (lastAssistant && brainstormMessageHasDiagram(lastAssistant.text)) return false
  return true
}

type InitiativeLensId =
  | 'efficiency'
  | 'productivity'
  | 'revenue'
  | 'cost_of_credit'
  | 'roa'

const INITIATIVE_LENS_BADGE_CLASS: Record<InitiativeLensId, string> = {
  efficiency: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  productivity: 'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  revenue: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  cost_of_credit: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  roa: 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300',
}

const INITIATIVE_LENS_BAR_CLASS: Record<InitiativeLensId, string> = {
  efficiency: 'bg-blue-500',
  productivity: 'bg-violet-500',
  revenue: 'bg-emerald-500',
  cost_of_credit: 'bg-amber-500',
  roa: 'bg-rose-500',
}

type InitiativeLensMatch = {
  id: InitiativeLensId
  label: string
  score: number
  percent: number
}

const INITIATIVE_LENS_DEFINITIONS: Array<{
  id: InitiativeLensId
  label: string
  patterns: RegExp[]
}> = [
  {
    id: 'efficiency',
    label: 'Efficiency',
    patterns: [
      /\befisiensi\b/i,
      /\befficien/i,
      /\boptim/i,
      /\bstreamlin/i,
      /\breduce\s+(time|cycle|handling|manual|effort)\b/i,
      /\bpercepat/i,
      /\bhemat\s+waktu/i,
    ],
  },
  {
    id: 'productivity',
    label: 'Productivity',
    patterns: [
      /\bproduktiv/i,
      /\bproductiv/i,
      /\bthroughput\b/i,
      /\bcapacity\b/i,
      /\boutput\b/i,
      /\bworkload\b/i,
      /\bbacklog\b/i,
      /\bSLA\b/,
      /\bhelpdesk\b/i,
      /\bticket\b/i,
    ],
  },
  {
    id: 'revenue',
    label: 'Revenue',
    patterns: [
      /\brevenue\b/i,
      /\bpendapatan\b/i,
      /\bsales\b/i,
      /\bpenjualan\b/i,
      /\bcross[- ]sell\b/i,
      /\bupsell\b/i,
      /\bconversion\b/i,
      /\bmarket share\b/i,
    ],
  },
  {
    id: 'cost_of_credit',
    label: 'Cost of Credit',
    patterns: [
      /\bcost of credit\b/i,
      /\bbiaya kredit\b/i,
      /\bNPL\b/,
      /\bKPR\b/,
      /\bkredit\b/i,
      /\bcredit cost\b/i,
      /\bprovision\b/i,
      /\bwrite[- ]off\b/i,
      /\bcollection\b/i,
    ],
  },
  {
    id: 'roa',
    label: 'ROA',
    patterns: [
      /\bROA\b/,
      /\breturn on assets\b/i,
      /\bprofitabilit/i,
      /\bmargin\b/i,
      /\byield\b/i,
      /\bNIM\b/,
      /\baset\b/i,
      /\bassets\b/i,
    ],
  },
]

function countInitiativePatternHits(text: string, patterns: RegExp[]): number {
  if (!text.trim()) return 0
  let hits = 0
  for (const pattern of patterns) {
    if (pattern.test(text)) hits += 1
  }
  return hits
}

function allocatePercents(weights: number[]): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) return weights.map(() => 0)
  const raw = weights.map((weight) => (weight / total) * 100)
  const floors = raw.map((value) => Math.floor(value))
  let remain = 100 - floors.reduce((sum, value) => sum + value, 0)
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac)
  const out = [...floors]
  for (let i = 0; i < remain; i += 1) {
    out[order[i].index] += 1
  }
  return out
}

function inferInitiativeLens(
  title: string,
  tags: string[],
  messages: IdeaDraftBrainstormMessage[],
): InitiativeLensMatch[] {
  const titleCorpus = [title, ...tags].join('\n').toLowerCase()
  const evidenceCorpus = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.text)
    .join('\n')
    .toLowerCase()

  const scored = INITIATIVE_LENS_DEFINITIONS.map((definition) => {
    const titleScore = countInitiativePatternHits(titleCorpus, definition.patterns)
    const evidenceScore = countInitiativePatternHits(evidenceCorpus, definition.patterns)
    return {
      id: definition.id,
      label: definition.label,
      score: titleScore + evidenceScore * 3,
    }
  }).filter((item) => item.score > 0)

  const percents = allocatePercents(scored.map((item) => item.score))
  return scored
    .map((item, index) => ({ ...item, percent: percents[index] ?? 0 }))
    .sort((a, b) => b.percent - a.percent || b.score - a.score)
}

function resolveBrainstormConfidencePercent(
  backendPercent: number | undefined,
  progress: IdeaDraftEvidenceProgress | null,
  ready: boolean,
): number {
  if (typeof backendPercent === 'number' && backendPercent > 0) {
    return Math.max(0, Math.min(100, Math.round(backendPercent)))
  }
  if (!progress) return ready ? 85 : 0
  const requiredRatio = progress.required_total > 0
    ? progress.required_answered / progress.required_total
    : progress.total > 0
      ? progress.answered / progress.total
      : 0
  const overallRatio = progress.total > 0 ? progress.answered / progress.total : 0
  const derived = Math.round(requiredRatio * 70 + overallRatio * 30)
  if (ready) return Math.max(derived, 85)
  return derived
}

function confidenceReadinessLabel(percent: number, ready: boolean): string {
  if (ready || percent >= 80) return 'Ready to generate draft'
  if (percent >= 55) return 'Context is taking shape'
  if (percent >= 25) return 'More exploration needed'
  return 'Just started - continue the discussion'
}

function BrainstormConfidenceRing({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference
  const tone = clamped >= 80
    ? 'text-emerald-600'
    : clamped >= 55
      ? 'text-amber-600'
      : 'text-slate-500'

  return (
    <div className="relative inline-flex h-[5.5rem] w-[5.5rem] shrink-0 items-center justify-center">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 88 88" aria-hidden>
        <circle cx="44" cy="44" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('transition-[stroke-dashoffset] duration-500', tone)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-xl font-semibold tabular-nums', tone)}>{clamped}%</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Confidence</span>
      </div>
    </div>
  )
}

// Stage 5 (explainable readiness): per-dimension weights behind the "Minimum Intake" bar below —
// a confirmed answer counts fully, a partial/inferred one only partially, so the bar reflects
// evidence quality instead of a binary answered/not-answered count.
const EVIDENCE_STATUS_WEIGHT: Record<string, number> = {
  missing: 0,
  inferred: 0.4,
  partial: 0.7,
  confirmed: 1,
}

function BrainstormEvidenceRail({
  confidencePercent,
  progress,
  discoveryProgress,
  checklist,
  gaps,
  initiativeMatches,
  ready,
  collapsed,
  onToggleCollapsed,
}: {
  confidencePercent: number
  progress: IdeaDraftEvidenceProgress | null
  discoveryProgress: IdeaDraftDiscoveryProgress | null
  checklist: IdeaDraftChecklistItem[]
  gaps: string[]
  initiativeMatches: InitiativeLensMatch[]
  ready: boolean
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  const resolvedConfidence = resolveBrainstormConfidencePercent(confidencePercent, progress, ready)
  const readinessLabel = confidenceReadinessLabel(resolvedConfidence, ready)
  const items = checklist.length > 0 ? checklist : progress?.items ?? []
  const requiredTotal = progress?.required_total ?? items.filter((item) => item.required !== false).length
  const requiredAnswered = progress?.required_answered
    ?? items.filter((item) => item.required !== false && item.status === 'answered').length
  const itemsTotal = progress?.total ?? items.length
  const itemsAnswered = progress?.answered
    ?? items.filter((item) => item.status === 'answered' || item.status === 'skipped').length
  const progressPercent = requiredTotal > 0
    ? Math.round((requiredAnswered / requiredTotal) * 100)
    : items.length > 0
      ? Math.round((items.filter((item) => item.status === 'answered').length / items.length) * 100)
      : 0
  // Stage 5 (explainable readiness): an evidence-quality-weighted version of the same bar — a
  // "confirmed" answer counts fully, a "partial" one only partially, so 5/5 items reaching
  // [answered] doesn't read as identical to 5/5 items with strong, specific evidence.
  const evidenceQualityItems = items.filter(
    (item) => !String(item.id || '').startsWith('discovery_')
      || item.status === 'answered'
      || item.status === 'skipped',
  )
  const evidenceQualityPercent = evidenceQualityItems.length > 0
    ? Math.round(
        (evidenceQualityItems.reduce(
          (sum, item) => sum + (EVIDENCE_STATUS_WEIGHT[item.evidence_status ?? 'missing'] ?? 0),
          0,
        )
          / evidenceQualityItems.length) * 100,
      )
    : 0
  const discoveryCovered = discoveryProgress?.covered ?? 0
  const discoveryTotal = discoveryProgress?.total ?? 0
  const discoveryPercent = discoveryTotal > 0 ? Math.round((discoveryCovered / discoveryTotal) * 100) : 0

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col',
        collapsed
          ? 'w-12 border-r border-border/70 bg-background'
          : 'w-full border-b border-border/70 bg-muted/20 p-3 md:w-[26rem] md:border-b-0 md:border-r md:p-4',
      )}
    >
      {collapsed ? (
        <div className="flex flex-col items-center gap-2 py-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onToggleCollapsed}
            aria-label="Expand readiness panel"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Target className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="text-[10px] font-medium tabular-nums text-muted-foreground [writing-mode:vertical-rl]">
            {resolvedConfidence}%
          </span>
        </div>
      ) : (
        <div
          className={cn(
            'liquid-glass-enterprise-panel flex min-h-0 flex-1 flex-col overflow-hidden border border-border/40',
            'shadow-[0_14px_40px_rgba(15,23,42,0.06)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]',
            'rounded-2xl',
          )}
        >
          <div className="flex h-full min-h-0 w-full flex-col">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden p-4 lg:p-5">
              <div className="flex shrink-0 items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <Target className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                    <h2 className="text-lg font-semibold text-foreground">Draft Readiness</h2>
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    AI confidence and AS-IS evidence progress before draft generation.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={onToggleCollapsed}
                  aria-label="Collapse readiness panel"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex shrink-0 flex-col items-center gap-2 rounded-xl border border-border/40 bg-muted/10 px-4 py-3 text-center">
                <BrainstormConfidenceRing percent={resolvedConfidence} />
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-foreground">{readinessLabel}</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {ready
                      ? 'Evidence is sufficient - the draft can be generated with stronger context.'
                      : 'You can still generate a draft at any time; the initial draft may contain assumptions.'}
                  </p>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-xl border border-border/40 bg-background/70 p-3">
                <div className="flex shrink-0 items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Evidence progress
                  </p>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {itemsAnswered}/{itemsTotal || items.length || 0} Total
                  </span>
                </div>
                <div className="h-1.5 shrink-0 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      progressPercent >= 80 ? 'bg-emerald-500' : progressPercent >= 40 ? 'bg-amber-500' : 'bg-primary/70',
                    )}
                    style={{ width: `${Math.max(progressPercent, items.length > 0 ? 4 : 0)}%` }}
                  />
                </div>
                {itemsTotal > 0 && itemsAnswered >= itemsTotal ? (
                  <>
                    <p className="shrink-0 text-[11px] leading-4 text-muted-foreground">
                      Minimum intake complete — continue discovery until evidence reaches 100%.
                      Draft Readiness ({resolvedConfidence}%) tracks overall confidence separately.
                    </p>
                    <div className="shrink-0 space-y-2 rounded-lg border border-border/40 bg-muted/10 p-2">
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-medium">
                          <span>Evidence quality</span>
                          <span className="tabular-nums text-muted-foreground">{evidenceQualityPercent}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              evidenceQualityPercent >= 80 ? 'bg-emerald-500' : evidenceQualityPercent >= 40 ? 'bg-amber-500' : 'bg-primary/70',
                            )}
                            style={{ width: `${evidenceQualityPercent}%` }}
                          />
                        </div>
                      </div>
                      {discoveryTotal > 0 ? (
                        <div>
                          <div className="flex items-center justify-between text-[11px] font-medium">
                            <span>Deep discovery</span>
                            <span className="tabular-nums text-muted-foreground">
                              {discoveryCovered}/{discoveryTotal}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-sky-500 transition-all duration-500"
                              style={{ width: `${discoveryPercent}%` }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}
                <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                  {items.length > 0 ? (
                    items.map((item) => {
                      const status = item.status ?? 'pending'
                      const Icon = status === 'answered'
                        ? CircleCheck
                        : status === 'asked'
                          ? Circle
                          : Circle
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            'flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs leading-5',
                            status === 'answered' && 'bg-emerald-50 text-emerald-950',
                            status === 'asked' && 'bg-amber-50/80 text-amber-950',
                            status === 'pending' && 'text-muted-foreground',
                          )}
                        >
                          <Icon
                            className={cn(
                              'mt-0.5 h-3.5 w-3.5 shrink-0',
                              status === 'answered' && 'text-emerald-600',
                              status === 'asked' && 'text-amber-600',
                            )}
                            aria-hidden
                          />
                          <span className="min-w-0">{formatBrainstormChecklistPrompt(item.prompt)}</span>
                        </div>
                      )
                    })
                  ) : gaps.length > 0 ? (
                    gaps.map((gap) => (
                      <div key={gap} className="rounded-lg px-2 py-1.5 text-xs leading-5 text-muted-foreground">
                        {formatBrainstormGapLabel(gap)}
                      </div>
                    ))
                  ) : (
                    <p className="px-2 py-1 text-xs text-muted-foreground">
                      The evidence checklist will appear after the assistant asks the first question.
                    </p>
                  )}
                </div>
              </div>

              <div className="shrink-0 space-y-2 rounded-xl border border-border/40 bg-muted/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Initiative direction
                </p>
                {initiativeMatches.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                      {initiativeMatches.map((match) => (
                        <div
                          key={match.id}
                          className={cn('h-full', INITIATIVE_LENS_BAR_CLASS[match.id])}
                          style={{ width: `${match.percent}%` }}
                          title={`${match.label} ${match.percent}%`}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {initiativeMatches.map((match) => (
                        <Badge
                          key={match.id}
                          variant="secondary"
                          className={cn(
                            'rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                            INITIATIVE_LENS_BADGE_CLASS[match.id],
                          )}
                        >
                          {match.label} {match.percent}%
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs leading-5 text-muted-foreground">
                    Not identified yet - value direction (efficiency, productivity, revenue, cost of credit, ROA) will appear as the discussion develops.
                  </p>
                )}
                <p className="text-[10px] leading-4 text-muted-foreground">
                  Shares add up to 100% from title, tags, and your answers — not a final scoring decision.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

function BrainstormProseSegments({ text }: { text: string }) {
  const segments = splitMermaidContent(text)
  if (segments.length === 0) return null
  if (segments.some((s) => s.type === 'mermaid' || s.type === 'tecchart')) {
    return (
      <>
        {segments.map((segment, index) => {
          if (segment.type === 'mermaid') {
            return <AssistantMermaidBlock key={`m-${index}`} source={segment.source} />
          }
          if (segment.type === 'tecchart') {
            return null
          }
          const prose = formatBrainstormProse(segment.text).trim()
          if (!prose) return null
          return (
            <AssistantChatMarkdown
              key={`p-${index}`}
              content={prose}
              className="text-[15px] leading-7 text-foreground [&_ol]:my-2 [&_p]:my-2"
            />
          )
        })}
      </>
    )
  }
  return (
    <AssistantChatMarkdown
      content={formatBrainstormProse(normalizeMermaidFences(text))}
      className="text-[15px] leading-7 text-foreground [&_ol]:my-2 [&_p]:my-2"
    />
  )
}

function BrainstormAssistantMessageBody({ text }: { text: string }) {
  const parts = splitBrainstormDisplayParts(text)
  if (parts.length === 0) return null

  const hasVisual = parts.some((part) => part.type === 'png' || part.type === 'mermaid')
  if (!hasVisual) {
    return <BrainstormProseSegments text={text} />
  }

  return (
    <div className="space-y-2 text-[15px] leading-7 text-foreground [&_ol]:my-2 [&_p]:my-2">
      {parts.map((part, index) => {
        if (part.type === 'png') {
          return (
            <img
              key={`png-${index}`}
              src={part.src}
              alt="Diagram proses bisnis BPMN"
              className="my-2 max-w-full rounded-md border border-black/10 dark:border-white/15"
            />
          )
        }
        if (part.type === 'mermaid') {
          return <AssistantMermaidBlock key={`m-${index}`} source={part.source} />
        }
        const prose = part.text.trim()
        if (!prose) return null
        return <BrainstormProseSegments key={`p-${index}`} text={prose} />
      })}
    </div>
  )
}

function BrainstormAssistantTypingMessage({
  text,
  animate,
  onComplete,
  onProgress,
}: {
  text: string
  animate: boolean
  onComplete?: () => void
  onProgress?: () => void
}) {
  const typingTarget = text.slice(0, brainstormTypingCutoff(text))
  const [displayText, setDisplayText] = useState(animate ? '' : text)
  const [isTyping, setIsTyping] = useState(animate)

  useEffect(() => {
    if (!animate) {
      setDisplayText(text)
      setIsTyping(false)
      return
    }
    setDisplayText('')
    setIsTyping(true)
    const tokens = typingTarget.match(/\S+\s*|\s+/g) ?? [typingTarget]
    if (tokens.length === 0) {
      setDisplayText(text)
      setIsTyping(false)
      onComplete?.()
      return
    }
    let index = 0
    const timerId = window.setInterval(() => {
      index += 1
      if (index >= tokens.length) {
        window.clearInterval(timerId)
        setDisplayText(text)
        setIsTyping(false)
        onComplete?.()
        return
      }
      setDisplayText(tokens.slice(0, index).join(''))
      onProgress?.()
    }, 36)
    return () => window.clearInterval(timerId)
  }, [animate, onComplete, onProgress, text, typingTarget])

  return (
    <div className="relative">
      <BrainstormAssistantMessageBody text={displayText || (isTyping ? ' ' : text)} />
      {isTyping ? (
        <span
          className="ml-0.5 inline-block h-[1.05em] w-0.5 animate-pulse bg-primary align-[-0.15em]"
          aria-hidden
        />
      ) : null}
    </div>
  )
}

import { fetchAllProjects, fetchProject, TECTONA_PROJECT_APP_ID } from '@/lib/api/projectApi'
import { fetchIdentityUsers, type IdentityUserDto } from '@/lib/api/identityAdminApi'
import {
  fetchWorkspaceMembers,
  TECTONA_WAC_APP_ID,
  wacRoleCodeToUiRole,
} from '@/lib/api/workspaceAccessControlApi'
import { useUserWorkspaceOptions } from '@/modules/core-shell/hooks/useUserWorkspaceOptions'
import { useTectonaPageContextReporter } from '@/lib/chat/useTectonaPageContextReporter'
import { brainstormTypingCutoff, splitBrainstormDisplayParts } from '@/lib/chat/brainstormDiagramDisplay'
import { extractProcessDiagramsFromText } from '@/lib/chat/extractProcessDiagrams'
import { normalizeMermaidFences, splitMermaidContent } from '@/lib/chat/normalizeMermaidFences'
import { AssistantChatMarkdown } from '@/modules/core-shell/components/AssistantChatMarkdown'
import { AssistantMermaidBlock } from '@/modules/core-shell/components/AssistantMermaidBlock'
import { IdeaUploadReviewPanel } from '@/modules/project-management/components/IdeaUploadReviewPanel'
import { IdeaBacklogFoldersSection } from '@/modules/project-management/components/IdeaBacklogFoldersSection'
import { useIdeaFolderStore, type IdeaBacklogFolder } from '@/modules/project-management/store/ideaFolderStore'
import { ProjectDragLayer } from '@/modules/projects/components/ProjectDragLayer'
import { useToast } from '@/components/ui/toast'
import { notifyEvent } from '@/lib/api/notificationApi'
import { TECTONA_TENANT_CHANGED_EVENT } from '@/lib/tenantEvents'

type IdeaStatus = 'New Submission' | 'Under Review' | 'Approved' | 'Rejected' | 'Converted to Project'
type IdeaType = 'Innovation' | 'Improvement' | 'Request' | 'Transformation'

const IDEA_TYPES: IdeaType[] = ['Innovation', 'Improvement', 'Request', 'Transformation']
const IDEA_STATUSES: IdeaStatus[] = ['New Submission', 'Under Review', 'Approved', 'Rejected', 'Converted to Project']
const ALL_CONTENT_FILTER_TAGS = ['folders', 'ideas'] as const
type ContentFilterTag = (typeof ALL_CONTENT_FILTER_TAGS)[number]
const DEFAULT_DRAFT_WORKSPACE_ID = 'react-tectona'
const MAX_CREATE_IDEA_TAGS = 5
const MAX_CREATE_IDEA_TAG_LENGTH = 24


const IDEA_TAG_QUICK_SUGGESTIONS = [
  'Platform',
  'Integration',
  'Security',
  'Compliance',
  'Automation',
  'Data',
  'UX',
  'Performance',
]

type Idea = {
  id: string
  title: string
  description: string
  type: IdeaType
  submittedBy: string
  workspace?: string
  projectId?: string | null
  projectName?: string | null
  folderId?: string | null
  tags: string[]
  createdAt: string
  reviewer: string
  status: IdeaStatus
  cardAccentColor?: string | null
  scoring: {
    businessValue: number
    effort: number
    risk: number
    roi: number
  }
  version: number
}

const IDEA_STATUS_CARD_LABEL: Record<IdeaStatus, string> = {
  'New Submission': 'New',
  'Under Review': 'Review',
  Approved: 'Approved',
  Rejected: 'Rejected',
  'Converted to Project': 'Project',
}

type IdeaScoringDimensionKey = 'businessValue' | 'effort' | 'risk' | 'roi'

const IDEA_SCORING_DIMENSIONS: {
  key: IdeaScoringDimensionKey
  label: string
  weightLabel: string
  weightPercent: number
  color: string
  trackClass: string
  surfaceClass: string
  roleLabel: 'Primary driver' | 'Execution adjuster'
}[] = [
  {
    key: 'businessValue',
    label: 'Value',
    weightLabel: 'Value weight',
    weightPercent: 30,
    color: '#059669',
    trackClass: 'bg-emerald-100',
    surfaceClass: 'border-emerald-200/55 bg-emerald-50/40',
    roleLabel: 'Primary driver',
  },
  {
    key: 'effort',
    label: 'Effort',
    weightLabel: 'Effort adjuster',
    weightPercent: 20,
    color: '#d97706',
    trackClass: 'bg-amber-100',
    surfaceClass: 'border-amber-200/55 bg-amber-50/40',
    roleLabel: 'Execution adjuster',
  },
  {
    key: 'risk',
    label: 'Risk',
    weightLabel: 'Risk adjuster',
    weightPercent: 20,
    color: '#e11d48',
    trackClass: 'bg-rose-100',
    surfaceClass: 'border-rose-200/55 bg-rose-50/40',
    roleLabel: 'Execution adjuster',
  },
  {
    key: 'roi',
    label: 'ROI',
    weightLabel: 'ROI weight',
    weightPercent: 30,
    color: '#0284c7',
    trackClass: 'bg-sky-100',
    surfaceClass: 'border-sky-200/55 bg-sky-50/40',
    roleLabel: 'Primary driver',
  },
]

function readIdeaScoringValue(idea: Idea, key: IdeaScoringDimensionKey): number {
  return idea.scoring[key]
}

type IdeaAnalysisProgress = {
  progress: number
  status: 'running' | 'done' | 'failed'
  errorMessage?: string | null
  currentStepLabel?: string | null
}

type IdeaReviewerOption = {
  subjectId: string
  displayName: string
  roleLabel: string
}

type CreateIdeaWorkspaceOption = {
  id: string
  name: string
}

type IdeaTagTone = {
  chipClassName: string
  removeClassName: string
}

function getIdeaTagTone(tag: string): IdeaTagTone {
  const value = tag.toLocaleLowerCase()
  if (/(security|risk|compliance|audit|privacy)/.test(value)) {
    return {
      chipClassName: 'border-rose-200 bg-rose-50 text-rose-700',
      removeClassName: 'text-rose-600 hover:bg-rose-100 hover:text-rose-800',
    }
  }
  if (/(platform|architecture|infra|system|core)/.test(value)) {
    return {
      chipClassName: 'border-sky-200 bg-sky-50 text-sky-700',
      removeClassName: 'text-sky-600 hover:bg-sky-100 hover:text-sky-800',
    }
  }
  if (/(integration|api|event|orchestration|workflow)/.test(value)) {
    return {
      chipClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      removeClassName: 'text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800',
    }
  }
  if (/(data|analytics|insight|report|metric|kpi)/.test(value)) {
    return {
      chipClassName: 'border-teal-200 bg-teal-50 text-teal-700',
      removeClassName: 'text-teal-600 hover:bg-teal-100 hover:text-teal-800',
    }
  }
  if (/(ai|ml|model|agent|automation)/.test(value)) {
    return {
      chipClassName: 'border-amber-200 bg-amber-50 text-amber-700',
      removeClassName: 'text-amber-600 hover:bg-amber-100 hover:text-amber-800',
    }
  }
  return {
    chipClassName: 'border-slate-200 bg-slate-50 text-slate-700',
    removeClassName: 'text-slate-600 hover:bg-slate-100 hover:text-slate-800',
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

function fromApiIdea(api: IdeaApi, projectNameById?: Record<string, string>): Idea {
  const type: IdeaType = IDEA_TYPES.includes(api.category as IdeaType)
    ? (api.category as IdeaType)
    : 'Innovation'
  const projectId = api.project_id?.trim() || null

  return {
    id: api.id,
    title: api.title,
    description: api.description ?? '',
    type,
    submittedBy: api.owner_id?.trim() ?? '',
    workspace: api.workspace_id ?? undefined,
    projectId,
    projectName: projectId && projectNameById?.[projectId] ? projectNameById[projectId] : null,
    folderId: api.folder_id?.trim() || null,
    tags: api.tags,
    createdAt: api.created_date.slice(0, 10),
    reviewer: api.assignee_id ?? '—',
    status: toDisplayStatus(api.status_code),
    cardAccentColor: api.card_accent_color?.trim() || null,
    scoring: extractScoringDimensions(api.latest_scoring),
    version: api.version,
  }
}

const IDEA_DESCRIPTION_TEMPLATE = `Objective
What outcomes are desired? What are success indicators?

Problem Statement
Explain the user problem, why it's urgent, and business impact.

Solution
Summarize the proposed solution and initial validation status.

Risk
List key risks and mitigation strategies.

Supporting Documents
Attach relevant document links, designs, or PDF files.`

const IDEA_DESCRIPTION_HEADING_LABELS = new Set([
  'objective',
  'problem statement',
  'solution',
  'risk',
  'supporting documents',
  'tujuan',
  'permasalahan',
  'solusi',
  'risiko',
  'dokumen pendukung',
  'evidence as-is',
  'evidence as is',
  'usulan perubahan',
  'proposed change',
  'asumsi dan pertanyaan terbuka',
  'assumptions and open questions',
  'kandidat dampak',
  'impact candidates',
  'perubahan proses',
  'process delta',
  'sinyal scoring',
  'scoring signals',
  'irisan delivery',
  'delivery slices',
  'evidence pendukung',
  'supporting evidence',
])




function RequiredFieldMark() {
  return <span className="text-red-500">*</span>
}

function sanitizeIdeaDescriptionRichHtml(content: string): string {
  const trimmed = (content || '').trim()
  if (!trimmed) return ''
  if (typeof window === 'undefined' || typeof document === 'undefined') return trimmed

  const wrapper = document.createElement('div')
  wrapper.innerHTML = trimmed

  const allowed = new Set(['p', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 'br', 'pre', 'code'])

  const sanitizeNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) return
    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.parentNode?.removeChild(node)
      return
    }

    const element = node as HTMLElement
    const tag = element.tagName.toLowerCase()

    if (!allowed.has(tag)) {
      const textNode = document.createTextNode(element.textContent ?? '')
      element.parentNode?.replaceChild(textNode, element)
      return
    }

    Array.from(element.attributes).forEach((attribute) => {
      element.removeAttribute(attribute.name)
    })

    Array.from(element.childNodes).forEach(sanitizeNode)
  }

  Array.from(wrapper.childNodes).forEach(sanitizeNode)
  return wrapper.innerHTML
}

function extractPlainTextFromIdeaRichHtml(content: string): string {
  if (!content) return ''
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  const wrapper = document.createElement('div')
  wrapper.innerHTML = content

  const lines: string[] = []
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(/\u00A0/g, ' ').trim()
      if (text) {
        if (lines.length === 0) lines.push(text)
        else lines[lines.length - 1] = `${lines[lines.length - 1]} ${text}`.trim()
      }
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return

    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    if (tag === 'pre') {
      const diagramKind = (el.getAttribute('data-process-diagram') || 'mermaid').toLowerCase()
      const code = (el.textContent ?? '').replace(/\u00A0/g, ' ').trim()
      if (code) {
        lines.push('')
        lines.push(`\`\`\`${diagramKind}`)
        lines.push(...code.split('\n'))
        lines.push('```')
        lines.push('')
      }
      return
    }
    if (['p', 'h2', 'h3', 'li', 'div'].includes(tag)) {
      lines.push('')
    }
    Array.from(el.childNodes).forEach(walk)
    if (['p', 'h2', 'h3', 'li', 'div', 'ul', 'ol'].includes(tag)) {
      lines.push('')
    }
  }

  Array.from(wrapper.childNodes).forEach(walk)
  return lines.map((line) => line.trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function plainTextToIdeaRichHtml(text: string): string {
  const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch))

  const normalizeMarkdownLine = (line: string): string => {
    let next = line
      .replace(/^#+\s*/, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .trim()

    next = next.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '').trim()
    return next
  }

  const isHeadingLine = (line: string): boolean => {
    const normalizedLine = normalizeMarkdownLine(line).toLowerCase().replace(/[:：]\s*$/, '')
    if (!normalizedLine) return false
    if (IDEA_DESCRIPTION_HEADING_LABELS.has(normalizedLine)) return true
    return /^(tujuan|objective|problem statement|permasalahan|solusi|risk|risiko|supporting documents|dokumen pendukung|perubahan proses|process delta)\s*[:：]\s*$/i
      .test(line.trim())
  }

  const renderProseChunk = (chunk: string) => {
    const lines = chunk.replace(/\r\n?/g, '\n').split('\n')
    const blocks: string[] = []
    let pendingList: string[] = []

    const flushList = () => {
      if (pendingList.length === 0) return
      blocks.push(`<ul>${pendingList.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`)
      pendingList = []
    }

    for (const rawLine of lines) {
      const trimmed = rawLine.trim()
      if (!trimmed) {
        flushList()
        continue
      }

      const cleanLine = normalizeMarkdownLine(trimmed)
      if (!cleanLine) continue

      const lowerLine = cleanLine.toLowerCase()
      if (lowerLine.startsWith('berikut adalah deskripsi terstruktur')) {
        continue
      }

      if (isHeadingLine(trimmed)) {
        flushList()
        blocks.push(`<h2>${escapeHtml(cleanLine.replace(/[:：]\s*$/, ''))}</h2>`)
        continue
      }

      const isListItem = /^[-*•]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)
      if (isListItem) {
        pendingList.push(cleanLine)
        continue
      }

      flushList()
      blocks.push(`<p>${escapeHtml(cleanLine)}</p>`)
    }

    flushList()
    return blocks.join('')
  }

  const normalized = text.replace(/\r\n?/g, '\n').trim()
  if (!normalized) return ''

  const segments = splitMermaidContent(normalized)
  if (!segments.some((segment) => segment.type === 'mermaid')) {
    return renderProseChunk(normalized)
  }

  return segments
    .map((segment) => {
      if (segment.type === 'prose') return renderProseChunk(segment.text)
      if (segment.type === 'mermaid') {
        return `<pre data-process-diagram="mermaid"><code>${escapeHtml(segment.source)}</code></pre>`
      }
      return `<pre data-process-diagram="tecchart"><code>${escapeHtml(segment.source)}</code></pre>`
    })
    .join('')
}

// Mock data removed — data is now loaded from python-idea-backlog-service-fastapi (port 8511)

const typeClass: Record<IdeaType, string> = {
  Innovation: 'bg-sky-100 text-sky-700 border-sky-200',
  Improvement: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Request: 'bg-violet-100 text-violet-700 border-violet-200',
  Transformation: 'bg-amber-100 text-amber-700 border-amber-200',
}

const DEFAULT_IDEA_CARD_ACCENT_COLOR = '#94a3b8'

const IDEA_CARD_ACCENT_COLORS = [
  '#3b82f6',
  '#a855f7',
  '#10b981',
  '#f97316',
  '#ec4899',
  '#06b6d4',
  '#6366f1',
  '#14b8a6',
  '#f43f5e',
  '#f59e0b',
  '#84cc16',
  '#8b5cf6',
] as const

const IDEA_CARD_CONTEXT_MENU_ESTIMATED_HEIGHT = 520
const BACKGROUND_CONTEXT_MENU_ESTIMATED_HEIGHT = 240

type FixedContextMenuPosition = { x: number; y: number; clientX: number; clientY: number }

function resolveFixedContextMenuPosition(
  clientX: number,
  clientY: number,
  menuWidth: number,
  menuHeight: number,
  padding = 12,
): FixedContextMenuPosition {
  let x = clientX
  if (x + menuWidth > window.innerWidth - padding) {
    x = clientX - menuWidth
  }
  x = Math.max(padding, Math.min(x, window.innerWidth - menuWidth - padding))

  const spaceBelow = window.innerHeight - clientY - padding
  const spaceAbove = clientY - padding

  let y = clientY
  if (menuHeight > spaceBelow && spaceAbove >= spaceBelow) {
    y = clientY - menuHeight
  } else if (menuHeight > spaceBelow) {
    y = window.innerHeight - menuHeight - padding
  }

  y = Math.max(padding, Math.min(y, window.innerHeight - menuHeight - padding))

  return {
    x: Math.round(x),
    y: Math.round(y),
    clientX,
    clientY,
  }
}

const statusClass: Record<IdeaStatus, string> = {
  'New Submission': 'bg-amber-50 text-amber-700 border-amber-200',
  'Under Review': 'bg-blue-50 text-blue-700 border-blue-200',
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  'Converted to Project': 'bg-violet-50 text-violet-700 border-violet-200',
}

function ideaTypeFilterVariant(type: IdeaType): 'sky' | 'emerald' | 'violet' | 'amber' {
  if (type === 'Innovation') return 'sky'
  if (type === 'Improvement') return 'emerald'
  if (type === 'Request') return 'violet'
  return 'amber'
}

function ideaStatusFilterVariant(status: IdeaStatus): 'amber' | 'cyan' | 'emerald' | 'slate' | 'violet' {
  if (status === 'New Submission') return 'amber'
  if (status === 'Under Review') return 'cyan'
  if (status === 'Approved') return 'emerald'
  if (status === 'Rejected') return 'slate'
  return 'violet'
}

const LEGACY_DUMMY_OWNER_ID = '00000000-0000-0000-0000-000000000001'

function isNestDropId(id: string) {
  return id.startsWith('folder-nest-')
}

function isIdeaFolderDropId(id: string) {
  return id.startsWith('folder-drop-')
}

function parseNestDropId(id: string) {
  return id.replace('folder-nest-', '')
}

function parseIdeaFolderDropId(id: string) {
  return id.replace('folder-drop-', '')
}

function canMoveIdeaFolderToTarget(
  folderId: string,
  targetParentId: string | null,
  folders: IdeaBacklogFolder[],
): boolean {
  if (!targetParentId || targetParentId === folderId) return false
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  let cursor = byId.get(targetParentId)
  const visited = new Set<string>()
  while (cursor) {
    if (cursor.id === folderId) return false
    if (visited.has(cursor.id)) break
    visited.add(cursor.id)
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }
  return true
}

function createIdeaFolderDropCollisionDetection(folders: IdeaBacklogFolder[]): CollisionDetection {
  return (args) => {
    const activeId = String(args.active.id)

    if (activeId.startsWith('idea-')) {
      const collisions = pointerWithin(args)
      const dropHits = collisions.filter((collision) => isIdeaFolderDropId(String(collision.id)))
      if (dropHits.length > 0) return dropHits
      return collisions
    }

    if (activeId.startsWith('folder-')) {
      const sourceId = activeId.replace('folder-', '')
      const pointerCollisions = pointerWithin(args)
      const nestHits = pointerCollisions.filter((collision) => {
        const id = String(collision.id)
        if (!isNestDropId(id)) return false
        const targetId = parseNestDropId(id)
        return sourceId !== targetId && canMoveIdeaFolderToTarget(sourceId, targetId, folders)
      })
      if (nestHits.length > 0) return nestHits

      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((container) => {
          const id = String(container.id)
          return !isIdeaFolderDropId(id) && !isNestDropId(id)
        }),
      })
    }

    return pointerWithin(args)
  }
}

export function IdeaBacklogManagementPage() {
  type SubmissionSortOrder = 'name-asc' | 'name-desc'

  const tenant = useTenantContextOptional()
  const { addToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const currentFolderId = searchParams.get('folder')
  const {
    folders,
    fetchFolders,
    addFolder,
    updateFolder,
    deleteFolder,
    getFolder,
    foldersLoading,
    foldersError,
  } = useIdeaFolderStore()
  const userWorkspaceOptions = useUserWorkspaceOptions()
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [projectNameById, setProjectNameById] = useState<Record<string, string>>({})
  const projectNameByIdRef = useRef(projectNameById)
  projectNameByIdRef.current = projectNameById
  const toIdea = useCallback((api: IdeaApi): Idea => fromApiIdea(api, projectNameByIdRef.current), [])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedIdeaId, setSelectedIdeaId] = useState('')
  const [selectedIdeaIds, setSelectedIdeaIds] = useState<Set<string>>(() => new Set())
  const [query, setQuery] = useState('')
  const [contentFilterTags, setContentFilterTags] = useState<Set<ContentFilterTag>>(
    () => new Set(ALL_CONTENT_FILTER_TAGS),
  )
  const [folderSortOrder, setFolderSortOrder] = useState<SubmissionSortOrder>('name-asc')
  const [typeFilterTags, setTypeFilterTags] = useState<Set<IdeaType>>(() => new Set(IDEA_TYPES))
  const [statusFilterTags, setStatusFilterTags] = useState<Set<IdeaStatus>>(() => new Set(IDEA_STATUSES))
  const [submissionSortOrder, setSubmissionSortOrder] = useState<SubmissionSortOrder>('name-asc')
  const [showFiltersPanel, setShowFiltersPanel] = useState(true)
  const [showScoringPanels, setShowScoringPanels] = useState(false)
  const [showIntakePanel, setShowIntakePanel] = useState(false)
  const [isListView, setIsListView] = useState(false)
  const [orderedIdeaIds, setOrderedIdeaIds] = useState<string[]>([])
  const [orderedFolderIds, setOrderedFolderIds] = useState<string[]>([])
  const [activeIdeaId, setActiveIdeaId] = useState<string | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null)
  const [dropTargetFolderName, setDropTargetFolderName] = useState<string | null>(null)
  const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null)
  const [contextMenu, setContextMenu] = useState<FixedContextMenuPosition | null>(null)
  const [isSearchFieldMenu, setIsSearchFieldMenu] = useState(false)
  const [ideaCardContextMenu, setIdeaCardContextMenu] = useState<(FixedContextMenuPosition & { idea: Idea }) | null>(null)
  const [isSavingIdeaColor, setIsSavingIdeaColor] = useState(false)
  const [isCreateIdeaDrawerOpen, setIsCreateIdeaDrawerOpen] = useState(false)
  const [isUploadIdeaPanelOpen, setIsUploadIdeaPanelOpen] = useState(false)
  const [deleteIdeaTarget, setDeleteIdeaTarget] = useState<Idea | null>(null)
  const [isDeletingIdea, setIsDeletingIdea] = useState(false)
  const [deleteIdeaError, setDeleteIdeaError] = useState('')
  const [aiAssistanceLoading, setAiAssistanceLoading] = useState<IdeaAiAssistanceMode | null>(null)
  const [aiAssistanceResult, setAiAssistanceResult] = useState<{
    mode: IdeaAiAssistanceMode
    result: string
  } | null>(null)
  const [aiAssistanceError, setAiAssistanceError] = useState('')
  const [aiAssistanceWarning, setAiAssistanceWarning] = useState('')
  const [ideaDraftJob, setIdeaDraftJob] = useState<IdeaDraftJobStatusResponse | null>(null)
  const [isEvidenceDialogOpen, setIsEvidenceDialogOpen] = useState(false)
  const [isBrainstormMode, setIsBrainstormMode] = useState(false)
  const [brainstormMessages, setBrainstormMessages] = useState<BrainstormUiMessage[]>([])
  const [brainstormInput, setBrainstormInput] = useState('')
  const [isBrainstormSending, setIsBrainstormSending] = useState(false)
  const [brainstormAnimatingAssistantIndex, setBrainstormAnimatingAssistantIndex] = useState<number | null>(null)
  const [isDraftContinuing, setIsDraftContinuing] = useState(false)
  const [brainstormError, setBrainstormError] = useState('')
  const [brainstormReady, setBrainstormReady] = useState(false)
  const [brainstormRemainingGaps, setBrainstormRemainingGaps] = useState<string[]>([])
  const [brainstormChecklist, setBrainstormChecklist] = useState<IdeaDraftChecklistItem[]>([])
  const [brainstormEvidenceProgress, setBrainstormEvidenceProgress] = useState<IdeaDraftEvidenceProgress | null>(null)
  const [brainstormDiscoveryProgress, setBrainstormDiscoveryProgress] = useState<IdeaDraftDiscoveryProgress | null>(null)
  const [brainstormConfidencePercent, setBrainstormConfidencePercent] = useState(0)
  const [brainstormOfferGenerateAnyway, setBrainstormOfferGenerateAnyway] = useState(false)
  const [brainstormEvidenceRailCollapsed, setBrainstormEvidenceRailCollapsed] = useState(false)
  const brainstormScrollRef = useRef<HTMLDivElement | null>(null)
  const brainstormComposerRef = useRef<HTMLTextAreaElement | null>(null)

  const scrollBrainstormToBottom = useCallback(() => {
    const node = brainstormScrollRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [])
  const [createIdeaForm, setCreateIdeaForm] = useState({
    title: '',
    description: '',
    workspaceId: '',
    type: 'Innovation' as IdeaType,
    reviewer: '',
  })
  const [createIdeaTags, setCreateIdeaTags] = useState<string[]>([])
  const [createIdeaTagDraft, setCreateIdeaTagDraft] = useState('')
  const [createIdeaTagFeedback, setCreateIdeaTagFeedback] = useState('')
  const [createIdeaWorkspaceOptions, setCreateIdeaWorkspaceOptions] = useState<CreateIdeaWorkspaceOption[]>([])
  const [isCreateIdeaWorkspaceLoading, setIsCreateIdeaWorkspaceLoading] = useState(false)
  const [createIdeaWorkspaceError, setCreateIdeaWorkspaceError] = useState('')
  const [reviewerOptions, setReviewerOptions] = useState<IdeaReviewerOption[]>([])
  const [isReviewerOptionsLoading, setIsReviewerOptionsLoading] = useState(false)
  const [reviewerOptionsError, setReviewerOptionsError] = useState('')
  const [identityUserNameById, setIdentityUserNameById] = useState<Record<string, string>>({})
  const [createIdeaDescriptionHtml, setCreateIdeaDescriptionHtml] = useState('')
  const createIdeaDescriptionEditorRef = useRef<HTMLDivElement | null>(null)
  const createIdeaTagInputRef = useRef<HTMLInputElement | null>(null)
  const [createIdeaError, setCreateIdeaError] = useState('')
  const [ideaAnalysisProgressById, setIdeaAnalysisProgressById] = useState<Record<string, IdeaAnalysisProgress>>({})
  const ideaAnalysisInFlightRef = useRef<Record<string, boolean>>({})
  const navigate = useNavigate()
  const location = useLocation()
  const currentSession = getSession()
  const currentUserId = currentSession?.user.id.trim() ?? ''
  const currentUserDisplayName =
    currentSession?.user.name.trim()
    || currentSession?.user.email.trim()
    || currentUserId

  const createIdeaDescriptionTextLength = useMemo(
    () => extractPlainTextFromIdeaRichHtml(createIdeaDescriptionHtml).length,
    [createIdeaDescriptionHtml]
  )

  const createIdeaProcessDiagrams = useMemo(
    () => extractProcessDiagramsFromText(createIdeaForm.description),
    [createIdeaForm.description],
  )

  const syncBrainstormEvidenceState = (status: Pick<
    IdeaDraftJobStatusResponse,
    'intake_checklist' | 'evidence_progress' | 'discovery_progress' | 'confidence_percent' | 'brainstorm_ready'
  >) => {
    setBrainstormChecklist(status.intake_checklist ?? status.evidence_progress?.items ?? [])
    setBrainstormEvidenceProgress(status.evidence_progress ?? null)
    setBrainstormDiscoveryProgress(status.discovery_progress ?? null)
    setBrainstormConfidencePercent(
      resolveBrainstormConfidencePercent(
        status.confidence_percent,
        status.evidence_progress ?? null,
        Boolean(status.brainstorm_ready),
      ),
    )
  }

  const syncCreateIdeaDescriptionFromHtml = (nextHtml: string) => {
    const sanitized = sanitizeIdeaDescriptionRichHtml(nextHtml)
    const plain = extractPlainTextFromIdeaRichHtml(sanitized)
    setCreateIdeaDescriptionHtml(sanitized)
    setCreateIdeaForm((prev) => ({ ...prev, description: plain }))
    return sanitized
  }

  const setCreateIdeaDescriptionFromPlainText = (nextText: string) => {
    const plain = nextText.trim()
    const html = plainTextToIdeaRichHtml(plain)
    setCreateIdeaDescriptionHtml(html)
    setCreateIdeaForm((prev) => ({ ...prev, description: plain }))
    const editor = createIdeaDescriptionEditorRef.current
    if (editor && editor.innerHTML !== html) editor.innerHTML = html
  }

  const applyCreateIdeaDescriptionCommand = (command: string) => {
    const editor = createIdeaDescriptionEditorRef.current
    if (!editor) return
    editor.focus()
    document.execCommand(command, false)
    syncCreateIdeaDescriptionFromHtml(editor.innerHTML)
  }

  const applyCreateIdeaDescriptionBlock = (block: 'h2' | 'h3' | 'p') => {
    const editor = createIdeaDescriptionEditorRef.current
    if (!editor) return
    editor.focus()
    document.execCommand('formatBlock', false, block)
    syncCreateIdeaDescriptionFromHtml(editor.innerHTML)
  }

  const normalizeIdeaTag = (value: string): string => value.trim().replace(/\s+/g, ' ')

  const dedupeIdeaTags = (tags: string[]): string[] => {
    const used = new Set<string>()
    const result: string[] = []
    for (const raw of tags) {
      const normalized = normalizeIdeaTag(raw)
      if (!normalized) continue
      const key = normalized.toLocaleLowerCase()
      if (used.has(key)) continue
      used.add(key)
      result.push(normalized)
    }
    return result
  }

  const parseIdeaTagsFromText = (value: string): string[] =>
    dedupeIdeaTags(
      value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
    )

  const mergeCreateIdeaTags = (baseTags: string[], inputText: string) => {
    const parsed = parseIdeaTagsFromText(inputText)
    const acceptedByLength: string[] = []
    let rejectedByLength = 0

    for (const tag of parsed) {
      if (tag.length > MAX_CREATE_IDEA_TAG_LENGTH) {
        rejectedByLength += 1
        continue
      }
      acceptedByLength.push(tag)
    }

    const merged = dedupeIdeaTags([...baseTags, ...acceptedByLength])
    const trimmed = merged.slice(0, MAX_CREATE_IDEA_TAGS)
    const droppedByMax = Math.max(0, merged.length - trimmed.length)
    return { tags: trimmed, rejectedByLength, droppedByMax }
  }

  const addCreateIdeaTagsFromText = (value: string) => {
    setCreateIdeaTags((prev) => {
      const next = mergeCreateIdeaTags(prev, value)
      if (next.rejectedByLength > 0) {
        setCreateIdeaTagFeedback(`Tag max ${MAX_CREATE_IDEA_TAG_LENGTH} characters.`)
      } else if (next.droppedByMax > 0) {
        setCreateIdeaTagFeedback(`Maximum ${MAX_CREATE_IDEA_TAGS} tags allowed.`)
      } else {
        setCreateIdeaTagFeedback('')
      }
      return next.tags
    })
  }

  const commitCreateIdeaTagDraft = () => {
    const draft = createIdeaTagDraft.trim()
    if (!draft) return
    addCreateIdeaTagsFromText(draft)
    setCreateIdeaTagDraft('')
  }

  const removeCreateIdeaTag = (tag: string) => {
    const target = tag.toLocaleLowerCase()
    setCreateIdeaTags((prev) => prev.filter((item) => item.toLocaleLowerCase() !== target))
    setCreateIdeaTagFeedback('')
  }

  const handleCreateIdeaTagKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commitCreateIdeaTagDraft()
      return
    }
    if (event.key === 'Backspace' && !createIdeaTagDraft.trim() && createIdeaTags.length > 0) {
      event.preventDefault()
      setCreateIdeaTags((prev) => prev.slice(0, -1))
    }
  }

  const effectiveCreateIdeaTags = useMemo(() => mergeCreateIdeaTags(createIdeaTags, createIdeaTagDraft).tags, [createIdeaTagDraft, createIdeaTags])

  const brainstormInitiativeMatches = useMemo(
    () => inferInitiativeLens(createIdeaForm.title, effectiveCreateIdeaTags, brainstormMessages),
    [createIdeaForm.title, effectiveCreateIdeaTags, brainstormMessages],
  )

  const quickCreateIdeaTagSuggestions = useMemo(() => {
    const used = new Set(createIdeaTags.map((tag) => tag.toLocaleLowerCase()))
    return IDEA_TAG_QUICK_SUGGESTIONS.filter((tag) => !used.has(tag.toLocaleLowerCase()))
  }, [createIdeaTags])

  const isCreateIdeaTagLimitReached = createIdeaTags.length >= MAX_CREATE_IDEA_TAGS
  const isCreateIdeaFormValid = useMemo(() => {
    const hasTitle = createIdeaForm.title.trim().length > 0
    const hasDescription = createIdeaForm.description.trim().length > 0
    const hasWorkspace = createIdeaForm.workspaceId.trim().length > 0
    const hasValidTags = !createIdeaTagFeedback
    const workspaceReady = !isCreateIdeaWorkspaceLoading
    const noBlockingLookupError = !createIdeaWorkspaceError

    return (
      hasTitle &&
      hasDescription &&
      hasWorkspace &&
      hasValidTags &&
      workspaceReady &&
      noBlockingLookupError
    )
  }, [
    createIdeaForm.description,
    createIdeaForm.title,
    createIdeaForm.workspaceId,
    createIdeaTagFeedback,
    createIdeaWorkspaceError,
    effectiveCreateIdeaTags.length,
    isCreateIdeaWorkspaceLoading,
  ])

  useEffect(() => {
    if (!isCreateIdeaDrawerOpen) return
    const editor = createIdeaDescriptionEditorRef.current
    if (!editor) return
    const normalized = sanitizeIdeaDescriptionRichHtml(createIdeaDescriptionHtml)
    if (editor.innerHTML !== normalized) editor.innerHTML = normalized
  }, [createIdeaDescriptionHtml, isCreateIdeaDrawerOpen])

  const selectedIdea = useMemo(
    () => ideas.find((idea) => idea.id === selectedIdeaId) ?? ideas[0],
    [ideas, selectedIdeaId]
  )

  const backlogPageContext = useMemo(() => {
    const filters: string[] = []
    if (query.trim()) filters.push(`search: "${query.trim()}"`)
    if (typeFilterTags.size > 0 && typeFilterTags.size < IDEA_TYPES.length) {
      filters.push(`type: ${[...typeFilterTags].join(', ')}`)
    }
    if (statusFilterTags.size > 0 && statusFilterTags.size < IDEA_STATUSES.length) {
      filters.push(`status: ${[...statusFilterTags].join(', ')}`)
    }
    const selection =
      selectedIdeaIds.size > 1
        ? `${selectedIdeaIds.size} ideas selected`
        : selectedIdea
          ? `selected idea: ${selectedIdea.title}`
          : null
    return {
      view_label: isListView ? 'List view' : 'Board view',
      entity_type: selectedIdea ? 'idea' : null,
      entity_id: selectedIdea?.id ?? null,
      entity_title: selectedIdea?.title ?? null,
      entity_status: selectedIdea?.status ?? null,
      filters_summary: filters.length > 0 ? filters.join('; ') : null,
      selection_summary: selection,
    }
  }, [
    query,
    typeFilterTags,
    statusFilterTags,
    selectedIdea,
    selectedIdeaIds,
    isListView,
  ])
  useTectonaPageContextReporter('/idea-backlog', backlogPageContext)

  const totalScore = useMemo(() => {
    if (!selectedIdea) return 0
    const { businessValue, effort, risk, roi } = selectedIdea.scoring
    return businessValue * 3 + roi * 3 + (11 - effort) * 2 + (11 - risk) * 2
  }, [selectedIdea])

  const ranking = useMemo(() => {
    const scored = ideas
      .map((idea) => {
        const { businessValue, effort, risk, roi } = idea.scoring
        const score = businessValue * 3 + roi * 3 + (11 - effort) * 2 + (11 - risk) * 2
        return { id: idea.id, score }
      })
      .sort((a, b) => b.score - a.score)

    return scored.findIndex((item) => item.id === selectedIdea?.id) + 1
  }, [ideas, selectedIdea])

  const scoreTier = useMemo(() => {
    if (totalScore >= 80) return { label: 'Priority A', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
    if (totalScore >= 65) return { label: 'Priority B', tone: 'text-blue-700 bg-blue-50 border-blue-200' }
    if (totalScore >= 50) return { label: 'Priority C', tone: 'text-amber-700 bg-amber-50 border-amber-200' }
    return { label: 'Priority D', tone: 'text-rose-700 bg-rose-50 border-rose-200' }
  }, [totalScore])

  const metrics = useMemo(() => {
    const totalIdeas = ideas.length
    const newSubmissions = ideas.filter((idea) => idea.status === 'New Submission').length
    const underReview = ideas.filter((idea) => idea.status === 'Under Review').length
    const approved = ideas.filter((idea) => idea.status === 'Approved').length
    const rejected = ideas.filter((idea) => idea.status === 'Rejected').length
    const converted = ideas.filter((idea) => idea.status === 'Converted to Project').length

    return { totalIdeas, newSubmissions, underReview, approved, rejected, converted }
  }, [ideas])

  const funnelData = [
    {
      stage: 'Submitted',
      value: metrics.totalIdeas,
      fill: '#cbd5e1',
      description: 'All ideas entering strategic intake.',
    },
    {
      stage: 'Evaluated',
      value: metrics.underReview + metrics.approved + metrics.rejected + metrics.converted,
      fill: '#94a3b8',
      description: 'Ideas screened by governance and scoring.',
    },
    {
      stage: 'Approved',
      value: metrics.approved + metrics.converted,
      fill: '#64748b',
      description: 'Ideas cleared for execution planning.',
    },
    {
      stage: 'Executed',
      value: metrics.converted,
      fill: '#475569',
      description: 'Ideas converted into active delivery work.',
    },
  ]

  const funnelMax = Math.max(...funnelData.map((item) => item.value), 1)
  const funnelSummary = funnelData.map((item, index) => {
    const previousValue = index === 0 ? item.value : funnelData[index - 1].value
    const conversion = index === 0 ? 100 : Math.round((item.value / Math.max(previousValue, 1)) * 100)
    const dropOff = index === 0 ? 0 : Math.max(previousValue - item.value, 0)

    return {
      ...item,
      shareOfTotal: Math.round((item.value / Math.max(metrics.totalIdeas, 1)) * 100),
      conversion,
      dropOff,
    }
  })

  const funnelThroughput = funnelSummary[funnelSummary.length - 1]?.shareOfTotal ?? 0
  const funnelLargestDrop = funnelSummary.slice(1).reduce(
    (largest, item) => (item.dropOff > largest.dropOff ? item : largest),
    funnelSummary[1] ?? funnelSummary[0]
  )

  const typeCounts = useMemo(() => {
    const counts = {
      Innovation: ideas.filter((idea) => idea.type === 'Innovation').length,
      Improvement: ideas.filter((idea) => idea.type === 'Improvement').length,
      Request: ideas.filter((idea) => idea.type === 'Request').length,
      Transformation: ideas.filter((idea) => idea.type === 'Transformation').length,
    }
    return counts
  }, [ideas])

  const typeTotalForLabel = useMemo(() => {
    return Object.values(typeCounts).reduce((sum, count) => sum + count, 0)
  }, [typeCounts])

  const statusCounts = useMemo(() => {
    const counts = {
      'New Submission': ideas.filter((idea) => idea.status === 'New Submission').length,
      'Under Review': ideas.filter((idea) => idea.status === 'Under Review').length,
      'Approved': ideas.filter((idea) => idea.status === 'Approved').length,
      'Rejected': ideas.filter((idea) => idea.status === 'Rejected').length,
      'Converted to Project': ideas.filter((idea) => idea.status === 'Converted to Project').length,
    }
    return counts
  }, [ideas])

  const statusTotalForLabel = useMemo(() => {
    return Object.values(statusCounts).reduce((sum, count) => sum + count, 0)
  }, [statusCounts])

  const ideasInCurrentFolder = useMemo(() => {
    const normalizedFolderId = currentFolderId ?? null
    return ideas.filter((idea) => (idea.folderId ?? null) === normalizedFolderId)
  }, [ideas, currentFolderId])

  const foldersInCurrentParent = useMemo(() => {
    const normalizedParentId = currentFolderId ?? null
    return folders.filter((folder) => (folder.parentId ?? null) === normalizedParentId)
  }, [folders, currentFolderId])

  const folderAncestors = useMemo(() => {
    if (!currentFolderId) return [] as IdeaBacklogFolder[]
    const chain: IdeaBacklogFolder[] = []
    let cursor = getFolder(currentFolderId)
    while (cursor) {
      chain.unshift(cursor)
      cursor = cursor.parentId ? getFolder(cursor.parentId) : undefined
    }
    return chain
  }, [currentFolderId, folders, getFolder])

  const currentFolder = currentFolderId ? getFolder(currentFolderId) : undefined

  useEffect(() => {
    if (tenant?.loading) return
    void fetchFolders(LEGACY_DUMMY_OWNER_ID)
    void fetchFolders(LEGACY_DUMMY_OWNER_ID, currentFolderId ?? null)
  }, [tenant?.loading, tenant?.workspaceId, currentFolderId, fetchFolders])

  useEffect(() => {
    const onTenantChanged = () => {
      useIdeaFolderStore.getState().clearLocalCache()
      void fetchFolders(LEGACY_DUMMY_OWNER_ID)
      void fetchFolders(LEGACY_DUMMY_OWNER_ID, currentFolderId ?? null)
    }
    window.addEventListener(TECTONA_TENANT_CHANGED_EVENT, onTenantChanged)
    return () => window.removeEventListener(TECTONA_TENANT_CHANGED_EVENT, onTenantChanged)
  }, [currentFolderId, fetchFolders])

  const handleOpenFolder = useCallback(
    (folderId: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('folder', folderId)
        return next
      })
    },
    [setSearchParams],
  )

  const handleBackToFolderRoot = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('folder')
      return next
    })
  }, [setSearchParams])

  const handleNavigateToFolderAncestor = useCallback(
    (folderId: string | null) => {
      if (!folderId) {
        handleBackToFolderRoot()
        return
      }
      handleOpenFolder(folderId)
    },
    [handleBackToFolderRoot, handleOpenFolder],
  )

  const handleCreateFolderWithDefaultName = useCallback(async () => {
    const parentId = currentFolderId ?? null
    const siblings = folders.filter((folder) => (folder.parentId ?? null) === parentId)
    const usedNumbers = siblings
      .filter((folder) => /^Untitled \d+$/.test(folder.name))
      .map((folder) => parseInt(folder.name.replace('Untitled ', ''), 10))
    const nextNum = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1
    const defaultName = `Untitled ${nextNum}`
    try {
      await addFolder({
        name: defaultName,
        parentId,
        ownerId: LEGACY_DUMMY_OWNER_ID,
      })
      addToast({
        title: 'Folder created',
        description: `"${defaultName}" has been created. Rename via right-click.`,
        variant: 'success',
      })
      notifyEvent({
        type_code: 'folder',
        title: 'Folder created',
        body: `"${defaultName}" has been created in Idea & Backlog.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create folder'
      addToast({ title: 'Error', description: msg, variant: 'error' })
    }
  }, [folders, addFolder, addToast, currentFolderId])

  const handleRenameIdeaFolder = useCallback(
    async (folderId: string, name: string) => {
      try {
        await updateFolder(folderId, { name })
        addToast({ title: 'Folder renamed', description: `"${name}" saved.`, variant: 'success' })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to rename folder'
        addToast({ title: 'Error', description: msg, variant: 'error' })
      }
    },
    [updateFolder, addToast],
  )

  const handleDeleteIdeaFolder = useCallback(
    async (folder: IdeaBacklogFolder) => {
      const ideasInFolder = ideas.filter((idea) => idea.folderId === folder.id).length
      const childFolders = folders.filter((item) => item.parentId === folder.id).length
      const confirmed = window.confirm(
        `Delete folder "${folder.name}"? It contains ${ideasInFolder} idea(s) and ${childFolders} subfolder(s). Ideas will move to the parent level.`,
      )
      if (!confirmed) return
      try {
        await deleteFolder(folder.id)
        if (currentFolderId === folder.id) {
          handleNavigateToFolderAncestor(folder.parentId ?? null)
        }
        addToast({ title: 'Folder deleted', description: `"${folder.name}" removed.`, variant: 'success' })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to delete folder'
        addToast({ title: 'Error', description: msg, variant: 'error' })
      }
    },
    [ideas, folders, deleteFolder, currentFolderId, handleNavigateToFolderAncestor, addToast],
  )

  const filteredFolders = useMemo(() => {
    const q = query.trim().toLowerCase()
    return foldersInCurrentParent.filter((folder) => {
      if (!q) return true
      return (
        folder.name.toLowerCase().includes(q)
        || (folder.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [foldersInCurrentParent, query])

  const contentCounts = useMemo(() => ({
    folders: filteredFolders.length,
    ideas: ideasInCurrentFolder.length,
  }), [filteredFolders.length, ideasInCurrentFolder.length])

  const foldersWithVisibleCounts = useMemo(() => {
    const ideaCountByFolder = new Map<string, number>()
    for (const idea of ideas) {
      const folderId = idea.folderId
      if (!folderId) continue
      ideaCountByFolder.set(folderId, (ideaCountByFolder.get(folderId) ?? 0) + 1)
    }
    const childCountByFolder = new Map<string, number>()
    for (const folder of folders) {
      const parentId = folder.parentId
      if (!parentId) continue
      childCountByFolder.set(parentId, (childCountByFolder.get(parentId) ?? 0) + 1)
    }
    return filteredFolders.map((folder) => ({
      ...folder,
      ideaCount: (isLoading || loadError) ? folder.ideaCount : (ideaCountByFolder.get(folder.id) ?? 0),
      childrenCount: childCountByFolder.get(folder.id) ?? 0,
    }))
  }, [filteredFolders, ideas, folders, isLoading, loadError])

  const contentTotalForLabel = contentCounts.folders + contentCounts.ideas

  useEffect(() => {
    if (!currentFolderId || foldersLoading) return
    if (!getFolder(currentFolderId)) {
      handleBackToFolderRoot()
    }
  }, [currentFolderId, foldersLoading, folders, getFolder, handleBackToFolderRoot])

  const showFoldersSection = contentFilterTags.has('folders')
  const showIdeasSection = contentFilterTags.has('ideas')

  const filteredIdeas = useMemo(() => {
    return ideasInCurrentFolder.filter((idea) => {
      const matchQuery =
        idea.title.toLowerCase().includes(query.toLowerCase()) ||
        idea.description.toLowerCase().includes(query.toLowerCase()) ||
        idea.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase()))
      const matchType = typeFilterTags.size === 0 || typeFilterTags.has(idea.type)
      const matchStatus = statusFilterTags.size === 0 || statusFilterTags.has(idea.status)
      return matchQuery && matchType && matchStatus
    })
  }, [ideasInCurrentFolder, query, typeFilterTags, statusFilterTags])

  const sortedFilteredIdeas = useMemo(() => {
    return [...filteredIdeas].sort((a, b) => {
      const titleA = a.title.toLowerCase()
      const titleB = b.title.toLowerCase()
      if (submissionSortOrder === 'name-asc') return titleA.localeCompare(titleB)
      return titleB.localeCompare(titleA)
    })
  }, [filteredIdeas, submissionSortOrder])

  const orderedSortedFilteredIdeas = useMemo(() => {
    const byId = new Map(sortedFilteredIdeas.map((idea) => [idea.id, idea]))
    const ordered = orderedIdeaIds.map((id) => byId.get(id)).filter(Boolean) as Idea[]
    const rest = sortedFilteredIdeas.filter((idea) => !orderedIdeaIds.includes(idea.id))
    return [...ordered, ...rest]
  }, [sortedFilteredIdeas, orderedIdeaIds])

  const isDragActive = activeIdeaId !== null
  const isIdeaDragActive = activeDragId?.startsWith('idea-') ?? false
  const draggedIdeaIds = useMemo(() => {
    if (!activeIdeaId) return new Set<string>()
    if (selectedIdeaIds.size > 1 && selectedIdeaIds.has(activeIdeaId)) return selectedIdeaIds
    return new Set([activeIdeaId])
  }, [activeIdeaId, selectedIdeaIds])

  const folderDropCollisionDetection = useMemo(
    () => createIdeaFolderDropCollisionDetection(folders),
    [folders],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const isAnyItemDragActive = Boolean(activeDragId)
  useEffect(() => {
    if (!isAnyItemDragActive) {
      setDragPointer(null)
      setDropTargetFolderId(null)
      setDropTargetFolderName(null)
      return
    }
    const onPointerMove = (event: PointerEvent) => {
      setDragPointer({ x: event.clientX, y: event.clientY })
    }
    window.addEventListener('pointermove', onPointerMove)
    return () => window.removeEventListener('pointermove', onPointerMove)
  }, [isAnyItemDragActive])

  const decideIdea = async (status: IdeaStatus) => {
    if (!selectedIdea) return
    const targetStatus = toBackendStatus(status)
    try {
      const updated = await patchIdea(selectedIdea.id, { status_code: targetStatus, version: selectedIdea.version })
      setIdeas((prev) => prev.map((idea) => (idea.id === selectedIdea.id ? toIdea(updated) : idea)))
    } catch {
      // optimistic fallback
      setIdeas((prev) => prev.map((idea) => (idea.id === selectedIdea.id ? { ...idea, status } : idea)))
    }
  }

  const updateIdeaStatus = async (ideaId: string, status: IdeaStatus) => {
    const idea = ideas.find((i) => i.id === ideaId)
    if (!idea) return
    const targetStatus = toBackendStatus(status)
    try {
      const updated = await patchIdea(ideaId, { status_code: targetStatus, version: idea.version })
      setIdeas((prev) => prev.map((i) => (i.id === ideaId ? toIdea(updated) : i)))
    } catch {
      setIdeas((prev) => prev.map((i) => (i.id === ideaId ? { ...i, status } : i)))
    }
  }

  const applyIdeaCardAccentColor = async (color: string, ideaIds: string[]) => {
    const uniqueIds = Array.from(new Set(ideaIds)).filter(Boolean)
    if (!uniqueIds.length || isSavingIdeaColor) return

    const snapshot = new Map<string, Idea>()
    for (const ideaId of uniqueIds) {
      const idea = ideas.find((item) => item.id === ideaId)
      if (idea) snapshot.set(ideaId, idea)
    }
    if (!snapshot.size) return

    setIsSavingIdeaColor(true)
    setIdeas((prev) =>
      prev.map((idea) => (snapshot.has(idea.id) ? { ...idea, cardAccentColor: color } : idea)),
    )

    try {
      const results = await Promise.all(
        Array.from(snapshot.entries()).map(async ([ideaId, idea]) => {
          const updated = await patchIdea(ideaId, {
            card_accent_color: color,
            version: idea.version,
          })
          return toIdea(updated)
        }),
      )
      const updatedById = new Map(results.map((idea) => [idea.id, idea]))
      setIdeas((prev) => prev.map((idea) => updatedById.get(idea.id) ?? idea))
    } catch {
      setIdeas((prev) =>
        prev.map((idea) => {
          const previous = snapshot.get(idea.id)
          return previous ?? idea
        }),
      )
    } finally {
      setIsSavingIdeaColor(false)
    }
  }

  const handleIdeaDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    setActiveDragId(id)
    if (id.startsWith('idea-')) setActiveIdeaId(id.replace('idea-', ''))
    const activator = event.activatorEvent
    if (activator && 'clientX' in activator && 'clientY' in activator) {
      setDragPointer({
        x: (activator as PointerEvent).clientX,
        y: (activator as PointerEvent).clientY,
      })
    }
  }

  const clearIdeaDragState = () => {
    setActiveIdeaId(null)
    setActiveDragId(null)
    setDropTargetFolderId(null)
    setDropTargetFolderName(null)
  }

  const moveIdeasToFolder = async (ideaIds: string[], folderId: string | null) => {
    const targets = ideas.filter((idea) => ideaIds.includes(idea.id) && (idea.folderId ?? null) !== folderId)
    if (targets.length === 0) return
    const results = await Promise.all(
      targets.map((idea) =>
        patchIdea(idea.id, { folder_id: folderId, version: idea.version }).then((updated) => toIdea(updated)),
      ),
    )
    const byId = new Map(results.map((idea) => [idea.id, idea]))
    setIdeas((prev) => prev.map((idea) => byId.get(idea.id) ?? idea))
    void fetchFolders(LEGACY_DUMMY_OWNER_ID)
    void fetchFolders(LEGACY_DUMMY_OWNER_ID, currentFolderId ?? null)
  }

  const handleIdeaDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    const draggingId = String(active.id)
    const overId = over ? String(over.id) : null

    try {
      if (!overId) {
        clearIdeaDragState()
        return
      }

      if (draggingId.startsWith('folder-') && isNestDropId(overId)) {
        const sourceId = draggingId.replace('folder-', '')
        const targetId = parseNestDropId(overId)
        if (sourceId !== targetId && canMoveIdeaFolderToTarget(sourceId, targetId, folders)) {
          await updateFolder(sourceId, { parentId: targetId })
          const targetName = getFolder(targetId)?.name ?? 'folder'
          addToast({
            title: 'Folder dipindahkan',
            description: `Dipindahkan ke "${targetName}".`,
            variant: 'success',
          })
        }
        clearIdeaDragState()
        return
      }

      if (
        draggingId.startsWith('folder-')
        && overId.startsWith('folder-')
        && !isNestDropId(overId)
        && !isIdeaFolderDropId(overId)
      ) {
        const siblingIds = filteredFolders.map((folder) => folder.id)
        const orderedIds = [
          ...orderedFolderIds.filter((id) => siblingIds.includes(id)),
          ...siblingIds.filter((id) => !orderedFolderIds.includes(id)),
        ]
        const oldIndex = orderedIds.indexOf(draggingId.replace('folder-', ''))
        const newIndex = orderedIds.indexOf(overId.replace('folder-', ''))
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          setOrderedFolderIds(arrayMove(orderedIds, oldIndex, newIndex))
          addToast({
            title: 'Urutan diubah',
            description: 'Posisi folder telah diperbarui.',
            variant: 'success',
          })
        }
        clearIdeaDragState()
        return
      }

      if (draggingId.startsWith('idea-') && isIdeaFolderDropId(overId)) {
        const ideaId = draggingId.replace('idea-', '')
        const folderId = parseIdeaFolderDropId(overId)
        const idsToMove =
          selectedIdeaIds.size > 1 && selectedIdeaIds.has(ideaId)
            ? Array.from(selectedIdeaIds)
            : [ideaId]
        await moveIdeasToFolder(idsToMove, folderId)
        const folderName = getFolder(folderId)?.name ?? 'folder'
        addToast({
          title: 'Idea dipindahkan',
          description: idsToMove.length > 1
            ? `${idsToMove.length} ideas dipindahkan ke "${folderName}".`
            : `Idea telah dipindahkan ke "${folderName}".`,
          variant: 'success',
        })
        clearIdeaDragState()
        return
      }

      if (draggingId.startsWith('idea-') && overId.startsWith('idea-')) {
        const activeId = draggingId.replace('idea-', '')
        const overIdeaId = overId.replace('idea-', '')
        const visibleIdeaIds = orderedSortedFilteredIdeas.map((idea) => idea.id)
        const oldIndex = visibleIdeaIds.indexOf(activeId)
        const newIndex = visibleIdeaIds.indexOf(overIdeaId)
        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          const reorderedVisible = arrayMove(visibleIdeaIds, oldIndex, newIndex)
          setOrderedIdeaIds((prev) => {
            const remaining = prev.filter((id) => !visibleIdeaIds.includes(id))
            return [...reorderedVisible, ...remaining]
          })
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to move item'
      addToast({ title: 'Error', description: msg, variant: 'error' })
    }

    clearIdeaDragState()
  }

  const handleIdeaDragOver = (event: DragOverEvent) => {
    const draggingId = String(event.active.id)
    const overId = event.over?.id ? String(event.over.id) : null

    if (!overId) {
      setDropTargetFolderId(null)
      setDropTargetFolderName(null)
      return
    }

    if (draggingId.startsWith('idea-') && isIdeaFolderDropId(overId)) {
      const folderId = parseIdeaFolderDropId(overId)
      setDropTargetFolderId(folderId)
      setDropTargetFolderName(getFolder(folderId)?.name ?? null)
      return
    }

    if (draggingId.startsWith('folder-') && isNestDropId(overId)) {
      const sourceId = draggingId.replace('folder-', '')
      const folderId = parseNestDropId(overId)
      if (sourceId === folderId || !canMoveIdeaFolderToTarget(sourceId, folderId, folders)) {
        setDropTargetFolderId(null)
        setDropTargetFolderName(null)
        return
      }
      setDropTargetFolderId(folderId)
      setDropTargetFolderName(getFolder(folderId)?.name ?? null)
      return
    }

    setDropTargetFolderId(null)
    setDropTargetFolderName(null)
  }

  const handleIdeaDragCancel = () => {
    clearIdeaDragState()
  }

  useEffect(() => {
    if (tenant?.loading) return

    let cancelled = false
    setIsLoading(true)
    setLoadError(null)
    setIdeas([])
    setProjectNameById({})
    projectNameByIdRef.current = {}
    setSelectedIdeaId('')
    setSelectedIdeaIds(new Set())

    const workspaceApiId = resolveWorkspaceApiId(tenant?.workspaceId)
    const listParams: Parameters<typeof fetchAllIdeas>[0] = {}
    if (workspaceApiId) {
      listParams.workspace_id = workspaceApiId
    }

    Promise.all([
      fetchAllIdeas(listParams),
      fetchIdentityUsers({ limit: 500, offset: 0 }).catch(() => null),
      fetchAllProjects({
        app_id: TECTONA_PROJECT_APP_ID,
        workspace_id: workspaceApiId,
      }).catch(() => []),
    ])
      .then(async ([ideaItems, usersRes, projects]) => {
        if (cancelled) return
        const namesByProjectId = Object.fromEntries(projects.map((project) => [project.id, project.name]))
        const linkedProjectIds = [
          ...new Set(
            ideaItems
              .map((item) => item.project_id?.trim())
              .filter((id): id is string => Boolean(id)),
          ),
        ]
        const unresolvedProjectIds = linkedProjectIds.filter((id) => !namesByProjectId[id])
        if (unresolvedProjectIds.length > 0) {
          const globalProjects = await fetchAllProjects({ app_id: TECTONA_PROJECT_APP_ID }).catch(() => [])
          if (!cancelled) {
            for (const project of globalProjects) {
              namesByProjectId[project.id] = project.name
            }
          }
        }
        const stillUnresolved = linkedProjectIds.filter((id) => !namesByProjectId[id])
        if (stillUnresolved.length > 0 && !cancelled) {
          const fetched = await Promise.all(stillUnresolved.map((id) => fetchProject(id)))
          for (const project of fetched) {
            if (project?.id && project.name) {
              namesByProjectId[project.id] = project.name
            }
          }
        }
        if (cancelled) return
        setProjectNameById(namesByProjectId)
        projectNameByIdRef.current = namesByProjectId
        const identityNames = mapIdentityUserDisplayNames(usersRes?.items)
        if (currentUserId && currentUserDisplayName) {
          identityNames[currentUserId] = identityNames[currentUserId] ?? currentUserDisplayName
        }
        if (Object.keys(identityNames).length > 0) {
          setIdentityUserNameById(identityNames)
        }
        // Always enforce active workspace scope client-side (covers "All workspaces"
        // + accessible-ID filtering, and legacy rows without workspace_id).
        const scope = readActiveWorkspaceScope()
        const mapped = ideaItems
          .map((api) => fromApiIdea(api, namesByProjectId))
          .filter((idea) => belongsToActiveWorkspaceScope(idea.workspace, scope))
        setIdeas(mapped)
        if (mapped.length > 0) {
          setSelectedIdeaId(mapped[0].id)
          setSelectedIdeaIds(new Set([mapped[0].id]))
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'Failed to load ideas.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [currentUserDisplayName, currentUserId, tenant?.loading, tenant?.workspaceId, tenant?.tenantMode])

  useEffect(() => {
    return () => {
      ideaAnalysisInFlightRef.current = {}
    }
  }, [])

  useEffect(() => {
    if (!isCreateIdeaDrawerOpen) return

    const activeWorkspaceId = resolveWorkspaceApiId(tenant?.workspaceId) ?? ''
    if (activeWorkspaceId) {
      setCreateIdeaForm((prev) => (
        prev.workspaceId === activeWorkspaceId
          ? prev
          : { ...prev, workspaceId: activeWorkspaceId, reviewer: '' }
      ))
    }

    setIsCreateIdeaWorkspaceLoading(userWorkspaceOptions.loading)
    setCreateIdeaWorkspaceError('')

    if (userWorkspaceOptions.loading) {
      setCreateIdeaWorkspaceOptions([])
      return
    }

    if (userWorkspaceOptions.error) {
      setCreateIdeaWorkspaceOptions([])
      setCreateIdeaWorkspaceError(userWorkspaceOptions.error)
      setIsCreateIdeaWorkspaceLoading(false)
      return
    }

    const options = userWorkspaceOptions.options
      .map((option) => ({ id: option.workspaceId, name: option.workspaceName.trim() }))
      .filter((option) => option.id && option.name)
      .sort((a, b) => {
        if (a.id === activeWorkspaceId) return -1
        if (b.id === activeWorkspaceId) return 1
        return a.name.localeCompare(b.name)
      })
    setCreateIdeaWorkspaceOptions(options)
    setCreateIdeaForm((prev) => {
      const hasSelected = options.some((option) => option.id === prev.workspaceId)
      if (hasSelected || options.length === 0) return prev
      const defaultWorkspaceId = options.some((option) => option.id === activeWorkspaceId)
        ? activeWorkspaceId
        : options[0].id
      return { ...prev, workspaceId: defaultWorkspaceId }
    })
    setIsCreateIdeaWorkspaceLoading(false)
  }, [
    isCreateIdeaDrawerOpen,
    tenant?.workspaceId,
    userWorkspaceOptions.error,
    userWorkspaceOptions.loading,
    userWorkspaceOptions.options,
  ])

  useEffect(() => {
    if (!isCreateIdeaDrawerOpen) return
    let cancelled = false
    setIsReviewerOptionsLoading(true)
    setReviewerOptionsError('')

    const selectedWorkspaceId = createIdeaForm.workspaceId.trim()

    if (!selectedWorkspaceId) {
      setReviewerOptions([])
      setReviewerOptionsError('Select workspace first to load members.')
      setIsReviewerOptionsLoading(false)
      return
    }

    void (async () => {
      try {
        const usersRes = await fetchIdentityUsers({ limit: 500, offset: 0 }).catch(() => null)
        const membersRes = await fetchWorkspaceMembers(TECTONA_WAC_APP_ID, selectedWorkspaceId)

        if (cancelled) return
        const userBySubjectId = new Map<string, IdentityUserDto>()
        for (const user of usersRes?.items ?? []) {
          userBySubjectId.set(user.id, user)
        }
        const identityNames = mapIdentityUserDisplayNames(usersRes?.items)
        if (Object.keys(identityNames).length > 0) {
          setIdentityUserNameById((prev) => ({ ...prev, ...identityNames }))
        }

        const activeRows = membersRes.items.filter((row) => {
          const status = (row.membership_status ?? row.status_code ?? '').toLowerCase().trim()
          return status === '' || status === 'active'
        })
        const sourceRows = activeRows.length > 0 ? activeRows : membersRes.items
        const optionsBySubjectId = new Map<string, IdeaReviewerOption>()

        for (const row of sourceRows) {
          if (optionsBySubjectId.has(row.subject_id)) continue
          const user = userBySubjectId.get(row.subject_id)
          const displayName =
            user?.display_name?.trim()
            || user?.email?.trim()
            || `User ${row.subject_id.slice(0, 8)}`
          const roleLabel = row.role_display_name?.trim() || wacRoleCodeToUiRole(row.role_code)
          optionsBySubjectId.set(row.subject_id, {
            subjectId: row.subject_id,
            displayName,
            roleLabel,
          })
        }

        const options = [...optionsBySubjectId.values()].sort((a, b) =>
          a.displayName.localeCompare(b.displayName)
        )
        setReviewerOptions(options)
      } catch (err: unknown) {
        if (cancelled) return
        setReviewerOptions([])
        const rawMessage = err instanceof Error ? err.message : ''
        const normalizedMessage =
          /HTTP\s*422/i.test(rawMessage)
            ? 'Workspace members unavailable: workspace id is invalid for WAC endpoint.'
            : rawMessage || 'Failed to load workspace members.'
        setReviewerOptionsError(normalizedMessage)
      } finally {
        if (!cancelled) setIsReviewerOptionsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isCreateIdeaDrawerOpen, createIdeaForm.workspaceId])

  useEffect(() => {
    if (!isCreateIdeaDrawerOpen) return
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isEvidenceDialogOpen) return
        setIsCreateIdeaDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [isCreateIdeaDrawerOpen, isEvidenceDialogOpen])

  useEffect(() => {
    if (!isEvidenceDialogOpen) return
    const onEsc = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (isDraftContinuing || isBrainstormSending) return
      event.preventDefault()
      event.stopImmediatePropagation()
      setIsEvidenceDialogOpen(false)
      setIsBrainstormMode(false)
    }
    window.addEventListener('keydown', onEsc, true)
    return () => window.removeEventListener('keydown', onEsc, true)
  }, [isEvidenceDialogOpen, isDraftContinuing, isBrainstormSending])

  useEffect(() => {
    const ideaIds = ideas.map((idea) => idea.id)
    setOrderedIdeaIds((prev) => {
      const known = new Set(ideaIds)
      const persisted = prev.filter((id) => known.has(id))
      const missing = ideaIds.filter((id) => !persisted.includes(id))
      return [...persisted, ...missing]
    })
  }, [ideas])

  const closeContextMenu = () => {
    setContextMenu(null)
    setIdeaCardContextMenu(null)
    setIsSearchFieldMenu(false)
  }

  useEffect(() => {
    if (!contextMenu && !ideaCardContextMenu) return

    const isInsideContextMenu = (target: EventTarget | null) => {
      if (!(target instanceof Node)) return false
      const el = target instanceof HTMLElement ? target : target.parentElement
      if (!el) return false
      return Boolean(
        el.closest('[data-context-menu-root]') || el.closest('[data-context-menu-submenu]'),
      )
    }

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeContextMenu()
      }
    }
    const onResize = () => {
      closeContextMenu()
    }
    const onPointerDown = (event: MouseEvent | PointerEvent) => {
      if (isInsideContextMenu(event.target)) return
      closeContextMenu()
    }
    window.addEventListener('keydown', onEsc)
    window.addEventListener('resize', onResize, { once: true })
    document.addEventListener('mousedown', onPointerDown, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('keydown', onEsc)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('mousedown', onPointerDown, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [contextMenu, ideaCardContextMenu])

  const openContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (isCreateIdeaDrawerOpen) return
    event.preventDefault()

    const target = event.target as HTMLElement
    if (!target.closest('[data-idea-card="true"]')) {
      setSelectedIdeaId('')
      setSelectedIdeaIds(new Set())
    }
    setIsSearchFieldMenu(false)

    setIdeaCardContextMenu(null)
    setContextMenu(
      resolveFixedContextMenuPosition(
        event.clientX,
        event.clientY,
        228,
        BACKGROUND_CONTEXT_MENU_ESTIMATED_HEIGHT,
      ),
    )
  }

  const applyTypeFilterFromContextMenu = (type: IdeaType | 'All') => {
    setShowFiltersPanel(true)
    if (type === 'All') {
      setTypeFilterTags(new Set(IDEA_TYPES))
      return
    }

    setTypeFilterTags((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
        // Keep at least one type active.
        if (next.size === 0) return new Set(IDEA_TYPES)
      } else {
        next.add(type)
      }
      return next
    })
  }

  const applyStatusFilterFromContextMenu = (status: IdeaStatus | 'All') => {
    setShowFiltersPanel(true)
    if (status === 'All') {
      setStatusFilterTags(new Set(IDEA_STATUSES))
      return
    }

    setStatusFilterTags((prev) => {
      const next = new Set(prev)
      if (next.has(status)) {
        next.delete(status)
        // Keep at least one status active.
        if (next.size === 0) return new Set(IDEA_STATUSES)
      } else {
        next.add(status)
      }
      return next
    })
  }

  const isIdeaAnalysisLocked = (ideaId: string) => {
    const state = ideaAnalysisProgressById[ideaId]
    return state?.status === 'running' && state.progress < 100
  }

  const isIdeaAnalysisFailed = (ideaId: string) => {
    const state = ideaAnalysisProgressById[ideaId]
    return state?.status === 'failed' && state.progress >= 100
  }

  const runAgentAnalysisForIdea = async (idea: Idea) => {
    if (isIdeaAnalysisLocked(idea.id) || ideaAnalysisInFlightRef.current[idea.id]) {
      return
    }

    ideaAnalysisInFlightRef.current[idea.id] = true
    setIdeaAnalysisProgressById((prev) => ({
      ...prev,
      [idea.id]: {
        progress: 5,
        status: 'running',
        errorMessage: null,
        currentStepLabel: 'Menyiapkan analisis agent…',
      },
    }))

    const correlationId = `idea-backlog-${idea.id}-${Date.now()}`

    try {
      const started = await startIdeaSummaryJob({
        idea_id: idea.id,
        context: {
          workspace_id: idea.workspace ?? null,
          user_id: idea.submittedBy,
          session_id: correlationId,
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
          mode: 'llm_first',
          allow_llm: true,
          max_evidence: 10,
          force_refresh: false,
        },
      })

      let terminalStatus: 'done' | 'failed' | null = null
      let terminalError: string | null = null
      let runtimeSummary = null as Awaited<ReturnType<typeof getIdeaSummaryJob>>['result']

      for (let attempt = 0; attempt < 360; attempt += 1) {
        const status = await getIdeaSummaryJob(started.job_id)
        const runningStep = status.plan.find((step) => step.status === 'running')
        const stepLabel = runningStep?.label
          ?? status.plan.find((step) => step.status === 'completed')?.label
          ?? null

        if (status.status === 'completed') {
          runtimeSummary = status.result
          terminalStatus = 'done'
          setIdeaAnalysisProgressById((prev) => ({
            ...prev,
            [idea.id]: {
              progress: 100,
              status: 'done',
              errorMessage: null,
              currentStepLabel: 'Analysis complete',
            },
          }))
          break
        }

        if (status.status === 'failed' || status.status === 'cancelled') {
          terminalStatus = 'failed'
          terminalError =
            status.error_message?.trim()
            || (status.status === 'cancelled' ? 'Idea summary was cancelled.' : 'Idea summary failed.')
          setIdeaAnalysisProgressById((prev) => ({
            ...prev,
            [idea.id]: {
              progress: 100,
              status: 'failed',
              errorMessage: terminalError,
              currentStepLabel: null,
            },
          }))
          break
        }

        setIdeaAnalysisProgressById((prev) => {
          const current = prev[idea.id]
          if (!current || current.status !== 'running') return prev
          const nextProgress = Math.max(current.progress, Math.min(99, status.progress_percent || 5))
          if (
            current.progress === nextProgress
            && (current.currentStepLabel ?? null) === (stepLabel ?? null)
          ) {
            return prev
          }
          return {
            ...prev,
            [idea.id]: {
              ...current,
              progress: nextProgress,
              currentStepLabel: stepLabel,
            },
          }
        })

        await new Promise<void>((resolve) => window.setTimeout(resolve, 1250))
      }

      if (!terminalStatus) {
        throw new Error('Idea summary is still running. Please try again shortly.')
      }
      if (terminalStatus === 'failed') {
        return
      }

      try {
        const latestIdea = await getIdeaById(idea.id)
        setIdeas((prev) => prev.map((current) => (current.id === idea.id ? toIdea(latestIdea) : current)))
      } catch {
        // refresh is best-effort; summary may already be persisted by runtime
      }

      // Fallback persist only when runtime reported persistence failure.
      if (
        runtimeSummary
        && Array.isArray(runtimeSummary.warnings)
        && runtimeSummary.warnings.includes('SUMMARY_PERSISTENCE_FAILED')
      ) {
        let ideaVersion = idea.version
        try {
          const latestIdea = await getIdeaById(idea.id)
          ideaVersion = latestIdea.version
        } catch {
          // keep in-memory version
        }
        const summaryMode =
          runtimeSummary.summary_mode === 'deterministic_first'
          || runtimeSummary.summary_mode === 'llm_first'
          || runtimeSummary.summary_mode === 'hybrid'
          || runtimeSummary.summary_mode === 'role_multi_llm'
            ? runtimeSummary.summary_mode
            : 'llm_first'
        await upsertPersistentIdeaSummary(idea.id, {
          summary_json: runtimeSummary as unknown as Record<string, unknown>,
          summary_mode: summaryMode,
          confidence_score: runtimeSummary.confidence_score,
          generated_by: idea.submittedBy || 'tectona-ui',
          source_session_id: runtimeSummary.correlation_id ?? `idea-backlog-${idea.id}`,
          version: ideaVersion,
        })
      }
    } catch (error) {
      setIdeaAnalysisProgressById((prev) => ({
        ...prev,
        [idea.id]: {
          progress: 100,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : null,
          currentStepLabel: null,
        },
      }))
    } finally {
      delete ideaAnalysisInFlightRef.current[idea.id]
    }
  }

  const openIdeaDetail = (idea: Idea) => {
    if (isIdeaAnalysisLocked(idea.id)) return
    navigate(`/idea-backlog/${idea.id}`, { state: { idea } })
  }

  const selectSingleIdea = (ideaId: string) => {
    setSelectedIdeaId(ideaId)
    setSelectedIdeaIds(new Set([ideaId]))
  }

  const handleIdeaCardSelect = (event: ReactMouseEvent<HTMLDivElement>, ideaId: string) => {
    if (event.button !== 0) return
    const isMultiSelect = event.shiftKey || event.ctrlKey || event.metaKey

    setSelectedIdeaId(ideaId)
    setSelectedIdeaIds((prev) => {
      if (!isMultiSelect) return new Set([ideaId])

      const next = new Set(prev)
      if (next.has(ideaId)) next.delete(ideaId)
      else next.add(ideaId)

      // Keep at least one selected item during multi-toggle interactions.
      if (next.size === 0) next.add(ideaId)
      return next
    })
  }

  const openCreateIdeaDrawer = () => {
    setCreateIdeaForm({
      title: '',
      description: '',
      workspaceId: '',
      type: 'Innovation',
      reviewer: '',
    })
    setCreateIdeaTags([])
    setCreateIdeaTagDraft('')
    setCreateIdeaTagFeedback('')
    setCreateIdeaDescriptionHtml('')
    setCreateIdeaError('')
    setIdeaDraftJob(null)
    setIsEvidenceDialogOpen(false)
    setIsBrainstormMode(false)
    setBrainstormMessages([])
    setBrainstormInput('')
    setBrainstormError('')
    setBrainstormReady(false)
    setBrainstormRemainingGaps([])
    setBrainstormChecklist([])
    setBrainstormEvidenceProgress(null)
    setBrainstormDiscoveryProgress(null)
    setBrainstormConfidencePercent(0)
    setBrainstormOfferGenerateAnyway(false)
    setBrainstormEvidenceRailCollapsed(false)
    setBrainstormAnimatingAssistantIndex(null)
    setAiAssistanceError('')
    setAiAssistanceWarning('')
    setIsCreateIdeaDrawerOpen(true)
  }

  const openDeleteIdeaDialog = (idea: Idea) => {
    setDeleteIdeaTarget(idea)
    setDeleteIdeaError('')
    closeContextMenu()
  }

  const closeDeleteIdeaDialog = () => {
    if (isDeletingIdea) return
    setDeleteIdeaTarget(null)
    setDeleteIdeaError('')
  }

  const submitDeleteIdea = async () => {
    if (!deleteIdeaTarget || isDeletingIdea) return

    setIsDeletingIdea(true)
    setDeleteIdeaError('')

    try {
      await deleteIdea(deleteIdeaTarget.id, deleteIdeaTarget.version)
      setIdeas((prev) => {
        const next = prev.filter((idea) => idea.id !== deleteIdeaTarget.id)
        const deletedWasSelected = selectedIdeaId === deleteIdeaTarget.id || selectedIdeaIds.has(deleteIdeaTarget.id)

        if (deletedWasSelected) {
          const fallbackId = next[0]?.id ?? ''
          setSelectedIdeaId(fallbackId)
          setSelectedIdeaIds(fallbackId ? new Set([fallbackId]) : new Set())
        } else {
          setSelectedIdeaIds((prevSelected) => {
            const nextSelected = new Set(prevSelected)
            nextSelected.delete(deleteIdeaTarget.id)
            if (nextSelected.size === 0 && next[0]) {
              nextSelected.add(next[0].id)
              setSelectedIdeaId(next[0].id)
            }
            return nextSelected
          })
        }

        return next
      })
      setDeleteIdeaTarget(null)
    } catch (err) {
      setDeleteIdeaError(err instanceof Error ? err.message : 'Failed to delete idea.')
    } finally {
      setIsDeletingIdea(false)
    }
  }

  const submitCreateIdea = async () => {
    if (!createIdeaForm.title.trim()) {
      setCreateIdeaError('Idea title is required.')
      return
    }

    if (!createIdeaForm.description.trim()) {
      setCreateIdeaError('Description is required.')
      return
    }

    if (!createIdeaForm.workspaceId.trim()) {
      setCreateIdeaError('Workspace is required.')
      return
    }

    const tags = effectiveCreateIdeaTags

    if (createIdeaTagFeedback) {
      setCreateIdeaError(createIdeaTagFeedback)
      return
    }

    try {
      const created = await apiCreateIdea({
        title: createIdeaForm.title.trim(),
        description: createIdeaForm.description.trim() || 'Define business problem, expected value, and target outcomes for governance review.',
        category: createIdeaForm.type,
        tags: tags.length > 0 ? tags : ['New', 'Intake'],
        workspace_id: createIdeaForm.workspaceId,
        owner_id: currentUserId || undefined,
        assignee_id: createIdeaForm.reviewer || undefined,
        folder_id: currentFolderId ?? null,
      })
      const newIdea = {
        ...toIdea(created),
        submittedBy: created.owner_id?.trim() || currentUserId,
      }
      setIdeas((prev) => [newIdea, ...prev])
      selectSingleIdea(newIdea.id)
      void runAgentAnalysisForIdea(newIdea)
    } catch (err) {
      setCreateIdeaError(err instanceof Error ? err.message : 'Failed to create idea.')
      return
    }

    setIsCreateIdeaDrawerOpen(false)
    setCreateIdeaForm({
      title: '',
      description: '',
      workspaceId: '',
      type: 'Innovation',
      reviewer: '',
    })
    setCreateIdeaTags([])
    setCreateIdeaTagDraft('')
    setCreateIdeaTagFeedback('')
    setCreateIdeaDescriptionHtml('')
    setCreateIdeaError('')
  }

  const applyCompletedIdeaDraft = (terminal: IdeaDraftJobStatusResponse) => {
    const draftText = terminal.result?.draft_text?.trim()
    if (!draftText) {
      throw new Error(terminal.error_message || 'AI draft generation failed.')
    }
    setCreateIdeaDescriptionFromPlainText(draftText)
    const overlapMessages: string[] = []
    if (terminal.similar_ideas.length > 0) {
      overlapMessages.push(`${terminal.similar_ideas.length} similar idea(s) found`)
    }
    if (terminal.similar_documents.length > 0) {
      overlapMessages.push(`${terminal.similar_documents.length} related document(s) found`)
    }
    if (terminal.warnings.includes('GENERATED_WITH_EVIDENCE_GAPS')) {
      overlapMessages.push('generated with explicitly labeled evidence gaps')
    }
    setAiAssistanceWarning(
      overlapMessages.length > 0
        ? `${overlapMessages.join(' and ')}. Review the draft before creating this idea.`
        : '',
    )
  }

  const applyIdeaDraftBrainstormState = (status: IdeaDraftJobStatusResponse) => {
    setIdeaDraftJob(status)
    setBrainstormMessages(status.brainstorm_messages ?? [])
    setBrainstormReady(Boolean(status.brainstorm_ready))
    setBrainstormRemainingGaps(status.brainstorm_remaining_gaps ?? status.evidence_summary.gaps ?? [])
    setBrainstormOfferGenerateAnyway(Boolean(status.offer_generate_anyway))
    syncBrainstormEvidenceState(status)
  }

  const waitForIdeaDraftJob = async (jobId: string): Promise<IdeaDraftJobStatusResponse> => {
    for (let attempt = 0; attempt < 240; attempt += 1) {
      const status = await getIdeaDraftJob(jobId)
      setIdeaDraftJob(status)
      if (status.status === 'awaiting_input') {
        const hasOpening = (status.brainstorm_messages ?? []).some((message) => message.role === 'assistant')
        if (!hasOpening && attempt < 239) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 400))
          continue
        }
        applyIdeaDraftBrainstormState(status)
        setIsEvidenceDialogOpen(true)
        return status
      }
      if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
        return status
      }
      await new Promise<void>((resolve) => window.setTimeout(resolve, 1250))
    }
    throw new Error('Generate Draft is still running. Please try again shortly.')
  }

  const handleAiAssistance = async (mode: IdeaAiAssistanceMode) => {
    if (!createIdeaForm.title.trim()) {
      setAiAssistanceError('Please enter an idea title first.')
      return
    }
    if (
      (mode === 'improve_writing' || mode === 'suggest_structure')
      && !createIdeaForm.description.trim()
    ) {
      setAiAssistanceError('Please add a description first.')
      return
    }

    setAiAssistanceLoading(mode)
    setAiAssistanceError('')
    setAiAssistanceWarning('')
    if (mode === 'generate_draft') {
      setIdeaDraftJob(null)
      setBrainstormMessages([])
      setBrainstormInput('')
      setBrainstormError('')
      setBrainstormReady(false)
      setBrainstormRemainingGaps([])
      setBrainstormChecklist([])
      setBrainstormEvidenceProgress(null)
      setBrainstormConfidencePercent(0)
      setBrainstormOfferGenerateAnyway(false)
      setBrainstormEvidenceRailCollapsed(false)
      setBrainstormAnimatingAssistantIndex(null)
      setIsBrainstormMode(false)
      setIsEvidenceDialogOpen(false)
    }

    try {
      if (mode === 'generate_draft') {
        const started = await startIdeaDraftJob({
          title: createIdeaForm.title.trim(),
          tags: effectiveCreateIdeaTags,
          context: {
            workspace_id: createIdeaForm.workspaceId || DEFAULT_DRAFT_WORKSPACE_ID,
            user_id: currentUserId || null,
            user_name: currentUserDisplayName || null,
            session_id: null,
          },
        })

        const terminal = await waitForIdeaDraftJob(started.job_id)
        if (terminal.status === 'awaiting_input') return
        if (terminal.status === 'cancelled') {
          throw new Error('Generate Draft was cancelled.')
        }
        if (terminal.status === 'failed') {
          throw new Error(terminal.error_message || 'AI draft generation failed.')
        }
        applyCompletedIdeaDraft(terminal)
      } else {
        const result = await generateIdeaDescriptionWithAI(
          mode,
          createIdeaForm.title.trim(),
          createIdeaForm.description && createIdeaForm.description.trim() ? createIdeaForm.description : undefined
        )
        setCreateIdeaDescriptionFromPlainText(result.result)
      }

      setAiAssistanceResult(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'AI assistance failed. Please try again.'
      setAiAssistanceError(errorMessage)
    } finally {
      setAiAssistanceLoading(null)
    }
  }

  const handleSendBrainstormMessage = async (messageOverride?: string) => {
    if (!ideaDraftJob || ideaDraftJob.status !== 'awaiting_input') return
    const message = (messageOverride ?? brainstormInput).trim()
    if (!message || isBrainstormSending || brainstormReady) return
    const historyBeforeSend = brainstormMessages
    setIsBrainstormSending(true)
    setBrainstormError('')
    if (!messageOverride) setBrainstormInput('')
    setBrainstormOfferGenerateAnyway(false)
    const requestSentAt = new Date().toISOString()
    setBrainstormMessages((current) => [...current, { role: 'user', text: message, sentAt: requestSentAt }])
    try {
      const sendWithJob = async (jobId: string) => brainstormIdeaDraftJob(jobId, message)
      let response
      try {
        response = await sendWithJob(ideaDraftJob.job_id)
      } catch (firstError) {
        const rawFirst = firstError instanceof Error ? firstError.message : String(firstError)
        if (!isIdeaDraftJobLostError(rawFirst)) throw firstError
        const restored = await restoreIdeaDraftBrainstormSession({
          title: createIdeaForm.title.trim() || 'Untitled idea',
          tags: effectiveCreateIdeaTags,
          context: {
            workspace_id: createIdeaForm.workspaceId || DEFAULT_DRAFT_WORKSPACE_ID,
            user_id: currentUserId || null,
            user_name: currentUserDisplayName || null,
            session_id: ideaDraftJob.correlation_id || null,
          },
          messages: historyBeforeSend,
          remaining_gaps: brainstormRemainingGaps,
          ready_to_continue: brainstormReady,
        })
        setIdeaDraftJob(restored)
        setBrainstormMessages(restored.brainstorm_messages ?? historyBeforeSend)
        setBrainstormReady(Boolean(restored.brainstorm_ready))
        setBrainstormRemainingGaps(
          restored.brainstorm_remaining_gaps ?? restored.evidence_summary.gaps ?? brainstormRemainingGaps,
        )
        setBrainstormOfferGenerateAnyway(Boolean(restored.offer_generate_anyway))
        syncBrainstormEvidenceState(restored)
        response = await sendWithJob(restored.job_id)
      }
      const responseReceivedAt = new Date().toISOString()
      const mergedMessages = mergeBrainstormUiMessages(
        historyBeforeSend,
        response.messages,
        responseReceivedAt,
      )
      setBrainstormMessages(mergedMessages)
      const lastAssistantIndex = mergedMessages.findLastIndex((item) => item.role === 'assistant')
      setBrainstormAnimatingAssistantIndex(lastAssistantIndex >= 0 ? lastAssistantIndex : null)
      setBrainstormReady(response.ready_to_continue)
      setBrainstormRemainingGaps(response.remaining_gaps)
      setBrainstormOfferGenerateAnyway(Boolean(response.offer_generate_anyway) && !response.ready_to_continue)
      setBrainstormChecklist(response.intake_checklist ?? response.evidence_progress?.items ?? [])
      setBrainstormEvidenceProgress(response.evidence_progress ?? null)
      setBrainstormDiscoveryProgress(response.discovery_progress ?? null)
      setBrainstormConfidencePercent(
        resolveBrainstormConfidencePercent(
          response.confidence_percent,
          response.evidence_progress ?? null,
          response.ready_to_continue,
        ),
      )
      setIdeaDraftJob((current) => current
        ? {
            ...current,
            brainstorm_messages: response.messages,
            brainstorm_ready: response.ready_to_continue,
            brainstorm_remaining_gaps: response.remaining_gaps,
            intake_checklist: response.intake_checklist ?? current.intake_checklist,
            evidence_progress: response.evidence_progress ?? current.evidence_progress,
            confidence_percent: response.confidence_percent ?? current.confidence_percent,
            offer_generate_anyway: Boolean(response.offer_generate_anyway) && !response.ready_to_continue,
          }
        : current)
    } catch (error) {
      if (!messageOverride) setBrainstormInput(message)
      const rawMessage = error instanceof Error ? error.message : 'Brainstorming failed. Please try again.'
      setBrainstormError(friendlyBrainstormError(rawMessage))
      setBrainstormMessages((current) => current.filter(
        (_item, index) => index !== current.length - 1,
      ))
    } finally {
      setIsBrainstormSending(false)
    }
  }

  const handleContinueIdeaDraft = async (action: 'generate_anyway' | 'use_brainstorm') => {
    if (!ideaDraftJob || ideaDraftJob.status !== 'awaiting_input' || isDraftContinuing) return
    if (action === 'use_brainstorm' && !brainstormReady) {
      setBrainstormError('Keep answering Tectona Assistant questions until evidence is marked sufficient.')
      return
    }
    setIsDraftContinuing(true)
    setBrainstormError('')
    setAiAssistanceError('')
    setAiAssistanceLoading('generate_draft')
    try {
      const resumeWithJob = async (jobId: string) => continueIdeaDraftJob(jobId, action)
      let resumed
      try {
        resumed = await resumeWithJob(ideaDraftJob.job_id)
      } catch (firstError) {
        const rawFirst = firstError instanceof Error ? firstError.message : String(firstError)
        if (!isIdeaDraftJobLostError(rawFirst)) throw firstError
        const restored = await restoreIdeaDraftBrainstormSession({
          title: createIdeaForm.title.trim() || 'Untitled idea',
          tags: effectiveCreateIdeaTags,
          context: {
            workspace_id: createIdeaForm.workspaceId || DEFAULT_DRAFT_WORKSPACE_ID,
            user_id: currentUserId || null,
            user_name: currentUserDisplayName || null,
            session_id: ideaDraftJob.correlation_id || null,
          },
          messages: brainstormMessages,
          remaining_gaps: brainstormRemainingGaps,
          ready_to_continue: brainstormReady,
        })
        setIdeaDraftJob(restored)
        resumed = await resumeWithJob(restored.job_id)
      }
      setIdeaDraftJob(resumed)
      setIsEvidenceDialogOpen(false)
      const terminal = await waitForIdeaDraftJob(resumed.job_id)
      if (terminal.status === 'completed') {
        applyCompletedIdeaDraft(terminal)
        setIsBrainstormMode(false)
        return
      }
      if (terminal.status === 'cancelled') {
        throw new Error('Generate Draft was cancelled.')
      }
      if (terminal.status === 'failed') {
        throw new Error(terminal.error_message || 'AI draft generation failed.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to continue Generate Draft.'
      const friendly = friendlyBrainstormError(message)
      setBrainstormError(friendly)
      setAiAssistanceError(friendly)
      setIsEvidenceDialogOpen(true)
    } finally {
      setIsDraftContinuing(false)
      setAiAssistanceLoading(null)
    }
  }

  useEffect(() => {
    if (!isBrainstormMode) return
    scrollBrainstormToBottom()
  }, [
    isBrainstormMode,
    brainstormMessages,
    isBrainstormSending,
    brainstormReady,
    brainstormAnimatingAssistantIndex,
    scrollBrainstormToBottom,
  ])

  // Unlock Generate draft when chat already has approved process diagram evidence,
  // even if the last API payload left ready_to_continue=false.
  useEffect(() => {
    if (!isBrainstormMode || brainstormReady || isBrainstormSending) return
    if (!inferBrainstormReadyFromMessages(brainstormMessages)) return
    setBrainstormReady(true)
    setBrainstormRemainingGaps([])
    setBrainstormOfferGenerateAnyway(false)
    setBrainstormConfidencePercent((current) => Math.max(current, 85))
    setIdeaDraftJob((current) =>
      current
        ? {
            ...current,
            brainstorm_ready: true,
            brainstorm_remaining_gaps: [],
            offer_generate_anyway: false,
          }
        : current,
    )
  }, [isBrainstormMode, brainstormMessages, brainstormReady, isBrainstormSending])

  const syncBrainstormComposerHeight = () => {
    const el = brainstormComposerRef.current
    if (!el) return
    // Collapse first so scrollHeight reflects content, not a stale tall box.
    el.style.height = '0px'
    el.style.overflowY = 'hidden'
    const contentHeight = el.scrollHeight
    const next = Math.min(Math.max(contentHeight, 24), 200)
    el.style.height = `${next}px`
    el.style.overflowY = contentHeight > 200 ? 'auto' : 'hidden'
  }

  useLayoutEffect(() => {
    if (!isBrainstormMode || brainstormReady) return
    syncBrainstormComposerHeight()
  }, [isBrainstormMode, brainstormReady, brainstormInput])

  const handleCancelIdeaDraft = async () => {
    if (!ideaDraftJob || !['queued', 'running', 'awaiting_input'].includes(ideaDraftJob.status)) return
    try {
      const status = await cancelIdeaDraftJob(ideaDraftJob.job_id)
      setIdeaDraftJob({ ...status, status: 'cancelled' })
      setIsEvidenceDialogOpen(false)
      setIsBrainstormMode(false)
      setAiAssistanceError('Generate Draft was cancelled.')
      setAiAssistanceLoading(null)
    } catch (err) {
      setAiAssistanceError(err instanceof Error ? err.message : 'Failed to cancel Generate Draft.')
    }
  }

  // Keep the panel's resumable "AI sessions" pointer in sync with the job's
  // server-side status — independent of isEvidenceDialogOpen, so closing the
  // modal (a UI-only state) never drops the pointer while the job is still
  // awaiting brainstorm input.
  useEffect(() => {
    if (!ideaDraftJob) return
    if (ideaDraftJob.status === 'awaiting_input') {
      useIdeaDraftBrainstormPointerStore.getState().setPointer({
        jobId: ideaDraftJob.job_id,
        title: createIdeaForm.title.trim() || 'Untitled idea',
        updatedAt: Date.now(),
      })
      return
    }
    useIdeaDraftBrainstormPointerStore.getState().clearPointer(ideaDraftJob.job_id)
  }, [ideaDraftJob, createIdeaForm.title])

  // Resume entry point: the chat panel navigates here with
  // navigate('/idea-backlog', { state: { resumeBrainstormJobId } }). Uses router
  // state (not a query param) deliberately: WorkspaceSlugLayout keys its <Outlet>
  // on pathname+search+hash, so touching searchParams here would force a full
  // remount of this page and wipe the very state this effect sets below.
  useEffect(() => {
    const jobId = (location.state as { resumeBrainstormJobId?: string } | null)?.resumeBrainstormJobId
    if (!jobId) return

    void (async () => {
      try {
        const status = await getIdeaDraftJob(jobId)
        setIsCreateIdeaDrawerOpen(true)
        const pointerTitle = useIdeaDraftBrainstormPointerStore.getState().pointer?.title
        if (pointerTitle) {
          setCreateIdeaForm((prev) => (prev.title.trim() ? prev : { ...prev, title: pointerTitle }))
        }
        if (status.status === 'awaiting_input') {
          applyIdeaDraftBrainstormState(status)
          setIsEvidenceDialogOpen(true)
          setIsBrainstormMode(true)
        } else {
          setIdeaDraftJob(status)
        }
      } catch {
        useIdeaDraftBrainstormPointerStore.getState().clearPointer(jobId)
      }
    })()
  }, [location.state])

  const handleApplyAiResult = () => {
    if (aiAssistanceResult?.result) {
      const cleanedResult = aiAssistanceResult.result.trim()
      setCreateIdeaDescriptionFromPlainText(cleanedResult)
      setAiAssistanceResult(null)
      setAiAssistanceLoading(null)
    }
  }

  const statCards = [
    {
      label: 'Total Ideas',
      value: metrics.totalIdeas,
      note: 'Volume pipeline inisiatif multi finance',
      icon: BarChart3,
      tone: 'from-slate-600/10 to-slate-500/0 border-slate-300/70',
      accent: 'bg-slate-600',
    },
    {
      label: 'New Submissions',
      value: metrics.newSubmissions,
      note: 'Fresh intake this cycle',
      icon: Plus,
      tone: 'from-amber-500/12 to-amber-400/0 border-amber-200/80',
      accent: 'bg-amber-600',
    },
    {
      label: 'Under Review',
      value: metrics.underReview,
      note: 'Governance decision queue',
      icon: ClipboardList,
      tone: 'from-slate-500/12 to-slate-400/0 border-slate-300/80',
      accent: 'bg-slate-600',
    },
    {
      label: 'Approved',
      value: metrics.approved,
      note: 'Ready for delivery planning',
      icon: CheckCircle,
      tone: 'from-emerald-500/12 to-emerald-400/0 border-emerald-200/80',
      accent: 'bg-emerald-600',
    },
    {
      label: 'Rejected',
      value: metrics.rejected,
      note: 'Need rework or closure',
      icon: X,
      tone: 'from-rose-500/12 to-rose-400/0 border-rose-200/80',
      accent: 'bg-rose-600',
    },
    {
      label: 'Converted',
      value: metrics.converted,
      note: 'Moved into execution track',
      icon: MoveRight,
      tone: 'from-violet-500/12 to-violet-400/0 border-violet-200/80',
      accent: 'bg-violet-600',
    },
  ]

  const intakeConversionRate = Math.round((metrics.converted / Math.max(metrics.totalIdeas, 1)) * 100)
  const approvalRate = Math.round(
    ((metrics.approved + metrics.converted) / Math.max(metrics.totalIdeas, 1)) * 100
  )

  const scoringDimensions = selectedIdea
    ? IDEA_SCORING_DIMENSIONS.map((dimension) => ({
        ...dimension,
        value: readIdeaScoringValue(selectedIdea, dimension.key),
      }))
    : []

  const chartRows = selectedIdea
    ? scoringDimensions.map((dimension) => ({
        label: dimension.label,
        score: dimension.value,
        fill: dimension.color,
      }))
    : []

  const isUnknownIdentityToken = (value: string | null | undefined): boolean => {
    const normalized = (value ?? '').trim().toLowerCase()
    return !normalized || normalized === 'unknown' || normalized === 'n/a' || normalized === 'null' || normalized === 'undefined'
  }

  const resolveIdentityDisplayName = (subjectOrName: string): string => {
    const raw = subjectOrName.trim()
    if (isUnknownIdentityToken(raw)) return '—'
    const resolved = (identityUserNameById[raw] ?? raw).trim()
    return isUnknownIdentityToken(resolved) ? '—' : resolved
  }

  const resolveSubmittedByDisplayName = (subjectOrName: string): string => {
    const raw = subjectOrName.trim()
    if (isUnknownIdentityToken(raw) || raw === LEGACY_DUMMY_OWNER_ID) return '—'
    const resolved = (identityUserNameById[raw] ?? raw).trim()
    return isUnknownIdentityToken(resolved) ? '—' : resolved
  }

  const isMultiSelectCardMenu =
    !!ideaCardContextMenu && selectedIdeaIds.size > 1 && selectedIdeaIds.has(ideaCardContextMenu.idea.id)
  const isContextIdeaAnalysisLocked =
    !!ideaCardContextMenu && isIdeaAnalysisLocked(ideaCardContextMenu.idea.id)
  const isContextIdeaAnalysisFailed =
    !!ideaCardContextMenu && isIdeaAnalysisFailed(ideaCardContextMenu.idea.id)

  if (isLoading) {
    return (
      <PlatformDataLoadingState
        title="Loading Idea & Backlog data"
        description="Retrieving ideas from the idea-backlog service."
      />
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="text-sm font-medium text-rose-700">Unable to load Idea &amp; Backlog</p>
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    )
  }

  return (
    <div
      className="space-y-6"
      onContextMenu={openContextMenu}
      onMouseDown={(event) => {
        if (event.button !== 0) return
        const target = event.target as HTMLElement
        if (
          !target.closest('[data-context-menu-root]')
          && !target.closest('[data-context-menu-submenu]')
        ) {
          closeContextMenu()
        }
        if (target.closest('[data-idea-card="true"]')) return
        setSelectedIdeaId('')
        setSelectedIdeaIds(new Set())
      }}
    >
      <Breadcrumb
        items={[
          {
            label: 'Idea & Backlog',
            href: currentFolderId
              ? workspaceScopedPath(tenant?.slug ?? null, '/idea-backlog', tenant?.workspaceId)
              : undefined,
          },
          ...folderAncestors.map((folder, index) => ({
            label: folder.name,
            href:
              index < folderAncestors.length - 1
                ? `${workspaceScopedPath(tenant?.slug ?? null, '/idea-backlog', tenant?.workspaceId)}?folder=${folder.id}`
                : undefined,
          })),
        ]}
      />

      <style hidden>{`
        @keyframes ideaBarReveal {
          from {
            transform: scaleX(0);
            opacity: 0.35;
          }
          to {
            transform: scaleX(1);
            opacity: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .idea-progress-bar {
            animation: none !important;
          }
        }
      `}</style>

      <PageHeader
        title="Idea & Backlog"
        description="Strategic intake and prioritization hub connecting business demand to executable projects, epics, and tasks."
        right={
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-1.5 shadow-sm flex-nowrap shrink-0">
            <button
              type="button"
              onClick={() => setShowScoringPanels((v) => !v)}
              className={cn(
                'flex items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-all duration-200 hover:bg-background hover:text-foreground hover:shadow-sm',
                showScoringPanels && 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
              )}
              aria-label={showScoringPanels ? 'Hide scoring panels' : 'Show scoring panels'}
              title={showScoringPanels ? 'Hide scoring panels' : 'Show scoring panels'}
            >
              <BarChart3 className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setShowIntakePanel((v) => !v)}
              className={cn(
                'flex items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-all duration-200 hover:bg-background hover:text-foreground hover:shadow-sm',
                showIntakePanel && 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
              )}
              aria-label={showIntakePanel ? 'Hide intake panel' : 'Show intake panel'}
              title={showIntakePanel ? 'Hide intake panel' : 'Show intake panel'}
            >
              <ClipboardList className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setIsListView((v) => !v)}
              className={cn(
                'flex items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-all duration-200 hover:bg-background hover:text-foreground hover:shadow-sm',
                isListView && 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
              )}
              aria-label={isListView ? 'Show as grid' : 'Show as list'}
              title={isListView ? 'Show as grid' : 'Show as list'}
            >
              <List className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setShowFiltersPanel((v) => !v)}
              className={cn(
                'flex items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-all duration-200 hover:bg-background hover:text-foreground hover:shadow-sm',
                showFiltersPanel && 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
              )}
              aria-label={showFiltersPanel ? 'Hide search and filter panel' : 'Show search and filter panel'}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>
        }
      />

      {showScoringPanels && selectedIdea && (
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <Card className={cn('xl:col-span-8', ideaBacklogLiquidGlassPanelClass)}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900 flex items-center gap-2">
              <span className={ideaBacklogLiquidGlassPanelIconClass}>
                <ClipboardList className="h-3 w-3 text-slate-600" />
              </span>
              Idea Evaluation & Scoring
            </CardTitle>
            <CardDescription>
              Evaluate business impact and execution viability to prioritize what moves into delivery.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={ideaBacklogLiquidGlassPanelInsetClass}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] font-semibold text-slate-600 bg-white/30 backdrop-blur-sm border-white/50">
                      {selectedIdea.id}
                    </Badge>
                    <Badge variant="outline" className={cn('text-[10px] font-semibold', statusClass[selectedIdea.status])}>
                      {selectedIdea.status}
                    </Badge>
                    <Badge variant="outline" className={cn('text-[10px] font-semibold', scoreTier.tone)}>
                      {scoreTier.label}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{selectedIdea.title}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <UserRound className="h-3.5 w-3.5" />
                      Evaluator: {resolveIdentityDisplayName(selectedIdea.reviewer)}
                    </span>
                  </div>
                </div>

                <div className={cn(ideaBacklogLiquidGlassPanelStatClass, 'min-w-[160px] px-4 py-2')}>
                  <p className="text-[11px] font-medium text-slate-500">Weighted score</p>
                  <p className="text-2xl font-bold text-slate-900 leading-none mt-1">{totalScore}</p>
                  <p className="text-[11px] text-slate-500 mt-1">Rank #{ranking} of {ideas.length}</p>
                </div>
              </div>
            </div>

            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {scoringDimensions.map((dimension, index) => (
                  <div key={dimension.key} className="flex min-w-0 flex-col gap-2">
                    <div
                      className={cn(
                        ideaBacklogLiquidGlassPanelStatClass,
                        'border-l-[3px] px-3 py-2',
                        dimension.surfaceClass,
                      )}
                      style={{ borderLeftColor: dimension.color }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: dimension.color }}
                          aria-hidden
                        />
                        <p
                          className="text-[10px] font-semibold uppercase tracking-wide"
                          style={{ color: dimension.color }}
                        >
                          {dimension.weightLabel}
                        </p>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">
                        {dimension.weightPercent}%
                      </p>
                    </div>

                    <div
                      className={cn(
                        ideaBacklogLiquidGlassPanelStatClass,
                        'flex flex-1 flex-col px-3 py-2.5',
                        dimension.surfaceClass,
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                          <span
                            className="inline-block h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: dimension.color }}
                            aria-hidden
                          />
                          {dimension.label}
                        </span>
                        <span className="font-semibold tabular-nums" style={{ color: dimension.color }}>
                          {dimension.value}/10
                        </span>
                      </div>
                      <div className={cn('h-2 overflow-hidden rounded-full', dimension.trackClass)}>
                        <div
                          className="idea-progress-bar h-full rounded-full"
                          style={{
                            width: `${(dimension.value / 10) * 100}%`,
                            backgroundColor: dimension.color,
                            transformOrigin: 'left',
                            animation: `ideaBarReveal 780ms cubic-bezier(0.22,1,0.36,1) ${index * 70}ms both`,
                          }}
                        />
                      </div>
                      <p className="mt-2 text-[10px] font-medium text-slate-500">{dimension.roleLabel}</p>
                    </div>
                  </div>
                ))}

            </div>

            <div className={cn(ideaBacklogLiquidGlassPanelStatClass, 'px-2 pt-3 pb-2 h-[150px]')}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 10]} ticks={[0, 3, 6, 10]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                    {chartRows.map((row) => (
                      <Cell key={row.label} fill={row.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3 pt-1">
              <p className="text-[11px] text-slate-500">Decision SLA: target within 2 business days from intake review.</p>
              <div className="flex w-full flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => decideIdea('Approved')}
                  className={cn(
                    enterpriseCyanGradientActionButtonClass(),
                    'flex min-w-0 w-full basis-0 flex-1 justify-center',
                  )}
                >
                  <Check className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" strokeWidth={2.5} />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => decideIdea('Rejected')}
                  className={cn(
                    enterpriseRoseGradientActionButtonClass(),
                    'flex min-w-0 w-full basis-0 flex-1 justify-center',
                  )}
                >
                  <X className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" strokeWidth={2.5} />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => decideIdea('Under Review')}
                  className={cn(
                    enterpriseSecondaryButtonClass(),
                    'group flex min-w-0 w-full basis-0 flex-1 items-center justify-center gap-2 rounded-2xl whitespace-nowrap text-[13.5px]',
                  )}
                >
                  <Undo2 className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-rotate-12" strokeWidth={2.5} />
                  Request Revision
                </button>
              </div>
            </div>
          </CardContent>
          </Card>

          <Card className={cn('xl:col-span-4', ideaBacklogLiquidGlassPanelClass)}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-slate-900">
              <span className={ideaBacklogLiquidGlassPanelIconClass}>
                <ClipboardList className="h-3 w-3 text-slate-600" />
              </span>
              Scoring Queue
            </CardTitle>
            <CardDescription>Choose an idea to evaluate and score inline.</CardDescription>
          </CardHeader>
          <CardContent
            className="space-y-3 max-h-[520px] overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
          >
            <div className={cn(ideaBacklogLiquidGlassPanelInsetClass, 'px-3 py-2')}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Queue size</span>
                <span className="font-semibold text-slate-900">{ideas.length} ideas</span>
              </div>
            </div>

            {ideas.map((idea) => {
              const queueAccent = idea.cardAccentColor ?? DEFAULT_IDEA_CARD_ACCENT_COLOR
              const ownerDisplayName = resolveSubmittedByDisplayName(idea.submittedBy)

              return (
              <button
                key={idea.id}
                onClick={() => selectSingleIdea(idea.id)}
                className={cn(
                  ideaBacklogLiquidGlassQueueItemClass,
                  selectedIdeaId === idea.id && ideaBacklogLiquidGlassQueueItemSelectedClass,
                )}
                style={{
                  ['--idea-card-accent' as string]: queueAccent,
                  borderRight: `4px solid ${queueAccent}`,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 text-xs font-semibold text-slate-900 leading-5">{idea.title}</p>
                  <Badge className={cn('shrink-0 border text-[10px] font-semibold', typeClass[idea.type])}>{idea.type}</Badge>
                </div>

                <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[10px] text-slate-500">
                  <UserRound className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="shrink-0">Owner</span>
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-blue-200/80 bg-blue-50/80 text-[8px] font-semibold text-blue-700">
                    {toInitials(ownerDisplayName)}
                  </span>
                  <span className="min-w-0 truncate font-medium text-slate-700">{ownerDisplayName}</span>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <Badge variant="outline" className={cn('text-[10px] font-semibold', statusClass[idea.status])}>
                    {idea.status}
                  </Badge>
                  {selectedIdeaId === idea.id && (
                    <span className="text-[10px] font-semibold text-slate-700">Selected</span>
                  )}
                </div>
              </button>
              )
            })}
          </CardContent>
          </Card>
        </section>
      )}

      {showIntakePanel && (
        <section>
          <Card className={ideaBacklogLiquidGlassPanelClass}>
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] flex items-center gap-2 text-slate-900">
              <span className={cn(ideaBacklogLiquidGlassPanelIconClass, 'h-6 w-6')}>
                <ClipboardList className="h-3.5 w-3.5 text-slate-600" />
              </span>
              Idea Intake Overview
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Enterprise demand intelligence view for intake, governance review, and execution conversion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className={ideaBacklogLiquidGlassPanelInsetClass}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] font-semibold text-slate-600 bg-white/30 backdrop-blur-sm border-white/50">
                      Intake Governance
                    </Badge>
                    <Badge variant="outline" className="text-[10px] font-semibold border-slate-200/80 bg-white/30 text-slate-700 backdrop-blur-sm">
                      Weekly refresh
                    </Badge>
                    <Badge variant="outline" className="text-[10px] font-semibold border-emerald-200 bg-emerald-50 text-emerald-700">
                      Conversion {intakeConversionRate}%
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">Demand funnel health and governance throughput</p>
                  <p className="text-xs text-slate-500">Monitor intake quality, review velocity, and execution readiness in one executive strip.</p>
                </div>

                <div className={cn(ideaBacklogLiquidGlassPanelStatClass, 'min-w-[178px] px-4 py-2')}>
                  <p className="text-[11px] font-medium text-slate-500">Approval readiness</p>
                  <p className="text-2xl font-bold text-slate-900 leading-none mt-1">{approvalRate}%</p>
                  <p className="text-[11px] text-slate-500 mt-1">Approved + Converted / Total</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {statCards.map((card, index) => (
                (() => {
                  const Icon = card.icon
                  const share = card.label === 'Total Ideas'
                    ? 100
                    : Math.round((card.value / Math.max(metrics.totalIdeas, 1)) * 100)

                  return (
                <div
                  key={card.label}
                  className={cn(ideaBacklogLiquidGlassMetricCardClass, card.tone)}
                >
                  <span className={cn('absolute left-0 top-0 h-1.5 w-full opacity-90', card.accent)} />
                  <div className="absolute -right-8 -top-10 h-24 w-24 rounded-full bg-white/35 blur-xl" />

                  <div className="relative flex items-start justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{card.label}</p>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/50 bg-white/30 backdrop-blur-sm shadow-sm">
                      <Icon className="h-4 w-4 text-slate-600" />
                    </span>
                  </div>

                  <p className="relative mt-2 text-[34px] leading-none font-semibold text-slate-900 tabular-nums">{card.value}</p>
                  <p className="relative mt-1 text-[11px] text-slate-500">{card.note}</p>

                  <div className="relative mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
                      <span>Share of total</span>
                      <span className="text-slate-700">{share}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
                      <div
                        className={cn('idea-progress-bar h-full rounded-full transition-all duration-500', card.accent)}
                        style={{
                          width: `${share}%`,
                          transformOrigin: 'left',
                          animation: `ideaBarReveal 860ms cubic-bezier(0.22,1,0.36,1) ${100 + index * 85}ms both`,
                        }}
                      />
                    </div>
                  </div>
                </div>
                  )
                })()
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-700">Idea Funnel: Submitted to Executed</p>
                  <p className="mt-1 text-[11px] text-slate-500">Conversion analytics view showing flow efficiency, not just stage counts.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className={cn(ideaBacklogLiquidGlassPanelStatClass, 'px-3 py-2.5 shadow-sm')}>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">End-to-end throughput</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{funnelThroughput}%</p>
                  </div>
                  <div className={cn(ideaBacklogLiquidGlassPanelStatClass, 'px-3 py-2.5 shadow-sm')}>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Largest drop-off</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{funnelLargestDrop?.stage ?? 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className={cn(ideaBacklogLiquidGlassPanelInsetClass, 'p-3.5')}>
                <div className="overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                  <div className="min-w-[1040px]">
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-4 xl:gap-4">
                      {funnelSummary.map((item, index) => {
                        const barWidth = Math.max((item.value / funnelMax) * 100, 20)

                        return (
                          <div key={item.stage} className="relative">
                            <div className={cn(ideaBacklogLiquidGlassMetricCardClass, 'rounded-[24px] px-4 py-4')}>
                              <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: item.fill }} />
                              <div className="absolute -right-8 -top-10 h-24 w-24 rounded-full bg-white/25 blur-2xl" />
                              <div className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-slate-300/90 to-transparent" />

                              <div className="relative flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{item.stage}</p>
                                  <p className="mt-2 text-[34px] leading-none font-semibold text-slate-900 tabular-nums">{item.value}</p>
                                </div>
                                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                                  {item.shareOfTotal}% of intake
                                </span>
                              </div>

                              <p className="relative mt-2 min-h-[36px] text-[11px] leading-5 text-slate-500">{item.description}</p>

                              <div className={cn(ideaBacklogLiquidGlassPanelStatClass, 'mt-3 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]')}>
                                <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
                                  <span>Stage weight</span>
                                  <span className="text-slate-700">{item.shareOfTotal}%</span>
                                </div>
                                <div className="mt-2 h-2 rounded-full bg-white shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]">
                                  <div
                                    className="idea-progress-bar h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${barWidth}%`,
                                      backgroundColor: item.fill,
                                      transformOrigin: 'left',
                                      animation: `ideaBarReveal 900ms cubic-bezier(0.22,1,0.36,1) ${220 + index * 100}ms both`,
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="relative mt-3 grid grid-cols-2 gap-2">
                                <div className={cn(ideaBacklogLiquidGlassPanelStatClass, 'px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]')}>
                                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Retention</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">{item.conversion}%</p>
                                </div>
                                <div className={cn(ideaBacklogLiquidGlassPanelStatClass, 'px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]')}>
                                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Drop-off</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">{item.dropOff} ideas</p>
                                </div>
                              </div>
                            </div>

                            {index < funnelSummary.length - 1 && (
                              <>
                                <div className="hidden xl:block absolute -right-4 top-1/2 z-[1] h-px w-8 -translate-y-1/2 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200" />
                                <div className="hidden xl:flex absolute -right-6 top-1/2 z-10 h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/90 bg-white/96 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_10px_20px_-14px_rgba(15,23,42,0.18)] backdrop-blur-sm">
                                  <MoveRight className="h-4 w-4 text-slate-400" />
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          </Card>
        </section>
      )}

      {showFiltersPanel && (
          <div className={ideaBacklogLiquidGlassFilterPanelClass}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setIsSearchFieldMenu(true)
                  setContextMenu(null)
                  setIdeaCardContextMenu(null)
                  setContextMenu(
                    resolveFixedContextMenuPosition(
                      event.clientX,
                      event.clientY,
                      228,
                      BACKGROUND_CONTEXT_MENU_ESTIMATED_HEIGHT,
                    ),
                  )
                }}
                placeholder="Search ideas and folders..."
                className={ideaBacklogLiquidGlassFilterInputClass}
              />
            </div>

            <div className="relative pt-3">
              <div aria-hidden className={ideaBacklogLiquidGlassFilterPanelDividerClass} />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <button
                  type="button"
                  onClick={() => void handleCreateFolderWithDefaultName()}
                  className={enterpriseIndigoGradientActionButtonClass()}
                >
                  <FolderPlus className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" strokeWidth={2.5} />
                  New folder
                </button>
                <button type="button" onClick={openCreateIdeaDrawer} className={enterpriseCyanGradientActionButtonClass()}>
                  <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.5} />
                  Create Idea
                </button>
                <button
                  type="button"
                  onClick={() => setIsUploadIdeaPanelOpen(true)}
                  className={enterpriseEmeraldGradientActionButtonClass()}
                >
                  <Upload className="h-4 w-4" strokeWidth={2.5} />
                  Upload Idea
                </button>
                <div className="hidden min-w-[1rem] flex-1 lg:block" aria-hidden />
                <div className="flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-2 lg:ml-auto lg:w-auto lg:justify-end">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="shrink-0 text-xs text-muted-foreground">
                      Content <span className="tabular-nums">({contentTotalForLabel})</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {ALL_CONTENT_FILTER_TAGS.map((tag) => {
                        const on = contentFilterTags.has(tag)
                        const count = contentCounts[tag]
                        const label = tag === 'folders' ? 'Folders' : 'Ideas'
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              setContentFilterTags((prev) => {
                                const next = new Set(prev)
                                if (next.has(tag)) {
                                  next.delete(tag)
                                  if (next.size === 0) return new Set(ALL_CONTENT_FILTER_TAGS)
                                } else {
                                  next.add(tag)
                                }
                                return next
                              })
                            }}
                            className={enterpriseFilterTagClass(on, tag === 'folders' ? 'violet' : 'cyan')}
                            aria-pressed={on}
                            title={on ? `Hide ${label}` : `Show ${label}`}
                          >
                            <span>{label}</span>
                            <span className={cn('tabular-nums text-[10px]', on ? 'opacity-80' : 'opacity-60')}>{count}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="shrink-0 text-xs text-muted-foreground">
                      Type <span className="tabular-nums">({typeTotalForLabel})</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {IDEA_TYPES.map((type) => {
                        const on = typeFilterTags.has(type)
                        const count = typeCounts[type]
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              setTypeFilterTags((prev) => {
                                const next = new Set(prev)
                                if (next.has(type)) {
                                  next.delete(type)
                                  if (next.size === 0) return new Set(IDEA_TYPES)
                                } else {
                                  next.add(type)
                                }
                                return next
                              })
                            }}
                            className={enterpriseFilterTagClass(on, ideaTypeFilterVariant(type))}
                            aria-pressed={on}
                            title={on ? `Hide ${type}` : `Show ${type}`}
                          >
                            <span>{type}</span>
                            <span className={cn('tabular-nums text-[10px]', on ? 'opacity-80' : 'opacity-60')}>{count}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="shrink-0 text-xs text-muted-foreground">
                      Status <span className="tabular-nums">({statusTotalForLabel})</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {IDEA_STATUSES.map((status) => {
                        const on = statusFilterTags.has(status)
                        const count = statusCounts[status]
                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={() => {
                              setStatusFilterTags((prev) => {
                                const next = new Set(prev)
                                if (next.has(status)) {
                                  next.delete(status)
                                  if (next.size === 0) {
                                    return new Set([
                                      'New Submission',
                                      'Under Review',
                                      'Approved',
                                      'Rejected',
                                      'Converted to Project',
                                    ])
                                  }
                                } else {
                                  next.add(status)
                                }
                                return next
                              })
                            }}
                            className={enterpriseFilterTagClass(on, ideaStatusFilterVariant(status))}
                            aria-pressed={on}
                            title={on ? `Hide ${status}` : `Show ${status}`}
                          >
                            <span>{status}</span>
                            <span className={cn('tabular-nums text-[10px]', on ? 'opacity-80' : 'opacity-60')}>{count}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {foldersError && (
          <p className="text-sm text-rose-600">{foldersError}</p>
        )}

        {currentFolder && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
            <FolderIcon className="h-4 w-4 text-indigo-600" />
            <span className="text-sm font-medium text-foreground">{currentFolder.name}</span>
            <Button type="button" variant="outline" size="sm" onClick={handleBackToFolderRoot}>
              Back to all ideas
            </Button>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={folderDropCollisionDetection}
          onDragStart={handleIdeaDragStart}
          onDragEnd={(event) => void handleIdeaDragEnd(event)}
          onDragOver={handleIdeaDragOver}
          onDragCancel={handleIdeaDragCancel}
        >
        <div className="space-y-8">
        {showFoldersSection && (
          <IdeaBacklogFoldersSection
            folders={foldersWithVisibleCounts}
            sortOrder={folderSortOrder}
            onSortOrderChange={setFolderSortOrder}
            onOpenFolder={handleOpenFolder}
            onRenameFolder={handleRenameIdeaFolder}
            onDeleteFolder={(folder) => void handleDeleteIdeaFolder(folder)}
            orderedFolderIds={orderedFolderIds}
            isIdeaDragActive={isIdeaDragActive}
            dropTargetFolderId={dropTargetFolderId}
          />
        )}

        {showIdeasSection && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Idea Submission Stream ({orderedSortedFilteredIdeas.length})
              </h2>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 shrink-0">
                  <ArrowUpDown className="w-4 h-4" />
                  {submissionSortOrder === 'name-asc' ? 'A → Z' : 'Z → A'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSubmissionSortOrder('name-asc')}>
                  A → Z
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSubmissionSortOrder('name-desc')}>
                  Z → A
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <SortableContext items={orderedSortedFilteredIdeas.map((idea) => `idea-${idea.id}`)} strategy={rectSortingStrategy}>
              <div className={cn('grid gap-4', isListView ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4')}>
                {orderedSortedFilteredIdeas.map((idea) => (
                  <SortableIdeaCard
                    key={idea.id}
                    idea={idea}
                    submittedByDisplayName={resolveSubmittedByDisplayName(idea.submittedBy)}
                    reviewerDisplayName={resolveIdentityDisplayName(idea.reviewer)}
                    analysisProgress={ideaAnalysisProgressById[idea.id]?.progress ?? 0}
                    analysisStatus={ideaAnalysisProgressById[idea.id]?.status ?? null}
                    analysisErrorMessage={ideaAnalysisProgressById[idea.id]?.errorMessage ?? null}
                    analysisStepLabel={ideaAnalysisProgressById[idea.id]?.currentStepLabel ?? null}
                    isAnalysisRunning={isIdeaAnalysisLocked(idea.id)}
                    isSelected={selectedIdeaIds.has(idea.id)}
                    isDragActive={isDragActive}
                    draggedIdeaIds={draggedIdeaIds}
                    onSelect={(event) => handleIdeaCardSelect(event, idea.id)}
                    onOpenDetail={openIdeaDetail}
                    onOpenContextMenu={(event, currentIdea) => {
                      event.preventDefault()
                      event.stopPropagation()
                      setContextMenu(null)

                      setIdeaCardContextMenu({
                        ...resolveFixedContextMenuPosition(
                          event.clientX,
                          event.clientY,
                          220,
                          IDEA_CARD_CONTEXT_MENU_ESTIMATED_HEIGHT,
                        ),
                        idea: currentIdea,
                      })
                    }}
                  />
                ))}
              </div>
            </SortableContext>
        </div>
        )}
        </div>

        <ProjectDragLayer
          activeId={activeDragId}
          project={null}
          projectCount={draggedIdeaIds.size}
          overFolderName={dropTargetFolderName}
          pointer={dragPointer}
        />
        </DndContext>

      <ContextMenu
        open={!!contextMenu}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        onClose={closeContextMenu}
        zIndex={1190}
      >
        {isSearchFieldMenu && (
          <>
            <ContextMenuItem
              onClick={() => {
                setQuery('')
                closeContextMenu()
              }}
            >
              <X className="w-4 h-4 mr-2" />
              Clear field
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}

        <ContextMenuItem
          onClick={() => {
            setShowScoringPanels((v) => !v)
            closeContextMenu()
          }}
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          {showScoringPanels ? 'Hide scoring panel' : 'Show scoring panel'}
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            setShowIntakePanel((v) => !v)
            closeContextMenu()
          }}
        >
          <ClipboardList className="w-4 h-4 mr-2" />
          {showIntakePanel ? 'Hide intake panel' : 'Show intake panel'}
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            setShowFiltersPanel((v) => !v)
            closeContextMenu()
          }}
        >
          <Filter className="w-4 h-4 mr-2" />
          {showFiltersPanel ? 'Hide search & filters panel' : 'Show search & filters panel'}
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem
          onClick={() => {
            closeContextMenu()
            openCreateIdeaDrawer()
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create idea
        </ContextMenuItem>
      </ContextMenu>

      <ContextMenu
        open={!!ideaCardContextMenu}
        x={ideaCardContextMenu?.x ?? 0}
        y={ideaCardContextMenu?.y ?? 0}
        onClose={closeContextMenu}
        zIndex={1190}
      >
        {!isMultiSelectCardMenu && (
          <>
            <ContextMenuItem
              onClick={() => {
                closeContextMenu()
                openCreateIdeaDrawer()
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create idea
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}

        {!isMultiSelectCardMenu && (
          <ContextMenuItem
            className={cn(isContextIdeaAnalysisLocked && 'opacity-50 pointer-events-none')}
            onClick={() => {
              if (isContextIdeaAnalysisLocked || !ideaCardContextMenu) return
              openIdeaDetail(ideaCardContextMenu.idea)
              closeContextMenu()
            }}
          >
            <Eye className="w-4 h-4 mr-2" />
            {isContextIdeaAnalysisLocked ? 'Analysis in progress' : 'View detail'}
          </ContextMenuItem>
        )}

        {!isMultiSelectCardMenu && isContextIdeaAnalysisFailed && ideaCardContextMenu && (
          <ContextMenuItem
            onClick={() => {
              void runAgentAnalysisForIdea(ideaCardContextMenu.idea)
              closeContextMenu()
            }}
          >
            <Undo2 className="w-4 h-4 mr-2" />
            Retry analysis
          </ContextMenuItem>
        )}

        <ContextMenuItem
          onClick={() => {
            if (!ideaCardContextMenu) return
            if (isMultiSelectCardMenu) {
              setSelectedIdeaId(ideaCardContextMenu.idea.id)
              setShowScoringPanels(true)
            } else {
              selectSingleIdea(ideaCardContextMenu.idea.id)
            }
            closeContextMenu()
          }}
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          Evaluate
        </ContextMenuItem>

        <ContextMenuItem
          onClick={() => {
            if (!ideaCardContextMenu) return
            if (isMultiSelectCardMenu) {
              setIdeas((prev) =>
                prev.map((idea) =>
                  selectedIdeaIds.has(idea.id) ? { ...idea, status: 'Rejected' } : idea
                )
              )
            } else {
              updateIdeaStatus(ideaCardContextMenu.idea.id, 'Rejected')
            }
            closeContextMenu()
          }}
        >
          <X className="w-4 h-4 mr-2" />
          Reject
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuSubmenu
          trigger={
            <>
              <Filter className="w-4 h-4 mr-2" />
              Filter by type
              <ChevronRight className="w-4 h-4 ml-auto" />
            </>
          }
        >
          <ContextMenuItem
            className="justify-between"
            onClick={() => applyTypeFilterFromContextMenu('All')}
          >
            <span>All types</span>
            {typeFilterTags.size === IDEA_TYPES.length && <Check className="h-4 w-4 text-emerald-600" />}
          </ContextMenuItem>
          <ContextMenuSeparator />
          {IDEA_TYPES.map((type) => (
            <ContextMenuItem
              key={type}
              className="justify-between"
              onClick={() => applyTypeFilterFromContextMenu(type)}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-block h-2 w-2 rounded-full',
                    type === 'Innovation'
                      ? 'bg-sky-500'
                      : type === 'Improvement'
                        ? 'bg-emerald-500'
                        : type === 'Request'
                          ? 'bg-violet-500'
                          : 'bg-amber-500',
                  )}
                />
                {type}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{typeCounts[type]}</span>
                {typeFilterTags.has(type) && <Check className="h-4 w-4 text-emerald-600" />}
              </span>
            </ContextMenuItem>
          ))}
        </ContextMenuSubmenu>

        <ContextMenuSubmenu
          trigger={
            <>
              <Filter className="w-4 h-4 mr-2" />
              Filter by status
              <ChevronRight className="w-4 h-4 ml-auto" />
            </>
          }
        >
          <ContextMenuItem
            className="justify-between"
            onClick={() => applyStatusFilterFromContextMenu('All')}
          >
            <span>All status</span>
            {statusFilterTags.size === IDEA_STATUSES.length && <Check className="h-4 w-4 text-emerald-600" />}
          </ContextMenuItem>
          <ContextMenuSeparator />
          {IDEA_STATUSES.map((status) => (
            <ContextMenuItem
              key={status}
              className="justify-between"
              onClick={() => applyStatusFilterFromContextMenu(status)}
            >
              <span>{status}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{statusCounts[status]}</span>
                {statusFilterTags.has(status) && <Check className="h-4 w-4 text-emerald-600" />}
              </span>
            </ContextMenuItem>
          ))}
        </ContextMenuSubmenu>

        {!isMultiSelectCardMenu && <ContextMenuSeparator />}

        {!isMultiSelectCardMenu && (
          <ContextMenuItem
            onClick={() => {
              setShowScoringPanels((v) => !v)
              closeContextMenu()
            }}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            {showScoringPanels ? 'Hide scoring panel' : 'Show scoring panel'}
          </ContextMenuItem>
        )}

        {!isMultiSelectCardMenu && (
          <ContextMenuItem
            onClick={() => {
              setShowIntakePanel((v) => !v)
              closeContextMenu()
            }}
          >
            <ClipboardList className="w-4 h-4 mr-2" />
            {showIntakePanel ? 'Hide intake panel' : 'Show intake panel'}
          </ContextMenuItem>
        )}

        {!isMultiSelectCardMenu && (
          <ContextMenuItem
            onClick={() => {
              setShowFiltersPanel((v) => !v)
              closeContextMenu()
            }}
          >
            <Filter className="w-4 h-4 mr-2" />
            {showFiltersPanel ? 'Hide search & filters panel' : 'Show search & filters panel'}
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuSubmenu
          trigger={
            <>
              <Palette className="w-4 h-4 mr-2" />
              {isSavingIdeaColor ? 'Saving color…' : 'Change color'}
              <ChevronRight className="w-4 h-4 ml-auto" />
            </>
          }
          className={cn(isSavingIdeaColor && 'opacity-60 pointer-events-none')}
        >
          <div className="w-[13rem] p-3">
            <p className="mb-2 px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {isMultiSelectCardMenu ? 'Apply to selected ideas' : 'Card accent'}
            </p>
            <div className="grid grid-cols-6 gap-3">
              {IDEA_CARD_ACCENT_COLORS.map((color) => {
                const targetIds = isMultiSelectCardMenu
                  ? Array.from(selectedIdeaIds)
                  : ideaCardContextMenu
                    ? [ideaCardContextMenu.idea.id]
                    : []
                const targetIdeas = ideas.filter((idea) => targetIds.includes(idea.id))
                const isActive = targetIdeas.length > 0
                  && targetIdeas.every(
                    (idea) => (idea.cardAccentColor ?? DEFAULT_IDEA_CARD_ACCENT_COLOR) === color,
                  )

                return (
                  <button
                    key={color}
                    type="button"
                    disabled={isSavingIdeaColor}
                    aria-label={`Set card color ${color}`}
                    className={cn(
                      'h-7 w-7 rounded-full border-2 transition shrink-0',
                      isActive
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-background border-white'
                        : 'border-border hover:scale-110',
                      isSavingIdeaColor && 'cursor-not-allowed opacity-60 hover:scale-100',
                    )}
                    style={{ backgroundColor: color }}
                    onClick={(event) => {
                      event.stopPropagation()
                      void applyIdeaCardAccentColor(color, targetIds)
                      closeContextMenu()
                    }}
                  />
                )
              })}
            </div>
          </div>
        </ContextMenuSubmenu>

        {!isMultiSelectCardMenu && <ContextMenuSeparator />}

        <ContextMenuItem
          className="text-destructive"
          onClick={() => {
            if (!ideaCardContextMenu) return
            openDeleteIdeaDialog(ideaCardContextMenu.idea)
          }}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete idea
        </ContextMenuItem>
      </ContextMenu>

      <IdeaUploadReviewPanel
        isOpen={isUploadIdeaPanelOpen}
        onClose={() => setIsUploadIdeaPanelOpen(false)}
        workspaceId={createIdeaForm.workspaceId || resolveWorkspaceApiId(tenant?.workspaceId) || ''}
        currentUserId={currentUserId}
        onIdeasCreated={(created) => {
          const newIdeas = created.map((api) => ({
            ...toIdea(api),
            submittedBy: api.owner_id?.trim() || currentUserId,
          }))
          setIdeas((prev) => [...newIdeas, ...prev])
          if (newIdeas[0]) selectSingleIdea(newIdeas[0].id)
          newIdeas.forEach((idea) => void runAgentAnalysisForIdea(idea))
        }}
      />

      {typeof document !== 'undefined' &&
        createPortal(
          <>
            <div
              className={cn(
                'fixed inset-0 bg-black/20 backdrop-blur-sm z-[1050] transition-opacity',
                isCreateIdeaDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              )}
              onClick={() => setIsCreateIdeaDrawerOpen(false)}
              aria-hidden="true"
              role="button"
              tabIndex={-1}
            />

            <div
              className={cn(
                'fixed top-0 right-0 flex h-screen w-[460px] max-w-[92vw] flex-col transform z-[1100] transition-all duration-300',
                'backdrop-blur-xl bg-background/95 border-l border-border shadow-2xl',
                isCreateIdeaDrawerOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
              )}
              style={{
                boxShadow: '0 0 60px rgba(0, 0, 0, 0.3), inset 1px 0 0 rgba(255, 255, 255, 0.1)',
                margin: 0,
                padding: 0,
              }}
            >
              <div className="flex shrink-0 items-center justify-between px-5 py-4 border-b border-border backdrop-blur-sm">
                <div className="pr-3">
                  <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" />
                    Create Idea
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Capture demand details and create a new idea for strategic intake evaluation.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsCreateIdeaDrawerOpen(false)}
                  aria-label="Close create idea"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void submitCreateIdea()
                }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto scrollbar-hide px-5 py-5">
                  <p className="text-xs text-muted-foreground">
                    <RequiredFieldMark /> Required fields. Fields without an asterisk are optional.
                  </p>

                  <div className="space-y-1.5">
                    <Label htmlFor="idea-title" className="text-xs text-muted-foreground">
                      Idea Title <RequiredFieldMark />
                    </Label>
                    <Input
                      id="idea-title"
                      value={createIdeaForm.title}
                      onChange={(e) => setCreateIdeaForm((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter idea title"
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="idea-description" className="text-xs text-muted-foreground">
                        Description <RequiredFieldMark />
                      </Label>

                      {/* AI Assist Section - KB Reference Style */}
                      <div className="space-y-3 rounded-lg border border-border/60 bg-background/40 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Wand2 className="h-4 w-4 text-blue-600" aria-hidden />
                            <span className="text-xs font-semibold text-foreground">AI Assist</span>
                          </div>
                          <span className="text-xs text-muted-foreground">Quick actions</span>
                        </div>

                        {/* AI Buttons Grid 2x2 */}
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={aiAssistanceLoading !== null || !createIdeaForm.title.trim()}
                            className="h-9 justify-start gap-2 rounded-lg border-border/70 bg-background/70 text-xs font-medium text-foreground hover:bg-background hover:text-foreground"
                            onClick={() => handleAiAssistance('generate_draft')}
                          >
                            {aiAssistanceLoading === 'generate_draft' ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                            ) : (
                              <Wand2 className="h-3.5 w-3.5 shrink-0" />
                            )}
                            Generate Draft
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            disabled={
                              aiAssistanceLoading !== null
                              || !createIdeaForm.title.trim()
                              || !createIdeaForm.description.trim()
                            }
                            className="h-9 justify-start gap-2 rounded-lg border-border/70 bg-background/70 text-xs font-medium text-foreground hover:bg-background hover:text-foreground"
                            onClick={() => handleAiAssistance('improve_writing')}
                          >
                            {aiAssistanceLoading === 'improve_writing' ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                            ) : (
                              <Wand2 className="h-3.5 w-3.5 shrink-0" />
                            )}
                            Improve Writing
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            disabled={
                              aiAssistanceLoading !== null
                              || !createIdeaForm.title.trim()
                              || !createIdeaForm.description.trim()
                            }
                            className="h-9 justify-start gap-2 rounded-lg border-border/70 bg-background/70 text-xs font-medium text-foreground hover:bg-background hover:text-foreground"
                            onClick={() => handleAiAssistance('suggest_structure')}
                          >
                            {aiAssistanceLoading === 'suggest_structure' ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                            ) : (
                              <Wand2 className="h-3.5 w-3.5 shrink-0" />
                            )}
                            Make Structured
                          </Button>

                          <div className="h-9 rounded-lg border border-border/70 bg-background/70 flex items-center justify-center text-xs text-muted-foreground/50 cursor-not-allowed">
                            More coming soon
                          </div>
                        </div>

                        {ideaDraftJob && ideaDraftJob.status !== 'completed' && (
                          <div className="space-y-3 rounded-lg border border-blue-200/80 bg-blue-50/60 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-900">
                                  {ideaDraftJob.status === 'failed'
                                    ? 'Draft generation failed'
                                    : ideaDraftJob.status === 'cancelled'
                                      ? 'Draft generation cancelled'
                                      : ideaDraftJob.status === 'awaiting_input'
                                        ? 'More AS-IS context is recommended'
                                        : 'Tectona Agent is executing the plan'}
                                </p>
                                <p className="mt-0.5 text-[11px] text-slate-600">
                                  {ideaDraftJob.evidence_summary.kb_entries} KB entries
                                  {' · '}
                                  {ideaDraftJob.similar_ideas.length} similar ideas
                                  {' · '}
                                  {ideaDraftJob.similar_documents.length} related documents
                                </p>
                              </div>
                              <span className="shrink-0 text-xs font-semibold text-blue-700">
                                {ideaDraftJob.progress_percent}%
                              </span>
                            </div>

                            <div
                              role="progressbar"
                              aria-label="Idea draft generation progress"
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={ideaDraftJob.progress_percent}
                              className="h-2 overflow-hidden rounded-full bg-blue-100"
                            >
                              <div
                                className={cn(
                                  'h-full rounded-full transition-[width] duration-500',
                                  ideaDraftJob.status === 'failed'
                                    ? 'bg-rose-500'
                                    : ideaDraftJob.status === 'cancelled'
                                      ? 'bg-slate-400'
                                      : 'bg-gradient-to-r from-blue-500 to-violet-500',
                                )}
                                style={{ width: `${ideaDraftJob.progress_percent}%` }}
                              />
                            </div>

                            <div className="space-y-1.5">
                              {ideaDraftJob.plan.map((step) => (
                                <div key={step.id} className="flex items-start gap-2 text-[11px]">
                                  {step.status === 'completed' ? (
                                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                  ) : step.status === 'running' ? (
                                    <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-blue-600" />
                                  ) : step.status === 'failed' ? (
                                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
                                  ) : (
                                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border border-slate-300 bg-white" />
                                  )}
                                  <div className="min-w-0">
                                    <p
                                      className={cn(
                                        'font-medium',
                                        step.status === 'pending' || step.status === 'skipped'
                                          ? 'text-slate-400'
                                          : 'text-slate-700',
                                      )}
                                    >
                                      {step.label}
                                    </p>
                                    {step.detail && step.status !== 'pending' && (
                                      <p className="mt-0.5 leading-4 text-slate-500">{step.detail}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {(ideaDraftJob.similar_ideas.length > 0 || ideaDraftJob.similar_documents.length > 0) && (
                              <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
                                <p className="font-semibold">Potential overlap detected</p>
                                {[...ideaDraftJob.similar_ideas, ...ideaDraftJob.similar_documents].map((item) => (
                                  <p key={`${item.kind}-${item.id}-${item.title}`} className="mt-1 truncate">
                                    {item.kind === 'brd' ? 'BRD' : item.kind === 'document' ? 'Document' : 'Idea'} · {item.title}
                                    {' · '}
                                    {Math.round(item.similarity_score * 100)}%
                                  </p>
                                ))}
                              </div>
                            )}

                            {ideaDraftJob.status === 'awaiting_input' && (
                              <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
                                <p className="font-semibold">Evidence gaps detected</p>
                                <p className="mt-1 leading-4">
                                  {ideaDraftJob.evidence_summary.rationale || 'The KB does not provide enough feature-relevant AS-IS context.'}
                                </p>
                                {ideaDraftJob.evidence_summary.gaps.length > 0 && (
                                  <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                                    {ideaDraftJob.evidence_summary.gaps.map((gap) => <li key={gap}>{gap}</li>)}
                                  </ul>
                                )}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="mt-2 h-7 px-2.5 text-[11px]"
                                  onClick={() => setIsEvidenceDialogOpen(true)}
                                >
                                  Review options
                                </Button>
                              </div>
                            )}

                            {['queued', 'running', 'awaiting_input'].includes(ideaDraftJob.status) && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2.5 text-[11px]"
                                onClick={handleCancelIdeaDraft}
                              >
                                Cancel generation
                              </Button>
                            )}
                          </div>
                        )}

                        {aiAssistanceError && (
                          <p className="text-xs text-destructive font-medium bg-destructive/10 rounded px-3 py-2 border border-destructive/30">
                            {aiAssistanceError}
                          </p>
                        )}

                        {aiAssistanceWarning && (
                          <p className="text-xs text-amber-800 font-medium bg-amber-100/70 rounded px-3 py-2 border border-amber-300/60">
                            {aiAssistanceWarning}
                          </p>
                        )}
                      </div>
                    </div>

                    <div id="idea-description" className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/70 bg-muted/20 p-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => applyCreateIdeaDescriptionCommand('undo')}
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => applyCreateIdeaDescriptionCommand('redo')}
                        >
                          <Redo2 className="h-3.5 w-3.5" />
                        </Button>
                        <div className="h-6 w-px bg-border/70" />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => applyCreateIdeaDescriptionCommand('bold')}
                        >
                          <Bold className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => applyCreateIdeaDescriptionCommand('italic')}
                        >
                          <Italic className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => applyCreateIdeaDescriptionCommand('underline')}
                        >
                          <Underline className="h-3.5 w-3.5" />
                        </Button>
                        <div className="h-6 w-px bg-border/70" />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => applyCreateIdeaDescriptionBlock('h2')}
                        >
                          H2
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => applyCreateIdeaDescriptionBlock('h3')}
                        >
                          H3
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => applyCreateIdeaDescriptionBlock('p')}
                        >
                          P
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => applyCreateIdeaDescriptionCommand('insertUnorderedList')}
                        >
                          <List className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => applyCreateIdeaDescriptionCommand('insertOrderedList')}
                        >
                          <ListOrdered className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="relative min-h-[320px] rounded-md border border-input bg-background px-3 py-2">
                        {createIdeaDescriptionTextLength === 0 ? (
                          <p className="pointer-events-none select-none whitespace-pre-line text-sm leading-7 text-muted-foreground/70">
                            {IDEA_DESCRIPTION_TEMPLATE}
                          </p>
                        ) : null}
                        <div
                          ref={createIdeaDescriptionEditorRef}
                          contentEditable
                          suppressContentEditableWarning
                          className={cn(
                            'outline-none whitespace-pre-wrap break-words px-3 py-2 text-sm leading-7 text-foreground [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:leading-tight [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:leading-tight [&_p]:mb-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border/60 [&_pre]:bg-slate-950 [&_pre]:p-3 [&_pre]:text-xs [&_pre]:text-slate-100',
                            createIdeaDescriptionTextLength === 0 ? 'absolute inset-0 px-3 py-2 opacity-0' : ''
                          )}
                          onInput={(event) => {
                            syncCreateIdeaDescriptionFromHtml(event.currentTarget.innerHTML)
                          }}
                          onBlur={(event) => {
                            const sanitized = syncCreateIdeaDescriptionFromHtml(event.currentTarget.innerHTML)
                            if (event.currentTarget.innerHTML !== sanitized) {
                              event.currentTarget.innerHTML = sanitized
                            }
                          }}
                          onPaste={(event) => {
                            event.preventDefault()
                            const text = event.clipboardData.getData('text/plain')
                            if (text) {
                              document.execCommand('insertText', false, text)
                            }
                            const editor = createIdeaDescriptionEditorRef.current
                            if (editor) syncCreateIdeaDescriptionFromHtml(editor.innerHTML)
                          }}
                        />
                      </div>

                      {createIdeaProcessDiagrams.length > 0 ? (
                        <div className="space-y-3 rounded-xl border border-sky-200/70 bg-sky-50/40 p-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">Process diagram from brainstorming</p>
                            <p className="text-xs text-slate-500">
                              The agreed AS-IS / TO-BE diagram is also saved in the draft so it can be analyzed in the Process section.
                            </p>
                          </div>
                          {createIdeaProcessDiagrams.map((diagram) => (
                            <div key={`${diagram.label}-${diagram.source.slice(0, 40)}`} className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                                {diagram.label}
                              </p>
                              <AssistantMermaidBlock source={diagram.source} />
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-gradient-to-br from-muted/30 via-background to-muted/10 p-4 shadow-sm sm:p-5">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Routing and Ownership</p>
                        <p className="text-xs text-muted-foreground">Set workspace scope, idea type, and reviewer assignment.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                      <div className="space-y-1.5 sm:col-span-2 lg:col-span-6">
                        <Label htmlFor="idea-workspace" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" />
                          Workspace <RequiredFieldMark />
                        </Label>
                        <select
                          id="idea-workspace"
                          value={createIdeaForm.workspaceId}
                          onChange={(e) => setCreateIdeaForm((prev) => ({ ...prev, workspaceId: e.target.value, reviewer: '' }))}
                          disabled={isCreateIdeaWorkspaceLoading || createIdeaWorkspaceOptions.length === 0}
                          className="h-11 w-full rounded-lg border border-input/80 bg-background px-3 text-sm shadow-sm transition focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="">
                            {isCreateIdeaWorkspaceLoading
                              ? 'Loading workspaces...'
                              : createIdeaWorkspaceError
                                ? 'Failed to load workspaces'
                                : 'Select workspace'}
                          </option>
                          {createIdeaWorkspaceOptions.map((option) => (
                            <option key={option.id} value={option.id}>{option.name}</option>
                          ))}
                        </select>
                        {createIdeaWorkspaceError ? (
                          <p className="text-[11px] text-rose-600">{createIdeaWorkspaceError}</p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground/90">Reviewer list will follow this selected workspace.</p>
                        )}
                      </div>

                      <div className="space-y-1.5 sm:col-span-1 lg:col-span-2">
                        <Label htmlFor="idea-type" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Sparkles className="h-3.5 w-3.5" />
                          Type
                        </Label>
                        <select
                          id="idea-type"
                          value={createIdeaForm.type}
                          onChange={(e) =>
                            setCreateIdeaForm((prev) => ({ ...prev, type: e.target.value as IdeaType }))
                          }
                          className="h-11 w-full rounded-lg border border-input/80 bg-background px-3 text-sm shadow-sm transition focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="Innovation">Innovation</option>
                          <option value="Improvement">Improvement</option>
                          <option value="Request">Request</option>
                          <option value="Transformation">Transformation</option>
                        </select>
                      </div>

                      <div className="space-y-1.5 sm:col-span-1 lg:col-span-4">
                        <Label htmlFor="idea-reviewer" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          Reviewer <span className="text-[10px] text-muted-foreground/70">(Optional)</span>
                        </Label>
                        <select
                          id="idea-reviewer"
                          value={createIdeaForm.reviewer}
                          onChange={(e) => setCreateIdeaForm((prev) => ({ ...prev, reviewer: e.target.value }))}
                          disabled={isReviewerOptionsLoading || reviewerOptions.length === 0}
                          className="h-11 w-full rounded-lg border border-input/80 bg-background px-3 text-sm shadow-sm transition focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="">
                            {isReviewerOptionsLoading
                              ? 'Loading workspace members...'
                              : reviewerOptionsError
                                ? 'Failed to load members'
                                : 'Select reviewer (optional)'}
                          </option>
                          {reviewerOptions.map((option) => (
                            <option key={option.subjectId} value={option.subjectId}>
                              {option.displayName} ({option.roleLabel})
                            </option>
                          ))}
                        </select>
                        {reviewerOptionsError ? (
                          <p className="text-[11px] text-rose-600">{reviewerOptionsError}</p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground/90">Assign the first reviewer to accelerate triage.</p>
                        )}
                      </div>

                      <div className="space-y-1.5 sm:col-span-2 lg:col-span-6">
                        <Label htmlFor="idea-tags" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Tags className="h-3.5 w-3.5" />
                          Tags
                        </Label>
                        <div
                          className="min-h-[44px] w-full rounded-lg border border-input/80 bg-background px-2 py-1.5 shadow-sm transition focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20"
                          onClick={() => createIdeaTagInputRef.current?.focus()}
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            {createIdeaTags.map((tag) => {
                              const tone = getIdeaTagTone(tag)
                              return (
                                <span
                                  key={tag}
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-200 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95',
                                    tone.chipClassName
                                  )}
                                >
                                  {tag}
                                  <button
                                    type="button"
                                    className={cn('rounded-full p-0.5 transition', tone.removeClassName)}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      removeCreateIdeaTag(tag)
                                    }}
                                    aria-label={`Remove tag ${tag}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              )
                            })}
                            <input
                              id="idea-tags"
                              ref={createIdeaTagInputRef}
                              value={createIdeaTagDraft}
                              onChange={(e) => setCreateIdeaTagDraft(e.target.value)}
                              onKeyDown={handleCreateIdeaTagKeyDown}
                              onBlur={commitCreateIdeaTagDraft}
                              placeholder={createIdeaTags.length === 0 ? 'Type tag then Enter or comma' : 'Add tag'}
                              disabled={isCreateIdeaTagLimitReached && !createIdeaTagDraft.trim()}
                              className="h-8 min-w-[160px] flex-1 border-0 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground/70"
                            />
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {quickCreateIdeaTagSuggestions.map((tag) => {
                            const chip = (
                              <button
                                key={tag}
                                type="button"
                                className={cn(
                                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                                  isCreateIdeaTagLimitReached
                                    ? 'cursor-not-allowed border-border/50 bg-muted/40 text-muted-foreground/50 opacity-60'
                                    : 'border-border/70 bg-background text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground'
                                )}
                                disabled={isCreateIdeaTagLimitReached}
                                aria-disabled={isCreateIdeaTagLimitReached}
                                onClick={() => {
                                  addCreateIdeaTagsFromText(tag)
                                  createIdeaTagInputRef.current?.focus()
                                }}
                              >
                                + {tag}
                              </button>
                            )

                            if (!isCreateIdeaTagLimitReached) return chip

                            return (
                              <Tooltip
                                key={`${tag}-tooltip`}
                                content={`Maximum ${MAX_CREATE_IDEA_TAGS} tags reached.`}
                                side="top"
                                size="compact"
                              >
                                <span className="inline-flex">{chip}</span>
                              </Tooltip>
                            )
                          })}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <p className={cn('text-[11px]', createIdeaTagFeedback ? 'text-amber-700' : 'text-muted-foreground/90')}>
                            {createIdeaTagFeedback || `Use 3-5 tags to improve searchability and backlog routing. Max ${MAX_CREATE_IDEA_TAGS} tags.`}
                          </p>
                          <p className="text-[11px] font-medium text-muted-foreground/80">
                            {createIdeaTags.length}/{MAX_CREATE_IDEA_TAGS}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 border-t border-border bg-background/95 px-5 py-4 backdrop-blur-sm">
                  <div className="flex w-full items-stretch">
                    <button
                      type="submit"
                      disabled={!isCreateIdeaFormValid}
                      className={cn(
                        enterpriseCyanGradientActionButtonClass(),
                        'w-full justify-center disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none disabled:active:scale-100',
                      )}
                    >
                      <Plus className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.5} aria-hidden />
                      Create Idea
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {isEvidenceDialogOpen && ideaDraftJob?.status === 'awaiting_input' && typeof document !== 'undefined'
              ? createPortal(
                  isBrainstormMode ? (
                    <div
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="idea-evidence-dialog-title"
                      className="fixed inset-0 z-[1450] flex flex-col bg-background"
                    >
                      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/70 px-3 sm:px-4">
                        <div className="flex min-w-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => setIsBrainstormMode(false)}
                            aria-label="Back to evidence options"
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </Button>
                          <div className="min-w-0">
                            <h3 id="idea-evidence-dialog-title" className="truncate text-sm font-semibold text-foreground">
                              Tectona Assistant
                            </h3>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {createIdeaForm.title.trim() || 'Brainstorm AS-IS context'}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {brainstormReady || !brainstormOfferGenerateAnyway ? (
                            <button
                              type="button"
                              disabled={isBrainstormSending || isDraftContinuing}
                              className={cn(
                                enterpriseCyanGradientActionButtonClass(),
                                'hidden h-9 px-3 sm:inline-flex',
                                'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none disabled:active:scale-100',
                              )}
                              onClick={() => void handleContinueIdeaDraft(
                                brainstormReady ? 'use_brainstorm' : 'generate_anyway',
                              )}
                            >
                              <Wand2 className="h-4 w-4 shrink-0" aria-hidden />
                              {isDraftContinuing
                                ? 'Generating…'
                                : brainstormReady
                                  ? 'Generate draft'
                                  : 'Generate anyway'}
                            </button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => setIsEvidenceDialogOpen(false)}
                            aria-label="Close chat"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </header>

                      <div className="flex min-h-0 flex-1 overflow-hidden bg-muted/15">
                        <div className="hidden min-h-0 md:flex">
                          <BrainstormEvidenceRail
                            confidencePercent={brainstormConfidencePercent}
                            progress={brainstormEvidenceProgress}
                            discoveryProgress={brainstormDiscoveryProgress}
                            checklist={brainstormChecklist}
                            gaps={brainstormRemainingGaps}
                            initiativeMatches={brainstormInitiativeMatches}
                            ready={brainstormReady}
                            collapsed={brainstormEvidenceRailCollapsed}
                            onToggleCollapsed={() => setBrainstormEvidenceRailCollapsed((current) => !current)}
                          />
                        </div>
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
                          <div className="max-h-[42vh] shrink-0 overflow-hidden border-b border-border/60 md:hidden">
                            <BrainstormEvidenceRail
                              confidencePercent={brainstormConfidencePercent}
                              progress={brainstormEvidenceProgress}
                              discoveryProgress={brainstormDiscoveryProgress}
                              checklist={brainstormChecklist}
                              gaps={brainstormRemainingGaps}
                              initiativeMatches={brainstormInitiativeMatches}
                              ready={brainstormReady}
                              collapsed={brainstormEvidenceRailCollapsed}
                              onToggleCollapsed={() => setBrainstormEvidenceRailCollapsed((current) => !current)}
                            />
                          </div>
                          <div
                            ref={brainstormScrollRef}
                            className="min-h-0 flex-1 overflow-y-auto"
                          >
                            <div
                              className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6"
                            >
                          {brainstormMessages.length === 0 ? (
                            <div
                              className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center"
                              aria-live="polite"
                            >
                              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                {isBrainstormSending ? (
                                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                                ) : (
                                  <Sparkles className="h-6 w-6" aria-hidden />
                                )}
                              </div>
                              <h4 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                                {isBrainstormSending ? 'Tectona Assistant is preparing a response' : 'Brainstorm with Tectona'}
                              </h4>
                              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                                {isBrainstormSending
                                  ? 'Your message was sent. The next question is being prepared.'
                                  : 'Share AS-IS context so we can shape a stronger draft. Ask questions, propose options, and fill gaps together.'}
                              </p>
                            </div>
                          ) : null}

                          {brainstormMessages.map((message, index) => {
                            const previousUser = [...brainstormMessages.slice(0, index)]
                              .reverse()
                              .find((item) => item.role === 'user')
                            const requestTimeLabel = message.role === 'user'
                              ? formatBrainstormTimestamp(message.sentAt)
                              : formatBrainstormTimestamp(previousUser?.sentAt)
                            const responseTimeLabel = message.role === 'assistant'
                              ? formatBrainstormTimestamp(message.respondedAt)
                              : ''
                            const latencyLabel = message.role === 'assistant'
                              ? formatBrainstormLatencyMs(previousUser?.sentAt, message.respondedAt)
                              : ''

                            return (
                            <div
                              key={`${message.role}-${index}-${message.text.slice(0, 24)}`}
                              className={cn(
                                'flex w-full',
                                message.role === 'user' ? 'justify-end' : 'justify-start',
                              )}
                            >
                              {message.role === 'assistant' ? (
                                <div className="flex max-w-full gap-3">
                                  <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <Sparkles className="h-4 w-4" aria-hidden />
                                  </div>
                                  <div className="min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                      <p className="text-xs font-medium text-muted-foreground">Tectona Assistant</p>
                                      {requestTimeLabel ? (
                                        <p className="text-[10px] text-muted-foreground/80">
                                          Permintaan {requestTimeLabel}
                                        </p>
                                      ) : null}
                                      {responseTimeLabel ? (
                                        <p className="text-[10px] text-muted-foreground/80">
                                          · Respons {responseTimeLabel}
                                          {latencyLabel ? ` (${latencyLabel})` : ''}
                                        </p>
                                      ) : null}
                                    </div>
                                    {index === brainstormAnimatingAssistantIndex ? (
                                      <BrainstormAssistantTypingMessage
                                        text={message.text}
                                        animate
                                        onComplete={() => setBrainstormAnimatingAssistantIndex(null)}
                                        onProgress={scrollBrainstormToBottom}
                                      />
                                    ) : (
                                      <BrainstormAssistantMessageBody text={message.text} />
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="max-w-[85%] space-y-1 sm:max-w-[75%]">
                                  {requestTimeLabel ? (
                                    <p className="pr-1 text-right text-[10px] text-muted-foreground/80">
                                      Dikirim {requestTimeLabel}
                                    </p>
                                  ) : null}
                                  <div className="whitespace-pre-wrap rounded-[1.35rem] bg-muted px-4 py-2.5 text-[15px] leading-7 text-foreground">
                                    {message.text}
                                  </div>
                                </div>
                              )}
                            </div>
                            )
                          })}

                          {isBrainstormSending && (
                            <div className="flex gap-3">
                              <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Sparkles className="h-4 w-4" aria-hidden />
                              </div>
                              <div className="inline-flex items-center gap-2 py-1 text-sm text-muted-foreground">
                                <span className="inline-flex gap-1" aria-hidden>
                                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:0ms]" />
                                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:120ms]" />
                                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:240ms]" />
                                </span>
                                Tectona Assistant sedang mengetik…
                              </div>
                            </div>
                          )}

                          {brainstormReady && (
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950">
                              Enough context gathered. You can generate the draft now.
                            </div>
                          )}
                          {!brainstormReady && brainstormOfferGenerateAnyway && (
                            <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
                              <p className="text-xs leading-5 text-muted-foreground">
                                {isBrainstormThreadIndonesian(brainstormMessages)
                                  ? 'Pilih salah satu. Bagian yang belum jelas akan ditandai sebagai asumsi jika kamu generate sekarang.'
                                  : 'Choose one. Anything still unclear will be labeled as an assumption if you generate now.'}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={isBrainstormSending || isDraftContinuing}
                                  className={cn(
                                    enterpriseSecondaryButtonClass(),
                                    'inline-flex h-9 items-center gap-2',
                                    'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm',
                                  )}
                                  onClick={() => void handleSendBrainstormMessage(brainstormContinueDiscoveryMessage(brainstormMessages))}
                                >
                                  {isBrainstormThreadIndonesian(brainstormMessages) ? 'Lanjut ditanya' : 'Continue Discovery'}
                                </button>
                                <button
                                  type="button"
                                  disabled={isBrainstormSending || isDraftContinuing}
                                  className={cn(
                                    enterpriseCyanGradientActionButtonClass(),
                                    'h-9',
                                    'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none disabled:active:scale-100',
                                  )}
                                  onClick={() => void handleContinueIdeaDraft('generate_anyway')}
                                >
                                  <Wand2 className="h-4 w-4 shrink-0" aria-hidden />
                                  {isDraftContinuing
                                    ? (isBrainstormThreadIndonesian(brainstormMessages) ? 'Sedang generate…' : 'Generating…')
                                    : (isBrainstormThreadIndonesian(brainstormMessages) ? 'Generate saja' : 'Generate anyway')}
                                </button>
                              </div>
                            </div>
                          )}
                          {!brainstormReady && !brainstormOfferGenerateAnyway && brainstormRemainingGaps.length > 0 && brainstormMessages.length > 0 && (
                            <p className="text-xs leading-5 text-muted-foreground">
                              Next: {formatBrainstormExploringNext(brainstormRemainingGaps)}
                              {brainstormRemainingGaps.length > 3 ? ' · …' : ''}
                            </p>
                          )}
                            </div>
                          </div>

                      <div className="shrink-0 bg-gradient-to-t from-background via-background to-background/80 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
                        <div className="mx-auto w-full max-w-3xl space-y-2">
                          {brainstormError && <p className="px-3 text-xs text-destructive">{brainstormError}</p>}
                          {!brainstormReady ? (
                            <div className="rounded-[28px] border border-black/[0.08] bg-white px-2.5 pb-2 pt-2.5 shadow-[0_2px_12px_rgba(15,23,42,0.06)] focus-within:shadow-[0_4px_18px_rgba(15,23,42,0.1)] dark:bg-background">
                              <textarea
                                ref={brainstormComposerRef}
                                value={brainstormInput}
                                onChange={(event) => setBrainstormInput(event.target.value)}
                                placeholder={
                                  brainstormOfferGenerateAnyway
                                    ? (isBrainstormThreadIndonesian(brainstormMessages)
                                      ? 'Opsional: koreksi diagram atau tambah catatan'
                                      : 'Optional: correct the diagram or add a note')
                                    : 'Ask Tectona Assistant'
                                }
                                spellCheck={false}
                                rows={1}
                                className="block w-full resize-none border-0 bg-transparent px-2 text-[15px] leading-6 text-foreground outline-none placeholder:text-muted-foreground/75 disabled:cursor-not-allowed disabled:opacity-50"
                                style={{ height: 24, overflowY: 'hidden' }}
                                disabled={isBrainstormSending || isDraftContinuing}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault()
                                    void handleSendBrainstormMessage()
                                  }
                                }}
                              />
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-transparent text-[#5d5d5d] transition-colors hover:bg-black/[0.04] disabled:opacity-40"
                                  aria-label="Add attachment"
                                  title="Coming soon"
                                  disabled
                                >
                                  <Plus className="h-4 w-4" strokeWidth={2} />
                                </button>
                                <div className="flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#5d5d5d] transition-colors hover:bg-black/[0.04] disabled:opacity-40"
                                    aria-label="Voice input"
                                    title="Coming soon"
                                    disabled
                                  >
                                    <Mic className="h-4 w-4" strokeWidth={1.75} />
                                  </button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    className={cn(
                                      'ml-0.5 h-8 w-8 shrink-0 rounded-full transition-colors',
                                      brainstormInput.trim() && !isBrainstormSending && !isDraftContinuing
                                        ? 'bg-[#0d0d0d] text-white hover:bg-black'
                                        : 'bg-[#e5e5e5] text-[#9a9a9a] hover:bg-[#e5e5e5]',
                                    )}
                                    disabled={!brainstormInput.trim() || isBrainstormSending || isDraftContinuing}
                                    onClick={() => void handleSendBrainstormMessage()}
                                    aria-label="Send message"
                                  >
                                    {isBrainstormSending ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={!brainstormReady || isBrainstormSending || isDraftContinuing}
                              className={cn(
                                enterpriseCyanGradientActionButtonClass(),
                                'h-11 w-full justify-center sm:hidden',
                                'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none disabled:active:scale-100',
                              )}
                              onClick={() => void handleContinueIdeaDraft('use_brainstorm')}
                            >
                              <Wand2 className="h-4 w-4 shrink-0" aria-hidden />
                              {isDraftContinuing ? 'Generating…' : 'Generate draft'}
                            </button>
                          )}
                          <p className="px-1 text-center text-[11px] text-muted-foreground">
                            {brainstormOfferGenerateAnyway
                              ? (isBrainstormThreadIndonesian(brainstormMessages)
                                ? 'Pakai tombol di atas untuk pilih. Input hanya jika mau menambah konteks.'
                                : 'Use the buttons above to choose. Type here only to add extra context.')
                              : 'Enter to send · Shift+Enter for new line'}
                          </p>
                        </div>
                      </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="fixed inset-0 z-[1450] flex items-center justify-center p-4">
                      <button
                        type="button"
                        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
                        aria-label="Close evidence options"
                        onClick={() => setIsEvidenceDialogOpen(false)}
                      />
                      <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="idea-evidence-dialog-title"
                        className="relative z-[1451] flex w-full max-w-lg max-h-[82vh] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
                      >
                        <div className="border-b border-border px-5 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 id="idea-evidence-dialog-title" className="text-base font-semibold text-foreground">
                                More context would improve this draft
                              </h3>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                The Knowledge Base has limited feature-relevant AS-IS evidence. Choose how to continue.
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => setIsEvidenceDialogOpen(false)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-4 overflow-y-auto px-5 py-4">
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                            <p className="font-semibold">
                              Evidence quality: {Math.round(ideaDraftJob.evidence_summary.quality_score * 100)}%
                            </p>
                            <p className="mt-1 leading-5">
                              {ideaDraftJob.evidence_summary.rationale || 'Additional AS-IS context is recommended.'}
                            </p>
                            {ideaDraftJob.evidence_summary.gaps.length > 0 && (
                              <ul className="mt-2 list-disc space-y-1 pl-4">
                                {ideaDraftJob.evidence_summary.gaps.map((gap) => <li key={gap}>{gap}</li>)}
                              </ul>
                            )}
                          </div>
                          <div className="space-y-2 text-xs text-muted-foreground">
                            <p><span className="font-semibold text-foreground">Brainstorm:</span> explore options with Tectona Assistant (business & technology), then generate using that context.</p>
                            {ideaDraftJob.warnings.includes('VAGUE_IDEA_TITLE') ? (
                              <p className="font-medium text-amber-700">
                                Clarification is required because the idea title is too general. Draft generation unlocks after brainstorming.
                              </p>
                            ) : (
                              <p><span className="font-semibold text-foreground">Generate anyway:</span> continue now and label unsupported statements as assumptions/open questions.</p>
                            )}
                          </div>
                        </div>
                        <div
                          className={cn(
                            'grid gap-2 border-t border-border/70 bg-muted/20 px-5 py-4',
                            ideaDraftJob.warnings.includes('VAGUE_IDEA_TITLE') ? 'grid-cols-1' : 'grid-cols-2',
                          )}
                        >
                          {!ideaDraftJob.warnings.includes('VAGUE_IDEA_TITLE') && (
                            <button
                              type="button"
                              disabled={isDraftContinuing}
                              className={cn(
                                enterpriseSecondaryButtonClass(),
                                'w-full justify-center',
                                'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm',
                              )}
                              onClick={() => void handleContinueIdeaDraft('generate_anyway')}
                            >
                              <Wand2 className="h-4 w-4 shrink-0" aria-hidden />
                              {isDraftContinuing ? 'Continuing…' : 'Generate anyway'}
                            </button>
                          )}
                          <button
                            type="button"
                            className={cn(enterpriseCyanGradientActionButtonClass(), 'w-full justify-center')}
                            title={
                              ideaDraftJob.warnings.includes('VAGUE_IDEA_TITLE')
                                ? 'Clarify the idea title and context with Tectona Assistant'
                                : 'Explore options with Tectona Assistant, then generate using that context'
                            }
                            aria-label={
                              ideaDraftJob.warnings.includes('VAGUE_IDEA_TITLE')
                                ? 'Clarify with Tectona Assistant'
                                : 'Brainstorm with Tectona Assistant'
                            }
                            onClick={() => {
                              void (async () => {
                                let nextJob = ideaDraftJob
                                try {
                                  nextJob = await getIdeaDraftJob(ideaDraftJob.job_id)
                                } catch {
                                  nextJob = ideaDraftJob
                                }
                                applyIdeaDraftBrainstormState(nextJob)
                                setBrainstormEvidenceRailCollapsed(false)
                                setIsBrainstormMode(true)
                              })()
                            }}
                          >
                            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
                            {ideaDraftJob.warnings.includes('VAGUE_IDEA_TITLE')
                              ? 'Clarify with Tectona'
                              : 'Brainstorm with Tectona'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ),
                  document.body,
                )
              : null}
            {deleteIdeaTarget && typeof document !== 'undefined'
              ? createPortal(
                  <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 sm:p-6">
                    <button
                      type="button"
                      className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
                      aria-label="Close delete confirmation"
                      disabled={isDeletingIdea}
                      onClick={() => {
                        if (!isDeletingIdea) closeDeleteIdeaDialog()
                      }}
                    />

                    <div
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="idea-delete-dialog-title"
                      className="relative z-[1401] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card via-card to-card/95 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.65)]"
                    >
                      <div className="border-b border-border/70 bg-muted/25 px-6 py-5">
                        <div className="flex items-start gap-4">
                          <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/12 text-red-700 ring-1 ring-red-500/25">
                            <Trash2 className="h-5 w-5" aria-hidden />
                          </div>
                          <div className="space-y-1">
                            <h3 id="idea-delete-dialog-title" className="text-base font-semibold tracking-tight text-foreground">
                              Delete Idea
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              This action permanently removes the idea and cannot be undone.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 px-6 py-5">
                        <div className="rounded-xl border border-border bg-background/70 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Idea</p>
                          <p className="mt-1 break-words text-sm font-semibold text-foreground">{deleteIdeaTarget.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          This will permanently delete the selected idea and its related backlog records.
                        </p>
                        {deleteIdeaError && <p className="text-xs text-destructive font-medium">{deleteIdeaError}</p>}
                      </div>

                      <div className="flex items-center justify-end gap-3 border-t border-border/70 bg-muted/20 px-6 py-4">
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
                          disabled={isDeletingIdea}
                          onClick={closeDeleteIdeaDialog}
                        >
                          <X className="h-4 w-4 shrink-0" aria-hidden />
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          className={cn(registerServicePrimaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2 bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500')}
                          disabled={isDeletingIdea}
                          onClick={submitDeleteIdea}
                        >
                          <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                          {isDeletingIdea ? 'Deleting…' : 'Delete idea'}
                        </Button>
                      </div>
                    </div>
                  </div>,
                  document.body
                )
              : null}

          </>,
          document.body
        )}
    </div>
  )
}

function SortableIdeaCard({
  idea,
  submittedByDisplayName,
  reviewerDisplayName,
  analysisProgress,
  analysisStatus,
  analysisErrorMessage,
  analysisStepLabel,
  isAnalysisRunning,
  isSelected,
  isDragActive,
  draggedIdeaIds,
  onSelect,
  onOpenDetail,
  onOpenContextMenu,
}: {
  idea: Idea
  submittedByDisplayName: string
  reviewerDisplayName: string
  analysisProgress: number
  analysisStatus: IdeaAnalysisProgress['status'] | null
  analysisErrorMessage: string | null
  analysisStepLabel: string | null
  isAnalysisRunning: boolean
  isSelected: boolean
  isDragActive: boolean
  draggedIdeaIds: Set<string>
  onSelect: (event: ReactMouseEvent<HTMLDivElement>) => void
  onOpenDetail: (idea: Idea) => void
  onOpenContextMenu: (event: ReactMouseEvent<HTMLDivElement>, idea: Idea) => void
}) {
  const submittedByInitials = toInitials(submittedByDisplayName)
  const reviewerInitials = toInitials(reviewerDisplayName)

  const linkedProjectName = idea.projectName?.trim() || null
  const showLinkedProject = idea.status === 'Converted to Project' && Boolean(linkedProjectName)
  const isRejected = idea.status === 'Rejected'
  const cardAccent = idea.cardAccentColor ?? DEFAULT_IDEA_CARD_ACCENT_COLOR

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `idea-${idea.id}`,
    data: { type: 'idea', idea },
  })

  const style = transform
    ? { transform: CSS.Transform.toString(transform), transition }
    : undefined

  return (
    <div ref={setNodeRef} style={{ ...style, outline: 'none' }} className="h-full outline-none focus:outline-none" {...listeners} {...attributes}>
      <div
        data-idea-card="true"
        onPointerDown={(event) => {
          if (event.button !== 0) return
          onSelect(event)
        }}
        onDoubleClick={(event) => {
          if (event.button !== 0) return
          if (isAnalysisRunning) return
          onOpenDetail(idea)
        }}
        onContextMenu={(event) => onOpenContextMenu(event, idea)}
        className={cn(
          ideaBacklogLiquidGlassCardClass,
          (isDragging || (isDragActive && isSelected && draggedIdeaIds.has(idea.id))) && 'opacity-0 pointer-events-none',
          isAnalysisRunning && 'cursor-progress',
          isSelected &&
            !isDragging &&
            !(isDragActive && draggedIdeaIds.has(idea.id)) &&
            'liquid-glass-idea-card--selected',
        )}
        style={{
          ['--idea-card-accent' as string]: cardAccent,
          outline: isSelected ? '2px solid rgba(59,130,246,0.95)' : undefined,
          outlineOffset: isSelected ? '1px' : undefined,
          borderRight: `4px solid ${cardAccent}`,
        }}
      >
        <div className="flex items-start justify-between gap-2 flex-1 min-h-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-white/50 bg-white/35 backdrop-blur-sm">
                <GripVertical className="h-3 w-3 text-slate-400" />
              </span>
              {isRejected ? (
                <Badge
                  variant="outline"
                  className={cn(
                    'inline-flex items-center gap-1 text-[10px] font-semibold',
                    statusClass.Rejected,
                  )}
                  title="Rejected"
                >
                  <X className="h-3 w-3 shrink-0" aria-hidden />
                  Rejected
                </Badge>
              ) : showLinkedProject && linkedProjectName ? (
                <Badge
                  variant="outline"
                  className={cn(
                    'inline-flex max-w-[11rem] items-center gap-1 text-[10px] font-semibold',
                    statusClass['Converted to Project'],
                  )}
                  title={`Converted to project: ${linkedProjectName}`}
                >
                  <FolderKanban className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">{linkedProjectName}</span>
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className={cn('text-[10px] font-semibold', statusClass[idea.status])}
                  title={idea.status}
                >
                  {IDEA_STATUS_CARD_LABEL[idea.status]}
                </Badge>
              )}
            </div>
            <p className="text-sm font-semibold text-slate-900 leading-5">{idea.title}</p>
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{idea.description}</p>
          </div>
          <Badge className={cn('border text-[11px] shrink-0', typeClass[idea.type])}>{idea.type}</Badge>
        </div>

        {isAnalysisRunning && (
          <div className="mt-2.5 rounded-md border border-blue-200/80 bg-blue-50/70 p-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-700">
                <Loader2 className="h-3 w-3 animate-spin" />
                Agent analyzing idea...
              </p>
              <span className="text-[11px] font-semibold text-blue-700">{analysisProgress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-blue-200/70">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-500"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-blue-700/90">
              {analysisStepLabel?.trim() || 'Detail can be opened after analysis completes.'}
            </p>
          </div>
        )}

        {!isAnalysisRunning && analysisStatus === 'done' && (
          <div className="mt-2 rounded-md border border-emerald-200/80 bg-emerald-50/70 px-2 py-1.5">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
              <CheckCircle className="h-3.5 w-3.5" />
              Analysis complete
            </p>
          </div>
        )}

        {!isAnalysisRunning && analysisStatus === 'failed' && (
          <div className="mt-2 rounded-md border border-rose-200/80 bg-rose-50/70 px-2 py-1.5">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-rose-700">
              <X className="h-3.5 w-3.5" />
              Analysis failed. Use Retry analysis from context menu.
              {analysisErrorMessage ? (
                <Tooltip
                  content={analysisErrorMessage}
                  side="top"
                  size="compact"
                  className="max-w-[260px]"
                >
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full text-rose-700/80 hover:text-rose-800">
                    <CircleHelp className="h-3.5 w-3.5" />
                  </span>
                </Tooltip>
              ) : null}
            </p>
          </div>
        )}

        <div className={ideaBacklogLiquidGlassCardMetaClass}>
          <div className="space-y-1.5 text-xs text-slate-600">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                <UserRound className="h-3.5 w-3.5 shrink-0" />
                <span>Submitted by</span>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-[9px] font-semibold text-blue-700">
                  {submittedByInitials}
                </span>
                <p className="truncate text-right text-slate-700">{submittedByDisplayName}</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                <UserRound className="h-3.5 w-3.5 shrink-0" />
                <span>Reviewed by</span>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-[9px] font-semibold text-emerald-700">
                  {reviewerInitials}
                </span>
                <p className="truncate text-right text-slate-700">{reviewerDisplayName}</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>Created</span>
              </div>
              <p className="shrink-0 text-slate-700">{idea.createdAt}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {isRejected && (
            <span
              className={cn(
                ideaBacklogLiquidGlassCardTagClass,
                'inline-flex items-center gap-1 border-rose-300/70 bg-rose-50/80 font-semibold text-rose-700',
              )}
            >
              <X className="h-3 w-3 shrink-0" aria-hidden />
              Rejected
            </span>
          )}
          {idea.tags.map((tag) => (
            <span key={tag} className={ideaBacklogLiquidGlassCardTagClass}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function toInitials(name: string) {
  const parts = name
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) return 'NA'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}
