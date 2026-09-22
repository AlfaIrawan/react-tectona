import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import ReactFlow, {
  BaseEdge,
  ConnectionMode,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  addEdge,
  getSmoothStepPath,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type NodeTypes,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  Bot,
  CheckCircle2,
  ChevronsLeft,
  ChevronsRight,
  FileSearch,
  GitBranch,
  GripVertical,
  Layers,
  Minimize2,
  Play,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Split,
  Stamp,
  Workflow,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { enterpriseControlFocusClass, enterprisePrimarySolidButtonClass, enterpriseSecondaryButtonClass } from '@/lib/enterpriseButtonClasses'
import { CanvasViewportGrid, CanvasViewportRulers } from '@/modules/project-management/components/CanvasViewportRulers'
import { listExplainerAssistants, type ExplainerAssistant } from '@/lib/api/documentKnowledgeApi'
import { getSession } from '@/auth/authService'
import {
  createAgentWorkflow,
  approveAgentWorkflowAction,
  approveAgentWorkflowReview,
  getAgentWorkflow,
  listAgentCatalog,
  listAgentWorkflows,
  publishAgentWorkflow,
  listAgentWorkflowReviews,
  requestAgentWorkflowReview,
  runAgentWorkflow,
  rejectAgentWorkflowAction,
  updateAgentWorkflow,
  type AgentCatalogEntryDto,
  type AgentWorkflowRunDto,
  type AgentWorkflowReviewDto,
  type AgentWorkflowSummaryDto,
} from '@/lib/api/agentWorkflowApi'

type AgentNodeKind = 'start' | 'agent' | 'router' | 'parallel' | 'evidence_validator' | 'compose_final' | 'approval' | 'action'
type AgentNodeData = { kind: AgentNodeKind; label: string; config: Record<string, string> }
type AgentNode = Node<AgentNodeData>
type StudioTab = 'nodes' | 'workflows' | 'inspector'
type PaletteGroup = 'entry' | 'orchestration' | 'grounding' | 'governance' | 'agents'
type PaletteItem = {
  kind: AgentNodeKind
  label: string
  description: string
  group: PaletteGroup
  icon: typeof GitBranch
  config?: Record<string, string>
}

const NODE_WIDTH = 268
const NODE_HEIGHT = 84
const AGENT_PALETTE_MIME = 'application/x-tectona-agent-node'
const STUDIO_PANEL_INSET_PX = 30
const INSPECTOR_CONTROL_CLASS = 'h-10 w-full rounded-xl border border-slate-200 bg-white/90 px-3 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
const INSPECTOR_TEXTAREA_CLASS = 'mt-2 min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white/90 p-3 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100'

const KIND_META: Record<AgentNodeKind, { chip: string; icon: typeof Bot; iconClass: string; minimap: string }> = {
  start: { chip: 'Start', icon: Play, iconClass: 'bg-emerald-500', minimap: '#10b981' },
  agent: { chip: 'Agent', icon: Bot, iconClass: 'bg-blue-600', minimap: '#2563eb' },
  router: { chip: 'Router', icon: GitBranch, iconClass: 'bg-violet-600', minimap: '#7c3aed' },
  parallel: { chip: 'Parallel', icon: Split, iconClass: 'bg-sky-500', minimap: '#0ea5e9' },
  evidence_validator: { chip: 'Validator', icon: ShieldCheck, iconClass: 'bg-indigo-600', minimap: '#4f46e5' },
  compose_final: { chip: 'Compose', icon: Sparkles, iconClass: 'bg-fuchsia-600', minimap: '#c026d3' },
  approval: { chip: 'Approval', icon: Stamp, iconClass: 'bg-slate-500', minimap: '#64748b' },
  action: { chip: 'Action', icon: Zap, iconClass: 'bg-amber-500', minimap: '#f59e0b' },
}

function kindDescription(data: AgentNodeData): string {
  if (data.kind === 'start') {
    return data.config.trigger_type === 'assistant_unanswered'
      ? 'When a question has no matching document evidence'
      : 'Entry point for this workflow'
  }
  if (data.kind === 'action') {
    return data.config.summary
      || (data.config.action_code ? data.config.action_code.replaceAll('_', ' ') : 'Operational outcome after the previous step')
  }
  if (data.config.summary) return data.config.summary
  if (data.config.agent_ref && data.config.agent_ref !== 'assistant:event-source') return data.config.agent_ref
  if (data.kind === 'router') return 'Route intent to a specialist agent'
  if (data.kind === 'evidence_validator') return 'Keep only allowed evidence sources'
  if (data.kind === 'approval') return 'Human decision before the next action'
  if (data.kind === 'parallel') return 'Delegate to multiple agents'
  return 'Agent from the Nodes palette'
}

function AgentWorkflowNode({ data, selected }: NodeProps<AgentNodeData>) {
  const visual = KIND_META[data.kind]
  const Icon = visual.icon
  const handleClass = '!h-2.5 !w-2.5 !rounded-full !border-2 !border-white !bg-slate-400 !opacity-0 group-hover:!opacity-100'
  return (
    <div className="group relative h-full w-full overflow-visible" style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}>
      <Handle type="target" position={Position.Top} id="t-top" className={handleClass} />
      <Handle type="source" position={Position.Top} id="s-top" className={handleClass} />
      <Handle type="target" position={Position.Right} id="t-right" className={handleClass} />
      <Handle type="source" position={Position.Right} id="s-right" className={handleClass} />
      <Handle type="target" position={Position.Bottom} id="t-bottom" className={handleClass} />
      <Handle type="source" position={Position.Bottom} id="s-bottom" className={handleClass} />
      <Handle type="target" position={Position.Left} id="t-left" className={handleClass} />
      <Handle type="source" position={Position.Left} id="s-left" className={handleClass} />
      <div
        className={cn(
          'flex h-full w-full items-center gap-3 rounded-2xl border bg-white/86 px-3 backdrop-blur-[2px] transition-[border-color,box-shadow] duration-200',
          selected ? 'ring-offset-2' : 'hover:ring-offset-1',
        )}
        style={{
          borderColor: `${visual.minimap}a8`,
          boxShadow: selected
            ? `0 0 0 2px ${visual.minimap}2e, 0 0 22px ${visual.minimap}66, 0 12px 28px rgba(15,23,42,0.12)`
            : `0 0 13px ${visual.minimap}38, 0 10px 28px rgba(15,23,42,0.10)`,
        }}
      >
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm', visual.iconClass)}>
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{visual.chip}</p>
          <p className="truncate text-sm font-semibold leading-5 text-slate-900">{data.label}</p>
          <p className="mt-0.5 line-clamp-1 text-[11px] leading-4 text-slate-500">{kindDescription(data)}</p>
        </div>
      </div>
    </div>
  )
}

