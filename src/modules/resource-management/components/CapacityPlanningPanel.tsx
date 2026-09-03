import { Fragment, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Lightbulb,
  MoreHorizontal,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react'
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectItem } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type CapacityStatus = 'Healthy' | 'Available' | 'Watch' | 'At Risk' | 'Overallocated'
type AttentionLevel = 'critical' | 'warning' | 'opportunity'

type CapacityResource = {
  id: string
  name: string
  role: string
  team: string
  available: number
  allocated: number
  utilization: number
  status: CapacityStatus
  workspace?: string
}

type ForecastWeek = {
  week: string
  capacity: number
  demand: number
  available: number
}

type TeamHeatmapRow = {
  team: string
  weeks: number[]
}

type WorkspaceAllocation = {
  workspace: string
  hours: number
  percentage: number
  resources: number
}

type AttentionCard = {
  id: string
  level: AttentionLevel
  title: string
  description: string
  actionLabel: string
  icon: React.ComponentType<{ className?: string }>
}

type InsightCard = {
  id: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  actionLabel: string
  tone: 'ai' | 'rebalance' | 'risk' | 'opportunity' | 'confidence'
}

type ResourceDetailData = {
  name: string
  role: string
  team: string
  workspaces: string[]
  utilization: number
  available: number
  status: CapacityStatus
  allocations: Array<{ workspace: string; percentage: number }>
  upcomingCommitments: string[]
  forecast: Array<{ week: string; utilization: number }>
}

const capacityResources: CapacityResource[] = [
  { id: 'r1', name: 'Ayla Putri', role: 'Product Owner', team: 'PMO Core', available: 18, allocated: 71, utilization: 89, status: 'Healthy' },
  { id: 'r2', name: 'Jonas Rahardian', role: 'Tech Lead', team: 'Studio West', available: 0, allocated: 108, utilization: 108, status: 'Overallocated' },
  { id: 'r3', name: 'Mina Aulia', role: 'Backend Engineer', team: 'Migration Guild', available: 28, allocated: 44, utilization: 72, status: 'Healthy' },
  { id: 'r4', name: 'Nadia Sari', role: 'QA Engineer', team: 'Data Team', available: 44, allocated: 12, utilization: 56, status: 'Available' },
  { id: 'r5', name: 'Ricky Pratama', role: 'UX/UI Designer', team: 'Studio West', available: 32, allocated: 53, utilization: 85, status: 'Healthy' },
]

const forecastData: ForecastWeek[] = [
  { week: 'W1\n17 May', capacity: 100, demand: 72, available: 68 },
  { week: 'W2\n24 May', capacity: 100, demand: 78, available: 54 },
  { week: 'W3\n31 May', capacity: 100, demand: 82, available: 58 },
  { week: 'W4\n7 Jun', capacity: 100, demand: 94, available: 63 },
  { week: 'W5\n14 Jun', capacity: 100, demand: 108, available: 51 },
  { week: 'W6\n21 Jun', capacity: 100, demand: 101, available: 40 },
]

const teamHeatmap: TeamHeatmapRow[] = [
  { team: 'PMO Core', weeks: [82, 87, 94, 103, 108, 92] },
  { team: 'Studio West', weeks: [64, 72, 78, 84, 86, 79] },
  { team: 'Migration Guild', weeks: [91, 96, 101, 104, 92, 85] },
  { team: 'Data Team', weeks: [58, 65, 71, 76, 81, 74] },
]

const workspaceAllocations: WorkspaceAllocation[] = [
  { workspace: 'BORNEO', hours: 156, percentage: 38, resources: 3 },
  { workspace: 'ANAMBAS', hours: 119, percentage: 29, resources: 2 },
  { workspace: 'ANDALAS', hours: 86, percentage: 21, resources: 2 },
  { workspace: 'BAU', hours: 51, percentage: 12, resources: 1 },
]

const attentionCards: AttentionCard[] = [
  {
    id: 'att1',
    level: 'critical',
    title: 'Jonas Rahardian',
    description: 'Over capacity by 8%',
    actionLabel: 'Review Allocation',
    icon: XCircle,
  },
  {
    id: 'att2',
    level: 'warning',
    title: 'Migration Guild',
    description: 'Projected 104% in Week 4',
    actionLabel: 'View Forecast',
    icon: AlertTriangle,
  },
  {
    id: 'att3',
    level: 'opportunity',
    title: 'Nadia Sari',
    description: '44% available, good fit for BORNEO',
    actionLabel: 'Suggest Allocation',
    icon: CheckCircle2,
  },
]

