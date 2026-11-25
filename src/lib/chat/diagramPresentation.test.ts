import { expect, it } from 'vitest'
import { diagramPresentation, diagramSourceDescription } from './diagramPresentation'
it.each(['archimate', 'c4', 'erd', 'class', 'sequence', 'use-case'])('labels explicit technical %s without calling it process flow', kind => {
  const result = diagramPresentation(`@startuml\n' tectona-view: ${kind}\n@enduml`, 'plantuml')
  expect(result.caption).not.toContain('process flow')
  expect(result.caption).not.toBe('PlantUML diagram')
  expect(result.alt).toBe(result.caption)
})
it('reports actual BPMN rendering and leaves unknown PlantUML generic', () => {
  expect(diagramPresentation('anything', 'bpmn').caption).toBe('BPMN process flow')
  expect(diagramPresentation('@startuml\n@enduml', 'plantuml').caption).toBe('PlantUML diagram')
})

it('does not guess sequence from an actor alone and describes copied Mermaid accurately', () => {
  expect(diagramPresentation('@startuml\nactor Customer\n@enduml', 'plantuml').caption).toBe('PlantUML diagram')
  expect(diagramSourceDescription('flowchart TD\na --> b')).toBe('Mermaid source is in the clipboard.')
})
