import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  BrainCircuit,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Download,
  FileUp,
  Filter,
  GitBranch,
  Layers3,
  MessageSquareText,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  Send,
  Settings2,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  UserRoundPlus,
  WandSparkles,
  Zap,
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
import { Textarea } from '@/components/ui/textarea'
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

type ConfidenceTone = 'high' | 'medium' | 'watch'
type PriorityTone = 'critical' | 'high' | 'medium'

type DrawerItem = {
  category: 'Insight' | 'Recommendation' | 'Prediction' | 'Action'
  title: string
  summary: string
  sourceContext: string
  linkedItem: string
  confidence: string
  explanation: string
  recommendedAction: string
  approvalHistory: string[]
  status: string
}

type StatCard = {
  label: string
  value: string
  delta: string
  accent: string
}

type TaskNode = {
  level: 'Requirement' | 'Epic' | 'Feature' | 'Task' | 'Subtask'
  title: string
  note: string
  status: string
  detail: DrawerItem
}

type DelayPrediction = {
  item: string
  project: string
  probability: number
  severity: PriorityTone
  impact: string
  cause: string
  confidence: string
  detail: DrawerItem
}

type RiskPrediction = {
  category: string
  probability: number
  impact: string
  trigger: string
  mitigation: string
  detail: DrawerItem
}

type ResourceRecommendation = {
  person: string
  team: string
  skillMatch: string
  availability: string
  utilizationImpact: string
  justification: string
  alternatives: string
  confidence: string
  detail: DrawerItem
}

type NextBestAction = {
  title: string
  reason: string
  urgency: PriorityTone
  linked: string
  expectedImpact: string
  detail: DrawerItem
}

type ActionQueueItem = {
  type: string
  generatedBy: string
  context: string
  target: string
  status: 'Pending Review' | 'Approved' | 'Rejected'
  timestamp: string
  detail: DrawerItem
}

type AuditEvent = {
  time: string
  actor: string
  action: string
  related: string
  result: string
}

type MeetingTask = {
  title: string
  summary: string
  decisions: string[]
  actions: string[]
  generatedTasks: string[]
  owners: string
  dueDates: string
  detail: DrawerItem
}

type ExplainabilitySignal = {
  label: string
  value: number
  note: string
}

type ChatMessage = {
  role: 'assistant' | 'user'
  content: string
  reference?: string
}

const statCards: StatCard[] = [
  { label: 'Total AI Insights', value: '184', delta: '+22 this week', accent: 'from-cyan-500/20 to-sky-500/10' },
  { label: 'Delay Risks Detected', value: '19', delta: '6 critical paths', accent: 'from-amber-500/20 to-orange-500/10' },
  { label: 'Risk Alerts', value: '12', delta: '3 need owner action', accent: 'from-rose-500/20 to-pink-500/10' },
  { label: 'Auto-Generated Tasks', value: '268', delta: '42 pending approval', accent: 'from-violet-500/20 to-indigo-500/10' },
  { label: 'Recommended Actions', value: '37', delta: '11 high-impact', accent: 'from-emerald-500/20 to-teal-500/10' },
  { label: 'Active AI Conversations', value: '9', delta: 'Across 5 projects', accent: 'from-slate-700/10 to-slate-500/5' },
]

const distributionData = [
  { name: 'Task generation', value: 32, color: '#2563eb' },
  { name: 'Predictions', value: 24, color: '#f97316' },
  { name: 'Recommendations', value: 21, color: '#10b981' },
  { name: 'Explainability', value: 13, color: '#8b5cf6' },
  { name: 'Actions pending review', value: 10, color: '#ef4444' },
]

const scheduleComparison = [
  { name: 'Week 1', baseline: 78, optimized: 82 },
  { name: 'Week 2', baseline: 76, optimized: 84 },
  { name: 'Week 3', baseline: 73, optimized: 86 },
  { name: 'Week 4', baseline: 71, optimized: 88 },
  { name: 'Week 5', baseline: 70, optimized: 89 },
]

const taskBreakdown: TaskNode[] = [
  {
    level: 'Requirement',
    title: 'Digital PMO acceleration BRD v3.2',
    note: 'Source: 48-page BRD with delivery guardrails and team operating model.',
    status: 'AI-generated',
    detail: {
      category: 'Insight',
      title: 'Requirement scope parsed from BRD v3.2',
      summary: 'AI extracted seven delivery workstreams, three compliance constraints, and five sprint-critical dependencies.',
      sourceContext: 'Requirement document uploaded by PMO Office on Apr 17, 2026.',
      linkedItem: 'Program Phoenix / Requirements / BRD v3.2',
      confidence: '93%',
      explanation: 'The model used requirement headings, action verbs, acceptance criteria, and dependency mentions to isolate executable delivery scope.',
      recommendedAction: 'Review generated epics before approving downstream backlog items.',
      approvalHistory: ['Generated by Atlas Project Model', 'Awaiting PM approval'],
      status: 'Pending Review',
    },
  },
  {
    level: 'Epic',
    title: 'Execution control modernization',
    note: 'Generated from sections 2.1, 3.4, and appendix A.',
    status: 'AI-generated',
    detail: {
      category: 'Recommendation',
      title: 'Epic created for execution control modernization',
      summary: 'Epic groups backlog automation, sprint health monitoring, and dependency governance under one release train.',
      sourceContext: 'Derived from BRD workstream clustering.',
      linkedItem: 'Epic TEC-AI-EP-12',
      confidence: '91%',
      explanation: 'The clustering model grouped functionally related deliverables that shared milestones and owner patterns.',
      recommendedAction: 'Approve epic to backlog and assign delivery lead.',
      approvalHistory: ['Clustered against prior enterprise PMO patterns'],
      status: 'Pending Review',
    },
  },
  {
    level: 'Feature',
    title: 'AI-generated backlog scaffolding',
    note: 'Includes story acceptance patterns and release readiness hooks.',
    status: 'Needs review',
    detail: {
      category: 'Recommendation',
      title: 'Feature for AI-generated backlog scaffolding',
      summary: 'Feature proposes a controlled pipeline from requirement ingestion to approved backlog structures.',
      sourceContext: 'Mapped from delivery decomposition and knowledge reuse patterns.',
      linkedItem: 'Feature TEC-AI-FE-42',
      confidence: '89%',
      explanation: 'The model inferred strong overlap with prior approved backlog scaffolding templates in enterprise delivery programs.',
      recommendedAction: 'Review estimation envelope and backlog approval criteria.',
      approvalHistory: ['Created from BRD decomposition model'],
      status: 'Pending Review',
    },
  },
  {
    level: 'Task',
    title: 'Create AI approval workflow for generated work items',
    note: 'Suggested owner: Delivery Ops / SLA 3 business days.',
    status: 'Pending approval',
    detail: {
      category: 'Action',
      title: 'Create approval workflow task',
      summary: 'The task formalizes human review before AI-generated work enters active backlog execution.',
      sourceContext: 'Control gap found in governance sections 5.2 and 5.5.',
      linkedItem: 'Task TEC-TSK-1193',
      confidence: '90%',
      explanation: 'Approval workflow is recommended because AI-generated scope affects planning, assignment, and milestone commitments.',
      recommendedAction: 'Push task to backlog and assign PMO operations owner.',
      approvalHistory: ['Risk review flagged governance dependency'],
      status: 'Pending Review',
    },
  },
  {
    level: 'Subtask',
    title: 'Define approval states, reviewer groups, and escalation SLA',
    note: 'Checklist inferred from governance control language and approval patterns.',
    status: 'Ready',
    detail: {
      category: 'Insight',
      title: 'Approval checklist generated',
      summary: 'Subtask covers approval states, reviewer roles, escalation triggers, and audit logging requirements.',
      sourceContext: 'Synthesized from requirement controls and meeting notes.',
      linkedItem: 'Checklist TEC-CHK-54',
      confidence: '95%',
      explanation: 'Checklist items were extracted from normative statements and past implementation patterns in similar delivery programs.',
      recommendedAction: 'Approve and export to work management.',
      approvalHistory: ['Checklist seeded from enterprise control library'],
      status: 'Ready',
    },
  },
]

