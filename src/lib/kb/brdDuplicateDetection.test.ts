import { describe, expect, it } from 'vitest'
import { parseBrdStructuredName } from './repositoryKbFromDocument'
import {
  computeContentFingerprint,
  findExactDuplicate,
  findKbGeneratedDocIds,
  findNameMatches,
  normalizeForFingerprint,
  shortlistByKeywordOverlap,
  type ExistingBrdDoc,
} from './brdDuplicateDetection'

function makeDoc(partial: Partial<ExistingBrdDoc> & { id: string; fileName: string }): ExistingBrdDoc {
  return {
    title: partial.title ?? partial.fileName,
    projectName: partial.projectName ?? '',
    contentSha256: partial.contentSha256 ?? '',
    structured: parseBrdStructuredName(partial.fileName),
    ...partial,
  }
}

describe('BRD duplicate detection', () => {
  it('normalizes content independent of markers/case/punctuation', () => {
    const a = normalizeForFingerprint('--- DOCX BODY ---\nOverview: SCF/FMCG!!!')
    const b = normalizeForFingerprint('overview   scf fmcg')
    expect(a).toBe(b)
  })

  it('produces a stable fingerprint; differs for different content', async () => {
    const f1 = await computeContentFingerprint('--- DOCX BODY ---\nPenanganan Produk SCF FMCG')
    const f2 = await computeContentFingerprint('Penanganan Produk SCF FMCG')
    const f3 = await computeContentFingerprint('Dokumen yang berbeda total')
    expect(f1).toBe(f2) // marker-independent
    expect(f1).not.toBe(f3)
    expect(f1.length).toBeGreaterThan(8)
  })

  it('detects an exact duplicate by fingerprint', () => {
    const existing = [
      makeDoc({ id: 'a', fileName: 'BRD_X.docx', contentSha256: 'hash-aaa' }),
      makeDoc({ id: 'b', fileName: 'BRD_Y.docx', contentSha256: 'hash-bbb' }),
    ]
    expect(findExactDuplicate('hash-bbb', existing)?.id).toBe('b')
    expect(findExactDuplicate('hash-zzz', existing)).toBeNull()
    expect(findExactDuplicate('', existing)).toBeNull()
  })

  it('matches the same BRD family by structured file name', () => {
    const subject = makeDoc({ id: 'new', fileName: 'BRD_ClarRecovery_DataPrioritas_V2_20260601.docx' })
    const existing = [
      makeDoc({ id: 'old', fileName: 'BRD_ClarRecovery_DataPrioritas_V1_20260101.docx' }),
      makeDoc({ id: 'other', fileName: 'BRD_Helpdesk_Ticketing_V1_20260101.docx' }),
    ]
    const matches = findNameMatches(subject, existing)
    expect(matches.map((m) => m.id)).toEqual(['old'])
  })

  it('detects which documents already have a generated KB (via source footer doc id)', () => {
    const kbContents = [
      '<h2>Sumber dokumen</h2><ul><li><strong>Document ID:</strong> doc-123</li></ul>',
      '<p>unrelated entry</p>',
    ]
    const generated = findKbGeneratedDocIds(['doc-123', 'doc-999'], kbContents)
    expect(generated.has('doc-123')).toBe(true)
    expect(generated.has('doc-999')).toBe(false)
  })

  it('shortlists candidates by keyword overlap, excluding already-matched ids', () => {
    const existing = [
      makeDoc({ id: 'close', fileName: 'BRD_SCF_FMCG.docx', title: 'Penanganan Produk SCF FMCG di CLAR' }),
      makeDoc({ id: 'far', fileName: 'BRD_Payroll.docx', title: 'Sistem Penggajian Karyawan' }),
      makeDoc({ id: 'dup', fileName: 'BRD_SCF.docx', title: 'Penanganan SCF FMCG' }),
    ]
    const shortlist = shortlistByKeywordOverlap(
      'Penanganan Produk SCF FMCG',
      existing,
      { excludeIds: new Set(['dup']), threshold: 0.15 },
    )
    expect(shortlist.map((d) => d.id)).toContain('close')
    expect(shortlist.map((d) => d.id)).not.toContain('far')
    expect(shortlist.map((d) => d.id)).not.toContain('dup') // excluded
  })
})
