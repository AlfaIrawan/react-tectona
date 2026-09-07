import {
  chunkDocumentForDuplicateCompare,
  retrieveSimilarChunks,
  retrieveSimilarChunksFromVectors,
} from '@/lib/kb/brdDuplicateDetection'
import {
  IDENTITY_SAMPLE_KINDS,
  SAMPLE_DOCUMENT_KIND_CODES,
  resolveSampleKindFromFolderId,
  type SampleDocumentKind,
} from './sampleDocumentKind'

/** Every Samples category folder is part of the gold set — not MI/KS only. */
export const ACTIVE_SAMPLE_GOLD_KINDS: readonly SampleDocumentKind[] = SAMPLE_DOCUMENT_KIND_CODES

export type SampleGoldDocument = {
  id: string
  kind: SampleDocumentKind
  text: string
}

export type SampleKindClassification = {
  kind: SampleDocumentKind | 'unknown'
  source: 'samples_path' | 'samples_compare' | 'organization_fallback' | 'org_consensus' | 'user_confirm' | 'unknown'
  confidence: number
  reason: string
}

export const SAMPLE_CLASSIFY_EMBED_MIN = 0.62
export const SAMPLE_CLASSIFY_EMBED_ACCEPT = 0.66
export const SAMPLE_CLASSIFY_EMBED_MARGIN = 0.04
export const SAMPLE_CLASSIFY_LEXICAL_ACCEPT = 0.22
export const SAMPLE_CLASSIFY_LEXICAL_MARGIN = 0.05
export const SAMPLE_EXCERPT_MAX_CHARS = 2000

export function clipSampleExcerpt(text: string, maxChars: number = SAMPLE_EXCERPT_MAX_CHARS): string {
  return (text || '').replace(/\s+/g, ' ').trim().slice(0, maxChars)
}

function bestScoreByKind(
  queryText: string,
  samples: readonly SampleGoldDocument[],
  vectorsByText: Map<string, number[]> | null,
): { kind: SampleDocumentKind; score: number }[] {
  const byKind = new Map<SampleDocumentKind, number>()
  const queryChunks = chunkDocumentForDuplicateCompare(queryText)
  for (const sample of samples) {
    if (!sample.text.trim()) continue
    const sampleChunks = chunkDocumentForDuplicateCompare(sample.text)
    const embeddingPairs = vectorsByText
      ? retrieveSimilarChunksFromVectors(queryChunks, sampleChunks, vectorsByText, {
        minScore: SAMPLE_CLASSIFY_EMBED_MIN,
        maxPairs: 2,
      })
      : []
    const pairs = embeddingPairs.length > 0
      ? embeddingPairs
      : retrieveSimilarChunks(queryText, sample.text, {
        minScore: 0.12,
        maxPairs: 2,
      })
    const score = pairs[0]?.score ?? 0
    const prior = byKind.get(sample.kind) ?? 0
    if (score > prior) byKind.set(sample.kind, score)
  }
  return [...byKind.entries()]
    .map(([kind, score]) => ({ kind, score }))
    .sort((left, right) => right.score - left.score)
}

export function looksLikeIdentitySampleFileName(fileName: string): boolean {
  const normalized = fileName.toLowerCase().replace(/[_-]+/g, ' ')
  return /\b(ktp|npwp|bpkb|kk|kartu keluarga)\b/.test(normalized)
}