const delayPredictions: DelayPrediction[] = [
  {
    item: 'Milestone: UAT readiness gate',
    project: 'Phoenix Modernization',
    probability: 84,
    severity: 'critical',
    impact: '7-day slip to release candidate sign-off',
    cause: 'Testing environment remains blocked by external dependency remediation.',
    confidence: 'High',
    detail: {
      category: 'Prediction',
      title: 'Delay predicted for UAT readiness gate',
      summary: 'The model predicts a likely gate slip due to unresolved environment readiness and slow dependency closure.',
      sourceContext: 'Project schedule, blocker feed, test environment incidents, and standup notes.',
      linkedItem: 'Phoenix Modernization / Milestone UAT readiness gate',
      confidence: '94%',
      explanation: 'Signals include repeated blocker age growth, low burn-down velocity for prerequisite tasks, and late vendor confirmation.',
      recommendedAction: 'Escalate dependency owner and move validation rehearsal earlier by two days.',
      approvalHistory: ['Predicted 12:10 PM', 'Reviewed by PMO analyst 12:24 PM'],
      status: 'Open',
    },
  },
  {
    item: 'Sprint 18 integration hardening',
    project: 'Retail Growth Platform',
    probability: 67,
    severity: 'high',
    impact: 'Reduced sprint throughput by 18%',
    cause: 'Work in progress concentration and low code review turnaround.',
    confidence: 'Medium-High',
    detail: {
      category: 'Prediction',
      title: 'Delay predicted for Sprint 18 integration hardening',
      summary: 'AI found a widening queue in review and unresolved integration defects that threaten sprint completion.',
      sourceContext: 'Sprint board, PR aging metrics, and retrospective action log.',
      linkedItem: 'Retail Growth Platform / Sprint 18',
      confidence: '88%',
      explanation: 'The model weighted open review duration, blocked stories, and defect clustering around integration touchpoints.',
      recommendedAction: 'Reallocate one reviewer pod and split hardening scope into two execution tracks.',
      approvalHistory: ['Created from sprint telemetry model'],
      status: 'Open',
    },
  },
  {
    item: 'Task cluster: Data migration rehearsal',
    project: 'Lending Core Renewal',
    probability: 58,
    severity: 'medium',
    impact: 'Checkpoint moves into next sprint',
    cause: 'Uncertain rehearsal window and incomplete cutover checklist.',
    confidence: 'Medium',
    detail: {
      category: 'Prediction',
      title: 'Delay predicted for data migration rehearsal',
      summary: 'The rehearsal cluster shows timing pressure due to readiness gaps and limited slot availability.',
      sourceContext: 'Cutover calendar, dependency board, and readiness checklist.',
      linkedItem: 'Lending Core Renewal / Migration rehearsal cluster',
      confidence: '79%',
      explanation: 'Primary contributors are incomplete prerequisite evidence and a narrow rescheduling window.',
      recommendedAction: 'Lock a backup rehearsal slot and complete checklist gating within 48 hours.',
      approvalHistory: ['Created from schedule optimization engine'],
      status: 'Monitoring',
    },
  },
]

const riskPredictions: RiskPrediction[] = [
  {
    category: 'Scope risk',
    probability: 76,
    impact: 'Feature spillover into release wave 3',
    trigger: 'Requirement changes increased without backlog sizing refresh.',
    mitigation: 'Run scope containment review and re-baseline estimation.',
    detail: {
      category: 'Prediction',
      title: 'Scope risk increasing in Phoenix Modernization',
      summary: 'Scope volatility is outpacing backlog resizing and governance checkpoints.',
      sourceContext: 'Requirement changes, sprint planning notes, and estimation drift.',
      linkedItem: 'Phoenix Modernization / Scope governance',
      confidence: '90%',
      explanation: 'Late scope additions and unchanged capacity plan create a strong spillover likelihood.',
      recommendedAction: 'Add to risk register and trigger scope board review.',
      approvalHistory: ['Predicted against prior release spillover pattern'],
      status: 'Open',
    },
  },
  {
    category: 'Dependency risk',
    probability: 69,
    impact: 'Critical milestone gating downstream testing',
    trigger: 'External vendor commitment remains unconfirmed for 11 days.',
    mitigation: 'Escalate vendor governance and create contingency path.',
    detail: {
      category: 'Prediction',
      title: 'Dependency risk flagged for external vendor handoff',
      summary: 'External readiness uncertainty continues to threaten the project critical path.',
      sourceContext: 'Dependency tracker, vendor follow-up history, and milestone sequencing.',
      linkedItem: 'Retail Growth Platform / Dependency DG-18',
      confidence: '87%',
      explanation: 'The model detected aging dependency records with no confirmed closure evidence and limited schedule float.',
      recommendedAction: 'Assign executive sponsor and add contingency mitigation.',
      approvalHistory: ['Created from dependency risk model'],
      status: 'Open',
    },
  },
  {
    category: 'Resource risk',
    probability: 61,
    impact: 'Overloaded solution architect causes decision latency',
    trigger: 'Single architect assigned to four concurrent escalation streams.',
    mitigation: 'Add secondary architecture owner and rebalance governance reviews.',
    detail: {
      category: 'Prediction',
      title: 'Resource risk due to single-threaded architecture ownership',
      summary: 'Key architectural decision flow may slow due to concentration on one senior owner.',
      sourceContext: 'Capacity model, approval lead time, and escalation queue.',
      linkedItem: 'Lending Core Renewal / Architecture review lane',
      confidence: '81%',
      explanation: 'Utilization variance and review cycle time trend both indicate emerging decision bottleneck risk.',
      recommendedAction: 'Assign secondary owner and move lower-risk approvals to delegate path.',
      approvalHistory: ['Created from utilization and cycle-time correlation'],
      status: 'Open',
    },
  },
]

const resourceRecommendations: ResourceRecommendation[] = [
  {
    person: 'Nadia Singh',
    team: 'Delivery Ops Guild',
    skillMatch: '96% governance and PMO automation fit',
    availability: 'Available in 4 business hours',
    utilizationImpact: '+8% utilization, remains within threshold',
    justification: 'Strong prior delivery on AI-assisted approval workflows and sprint controls.',
    alternatives: 'Ayla Brooks, Omar Velasquez',
    confidence: '92%',
    detail: {
      category: 'Recommendation',
      title: 'Assign Nadia Singh to approval workflow stream',
      summary: 'Nadia is the top-ranked recommendation due to governance workflow experience and current allocation window.',
      sourceContext: 'Skill graph, availability calendar, and delivery history.',
      linkedItem: 'Phoenix Modernization / Approval workflow stream',
      confidence: '92%',
      explanation: 'AI weighted skill adjacency, current load, prior similar delivery performance, and handoff overhead.',
      recommendedAction: 'Assign Nadia as workstream owner and notify Resource Management.',
      approvalHistory: ['Candidate ranking generated 09:42 AM'],
      status: 'Pending Review',
    },
  },
  {
    person: 'Mina Alvarez',
    team: 'Migration Guild',
    skillMatch: '91% migration planning fit',
    availability: 'Partial availability this sprint',
    utilizationImpact: '+6% utilization with no overtime breach',
    justification: 'Brings migration rehearsal and checkpoint recovery experience.',
    alternatives: 'Riku Tan, Helena Moore',
    confidence: '88%',
    detail: {
      category: 'Recommendation',
      title: 'Assign Mina Alvarez to migration rehearsal recovery',
      summary: 'Recommendation balances experience with available time window and minimal ramp-up.',
      sourceContext: 'Capacity plan, previous project outcomes, and role similarity graph.',
      linkedItem: 'Lending Core Renewal / Migration rehearsal recovery',
      confidence: '88%',
      explanation: 'The model identified Mina as the best near-term fit given readiness risks and limited onboarding cost.',
      recommendedAction: 'Confirm allocation and send to Resource Management.',
      approvalHistory: ['Candidate fit model executed against current sprint allocations'],
      status: 'Pending Review',
    },
  },
]

