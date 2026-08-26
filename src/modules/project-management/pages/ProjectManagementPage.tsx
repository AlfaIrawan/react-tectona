import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowUpDown,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Download,
  Edit,
  Eye,
  FileStack,
  Filter,
  Flag,
  FolderKanban,
  Gauge,
  Layers,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Users,
  UserPlus,
  X,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Background, type Edge, type Node, ReactFlow } from 'reactflow'
import 'reactflow/dist/style.css'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { fetchProjects as fetchProjectsApi, TECTONA_PROJECT_APP_ID } from '@/lib/api/projectApi'
import type { ProjectApi } from '@/lib/api/projectApi'
import { cn } from '@/lib/utils'

type ProjectType = 'Agile' | 'Waterfall' | 'Hybrid'
type ProjectStatus = 'Active' | 'Completed' | 'Delayed' | 'On Hold'
type ProjectHealth = 'Healthy' | 'Watchlist' | 'At Risk'
type GovernanceStage = 'Initiate' | 'Plan' | 'Execute' | 'Monitor' | 'Close'
type Availability = 'Available' | 'Partial' | 'Fully Allocated'

type ProjectRecord = {
  id: string
  name: string
  code: string
  workspace: string
  type: ProjectType
  template: string
  owner: string
  teamSize: number
  progress: number
  status: ProjectStatus
  health: ProjectHealth
  startDate: string
  endDate: string
  lastUpdated: string
  lifecycle: GovernanceStage
  milestones: {
    upcoming: number
    overdue: number
    completed: number
    total: number
    completionRate: number
  }
  governance: {
    approvalStatus: 'Approved' | 'Pending' | 'Blocked'
    policyCompliance: 'Compliant' | 'Needs Review' | 'Non-Compliant'
    auditReadiness: 'Ready' | 'In Progress' | 'Not Ready'
    stageGate: 'Pass' | 'Conditional' | 'Fail'
  }
  issues: number
  blockers: number
  settingsCustomFields: number
  varianceDays: number
}

type TeamMemberRecord = {
  id: string
  name: string
  role: string
  allocation: number
  workload: string
  availability: Availability
}

type ArtifactRecord = {
  id: string
  name: string
  type: 'Document' | 'Template' | 'Meeting Note' | 'Linked Asset'
  owner: string
  version: string
  lastModified: string
}

type ActivityRecord = {
  id: string
  timestamp: string
  actor: string
  action: 'Project created' | 'Milestone updated' | 'Team member added' | 'Health changed' | 'Governance submitted' | 'Document uploaded'
  target: string
}

type MilestoneItem = {
  id: string
  projectCode: string
  name: string
  dueDate: string
  status: 'Upcoming' | 'Overdue' | 'Completed'
  progress: number
}

type SortDirection = 'asc' | 'desc' | null
type SortKey = keyof Pick<ProjectRecord, 'name' | 'code' | 'workspace' | 'type' | 'owner' | 'teamSize' | 'progress' | 'status' | 'health' | 'startDate' | 'endDate' | 'lastUpdated'>

const PROJECTS: ProjectRecord[] = [
  {
    id: 'prj-001',
    name: 'Omni Channel Core Modernization',
    code: 'PM-OC-001',
    workspace: 'Digital Banking Portfolio',
    type: 'Hybrid',
    template: 'Enterprise Hybrid Delivery',
    owner: 'Maya Henderson',
    teamSize: 24,
    progress: 68,
    status: 'Active',
    health: 'Watchlist',
    startDate: '2026-01-12',
    endDate: '2026-08-30',
    lastUpdated: '2026-04-09T10:45:00Z',
    lifecycle: 'Execute',
    milestones: { upcoming: 2, overdue: 1, completed: 6, total: 9, completionRate: 67 },
    governance: {
      approvalStatus: 'Approved',
      policyCompliance: 'Compliant',
      auditReadiness: 'In Progress',
      stageGate: 'Conditional',
    },
    issues: 9,
    blockers: 2,
    settingsCustomFields: 6,
    varianceDays: 4,
  },
  {
    id: 'prj-002',
    name: 'Enterprise Risk Data Mart',
    code: 'PM-RD-014',
    workspace: 'Risk & Compliance Office',
    type: 'Waterfall',
    template: 'Regulatory Program Template',
    owner: 'Dario Gomez',
    teamSize: 17,
    progress: 83,
    status: 'Active',
    health: 'Healthy',
    startDate: '2025-11-03',
    endDate: '2026-06-28',
    lastUpdated: '2026-04-08T16:20:00Z',
    lifecycle: 'Monitor',
    milestones: { upcoming: 1, overdue: 0, completed: 7, total: 8, completionRate: 88 },
    governance: {
      approvalStatus: 'Approved',
      policyCompliance: 'Compliant',
      auditReadiness: 'Ready',
      stageGate: 'Pass',
    },
    issues: 3,
    blockers: 0,
    settingsCustomFields: 9,
    varianceDays: -2,
  },
  {
    id: 'prj-003',
    name: 'Loan Origination Revamp',
    code: 'PM-LO-029',
    workspace: 'Lending Transformation',
    type: 'Agile',
    template: 'Scaled Agile Program',
    owner: 'Aiko Fernandez',
    teamSize: 31,
    progress: 41,
    status: 'Delayed',
    health: 'At Risk',
    startDate: '2026-02-05',
    endDate: '2026-12-12',
    lastUpdated: '2026-04-09T07:55:00Z',
    lifecycle: 'Execute',
    milestones: { upcoming: 3, overdue: 2, completed: 3, total: 8, completionRate: 38 },
    governance: {
      approvalStatus: 'Pending',
      policyCompliance: 'Needs Review',
      auditReadiness: 'In Progress',
      stageGate: 'Conditional',
    },
    issues: 14,
    blockers: 5,
    settingsCustomFields: 7,
    varianceDays: 12,
  },
  {
    id: 'prj-004',
    name: 'Treasury Reporting Factory',
    code: 'PM-TR-004',
    workspace: 'Finance Platform',
    type: 'Hybrid',
    template: 'Regulated Product Delivery',
    owner: 'Nadia Clark',
    teamSize: 14,
    progress: 100,
    status: 'Completed',
    health: 'Healthy',
    startDate: '2025-06-11',
    endDate: '2026-03-14',
    lastUpdated: '2026-03-15T12:10:00Z',
    lifecycle: 'Close',
    milestones: { upcoming: 0, overdue: 0, completed: 11, total: 11, completionRate: 100 },
    governance: {
      approvalStatus: 'Approved',
      policyCompliance: 'Compliant',
      auditReadiness: 'Ready',
      stageGate: 'Pass',
    },
    issues: 1,
    blockers: 0,
    settingsCustomFields: 5,
    varianceDays: -5,
  },
  {
    id: 'prj-005',
    name: 'Customer 360 Delivery Program',
    code: 'PM-CX-113',
    workspace: 'Customer Experience Office',
    type: 'Agile',
    template: 'Product Discovery to Delivery',
    owner: 'Luca Meyer',
    teamSize: 19,
    progress: 52,
    status: 'Active',
    health: 'Watchlist',
    startDate: '2026-01-29',
    endDate: '2026-10-20',
    lastUpdated: '2026-04-08T09:05:00Z',
    lifecycle: 'Execute',
    milestones: { upcoming: 2, overdue: 1, completed: 4, total: 7, completionRate: 57 },
    governance: {
      approvalStatus: 'Approved',
      policyCompliance: 'Needs Review',
      auditReadiness: 'In Progress',
      stageGate: 'Conditional',
    },
    issues: 8,
    blockers: 1,
    settingsCustomFields: 8,
    varianceDays: 7,
  },
  {
    id: 'prj-006',
    name: 'Branch Ops Mobility Upgrade',
    code: 'PM-BO-052',
    workspace: 'Operations PMO',
    type: 'Waterfall',
    template: 'Infrastructure Rollout Template',
    owner: 'Elena Park',
    teamSize: 11,
    progress: 29,
    status: 'On Hold',
    health: 'Watchlist',
    startDate: '2026-02-18',
    endDate: '2026-09-27',
    lastUpdated: '2026-04-07T15:41:00Z',
    lifecycle: 'Plan',
    milestones: { upcoming: 2, overdue: 1, completed: 2, total: 5, completionRate: 40 },
    governance: {
      approvalStatus: 'Pending',
      policyCompliance: 'Compliant',
      auditReadiness: 'Not Ready',
      stageGate: 'Fail',
    },
    issues: 6,
    blockers: 2,
    settingsCustomFields: 4,
    varianceDays: 9,
  },
]

