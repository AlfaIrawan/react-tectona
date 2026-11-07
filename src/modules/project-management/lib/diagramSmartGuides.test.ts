import { describe, expect, it } from 'vitest'
import { applyNodeChanges, type Node, type NodeChange } from 'reactflow'
import { diagramNodeRect, snapDiagramDrag, snapDiagramResize, type DiagramResizeSession } from './diagramSmartGuides'

const node = (id: string, x: number, y: number, width = 120, height = 80): Node => ({ id, position: { x, y }, width, height, data: {} })
const drag = (id: string, x: number, y: number, dragging = true): NodeChange => ({ type: 'position', id, position: { x, y }, dragging })
const resize = (id: string, width: number, height: number): NodeChange => ({ type: 'dimensions', id, dimensions: { width, height }, resizing: true, updateStyle: true })
const session = (initial: Node, overrides = {}): DiagramResizeSession => ({ nodeId: initial.id, initial: diagramNodeRect(initial, [initial]), minWidth: 40, minHeight: 30, keepAspectRatio: false, ...overrides })

describe('diagram alignment guides', () => {
  it.each([0.1, 0.55, 1, 2, 4])('snaps centers within six screen pixels at zoom %s', zoom => {
    const nodes = [node('active', 0, 220 / zoom, 80 / zoom), node('peer', 100 / zoom, 0, 120 / zoom)]
    const result = snapDiagramDrag([drag('active', 125 / zoom, 220 / zoom)], nodes, zoom)
    expect(applyNodeChanges(result.changes, nodes)[0].position.x).toBeCloseTo(120 / zoom)
    expect(result.feedback.lines).toContainEqual(expect.objectContaining({ axis: 'x', value: 160 / zoom, kind: 'alignment' }))
    const far = snapDiagramDrag([drag('active', 127 / zoom, 220 / zoom)], nodes, zoom)
    expect(applyNodeChanges(far.changes, nodes)[0].position.x).toBeCloseTo(127 / zoom)
  })
  it('snaps horizontal centers and edges', () => {
    const nodes = [node('a', 300, 0, 80, 40), node('b', 0, 100, 120, 80)]
    const result = snapDiagramDrag([drag('a', 300, 117)], nodes, 1)
    expect(applyNodeChanges(result.changes, nodes)[0].position.y).toBe(120)
    expect(result.feedback.lines).toContainEqual(expect.objectContaining({ axis: 'y', value: 140 }))
  })
  it('respects explicit grid snapping without a second off-grid adjustment', () => {
    const nodes = [node('a', 0, 200), node('b', 103, 0)]
    const result = snapDiagramDrag([drag('a', 100, 200)], nodes, 1, true)
    expect(result.changes).toEqual([drag('a', 100, 200)])
    expect(result.feedback.lines).toHaveLength(0)
  })
  it('moves a multiple selection as one box and preserves spacing', () => {
    const nodes = [node('a', 0, 200, 40), node('b', 100, 200, 40), node('peer', 202, 0, 140)]
    const result = snapDiagramDrag([drag('a', 200, 200), drag('b', 300, 200)], nodes, 1)
    const next = applyNodeChanges(result.changes, nodes)
    expect(next[0].position.x).toBe(202)
    expect(next[1].position.x - next[0].position.x).toBe(100)
  })
  it('resolves nested coordinates, ignores parents/children/hidden nodes and obeys extents', () => {
    const parent = node('parent', 500, 300, 300, 300)
    const child = { ...node('child', 20, 20, 40, 40), parentNode: 'parent', extent: 'parent' as const }
    expect(diagramNodeRect(child, [parent, child])).toMatchObject({ x: 520, y: 320 })
    const nodes = [parent, child, { ...node('hidden', 523, 0, 40), hidden: true }]
    expect(snapDiagramDrag([drag('child', 20, 20)], nodes, 1).feedback.lines).toHaveLength(0)
    const bounded = snapDiagramDrag([drag('child', 0, 20)], [...nodes, node('outside', 498, 0, 40)], 1)
    expect(applyNodeChanges(bounded.changes, nodes)[1].position.x).toBe(0)
  })
  it('applies final release snapping but ignores non-drag position updates', () => {
    const nodes = [node('a', 0, 200), node('b', 100, 0)]
    expect(applyNodeChanges(snapDiagramDrag([drag('a', 103, 200, false)], nodes, 1).changes, nodes)[0].position.x).toBe(100)
    const changes: NodeChange[] = [{ type: 'position', id: 'a', position: { x: 103, y: 200 } }]
    expect(snapDiagramDrag(changes, nodes, 1).changes).toEqual(changes)
  })
})

