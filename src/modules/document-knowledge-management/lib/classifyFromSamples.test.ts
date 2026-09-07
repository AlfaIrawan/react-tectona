import { describe, expect, it } from 'vitest'
import { decideSampleKindFromScores, excerptFromIndexSnapshot, selectSampleGoldItems } from './classifyFromSamples'

describe('classifyFromSamples', () => {
  it('accepts a clear MI vs KS margin', () => {
    const result = decideSampleKindFromScores(
      [
        { kind: 'ketetapan_sementara', score: 0.78 },
        { kind: 'memo_internal', score: 0.61 },
      ],
      true,
    )
    expect(result.kind).toBe('ketetapan_sementara')
    expect(result.source).toBe('samples_compare')
  })

  it('abstains when neighbors are too close', () => {
    const result = decideSampleKindFromScores(
      [
        { kind: 'memo_internal', score: 0.67 },
        { kind: 'ketetapan_sementara', score: 0.66 },
      ],
      true,
    )
    expect(result.kind).toBe('unknown')
  })

  it('prefers stored Samples excerpts when building gold-set text', () => {
    expect(
      excerptFromIndexSnapshot({
        title: 'MI-001',
        summary: 'Uploaded from Document Repository: x.pdf',
        metadata: { samples_excerpt: 'MEMO INTERNAL No. MI-001 Perihal SMKI' },
      }),
    ).toContain('MEMO INTERNAL')
  })

  it('caps gold-set items per Samples category', () => {
    const folders = [
      { id: 'root', name: 'Samples', parent_id: null },
      { id: 'mi', name: 'Memo Internal', parent_id: 'root' },
      { id: 'ks', name: 'Ketetapan Sementara', parent_id: 'root' },
      { id: 'other', name: 'Projects', parent_id: null },
    ]
    const items = [
      { id: 'a', folderId: 'mi' },
      { id: 'b', folderId: 'mi' },
      { id: 'c', folderId: 'ks' },
      { id: 'd', folderId: 'other' },
    ]
    const picked = selectSampleGoldItems(items, folders, { maxTotal: 3, maxPerKind: 1 })
    expect(picked.map((row) => row.id)).toEqual(['a', 'c'])
    expect(picked[0]?.sampleKind).toBe('memo_internal')
    expect(picked[1]?.sampleKind).toBe('ketetapan_sementara')
  })

  it('includes SOP and other Samples categories in the default gold set', () => {
    const folders = [
      { id: 'root', name: 'Samples', parent_id: null },
      { id: 'sop', name: 'SOP', parent_id: 'root' },
      { id: 'fsd', name: 'FSD', parent_id: 'root' },
    ]
    const picked = selectSampleGoldItems(
      [
        { id: 's1', folderId: 'sop' },
        { id: 'f1', folderId: 'fsd' },
      ],
      folders,
    )
    expect(picked.map((row) => row.sampleKind).sort()).toEqual(['fsd', 'sop'])
  })

  it('does not classify a policy memo as KTP just because the body mentions KTP', () => {
    const result = decideSampleKindFromScores(
      [
        { kind: 'ktp', score: 0.88 },
        { kind: 'memo_internal', score: 0.8 },
      ],
      true,
      { fileName: 'Kebijakan SMKI.pdf' },
    )
    expect(result.kind).toBe('memo_internal')
  })

  it('allows KTP when the filename is an identity scan', () => {
    const result = decideSampleKindFromScores(
      [{ kind: 'ktp', score: 0.88 }],
      true,
      { fileName: 'KTP_nasabah_depan.pdf' },
    )
    expect(result.kind).toBe('ktp')
  })
})
