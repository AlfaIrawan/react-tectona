import { describe, expect, it } from 'vitest'
import {
  appendProcessDiagramsToText,
  extractProcessDiagramsFromText,
  stripProcessDiagramsFromText,
} from './extractProcessDiagrams'

const AS_IS_SOURCE = '@startuml\n() "Mulai" as start\nrectangle "Cek policy" as check\nstart --> check\n@enduml'
const TO_BE_SOURCE = '@startuml\n() "Mulai" as start\nrectangle "Tanya AI" as ask\nstart --> ask\n@enduml'

describe('process diagram editor helpers', () => {
  it('removes fenced implementation source from the editor prose', () => {
    const draft = `Ringkasan proses\n\nAS-IS\n\`\`\`plantuml\n${AS_IS_SOURCE}\n\`\`\`\n\nTO-BE\n\`\`\`plantuml\n${TO_BE_SOURCE}\n\`\`\``

    expect(stripProcessDiagramsFromText(draft)).toBe('Ringkasan proses\n\nAS-IS\n\nTO-BE')
  })

  it('keeps diagrams as hidden persisted markup that can be extracted later', () => {
    const diagrams = extractProcessDiagramsFromText(`AS-IS\n\`\`\`plantuml\n${AS_IS_SOURCE}\n\`\`\``)
    const persisted = appendProcessDiagramsToText('Ringkasan proses', diagrams)

    expect(persisted).toContain('<!--tectona-process-diagram:')
    expect(stripProcessDiagramsFromText(persisted)).toBe('Ringkasan proses')
    expect(extractProcessDiagramsFromText(persisted)).toHaveLength(1)
  })
})