describe('diagram resize guides', () => {
  it.each([0.1, 0.55, 1, 2, 4])('matches dimensions and labels model pixels at zoom %s', zoom => {
    const a = node('a', 200, 200, 80, 60), nodes = [a, node('peer', 0, 0, 120, 120)]
    const result = snapDiagramResize([resize('a', 120 + 3 / zoom, 120 - 2 / zoom)], nodes, session(a), zoom)
    expect(result.feedback.size).toEqual({ x: 200, y: 200, width: 120, height: 120 })
    expect(result.feedback.lines.filter(line => line.kind === 'dimension')).toHaveLength(4)
  })
  it('keeps the right and bottom edge fixed when resizing from top-left', () => {
    const a = node('a', 200, 200, 100, 100), nodes = [a, node('peer', 0, 0, 120, 120)]
    const changes: NodeChange[] = [{ type: 'position', id: 'a', position: { x: 183, y: 179 } }, resize('a', 117, 121)]
    const result = snapDiagramResize(changes, nodes, session(a), 1)
    expect(result.feedback.size).toEqual({ x: 180, y: 180, width: 120, height: 120 })
    expect(applyNodeChanges(result.changes, nodes)[0].position).toEqual({ x: 180, y: 180 })
  })
  it('preserves locked aspect ratios and minimum dimensions', () => {
    const a = node('image', 200, 200, 160, 80), nodes = [a, node('peer', 0, 0, 200, 170)]
    const result = snapDiagramResize([resize('image', 197, 98.5)], nodes, session(a, { keepAspectRatio: true, minWidth: 100, minHeight: 60 }), 1)
    expect(result.feedback.size).toMatchObject({ width: 200, height: 100 })
    const tooSmall = snapDiagramResize([resize('image', 100, 60)], [a, node('tiny', 0, 0, 98, 58)], session(a, { minWidth: 100, minHeight: 60 }), 1)
    expect(tooSmall.feedback.size).toMatchObject({ width: 100, height: 60 })
  })
  it('does not change the untouched axis of a midpoint resize', () => {
    const a = node('a', 200, 200, 100, 80), nodes = [a, node('peer', 0, 0, 120, 83)]
    const result = snapDiagramResize([resize('a', 118, 80)], nodes, session(a), 1)
    expect(result.feedback.size).toMatchObject({ width: 120, height: 80 })
  })
  it('preserves grid-snapped resize dimensions and still reports dimensions', () => {
    const a = node('a', 200, 200), nodes = [a, node('peer', 0, 0, 123, 123)]
    const result = snapDiagramResize([resize('a', 120, 120)], nodes, session(a), 1, true)
    expect(result.feedback.size).toMatchObject({ width: 120, height: 120 })
    expect(result.feedback.lines.filter(line => line.kind === 'dimension')).toHaveLength(0)
  })
  it('does not modify measurements, selection, or resize-stop changes', () => {
    const a = node('a', 200, 200)
    const changes: NodeChange[] = [{ type: 'dimensions', id: 'a', resizing: false }]
    expect(snapDiagramResize(changes, [a], session(a), 1).changes).toEqual(changes)
  })
})
