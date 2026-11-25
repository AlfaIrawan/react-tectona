import { parseC4Graph, type C4ParsedGraph, type C4ElementKind } from './c4PlantUml'
type CanvasNode = { id: string; type?: string; parentNode?: string; data: { kind: string; title?: string; notationId?: string; description?: string[] } }
type CanvasEdge = { id: string; source: string; target: string; label?: unknown; data?: Record<string, unknown> }
const kinds = new Set(['Person', 'Person_Ext', 'System', 'System_Ext', 'SystemDb', 'Container', 'Container_Ext', 'ContainerDb', 'Component', 'Component_Ext', 'ComponentDb'])
export function c4GraphFromCanvas(nodes: CanvasNode[], edges: CanvasEdge[], previous: string): C4ParsedGraph {
  const parsed = parseC4Graph(previous)
  const boundaries = nodes.filter(n => n.type === 'archimateBoundary' && n.data.kind === 'boundary').map(node => ({
    ...parsed.boundaries.find(item => item.id === node.id), id: node.id, title: node.data.title ?? node.id, parentId: node.parentNode,
  }))
  const elements = nodes.filter(n => n.type === 'c4Element' && n.data.kind === 'element').map(node => {
    const description = node.data.description ?? []
    const techLine = description.find(line => line.startsWith('[') && line.endsWith(']'))
    return { ...parsed.elements.find(item => item.id === node.id), id: node.id, kind: (kinds.has(node.data.notationId ?? '') ? node.data.notationId : 'System') as C4ElementKind,
      title: node.data.title ?? node.id, technology: techLine?.slice(1, -1) ?? '', description: description.filter(line => line !== techLine).join('\n'), parentId: node.parentNode }
  })
  const relations = edges.map((edge, index) => {
    const original = (edge.data?.c4Relation ?? parsed.relations.find(item => item.id === edge.id)) as C4ParsedGraph['relations'][number] | undefined
    const raw = String(edge.label ?? 'uses')
    const unchangedLabel = original && raw === (original.technology ? `${original.label} [${original.technology}]` : original.label)
    const tech = /\s*\[([^\]]+)\]\s*$/.exec(raw)
    return { ...original, id: edge.id || `rel-${index}`, source: edge.source, target: edge.target,
      label: unchangedLabel ? original.label : tech ? raw.slice(0, tech.index).trim() : raw,
      technology: unchangedLabel ? original.technology : tech?.[1] ?? '' }
  })
  return { ...parsed, boundaries, elements, relations }
}
// Parallel/reverse edges are distinct relationships; never deduplicate by endpoint pair.
export function mapC4Relations<T>(edges: T[], map: (edge: T) => T): T[] { return edges.map(map) }