const MILESTONES: MilestoneItem[] = [
  { id: 'ms-1', projectCode: 'PM-OC-001', name: 'Execution Gate 2', dueDate: '2026-04-16', status: 'Upcoming', progress: 72 },
  { id: 'ms-2', projectCode: 'PM-LO-029', name: 'MVP Integration Cutover', dueDate: '2026-04-10', status: 'Overdue', progress: 63 },
  { id: 'ms-3', projectCode: 'PM-RD-014', name: 'Audit Data Certification', dueDate: '2026-04-18', status: 'Upcoming', progress: 84 },
  { id: 'ms-4', projectCode: 'PM-TR-004', name: 'Hypercare Closure', dueDate: '2026-03-10', status: 'Completed', progress: 100 },
  { id: 'ms-5', projectCode: 'PM-CX-113', name: 'Sprint 8 Release', dueDate: '2026-04-15', status: 'Upcoming', progress: 58 },
  { id: 'ms-6', projectCode: 'PM-BO-052', name: 'Vendor Readiness Approval', dueDate: '2026-04-06', status: 'Overdue', progress: 45 },
]

const TEAM_MEMBERS: TeamMemberRecord[] = [
  { id: 'tm-1', name: 'Maya Henderson', role: 'Program Director', allocation: 90, workload: '7 projects', availability: 'Partial' },
  { id: 'tm-2', name: 'Luca Meyer', role: 'Project Manager', allocation: 82, workload: '5 projects', availability: 'Partial' },
  { id: 'tm-3', name: 'Arman Voss', role: 'Scrum Master', allocation: 70, workload: '3 squads', availability: 'Available' },
  { id: 'tm-4', name: 'Grace Lin', role: 'Business Analyst', allocation: 100, workload: '4 projects', availability: 'Fully Allocated' },
  { id: 'tm-5', name: 'Dario Gomez', role: 'Delivery Lead', allocation: 76, workload: '4 projects', availability: 'Partial' },
  { id: 'tm-6', name: 'Nadia Clark', role: 'PMO Analyst', allocation: 62, workload: 'Portfolio support', availability: 'Available' },
]

const ARTIFACTS: ArtifactRecord[] = [
  { id: 'ar-1', name: 'Project Charter - Omni Channel Core', type: 'Document', owner: 'Maya Henderson', version: 'v1.8', lastModified: '2026-04-08' },
  { id: 'ar-2', name: 'Regulatory Rollout Template', type: 'Template', owner: 'PMO Office', version: 'v3.1', lastModified: '2026-04-03' },
  { id: 'ar-3', name: 'Steering Committee Minutes Week 14', type: 'Meeting Note', owner: 'Nadia Clark', version: 'v1.2', lastModified: '2026-04-09' },
  { id: 'ar-4', name: 'Architecture Dependency Map', type: 'Linked Asset', owner: 'Enterprise Architecture', version: 'v2.0', lastModified: '2026-04-07' },
]

const ACTIVITY_FEED: ActivityRecord[] = [
  { id: 'ac-1', timestamp: '2026-04-09 10:45', actor: 'Maya Henderson', action: 'Milestone updated', target: 'PM-OC-001 / Execution Gate 2' },
  { id: 'ac-2', timestamp: '2026-04-09 09:35', actor: 'Luca Meyer', action: 'Governance submitted', target: 'PM-CX-113 / Stage Gate' },
  { id: 'ac-3', timestamp: '2026-04-09 08:12', actor: 'Arman Voss', action: 'Team member added', target: 'PM-LO-029 / Squad Delta' },
  { id: 'ac-4', timestamp: '2026-04-08 18:08', actor: 'Grace Lin', action: 'Health changed', target: 'PM-LO-029 / Schedule health' },
  { id: 'ac-5', timestamp: '2026-04-08 16:20', actor: 'Dario Gomez', action: 'Document uploaded', target: 'PM-RD-014 / Audit Control Matrix' },
  { id: 'ac-6', timestamp: '2026-04-08 15:11', actor: 'System', action: 'Project created', target: 'PM-BO-052 / Branch Ops Mobility Upgrade' },
]

const PAGE_SIZE_OPTIONS = [5, 8, 10]

const STATUS_COLOR: Record<ProjectStatus, string> = {
  Active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Completed: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  Delayed: 'bg-amber-100 text-amber-700 border-amber-200',
  'On Hold': 'bg-slate-100 text-slate-700 border-slate-200',
}

const HEALTH_COLOR: Record<ProjectHealth, string> = {
  Healthy: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Watchlist: 'bg-amber-100 text-amber-700 border-amber-200',
  'At Risk': 'bg-rose-100 text-rose-700 border-rose-200',
}

const AVAILABILITY_COLOR: Record<Availability, string> = {
  Available: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Partial: 'bg-amber-100 text-amber-700 border-amber-200',
  'Fully Allocated': 'bg-rose-100 text-rose-700 border-rose-200',
}

function renderSortIcon(active: boolean, direction: SortDirection) {
  if (!active || !direction) {
    return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
  }

  return direction === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
}

function compareValues(a: string | number, b: string | number, direction: Exclude<SortDirection, null>) {
  if (typeof a === 'number' && typeof b === 'number') {
    return direction === 'asc' ? a - b : b - a
  }

  const cmp = String(a).localeCompare(String(b))
  return direction === 'asc' ? cmp : -cmp
}