const insightCards: InsightCard[] = [
  {
    id: 'ins1',
    icon: Sparkles,
    title: 'AI Insight',
    description: 'Review team has exceeded recommended capacity for 6 consecutive days.',
    actionLabel: 'View Details',
    tone: 'ai',
  },
  {
    id: 'ins2',
    icon: Users,
    title: 'SRR Recommendation',
    description: 'Reduce WIP (Wait In Process) by Review in team, or Reassign 1 resource from Studio West to PMO Core.',
    actionLabel: 'View Candidates',
    tone: 'rebalance',
  },
  {
    id: 'ins3',
    icon: AlertTriangle,
    title: 'Delivery Risk',
    description: 'BORNEO milestone at risk of 7 day delay if capacity is not rebalanced in 7 days.',
    actionLabel: 'See Impact Analysis',
    tone: 'risk',
  },
  {
    id: 'ins4',
    icon: Lightbulb,
    title: 'Resource Recommendation',
    description: 'Consider reassigning Nadia Sari (1 resource) for QA Engineer capability.',
    actionLabel: 'View Candidates',
    tone: 'opportunity',
  },
  {
    id: 'ins5',
    icon: TrendingUp,
    title: 'Forecast Confidence',
    description: 'Delivery confidence is 87%, based on past allocation accuracy.',
    actionLabel: 'View Prediction',
    tone: 'confidence',
  },
]

function getStatusColor(status: CapacityStatus): string {
  switch (status) {
    case 'Available':
      return '#10b981'
    case 'Healthy':
      return '#10b981'
    case 'Watch':
      return '#f59e0b'
    case 'At Risk':
      return '#f97316'
    case 'Overallocated':
      return '#ef4444'
    default:
      return '#64748b'
  }
}

