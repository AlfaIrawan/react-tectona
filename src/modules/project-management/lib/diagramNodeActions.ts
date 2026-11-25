import type { Node } from 'reactflow'

/** Deleting a container keeps its contents visible at the same canvas coordinates. */
export function removeDiagramNode<T>(nodes: Node<T>[], id: string): Node<T>[] {
  const byId = new Map(nodes.map(node => [node.id, node]))
  const absolute = (node: Node<T>, seen = new Set<string>()): { x: number; y: number } => {
    if (!node.parentNode || seen.has(node.id)) return node.position
    seen.add(node.id)
    const parent = byId.get(node.parentNode)
    if (!parent) return node.position
    const point = absolute(parent, seen)
    return { x: point.x + node.position.x, y: point.y + node.position.y }
  }
  return nodes.filter(node => node.id !== id).map(node => node.parentNode === id
    ? { ...node, parentNode: undefined, extent: undefined, position: absolute(node) } : node)
}

/** Translate roots only: nested positions are local to the newly re-keyed parent. */
export function pasteDiagramNodes<T>(nodes: Node<T>[], at: { x: number; y: number }, idMap: Map<string, string>): Node<T>[] {
  const roots = nodes.filter(node => !node.parentNode || !idMap.has(node.parentNode))
  const minX = roots.length ? Math.min(...roots.map(node => node.position.x)) : 0
  const minY = roots.length ? Math.min(...roots.map(node => node.position.y)) : 0
  return nodes.map(node => {
    const parentNode = node.parentNode ? idMap.get(node.parentNode) : undefined
    return { ...node, id: idMap.get(node.id) ?? node.id, parentNode,
      extent: parentNode ? node.extent : undefined, selected: true,
      position: parentNode ? { ...node.position } : { x: at.x + node.position.x - minX, y: at.y + node.position.y - minY } }
  })
}

/** Removing several selected containers preserves unselected descendants safely. */
export function removeDiagramNodes<T>(nodes: Node<T>[], ids: Set<string>): Node<T>[] {
  return [...ids].reduce((current, id) => removeDiagramNode(current, id), nodes)
}
