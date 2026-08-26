import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowLeftToLine,
  ArrowRightToLine,
  BarChart3,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Filter,
  Gauge,
  Info,
  LayoutGrid,
  PanelLeft,
  Layers3,
  MousePointerClick,
  Pin,
  PlayCircle,
  Copy,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  RotateCcw,
  Ruler,
  Search,
  ShieldCheck,
  Signal,
  Sparkles,
  TrendingUp,
  UnfoldHorizontal,
  Users,
  Webhook,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { PageHeader } from '@/components/layout/PageHeader'
import { useTenantContext } from '@/auth/TenantContext'
import { getDevelopmentAccounts, getSession } from '@/auth/authService'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { enterpriseCyanGradientActionButtonClass } from '@/lib/enterpriseButtonClasses'
import { EnterpriseNavIconRail } from '@/components/enterprise/EnterpriseNavIconRail'
import {
  computeWorkspaceMainPanelViewportHeightPx,
  isWorkspaceNavDocked,
  measureEnterpriseNavHeightFromMainPanel,
  workspaceAsideClass,
  workspaceDockedContentInsetClass,
  workspaceMainColumnClass,
  workspaceMainPanelViewportHeightStyle,
  workspaceNavInnerClass,
  workspaceNavMenuScrollClass,
  workspaceOuterGridClass,
} from '@/lib/workspaceNavLayout'
import { usePreferencesStore } from '@/stores/preferences-store'
import { Select, SelectItem } from '@/components/ui/select'
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu'
import { Switch } from '@/components/ui/switch'
import { DndContext } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { useEnterpriseSortableColumns } from '@/components/enterprise/useEnterpriseSortableColumns'
import { EnterpriseSortableHeaderCell } from '@/components/enterprise/EnterpriseSortableHeaderCell'
import { EnterpriseColumnFilterDropdown } from '@/components/enterprise/EnterpriseColumnFilterDropdown'
import { EnterpriseGroupByControl } from '@/components/enterprise/EnterpriseGroupByControl'
import { EnterpriseSelectionToggle } from '@/components/enterprise/EnterpriseSelectionToggle'
import { EnterpriseColumnVisibilityControl } from '@/components/enterprise/EnterpriseColumnVisibilityControl'
import { EnterpriseColumnWidthModal } from '@/components/enterprise/EnterpriseColumnWidthModal'
import { getEnterpriseGroupTint } from '@/components/enterprise/enterpriseTableGroupTint'
import { WorkflowBuilderCanvas } from '@/modules/workflow-automation-engine/components/WorkflowBuilderCanvas'
import { useToast } from '@/components/ui/toast'
import {
  createWorkflow as apiCreateWorkflow,
  deleteWorkflowApi,
  duplicateWorkflowApi,
  listWorkflows,
  type WorkflowSummaryDto,
} from '@/lib/api/workflowAutomationApi'
import {
  createAutomationRule as apiCreateAutomationRule,
  deleteAutomationRuleApi,
  listAutomationRules,
  updateAutomationRule as apiUpdateAutomationRule,
  type AutomationRuleDto,
  type AutomationRuleTrigger,
} from '@/lib/api/workflowAutomationRulesApi'
import { fetchIdentityUsers, type IdentityUserDto } from '@/lib/api/identityAdminApi'
import { fetchWorkspaceMembers, TECTONA_WAC_APP_ID } from '@/lib/api/workspaceAccessControlApi'
import { isAllWorkspacesSelection } from '@/lib/tenantWorkspaceScope'

type WorkflowStatus = 'Active' | 'Draft' | 'Paused' | 'Needs Approval'
type PanelId = 'overview' | 'catalog' | 'automation' | 'monitoring'

type WorkflowRecord = {
  id: string
  name: string
  project: string
  type: 'Delivery' | 'Governance' | 'Financial' | 'Change' | 'Risk'
  owner: string
  ownerId?: string
  ownerEmail?: string
  status: WorkflowStatus
  trigger: 'Event' | 'Schedule' | 'Manual' | 'Webhook'
  successRate: number
  executions: number
  lastUpdated: string
}

type WorkflowOwnerOption = {
  id: string
  name: string
  email: string
}

const UNASSIGNED_WORKFLOW_OWNER = 'Unassigned'

// ---------------------------------------------------------------------------
// Operational rules: lightweight When / If / Then controls linked to a workflow.
// ---------------------------------------------------------------------------
type AutomationRule = {
  id: string
  name: string
  trigger: WorkflowRecord['trigger']
  condition: string
  action: string
  enabled: boolean
  linkedWorkflowId: string
  triggerCount: number
  lastTriggered: string
  workspaceId?: string | null
  ownerId?: string | null
  ownerName?: string | null
  ownerEmail?: string | null
  triggerEvent: string
}

function mapAutomationRule(dto: AutomationRuleDto): AutomationRule {
  return {
    id: dto.id,
    name: dto.name,
    trigger: dto.trigger,
    triggerEvent: dto.trigger_event,
    condition: String(dto.condition?.summary ?? dto.condition?.field ?? 'Any matching record'),
    action: String(dto.action?.summary ?? dto.action?.type ?? 'Run linked workflow'),
    enabled: dto.enabled,
    linkedWorkflowId: dto.workflow_id ?? '',
    triggerCount: dto.trigger_count,
    lastTriggered: dto.last_triggered ? new Date(dto.last_triggered).toLocaleString() : 'Never',
    workspaceId: dto.workspace_id,
    ownerId: dto.owner_id,
    ownerName: dto.owner_name,
    ownerEmail: dto.owner_email,
  }
}

