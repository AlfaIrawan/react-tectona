import { describe, expect, it } from 'vitest'
import {
  matchSampleCategoryName,
  resolveSampleKindFromFolderId,
  resolveSampleKindFromFolderNames,
} from './sampleDocumentKind'

describe('sampleDocumentKind', () => {
  it('maps Samples category folder names, including truncated Ketetapan Sementara', () => {
    expect(matchSampleCategoryName('Memo Internal')).toBe('memo_internal')
    expect(matchSampleCategoryName('MI')).toBe('memo_internal')
    expect(matchSampleCategoryName('Ketetapan Sementara')).toBe('ketetapan_sementara')
    expect(matchSampleCategoryName('Ketetapan Sement')).toBe('ketetapan_sementara')
    expect(matchSampleCategoryName('KS')).toBe('ketetapan_sementara')
    expect(matchSampleCategoryName('Samples')).toBeNull()
  })

  it('uses the Samples category folder, not a nested document folder', () => {
    expect(
      resolveSampleKindFromFolderNames([
        'Samples',
        'Memo Internal',
        'KS-023A_RISK_CRPL&INC_VII_2026 Ketentuan Penggunaan Sistem',
      ]),
    ).toBe('memo_internal')
    expect(
      resolveSampleKindFromFolderNames(['Samples', 'Ketetapan Sementara', 'KS-021A pack']),
    ).toBe('ketetapan_sementara')
  })

  it('resolves kind from folder id by walking parents', () => {
    const folders = [
      { id: 'root', name: 'Samples', parent_id: null },
      { id: 'ks', name: 'Ketetapan Sementara', parent_id: 'root' },
      { id: 'pack', name: 'KS-01BA pack', parent_id: 'ks' },
    ]
    expect(resolveSampleKindFromFolderId('pack', folders)).toBe('ketetapan_sementara')
    expect(resolveSampleKindFromFolderId('missing', folders)).toBeNull()
  })
})