export function decideSampleKindFromScores(
  ranked: readonly { kind: SampleDocumentKind; score: number }[],
  usedEmbedding: boolean,
  options?: { fileName?: string },
): SampleKindClassification {
  const allowIdentity = looksLikeIdentitySampleFileName(options?.fileName ?? '')
  const filtered = allowIdentity
    ? ranked
    : ranked.filter((row) => !IDENTITY_SAMPLE_KINDS.has(row.kind))
  if (filtered.length === 0 || !filtered[0] || filtered[0].score <= 0) {
    return {
      kind: 'unknown',
      source: 'unknown',
      confidence: 0,
      reason: 'No Samples gold-set text to compare.',
    }
  }
  const best = filtered[0]
  const second = filtered[1]?.score ?? 0
  const accept = usedEmbedding ? SAMPLE_CLASSIFY_EMBED_ACCEPT : SAMPLE_CLASSIFY_LEXICAL_ACCEPT
  const margin = usedEmbedding ? SAMPLE_CLASSIFY_EMBED_MARGIN : SAMPLE_CLASSIFY_LEXICAL_MARGIN
  if (best.score >= accept && best.score - second >= margin) {
    return {
      kind: best.kind,
      source: 'samples_compare',
      confidence: Math.min(1, best.score),
      reason: `Closest Samples neighbors are ${best.kind} (score ${best.score.toFixed(2)}).`,
    }
  }
  return {
    kind: 'unknown',
    source: 'unknown',
    confidence: best.score,
    reason: `Samples compare was inconclusive (best ${best.kind} ${best.score.toFixed(2)}).`,
  }
}

export function classifyAgainstSampleGoldSet(
  queryText: string,
  samples: readonly SampleGoldDocument[],
  vectorsByText: Map<string, number[]> | null,
  options?: { fileName?: string },
): SampleKindClassification {
  const usable = samples.filter((sample) => sample.text.trim().length >= 24)
  if (usable.length === 0) {
    return {
      kind: 'unknown',
      source: 'unknown',
      confidence: 0,
      reason: 'Samples library has no comparable excerpts yet.',
    }
  }
  const ranked = bestScoreByKind(queryText, usable, vectorsByText)
  return decideSampleKindFromScores(ranked, Boolean(vectorsByText && vectorsByText.size > 0), options)
}

export function collectTextsForSampleClassifyEmbed(
  queryText: string,
  samples: readonly SampleGoldDocument[],
): string[] {
  const chunks = [
    ...chunkDocumentForDuplicateCompare(queryText),
    ...samples.flatMap((sample) => chunkDocumentForDuplicateCompare(sample.text)),
  ]
  return [...new Set(chunks.filter((chunk) => chunk.trim().length > 0))]
}

export function excerptFromIndexSnapshot(snapshot: {
  title?: string | null
  summary?: string | null
  attachment_text?: string | null
  content?: string | null
  metadata?: Record<string, unknown> | null
}): string {
  const metaExcerpt = typeof snapshot.metadata?.samples_excerpt === 'string'
    ? snapshot.metadata.samples_excerpt
    : ''
  const joined = [
    metaExcerpt,
    snapshot.summary,
    snapshot.attachment_text,
    snapshot.content,
    snapshot.title,
  ]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join('\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return clipSampleExcerpt(joined)
}

export function selectSampleGoldItems<T extends { id: string; folderId: string | null }>(
  items: readonly T[],
  folders: ReadonlyArray<{ id: string; name: string; parent_id?: string | null }>,
  options?: {
    kinds?: readonly SampleDocumentKind[]
    maxTotal?: number
    maxPerKind?: number
  },
): Array<T & { sampleKind: SampleDocumentKind }> {
  const kinds = new Set(options?.kinds ?? ACTIVE_SAMPLE_GOLD_KINDS)
  const maxTotal = options?.maxTotal ?? 88
  const maxPerKind = options?.maxPerKind ?? 8
  const counts = new Map<SampleDocumentKind, number>()
  const picked: Array<T & { sampleKind: SampleDocumentKind }> = []
  for (const item of items) {
    const sampleKind = resolveSampleKindFromFolderId(item.folderId, folders)
    if (!sampleKind || !kinds.has(sampleKind)) continue
    const used = counts.get(sampleKind) ?? 0
    if (used >= maxPerKind) continue
    counts.set(sampleKind, used + 1)
    picked.push({ ...item, sampleKind })
    if (picked.length >= maxTotal) break
  }
  return picked
}
