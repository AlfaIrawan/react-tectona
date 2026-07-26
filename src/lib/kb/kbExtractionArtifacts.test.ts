import { describe, expect, it } from 'vitest'
import { scrubKbExtractionArtifacts, stripRepeatedRunningLines } from './kbExtractionArtifacts'

describe('scrubKbExtractionArtifacts', () => {
  it('removes page number, classification footer, and trailing section heading from a list item', () => {
    const html =
      '<li>Adanya Memo Internal MI-005/RISKMGT/IFRSKMGT/IV/2025 perihal '
      + '"Kebijakan Sistem Manajemen Keamanan Informasi (SMKI)" Page 2 of 10 Klasifikasi : Internal TUJUAN</li>'
    const out = scrubKbExtractionArtifacts(html)
    expect(out).toContain('Adanya Memo Internal MI-005/RISKMGT/IFRSKMGT/IV/2025')
    expect(out).toContain('(SMKI)"')
    expect(out).not.toContain('Page 2 of 10')
    expect(out).not.toContain('Klasifikasi : Internal')
    expect(out).not.toMatch(/TUJUAN/)
    expect(out.endsWith('</li>')).toBe(true)
  })

  it('leaves normal content untouched', () => {
    const html = '<li>Adanya Undang Undang Pelindungan Data Pribadi No. 27 Tahun 2022.</li>'
    expect(scrubKbExtractionArtifacts(html)).toBe(html)
  })

  it('handles Indonesian page markers', () => {
    expect(scrubKbExtractionArtifacts('<p>Isi dokumen Halaman 3 dari 12</p>')).toBe('<p>Isi dokumen</p>')
  })
})

describe('stripRepeatedRunningLines', () => {
  it('removes lines that repeat across pages (page numbers grouped by masking digits)', () => {
    const text = [
      'Kebijakan SMKI', 'Page 1 of 10', 'Isi halaman satu yang unik.',
      'Kebijakan SMKI', 'Page 2 of 10', 'Isi halaman dua yang unik.',
      'Kebijakan SMKI', 'Page 3 of 10', 'Isi halaman tiga yang unik.',
    ].join('\n')
    const out = stripRepeatedRunningLines(text)
    expect(out).not.toContain('Kebijakan SMKI')
    expect(out).not.toMatch(/Page \d+ of 10/)
    expect(out).toContain('Isi halaman satu yang unik.')
    expect(out).toContain('Isi halaman tiga yang unik.')
  })

  it('keeps content that only appears once or twice', () => {
    const text = 'Baris unik A\nBaris unik B\nBaris unik A'
    expect(stripRepeatedRunningLines(text)).toBe(text)
  })
})
