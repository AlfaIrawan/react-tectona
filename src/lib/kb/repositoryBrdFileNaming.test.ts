import { describe, expect, it } from 'vitest'
import { buildAutoRenamedBrdFileName } from './repositoryBrdFileNaming'

describe('buildAutoRenamedBrdFileName', () => {
  it('does not repeat the same long segment twice when project name is unknown', () => {
    // Regression: with no explicit project selected and nothing parsed from the file name, both
    // the project and module segments used to fall back to the same document-derived text,
    // producing "BRD_LongTitle_LongTitle_V1_20260824.docx" — roughly double the needed length.
    const fileName = 'ActionMs2PenambahanInformasiJaminanHubunganPenjaminMasaBerlaku.docx'
    const result = buildAutoRenamedBrdFileName(fileName, fileName, undefined, {
      moduleName: 'ActionMs2PenambahanInformasiJaminanHubunganPenjaminMasaBerlaku',
    })
    expect(result).not.toMatch(/Berlaku.*Berlaku/)
    expect(result.startsWith('BRD_Project_')).toBe(true)
  })

  it('caps each segment to a bounded length regardless of source title length', () => {
    const longTitle =
      'PenambahanInformasiJaminanHubunganPenjaminMasaBerlakuUntukSemuaNasabahDiSeluruhCabangIndonesia'
    const result = buildAutoRenamedBrdFileName('doc.docx', 'Some Real Project', undefined, {
      moduleName: longTitle,
    })
    // BRD_ + project segment (<=28) + _ + module segment (<=28) + _V1_ + 8-digit date + .docx
    expect(result.length).toBeLessThan(80)
  })

  it('keeps a real, distinct project name alongside the module name', () => {
    const result = buildAutoRenamedBrdFileName('doc.docx', 'Adira Finance', undefined, {
      moduleName: 'Customer Onboarding',
    })
    expect(result).toMatch(/^BRD_AdiraFinance_CustomerOnboarding_V1_\d{8}\.docx$/)
  })
})