const NODE_TYPES: NodeTypes = { agentWorkflow: AgentWorkflowNode }

function AgentWorkflowGlowEdge({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  style,
}: EdgeProps) {
  const [path] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const color = String(style?.stroke ?? '#94a3b8')
  return (
    <>
      <path d={path} fill="none" stroke={color} strokeWidth={8} opacity={0.24} filter="url(#agent-workflow-edge-glow)" />
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={{ ...style, stroke: color, strokeWidth: 2.25, filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </>
  )
}

const EDGE_TYPES = { agentWorkflowGlow: AgentWorkflowGlowEdge }

const DEFAULT_EDGE_OPTIONS = {
  type: 'agentWorkflowGlow',
  markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 14, height: 14 },
  style: { stroke: '#94a3b8', strokeWidth: 2.25 },
}

function glowEdgeOptions(kind?: AgentNodeKind) {
  const color = kind ? KIND_META[kind].minimap : '#94a3b8'
  return {
    type: 'agentWorkflowGlow',
    markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
    style: { stroke: color, strokeWidth: 2.25 },
  }
}

function withDirectionalHandles(edge: Edge, canvasNodes: AgentNode[]): Edge {
  const source = canvasNodes.find((node) => node.id === edge.source)
  const target = canvasNodes.find((node) => node.id === edge.target)
  if (!source || !target) return edge

  const dx = target.position.x - source.position.x
  const dy = target.position.y - source.position.y
  const horizontal = Math.abs(dx) > Math.abs(dy)
  const sourceHandle = horizontal
    ? dx >= 0 ? 's-right' : 's-left'
    : dy >= 0 ? 's-bottom' : 's-top'
  const targetHandle = horizontal
    ? dx >= 0 ? 't-left' : 't-right'
    : dy >= 0 ? 't-top' : 't-bottom'
  return { ...edge, sourceHandle, targetHandle, ...glowEdgeOptions(source.data.kind) }
}

function asCanvasNode(node: AgentNode, index: number): AgentNode {
  return {
    ...node,
    type: 'agentWorkflow',
    style: { width: NODE_WIDTH, height: NODE_HEIGHT, ...(node.style ?? {}) },
    position: node.position ?? { x: 280, y: 24 + index * 150 },
    data: node.data,
  }
}

const initialNodes: AgentNode[] = [
  { id: 'start', position: { x: 360, y: 80 }, data: { kind: 'start', label: 'Start', config: { trigger_type: 'manual' } } },
  { id: 'approval', position: { x: 360, y: 240 }, data: { kind: 'approval', label: 'Approve workflow action', config: {} } },
  { id: 'action', position: { x: 360, y: 400 }, data: { kind: 'action', label: 'Send workflow outcome', config: { agent_ref: 'runtime:workflow-escalation', action_code: 'send_customer_email', target: '', summary: 'Sends the approved outcome by email, chat, or service request.' } } },
].map(asCanvasNode)

const initialEdges: Edge[] = [
  { id: 'start-approval', source: 'start', target: 'approval' },
  { id: 'approval-action', source: 'approval', target: 'action' },
].map((edge) => withDirectionalHandles(edge, initialNodes))

const PALETTE_GROUP_META: Record<PaletteGroup, { label: string; description: string }> = {
  entry: { label: 'Entry', description: 'Where this workflow begins.' },
  orchestration: { label: 'Orchestration', description: 'Direct how agent work is routed and coordinated.' },
  grounding: { label: 'Grounding & response', description: 'Validate evidence and compose the final answer.' },
  governance: { label: 'Governance & delivery', description: 'Apply human control before an operational outcome.' },
  agents: { label: 'Workspace agents', description: 'Published assistants available in this workspace, plus global system agents.' },
}

const PALETTE_GROUP_ORDER: PaletteGroup[] = ['entry', 'orchestration', 'grounding', 'governance', 'agents']

const NODE_PALETTE: PaletteItem[] = [
  { kind: 'start', label: 'Start', description: 'Entry point. Choose whether the workflow starts manually or when document evidence is missing.', group: 'entry', icon: Play, config: { trigger_type: 'assistant_unanswered', summary: 'When a question has no matching document evidence' } },
  { kind: 'router', label: 'Router', description: 'Routes a request to the best branch using configured knowledge signals.', group: 'orchestration', icon: GitBranch, config: { route_rules: '{"knowledge":["policy","ketentuan","sop","dokumen"]}', fallback_route: 'fallback' } },
  { kind: 'parallel', label: 'Parallel delegation', description: 'Runs independent agent work in parallel, then joins the results.', group: 'orchestration', icon: Split },
  { kind: 'evidence_validator', label: 'Evidence validator', description: 'Keeps only evidence from allowed and trusted source services.', group: 'grounding', icon: ShieldCheck },
  { kind: 'compose_final', label: 'Final response', description: 'Composes a grounded response from the selected agent output.', group: 'grounding', icon: Sparkles, config: { agent_ref: 'builtin:smith' } },
  { kind: 'approval', label: 'Approval', description: 'Pauses the flow until an authorized reviewer approves or rejects it.', group: 'governance', icon: Stamp },
  { kind: 'action', label: 'Action', description: 'Sends the approved outcome by email, chat, or service request.', group: 'governance', icon: Zap, config: { action_code: 'send_customer_email', priority: 'medium', summary: 'Sends the approved outcome by email, chat, or service request.' } },
]

const NEXT_KINDS: Record<AgentNodeKind, AgentNodeKind[]> = {
  start: ['agent', 'router', 'parallel', 'evidence_validator', 'compose_final', 'approval'],
  agent: ['agent', 'router', 'parallel', 'evidence_validator', 'compose_final', 'approval'],
  router: ['agent', 'router', 'parallel', 'evidence_validator', 'compose_final', 'approval'],
  parallel: ['agent'],
  evidence_validator: ['agent', 'compose_final', 'approval'],
  compose_final: ['approval'],
  approval: ['action'],
  action: [],
}

const KIND_LABEL: Record<AgentNodeKind, string> = {
  start: 'Start',
  agent: 'Agent',
  router: 'Router',
  parallel: 'Parallel delegation',
  evidence_validator: 'Evidence validator',
  compose_final: 'Final response',
  approval: 'Approval',
  action: 'Action',
}

function connectionIssue(source: AgentNode, target: AgentNode, edges: Edge[]): string | null {
  if (source.id === target.id) return 'A node cannot connect to itself.'
  if (edges.some((edge) => edge.source === source.id && edge.target === target.id)) return 'These nodes are already connected.'
  const allowed = NEXT_KINDS[source.data.kind]
  if (!allowed.includes(target.data.kind)) {
    if (allowed.length === 0) return `${KIND_LABEL[source.data.kind]} is the end of the flow and cannot connect onward.`
    return `${KIND_LABEL[source.data.kind]} can connect to ${allowed.map((kind) => KIND_LABEL[kind]).join(', ')}.`
  }
  const outgoing = edges.filter((edge) => edge.source === source.id).length
  if (outgoing > 0 && source.data.kind !== 'router' && source.data.kind !== 'parallel') {
    return `${KIND_LABEL[source.data.kind]} can have only one outgoing connection.`
  }
  const seen = new Set<string>()
  const stack = [target.id]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || seen.has(current)) continue
    if (current === source.id) return 'This connection would create a cycle.'
    seen.add(current)
    edges.filter((edge) => edge.source === current).forEach((edge) => stack.push(edge.target))
  }
  return null
}

