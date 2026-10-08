import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
  type EdgeTypes,
  type NodeTypes,
  type OnSelectionChangeFunc,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { AlertTriangle, ArrowLeft, Bell, BoxSelect, Bug, CalendarClock, CalendarDays, CheckCircle2, Clock3, Code2, Copy, Flag, Globe2, Info, LayoutGrid, Link2, Loader2, Maximize2, MessageSquare, MousePointerClick, Pencil, Play, PlayCircle, PlugZap, Plus, Power, Save, Send, Settings2, ShieldCheck, Tag, Trash2, TriangleAlert, Unlink, UserRound, Users, Wand2, Webhook, Zap, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, ContextMenuSubmenu } from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectItem } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useTenantContextOptional } from '@/auth/TenantContext'
import { useToast } from '@/components/ui/toast'
import { isAllWorkspacesSelection, readStoredTenantSelection } from '@/lib/tenantWorkspaceScope'
import { cn } from '@/lib/utils'
import { DocumentTemplateKindField } from '@/modules/workflow-automation-engine/components/DocumentTemplateKindField'
import { EmailBodyField } from '@/modules/workflow-automation-engine/components/EmailBodyField'
import { EmailRecipientsField } from '@/modules/workflow-automation-engine/components/EmailRecipientsField'
import { WorkflowConnectionPreview } from '@/modules/workflow-automation-engine/components/WorkflowConnectionPreview'
import { WorkflowCanvasActionsProvider, type WorkflowWaypoint } from '@/modules/workflow-automation-engine/components/workflowCanvasActions'
import { fetchAllWorkspaceOrgWorkspacesCached } from '@/lib/workspaceOrgDirectoryCache'
import type { WorkspaceOrgWorkspaceDto } from '@/lib/api/workspaceOrgApi'
import { WorkflowBuilderNode } from '@/modules/workflow-automation-engine/components/workflowBuilderNodes'
import { WorkflowRoutedEdge } from '@/modules/workflow-automation-engine/components/workflowRoutedEdge'
import {
  WORKFLOW_KIND_META,
  WORKFLOW_PALETTE_MIME,
  WORKFLOW_PALETTE_ORDER,
  WORKFLOW_ACTION_DOMAINS,
  WORKFLOW_DOCUMENT_STATUSES,
  workflowActionEntities,
  workflowActionOperations,
  WORKFLOW_NOTIFICATION_CHANNELS,
  WORKFLOW_RISK_LEVELS,
  WORKFLOW_TASK_PRIORITIES,
  WORKFLOW_TASK_STATUSES,
  WORKFLOW_TRIGGER_DOMAINS,
  workflowTriggerEntities,
  workflowTriggerEvents,
  type WorkflowNodeData,
  type WorkflowNodeKind,
} from '@/modules/workflow-automation-engine/components/workflowNodeKinds'
import {
  approveWorkflowRun,
  createWorkflow as createWorkflowApi,
  getWorkflow,
  getWorkflowRun,
  getWorkflowVersion,
  listWorkflowApprovalRoles,
  listWorkflowRuns,
  listWorkflowVersions,
  publishWorkflowApi,
  rejectWorkflowRun,
  runWorkflow,
  updateWorkflow,
  type WorkflowRunDto,
  type WorkflowRunStepStatus,
  type WorkflowRunStatus,
  type WorkflowRunSummaryDto,
  type WorkflowGraph,
  type WorkflowCreateInput,
  type WorkflowDto,
  type WorkflowVersionDto,
  type WorkflowApprovalRoleDto,
} from '@/lib/api/workflowAutomationApi'
import {
  IDEA_PANEL_CATALOG,
  readIdeaSectionVisibility,
  type IdeaPanelKey,
  type IdeaSectionVisibility,
  type IdeaSectionVisibilityMap,
} from '@/modules/project-management/lib/ideaPanelCatalog'

type WorkflowGraphRecord = {
  name: string
  nodes: Node<WorkflowNodeData>[]
  edges: Edge[]
  ideaSections?: IdeaSectionVisibilityMap
  savedAt?: string
  /** Bumped when the pre-built templates change, so stale autosaves are re-seeded. */
  version?: number
}

const WORKFLOW_TEMPLATE_VERSION = 3
const RESIZE_ALIGNMENT_THRESHOLD = 12

type NodeFrame = { x: number; y: number; width: number; height: number }

function frameForNode(node: Node<WorkflowNodeData>): NodeFrame {
  const fallback = workflowNodeSize(node.data.kind)
  const width = Number(node.style?.width ?? node.width ?? fallback.width)
  const height = Number(node.style?.height ?? node.height ?? fallback.height)
  return { x: node.position.x, y: node.position.y, width, height }
}

function nearestAlignment(value: number, guides: number[]): number | null {
  let closest: number | null = null
  let distance = RESIZE_ALIGNMENT_THRESHOLD + 1
  for (const guide of guides) {
    const nextDistance = Math.abs(value - guide)
    if (nextDistance <= RESIZE_ALIGNMENT_THRESHOLD && nextDistance < distance) {
      closest = guide
      distance = nextDistance
    }
  }
  return closest
}

function snapNodeOrigin(origin: number, size: number, guides: number[]): number {
  const anchors = [0, size / 2, size]
  let snappedOrigin = origin
  let smallestDelta = RESIZE_ALIGNMENT_THRESHOLD + 1
  for (const anchor of anchors) {
    const guide = nearestAlignment(origin + anchor, guides)
    if (guide == null) continue
    const delta = guide - (origin + anchor)
    if (Math.abs(delta) < smallestDelta) {
      snappedOrigin = origin + delta
      smallestDelta = Math.abs(delta)
    }
  }
  return snappedOrigin
}

/** Canvas right-click menu — one state drives node/edge/pane variants. */
type CanvasMenuState = { kind: 'node' | 'edge' | 'pane'; x: number; y: number; targetId?: string }

type WorkflowBuilderCanvasProps = {
  open: boolean
  workflowId: string | null
  initialView?: 'builder' | 'runs' | 'run'
  /**
   * Workspace the new workflow belongs to. An approval workflow drawn in the ORGANISATION
   * workspace governs every workspace under it; without this a saved workflow is global.
   */
  workspaceId?: string | null
  /** Used to label the seeded graph for an existing workflow. */
  workflowName?: string | null
  workspaceMembers?: Array<{ id: string; name: string; email: string }>
  onWorkflowCreated?: (workflow: WorkflowDto) => void
  onClose: () => void
}

/** The workflow row's trigger must mirror the Trigger node, or event dispatch skips it. */
// Workflow types offered in the builder. General is the backend default for workflows created before this list existed.
const WORKFLOW_TYPES = ['General', 'Delivery', 'Governance', 'Financial', 'Change', 'Risk'] as const
// Where a workflow fires. organization = every workspace under its owner's organization.
type WorkflowScopeMode = 'organization' | 'include' | 'exclude'

function triggerTypeOf(nodes: Node<WorkflowNodeData>[]): NonNullable<WorkflowCreateInput['trigger']> {
  const configured = nodes.find((node) => node.data.kind === 'trigger')?.data.config?.triggerType?.trim()
  return (configured as NonNullable<WorkflowCreateInput['trigger']>) || 'Manual'
}

const EDGE_STROKE = '#94a3b8'
const DEFAULT_EDGE_OPTIONS = {
  type: 'routed' as const,
  markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_STROKE },
  style: { stroke: EDGE_STROKE, strokeWidth: 2 },
}
const FIT_VIEW_OPTIONS = { padding: 0.2, minZoom: 0.6 }
const PRO_OPTIONS = { hideAttribution: true as const }

// One entry per kind — all map to the same renderer, keyed on data.kind.
const WORKFLOW_EDGE_TYPES: EdgeTypes = { routed: WorkflowRoutedEdge }

const WORKFLOW_NODE_TYPES: NodeTypes = {
  trigger: WorkflowBuilderNode,
  action: WorkflowBuilderNode,
  ifElse: WorkflowBuilderNode,
  approval: WorkflowBuilderNode,
  assignOwner: WorkflowBuilderNode,
  aiProcess: WorkflowBuilderNode,
  delay: WorkflowBuilderNode,
  loop: WorkflowBuilderNode,
  parallel: WorkflowBuilderNode,
  retry: WorkflowBuilderNode,
  end: WorkflowBuilderNode,
}

const WORKFLOW_PALETTE_GROUPS: Array<{ label: string; kinds: WorkflowNodeKind[] }> = [
  { label: 'Start & Flow Control', kinds: ['trigger', 'ifElse', 'loop', 'parallel', 'delay', 'retry', 'end'] },
  { label: 'Project Work', kinds: ['action', 'assignOwner'] },
  { label: 'Governance & Intelligence', kinds: ['approval', 'aiProcess'] },
]

const ACTION_TARGET_OPTIONS = [
  { value: 'current_task', label: 'Current task' },
  { value: 'current_project', label: 'Current project' },
  { value: 'current_milestone', label: 'Current milestone' },
  { value: 'project_backlog', label: 'Project backlog' },
  { value: 'selected_record', label: 'Selected record' },
  { value: 'external_endpoint', label: 'External endpoint' },
]

const LEGACY_ACTION_TARGETS: Record<string, string> = {
  'project.backlog': 'project_backlog',
  'project.milestone': 'current_milestone',
  'project.scope': 'current_project',
  'project.baseline': 'current_project',
  'project.dependency': 'selected_record',
  'project.dependency-remediation': 'selected_record',
  'project.assignments': 'current_project',
}

function normalizeActionTarget(value: string): string {
  return LEGACY_ACTION_TARGETS[value] ?? value
}

function workflowStorageKey(workflowId: string | null): string {
  return `tectona.workflow-builder.${workflowId ?? 'new'}`
}

function workflowNodeSize(kind: WorkflowNodeKind): { width: number; height: number } {
  return {
    width: kind === 'parallel' ? 300 : 224,
    height: kind === 'ifElse' || kind === 'approval' || kind === 'parallel' || kind === 'loop' ? 104 : 78,
  }
}

/**
 * React Flow owns a node's outer dimensions. Keep an explicit style on every
 * workflow node so the resizer changes the visible card, not only its handles.
 */
function withWorkflowNodeSize(node: Node<WorkflowNodeData>): Node<WorkflowNodeData> {
  const fallback = workflowNodeSize(node.data.kind)
  const width = node.style?.width ?? node.width ?? fallback.width
  const height = node.style?.height ?? node.height ?? fallback.height
  return { ...node, style: { ...node.style, width, height } }
}

function makeNode(kind: WorkflowNodeKind, position: { x: number; y: number }, id: string): Node<WorkflowNodeData> {
  const meta = WORKFLOW_KIND_META[kind]
  return {
    id,
    type: kind,
    position,
    style: workflowNodeSize(kind),
    data: { kind, label: meta.label, config: { ...meta.defaultConfig } },
  }
}

// ---------------------------------------------------------------------------
// Pre-built graph templates (Phase 2). Each catalog workflow (WORKFLOWS id)
// opens a realistic Tectona orchestration instead of an empty canvas.
// ---------------------------------------------------------------------------
function tNode(
  kind: WorkflowNodeKind,
  id: string,
  x: number,
  y: number,
  label: string,
  config: Record<string, string> = {},
): Node<WorkflowNodeData> {
  const meta = WORKFLOW_KIND_META[kind]
  const mergedConfig = { ...meta.defaultConfig, ...config }
  return {
    id,
    type: kind,
    position: { x, y },
    style: workflowNodeSize(kind),
    data: { kind, label, config: kind === 'action' ? normalizeActionConfig(mergedConfig) : mergedConfig },
  }
}

function tEdge(id: string, source: string, target: string, extra?: Partial<Edge>): Edge {
  return { id, source, target, sourceHandle: 'out', targetHandle: 'in', ...DEFAULT_EDGE_OPTIONS, ...extra }
}

// Columns used for top-down layouts (center + branch left/right).
const COL = { center: 300, left: 90, right: 510 }

