import { applyNodeChanges, type Node, type NodeChange } from 'reactflow'
import type { DiagramResizeConstraints } from './diagramInteractionContext'

export type DiagramRect = { x: number; y: number; width: number; height: number }
export type DiagramGuide = { axis: 'x' | 'y'; value: number; from: number; to: number; kind: 'alignment' | 'dimension' }
export type DiagramGuideFeedback = { lines: DiagramGuide[]; size?: DiagramRect }
export type DiagramResizeSession = DiagramResizeConstraints & { nodeId: string; initial: DiagramRect }

/** Resolve parents from the current positions, not React Flow's previous measured absolute positions. */
export function diagramNodeRect(node: Node, nodes: Node[]): DiagramRect {
  let { x, y } = node.position
  let parentId = node.parentNode
  const visited = new Set([node.id])
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId)
    const parent = nodes.find(item => item.id === parentId)
    if (!parent) break
    x += parent.position.x
    y += parent.position.y
    parentId = parent.parentNode
  }
  return { x, y, width: Number(node.width ?? node.style?.width ?? 0), height: Number(node.height ?? node.style?.height ?? 0) }
}

function relatedTo(node: Node, ids: Set<string>, nodes: Node[]): boolean {
  let current: Node | undefined = node
  const visited = new Set<string>()
  while (current && !visited.has(current.id)) {
    if (ids.has(current.id)) return true
    visited.add(current.id)
    current = nodes.find(item => item.id === current?.parentNode)
  }
  return false
}

function guideCandidates(nodes: Node[], ids: Set<string>): DiagramRect[] {
  return nodes.filter(node => !node.hidden && !relatedTo(node, ids, nodes)
    && !nodes.some(active => ids.has(active.id) && relatedTo(active, new Set([node.id]), nodes)))
    .map(node => diagramNodeRect(node, nodes))
    .filter(rect => rect.width > 0 && rect.height > 0)
}

function union(rects: DiagramRect[]): DiagramRect {
  const x = Math.min(...rects.map(rect => rect.x)), y = Math.min(...rects.map(rect => rect.y))
  return { x, y, width: Math.max(...rects.map(rect => rect.x + rect.width)) - x,
    height: Math.max(...rects.map(rect => rect.y + rect.height)) - y }
}

const axisValues = (rect: DiagramRect, axis: 'x' | 'y') => {
  const size = axis === 'x' ? rect.width : rect.height
  return [rect[axis], rect[axis] + size / 2, rect[axis] + size]
}

function alignment(active: DiagramRect, peers: DiagramRect[], axis: 'x' | 'y', tolerance: number) {
  let closest: { delta: number; priority: number } | undefined
  for (const peer of peers) for (const [a, value] of axisValues(active, axis).entries()) {
    for (const [b, target] of axisValues(peer, axis).entries()) {
      // Centers align with centers; perimeter edges align with any perimeter edge.
      if ((a === 1) !== (b === 1)) continue
      const delta = target - value, priority = a === 1 ? 0 : 1
      if (Math.abs(delta) <= tolerance && (!closest || Math.abs(delta) < Math.abs(closest.delta) - 0.001
        || Math.abs(Math.abs(delta) - Math.abs(closest.delta)) < 0.001 && priority < closest.priority)) closest = { delta, priority }
    }
  }
  return closest?.delta ?? 0
}

function alignmentLines(active: DiagramRect, peers: DiagramRect[], padding: number): DiagramGuide[] {
  const lines: DiagramGuide[] = []
  for (const axis of ['x', 'y'] as const) for (const peer of peers) {
    for (const [a, value] of axisValues(active, axis).entries()) for (const [b, target] of axisValues(peer, axis).entries()) {
      if ((a === 1) !== (b === 1) || Math.abs(value - target) > 0.01) continue
      const other = axis === 'x' ? 'y' : 'x', size = axis === 'x' ? 'height' : 'width'
      lines.push({ axis, value, from: Math.min(active[other], peer[other]) - padding,
        to: Math.max(active[other] + active[size], peer[other] + peer[size]) + padding, kind: 'alignment' })
    }
  }
  // Collapse coincident guides rather than drawing each aligned peer on top of itself.
  const merged = new Map<string, DiagramGuide>()
  for (const line of lines) {
    const key = `${line.axis}:${line.value.toFixed(3)}`, previous = merged.get(key)
    merged.set(key, previous ? { ...line, from: Math.min(previous.from, line.from), to: Math.max(previous.to, line.to) } : line)
  }
  return [...merged.values()]
}

function withinExtent(node: Node, delta: { x: number; y: number }, nodes: Node[]) {
  let extent = node.extent
  if (extent === 'parent') {
    const parent = nodes.find(item => item.id === node.parentNode)
    if (!parent) return false
    const box = diagramNodeRect(parent, nodes)
    extent = [[0, 0], [box.width, box.height]]
  }
  if (!extent) return true
  const rect = diagramNodeRect(node, nodes), x = node.position.x + delta.x, y = node.position.y + delta.y
  return x >= extent[0][0] && y >= extent[0][1] && x + rect.width <= extent[1][0] && y + rect.height <= extent[1][1]
}

