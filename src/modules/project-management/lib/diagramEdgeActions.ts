import { resolveEdgeArrange } from './integrationEdgeAppearance'
import type { Edge } from 'reactflow'
import { readSegmentRoute } from './diagramSegmentRouting'

/** Reset authored bends without moving the chosen connector endpoints. */
export function clearDiagramEdgeWaypoints(edge: Edge): Edge {
  const data = { ...edge.data }
  delete data.segmentRoute
  return { ...edge, data }
}

/** Release endpoint pins independently of the authored route. */
export function unpinDiagramEdgeEnds(edge: Edge): Edge {
  return { ...edge, sourceHandle: undefined, targetHandle: undefined,
    data: { ...edge.data, manualConnectionHandles: false } }
}

/** Reverse traversal, preserving geometry and directional arrow styling. */
export function reverseDiagramEdge(edge: Edge): Edge {
  const route = readSegmentRoute(edge.data?.segmentRoute)
  const data = edge.type === 'erd' ? { ...edge.data, sourceMany: edge.data?.targetMany, targetMany: edge.data?.sourceMany, sourceOptional: edge.data?.targetOptional, targetOptional: edge.data?.sourceOptional } : edge.data
  const handle = (value: string | null | undefined, role: string) => value?.replace(/^(source|target)-/, `${role}-`) ?? value
  return {
    ...edge, data, source: edge.target, target: edge.source,
    sourceHandle: handle(edge.targetHandle, 'source'), targetHandle: handle(edge.sourceHandle, 'target'),
    ...(route ? { data: { ...data, segmentRoute: { ...route,
      points: [...route.points].reverse(), ...(route.controls ? { controls: [...route.controls].reverse() } : {}) } } } : {}),
  }
}

export type DiagramEdgeAction = 'format' | 'reverse' | 'clearWaypoints' | 'unpin' | 'delete' | 'reconnect'
export function canDiagramEdgeAction(edge: Edge | null | undefined, action: DiagramEdgeAction): boolean {
  if (!edge) return false
  const options = resolveEdgeArrange(edge)
  if (action === 'delete') return edge.deletable !== false && options.deletable
  if (action === 'format') return options.editDialog
  if (action === 'clearWaypoints') return options.movable && options.bendable
  if (action === 'reverse') return options.editable && options.movable
  return options.movable
}
