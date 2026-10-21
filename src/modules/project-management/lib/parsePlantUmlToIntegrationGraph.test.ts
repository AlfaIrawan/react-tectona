import { describe, expect, it } from 'vitest'
import type { ArchimateElementNodeData } from '@/modules/project-management/lib/integrationArchitectureTypes'
import {
  integrationGraphToPlantUml,
  layerOfPackageTitle,
  parsePlantUmlToIntegrationGraph,
} from '@/modules/project-management/lib/parsePlantUmlToIntegrationGraph'

// The ArchiMate layered view agent-runtime now returns (llm/integration_prompt_builder.py,
// orchestrator/integration_archimate.py). Dev, 21 Oct 2026: the view showed two empty packages.
const LAYERED = `@startuml
package "Business Layer" {
  [Collector Field] as ba_collector_field <<Business Actor>>
  [tanya policy ke AI] as bp_tanya <<Business Process>>
  [berikan jawaban] as bp_jawab <<Business Process>>
}
package "Application Layer" {
  [Chat Gen AI (DigiLearn)] as app_chat <<Application Component>>
  [Dokumen kebijakan] as data_policy <<Data Object>>
}
package "Technology Layer" {
  [Platform DigiLearn] as tech_digilearn <<Technology Node>>
}
ba_collector_field --> bp_tanya : Assignment
bp_tanya ..> bp_jawab : Triggering (Ya)
app_chat --> bp_tanya : Serving
app_chat ..> data_policy : Access
tech_digilearn --> app_chat : Serving
@enduml`

const elements = (source: string) =>
  parsePlantUmlToIntegrationGraph(source).nodes
    .filter((node) => node.type === 'archimateElement')
    .map((node) => node.data as ArchimateElementNodeData)

describe('ArchiMate layered view', () => {
  it('keeps each element type and layer from its stereotype', () => {
    const byTitle = Object.fromEntries(elements(LAYERED).map((data) => [data.title, `${data.layer}/${data.stereotype}`]))
    expect(byTitle['Collector Field']).toBe('business/Business Actor')
    expect(byTitle['tanya policy ke AI']).toBe('business/Business Process')
    expect(byTitle['Chat Gen AI (DigiLearn)']).toBe('application/Application Component')
    expect(byTitle['Dokumen kebijakan']).toBe('data/Application Data Object')
    expect(byTitle['Platform DigiLearn']).toBe('technology/Technology Node')
  })

  it('draws the layers as stacked bands, Business on top', () => {
    const parsed = parsePlantUmlToIntegrationGraph(LAYERED)
    const bands = parsed.nodes.filter((node) => node.type === 'archimateBoundary')
    expect(bands.map((node) => (node.data as { title: string }).title)).toEqual(['Business Layer', 'Application Layer', 'Technology Layer'])
    expect(bands[1].position.y).toBeGreaterThan(bands[0].position.y)
    expect(bands[2].position.y).toBeGreaterThan(bands[1].position.y)
    expect(parsed.edges.length).toBe(5)
    expect(parsed.warnings.filter((warning) => warning.startsWith('Unrecognized'))).toEqual([])
  })

  it('an element without a type takes its layer from the package', () => {
    const data = elements('@startuml\npackage "Business Layer" {\n  [Verifikasi data] as v\n}\n@enduml')[0]
    expect(`${data.layer}/${data.stereotype}`).toBe('business/Business Process')
    expect(layerOfPackageTitle('Lapisan Teknologi')).toBe('technology')
    expect(layerOfPackageTitle('Partner Boundary')).toBe(undefined)
  })

  it('a save and re-parse keeps every element, type and relation', () => {
    const first = parsePlantUmlToIntegrationGraph(LAYERED)
    const saved = integrationGraphToPlantUml(first.nodes, first.edges)
    expect(saved).toContain('[tanya policy ke AI] as bp_tanya <<Business Process>>')
    expect(saved).toContain('[Chat Gen AI (DigiLearn)] as app_chat <<Application Component>>')
    const again = parsePlantUmlToIntegrationGraph(saved)
    expect(elements(saved).map((data) => `${data.title}|${data.stereotype}`)).toEqual(
      elements(LAYERED).map((data) => `${data.title}|${data.stereotype}`),
    )
    expect(again.edges.length).toBe(5)
  })
})

describe('Technology layer types (21 Oct 2026)', () => {
  it('reads Artifact and System Software as technology elements', () => {
    const data = elements('@startuml\npackage "Technology Layer" {\n  [Dokumen Kebijakan] as doc <<Artifact>>\n  [Ubuntu Server] as os <<System Software>>\n}\n@enduml')
    expect(data.map((item) => `${item.layer}/${item.stereotype}/${item.notationId}`)).toEqual([
      'technology/Artifact/technology-layer-artifact',
      'technology/System Software/technology-layer-system-software',
    ])
  })

  it('offers the counterpart type when an element moves to another layer', async () => {
    const { archimateCounterpartType } = await import('@/modules/project-management/lib/integrationArchimateNotationCatalog')
    expect(archimateCounterpartType('Application Data Object', 'technology')).toBe('Artifact')
    expect(archimateCounterpartType('Data Object', 'technology')).toBe('Artifact')
    expect(archimateCounterpartType('Application Component', 'technology')).toBe('System Software')
    expect(archimateCounterpartType('Application Service', 'technology')).toBe('Technology Service')
    expect(archimateCounterpartType('Artifact', 'application')).toBe('Application Data Object')
    expect(archimateCounterpartType('Business Process', 'business')).toBe(null)
    expect(archimateCounterpartType('Data Object', 'data')).toBe(null)
  })
})
