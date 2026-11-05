import { expect, it } from 'vitest'
import { runtimeProcessDiagramFromPersistent } from './processDiagramService'

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
