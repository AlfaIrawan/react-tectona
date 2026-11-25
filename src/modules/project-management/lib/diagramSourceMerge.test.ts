import { describe, expect, it } from 'vitest'
import { mergeDiagramSourceEdges, mergeDiagramSourceNodes } from './diagramSourceMerge'

describe('source edit layout preservation', () => {
  it('preserves existing geometry and paint while placing a newly added task clear of an existing end event', () => {
    const end = { id: 'end', position: { x: 456, y: 492 }, style: { width: 48, height: 48 }, data: { title: 'End', visual: { lineColor: 'red' } } }
    const task = { id: 'notify', position: { x: 392, y: 492 }, style: { width: 176, height: 88 }, data: { title: 'Notify' } }
    const merged = mergeDiagramSourceNodes([end], [{ ...end, position: { x: 0, y: 0 }, data: { title: 'Finished', visual: { lineColor: 'black' } } }, task])
    expect(merged[0]).toMatchObject({ position: end.position, data: { title: 'Finished', visual: { lineColor: 'red' } } })
    expect(merged[1].position.x).toBeGreaterThan(end.position.x + 48)
  })
  it('checks new nodes against each other and keeps container coordinates independent', () => {
    const node = { id: 'a', position: { x: 0, y: 0 }, style: { width: 100, height: 50 }, data: {} }
    const merged = mergeDiagramSourceNodes([], [node, { ...node, id: 'b' }, { ...node, id: 'child', parentNode: 'container' }])
    expect(merged[1].position).not.toEqual(merged[0].position)
    expect(merged[2].position).toEqual(node.position)
  })
  it('keeps manually selected handles only for the same endpoints', () => {
    const prior = { id: 'flow', source: 'a', target: 'b', sourceHandle: 'source-bottom-31', targetHandle: 'target-left', data: { manualConnectionHandles: true } }
    expect(mergeDiagramSourceEdges([prior], [{ id: 'flow', source: 'a', target: 'b', label: 'Updated' }])[0]).toMatchObject({ sourceHandle: prior.sourceHandle, targetHandle: prior.targetHandle, label: 'Updated' })
    expect(mergeDiagramSourceEdges([prior], [{ id: 'flow', source: 'a', target: 'c' }])[0].sourceHandle).toBeUndefined()
  })
})
