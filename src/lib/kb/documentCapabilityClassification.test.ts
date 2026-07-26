import { describe, expect, it } from 'vitest'
import {
  detectDocumentCapability,
  DOCUMENT_CAPABILITY_CLASSIFICATION_STANDARD_TITLE,
  getFallbackCapabilityRules,
  humanizeCapabilityCode,
  parseCapabilityRulesFromKbContent,
  resolveCapabilityRulesFromKbEntries,
} from './documentCapabilityClassification'

const SAMPLE_KB_CONTENT = `
<h2>capability_code: ktp</h2>
<p><strong>keywords:</strong> KTP, Kartu Tanda Penduduk</p>
<p>regex: (?i)\\bKTP\\b</p>
<hr/>
<h2>capability_code: kartu_keluarga</h2>
<p><strong>keywords:</strong> Kartu Keluarga, Nomor KK</p>
<p>regex: (?i)Kartu\\s+Keluarga</p>
<hr/>
<h2>capability_code: brd</h2>
<p><strong>keywords:</strong> Business Requirement Document</p>
<p>regex: (?i)^BRD_[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*_[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*_V\\d+(?:\\.\\d+)?_\\d{8}(?:\\.[A-Za-z0-9]+)?$</p>
<p>regex: (?i)\\bBRD\\b</p>
<hr/>
<h2>capability_code: fsd</h2>
<p><strong>keywords:</strong> Functional Specification</p>
<p>regex: (?i)\\bFSD\\b</p>
<hr/>
<h2>capability_code: tsd</h2>
<p><strong>keywords:</strong> Technical Specification</p>
<p>regex: (?i)\\bTSD\\b</p>
`

describe('documentCapabilityClassification', () => {
  it('parses capability rules from KB content', () => {
    const rules = parseCapabilityRulesFromKbContent(SAMPLE_KB_CONTENT)
    expect(rules.map((r) => r.capability_code)).toEqual([
      'ktp',
      'kartu_keluarga',
      'brd',
      'fsd',
      'tsd',
    ])
    expect(rules.find((r) => r.capability_code === 'brd')?.regexSources.length).toBeGreaterThan(0)
  })

  it('resolves KB entries by standard title and falls back when missing', () => {
    const fromKb = resolveCapabilityRulesFromKbEntries([
      {
        category: 'business_rules',
        title: DOCUMENT_CAPABILITY_CLASSIFICATION_STANDARD_TITLE,
        content: SAMPLE_KB_CONTENT,
        is_active: true,
      },
    ])
    expect(fromKb).toHaveLength(5)

    const fallback = resolveCapabilityRulesFromKbEntries([])
    expect(fallback.map((r) => r.capability_code)).toEqual(
      getFallbackCapabilityRules().map((r) => r.capability_code),
    )
  })

  it('detects KTP / Kartu Keluarga / BRD / FSD / TSD from filename + text', () => {
    const rules = parseCapabilityRulesFromKbContent(SAMPLE_KB_CONTENT)

    expect(
      detectDocumentCapability({
        fileName: 'scan_ktp_depan.jpg',
        text: 'Kartu Tanda Penduduk Republik Indonesia',
        rules,
      }),
    ).toBe('ktp')

    expect(
      detectDocumentCapability({
        fileName: 'KK_keluarga_budi.pdf',
        text: 'Kartu Keluarga Nomor KK 3175...',
        rules,
      }),
    ).toBe('kartu_keluarga')

    expect(
      detectDocumentCapability({
        fileName: 'BRD_Helpdesk_Ticket_V1_20260331.docx',
        text: 'Business Requirement Document',
        rules,
      }),
    ).toBe('brd')

    expect(
      detectDocumentCapability({
        fileName: 'FSD_Helpdesk_TicketWorkflow_v1.docx',
        text: 'Functional Specification for helpdesk',
        rules,
      }),
    ).toBe('fsd')

    expect(
      detectDocumentCapability({
        fileName: 'TSD_PaymentGateway_v2.pdf',
        text: 'Technical Specification Document',
        rules,
      }),
    ).toBe('tsd')
  })

  it('uses hardcoded fallback keywords when rules omitted', () => {
    expect(detectDocumentCapability({ fileName: 'dokumen_KTP.pdf', text: '' })).toBe('ktp')
    expect(detectDocumentCapability({ fileName: 'memo_internal.pdf', text: 'Surat edaran' })).toBeNull()
  })

  it('humanizes capability codes', () => {
    expect(humanizeCapabilityCode('kartu_keluarga')).toBe('Kartu Keluarga')
    expect(humanizeCapabilityCode(null)).toBe('-')
  })
})
