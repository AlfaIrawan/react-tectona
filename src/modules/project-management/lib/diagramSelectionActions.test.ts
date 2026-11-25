import { describe, expect, it } from 'vitest'
import type { Edge, Node } from 'reactflow'
import { arrangeDiagramSelection, canCutDiagramSelection, deletableDiagramNodeIds, copyDiagramSelection, diagramAbsolutePositions, diagramSelectedRoots, pasteDiagramSelection } from './diagramSelectionActions'
const node = (id: string, x: number, y: number, width = 100, height = 50): Node => ({ id, position: { x, y }, style: { width, height }, selected: true, data: { title: id } })
const edge: Edge = { id: 'ab', source: 'a', target: 'b', sourceHandle: 'source-right-25', targetHandle: 'target-left-60', data: { manualConnectionHandles: true, visual: { endArrow: 'classic' }, segmentRoute: { routingVersion: 2, points: [{ x: 100, y: 25 }, { x: 200, y: 25 }, { x: 200, y: 150 }], controls: [{ id: 'p', axis: 'x', x: 200, y: 80 }] } } }
describe('multi-object diagram clipboard', () => {
  it('copies selection plus internal edges, not external incident edges', () => {
    const nodes = [node('a', 0, 0), node('b', 200, 100), { ...node('c', 500, 0), selected: false }]
    const copy = copyDiagramSelection(nodes, [edge, { id: 'bc', source: 'b', target: 'c' }], 'a')
    expect(copy.nodes.map(n => n.id)).toEqual(['a', 'b']); expect(copy.edges.map(e => e.id)).toEqual(['ab'])
    copy.nodes[0].data.title = 'changed'; expect(nodes[0].data.title).toBe('a')
  })
  it('includes unselected container descendants and remaps hierarchy in parent-first order', () => {
    const nodes = [{ ...node('child', 20, 30), parentNode: 'group', extent: 'parent' as const, selected: false }, node('group', 400, 300)]
    const copy = copyDiagramSelection(nodes, [], 'group'), pasted = pasteDiagramSelection(copy, 'new', { x: 900, y: 800 })
    expect(pasted.nodes.map(n => n.id)).toEqual(['group-copy-new', 'child-copy-new'])
    expect(pasted.nodes[0].position).toEqual({ x: 900, y: 800 })
    expect(pasted.nodes[1]).toMatchObject({ parentNode: 'group-copy-new', extent: 'parent', position: { x: 20, y: 30 } })
  })
  it('detaches a copied child from an uncopied parent using absolute coordinates', () => {
    const copy = copyDiagramSelection([{ ...node('parent', 300, 400), selected: false }, { ...node('child', 20, 30), parentNode: 'parent', extent: 'parent' }], [], 'child')
    expect(copy.nodes[0]).toMatchObject({ parentNode: undefined, extent: undefined, position: { x: 320, y: 430 } })
  })
  it('rekeys edges and translates routes/controls while preserving anchors and appearance', () => {
    const copy = copyDiagramSelection([node('a', 0, 0), node('b', 200, 100)], [edge], 'a')
    const pasted = pasteDiagramSelection(copy, 'new')
    expect(pasted.edges[0]).toMatchObject({ id: 'ab-copy-new', source: 'a-copy-new', target: 'b-copy-new', sourceHandle: edge.sourceHandle, data: { manualConnectionHandles: true, segmentRoute: { points: [{ x: 132, y: 57 }, { x: 232, y: 57 }, { x: 232, y: 182 }], controls: [{ id: 'p', axis: 'x', x: 232, y: 112 }] } } })
    expect(pasted.edges[0].data.visual).toEqual(edge.data.visual)
    expect(copy.edges[0]).toEqual(edge)
  })
  it('starts a fresh selection for an unselected context target and omits noncloneable edges', () => {
    const nodes = [node('a', 0, 0), { ...node('b', 200, 0), selected: false }]
    expect(copyDiagramSelection(nodes, [edge], 'b').nodes.map(n => n.id)).toEqual(['b'])
    expect(copyDiagramSelection(nodes.map(n => ({ ...n, selected: true })), [{ ...edge, data: { arrange: { cloneable: false } } }]).edges).toEqual([])
  })
})
describe('selection alignment and distribution', () => {
  const nodes = () => [node('a', 0, 0, 100, 50), node('b', 300, 100, 200, 100), node('c', 600, 400, 100, 50)]
  it.each([['left', [0, 0, 0]], ['center', [300, 250, 300]], ['right', [600, 500, 600]]] as const)('aligns %s with variable widths', (action, expected) => {
    expect(arrangeDiagramSelection(nodes(), [], action).nodes.map(n => n.position.x)).toEqual(expected)
  })
  it.each([['top', [0, 0, 0]], ['middle', [200, 175, 200]], ['bottom', [400, 350, 400]]] as const)('aligns %s with variable heights', (action, expected) => {
    expect(arrangeDiagramSelection(nodes(), [], action).nodes.map(n => n.position.y)).toEqual(expected)
  })
  it('distributes equal horizontal and vertical gaps, holding the endpoints fixed', () => {
    expect(arrangeDiagramSelection(nodes(), [], 'horizontal').nodes.map(n => n.position.x)).toEqual([0, 250, 600])
    expect(arrangeDiagramSelection(nodes(), [], 'vertical').nodes.map(n => n.position.y)).toEqual([0, 175, 400])
  })
  it('does not move children twice when their parent is selected', () => {
    const graph = [node('a', 200, 100), { ...node('child', 20, 30), parentNode: 'a' }, node('b', 500, 300)]
    expect(diagramSelectedRoots(graph).map(n => n.id)).toEqual(['a', 'b'])
    const next = arrangeDiagramSelection(graph, [], 'left')
    expect(next.nodes[1].position).toEqual({ x: 20, y: 30 })
    expect(diagramAbsolutePositions(next.nodes).get('child')).toEqual({ x: 220, y: 130 })
  })
  it('aligns children of different parents in absolute canvas coordinates', () => {
    const graph = [{ ...node('p', 200, 100), selected: false }, { ...node('a', 30, 40), parentNode: 'p' }, node('b', 500, 400)]
    const next = arrangeDiagramSelection(graph, [], 'right')
    expect(diagramAbsolutePositions(next.nodes).get('a')?.x).toBe(500)
    expect(next.nodes[1].position.x).toBe(300)
  })
  it('ignores locked nodes and insufficient selections', () => {
    const graph = [node('a', 0, 0), { ...node('b', 300, 100), draggable: false }]
    expect(arrangeDiagramSelection(graph, [], 'left').nodes).toBe(graph)
    expect(arrangeDiagramSelection(nodes().slice(0, 2), [], 'horizontal').nodes).toHaveLength(2)
  })
  it('translates internal container routes and retains authored bends for unequal endpoint movement', () => {
    const graph = [node('group', 300, 200), { ...node('a', 0, 0), parentNode: 'group', selected: false }, { ...node('b', 200, 100), parentNode: 'group', selected: false }, node('other', 0, 0)]
    const next = arrangeDiagramSelection(graph, [edge], 'left')
    expect(next.edges[0].data.segmentRoute.controls[0].x).toBe(-100)
    expect(next.edges[0].sourceHandle).toBe(edge.sourceHandle)
    expect(arrangeDiagramSelection([node('a', 0, 0), node('b', 200, 100)], [edge], 'left').edges[0]).toBe(edge)
  })
})

it('protects node and relation flags across cut/delete/align/clone', () => {
  const nodes = [node('a', 0, 0), node('b', 200, 100)]
  const protectedEdge = { ...edge, data: { arrange: { deletable: false } } }
  const copy = copyDiagramSelection(nodes, [protectedEdge], 'a')
  expect(canCutDiagramSelection(copy, nodes, [protectedEdge])).toBe(false)
  expect(deletableDiagramNodeIds(nodes, [protectedEdge], new Set(['a', 'b']))).toEqual(new Set())
  expect(canCutDiagramSelection(copy, [{ ...nodes[0], deletable: false }, nodes[1]], [edge])).toBe(false)
  expect(diagramSelectedRoots([{ ...nodes[0], data: { arrange: { movable: false } } }, nodes[1]]).map(n => n.id)).toEqual(['b'])
  expect(copyDiagramSelection([{ ...nodes[0], data: { arrange: { cloneable: false } } }, nodes[1]], [edge]).nodes.map(n => n.id)).toEqual(['b'])
})
