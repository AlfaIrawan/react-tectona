/**
 * Document Repository -> KB auto-generation helpers.
 */

import {
  getDocumentAttachmentDownloadUrl,
  listDocumentAttachments,
  resolveLatestDocumentAttachmentBlob,
} from '@/lib/api/documentKnowledgeApi'
import { extractDocumentTextPreview } from '@/lib/api/documentParserApi'
import { extractRepositoryDocxStructure, extractRepositoryPdfText } from '@/lib/api/tectonaAgentRuntimeApi'
import { extractSpreadsheetText, isSpreadsheetFile } from './extractSpreadsheetText'

export const KB_REPOSITORY_EXTRACT_MAX_CHARS = 80_000
export const KB_REPOSITORY_LLM_EXCERPT_MAX_CHARS = 3_200
// Keep safety buffer below backend validation max (20_000 chars).
export const KB_REPOSITORY_RUNTIME_MESSAGE_MAX_CHARS = 18_000

const MAX_READABLE_BYTES = 4 * 1024 * 1024

export type RepositoryExtractMethod = 'docx' | 'doc' | 'pdf' | 'xlsx' | 'plain' | 'parser' | 'none'

function isPdfFile(file: File): boolean {
  const lowerName = file.name.toLowerCase()
  const type = (file.type || '').toLowerCase()
  return lowerName.endsWith('.pdf') || type === 'application/pdf'
}

function isLegacyWordDoc(file: File): boolean {
  const lowerName = file.name.toLowerCase()
  const type = (file.type || '').toLowerCase()
  if (lowerName.endsWith('.docx') || type.includes('wordprocessingml')) return false
  return lowerName.endsWith('.doc') || type === 'application/msword' || type === 'application/x-msword'
}

export interface RepositoryDocumentExtractResult {
  text: string
  fullCharCount: number
  truncated: boolean
  method: RepositoryExtractMethod
}

export interface RepositoryKbSourceMeta {
  documentId: string
  projectId: string
  projectName: string
  documentTitle: string
  fileName: string
  fileType: string
  fileSize: number
  documentVersionNo?: number
  documentVersionLabel?: string | null
  extract: RepositoryDocumentExtractResult
}

import type { BrdKbRequiredSection, BrdToKbContentStandardParsed } from './brdToKbContentStandard'

export type BrdStructuredNameParts = {
  projectOrInitiativeName: string
  moduleOrFeatureName: string
  version: string
  yyyymmdd: string
}

export function normalizeBrdVersionLabel(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/\([^)]*\)/g, '').trim()
  if (!trimmed) return null
  // (?:\.\d+)? only allowed ONE decimal segment — with the required ^...$ full-string match, a
  // multi-segment value like "0.2.5" failed to match at all (the trailing ".5" broke the anchor),
  // silently falling through to returning it WITHOUT the "V" prefix instead of normalizing it.
  const numeric = trimmed.match(/^(?:v(?:ersion)?\s*)?(\d+(?:\.\d+)*)$/i)?.[1]
  if (numeric) return `V${numeric}`
  if (/^v\d/i.test(trimmed)) return trimmed.toUpperCase()
  return trimmed
}

/** Parse structured file names: BRD_|URD_|FSD_|TPL_{Workspace}_{Module}_V{n}_{yyyymmdd}. */
export function parseStructuredDocumentName(value: string): BrdStructuredNameParts | null {
  const baseName = value.replace(/\.[^/.]+$/, '').trim()
  if (!/^(?:BRD|URD|FSD|TPL)_/i.test(baseName)) return null
  const tokens = baseName.split('_').filter(Boolean)
  if (tokens.length < 5) return null
  const yyyymmdd = tokens[tokens.length - 1]
  const version = tokens[tokens.length - 2]
  // (?:\.\d+)? only allowed ONE decimal segment — "V0.2.5" failed this gate entirely, so the
  // WHOLE structured-name parse returned null for that file. Since sameFamily() short-circuits to
  // false whenever either side's `structured` is null, that silently broke "same family, offer
  // save-as-new-version" duplicate detection for any multi-segment version — not just its own
  // display formatting, but the whole revision-linking feature for that upload.
  if (!/^\d{8}$/.test(yyyymmdd) || !/^V\d+(?:\.\d+)*$/i.test(version)) return null
  const middle = tokens.slice(1, -2)
  if (middle.length < 2) return null
  return {
    projectOrInitiativeName: middle[0],
    moduleOrFeatureName: middle.slice(1).join('_'),
    version: version.toUpperCase(),
    yyyymmdd,
  }
}

export function parseBrdStructuredName(value: string): BrdStructuredNameParts | null {
  const baseName = value.replace(/\.[^/.]+$/, '').trim()
  if (!/^BRD_/i.test(baseName)) return null
  return parseStructuredDocumentName(value)
}

export function detectBrdVersionFromName(value: string): string {
  const structured = parseBrdStructuredName(value)
  if (structured?.version) return structured.version
  // Regression: the old pattern captured only the FIRST digit group after "v" and stopped at the
  // next space, so "v 0 2" and "v 0 2.5" (a common human naming convention — spaces standing in
  // for dots between version segments) both collapsed to "V0", masking two genuinely different
  // revisions as if they were the same version. Capture the full run of digit groups joined by
  // spaces/dots/dashes/underscores, then normalize the separators to dots.
  const match = value.match(/(?:^|[\s_.-])v(?:ersion)?[\s_.-]*([0-9](?:[0-9\s_.-]*[0-9])?)/i)
  if (!match?.[1]) return 'V1'
  const parts = match[1].split(/[\s_.-]+/).filter(Boolean)
  return `V${parts.join('.')}`
}

export function extractBrdVersionFromDocumentText(text: string): string | null {
  const source = text.replace(/\r/g, '\n').slice(0, 6000)
  if (!source.trim()) return null

  // (?:\.\d+)? only allows ONE decimal segment, so an explicit "Version: 0.2.5" in the document
  // body truncated to "V0.2" — the same class of bug fixed in detectBrdVersionFromName above, but
  // here it takes priority OVER the (already-correct) file-name detection, since document-body
  // text is checked first. (?:\.\d+)* allows any number of segments.
  const patterns = [
    /\b(?:document\s+)?version\s*(?:no\.?|number)?\s*[:\-]\s*([vV]?\d+(?:\.\d+)*)/i,
    /\bversi\s*(?:dokumen)?\s*[:\-]\s*([vV]?\d+(?:\.\d+)*)/i,
    /\bversion\s*[:\-]\s*([vV]?\d+(?:\.\d+)*)/i,
  ]

  for (const pattern of patterns) {
    const match = source.match(pattern)
    const normalized = normalizeBrdVersionLabel(match?.[1] ?? null)
    if (normalized) return normalized
  }

  return null
}

export function extractBrdProjectOrInitiativeNameFromDocumentText(text: string): string | null {
  const lines = text.replace(/\r/g, '\n').slice(0, 8000).split('\n')

  const linePatterns = [
    /^(?:project\s*(?:\/\s*initiative)?\s*name|project\s*or\s*initiative(?:\s*name)?|initiative\s*name|program\s*name|nama\s*(?:proyek|inisiatif|program))\s*[:\-]\s*(.+)$/i,
    /^(?:business\s+initiative|initiative)\s*[:\-]\s*(.+)$/i,
  ]

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue
    for (const pattern of linePatterns) {
      const match = trimmedLine.match(pattern)
      const candidate = match?.[1]?.replace(/\([^)]*\)/g, '').trim() ?? ''
      if (candidate.length < 2 || candidate.length > 120) continue
      if (/^(project team|project id|document id|system|n\/a)$/i.test(candidate)) continue
      return candidate
    }
  }

  return null
}

export function resolveRepositoryDocumentVersionLabel(params: {
  title: string
  fileName?: string | null
  metadata?: Record<string, unknown> | null
  currentVersionNo?: number | null
  documentText?: string | null
}): string {
  const metaLabel = typeof params.metadata?.document_version_label === 'string'
    ? normalizeBrdVersionLabel(params.metadata.document_version_label)
    : null
  if (metaLabel) return metaLabel

  const textLabel = params.documentText ? extractBrdVersionFromDocumentText(params.documentText) : null
  if (textLabel) return textLabel

  const candidates = [params.title, params.fileName].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  for (const candidate of candidates) {
    const parsed = parseBrdStructuredName(candidate)
    if (parsed?.version) return parsed.version
    const detected = normalizeBrdVersionLabel(detectBrdVersionFromName(candidate))
    if (detected && detected !== 'V1') return detected
  }

  if (typeof params.currentVersionNo === 'number' && params.currentVersionNo > 0) {
    return `v${params.currentVersionNo}`
  }
  return 'V1'
}

export type BrdAffectedApplication = {
  name: string
  impact?: string | null
}

export type BrdStakeholderEntry = {
  name: string
  role: string
}

const BRD_TOC_STOP_HEADING = /^(?:appendix|lampiran|glossary|glosarium|references|referensi|approval|persetujuan)\b/i
const BRD_KB_PERSON_BLOCKLIST = new Set([
  'Ringkasan Eksekutif',
  'Ruang Lingkup',
  'Table Of Contents',
  'Daftar Isi',
  'Business Requirement Document',
  'Document Repository',
  'Project Team',
  'Project Id',
  'Document Id',
])

const BRD_STAKEHOLDER_LABEL_WORDS = new Set([
  'business', 'requirement', 'document', 'brd', 'copyright', 'notice', 'table', 'contents',
  'revision', 'history', 'sign', 'signature', 'process', 'product', 'finance', 'directorate',
  'information', 'technology', 'management', 'comments', 'date', 'related', 'operational',
  'architecture', 'confirm', 'versi', 'sections', 'changed', 'author', 'submit', 'sebutkan',
  'full', 'risk', 'dept', 'div', 'key', 'area', 'nama', 'user', 'helpdesk', 'aplikasi',
  'adira', 'dinamika', 'multi', 'tbk', 'dinamika', 'partner', 'urep', 'and', 'all', 'the',
  'for', 'from', 'with', 'signatory', 'owner', 'header', 'footer', 'template', 'field',
  'confirm', 'submit', 'sebutkan', 'changed', 'sections', 'comments', 'signature', 'date',
  'operational', 'related', 'directorate', 'copyright', 'notice', 'revision', 'history',
  'contents', 'requirement', 'document', 'business', 'process', 'management', 'information',
  'technology', 'finance', 'helpdesk', 'aplikasi', 'pt', 'dinamika', 'multifinance',
  // Section/document heading words that can be mistaken for a person's name when a table row
  // pairs a heading with a role (e.g. "Overview ... Head of IT" got parsed as name="Overview").
  'overview', 'summary', 'description', 'objective', 'background', 'scope', 'conclusion',
  'introduction', 'purpose', 'appendix', 'attachment',
])

