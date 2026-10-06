import {
  getWorkflow,
  listWorkflowApprovals,
  listWorkflows,
  type WorkflowApprovalDto,
  type WorkflowGraph,
} from '@/lib/api/workflowAutomationApi'

export const WORKFLOW_DOCUMENT_KINDS = ['URD', 'BRD', 'FSD'] as const
export type WorkflowDocumentKind = (typeof WORKFLOW_DOCUMENT_KINDS)[number]

export type IdeaDocumentWorkflowGate = {
  /** True only while a published, active workflow still generates these documents. */
  enforced: boolean
  /** Kinds the current run has unlocked. Null means every template stays available. */
  allowedKinds: WorkflowDocumentKind[] | null
}

type GraphNode = {
  id: string
  data?: {
    kind?: string
    label?: string
    disabled?: boolean
    config?: Record<string, string>
  }
}

type GraphEdge = {
  source: string
  target: string
  sourceHandle?: string | null
}

export type DocumentStage = {
  kind: WorkflowDocumentKind
  requiredApprovalIds: string[]
}

function asNodes(graph: WorkflowGraph): GraphNode[] {
  return (graph.nodes ?? []).filter((node): node is GraphNode => {
    return Boolean(node && typeof node === 'object' && typeof (node as GraphNode).id === 'string')
  })
}

function asEdges(graph: WorkflowGraph): GraphEdge[] {
  return (graph.edges ?? []).filter((edge): edge is GraphEdge => {
    const row = edge as GraphEdge
    return Boolean(row && typeof row.source === 'string' && typeof row.target === 'string')
  })
}

function isSuccessEdge(edge: GraphEdge): boolean {
  const handle = (edge.sourceHandle || 'out').trim()
  return handle !== 'false' && handle !== 'body'
}

function successEdgesFrom(edges: GraphEdge[], sourceId: string): GraphEdge[] {
  return edges.filter((edge) => edge.source === sourceId && isSuccessEdge(edge))
}

export function documentKindFromNode(node: GraphNode): WorkflowDocumentKind | null {
  const config = node.data?.config ?? {}
  const parameter = (config.parameter || '').trim().toUpperCase()
  if (parameter === 'URD' || parameter === 'BRD' || parameter === 'FSD') return parameter
  const operation = (config.actionOperation || '').trim().toLowerCase()
  if (operation !== 'upload') return null
  const label = (node.data?.label || '').toUpperCase()
  if (label.includes('URD')) return 'URD'
  if (label.includes('FSD')) return 'FSD'
  if (label.includes('BRD')) return 'BRD'
  return null
}

/** Name wins over the code prefix so an SRD stored as `brd-…` is not treated as a BRD. */
export function templateDocumentKind(template: { name?: string | null; template_code?: string | null }): string {
  const name = (template.name || '').trim().toUpperCase()
  if (name.startsWith('URD')) return 'URD'
  if (name.startsWith('FSD')) return 'FSD'
  if (name.startsWith('SRD')) return 'SRD'
  if (name.startsWith('BRD')) return 'BRD'
  const code = (template.template_code || '').split('-', 1)[0]?.trim().toUpperCase()
  return code || 'DOC'
}

function reachableFrom(startId: string, edges: GraphEdge[]): Set<string> {
  const seen = new Set<string>()
  const stack = [startId]
  while (stack.length > 0) {
    const id = stack.pop()
    if (!id || seen.has(id)) continue
    seen.add(id)
    for (const edge of successEdgesFrom(edges, id)) stack.push(edge.target)
  }
  return seen
}

function earliestJoin(branchStarts: string[], edges: GraphEdge[]): string | null {
  if (branchStarts.length === 0) return null
  const reaches = branchStarts.map((start) => reachableFrom(start, edges))
  const seen = new Set<string>()
  const queue = [branchStarts[0]]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || seen.has(current)) continue
    seen.add(current)
    if (reaches.every((reach) => reach.has(current))) return current
    for (const edge of successEdgesFrom(edges, current)) queue.push(edge.target)
  }
  return null
}

/**
 * Happy-path document order. A later document lists every approval that must
 * succeed before it, including approvals sitting on parallel branches that join
 * in front of it. The first document (URD) has none.
 */
