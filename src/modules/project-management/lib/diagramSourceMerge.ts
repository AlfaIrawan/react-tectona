import type { Edge, Node } from 'reactflow'
import { hasManualConnectionHandles } from './diagramConnections'

function size(node: Node) {
  return { width: Number(node.width ?? node.style?.width) || 210, height: Number(node.height ?? node.style?.height) || 78 }
}

/** Preserve edited geometry; place newly parsed nodes in free space in their own container. */
export function mergeDiagramSourceNodes<T extends Node>(previous: T[], next: T[]): T[] {
  const priorById = new Map(previous.map(node => [node.id, node]))
  const merged = next.map(node => {
    const prior = priorById.get(node.id)
    if (!prior) return node
    return { ...node, position: prior.position, parentNode: prior.parentNode, extent: prior.extent, zIndex: prior.zIndex,
      style: { ...node.style, ...prior.style }, width: prior.width, height: prior.height,
      data: { ...prior.data, ...node.data, visual: prior.data?.visual ?? node.data?.visual, textStyle: prior.data?.textStyle ?? node.data?.textStyle } } as T
  })
  const occupied = merged.filter(node => priorById.has(node.id))
  return merged.map(node => {
    if (priorById.has(node.id)) return node
    const dimensions = size(node)
    const collides = (position: { x: number; y: number }) => occupied.some(other => {
      if (other.parentNode !== node.parentNode) return false
      const otherSize = size(other)
      return position.x < other.position.x + otherSize.width + 24 && position.x + dimensions.width + 24 > other.position.x
        && position.y < other.position.y + otherSize.height + 24 && position.y + dimensions.height + 24 > other.position.y
    })
    let position = node.position
    for (let ring = 1; collides(position) && ring <= 100; ring++) {
      const dx = ring * (dimensions.width + 48), dy = ring * (dimensions.height + 48)
      const candidates = [{ x: node.position.x + dx, y: node.position.y }, { x: node.position.x, y: node.position.y + dy },
        { x: node.position.x - dx, y: node.position.y }, { x: node.position.x, y: node.position.y - dy }]
      position = candidates.find(candidate => !collides(candidate)) ?? position
    }
    const placed = position === node.position ? node : { ...node, position }
    occupied.push(placed)
    return placed
  })
}

/** Editing source text must not silently unpin an otherwise unchanged connection. */
export function mergeDiagramSourceEdges(previous: Edge[], next: Edge[]): Edge[] {
  return next.map(edge => {
    const prior = previous.find(item => item.id === edge.id && item.source === edge.source && item.target === edge.target)
      ?? previous.find(item => item.source === edge.source && item.target === edge.target && item.label === edge.label)
    if (!prior) return edge
    const pinned = hasManualConnectionHandles(prior)
    if (!pinned && !prior.data?.segmentRoute && prior.data?.erdForeignKey === undefined) return edge
    return { ...edge, ...(pinned ? { sourceHandle: prior.sourceHandle, targetHandle: prior.targetHandle } : {}),
      style: { ...edge.style, ...prior.style }, data: { ...edge.data,
        ...(prior.data?.erdForeignKey !== undefined ? { erdForeignKey: prior.data.erdForeignKey } : {}),
        ...(pinned ? { manualConnectionHandles: true } : {}),
        ...(prior.data?.segmentRoute ? { segmentRoute: prior.data.segmentRoute } : {}),
        visual: prior.data?.visual ?? edge.data?.visual,
        textStyle: prior.data?.textStyle ?? edge.data?.textStyle,
        arrange: prior.data?.arrange ?? edge.data?.arrange } }


  })
}
