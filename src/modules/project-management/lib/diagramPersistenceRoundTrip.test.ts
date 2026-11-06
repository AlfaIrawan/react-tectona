import { expect, it } from 'vitest'
import type { ProcessCanvasGraph } from './processDiagramService'
import { buildPersistentProcessDiagramPayload, emptyRuntimeProcessDiagramAnalysis, runtimeProcessDiagramFromPersistent } from './processDiagramService'
import { buildPersistentC4Payload, emptyRuntimeC4Analysis, runtimeC4FromPersistent } from './c4ArchitectureService'
import { buildPersistentIntegrationPayload, EMPTY_RUNTIME_INTEGRATION_ANALYSIS, graphRecordFromPersistentIntegration, storedIntegrationNeedsRegeneration } from './integrationArchitectureService'

const viewport = { x: -123.5, y: 67.25, zoom: 0.625 }
const source = '@startuml\ncomponent "Service" as svc\ncomponent "API" as api\nsvc --> api\n@enduml'
const graph: ProcessCanvasGraph & { userCustomized: boolean } = {
  nodes: [{ id: 'svc', position: { x: 13.25, y: -42.5 }, data: { kind: 'element', layer: 'application', stereotype: 'Application Component', title: 'Service', description: [], notationId: 'svc' } }, { id: 'api', position: { x: 450, y: 80 }, data: { kind: 'element', layer: 'application', stereotype: 'Application Component', title: 'API', description: [], notationId: 'api' } }],
  edges: [{ id: 'edge', source: 'svc', target: 'api', sourceHandle: 'right-37.25', targetHandle: 'left-68.75', data: { manualConnectionHandles: true, lineStyle: 'dashed' }, style: { strokeDasharray: '6 4' } }],
  source, viewport, userCustomized: true, snapToGrid: false,
}

it('round-trips process positions, fractional endpoints, style and viewport through the API payload', () => {
  const payload = buildPersistentProcessDiagramPayload({ ...emptyRuntimeProcessDiagramAnalysis(), canvasGraph: graph }, 'tester')
  const loaded = runtimeProcessDiagramFromPersistent({ process_json: payload.process_json } as never).canvasGraph
  expect(loaded).toMatchObject(graph)
})

it('retains an intentionally cleared process graph instead of reviving the previous BPMN source', () => {
  const payload = buildPersistentProcessDiagramPayload({ ...emptyRuntimeProcessDiagramAnalysis(), bpmnXml: '<definitions>old diagram</definitions>', canvasGraph: { ...graph, nodes: [], edges: [], source: '' } }, 'tester')
  expect(runtimeProcessDiagramFromPersistent({ process_json: payload.process_json } as never).canvasGraph).toMatchObject({ nodes: [], edges: [], source: '', viewport, userCustomized: true })
})

for (const level of ['L1', 'L2'] as const) {
  it(`round-trips ${level} geometry and preserves deletion of the last node`, () => {
    const analysis = { ...emptyRuntimeC4Analysis(level), plantumlSource: source, canvasGraph: graph }
    const populated = buildPersistentC4Payload(analysis, 'tester')
    expect(runtimeC4FromPersistent({ level, c4_json: populated.c4_json } as never).canvasGraph).toMatchObject(graph)
    const cleared = buildPersistentC4Payload({ ...analysis, canvasGraph: { ...graph, nodes: [], edges: [], source: '' } }, 'tester')
    expect(cleared.c4_json.plantuml_source).toBe('')
    expect(runtimeC4FromPersistent({ level, c4_json: cleared.c4_json } as never).canvasGraph).toMatchObject({ nodes: [], edges: [], source: '', viewport })
    expect(runtimeC4FromPersistent({ level, c4_json: {} } as never).canvasGraph).toBeUndefined()
  })
}

it('round-trips ArchiMate endpoints and does not rebuild deleted nodes from a stale source', () => {
  const record = { ...graph, plantumlSource: source, savedAt: '2026-11-06T00:00:00Z' }
  const payload = buildPersistentIntegrationPayload(EMPTY_RUNTIME_INTEGRATION_ANALYSIS, record, 'tester')
  const loaded = graphRecordFromPersistentIntegration({ integration_json: payload.integration_json, generated_at: record.savedAt } as never)
  expect(loaded.edges).toEqual(graph.edges)
  expect(loaded.nodes.map(({ id, position }) => ({ id, position }))).toEqual(graph.nodes.map(({ id, position }) => ({ id, position })))
  const cleared = buildPersistentIntegrationPayload(EMPTY_RUNTIME_INTEGRATION_ANALYSIS, { ...record, nodes: [], edges: [] }, 'tester')
  expect(graphRecordFromPersistentIntegration({ integration_json: cleared.integration_json } as never)).toMatchObject({ nodes: [], edges: [], viewport, userCustomized: true })
})

it('continues parsing uncustomized source-only legacy ArchiMate records', () => {
  const loaded = graphRecordFromPersistentIntegration({ integration_json: { nodes: [], edges: [], plantuml_source: source, user_customized: false } } as never)
  expect(loaded.nodes.length).toBe(2)
  expect(loaded.edges.length).toBe(1)
})

it('does not automatically regenerate a user-cleared ArchiMate diagram', () => {
  expect(storedIntegrationNeedsRegeneration({ status: 'ok' }, { nodes: [], userCustomized: true })).toBe(false)
  expect(storedIntegrationNeedsRegeneration({ status: 'ok' }, { nodes: [], userCustomized: false })).toBe(true)
})
