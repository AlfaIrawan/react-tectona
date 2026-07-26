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

function sameFamily(a: ExistingBrdDoc['structured'], b: ExistingBrdDoc['structured']): boolean {
  if (!a || !b) return false
  const proj = (a.projectOrInitiativeName || '').trim().toLowerCase()
  const mod = (a.moduleOrFeatureName || '').trim().toLowerCase()
  if (!proj && !mod) return false
  return proj === (b.projectOrInitiativeName || '').trim().toLowerCase()
    && mod === (b.moduleOrFeatureName || '').trim().toLowerCase()
}

/** Find an existing doc with identical content fingerprint. */
export function findExactDuplicate(fingerprint: string, existing: ExistingBrdDoc[]): ExistingBrdDoc | null {
  if (!fingerprint) return null
  return existing.find((doc) => doc.contentSha256 && doc.contentSha256 === fingerprint) ?? null
}

/** Find existing docs of the same BRD family (project+module) by structured file name. */
export function findNameMatches(subject: ExistingBrdDoc, existing: ExistingBrdDoc[]): ExistingBrdDoc[] {
  return existing.filter((doc) => doc.id !== subject.id && sameFamily(subject.structured, doc.structured))
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
      score: jaccard(subjectTokens, tokenize(`${doc.title} ${doc.structured?.projectOrInitiativeName ?? ''} ${doc.structured?.moduleOrFeatureName ?? ''}`)),
    }))
    .filter((entry) => entry.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.doc)
}
