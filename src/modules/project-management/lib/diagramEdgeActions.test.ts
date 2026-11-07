import { describe, expect, it } from 'vitest'
import { Position, type Edge } from 'reactflow'
import { canDiagramEdgeAction, clearDiagramEdgeWaypoints, reverseDiagramEdge, unpinDiagramEdgeEnds } from './diagramEdgeActions'
import { readSegmentRoute, segmentRoutePoints } from './diagramSegmentRouting'
const points = [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 120 }, { x: 240, y: 120 }]
const fixture = (): Edge => ({ id: 'e', source: 'a', target: 'b', sourceHandle: 'source-right-31.5', targetHandle: 'target-left-72',
  markerEnd: 'arrow', label: 'relation', data: { manualConnectionHandles: true, visual: { endArrow: 'classic' }, segmentRoute: {
    routingVersion: 2, points, controls: [{ id: 'first', axis: 'x', x: 80, y: 40 }, { id: 'last', axis: 'y', x: 160, y: 120 }],
  } } })
describe('diagram edge menu actions', () => {
  it('clears manual route and controls without releasing chosen endpoints or style', () => {
    const edge = fixture(), next = clearDiagramEdgeWaypoints(edge)
    expect(next.data.segmentRoute).toBeUndefined()
    expect(next.sourceHandle).toBe(edge.sourceHandle)
    expect(next.targetHandle).toBe(edge.targetHandle)
    expect(next.data.manualConnectionHandles).toBe(true)
    expect(next.data.visual).toEqual(edge.data.visual)
    expect(edge.data.segmentRoute.points).toEqual(points)
  })
  it('unpins endpoints without clearing authored waypoints', () => {
    const edge = fixture(), next = unpinDiagramEdgeEnds(edge)
    expect(next.sourceHandle).toBeUndefined()
    expect(next.targetHandle).toBeUndefined()
    expect(next.data.manualConnectionHandles).toBe(false)
    expect(next.data.segmentRoute).toEqual(edge.data.segmentRoute)
  })
  it('reverses endpoints with valid source and target handle roles and preserves arrow style', () => {
    const next = reverseDiagramEdge(fixture())
    expect(next).toMatchObject({ source: 'b', target: 'a', sourceHandle: 'source-left-72', targetHandle: 'target-right-31.5', markerEnd: 'arrow', data: { visual: { endArrow: 'classic' } } })
  })
  it('keeps the same physical route on reverse rather than inserting terminal adapters', () => {
    const edge = fixture(), next = reverseDiagramEdge(edge)
    const args = { sourceX: 240, sourceY: 120, targetX: 0, targetY: 0, sourcePosition: Position.Left, targetPosition: Position.Right }
    const expected = [...points].reverse()
    expect(segmentRoutePoints(args, readSegmentRoute(edge.data.segmentRoute))).not.toEqual(expected)
    expect(segmentRoutePoints(args, readSegmentRoute(next.data.segmentRoute))).toEqual(expected)
    expect(next.data.segmentRoute.controls.map((c: { id: string }) => c.id)).toEqual(['last', 'first'])
  })
  it('restores the complete relation after two reversals and serialized reload', () => {
    const edge = fixture()
    expect(reverseDiagramEdge(JSON.parse(JSON.stringify(reverseDiagramEdge(edge))))).toEqual(edge)
  })
  it('handles automatic routes with no explicit anchors or metadata', () => {
    expect(reverseDiagramEdge({ id: 'e', source: 'a', target: 'b' })).toMatchObject({ source: 'b', target: 'a' })
    expect(clearDiagramEdgeWaypoints({ id: 'e', source: 'a', target: 'b' }).data).toEqual({})
  })
})

describe('edge command property guards', () => {
  it('keeps all actions enabled for legacy edges without arrange metadata', () => {
    for (const action of ['format', 'reverse', 'clearWaypoints', 'unpin', 'delete', 'reconnect'] as const) expect(canDiagramEdgeAction(fixture(), action)).toBe(true)
  })
  it('honors each applicable flag without confusing inline editing and dialog entry', () => {
    const edge = { ...fixture(), data: { arrange: { movable: false, bendable: false, editable: false, editDialog: false, deletable: false } } }
    for (const action of ['format', 'reverse', 'clearWaypoints', 'unpin', 'delete', 'reconnect'] as const) expect(canDiagramEdgeAction(edge, action)).toBe(false)
    expect(canDiagramEdgeAction({ ...fixture(), data: { arrange: { editable: false } } }, 'format')).toBe(true)
    expect(canDiagramEdgeAction({ ...fixture(), data: { arrange: { bendable: false } } }, 'unpin')).toBe(true)
    expect(canDiagramEdgeAction({ ...fixture(), deletable: false }, 'delete')).toBe(false)
  })
})
