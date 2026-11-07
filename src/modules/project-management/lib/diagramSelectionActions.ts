import { remapErdForeignKey } from './erdForeignKeyMapping'
import { canDiagramEdgeAction } from './diagramEdgeActions'
import type { Edge, Node } from 'reactflow'
import { readSegmentRoute } from './diagramSegmentRouting'
import { resolveEdgeArrange } from './integrationEdgeAppearance'

export type DiagramClipboard<T> = { nodes: Node<T>[]; edges: Edge[] }
export type DiagramArrangeAction = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'horizontal' | 'vertical'
export const DIAGRAM_ARRANGE_ACTIONS: { action: DiagramArrangeAction; label: string; minimum: number }[] = [
  { action: 'left', label: 'Align left', minimum: 2 }, { action: 'center', label: 'Align center', minimum: 2 },
  { action: 'right', label: 'Align right', minimum: 2 }, { action: 'top', label: 'Align top', minimum: 2 },
  { action: 'middle', label: 'Align middle', minimum: 2 }, { action: 'bottom', label: 'Align bottom', minimum: 2 },
  { action: 'horizontal', label: 'Distribute horizontally', minimum: 3 }, { action: 'vertical', label: 'Distribute vertically', minimum: 3 },
]
export function canDiagramNode<T>(node: Node<T>, capability: 'movable' | 'cloneable' | 'deletable'): boolean {
  const arrange = (node.data as { arrange?: { movable?: boolean; cloneable?: boolean; deletable?: boolean } } | undefined)?.arrange
  return node.type !== 'archimateLegend' && arrange?.[capability] !== false
    && (capability !== 'movable' || node.draggable !== false) && (capability !== 'deletable' || node.deletable !== false)
}

export function canCutDiagramSelection<T>(graph: DiagramClipboard<T>, nodes: Node<T>[], edges: Edge[]): boolean {
  const ids = new Set(graph.nodes.map(node => node.id))
  return ids.size > 0 && nodes.filter(node => node.selected && node.type !== 'archimateLegend').every(node => ids.has(node.id))
    && nodes.filter(node => ids.has(node.id)).every(node => canDiagramNode(node, 'deletable'))
    && edges.every(edge => !ids.has(edge.source) && !ids.has(edge.target) || edge.deletable !== false && resolveEdgeArrange(edge).deletable
      && (!ids.has(edge.source) || !ids.has(edge.target) || resolveEdgeArrange(edge).cloneable))
}

export function diagramAbsolutePositions<T>(nodes: Node<T>[]): Map<string, { x: number; y: number }> {
  const byId = new Map(nodes.map(node => [node.id, node])), result = new Map<string, { x: number; y: number }>()
  const visit = (node: Node<T>, seen = new Set<string>()): { x: number; y: number } => {
    const cached = result.get(node.id)
    if (cached) return cached
    if (seen.has(node.id)) return node.position
    seen.add(node.id)
    const parent = node.parentNode ? byId.get(node.parentNode) : undefined
    const origin = parent ? visit(parent, seen) : { x: 0, y: 0 }
    const point = { x: origin.x + node.position.x, y: origin.y + node.position.y }
    result.set(node.id, point)
    return point
  }
  nodes.forEach(node => visit(node))
  return result
}

/** Include descendants of copied containers, never links to uncopied objects. */
export function copyDiagramSelection<T>(nodes: Node<T>[], edges: Edge[], fallbackId?: string): DiagramClipboard<T> {
  const clicked = nodes.find(node => node.id === fallbackId)
  const ids = new Set(nodes.filter(node => canDiagramNode(node, 'cloneable') && (clicked && !clicked.selected ? node.id === fallbackId : node.selected)).map(node => node.id))
  if (!ids.size && clicked && canDiagramNode(clicked, 'cloneable')) ids.add(clicked.id)
  let changed = true
  while (changed) {
    changed = false
    nodes.forEach(node => { if (node.parentNode && ids.has(node.parentNode) && !ids.has(node.id) && canDiagramNode(node, 'cloneable')) { ids.add(node.id); changed = true } })
  }
  const positions = diagramAbsolutePositions(nodes)
  const copies = nodes.filter(node => ids.has(node.id)).map(node => {
    const nested = Boolean(node.parentNode && ids.has(node.parentNode))
    return { ...node, parentNode: nested ? node.parentNode : undefined, extent: nested ? node.extent : undefined,
      position: nested ? node.position : positions.get(node.id)!, selected: true }
  })
  // React Flow requires each parent before its descendants.
  const ordered: Node<T>[] = [], visited = new Set<string>(), byId = new Map(copies.map(node => [node.id, node]))
  const append = (node: Node<T>) => { if (visited.has(node.id)) return; visited.add(node.id); const parent = node.parentNode && byId.get(node.parentNode); if (parent) append(parent); ordered.push(node) }
  copies.forEach(append)
  return structuredClone({ nodes: ordered, edges: edges.filter(edge => ids.has(edge.source) && ids.has(edge.target) && resolveEdgeArrange(edge).cloneable) })
}