/** Change positions as one group; do not distort spacing between selected nodes. */
export function snapDiagramDrag(changes: NodeChange[], nodes: Node[], zoom: number, snapToGrid = false) {
  const moved = new Set(changes.flatMap(change => change.type === 'position' && change.position && change.dragging !== undefined ? [change.id] : []))
  if (!moved.size) return { changes, feedback: { lines: [] } as DiagramGuideFeedback }
  const next = applyNodeChanges(changes, nodes), activeNodes = next.filter(node => moved.has(node.id))
  if (!activeNodes.length) return { changes, feedback: { lines: [] } as DiagramGuideFeedback }
  const rect = union(activeNodes.map(node => diagramNodeRect(node, next))), peers = guideCandidates(next, moved)
  const tolerance = 6 / Math.max(0.1, zoom)
  const delta = { x: alignment(rect, peers, 'x', tolerance), y: alignment(rect, peers, 'y', tolerance) }
  // Grid snapping remains authoritative when explicitly enabled.
  if (snapToGrid) { delta.x = 0; delta.y = 0 }
  if (!activeNodes.every(node => withinExtent(node, delta, next))) { delta.x = 0; delta.y = 0 }
  const adjusted = changes.map(change => change.type === 'position' && change.position && moved.has(change.id)
    ? { ...change, position: { x: change.position.x + delta.x, y: change.position.y + delta.y },
      ...(change.positionAbsolute ? { positionAbsolute: { x: change.positionAbsolute.x + delta.x, y: change.positionAbsolute.y + delta.y } } : {}) } : change)
  return { changes: adjusted, feedback: { lines: alignmentLines({ ...rect, x: rect.x + delta.x, y: rect.y + delta.y }, peers, 16 / zoom) } }
}

/** Match dimensions without moving the fixed opposite edge or breaking an aspect lock. */
export function snapDiagramResize(changes: NodeChange[], nodes: Node[], session: DiagramResizeSession, zoom: number, snapToGrid = false) {
  const dimension = changes.find(change => change.type === 'dimensions' && change.id === session.nodeId && change.dimensions)
  const node = nodes.find(item => item.id === session.nodeId)
  if (!dimension || dimension.type !== 'dimensions' || !dimension.dimensions || !node) return { changes, feedback: { lines: [] } as DiagramGuideFeedback }
  const next = applyNodeChanges(changes, nodes), current = next.find(item => item.id === node.id)!
  const raw = diagramNodeRect(current, next), peers = guideCandidates(next, new Set([node.id]))
  const initial = session.initial, tolerance = 6 / Math.max(0.1, zoom)
  let width = raw.width, height = raw.height
  const widthChanged = Math.abs(raw.width - initial.width) > 0.01, heightChanged = Math.abs(raw.height - initial.height) > 0.01
  const matching = (value: number, size: 'width' | 'height', minimum: number) => peers.map(peer => peer[size])
    .filter(candidate => candidate >= minimum && Math.abs(candidate - value) <= tolerance)
    .sort((a, b) => Math.abs(a - value) - Math.abs(b - value))[0]
  if (!snapToGrid) {
    const w = widthChanged ? matching(width, 'width', session.minWidth) : undefined
    const h = heightChanged ? matching(height, 'height', session.minHeight) : undefined
    if (session.keepAspectRatio) {
      const ratio = initial.width / initial.height
      if (w !== undefined && w / ratio >= session.minHeight && (h === undefined || Math.abs(w - width) <= Math.abs(h - height) * ratio)) {
        width = w; height = w / ratio
      } else if (h !== undefined && h * ratio >= session.minWidth) { height = h; width = h * ratio }
    } else { width = w ?? width; height = h ?? height }
  }
  const x = Math.abs(raw.x - initial.x) > 0.01 ? raw.x + raw.width - width : raw.x
  const y = Math.abs(raw.y - initial.y) > 0.01 ? raw.y + raw.height - height : raw.y
  const size = { x, y, width, height }
  const position = { x: current.position.x + x - raw.x, y: current.position.y + y - raw.y }
  let adjusted = changes.map(change => change.type === 'dimensions' && change.id === node.id && change.dimensions
    ? { ...change, dimensions: { width, height } }
    : change.type === 'position' && change.id === node.id ? { ...change, position } : change)
  if ((Math.abs(x - raw.x) > 0.001 || Math.abs(y - raw.y) > 0.001) && !adjusted.some(change => change.type === 'position' && change.id === node.id)) {
    adjusted = [{ type: 'position', id: node.id, position }, ...adjusted]
  }
  const lines = alignmentLines(size, peers, 16 / zoom)
  for (const peer of peers) {
    if (Math.abs(width - peer.width) < 0.01) for (const box of [size, peer]) {
      lines.push({ axis: 'y', value: box.y - 16 / zoom, from: box.x, to: box.x + box.width, kind: 'dimension' })
    }
    if (Math.abs(height - peer.height) < 0.01) for (const box of [size, peer]) {
      lines.push({ axis: 'x', value: box.x + box.width + 16 / zoom, from: box.y, to: box.y + box.height, kind: 'dimension' })
    }
  }
  return { changes: adjusted, feedback: { lines, size } }
}
