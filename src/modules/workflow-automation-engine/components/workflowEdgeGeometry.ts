import { Position, type Edge, type Node } from 'reactflow'
import { pickCenteredAnchoredHandles, type NodeGeometry } from '@/modules/project-management/lib/parsePlantUmlToIntegrationGraph'

type Side = 'top' | 'right' | 'bottom' | 'left'

export type WorkflowPort = { id: string; side: Side; ratio: number }

type PortPlacement = { side: Side; ratio: number }

const PORT_PLACEMENTS: Record<string, PortPlacement> = {
  'port-top-left': { side: 'top', ratio: 0.12 },
  'port-top': { side: 'top', ratio: 0.5 },
  'port-top-right': { side: 'top', ratio: 0.88 },
  'port-right': { side: 'right', ratio: 0.5 },
  'port-bottom-right': { side: 'bottom', ratio: 0.88 },
  'port-bottom': { side: 'bottom', ratio: 0.5 },
  'port-bottom-left': { side: 'bottom', ratio: 0.12 },
  'port-left': { side: 'left', ratio: 0.5 },
}

function portRatios(length: number, minSpacing: number, minimum: number): number[] {
  const requested = Math.max(minimum, Math.floor(length / minSpacing) + 1)
  const count = requested % 2 === 0 ? requested + 1 : requested
  return Array.from({ length: count }, (_, index) => Math.round((index / (count - 1)) * 100))
}

/** Ports are symmetrical around a guaranteed 50% centre point on every side. */
export function workflowPerimeterPorts(width: number, height: number): WorkflowPort[] {
  const horizontal = portRatios(width, 32, 5)
  const vertical = portRatios(height, 28, 4).slice(1, -1)
  return [
    ...horizontal.map((ratio) => ({ id: `port-top-${ratio}`, side: 'top' as const, ratio: ratio / 100 })),
    ...vertical.map((ratio) => ({ id: `port-right-${ratio}`, side: 'right' as const, ratio: ratio / 100 })),
    ...horizontal.map((ratio) => ({ id: `port-bottom-${ratio}`, side: 'bottom' as const, ratio: ratio / 100 })),
    ...vertical.map((ratio) => ({ id: `port-left-${ratio}`, side: 'left' as const, ratio: ratio / 100 })),
  ]
}

const SIDE_POSITION: Record<Side, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
}

function sideName(handle: string): Side {
  if (handle.includes('right')) return 'right'
  if (handle.includes('left')) return 'left'
  if (handle.includes('top')) return 'top'
  return 'bottom'
}

function nodeBox(node: Node | undefined): NodeGeometry | null {
  if (!node) return null
  const origin = node.positionAbsolute ?? node.position
  const width = node.width ?? 224
  const height = node.height ?? 120
  if (!origin || width <= 0 || height <= 0) return null
  return { x: origin.x, y: origin.y, width, height }
}

function pointOnSide(box: NodeGeometry, side: Side, ratio: number) {
  const t = Math.min(0.82, Math.max(0.18, ratio))
  if (side === 'right') return { x: box.x + box.width, y: box.y + box.height * t, position: SIDE_POSITION.right }
  if (side === 'left') return { x: box.x, y: box.y + box.height * t, position: SIDE_POSITION.left }
  if (side === 'top') return { x: box.x + box.width * t, y: box.y, position: SIDE_POSITION.top }
  return { x: box.x + box.width * t, y: box.y + box.height, position: SIDE_POSITION.bottom }
}

function pointOnPort(box: NodeGeometry, handleId: string | null | undefined) {
  const generatedPort = handleId?.match(/^port-(top|right|bottom|left)-(\d{1,3})$/)
  const placement = generatedPort
    ? { side: generatedPort[1] as Side, ratio: Number(generatedPort[2]) / 100 }
    : handleId
      ? PORT_PLACEMENTS[handleId]
      : undefined
  if (!placement) return null
  const { side, ratio } = placement
  if (side === 'right') return { x: box.x + box.width, y: box.y + box.height * ratio, position: SIDE_POSITION.right }
  if (side === 'left') return { x: box.x, y: box.y + box.height * ratio, position: SIDE_POSITION.left }
  if (side === 'top') return { x: box.x + box.width * ratio, y: box.y, position: SIDE_POSITION.top }
  return { x: box.x + box.width * ratio, y: box.y + box.height, position: SIDE_POSITION.bottom }
}

function manualPort(edge: Edge, endpoint: 'source' | 'target'): string | null {
  const key = endpoint === 'source' ? 'sourcePort' : 'targetPort'
  const value = (edge.data as Record<string, unknown> | undefined)?.[key]
  if (typeof value === 'string') return value
  return endpoint === 'source' ? edge.sourceHandle ?? null : edge.targetHandle ?? null
}

export function nearestPortHandle(node: Node | undefined, point: { x: number; y: number }): string | null {
  const box = nodeBox(node)
  if (!box) return null
  const ports = workflowPerimeterPorts(box.width, box.height)
  let nearest: { id: string; distance: number } | null = null
  for (const port of ports) {
    const x = port.side === 'left' ? box.x : port.side === 'right' ? box.x + box.width : box.x + box.width * port.ratio
    const y = port.side === 'top' ? box.y : port.side === 'bottom' ? box.y + box.height : box.y + box.height * port.ratio
    const distance = Math.hypot(point.x - x, point.y - y)
    if (!nearest || distance < nearest.distance) nearest = { id: port.id, distance }
  }
  return nearest?.id ?? null
}

function ratioToward(box: NodeGeometry, side: Side, other: NodeGeometry): number {
  if (side === 'left' || side === 'right') return (other.y + other.height / 2 - box.y) / box.height
  return (other.x + other.width / 2 - box.x) / box.width
}

function exitSide(edge: Edge, nodes: Map<string, Node>): Side | null {
  const from = nodeBox(nodes.get(edge.source))
  const to = nodeBox(nodes.get(edge.target))
  if (!from || !to) return null
  return sideName(pickCenteredAnchoredHandles(from, to).sourceHandle)
}

export type WorkflowEdgeEndpoints = {
  source: ReturnType<typeof pointOnSide>
  target: ReturnType<typeof pointOnSide>
}

/** Shared geometry for the edge path and the visible connection ports on a node. */
export function workflowEdgeEndpoints(edge: Edge, nodes: Map<string, Node>, edges: Edge[]): WorkflowEdgeEndpoints | null {
  const sourceBox = nodeBox(nodes.get(edge.source))
  const targetBox = nodeBox(nodes.get(edge.target))
  if (!sourceBox || !targetBox) return null

  const sides = pickCenteredAnchoredHandles(sourceBox, targetBox)
  const exit = sideName(sides.sourceHandle)
  const entry = sideName(sides.targetHandle)
  const sameSide = edges
    .filter((candidate) => candidate.source === edge.source && exitSide(candidate, nodes) === exit)
    .sort((left, right) => left.id.localeCompare(right.id))
  const slot = Math.max(0, sameSide.findIndex((candidate) => candidate.id === edge.id))
  const slots = Math.max(1, sameSide.length)
  const exitRatio = slots === 1 ? ratioToward(sourceBox, exit, targetBox) : (slot + 1) / (slots + 1)

  return {
    source: pointOnPort(sourceBox, manualPort(edge, 'source')) ?? pointOnSide(sourceBox, exit, exitRatio),
    target: pointOnPort(targetBox, manualPort(edge, 'target')) ?? pointOnSide(targetBox, entry, ratioToward(targetBox, entry, sourceBox)),
  }
}
