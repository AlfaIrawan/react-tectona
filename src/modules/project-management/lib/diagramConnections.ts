import { reconnectEdge, type Connection, type Edge } from 'reactflow'

/** User-chosen endpoints stay attached through node moves, resize and reload. */
export function hasManualConnectionHandles(edge: Edge): boolean {
  return edge.data?.manualConnectionHandles === true && Boolean(edge.sourceHandle && edge.targetHandle)
}

export function reconnectDiagramEdge(oldEdge: Edge, connection: Connection, edges: Edge[]): Edge[] {
  return reconnectEdge(oldEdge, connection, edges, { shouldReplaceId: false }).map(edge => edge.id === oldEdge.id
    ? { ...edge, selected: true, data: { ...edge.data, manualConnectionHandles: true } }
    : edge)
}

export function connectionClientPoint(event: { clientX: number; clientY: number } | TouchEvent): { x: number; y: number } {
  const point = 'changedTouches' in event ? event.changedTouches[0] ?? event.touches[0] : event
  return { x: point?.clientX ?? 0, y: point?.clientY ?? 0 }
}

/** Project a box-side anchor onto the rendered shape, in node-local percentages. */
export function connectionAnchor(side: 'top' | 'right' | 'bottom' | 'left', percent: number,
  shape: 'rectangle' | 'ellipse' | 'diamond' = 'rectangle'): { x: number; y: number } {
  const offset = Math.max(0, Math.min(100, percent)) / 100 - 0.5
  const x = side === 'left' ? -0.5 : side === 'right' ? 0.5 : offset
  const y = side === 'top' ? -0.5 : side === 'bottom' ? 0.5 : offset
  const scale = shape === 'ellipse' ? 0.5 / Math.hypot(x, y)
    : shape === 'diamond' ? 0.5 / (Math.abs(x) + Math.abs(y)) : 1
  return { x: 50 + x * scale * 100, y: 50 + y * scale * 100 }
}