function minimapColor(node: Node): string {
  const kind = (node.data as AgentNodeData | undefined)?.kind
  return kind ? KIND_META[kind].minimap : '#2563eb'
}

function AgentWorkflowStudioInner({
  workspaceId,
  initialWorkflowId,
  onClose,
}: {
  workspaceId?: string | null
  initialWorkflowId?: string | null
  onClose?: () => void
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<AgentNodeData>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [catalog, setCatalog] = useState<AgentCatalogEntryDto[]>([])
  const [explainerAssistants, setExplainerAssistants] = useState<ExplainerAssistant[]>([])
  const [workflows, setWorkflows] = useState<AgentWorkflowSummaryDto[]>([])
  const [isPublished, setIsPublished] = useState(false)
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [name, setName] = useState('Vero - document evidence email escalation')
  const [description, setDescription] = useState('Requests approval before forwarding a Vero question with no matching document evidence to an email recipient.')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [question, setQuestion] = useState('Apa ketentuan PH Maks untuk UMCY?')
  const [run, setRun] = useState<AgentWorkflowRunDto | null>(null)
  const [reviews, setReviews] = useState<AgentWorkflowReviewDto[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null)
  const [sidebarTab, setSidebarTab] = useState<StudioTab>('nodes')
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [nodeQuery, setNodeQuery] = useState('')

  const selected = useMemo(() => nodes.find((node) => node.id === selectedId) ?? null, [nodes, selectedId])
  const pendingReview = useMemo(() => reviews.find((review) => review.status === 'pending') ?? null, [reviews])
  const approvedReview = useMemo(() => reviews.find((review) => review.status === 'approved') ?? null, [reviews])
  const isReviewAuthor = pendingReview?.requested_by === getSession()?.user.id
  const workspaceAgents = useMemo<AgentCatalogEntryDto[]>(() => {
    // `runtime:vero` is a legacy, global catalog record. Vero must be selected
    // through its published assistant identity so it cannot leak into another workspace.
    const scoped = new Map(
      catalog
        .filter((agent) => agent.runtime === 'tectona-agent-runtime'
          && agent.agent_ref !== 'runtime:vero'
          && !agent.agent_ref.startsWith('assistant:'))
        .map((agent) => [agent.agent_ref, agent]),
    )
    for (const assistant of explainerAssistants) {
      if (assistant.status !== 'published') continue
      const agentRef = `assistant:${assistant.id}`
      scoped.set(agentRef, {
        agent_ref: agentRef,
        display_name: assistant.display_name,
        agent_type: 'knowledge',
        runtime: 'tectona-agent-runtime',
        external_ref: assistant.id,
        description: assistant.description || 'Knowledge-base document explainer.',
        capabilities: ['knowledge_retrieval', 'document_explanation', 'citations'],
        required_permissions: [],
        workspace_id: assistant.workspace_id,
        enabled: true,
      })
    }
    return [...scoped.values()].sort((left, right) => left.display_name.localeCompare(right.display_name))
  }, [catalog, explainerAssistants])
  const paletteItems = useMemo<PaletteItem[]>(() => {
    const seenAgentRefs = new Set<string>()
    const extras = workspaceAgents.flatMap((agent) => {
      if (seenAgentRefs.has(agent.agent_ref)) return []
      seenAgentRefs.add(agent.agent_ref)
      return [{
      kind: 'agent' as const,
      label: agent.display_name,
      description: agent.description || agent.capabilities.slice(0, 2).join(' • ') || 'Performs its registered runtime capability.',
      group: 'agents' as const,
      icon: Bot,
      config: {
        agent_ref: agent.agent_ref,
        summary: agent.description || agent.capabilities.slice(0, 2).join(' • ') || 'Performs its registered runtime capability.',
      },
      }]
    })
    const items = [...NODE_PALETTE, ...extras]
    const q = nodeQuery.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(q))
  }, [nodeQuery, workspaceAgents])
  const paletteGroups = useMemo(
    () => PALETTE_GROUP_ORDER.map((group) => ({ group, items: paletteItems.filter((item) => item.group === group) })).filter(({ items }) => items.length > 0),
    [paletteItems],
  )

  useEffect(() => {
    if (workspaceAgents.length === 0) return undefined
    const needsCatalogText = nodes.some((node) => {
      if (node.data.kind !== 'agent' && node.data.kind !== 'compose_final') return false
      const ref = node.data.config.agent_ref
      return !ref || ref === 'assistant:event-source' || !node.data.config.summary
    })
    if (!needsCatalogText) return undefined
    const frameId = window.requestAnimationFrame(() => {
      setNodes((current) => current.map((node) => {
        if (node.data.kind !== 'agent' && node.data.kind !== 'compose_final') return node
        const unbound = !node.data.config.agent_ref || node.data.config.agent_ref === 'assistant:event-source'
        const match = unbound
          ? workspaceAgents.find((agent) => agent.display_name.trim().toLowerCase() === 'vero')
          : workspaceAgents.find((agent) => agent.agent_ref === node.data.config.agent_ref)
        if (!match) return node
        if (!unbound && node.data.config.summary) return node
        const config = { ...node.data.config }
        delete config.event_source
        delete config.assistant_id
        return {
          ...node,
          data: {
            ...node.data,
            label: unbound ? match.display_name : node.data.label,
            config: {
              ...config,
              agent_ref: match.agent_ref,
              summary: match.description || match.capabilities.slice(0, 2).join(' • ') || config.summary || '',
            },
          },
        }
      }))
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [nodes, workspaceAgents, setNodes])

  useEffect(() => {
    const start = nodes.find((node) => node.data.kind === 'start' && node.data.config.trigger_type === 'assistant_unanswered')
    const sourceNode = nodes.find((node) => node.data.kind === 'agent'
      && (node.data.config.agent_ref === 'runtime:vero' || node.data.config.agent_ref.startsWith('assistant:')))
    if (!start || !sourceNode || start.data.config.assistant_id) return undefined
    const sourceName = sourceNode.data.label.trim().toLowerCase()
    const sourceAssistantId = sourceNode.data.config.agent_ref.startsWith('assistant:')
      ? sourceNode.data.config.agent_ref.slice('assistant:'.length)
      : null
    const assistant = explainerAssistants.find((item) => item.status === 'published'
      && (item.id === sourceAssistantId || item.display_name.trim().toLowerCase() === sourceName))
    if (!assistant) return undefined
    const frameId = window.requestAnimationFrame(() => {
      setNodes((current) => current.map((node) => node.id === start.id
        ? { ...node, data: { ...node.data, config: { ...node.data.config, assistant_id: assistant.id } } }
        : node,
      ))
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [explainerAssistants, nodes, setNodes])

  const onConnect = useCallback((connection: Connection) => setEdges((current) => {
    const source = nodes.find((node) => node.id === connection.source)
    const target = nodes.find((node) => node.id === connection.target)
    if (!source || !target) return current
    const issue = connectionIssue(source, target, current)
    if (issue) {
      setConnectionNotice(issue)
      return current
    }
    setConnectionNotice(null)
    const connectionWithDirection = withDirectionalHandles({ id: `edge-${Date.now()}`, ...connection }, nodes)
    if (source.data.kind === 'router' && !connection.sourceHandle) {
      const routes = ['knowledge', 'fallback']
      const sourceEdges = current.filter((edge) => edge.source === connection.source)
      const route = routes[Math.min(sourceEdges.length, routes.length - 1)]
      return addEdge({ ...connectionWithDirection, label: route }, current)
    }
    return addEdge(connectionWithDirection, current)
  }), [nodes, setEdges])

  const reload = useCallback(async () => {
    const assistantRequest = workspaceId
      ? listExplainerAssistants({ workspaceId, pageSize: 200 }).catch(() => ({ assistants: [], total: 0, page: 1, page_size: 200 }))
      : Promise.resolve({ assistants: [], total: 0, page: 1, page_size: 200 })
    const [agents, definitions, assistantResponse] = await Promise.all([
      listAgentCatalog(workspaceId ?? undefined),
      listAgentWorkflows(workspaceId ?? undefined),
      assistantRequest,
    ])
    setCatalog(agents)
    setWorkflows(definitions)
    setExplainerAssistants(assistantResponse.assistants)
  }, [workspaceId])

  const graph = useCallback(() => ({ nodes, edges }), [nodes, edges])
  const validateBeforePublish = () => {
    const start = nodes.find((node) => node.data.kind === 'start')
    if (start?.data.config.trigger_type === 'assistant_unanswered' && !start.data.config.assistant_id) {
      setSelectedId(start.id)
      setError('No published Vero assistant is available in this workspace. Open this workflow from Vero\'s workspace before publishing.')
      return false
    }
    const forwardingAction = nodes.find((node) => node.data.kind === 'action'
      && ['send_member_email', 'send_member_chat', 'send_group_chat', 'send_customer_email'].includes(node.data.config.action_code ?? '')
      && !node.data.config.target?.trim())
    if (forwardingAction) {
      setSelectedId(forwardingAction.id)
      setError('Set the recipient or destination before publishing this escalation workflow.')
      return false
    }
    return true
  }
  const createOrSave = async () => {
    setBusy(true); setError(null)
    try {
      const saved = workflowId
        ? await updateAgentWorkflow(workflowId, { name, description, definition: graph() })
        : await createAgentWorkflow({ name, description, workspace_id: workspaceId ?? null, definition: graph() })
      setWorkflowId(saved.id)
      setIsPublished(saved.is_published)
      setReviews([])
      await reload()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save workflow') } finally { setBusy(false) }
  }
  const publish = async () => {
    if (!validateBeforePublish()) return
    if (!approvedReview) {
      setError('Request a review and wait for an independent reviewer to approve it before publishing.')
      return
    }
    setBusy(true); setError(null)
    try {
      const saved = workflowId
        ? await updateAgentWorkflow(workflowId, { name, description, definition: graph() })
        : await createAgentWorkflow({ name, description, workspace_id: workspaceId ?? null, definition: graph() })
      setWorkflowId(saved.id)
      setIsPublished(saved.is_published)
      setReviews([])
      const published = await publishAgentWorkflow(saved.id)
      setIsPublished(published.is_published)
      await reload()
    }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not publish workflow'
      setError(message.includes('assistant_id')
        ? 'No published Vero assistant is available in this workspace. Open this workflow from Vero\'s workspace before publishing.'
        : message.includes('config.target')
          ? 'Set the recipient or destination before publishing this escalation workflow.'
          : message.includes('approved independent review')
            ? 'This workflow needs approval from an independent reviewer before it can be published.'
            : message)
    } finally { setBusy(false) }
  }
  const requestReview = async () => {
    if (!workflowId) { setError('Save the workflow before requesting a review.'); return }
    setBusy(true); setError(null)
    try {
      const review = await requestAgentWorkflowReview(workflowId)
      setReviews((current) => [review, ...current.filter((item) => item.status !== 'pending')])
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not request review') } finally { setBusy(false) }
  }
  const approveReview = async () => {
    if (!pendingReview) return
    setBusy(true); setError(null)
    try {
      const decided = await approveAgentWorkflowReview(pendingReview.id)
      setReviews((current) => [decided, ...current.filter((item) => item.id !== decided.id)])
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not approve workflow review'
      setError(message.includes('reviewer must be different')
        ? 'This review was requested by your account. It must be approved by a different workspace reviewer.'
        : message)
    } finally { setBusy(false) }
  }
  const testRun = async () => {
    if (!workflowId) { setError('Save the workflow before testing.'); return }
    if (!isPublished) { setError('Publish this workflow after an independent review is approved before running it.'); return }
    setBusy(true); setError(null)
    try { setRun(await runAgentWorkflow(workflowId, question)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Test run failed') } finally { setBusy(false) }
  }
  const decideAction = async (actionId: string, approved: boolean) => {
    setBusy(true); setError(null)
    try { setRun(approved ? await approveAgentWorkflowAction(actionId) : await rejectAgentWorkflowAction(actionId, 'Rejected in Agent Studio')) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not record action decision') } finally { setBusy(false) }
  }
  const openWorkflow = useCallback(async (id: string) => {
    setBusy(true); setError(null)
    try {
      const loaded = await getAgentWorkflow(id)
      setWorkflowId(loaded.id); setIsPublished(loaded.is_published); setName(loaded.name); setDescription(loaded.description)
      const loadedNodes = ((loaded.definition.nodes as AgentNode[]) ?? []).map(asCanvasNode)
      setNodes(loadedNodes)
      setEdges(((loaded.definition.edges as Edge[]) ?? []).map((edge) => withDirectionalHandles(edge, loadedNodes)))
      setRun(null)
      setReviews(await listAgentWorkflowReviews(loaded.id))
      setSidebarTab('nodes')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load workflow') } finally { setBusy(false) }
  }, [setEdges, setNodes])

  useEffect(() => {
    void reload()
      .then(async () => {
        if (initialWorkflowId) await openWorkflow(initialWorkflowId)
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load Agent Studio'))
  }, [initialWorkflowId, openWorkflow, reload])

  useEffect(() => {
    if (!onClose) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const addNode = (kind: AgentNodeKind, label: string, config: Record<string, string> = {}, position?: { x: number; y: number }) => {
    if (kind === 'start') {
      const existing = nodes.find((node) => node.data.kind === 'start')
      if (existing) {
        setSelectedId(existing.id)
        return
      }
    }
    const id = `${kind}-${Date.now()}`
    const next: AgentNode = asCanvasNode({
      id,
      position: position ?? { x: 80 + (nodes.length % 3) * 280, y: 80 + Math.floor(nodes.length / 3) * 140 },
      data: { kind, label, config },
    }, nodes.length)
    setNodes((current) => [...current, next])
    setSelectedId(id)
    setSidebarTab('nodes')
  }

  const updateSelected = (patch: Partial<AgentNodeData>) => {
    if (!selectedId) return
    setNodes((current) => current.map((node) => node.id === selectedId ? { ...node, data: { ...node.data, ...patch } } : node))
  }

  const handlePaletteDragStart = (event: DragEvent<HTMLButtonElement>, item: (typeof paletteItems)[number]) => {
    event.dataTransfer.setData(AGENT_PALETTE_MIME, JSON.stringify(item))
    event.dataTransfer.effectAllowed = 'copy'
  }

  const tabs: Array<{ id: StudioTab; label: string; icon: typeof Layers }> = [
    { id: 'nodes', label: 'Nodes', icon: Layers },
  ]

  const syncEdgeDirections = useCallback((currentNodes: AgentNode[]) => {
    setEdges((currentEdges) => currentEdges.map((edge) => withDirectionalHandles(edge, currentNodes)))
  }, [setEdges])

  useEffect(() => {
    syncEdgeDirections(nodes)
  }, [nodes, syncEdgeDirections])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200/80 px-4 py-2.5 lg:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <Workflow className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label="Workflow name"
              className="h-8 border-0 bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
            />
          </div>
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-label="Workflow description"
            className="h-6 max-w-2xl border-0 bg-transparent px-0 text-[11px] leading-snug text-muted-foreground shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 pt-0.5">
          <Badge variant="outline" className="h-7 max-w-48 truncate rounded-md px-2 text-[10px] font-medium shadow-none">
            <ShieldCheck className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden />
            {isPublished ? 'Published' : approvedReview ? 'Review approved' : pendingReview ? 'Review pending' : 'Draft'}
          </Badge>
          <Button type="button" variant="outline" className={cn(enterpriseSecondaryButtonClass(), 'h-9 px-3 text-xs')} onClick={() => void createOrSave()} disabled={busy}>
            <Save className="h-4 w-4" aria-hidden /> Save
          </Button>
          {!isPublished && !pendingReview && !approvedReview ? (
            <Button type="button" variant="outline" className={cn(enterpriseSecondaryButtonClass(), 'h-9 px-3 text-xs')} onClick={() => void requestReview()} disabled={busy || !workflowId}>
              <ShieldCheck className="h-4 w-4" aria-hidden /> Request review
            </Button>
          ) : null}
          {pendingReview && !isReviewAuthor ? (
            <Button type="button" variant="outline" className={cn(enterpriseSecondaryButtonClass(), 'h-9 px-3 text-xs')} onClick={() => void approveReview()} disabled={busy} title="Requires an independent reviewer">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Approve review
            </Button>
          ) : null}
          <Button type="button" className={cn(enterprisePrimarySolidButtonClass(), 'h-9 rounded-md bg-[#0b5fd7] px-3 text-xs hover:bg-[#094fad]')} onClick={() => void publish()} disabled={busy || isPublished || !approvedReview} title={approvedReview ? 'Publish approved workflow' : 'An independent review approval is required'}>
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Publish
          </Button>
          {onClose ? (
            <button
              type="button"
              aria-label="Exit Agent Workflow fullscreen"
              title="Exit fullscreen (Esc)"
              onClick={onClose}
              className={cn(
                'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition',
                enterpriseControlFocusClass(),
                'bg-foreground text-background hover:bg-foreground/90 hover:text-background',
              )}
            >
              <Minimize2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden bg-[#f7f9fc]">
          <ReactFlow
            className="h-full w-full"
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => { setSelectedId(node.id); setSidebarTab('nodes') }}
            onPaneClick={() => setSelectedId(null)}
            connectionMode={ConnectionMode.Loose}
            fitView
            fitViewOptions={{ padding: 0.12, minZoom: 0.55 }}
            minZoom={0.55}
            maxZoom={1.4}
            defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
            proOptions={{ hideAttribution: true }}
            onDrop={(event) => {
              event.preventDefault()
              const raw = event.dataTransfer.getData(AGENT_PALETTE_MIME)
              if (!raw) return
              const item = JSON.parse(raw) as PaletteItem
              const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
              addNode(item.kind, item.label, item.config ?? {}, {
                x: event.clientX - bounds.left - NODE_WIDTH / 2,
                y: event.clientY - bounds.top - NODE_HEIGHT / 2,
              })
            }}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
            }}
          >
            <svg className="pointer-events-none absolute h-0 w-0" aria-hidden>
              <defs>
                <filter id="agent-workflow-edge-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3.5" />
                </filter>
              </defs>
            </svg>
            <CanvasViewportGrid />
            <CanvasViewportRulers />
            {connectionNotice ? (
              <div className="pointer-events-none absolute left-1/2 top-3 z-30 max-w-xl -translate-x-1/2 rounded-xl border border-rose-200 bg-white/95 px-3 py-2 text-center text-xs leading-relaxed text-rose-700 shadow-sm">
                {connectionNotice}
              </div>
            ) : null}
            <MiniMap zoomable pannable nodeColor={minimapColor} maskColor="rgba(15, 23, 42, 0.08)" className="!border !border-slate-200 !bg-white/95" />
            <Controls
              showInteractive
              className="canvas-flow-controls"
              position="bottom-left"
              style={{
                left: (panelCollapsed ? 140 : 400) + STUDIO_PANEL_INSET_PX + 8,
                bottom: 8,
                zIndex: 40,
              }}
            />
          </ReactFlow>
        </div>

        <div
          className="pointer-events-none absolute z-20"
          style={{
            left: STUDIO_PANEL_INSET_PX,
            top: STUDIO_PANEL_INSET_PX,
            width: panelCollapsed ? 140 : 400,
            height: panelCollapsed ? 44 : `calc(100% - ${STUDIO_PANEL_INSET_PX * 2}px)`,
          }}
        >
          <aside className="pointer-events-auto relative flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border liquid-glass-enterprise-panel">
            <div className="relative flex shrink-0 border-b border-white/35 bg-white/15">
              <div className="flex shrink-0 items-center border-r border-white/25 px-2">
                <GripVertical className="h-4 w-4 text-slate-500" />
              </div>
              {panelCollapsed ? (
                <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-semibold text-slate-700">Menu</span>
              ) : (
                tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors',
                        sidebarTab === tab.id ? 'border-slate-900/80 text-slate-900' : 'border-transparent text-slate-600 hover:text-slate-800',
                      )}
                      onClick={() => setSidebarTab(tab.id)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  )
                })
              )}
              <button
                type="button"
                className="ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center text-slate-500 transition hover:bg-white/25 hover:text-slate-800"
                onClick={() => setPanelCollapsed((current) => !current)}
                aria-label={panelCollapsed ? 'Expand studio panel' : 'Collapse studio panel'}
              >
                {panelCollapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
              </button>
            </div>

            {!panelCollapsed ? (
              <div className="enterprise-popover-scroll min-h-0 flex-1 overflow-y-auto p-1.5">
                {sidebarTab === 'nodes' ? (
                  <>
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Workflow building blocks</p>
                    <p className="mb-1.5 text-[10px] leading-4 text-slate-500">Drag a node to the canvas, then connect it to define the execution path.</p>
                    <label className="relative mb-1.5 block">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
                      <input
                        value={nodeQuery}
                        onChange={(event) => setNodeQuery(event.target.value)}
                        placeholder="Search nodes"
                        className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-[11px] text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      />
                    </label>
                    <div className="space-y-3">
                      {paletteGroups.map(({ group, items }) => (
                        <section key={group} aria-label={PALETTE_GROUP_META[group].label}>
                          <div className="mb-1.5 border-b border-slate-200/80 px-1 pb-1">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{PALETTE_GROUP_META[group].label}</p>
                            <p className="mt-0.5 text-[9px] leading-3 text-slate-400">{PALETTE_GROUP_META[group].description}</p>
                          </div>
                          <div className="space-y-1">
                            {items.map((item) => {
                              const Icon = KIND_META[item.kind].icon
                              const visual = KIND_META[item.kind]
                              return (
                                <button
                                  key={`${item.kind}-${item.config?.agent_ref ?? item.label}`}
                                  type="button"
                                  draggable
                                  title={`Drag ${item.label} to canvas`}
                                  aria-label={`${item.label}: ${item.description}`}
                                  onDragStart={(event) => handlePaletteDragStart(event, item)}
                                  onClick={() => addNode(item.kind, item.label, item.config ?? {})}
                                  className="flex w-full cursor-grab items-start gap-2 rounded-xl border border-transparent px-2 py-2 text-left transition hover:border-sky-200 hover:bg-sky-50/80 active:cursor-grabbing"
                                >
                                  <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm', visual.iconClass)}>
                                    <Icon className="h-4 w-4" strokeWidth={2.25} />
                                  </div>
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-[11px] font-semibold leading-4 text-slate-800">{item.label}</span>
                                    <span className="mt-0.5 block text-[10px] leading-3.5 text-slate-500">{item.description}</span>
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </section>
                      ))}
                      {paletteItems.length === 0 ? <p className="px-2 py-6 text-center text-[11px] text-slate-500">No nodes found.</p> : null}
                    </div>
                  </>
                ) : null}

                {sidebarTab === 'workflows' ? (
                  <>
                    <div className="mb-1.5 flex items-center justify-between px-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Agent workflows</p>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="New workflow" onClick={() => { setWorkflowId(null); setIsPublished(false); setReviews([]); setNodes(initialNodes); setEdges(initialEdges); setRun(null); setName('Untitled Agent Workflow'); setDescription('') }}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {workflows.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => void openWorkflow(item.id)}
                          className={cn(
                            'w-full rounded-md border px-2 py-2 text-left text-xs',
                            workflowId === item.id ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-transparent hover:bg-white',
                          )}
                        >
                          <div className="truncate font-medium">{item.name}</div>
                          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                            <span>v{item.version}</span>
                            <span>{item.is_published ? 'Published' : 'Draft'}</span>
                          </div>
                        </button>
                      ))}
                      {workflows.length === 0 ? <p className="px-2 py-6 text-center text-[11px] text-slate-500">No saved agent workflows yet.</p> : null}
                    </div>
                  </>
                ) : null}

                {sidebarTab === 'inspector' ? (
                  <div className="space-y-3 px-1 py-1">
                    {selected ? (
                      <>
                        <Badge variant="outline">{KIND_META[selected.data.kind].chip}</Badge>
                        <Input value={selected.data.label} onChange={(event) => updateSelected({ label: event.target.value })} aria-label="Node label" />
                        {selected.data.kind === 'agent' || selected.data.kind === 'compose_final' ? (
                          <p className="text-xs leading-relaxed text-slate-500">This node is already bound to {selected.data.label}. Drop another agent from Nodes to change it.</p>
                        ) : selected.data.kind === 'router' ? (
                          <>
                            <label className="block text-[11px] font-medium text-slate-600">Knowledge keywords</label>
                            <Input value={(() => { try { return JSON.parse(selected.data.config.route_rules ?? '{}').knowledge?.join(', ') ?? '' } catch { return '' } })()} onChange={(event) => updateSelected({ config: { ...selected.data.config, route_rules: JSON.stringify({ knowledge: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) }) } })} placeholder="policy, SOP, document" />
                            <p className="text-[11px] leading-relaxed text-slate-500">First router edge is <b>knowledge</b>; second is <b>fallback</b>.</p>
                          </>
                        ) : selected.data.kind === 'evidence_validator' ? (
                          <>
                            <label className="block text-[11px] font-medium text-slate-600">Allowed source services</label>
                            <Input value={selected.data.config.allowed_sources ?? ''} onChange={(event) => updateSelected({ config: { ...selected.data.config, allowed_sources: event.target.value } })} placeholder="document-knowledge, knowledge-index" />
                          </>
                        ) : selected.data.kind === 'action' ? (
                          <>
                            <label className="block text-[11px] font-medium text-slate-600">Request title</label>
                            <Input value={selected.data.config.title ?? ''} onChange={(event) => updateSelected({ config: { ...selected.data.config, title: event.target.value } })} placeholder="Use test message when blank" />
                            <label className="block text-[11px] font-medium text-slate-600">Priority</label>
                            <select value={selected.data.config.priority ?? 'medium'} onChange={(event) => updateSelected({ config: { ...selected.data.config, priority: event.target.value } })} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs">
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="critical">Critical</option>
                            </select>
                          </>
                        ) : (
                          <p className="text-xs leading-relaxed text-slate-500">{kindDescription(selected.data)}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-slate-500">Select a node to configure it.</p>
                    )}
                    <div className="border-t border-slate-200 pt-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-800"><FileSearch className="h-3.5 w-3.5" /> Test run</div>
                      <textarea value={question} onChange={(event) => setQuestion(event.target.value)} className="mt-2 min-h-20 w-full resize-y rounded-md border border-slate-200 p-2 text-xs" />
                      <Button size="sm" className="mt-2 w-full" onClick={() => void testRun()} disabled={busy || !isPublished} title={isPublished ? 'Run workflow' : 'Publish the workflow before running it'}><Play className="mr-1.5 h-3.5 w-3.5" /> Run workflow</Button>
                      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
                      {run ? (
                        <div className="mt-3 space-y-2 text-xs">
                          <Badge variant={run.status === 'completed' ? 'default' : run.status === 'waiting_approval' ? 'outline' : 'destructive'}>{run.status}</Badge>
                          <p className="whitespace-pre-wrap leading-relaxed text-slate-700">{run.output?.answer || (run.status === 'waiting_approval' ? 'Operational action is waiting for approval.' : 'No answer returned.')}</p>
                          {run.actions.filter((action) => action.status === 'pending_approval').map((action) => (
                            <div key={action.id} className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-2">
                              <p className="font-medium text-amber-900">Vena requests approval to create a {String(action.payload.priority ?? 'medium')} service request.</p>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => void decideAction(action.id, true)} disabled={busy}>Approve</Button>
                                <Button size="sm" variant="outline" onClick={() => void decideAction(action.id, false)} disabled={busy}>Reject</Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </aside>
        </div>

        <aside className="pointer-events-auto absolute right-[30px] top-[30px] z-20 flex max-h-[calc(100%-60px)] w-[318px] flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/82 shadow-[0_18px_48px_rgba(15,23,42,0.16)] backdrop-blur-xl">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <FileSearch className="h-4 w-4 text-slate-500" /> Inspector
            </div>
            {selected ? <Badge variant="outline" className="text-[10px]">{KIND_META[selected.data.kind].chip}</Badge> : null}
          </div>
          <div className="enterprise-popover-scroll min-h-0 flex-1 overflow-y-auto p-3">
            {selected ? (
              <div className="space-y-3">
                <Input className="h-10 rounded-xl px-3 text-sm" value={selected.data.label} onChange={(event) => updateSelected({ label: event.target.value })} aria-label="Node label" />
                <p className="text-[11px] leading-relaxed text-slate-500">
                  {NEXT_KINDS[selected.data.kind].length > 0
                    ? `Can connect to ${NEXT_KINDS[selected.data.kind].map((kind) => KIND_LABEL[kind]).join(', ')}.`
                    : 'This node ends the flow and cannot connect onward.'}
                </p>
                {selected.data.kind === 'start' ? (
                  <>
                    <label className="block text-[11px] font-medium text-slate-600">Start event</label>
                    <select value={selected.data.config.trigger_type ?? 'manual'} onChange={(event) => updateSelected({ config: { trigger_type: event.target.value } })} className={INSPECTOR_CONTROL_CLASS}>
                      <option value="manual">Manual run</option>
                      <option value="assistant_unanswered">No matching document evidence</option>
                    </select>
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      {selected.data.config.trigger_type === 'assistant_unanswered'
                        ? 'Start only records when this workflow fires. Drop the agent that should handle the event from Nodes.'
                        : 'Start only records that someone runs this workflow. The next node is the agent dropped from Nodes.'}
                    </p>
                  </>
                ) : selected.data.kind === 'agent' || selected.data.kind === 'compose_final' ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Bound from Nodes</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {workspaceAgents.find((agent) => agent.agent_ref === selected.data.config.agent_ref)?.display_name || selected.data.label}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{kindDescription(selected.data)}</p>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-500">This node is that agent. Drop another agent from Nodes to use a different one.</p>
                  </div>
                ) : selected.data.kind === 'router' ? (
                  <>
                    <label className="block text-[11px] font-medium text-slate-600">Knowledge keywords</label>
                    <Input className="h-10 rounded-xl px-3 text-sm" value={(() => { try { return JSON.parse(selected.data.config.route_rules ?? '{}').knowledge?.join(', ') ?? '' } catch { return '' } })()} onChange={(event) => updateSelected({ config: { ...selected.data.config, route_rules: JSON.stringify({ knowledge: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) }) } })} placeholder="policy, SOP, document" />
                  </>
                ) : selected.data.kind === 'evidence_validator' ? (
                  <>
                    <label className="block text-[11px] font-medium text-slate-600">Allowed source services</label>
                    <Input className="h-10 rounded-xl px-3 text-sm" value={selected.data.config.allowed_sources ?? ''} onChange={(event) => updateSelected({ config: { ...selected.data.config, allowed_sources: event.target.value } })} placeholder="document-knowledge, knowledge-index" />
                  </>
                ) : selected.data.kind === 'action' ? (
                  <>
                    <label className="block text-[11px] font-medium text-slate-600">Escalation action</label>
                    <select value={selected.data.config.action_code ?? 'create_service_request'} onChange={(event) => updateSelected({ config: { ...selected.data.config, action_code: event.target.value } })} className={INSPECTOR_CONTROL_CLASS}>
                      <option value="create_service_request">Create service request</option>
                      <option value="send_member_email">Send member email</option>
                      <option value="send_member_chat">Send member chat</option>
                      <option value="send_group_chat">Send group chat</option>
                      <option value="send_customer_email">Send customer email</option>
                    </select>
                    {selected.data.config.action_code !== 'create_service_request' ? (
                      <>
                        <label className="block text-[11px] font-medium text-slate-600">Recipient / destination</label>
                        <Input className="h-10 rounded-xl px-3 text-sm" value={selected.data.config.target ?? ''} onChange={(event) => updateSelected({ config: { ...selected.data.config, target: event.target.value } })} placeholder="Member ID, group ID, or email address" />
                      </>
                    ) : null}
                    <label className="block text-[11px] font-medium text-slate-600">Request title</label>
                    <Input className="h-10 rounded-xl px-3 text-sm" value={selected.data.config.title ?? ''} onChange={(event) => updateSelected({ config: { ...selected.data.config, title: event.target.value } })} placeholder="Use test message when blank" />
                    <label className="block text-[11px] font-medium text-slate-600">Priority</label>
                    <select value={selected.data.config.priority ?? 'medium'} onChange={(event) => updateSelected({ config: { ...selected.data.config, priority: event.target.value } })} className={INSPECTOR_CONTROL_CLASS}>
                      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                    </select>
                  </>
                ) : <p className="text-xs leading-relaxed text-slate-500">{kindDescription(selected.data)}</p>}
              </div>
            ) : <p className="py-4 text-center text-xs text-slate-500">Select a node to configure it.</p>}
            <div className="mt-4 border-t border-slate-200 pt-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800"><Play className="h-3.5 w-3.5" /> Test run</div>
              <textarea value={question} onChange={(event) => setQuestion(event.target.value)} className={INSPECTOR_TEXTAREA_CLASS} />
              <Button className={cn(enterprisePrimarySolidButtonClass(), 'mt-3 h-10 w-full rounded-xl px-4 text-sm')} onClick={() => void testRun()} disabled={busy || !isPublished} title={isPublished ? 'Run workflow' : 'Publish the workflow before running it'}><Play className="mr-2 h-4 w-4" /> Run workflow</Button>
              {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
              {run ? (
                <div className="mt-3 space-y-2 text-xs">
                  <Badge variant={run.status === 'completed' ? 'default' : run.status === 'waiting_approval' ? 'outline' : 'destructive'}>{run.status}</Badge>
                  <p className="whitespace-pre-wrap leading-relaxed text-slate-700">{run.output?.answer || (run.status === 'waiting_approval' ? 'Operational action is waiting for approval.' : 'No answer returned.')}</p>
                  {run.actions.filter((action) => action.status === 'pending_approval').map((action) => (
                    <div key={action.id} className="space-y-2 rounded-md border border-amber-200 bg-amber-50/85 p-2">
                      <p className="font-medium text-amber-900">Vena requests approval to create a {String(action.payload.priority ?? 'medium')} service request.</p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => void decideAction(action.id, true)} disabled={busy}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => void decideAction(action.id, false)} disabled={busy}>Reject</Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export function AgentWorkflowStudio({
  workspaceId,
  initialWorkflowId,
  onClose,
}: {
  workspaceId?: string | null
  initialWorkflowId?: string | null
  onClose?: () => void
}) {
  return (
    <ReactFlowProvider>
      <AgentWorkflowStudioInner workspaceId={workspaceId} initialWorkflowId={initialWorkflowId} onClose={onClose} />
    </ReactFlowProvider>
  )
}
