import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { getSession } from '@/auth/authService'
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
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
import { cn } from '@/lib/utils'
import { enterpriseSecondaryButtonClass, registerServicePrimaryButtonClass } from '@/lib/enterpriseButtonClasses'
import {
  deleteIdea,
  listIdeas,
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
  type IdeaDraftJobStatusResponse,
} from '@/lib/api/tectonaAgentRuntimeApi'
import { fetchIdentityUsers, type IdentityUserDto } from '@/lib/api/identityAdminApi'
import { fetchAllWorkspaceOrgWorkspaces } from '@/lib/api/workspaceOrgApi'
import {
  fetchWorkspaceMembers,
  TECTONA_WAC_APP_ID,
  wacRoleCodeToUiRole,
} from '@/lib/api/workspaceAccessControlApi'
import { useTectonaPageContextReporter } from '@/lib/chat/useTectonaPageContextReporter'
import { extractProcessDiagramsFromText } from '@/lib/chat/extractProcessDiagrams'
import { normalizeMermaidFences, splitMermaidContent } from '@/lib/chat/normalizeMermaidFences'
import { AssistantChatMarkdown } from '@/modules/core-shell/components/AssistantChatMarkdown'
import { AssistantMermaidBlock } from '@/modules/core-shell/components/AssistantMermaidBlock'

type IdeaStatus = 'New Submission' | 'Under Review' | 'Approved' | 'Rejected' | 'Converted to Project'
type IdeaType = 'Innovation' | 'Improvement' | 'Request'

const IDEA_TYPES: IdeaType[] = ['Innovation', 'Improvement', 'Request']
const IDEA_STATUSES: IdeaStatus[] = ['New Submission', 'Under Review', 'Approved', 'Rejected', 'Converted to Project']
const DEFAULT_DRAFT_WORKSPACE_ID = 'react-tectona'
const MAX_CREATE_IDEA_TAGS = 5
const MAX_CREATE_IDEA_TAG_LENGTH = 24

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
    return 'Sesi brainstorm terputus. Kirim ulang pesan kamu — sesi akan dipulihkan otomatis.'
  }
  if (/^HTTP 500\b/i.test(rawMessage) || rawMessage.includes('Internal Server Error')) {
    return 'Tectona Assistant sedang bermasalah sebentar. Silakan kirim ulang pesan kamu.'
  }
  return rawMessage
}

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
  tags: string[]
  createdAt: string
  reviewer: string
  status: IdeaStatus
  scoring: {
    businessValue: number
    effort: number
    risk: number
    roi: number
  }
  version: number
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

