import { Fragment, startTransition, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CalendarClock,
  CalendarRange,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  Filter,
  Flag,
  GitBranch,
  GripVertical,
  Layers,
  LayoutGrid,
  MoreVertical,
  Network,
  Plus,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Signal,
  Sparkles,
  Sun,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
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
import { PlanningSvarGantt, type PlanningGanttItem } from '@/modules/planning-scheduling/components/PlanningSvarGantt'
import { PLANNING_TIMELINE_GANTT_COLUMNS } from '@/modules/task-work-management/components/DirectoryGanttGridCells'
import { mapWorkItemsToPlanningGantt } from '@/modules/planning-scheduling/utils/mapWorkItemsToPlanningGantt'
import { listWorkItems } from '@/lib/api/workApi'
import { fetchAllWorkspaceOrgWorkspaces } from '@/lib/api/workspaceOrgApi'

type ZoomLevel = 'Day' | 'Week' | 'Month' | 'Quarter'
const ZOOM_LEVEL_OPTIONS: { level: ZoomLevel; icon: LucideIcon }[] = [
  { level: 'Day', icon: Sun },
  { level: 'Week', icon: CalendarRange },
  { level: 'Month', icon: CalendarClock },
  { level: 'Quarter', icon: LayoutGrid },
]
type CalendarMode = 'Month' | 'Week' | 'Agenda'
type CapacityView = 'Team' | 'Individual' | 'Sprint' | 'Project'
type PlanningPanelId = 'overview' | 'timeline' | 'sprint' | 'calendar' | 'capacity' | 'deadline' | 'resource' | 'baseline' | 'insight'

const WORK_TIMELINE_UNAVAILABLE_MESSAGE =
  'Work Management API is unavailable. Start python-work-management-service-fastapi (port 8432), ensure PostgreSQL is running, then refresh.'

type SprintRecord = {
  id: string
  name: string
  goal: string
  dateRange: string
  team: string
  capacity: string
  assignedItems: number
  status: string
  completion: number
}

type CalendarEventRecord = {
  id: string
  title: string
  dateLabel: string
  type: 'Milestone' | 'Deadline' | 'Sprint' | 'Checkpoint' | 'SLA'
  project: string
  owner: string
}

type DeadlineRecord = {
  id: string
  title: string
  project: string
  owner: string
  due: string
  deadlineStatus: 'Upcoming' | 'Overdue' | 'Missed'
  slaStatus: 'Healthy' | 'Warning' | 'Breach Risk'
}

type ResourceAllocationRecord = {
  id: string
  resource: string
  project: string
  team: string
  allocation: number
  period: string
  conflict: 'None' | 'Overlap' | 'Contention'
}

type BaselineRecord = {
  id: string
  title: string
  project: string
  planned: string
  actual: string
  delayDays: number
  deviation: number
  adherence: string
}

type AlertRecord = {
  id: string
  title: string
  severity: 'High' | 'Medium' | 'Low'
  detail: string
  recommendation: string
  linkedItemId: string
}

const scheduleHealth = [
  { label: 'Healthy', value: 63, color: '#10b981' },
  { label: 'Watchlist', value: 24, color: '#f59e0b' },
  { label: 'At Risk', value: 13, color: '#ef4444' },
]

const timelineDistribution = [
  { name: 'Initiation', value: 8, fill: '#0ea5e9' },
  { name: 'Planning', value: 15, fill: '#6366f1' },
  { name: 'Execution', value: 24, fill: '#22c55e' },
  { name: 'Stabilization', value: 11, fill: '#f59e0b' },
  { name: 'Closure', value: 6, fill: '#14b8a6' },
]

const scheduleTrend = [
  { label: 'Jan', baseline: 8, actual: 6 },
  { label: 'Feb', baseline: 18, actual: 14 },
  { label: 'Mar', baseline: 29, actual: 24 },
  { label: 'Apr', baseline: 41, actual: 35 },
  { label: 'May', baseline: 52, actual: 45 },
  { label: 'Jun', baseline: 61, actual: 53 },
  { label: 'Jul', baseline: 69, actual: 60 },
  { label: 'Aug', baseline: 76, actual: 66 },
  { label: 'Sep', baseline: 82, actual: 71 },
  { label: 'Oct', baseline: 88, actual: 76 },
  { label: 'Nov', baseline: 94, actual: 80 },
  { label: 'Dec', baseline: 100, actual: 82 },
]

const milestoneStatus = [
  { name: 'Completed', value: 23, fill: '#22c55e' },
  { name: 'Upcoming', value: 17, fill: '#3b82f6' },
  { name: 'Delayed', value: 9, fill: '#f59e0b' },
  { name: 'Missed', value: 5, fill: '#ef4444' },
]

const sprintBurnup = [
  { day: 'D1', ideal: 86, remaining: 86, completed: 0 },
  { day: 'D3', ideal: 72, remaining: 78, completed: 8 },
  { day: 'D5', ideal: 57, remaining: 66, completed: 20 },
  { day: 'D8', ideal: 43, remaining: 52, completed: 34 },
  { day: 'D11', ideal: 29, remaining: 38, completed: 48 },
  { day: 'D13', ideal: 14, remaining: 22, completed: 64 },
  { day: 'D15', ideal: 0, remaining: 10, completed: 76 },
]

type DependencyNode = {
  id: string
  label: string
  meta: string
  x: number
  y: number
  status: 'on-track' | 'at-risk' | 'blocked'
}

type DependencyEdge = { from: string; to: string; kind: 'normal' | 'cross-team' | 'blocked' }

const dependencyNodes: DependencyNode[] = [
  { id: 'pa', label: 'Program A', meta: '6 projects', x: 8, y: 14, status: 'on-track' },
  { id: 'pc', label: 'Program C', meta: '2 projects', x: 8, y: 74, status: 'at-risk' },
  { id: 'alpha', label: 'Project Alpha', meta: 'Epic · Onboarding', x: 50, y: 8, status: 'on-track' },
  { id: 'beta', label: 'Project Beta', meta: 'Epic · Payments', x: 50, y: 44, status: 'blocked' },
  { id: 'gamma', label: 'Project Gamma', meta: 'Epic · Risk', x: 50, y: 80, status: 'at-risk' },
  { id: 'delta', label: 'Project Delta', meta: 'Epic · Core', x: 90, y: 18, status: 'on-track' },
  { id: 'pb', label: 'Program B', meta: '5 projects', x: 90, y: 70, status: 'on-track' },
]

const dependencyEdges: DependencyEdge[] = [
  { from: 'pa', to: 'alpha', kind: 'normal' },
  { from: 'pa', to: 'beta', kind: 'cross-team' },
  { from: 'pc', to: 'beta', kind: 'cross-team' },
  { from: 'pc', to: 'gamma', kind: 'normal' },
  { from: 'beta', to: 'delta', kind: 'blocked' },
  { from: 'gamma', to: 'pb', kind: 'normal' },
  { from: 'alpha', to: 'delta', kind: 'normal' },
]

const capacityForecast = [
  { team: 'PMO', values: [92, 105, 110] },
  { team: 'Engineering', values: [78, 87, 95] },
  { team: 'QA', values: [68, 102, 115] },
  { team: 'Business', values: [60, 75, 80] },
  { team: 'Operations', values: [85, 90, 95] },
]
const capacityForecastColumns = ['Current Sprint', 'Next Sprint', 'Next Quarter']

const scheduleVariance = [
  { project: 'Project Alpha', planned: 'Jun 30', forecast: 'Jun 25', variance: -5 },
  { project: 'Project Beta', planned: 'Jul 15', forecast: 'Jul 20', variance: 5 },
  { project: 'Project Gamma', planned: 'Aug 30', forecast: 'Sep 11', variance: 12 },
  { project: 'Project Delta', planned: 'May 28', forecast: 'May 26', variance: -2 },
  { project: 'Project Epsilon', planned: 'Jul 31', forecast: 'Aug 07', variance: 7 },
]

const aiPlanningInsights = [
  { icon: TrendingDown, text: 'Sprint velocity decreased by 12% compared to the previous sprint.' },
  { icon: CalendarClock, text: 'Milestone “UAT Go Live” is likely to be delayed by 5 days.' },
  { icon: Users, text: 'QA team capacity exceeds 105% in the next sprint.' },
  { icon: GitBranch, text: 'Cross-team dependency between Beta and Gamma increases schedule risk.' },
]

const sprintRecords: SprintRecord[] = [
  {
    id: 'sprint-24',
    name: 'Sprint 24',
    goal: 'Stabilize sequencing across channels and reduce dependency spillover.',
    dateRange: '14 Apr - 25 Apr',
    team: 'PMO Core',
    capacity: '420 pts',
    assignedItems: 61,
    status: 'Active',
    completion: 68,
  },
  {
    id: 'sprint-18',
    name: 'Sprint 18',
    goal: 'Lock design approvals and calendar alignment for downstream releases.',
    dateRange: '21 Apr - 02 May',
    team: 'Studio West',
    capacity: '290 pts',
    assignedItems: 44,
    status: 'Upcoming',
    completion: 22,
  },
  {
    id: 'sprint-27',
    name: 'Sprint 27',
    goal: 'Complete mock cutover rehearsal and resolve environment contention.',
    dateRange: '28 Apr - 09 May',
    team: 'Migration Guild',
    capacity: '360 pts',
    assignedItems: 53,
    status: 'At Capacity',
    completion: 34,
  },
]

const sprintBoardSummary = [
  { label: 'To Do', value: 38, tone: 'bg-slate-100 text-slate-700 border-slate-200' },
  { label: 'In Progress', value: 26, tone: 'bg-sky-100 text-sky-700 border-sky-200' },
  { label: 'Review', value: 11, tone: 'bg-amber-100 text-amber-700 border-amber-200' },
  { label: 'Done', value: 57, tone: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
]

const calendarEvents: CalendarEventRecord[] = [
  { id: 'milestone-ux', title: 'Experience freeze', dateLabel: 'Apr 18', type: 'Milestone', project: 'Retail Growth Platform', owner: 'Jonas Reed' },
  { id: 'sprint-24', title: 'Sprint 24 planning', dateLabel: 'Apr 19', type: 'Sprint', project: 'Omni Channel Modernization', owner: 'Ayla Brooks' },
  { id: 'deadline-qa', title: 'Regression sign-off', dateLabel: 'Apr 22', type: 'Deadline', project: 'Service Excellence Program', owner: 'Nadia Singh' },
  { id: 'checkpoint-ops', title: 'Portfolio checkpoint', dateLabel: 'Apr 23', type: 'Checkpoint', project: 'Enterprise Delivery Office', owner: 'PMO Council' },
  { id: 'sla-bridge', title: 'SLA bridge window', dateLabel: 'Apr 24', type: 'SLA', project: 'Loan Origination Revamp', owner: 'Mina Alvarez' },
  { id: 'stream-data', title: 'Migration rehearsal', dateLabel: 'Apr 25', type: 'Milestone', project: 'Loan Origination Revamp', owner: 'Mina Alvarez' },
]

const capacityPeriods = ['W1', 'W2', 'W3', 'W4', 'W5']

const capacityRows = [
  { name: 'PMO Core', values: [72, 84, 90, 77, 66] },
  { name: 'Studio West', values: [64, 71, 88, 92, 80] },
  { name: 'Migration Guild', values: [83, 95, 97, 91, 78] },
  { name: 'Service Ops', values: [58, 62, 68, 73, 61] },
]

const deadlineRecords: DeadlineRecord[] = [
  { id: 'deadline-qa', title: 'Regression sign-off', project: 'Service Excellence Program', owner: 'Nadia Singh', due: '22 Apr, 17:00', deadlineStatus: 'Upcoming', slaStatus: 'Warning' },
  { id: 'milestone-ux', title: 'Design approval package', project: 'Retail Growth Platform', owner: 'Jonas Reed', due: '18 Apr, 12:00', deadlineStatus: 'Overdue', slaStatus: 'Breach Risk' },
  { id: 'stream-data', title: 'Cutover readiness report', project: 'Loan Origination Revamp', owner: 'Mina Alvarez', due: '24 Apr, 18:00', deadlineStatus: 'Upcoming', slaStatus: 'Warning' },
  { id: 'plan-001', title: 'Baseline commitment review', project: 'Omni Channel Modernization', owner: 'Ayla Brooks', due: '17 Apr, 09:00', deadlineStatus: 'Missed', slaStatus: 'Breach Risk' },
]

const resourceAllocations: ResourceAllocationRecord[] = [
  { id: 'res-001', resource: 'Ayla Brooks', project: 'Omni Channel Modernization', team: 'PMO Core', allocation: 88, period: 'Apr W3', conflict: 'None' },
  { id: 'res-002', resource: 'Mina Alvarez', project: 'Loan Origination Revamp', team: 'Migration Guild', allocation: 112, period: 'Apr W4', conflict: 'Overlap' },
  { id: 'res-003', resource: 'Jonas Reed', project: 'Retail Growth Platform', team: 'Studio West', allocation: 96, period: 'Apr W3', conflict: 'Contention' },
  { id: 'res-004', resource: 'Nadia Singh', project: 'Service Excellence Program', team: 'Service Ops', allocation: 74, period: 'Apr W4', conflict: 'None' },
]

const baselineRecords: BaselineRecord[] = [
  { id: 'plan-001', title: 'Execution baseline', project: 'Omni Channel Modernization', planned: '01 Apr - 23 May', actual: '03 Apr - 27 May', delayDays: 4, deviation: 6, adherence: '92%' },
  { id: 'milestone-ux', title: 'Experience freeze', project: 'Retail Growth Platform', planned: '18 Apr', actual: '23 Apr', delayDays: 5, deviation: 14, adherence: '79%' },
  { id: 'stream-data', title: 'Migration rehearsal', project: 'Loan Origination Revamp', planned: '24 Apr - 08 May', actual: '27 Apr - 13 May', delayDays: 6, deviation: 17, adherence: '74%' },
]

const alertFeed: AlertRecord[] = [
  {
    id: 'alert-1',
    title: 'Delayed milestone trend detected',
    severity: 'High',
    detail: 'Retail Growth Platform has slipped two approval gates in one planning cycle.',
    recommendation: 'Re-sequence external design dependencies and lock decision SLA with vendor governance.',
    linkedItemId: 'milestone-ux',
  },
  {
    id: 'alert-2',
    title: 'Resource contention on migration guild',
    severity: 'High',
    detail: 'Two concurrent cutover rehearsals exceed team capacity by 12%.',
    recommendation: 'Shift the reconciliation stream into Sprint 28 and assign overflow to shared ops pool.',
    linkedItemId: 'stream-data',
  },
  {
    id: 'alert-3',
    title: 'Sprint over-commitment warning',
    severity: 'Medium',
    detail: 'Sprint 27 includes more committed work than available burn profile allows.',
    recommendation: 'Move lower-criticality backlog items into the next sprint and preserve release blockers only.',
    linkedItemId: 'sprint-27',
  },
  {
    id: 'alert-4',
    title: 'SLA breach window approaching',
    severity: 'Medium',
    detail: 'Baseline commitment review has less than 24 hours before governance SLA breach.',
    recommendation: 'Escalate to delivery council and assign alternate approver for same-day decisioning.',
    linkedItemId: 'plan-001',
  },
]

function toneForVariance(days: number) {
  if (days <= 0) return 'text-emerald-700 bg-emerald-50 border-emerald-200'
  if (days <= 3) return 'text-amber-700 bg-amber-50 border-amber-200'
  return 'text-rose-700 bg-rose-50 border-rose-200'
}

function toneForSeverity(severity: AlertRecord['severity']) {
  if (severity === 'High') return 'text-rose-700 bg-rose-50 border-rose-200'
  if (severity === 'Medium') return 'text-amber-700 bg-amber-50 border-amber-200'
  return 'text-sky-700 bg-sky-50 border-sky-200'
}

function toneForCalendarType(type: CalendarEventRecord['type']) {
  switch (type) {
    case 'Milestone':
      return 'bg-indigo-100 text-indigo-700 border-indigo-200'
    case 'Deadline':
      return 'bg-rose-100 text-rose-700 border-rose-200'
    case 'Sprint':
      return 'bg-sky-100 text-sky-700 border-sky-200'
    case 'Checkpoint':
      return 'bg-amber-100 text-amber-700 border-amber-200'
    default:
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  }
}

function toneForSla(status: DeadlineRecord['slaStatus']) {
  if (status === 'On Track' || status === 'Healthy') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (status === 'At Risk' || status === 'Warning') return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-rose-100 text-rose-700 border-rose-200'
}

function toneForDeadline(status: DeadlineRecord['deadlineStatus']) {
  if (status === 'Upcoming') return 'bg-sky-100 text-sky-700 border-sky-200'
  if (status === 'Overdue') return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-rose-100 text-rose-700 border-rose-200'
}

function capacityColor(value: number) {
  if (value >= 95) return 'bg-rose-500/85 text-white'
  if (value >= 85) return 'bg-amber-400/90 text-slate-900'
  if (value >= 70) return 'bg-sky-400/85 text-white'
  return 'bg-emerald-400/85 text-slate-950'
}

function TimelineSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      <div className="w-[42%] space-y-2 border-r border-slate-200 p-3">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="h-9 rounded-lg bg-slate-100 animate-pulse" />
        ))}
      </div>
      <div className="flex-1 space-y-2 p-3">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="h-9 rounded-lg bg-slate-100/80 animate-pulse" />
        ))}
      </div>
      <div className="hidden w-[280px] border-l border-slate-200 p-3 xl:block">
        <div className="h-full rounded-xl bg-slate-100 animate-pulse" />
      </div>
    </div>
  )
}

