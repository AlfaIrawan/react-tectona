import { startTransition, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Download,
  FileBarChart2,
  Filter,
  Gauge,
  LayoutTemplate,
  LineChart as LineChartIcon,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart as PieChartIcon,
  Plus,
  Search,
  Settings2,
  Share2,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  TableProperties,
  Target,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectItem } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  isWorkspaceNavDocked,
  workspaceAsideClass,
  workspaceDockedContentInsetClass,
  workspaceMainColumnClass,
  workspaceNavInnerClass,
  workspaceNavMenuScrollClass,
  workspaceOuterGridClass,
} from '@/lib/workspaceNavLayout'
import { usePreferencesStore } from '@/stores/preferences-store'

type DashboardMetric = {
  label: string
  value: string
  delta: string
  trend: 'up' | 'down' | 'neutral'
  tone: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose'
  icon: ComponentType<{ className?: string }>
  detail: DrawerPayload
}

type DrawerPayload = {
  title: string
  subtitle: string
  status: string
  source: string
  filters: string[]
  preview: string[]
  schedule: string
  sharing: string
  actions: string[]
}

type ReportCatalogItem = {
  id: string
  name: string
  type: string
  owner: string
  lastUpdated: string
  schedule: string
  accessScope: string
  favorite: boolean
  workspace: string
  project: string
  metric: string
  reportType: string
  healthStatus: string
  slaStatus: string
  visualization: string
  drawer: DrawerPayload
}

type VizOption = 'Table' | 'Bar chart' | 'Line chart' | 'Donut chart' | 'KPI cards'

const reportingOverviewMetrics: DashboardMetric[] = [
  {
    label: 'Total Reports',
    value: '186',
    delta: '+14 this month',
    trend: 'up',
    tone: 'slate',
    icon: FileBarChart2,
    detail: {
      title: 'Total Reports',
      subtitle: 'Cross-portfolio reporting inventory and ownership coverage.',
      status: 'Healthy adoption',
      source: 'Reporting catalog, PMO templates, executive dashboards',
      filters: ['Last 90 days', 'All workspaces', 'All report types'],
      preview: ['72 executive reports', '58 operational reports', '56 custom analytics views'],
      schedule: '51 reports on weekly cadence; 24 monthly board snapshots',
      sharing: 'Shared with PMO, CIO office, delivery leadership',
      actions: ['Create Report', 'Export Dashboard', 'Share Report'],
    },
  },
  {
    label: 'Active Dashboards',
    value: '24',
    delta: '3 layouts updated today',
    trend: 'up',
    tone: 'blue',
    icon: LayoutTemplate,
    detail: {
      title: 'Active Dashboards',
      subtitle: 'Saved dashboard layouts for leadership, PMO, and delivery operations.',
      status: 'Stable',
      source: 'Dashboard builder and shared view registry',
      filters: ['Current month', 'Enterprise PMO', 'Pinned dashboards'],
      preview: ['Executive Monthly Pulse', 'PMO Delivery Control', 'Agile Throughput Command'],
      schedule: 'Auto-refresh every 15 minutes',
      sharing: '12 shared links; 8 leadership groups subscribed',
      actions: ['Open Executive View', 'Share with Leadership', 'Manage Layout'],
    },
  },
  {
    label: 'Projects Tracked',
    value: '142',
    delta: '11 new projects onboarded',
    trend: 'up',
    tone: 'emerald',
    icon: Target,
    detail: {
      title: 'Projects Tracked',
      subtitle: 'Projects contributing delivery, health, and SLA telemetry into analytics.',
      status: 'Coverage expanding',
      source: 'Project registry, sprint boards, milestone plans, SLA trackers',
      filters: ['Active projects', 'All portfolios', 'Operational + executive rollups'],
      preview: ['91 active delivery projects', '28 programs', '23 strategic initiatives'],
      schedule: 'Nightly aggregation with intra-day refresh for critical workstreams',
      sharing: 'Visible to PMO, delivery leads, and workspace owners',
      actions: ['Open Project', 'View Source Data', 'Compare Projects'],
    },
  },
  {
    label: 'At-Risk Projects',
    value: '17',
    delta: '4 require intervention',
    trend: 'down',
    tone: 'amber',
    icon: AlertTriangle,
    detail: {
      title: 'At-Risk Projects',
      subtitle: 'Projects trending below delivery thresholds for schedule, scope, or resourcing.',
      status: 'Escalation watch',
      source: 'Project health model, stage-gate outcomes, dependency alerts',
      filters: ['At Risk', 'All teams', 'This quarter'],
      preview: ['8 schedule risk', '5 scope drift', '4 resource constraints'],
      schedule: 'Escalation digest every weekday at 08:00',
      sharing: 'Leadership and PMO alert routing enabled',
      actions: ['Drill into Project', 'Review Score Logic', 'Share Report'],
    },
  },
  {
    label: 'SLA Breaches',
    value: '06',
    delta: '-2 vs last period',
    trend: 'up',
    tone: 'rose',
    icon: ShieldAlert,
    detail: {
      title: 'SLA Breaches',
      subtitle: 'Work items that crossed the committed delivery or governance SLA threshold.',
      status: 'Needs containment',
      source: 'Milestone commitments, governance response SLAs, exception tracker',
      filters: ['SLA status: breached', 'Program + project scope', 'Current month'],
      preview: ['2 approval turnaround misses', '3 milestone breaches', '1 governance evidence breach'],
      schedule: 'Hourly monitoring for critical commitments',
      sharing: 'Automatic notifications to owners and PMO operations',
      actions: ['Review Breaches', 'Export SLA Report', 'Open Linked Work Items'],
    },
  },
  {
    label: 'Avg Delivery Health Score',
    value: '82.4',
    delta: '+3.1 points',
    trend: 'up',
    tone: 'blue',
    icon: Gauge,
    detail: {
      title: 'Average Delivery Health Score',
      subtitle: 'Weighted score across schedule, scope, resource, risk, and governance signals.',
      status: 'Improving',
      source: 'Health scoring model v3.4',
      filters: ['Portfolio rollup', 'Current quarter', 'Weighted by project criticality'],
      preview: ['Schedule 79', 'Scope 85', 'Resources 76', 'Governance 88'],
      schedule: 'Calculated after each data refresh cycle',
      sharing: 'Included in executive scorecards and monthly pack',
      actions: ['Review Score Logic', 'Compare Projects', 'Export Snapshot'],
    },
  },
]

const distributionByType = [
  { name: 'Executive', value: 32, color: '#0f172a' },
  { name: 'Operational', value: 28, color: '#2563eb' },
  { name: 'Agile', value: 14, color: '#0f766e' },
  { name: 'SLA', value: 12, color: '#c2410c' },
  { name: 'Resource', value: 14, color: '#7c3aed' },
]

const analyticsHealth = [
  { label: 'Data freshness', value: '98.7%', tone: 'bg-emerald-500' },
  { label: 'Dashboard latency', value: '1.4s', tone: 'bg-blue-500' },
  { label: 'Scheduled success', value: '96.2%', tone: 'bg-indigo-500' },
]

const executiveKpis = [
  { label: 'Portfolio performance', value: '87%', note: '4 portfolios above target' },
  { label: 'Delivery status', value: '121 on track', note: '17 at risk, 4 delayed' },
  { label: 'Strategic KPI', value: '91% target hit rate', note: 'Benefits above plan in 3 programs' },
  { label: 'Benefit realization', value: '$18.6M', note: '92% of quarterly target achieved' },
]

const executiveTrend = [
  { name: 'Jan', portfolio: 72, health: 68, benefits: 56 },
  { name: 'Feb', portfolio: 75, health: 71, benefits: 60 },
  { name: 'Mar', portfolio: 77, health: 74, benefits: 66 },
  { name: 'Apr', portfolio: 81, health: 78, benefits: 72 },
  { name: 'May', portfolio: 84, health: 80, benefits: 75 },
  { name: 'Jun', portfolio: 87, health: 82, benefits: 79 },
]

const riskSummary = [
  { label: 'Critical risk', value: 4 },
  { label: 'Material risk', value: 9 },
  { label: 'Watchlist', value: 12 },
]

