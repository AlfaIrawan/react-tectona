import { describe, expect, it } from 'vitest'
import {
  appendProcessDiagramsToText,
  extractProcessDiagramsFromText,
  latestRevisedProcessDiagrams,
  latestValidatedTechnicalDiagrams,
  stripProcessDiagramsFromText,
  technicalDiagramGallery,
  TECHNICAL_DIAGRAM_SLOTS,
} from './extractProcessDiagrams'

const AS_IS_SOURCE = '@startuml\n() "Mulai" as start\nrectangle "Cek policy" as check\nstart --> check\n@enduml'
const TO_BE_SOURCE = '@startuml\n() "Mulai" as start\nrectangle "Tanya AI" as ask\nstart --> ask\n@enduml'

describe('process diagram editor helpers', () => {
  it('keeps both C4 levels and only replaces revisions of the same level', () => {
    const l1 = '@startuml\n!include <C4/C4_Context>\nSystem(app, "Application")\n@enduml'
    const l2 = '@startuml\n!include <C4/C4_Container>\nContainer(api, "API")\n@enduml'
    const revised = l1.replace('Application', 'Revised Application')
    const text = [l1, l2, revised].map(source => `\`\`\`plantuml\n${source}\n\`\`\``).join('\n')
    expect(latestValidatedTechnicalDiagrams(text).map(d => [d.label, d.source]))
      .toEqual([['C4 Level 1', revised], ['C4 Level 2', l2]])
  })

  it('lists every technical slot without relying on a browser brainstorming cache', () => {
    const gallery = technicalDiagramGallery([], {})
    expect(gallery.map(d => d.label)).toEqual(['C4 Level 1', 'C4 Level 2', 'Sequence', 'Use Case', 'Class', 'ERD'])
    expect(gallery.every(d => d.source === '')).toBe(true)
    expect(TECHNICAL_DIAGRAM_SLOTS.map(d => d.persistKey)).toEqual([
      'brainstorm-c4-level-1', 'brainstorm-c4-level-2', 'brainstorm-sequence', 'brainstorm-use-case', 'brainstorm-class', 'brainstorm-erd',
    ])
  })

  it('uses server sources absent from prose and prefers saved edits over old text', () => {
    const sequence = '@startuml\nparticipant User\nUser -> API : latest\n@enduml'
    const erd = '@startuml\nentity Policy\n@enduml'
    const gallery = technicalDiagramGallery([{ kind: 'sequence', label: 'Sequence', source: 'old sequence' }], {
      'brainstorm-sequence': { source: sequence }, 'brainstorm-erd': { source: erd },
    })
    expect(gallery.find(d => d.kind === 'sequence')?.source).toBe(sequence)
    expect(gallery.find(d => d.kind === 'erd')?.source).toBe(erd)
    expect(gallery).toHaveLength(6)
  })

  it('removes fenced implementation source from the editor prose', () => {
    const draft = `Ringkasan proses\n\nAS-IS\n\`\`\`plantuml\n${AS_IS_SOURCE}\n\`\`\`\n\nTO-BE\n\`\`\`plantuml\n${TO_BE_SOURCE}\n\`\`\``

    expect(stripProcessDiagramsFromText(draft)).toBe('Ringkasan proses')
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

  it('keeps a confirmed sequence diagram with the technical set', () => {
    const sequence = '@startuml\nparticipant User\nparticipant API\nUser -> API : submit\n@enduml'
    const text = `\`\`\`plantuml\n${sequence}\n\`\`\``
    expect(latestValidatedTechnicalDiagrams(text).map((diagram) => diagram.kind)).toEqual(['sequence'])
    expect(latestRevisedProcessDiagrams(text)).toEqual([])
  })
})


describe('captions attached to extracted business-process sources', () => {
  it.each(['as-is', 'AS-IS', 'AS-IS:', '## AS-IS', '**AS-IS:**', 'AS IS'])('removes only the attached caption %s', caption => {
    const text = `Perubahan Proses\n\n${caption}\n\n\`\`\`plantuml\n${AS_IS_SOURCE}\n\`\`\`\n\nPenjelasan tetap ada.`
    expect(stripProcessDiagramsFromText(text)).toBe('Perubahan Proses\n\nPenjelasan tetap ada.')
    expect(latestRevisedProcessDiagrams(text)[0].source).toBe(AS_IS_SOURCE)
  })
  it.each(['plantuml', 'PLANTUML', 'mermaid'])('uses supported fence language %s and CRLF', language => {
    const source = language === 'mermaid' ? 'flowchart LR\nA --> B' : AS_IS_SOURCE
    const text = `Prosa\n\nAS-IS:\n\`\`\`${language} \n${source}\n\`\`\``.replace(/\n/g, '\r\n')
    expect(stripProcessDiagramsFromText(text).trim()).toBe('Prosa')
  })
  it('removes duplicate same-lane label-only wrappers but preserves other headings', () => {
    const text = `AS-IS\n\nTO-BE:\n\n**TO-BE**\n\`\`\`plantuml\n${TO_BE_SOURCE}\n\`\`\``
    expect(stripProcessDiagramsFromText(text)).toBe('AS-IS')
  })
  it.each([
    `<!--tectona-process-diagram:as_is:${encodeURIComponent(AS_IS_SOURCE)}-->`,
    '<!--tectona-mermaid\nflowchart LR\nA --- B-->',
  ])('supports valid extracted source comments', block => {
    expect(stripProcessDiagramsFromText(`Konteks\n\nAS-IS:\n${block}`)).toBe('Konteks')
  })
  it.each([
    'AS-IS:\nProses sekarang tetap manual.',
    'AS-IS adalah proses manual.',
    '## AS-IS\n\nPenjelasan proses.',
    'AS-IS:\n<!--tectona-process-diagram:as_is:%invalid-->',
    'AS-IS:\n```bpmn\n<definitions/>\n```',
  ])('preserves meaningful or unsupported label context: %s', text => {
    expect(stripProcessDiagramsFromText(text)).toContain('AS-IS')
  })
  it('does not remove technical captions even when a business-process source follows', () => {
    expect(stripProcessDiagramsFromText(`Class\n\`\`\`plantuml\n${AS_IS_SOURCE}\n\`\`\``)).toBe('Class')
  })
  it('does not remove AS-IS labels attached to technical sources', () => {
    expect(stripProcessDiagramsFromText('AS-IS\n```plantuml\n@startuml\nclass Example\n@enduml\n```')).toBe('AS-IS')
  })
  it('keeps non-caption AS-IS prose immediately before a diagram', () => {
    expect(stripProcessDiagramsFromText(`AS-IS: petugas meninjau manual.\n\`\`\`plantuml\n${AS_IS_SOURCE}\n\`\`\``)).toBe('AS-IS: petugas meninjau manual.')
  })
})

it('preserves a mismatched lane caption before an explicitly tagged stored source', () => {
  const text = `TO-BE:\n<!--tectona-process-diagram:as_is:${encodeURIComponent(AS_IS_SOURCE)}-->`
  expect(stripProcessDiagramsFromText(text)).toBe('TO-BE:')
})
it('leaves unsupported fences and non-diagram code unchanged', () => {
  for (const text of ['AS-IS\n~~~plantuml\nstart\n~~~', 'AS-IS\n```typescript\nconst value = 1\n```']) {
    expect(extractProcessDiagramsFromText(text)).toEqual([])
    expect(stripProcessDiagramsFromText(text)).toBe(text)
  }
})
it('does not change extraction or stored source bytes while cleaning visible captions', () => {
  const draft = `as-is:\n\`\`\`plantuml\n${AS_IS_SOURCE}\n\`\`\`\n\nTO-BE:\n\`\`\`plantuml\n${TO_BE_SOURCE}\n\`\`\``
  const diagrams = latestRevisedProcessDiagrams(draft)
  const stored = appendProcessDiagramsToText(draft, diagrams)
  expect(stripProcessDiagramsFromText(stored)).toBe('')
  expect(extractProcessDiagramsFromText(stored).map(d => [d.kind, d.source])).toEqual(diagrams.map(d => [d.kind, d.source]))
})

it('retains a caption whose lane the existing gallery cannot recognize', () => {
  const draft = `__AS-IS__\n\`\`\`plantuml\n${AS_IS_SOURCE}\n\`\`\``
  expect(latestRevisedProcessDiagrams(draft)).toEqual([])
  expect(stripProcessDiagramsFromText(draft)).toBe('__AS-IS__')
})


describe('exact source identity', () => {
  const original = '@startuml\nentity "Order  Item" as OrderID {\n id: int\n}\n@enduml'
  const fence = (source: string) => `\`\`\`plantuml\n${source}\n\`\`\``
  it.each([
    ['identifier case', original.replace('OrderID', 'orderid')],
    ['label case', original.replace('Order  Item', 'order  item')],
    ['quoted spaces', original.replace('Order  Item', 'Order Item')],
  ])('preserves distinct %s revisions through extraction, comments and latest selection', (_label, revised) => {
    const extracted = extractProcessDiagramsFromText(`${fence(original)}\n${fence(revised)}`)
    expect(extracted.map(item => item.source)).toEqual([original, revised])
    const saved = appendProcessDiagramsToText('Recap', [{ kind: 'erd', source: original }, { kind: 'erd', source: revised }])
    expect(extractProcessDiagramsFromText(saved).map(item => item.source)).toEqual([original, revised])
    expect(latestValidatedTechnicalDiagrams(saved)[0]?.source).toBe(revised)
    expect(latestValidatedTechnicalDiagrams(`${fence(original)}\n${fence(revised)}`)[0]?.source).toBe(revised)
  })
  it('still deduplicates byte-identical source across fences and encoded comments', () => {
    const saved = appendProcessDiagramsToText('Recap', [{ kind: 'erd', source: original }, { kind: 'erd', source: original }])
    expect(extractProcessDiagramsFromText(`${fence(original)}\n${saved}`).map(item => item.source)).toEqual([original])
  })
})

it('preserves identical bodies explicitly assigned to different process lanes', () => {
  const source = AS_IS_SOURCE
  const saved = appendProcessDiagramsToText('Recap', [{ kind: 'as_is', source }, { kind: 'to_be', source }])
  expect(extractProcessDiagramsFromText(saved).map(item => item.kind)).toEqual(['as_is', 'to_be'])
  const text = `AS-IS:\n\`\`\`plantuml\n${source}\n\`\`\`\nTO-BE:\n\`\`\`plantuml\n${source}\n\`\`\``
  expect(latestRevisedProcessDiagrams(text).map(item => item.kind)).toEqual(['as_is','to_be'])
})

it('does not create distinct identity from ambiguous lane mentions in prose', () => {
  const source = AS_IS_SOURCE
  const fence = `\`\`\`plantuml\n${source}\n\`\`\``
  const text = `We discussed AS-IS as background.\n${fence}\nWe discussed TO-BE as another possibility.\n${fence}`
  expect(extractProcessDiagramsFromText(text)).toHaveLength(1)
})

it('preserves same-body opposite lanes under lowercase standalone headings', () => {
  const fence = `\`\`\`plantuml\n${AS_IS_SOURCE}\n\`\`\``
  expect(extractProcessDiagramsFromText(`as-is:\n${fence}\nto-be:\n${fence}`).map(item => item.kind)).toEqual(['as_is','to_be'])
})
it('deduplicates omitted and explicit unlabeled kinds that serialize identically', () => {
  const saved = appendProcessDiagramsToText('Recap', [{ source: AS_IS_SOURCE }, { kind: 'unlabeled', source: AS_IS_SOURCE }])
  expect((saved.match(/<!--tectona-process-diagram:/g) ?? []).length).toBe(1)
})

it.each([
  ['AS IS', 'TO BE'], ['ASIS', 'TOBE'], ['**AS-IS:**', '**TO-BE:**'],
  ['### AS-IS:', '### TO-BE:'], ['__AS IS:__', '__TO BE:__'],
])('retains same-body explicit canonical heading forms %s / %s', (asIs, toBe) => {
  const fence = `\`\`\`plantuml\n${AS_IS_SOURCE}\n\`\`\``
  expect(extractProcessDiagramsFromText(`${asIs}\n${fence}\n${toBe}\n${fence}`)).toHaveLength(2)
})


it('removes only the exact internal approved wrapper bound to a process caption', () => {
  const header = 'DIAGRAM PROSES BISNIS YANG SUDAH DISETUJUI (wajib masuk draft):'
  const process = `${header}\nAS-IS:\n\`\`\`plantuml\n${AS_IS_SOURCE}\n\`\`\``
  expect(stripProcessDiagramsFromText(process)).toBe('')
  expect(latestRevisedProcessDiagrams(process)[0].source).toBe(AS_IS_SOURCE)
  expect(stripProcessDiagramsFromText(`${header}\nAS-IS:\n\`\`\`plantuml\n@startuml\nclass Example\n@enduml\n\`\`\``)).toContain(header)
  expect(stripProcessDiagramsFromText(`${header}\nAS-IS:\n\`\`\`unknown\nraw\n\`\`\``)).toContain(header)
  expect(stripProcessDiagramsFromText(`Discuss ${header} with the owner.\nAS-IS:\n\`\`\`plantuml\n${AS_IS_SOURCE}\n\`\`\``)).toContain(`Discuss ${header} with the owner.`)
})
