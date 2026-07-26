import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BRD_TO_KB_CONTENT_STANDARD_HTML,
  parseBrdToKbContentStandard,
} from './brdToKbContentStandard'
import { ensureBrdKbStandardContent } from './repositoryKbFromDocument'

describe('BRD-To-Knowledge Base Content Standard KB entry', () => {
  it('parses required sections from KB standard content', () => {
    const parsed = parseBrdToKbContentStandard(DEFAULT_BRD_TO_KB_CONTENT_STANDARD_HTML)
    expect(parsed.requiredSections.map((section) => section.title)).toEqual([
      'Ringkasan Daftar Isi',
      'Aplikasi yang Terdampak',
      'Daftar Orang Terkait dan Peran',
    ])
    expect(parsed.requiredSections.map((section) => section.kind)).toEqual([
      'toc_summary',
      'affected_apps',
      'stakeholders',
    ])
  })

  it('enforces sections defined in KB standard document', () => {
    const standard = parseBrdToKbContentStandard(DEFAULT_BRD_TO_KB_CONTENT_STANDARD_HTML)
    const sampleBrdText = [
      'Table of Contents',
      'I. Kontrol Dokumen',
      'II. Ringkasan Eksekutif',
      'Aplikasi yang terdampak',
      '- IDE — identitas nasional',
      'PIC: Anindya Suryo Prawadyo',
    ].join('\n')

    const html = ensureBrdKbStandardContent('<h2>Overview</h2><p>Intro</p>', sampleBrdText, standard)
    expect(html).toContain('<h2>Ringkasan Daftar Isi</h2>')
    expect(html).toContain('<h2>Aplikasi yang Terdampak</h2>')
    expect(html).toContain('<h2>Daftar Orang Terkait dan Peran</h2>')
  })
})