const WORKFLOW_TEMPLATES: Record<string, WorkflowGraphRecord> = {
  // AI backlog approval — Delivery / Project Management
  'wf-001': {
    name: 'AI backlog approval',
    nodes: [
      tNode('trigger', 'trg', COL.center, 20, 'AI work item generated', { triggerType: 'Event', triggerDomain: 'AI Project Intelligence', triggerEntity: 'AI-generated Task', triggerEvent: 'Ready for Review' }),
      tNode('aiProcess', 'ai', COL.center, 170, 'Review generated work item', { prompt: 'Assess scope, acceptance criteria, dependencies, and project alignment for the AI-generated work item' }),
      tNode('ifElse', 'if', COL.center, 330, 'PM approval required?', { condition: "riskLevel == 'High' || estimate > 5" }),
      tNode('approval', 'appHigh', COL.left, 500, 'PMO reviewer approval', { approver: 'Project Manager' }),
      tNode('approval', 'appLow', COL.right, 500, 'Auto-approve low risk item', { approver: 'Delivery Lead' }),
      tNode('action', 'disburse', COL.center, 670, 'Create approved backlog item', { actionType: 'Update Record', target: 'project.backlog' }),
      tNode('action', 'notify', COL.center, 820, 'Notify project owner & PMO', { actionType: 'Notify', target: 'project-owner,pmo' }),
      tNode('end', 'end', COL.center, 970, 'Backlog item approved', { outcome: 'Completed' }),
    ],
    edges: [
      tEdge('e1', 'trg', 'ai'),
      tEdge('e2', 'ai', 'if'),
      tEdge('e3', 'if', 'appHigh', { sourceHandle: 'true', label: 'Review required' }),
      tEdge('e4', 'if', 'appLow', { sourceHandle: 'false', label: 'Low risk' }),
      tEdge('e5', 'appHigh', 'disburse'),
      tEdge('e6', 'appLow', 'disburse'),
      tEdge('e7', 'disburse', 'notify'),
      tEdge('e8', 'notify', 'end'),
    ],
  },

  // Milestone delay risk escalation — Risk / Project Management
  'wf-002': {
    name: 'Milestone delay risk escalation',
    nodes: [
      tNode('trigger', 'trg', COL.center, 20, 'Daily milestone risk scan', { triggerType: 'Schedule' }),
      tNode('action', 'collect', COL.center, 170, 'Collect schedule and blocker signals', { actionType: 'Custom Script', target: 'project.delay-signals' }),
      tNode('ifElse', 'if', COL.center, 330, 'Delay probability >= 70%?', { condition: 'delayProbability >= 70' }),
      tNode('action', 'reassign', COL.left, 500, 'Create recovery plan & escalate', { actionType: 'Update Record', target: 'project.milestone' }),
      tNode('action', 'notify', COL.left, 650, 'Notify PM & delivery lead', { actionType: 'Notify', target: 'project-owner,delivery-lead' }),
      tNode('end', 'endOk', COL.left, 800, 'Escalated', { outcome: 'Completed' }),
      tNode('end', 'endNone', COL.right, 500, 'No action needed', { outcome: 'Completed' }),
    ],
    edges: [
      tEdge('e1', 'trg', 'collect'),
      tEdge('e2', 'collect', 'if'),
      tEdge('e3', 'if', 'reassign', { sourceHandle: 'true', label: 'Breach' }),
      tEdge('e4', 'if', 'endNone', { sourceHandle: 'false', label: 'On track' }),
      tEdge('e5', 'reassign', 'notify'),
      tEdge('e6', 'notify', 'endOk'),
    ],
  },

  // Scope change gatekeeper — Governance / Project Management
  'wf-003': {
    name: 'Scope change gatekeeper',
    nodes: [
      tNode('trigger', 'trg', COL.center, 20, 'Scope change submitted', { triggerType: 'Manual' }),
      tNode('action', 'validate', COL.center, 170, 'Assess scope, cost & schedule impact', { actionType: 'Custom Script', target: 'project.scope-impact' }),
      tNode('ifElse', 'if', COL.center, 330, 'Material impact detected?', { condition: "impactLevel == 'High'" }),
      tNode('approval', 'board', COL.left, 500, 'Project owner approval', { approver: 'Project Owner' }),
      tNode('action', 'auto', COL.right, 500, 'Auto-approve low impact', { actionType: 'Update Record', target: 'project.scope' }),
      tNode('action', 'record', COL.center, 670, 'Update scope baseline & roadmap', { actionType: 'Update Record', target: 'project.baseline' }),
      tNode('action', 'notify', COL.center, 820, 'Notify project team & PMO', { actionType: 'Notify', target: 'project-team,pmo' }),
      tNode('end', 'end', COL.center, 970, 'Scope change processed', { outcome: 'Completed' }),
    ],
    edges: [
      tEdge('e1', 'trg', 'validate'),
      tEdge('e2', 'validate', 'if'),
      tEdge('e3', 'if', 'board', { sourceHandle: 'true', label: 'Material impact' }),
      tEdge('e4', 'if', 'auto', { sourceHandle: 'false', label: 'Low impact' }),
      tEdge('e5', 'board', 'record'),
      tEdge('e6', 'auto', 'record'),
      tEdge('e7', 'record', 'notify'),
      tEdge('e8', 'notify', 'end'),
    ],
  },

  // Dependency closure escalation — Risk / Project Management
  'wf-004': {
    name: 'Dependency closure escalation',
    nodes: [
      tNode('trigger', 'trg', COL.center, 20, 'Dependency status updated', { triggerType: 'Webhook' }),
      tNode('aiProcess', 'ai', COL.center, 170, 'AI classify dependency risk', { prompt: 'Assess dependency age, owner response, schedule float, and downstream milestone exposure' }),
      tNode('ifElse', 'if', COL.center, 330, 'Critical path at risk?', { condition: "severity == 'Critical'" }),
      tNode('approval', 'owner', COL.left, 500, 'Delivery owner approval', { approver: 'Delivery Lead' }),
      tNode('action', 'remediate', COL.left, 650, 'Create contingency task', { actionType: 'Update Record', target: 'project.dependency-remediation' }),
      tNode('action', 'notify', COL.left, 800, 'Notify PMO & dependency owner', { actionType: 'Notify', target: 'pmo,dependency-owner' }),
      tNode('end', 'endCrit', COL.left, 950, 'Dependency escalated', { outcome: 'Completed' }),
      tNode('action', 'monitor', COL.right, 500, 'Log & monitor dependency', { actionType: 'Update Record', target: 'project.dependency' }),
      tNode('end', 'endLow', COL.right, 650, 'Monitoring', { outcome: 'Completed' }),
    ],
    edges: [
      tEdge('e1', 'trg', 'ai'),
      tEdge('e2', 'ai', 'if'),
      tEdge('e3', 'if', 'owner', { sourceHandle: 'true', label: 'Critical' }),
      tEdge('e4', 'if', 'monitor', { sourceHandle: 'false', label: 'Non-critical' }),
      tEdge('e5', 'owner', 'remediate'),
      tEdge('e6', 'remediate', 'notify'),
      tEdge('e7', 'notify', 'endCrit'),
      tEdge('e8', 'monitor', 'endLow'),
    ],
  },

  // Resource overload reassignment — Change / Project Management
  'wf-005': {
    name: 'Resource overload reassignment',
    nodes: [
      tNode('trigger', 'trg', COL.center, 20, 'Owner allocation threshold breached', { triggerType: 'Event', triggerDomain: 'Resource Management', triggerEntity: 'Capacity', triggerEvent: 'Threshold Breached' }),
      tNode('action', 'validate', COL.center, 170, 'Assess workload and critical tasks', { actionType: 'Custom Script', target: 'project.capacity' }),
      tNode('approval', 'proc', COL.center, 320, 'PMO capacity review', { approver: 'PMO Analyst' }),
      tNode('action', 'provision', COL.center, 470, 'Reassign work & update capacity', { actionType: 'Update Record', target: 'project.assignments' }),
      tNode('action', 'notify', COL.center, 620, 'Notify project owner & team lead', { actionType: 'Notify', target: 'project-owner,team-lead' }),
      tNode('end', 'end', COL.center, 770, 'Assignment updated', { outcome: 'Completed' }),
    ],
    edges: [
      tEdge('e1', 'trg', 'validate'),
      tEdge('e2', 'validate', 'proc'),
      tEdge('e3', 'proc', 'provision'),
      tEdge('e4', 'provision', 'notify'),
      tEdge('e5', 'notify', 'end'),
    ],
  },
}

/** Deep clone a template so localStorage edits never mutate the shared constant. */
function cloneGraph(record: WorkflowGraphRecord): WorkflowGraphRecord {
  return {
    name: record.name,
    nodes: record.nodes.map((n) => ({ ...n, position: { ...n.position }, style: { ...n.style }, data: { ...n.data, config: { ...n.data.config } } })),
    edges: record.edges.map((e) => ({ ...e })),
  }
}

function normalizeTriggerNode(node: Node<WorkflowNodeData>): Node<WorkflowNodeData> {
  if (node.data.kind !== 'trigger') return node
  const config = node.data.config
  if (config.triggerDomain && config.triggerEntity && config.triggerEvent) return node
  const legacyEvent = config.event ?? ''
  const domain = legacyEvent.toLowerCase().includes('ai') ? 'AI Project Intelligence' : 'Project Management'
  const entity = legacyEvent.toLowerCase().includes('ai') || legacyEvent.toLowerCase().includes('generated')
    ? 'AI-generated Task'
    : legacyEvent.toLowerCase().includes('milestone')
      ? 'Milestone'
      : legacyEvent.toLowerCase().includes('dependency')
        ? 'Dependency'
        : 'Task'
  const event = legacyEvent.toLowerCase().includes('milestone')
    ? 'Overdue'
    : legacyEvent.toLowerCase().includes('dependency')
      ? 'Changed'
      : legacyEvent.toLowerCase().includes('generated')
        ? 'Ready for Review'
        : 'Updated'
  return { ...node, data: { ...node.data, config: { ...config, triggerDomain: domain, triggerEntity: entity, triggerEvent: event } } }
}

function withoutApprovalConfig(config: Record<string, string>): Record<string, string> {
  const next = { ...config }
  for (const key of [
    'approverBy',
    'approverValues',
    'approverRole',
    'approverTeam',
    'approver',
    'jobTitles',
    'job_titles',
    'emailRecipients',
    'emailRecipientBy',
    'emailBodySource',
    'emailBodySections',
    'emailBodyText',
    'emailIncludeCover',
    'emailDocumentKind',
    'quorum',
    'allowSelfApproval',
    'subjectLabel',
  ]) delete next[key]
  return next
}

function normalizeActionConfig(config: Record<string, string>): Record<string, string> {
  const actionType = config.actionType ?? ''
  const target = config.target ?? ''
  const base = withoutApprovalConfig(config)
  if (actionType === 'Notify') return { ...base, actionDomain: 'Notifications & Alerts', actionEntity: 'Notification', actionOperation: 'Send' }
  if (actionType === 'HTTP Request') return { ...base, actionDomain: 'Integration & API', actionEntity: 'API', actionOperation: 'Send Request' }
  if (actionType === 'Create Task') return { ...base, actionDomain: 'Project Management', actionEntity: 'Task', actionOperation: 'Create' }
  if (actionType === 'Update Record' && target.includes('milestone')) return { ...base, actionDomain: 'Project Management', actionEntity: 'Milestone', actionOperation: 'Update' }
  if (actionType === 'Update Record' && target.includes('dependency')) return { ...base, actionDomain: 'Project Management', actionEntity: 'Dependency', actionOperation: 'Update' }
  if (actionType === 'Update Record' && target.includes('capacity')) return { ...base, actionDomain: 'Resource Management', actionEntity: 'Capacity', actionOperation: 'Rebalance' }
  if (actionType === 'Update Record') return { ...base, actionDomain: 'Project Management', actionEntity: 'Task', actionOperation: 'Update' }
  if (actionType === 'Custom Script') return { ...base, actionDomain: 'Integration & API', actionEntity: 'External System', actionOperation: 'Start Sync' }
  return { ...base, actionDomain: base.actionDomain || 'Project Management', actionEntity: base.actionEntity || 'Task', actionOperation: base.actionOperation || 'Update' }
}

function normalizeActionNode(node: Node<WorkflowNodeData>): Node<WorkflowNodeData> {
  if (node.data.kind !== 'action') return node
  return { ...node, data: { ...node.data, config: normalizeActionConfig(node.data.config) } }
}

function seedWorkflowGraph(workflowId: string | null, workflowName?: string | null): WorkflowGraphRecord {
  if (!workflowId) {
    return {
      name: 'Untitled Workflow',
      nodes: [makeNode('trigger', { x: 260, y: 60 }, 'trigger-1')],
      edges: [],
    }
  }

  const template = WORKFLOW_TEMPLATES[workflowId]
  if (template) return { ...cloneGraph(template), version: WORKFLOW_TEMPLATE_VERSION }

  // Fallback for any workflow without a dedicated template.
  const name = workflowName?.trim() || 'Workflow'
  const trigger = makeNode('trigger', { x: 260, y: 40 }, 'trigger-1')
  const action = makeNode('action', { x: 260, y: 220 }, 'action-1')
  action.data = { ...action.data, label: name }
  const end = makeNode('end', { x: 260, y: 400 }, 'end-1')
  return {
    name,
    nodes: [trigger, action, end],
    edges: [
      { id: 'e-trigger-action', source: 'trigger-1', target: 'action-1', ...DEFAULT_EDGE_OPTIONS },
      { id: 'e-action-end', source: 'action-1', target: 'end-1', ...DEFAULT_EDGE_OPTIONS },
    ],
  }
}

function loadOrSeedWorkflowGraph(workflowId: string | null, workflowName?: string | null): WorkflowGraphRecord {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(workflowStorageKey(workflowId))
      if (raw) {
        const parsed = JSON.parse(raw) as WorkflowGraphRecord
        // Ignore a stale autosave for a templated workflow saved before the current template version.
        const hasTemplate = workflowId != null && workflowId in WORKFLOW_TEMPLATES
        const stale = hasTemplate && parsed.version !== WORKFLOW_TEMPLATE_VERSION
        if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges) && !stale) {
          return {
            name: parsed.name || workflowName || 'Untitled Workflow',
            nodes: parsed.nodes.map((node) => withWorkflowNodeSize(normalizeActionNode(normalizeTriggerNode(node)))),
            edges: parsed.edges,
            ideaSections: readIdeaSectionVisibility(parsed.ideaSections),
            savedAt: parsed.savedAt,
            version: parsed.version,
          }
        }
      }
    } catch {
      // Corrupt/missing payload — fall back to a fresh seed.
    }
  }
  return seedWorkflowGraph(workflowId, workflowName)
}

// ---------------------------------------------------------------------------
// Validation + dry-run (Phase 3). Pure functions so they are easy to test/reuse.
// ---------------------------------------------------------------------------
type WorkflowIssue = { level: 'error' | 'warning'; nodeId?: string; message: string }

function validateWorkflowGraph(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
  /** Role codes that have at least one holder in scope. Undefined while still loading,
      which must not be reported as "nobody holds it". */
  rolesWithHolders?: Set<string>,
): WorkflowIssue[] {
  const issues: WorkflowIssue[] = []
  const triggers = nodes.filter((n) => n.data.kind === 'trigger')
  if (triggers.length === 0) issues.push({ level: 'error', message: 'Workflow has no Trigger node — add an entry point.' })
  if (triggers.length > 1) issues.push({ level: 'warning', message: `Multiple triggers (${triggers.length}); only one entry point is recommended.` })
  if (!nodes.some((n) => n.data.kind === 'end')) issues.push({ level: 'warning', message: 'Workflow has no End node.' })

  const incoming = new Map<string, number>()
  const outgoing = new Map<string, number>()
  const branchHandles = new Map<string, Set<string>>()
  edges.forEach((e) => {
    outgoing.set(e.source, (outgoing.get(e.source) ?? 0) + 1)
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1)
    if (e.sourceHandle) {
      const set = branchHandles.get(e.source) ?? new Set<string>()
      set.add(e.sourceHandle)
      branchHandles.set(e.source, set)
    }
  })

  nodes.forEach((n) => {
    const { kind, label, config } = n.data
    if (kind !== 'trigger' && !incoming.get(n.id)) issues.push({ level: 'warning', nodeId: n.id, message: `"${label}" has no incoming connection.` })
    if (kind !== 'end' && !outgoing.get(n.id)) issues.push({ level: 'warning', nodeId: n.id, message: `"${label}" has no outgoing connection.` })
    if (kind === 'trigger' && config.triggerType === 'Event' && (!config.triggerDomain?.trim() || !config.triggerEntity?.trim() || (!config.triggerEvent?.trim() && !config.event?.trim()))) issues.push({ level: 'warning', nodeId: n.id, message: `"${label}" needs a module, entity, and event.` })
    if (kind === 'trigger' && config.triggerType === 'Schedule' && (!config.schedule?.trim() || !config.timezone?.trim())) issues.push({ level: 'warning', nodeId: n.id, message: `"${label}" needs a schedule and timezone.` })
    if (kind === 'trigger' && config.triggerType === 'Webhook' && !config.webhookEvent?.trim()) issues.push({ level: 'warning', nodeId: n.id, message: `"${label}" has no webhook source selected.` })
    if (kind === 'ifElse') {
      const handles = branchHandles.get(n.id) ?? new Set<string>()
      if (!handles.has('true')) issues.push({ level: 'warning', nodeId: n.id, message: `"${label}" is missing a TRUE branch.` })
      if (!handles.has('false')) issues.push({ level: 'warning', nodeId: n.id, message: `"${label}" is missing a FALSE branch.` })
      const hasStructuredCondition = config.field?.trim() && config.operator?.trim() && config.value?.trim()
      if (!hasStructuredCondition && !config.condition?.trim()) issues.push({ level: 'error', nodeId: n.id, message: `"${label}" has an empty condition.` })
    }
    if (kind === 'approval') {
      const badges = config.approverValues?.trim()
      const role = config.approverRole?.trim()
      const team = config.approverTeam?.trim()
      const named = config.approver?.trim()
      if (!badges && !role && !team && !named) {
        issues.push({ level: 'error', nodeId: n.id, message: `"${label}" has no approver: add at least one badge.` })
      } else if (!badges && role && !team && rolesWithHolders && !rolesWithHolders.has(role)) {
        // The engine fails closed on an unheld role, so this must be visible while
        // designing rather than discovered when a real document is already in review.
        issues.push({ level: 'error', nodeId: n.id, message: `No one holds the role "${role}" — "${label}" would fail every run.` })
      }
      const handles = branchHandles.get(n.id) ?? new Set<string>()
      if (!handles.has('false')) issues.push({ level: 'warning', nodeId: n.id, message: `"${label}" has no REJECTED branch; a rejection fails the run.` })
    }
    if (kind === 'parallel') {
      const handles = branchHandles.get(n.id) ?? new Set<string>()
      if (!handles.has('branchA')) issues.push({ level: 'warning', nodeId: n.id, message: `"${label}" is missing Branch A.` })
      if (!handles.has('branchB')) issues.push({ level: 'warning', nodeId: n.id, message: `"${label}" is missing Branch B.` })
    }
    if (kind === 'loop') {
      const handles = branchHandles.get(n.id) ?? new Set<string>()
      if (!handles.has('body')) issues.push({ level: 'warning', nodeId: n.id, message: `"${label}" is missing a loop body connection.` })
      if (!handles.has('done')) issues.push({ level: 'warning', nodeId: n.id, message: `"${label}" is missing a done connection.` })
    }
    if (kind === 'assignOwner' && !config.ownerId?.trim()) issues.push({ level: 'warning', nodeId: n.id, message: `"${label}" has no workspace member assigned.` })
    if (kind === 'aiProcess' && !config.prompt?.trim()) issues.push({ level: 'warning', nodeId: n.id, message: `"${label}" has an empty AI prompt.` })
    const catalogAction = Boolean(config.actionDomain?.trim() && config.actionEntity?.trim() && (config.actionOperation?.trim() || config.actionType?.trim()))
    if (kind === 'action' && !catalogAction && !config.target?.trim()) issues.push({ level: 'warning', nodeId: n.id, message: `"${label}" has no target set.` })
    if (kind === 'action' && (!config.actionDomain?.trim() || !config.actionEntity?.trim() || (!config.actionOperation?.trim() && !config.actionType?.trim()))) issues.push({ level: 'warning', nodeId: n.id, message: `"${label}" needs a module, entity, and operation.` })
    if (kind === 'action') {
      const propertyControls = actionPropertyControls(config)
      const requiredControl = propertyControls.find((control) => control.required && !config[control.key]?.trim())
      if (requiredControl) issues.push({ level: 'warning', nodeId: n.id, message: `"${label}" needs a ${requiredControl.label.toLowerCase()}.` })
      if (propertyControls.length === 0 && actionParameterControl(config) && !config.parameter?.trim()) issues.push({ level: 'warning', nodeId: n.id, message: `"${label}" needs a ${actionParameterControl(config)?.label.toLowerCase()}.` })
    }
    if (kind === 'retry' && (!config.maxAttempts?.trim() || Number(config.maxAttempts) < 1)) issues.push({ level: 'error', nodeId: n.id, message: `"${label}" needs a valid retry attempt count.` })
  })
  return issues
}

