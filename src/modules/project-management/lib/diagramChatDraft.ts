import type { C4ElementKind } from '@/modules/project-management/lib/c4PlantUml'

export type DiagramChatDraftAction =
  | { type: 'add_node'; id: string; notation: C4ElementKind; title: string; description?: string }
  | { type: 'update_node'; nodeId: string; notation?: C4ElementKind; title?: string; description?: string }
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
    if (!id || !notation || !C4_KINDS.has(notation as C4ElementKind) || !title) return null
    return { type, id, notation: notation as C4ElementKind, title, ...(text(action.description) ? { description: text(action.description)! } : {}) }
  }
  if (type === 'update_node') {
    const nodeId = text(action.nodeId)
    const notation = text(action.notation)
    const title = text(action.title)
    const description = text(action.description)
    if (!nodeId || (notation && !C4_KINDS.has(notation as C4ElementKind)) || (!notation && !title && !description)) return null
    return { type, nodeId, ...(notation ? { notation: notation as C4ElementKind } : {}), ...(title ? { title } : {}), ...(description ? { description } : {}) }
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
