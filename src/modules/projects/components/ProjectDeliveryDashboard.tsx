import { useMemo } from 'react'
import { Bot } from 'lucide-react'
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
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Project } from '../store/projectStore'
import type { ProjectTemplate } from '../data/projectTemplates'
import type { WorkItemApiModel } from '@/lib/api/workApi'
import { buildProjectMetricsFromWorkItems } from '../lib/buildProjectMetricsFromWorkItems'

const CHART_COLORS = {
  todo: '#94a3b8',
  inProgress: '#0ea5e9',
  done: '#059669',
  blocked: '#ef4444',
  review: '#8b5cf6',
  accent: '#2563eb',
  muted: '#cbd5e1',
}

const PANEL_CARD =
  'relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.03]'
const SECTION_LABEL = 'text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400'
const CHART_TICK = { fontSize: 11, fill: '#64748b', fontWeight: 500 }
const CHART_GRID = '#eef2f7'

const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 12,
    border: '1px solid rgba(226, 232, 240, 0.9)',
    boxShadow: '0 12px 32px -16px rgba(15, 23, 42, 0.25)',
    fontSize: 12,
    padding: '10px 12px',
  },
  labelStyle: { color: '#0f172a', fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: '#475569', paddingTop: 2 },
}

function DashboardSection({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 px-0.5">
        <div>
          <p className={SECTION_LABEL}>{title}</p>
          {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        <div className="hidden h-px flex-1 bg-gradient-to-r from-slate-200/80 via-slate-100 to-transparent sm:block" aria-hidden="true" />
      </div>
      {children}
    </section>
  )
}

function DashboardPanel({
  title,
  subtitle,
  children,
  className,
  accent = 'sky',
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
  accent?: 'sky' | 'indigo' | 'emerald' | 'amber' | 'slate'
}) {
  const accentBar = {
    sky: 'from-sky-400 to-blue-500',
    indigo: 'from-indigo-400 to-violet-500',
    emerald: 'from-emerald-400 to-teal-500',
    amber: 'from-amber-400 to-orange-500',
    slate: 'from-slate-300 to-slate-400',
  }[accent]

  return (
    <div className={cn(PANEL_CARD, 'flex h-full flex-col transition-shadow duration-300 hover:shadow-[0_2px_4px_rgba(15,23,42,0.05),0_16px_36px_-14px_rgba(15,23,42,0.14)]', className)}>
      <div className={cn('h-[3px] w-full bg-gradient-to-r', accentBar)} aria-hidden="true" />
      <div className="border-b border-slate-100/90 bg-gradient-to-b from-slate-50/70 to-white px-5 py-3.5">
        <p className="text-[13px] font-semibold tracking-tight text-slate-900">{title}</p>
        {subtitle ? <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="flex-1 bg-[linear-gradient(180deg,rgba(248,250,252,0.35),rgba(255,255,255,0.95))] p-4">{children}</div>
    </div>
  )
}

function KpiToneStyles(tone: 'neutral' | 'positive' | 'info' | 'danger') {
  if (tone === 'positive') {
    return {
      card: 'border-emerald-200/60 bg-[linear-gradient(145deg,rgba(236,253,245,0.95),rgba(255,255,255,0.98))]',
      icon: 'border-emerald-200/80 bg-emerald-100/80 text-emerald-700',
      value: 'text-emerald-950',
    }
  }
  if (tone === 'info') {
    return {
      card: 'border-sky-200/60 bg-[linear-gradient(145deg,rgba(240,249,255,0.95),rgba(255,255,255,0.98))]',
      icon: 'border-sky-200/80 bg-sky-100/80 text-sky-700',
      value: 'text-sky-950',
    }
  }
  if (tone === 'danger') {
    return {
      card: 'border-rose-200/60 bg-[linear-gradient(145deg,rgba(255,241,242,0.95),rgba(255,255,255,0.98))]',
      icon: 'border-rose-200/80 bg-rose-100/80 text-rose-700',
      value: 'text-rose-950',
    }
  }
  return {
    card: 'border-slate-200/70 bg-[linear-gradient(145deg,rgba(248,250,252,0.95),rgba(255,255,255,0.98))]',
    icon: 'border-slate-200/80 bg-slate-100/80 text-slate-600',
    value: 'text-slate-950',
  }
}

function AiInsightStyles(tone: string) {
  if (tone === 'positive') {
    return {
      card: 'border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 to-white',
      dot: 'bg-emerald-500',
    }
  }
  if (tone === 'alert') {
    return {
      card: 'border-amber-200/70 bg-gradient-to-br from-amber-50/90 to-white',
      dot: 'bg-amber-500',
    }
  }
  return {
    card: 'border-sky-200/70 bg-gradient-to-br from-sky-50/90 to-white',
    dot: 'bg-sky-500',
  }
}

export function ProjectDeliveryDashboard({
  project,
  template,
  workItems,
}: {
  project: Project
  template?: ProjectTemplate
  workItems: WorkItemApiModel[]
}) {
  const metrics = useMemo(
    () =>
      buildProjectMetricsFromWorkItems(workItems, {
        template,
        anchorDate: project.createdAt.slice(0, 10),
      }),
    [project.createdAt, template, workItems],
  )

  return (
    <div className="scroll-mt-24 space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-16px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.03]">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.08),transparent_38%)]"
          aria-hidden="true"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4 px-6 py-5">
          <div>
            <p className={SECTION_LABEL}>Project Delivery Dashboard</p>
            <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-950">Operational Control Tower</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
              Banking System delivery — vendor procurement through sprint-zero development. Metrics derive from the same
              work items shown on Board and Timeline.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-emerald-200/80 bg-emerald-50/80 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live metrics
            </Badge>
            <Badge variant="outline" className="border-slate-200/80 bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
              {template?.workflow.join(' · ') ?? 'Standard workflow'}
            </Badge>
          </div>
        </div>
      </div>

      {/* ROW 1 */}
      <DashboardSection title="Executive KPIs" subtitle="At-a-glance delivery posture">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {metrics.executiveKpis.map((kpi) => {
            const Icon = kpi.icon
            const styles = KpiToneStyles(kpi.tone)
            return (
              <div
                key={kpi.label}
                className={cn(
                  PANEL_CARD,
                  'p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(15,23,42,0.05),0_18px_40px_-14px_rgba(15,23,42,0.16)]',
                  styles.card
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{kpi.label}</p>
                  <div className={cn('rounded-lg border p-1.5 shadow-sm', styles.icon)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className={cn('mt-4 text-[28px] font-semibold leading-none tracking-tight', styles.value)}>{kpi.value}</p>
              </div>
            )
          })}
        </div>
      </DashboardSection>

      {/* ROW 2 */}
      <DashboardSection title="Kanban Flow Analytics" subtitle="Distribution, trend, and constraint signals">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <DashboardPanel title="Workflow Distribution" subtitle="Current item distribution by stage" accent="emerald">
          <div className="h-[228px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={metrics.workflowStages} dataKey="value" nameKey="name" innerRadius={56} outerRadius={82} paddingAngle={3} stroke="#fff" strokeWidth={2}>
                  {metrics.workflowStages.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Legend verticalAlign="bottom" height={40} iconType="circle" wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </DashboardPanel>

        <DashboardPanel title="Flow Trend" subtitle="Stacked weekly movement across workflow" accent="sky">
          <div className="h-[228px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.flowTrend}>
                <defs>
                  <linearGradient id="flowBacklog" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.08} />
                  </linearGradient>
                  <linearGradient id="flowTodo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.todo} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={CHART_COLORS.todo} stopOpacity={0.08} />
                  </linearGradient>
                  <linearGradient id="flowProgress" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.inProgress} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={CHART_COLORS.inProgress} stopOpacity={0.08} />
                  </linearGradient>
                  <linearGradient id="flowReview" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.review} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={CHART_COLORS.review} stopOpacity={0.08} />
                  </linearGradient>
                  <linearGradient id="flowDone" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.done} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={CHART_COLORS.done} stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="week" tick={CHART_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={CHART_TICK} axisLine={false} tickLine={false} width={28} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="backlog" stackId="1" stroke="#8b5cf6" fill="url(#flowBacklog)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="todo" stackId="1" stroke={CHART_COLORS.todo} fill="url(#flowTodo)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="inProgress" stackId="1" stroke={CHART_COLORS.inProgress} fill="url(#flowProgress)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="inReview" stackId="1" stroke={CHART_COLORS.review} fill="url(#flowReview)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="done" stackId="1" stroke={CHART_COLORS.done} fill="url(#flowDone)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </DashboardPanel>

        <DashboardPanel title="Bottleneck Analysis" subtitle="Highest queue depth by stage" accent="amber">
          <div className="h-[228px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.bottlenecks} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="4 4" stroke={CHART_GRID} horizontal={false} />
                <XAxis type="number" tick={CHART_TICK} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="stage" width={96} tick={CHART_TICK} axisLine={false} tickLine={false} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={16}>
                  {metrics.bottlenecks.map((entry) => (
                    <Cell key={entry.stage} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardPanel>
        </div>
      </DashboardSection>

      {/* ROW 3 */}
      <DashboardSection title="Delivery Performance" subtitle="Throughput, latency, and aging signals">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <DashboardPanel title="Throughput Trend" subtitle="Completed items per day" accent="indigo">
          <div className="h-[228px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.throughputTrend}>
                <CartesianGrid strokeDasharray="4 4" stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="day" tick={CHART_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={CHART_TICK} axisLine={false} tickLine={false} width={28} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="items" stroke={CHART_COLORS.accent} strokeWidth={2.5} dot={{ r: 3, fill: CHART_COLORS.accent, strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </DashboardPanel>

        <DashboardPanel title="Lead Time vs Cycle Time" subtitle="Weekly delivery latency comparison" accent="sky">
          <div className="h-[228px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.leadCycle}>
                <CartesianGrid strokeDasharray="4 4" stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="week" tick={CHART_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={CHART_TICK} axisLine={false} tickLine={false} width={28} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Line type="monotone" dataKey="leadTime" name="Lead Time" stroke="#6366f1" strokeWidth={2.25} dot={false} />
                <Line type="monotone" dataKey="cycleTime" name="Cycle Time" stroke={CHART_COLORS.inProgress} strokeWidth={2.25} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </DashboardPanel>

        <DashboardPanel title="Aging Work Items" subtitle="Items by time in active workflow" accent="slate">
          <div className="h-[228px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.agingItems}>
                <CartesianGrid strokeDasharray="4 4" stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="bucket" tick={{ ...CHART_TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={CHART_TICK} axisLine={false} tickLine={false} width={28} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Bar dataKey="count" fill={CHART_COLORS.accent} radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardPanel>
        </div>
      </DashboardSection>

      {/* ROW 4 */}
      <DashboardSection title="Resource & Team Health" subtitle="Workload balance and capacity posture">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <DashboardPanel title="Team Workload" subtitle="Open items assigned per contributor" accent="indigo">
          <div className="h-[228px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.workloadData}>
                <CartesianGrid strokeDasharray="4 4" stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="name" tick={CHART_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={CHART_TICK} axisLine={false} tickLine={false} width={28} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Bar dataKey="items" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardPanel>

        <DashboardPanel title="Capacity Utilization" subtitle="Team load against available capacity" accent="sky">
          <div className="flex h-[228px] flex-col items-center justify-center">
            <div className="relative h-[150px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="68%"
                  outerRadius="100%"
                  data={[{ name: 'Capacity', value: metrics.capacityUtilization, fill: CHART_COLORS.accent }]}
                  startAngle={180}
                  endAngle={0}
                >
                  <RadialBar dataKey="value" cornerRadius={10} background={{ fill: '#e8eef5' }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center">
                <p className="text-3xl font-semibold tracking-tight text-slate-950">{metrics.capacityUtilization}%</p>
              </div>
            </div>
            <p className="text-xs font-medium text-slate-500">Utilized capacity this sprint</p>
          </div>
        </DashboardPanel>

        <DashboardPanel title="Assignment Distribution" subtitle="Work mix by function" accent="emerald">
          <div className="h-[228px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={metrics.assignmentMix} dataKey="value" nameKey="name" innerRadius={50} outerRadius={76} paddingAngle={3} stroke="#fff" strokeWidth={2}>
                  {metrics.assignmentMix.map((_, index) => (
                    <Cell key={index} fill={['#2563eb', '#0891b2', '#7c3aed', '#64748b'][index % 4]} />
                  ))}
                </Pie>
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Legend verticalAlign="bottom" height={40} iconType="circle" wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </DashboardPanel>
        </div>
      </DashboardSection>

      {/* ROW 5 */}
      <DashboardSection title="Execution Commitments" subtitle="Milestones and active impediments">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DashboardPanel title="Milestone Timeline" subtitle="Committed delivery checkpoints" accent="emerald">
          <div className="space-y-1">
            {metrics.milestones.map((milestone, index) => (
              <div
                key={milestone.name}
                className="group flex items-start gap-3 rounded-xl border border-transparent px-2 py-2.5 transition-colors hover:border-slate-200/70 hover:bg-white/80"
              >
                <div className="flex flex-col items-center pt-1">
                  <div
                    className={cn(
                      'relative z-10 h-3.5 w-3.5 rounded-full border-[2.5px] shadow-sm',
                      milestone.status === 'done'
                        ? 'border-emerald-500 bg-emerald-500 ring-4 ring-emerald-500/15'
                        : milestone.status === 'active'
                          ? 'border-sky-500 bg-sky-500 ring-4 ring-sky-500/15'
                          : 'border-slate-300 bg-white'
                    )}
                  />
                  {index < metrics.milestones.length - 1 ? (
                    <div className="mt-1 h-9 w-px bg-gradient-to-b from-slate-200 to-slate-100" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{milestone.name}</p>
                    <span className="rounded-md bg-slate-100/90 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {milestone.date}
                    </span>
                  </div>
                  <p
                    className={cn(
                      'mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      milestone.status === 'done'
                        ? 'bg-emerald-50 text-emerald-700'
                        : milestone.status === 'active'
                          ? 'bg-sky-50 text-sky-700'
                          : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {milestone.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DashboardPanel>

        <DashboardPanel title="Risk & Blocker Register" subtitle="Active impediments affecting flow" accent="amber">
          <div className="overflow-x-auto rounded-xl border border-slate-100/90 bg-white/70">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  <th className="px-3 py-2.5 font-semibold">ID</th>
                  <th className="px-3 py-2.5 font-semibold">Issue</th>
                  <th className="px-3 py-2.5 font-semibold">Severity</th>
                  <th className="px-3 py-2.5 font-semibold">Owner</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {metrics.risks.map((risk, index) => (
                  <tr
                    key={risk.id}
                    className={cn(
                      'border-b border-slate-50 last:border-0 transition-colors hover:bg-slate-50/70',
                      index % 2 === 0 ? 'bg-white/50' : 'bg-slate-50/30'
                    )}
                  >
                    <td className="px-3 py-3 font-mono text-xs text-slate-500">{risk.id}</td>
                    <td className="px-3 py-3 font-medium text-slate-800">{risk.title}</td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1',
                          risk.severity === 'High'
                            ? 'bg-rose-50 text-rose-700 ring-rose-200/70'
                            : 'bg-amber-50 text-amber-700 ring-amber-200/70'
                        )}
                      >
                        {risk.severity}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{risk.owner}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{risk.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardPanel>
        </div>
      </DashboardSection>

      {/* ROW 6 */}
      <div className={cn(PANEL_CARD, 'overflow-hidden')}>
        <div className="h-[3px] w-full bg-gradient-to-r from-sky-400 via-indigo-400 to-violet-500" aria-hidden="true" />
        <div className="border-b border-slate-100/90 bg-gradient-to-b from-slate-50/70 to-white px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-lg border border-sky-200/70 bg-sky-50/80 p-1.5">
              <Bot className="h-4 w-4 text-sky-700" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-slate-900">AI Delivery Insights</p>
              <p className="text-xs text-slate-500">Advisory signals — not operational source of truth</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 bg-[linear-gradient(180deg,rgba(248,250,252,0.4),rgba(255,255,255,0.95))] p-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.aiInsights.map((insight) => {
            const styles = AiInsightStyles(insight.tone)
            return (
              <div
                key={insight.title}
                className={cn(
                  'relative overflow-hidden rounded-xl border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-transform duration-300 hover:-translate-y-0.5',
                  styles.card
                )}
              >
                <div className={cn('absolute left-0 top-0 h-full w-1', styles.dot)} aria-hidden="true" />
                <p className="pl-2 text-xs font-semibold text-slate-900">{insight.title}</p>
                <p className="mt-2 pl-2 text-xs leading-5 text-slate-600">{insight.body}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
