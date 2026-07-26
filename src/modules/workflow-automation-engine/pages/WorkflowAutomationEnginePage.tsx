import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Filter,
  Gauge,
  GitBranch,
  Info,
  Layers3,
  PlayCircle,
  Search,
  Settings2,
  ShieldCheck,
  Signal,
  Sparkles,
  Target,
  TrendingUp,
  Workflow,
  Zap,
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
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

type WorkflowStatus = 'Active' | 'Draft' | 'Paused' | 'Needs Approval'
type PanelId = 'overview' | 'catalog' | 'builder' | 'automation' | 'monitoring'

type WorkflowRecord = {
  id: string
  name: string
  type: 'Delivery' | 'Governance' | 'Financial' | 'Change' | 'Risk'
  owner: string
  status: WorkflowStatus
  trigger: 'Event' | 'Schedule' | 'Manual' | 'Webhook'
  successRate: number
  executions: number
  lastUpdated: string
}

const WORKFLOWS: WorkflowRecord[] = [
  { id: 'wf-001', name: 'Capital approval routing', type: 'Financial', owner: 'Mira Hadi', status: 'Active', trigger: 'Event', successRate: 98, executions: 148, lastUpdated: '12 min ago' },
  { id: 'wf-002', name: 'Sprint replan escalation', type: 'Delivery', owner: 'Ayla Brooks', status: 'Active', trigger: 'Schedule', successRate: 95, executions: 72, lastUpdated: '34 min ago' },
  { id: 'wf-003', name: 'Change request gatekeeper', type: 'Governance', owner: 'Nadia Singh', status: 'Needs Approval', trigger: 'Manual', successRate: 89, executions: 34, lastUpdated: '1 hour ago' },
  { id: 'wf-004', name: 'Risk exception remediation', type: 'Risk', owner: 'Jonas Reed', status: 'Draft', trigger: 'Webhook', successRate: 83, executions: 12, lastUpdated: 'Today, 08:10' },
  { id: 'wf-005', name: 'Vendor handoff automation', type: 'Change', owner: 'Mina Alvarez', status: 'Paused', trigger: 'Event', successRate: 91, executions: 58, lastUpdated: 'Today, 07:25' },
]

const CATALOG_SNAPSHOT: Array<{ name: string; category: WorkflowRecord['type']; owner: string; trigger: WorkflowRecord['trigger']; status: WorkflowStatus; lastExecution: string }> = [
  { name: 'Capital Approval Routing', category: 'Financial', owner: 'Mira Hadi', trigger: 'Manual', status: 'Active', lastExecution: '2 min ago' },
  { name: 'Sprint Replan Escalation', category: 'Delivery', owner: 'Ayla Brooks', trigger: 'Event', status: 'Active', lastExecution: '8 min ago' },
  { name: 'Change Request Gatekeeper', category: 'Governance', owner: 'Nadia Singh', trigger: 'Webhook', status: 'Needs Approval', lastExecution: '15 min ago' },
  { name: 'Risk Exception Remediation', category: 'Risk', owner: 'Jonas Reed', trigger: 'Manual', status: 'Draft', lastExecution: '1 hour ago' },
  { name: 'Vendor Handoff Automation', category: 'Change', owner: 'Mina Alvarez', trigger: 'Schedule', status: 'Paused', lastExecution: '2 hours ago' },
]

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
  { id: 'overview', label: 'Execution Overview', icon: Sparkles, badge: 'Command', desc: 'Ringkasan health, throughput, dan KPI workflow.' },
  { id: 'catalog', label: 'Workflow Catalog', icon: Workflow, badge: 'Core', desc: 'Direktori workflow dengan filter dan aksi cepat.' },
  { id: 'builder', label: 'Workflow Builder', icon: GitBranch, badge: 'Design', desc: 'Visual node, sequencing, dan validasi flow.' },
  { id: 'automation', label: 'Automation Rules', icon: Bot, badge: 'Rules', desc: 'Trigger, condition, action, dan kontrol status.' },
  { id: 'monitoring', label: 'Runtime Monitoring', icon: Activity, badge: 'Runtime', desc: 'Eksekusi, antrian, dan insiden operasional.' },
]

const PANEL_GROUPS: Array<{ group: string; items: typeof PANELS }> = [
  { group: 'Command Center', items: PANELS.filter((panel) => panel.id === 'overview') },
  { group: 'Control Library', items: PANELS.filter((panel) => ['catalog', 'builder'].includes(panel.id)) },
  { group: 'Assurance & Traceability', items: PANELS.filter((panel) => ['automation', 'monitoring'].includes(panel.id)) },
]

const WORKFLOW_NAV_RAIL_ITEMS = PANELS.map(({ id, label, icon }) => ({ id, label, icon }))

