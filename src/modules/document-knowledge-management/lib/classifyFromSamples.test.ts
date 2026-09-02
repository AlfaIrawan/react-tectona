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
})
