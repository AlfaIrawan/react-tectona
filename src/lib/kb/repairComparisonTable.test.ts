import { describe, expect, it } from 'vitest'
import { repairFlattenedComparisonBlocks } from './repairComparisonTable'

describe('repairFlattenedComparisonBlocks', () => {
  it('rebuilds a flattened Sebelum/Sesudah list item into a 2-column table', () => {
    const html =
      '<ol><li>Perubahan ketentuan dari Memo Internal sebelumnya adalah sebagai berikut '
      + 'Sebelum Sesudah '
      + 'ADIRA FINANCE menetapkan 3 sasaran Keamanan Informasi yang ingin dicapai dalam penerapan SMKI – Lampiran 3 '
      + 'ADIRA FINANCE menetapkan 8 sasaran Keamanan Informasi yang ingin dicapai dalam penerapan SMKI – Lampiran 3 '
      + '*) Aturan detail dapat dilihat pada bagian KETENTUAN. LATAR BELAKANG</li>'
      + '<li>Adanya Undang Undang Pelindungan Data Pribadi No. 27 Tahun 2022.</li></ol>'

    const out = repairFlattenedComparisonBlocks(html)
    expect(out).toContain('<table>')
    expect(out).toContain('<th>Sebelum</th><th>Sesudah</th>')
    expect(out).toContain('menetapkan 3 sasaran')
    expect(out).toContain('menetapkan 8 sasaran')
    expect(out).toContain('*) Aturan detail dapat dilihat pada bagian KETENTUAN.')
    expect(out).not.toContain('LATAR BELAKANG')
    // The regulatory point stays a normal list item.
    expect(out).toContain('<li>Adanya Undang Undang Pelindungan Data Pribadi No. 27 Tahun 2022.</li>')
  })

  it('leaves non-comparison content untouched', () => {
    const html = '<p>Adanya Peraturan Pemerintah No. 71 Tahun 2019.</p>'
    expect(repairFlattenedComparisonBlocks(html)).toBe(html)
  })

  it('does not reprocess an already-built table', () => {
    const html = '<li><table><thead><tr><th>Sebelum</th><th>Sesudah</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table></li>'
    expect(repairFlattenedComparisonBlocks(html)).toBe(html)
  })
})