function statusTone(status: WorkflowStatus | 'Failed') {
  if (status === 'Active') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'Failed') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (status === 'Paused' || status === 'Needs Approval') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-slate-200 bg-slate-100 text-slate-700'
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
}: {
  title: string
  description: string
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  panelRef?: RefObject<HTMLElement | null>
  style?: CSSProperties
  headerIcon?: React.ReactNode
}) {
  return (
    <section
      ref={panelRef}
      style={style}
      className={cn(
        'rounded-3xl border border-slate-200/80 bg-white/90 shadow-[0_16px_50px_rgba(15,23,42,0.08)]',
        className
      )}
    >
      <div className={cn('shrink-0', headerIcon ? 'p-4 pb-0 lg:p-5 lg:pb-0' : 'px-5 py-4')}>
        <div className="flex min-w-0 items-center gap-2">
          {headerIcon ? <span className="shrink-0 text-slate-900">{headerIcon}</span> : null}
          <h2 className={cn('min-w-0 font-semibold text-slate-900', headerIcon ? 'text-lg' : 'text-sm')}>{title}</h2>
        </div>
        <p className={cn('text-slate-600', headerIcon ? 'mt-0.5 text-[11px]' : 'mt-1 text-xs')}>{description}</p>
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
    <ResponsiveContainer width="100%" height="100%">
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

export function WorkflowAutomationEnginePage() {
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

  const [isLoading, setIsLoading] = useState(true)
  const [activePanel, setActivePanel] = useState<PanelId>('overview')
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const [showFiltersPanel, setShowFiltersPanel] = useState(true)
  const navPanelRef = useRef<HTMLDivElement | null>(null)
  const activeMainPanelRef = useRef<HTMLElement | null>(null)
  const [navPanelHeightPx, setNavPanelHeightPx] = useState<number | null>(null)
  const [mainPanelViewportHeightPx, setMainPanelViewportHeightPx] = useState<number | null>(null)
  const isOverviewSectionActive = activePanel === 'overview'

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 650)
    return () => window.clearTimeout(timer)
  }, [])

  useLayoutEffect(() => {
    if (isLoading) return
    if (!isOverviewSectionActive) {
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
  }, [isLoading, isOverviewSectionActive, isWorkspaceCollapsed, showFiltersPanel, sidebarFixed])

  useLayoutEffect(() => {
    if (isLoading) return
    if (navDocked) {
      setNavPanelHeightPx(null)
      return
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
    isLoading,
    isOverviewSectionActive,
    isWorkspaceCollapsed,
    mainPanelViewportHeightPx,
    navDocked,
    showFiltersPanel,
    sidebarFixed,
  ])

  const filtered = useMemo(() => {
    return WORKFLOWS.filter((item) => {
      const matchesSearch =
        search.length === 0 ||
        [item.name, item.id, item.owner, item.type, item.trigger].join(' ').toLowerCase().includes(search.toLowerCase())
      return matchesSearch
    })
  }, [search])
  const overviewWorkflows = activePanel === 'overview' ? WORKFLOWS : filtered

  const summary = useMemo(() => {
    const active = overviewWorkflows.filter((item) => item.status === 'Active').length
    const paused = overviewWorkflows.filter((item) => item.status === 'Paused').length
    const needsApproval = overviewWorkflows.filter((item) => item.status === 'Needs Approval').length
    const avgSuccess = overviewWorkflows.length === 0 ? 0 : Math.round(overviewWorkflows.reduce((sum, item) => sum + item.successRate, 0) / overviewWorkflows.length)
    const executions = overviewWorkflows.reduce((sum, item) => sum + item.executions, 0)
    return { total: overviewWorkflows.length, active, paused, needsApproval, avgSuccess, executions }
  }, [overviewWorkflows])

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Breadcrumb items={[{ label: 'Workflow & Automation Engine' }]} />
        <div className="h-64 animate-pulse rounded-3xl border border-slate-200 bg-slate-100" />
      </div>
    )
  }

  return (
    <div className="min-h-0 space-y-6 pb-0">
      <div className={cn('space-y-6', workspaceDockedContentInsetClass(navDocked, isWorkspaceCollapsed, enterpriseNavLayoutVariant))}>
        <Breadcrumb items={[{ label: 'Workflow & Automation Engine' }]} />

        <PageHeader
          title="Workflow & Automation Engine"
          description="Design workflow, approvals, trigger, dan automation dengan pola UI yang konsisten terhadap Task & Work Management"
          right={
            <div className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white/75 p-1.5 shadow-sm">
              <button type="button" className="flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition hover:bg-white hover:text-slate-900" title="Export workflow snapshot">
                <Download className="h-5 w-5" />
              </button>
              <button type="button" className="flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition hover:bg-white hover:text-slate-900" title="Automation settings">
                <Settings2 className="h-5 w-5" />
              </button>
              {activePanel !== 'overview' ? (
                <button
                  type="button"
                  onClick={() => setShowFiltersPanel((current) => !current)}
                  className={cn(
                    'flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition hover:bg-white hover:text-slate-900',
                    showFiltersPanel && 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                  )}
                  title={showFiltersPanel ? 'Hide filters panel' : 'Show filters panel'}
                >
                  <Target className="h-5 w-5" />
                </button>
              ) : null}
            </div>
          }
        />

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
                <EnterpriseNavIconRail items={WORKFLOW_NAV_RAIL_ITEMS} activeId={activePanel} onSelect={setActivePanel} />
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

        <div className={workspaceMainColumnClass(navDocked, isWorkspaceCollapsed, enterpriseNavLayoutVariant)}>
          {showFiltersPanel && activePanel !== 'overview' ? (
          <Card className="glass-card rounded-2xl p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 rounded-2xl border-slate-200 bg-white pl-9 text-sm"
                placeholder="Search workflow name, ID, owner, type, trigger"
              />
            </div>
          </Card>
          ) : null}

          {activePanel === 'overview' ? (
            <Panel
              title="Workflow Execution Overview Panel"
              description="Ringkasan KPI eksekusi workflow dan tren success/failure harian."
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
                  description="Daftar workflow aktif dan status eksekusi terbaru."
                  footer={<button type="button" className="text-xs font-semibold text-sky-600 hover:text-sky-700">View All Workflows →</button>}
                >
                  <div className="-mx-1 overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead className="text-slate-500">
                        <tr className="text-left">
                          {['Workflow Name', 'Category', 'Owner', 'Trigger', 'Status', 'Last Execution'].map((header) => (
                            <th key={header} className="px-1 pb-2 font-semibold">{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {CATALOG_SNAPSHOT.map((item) => (
                          <tr key={item.name} className="border-t border-slate-100">
                            <td className="px-1 py-2 font-medium text-slate-900">{item.name}</td>
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
                  description="Tren eksekusi dari waktu ke waktu."
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
                  description="Perbandingan success, failure, dan retry rate."
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
                  description="SLA kepatuhan untuk approval workflow."
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
                  description="Kedalaman antrean eksekusi workflow dalam sistem."
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
                  description="Insight cerdas dan rekomendasi dari TECTONA AI."
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
            <Panel title="Workflow & Automation Directory Panel" description="Daftar workflow dengan status, trigger, success rate, dan aksi cepat operasional.">
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50/95 text-slate-600">
                    <tr>
                      {['Workflow', 'Type', 'Owner', 'Trigger', 'Status', 'Success', 'Executions', 'Updated'].map((header) => (
                        <th key={header} className="px-3 py-3 text-left font-semibold">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100 bg-white/90">
                        <td className="px-3 py-3 font-medium text-slate-900">{item.name}</td>
                        <td className="px-3 py-3 text-slate-700">{item.type}</td>
                        <td className="px-3 py-3 text-slate-700">{item.owner}</td>
                        <td className="px-3 py-3 text-slate-700">{item.trigger}</td>
                        <td className="px-3 py-3"><Badge className={cn('rounded-full border', statusTone(item.status))}>{item.status}</Badge></td>
                        <td className="px-3 py-3 text-slate-700">{item.successRate}%</td>
                        <td className="px-3 py-3 text-slate-700">{item.executions}</td>
                        <td className="px-3 py-3 text-slate-700">{item.lastUpdated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}

          {activePanel === 'builder' ? (
            <Panel title="Workflow Builder Panel" description="Desain visual flow dan urutan node untuk eksekusi automation engine.">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                {['Start Trigger', 'Approval Gate', 'Condition Rule', 'Action Dispatch', 'End State'].map((node, index) => (
                  <div key={node} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Node {index + 1}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{node}</div>
                    <div className="mt-1 text-xs text-slate-600">Konfigurasi tahap workflow untuk orkestrasi proses bisnis.</div>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          {activePanel === 'automation' ? (
            <Panel title="Rule-Based Automation Panel" description="Kontrol trigger-condition-action dan status rule untuk workflow runtime.">
              <div className="space-y-3">
                {[
                  'Overrun alert with owner reassignment',
                  'Approval completion task fan-out',
                  'Webhook incident fallback',
                ].map((rule) => (
                  <div key={rule} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900">{rule}</div>
                      <Badge className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">Enabled</Badge>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">Trigger - Condition - Action flow dengan observability dan failover policy.</div>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          {activePanel === 'monitoring' ? (
            <Panel title="Automation Monitoring & Execution Log Panel" description="Monitoring eksekusi, insiden runtime, dan health automasi lintas workflow.">
              <Card className="border-emerald-200 bg-emerald-50/80 rounded-2xl">
                <CardContent className="flex items-center gap-2 py-3 text-xs text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  Runtime monitoring aktif. Semua metrik workflow berhasil dimuat dan sinkron.
                </CardContent>
              </Card>
            </Panel>
          ) : null}
        </div>
      </div>
      </div>
    </div>
  )
}