const operationalMetrics = [
  { label: 'Task progress', value: '74%', note: '8,482 of 11,456 tasks completed' },
  { label: 'Sprint progress', value: '68%', note: '3 active sprints within tolerance' },
  { label: 'Team throughput', value: '184 pts', note: '+11% over rolling baseline' },
  { label: 'Blocked items', value: '29', note: '5 new blockers in integration stream' },
  { label: 'Open issues', value: '43', note: '12 high severity, 3 escalated' },
  { label: 'Milestone status', value: '26 due soon', note: '19 green, 5 amber, 2 red' },
]

const operationalTrend = [
  { name: 'Sprint 21', throughput: 156, blocked: 18, issues: 36 },
  { name: 'Sprint 22', throughput: 162, blocked: 15, issues: 34 },
  { name: 'Sprint 23', throughput: 171, blocked: 21, issues: 38 },
  { name: 'Sprint 24', throughput: 176, blocked: 17, issues: 31 },
  { name: 'Sprint 25', throughput: 184, blocked: 29, issues: 43 },
]

const projectHealthRadar = [
  { subject: 'Overall', value: 82 },
  { subject: 'Schedule', value: 79 },
  { subject: 'Scope', value: 84 },
  { subject: 'Resources', value: 76 },
  { subject: 'Risk', value: 73 },
  { subject: 'Governance', value: 88 },
]

const healthDistribution = [
  { name: 'Healthy', value: 58, color: '#0f766e' },
  { name: 'Watch', value: 41, color: '#d97706' },
  { name: 'At Risk', value: 17, color: '#dc2626' },
  { name: 'Delayed', value: 8, color: '#7f1d1d' },
]

const burndownSeries = [
  { name: 'Day 1', committed: 120, completed: 6 },
  { name: 'Day 3', committed: 106, completed: 18 },
  { name: 'Day 5', committed: 92, completed: 34 },
  { name: 'Day 7', committed: 76, completed: 52 },
  { name: 'Day 9', committed: 54, completed: 77 },
  { name: 'Day 10', committed: 42, completed: 88 },
]

const velocitySeries = [
  { name: 'S20', committed: 144, completed: 136, spillover: 8 },
  { name: 'S21', committed: 152, completed: 148, spillover: 4 },
  { name: 'S22', committed: 160, completed: 150, spillover: 10 },
  { name: 'S23', committed: 166, completed: 162, spillover: 4 },
  { name: 'S24', committed: 171, completed: 168, spillover: 3 },
]

const utilizationByTeam = [
  { team: 'Delivery Alpha', utilization: 92, capacity: 100 },
  { team: 'Platform PMO', utilization: 81, capacity: 100 },
  { team: 'Change Enablement', utilization: 73, capacity: 100 },
  { team: 'Governance Office', utilization: 88, capacity: 100 },
  { team: 'QA Services', utilization: 67, capacity: 100 },
]

const utilizationByRole = [
  { role: 'Project Managers', utilization: 86 },
  { role: 'Delivery Leads', utilization: 93 },
  { role: 'Business Analysts', utilization: 79 },
  { role: 'Scrum Masters', utilization: 76 },
  { role: 'PMO Analysts', utilization: 82 },
]