export function documentStagesFromGraph(graph: WorkflowGraph): DocumentStage[] {
  const nodes = asNodes(graph)
  const edges = asEdges(graph)
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const trigger = nodes.find((node) => node.data?.kind === 'trigger') ?? nodes[0]
  if (!trigger) return []
  const stages: DocumentStage[] = []
  const seen = new Set<string>()

  function walk(id: string, required: string[], stop: Set<string>): string[] {
    if (seen.has(id) || stop.has(id)) return []
    seen.add(id)
    const node = byId.get(id)
    if (!node || node.data?.disabled) {
      return successEdgesFrom(edges, id).flatMap((edge) => walk(edge.target, required, stop))
    }
    if (node.data?.kind === 'parallel') {
      const branches = successEdgesFrom(edges, id)
      if (branches.length <= 1) {
        return branches.flatMap((edge) => walk(edge.target, required, stop))
      }
      const join = earliestJoin(branches.map((edge) => edge.target), edges)
      const joinStop = new Set(join ? [join] : [])
      const branchApprovals = branches.flatMap((edge) => walk(edge.target, required, joinStop))
      const afterJoin = join ? walk(join, [...required, ...branchApprovals], stop) : []
      return [...branchApprovals, ...afterJoin]
    }
    const kind = documentKindFromNode(node)
    if (kind && !stages.some((stage) => stage.kind === kind)) {
      stages.push({ kind, requiredApprovalIds: [...required] })
    }
    const nextRequired = node.data?.kind === 'approval' ? [...required, id] : required
    const found = node.data?.kind === 'approval' ? [id] : []
    return [
      ...found,
      ...successEdgesFrom(edges, id).flatMap((edge) => walk(edge.target, nextRequired, stop)),
    ]
  }

  walk(trigger.id, [], new Set())
  return stages
}

export function allowedDocumentKinds(
  stages: DocumentStage[],
  approvals: WorkflowApprovalDto[],
  workflowId: string,
): WorkflowDocumentKind[] | null {
  const rows = approvals.filter((row) => row.workflow_id === workflowId)
  // A published sibling flow that never asked this idea for a decision does not
  // constrain it. Only the run that actually opened a gate does.
  if (rows.length === 0) return null
  const latestRunId = rows.reduce<{ id: string | null; at: string }>((latest, row) => {
    const at = row.requested_at ?? ''
    return !latest.id || at > latest.at ? { id: row.run_id, at } : latest
  }, { id: null, at: '' }).id
  const runRows = latestRunId ? rows.filter((row) => row.run_id === latestRunId) : []
  const approved = new Set(
    runRows.filter((row) => row.status === 'approved').map((row) => row.node_id),
  )
  const allowed: WorkflowDocumentKind[] = []
  for (const stage of stages) {
    if (!stage.requiredApprovalIds.every((id) => approved.has(id))) break
    allowed.push(stage.kind)
  }
  return allowed
}

export async function loadIdeaDocumentWorkflowGate(
  workspaceId: string | null | undefined,
  ideaId: string,
): Promise<IdeaDocumentWorkflowGate> {
  const workflows = await listWorkflows(workspaceId?.trim() || undefined)
  const active = workflows.filter((workflow) => workflow.is_published && workflow.status === 'Active')
  const definitions = await Promise.all(active.map(async (workflow) => {
    try {
      return await getWorkflow(workflow.id)
    } catch {
      return null
    }
  }))
  const gates = definitions.flatMap((workflow) => {
    if (!workflow) return []
    const stages = documentStagesFromGraph(workflow.definition)
    return stages.length > 0 ? [{ id: workflow.id, stages }] : []
  })
  if (gates.length === 0) return { enforced: false, allowedKinds: null }

  const approvals = await listWorkflowApprovals({
    subjectContextKey: 'idea_id',
    subjectContextValue: ideaId,
    limit: 200,
  })
  let allowed: WorkflowDocumentKind[] | null = null
  for (const gate of gates) {
    const kinds = allowedDocumentKinds(gate.stages, approvals, gate.id)
    if (kinds === null) continue
    allowed = allowed === null ? kinds : allowed.filter((kind) => kinds.includes(kind))
  }
  if (allowed === null) return { enforced: false, allowedKinds: null }
  return { enforced: true, allowedKinds: allowed }
}

export function templateAllowedByWorkflow(
  template: { name?: string | null; template_code?: string | null },
  gate: IdeaDocumentWorkflowGate,
): boolean {
  if (!gate.enforced || gate.allowedKinds === null) return true
  return gate.allowedKinds.includes(templateDocumentKind(template) as WorkflowDocumentKind)
}
