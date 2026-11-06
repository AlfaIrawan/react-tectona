import { describe, expect, it } from 'vitest'
import { canUseStraightOrthogonalPath, retainConnectionHandlePercents, connectionAnchor, connectionClientPoint, hasManualConnectionHandles, reconnectDiagramEdge } from './diagramConnections'
import type { Edge } from 'reactflow'

describe('diagram connections', () => {
  it('keeps identity, labels and styling through repeated endpoint moves', () => {
    const original: Edge = { id: 'flow-1', source: 'a', target: 'b', label: 'Yes', data: { visual: { lineColor: 'red' } } }
    const other: Edge = { id: 'other', source: 'x', target: 'y' }
    let edges = [original, other]
    for (const target of ['c', 'b', 'd']) {
      edges = reconnectDiagramEdge(edges.find(e => e.id === 'flow-1')!, { source: 'a', target, sourceHandle: 'source-right-12', targetHandle: 'source-top' }, edges)
      expect(edges.find(e => e.id === 'flow-1')).toMatchObject({ id: 'flow-1', target, label: 'Yes', selected: true, data: original.data })
      expect(hasManualConnectionHandles(edges.find(e => e.id === 'flow-1')!)).toBe(true)
      expect(edges.find(e => e.id === 'other')).toBe(other)
    }
    expect(hasManualConnectionHandles({ ...edges[0], data: { manualConnectionHandles: false } })).toBe(false)
    expect(hasManualConnectionHandles({ ...edges[0], targetHandle: undefined })).toBe(false)
  })

  it('reads touch release coordinates, including a completed touch with no active touches', () => {
    expect(connectionClientPoint({ clientX: 5, clientY: 9 } as MouseEvent)).toEqual({ x: 5, y: 9 })
    expect(connectionClientPoint({ changedTouches: [{ clientX: 40, clientY: 70 }], touches: [] } as unknown as TouchEvent)).toEqual({ x: 40, y: 70 })
  })

  it('places BPMN anchors on the actual perimeter at every size and viewport transform', () => {
    for (const shape of ['ellipse', 'diamond'] as const) {
      for (const side of ['top', 'right', 'bottom', 'left'] as const) {
        for (const percent of [12, 25, 50, 75, 88]) {
          const p = connectionAnchor(side, percent, shape)
          const x = (p.x - 50) / 50, y = (p.y - 50) / 50
          expect(shape === 'ellipse' ? x * x + y * y : Math.abs(x) + Math.abs(y)).toBeCloseTo(1)
          for (const zoom of [0.1, 0.55, 1, 1.4, 4]) {
            for (const size of [40, 96, 180]) {
              const screenX = 123 + p.x / 100 * size * zoom
              expect((screenX - 123) / zoom / size * 100).toBeCloseTo(p.x)
            }
          }
        }
      }
    }
    expect(connectionAnchor('right', 25)).toEqual({ x: 100, y: 25 })
  })
})

describe('resizing and orthogonal routing', () => {
  it('retains used dots when a shape shrinks and its suggested dots change', () => {
    expect(retainConnectionHandlePercents('right', [50], ['target-right-50.5'])).toEqual([50, 50.5])
    expect(retainConnectionHandlePercents('right', [50], ['source-right-12', 'target-right-88', 'source-top-20', 'source-right-999'])).toEqual([12, 50, 88])
    expect(retainConnectionHandlePercents('right', [12, 50, 88], ['source-right-12'])).toEqual([12, 50, 88])
  })
  it('keeps only exactly aligned, opposite-facing terminals straight', () => {
    const path = { sourceX: 100, sourceY: 20, targetX: 300, targetY: 20, sourcePosition: 'right', targetPosition: 'left' }
    expect(canUseStraightOrthogonalPath(path)).toBe(true)
    expect(canUseStraightOrthogonalPath({ ...path, targetY: 24 })).toBe(false)
    expect(canUseStraightOrthogonalPath({ ...path, targetPosition: 'right' })).toBe(false)
    expect(canUseStraightOrthogonalPath({ ...path, targetX: 50 })).toBe(false)
    expect(canUseStraightOrthogonalPath({ ...path, sourcePosition: 'bottom', targetPosition: 'top', sourceX: 100, targetX: 100, targetY: 200 })).toBe(true)
  })
})
