import { Position, reconnectEdge, type Connection, type Edge } from 'reactflow'

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

/** Keep every attached handle address valid when resize changes the suggested dot density. */
export function retainConnectionHandlePercents(side: string, suggested: number[], handles: string[]): number[] {
  const retained = handles.flatMap(handle => {
    const match = /^(?:source|target)-(top|right|bottom|left)(?:-(\d+(?:\.\d+)?))?$/.exec(handle)
    if (!match || match[1] !== side) return []
    const percent = match[2] ? Number(match[2]) : 50
    return percent >= 0 && percent <= 100 ? [percent] : []
  })
  return [...new Set([...suggested, ...retained])].sort((a, b) => a - b)
}

/** A nearly aligned pair still needs an elbow; otherwise the line visibly misses its anchor. */
export function canUseStraightOrthogonalPath(args: {
  sourceX: number; sourceY: number; targetX: number; targetY: number;
  sourcePosition: string; targetPosition: string;
}): boolean {
  const { sourceX: x1, sourceY: y1, targetX: x2, targetY: y2, sourcePosition: source, targetPosition: target } = args
  if (Math.abs(y1 - y2) < 0.001) {
    if (source === 'right' && target === 'left' && x2 > x1) return true
    if (source === 'left' && target === 'right' && x2 < x1) return true
  }
  if (Math.abs(x1 - x2) < 0.001) {
    if (source === 'bottom' && target === 'top' && y2 > y1) return true
    if (source === 'top' && target === 'bottom' && y2 < y1) return true
  }
  return false
}

/** React Flow's default preview always faces opposite the start; honor the hovered side instead. */
export function connectionPreviewTargetPosition(fromX: number, fromY: number, toX: number, toY: number,
  fallback: Position, handleId?: string | null): Position {
  const side = /^(?:source|target)-(top|right|bottom|left)(?:-\d+(?:\.\d+)?)?$/.exec(handleId ?? '')?.[1]
  if (side) return side as Position
  const dx = toX - fromX, dy = toY - fromY
  if (Math.abs(dx) + Math.abs(dy) < 0.001) return fallback
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? Position.Left : Position.Right) : (dy > 0 ? Position.Top : Position.Bottom)
}

/** Terminal gaps follow the attached side normal so elbows and arrowheads stay perpendicular. */
export function diagramTerminalPoint(x: number, y: number, side: string, spacing: number) {
  return { x: x + (side === 'left' ? -spacing : side === 'right' ? spacing : 0),
    y: y + (side === 'top' ? -spacing : side === 'bottom' ? spacing : 0) }
}
