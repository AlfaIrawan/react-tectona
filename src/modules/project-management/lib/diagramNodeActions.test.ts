import { describe, expect, it } from 'vitest'
import type { Node } from 'reactflow'
import { pasteDiagramNodes, removeDiagramNode, removeDiagramNodes } from './diagramNodeActions'
const nodes: Node[] = [
  { id: 'outer', position: { x: 100, y: 200 }, data: {} },
  { id: 'inner', parentNode: 'outer', extent: 'parent', position: { x: 40, y: 50 }, data: {} },
  { id: 'child', parentNode: 'inner', extent: 'parent', position: { x: 10, y: 20 }, data: {} },
  { id: 'other', position: { x: 500, y: 600 }, data: {} },
]
describe('diagram container actions', () => {
  it('detaches direct children at absolute positions while retaining deeper hierarchy', () => {
    const next = removeDiagramNode(nodes, 'outer')
    expect(next.map(n => n.id)).toEqual(['inner', 'child', 'other'])
    expect(next[0]).toMatchObject({ parentNode: undefined, extent: undefined, position: { x: 140, y: 250 } })
    expect(next[1]).toBe(nodes[2])
    expect(nodes[1].parentNode).toBe('outer')
  })
  it('includes all ancestor offsets when deleting a nested container', () => {
    expect(removeDiagramNode(nodes, 'inner').find(n => n.id === 'child')).toMatchObject({ parentNode: undefined, extent: undefined, position: { x: 150, y: 270 } })
  })
  it('deleting a leaf preserves every unrelated node and its coordinates', () => {
    expect(removeDiagramNode(nodes, 'child')).toEqual([nodes[0], nodes[1], nodes[3]])
  })
  it('pastes root nodes at cursor preserving relative root spacing and nested offsets', () => {
    const ids = new Map(nodes.map(n => [n.id, `${n.id}-paste`]))
    const next = pasteDiagramNodes(nodes, { x: 1000, y: 2000 }, ids)
    expect(next[0].position).toEqual({ x: 1000, y: 2000 })
    expect(next[1]).toMatchObject({ id: 'inner-paste', parentNode: 'outer-paste', extent: 'parent', position: { x: 40, y: 50 } })
    expect(next[2]).toMatchObject({ parentNode: 'inner-paste', position: { x: 10, y: 20 } })
    expect(next[3].position).toEqual({ x: 1400, y: 2400 })
  })
  it('clears missing parent references and parent extents when pasted without the parent', () => {
    expect(pasteDiagramNodes([nodes[2]], { x: 900, y: 700 }, new Map([['child', 'copy']]))[0]).toMatchObject({ id: 'copy', parentNode: undefined, extent: undefined, position: { x: 900, y: 700 } })
  })
})

it('removes all selected nodes while preserving unselected descendants regardless of selection order', () => {
  for (const ids of [['outer', 'inner'], ['inner', 'outer']]) {
    const next = removeDiagramNodes(nodes, new Set(ids))
    expect(next.map(node => node.id)).toEqual(['child', 'other'])
    expect(next[0]).toMatchObject({ parentNode: undefined, extent: undefined, position: { x: 150, y: 270 } })
  }
  expect(removeDiagramNodes(nodes, new Set(nodes.map(node => node.id)))).toEqual([])
})
