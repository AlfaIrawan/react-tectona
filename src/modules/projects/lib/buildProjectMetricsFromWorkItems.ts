import {
  Activity,
  CheckCircle2,
  Inbox,
  Layers,
  ListTodo,
  Search,
} from 'lucide-react'
import type { WorkItemApiModel, WorkStatus } from '@/lib/api/workApi'
import type { ProjectTemplate } from '../data/projectTemplates'
import { normalizeWorkStatus } from './projectWorkItemUtils'

const CHART_COLORS = {
  backlog: '#8b5cf6',
  todo: '#94a3b8',
  inProgress: '#0ea5e9',
  inReview: '#6366f1',
  done: '#059669',
}

const WORKFLOW_ORDER: WorkStatus[] = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done']

const STAGE_COLORS: Record<WorkStatus, string> = {
  Backlog: CHART_COLORS.backlog,
  'To Do': CHART_COLORS.todo,
  'In Progress': CHART_COLORS.inProgress,
  'In Review': CHART_COLORS.inReview,
  Done: CHART_COLORS.done,
}

function countByStatus(items: WorkItemApiModel[]): Record<WorkStatus, number> {
  const counts: Record<WorkStatus, number> = {
    Backlog: 0,
    'To Do': 0,
    'In Progress': 0,
    'In Review': 0,
    Done: 0,
  }
  for (const item of items) {
    counts[normalizeWorkStatus(item.status)] += 1
  }
  return counts
}

