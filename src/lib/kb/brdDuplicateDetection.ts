/**
 * Duplicate detection for BRD uploads.
 *
 * Tiers:
 *  1. EXACT  — identical normalized content (SHA-256 fingerprint) → block.
 *  2. NAME   — same BRD family (project+module, optionally same version) by structured file name.
 *  3. PURPOSE— heuristic keyword shortlist → confirmed by an injected LLM compare function.
 *
 * Also reports whether a KB entry was already generated for a matched document (the KB source
 * footer embeds "Document ID: <id>").
 */
import { parseBrdStructuredName } from './repositoryKbFromDocument'

export type ExistingBrdDoc = {
  id: string
  title: string
  fileName: string
  projectName: string
  contentSha256: string
  structured: ReturnType<typeof parseBrdStructuredName>
  /** Optional repository fields used when a duplicate is promoted to a revision. */
  version?: number
  metadata?: Record<string, unknown>
}

export type BrdPurposeMatch = {
  doc: ExistingBrdDoc
  confidence: number
  reason: string
}

export type BrdDuplicateReport = {
  exact: ExistingBrdDoc | null
  nameMatches: ExistingBrdDoc[]
  samePurpose: BrdPurposeMatch[]
  kbGeneratedDocIds: Set<string>
  /** Hard block: identical content already exists. */
  block: boolean
}

const FINGERPRINT_MARKER_RE = /---\s*DOCX (?:HEADINGS|TABLE EXTRACT|BODY)\s*---/gi

/** Agent `compare-brd-purpose` rejects summary/purpose longer than this (Pydantic max_length). */
export const COMPARE_PURPOSE_TEXT_MAX_CHARS = 2000

export function clipComparePurposeText(
  value: string,
  maxChars: number = COMPARE_PURPOSE_TEXT_MAX_CHARS,
): string {
  const trimmed = (value || '').replace(/\s+/g, ' ').trim()
  if (trimmed.length <= maxChars) return trimmed
  return trimmed.slice(0, maxChars).trimEnd()
}

const REQUIREMENT_HINT_RE =
  /\b(requirement|shall|must|should|harus|kriteria|acceptance|endpoint|api|functional|non-?functional|given|when|then|user story|use case|as a user|request|response)\b/i

function splitCompareSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 24)
}

/**
 * API allows 2000 chars each on summary and purpose. Prefix-only clips miss
 * duplicated requirements later in the file, so summary keeps the head and
 * purpose keeps requirement-like sentences plus the document tail.
 */
export function buildComparePurposeWindows(
  raw: string,
  maxChars: number = COMPARE_PURPOSE_TEXT_MAX_CHARS,
): { summary: string; purpose: string } {
  const text = (raw || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const summary = clipComparePurposeText(text, maxChars)
  if (!text || text.length <= maxChars) {
    return { summary, purpose: summary }
  }

  const headMarker = summary.slice(0, Math.min(80, summary.length))
  const sentences = splitCompareSentences(text)
  const ranked = sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score: REQUIREMENT_HINT_RE.test(sentence) ? 2 : 0,
    }))
    .filter((row) => row.score > 0 && !summary.includes(row.sentence.slice(0, 48)))
    .sort((left, right) => right.score - left.score || left.index - right.index)

  const parts: string[] = []
  let used = 0
  for (const row of ranked) {
    const next = used === 0 ? row.sentence : ` ${row.sentence}`
    if (used + next.length > maxChars) continue
    parts.push(row.sentence)
    used += next.length
  }

  const tail = text.slice(-maxChars)
  if (used < Math.floor(maxChars * 0.45) && tail && tail !== headMarker) {
    const room = maxChars - used
    const filler = used === 0 ? tail : ` ${clipComparePurposeText(tail, Math.max(0, room - 1))}`
    if (filler.trim()) {
      parts.push(filler.trim())
    }
  }

  const purpose = clipComparePurposeText(parts.join(' '), maxChars)
  return { summary, purpose: purpose || summary }
}

