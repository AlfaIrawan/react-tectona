import { describe, expect, it } from 'vitest'
import { formatBrainstormFeatureAnswer as format } from './brainstormFeatureAnswer'

const question = 'Sebutkan fitur yang dibutuhkan dalam project ini'
const screenshotFeatures = [
  'integrasi Gen AI ke dalam aplikasi DigiLearn untuk mengajukan pertanyaan kebijakan via antarmuka DigiLearn',
  'AI otomatis mencari kebijakan di basis data internal (mis: Ad1ForFlow), merangkum isi kebijakan relevan, dan memberikan rekomendasi tindakan secara real-time',
  'kemampuan AI mengenali dokumen kebijakan baru yang di-upload oleh Tim HO Collection',
  'mekanisme fallback dimana pertanyaan yang tidak dapat dijawab AI dilempar ke grup Email Collection.',
]

describe('feature answer presentation', () => {
  it('renders the screenshot as explicit features without splitting clauses or changing facts', () => {
    const answer = 'Fitur yang dibutuhkan: ' + screenshotFeatures.join('; ')
    const result = format(question, answer)
    expect(result).toBe(screenshotFeatures.map(item => '- ' + item).join('\n'))
    expect(format(question, result)).toBe(result)
    expect(answer).toBe('Fitur yang dibutuhkan: ' + screenshotFeatures.join('; '))
  })
  it('supports one feature without turning line wrapping into extra features', () => {
    expect(format(question, 'Pencarian kebijakan.')).toBe('- Pencarian kebijakan.')
    expect(format(question, 'Pencarian kebijakan\ndari dokumen; Audit')).toBe('- Pencarian kebijakan\n  dari dokumen\n- Audit')
  })
  it('supports English and labeled revision answers', () => {
    expect(format('Required features', 'Required features: Search; Audit')).toBe('- Search\n- Audit')
    expect(format('Revisi yang perlu dikonfirmasi', '**Fitur yang dibutuhkan:** Pencarian; Audit')).toBe('- Pencarian\n- Audit')
  })
  it.each([
    '- Pencarian; filter\n  - Dokumen\n- Audit',
    '1. Pencarian\n2. Audit',
    'Fitur:\n\n- Pencarian\n- Audit',
    '```js\nfind(); audit();\n```',
    '| Fitur | Detail |\n| --- | --- |\n| Cari | Dokumen |',
    '> Pencarian; Audit',
  ])('preserves existing Markdown blocks: %s', answer => expect(format(question, answer)).toBe(answer))
  it('protects examples, code, links and entities from separator splitting', () => {
    const first = 'Cari (sumber: memo; kebijakan) dengan `a;b` dan [API](https://example.test/a;b) &amp; audit'
    expect(format(question, first + '; Laporan')).toBe('- ' + first + '\n- Laporan')
  })
  it('does not alter unrelated answers or missing-answer placeholders', () => {
    expect(format('Tujuan proyek', 'Cepat; aman')).toBe('Cepat; aman')
    expect(format('Pengguna bisnis', 'Collector Field; Tim HO Collection')).toBe('Collector Field; Tim HO Collection')
    expect(format(question, '')).toBe('')
    expect(format(question, 'Jawaban belum tersedia.')).toBe('Jawaban belum tersedia.')
  })
})
