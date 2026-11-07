import { expect, it } from 'vitest'
import type { Edge, Node } from 'reactflow'
import { generateErdDdl } from './erdDdl'
import { copyDiagramSelection, pasteDiagramSelection } from './diagramSelectionActions'
import { reverseDiagramEdge } from './diagramEdgeActions'
import { mergeDiagramSourceEdges } from './diagramSourceMerge'
import { parseErdDdl } from './erdDdlImport'
const fixture = () => {
 const parsed = parseErdDdl('CREATE TABLE qa_parent (id INTEGER PRIMARY KEY); CREATE TABLE qa_child (id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES qa_parent(id));', 'postgresql')
 const nodes: Node[] = parsed.diagram.boxes.map(box => ({ id: box.id, type: 'erdEntity', selected: true, position: { x: 0, y: 0 }, data: { kind: 'element', title: box.title, description: box.members } }))
 const edges: Edge[] = parsed.diagram.links.map((link, i) => ({ id: `e${i}`, type: 'erd', source: link.source, target: link.target, selected: true, data: { erdForeignKey: link.erdForeignKey, sourceMany: link.sourceEnd?.many, targetMany: link.targetEnd?.many, sourceOptional: link.sourceEnd?.optional, targetOptional: link.targetEnd?.optional } }))
 return { nodes, edges }
}
it('preserves imported exact names rather than guessing by table-name conventions', () => {
 const graph = fixture(); expect(generateErdDdl(graph, 'postgresql').sql).toContain('FOREIGN KEY ("parent_id") REFERENCES "qa_parent" ("id")')
 delete graph.edges[0].data.erdForeignKey; expect(generateErdDdl(graph, 'postgresql').sql).not.toContain('FOREIGN KEY')
})
it('remaps explicit child/parent identities on duplicate or copy/paste without changing original', () => {
 const graph = fixture(), copy = copyDiagramSelection(graph.nodes, graph.edges), pasted = pasteDiagramSelection(copy, 'new')
 expect(pasted.edges[0].data.erdForeignKey).toMatchObject({ childNodeId: graph.edges[0].source + '-copy-new', parentNodeId: graph.edges[0].target + '-copy-new' })
 expect(graph.edges[0].data.erdForeignKey.childNodeId).toBe(graph.edges[0].source)
 expect(generateErdDdl(pasted, 'postgresql').sql).toContain('FOREIGN KEY ("parent_id") REFERENCES "qa_parent" ("id")')
})
it('edge reversal preserves semantic child/parent, including cardinality; reconnect fails closed', () => {
 const graph = fixture(); graph.edges[0] = reverseDiagramEdge(graph.edges[0]); expect(generateErdDdl(graph, 'postgresql').sql).toContain('FOREIGN KEY ("parent_id") REFERENCES "qa_parent" ("id")')
 graph.nodes.push({ ...graph.nodes[0], id: 'other', data: { ...graph.nodes[0].data, title: 'other' } }); graph.edges[0].source = 'other'
 const result = generateErdDdl(graph, 'postgresql'); expect(result.sql).not.toContain('FOREIGN KEY'); expect(result.warnings.join(' ')).toContain('without guessing')
})
it('edited/dropped/retargeted columns invalidate stale mappings without heuristic fallback', () => {
 for (const change of ['column', 'type', 'pk', 'marker', 'metadata'] as const) {
  const graph = fixture()
  if (change === 'column') graph.nodes[1].data.description[1] = 'other : INTEGER NOT NULL <<FK>>'
  if (change === 'type') graph.nodes[1].data.description[1] = 'parent_id : TEXT NOT NULL <<FK>>'
  if (change === 'pk') graph.nodes[0].data.description[0] = 'id : INTEGER NOT NULL'
  if (change === 'marker') graph.nodes[1].data.description[1] = 'parent_id : INTEGER NOT NULL'
  if (change === 'metadata') graph.edges[0].data.erdForeignKey = { columns: ['parent_id'] }
  expect(generateErdDdl(graph, 'postgresql').sql, change).not.toContain('FOREIGN KEY')
 }
})
it('preserves metadata during a matching source merge but never assigns it to changed endpoints', () => {
 const graph = fixture(), reparsed = graph.edges.map(edge => ({ ...edge, data: { sourceMany: true, targetMany: false } }))
 expect(mergeDiagramSourceEdges(graph.edges, reparsed)[0].data.erdForeignKey).toEqual(graph.edges[0].data.erdForeignKey)
 expect(mergeDiagramSourceEdges(graph.edges, [{ ...reparsed[0], source: 'other' }])[0].data.erdForeignKey).toBeUndefined()
})
