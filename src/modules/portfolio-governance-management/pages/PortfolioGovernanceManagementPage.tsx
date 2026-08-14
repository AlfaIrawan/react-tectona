import { startTransition, useDeferredValue, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  CircleAlert,
  ClipboardCheck,
  Compass,
  Download,
  FileSearch,
  Filter,
  GanttChartSquare,
  Gauge,
  GitBranch,
  Layers3,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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

// Compact warning message component for error states
function CompactWarningMessage({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-amber-900">{title}</div>
          <div className="mt-1 text-xs leading-tight text-amber-800">{description}</div>
        </div>
      </div>
      <button
        onClick={onAction}
        className="h-8 rounded-lg bg-amber-700 px-3 text-xs font-medium text-white hover:bg-amber-800"
      >
        {actionLabel}
      </button>
    </div>
  )
}

export function PortfolioGovernanceManagementPage() {
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(false)
  const [activePanel, setActivePanel] = useState<
    | 'overview'
    | 'portfolio-management'
    | 'grouping'
    | 'alignment'
    | 'okr-kpi'
    | 'benefits'
    | 'risk-register'
    | 'issues'
    | 'stage-gates'
    | 'compliance'
    | 'audit'
  >('overview')
  const [loadError, setLoadError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [portfolioFilter, setPortfolioFilter] = useState('All')
  const [objectiveFilter, setObjectiveFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [riskFilter, setRiskFilter] = useState('All')
  const [complianceFilter, setComplianceFilter] = useState('All')
  const [ownerFilter, setOwnerFilter] = useState('All')
  const [timePeriod, setTimePeriod] = useState('Q2 2026')
  const [showFiltersPanel, setShowFiltersPanel] = useState(true)
  const [drawer, setDrawer] = useState<{ open: boolean; portfolioId: string | null }>({ open: false, portfolioId: null })

  const sidebarFixed = usePreferencesStore((s) => s.preferences.sidebarFixed ?? false)
  const sidebarMini = usePreferencesStore((s) => s.preferences.sidebarMini ?? true)
  const navDocked = isWorkspaceNavDocked(sidebarFixed)
  const enterpriseNavTitlesOnly = usePreferencesStore((s) => s.preferences.enterpriseNavTitlesOnly ?? false)
  const enterpriseNavSimpleList = usePreferencesStore((s) => s.preferences.enterpriseNavSimpleList ?? false)
  const enterpriseNavCompact = enterpriseNavTitlesOnly || enterpriseNavSimpleList
  const fixedSidebarUiOn = !sidebarFixed
  const enterpriseNavUltra = fixedSidebarUiOn && sidebarMini && enterpriseNavTitlesOnly && enterpriseNavSimpleList
  const enterpriseNavWidthVariant = enterpriseNavUltra ? 'ultra' : enterpriseNavCompact ? 'compact' : 'default'

  type HealthTone = 'On Track' | 'At Risk' | 'Delayed'
  type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical'
  type ComplianceStatus = 'Compliant' | 'Watch' | 'Non-compliant'
  type PortfolioStatus = 'Active' | 'Paused' | 'Closed'

  interface PortfolioItem {
    id: string
    name: string
    type: 'Portfolio' | 'Program'
    owner: string
    projects: number
    budget: number
    value: number
    progress: number
    health: HealthTone
    risk: RiskLevel
    status: PortfolioStatus
    compliance: ComplianceStatus
    objective: string
    updatedAt: string
  }

  const PORTFOLIOS: PortfolioItem[] = [
    {
      id: 'PFO-001',
      name: 'Digital Lending Modernization',
      type: 'Portfolio',
      owner: 'Enterprise PMO',
      projects: 14,
      budget: 8_500_000,
      value: 12_400_000,
      progress: 62,
      health: 'At Risk',
      risk: 'High',
      status: 'Active',
      compliance: 'Watch',
      objective: 'Customer Experience',
      updatedAt: '2026-04-16 09:05',
    },
    {
      id: 'PFO-002',
      name: 'Core Platform Resilience',
      type: 'Portfolio',
      owner: 'Platform Governance',
      projects: 10,
      budget: 6_100_000,
      value: 9_500_000,
      progress: 71,
      health: 'On Track',
      risk: 'Medium',
      status: 'Active',
      compliance: 'Compliant',
      objective: 'Risk & Compliance',
      updatedAt: '2026-04-15 17:22',
    },
    {
      id: 'PRG-101',
      name: 'Credit Workflow Orchestration',
      type: 'Program',
      owner: 'Delivery Excellence Office',
      projects: 5,
      budget: 2_400_000,
      value: 4_000_000,
      progress: 54,
      health: 'Delayed',
      risk: 'Critical',
      status: 'Active',
      compliance: 'Non-compliant',
      objective: 'Operational Efficiency',
      updatedAt: '2026-04-16 08:40',
    },
    {
      id: 'PRG-102',
      name: 'Regulatory Reporting Automation',
      type: 'Program',
      owner: 'Compliance Office',
      projects: 4,
      budget: 1_800_000,
      value: 3_200_000,
      progress: 83,
      health: 'On Track',
      risk: 'Low',
      status: 'Active',
      compliance: 'Compliant',
      objective: 'Risk & Compliance',
      updatedAt: '2026-04-14 15:10',
    },
    {
      id: 'PFO-003',
      name: 'Branch Operations Standardization',
      type: 'Portfolio',
      owner: 'COO Office',
      projects: 7,
      budget: 3_900_000,
      value: 5_700_000,
      progress: 44,
      health: 'At Risk',
      risk: 'High',
      status: 'Paused',
      compliance: 'Watch',
      objective: 'Operational Efficiency',
      updatedAt: '2026-04-12 12:30',
    },
  ]

  type InitiativeStatus = 'On Track' | 'At Risk' | 'Delayed' | 'Completed'
  interface InitiativeNode {
    id: string
    name: string
    owner: string
    progress: number
    risk: RiskLevel
    valueDelivered: number
    status: InitiativeStatus
    children?: InitiativeNode[]
  }

  const INITIATIVE_TREE: Array<{ portfolio: InitiativeNode; programs: InitiativeNode[] }> = [
    {
      portfolio: {
        id: 'PFO-001',
        name: 'Digital Lending Modernization',
        owner: 'Enterprise PMO',
        progress: 62,
        risk: 'High',
        valueDelivered: 3_250_000,
        status: 'At Risk',
      },
      programs: [
        {
          id: 'PRG-101',
          name: 'Credit Workflow Orchestration',
          owner: 'Delivery Excellence Office',
          progress: 54,
          risk: 'Critical',
          valueDelivered: 820_000,
          status: 'Delayed',
          children: [
            { id: 'INI-1401', name: 'Approval routing redesign', owner: 'Workflow Squad', progress: 58, risk: 'High', valueDelivered: 220_000, status: 'At Risk' },
            { id: 'INI-1402', name: 'Exception handling hardening', owner: 'Reliability Guild', progress: 36, risk: 'Critical', valueDelivered: 95_000, status: 'Delayed' },
          ],
        },
        {
          id: 'PRG-103',
          name: 'Digital Channels Enablement',
          owner: 'Digital Banking Office',
          progress: 72,
          risk: 'Medium',
          valueDelivered: 1_150_000,
          status: 'On Track',
          children: [
            { id: 'INI-1501', name: 'New onboarding journey', owner: 'CX Studio', progress: 78, risk: 'Medium', valueDelivered: 640_000, status: 'On Track' },
            { id: 'INI-1502', name: 'KYC automation uplift', owner: 'Risk Engineering', progress: 66, risk: 'Medium', valueDelivered: 510_000, status: 'On Track' },
          ],
        },
      ],
    },
    {
      portfolio: {
        id: 'PFO-002',
        name: 'Core Platform Resilience',
        owner: 'Platform Governance',
        progress: 71,
        risk: 'Medium',
        valueDelivered: 2_980_000,
        status: 'On Track',
      },
      programs: [
        {
          id: 'PRG-201',
          name: 'Service Mesh Governance',
          owner: 'SRE Office',
          progress: 69,
          risk: 'Medium',
          valueDelivered: 1_020_000,
          status: 'On Track',
          children: [
            { id: 'INI-2101', name: 'mTLS enforcement baseline', owner: 'Security Engineering', progress: 74, risk: 'Medium', valueDelivered: 420_000, status: 'On Track' },
            { id: 'INI-2102', name: 'Cross-zone failover drills', owner: 'SRE Office', progress: 61, risk: 'Low', valueDelivered: 260_000, status: 'On Track' },
          ],
        },
        {
          id: 'PRG-202',
          name: 'Platform Change Controls',
          owner: 'Platform Governance',
          progress: 79,
          risk: 'Low',
          valueDelivered: 760_000,
          status: 'On Track',
          children: [
            { id: 'INI-2201', name: 'Release evidence automation', owner: 'Release Office', progress: 84, risk: 'Low', valueDelivered: 380_000, status: 'On Track' },
            { id: 'INI-2202', name: 'Approval workflow standardization', owner: 'Platform Governance', progress: 73, risk: 'Low', valueDelivered: 240_000, status: 'On Track' },
          ],
        },
      ],
    },
  ]

  interface StrategicObjectiveMapRow {
    objective: string
    alignmentScore: number
    contribution: 'High' | 'Medium' | 'Low'
    linked: Array<{ ref: string; name: string; type: 'Portfolio' | 'Program' | 'Initiative' }>
  }

  const STRATEGY_MAP: StrategicObjectiveMapRow[] = [
    {
      objective: 'Customer Experience',
      alignmentScore: 86,
      contribution: 'High',
      linked: [
        { ref: 'PFO-001', name: 'Digital Lending Modernization', type: 'Portfolio' },
        { ref: 'INI-1501', name: 'New onboarding journey', type: 'Initiative' },
      ],
    },
    {
      objective: 'Operational Efficiency',
      alignmentScore: 78,
      contribution: 'Medium',
      linked: [
        { ref: 'PFO-003', name: 'Branch Operations Standardization', type: 'Portfolio' },
        { ref: 'PRG-101', name: 'Credit Workflow Orchestration', type: 'Program' },
      ],
    },
    {
      objective: 'Risk & Compliance',
      alignmentScore: 92,
      contribution: 'High',
      linked: [
        { ref: 'PFO-002', name: 'Core Platform Resilience', type: 'Portfolio' },
        { ref: 'PRG-102', name: 'Regulatory Reporting Automation', type: 'Program' },
      ],
    },
  ]

  interface OkrObjective {
    id: string
    title: string
    owner: string
    progress: number
    keyResults: Array<{
      id: string
      title: string
      target: string
      actual: string
      progress: number
      linkedRefs: string[]
    }>
  }

  const OKRS: OkrObjective[] = [
    {
      id: 'OKR-CE-01',
      title: 'Improve digital lending conversion and customer trust',
      owner: 'Chief Digital Officer',
      progress: 67,
      keyResults: [
        { id: 'KR-01', title: 'Reduce onboarding abandonment', target: '-18%', actual: '-11%', progress: 61, linkedRefs: ['INI-1501', 'PFO-001'] },
        { id: 'KR-02', title: 'Increase straight-through approvals', target: '+14%', actual: '+7%', progress: 52, linkedRefs: ['PRG-101', 'INI-1401'] },
      ],
    },
    {
      id: 'OKR-RC-02',
      title: 'Strengthen governance compliance and audit readiness',
      owner: 'Chief Risk Officer',
      progress: 81,
      keyResults: [
        { id: 'KR-03', title: 'Stage gate evidence completeness', target: '>= 95%', actual: '93%', progress: 78, linkedRefs: ['PFO-003', 'PRG-202'] },
        { id: 'KR-04', title: 'Reduce non-compliant governance actions', target: '-30%', actual: '-24%', progress: 86, linkedRefs: ['PFO-002', 'PRG-102'] },
      ],
    },
  ]

  interface BenefitRow {
    id: string
    label: string
    planned: number
    realized: number
    roi: number
    status: 'On-plan' | 'Behind' | 'Ahead'
    owner: string
    linked: string[]
  }

  const BENEFITS: BenefitRow[] = [
    { id: 'BEN-01', label: 'Cost-to-serve reduction', planned: 2_800_000, realized: 1_940_000, roi: 1.62, status: 'Behind', owner: 'COO Office', linked: ['PFO-003', 'PRG-101'] },
    { id: 'BEN-02', label: 'Revenue uplift (digital conversion)', planned: 3_600_000, realized: 2_980_000, roi: 2.08, status: 'On-plan', owner: 'CDO Office', linked: ['PFO-001', 'INI-1501'] },
    { id: 'BEN-03', label: 'Risk loss avoidance', planned: 1_900_000, realized: 2_140_000, roi: 2.34, status: 'Ahead', owner: 'CRO Office', linked: ['PFO-002', 'PRG-102'] },
  ]

  interface RiskRow {
    id: string
    description: string
    impact: 1 | 2 | 3 | 4 | 5
    probability: 1 | 2 | 3 | 4 | 5
    owner: string
    mitigation: string
    status: 'Open' | 'Mitigating' | 'Escalated' | 'Closed'
    linked: string
  }

  const RISKS: RiskRow[] = [
    {
      id: 'RSK-1108',
      description: 'Stage gate evidence gaps for regulated workflow changes',
      impact: 5,
      probability: 4,
      owner: 'Compliance Office',
      mitigation: 'Enforce evidence checklist and automated artifact capture before approvals.',
      status: 'Escalated',
      linked: 'PRG-101',
    },
    {
      id: 'RSK-1122',
      description: 'Dependency chain delays across lending integration handoffs',
      impact: 4,
      probability: 4,
      owner: 'Enterprise PMO',
      mitigation: 'Weekly cross-program dependency board with escalation thresholds.',
      status: 'Mitigating',
      linked: 'PFO-001',
    },
    {
      id: 'RSK-1204',
      description: 'Unstandardized change controls across platform releases',
      impact: 4,
      probability: 3,
      owner: 'Platform Governance',
      mitigation: 'Adopt unified change approval policy and audit-ready automation.',
      status: 'Open',
      linked: 'PFO-002',
    },
  ]

  interface IssueRow {
    id: string
    description: string
    severity: 'Low' | 'Medium' | 'High' | 'Critical'
    linkedProject: string
    owner: string
    status: 'Open' | 'In Progress' | 'Blocked' | 'Resolved'
    resolutionProgress: number
  }

  const ISSUES: IssueRow[] = [
    {
      id: 'ISS-7401',
      description: 'Approval workflow service latency spikes during peak submissions',
      severity: 'High',
      linkedProject: 'INI-1401',
      owner: 'SRE Office',
      status: 'In Progress',
      resolutionProgress: 62,
    },
    {
      id: 'ISS-7414',
      description: 'Missing audit trails for manual evidence uploads in Q2 cycle',
      severity: 'Critical',
      linkedProject: 'PFO-003',
      owner: 'Audit Office',
      status: 'Open',
      resolutionProgress: 18,
    },
    {
      id: 'ISS-7420',
      description: 'Program budget changes not reflected in portfolio roll-ups',
      severity: 'Medium',
      linkedProject: 'PFO-001',
      owner: 'Finance Control Tower',
      status: 'Blocked',
      resolutionProgress: 34,
    },
  ]

  interface StageGateRow {
    stage: 'Initiate' | 'Plan' | 'Execute' | 'Monitor' | 'Close'
    gateStatus: 'Pending' | 'Approved' | 'Rejected'
    approvers: string[]
    approvalDate: string
    notes: string
    linked: string
  }

  const STAGE_GATES: StageGateRow[] = [
    { stage: 'Initiate', gateStatus: 'Approved', approvers: ['Enterprise PMO', 'CRO Office'], approvalDate: '2026-04-01', notes: 'Business case approved; evidence attached.', linked: 'PFO-001' },
    { stage: 'Plan', gateStatus: 'Pending', approvers: ['Platform Governance'], approvalDate: '-', notes: 'Architecture review pending; control checklist incomplete.', linked: 'PRG-101' },
    { stage: 'Execute', gateStatus: 'Approved', approvers: ['Delivery Excellence Office'], approvalDate: '2026-04-10', notes: 'Sprint controls validated; capacity plan on file.', linked: 'PFO-002' },
    { stage: 'Monitor', gateStatus: 'Rejected', approvers: ['Audit Office'], approvalDate: '2026-04-12', notes: 'Missing audit readiness pack for evidence trail.', linked: 'PFO-003' },
    { stage: 'Close', gateStatus: 'Pending', approvers: ['Finance Control Tower'], approvalDate: '-', notes: 'Delivery outcome realization review scheduled.', linked: 'PRG-102' },
  ]

  interface ComplianceRow {
    id: string
    status: ComplianceStatus
    violations: number
    missingDocs: number
    auditReadiness: number
    policyScore: number
    linked: string
  }

  const COMPLIANCE: ComplianceRow[] = [
    { id: 'CMP-01', status: 'Watch', violations: 2, missingDocs: 4, auditReadiness: 74, policyScore: 86, linked: 'PFO-001' },
    { id: 'CMP-02', status: 'Compliant', violations: 0, missingDocs: 1, auditReadiness: 92, policyScore: 94, linked: 'PFO-002' },
    { id: 'CMP-03', status: 'Non-compliant', violations: 5, missingDocs: 9, auditReadiness: 58, policyScore: 72, linked: 'PRG-101' },
  ]

  interface AuditRow {
    id: string
    timestamp: string
    actor: string
    action: string
    object: string
    changeDetail: string
  }

  const AUDIT_LOG: AuditRow[] = [
    {
      id: 'ADT-9001',
      timestamp: '2026-04-16 09:05',
      actor: 'Enterprise PMO',
      action: 'Status changed',
      object: 'PFO-001',
      changeDetail: 'Delivery health moved from On Track to At Risk due to dependency delays and overdue stage gate items.',
    },
    {
      id: 'ADT-9007',
      timestamp: '2026-04-16 08:40',
      actor: 'Audit Office',
      action: 'Gate rejected',
      object: 'PFO-003',
      changeDetail: 'Monitor stage gate rejected; missing audit readiness pack and incomplete evidence references.',
    },
    {
      id: 'ADT-9012',
      timestamp: '2026-04-15 17:22',
      actor: 'Platform Governance',
      action: 'Compliance updated',
      object: 'PFO-002',
      changeDetail: 'Policy adherence score recalculated after change controls standardization rollout.',
    },
  ]

  const filters = useMemo(() => {
    const portfolios = Array.from(new Set(PORTFOLIOS.filter((p) => p.type === 'Portfolio').map((p) => p.name)))
    const owners = Array.from(new Set(PORTFOLIOS.map((p) => p.owner)))
    const objectives = Array.from(new Set(PORTFOLIOS.map((p) => p.objective)))
    return { portfolios, owners, objectives }
  }, [])

  const filteredPortfolios = useMemo(() => {
    return PORTFOLIOS.filter((item) => {
      const matchesSearch =
        deferredSearch.length === 0 ||
        [item.name, item.id, item.owner, item.objective, item.type].join(' ').toLowerCase().includes(deferredSearch.toLowerCase())

      const matchesPortfolio = portfolioFilter === 'All' || item.name === portfolioFilter
      const matchesObjective = objectiveFilter === 'All' || item.objective === objectiveFilter
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter
      const matchesRisk = riskFilter === 'All' || item.risk === riskFilter
      const matchesCompliance = complianceFilter === 'All' || item.compliance === complianceFilter
      const matchesOwner = ownerFilter === 'All' || item.owner === ownerFilter

      return matchesSearch && matchesPortfolio && matchesObjective && matchesStatus && matchesRisk && matchesCompliance && matchesOwner
    })
  }, [complianceFilter, deferredSearch, objectiveFilter, ownerFilter, portfolioFilter, riskFilter, statusFilter])

  const portfolioMap = useMemo(() => Object.fromEntries(PORTFOLIOS.map((p) => [p.id, p])), [])
  const drawerItem = drawer.portfolioId ? portfolioMap[drawer.portfolioId] : null

  const summary = useMemo(() => {
    const portfolios = PORTFOLIOS.filter((p) => p.type === 'Portfolio').length
    const programs = PORTFOLIOS.filter((p) => p.type === 'Program' && p.status === 'Active').length
    const activeProjects = PORTFOLIOS.reduce((sum, p) => sum + p.projects, 0)
    const onTrack = PORTFOLIOS.filter((p) => p.health === 'On Track').length
    const atRisk = PORTFOLIOS.filter((p) => p.health === 'At Risk').length
    const delayed = PORTFOLIOS.filter((p) => p.health === 'Delayed').length
    const complianceScore = Math.round(COMPLIANCE.reduce((sum, c) => sum + c.policyScore, 0) / COMPLIANCE.length)
    const riskPressure = Math.min(
      100,
      Math.round(
        52 +
          RISKS.filter((r) => r.status !== 'Closed').length * 6 +
          PORTFOLIOS.filter((p) => p.risk === 'Critical').length * 10 +
          ISSUES.filter((i) => i.status !== 'Resolved' && i.severity === 'Critical').length * 12
      )
    )

    const healthScore = Math.max(42, Math.round(100 - atRisk * 6 - delayed * 10 - riskPressure * 0.18 + onTrack * 2 + complianceScore * 0.12))

    return {
      portfolios,
      programs,
      activeProjects,
      onTrack,
      atRisk,
      delayed,
      healthScore,
      complianceScore,
      riskPressure,
    }
  }, [])

  const strategicDistribution = useMemo(() => {
    const groups = Array.from(new Set(PORTFOLIOS.map((p) => p.objective)))
    return groups.map((objective) => ({
      name: objective,
      count: PORTFOLIOS.filter((p) => p.objective === objective).length,
    }))
  }, [])

  const benefitsChart = useMemo(() => {
    return BENEFITS.map((b) => ({
      label: b.label,
      planned: Math.round(b.planned / 1000),
      realized: Math.round(b.realized / 1000),
    }))
  }, [])

  const healthSpark = useMemo(() => [72, 73, 74, 75, 74, 76, 78, summary.healthScore], [summary.healthScore])

  const PIE_COLORS = ['#1d4ed8', '#2563eb', '#60a5fa', '#93c5fd', '#cbd5e1']

  const PANELS = [
    {
      id: 'overview',
      label: 'Delivery Overview',
      description: 'Executive posture for delivery health, governance readiness, operational risk, and execution progress.',
      icon: Gauge,
      badge: 'Executive',
      group: 'Executive Delivery Tower',
    },
    {
      id: 'portfolio-management',
      label: 'Portfolio Delivery Management',
      description: 'Manage delivery portfolios, programs, initiatives, and governed execution tracking.',
      icon: BriefcaseBusiness,
      badge: 'Operate',
      group: 'Delivery Operations',
    },
    {
      id: 'grouping',
      label: 'Program & Initiative Coordination',
      description: 'Coordinate initiative hierarchy, delivery grouping, dependency flow, and execution roll-up visibility.',
      icon: Layers3,
      badge: 'Structure',
      group: 'Delivery Operations',
    },
    {
      id: 'alignment',
      label: 'Initiative Alignment',
      description: 'Connect initiatives to business objectives and operational outcomes for execution visibility.',
      icon: Compass,
      badge: 'Alignment',
      group: 'Delivery Alignment',
    },
    {
      id: 'okr-kpi',
      label: 'OKR / KPI Delivery Mapping',
      description: 'Track delivery contribution toward governed KPIs and operational objectives.',
      icon: Target,
      badge: 'Outcomes',
      group: 'Delivery Alignment',
    },
    {
      id: 'benefits',
      label: 'Delivery Outcome Tracking',
      description: 'Monitor operational outcomes, delivery impact, execution value, and realized benefits.',
      icon: TrendingUp,
      badge: 'Value',
      group: 'Delivery Value',
    },
    {
      id: 'risk-register',
      label: 'Delivery Risk Register',
      description: 'Track operational delivery risks, mitigation progress, escalation readiness, and governance exposure.',
      icon: AlertTriangle,
      badge: 'Risk',
      group: 'Governance Assurance',
    },
    {
      id: 'issues',
      label: 'Delivery Issue Management',
      description: 'Manage execution blockers, operational issues, governance impediments, and resolution workflows.',
      icon: CircleAlert,
      badge: 'Issue',
      group: 'Governance Assurance',
    },
    {
      id: 'stage-gates',
      label: 'Stage Gate Control',
      description: 'Control lifecycle approval checkpoints, evidence validation, and governed release progression.',
      icon: GanttChartSquare,
      badge: 'Gates',
      group: 'Governance Assurance',
    },
    {
      id: 'compliance',
      label: 'Delivery Compliance Tracking',
      description: 'Monitor delivery compliance posture, missing evidence, operational violations, and audit readiness.',
      icon: ShieldCheck,
      badge: 'Compliance',
      group: 'Governance Assurance',
    },
    {
      id: 'audit',
      label: 'Delivery Audit Trail',
      description: 'Trace governed execution activities, operational decisions, evidence lineage, and audit history.',
      icon: FileSearch,
      badge: 'Audit',
      group: 'Governance Assurance',
    },
  ] as const

  type PanelDef = (typeof PANELS)[number]

  const PANEL_GROUPS: Array<{ group: PanelDef['group']; items: PanelDef[] }> = [
    { group: 'Executive Delivery Tower', items: PANELS.filter((p) => p.group === 'Executive Delivery Tower') },
    { group: 'Delivery Operations', items: PANELS.filter((p) => p.group === 'Delivery Operations') },
    { group: 'Delivery Alignment', items: PANELS.filter((p) => p.group === 'Delivery Alignment') },
    { group: 'Delivery Value', items: PANELS.filter((p) => p.group === 'Delivery Value') },
    { group: 'Governance Assurance', items: PANELS.filter((p) => p.group === 'Governance Assurance') },
  ]

  const isFiltersEligiblePanel = useMemo(() => {
    const eligible: Array<typeof activePanel> = ['portfolio-management', 'alignment', 'risk-register', 'issues', 'stage-gates', 'audit']
    return eligible.includes(activePanel)
  }, [activePanel])

  const navPanelRef = useRef<HTMLDivElement | null>(null)
  const overviewMainPanelRef = useRef<HTMLElement | null>(null)
  const [navPanelHeightPx, setNavPanelHeightPx] = useState<number | null>(null)

  useLayoutEffect(() => {
    // Fixed Sidebar ON: samakan batas bawah Enterprise Navigation dengan panel konten utama, seperti Workspace Management.
    if (navDocked) {
      setNavPanelHeightPx(null)
      return
    }

    const compute = () => {
      const el = navPanelRef.current
      if (!el) return

      const mainPanelEl = activePanel === 'overview' ? overviewMainPanelRef.current : null
      if (mainPanelEl) {
        const navTop = el.getBoundingClientRect().top
        const mainBottom = mainPanelEl.getBoundingClientRect().bottom
        setNavPanelHeightPx(Math.max(220, Math.floor(mainBottom - navTop)))
        return
      }

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
    if (overviewMainPanelRef.current) ro.observe(overviewMainPanelRef.current)
    window.addEventListener('resize', compute, { passive: true })
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('load', onLoad)
      window.clearTimeout(t)
      ro.disconnect()
    }
  }, [navDocked, showFiltersPanel, activePanel, isWorkspaceCollapsed, summary.healthScore])

  function switchPanel(id: (typeof PANELS)[number]['id']) {
    setActivePanel(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function formatMoney(value: number) {
    const abs = Math.abs(value)
    if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (abs >= 1000) return `$${Math.round(value / 1000)}K`
    return `$${value}`
  }

  function healthToneClasses(health: HealthTone) {
    if (health === 'On Track') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    if (health === 'Delayed') return 'border-rose-200 bg-rose-50 text-rose-700'
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }

  function riskToneClasses(risk: RiskLevel) {
    if (risk === 'Critical') return 'border-rose-200 bg-rose-50 text-rose-700'
    if (risk === 'High') return 'border-orange-200 bg-orange-50 text-orange-700'
    if (risk === 'Medium') return 'border-amber-200 bg-amber-50 text-amber-700'
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  function complianceToneClasses(status: ComplianceStatus) {
    if (status === 'Non-compliant') return 'border-rose-200 bg-rose-50 text-rose-700'
    if (status === 'Watch') return 'border-amber-200 bg-amber-50 text-amber-700'
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  function gateToneClasses(status: StageGateRow['gateStatus']) {
    if (status === 'Rejected') return 'border-rose-200 bg-rose-50 text-rose-700'
    if (status === 'Pending') return 'border-amber-200 bg-amber-50 text-amber-700'
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  function scoreTone(score: number) {
    if (score >= 90) return 'text-emerald-700'
    if (score >= 75) return 'text-amber-700'
    return 'text-rose-700'
  }

  function Panel({
    id,
    title,
    description,
    right,
    panelRef,
    children,
  }: {
    id: string
    title: string
    description: string
    right?: React.ReactNode
    panelRef?: React.Ref<HTMLElement>
    children: React.ReactNode
  }) {
    return (
      <section
        id={id}
        ref={panelRef}
        className={cn(
          'rounded-3xl border bg-white/90 shadow-[0_16px_50px_rgba(15,23,42,0.08)] transition-all',
          activePanel === (id as typeof activePanel) ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200/80'
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-xs text-slate-600">{description}</p>
          </div>
          {right}
        </div>
        <div className="p-5">{children}</div>
      </section>
    )
  }

  function SparkArea({ data, color }: { data: number[]; color: string }) {
    const chartData = data.map((value, index) => ({ idx: index, value }))
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={`tectona-pgov-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.34} />
              <stop offset="100%" stopColor={color} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.8}
            fill={`url(#tectona-pgov-${color.replace('#', '')})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  function MetricCard({
    label,
    value,
    subtext,
    icon: Icon,
    tone,
    sparkColor,
    sparkSeries,
  }: {
    label: string
    value: string
    subtext: string
    icon: React.ComponentType<{ className?: string }>
    tone: 'blue' | 'emerald' | 'amber' | 'rose'
    sparkColor: string
    sparkSeries: number[]
  }) {
    const chrome =
      tone === 'emerald'
        ? 'bg-gradient-to-br from-emerald-50/70 via-white/90 to-cyan-50/70'
        : tone === 'amber'
          ? 'bg-gradient-to-br from-amber-50/70 via-white/90 to-orange-50/70'
          : tone === 'rose'
            ? 'bg-gradient-to-br from-rose-50/70 via-white/90 to-amber-50/70'
            : 'bg-gradient-to-br from-sky-50/80 via-white/90 to-indigo-50/70'

    return (
      <Card
        className={cn(
          'relative overflow-hidden rounded-2xl border border-white/40 ring-1 ring-black/[0.04] shadow-[0_14px_40px_rgba(15,23,42,0.10)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_56px_rgba(15,23,42,0.14)]',
          chrome
        )}
      >
        <div className="pointer-events-none absolute -right-3 -bottom-4 opacity-[0.08] transition-all duration-500 group-hover:scale-110 group-hover:opacity-[0.12]">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/60 text-slate-700/80 ring-1 ring-white/50 backdrop-blur-sm">
            <Icon className="h-7 w-7" />
          </div>
        </div>
        <CardContent className="p-4">
          <div className="text-xs text-slate-500">{label}</div>
          <div className="mt-1 flex items-center gap-3">
            <div className="shrink-0 text-2xl font-bold leading-none text-slate-950">{value}</div>
            <div className="h-10 min-w-0 flex-1">
              <SparkArea data={sparkSeries} color={sparkColor} />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
            <span className="inline-flex min-w-0 items-center gap-2">
              <Icon className="h-3.5 w-3.5 shrink-0 text-slate-600" />
              <span className="truncate">{subtext}</span>
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const metricCards = useMemo(() => {
    return [
      {
        label: 'Total Portfolios',
        value: String(summary.portfolios),
        subtext: 'Delivery portfolios under PMO governance',
        icon: BriefcaseBusiness,
        tone: 'blue' as const,
        sparkColor: '#0ea5e9',
        sparkSeries: [2, 2, 2, 3, 3, 3, 3, summary.portfolios],
      },
      {
        label: 'Active Programs',
        value: String(summary.programs),
        subtext: 'Programs in governed execution',
        icon: Layers3,
        tone: 'blue' as const,
        sparkColor: '#6366f1',
        sparkSeries: [3, 3, 4, 4, 4, 5, 5, summary.programs],
      },
      {
        label: 'Active Projects',
        value: String(summary.activeProjects),
        subtext: 'Projects rolling up to delivery control tower',
        icon: BarChart3,
        tone: 'blue' as const,
        sparkColor: '#2563eb',
        sparkSeries: [24, 26, 28, 30, 31, 33, 34, summary.activeProjects],
      },
      {
        label: 'On-Track Initiatives',
        value: String(summary.onTrack),
        subtext: 'Initiatives within delivery confidence',
        icon: BadgeCheck,
        tone: 'emerald' as const,
        sparkColor: '#10b981',
        sparkSeries: [1, 1, 2, 2, 2, 2, 3, summary.onTrack],
      },
      {
        label: 'At-Risk Initiatives',
        value: String(summary.atRisk),
        subtext: 'Needs governance intervention',
        icon: AlertTriangle,
        tone: 'amber' as const,
        sparkColor: '#f59e0b',
        sparkSeries: [0, 1, 1, 1, 2, 2, 2, summary.atRisk],
      },
      {
        label: 'Delayed Initiatives',
        value: String(summary.delayed),
        subtext: 'Breached gates, schedule, or dependencies',
        icon: CircleAlert,
        tone: 'rose' as const,
        sparkColor: '#f97316',
        sparkSeries: [0, 0, 0, 1, 1, 1, 1, summary.delayed],
      },
    ]
  }, [summary])

  const overviewRight = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white/75 p-1.5 shadow-sm backdrop-blur-sm">
        <button
          type="button"
          className="flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition-all duration-200 hover:bg-white hover:text-slate-900 hover:shadow-sm"
          aria-label="Export delivery report"
          title="Export delivery report"
        >
          <Download className="h-5 w-5" strokeWidth={2} />
        </button>
        <button
          type="button"
          className="flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition-all duration-200 hover:bg-white hover:text-slate-900 hover:shadow-sm"
          aria-label="Open governance settings"
          title="Governance settings"
        >
          <Settings className="h-5 w-5" strokeWidth={2} />
        </button>
        <button
          type="button"
          className="flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition-all duration-200 hover:bg-white hover:text-slate-900 hover:shadow-sm"
          aria-label="Open audit settings"
          title="Audit settings"
        >
          <Lock className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>
    </div>
  )

  const filtersCard = (
    <Card className="glass-card rounded-2xl border-slate-200/80 bg-white/80 p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.7fr)_repeat(6,minmax(0,1fr))]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            value={search}
            onChange={(event) => startTransition(() => setSearch(event.target.value))}
            className="h-11 rounded-2xl border-slate-200 bg-white pl-9 text-sm"
            placeholder="Search portfolio, program, project, initiative, owner, or objective"
          />
        </div>

        {[
          { label: 'Portfolio / Program', value: portfolioFilter, onChange: setPortfolioFilter, options: ['All', ...filters.portfolios] },
          { label: 'Delivery objective', value: objectiveFilter, onChange: setObjectiveFilter, options: ['All', ...filters.objectives] },
          { label: 'Status', value: statusFilter, onChange: setStatusFilter, options: ['All', 'Active', 'Paused', 'Closed'] },
          { label: 'Risk level', value: riskFilter, onChange: setRiskFilter, options: ['All', 'Low', 'Medium', 'High', 'Critical'] },
          { label: 'Compliance', value: complianceFilter, onChange: setComplianceFilter, options: ['All', 'Compliant', 'Watch', 'Non-compliant'] },
          { label: 'Owner', value: ownerFilter, onChange: setOwnerFilter, options: ['All', ...filters.owners] },
          { label: 'Time period', value: timePeriod, onChange: setTimePeriod, options: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026', 'FY 2026'] },
        ].map((filter) => (
          <label key={filter.label} className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{filter.label}</span>
            <select
              value={filter.value}
              onChange={(event) => filter.onChange(event.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            >
              {filter.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </Card>
  )

  return (
    <div className="space-y-6 pb-8">
      <div className={cn('space-y-6', workspaceDockedContentInsetClass(navDocked, isWorkspaceCollapsed, enterpriseNavWidthVariant))}>
        <Breadcrumb items={[{ label: 'Execution Portfolio & Delivery Governance' }]} />

        <PageHeader
          title="Execution Portfolio & Delivery Governance"
          description="Govern delivery execution, coordinate PMO operations, enforce stage gates, and monitor operational risk, compliance, and delivery health"
          right={
            <div className="flex flex-wrap items-center justify-end gap-2">
              {isFiltersEligiblePanel ? (
                <div className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white/75 p-1.5 shadow-sm backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={() => setShowFiltersPanel((current) => !current)}
                    className={cn(
                      'flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition-all duration-200 hover:bg-white hover:text-slate-900 hover:shadow-sm',
                      showFiltersPanel && 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                    )}
                    aria-label={showFiltersPanel ? 'Hide search and filters' : 'Show search and filters'}
                    title={showFiltersPanel ? 'Hide search and filters' : 'Show search and filters'}
                  >
                    <Filter className="h-5 w-5" strokeWidth={2} />
                  </button>
                </div>
              ) : null}
              <Button variant="outline" className="h-10 rounded-full border-slate-200 px-4">
                <Download className="mr-2 h-4 w-4" />
                Export Delivery Report
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {metricCards.map((m) => (
            <div key={m.label} className="group">
              <MetricCard {...m} />
            </div>
          ))}
        </div>
      </div>

      <div className={workspaceOuterGridClass(sidebarFixed, isWorkspaceCollapsed, enterpriseNavWidthVariant)}>
        <aside className={workspaceAsideClass(navDocked, isWorkspaceCollapsed, enterpriseNavWidthVariant)}>
          <div
            ref={navPanelRef}
            className={cn(workspaceNavInnerClass(navDocked, sidebarFixed, isWorkspaceCollapsed), !navDocked && 'overflow-hidden')}
            style={!navDocked && navPanelHeightPx ? { height: navPanelHeightPx, maxHeight: navPanelHeightPx, minHeight: navPanelHeightPx } : undefined}
            aria-label="Delivery governance workspace navigation"
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
                  aria-label={isWorkspaceCollapsed ? 'Expand delivery governance navigation' : 'Collapse delivery governance navigation'}
                  title={isWorkspaceCollapsed ? 'Expand delivery governance navigation' : 'Collapse delivery governance navigation'}
                  onClick={() => setIsWorkspaceCollapsed((current) => !current)}
                >
                  {isWorkspaceCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                </Button>
              </div>

              {!isWorkspaceCollapsed && !enterpriseNavSimpleList ? (
                <div className="mb-4 overflow-hidden rounded-[24px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_38%),linear-gradient(160deg,rgba(15,23,42,0.96),rgba(30,41,59,0.94))] p-4 text-white shadow-[0_18px_44px_rgba(15,23,42,0.24)]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-100/80">Executive Delivery Tower</div>
                  <div className="mt-2 text-base font-semibold leading-tight">
                    PMO delivery control tower for execution health, operational governance, risk, and outcome tracking
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-sky-100/80">
                    <div className="rounded-xl border border-white/15 bg-white/10 px-2 py-1">
                      Health <span className="ml-1 font-semibold text-white">{summary.healthScore}%</span>
                    </div>
                    <div className="rounded-xl border border-white/15 bg-white/10 px-2 py-1">
                      Compliance <span className="ml-1 font-semibold text-white">{summary.complianceScore}</span>
                    </div>
                    <div className="rounded-xl border border-white/15 bg-white/10 px-2 py-1">
                      Risk <span className="ml-1 font-semibold text-white">{summary.riskPressure}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className={workspaceNavMenuScrollClass()}>
              <div className={cn(enterpriseNavUltra ? 'space-y-1.5' : enterpriseNavCompact ? 'space-y-2' : 'space-y-4')}>
                {PANEL_GROUPS.map(({ group, items }) => (
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

              {!enterpriseNavSimpleList ? (
                <div className="shrink-0 space-y-4 pt-4">
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                      <Gauge className="h-4 w-4" />
                      Delivery Health Score
                    </div>
                    <div className="mt-3 text-3xl font-bold text-slate-900">{summary.healthScore}%</div>
                    <p className="mt-1 text-xs text-slate-600">Composite signal across governed execution health, compliance, and operational risk pressure.</p>
                    <div className="mt-3 h-2 rounded-full bg-blue-100">
                      <div className="h-2 rounded-full bg-blue-600" style={{ width: `${summary.healthScore}%` }} />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <div className={workspaceMainColumnClass(navDocked, isWorkspaceCollapsed, enterpriseNavWidthVariant)}>
          {isFiltersEligiblePanel && showFiltersPanel ? filtersCard : null}

          {loadError ? (
            <CompactWarningMessage
              icon={AlertTriangle}
              title="Governance matrix could not be loaded"
              description="An error occurred while loading governance matrix data. Make sure all backend services are running normally."
              actionLabel="Try again"
              onAction={() => setLoadError(null)}
            />
          ) : null}

          {activePanel === 'overview' ? (
            <div className="grid grid-cols-1 gap-4">
              <Panel
                id="overview"
                panelRef={overviewMainPanelRef}
                title="Delivery Governance Overview"
                description="Executive operational posture for governed delivery execution, risk exposure, and program health."
                right={overviewRight}
              >
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Delivery objective distribution</div>
                        <div className="mt-2 text-lg font-semibold text-slate-900">Portfolios by delivery objective</div>
                        <div className="mt-1 text-xs text-slate-600">Operational grouping across governed delivery objectives.</div>
                      </div>
                      <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">Time period: {timePeriod}</Badge>
                    </div>
                    <div className="mt-4 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={strategicDistribution} dataKey="count" nameKey="name" innerRadius={56} outerRadius={92} paddingAngle={4}>
                            {strategicDistribution.map((entry, index) => (
                              <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Delivery health</div>
                        <div className="mt-2 text-lg font-semibold text-slate-900">Executive delivery health score</div>
                        <div className="mt-1 text-xs text-slate-600">Signal blended from governed execution, compliance, and operational risk pressure.</div>
                      </div>
                      <Badge className={cn('rounded-full border bg-white', scoreTone(summary.healthScore))}>
                        {summary.healthScore >= 85 ? 'Strong' : summary.healthScore >= 70 ? 'Watch' : 'Escalate'}
                      </Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Compliance score</div>
                        <div className={cn('mt-2 text-2xl font-bold', scoreTone(summary.complianceScore))}>{summary.complianceScore}</div>
                        <div className="mt-1 text-xs text-slate-600">Policy adherence and audit readiness</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Risk pressure</div>
                        <div className={cn('mt-2 text-2xl font-bold', summary.riskPressure >= 80 ? 'text-rose-700' : summary.riskPressure >= 65 ? 'text-amber-700' : 'text-emerald-700')}>
                          {summary.riskPressure}
                        </div>
                        <div className="mt-1 text-xs text-slate-600">Open escalations and critical items</div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white/90 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-slate-800">Health trend</div>
                        <div className="text-[11px] text-slate-500">Last 8 checkpoints</div>
                      </div>
                      <div className="mt-2 h-14">
                        <SparkArea data={healthSpark} color="#2563eb" />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {['Review delivery governance posture', 'Escalate at-risk initiatives', 'Export delivery governance pack'].map((action) => (
                          <button key={action} className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 hover:border-blue-300 hover:text-blue-700">
                            {action}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>
            </div>
          ) : null}

          {activePanel === 'portfolio-management' ? (
            <Panel
              id="portfolio-management"
              title="Portfolio Delivery Management Panel"
              description="Delivery portfolio and program directory with inline execution governance controls and detail drawer."
              right={
                <div className="flex items-center gap-2">
                  <Button className="h-8 rounded-full px-3 text-xs">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Portfolio
                  </Button>
                  <Button variant="outline" className="h-8 rounded-full border-slate-200 px-3 text-xs text-slate-700">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              }
            >
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-[1260px] w-full text-xs">
                    <thead className="bg-slate-50/95 text-slate-600">
                      <tr>
                        {['Portfolio / Program', 'Owner', '# Projects', 'Budget / Value', 'Progress', 'Health', 'Risk', 'Compliance', 'Status', 'Last updated', 'Actions'].map((header) => (
                          <th key={header} className="px-3 py-3 text-left font-semibold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPortfolios.map((item) => (
                        <tr
                          key={item.id}
                          className="border-t border-slate-100 bg-white/90 transition hover:bg-blue-50/35"
                          onClick={() => setDrawer({ open: true, portfolioId: item.id })}
                        >
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <Badge className="rounded-full border border-slate-200 bg-slate-100 text-slate-700">{item.type}</Badge>
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-slate-900">{item.name}</div>
                                <div className="mt-1 text-[11px] text-slate-500">
                                  <span className="font-medium text-slate-600">{item.id}</span> • Objective: {item.objective}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-slate-700">{item.owner}</td>
                          <td className="px-3 py-3 text-slate-700">{item.projects}</td>
                          <td className="px-3 py-3 text-slate-700">
                            {formatMoney(item.budget)} / {formatMoney(item.value)}
                          </td>
                          <td className="px-3 py-3">
                            <div className="w-28 rounded-full bg-slate-100">
                              <div className="h-2 rounded-full bg-blue-600" style={{ width: `${item.progress}%` }} />
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500">{item.progress}%</div>
                          </td>
                          <td className="px-3 py-3">
                            <Badge className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', healthToneClasses(item.health))}>{item.health}</Badge>
                          </td>
                          <td className="px-3 py-3">
                            <Badge className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', riskToneClasses(item.risk))}>{item.risk}</Badge>
                          </td>
                          <td className="px-3 py-3">
                            <Badge className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', complianceToneClasses(item.compliance))}>{item.compliance}</Badge>
                          </td>
                          <td className="px-3 py-3 text-slate-700">{item.status}</td>
                          <td className="px-3 py-3 text-slate-700">{item.updatedAt}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                              {['Open', 'Edit', 'View Programs', 'Assign Owner', 'Archive'].map((action) => (
                                <button key={action} className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 hover:border-blue-300 hover:text-blue-700">
                                  {action}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Panel>
          ) : null}

          {activePanel === 'grouping' ? (
            <Panel
              id="grouping"
              title="Program & Initiative Coordination Panel"
              description="Coordinate initiative hierarchy, delivery grouping, dependency flow, and execution roll-up visibility."
              right={
                <div className="flex items-center gap-2">
                  <Button className="h-8 rounded-full px-3 text-xs">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Initiative
                  </Button>
                  <Button variant="outline" className="h-8 rounded-full border-slate-200 px-3 text-xs text-slate-700">
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    Re-group Projects
                  </Button>
                </div>
              }
            >
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-3">
                  {INITIATIVE_TREE.map((entry) => (
                    <div key={entry.portfolio.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className="rounded-full border border-blue-200 bg-blue-50 text-blue-700">Portfolio</Badge>
                            <span className="text-sm font-semibold text-slate-900">{entry.portfolio.name}</span>
                            <Badge className={cn('rounded-full border bg-white', riskToneClasses(entry.portfolio.risk))}>{entry.portfolio.risk}</Badge>
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            Owner: <span className="font-medium text-slate-800">{entry.portfolio.owner}</span> • Value delivered:{' '}
                            <span className="font-semibold text-slate-900">{formatMoney(entry.portfolio.valueDelivered)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-semibold text-slate-700">Progress</div>
                          <div className="mt-1 text-2xl font-bold text-slate-900">{entry.portfolio.progress}%</div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3">
                        {entry.programs.map((program) => (
                          <div key={program.id} className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge className="rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700">Program</Badge>
                                  <span className="text-sm font-semibold text-slate-900">{program.name}</span>
                                  <Badge className={cn('rounded-full border bg-white', riskToneClasses(program.risk))}>{program.risk}</Badge>
                                  <Badge className={cn('rounded-full border bg-white', healthToneClasses(program.status as HealthTone))}>{program.status}</Badge>
                                </div>
                                <div className="mt-1 text-xs text-slate-600">
                                  Owner: <span className="font-medium text-slate-800">{program.owner}</span> • Value delivered:{' '}
                                  <span className="font-semibold text-slate-900">{formatMoney(program.valueDelivered)}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-semibold text-slate-700">Progress</div>
                                <div className="mt-1 text-xl font-bold text-slate-900">{program.progress}%</div>
                              </div>
                            </div>

                            {program.children?.length ? (
                              <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-2">
                                {program.children.map((initiative) => (
                                  <div key={initiative.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="truncate text-sm font-semibold text-slate-900">{initiative.name}</div>
                                        <div className="mt-1 text-[11px] text-slate-600">
                                          Owner: <span className="font-medium text-slate-800">{initiative.owner}</span>
                                        </div>
                                      </div>
                                      <Badge className={cn('rounded-full border bg-white', riskToneClasses(initiative.risk))}>{initiative.risk}</Badge>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
                                      <span>Value delivered</span>
                                      <span className="font-semibold text-slate-900">{formatMoney(initiative.valueDelivered)}</span>
                                    </div>
                                    <div className="mt-2 h-2 rounded-full bg-slate-100">
                                      <div className="h-2 rounded-full bg-blue-600" style={{ width: `${initiative.progress}%` }} />
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {['Create Initiative', 'Move Initiative', 'Link Project'].map((action) => (
                                        <button key={action} className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 hover:border-blue-300 hover:text-blue-700">
                                          {action}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Grouping controls</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">Actions & governance posture</div>
                        <div className="mt-1 text-xs text-slate-600">Use these controls for restructuring and governance approvals.</div>
                      </div>
                      <ClipboardCheck className="h-5 w-5 text-slate-400" />
                    </div>
                    <div className="mt-4 space-y-2 text-xs">
                      {[
                        { label: 'Create Initiative', icon: Plus, note: 'Add a governed initiative and assign ownership.' },
                        { label: 'Move Initiative', icon: ArrowRightLeft, note: 'Re-align initiative under different program/portfolio.' },
                        { label: 'Re-group Projects', icon: Layers3, note: 'Restructure project roll-ups and refresh KPIs.' },
                        { label: 'Submit governance update', icon: ShieldCheck, note: 'Trigger stage gate evidence checks for changes.' },
                      ].map((item) => (
                        <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white/90 p-3">
                          <div className="rounded-xl border border-blue-200 bg-blue-50 p-2 text-blue-700">
                            <item.icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900">{item.label}</div>
                            <div className="mt-1 text-[11px] text-slate-600">{item.note}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Drill-down readiness</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">Portfolio → Program → Initiative → Project</div>
                    <div className="mt-2 space-y-2 text-xs text-slate-700">
                      {[
                        'Click any portfolio or program to open the detail drawer.',
                        'Use governance actions to enforce evidence before approvals.',
                        'Review delivery alignment and KPIs before reprioritization.',
                      ].map((line) => (
                        <div key={line} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                          <span>{line}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Panel>
          ) : null}

          {activePanel === 'alignment' ? (
            <Panel
              id="alignment"
              title="Initiative Delivery Alignment Panel"
              description="Operational alignment between initiatives, delivery objectives, and governed execution outcomes."
              right={
                <div className="flex items-center gap-2">
                  <Button className="h-8 rounded-full px-3 text-xs">
                    <GitBranch className="mr-2 h-4 w-4" />
                    Link Initiative to Delivery Objective
                  </Button>
                  <Button variant="outline" className="h-8 rounded-full border-slate-200 px-3 text-xs text-slate-700">
                    <Pencil className="mr-2 h-4 w-4" />
                    Adjust Alignment
                  </Button>
                </div>
              }
            >
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50/90 text-slate-600">
                      <tr>
                        {['Delivery objective', 'Linked portfolios / initiatives', 'Contribution', 'Alignment score', 'Actions'].map((header) => (
                          <th key={header} className="px-3 py-3 text-left font-semibold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {STRATEGY_MAP.map((row) => (
                        <tr key={row.objective} className="border-t border-slate-100 bg-white/90">
                          <td className="px-3 py-3 font-semibold text-slate-900">{row.objective}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1">
                              {row.linked.map((link) => (
                                <button
                                  key={link.ref}
                                  type="button"
                                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:border-blue-300 hover:text-blue-700"
                                  onClick={() => setDrawer({ open: true, portfolioId: link.ref.startsWith('PFO') || link.ref.startsWith('PRG') ? link.ref : 'PFO-001' })}
                                >
                                  {link.type}: {link.name}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <Badge className={cn('rounded-full border bg-white', row.contribution === 'High' ? 'text-blue-700 border-blue-200 bg-blue-50' : row.contribution === 'Medium' ? 'text-amber-700 border-amber-200 bg-amber-50' : 'text-slate-700 border-slate-200 bg-slate-100')}>
                              {row.contribution}
                            </Badge>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-24 rounded-full bg-slate-100">
                                <div className="h-2 rounded-full bg-blue-600" style={{ width: `${row.alignmentScore}%` }} />
                              </div>
                              <span className={cn('font-semibold', scoreTone(row.alignmentScore))}>{row.alignmentScore}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1">
                              {['Review Contribution', 'Link Initiative', 'PMO Notes'].map((action) => (
                                <button key={action} className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 hover:border-blue-300 hover:text-blue-700">
                                  {action}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Alignment posture</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">PMO delivery alignment scorecard</div>
                      <div className="mt-1 text-xs text-slate-600">Use this view during PMO delivery governance reviews.</div>
                    </div>
                    <Compass className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">High alignment</div>
                      <div className="mt-2 text-2xl font-bold text-emerald-700">{STRATEGY_MAP.filter((s) => s.alignmentScore >= 85).length}</div>
                      <div className="mt-1 text-xs text-slate-600">Objectives within target contribution</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Needs review</div>
                      <div className="mt-2 text-2xl font-bold text-amber-700">{STRATEGY_MAP.filter((s) => s.alignmentScore < 80).length}</div>
                      <div className="mt-1 text-xs text-slate-600">Potential misalignment or scope drift</div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white/90 p-3">
                    <div className="text-xs font-semibold text-slate-800">Recommended actions</div>
                    <div className="mt-2 space-y-2 text-xs text-slate-700">
                      {[
                        'Link initiatives to objectives before reprioritization.',
                        'Adjust alignment when scope changes occur (stage gate evidence required).',
                        'Review contribution scores with PMO and business owners.',
                      ].map((line) => (
                        <div key={line} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                          <span>{line}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Panel>
          ) : null}

          {activePanel === 'okr-kpi' ? (
            <Panel
              id="okr-kpi"
              title="OKR / KPI Delivery Mapping Panel"
              description="Track delivery contribution toward governed KPIs and operational objectives across initiatives."
              right={
                <div className="flex items-center gap-2">
                  <Button className="h-8 rounded-full px-3 text-xs">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Objective
                  </Button>
                  <Button variant="outline" className="h-8 rounded-full border-slate-200 px-3 text-xs text-slate-700">
                    <Activity className="mr-2 h-4 w-4" />
                    Update KPI
                  </Button>
                </div>
              }
            >
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {OKRS.map((objective) => (
                  <div key={objective.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="rounded-full border border-blue-200 bg-blue-50 text-blue-700">{objective.id}</Badge>
                          <span className="truncate text-sm font-semibold text-slate-900">{objective.title}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          Owner: <span className="font-medium text-slate-800">{objective.owner}</span>
                        </div>
                      </div>
                      <Badge className={cn('rounded-full border bg-white', scoreTone(objective.progress))}>{objective.progress}%</Badge>
                    </div>

                    <div className="mt-3 h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-blue-600" style={{ width: `${objective.progress}%` }} />
                    </div>

                    <div className="mt-4 space-y-2">
                      {objective.keyResults.map((kr) => (
                        <div key={kr.id} className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900">
                                {kr.id} • {kr.title}
                              </div>
                              <div className="mt-1 text-[11px] text-slate-600">
                                Target: <span className="font-semibold text-slate-900">{kr.target}</span> • Actual:{' '}
                                <span className="font-semibold text-slate-900">{kr.actual}</span>
                              </div>
                            </div>
                            <Badge className={cn('rounded-full border bg-white', scoreTone(kr.progress))}>{kr.progress}%</Badge>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-slate-100">
                            <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${kr.progress}%` }} />
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {kr.linkedRefs.map((ref) => (
                              <button
                                key={ref}
                                className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600 hover:border-blue-300 hover:text-blue-700"
                                onClick={() => setDrawer({ open: true, portfolioId: ref.startsWith('PFO') || ref.startsWith('PRG') ? ref : 'PFO-001' })}
                                type="button"
                              >
                                Link: {ref}
                              </button>
                            ))}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {['Link Project', 'Review KPI', 'Add Evidence'].map((action) => (
                              <button key={action} className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 hover:border-blue-300 hover:text-blue-700">
                                {action}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          {activePanel === 'benefits' ? (
            <Panel
              id="benefits"
              title="Delivery Outcome Tracking Panel"
              description="Operational outcome realization and governed delivery value monitoring."
              right={
                <div className="flex items-center gap-2">
                  <Button className="h-8 rounded-full px-3 text-xs">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Update Delivery Outcome
                  </Button>
                  <Button variant="outline" className="h-8 rounded-full border-slate-200 px-3 text-xs text-slate-700">
                    <Download className="mr-2 h-4 w-4" />
                    Export Outcome Report
                  </Button>
                </div>
              }
            >
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Value delivery</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">Planned vs realized delivery outcomes (K$)</div>
                      <div className="mt-1 text-xs text-slate-600">Operational outcome trajectory for PMO delivery reporting.</div>
                    </div>
                    <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">K$</Badge>
                  </div>
                  <div className="mt-4 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={benefitsChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} interval={0} angle={-8} height={52} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="planned" radius={[8, 8, 0, 0]} fill="#93c5fd" />
                        <Bar dataKey="realized" radius={[8, 8, 0, 0]} fill="#2563eb" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="space-y-3">
                  {BENEFITS.map((b) => {
                    const variance = b.realized - b.planned
                    const varianceLabel = variance === 0 ? 'On plan' : variance > 0 ? `+${formatMoney(variance)}` : formatMoney(variance)
                    const varianceTone = variance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    const statusTone =
                      b.status === 'Ahead'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : b.status === 'Behind'
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700'

                    return (
                      <div key={b.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">{b.id}</Badge>
                              <span className="truncate text-sm font-semibold text-slate-900">{b.label}</span>
                            </div>
                            <div className="mt-1 text-xs text-slate-600">
                              Owner: <span className="font-medium text-slate-800">{b.owner}</span>
                            </div>
                          </div>
                          <Badge className={cn('rounded-full border', statusTone)}>{b.status}</Badge>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                          <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Planned</div>
                            <div className="mt-2 text-lg font-bold text-slate-900">{formatMoney(b.planned)}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Realized</div>
                            <div className="mt-2 text-lg font-bold text-slate-900">{formatMoney(b.realized)}</div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="text-slate-600">
                            Variance: <span className={cn('font-semibold', varianceTone)}>{varianceLabel}</span>
                          </div>
                          <div className="text-slate-600">
                            ROI: <span className="font-semibold text-slate-900">{b.roi.toFixed(2)}x</span>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1">
                          {['Validate Outcome', 'Update Delivery Outcome', 'Export Summary'].map((action) => (
                            <button key={action} className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 hover:border-blue-300 hover:text-blue-700">
                              {action}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </Panel>
          ) : null}

          {activePanel === 'risk-register' ? (
            <Panel
              id="risk-register"
              title="Delivery Risk Register Panel"
              description="Operational delivery risks with score, ownership, mitigation progress, escalation readiness, and governance exposure."
              right={
                <div className="flex items-center gap-2">
                  <Button className="h-8 rounded-full px-3 text-xs">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Risk
                  </Button>
                  <Button variant="outline" className="h-8 rounded-full border-slate-200 px-3 text-xs text-slate-700">
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Escalate Risk
                  </Button>
                </div>
              }
            >
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Risk heatmap</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">Impact × Probability</div>
                      <div className="mt-1 text-xs text-slate-600">Operational heat view of current open delivery risk posture.</div>
                    </div>
                    <AlertTriangle className="h-5 w-5 text-slate-400" />
                  </div>

                  <div className="mt-4 grid grid-cols-5 gap-2">
                    {Array.from({ length: 25 }).map((_, index) => {
                      const impact = 5 - Math.floor(index / 5)
                      const prob = (index % 5) + 1
                      const score = impact * prob
                      const tone =
                        score >= 20 ? 'bg-rose-500/90' : score >= 12 ? 'bg-amber-500/90' : score >= 6 ? 'bg-blue-500/80' : 'bg-emerald-500/75'
                      const matched = RISKS.some((r) => r.impact === impact && r.probability === prob)
                      return (
                        <div
                          key={`${impact}-${prob}`}
                          className={cn(
                            'relative h-10 rounded-xl border border-white/40 shadow-sm transition',
                            tone,
                            matched ? 'ring-2 ring-slate-900/10' : 'opacity-85'
                          )}
                          title={`Impact ${impact} / Probability ${prob} (score ${score})`}
                        >
                          <span className="absolute left-2 top-2 text-[10px] font-semibold text-white/90">
                            {impact}×{prob}
                          </span>
                          {matched ? <span className="absolute bottom-2 right-2 h-2 w-2 rounded-full bg-white" /> : null}
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white/90 p-3 text-xs text-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-slate-900">Heatmap legend</div>
                      <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">{RISKS.length} risks</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {[
                        { label: 'Low', cls: 'bg-emerald-500/75' },
                        { label: 'Moderate', cls: 'bg-blue-500/80' },
                        { label: 'High', cls: 'bg-amber-500/90' },
                        { label: 'Critical', cls: 'bg-rose-500/90' },
                      ].map((l) => (
                        <div key={l.label} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <span className={cn('h-2.5 w-2.5 rounded-full', l.cls)} />
                          <span className="text-[11px] font-semibold text-slate-700">{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50/90 text-slate-600">
                      <tr>
                        {['Risk ID', 'Description', 'Impact', 'Probability', 'Score', 'Owner', 'Mitigation plan', 'Status', 'Actions'].map((header) => (
                          <th key={header} className="px-3 py-3 text-left font-semibold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {RISKS.map((risk) => {
                        const score = risk.impact * risk.probability
                        const scoreCls = score >= 20 ? 'text-rose-700' : score >= 12 ? 'text-amber-700' : 'text-emerald-700'
                        return (
                          <tr key={risk.id} className="border-t border-slate-100 bg-white/90">
                            <td className="px-3 py-3 font-semibold text-slate-900">{risk.id}</td>
                            <td className="px-3 py-3 text-slate-700">{risk.description}</td>
                            <td className="px-3 py-3 text-slate-700">{risk.impact}</td>
                            <td className="px-3 py-3 text-slate-700">{risk.probability}</td>
                            <td className={cn('px-3 py-3 font-semibold', scoreCls)}>{score}</td>
                            <td className="px-3 py-3 text-slate-700">{risk.owner}</td>
                            <td className="px-3 py-3 text-slate-700">{risk.mitigation}</td>
                            <td className="px-3 py-3">
                              <Badge
                                className={cn(
                                  'rounded-full border',
                                  risk.status === 'Closed'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : risk.status === 'Escalated'
                                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                                      : risk.status === 'Mitigating'
                                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                                        : 'border-amber-200 bg-amber-50 text-amber-700'
                                )}
                              >
                                {risk.status}
                              </Badge>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap gap-1">
                                {['Update', 'Assign Owner', 'Escalate'].map((action) => (
                                  <button key={action} className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 hover:border-blue-300 hover:text-blue-700">
                                    {action}
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </Panel>
          ) : null}

          {activePanel === 'issues' ? (
            <Panel
              id="issues"
              title="Delivery Issue Management Panel"
              description="Execution blockers, operational issues, governance impediments, and resolution workflows."
              right={
                <div className="flex items-center gap-2">
                  <Button className="h-8 rounded-full px-3 text-xs">
                    <Plus className="mr-2 h-4 w-4" />
                    Log Issue
                  </Button>
                  <Button variant="outline" className="h-8 rounded-full border-slate-200 px-3 text-xs text-slate-700">
                    <Users className="mr-2 h-4 w-4" />
                    Assign Owner
                  </Button>
                </div>
              }
            >
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50/90 text-slate-600">
                    <tr>
                      {['Issue ID', 'Description', 'Severity', 'Linked project', 'Owner', 'Status', 'Resolution progress', 'Actions'].map((header) => (
                        <th key={header} className="px-3 py-3 text-left font-semibold">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ISSUES.map((issue) => {
                      const sevTone = issue.severity === 'Critical'
                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                        : issue.severity === 'High'
                          ? 'border-orange-200 bg-orange-50 text-orange-700'
                          : issue.severity === 'Medium'
                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'

                      const statusTone =
                        issue.status === 'Resolved'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : issue.status === 'Blocked'
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : issue.status === 'In Progress'
                              ? 'border-blue-200 bg-blue-50 text-blue-700'
                              : 'border-amber-200 bg-amber-50 text-amber-700'

                      return (
                        <tr key={issue.id} className="border-t border-slate-100 bg-white/90">
                          <td className="px-3 py-3 font-semibold text-slate-900">{issue.id}</td>
                          <td className="px-3 py-3 text-slate-700">{issue.description}</td>
                          <td className="px-3 py-3">
                            <Badge className={cn('rounded-full border', sevTone)}>{issue.severity}</Badge>
                          </td>
                          <td className="px-3 py-3 text-slate-700">{issue.linkedProject}</td>
                          <td className="px-3 py-3 text-slate-700">{issue.owner}</td>
                          <td className="px-3 py-3">
                            <Badge className={cn('rounded-full border', statusTone)}>{issue.status}</Badge>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-28 rounded-full bg-slate-100">
                                <div className="h-2 rounded-full bg-blue-600" style={{ width: `${issue.resolutionProgress}%` }} />
                              </div>
                              <span className="text-[11px] font-semibold text-slate-700">{issue.resolutionProgress}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1">
                              {['Resolve', 'Escalate', 'Add Evidence'].map((action) => (
                                <button key={action} className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 hover:border-blue-300 hover:text-blue-700">
                                  {action}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}

          {activePanel === 'stage-gates' ? (
            <Panel
              id="stage-gates"
              title="Stage Gate Control Panel"
              description="Lifecycle approval checkpoints, evidence validation, and governed release progression."
              right={
                <div className="flex items-center gap-2">
                  <Button className="h-8 rounded-full px-3 text-xs">
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Submit for Approval
                  </Button>
                  <Button variant="outline" className="h-8 rounded-full border-slate-200 px-3 text-xs text-slate-700">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Review Gate
                  </Button>
                </div>
              }
            >
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Governance pipeline</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">Initiate → Plan → Execute → Monitor → Close</div>
                  <div className="mt-4 grid grid-cols-5 gap-2">
                    {(['Initiate', 'Plan', 'Execute', 'Monitor', 'Close'] as const).map((stage) => (
                      <div key={stage} className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{stage}</div>
                        <div className="mt-2 space-y-2">
                          {STAGE_GATES.filter((g) => g.stage === stage).map((gate) => (
                            <div key={`${gate.stage}-${gate.linked}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]">
                              <div className="flex items-center justify-between gap-2">
                                <Badge className={cn('rounded-full border px-2 py-0.5 text-[10px]', gateToneClasses(gate.gateStatus))}>{gate.gateStatus}</Badge>
                                <span className="font-semibold text-slate-700">{gate.linked}</span>
                              </div>
                              <div className="mt-1 text-slate-600">{gate.notes}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50/90 text-slate-600">
                      <tr>
                        {['Stage', 'Gate status', 'Approvers', 'Approval date', 'Compliance notes', 'Actions'].map((header) => (
                          <th key={header} className="px-3 py-3 text-left font-semibold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {STAGE_GATES.map((gate) => (
                        <tr key={`${gate.stage}-${gate.linked}`} className="border-t border-slate-100 bg-white/90">
                          <td className="px-3 py-3 font-semibold text-slate-900">{gate.stage}</td>
                          <td className="px-3 py-3">
                            <Badge className={cn('rounded-full border', gateToneClasses(gate.gateStatus))}>{gate.gateStatus}</Badge>
                          </td>
                          <td className="px-3 py-3 text-slate-700">{gate.approvers.join(', ')}</td>
                          <td className="px-3 py-3 text-slate-700">{gate.approvalDate}</td>
                          <td className="px-3 py-3 text-slate-700">{gate.notes}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1">
                              {['Approve', 'Reject', 'Review'].map((action) => (
                                <button key={action} className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 hover:border-blue-300 hover:text-blue-700">
                                  {action}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Panel>
          ) : null}

          {activePanel === 'compliance' ? (
            <Panel
              id="compliance"
              title="Delivery Compliance Tracking Panel"
              description="Delivery compliance posture, missing evidence, operational violations, and audit readiness."
              right={
                <div className="flex items-center gap-2">
                  <Button className="h-8 rounded-full px-3 text-xs">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Review Compliance
                  </Button>
                  <Button variant="outline" className="h-8 rounded-full border-slate-200 px-3 text-xs text-slate-700">
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Request Audit
                  </Button>
                </div>
              }
            >
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                {COMPLIANCE.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">{row.id}</Badge>
                          <Badge className={cn('rounded-full border', complianceToneClasses(row.status))}>{row.status}</Badge>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">Linked: {row.linked}</div>
                        <div className="mt-1 text-xs text-slate-600">Compliance signal for governance policy adherence.</div>
                      </div>
                      <ShieldCheck className="h-5 w-5 text-slate-400" />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Violations</div>
                        <div className={cn('mt-2 text-2xl font-bold', row.violations === 0 ? 'text-emerald-700' : row.violations <= 2 ? 'text-amber-700' : 'text-rose-700')}>
                          {row.violations}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Missing docs</div>
                        <div className={cn('mt-2 text-2xl font-bold', row.missingDocs <= 2 ? 'text-emerald-700' : row.missingDocs <= 5 ? 'text-amber-700' : 'text-rose-700')}>
                          {row.missingDocs}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {[
                        { label: 'Audit readiness', value: row.auditReadiness },
                        { label: 'Policy adherence score', value: row.policyScore },
                      ].map((metric) => (
                        <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">{metric.label}</span>
                            <span className={cn('font-semibold', scoreTone(metric.value))}>{metric.value}%</span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-slate-100">
                            <div className="h-2 rounded-full bg-blue-600" style={{ width: `${metric.value}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {['Fix Violation', 'Request Evidence', 'Export Compliance Pack'].map((action) => (
                        <button key={action} className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 hover:border-blue-300 hover:text-blue-700">
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          {activePanel === 'audit' ? (
            <Panel
              id="audit"
              title="Delivery Audit Trail Panel"
              description="Trace governed execution activities, operational decisions, evidence lineage, and audit history."
              right={
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="h-8 rounded-full border-slate-200 px-3 text-xs text-slate-700">
                    <Download className="mr-2 h-4 w-4" />
                    Export Audit Log
                  </Button>
                  <Button className="h-8 rounded-full px-3 text-xs">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter Activity
                  </Button>
                </div>
              }
            >
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50/90 text-slate-600">
                    <tr>
                      {['Timestamp', 'Actor', 'Action', 'Object', 'Change detail', 'Actions'].map((header) => (
                        <th key={header} className="px-3 py-3 text-left font-semibold">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {AUDIT_LOG.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 bg-white/90">
                        <td className="px-3 py-3 text-slate-700">{row.timestamp}</td>
                        <td className="px-3 py-3 text-slate-700">{row.actor}</td>
                        <td className="px-3 py-3 font-semibold text-slate-900">{row.action}</td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:border-blue-300 hover:text-blue-700"
                            onClick={() => setDrawer({ open: true, portfolioId: row.object })}
                          >
                            {row.object}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-slate-700">{row.changeDetail}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {['Drill down', 'Export row'].map((action) => (
                              <button key={action} className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 hover:border-blue-300 hover:text-blue-700">
                                {action}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>

      <Card className="border-emerald-200 bg-emerald-50/80 rounded-2xl">
        <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs text-emerald-800">
          <span className="inline-flex items-center gap-2">
            <BadgeCheck className="h-4 w-4" />
            Delivery governance dashboard is refreshed. Execution controls and audit traceability are ready.
          </span>
          <span className="inline-flex items-center gap-2 text-emerald-900/80">
            <ClipboardCheck className="h-4 w-4" />
            Period: <span className="font-semibold">{timePeriod}</span>
          </span>
        </CardContent>
      </Card>

      {drawer.open && drawerItem ? (
        <div className="fixed inset-0 z-[1200] flex justify-end bg-black/30" role="dialog" aria-modal="true">
          <div className="h-full w-full max-w-[460px] border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">Delivery Portfolio Detail Drawer</div>
                <div className="mt-1 text-xs text-slate-600">
                  {drawerItem.id} • {drawerItem.type} • {drawerItem.name}
                </div>
              </div>
              <button
                onClick={() => setDrawer({ open: false, portfolioId: null })}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close drawer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="h-[calc(100%-65px)] space-y-4 overflow-y-auto p-4 text-xs text-slate-700">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full border border-slate-200 bg-white text-slate-700">{drawerItem.type}</Badge>
                  <Badge className={cn('rounded-full border', healthToneClasses(drawerItem.health))}>{drawerItem.health}</Badge>
                  <Badge className={cn('rounded-full border', riskToneClasses(drawerItem.risk))}>{drawerItem.risk}</Badge>
                  <Badge className={cn('rounded-full border', complianceToneClasses(drawerItem.compliance))}>{drawerItem.compliance}</Badge>
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-900">{drawerItem.name}</div>
                <div className="mt-1 text-xs text-slate-600">
                  Delivery objective: <span className="font-medium text-slate-800">{drawerItem.objective}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Delivery portfolio information</div>
                <dl className="mt-3 space-y-2">
                  {[
                    ['Owner', drawerItem.owner],
                    ['Projects', String(drawerItem.projects)],
                    ['Budget', formatMoney(drawerItem.budget)],
                    ['Value', formatMoney(drawerItem.value)],
                    ['Progress', `${drawerItem.progress}%`],
                    ['Status', drawerItem.status],
                    ['Last updated', drawerItem.updatedAt],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="text-right font-medium text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Delivery alignment</div>
                <div className="mt-3 space-y-2">
                  {STRATEGY_MAP.filter((s) => s.linked.some((l) => l.ref === drawerItem.id)).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white/90 px-4 py-6 text-center">
                      <div className="text-sm font-semibold text-slate-900">No explicit delivery alignment mapping found.</div>
                      <div className="mt-1 text-xs text-slate-600">Link this portfolio to delivery objectives to improve execution traceability.</div>
                    </div>
                  ) : (
                    STRATEGY_MAP.filter((s) => s.linked.some((l) => l.ref === drawerItem.id)).map((row) => (
                      <div key={row.objective} className="rounded-xl border border-slate-200 bg-white/90 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-slate-900">{row.objective}</div>
                          <Badge className={cn('rounded-full border bg-white', scoreTone(row.alignmentScore))}>{row.alignmentScore}%</Badge>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-slate-100">
                          <div className="h-2 rounded-full bg-blue-600" style={{ width: `${row.alignmentScore}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Risk summary</div>
                <div className="mt-3 space-y-2">
                  {RISKS.filter((r) => r.linked === drawerItem.id).length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-3">
                      <div className="font-semibold text-slate-900">No registered risks linked.</div>
                      <div className="mt-1 text-[11px] text-slate-600">Use Delivery Risk Register to add risk and mitigation plans.</div>
                    </div>
                  ) : (
                    RISKS.filter((r) => r.linked === drawerItem.id).map((risk) => (
                      <div key={risk.id} className="rounded-xl border border-slate-200 bg-white/90 px-3 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-slate-900">{risk.id}</div>
                          <Badge className={cn('rounded-full border', risk.status === 'Escalated' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-700')}>
                            {risk.status}
                          </Badge>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-600">{risk.description}</div>
                        <div className="mt-2 text-[11px] text-slate-600">
                          Score: <span className="font-semibold text-slate-900">{risk.impact * risk.probability}</span> • Owner:{' '}
                          <span className="font-semibold text-slate-900">{risk.owner}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Governance status</div>
                <div className="mt-3 space-y-2">
                  {STAGE_GATES.filter((g) => g.linked === drawerItem.id).length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-3">
                      <div className="font-semibold text-slate-900">No stage gate record linked.</div>
                      <div className="mt-1 text-[11px] text-slate-600">Create a governance checkpoint to ensure audit-ready approvals.</div>
                    </div>
                  ) : (
                    STAGE_GATES.filter((g) => g.linked === drawerItem.id).map((gate) => (
                      <div key={gate.stage} className="rounded-xl border border-slate-200 bg-white/90 px-3 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-slate-900">{gate.stage}</div>
                          <Badge className={cn('rounded-full border', gateToneClasses(gate.gateStatus))}>{gate.gateStatus}</Badge>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-600">{gate.notes}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Edit', icon: Pencil },
                  { label: 'Assign Owner', icon: Users },
                  { label: 'View Details', icon: Search },
                  { label: 'Export Summary', icon: Download },
                ].map((action) => (
                  <Button key={action.label} variant="outline" className="h-9 rounded-full border-slate-200 text-xs text-slate-700">
                    <action.icon className="mr-2 h-4 w-4" />
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