function kpiCardChrome(cardId: string): string {
  const base =
    'rounded-2xl p-4 transition-all duration-200 relative overflow-hidden group border border-white/40 ring-1 ring-black/[0.04] shadow-[0_14px_40px_rgba(15,23,42,0.10)] hover:-translate-y-0.5 hover:shadow-[0_18px_56px_rgba(15,23,42,0.14)]'

  if (cardId === 'plans') return cn(base, 'bg-gradient-to-br from-slate-50/85 via-white/90 to-sky-50/75')
  if (cardId === 'milestones') return cn(base, 'bg-gradient-to-br from-indigo-50/70 via-white/90 to-violet-50/70')
  if (cardId === 'sprints') return cn(base, 'bg-gradient-to-br from-emerald-50/70 via-white/90 to-cyan-50/70')
  if (cardId === 'overdue') return cn(base, 'bg-gradient-to-br from-rose-50/70 via-white/90 to-amber-50/70')
  if (cardId === 'sla') return cn(base, 'bg-gradient-to-br from-orange-50/70 via-white/90 to-yellow-50/70')
  return cn(base, 'bg-gradient-to-br from-cyan-50/70 via-white/90 to-blue-50/70')
}

function KpiSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((value, index) => ({ idx: index, value }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={`tectona-plan-kpi-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={color} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.8}
          fill={`url(#tectona-plan-kpi-${color.replace('#', '')})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Satu panel konten utama — pola selaras `DocPanelSection` variant ficus-governance (Document & Knowledge Management). */
function PlanningPanelSection({
  id,
  title,
  description,
  highlight,
  right,
  children,
  headerIcon,
  outerRef,
  style,
  className,
  scrollBody = false,
  bodyFill = false,
}: {
  id: string
  title: string
  description: string
  highlight: boolean
  right?: React.ReactNode
  children: React.ReactNode
  headerIcon?: React.ReactNode
  outerRef?: React.Ref<HTMLElement>
  style?: React.CSSProperties
  className?: string
  scrollBody?: boolean
  /** Panel body stretches children to full remaining height (e.g. Timeline Gantt). */
  bodyFill?: boolean
}) {
  return (
    <section
      id={id}
      ref={outerRef}
      style={style}
      className={cn(
        'glass-card flex min-h-0 flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-[0_16px_44px_rgba(15,23,42,0.10)] ring-1 ring-slate-900/[0.04] transition-all lg:p-5',
        highlight ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200/80',
        (scrollBody || bodyFill) && 'flex min-h-0 w-full flex-col overflow-hidden',
        className
      )}
    >
      <div className="shrink-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 shrink-0">
            <div className="flex items-center gap-2">
              {headerIcon ? <span className="text-slate-900">{headerIcon}</span> : null}
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-600">{description}</p>
          </div>
          {right ? <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 sm:ml-auto sm:justify-end">{right}</div> : null}
        </div>
      </div>
      <div
        className={cn(
          'min-h-0 flex-1',
          scrollBody &&
            'overflow-y-auto overflow-x-hidden overscroll-y-contain pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
          bodyFill && 'flex flex-col overflow-hidden'
        )}
      >
        {children}
      </div>
    </section>
  )
}

const PLANNING_PANELS: Array<{
  id: PlanningPanelId
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  group: 'Command Center' | 'Control Library' | 'Assurance & Traceability'
  badge: string
}> = [
  { id: 'overview', label: 'Planning Overview', description: 'Planning health and KPI command posture.', icon: Sparkles, group: 'Command Center', badge: 'Command' },
  { id: 'timeline', label: 'Timeline & Gantt', description: 'Baseline-aware sequencing and dependency control.', icon: CalendarRange, group: 'Control Library', badge: 'Core' },
  { id: 'sprint', label: 'Sprint Planning', description: 'Commitment balance and sprint execution posture.', icon: Layers, group: 'Control Library', badge: 'Flow' },
  { id: 'calendar', label: 'Calendar View', description: 'Milestone and deadline schedule events.', icon: CalendarClock, group: 'Control Library', badge: 'Date' },
  { id: 'capacity', label: 'Capacity Planning', description: 'Load, allocation, and bandwidth control.', icon: Users, group: 'Assurance & Traceability', badge: 'People' },
  { id: 'deadline', label: 'Deadline & SLA', description: 'Breach risk and compliance tracking.', icon: ShieldAlert, group: 'Assurance & Traceability', badge: 'SLA' },
  { id: 'resource', label: 'Resource Scheduling', description: 'Conflict and overlap resource planning.', icon: Zap, group: 'Assurance & Traceability', badge: 'Resource' },
  { id: 'baseline', label: 'Baseline Tracking', description: 'Planned vs actual delivery variance control.', icon: Target, group: 'Assurance & Traceability', badge: 'Track' },
  { id: 'insight', label: 'Planning Insights', description: 'Alert feed and recommendation intelligence.', icon: AlertTriangle, group: 'Assurance & Traceability', badge: 'AI' },
]

const PLANNING_PANEL_GROUPS = [
  { group: 'Command Center' as const, items: PLANNING_PANELS.filter((item) => item.group === 'Command Center') },
  { group: 'Control Library' as const, items: PLANNING_PANELS.filter((item) => item.group === 'Control Library') },
  { group: 'Assurance & Traceability' as const, items: PLANNING_PANELS.filter((item) => item.group === 'Assurance & Traceability') },
]

export function PlanningSchedulingPage() {
  const sidebarFixed = usePreferencesStore((s) => s.preferences.sidebarFixed ?? false)
  const sidebarMini = usePreferencesStore((s) => s.preferences.sidebarMini ?? true)
  const navDocked = isWorkspaceNavDocked(sidebarFixed)
  const enterpriseNavTitlesOnly = usePreferencesStore((s) => s.preferences.enterpriseNavTitlesOnly ?? false)
  const enterpriseNavSimpleList = usePreferencesStore((s) => s.preferences.enterpriseNavSimpleList ?? false)
  const enterpriseNavCompact = enterpriseNavTitlesOnly || enterpriseNavSimpleList
  const fixedSidebarUiOn = !sidebarFixed
  const enterpriseNavUltra = fixedSidebarUiOn && sidebarMini && enterpriseNavTitlesOnly && enterpriseNavSimpleList
  const enterpriseNavWidthVariant = enterpriseNavUltra ? 'ultra' : enterpriseNavCompact ? 'compact' : 'default'
  // Match Document & Knowledge Management: 260px panel when expanded (compact layout width, full content labels).
  const enterpriseNavLayoutVariant = enterpriseNavWidthVariant === 'default' ? 'compact' : enterpriseNavWidthVariant

  const [isLoading, setIsLoading] = useState(false)
  const [timelineItems, setTimelineItems] = useState<PlanningGanttItem[]>([])
  const [timelineWorkspaceOrder, setTimelineWorkspaceOrder] = useState<string[]>([])
  const [timelineLoading, setTimelineLoading] = useState(true)
  const [timelineLoadError, setTimelineLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('Month')
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('Month')
  const [capacityView, setCapacityView] = useState<CapacityView>('Team')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [activePanel, setActivePanel] = useState<PlanningPanelId>('overview')
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(false)
  const [showFiltersPanel, setShowFiltersPanel] = useState(true)
  const navPanelRef = useRef<HTMLDivElement | null>(null)
  const activeMainPanelRef = useRef<HTMLElement | null>(null)
  const mainPanelFiltersRef = useRef<HTMLDivElement | null>(null)
  const [navPanelHeightPx, setNavPanelHeightPx] = useState<number | null>(null)
  const [mainPanelViewportHeightPx, setMainPanelViewportHeightPx] = useState<number | null>(null)
  const isOverviewSectionActive = activePanel === 'overview'
  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setTimelineLoading(true)
      setTimelineLoadError(null)
      try {
        const [workRes, workspaces] = await Promise.all([
          listWorkItems(),
          fetchAllWorkspaceOrgWorkspaces().catch(() => []),
        ])
        if (cancelled) return
        const mapped = mapWorkItemsToPlanningGantt(workRes.items ?? [], workspaces)
        setTimelineItems(Array.isArray(mapped.items) ? mapped.items : [])
        setTimelineWorkspaceOrder(Array.isArray(mapped.workspaceOrder) ? mapped.workspaceOrder : [])
        if (mapped.items.length > 0) {
          setSelectedItemId((prev) => (mapped.items.some((item) => item.id === prev) ? prev : mapped.items[0].id))
        }
      } catch {
        if (!cancelled) {
          setTimelineItems([])
          setTimelineWorkspaceOrder([])
          setTimelineLoadError(WORK_TIMELINE_UNAVAILABLE_MESSAGE)
        }
      } finally {
        if (!cancelled) setTimelineLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useLayoutEffect(() => {
    if (isLoading) return

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
    if (mainPanelFiltersRef.current) ro.observe(mainPanelFiltersRef.current)

    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('resize', compute)
      ro.disconnect()
    }
  }, [isLoading, activePanel, isWorkspaceCollapsed, showFiltersPanel, sidebarFixed])

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
    if (mainPanelFiltersRef.current) ro.observe(mainPanelFiltersRef.current)

    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('resize', compute)
      ro.disconnect()
    }
  }, [
    activePanel,
    isLoading,
    isWorkspaceCollapsed,
    mainPanelViewportHeightPx,
    navDocked,
    showFiltersPanel,
    sidebarFixed,
  ])

  const normalizedQuery = deferredQuery.trim().toLowerCase()

  const visibleTimelineItems = (Array.isArray(timelineItems) ? timelineItems : []).filter((item) => {
    if (normalizedQuery.length === 0) return true
    return [item.title, item.project, item.workspace, item.owner, item.team, item.sprint]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery)
  })

  const visibleDeadlines = deadlineRecords.filter((item) => {
    if (normalizedQuery.length === 0) return true
    return [item.title, item.project, item.owner].join(' ').toLowerCase().includes(normalizedQuery)
  })

  const visibleCalendarEvents = calendarEvents.filter((item) => {
    if (normalizedQuery.length === 0) return true
    return [item.title, item.project, item.owner].join(' ').toLowerCase().includes(normalizedQuery)
  })

  const kpiCards = useMemo(
    () => [
      { id: 'plans', label: 'Total Active Plans', value: '42', subtext: '6 new this week', trend: '+6%', icon: Layers, trendColor: '#0ea5e9', trendSeries: [35, 36, 37, 38, 39, 40, 41, 42] },
      { id: 'milestones', label: 'Upcoming Milestones', value: '18', subtext: '5 due within 7 days', trend: '+2', icon: Flag, trendColor: '#6366f1', trendSeries: [12, 13, 14, 15, 16, 16, 17, 18] },
      { id: 'sprints', label: 'Active Sprints', value: '9', subtext: 'Across 6 programs', trend: '+1', icon: CalendarRange, trendColor: '#10b981', trendSeries: [6, 6, 7, 7, 8, 8, 8, 9] },
      { id: 'overdue', label: 'Overdue Items', value: '11', subtext: '3 need escalation', trend: '-1', icon: AlertTriangle, trendColor: '#f59e0b', trendSeries: [15, 14, 14, 13, 13, 12, 12, 11] },
      { id: 'sla', label: 'SLA at Risk', value: '7', subtext: '2 breach windows today', trend: '-2', icon: ShieldAlert, trendColor: '#f97316', trendSeries: [12, 11, 10, 9, 9, 8, 8, 7] },
      { id: 'variance', label: 'Plan vs Actual', value: '+6.2%', subtext: 'Improved 1.8% vs prior cycle', trend: '+1.8%', icon: Activity, trendColor: '#06b6d4', trendSeries: [11, 10, 9, 9, 8, 7.5, 7, 6.2] },
    ],
    []
  )

  const scheduleHealthScore = useMemo(
    () =>
      Math.round(
        scheduleHealth.reduce((sum, { label, value }) => {
          const weight = label === 'Healthy' ? 1 : label === 'Watchlist' ? 0.74 : 0.42
          return sum + value * weight
        }, 0)
      ),
    []
  )

  const currentPlanningPanel = useMemo(
    () => PLANNING_PANELS.find((p) => p.id === activePanel) ?? PLANNING_PANELS[0],
    [activePanel]
  )
  const PlanningHeaderIcon = currentPlanningPanel.icon

  const planningMainHeaderRight = useMemo(() => {
    switch (activePanel) {
      case 'overview':
        return <Badge className="border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">Control Layer</Badge>
      case 'timeline':
        return (
          <div
            className="inline-flex items-center rounded-xl border border-slate-200/70 bg-gradient-to-b from-slate-50/90 via-white to-slate-100/40 p-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-black/[0.03]"
            role="group"
            aria-label="Timeline zoom level"
          >
            {ZOOM_LEVEL_OPTIONS.map(({ level, icon: Icon }) => {
              const active = zoomLevel === level
              return (
                <button
                  key={level}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setZoomLevel(level)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[11px] font-semibold tracking-[0.02em] transition-all duration-200',
                    active
                      ? 'bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 text-white shadow-[0_2px_10px_rgba(15,23,42,0.2)]'
                      : 'text-slate-500 hover:bg-white/90 hover:text-slate-800'
                  )}
                >
                  <Icon
                    className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-white/90' : 'text-slate-400')}
                    strokeWidth={active ? 2.25 : 2}
                  />
                  {level}
                </button>
              )
            })}
          </div>
        )
      case 'calendar':
        return (
          <div className="flex gap-2">
            {(['Month', 'Week', 'Agenda'] as CalendarMode[]).map((mode) => (
              <Button key={mode} variant={calendarMode === mode ? 'default' : 'outline'} className="h-8 rounded-lg px-3 text-[11px]" onClick={() => setCalendarMode(mode)}>
                {mode}
              </Button>
            ))}
          </div>
        )
      case 'capacity':
        return (
          <Select className="h-8 rounded-lg border-slate-200 text-[11px]" value={capacityView} onChange={(event) => setCapacityView(event.target.value as CapacityView)}>
            {(['Team', 'Individual', 'Sprint', 'Project'] as CapacityView[]).map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </Select>
        )
      case 'deadline':
        return <Badge className="border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700">92.4% compliance</Badge>
      case 'resource':
        return <Badge className="border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">2 conflicts open</Badge>
      case 'baseline':
        return <Badge className="border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">Variance controls active</Badge>
      case 'insight':
        return <Badge className="border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700">AI-assisted</Badge>
      default:
        return null
    }
  }, [activePanel, zoomLevel, calendarMode, capacityView])

  return (
    <div className="min-h-0 space-y-6 pb-0">
      <div className={cn('space-y-6', workspaceDockedContentInsetClass(navDocked, isWorkspaceCollapsed, enterpriseNavLayoutVariant))}>
        <Breadcrumb items={[{ label: 'Planning & Scheduling' }]} />
        <PageHeader
          title="Planning & Scheduling"
          description="Manage timelines, sprints, calendars, capacity, deadlines, and delivery schedules"
          right={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white/75 p-1.5 shadow-sm backdrop-blur-sm">
                <button type="button" className="flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition-all duration-200 hover:bg-white hover:text-slate-900 hover:shadow-sm" aria-label="Create plan" title="Create plan">
                  <Plus className="h-5 w-5" strokeWidth={2} />
                </button>
                <button type="button" className="flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition-all duration-200 hover:bg-white hover:text-slate-900 hover:shadow-sm" aria-label="Import schedule" title="Import schedule">
                  <Upload className="h-5 w-5" strokeWidth={2} />
                </button>
                <button type="button" className="flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition-all duration-200 hover:bg-white hover:text-slate-900 hover:shadow-sm" aria-label="Export plan" title="Export plan">
                  <Download className="h-5 w-5" strokeWidth={2} />
                </button>
                <button type="button" className="flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition-all duration-200 hover:bg-white hover:text-slate-900 hover:shadow-sm" aria-label="Configure calendar" title="Configure calendar">
                  <Settings2 className="h-5 w-5" strokeWidth={2} />
                </button>
                {activePanel !== 'overview' ? (
                  <button
                    type="button"
                    onClick={() => setShowFiltersPanel((current) => !current)}
                    className={cn(
                      'flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition-all duration-200 hover:bg-white hover:text-slate-900 hover:shadow-sm',
                      showFiltersPanel && 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                    )}
                    aria-label={showFiltersPanel ? 'Hide filters panel' : 'Show filters panel'}
                    title={showFiltersPanel ? 'Hide filters panel' : 'Show filters panel'}
                  >
                    <Filter className="h-5 w-5" strokeWidth={2} />
                  </button>
                ) : null}
              </div>
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {kpiCards.map((item) => (
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
                  <span className={cn('shrink-0 font-semibold', item.trend.startsWith('-') ? 'text-rose-600' : 'text-emerald-600')}>{item.trend}</span>
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
              'rounded-2xl xl:rounded-r-2xl',
              !navDocked && 'h-full min-h-0 overflow-hidden'
            )}
            style={
              !navDocked && navPanelHeightPx
                ? { height: navPanelHeightPx, maxHeight: navPanelHeightPx, minHeight: navPanelHeightPx }
                : undefined
            }
            aria-label="Planning workspace navigation"
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
                  aria-label={isWorkspaceCollapsed ? 'Expand navigation' : 'Collapse navigation'}
                  title={isWorkspaceCollapsed ? 'Expand navigation' : 'Collapse navigation'}
                  onClick={() => setIsWorkspaceCollapsed((current) => !current)}
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
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-100/80">Planning Workspace</div>
                  <div className="mt-1.5 text-sm font-semibold leading-snug">Control tower for timeline, scheduling, and delivery planning</div>
                </div>
              ) : null}
            </div>

            {isWorkspaceCollapsed ? (
              <div className={cn(workspaceNavMenuScrollClass(), 'pt-0')}>
                <EnterpriseNavIconRail items={PLANNING_PANELS} activeId={activePanel} onSelect={setActivePanel} />
              </div>
            ) : (
              <>
                <div className={workspaceNavMenuScrollClass()}>
                  <div className={cn(enterpriseNavUltra ? 'space-y-1.5' : enterpriseNavCompact ? 'space-y-2' : 'space-y-4')}>
                    {PLANNING_PANEL_GROUPS.map(({ group, items }) => (
                      <div key={group} className="space-y-1.5">
                        {!enterpriseNavCompact ? (
                          <div className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{group}</div>
                        ) : null}
                        {items.map((panel) => {
                          const Icon = panel.icon
                          const active = activePanel === panel.id
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
                                  <span className="mt-1 block text-[11px] leading-4 text-slate-500">{panel.description}</span>
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
                        Schedule Health
                      </div>
                      <div className="mt-3 flex items-start gap-3">
                        <div className="shrink-0 text-3xl font-bold leading-none tabular-nums text-slate-900">{scheduleHealthScore}%</div>
                        <p className="min-w-0 flex-1 text-[10px] leading-snug text-slate-600">
                          Balanced delivery sequencing with dependency pressure that still needs active intervention.
                        </p>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-blue-100">
                        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${scheduleHealthScore}%` }} />
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </aside>

        <div
          className={cn(
            workspaceMainColumnClass(navDocked, isWorkspaceCollapsed, enterpriseNavLayoutVariant),
            sidebarFixed && 'flex min-h-0 min-w-0 flex-col'
          )}
        >
          {!isOverviewSectionActive && showFiltersPanel ? (
            <Card ref={mainPanelFiltersRef} className="glass-card shrink-0 rounded-2xl p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => startTransition(() => setQuery(event.target.value))}
                  placeholder="Search project, sprint, milestone, assignee, or schedule item"
                  className="h-11 rounded-2xl border-slate-200 bg-white pl-9 text-sm"
                />
              </div>
            </Card>
          ) : null}

          <PlanningPanelSection
            id={`planning-panel-${activePanel}`}
            title={currentPlanningPanel.label}
            description={currentPlanningPanel.description}
            highlight
            headerIcon={<PlanningHeaderIcon className="h-5 w-5" />}
            right={planningMainHeaderRight}
            outerRef={activeMainPanelRef}
            style={workspaceMainPanelViewportHeightStyle(mainPanelViewportHeightPx)}
            className={cn(
              mainPanelViewportHeightPx != null && 'min-h-0 flex-1 overflow-hidden',
              sidebarFixed && mainPanelViewportHeightPx == null && 'min-h-0 flex-1'
            )}
            scrollBody={mainPanelViewportHeightPx != null && activePanel !== 'timeline'}
            bodyFill={activePanel === 'timeline'}
          >
          {activePanel === 'overview' ? (
            <div className="space-y-5">
            {/* ROW 1 · Executive control surface — Schedule Health + Timeline Distribution */}
            <div className="grid gap-4 xl:grid-cols-2">
              <IntelligenceChartPanel
                title="Schedule Health Distribution"
                description="Healthy vs watchlist vs at-risk posture from current planning signals."
                icon={ShieldCheck}
                accent="from-emerald-300 via-emerald-400 to-teal-400"
                iconBgClass="bg-emerald-50 ring-1 ring-emerald-100"
                iconColorClass="text-emerald-500"
              >
                <ScheduleHealthExecutiveDonut
                  data={scheduleHealth.map((item) => ({ name: item.label, value: item.value, pct: `${item.value}%` }))}
                  score={scheduleHealthScore}
                  predictability={92}
                />
              </IntelligenceChartPanel>

              <IntelligenceChartPanel
                title="Timeline Distribution"
                description="Maturity of the delivery portfolio across Initiation → Closure lifecycle phases."
                icon={Layers}
                accent="from-sky-300 via-blue-400 to-indigo-400"
                iconBgClass="bg-sky-50 ring-1 ring-sky-100"
                iconColorClass="text-sky-500"
              >
                <IntelligenceDonut
                  centerLabel="Phases"
                  unitLabel="projects"
                  pieColors={PLAN_OVERVIEW_PAL.lifecyclePieColors}
                  data={(() => {
                    const t = timelineDistribution.reduce((sum, d) => sum + d.value, 0)
                    return timelineDistribution.map((d) => ({
                      name: d.name,
                      value: d.value,
                      color: d.fill,
                      pct: t > 0 ? `${Math.round((d.value / t) * 100)}%` : '0%',
                    }))
                  })()}
                />
              </IntelligenceChartPanel>
            </div>

            {/* ROW 2+ · Supporting control library — same two-column big-panel rhythm as the Control Tower */}
            <div className="grid gap-4 xl:grid-cols-2">
              {/* Row 1 · Card 3 — Baseline vs Actual Trend */}
              <PlanningOverviewCard
                title="Baseline vs Actual Trend"
                subtitle="Baseline vs actual completion over time"
                icon={<Activity className="h-4 w-4 text-sky-500" />}
                footer={
                  <div className="flex w-full items-center justify-between">
                    <div className="flex gap-4 text-[11px]">
                      <span className="text-slate-500">Schedule Variance <span className="font-semibold text-rose-600">-8%</span></span>
                      <span className="text-slate-500">Forecast <span className="font-semibold text-rose-600">-6 days</span></span>
                    </div>
                    <OverviewLink>View Trend Analysis</OverviewLink>
                  </div>
                }
              >
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={scheduleTrend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} interval={1} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, 100]} />
                      <RechartsTooltip />
                      <Line type="monotone" dataKey="baseline" name="Baseline" stroke="#3b82f6" strokeWidth={2.2} dot={false} />
                      <Line type="monotone" dataKey="actual" name="Actual" stroke="#22c55e" strokeWidth={2.2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </PlanningOverviewCard>

              {/* Row 2 · Card 4 — Milestone Status */}
              <IntelligenceChartPanel
                title="Milestone Status"
                description="Milestone achievement spread across Completed → Missed states."
                icon={Flag}
                accent="from-emerald-300 via-emerald-400 to-teal-400"
                iconBgClass="bg-emerald-50 ring-1 ring-emerald-100"
                iconColorClass="text-emerald-500"
                right={
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-600 shadow-sm">
                    Completion 43%
                  </span>
                }
              >
                <IntelligenceDonut
                  centerLabel="Milestones"
                  unitLabel="milestones"
                  pieColors={milestoneStatus.map((m) => m.fill)}
                  data={(() => {
                    const t = milestoneStatus.reduce((sum, d) => sum + d.value, 0)
                    return milestoneStatus.map((d) => ({
                      name: d.name,
                      value: d.value,
                      color: d.fill,
                      pct: t > 0 ? `${Math.round((d.value / t) * 100)}%` : '0%',
                    }))
                  })()}
                />
              </IntelligenceChartPanel>

              {/* Row 2 · Card 5 — Sprint Burnup / Burndown */}
              <PlanningOverviewCard
                title="Sprint Burnup / Burndown"
                subtitle="Sprint progress vs commitment"
                icon={<Activity className="h-4 w-4 text-indigo-500" />}
                badge={<OverviewBadge tone="emerald">92% Predictability</OverviewBadge>}
                footer={
                  <div className="flex w-full items-center justify-between text-[11px] text-slate-500">
                    <span>Committed <span className="font-semibold text-slate-800">86 SP</span></span>
                    <span>Completed <span className="font-semibold text-slate-800">76 SP</span></span>
                    <OverviewLink>View Sprint Detail</OverviewLink>
                  </div>
                }
              >
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sprintBurnup} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <RechartsTooltip />
                      <Line type="monotone" dataKey="ideal" name="Ideal" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                      <Line type="monotone" dataKey="remaining" name="Remaining" stroke="#3b82f6" strokeWidth={2.2} dot={false} />
                      <Line type="monotone" dataKey="completed" name="Completed" stroke="#22c55e" strokeWidth={2.2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </PlanningOverviewCard>

              {/* Row 2 · Card 6 — Dependency Risk */}
              <PlanningOverviewCard
                title="Dependency Risk"
                subtitle="Critical dependencies and risk exposure"
                accent="from-amber-300 via-orange-400 to-rose-400"
                icon={<Network className="h-4 w-4 text-rose-500" />}
                badge={<OverviewBadge tone="rose">Risk Index 64</OverviewBadge>}
                footer={
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded-full bg-slate-300" />Normal</span>
                      <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded-full bg-amber-400" />Cross-team</span>
                      <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded-full bg-rose-500" />Blocked</span>
                    </div>
                    <OverviewLink>View Dependency Map</OverviewLink>
                  </div>
                }
              >
                <div className="relative h-[220px] w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50/50">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                    {dependencyEdges.map((edge) => {
                      const from = dependencyNodes.find((n) => n.id === edge.from)!
                      const to = dependencyNodes.find((n) => n.id === edge.to)!
                      const stroke = edge.kind === 'blocked' ? '#ef4444' : edge.kind === 'cross-team' ? '#f59e0b' : '#cbd5e1'
                      return (
                        <line
                          key={`${edge.from}-${edge.to}`}
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke={stroke}
                          strokeWidth={edge.kind === 'normal' ? 0.5 : 0.8}
                          strokeDasharray={edge.kind === 'cross-team' ? '2 1.5' : undefined}
                          vectorEffect="non-scaling-stroke"
                        />
                      )
                    })}
                  </svg>
                  {dependencyNodes.map((node) => {
                    const tone =
                      node.status === 'blocked'
                        ? 'border-rose-300 bg-rose-50 text-rose-700'
                        : node.status === 'at-risk'
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : 'border-slate-200 bg-white text-slate-700'
                    return (
                      <div
                        key={node.id}
                        className={cn('absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border px-2 py-1 text-center shadow-sm', tone)}
                        style={{ left: `${node.x}%`, top: `${node.y}%` }}
                      >
                        <div className="text-[10px] font-semibold leading-tight">{node.label}</div>
                        <div className="text-[8px] leading-tight opacity-70">{node.meta}</div>
                      </div>
                    )
                  })}
                </div>
              </PlanningOverviewCard>

              {/* Row 3 · Card 7 — Capacity Forecast */}
              <PlanningOverviewCard
                title="Capacity Forecast"
                subtitle="Resource capacity forecast and utilization"
                icon={<Users className="h-4 w-4 text-sky-500" />}
                badge={<OverviewBadge tone="slate">Next 3 Periods</OverviewBadge>}
                footer={
                  <div className="flex w-full items-center justify-between text-[11px] text-slate-500">
                    <span>Capacity Utilization <span className="font-semibold text-slate-800">93%</span></span>
                    <OverviewLink>View Capacity Plan</OverviewLink>
                  </div>
                }
              >
                <div className="grid grid-cols-[88px_repeat(3,minmax(0,1fr))] gap-1.5 text-[10px]">
                  <span className="" />
                  {capacityForecastColumns.map((col) => (
                    <span key={col} className="text-center font-semibold uppercase tracking-[0.08em] text-slate-500">{col.replace(' ', '\n')}</span>
                  ))}
                  {capacityForecast.map((row) => (
                    <Fragment key={row.team}>
                      <span className="flex items-center text-[11px] font-medium text-slate-700">{row.team}</span>
                      {row.values.map((value, idx) => (
                        <div key={row.team + idx} className={cn('rounded-md py-1.5 text-center text-[11px] font-semibold shadow-sm', capacityColor(value))}>
                          {value}%
                        </div>
                      ))}
                    </Fragment>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-3 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-emerald-400/85" />Underutilized</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-amber-400/90" />Balanced</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-rose-500/85" />Overallocated</span>
                </div>
              </PlanningOverviewCard>

              {/* Row 3 · Card 8 — Schedule Variance */}
              <PlanningOverviewCard
                title="Schedule Variance"
                subtitle="Difference between baseline and forecast finish"
                accent="from-indigo-300 via-violet-400 to-fuchsia-400"
                icon={<TrendingUp className="h-4 w-4 text-indigo-500" />}
                footer={<OverviewLink>View Schedule Analysis</OverviewLink>}
              >
                <div className="space-y-2">
                  {scheduleVariance.map((row) => {
                    const tone =
                      row.variance <= 0 ? 'bg-emerald-500' : row.variance <= 5 ? 'bg-amber-400' : 'bg-rose-500'
                    const width = Math.min(Math.abs(row.variance) * 6 + 14, 100)
                    return (
                      <div key={row.project} className="grid grid-cols-[112px_1fr_56px] items-center gap-2 text-[11px]">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-700">{row.project}</p>
                          <p className="text-[9px] text-slate-400">{row.planned} → {row.forecast}</p>
                        </div>
                        <div className="h-3.5 rounded-full bg-slate-100">
                          <div className={cn('h-3.5 rounded-full', tone)} style={{ width: `${width}%` }} />
                        </div>
                        <span className={cn('text-right font-semibold tabular-nums', row.variance <= 0 ? 'text-emerald-600' : row.variance <= 5 ? 'text-amber-600' : 'text-rose-600')}>
                          {row.variance > 0 ? `+${row.variance}` : row.variance}d
                        </span>
                      </div>
                    )
                  })}
                </div>
              </PlanningOverviewCard>

              {/* Row 3 · Card 9 — AI Planning Insight */}
              <div className="relative flex flex-col overflow-hidden rounded-2xl border border-blue-200/70 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.08)] xl:col-span-2">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/[0.06] via-blue-500/[0.03] to-transparent" />
                <div className="relative flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow-sm">
                      <BrainCircuit className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        AI Planning Insight
                        <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                      </h3>
                      <p className="text-[11px] text-slate-500">AI-generated planning recommendations</p>
                    </div>
                  </div>
                  <OverviewBadge tone="indigo">92% Confidence</OverviewBadge>
                </div>
                <ul className="relative mt-3 flex-1 space-y-2">
                  {aiPlanningInsights.map((insight) => {
                    const Icon = insight.icon
                    return (
                      <li key={insight.text} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-white/70 px-2.5 py-2 text-[11px] leading-snug text-slate-600">
                        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
                        <span>{insight.text}</span>
                      </li>
                    )
                  })}
                </ul>
                <div className="relative mt-3 flex flex-wrap gap-2">
                  <Button className="h-8 rounded-lg bg-gradient-to-r from-indigo-500 to-blue-500 px-3 text-xs text-white hover:from-indigo-600 hover:to-blue-600">
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />Generate Recovery Plan
                  </Button>
                  <Button variant="outline" className="h-8 rounded-lg px-3 text-xs">View Recommendation</Button>
                  <Button variant="outline" className="h-8 rounded-lg px-3 text-xs">Open Timeline</Button>
                </div>
              </div>
            </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-6">
          {activePanel === 'timeline' ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {timelineLoading ? (
                <TimelineSkeleton />
              ) : timelineLoadError ? (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl border border-rose-200/80 bg-rose-50/40 px-6 py-10 text-center">
                  <AlertTriangle className="mb-3 h-8 w-8 text-rose-500" />
                  <p className="text-sm font-semibold text-rose-950">Timeline unavailable</p>
                  <p className="mt-2 max-w-md text-xs leading-relaxed text-rose-800/90">{timelineLoadError}</p>
                </div>
              ) : (
                <PlanningSvarGantt
                  items={visibleTimelineItems}
                  workspaceOrder={timelineWorkspaceOrder}
                  columns={PLANNING_TIMELINE_GANTT_COLUMNS}
                  zoomLevel={zoomLevel}
                  selectedId={selectedItemId}
                  onSelect={setSelectedItemId}
                />
              )}
            </div>
          ) : null}

          {activePanel === 'sprint' ? (
            <div className="space-y-4">
              <SprintPlanningTable selectedId={selectedItemId} onSelect={setSelectedItemId} />
              <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
                {sprintBoardSummary.map((column) => (
                  <div key={column.label} className={cn('rounded-2xl border px-3 py-3', column.tone)}>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em]">{column.label}</div>
                    <div className="mt-2 text-2xl font-semibold">{column.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activePanel === 'calendar' ? (
            <div className="space-y-4">
              <div className="mb-4 flex flex-wrap gap-2">
                <Button variant="outline" className="h-8 rounded-lg px-3 text-xs"><CalendarClock className="mr-2 h-4 w-4" />Schedule Item</Button>
                <Button variant="outline" className="h-8 rounded-lg px-3 text-xs"><Clock3 className="mr-2 h-4 w-4" />Edit Date</Button>
                <Button variant="outline" className="h-8 rounded-lg px-3 text-xs"><ArrowRight className="mr-2 h-4 w-4" />View Linked Work</Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleCalendarEvents.map((event) => (
                  <button
                    key={event.id + event.dateLabel}
                    onClick={() => setSelectedItemId(event.id)}
                    className="group rounded-2xl border border-slate-200/80 bg-white/95 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Badge className={cn('border px-2 py-0.5 text-[10px] font-semibold', toneForCalendarType(event.type))}>{event.type}</Badge>
                      <GripVertical className="h-4 w-4 text-slate-300 group-hover:text-sky-400" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-950">{event.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{event.project}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>{event.dateLabel}</span>
                      <span>{event.owner}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {activePanel === 'capacity' ? (
            <div className="space-y-4">
              <div className="mb-4 flex flex-wrap gap-2">
                <Button variant="outline" className="h-8 rounded-lg px-3 text-xs"><Zap className="mr-2 h-4 w-4" />Rebalance Capacity</Button>
                <Button variant="outline" className="h-8 rounded-lg px-3 text-xs"><Users className="mr-2 h-4 w-4" />Assign Resource</Button>
                <Button variant="outline" className="h-8 rounded-lg px-3 text-xs"><CalendarRange className="mr-2 h-4 w-4" />Adjust Plan</Button>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200/80">
                <div className="grid grid-cols-[160px_repeat(5,minmax(0,1fr))] gap-2 border-b border-slate-200/70 bg-slate-50/90 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <span>{capacityView}</span>
                  {capacityPeriods.map((period) => <span key={period} className="text-center">{period}</span>)}
                </div>
                <div className="space-y-2 px-3 py-3">
                  {capacityRows.map((row) => (
                    <div key={row.name} className="grid grid-cols-[160px_repeat(5,minmax(0,1fr))] gap-2 items-center">
                      <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700">{row.name}</div>
                      {row.values.map((value, index) => (
                        <div key={row.name + index} className={cn('rounded-xl px-2 py-2 text-center text-xs font-semibold shadow-sm', capacityColor(value))}>
                          {value}%
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ['Available Capacity', '1,740 h'],
                  ['Planned Load', '1,612 h'],
                  ['Overallocated', '5 resources'],
                  ['Unused Capacity', '128 h'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activePanel === 'deadline' ? (
            <div className="space-y-4">
              <div className="mb-4 flex flex-wrap gap-2">
                <Button variant="outline" className="h-8 rounded-lg px-3 text-xs"><AlertTriangle className="mr-2 h-4 w-4" />Escalate</Button>
                <Button variant="outline" className="h-8 rounded-lg px-3 text-xs"><Clock3 className="mr-2 h-4 w-4" />Extend Deadline</Button>
                <Button variant="outline" className="h-8 rounded-lg px-3 text-xs"><Users className="mr-2 h-4 w-4" />Reassign Owner</Button>
                <Button variant="outline" className="h-8 rounded-lg px-3 text-xs"><ShieldAlert className="mr-2 h-4 w-4" />Review SLA</Button>
              </div>
              <div className="space-y-3">
                {visibleDeadlines.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    className="w-full rounded-2xl border border-slate-200/80 bg-white/95 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.project} · {item.owner}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={cn('border px-2 py-0.5 text-[10px] font-semibold', toneForDeadline(item.deadlineStatus))}>{item.deadlineStatus}</Badge>
                        <Badge className={cn('border px-2 py-0.5 text-[10px] font-semibold', toneForSla(item.slaStatus))}>{item.slaStatus}</Badge>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>Due {item.due}</span>
                      <span className="inline-flex items-center gap-1 font-medium text-slate-700"><Flag className="h-3.5 w-3.5" />Linked work open</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {activePanel === 'resource' ? (
            <div className="space-y-4">
              <div className="mb-4 flex flex-wrap gap-2">
                <Button variant="outline" className="h-8 rounded-lg px-3 text-xs"><Users className="mr-2 h-4 w-4" />Reassign Resource</Button>
                <Button variant="outline" className="h-8 rounded-lg px-3 text-xs"><CalendarClock className="mr-2 h-4 w-4" />Adjust Schedule</Button>
                <Button variant="outline" className="h-8 rounded-lg px-3 text-xs"><AlertTriangle className="mr-2 h-4 w-4" />Resolve Conflict</Button>
              </div>
              <div className="space-y-3">
                {resourceAllocations.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => setSelectedItemId(row.id.replace('res-001', 'plan-001').replace('res-002', 'stream-data').replace('res-003', 'milestone-ux').replace('res-004', 'deadline-qa'))}
                    className="w-full rounded-2xl border border-slate-200/80 bg-white/95 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{row.resource}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.project} · {row.team}</p>
                      </div>
                      <Badge className={cn('border px-2 py-0.5 text-[10px] font-semibold', row.conflict === 'None' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : row.conflict === 'Overlap' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-rose-200 bg-rose-50 text-rose-700')}>{row.conflict}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-[1fr_96px] gap-3 items-center">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                          <span>{row.period}</span>
                          <span className="font-medium text-slate-700">{row.allocation}% allocation</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200">
                          <div className={cn('h-2 rounded-full', row.allocation >= 100 ? 'bg-rose-500' : row.allocation >= 90 ? 'bg-amber-500' : 'bg-sky-500')} style={{ width: `${Math.min(row.allocation, 100)}%` }} />
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-700">{row.period}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {activePanel === 'baseline' ? (
            <div className="space-y-4">
              <div className="mb-4 flex flex-wrap gap-2">
                <Button variant="outline" className="h-8 rounded-lg px-3 text-xs"><Target className="mr-2 h-4 w-4" />Reset Baseline</Button>
                <Button variant="outline" className="h-8 rounded-lg px-3 text-xs"><Sparkles className="mr-2 h-4 w-4" />Review Variance</Button>
                <Button variant="outline" className="h-8 rounded-lg px-3 text-xs"><Download className="mr-2 h-4 w-4" />Export Tracking Report</Button>
              </div>
              <div className="space-y-3">
                {baselineRecords.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    className="w-full rounded-2xl border border-slate-200/80 bg-white/95 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.project}</p>
                      </div>
                      <Badge className={cn('border px-2 py-0.5 text-[10px] font-semibold', toneForVariance(item.delayDays))}>
                        {item.delayDays > 0 ? `+${item.delayDays} days` : `${item.delayDays} days`}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 text-xs text-slate-500">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="font-semibold text-slate-700">Planned</div>
                        <div className="mt-1">{item.planned}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="font-semibold text-slate-700">Actual</div>
                        <div className="mt-1">{item.actual}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>Deviation {item.deviation}%</span>
                      <span className="font-semibold text-slate-700">Baseline adherence {item.adherence}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {activePanel === 'insight' ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {alertFeed.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => setSelectedItemId(alert.linkedItemId)}
                  className="group rounded-2xl border border-slate-200/80 bg-white/95 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 group-hover:border-sky-200 group-hover:text-sky-600">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-950">{alert.title}</h3>
                          <Badge className={cn('border px-2 py-0.5 text-[10px] font-semibold', toneForSeverity(alert.severity))}>{alert.severity}</Badge>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">{alert.detail}</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-sky-500" />
                  </div>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Recommendation:</span> {alert.recommendation}
                  </div>
                </button>
              ))}
            </div>
          ) : null}
            </div>
          )}
          </PlanningPanelSection>
        </div>
      </div>
      </div>
    </div>
  )
}

/**
 * Palette + chart-panel chrome ported from Workspace Management → "Workspace Intelligence
 * Control Tower" (pastel tone) so the Planning Overview shares the same control-tower design
 * language: gradient accent bar, framed icon chip, executive donut, and intelligence donut.
 */
const PLAN_OVERVIEW_PAL = {
  cardBg: 'bg-[linear-gradient(160deg,rgba(255,255,255,0.94),rgba(248,250,252,0.90))]',
  cardBorder: 'border-slate-200/90',
  healthSegHealthy: '#34d399',
  healthSegHealthyEnd: '#10b981',
  healthSegRisk: '#fbbf24',
  healthSegRiskEnd: '#f59e0b',
  healthSegCritical: '#fb7185',
  healthSegCriticalEnd: '#f43f5e',
  lifecyclePieColors: ['#0ea5e9', '#6366f1', '#22c55e', '#f59e0b', '#14b8a6'],
} as const

function PlanningOverviewCard({
  title,
  subtitle,
  icon,
  badge,
  footer,
  children,
  accent = 'from-sky-300 via-blue-400 to-indigo-400',
}: {
  title: string
  subtitle: string
  icon?: React.ReactNode
  badge?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  /** Gradient classes for the top accent bar (control-tower look). */
  accent?: string
}) {
  return (
    <Card className={cn('relative flex min-h-[296px] flex-col overflow-hidden rounded-2xl p-5 shadow-[0_12px_34px_rgba(15,23,42,0.08)]', PLAN_OVERVIEW_PAL.cardBg, PLAN_OVERVIEW_PAL.cardBorder)}>
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-gradient-to-r opacity-85', accent)} />
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon ? (
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80">
                {icon}
              </span>
            ) : null}
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          </div>
          <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
      {footer ? <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">{footer}</div> : null}
    </Card>
  )
}

/** Gradient-accent chart panel — mirrors `IntelligenceChartPanel` from the Workspace Control Tower. */
function IntelligenceChartPanel({
  title,
  description,
  icon: Icon,
  accent,
  iconBgClass,
  iconColorClass,
  right,
  children,
}: {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  accent: string
  iconBgClass: string
  iconColorClass: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className={cn('relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl p-5 shadow-[0_12px_34px_rgba(15,23,42,0.08)]', PLAN_OVERVIEW_PAL.cardBg, PLAN_OVERVIEW_PAL.cardBorder)}>
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-gradient-to-r opacity-85', accent)} />
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', iconBgClass)}>
              <Icon className={cn('h-4 w-4', iconColorClass)} />
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

/** Glass intelligence donut with legend/progress rows — ported (pastel tone) from the Control Tower. */
function IntelligenceDonut({
  data,
  centerLabel,
  pieColors,
  unitLabel = 'projects',
}: {
  data: Array<{ name: string; value: number; color: string; pct: string }>
  centerLabel: string
  pieColors?: readonly string[]
  unitLabel?: string
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const donutIdBase = useMemo(() => `plan-${centerLabel.toLowerCase().replace(/\s+/g, '-')}`, [centerLabel])

  const renderPctLabel = ({
    cx, cy, midAngle, innerRadius, outerRadius, percent,
  }: {
    cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number; percent?: number
  }) => {
    if ((percent ?? 0) < 0.08) return null
    const RADIAN = Math.PI / 180
    const radius = (innerRadius ?? 0) + ((outerRadius ?? 0) - (innerRadius ?? 0)) * 0.5
    const x = (cx ?? 0) + radius * Math.cos(-(midAngle ?? 0) * RADIAN)
    const y = (cy ?? 0) + radius * Math.sin(-(midAngle ?? 0) * RADIAN)
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={800}
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))', letterSpacing: '-0.01em' }}>
        {`${((percent ?? 0) * 100).toFixed(0)}%`}
      </text>
    )
  }

  return (
    <div className="grid items-center gap-5 lg:grid-cols-[224px,1fr]">
      <div className="relative mx-auto h-56 w-56 shrink-0">
        <div className="pointer-events-none absolute -inset-3 rounded-full" style={{
          background: 'conic-gradient(from 220deg, rgba(99,102,241,0.15), rgba(14,165,233,0.11), rgba(16,185,129,0.13), rgba(99,102,241,0.15))',
          filter: 'blur(1px)',
        }} />
        <div className="pointer-events-none absolute inset-2 rounded-full border border-white/90 bg-gradient-to-br from-white/95 via-slate-50/95 to-slate-100/85 shadow-[0_14px_32px_rgba(15,23,42,0.10)]" />
        <div className="absolute inset-0 min-h-0 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                {data.map((entry, index) => {
                  const sc = pieColors?.[index] ?? entry.color
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
                innerRadius={60}
                outerRadius={88}
                cornerRadius={7}
                paddingAngle={2.5}
                dataKey="value"
                labelLine={false}
                label={renderPctLabel}
                stroke="white"
                strokeWidth={1.5}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                style={{ outline: 'none' }}
              >
                {data.map((entry, index) => {
                  const dimmed = activeIndex !== null && activeIndex !== index
                  return (
                    <Cell
                      key={entry.name}
                      fill={`url(#${donutIdBase}-seg-${index})`}
                      fillOpacity={!dimmed ? 1 : 0.38}
                      style={{ outline: 'none', filter: activeIndex === index ? 'drop-shadow(0 8px 14px rgba(15,23,42,0.20))' : undefined }}
                    />
                  )
                })}
              </Pie>
              <RechartsTooltip formatter={(value: number, name: string) => [`${value} ${unitLabel}`, name]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="rounded-2xl border border-white/90 px-4 py-2 text-center backdrop-blur-sm"
            style={{ background: 'rgba(255,255,255,0.88)', boxShadow: '0 8px 22px rgba(15,23,42,0.10)' }}>
            <div className="text-3xl font-bold leading-none tracking-tight text-slate-900">{total}</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{centerLabel}</div>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {data.map((item, idx) => {
          const sc = pieColors?.[idx] ?? item.color
          const ratio = total > 0 ? Math.max(0, Math.min(100, Math.round((item.value / total) * 100))) : 0
          const isActive = activeIndex === idx
          return (
            <div
              key={item.name}
              className={cn(
                'rounded-xl border px-3 py-2.5 transition-all duration-200',
                isActive ? 'border-slate-300 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.08)]' : 'border-slate-200/90 bg-white/80 hover:border-slate-300 hover:bg-white'
              )}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: sc }} />
                  <span className="text-sm font-medium text-slate-700">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">{item.value}</span>
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

/** Executive donut for schedule health — ported/relabeled from `WorkspaceHealthExecutiveDonut`. */
function ScheduleHealthExecutiveDonut({
  data,
  score,
  predictability,
}: {
  data: Array<{ name: string; value: number; pct: string }>
  score: number
  predictability: number
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const pal = PLAN_OVERVIEW_PAL
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const healthyPct = total > 0 ? Math.round(((data[0]?.value ?? 0) / total) * 100) : 0
  const atRiskPct = total > 0 ? Math.round(((data[2]?.value ?? 0) / total) * 100) : 0
  const stabilityScore = Math.max(0, Math.min(100, score + Math.round((healthyPct / 100) * 12) - Math.round((atRiskPct / 100) * 16)))
  const segGrad = (i: number): [string, string] =>
    i === 0 ? [pal.healthSegHealthy, pal.healthSegHealthyEnd] : i === 1 ? [pal.healthSegRisk, pal.healthSegRiskEnd] : [pal.healthSegCritical, pal.healthSegCriticalEnd]
  const statusTrends: Record<string, number[]> = {
    Healthy: [48, 51, 54, 56, 58, 60],
    Watchlist: [30, 28, 27, 26, 25, 24],
    'At Risk': [22, 20, 18, 16, 15, 13],
  }

  return (
    <>
      <style>{`
        @keyframes plan-sheen-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .plan-sheen-ring { animation: plan-sheen-spin 14s linear infinite; }
      `}</style>
      <div className="grid gap-5 lg:grid-cols-[250px,1fr] lg:items-center">
        <div className="relative mx-auto h-60 w-60">
          <div className="pointer-events-none absolute -inset-4 rounded-full" style={{ background: 'radial-gradient(ellipse 90% 90% at 50% 50%, rgba(16,185,129,0.15) 0%, rgba(14,165,233,0.10) 40%, transparent 72%)' }} />
          <div className="plan-sheen-ring pointer-events-none absolute -inset-1 rounded-full" style={{
            background: 'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.55) 12%, transparent 25%, transparent 50%, rgba(255,255,255,0.28) 62%, transparent 75%, transparent 100%)',
            maskImage: 'radial-gradient(circle, transparent 44%, black 52%, black 56%, transparent 62%)',
            WebkitMaskImage: 'radial-gradient(circle, transparent 44%, black 52%, black 56%, transparent 62%)',
          }} />
          <div className="pointer-events-none absolute -inset-2 rounded-full" style={{
            background: 'conic-gradient(from 180deg, rgba(16,185,129,0.28), rgba(14,165,233,0.22), rgba(244,63,94,0.18), rgba(16,185,129,0.28))',
            filter: 'blur(2px)',
            opacity: 0.6,
          }} />
          <div className="pointer-events-none absolute inset-3 rounded-full border border-white/80 bg-gradient-to-br from-slate-50/90 via-white/95 to-slate-100/85 shadow-[0_22px_52px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.95)]" />
          <div className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-emerald-200/80 bg-emerald-50/95 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 shadow-sm">
            Execution Resilience
          </div>
          <div className="absolute inset-0 min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {data.map((entry, index) => {
                    const [from, to] = segGrad(index)
                    return (
                      <linearGradient key={entry.name} id={`plan-health-seg-${index}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={from} />
                        <stop offset="100%" stopColor={to} />
                      </linearGradient>
                    )
                  })}
                </defs>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={64}
                  outerRadius={96}
                  cornerRadius={8}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="#ffffff"
                  strokeWidth={3}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  isAnimationActive
                  animationDuration={800}
                  animationEasing="ease-out"
                >
                  {data.map((entry, index) => {
                    const dimmed = activeIndex !== null && activeIndex !== index
                    return (
                      <Cell
                        key={entry.name}
                        fill={`url(#plan-health-seg-${index})`}
                        fillOpacity={dimmed ? 0.35 : 1}
                        style={{ filter: activeIndex === index ? 'drop-shadow(0 6px 12px rgba(15,23,42,0.22))' : undefined }}
                      />
                    )
                  })}
                </Pie>
                <RechartsTooltip formatter={(value: number, name: string) => [`${value}%`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl font-bold leading-none tracking-tight text-slate-900">{score}</div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.15em] text-slate-500">Schedule Health</div>
            <div className="mt-2 rounded-full border border-slate-300 bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-slate-700 shadow-sm">
              Predictability {predictability}
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-slate-200/80 bg-white/95 px-3 py-1 text-[10px] font-semibold text-slate-600 shadow-[0_8px_22px_rgba(15,23,42,0.08)]">
            Stability Score {stabilityScore}
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white via-slate-50/75 to-slate-100/80 px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Executive Signal</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {score >= 80 ? 'Stable Delivery' : score >= 65 ? 'Watchlist Required' : 'Immediate Intervention'}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white px-3 py-2 shadow-[0_8px_24px_rgba(16,185,129,0.10)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-500">Healthy Coverage</div>
              <div className="mt-1 text-sm font-semibold text-emerald-700">{healthyPct}% of plans</div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white px-3 py-2 shadow-[0_8px_24px_rgba(244,63,94,0.10)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-500">At-Risk Exposure</div>
              <div className="mt-1 text-sm font-semibold text-rose-700">{atRiskPct}% of plans</div>
            </div>
          </div>

          <div className="space-y-1.5">
            {data.map((item, idx) => {
              const [from, to] = segGrad(idx)
              return (
                <div
                  key={item.name}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(null)}
                  className={cn(
                    'group flex items-center justify-between rounded-xl border px-3 py-2.5 transition-all duration-200',
                    activeIndex === idx ? 'border-slate-300 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.08)]' : 'border-slate-200 bg-white/80 hover:border-slate-300 hover:bg-white'
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: `linear-gradient(135deg,${from},${to})` }} />
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-slate-700">{item.name}</span>
                      <div className="mt-1 flex items-end gap-1">
                        {(statusTrends[item.name] ?? [0, 0, 0, 0, 0, 0]).map((v, i, arr) => {
                          const max = Math.max(...arr)
                          const h = Math.round(3 + (v / Math.max(1, max)) * 11)
                          return (
                            <span
                              key={`${item.name}-${i}`}
                              className="inline-block w-[4px] rounded-sm"
                              style={{ height: `${h}px`, background: `linear-gradient(180deg,${from},${to})`, opacity: 0.5 + (i / arr.length) * 0.5 }}
                            />
                          )
                        })}
                      </div>
                    </div>
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
    </>
  )
}

function OverviewBadge({ tone, children }: { tone: 'sky' | 'emerald' | 'rose' | 'indigo' | 'slate'; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    sky: 'border-sky-200 bg-sky-50 text-sky-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
  }
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', tones[tone])}>{children}</span>
}

function OverviewLink({ children }: { children: React.ReactNode }) {
  return (
    <button className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 transition-colors hover:text-sky-700">
      {children}
      <ArrowRight className="h-3.5 w-3.5" />
    </button>
  )
}

type SprintPlanStatus = 'Active' | 'Upcoming' | 'At Capacity' | 'Not Planned'
type SprintPlanHealth = 'On Track' | 'Planned' | 'At Capacity' | 'Not Planned'

type SprintPlanRow = {
  id: string
  name: string
  subtitle: string
  status: SprintPlanStatus
  dateRange: string
  timing: string
  timingTone: 'remaining' | 'starts'
  capacity: number
  committed: number
  utilization: number
  workItems: number
  highItems: number
  progress: number
  doneItems: number
  totalItems: number
  health: SprintPlanHealth
  healthNote: string
  ownerName: string
  ownerRole: string
  accent: string
}

const sprintPlanRows: SprintPlanRow[] = [
  { id: 'sprint-24', name: 'Sprint 24', subtitle: 'Adira Digital Lending', status: 'Active', dateRange: '14 Apr – 25 Apr 2025', timing: '12 days remaining', timingTone: 'remaining', capacity: 68, committed: 61, utilization: 89.7, workItems: 24, highItems: 8, progress: 62, doneItems: 15, totalItems: 24, health: 'On Track', healthNote: 'Healthy', ownerName: 'Ayla Putri', ownerRole: 'Product Owner', accent: 'bg-emerald-500' },
  { id: 'sprint-25', name: 'Sprint 25', subtitle: 'Adira Collection', status: 'Upcoming', dateRange: '28 Apr – 09 May 2025', timing: 'Starts in 3 days', timingTone: 'starts', capacity: 66, committed: 48, utilization: 72.7, workItems: 20, highItems: 5, progress: 0, doneItems: 0, totalItems: 20, health: 'Planned', healthNote: 'Good', ownerName: 'Jonas Rahardian', ownerRole: 'Tech Lead', accent: 'bg-sky-500' },
  { id: 'sprint-26', name: 'Sprint 26', subtitle: 'AI & Analytics Platform', status: 'Upcoming', dateRange: '12 May – 23 May 2025', timing: 'Starts in 17 days', timingTone: 'starts', capacity: 64, committed: 52, utilization: 81.3, workItems: 22, highItems: 6, progress: 0, doneItems: 0, totalItems: 22, health: 'Planned', healthNote: 'Good', ownerName: 'Mina Aulia', ownerRole: 'Backend Engineer', accent: 'bg-sky-500' },
  { id: 'sprint-27', name: 'Sprint 27', subtitle: 'Migration Initiative', status: 'At Capacity', dateRange: '26 May – 06 Jun 2025', timing: 'Starts in 31 days', timingTone: 'starts', capacity: 60, committed: 60, utilization: 100, workItems: 18, highItems: 7, progress: 0, doneItems: 0, totalItems: 18, health: 'At Capacity', healthNote: 'Monitor', ownerName: 'Rizky Pratama', ownerRole: 'UI/UX Designer', accent: 'bg-amber-500' },
  { id: 'sprint-28', name: 'Sprint 28', subtitle: 'Fraud Prevention', status: 'Not Planned', dateRange: '09 Jun – 20 Jun 2025', timing: 'Starts in 45 days', timingTone: 'starts', capacity: 62, committed: 0, utilization: 0, workItems: 0, highItems: 0, progress: 0, doneItems: 0, totalItems: 0, health: 'Not Planned', healthNote: 'N/A', ownerName: '', ownerRole: '', accent: 'bg-slate-300' },
  { id: 'sprint-29', name: 'Sprint 29', subtitle: 'CRM Enhancement', status: 'Not Planned', dateRange: '23 Jun – 04 Jul 2025', timing: 'Starts in 59 days', timingTone: 'starts', capacity: 62, committed: 0, utilization: 0, workItems: 0, highItems: 0, progress: 0, doneItems: 0, totalItems: 0, health: 'Not Planned', healthNote: 'N/A', ownerName: '', ownerRole: '', accent: 'bg-slate-300' },
]

function sprintStatusBadgeTone(status: SprintPlanStatus): string {
  switch (status) {
    case 'Active': return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'Upcoming': return 'border-sky-200 bg-sky-50 text-sky-700'
    case 'At Capacity': return 'border-amber-200 bg-amber-50 text-amber-700'
    default: return 'border-slate-200 bg-slate-100 text-slate-500'
  }
}

function sprintHealthDot(health: SprintPlanHealth): string {
  switch (health) {
    case 'On Track': return 'bg-emerald-500'
    case 'Planned': return 'bg-sky-500'
    case 'At Capacity': return 'bg-amber-500'
    default: return 'bg-slate-300'
  }
}

function SprintUtilGauge({ value }: { value: number }) {
  const r = 16
  const circ = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, value))
  const color = value >= 100 ? '#f43f5e' : value >= 90 ? '#f59e0b' : value > 0 ? '#10b981' : '#cbd5e1'
  const label = value % 1 === 0 ? `${value}%` : `${value.toFixed(1)}%`
  return (
    <div className="relative h-11 w-11">
      <svg viewBox="0 0 40 40" className="h-11 w-11 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#e8edf3" strokeWidth="4" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums" style={{ color }}>{label}</span>
    </div>
  )
}

function SprintOwnerAvatar({ name }: { name: string }) {
  if (!name) return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-400">—</span>
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const palette = ['bg-sky-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500']
  const color = palette[name.length % palette.length]
  return <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white', color)}>{initials}</span>
}

/** Sprint Planning table — column-rich roster view (status, capacity, utilization, progress, health, owner). */
function SprintPlanningTable({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const headClass = 'whitespace-nowrap px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400'
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm [scrollbar-width:thin]">
      <table className="w-full min-w-[1080px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70">
            <th className={headClass}>Sprint</th>
            <th className={headClass}>Status</th>
            <th className={headClass}>Date Range</th>
            <th className={headClass}>Capacity (pts)</th>
            <th className={headClass}>Committed (pts)</th>
            <th className={cn(headClass, 'text-center')}>Utilization</th>
            <th className={headClass}>Work Items</th>
            <th className={headClass}>Progress</th>
            <th className={headClass}>Health</th>
            <th className={headClass}>Owner</th>
            <th className={cn(headClass, 'text-center')}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sprintPlanRows.map((row) => {
            const buffer = row.capacity - row.committed
            const selected = selectedId === row.id
            const muted = row.status === 'Not Planned'
            return (
              <tr
                key={row.id}
                onClick={() => onSelect(row.id)}
                className={cn('cursor-pointer border-b border-slate-100 transition-colors', selected ? 'bg-sky-50/70' : 'hover:bg-slate-50/70')}
              >
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className={cn('h-8 w-1 shrink-0 rounded-full', row.accent)} />
                    <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                    <div className="min-w-0">
                      <div className={cn('text-[13px] font-semibold', muted ? 'text-slate-500' : 'text-slate-900')}>{row.name}</div>
                      <div className="truncate text-[11px] text-slate-400">{row.subtitle}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold', sprintStatusBadgeTone(row.status))}>{row.status}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  <div className={cn('text-[12px]', muted ? 'text-slate-500' : 'text-slate-700')}>{row.dateRange}</div>
                  <div className={cn('text-[11px]', row.timingTone === 'remaining' ? 'text-sky-600' : 'text-slate-400')}>{row.timing}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  <div className="text-[13px] font-semibold text-slate-800">{row.capacity} pts</div>
                  <div className="text-[11px] text-slate-400">Team Capacity</div>
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  <div className={cn('text-[13px] font-semibold', muted ? 'text-slate-500' : 'text-slate-800')}>{row.committed} pts</div>
                  <div className={cn('text-[11px] font-medium', buffer === 0 ? 'text-rose-500' : 'text-emerald-600')}>+{buffer} buffer</div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-center"><SprintUtilGauge value={row.utilization} /></div>
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  <div className={cn('text-[13px] font-semibold', muted ? 'text-slate-500' : 'text-slate-800')}>{row.workItems}</div>
                  <div className={cn('text-[11px] font-medium', row.highItems > 0 ? 'text-rose-500' : 'text-slate-400')}>{row.highItems} High</div>
                </td>
                <td className="px-3 py-3" style={{ minWidth: 132 }}>
                  <div className="text-[12px] font-semibold text-slate-700">{row.progress}%</div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500" style={{ width: `${row.progress}%` }} />
                  </div>
                  <div className="mt-1 text-right text-[10px] text-slate-400">{row.doneItems} / {row.totalItems} done</div>
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', sprintHealthDot(row.health))} />
                    <span className={cn('text-[12px] font-medium', muted ? 'text-slate-400' : 'text-slate-700')}>{row.health}</span>
                  </div>
                  <div className="ml-3.5 text-[11px] text-slate-400">{row.healthNote}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  {row.ownerName ? (
                    <div className="flex items-center gap-2">
                      <SprintOwnerAvatar name={row.ownerName} />
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium text-slate-700">{row.ownerName}</div>
                        <div className="text-[11px] text-slate-400">{row.ownerRole}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2"><SprintOwnerAvatar name="" /><span className="text-[12px] text-slate-400">—</span></div>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Sprint actions"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

