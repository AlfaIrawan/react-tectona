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
  Flag,
  GitBranch,
  GripVertical,
  Layers,
  LayoutGrid,
  CheckCircle2,
  MoreVertical,
  Network,
  PanelLeft,
  Plus,
  Search,
  X,
  ShieldAlert,
  ShieldCheck,
  Signal,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
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
import {
  enterpriseCyanGradientActionButtonClass,
  enterpriseSecondaryButtonClass,
} from '@/lib/enterpriseButtonClasses'
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
import { getSession } from '@/auth/authService'
import { hasPlatformAdminAccess } from '@/lib/auth/platformAccess'
import { usePreferencesStore } from '@/stores/preferences-store'
import { useUserWorkspaceOptions } from '@/modules/core-shell/hooks/useUserWorkspaceOptions'
import {
  usePlanningTimelineDirectory,
  PlanningTimelineDirectoryToolbar,
  PlanningTimelineDirectoryTable,
} from '@/modules/planning-scheduling/components/PlanningTimelineDirectory'
import { mapWorkItemsToPlanningGantt } from '@/modules/planning-scheduling/utils/mapWorkItemsToPlanningGantt'
import { listWorkItems, type WorkItemApiModel } from '@/lib/api/workApi'
import { fetchAllWorkspaceOrgWorkspaces, type WorkspaceOrgWorkspaceDto } from '@/lib/api/workspaceOrgApi'

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
        'liquid-glass-enterprise-panel flex min-h-0 w-full min-w-0 max-w-none flex-col gap-3 overflow-hidden rounded-2xl border border-border/40 p-4 transition-all lg:p-5',
        highlight ? 'border-blue-300 ring-2 ring-blue-100' : null,
        (scrollBody || bodyFill) && 'flex min-h-0 flex-col overflow-hidden',
        className
      )}
    >
      <div className="shrink-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {headerIcon ? <span className="shrink-0 text-foreground">{headerIcon}</span> : null}
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            </div>
            <p className="mt-0.5 max-w-2xl text-[11px] text-muted-foreground">{description}</p>
          </div>
          {right ? (
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 overflow-x-auto py-1 whitespace-nowrap lg:justify-end">
              {right}
            </div>
          ) : null}
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
  const session = getSession()
  const sessionRoles = session?.user.roles?.length
    ? session.user.roles
    : session?.user.role === 'root'
      ? ['tectona_root']
      : session?.user.role === 'admin'
        ? ['tectona_admin']
        : []
  const isPlatformAdmin = hasPlatformAdminAccess(sessionRoles, session?.user.role)
  const { options: userWorkspaceOptions, loading: userWorkspacesLoading } = useUserWorkspaceOptions()

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
  const [rawWorkItems, setRawWorkItems] = useState<WorkItemApiModel[]>([])
  const [orgWorkspaces, setOrgWorkspaces] = useState<WorkspaceOrgWorkspaceDto[]>([])
  const [workItemsLoading, setWorkItemsLoading] = useState(true)
  const [timelineLoadError, setTimelineLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('Month')
  const [capacityView, setCapacityView] = useState<CapacityView>('Team')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [activePanel, setActivePanel] = useState<PlanningPanelId>('overview')
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(false)
  const [showFiltersPanel, setShowFiltersPanel] = useState(true)
  const [showKpiCards, setShowKpiCards] = useState(true)

  const setPlanningPanel = (panel: PlanningPanelId) => {
    setActivePanel(panel)
    if (panel === 'sprint') setShowFiltersPanel(true)
  }
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
      setWorkItemsLoading(true)
      setTimelineLoadError(null)
      try {
        const [workRes, workspaces] = await Promise.all([
          listWorkItems(),
          fetchAllWorkspaceOrgWorkspaces().catch(() => []),
        ])
        if (cancelled) return
        setRawWorkItems(Array.isArray(workRes.items) ? workRes.items : [])
        setOrgWorkspaces(Array.isArray(workspaces) ? workspaces : [])
      } catch {
        if (!cancelled) {
          setRawWorkItems([])
          setOrgWorkspaces([])
          setTimelineLoadError(WORK_TIMELINE_UNAVAILABLE_MESSAGE)
        }
      } finally {
        if (!cancelled) setWorkItemsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const accessibleOrgWorkspaces = useMemo(() => {
    if (isPlatformAdmin) return orgWorkspaces
    const allowedIds = new Set(userWorkspaceOptions.map((option) => option.workspaceId))
    return orgWorkspaces.filter((row) => allowedIds.has(row.id))
  }, [isPlatformAdmin, orgWorkspaces, userWorkspaceOptions])

  const accessibleWorkspaceKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const workspace of accessibleOrgWorkspaces) {
      const name = workspace.name?.trim()
      const key = workspace.workspace_key?.trim()
      if (name) keys.add(name)
      if (key) keys.add(key)
    }
    for (const option of userWorkspaceOptions) {
      const name = option.workspaceName?.trim()
      if (name) keys.add(name)
    }
    return keys
  }, [accessibleOrgWorkspaces, userWorkspaceOptions])

  /** Membership-scoped — same rule as Task & Work Management (admins see all). */
  const visibleWorkItems = useMemo(() => {
    if (isPlatformAdmin) return rawWorkItems
    if (userWorkspacesLoading) return []
    if (accessibleWorkspaceKeys.size === 0) return []
    return rawWorkItems.filter((item) => {
      const workspace = item.workspace?.trim()
      return Boolean(workspace && accessibleWorkspaceKeys.has(workspace))
    })
  }, [accessibleWorkspaceKeys, isPlatformAdmin, rawWorkItems, userWorkspacesLoading])

  const timelineModel = useMemo(
    () => mapWorkItemsToPlanningGantt(visibleWorkItems, accessibleOrgWorkspaces),
    [accessibleOrgWorkspaces, visibleWorkItems],
  )
  const timelineItems = Array.isArray(timelineModel.items) ? timelineModel.items : []
  const timelineWorkspaceOrder = Array.isArray(timelineModel.workspaceOrder)
    ? timelineModel.workspaceOrder
    : []
  const timelineLoading = workItemsLoading || userWorkspacesLoading

  useEffect(() => {
    if (timelineItems.length === 0) {
      setSelectedItemId('')
      return
    }
    setSelectedItemId((prev) => (timelineItems.some((item) => item.id === prev) ? prev : timelineItems[0].id))
  }, [timelineItems])

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

  const timelineDirectoryState = usePlanningTimelineDirectory(visibleTimelineItems, timelineWorkspaceOrder)

  /**
   * Demo/mock planning datasets stay off until real sprint/KPI APIs exist.
   * Do not re-enable them just because Timeline has work items (e.g. Monday sync).
   */
  const hasPlanningData = false

  const overviewScheduleHealth = scheduleHealth.map((item) => ({ ...item, value: 0 }))
  const overviewTimelineDistribution = timelineDistribution.map((item) => ({ ...item, value: 0 }))
  const overviewScheduleTrend = scheduleTrend.map((item) => ({ ...item, baseline: 0, actual: 0 }))
  const overviewMilestoneStatus = milestoneStatus.map((item) => ({ ...item, value: 0 }))
  const overviewSprintBurnup = sprintBurnup.map((item) => ({ ...item, ideal: 0, remaining: 0, completed: 0 }))
  const overviewDependencyNodes: DependencyNode[] = []
  const overviewDependencyEdges: DependencyEdge[] = []
  const overviewCapacityForecast: typeof capacityForecast = []
  const overviewScheduleVariance: typeof scheduleVariance = []
  const overviewAiInsights: typeof aiPlanningInsights = []
  const overviewCapacityRows: typeof capacityRows = []
  const overviewResourceAllocations: ResourceAllocationRecord[] = []
  const overviewBaselineRecords: BaselineRecord[] = []
  const overviewAlertFeed: AlertRecord[] = []

  const [sprintRows, setSprintRows] = useState<SprintPlanRow[]>([])
  const [createSprintOpen, setCreateSprintOpen] = useState(false)

  const selectedSprint = useMemo(
    () => sprintRows.find((row) => row.id === selectedItemId) ?? sprintRows[0] ?? null,
    [selectedItemId, sprintRows],
  )

  const sprintBoardSummaryCards = useMemo(() => {
    if (!selectedSprint) return []
    const remaining = Math.max(0, selectedSprint.totalItems - selectedSprint.doneItems)
    const buffer = Math.max(0, selectedSprint.capacity - selectedSprint.committed)
    return [
      { label: 'Committed', value: selectedSprint.workItems, tone: 'bg-slate-100 text-slate-700 border-slate-200' },
      { label: 'In Progress', value: remaining, tone: 'bg-sky-100 text-sky-700 border-sky-200' },
      { label: 'Done', value: selectedSprint.doneItems, tone: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      { label: 'Capacity buffer', value: buffer, tone: 'bg-amber-100 text-amber-700 border-amber-200' },
    ]
  }, [selectedSprint])

  const visibleDeadlines: DeadlineRecord[] = []
  const visibleCalendarEvents: CalendarEventRecord[] = []

  const kpiCards = useMemo(() => {
    const emptySeries = [0, 0, 0, 0, 0, 0, 0, 0]
    return [
      { id: 'plans', label: 'Total Active Plans', value: '0', subtext: 'No plans yet', trend: '0%', icon: Layers, trendColor: '#0ea5e9', trendSeries: emptySeries },
      { id: 'milestones', label: 'Upcoming Milestones', value: '0', subtext: 'No milestones scheduled', trend: '0', icon: Flag, trendColor: '#6366f1', trendSeries: emptySeries },
      { id: 'sprints', label: 'Active Sprints', value: '0', subtext: 'No active sprints', trend: '0', icon: CalendarRange, trendColor: '#10b981', trendSeries: emptySeries },
      { id: 'overdue', label: 'Overdue Items', value: '0', subtext: 'Nothing overdue', trend: '0', icon: AlertTriangle, trendColor: '#f59e0b', trendSeries: emptySeries },
      { id: 'sla', label: 'SLA at Risk', value: '0', subtext: 'No SLA risk', trend: '0', icon: ShieldAlert, trendColor: '#f97316', trendSeries: emptySeries },
      { id: 'variance', label: 'Plan vs Actual', value: '0%', subtext: 'No variance data', trend: '0%', icon: Activity, trendColor: '#06b6d4', trendSeries: emptySeries },
    ]
  }, [])

  const scheduleHealthScore = 0

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
        // Zoom now lives inside each timeline's full-screen Gantt overlay — the directory list
        // itself shows the same toolbar as the Workflow & Automation Directory Panel instead.
        return <PlanningTimelineDirectoryToolbar state={timelineDirectoryState} />
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
        return (
          <Badge className="border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700">
            {hasPlanningData ? '92.4% compliance' : '0% compliance'}
          </Badge>
        )
      case 'resource':
        return (
          <Badge className="border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
            {hasPlanningData ? '2 conflicts open' : '0 conflicts open'}
          </Badge>
        )
      case 'baseline':
        return (
          <Badge className="border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">
            {hasPlanningData ? 'Variance controls active' : 'No baselines yet'}
          </Badge>
        )
      case 'insight':
        return (
          <Badge className="border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700">
            {hasPlanningData ? 'AI-assisted' : 'No insights yet'}
          </Badge>
        )
      default:
        return null
    }
  }, [activePanel, calendarMode, capacityView, hasPlanningData, timelineDirectoryState])

  return (
    <div className="min-h-0 space-y-6 pb-0">
      <div className={cn('space-y-6', workspaceDockedContentInsetClass(navDocked, isWorkspaceCollapsed, enterpriseNavLayoutVariant))}>
        <Breadcrumb items={[{ label: 'Planning & Scheduling' }]} />
        <PageHeader
          title="Planning & Scheduling"
          description="Manage timelines, sprints, calendars, capacity, deadlines, and delivery schedules"
          right={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex shrink-0 flex-nowrap items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-1.5 shadow-sm">
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
                  <LayoutGrid className="h-5 w-5" />
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
                  <PanelLeft className="h-5 w-5" />
                </button>
                <button type="button" className="flex items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-all duration-200 hover:bg-background hover:text-foreground hover:shadow-sm" aria-label="Export plan" title="Export plan">
                  <Download className="h-5 w-5" />
                </button>
              </div>
            </div>
          }
        />

        {showKpiCards ? (
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
                              onClick={() => setPlanningPanel(panel.id)}
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
                          {hasPlanningData
                            ? 'Balanced delivery sequencing with dependency pressure that still needs active intervention.'
                            : 'No schedule data yet. Create work items to start tracking schedule health.'}
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
            // Outer wrapper already applies workspaceDockedContentInsetClass — pass docked=false
            // to avoid double left padding that narrows Planning Overview when Fixed Sidebar is off.
            workspaceMainColumnClass(false, isWorkspaceCollapsed, enterpriseNavLayoutVariant),
            sidebarFixed && 'flex min-h-0 min-w-0 flex-col'
          )}
        >
          {!isOverviewSectionActive && showFiltersPanel ? (
            <Card
              ref={mainPanelFiltersRef}
              className={cn(
                'liquid-glass-enterprise-panel mb-0 shrink-0 space-y-3 rounded-2xl p-4',
                'border border-white/40 dark:border-white/10',
                'ring-1 ring-black/[0.04] dark:ring-white/[0.06]',
                'shadow-[0_16px_44px_rgba(15,23,42,0.10)] dark:shadow-[0_18px_52px_rgba(0,0,0,0.35)]',
                'bg-gradient-to-br from-white/70 via-background/75 to-slate-50/70 dark:from-slate-900/45 dark:via-background/40 dark:to-slate-950/20'
              )}
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => startTransition(() => setQuery(event.target.value))}
                  placeholder="Search project, sprint, milestone, assignee, or schedule item"
                  className="h-10 w-full pl-9"
                />
              </div>

              {activePanel === 'sprint' ? (
                <div className="relative pt-3">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent_0%,hsl(var(--border)/0.2)_18%,hsl(var(--border)/0.75)_50%,hsl(var(--border)/0.2)_82%,transparent_100%)]"
                  />
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setCreateSprintOpen(true)}
                      className={enterpriseCyanGradientActionButtonClass()}
                    >
                      <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.5} />
                      Create Sprint
                    </button>
                  </div>
                </div>
              ) : null}
            </Card>
          ) : null}

          <PlanningPanelSection
            id={`planning-panel-${activePanel}`}
            title={currentPlanningPanel.label}
            description={currentPlanningPanel.description}
            highlight={activePanel === 'overview'}
            headerIcon={<PlanningHeaderIcon className="h-5 w-5" />}
            right={planningMainHeaderRight}
            outerRef={activeMainPanelRef}
            style={workspaceMainPanelViewportHeightStyle(mainPanelViewportHeightPx)}
            className={cn(
              mainPanelViewportHeightPx != null && 'min-h-0 flex-1 overflow-hidden',
              sidebarFixed && mainPanelViewportHeightPx == null && 'min-h-0 flex-1'
            )}
            scrollBody={mainPanelViewportHeightPx != null && activePanel !== 'timeline'}
            bodyFill={activePanel === 'timeline' || activePanel === 'sprint'}
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
                  data={overviewScheduleHealth.map((item) => ({ name: item.label, value: item.value, pct: `${item.value}%` }))}
                  score={scheduleHealthScore}
                  predictability={hasPlanningData ? 92 : 0}
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
                    const t = overviewTimelineDistribution.reduce((sum, d) => sum + d.value, 0)
                    return overviewTimelineDistribution.map((d) => ({
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
                      <span className="text-slate-500">
                        Schedule Variance{' '}
                        <span className={cn('font-semibold', hasPlanningData ? 'text-rose-600' : 'text-slate-700')}>
                          {hasPlanningData ? '-8%' : '0%'}
                        </span>
                      </span>
                      <span className="text-slate-500">
                        Forecast{' '}
                        <span className={cn('font-semibold', hasPlanningData ? 'text-rose-600' : 'text-slate-700')}>
                          {hasPlanningData ? '-6 days' : '0 days'}
                        </span>
                      </span>
                    </div>
                    <OverviewLink>View Trend Analysis</OverviewLink>
                  </div>
                }
              >
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={overviewScheduleTrend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
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
                    Completion {hasPlanningData ? '43%' : '0%'}
                  </span>
                }
              >
                <IntelligenceDonut
                  centerLabel="Milestones"
                  unitLabel="milestones"
                  pieColors={overviewMilestoneStatus.map((m) => m.fill)}
                  data={(() => {
                    const t = overviewMilestoneStatus.reduce((sum, d) => sum + d.value, 0)
                    return overviewMilestoneStatus.map((d) => ({
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
                badge={<OverviewBadge tone="emerald">{hasPlanningData ? '92% Predictability' : '0% Predictability'}</OverviewBadge>}
                footer={
                  <div className="flex w-full items-center justify-between text-[11px] text-slate-500">
                    <span>Committed <span className="font-semibold text-slate-800">{hasPlanningData ? '86 SP' : '0 SP'}</span></span>
                    <span>Completed <span className="font-semibold text-slate-800">{hasPlanningData ? '76 SP' : '0 SP'}</span></span>
                    <OverviewLink>View Sprint Detail</OverviewLink>
                  </div>
                }
              >
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={overviewSprintBurnup} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
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
                badge={<OverviewBadge tone="rose">Risk Index {hasPlanningData ? '64' : '0'}</OverviewBadge>}
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
                  {overviewDependencyNodes.length === 0 ? (
                    <div className="flex h-full items-center justify-center px-4 text-center text-xs text-slate-400">
                      No dependency map yet. Link work items to surface risk.
                    </div>
                  ) : (
                    <>
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                        {overviewDependencyEdges.map((edge) => {
                          const from = overviewDependencyNodes.find((n) => n.id === edge.from)!
                          const to = overviewDependencyNodes.find((n) => n.id === edge.to)!
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
                      {overviewDependencyNodes.map((node) => {
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
                    </>
                  )}
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
                    <span>Capacity Utilization <span className="font-semibold text-slate-800">{hasPlanningData ? '93%' : '0%'}</span></span>
                    <OverviewLink>View Capacity Plan</OverviewLink>
                  </div>
                }
              >
                {overviewCapacityForecast.length === 0 ? (
                  <div className="flex h-[180px] items-center justify-center text-xs text-slate-400">
                    No capacity forecast yet.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-[88px_repeat(3,minmax(0,1fr))] gap-1.5 text-[10px]">
                      <span className="" />
                      {capacityForecastColumns.map((col) => (
                        <span key={col} className="text-center font-semibold uppercase tracking-[0.08em] text-slate-500">{col.replace(' ', '\n')}</span>
                      ))}
                      {overviewCapacityForecast.map((row) => (
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
                  </>
                )}
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
                  {overviewScheduleVariance.length === 0 ? (
                    <div className="flex h-[180px] items-center justify-center text-xs text-slate-400">
                      No schedule variance yet.
                    </div>
                  ) : (
                    overviewScheduleVariance.map((row) => {
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
                    })
                  )}
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
                  <OverviewBadge tone="indigo">{hasPlanningData ? '92% Confidence' : '0% Confidence'}</OverviewBadge>
                </div>
                <ul className="relative mt-3 flex-1 space-y-2">
                  {overviewAiInsights.length === 0 ? (
                    <li className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-2.5 py-4 text-center text-[11px] leading-snug text-slate-400">
                      No AI planning insights yet. Add work items to generate recommendations.
                    </li>
                  ) : (
                    overviewAiInsights.map((insight) => {
                      const Icon = insight.icon
                      return (
                        <li key={insight.text} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-white/70 px-2.5 py-2 text-[11px] leading-snug text-slate-600">
                          <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
                          <span>{insight.text}</span>
                        </li>
                      )
                    })
                  )}
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
                <PlanningTimelineDirectoryTable state={timelineDirectoryState} />
              )}
            </div>
          ) : null}

          {activePanel === 'sprint' ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              {sprintRows.length === 0 ? (
                <SprintPlanningEmptyState onOpenTimeline={() => setActivePanel('timeline')} />
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" className="h-9 rounded-xl px-3 text-xs" disabled>
                      <Layers className="mr-1.5 h-3.5 w-3.5" />
                      Add Work Items
                    </Button>
                    <Button
                      variant="outline"
                      className="h-9 rounded-xl px-3 text-xs"
                      disabled={!selectedSprint || selectedSprint.status === 'Not Planned'}
                      onClick={() => {
                        if (!selectedSprint) return
                        setSprintRows((rows) =>
                          rows.map((row) =>
                            row.id === selectedSprint.id
                              ? { ...row, status: 'Not Planned', health: 'Not Planned', healthNote: 'Closed', progress: 100 }
                              : row,
                          ),
                        )
                      }}
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Close Sprint
                    </Button>
                  </div>

                  <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
                    <SprintPlanningTable
                      rows={sprintRows}
                      selectedId={selectedSprint?.id ?? ''}
                      onSelect={setSelectedItemId}
                    />
                    <SprintSelectedDetail sprint={selectedSprint} />
                  </div>

                  {sprintBoardSummaryCards.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                      {sprintBoardSummaryCards.map((column) => (
                        <div key={column.label} className={cn('rounded-2xl border px-3 py-3', column.tone)}>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em]">{column.label}</div>
                          <div className="mt-2 text-2xl font-semibold tabular-nums">{column.value}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              )}

              {createSprintOpen ? (
                <CreateSprintDialog
                  ownerName={session?.user.name?.trim() || 'Unassigned'}
                  onClose={() => setCreateSprintOpen(false)}
                  onCreate={(row) => {
                    setSprintRows((rows) => [...rows, row])
                    setSelectedItemId(row.id)
                    setCreateSprintOpen(false)
                  }}
                />
              ) : null}
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
                {visibleCalendarEvents.length === 0 ? (
                  <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center text-sm text-slate-400">
                    No calendar events yet.
                  </div>
                ) : (
                  visibleCalendarEvents.map((event) => (
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
                  ))
                )}
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
                {overviewCapacityRows.length === 0 ? (
                  <div className="px-6 py-12 text-center text-sm text-slate-400">No capacity rows yet.</div>
                ) : (
                  <>
                    <div className="grid grid-cols-[160px_repeat(5,minmax(0,1fr))] gap-2 border-b border-slate-200/70 bg-slate-50/90 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      <span>{capacityView}</span>
                      {capacityPeriods.map((period) => <span key={period} className="text-center">{period}</span>)}
                    </div>
                    <div className="space-y-2 px-3 py-3">
                      {overviewCapacityRows.map((row) => (
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
                  </>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {(hasPlanningData
                  ? [
                      ['Available Capacity', '1,740 h'],
                      ['Planned Load', '1,612 h'],
                      ['Overallocated', '5 resources'],
                      ['Unused Capacity', '128 h'],
                    ]
                  : [
                      ['Available Capacity', '0 h'],
                      ['Planned Load', '0 h'],
                      ['Overallocated', '0 resources'],
                      ['Unused Capacity', '0 h'],
                    ]
                ).map(([label, value]) => (
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
                {visibleDeadlines.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center text-sm text-slate-400">
                    No deadlines or SLA items yet.
                  </div>
                ) : (
                  visibleDeadlines.map((item) => (
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
                  ))
                )}
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
                {overviewResourceAllocations.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center text-sm text-slate-400">
                    No resource allocations yet.
                  </div>
                ) : (
                  overviewResourceAllocations.map((row) => (
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
                  ))
                )}
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
                {overviewBaselineRecords.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center text-sm text-slate-400">
                    No baseline records yet.
                  </div>
                ) : (
                  overviewBaselineRecords.map((item) => (
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
                  ))
                )}
              </div>
            </div>
          ) : null}

          {activePanel === 'insight' ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {overviewAlertFeed.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center text-sm text-slate-400">
                  No planning alerts yet.
                </div>
              ) : (
                overviewAlertFeed.map((alert) => (
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
                ))
              )}
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

function formatSprintDateRange(startIso: string, endIso: string): string {
  const format = (value: string) => {
    const [y, m, d] = value.split('-').map(Number)
    const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
  }
  return `${format(startIso)} – ${format(endIso)}`
}

function daysUntil(startIso: string): number {
  const [y, m, d] = startIso.split('-').map(Number)
  const start = Date.UTC(y, (m ?? 1) - 1, d ?? 1)
  const today = new Date()
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return Math.round((start - now) / 86_400_000)
}

function SprintPlanningEmptyState({ onOpenTimeline }: { onOpenTimeline: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-muted/40 text-muted-foreground shadow-sm">
        <Layers className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">No sprints yet</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
        Use <span className="font-medium text-foreground">Create Sprint</span> in Search and Filters to start balancing commitment and capacity.
      </p>
      <div className="mt-5">
        <button type="button" className={cn(enterpriseSecondaryButtonClass(), 'h-10 rounded-xl px-4 text-sm')} onClick={onOpenTimeline}>
          <CalendarRange className="mr-1.5 h-4 w-4" />
          Open Timeline
        </button>
      </div>
    </div>
  )
}

function SprintSelectedDetail({ sprint }: { sprint: SprintPlanRow | null }) {
  if (!sprint) return null
  const buffer = sprint.capacity - sprint.committed
  return (
    <div className="flex min-h-0 flex-col rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Selected sprint</p>
          <h3 className="mt-1 truncate text-sm font-semibold text-slate-950">{sprint.name}</h3>
          <p className="mt-0.5 truncate text-xs text-slate-500">{sprint.subtitle || 'Unassigned project'}</p>
        </div>
        <Badge className={cn('shrink-0 border px-2 py-0.5 text-[10px] font-semibold', sprintStatusBadgeTone(sprint.status))}>
          {sprint.status}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Window</div>
          <div className="mt-1 font-medium text-slate-800">{sprint.dateRange}</div>
          <div className="mt-0.5 text-slate-500">{sprint.timing}</div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Capacity</div>
          <div className="mt-1 font-medium text-slate-800">{sprint.committed} / {sprint.capacity} pts</div>
          <div className={cn('mt-0.5 font-medium', buffer <= 0 ? 'text-rose-600' : 'text-emerald-600')}>
            {buffer >= 0 ? `+${buffer}` : buffer} buffer
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
          <span>Progress</span>
          <span className="font-semibold text-slate-700">{sprint.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500" style={{ width: `${sprint.progress}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">
          {sprint.doneItems} / {sprint.totalItems} work items done · {sprint.workItems} committed
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
        <SprintOwnerAvatar name={sprint.ownerName} />
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-slate-700">{sprint.ownerName || 'Unassigned'}</div>
          <div className="truncate text-[11px] text-slate-400">{sprint.ownerRole || 'Owner'}</div>
        </div>
      </div>

      <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-3 text-[11px] leading-relaxed text-slate-500">
        Work items for this sprint will appear here once they are linked from Timeline or Task & Work Management.
      </p>
    </div>
  )
}

function CreateSprintDialog({
  ownerName,
  onClose,
  onCreate,
}: {
  ownerName: string
  onClose: () => void
  onCreate: (row: SprintPlanRow) => void
}) {
  const today = new Date()
  const startDefault = today.toISOString().slice(0, 10)
  const endDate = new Date(today)
  endDate.setUTCDate(endDate.getUTCDate() + 13)
  const endDefault = endDate.toISOString().slice(0, 10)

  const [name, setName] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [startDate, setStartDate] = useState(startDefault)
  const [endDateValue, setEndDateValue] = useState(endDefault)
  const [capacity, setCapacity] = useState('40')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed || !startDate || !endDateValue) return
    const capacityPts = Math.max(0, Number(capacity) || 0)
    const until = daysUntil(startDate)
    const timing =
      until <= 0 ? 'Starts today' : until === 1 ? 'Starts in 1 day' : `Starts in ${until} days`
    onCreate({
      id: `sprint-${Date.now()}`,
      name: trimmed,
      subtitle: subtitle.trim() || 'Unassigned project',
      status: 'Upcoming',
      dateRange: formatSprintDateRange(startDate, endDateValue),
      timing,
      timingTone: 'starts',
      capacity: capacityPts,
      committed: 0,
      utilization: 0,
      workItems: 0,
      highItems: 0,
      progress: 0,
      doneItems: 0,
      totalItems: 0,
      health: 'Planned',
      healthNote: 'Ready',
      ownerName,
      ownerRole: 'Sprint Owner',
      accent: 'bg-sky-500',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-sprint-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="create-sprint-title" className="text-base font-semibold text-slate-950">
              Create Sprint
            </h3>
            <p className="mt-1 text-xs text-slate-500">Set a delivery window and capacity for the next commitment cycle.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500" htmlFor="sprint-name">
              Sprint name
            </label>
            <Input id="sprint-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sprint 1" className="mt-1.5 h-10 rounded-xl" autoFocus />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500" htmlFor="sprint-project">
              Project / focus
            </label>
            <Input id="sprint-project" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Optional" className="mt-1.5 h-10 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500" htmlFor="sprint-start">
                Start
              </label>
              <Input id="sprint-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1.5 h-10 rounded-xl" />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500" htmlFor="sprint-end">
                End
              </label>
              <Input id="sprint-end" type="date" value={endDateValue} onChange={(e) => setEndDateValue(e.target.value)} className="mt-1.5 h-10 rounded-xl" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500" htmlFor="sprint-capacity">
              Capacity (pts)
            </label>
            <Input id="sprint-capacity" type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} className="mt-1.5 h-10 rounded-xl" />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={cn(enterpriseSecondaryButtonClass(), 'h-9 rounded-xl px-3 text-xs')} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={cn(enterpriseCyanGradientActionButtonClass(), 'h-9 rounded-xl px-3.5 text-xs', !name.trim() && 'pointer-events-none opacity-50')}
            onClick={submit}
            disabled={!name.trim()}
          >
            <Plus className="h-3.5 w-3.5" />
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

/** Sprint Planning table — column-rich roster view (status, capacity, utilization, progress, health, owner). */
function SprintPlanningTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: SprintPlanRow[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const headClass = 'whitespace-nowrap px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400'
  return (
    <div className="min-h-0 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm [scrollbar-width:thin]">
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
          {rows.map((row) => {
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

