import { describe, expect, it } from 'vitest'
import {
  appendProcessDiagramsToText,
  extractProcessDiagramsFromText,
  latestRevisedProcessDiagrams,
  latestValidatedTechnicalDiagrams,
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

  it('keeps AS-IS and TO-BE diagrams when both fences are in one assistant response', () => {
    const response = `AS-IS — proses saat ini:\n\`\`\`plantuml\n${AS_IS_SOURCE}\n\`\`\`\n\nTO-BE — proses yang diharapkan:\n\`\`\`plantuml\n${TO_BE_SOURCE}\n\`\`\``

    const diagrams = extractProcessDiagramsFromText(response)

    expect(diagrams).toHaveLength(2)
    expect(diagrams.map((diagram) => diagram.kind)).toEqual(['as_is', 'to_be'])
    expect(diagrams.map((diagram) => diagram.label)).toEqual(['AS-IS', 'TO-BE'])
  })

  it('keeps only the latest revised AS-IS and TO-BE and ignores architecture sketches', () => {
    const revisedAsIs = AS_IS_SOURCE.replace('Cek policy', 'Cek policy di cabang')
    const revisedToBe = TO_BE_SOURCE.replace('Tanya AI', 'Tanya Chat Gen AI')
    const text = [
      `AS-IS — proses saat ini:\n\`\`\`plantuml\n${AS_IS_SOURCE}\n\`\`\``,
      `TO-BE — proses yang diharapkan:\n\`\`\`plantuml\n${TO_BE_SOURCE}\n\`\`\``,
      '```plantuml\n@startuml\n!include <C4/C4_Context>\nPerson(user, "Pengguna")\n@enduml\n```',
      `Revisi AS-IS:\n\`\`\`plantuml\n${revisedAsIs}\n\`\`\``,
      `Gambar TO-BE yang sudah diperbaiki:\n\`\`\`plantuml\n${revisedToBe}\n\`\`\``,
    ].join('\n\n')

    const diagrams = latestRevisedProcessDiagrams(text)

    expect(diagrams.map((diagram) => diagram.label)).toEqual(['AS-IS', 'TO-BE'])
    expect(diagrams[0]?.source).toContain('Cek policy di cabang')
    expect(diagrams[1]?.source).toContain('Tanya Chat Gen AI')
    expect(diagrams.some((diagram) => diagram.source.includes('C4'))).toBe(false)
  })

  it('recovers the latest AS-IS and TO-BE from saved comments that have no lane marker', () => {
    const revisedAsIs = AS_IS_SOURCE.replace('Cek policy', 'Cek policy di cabang')
    const revisedToBe = TO_BE_SOURCE.replace('Tanya AI', 'Tanya Chat Gen AI')
    const text = [
      'AS-IS — proses saat ini:',
      'TO-BE — proses yang diharapkan:',
      'Revisi AS-IS:',
      'Gambar TO-BE yang sudah diperbaiki:',
      `<!--tectona-process-diagram:${encodeURIComponent(AS_IS_SOURCE)}-->`,
      `<!--tectona-process-diagram:${encodeURIComponent(TO_BE_SOURCE)}-->`,
      `<!--tectona-process-diagram:${encodeURIComponent('@startuml\n!include <C4/C4_Context>\n@enduml')}-->`,
      `<!--tectona-process-diagram:${encodeURIComponent(revisedAsIs)}-->`,
      `<!--tectona-process-diagram:${encodeURIComponent(revisedToBe)}-->`,
    ].join('\n')

    const diagrams = latestRevisedProcessDiagrams(text)

    expect(diagrams.map((diagram) => diagram.kind)).toEqual(['as_is', 'to_be'])
    expect(diagrams[0]?.source).toContain('Cek policy di cabang')
    expect(diagrams[1]?.source).toContain('Tanya Chat Gen AI')
  })

  it('keeps the latest confirmed C4, class, and ERD from brainstorming', () => {
    const earlyC4 = '@startuml\n\' tectona-view: c4\n!include <C4/C4_Context>\nPerson(user, "Pengguna")\nSystem(oauth, "OAuth2")\n@enduml'
    const confirmedC4 = '@startuml\n\' tectona-view: c4\n!include <C4/C4_Context>\nPerson(user, "Pengguna")\nSystem(ivanti, "Ivanti")\n@enduml'
    const classSource = '@startuml\n\' tectona-view: class\nclass TicketPayload <<payload>> {\n  branch_id\n}\n@enduml'
    const erdSource = '@startuml\n\' tectona-view: erd\nentity ticket {\n  * id <<PK>>\n}\n@enduml'
    const text = [
      `\`\`\`plantuml\n${earlyC4}\n\`\`\``,
      `\`\`\`plantuml\n${confirmedC4}\n\`\`\``,
      `\`\`\`plantuml\n${classSource}\n\`\`\``,
      `\`\`\`plantuml\n${erdSource}\n\`\`\``,
      `AS-IS\n\`\`\`plantuml\n${AS_IS_SOURCE}\n\`\`\``,
    ].join('\n\n')

    const diagrams = latestValidatedTechnicalDiagrams(text)

    expect(diagrams.map((diagram) => diagram.kind)).toEqual(['c4', 'class', 'erd'])
    expect(diagrams[0]?.source).toContain('Ivanti')
    expect(diagrams[0]?.source).not.toContain('OAuth2')
    expect(latestRevisedProcessDiagrams(text).some((diagram) => diagram.source.includes('C4'))).toBe(false)

    const persisted = appendProcessDiagramsToText('Ringkasan', diagrams)
    expect(persisted).toContain('tectona-process-diagram:c4:')
    expect(persisted).toContain('tectona-process-diagram:class:')
    expect(persisted).toContain('tectona-process-diagram:erd:')
    expect(latestValidatedTechnicalDiagrams(persisted).map((diagram) => diagram.kind)).toEqual(['c4', 'class', 'erd'])
  })
})
