import { startTransition, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import {
  BadgeCheck,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  FileDown,
  FileUp,
  Filter,
  Goal,
  Lightbulb,
  MoveRight,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  Search,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Waypoints,
  X,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
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

type PriorityLevel = 'Critical' | 'High' | 'Medium' | 'Watch'
type ReviewStatus = 'Pending review' | 'Ready for decision' | 'Approved with oversight' | 'Needs expert review'
type ConfidenceTone = 'High' | 'Medium' | 'Watch'

type IdeaRecord = {
  id: string
  title: string
  type: string
  priority: PriorityLevel
  strategicObjective: string
  feasibilityScore: number
  businessValueScore: number
  riskScore: number
  workspace: string
  owner: string
  reviewStatus: ReviewStatus
  category: string
  classificationConfidence: number
  rationale: string
  tags: string[]
  scoring: {
    businessValue: number
    effort: number
    risk: number
    roi: number
    feasibility: number
    strategicFit: number
    weightedOverall: number
    recommendation: string
    confidence: number
  }
  impact: {
    revenue: number
    costSaving: number
    productivity: number
    customer: number
    operational: number
    strategic: number
    magnitude: string
    confidence: number
    signals: string[]
  }
  prioritization: {
    rank: number
    weightedScore: number
    cluster: string
    tradeoff: string
  }
  feasibility: {
    level: string
    limitingFactors: string[]
    dependencies: string[]
    nextStep: string
  }
  alignment: {
    objective: string
    strength: number
    theme: string
    rationale: string
    linkedInitiatives: string[]
  }
  execution: {
    path: string
    reason: string
    effortRange: string
    suggestedOwner: string
    urgency: string
  }
  portfolio: {
    name: string
    domain: string
    resourceFit: string
    valueConcentration: string
    conflicts: string[]
    fitScore: number
  }
  explainability: {
    confidence: number
    topFactors: { label: string; score: number; tone: ConfidenceTone }[]
    businessSignals: string[]
    dataUsed: string[]
    summary: string
  }
  queue: {
    recommendationType: string
    suggestedAction: string
    status: string
    timestamp: string
  }
  reviewHistory: string[]
}

type DrawerContext = {
  section: string
  insight: string
}

type FilterState = {
  ideaType: string
  priority: string
  strategicObjective: string
  feasibility: string
  businessValue: string
  risk: string
  workspace: string
  owner: string
  reviewStatus: string
  timePeriod: string
}

const cardSurface =
  'border-slate-200/80 bg-white/92 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] backdrop-blur supports-[backdrop-filter]:bg-white/85'

type PanelId =
  | 'overview'
  | 'classification'
  | 'scoring'
  | 'impact'
  | 'prioritization'
  | 'feasibility'
  | 'alignment'
  | 'execution'
  | 'portfolio'
  | 'explainability'
  | 'matrix'
  | 'queue'
  | 'audit'

type PanelItem = {
  id: PanelId
  label: string
  description: string
  icon: ComponentType<{ className?: string }>
  badge: string
  group: 'Command Center' | 'Control Library' | 'Assurance & Traceability'
}

const PANEL_ITEMS: PanelItem[] = [
  {
    id: 'overview',
    label: 'Intelligence Overview',
    description: 'Portfolio-level health, confidence, and distribution across priority segments.',
    icon: Sparkles,
    badge: 'Command',
    group: 'Command Center',
  },
  {
    id: 'classification',
    label: 'Auto Classification',
    description: 'AI categorization, rationale, and tag themes with governance controls.',
    icon: BrainCircuit,
    badge: 'Core',
    group: 'Control Library',
  },
  {
    id: 'scoring',
    label: 'Scoring Recommendation',
    description: 'Weighted scorecards, factor radar, and scoring confidence for a selected idea.',
    icon: BarChart3,
    badge: 'Model',
    group: 'Control Library',
  },
  {
    id: 'impact',
    label: 'Impact Prediction',
    description: 'Forecasted impact across revenue, cost, productivity, customer, and strategy.',
    icon: TrendingUp,
    badge: 'Signal',
    group: 'Control Library',
  },
  {
    id: 'prioritization',
    label: 'Prioritization',
    description: 'Ranked list balancing value, risk, feasibility, urgency, and readiness trade-offs.',
    icon: Goal,
    badge: 'Flow',
    group: 'Assurance & Traceability',
  },
  {
    id: 'feasibility',
    label: 'Feasibility',
    description: 'Technical constraints, dependencies, limiting factors, and next steps.',
    icon: ShieldAlert,
    badge: 'Risk',
    group: 'Assurance & Traceability',
  },
  {
    id: 'alignment',
    label: 'Strategic Alignment',
    description: 'Objective mapping, alignment strength, theme, and linked initiative candidates.',
    icon: Waypoints,
    badge: 'Fit',
    group: 'Assurance & Traceability',
  },
  {
    id: 'execution',
    label: 'Execution Path',
    description: 'AI-suggested routing into project, epic, backlog, experiment, or roadmap.',
    icon: MoveRight,
    badge: 'Route',
    group: 'Assurance & Traceability',
  },
  {
    id: 'portfolio',
    label: 'Portfolio Allocation',
    description: 'Portfolio placement recommendation with overlap checks and fit reasoning.',
    icon: BadgeCheck,
    badge: 'People',
    group: 'Assurance & Traceability',
  },
  {
    id: 'explainability',
    label: 'Explainability',
    description: 'Top factors, data sources, business signals, and human-readable reasoning.',
    icon: CircleDot,
    badge: 'Audit',
    group: 'Assurance & Traceability',
  },
  {
    id: 'matrix',
    label: 'Decision Matrix',
    description: 'Value vs effort matrix and decision board for steering committees.',
    icon: Filter,
    badge: 'Board',
    group: 'Control Library',
  },
  {
    id: 'queue',
    label: 'Recommendation Queue',
    description: 'Items awaiting human decision before routing or execution commitment.',
    icon: PanelRightOpen,
    badge: 'Queue',
    group: 'Control Library',
  },
  {
    id: 'audit',
    label: 'AI Activity & Audit',
    description: 'Trace of classification, scoring, impact, ranking, and routing events.',
    icon: FileDown,
    badge: 'Log',
    group: 'Assurance & Traceability',
  },
]

const PANEL_GROUPS: Array<{ group: PanelItem['group']; items: PanelItem[] }> = [
  { group: 'Command Center', items: PANEL_ITEMS.filter((item) => item.group === 'Command Center') },
  { group: 'Control Library', items: PANEL_ITEMS.filter((item) => item.group === 'Control Library') },
  { group: 'Assurance & Traceability', items: PANEL_ITEMS.filter((item) => item.group === 'Assurance & Traceability') },
]

function Panel({
  id,
  title,
  description,
  highlight,
  right,
  children,
}: {
  id: string
  title: string
  description: string
  highlight: boolean
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className={cn(
        'rounded-3xl border bg-white/90 shadow-[0_16px_50px_rgba(15,23,42,0.08)] transition-all',
        highlight ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200/80'
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

function kpiCardChrome(cardId: string): string {
  const base =
    'rounded-2xl p-4 transition-all duration-200 relative overflow-hidden group border border-white/40 ring-1 ring-black/[0.04] shadow-[0_14px_40px_rgba(15,23,42,0.10)] hover:-translate-y-0.5 hover:shadow-[0_18px_56px_rgba(15,23,42,0.14)]'

  if (cardId === 'total') return cn(base, 'bg-gradient-to-br from-slate-50/85 via-white/90 to-sky-50/75')
  if (cardId === 'priority') return cn(base, 'bg-gradient-to-br from-indigo-50/70 via-white/90 to-violet-50/70')
  if (cardId === 'impact') return cn(base, 'bg-gradient-to-br from-emerald-50/70 via-white/90 to-cyan-50/70')
  if (cardId === 'feasibility') return cn(base, 'bg-gradient-to-br from-rose-50/70 via-white/90 to-amber-50/70')
  if (cardId === 'alignment') return cn(base, 'bg-gradient-to-br from-sky-50/70 via-white/90 to-blue-50/70')
  return cn(base, 'bg-gradient-to-br from-cyan-50/70 via-white/90 to-blue-50/70')
}

function KpiSparkline({ data, color }: { data: ReadonlyArray<number>; color: string }) {
  const chartData = data.map((value, index) => ({ idx: index, value }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={`tectona-ai-kpi-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={color} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.8}
          fill={`url(#tectona-ai-kpi-${color.replace('#', '')})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

const ideas: IdeaRecord[] = [
  {
    id: 'idea-101',
    title: 'AI-assisted vendor onboarding lane',
    type: 'Demand item',
    priority: 'Critical',
    strategicObjective: 'Accelerate partner launch readiness',
    feasibilityScore: 78,
    businessValueScore: 92,
    riskScore: 34,
    workspace: 'Enterprise PMO',
    owner: 'Rani Kusuma',
    reviewStatus: 'Ready for decision',
    category: 'Strategic initiative',
    classificationConfidence: 94,
    rationale: 'Signals show repeated onboarding delays, high executive attention, and measurable revenue unlock if external enablement is shortened.',
    tags: ['partner-growth', 'workflow', 'compliance', 'launch-readiness'],
    scoring: {
      businessValue: 93,
      effort: 58,
      risk: 31,
      roi: 88,
      feasibility: 78,
      strategicFit: 96,
      weightedOverall: 89,
      recommendation: 'Prioritize for acceleration',
      confidence: 93,
    },
    impact: {
      revenue: 88,
      costSaving: 56,
      productivity: 71,
      customer: 67,
      operational: 74,
      strategic: 94,
      magnitude: 'High revenue unlock with medium delivery effort',
      confidence: 91,
      signals: ['Vendor cycle time variance', 'Partner pipeline backlog', 'Compliance handoff delay'],
    },
    prioritization: {
      rank: 1,
      weightedScore: 91,
      cluster: 'Strategic quick acceleration',
      tradeoff: 'Value is materially higher than implementation cost, but compliance sequencing must stay gated.',
    },
    feasibility: {
      level: 'Moderate to high',
      limitingFactors: ['Identity approval dependency', 'API payload harmonization'],
      dependencies: ['Security sign-off', 'Integration mapping workshop'],
      nextStep: 'Route to cross-functional design sprint with compliance reviewer attached.',
    },
    alignment: {
      objective: 'Expand ecosystem-led revenue',
      strength: 95,
      theme: 'Partner growth operating model',
      rationale: 'Idea directly improves time-to-enable for revenue-producing partners and aligns to Q2 launch OKR.',
      linkedInitiatives: ['Partner 360 Program', 'Digital Onboarding Revamp'],
    },
    execution: {
      path: 'Convert to Project',
      reason: 'The idea spans multiple teams, has executive sponsorship, and already shows structured delivery readiness.',
      effortRange: '10 to 14 weeks',
      suggestedOwner: 'Partner Operations PMO',
      urgency: 'Start this quarter',
    },
    portfolio: {
      name: 'Growth & Distribution Portfolio',
      domain: 'Commercial acceleration',
      resourceFit: 'Strong fit with existing integration and compliance squad bandwidth',
      valueConcentration: 'High concentration in partner activation metrics',
      conflicts: ['Overlap with onboarding UX redesign'],
      fitScore: 92,
    },
    explainability: {
      confidence: 92,
      topFactors: [
        { label: 'Strategic fit', score: 96, tone: 'High' },
        { label: 'Revenue impact', score: 88, tone: 'High' },
        { label: 'Execution readiness', score: 82, tone: 'High' },
        { label: 'Risk exposure', score: 34, tone: 'Watch' },
      ],
      businessSignals: ['Partner activation backlog increased 27%', 'Average onboarding lead time above target by 11 days', 'Board-level ask logged in PMO intake'],
      dataUsed: ['Idea intake form', 'Partner KPI trend', 'Integration dependency map', 'Compliance evidence backlog'],
      summary: 'The model prioritizes this idea because it has immediate strategic value, a measurable revenue effect, and enough design maturity to move into governed execution quickly.',
    },
    queue: {
      recommendationType: 'Execution path recommendation',
      suggestedAction: 'Approve project conversion and assign portfolio sponsor',
      status: 'Awaiting steering committee',
      timestamp: '17 Apr 2026, 09:42',
    },
    reviewHistory: ['Classified by Atlas Prioritization Model', 'Scoring model approved by PMO lead', 'Portfolio fit checked against Growth portfolio'],
  },
  {
    id: 'idea-102',
    title: 'Collections exception triage copilot',
    type: 'Idea',
    priority: 'High',
    strategicObjective: 'Reduce operating cost through intelligent case handling',
    feasibilityScore: 74,
    businessValueScore: 85,
    riskScore: 42,
    workspace: 'Operations Excellence',
    owner: 'Dimas Hartono',
    reviewStatus: 'Pending review',
    category: 'Efficiency opportunity',
    classificationConfidence: 89,
    rationale: 'Pattern analysis links exception workload spikes with repeated manual triage, creating a clear automation opportunity with strong productivity upside.',
    tags: ['collections', 'ai-copilot', 'productivity', 'triage'],
    scoring: {
      businessValue: 85,
      effort: 52,
      risk: 42,
      roi: 83,
      feasibility: 74,
      strategicFit: 84,
      weightedOverall: 81,
      recommendation: 'Prioritize after architecture review',
      confidence: 87,
    },
    impact: {
      revenue: 51,
      costSaving: 82,
      productivity: 91,
      customer: 59,
      operational: 87,
      strategic: 76,
      magnitude: 'High productivity gain and sustained cost avoidance',
      confidence: 86,
      signals: ['Backlog aging in manual triage', 'Repeated handoff loops', 'Analyst throughput variance'],
    },
    prioritization: {
      rank: 2,
      weightedScore: 84,
      cluster: 'Operational scale-up',
      tradeoff: 'Strong operating leverage, but model assurance and auditability controls should be locked before rollout.',
    },
    feasibility: {
      level: 'Moderate',
      limitingFactors: ['Training data labeling gap', 'Need for operations playbook integration'],
      dependencies: ['Collections taxonomy cleanup', 'Review by responsible AI office'],
      nextStep: 'Send for expert review and define constrained pilot scope.',
    },
    alignment: {
      objective: 'Increase service productivity without headcount growth',
      strength: 87,
      theme: 'Operating efficiency and automation',
      rationale: 'It supports the year-end efficiency program and has a direct case-handling productivity measure.',
      linkedInitiatives: ['Ops Excellence Wave 2', 'Collections AI Assist'],
    },
    execution: {
      path: 'Send to Experimentation',
      reason: 'Model interaction risk is manageable if deployed as advisor-first workflow before full commitment.',
      effortRange: '6 to 8 weeks pilot',
      suggestedOwner: 'Collections Transformation Office',
      urgency: 'Pilot next month',
    },
    portfolio: {
      name: 'Operational Excellence Portfolio',
      domain: 'Collections transformation',
      resourceFit: 'Moderate fit; data science capacity is shared with two active initiatives',
      valueConcentration: 'High concentration in case throughput and exception closure rate',
      conflicts: ['Competes with document OCR initiative for NLP bandwidth'],
      fitScore: 81,
    },
    explainability: {
      confidence: 87,
      topFactors: [
        { label: 'Productivity gain', score: 91, tone: 'High' },
        { label: 'Cost saving', score: 82, tone: 'High' },
        { label: 'Operational readiness', score: 72, tone: 'Medium' },
        { label: 'AI governance risk', score: 44, tone: 'Watch' },
      ],
      businessSignals: ['Manual triage consumes 23% of team capacity', 'Exception backlog peaks every month-end', 'Existing copilot pilot delivered 14% handling speedup'],
      dataUsed: ['Case queue history', 'Workload telemetry', 'Playbook metadata', 'AI policy checklist'],
      summary: 'The recommendation favors a controlled experimentation route because the value signal is strong, while governance and data readiness still require oversight.',
    },
    queue: {
      recommendationType: 'Pilot recommendation',
      suggestedAction: 'Approve constrained experiment and add AI oversight criteria',
      status: 'Pending business owner',
      timestamp: '17 Apr 2026, 09:16',
    },
    reviewHistory: ['Classification suggested from intake narrative and KPI map', 'Scoring pending AI governance review'],
  },
  {
    id: 'idea-103',
    title: 'Customer dispute resolution journey fix',
    type: 'Demand item',
    priority: 'High',
    strategicObjective: 'Lift customer trust through faster dispute closure',
    feasibilityScore: 61,
    businessValueScore: 79,
    riskScore: 48,
    workspace: 'Customer Trust Office',
    owner: 'Shinta Prabowo',
    reviewStatus: 'Needs expert review',
    category: 'Customer-facing enhancement',
    classificationConfidence: 86,
    rationale: 'Customer sentiment, case resolution lag, and repeat complaint patterns indicate a strategic service improvement opportunity.',
    tags: ['customer-trust', 'service-improvement', 'complaint-journey'],
    scoring: {
      businessValue: 81,
      effort: 69,
      risk: 48,
      roi: 75,
      feasibility: 61,
      strategicFit: 88,
      weightedOverall: 76,
      recommendation: 'Refine scope before prioritization commit',
      confidence: 82,
    },
    impact: {
      revenue: 45,
      costSaving: 58,
      productivity: 63,
      customer: 93,
      operational: 71,
      strategic: 84,
      magnitude: 'High customer impact with moderate complexity',
      confidence: 83,
      signals: ['Complaint reopening rate', 'NPS comments', 'Delay in dispute evidence consolidation'],
    },
    prioritization: {
      rank: 4,
      weightedScore: 77,
      cluster: 'Strategic but constrained',
      tradeoff: 'Customer benefit is compelling, but integration and process dependency add delivery drag.',
    },
    feasibility: {
      level: 'Moderate to low',
      limitingFactors: ['Fragmented dispute data sources', 'High integration complexity across channels'],
      dependencies: ['Case system harmonization', 'Customer notification service change'],
      nextStep: 'Review constraints and split idea into phased delivery increments.',
    },
    alignment: {
      objective: 'Improve trust and complaint closure effectiveness',
      strength: 89,
      theme: 'Customer service excellence',
      rationale: 'Maps directly to the trust recovery OKR and customer experience escalation reduction target.',
      linkedInitiatives: ['Service Recovery Program', 'Customer Interaction Redesign'],
    },
    execution: {
      path: 'Move to Backlog',
      reason: 'Requires decomposition into a service fix tranche before governed execution approval.',
      effortRange: '8 to 12 weeks once data harmonization is ready',
      suggestedOwner: 'Customer Experience Transformation',
      urgency: 'Next prioritization cycle',
    },
    portfolio: {
      name: 'Customer Trust Portfolio',
      domain: 'Customer operations',
      resourceFit: 'Partial fit; dependent on shared integration capacity',
      valueConcentration: 'Strong concentration in customer resolution and brand protection indicators',
      conflicts: ['Shares dependency path with omnichannel notification refresh'],
      fitScore: 75,
    },
    explainability: {
      confidence: 81,
      topFactors: [
        { label: 'Customer impact', score: 93, tone: 'High' },
        { label: 'Strategic fit', score: 88, tone: 'High' },
        { label: 'Feasibility', score: 61, tone: 'Medium' },
        { label: 'Integration risk', score: 49, tone: 'Watch' },
      ],
      businessSignals: ['Dispute closure SLA missed for 3 consecutive months', 'Repeat complaint rate above threshold', 'High-volume complaints tied to channel handoffs'],
      dataUsed: ['VOC analytics', 'Complaint case metrics', 'Integration dependency inventory'],
      summary: 'The idea ranks as strategically important, but delivery should be sequenced because integration readiness is not yet strong enough for direct conversion.',
    },
    queue: {
      recommendationType: 'Backlog routing recommendation',
      suggestedAction: 'Approve phased backlog route and assign dependency owner',
      status: 'Pending PMO review',
      timestamp: '17 Apr 2026, 08:53',
    },
    reviewHistory: ['Scope refinement requested by customer operations lead'],
  },
  {
    id: 'idea-104',
    title: 'Regulatory evidence packaging automation',
    type: 'Idea',
    priority: 'Medium',
    strategicObjective: 'Reduce audit preparation effort and compliance friction',
    feasibilityScore: 83,
    businessValueScore: 73,
    riskScore: 29,
    workspace: 'Regulatory PMO',
    owner: 'Anya Setiawan',
    reviewStatus: 'Approved with oversight',
    category: 'Improvement',
    classificationConfidence: 92,
    rationale: 'The idea improves recurring operational pain, has clear process boundaries, and benefits from stable document metadata already available.',
    tags: ['regulatory', 'automation', 'audit-evidence'],
    scoring: {
      businessValue: 73,
      effort: 41,
      risk: 29,
      roi: 79,
      feasibility: 83,
      strategicFit: 78,
      weightedOverall: 80,
      recommendation: 'Approve for quick execution',
      confidence: 90,
    },
    impact: {
      revenue: 22,
      costSaving: 77,
      productivity: 84,
      customer: 34,
      operational: 86,
      strategic: 72,
      magnitude: 'Strong efficiency and compliance throughput gain',
      confidence: 89,
      signals: ['Audit evidence lead time', 'Manual packaging hours', 'Repeat audit finding remediation'],
    },
    prioritization: {
      rank: 3,
      weightedScore: 82,
      cluster: 'Operational quick win',
      tradeoff: 'Business value is slightly below strategic bets, but low implementation friction makes it an efficient near-term move.',
    },
    feasibility: {
      level: 'High',
      limitingFactors: ['Template approval dependency'],
      dependencies: ['Metadata mapping sign-off'],
      nextStep: 'Convert to Epic and attach governance checklist for evidence publication.',
    },
    alignment: {
      objective: 'Improve control evidence readiness',
      strength: 82,
      theme: 'Governance efficiency',
      rationale: 'Supports recurring audit readiness goals and lowers compliance preparation effort.',
      linkedInitiatives: ['Control Evidence Simplification'],
    },
    execution: {
      path: 'Convert to Epic',
      reason: 'The scope fits a contained improvement stream and can be governed inside an existing compliance program.',
      effortRange: '4 to 6 weeks',
      suggestedOwner: 'Regulatory Operations Lead',
      urgency: 'Start immediately',
    },
    portfolio: {
      name: 'Governance Efficiency Portfolio',
      domain: 'Regulatory control operations',
      resourceFit: 'High fit with active compliance automation squad',
      valueConcentration: 'Concentrated on audit readiness and cycle-time reduction',
      conflicts: [],
      fitScore: 88,
    },
    explainability: {
      confidence: 90,
      topFactors: [
        { label: 'Feasibility', score: 83, tone: 'High' },
        { label: 'Operational impact', score: 86, tone: 'High' },
        { label: 'Risk profile', score: 29, tone: 'High' },
        { label: 'Revenue impact', score: 22, tone: 'Medium' },
      ],
      businessSignals: ['Evidence package prep averages 36 analyst-hours', 'Audit requests are highly repetitive', 'Template quality is already standardized'],
      dataUsed: ['Control evidence logs', 'Template metadata model', 'Audit action closure report'],
      summary: 'This idea is recommended as a quick governed win because readiness is high, delivery complexity is low, and operating benefit is repeatable.',
    },
    queue: {
      recommendationType: 'Epic conversion recommendation',
      suggestedAction: 'Approve epic creation and assign compliance delivery owner',
      status: 'Approved',
      timestamp: '16 Apr 2026, 16:27',
    },
    reviewHistory: ['Human approval recorded', 'Governance checklist attached', 'Epic draft created in backlog'],
  },
  {
    id: 'idea-105',
    title: 'Field operations route optimization for service visits',
    type: 'Demand item',
    priority: 'Watch',
    strategicObjective: 'Improve service visit efficiency without degrading coverage',
    feasibilityScore: 55,
    businessValueScore: 68,
    riskScore: 57,
    workspace: 'Field Operations',
    owner: 'Bagus Mahendra',
    reviewStatus: 'Pending review',
    category: 'Innovation',
    classificationConfidence: 81,
    rationale: 'The idea is innovative and potentially beneficial, but data quality and operational readiness currently create a higher uncertainty band.',
    tags: ['routing', 'operations', 'optimization', 'experimentation'],
    scoring: {
      businessValue: 68,
      effort: 74,
      risk: 57,
      roi: 64,
      feasibility: 55,
      strategicFit: 71,
      weightedOverall: 63,
      recommendation: 'Park for future roadmap',
      confidence: 76,
    },
    impact: {
      revenue: 31,
      costSaving: 61,
      productivity: 69,
      customer: 54,
      operational: 73,
      strategic: 62,
      magnitude: 'Moderate upside with high uncertainty',
      confidence: 72,
      signals: ['Visit schedule volatility', 'Incomplete geo and travel data', 'No stable dispatch baseline'],
    },
    prioritization: {
      rank: 5,
      weightedScore: 64,
      cluster: 'Future option',
      tradeoff: 'Potential gain exists, but current data readiness and coordination cost reduce near-term priority.',
    },
    feasibility: {
      level: 'Low to moderate',
      limitingFactors: ['Data availability gap', 'Dispatch process variation across regions'],
      dependencies: ['Field telemetry normalization', 'Regional operating model alignment'],
      nextStep: 'Add assumptions and revisit after baseline dispatch telemetry is stabilized.',
    },
    alignment: {
      objective: 'Lower field service cost-to-serve',
      strength: 69,
      theme: 'Operational optimization',
      rationale: 'It loosely supports the efficiency agenda but is not tied to a committed transformation milestone yet.',
      linkedInitiatives: ['Field Mobility Refresh'],
    },
    execution: {
      path: 'Park for Future Roadmap',
      reason: 'Too many assumptions remain unresolved for governed execution or pilot commit in this cycle.',
      effortRange: 'TBD after data remediation',
      suggestedOwner: 'Field Service Transformation',
      urgency: 'Reassess next half',
    },
    portfolio: {
      name: 'Service Efficiency Portfolio',
      domain: 'Field operations',
      resourceFit: 'Low fit this quarter due to dispatch modernization commitments',
      valueConcentration: 'Diffused across multiple regions',
      conflicts: ['Resource collision with mobile workforce refresh'],
      fitScore: 61,
    },
    explainability: {
      confidence: 75,
      topFactors: [
        { label: 'Operational impact', score: 73, tone: 'Medium' },
        { label: 'Feasibility', score: 55, tone: 'Watch' },
        { label: 'Resource readiness', score: 48, tone: 'Watch' },
        { label: 'Strategic fit', score: 69, tone: 'Medium' },
      ],
      businessSignals: ['Route data incomplete in 3 of 5 regions', 'Service visit punctuality baseline still unstable'],
      dataUsed: ['Dispatch schedules', 'Workforce allocation trend', 'Travel telemetry availability report'],
      summary: 'The model recommends parking this idea because insufficient data quality and portfolio readiness make prioritization confidence materially lower.',
    },
    queue: {
      recommendationType: 'Roadmap parking recommendation',
      suggestedAction: 'Document assumptions and defer until data readiness threshold is met',
      status: 'Pending operations council',
      timestamp: '17 Apr 2026, 08:11',
    },
    reviewHistory: ['Scenario reviewed by field operations analytics', 'Data remediation prerequisite flagged'],
  },
]

const auditEvents = [
  { time: '17 Apr 2026, 09:42', actor: 'Atlas Prioritization Model', action: 'Execution path recommended', relatedIdeaId: 'idea-101', result: 'Convert to Project suggested with 93% confidence' },
  { time: '17 Apr 2026, 09:35', actor: 'PMO Scoring Engine', action: 'Priority rank updated', relatedIdeaId: 'idea-102', result: 'Moved to rank 2 after productivity weighting scenario' },
  { time: '17 Apr 2026, 09:16', actor: 'Atlas Prioritization Model', action: 'Score generated', relatedIdeaId: 'idea-102', result: 'Weighted score approved for human review' },
  { time: '17 Apr 2026, 08:53', actor: 'Impact Predictor', action: 'Impact predicted', relatedIdeaId: 'idea-103', result: 'High customer impact with integration dependency warning' },
  { time: '16 Apr 2026, 16:27', actor: 'Governance Workflow', action: 'Idea classified', relatedIdeaId: 'idea-104', result: 'Improvement category approved with oversight' },
  { time: '16 Apr 2026, 15:54', actor: 'Portfolio Fit Model', action: 'Portfolio allocation suggested', relatedIdeaId: 'idea-105', result: 'Service Efficiency Portfolio fit score 61' },
]

const priorityOptions = ['All', 'Critical', 'High', 'Medium', 'Watch']
const defaultFilters: FilterState = {
  ideaType: 'All',
  priority: 'All',
  strategicObjective: 'All',
  feasibility: 'All',
  businessValue: 'All',
  risk: 'All',
  workspace: 'All',
  owner: 'All',
  reviewStatus: 'All',
  timePeriod: '30 days',
}

function scoreBand(score: number) {
  if (score >= 80) return 'High'
  if (score >= 60) return 'Medium'
  return 'Watch'
}

function priorityBadgeClass(priority: PriorityLevel) {
  if (priority === 'Critical') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (priority === 'High') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (priority === 'Medium') return 'border-sky-200 bg-sky-50 text-sky-700'
  return 'border-slate-200 bg-slate-100 text-slate-600'
}

function confidenceBadgeClass(tone: ConfidenceTone) {
  if (tone === 'High') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (tone === 'Medium') return 'border-sky-200 bg-sky-50 text-sky-700'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

function progressTone(score: number) {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-sky-500'
  return 'bg-amber-500'
}

function PanelSkeleton({ lines = 4, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-3 animate-pulse', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={`skeleton-${index}`}
          className={cn(
            'rounded-xl bg-slate-200/70',
            index === 0 ? 'h-5 w-2/5' : index === lines - 1 ? 'h-14 w-full' : 'h-10 w-full'
          )}
        />
      ))}
    </div>
  )
}

function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-slate-600">
        <span>{label}</span>
        <span className="font-semibold text-slate-800">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className={cn('h-2 rounded-full transition-all', progressTone(value))} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

export function AIIdeaPrioritizationIntelligencePage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [selectedIdeaId, setSelectedIdeaId] = useState(ideas[0].id)
  const [drawerContext, setDrawerContext] = useState<DrawerContext>({
    section: 'Execution path recommendation',
    insight: ideas[0].execution.path,
  })
  const [loadingPanels, setLoadingPanels] = useState<string[]>(['overview', 'scoring', 'matrix', 'queue'])
  const deferredSearch = useDeferredValue(searchTerm)
  const [activePanel, setActivePanel] = useState<PanelId>('overview')
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(false)
  const [showFiltersPanel, setShowFiltersPanel] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setLoadingPanels([])
    }, 1000)

    return () => window.clearTimeout(timeoutId)
  }, [])

  const filteredIdeas = ideas.filter((idea) => {
    const matchesSearch =
      deferredSearch.trim().length === 0 ||
      [
        idea.title,
        idea.workspace,
        idea.strategicObjective,
        idea.tags.join(' '),
        idea.scoring.recommendation,
        idea.execution.path,
      ]
        .join(' ')
        .toLowerCase()
        .includes(deferredSearch.toLowerCase())

    const matchesIdeaType = filters.ideaType === 'All' || idea.type === filters.ideaType
    const matchesPriority = filters.priority === 'All' || idea.priority === filters.priority
    const matchesObjective = filters.strategicObjective === 'All' || idea.strategicObjective === filters.strategicObjective
    const matchesFeasibility = filters.feasibility === 'All' || scoreBand(idea.feasibilityScore) === filters.feasibility
    const matchesBusinessValue = filters.businessValue === 'All' || scoreBand(idea.businessValueScore) === filters.businessValue
    const matchesRisk = filters.risk === 'All' || scoreBand(100 - idea.riskScore) === filters.risk
    const matchesWorkspace = filters.workspace === 'All' || idea.workspace === filters.workspace
    const matchesOwner = filters.owner === 'All' || idea.owner === filters.owner
    const matchesReviewStatus = filters.reviewStatus === 'All' || idea.reviewStatus === filters.reviewStatus

    return (
      matchesSearch &&
      matchesIdeaType &&
      matchesPriority &&
      matchesObjective &&
      matchesFeasibility &&
      matchesBusinessValue &&
      matchesRisk &&
      matchesWorkspace &&
      matchesOwner &&
      matchesReviewStatus
    )
  })

  useEffect(() => {
    if (filteredIdeas.length === 0) {
      return
    }

    const selectedStillVisible = filteredIdeas.some((idea) => idea.id === selectedIdeaId)
    if (!selectedStillVisible) {
      startTransition(() => {
        setSelectedIdeaId(filteredIdeas[0].id)
        setDrawerContext({ section: 'Filtered intelligence focus', insight: filteredIdeas[0].title })
      })
    }
  }, [filteredIdeas, selectedIdeaId])

  const selectedIdea = filteredIdeas.find((idea) => idea.id === selectedIdeaId) ?? ideas.find((idea) => idea.id === selectedIdeaId) ?? ideas[0]

  const filterOptions = useMemo(() => {
    return {
      objectives: Array.from(new Set(ideas.map((idea) => idea.strategicObjective))),
      workspaces: Array.from(new Set(ideas.map((idea) => idea.workspace))),
      owners: Array.from(new Set(ideas.map((idea) => idea.owner))),
      reviewStatuses: Array.from(new Set(ideas.map((idea) => idea.reviewStatus))),
    }
  }, [])

  const summaryStats = useMemo(() => {
    const total = filteredIdeas.length
    const highPriority = filteredIdeas.filter((idea) => idea.priority === 'Critical' || idea.priority === 'High').length
    const highImpact = filteredIdeas.filter((idea) => idea.businessValueScore >= 80).length
    const lowFeasibility = filteredIdeas.filter((idea) => idea.feasibilityScore < 60).length
    const aligned = filteredIdeas.filter((idea) => idea.alignment.strength >= 80).length
    const ready = filteredIdeas.filter((idea) => idea.execution.path === 'Convert to Project' || idea.execution.path === 'Convert to Epic').length

    return [
      {
        id: 'total',
        label: 'Total Ideas Evaluated',
        value: String(total),
        subtext: 'Ideas currently in the AI evaluation window',
        trend: total >= 5 ? '+6%' : '+2%',
        icon: Lightbulb,
        trendColor: '#0ea5e9',
        trendSeries: [Math.max(1, total - 3), Math.max(1, total - 2), Math.max(1, total - 2), Math.max(1, total - 1), total],
        onClick: () => {
          startTransition(() => {
            setDrawerContext({ section: 'Overview', insight: 'Current evaluated idea universe' })
            setDrawerOpen(true)
          })
        },
      },
      {
        id: 'priority',
        label: 'High Priority Recommendations',
        value: String(highPriority),
        subtext: 'Recommended for immediate action or portfolio escalation',
        trend: highPriority > 0 ? '+2' : '0',
        icon: TrendingUp,
        trendColor: '#6366f1',
        trendSeries: [Math.max(0, highPriority - 2), Math.max(0, highPriority - 1), Math.max(0, highPriority - 1), highPriority],
        onClick: () => {
          const focusIdea = filteredIdeas.find((idea) => idea.priority === 'Critical') ?? filteredIdeas[0]
          if (!focusIdea) return
          startTransition(() => {
            setSelectedIdeaId(focusIdea.id)
            setDrawerContext({ section: 'High priority recommendation', insight: focusIdea.title })
            setDrawerOpen(true)
          })
        },
      },
      {
        id: 'impact',
        label: 'High Business Impact Ideas',
        value: String(highImpact),
        subtext: 'Strong revenue, customer, or efficiency signal',
        trend: highImpact > 0 ? '+1.2%' : '0%',
        icon: BarChart3,
        trendColor: '#10b981',
        trendSeries: [Math.max(0, highImpact - 2), Math.max(0, highImpact - 1), Math.max(0, highImpact - 1), highImpact],
        onClick: () => {
          const focusIdea = filteredIdeas.find((idea) => idea.businessValueScore >= 80) ?? filteredIdeas[0]
          if (!focusIdea) return
          startTransition(() => {
            setSelectedIdeaId(focusIdea.id)
            setDrawerContext({ section: 'Business impact focus', insight: focusIdea.title })
            setDrawerOpen(true)
          })
        },
      },
      {
        id: 'feasibility',
        label: 'Low Feasibility Items',
        value: String(lowFeasibility),
        subtext: 'Needs assumption management or expert review',
        trend: lowFeasibility > 0 ? '-1' : '0',
        icon: ShieldAlert,
        trendColor: '#f59e0b',
        trendSeries: [Math.max(0, lowFeasibility + 1), Math.max(0, lowFeasibility), Math.max(0, lowFeasibility), lowFeasibility],
        onClick: () => {
          const focusIdea = filteredIdeas.find((idea) => idea.feasibilityScore < 60) ?? filteredIdeas[0]
          if (!focusIdea) return
          startTransition(() => {
            setSelectedIdeaId(focusIdea.id)
            setDrawerContext({ section: 'Feasibility risk', insight: focusIdea.title })
            setDrawerOpen(true)
          })
        },
      },
      {
        id: 'alignment',
        label: 'Strategically Aligned Ideas',
        value: String(aligned),
        subtext: 'Ideas mapped strongly to objectives and OKRs',
        trend: aligned > 0 ? '+3' : '0',
        icon: Goal,
        trendColor: '#06b6d4',
        trendSeries: [Math.max(0, aligned - 2), Math.max(0, aligned - 1), Math.max(0, aligned), aligned],
        onClick: () => {
          const focusIdea = filteredIdeas.find((idea) => idea.alignment.strength >= 80) ?? filteredIdeas[0]
          if (!focusIdea) return
          startTransition(() => {
            setSelectedIdeaId(focusIdea.id)
            setDrawerContext({ section: 'Strategic alignment', insight: focusIdea.title })
            setDrawerOpen(true)
          })
        },
      },
      {
        id: 'ready',
        label: 'Ideas Ready for Execution',
        value: String(ready),
        subtext: 'Can move forward with approval and routing',
        trend: ready > 0 ? '+3' : '0',
        icon: CheckCircle2,
        trendColor: '#2563eb',
        trendSeries: [Math.max(0, ready - 2), Math.max(0, ready - 1), Math.max(0, ready), ready],
        onClick: () => {
          const focusIdea = filteredIdeas.find((idea) => idea.execution.path === 'Convert to Project' || idea.execution.path === 'Convert to Epic') ?? filteredIdeas[0]
          if (!focusIdea) return
          startTransition(() => {
            setSelectedIdeaId(focusIdea.id)
            setDrawerContext({ section: 'Execution readiness', insight: focusIdea.title })
            setDrawerOpen(true)
          })
        },
      },
    ] as const
  }, [filteredIdeas, setDrawerOpen, setDrawerContext, setSelectedIdeaId])

  const distributionData = priorityOptions
    .filter((option) => option !== 'All')
    .map((priority) => ({
      name: priority,
      value: filteredIdeas.filter((idea) => idea.priority === priority).length,
    }))

  const scoringRadar = [
    { metric: 'Business value', score: selectedIdea.scoring.businessValue },
    { metric: 'Effort', score: 100 - selectedIdea.scoring.effort },
    { metric: 'Risk', score: 100 - selectedIdea.scoring.risk },
    { metric: 'ROI', score: selectedIdea.scoring.roi },
    { metric: 'Feasibility', score: selectedIdea.scoring.feasibility },
    { metric: 'Strategic fit', score: selectedIdea.scoring.strategicFit },
  ]

  const impactBars = [
    { name: 'Revenue', value: selectedIdea.impact.revenue },
    { name: 'Cost', value: selectedIdea.impact.costSaving },
    { name: 'Productivity', value: selectedIdea.impact.productivity },
    { name: 'Customer', value: selectedIdea.impact.customer },
    { name: 'Operational', value: selectedIdea.impact.operational },
    { name: 'Strategic', value: selectedIdea.impact.strategic },
  ]

  const averageConfidence =
    filteredIdeas.length === 0
      ? 0
      : Math.round(
          filteredIdeas.reduce((total, idea) => total + idea.explainability.confidence + idea.scoring.confidence + idea.classificationConfidence, 0) /
            (filteredIdeas.length * 3)
        )

  const openIdea = (idea: IdeaRecord, section: string, insight: string) => {
    startTransition(() => {
      setSelectedIdeaId(idea.id)
      setDrawerContext({ section, insight })
      setDrawerOpen(true)
    })
  }

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const triggerRefresh = () => {
    setLoadingPanels(['overview', 'scoring', 'matrix', 'queue'])
    window.setTimeout(() => {
      setLoadingPanels([])
    }, 1100)
  }

  const statusRail = [
    { label: 'AI assessment', value: 'Live', icon: BrainCircuit },
    { label: 'AI recommendation', value: 'Governed', icon: Sparkles },
    { label: 'Human approval', value: 'Required', icon: BadgeCheck },
    { label: 'Execution routing', value: 'Suggested only', icon: Waypoints },
  ]

  const sidebarFixed = usePreferencesStore((s) => s.preferences.sidebarFixed ?? false)
  const sidebarMini = usePreferencesStore((s) => s.preferences.sidebarMini ?? true)
  const navDocked = isWorkspaceNavDocked(sidebarFixed)
  const enterpriseNavTitlesOnly = usePreferencesStore((s) => s.preferences.enterpriseNavTitlesOnly ?? false)
  const enterpriseNavSimpleList = usePreferencesStore((s) => s.preferences.enterpriseNavSimpleList ?? false)
  const enterpriseNavCompact = enterpriseNavTitlesOnly || enterpriseNavSimpleList
  const fixedSidebarUiOn = !sidebarFixed
  const enterpriseNavUltra = fixedSidebarUiOn && sidebarMini && enterpriseNavTitlesOnly && enterpriseNavSimpleList
  const enterpriseNavWidthVariant = enterpriseNavUltra ? 'ultra' : enterpriseNavCompact ? 'compact' : 'default'

  const navPanelRef = useRef<HTMLDivElement | null>(null)
  const [navPanelHeightPx, setNavPanelHeightPx] = useState<number | null>(null)

  useLayoutEffect(() => {
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
  }, [
    navDocked,
    isWorkspaceCollapsed,
    activePanel,
    searchTerm,
    filters,
    showFiltersPanel,
    loadingPanels,
    drawerOpen,
  ])

  return (
    <div className="space-y-6 pb-8 text-slate-900">
      <div className={cn('space-y-6', workspaceDockedContentInsetClass(navDocked, isWorkspaceCollapsed, enterpriseNavWidthVariant))}>
        <Breadcrumb items={[{ label: 'AI Idea & Prioritization Intelligence' }]} />

        <PageHeader
          title="AI Idea & Prioritization Intelligence"
          description="Classify, evaluate, prioritize, and recommend an execution path for incoming ideas and demand items"
          right={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white/75 p-1.5 shadow-sm backdrop-blur-sm">
                <button
                  type="button"
                  onClick={triggerRefresh}
                  className="flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition-all duration-200 hover:bg-white hover:text-slate-900 hover:shadow-sm"
                  aria-label="Generate prioritization intelligence"
                  title="Generate prioritization intelligence"
                >
                  <Sparkles className="h-5 w-5" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition-all duration-200 hover:bg-white hover:text-slate-900 hover:shadow-sm"
                  aria-label="Import ideas"
                  title="Import ideas"
                >
                  <FileUp className="h-5 w-5" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition-all duration-200 hover:bg-white hover:text-slate-900 hover:shadow-sm"
                  aria-label="Configure scoring model"
                  title="Configure scoring model"
                >
                  <SlidersHorizontal className="h-5 w-5" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition-all duration-200 hover:bg-white hover:text-slate-900 hover:shadow-sm"
                  aria-label="AI settings"
                  title="AI settings"
                >
                  <Settings2 className="h-5 w-5" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className={cn(
                    'flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition-all duration-200 hover:bg-white hover:text-slate-900 hover:shadow-sm',
                    drawerOpen && 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                  )}
                  aria-label="Open intelligence drawer"
                  title="Open intelligence drawer"
                >
                  <PanelRightOpen className="h-5 w-5" strokeWidth={2} />
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
          {summaryStats.map((item) => (
            <button key={item.label} type="button" className="group text-left" onClick={item.onClick}>
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
      </div>

      <div className={workspaceOuterGridClass(sidebarFixed, isWorkspaceCollapsed, enterpriseNavWidthVariant)}>
        <aside className={workspaceAsideClass(navDocked, isWorkspaceCollapsed, enterpriseNavWidthVariant)}>
          <div
            ref={navPanelRef}
            className={cn(workspaceNavInnerClass(navDocked, sidebarFixed, isWorkspaceCollapsed), !navDocked && 'overflow-hidden')}
            style={!navDocked && navPanelHeightPx ? { height: navPanelHeightPx, maxHeight: navPanelHeightPx } : undefined}
            aria-label="AI idea workspace navigation"
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
                  aria-label={isWorkspaceCollapsed ? 'Expand intelligence navigation' : 'Collapse intelligence navigation'}
                  title={isWorkspaceCollapsed ? 'Expand intelligence navigation' : 'Collapse intelligence navigation'}
                  onClick={() => setIsWorkspaceCollapsed((current) => !current)}
                >
                  {isWorkspaceCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                </Button>
              </div>

              {!isWorkspaceCollapsed && !enterpriseNavSimpleList ? (
                <div className="mb-4 overflow-hidden rounded-[24px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_38%),linear-gradient(160deg,rgba(15,23,42,0.96),rgba(30,41,59,0.94))] p-4 text-white shadow-[0_18px_44px_rgba(15,23,42,0.24)]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-100/80">Idea Intelligence Workspace</div>
                  <div className="mt-2 text-base font-semibold leading-tight">
                    Control tower for AI prioritization, governance, and routing readiness
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
                      const isActive = activePanel === panel.id
                      return (
                        <button
                          key={panel.id}
                          type="button"
                          onClick={() => {
                            setActivePanel(panel.id)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
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
                            isActive
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
                          {isActive ? <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-gradient-to-b from-sky-500 via-blue-600 to-indigo-600" /> : null}
                          <span
                            className={cn(
                              'relative flex shrink-0 items-center justify-center rounded-2xl border transition-colors',
                              enterpriseNavCompact ? 'h-9 w-9' : 'h-11 w-11',
                              isActive
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
                                      isActive ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'
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

              <div className={cn('mt-4', isWorkspaceCollapsed && 'hidden')}>
                <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Governance rail</div>
                  <div className="mt-3 grid gap-2">
                    {statusRail.map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs">
                        <span className="text-slate-600">{item.label}</span>
                        <span className="font-semibold text-slate-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className={cn('min-w-0', workspaceMainColumnClass(navDocked, isWorkspaceCollapsed, enterpriseNavWidthVariant))}>
          {activePanel !== 'overview' && showFiltersPanel ? (
            <Card className="glass-card rounded-2xl p-4">
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => startTransition(() => setSearchTerm(event.target.value))}
                    className="h-11 rounded-2xl border-slate-200 bg-white pl-9 text-sm"
                    placeholder="Search idea title, workspace, objective, tag, or recommendation"
                  />
                </div>

                {[
                  { label: 'Idea type', value: filters.ideaType, key: 'ideaType', options: ['All', 'Idea', 'Demand item'] },
                  { label: 'Priority', value: filters.priority, key: 'priority', options: priorityOptions },
                  { label: 'Objective', value: filters.strategicObjective, key: 'strategicObjective', options: ['All', ...filterOptions.objectives] },
                  { label: 'Feasibility', value: filters.feasibility, key: 'feasibility', options: ['All', 'High', 'Medium', 'Watch'] },
                  { label: 'Business value', value: filters.businessValue, key: 'businessValue', options: ['All', 'High', 'Medium', 'Watch'] },
                  { label: 'Risk', value: filters.risk, key: 'risk', options: ['All', 'High', 'Medium', 'Watch'] },
                  { label: 'Workspace', value: filters.workspace, key: 'workspace', options: ['All', ...filterOptions.workspaces] },
                  { label: 'Owner', value: filters.owner, key: 'owner', options: ['All', ...filterOptions.owners] },
                  { label: 'Review status', value: filters.reviewStatus, key: 'reviewStatus', options: ['All', ...filterOptions.reviewStatuses] },
                  { label: 'Time period', value: filters.timePeriod, key: 'timePeriod', options: ['30 days', '90 days', 'Quarter'] },
                ].map((filter) => (
                  <label key={filter.label} className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{filter.label}</span>
                    <select
                      value={filter.value}
                      onChange={(event) => updateFilter(filter.key as keyof FilterState, event.target.value)}
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
          ) : null}

          {filteredIdeas.length === 0 ? (
            <Card className={cardSurface}>
              <CardContent className="flex items-center justify-between gap-3 py-8">
                <div>
                  <p className="text-sm font-semibold text-slate-900">No ideas match the current filters</p>
                  <p className="mt-1 text-xs text-slate-600">Reset filters or widen the search scope to restore the evaluation queue.</p>
                </div>
                <Button variant="outline" onClick={() => setFilters(defaultFilters)}>
                  Reset filters
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {activePanel === 'overview' ? (
            <Panel
              id="overview"
              title="AI Prioritization Overview Panel"
              description="Portfolio-wide evaluation health, confidence posture, and priority distribution."
              highlight
            >
              {loadingPanels.includes('overview') ? (
                <PanelSkeleton lines={6} />
              ) : (
                <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-slate-50">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">AI confidence health</p>
                    <div className="mt-4 flex items-end gap-3">
                      <span className="text-4xl font-semibold text-white">{averageConfidence}%</span>
                      <span className="pb-1 text-xs text-slate-400">prioritization confidence</span>
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-white/10">
                      <div className="h-2 rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300" style={{ width: `${averageConfidence}%` }} />
                    </div>
                    <div className="mt-4 space-y-2 text-xs text-slate-300">
                      <div className="flex items-center justify-between">
                        <span>Classification confidence</span>
                        <span>{Math.round(filteredIdeas.reduce((sum, idea) => sum + idea.classificationConfidence, 0) / Math.max(filteredIdeas.length, 1))}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Scoring confidence</span>
                        <span>{Math.round(filteredIdeas.reduce((sum, idea) => sum + idea.scoring.confidence, 0) / Math.max(filteredIdeas.length, 1))}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-2">
                    <div className="mb-2 px-2 pt-2 text-xs font-medium text-slate-600">Idea distribution by priority segment</div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={distributionData} barSize={26}>
                          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                          <RechartsTooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                          <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="#2563eb" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </Panel>
          ) : null}

          {activePanel === 'classification' ? (
            <Panel
              id="classification"
              title="Auto Idea Classification Panel"
              description="AI-generated categorization with rationale, tags, and review controls."
              highlight
              right={
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Reclassify
                  </Button>
                  <Button variant="outline" size="sm">
                    Batch Approve
                  </Button>
                </div>
              }
            >
              <div className="space-y-3">
                {filteredIdeas.map((idea) => (
                  <button
                    key={idea.id}
                    onClick={() => openIdea(idea, 'Classification rationale', idea.category)}
                    className={cn(
                      'w-full rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50/40',
                      selectedIdea.id === idea.id ? 'border-sky-300 bg-sky-50/60' : 'border-slate-200 bg-slate-50/70'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{idea.title}</p>
                          <Badge className="border border-slate-200 bg-white text-slate-700">AI-generated</Badge>
                          <Badge className={cn('border', priorityBadgeClass(idea.priority))}>{idea.priority}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{idea.category}</p>
                      </div>
                      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">{idea.classificationConfidence}% confidence</Badge>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-slate-600">{idea.rationale}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {idea.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm">Accept Classification</Button>
                      <Button variant="outline" size="sm">
                        Reclassify
                      </Button>
                      <Button variant="ghost" size="sm">
                        View Explanation
                      </Button>
                    </div>
                  </button>
                ))}
              </div>
            </Panel>
          ) : null}

          {activePanel === 'scoring' ? (
            <Panel
              id="scoring"
              title="AI Scoring Recommendation Panel"
              description="Weighted scorecards and multi-factor evaluation for the selected idea."
              highlight
              right={
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Adjust Weight
                  </Button>
                  <Button variant="outline" size="sm">
                    Recalculate
                  </Button>
                </div>
              }
            >
              {loadingPanels.includes('scoring') ? (
                <PanelSkeleton lines={5} />
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Selected idea score</p>
                      <div className="mt-3 text-3xl font-semibold">{selectedIdea.scoring.weightedOverall}</div>
                      <p className="mt-1 text-xs text-slate-300">{selectedIdea.scoring.recommendation}</p>
                      <div className="mt-4 space-y-2">
                        <MetricBar label="Business value" value={selectedIdea.scoring.businessValue} />
                        <MetricBar label="ROI" value={selectedIdea.scoring.roi} />
                        <MetricBar label="Strategic fit" value={selectedIdea.scoring.strategicFit} />
                      </div>
                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-slate-200">
                        Confidence level: {selectedIdea.scoring.confidence}%
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-2">
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={scoringRadar} outerRadius="72%">
                            <PolarGrid stroke="#dbeafe" />
                            <PolarAngleAxis dataKey="metric" tick={{ fill: '#475569', fontSize: 11 }} />
                            <Radar dataKey="score" fill="#0284c7" stroke="#0369a1" fillOpacity={0.28} />
                            <RechartsTooltip />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {filteredIdeas.map((idea) => (
                      <button
                        key={idea.id}
                        onClick={() => openIdea(idea, 'Scoring recommendation', `${idea.scoring.weightedOverall} weighted score`)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3 text-left transition-all hover:border-sky-300 hover:bg-sky-50/40"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900">{idea.title}</p>
                            <Badge className="border border-slate-200 bg-white text-slate-700">{idea.scoring.recommendation}</Badge>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-slate-200">
                            <div className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-emerald-500" style={{ width: `${idea.scoring.weightedOverall}%` }} />
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-slate-900">{idea.scoring.weightedOverall}</div>
                          <div className="text-[11px] text-slate-500">{idea.scoring.confidence}% confidence</div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm">Compare Ideas</Button>
                    <Button variant="outline" size="sm">
                      Approve Score
                    </Button>
                  </div>
                </div>
              )}
            </Panel>
          ) : null}

          {activePanel === 'impact' ? (
            <Panel
              id="impact"
              title="Business Impact Prediction Panel"
              description="Forecasted effect across revenue, cost, productivity, customer, operations, and strategy."
              highlight
              right={
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Compare Scenarios
                  </Button>
                  <Button variant="outline" size="sm">
                    Export Insight
                  </Button>
                </div>
              }
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{selectedIdea.title}</p>
                    <Badge className="border border-slate-200 bg-white text-slate-700">{selectedIdea.impact.magnitude}</Badge>
                    <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">{selectedIdea.impact.confidence}% confidence</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">{selectedIdea.impact.signals.join(' • ')}</p>
                </div>
                <div className="h-72 rounded-2xl border border-slate-200 bg-white p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={impactBars} layout="vertical" margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                      <CartesianGrid horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#475569', fontSize: 11 }} width={76} />
                      <RechartsTooltip />
                      <Bar dataKey="value" radius={[0, 10, 10, 0]} fill="#2563eb" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredIdeas.slice(0, 4).map((idea) => (
                    <button
                      key={idea.id}
                      onClick={() => openIdea(idea, 'Impact prediction', idea.impact.magnitude)}
                      className="rounded-2xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-sky-300 hover:bg-sky-50/40"
                    >
                      <p className="text-sm font-semibold text-slate-900">{idea.title}</p>
                      <p className="mt-1 text-xs text-slate-600">{idea.impact.magnitude}</p>
                      <p className="mt-2 text-[11px] text-slate-500">Key reasoning signals: {idea.impact.signals.join(', ')}</p>
                    </button>
                  ))}
                </div>
              </div>
            </Panel>
          ) : null}

          {activePanel === 'prioritization' ? (
            <Panel
              id="prioritization"
              title="Multi-Objective Prioritization Panel"
              description="Ranked portfolio list balancing profitability, risk, feasibility, urgency, and readiness."
              highlight
              right={
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Change Weight Scenario
                  </Button>
                  <Button variant="outline" size="sm">
                    Save View
                  </Button>
                </div>
              }
            >
              <div className="space-y-3">
                {filteredIdeas
                  .slice()
                  .sort((leftIdea, rightIdea) => leftIdea.prioritization.rank - rightIdea.prioritization.rank)
                  .map((idea) => (
                    <button
                      key={idea.id}
                      onClick={() => openIdea(idea, 'Prioritization rank', `Rank ${idea.prioritization.rank}`)}
                      className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-left transition-all hover:border-sky-300 hover:bg-sky-50/40"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
                        #{idea.prioritization.rank}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{idea.title}</p>
                          <Badge className="border border-slate-200 bg-white text-slate-700">{idea.prioritization.cluster}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{idea.prioritization.tradeoff}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-slate-900">{idea.prioritization.weightedScore}</div>
                        <div className="text-[11px] text-slate-500">weighted score</div>
                      </div>
                    </button>
                  ))}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm">Re-rank Portfolio</Button>
                  <Button variant="outline" size="sm">
                    Save Prioritization View
                  </Button>
                </div>
              </div>
            </Panel>
          ) : null}

          {activePanel === 'feasibility' ? (
            <Panel
              id="feasibility"
              title="Feasibility Assessment Panel"
              description="Technical, resource, operational, integration, and timeline feasibility assessment."
              highlight
              right={
                <Button variant="outline" size="sm">
                  Send for Expert Review
                </Button>
              }
            >
              <div className="grid gap-3">
                {filteredIdeas.map((idea) => (
                  <button
                    key={idea.id}
                    onClick={() => openIdea(idea, 'Feasibility assessment', idea.feasibility.level)}
                    className="rounded-2xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-sky-300 hover:bg-sky-50/40"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{idea.title}</p>
                      <Badge className="border border-slate-200 bg-slate-50 text-slate-700">{idea.feasibility.level}</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Limiting factors</p>
                        <p className="mt-1 text-xs text-slate-600">{idea.feasibility.limitingFactors.join(' • ')}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Dependencies</p>
                        <p className="mt-1 text-xs text-slate-600">{idea.feasibility.dependencies.join(' • ')}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm">
                        Review Constraints
                      </Button>
                      <Button variant="ghost" size="sm">
                        Add Assumption
                      </Button>
                    </div>
                  </button>
                ))}
              </div>
            </Panel>
          ) : null}

          {activePanel === 'alignment' ? (
            <Panel
              id="alignment"
              title="Strategic Alignment Suggestion Panel"
              description="Objective mapping, alignment strength, and linked initiative candidates."
              highlight
              right={
                <Button variant="outline" size="sm">
                  View Related Initiatives
                </Button>
              }
            >
              <div className="space-y-3">
                {filteredIdeas.map((idea) => (
                  <button
                    key={idea.id}
                    onClick={() => openIdea(idea, 'Strategic alignment suggestion', idea.alignment.objective)}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-left transition-all hover:border-sky-300 hover:bg-sky-50/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{idea.title}</p>
                        <p className="mt-1 text-xs text-slate-600">{idea.alignment.objective}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-slate-900">{idea.alignment.strength}%</div>
                        <div className="text-[11px] text-slate-500">alignment strength</div>
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-slate-600">{idea.alignment.rationale}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {idea.alignment.linkedInitiatives.map((initiative) => (
                        <span key={initiative} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
                          {initiative}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm">Link to Objective</Button>
                      <Button variant="outline" size="sm">
                        Confirm Alignment
                      </Button>
                    </div>
                  </button>
                ))}
              </div>
            </Panel>
          ) : null}

          {activePanel === 'execution' ? (
            <Panel
              id="execution"
              title="Execution Path Recommendation Panel"
              description="AI-suggested route into project, epic, backlog, experiment, roadmap, or deferral."
              highlight
              right={
                <Button variant="outline" size="sm">
                  Modify Recommendation
                </Button>
              }
            >
              <div className="space-y-3">
                {filteredIdeas.map((idea) => (
                  <button
                    key={idea.id}
                    onClick={() => openIdea(idea, 'Execution path recommendation', idea.execution.path)}
                    className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-sky-300 hover:bg-sky-50/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{idea.title}</p>
                        <p className="mt-1 text-xs text-slate-600">{idea.execution.reason}</p>
                      </div>
                      <Badge className="border border-slate-200 bg-slate-50 text-slate-700">{idea.execution.path}</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-[11px] text-slate-500">Effort range</p>
                        <p className="text-xs font-medium text-slate-800">{idea.execution.effortRange}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-[11px] text-slate-500">Suggested owner</p>
                        <p className="text-xs font-medium text-slate-800">{idea.execution.suggestedOwner}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-[11px] text-slate-500">Urgency</p>
                        <p className="text-xs font-medium text-slate-800">{idea.execution.urgency}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm">Accept Path</Button>
                      <Button variant="outline" size="sm">
                        Send to Workspace / Project
                      </Button>
                      <Button variant="ghost" size="sm">
                        Move to Backlog
                      </Button>
                    </div>
                  </button>
                ))}
              </div>
            </Panel>
          ) : null}

          {activePanel === 'portfolio' ? (
            <Panel
              id="portfolio"
              title="Portfolio Allocation Recommendation Panel"
              description="Suggested portfolio, program, and workspace placement with overlap and fit reasoning."
              highlight
              right={
                <Button variant="outline" size="sm">
                  Compare Portfolio Options
                </Button>
              }
            >
              <div className="space-y-3">
                {filteredIdeas.map((idea) => (
                  <button
                    key={idea.id}
                    onClick={() => openIdea(idea, 'Portfolio allocation recommendation', idea.portfolio.name)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-left transition-all hover:border-sky-300 hover:bg-sky-50/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{idea.title}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          {idea.portfolio.name} • {idea.portfolio.domain}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-slate-900">{idea.portfolio.fitScore}</div>
                        <div className="text-[11px] text-slate-500">fit score</div>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Resource fit</p>
                        <p className="mt-1 text-xs text-slate-600">{idea.portfolio.resourceFit}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Conflict / overlap</p>
                        <p className="mt-1 text-xs text-slate-600">
                          {idea.portfolio.conflicts.length === 0 ? 'No material conflict detected' : idea.portfolio.conflicts.join(' • ')}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm">Assign to Portfolio</Button>
                      <Button variant="outline" size="sm">
                        Review Conflict
                      </Button>
                    </div>
                  </button>
                ))}
              </div>
            </Panel>
          ) : null}

          {activePanel === 'explainability' ? (
            <Panel
              id="explainability"
              title="Explainability & Confidence Panel"
              description="Top factors, data sources, business signals, and human-readable reasoning."
              highlight
              right={
                <Button variant="outline" size="sm">
                  Compare Manual Assessment
                </Button>
              }
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Reasoning summary</p>
                      <p className="mt-1 text-lg font-semibold">{selectedIdea.title}</p>
                    </div>
                    <Badge className="border border-white/10 bg-white/10 text-slate-100">{selectedIdea.explainability.confidence}% confidence</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-200">{selectedIdea.explainability.summary}</p>
                </div>
                <div className="space-y-3">
                  {selectedIdea.explainability.topFactors.map((factor) => (
                    <div key={factor.label} className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-900">{factor.label}</p>
                        <Badge className={cn('border', confidenceBadgeClass(factor.tone))}>{factor.tone}</Badge>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-100">
                        <div className={cn('h-2 rounded-full', progressTone(factor.score))} style={{ width: `${factor.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Business signals</p>
                    <div className="mt-2 space-y-2 text-xs text-slate-600">
                      {selectedIdea.explainability.businessSignals.map((signal) => (
                        <div key={signal} className="flex items-start gap-2">
                          <CircleDot className="mt-0.5 h-3.5 w-3.5 text-sky-500" />
                          <span>{signal}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Data used in assessment</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedIdea.explainability.dataUsed.map((source) => (
                        <span key={source} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
                          {source}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm">View Detail</Button>
                  <Button variant="outline" size="sm">
                    Flag for Review
                  </Button>
                </div>
              </div>
            </Panel>
          ) : null}

          {activePanel === 'matrix' ? (
            <Panel
              id="matrix"
              title="Prioritization Matrix & Decision Board Panel"
              description="Value vs effort matrix for decision support across risk, feasibility, and readiness lenses."
              highlight
              right={
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Filter by Segment
                  </Button>
                  <Button variant="outline" size="sm">
                    Export Matrix
                  </Button>
                </div>
              }
            >
              {loadingPanels.includes('matrix') ? (
                <PanelSkeleton lines={4} className="min-h-[300px]" />
              ) : (
                <div className="space-y-4">
                  <div className="relative h-[320px] overflow-hidden rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,rgba(240,249,255,0.9),rgba(248,250,252,0.95))] p-4">
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.14)_1px,transparent_1px)] bg-[size:25%_25%]" />
                    <div className="absolute left-4 top-3 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">High value</div>
                    <div className="absolute bottom-3 left-4 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Higher effort</div>
                    <div className="absolute bottom-3 right-4 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Lower effort</div>
                    <div className="absolute right-4 top-3 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Higher readiness</div>
                    {filteredIdeas.map((idea) => (
                      <button
                        key={idea.id}
                        onClick={() => openIdea(idea, 'Decision matrix', `${idea.businessValueScore} value / ${idea.scoring.effort} effort`)}
                        className="absolute rounded-2xl border border-white/80 bg-slate-950 px-3 py-2 text-left text-white shadow-lg transition-all hover:scale-[1.03]"
                        style={{
                          left: `${Math.max(12, 100 - idea.scoring.effort)}%`,
                          top: `${Math.max(10, 100 - idea.businessValueScore)}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                          <span className="text-xs font-semibold">{idea.title}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-300">
                          {idea.priority} • {idea.prioritization.cluster}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm">Move Item</Button>
                    <Button variant="outline" size="sm">
                      Re-score
                    </Button>
                  </div>
                </div>
              )}
            </Panel>
          ) : null}

          {activePanel === 'queue' ? (
            <Panel
              id="queue"
              title="AI Recommendation Queue Panel"
              description="Recommendations waiting for human decision before routing or execution commitment."
              highlight
              right={
                <Button variant="outline" size="sm">
                  Batch Review
                </Button>
              }
            >
              {loadingPanels.includes('queue') ? (
                <PanelSkeleton lines={5} />
              ) : (
                <div className="space-y-3">
                  {filteredIdeas.map((idea) => (
                    <button
                      key={idea.id}
                      onClick={() => openIdea(idea, 'Recommendation queue', idea.queue.suggestedAction)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-left transition-all hover:border-sky-300 hover:bg-sky-50/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{idea.title}</p>
                          <p className="mt-1 text-xs text-slate-600">{idea.queue.recommendationType}</p>
                        </div>
                        <Badge className={cn('border', priorityBadgeClass(idea.priority))}>{idea.priority}</Badge>
                      </div>
                      <div className="mt-2 text-xs text-slate-600">{idea.queue.suggestedAction}</div>
                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{idea.queue.status}</span>
                        <span>{idea.queue.timestamp}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm">Approve</Button>
                        <Button variant="outline" size="sm">
                          Reject
                        </Button>
                        <Button variant="ghost" size="sm">
                          Edit Before Approve
                        </Button>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          ) : null}

          {activePanel === 'audit' ? (
            <Panel
              id="audit"
              title="AI Activity & Audit Panel"
              description="Audit-friendly trace of classification, scoring, impact prediction, ranking, and routing events."
              highlight
              right={
                <Button variant="outline" size="sm" className="gap-2">
                  <FileDown className="h-3.5 w-3.5" />
                  Export Audit
                </Button>
              }
            >
              <div className="space-y-3">
                {auditEvents.map((event) => {
                  const relatedIdea = ideas.find((idea) => idea.id === event.relatedIdeaId)
                  if (!relatedIdea) return null

                  return (
                    <button
                      key={`${event.time}-${event.relatedIdeaId}`}
                      onClick={() => openIdea(relatedIdea, 'AI activity audit', event.action)}
                      className="grid w-full gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-left transition-all hover:border-sky-300 hover:bg-sky-50/40 lg:grid-cols-[180px_180px_minmax(0,1fr)_220px]"
                    >
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Timestamp</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{event.time}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Actor / system</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{event.actor}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">AI action / related idea</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{event.action}</p>
                        <p className="mt-1 text-xs text-slate-600">{relatedIdea.title}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Result</p>
                        <p className="mt-1 text-sm text-slate-700">{event.result}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </Panel>
          ) : null}
        </div>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-[1200] flex justify-end bg-black/30" role="dialog" aria-modal="true">
          <div className="h-full w-full max-w-[430px] border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Intelligence Detail Drawer</div>
                <div className="mt-1 text-xs text-slate-600">
                  {drawerContext.section} • {drawerContext.insight}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="h-[calc(100%-65px)] space-y-4 overflow-y-auto p-4 text-xs text-slate-700">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{selectedIdea.title}</p>
                  <Badge className="border border-slate-200 bg-white text-slate-700">{selectedIdea.category}</Badge>
                  <Badge className={cn('border', priorityBadgeClass(selectedIdea.priority))}>{selectedIdea.priority}</Badge>
                </div>
                <p className="mt-3 leading-6 text-slate-700">{selectedIdea.rationale}</p>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">AI classification</p>
                    <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">{selectedIdea.classificationConfidence}%</Badge>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-900">{selectedIdea.category}</p>
                  <p className="mt-1 text-xs text-slate-600">{selectedIdea.tags.join(' • ')}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Score breakdown</p>
                    <Badge className="border border-sky-200 bg-sky-50 text-sky-700">{selectedIdea.scoring.weightedOverall}</Badge>
                  </div>
                  <div className="mt-2 space-y-2">
                    <MetricBar label="Business value" value={selectedIdea.scoring.businessValue} />
                    <MetricBar label="Feasibility" value={selectedIdea.scoring.feasibility} />
                    <MetricBar label="Strategic fit" value={selectedIdea.scoring.strategicFit} />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Impact prediction</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{selectedIdea.impact.magnitude}</p>
                  <p className="mt-1 text-xs text-slate-600">{selectedIdea.impact.signals.join(' • ')}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Feasibility analysis</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{selectedIdea.feasibility.level}</p>
                  <p className="mt-1 text-xs text-slate-600">Limiting factors: {selectedIdea.feasibility.limitingFactors.join(' • ')}</p>
                  <p className="mt-1 text-xs text-slate-600">Dependencies: {selectedIdea.feasibility.dependencies.join(' • ')}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Strategic alignment</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{selectedIdea.alignment.objective}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Alignment strength {selectedIdea.alignment.strength}% • {selectedIdea.alignment.theme}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Recommended execution path</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900">{selectedIdea.execution.path}</p>
                    <Badge className="border border-slate-200 bg-slate-50 text-slate-700">{selectedIdea.execution.urgency}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{selectedIdea.execution.reason}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Confidence and explanation</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{selectedIdea.explainability.confidence}% recommendation confidence</p>
                  <p className="mt-1 text-xs text-slate-600">{selectedIdea.explainability.summary}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Review / approval history</p>
                  <div className="mt-2 space-y-2 text-xs text-slate-600">
                    {selectedIdea.reviewHistory.map((entry) => (
                      <div key={entry} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-500" />
                        <span>{entry}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button className="gap-2">
                  <BadgeCheck className="h-4 w-4" />
                  Approve Recommendation
                </Button>
                <Button variant="outline" className="gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Edit Score
                </Button>
                <Button variant="outline" className="gap-2">
                  <MoveRight className="h-4 w-4" />
                  Convert to Project
                </Button>
                <Button variant="ghost" className="gap-2">
                  <FileDown className="h-4 w-4" />
                  Export Analysis
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}