export function translateDiagramEdge(edge: Edge, dx: number, dy: number): Edge {
  const route = readSegmentRoute(edge.data?.segmentRoute)
  if (!route || (!dx && !dy)) return edge
  const move = <P extends { x: number; y: number }>(point: P): P => ({ ...point, x: point.x + dx, y: point.y + dy })
  return { ...edge, data: { ...edge.data, segmentRoute: { ...route, points: route.points.map(move), ...(route.controls ? { controls: route.controls.map(move) } : {}) } } }
}

export function pasteDiagramSelection<T>(clipboard: DiagramClipboard<T>, suffix: string, at?: { x: number; y: number }): DiagramClipboard<T> {
  const snapshot = structuredClone(clipboard)
  const roots = snapshot.nodes.filter(node => !node.parentNode)
  const dx = at && roots.length ? at.x - Math.min(...roots.map(node => node.position.x)) : 32
  const dy = at && roots.length ? at.y - Math.min(...roots.map(node => node.position.y)) : 32
  const ids = new Map(snapshot.nodes.map(node => [node.id, `${node.id}-copy-${suffix}`]))
  return {
    nodes: snapshot.nodes.map(node => ({ ...node, id: ids.get(node.id)!, parentNode: node.parentNode ? ids.get(node.parentNode) : undefined,
      selected: true, dragging: false, position: node.parentNode ? node.position : { x: node.position.x + dx, y: node.position.y + dy } })),
    edges: snapshot.edges.map(edge => ({ ...translateDiagramEdge(edge, dx, dy), id: `${edge.id}-copy-${suffix}`, source: ids.get(edge.source)!, target: ids.get(edge.target)!, selected: true, ...(edge.data?.erdForeignKey !== undefined ? { data: { ...translateDiagramEdge(edge, dx, dy).data, erdForeignKey: remapErdForeignKey(edge.data.erdForeignKey, ids) } } : {}) })),
  }
}

export function diagramSelectedRoots<T>(nodes: Node<T>[]): Node<T>[] {
  const selected = new Set(nodes.filter(node => node.selected).map(node => node.id)), byId = new Map(nodes.map(node => [node.id, node]))
  return nodes.filter(node => {
    if (!node.selected || !canDiagramNode(node, 'movable')) return false
    let parent = node.parentNode
    const seen = new Set<string>()
    while (parent && !seen.has(parent)) { if (selected.has(parent)) return false; seen.add(parent); parent = byId.get(parent)?.parentNode }
    return true
  })
}

/** Align absolute bounds; move only selection roots, leaving child-relative coordinates intact. */
export function arrangeDiagramSelection<T>(nodes: Node<T>[], edges: Edge[], action: DiagramArrangeAction): DiagramClipboard<T> {
  const roots = diagramSelectedRoots(nodes), distribution = action === 'horizontal' || action === 'vertical'
  if (roots.length < (distribution ? 3 : 2)) return { nodes, edges }
  const before = diagramAbsolutePositions(nodes)
  const axis = ['left', 'center', 'right', 'horizontal'].includes(action) ? 'x' : 'y'
  const dimension = axis === 'x' ? 'width' : 'height'
  const boxes = roots.map(node => { const measured = (node as Node<T> & { measured?: { width?: number; height?: number } }).measured
    return { node, start: before.get(node.id)![axis], size: Number(measured?.[dimension] ?? node[dimension] ?? node.style?.[dimension]) || (axis === 'x' ? 200 : 80) } })
  const low = Math.min(...boxes.map(box => box.start)), high = Math.max(...boxes.map(box => box.start + box.size))
  const positions = new Map<string, number>()
  if (distribution) {
    boxes.sort((a, b) => a.start - b.start)
    const first = boxes[0], last = boxes[boxes.length - 1]
    const gap = (last.start + last.size - first.start - boxes.reduce((sum, box) => sum + box.size, 0)) / (boxes.length - 1)
    let cursor = first.start
    boxes.forEach(box => { positions.set(box.node.id, cursor); cursor += box.size + gap })
  } else boxes.forEach(box => positions.set(box.node.id, action === 'left' || action === 'top' ? low : action === 'right' || action === 'bottom' ? high - box.size : (low + high - box.size) / 2))
  const next = nodes.map(node => { const desired = positions.get(node.id); if (desired === undefined) return node
    return { ...node, position: { ...node.position, [axis]: node.position[axis] + desired - before.get(node.id)![axis] } } })
  const after = diagramAbsolutePositions(next)
  const delta = (id: string) => { const a = before.get(id), b = after.get(id); return a && b ? { x: b.x - a.x, y: b.y - a.y } : { x: 0, y: 0 } }
  return { nodes: next, edges: edges.map(edge => { const source = delta(edge.source), target = delta(edge.target)
    return Math.abs(source.x - target.x) < 0.001 && Math.abs(source.y - target.y) < 0.001 ? translateDiagramEdge(edge, source.x, source.y) : edge }) }
}

/** Never remove a node through an indirect path that would delete a protected relation. */
export function deletableDiagramNodeIds<T>(nodes: Node<T>[], edges: Edge[], requested: Set<string>): Set<string> {
  return new Set(nodes.filter(node => requested.has(node.id) && canDiagramNode(node, 'deletable')
    && edges.every(edge => edge.source !== node.id && edge.target !== node.id || canDiagramEdgeAction(edge, 'delete'))).map(node => node.id))
}
