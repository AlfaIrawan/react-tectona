import type { DiagramAiDraftAuditApi } from '@/lib/api/ideaBacklogApi'
import type { C4ElementKind } from '@/modules/project-management/lib/c4PlantUml'
import { ARCHIMATE_NOTATION_DEFINITIONS } from '@/modules/project-management/lib/integrationArchimateNotationCatalog'

export type DiagramChatDraftAction =
  // notation: a C4 element kind (C4 diagrams) or an ArchiMate type such as "Business Process".
  | { type: 'add_node'; id: string; notation: string; title: string; description?: string }
  | { type: 'update_node'; nodeId: string; notation?: string; title?: string; description?: string }
  | { type: 'delete_node'; nodeId: string }
  | { type: 'add_edge'; id: string; source: string; target: string; label?: string }
  | { type: 'delete_edge'; edgeId: string }

export type DiagramChatDraft = {
  diagramKey: string
  summary?: string
  actions: DiagramChatDraftAction[]
}

const C4_KINDS = new Set<C4ElementKind>([
  'Person', 'Person_Ext', 'System', 'System_Ext', 'SystemDb',
  'Container', 'Container_Ext', 'ContainerDb', 'Component',
])

// ArchiMate element types the integration canvas draws, by stereotype and by palette label.
const ARCHIMATE_NOTATIONS = new Set(
  ARCHIMATE_NOTATION_DEFINITIONS.flatMap((item) => [item.stereotype, item.label]).concat(['Data Object']),
)

function isKnownNotation(notation: string): boolean {
  return C4_KINDS.has(notation as C4ElementKind) || ARCHIMATE_NOTATIONS.has(notation)
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseAction(value: unknown): DiagramChatDraftAction | null {
  if (!value || typeof value !== 'object') return null
  const action = value as Record<string, unknown>
  const type = text(action.type)
  if (type === 'add_node') {
    const id = text(action.id)
    const notation = text(action.notation)
    const title = text(action.title)
    if (!id || !notation || !isKnownNotation(notation) || !title) return null
    return { type, id, notation, title, ...(text(action.description) ? { description: text(action.description)! } : {}) }
  }
  if (type === 'update_node') {
    const nodeId = text(action.nodeId)
    const notation = text(action.notation)
    const title = text(action.title)
    const description = text(action.description)
    if (!nodeId || (notation && !isKnownNotation(notation)) || (!notation && !title && !description)) return null
    return { type, nodeId, ...(notation ? { notation } : {}), ...(title ? { title } : {}), ...(description ? { description } : {}) }
  }
  if (type === 'delete_node') {
    const nodeId = text(action.nodeId)
    return nodeId ? { type, nodeId } : null
  }
  if (type === 'add_edge') {
    const id = text(action.id)
    const source = text(action.source)
    const target = text(action.target)
    if (!id || !source || !target || source === target) return null
    return { type, id, source, target, ...(text(action.label) ? { label: text(action.label)! } : {}) }
  }
  if (type === 'delete_edge') {
    const edgeId = text(action.edgeId)
    return edgeId ? { type, edgeId } : null
  }
  return null
}

export function parseDiagramChatDraft(answer: string): DiagramChatDraft | null {
  const match = answer.match(/```tectona-diagram-draft\s*([\s\S]*?)```/i)
  if (!match) return null
  try {
    const value = JSON.parse(match[1]) as Record<string, unknown>
    const diagramKey = text(value.diagramKey)
    if (!diagramKey || !Array.isArray(value.actions)) return null
    const actions = value.actions.map(parseAction).filter((action): action is DiagramChatDraftAction => Boolean(action))
    if (!actions.length) return null
    return { diagramKey, ...(text(value.summary) ? { summary: text(value.summary)! } : {}), actions }
  } catch {
    return null
  }
}

// AI diagram history (audit trail) labels, shared by the diagram studios.
export function chatAuditLabel(action: DiagramAiDraftAuditApi['action']): string {
  return { requested: 'Draft requested', applied: 'Draft applied', discarded: 'Draft discarded', undone: 'Batch undone' }[action]
}

export function chatAuditSnapshotSummary(snapshot: Record<string, unknown> | null | undefined): string | null {
  if (!snapshot) return null
  const nodes = Array.isArray(snapshot.nodes) ? snapshot.nodes.length : null
  const edges = Array.isArray(snapshot.edges) ? snapshot.edges.length : null
  return nodes !== null && edges !== null ? `${nodes} notation, ${edges} connection` : null
}

export function chatAuditDraftSummary(draft: Record<string, unknown>): string | null {
  if (typeof draft.summary === 'string' && draft.summary.trim()) return draft.summary.trim()
  const actions = Array.isArray(draft.actions) ? draft.actions.length : 0
  return actions ? `${actions} proposed change${actions === 1 ? '' : 's'}` : null
}