const nextBestActions: NextBestAction[] = [
  {
    title: 'Reassign overloaded owner in sprint hardening lane',
    reason: 'Review queue is concentrated on one senior engineer and cycle time is deteriorating.',
    urgency: 'critical',
    linked: 'Retail Growth Platform / Sprint 18',
    expectedImpact: 'Recover 2.3 days in review throughput',
    detail: {
      category: 'Action',
      title: 'Reassign overloaded sprint hardening owner',
      summary: 'AI recommends distributing the review and integration queue to reduce accumulating delay risk.',
      sourceContext: 'Review aging, sprint WIP, and blocked story density.',
      linkedItem: 'Retail Growth Platform / Sprint 18 hardening lane',
      confidence: '90%',
      explanation: 'The queue is bottlenecked by a single approver, and similar patterns previously produced late sprint rollover.',
      recommendedAction: 'Apply reassignment to two backup reviewers and monitor 24-hour recovery.',
      approvalHistory: ['Action generated 10:18 AM'],
      status: 'Pending Review',
    },
  },
  {
    title: 'Split large task before milestone lock',
    reason: 'One generated backlog item exceeds team throughput norms by 2.1x.',
    urgency: 'high',
    linked: 'Phoenix Modernization / Epic TEC-AI-EP-12',
    expectedImpact: 'Improves planning accuracy and lowers spillover risk',
    detail: {
      category: 'Action',
      title: 'Split large generated task before milestone lock',
      summary: 'Large task sizing would undermine sprint confidence and delivery sequencing if left unchanged.',
      sourceContext: 'Backlog sizing model and historical team velocity.',
      linkedItem: 'Task TEC-TSK-1193',
      confidence: '86%',
      explanation: 'Generated task effort exceeds team norm bands and has multiple hidden dependency markers.',
      recommendedAction: 'Split the task into governance workflow, UI approval states, and audit integration components.',
      approvalHistory: ['Generated from backlog sizing intelligence'],
      status: 'Pending Review',
    },
  },
  {
    title: 'Escalate blocked dependency to steering forum',
    reason: 'No vendor closure signal has been recorded in the last 72 hours.',
    urgency: 'medium',
    linked: 'Retail Growth Platform / Dependency DG-18',
    expectedImpact: 'Creates executive attention before milestone breach',
    detail: {
      category: 'Action',
      title: 'Escalate blocked dependency to steering forum',
      summary: 'The dependency has aged past acceptable tolerance and needs governance intervention.',
      sourceContext: 'Dependency tracker and escalation SLA policy.',
      linkedItem: 'Dependency DG-18',
      confidence: '84%',
      explanation: 'Risk age, absent response, and limited float all crossed the escalation threshold.',
      recommendedAction: 'Escalate to steering forum and attach contingency plan.',
      approvalHistory: ['Generated from dependency governance rules'],
      status: 'Pending Review',
    },
  },
]

const meetings: MeetingTask[] = [
  {
    title: 'Program Phoenix delivery checkpoint',
    summary: 'AI summarized blockers in environment readiness, clarified approval path, and captured backlog decision points.',
    decisions: ['Use two-stage approval for AI-generated work items', 'Move dry-run review ahead of steering checkpoint'],
    actions: ['Confirm PMO reviewer group', 'Finalize contingency for external dependency'],
    generatedTasks: ['Create approval workflow task', 'Prepare revised milestone narrative', 'Assign backup reviewer pod'],
    owners: 'Nadia Singh, Ayla Brooks, Vendor Office inferred',
    dueDates: 'Apr 19, Apr 20, Apr 22 inferred',
    detail: {
      category: 'Insight',
      title: 'Meeting notes converted into executable task bundle',
      summary: 'Three action items and a revised decision log were extracted from the checkpoint meeting transcript.',
      sourceContext: 'Imported transcript from Apr 17 checkpoint meeting.',
      linkedItem: 'Program Phoenix / Meeting checkpoint 2026-04-17',
      confidence: '91%',
      explanation: 'Owner inference used speaker roles, prior action ownership patterns, and direct commitment language.',
      recommendedAction: 'Approve tasks to backlog and link them to the active project milestone.',
      approvalHistory: ['Transcript imported', 'Summary reviewed by PM analyst'],
      status: 'Pending Review',
    },
  },
]

const explainabilitySignals: ExplainabilitySignal[] = [
  { label: 'Blocker aging trend', value: 86, note: 'Most influential signal on current delay forecast' },
  { label: 'Dependency closure latency', value: 72, note: 'Repeated late confirmations increase critical path exposure' },
  { label: 'Workload concentration', value: 64, note: 'Single-owner review bottlenecks reduce schedule resilience' },
  { label: 'Backlog sizing drift', value: 58, note: 'Generated items exceed team norm bands in two workstreams' },
]

const actionQueue: ActionQueueItem[] = [
  {
    type: 'Task Breakdown Approval',
    generatedBy: 'Requirement Intelligence Engine',
    context: 'BRD v3.2 scope extraction',
    target: 'Epic TEC-AI-EP-12',
    status: 'Pending Review',
    timestamp: 'Apr 17, 13:16',
    detail: taskBreakdown[1].detail,
  },
  {
    type: 'Resource Recommendation',
    generatedBy: 'Allocation Optimizer',
    context: 'Phoenix milestone recovery',
    target: 'Nadia Singh assignment',
    status: 'Pending Review',
    timestamp: 'Apr 17, 13:02',
    detail: resourceRecommendations[0].detail,
  },
  {
    type: 'Next Best Action',
    generatedBy: 'Execution Nudge Engine',
    context: 'Retail sprint hardening',
    target: 'Reassign review owner',
    status: 'Approved',
    timestamp: 'Apr 17, 11:44',
    detail: nextBestActions[0].detail,
  },
  {
    type: 'Delay Mitigation',
    generatedBy: 'Predictive Scheduler',
    context: 'Migration rehearsal recovery',
    target: 'Lock backup rehearsal slot',
    status: 'Rejected',
    timestamp: 'Apr 17, 10:31',
    detail: delayPredictions[2].detail,
  },
]

const auditEvents: AuditEvent[] = [
  { time: '13:16', actor: 'AI Engine', action: 'Task breakdown generated', related: 'BRD v3.2', result: '42 work items staged for review' },
  { time: '13:02', actor: 'AI Engine', action: 'Resource recommendation created', related: 'Phoenix milestone recovery', result: 'Top candidate ranked with 92% confidence' },
  { time: '12:24', actor: 'M. Lestari', action: 'Delay explanation reviewed', related: 'UAT readiness gate', result: 'Mitigation review requested' },
  { time: '11:44', actor: 'PMO Director', action: 'AI action approved', related: 'Sprint hardening reassignment', result: 'Sent to Resource Management' },
  { time: '10:18', actor: 'AI Assistant', action: 'Conversation saved as insight', related: 'Retail Growth Platform', result: 'Linked to sprint context' },
]

const initialChat: ChatMessage[] = [
  {
    role: 'assistant',
    content: 'Phoenix Modernization has one critical delay forecast, two high-priority actions pending approval, and a recommended reviewer reassignment to recover schedule confidence.',
    reference: 'Linked items: UAT readiness gate, TEC-TSK-1193, Nadia Singh recommendation',
  },
  {
    role: 'user',
    content: 'Why was the UAT gate predicted to slip?',
  },
  {
    role: 'assistant',
    content: 'The strongest signals were blocker age growth, low prerequisite completion velocity, and unconfirmed vendor closure. Confidence is 94% because the same combination preceded milestone slippage in similar programs.',
    reference: 'Signals: blocker aging 86, dependency closure latency 72, workload concentration 64',
  },
]

const confidenceStyles: Record<ConfidenceTone, string> = {
  high: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  watch: 'border-rose-200 bg-rose-50 text-rose-700',
}

