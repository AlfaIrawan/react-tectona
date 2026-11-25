import { expect, it } from 'vitest'
import { runtimeProcessDiagramFromPersistent, buildPersistentProcessDiagramPayload, emptyRuntimeProcessDiagramAnalysis } from './processDiagramService'

it('keeps canvas snapshot and export failure in the persisted graph contract', () => {
  const payload = buildPersistentProcessDiagramPayload({ ...emptyRuntimeProcessDiagramAnalysis(),
    canvasGraph: { nodes: [], edges: [], source: 'source', canvasPngBase64: 'snapshot', canvasExportError: true },
  }, 'tester')
  expect(payload.process_json.canvas_png_base64).toBe('snapshot')
  expect(payload.process_json.canvas_export_error).toBe(true)
  const graph = runtimeProcessDiagramFromPersistent({ process_json: payload.process_json } as never).canvasGraph
  expect(graph?.canvasPngBase64).toBe('snapshot')
  expect(graph?.canvasExportError).toBe(true)
})

it('retains server-only technical sources without requiring editor canvas nodes', () => {
  const source = '@startuml\nparticipant User\nUser -> API : query\n@enduml'
  const result = runtimeProcessDiagramFromPersistent({ status: 'ok', process_json: { plantuml_source: source } } as never)
  expect(result.canvasGraph?.source).toBe(source)
  expect(result.canvasGraph?.nodes).toEqual([])
})

it('retains source-only BPMN and leaves genuinely empty records empty', () => {
  const source = '<definitions><process id="p" /></definitions>'
  expect(runtimeProcessDiagramFromPersistent({ process_json: { bpmn_xml: source } } as never).canvasGraph?.source).toBe(source)
  expect(runtimeProcessDiagramFromPersistent({ process_json: {} } as never).canvasGraph).toBeUndefined()
})
