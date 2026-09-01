import { describe, expect, it } from 'vitest'
import { parseBrdStructuredName } from './repositoryKbFromDocument'
import {
  buildComparePurposeWindows,
  clipComparePurposeText,
  COMPARE_PURPOSE_TEXT_MAX_CHARS,
  computeContentFingerprint,
  findExactDuplicate,
  findKbGeneratedDocIds,
  findNameMatches,
  normalizeForFingerprint,
  shortlistByKeywordOverlap,
  retrieveSimilarChunks,
  retrieveSimilarChunksFromVectors,
  cosineSimilarity,
  pickContentCompareCandidates,
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
  it('clips agent compare text to the API summary limit', () => {
    const clipped = clipComparePurposeText('x'.repeat(COMPARE_PURPOSE_TEXT_MAX_CHARS + 80))
    expect(clipped.length).toBe(COMPARE_PURPOSE_TEXT_MAX_CHARS)
  })

  it('puts late requirement sentences into purpose instead of only the document head', () => {
    const head = `Overview of the CMS integration. ${'Padding text. '.repeat(180)}`
    const late = 'The system shall expose POST /promosi/kaderisasi as a required API endpoint for cadre monitoring.'
    const windows = buildComparePurposeWindows(`${head} ${late}`)
    expect(windows.summary.length).toBeLessThanOrEqual(COMPARE_PURPOSE_TEXT_MAX_CHARS)
    expect(windows.purpose.length).toBeLessThanOrEqual(COMPARE_PURPOSE_TEXT_MAX_CHARS)
    expect(windows.purpose.toLowerCase()).toContain('kaderisasi')
    expect(windows.purpose.toLowerCase()).toContain('shall')
  })
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

  it('still matches the same family when the version has multiple decimal segments', () => {
    // Regression: "V0.2.5" used to fail structured-name parsing entirely (not just its own
    // display), so a multi-segment revision upload never got linked to its family at all — the
    // "Save as new version" prompt never appeared, and it silently became a disconnected document.
    const subject = makeDoc({
      id: 'new',
      fileName: 'BRD_Project_HarmonyPenangananNonZoning_V0.2.5_20260824.docx',
    })
    const existing = [
      makeDoc({ id: 'old', fileName: 'BRD_Project_HarmonyPenangananNonZoning_V0.2_20260824.docx' }),
    ]
    const matches = findNameMatches(subject, existing)
    expect(matches.map((m) => m.id)).toEqual(['old'])
  })

  it('matches the same family despite small naming drift between revisions (stray trailing digit)', () => {
    // Regression: real uploads aren't always named consistently across versions — a one-character
    // typo/drift in the module name (a stray trailing "1") made the exact-string family match miss
    // entirely, so V1 and V2 of the same document never got linked and both landed in the
    // repository as unrelated documents with no duplicate prompt at all.
    const subject = makeDoc({
      id: 'new',
      fileName: 'BRD_Project_DraftAPISpecCmsToDIb_V2_20260826.docx',
    })
    const existing = [
      makeDoc({ id: 'old', fileName: 'BRD_Project_DraftAPISpecCmsToDIb1_V1_20260826.docx' }),
    ]
    const matches = findNameMatches(subject, existing)
    expect(matches.map((m) => m.id)).toEqual(['old'])
  })

  it('does not fuzzy-match genuinely different modules', () => {
    const subject = makeDoc({ id: 'new', fileName: 'BRD_Project_PayrollSync_V1_20260826.docx' })
    const existing = [
      makeDoc({ id: 'other', fileName: 'BRD_Project_InventorySync_V1_20260826.docx' }),
    ]
    const matches = findNameMatches(subject, existing)
    expect(matches.map((m) => m.id)).toEqual([])
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

  it('matches informal draft filenames that only differ by a version suffix', () => {
    const subject = makeDoc({ id: 'new', fileName: '[DRAFT] API Spec CMS to DLB v.2.docx' })
    const existing = [
      makeDoc({ id: 'v1', fileName: '[DRAFT] API Spec CMS to DLB.docx', title: '[DRAFT] API Spec CMS to DLB' }),
    ]
    expect(findNameMatches(subject, existing).map((item) => item.id)).toEqual(['v1'])
  })

  it('shortlists a near-identical non-BRD-named title at a high-overlap threshold', () => {
    // Regression: parseBrdStructuredName requires a "BRD_" filename prefix, so titles like
    // "[DRAFT] API Spec CMS to DLB" vs "...v.2" never produce a structured-name match at all and
    // fall through entirely to the (best-effort, fire-and-forget) LLM purpose check — if that call
    // fails or scores low, the two near-identical documents upload as fully separate, undetected
    // documents. A high-overlap keyword shortlist threshold must still catch this deterministically.
    const existing = [makeDoc({ id: 'v1', fileName: '[DRAFT] API Spec CMS to DLB.docx' })]
    const shortlist = shortlistByKeywordOverlap('[DRAFT] API Spec CMS to DLB v.2.docx', existing, { threshold: 0.5 })
    expect(shortlist.map((d) => d.id)).toEqual(['v1'])
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

  it('prefers same-folder documents for LLM content compare', () => {
    const existing = [
      makeDoc({ id: 'other', fileName: 'Payroll.docx' }),
      makeDoc({ id: 'folder-a', fileName: 'API Spec.docx' }),
      makeDoc({ id: 'folder-b', fileName: 'CMS Integration.docx' }),
    ]
    const picked = pickContentCompareCandidates(existing, {
      preferredIds: new Set(['folder-b', 'folder-a']),
      limit: 2,
    })
    expect(picked.map((doc) => doc.id)).toEqual(['folder-a', 'folder-b'])
  })

  it('retrieves a matching requirement that lives in the middle of a long document', () => {
    const subjectFiller = 'Company background and historical finance reporting process description. '
    const candidateFiller = 'Unrelated payroll onboarding notes for human resources administration. '
    const requirement = 'Cadre promotion monitoring must post status updates to CMS using the dedicated integration contract for DLB new customers.'
    const subject = `${subjectFiller.repeat(40)}${requirement}${subjectFiller.repeat(10)}`
    const candidate = `${candidateFiller.repeat(25)}Operational notes. ${requirement} Closing remarks follow.${candidateFiller.repeat(20)}`
    const pairs = retrieveSimilarChunks(subject, candidate)
    expect(pairs.length).toBeGreaterThan(0)
    expect(pairs[0].score).toBeGreaterThan(0.14)
    expect(`${pairs[0].subjectChunk} ${pairs[0].candidateChunk}`.toLowerCase()).toContain('cadre promotion')
  })

  it('ranks the same requirement higher with embedding cosine than an unrelated chunk', () => {
    const requirement = 'Cadre promotion monitoring must post status updates to CMS using the dedicated integration contract.'
    const unrelated = 'Payroll onboarding notes for human resources administration and leave balances.'
    const shared: number[] = [0.9, 0.1, 0]
    const other: number[] = [0.1, 0.9, 0]
    const vectors = new Map<string, number[]>([
      [requirement, shared],
      [unrelated, other],
    ])
    expect(cosineSimilarity(shared, shared)).toBeCloseTo(1, 5)
    const pairs = retrieveSimilarChunksFromVectors([requirement], [requirement, unrelated], vectors)
    expect(pairs[0]?.candidateChunk).toBe(requirement)
    expect(pairs[0]?.score).toBeGreaterThan(0.9)
  })
})