function normalizeOwnerLookup(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function formatIdentityDisplayName(displayName: string | null | undefined, email: string): string {
  const raw = displayName?.trim() || email.trim()
  const localPart = raw.includes('@') ? raw.split('@')[0] ?? raw : raw
  const shouldHumanize = /[._-]/.test(localPart) || localPart === localPart.toLowerCase()
  if (!shouldHumanize) return raw
  return localPart
    .replace(/[._-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1).toLowerCase()}`)
    .join(' ')
}

function resolveWorkflowOwner(
  candidate: string,
  ownerOptions: WorkflowOwnerOption[],
  fallbackIndex: number,
): WorkflowOwnerOption | null {
  if (ownerOptions.length === 0) return null
  const candidateKey = normalizeOwnerLookup(candidate)
  const matched = ownerOptions.find((owner) => normalizeOwnerLookup(owner.name) === candidateKey || normalizeOwnerLookup(owner.email) === candidateKey)
  return matched ?? ownerOptions[fallbackIndex % ownerOptions.length] ?? null
}

const EXECUTION_TREND = [
  { date: 'May 18', total: 620, success: 560, failure: 60 },
  { date: 'May 19', total: 710, success: 640, failure: 70 },
  { date: 'May 20', total: 775, success: 690, failure: 85 },
  { date: 'May 21', total: 810, success: 735, failure: 75 },
  { date: 'May 22', total: 860, success: 780, failure: 80 },
  { date: 'May 23', total: 920, success: 835, failure: 85 },
  { date: 'May 24', total: 890, success: 810, failure: 80 },
]

const RELIABILITY_TREND = [
  { date: 'May 18', success: 78, retry: 14, failure: 8 },
  { date: 'May 19', success: 80, retry: 13, failure: 7 },
  { date: 'May 20', success: 82, retry: 12, failure: 6 },
  { date: 'May 21', success: 79, retry: 14, failure: 7 },
  { date: 'May 22', success: 84, retry: 11, failure: 5 },
  { date: 'May 23', success: 86, retry: 10, failure: 4 },
  { date: 'May 24', success: 88, retry: 9, failure: 3 },
]

const QUEUE_DEPTH_TREND = [
  { date: 'May 18', pending: 180, waiting: 96, retry: 28 },
  { date: 'May 19', pending: 205, waiting: 108, retry: 24 },
  { date: 'May 20', pending: 232, waiting: 118, retry: 36 },
  { date: 'May 21', pending: 218, waiting: 124, retry: 30 },
  { date: 'May 22', pending: 248, waiting: 128, retry: 32 },
  { date: 'May 23', pending: 236, waiting: 132, retry: 26 },
  { date: 'May 24', pending: 248, waiting: 128, retry: 32 },
]

const FUNNEL_STAGES = [
  { label: 'Triggered', value: 1248, pct: 100, color: '#3b82f6', bottleneck: false },
  { label: 'Validated', value: 1186, pct: 95, color: '#60a5fa', bottleneck: false },
  { label: 'Executing', value: 1004, pct: 80, color: '#22d3ee', bottleneck: false },
  { label: 'Waiting Approval', value: 342, pct: 27, color: '#f59e0b', bottleneck: true },
  { label: 'Completed', value: 912, pct: 73, color: '#34d399', bottleneck: false },
]

const APPROVAL_SLA = [
  { label: 'Within SLA', pct: 84, value: 1024, color: '#10b981' },
  { label: 'Near SLA Breach', pct: 11, value: 134, color: '#f59e0b' },
  { label: 'Breached', pct: 5, value: 62, color: '#ef4444' },
]

const TRIGGER_SOURCES = [
  { label: 'Schedule', pct: 38, value: 123, color: '#3b82f6' },
  { label: 'API', pct: 26, value: 84, color: '#10b981' },
  { label: 'Manual', pct: 18, value: 56, color: '#f59e0b' },
  { label: 'Event Driven', pct: 12, value: 39, color: '#f97316' },
  { label: 'System Event', pct: 6, value: 20, color: '#cbd5e1' },
]

const AUTOMATION_COVERAGE = [
  { name: 'Automated', value: 72, color: '#10b981' },
  { name: 'Manual', value: 28, color: '#e2e8f0' },
]

const AUTOMATION_SPLIT = [
  { label: 'Automated', count: '227 wf', pct: 72, color: '#10b981' },
  { label: 'Manual', count: '89 wf', pct: 28, color: '#94a3b8' },
]

type InsightLevel = 'Critical' | 'Warning' | 'Info'
const AI_INSIGHTS: Array<{ text: string; level: InsightLevel }> = [
  { text: 'Capital approval workflow exceeds SLA by 18%', level: 'Critical' },
  { text: 'Vendor onboarding automation failed 4 times this week', level: 'Warning' },
  { text: 'Sprint escalation workflow shows retry spikes', level: 'Warning' },
  { text: 'Manager approval stage is bottlenecked', level: 'Info' },
]

const PANELS: Array<{ id: PanelId; label: string; icon: React.ComponentType<{ className?: string }>; badge: string; desc: string }> = [
  { id: 'overview', label: 'Execution Overview', icon: Sparkles, badge: 'Command', desc: 'Health, throughput, and KPI summary for workflows.' },
  { id: 'catalog', label: 'Workflow Catalog', icon: Workflow, badge: 'Core', desc: 'Workflow directory with filters and quick actions.' },
  { id: 'automation', label: 'Automation Rules', icon: Bot, badge: 'Rules', desc: 'Trigger, condition, action, and status control.' },
  { id: 'monitoring', label: 'Runtime Monitoring', icon: Activity, badge: 'Runtime', desc: 'Execution, queues, and operational incidents.' },
]

const PANEL_GROUPS: Array<{ group: string; items: typeof PANELS }> = [
  { group: 'Command Center', items: PANELS.filter((panel) => panel.id === 'overview') },
  { group: 'Control Library', items: PANELS.filter((panel) => ['catalog'].includes(panel.id)) },
  { group: 'Assurance & Traceability', items: PANELS.filter((panel) => ['automation', 'monitoring'].includes(panel.id)) },
]

const WORKFLOW_NAV_RAIL_ITEMS = PANELS.map(({ id, label, icon }) => ({ id, label, icon }))

function statusTone(status: WorkflowStatus | 'Failed') {
  if (status === 'Active') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'Failed') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (status === 'Paused' || status === 'Needs Approval') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-slate-200 bg-slate-100 text-slate-700'
}

function statusAccentColor(status: WorkflowStatus | 'Failed'): string {
  if (status === 'Active') return '#10b981'
  if (status === 'Failed') return '#ef4444'
  if (status === 'Paused') return '#f97316'
  if (status === 'Needs Approval') return '#f59e0b'
  return '#94a3b8'
}

const TRIGGER_ICONS: Record<WorkflowRecord['trigger'], React.ComponentType<{ className?: string }>> = {
  Event: Zap,
  Schedule: CalendarClock,
  Manual: MousePointerClick,
  Webhook: Webhook,
}

function successTone(rate: number): string {
  if (rate >= 95) return '#10b981'
  if (rate >= 88) return '#22c55e'
  if (rate >= 80) return '#f59e0b'
  return '#ef4444'
}

// Deterministic per-workflow execution sparkline derived from id + success rate (no RNG).
function workflowSpark(record: WorkflowRecord): number[] {
  const seed = record.id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return Array.from({ length: 7 }, (_, i) => {
    const wave = Math.sin((i + (seed % 5)) / 1.6) * 8
    return Math.max(4, Math.round(record.successRate - 6 + wave + ((seed + i * 7) % 6)))
  })
}

// ---------------------------------------------------------------------------
// Workflow Directory enterprise data-table (mirrors the Workspace / Document
// Repository directory tables: drag-reorder / resize / freeze columns, 3-state
// sort, per-column filters, group-by, selection, column visibility, paging).
// ---------------------------------------------------------------------------
type WorkflowTableColumnKey =
  | 'name'
  | 'type'
  | 'owner'
  | 'trigger'
  | 'status'
  | 'successRate'
  | 'executions'
  | 'lastUpdated'

const WORKFLOW_TABLE_PINNED_FIRST_COLUMN: WorkflowTableColumnKey = 'name'
const WORKFLOW_TABLE_DEFAULT_COLUMN_ORDER: WorkflowTableColumnKey[] = [
  'name',
  'type',
  'owner',
  'trigger',
  'status',
  'successRate',
  'executions',
  'lastUpdated',
]

function workflowTableColumnLabel(key: WorkflowTableColumnKey): string {
  switch (key) {
    case 'name': return 'Workflow'
    case 'type': return 'Type'
    case 'owner': return 'Owner'
    case 'trigger': return 'Trigger'
    case 'status': return 'Status'
    case 'successRate': return 'Success Rate'
    case 'executions': return 'Executions'
    case 'lastUpdated': return 'Updated'
  }
}

function workflowTableColumnHeaderIcon(key: WorkflowTableColumnKey): LucideIcon {
  switch (key) {
    case 'name': return Workflow
    case 'type': return Layers3
    case 'owner': return Users
    case 'trigger': return Zap
    case 'status': return ShieldCheck
    case 'successRate': return Gauge
    case 'executions': return Activity
    case 'lastUpdated': return Clock3
  }
}

const WORKFLOW_TABLE_COLUMN_VISIBILITY_OPTIONS: readonly { key: WorkflowTableColumnKey; label: string }[] =
  WORKFLOW_TABLE_DEFAULT_COLUMN_ORDER.map((key) => ({ key, label: workflowTableColumnLabel(key) }))

type WorkflowTableGroupByKey = 'type' | 'owner' | 'status' | 'trigger'
const WORKFLOW_TABLE_GROUP_BY_OPTIONS: readonly { key: WorkflowTableGroupByKey; label: string }[] = [
  { key: 'type', label: 'Type' },
  { key: 'owner', label: 'Owner' },
  { key: 'status', label: 'Status' },
  { key: 'trigger', label: 'Trigger' },
]

function workflowTableGroupLabel(item: WorkflowRecord, groupBy: WorkflowTableGroupByKey): string {
  if (groupBy === 'type') return item.type
  if (groupBy === 'owner') return item.owner
  if (groupBy === 'status') return item.status
  return item.trigger
}

// Two-word identity display names use first/last initials; single-word names use first two letters.
function ownerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Deterministic per-owner color tone (avatar solid + name pill tint) — mirrors the
// Workspace Directory owner chips where each person gets a distinct colour.
const OWNER_TONES = [
  { avatar: 'bg-orange-500', pill: 'bg-orange-50 text-orange-700 ring-orange-200' },
  { avatar: 'bg-pink-500', pill: 'bg-pink-50 text-pink-700 ring-pink-200' },
  { avatar: 'bg-blue-500', pill: 'bg-blue-50 text-blue-700 ring-blue-200' },
  { avatar: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  { avatar: 'bg-violet-500', pill: 'bg-violet-50 text-violet-700 ring-violet-200' },
  { avatar: 'bg-cyan-500', pill: 'bg-cyan-50 text-cyan-700 ring-cyan-200' },
] as const

function ownerTone(name: string): (typeof OWNER_TONES)[number] {
  const seed = name.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return OWNER_TONES[seed % OWNER_TONES.length]
}

// Slug code shown under the workflow name (e.g. "AI backlog approval" → "AI-BACKLOG-APPROVAL").
function workflowCode(record: WorkflowRecord): string {
  return record.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function Panel({
  title,
  description,
  children,
  className,
  bodyClassName,
  panelRef,
  style,
  headerIcon,
  right,
}: {
  title: string
  description: string
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  panelRef?: RefObject<HTMLElement | null>
  style?: CSSProperties
  headerIcon?: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <section
      ref={panelRef}
      style={style}
      className={cn(
        'rounded-3xl border liquid-glass-enterprise-panel',
        className
      )}
    >
      <div className={cn('flex shrink-0 items-start justify-between gap-4', headerIcon ? 'p-4 pb-0 lg:p-5 lg:pb-0' : 'px-5 py-4')}>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            {headerIcon ? <span className="shrink-0 text-slate-900">{headerIcon}</span> : null}
            <h2 className={cn('min-w-0 font-semibold text-slate-900', headerIcon ? 'text-lg' : 'text-sm')}>{title}</h2>
          </div>
          <p className={cn('text-slate-600', headerIcon ? 'mt-0.5 text-[11px]' : 'mt-1 text-xs')}>{description}</p>
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className={cn(headerIcon ? 'px-4 pb-4 pt-3 lg:px-5 lg:pb-5' : 'p-5', bodyClassName)}>{children}</div>
    </section>
  )
}

// Card chrome mirrors Task & Work Management's "Work Execution Overview" panel
// (OverviewChartPanel): tone icon chip + 2px gradient accent strip + soft glass card.
const OVERVIEW_PANEL_TONES = {
  emerald: { accent: 'from-emerald-300 via-emerald-400 to-teal-400', iconBg: 'bg-emerald-50 ring-1 ring-emerald-100', iconColor: 'text-emerald-500' },
  sky: { accent: 'from-sky-300 via-blue-400 to-indigo-400', iconBg: 'bg-sky-50 ring-1 ring-sky-100', iconColor: 'text-sky-500' },
  violet: { accent: 'from-indigo-300 via-violet-400 to-fuchsia-400', iconBg: 'bg-violet-50 ring-1 ring-violet-100', iconColor: 'text-violet-500' },
  amber: { accent: 'from-amber-300 via-orange-400 to-rose-400', iconBg: 'bg-amber-50 ring-1 ring-amber-100', iconColor: 'text-amber-500' },
  rose: { accent: 'from-rose-300 via-pink-400 to-red-400', iconBg: 'bg-rose-50 ring-1 ring-rose-100', iconColor: 'text-rose-500' },
  cyan: { accent: 'from-cyan-300 via-sky-400 to-blue-400', iconBg: 'bg-cyan-50 ring-1 ring-cyan-100', iconColor: 'text-cyan-500' },
  indigo: { accent: 'from-indigo-300 via-blue-400 to-violet-400', iconBg: 'bg-indigo-50 ring-1 ring-indigo-100', iconColor: 'text-indigo-500' },
} as const
type OverviewTone = keyof typeof OVERVIEW_PANEL_TONES

function OverviewCard({
  title,
  description,
  icon: Icon,
  tone,
  headerRight,
  footer,
  children,
  className,
}: {
  title: string
  description?: string
  icon: React.ComponentType<{ className?: string }>
  tone: OverviewTone
  headerRight?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const t = OVERVIEW_PANEL_TONES[tone]
  return (
    <section
      className={cn(
        'relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-[linear-gradient(160deg,rgba(255,255,255,0.94),rgba(248,250,252,0.90))] p-5 shadow-[0_12px_34px_rgba(15,23,42,0.08)]',
        className
      )}
    >
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-gradient-to-r opacity-85', t.accent)} />
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', t.iconBg)}>
              <Icon className={cn('h-4 w-4', t.iconColor)} />
            </span>
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          </div>
          {description ? <p className="mt-1 text-xs text-slate-600">{description}</p> : null}
        </div>
        {headerRight}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      {footer ? <div className="mt-4 border-t border-slate-100 pt-3">{footer}</div> : null}
    </section>
  )
}

function CardMetric({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'emerald' | 'amber' | 'rose' | 'sky' }) {
  const toneClass =
    tone === 'emerald' ? 'text-emerald-600'
    : tone === 'amber' ? 'text-amber-600'
    : tone === 'rose' ? 'text-rose-600'
    : tone === 'sky' ? 'text-sky-600'
    : 'text-slate-900'
  return (
    <div>
      <div className={cn('text-lg font-bold leading-none tabular-nums', toneClass)}>{value}</div>
      <div className="mt-1 text-[11px] text-slate-500">{label}</div>
    </div>
  )
}

function ChartLegend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

function insightTone(level: InsightLevel) {
  if (level === 'Critical') return { badge: 'border-rose-200 bg-rose-50 text-rose-700', icon: 'text-rose-500', Icon: AlertTriangle }
  if (level === 'Warning') return { badge: 'border-amber-200 bg-amber-50 text-amber-700', icon: 'text-amber-500', Icon: AlertTriangle }
  return { badge: 'border-sky-200 bg-sky-50 text-sky-700', icon: 'text-sky-500', Icon: Info }
}

// Donut + legend rows with progress bars — mirrors Task & Work Management's OverviewDonut:
// glow halo, white inner disc, floating center pill, and bordered legend rows with mini bars.
function WorkflowDonut({
  data,
  centerValue,
  centerLabel,
}: {
  data: Array<{ label: string; value: number; pct: number; color: string }>
  centerValue: string
  centerLabel: string
}) {
  const idBase = centerLabel.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="grid items-center gap-5 lg:grid-cols-[180px,1fr]">
      <div className="relative mx-auto h-44 w-44 shrink-0">
        <div
          className="pointer-events-none absolute -inset-5 rounded-full"
          style={{ background: 'radial-gradient(ellipse 80% 80% at 50% 50%, rgba(99,102,241,0.16) 0%, rgba(14,165,233,0.10) 44%, transparent 70%)', filter: 'blur(6px)' }}
        />
        <div
          className="pointer-events-none absolute -inset-3 rounded-full"
          style={{ background: 'conic-gradient(from 220deg, rgba(99,102,241,0.15), rgba(14,165,233,0.11), rgba(16,185,129,0.13), rgba(99,102,241,0.15))', filter: 'blur(1px)' }}
        />
        <div className="pointer-events-none absolute inset-2 rounded-full border border-white/90 bg-gradient-to-br from-white/95 via-slate-50/95 to-slate-100/85 shadow-[0_14px_32px_rgba(15,23,42,0.10)]" />
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                {data.map((entry, index) => (
                  <linearGradient key={entry.label} id={`${idBase}-seg-${index}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                    <stop offset="100%" stopColor={entry.color} stopOpacity={0.8} />
                  </linearGradient>
                ))}
              </defs>
              <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={48} outerRadius={70} cornerRadius={6} paddingAngle={2.5} stroke="white" strokeWidth={1.5} isAnimationActive={false}>
                {data.map((entry, index) => (
                  <Cell key={entry.label} fill={`url(#${idBase}-seg-${index})`} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl border border-white/90 px-3 py-1.5 text-center backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.88)', boxShadow: '0 8px 22px rgba(15,23,42,0.10)' }}>
            <div className="text-2xl font-bold leading-none tracking-tight text-slate-900">{centerValue}</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{centerLabel}</div>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {data.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200/90 bg-white/80 px-3 py-2 transition-all duration-200 hover:border-slate-300 hover:bg-white">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                <span className="text-sm font-medium text-slate-700">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tabular-nums text-slate-900">{item.value}</span>
                <span className="w-10 text-right text-xs font-semibold" style={{ color: item.color }}>{item.pct}%</span>
              </div>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.pct}%`, background: `linear-gradient(90deg, ${item.color}, ${item.color}bb)` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function kpiCardChrome(cardId: string): string {
  const base =
    'rounded-2xl p-4 transition-all duration-200 relative overflow-hidden group border border-white/40 ring-1 ring-black/[0.04] shadow-[0_14px_40px_rgba(15,23,42,0.10)] hover:-translate-y-0.5 hover:shadow-[0_18px_56px_rgba(15,23,42,0.14)]'

  if (cardId === 'total') return cn(base, 'bg-gradient-to-br from-slate-50/85 via-white/90 to-sky-50/75')
  if (cardId === 'active') return cn(base, 'bg-gradient-to-br from-emerald-50/70 via-white/90 to-cyan-50/70')
  if (cardId === 'approval') return cn(base, 'bg-gradient-to-br from-amber-50/70 via-white/90 to-orange-50/70')
  if (cardId === 'paused') return cn(base, 'bg-gradient-to-br from-rose-50/70 via-white/90 to-yellow-50/70')
  if (cardId === 'success') return cn(base, 'bg-gradient-to-br from-indigo-50/70 via-white/90 to-violet-50/70')
  return cn(base, 'bg-gradient-to-br from-cyan-50/70 via-white/90 to-blue-50/70')
}

function KpiSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((value, index) => ({ idx: index, value }))
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={`workflow-kpi-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={color} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.8} fill={`url(#workflow-kpi-${color.replace('#', '')})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Map a backend workflow DTO (snake_case) to the UI's WorkflowRecord shape. */
function mapWorkflowDto(dto: WorkflowSummaryDto, ownerOptions: WorkflowOwnerOption[] = []): WorkflowRecord {
  const owner = resolveWorkflowOwner(dto.owner, ownerOptions, -1)
  return {
    id: dto.id,
    name: dto.name,
    project: dto.category,
    type: dto.category as WorkflowRecord['type'],
    owner: owner?.name ?? UNASSIGNED_WORKFLOW_OWNER,
    ownerId: owner?.id,
    ownerEmail: owner?.email,
    status: dto.status as WorkflowRecord['status'],
    trigger: dto.trigger,
    successRate: dto.success_rate,
    executions: dto.executions,
    lastUpdated: dto.last_updated,
  }
}

export function WorkflowAutomationEnginePage() {
  const { addToast } = useToast()
  const { workspaceId, selectedWorkspaceIds } = useTenantContext()
  const sidebarFixed = usePreferencesStore((s) => s.preferences.sidebarFixed ?? false)
  const sidebarMini = usePreferencesStore((s) => s.preferences.sidebarMini ?? true)
  const navDocked = isWorkspaceNavDocked(sidebarFixed)
  const enterpriseNavTitlesOnly = usePreferencesStore((s) => s.preferences.enterpriseNavTitlesOnly ?? false)
  const enterpriseNavSimpleList = usePreferencesStore((s) => s.preferences.enterpriseNavSimpleList ?? false)
  const enterpriseNavCompact = enterpriseNavTitlesOnly || enterpriseNavSimpleList
  const fixedSidebarUiOn = !sidebarFixed
  const enterpriseNavUltra = fixedSidebarUiOn && sidebarMini && enterpriseNavTitlesOnly && enterpriseNavSimpleList
  const enterpriseNavWidthVariant = enterpriseNavUltra ? 'ultra' : enterpriseNavCompact ? 'compact' : 'default'
  // Match Document & Knowledge Management: 260px panel width without forcing compact nav content.
  const enterpriseNavLayoutVariant = enterpriseNavWidthVariant === 'default' ? 'compact' : enterpriseNavWidthVariant

  const [activePanel, setActivePanel] = useState<PanelId>('overview')
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const [builder, setBuilder] = useState<{ open: boolean; workflowId: string | null }>({ open: false, workflowId: null })
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([])
  const [workflowCatalogState, setWorkflowCatalogState] = useState<'loading' | 'backend' | 'error'>('loading')
  const workflowOwnerOptionsRef = useRef<WorkflowOwnerOption[]>([])
  const [workflowOwnerOptions, setWorkflowOwnerOptions] = useState<WorkflowOwnerOption[]>([])
  const [rowMenu, setRowMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([])
  const [automationRulesState, setAutomationRulesState] = useState<'loading' | 'backend' | 'error'>('loading')
  const [ruleSearch, setRuleSearch] = useState('')
  const [ruleMenu, setRuleMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [ruleEditor, setRuleEditor] = useState<{
    id: string
    name: string
    trigger: AutomationRuleTrigger
    triggerEvent: string
    condition: string
    action: string
    linkedWorkflowId: string
    ownerId: string
  } | null>(null)

  // Owners come from active Identity Lite users, narrowed to the active workspace
  // memberships when a workspace scope is selected. No synthetic owner names.
  useEffect(() => {
    let cancelled = false

    const loadCatalogAndOwners = async () => {
      setWorkflowCatalogState('loading')
      const activeWorkspaceIds = isAllWorkspacesSelection(workspaceId)
        ? selectedWorkspaceIds
        : workspaceId
          ? [workspaceId]
          : []
      let identityUsers: IdentityUserDto[] = []
      try {
        const response = await fetchIdentityUsers({ limit: 500 })
        identityUsers = response.items
      } catch {
        // Identity Lite may be unavailable during offline UI development.
      }

      let memberSubjectIds = new Set<string>()
      if (activeWorkspaceIds.length > 0) {
        const memberResponses = await Promise.allSettled(
          activeWorkspaceIds.map((id) => fetchWorkspaceMembers(TECTONA_WAC_APP_ID, id)),
        )
        memberSubjectIds = new Set(
          memberResponses.flatMap((result) => result.status === 'fulfilled' ? result.value.items.map((member) => member.subject_id) : []),
        )
      }

      const excludedIdentityStatuses = new Set(['deleted', 'disabled', 'deactivated', 'inactive'])
      const hasCompleteIdentityDirectory = identityUsers.length > 1 || !import.meta.env.DEV
      const identitySource = hasCompleteIdentityDirectory
        ? identityUsers
        : [
            ...identityUsers,
            ...getDevelopmentAccounts().map((account) => ({
              id: `dev-identity:${account.email}`,
              email: account.email,
              display_name: account.name,
              status_code: 'active',
            } satisfies IdentityUserDto)),
          ]
      const candidates = identitySource.filter((user) => {
        if (excludedIdentityStatuses.has(user.status_code.trim().toLowerCase())) return false
        return !hasCompleteIdentityDirectory || memberSubjectIds.size === 0 || memberSubjectIds.has(user.id)
      })
      const ownersById = new Map<string, WorkflowOwnerOption>()
      const ownerEmails = new Set<string>()
      candidates.forEach((user) => {
        const name = formatIdentityDisplayName(user.display_name, user.email)
        const email = user.email.trim().toLowerCase()
        if (!name || !email || ownersById.has(user.id) || ownerEmails.has(email)) return
        ownersById.set(user.id, { id: user.id, name, email: user.email.trim() })
        ownerEmails.add(email)
      })

      const currentUser = getSession()?.user
      if (currentUser?.id && !ownersById.has(currentUser.id) && !ownerEmails.has(currentUser.email.trim().toLowerCase())) {
        ownersById.set(currentUser.id, {
          id: currentUser.id,
          name: formatIdentityDisplayName(currentUser.name, currentUser.email),
          email: currentUser.email,
        })
        ownerEmails.add(currentUser.email.trim().toLowerCase())
      }

      const ownerOptions = Array.from(ownersById.values())
      if (cancelled) return
      workflowOwnerOptionsRef.current = ownerOptions
      setWorkflowOwnerOptions(ownerOptions)

      try {
        const rows = await listWorkflows(isAllWorkspacesSelection(workspaceId) ? undefined : workspaceId ?? undefined)
        if (cancelled) return
        setWorkflows(rows.map((row) => mapWorkflowDto(row, ownerOptions)))
        setWorkflowCatalogState('backend')
      } catch {
        if (!cancelled) {
          setWorkflows([])
          setWorkflowCatalogState('error')
        }
      }
    }

    void loadCatalogAndOwners()
    return () => {
      cancelled = true
    }
  }, [selectedWorkspaceIds, workspaceId])

  useEffect(() => {
    let cancelled = false
    listAutomationRules(isAllWorkspacesSelection(workspaceId) ? undefined : workspaceId ?? undefined)
      .then((rows) => {
        if (!cancelled) {
          setAutomationRules(rows.map(mapAutomationRule))
          setAutomationRulesState('backend')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAutomationRules([])
          setAutomationRulesState('error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [workspaceId])
  // The filters/search card is always visible now — its show/hide toggle button was removed.
  const showFiltersPanel = true
  const [showKpiCards, setShowKpiCards] = useState(true)
  const [showEnterpriseNav, setShowEnterpriseNav] = useState(true)
  const navPanelRef = useRef<HTMLDivElement | null>(null)
  const activeMainPanelRef = useRef<HTMLElement | null>(null)
  const filterCardRef = useRef<HTMLDivElement | null>(null)
  const [navPanelHeightPx, setNavPanelHeightPx] = useState<number | null>(null)
  const [mainPanelViewportHeightPx, setMainPanelViewportHeightPx] = useState<number | null>(null)
  const isOverviewSectionActive = activePanel === 'overview'
  const isHeightManagedSectionActive =
    activePanel === 'overview'
    || activePanel === 'catalog'
    || activePanel === 'automation'
    || activePanel === 'monitoring'

  useLayoutEffect(() => {
    if (!isHeightManagedSectionActive) {
      const raf = window.requestAnimationFrame(() => setMainPanelViewportHeightPx(null))
      return () => window.cancelAnimationFrame(raf)
    }

    const compute = () => {
      const el = activeMainPanelRef.current
      if (!el) return
      // Same formula as Task & Work Management's directory panel (no compensation for the
      // filter card's height) — measuring the panel's own top keeps both panels' computed
      // height/limit consistent as long as their filter-card structures are alike.
      setMainPanelViewportHeightPx(computeWorkspaceMainPanelViewportHeightPx(el.getBoundingClientRect().top))
    }

    compute()
    const raf = window.requestAnimationFrame(() => {
      compute()
      window.requestAnimationFrame(compute)
    })
    const t1 = window.setTimeout(compute, 80)
    const t2 = window.setTimeout(compute, 360)
    window.addEventListener('resize', compute, { passive: true })

    const ro = new ResizeObserver(compute)
    if (activeMainPanelRef.current) ro.observe(activeMainPanelRef.current)
    if (navPanelRef.current) ro.observe(navPanelRef.current)
    if (filterCardRef.current) ro.observe(filterCardRef.current)

    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('resize', compute)
      ro.disconnect()
    }
  }, [isHeightManagedSectionActive, activePanel, isWorkspaceCollapsed, showFiltersPanel, showKpiCards, sidebarFixed])

  useLayoutEffect(() => {
    if (navDocked) {
      const raf = window.requestAnimationFrame(() => setNavPanelHeightPx(null))
      return () => window.cancelAnimationFrame(raf)
    }

    const compute = () => {
      const navEl = navPanelRef.current
      if (!navEl) return

      const mainPanelEl = activeMainPanelRef.current
      const viewportCap = computeWorkspaceMainPanelViewportHeightPx(navEl.getBoundingClientRect().top)

      if (mainPanelEl) {
        const aligned = measureEnterpriseNavHeightFromMainPanel(navEl, mainPanelEl)
        setNavPanelHeightPx(Math.min(aligned, viewportCap))
        return
      }

      setNavPanelHeightPx(viewportCap)
    }

    compute()
    const raf = window.requestAnimationFrame(() => {
      compute()
      window.requestAnimationFrame(compute)
    })
    const t1 = window.setTimeout(compute, 80)
    const t2 = window.setTimeout(compute, 360)
    window.addEventListener('resize', compute, { passive: true })

    const ro = new ResizeObserver(compute)
    if (navPanelRef.current) ro.observe(navPanelRef.current)
    if (activeMainPanelRef.current) ro.observe(activeMainPanelRef.current)

    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('resize', compute)
      ro.disconnect()
    }
  }, [
    isHeightManagedSectionActive,
    activePanel,
    isWorkspaceCollapsed,
    mainPanelViewportHeightPx,
    navDocked,
    showKpiCards,
    showFiltersPanel,
    sidebarFixed,
  ])

  const filtered = useMemo(() => {
    return workflows.filter((item) => {
      const matchesSearch =
        search.length === 0 ||
        [item.name, item.id, item.project, item.owner, item.type, item.trigger].join(' ').toLowerCase().includes(search.toLowerCase())
      return matchesSearch
    })
  }, [search, workflows])
  // KPI cards and all catalog views use the complete backend response. Search is
  // only a presentation filter and must never change the source metrics.
  const overviewWorkflows = workflows

  const summary = useMemo(() => {
    const active = overviewWorkflows.filter((item) => item.status === 'Active').length
    const paused = overviewWorkflows.filter((item) => item.status === 'Paused').length
    const needsApproval = overviewWorkflows.filter((item) => item.status === 'Needs Approval').length
    const avgSuccess = overviewWorkflows.length === 0 ? 0 : Math.round(overviewWorkflows.reduce((sum, item) => sum + item.successRate, 0) / overviewWorkflows.length)
    const executions = overviewWorkflows.reduce((sum, item) => sum + item.executions, 0)
    return { total: overviewWorkflows.length, active, paused, needsApproval, avgSuccess, executions }
  }, [overviewWorkflows])

  const filteredAutomationRules = useMemo(() => {
    const q = ruleSearch.trim().toLowerCase()
    if (!q) return automationRules
    return automationRules.filter((rule) =>
      [rule.name, rule.trigger, rule.condition, rule.action].join(' ').toLowerCase().includes(q),
    )
  }, [automationRules, ruleSearch])

  const automationRuleGroups = useMemo(() => {
    const groups = new Map<string, AutomationRule[]>()
    filteredAutomationRules.forEach((rule) => {
      const group = rule.trigger === 'Webhook' ? 'Integration & Webhook' : /approval/i.test(`${rule.name} ${rule.condition}`) ? 'Approval & Governance' : /risk|sla|overdue|delay/i.test(`${rule.name} ${rule.condition}`) ? 'Risk & SLA' : 'Project Delivery'
      groups.set(group, [...(groups.get(group) ?? []), rule])
    })
    return Array.from(groups.entries())
  }, [filteredAutomationRules])

  const toggleAutomationRule = useCallback((id: string) => {
    const source = automationRules.find((rule) => rule.id === id)
    if (!source) return
    const enabled = !source.enabled
    setAutomationRules((current) => current.map((r) => (r.id === id ? { ...r, enabled } : r)))
    void apiUpdateAutomationRule(id, { enabled }).catch(() => {
      setAutomationRules((current) => current.map((r) => (r.id === id ? { ...r, enabled: !enabled } : r)))
      addToast({ variant: 'error', title: 'Rule update failed', description: 'The backend did not save this status change.' })
    })
  }, [addToast, automationRules])

  const duplicateAutomationRule = useCallback((id: string) => {
    const source = automationRules.find((rule) => rule.id === id)
    if (!source) return
    void apiCreateAutomationRule({
      name: `${source.name} (Copy)`, trigger: source.trigger as AutomationRuleTrigger, trigger_event: source.triggerEvent,
      workspace_id: source.workspaceId ?? (isAllWorkspacesSelection(workspaceId) ? undefined : workspaceId),
      owner_id: source.ownerId, owner_name: source.ownerName, owner_email: source.ownerEmail,
      condition: { summary: source.condition }, action: { summary: source.action }, workflow_id: source.linkedWorkflowId || undefined, enabled: false,
    }).then((created) => setAutomationRules((current) => [mapAutomationRule(created), ...current]))
      .catch(() => addToast({ variant: 'error', title: 'Rule duplication failed', description: 'The backend did not create the copy.' }))
  }, [addToast, automationRules, workspaceId])

  const deleteAutomationRule = useCallback((id: string) => {
    const previous = automationRules
    setAutomationRules((current) => current.filter((r) => r.id !== id))
    void deleteAutomationRuleApi(id).catch(() => {
      setAutomationRules(previous)
      addToast({ variant: 'error', title: 'Rule deletion failed', description: 'The backend did not delete this rule.' })
    })
  }, [addToast, automationRules])

  const createAutomationRule = useCallback(() => {
    void apiCreateAutomationRule({
      name: 'Untitled operational rule', trigger: 'Event', trigger_event: 'approval.completed',
      workspace_id: isAllWorkspacesSelection(workspaceId) ? undefined : workspaceId,
      condition: { summary: 'Any matching record' }, action: { summary: 'Run linked workflow' },
      workflow_id: workflows[0]?.id, enabled: false,
    }).then((created) => {
      setAutomationRules((current) => [mapAutomationRule(created), ...current])
      addToast({ variant: 'success', title: 'Rule created', description: 'Configure the new rule before enabling it.' })
    }).catch(() => addToast({ variant: 'error', title: 'Rule creation failed', description: 'The backend did not create this rule.' }))
  }, [addToast, workflows, workspaceId])

  const openAutomationRuleEditor = useCallback((rule: AutomationRule) => {
    setRuleEditor({ id: rule.id, name: rule.name, trigger: rule.trigger as AutomationRuleTrigger, triggerEvent: rule.triggerEvent, condition: rule.condition, action: rule.action, linkedWorkflowId: rule.linkedWorkflowId, ownerId: rule.ownerId ?? '' })
    setRuleMenu(null)
  }, [])

  const saveAutomationRuleEditor = useCallback(() => {
    if (!ruleEditor) return
    const owner = workflowOwnerOptions.find((item) => item.id === ruleEditor.ownerId)
    void apiUpdateAutomationRule(ruleEditor.id, {
      name: ruleEditor.name.trim() || 'Untitled operational rule', trigger: ruleEditor.trigger, trigger_event: ruleEditor.triggerEvent,
      condition: { summary: ruleEditor.condition.trim() || 'Any matching record' }, action: { summary: ruleEditor.action.trim() || 'Run linked workflow' },
      workflow_id: ruleEditor.linkedWorkflowId || undefined, owner_id: owner?.id, owner_name: owner?.name, owner_email: owner?.email,
    }).then((updated) => {
      setAutomationRules((current) => current.map((rule) => rule.id === updated.id ? mapAutomationRule(updated) : rule))
      setRuleEditor(null)
      addToast({ variant: 'success', title: 'Rule saved' })
    }).catch(() => addToast({ variant: 'error', title: 'Rule save failed', description: 'The backend did not save these changes.' }))
  }, [addToast, ruleEditor, workflowOwnerOptions])

  const catalogSnapshotRows = useMemo(
    () => workflows.map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      project: workflow.project,
      category: workflow.type,
      trigger: workflow.trigger,
      status: workflow.status,
      lastExecution: workflow.lastUpdated,
      owner: workflow.owner,
    })),
    [workflows],
  )

  // --- Workflow Directory enterprise table state ---------------------------
  const [workflowTableSort, setWorkflowTableSort] = useState<{ key: WorkflowTableColumnKey; dir: 'asc' | 'desc' } | null>(null)
  const [workflowTableGroupBy, setWorkflowTableGroupBy] = useState<WorkflowTableGroupByKey | null>(null)
  const [showWorkflowTableSelection, setShowWorkflowTableSelection] = useState(false)
  const [workflowTableSelectedIds, setWorkflowTableSelectedIds] = useState<string[]>([])

  const insertCopyLocally = useCallback((id: string) => {
    setWorkflows((current) => {
      const index = current.findIndex((item) => item.id === id)
      if (index === -1) return current
      const source = current[index]
      const copy: WorkflowRecord = {
        ...source,
        id: `wf-copy-${Math.random().toString(36).slice(2, 8)}`,
        name: `${source.name} (Copy)`,
        status: 'Draft',
        executions: 0,
        lastUpdated: 'Just now',
      }
      const next = [...current]
      next.splice(index + 1, 0, copy)
      return next
    })
  }, [])

  const duplicateWorkflow = useCallback(
    (id: string) => {
      duplicateWorkflowApi(id)
        .then((created) => {
          setWorkflows((current) => {
            const index = current.findIndex((item) => item.id === id)
            const next = [...current]
            next.splice(index === -1 ? next.length : index + 1, 0, mapWorkflowDto(created, workflowOwnerOptionsRef.current, index + 1))
            return next
          })
          addToast({ variant: 'success', title: 'Workflow duplicated', description: created.name })
        })
        .catch(() => {
          // Offline fallback: duplicate locally so the prototype keeps working.
          insertCopyLocally(id)
          addToast({ variant: 'warning', title: 'Duplicated locally', description: 'Backend unavailable — change is not saved.' })
        })
    },
    [addToast, insertCopyLocally],
  )

  const deleteWorkflow = useCallback(
    (id: string) => {
      // Optimistic removal from the UI.
      setWorkflows((current) => current.filter((item) => item.id !== id))
      setWorkflowTableSelectedIds((current) => current.filter((sid) => sid !== id))
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(`tectona.workflow-builder.${id}`)
        } catch {
          // ignore — prototype persistence only
        }
      }
      deleteWorkflowApi(id)
        .then(() => addToast({ variant: 'success', title: 'Workflow deleted' }))
        .catch(() => addToast({ variant: 'warning', title: 'Deleted locally', description: 'Backend unavailable — change is not saved.' }))
    },
    [addToast],
  )

  const createWorkflow = useCallback(() => {
    apiCreateWorkflow({ name: 'Untitled Workflow' })
      .then((created) => {
        setWorkflows((current) => [mapWorkflowDto(created, workflowOwnerOptionsRef.current, 0), ...current])
        setBuilder({ open: true, workflowId: created.id })
      })
      .catch(() => {
        // Offline fallback: open the builder in local "new" mode.
        setBuilder({ open: true, workflowId: null })
        addToast({ variant: 'warning', title: 'Offline mode', description: 'Backend unavailable — new workflow will be saved locally.' })
      })
  }, [addToast])
  const [workflowPage, setWorkflowPage] = useState(1)
  const [workflowPageSize, setWorkflowPageSize] = useState(10)
  const [workflowFilterType, setWorkflowFilterType] = useState<Set<string>>(new Set())
  const [workflowFilterOwner, setWorkflowFilterOwner] = useState<Set<string>>(new Set())
  const [workflowFilterStatus, setWorkflowFilterStatus] = useState<Set<string>>(new Set())
  const [workflowFilterTrigger, setWorkflowFilterTrigger] = useState<Set<string>>(new Set())

  const toggleWorkflowFilterValue = useCallback(
    (setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) => {
      setter((prev) => {
        const next = new Set(prev)
        if (next.has(value)) next.delete(value)
        else next.add(value)
        return next
      })
    },
    [],
  )

  const buildFilterOptions = useCallback(
    (accessor: (item: WorkflowRecord) => string) => {
      const counts = new Map<string, number>()
      filtered.forEach((item) => {
        const value = accessor(item)
        counts.set(value, (counts.get(value) ?? 0) + 1)
      })
      return Array.from(counts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([value, count]) => ({ value, count }))
    },
    [filtered],
  )

  const workflowTypeFilterOptions = useMemo(() => buildFilterOptions((item) => item.type), [buildFilterOptions])
  const workflowOwnerFilterOptions = useMemo(() => buildFilterOptions((item) => item.owner), [buildFilterOptions])
  const workflowStatusFilterOptions = useMemo(() => buildFilterOptions((item) => item.status), [buildFilterOptions])
  const workflowTriggerFilterOptions = useMemo(() => buildFilterOptions((item) => item.trigger), [buildFilterOptions])

  const columnFilteredWorkflows = useMemo(() => {
    return filtered.filter((item) => {
      if (workflowFilterType.size > 0 && !workflowFilterType.has(item.type)) return false
      if (workflowFilterOwner.size > 0 && !workflowFilterOwner.has(item.owner)) return false
      if (workflowFilterStatus.size > 0 && !workflowFilterStatus.has(item.status)) return false
      if (workflowFilterTrigger.size > 0 && !workflowFilterTrigger.has(item.trigger)) return false
      return true
    })
  }, [filtered, workflowFilterType, workflowFilterOwner, workflowFilterStatus, workflowFilterTrigger])

  const toggleWorkflowTableSort = useCallback((key: WorkflowTableColumnKey) => {
    setWorkflowTableSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }, [])

  const sortedWorkflows = useMemo(() => {
    if (!workflowTableSort) return columnFilteredWorkflows
    const { key, dir } = workflowTableSort
    const mul = dir === 'asc' ? 1 : -1
    const valueByKey = (item: WorkflowRecord): string | number => {
      switch (key) {
        case 'name': return item.name
        case 'type': return item.type
        case 'owner': return item.owner
        case 'trigger': return item.trigger
        case 'status': return item.status
        case 'successRate': return item.successRate
        case 'executions': return item.executions
        case 'lastUpdated': return item.lastUpdated
      }
    }
    return [...columnFilteredWorkflows].sort((a, b) => {
      const left = valueByKey(a)
      const right = valueByKey(b)
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * mul
      return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' }) * mul
    })
  }, [columnFilteredWorkflows, workflowTableSort])

  const workflowFlatRows = useMemo(() => {
    if (workflowTableGroupBy) {
      const grouped = [...sortedWorkflows].sort((a, b) =>
        workflowTableGroupLabel(a, workflowTableGroupBy).localeCompare(
          workflowTableGroupLabel(b, workflowTableGroupBy),
          undefined,
          { sensitivity: 'base' },
        ),
      )
      return grouped.map((item) => ({ item, groupLabel: workflowTableGroupLabel(item, workflowTableGroupBy) }))
    }
    return sortedWorkflows.map((item) => ({ item, groupLabel: null as string | null }))
  }, [sortedWorkflows, workflowTableGroupBy])

  const workflowTotalPages = Math.max(1, Math.ceil(workflowFlatRows.length / workflowPageSize))
  const workflowPageSafe = Math.min(workflowPage, workflowTotalPages)
  const workflowStart = workflowFlatRows.length === 0 ? 0 : (workflowPageSafe - 1) * workflowPageSize + 1
  const workflowEnd = Math.min(workflowFlatRows.length, workflowPageSafe * workflowPageSize)
  const pagedWorkflowRows = workflowFlatRows.slice(workflowStart === 0 ? 0 : workflowStart - 1, workflowEnd)

  // Extract `tableRef` via rest-destructuring so the remaining `workflowTableColumns` object holds no
  // ref value — otherwise the react-hooks/refs rule flags every `.member` access as a ref read during
  // render. The ref is used only where refs are allowed (the `ref=` prop and event handlers).
  const { tableRef: workflowTableRef, ...workflowTableColumns } = useEnterpriseSortableColumns<WorkflowTableColumnKey>({
    initialOrder: WORKFLOW_TABLE_DEFAULT_COLUMN_ORDER,
    pinnedFirstKey: WORKFLOW_TABLE_PINNED_FIRST_COLUMN,
    hasSelectionColumn: showWorkflowTableSelection,
    onColumnHidden: (key) => {
      if (workflowTableGroupBy && (key as string) === workflowTableGroupBy) setWorkflowTableGroupBy(null)
    },
  })

  const toggleWorkflowTableRowSelection = useCallback((id: string) => {
    setWorkflowTableSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const setShowWorkflowTableSelectionSafe = useCallback((checked: boolean) => {
    setShowWorkflowTableSelection(checked)
    if (!checked) setWorkflowTableSelectedIds([])
  }, [])

  const renderWorkflowTableCell = (item: WorkflowRecord, key: WorkflowTableColumnKey) => {
    switch (key) {
      case 'name':
        return (
          <div className="min-w-0">
            <div className="truncate font-semibold text-slate-900">{item.name}</div>
            <div className="mt-0.5 truncate text-[10px] text-slate-500" title={item.project}>{item.project}</div>
            <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-slate-400">{workflowCode(item)}</div>
          </div>
        )
      case 'type':
        return <span className="text-slate-600">{item.type}</span>
      case 'owner': {
        const tone = ownerTone(item.owner)
        return (
          <span className="inline-flex items-center gap-2">
            <span className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white', tone.avatar)}>
              {ownerInitials(item.owner)}
            </span>
            <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1', tone.pill)}>{item.owner}</span>
          </span>
        )
      }
      case 'trigger': {
        const TriggerIcon = TRIGGER_ICONS[item.trigger]
        return (
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <TriggerIcon className="h-3.5 w-3.5 text-slate-400" /> {item.trigger}
          </span>
        )
      }
      case 'status':
        return <Badge className={cn('rounded-full border', statusTone(item.status))}>{item.status}</Badge>
      case 'successRate':
        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${item.successRate}%`, background: successTone(item.successRate) }} />
            </div>
            <span className="w-8 tabular-nums font-semibold" style={{ color: successTone(item.successRate) }}>{item.successRate}%</span>
          </div>
        )
      case 'executions':
        return (
          <div className="flex items-center gap-2">
            <span className="tabular-nums text-slate-700">{item.executions}</span>
            <div className="h-6 w-16">
              <KpiSparkline data={workflowSpark(item)} color={statusAccentColor(item.status)} />
            </div>
          </div>
        )
      case 'lastUpdated':
        return <span className="text-slate-500">{item.lastUpdated}</span>
    }
  }

  const renderWorkflowFilterSlot = (key: WorkflowTableColumnKey) => {
    switch (key) {
      case 'type':
        return (
          <EnterpriseColumnFilterDropdown
            label="Type"
            ariaLabel="Filter by type"
            options={workflowTypeFilterOptions}
            selected={workflowFilterType}
            onToggleOption={(value) => toggleWorkflowFilterValue(setWorkflowFilterType, value)}
            onShowAll={() => setWorkflowFilterType(new Set())}
          />
        )
      case 'owner':
        return (
          <EnterpriseColumnFilterDropdown
            label="Owner"
            ariaLabel="Filter by owner"
            options={workflowOwnerFilterOptions}
            selected={workflowFilterOwner}
            onToggleOption={(value) => toggleWorkflowFilterValue(setWorkflowFilterOwner, value)}
            onShowAll={() => setWorkflowFilterOwner(new Set())}
          />
        )
      case 'status':
        return (
          <EnterpriseColumnFilterDropdown
            label="Status"
            ariaLabel="Filter by status"
            options={workflowStatusFilterOptions}
            selected={workflowFilterStatus}
            onToggleOption={(value) => toggleWorkflowFilterValue(setWorkflowFilterStatus, value)}
            onShowAll={() => setWorkflowFilterStatus(new Set())}
          />
        )
      case 'trigger':
        return (
          <EnterpriseColumnFilterDropdown
            label="Trigger"
            ariaLabel="Filter by trigger"
            options={workflowTriggerFilterOptions}
            selected={workflowFilterTrigger}
            onToggleOption={(value) => toggleWorkflowFilterValue(setWorkflowFilterTrigger, value)}
            onShowAll={() => setWorkflowFilterTrigger(new Set())}
          />
        )
      default:
        return undefined
    }
  }

  return (
    <div className="min-h-0 space-y-6 pb-0">
      <div className={cn('space-y-6', workspaceDockedContentInsetClass(navDocked, isWorkspaceCollapsed, enterpriseNavLayoutVariant))}>
        <Breadcrumb items={[{ label: 'Workflow & Automation Engine' }]} />

        <PageHeader
          title="Workflow & Automation Engine"
          description="Design workflows, approvals, triggers, and automation with a UI pattern consistent with Task & Work Management"
          right={
            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-1.5 shadow-sm flex-nowrap shrink-0">
              <button
                type="button"
                onClick={() => setShowKpiCards((v) => !v)}
                className={cn(
                  'flex items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-all duration-200 hover:bg-background hover:text-foreground hover:shadow-sm',
                  showKpiCards && 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                )}
                aria-label={showKpiCards ? 'Hide KPI cards' : 'Show KPI cards'}
                title={showKpiCards ? 'Hide KPI cards' : 'Show KPI cards'}
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setShowEnterpriseNav((v) => !v)}
                className={cn(
                  'flex items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-all duration-200 hover:bg-background hover:text-foreground hover:shadow-sm',
                  showEnterpriseNav && 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                )}
                aria-label={showEnterpriseNav ? 'Hide enterprise navigation' : 'Show enterprise navigation'}
                title={showEnterpriseNav ? 'Hide enterprise navigation' : 'Show enterprise navigation'}
              >
                <PanelLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                className="flex items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-all duration-200 hover:bg-background hover:text-foreground hover:shadow-sm"
                aria-label="Export workflow snapshot"
                title="Export workflow snapshot"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          }
        />

        {showKpiCards ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {[
            { id: 'total', label: 'Total Workflows', value: summary.total, icon: Workflow, sparkColor: '#0ea5e9' },
            { id: 'active', label: 'Active', value: summary.active, icon: CheckCircle2, sparkColor: '#10b981' },
            { id: 'approval', label: 'Needs Approval', value: summary.needsApproval, icon: AlertTriangle, sparkColor: '#f59e0b' },
            { id: 'paused', label: 'Paused', value: summary.paused, icon: Clock3, sparkColor: '#f97316' },
            { id: 'success', label: 'Avg Success Rate', value: `${summary.avgSuccess}%`, icon: Zap, sparkColor: '#6366f1' },
            { id: 'executions', label: 'Executions', value: summary.executions, icon: PlayCircle, sparkColor: '#06b6d4' },
          ].map((item) => (
            <button key={item.label} type="button" className="group text-left">
              <Card className={kpiCardChrome(item.id)}>
                <div className="text-xs text-slate-500">{item.label}</div>
                <div className="mt-1 flex items-center gap-3">
                  <div className="shrink-0 text-2xl font-bold leading-none text-slate-950">{item.value}</div>
                  <div className="h-10 min-w-0 flex-1">
                    <KpiSparkline data={[70, 74, 72, 76, 80, 82]} color={item.sparkColor} />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <item.icon className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                    <span className="truncate">Operational indicator</span>
                  </span>
                </div>
              </Card>
            </button>
          ))}
        </div>
        ) : null}

      <div
        className={cn(
          showEnterpriseNav
            ? workspaceOuterGridClass(sidebarFixed, isWorkspaceCollapsed, enterpriseNavLayoutVariant)
            : 'relative w-full min-w-0',
          showEnterpriseNav && sidebarFixed ? 'items-stretch' : undefined
        )}
      >
        {showEnterpriseNav ? (
        <aside className={cn(workspaceAsideClass(navDocked, isWorkspaceCollapsed, enterpriseNavLayoutVariant), sidebarFixed && 'self-stretch')}>
          <div
            ref={navPanelRef}
            className={cn(
              workspaceNavInnerClass(navDocked, sidebarFixed, isWorkspaceCollapsed),
              // Match Document & Knowledge Management Enterprise Navigation corner radius (rounded-2xl).
              'rounded-2xl xl:rounded-r-2xl',
              !navDocked && 'h-full min-h-0 overflow-hidden'
            )}
            style={!navDocked && navPanelHeightPx ? { height: navPanelHeightPx, maxHeight: navPanelHeightPx, minHeight: navPanelHeightPx } : undefined}
            aria-label="Workflow workspace navigation"
          >
            <div className="shrink-0">
              <div className={cn('flex items-center', isWorkspaceCollapsed ? 'mb-2 justify-center' : 'mb-3 justify-between')}>
                {!isWorkspaceCollapsed ? (
                  <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Enterprise Navigation</span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'shrink-0 rounded-xl border border-slate-200/70 bg-white/75 text-slate-600 shadow-sm hover:bg-white hover:text-slate-900',
                    isWorkspaceCollapsed ? 'h-8 w-8 rounded-full' : 'h-9 w-9'
                  )}
                  aria-label={isWorkspaceCollapsed ? 'Expand workflow workspace navigation' : 'Collapse workflow workspace navigation'}
                  title={isWorkspaceCollapsed ? 'Expand workflow workspace navigation' : 'Collapse workflow workspace navigation'}
                  onClick={() => setIsWorkspaceCollapsed((c) => !c)}
                >
                  {isWorkspaceCollapsed ? (
                    <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
                  ) : (
                    <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
                  )}
                </Button>
              </div>

              {!isWorkspaceCollapsed && !enterpriseNavSimpleList ? (
                <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_38%),linear-gradient(160deg,rgba(15,23,42,0.96),rgba(30,41,59,0.94))] p-4 text-white shadow-[0_18px_44px_rgba(15,23,42,0.24)]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-100/80">Workflow Workspace</div>
                  <div className="mt-1.5 text-sm font-semibold leading-snug">Control tower for workflow orchestration, rules, and automation runtime</div>
                </div>
              ) : null}
            </div>

            {isWorkspaceCollapsed ? (
              <div className={cn(workspaceNavMenuScrollClass(), 'pt-0')}>
                <EnterpriseNavIconRail items={WORKFLOW_NAV_RAIL_ITEMS} activeId={activePanel} onSelect={(id) => setActivePanel(id as PanelId)} />
              </div>
            ) : (
              <>
                <div className={workspaceNavMenuScrollClass()}>
                  <div className={cn(enterpriseNavUltra ? 'space-y-1.5' : enterpriseNavCompact ? 'space-y-2' : 'space-y-4')}>
                    {PANEL_GROUPS.map(({ group, items }) => (
                      <div key={group} className="space-y-1.5">
                        {!enterpriseNavCompact ? (
                          <div className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{group}</div>
                        ) : null}
                        {items.map((panel) => {
                          const active = panel.id === activePanel
                          const Icon = panel.icon
                          return (
                            <button
                              key={panel.id}
                              type="button"
                              onClick={() => setActivePanel(panel.id)}
                              className={cn(
                                'group relative flex w-full overflow-hidden border text-left transition-all duration-200',
                                enterpriseNavCompact
                                  ? cn(
                                      'items-center gap-3 px-3',
                                      enterpriseNavUltra ? 'rounded-[14px] py-1.5' : 'rounded-[18px] py-2.5'
                                    )
                                  : 'items-start gap-3 rounded-[20px] px-3.5 py-3',
                                active
                                  ? cn(
                                      'border-slate-300/90 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(241,245,249,0.92))] text-slate-950',
                                      enterpriseNavUltra
                                        ? 'shadow-[0_1px_0_0_rgba(15,23,42,0.06),0_10px_22px_-18px_rgba(15,23,42,0.22)] ring-1 ring-slate-200/70'
                                        : 'shadow-[0_12px_30px_rgba(15,23,42,0.10)]'
                                    )
                                  : 'border-transparent bg-white/55 text-slate-600 hover:border-slate-200/80 hover:bg-white/88 hover:text-slate-950'
                              )}
                              aria-label={panel.label}
                              title={panel.label}
                            >
                              {active ? (
                                <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-gradient-to-b from-sky-500 via-blue-600 to-indigo-600" />
                              ) : null}
                              <span
                                className={cn(
                                  'relative flex shrink-0 items-center justify-center rounded-2xl border transition-colors',
                                  enterpriseNavCompact ? 'h-9 w-9' : 'h-11 w-11',
                                  active
                                    ? 'border-sky-200 bg-sky-50 text-sky-700'
                                    : 'border-slate-200/80 bg-slate-50/90 text-slate-600 group-hover:border-slate-300 group-hover:bg-slate-100'
                                )}
                              >
                                <Icon className={cn(enterpriseNavCompact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className={cn('flex justify-between gap-2', enterpriseNavCompact ? 'items-center' : 'items-start')}>
                                  <span className="block truncate text-sm font-semibold text-slate-900">{panel.label}</span>
                                  {!enterpriseNavCompact ? (
                                    <span
                                      className={cn(
                                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                                        active ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'
                                      )}
                                    >
                                      {panel.badge}
                                    </span>
                                  ) : null}
                                </span>
                                {!enterpriseNavCompact ? (
                                  <span className="mt-1 block text-[11px] leading-4 text-slate-500">{panel.desc}</span>
                                ) : null}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {!enterpriseNavSimpleList ? (
                  <div className="shrink-0 space-y-4 pt-4">
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                        <Signal className="h-4 w-4" />
                        Automation Health
                      </div>
                      <div className="mt-3 flex items-start gap-3">
                        <div className="shrink-0 text-3xl font-bold leading-none tabular-nums text-slate-900">{summary.avgSuccess}%</div>
                        <p className="min-w-0 flex-1 text-[10px] leading-snug text-slate-600">
                          Workflow execution reliability indicator across visible catalog.
                        </p>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-blue-100">
                        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${summary.avgSuccess}%` }} />
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </aside>
        ) : null}

        <div
          className={workspaceMainColumnClass(false, isWorkspaceCollapsed, enterpriseNavLayoutVariant)}
        >
          {/* Outer wrapper already applies workspaceDockedContentInsetClass — pass docked=false
              to avoid double left padding that narrows the panel when Fixed Sidebar is off. */}
          {showFiltersPanel && activePanel !== 'overview' ? (
          <Card ref={filterCardRef} className="liquid-glass-enterprise-panel rounded-2xl p-4 space-y-3">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={activePanel === 'automation' ? ruleSearch : search}
                onChange={(event) => (activePanel === 'automation' ? setRuleSearch(event.target.value) : setSearch(event.target.value))}
                className="h-11 w-full rounded-2xl border-slate-200 bg-white pl-9 text-sm"
                placeholder={activePanel === 'automation' ? 'Search rule name, trigger, condition, action' : 'Search workflow name, ID, owner, type, trigger'}
              />
            </div>
            {activePanel === 'catalog' ? (
              <button type="button" onClick={createWorkflow} className={enterpriseCyanGradientActionButtonClass()}>
                <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.5} />
                New Workflow
              </button>
            ) : activePanel === 'automation' ? (
              <button type="button" onClick={createAutomationRule} className={enterpriseCyanGradientActionButtonClass()}>
                <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.5} />
                New Rule
              </button>
            ) : null}
          </Card>
          ) : null}

          {activePanel === 'overview' ? (
            <Panel
              title="Workflow Execution Overview Panel"
              description="Workflow execution KPI summary and daily success/failure trend."
              headerIcon={<BarChart3 className="h-5 w-5" />}
              panelRef={activeMainPanelRef}
              style={isOverviewSectionActive ? workspaceMainPanelViewportHeightStyle(mainPanelViewportHeightPx) : undefined}
              className={cn('flex min-h-0 w-full flex-col', isOverviewSectionActive && mainPanelViewportHeightPx != null && 'overflow-hidden')}
              bodyClassName="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
                {/* 1. Workflow Catalog Snapshot */}
                <OverviewCard
                  icon={Workflow}
                  tone="sky"
                  title="Workflow Catalog Snapshot"
                  description="List of active workflows and their latest execution status."
                  footer={<button type="button" className="text-xs font-semibold text-sky-600 hover:text-sky-700">View All Workflows →</button>}
                >
                  <div className="-mx-1 overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead className="text-slate-500">
                        <tr className="text-left">
                          {['Workflow / Project', 'Category', 'Owner', 'Trigger', 'Status', 'Last Execution'].map((header) => (
                            <th key={header} className="px-1 pb-2 font-semibold">{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {catalogSnapshotRows.map((item) => (
                          <tr key={item.name} className="border-t border-slate-100">
                            <td className="px-1 py-2 font-medium text-slate-900">
                              <div>{item.name}</div>
                              <div className="mt-0.5 text-[10px] font-normal text-slate-500">{item.project}</div>
                            </td>
                            <td className="px-1 py-2 text-slate-600">{item.category}</td>
                            <td className="px-1 py-2 text-slate-600">{item.owner}</td>
                            <td className="px-1 py-2 text-slate-600">{item.trigger}</td>
                            <td className="px-1 py-2"><Badge className={cn('rounded-full border px-2 py-0.5 text-[10px]', statusTone(item.status))}>{item.status}</Badge></td>
                            <td className="px-1 py-2 text-slate-500">{item.lastExecution}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </OverviewCard>

                {/* 2. Execution Trend */}
                <OverviewCard
                  icon={TrendingUp}
                  tone="cyan"
                  title="Execution Trend"
                  description="Execution trend over time."
                  footer={
                    <div className="grid grid-cols-3 gap-2">
                      <CardMetric label="Success Rate" value="91%" tone="emerald" />
                      <CardMetric label="Total Executions" value="5,785" />
                      <CardMetric label="Failed Executions" value="535" tone="rose" />
                    </div>
                  }
                >
                  <ChartLegend
                    items={[
                      { label: 'Total Executions', color: '#3b82f6' },
                      { label: 'Successful Executions', color: '#10b981' },
                      { label: 'Failed Executions', color: '#ef4444' },
                    ]}
                  />
                  <div className="mt-3 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={EXECUTION_TREND} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                        <Line type="monotone" dataKey="success" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                        <Line type="monotone" dataKey="failure" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </OverviewCard>

                {/* 3. Success vs Failure Rate */}
                <OverviewCard
                  icon={ShieldCheck}
                  tone="emerald"
                  title="Success vs Failure Rate"
                  description="Comparison of success, failure, and retry rate."
                  headerRight={
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Workflow Reliability</div>
                      <div className="text-xl font-bold leading-none text-slate-900">96%</div>
                      <div className="text-[10px] font-semibold text-emerald-600">↑ 4.2% vs prior 7 days</div>
                    </div>
                  }
                  footer={
                    <div className="grid grid-cols-3 gap-2">
                      <CardMetric label="Success Rate" value="91%" tone="emerald" />
                      <CardMetric label="Error Rate" value="5.4%" tone="rose" />
                      <CardMetric label="Retry Rate" value="3.6%" tone="amber" />
                    </div>
                  }
                >
                  <ChartLegend
                    items={[
                      { label: 'Success', color: '#10b981' },
                      { label: 'Retry', color: '#f59e0b' },
                      { label: 'Failure', color: '#ef4444' },
                    ]}
                  />
                  <div className="mt-3 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={RELIABILITY_TREND} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} stackOffset="expand">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(value) => `${Math.round(value * 100)}%`} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Area type="monotone" dataKey="success" stackId="r" stroke="#10b981" fill="#10b981" fillOpacity={0.35} isAnimationActive={false} />
                        <Area type="monotone" dataKey="retry" stackId="r" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.35} isAnimationActive={false} />
                        <Area type="monotone" dataKey="failure" stackId="r" stroke="#ef4444" fill="#ef4444" fillOpacity={0.35} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </OverviewCard>

                {/* 4. Workflow Funnel */}
                <OverviewCard
                  icon={Filter}
                  tone="violet"
                  title="Workflow Funnel"
                  description="Distribusi workflow berdasarkan tahap eksekusi."
                  footer={
                    <div className="grid grid-cols-2 gap-2">
                      <CardMetric label="Completion Rate" value="73%" tone="emerald" />
                      <CardMetric label="Avg. Execution Time" value="12m 34s" />
                    </div>
                  }
                >
                  <div className="space-y-2">
                    {FUNNEL_STAGES.map((stage) => (
                      <div key={stage.label} className="flex items-center gap-3 text-[11px]">
                        <span className="flex w-28 shrink-0 items-center gap-1 text-slate-600">
                          {stage.bottleneck ? <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" /> : null}
                          <span className="truncate">{stage.label}</span>
                        </span>
                        <div className="flex-1">
                          <div className={cn('h-5 rounded-md', stage.bottleneck && 'ring-1 ring-amber-300')} style={{ width: `${stage.pct}%`, backgroundColor: stage.color }} />
                        </div>
                        <span className="w-24 shrink-0 text-right tabular-nums text-slate-700">{stage.value.toLocaleString()} ({stage.pct}%)</span>
                      </div>
                    ))}
                  </div>
                </OverviewCard>

                {/* 5. Approval SLA */}
                <OverviewCard
                  icon={Clock3}
                  tone="amber"
                  title="Approval SLA"
                  description="SLA compliance for approval workflows."
                  footer={
                    <div className="grid grid-cols-3 gap-2">
                      <CardMetric label="Average Approval Time" value="1h 32m" />
                      <CardMetric label="SLA Breach Count" value="62" tone="rose" />
                      <CardMetric label="SLA Breach Rate" value="5%" tone="amber" />
                    </div>
                  }
                >
                  <div className="space-y-3">
                    {APPROVAL_SLA.map((item) => (
                      <div key={item.label}>
                        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-600">
                          <span>{item.label}</span>
                          <span className="tabular-nums text-slate-700">{item.pct}% ({item.value.toLocaleString()})</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-slate-100">
                          <div className="h-2.5 rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </OverviewCard>

                {/* 6. Execution Queue Depth */}
                <OverviewCard
                  icon={Layers3}
                  tone="indigo"
                  title="Execution Queue Depth"
                  description="Depth of the workflow execution queue in the system."
                  headerRight={
                    <Badge className="rounded-full border border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">Queue Health · Healthy</Badge>
                  }
                  footer={
                    <div className="grid grid-cols-3 gap-2">
                      <CardMetric label="Total Pending" value="248" tone="sky" />
                      <CardMetric label="Waiting Jobs" value="128" />
                      <CardMetric label="Retry Queue" value="32" tone="amber" />
                    </div>
                  }
                >
                  <ChartLegend
                    items={[
                      { label: 'Pending Executions', color: '#3b82f6' },
                      { label: 'Waiting Jobs', color: '#8b5cf6' },
                      { label: 'Retry Queue', color: '#f59e0b' },
                    ]}
                  />
                  <div className="mt-3 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={QUEUE_DEPTH_TREND} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Area type="monotone" dataKey="pending" stackId="q" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} isAnimationActive={false} />
                        <Area type="monotone" dataKey="waiting" stackId="q" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} isAnimationActive={false} />
                        <Area type="monotone" dataKey="retry" stackId="q" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </OverviewCard>

                {/* 7. Trigger Source Distribution */}
                <OverviewCard
                  icon={Zap}
                  tone="cyan"
                  title="Trigger Source Distribution"
                  description="Distribusi berdasarkan sumber trigger workflow."
                >
                  <WorkflowDonut data={TRIGGER_SOURCES} centerValue="324" centerLabel="Executions" />
                </OverviewCard>

                {/* 8. Automation Coverage */}
                <OverviewCard
                  icon={Gauge}
                  tone="emerald"
                  title="Automation Coverage"
                  description="Tingkat otomatisasi workflow dalam organisasi."
                >
                  <div className="flex items-center justify-between gap-6">
                    <div className="relative h-36 w-60 shrink-0">
                      <div
                        className="pointer-events-none absolute inset-x-2 bottom-0 top-2 rounded-full"
                        style={{ background: 'radial-gradient(ellipse 80% 100% at 50% 100%, rgba(16,185,129,0.18) 0%, rgba(14,165,233,0.08) 50%, transparent 75%)', filter: 'blur(6px)' }}
                      />
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <defs>
                            <linearGradient id="automation-gauge-fill" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#34d399" />
                              <stop offset="100%" stopColor="#059669" />
                            </linearGradient>
                          </defs>
                          <Pie data={AUTOMATION_COVERAGE} dataKey="value" nameKey="name" cx="50%" cy="100%" startAngle={180} endAngle={0} innerRadius={70} outerRadius={98} cornerRadius={6} stroke="white" strokeWidth={1.5} isAnimationActive={false}>
                            {AUTOMATION_COVERAGE.map((entry) => (
                              <Cell key={entry.name} fill={entry.name === 'Automated' ? 'url(#automation-gauge-fill)' : entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
                        <span className="text-3xl font-bold leading-none text-emerald-600">72%</span>
                        <span className="text-[11px] text-slate-500">Automated</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Automation Maturity Score</div>
                      <div className="text-3xl font-bold leading-none text-emerald-600">A</div>
                      <div className="text-xs text-slate-500">Excellent</div>
                      <div className="mt-1 text-[11px] font-semibold text-emerald-600">↑ 6% vs prior 7 days</div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4">
                    <div className="grid grid-cols-2 gap-2">
                      {AUTOMATION_SPLIT.map((item) => (
                        <div key={item.label} className="rounded-xl border border-slate-200/90 bg-white/80 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                              {item.label}
                            </span>
                            <span className="text-sm font-bold tabular-nums text-slate-900">{item.pct}%</span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full" style={{ width: `${item.pct}%`, background: `linear-gradient(90deg, ${item.color}, ${item.color}bb)` }} />
                            </div>
                            <span className="text-[10px] tabular-nums text-slate-500">{item.count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </OverviewCard>

                {/* 9. AI Workflow Insight */}
                <OverviewCard
                  icon={Sparkles}
                  tone="violet"
                  className="xl:col-span-2"
                  title="AI Workflow Insight"
                  description="Smart insights and recommendations from TECTONA AI."
                  headerRight={
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Confidence Score</div>
                      <div className="text-xl font-bold leading-none text-violet-600">92%</div>
                    </div>
                  }
                  footer={
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400">Generated 5 minutes ago</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600">Powered by TECTONA AI <Sparkles className="h-3 w-3" /></span>
                    </div>
                  }
                >
                  <div className="space-y-2">
                    {AI_INSIGHTS.map((insight) => {
                      const tone = insightTone(insight.level)
                      const Icon = tone.Icon
                      return (
                        <div key={insight.text} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                          <span className="flex min-w-0 items-center gap-2 text-[11px] text-slate-700">
                            <Icon className={cn('h-3.5 w-3.5 shrink-0', tone.icon)} />
                            <span className="truncate">{insight.text}</span>
                          </span>
                          <Badge className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px]', tone.badge)}>{insight.level}</Badge>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" className="h-8 rounded-lg bg-violet-600 text-xs hover:bg-violet-700">Open Workflow</Button>
                    <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg text-xs">Generate Optimization</Button>
                    <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg text-xs">Simulate Impact</Button>
                  </div>
                </OverviewCard>
              </div>
            </Panel>
          ) : null}

          {activePanel === 'catalog' ? (
            <Panel
              title="Workflow & Automation Directory Panel"
              description="List of workflows with status, trigger, success rate, and quick operational actions."
              headerIcon={<Workflow className="h-5 w-5" />}
              panelRef={activeMainPanelRef}
              style={workspaceMainPanelViewportHeightStyle(mainPanelViewportHeightPx)}
              className={cn('flex min-h-0 w-full flex-col', mainPanelViewportHeightPx != null && 'overflow-hidden')}
              bodyClassName="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              right={
                    <div className="flex flex-wrap items-center justify-end gap-3 py-1 text-xs text-muted-foreground">
                      <Badge variant="outline" className={cn('mr-1 text-[10px] font-semibold', workflowCatalogState === 'backend' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : workflowCatalogState === 'loading' ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-rose-200 bg-rose-50 text-rose-700')}>
                        {workflowCatalogState === 'backend' ? 'Backend data' : workflowCatalogState === 'loading' ? 'Loading backend' : 'Backend unavailable'}
                      </Badge>
                      <EnterpriseGroupByControl
                        options={WORKFLOW_TABLE_GROUP_BY_OPTIONS}
                        value={workflowTableGroupBy}
                        onChange={(key) => setWorkflowTableGroupBy(key)}
                      />
                      <EnterpriseSelectionToggle checked={showWorkflowTableSelection} onChange={setShowWorkflowTableSelectionSafe} />
                      <EnterpriseColumnVisibilityControl
                        columns={WORKFLOW_TABLE_COLUMN_VISIBILITY_OPTIONS}
                        hidden={workflowTableColumns.hiddenColumns}
                        visibleCount={workflowTableColumns.visibleColumnOrder.length}
                        onToggle={workflowTableColumns.toggleColumnVisibility}
                        onShowAll={workflowTableColumns.showAllColumns}
                        canEnable={workflowTableColumns.canShowColumn}
                      />
                      <p className="text-xs text-muted-foreground">
                        Showing <span className="font-semibold text-foreground">{workflowStart}</span>-<span className="font-semibold text-foreground">{workflowEnd}</span> of <span className="font-semibold text-foreground">{workflowFlatRows.length}</span>
                      </p>
                      <span className="text-xs text-muted-foreground">Rows:</span>
                      <Select
                        value={String(workflowPageSize)}
                        onChange={(e) => {
                          setWorkflowPageSize(parseInt(e.target.value, 10))
                          setWorkflowPage(1)
                        }}
                        className="h-10 w-[84px] text-sm"
                      >
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="15">15</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                      </Select>
                      <div className="flex h-10 items-stretch gap-0.5 rounded-lg border border-border bg-background/80 p-0.5 shadow-sm">
                        <button
                          type="button"
                          className="flex items-center justify-center rounded-md px-2 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
                          onClick={() => setWorkflowPage((prev) => Math.max(1, prev - 1))}
                          disabled={workflowPageSafe <= 1}
                        >
                          Previous
                        </button>
                        <div className="flex items-center justify-center px-2 text-xs text-muted-foreground tabular-nums">{workflowPageSafe} / {workflowTotalPages}</div>
                        <button
                          type="button"
                          className="flex items-center justify-center rounded-md px-2 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
                          onClick={() => setWorkflowPage((prev) => Math.min(workflowTotalPages, prev + 1))}
                          disabled={workflowPageSafe >= workflowTotalPages}
                        >
                          Next
                        </button>
                      </div>
                    </div>
              }
            >
                  {workflowFlatRows.length > 0 ? (
                    <div className="min-h-0 w-full flex-1 overflow-auto rounded-xl">
                      <DndContext sensors={workflowTableColumns.dndSensors} onDragEnd={workflowTableColumns.handleColumnDragEnd}>
                        <table
                          ref={workflowTableRef}
                          className={cn(
                            'border-collapse text-xs select-none',
                            workflowTableColumns.hasAnyCustomWidth || workflowTableColumns.resizingKey ? 'table-fixed w-full' : 'w-full',
                          )}
                        >
                          <colgroup>
                            {showWorkflowTableSelection ? <col className="w-10" /> : null}
                            {workflowTableColumns.visibleColumnOrder.map((key) => (
                              <col key={key} style={workflowTableColumns.columnWidthStyle(key)} />
                            ))}
                            <col className="w-12" />
                          </colgroup>
                          <thead className="sticky top-0 z-10">
                            <tr className="text-left text-muted-foreground">
                              {showWorkflowTableSelection ? (
                                <th className="w-10 select-none border-b-[3px] border-double border-slate-300/90 bg-white/90 px-3 py-2 text-left font-semibold backdrop-blur dark:border-slate-600/80 dark:bg-slate-900/90">
                                  <input
                                    type="checkbox"
                                    id="workflow-table-select-all"
                                    name="workflow-table-select-all"
                                    checked={
                                      workflowTableSelectedIds.length > 0
                                      && workflowTableSelectedIds.length === pagedWorkflowRows.length
                                    }
                                    onChange={() =>
                                      setWorkflowTableSelectedIds(
                                        workflowTableSelectedIds.length === pagedWorkflowRows.length
                                          ? []
                                          : pagedWorkflowRows.map(({ item }) => item.id),
                                      )
                                    }
                                    aria-label="Select all rows on this page"
                                  />
                                </th>
                              ) : null}
                              <SortableContext items={workflowTableColumns.visibleColumnOrder} strategy={rectSortingStrategy}>
                                {workflowTableColumns.visibleColumnOrder.map((key) => (
                                  <EnterpriseSortableHeaderCell
                                    key={key}
                                    columnKey={key}
                                    label={workflowTableColumnLabel(key)}
                                    icon={workflowTableColumnHeaderIcon(key)}
                                    isPinned={workflowTableColumns.isPinnedColumn(key)}
                                    isFirstColumn={workflowTableColumns.isFirstColumn(key)}
                                    isLastColumn={workflowTableColumns.isLastColumn(key)}
                                    widthStyle={workflowTableColumns.columnWidthStyle(key)}
                                    sortDir={workflowTableSort?.key === key ? workflowTableSort.dir : null}
                                    onToggleSort={toggleWorkflowTableSort}
                                    filterSlot={renderWorkflowFilterSlot(key)}
                                    frozenColumnClass={workflowTableColumns.frozenColumnHeaderClass}
                                    firstColumnTintClass={workflowTableColumns.firstColumnTintHeaderClass}
                                    isResizing={workflowTableColumns.resizingKey === key}
                                    onBeginResize={workflowTableColumns.beginColumnResize}
                                    onContextMenu={(event, columnKey) =>
                                      workflowTableColumns.setHeaderContextMenu({ x: event.clientX, y: event.clientY, columnKey })
                                    }
                                  />
                                ))}
                              </SortableContext>
                              <th className="w-12 select-none border-b-[3px] border-double border-slate-300/90 bg-white/90 px-3 py-2 backdrop-blur dark:border-slate-600/80 dark:bg-slate-900/90">
                                <span className="sr-only">Actions</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {pagedWorkflowRows.map(({ item, groupLabel }, rowIndex) => {
                              const previousGroupLabel = pagedWorkflowRows[rowIndex - 1]?.groupLabel ?? null
                              const showGroupHeader = workflowTableGroupBy && groupLabel && groupLabel !== previousGroupLabel
                              const groupTint = workflowTableGroupBy && groupLabel ? getEnterpriseGroupTint(workflowTableGroupBy, groupLabel) : null
                              const isSelected = showWorkflowTableSelection && workflowTableSelectedIds.includes(item.id)
                              const resolveBodyCellBackground = (isFirstColumn: boolean) => {
                                if (isSelected) return ''
                                const stickyFirstClass =
                                  workflowTableColumns.freezeFirstColumn && isFirstColumn
                                    ? 'sticky left-0 z-10 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.08)] dark:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.35)]'
                                    : ''
                                if (groupTint) {
                                  return cn(isFirstColumn ? groupTint.first : groupTint.row, stickyFirstClass)
                                }
                                if (workflowTableColumns.freezeFirstColumn && isFirstColumn) return workflowTableColumns.frozenColumnBodyClass
                                if (isFirstColumn) return workflowTableColumns.firstColumnTintBodyClass
                                return ''
                              }
                              const cellClass = cn(
                                'border-b border-slate-200/60 px-3 py-3.5 align-middle transition-colors dark:border-slate-700/20',
                                isSelected
                                  ? 'bg-primary/10'
                                  : groupTint
                                    ? 'group-hover:brightness-[0.98] dark:group-hover:brightness-110'
                                    : 'group-hover:bg-sky-50/40',
                              )
                              return (
                                <Fragment key={item.id}>
                                  {showGroupHeader ? (
                                    <tr>
                                      <td
                                        colSpan={workflowTableColumns.visibleColumnOrder.length + (showWorkflowTableSelection ? 1 : 0) + 1}
                                        className={cn(
                                          'px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground',
                                          groupTint?.first,
                                        )}
                                      >
                                        {WORKFLOW_TABLE_GROUP_BY_OPTIONS.find((opt) => opt.key === workflowTableGroupBy)?.label}: {groupLabel}
                                      </td>
                                    </tr>
                                  ) : null}
                                  <tr
                                    onClick={() => setBuilder({ open: true, workflowId: item.id })}
                                    className="group cursor-pointer transition-colors"
                                  >
                                    {showWorkflowTableSelection ? (
                                      <td
                                        className={cn(cellClass, 'w-10', resolveBodyCellBackground(false))}
                                        onClick={(event) => event.stopPropagation()}
                                      >
                                        <input
                                          type="checkbox"
                                          id={`workflow-table-select-${item.id}`}
                                          name={`workflow-table-select-${item.id}`}
                                          checked={workflowTableSelectedIds.includes(item.id)}
                                          onChange={() => toggleWorkflowTableRowSelection(item.id)}
                                          aria-label={`Select ${item.name}`}
                                        />
                                      </td>
                                    ) : null}
                                    {workflowTableColumns.visibleColumnOrder.map((key) => {
                                      const isFirstCol = workflowTableColumns.visibleColumnOrder[0] === key
                                      return (
                                        <td
                                          key={key}
                                          className={cn(cellClass, resolveBodyCellBackground(isFirstCol))}
                                          style={{
                                            ...(workflowTableColumns.columnWidthStyle(key) ?? {}),
                                            ...(key === 'name' ? { boxShadow: `inset 3px 0 0 ${statusAccentColor(item.status)}` } : {}),
                                          }}
                                        >
                                          {renderWorkflowTableCell(item, key)}
                                        </td>
                                      )
                                    })}
                                    <td
                                      className={cn(cellClass, 'w-12 text-right')}
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 data-[open=true]:opacity-100"
                                        data-open={rowMenu?.id === item.id}
                                        aria-label={`Actions for ${item.name}`}
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          setRowMenu(
                                            rowMenu?.id === item.id
                                              ? null
                                              : { id: item.id, x: event.clientX, y: event.clientY },
                                          )
                                        }}
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </button>
                                    </td>
                                  </tr>
                                </Fragment>
                              )
                            })}
                          </tbody>
                        </table>
                      </DndContext>

                      <ContextMenu
                        open={workflowTableColumns.headerContextMenu !== null}
                        x={workflowTableColumns.headerContextMenu?.x ?? 0}
                        y={workflowTableColumns.headerContextMenu?.y ?? 0}
                        onClose={() => workflowTableColumns.setHeaderContextMenu(null)}
                      >
                        <ContextMenuItem
                          onSelect={() => {
                            const key = workflowTableColumns.headerContextMenu?.columnKey
                            if (!key) return
                            workflowTableColumns.autoResizeColumn(key)
                            workflowTableColumns.setHeaderContextMenu(null)
                          }}
                        >
                          <UnfoldHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          Auto Resize Column
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onSelect={() => {
                            const key = workflowTableColumns.headerContextMenu?.columnKey
                            if (!key) return
                            workflowTableColumns.setColumnWidthDialog({ open: true, columnKey: key, valuePx: '' })
                            workflowTableColumns.setHeaderContextMenu(null)
                          }}
                        >
                          <Ruler className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          Column Width...
                        </ContextMenuItem>
                        {workflowTableColumns.hasAnyCustomWidth ? (
                          <>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              onSelect={() => {
                                workflowTableColumns.resetAllColumnWidths()
                                workflowTableColumns.setHeaderContextMenu(null)
                              }}
                            >
                              <RotateCcw className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                              Reset Column Width
                            </ContextMenuItem>
                          </>
                        ) : null}
                        {workflowTableColumns.headerContextMenu?.columnKey
                        && workflowTableColumns.isSecondColumn(workflowTableColumns.headerContextMenu.columnKey)
                        && !workflowTableColumns.isLastColumn(workflowTableColumns.headerContextMenu.columnKey) ? (
                          <>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              onSelect={() => {
                                const key = workflowTableColumns.headerContextMenu?.columnKey
                                if (!key) return
                                workflowTableColumns.moveColumnRight(key)
                                workflowTableColumns.setHeaderContextMenu(null)
                              }}
                            >
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                              Move Column to Right
                            </ContextMenuItem>
                            <ContextMenuItem
                              onSelect={() => {
                                const key = workflowTableColumns.headerContextMenu?.columnKey
                                if (!key) return
                                workflowTableColumns.moveColumnToLast(key)
                                workflowTableColumns.setHeaderContextMenu(null)
                              }}
                            >
                              <ArrowRightToLine className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                              Move Column to Last Position
                            </ContextMenuItem>
                          </>
                        ) : null}
                        {workflowTableColumns.headerContextMenu?.columnKey
                        && workflowTableColumns.isThirdColumnOrLater(workflowTableColumns.headerContextMenu.columnKey) ? (
                          <>
                            <ContextMenuSeparator />
                            {(() => {
                              const key = workflowTableColumns.headerContextMenu.columnKey
                              const columnIndex = workflowTableColumns.getColumnIndex(key)
                              const canMoveEarlier = columnIndex > 1
                              const canMoveLater = columnIndex >= 0 && columnIndex < workflowTableColumns.columnOrder.length - 1
                              return (
                                <>
                                  {canMoveEarlier ? (
                                    <ContextMenuItem
                                      onSelect={() => {
                                        workflowTableColumns.moveColumnToFirst(key)
                                        workflowTableColumns.setHeaderContextMenu(null)
                                      }}
                                    >
                                      <ArrowLeftToLine className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                                      Move Column to First Position
                                    </ContextMenuItem>
                                  ) : null}
                                  {canMoveEarlier ? (
                                    <ContextMenuItem
                                      onSelect={() => {
                                        workflowTableColumns.moveColumnLeft(key)
                                        workflowTableColumns.setHeaderContextMenu(null)
                                      }}
                                    >
                                      <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                                      Move Column to Left
                                    </ContextMenuItem>
                                  ) : null}
                                  {canMoveLater ? (
                                    <ContextMenuItem
                                      onSelect={() => {
                                        workflowTableColumns.moveColumnRight(key)
                                        workflowTableColumns.setHeaderContextMenu(null)
                                      }}
                                    >
                                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                                      Move Column to Right
                                    </ContextMenuItem>
                                  ) : null}
                                  {canMoveLater ? (
                                    <ContextMenuItem
                                      onSelect={() => {
                                        workflowTableColumns.moveColumnToLast(key)
                                        workflowTableColumns.setHeaderContextMenu(null)
                                      }}
                                    >
                                      <ArrowRightToLine className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                                      Move Column to Last Position
                                    </ContextMenuItem>
                                  ) : null}
                                </>
                              )
                            })()}
                          </>
                        ) : null}
                        {workflowTableColumns.headerContextMenu?.columnKey
                        && workflowTableColumns.isFirstColumn(workflowTableColumns.headerContextMenu.columnKey) ? (
                          <>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              onSelect={() => {
                                workflowTableColumns.setFreezeFirstColumn((v) => !v)
                                workflowTableColumns.setHeaderContextMenu(null)
                              }}
                            >
                              <Pin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                              Freeze Column
                              <span className="ml-auto text-xs text-muted-foreground">
                                {workflowTableColumns.freezeFirstColumn ? 'On' : 'Off'}
                              </span>
                            </ContextMenuItem>
                          </>
                        ) : null}
                      </ContextMenu>

                      <ContextMenu
                        open={rowMenu !== null}
                        x={rowMenu?.x ?? 0}
                        y={rowMenu?.y ?? 0}
                        onClose={() => setRowMenu(null)}
                      >
                        <ContextMenuItem
                          onSelect={() => {
                            if (rowMenu) setBuilder({ open: true, workflowId: rowMenu.id })
                            setRowMenu(null)
                          }}
                        >
                          <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          Open in Builder
                        </ContextMenuItem>
                        <ContextMenuItem
                          onSelect={() => {
                            if (rowMenu) duplicateWorkflow(rowMenu.id)
                            setRowMenu(null)
                          }}
                        >
                          <Copy className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          Duplicate
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onSelect={() => {
                            if (rowMenu) deleteWorkflow(rowMenu.id)
                            setRowMenu(null)
                          }}
                        >
                          <Trash2 className="h-4 w-4 shrink-0 text-rose-500" aria-hidden />
                          <span className="text-rose-600">Delete</span>
                        </ContextMenuItem>
                      </ContextMenu>

                      <EnterpriseColumnWidthModal
                        open={workflowTableColumns.columnWidthDialog?.open ?? false}
                        onClose={() => workflowTableColumns.setColumnWidthDialog(null)}
                        columnLabel={
                          workflowTableColumns.columnWidthDialog
                            ? workflowTableColumnLabel(workflowTableColumns.columnWidthDialog.columnKey)
                            : '—'
                        }
                        valuePx={workflowTableColumns.columnWidthDialog?.valuePx ?? ''}
                        onValuePxChange={(value) =>
                          workflowTableColumns.setColumnWidthDialog((prev) => (prev ? { ...prev, valuePx: value } : prev))
                        }
                        onApply={(widthPx) => {
                          if (!workflowTableColumns.columnWidthDialog) return
                          const key = workflowTableColumns.columnWidthDialog.columnKey
                          workflowTableColumns.setColumnWidthsWithSnapshot((prev) => {
                            if (widthPx == null) {
                              const next = { ...prev }
                              delete next[key]
                              return next
                            }
                            return { ...prev, [key]: widthPx }
                          }, workflowTableRef.current)
                          workflowTableColumns.setColumnWidthDialog(null)
                        }}
                        dialogTitleId="workflow-table-column-width-dialog-title"
                      />
                    </div>
                  ) : (
                    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
                      <Workflow className="mb-3 h-8 w-8 text-slate-300" strokeWidth={1.75} />
                      <p className="text-sm font-medium text-slate-500">No workflows match the current filters</p>
                      <p className="mt-1 text-xs text-slate-400">{workflowCatalogState === 'error' ? 'Workflow service is unavailable. No local seed data is shown.' : 'Adjust the search or column filters to see workflows.'}</p>
                    </div>
                  )}
            </Panel>
          ) : null}

          {activePanel === 'automation' ? (
            <Panel
              title="Automation Control Room"
              description="Visual map of operational shortcuts that connect project events to saved workflows."
              headerIcon={<Bot className="h-5 w-5" />}
              panelRef={activeMainPanelRef}
              style={workspaceMainPanelViewportHeightStyle(mainPanelViewportHeightPx)}
              className={cn('flex min-h-0 w-full flex-col', mainPanelViewportHeightPx != null && 'overflow-hidden')}
              bodyClassName="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              right={<Badge variant="outline" className={cn('text-[10px] font-semibold', automationRulesState === 'backend' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : automationRulesState === 'loading' ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-rose-200 bg-rose-50 text-rose-700')}>{automationRulesState === 'backend' ? 'Backend data' : automationRulesState === 'loading' ? 'Loading backend' : 'Backend unavailable'}</Badge>}
            >
              <div className="space-y-4">
                {ruleEditor ? (
                  <Card className="border-sky-200 bg-sky-50/40 rounded-2xl">
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Configure operational rule</p>
                          <p className="text-xs text-slate-500">Define a small When → If → Then shortcut and link it to a saved workflow.</p>
                        </div>
                        <button type="button" onClick={() => setRuleEditor(null)} className="text-xs font-medium text-slate-500 hover:text-slate-900">Cancel</button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <label className="space-y-1.5 text-xs font-medium text-slate-600">Rule name<Input value={ruleEditor.name} onChange={(event) => setRuleEditor((current) => current ? { ...current, name: event.target.value } : current)} /></label>
                        <label className="space-y-1.5 text-xs font-medium text-slate-600">Owner<Select value={ruleEditor.ownerId} onChange={(event) => setRuleEditor((current) => current ? { ...current, ownerId: event.target.value } : current)}><SelectItem value="">Unassigned</SelectItem>{workflowOwnerOptions.map((owner) => <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>)}</Select></label>
                        <label className="space-y-1.5 text-xs font-medium text-slate-600">Trigger type<Select value={ruleEditor.trigger} onChange={(event) => setRuleEditor((current) => current ? { ...current, trigger: event.target.value as AutomationRuleTrigger } : current)}><SelectItem value="Event">Event</SelectItem><SelectItem value="Schedule">Schedule</SelectItem><SelectItem value="Webhook">Webhook</SelectItem><SelectItem value="Manual">Manual</SelectItem></Select></label>
                        <label className="space-y-1.5 text-xs font-medium text-slate-600">When / event key<Input value={ruleEditor.triggerEvent} onChange={(event) => setRuleEditor((current) => current ? { ...current, triggerEvent: event.target.value } : current)} placeholder="approval.completed" /></label>
                        <label className="space-y-1.5 text-xs font-medium text-slate-600">If / condition<Input value={ruleEditor.condition} onChange={(event) => setRuleEditor((current) => current ? { ...current, condition: event.target.value } : current)} placeholder="Approval status = Approved" /></label>
                        <label className="space-y-1.5 text-xs font-medium text-slate-600">Then / action<Input value={ruleEditor.action} onChange={(event) => setRuleEditor((current) => current ? { ...current, action: event.target.value } : current)} placeholder="Create follow-up tasks" /></label>
                        <label className="space-y-1.5 text-xs font-medium text-slate-600 md:col-span-2 xl:col-span-3">Linked workflow<Select value={ruleEditor.linkedWorkflowId} onChange={(event) => setRuleEditor((current) => current ? { ...current, linkedWorkflowId: event.target.value } : current)}><SelectItem value="">No linked workflow</SelectItem>{workflows.map((workflow) => <SelectItem key={workflow.id} value={workflow.id}>{workflow.name}</SelectItem>)}</Select></label>
                      </div>
                      <div className="flex justify-end"><Button type="button" size="sm" onClick={saveAutomationRuleEditor}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Save rule</Button></div>
                    </CardContent>
                  </Card>
                ) : null}
                <div className="min-h-0 w-full flex-1 overflow-auto rounded-xl">
                  <table className="w-full border-collapse text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr className="text-left text-muted-foreground">
                        {[
                          { label: 'Rule', icon: Zap },
                          { label: 'Condition', icon: Filter },
                          { label: 'Action', icon: Workflow },
                          { label: 'Runs', icon: Activity },
                          { label: 'Last Triggered', icon: Clock3 },
                          { label: 'Status', icon: ShieldCheck },
                        ].map(({ label, icon: HeaderIcon }) => (
                          <th
                            key={label}
                            className="select-none border-b-[3px] border-double border-slate-300/90 bg-white/90 px-3 py-2 text-left font-semibold backdrop-blur dark:border-slate-600/80 dark:bg-slate-900/90"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <HeaderIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" aria-hidden />
                              {label}
                            </span>
                          </th>
                        ))}
                        <th className="w-12 select-none border-b-[3px] border-double border-slate-300/90 bg-white/90 px-3 py-2 backdrop-blur dark:border-slate-600/80 dark:bg-slate-900/90">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {automationRuleGroups.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="border-t border-slate-100 px-4 py-10 text-center text-sm text-slate-500">
                            No operational rules match your search.
                          </td>
                        </tr>
                      ) : (
                        automationRuleGroups.map(([group, rules]) => (
                          <Fragment key={group}>
                            <tr>
                              <td colSpan={7} className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                {group} · {rules.length}
                              </td>
                            </tr>
                            {rules.map((rule) => {
                              const linkedWorkflow = workflows.find((workflow) => workflow.id === rule.linkedWorkflowId)
                              const TriggerIcon = TRIGGER_ICONS[rule.trigger]
                              const cellClass = cn(
                                'border-b border-slate-200/60 px-3 py-3.5 align-middle transition-colors dark:border-slate-700/20 group-hover:bg-sky-50/40',
                                !rule.enabled && 'opacity-60',
                              )
                              return (
                                <tr key={rule.id} className="group transition-colors">
                                  <td className={cellClass} style={{ boxShadow: `inset 3px 0 0 ${rule.enabled ? '#10b981' : '#94a3b8'}` }}>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 truncate text-sm font-semibold text-slate-900">
                                        <TriggerIcon className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                                        <span className="truncate">{rule.name}</span>
                                      </div>
                                      <div className="mt-0.5 truncate pl-5 font-mono text-[10px] uppercase tracking-wide text-slate-400">
                                        {rule.triggerEvent || rule.trigger}
                                      </div>
                                    </div>
                                  </td>
                                  <td className={cellClass}>
                                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                      {rule.condition}
                                    </span>
                                  </td>
                                  <td className={cellClass}>
                                    <button
                                      type="button"
                                      onClick={() => linkedWorkflow && setBuilder({ open: true, workflowId: linkedWorkflow.id })}
                                      className="text-left"
                                    >
                                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                        {rule.action}
                                      </span>
                                      <div className="mt-1 truncate text-[10px] text-slate-500 transition hover:text-sky-600">
                                        {linkedWorkflow?.name ?? 'No workflow linked'}
                                      </div>
                                    </button>
                                  </td>
                                  <td className={cn(cellClass, 'tabular-nums text-slate-700')}>{rule.triggerCount.toLocaleString()}</td>
                                  <td className={cn(cellClass, 'text-slate-500')}>{rule.lastTriggered}</td>
                                  <td className={cellClass}>
                                    <div className="flex items-center gap-2">
                                      <Switch
                                        checked={rule.enabled}
                                        onCheckedChange={() => toggleAutomationRule(rule.id)}
                                        aria-label={rule.enabled ? 'Disable rule' : 'Enable rule'}
                                      />
                                      <Badge
                                        className={cn(
                                          'rounded-full border',
                                          rule.enabled
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                            : 'border-slate-200 bg-slate-100 text-slate-500',
                                        )}
                                      >
                                        {rule.enabled ? 'Enabled' : 'Disabled'}
                                      </Badge>
                                    </div>
                                  </td>
                                  <td className={cn(cellClass, 'w-12 text-right')}>
                                    <button
                                      type="button"
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 data-[open=true]:opacity-100"
                                      data-open={ruleMenu?.id === rule.id}
                                      aria-label={`Actions for ${rule.name}`}
                                      onClick={(event) =>
                                        setRuleMenu(ruleMenu?.id === rule.id ? null : { id: rule.id, x: event.clientX, y: event.clientY })
                                      }
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <ContextMenu open={ruleMenu !== null} x={ruleMenu?.x ?? 0} y={ruleMenu?.y ?? 0} onClose={() => setRuleMenu(null)}>
                <ContextMenuItem onSelect={() => { const rule = ruleMenu ? automationRules.find((item) => item.id === ruleMenu.id) : null; if (rule) openAutomationRuleEditor(rule) }}>
                  <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> Edit rule
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => {
                    if (ruleMenu) duplicateAutomationRule(ruleMenu.id)
                    setRuleMenu(null)
                  }}
                >
                  <Copy className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> Duplicate
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onSelect={() => {
                    if (ruleMenu) deleteAutomationRule(ruleMenu.id)
                    setRuleMenu(null)
                  }}
                >
                  <Trash2 className="h-4 w-4 shrink-0 text-rose-500" aria-hidden /> <span className="text-rose-600">Delete</span>
                </ContextMenuItem>
              </ContextMenu>
            </Panel>
          ) : null}

          {activePanel === 'monitoring' ? (
            <Panel
              title="Automation Monitoring & Execution Log Panel"
              description="Execution monitoring, runtime incidents, and automation health across workflows."
              headerIcon={<Activity className="h-5 w-5" />}
              panelRef={activeMainPanelRef}
              style={workspaceMainPanelViewportHeightStyle(mainPanelViewportHeightPx)}
              className={cn('flex min-h-0 w-full flex-col', mainPanelViewportHeightPx != null && 'overflow-hidden')}
              bodyClassName="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              <Card className="border-emerald-200 bg-emerald-50/80 rounded-2xl">
                <CardContent className="flex items-center gap-2 py-3 text-xs text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  Runtime monitoring active. All workflow metrics loaded successfully and are in sync.
                </CardContent>
              </Card>
            </Panel>
          ) : null}
        </div>
      </div>
      </div>

      <WorkflowBuilderCanvas
        open={builder.open}
        workflowId={builder.workflowId}
        workflowName={builder.workflowId ? workflows.find((item) => item.id === builder.workflowId)?.name ?? null : null}
        workspaceMembers={workflowOwnerOptions}
        onWorkflowCreated={(created) => {
          setWorkflows((current) => [mapWorkflowDto(created, workflowOwnerOptionsRef.current, 0), ...current.filter((item) => item.id !== created.id)])
          setBuilder({ open: true, workflowId: created.id })
        }}
        onClose={() => setBuilder({ open: false, workflowId: null })}
      />
    </div>
  )
}
