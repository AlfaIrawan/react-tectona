import { describe, expect, it } from 'vitest'
import { diagramGraphKey, recordDiagramEdit, redoDiagramEdit, undoDiagramEdit, type DiagramGraph } from './diagramHistory'

const graph = (x = 0): DiagramGraph => ({ nodes: [{ id: 'a', position: { x, y: 0 }, style: { width: 120, height: 60 }, data: { title: 'Task' } }], edges: [], source: 'Task' })
describe('diagram document history', () => {
  it('undoes and redoes geometry and content together, then discards a stale redo branch', () => {
    const original = graph()
    const moved = graph(200)
    const connected = { ...moved, source: 'Task --> End', edges: [{ id: 'flow', source: 'a', target: 'b', sourceHandle: 'source-right', targetHandle: 'target-left', data: { manualConnectionHandles: true } }] }
    let h = recordDiagramEdit({ past: [], present: original, future: [] }, moved)
    h = recordDiagramEdit(h, connected)
    h = undoDiagramEdit(h)
    expect(h.present).toEqual(moved)
    h = redoDiagramEdit(h)
    expect(h.present).toEqual(connected)
    h = undoDiagramEdit(undoDiagramEdit(h))
    expect(h.present).toEqual(original)
    h = recordDiagramEdit(h, graph(30))
    expect(h.future).toEqual([])
    expect(redoDiagramEdit(h).present.nodes[0].position.x).toBe(30)
  })
  it('ignores selection, measurement hydration, and generated source refreshes', () => {
    const original = graph()
    const measured = { ...original, nodes: [{ ...original.nodes[0], selected: true, dragging: true, width: 120, height: 60 }], source: 'normalized Task' }
    expect(diagramGraphKey(measured)).toBe(diagramGraphKey(original))
    expect(recordDiagramEdit({ past: [], present: original, future: [] }, measured).past).toHaveLength(0)
  })
  it('bounds the history and retains node deletion for recovery', () => {
    let h = { past: [] as DiagramGraph[], present: graph(), future: [] as DiagramGraph[] }
    for (let i = 1; i <= 120; i++) h = recordDiagramEdit(h, graph(i))
    expect(h.past).toHaveLength(100)
    h = recordDiagramEdit(h, { nodes: [], edges: [], source: '' })
    expect(undoDiagramEdit(h).present.nodes[0].position.x).toBe(120)
  })
})