const utilizationAlerts = [
  { label: 'Overutilized', value: '14 resources', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  { label: 'Underutilized', value: '9 resources', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  { label: 'Bench capacity', value: '112 hours', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
]

const slaSeries = [
  { name: 'Jan', compliance: 94, breaches: 8, response: 31 },
  { name: 'Feb', compliance: 95, breaches: 7, response: 28 },
  { name: 'Mar', compliance: 96, breaches: 5, response: 24 },
  { name: 'Apr', compliance: 97, breaches: 4, response: 21 },
  { name: 'May', compliance: 96, breaches: 6, response: 23 },
  { name: 'Jun', compliance: 97, breaches: 6, response: 20 },
]

const targetPerformance = [
  { label: 'SLA compliance', actual: 97, target: 98 },
  { label: 'Milestone adherence', actual: 91, target: 93 },
  { label: 'Risk closure', actual: 88, target: 90 },
  { label: 'Exec reporting accuracy', actual: 99, target: 99 },
]

const trendAnalysis = [
  { name: 'Jan', delivery: 68, health: 70, throughput: 145, issues: 52, sla: 94, resource: 81 },
  { name: 'Feb', delivery: 71, health: 72, throughput: 151, issues: 49, sla: 95, resource: 82 },
  { name: 'Mar', delivery: 75, health: 74, throughput: 158, issues: 44, sla: 96, resource: 84 },
  { name: 'Apr', delivery: 79, health: 78, throughput: 166, issues: 40, sla: 97, resource: 83 },
  { name: 'May', delivery: 82, health: 80, throughput: 178, issues: 37, sla: 96, resource: 85 },
  { name: 'Jun', delivery: 85, health: 82, throughput: 184, issues: 35, sla: 97, resource: 86 },
]

const exportHistory = [
  { name: 'Executive Monthly Pulse', format: 'PDF', recipient: 'Leadership Pack', sentAt: '16 Apr 2026, 07:30' },
  { name: 'PMO Delivery Control', format: 'Excel', recipient: 'PMO Weekly Review', sentAt: '15 Apr 2026, 18:10' },
  { name: 'Resource Utilization Snapshot', format: 'CSV', recipient: 'Operations Analysis', sentAt: '15 Apr 2026, 11:42' },
]

const reportCatalog: ReportCatalogItem[] = [
  {
    id: 'rep-001',
    name: 'Executive Monthly Pulse',
    type: 'Executive dashboard',
    owner: 'Ayla Brooks',
    lastUpdated: '16 Apr 2026, 09:12',
    schedule: 'Monthly board pack',
    accessScope: 'Leadership',
    favorite: true,
    workspace: 'Enterprise PMO',
    project: 'Portfolio rollup',
    metric: 'Delivery health',
    reportType: 'Executive',
    healthStatus: 'Healthy',
    slaStatus: 'On track',
    visualization: 'KPI + trend',
    drawer: {
      title: 'Executive Monthly Pulse',
      subtitle: 'Leadership rollup for portfolio performance, benefits, and risk.',
      status: 'Last run succeeded',
      source: 'Portfolio scorecards, milestone rollups, SLA services, risk register',
      filters: ['Current month', 'All portfolios', 'Leadership access'],
      preview: ['Portfolio performance 87%', 'Benefit realization $18.6M', '17 at-risk projects'],
      schedule: 'Runs automatically on the first business day of each month',
      sharing: 'Shared with CIO, PMO Director, steering committee',
      actions: ['Run Again', 'Edit Report', 'Export', 'Share', 'Pin to Dashboard'],
    },
  },
  {
    id: 'rep-002',
    name: 'PMO Delivery Control',
    type: 'Operational dashboard',
    owner: 'Nadia Singh',
    lastUpdated: '16 Apr 2026, 08:48',
    schedule: 'Weekly',
    accessScope: 'PMO + delivery leads',
    favorite: true,
    workspace: 'Enterprise PMO',
    project: 'Cross-program delivery',
    metric: 'Blocked items',
    reportType: 'Operational',
    healthStatus: 'Watch',
    slaStatus: 'Approaching breach',
    visualization: 'Bar + table',
    drawer: {
      title: 'PMO Delivery Control',
      subtitle: 'Operational control room for delivery cadence, blockers, and milestone drift.',
      status: 'Refresh due in 8 minutes',
      source: 'Task boards, sprint metrics, issue tracker, milestone baseline',
      filters: ['Current sprint window', 'All teams', 'Operational dashboards'],
      preview: ['29 blocked items', '43 open issues', '26 milestones due soon'],
      schedule: 'Every Monday 08:00 and on-demand',
      sharing: 'PMO, delivery managers, program leads',
      actions: ['Drill Down', 'Open Project', 'View Source Data', 'Share'],
    },
  },
  {
    id: 'rep-003',
    name: 'Health Score Portfolio Matrix',
    type: 'Health scoring',
    owner: 'Mina Alvarez',
    lastUpdated: '16 Apr 2026, 08:24',
    schedule: 'Daily',
    accessScope: 'Portfolio office',
    favorite: false,
    workspace: 'Technology Strategy',
    project: 'Platform rationalization',
    metric: 'Health score',
    reportType: 'Health',
    healthStatus: 'At Risk',
    slaStatus: 'On track',
    visualization: 'Radar + donut',
    drawer: {
      title: 'Health Score Portfolio Matrix',
      subtitle: 'Weighted health analytics across schedule, scope, resources, risk, and governance.',
      status: 'Risk concentration elevated',
      source: 'Health scoring model, stage-gate audits, project telemetry',
      filters: ['All portfolios', 'Weighted scoring', 'Daily refresh'],
      preview: ['Governance strongest at 88', 'Resource health lowest at 76', '17 projects at risk'],
      schedule: 'Daily 06:30 refresh with exception alerts',
      sharing: 'Portfolio office and assurance council',
      actions: ['Review Score Logic', 'Compare Projects', 'Export Snapshot'],
    },
  },
  {
    id: 'rep-004',
    name: 'Agile Delivery Pulse',
    type: 'Agile analytics',
    owner: 'Livia Hart',
    lastUpdated: '16 Apr 2026, 07:58',
    schedule: 'Per sprint',
    accessScope: 'Delivery teams',
    favorite: false,
    workspace: 'Digital Programs',
    project: 'Customer growth transformation',
    metric: 'Velocity',
    reportType: 'Agile',
    healthStatus: 'Healthy',
    slaStatus: 'On track',
    visualization: 'Burndown + line',
    drawer: {
      title: 'Agile Delivery Pulse',
      subtitle: 'Sprint burndown, velocity, commitment reliability, and spillover analysis.',
      status: 'Sprint 25 within tolerance',
      source: 'Sprint boards, delivery logs, completion telemetry',
      filters: ['Team Alpha', 'Last 5 sprints', 'Agile views'],
      preview: ['Velocity 184 points', 'Spillover 3 points', 'Average sprint delivery 96%'],
      schedule: 'Triggered at sprint close and daily during active sprint',
      sharing: 'Scrum leads and delivery managers',
      actions: ['Compare Sprints', 'View Team Analytics', 'Export Agile Metrics'],
    },
  },
  {
    id: 'rep-005',
    name: 'Resource Pressure Dashboard',
    type: 'Resource utilization',
    owner: 'Farah Putri',
    lastUpdated: '15 Apr 2026, 18:44',
    schedule: 'Twice daily',
    accessScope: 'Resource office',
    favorite: true,
    workspace: 'PMO Assurance',
    project: 'Shared capacity pool',
    metric: 'Utilization',
    reportType: 'Resource',
    healthStatus: 'Watch',
    slaStatus: 'On track',
    visualization: 'Heatmap + bars',
    drawer: {
      title: 'Resource Pressure Dashboard',
      subtitle: 'Allocation, capacity, and utilization pressure by team and role.',
      status: '14 resources above threshold',
      source: 'Resource plans, allocation sheets, utilization snapshots',
      filters: ['Current month', 'All roles', 'Capacity threshold > 85%'],
      preview: ['Delivery leads at 93%', '112 bench hours', '9 underutilized resources'],
      schedule: '06:00 and 14:00 daily',
      sharing: 'Resource office, PMO, delivery leads',
      actions: ['Drill Down by Team', 'Compare Periods', 'Export Utilization Report'],
    },
  },
  {
    id: 'rep-006',
    name: 'SLA Compliance Board',
    type: 'SLA reporting',
    owner: 'Jonas Reed',
    lastUpdated: '15 Apr 2026, 17:31',
    schedule: 'Daily',
    accessScope: 'Operations',
    favorite: false,
    workspace: 'Operations Control',
    project: 'Cross-program SLA',
    metric: 'Compliance',
    reportType: 'SLA',
    healthStatus: 'Healthy',
    slaStatus: 'Compliant',
    visualization: 'Line + KPI',
    drawer: {
      title: 'SLA Compliance Board',
      subtitle: 'Deadline and service-level compliance with breach and response-time trend analytics.',
      status: '97% compliance',
      source: 'Milestone due dates, governance SLA, exception logs',
      filters: ['Current quarter', 'Enterprise scope', 'Compliant + breached'],
      preview: ['6 missed SLA items', '4 approaching breaches', '20h average response time'],
      schedule: 'Daily 07:00 with breach watch alerts',
      sharing: 'Operations, PMO, governance coordinators',
      actions: ['Review Breaches', 'Export SLA Report', 'Open Linked Work Items'],
    },
  },
]

const presetFilters = ['Executive Monthly', 'PMO Weekly Review', 'Agile Command', 'SLA Breach Watch']
const vizOptions: VizOption[] = ['Table', 'Bar chart', 'Line chart', 'Donut chart', 'KPI cards']

type ReportingPanelId =
  | 'reporting-overview'
  | 'executive-dashboard'
  | 'operational-dashboard'
  | 'custom-report-builder'
  | 'project-health-scoring'
  | 'burndown-velocity'
  | 'resource-utilization'
  | 'sla-performance'
  | 'trend-performance'
  | 'export-sharing'
  | 'report-catalog'

type ReportingPanelItem = {
  id: ReportingPanelId
  label: string
  badge: string
  description: string
  icon: ComponentType<{ className?: string }>
}

const REPORTING_PANEL_GROUPS: Array<{ group: string; items: ReportingPanelItem[] }> = [
  {
    group: 'Command Center',
    items: [
      { id: 'reporting-overview', label: 'Reporting Overview', badge: 'KPI', description: 'Inventory, health, and distribution of analytics assets.', icon: BarChart3 },
      { id: 'executive-dashboard', label: 'Executive Dashboard', badge: 'Exec', description: 'Board-ready KPI snapshots and portfolio signal.', icon: LayoutTemplate },
      { id: 'operational-dashboard', label: 'Operational Dashboard', badge: 'Ops', description: 'Delivery operations views with throughput and blockers.', icon: TableProperties },
    ],
  },
  {
    group: 'Builder & Scoring',
    items: [
      { id: 'custom-report-builder', label: 'Custom Report Builder', badge: 'Build', description: 'Select visualization types, preview output, and presets.', icon: Sparkles },
      { id: 'project-health-scoring', label: 'Project Health Scoring', badge: 'Score', description: 'Weighted health score and radar distribution.', icon: Gauge },
    ],
  },
  {
    group: 'Analytics Streams',
    items: [
      { id: 'burndown-velocity', label: 'Burndown & Velocity Analytics', badge: 'Agile', description: 'Sprint burndown, velocity, and spillover trends.', icon: CalendarRange },
      { id: 'resource-utilization', label: 'Resource Utilization Reporting', badge: 'Res', description: 'Utilization, capacity pressure, and role breakdown.', icon: Users },
      { id: 'sla-performance', label: 'SLA & Performance Reporting', badge: 'SLA', description: 'Compliance, breach posture, and performance targets.', icon: ShieldAlert },
      { id: 'trend-performance', label: 'Trend & Performance Analysis', badge: 'Trend', description: 'Period-over-period cockpit across operational dimensions.', icon: TrendingUp },
    ],
  },
  {
    group: 'Distribution',
    items: [
      { id: 'export-sharing', label: 'Export & Sharing', badge: 'Share', description: 'Export formats, schedules, recipients, and access.', icon: Download },
      { id: 'report-catalog', label: 'Report Catalog', badge: 'List', description: 'Saved reports and dashboards with quick actions.', icon: FileBarChart2 },
    ],
  },
]

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-slate-200/80', className)} />
}

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  return <Badge className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', tone)}>{label}</Badge>
}

function TrendBadge({ value, trend }: { value: string; trend: 'up' | 'down' | 'neutral' }) {
  const Icon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Activity
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium',
        trend === 'up' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
        trend === 'down' && 'border-amber-200 bg-amber-50 text-amber-700',
        trend === 'neutral' && 'border-slate-200 bg-slate-50 text-slate-700'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {value}
    </span>
  )
}

function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string
  description: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn('overflow-hidden rounded-[24px] border liquid-glass-enterprise-panel', className)}>
      <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-white via-slate-50/80 to-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900">{title}</CardTitle>
            <CardDescription className="mt-1 text-xs leading-5 text-slate-500">{description}</CardDescription>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  )
}