function buildRuntimeDefinition(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
  ideaSections: IdeaSectionVisibilityMap = {},
): WorkflowGraph {
  const sections = readIdeaSectionVisibility(ideaSections)
  return {
    schema_version: 2,
    ...(Object.keys(sections).length > 0 ? { ideaSections: sections } : {}),
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type ?? node.data.kind,
      position: node.position,
      // Keep visual dimensions with the executable definition. The runtime ignores
      // this presentation metadata; the editor restores it after a reload.
      style: {
        width: Number(node.style?.width ?? node.width ?? workflowNodeSize(node.data.kind).width),
        height: Number(node.style?.height ?? node.height ?? workflowNodeSize(node.data.kind).height),
      },
      data: {
        kind: node.data.kind,
        label: node.data.label,
        config: { ...node.data.config },
        ...(node.data.disabled ? { disabled: true } : {}),
      },
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? 'out',
      targetHandle: edge.targetHandle ?? 'in',
      ...(edge.label ? { label: edge.label } : {}),
      ...(Array.isArray((edge.data as { waypoints?: unknown } | undefined)?.waypoints)
        || typeof (edge.data as { sourcePort?: unknown } | undefined)?.sourcePort === 'string'
        || typeof (edge.data as { targetPort?: unknown } | undefined)?.targetPort === 'string'
        ? {
            data: {
              ...(Array.isArray((edge.data as { waypoints?: unknown } | undefined)?.waypoints)
                ? { waypoints: (edge.data as { waypoints: WorkflowWaypoint[] }).waypoints }
                : {}),
              ...(typeof (edge.data as { sourcePort?: unknown } | undefined)?.sourcePort === 'string'
                ? { sourcePort: (edge.data as { sourcePort: string }).sourcePort }
                : {}),
              ...(typeof (edge.data as { targetPort?: unknown } | undefined)?.targetPort === 'string'
                ? { targetPort: (edge.data as { targetPort: string }).targetPort }
                : {}),
            },
          }
        : {}),
    })),
  }
}

type WorkflowRevisionMeta = {
  category: string
  owner: string
  scopeMode: WorkflowScopeMode
  scopeWorkspaceIds: string[]
}

function workflowRevision(
  name: string,
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
  ideaSections: IdeaSectionVisibilityMap = {},
  meta: WorkflowRevisionMeta = { category: 'General', owner: '', scopeMode: 'organization', scopeWorkspaceIds: [] },
): string {
  return JSON.stringify({
    name,
    category: meta.category,
    owner: meta.owner,
    scopeMode: meta.scopeMode,
    scopeWorkspaceIds: meta.scopeMode === 'organization' ? [] : [...meta.scopeWorkspaceIds].sort(),
    trigger: triggerTypeOf(nodes),
    definition: buildRuntimeDefinition(nodes, edges, ideaSections),
  })
}


// Simple layered top-down auto-layout (no external dependency). Assigns each
// node a depth = longest path from a root, then centers each level horizontally.
function autoLayoutWorkflow(nodes: Node<WorkflowNodeData>[], edges: Edge[]): Node<WorkflowNodeData>[] {
  if (nodes.length === 0) return nodes
  const VGAP = 160
  const HGAP = 280
  const outgoing = new Map<string, string[]>()
  const hasIncoming = new Set<string>()
  edges.forEach((e) => {
    outgoing.set(e.source, [...(outgoing.get(e.source) ?? []), e.target])
    hasIncoming.add(e.target)
  })
  const roots = nodes.filter((n) => !hasIncoming.has(n.id)).map((n) => n.id)
  const starts = roots.length ? roots : [nodes[0].id]
  const depth = new Map<string, number>()
  const queue: Array<[string, number]> = starts.map((id) => [id, 0])
  starts.forEach((id) => depth.set(id, 0))
  while (queue.length) {
    const [id, d] = queue.shift() as [string, number]
    if (d > nodes.length) continue // cycle guard
    for (const target of outgoing.get(id) ?? []) {
      if ((depth.get(target) ?? -1) < d + 1) {
        depth.set(target, d + 1)
        queue.push([target, d + 1])
      }
    }
  }
  nodes.forEach((n) => {
    if (!depth.has(n.id)) depth.set(n.id, 0)
  })
  const levels = new Map<number, string[]>()
  nodes.forEach((n) => {
    const d = depth.get(n.id) as number
    levels.set(d, [...(levels.get(d) ?? []), n.id])
  })
  const widest = Math.max(1, ...[...levels.values()].map((ids) => ids.length))
  const pos = new Map<string, { x: number; y: number }>()
  ;[...levels.keys()]
    .sort((a, b) => a - b)
    .forEach((d) => {
      const ids = levels.get(d) as string[]
      const offset = ((widest - ids.length) * HGAP) / 2
      ids.forEach((id, i) => pos.set(id, { x: 60 + offset + i * HGAP, y: 40 + d * VGAP }))
    })
  return nodes.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position }))
}

const FIELD_LABEL_CLASS = 'text-[10px] font-semibold uppercase tracking-wide text-slate-500'

function actionTypeIcon(actionType: string): LucideIcon | null {
  if (actionType === 'Create Task') return Plus
  if (actionType === 'Update Task') return Pencil
  if (actionType === 'Assign / Reassign Owner') return UserRound
  if (actionType === 'Update Milestone') return Flag
  if (actionType === 'Create Dependency') return Link2
  if (actionType === 'Create Risk / Issue') return TriangleAlert
  if (actionType === 'Add Comment') return MessageSquare
  if (actionType === 'Send Notification') return Bell
  if (actionType === 'HTTP Request') return Globe2
  if (actionType === 'Custom Script') return Code2
  return null
}

function triggerOptionIcon(fieldKey: string, option: string): LucideIcon | null {
  if (fieldKey === 'triggerType') {
    if (option === 'Manual') return MousePointerClick
    if (option === 'Schedule') return CalendarClock
    if (option === 'Event') return Zap
    if (option === 'Webhook') return Webhook
  }
  if (fieldKey === 'triggerDomain') return Globe2
  if (fieldKey === 'triggerEntity') return Tag
  if (fieldKey === 'event' || fieldKey === 'triggerEvent') {
    if (option === 'Task Created') return Plus
    if (option === 'Task Updated') return Pencil
    if (option === 'Milestone Due / Overdue') return Flag
    if (option === 'Dependency Changed') return Link2
    if (option === 'Risk or Issue Raised') return AlertTriangle
    if (option === 'Approval Requested') return ShieldCheck
    if (option === 'Resource Threshold Breached') return Users
  }
  if (fieldKey === 'schedule') return option === 'Every hour' ? Clock3 : CalendarDays
  if (fieldKey === 'timezone') return Globe2
  if (fieldKey === 'webhookEvent') return option === 'External integration event' ? PlugZap : Webhook
  return null
}

type ActionParameterControl = {
  label: string
  type: 'select' | 'member' | 'date' | 'text' | 'textarea'
  options?: readonly string[]
  placeholder?: string
}

type ActionPropertyControl = ActionParameterControl & {
  key: string
  required?: boolean
}

function actionPropertyControls(config: Record<string, string>): ActionPropertyControl[] {
  const entity = config.actionEntity ?? ''
  const operation = config.actionOperation ?? ''
  const key = `${entity}:${operation}`
  if (entity === 'Document' && (operation === 'Set Status' || operation === 'Publish Version' || operation === 'Archive')) {
    return [
      { key: 'status_code', label: 'Status', type: 'select', options: WORKFLOW_DOCUMENT_STATUSES, required: operation === 'Set Status' },
      { key: 'document_id', label: 'Document ID', type: 'text', placeholder: 'Leave empty to use the document from the trigger' },
      { key: 'reason', label: 'Reason', type: 'text', placeholder: 'Shown in the document audit trail' },
    ]
  }
  if (key === 'Task:Create' || key === 'Work Item:Create') {
    return [
      { key: 'project_id', label: 'Project', type: 'text', placeholder: 'e.g. PRJ-1001', required: true },
      { key: 'title', label: 'Task Title', type: 'text', placeholder: 'e.g. Validate SLA documents', required: true },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Describe the work item' },
      { key: 'priority', label: 'Priority', type: 'select', options: WORKFLOW_TASK_PRIORITIES },
      { key: 'due_date', label: 'Due Date', type: 'date' },
      { key: 'assignee_id', label: 'Owner', type: 'member' },
    ]
  }
  if (key === 'Task:Update' || key === 'Work Item:Update') {
    return [
      { key: 'work_item_id', label: 'Work Item ID', type: 'text', placeholder: 'Leave empty to use the current task' },
      { key: 'title', label: 'Task Title', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'priority', label: 'Priority', type: 'select', options: WORKFLOW_TASK_PRIORITIES },
      { key: 'due_date', label: 'Due Date', type: 'date' },
      { key: 'version', label: 'Record Version', type: 'text', placeholder: 'e.g. 1' },
    ]
  }
  if (key === 'Task:Assign Owner' || key === 'Work Item:Assign Owner') {
    return [
      { key: 'work_item_id', label: 'Work Item ID', type: 'text', placeholder: 'Leave empty to use the current task' },
      { key: 'assignee_id', label: 'Workspace Member', type: 'member', required: true },
      { key: 'version', label: 'Record Version', type: 'text', placeholder: 'e.g. 1' },
    ]
  }
  if (key === 'Task:Change Status' || key === 'Work Item:Change Status') {
    return [
      { key: 'work_item_id', label: 'Work Item ID', type: 'text', placeholder: 'Leave empty to use the current task' },
      { key: 'status', label: 'New Status', type: 'select', options: WORKFLOW_TASK_STATUSES, required: true },
      { key: 'version', label: 'Record Version', type: 'text', placeholder: 'e.g. 1' },
    ]
  }
  if (key === 'Task:Change Priority') {
    return [
      { key: 'work_item_id', label: 'Work Item ID', type: 'text', placeholder: 'Leave empty to use the current task' },
      { key: 'priority', label: 'New Priority', type: 'select', options: WORKFLOW_TASK_PRIORITIES, required: true },
      { key: 'version', label: 'Record Version', type: 'text', placeholder: 'e.g. 1' },
    ]
  }
  if (key === 'Dependency:Create' || key === 'Dependency:Update' || key === 'Dependency:Resolve') {
    return [
      { key: 'work_item_id', label: 'Work Item ID', type: 'text', placeholder: 'Leave empty to use the current task' },
      { key: 'depends_on_work_item_id', label: 'Dependency Target ID', type: 'text', placeholder: 'e.g. task UUID', required: true },
      { key: 'dependency_type', label: 'Dependency Type', type: 'select', options: ['blocks', 'relates_to', 'duplicates'] },
      { key: 'version', label: 'Record Version', type: 'text', placeholder: 'e.g. 1' },
    ]
  }
  if (key === 'Task:Add Comment' || key === 'Work Item:Add Comment') {
    return [
      { key: 'work_item_id', label: 'Work Item ID', type: 'text', placeholder: 'Leave empty to use the current task' },
      { key: 'comment', label: 'Comment', type: 'textarea', placeholder: 'Write the project update or decision', required: true },
    ]
  }
  if (key === 'Risk / Issue:Create' || key === 'Risk / Issue:Update') {
    return [
      ...(key === 'Risk / Issue:Create' ? [{ key: 'project_id', label: 'Project', type: 'text' as const, placeholder: 'e.g. PRJ-1001', required: true }] : []),
      ...(key === 'Risk / Issue:Update' ? [{ key: 'risk_id', label: 'Risk / Issue ID', type: 'text' as const, placeholder: 'Work item ID', required: true }] : []),
      { key: 'title', label: 'Risk / Issue Title', type: 'text', placeholder: 'e.g. UAT delay risk', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'risk_level', label: 'Risk Level', type: 'select', options: WORKFLOW_RISK_LEVELS, required: true },
    ]
  }
  if (key === 'Milestone:Create') {
    return [
      { key: 'project_id', label: 'Project', type: 'text', placeholder: 'e.g. PRJ-1001', required: true },
      { key: 'name', label: 'Milestone Name', type: 'text', placeholder: 'e.g. UAT ready', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'target_end_date', label: 'Target End Date', type: 'date' },
    ]
  }
  if (key === 'Milestone:Update' || key === 'Milestone:Set Due Date' || key === 'Milestone:Complete') {
    return [
      { key: 'milestone_id', label: 'Milestone ID', type: 'text', placeholder: 'Leave empty to use the current milestone' },
      ...(key === 'Milestone:Set Due Date' ? [{ key: 'target_end_date', label: 'Target End Date', type: 'date' as const, required: true }] : []),
      ...(key === 'Milestone:Update' ? [{ key: 'name', label: 'Milestone Name', type: 'text' as const }, { key: 'description', label: 'Description', type: 'textarea' as const }] : []),
      { key: 'version', label: 'Record Version', type: 'text', placeholder: 'e.g. 1' },
    ]
  }
  if (key === 'Notification:Send') {
    return [
      { key: 'user_id', label: 'Recipient', type: 'member' },
      { key: 'title', label: 'Notification Title', type: 'text', placeholder: 'e.g. Task needs review' },
      { key: 'body', label: 'Message', type: 'textarea', placeholder: 'Write the notification message' },
      { key: 'parameter', label: 'Channel', type: 'select', options: WORKFLOW_NOTIFICATION_CHANNELS },
    ]
  }
  if (key === 'API:Send Request') {
    return [
      { key: 'endpoint', label: 'Endpoint', type: 'text', placeholder: 'e.g. http://localhost:8423/health', required: true },
      { key: 'method', label: 'Method', type: 'select', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
      { key: 'body', label: 'JSON Body', type: 'textarea', placeholder: '{"event":"workflow.completed"}' },
    ]
  }
  return []
}

function actionParameterControl(config: Record<string, string>): ActionParameterControl | null {
  const key = `${config.actionEntity ?? ''}:${config.actionOperation ?? ''}`
  if (key === 'Task:Change Status' || key === 'Work Item:Change Status') return { label: 'New Status', type: 'select', options: WORKFLOW_TASK_STATUSES }
  if (key === 'Task:Change Priority') return { label: 'New Priority', type: 'select', options: WORKFLOW_TASK_PRIORITIES }
  if (key === 'Task:Assign Owner' || key === 'Work Item:Assign Owner' || key === 'Risk / Issue:Assign Owner' || key === 'Resource:Assign') return { label: 'Workspace Member', type: 'member' }
  if (key === 'Milestone:Set Due Date') return { label: 'Due Date', type: 'date' }
  if (key === 'Risk / Issue:Create' || key === 'Risk / Issue:Update') return { label: 'Risk Level', type: 'select', options: WORKFLOW_RISK_LEVELS }
  if (key === 'Notification:Send') return { label: 'Notification Channel', type: 'select', options: WORKFLOW_NOTIFICATION_CHANNELS }
  if (key === 'API:Send Request') return { label: 'Endpoint', type: 'text', placeholder: 'e.g. https://api.example.com/work-items' }
  return null
}

function runStatusChipClass(status: WorkflowRunStatus): string {
  if (status === 'completed') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'failed' || status === 'cancelled') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (status === 'waiting_approval') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (status === 'waiting_delay') return 'border-violet-200 bg-violet-50 text-violet-700'
  return 'border-sky-200 bg-sky-50 text-sky-700'
}

