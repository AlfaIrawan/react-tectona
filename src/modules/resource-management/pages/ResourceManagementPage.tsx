import { Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type Ref } from 'react'
import { DndContext } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Gauge,
  Info,
  LayoutGrid,
  Layers,
  PanelLeft,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wand2,
  type LucideIcon,
} from 'lucide-react'
import { CapacityPlanningPanel } from '@/modules/resource-management/components/CapacityPlanningPanel'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectItem } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useEnterpriseSortableColumns } from '@/components/enterprise/useEnterpriseSortableColumns'
import { EnterpriseSortableHeaderCell } from '@/components/enterprise/EnterpriseSortableHeaderCell'
import { EnterpriseColumnFilterDropdown } from '@/components/enterprise/EnterpriseColumnFilterDropdown'
import { EnterpriseGroupByControl } from '@/components/enterprise/EnterpriseGroupByControl'
import { EnterpriseSelectionToggle } from '@/components/enterprise/EnterpriseSelectionToggle'
import { EnterpriseColumnVisibilityControl } from '@/components/enterprise/EnterpriseColumnVisibilityControl'
import { getEnterpriseGroupTint } from '@/components/enterprise/enterpriseTableGroupTint'
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

type AvailabilityStatus = 'Available' | 'Partially Allocated' | 'Fully Allocated' | 'Unavailable'
type PanelId = 'overview' | 'directory' | 'capacity' | 'insight' | 'activity'
type ResourceTableGroupByKey = 'team' | 'workspace' | 'availability'

type ResourceRecord = {
  id: string
  name: string
  role: string
  team: string
  allocation: number
  utilization: number
  availabilityStatus: AvailabilityStatus
  workspace: string
  activeProjects: string[]
  lastUpdated: string
}

type PanelMenuItem = {
  id: PanelId
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  badge: string
  group: 'Command Center' | 'Control Library' | 'Assurance & Traceability'
}

const resourceSeed: ResourceRecord[] = [
  { id: 'res-001', name: 'Ayla Brooks', role: 'Program Manager', team: 'PMO Core', allocation: 92, utilization: 89, availabilityStatus: 'Partially Allocated', workspace: 'Enterprise Delivery Office', activeProjects: ['Omni Channel Revamp'], lastUpdated: '2026-04-16 09:10' },
  { id: 'res-002', name: 'Jonas Reed', role: 'Delivery Lead', team: 'Studio West', allocation: 104, utilization: 97, availabilityStatus: 'Fully Allocated', workspace: 'Retail Transformation', activeProjects: ['Retail Growth Platform'], lastUpdated: '2026-04-16 08:48' },
  { id: 'res-003', name: 'Mina Alvarez', role: 'Capacity Planner', team: 'Service Ops', allocation: 74, utilization: 72, availabilityStatus: 'Available', workspace: 'Operations PMO', activeProjects: ['Service Excellence Program'], lastUpdated: '2026-04-16 09:02' },
  { id: 'res-004', name: 'Nadia Singh', role: 'PMO Analyst', team: 'PMO Core', allocation: 58, utilization: 56, availabilityStatus: 'Available', workspace: 'Enterprise Delivery Office', activeProjects: ['Service Excellence Program'], lastUpdated: '2026-04-16 08:15' },
]

const PANEL_MENU_ITEMS: PanelMenuItem[] = [
  {
    id: 'overview',
    label: 'Resource Overview',
    description: 'Command posture for team allocation, utilization, and capacity.',
    icon: Sparkles,
    badge: 'Command',
    group: 'Command Center',
  },
  {
    id: 'directory',
    label: 'Operational Resource Directory',
    description: 'Delivery staffing directory with allocation and reassignment actions.',
    icon: Users,
    badge: 'Core',
    group: 'Control Library',
  },
  {
    id: 'capacity',
    label: 'Capacity Planning',
    description: 'Capacity control and resource load balancing.',
    icon: Target,
    badge: 'Plan',
    group: 'Control Library',
  },
  {
    id: 'insight',
    label: 'Utilization Insight',
    description: 'Utilization analytics for overload/underload detection.',
    icon: BarChart3,
    badge: 'Insight',
    group: 'Assurance & Traceability',
  },
  {
    id: 'activity',
    label: 'Activity Log',
    description: 'Jejak aktivitas perubahan alokasi resource.',
    icon: Activity,
    badge: 'Audit',
    group: 'Assurance & Traceability',
  },
]

const PANEL_MENU_GROUPS: Array<{ group: PanelMenuItem['group']; items: PanelMenuItem[] }> = [
  { group: 'Command Center', items: PANEL_MENU_ITEMS.filter((item) => item.group === 'Command Center') },
  { group: 'Control Library', items: PANEL_MENU_ITEMS.filter((item) => item.group === 'Control Library') },
  { group: 'Assurance & Traceability', items: PANEL_MENU_ITEMS.filter((item) => item.group === 'Assurance & Traceability') },
]

function kpiCardChrome(cardId: string): string {
  const base =
    'rounded-2xl p-4 transition-all duration-200 relative overflow-hidden group border border-white/40 ring-1 ring-black/[0.04] shadow-[0_14px_40px_rgba(15,23,42,0.10)]'
  if (cardId === 'total') return cn(base, 'bg-gradient-to-br from-slate-50/85 via-white/90 to-sky-50/75')
  if (cardId === 'high') return cn(base, 'bg-gradient-to-br from-rose-50/70 via-white/90 to-orange-50/70')
  if (cardId === 'available') return cn(base, 'bg-gradient-to-br from-emerald-50/70 via-white/90 to-cyan-50/70')
  if (cardId === 'avg') return cn(base, 'bg-gradient-to-br from-indigo-50/70 via-white/90 to-violet-50/70')
  if (cardId === 'over') return cn(base, 'bg-gradient-to-br from-amber-50/70 via-white/90 to-yellow-50/70')
  return cn(base, 'bg-gradient-to-br from-cyan-50/70 via-white/90 to-blue-50/70')
}

function KpiSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((value, index) => ({ idx: index, value }))
  const gradientId = `tectona-resource-kpi-${color.replace('#', '')}`

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={color} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.8} fill={`url(#${gradientId})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function AvailabilityBadge({ value }: { value: AvailabilityStatus }) {
  const tone =
    value === 'Available'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : value === 'Partially Allocated'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : value === 'Fully Allocated'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-slate-200 bg-slate-100 text-slate-700'
  return <Badge className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', tone)}>{value}</Badge>
}

function resourceCode(record: ResourceRecord): string {
  return `${record.team}-${record.role}-${record.name}`.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toUpperCase()
}

function resourceGroupLabel(item: ResourceRecord, groupBy: ResourceTableGroupByKey): string {
  if (groupBy === 'team') return item.team
  if (groupBy === 'workspace') return item.workspace
  return item.availabilityStatus
}

function availabilityAccentColor(status: AvailabilityStatus): string {
  if (status === 'Available') return '#10b981'
  if (status === 'Partially Allocated') return '#f59e0b'
  if (status === 'Fully Allocated') return '#ef4444'
  return '#94a3b8'
}

function recommendedResourceAction(item: ResourceRecord): { label: string; className: string } {
  if (item.allocation > 100 || item.utilization > 92) {
    return { label: 'Rebalance load', className: 'border-rose-200 bg-rose-50 text-rose-700' }
  }
  if (item.availabilityStatus === 'Available' && item.utilization < 75) {
    return { label: 'Ready to assign', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
  }
  if (item.availabilityStatus === 'Partially Allocated') {
    return { label: 'Monitor capacity', className: 'border-amber-200 bg-amber-50 text-amber-700' }
  }
  return { label: 'Review fit', className: 'border-slate-200 bg-slate-50 text-slate-600' }
}

function metricTone(value: number, criticalAt: number): string {
  if (value >= criticalAt) return 'bg-rose-500'
  if (value >= 80) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function ResourceMetricBar({ value, criticalAt = 100 }: { value: number; criticalAt?: number }) {
  return (
    <div className="flex min-w-[132px] items-center gap-2">
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full', metricTone(value, criticalAt))} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="w-9 text-right font-semibold tabular-nums text-slate-700">{value}%</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Operational Resource Directory enterprise data-table (mirrors the Workflow &
// Automation Directory table: drag-reorder / resize columns, 3-state sort,
// per-column filters, group-by, selection, column visibility, paging).
// ---------------------------------------------------------------------------
type ResourceTableColumnKey = 'name' | 'role' | 'team' | 'workspace' | 'allocation' | 'utilization' | 'availability' | 'action'

const RESOURCE_TABLE_PINNED_FIRST_COLUMN: ResourceTableColumnKey = 'name'
const RESOURCE_TABLE_DEFAULT_COLUMN_ORDER: ResourceTableColumnKey[] = [
  'name',
  'role',
  'team',
  'workspace',
  'allocation',
  'utilization',
  'availability',
  'action',
]

function resourceTableColumnLabel(key: ResourceTableColumnKey): string {
  switch (key) {
    case 'name': return 'Resource'
    case 'role': return 'Delivery Role'
    case 'team': return 'Operational Team'
    case 'workspace': return 'Assigned Workspace'
    case 'allocation': return 'Allocation'
    case 'utilization': return 'Utilization'
    case 'availability': return 'Availability'
    case 'action': return 'Recommended Action'
  }
}

function resourceTableColumnHeaderIcon(key: ResourceTableColumnKey): LucideIcon {
  switch (key) {
    case 'name': return Users
    case 'role': return Briefcase
    case 'team': return Building2
    case 'workspace': return Layers
    case 'allocation': return Gauge
    case 'utilization': return Activity
    case 'availability': return ShieldCheck
    case 'action': return Target
  }
}

const RESOURCE_TABLE_COLUMN_VISIBILITY_OPTIONS: readonly { key: ResourceTableColumnKey; label: string }[] =
  RESOURCE_TABLE_DEFAULT_COLUMN_ORDER.map((key) => ({ key, label: resourceTableColumnLabel(key) }))

const RESOURCE_TABLE_GROUP_BY_OPTIONS: readonly { key: ResourceTableGroupByKey; label: string }[] = [
  { key: 'team', label: 'Team' },
  { key: 'workspace', label: 'Workspace' },
  { key: 'availability', label: 'Availability' },
]

function Panel({
  id,
  title,
  description,
  highlight,
  right,
  outerRef,
  style,
  className,
  scrollBody = false,
  headerIcon,
  showDivider = true,
  children,
}: {
  id: string
  title: string
  description: string
  highlight: boolean
  right?: React.ReactNode
  outerRef?: Ref<HTMLElement>
  style?: CSSProperties
  className?: string
  scrollBody?: boolean
  headerIcon?: React.ReactNode
  showDivider?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      ref={outerRef}
      style={style}
      className={cn(
        'rounded-3xl border liquid-glass-enterprise-panel transition-all',
        highlight ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200/80',
        scrollBody && 'flex min-h-0 w-full flex-col overflow-hidden',
        className
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-start justify-between gap-4',
          headerIcon ? 'p-4 pb-0 lg:p-5 lg:pb-0' : 'px-5 py-4',
          showDivider && 'border-b border-slate-200/80'
        )}
      >
        <div className="min-w-0 shrink-0">
          <div className="flex min-w-0 items-center gap-2">
            {headerIcon ? <span className="shrink-0 text-slate-900">{headerIcon}</span> : null}
            <h2 className={cn('min-w-0 truncate font-semibold text-slate-900', headerIcon ? 'text-lg' : 'text-sm')}>{title}</h2>
          </div>
          <p className={cn('text-slate-600', headerIcon ? 'mt-0.5 text-[11px]' : 'mt-1 text-xs')}>{description}</p>
        </div>
        {right}
      </div>
      <div
        className={cn(
          headerIcon ? 'px-4 pb-4 pt-3 lg:px-5 lg:pb-5' : 'p-5',
          scrollBody &&
            'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
        )}
      >
        {children}
      </div>
    </section>
  )
}

/* ============================================================
   Resource Execution Overview — Enterprise Control Tower
   Mirrors the Work Execution Overview design system in
   Task & Work Management (glass chart panels with accent bar +
   icon chip, executive donut, intelligence donut).
   ============================================================ */

const CAPACITY_HOURS = 100

const utilizationByPerson = [
  { name: 'Ayla', utilization: 89, allocated: 89, capacity: CAPACITY_HOURS },
  { name: 'Jonas', utilization: 97, allocated: 110, capacity: CAPACITY_HOURS },
  { name: 'Mina', utilization: 72, allocated: 72, capacity: CAPACITY_HOURS },
  { name: 'Nadia', utilization: 56, allocated: 56, capacity: CAPACITY_HOURS },
]

const capacityVsAllocation = [
  { name: 'Ayla', capacity: 100, allocated: 89 },
  { name: 'Jonas', capacity: 100, allocated: 110 },
  { name: 'Mina', capacity: 100, allocated: 72 },
  { name: 'Nadia', capacity: 100, allocated: 56 },
]

const statusDistribution = [
  { name: 'Available', value: 1, color: '#10b981' },
  { name: 'Fully Allocated', value: 1, color: '#3b82f6' },
  { name: 'Overallocated', value: 1, color: '#ef4444' },
  { name: 'On Leave', value: 1, color: '#f59e0b' },
]

const demandForecast = [
  { sprint: 'Sprint 1', demand: 120, available: 110 },
  { sprint: 'Sprint 2', demand: 135, available: 115 },
  { sprint: 'Sprint 3', demand: 155, available: 120 },
  { sprint: 'Sprint 4', demand: 170, available: 125 },
]

const workspaceAllocation = [
  { name: 'AI CoE', allocated: 7, available: 2, unallocated: 1 },
  { name: 'Digital Lending', allocated: 5, available: 2, unallocated: 1 },
  { name: 'Collection', allocated: 3, available: 2, unallocated: 1 },
  { name: 'CRM', allocated: 3, available: 1, unallocated: 1 },
  { name: 'Risk', allocated: 2, available: 2, unallocated: 1 },
]

type SkillLevel = 'Expert' | 'Advanced' | 'Intermediate' | 'Basic'
const SKILL_COLUMNS = ['Java', 'Python', 'React', 'Data', 'PM', 'DevOps'] as const
const skillMatrix: Array<{ name: string; levels: SkillLevel[] }> = [
  { name: 'Ayla', levels: ['Expert', 'Advanced', 'Intermediate', 'Advanced', 'Expert', 'Basic'] },
  { name: 'Jonas', levels: ['Advanced', 'Expert', 'Intermediate', 'Advanced', 'Intermediate', 'Advanced'] },
  { name: 'Mina', levels: ['Intermediate', 'Advanced', 'Expert', 'Advanced', 'Basic', 'Intermediate'] },
  { name: 'Nadia', levels: ['Basic', 'Basic', 'Intermediate', 'Advanced', 'Advanced', 'Basic'] },
]

const utilizationTrend = [
  { day: 'Apr 25', value: 72 },
  { day: 'Apr 30', value: 74 },
  { day: 'May 5', value: 76 },
  { day: 'May 10', value: 78 },
  { day: 'May 15', value: 80 },
  { day: 'May 20', value: 80 },
  { day: 'May 24', value: 79 },
]

const HEALTH_GAUGE_VALUE = 79

function utilizationTone(value: number): string {
  if (value > 100) return '#ef4444'
  if (value >= 80) return '#f97316'
  return '#10b981'
}

function skillTone(level: SkillLevel): string {
  switch (level) {
    case 'Expert':
      return 'bg-emerald-500/90 text-white'
    case 'Advanced':
      return 'bg-emerald-200 text-emerald-900'
    case 'Intermediate':
      return 'bg-amber-100 text-amber-800'
    default:
      return 'bg-rose-100 text-rose-700'
  }
}

function ChartTooltipShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-[11px] shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur-sm">
      {children}
    </div>
  )
}

// Intelligence Control Tower design system — mirrors Work Execution Overview
// in Task & Work Management (glass chart panels with accent bar + icon chip,
// executive donut, intelligence donut, distribution rows).
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

const HEALTH_SEG: Record<string, [string, string]> = {
  Healthy: ['#34d399', '#10b981'],
  'At Risk': ['#fbbf24', '#f59e0b'],
  Critical: ['#fb7185', '#f43f5e'],
}
const TYPE_PIE_COLORS = ['#a78bfa', '#7dd3fc', '#60a5fa', '#86efac', '#fbbf24', '#94a3b8']

function withPct(rows: Array<{ name: string; value: number }>): Array<{ name: string; value: number; pct: string }> {
  const total = rows.reduce((sum, row) => sum + row.value, 0) || 1
  return rows.map((row) => ({ ...row, pct: `${Math.round((row.value / total) * 100)}%` }))
}

const resourceHealthDonut = withPct([
  { name: 'Healthy', value: 2 },
  { name: 'At Risk', value: 1 },
  { name: 'Critical', value: 1 },
])
const statusDonut = withPct(statusDistribution.map((s) => ({ name: s.name, value: s.value })))
const STATUS_PIE_COLORS = statusDistribution.map((s) => s.color)
const workspaceDonut = withPct(workspaceAllocation.map((w) => ({ name: w.name, value: w.allocated })))

function OverviewChartPanel({
  title,
  description,
  icon: Icon,
  tone,
  right,
  children,
}: {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  tone: OverviewTone
  right?: React.ReactNode
  children: React.ReactNode
}) {
  const t = OVERVIEW_PANEL_TONES[tone]
  return (
    <Card
      className={cn(
        'relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border-slate-200/90 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.08)]',
        'bg-[linear-gradient(160deg,rgba(255,255,255,0.94),rgba(248,250,252,0.90))]'
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
          <p className="mt-1 text-xs text-slate-600">{description}</p>
        </div>
        {right}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </Card>
  )
}

function OverviewFootnote({ tone = 'info', children }: { tone?: 'info' | 'warning'; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-medium',
        tone === 'warning' ? 'border-amber-100 bg-amber-50/70 text-amber-700' : 'border-sky-100 bg-sky-50/60 text-sky-700'
      )}
    >
      {tone === 'warning' ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> : <Info className="h-3.5 w-3.5 shrink-0" />}
      <span>{children}</span>
    </div>
  )
}

/** Donut + legend rows with progress bars (intelligence donut). */
function OverviewDonut({
  data,
  centerLabel,
  pieColors,
  unit = 'items',
}: {
  data: Array<{ name: string; value: number; pct: string }>
  centerLabel: string
  pieColors: string[]
  unit?: string
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const donutIdBase = useMemo(() => `res-${centerLabel.toLowerCase().replace(/\s+/g, '-')}`, [centerLabel])

  return (
    <div className="grid items-center gap-5 lg:grid-cols-[176px,1fr]">
      <div className="relative mx-auto h-44 w-44 shrink-0">
        <div className="pointer-events-none absolute -inset-3 rounded-full" style={{ background: 'conic-gradient(from 220deg, rgba(99,102,241,0.15), rgba(14,165,233,0.11), rgba(16,185,129,0.13), rgba(99,102,241,0.15))', filter: 'blur(1px)' }} />
        <div className="pointer-events-none absolute inset-2 rounded-full border border-white/90 bg-gradient-to-br from-white/95 via-slate-50/95 to-slate-100/85 shadow-[0_14px_32px_rgba(15,23,42,0.10)]" />
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <PieChart>
              <defs>
                {data.map((entry, index) => {
                  const sc = pieColors[index % pieColors.length]
                  return (
                    <linearGradient key={entry.name} id={`${donutIdBase}-seg-${index}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={sc} stopOpacity={1} />
                      <stop offset="100%" stopColor={sc} stopOpacity={0.8} />
                    </linearGradient>
                  )
                })}
              </defs>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={46}
                outerRadius={68}
                cornerRadius={6}
                paddingAngle={2.5}
                dataKey="value"
                stroke="white"
                strokeWidth={1.5}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                style={{ outline: 'none' }}
              >
                {data.map((entry, index) => {
                  const dimmed = activeIndex !== null && activeIndex !== index
                  return <Cell key={entry.name} fill={`url(#${donutIdBase}-seg-${index})`} fillOpacity={dimmed ? 0.4 : 1} style={{ outline: 'none' }} />
                })}
              </Pie>
              <Tooltip formatter={(value: number, name: string) => [`${value} ${unit}`, name]} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="rounded-2xl border border-white/90 px-4 py-2 text-center backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.88)', boxShadow: '0 8px 22px rgba(15,23,42,0.10)' }}>
            <div className="text-2xl font-bold leading-none tracking-tight text-slate-900">{total}</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{centerLabel}</div>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {data.map((item, idx) => {
          const sc = pieColors[idx % pieColors.length]
          const ratio = total > 0 ? Math.max(0, Math.min(100, Math.round((item.value / total) * 100))) : 0
          const isActive = activeIndex === idx
          return (
            <div
              key={item.name}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
              className={cn(
                'rounded-xl border px-3 py-2 transition-all duration-200',
                isActive ? 'border-slate-300 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.08)]' : 'border-slate-200/90 bg-white/80 hover:border-slate-300 hover:bg-white'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: sc }} />
                  <span className="text-sm font-medium text-slate-700">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 tabular-nums">{item.value}</span>
                  <span className="w-10 text-right text-xs font-semibold" style={{ color: sc }}>{item.pct}</span>
                </div>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${ratio}%`, background: `linear-gradient(90deg, ${sc}, ${sc}bb)` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Executive donut with center index + resilience pills + signal tiles. */
function OverviewExecutiveDonut({ data }: { data: Array<{ name: string; value: number; pct: string }> }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const healthy = data.find((d) => d.name === 'Healthy')?.value ?? 0
  const atRisk = data.find((d) => d.name === 'At Risk')?.value ?? 0
  const critical = data.find((d) => d.name === 'Critical')?.value ?? 0
  const executionIndex = total > 0 ? Math.round(((healthy * 1 + atRisk * 0.55 + critical * 0.2) / total) * 100) : 0
  const criticalPct = total > 0 ? Math.round((critical / total) * 100) : 0
  const stabilityScore = Math.max(0, Math.min(100, executionIndex + Math.round((healthy / Math.max(1, total)) * 14) - Math.round((critical / Math.max(1, total)) * 18)))
  const segOf = (name: string): [string, string] => HEALTH_SEG[name] ?? HEALTH_SEG.Healthy

  return (
    <div className="grid gap-5 lg:grid-cols-[200px,1fr] lg:items-center">
      <div className="relative mx-auto h-52 w-52">
        <div className="pointer-events-none absolute -inset-4 rounded-full" style={{ background: 'radial-gradient(ellipse 90% 90% at 50% 50%, rgba(16,185,129,0.15) 0%, rgba(14,165,233,0.10) 40%, transparent 72%)' }} />
        <div className="pointer-events-none absolute -inset-2 rounded-full" style={{ background: 'conic-gradient(from 180deg, rgba(16,185,129,0.28), rgba(14,165,233,0.22), rgba(244,63,94,0.18), rgba(16,185,129,0.28))', filter: 'blur(2px)', opacity: 0.6 }} />
        <div className="pointer-events-none absolute inset-3 rounded-full border border-white/80 bg-gradient-to-br from-slate-50/90 via-white/95 to-slate-100/85 shadow-[0_22px_52px_rgba(15,23,42,0.14)]" />
        <div className="pointer-events-none absolute left-1/2 top-1 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-emerald-200/80 bg-emerald-50/95 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 shadow-sm">
          Staffing Resilience
        </div>
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <PieChart>
              <defs>
                <linearGradient id="res-health-healthy" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={HEALTH_SEG.Healthy[0]} /><stop offset="100%" stopColor={HEALTH_SEG.Healthy[1]} /></linearGradient>
                <linearGradient id="res-health-risk" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={HEALTH_SEG['At Risk'][0]} /><stop offset="100%" stopColor={HEALTH_SEG['At Risk'][1]} /></linearGradient>
                <linearGradient id="res-health-critical" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={HEALTH_SEG.Critical[0]} /><stop offset="100%" stopColor={HEALTH_SEG.Critical[1]} /></linearGradient>
              </defs>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={54}
                outerRadius={82}
                cornerRadius={8}
                paddingAngle={2}
                dataKey="value"
                stroke="#ffffff"
                strokeWidth={3}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {data.map((entry, index) => {
                  const gradientId = entry.name === 'Healthy' ? 'res-health-healthy' : entry.name === 'At Risk' ? 'res-health-risk' : 'res-health-critical'
                  const dimmed = activeIndex !== null && activeIndex !== index
                  return <Cell key={entry.name} fill={`url(#${gradientId})`} fillOpacity={dimmed ? 0.35 : 1} />
                })}
              </Pie>
              <Tooltip formatter={(value: number, name: string) => [`${value} resources`, name]} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl font-bold leading-none tracking-tight text-slate-900">{total}</div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.15em] text-slate-500">Resources</div>
          <div className="mt-2 rounded-full border border-slate-300 bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-slate-700 shadow-sm">Allocation Index {executionIndex}</div>
        </div>
        <div className="pointer-events-none absolute bottom-2 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-slate-200/80 bg-white/95 px-3 py-1 text-[10px] font-semibold text-slate-600 shadow-[0_8px_22px_rgba(15,23,42,0.08)]">
          Stability Score {stabilityScore}
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white via-slate-50/75 to-slate-100/80 px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Executive Signal</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{executionIndex >= 80 ? 'Stable Staffing' : executionIndex >= 65 ? 'Watchlist Required' : 'Immediate Intervention'}</div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white px-3 py-2 shadow-[0_8px_24px_rgba(16,185,129,0.10)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-500">Healthy Coverage</div>
            <div className="mt-1 text-sm font-semibold text-emerald-700">{total > 0 ? Math.round((healthy / total) * 100) : 0}% of pool</div>
          </div>
          <div className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white px-3 py-2 shadow-[0_8px_24px_rgba(244,63,94,0.10)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-500">Critical Exposure</div>
            <div className="mt-1 text-sm font-semibold text-rose-700">{criticalPct}% of pool</div>
          </div>
        </div>

        <div className="space-y-1.5">
          {data.map((item, idx) => {
            const [c0, c1] = segOf(item.name)
            return (
              <div
                key={item.name}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
                className={cn(
                  'flex items-center justify-between rounded-xl border px-3 py-2 transition-all duration-200',
                  activeIndex === idx ? 'border-slate-300 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.08)]' : 'border-slate-200 bg-white/80 hover:border-slate-300 hover:bg-white'
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: `linear-gradient(135deg,${c0},${c1})` }} />
                  <span className="text-sm font-medium text-slate-700">{item.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="w-6 text-right text-sm font-semibold text-slate-900">{item.value}</span>
                  <span className="w-11 text-right text-xs font-semibold text-slate-500">{item.pct}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ResourceExecutionOverview() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {/* ROW 1 — Resource health (executive donut) + status distribution */}
      <OverviewChartPanel
        title="Resource Health Distribution"
        description="Healthy vs at-risk vs critical staffing posture across the resource pool."
        icon={ShieldCheck}
        tone="emerald"
      >
        <OverviewExecutiveDonut data={resourceHealthDonut} />
      </OverviewChartPanel>

      <OverviewChartPanel
        title="Resource Status Distribution"
        description="Distribution of resources by current availability status."
        icon={Activity}
        tone="sky"
        right={<Badge className="rounded-full border border-blue-200 bg-blue-50 text-[11px] text-blue-700">Current posture</Badge>}
      >
        <OverviewDonut data={statusDonut} centerLabel="Resources" pieColors={STATUS_PIE_COLORS} unit="resources" />
      </OverviewChartPanel>

      {/* ROW 2 — Utilization by person + capacity vs allocation */}
      <OverviewChartPanel
        title="Resource Utilization by Person"
        description="Utilization percentage of individual resources."
        icon={Users}
        tone="amber"
      >
        <div className="space-y-2.5">
          {utilizationByPerson.map((p) => {
            const color = utilizationTone(p.utilization)
            return (
              <div key={p.name} className="flex items-center gap-2.5 text-xs">
                <span className="w-14 shrink-0 truncate font-medium text-slate-700">{p.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, p.utilization)}%`, background: color }} />
                </div>
                <span className="w-9 shrink-0 text-right font-semibold text-slate-900 tabular-nums">{p.allocated}h</span>
                <span className="w-10 shrink-0 text-right font-semibold tabular-nums" style={{ color }}>{p.utilization}%</span>
              </div>
            )
          })}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />&lt;80%</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" />80–100%</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />&gt;100%</span>
          </div>
        </div>
        <OverviewFootnote tone="info">1 resource approaching capacity limit.</OverviewFootnote>
      </OverviewChartPanel>

      <OverviewChartPanel
        title="Capacity vs Allocation"
        description="Compare available capacity against allocated workload."
        icon={BarChart3}
        tone="violet"
        right={<Badge className="rounded-full border border-rose-200 bg-rose-50 text-[11px] text-rose-600">Over capacity</Badge>}
      >
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <BarChart data={capacityVsAllocation} margin={{ top: 18, right: 6, left: -18, bottom: 0 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 140]} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as (typeof capacityVsAllocation)[number]
                  const over = d.allocated > d.capacity
                  return (
                    <ChartTooltipShell>
                      <div className="font-semibold text-slate-900">{d.name}</div>
                      <div className="mt-1 space-y-0.5 text-slate-600">
                        <div>Capacity: {d.capacity}h</div>
                        <div>Allocated: {d.allocated}h</div>
                        {over ? <div className="font-semibold text-rose-600">Overloaded by {d.allocated - d.capacity}h</div> : null}
                      </div>
                    </ChartTooltipShell>
                  )
                }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 10, color: '#64748b' }} />
              <Bar name="Capacity" dataKey="capacity" radius={[4, 4, 0, 0]} maxBarSize={20} fill="#3b82f6" />
              <Bar name="Allocated" dataKey="allocated" radius={[4, 4, 0, 0]} maxBarSize={20}>
                {capacityVsAllocation.map((entry) => (
                  <Cell key={entry.name} fill={entry.allocated > entry.capacity ? '#ef4444' : '#22c55e'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <OverviewFootnote tone="warning">1 resource exceeds planned capacity.</OverviewFootnote>
      </OverviewChartPanel>

      {/* ROW 3 — Demand forecast + allocation by workspace */}
      <OverviewChartPanel
        title="Resource Demand Forecast"
        description="Forecast demand vs available capacity per sprint."
        icon={TrendingUp}
        tone="cyan"
        right={<Badge className="flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 text-[11px] text-rose-600"><AlertTriangle className="h-3 w-3" /> -45h</Badge>}
      >
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <LineChart data={demandForecast} margin={{ top: 18, right: 12, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="tectona-demand-gap" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="sprint" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis domain={[80, 190]} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const demand = payload.find((p) => p.dataKey === 'demand')?.value as number
                  const available = payload.find((p) => p.dataKey === 'available')?.value as number
                  return (
                    <ChartTooltipShell>
                      <div className="font-semibold text-slate-900">{label}</div>
                      <div className="mt-1 space-y-0.5 text-slate-600">
                        <div>Demand: {demand}h</div>
                        <div>Available: {available}h</div>
                        <div className={cn('font-semibold', demand > available ? 'text-rose-600' : 'text-emerald-600')}>
                          Gap: {available - demand}h
                        </div>
                      </div>
                    </ChartTooltipShell>
                  )
                }}
              />
              <Legend iconType="plainline" wrapperStyle={{ fontSize: 10, color: '#64748b' }} />
              <Area type="monotone" dataKey="demand" stroke="none" fill="url(#tectona-demand-gap)" legendType="none" />
              <Line name="Demand Capacity" type="monotone" dataKey="demand" stroke="#6366f1" strokeWidth={2.4} dot={{ r: 3, fill: '#6366f1' }} />
              <Line name="Available Capacity" type="monotone" dataKey="available" stroke="#10b981" strokeWidth={2.4} strokeDasharray="5 4" dot={{ r: 3, fill: '#10b981' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <OverviewFootnote tone="warning">Capacity deficit predicted in Sprint 4.</OverviewFootnote>
      </OverviewChartPanel>

      <OverviewChartPanel
        title="Allocation by Workspace"
        description="Allocated FTE share across delivery workspaces."
        icon={Layers}
        tone="indigo"
      >
        <OverviewDonut data={workspaceDonut} centerLabel="FTE" pieColors={TYPE_PIE_COLORS} unit="FTE" />
        <OverviewFootnote tone="info">AI CoE currently consumes highest capacity.</OverviewFootnote>
      </OverviewChartPanel>

      {/* ROW 4 — Skill coverage matrix + utilization trend */}
      <OverviewChartPanel
        title="Skill Coverage Matrix"
        description="Skill proficiency coverage across resources."
        icon={Target}
        tone="rose"
      >
        <div className="flex flex-1 flex-col">
          <div className="grid grid-cols-[56px_repeat(6,1fr)] gap-1 text-[10px]">
            <div />
            {SKILL_COLUMNS.map((col) => (
              <div key={col} className="pb-1 text-center font-semibold text-slate-500">{col}</div>
            ))}
            {skillMatrix.map((row) => (
              <FragmentRow key={row.name} name={row.name} levels={row.levels} />
            ))}
          </div>
          <div className="mt-auto flex flex-wrap items-center justify-center gap-3 pt-3 text-[9px] text-slate-500">
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/90" />Expert</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-200" />Advanced</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-100" />Intermediate</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-rose-100" />Basic</span>
          </div>
        </div>
        <OverviewFootnote tone="warning">Python expertise concentrated in only 2 resources.</OverviewFootnote>
      </OverviewChartPanel>

      <OverviewChartPanel
        title="Utilization Trend"
        description="Average utilization trend over the last 30 days."
        icon={CalendarClock}
        tone="sky"
        right={<Badge className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700"><TrendingUp className="h-3 w-3" /> 8%</Badge>}
      >
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <AreaChart data={utilizationTrend} margin={{ top: 18, right: 12, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="tectona-util-trend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis domain={[60, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <ChartTooltipShell>
                      <div className="font-semibold text-slate-900">{label}</div>
                      <div className="mt-1 text-slate-600">Avg Utilization: {payload[0].value as number}%</div>
                    </ChartTooltipShell>
                  )
                }}
              />
              <Area name="Average Utilization %" type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2.4} fill="url(#tectona-util-trend)" dot={{ r: 2.5, fill: '#2563eb' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <OverviewFootnote tone="info">Utilization increased 8% this month.</OverviewFootnote>
      </OverviewChartPanel>

      {/* ROW 5 — Allocation health gauge + AI resource insight */}
      <OverviewChartPanel
        title="Allocation Health"
        description="Overall health of resource allocation."
        icon={Gauge}
        tone="emerald"
      >
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="relative h-40 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <RadialBarChart
                innerRadius="74%"
                outerRadius="100%"
                data={[{ name: 'health', value: HEALTH_GAUGE_VALUE, fill: '#22c55e' }]}
                startAngle={210}
                endAngle={-30}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background={{ fill: '#eef2f7' }} dataKey="value" cornerRadius={12} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold leading-none text-slate-900">{HEALTH_GAUGE_VALUE}%</span>
              <span className="mt-1 text-xs font-semibold text-emerald-600">Healthy</span>
            </div>
          </div>
          <div className="mt-1 flex items-center justify-center gap-3 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" />Critical</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Warning</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Healthy</span>
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-400">Enterprise allocation health.</p>
        </div>
      </OverviewChartPanel>

      <OverviewChartPanel
        title="AI Resource Insight"
        description="AI-generated insights and recommendations."
        icon={Sparkles}
        tone="violet"
        right={
          <Badge className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 text-[11px] font-semibold text-violet-700">
            <Sparkles className="h-3 w-3" /> AI 92%
          </Badge>
        }
      >
        <div className="flex flex-1 flex-col">
          <ul className="space-y-2">
            {[
              { tone: 'critical', text: 'Jonas is overloaded at 110% capacity.' },
              { tone: 'warning', text: 'AI CoE lacks 2 backend engineers in Sprint 4.' },
              { tone: 'info', text: 'Mina is underutilized by 28% this week.' },
              { tone: 'warning', text: 'Sprint 4 forecast shows overall capacity shortage.' },
            ].map((item) => (
              <li
                key={item.text}
                className={cn(
                  'flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] leading-4',
                  item.tone === 'critical'
                    ? 'border-rose-100 bg-rose-50/60 text-rose-700'
                    : item.tone === 'warning'
                      ? 'border-amber-100 bg-amber-50/60 text-amber-700'
                      : 'border-sky-100 bg-sky-50/60 text-sky-700'
                )}
              >
                {item.tone === 'info' ? (
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span className="text-slate-700">{item.text}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-wrap gap-2 pt-3">
            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-90">
              <Wand2 className="h-3.5 w-3.5" /> Rebalance
            </button>
            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900">
              <Users className="h-3.5 w-3.5" /> Find Candidate
            </button>
            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900">
              <TrendingUp className="h-3.5 w-3.5" /> Simulate Allocation
            </button>
          </div>
          <p className="mt-2 text-[10px] text-slate-400">Recommendations generated 5 minutes ago.</p>
        </div>
      </OverviewChartPanel>
    </div>
  )
}

function FragmentRow({ name, levels }: { name: string; levels: SkillLevel[] }) {
  return (
    <>
      <div className="flex items-center pr-1 text-[10px] font-semibold text-slate-600">{name}</div>
      {levels.map((level, idx) => (
        <div
          key={`${name}-${SKILL_COLUMNS[idx]}`}
          title={`${name} · ${SKILL_COLUMNS[idx]}: ${level}`}
          className={cn('flex h-9 items-center justify-center rounded-md text-[9px] font-semibold', skillTone(level))}
        >
          {level.slice(0, 3)}
        </div>
      ))}
    </>
  )
}

export function ResourceManagementPage() {
  const sidebarFixed = usePreferencesStore((s) => s.preferences.sidebarFixed ?? false)
  const sidebarMini = usePreferencesStore((s) => s.preferences.sidebarMini ?? true)
  const navDocked = isWorkspaceNavDocked(sidebarFixed)
  const enterpriseNavTitlesOnly = usePreferencesStore((s) => s.preferences.enterpriseNavTitlesOnly ?? false)
  const enterpriseNavSimpleList = usePreferencesStore((s) => s.preferences.enterpriseNavSimpleList ?? false)
  const enterpriseNavCompact = enterpriseNavTitlesOnly || enterpriseNavSimpleList
  const fixedSidebarUiOn = !sidebarFixed
  const enterpriseNavUltra = fixedSidebarUiOn && sidebarMini && enterpriseNavTitlesOnly && enterpriseNavSimpleList
  const enterpriseNavWidthVariant = enterpriseNavUltra ? 'ultra' : enterpriseNavCompact ? 'compact' : 'default'
  // Match Document & Knowledge Management: 260px panel width without enabling compact content behavior.
  const enterpriseNavLayoutVariant = enterpriseNavWidthVariant === 'default' ? 'compact' : enterpriseNavWidthVariant

  const [resources] = useState(resourceSeed)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(resourceSeed[0].id)
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(false)
  const [showKpiCards, setShowKpiCards] = useState(true)
  const [activePanel, setActivePanel] = useState<PanelId>('overview')
  const [showFiltersPanel, setShowFiltersPanel] = useState(true)
  const [resourceGroupBy, setResourceGroupBy] = useState<ResourceTableGroupByKey | null>(null)
  const [resourcePageSize, setResourcePageSize] = useState(10)
  const [resourcePage, setResourcePage] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isOverviewSectionActive = activePanel === 'overview'

  const filtered = useMemo(
    () =>
      resources.filter((item) =>
        [item.name, item.role, item.team, item.workspace].join(' ').toLowerCase().includes(search.toLowerCase())
      ),
    [resources, search]
  )
  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0]

  // --- Operational Resource Directory enterprise table state ---------------
  const [resourceTableSort, setResourceTableSort] = useState<{ key: ResourceTableColumnKey; dir: 'asc' | 'desc' } | null>(null)
  const [showResourceTableSelection, setShowResourceTableSelection] = useState(false)
  const [resourceTableSelectedIds, setResourceTableSelectedIds] = useState<string[]>([])
  const [resourceFilterRole, setResourceFilterRole] = useState<Set<string>>(new Set())
  const [resourceFilterTeam, setResourceFilterTeam] = useState<Set<string>>(new Set())
  const [resourceFilterWorkspace, setResourceFilterWorkspace] = useState<Set<string>>(new Set())
  const [resourceFilterAvailability, setResourceFilterAvailability] = useState<Set<string>>(new Set())

  const toggleResourceFilterValue = useCallback(
    (setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) => {
      setter((prev) => {
        const next = new Set(prev)
        if (next.has(value)) next.delete(value)
        else next.add(value)
        return next
      })
    },
    []
  )

  const buildResourceFilterOptions = useCallback(
    (accessor: (item: ResourceRecord) => string) => {
      const counts = new Map<string, number>()
      filtered.forEach((item) => {
        const value = accessor(item)
        counts.set(value, (counts.get(value) ?? 0) + 1)
      })
      return Array.from(counts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([value, count]) => ({ value, count }))
    },
    [filtered]
  )

  const resourceRoleFilterOptions = useMemo(() => buildResourceFilterOptions((item) => item.role), [buildResourceFilterOptions])
  const resourceTeamFilterOptions = useMemo(() => buildResourceFilterOptions((item) => item.team), [buildResourceFilterOptions])
  const resourceWorkspaceFilterOptions = useMemo(() => buildResourceFilterOptions((item) => item.workspace), [buildResourceFilterOptions])
  const resourceAvailabilityFilterOptions = useMemo(() => buildResourceFilterOptions((item) => item.availabilityStatus), [buildResourceFilterOptions])

  const columnFilteredResources = useMemo(() => {
    return filtered.filter((item) => {
      if (resourceFilterRole.size > 0 && !resourceFilterRole.has(item.role)) return false
      if (resourceFilterTeam.size > 0 && !resourceFilterTeam.has(item.team)) return false
      if (resourceFilterWorkspace.size > 0 && !resourceFilterWorkspace.has(item.workspace)) return false
      if (resourceFilterAvailability.size > 0 && !resourceFilterAvailability.has(item.availabilityStatus)) return false
      return true
    })
  }, [filtered, resourceFilterRole, resourceFilterTeam, resourceFilterWorkspace, resourceFilterAvailability])

  const toggleResourceTableSort = useCallback((key: ResourceTableColumnKey) => {
    setResourceTableSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }, [])

  const sortedResources = useMemo(() => {
    if (!resourceTableSort) return columnFilteredResources
    const { key, dir } = resourceTableSort
    const mul = dir === 'asc' ? 1 : -1
    const valueByKey = (item: ResourceRecord): string | number => {
      switch (key) {
        case 'name': return item.name
        case 'role': return item.role
        case 'team': return item.team
        case 'workspace': return item.workspace
        case 'allocation': return item.allocation
        case 'utilization': return item.utilization
        case 'availability': return item.availabilityStatus
        case 'action': return recommendedResourceAction(item).label
      }
    }
    return [...columnFilteredResources].sort((a, b) => {
      const left = valueByKey(a)
      const right = valueByKey(b)
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * mul
      return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' }) * mul
    })
  }, [columnFilteredResources, resourceTableSort])

  const resourceFlatRows = useMemo(() => {
    if (resourceGroupBy) {
      const grouped = [...sortedResources].sort((a, b) =>
        resourceGroupLabel(a, resourceGroupBy).localeCompare(resourceGroupLabel(b, resourceGroupBy), undefined, { sensitivity: 'base' })
      )
      return grouped.map((item) => ({ item, groupLabel: resourceGroupLabel(item, resourceGroupBy) as string | null }))
    }
    return sortedResources.map((item) => ({ item, groupLabel: null as string | null }))
  }, [sortedResources, resourceGroupBy])
  const resourceTotalPages = Math.max(1, Math.ceil(resourceFlatRows.length / resourcePageSize))
  const resourcePageSafe = Math.min(resourcePage, resourceTotalPages)
  const resourceStart = resourceFlatRows.length === 0 ? 0 : (resourcePageSafe - 1) * resourcePageSize + 1
  const resourceEnd = Math.min(resourceFlatRows.length, resourcePageSafe * resourcePageSize)
  const pagedResourceRows = resourceFlatRows.slice(resourceStart === 0 ? 0 : resourceStart - 1, resourceEnd)
  const resetResourceFilters = () => {
    setSearch('')
    setResourceFilterRole(new Set())
    setResourceFilterTeam(new Set())
    setResourceFilterWorkspace(new Set())
    setResourceFilterAvailability(new Set())
    setResourceGroupBy(null)
    setResourcePage(1)
  }
  const resourceHealthPct = useMemo(
    () => (resources.length === 0 ? 0 : Math.round(resources.reduce((sum, item) => sum + item.utilization, 0) / resources.length)),
    [resources]
  )

  const { tableRef: resourceTableRef, ...resourceTableColumns } = useEnterpriseSortableColumns<ResourceTableColumnKey>({
    initialOrder: RESOURCE_TABLE_DEFAULT_COLUMN_ORDER,
    pinnedFirstKey: RESOURCE_TABLE_PINNED_FIRST_COLUMN,
    hasSelectionColumn: showResourceTableSelection,
    onColumnHidden: (key) => {
      if (resourceGroupBy && (key as string) === resourceGroupBy) setResourceGroupBy(null)
    },
  })

  const toggleResourceTableRowSelection = useCallback((id: string) => {
    setResourceTableSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const setShowResourceTableSelectionSafe = useCallback((checked: boolean) => {
    setShowResourceTableSelection(checked)
    if (!checked) setResourceTableSelectedIds([])
  }, [])

  const renderResourceTableCell = (item: ResourceRecord, key: ResourceTableColumnKey) => {
    switch (key) {
      case 'name':
        return (
          <div className="min-w-0">
            <div className="truncate font-semibold text-slate-900">{item.name}</div>
            <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-slate-400">{resourceCode(item)}</div>
          </div>
        )
      case 'role':
        return <span className="text-slate-600">{item.role}</span>
      case 'team':
        return <span className="text-slate-600">{item.team}</span>
      case 'workspace':
        return <span className="text-slate-600">{item.workspace}</span>
      case 'allocation':
        return <ResourceMetricBar value={item.allocation} />
      case 'utilization':
        return <ResourceMetricBar value={item.utilization} criticalAt={92} />
      case 'availability':
        return <AvailabilityBadge value={item.availabilityStatus} />
      case 'action': {
        const action = recommendedResourceAction(item)
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', action.className)}>{action.label}</Badge>
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:border-blue-300 hover:text-blue-700"
              onClick={(event) => {
                event.stopPropagation()
                setSelectedId(item.id)
                setDrawerOpen(true)
              }}
            >
              Open
            </button>
          </div>
        )
      }
    }
  }

  const renderResourceFilterSlot = (key: ResourceTableColumnKey) => {
    switch (key) {
      case 'role':
        return (
          <EnterpriseColumnFilterDropdown
            label="Role"
            ariaLabel="Filter by delivery role"
            options={resourceRoleFilterOptions}
            selected={resourceFilterRole}
            onToggleOption={(value) => toggleResourceFilterValue(setResourceFilterRole, value)}
            onShowAll={() => setResourceFilterRole(new Set())}
          />
        )
      case 'team':
        return (
          <EnterpriseColumnFilterDropdown
            label="Team"
            ariaLabel="Filter by operational team"
            options={resourceTeamFilterOptions}
            selected={resourceFilterTeam}
            onToggleOption={(value) => toggleResourceFilterValue(setResourceFilterTeam, value)}
            onShowAll={() => setResourceFilterTeam(new Set())}
          />
        )
      case 'workspace':
        return (
          <EnterpriseColumnFilterDropdown
            label="Workspace"
            ariaLabel="Filter by assigned workspace"
            options={resourceWorkspaceFilterOptions}
            selected={resourceFilterWorkspace}
            onToggleOption={(value) => toggleResourceFilterValue(setResourceFilterWorkspace, value)}
            onShowAll={() => setResourceFilterWorkspace(new Set())}
          />
        )
      case 'availability':
        return (
          <EnterpriseColumnFilterDropdown
            label="Availability"
            ariaLabel="Filter by availability"
            options={resourceAvailabilityFilterOptions}
            selected={resourceFilterAvailability}
            onToggleOption={(value) => toggleResourceFilterValue(setResourceFilterAvailability, value)}
            onShowAll={() => setResourceFilterAvailability(new Set())}
          />
        )
      default:
        return undefined
    }
  }

  const navPanelRef = useRef<HTMLDivElement | null>(null)
  const activeMainPanelRef = useRef<HTMLElement | null>(null)
  const [navPanelHeightPx, setNavPanelHeightPx] = useState<number | null>(null)
  const [mainPanelViewportHeightPx, setMainPanelViewportHeightPx] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (
      activePanel !== 'overview'
      && activePanel !== 'directory'
      && activePanel !== 'capacity'
      && activePanel !== 'insight'
      && activePanel !== 'activity'
    ) {
      setMainPanelViewportHeightPx(null)
      return
    }

    const compute = () => {
      const el = activeMainPanelRef.current
      if (!el) return
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

    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('resize', compute)
      ro.disconnect()
    }
  }, [activePanel, isWorkspaceCollapsed, showFiltersPanel, sidebarFixed])

  useLayoutEffect(() => {
    if (navDocked) {
      setNavPanelHeightPx(null)
      return
    }

    const compute = () => {
      const navEl = navPanelRef.current
      if (!navEl) return

      const mainPanelEl =
        activePanel === 'overview'
        || activePanel === 'directory'
        || activePanel === 'capacity'
        || activePanel === 'insight'
        || activePanel === 'activity'
          ? activeMainPanelRef.current
          : null
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
    activePanel,
    isWorkspaceCollapsed,
    mainPanelViewportHeightPx,
    navDocked,
    showFiltersPanel,
    sidebarFixed,
    resourceHealthPct,
    filtered.length,
  ])

  const kpis = [
    {
      id: 'total',
      label: 'Total Resource',
      value: `${resources.length}`,
      subtext: 'Resource aktif dalam workspace saat ini',
      trend: '+6%',
      icon: Users,
      trendColor: '#0ea5e9',
      trendSeries: [2, 3, 3, 4, 4, 4, 5, resources.length],
    },
    {
      id: 'high',
      label: 'High Utilization',
      value: `${resources.filter((x) => x.utilization > 90).length}`,
      subtext: 'Needs rebalancing to prevent overcapacity',
      trend: '+1',
      icon: AlertTriangle,
      trendColor: '#f97316',
      trendSeries: [1, 1, 1, 2, 2, 2, 2, 2],
    },
    {
      id: 'available',
      label: 'Available',
      value: `${resources.filter((x) => x.availabilityStatus === 'Available').length}`,
      subtext: 'Capacity ready for quick allocation',
      trend: '-1',
      icon: CheckCircle2,
      trendColor: '#10b981',
      trendSeries: [1, 2, 2, 2, 3, 3, 3, 2],
    },
    {
      id: 'avg',
      label: 'Avg Utilization',
      value: `${Math.round(resources.reduce((a, b) => a + b.utilization, 0) / resources.length)}%`,
      subtext: 'Average utilization across all resources',
      trend: '+2.4%',
      icon: Activity,
      trendColor: '#6366f1',
      trendSeries: [64, 66, 68, 70, 72, 74, 75, 78],
    },
    {
      id: 'over',
      label: 'Overallocated',
      value: `${resources.filter((x) => x.allocation > 100).length}`,
      subtext: 'Resources with allocation exceeding 100%',
      trend: '0',
      icon: Target,
      trendColor: '#f59e0b',
      trendSeries: [0, 1, 1, 1, 1, 1, 1, 1],
    },
    {
      id: 'ws',
      label: 'Workspaces',
      value: `${new Set(resources.map((x) => x.workspace)).size}`,
      subtext: 'Sebaran resource lintas workspace',
      trend: '+1',
      icon: CalendarClock,
      trendColor: '#06b6d4',
      trendSeries: [1, 1, 2, 2, 2, 2, 3, 3],
    },
  ]
  return (
    <div className="min-h-0 space-y-6 pb-0">
      <div className={cn('space-y-6', workspaceDockedContentInsetClass(navDocked, isWorkspaceCollapsed, enterpriseNavLayoutVariant))}>
        <Breadcrumb items={[{ label: 'Project Management', href: '/project-management' }, { label: 'Resource Management' }]} />
        <PageHeader
          title="Resource Management"
          description="Operational staffing, allocation, and utilization across delivery teams—complements workspace membership without replacing platform authorization."
          right={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-1.5 shadow-sm flex-nowrap shrink-0">
                <button
                  type="button"
                  onClick={() => setShowKpiCards((current) => !current)}
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
                  onClick={() => setIsWorkspaceCollapsed((current) => !current)}
                  className={cn(
                    'flex items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-all duration-200 hover:bg-background hover:text-foreground hover:shadow-sm',
                    !isWorkspaceCollapsed && 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                  )}
                  aria-label={isWorkspaceCollapsed ? 'Show enterprise navigation' : 'Hide enterprise navigation'}
                  title={isWorkspaceCollapsed ? 'Show enterprise navigation' : 'Hide enterprise navigation'}
                >
                  <PanelLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-all duration-200 hover:bg-background hover:text-foreground hover:shadow-sm"
                  aria-label="Export resource snapshot"
                  title="Export resource snapshot"
                >
                  <Download className="w-5 h-5" />
                </button>
                {!isOverviewSectionActive ? (
                  <button
                    type="button"
                    onClick={() => setShowFiltersPanel((current) => !current)}
                    className={cn(
                      'flex items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-all duration-200 hover:bg-background hover:text-foreground hover:shadow-sm',
                      showFiltersPanel && 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                    )}
                    aria-label={showFiltersPanel ? 'Hide filters panel' : 'Show filters panel'}
                    title={showFiltersPanel ? 'Hide filters panel' : 'Show filters panel'}
                  >
                    <Target className="w-5 h-5" />
                  </button>
                ) : null}
              </div>
            </div>
          }
        />

        {showKpiCards ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {kpis.map((item) => (
              <button key={item.label} type="button" className="group text-left">
                <Card className={kpiCardChrome(item.id)}>
                  <div className="pointer-events-none absolute -right-3 -bottom-4 opacity-[0.08] transition-all duration-500 group-hover:scale-110 group-hover:opacity-[0.12]">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/60 text-slate-700/80 ring-1 ring-white/50 backdrop-blur-sm">
                      <item.icon className="h-7 w-7" />
                    </div>
                  </div>

                  <div className="text-xs text-slate-500">{item.label}</div>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="shrink-0 text-2xl font-bold leading-none text-slate-950">{item.value}</div>
                    <div className="h-10 min-w-0 flex-1">
                      <KpiSparkline data={item.trendSeries} color={item.trendColor} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <item.icon className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                      <span className="truncate">{item.subtext}</span>
                    </span>
                    <span className={cn('shrink-0 font-semibold', item.trend.startsWith('-') ? 'text-rose-600' : 'text-emerald-600')}>
                      {item.trend}
                    </span>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        ) : null}

        <div
          className={cn(
            workspaceOuterGridClass(sidebarFixed, isWorkspaceCollapsed, enterpriseNavLayoutVariant),
            sidebarFixed ? 'items-stretch' : undefined
          )}
        >
        <aside className={cn(workspaceAsideClass(navDocked, isWorkspaceCollapsed, enterpriseNavLayoutVariant), sidebarFixed && 'self-stretch')}>
          <div
            ref={navPanelRef}
            className={cn(
              workspaceNavInnerClass(navDocked, sidebarFixed, isWorkspaceCollapsed),
              'rounded-2xl xl:rounded-r-2xl',
              !navDocked && 'h-full min-h-0 overflow-hidden'
            )}
            style={
              !navDocked && navPanelHeightPx
                ? { height: navPanelHeightPx, maxHeight: navPanelHeightPx, minHeight: navPanelHeightPx }
                : undefined
            }
            aria-label="Resource workspace navigation"
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
                  aria-label={isWorkspaceCollapsed ? 'Expand resource workspace navigation' : 'Collapse resource workspace navigation'}
                  title={isWorkspaceCollapsed ? 'Expand resource workspace navigation' : 'Collapse resource workspace navigation'}
                  onClick={() => setIsWorkspaceCollapsed((v) => !v)}
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
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-100/80">Resource Workspace</div>
                  <div className="mt-1.5 text-sm font-semibold leading-snug">Control tower for resource allocation, capacity, and utilization visibility</div>
                </div>
              ) : null}
            </div>

            <div className={workspaceNavMenuScrollClass()}>
              <div className={cn(enterpriseNavUltra ? 'space-y-1.5' : enterpriseNavCompact ? 'space-y-2' : 'space-y-4')}>
                {PANEL_MENU_GROUPS.map(({ group, items }) => (
                  <div key={group} className="space-y-1.5">
                    {!enterpriseNavCompact ? (
                      <div className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{group}</div>
                    ) : null}
                    {items.map((menu) => {
                      const active = activePanel === menu.id
                      const Icon = menu.icon
                      return (
                        <button
                          key={menu.id}
                          type="button"
                          onClick={() => setActivePanel(menu.id)}
                          className={cn(
                            'group relative flex w-full overflow-hidden border text-left transition-all duration-200',
                            isWorkspaceCollapsed
                              ? 'items-center justify-center rounded-2xl px-2 py-3'
                              : enterpriseNavCompact
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
                          aria-label={menu.label}
                          title={menu.label}
                        >
                          {active ? <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-gradient-to-b from-sky-500 via-blue-600 to-indigo-600" /> : null}
                          <span
                            className={cn(
                              'relative flex shrink-0 items-center justify-center rounded-2xl border transition-colors',
                              enterpriseNavCompact ? 'h-9 w-9' : 'h-11 w-11',
                              active
                                ? 'border-sky-200 bg-sky-50 text-sky-700'
                                : 'border-slate-200/80 bg-slate-50/90 text-slate-600 group-hover:border-slate-300 group-hover:bg-slate-100'
                            )}
                          >
                            <Icon
                              className={cn(
                                'shrink-0',
                                isWorkspaceCollapsed ? 'h-5 w-5' : enterpriseNavCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'
                              )}
                            />
                          </span>
                          {!isWorkspaceCollapsed ? (
                            <span className="min-w-0 flex-1">
                              <span className={cn('flex justify-between gap-2', enterpriseNavCompact ? 'items-center' : 'items-start')}>
                                <span className="block truncate text-sm font-semibold text-slate-900">{menu.label}</span>
                                {!enterpriseNavCompact ? (
                                  <span
                                    className={cn(
                                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                                      active ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'
                                    )}
                                  >
                                    {menu.badge}
                                  </span>
                                ) : null}
                              </span>
                              {!enterpriseNavCompact ? (
                                <span className="mt-1 block text-[11px] leading-4 text-slate-500">{menu.description}</span>
                              ) : null}
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>

              {!enterpriseNavSimpleList ? (
                <div className="shrink-0 space-y-4 pt-4">
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                      <Sparkles className="h-4 w-4" />
                      Resource Health
                    </div>
                    <div className="mt-3 text-3xl font-bold text-slate-900">{resourceHealthPct}%</div>
                    <p className="mt-1 text-xs text-slate-600">Balanced staffing posture with active attention on high-utilization resources.</p>
                    <div className="mt-3 h-2 rounded-full bg-blue-100">
                      <div className="h-2 rounded-full bg-blue-600" style={{ width: `${resourceHealthPct}%` }} />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <div
          className={workspaceMainColumnClass(false, isWorkspaceCollapsed, enterpriseNavLayoutVariant)}
        >
          {/* Outer wrapper already applies workspaceDockedContentInsetClass — pass docked=false
              to avoid double left padding that narrows the panel when Fixed Sidebar is off. */}
          {!isOverviewSectionActive && showFiltersPanel ? (
            <Card className="liquid-glass-enterprise-panel rounded-2xl p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setResourcePage(1)
                  }}
                  className="h-11 rounded-2xl border-slate-200 bg-white pl-9 text-sm"
                  placeholder="Search resource, role, team, or workspace"
                />
              </div>
            </Card>
          ) : null}

          {!isOverviewSectionActive && !showFiltersPanel ? (
            <div className="flex justify-end">
              <Button variant="outline" className="rounded-xl border-slate-200" onClick={() => setShowFiltersPanel(true)}>Show Filters</Button>
            </div>
          ) : null}

          {activePanel === 'overview' ? (
            <Panel
              id="overview"
              title="Resource Execution Overview"
              description="Operational command center for capacity, utilization, allocation, skills, and delivery risk across the resource pool."
              highlight={false}
              headerIcon={<BarChart3 className="h-5 w-5" />}
              showDivider={false}
              outerRef={activeMainPanelRef}
              style={workspaceMainPanelViewportHeightStyle(mainPanelViewportHeightPx)}
              className={cn(mainPanelViewportHeightPx != null && 'overflow-hidden')}
              scrollBody={mainPanelViewportHeightPx != null}
            >
              <ResourceExecutionOverview />
            </Panel>
          ) : null}

          {activePanel === 'directory' ? (
            <Panel
              id="directory"
              title="Operational Resource Directory Panel"
              description="Resource staffing catalog with availability, utilization, allocation load, and quick operational actions."
              highlight={activePanel === 'directory'}
              headerIcon={<Users className="h-5 w-5" />}
              showDivider={false}
              right={
                <div className="flex flex-wrap items-center justify-end gap-3 py-1 text-xs text-muted-foreground">
                  <EnterpriseGroupByControl
                    options={RESOURCE_TABLE_GROUP_BY_OPTIONS}
                    value={resourceGroupBy}
                    onChange={(key) => {
                      setResourceGroupBy(key)
                      setResourcePage(1)
                    }}
                  />
                  <EnterpriseSelectionToggle checked={showResourceTableSelection} onChange={setShowResourceTableSelectionSafe} />
                  <EnterpriseColumnVisibilityControl
                    columns={RESOURCE_TABLE_COLUMN_VISIBILITY_OPTIONS}
                    hidden={resourceTableColumns.hiddenColumns}
                    visibleCount={resourceTableColumns.visibleColumnOrder.length}
                    onToggle={resourceTableColumns.toggleColumnVisibility}
                    onShowAll={resourceTableColumns.showAllColumns}
                    canEnable={resourceTableColumns.canShowColumn}
                  />
                  <p>
                    Showing <span className="font-semibold text-foreground">{resourceStart}</span>-<span className="font-semibold text-foreground">{resourceEnd}</span> of <span className="font-semibold text-foreground">{resourceFlatRows.length}</span>
                  </p>
                  <span>Rows:</span>
                  <Select
                    value={String(resourcePageSize)}
                    onChange={(event) => {
                      setResourcePageSize(parseInt(event.target.value, 10))
                      setResourcePage(1)
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
                      onClick={() => setResourcePage((prev) => Math.max(1, prev - 1))}
                      disabled={resourcePageSafe <= 1}
                    >
                      Previous
                    </button>
                    <div className="flex items-center justify-center px-2 text-xs text-muted-foreground tabular-nums">{resourcePageSafe} / {resourceTotalPages}</div>
                    <button
                      type="button"
                      className="flex items-center justify-center rounded-md px-2 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
                      onClick={() => setResourcePage((prev) => Math.min(resourceTotalPages, prev + 1))}
                      disabled={resourcePageSafe >= resourceTotalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              }
              outerRef={activeMainPanelRef}
              style={workspaceMainPanelViewportHeightStyle(mainPanelViewportHeightPx)}
              className={cn(mainPanelViewportHeightPx != null && 'overflow-hidden')}
              scrollBody={mainPanelViewportHeightPx != null}
            >
              {resourceFlatRows.length > 0 ? (
                <div className="min-h-0 w-full flex-1 overflow-auto rounded-xl">
                  <DndContext sensors={resourceTableColumns.dndSensors} onDragEnd={resourceTableColumns.handleColumnDragEnd}>
                    <table
                      ref={resourceTableRef}
                      className={cn(
                        'border-collapse text-xs select-none',
                        resourceTableColumns.hasAnyCustomWidth || resourceTableColumns.resizingKey ? 'table-fixed w-full' : 'w-full min-w-[1100px]'
                      )}
                    >
                      <colgroup>
                        {showResourceTableSelection ? <col className="w-10" /> : null}
                        {resourceTableColumns.visibleColumnOrder.map((key) => (
                          <col key={key} style={resourceTableColumns.columnWidthStyle(key)} />
                        ))}
                      </colgroup>
                      <thead className="sticky top-0 z-10">
                        <tr className="text-left text-muted-foreground">
                          {showResourceTableSelection ? (
                            <th className="w-10 select-none border-b-[3px] border-double border-slate-300/90 bg-white/90 px-3 py-2 text-left font-semibold backdrop-blur dark:border-slate-600/80 dark:bg-slate-900/90">
                              <input
                                type="checkbox"
                                id="resource-table-select-all"
                                name="resource-table-select-all"
                                checked={resourceTableSelectedIds.length > 0 && resourceTableSelectedIds.length === pagedResourceRows.length}
                                onChange={() =>
                                  setResourceTableSelectedIds(
                                    resourceTableSelectedIds.length === pagedResourceRows.length ? [] : pagedResourceRows.map(({ item }) => item.id)
                                  )
                                }
                                aria-label="Select all rows on this page"
                              />
                            </th>
                          ) : null}
                          <SortableContext items={resourceTableColumns.visibleColumnOrder} strategy={rectSortingStrategy}>
                            {resourceTableColumns.visibleColumnOrder.map((key) => (
                              <EnterpriseSortableHeaderCell
                                key={key}
                                columnKey={key}
                                label={resourceTableColumnLabel(key)}
                                icon={resourceTableColumnHeaderIcon(key)}
                                isPinned={resourceTableColumns.isPinnedColumn(key)}
                                isFirstColumn={resourceTableColumns.isFirstColumn(key)}
                                isLastColumn={resourceTableColumns.isLastColumn(key)}
                                widthStyle={resourceTableColumns.columnWidthStyle(key)}
                                sortDir={resourceTableSort?.key === key ? resourceTableSort.dir : null}
                                onToggleSort={toggleResourceTableSort}
                                filterSlot={renderResourceFilterSlot(key)}
                                frozenColumnClass={resourceTableColumns.frozenColumnHeaderClass}
                                firstColumnTintClass={resourceTableColumns.firstColumnTintHeaderClass}
                                isResizing={resourceTableColumns.resizingKey === key}
                                onBeginResize={resourceTableColumns.beginColumnResize}
                                onContextMenu={() => {}}
                              />
                            ))}
                          </SortableContext>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedResourceRows.map(({ item, groupLabel }, rowIndex) => {
                          const previousGroupLabel = pagedResourceRows[rowIndex - 1]?.groupLabel ?? null
                          const showGroupHeader = resourceGroupBy && groupLabel && groupLabel !== previousGroupLabel
                          const groupTint = resourceGroupBy && groupLabel ? getEnterpriseGroupTint(resourceGroupBy, groupLabel) : null
                          const isChecked = showResourceTableSelection && resourceTableSelectedIds.includes(item.id)
                          const rowBackground = isChecked
                            ? 'bg-primary/10'
                            : groupTint
                              ? groupTint.row
                              : selected?.id === item.id
                                ? 'bg-blue-50/50'
                                : 'bg-white/70'
                          const cellClass = 'border-b border-slate-100 px-3 py-3 align-middle transition-colors group-hover:bg-sky-50/40'
                          return (
                            <Fragment key={item.id}>
                              {showGroupHeader ? (
                                <tr key={`${groupLabel}-group`}>
                                  <td
                                    colSpan={resourceTableColumns.visibleColumnOrder.length + (showResourceTableSelection ? 1 : 0)}
                                    className={cn('px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground', groupTint?.first ?? 'bg-slate-50/80')}
                                  >
                                    {RESOURCE_TABLE_GROUP_BY_OPTIONS.find((opt) => opt.key === resourceGroupBy)?.label}: {groupLabel}
                                  </td>
                                </tr>
                              ) : null}
                              <tr
                                onClick={() => {
                                  setSelectedId(item.id)
                                  setDrawerOpen(true)
                                }}
                                className={cn('group cursor-pointer transition-colors', rowBackground)}
                              >
                                {showResourceTableSelection ? (
                                  <td className={cn(cellClass, 'w-10')} onClick={(event) => event.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      id={`resource-table-select-${item.id}`}
                                      name={`resource-table-select-${item.id}`}
                                      checked={resourceTableSelectedIds.includes(item.id)}
                                      onChange={() => toggleResourceTableRowSelection(item.id)}
                                      aria-label={`Select ${item.name}`}
                                    />
                                  </td>
                                ) : null}
                                {resourceTableColumns.visibleColumnOrder.map((key) => (
                                  <td
                                    key={key}
                                    className={cellClass}
                                    style={{
                                      ...(resourceTableColumns.columnWidthStyle(key) ?? {}),
                                      ...(key === 'name' ? { boxShadow: `inset 3px 0 0 ${availabilityAccentColor(item.availabilityStatus)}` } : {}),
                                    }}
                                  >
                                    {renderResourceTableCell(item, key)}
                                  </td>
                                ))}
                              </tr>
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </DndContext>
                </div>
              ) : (
                <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 text-center">
                  <p className="text-sm font-medium text-slate-500">No resources match the current search</p>
                  <p className="mt-1 text-xs text-slate-400">Adjust the search to see resources.</p>
                  <Button type="button" variant="outline" className="mt-4 h-9 rounded-lg text-xs" onClick={resetResourceFilters}>
                    Reset filters
                  </Button>
                </div>
              )}
            </Panel>
          ) : null}

          {activePanel === 'capacity' ? (
            <Panel
              id="capacity"
              title="Capacity Planning Panel"
              description="Balance resource demand and forecast to help you balance workload and optimize team performance."
              highlight={activePanel === 'capacity'}
              outerRef={activeMainPanelRef}
              style={workspaceMainPanelViewportHeightStyle(mainPanelViewportHeightPx)}
              className={cn(mainPanelViewportHeightPx != null && 'overflow-hidden')}
              scrollBody={mainPanelViewportHeightPx != null}
            >
              <CapacityPlanningPanel />
            </Panel>
          ) : null}

          {activePanel === 'insight' ? (
            <Panel
              id="insight"
              title="Utilization Insight Panel"
              description="Resource utilization insight for overload and underload detection."
              highlight={activePanel === 'insight'}
              outerRef={activeMainPanelRef}
              style={workspaceMainPanelViewportHeightStyle(mainPanelViewportHeightPx)}
              className={cn(mainPanelViewportHeightPx != null && 'overflow-hidden')}
              scrollBody={mainPanelViewportHeightPx != null}
            >
              <div className="space-y-4">
                <div className="text-sm font-semibold text-slate-900">Utilization Insight Panel</div>
                <div className="space-y-2">
                  {resources.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>{item.name}</span>
                        <span>{item.utilization}%</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-200">
                        <div className={cn('h-2 rounded-full', item.utilization > 90 ? 'bg-rose-500' : item.utilization < 65 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${item.utilization}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          ) : null}

          {activePanel === 'activity' ? (
            <Panel
              id="activity"
              title="Activity Log & History Panel"
              description="Riwayat aktivitas perubahan alokasi resource."
              highlight={activePanel === 'activity'}
              outerRef={activeMainPanelRef}
              style={workspaceMainPanelViewportHeightStyle(mainPanelViewportHeightPx)}
              className={cn(mainPanelViewportHeightPx != null && 'overflow-hidden')}
              scrollBody={mainPanelViewportHeightPx != null}
            >
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-900">Activity Log & History Panel</div>
                {resources.map((item) => (
                  <div key={item.id} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="rounded-full border border-blue-200 bg-blue-50 p-2 text-blue-700"><Clock3 className="h-4 w-4" /></div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{item.name} allocation refreshed</div>
                      <div className="mt-1 text-xs text-slate-600">{item.lastUpdated} · {item.workspace}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
      </div>

      {drawerOpen && selected ? (
        <div className="fixed inset-0 z-[1200] flex justify-end bg-black/30">
          <div className="h-full w-full max-w-[430px] border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Resource Detail Drawer</div>
                <div className="mt-1 text-xs text-slate-600">{selected.name} · {selected.role}</div>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">x</button>
            </div>
            <div className="h-[calc(100%-65px)] space-y-4 overflow-y-auto p-4 text-xs text-slate-700">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center gap-2">
                  <AvailabilityBadge value={selected.availabilityStatus} />
                  <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">{selected.team}</Badge>
                </div>
                <p className="mt-3 leading-6 text-slate-700">Primary workspace: {selected.workspace}. Active project: {selected.activeProjects.join(', ')}.</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Capacity overview</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-2"><div className="text-slate-500">Allocation</div><div className="mt-1 font-semibold text-slate-900">{selected.allocation}%</div></div>
                  <div className="rounded-xl border border-slate-200 bg-white p-2"><div className="text-slate-500">Utilization</div><div className="mt-1 font-semibold text-slate-900">{selected.utilization}%</div></div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Quick risks
                </div>
                <div className="mt-3 text-xs text-slate-700">
                  {selected.utilization > 90
                    ? 'Resource berada di atas batas sehat utilisasi, disarankan rebalance.'
                    : 'Tidak ada konflik kapasitas kritis pada resource terpilih.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
