import type { Edge, Node } from 'reactflow'
import type { ArchimateNodeData, ArchimateElementNodeData } from './integrationArchitectureTypes'
import { umlLinkToCanvasData, umlRelationDefaults } from './classErdPlantUml'

export type UseCaseKind = 'actor' | 'usecase' | 'system-boundary'
export function getUseCaseConnectionStyle(relation: string): Partial<Edge> {
  const dependency = relation === 'include' || relation === 'extend'
  return { type: 'smoothstep', label: dependency ? `<<${relation}>>` : undefined,
    style: { stroke: '#475569', strokeWidth: 1.5, strokeDasharray: dependency ? '5 4' : undefined },
    data: { ...umlLinkToCanvasData({ source: '', target: '', label: '', ...umlRelationDefaults(dependency ? 'dependency' : relation === 'generalization' ? 'generalization' : 'association') }), useCaseRelation: relation } }
}
export function createUseCaseNode(kind: UseCaseKind, title: string, id: string, position: { x: number; y: number }): Node<ArchimateElementNodeData> {
  return { id, type: 'umlUseCase', position, zIndex: kind === 'system-boundary' ? -1 : 0,
    style: { width: kind === 'system-boundary' ? 520 : kind === 'actor' ? 100 : 190, height: kind === 'system-boundary' ? 360 : kind === 'actor' ? 120 : 80 },
    data: { kind: 'element', layer: 'application', notationId: kind, stereotype: kind, title, description: [] } }
}
export function parseUseCaseDiagram(source: string): { nodes: Node<ArchimateElementNodeData>[]; edges: Edge[] } {
  const nodes: Node<ArchimateElementNodeData>[] = [], edges: Edge[] = []
  let boundary: string | undefined, actorCount = 0, caseCount = 0
  const pending: string[] = []
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '}') { boundary = undefined; continue }
    const decl = line.match(/^(actor|usecase|rectangle|package)\s+(?:"([^"]+)"|([\w-]+))(?:\s+as\s+([\w-]+))?\s*(\{)?$/i)
    const short = line.match(/^\(([^)]+)\)\s+as\s+([\w-]+)$/)
    if (decl || short) {
      const kind: UseCaseKind = short ? 'usecase' : decl![1].toLowerCase() === 'actor' ? 'actor' : decl![1].toLowerCase() === 'usecase' ? 'usecase' : 'system-boundary'
      const title = short ? short[1] : decl![2] || decl![3]
      const id = (short ? short[2] : decl![4] || decl![3]) || title.replace(/\W+/g, '_')
      if (nodes.some(n => n.id === id)) continue
      const position = kind === 'system-boundary' ? { x: 220, y: 30 } : kind === 'actor' ? { x: 40, y: 70 + actorCount++ * 150 } : { x: 260 + (caseCount % 2) * 240, y: 90 + Math.floor(caseCount++ / 2) * 120 }
      const node = createUseCaseNode(kind, title, id, position)
      if (boundary && kind === 'usecase') node.data = { ...node.data, description: [`boundary:${boundary}`] }
      nodes.push(node)
      if (kind === 'system-boundary' && decl?.[5]) boundary = id
    } else pending.push(line)
  }
  for (const line of pending) {
    const m = line.match(/^([\w-]+)\s*(<\|--|--\|>|<\.\.|\.\.>|<--|-->|--)\s*([\w-]+)(?:\s*:\s*(.*))?$/)
    if (!m || !nodes.some(n => n.id === m[1]) || !nodes.some(n => n.id === m[3])) continue
    const reverse = m[2].startsWith('<')
    const relation = m[2].includes('|') ? 'generalization' : /<<\s*include\s*>>/i.test(m[4] || '') ? 'include' : /<<\s*extend\s*>>/i.test(m[4] || '') ? 'extend' : 'association'
    edges.push({ ...getUseCaseConnectionStyle(relation), id: `use-case-${edges.length}`, source: reverse ? m[3] : m[1], target: reverse ? m[1] : m[3], label: m[4] || undefined } as Edge)
  }
  for (const node of nodes.filter(n => n.data.notationId === 'system-boundary')) {
    const children = nodes.filter(n => n.data.description.includes(`boundary:${node.id}`))
    node.style = { ...node.style, height: Math.max(360, ...children.map(n => n.position.y + 110 - node.position.y)) }
  }
  return { nodes, edges }
}
export function serializeUseCaseDiagram(nodes: Node<ArchimateNodeData>[], edges: Edge[]): string {
  const quote = (s: string) => s.replace(/"/g, "'").replace(/[\r\n]+/g, ' ')
  const relevant = nodes.filter((n): n is Node<ArchimateElementNodeData> => n.type === 'umlUseCase' && n.data.kind === 'element')
  const boundaries = relevant.filter(n => n.data.notationId === 'system-boundary')
  const container = (n: Node<ArchimateNodeData>) => boundaries.find(b => n.position.x >= b.position.x && n.position.y >= b.position.y && n.position.x + Number(n.style?.width || 190) <= b.position.x + Number(b.style?.width || 520) && n.position.y + Number(n.style?.height || 80) <= b.position.y + Number(b.style?.height || 360))
  const declaration = (n: Node<ArchimateElementNodeData>) => `${n.data.notationId === 'actor' ? 'actor' : 'usecase'} "${quote(n.data.title)}" as ${n.id}`
  const lines = ['@startuml', "' tectona-view: use-case", 'left to right direction']
  relevant.filter(n => n.data.notationId !== 'system-boundary' && (n.data.notationId === 'actor' || !container(n))).forEach(n => lines.push(declaration(n)))
  boundaries.forEach(b => { lines.push(`rectangle "${quote(b.data.title)}" as ${b.id} {`); relevant.filter(n => n.data.notationId === 'usecase' && container(n)?.id === b.id).forEach(n => lines.push('  ' + declaration(n))); lines.push('}') })
  edges.forEach(e => {
    if (!relevant.some(n => n.id === e.source) || !relevant.some(n => n.id === e.target)) return
    const relation = e.data?.useCaseRelation || 'association'
    const arrow = relation === 'generalization' ? '--|>' : relation === 'include' || relation === 'extend' ? '..>' : '--'
    const label = relation === 'include' || relation === 'extend' ? `<<${relation}>>` : e.label
    lines.push(`${e.source} ${arrow} ${e.target}${label ? ` : ${quote(String(label))}` : ''}`)
  })
  return [...lines, '@enduml'].join('\n')
}
