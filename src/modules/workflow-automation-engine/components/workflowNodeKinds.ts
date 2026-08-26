import {
  GitBranch,
  Play,
  Repeat2,
  RotateCcw,
  ShieldCheck,
  Split,
  Sparkles,
  Square,
  Timer,
  UserRound,
  Zap,
  type LucideIcon,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Node kind metadata for the prototype Workflow Builder canvas.
// Kept in a small standalone module so the palette, the custom node
// components, and the config panel all share one source of truth.
// ---------------------------------------------------------------------------

export type WorkflowNodeKind =
  | 'trigger'
  | 'action'
  | 'ifElse'
  | 'approval'
  | 'assignOwner'
  | 'aiProcess'
  | 'delay'
  | 'loop'
  | 'parallel'
  | 'retry'
  | 'end'

export type WorkflowNodeData = {
  kind: WorkflowNodeKind
  label: string
  /** Free-form per-kind configuration (prototype: everything is a string field). */
  config: Record<string, string>
  /** When true the node is skipped at execution time (pass-through). Persisted in the graph. */
  disabled?: boolean
  /** Transient validation flag injected at render time (never persisted). */
  _issue?: 'error' | 'warning'
}

export type WorkflowFieldType = 'text' | 'textarea' | 'select' | 'member' | 'actionTarget' | 'triggerDomain' | 'triggerEntity' | 'triggerEvent' | 'actionDomain' | 'actionEntity' | 'actionOperation'

export type WorkflowFieldDef = {
  key: string
  label: string
  type: WorkflowFieldType
  options?: readonly string[]
  placeholder?: string
}

export type WorkflowKindMeta = {
  kind: WorkflowNodeKind
  label: string
  hint: string
  icon: LucideIcon
  /** Accent colour for the top strip, icon chip, and handles. */
  accent: string
  /** Tailwind classes for the icon chip (light tint). */
  chipClass: string
  fields: readonly WorkflowFieldDef[]
  defaultConfig: Record<string, string>
}

export const WORKFLOW_TRIGGER_TYPES = ['Manual', 'Schedule', 'Event', 'Webhook'] as const
export const WORKFLOW_TRIGGER_EVENTS = ['Task Created', 'Task Updated', 'Milestone Due / Overdue', 'Dependency Changed', 'Risk or Issue Raised', 'Approval Requested', 'Resource Threshold Breached'] as const
export const WORKFLOW_SCHEDULES = ['Every hour', 'Every day', 'Every weekday', 'Every week', 'Every month'] as const
export const WORKFLOW_TIMEZONES = ['Asia/Jakarta', 'Asia/Singapore', 'UTC'] as const
export const WORKFLOW_WEBHOOK_EVENTS = ['Project system callback', 'External integration event', 'Custom webhook event'] as const
export const WORKFLOW_TRIGGER_EVENT_CATALOG = {
  'Project Management': {
    Project: ['Created', 'Updated', 'Status Changed', 'Health Changed', 'Owner Changed', 'Closed'],
    Task: ['Created', 'Updated', 'Status Changed', 'Priority Changed', 'Assignee Changed', 'Blocked', 'Unblocked', 'Overdue'],
    Milestone: ['Created', 'Due Soon', 'Overdue', 'Completed', 'Status Changed'],
    Dependency: ['Created', 'Changed', 'Blocked', 'Resolved'],
    'Risk / Issue': ['Created', 'Updated', 'Escalated', 'Closed'],
    Approval: ['Requested', 'Approved', 'Rejected', 'Expired'],
    'Project Member': ['Added', 'Removed', 'Role Changed'],
  },
  'Task & Work Management': {
    'Work Item': ['Created', 'Updated', 'Status Changed', 'Priority Changed', 'Assignee Changed', 'Completed'],
    Sprint: ['Started', 'Updated', 'Closed'],
    Checklist: ['Item Completed', 'All Items Completed', 'Updated'],
    Dependency: ['Added', 'Changed', 'Resolved'],
  },
  'Workspace Management': {
    Workspace: ['Created', 'Updated', 'Health Changed', 'Archived'],
    Member: ['Joined', 'Removed', 'Role Changed', 'Scope Changed'],
    Governance: ['Status Changed', 'Exception Created', 'Review Due'],
  },
  'Planning & Scheduling': {
    Schedule: ['Created', 'Updated', 'Variance Exceeded', 'Critical Path Changed'],
    Baseline: ['Published', 'Updated', 'Variance Exceeded'],
    Capacity: ['Threshold Breached', 'Allocation Changed', 'Resource Unavailable'],
    SLA: ['At Risk', 'Breached', 'Restored'],
  },
  'Resource Management': {
    Resource: ['Added', 'Updated', 'Unavailable', 'Availability Changed'],
    Allocation: ['Created', 'Changed', 'Overallocated', 'Released'],
    Capacity: ['Threshold Breached', 'Forecast Changed', 'Rebalanced'],
  },
  'Portfolio Governance': {
    Program: ['Created', 'Status Changed', 'Health Changed', 'Closed'],
    Initiative: ['Created', 'Status Changed', 'Risk Changed'],
    'OKR / KPI': ['Target Changed', 'Threshold Breached', 'Progress Updated'],
    'Stage Gate': ['Submitted', 'Approved', 'Rejected', 'Overdue'],
    Compliance: ['Exception Created', 'Evidence Missing', 'Status Changed'],
  },
  'Document & Knowledge': {
    Document: ['Uploaded', 'Updated', 'Version Published', 'Archived'],
    'Knowledge Article': ['Created', 'Updated', 'Published', 'Review Due'],
    'Meeting Note': ['Created', 'Decision Captured', 'Follow-up Created'],
    'Artifact Link': ['Created', 'Removed', 'Target Changed'],
  },
  'AI Project Intelligence': {
    'AI Insight': ['Generated', 'Severity Changed', 'Dismissed'],
    Prediction: ['Delay Risk Changed', 'Resource Risk Changed', 'Confidence Changed'],
    Recommendation: ['Created', 'Approved', 'Rejected', 'Executed'],
    'AI-generated Task': ['Ready for Review', 'Approved', 'Rejected', 'Created'],
  },
  'AI Idea & Prioritization': {
    Idea: ['Created', 'Scored', 'Prioritized', 'Approved', 'Converted to Project'],
    Recommendation: ['Created', 'Approved', 'Rejected'],
    'Decision Matrix': ['Updated', 'Threshold Breached'],
  },
  'Integration & API': {
    API: ['Request Failed', 'Response Received', 'Latency Breached'],
    Webhook: ['Delivered', 'Failed', 'Retried'],
    'Event Stream': ['Published', 'Consumer Lagged', 'Schema Failed'],
    'External System': ['Sync Started', 'Sync Completed', 'Sync Failed'],
  },
  'Security & Access': {
    User: ['Provisioned', 'Deactivated', 'Access Changed'],
    Role: ['Created', 'Updated', 'Assigned', 'Revoked'],
    Policy: ['Changed', 'Violation Detected', 'Exception Approved'],
    'Security Alert': ['Created', 'Escalated', 'Resolved'],
  },
  'Traceability & Monitoring': {
    'Audit Event': ['Created', 'Exported', 'Retention Due'],
    Lineage: ['Changed', 'Broken', 'Rebuilt'],
    'Platform Health': ['Degraded', 'Recovered', 'Threshold Breached'],
  },
  'Platform Settings': {
    'Feature Module': ['Enabled', 'Disabled', 'Rollout Changed'],
    'Notification Rule': ['Created', 'Updated', 'Escalation Triggered'],
    'Metadata Schema': ['Changed', 'Published', 'Validation Failed'],
  },
} as const

export const WORKFLOW_TRIGGER_DOMAINS = Object.keys(WORKFLOW_TRIGGER_EVENT_CATALOG) as Array<keyof typeof WORKFLOW_TRIGGER_EVENT_CATALOG>

export function workflowTriggerEntities(domain: string): string[] {
  const catalog = WORKFLOW_TRIGGER_EVENT_CATALOG[domain as keyof typeof WORKFLOW_TRIGGER_EVENT_CATALOG]
  return catalog ? Object.keys(catalog) : []
}

export function workflowTriggerEvents(domain: string, entity: string): string[] {
  const catalog = WORKFLOW_TRIGGER_EVENT_CATALOG[domain as keyof typeof WORKFLOW_TRIGGER_EVENT_CATALOG]
  return catalog?.[entity as keyof typeof catalog] ? [...catalog[entity as keyof typeof catalog]] : []
}

export const WORKFLOW_ACTION_CATALOG = {
  'Project Management': {
    Project: ['Create', 'Update Status', 'Update Health', 'Assign Owner', 'Close'],
    Task: ['Create', 'Update', 'Change Status', 'Change Priority', 'Assign Owner', 'Add Comment', 'Mark Blocked'],
    Milestone: ['Create', 'Update', 'Set Due Date', 'Complete'],
    Dependency: ['Create', 'Update', 'Resolve', 'Escalate'],
    'Risk / Issue': ['Create', 'Update', 'Assign Owner', 'Escalate', 'Close'],
    Approval: ['Request', 'Approve', 'Reject', 'Escalate'],
  },
  'Task & Work Management': {
    'Work Item': ['Create', 'Update', 'Change Status', 'Assign Owner', 'Add Comment', 'Complete'],
    Sprint: ['Start', 'Update', 'Close'],
    Checklist: ['Create Item', 'Complete Item', 'Complete All Items'],
    Dependency: ['Create', 'Resolve', 'Escalate'],
  },
  'Workspace Management': {
    Workspace: ['Create', 'Update', 'Archive'],
    Member: ['Invite', 'Remove', 'Change Role', 'Change Scope'],
    Governance: ['Open Review', 'Create Exception', 'Request Evidence'],
  },
  'Planning & Scheduling': {
    Schedule: ['Create', 'Update', 'Recalculate', 'Publish'],
    Baseline: ['Create', 'Publish', 'Update'],
    Capacity: ['Check', 'Rebalance', 'Escalate'],
    SLA: ['Start Timer', 'Pause Timer', 'Escalate Breach'],
  },
  'Resource Management': {
    Resource: ['Assign', 'Reassign', 'Release'],
    Allocation: ['Create', 'Update', 'Approve', 'Rebalance'],
    Capacity: ['Check', 'Rebalance', 'Notify Owner'],
  },
  'Portfolio Governance': {
    Program: ['Create', 'Update Status', 'Close'],
    Initiative: ['Create', 'Update Status', 'Assign Owner'],
    'OKR / KPI': ['Update Target', 'Update Progress', 'Flag Variance'],
    'Stage Gate': ['Submit', 'Approve', 'Reject', 'Escalate'],
    Compliance: ['Create Exception', 'Request Evidence', 'Escalate'],
  },
  'Document & Knowledge': {
    Document: ['Upload', 'Update Metadata', 'Publish Version', 'Archive'],
    'Knowledge Article': ['Create', 'Update', 'Publish', 'Request Review'],
    'Meeting Note': ['Create', 'Add Decision', 'Create Follow-up'],
    'Artifact Link': ['Link', 'Unlink', 'Update Target'],
  },
  'AI Project Intelligence': {
    'AI Insight': ['Create Task', 'Create Risk', 'Dismiss', 'Request Review'],
    Prediction: ['Create Alert', 'Update Risk', 'Notify Owner'],
    Recommendation: ['Approve', 'Reject', 'Execute'],
    'AI-generated Task': ['Approve', 'Reject', 'Create Task'],
  },
  'AI Idea & Prioritization': {
    Idea: ['Score', 'Prioritize', 'Approve', 'Convert to Project', 'Archive'],
    Recommendation: ['Approve', 'Reject', 'Execute'],
    'Decision Matrix': ['Update', 'Publish'],
  },
  'Integration & API': {
    API: ['Send Request', 'Retry Request', 'Validate Response'],
    Webhook: ['Send', 'Retry', 'Disable'],
    'Event Stream': ['Publish', 'Replay', 'Pause Consumer'],
    'External System': ['Start Sync', 'Retry Sync', 'Validate Mapping'],
  },
  'Security & Access': {
    User: ['Provision', 'Deactivate', 'Change Access'],
    Role: ['Create', 'Update', 'Assign', 'Revoke'],
    Policy: ['Publish', 'Create Exception', 'Enforce'],
    'Security Alert': ['Acknowledge', 'Escalate', 'Resolve'],
  },
  'Traceability & Monitoring': {
    'Audit Event': ['Export', 'Retain', 'Flag'],
    Lineage: ['Rebuild', 'Validate', 'Export'],
    'Platform Health': ['Create Alert', 'Escalate', 'Create Incident'],
  },
  'Platform Settings': {
    'Feature Module': ['Enable', 'Disable', 'Change Rollout'],
    'Notification Rule': ['Create', 'Update', 'Enable', 'Disable'],
    'Metadata Schema': ['Update', 'Publish', 'Validate'],
  },
  'Notifications & Alerts': {
    Notification: ['Send', 'Escalate', 'Schedule', 'Cancel'],
    'Alert Rule': ['Create', 'Update', 'Enable', 'Disable'],
  },
} as const

export const WORKFLOW_ACTION_DOMAINS = Object.keys(WORKFLOW_ACTION_CATALOG) as Array<keyof typeof WORKFLOW_ACTION_CATALOG>

export function workflowActionEntities(domain: string): string[] {
  const catalog = WORKFLOW_ACTION_CATALOG[domain as keyof typeof WORKFLOW_ACTION_CATALOG]
  return catalog ? Object.keys(catalog) : []
}

export function workflowActionOperations(domain: string, entity: string): string[] {
  const catalog = WORKFLOW_ACTION_CATALOG[domain as keyof typeof WORKFLOW_ACTION_CATALOG]
  return catalog?.[entity as keyof typeof catalog] ? [...catalog[entity as keyof typeof catalog]] : []
}
export const WORKFLOW_ACTION_TYPES = ['Create Task', 'Update Task', 'Assign / Reassign Owner', 'Update Milestone', 'Create Dependency', 'Create Risk / Issue', 'Add Comment', 'Send Notification', 'HTTP Request', 'Custom Script'] as const
export const WORKFLOW_CONDITION_FIELDS = ['Task Status', 'Priority', 'Milestone Due Date', 'Dependency Health', 'Risk Score', 'Resource Utilization', 'Approval Status'] as const
export const WORKFLOW_CONDITION_OPERATORS = ['is', 'is not', 'equals', 'greater than', 'less than', 'before', 'after'] as const
export const WORKFLOW_LOOP_COLLECTIONS = ['Tasks', 'Milestones', 'Dependencies', 'Risks / Issues', 'Project Members'] as const
export const WORKFLOW_PARALLEL_MODES = ['Run in parallel', 'Wait for all branches'] as const
export const WORKFLOW_RETRY_POLICIES = ['Retry on failure', 'Retry until timeout', 'Send to error path'] as const
export const WORKFLOW_TASK_STATUSES = ['To Do', 'In Progress', 'In Review', 'Blocked', 'Done', 'Cancelled'] as const
export const WORKFLOW_TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const
export const WORKFLOW_RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const
export const WORKFLOW_NOTIFICATION_CHANNELS = ['In-app notification', 'Email', 'Teams', 'Slack'] as const
export const WORKFLOW_END_OUTCOMES = ['Completed', 'Rejected', 'Cancelled'] as const

const ACTION_TARGET_LABELS: Record<string, string> = {
  current_task: 'Current task',
  current_project: 'Current project',
  current_milestone: 'Current milestone',
  project_backlog: 'Project backlog',
  selected_record: 'Selected record',
  external_endpoint: 'External endpoint',
  'project.backlog': 'Project backlog',
  'project.milestone': 'Current milestone',
  'project.scope': 'Current project',
  'project.baseline': 'Current project',
  'project.dependency': 'Selected record',
  'project.dependency-remediation': 'Selected record',
  'project.assignments': 'Current project',
}

export const WORKFLOW_KIND_META: Record<WorkflowNodeKind, WorkflowKindMeta> = {
  trigger: {
    kind: 'trigger',
    label: 'Trigger',
    hint: 'Entry point that starts the workflow',
    icon: Play,
    accent: '#0ea5e9',
    chipClass: 'bg-sky-50 text-sky-600 ring-sky-100',
    fields: [
      { key: 'triggerType', label: 'Trigger Type', type: 'select', options: WORKFLOW_TRIGGER_TYPES },
      { key: 'triggerDomain', label: 'Module', type: 'triggerDomain' },
      { key: 'triggerEntity', label: 'Entity / Section', type: 'triggerEntity' },
      { key: 'triggerEvent', label: 'Event', type: 'triggerEvent' },
      { key: 'schedule', label: 'Run Frequency', type: 'select', options: WORKFLOW_SCHEDULES },
      { key: 'timezone', label: 'Timezone', type: 'select', options: WORKFLOW_TIMEZONES },
      { key: 'webhookEvent', label: 'Webhook Source', type: 'select', options: WORKFLOW_WEBHOOK_EVENTS },
    ],
    defaultConfig: { triggerType: 'Manual', triggerDomain: 'Project Management', triggerEntity: 'Task', triggerEvent: 'Updated', event: 'Task Updated', schedule: 'Every day', timezone: 'Asia/Jakarta', webhookEvent: 'Project system callback' },
  },
  action: {
    kind: 'action',
    label: 'Action',
    hint: 'Perform a task, call, or update',
    icon: Zap,
    accent: '#6366f1',
    chipClass: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
    fields: [
      { key: 'actionDomain', label: 'Module', type: 'actionDomain' },
      { key: 'actionEntity', label: 'Entity / Section', type: 'actionEntity' },
      { key: 'actionOperation', label: 'Operation', type: 'actionOperation' },
    ],
    defaultConfig: { actionDomain: 'Project Management', actionEntity: 'Task', actionOperation: 'Create', actionType: 'Create Task', target: 'current_task', parameter: '' },
  },
  ifElse: {
    kind: 'ifElse',
    label: 'If / Else',
    hint: 'Branch on a condition (true / false)',
    icon: GitBranch,
    accent: '#f59e0b',
    chipClass: 'bg-amber-50 text-amber-600 ring-amber-100',
    fields: [
      { key: 'field', label: 'Field', type: 'select', options: WORKFLOW_CONDITION_FIELDS },
      { key: 'operator', label: 'Operator', type: 'select', options: WORKFLOW_CONDITION_OPERATORS },
      { key: 'value', label: 'Value', type: 'text', placeholder: 'e.g. High, 80, or Today' },
    ],
    defaultConfig: { field: 'Task Status', operator: 'is', value: 'Blocked' },
  },
  approval: {
    kind: 'approval',
    label: 'Approval',
    hint: 'Human approval gate',
    icon: ShieldCheck,
    accent: '#f97316',
    chipClass: 'bg-orange-50 text-orange-600 ring-orange-100',
    fields: [{ key: 'approver', label: 'Approver', type: 'text', placeholder: 'e.g. Finance Manager' }],
    defaultConfig: { approver: '' },
  },
  assignOwner: {
    kind: 'assignOwner',
    label: 'Assign Owner',
    hint: 'Assign work to a workspace member',
    icon: UserRound,
    accent: '#0891b2',
    chipClass: 'bg-cyan-50 text-cyan-600 ring-cyan-100',
    fields: [{ key: 'ownerId', label: 'Workspace Member', type: 'member', placeholder: 'Select a workspace member' }],
    defaultConfig: { ownerId: '' },
  },
  aiProcess: {
    kind: 'aiProcess',
    label: 'AI Process',
    hint: 'LLM reasoning / generation step',
    icon: Sparkles,
    accent: '#a855f7',
    chipClass: 'bg-purple-50 text-purple-600 ring-purple-100',
    fields: [{ key: 'prompt', label: 'Prompt / Task', type: 'textarea', placeholder: 'Describe the AI task…' }],
    defaultConfig: { prompt: '' },
  },
  delay: {
    kind: 'delay',
    label: 'Delay / Wait',
    hint: 'Pause execution for a duration',
    icon: Timer,
    accent: '#14b8a6',
    chipClass: 'bg-teal-50 text-teal-600 ring-teal-100',
    fields: [{ key: 'duration', label: 'Duration', type: 'text', placeholder: 'e.g. 30m, 2h, 1d' }],
    defaultConfig: { duration: '5m' },
  },
  loop: {
    kind: 'loop',
    label: 'Loop / For Each',
    hint: 'Repeat steps for project items',
    icon: Repeat2,
    accent: '#0d9488',
    chipClass: 'bg-teal-50 text-teal-600 ring-teal-100',
    fields: [{ key: 'collection', label: 'Collection', type: 'select', options: WORKFLOW_LOOP_COLLECTIONS }],
    defaultConfig: { collection: 'Tasks' },
  },
  parallel: {
    kind: 'parallel',
    label: 'Parallel / Join',
    hint: 'Run branches concurrently and join them',
    icon: Split,
    accent: '#2563eb',
    chipClass: 'bg-blue-50 text-blue-600 ring-blue-100',
    fields: [{ key: 'mode', label: 'Execution Mode', type: 'select', options: WORKFLOW_PARALLEL_MODES }],
    defaultConfig: { mode: 'Wait for all branches' },
  },
  retry: {
    kind: 'retry',
    label: 'Retry / Error',
    hint: 'Handle failed automation steps',
    icon: RotateCcw,
    accent: '#dc2626',
    chipClass: 'bg-red-50 text-red-600 ring-red-100',
    fields: [
      { key: 'policy', label: 'Failure Policy', type: 'select', options: WORKFLOW_RETRY_POLICIES },
      { key: 'maxAttempts', label: 'Max Attempts', type: 'text', placeholder: 'e.g. 3' },
    ],
    defaultConfig: { policy: 'Retry on failure', maxAttempts: '3' },
  },
  end: {
    kind: 'end',
    label: 'End / Stop',
    hint: 'Terminate the workflow',
    icon: Square,
    accent: '#ef4444',
    chipClass: 'bg-rose-50 text-rose-600 ring-rose-100',
    fields: [{ key: 'outcome', label: 'Outcome', type: 'select', options: WORKFLOW_END_OUTCOMES }],
    defaultConfig: { outcome: 'Completed' },
  },
}

/** Order the palette renders the kinds in. */
export const WORKFLOW_PALETTE_ORDER: readonly WorkflowNodeKind[] = [
  'trigger',
  'action',
  'ifElse',
  'approval',
  'assignOwner',
  'aiProcess',
  'delay',
  'loop',
  'parallel',
  'retry',
  'end',
]

/** MIME type used for palette drag-and-drop onto the canvas. */
export const WORKFLOW_PALETTE_MIME = 'application/tectona-workflow-node'

/** Short subtitle summarising a node's current configuration. */
export function workflowNodeSummary(data: WorkflowNodeData): string {
  const c = data.config
  switch (data.kind) {
    case 'trigger':
      if (!c.triggerType) return 'Configure trigger'
      if (c.triggerType === 'Event') return `${c.triggerType} · ${c.triggerDomain || 'Select module'} / ${c.triggerEntity || 'Select entity'} / ${c.triggerEvent || c.event || 'Select event'}`
      if (c.triggerType === 'Schedule') return `${c.triggerType} · ${c.schedule || 'Set frequency'}`
      if (c.triggerType === 'Webhook') return `${c.triggerType} · ${c.webhookEvent || 'Select source'}`
      return 'Manual trigger'
    case 'action':
      if (c.actionDomain && c.actionEntity && c.actionOperation) return `${c.actionDomain} · ${c.actionEntity} · ${c.actionOperation}`
      return c.target ? `${c.actionType} → ${ACTION_TARGET_LABELS[c.target] ?? c.target}` : c.actionType || 'Configure action'
    case 'ifElse':
      return c.field && c.operator && c.value
        ? `${c.field} ${c.operator} ${c.value}`
        : c.condition || 'Set a condition'
    case 'approval':
      return c.approver ? `Approver: ${c.approver}` : 'Assign an approver'
    case 'assignOwner':
      return c.ownerId ? `Assign to ${c.ownerId}` : 'Select a workspace member'
    case 'aiProcess':
      return c.prompt ? c.prompt.slice(0, 60) : 'Configure AI task'
    case 'delay':
      return c.duration ? `Wait ${c.duration}` : 'Set a duration'
    case 'loop':
      return c.collection ? `For each ${c.collection}` : 'Select a collection'
    case 'parallel':
      return c.mode || 'Configure parallel execution'
    case 'retry':
      return c.policy ? `${c.policy} · ${c.maxAttempts || '?'} attempts` : 'Configure error handling'
    case 'end':
      return c.outcome || 'Stop'
  }
}