export function ReportingAnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(false)
  const [activePanel, setActivePanel] = useState<ReportingPanelId>('reporting-overview')
  const [timePeriod, setTimePeriod] = useState('Last 30 days')
  const [workspace, setWorkspace] = useState('All workspaces')
  const [project, setProject] = useState('All projects')
  const [portfolio, setPortfolio] = useState('All portfolios')
  const [team, setTeam] = useState('All teams')
  const [reportType, setReportType] = useState('All report types')
  const [healthStatus, setHealthStatus] = useState('All health')
  const [slaStatus, setSlaStatus] = useState('All SLA')
  const [selectedPreset, setSelectedPreset] = useState('Executive Monthly')
  const [selectedViz, setSelectedViz] = useState<VizOption>('Bar chart')
  const [activeDrawer, setActiveDrawer] = useState<DrawerPayload | null>(reportCatalog[0].drawer)

  const sidebarFixed = usePreferencesStore((s) => s.preferences.sidebarFixed ?? false)
  const sidebarMini = usePreferencesStore((s) => s.preferences.sidebarMini ?? true)
  const navDocked = isWorkspaceNavDocked(sidebarFixed)
  const enterpriseNavTitlesOnly = usePreferencesStore((s) => s.preferences.enterpriseNavTitlesOnly ?? false)
  const enterpriseNavSimpleList = usePreferencesStore((s) => s.preferences.enterpriseNavSimpleList ?? false)
  const enterpriseNavCompact = enterpriseNavTitlesOnly || enterpriseNavSimpleList
  const fixedSidebarUiOn = !sidebarFixed
  const enterpriseNavUltra = fixedSidebarUiOn && sidebarMini && enterpriseNavTitlesOnly && enterpriseNavSimpleList
  const enterpriseNavWidthVariant = enterpriseNavUltra ? 'ultra' : enterpriseNavCompact ? 'compact' : 'default'

  const deferredSearch = useDeferredValue(searchTerm)

  const navPanelRef = useRef<HTMLDivElement | null>(null)
  const [navPanelHeightPx, setNavPanelHeightPx] = useState<number | null>(null)

  useLayoutEffect(() => {
    // Samakan clamp tinggi panel Enterprise Navigation (Fixed Sidebar TRUE / non-docked) dengan Document & Knowledge Management.
    if (navDocked) {
      setNavPanelHeightPx(null)
      return
    }

    const compute = () => {
      const el = navPanelRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const viewportH = window.innerHeight
      const stickyTopPx = 48
      const effectiveTop = Math.max(rect.top, stickyTopPx)
      const extraPadPx = 30
      const next = Math.max(
        240,
        Math.min(Math.floor(viewportH - stickyTopPx - extraPadPx), Math.floor(viewportH - effectiveTop - extraPadPx))
      )
      setNavPanelHeightPx(next)
    }

    compute()
    requestAnimationFrame(compute)
    const t = window.setTimeout(compute, 80)
    const onLoad = () => compute()
    window.addEventListener('load', onLoad, { once: true })
    const ro = new ResizeObserver(() => compute())
    if (navPanelRef.current) ro.observe(navPanelRef.current)
    window.addEventListener('resize', compute, { passive: true })
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('load', onLoad)
      window.clearTimeout(t)
      ro.disconnect()
    }
  }, [navDocked, activePanel, isWorkspaceCollapsed, loading, searchTerm, timePeriod, workspace, project, portfolio, team, reportType, healthStatus, slaStatus, selectedPreset])

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 850)
    return () => window.clearTimeout(timer)
  }, [])

  const filteredReports = reportCatalog.filter((report) => {
    const normalizedSearch = deferredSearch.trim().toLowerCase()
    const matchesSearch =
      normalizedSearch.length === 0 ||
      [report.name, report.project, report.metric, report.owner, report.workspace].some((value) =>
        value.toLowerCase().includes(normalizedSearch)
      )

    const matchesWorkspace = workspace === 'All workspaces' || report.workspace === workspace
    const matchesProject = project === 'All projects' || report.project === project
    const matchesPortfolio = portfolio === 'All portfolios' || report.project === portfolio
    const matchesTeam = team === 'All teams' || report.owner.includes(team) || report.accessScope.includes(team)
    const matchesType = reportType === 'All report types' || report.reportType === reportType
    const matchesHealth = healthStatus === 'All health' || report.healthStatus === healthStatus
    const matchesSla = slaStatus === 'All SLA' || report.slaStatus === slaStatus

    return (
      matchesSearch &&
      matchesWorkspace &&
      matchesProject &&
      matchesPortfolio &&
      matchesTeam &&
      matchesType &&
      matchesHealth &&
      matchesSla
    )
  })

  const builderPreview = {
    Table: ['Delivery health by portfolio', 'Columns: portfolio, health score, at-risk count, benefit value'],
    'Bar chart': ['Showing project count by health status', 'Grouped by portfolio and workspace'],
    'Line chart': ['Showing delivery trend over 6 periods', 'Variance vs previous period highlighted'],
    'Donut chart': ['Showing report distribution by business area', 'Hover for slice breakdown and variance'],
    'KPI cards': ['Showing executive KPI rollup cards', 'Snapshot of current period performance'],
  }[selectedViz]

  const openDrawer = (payload: DrawerPayload) => setActiveDrawer(payload)

  function switchPanel(panelId: ReportingPanelId) {
    setActivePanel(panelId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6 pb-8 text-slate-900">
      <div className={cn('space-y-6', workspaceDockedContentInsetClass(navDocked, isWorkspaceCollapsed, enterpriseNavWidthVariant))}>
        <Breadcrumb items={[{ label: 'Reporting & Analytics' }]} />
        <PageHeader
          title="Reporting & Analytics"
          description="Monitor performance, delivery health, resource usage, SLA compliance, and operational trends"
          right={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200/80 bg-white/75 p-1.5 shadow-sm backdrop-blur-sm">
                <Button size="lg" className="h-10 rounded-lg bg-slate-900 px-4 text-white shadow-sm hover:bg-slate-800">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Report
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-10 rounded-lg border-slate-200 bg-white/80 px-4 text-slate-700 shadow-sm hover:bg-white hover:text-slate-900"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Dashboard
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-10 rounded-lg border-slate-200 bg-white/80 px-4 text-slate-700 shadow-sm hover:bg-white hover:text-slate-900"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share Report
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-10 rounded-lg border-slate-200 bg-white/80 px-4 text-slate-700 shadow-sm hover:bg-white hover:text-slate-900"
                >
                  <Settings2 className="mr-2 h-4 w-4" />
                  Analytics Settings
                </Button>
              </div>
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {reportingOverviewMetrics.slice(0, 6).map((metric) => {
            const Icon = metric.icon
            return (
              <button key={metric.label} type="button" className="group text-left" onClick={() => openDrawer(metric.detail)}>
                <Card className="relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-white/95 shadow-[0_18px_48px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-[0_22px_56px_rgba(15,23,42,0.10)]">
                  <div className="pointer-events-none absolute -right-3 -bottom-4 opacity-[0.08] transition-all duration-500 group-hover:scale-110 group-hover:opacity-[0.12]">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/60 text-slate-700/80 ring-1 ring-white/50 backdrop-blur-sm">
                      <Icon className="h-7 w-7" />
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="text-xs text-slate-500">{metric.label}</div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <div className="shrink-0 text-2xl font-bold leading-none text-slate-950">{metric.value}</div>
                      <TrendBadge value={metric.delta} trend={metric.trend} />
                    </div>
                  </div>
                </Card>
              </button>
            )
          })}
        </div>
      </div>

      <div className={workspaceOuterGridClass(sidebarFixed, isWorkspaceCollapsed, enterpriseNavWidthVariant)}>
        <aside className={workspaceAsideClass(navDocked, isWorkspaceCollapsed, enterpriseNavWidthVariant)}>
          <div
            ref={navPanelRef}
            className={cn(workspaceNavInnerClass(navDocked, sidebarFixed, isWorkspaceCollapsed), !navDocked && 'overflow-hidden')}
            style={!navDocked && navPanelHeightPx ? { height: navPanelHeightPx, maxHeight: navPanelHeightPx } : undefined}
            aria-label="Reporting workspace navigation"
          >
            <div className="shrink-0">
              <div className="mb-3 flex items-center justify-between">
                {!isWorkspaceCollapsed ? (
                  <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Enterprise Navigation</span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-xl border border-slate-200/70 bg-white/75 text-slate-600 shadow-sm hover:bg-white hover:text-slate-900"
                  aria-label={isWorkspaceCollapsed ? 'Expand reporting workspace navigation' : 'Collapse reporting workspace navigation'}
                  title={isWorkspaceCollapsed ? 'Expand reporting workspace navigation' : 'Collapse reporting workspace navigation'}
                  onClick={() => setIsWorkspaceCollapsed((current) => !current)}
                >
                  {isWorkspaceCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                </Button>
              </div>

              {!isWorkspaceCollapsed && !enterpriseNavSimpleList ? (
                <div className="mb-4 overflow-hidden rounded-[24px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_38%),linear-gradient(160deg,rgba(15,23,42,0.96),rgba(30,41,59,0.94))] p-4 text-white shadow-[0_18px_44px_rgba(15,23,42,0.24)]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-100/80">Executive signal</div>
                  <div className="mt-2 text-base font-semibold leading-tight">Decision-ready visibility across delivery, governance, and outcomes</div>
                </div>
              ) : null}
            </div>

            <div className={workspaceNavMenuScrollClass()}>
              <div className={cn(enterpriseNavUltra ? 'space-y-1.5' : enterpriseNavCompact ? 'space-y-2' : 'space-y-4')}>
                {REPORTING_PANEL_GROUPS.map(({ group, items }) => (
                  <div key={group} className="space-y-1.5">
                    {!isWorkspaceCollapsed && !enterpriseNavCompact ? (
                      <div className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{group}</div>
                    ) : null}
                    {items.map((panel) => {
                      const Icon = panel.icon
                      const active = activePanel === panel.id
                      return (
                        <button
                          key={panel.id}
                          type="button"
                          onClick={() => switchPanel(panel.id)}
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
                          aria-label={panel.label}
                          title={panel.label}
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
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>

              <div className={cn('mt-4 space-y-4', isWorkspaceCollapsed && 'hidden')}>
              <div className="rounded-[24px] border border-slate-200/70 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <Search className="h-4 w-4 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => {
                      const value = event.target.value
                      startTransition(() => setSearchTerm(value))
                    }}
                    placeholder="Search report name, project, metric, KPI, or owner"
                    className="h-auto border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {presetFilters.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setSelectedPreset(preset)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                        selectedPreset === preset
                          ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                  <Button variant="outline" className="h-8 rounded-full border-dashed border-slate-300 px-3 text-xs">
                    <SlidersHorizontal className="mr-2 h-3.5 w-3.5" />
                    Customize Layout
                  </Button>
                </div>
              </div>

              <div className="grid gap-3">
                <Select value={timePeriod} onChange={(event) => setTimePeriod(event.target.value)} className="h-10 rounded-xl border-slate-200 bg-white">
                  <SelectItem value="Last 30 days">Time period: Last 30 days</SelectItem>
                  <SelectItem value="Quarter to date">Time period: Quarter to date</SelectItem>
                  <SelectItem value="Year to date">Time period: Year to date</SelectItem>
                </Select>
                <Select value={workspace} onChange={(event) => setWorkspace(event.target.value)} className="h-10 rounded-xl border-slate-200 bg-white">
                  <SelectItem value="All workspaces">Workspace: All workspaces</SelectItem>
                  <SelectItem value="Enterprise PMO">Workspace: Enterprise PMO</SelectItem>
                  <SelectItem value="Technology Strategy">Workspace: Technology Strategy</SelectItem>
                  <SelectItem value="Operations Control">Workspace: Operations Control</SelectItem>
                </Select>
                <Select value={project} onChange={(event) => setProject(event.target.value)} className="h-10 rounded-xl border-slate-200 bg-white">
                  <SelectItem value="All projects">Project: All projects</SelectItem>
                  <SelectItem value="Portfolio rollup">Project: Portfolio rollup</SelectItem>
                  <SelectItem value="Cross-program delivery">Project: Cross-program delivery</SelectItem>
                  <SelectItem value="Platform rationalization">Project: Platform rationalization</SelectItem>
                </Select>
                <Select value={portfolio} onChange={(event) => setPortfolio(event.target.value)} className="h-10 rounded-xl border-slate-200 bg-white">
                  <SelectItem value="All portfolios">Program / Portfolio: All portfolios</SelectItem>
                  <SelectItem value="Portfolio rollup">Program / Portfolio: Portfolio rollup</SelectItem>
                  <SelectItem value="Cross-program delivery">Program / Portfolio: Cross-program delivery</SelectItem>
                  <SelectItem value="Shared capacity pool">Program / Portfolio: Shared capacity pool</SelectItem>
                </Select>
                <Select value={team} onChange={(event) => setTeam(event.target.value)} className="h-10 rounded-xl border-slate-200 bg-white">
                  <SelectItem value="All teams">Team: All teams</SelectItem>
                  <SelectItem value="PMO">Team: PMO</SelectItem>
                  <SelectItem value="Delivery">Team: Delivery</SelectItem>
                  <SelectItem value="Operations">Team: Operations</SelectItem>
                </Select>
                <Select value={reportType} onChange={(event) => setReportType(event.target.value)} className="h-10 rounded-xl border-slate-200 bg-white">
                  <SelectItem value="All report types">Report type: All report types</SelectItem>
                  <SelectItem value="Executive">Report type: Executive</SelectItem>
                  <SelectItem value="Operational">Report type: Operational</SelectItem>
                  <SelectItem value="Agile">Report type: Agile</SelectItem>
                  <SelectItem value="Resource">Report type: Resource</SelectItem>
                  <SelectItem value="SLA">Report type: SLA</SelectItem>
                </Select>
                <Select value={healthStatus} onChange={(event) => setHealthStatus(event.target.value)} className="h-10 rounded-xl border-slate-200 bg-white">
                  <SelectItem value="All health">Health status: All health</SelectItem>
                  <SelectItem value="Healthy">Health status: Healthy</SelectItem>
                  <SelectItem value="Watch">Health status: Watch</SelectItem>
                  <SelectItem value="At Risk">Health status: At Risk</SelectItem>
                </Select>
                <Select value={slaStatus} onChange={(event) => setSlaStatus(event.target.value)} className="h-10 rounded-xl border-slate-200 bg-white">
                  <SelectItem value="All SLA">SLA status: All SLA</SelectItem>
                  <SelectItem value="On track">SLA status: On track</SelectItem>
                  <SelectItem value="Approaching breach">SLA status: Approaching breach</SelectItem>
                  <SelectItem value="Compliant">SLA status: Compliant</SelectItem>
                </Select>
              </div>
            </div>
            </div>
          </div>
        </aside>

        <div className={cn('min-w-0', workspaceMainColumnClass(navDocked, isWorkspaceCollapsed, enterpriseNavWidthVariant))}>
          <div
            className={cn(
              'grid gap-6',
              !['reporting-overview', 'executive-dashboard'].includes(activePanel) && 'hidden'
            )}
          >
          <div
            id="reporting-panel-reporting-overview"
            className={cn('scroll-mt-24', activePanel !== 'reporting-overview' && 'hidden')}
          >
            <SectionCard
              title="Reporting Overview"
              description="Core reporting inventory, active monitoring posture, and distribution of analytics assets across business needs."
              actions={
                <>
                  <TrendBadge value="Analytics health stable" trend="up" />
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportingOverviewMetrics[0].detail)}>
                    <Filter className="mr-2 h-3.5 w-3.5" />
                    Change filters
                  </Button>
                </>
              }
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {reportingOverviewMetrics.map((metric) => {
                  const Icon = metric.icon
                  return (
                    <button
                      key={metric.label}
                      onClick={() => openDrawer(metric.detail)}
                      className="rounded-[22px] border border-slate-200/80 bg-slate-50/70 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-[0_16px_32px_rgba(15,23,42,0.08)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div
                          className={cn(
                            'flex h-11 w-11 items-center justify-center rounded-2xl border',
                            metric.tone === 'slate' && 'border-slate-200 bg-slate-900 text-white',
                            metric.tone === 'blue' && 'border-blue-200 bg-blue-50 text-blue-700',
                            metric.tone === 'emerald' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                            metric.tone === 'amber' && 'border-amber-200 bg-amber-50 text-amber-700',
                            metric.tone === 'rose' && 'border-rose-200 bg-rose-50 text-rose-700'
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <TrendBadge value={metric.delta} trend={metric.trend} />
                      </div>
                      <div className="mt-5 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{metric.label}</div>
                      <div className="mt-2 text-3xl font-semibold text-slate-950">{metric.value}</div>
                    </button>
                  )
                })}
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Report distribution by type</div>
                      <div className="mt-1 text-xs text-slate-500">Balanced view across executive, operational, agile, SLA, and resource reporting.</div>
                    </div>
                    <Button variant="ghost" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[0].drawer)}>
                      Open details
                    </Button>
                  </div>
                  <div className="mt-4 h-[250px]">
                    {loading ? (
                      <SkeletonBlock className="h-full w-full" />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={distributionByType} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={4}>
                            {distributionByType.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(value: number) => [`${value} dashboards`, 'Count']} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-slate-950 p-4 text-white">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Analytics health widget</div>
                      <div className="mt-1 text-xs text-slate-300">Operational readiness of dashboards, schedules, and shared insights.</div>
                    </div>
                    <Sparkles className="h-4 w-4 text-sky-300" />
                  </div>
                  <div className="mt-5 space-y-3">
                    {analyticsHealth.map((item) => (
                      <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-slate-300">{item.label}</span>
                          <span className="font-semibold text-white">{item.value}</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-white/10">
                          <div className={cn('h-2 rounded-full', item.tone)} style={{ width: item.value.includes('%') ? item.value : '72%' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          <div
            id="reporting-panel-executive-dashboard"
            className={cn('scroll-mt-24', activePanel !== 'executive-dashboard' && 'hidden')}
          >
            <SectionCard
              title="Executive Dashboard"
              description="Leadership-ready analytics for portfolio performance, delivery status, strategic KPI progress, benefit realization, and risk posture."
              actions={
                <>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[0].drawer)}>Open Executive View</Button>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[0].drawer)}>Share with Leadership</Button>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[0].drawer)}>Export Snapshot</Button>
                </>
              }
            >
            <div className="grid gap-3 md:grid-cols-2">
              {executiveKpis.map((item) => (
                <button
                  key={item.label}
                  onClick={() => openDrawer(reportCatalog[0].drawer)}
                  className="rounded-[20px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 text-left transition-all hover:border-slate-300 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]"
                >
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">{item.value}</div>
                  <div className="mt-2 text-xs text-slate-500">{item.note}</div>
                </button>
              ))}
            </div>
            <div className="mt-5 rounded-[22px] border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Portfolio and benefit trend</div>
                  <div className="mt-1 text-xs text-slate-500">Period-over-period movement in portfolio performance, delivery health, and realized benefits.</div>
                </div>
                <TrendBadge value="6-month upward trend" trend="up" />
              </div>
              <div className="mt-4 h-[230px]">
                {loading ? (
                  <SkeletonBlock className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={executiveTrend}>
                      <defs>
                        <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0f172a" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#0f172a" stopOpacity={0.03} />
                        </linearGradient>
                        <linearGradient id="healthFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <RechartsTooltip />
                      <Area type="monotone" dataKey="portfolio" stroke="#0f172a" fill="url(#portfolioFill)" strokeWidth={2.5} />
                      <Area type="monotone" dataKey="health" stroke="#2563eb" fill="url(#healthFill)" strokeWidth={2.5} />
                      <Line type="monotone" dataKey="benefits" stroke="#0f766e" strokeWidth={2.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {riskSummary.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs text-slate-500">{item.label}</div>
                    <div className="mt-1 text-xl font-semibold text-slate-950">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
            </SectionCard>
          </div>
        </div>

        <div className={cn('grid gap-6', !['operational-dashboard', 'custom-report-builder'].includes(activePanel) && 'hidden')}>
          <div id="reporting-panel-operational-dashboard" className={cn('scroll-mt-24', activePanel !== 'operational-dashboard' && 'hidden')}>
            <SectionCard
              title="Operational Dashboard"
              description="Detailed delivery analytics for PMO and operational teams, including sprint progress, throughput, blockers, issues, and milestone status."
              actions={
                <>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[1].drawer)}>Drill Down</Button>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[1].drawer)}>Open Project</Button>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[1].drawer)}>View Source Data</Button>
                </>
              }
            >
            <div className="grid gap-3 md:grid-cols-3">
              {operationalMetrics.map((item) => (
                <button key={item.label} onClick={() => openDrawer(reportCatalog[1].drawer)} className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-4 text-left transition-all hover:border-slate-300 hover:bg-white">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">{item.value}</div>
                  <div className="mt-2 text-xs text-slate-500">{item.note}</div>
                </button>
              ))}
            </div>
            <div className="mt-5 rounded-[22px] border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Delivery operations trend</div>
                  <div className="mt-1 text-xs text-slate-500">Throughput versus blocker and issue movement across the latest sprint window.</div>
                </div>
                <TrendBadge value="Throughput rising" trend="up" />
              </div>
              <div className="mt-4 h-[250px]">
                {loading ? (
                  <SkeletonBlock className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={operationalTrend}>
                      <CartesianGrid stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <RechartsTooltip />
                      <Bar dataKey="throughput" fill="#2563eb" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="blocked" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="issues" fill="#0f172a" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            </SectionCard>
          </div>

          <div id="reporting-panel-custom-report-builder" className={cn('scroll-mt-24', activePanel !== 'custom-report-builder' && 'hidden')}>
            <SectionCard
              title="Custom Report Builder"
              description="Compose custom reports with flexible metric, grouping, date, filter, and visualization controls plus live preview and export."
              actions={
                <>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[0].drawer)}>Save Report</Button>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[0].drawer)}>Run Report</Button>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[0].drawer)}>Export</Button>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[0].drawer)}>Share</Button>
                </>
              }
            >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="space-y-4 rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Select defaultValue="Delivery health" className="h-10 rounded-xl border-slate-200 bg-white">
                    <SelectItem value="Delivery health">Metric: Delivery health</SelectItem>
                    <SelectItem value="SLA compliance">Metric: SLA compliance</SelectItem>
                    <SelectItem value="Resource utilization">Metric: Resource utilization</SelectItem>
                  </Select>
                  <Select defaultValue="Portfolio" className="h-10 rounded-xl border-slate-200 bg-white">
                    <SelectItem value="Portfolio">Dimension: Portfolio</SelectItem>
                    <SelectItem value="Project">Dimension: Project</SelectItem>
                    <SelectItem value="Team">Dimension: Team</SelectItem>
                  </Select>
                  <Select defaultValue="Quarter to date" className="h-10 rounded-xl border-slate-200 bg-white">
                    <SelectItem value="Quarter to date">Date range: Quarter to date</SelectItem>
                    <SelectItem value="Last 30 days">Date range: Last 30 days</SelectItem>
                    <SelectItem value="Year to date">Date range: Year to date</SelectItem>
                  </Select>
                  <Select defaultValue="All filters" className="h-10 rounded-xl border-slate-200 bg-white">
                    <SelectItem value="All filters">Filters: All filters</SelectItem>
                    <SelectItem value="Leadership only">Filters: Leadership only</SelectItem>
                    <SelectItem value="At Risk">Filters: At Risk</SelectItem>
                  </Select>
                </div>

                <div>
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Visualization type</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {vizOptions.map((option) => (
                      <button
                        key={option}
                        onClick={() => setSelectedViz(option)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                          selectedViz === option
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[18px] border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
                  <div className="font-medium text-slate-900">Saved filter preset</div>
                  <div className="mt-2">{selectedPreset} preset applied. Quick actions for filters, date range changes, export, and sharing remain available from every analytics panel.</div>
                </div>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Preview area</div>
                    <div className="mt-1 text-xs text-slate-500">Current output format: {selectedViz}</div>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    {selectedViz === 'Table' && <TableProperties className="h-4 w-4" />}
                    {selectedViz === 'Bar chart' && <BarChart3 className="h-4 w-4" />}
                    {selectedViz === 'Line chart' && <LineChartIcon className="h-4 w-4" />}
                    {selectedViz === 'Donut chart' && <PieChartIcon className="h-4 w-4" />}
                    {selectedViz === 'KPI cards' && <Gauge className="h-4 w-4" />}
                  </div>
                </div>
                <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                  {loading ? (
                    <div className="space-y-3">
                      <SkeletonBlock className="h-9 w-40" />
                      <SkeletonBlock className="h-32 w-full" />
                      <SkeletonBlock className="h-16 w-full" />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {builderPreview.map((line) => (
                          <div key={line} className="text-sm text-slate-700">{line}</div>
                        ))}
                      </div>
                      <div className="mt-4 h-[170px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={healthDistribution}>
                            <CartesianGrid stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                            <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                            <RechartsTooltip />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#2563eb" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            </SectionCard>
          </div>
        </div>

        <div className={cn('grid gap-6', !['project-health-scoring', 'burndown-velocity'].includes(activePanel) && 'hidden')}>
          <div id="reporting-panel-project-health-scoring" className={cn('scroll-mt-24', activePanel !== 'project-health-scoring' && 'hidden')}>
            <SectionCard
              title="Project Health Scoring"
              description="Score-based health analytics across schedule, scope, resourcing, risk, and governance with distribution and compare actions."
              actions={
                <>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[2].drawer)}>Review Score Logic</Button>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[2].drawer)}>Drill into Project</Button>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[2].drawer)}>Compare Projects</Button>
                </>
              }
            >
            <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="rounded-[22px] border border-slate-200 bg-slate-950 p-5 text-white">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Overall health score</div>
                <div className="mt-3 text-5xl font-semibold">82.4</div>
                <div className="mt-3 text-sm text-slate-300">Healthy delivery posture with resource pressure and risk mitigation requiring focus.</div>
                <div className="mt-5 space-y-3">
                  {projectHealthRadar.filter((item) => item.subject !== 'Overall').map((item) => (
                    <div key={item.subject} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                      <span className="text-slate-300">{item.subject}</span>
                      <span className="font-semibold text-white">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">Weighted health radar</div>
                  <div className="mt-1 text-xs text-slate-500">Balanced scorecard for schedule health, scope stability, resource condition, risk level, and governance health.</div>
                  <div className="mt-4 h-[250px]">
                    {loading ? (
                      <SkeletonBlock className="h-full w-full" />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={projectHealthRadar}>
                          <PolarGrid stroke="#dbe4f0" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 11 }} />
                          <Radar dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.32} />
                          <RechartsTooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">Health distribution across tracked projects</div>
                  <div className="mt-4 h-[180px]">
                    {loading ? (
                      <SkeletonBlock className="h-full w-full" />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={healthDistribution} dataKey="value" nameKey="name" innerRadius={42} outerRadius={72}>
                            {healthDistribution.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </div>
            </SectionCard>
          </div>

          <div id="reporting-panel-burndown-velocity" className={cn('scroll-mt-24', activePanel !== 'burndown-velocity' && 'hidden')}>
            <SectionCard
              title="Burndown & Velocity Analytics"
              description="Sprint burndown, velocity trend, completed versus committed work, average sprint delivery, and spillover analytics for agile teams."
              actions={
                <>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[3].drawer)}>Compare Sprints</Button>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[3].drawer)}>View Team Analytics</Button>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[3].drawer)}>Export Agile Metrics</Button>
                </>
              }
            >
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label="Sprint filter: Sprint 25" tone="border-slate-200 bg-slate-50 text-slate-700" />
              <StatusBadge label="Team filter: Delivery Alpha" tone="border-slate-200 bg-slate-50 text-slate-700" />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Sprint burndown</div>
                <div className="mt-1 text-xs text-slate-500">Completed work closing toward committed sprint scope.</div>
                <div className="mt-4 h-[220px]">
                  {loading ? (
                    <SkeletonBlock className="h-full w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={burndownSeries}>
                        <CartesianGrid stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                        <RechartsTooltip />
                        <Line type="monotone" dataKey="committed" stroke="#94a3b8" strokeWidth={2.5} dot={false} />
                        <Line type="monotone" dataKey="completed" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Velocity and spillover</div>
                <div className="mt-1 text-xs text-slate-500">Completed versus committed work over the last five sprints.</div>
                <div className="mt-4 h-[220px]">
                  {loading ? (
                    <SkeletonBlock className="h-full w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={velocitySeries}>
                        <CartesianGrid stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                        <RechartsTooltip />
                        <Bar dataKey="committed" fill="#cbd5e1" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="completed" fill="#0f766e" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="spillover" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
            </SectionCard>
          </div>
        </div>

        <div className={cn('grid gap-6', !['resource-utilization', 'sla-performance'].includes(activePanel) && 'hidden')}>
          <div id="reporting-panel-resource-utilization" className={cn('scroll-mt-24', activePanel !== 'resource-utilization' && 'hidden')}>
            <SectionCard
              title="Resource Utilization Reporting"
              description="Utilization by team and role, allocation versus capacity, and overutilization or underutilization hotspots for staffing decisions."
              actions={
                <>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[4].drawer)}>Drill Down by Team</Button>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[4].drawer)}>Compare Periods</Button>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[4].drawer)}>Export Utilization Report</Button>
                </>
              }
            >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Utilization by team</div>
                <div className="mt-4 space-y-3">
                  {utilizationByTeam.map((item) => (
                    <button key={item.team} onClick={() => openDrawer(reportCatalog[4].drawer)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-all hover:border-slate-300 hover:bg-white">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-slate-800">{item.team}</span>
                        <span className="font-semibold text-slate-950">{item.utilization}%</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-200">
                        <div className={cn('h-2 rounded-full', item.utilization >= 90 ? 'bg-rose-500' : item.utilization >= 80 ? 'bg-blue-500' : 'bg-emerald-500')} style={{ width: `${item.utilization}%` }} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4 rounded-[22px] border border-slate-200 bg-slate-950 p-4 text-white">
                <div>
                  <div className="text-sm font-semibold">Capacity summary</div>
                  <div className="mt-1 text-xs text-slate-300">Resource allocation versus bench and pressure pockets.</div>
                </div>
                {utilizationAlerts.map((item) => (
                  <div key={item.label} className={cn('rounded-2xl border px-4 py-3', item.tone)}>
                    <div className="text-xs uppercase tracking-[0.18em] opacity-80">{item.label}</div>
                    <div className="mt-1 text-lg font-semibold">{item.value}</div>
                  </div>
                ))}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Utilization by role</div>
                  <div className="mt-3 space-y-2">
                    {utilizationByRole.map((item) => (
                      <div key={item.role} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-300">{item.role}</span>
                        <span className="font-semibold text-white">{item.utilization}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            </SectionCard>
          </div>

          <div id="reporting-panel-sla-performance" className={cn('scroll-mt-24', activePanel !== 'sla-performance' && 'hidden')}>
            <SectionCard
              title="SLA & Performance Reporting"
              description="Compliance scorecards, missed SLA counts, approaching breaches, target performance, and turnaround-time trend reporting."
              actions={
                <>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[5].drawer)}>Review Breaches</Button>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[5].drawer)}>Export SLA Report</Button>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[5].drawer)}>Open Linked Work Items</Button>
                </>
              }
            >
            <div className="grid gap-3 md:grid-cols-4">
              {[
                ['SLA compliance %', '97%'],
                ['Missed SLA count', '06'],
                ['Approaching breaches', '04'],
                ['Avg response time', '20h'],
              ].map(([label, value]) => (
                <button key={label} onClick={() => openDrawer(reportCatalog[5].drawer)} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-left transition-all hover:border-slate-300 hover:bg-white">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Compliance and response trend</div>
                <div className="mt-4 h-[230px]">
                  {loading ? (
                    <SkeletonBlock className="h-full w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={slaSeries}>
                        <CartesianGrid stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                        <RechartsTooltip />
                        <Line type="monotone" dataKey="compliance" stroke="#0f766e" strokeWidth={2.5} dot={false} />
                        <Line type="monotone" dataKey="breaches" stroke="#dc2626" strokeWidth={2.5} dot={false} />
                        <Line type="monotone" dataKey="response" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="text-sm font-semibold text-slate-900">Performance against targets</div>
                <div className="mt-3 space-y-3">
                  {targetPerformance.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-slate-800">{item.label}</span>
                        <span className="font-semibold text-slate-950">{item.actual}% / {item.target}%</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-200">
                        <div className={cn('h-2 rounded-full', item.actual >= item.target ? 'bg-emerald-500' : 'bg-amber-500')} style={{ width: `${Math.min(item.actual, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            </SectionCard>
          </div>
        </div>

        <div
          className={cn(
            'grid gap-6',
            !['trend-performance', 'export-sharing', 'report-catalog'].includes(activePanel) && 'hidden'
          )}
        >
          <div id="reporting-panel-trend-performance" className={cn('scroll-mt-24', activePanel !== 'trend-performance' && 'hidden')}>
            <SectionCard
              title="Trend & Performance Analysis"
              description="Historical delivery, health, throughput, issue, SLA, and resource movement with period comparison and benchmark support."
              actions={
                <>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[0].drawer)}>Compare Periods</Button>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[0].drawer)}>Add Benchmark</Button>
                  <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[0].drawer)}>Save Trend View</Button>
                </>
              }
            >
            <div className="rounded-[22px] border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Performance trend cockpit</div>
                  <div className="mt-1 text-xs text-slate-500">Period-over-period analysis with trend direction badges for each operational dimension.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label="PoP +7 delivery" tone="border-emerald-200 bg-emerald-50 text-emerald-700" />
                  <StatusBadge label="Issues trending down" tone="border-blue-200 bg-blue-50 text-blue-700" />
                </div>
              </div>
              <div className="mt-4 h-[280px]">
                {loading ? (
                  <SkeletonBlock className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendAnalysis}>
                      <CartesianGrid stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <RechartsTooltip />
                      <Line type="monotone" dataKey="delivery" stroke="#0f172a" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="health" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="throughput" stroke="#0f766e" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="sla" stroke="#d97706" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            </SectionCard>
          </div>

          <div className={cn('space-y-6', !['export-sharing', 'report-catalog'].includes(activePanel) && 'hidden')}>
            <div id="reporting-panel-export-sharing" className={cn('scroll-mt-24', activePanel !== 'export-sharing' && 'hidden')}>
              <SectionCard
                title="Export & Sharing"
                description="Manage export format, scheduled delivery, shared recipients, links, and recent export history."
                actions={
                  <>
                    <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[0].drawer)}>Export Now</Button>
                    <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[0].drawer)}>Schedule Delivery</Button>
                    <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[0].drawer)}>Share Dashboard</Button>
                    <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(reportCatalog[0].drawer)}>Manage Access</Button>
                  </>
                }
              >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">Distribution controls</div>
                  <div className="mt-3 space-y-3 text-sm text-slate-600">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">Export formats: PDF, Excel, CSV, Image</div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">Scheduled delivery: Daily 07:00, Monday 08:00, Month-end pack</div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">Shared recipients: 34 active recipients across PMO and leadership</div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">Dashboard links: 12 active shared links with access review controls</div>
                  </div>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">Last export history</div>
                  <div className="mt-3 space-y-3">
                    {exportHistory.map((item) => (
                      <button key={item.name} onClick={() => openDrawer(reportCatalog[0].drawer)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-all hover:border-slate-300 hover:bg-white">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium text-slate-900">{item.name}</span>
                          <StatusBadge label={item.format} tone="border-slate-200 bg-white text-slate-700" />
                        </div>
                        <div className="mt-2 text-xs text-slate-500">{item.recipient} • {item.sentAt}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              </SectionCard>
            </div>

            <div id="reporting-panel-report-catalog" className={cn('scroll-mt-24', activePanel !== 'report-catalog' && 'hidden')}>
              <SectionCard
                title="Report Catalog"
                description="Saved reports and dashboards with owner, schedule, access scope, and quick actions for editing, duplication, sharing, and deletion."
                actions={<StatusBadge label={`${filteredReports.length} visible reports`} tone="border-slate-200 bg-slate-50 text-slate-700" />}
              >
              <div className="space-y-3">
                {filteredReports.map((report) => (
                  <div key={report.id} className="rounded-[22px] border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button onClick={() => openDrawer(report.drawer)} className="text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{report.name}</span>
                          {report.favorite ? <StatusBadge label="Pinned" tone="border-amber-200 bg-amber-50 text-amber-700" /> : null}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{report.type} • {report.owner} • {report.lastUpdated}</div>
                      </button>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge label={report.healthStatus} tone={report.healthStatus === 'Healthy' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : report.healthStatus === 'Watch' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-rose-200 bg-rose-50 text-rose-700'} />
                        <StatusBadge label={report.slaStatus} tone="border-slate-200 bg-slate-50 text-slate-700" />
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 md:grid-cols-4 text-xs text-slate-500">
                      <div>Type: <span className="font-medium text-slate-800">{report.reportType}</span></div>
                      <div>Schedule: <span className="font-medium text-slate-800">{report.schedule}</span></div>
                      <div>Access: <span className="font-medium text-slate-800">{report.accessScope}</span></div>
                      <div>Visualization: <span className="font-medium text-slate-800">{report.visualization}</span></div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {['Open', 'Edit', 'Duplicate', 'Share', 'Delete'].map((action) => (
                        <Button key={action} variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => openDrawer(report.drawer)}>
                          {action}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              </SectionCard>
            </div>
          </div>
        </div>
      </div>
      </div>

      <div
        className={cn(
          'fixed inset-0 z-[1050] bg-black/20 backdrop-blur-sm transition-opacity',
          activeDrawer ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setActiveDrawer(null)}
        aria-hidden="true"
      />

      <div
        className={cn(
          'fixed right-0 top-0 z-[1100] h-screen w-[460px] max-w-[94vw] border-l border-slate-200 bg-white/95 shadow-[0_0_70px_rgba(15,23,42,0.25)] backdrop-blur-xl transition-all duration-300',
          activeDrawer ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
        )}
      >
        {activeDrawer ? (
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Report Detail Drawer</div>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">{activeDrawer.title}</h2>
                <p className="mt-2 text-sm text-slate-600">{activeDrawer.subtitle}</p>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setActiveDrawer(null)} aria-label="Close report detail">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="rounded-[22px] border border-slate-200 bg-slate-950 p-4 text-white">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Last run status</div>
                <div className="mt-2 text-lg font-semibold">{activeDrawer.status}</div>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Report information</div>
                <dl className="mt-3 space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-3"><dt className="text-slate-500">Data source summary</dt><dd className="max-w-[220px] text-right font-medium text-slate-900">{activeDrawer.source}</dd></div>
                  <div className="flex items-start justify-between gap-3"><dt className="text-slate-500">Schedule info</dt><dd className="max-w-[220px] text-right font-medium text-slate-900">{activeDrawer.schedule}</dd></div>
                  <div className="flex items-start justify-between gap-3"><dt className="text-slate-500">Sharing settings</dt><dd className="max-w-[220px] text-right font-medium text-slate-900">{activeDrawer.sharing}</dd></div>
                </dl>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Applied filters</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeDrawer.filters.map((filterItem) => (
                    <StatusBadge key={filterItem} label={filterItem} tone="border-slate-200 bg-slate-50 text-slate-700" />
                  ))}
                </div>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Visualization preview</div>
                <div className="mt-3 space-y-3">
                  {activeDrawer.preview.map((line) => (
                    <div key={line} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{line}</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 px-6 py-4">
              <div className="flex flex-wrap gap-2">
                {activeDrawer.actions.map((action) => (
                  <Button key={action} variant={action === 'Run Again' ? 'default' : 'outline'} className={cn('h-8 rounded-full px-3 text-xs', action === 'Run Again' && 'bg-slate-900 text-white hover:bg-slate-800')}>
                    {action}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}