const BRD_STAKEHOLDER_NOISE_PHRASE = /\b(?:business requirement document|table of contents|revision history|copyright notice|sign off|full sign|confirm brd|nama user|nama urep|nama it|process owner|product owner|dept\.?\s*head|div\.?\s*head|key user|risk management|business process|information technology)\b/i

const BRD_ROLE_TITLE_PATTERN = /(?:chief|head|director|manager|officer|owner|partner|pic|approver|reviewer|president|lead|vp|brm|brs|architect|analyst|consultant|coordinator|supervisor|penanggung\s*jawab|key user|process owner|product owner|business partner|solution architecture|developer|engineer|specialist|administrator|stakeholder|development|system|quality|\bqc\b)/i

const BRD_STAKEHOLDER_PROSE_START = /^(?:apabila|jika|when|petugas|seluruh|setelah|sebelum|untuk|agar|dengan|melalui|dilakukan|wajib|dapat|tidak|adapun|pencatatan|nomor|referensi|histori|pelaporan)\b/i

export const REPOSITORY_KB_STAKEHOLDER_NAME_MAX_CHARS = 120
export const REPOSITORY_KB_STAKEHOLDER_ROLE_MAX_CHARS = 200

function stripHtmlToPlainText(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeHeadingLabel(value: string): string {
  return value
    // Strip leading TOC numbering: "I. ", "1. ", "1.2 ", "IV. "
    .replace(/^(?:[IVXLCDMivxlcdm]+\.|[0-9]+(?:\.[0-9]+)*\.?)\s+/, '')
    .replace(/\*/g, '')
    .replace(/\s*\([^)]*(?:jika\s+diperlukan|jika\s+ada|bila\s+diperlukan|diisi\s+oleh|diisi\s+jika|opsional|optional|if\s+applicable|if\s+needed)[^)]*\)\s*$/i, '')
    // Strip dotted TOC leaders ("Latar Belakang .... 6") before trailing page numbers.
    .replace(/\.{2,}.*$/, '')
    // Strip trailing page numbers, with dotted leader ("...6") OR plain whitespace ("Overview 6")
    .replace(/[\s. ]+\d+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isLikelyTocHeading(value: string): boolean {
  const cleaned = normalizeHeadingLabel(value)
  if (cleaned.length < 3 || cleaned.length > 140) return false
  if (BRD_TOC_STOP_HEADING.test(cleaned)) return false
  if (/^(table\s+of\s+contents|daftar\s+isi|business\s+requirement\s+document)$/i.test(cleaned)) return false
  return true
}

function pushUniqueHeading(target: string[], value: string) {
  const cleaned = normalizeHeadingLabel(value)
  if (!isLikelyTocHeading(cleaned)) return
  const key = cleaned.toLowerCase()
  if (target.some((item) => item.toLowerCase() === key)) return
  target.push(cleaned)
}

// Regex for top-level TOC entries: Roman numerals using only I,V,X,L,M — excludes C and D so that
// alphabetic sub-entries like C. and D. are not mistaken for Roman-numeral top-level entries.
const TOC_MAIN_ENTRY_RE = /^(?:[IVXLMivxlm]+\.|[0-9]+(?:\.[0-9]+)*\.?)\s+(.+?)(?:\s+\.{2,}\s*\d+|\s+\d+\s*$|$)/
// Regex for alphabetic sub-entries: A., B., C., D. etc.
const TOC_SUB_ENTRY_RE = /^[A-Za-z]\.\s+(.+?)(?:\s+\.{2,}\s*\d+|\s+\d+\s*$|$)/

export function extractBrdTableOfContentsEntries(text: string, maxItems = 25): string[] {
  const source = text.replace(/\r/g, '\n')
  if (!source.trim()) return []

  // Prefer the heading outline extracted from Word heading styles (most reliable —
  // independent of auto-numbering and dotted-leader page numbers).
  const headingsMarkerIndex = source.indexOf(DOCX_HEADINGS_MARKER)
  if (headingsMarkerIndex !== -1) {
    const block = source.slice(headingsMarkerIndex + DOCX_HEADINGS_MARKER.length)
    const blockEnd = block.indexOf('\n\n')
    const lines = (blockEnd === -1 ? block : block.slice(0, blockEnd))
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    const outline: string[] = []
    for (const line of lines) {
      // Hierarchical entries ("Parent > Sub") pass through; others get TOC-cleaned.
      if (line.includes(' > ')) {
        const [parent, sub] = line.split(' > ')
        const cleanParent = normalizeHeadingLabel(parent)
        const cleanSub = normalizeHeadingLabel(sub)
        if (cleanParent && cleanSub && isLikelyTocHeading(cleanParent)) {
          outline.push(`${cleanParent} > ${cleanSub}`)
        }
      } else {
        pushUniqueHeading(outline, line)
      }
      if (outline.length >= maxItems) break
    }
    if (outline.length > 0) return outline
  }

  const entries: string[] = []
  const tocMatch = source.match(/\b(?:table\s+of\s+contents|daftar\s+isi)\b/i)
  if (tocMatch && typeof tocMatch.index === 'number') {
    const tocBlock = source.slice(tocMatch.index, tocMatch.index + 12_000)
    const lines = tocBlock.split('\n')
    let consecutiveMisses = 0
    let currentParent: string | null = null
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        if (entries.length > 0) {
          consecutiveMisses += 1
          if (consecutiveMisses >= 3) break
        }
        continue
      }
      consecutiveMisses = 0
      if (/^(?:table\s+of\s+contents|daftar\s+isi)$/i.test(trimmed)) continue
      if (BRD_TOC_STOP_HEADING.test(trimmed)) break

      // Top-level Roman numeral / numbered entry
      const mainMatch = trimmed.match(TOC_MAIN_ENTRY_RE)
      if (mainMatch?.[1]) {
        const normalized = normalizeHeadingLabel(mainMatch[1])
        if (isLikelyTocHeading(normalized)) {
          pushUniqueHeading(entries, normalized)
          currentParent = normalized
        }
        if (entries.length >= maxItems) break
        continue
      }

      // Alphabetic sub-entry (A., B., C., D.) — prefix with parent for LLM context
      const subMatch = trimmed.match(TOC_SUB_ENTRY_RE)
      if (subMatch?.[1] && currentParent) {
        const subNormalized = normalizeHeadingLabel(subMatch[1])
        if (subNormalized.length >= 3 && !BRD_TOC_STOP_HEADING.test(subNormalized)) {
          pushUniqueHeading(entries, `${currentParent} > ${subNormalized}`)
        }
        if (entries.length >= maxItems) break
        continue
      }

      if (entries.length > 0) {
        consecutiveMisses += 1
        if (consecutiveMisses >= 3) break
      }
    }
  }

  if (entries.length > 0) return entries

  const inlineRomanPattern = /(?:^|\s)([IVXLCDM]{1,4}\.\s+[A-Za-z][A-Za-z0-9\s,&'-]{2,80}?)(?=\s+[IVXLCDM]{1,4}\.|\s+[A-Z]\.\s|\b(?:revision history|business process|table of contents)\b|$)/gi
  for (const match of source.matchAll(inlineRomanPattern)) {
    pushUniqueHeading(entries, match[1].replace(/^[IVXLCDM]+\.\s*/i, ''))
    if (entries.length >= maxItems) break
  }

  if (entries.length > 0) return entries

  const inlineLetterPattern = /(?:^|\s)([A-Z]\.\s+[A-Za-z][A-Za-z0-9\s,&'-]{2,60}?)(?=\s+[A-Z]\.\s|\s+[IVXLCDM]{1,4}\.|$)/gi
  for (const match of source.matchAll(inlineLetterPattern)) {
    pushUniqueHeading(entries, match[1].replace(/^[A-Z]\.\s*/, ''))
    if (entries.length >= maxItems) break
  }

  if (entries.length > 0) return entries

  for (const line of source.split('\n')) {
    const trimmed = line.trim()
    if (/^(?:[IVXLCDM]{1,4}\.|[0-9]+(?:\.[0-9]+)*\.?)\s+[A-Za-z]/.test(trimmed)) {
      pushUniqueHeading(entries, trimmed.replace(/^(?:[IVXLCDM]{1,4}\.|[0-9]+(?:\.[0-9]+)*\.?)\s+/, ''))
    }
    if (entries.length >= maxItems) break
  }

  return entries
}

export function extractAffectedApplicationsFromDocumentText(text: string, maxItems = 20): BrdAffectedApplication[] {
  const source = text.replace(/\r/g, '\n')
  if (!source.trim()) return []

  const byKey = new Map<string, BrdAffectedApplication>()
  const pushApp = (name: string, impact?: string | null) => {
    const cleanedName = name.replace(/\s+/g, ' ').trim()
    if (!cleanedName || cleanedName.length < 2 || cleanedName.length > 80) return
    const key = cleanedName.toLowerCase()
    if (!byKey.has(key)) {
      byKey.set(key, { name: cleanedName, impact: impact?.trim() || null })
    } else if (impact?.trim() && !byKey.get(key)?.impact) {
      byKey.set(key, { name: cleanedName, impact: impact.trim() })
    }
  }

  const sectionMatch = source.match(
    /(?:^|\n)\s*(?:aplikasi\s+yang\s+terdampak|affected\s+applications?|sistem\s+(?:terkait|terdampak)|system\s+landscape|integrasi\s+sistem)\s*[:\-]?\s*\n([\s\S]{0,3000}?)(?:\n\s*\n|\n\s*(?:[IVXLCDM]+\.|[0-9]+\.)|$)/i,
  )
  if (sectionMatch?.[1]) {
    for (const line of sectionMatch[1].split('\n')) {
      const trimmed = line.trim().replace(/^[-*•]\s*/, '')
      if (!trimmed) continue
      const bulletMatch = trimmed.match(/^([A-Za-z0-9][A-Za-z0-9\s./_-]{1,60}?)(?:\s*[:\-—]\s*(.+))?$/)
      if (bulletMatch?.[1]) pushApp(bulletMatch[1], bulletMatch[2] ?? null)
    }
  }

  const inlineRegex = /\b(?:aplikasi|sistem|system|platform|modul)\s+([A-Z0-9][A-Za-z0-9./_-]{1,40})\b/g
  for (const match of source.matchAll(inlineRegex)) {
    pushApp(match[1] ?? '')
  }

  const acronymRegex = /\b(?:via|melalui|menggunakan|integrasi\s+dengan|terhubung\s+ke)\s+([A-Z]{2,12})\b/g
  for (const match of source.matchAll(acronymRegex)) {
    pushApp(match[1] ?? '')
  }

  return Array.from(byKey.values()).slice(0, maxItems)
}

function looksLikeApprovalPersonName(value: string): boolean {
  const cleaned = value.replace(/\s+OK\s*$/i, '').replace(/\s+/g, ' ').trim()
  if (!cleaned || cleaned.length < 3 || cleaned.length > 60) return false
  if (/\d/.test(cleaned)) return false
  if (BRD_STAKEHOLDER_PROSE_START.test(cleaned)) return false
  if (/^(?:area|name|comments|signature|date|approval|ok|business|process|information|technology)$/i.test(cleaned)) {
    return false
  }

  const words = cleaned.split(' ').filter(Boolean)
  if (words.length < 1 || words.length > 5) return false
  if (!words.every((word) => /^[A-Z][A-Za-z'.-]{1,}$/.test(word))) return false

  const nonPersonTokens = words.filter((word) => /^[A-Z]{2,5}$/.test(word) && word.length <= 5)
  if (nonPersonTokens.length > 0) return false

  const noisyWordCount = words.filter((word) => BRD_STAKEHOLDER_LABEL_WORDS.has(word.toLowerCase())).length
  if (noisyWordCount > 0) return false

  if (words.length === 1) {
    return words[0].length >= 4 && !/^(Head|Area|Name|Comments|Signature|Date|Approval|Business|Process|System|Solution)$/i.test(words[0])
  }

  return looksLikeBrdPersonName(cleaned)
}

const ROLE_WORDS_IN_APPROVAL_NAME = /^(?:Analyst|Architect|System|Solution|Development|Head|Officer|Manager|Director|QC|LM|CLAR|IT|Dept|Div|Business|Process|Product|Senior|Partner)\b/i

function scoreApprovalSplit(role: string, name: string): number {
  if (!looksLikeBrdRole(role) || !looksLikeApprovalPersonName(name)) return -1

  let score = 10
  if (/^(?:Head|IT|Chief|Director|Manager|Business|Process|Product|Key|Senior|VP|Dept|Div)/i.test(role)) {
    score += 6
  }
  if (ROLE_WORDS_IN_APPROVAL_NAME.test(name)) score -= 25
  const nameWords = name.split(/\s+/).length
  const lineWordCount = role.split(/\s+/).length + nameWords
  if (nameWords === 2) score += 4
  if (nameWords === 3) score += 3
  if (nameWords === 1) score += 2
  if (nameWords === 1 && lineWordCount >= 5) score -= 12
  if (/\b[A-Z][a-z]{2,}\s*$/.test(role) && !/(?:Head|Analyst|Architect|Manager|Officer|Director|Partner|Owner|QC|Dept|Div|Development|System|Solution|IT|LM|CLAR|Business|Process|Product|Senior)\s*$/i.test(role)) {
    score -= 10
  }
  score += Math.min(role.split(/\s+/).length, 10)
  return score
}

function splitApprovalRoleAndName(line: string): BrdStakeholderEntry | null {
  const trimmed = line.trim().replace(/\s+OK\s*$/i, '').trim()
  if (!trimmed || /^(?:area|name|comments|signature|date)\b/i.test(trimmed)) return null
  if (/^APPROVAL\b/i.test(trimmed)) return null

  const tabParts = trimmed.split(/\t|\|/).map((part) => part.trim()).filter(Boolean)
  if (tabParts.length >= 2) {
    const role = tabParts[0]
    let name = tabParts[1]
    if (/^(?:OK|\-+|\.+|comments?|signature|date)$/i.test(name) && tabParts[2]) {
      name = tabParts[2]
    }
    name = name.replace(/\s+OK\s*$/i, '').trim()
    if (looksLikeBrdRole(role) && looksLikeApprovalPersonName(name)) {
      return { name, role }
    }
  }

  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length < 3) return null

  let best: BrdStakeholderEntry | null = null
  let bestScore = -1
  for (let nameWordCount = 1; nameWordCount <= Math.min(4, words.length - 2); nameWordCount += 1) {
    const name = words.slice(-nameWordCount).join(' ')
    const role = words.slice(0, -nameWordCount).join(' ')
    const score = scoreApprovalSplit(role, name)
    if (score > bestScore) {
      bestScore = score
      best = { name, role }
    }
  }

  return bestScore >= 0 ? best : null
}

function parseApprovalTableRow(line: string): BrdStakeholderEntry | null {
  return splitApprovalRoleAndName(line)
}

function scanLinesForApprovalStakeholders(
  lines: string[],
  target: Map<string, BrdStakeholderEntry>,
  maxItems: number,
) {
  for (let index = 0; index < lines.length; index += 1) {
    if (target.size >= maxItems) return

    const parsed = parseApprovalTableRow(lines[index] ?? '')
    if (parsed) {
      pushApprovalStakeholder(target, parsed.name, parsed.role)
      continue
    }

    const roleLine = (lines[index] ?? '').trim()
    const nameLine = (lines[index + 1] ?? '').trim().replace(/\s+OK\s*$/i, '').trim()
    if (
      roleLine
      && nameLine
      && looksLikeBrdRole(roleLine)
      && looksLikeApprovalPersonName(nameLine)
      && !looksLikeBrdRole(nameLine)
      && !/^(?:area|name|comments|signature|date)\b/i.test(roleLine)
    ) {
      pushApprovalStakeholder(target, nameLine, roleLine)
      index += 1
    }
  }
}

function scanMultilineApprovalBlocks(
  lines: string[],
  target: Map<string, BrdStakeholderEntry>,
  maxItems: number,
) {
  const roleParts: string[] = []

  const flushRoleWithName = (nameLine: string): boolean => {
    if (roleParts.length === 0) return false
    const role = roleParts.join(' ').replace(/\s+/g, ' ').trim()
    roleParts.length = 0
    if (!looksLikeBrdRole(role) || !looksLikeApprovalPersonName(nameLine)) return false
    pushApprovalStakeholder(target, nameLine, role)
    return true
  }

  for (const rawLine of lines) {
    if (target.size >= maxItems) return

    const line = rawLine.trim().replace(/\s+OK\s*$/i, '').trim()
    if (!line || /^(?:area|name|comments|signature|date|no|#)\b/i.test(line)) continue
    if (/^APPROVAL\b/i.test(line)) continue

    const inline = parseApprovalTableRow(line)
    if (inline) {
      roleParts.length = 0
      pushApprovalStakeholder(target, inline.name, inline.role)
      continue
    }

    if (looksLikeApprovalPersonName(line)) {
      if (!flushRoleWithName(line)) {
        roleParts.length = 0
      }
      continue
    }

    const startsRoleFragment = /^(?:Head|IT|Chief|Director|Manager|Officer|Business|Process|Product|Key|Senior|VP|Dept|Div|System|Solution|Development|QC|Approver|Reviewer|PIC|BRM|BRS)/i.test(line)
    if (startsRoleFragment || roleParts.length > 0) {
      roleParts.push(line)
      if (roleParts.length > 8) {
        roleParts.shift()
      }
      const combined = roleParts.join(' ')
      if (looksLikeBrdRole(combined)) {
        // Tunggu baris nama berikutnya.
        continue
      }
      if (roleParts.length > 1) {
        roleParts.shift()
      }
      continue
    }

    roleParts.length = 0
  }
}

function extractTabDelimitedStakeholders(
  source: string,
  target: Map<string, BrdStakeholderEntry>,
  maxItems: number,
) {
  for (const line of source.split('\n')) {
    if (target.size >= maxItems) return
    const parts = line.split('\t').map((part) => part.trim()).filter(Boolean)
    if (parts.length < 2) continue

    const [first, second] = parts
    if (looksLikeBrdRole(first) && looksLikeApprovalPersonName(second)) {
      pushApprovalStakeholder(target, second, first)
      continue
    }
    if (looksLikeBrdRole(second) && looksLikeApprovalPersonName(first)) {
      pushApprovalStakeholder(target, first, second)
    }
  }
}

function extractApprovalTableStakeholders(source: string, target: Map<string, BrdStakeholderEntry>, maxItems = 40) {
  const normalized = source.replace(/\u00a0/g, ' ')

  const tableExtractMatch = normalized.match(/--- DOCX TABLE EXTRACT ---([\s\S]*?)(?:--- DOCX BODY ---|$)/i)
  if (tableExtractMatch?.[1]) {
    const tableBlock = tableExtractMatch[1]
    const tableLines = tableBlock.split('\n')
    scanLinesForApprovalStakeholders(tableLines, target, maxItems)
    scanMultilineApprovalBlocks(tableLines, target, maxItems)
    scanAlternatingRoleNamePairs(tableLines, target, maxItems)
    extractTabDelimitedStakeholders(tableBlock, target, maxItems)
  }

  const approvalMatch = normalized.match(
    /\b(?:APPROVAL(?:[\s-–—]*(?:IT|BUSINESS|USER))?|SIGN[\s-]*OFF|Persetujuan(?:\s+IT)?|Disetujui\s+Oleh)\b/i,
  )
  if (approvalMatch && typeof approvalMatch.index === 'number') {
    const block = normalized.slice(approvalMatch.index, approvalMatch.index + 20_000)
    const lines = block.split('\n')
    scanLinesForApprovalStakeholders(lines, target, maxItems)
    scanMultilineApprovalBlocks(lines, target, maxItems)
    scanAlternatingRoleNamePairs(lines, target, maxItems)
  }

  const areaNameMatch = normalized.search(
    /\b(?:Area|Jabatan|Posisi|Peran|Role|Bagian)\b[\s\n]{0,160}\b(?:Name|Nama)\b/i,
  )
  if (areaNameMatch >= 0 && target.size < maxItems) {
    const block = normalized.slice(areaNameMatch, areaNameMatch + 20_000)
    const lines = block.split('\n')
    scanLinesForApprovalStakeholders(lines, target, maxItems)
    scanMultilineApprovalBlocks(lines, target, maxItems)
    scanAlternatingRoleNamePairs(lines, target, maxItems)
  }

  extractTabDelimitedStakeholders(normalized, target, maxItems)

  const tail = normalized.slice(Math.max(0, normalized.length - 30_000))
  const tailLines = tail.split('\n')
  scanLinesForApprovalStakeholders(tailLines, target, maxItems)
  scanMultilineApprovalBlocks(tailLines, target, maxItems)
  scanAlternatingRoleNamePairs(tailLines, target, maxItems)

  if (target.size < 2) {
    scanMultilineApprovalBlocks(normalized.split('\n'), target, maxItems)
    scanAlternatingRoleNamePairs(normalized.split('\n'), target, maxItems)
  }
}

function normalizeStakeholderRole(value: string): string {
  return value
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^OK+\s*/i, '')
    .replace(/\bOK+\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isJunkStakeholderRole(role: string): boolean {
  const cleaned = normalizeStakeholderRole(role)
  if (!cleaned) return true
  if (/^Ok+Key/i.test(cleaned)) return true
  if (/^key user\s*\(collection\)$/i.test(cleaned)) return true
  return false
}

function scoreStakeholderRole(role: string): number {
  const cleaned = normalizeStakeholderRole(role)
  if (!cleaned || isJunkStakeholderRole(cleaned)) return -100
  let score = cleaned.length
  if (/^(?:head|chief|director|manager|analyst|architect|approver|pic|owner|partner|qc)\b/i.test(cleaned)) {
    score += 40
  }
  if (/^module owner$/i.test(cleaned)) score += 10
  if (/peran belum teridentifikasi/i.test(cleaned)) score -= 50
  return score
}

function dedupeStakeholderEntries(stakeholders: BrdStakeholderEntry[]): BrdStakeholderEntry[] {
  const byName = new Map<string, BrdStakeholderEntry>()
  for (const entry of stakeholders) {
    const name = entry.name.replace(/\s+/g, ' ').trim()
    const role = normalizeStakeholderRole(entry.role)
    if (!name || isJunkStakeholderRole(role)) continue
    const normalized = { name, role }
    const key = name.toLowerCase()
    const existing = byName.get(key)
    if (!existing || scoreStakeholderRole(normalized.role) > scoreStakeholderRole(existing.role)) {
      byName.set(key, normalized)
    }
  }
  return Array.from(byName.values())
}

function pushApprovalStakeholder(target: Map<string, BrdStakeholderEntry>, name: string, role: string) {
  const cleanedName = name.replace(/["'`*]/g, '').replace(/\s+/g, ' ').trim()
  const cleanedRole = normalizeStakeholderRole(role)
  if (!looksLikeApprovalPersonName(cleanedName)) return
  if (!looksLikeBrdRole(cleanedRole)) return
  const key = cleanedName.toLowerCase()
  const existing = target.get(key)
  if (!existing || existing.role.length < cleanedRole.length) {
    target.set(key, { name: cleanedName, role: cleanedRole })
  }
}

function looksLikeBrdPersonName(value: string): boolean {
  const cleaned = value.replace(/\s+/g, ' ').trim()
  if (!cleaned || cleaned.length < 4 || cleaned.length > 60) return false
  if (/\d/.test(cleaned)) return false
  if (BRD_KB_PERSON_BLOCKLIST.has(cleaned)) return false
  if (BRD_STAKEHOLDER_NOISE_PHRASE.test(cleaned)) return false
  if (BRD_STAKEHOLDER_PROSE_START.test(cleaned)) return false

  const words = cleaned.split(' ').filter(Boolean)
  if (words.length < 2 || words.length > 5) return false
  if (!words.every((word) => /^[A-Z][A-Za-z'.-]{1,}$/.test(word))) return false

  const noisyWordCount = words.filter((word) => BRD_STAKEHOLDER_LABEL_WORDS.has(word.toLowerCase())).length
  if (noisyWordCount > 0) return false

  // Nama orang biasanya punya minimal satu token panjang (bukan singkatan form).
  return words.some((word) => word.length >= 4 && !/^(PT|Tbk|And|All|Off|IT|HR|CEO|CFO|COO|CTO|VP|Apabila|Aplikasi|Helpdesk|Pencatatan|Petugas|Seluruh)$/i.test(word))
}

function looksLikeBrdRole(value: string): boolean {
  const role = value.replace(/\s+/g, ' ').trim()
  if (!role || role.length > REPOSITORY_KB_STAKEHOLDER_ROLE_MAX_CHARS) return false
  if (/^peran belum teridentifikasi$/i.test(role)) return false
  if (BRD_STAKEHOLDER_NOISE_PHRASE.test(role)) return false
  if (BRD_STAKEHOLDER_PROSE_START.test(role)) return false
  if (/^(nama|user|versi|sign|off|confirm|submit|sebutkan|comments|signature|date|related|changed|sections|author|revision|history|document|business|requirement)$/i.test(role)) {
    return false
  }
  if (/[.!?]/.test(role)) return false
  if (role.split(/\s+/).length > 10) return false
  if (/,/.test(role) && role.length > 80) return false
  return BRD_ROLE_TITLE_PATTERN.test(role)
}

function isLikelyPersonName(value: string): boolean {
  return looksLikeBrdPersonName(value)
}

export function filterVerifiedStakeholders(stakeholders: BrdStakeholderEntry[]): BrdStakeholderEntry[] {
  return stakeholders.filter(
    (entry) =>
      (looksLikeBrdPersonName(entry.name) || looksLikeApprovalPersonName(entry.name))
      && looksLikeBrdRole(entry.role),
  )
}

/** Siapkan stakeholder terverifikasi untuk payload API runtime (batas panjang backend). */
export function sanitizeDetectedStakeholdersForRuntimeApi(stakeholders: BrdStakeholderEntry[]): BrdStakeholderEntry[] {
  return dedupeStakeholderEntries(
    filterVerifiedStakeholders(stakeholders)
      .filter(
        (entry) =>
          entry.name.length <= REPOSITORY_KB_STAKEHOLDER_NAME_MAX_CHARS
          && entry.role.length <= REPOSITORY_KB_STAKEHOLDER_ROLE_MAX_CHARS
          && !isJunkStakeholderRole(entry.role),
      ),
  ).slice(0, 40)
}

function pushStakeholder(target: Map<string, BrdStakeholderEntry>, name: string, role: string) {
  // Strip stray markdown bold markers ("**Head of IT**") that survive from LLM output or source
  // text into the name/role text — they render literally instead of as bold.
  const cleanedName = name.replace(/["'`*]/g, '').replace(/\s+/g, ' ').trim()
  const cleanedRole = role.replace(/\*/g, '').replace(/\s+/g, ' ').trim()
  if (!looksLikeBrdPersonName(cleanedName)) return
  if (!looksLikeBrdRole(cleanedRole)) return
  const key = cleanedName.toLowerCase()
  const genericRoles = new Set(['pic', 'owner', 'stakeholder', 'approver', 'reviewer', 'approval'])
  const existing = target.get(key)
  if (!existing) {
    target.set(key, { name: cleanedName, role: cleanedRole || 'Peran belum teridentifikasi' })
    return
  }
  if (existing.role === 'Peran belum teridentifikasi' && cleanedRole) {
    target.set(key, { name: cleanedName, role: cleanedRole })
    return
  }
  if (
    cleanedRole
    && genericRoles.has(existing.role.toLowerCase())
    && !genericRoles.has(cleanedRole.toLowerCase())
  ) {
    target.set(key, { name: cleanedName, role: cleanedRole })
  }
}

export function extractBrdStakeholdersFromDocumentText(text: string, maxItems = 40): BrdStakeholderEntry[] {
  const source = text.replace(/\r/g, '\n')
  if (!source.trim()) return []

  const byKey = new Map<string, BrdStakeholderEntry>()

  extractApprovalTableStakeholders(source, byKey, maxItems)

  const roleLineRegex = /^(PIC|Owner|Pemilik|Approver|Approval|Reviewer|Business Owner|Chief|Head|Director|Manager|Officer|Partner|Accountable|Responsible|Consulted|Informed|Penanggung\s*Jawab|Stakeholder|Process Owner|Product Owner|Key User|Dept\.?\s*Head|Div\.?\s*Head|IT Business Partner|Head Of)\s*[:\-]\s*(.+)$/gim
  for (const match of source.matchAll(roleLineRegex)) {
    const role = (match[1] ?? 'Stakeholder').trim()
    const tail = (match[2] ?? '').trim()
    tail.split(/[;,|]/).map((part) => part.trim()).forEach((name) => {
      if (name.length > 80) return
      pushStakeholder(byKey, name, role)
    })
  }

  for (const line of source.split('\n')) {
    const trimmed = line.trim().replace(/^[-*•]\s*/, '')
    if (!trimmed || /^(PIC|Owner|Approver|Reviewer|Business Owner|Stakeholder|Chief|Head)\s*[:\-]/i.test(trimmed)) continue

    const executiveDashMatch = trimmed.match(
      /^([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,4})\s*[—\-]\s*((?:Chief|Head|Director|Manager|Officer|Partner|Owner|PIC|President|Lead|VP|BRM|BRS|Architect|Analyst|Consultant|Supervisor|Coordinator).+)$/i,
    )
    if (executiveDashMatch?.[1] && executiveDashMatch[2]) {
      pushStakeholder(byKey, executiveDashMatch[1], executiveDashMatch[2])
      continue
    }

    const dashMatch = trimmed.match(/^([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,4})\s*[:\-—]\s*(.+)$/)
    if (dashMatch?.[1] && dashMatch[2] && looksLikeBrdRole(dashMatch[2])) {
      pushStakeholder(byKey, dashMatch[1], dashMatch[2])
      continue
    }

    const parenMatch = trimmed.match(/^([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,4})\s*\(([^)]+)\)\s*$/)
    if (parenMatch?.[1] && parenMatch[2] && looksLikeBrdRole(parenMatch[2])) {
      pushStakeholder(byKey, parenMatch[1], parenMatch[2])
    }
  }

  const honorificRegex = /\b(?:Bpk|Bapak|Ibu|Sdr|Saudara|Mr|Mrs|Ms|Dr|Prof)\.?\s+([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,4})/g
  for (const match of source.matchAll(honorificRegex)) {
    const name = match[1] ?? ''
    if (!looksLikeBrdPersonName(name)) continue
    const key = name.toLowerCase()
    if (!byKey.has(key)) {
      byKey.set(key, { name, role: 'Stakeholder teridentifikasi dari dokumen' })
    }
  }

  return filterVerifiedStakeholders(Array.from(byKey.values())).slice(0, maxItems)
}

const TOC_SUMMARY_PLACEHOLDER = /belum\s+(?:dapat\s+)?(?:diverifikasi|tersedia)|belum\s+ditemukan|perlu\s+klarifikasi|tidak\s+tersedia\s+di\s+kb/i

// Honest statement when a section/sub-section genuinely has no content in the BRD —
// no vague "belum dapat diverifikasi" hedge.
const TOC_NO_CONTENT_TEXT = 'Tidak ada konten untuk bagian ini di dalam BRD.'

// Unfilled BRD template/instruction boilerplate that must NOT be shown as real content
// (e.g. "Tambahkan nama MI/SOP ...", "Tuliskan N/A jika dalam project ini tidak terdapat...",
// leaked approval capture instructions). A concise "N/A dalam dokumen ini" is NOT matched.
const TOC_TEMPLATE_NOISE_RE = /tuliskan\s+n\/?a|jika\s+(?:dalam\s+)?(?:project|proyek)\s+ini\s+tidak\s+terdapat|tidak\s+terdapat\s+hal\s+yang\s+dimaksud|lampirkan\s+capture|capture\s+approval|sign\s*-?\s*off\s+user|^\s*(?:tambahkan|tuliskan|lampirkan|cantumkan|masukkan|sebutkan|isikan)\b/i

/** A resolved summary is usable only if it is real content — not a hedge or unfilled template text. */
function isUsableTocSummary(text: string | null | undefined): text is string {
  if (!text) return false
  if (TOC_SUMMARY_PLACEHOLDER.test(text)) return false
  if (TOC_TEMPLATE_NOISE_RE.test(text)) return false
  return true
}
// Parent = concise high-level overview of its sub-sections; sub = its own important detail.
const PARENT_SUMMARY_MAX_CHARS = 240
const SUB_SUMMARY_MAX_CHARS = 420

/** Join names readably in Indonesian: "A", "A dan B", "A, B, dan C". */
function joinReadableList(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} dan ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, dan ${items[items.length - 1]}`
}

/**
 * Remove an inline sub-section enumeration ("Sub Name — description; ...") from a parent
 * summary so it does not duplicate the sub-section list. Cuts at the first point where a
 * sub-section NAME is immediately followed by a dash separator (the enumeration pattern),
 * while preserving a natural intro that merely mentions the topics in prose.
 */
function stripSubEnumeration(text: string, subNames: string[]): string {
  if (!subNames.length) return text
  let cutIndex = text.length
  for (const sub of subNames) {
    const variants = [sub, sub.split('/')[0]?.trim() ?? ''].filter((value) => value.length >= 4)
    for (const needle of variants) {
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const match = new RegExp(`${escaped}\\s*[—–-]\\s`, 'i').exec(text)
      if (match && match.index < cutIndex) cutIndex = match.index
    }
  }
  if (cutIndex >= text.length) return text
  const trimmed = text.slice(0, cutIndex).replace(/[\s,;:—–-]+$/, '').trim()
  return trimmed.length >= 20 ? trimmed : text
}

type TocOutlineNode = { title: string; subs: string[] }

/**
 * Group flat TOC entries into a parent→children outline.
 * Entries with ' > ' (e.g. "Overview > Latar Belakang/Background") are nested
 * under their parent. Parents are created on demand to preserve order.
 */
function buildTocOutline(entries: string[]): TocOutlineNode[] {
  const nodes: TocOutlineNode[] = []
  const mainIndex = new Map<string, number>()
  const seenSub = new Set<string>()

  const ensureMain = (title: string): number => {
    const key = title.toLowerCase()
    const existing = mainIndex.get(key)
    if (existing !== undefined) return existing
    const idx = nodes.length
    mainIndex.set(key, idx)
    nodes.push({ title, subs: [] })
    return idx
  }

  for (const rawEntry of entries) {
    const cleaned = normalizeHeadingLabel(rawEntry)
    if (cleaned.length < 2) continue
    const sep = cleaned.indexOf(' > ')
    if (sep === -1) {
      ensureMain(cleaned)
      continue
    }
    const parent = cleaned.slice(0, sep).trim()
    const sub = cleaned.slice(sep + 3).trim()
    if (!parent || !sub) continue
    const idx = ensureMain(parent)
    const subKey = `${parent.toLowerCase()}||${sub.toLowerCase()}`
    if (seenSub.has(subKey)) continue
    seenSub.add(subKey)
    nodes[idx].subs.push(sub)
  }
  return nodes
}

function buildTocSummarySectionBody(
  entries: string[],
  existingSummaries: Map<string, string>,
  bodySummaries: Map<string, string> = new Map(),
): string {
  if (entries.length === 0) {
    return '<p>Daftar isi BRD tidak terdeteksi dari cuplikan dokumen. Buka dokumen resmi di Document Repository untuk detail lengkap.</p>'
  }

  const outline = buildTocOutline(entries)
  const blocks = outline.map((node) => {
    const subNames = node.subs
    // Parent paragraph: concise, high-level (1–2 sentences). Drop any inline sub enumeration
    // so it does not duplicate the sub-section list below.
    const rawParent = resolveTocSummary(node.title, existingSummaries, bodySummaries)
    let parentSummary: string
    if (rawParent) {
      parentSummary = firstSentences(stripSubEnumeration(rawParent, subNames), PARENT_SUMMARY_MAX_CHARS)
    } else if (subNames.length > 0) {
      // No own intro text → synthesize a real high-level summary from the sub-section names.
      parentSummary = `Bagian ini mencakup ${joinReadableList(subNames)}.`
    } else {
      parentSummary = TOC_NO_CONTENT_TEXT
    }
    let html = `<h3>${escapeHtml(node.title)}</h3><p>${escapeHtml(parentSummary)}</p>`
    if (subNames.length > 0) {
      const items = subNames.map((sub) => {
        // Sub-section: its own important content from the BRD. If the BRD has no content for it,
        // state so honestly (consistent with empty top-level sections), not vague filler.
        const rawSub = resolveTocSummary(sub, existingSummaries, bodySummaries)
        const subSummary = rawSub ? firstSentences(rawSub, SUB_SUMMARY_MAX_CHARS) : TOC_NO_CONTENT_TEXT
        return `<li><strong>${escapeHtml(sub)}</strong> — ${escapeHtml(subSummary)}</li>`
      })
      html += `<ul>${items.join('')}</ul>`
    }
    return html
  })
  return blocks.join('')
}

function buildAffectedAppsFallbackHtml(sectionTitle: string, applications: BrdAffectedApplication[]): string {
  if (applications.length === 0) {
    return [
      `<h2>${escapeHtml(sectionTitle)}</h2>`,
      '<p>Tidak ada aplikasi terdampak yang dapat diverifikasi dari cuplikan dokumen.</p>',
    ].join('')
  }
  const items = applications.map(
    (app) => `<li><strong>${escapeHtml(app.name)}</strong>${app.impact ? ` — ${escapeHtml(app.impact)}` : ''}</li>`,
  )
  return [`<h2>${escapeHtml(sectionTitle)}</h2>`, `<ul>${items.join('')}</ul>`].join('')
}

function buildStakeholdersListHtml(stakeholders: BrdStakeholderEntry[]): string {
  const items = stakeholders.map(
    (person) => `<li><strong>${escapeHtml(person.name)}</strong> — ${escapeHtml(person.role)}</li>`,
  )
  return `<ul>${items.join('')}</ul>`
}

function buildStakeholdersFallbackHtml(sectionTitle: string, stakeholders: BrdStakeholderEntry[]): string {
  if (stakeholders.length === 0) {
    return [
      `<h2>${escapeHtml(sectionTitle)}</h2>`,
      '<p>Tidak ada stakeholder yang dapat diverifikasi dari cuplikan dokumen.</p>',
    ].join('')
  }
  return [`<h2>${escapeHtml(sectionTitle)}</h2>`, buildStakeholdersListHtml(stakeholders)].join('')
}

const STAKEHOLDER_SECTION_ALIASES = [
  'Daftar Orang Terkait dan Peran',
  'Daftar Orang Terkait',
  'Stakeholder',
  'Stakeholders',
]

function extractH2SectionBody(contentHtml: string, sectionTitle: string): string {
  const escaped = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const sectionRegex = new RegExp(`<h2[^>]*>\\s*${escaped}\\s*<\\/h2>([\\s\\S]*?)(?=<h2|$)`, 'i')
  return sectionRegex.exec(contentHtml)?.[1] ?? ''
}

function normalizeTocHeadingKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/^(?:[ivxlcdm]+\.|[0-9]+(?:\.[0-9]+)*\.?)\s+/, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function findExistingTocSummary(existingSummaries: Map<string, string>, entry: string): string | null {
  const entryKey = normalizeTocHeadingKey(entry)
  if (existingSummaries.has(entryKey)) return existingSummaries.get(entryKey) ?? null

  for (const [title, summary] of existingSummaries) {
    const titleKey = normalizeTocHeadingKey(title)
    if (!titleKey || !entryKey) continue
    if (titleKey === entryKey || titleKey.includes(entryKey) || entryKey.includes(titleKey)) {
      return summary
    }
  }
  return null
}

/** First 1–2 sentences of a text block, capped to maxChars with a clean cut. */
function firstSentences(text: string, maxChars = 280): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxChars) return clean
  const slice = clean.slice(0, maxChars)
  const lastStop = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('? '), slice.lastIndexOf('! '))
  if (lastStop > 80) return slice.slice(0, lastStop + 1).trim()
  return `${slice.replace(/\s+\S*$/, '').trim()}…`
}

/**
 * Deterministic per-section summary from the document BODY: for each known heading,
 * collect the paragraph text that follows it (until the next heading) and use its
 * first sentences. Gives real summaries per section AND sub-section, independent of
 * whether the LLM produced them. Keyed by normalizeTocHeadingKey for direct lookup.
 */
function extractSectionSummariesFromDocumentBody(
  documentText: string,
  headingTitles: string[],
): Map<string, string> {
  const map = new Map<string, string>()
  if (!documentText || headingTitles.length === 0) return map

  const docxBodyMarker = '--- DOCX BODY ---'
  let bodyIdx = documentText.indexOf(docxBodyMarker)
  let bodyMarkerLen = docxBodyMarker.length
  if (bodyIdx === -1) {
    bodyIdx = documentText.indexOf(DOC_BODY_MARKER)
    bodyMarkerLen = DOC_BODY_MARKER.length
  }

  let body = ''
  if (bodyIdx !== -1) {
    body = documentText.slice(bodyIdx + bodyMarkerLen)
  } else if (documentText.indexOf(DOCX_HEADINGS_MARKER) !== -1) {
    // Headings block present but no body section → no reliable body content.
    body = ''
  } else {
    body = documentText
  }
  body = stripBrdPageArtifacts(body)
  if (!body.trim()) return map
  const lines = body.split('\n').map((line) => line.trim()).filter(Boolean)

  const headingKeys = new Set<string>()
  for (const title of headingTitles) {
    const key = normalizeTocHeadingKey(title)
    if (key) headingKeys.add(key)
  }

  const lineHeadingKeys = (line: string): string[] => {
    const normalized = normalizeHeadingLabel(line)
    const keys = [normalizeTocHeadingKey(normalized)]
    const stripped = normalized.replace(/^(?:[ivxlcdm]+\.|[0-9]+(?:\.[0-9]+)*\.?|[a-z]\.)\s+/i, '')
    if (stripped) keys.push(normalizeTocHeadingKey(stripped))
    return keys.filter(Boolean)
  }

  const matchHeading = (line: string): string | null => {
    const normalized = normalizeHeadingLabel(line)
    if (normalized.length > 120) return null
    if (!/^(?:[IVXLCDMivxlcdm]+\.|[0-9]+(?:\.[0-9]+)*\.?|[A-Za-z]\.)\s+/.test(line) && normalized.split(/\s+/).length > 12) {
      return null
    }
    const lineKeys = lineHeadingKeys(line)
    for (const key of lineKeys) {
      if (headingKeys.has(key)) return key
    }
    for (const headingKey of headingKeys) {
      for (const lineKey of lineKeys) {
        if (headingKey === lineKey) return headingKey
        if (lineKey.length >= 8 && (headingKey.includes(lineKey) || lineKey.includes(headingKey))) return headingKey
      }
    }
    return null
  }

  let currentKey: string | null = null
  let buffer: string[] = []
  const flush = () => {
    if (currentKey && buffer.length > 0 && !map.has(currentKey)) {
      const text = firstSentences(stripBrdPageArtifacts(buffer.join(' ')), 600)
      if (text.length >= 12) map.set(currentKey, text)
    }
    buffer = []
  }

  for (const line of lines) {
    const matched = matchHeading(line)
    if (matched) {
      flush()
      currentKey = matched
      continue
    }
    if (currentKey && buffer.join(' ').length < 900) buffer.push(line)
  }
  flush()
  return map
}

/** TOC heading titles (main + sub leaf names) from flat entries, for body summary matching. */
function collectTocHeadingTitles(entries: string[]): string[] {
  const titles: string[] = []
  for (const entry of entries) {
    const cleaned = normalizeHeadingLabel(entry)
    const sep = cleaned.indexOf(' > ')
    if (sep === -1) {
      titles.push(cleaned)
    } else {
      titles.push(cleaned.slice(0, sep).trim(), cleaned.slice(sep + 3).trim())
    }
  }
  return titles
}

/**
 * Resolve a section/sub summary. Document BODY is preferred because it is the authoritative
 * BRD content: the parent heading's intro paragraph (a clean high-level summary, no sub
 * enumeration) and each sub-section's own specific content. The LLM summary is fallback only —
 * its parent paragraphs tend to enumerate sub-sections, which duplicates the sub list.
 */
function resolveTocSummary(
  title: string,
  _llmSummaries: Map<string, string>,
  bodySummaries: Map<string, string>,
): string | null {
  // Body-only: never fall back to LLM-generated text. If the BRD itself has no content for a
  // section we say so honestly rather than show plausible filler the LLM may have invented.
  // (_llmSummaries kept in the signature for call-site compatibility but intentionally ignored.)
  const fromBody = findExistingTocSummary(bodySummaries, title)
  return isUsableTocSummary(fromBody) ? fromBody : null
}

function parseStakeholdersFromHtml(contentHtml: string): BrdStakeholderEntry[] {
  const entries: BrdStakeholderEntry[] = []
  const liRegex = /<li[^>]*>\s*<strong>([^<]+)<\/strong>\s*(?:[—\-]|&mdash;)\s*([^<]+)\s*<\/li>/gi
  for (const match of contentHtml.matchAll(liRegex)) {
    const name = stripHtmlToPlainText(match[1] ?? '')
    const role = normalizeStakeholderRole(stripHtmlToPlainText(match[2] ?? ''))
    if (!name || !role || isJunkStakeholderRole(role)) continue
    entries.push({ name, role })
  }
  return entries
}

function looksLikeStakeholderListHtml(fragment: string): boolean {
  const items = [...fragment.matchAll(/<li[^>]*>\s*<strong>[^<]+<\/strong>/gi)]
  return items.length >= 2
}

function removeLeadingOrphanStakeholderLists(contentHtml: string): string {
  let result = contentHtml.trim()
  const leadingBlockRegex = /^((?:\s*<p>[\s\S]*?<\/p>)*)\s*(<ul>[\s\S]*?<\/ul>)/i

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const match = leadingBlockRegex.exec(result)
    if (!match?.[2] || !looksLikeStakeholderListHtml(match[2])) break
    result = `${match[1] ?? ''}${result.slice(match[0].length)}`.trim()
  }

  return result
}

function buildGenericSectionFallbackHtml(sectionTitle: string): string {
  return `<h2>${escapeHtml(sectionTitle)}</h2><p>Section ini belum dapat dilengkapi otomatis dari cuplikan dokumen.</p>`
}

/**
 * Build a CANONICAL KB body containing ONLY the standard's required sections, in order.
 * Mirrors the backend `build_required_sections_html` exactly: stray LLM-generated sections are
 * dropped (no duplicate headings), summaries are body-only, empty sections say so honestly.
 * This is the FALLBACK used only when the server did not assemble the sections itself.
 */
export function ensureBrdKbStandardContent(
  contentHtml: string,
  documentText: string,
  standard: BrdToKbContentStandardParsed,
  precomputedStakeholders?: BrdStakeholderEntry[],
): string {
  if (standard.requiredSections.length === 0) return contentHtml

  const tocEntries = extractBrdTableOfContentsEntries(documentText)
  const applications = extractAffectedApplicationsFromDocumentText(documentText)
  const detectedStakeholders = sanitizeDetectedStakeholdersForRuntimeApi(
    precomputedStakeholders ?? extractBrdStakeholdersFromDocumentText(documentText),
  )
  const bodySummaries = extractSectionSummariesFromDocumentBody(
    documentText,
    collectTocHeadingTitles(tocEntries),
  )

  const parts: string[] = []
  for (const section of standard.requiredSections) {
    switch (section.kind) {
      case 'toc_summary':
        parts.push(`<h2>${escapeHtml(section.title)}</h2>${buildTocSummarySectionBody(tocEntries, new Map(), bodySummaries)}`)
        break
      case 'affected_apps':
        parts.push(buildAffectedAppsFallbackHtml(section.title, applications))
        break
      case 'stakeholders': {
        const fromAliases = STAKEHOLDER_SECTION_ALIASES.flatMap(
          (alias) => parseStakeholdersFromHtml(extractH2SectionBody(contentHtml, alias)),
        )
        const merged = dedupeStakeholderEntries(
          sanitizeDetectedStakeholdersForRuntimeApi([...detectedStakeholders, ...fromAliases]),
        )
        parts.push(buildStakeholdersFallbackHtml(section.title, merged))
        break
      }
      default:
        parts.push(buildGenericSectionFallbackHtml(section.title))
        break
    }
  }

  return parts.join('')
}

// Client-side port of the backend's `sanitize_kb_content_noise` (repository_kb_toc_assembler.py).
// This is the same fallback assembly used when the server-side one fails/is skipped (e.g. the
// backend couldn't reach the KB standard entry), so the two classes of BRD-template noise it
// guards against — Table-of-Contents lines leaking into a section's body ("II. User Requirements
// 7", or several concatenated: "III. MI/SOP 8 IV. BCP 9 V. Approval 10") and unfilled form/dropdown
// instruction text ("Pilih salah satu atau lebih kategori di bawah: ...") — must be stripped here
// too, independent of whether the backend ever ran its own copy.
const TOC_LEAK_RE = /^(?:[IVXLCDM]+\.\s+[A-Za-z][\w/&,()-]*(?:\s+[A-Za-z][\w/&,()-]*){0,8}\s+\d{1,3}\s*)+$/
const UNFILLED_FORM_INSTRUCTION_RE = /pilih\s+salah\s+satu(?:\s+atau\s+lebih)?\s+(?:kategori|opsi|pilihan)|choose\s+one\s+or\s+more|select\s+one\s+or\s+more/i

function looksLikeTocLeakage(text: string): boolean {
  const stripped = text.trim()
  if (!stripped || !/^[IVXLCDM]+\.\s/.test(stripped)) return false
  return TOC_LEAK_RE.test(stripped)
}

function sanitizeKbContentNoise(html: string): string {
  return html.replace(/(<(?:p|li)[^>]*>)([\s\S]*?)(<\/(?:p|li)>)/gi, (match, openTag, inner, closeTag) => {
    const plain = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (looksLikeTocLeakage(plain) || UNFILLED_FORM_INSTRUCTION_RE.test(plain)) return ''
    const cleanedInner = inner.includes('**') ? inner.replace(/\*\*/g, '') : inner
    return `${openTag}${cleanedInner}${closeTag}`
  })
}

/** Bersihkan artefak generate KB: blok stakeholder sampah dari ekstraksi agresif. */
export function scrubKbGeneratedContent(contentHtml: string): string {
  let result = contentHtml
  result = result.replace(BRD_INLINE_FOOTER_RE, ' ')
  result = result.replace(/<h3>\s*Stakeholder tambahan \(ekstraksi dokumen\)\s*<\/h3>\s*<ul>[\s\S]*?<\/ul>/gi, '')
  result = result.replace(/<li>\s*<strong>[^<]+<\/strong>\s*[—-]\s*Peran belum teridentifikasi\s*<\/li>/gi, '')
  result = result.replace(/<li>\s*<strong>[^<]+<\/strong>\s*[—-]\s*Ok+Key[^<]*<\/li>/gi, '')
  result = sanitizeKbContentNoise(result)
  return removeLeadingOrphanStakeholderLists(result)
}

export function buildBrdKbDetectedContextPromptBlock(params: {
  tocEntries: string[]
  applications: BrdAffectedApplication[]
  stakeholders: BrdStakeholderEntry[]
}): string {
  const lines = ['Deteksi struktur dari dokumen BRD (gunakan sebagai acuan wajib):']
  lines.push(
    params.tocEntries.length > 0
      ? `Daftar isi terdeteksi (${params.tocEntries.length} poin): ${params.tocEntries.join(' | ')}`
      : 'Daftar isi terdeteksi: (tidak ditemukan — infer dari heading dokumen jika ada)',
  )
  lines.push(
    params.applications.length > 0
      ? `Aplikasi terdampak terdeteksi: ${params.applications.map((item) => item.name).join(', ')}`
      : 'Aplikasi terdampak terdeteksi: (tidak ditemukan — sebutkan eksplisit jika tidak ada bukti di cuplikan)',
  )
  lines.push(
    params.stakeholders.length > 0
      ? `Stakeholder terverifikasi: ${filterVerifiedStakeholders(params.stakeholders).map((item) => `${item.name} (${item.role})`).join('; ')}`
      : 'Stakeholder terverifikasi: (tidak ditemukan — tulis pernyataan keterbatasan di section stakeholder; jangan masukkan label form/template BRD sebagai nama orang)',
  )
  return lines.join('\n')
}

function canExtractPlainTextFile(file: File): boolean {
  const contentType = (file.type || '').toLowerCase()
  if (contentType.startsWith('text/')) return true
  if (contentType.includes('json') || contentType.includes('xml')) return true
  if (contentType.includes('yaml') || contentType.includes('csv')) return true
  if (contentType.includes('javascript') || contentType.includes('typescript')) return true
  if (contentType.includes('markdown')) return true
  const lowerName = file.name.toLowerCase()
  return ['.txt', '.md', '.json', '.xml', '.yml', '.yaml', '.csv', '.log'].some((ext) => lowerName.endsWith(ext))
}

function preserveStructureExtractedText(value: string, maxChars: number): string {
  const compact = value
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!compact) return ''
  if (compact.startsWith('PK\u0003\u0004') || compact.includes('[Content_Types].xml')) return ''

  const flat = compact.replace(/\n/g, ' ')
  const totalLength = flat.length
  const replacementCharCount = (flat.match(/\uFFFD/g) ?? []).length
  const noisyCharCount = (flat.match(/[^A-Za-z0-9\s.,;:!?"'()\-_/\\[\]{}@#%&*+=<>|]/g) ?? []).length
  if (totalLength > 0 && (replacementCharCount / totalLength) > 0.02) return ''
  if (totalLength > 120 && (noisyCharCount / totalLength) > 0.45) return ''
  return compact.slice(0, maxChars)
}

function normalizeExtractedText(value: string, maxChars: number): string {
  const compact = value
    .replace(/\u0000/g, ' ')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!compact) return ''
  if (compact.startsWith('PK\u0003\u0004') || compact.includes('[Content_Types].xml')) return ''
  const totalLength = compact.length
  const replacementCharCount = (compact.match(/\uFFFD/g) ?? []).length
  const noisyCharCount = (compact.match(/[^A-Za-z0-9\s.,;:!?"'()\-_/\\[\]{}@#%&*+=<>|]/g) ?? []).length
  if ((replacementCharCount / totalLength) > 0.02) return ''
  if (totalLength > 120 && (noisyCharCount / totalLength) > 0.45) return ''
  return compact.slice(0, maxChars)
}

function stripHtmlCellToPlain(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>\s*<p[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeXmlTextEntity(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function isApprovalTableHeaderCell(value: string): boolean {
  return /^(?:area|jabatan|posisi|peran|role|bagian|name|nama|comments?|signature|date|no|#|approval|ok)$/i.test(value.trim())
}

function findApprovalTableColumnIndices(cells: string[]): { roleIdx: number; nameIdx: number } | null {
  const normalized = cells.map((cell) => cell.trim().toLowerCase())
  const roleIdx = normalized.findIndex((cell) => /^(?:area|jabatan|posisi|peran|role|bagian)$/i.test(cell))
  const nameIdx = normalized.findIndex((cell) => /^(?:name|nama)$/i.test(cell))
  if (roleIdx >= 0 && nameIdx >= 0 && roleIdx !== nameIdx) {
    return { roleIdx, nameIdx }
  }
  return null
}

/** Pilih pasangan role+nama dari sel tabel (dukung kolom No di depan). */
export function pickRoleNameFromTableCells(cells: string[]): { role: string; name: string } | null {
  const cleaned = cells.map((cell) => cell.trim()).filter(Boolean)
  if (cleaned.length < 2) return null
  if (cleaned.every((cell) => isApprovalTableHeaderCell(cell))) return null

  const headerIndices = findApprovalTableColumnIndices(cleaned)
  if (headerIndices) return null

  const dataCells = cleaned.filter((cell) => !/^(?:OK|\-+|\.+)$/i.test(cell))
  if (dataCells.length < 2) return null

  let start = 0
  if (/^\d{1,3}$/.test(dataCells[0] ?? '')) start = 1
  const slice = dataCells.slice(start)

  for (let index = 0; index < slice.length - 1; index += 1) {
    const role = slice[index] ?? ''
    const name = slice[index + 1] ?? ''
    if (looksLikeBrdRole(role) && looksLikeApprovalPersonName(name)) {
      return { role, name }
    }
  }

  const first = slice[0] ?? ''
  const last = slice[slice.length - 1] ?? ''
  if (slice.length >= 3 && looksLikeBrdRole(first) && looksLikeApprovalPersonName(last)) {
    return { role: first, name: last }
  }

  const inline = splitApprovalRoleAndName(slice.join(' '))
  if (inline) return { role: inline.role, name: inline.name }

  return null
}

function appendApprovalTableRowLines(lines: string[], cells: string[]) {
  const picked = pickRoleNameFromTableCells(cells)
  if (!picked) return
  lines.push(`${picked.role}\t${picked.name}`)
  lines.push(picked.role)
  lines.push(picked.name)
}

/** Ekstrak baris tabel docx (Area/Name) dari HTML mammoth menjadi TSV + baris vertikal. */
export function extractDocxTableStakeholderLines(html: string): string {
  if (!html.trim()) return ''

  const lines: string[] = []
  let headerRoleIdx = -1
  let headerNameIdx = -1
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi

  for (const rowMatch of html.matchAll(rowRegex)) {
    const rowHtml = rowMatch[1] ?? ''
    const cells: string[] = []
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi

    for (const cellMatch of rowHtml.matchAll(cellRegex)) {
      const plain = stripHtmlCellToPlain(cellMatch[1] ?? '')
      if (plain) cells.push(plain)
    }

    if (cells.length < 2) continue

    const headerIndices = findApprovalTableColumnIndices(cells)
    if (headerIndices) {
      headerRoleIdx = headerIndices.roleIdx
      headerNameIdx = headerIndices.nameIdx
      continue
    }

    if (headerRoleIdx >= 0 && headerNameIdx >= 0) {
      const role = cells[headerRoleIdx] ?? ''
      const name = cells[headerNameIdx] ?? ''
      if (role && name && !isApprovalTableHeaderCell(role) && !isApprovalTableHeaderCell(name)) {
        if (looksLikeBrdRole(role) && looksLikeApprovalPersonName(name)) {
          lines.push(`${role}\t${name}`)
          lines.push(role)
          lines.push(name)
        }
      }
      continue
    }

    appendApprovalTableRowLines(lines, cells)
  }

  return lines.join('\n')
}

function extractTableLinesFromWordXml(xml: string): string {
  const lines: string[] = []
  const rowRegex = /<w:tr[\s\S]*?<\/w:tr>/gi

  for (const rowMatch of xml.matchAll(rowRegex)) {
    const rowXml = rowMatch[0] ?? ''
    const cells: string[] = []
    const cellRegex = /<w:tc[\s\S]*?<\/w:tc>/gi

    for (const cellMatch of rowXml.matchAll(cellRegex)) {
      const cellXml = cellMatch[0] ?? ''
      const textParts: string[] = []
      const textRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gi
      for (const textMatch of cellXml.matchAll(textRegex)) {
        const plain = decodeXmlTextEntity(textMatch[1] ?? '').replace(/\s+/g, ' ').trim()
        if (plain) textParts.push(plain)
      }
      const cellText = textParts.join(' ').replace(/\s+/g, ' ').trim()
      if (cellText) cells.push(cellText)
    }

    if (cells.length < 2) continue
    appendApprovalTableRowLines(lines, cells)
  }

  return lines.join('\n')
}

/** Ekstrak tabel dari XML docx (body + header/footer) — lebih andal untuk APPROVAL sign-off. */
export async function extractDocxXmlTableLines(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(arrayBuffer)
    const xmlPaths = Object.keys(zip.files).filter((path) =>
      /^word\/(?:document|header\d+|footer\d+)\.xml$/i.test(path),
    )
    const chunks: string[] = []
    for (const path of xmlPaths.sort()) {
      const xml = await zip.file(path)?.async('string')
      if (!xml) continue
      const tableLines = extractTableLinesFromWordXml(xml)
      if (tableLines) chunks.push(tableLines)
    }
    return chunks.join('\n')
  } catch {
    return ''
  }
}

function scanAlternatingRoleNamePairs(
  lines: string[],
  target: Map<string, BrdStakeholderEntry>,
  maxItems: number,
) {
  let pendingRole: string | null = null

  for (const rawLine of lines) {
    if (target.size >= maxItems) return

    const line = rawLine.trim().replace(/\s+OK\s*$/i, '').trim()
    if (!line || isApprovalTableHeaderCell(line)) continue
    if (/^APPROVAL\b/i.test(line)) continue

    const inline = parseApprovalTableRow(line)
    if (inline) {
      pendingRole = null
      pushApprovalStakeholder(target, inline.name, inline.role)
      continue
    }

    if (looksLikeApprovalPersonName(line)) {
      if (pendingRole && looksLikeBrdRole(pendingRole)) {
        pushApprovalStakeholder(target, line, pendingRole)
        pendingRole = null
      }
      continue
    }

    if (looksLikeBrdRole(line) && !looksLikeApprovalPersonName(line)) {
      pendingRole = line
      continue
    }

    pendingRole = null
  }
}

export const DOCX_HEADINGS_MARKER = '--- DOCX HEADINGS ---'
export const DOC_BODY_MARKER = '--- DOC BODY ---'

const BRD_INLINE_FOOTER_RE = /BRD\s*#?:?\s*[\d/\-A-Za-zX]+.*?(?:Business Requirement Document\s*)?Page\s+\d+\s+of\s+\d+.*?(?:Date:?\s*[\d-]+)?.*?(?:Version:?\s*[\d.]+)?/gi
const BRD_HEADER_LINE_RE = /^(?:BRD\s*#|Business Requirement Document|Priority\s*:|Page\s+\d+\s+of\s+\d+|Date\s*:|Version\s*:|P2D\s+Fase).*$/i

export function stripBrdPageArtifacts(text: string): string {
  if (!text.trim()) return ''
  let cleaned = text.replace(BRD_INLINE_FOOTER_RE, ' ')
  const lines = cleaned.replace(/\r/g, '\n').split('\n').map((line) => {
    const trimmed = line.trim()
    if (!trimmed) return ''
    if (BRD_HEADER_LINE_RE.test(trimmed)) return ''
    return trimmed.replace(BRD_INLINE_FOOTER_RE, ' ').trim()
  })
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// Headings that are document-control boilerplate, not BRD content sections.
const DOCX_OUTLINE_BOILERPLATE = /^(?:revision\s+history|approval|persetujuan|table\s+of\s+contents|daftar\s+isi|copyright|document\s+control|sign\s*-?\s*off|distribution\s+list|glossary|glosarium|references?|referensi|appendix|lampiran)\b/i

/**
 * Build a hierarchical section outline from mammoth's HTML (which preserves Word
 * heading levels h1–h4). Word auto-numbering (I., A., B.) is NOT part of the text,
 * so heading LEVEL — not numbering prefixes — is the reliable structure signal.
 * Returns entries like ["Overview", "Overview > Latar Belakang/Background", ...].
 */
export function extractDocxHeadingOutline(html: string, maxItems = 40): string[] {
  if (!html) return []
  const headings: Array<{ level: number; title: string }> = []
  const regex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi
  for (const match of html.matchAll(regex)) {
    const level = Number(match[1])
    const title = normalizeHeadingLabel(stripHtmlToPlainText(match[2] ?? ''))
    if (!title || title.length < 2 || title.length > 140) continue
    if (DOCX_OUTLINE_BOILERPLATE.test(title)) continue
    headings.push({ level, title })
  }
  if (headings.length === 0) return []

  // Pick the "main section" level: the shallowest level that has at least 2 headings.
  // A single shallowest heading is usually the document title, which we then skip.
  const levelCounts = new Map<number, number>()
  for (const h of headings) levelCounts.set(h.level, (levelCounts.get(h.level) ?? 0) + 1)
  const sortedLevels = [...levelCounts.keys()].sort((a, b) => a - b)
  const mainLevel = sortedLevels.find((lvl) => (levelCounts.get(lvl) ?? 0) >= 2) ?? sortedLevels[0]

  const entries: string[] = []
  const seen = new Set<string>()
  let currentMain: string | null = null

  const push = (value: string) => {
    const key = value.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    entries.push(value)
  }

  for (const { level, title } of headings) {
    if (entries.length >= maxItems) break
    if (level < mainLevel) continue // document title / super-section above main — skip
    if (level === mainLevel) {
      currentMain = title
      push(title)
    } else if (currentMain) {
      push(`${currentMain} > ${title}`)
    } else {
      currentMain = title
      push(title)
    }
  }
  return entries
}

async function extractDocxText(file: File, maxChars: number): Promise<string> {
  // Prefer server-side parsing (python-docx / legacy .doc via Gotenberg) so parsing lives in one place.
  // Any failure (endpoint down, parse error, empty result) falls back to client-side mammoth for .docx.
  try {
    const remote = await extractRepositoryDocxStructure(file, isLegacyWordDoc(file) ? 180_000 : 60_000)
    if (remote?.text && remote.text.trim()) return remote.text.slice(0, maxChars)
  } catch {
    /* fall back to client-side mammoth extraction below (.docx only) */
  }

  if (isLegacyWordDoc(file)) {
    return ''
  }

  try {
    const mammoth = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    const [rawResult, htmlResult, xmlTableLines] = await Promise.all([
      mammoth.extractRawText({ arrayBuffer }),
      mammoth.convertToHtml({ arrayBuffer }),
      extractDocxXmlTableLines(arrayBuffer),
    ])
    const raw = (rawResult.value ?? '').trim()
    const html = htmlResult.value ?? ''
    const htmlTableLines = extractDocxTableStakeholderLines(html)
    const tableLines = [xmlTableLines, htmlTableLines].filter(Boolean).join('\n')
    // Heading outline from HTML — most reliable section structure (numbering-independent).
    const headingOutline = extractDocxHeadingOutline(html)
    const sections = [
      headingOutline.length > 0 ? `${DOCX_HEADINGS_MARKER}\n${headingOutline.join('\n')}` : '',
      tableLines ? `--- DOCX TABLE EXTRACT ---\n${tableLines}` : '',
      raw ? `--- DOCX BODY ---\n${raw}` : '',
    ].filter(Boolean)
    const combined = sections.join('\n\n')
    return combined ? combined.slice(0, maxChars) : ''
  } catch {
    return ''
  }
}

export async function fetchRepositoryDocumentAttachmentFile(
  documentId: string,
  options?: {
    projectId?: string | null
    attachmentId?: string | null
    fileNameHint?: string | null
  },
): Promise<File | null> {
  try {
    const downloaded = await resolveLatestDocumentAttachmentBlob(documentId, options)
    return new File([downloaded.blob], downloaded.fileName, { type: downloaded.contentType })
  } catch {
    return null
  }
}

export async function resolveRepositoryDocumentFileForKb(
  documentId: string,
  localFile?: File | null,
): Promise<File | null> {
  if (localFile) return localFile
  if (!documentId) return null
  return fetchRepositoryDocumentAttachmentFile(documentId)
}

async function extractPdfText(file: File, maxChars: number): Promise<string> {
  try {
    const remote = await extractRepositoryPdfText(file, 120_000)
    if (remote?.text?.trim()) return remote.text.slice(0, maxChars)
  } catch {
    /* fall through to document-parser */
  }
  return ''
}

export async function extractRepositoryDocumentText(
  file: File,
  maxChars = KB_REPOSITORY_EXTRACT_MAX_CHARS,
): Promise<RepositoryDocumentExtractResult> {
  const lowerName = file.name.toLowerCase()
  const isDocx =
    lowerName.endsWith('.docx')
    || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  const isDoc = isLegacyWordDoc(file)
  const isPdf = isPdfFile(file)
  let method: RepositoryExtractMethod = 'none'
  let raw = ''

  if (isPdf) {
    raw = await extractPdfText(file, maxChars)
    if (raw) method = 'pdf'
  }

  if (!raw && (isDocx || isDoc)) {
    raw = await extractDocxText(file, maxChars)
    if (raw) {
      method = isDoc ? 'doc' : 'docx'
      const stakeholderCount = extractBrdStakeholdersFromDocumentText(raw).length
      if (stakeholderCount < 2 && isDocx) {
        try {
          const parsed = await extractDocumentTextPreview(file, Math.min(maxChars, 48_000))
          const supplement = preserveStructureExtractedText(parsed.text || '', maxChars)
          if (supplement) {
            raw = `${raw}\n\n--- PARSER SUPPLEMENT ---\n${supplement}`.slice(0, maxChars)
          }
        } catch {
          /* optional parser supplement */
        }
      }
    }
  }

  if (!raw && isSpreadsheetFile(file)) {
    try {
      raw = await extractSpreadsheetText(file, maxChars)
      if (raw) method = 'xlsx'
    } catch {
      raw = ''
    }
  }

  if (!raw && file.size > 0 && file.size <= MAX_READABLE_BYTES && canExtractPlainTextFile(file)) {
    try {
      const plain = normalizeExtractedText(await file.text(), maxChars)
      if (plain) {
        raw = plain
        method = 'plain'
      }
    } catch {
      /* parser fallback */
    }
  }

  if (!raw) {
    try {
      const parsed = await extractDocumentTextPreview(file, Math.min(maxChars, 48_000))
      const plain = normalizeExtractedText(parsed.text || '', maxChars)
      if (plain) {
        raw = plain
        method = 'parser'
      }
    } catch {
      /* no extraction */
    }
  }

  const normalized = preserveStructureExtractedText(raw, maxChars)
  return {
    text: normalized,
    fullCharCount: normalized.length,
    truncated: normalized.length >= maxChars,
    method,
  }
}

export function buildRepositoryKbLlmExcerpt(fullText: string, maxChars = KB_REPOSITORY_LLM_EXCERPT_MAX_CHARS) {
  const trimmed = fullText.trim()
  if (!trimmed) return { excerpt: '', truncated: false }
  if (trimmed.length <= maxChars) return { excerpt: trimmed, truncated: false }
  const marker = '\n\n[... bagian tengah dokumen dihilangkan; lihat Document Repository untuk teks resmi ...]\n\n'
  const headBudget = Math.floor(maxChars * 0.72)
  const tailBudget = Math.max(400, maxChars - headBudget - marker.length)
  return {
    excerpt: `${trimmed.slice(0, headBudget).trimEnd()}${marker}${trimmed.slice(-tailBudget).trimStart()}`,
    truncated: true,
  }
}

export function truncateRepositoryRuntimeMessage(value: string, maxChars = KB_REPOSITORY_RUNTIME_MESSAGE_MAX_CHARS) {
  if (value.length <= maxChars) return value
  const suffix = '\n\n[Truncated to fit agent runtime message limit.]'
  return `${value.slice(0, Math.max(0, maxChars - suffix.length)).trimEnd()}${suffix}`
}

export function buildRepositoryKbSourceFooter(meta: RepositoryKbSourceMeta, excerptTruncated: boolean) {
  const flags = [
    meta.extract.truncated ? 'ekstrak file terpotong' : null,
    excerptTruncated ? 'prompt memakai cuplikan awal+akhir' : null,
  ].filter(Boolean)
  return [
    '<h2>Sumber dokumen (Document Repository)</h2>',
    '<p>Ringkasan KB ini bukan pengganti dokumen resmi. Untuk BRD lengkap, buka dokumen di repository.</p>',
    '<ul>',
    `<li><strong>Document ID:</strong> ${escapeHtml(meta.documentId)}</li>`,
    // Omit the Project line entirely when the document is unassigned (no project chosen).
    meta.projectName.trim()
      ? `<li><strong>Project:</strong> ${escapeHtml(meta.projectName)}</li>`
      : '',
    meta.documentVersionLabel
      ? `<li><strong>Versi:</strong> ${escapeHtml(meta.documentVersionLabel)}</li>`
      : meta.documentVersionNo != null
        ? `<li><strong>Versi:</strong> v${meta.documentVersionNo}</li>`
        : '',
    `<li><strong>File:</strong> ${escapeHtml(meta.fileName)}</li>`,
    `<li><strong>Ekstrak:</strong> ${meta.extract.fullCharCount} karakter (${meta.extract.method})</li>`,
    flags.length ? `<li><strong>Catatan:</strong> ${escapeHtml(flags.join('; '))}</li>` : '',
    '</ul>',
  ].join('')
}

export function buildRepositoryKbRelationProperties(
  meta: RepositoryKbSourceMeta,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    source: 'document-upload-auto-linking',
    relation_kind: 'document_traceability',
    document_id: meta.documentId,
    project_id: meta.projectId,
    project_name: meta.projectName,
    document_title: meta.documentTitle,
    document_version_no: meta.documentVersionNo ?? null,
    document_version_label: meta.documentVersionLabel ?? null,
    file_name: meta.fileName,
    file_type: meta.fileType,
    file_size_bytes: meta.fileSize,
    extract_method: meta.extract.method,
    extract_char_count: meta.extract.fullCharCount,
    extract_truncated: meta.extract.truncated,
    ...extra,
  }
}

export function repositoryTraceEntryTitle(documentTitle: string) {
  return `${documentTitle.trim() || 'Uploaded Document'} Source Document`
}

export function findRepositoryTraceEntryByDocumentId(
  entries: Array<{ id: string; title: string; content?: string | null }>,
  documentId: string,
  documentTitle: string,
) {
  const needle = documentId.toLowerCase()
  const traceTitle = repositoryTraceEntryTitle(documentTitle).trim().toLowerCase()
  for (const entry of entries) {
    if (entry.title.trim().toLowerCase() === traceTitle) return entry
    if ((entry.content ?? '').toLowerCase().includes(needle)) return entry
  }
  return null
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
