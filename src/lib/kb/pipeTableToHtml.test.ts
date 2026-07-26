import { describe, expect, it } from 'vitest'
import { convertPipeTablesToHtml } from './pipeTableToHtml'

describe('convertPipeTablesToHtml', () => {
  it('converts numbered pipe rows joined in prose into a table, recovering the header from the intro', () => {
    const html =
      '<li>Isu-isu yang dapat mempengaruhi tujuan SMKI diidentifikasi sebagai berikut: '
      + 'No. | Isu | Dampak '
      + '1 | Strategi dan tujuan bisnis | Perubahan strategi dapat mempengaruhi fokus. '
      + '2 | Perubahan organisasi | Perubahan organisasi mempengaruhi peran. '
      + '3 | Kinerja keuangan | Kinerja keuangan mempengaruhi budget.</li>'
    const out = convertPipeTablesToHtml(html)
    expect(out).toContain('<table>')
    expect(out).toContain('<th>No.</th><th>Isu</th><th>Dampak</th>')
    expect(out).toContain('<td>1</td><td>Strategi dan tujuan bisnis</td>')
    expect(out).toContain('<td>3</td><td>Kinerja keuangan</td>')
    expect(out).toContain('diidentifikasi sebagai berikut:')
    expect(out).not.toContain(' | ')
  })

  it('converts newline-separated rows with a header (Sebelum/Sesudah)', () => {
    const html =
      '<li>Perubahan ketentuan sebagai berikut\nSebelum | Sesudah\n'
      + 'ADIRA menetapkan 3 sasaran | ADIRA menetapkan 8 sasaran\n'
      + '*) Aturan detail pada bagian KETENTUAN.</li>'
    const out = convertPipeTablesToHtml(html)
    expect(out).toContain('<th>Sebelum</th><th>Sesudah</th>')
    expect(out).toContain('<td>ADIRA menetapkan 3 sasaran</td><td>ADIRA menetapkan 8 sasaran</td>')
    expect(out).toContain('*) Aturan detail')
  })

  it('leaves normal content and existing tables untouched', () => {
    const normal = '<li>Adanya Undang Undang Pelindungan Data Pribadi No. 27 Tahun 2022.</li>'
    expect(convertPipeTablesToHtml(normal)).toBe(normal)
    const table = '<li><table><tbody><tr><td>a | b</td></tr></tbody></table></li>'
    expect(convertPipeTablesToHtml(table)).toBe(table)
  })
})