/** Normalize extracted text for content fingerprinting (extraction-method independent). */
export function normalizeForFingerprint(text: string): string {
  return (text || '')
    .replace(FINGERPRINT_MARKER_RE, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

/** SHA-256 hex of the normalized content; falls back to a 53-bit hash if Web Crypto is unavailable. */
export async function computeContentFingerprint(text: string): Promise<string> {
  const normalized = normalizeForFingerprint(text)
  if (!normalized) return ''
  const subtle = globalThis.crypto?.subtle
  if (subtle) {
    try {
      const digest = await subtle.digest('SHA-256', new TextEncoder().encode(normalized))
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
    } catch {
      /* fall through to non-crypto hash */
    }
  }
  return `c53_${cyrb53(normalized, 1).toString(16)}${cyrb53(normalized, 2).toString(16)}`
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a) return b.length
  if (!b) return a.length
  const prevRow = new Array(b.length + 1)
  for (let j = 0; j <= b.length; j += 1) prevRow[j] = j
  for (let i = 1; i <= a.length; i += 1) {
    let prevDiagonal = prevRow[0]
    prevRow[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const temp = prevRow[j]
      prevRow[j] = a[i - 1] === b[j - 1]
        ? prevDiagonal
        : 1 + Math.min(prevDiagonal, prevRow[j], prevRow[j - 1])
      prevDiagonal = temp
    }
  }
  return prevRow[b.length]
}

/** Real uploads carry small naming drift between revisions — a stray trailing digit, a typo — that
 * an exact-string family match misses entirely, silently letting genuine duplicates through with
 * no prompt at all. Tolerate a small edit distance (both an absolute cap and a relative-to-length
 * cap, so short segments don't get matched too loosely) instead of requiring byte-for-byte equality. */
function nearlyEqualSegment(a: string, b: string): boolean {
  if (a === b) return true
  if (!a || !b) return false
  const distance = levenshteinDistance(a, b)
  const maxLength = Math.max(a.length, b.length)
  return distance <= 2 && distance / maxLength <= 0.15
}

function sameFamily(a: ExistingBrdDoc['structured'], b: ExistingBrdDoc['structured']): boolean {
  if (!a || !b) return false
  const proj = (a.projectOrInitiativeName || '').trim().toLowerCase()
  const mod = (a.moduleOrFeatureName || '').trim().toLowerCase()
  if (!proj && !mod) return false
  return nearlyEqualSegment(proj, (b.projectOrInitiativeName || '').trim().toLowerCase())
    && nearlyEqualSegment(mod, (b.moduleOrFeatureName || '').trim().toLowerCase())
}

/** Prefer same-folder (or otherwise preferred) docs for LLM content/requirement compare. */
export function pickContentCompareCandidates(
  existing: ExistingBrdDoc[],
  options: { excludeIds?: Set<string>; preferredIds?: Set<string>; limit?: number } = {},
): ExistingBrdDoc[] {
  const excludeIds = options.excludeIds ?? new Set<string>()
  const preferredIds = options.preferredIds ?? new Set<string>()
  const limit = options.limit ?? 8
  const eligible = existing.filter((doc) => !excludeIds.has(doc.id))
  const preferred = eligible.filter((doc) => preferredIds.has(doc.id))
  const rest = eligible.filter((doc) => !preferredIds.has(doc.id))
  return [...preferred, ...rest].slice(0, Math.max(0, limit))
}

/** Find an existing doc with identical content fingerprint. */
export function findExactDuplicate(fingerprint: string, existing: ExistingBrdDoc[]): ExistingBrdDoc | null {
  if (!fingerprint) return null
  return existing.find((doc) => doc.contentSha256 && doc.contentSha256 === fingerprint) ?? null
}

/** Strip draft tags, version suffixes, and punctuation so informal names can be compared. */
export function informalDocumentFamilyKey(name: string): string {
  return (name || '')
    .replace(/\.[^/.]+$/, '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(?:v(?:ersion)?\.?\s*|rev(?:ision)?\.?\s*)\d+(?:\.\d+)*\b/gi, ' ')
    .replace(/[_\-]+v\d+(?:\.\d+)*/gi, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sameInformalFamily(a: ExistingBrdDoc, b: ExistingBrdDoc): boolean {
  const left = informalDocumentFamilyKey(a.fileName || a.title)
  const right = informalDocumentFamilyKey(b.fileName || b.title)
  if (left.length < 8 || right.length < 8) return false
  return nearlyEqualSegment(left, right)
}

/** Same BRD family (structured name) or the same informal title with version/draft stripped. */
export function findNameMatches(subject: ExistingBrdDoc, existing: ExistingBrdDoc[]): ExistingBrdDoc[] {
  return existing.filter((doc) => {
    if (doc.id === subject.id) return false
    return sameFamily(subject.structured, doc.structured) || sameInformalFamily(subject, doc)
  })
}

/** A KB entry was generated for a document if its content embeds the document id (source footer). */
export function findKbGeneratedDocIds(
  documentIds: string[],
  kbContents: string[],
): Set<string> {
  const generated = new Set<string>()
  const haystack = kbContents.join('\n').toLowerCase()
  for (const id of documentIds) {
    const needle = id.trim().toLowerCase()
    if (needle && haystack.includes(needle)) generated.add(id)
  }
  return generated
}

const STOPWORDS = new Set([
  'dan', 'di', 'ke', 'dari', 'untuk', 'yang', 'pada', 'atau', 'the', 'of', 'and', 'for', 'to', 'in',
  'brd', 'document', 'dokumen', 'process', 'proses', 'data',
])

function tokenize(text: string): Set<string> {
  return new Set(
    normalizeForFingerprint(text)
      .split(' ')
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const token of a) if (b.has(token)) intersection += 1
  return intersection / (a.size + b.size - intersection)
}

export const DUPLICATE_COMPARE_CHUNK_MAX_CHARS = 900
export const DUPLICATE_RETRIEVE_MIN_SCORE = 0.14
export const DUPLICATE_LEXICAL_NEAR_DUP_SCORE = 0.42
/** Cosine floor for retrieve (normalized embedding). Higher than Jaccard because unrelated pairs often sit ~0.3–0.5. */
export const DUPLICATE_EMBED_MIN_SCORE = 0.62
export const DUPLICATE_EMBED_NEAR_DUP_SCORE = 0.82

/** Split full document text so middle sections can be retrieved, not only the first 2000 chars. */
export function chunkDocumentForDuplicateCompare(
  text: string,
  maxChars: number = DUPLICATE_COMPARE_CHUNK_MAX_CHARS,
): string[] {
  const normalized = (text || '').replace(/<[^>]+>/g, ' ').replace(/\r\n/g, '\n').trim()
  if (!normalized) return []
  const parts = normalized
    .split(/\n{2,}|\n/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part.length >= 32)
  const chunks: string[] = []
  const push = (value: string) => {
    const compact = value.replace(/\s+/g, ' ').trim()
    if (!compact) return
    if (compact.length <= maxChars) {
      chunks.push(compact)
      return
    }
    const words = compact.split(' ')
    let window = ''
    for (const word of words) {
      const next = window ? `${window} ${word}` : word
      if (next.length <= maxChars) {
        window = next
        continue
      }
      if (window) chunks.push(window)
      window = word.length > maxChars ? word.slice(0, maxChars) : word
    }
    if (window) chunks.push(window)
  }
  let buffer = ''
  for (const part of parts) {
    if (!buffer) {
      buffer = part
      continue
    }
    if (buffer.length + 1 + part.length <= maxChars) {
      buffer = `${buffer} ${part}`
      continue
    }
    push(buffer)
    buffer = part
  }
  if (buffer) push(buffer)
  if (chunks.length === 0) push(normalized)
  return chunks.slice(0, 48)
}

export type RetrievedDuplicateChunkPair = {
  subjectChunk: string
  candidateChunk: string
  score: number
}

/**
 * Retrieve-then-rerank stage 1 (lexical): compare every subject chunk to every candidate chunk
 * (Jaccard). Prefer `retrieveSimilarChunksFromVectors` when Knowledge Index embeddings are available.
 */
export function retrieveSimilarChunks(
  subjectText: string,
  candidateText: string,
  options: { maxPairs?: number; minScore?: number } = {},
): RetrievedDuplicateChunkPair[] {
  const minScore = options.minScore ?? DUPLICATE_RETRIEVE_MIN_SCORE
  const maxPairs = options.maxPairs ?? 4
  const subjectChunks = chunkDocumentForDuplicateCompare(subjectText)
  const candidateChunks = chunkDocumentForDuplicateCompare(candidateText)
  if (subjectChunks.length === 0 || candidateChunks.length === 0) return []

  const subjectTokens = subjectChunks.map((chunk) => tokenize(chunk))
  const candidateTokens = candidateChunks.map((chunk) => tokenize(chunk))
  const scored: RetrievedDuplicateChunkPair[] = []
  for (let i = 0; i < subjectChunks.length; i += 1) {
    for (let j = 0; j < candidateChunks.length; j += 1) {
      const score = jaccard(subjectTokens[i], candidateTokens[j])
      if (score < minScore) continue
      scored.push({
        subjectChunk: subjectChunks[i],
        candidateChunk: candidateChunks[j],
        score,
      })
    }
  }
  return selectTopChunkPairs(scored, maxPairs)
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (!left.length || left.length !== right.length) return 0
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  for (let i = 0; i < left.length; i += 1) {
    dot += left[i] * right[i]
    leftNorm += left[i] * left[i]
    rightNorm += right[i] * right[i]
  }
  const denom = Math.sqrt(leftNorm) * Math.sqrt(rightNorm)
  if (denom === 0) return 0
  return Math.max(0, Math.min(1, dot / denom))
}

function selectTopChunkPairs(
  scored: RetrievedDuplicateChunkPair[],
  maxPairs: number,
): RetrievedDuplicateChunkPair[] {
  scored.sort((left, right) => right.score - left.score)
  const seen = new Set<string>()
  const unique: RetrievedDuplicateChunkPair[] = []
  for (const pair of scored) {
    const key = `${pair.subjectChunk.slice(0, 40)}::${pair.candidateChunk.slice(0, 40)}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(pair)
    if (unique.length >= maxPairs) break
  }
  return unique
}

/** Retrieve-then-rerank stage 1 (semantic): cosine over Knowledge Index embeddings. */
export function retrieveSimilarChunksFromVectors(
  subjectChunks: string[],
  candidateChunks: string[],
  vectorsByText: Map<string, number[]>,
  options: { maxPairs?: number; minScore?: number } = {},
): RetrievedDuplicateChunkPair[] {
  const minScore = options.minScore ?? DUPLICATE_EMBED_MIN_SCORE
  const maxPairs = options.maxPairs ?? 4
  if (subjectChunks.length === 0 || candidateChunks.length === 0) return []
  const scored: RetrievedDuplicateChunkPair[] = []
  for (const subjectChunk of subjectChunks) {
    const subjectVector = vectorsByText.get(subjectChunk)
    if (!subjectVector) continue
    for (const candidateChunk of candidateChunks) {
      const candidateVector = vectorsByText.get(candidateChunk)
      if (!candidateVector) continue
      const score = cosineSimilarity(subjectVector, candidateVector)
      if (score < minScore) continue
      scored.push({ subjectChunk, candidateChunk, score })
    }
  }
  return selectTopChunkPairs(scored, maxPairs)
}

export function windowsFromRetrievedPairs(
  pairs: RetrievedDuplicateChunkPair[],
  side: 'subject' | 'candidate',
  maxChars: number = COMPARE_PURPOSE_TEXT_MAX_CHARS,
): { summary: string; purpose: string } {
  const texts: string[] = []
  const seen = new Set<string>()
  for (const pair of pairs) {
    const chunk = side === 'subject' ? pair.subjectChunk : pair.candidateChunk
    const key = chunk.slice(0, 80)
    if (seen.has(key)) continue
    seen.add(key)
    texts.push(chunk)
  }
  if (texts.length === 0) return { summary: '', purpose: '' }
  return {
    summary: clipComparePurposeText(texts[0], maxChars),
    purpose: clipComparePurposeText((texts.slice(1).join(' ') || texts[0]), maxChars),
  }
}

/** Keyword-overlap shortlist of candidates likely to share a purpose (cheap pre-filter before LLM). */
export function shortlistByKeywordOverlap(
  subjectText: string,
  existing: ExistingBrdDoc[],
  options: { excludeIds?: Set<string>; threshold?: number; limit?: number } = {},
): ExistingBrdDoc[] {
  const { excludeIds = new Set(), threshold = 0.18, limit = 5 } = options
  const subjectTokens = tokenize(subjectText)
  return existing
    .filter((doc) => !excludeIds.has(doc.id))
    .map((doc) => ({
      doc,
      score: jaccard(
        subjectTokens,
        tokenize(`${doc.title} ${doc.fileName} ${doc.structured?.projectOrInitiativeName ?? ''} ${doc.structured?.moduleOrFeatureName ?? ''}`),
      ),
    }))
    .filter((entry) => entry.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.doc)
}
