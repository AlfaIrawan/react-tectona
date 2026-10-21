import { describe, expect, it } from 'vitest'

import { parseFlowchartFallback, processPlantUmlToMermaid } from './mermaidFallbackSvg'

const PROCESS = [
  '@startuml',
  'top to bottom direction',
  '() "Mulai" as process_start',
  '() "Selesai" as process_end',
  'rectangle "Business User: buat URD\\nmanual" as node_u1',
  'hexagon "Sudah clear?" as node_u4',
  'rectangle "Tim: diskusi (email)" as node_u5',
  'process_start --> node_u1',
  'node_u1 --> node_u4',
  'node_u4 --> node_u5 : Tidak',
  'node_u5 --> node_u1',
  'node_u4 --> process_end : Ya',
  '@enduml',
].join('\n')

describe('processPlantUmlToMermaid', () => {
  it('keeps step names, decisions and branch labels for the local sketch', () => {
    const mermaid = processPlantUmlToMermaid(PROCESS)
    expect(mermaid).not.toBeNull()
    const graph = parseFlowchartFallback(mermaid!)
    const labels = graph!.nodes.map((node) => node.label)
    expect(labels).toContain('Business User: buat URD manual')
    expect(labels).toContain('Tim: diskusi email')
    expect(labels.some((label) => label.startsWith('node_'))).toBe(false)
    expect(graph!.nodes.find((node) => node.label === 'Sudah clear?')?.shape).toBe('diamond')
    expect(graph!.edges.some((edge) => edge.label === 'Tidak')).toBe(true)
  })

  it('leaves other PlantUML alone', () => {
    expect(processPlantUmlToMermaid('@startuml\nrectangle "A" as a\na --> b\n@enduml')).toBeNull()
  })
})
