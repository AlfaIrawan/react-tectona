import { expect, it, vi } from 'vitest'
import { buildReadOnlyDiagramCanvasGraph } from './editableDiagramGraph'
import { buildVerifiedNativePreview } from './readOnlyDiagramPreview'

it('projects a lossless use-case graph as read-only and rejects unsupported relations', () => {
  const source = '@startuml\nactor "Clerk" as clerk\nusecase "Review" as review\nclerk -- review\n@enduml'
  const graph = buildReadOnlyDiagramCanvasGraph(source, 'use-case')
  expect(graph.nodes).toHaveLength(2)
  expect(graph.edges).toHaveLength(1)
  expect(buildVerifiedNativePreview(source, 'use-case')).toEqual({
    nodes: graph.nodes.map(node => ({ ...node, draggable: false, selectable: false, connectable: false, deletable: false, focusable: false })),
    edges: graph.edges.map(edge => ({ ...edge, selectable: false, deletable: false, focusable: false, updatable: false })),
  })
  expect(buildVerifiedNativePreview(source.replace('clerk -- review', 'clerk --> review'), 'use-case')).toBeNull()
})

it.each([
  ['use-case', 'actor Clerk as clerk\nusecase "Review" as review\nclerk -- review', 'clerk', 'review'],
  ['class', 'class Clerk\nclass Invoice\nClerk --> Invoice', 'Clerk', 'Invoice'],
  ['erd', 'entity Clerk\nentity Invoice\nClerk ||--o{ Invoice', 'Clerk', 'Invoice'],
  ['c4', 'System_Boundary(root, "Root") {\nContainer(clerk,"Clerk","Web")\nContainer(review,"Review","SQL")\n}\nRel(clerk, review, "Reads")', 'clerk', 'review'],
  ['bpmn', 'rectangle "Clerk: Validate" as check\nrectangle "Archive: Store" as store\ncheck --> store : Accepted', 'check', 'store'],
  ['plantuml', 'rectangle "Validate" as check\nrectangle "Store" as store\ncheck --> store : Accepted', 'check', 'store'],
] as const)('preserves %s graph topology, layout and storage independence', (format, text, from, to) => {
  const read = vi.spyOn(Storage.prototype, 'getItem')
  const write = vi.spyOn(Storage.prototype, 'setItem')
  try {
    const source = `@startuml\n${text}\n@enduml`
    const graph = buildReadOnlyDiagramCanvasGraph(source, format)
    expect(graph.nodes.map(node => node.id)).toEqual(expect.arrayContaining([from, to]))
    expect(graph.edges).toEqual([expect.objectContaining({ source: from, target: to })])
    for (const node of graph.nodes) {
      expect(Number.isFinite(node.position.x)).toBe(true)
      expect(Number.isFinite(node.position.y)).toBe(true)
    }
    if (format === 'bpmn') {
      const task = graph.nodes.find(node => node.id === from)
      const target = graph.nodes.find(node => node.id === to)
      expect(task).toMatchObject({ zIndex: 2, data: { bpmnLane: 'Clerk' } })
      expect(target).toMatchObject({ zIndex: 2, data: { bpmnLane: 'Archive' } })
      expect(graph.nodes).toEqual(expect.arrayContaining([
        expect.objectContaining({ zIndex: 0, data: expect.objectContaining({ title: 'Clerk', notationId: 'lane' }) }),
        expect.objectContaining({ zIndex: 0, data: expect.objectContaining({ title: 'Archive', notationId: 'lane' }) }),
      ]))
      expect(task?.position.y).not.toBe(target?.position.y)
      expect(graph.edges[0].label).toBe('Accepted')
    }
    if (format === 'c4') {
      expect(graph.nodes.find(node => node.id === from)?.parentNode).toBe('root')
      expect(graph.nodes.find(node => node.id === to)?.parentNode).toBe('root')
      expect(graph.edges[0].label).toBe('Reads')
    }
    expect(read).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
  } finally {
    read.mockRestore()
    write.mockRestore()
  }
})