const priorityStyles: Record<PriorityTone, string> = {
  critical: 'border-rose-200 bg-rose-50 text-rose-700',
  high: 'border-amber-200 bg-amber-50 text-amber-700',
  medium: 'border-sky-200 bg-sky-50 text-sky-700',
}

function kpiCardChrome(cardId: string): string {
  const base =
    'rounded-2xl p-4 transition-all duration-200 relative overflow-hidden group border border-white/40 ring-1 ring-black/[0.04] shadow-[0_14px_40px_rgba(15,23,42,0.10)] hover:-translate-y-0.5 hover:shadow-[0_18px_56px_rgba(15,23,42,0.14)]'

  if (cardId === 'insights') return cn(base, 'bg-gradient-to-br from-slate-50/85 via-white/90 to-sky-50/75')
  if (cardId === 'delays') return cn(base, 'bg-gradient-to-br from-indigo-50/70 via-white/90 to-violet-50/70')
  if (cardId === 'risks') return cn(base, 'bg-gradient-to-br from-rose-50/70 via-white/90 to-amber-50/70')
  if (cardId === 'tasks') return cn(base, 'bg-gradient-to-br from-violet-50/70 via-white/90 to-indigo-50/70')
  if (cardId === 'actions') return cn(base, 'bg-gradient-to-br from-emerald-50/70 via-white/90 to-cyan-50/70')
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

function numericFromText(text: string): number {
  const digitsOnly = text.replace(/[^\d.]/g, '')
  const parsed = Number(digitsOnly)
  return Number.isFinite(parsed) ? parsed : 0
}

const filterOptions = {
  project: ['All projects', 'Phoenix Modernization', 'Retail Growth Platform', 'Lending Core Renewal'],
  workspace: ['All workspaces', 'Enterprise PMO', 'Retail Transformation', 'Lending Transformation'],
  team: ['All teams', 'PMO Core', 'Delivery Ops Guild', 'Migration Guild'],
  intelligenceType: ['All types', 'Task generation', 'Prediction', 'Recommendation', 'Explainability'],
  riskLevel: ['All levels', 'Critical', 'High', 'Medium'],
  delayLikelihood: ['Any likelihood', 'Above 80%', '60-79%', 'Below 60%'],
  recommendationType: ['All recommendations', 'Resource', 'Schedule', 'Action', 'Governance'],
  timePeriod: ['This week', 'Last 7 days', 'This month', 'Quarter to date'],
}

function confidenceToneFromLabel(label: string): ConfidenceTone {
  if (label.toLowerCase().includes('high') || label.startsWith('9')) return 'high'
  if (label.toLowerCase().includes('medium') || label.startsWith('8')) return 'medium'
  return 'watch'
}

function matchesSearch(search: string, values: string[]) {
  if (!search.trim()) return true
  const normalized = search.toLowerCase()
  return values.some((value) => value.toLowerCase().includes(normalized))
}

function SectionSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={`skeleton-${index}`}
          className="h-11 animate-pulse rounded-2xl border border-slate-200/70 bg-slate-100/80"
        />
      ))}
    </div>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: typeof BrainCircuit
  title: string
  description: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Icon className="h-4 w-4 text-slate-700" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function AIProjectIntelligencePage() {
  const deferredSearch = ''
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(false)
  const [activeSection, setActiveSection] = useState<
    | 'overview'
    | 'assistant'
    | 'breakdown'
    | 'scheduling'
    | 'delay'
    | 'risk'
    | 'resources'
    | 'actions'
    | 'meetings'
    | 'explainability'
    | 'queue'
    | 'audit'
  >('overview')
  const [selectedDetail, setSelectedDetail] = useState<DrawerItem | null>(delayPredictions[0].detail)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAssistantLoading, setIsAssistantLoading] = useState(false)
  const [assistantPrompt, setAssistantPrompt] = useState('Summarize the most urgent execution actions for Phoenix Modernization.')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialChat)

  useEffect(() => {
    if (!isGenerating) return
    const timeoutId = window.setTimeout(() => setIsGenerating(false), 1200)
    return () => window.clearTimeout(timeoutId)
  }, [isGenerating])

  useEffect(() => {
    if (!isAssistantLoading) return
    const timeoutId = window.setTimeout(() => {
      setChatMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: 'Priority sequence: approve the generated approval workflow tasks, reassign the sprint hardening reviewer bottleneck, and escalate the blocked vendor dependency before the next milestone checkpoint.',
          reference: 'Suggested references: TEC-TSK-1193, Sprint 18 hardening lane, Dependency DG-18',
        },
      ])
      setIsAssistantLoading(false)
    }, 1000)
    return () => window.clearTimeout(timeoutId)
  }, [isAssistantLoading])

  useEffect(() => {
    const sectionIds: Array<typeof activeSection> = [
      'overview',
      'assistant',
      'breakdown',
      'scheduling',
      'delay',
      'risk',
      'resources',
      'actions',
      'meetings',
      'explainability',
      'queue',
      'audit',
    ]

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element))

    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0]

        const nextId = visible?.target?.id as typeof activeSection | undefined
        if (nextId) setActiveSection(nextId)
      },
      { root: null, threshold: [0.12, 0.22, 0.35], rootMargin: '-20% 0px -72% 0px' }
    )

    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  const scrollToSection = (id: typeof activeSection) => {
    const element = document.getElementById(id)
    if (!element) return
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveSection(id)
  }

  const filteredDelayPredictions = delayPredictions.filter((item) =>
    matchesSearch(deferredSearch, [item.item, item.project, item.cause, item.impact])
  )
  const filteredRisks = riskPredictions.filter((item) =>
    matchesSearch(deferredSearch, [item.category, item.impact, item.trigger])
  )
  const filteredResources = resourceRecommendations.filter((item) =>
    matchesSearch(deferredSearch, [item.person, item.team, item.justification, item.alternatives])
  )
  const filteredActions = nextBestActions.filter((item) =>
    matchesSearch(deferredSearch, [item.title, item.reason, item.linked, item.expectedImpact])
  )

  const kpiCards = statCards.map((stat) => {
    const last = numericFromText(stat.value)
    const base = Math.max(1, Math.round(last * 0.82))
    const series = [base, Math.round(last * 0.86), Math.round(last * 0.9), Math.round(last * 0.94), last]

    const id =
      stat.label === 'Total AI Insights'
        ? 'insights'
        : stat.label === 'Delay Risks Detected'
          ? 'delays'
          : stat.label === 'Risk Alerts'
            ? 'risks'
            : stat.label === 'Auto-Generated Tasks'
              ? 'tasks'
              : stat.label === 'Recommended Actions'
                ? 'actions'
                : 'conversations'

    const icon =
      stat.label === 'Total AI Insights'
        ? BrainCircuit
        : stat.label === 'Delay Risks Detected'
          ? TrendingUp
          : stat.label === 'Risk Alerts'
            ? ShieldAlert
            : stat.label === 'Auto-Generated Tasks'
              ? GitBranch
              : stat.label === 'Recommended Actions'
                ? Zap
                : MessageSquareText

    const trendColor =
      id === 'insights'
        ? '#0ea5e9'
        : id === 'delays'
          ? '#6366f1'
          : id === 'risks'
            ? '#f59e0b'
            : id === 'tasks'
              ? '#8b5cf6'
              : id === 'actions'
                ? '#10b981'
                : '#06b6d4'

    return {
      id,
      label: stat.label,
      value: stat.value,
      delta: stat.delta,
      icon,
      trendColor,
      trendSeries: series,
    }
  })

  const runAssistantPrompt = () => {
    const prompt = assistantPrompt.trim() || 'What should I do next?'
    setChatMessages((current) => [...current, { role: 'user', content: prompt }])
    setAssistantPrompt('')
    setIsAssistantLoading(true)
  }

  const openDetail = (detail: DrawerItem) => setSelectedDetail(detail)

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
  }, [navDocked, isWorkspaceCollapsed, activeSection, isGenerating, isAssistantLoading, assistantPrompt])

  return (
    <div className="space-y-6 pb-8 text-slate-900">
      <div className={cn('space-y-6', workspaceDockedContentInsetClass(navDocked, isWorkspaceCollapsed, enterpriseNavWidthVariant))}>
        <Breadcrumb items={[{ label: 'Project Management', href: '/project-management' }, { label: 'AI Project Intelligence' }]} />

        <PageHeader
          title="AI Project Intelligence"
          description="Use AI to generate work, predict delivery issues, recommend actions, and assist project execution"
          right={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white/75 p-1.5 shadow-sm backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => setIsGenerating(true)}
                  className="flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition-all duration-200 hover:bg-white hover:text-slate-900 hover:shadow-sm"
                  aria-label="Generate intelligence"
                  title="Generate intelligence"
                >
                  <Sparkles className="h-5 w-5" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition-all duration-200 hover:bg-white hover:text-slate-900 hover:shadow-sm"
                  aria-label="Upload requirement"
                  title="Upload requirement"
                >
                  <FileUp className="h-5 w-5" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition-all duration-200 hover:bg-white hover:text-slate-900 hover:shadow-sm"
                  aria-label="Import meeting notes"
                  title="Import meeting notes"
                >
                  <Mic className="h-5 w-5" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center rounded-lg p-2.5 text-slate-500 transition-all duration-200 hover:bg-white hover:text-slate-900 hover:shadow-sm"
                  aria-label="AI settings"
                  title="AI settings"
                >
                  <Settings2 className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {kpiCards.map((item) => (
            <button key={item.label} type="button" className="group text-left" onClick={() => openDetail(taskBreakdown[0].detail)}>
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
                    <span className="truncate">{item.delta}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-slate-500" />
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
            aria-label="AI intelligence workspace navigation"
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
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-100/80">Intelligence Workspace</div>
                  <div className="mt-2 text-base font-semibold leading-tight">
                    Control tower for AI-driven execution insights, predictions, and governed actions
                  </div>
                </div>
              ) : null}
            </div>

            <div className={workspaceNavMenuScrollClass()}>
              <div className={cn(enterpriseNavUltra ? 'space-y-1.5' : enterpriseNavCompact ? 'space-y-2' : 'space-y-4')}>
              {(
                [
                  {
                    group: 'Command Center' as const,
                    items: [
                      {
                        id: 'overview',
                        label: 'Intelligence Overview',
                        description: 'High-level command posture for insights, prediction volume, and AI health.',
                        icon: BrainCircuit,
                        badge: 'Command',
                      },
                      {
                        id: 'assistant',
                        label: 'AI Assistant',
                        description: 'Conversational assistant linked to execution context and traceable outputs.',
                        icon: Bot,
                        badge: 'Chat',
                      },
                    ],
                  },
                  {
                    group: 'Control Library' as const,
                    items: [
                      {
                        id: 'breakdown',
                        label: 'Auto Task Breakdown',
                        description: 'Requirement → backlog structure generation with approvals and exports.',
                        icon: GitBranch,
                        badge: 'Work',
                      },
                      {
                        id: 'scheduling',
                        label: 'Smart Scheduling',
                        description: 'Baseline vs AI-optimized schedule recommendations.',
                        icon: CalendarClock,
                        badge: 'Plan',
                      },
                      {
                        id: 'delay',
                        label: 'Delay Prediction',
                        description: 'Milestone and sprint delay risk with explainable causes.',
                        icon: TrendingUp,
                        badge: 'Risk',
                      },
                      {
                        id: 'risk',
                        label: 'Risk Prediction',
                        description: 'Scope, dependency, and resource risk outlook with heatmap.',
                        icon: ShieldAlert,
                        badge: 'Heat',
                      },
                      {
                        id: 'actions',
                        label: 'Next Best Action',
                        description: 'Action nudges that prevent risks becoming outcomes.',
                        icon: Zap,
                        badge: 'Nudge',
                      },
                      {
                        id: 'queue',
                        label: 'AI Action Queue',
                        description: 'Human-in-the-loop approvals before execution changes.',
                        icon: WandSparkles,
                        badge: 'HITL',
                      },
                    ],
                  },
                  {
                    group: 'Assurance & Traceability' as const,
                    items: [
                      {
                        id: 'resources',
                        label: 'Resource Recommendation',
                        description: 'Assignment and reallocation recommendations with confidence.',
                        icon: UserRoundPlus,
                        badge: 'People',
                      },
                      {
                        id: 'meetings',
                        label: 'Meeting → Tasks',
                        description: 'Convert meeting notes into governed task bundles.',
                        icon: MessageSquareText,
                        badge: 'Sync',
                      },
                      {
                        id: 'explainability',
                        label: 'Explainability',
                        description: 'Signals and confidence behind predictions and actions.',
                        icon: Target,
                        badge: 'Why',
                      },
                      {
                        id: 'audit',
                        label: 'AI Activity & Audit',
                        description: 'Traceable activity stream for governance and review.',
                        icon: Clock3,
                        badge: 'Audit',
                      },
                    ],
                  },
                ] satisfies Array<{
                  group: string
                  items: Array<{
                    id: typeof activeSection
                    label: string
                    description: string
                    badge: string
                    icon: React.ComponentType<{ className?: string }>
                  }>
                }>
              ).map(({ group, items }) => (
                <div key={group} className="space-y-1.5">
                  {!isWorkspaceCollapsed && !enterpriseNavCompact ? (
                    <div className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{group}</div>
                  ) : null}
                  {items.map((item) => {
                    const Icon = item.icon
                    const active = activeSection === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => scrollToSection(item.id)}
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
                        aria-label={item.label}
                        title={item.label}
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
                              <span className="block truncate text-sm font-semibold text-slate-900">{item.label}</span>
                              {!enterpriseNavCompact ? (
                                <span
                                  className={cn(
                                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                                    active ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'
                                  )}
                                >
                                  {item.badge}
                                </span>
                              ) : null}
                            </span>
                            {!enterpriseNavCompact ? (
                              <span className="mt-1 block text-[11px] leading-4 text-slate-500">{item.description}</span>
                            ) : null}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ))}
              </div>
            </div>
          </div>
        </aside>

        <div className={cn('min-w-0', workspaceMainColumnClass(navDocked, isWorkspaceCollapsed, enterpriseNavWidthVariant))}>
          <section id="overview" className="scroll-mt-24">
            <div className="grid gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-8 rounded-[28px] liquid-glass-enterprise-panel">
            <CardHeader className="p-5 pb-0">
              <SectionHeader
                icon={BrainCircuit}
                title="AI Intelligence Overview"
                description="High-level visibility into generated work, predictive findings, recommendation volume, and overall AI confidence posture."
                actions={<Badge className="border-cyan-200 bg-cyan-50 text-cyan-700">Updated 2 min ago</Badge>}
              />
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {statCards.map((stat) => (
                  <button
                    key={stat.label}
                    type="button"
                    onClick={() => openDetail(taskBreakdown[0].detail)}
                    className={cn(
                      'rounded-[22px] border border-slate-200/80 bg-gradient-to-br p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg',
                      stat.accent,
                    )}
                  >
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{stat.label}</div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div className="text-2xl font-semibold text-slate-950">{stat.value}</div>
                      <Badge className="border-slate-200 bg-white/90 text-slate-700">{stat.delta}</Badge>
                    </div>
                  </button>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Intelligence Distribution by Type</div>
                      <div className="text-xs text-slate-500">Current mix of AI-generated insights, predictions, and governed actions</div>
                    </div>
                    <Badge className="border-slate-200 bg-white text-slate-700">Live distribution</Badge>
                  </div>
                  {isGenerating ? (
                    <SectionSkeleton rows={5} />
                  ) : (
                    <div className="h-[220px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={distributionData} layout="vertical" margin={{ left: 12, right: 16, top: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} width={120} />
                          <RechartsTooltip cursor={{ fill: 'rgba(226,232,240,0.45)' }} />
                          <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                            {distributionData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="grid gap-3">
                  <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-sm">
                    <div className="text-sm font-semibold text-slate-950">AI Health & Confidence</div>
                    <div className="mt-4 space-y-3">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-500"><span>Recommendation confidence</span><span>91%</span></div>
                        <div className="h-2 rounded-full bg-slate-100"><div className="h-2 w-[91%] rounded-full bg-gradient-to-r from-cyan-500 to-sky-500" /></div>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-500"><span>Prediction explainability coverage</span><span>88%</span></div>
                        <div className="h-2 rounded-full bg-slate-100"><div className="h-2 w-[88%] rounded-full bg-gradient-to-r from-violet-500 to-indigo-500" /></div>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-500"><span>Human review completion</span><span>73%</span></div>
                        <div className="h-2 rounded-full bg-slate-100"><div className="h-2 w-[73%] rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" /></div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-slate-200/80 bg-slate-950 p-4 text-white shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">Decision support signal</div>
                        <div className="mt-1 text-xs text-slate-300">Projects most likely to need PMO intervention</div>
                      </div>
                      <PanelRightOpen className="h-4 w-4 text-slate-300" />
                    </div>
                    <div className="mt-4 space-y-3">
                      {['Phoenix Modernization', 'Retail Growth Platform', 'Lending Core Renewal'].map((name, index) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => openDetail(delayPredictions[index]?.detail ?? delayPredictions[0].detail)}
                          className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:bg-white/10"
                        >
                          <div>
                            <div className="text-xs font-medium text-white">{name}</div>
                            <div className="text-[11px] text-slate-300">{index === 0 ? 'Critical delay signal' : index === 1 ? 'Execution action pending' : 'Schedule watchlist'}</div>
                          </div>
                          <Badge className={cn('border-white/10 bg-white/10 text-white', index === 0 && 'text-rose-200', index === 1 && 'text-amber-200')}>{index === 0 ? 'Urgent' : index === 1 ? 'Review' : 'Watch'}</Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card id="assistant" className="xl:col-span-4 scroll-mt-24 rounded-[28px] liquid-glass-enterprise-panel">
            <CardHeader className="p-5 pb-0">
              <SectionHeader
                icon={Bot}
                title="Conversational AI Assistant"
                description="Project-aware assistant for status, schedule, predictions, task generation, and next actions."
                actions={<Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Context linked</Badge>}
              />
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4">
                <div className="mb-3 flex flex-wrap gap-2">
                  {['Phoenix Modernization', 'Sprint 18', 'UAT milestone', 'Delay risk'].map((chip) => (
                    <Badge key={chip} className="border-slate-200 bg-white text-slate-700">{chip}</Badge>
                  ))}
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
                  {['Why was the risk predicted?', 'Generate tasks from meeting output', 'What should I escalate today?'].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setAssistantPrompt(prompt)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  {chatMessages.map((message, index) => (
                    <div key={`${message.role}-${index}`} className={cn('rounded-[22px] border p-3', message.role === 'assistant' ? 'border-slate-200 bg-white shadow-sm' : 'border-sky-200 bg-sky-50')}>
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{message.role === 'assistant' ? 'AI assistant' : 'You'}</div>
                      <div className="text-sm leading-6 text-slate-800">{message.content}</div>
                      {message.reference ? <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">{message.reference}</div> : null}
                    </div>
                  ))}
                  {isAssistantLoading ? <SectionSkeleton rows={2} /> : null}
                </div>
                <div className="mt-4 rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm">
                  <Textarea
                    value={assistantPrompt}
                    onChange={(event) => setAssistantPrompt(event.target.value)}
                    placeholder="Ask about project status, schedule recommendations, risks, task generation, or next actions"
                    className="min-h-[96px] resize-none border-0 px-0 py-0 text-sm shadow-none focus-visible:ring-0"
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                      <span>Suggested prompts:</span>
                      <span>status</span>
                      <span>risk explanation</span>
                      <span>task generation</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">
                        <ClipboardList className="mr-2 h-4 w-4" />
                        Insert into Task / Project
                      </Button>
                      <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">
                        <Download className="mr-2 h-4 w-4" />
                        Save Insight
                      </Button>
                      <Button className="h-8 rounded-xl bg-slate-950 px-3 text-xs text-white hover:bg-slate-800" onClick={runAssistantPrompt}>
                        <Send className="mr-2 h-4 w-4" />
                        Ask AI
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card id="breakdown" className="xl:col-span-7 scroll-mt-24 rounded-[28px] liquid-glass-enterprise-panel">
            <CardHeader className="p-5 pb-0">
              <SectionHeader
                icon={GitBranch}
                title="Auto Task Breakdown"
                description="AI-generated structure from requirement documents, user stories, and uploaded delivery artifacts."
                actions={
                  <>
                    <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Generate Breakdown</Button>
                    <Button className="h-8 rounded-xl bg-slate-950 px-3 text-xs text-white hover:bg-slate-800">Approve to Backlog</Button>
                  </>
                }
              />
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              <div className="grid gap-3 md:grid-cols-4">
                {[
                  { label: 'Source document', value: 'BRD v3.2' },
                  { label: 'Generated epics', value: '7' },
                  { label: 'Generated features', value: '18' },
                  { label: 'Generated tasks', value: '42' },
                ].map((item) => (
                  <div key={item.label} className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                    <div className="mt-2 text-lg font-semibold text-slate-950">{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">Requirement to backlog hierarchy</div>
                    <div className="text-xs text-slate-500">Requirement → Epic → Feature → Task → Subtask with governance-aware AI suggestions</div>
                  </div>
                  <Badge className="border-violet-200 bg-violet-50 text-violet-700">AI-generated structure</Badge>
                </div>
                {isGenerating ? (
                  <SectionSkeleton rows={5} />
                ) : (
                  <div className="space-y-3">
                    {taskBreakdown.map((node, index) => (
                      <button
                        key={`${node.level}-${node.title}`}
                        type="button"
                        onClick={() => openDetail(node.detail)}
                        className="flex w-full items-start gap-3 rounded-[22px] border border-slate-200/80 bg-slate-50/70 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md"
                      >
                        <div className="flex w-10 justify-center pt-0.5">
                          <div className="relative">
                            <div className="h-8 w-8 rounded-2xl border border-slate-200 bg-white text-[10px] font-semibold text-slate-700 flex items-center justify-center">{index + 1}</div>
                            {index < taskBreakdown.length - 1 ? <div className="absolute left-1/2 top-8 h-6 w-px -translate-x-1/2 bg-slate-200" /> : null}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="border-slate-200 bg-white text-slate-700">{node.level}</Badge>
                            <Badge className="border-cyan-200 bg-cyan-50 text-cyan-700">{node.status}</Badge>
                          </div>
                          <div className="mt-2 text-sm font-semibold text-slate-950">{node.title}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-500">{node.note}</div>
                        </div>
                        <ChevronRight className="mt-1 h-4 w-4 text-slate-400" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Review Structure</Button>
                <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Edit Generated Tasks</Button>
                <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Export to Project / Work Management</Button>
              </div>
            </CardContent>
          </Card>

          <Card id="scheduling" className="xl:col-span-5 scroll-mt-24 rounded-[28px] liquid-glass-enterprise-panel">
            <CardHeader className="p-5 pb-0">
              <SectionHeader
                icon={CalendarClock}
                title="Smart Scheduling Recommendation"
                description="AI-optimized schedule alternatives with sprint allocation and critical path sensitivity guidance."
                actions={<Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Baseline vs optimized</Badge>}
              />
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { label: 'Suggested timeline', value: '18 weeks', note: '2 weeks faster than baseline' },
                  { label: 'Recommended sprint allocation', value: '6 sprints', note: 'Team load normalized' },
                  { label: 'Critical path sensitivity', value: 'High on vendor dependency', note: 'Needs escalation path' },
                  { label: 'Optimization opportunity', value: '11%', note: 'From reviewer rebalancing' },
                ].map((item) => (
                  <div key={item.label} className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                    <div className="mt-2 text-base font-semibold text-slate-950">{item.value}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.note}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-950">Baseline vs AI-optimized plan</div>
                {isGenerating ? (
                  <SectionSkeleton rows={4} />
                ) : (
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={scheduleComparison} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <RechartsTooltip />
                        <Line type="monotone" dataKey="baseline" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="optimized" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="h-8 rounded-xl bg-slate-950 px-3 text-xs text-white hover:bg-slate-800" onClick={() => openDetail(delayPredictions[0].detail)}>Apply Recommendation</Button>
                <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Compare Schedule</Button>
                <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Send to Planning & Scheduling</Button>
              </div>
            </CardContent>
          </Card>

          <Card id="delay" className="xl:col-span-6 scroll-mt-24 rounded-[28px] liquid-glass-enterprise-panel">
            <CardHeader className="p-5 pb-0">
              <SectionHeader
                icon={TrendingUp}
                title="Delay Prediction"
                description="Predicted delay risk across milestones, sprints, and task clusters with explainable causes and confidence signals."
              />
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0">
              {isGenerating ? (
                <SectionSkeleton rows={4} />
              ) : (
                filteredDelayPredictions.map((prediction) => (
                  <button
                    key={prediction.item}
                    type="button"
                    onClick={() => openDetail(prediction.detail)}
                    className="w-full rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-lg"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">{prediction.item}</div>
                        <div className="mt-1 text-xs text-slate-500">{prediction.project}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={priorityStyles[prediction.severity]}>{prediction.severity} severity</Badge>
                        <Badge className={confidenceStyles[confidenceToneFromLabel(prediction.confidence)]}>{prediction.confidence} confidence</Badge>
                        <Badge className="border-violet-200 bg-violet-50 text-violet-700">Prediction</Badge>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-500"><span>Delay probability</span><span>{prediction.probability}%</span></div>
                      <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-gradient-to-r from-amber-500 to-rose-500" style={{ width: `${prediction.probability}%` }} /></div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Predicted impact</div>
                        <div className="mt-1 text-sm text-slate-800">{prediction.impact}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Likely cause</div>
                        <div className="mt-1 text-sm text-slate-800">{prediction.cause}</div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">View Explanation</Button>
                      <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Mitigate Delay</Button>
                      <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Escalate</Button>
                      <Button className="h-8 rounded-xl bg-slate-950 px-3 text-xs text-white hover:bg-slate-800">Open Linked Project</Button>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card id="risk" className="xl:col-span-6 scroll-mt-24 rounded-[28px] liquid-glass-enterprise-panel">
            <CardHeader className="p-5 pb-0">
              <SectionHeader
                icon={ShieldAlert}
                title="Risk Prediction"
                description="AI-predicted project and execution risks across scope, schedule, dependencies, resources, and governance."
                actions={<Badge className="border-rose-200 bg-rose-50 text-rose-700">Heatmap-informed</Badge>}
              />
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-950">Risk heatmap</div>
                <div className="grid grid-cols-5 gap-2">
                  {[18, 24, 42, 66, 81, 22, 38, 48, 71, 88].map((value, index) => (
                    <div
                      key={`heat-${index}`}
                      className="flex h-14 items-center justify-center rounded-2xl border border-white/60 text-xs font-semibold text-slate-700"
                      style={{ background: `rgba(${value > 70 ? '239,68,68' : value > 45 ? '245,158,11' : '14,165,233'},0.15)` }}
                    >
                      {value}%
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {filteredRisks.map((risk) => (
                  <button
                    key={risk.category}
                    type="button"
                    onClick={() => openDetail(risk.detail)}
                    className="w-full rounded-[22px] border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">{risk.category}</div>
                        <div className="mt-1 text-xs text-slate-500">Trigger signals: {risk.trigger}</div>
                      </div>
                      <Badge className={priorityStyles[risk.probability > 74 ? 'critical' : risk.probability > 64 ? 'high' : 'medium']}>{risk.probability}% probability</Badge>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Business / delivery impact</div>
                        <div className="mt-1 text-sm text-slate-800">{risk.impact}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Recommended mitigation</div>
                        <div className="mt-1 text-sm text-slate-800">{risk.mitigation}</div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Review Risk</Button>
                      <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Assign Owner</Button>
                      <Button className="h-8 rounded-xl bg-slate-950 px-3 text-xs text-white hover:bg-slate-800">Add to Risk Register</Button>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card id="resources" className="xl:col-span-5 scroll-mt-24 rounded-[28px] liquid-glass-enterprise-panel">
            <CardHeader className="p-5 pb-0">
              <SectionHeader
                icon={UserRoundPlus}
                title="Resource Recommendation"
                description="AI recommendations for assignment and reallocation based on skill fit, availability, and utilization impact."
              />
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0">
              {filteredResources.map((item) => (
                <button
                  key={item.person}
                  type="button"
                  onClick={() => openDetail(item.detail)}
                  className="w-full rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{item.person}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.team}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="border-cyan-200 bg-cyan-50 text-cyan-700">Recommended</Badge>
                      <Badge className={confidenceStyles[confidenceToneFromLabel(item.confidence)]}>{item.confidence} confidence</Badge>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Skill match</div>
                      <div className="mt-1 text-sm text-slate-800">{item.skillMatch}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Availability</div>
                      <div className="mt-1 text-sm text-slate-800">{item.availability}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Utilization impact</div>
                      <div className="mt-1 text-sm text-slate-800">{item.utilizationImpact}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Alternatives</div>
                      <div className="mt-1 text-sm text-slate-800">{item.alternatives}</div>
                    </div>
                  </div>
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-500">{item.justification}</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button className="h-8 rounded-xl bg-slate-950 px-3 text-xs text-white hover:bg-slate-800">Assign Recommended Resource</Button>
                    <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Compare Candidates</Button>
                    <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Send to Resource Management</Button>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card id="actions" className="xl:col-span-7 scroll-mt-24 rounded-[28px] liquid-glass-enterprise-panel">
            <CardHeader className="p-5 pb-0">
              <SectionHeader
                icon={Zap}
                title="Next Best Action"
                description="Action-oriented nudges that help project leads recover execution flow before risks become outcomes."
              />
            </CardHeader>
            <CardContent className="grid gap-3 p-5 pt-0 lg:grid-cols-3">
              {filteredActions.map((action) => (
                <button
                  key={action.title}
                  type="button"
                  onClick={() => openDetail(action.detail)}
                  className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50/80 p-4 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Badge className={priorityStyles[action.urgency]}>{action.urgency} urgency</Badge>
                    <Badge className="border-violet-200 bg-violet-50 text-violet-700">Recommendation</Badge>
                  </div>
                  <div className="mt-3 text-sm font-semibold text-slate-950">{action.title}</div>
                  <div className="mt-2 text-xs leading-5 text-slate-500">{action.reason}</div>
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">Linked: {action.linked}</div>
                  <div className="mt-3 text-xs font-medium text-slate-700">Expected impact: {action.expectedImpact}</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button className="h-8 rounded-xl bg-slate-950 px-3 text-xs text-white hover:bg-slate-800">Apply Action</Button>
                    <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Dismiss</Button>
                    <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Save for Review</Button>
                    <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">View Explanation</Button>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card id="meetings" className="xl:col-span-6 scroll-mt-24 rounded-[28px] liquid-glass-enterprise-panel">
            <CardHeader className="p-5 pb-0">
              <SectionHeader
                icon={MessageSquareText}
                title="Meeting Summary to Task Creation"
                description="Convert meeting notes, transcripts, and summaries into governed action items with owners and due dates."
              />
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              {meetings.map((meeting) => (
                <button
                  key={meeting.title}
                  type="button"
                  onClick={() => openDetail(meeting.detail)}
                  className="w-full rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-lg"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{meeting.title}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">{meeting.summary}</div>
                    </div>
                    <Badge className="border-cyan-200 bg-cyan-50 text-cyan-700">Meeting intelligence</Badge>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Decisions captured</div>
                      <ul className="mt-2 space-y-2 text-sm text-slate-800">
                        {meeting.decisions.map((decision) => <li key={decision} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />{decision}</li>)}
                      </ul>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Generated tasks</div>
                      <ul className="mt-2 space-y-2 text-sm text-slate-800">
                        {meeting.generatedTasks.map((task) => <li key={task} className="flex gap-2"><ClipboardList className="mt-0.5 h-4 w-4 text-sky-500" />{task}</li>)}
                      </ul>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">Assigned owners: {meeting.owners}</div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">Due dates: {meeting.dueDates}</div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Import Meeting Notes</Button>
                    <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Generate Tasks</Button>
                    <Button className="h-8 rounded-xl bg-slate-950 px-3 text-xs text-white hover:bg-slate-800">Approve to Backlog</Button>
                    <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Link to Project</Button>
                    <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Edit Before Save</Button>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card id="explainability" className="xl:col-span-6 scroll-mt-24 rounded-[28px] liquid-glass-enterprise-panel">
            <CardHeader className="p-5 pb-0">
              <SectionHeader
                icon={Target}
                title="Explainability & Confidence"
                description="Business-friendly reasoning that shows why AI generated a prediction or recommendation and which signals mattered most."
              />
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Confidence score</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">94%</div>
                  <div className="mt-1 text-xs text-slate-500">For current delay explanation</div>
                </div>
                <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Data sources used</div>
                  <div className="mt-2 text-sm font-semibold text-slate-950">7 sources</div>
                  <div className="mt-1 text-xs text-slate-500">Schedules, tasks, blockers, meetings, utilization, dependencies, approvals</div>
                </div>
                <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Reasoning summary</div>
                  <div className="mt-2 text-sm font-semibold text-slate-950">Critical path under pressure</div>
                  <div className="mt-1 text-xs text-slate-500">Delay exposure driven by compounding blockers and slow dependency closure</div>
                </div>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 text-sm font-semibold text-slate-950">Top signals considered</div>
                <div className="space-y-3">
                  {explainabilitySignals.map((signal) => (
                    <button key={signal.label} type="button" onClick={() => openDetail(delayPredictions[0].detail)} className="w-full rounded-[20px] border border-slate-200 bg-slate-50/80 px-3 py-3 text-left transition hover:border-slate-300 hover:bg-white">
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-500"><span>{signal.label}</span><span>{signal.value}</span></div>
                      <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-gradient-to-r from-slate-950 to-sky-500" style={{ width: `${signal.value}%` }} /></div>
                      <div className="mt-2 text-xs text-slate-500">{signal.note}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">View Detail</Button>
                <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Compare Prediction</Button>
                <Button className="h-8 rounded-xl bg-slate-950 px-3 text-xs text-white hover:bg-slate-800">Flag for Review</Button>
              </div>
            </CardContent>
          </Card>

          <Card id="queue" className="xl:col-span-5 scroll-mt-24 rounded-[28px] liquid-glass-enterprise-panel">
            <CardHeader className="p-5 pb-0">
              <SectionHeader
                icon={WandSparkles}
                title="AI Action Queue"
                description="AI-generated actions awaiting human approval before they change backlog, assignments, or schedules."
                actions={<Badge className="border-amber-200 bg-amber-50 text-amber-700">Human approval required</Badge>}
              />
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0">
              {actionQueue.map((item) => (
                <button
                  key={`${item.type}-${item.timestamp}`}
                  type="button"
                  onClick={() => openDetail(item.detail)}
                  className="w-full rounded-[22px] border border-slate-200 bg-slate-50/80 p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{item.type}</div>
                      <div className="mt-1 text-xs text-slate-500">Generated by {item.generatedBy}</div>
                    </div>
                    <Badge className={item.status === 'Approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : item.status === 'Rejected' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>{item.status}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-600">
                    <div>Source context: {item.context}</div>
                    <div>Suggested target: {item.target}</div>
                    <div>Timestamp: {item.timestamp}</div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button className="h-8 rounded-xl bg-slate-950 px-3 text-xs text-white hover:bg-slate-800">Approve</Button>
                    <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Reject</Button>
                    <Button variant="outline" className="h-8 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Edit Before Apply</Button>
                  </div>
                </button>
              ))}
              <Button variant="outline" className="h-8 w-full rounded-xl border-slate-200 bg-white text-xs text-slate-700">Batch Approve</Button>
            </CardContent>
          </Card>

          <Card id="audit" className="xl:col-span-7 scroll-mt-24 rounded-[28px] liquid-glass-enterprise-panel">
            <CardHeader className="p-5 pb-0">
              <SectionHeader
                icon={Clock3}
                title="AI Activity & Audit"
                description="Recent AI activity, review steps, and execution history with traceable outcomes for governance and audit."
              />
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                <div className="grid grid-cols-[0.8fr_0.9fr_1.3fr_1.3fr_1fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <div>Timestamp</div>
                  <div>Actor / system</div>
                  <div>AI action</div>
                  <div>Related object</div>
                  <div>Result</div>
                </div>
                <div className="divide-y divide-slate-200">
                  {auditEvents.map((event) => (
                    <button
                      key={`${event.time}-${event.action}`}
                      type="button"
                      onClick={() => openDetail(delayPredictions[0].detail)}
                      className="grid w-full grid-cols-[0.8fr_0.9fr_1.3fr_1.3fr_1fr] gap-3 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      <div>{event.time}</div>
                      <div>{event.actor}</div>
                      <div>{event.action}</div>
                      <div>{event.related}</div>
                      <div>{event.result}</div>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
            </div>
          </section>
        </div>
      </div>

      <div className={cn('fixed inset-0 z-40 bg-slate-950/25 backdrop-blur-[2px] transition-opacity duration-200', selectedDetail ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0')} onClick={() => setSelectedDetail(null)} />
      <aside className={cn('fixed right-0 top-0 z-50 flex h-screen w-full max-w-[480px] flex-col border-l border-slate-200 bg-white shadow-[0_32px_80px_-24px_rgba(15,23,42,0.35)] transition-transform duration-300', selectedDetail ? 'translate-x-0' : 'translate-x-full')}>
        {selectedDetail ? (
          <>
            <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#0f172a,_#1e293b_42%,_#2563eb_100%)] p-6 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge className="mb-3 border-white/15 bg-white/10 text-white">{selectedDetail.category}</Badge>
                  <h3 className="text-xl font-semibold leading-tight">{selectedDetail.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{selectedDetail.summary}</p>
                </div>
                <button type="button" onClick={() => setSelectedDetail(null)} className="rounded-full border border-white/10 bg-white/10 p-2 text-white transition hover:bg-white/15">
                  <ArrowRight className="h-4 w-4 rotate-180" />
                </button>
              </div>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Confidence level</div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">{selectedDetail.confidence}</div>
                </div>
                <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Status</div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">{selectedDetail.status}</div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-950">Source context</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{selectedDetail.sourceContext}</p>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-950">Linked project / task / document</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{selectedDetail.linkedItem}</p>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-950">Explanation</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{selectedDetail.explanation}</p>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-sm font-semibold text-slate-950">Recommended action</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{selectedDetail.recommendedAction}</p>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-950">Approval history</div>
                <div className="mt-3 space-y-2">
                  {selectedDetail.approvalHistory.map((entry) => (
                    <div key={entry} className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-600">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                      <span>{entry}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200 bg-white p-4">
              <div className="flex flex-wrap gap-2">
                <Button className="h-9 rounded-xl bg-slate-950 px-4 text-xs text-white hover:bg-slate-800">Apply</Button>
                <Button variant="outline" className="h-9 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Dismiss</Button>
                <Button variant="outline" className="h-9 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Save</Button>
                <Button variant="outline" className="h-9 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Export</Button>
                <Button variant="outline" className="h-9 rounded-xl border-slate-200 bg-white text-xs text-slate-700">Open Linked Item</Button>
              </div>
            </div>
          </>
        ) : null}
      </aside>
    </div>
  )
}