function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00.000Z`).getTime()
  const end = new Date(`${endIso}T00:00:00.000Z`).getTime()
  return Math.max(0, Math.round((end - start) / 86_400_000))
}

function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function openItems(items: WorkItemApiModel[]): WorkItemApiModel[] {
  return items.filter((item) => normalizeWorkStatus(item.status) !== 'Done')
}

export function buildProjectMetricsFromWorkItems(
  items: WorkItemApiModel[],
  options?: { template?: ProjectTemplate; anchorDate?: string },
) {
  const counts = countByStatus(items)
  const total = items.length
  const open = openItems(items)
  const anchor = options?.anchorDate ?? new Date().toISOString().slice(0, 10)

  const workflowLabels =
    options?.template?.workflow.length === 5
      ? options.template.workflow
      : WORKFLOW_ORDER

  const workflowStages = WORKFLOW_ORDER.map((status, index) => ({
    name: workflowLabels[index] ?? status,
    value: counts[status],
    color: STAGE_COLORS[status],
  }))

  const bottlenecks = WORKFLOW_ORDER.map((status, index) => ({
    stage: workflowLabels[index] ?? status,
    count: counts[status],
    fill: STAGE_COLORS[status],
  }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)

  const doneItems = items.filter((item) => normalizeWorkStatus(item.status) === 'Done')
  const cycleDays =
    doneItems.length > 0
      ? Math.round(
          doneItems.reduce((sum, item) => sum + daysBetween(anchor, item.dueDate), 0) / doneItems.length,
        )
      : 0
  const deliveryHealth = total > 0 ? Math.round((counts.Done / total) * 100) : 0

  const flowTrend = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'].map((week, index) => {
    const factor = (index + 1) / 6
    return {
      week,
      backlog: Math.max(0, Math.round(counts.Backlog * (1.15 - factor * 0.15))),
      todo: Math.max(0, Math.round(counts['To Do'] * (1.1 - factor * 0.1))),
      inProgress: Math.max(0, Math.round(counts['In Progress'] * (0.85 + factor * 0.15))),
      inReview: Math.max(0, Math.round(counts['In Review'] * (0.8 + factor * 0.2))),
      done: Math.max(0, Math.round(counts.Done * (0.5 + factor * 0.5))),
    }
  })

  const throughputTrend = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => ({
    day,
    items: Math.max(0, Math.round(counts.Done / 7) + (index % 3 === 0 ? 1 : 0)),
  }))

  const leadCycle = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'].map((week, index) => ({
    week,
    leadTime: Math.max(cycleDays + 4, cycleDays + 8 - index),
    cycleTime: Math.max(1, cycleDays + Math.round(index * 0.3)),
  }))

  const agingBuckets = [
    { bucket: '0-3 days', count: 0 },
    { bucket: '4-7 days', count: 0 },
    { bucket: '8-14 days', count: 0 },
    { bucket: '15+ days', count: 0 },
  ]
  for (const item of open) {
    const span = Math.max(0, daysBetween(anchor, item.dueDate))
    if (span <= 3) agingBuckets[0].count += 1
    else if (span <= 7) agingBuckets[1].count += 1
    else if (span <= 14) agingBuckets[2].count += 1
    else agingBuckets[3].count += 1
  }

  const assigneeCounts = new Map<string, number>()
  for (const item of open) {
    const name = item.assignee?.trim() || 'Unassigned'
    assigneeCounts.set(name, (assigneeCounts.get(name) ?? 0) + 1)
  }
  const workloadData = [...assigneeCounts.entries()]
    .map(([name, count]) => ({
      name: name.split(' ')[0] ?? name,
      items: count,
    }))
    .sort((a, b) => b.items - a.items)
    .slice(0, 6)

  const typeMix = new Map<string, number>()
  for (const item of items) {
    typeMix.set(item.type, (typeMix.get(item.type) ?? 0) + 1)
  }
  const assignmentMix = [...typeMix.entries()].map(([name, value]) => ({ name, value }))

  const capacityUtilization =
    open.length === 0 ? 0 : Math.min(96, Math.round((open.length / Math.max(total, 1)) * 100))

  const milestoneCandidates = items
    .filter((item) => item.type === 'Task' || item.type === 'Feature')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  const milestones = milestoneCandidates.slice(0, 4).map((item) => {
    const status = normalizeWorkStatus(item.status)
    return {
      name: item.title,
      date: formatShortDate(item.dueDate),
      status:
        status === 'Done'
          ? ('done' as const)
          : status === 'In Progress' || status === 'In Review'
            ? ('active' as const)
            : ('upcoming' as const),
    }
  })

  const risks = [
    ...(counts['In Review'] > 0
      ? [
          {
            id: 'R-01',
            title: `${counts['In Review']} contract/architecture items awaiting sign-off`,
            severity: 'High',
            owner: 'Legal & EA',
            status: 'Open',
          },
        ]
      : []),
    ...(items.some((item) => item.type === 'Bug' && normalizeWorkStatus(item.status) !== 'Done')
      ? [
          {
            id: 'R-02',
            title: 'Vendor API gap blocking development sprint',
            severity: 'High',
            owner: 'Tech Lead',
            status: 'Open',
          },
        ]
      : []),
    ...(counts.Backlog > 0
      ? [
          {
            id: 'R-03',
            title: `${counts.Backlog} backlog items awaiting pull into delivery`,
            severity: 'Medium',
            owner: 'Delivery Manager',
            status: 'Open',
          },
        ]
      : []),
  ].slice(0, 3)

  const topBottleneck = bottlenecks[0]
  const aiInsights = [
    {
      title: 'Delivery Confidence',
      tone: deliveryHealth >= 75 ? 'positive' : 'watch',
      body: `Flow health at ${deliveryHealth}% with ${counts.Done} of ${total} banking work items completed.`,
    },
    {
      title: 'WIP Recommendation',
      tone: counts['In Progress'] > 6 ? 'watch' : 'positive',
      body:
        counts['In Progress'] > 6
          ? `Reduce WIP in In Progress (${counts['In Progress']} items) before pulling from To Do.`
          : 'Current WIP levels align with squad capacity for vendor-to-dev transition.',
    },
    {
      title: 'Bottleneck Alert',
      tone: 'alert',
      body: `${topBottleneck?.stage ?? 'To Do'} shows the highest queue depth (${topBottleneck?.count ?? 0} items).`,
    },
    {
      title: 'Resource Recommendation',
      tone: capacityUtilization > 82 ? 'watch' : 'positive',
      body:
        capacityUtilization > 82
          ? 'Rebalance vendor evaluation and kick-off prep assignments before sprint zero.'
          : 'Team capacity has headroom to start development environment setup.',
    },
  ]

  return {
    executiveKpis: [
      { label: 'Total Work Items', value: String(total), icon: Layers, tone: 'neutral' as const },
      { label: 'Backlog', value: String(counts.Backlog), icon: Inbox, tone: 'neutral' as const },
      { label: 'To Do', value: String(counts['To Do']), icon: ListTodo, tone: 'neutral' as const },
      { label: 'In Progress', value: String(counts['In Progress']), icon: Activity, tone: 'info' as const },
      { label: 'In Review', value: String(counts['In Review']), icon: Search, tone: 'info' as const },
      { label: 'Completed', value: String(counts.Done), icon: CheckCircle2, tone: 'positive' as const },
    ],
    workflowStages,
    flowTrend,
    bottlenecks,
    throughputTrend,
    leadCycle,
    agingItems: agingBuckets,
    workloadData,
    capacityUtilization,
    assignmentMix,
    milestones,
    risks,
    aiInsights,
  }
}