function toDateLabel(value: string) {
  return new Date(value).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

function hashNumber(input: string) {
  return Array.from(input).reduce((acc, char) => acc + char.charCodeAt(0), 0)
}

function mapStatus(statusCode: string): ProjectStatus {
  const normalized = statusCode.trim().toLowerCase()
  if (normalized === 'archived') return 'Completed'
  if (normalized === 'delayed') return 'Delayed'
  if (normalized === 'on_hold' || normalized === 'on hold') return 'On Hold'
  return 'Active'
}

function mapType(tags: string[]): ProjectType {
  const normalizedTags = tags.map((tag) => tag.trim().toLowerCase())
  if (normalizedTags.some((tag) => tag.includes('agile'))) return 'Agile'
  if (normalizedTags.some((tag) => tag.includes('waterfall'))) return 'Waterfall'
  return 'Hybrid'
}

function mapProjectApiToRecord(project: ProjectApi): ProjectRecord {
  const status = mapStatus(project.status_code)
  const type = mapType(project.tags)
  const baseHash = hashNumber(project.id)
  const progress =
    status === 'Completed'
      ? 100
      : Math.max(18, Math.min(94, 30 + (baseHash % 55)))

  const health: ProjectHealth =
    status === 'Delayed' ? 'At Risk' : progress < 45 ? 'Watchlist' : 'Healthy'

  const lifecycle: GovernanceStage =
    progress >= 95
      ? 'Close'
      : progress >= 70
      ? 'Monitor'
      : progress >= 40
      ? 'Execute'
      : progress >= 20
      ? 'Plan'
      : 'Initiate'

  const totalMilestones = 5 + (baseHash % 6)
  const completedMilestones = Math.min(totalMilestones, Math.floor((progress / 100) * totalMilestones))
  const overdueMilestones = status === 'Delayed' ? 1 + (baseHash % 2) : 0
  const upcomingMilestones = Math.max(totalMilestones - completedMilestones - overdueMilestones, 0)

  return {
    id: project.id,
    name: project.name,
    code: `PM-${project.id.slice(0, 8).toUpperCase()}`,
    workspace: project.folder_name ?? 'Unassigned Workspace',
    type,
    template: `${type} Delivery Template`,
    owner: project.owner_name,
    teamSize: project.members.length || 1,
    progress,
    status,
    health,
    startDate: project.created_date,
    endDate: project.updated_date ?? project.created_date,
    lastUpdated: project.updated_date ?? project.created_date,
    lifecycle,
    milestones: {
      upcoming: upcomingMilestones,
      overdue: overdueMilestones,
      completed: completedMilestones,
      total: totalMilestones,
      completionRate: Math.round((completedMilestones / Math.max(totalMilestones, 1)) * 100),
    },
    governance: {
      approvalStatus: status === 'On Hold' ? 'Pending' : 'Approved',
      policyCompliance: status === 'Delayed' ? 'Needs Review' : 'Compliant',
      auditReadiness: progress >= 75 ? 'Ready' : 'In Progress',
      stageGate: status === 'Delayed' ? 'Conditional' : 'Pass',
    },
    issues: status === 'Delayed' ? 5 + (baseHash % 8) : 1 + (baseHash % 4),
    blockers: status === 'Delayed' ? 1 + (baseHash % 3) : baseHash % 2,
    settingsCustomFields: 4 + (baseHash % 6),
    varianceDays: status === 'Delayed' ? 3 + (baseHash % 9) : -1 * (baseHash % 4),
  }
}

const LIFECYCLE_NODES: Node[] = [
  { id: 'initiate', position: { x: 0, y: 30 }, data: { label: 'Initiate' }, style: { borderRadius: 10, border: '1px solid #cbd5e1', background: '#ffffff', width: 120, fontSize: 12 } },
  { id: 'plan', position: { x: 140, y: 30 }, data: { label: 'Plan' }, style: { borderRadius: 10, border: '1px solid #cbd5e1', background: '#ffffff', width: 120, fontSize: 12 } },
  { id: 'execute', position: { x: 280, y: 30 }, data: { label: 'Execute' }, style: { borderRadius: 10, border: '1px solid #60a5fa', background: '#eff6ff', width: 120, fontSize: 12, fontWeight: 700 } },
  { id: 'monitor', position: { x: 420, y: 30 }, data: { label: 'Monitor' }, style: { borderRadius: 10, border: '1px solid #cbd5e1', background: '#ffffff', width: 120, fontSize: 12 } },
  { id: 'close', position: { x: 560, y: 30 }, data: { label: 'Close' }, style: { borderRadius: 10, border: '1px solid #cbd5e1', background: '#ffffff', width: 120, fontSize: 12 } },
]

const LIFECYCLE_EDGES: Edge[] = [
  { id: 'e1', source: 'initiate', target: 'plan', animated: false, style: { stroke: '#94a3b8' } },
  { id: 'e2', source: 'plan', target: 'execute', animated: true, style: { stroke: '#3b82f6' } },
  { id: 'e3', source: 'execute', target: 'monitor', animated: false, style: { stroke: '#94a3b8' } },
  { id: 'e4', source: 'monitor', target: 'close', animated: false, style: { stroke: '#94a3b8' } },
]

export function ProjectManagementPage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [projectData, setProjectData] = useState<ProjectRecord[]>(PROJECTS)
  const [showFilters, setShowFilters] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all')
  const [workspaceFilter, setWorkspaceFilter] = useState<'all' | string>('all')
  const [selectedTypes, setSelectedTypes] = useState<ProjectType[]>(['Agile', 'Waterfall', 'Hybrid'])
  const [sortKey, setSortKey] = useState<SortKey>('lastUpdated')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeProject, setActiveProject] = useState<ProjectRecord | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadProjects = async () => {
      setLoading(true)
      setLoadError(null)

      try {
        const response = await fetchProjectsApi({
          page: 1,
          page_size: 200,
          app_id: TECTONA_PROJECT_APP_ID,
        })

        if (!isMounted) return

        const mapped = response.projects.map(mapProjectApiToRecord)
        setProjectData(mapped.length > 0 ? mapped : PROJECTS)
      } catch (error) {
        if (!isMounted) return
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to connect to Project Service. Using fallback data.'
        setLoadError(message)
        setProjectData(PROJECTS)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadProjects()

    return () => {
      isMounted = false
    }
  }, [])

  const workspaces = useMemo(() => Array.from(new Set(projectData.map((project) => project.workspace))), [projectData])

  const metrics = useMemo(() => {
    const totalProjects = projectData.length
    const activeProjects = projectData.filter((project) => project.status === 'Active').length
    const completedProjects = projectData.filter((project) => project.status === 'Completed').length
    const delayedProjects = projectData.filter((project) => project.status === 'Delayed').length
    const atRiskProjects = projectData.filter((project) => project.health === 'At Risk').length
    const totalMilestones = projectData.reduce((acc, project) => acc + project.milestones.total, 0)

    return {
      totalProjects,
      activeProjects,
      completedProjects,
      delayedProjects,
      atRiskProjects,
      totalMilestones,
    }
  }, [projectData])

  const deliveryHealth = useMemo(() => {
    const healthWeight: Record<ProjectHealth, number> = { Healthy: 100, Watchlist: 72, 'At Risk': 45 }
    const score = Math.round(
      projectData.reduce((acc, project) => acc + healthWeight[project.health], 0) / Math.max(projectData.length, 1)
    )

    const scheduleHealth = Math.max(0, 100 - Math.round(projectData.reduce((acc, project) => acc + Math.max(project.varianceDays, 0), 0) / Math.max(projectData.length, 1) * 2))
    const scopeHealth = 86
    const resourceHealth = Math.round(
      100 - TEAM_MEMBERS.reduce((acc, member) => acc + Math.max(member.allocation - 80, 0), 0) / TEAM_MEMBERS.length
    )

    return {
      score,
      scheduleHealth,
      scopeHealth,
      resourceHealth,
    }
  }, [projectData])

  const typeDistribution = useMemo(() => {
    const base: Record<ProjectType, number> = { Agile: 0, Waterfall: 0, Hybrid: 0 }
    projectData.forEach((project) => {
      base[project.type] += 1
    })

    return [
      { name: 'Agile', value: base.Agile, color: '#0ea5e9' },
      { name: 'Waterfall', value: base.Waterfall, color: '#334155' },
      { name: 'Hybrid', value: base.Hybrid, color: '#3b82f6' },
    ]
  }, [projectData])

  const milestoneSummary = useMemo(() => {
    const upcoming = MILESTONES.filter((milestone) => milestone.status === 'Upcoming').length
    const overdue = MILESTONES.filter((milestone) => milestone.status === 'Overdue').length
    const completed = MILESTONES.filter((milestone) => milestone.status === 'Completed').length
    const completionRate = Math.round((completed / Math.max(MILESTONES.length, 1)) * 100)

    return { upcoming, overdue, completed, completionRate }
  }, [])

  const riskDistribution = [
    { label: 'Low', value: 43, color: '#16a34a' },
    { label: 'Medium', value: 36, color: '#f59e0b' },
    { label: 'High', value: 21, color: '#ef4444' },
  ]

  const timelineSeries = [
    { month: 'Jan', planned: 14, actual: 12 },
    { month: 'Feb', planned: 24, actual: 21 },
    { month: 'Mar', planned: 37, actual: 33 },
    { month: 'Apr', planned: 52, actual: 45 },
    { month: 'May', planned: 67, actual: 58 },
    { month: 'Jun', planned: 78, actual: 71 },
  ]

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase()

    return projectData.filter((project) => {
      const matchesSearch =
        query.length === 0 ||
        project.name.toLowerCase().includes(query) ||
        project.code.toLowerCase().includes(query) ||
        project.owner.toLowerCase().includes(query)

      const matchesStatus = statusFilter === 'all' || project.status === statusFilter
      const matchesWorkspace = workspaceFilter === 'all' || project.workspace === workspaceFilter
      const matchesType = selectedTypes.includes(project.type)

      return matchesSearch && matchesStatus && matchesWorkspace && matchesType
    })
  }, [projectData, search, selectedTypes, statusFilter, workspaceFilter])

  const sortedProjects = useMemo(() => {
    const list = [...filteredProjects]
    if (!sortDirection) {
      return list
    }

    return list.sort((a, b) => {
      if (sortKey === 'lastUpdated') {
        return compareValues(new Date(a.lastUpdated).getTime(), new Date(b.lastUpdated).getTime(), sortDirection)
      }

      if (sortKey === 'startDate' || sortKey === 'endDate') {
        return compareValues(new Date(a[sortKey]).getTime(), new Date(b[sortKey]).getTime(), sortDirection)
      }

      return compareValues(a[sortKey] as string | number, b[sortKey] as string | number, sortDirection)
    })
  }, [filteredProjects, sortDirection, sortKey])

  const totalPages = Math.max(1, Math.ceil(sortedProjects.length / pageSize))

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const pagedProjects = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedProjects.slice(start, start + pageSize)
  }, [page, pageSize, sortedProjects])

  const allVisibleSelected = pagedProjects.length > 0 && pagedProjects.every((project) => selectedIds.includes(project.id))

  const selectedRows = useMemo(() => projectData.filter((project) => selectedIds.includes(project.id)), [projectData, selectedIds])

  const teamSummary = useMemo(() => {
    const totalMembers = TEAM_MEMBERS.length
    const assignedRoles = Array.from(new Set(TEAM_MEMBERS.map((member) => member.role))).length
    const capacityUsage = Math.round(TEAM_MEMBERS.reduce((acc, member) => acc + member.allocation, 0) / totalMembers)
    const availableMembers = TEAM_MEMBERS.filter((member) => member.availability !== 'Fully Allocated').length

    return {
      totalMembers,
      assignedRoles,
      capacityUsage,
      availableMembers,
    }
  }, [])

  const handleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDirection('asc')
      return
    }

    if (sortDirection === 'asc') {
      setSortDirection('desc')
      return
    }

    if (sortDirection === 'desc') {
      setSortDirection(null)
      return
    }

    setSortDirection('asc')
  }

  const toggleTypeChip = (type: ProjectType) => {
    setSelectedTypes((current) => {
      const exists = current.includes(type)
      const next = exists ? current.filter((item) => item !== type) : [...current, type]
      if (next.length === 0) {
        return ['Agile', 'Waterfall', 'Hybrid']
      }
      return next
    })
  }

  const handleSelectVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !pagedProjects.some((project) => project.id === id)))
      return
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...pagedProjects.map((project) => project.id)])))
  }

  const handleRowSelect = (projectId: string) => {
    setSelectedIds((current) =>
      current.includes(projectId) ? current.filter((id) => id !== projectId) : [...current, projectId]
    )
  }

  const openProjectDrawer = (project: ProjectRecord) => {
    setActiveProject(project)
    setDrawerOpen(true)
  }

  return (
    <div className="space-y-6 pb-10">
      <Breadcrumb items={[{ label: 'Project Management' }]} />

      <PageHeader
        title="Project Management"
        description="Execution control center for project creation, delivery tracking, milestones, team operations, governance, and reporting visibility."
        right={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className={cn('h-10 px-3 text-xs', showFilters && 'border-primary/40 bg-primary/5')}
              onClick={() => setShowFilters((value) => !value)}
              aria-label={showFilters ? 'Hide project filters' : 'Show project filters'}
              title={showFilters ? 'Hide project filters' : 'Show project filters'}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? 'Hide filters' : 'Show filters'}
            </Button>
            <Button variant="outline" className="h-10 px-3 text-xs" aria-label="Export project list" title="Export project list">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button className="h-10 px-3 text-xs">
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </div>
        }
      />

      {loadError && (
        <Card className="border-amber-200 bg-amber-50/80">
          <CardContent className="p-3 flex items-start gap-2 text-amber-800">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div className="text-xs">
              <div className="font-semibold">Project Service fallback mode</div>
              <div>{loadError}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {showFilters && (
        <Card className="liquid-glass-enterprise-panel rounded-2xl border-white/40 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Search & Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
              <div className="xl:col-span-5 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  className="h-10 pl-9 w-full"
                  placeholder="Search project name, code, or owner"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="xl:col-span-3">
                <Select className="h-10 text-xs" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | ProjectStatus)}>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Delayed">Delayed</SelectItem>
                  <SelectItem value="On Hold">On Hold</SelectItem>
                </Select>
              </div>
              <div className="xl:col-span-3">
                <Select className="h-10 text-xs" value={workspaceFilter} onChange={(event) => setWorkspaceFilter(event.target.value)}>
                  <SelectItem value="all">All workspaces</SelectItem>
                  {workspaces.map((workspace) => (
                    <SelectItem key={workspace} value={workspace}>{workspace}</SelectItem>
                  ))}
                </Select>
              </div>
              <div className="xl:col-span-1">
                <Button
                  variant="outline"
                  className="h-10 w-full text-xs"
                  onClick={() => {
                    setSearch('')
                    setStatusFilter('all')
                    setWorkspaceFilter('all')
                    setSelectedTypes(['Agile', 'Waterfall', 'Hybrid'])
                    setPage(1)
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(['Agile', 'Waterfall', 'Hybrid'] as ProjectType[]).map((type) => {
                const count = projectData.filter((project) => project.type === type).length
                const selected = selectedTypes.includes(type)

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleTypeChip(type)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                      selected
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span>{type}</span>
                    <span className="tabular-nums rounded-full bg-muted px-1.5">{count}</span>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <section className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          {[
            { label: 'Total Projects', value: metrics.totalProjects, icon: FolderKanban, subtitle: 'Execution units' },
            { label: 'Active Projects', value: metrics.activeProjects, icon: CheckCircle2, subtitle: 'In-flight delivery' },
            { label: 'Completed Projects', value: metrics.completedProjects, icon: Gauge, subtitle: 'Closed successfully' },
            { label: 'Delayed Projects', value: metrics.delayedProjects, icon: Clock3, subtitle: 'Schedule variance' },
            { label: 'At-Risk Projects', value: metrics.atRiskProjects, icon: AlertTriangle, subtitle: 'Needs intervention' },
            { label: 'Total Milestones', value: metrics.totalMilestones, icon: Flag, subtitle: 'Tracked checkpoints' },
          ].map((item) => (
            <Card key={item.label} className="liquid-glass-enterprise-panel relative overflow-hidden rounded-2xl border-white/50">
              <CardContent className="p-4">
                {loading ? (
                  <div className="space-y-2">
                    <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                    <div className="h-6 w-14 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-muted-foreground">{item.label}</div>
                    <div className="mt-1 text-2xl font-bold text-foreground">{item.value}</div>
                    <div className="mt-2 text-[11px] text-muted-foreground">{item.subtitle}</div>
                    <item.icon className="absolute -right-2 -bottom-2 h-14 w-14 text-slate-400/15" />
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="liquid-glass-enterprise-panel rounded-2xl border-white/50 xl:col-span-1">
            <CardHeader>
              <CardTitle className="text-sm">Delivery Health Summary</CardTitle>
              <CardDescription>Overall execution pulse across portfolio</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="liquid-glass-enterprise-panel rounded-xl border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">Overall health score</div>
                <div className="text-2xl font-semibold mt-1">{deliveryHealth.score}%</div>
                <div className="mt-2 h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500" style={{ width: `${deliveryHealth.score}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-border/60 p-2">
                  <div className="text-[11px] text-muted-foreground">Schedule</div>
                  <div className="text-sm font-semibold text-cyan-600">{deliveryHealth.scheduleHealth}%</div>
                </div>
                <div className="rounded-lg border border-border/60 p-2">
                  <div className="text-[11px] text-muted-foreground">Scope</div>
                  <div className="text-sm font-semibold text-emerald-600">{deliveryHealth.scopeHealth}%</div>
                </div>
                <div className="rounded-lg border border-border/60 p-2">
                  <div className="text-[11px] text-muted-foreground">Resource</div>
                  <div className="text-sm font-semibold text-amber-600">{deliveryHealth.resourceHealth}%</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="liquid-glass-enterprise-panel rounded-2xl border-white/50 xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm">Project Distribution</CardTitle>
              <CardDescription>Distribution by project type</CardDescription>
            </CardHeader>
            <CardContent className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeDistribution} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <RechartsTooltip cursor={{ fill: 'rgba(2,6,23,0.03)' }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {typeDistribution.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Project Directory</h2>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{selectedIds.length} selected</span>
            <Button variant="outline" className="h-7 px-2 text-[11px]" disabled={selectedIds.length === 0}>
              Bulk change status
            </Button>
            <Button variant="outline" className="h-7 px-2 text-[11px]" disabled={selectedIds.length === 0}>
              Bulk update owner
            </Button>
          </div>
        </div>

        <Card className="liquid-glass-enterprise-panel rounded-2xl border-white/50">
          <CardContent className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1460px] text-xs">
                <thead className="bg-white/90 backdrop-blur border-b border-border/60 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left">
                      <input type="checkbox" checked={allVisibleSelected} onChange={handleSelectVisible} className="h-3.5 w-3.5 rounded border-border" />
                    </th>
                    {[
                      { key: 'name', label: 'Project name' },
                      { key: 'code', label: 'Code' },
                      { key: 'workspace', label: 'Workspace' },
                      { key: 'type', label: 'Type' },
                      { key: 'owner', label: 'Owner / PM' },
                      { key: 'teamSize', label: 'Team size' },
                      { key: 'progress', label: 'Progress' },
                      { key: 'status', label: 'Status' },
                      { key: 'health', label: 'Health' },
                      { key: 'startDate', label: 'Start date' },
                      { key: 'endDate', label: 'End date' },
                      { key: 'lastUpdated', label: 'Last updated' },
                    ].map((column) => (
                      <th key={column.key} className="px-3 py-2.5 text-left">
                        <button
                          type="button"
                          onClick={() => handleSort(column.key as SortKey)}
                          className="inline-flex items-center gap-1.5 hover:text-foreground"
                        >
                          <span>{column.label}</span>
                          {renderSortIcon(sortKey === column.key, sortKey === column.key ? sortDirection : null)}
                        </button>
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading &&
                    Array.from({ length: 6 }).map((_, idx) => (
                      <tr key={`sk-${idx}`} className="border-b border-border/50">
                        {Array.from({ length: 14 }).map((__, cidx) => (
                          <td key={cidx} className="px-3 py-3">
                            <div className="h-3 w-full rounded bg-muted animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))}

                  {!loading && pagedProjects.length === 0 && (
                    <tr>
                      <td colSpan={14} className="px-3 py-10 text-center">
                        <div className="inline-flex flex-col items-center gap-2 text-muted-foreground">
                          <FileStack className="h-8 w-8 opacity-50" />
                          <p className="text-xs">No projects matched these filters.</p>
                          <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => {
                            setSearch('')
                            setStatusFilter('all')
                            setWorkspaceFilter('all')
                            setSelectedTypes(['Agile', 'Waterfall', 'Hybrid'])
                          }}>
                            Clear filters
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    pagedProjects.map((project) => {
                      const rowSelected = selectedIds.includes(project.id)
                      return (
                        <tr
                          key={project.id}
                          className={cn(
                            'border-b border-border/50 hover:bg-primary/5 cursor-pointer transition-colors',
                            rowSelected && 'bg-primary/5'
                          )}
                          onClick={() => openProjectDrawer(project)}
                        >
                          <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={rowSelected}
                              onChange={() => handleRowSelect(project.id)}
                              className="h-3.5 w-3.5 rounded border-border"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-medium text-foreground">{project.name}</div>
                            <div className="text-[11px] text-muted-foreground">Template: {project.template}</div>
                          </td>
                          <td className="px-3 py-3">{project.code}</td>
                          <td className="px-3 py-3">{project.workspace}</td>
                          <td className="px-3 py-3"><Badge className="border bg-slate-100 text-slate-700">{project.type}</Badge></td>
                          <td className="px-3 py-3">{project.owner}</td>
                          <td className="px-3 py-3">{project.teamSize}</td>
                          <td className="px-3 py-3">
                            <div className="w-24">
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                <span>{project.progress}%</span>
                              </div>
                              <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${project.progress}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3"><Badge className={cn('border', STATUS_COLOR[project.status])}>{project.status}</Badge></td>
                          <td className="px-3 py-3"><Badge className={cn('border', HEALTH_COLOR[project.health])}>{project.health}</Badge></td>
                          <td className="px-3 py-3">{toDateLabel(project.startDate)}</td>
                          <td className="px-3 py-3">{toDateLabel(project.endDate)}</td>
                          <td className="px-3 py-3">{toDateLabel(project.lastUpdated)}</td>
                          <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-7 w-7 p-0" aria-label={`Actions for ${project.name}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => openProjectDrawer(project)}><Eye className="h-4 w-4" />Open</DropdownMenuItem>
                                <DropdownMenuItem><Edit className="h-4 w-4" />Edit</DropdownMenuItem>
                                <DropdownMenuItem><Users className="h-4 w-4" />Manage Team</DropdownMenuItem>
                                <DropdownMenuItem><CalendarClock className="h-4 w-4" />View Timeline</DropdownMenuItem>
                                <DropdownMenuItem className="text-amber-700"><Archive className="h-4 w-4" />Archive</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-3 py-3 border-t border-border/50">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Rows</span>
                <Select
                  className="h-9 w-[84px] text-xs"
                  value={String(pageSize)}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value))
                    setPage(1)
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((value) => (
                    <SelectItem key={value} value={String(value)}>{String(value)}</SelectItem>
                  ))}
                </Select>
                <span className="text-muted-foreground">
                  {sortedProjects.length === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, sortedProjects.length)} of {sortedProjects.length}
                </span>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-border/60 p-1">
                <Button variant="ghost" className="h-8 px-2" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  Previous
                </Button>
                <Button variant="ghost" className="h-8 px-2" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Card className="liquid-glass-enterprise-panel rounded-2xl border-white/50 xl:col-span-6">
          <CardHeader>
            <CardTitle className="text-sm">Milestone & Delivery Tracking</CardTitle>
            <CardDescription>Upcoming, overdue, and completed milestones across projects</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
              <div className="rounded-lg border border-border/60 p-2">
                <div className="text-[11px] text-muted-foreground">Upcoming</div>
                <div className="text-base font-semibold text-cyan-600">{milestoneSummary.upcoming}</div>
              </div>
              <div className="rounded-lg border border-border/60 p-2">
                <div className="text-[11px] text-muted-foreground">Overdue</div>
                <div className="text-base font-semibold text-rose-600">{milestoneSummary.overdue}</div>
              </div>
              <div className="rounded-lg border border-border/60 p-2">
                <div className="text-[11px] text-muted-foreground">Completed</div>
                <div className="text-base font-semibold text-emerald-600">{milestoneSummary.completed}</div>
              </div>
              <div className="rounded-lg border border-border/60 p-2">
                <div className="text-[11px] text-muted-foreground">Completion rate</div>
                <div className="text-base font-semibold text-blue-600">{milestoneSummary.completionRate}%</div>
              </div>
            </div>

            <div className="space-y-2">
              {MILESTONES.map((milestone) => (
                <div key={milestone.id} className="liquid-glass-enterprise-panel rounded-xl border border-border/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-foreground">{milestone.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{milestone.projectCode} • Due {toDateLabel(milestone.dueDate)}</div>
                    </div>
                    <Badge className={cn('border', milestone.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : milestone.status === 'Overdue' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-cyan-100 text-cyan-700 border-cyan-200')}>
                      {milestone.status}
                    </Badge>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${milestone.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button className="h-8 px-3 text-xs"><Plus className="h-4 w-4 mr-2" />Add Milestone</Button>
              <Button variant="outline" className="h-8 px-3 text-xs">Update Progress</Button>
              <Button variant="outline" className="h-8 px-3 text-xs">View Timeline</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="liquid-glass-enterprise-panel rounded-2xl border-white/50 xl:col-span-6">
          <CardHeader>
            <CardTitle className="text-sm">Project Health & Risk</CardTitle>
            <CardDescription>Risk posture, issue volume, and delivery health indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
              <div className="rounded-lg border border-border/60 p-2">
                <div className="text-[11px] text-muted-foreground">Overall</div>
                <div className="text-base font-semibold text-cyan-600">{deliveryHealth.score}%</div>
              </div>
              <div className="rounded-lg border border-border/60 p-2">
                <div className="text-[11px] text-muted-foreground">Schedule</div>
                <div className="text-base font-semibold text-cyan-600">{deliveryHealth.scheduleHealth}%</div>
              </div>
              <div className="rounded-lg border border-border/60 p-2">
                <div className="text-[11px] text-muted-foreground">Scope</div>
                <div className="text-base font-semibold text-emerald-600">{deliveryHealth.scopeHealth}%</div>
              </div>
              <div className="rounded-lg border border-border/60 p-2">
                <div className="text-[11px] text-muted-foreground">Resource</div>
                <div className="text-base font-semibold text-amber-600">{deliveryHealth.resourceHealth}%</div>
              </div>
              <div className="rounded-lg border border-border/60 p-2">
                <div className="text-[11px] text-muted-foreground">Risk level</div>
                <div className="text-base font-semibold text-rose-600">Medium</div>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_150px] gap-3 items-center">
              <div className="space-y-1 text-xs">
                {riskDistribution.map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground">{item.label} risk</span>
                    </div>
                    <span className="font-medium text-foreground">{item.value}%</span>
                  </div>
                ))}
                <div className="pt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border/60 p-2">
                    <div className="text-[11px] text-muted-foreground">Open issues</div>
                    <div className="text-sm font-semibold text-foreground">{projectData.reduce((acc, project) => acc + project.issues, 0)}</div>
                  </div>
                  <div className="rounded-lg border border-border/60 p-2">
                    <div className="text-[11px] text-muted-foreground">Blockers</div>
                    <div className="text-sm font-semibold text-foreground">{projectData.reduce((acc, project) => acc + project.blockers, 0)}</div>
                  </div>
                </div>
              </div>
              <div className="h-[130px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={riskDistribution} dataKey="value" nameKey="label" innerRadius={30} outerRadius={52} paddingAngle={4}>
                      {riskDistribution.map((item) => (
                        <Cell key={item.label} fill={item.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-8 px-3 text-xs">View Risks</Button>
              <Button variant="outline" className="h-8 px-3 text-xs">Log Issue</Button>
              <Button variant="outline" className="h-8 px-3 text-xs">Review Health</Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Card className="liquid-glass-enterprise-panel rounded-2xl border-white/50 xl:col-span-7">
          <CardHeader>
            <CardTitle className="text-sm">Project Team Management</CardTitle>
            <CardDescription>Team composition, role assignment, and capacity control</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
              <div className="rounded-lg border border-border/60 p-2">
                <div className="text-[11px] text-muted-foreground">Total members</div>
                <div className="text-base font-semibold">{teamSummary.totalMembers}</div>
              </div>
              <div className="rounded-lg border border-border/60 p-2">
                <div className="text-[11px] text-muted-foreground">Assigned roles</div>
                <div className="text-base font-semibold">{teamSummary.assignedRoles}</div>
              </div>
              <div className="rounded-lg border border-border/60 p-2">
                <div className="text-[11px] text-muted-foreground">Capacity usage</div>
                <div className="text-base font-semibold text-amber-600">{teamSummary.capacityUsage}%</div>
              </div>
              <div className="rounded-lg border border-border/60 p-2">
                <div className="text-[11px] text-muted-foreground">Availability</div>
                <div className="text-base font-semibold text-cyan-600">{teamSummary.availableMembers} ready</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-xs">
                <thead className="border-b border-border/60 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left">User name</th>
                    <th className="px-2 py-2 text-left">Role</th>
                    <th className="px-2 py-2 text-left">Allocation</th>
                    <th className="px-2 py-2 text-left">Assigned workload</th>
                    <th className="px-2 py-2 text-left">Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {TEAM_MEMBERS.map((member) => (
                    <tr key={member.id} className="border-b border-border/50">
                      <td className="px-2 py-2.5 font-medium">{member.name}</td>
                      <td className="px-2 py-2.5">{member.role}</td>
                      <td className="px-2 py-2.5">{member.allocation}%</td>
                      <td className="px-2 py-2.5">{member.workload}</td>
                      <td className="px-2 py-2.5"><Badge className={cn('border', AVAILABILITY_COLOR[member.availability])}>{member.availability}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button className="h-8 px-3 text-xs"><UserPlus className="h-4 w-4 mr-2" />Add Team Member</Button>
              <Button variant="outline" className="h-8 px-3 text-xs">Reassign Role</Button>
              <Button variant="outline" className="h-8 px-3 text-xs">Adjust Allocation</Button>
              <Button variant="outline" className="h-8 px-3 text-xs">View Capacity</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="liquid-glass-enterprise-panel rounded-2xl border-white/50 xl:col-span-5">
          <CardHeader>
            <CardTitle className="text-sm">Timeline & Planning Snapshot</CardTitle>
            <CardDescription>Lifecycle phases with planned vs actual progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-[132px] w-full min-w-0 rounded-xl border border-border/60 overflow-hidden">
              <ReactFlow
                nodes={LIFECYCLE_NODES}
                edges={LIFECYCLE_EDGES}
                fitView
                panOnDrag={false}
                zoomOnScroll={false}
                zoomOnPinch={false}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#e2e8f0" gap={16} />
              </ReactFlow>
            </div>

            <div className="h-[165px] rounded-xl border border-border/60 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineSeries}>
                  <defs>
                    <linearGradient id="plannedFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#93c5fd" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#93c5fd" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip />
                  <Area type="monotone" dataKey="planned" stroke="#60a5fa" fill="url(#plannedFill)" strokeWidth={2} />
                  <Area type="monotone" dataKey="actual" stroke="#0284c7" fill="url(#actualFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-border/60 p-2">
                <div className="text-[11px] text-muted-foreground">Active phase</div>
                <div className="text-sm font-semibold">Execute</div>
              </div>
              <div className="rounded-lg border border-border/60 p-2">
                <div className="text-[11px] text-muted-foreground">Current sprint</div>
                <div className="text-sm font-semibold">Sprint 14</div>
              </div>
              <div className="rounded-lg border border-border/60 p-2">
                <div className="text-[11px] text-muted-foreground">Variance</div>
                <div className="text-sm font-semibold text-amber-600">+6 days</div>
              </div>
            </div>

            <Button variant="outline" className="h-8 px-3 text-xs">Open Full Timeline</Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Card className="liquid-glass-enterprise-panel rounded-2xl border-white/50 xl:col-span-5">
          <CardHeader>
            <CardTitle className="text-sm">Project Governance Snapshot</CardTitle>
            <CardDescription>Stage gate, approval flow, compliance, and audit readiness</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {projectData.slice(0, 5).map((project) => (
              <div key={project.id} className="liquid-glass-enterprise-panel rounded-xl border border-border/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-foreground">{project.code}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Stage: {project.lifecycle}</div>
                  </div>
                  <Badge className={cn('border', project.governance.stageGate === 'Pass' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : project.governance.stageGate === 'Conditional' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-rose-100 text-rose-700 border-rose-200')}>
                    {project.governance.stageGate}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge className="border bg-slate-100 text-slate-700">Approval: {project.governance.approvalStatus}</Badge>
                  <Badge className="border bg-slate-100 text-slate-700">Policy: {project.governance.policyCompliance}</Badge>
                  <Badge className="border bg-slate-100 text-slate-700">Audit: {project.governance.auditReadiness}</Badge>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" className="h-8 px-3 text-xs">Review Governance</Button>
              <Button variant="outline" className="h-8 px-3 text-xs">Submit Approval</Button>
              <Button variant="outline" className="h-8 px-3 text-xs">View Audit Log</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="liquid-glass-enterprise-panel rounded-2xl border-white/50 xl:col-span-7">
          <CardHeader>
            <CardTitle className="text-sm">Linked Artifacts & Documents</CardTitle>
            <CardDescription>Project documents, templates, notes, and linked assets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-xs">
                <thead className="border-b border-border/60 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left">Name</th>
                    <th className="px-2 py-2 text-left">Type</th>
                    <th className="px-2 py-2 text-left">Owner</th>
                    <th className="px-2 py-2 text-left">Version</th>
                    <th className="px-2 py-2 text-left">Last modified</th>
                  </tr>
                </thead>
                <tbody>
                  {ARTIFACTS.map((item) => (
                    <tr key={item.id} className="border-b border-border/50">
                      <td className="px-2 py-2.5 font-medium">{item.name}</td>
                      <td className="px-2 py-2.5">{item.type}</td>
                      <td className="px-2 py-2.5">{item.owner}</td>
                      <td className="px-2 py-2.5">{item.version}</td>
                      <td className="px-2 py-2.5">{item.lastModified}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-8 px-3 text-xs"><Eye className="h-4 w-4 mr-2" />Open</Button>
              <Button variant="outline" className="h-8 px-3 text-xs"><Plus className="h-4 w-4 mr-2" />Upload</Button>
              <Button variant="outline" className="h-8 px-3 text-xs"><Layers className="h-4 w-4 mr-2" />Link Artifact</Button>
              <Button variant="outline" className="h-8 px-3 text-xs">Manage Version</Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="liquid-glass-enterprise-panel rounded-2xl border-white/50">
          <CardHeader>
            <CardTitle className="text-sm">Recent Activity & Audit</CardTitle>
            <CardDescription>Audit-friendly stream of execution and governance events</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {ACTIVITY_FEED.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/60 p-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-7 w-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                    <Activity className="h-3.5 w-3.5 text-slate-600" />
                  </div>
                  <div>
                    <div className="text-xs text-foreground"><span className="font-semibold">{item.actor}</span> • {item.action}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Affected object: {item.target}</div>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  {item.timestamp}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {drawerOpen && activeProject && (
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[1000]" onClick={() => setDrawerOpen(false)} />
          <aside className="fixed top-0 right-0 h-full w-[560px] max-w-[96vw] bg-white z-[1100] border-l border-border shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-border p-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] text-muted-foreground">Project detail</div>
                <h3 className="text-lg font-semibold text-foreground mt-1">{activeProject.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{activeProject.code} • {activeProject.type} • {activeProject.workspace}</p>
              </div>
              <Button variant="ghost" className="h-7 w-7 p-0" onClick={() => setDrawerOpen(false)} aria-label="Close project detail">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border/60 p-2">
                  <div className="text-muted-foreground">Project owner</div>
                  <div className="font-medium text-foreground mt-1">{activeProject.owner}</div>
                </div>
                <div className="rounded-lg border border-border/60 p-2">
                  <div className="text-muted-foreground">Team size</div>
                  <div className="font-medium text-foreground mt-1">{activeProject.teamSize}</div>
                </div>
                <div className="rounded-lg border border-border/60 p-2">
                  <div className="text-muted-foreground">Progress</div>
                  <div className="font-medium text-foreground mt-1">{activeProject.progress}%</div>
                </div>
                <div className="rounded-lg border border-border/60 p-2">
                  <div className="text-muted-foreground">Lifecycle</div>
                  <div className="font-medium text-foreground mt-1">{activeProject.lifecycle}</div>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 p-3">
                <div className="font-semibold text-foreground flex items-center gap-2"><Gauge className="h-4 w-4 text-cyan-600" />Project configuration</div>
                <div className="mt-2 space-y-1.5 text-muted-foreground">
                  <div>Project type: <span className="text-foreground">{activeProject.type}</span></div>
                  <div>Project template: <span className="text-foreground">{activeProject.template}</span></div>
                  <div>Custom fields: <span className="text-foreground">{activeProject.settingsCustomFields} active fields</span></div>
                  <div>Project lifecycle: <span className="text-foreground">Initiate → Plan → Execute → Close</span></div>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 p-3">
                <div className="font-semibold text-foreground flex items-center gap-2"><Flag className="h-4 w-4 text-cyan-600" />Milestone summary</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-muted-foreground">
                  <div>Upcoming: <span className="text-foreground">{activeProject.milestones.upcoming}</span></div>
                  <div>Overdue: <span className="text-foreground">{activeProject.milestones.overdue}</span></div>
                  <div>Completed: <span className="text-foreground">{activeProject.milestones.completed}</span></div>
                  <div>Completion rate: <span className="text-foreground">{activeProject.milestones.completionRate}%</span></div>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 p-3">
                <div className="font-semibold text-foreground flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan-600" />Governance status</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge className="border bg-slate-100 text-slate-700">Stage: {activeProject.lifecycle}</Badge>
                  <Badge className="border bg-slate-100 text-slate-700">Approval: {activeProject.governance.approvalStatus}</Badge>
                  <Badge className="border bg-slate-100 text-slate-700">Policy: {activeProject.governance.policyCompliance}</Badge>
                  <Badge className="border bg-slate-100 text-slate-700">Audit: {activeProject.governance.auditReadiness}</Badge>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 p-3">
                <div className="font-semibold text-foreground flex items-center gap-2"><FileStack className="h-4 w-4 text-cyan-600" />Linked documents</div>
                <div className="mt-2 space-y-1.5">
                  {ARTIFACTS.slice(0, 3).map((artifact) => (
                    <div key={artifact.id} className="rounded-lg border border-border/50 p-2 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-foreground">{artifact.name}</div>
                        <div className="text-muted-foreground">{artifact.type}</div>
                      </div>
                      <div className="text-muted-foreground">{artifact.version}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border/60 p-3">
                <div className="font-semibold text-foreground flex items-center gap-2"><Activity className="h-4 w-4 text-cyan-600" />Recent activity</div>
                <div className="mt-2 space-y-2">
                  {ACTIVITY_FEED.slice(0, 3).map((activity) => (
                    <div key={activity.id} className="rounded-lg border border-border/50 p-2">
                      <div className="text-foreground">{activity.action}</div>
                      <div className="text-muted-foreground mt-0.5">{activity.actor} • {activity.timestamp}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button className="h-8 px-3 text-xs"><Edit className="h-4 w-4 mr-2" />Quick Edit</Button>
                <Button variant="outline" className="h-8 px-3 text-xs"><Users className="h-4 w-4 mr-2" />Manage Team</Button>
                <Button variant="outline" className="h-8 px-3 text-xs"><CalendarClock className="h-4 w-4 mr-2" />View Timeline</Button>
              </div>
            </div>
          </aside>
        </>
      )}

      {selectedRows.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[900]">
          <div className="liquid-glass-enterprise-panel rounded-xl border border-border/60 shadow-lg px-3 py-2 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">{selectedRows.length} projects selected</span>
            <Button className="h-7 px-2 text-[11px]">Apply template</Button>
            <Button variant="outline" className="h-7 px-2 text-[11px]">Export selection</Button>
          </div>
        </div>
      )}
    </div>
  )
}
