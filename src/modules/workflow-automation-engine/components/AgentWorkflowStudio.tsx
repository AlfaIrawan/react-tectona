import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactFlow, { addEdge, Background, Controls, type Connection, type Edge, type Node, ReactFlowProvider, useEdgesState, useNodesState } from 'reactflow'
import 'reactflow/dist/style.css'
import { Bot, CheckCircle2, FileSearch, GitBranch, Play, Plus, Save, ShieldCheck, Sparkles, Split, Stamp, TicketCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  createAgentWorkflow,
  approveAgentWorkflowAction,
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

type AgentNodeData = { kind: 'start' | 'agent' | 'router' | 'parallel' | 'evidence_validator' | 'compose_final' | 'approval' | 'action'; label: string; config: Record<string, string> }
type AgentNode = Node<AgentNodeData>

const initialNodes: AgentNode[] = [
  { id: 'start', position: { x: 300, y: 20 }, data: { kind: 'start', label: 'Start', config: {} } },
  { id: 'vero', position: { x: 300, y: 150 }, data: { kind: 'agent', label: 'Vero: Knowledge retrieval', config: { agent_ref: 'runtime:vero' } } },
  { id: 'evidence', position: { x: 300, y: 290 }, data: { kind: 'evidence_validator', label: 'Validate evidence', config: {} } },
  { id: 'final', position: { x: 300, y: 430 }, data: { kind: 'compose_final', label: 'Smith: Compose final', config: { agent_ref: 'builtin:smith' } } },
]
const initialEdges: Edge[] = [
  { id: 'start-vero', source: 'start', target: 'vero' },
  { id: 'vero-evidence', source: 'vero', target: 'evidence' },
  { id: 'evidence-final', source: 'evidence', target: 'final' },
]

function AgentWorkflowStudioInner({ workspaceId }: { workspaceId?: string | null }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<AgentNodeData>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [catalog, setCatalog] = useState<AgentCatalogEntryDto[]>([])
  const [workflows, setWorkflows] = useState<AgentWorkflowSummaryDto[]>([])
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [name, setName] = useState('Credit Policy Knowledge Assistant')
  const [description, setDescription] = useState('Routes document questions to Vero, validates evidence, then composes a grounded answer.')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [question, setQuestion] = useState('Apa ketentuan PH Maks untuk UMCY?')
  const [run, setRun] = useState<AgentWorkflowRunDto | null>(null)
  const [reviews, setReviews] = useState<AgentWorkflowReviewDto[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = useMemo(() => nodes.find((node) => node.id === selectedId) ?? null, [nodes, selectedId])
  const onConnect = useCallback((connection: Connection) => setEdges((current) => {
    const source = nodes.find((node) => node.id === connection.source)
    if (source?.data.kind === 'router' && !connection.sourceHandle) {
      const routes = ['knowledge', 'fallback']
      const sourceEdges = current.filter((edge) => edge.source === connection.source)
      const route = routes[Math.min(sourceEdges.length, routes.length - 1)]
      return addEdge({ ...connection, label: route }, current)
    }
    return addEdge(connection, current)
  }), [nodes, setEdges])

  const reload = useCallback(async () => {
    const [agents, definitions] = await Promise.all([listAgentCatalog(workspaceId ?? undefined), listAgentWorkflows(workspaceId ?? undefined)])
    setCatalog(agents)
    setWorkflows(definitions)
  }, [workspaceId])

  useEffect(() => { void reload().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load Agent Studio')) }, [reload])

  const graph = useCallback(() => ({ nodes, edges }), [nodes, edges])
  const createOrSave = async () => {
    setBusy(true); setError(null)
    try {
      const saved = workflowId
        ? await updateAgentWorkflow(workflowId, { name, description, definition: graph() })
        : await createAgentWorkflow({ name, description, workspace_id: workspaceId ?? null, definition: graph() })
      setWorkflowId(saved.id)
      setReviews([])
      await reload()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save workflow') } finally { setBusy(false) }
  }
  const publish = async () => {
    setBusy(true); setError(null)
    try {
      const saved = workflowId
        ? await updateAgentWorkflow(workflowId, { name, description, definition: graph() })
        : await createAgentWorkflow({ name, description, workspace_id: workspaceId ?? null, definition: graph() })
      setWorkflowId(saved.id)
      setReviews([])
      await publishAgentWorkflow(saved.id)
      await reload()
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not publish workflow') } finally { setBusy(false) }
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
  const testRun = async () => {
    if (!workflowId) { setError('Save and publish the workflow before testing.'); return }
    setBusy(true); setError(null)
    try { setRun(await runAgentWorkflow(workflowId, question)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Test run failed') } finally { setBusy(false) }
  }
  const decideAction = async (actionId: string, approved: boolean) => {
    setBusy(true); setError(null)
    try { setRun(approved ? await approveAgentWorkflowAction(actionId) : await rejectAgentWorkflowAction(actionId, 'Rejected in Agent Studio')) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not record action decision') } finally { setBusy(false) }
  }
  const openWorkflow = async (id: string) => {
    setBusy(true); setError(null)
    try {
      const loaded = await getAgentWorkflow(id)
      setWorkflowId(loaded.id); setName(loaded.name); setDescription(loaded.description)
      setNodes((loaded.definition.nodes as AgentNode[]) ?? []); setEdges((loaded.definition.edges as Edge[]) ?? []); setRun(null)
      setReviews(await listAgentWorkflowReviews(loaded.id))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load workflow') } finally { setBusy(false) }
  }
  const addNode = (kind: AgentNodeData['kind'], label: string, config: Record<string, string> = {}) => {
    const id = `${kind}-${Date.now()}`
    setNodes((current) => [...current, { id, position: { x: 70 + (current.length % 3) * 260, y: 570 + Math.floor(current.length / 3) * 130 }, data: { kind, label, config } }])
    setSelectedId(id)
  }
  const updateSelected = (patch: Partial<AgentNodeData>) => {
    if (!selectedId) return
    setNodes((current) => current.map((node) => node.id === selectedId ? { ...node, data: { ...node.data, ...patch } } : node))
  }

  return <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)_280px] gap-3 overflow-hidden">
    <aside className="min-h-0 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-800">Agent workflows</span><Button size="icon" variant="ghost" className="h-7 w-7" title="New workflow" onClick={() => { setWorkflowId(null); setNodes(initialNodes); setEdges(initialEdges); setRun(null) }}><Plus className="h-4 w-4" /></Button></div>
      <div className="mt-3 space-y-1">{workflows.map((item) => <button key={item.id} type="button" onClick={() => void openWorkflow(item.id)} className={cn('w-full rounded-md border px-2 py-2 text-left text-xs', workflowId === item.id ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-transparent hover:bg-white')}><div className="truncate font-medium">{item.name}</div><div className="mt-1 flex items-center justify-between text-[10px] text-slate-500"><span>v{item.version}</span><span>{item.is_published ? 'Published' : 'Draft'}</span></div></button>)}</div>
      <div className="mt-5 border-t border-slate-200 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nodes</div>
      <div className="mt-2 space-y-1">
        <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => addNode('router', 'Route intent', { route_rules: '{"knowledge":["policy","ketentuan","sop","dokumen"]}', fallback_route: 'fallback' })}><GitBranch className="mr-2 h-3.5 w-3.5" /> Router</Button>
        <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => addNode('parallel', 'Delegate in parallel')}><Split className="mr-2 h-3.5 w-3.5" /> Parallel delegation</Button>
        <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => addNode('evidence_validator', 'Validate evidence')}><ShieldCheck className="mr-2 h-3.5 w-3.5" /> Evidence validator</Button>
        <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => addNode('compose_final', 'Smith: Compose final', { agent_ref: 'builtin:smith' })}><Sparkles className="mr-2 h-3.5 w-3.5" /> Final response</Button>
        <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => addNode('approval', 'Approval required')}><Stamp className="mr-2 h-3.5 w-3.5" /> Approval</Button>
        <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => addNode('action', 'Vena: Create service request', { agent_ref: 'runtime:vena', action_code: 'create_service_request', priority: 'medium' })}><TicketCheck className="mr-2 h-3.5 w-3.5" /> Vena service request</Button>
        {catalog.filter((agent) => agent.runtime === 'tectona-agent-runtime').map((agent) => <Button key={agent.agent_ref} size="sm" variant="outline" className="w-full justify-start" onClick={() => addNode('agent', `${agent.display_name}: Agent`, { agent_ref: agent.agent_ref })}><Bot className="mr-2 h-3.5 w-3.5" /> {agent.display_name}</Button>)}
      </div>
    </aside>
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
        <Input value={name} onChange={(event) => setName(event.target.value)} className="h-8 min-w-48 flex-1 text-sm font-medium" aria-label="Workflow name" />
        <Button size="sm" variant="outline" onClick={() => void createOrSave()} disabled={busy}><Save className="mr-1.5 h-3.5 w-3.5" /> Save</Button>
        <Button size="sm" variant="outline" onClick={() => void requestReview()} disabled={busy || !workflowId}><ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Request review</Button>
        <Button size="sm" onClick={() => void publish()} disabled={busy}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Publish</Button>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500"><Input value={description} onChange={(event) => setDescription(event.target.value)} className="h-7 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" aria-label="Workflow description" />{reviews[0] ? <Badge variant="outline">Review: {reviews[0].status}</Badge> : <Badge variant="outline">Review required</Badge>}</div>
      <div className="min-h-[460px] flex-1 border-t border-slate-100"><ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={(_, node) => setSelectedId(node.id)} fitView><Background gap={18} size={1} /><Controls showInteractive={false} /></ReactFlow></div>
    </section>
    <aside className="min-h-0 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs font-semibold text-slate-800">Inspector</div>
      {selected ? <div className="mt-3 space-y-3"><Badge variant="outline">{selected.data.kind}</Badge><Input value={selected.data.label} onChange={(event) => updateSelected({ label: event.target.value })} aria-label="Node label" />
        {selected.data.kind === 'agent' || selected.data.kind === 'compose_final' ? <>
          <select value={selected.data.config.agent_ref ?? ''} onChange={(event) => updateSelected({ config: { ...selected.data.config, agent_ref: event.target.value } })} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"><option value="">Select agent</option>{catalog.filter((agent) => agent.runtime === 'tectona-agent-runtime').map((agent) => <option key={agent.agent_ref} value={agent.agent_ref}>{agent.display_name} ({agent.agent_ref})</option>)}</select>
          {selected.data.kind === 'agent' ? <select value={selected.data.config.fallback_agent_ref ?? ''} onChange={(event) => updateSelected({ config: { ...selected.data.config, fallback_agent_ref: event.target.value } })} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"><option value="">No fallback agent</option>{catalog.filter((agent) => agent.runtime === 'tectona-agent-runtime' && agent.agent_ref !== selected.data.config.agent_ref).map((agent) => <option key={agent.agent_ref} value={agent.agent_ref}>Fallback: {agent.display_name}</option>)}</select> : null}
        </> : selected.data.kind === 'router' ? <><label className="block text-[11px] font-medium text-slate-600">Knowledge keywords</label><Input value={(() => { try { return JSON.parse(selected.data.config.route_rules ?? '{}').knowledge?.join(', ') ?? '' } catch { return '' } })()} onChange={(event) => updateSelected({ config: { ...selected.data.config, route_rules: JSON.stringify({ knowledge: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) }) } })} placeholder="policy, SOP, document" /><p className="text-[11px] leading-relaxed text-slate-500">First router edge is <b>knowledge</b>; second is <b>fallback</b>.</p></> : selected.data.kind === 'evidence_validator' ? <><label className="block text-[11px] font-medium text-slate-600">Allowed source services</label><Input value={selected.data.config.allowed_sources ?? ''} onChange={(event) => updateSelected({ config: { ...selected.data.config, allowed_sources: event.target.value } })} placeholder="document-knowledge, knowledge-index" /><p className="text-[11px] leading-relaxed text-slate-500">Other evidence is removed before final composition.</p></> : selected.data.kind === 'action' ? <><Badge variant="outline">Vena only</Badge><label className="block text-[11px] font-medium text-slate-600">Request title</label><Input value={selected.data.config.title ?? ''} onChange={(event) => updateSelected({ config: { ...selected.data.config, title: event.target.value } })} placeholder="Use test message when blank" /><label className="block text-[11px] font-medium text-slate-600">Priority</label><select value={selected.data.config.priority ?? 'medium'} onChange={(event) => updateSelected({ config: { ...selected.data.config, priority: event.target.value } })} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select><p className="text-[11px] leading-relaxed text-slate-500">Must follow an Approval node. The request is durable and idempotent.</p></> : <p className="text-xs leading-relaxed text-slate-500">{selected.data.kind === 'parallel' ? 'Connect two or more agent nodes, then connect each agent to the same merge node.' : selected.data.kind === 'approval' ? 'Connect this node directly to a Vena action. A user decision is required before it runs.' : 'Entry point for this workflow.'}</p>}
      </div> : <p className="mt-3 text-xs text-slate-500">Select a node to configure it.</p>}
      <div className="mt-6 border-t border-slate-200 pt-3"><div className="flex items-center gap-2 text-xs font-semibold text-slate-800"><FileSearch className="h-3.5 w-3.5" /> Test run</div><textarea value={question} onChange={(event) => setQuestion(event.target.value)} className="mt-2 min-h-20 w-full resize-y rounded-md border border-slate-200 p-2 text-xs" /><Button size="sm" className="mt-2 w-full" onClick={() => void testRun()} disabled={busy}><Play className="mr-1.5 h-3.5 w-3.5" /> Run workflow</Button>
        {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
        {run ? <div className="mt-3 space-y-2 text-xs"><Badge variant={run.status === 'completed' ? 'default' : run.status === 'waiting_approval' ? 'outline' : 'destructive'}>{run.status}</Badge><p className="whitespace-pre-wrap leading-relaxed text-slate-700">{run.output?.answer || (run.status === 'waiting_approval' ? 'Operational action is waiting for approval.' : 'No answer returned.')}</p><p className="text-[11px] text-slate-500">{run.output?.evidence?.length ?? 0} evidence item(s) retained</p>{run.output?.warnings?.map((warning) => <p key={warning} className="text-amber-700">{warning}</p>)}{run.actions.filter((action) => action.status === 'pending_approval').map((action) => <div key={action.id} className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-2"><p className="font-medium text-amber-900">Vena requests approval to create a {action.payload.priority ?? 'medium'} service request.</p><p className="text-amber-800">{String(action.payload.title ?? '')}</p><div className="flex gap-2"><Button size="sm" onClick={() => void decideAction(action.id, true)} disabled={busy}>Approve</Button><Button size="sm" variant="outline" onClick={() => void decideAction(action.id, false)} disabled={busy}>Reject</Button></div></div>)}<div className="border-t border-slate-100 pt-2 text-[11px] text-slate-500">{run.steps.map((step) => <div key={step.id} className="mb-1 flex justify-between gap-2"><span className="truncate">{step.node_id}{step.agent_ref ? ` / ${step.agent_ref}` : ''}</span><span>{step.output.next_route ? `route:${String(step.output.next_route)}` : step.status}</span></div>)}</div></div> : null}
      </div>
    </aside>
  </div>
}

export function AgentWorkflowStudio({ workspaceId }: { workspaceId?: string | null }) {
  return <ReactFlowProvider><AgentWorkflowStudioInner workspaceId={workspaceId} /></ReactFlowProvider>
}