function getAttentionColor(level: AttentionLevel): {
  bg: string
  border: string
  icon: string
  text: string
} {
  switch (level) {
    case 'critical':
      return { bg: 'bg-rose-50', border: 'border-rose-200', icon: 'text-rose-600', text: 'text-rose-900' }
    case 'warning':
      return { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600', text: 'text-amber-900' }
    case 'opportunity':
      return { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600', text: 'text-emerald-900' }
  }
}

function getInsightToneColors(tone: InsightCard['tone']): {
  bg: string
  iconBg: string
  icon: string
  text: string
} {
  switch (tone) {
    case 'ai':
      return { bg: 'bg-violet-50/60', iconBg: 'bg-violet-100', icon: 'text-violet-600', text: 'text-violet-900' }
    case 'rebalance':
      return { bg: 'bg-blue-50/60', iconBg: 'bg-blue-100', icon: 'text-blue-600', text: 'text-blue-900' }
    case 'risk':
      return { bg: 'bg-orange-50/60', iconBg: 'bg-orange-100', icon: 'text-orange-600', text: 'text-orange-900' }
    case 'opportunity':
      return { bg: 'bg-emerald-50/60', iconBg: 'bg-emerald-100', icon: 'text-emerald-600', text: 'text-emerald-900' }
    case 'confidence':
      return { bg: 'bg-cyan-50/60', iconBg: 'bg-cyan-100', icon: 'text-cyan-600', text: 'text-cyan-900' }
  }
}

function getHeatmapColor(value: number): string {
  if (value >= 100) return '#ef4444'
  if (value >= 90) return '#f97316'
  if (value >= 80) return '#f59e0b'
  if (value >= 60) return '#3b82f6'
  return '#10b981'
}

function CompactKpiSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((value, index) => ({ idx: index, value }))
  const gradientId = `capacity-kpi-${color.replace('#', '')}`

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 1, right: 0, left: 0, bottom: 1 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.24} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.4} fill={`url(#${gradientId})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function ResourceCapacityDrawer({
  resource,
  onClose,
}: {
  resource: ResourceDetailData | null
  onClose: () => void
}) {
  if (!resource) return null

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[480px] bg-white shadow-2xl border-l border-slate-200">
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Resource Capacity Detail</div>
              <div className="mt-2 text-xl font-bold text-slate-900">{resource.name}</div>
              <div className="mt-1 text-sm text-slate-600">{resource.role} · {resource.team}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 flex gap-2">
            <Badge className={cn(
              'px-2 py-1 text-xs font-medium',
              resource.status === 'Overallocated' && 'border-rose-200 bg-rose-50 text-rose-700',
              resource.status === 'At Risk' && 'border-orange-200 bg-orange-50 text-orange-700',
              resource.status === 'Healthy' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
              resource.status === 'Available' && 'border-blue-200 bg-blue-50 text-blue-700'
            )}>
              {resource.status}
            </Badge>
            <Badge className="border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
              {resource.utilization}% Utilization
            </Badge>
            <Badge className="border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
              {resource.available}% Available
            </Badge>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Workspaces</div>
              <div className="space-y-2">
                {resource.workspaces.map((ws) => (
                  <div key={ws} className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-700">
                    {ws}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Current Project Allocation</div>
              <div className="space-y-2">
                {resource.allocations.map((alloc) => (
                  <div key={alloc.workspace} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <span className="text-sm font-medium text-slate-700">{alloc.workspace}</span>
                    <span className="text-sm font-bold text-slate-900">{alloc.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Allocation Trend</div>
              <div className="h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={resource.forecast} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
                    <defs>
                      <linearGradient id="drawer-trend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.16} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 120]} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
                            <div className="text-xs font-semibold text-slate-900">{payload[0].payload.week}</div>
                            <div className="mt-1 text-xs text-slate-600">{payload[0].value}% utilization</div>
                          </div>
                        )
                      }}
                    />
                    <Area type="monotone" dataKey="utilization" stroke="#3b82f6" strokeWidth={2} fill="url(#drawer-trend)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Upcoming Commitments</div>
              <div className="space-y-2">
                {resource.upcomingCommitments.map((commitment, idx) => (
                  <div key={idx} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <CalendarClock className="mt-0.5 h-3.5 w-3.5 text-slate-400" />
                    <span className="text-sm text-slate-700">{commitment}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50/50 px-6 py-4">
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700">
              Rebalance Allocation
            </Button>
            <Button size="sm" variant="outline" className="flex-1">
              View Assignments
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CapacityPlanningPanel() {
  const [timePeriod, setTimePeriod] = useState('This Month')
  const [viewBy, setViewBy] = useState('By Resource')
  const [workspace, setWorkspace] = useState('All Workspaces')
  const [selectedResource, setSelectedResource] = useState<ResourceDetailData | null>(null)

  const totalAllocated = 412
  const avgAllocation = 82
  const avgUtilization = 79
  const availableCapacity = 2
  const atRisk = 1
  const overallocated = 1
  const workspaceCount = 3

  const handleResourceClick = (resource: CapacityResource) => {
    const detailData: ResourceDetailData = {
      name: resource.name,
      role: resource.role,
      team: resource.team,
      workspaces: resource.name === 'Jonas Rahardian' ? ['BORNEO', 'ANAMBAS'] : ['BORNEO'],
      utilization: resource.utilization,
      available: resource.available,
      status: resource.status,
      allocations: resource.name === 'Jonas Rahardian' 
        ? [{ workspace: 'BORNEO', percentage: 68 }, { workspace: 'ANAMBAS', percentage: 40 }]
        : [{ workspace: 'BORNEO', percentage: resource.allocated }],
      upcomingCommitments: [
        'Sprint 23 Planning - May 18',
        'Architecture Review - May 20',
        'Quarterly Review - May 25',
      ],
      forecast: [
        { week: 'W1', utilization: resource.utilization },
        { week: 'W2', utilization: resource.utilization + 2 },
        { week: 'W3', utilization: resource.utilization + 5 },
        { week: 'W4', utilization: resource.utilization + 8 },
        { week: 'W5', utilization: resource.utilization + 12 },
        { week: 'W6', utilization: resource.utilization + 8 },
      ],
    }
    setSelectedResource(detailData)
  }

  return (
    <div className="space-y-6 pb-8">
      {/* ROW 0: Header with Controls */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium text-slate-600">
            Balance resource demand, allocation, and available capacity across teams, projects, and workspaces.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timePeriod} onChange={(e) => setTimePeriod(e.target.value)}>
            <SelectItem value="This Month">This Month</SelectItem>
            <SelectItem value="This Quarter">This Quarter</SelectItem>
            <SelectItem value="Next Quarter">Next Quarter</SelectItem>
          </Select>
          <Select value={viewBy} onChange={(e) => setViewBy(e.target.value)}>
            <SelectItem value="By Resource">By Resource</SelectItem>
            <SelectItem value="By Team">By Team</SelectItem>
            <SelectItem value="By Workspace">By Workspace</SelectItem>
          </Select>
          <Select value={workspace} onChange={(e) => setWorkspace(e.target.value)}>
            <SelectItem value="All Workspaces">All Workspaces</SelectItem>
            <SelectItem value="BORNEO">BORNEO</SelectItem>
            <SelectItem value="ANAMBAS">ANAMBAS</SelectItem>
            <SelectItem value="ANDALAS">ANDALAS</SelectItem>
          </Select>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <RefreshCw className="h-3.5 w-3.5 text-slate-600" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-3.5 w-3.5 text-slate-600" />
          </Button>
        </div>
      </div>

      {/* ROW 1: Compact KPI Strip */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Avg Allocation', value: `${avgAllocation}%`, change: '+4%', trend: [78, 80, 79, 81, 82, 82], color: '#3b82f6' },
          { label: 'Avg Utilization', value: `${avgUtilization}%`, change: '+2.4%', trend: [76, 77, 78, 79, 79, 79], color: '#8b5cf6' },
          { label: 'Available Capacity', value: availableCapacity, change: '-1', trend: [3, 3, 2, 2, 2, 2], color: '#10b981' },
          { label: 'At Risk', value: atRisk, change: 'Same', trend: [1, 1, 2, 1, 1, 1], color: '#f59e0b' },
          { label: 'Overallocated', value: overallocated, change: 'Same', trend: [1, 0, 1, 1, 1, 1], color: '#ef4444' },
          { label: 'Workspaces', value: workspaceCount, change: '+1', trend: [2, 2, 2, 3, 3, 3], color: '#06b6d4' },
        ].map((kpi) => (
          <div key={kpi.label} className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white/60 p-3 shadow-sm transition-all hover:shadow-md">
            <div className="relative z-10">
              <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">{kpi.label}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <div className="text-2xl font-bold text-slate-900">{kpi.value}</div>
                <div className={cn(
                  'text-[10px] font-medium',
                  kpi.change.startsWith('+') ? 'text-emerald-600' : kpi.change === 'Same' ? 'text-slate-400' : 'text-rose-600'
                )}>
                  {kpi.change !== 'Same' && kpi.change} vs last month
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-10 opacity-60">
              <CompactKpiSparkline data={kpi.trend} color={kpi.color} />
            </div>
          </div>
        ))}
      </div>

      {/* ROW 2: Capacity vs Allocation (60%) + Forecast (40%) */}
      <div className="grid grid-cols-5 gap-4">
        {/* Capacity vs Allocation - 3 columns (60%) */}
        <div className="col-span-3">
          <Card className="h-full rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200/80 bg-gradient-to-br from-slate-50/80 via-white to-transparent px-5 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold text-slate-900">1. Capacity vs Allocation</div>
                    <Badge className="bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">By Resource</Badge>
                    <Info className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <div className="mt-1 text-xs text-slate-600">Current workload compared with recommended resource capacity.</div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-700">
                  View All <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="p-5">
              <div className="space-y-4">
                {capacityResources.map((resource) => (
                  <div
                    key={resource.id}
                    className="group cursor-pointer transition-all"
                    onClick={() => handleResourceClick(resource)}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-xs font-bold text-slate-700">
                          {resource.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-600">{resource.name}</div>
                          <div className="text-xs text-slate-500">{resource.role}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-[10px] font-medium text-slate-500">Available</div>
                          <div className="text-sm font-bold text-emerald-600">{resource.available}%</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-medium text-slate-500">Allocated</div>
                          <div className="text-sm font-bold text-slate-900">{resource.allocated}%</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-medium text-slate-500">Util</div>
                          <div className={cn(
                            'text-sm font-bold',
                            resource.utilization > 100 ? 'text-rose-600' : resource.utilization >= 90 ? 'text-orange-600' : 'text-slate-900'
                          )}>
                            {resource.utilization}%
                          </div>
                        </div>
                        <Badge className={cn(
                          'px-2 py-0.5 text-[10px] font-semibold',
                          resource.status === 'Overallocated' && 'border-rose-200 bg-rose-50 text-rose-700',
                          resource.status === 'At Risk' && 'border-orange-200 bg-orange-50 text-orange-700',
                          resource.status === 'Healthy' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                          resource.status === 'Available' && 'border-blue-200 bg-blue-50 text-blue-700'
                        )}>
                          {resource.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="relative h-7">
                      <div className="absolute inset-0 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full bg-gradient-to-r from-blue-400 to-blue-500"
                          style={{ width: `${Math.min(resource.allocated, 100)}%` }}
                        />
                        {resource.utilization > 100 && (
                          <div
                            className="absolute left-0 top-0 h-full bg-gradient-to-r from-rose-400 to-rose-500"
                            style={{
                              left: '100%',
                              width: `${(resource.utilization - 100) / 100 * 100}%`,
                            }}
                          />
                        )}
                      </div>
                      <div className="absolute left-0 top-0 h-full w-px bg-slate-300" style={{ left: '100%' }} />
                      <div className="absolute right-0 top-0 flex h-full items-center pr-2 text-[10px] font-bold text-slate-700">
                        {resource.utilization}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Capacity Forecast - 2 columns (40%) */}
        <div className="col-span-2">
          <Card className="h-full rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200/80 bg-gradient-to-br from-slate-50/80 via-white to-transparent px-5 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold text-slate-900">2. Capacity Forecast</div>
                    <Badge className="bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Team Average</Badge>
                    <Info className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <div className="mt-1 text-xs text-slate-600">Projected capacity vs demand for the next 6 weeks.</div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-700">
                  View Detail <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="p-5">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecastData} margin={{ top: 12, right: 12, left: -12, bottom: 12 }}>
                    <defs>
                      <linearGradient id="capacity-line" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="demand-line" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 120]} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
                            <div className="text-xs font-semibold text-slate-900">{label}</div>
                            {payload.map((item) => (
                              <div key={item.dataKey} className="mt-1 flex items-center gap-2 text-xs">
                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-slate-600">{item.name}:</span>
                                <span className="font-semibold text-slate-900">{item.value}%</span>
                              </div>
                            ))}
                          </div>
                        )
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={32}
                      content={({ payload }) => (
                        <div className="flex justify-center gap-4">
                          {payload?.map((entry) => (
                            <div key={entry.value} className="flex items-center gap-1.5">
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                              <span className="text-xs font-medium text-slate-600">{entry.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    />
                    <Line type="monotone" dataKey="capacity" name="Capacity" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="demand" name="Allocation / Demand" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="available" name="Available Capacity" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {forecastData.some(w => w.demand > w.capacity) && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/50 px-3 py-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" />
                  <div>
                    <div className="text-xs font-semibold text-rose-900">Capacity breach expected in W5</div>
                    <div className="mt-0.5 text-xs text-rose-700">Demand exceeds capacity by 8%</div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ROW 3: Team Heatmap (45%) + Donut (30%) + Attention (25%) */}
      <div className="grid grid-cols-20 gap-4">
        {/* Team Capacity Heatmap - 9 columns (45%) */}
        <div className="col-span-9">
          <Card className="h-full rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200/80 bg-gradient-to-br from-slate-50/80 via-white to-transparent px-5 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold text-slate-900">3. Team Capacity Heatmap</div>
                    <Info className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <div className="mt-1 text-xs text-slate-600">Team utilization across the next 6 weeks.</div>
                </div>
              </div>
            </div>
            <div className="p-5">
              <div className="space-y-3">
                <div className="grid grid-cols-7 gap-2 text-center">
                  <div className="text-xs font-semibold text-slate-500">Team / Squad</div>
                  {['W1\n17 May', 'W2\n24 May', 'W3\n31 May', 'W4\n7 Jun', 'W5\n14 Jun', 'W6\n21 Jun'].map((week) => (
                    <div key={week} className="whitespace-pre-line text-[10px] font-semibold text-slate-500">
                      {week}
                    </div>
                  ))}
                </div>
                {teamHeatmap.map((row) => (
                  <div key={row.team} className="grid grid-cols-7 gap-2">
                    <div className="flex items-center text-xs font-semibold text-slate-700">{row.team}</div>
                    {row.weeks.map((value, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'flex items-center justify-center rounded-lg py-3 text-xs font-bold transition-all hover:scale-105',
                          value >= 100 && 'bg-rose-100 text-rose-900',
                          value >= 90 && value < 100 && 'bg-orange-100 text-orange-900',
                          value >= 80 && value < 90 && 'bg-amber-100 text-amber-900',
                          value >= 60 && value < 80 && 'bg-blue-100 text-blue-900',
                          value < 60 && 'bg-emerald-100 text-emerald-900'
                        )}
                        style={{ backgroundColor: `${getHeatmapColor(value)}20`, color: getHeatmapColor(value) }}
                      >
                        {value}%
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Allocation by Project/Workspace - 6 columns (30%) */}
        <div className="col-span-6">
          <Card className="h-full rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200/80 bg-gradient-to-br from-slate-50/80 via-white to-transparent px-5 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold text-slate-900">4. Allocation by Project / Workspace</div>
                    <Info className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <div className="mt-1 text-xs text-slate-600">Current capacity distribution across workspaces.</div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-700">
                  View All <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="p-5">
              <div className="relative h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={workspaceAllocations}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      dataKey="hours"
                      paddingAngle={2}
                    >
                      {workspaceAllocations.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b'][index]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const data = payload[0].payload as WorkspaceAllocation
                        return (
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
                            <div className="text-xs font-semibold text-slate-900">{data.workspace}</div>
                            <div className="mt-1 text-xs text-slate-600">{data.hours}h ({data.percentage}%)</div>
                            <div className="mt-0.5 text-xs text-slate-500">{data.resources} resources</div>
                          </div>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-900">{totalAllocated}h</div>
                    <div className="text-[10px] font-medium text-slate-500">Allocated</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {workspaceAllocations.map((workspace, idx) => (
                  <div key={workspace.workspace} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b'][idx] }} />
                      <span className="text-xs font-semibold text-slate-700">{workspace.workspace}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-600">{workspace.percentage}%</span>
                      <span className="text-xs font-bold text-slate-900">{workspace.hours}h</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Capacity Attention - 5 columns (25%) */}
        <div className="col-span-5">
          <Card className="h-full rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200/80 bg-gradient-to-br from-slate-50/80 via-white to-transparent px-5 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold text-slate-900">5. Capacity Attention</div>
                    <Info className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <div className="mt-1 text-xs text-slate-600">Actions requiring immediate attention.</div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-700">
                  View All <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {attentionCards.map((card) => {
                  const colors = getAttentionColor(card.level)
                  const Icon = card.icon
                  return (
                    <div key={card.id} className={cn('rounded-lg border p-3', colors.bg, colors.border)}>
                      <div className="flex items-start gap-2">
                        <Icon className={cn('mt-0.5 h-4 w-4 flex-shrink-0', colors.icon)} />
                        <div className="flex-1">
                          <div className={cn('text-xs font-semibold', colors.text)}>{card.title}</div>
                          <div className={cn('mt-1 text-xs', colors.text, 'opacity-80')}>{card.description}</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn('mt-2 h-6 px-2 text-[10px] font-semibold', colors.text, 'hover:bg-white/50')}
                          >
                            {card.actionLabel} <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ROW 4: Insights & Recommendations */}
      <div>
        <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200/80 bg-gradient-to-br from-slate-50/80 via-white to-transparent px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="text-sm font-bold text-slate-900">Capacity Insights & Recommendations</div>
              <Badge className="bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">AI-Powered</Badge>
              <Info className="h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-5 gap-4">
              {insightCards.map((card) => {
                const colors = getInsightToneColors(card.tone)
                const Icon = card.icon
                return (
                  <div key={card.id} className={cn('rounded-xl border border-slate-200/60 p-4', colors.bg)}>
                    <div className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg', colors.iconBg)}>
                      <Icon className={cn('h-4 w-4', colors.icon)} />
                    </div>
                    <div className={cn('mt-3 text-xs font-bold', colors.text)}>{card.title}</div>
                    <div className={cn('mt-2 text-xs leading-relaxed', colors.text, 'opacity-80')}>
                      {card.description}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn('mt-3 h-7 w-full justify-start px-2 text-[10px] font-semibold', colors.text, 'hover:bg-white/60')}
                    >
                      {card.actionLabel} <ArrowRight className="ml-auto h-3 w-3" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Resource Detail Drawer */}
      {selectedResource && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setSelectedResource(null)} />
          <ResourceCapacityDrawer resource={selectedResource} onClose={() => setSelectedResource(null)} />
        </>
      )}
    </div>
  )
}