function fromApiIdea(api: IdeaApi): Idea {
  const type: IdeaType = IDEA_TYPES.includes(api.category as IdeaType)
    ? (api.category as IdeaType)
    : 'Innovation'

  return {
    id: api.id,
    title: api.title,
    description: api.description ?? '',
    type,
    submittedBy: api.owner_id?.trim() ?? '',
    workspace: api.workspace_id ?? undefined,
    tags: api.tags,
    createdAt: api.created_date.slice(0, 10),
    reviewer: api.assignee_id ?? '—',
    status: toDisplayStatus(api.status_code),
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

function BrainstormAssistantMessageBody({ text }: { text: string }) {
  const segments = splitMermaidContent(text)
  if (segments.length === 0) return null

  // Mount diagrams directly so broken markdown fences cannot hide them as code blocks.
  if (segments.some((s) => s.type === 'mermaid' || s.type === 'tecchart')) {
    return (
      <div className="space-y-2 text-[15px] leading-7 text-foreground [&_ol]:my-2 [&_p]:my-2">
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
      </div>
    )
  }

  return (
    <AssistantChatMarkdown
      content={formatBrainstormProse(normalizeMermaidFences(text))}
      className="text-[15px] leading-7 text-foreground [&_ol]:my-2 [&_p]:my-2"
    />
  )
}


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
}

const typeAccent: Record<IdeaType, string> = {
  Innovation: '#0ea5e9',
  Improvement: '#10b981',
  Request: '#8b5cf6',
}

const statusClass: Record<IdeaStatus, string> = {
  'New Submission': 'bg-amber-50 text-amber-700 border-amber-200',
  'Under Review': 'bg-blue-50 text-blue-700 border-blue-200',
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  'Converted to Project': 'bg-violet-50 text-violet-700 border-violet-200',
}

function ideaTypeTagChrome(type: IdeaType, active: boolean): string {
  const base =
    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold shadow-sm transition-all select-none'

  const off =
    'bg-background/65 text-muted-foreground border-border/60 hover:bg-background/80 hover:text-foreground'

  const on = 'ring-2 ring-offset-1 ring-offset-background hover:brightness-95'

  if (!active) return cn(base, off)

  if (type === 'Innovation') {
    return cn(base, on, 'bg-gradient-to-r from-sky-500/15 to-indigo-500/15 text-sky-900 border-sky-400/25 ring-sky-500/20')
  }
  if (type === 'Improvement') {
    return cn(base, on, 'bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-900 border-emerald-400/25 ring-emerald-500/20')
  }
  if (type === 'Request') {
    return cn(base, on, 'bg-gradient-to-r from-violet-500/15 to-fuchsia-500/15 text-violet-900 border-violet-400/25 ring-violet-500/20')
  }

  return cn(base, on, 'bg-gradient-to-r from-slate-500/12 to-slate-600/12 text-slate-900 border-slate-400/25 ring-slate-500/20')
}

function ideaStatusTagChrome(status: IdeaStatus, active: boolean): string {
  const base =
    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold shadow-sm transition-all select-none'

  const off =
    'bg-background/65 text-muted-foreground border-border/60 hover:bg-background/80 hover:text-foreground'

  const on = 'ring-2 ring-offset-1 ring-offset-background hover:brightness-95'

  if (!active) return cn(base, off)

  if (status === 'New Submission') {
    return cn(base, on, 'bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-950 border-amber-400/25 ring-amber-500/20')
  }
  if (status === 'Under Review') {
    return cn(base, on, 'bg-gradient-to-r from-blue-500/15 to-cyan-500/15 text-blue-900 border-blue-400/25 ring-blue-500/20')
  }
  if (status === 'Approved') {
    return cn(base, on, 'bg-gradient-to-r from-emerald-500/15 to-green-500/15 text-emerald-900 border-emerald-400/25 ring-emerald-500/20')
  }
  if (status === 'Rejected') {
    return cn(base, on, 'bg-gradient-to-r from-rose-500/15 to-red-500/15 text-rose-900 border-rose-400/25 ring-rose-500/20')
  }
  if (status === 'Converted to Project') {
    return cn(base, on, 'bg-gradient-to-r from-violet-500/15 to-purple-500/15 text-violet-900 border-violet-400/25 ring-violet-500/20')
  }

  return cn(base, on, 'bg-gradient-to-r from-slate-500/12 to-slate-600/12 text-slate-900 border-slate-400/25 ring-slate-500/20')
}

export function IdeaBacklogManagementPage() {
  type SubmissionSortOrder = 'name-asc' | 'name-desc'

  const [ideas, setIdeas] = useState<Idea[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedIdeaId, setSelectedIdeaId] = useState('')
  const [selectedIdeaIds, setSelectedIdeaIds] = useState<Set<string>>(() => new Set())
  const [query, setQuery] = useState('')
  const [typeFilterTags, setTypeFilterTags] = useState<Set<IdeaType>>(() => new Set(IDEA_TYPES))
  const [statusFilterTags, setStatusFilterTags] = useState<Set<IdeaStatus>>(() => new Set(IDEA_STATUSES))
  const [submissionSortOrder, setSubmissionSortOrder] = useState<SubmissionSortOrder>('name-asc')
  const [showFiltersPanel, setShowFiltersPanel] = useState(true)
  const [showScoringPanels, setShowScoringPanels] = useState(true)
  const [showIntakePanel, setShowIntakePanel] = useState(true)
  const [isListView, setIsListView] = useState(false)
  const [orderedIdeaIds, setOrderedIdeaIds] = useState<string[]>([])
  const [activeIdeaId, setActiveIdeaId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [isSearchFieldMenu, setIsSearchFieldMenu] = useState(false)
  const [ideaCardContextMenu, setIdeaCardContextMenu] = useState<{ x: number; y: number; idea: Idea } | null>(null)
  const [isTypeFilterSubmenuOpen, setIsTypeFilterSubmenuOpen] = useState(false)
  const [isStatusFilterSubmenuOpen, setIsStatusFilterSubmenuOpen] = useState(false)
  const [typeFilterSubmenuPos, setTypeFilterSubmenuPos] = useState({ x: 0, y: 0 })
  const [statusFilterSubmenuPos, setStatusFilterSubmenuPos] = useState({ x: 0, y: 0 })
  const backgroundMenuRef = useRef<HTMLDivElement | null>(null)
  const ideaCardMenuRef = useRef<HTMLDivElement | null>(null)
  const typeFilterSubmenuTriggerRef = useRef<HTMLButtonElement | null>(null)
  const typeFilterSubmenuPanelRef = useRef<HTMLDivElement | null>(null)
  const statusFilterSubmenuTriggerRef = useRef<HTMLButtonElement | null>(null)
  const statusFilterSubmenuPanelRef = useRef<HTMLDivElement | null>(null)
  const [isCreateIdeaDrawerOpen, setIsCreateIdeaDrawerOpen] = useState(false)
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
  const [brainstormMessages, setBrainstormMessages] = useState<IdeaDraftBrainstormMessage[]>([])
  const [brainstormInput, setBrainstormInput] = useState('')
  const [isBrainstormSending, setIsBrainstormSending] = useState(false)
  const [isDraftContinuing, setIsDraftContinuing] = useState(false)
  const [brainstormError, setBrainstormError] = useState('')
  const [brainstormReady, setBrainstormReady] = useState(false)
  const [brainstormRemainingGaps, setBrainstormRemainingGaps] = useState<string[]>([])
  const brainstormScrollRef = useRef<HTMLDivElement | null>(null)
  const brainstormComposerRef = useRef<HTMLTextAreaElement | null>(null)
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

  const quickCreateIdeaTagSuggestions = useMemo(() => {
    const used = new Set(createIdeaTags.map((tag) => tag.toLocaleLowerCase()))
    return IDEA_TAG_QUICK_SUGGESTIONS.filter((tag) => !used.has(tag.toLocaleLowerCase()))
  }, [createIdeaTags])

  const isCreateIdeaTagLimitReached = createIdeaTags.length >= MAX_CREATE_IDEA_TAGS
  const isCreateIdeaFormValid = useMemo(() => {
    const hasTitle = createIdeaForm.title.trim().length > 0
    const hasDescription = createIdeaForm.description.trim().length > 0
    const hasWorkspace = createIdeaForm.workspaceId.trim().length > 0
    const hasReviewer = createIdeaForm.reviewer.trim().length > 0
    const hasValidTags = !createIdeaTagFeedback
    const workspaceAndReviewerReady = !isCreateIdeaWorkspaceLoading && !isReviewerOptionsLoading
    const noBlockingLookupError = !createIdeaWorkspaceError && !reviewerOptionsError

    return (
      hasTitle &&
      hasDescription &&
      hasWorkspace &&
      hasReviewer &&
      hasValidTags &&
      workspaceAndReviewerReady &&
      noBlockingLookupError
    )
  }, [
    createIdeaForm.description,
    createIdeaForm.reviewer,
    createIdeaForm.title,
    createIdeaForm.workspaceId,
    createIdeaTagFeedback,
    createIdeaWorkspaceError,
    effectiveCreateIdeaTags.length,
    isCreateIdeaWorkspaceLoading,
    isReviewerOptionsLoading,
    reviewerOptionsError,
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
    if (query.trim()) filters.push(`pencarian: "${query.trim()}"`)
    if (typeFilterTags.size > 0 && typeFilterTags.size < IDEA_TYPES.length) {
      filters.push(`tipe: ${[...typeFilterTags].join(', ')}`)
    }
    if (statusFilterTags.size > 0 && statusFilterTags.size < IDEA_STATUSES.length) {
      filters.push(`status: ${[...statusFilterTags].join(', ')}`)
    }
    const selection =
      selectedIdeaIds.size > 1
        ? `${selectedIdeaIds.size} ide dipilih`
        : selectedIdea
          ? `ide terpilih: ${selectedIdea.title}`
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
      fill: '#93c5fd',
      description: 'All ideas entering strategic intake.',
    },
    {
      stage: 'Evaluated',
      value: metrics.underReview + metrics.approved + metrics.rejected + metrics.converted,
      fill: '#60a5fa',
      description: 'Ideas screened by governance and scoring.',
    },
    {
      stage: 'Approved',
      value: metrics.approved + metrics.converted,
      fill: '#3b82f6',
      description: 'Ideas cleared for execution planning.',
    },
    {
      stage: 'Executed',
      value: metrics.converted,
      fill: '#1d4ed8',
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

  const filteredIdeas = useMemo(() => {
    return ideas.filter((idea) => {
      const matchQuery =
        idea.title.toLowerCase().includes(query.toLowerCase()) ||
        idea.description.toLowerCase().includes(query.toLowerCase()) ||
        idea.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase()))
      const matchType = typeFilterTags.size === 0 || typeFilterTags.has(idea.type)
      const matchStatus = statusFilterTags.size === 0 || statusFilterTags.has(idea.status)
      return matchQuery && matchType && matchStatus
    })
  }, [ideas, query, typeFilterTags, statusFilterTags])

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

  const activeIdea = useMemo(
    () => orderedSortedFilteredIdeas.find((idea) => idea.id === activeIdeaId) ?? null,
    [orderedSortedFilteredIdeas, activeIdeaId]
  )

  const isDragActive = activeIdeaId !== null
  const draggedIdeaIds = useMemo(() => {
    if (!activeIdeaId) return new Set<string>()
    return new Set([activeIdeaId])
  }, [activeIdeaId])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const decideIdea = async (status: IdeaStatus) => {
    if (!selectedIdea) return
    const targetStatus = toBackendStatus(status)
    try {
      const updated = await patchIdea(selectedIdea.id, { status_code: targetStatus, version: selectedIdea.version })
      setIdeas((prev) => prev.map((idea) => (idea.id === selectedIdea.id ? fromApiIdea(updated) : idea)))
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
      setIdeas((prev) => prev.map((i) => (i.id === ideaId ? fromApiIdea(updated) : i)))
    } catch {
      setIdeas((prev) => prev.map((i) => (i.id === ideaId ? { ...i, status } : i)))
    }
  }

  const handleIdeaDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    if (!id.startsWith('idea-')) return
    setActiveIdeaId(id.replace('idea-', ''))
  }

  const handleIdeaDragEnd = (event: DragEndEvent) => {
    setActiveIdeaId(null)

    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = String(active.id).replace('idea-', '')
    const overId = String(over.id).replace('idea-', '')

    const visibleIdeaIds = orderedSortedFilteredIdeas.map((idea) => idea.id)
    const oldIndex = visibleIdeaIds.indexOf(activeId)
    const newIndex = visibleIdeaIds.indexOf(overId)

    if (oldIndex < 0 || newIndex < 0) return

    const reorderedVisible = arrayMove(visibleIdeaIds, oldIndex, newIndex)

    setOrderedIdeaIds((prev) => {
      const remaining = prev.filter((id) => !visibleIdeaIds.includes(id))
      return [...reorderedVisible, ...remaining]
    })
  }

  const handleIdeaDragCancel = () => {
    setActiveIdeaId(null)
  }

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setLoadError(null)
    Promise.all([
      listIdeas({ page_size: 200 }),
      fetchIdentityUsers({ limit: 500, offset: 0 }).catch(() => null),
    ])
      .then(([res, usersRes]) => {
        if (cancelled) return
        const identityNames = mapIdentityUserDisplayNames(usersRes?.items)
        if (currentUserId && currentUserDisplayName) {
          identityNames[currentUserId] = identityNames[currentUserId] ?? currentUserDisplayName
        }
        if (Object.keys(identityNames).length > 0) {
          setIdentityUserNameById(identityNames)
        }
        const mapped = res.items.map(fromApiIdea)
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
  }, [currentUserDisplayName, currentUserId])

  useEffect(() => {
    return () => {
      ideaAnalysisInFlightRef.current = {}
    }
  }, [])

  useEffect(() => {
    if (!isCreateIdeaDrawerOpen) return

    let cancelled = false
    setIsCreateIdeaWorkspaceLoading(true)
    setCreateIdeaWorkspaceError('')

    void fetchAllWorkspaceOrgWorkspaces({ status: 'active' })
      .then((rows) => {
        if (cancelled) return
        const options = rows
          .map((row) => ({ id: row.id, name: row.name.trim() || row.workspace_key }))
          .filter((row) => row.id && row.name)
          .sort((a, b) => a.name.localeCompare(b.name))
        setCreateIdeaWorkspaceOptions(options)
        setCreateIdeaForm((prev) => {
          const hasSelected = options.some((option) => option.id === prev.workspaceId)
          if (hasSelected || options.length === 0) return prev
          return { ...prev, workspaceId: options[0].id }
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setCreateIdeaWorkspaceOptions([])
        setCreateIdeaWorkspaceError(err instanceof Error ? err.message : 'Failed to load workspaces.')
      })
      .finally(() => {
        if (!cancelled) setIsCreateIdeaWorkspaceLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isCreateIdeaDrawerOpen])

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
        setCreateIdeaForm((prev) => {
          const hasSelected = options.some((option) => option.subjectId === prev.reviewer)
          if (hasSelected || options.length === 0) return prev
          return { ...prev, reviewer: options[0].subjectId }
        })
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
        setIsCreateIdeaDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [isCreateIdeaDrawerOpen])

  useEffect(() => {
    const ideaIds = ideas.map((idea) => idea.id)
    setOrderedIdeaIds((prev) => {
      const known = new Set(ideaIds)
      const persisted = prev.filter((id) => known.has(id))
      const missing = ideaIds.filter((id) => !persisted.includes(id))
      return [...persisted, ...missing]
    })
  }, [ideas])

  useEffect(() => {
    if (!contextMenu && !ideaCardContextMenu) return
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null)
        setIdeaCardContextMenu(null)
        setIsSearchFieldMenu(false)
        setIsTypeFilterSubmenuOpen(false)
        setIsStatusFilterSubmenuOpen(false)
      }
    }
    const onResize = () => {
      setContextMenu(null)
      setIdeaCardContextMenu(null)
      setIsSearchFieldMenu(false)
      setIsTypeFilterSubmenuOpen(false)
      setIsStatusFilterSubmenuOpen(false)
    }
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      const clickedBackgroundMenu = backgroundMenuRef.current?.contains(target)
      const clickedIdeaCardMenu = ideaCardMenuRef.current?.contains(target)
      const clickedTypeFilterSubmenu = typeFilterSubmenuPanelRef.current?.contains(target)
      const clickedTypeFilterTrigger = typeFilterSubmenuTriggerRef.current?.contains(target)
      const clickedStatusFilterSubmenu = statusFilterSubmenuPanelRef.current?.contains(target)
      const clickedStatusFilterTrigger = statusFilterSubmenuTriggerRef.current?.contains(target)
      if (!clickedBackgroundMenu && !clickedIdeaCardMenu && !clickedTypeFilterSubmenu && !clickedTypeFilterTrigger && !clickedStatusFilterSubmenu && !clickedStatusFilterTrigger) {
        closeContextMenu()
      }
    }
    window.addEventListener('keydown', onEsc)
    window.addEventListener('mousedown', onPointerDown, true)
    window.addEventListener('resize', onResize, { once: true })
    return () => {
      window.removeEventListener('keydown', onEsc)
      window.removeEventListener('mousedown', onPointerDown, true)
      window.removeEventListener('resize', onResize)
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

    const menuWidth = 228
    const menuHeight = 164
    const gap = 12

    const x = Math.min(event.clientX, window.innerWidth - menuWidth - gap)
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - gap)

    setIdeaCardContextMenu(null)
    setIsTypeFilterSubmenuOpen(false)
    setIsStatusFilterSubmenuOpen(false)
    setContextMenu({ x: Math.max(gap, x), y: Math.max(gap, y) })
  }

  const closeContextMenu = () => {
    setContextMenu(null)
    setIdeaCardContextMenu(null)
    setIsSearchFieldMenu(false)
    setIsTypeFilterSubmenuOpen(false)
    setIsStatusFilterSubmenuOpen(false)
  }

  const updateTypeFilterSubmenuPosition = () => {
    const triggerEl = typeFilterSubmenuTriggerRef.current
    if (!triggerEl) return

    const triggerRect = triggerEl.getBoundingClientRect()
    const panelWidth = 228
    const panelHeight = typeFilterSubmenuPanelRef.current?.offsetHeight ?? 220
    const viewportPadding = 12
    const sideGap = 8

    let left = triggerRect.right + sideGap
    if (left + panelWidth > window.innerWidth - viewportPadding) {
      left = triggerRect.left - panelWidth - sideGap
    }

    let top = triggerRect.top
    if (top + panelHeight > window.innerHeight - viewportPadding) {
      top = window.innerHeight - panelHeight - viewportPadding
    }

    setTypeFilterSubmenuPos({
      x: Math.max(viewportPadding, Math.round(left)),
      y: Math.max(viewportPadding, Math.round(top)),
    })
  }

  const updateStatusFilterSubmenuPosition = () => {
    const triggerEl = statusFilterSubmenuTriggerRef.current
    if (!triggerEl) return

    const triggerRect = triggerEl.getBoundingClientRect()
    const panelWidth = 228
    const panelHeight = statusFilterSubmenuPanelRef.current?.offsetHeight ?? 260
    const viewportPadding = 12
    const sideGap = 8

    let left = triggerRect.right + sideGap
    if (left + panelWidth > window.innerWidth - viewportPadding) {
      left = triggerRect.left - panelWidth - sideGap
    }

    let top = triggerRect.top
    if (top + panelHeight > window.innerHeight - viewportPadding) {
      top = window.innerHeight - panelHeight - viewportPadding
    }

    setStatusFilterSubmenuPos({
      x: Math.max(viewportPadding, Math.round(left)),
      y: Math.max(viewportPadding, Math.round(top)),
    })
  }

  useEffect(() => {
    if (!isTypeFilterSubmenuOpen) return

    updateTypeFilterSubmenuPosition()

    const handleViewportChange = () => updateTypeFilterSubmenuPosition()
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [isTypeFilterSubmenuOpen])

  useEffect(() => {
    if (!isStatusFilterSubmenuOpen) return

    updateStatusFilterSubmenuPosition()

    const handleViewportChange = () => updateStatusFilterSubmenuPosition()
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [isStatusFilterSubmenuOpen])

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
        setIdeas((prev) => prev.map((current) => (current.id === idea.id ? fromApiIdea(latestIdea) : current)))
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

    if (!createIdeaForm.reviewer.trim()) {
      setCreateIdeaError('Reviewer is required.')
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
      })
      const newIdea = {
        ...fromApiIdea(created),
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
      overlapMessages.push(`${terminal.similar_documents.length} related BRD(s) found`)
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

  const waitForIdeaDraftJob = async (jobId: string): Promise<IdeaDraftJobStatusResponse> => {
    for (let attempt = 0; attempt < 240; attempt += 1) {
      const status = await getIdeaDraftJob(jobId)
      setIdeaDraftJob(status)
      if (status.status === 'awaiting_input') {
        setBrainstormMessages(status.brainstorm_messages ?? [])
        setBrainstormReady(Boolean(status.brainstorm_ready))
        setBrainstormRemainingGaps(status.brainstorm_remaining_gaps ?? status.evidence_summary.gaps ?? [])
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

  const handleSendBrainstormMessage = async () => {
    if (!ideaDraftJob || ideaDraftJob.status !== 'awaiting_input') return
    const message = brainstormInput.trim()
    if (!message || isBrainstormSending || brainstormReady) return
    const historyBeforeSend = brainstormMessages
    setIsBrainstormSending(true)
    setBrainstormError('')
    setBrainstormInput('')
    setBrainstormMessages((current) => [...current, { role: 'user', text: message }])
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
        response = await sendWithJob(restored.job_id)
      }
      setBrainstormMessages(response.messages)
      setBrainstormReady(response.ready_to_continue)
      setBrainstormRemainingGaps(response.remaining_gaps)
      setIdeaDraftJob((current) => current
        ? {
            ...current,
            brainstorm_messages: response.messages,
            brainstorm_ready: response.ready_to_continue,
            brainstorm_remaining_gaps: response.remaining_gaps,
          }
        : current)
    } catch (error) {
      setBrainstormInput(message)
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
    const node = brainstormScrollRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [isBrainstormMode, brainstormMessages, isBrainstormSending, brainstormReady])

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
      tone: 'from-sky-500/12 to-sky-400/0 border-sky-200/80',
      accent: 'bg-sky-600',
    },
    {
      label: 'Under Review',
      value: metrics.underReview,
      note: 'Governance decision queue',
      icon: ClipboardList,
      tone: 'from-indigo-500/12 to-indigo-400/0 border-indigo-200/80',
      accent: 'bg-indigo-600',
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

  const scoringRows = selectedIdea
    ? ([
        { key: 'businessValue', label: 'Value', value: selectedIdea.scoring.businessValue, color: '#5f7de0' },
        { key: 'effort', label: 'Effort', value: selectedIdea.scoring.effort, color: '#5f7de0' },
        { key: 'risk', label: 'Risk', value: selectedIdea.scoring.risk, color: '#5f7de0' },
        { key: 'roi', label: 'ROI', value: selectedIdea.scoring.roi, color: '#5f7de0' },
      ] as const)
    : ([] as { key: string; label: string; value: number; color: string }[])

  const chartRows = selectedIdea
    ? [
        { label: 'Value', score: selectedIdea.scoring.businessValue, fill: '#5f7de0' },
        { label: 'Effort', score: selectedIdea.scoring.effort, fill: '#e2a234' },
        { label: 'Risk', score: selectedIdea.scoring.risk, fill: '#e2a234' },
        { label: 'ROI', score: selectedIdea.scoring.roi, fill: '#5f7de0' },
      ]
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
    if (isUnknownIdentityToken(raw)) return 'Root'
    const resolved = (identityUserNameById[raw] ?? raw).trim()
    return isUnknownIdentityToken(resolved) ? 'Root' : resolved
  }

  const isMultiSelectCardMenu =
    !!ideaCardContextMenu && selectedIdeaIds.size > 1 && selectedIdeaIds.has(ideaCardContextMenu.idea.id)
  const isContextIdeaAnalysisLocked =
    !!ideaCardContextMenu && isIdeaAnalysisLocked(ideaCardContextMenu.idea.id)
  const isContextIdeaAnalysisFailed =
    !!ideaCardContextMenu && isIdeaAnalysisFailed(ideaCardContextMenu.idea.id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Loading ideas…
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="text-sm font-medium text-rose-700">Tidak dapat memuat Idea &amp; Backlog</p>
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()}>
          Muat ulang
        </Button>
      </div>
    )
  }

  return (
    <div
      className="space-y-6 pb-10"
      onContextMenu={openContextMenu}
      onMouseDown={(event) => {
        if (event.button !== 0) return
        const target = event.target as HTMLElement
        if (target.closest('[data-idea-card="true"]')) return
        setSelectedIdeaId('')
        setSelectedIdeaIds(new Set())
      }}
    >
      <Breadcrumb items={[{ label: 'Workspace', href: '/' }, { label: 'Idea & Backlog' }]} />

      <style>{`
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
              onClick={() => setShowFiltersPanel((v) => !v)}
              className={cn(
                'flex items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-all duration-200 hover:bg-background hover:text-foreground hover:shadow-sm',
                showFiltersPanel && 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
              )}
              aria-label={showFiltersPanel ? 'Hide search and filter panel' : 'Show search and filter panel'}
            >
              <Filter className="w-5 h-5" />
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
          </div>
        }
      />

      {showScoringPanels && selectedIdea && (
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <Card className="xl:col-span-8 glass-card rounded-2xl border-border/30 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900 flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-border/40 bg-white/90">
                <ClipboardList className="h-3 w-3 text-slate-600" />
              </span>
              Idea Evaluation & Scoring
            </CardTitle>
            <CardDescription>
              Evaluate business impact and execution viability to prioritize what moves into delivery.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border/40 bg-gradient-to-br from-white via-slate-50/70 to-blue-50/60 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] font-semibold text-slate-600 bg-white/90">
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

                <div className="rounded-lg border border-border/40 bg-white/90 px-4 py-2 min-w-[160px]">
                  <p className="text-[11px] font-medium text-slate-500">Weighted score</p>
                  <p className="text-2xl font-bold text-slate-900 leading-none mt-1">{totalScore}</p>
                  <p className="text-[11px] text-slate-500 mt-1">Rank #{ranking} of {ideas.length}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-lg border border-border/40 bg-white/85 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Value weight</p>
                  <p className="text-sm font-semibold text-slate-900">30%</p>
                </div>
                <div className="rounded-lg border border-border/40 bg-white/85 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">ROI weight</p>
                  <p className="text-sm font-semibold text-slate-900">30%</p>
                </div>
                <div className="rounded-lg border border-border/40 bg-white/85 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Effort adjuster</p>
                  <p className="text-sm font-semibold text-slate-900">20%</p>
                </div>
                <div className="rounded-lg border border-border/40 bg-white/85 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Risk adjuster</p>
                  <p className="text-sm font-semibold text-slate-900">20%</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto pb-1">
              <div className="min-w-[820px] grid grid-cols-4 gap-3">
                {scoringRows.map((item, index) => (
                  <div key={item.key} className="rounded-lg border border-border/40 bg-white/80 px-3 py-2.5">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-medium text-slate-700">{item.label}</span>
                    <span className="font-semibold text-slate-500">{item.value}/10</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="idea-progress-bar h-full rounded-full"
                      style={{
                        width: `${(item.value / 10) * 100}%`,
                        backgroundColor: item.color,
                        transformOrigin: 'left',
                        animation: `ideaBarReveal 780ms cubic-bezier(0.22,1,0.36,1) ${index * 70}ms both`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    {item.key === 'businessValue' || item.key === 'roi' ? 'Primary driver' : 'Execution adjuster'}
                  </p>
                </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/40 bg-white/80 px-2 pt-3 pb-2 h-[150px]">
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

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-slate-500">Decision SLA: target within 2 business days from intake review.</p>
              <div className="flex flex-wrap gap-2">
                <Button className="h-9 bg-[#5f7de0] hover:bg-[#4f6bd0]" onClick={() => decideIdea('Approved')}>
                <Check className="h-4 w-4 mr-1.5" /> Approve
              </Button>
                <Button
                  variant="outline"
                  className="h-9 border-rose-200 text-rose-500 hover:bg-rose-50"
                  onClick={() => decideIdea('Rejected')}
                >
                  <X className="h-4 w-4 mr-1.5" /> Reject
                </Button>
                <Button variant="outline" className="h-9" onClick={() => decideIdea('Under Review')}>
                  Request revision
                </Button>
              </div>
            </div>
          </CardContent>
          </Card>

          <Card className="xl:col-span-4 glass-card rounded-2xl border-border/30 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-slate-900">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-border/40 bg-white/90">
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
            <div className="rounded-lg border border-border/40 bg-gradient-to-br from-white via-slate-50/70 to-blue-50/50 px-3 py-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Queue size</span>
                <span className="font-semibold text-slate-900">{ideas.length} ideas</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Active selection</span>
                <span className="font-semibold text-blue-700">{selectedIdea.id}</span>
              </div>
            </div>

            {ideas.map((idea) => (
              <button
                key={idea.id}
                onClick={() => selectSingleIdea(idea.id)}
                className={cn(
                  'w-full text-left rounded-xl border p-3 transition-all hover:border-slate-300',
                  selectedIdeaId === idea.id
                    ? 'border-blue-300 bg-gradient-to-r from-blue-50/70 to-indigo-50/40 shadow-[0_8px_22px_-16px_rgba(37,99,235,0.75)]'
                    : 'border-border/40 bg-white/80'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="text-[10px] font-semibold text-slate-600 bg-white/90">
                    {idea.id}
                  </Badge>
                  <Badge className={cn('border text-[10px] font-semibold', typeClass[idea.type])}>{idea.type}</Badge>
                </div>

                <p className="text-xs font-semibold text-slate-900 mt-2 leading-5">{idea.title}</p>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <Badge variant="outline" className={cn('text-[10px] font-semibold', statusClass[idea.status])}>
                    {idea.status}
                  </Badge>
                  {selectedIdeaId === idea.id && (
                    <span className="text-[10px] font-semibold text-blue-700">Selected</span>
                  )}
                </div>
              </button>
            ))}
          </CardContent>
          </Card>
        </section>
      )}

      {showIntakePanel && (
        <section>
          <Card className="glass-card rounded-2xl border-border/30 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] flex items-center gap-2 text-slate-900">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/40 bg-white/90">
                <ClipboardList className="h-3.5 w-3.5 text-slate-600" />
              </span>
              Idea Intake Overview
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Enterprise demand intelligence view for intake, governance review, and execution conversion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border border-border/40 bg-gradient-to-br from-white via-slate-50/70 to-blue-50/60 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] font-semibold text-slate-600 bg-white/90">
                      Intake Governance
                    </Badge>
                    <Badge variant="outline" className="text-[10px] font-semibold border-blue-200 bg-blue-50 text-blue-700">
                      Weekly refresh
                    </Badge>
                    <Badge variant="outline" className="text-[10px] font-semibold border-emerald-200 bg-emerald-50 text-emerald-700">
                      Conversion {intakeConversionRate}%
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">Demand funnel health and governance throughput</p>
                  <p className="text-xs text-slate-500">Monitor intake quality, review velocity, and execution readiness in one executive strip.</p>
                </div>

                <div className="rounded-lg border border-border/40 bg-white/90 px-4 py-2 min-w-[178px]">
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
                  className={cn(
                    'group relative overflow-hidden rounded-2xl border bg-white/90 px-4 py-3.5 shadow-[0_10px_30px_-22px_rgba(15,23,42,0.55)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-24px_rgba(15,23,42,0.52)]',
                    card.tone
                  )}
                >
                  <span className={cn('absolute left-0 top-0 h-1.5 w-full opacity-90', card.accent)} />
                  <div className="absolute -right-8 -top-10 h-24 w-24 rounded-full bg-white/55 blur-xl" />

                  <div className="relative flex items-start justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{card.label}</p>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/70 bg-white/90 shadow-sm">
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
                  <div className="rounded-xl border border-border/40 bg-white/85 px-3 py-2.5 shadow-sm">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">End-to-end throughput</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{funnelThroughput}%</p>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-white/85 px-3 py-2.5 shadow-sm">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Largest drop-off</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{funnelLargestDrop?.stage ?? 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.92))] p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-28px_rgba(15,23,42,0.22)]">
                <div className="overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                  <div className="min-w-[1040px]">
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-4 xl:gap-4">
                      {funnelSummary.map((item, index) => {
                        const barWidth = Math.max((item.value / funnelMax) * 100, 20)

                        return (
                          <div key={item.stage} className="relative">
                            <div className="group relative overflow-hidden rounded-[24px] border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/65 px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_16px_-14px_rgba(15,23,42,0.1)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_12px_22px_-14px_rgba(15,23,42,0.12)]">
                              <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: `linear-gradient(90deg, ${item.fill}, ${item.fill}99)` }} />
                              <div className="absolute -right-8 -top-10 h-24 w-24 rounded-full bg-slate-100/80 blur-2xl" />
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

                              <div className="relative mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                                <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
                                  <span>Stage weight</span>
                                  <span className="text-slate-700">{item.shareOfTotal}%</span>
                                </div>
                                <div className="mt-2 h-2 rounded-full bg-white shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]">
                                  <div
                                    className="idea-progress-bar h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${barWidth}%`,
                                      background: `linear-gradient(90deg, ${item.fill}, ${item.fill}CC)`,
                                      transformOrigin: 'left',
                                      animation: `ideaBarReveal 900ms cubic-bezier(0.22,1,0.36,1) ${220 + index * 100}ms both`,
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="relative mt-3 grid grid-cols-2 gap-2">
                                <div className="rounded-xl border border-border/40 bg-slate-50/70 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Retention</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">{item.conversion}%</p>
                                </div>
                                <div className="rounded-xl border border-border/40 bg-slate-50/70 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
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

      <section className="space-y-4">
        {showFiltersPanel && (
          <div
            className={cn(
              'glass-card rounded-2xl p-4 space-y-4',
              'border border-white/40 dark:border-white/10',
              'ring-1 ring-black/[0.04] dark:ring-white/[0.06]',
              'shadow-[0_16px_44px_rgba(15,23,42,0.10)] dark:shadow-[0_18px_52px_rgba(0,0,0,0.35)]',
              'bg-gradient-to-br from-white/70 via-background/75 to-slate-50/70 dark:from-slate-900/45 dark:via-background/40 dark:to-slate-950/20'
            )}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  const menuWidth = 228
                  const menuHeight = 210
                  const gap = 12
                  const x = Math.min(event.clientX, window.innerWidth - menuWidth - gap)
                  const y = Math.min(event.clientY, window.innerHeight - menuHeight - gap)
                  setIsSearchFieldMenu(true)
                  setContextMenu(null)
                  setIdeaCardContextMenu(null)
                  setContextMenu({ x: Math.max(gap, x), y: Math.max(gap, y) })
                }}
                placeholder="Search ideas, tags, submitter, or intent..."
                className="pl-9 h-10 w-full"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/50">
              <Button
                variant="default"
                className="gap-2 h-10 px-4 rounded-lg text-sm font-semibold tracking-tight shrink-0"
                onClick={openCreateIdeaDrawer}
              >
                <Plus className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2.25} />
                Create Idea
              </Button>
              <div className="hidden min-w-[1rem] flex-1 lg:block" aria-hidden />
              <div className="flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-2 lg:ml-auto lg:w-auto lg:justify-end">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">
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
                                // Prevent empty: if deleting would make it empty, revert to all
                                if (next.size === 0) return new Set(IDEA_TYPES)
                              } else {
                                next.add(type)
                              }
                              return next
                            })
                          }}
                          className={ideaTypeTagChrome(type, on)}
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
                <span
                  className="hidden shrink-0 select-none text-sm font-light text-muted-foreground/50 sm:inline"
                  aria-hidden
                >
                  |
                </span>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">
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
                                // Prevent empty: if deleting would make it empty, revert to all
                                if (next.size === 0) return new Set(['New Submission', 'Under Review', 'Approved', 'Rejected', 'Converted to Project'])
                              } else {
                                next.add(status)
                              }
                              return next
                            })
                          }}
                          className={ideaStatusTagChrome(status, on)}
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
        )}

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

          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleIdeaDragStart}
            onDragEnd={handleIdeaDragEnd}
            onDragCancel={handleIdeaDragCancel}
          >
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
                      setIsTypeFilterSubmenuOpen(false)

                      const menuWidth = 220
                      const menuHeight = 238
                      const gap = 12
                      const x = Math.min(event.clientX, window.innerWidth - menuWidth - gap)
                      const y = Math.min(event.clientY, window.innerHeight - menuHeight - gap)

                      setIdeaCardContextMenu({
                        x: Math.max(gap, x),
                        y: Math.max(gap, y),
                        idea: currentIdea,
                      })
                    }}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeIdea ? (
                <div style={{ transform: 'rotate(2deg)' }}>
                  <div
                    className="glass-card rounded-xl p-4 opacity-95 scale-105 shadow-2xl border-2 border-primary/30"
                    style={{
                      width: '360px',
                      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 2px rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <div className="p-1.5 rounded-lg bg-primary/10 flex-shrink-0">
                        <div className="w-4 h-4 bg-primary/20 rounded" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-foreground mb-1 truncate">
                          {activeIdea.title}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {activeIdea.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </section>

      {typeof document !== 'undefined' &&
        createPortal(
          <>
            {contextMenu && (
              <>
                <div
                  ref={backgroundMenuRef}
                  className="fixed z-[1190] w-[228px] rounded-xl border border-border/60 bg-white/96 p-1.5 shadow-[0_18px_38px_-20px_rgba(15,23,42,0.45)] backdrop-blur-sm"
                  style={{ left: contextMenu.x, top: contextMenu.y }}
                  onClick={(event) => event.stopPropagation()}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  {isSearchFieldMenu && (
                    <>
                      <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
                        onClick={() => {
                          setQuery('')
                          closeContextMenu()
                        }}
                      >
                        <span className="flex items-center gap-2">
                          <X className="h-4 w-4 text-slate-500" />
                          <span>Clear field</span>
                        </span>
                      </button>
                      <div className="my-1 border-t border-border/60" />
                    </>
                  )}

                  <button
                    type="button"
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
                    onClick={() => {
                      setShowScoringPanels((v) => !v)
                      closeContextMenu()
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-slate-500" />
                      <span>{showScoringPanels ? 'Hide scoring panel' : 'Show scoring panel'}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="mt-0.5 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
                    onClick={() => {
                      setShowIntakePanel((v) => !v)
                      closeContextMenu()
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-slate-500" />
                      <span>{showIntakePanel ? 'Hide intake panel' : 'Show intake panel'}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="mt-0.5 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
                    onClick={() => {
                      setShowFiltersPanel((v) => !v)
                      closeContextMenu()
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-slate-500" />
                      <span>{showFiltersPanel ? 'Hide search & filters panel' : 'Show search & filters panel'}</span>
                    </span>
                  </button>

                  <div className="my-1 border-t border-border/60" />

                  <button
                    type="button"
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
                    onClick={() => {
                      closeContextMenu()
                      openCreateIdeaDrawer()
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-slate-500" />
                      <span>Create idea</span>
                    </span>
                  </button>
                </div>
              </>
            )}

            {ideaCardContextMenu && (
              <>
                <div
                  ref={ideaCardMenuRef}
                  className="fixed z-[1190] w-[220px] rounded-xl border border-border/60 bg-white/96 p-1.5 shadow-[0_18px_38px_-20px_rgba(15,23,42,0.45)] backdrop-blur-sm"
                  style={{ left: ideaCardContextMenu.x, top: ideaCardContextMenu.y }}
                  onClick={(event) => event.stopPropagation()}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  {!isMultiSelectCardMenu && (
                    <button
                      type="button"
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
                      onClick={() => {
                        closeContextMenu()
                        openCreateIdeaDrawer()
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <Plus className="h-4 w-4 text-slate-500" />
                        <span>Create idea</span>
                      </span>
                    </button>
                  )}

                  {!isMultiSelectCardMenu && <div className="mx-1 my-1.5 border-t border-slate-200/90" />}

                  {!isMultiSelectCardMenu && (
                    <button
                      type="button"
                      disabled={isContextIdeaAnalysisLocked}
                      className={cn(
                        'w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100',
                        isContextIdeaAnalysisLocked && 'cursor-not-allowed opacity-50 hover:bg-transparent'
                      )}
                      onClick={() => {
                        if (isContextIdeaAnalysisLocked) return
                        openIdeaDetail(ideaCardContextMenu.idea)
                        closeContextMenu()
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-slate-500" />
                        <span>{isContextIdeaAnalysisLocked ? 'Analysis in progress' : 'View detail'}</span>
                      </span>
                    </button>
                  )}

                  {!isMultiSelectCardMenu && isContextIdeaAnalysisFailed && (
                    <button
                      type="button"
                      className="mt-0.5 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
                      onClick={() => {
                        void runAgentAnalysisForIdea(ideaCardContextMenu.idea)
                        closeContextMenu()
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <Undo2 className="h-4 w-4 text-slate-500" />
                        <span>Retry analysis</span>
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="mt-0.5 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
                    onClick={() => {
                      if (isMultiSelectCardMenu) {
                        setSelectedIdeaId(ideaCardContextMenu.idea.id)
                        setShowScoringPanels(true)
                      } else {
                        selectSingleIdea(ideaCardContextMenu.idea.id)
                      }
                      closeContextMenu()
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-slate-500" />
                      <span>Evaluate</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    className="mt-0.5 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
                    onClick={() => {
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
                    <span className="flex items-center gap-2">
                      <X className="h-4 w-4 text-slate-500" />
                      <span>Reject</span>
                    </span>
                  </button>

                  <div className="my-1 border-t border-border/60" />

                  <div className="relative">
                    <button
                      ref={typeFilterSubmenuTriggerRef}
                      type="button"
                      className={cn(
                        'mt-0.5 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100',
                        isTypeFilterSubmenuOpen && 'bg-slate-100'
                      )}
                      onMouseEnter={() => {
                        updateTypeFilterSubmenuPosition()
                        setIsStatusFilterSubmenuOpen(false)
                        setIsTypeFilterSubmenuOpen(true)
                      }}
                      onClick={() => {
                        if (!isTypeFilterSubmenuOpen) {
                          updateTypeFilterSubmenuPosition()
                        }
                        setIsStatusFilterSubmenuOpen(false)
                        setIsTypeFilterSubmenuOpen((open) => !open)
                      }}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <Filter className="h-4 w-4 text-slate-500" />
                          <span>Filter by type</span>
                        </span>
                        <MoveRight className="h-4 w-4 text-slate-400" />
                      </span>
                    </button>

                    {isTypeFilterSubmenuOpen && createPortal(
                      <div
                        ref={typeFilterSubmenuPanelRef}
                        className="fixed z-[1210] w-[228px] rounded-xl border border-border/60 bg-white/96 p-1.5 shadow-[0_18px_38px_-20px_rgba(15,23,42,0.45)] backdrop-blur-sm"
                        style={{
                          left: `${typeFilterSubmenuPos.x}px`,
                          top: `${typeFilterSubmenuPos.y}px`,
                        }}
                        onMouseLeave={() => setIsTypeFilterSubmenuOpen(false)}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
                          onClick={() => applyTypeFilterFromContextMenu('All')}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span>All types</span>
                            {typeFilterTags.size === IDEA_TYPES.length && <Check className="h-4 w-4 text-emerald-600" />}
                          </span>
                        </button>

                        <div className="my-1 border-t border-border/60" />

                        {IDEA_TYPES.map((type) => (
                          <button
                            key={type}
                            type="button"
                            className="mt-0.5 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
                            onClick={() => applyTypeFilterFromContextMenu(type)}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-2">
                                <span className={cn('inline-block h-2 w-2 rounded-full', type === 'Innovation' ? 'bg-sky-500' : type === 'Improvement' ? 'bg-emerald-500' : 'bg-violet-500')} />
                                <span>{type}</span>
                              </span>
                              <span className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">{typeCounts[type]}</span>
                                {typeFilterTags.has(type) && <Check className="h-4 w-4 text-emerald-600" />}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>,
                      document.body
                    )}
                  </div>

                  <div className="relative">
                    <button
                      ref={statusFilterSubmenuTriggerRef}
                      type="button"
                      className={cn(
                        'mt-0.5 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100',
                        isStatusFilterSubmenuOpen && 'bg-slate-100'
                      )}
                      onMouseEnter={() => {
                        updateStatusFilterSubmenuPosition()
                        setIsTypeFilterSubmenuOpen(false)
                        setIsStatusFilterSubmenuOpen(true)
                      }}
                      onClick={() => {
                        if (!isStatusFilterSubmenuOpen) {
                          updateStatusFilterSubmenuPosition()
                        }
                        setIsTypeFilterSubmenuOpen(false)
                        setIsStatusFilterSubmenuOpen((open) => !open)
                      }}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <Filter className="h-4 w-4 text-slate-500" />
                          <span>Filter by status</span>
                        </span>
                        <MoveRight className="h-4 w-4 text-slate-400" />
                      </span>
                    </button>

                    {isStatusFilterSubmenuOpen && createPortal(
                      <div
                        ref={statusFilterSubmenuPanelRef}
                        className="fixed z-[1210] w-[228px] rounded-xl border border-border/60 bg-white/96 p-1.5 shadow-[0_18px_38px_-20px_rgba(15,23,42,0.45)] backdrop-blur-sm"
                        style={{
                          left: `${statusFilterSubmenuPos.x}px`,
                          top: `${statusFilterSubmenuPos.y}px`,
                        }}
                        onMouseLeave={() => setIsStatusFilterSubmenuOpen(false)}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
                          onClick={() => applyStatusFilterFromContextMenu('All')}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span>All status</span>
                            {statusFilterTags.size === IDEA_STATUSES.length && <Check className="h-4 w-4 text-emerald-600" />}
                          </span>
                        </button>

                        <div className="my-1 border-t border-border/60" />

                        {IDEA_STATUSES.map((status) => (
                          <button
                            key={status}
                            type="button"
                            className="mt-0.5 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
                            onClick={() => applyStatusFilterFromContextMenu(status)}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span>{status}</span>
                              <span className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">{statusCounts[status]}</span>
                                {statusFilterTags.has(status) && <Check className="h-4 w-4 text-emerald-600" />}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>,
                      document.body
                    )}
                  </div>

                  {!isMultiSelectCardMenu && <div className="my-1 border-t border-border/60" />}

                  {!isMultiSelectCardMenu && (
                    <button
                      type="button"
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
                      onClick={() => {
                        setShowScoringPanels((v) => !v)
                        closeContextMenu()
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-slate-500" />
                        <span>{showScoringPanels ? 'Hide scoring panel' : 'Show scoring panel'}</span>
                      </span>
                    </button>
                  )}

                  {!isMultiSelectCardMenu && (
                    <button
                      type="button"
                      className="mt-0.5 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
                      onClick={() => {
                        setShowIntakePanel((v) => !v)
                        closeContextMenu()
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-slate-500" />
                        <span>{showIntakePanel ? 'Hide intake panel' : 'Show intake panel'}</span>
                      </span>
                    </button>
                  )}

                  {!isMultiSelectCardMenu && (
                    <button
                      type="button"
                      className="mt-0.5 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
                      onClick={() => {
                        setShowFiltersPanel((v) => !v)
                        closeContextMenu()
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-slate-500" />
                        <span>{showFiltersPanel ? 'Hide search & filters panel' : 'Show search & filters panel'}</span>
                      </span>
                    </button>
                  )}

                  {!isMultiSelectCardMenu && <div className="my-1 border-t border-border/60" />}

                  <button
                    type="button"
                    className="mt-0.5 w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition-colors hover:bg-rose-50"
                    onClick={() => {
                      openDeleteIdeaDialog(ideaCardContextMenu.idea)
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4 text-rose-500" />
                      <span>Delete idea</span>
                    </span>
                  </button>
                </div>
              </>
            )}

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
                                  {ideaDraftJob.similar_documents.length} related BRDs
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
                                    {item.kind === 'brd' ? 'BRD' : 'Idea'} · {item.title}
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
                            <p className="text-sm font-semibold text-slate-800">Diagram proses dari brainstorming</p>
                            <p className="text-xs text-slate-500">
                              AS-IS / TO-BE yang disepakati ikut tersimpan di draft agar bisa dianalisis di Section Proses.
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
                        </select>
                      </div>

                      <div className="space-y-1.5 sm:col-span-1 lg:col-span-4">
                        <Label htmlFor="idea-reviewer" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          Reviewer <RequiredFieldMark />
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
                                : 'Select workspace member'}
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
                    <Button
                      type="submit"
                      variant="default"
                      disabled={!isCreateIdeaFormValid}
                      className={cn(registerServicePrimaryButtonClass(), 'w-full justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60')}
                    >
                      <Plus className="h-4 w-4 shrink-0" aria-hidden />
                      Create Idea
                    </Button>
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
                          <Button
                            type="button"
                            className={cn(registerServicePrimaryButtonClass(), 'hidden h-9 gap-2 px-3 sm:inline-flex')}
                            disabled={!brainstormReady || isBrainstormSending || isDraftContinuing}
                            onClick={() => void handleContinueIdeaDraft('use_brainstorm')}
                          >
                            <Wand2 className="h-4 w-4 shrink-0" aria-hidden />
                            {isDraftContinuing ? 'Generating…' : 'Generate draft'}
                          </Button>
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

                      <div
                        ref={brainstormScrollRef}
                        className="min-h-0 flex-1 overflow-y-auto"
                      >
                        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
                          {brainstormMessages.length === 0 && !isBrainstormSending ? (
                            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
                              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <Sparkles className="h-6 w-6" aria-hidden />
                              </div>
                              <h4 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                                Brainstorm with Tectona
                              </h4>
                              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                                Share AS-IS context so we can shape a stronger draft. Ask questions, propose options, and fill gaps together.
                              </p>
                            </div>
                          ) : null}

                          {brainstormMessages.map((message, index) => (
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
                                    <p className="text-xs font-medium text-muted-foreground">Tectona Assistant</p>
                                    <BrainstormAssistantMessageBody text={message.text} />
                                  </div>
                                </div>
                              ) : (
                                <div className="max-w-[85%] whitespace-pre-wrap rounded-[1.35rem] bg-muted px-4 py-2.5 text-[15px] leading-7 text-foreground sm:max-w-[75%]">
                                  {message.text}
                                </div>
                              )}
                            </div>
                          ))}

                          {isBrainstormSending && (
                            <div className="flex gap-3">
                              <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Sparkles className="h-4 w-4" aria-hidden />
                              </div>
                              <div className="inline-flex items-center gap-2 py-1 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Thinking…
                              </div>
                            </div>
                          )}

                          {brainstormReady && (
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950">
                              Enough context gathered. You can generate the draft now.
                            </div>
                          )}
                          {!brainstormReady && brainstormRemainingGaps.length > 0 && brainstormMessages.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Exploring next: {brainstormRemainingGaps.slice(0, 3).join(', ')}
                              {brainstormRemainingGaps.length > 3 ? '…' : ''}
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
                                placeholder="Ask Tectona Assistant"
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
                            <Button
                              type="button"
                              className={cn(registerServicePrimaryButtonClass(), 'h-11 w-full justify-center gap-2 sm:hidden')}
                              disabled={!brainstormReady || isBrainstormSending || isDraftContinuing}
                              onClick={() => void handleContinueIdeaDraft('use_brainstorm')}
                            >
                              <Wand2 className="h-4 w-4 shrink-0" aria-hidden />
                              {isDraftContinuing ? 'Generating…' : 'Generate draft'}
                            </Button>
                          )}
                          <p className="px-1 text-center text-[11px] text-muted-foreground">
                            Enter to send · Shift+Enter for new line
                          </p>
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
                        <div className="flex items-center justify-end gap-3 border-t border-border/70 bg-muted/20 px-5 py-4">
                          {!ideaDraftJob.warnings.includes('VAGUE_IDEA_TITLE') && (
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(enterpriseSecondaryButtonClass(), 'min-w-0 basis-0 flex-1 justify-center gap-2')}
                              disabled={isDraftContinuing}
                              onClick={() => void handleContinueIdeaDraft('generate_anyway')}
                            >
                              <Wand2 className="h-4 w-4 shrink-0" aria-hidden />
                              {isDraftContinuing ? 'Continuing…' : 'Generate anyway'}
                            </Button>
                          )}
                          <Button
                            type="button"
                            className={cn(
                              registerServicePrimaryButtonClass(),
                              'min-w-0 justify-center gap-2',
                              ideaDraftJob.warnings.includes('VAGUE_IDEA_TITLE') ? 'w-full' : 'basis-0 flex-1',
                            )}
                            onClick={() => {
                              setBrainstormMessages(ideaDraftJob.brainstorm_messages ?? [])
                              setBrainstormReady(Boolean(ideaDraftJob.brainstorm_ready))
                              setBrainstormRemainingGaps(
                                ideaDraftJob.brainstorm_remaining_gaps
                                ?? ideaDraftJob.evidence_summary.gaps
                                ?? [],
                              )
                              setIsBrainstormMode(true)
                            }}
                          >
                            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
                            {ideaDraftJob.warnings.includes('VAGUE_IDEA_TITLE')
                              ? 'Clarify with Tectona Assistant'
                              : 'Brainstorm with Tectona Assistant'}
                          </Button>
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
          'glass-card rounded-xl p-4 transition-all h-full flex flex-col border border-border/40 cursor-pointer select-none outline-none focus:outline-none',
          (isDragging || (isDragActive && isSelected && draggedIdeaIds.has(idea.id))) && 'opacity-0 pointer-events-none',
          isAnalysisRunning && 'cursor-progress',
          !isSelected && !isDragActive && 'hover:shadow-lg',
          isSelected &&
            !isDragging &&
            !(isDragActive && draggedIdeaIds.has(idea.id)) &&
            'bg-blue-50/45 border-blue-500 shadow-[0_12px_30px_-18px_rgba(37,99,235,0.85)]'
        )}
        style={{
          outline: isSelected ? '2px solid rgba(59,130,246,0.95)' : undefined,
          outlineOffset: isSelected ? '1px' : undefined,
          borderBottom: `4px solid ${typeAccent[idea.type]}`,
        }}
      >
        <div className="flex items-start justify-between gap-2 flex-1 min-h-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-border/50 bg-white/80">
                <GripVertical className="h-3 w-3 text-slate-400" />
              </span>
              <Badge variant="outline" className="text-[10px] font-semibold text-slate-600 bg-white/90">
                {idea.id}
              </Badge>
              <Badge variant="outline" className={cn('text-[10px] font-semibold', statusClass[idea.status])}>
                {idea.status}
              </Badge>
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

        <div className="mt-3 rounded-lg bg-white/60 px-2 py-1.5">
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
          {idea.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-border/50 px-2 py-0.5 text-[11px] text-slate-600 bg-white/80">
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