function stepStatusDotClass(status: WorkflowRunStepStatus): string {
  if (status === 'succeeded') return 'bg-emerald-500'
  if (status === 'failed') return 'bg-rose-500'
  if (status === 'waiting') return 'bg-amber-500'
  if (status === 'running') return 'bg-sky-500'
  return 'bg-slate-300'
}

function showsReviewEmailSettings(node: { data: { kind: string; config: Record<string, string> } }): boolean {
  if (node.data.kind !== 'approval') return false
  const config = node.data.config as Record<string, unknown>
  const titles = config.jobTitles ?? config.job_titles ?? config.emailRecipients
  const hasTitles = Array.isArray(titles) ? titles.length > 0 : Boolean(String(titles ?? '').trim())
  return hasTitles || Boolean(config.emailBodySource) || Boolean(config.emailRecipientBy)
}

function showsIdeaSectionSettings(node: { data: { kind: string; config: Record<string, string> } }): boolean {
  const config = node.data.config
  return node.data.kind === 'trigger'
    && config.triggerType === 'Event'
    && config.triggerDomain === 'AI Idea & Prioritization'
    && config.triggerEntity === 'Idea'
}

function IdeaSectionVisibilityEditor({
  value,
  onChange,
}: {
  value: IdeaSectionVisibilityMap
  onChange: (key: IdeaPanelKey, visibility: IdeaSectionVisibility) => void
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Idea sections</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        Show or hide each section on Idea Detail. A published Active workflow applies this to its workspace.
        Diagrams stays hidden here: Architecture still sees C4, Sequence, ERD, Class, and ArchiMate, and Business Relationship or Business Partner still sees BPMN.
      </p>
      <ul className="mt-3 space-y-1">
        {IDEA_PANEL_CATALOG.map((entry) => {
          const shown = value[entry.key] !== 'hide'
          const Icon = entry.icon
          return (
            <li key={entry.key} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2 py-1.5">
              <span className={cn('flex min-w-0 items-center gap-2 text-sm', shown ? 'text-slate-800' : 'text-slate-400')}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{entry.label}</span>
              </span>
              <button
                type="button"
                className={cn(
                  'shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold',
                  shown ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                )}
                onClick={() => onChange(entry.key, shown ? 'hide' : 'show')}
              >
                {shown ? 'Show' : 'Hide'}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function stepStatusTextClass(status: WorkflowRunStepStatus): string {
  if (status === 'succeeded') return 'text-emerald-600'
  if (status === 'failed') return 'text-rose-600'
  if (status === 'waiting') return 'text-amber-600'
  return 'text-slate-400'
}

function WorkflowBuilderCanvasInner({
  workflowId,
  initialView = 'builder',
  workspaceId,
  workflowName,
  workspaceMembers = [],
  onWorkflowCreated,
  onClose,
}: Omit<WorkflowBuilderCanvasProps, 'open'>) {
  const { addToast } = useToast()
  // The builder renders in a portal outside the page's tree, so read the active workspace
  // here rather than trusting a prop chain: a workflow must be saved into the workspace it
  // was drawn in (an organisation workflow governs every workspace under it).
  const tenant = useTenantContextOptional()
  const activeWorkspaceId = useMemo(() => {
    for (const candidate of [workspaceId, tenant?.workspaceId, readStoredTenantSelection()?.workspaceId]) {
      if (candidate && !isAllWorkspacesSelection(candidate)) return candidate
    }
    return null
  }, [tenant?.workspaceId, workspaceId])
  // One fetch serves both the approval node's control and graph validation.
  const [approvalRoles, setApprovalRoles] = useState<WorkflowApprovalRoleDto[]>([])
  const [approvalRolesState, setApprovalRolesState] = useState<'loading' | 'ready' | 'error'>('loading')
  const reloadApprovalRoles = useCallback(() => {
    if (!activeWorkspaceId) {
      setApprovalRoles([])
      setApprovalRolesState('ready')
      return
    }
    setApprovalRolesState('loading')
    listWorkflowApprovalRoles(activeWorkspaceId)
      .then((items) => {
        setApprovalRoles(items)
        setApprovalRolesState('ready')
      })
      .catch(() => setApprovalRolesState('error'))
  }, [activeWorkspaceId])
  useEffect(reloadApprovalRoles, [reloadApprovalRoles])
  const rolesWithHolders = useMemo(
    // Undefined while loading or unavailable: a validator must not claim "nobody holds
    // this role" when it simply has not been told yet.
    () => (approvalRolesState === 'ready' ? new Set(approvalRoles.map((role) => role.role_code)) : undefined),
    [approvalRoles, approvalRolesState],
  )

  const { screenToFlowPosition, fitView } = useReactFlow()
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const idCounterRef = useRef(0)

  const initial = useMemo(
    () => loadOrSeedWorkflowGraph(workflowId, workflowName),
    [workflowId, workflowName],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNodeData>(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)
  const [ideaSections, setIdeaSections] = useState<IdeaSectionVisibilityMap>(
    () => readIdeaSectionVisibility(initial.ideaSections),
  )
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const resizeStartRef = useRef(new Map<string, NodeFrame>())
  const savedRevisionRef = useRef<string | null>(null)
  // Autosave writes the graph, but Save Draft stays enabled until the user saves
  // that revision themselves.
  const explicitRevisionRef = useRef<string | null>(null)
  const [publishedRevision, setPublishedRevision] = useState<string | null>(null)
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [versionRows, setVersionRows] = useState<WorkflowVersionDto[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [autosaveReady, setAutosaveReady] = useState(!workflowId)
  const [draftSaveState, setDraftSaveState] = useState<'saved' | 'unsaved' | 'saving'>(workflowId ? 'saved' : 'unsaved')
  const [name, setName] = useState(initial.name)
  const [workflowType, setWorkflowType] = useState<string>('General')
  // Owner is a workspace member's id; empty means unassigned.
  const [ownerId, setOwnerId] = useState<string>('')
  const [scopeMode, setScopeMode] = useState<WorkflowScopeMode>('organization')
  const [scopeWorkspaceIds, setScopeWorkspaceIds] = useState<string[]>([])
  // The owning workspace decides which organization's workspaces can be chosen.
  const [ownerWorkspaceId, setOwnerWorkspaceId] = useState<string | null>(activeWorkspaceId)
  const [orgWorkspaces, setOrgWorkspaces] = useState<WorkspaceOrgWorkspaceDto[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [tab, setTab] = useState<'builder' | 'debug'>(initialView === 'builder' ? 'builder' : 'debug')
  const [runs, setRuns] = useState<WorkflowRunSummaryDto[]>([])
  const [activeRun, setActiveRun] = useState<WorkflowRunDto | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [runContextText, setRunContextText] = useState(initialView === 'run' ? '{}' : '{\n  "amount": 600000000\n}')
  const [contextMenu, setContextMenu] = useState<CanvasMenuState | null>(null)

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const setIdeaSectionVisibility = useCallback((key: IdeaPanelKey, visibility: IdeaSectionVisibility) => {
    setIdeaSections((current) => ({ ...current, [key]: visibility }))
  }, [])

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  const currentRevision = useMemo(
    () => workflowRevision(name, nodes, edges, ideaSections, { category: workflowType, owner: ownerId, scopeMode, scopeWorkspaceIds }),
    [edges, ideaSections, name, nodes, ownerId, scopeMode, scopeWorkspaceIds, workflowType],
  )
  const latestRevisionRef = useRef(currentRevision)

  useEffect(() => {
    latestRevisionRef.current = currentRevision
    if (!autosaveReady) return
    setDraftSaveState(currentRevision === explicitRevisionRef.current ? 'saved' : 'unsaved')
  }, [autosaveReady, currentRevision])

  const onWorkflowNodesChange = useCallback((changes: NodeChange[]) => {
    for (const change of changes) {
      if (change.type !== 'dimensions') continue
      if (change.resizing && !resizeStartRef.current.has(change.id)) {
        const node = nodesRef.current.find((item) => item.id === change.id)
        if (node) resizeStartRef.current.set(change.id, frameForNode(node))
      }
    }

    // NodeResizer emits position and dimension changes together for top/left
    // handles. Adjust those changes before React Flow applies them so the card
    // visibly locks to a nearby node edge or centre while it is being dragged.
    const alignedChanges = changes.map((change) => ({ ...change }))
    for (const change of alignedChanges) {
      // Node drag changes explicitly carry a dragging flag. Resize-generated
      // position changes do not, so this cannot interfere with resize snapping.
      if (change.type !== 'position' || change.dragging === undefined || !change.position) continue
      const node = nodesRef.current.find((item) => item.id === change.id)
      if (!node) continue
      const frame = frameForNode(node)
      const otherFrames = nodesRef.current.filter((item) => item.id !== node.id).map(frameForNode)
      const xGuides = otherFrames.flatMap((item) => [item.x, item.x + item.width / 2, item.x + item.width])
      const yGuides = otherFrames.flatMap((item) => [item.y, item.y + item.height / 2, item.y + item.height])
      change.position = {
        ...change.position,
        x: snapNodeOrigin(change.position.x, frame.width, xGuides),
        y: snapNodeOrigin(change.position.y, frame.height, yGuides),
      }
    }
    for (const change of alignedChanges) {
      if (change.type !== 'dimensions' || !change.resizing || !change.dimensions) continue
      const node = nodesRef.current.find((item) => item.id === change.id)
      const start = resizeStartRef.current.get(change.id)
      if (!node || !start) continue

      const positionChange = alignedChanges.find((item) => item.type === 'position' && item.id === change.id)
      const nextX = positionChange?.type === 'position' ? positionChange.position?.x ?? node.position.x : node.position.x
      const nextY = positionChange?.type === 'position' ? positionChange.position?.y ?? node.position.y : node.position.y
      const frame = { x: nextX, y: nextY, width: change.dimensions.width, height: change.dimensions.height }
      const otherFrames = nodesRef.current.filter((item) => item.id !== node.id).map(frameForNode)
      const xGuides = otherFrames.flatMap((item) => [item.x, item.x + item.width / 2, item.x + item.width])
      const yGuides = otherFrames.flatMap((item) => [item.y, item.y + item.height / 2, item.y + item.height])
      const leftMoved = positionChange?.type === 'position' && Math.abs(frame.x - start.x) > 0.5
      const topMoved = positionChange?.type === 'position' && Math.abs(frame.y - start.y) > 0.5
      const snappedX = leftMoved ? nearestAlignment(frame.x, xGuides) : nearestAlignment(frame.x + frame.width, xGuides)
      const snappedY = topMoved ? nearestAlignment(frame.y, yGuides) : nearestAlignment(frame.y + frame.height, yGuides)

      if (snappedX != null) {
        if (leftMoved) {
          frame.width = frame.x + frame.width - snappedX
          frame.x = snappedX
        } else {
          frame.width = snappedX - frame.x
        }
      }
      if (snappedY != null) {
        if (topMoved) {
          frame.height = frame.y + frame.height - snappedY
          frame.y = snappedY
        } else {
          frame.height = snappedY - frame.y
        }
      }

      if (positionChange?.type === 'position') {
        positionChange.position = { ...positionChange.position, x: frame.x, y: frame.y }
      }
      const minHeight = ['ifElse', 'approval', 'parallel', 'loop'].includes(node.data.kind) ? 104 : 78
      change.dimensions = { width: Math.max(180, frame.width), height: Math.max(minHeight, frame.height) }
    }

    onNodesChange(alignedChanges)

    const finishedNodeIds = changes
      .filter((change): change is Extract<NodeChange, { type: 'dimensions' }> => change.type === 'dimensions' && change.resizing === false)
      .map((change) => change.id)
      .filter((id) => resizeStartRef.current.has(id))

    if (finishedNodeIds.length === 0) return

    window.requestAnimationFrame(() => {
      setNodes((current) => {
        const resized = new Set(finishedNodeIds)
        const next = current.map((node) => {
          if (!resized.has(node.id)) return node

          const start = resizeStartRef.current.get(node.id)
          const frame = frameForNode(node)
          if (!start) return node

          const otherFrames = current.filter((item) => item.id !== node.id).map(frameForNode)
          const xGuides = otherFrames.flatMap((item) => [item.x, item.x + item.width / 2, item.x + item.width])
          const yGuides = otherFrames.flatMap((item) => [item.y, item.y + item.height / 2, item.y + item.height])
          const minWidth = 180
          const minHeight = ['ifElse', 'approval', 'parallel', 'loop'].includes(node.data.kind) ? 104 : 78

          const leftMoved = Math.abs(frame.x - start.x) > 0.5
          const topMoved = Math.abs(frame.y - start.y) > 0.5
          const snappedX = leftMoved
            ? nearestAlignment(frame.x, xGuides)
            : nearestAlignment(frame.x + frame.width, xGuides)
          const snappedY = topMoved
            ? nearestAlignment(frame.y, yGuides)
            : nearestAlignment(frame.y + frame.height, yGuides)

          let x = frame.x
          let y = frame.y
          let width = frame.width
          let height = frame.height

          if (snappedX != null) {
            if (leftMoved) {
              x = snappedX
              width = frame.x + frame.width - snappedX
            } else {
              width = snappedX - frame.x
            }
          }
          if (snappedY != null) {
            if (topMoved) {
              y = snappedY
              height = frame.y + frame.height - snappedY
            } else {
              height = snappedY - frame.y
            }
          }

          width = Math.max(minWidth, width)
          height = Math.max(minHeight, height)
          const changed = x !== frame.x || y !== frame.y || width !== frame.width || height !== frame.height
          return changed
            ? { ...node, position: { x, y }, style: { ...node.style, width, height } }
            : node
        })
        finishedNodeIds.forEach((id) => resizeStartRef.current.delete(id))
        return next
      })
    })
  }, [onNodesChange, setNodes])

  const nextNodeId = useCallback((kind: WorkflowNodeKind) => {
    idCounterRef.current += 1
    return `${kind}-${Date.now().toString(36)}-${idCounterRef.current}`
  }, [])

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) => addEdge({ ...connection, ...DEFAULT_EDGE_OPTIONS }, current))
    },
    [setEdges],
  )

  const setEdgeWaypoints = useCallback((edgeId: string, waypoints: WorkflowWaypoint[]) => {
    setEdges((current) => current.map((edge) => (
      edge.id === edgeId
        ? { ...edge, data: { ...edge.data, waypoints } }
        : edge
    )))
  }, [setEdges])

  const setEdgeAnchor = useCallback((edgeId: string, endpoint: 'source' | 'target', portId: string) => {
    setEdges((current) => current.map((edge) => (
      edge.id === edgeId
        ? {
            ...edge,
            data: {
              ...edge.data,
              [endpoint === 'source' ? 'sourcePort' : 'targetPort']: portId,
            },
          }
        : edge
    )))
  }, [setEdges])

  const clickedNodeIdRef = useRef<string | null>(null)

  const focusNode = useCallback((nodeId: string | null) => {
    clickedNodeIdRef.current = nodeId
    setSelectedNodeId(nodeId)
    setNodes((current) => current.map((node) => {
      const selected = nodeId != null && node.id === nodeId
      return node.selected === selected ? node : { ...node, selected }
    }))
  }, [setNodes])

  const handleSelectionChange = useCallback<OnSelectionChangeFunc>(({ nodes: selectedNodes }) => {
    const clickedId = clickedNodeIdRef.current
    if (clickedId && selectedNodes.some((node) => node.id === clickedId)) {
      setSelectedNodeId(clickedId)
      return
    }
    if (clickedId) {
      setSelectedNodeId(clickedId)
      return
    }
    setSelectedNodeId(selectedNodes.length === 1 ? selectedNodes[0].id : null)
  }, [])

  const handleNodeClick = useCallback<NodeMouseHandler>((_event, node) => {
    focusNode(node.id)
    window.requestAnimationFrame(() => focusNode(node.id))
  }, [focusNode])

  const handlePaneClick = useCallback(() => {
    focusNode(null)
  }, [focusNode])

  const addNode = useCallback(
    (kind: WorkflowNodeKind, position?: { x: number; y: number }) => {
      const id = nextNodeId(kind)
      setNodes((current) => {
        const fallback = {
          x: 220 + (current.length % 3) * 60,
          y: 80 + current.length * 40,
        }
        return [...current, makeNode(kind, position ?? fallback, id)]
      })
      setSelectedNodeId(id)
    },
    [nextNodeId, setNodes],
  )

  const handlePaletteDragStart = useCallback((event: DragEvent<HTMLElement>, kind: WorkflowNodeKind) => {
    event.dataTransfer.setData(WORKFLOW_PALETTE_MIME, kind)
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleCanvasDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const handleCanvasDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const kind = event.dataTransfer.getData(WORKFLOW_PALETTE_MIME) as WorkflowNodeKind
      if (!kind || !WORKFLOW_KIND_META[kind] || !wrapperRef.current) return
      const bounds = wrapperRef.current.getBoundingClientRect()
      const position = screenToFlowPosition({ x: event.clientX - bounds.left, y: event.clientY - bounds.top })
      addNode(kind, position)
    },
    [addNode, screenToFlowPosition],
  )

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) ?? null : null),
    [nodes, selectedNodeId],
  )

  const updateSelectedNode = useCallback(
    (patch: { label?: string; config?: Record<string, string> }) => {
      if (!selectedNodeId) return
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== selectedNodeId) return node
          return {
            ...node,
            data: {
              ...node.data,
              ...(patch.label !== undefined ? { label: patch.label } : {}),
              ...(patch.config ? { config: { ...node.data.config, ...patch.config } } : {}),
            },
          }
        }),
      )
    },
    [selectedNodeId, setNodes],
  )

  const updateSelectedNodeLayout = useCallback(
    (patch: Partial<NodeFrame>) => {
      if (!selectedNodeId) return
      setNodes((current) => current.map((node) => {
        if (node.id !== selectedNodeId) return node
        const frame = frameForNode(node)
        const minHeight = ['ifElse', 'approval', 'parallel', 'loop'].includes(node.data.kind) ? 104 : 78
        const x = Number.isFinite(patch.x) ? patch.x! : frame.x
        const y = Number.isFinite(patch.y) ? patch.y! : frame.y
        const width = Math.max(180, Number.isFinite(patch.width) ? patch.width! : frame.width)
        const height = Math.max(minHeight, Number.isFinite(patch.height) ? patch.height! : frame.height)
        return { ...node, position: { x, y }, style: { ...node.style, width, height } }
      }))
    },
    [selectedNodeId, setNodes],
  )

  const deleteNodeById = useCallback(
    (nodeId: string) => {
      setNodes((current) => current.filter((node) => node.id !== nodeId))
      setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
      setSelectedNodeId((current) => (current === nodeId ? null : current))
    },
    [setEdges, setNodes],
  )

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) return
    deleteNodeById(selectedNodeId)
  }, [deleteNodeById, selectedNodeId])

  const handleAutoLayout = useCallback(() => {
    setNodes((current) => autoLayoutWorkflow(current, edges))
    window.requestAnimationFrame(() => fitView(FIT_VIEW_OPTIONS))
  }, [edges, fitView, setNodes])

  const persist = useCallback(() => {
    if (typeof window === 'undefined') return
    const record: WorkflowGraphRecord = {
      name,
      nodes,
      edges,
      ideaSections,
      savedAt: new Date().toISOString(),
      version: WORKFLOW_TEMPLATE_VERSION,
    }
    try {
      window.localStorage.setItem(workflowStorageKey(workflowId), JSON.stringify(record))
    } catch {
      // localStorage may be unavailable — this is a prototype persistence layer.
    }
  }, [edges, ideaSections, name, nodes, workflowId])

  // Persist editing changes after the pointer/input settles. This keeps drag and
  // resize interactions responsive while ensuring positions and dimensions survive
  // a reload without requiring an extra click on Save Draft.
  useEffect(() => {
    if (!workflowId || !autosaveReady) return
    const revision = currentRevision
    if (revision === savedRevisionRef.current) return

    const timeout = window.setTimeout(() => {
      if (revision === savedRevisionRef.current) return
      // An incomplete scope is not saved automatically; the editor shows what is missing.
      if (scopeMode !== 'organization' && scopeWorkspaceIds.length === 0) return
      persist()
      updateWorkflow(workflowId, {
        name,
        category: workflowType,
        owner: ownerId,
        scope_mode: scopeMode, scope_workspace_ids: scopeMode === 'organization' ? [] : scopeWorkspaceIds,
        trigger: triggerTypeOf(nodes),
        definition: buildRuntimeDefinition(nodes, edges, ideaSections),
        })
        .then(() => {
          savedRevisionRef.current = revision
        })
        .catch(() => {
          // The local copy written above remains the recovery path while offline.
        })
    }, 700)

    return () => window.clearTimeout(timeout)
  }, [autosaveReady, currentRevision, edges, name, nodes, ownerId, persist, scopeMode, scopeWorkspaceIds, workflowId, workflowType])

  useEffect(() => {
    let cancelled = false
    fetchAllWorkspaceOrgWorkspacesCached()
      .then((list) => {
        if (!cancelled) setOrgWorkspaces(list)
      })
      .catch(() => {
        if (!cancelled) setOrgWorkspaces([])
      })
    return () => {
      cancelled = true
    }
  }, [])
  const scopeCandidates = useMemo(() => {
    const organizationId = orgWorkspaces.find((item) => item.id === ownerWorkspaceId)?.organization_id
    if (!organizationId) return []
    return orgWorkspaces
      .filter((item) => item.organization_id === organizationId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [orgWorkspaces, ownerWorkspaceId])

  const handleSaveDraft = useCallback(() => {
    if (scopeMode !== 'organization' && scopeWorkspaceIds.length === 0) {
      addToast({ variant: 'warning', title: 'Choose workspaces for this scope', description: 'Pick at least one workspace, or switch back to all workspaces in the organization.' })
      return
    }
    persist() // local backup
    setDraftSaveState('saving')
    if (!workflowId) {
      createWorkflowApi({
        name,
        category: workflowType,
        owner: ownerId,
        scope_mode: scopeMode, scope_workspace_ids: scopeMode === 'organization' ? [] : scopeWorkspaceIds,
        status: 'Draft',
        // The backend matches events against the workflow row's own trigger, so it has to
        // mirror the Trigger node — otherwise an Event workflow can never fire.
        trigger: triggerTypeOf(nodes),
        definition: buildRuntimeDefinition(nodes, edges, ideaSections),
        workspace_id: activeWorkspaceId ?? undefined,
        })
        .then((created) => {
          const revision = workflowRevision(name, nodes, edges, ideaSections, { category: workflowType, owner: ownerId, scopeMode, scopeWorkspaceIds })
          savedRevisionRef.current = revision
          explicitRevisionRef.current = revision
          setDraftSaveState(latestRevisionRef.current === revision ? 'saved' : 'unsaved')
          onWorkflowCreated?.(created)
          addToast({ variant: 'success', title: 'Draft saved', description: `${name} saved to backend.` })
        })
        .catch((error) => {
          setDraftSaveState('unsaved')
          addToast({
            variant: 'warning',
            title: 'Saved locally',
            description: error instanceof Error ? `Backend unavailable: ${error.message}` : 'Backend unavailable — not synced.',
          })
        })
      return
    }
    updateWorkflow(workflowId, { name, category: workflowType, owner: ownerId, scope_mode: scopeMode, scope_workspace_ids: scopeMode === 'organization' ? [] : scopeWorkspaceIds, trigger: triggerTypeOf(nodes), definition: buildRuntimeDefinition(nodes, edges, ideaSections) })
      .then(() => {
        const revision = workflowRevision(name, nodes, edges, ideaSections, { category: workflowType, owner: ownerId, scopeMode, scopeWorkspaceIds })
        savedRevisionRef.current = revision
        explicitRevisionRef.current = revision
        setDraftSaveState(latestRevisionRef.current === revision ? 'saved' : 'unsaved')
        addToast({ variant: 'success', title: 'Draft saved', description: `${name} saved.` })
      })
      .catch(() => {
        setDraftSaveState('unsaved')
        addToast({ variant: 'warning', title: 'Saved locally', description: 'Backend unavailable — not synced.' })
      })
  }, [activeWorkspaceId, addToast, edges, ideaSections, name, nodes, onWorkflowCreated, ownerId, persist, scopeMode, scopeWorkspaceIds, workflowId, workflowType])

  const handlePublish = useCallback(() => {
    if (scopeMode !== 'organization' && scopeWorkspaceIds.length === 0) {
      addToast({ variant: 'warning', title: 'Choose workspaces for this scope', description: 'Pick at least one workspace, or switch back to all workspaces in the organization.' })
      return
    }
    if (validateWorkflowGraph(nodes, edges, rolesWithHolders).some((issue) => issue.level === 'error')) {
      addToast({ variant: 'error', title: 'Cannot publish workflow', description: 'Resolve blocking validation issues first.' })
      return
    }
    persist() // local backup
    if (!workflowId) {
      addToast({ variant: 'info', title: 'Workflow published', description: `${name} published (prototype).` })
      return
    }
    updateWorkflow(workflowId, { name, category: workflowType, owner: ownerId, scope_mode: scopeMode, scope_workspace_ids: scopeMode === 'organization' ? [] : scopeWorkspaceIds, trigger: triggerTypeOf(nodes), definition: buildRuntimeDefinition(nodes, edges, ideaSections) })
      .then(() => publishWorkflowApi(workflowId))
      .then((published) => {
        const revision = workflowRevision(name, nodes, edges, ideaSections, { category: workflowType, owner: ownerId, scopeMode, scopeWorkspaceIds })
        savedRevisionRef.current = revision
        explicitRevisionRef.current = revision
        setDraftSaveState(latestRevisionRef.current === revision ? 'saved' : 'unsaved')
        setPublishedRevision(revision)
        setPublishedVersion(published.version)
        addToast({ variant: 'success', title: 'Workflow published', description: `${name} published as v${published.version}.` })
      })
      .catch(() => addToast({ variant: 'warning', title: 'Published locally', description: 'Backend unavailable — not synced.' }))
  }, [addToast, edges, ideaSections, name, nodes, ownerId, persist, scopeMode, scopeWorkspaceIds, workflowId, workflowType])

  const openVersions = useCallback(() => {
    setVersionsOpen((open) => {
      const next = !open
      if (next && workflowId) {
        setVersionsLoading(true)
        listWorkflowVersions(workflowId)
          .then(setVersionRows)
          .catch(() => setVersionRows([]))
          .finally(() => setVersionsLoading(false))
      }
      return next
    })
  }, [workflowId])

  const restoreVersion = useCallback((version: number) => {
    if (!workflowId) return
    getWorkflowVersion(workflowId, version)
      .then((row) => {
        const def = row.definition
        if (!def || !Array.isArray(def.nodes) || def.nodes.length === 0) return
        const loadedNodes = (def.nodes as Node<WorkflowNodeData>[]).map((node) => {
          const sized = withWorkflowNodeSize(node)
          if (sized.data?.kind !== 'action') return sized
          return { ...sized, data: { ...sized.data, config: withoutApprovalConfig(sized.data.config ?? {}) } }
        })
        const loadedEdges = (Array.isArray(def.edges) ? def.edges : []) as Edge[]
        const loadedSections = readIdeaSectionVisibility(def.ideaSections)
        setNodes(loadedNodes)
        setEdges(loadedEdges)
        setIdeaSections(loadedSections)
        setVersionsOpen(false)
        addToast({
          variant: 'success',
          title: `Version ${version} restored`,
          description: 'This copy is a draft. Publish it to make this version live.',
        })
      })
      .catch(() => {
        addToast({ variant: 'error', title: 'Could not restore version', description: 'The published snapshot could not be loaded.' })
      })
  }, [addToast, setEdges, setNodes, workflowId])

  // Load the saved graph from the backend (source of truth). If the backend has a
  // non-empty definition, it replaces the local seed; otherwise the seed/template stays.
  useEffect(() => {
    if (!workflowId) return
    let cancelled = false
    setAutosaveReady(false)
    setPublishedRevision(null)
    setPublishedVersion(null)
    getWorkflow(workflowId)
      .then((wf) => {
        if (cancelled) return
        const loadedName = wf.name || workflowName || 'Untitled Workflow'
        if (wf.name) setName(wf.name)
        const loadedMeta: WorkflowRevisionMeta = {
          category: wf.category || 'General',
          owner: wf.owner ?? '',
          scopeMode: (wf.scope_mode as WorkflowScopeMode) ?? 'organization',
          scopeWorkspaceIds: wf.scope_workspace_ids ?? [],
        }
        setWorkflowType(loadedMeta.category)
        setOwnerId(loadedMeta.owner)
        setScopeMode(loadedMeta.scopeMode)
        setScopeWorkspaceIds(loadedMeta.scopeWorkspaceIds)
        setOwnerWorkspaceId(wf.workspace_id ?? activeWorkspaceId)
        const def = wf.definition
        const loadedSections = readIdeaSectionVisibility(def?.ideaSections)
        setIdeaSections(loadedSections)
        if (def && Array.isArray(def.nodes) && def.nodes.length > 0) {
          const loadedNodes = (def.nodes as Node<WorkflowNodeData>[]).map((node) => {
            const sized = withWorkflowNodeSize(node)
            if (sized.data?.kind !== 'action') return sized
            return { ...sized, data: { ...sized.data, config: withoutApprovalConfig(sized.data.config ?? {}) } }
          })
          const loadedEdges = (Array.isArray(def.edges) ? def.edges : []) as Edge[]
          const revision = workflowRevision(loadedName, loadedNodes, loadedEdges, loadedSections, loadedMeta)
          savedRevisionRef.current = revision
          explicitRevisionRef.current = revision
          setPublishedRevision(wf.is_published ? revision : null)
          setPublishedVersion(wf.is_published ? wf.version : null)
          setNodes(loadedNodes)
          setEdges(loadedEdges)
        } else {
          const revision = workflowRevision(loadedName, nodesRef.current, edgesRef.current, loadedSections, loadedMeta)
          savedRevisionRef.current = revision
          explicitRevisionRef.current = revision
          setPublishedRevision(wf.is_published ? revision : null)
          setPublishedVersion(wf.is_published ? wf.version : null)
        }
      })
      .catch(() => {
        // Offline — keep the localStorage/template seed already loaded.
      })
      .finally(() => {
        if (cancelled) return
        if (explicitRevisionRef.current == null) explicitRevisionRef.current = latestRevisionRef.current
        setAutosaveReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [workflowId, workflowName, setEdges, setNodes])

  // ── Execution (Phase B) ─────────────────────────────────────────────────
  const refreshRuns = useCallback(() => {
    if (!workflowId) return
    listWorkflowRuns(workflowId).then(setRuns).catch(() => {})
  }, [workflowId])

  useEffect(() => {
    refreshRuns()
  }, [refreshRuns])

  const executeRun = useCallback(
    async (startNodeId?: string) => {
      if (!workflowId) {
        addToast({ variant: 'warning', title: 'Save first', description: 'Save the workflow before running it.' })
        return
      }
      if (validateWorkflowGraph(nodes, edges, rolesWithHolders).some((issue) => issue.level === 'error')) {
        addToast({ variant: 'error', title: 'Cannot run workflow', description: 'Resolve blocking validation issues first.' })
        return
      }
      setIsRunning(true)
      setTab('debug')
      try {
        await updateWorkflow(workflowId, { name, definition: buildRuntimeDefinition(nodes, edges, ideaSections) })
        let context: Record<string, unknown> = {}
        if (runContextText.trim()) {
          try {
            context = JSON.parse(runContextText)
          } catch {
            addToast({ variant: 'warning', title: 'Invalid context JSON', description: 'Running with empty context.' })
          }
        }
        const run = await runWorkflow(workflowId, {
          trigger_type: 'Manual',
          context,
          use_draft: true,
          ...(startNodeId ? { start_node_id: startNodeId } : {}),
        })
        setActiveRun(run)
        refreshRuns()
        addToast({
          variant: run.status === 'failed' ? 'warning' : run.status === 'waiting_approval' ? 'info' : 'success',
          title: `Run ${run.status.replace('_', ' ')}`,
          description: run.id,
        })
      } catch (e) {
        addToast({ variant: 'error', title: 'Run failed to start', description: e instanceof Error ? e.message : 'Unknown error' })
      } finally {
        setIsRunning(false)
      }
    },
    [addToast, edges, ideaSections, name, nodes, refreshRuns, runContextText, workflowId],
  )

  const handleRun = useCallback(() => {
    void executeRun()
  }, [executeRun])

  const initialRunStartedRef = useRef(false)
  useEffect(() => {
    if (initialView !== 'run' || !workflowId || !autosaveReady || initialRunStartedRef.current) return
    initialRunStartedRef.current = true
    void executeRun()
  }, [autosaveReady, executeRun, initialView, workflowId])

  const openRun = useCallback((runId: string) => {
    getWorkflowRun(runId).then(setActiveRun).catch(() => {})
  }, [])

  const activeRunId = activeRun?.id
  const activeRunStatus = activeRun?.status
  useEffect(() => {
    if (!activeRunId || !activeRunStatus || ['completed', 'failed', 'cancelled'].includes(activeRunStatus)) return
    let cancelled = false
    const poll = () => {
      getWorkflowRun(activeRunId)
        .then((run) => {
          if (!cancelled) {
            setActiveRun(run)
            refreshRuns()
          }
        })
        .catch(() => {})
    }
    const intervalId = window.setInterval(poll, 2000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [activeRunId, activeRunStatus, refreshRuns])

  const handleApprove = useCallback(() => {
    if (!activeRun) return
    approveWorkflowRun(activeRun.id)
      .then((r) => {
        setActiveRun(r)
        refreshRuns()
        addToast({ variant: 'success', title: `Run ${r.status.replace('_', ' ')}` })
      })
      .catch((e) => addToast({ variant: 'error', title: 'Approve failed', description: e instanceof Error ? e.message : '' }))
  }, [activeRun, addToast, refreshRuns])

  const handleReject = useCallback(() => {
    if (!activeRun) return
    rejectWorkflowRun(activeRun.id)
      .then((r) => {
        setActiveRun(r)
        refreshRuns()
        addToast({ variant: 'warning', title: `Run ${r.status.replace('_', ' ')}` })
      })
      .catch((e) => addToast({ variant: 'error', title: 'Reject failed', description: e instanceof Error ? e.message : '' }))
  }, [activeRun, addToast, refreshRuns])

  // ── Context-menu operations ─────────────────────────────────────────────
  const duplicateNode = useCallback(
    (nodeId: string) => {
      const src = nodes.find((node) => node.id === nodeId)
      if (!src) return
      const cloneId = nextNodeId(src.data.kind)
      const clone: Node<WorkflowNodeData> = {
        ...src,
        id: cloneId,
        position: { x: src.position.x + 40, y: src.position.y + 40 },
        data: { ...src.data, config: { ...src.data.config } },
        selected: false,
      }
      setNodes((current) => [...current, clone])
      setSelectedNodeId(cloneId)
    },
    [nextNodeId, nodes, setNodes],
  )

  const addNextStep = useCallback(
    (sourceId: string, kind: WorkflowNodeKind) => {
      const src = nodes.find((node) => node.id === sourceId)
      if (!src) return
      const id = nextNodeId(kind)
      const newNode = makeNode(kind, { x: src.position.x, y: src.position.y + 150 }, id)
      const sourceHandle = src.data.kind === 'ifElse' ? 'true' : src.data.kind === 'parallel' ? 'branchA' : src.data.kind === 'loop' ? 'body' : 'out'
      const edge: Edge = {
        id: `e-${sourceId}-${id}`,
        source: sourceId,
        target: id,
        sourceHandle,
        targetHandle: 'in',
        ...DEFAULT_EDGE_OPTIONS,
      }
      setNodes((current) => [...current, newNode])
      setEdges((current) => [...current, edge])
      setSelectedNodeId(id)
    },
    [nextNodeId, nodes, setEdges, setNodes],
  )

  const toggleNodeDisabled = useCallback(
    (nodeId: string) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, disabled: !node.data.disabled } } : node,
        ),
      )
    },
    [setNodes],
  )

  const addNodeAtScreen = useCallback(
    (kind: WorkflowNodeKind, clientX: number, clientY: number) => {
      if (!wrapperRef.current) {
        addNode(kind)
        return
      }
      const bounds = wrapperRef.current.getBoundingClientRect()
      const position = screenToFlowPosition({ x: clientX - bounds.left, y: clientY - bounds.top })
      addNode(kind, position)
    },
    [addNode, screenToFlowPosition],
  )

  const selectAllNodes = useCallback(() => {
    setNodes((current) => current.map((node) => ({ ...node, selected: true })))
  }, [setNodes])

  const insertStepOnEdge = useCallback(
    (edgeId: string, kind: WorkflowNodeKind) => {
      const edge = edges.find((e) => e.id === edgeId)
      if (!edge) return
      const src = nodes.find((node) => node.id === edge.source)
      const tgt = nodes.find((node) => node.id === edge.target)
      if (!src || !tgt) return
      const id = nextNodeId(kind)
      const position = {
        x: (src.position.x + tgt.position.x) / 2,
        y: (src.position.y + tgt.position.y) / 2,
      }
      const newNode = makeNode(kind, position, id)
      const firstEdge: Edge = {
        id: `e-${edge.source}-${id}`,
        source: edge.source,
        target: id,
        sourceHandle: edge.sourceHandle ?? 'out',
        targetHandle: 'in',
        ...(edge.label ? { label: edge.label } : {}),
        ...DEFAULT_EDGE_OPTIONS,
      }
      const secondEdge: Edge = {
        id: `e-${id}-${edge.target}`,
        source: id,
        target: edge.target,
        sourceHandle: 'out',
        targetHandle: 'in',
        ...DEFAULT_EDGE_OPTIONS,
      }
      setNodes((current) => [...current, newNode])
      setEdges((current) => [...current.filter((e) => e.id !== edgeId), firstEdge, secondEdge])
      setSelectedNodeId(id)
    },
    [edges, nextNodeId, nodes, setEdges, setNodes],
  )

  const relabelEdge = useCallback(
    (edgeId: string) => {
      setEdges((current) =>
        current.map((edge) => {
          if (edge.id !== edgeId) return edge
          if (edge.label) return { ...edge, label: '' }
          const sourceKind = nodes.find((n) => n.id === edge.source)?.data?.kind
          const label = sourceKind === 'approval'
            ? (edge.sourceHandle === 'false' ? 'Rejected' : 'Approved')
            : edge.sourceHandle === 'false' ? 'No' : 'Yes'
          return { ...edge, label }
        }),
      )
    },
    [setEdges],
  )

  const deleteEdgeById = useCallback(
    (edgeId: string) => {
      setEdges((current) => current.filter((edge) => edge.id !== edgeId))
    },
    [setEdges],
  )

  // ── Context-menu event handlers (React Flow props) ──────────────────────
  const onNodeContextMenu = useCallback<NodeMouseHandler>((event, node) => {
    event.preventDefault()
    setContextMenu({ kind: 'node', x: event.clientX, y: event.clientY, targetId: node.id })
  }, [])

  const onEdgeContextMenu = useCallback<EdgeMouseHandler>((event, edge) => {
    event.preventDefault()
    setContextMenu({ kind: 'edge', x: event.clientX, y: event.clientY, targetId: edge.id })
  }, [])

  const onPaneContextMenu = useCallback((event: ReactMouseEvent | MouseEvent) => {
    event.preventDefault()
    setContextMenu({ kind: 'pane', x: event.clientX, y: event.clientY })
  }, [])

  const menuNode = useMemo(
    () => (contextMenu?.kind === 'node' ? nodes.find((node) => node.id === contextMenu.targetId) ?? null : null),
    [contextMenu, nodes],
  )

  // Shared kind picker used by node "Add next step", pane "Add node" and edge "Insert step".
  const renderKindItems = useCallback(
    (onPick: (kind: WorkflowNodeKind) => void) =>
      WORKFLOW_PALETTE_ORDER.map((kind) => {
        const meta = WORKFLOW_KIND_META[kind]
        const Icon = meta.icon
        return (
          <ContextMenuItem
            key={kind}
            onSelect={() => {
              onPick(kind)
              closeContextMenu()
            }}
          >
            <Icon className="h-4 w-4 text-slate-500" />
            <span>{meta.label}</span>
          </ContextMenuItem>
        )
      }),
    [closeContextMenu],
  )

  // Delete key removes the selected node (skips while typing in a field).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      if (!selectedNodeId) return
      event.preventDefault()
      deleteSelectedNode()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [deleteSelectedNode, selectedNodeId])

  const minimapNodeColor = useCallback(
    (node: Node) => WORKFLOW_KIND_META[(node.data as WorkflowNodeData)?.kind]?.accent ?? '#cbd5e1',
    [],
  )

  const selectedMeta = selectedNode ? WORKFLOW_KIND_META[selectedNode.data.kind] : null
  const selectedNodeFrame = selectedNode ? frameForNode(selectedNode) : null

  const issues = useMemo(() => validateWorkflowGraph(nodes, edges, rolesWithHolders), [edges, nodes, rolesWithHolders])
  const errorCount = issues.filter((i) => i.level === 'error').length
  const warningCount = issues.filter((i) => i.level === 'warning').length
  const issueLevelByNode = useMemo(() => {
    const map = new Map<string, 'error' | 'warning'>()
    issues.forEach((iss) => {
      if (!iss.nodeId) return
      if (iss.level === 'error' || !map.has(iss.nodeId)) map.set(iss.nodeId, iss.level)
    })
    return map
  }, [issues])
  const displayNodes = useMemo(
    () => nodes.map((n) => (issueLevelByNode.has(n.id) ? { ...n, data: { ...n.data, _issue: issueLevelByNode.get(n.id) } } : n)),
    [nodes, issueLevelByNode],
  )
  const displayEdges = useMemo(
    () => edges.map((edge) => (edge.type === 'routed' ? edge : { ...edge, type: 'routed' as const })),
    [edges],
  )

  return (
    <div className="fixed inset-x-0 bottom-0 top-12 z-[45] flex flex-col bg-slate-50">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 shadow-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg text-slate-500 hover:text-slate-900"
          onClick={onClose}
          aria-label="Close workflow builder"
          title="Back to catalog"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex min-w-0 items-center gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Workflow name"
            className="h-9 w-[260px] max-w-[42vw] rounded-lg border-transparent bg-transparent px-2 text-sm font-semibold text-slate-900 hover:border-slate-200 focus-visible:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-200 focus-visible:ring-offset-0"
          />
          <Select
            value={workflowType}
            onChange={(event) => setWorkflowType(event.target.value)}
            title="Workflow type"
            className="h-8 w-[130px] text-xs"
          >
            {WORKFLOW_TYPES.map((type) => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </Select>
          <Select
            value={ownerId}
            onChange={(event) => setOwnerId(event.target.value)}
            title="Workflow owner"
            className="h-8 w-[180px] text-xs"
          >
            <SelectItem value="">Unassigned</SelectItem>
            {ownerId && !workspaceMembers.some((member) => member.id === ownerId) ? (
              <SelectItem value={ownerId}>{ownerId}</SelectItem>
            ) : null}
            {workspaceMembers.map((member) => (
              <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
            ))}
          </Select>
          {autosaveReady && (
            <span
              className={cn(
                'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                publishedRevision !== null
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700',
              )}
            >
              {publishedVersion !== null ? `Published v${publishedVersion}` : 'Draft'}
            </span>
          )}
        </div>

        <div className="mx-2 hidden items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 md:flex">
          <button
            type="button"
            onClick={() => setTab('builder')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              tab === 'builder' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Builder
          </button>
          <button
            type="button"
            onClick={() => setTab('debug')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              tab === 'debug' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <Bug className="h-3.5 w-3.5" /> Runs &amp; Validation
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-lg px-3 text-xs"
            onClick={handleAutoLayout}
            disabled={tab !== 'builder' || nodes.length === 0}
            title="Auto-arrange nodes top-down"
          >
            <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Auto-arrange
          </Button>
          <button
            type="button"
            onClick={() => setTab('debug')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
              errorCount > 0
                ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                : warningCount > 0
                  ? 'border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100',
            )}
            title="Open validation & dry run"
          >
            {errorCount > 0 || warningCount > 0 ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {errorCount > 0
              ? `${errorCount} error${errorCount > 1 ? 's' : ''}`
              : warningCount > 0
                ? `${warningCount} warning${warningCount > 1 ? 's' : ''}`
                : 'Valid'}
          </button>
          <Button
            type="button"
            size="sm"
            className="h-9 rounded-lg bg-emerald-600 px-3 text-xs hover:bg-emerald-700"
            onClick={handleRun}
            disabled={isRunning || !workflowId}
            title={workflowId ? 'Execute this workflow' : 'Save the workflow first'}
          >
            {isRunning ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="mr-1.5 h-3.5 w-3.5" />} Run
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              'h-9 rounded-lg px-3 text-xs transition-colors',
              draftSaveState === 'unsaved' && 'border-amber-400 bg-amber-50 text-amber-800 hover:border-amber-500 hover:bg-amber-100',
              draftSaveState === 'saving' && 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100',
            )}
            onClick={handleSaveDraft}
            disabled={draftSaveState !== 'unsaved'}
            title={draftSaveState === 'unsaved' ? 'Changes have not been saved to the backend' : draftSaveState === 'saving' ? 'Saving changes' : 'All changes saved'}
          >
            {draftSaveState === 'saving' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            {draftSaveState === 'unsaved' ? 'Save changes' : draftSaveState === 'saving' ? 'Saving...' : 'Save Draft'}
          </Button>
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-lg px-3 text-xs"
              onClick={openVersions}
              disabled={!workflowId}
              title={workflowId ? 'Published versions' : 'Save the workflow first'}
            >
              <Clock3 className="mr-1.5 h-3.5 w-3.5" /> Versions
            </Button>
            {versionsOpen && (
              <div className="absolute right-0 top-11 z-50 w-80 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-900">Published versions</p>
                  <button type="button" className="text-[11px] text-slate-500 hover:text-slate-800" onClick={() => setVersionsOpen(false)}>
                    Close
                  </button>
                </div>
                <p className="mb-2 text-[11px] leading-4 text-slate-500">
                  The live workflow is the newest published version. Saving a draft does not replace it.
                </p>
                {versionsLoading ? (
                  <p className="py-3 text-xs text-slate-500">Loading versions...</p>
                ) : versionRows.length === 0 ? (
                  <p className="py-3 text-xs text-slate-500">No published versions yet.</p>
                ) : (
                  <ul className="max-h-72 space-y-1 overflow-y-auto">
                    {versionRows.map((row) => (
                      <li key={row.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-900">
                            v{row.version}
                            {row.version === publishedVersion ? <span className="ml-1.5 text-[10px] font-semibold uppercase text-emerald-700">Live</span> : null}
                          </p>
                          <p className="truncate text-[10px] text-slate-500">
                            {new Date(row.created_date).toLocaleString()} · {row.created_by}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-100"
                          onClick={() => restoreVersion(row.version)}
                        >
                          Restore
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            className="h-9 rounded-lg px-3 text-xs"
            onClick={handlePublish}
            disabled={draftSaveState === 'saved' && publishedRevision !== null && publishedRevision === currentRevision}
            title={draftSaveState === 'saved' && publishedRevision !== null && publishedRevision === currentRevision ? 'Already published' : 'Publish this workflow'}
          >
            <Send className="mr-1.5 h-3.5 w-3.5" /> Publish
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Left palette */}
        <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Node Palette</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Click to add, or drag onto the canvas.</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {WORKFLOW_PALETTE_GROUPS.map((group) => (
              <section key={group.label} className="mb-4 last:mb-0">
                <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{group.label}</p>
                <div className="space-y-2">
                  {group.kinds.map((kind) => {
                    const meta = WORKFLOW_KIND_META[kind]
                    const Icon = meta.icon
                    return (
                      <button
                        key={kind}
                        type="button"
                        draggable
                        onDragStart={(event) => handlePaletteDragStart(event, kind)}
                        onClick={() => addNode(kind)}
                        className="group flex w-full items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 text-left transition-all hover:border-slate-300 hover:shadow-sm active:cursor-grabbing"
                      >
                        <span
                          className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1', meta.chipClass)}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">{meta.label}</span>
                          <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{meta.hint}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </aside>

        {/* Center canvas */}
        <main className="relative min-h-0 min-w-0 flex-1">
          {tab === 'builder' ? (
            <div ref={wrapperRef} className="absolute inset-0 min-h-[320px] min-w-0" onDragOver={handleCanvasDragOver} onDrop={handleCanvasDrop}>
              <WorkflowCanvasActionsProvider value={{ setEdgeWaypoints, setEdgeAnchor }}>
              <ReactFlow
                className="workflow-builder-canvas h-full w-full"
                nodes={displayNodes}
                edges={displayEdges}
                nodeTypes={WORKFLOW_NODE_TYPES}
                edgeTypes={WORKFLOW_EDGE_TYPES}
                onNodesChange={onWorkflowNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onSelectionChange={handleSelectionChange}
                onNodeClick={handleNodeClick}
                onPaneClick={handlePaneClick}
                onNodeContextMenu={onNodeContextMenu}
                onEdgeContextMenu={onEdgeContextMenu}
                onPaneContextMenu={onPaneContextMenu}
                defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
                connectionLineComponent={WorkflowConnectionPreview}
                connectionMode={ConnectionMode.Loose}
                fitView
                fitViewOptions={FIT_VIEW_OPTIONS}
                minZoom={0.4}
                maxZoom={1.6}
                proOptions={PRO_OPTIONS}
              >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#cbd5e1" />
                <Controls showInteractive={false} className="!rounded-lg !border !border-slate-200 !shadow-sm" />
                <MiniMap
                  pannable
                  zoomable
                  nodeColor={minimapNodeColor}
                  maskColor="rgba(15,23,42,0.06)"
                  className="!rounded-lg !border !border-slate-200 !bg-white/95"
                />
              </ReactFlow>
              </WorkflowCanvasActionsProvider>
              {nodes.length <= 1 ? (
                <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
                  <div className="rounded-full border border-slate-200 bg-white/90 px-3.5 py-1.5 text-[11px] text-slate-500 shadow-sm backdrop-blur">
                    Add steps from the palette on the left, then drag between the dots to connect them.
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="absolute inset-0 overflow-auto bg-slate-50 p-6">
              <div className="mx-auto max-w-3xl space-y-4">
                {/* Summary tiles */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: 'Nodes', value: nodes.length, tone: 'text-slate-900' },
                    { label: 'Connections', value: edges.length, tone: 'text-slate-900' },
                    { label: 'Errors', value: errorCount, tone: 'text-rose-600' },
                    { label: 'Warnings', value: warningCount, tone: 'text-amber-600' },
                  ].map((tile) => (
                    <div key={tile.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">{tile.label}</div>
                      <div className={cn('text-xl font-bold tabular-nums', tile.tone)}>{tile.value}</div>
                    </div>
                  ))}
                </div>

                {/* Validation */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Info className="h-4 w-4 text-slate-500" /> Validation
                  </div>
                  {issues.length === 0 ? (
                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> All checks passed — this workflow looks well-formed.
                    </div>
                  ) : (
                    <ul className="mt-3 space-y-1.5">
                      {issues.map((issue, index) => (
                        <li key={`${issue.nodeId ?? 'graph'}-${index}`}>
                          <button
                            type="button"
                            disabled={!issue.nodeId}
                            onClick={() => {
                              if (!issue.nodeId) return
                              setSelectedNodeId(issue.nodeId)
                              setTab('builder')
                            }}
                            className={cn(
                              'flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors',
                              issue.level === 'error' ? 'border-rose-200 bg-rose-50/60' : 'border-amber-200 bg-amber-50/60',
                              issue.nodeId ? 'hover:brightness-95' : 'cursor-default',
                            )}
                          >
                            <AlertTriangle className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', issue.level === 'error' ? 'text-rose-500' : 'text-amber-500')} />
                            <span className="text-slate-700">{issue.message}</span>
                            {issue.nodeId ? <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase text-slate-400">Fix →</span> : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Runs — real execution against the engine */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Play className="h-4 w-4 text-slate-500" /> Runs
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 rounded-lg bg-emerald-600 px-3 text-xs hover:bg-emerald-700"
                      onClick={handleRun}
                      disabled={isRunning || !workflowId}
                    >
                      {isRunning ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="mr-1.5 h-3.5 w-3.5" />}
                      Run workflow
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {workflowId ? 'Executes the saved workflow via the engine. Context (JSON) feeds If/Else conditions.' : 'Save the workflow first to enable runs.'}
                  </p>
                  <textarea
                    value={runContextText}
                    onChange={(event) => setRunContextText(event.target.value)}
                    rows={2}
                    spellCheck={false}
                    className="mt-2 w-full rounded-lg border border-slate-200 p-2 font-mono text-[11px] text-slate-700"
                    placeholder='{"amount": 600000000}'
                  />

                  {runs.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {runs.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => openRun(r.id)}
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[10px] font-semibold transition',
                            runStatusChipClass(r.status),
                            activeRun?.id === r.id && 'ring-2 ring-slate-300',
                          )}
                          title={r.id}
                        >
                          {r.status.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {activeRun ? (
                    <div className="mt-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[11px] text-slate-500">
                          Run <span className="font-mono">{activeRun.id}</span> · <span className="font-semibold text-slate-700">{activeRun.status.replace('_', ' ')}</span>
                          {activeRun.error ? <span className="text-rose-500"> · {activeRun.error}</span> : null}
                        </span>
                        {activeRun.status === 'waiting_approval' ? (
                          <span className="flex shrink-0 gap-1.5">
                            <Button type="button" size="sm" className="h-7 rounded-lg bg-emerald-600 px-2.5 text-xs hover:bg-emerald-700" onClick={handleApprove}>Approve</Button>
                            <Button type="button" size="sm" variant="outline" className="h-7 rounded-lg px-2.5 text-xs text-rose-600 hover:bg-rose-50" onClick={handleReject}>Reject</Button>
                          </span>
                        ) : null}
                      </div>
                      {activeRun.parallel_branches?.length ? (
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          {activeRun.parallel_branches.map((branch) => (
                            <div key={`${branch.parallel_node_id}-${branch.branch_id}`} className="flex min-w-0 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px]">
                              <span className={cn('h-2 w-2 shrink-0 rounded-full', branch.status === 'completed' ? 'bg-emerald-500' : branch.status.startsWith('waiting') ? 'bg-amber-500' : branch.status === 'failed' ? 'bg-rose-500' : 'bg-sky-500')} />
                              <span className="font-semibold text-slate-700">{branch.branch_id}</span>
                              <span className="truncate text-slate-500">{branch.status.replace('_', ' ')}</span>
                              {branch.current_node_id ? <span className="ml-auto truncate font-mono text-[9px] text-slate-400" title={branch.current_node_id}>{branch.current_node_id}</span> : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <ol className="mt-2 space-y-1.5">
                        {activeRun.steps.map((s, index) => (
                          <li key={s.id} className="flex items-center gap-2 text-xs">
                            <span className="w-5 shrink-0 text-right font-mono text-[10px] text-slate-400">{index + 1}</span>
                            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', stepStatusDotClass(s.status))} />
                            {s.branch ? <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-500">{s.branch}</span> : null}
                            <span className="font-medium text-slate-800">{s.label || s.node_id}</span>
                            <span className="text-slate-400">{s.kind}</span>
                            <span className={cn('ml-auto shrink-0 text-[10px] font-semibold', stepStatusTextClass(s.status))}>{s.status}</span>
                          </li>
                        ))}
                      </ol>
                      {activeRun.steps.some((s) => s.message) ? (
                        <div className="mt-2 space-y-0.5 border-t border-slate-100 pt-2">
                          {activeRun.steps.filter((s) => s.message).map((s) => (
                            <div key={s.id} className="truncate text-[10px] text-slate-400" title={s.message ?? ''}>· {s.label || s.node_id}: {s.message}</div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                      No runs yet. Click “Run workflow” to execute.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Right config panel */}
        <aside className="flex w-72 shrink-0 flex-col border-l border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {selectedNode ? 'Node Configuration' : 'Workflow'}
            </p>
          </div>
          <div className="source-editor-scroll min-h-0 flex-1 overflow-y-auto p-4">
            {selectedNode && selectedMeta ? (
              <div key={`${selectedNode.id}:${selectedNode.data.kind}`} className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1', selectedMeta.chipClass)}
                  >
                    <selectedMeta.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{selectedMeta.label}</div>
                    <div className="truncate text-sm font-semibold text-slate-900">{selectedNode.data.label}</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className={FIELD_LABEL_CLASS}>Name / Label</label>
                  <Input
                    value={selectedNode.data.label}
                    onChange={(event) => updateSelectedNode({ label: event.target.value })}
                    className="h-8"
                  />
                </div>

                {selectedNodeFrame ? (
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Layout</p>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        ['x', 'X'],
                        ['y', 'Y'],
                        ['width', 'Width'],
                        ['height', 'Height'],
                      ] as const).map(([field, label]) => {
                        const value = Math.round(selectedNodeFrame[field])
                        return (
                          <div key={field} className="space-y-1">
                            <label className={FIELD_LABEL_CLASS}>{label}</label>
                            <Input
                              key={`${selectedNode.id}-${field}-${value}`}
                              type="number"
                              step="1"
                              defaultValue={value}
                              className="h-8"
                              onBlur={(event) => {
                                const next = Number(event.currentTarget.value)
                                if (Number.isFinite(next)) updateSelectedNodeLayout({ [field]: next })
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') event.currentTarget.blur()
                              }}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                {selectedNode.data.kind === 'approval' ? (
                  <>
                    <EmailRecipientsField
                      key={`${selectedNode.id}:approver`}
                      label="Approver"
                      hint="Type and press Enter. Each badge is one approver."
                      modes={['name', 'jobTitle', 'department', 'team', 'role']}
                      mode={selectedNode.data.config.approverBy
                        || (selectedNode.data.config.approverTeam ? 'team' : '')
                        || (selectedNode.data.config.approverRole ? 'role' : 'jobTitle')}
                      values={selectedNode.data.config.approverValues
                        || selectedNode.data.config.approverTeam
                        || selectedNode.data.config.approverRole
                        || ''}
                      onChange={(patch) => updateSelectedNode({
                        config: {
                          approverBy: patch.emailRecipientBy,
                          approverValues: patch.emailRecipients,
                          approverRole: '',
                          approverTeam: '',
                          approver: '',
                        },
                      })}
                    />
                  </>
                ) : null}

                {selectedMeta.fields
                  .filter((field) => {
                    if (field.type === 'approvalTarget' || field.type === 'approvalMembers' || field.type === 'emailRecipients' || field.type === 'emailBody') return false
                    if (selectedNode.data.kind === 'action') return field.type === 'actionDomain' || field.type === 'actionEntity' || field.type === 'actionOperation'
                    if (selectedNode.data.kind !== 'trigger') return true
                    const triggerType = selectedNode.data.config.triggerType
                    if (field.key === 'triggerDomain' || field.key === 'triggerEntity' || field.key === 'triggerEvent') return triggerType === 'Event'
                    if (field.key === 'schedule' || field.key === 'timezone') return triggerType === 'Schedule'
                    if (field.key === 'webhookEvent') return triggerType === 'Webhook'
                    return true
                  })
                  .map((field) => {
                  const value = selectedNode.data.config[field.key] ?? ''
                  return (
                    <div key={field.key} className="space-y-1.5">
                      <label className={FIELD_LABEL_CLASS}>{field.label}</label>
                      {field.type === 'actionDomain' ? (
                        <Select
                          value={value}
                          onChange={(event) => {
                            const domain = event.target.value
                            const entity = workflowActionEntities(domain)[0] ?? ''
                            const operation = workflowActionOperations(domain, entity)[0] ?? ''
                            updateSelectedNode({ config: { actionDomain: domain, actionEntity: entity, actionOperation: operation } })
                          }}
                          className="h-9 text-sm"
                        >
                          {WORKFLOW_ACTION_DOMAINS.map((domain) => (
                            <SelectItem key={domain} value={domain}>{domain}</SelectItem>
                          ))}
                        </Select>
                      ) : field.type === 'actionEntity' ? (
                        <Select
                          value={value}
                          onChange={(event) => {
                            const entity = event.target.value
                            const operation = workflowActionOperations(selectedNode.data.config.actionDomain, entity)[0] ?? ''
                            updateSelectedNode({ config: { actionEntity: entity, actionOperation: operation } })
                          }}
                          className="h-9 text-sm"
                        >
                          {workflowActionEntities(selectedNode.data.config.actionDomain).map((entity) => (
                            <SelectItem key={entity} value={entity}>{entity}</SelectItem>
                          ))}
                        </Select>
                      ) : field.type === 'actionOperation' ? (
                        <Select
                          value={value}
                          onChange={(event) => updateSelectedNode({ config: { actionOperation: event.target.value } })}
                          className="h-9 text-sm"
                        >
                          {workflowActionOperations(selectedNode.data.config.actionDomain, selectedNode.data.config.actionEntity).map((operation) => (
                            <SelectItem key={operation} value={operation}>{operation}</SelectItem>
                          ))}
                        </Select>
                      ) : field.type === 'triggerDomain' ? (
                        <Select
                          value={value}
                          onChange={(event) => {
                            const domain = event.target.value
                            const entity = workflowTriggerEntities(domain)[0] ?? ''
                            const triggerEvent = workflowTriggerEvents(domain, entity)[0] ?? ''
                            updateSelectedNode({ config: { triggerDomain: domain, triggerEntity: entity, triggerEvent } })
                          }}
                          className="h-9 text-sm"
                        >
                          {WORKFLOW_TRIGGER_DOMAINS.map((domain) => (
                            <SelectItem key={domain} value={domain}>{domain}</SelectItem>
                          ))}
                        </Select>
                      ) : field.type === 'triggerEntity' ? (
                        <Select
                          value={value}
                          onChange={(event) => {
                            const entity = event.target.value
                            const triggerEvent = workflowTriggerEvents(selectedNode.data.config.triggerDomain, entity)[0] ?? ''
                            updateSelectedNode({ config: { triggerEntity: entity, triggerEvent } })
                          }}
                          className="h-9 text-sm"
                        >
                          {workflowTriggerEntities(selectedNode.data.config.triggerDomain).map((entity) => (
                            <SelectItem key={entity} value={entity}>{entity}</SelectItem>
                          ))}
                        </Select>
                      ) : field.type === 'triggerEvent' ? (
                        <Select
                          value={value}
                          onChange={(event) => updateSelectedNode({ config: { triggerEvent: event.target.value } })}
                          className="h-9 text-sm"
                        >
                          {workflowTriggerEvents(selectedNode.data.config.triggerDomain, selectedNode.data.config.triggerEntity).map((triggerEvent) => (
                            <SelectItem key={triggerEvent} value={triggerEvent}>{triggerEvent}</SelectItem>
                          ))}
                        </Select>
                      ) : field.type === 'actionTarget' ? (
                        <Select
                          value={normalizeActionTarget(value)}
                          onChange={(event) => updateSelectedNode({ config: { [field.key]: event.target.value } })}
                          className="h-9 text-sm"
                        >
                          {ACTION_TARGET_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </Select>
                      ) : field.type === 'member' ? (
                        <Select
                          value={value}
                          onChange={(event) => updateSelectedNode({ config: { [field.key]: event.target.value } })}
                          className="h-9 text-sm"
                        >
                          <SelectItem value="" disabled>{field.placeholder ?? 'Select a workspace member'}</SelectItem>
                          {workspaceMembers.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name} · {member.email}
                            </SelectItem>
                          ))}
                        </Select>
                      ) : field.type === 'select' ? (
                        <Select
                          value={value}
                          onChange={(event) => updateSelectedNode({ config: { [field.key]: event.target.value } })}
                          className="h-9 text-sm"
                        >
                          {(field.options ?? []).map((option) => (
                            <SelectItem key={option} value={option}>
                              {(field.key === 'actionType' || selectedNode.data.kind === 'trigger') && (() => {
                                const Icon = field.key === 'actionType' ? actionTypeIcon(option) : triggerOptionIcon(field.key, option)
                                return Icon ? <Icon className="mr-2 inline-block h-3.5 w-3.5 align-[-2px] text-slate-500" /> : null
                              })()}
                              {option}
                            </SelectItem>
                          ))}
                        </Select>
                      ) : field.type === 'textarea' ? (
                        <Textarea
                          value={value}
                          placeholder={field.placeholder}
                          onChange={(event) => updateSelectedNode({ config: { [field.key]: event.target.value } })}
                          rows={3}
                          className="resize-y text-sm"
                        />
                      ) : (
                        <Input
                          value={value}
                          placeholder={field.placeholder}
                          onChange={(event) => updateSelectedNode({ config: { [field.key]: event.target.value } })}
                          className="h-8"
                        />
                      )}
                      {selectedNode.data.kind === 'action' && selectedNode.data.config.actionOperation === 'Request for Approval' && field.key === 'actionOperation' ? (
                        <p className="text-[11px] leading-4 text-slate-500">
                          The idea owner must press Request for Approval before the next node runs. Remove this node to notify approvers immediately.
                        </p>
                      ) : null}
                    </div>
                  )
                  })}

                {selectedNode.data.kind === 'approval' && showsReviewEmailSettings(selectedNode) ? (
                  <>
                    <EmailRecipientsField
                      key={`${selectedNode.id}:email-recipients`}
                      mode={selectedNode.data.config.emailRecipientBy || 'jobTitle'}
                      values={selectedNode.data.config.emailRecipients || selectedNode.data.config.jobTitles || ''}
                      onChange={(patch) => updateSelectedNode({ config: patch })}
                    />
                    <EmailBodyField
                      key={`${selectedNode.id}:email-body`}
                      workspaceId={activeWorkspaceId}
                      source={selectedNode.data.config.emailBodySource ?? 'urd'}
                      documentKind={selectedNode.data.config.emailDocumentKind ?? 'URD'}
                      sections={selectedNode.data.config.emailBodySections ?? ''}
                      fixedText={selectedNode.data.config.emailBodyText ?? ''}
                      includeCover={selectedNode.data.config.emailIncludeCover ?? 'no'}
                      onChange={(patch) => updateSelectedNode({ config: patch })}
                    />
                  </>
                ) : null}

                {selectedNode.data.kind === 'action'
                  && selectedNode.data.config.actionDomain === 'Document & Knowledge'
                  && selectedNode.data.config.actionEntity === 'Document'
                  && (selectedNode.data.config.actionOperation === 'Upload' || selectedNode.data.config.actionOperation === 'Request for Approval') ? (
                  <DocumentTemplateKindField
                    workspaceId={activeWorkspaceId}
                    parameter={selectedNode.data.config.parameter ?? ''}
                    nodeLabel={selectedNode.data.label}
                    description={selectedNode.data.config.actionOperation === 'Request for Approval'
                      ? 'The Request for Approval button is shown on this document.'
                      : undefined}
                    onChange={(kind) => updateSelectedNode({ config: { parameter: kind } })}
                  />
                ) : null}

                {selectedNode.data.kind === 'action' && actionPropertyControls(selectedNode.data.config).length > 0 ? (
                  <div className="space-y-3 border-t border-slate-100 pt-3">
                    {actionPropertyControls(selectedNode.data.config).map((control) => {
                      const value = selectedNode.data.config[control.key] ?? ''
                      return (
                        <div key={control.key} className="space-y-1.5">
                          <label className={FIELD_LABEL_CLASS}>{control.label}{control.required ? ' *' : ''}</label>
                          {control.type === 'member' ? (
                            <Select value={value} onChange={(event) => updateSelectedNode({ config: { [control.key]: event.target.value } })} className="h-9 text-sm">
                              <SelectItem value="" disabled>Select a workspace member</SelectItem>
                              {workspaceMembers.map((member) => <SelectItem key={member.id} value={member.id}>{member.name} · {member.email}</SelectItem>)}
                            </Select>
                          ) : control.type === 'select' ? (
                            <Select value={value} onChange={(event) => updateSelectedNode({ config: { [control.key]: event.target.value } })} className="h-9 text-sm">
                              <SelectItem value="" disabled>Select {control.label.toLowerCase()}</SelectItem>
                              {(control.options ?? []).map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                            </Select>
                          ) : control.type === 'textarea' ? (
                            <Textarea value={value} placeholder={control.placeholder} onChange={(event) => updateSelectedNode({ config: { [control.key]: event.target.value } })} className="min-h-20 text-sm" />
                          ) : (
                            <Input type={control.type === 'date' ? 'date' : 'text'} value={value} placeholder={control.placeholder} onChange={(event) => updateSelectedNode({ config: { [control.key]: event.target.value } })} className="h-8" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : null}

                {selectedNode.data.kind === 'action' && actionPropertyControls(selectedNode.data.config).length === 0 && actionParameterControl(selectedNode.data.config) ? (() => {
                  const parameter = actionParameterControl(selectedNode.data.config) as ActionParameterControl
                  const value = selectedNode.data.config.parameter ?? ''
                  return (
                    <div className="space-y-1.5">
                      <label className={FIELD_LABEL_CLASS}>{parameter.label}</label>
                      {parameter.type === 'member' ? (
                        <Select
                          value={value}
                          onChange={(event) => updateSelectedNode({ config: { parameter: event.target.value } })}
                          className="h-9 text-sm"
                        >
                          <SelectItem value="" disabled>Select a workspace member</SelectItem>
                          {workspaceMembers.map((member) => (
                            <SelectItem key={member.id} value={member.id}>{member.name} · {member.email}</SelectItem>
                          ))}
                        </Select>
                      ) : parameter.type === 'select' ? (
                        <Select
                          value={value}
                          onChange={(event) => updateSelectedNode({ config: { parameter: event.target.value } })}
                          className="h-9 text-sm"
                        >
                          {(parameter.options ?? []).map((option) => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </Select>
                      ) : (
                        <Input
                          type={parameter.type === 'date' ? 'date' : 'text'}
                          value={value}
                          placeholder={parameter.placeholder}
                          onChange={(event) => updateSelectedNode({ config: { parameter: event.target.value } })}
                          className="h-8"
                        />
                      )}
                    </div>
                  )
                })() : null}

                {showsIdeaSectionSettings(selectedNode) ? (
                  <>
                    <EmailRecipientsField
                      label="Applies to"
                      hint="Leave empty to include everyone. Add badges to limit who this workflow applies to."
                      modes={['jobTitle', 'department', 'name', 'team', 'role', 'workspace']}
                      mode={selectedNode.data.config.audienceBy || 'jobTitle'}
                      values={selectedNode.data.config.audienceValues || ''}
                      onChange={(patch) => updateSelectedNode({
                        config: { audienceBy: patch.emailRecipientBy, audienceValues: patch.emailRecipients },
                      })}
                    />
                    <div className="border-t border-slate-100 pt-3">
                      <IdeaSectionVisibilityEditor value={ideaSections} onChange={setIdeaSectionVisibility} />
                    </div>
                  </>
                ) : null}
                <div className="border-t border-slate-100 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    onClick={deleteSelectedNode}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete Node
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Applies to</label>
                  <Select
                    value={scopeMode}
                    onChange={(event) => setScopeMode(event.target.value as WorkflowScopeMode)}
                    className="h-9 text-sm"
                  >
                    <SelectItem value="organization">All workspaces in the organization</SelectItem>
                    <SelectItem value="include">Only the selected workspaces</SelectItem>
                    <SelectItem value="exclude">All except the selected workspaces</SelectItem>
                  </Select>
                  {scopeMode !== 'organization' ? (
                    <div className="space-y-1.5">
                      {scopeCandidates.length === 0 ? (
                        <p className="text-[11px] text-slate-500">No workspaces found in this organization.</p>
                      ) : (
                        <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                          {scopeCandidates.map((item) => (
                            <label key={item.id} className="flex items-center gap-2 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={scopeWorkspaceIds.includes(item.id)}
                                onChange={() => setScopeWorkspaceIds((current) => (
                                  current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]
                                ))}
                              />
                              <span className="truncate">{item.name}</span>
                              {item.slug ? <span className="shrink-0 truncate text-[10px] text-slate-400">{item.slug}</span> : null}
                            </label>
                          ))}
                        </div>
                      )}
                      {scopeWorkspaceIds.length === 0 ? (
                        <p className="text-[11px] text-amber-700">Choose at least one workspace. Nothing is saved until you do.</p>
                      ) : null}
                    </div>
                  ) : null}
                  <p className="text-[11px] leading-snug text-slate-500">
                    {scopeMode === 'organization'
                      ? 'Runs for every workspace in this organization.'
                      : scopeMode === 'include'
                        ? 'Runs only in the workspaces you select.'
                        : 'Runs everywhere in this organization except the workspaces you select.'}
                  </p>
                </div>
                <p className="text-sm leading-relaxed text-slate-500">
                  Select a node to configure it. Idea Detail sections are set on the Idea event trigger.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
      {/* Right-click context menu — one component, items switch on kind. */}
      <ContextMenu
        open={contextMenu !== null}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        onClose={closeContextMenu}
      >
        {contextMenu?.kind === 'node' && contextMenu.targetId ? (
          <>
            <ContextMenuItem
              onSelect={() => {
                setSelectedNodeId(contextMenu.targetId!)
                setTab('builder')
                closeContextMenu()
              }}
            >
              <Settings2 className="h-4 w-4 text-slate-500" />
              <span>Configure</span>
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                setSelectedNodeId(contextMenu.targetId!)
                setTab('builder')
                closeContextMenu()
              }}
            >
              <Pencil className="h-4 w-4 text-slate-500" />
              <span>Rename</span>
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                duplicateNode(contextMenu.targetId!)
                closeContextMenu()
              }}
            >
              <Copy className="h-4 w-4 text-slate-500" />
              <span>Duplicate</span>
            </ContextMenuItem>
            <ContextMenuSubmenu
              trigger={
                <>
                  <Plus className="h-4 w-4 text-slate-500" />
                  <span className="flex-1">Add next step</span>
                  <span className="text-slate-400">▸</span>
                </>
              }
            >
              {renderKindItems((kind) => addNextStep(contextMenu.targetId!, kind))}
            </ContextMenuSubmenu>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => {
                toggleNodeDisabled(contextMenu.targetId!)
                closeContextMenu()
              }}
            >
              <Power className="h-4 w-4 text-slate-500" />
              <span>{menuNode?.data.disabled ? 'Enable' : 'Disable'}</span>
            </ContextMenuItem>
            <ContextMenuItem
              className={cn(!workflowId && 'pointer-events-none opacity-40')}
              onSelect={() => {
                if (!workflowId) return
                void executeRun(contextMenu.targetId!)
                closeContextMenu()
              }}
            >
              <PlayCircle className="h-4 w-4 text-emerald-600" />
              <span>Run from here</span>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              onSelect={() => {
                deleteNodeById(contextMenu.targetId!)
                closeContextMenu()
              }}
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete node</span>
            </ContextMenuItem>
          </>
        ) : null}

        {contextMenu?.kind === 'pane' ? (
          <>
            <ContextMenuSubmenu
              trigger={
                <>
                  <Plus className="h-4 w-4 text-slate-500" />
                  <span className="flex-1">Add node</span>
                  <span className="text-slate-400">▸</span>
                </>
              }
            >
              {renderKindItems((kind) => addNodeAtScreen(kind, contextMenu.x, contextMenu.y))}
            </ContextMenuSubmenu>
            <ContextMenuSeparator />
            <ContextMenuItem
              className={cn(nodes.length === 0 && 'pointer-events-none opacity-40')}
              onSelect={() => {
                handleAutoLayout()
                closeContextMenu()
              }}
            >
              <Wand2 className="h-4 w-4 text-slate-500" />
              <span>Auto-arrange</span>
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                fitView(FIT_VIEW_OPTIONS)
                closeContextMenu()
              }}
            >
              <Maximize2 className="h-4 w-4 text-slate-500" />
              <span>Fit view</span>
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                selectAllNodes()
                closeContextMenu()
              }}
            >
              <BoxSelect className="h-4 w-4 text-slate-500" />
              <span>Select all</span>
            </ContextMenuItem>
          </>
        ) : null}

        {contextMenu?.kind === 'edge' && contextMenu.targetId ? (
          <>
            <ContextMenuSubmenu
              trigger={
                <>
                  <Plus className="h-4 w-4 text-slate-500" />
                  <span className="flex-1">Insert step here</span>
                  <span className="text-slate-400">▸</span>
                </>
              }
            >
              {renderKindItems((kind) => insertStepOnEdge(contextMenu.targetId!, kind))}
            </ContextMenuSubmenu>
            <ContextMenuItem
              onSelect={() => {
                relabelEdge(contextMenu.targetId!)
                closeContextMenu()
              }}
            >
              <Tag className="h-4 w-4 text-slate-500" />
              <span>Relabel</span>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              onSelect={() => {
                deleteEdgeById(contextMenu.targetId!)
                closeContextMenu()
              }}
            >
              <Unlink className="h-4 w-4" />
              <span>Delete connection</span>
            </ContextMenuItem>
          </>
        ) : null}
      </ContextMenu>
    </div>
  )
}

export function WorkflowBuilderCanvas({ open, workflowId, initialView, workspaceId, workflowName, workspaceMembers, onWorkflowCreated, onClose }: WorkflowBuilderCanvasProps) {
  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <ReactFlowProvider>
      <WorkflowBuilderCanvasInner
        key={workflowId ?? 'new'}
        workflowId={workflowId}
        initialView={initialView}
        workspaceId={workspaceId}
        workflowName={workflowName}
        workspaceMembers={workspaceMembers}
        onWorkflowCreated={onWorkflowCreated}
        onClose={onClose}
      />
    </ReactFlowProvider>,
    document.body,
  )
}
