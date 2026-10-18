import { describe, expect, it } from 'vitest'
import { formatSourceSummaryMarkdown } from './sourceSummaryMarkdown'

describe('formatSourceSummaryMarkdown', () => {
  it('turns the draft section titles glued to their text into headings', () => {
    expect(formatSourceSummaryMarkdown([
      'Tujuan',
      'Menyediakan solusi tanya-jawab kebijakan.',
      '',
      '**Indikator keberhasilan (hipotesis)**',
      '',
      '- Akurasi ≥ 90%.',
      '',
      'Permasalahan',
      'Saat ini, Field Collector mengalami hambatan.',
      'Evidence AS-IS',
      '- Lewat WhatsApp.',
    ].join('\n'))).toBe([
      '## Tujuan',
      'Menyediakan solusi tanya-jawab kebijakan.',
      '### Indikator keberhasilan (hipotesis)',
      '- Akurasi ≥ 90%.',
      '## Permasalahan',
      'Saat ini, Field Collector mengalami hambatan.',
      '## Evidence AS-IS',
      '- Lewat WhatsApp.',
    ].join('\n\n'))
  })

  it('drops diagram labels left without their diagram and makes short labels subheadings', () => {
    const out = formatSourceSummaryMarkdown([
      'Asumsi dan Pertanyaan Terbuka',
      'Asumsi:',
      '- Data dari Tectona.',
      'Perubahan Proses',
      'AS-IS:',
      'TO-BE:',
      'Sinyal Scoring',
      '- Business Value: Tinggi.',
    ].join('\n'))
    expect(out).toContain('## Asumsi dan Pertanyaan Terbuka')
    expect(out).toContain('### Asumsi\n\n- Data dari Tectona.')
    expect(out).toContain('## Perubahan Proses\n\n## Sinyal Scoring')
    expect(out).not.toMatch(/AS-IS:|TO-BE:/)
  })

  it('leaves code fences and list items alone', () => {
    const text = '```plantuml\nTujuan\n```\n\n- Risiko:'
    expect(formatSourceSummaryMarkdown(text)).toBe(text)
  })
})
