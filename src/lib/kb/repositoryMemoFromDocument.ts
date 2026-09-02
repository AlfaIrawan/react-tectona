/**
 * Memo Internal → KB helpers (generic, multi-company).
 */

import type { MemoInternalToKbContentStandardParsed } from './memoInternalToKbContentStandard'
import { parseBrdStructuredName } from './repositoryKbFromDocument'
import { resolveSampleKindFromFolderNames } from '@/modules/document-knowledge-management/lib/sampleDocumentKind'

export type RepositoryDocumentKind =
  | 'brd'
  | 'memo_internal'
  | 'ketetapan_sementara'
  | 'unknown'

export type MemoAttachmentEntry = {
  id: string
  title: string
  status: 'linked' | 'inline' | 'pending_upload' | 'external_ref'
  note?: string
}

export type MemoMetadataExtract = {
  memoNumber: string | null
  subject: string | null
  fromUnit: string | null
  toAudience: string | null
  classification: string | null
  issuedDate: string | null
  effectiveDate: string | null
  supersedesMemo: string | null
}

const MEMO_HEADER_RE = /\bMEMO\s+INTERNAL\b/i
const MEMO_ALT_HEADER_RE = /\b(?:SURAT\s+EDARAN\s+INTERNAL|INTERNAL\s+CIRCULAR|CIRCULAR\s+INTERNAL)\b/i
const BRD_DOC_MARKER_RE = /\bBUSINESS\s+REQUIREMENT\s+DOCUMENT\b/i

export type RepositoryDocumentKindDetectOptions = {
  /** Folder names from repository root → upload target (breadcrumb). */
  folderPath?: readonly string[]
}

export function looksLikeMemoAttachmentFileName(fileName: string): boolean {
  const lower = fileName.trim().toLowerCase()
  if (!lower) return false
  if (/\blampiran\b/i.test(lower)) return true
  if (/\b(?:attachment|annex|appendix)\b/i.test(lower) && !/^brd[_-]/i.test(lower)) return true
  return false
}

export type ParsedMemoAttachmentFileName = {
  id: string
  title: string
}

/** Parse "Lampiran 4 – Komunikasi Internal dan Eksternal.pdf" → { id: L4, title: ... } */
export function parseMemoAttachmentFromFileName(fileName: string): ParsedMemoAttachmentFileName | null {
  const base = fileName.replace(/\.[^/.]+$/, '').trim()
  const match = base.match(
    /^(?:lampiran|annex|appendix|attachment)\s*([0-9]+|[IVXLCDM]+|[A-Za-z])\s*(?:\s*[—–\-]\s*|\s*:\s*)\s*(.+)$/i,
  )
  if (!match?.[1] || !match[2]) return null
  const rawId = match[1].trim()
  const title = match[2].replace(/\s+/g, ' ').trim()
  if (!title) return null
  const id = /^\d+$/i.test(rawId) ? `L${rawId}` : `L${rawId.toUpperCase()}`
  return { id, title }
}

/** Upload file is a memo lampiran (not the induk memo body). */
export function isMemoAttachmentUpload(fileName: string, text: string): boolean {
  if (!looksLikeMemoAttachmentFileName(fileName)) return false
  const head = (text || '').slice(0, 4000)
  return !MEMO_HEADER_RE.test(head)
}

export function mergeMemoMetadataExtract(
  parent: MemoMetadataExtract,
  child: MemoMetadataExtract,
): MemoMetadataExtract {
  const pick = (parentValue: string | null, childValue: string | null) => childValue ?? parentValue
  return {
    memoNumber: pick(parent.memoNumber, child.memoNumber),
    subject: child.subject ?? parent.subject,
    fromUnit: pick(parent.fromUnit, child.fromUnit),
    toAudience: pick(parent.toAudience, child.toAudience),
    classification: pick(parent.classification, child.classification),
    issuedDate: pick(parent.issuedDate, child.issuedDate),
    effectiveDate: pick(parent.effectiveDate, child.effectiveDate),
    supersedesMemo: pick(parent.supersedesMemo, child.supersedesMemo),
  }
}

export function enrichMemoMetadataFromAttachmentFileName(
  metadata: MemoMetadataExtract,
  fileName: string,
): MemoMetadataExtract {
  const parsed = parseMemoAttachmentFromFileName(fileName)
  if (!parsed) return metadata
  return {
    ...metadata,
    subject: parsed.title,
  }
}

export function buildMemoAttachmentSelfEntry(
  fileName: string,
  documentTitle?: string | null,
): MemoAttachmentEntry | null {
  const parsed = parseMemoAttachmentFromFileName(fileName)
  if (!parsed) return null
  return {
    id: parsed.id,
    title: parsed.title || documentTitle || fileName,
    status: 'linked',
    note: 'File lampiran ini adalah dokumen yang sedang di-upload.',
  }
}

export function mergeMemoAttachmentEntriesForUpload(
  detected: MemoAttachmentEntry[],
  fileName: string,
  isAttachmentUpload: boolean,
  documentTitle?: string | null,
): MemoAttachmentEntry[] {
  if (!isAttachmentUpload) return detected
  const selfEntry = buildMemoAttachmentSelfEntry(fileName, documentTitle)
  if (!selfEntry) return detected

  const byId = new Map<string, MemoAttachmentEntry>()
  for (const entry of detected) byId.set(entry.id.toLowerCase(), entry)
  byId.set(selfEntry.id.toLowerCase(), selfEntry)
  return Array.from(byId.values())
}

export function isMemoInternalFolderPath(folderNames: readonly string[]): boolean {
  if (folderNames.length === 0) return false
  const joined = folderNames.join(' ').toLowerCase()
  if (/\bmemo\s*internal\b/i.test(joined)) return true
  if (/\binternal\s*memo\b/i.test(joined)) return true
  if (/\bsurat\s*edaran\b/i.test(joined)) return true
  return false
}

export function buildRepositoryFolderPathNames(
  folders: ReadonlyArray<{ id: string; name: string; parent_id?: string | null }>,
  folderId: string | null,
): string[] {
  if (!folderId) return []
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const path: string[] = []
  let cursor: string | null = folderId
  let guard = 0
  while (cursor && guard < 50) {
    const folder = byId.get(cursor)
    if (!folder) break
    path.unshift(folder.name)
    cursor = folder.parent_id ?? null
    guard += 1
  }
  return path
}

export function looksLikeMemoUploadFileName(fileName: string): boolean {
  const lower = fileName.trim().toLowerCase()
  if (!lower) return false
  if (looksLikeMemoAttachmentFileName(fileName)) return true
  if (/\bmemo[\s_-]*internal\b/i.test(fileName)) return true
  if (/^brd[_-]/i.test(fileName)) return false
  if (/\b(kebijakan|smki|surat[\s_-]*edaran|circular|policy[\s_-]*memo)\b/i.test(lower)) return true
  return false
}

function looksLikeAutoRenamedMemoLampiranBrd(fileName: string): boolean {
  const parsed = parseBrdStructuredName(fileName)
  if (!parsed) return false
  const blob = `${parsed.projectOrInitiativeName}_${parsed.moduleOrFeatureName}`.toLowerCase()
  return /\blampiran\b/.test(blob)
}

function isMemoContext(fileName: string, folderPath?: readonly string[]): boolean {
  if (looksLikeMemoUploadFileName(fileName) || looksLikeMemoAttachmentFileName(fileName)) return true
  if (folderPath && isMemoInternalFolderPath(folderPath)) return true
  if (looksLikeAutoRenamedMemoLampiranBrd(fileName)) return true
  return false
}

function cleanMemoField(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  // The memo header is a 2-column table, so table-aware extraction yields "Label | Value" — drop a
  // leading table-cell pipe so the value isn't prefixed with "| ".
  const trimmed = value.replace(/\s+/g, ' ').replace(/^\s*\|\s*/, '').trim()
  return trimmed || null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(text)
    if (match?.[1]) {
      const cleaned = cleanMemoField(match[1])
      if (cleaned) return cleaned
    }
  }
  return null
}

export function detectRepositoryDocumentKind(
  text: string,
  fileName: string,
  options?: RepositoryDocumentKindDetectOptions,
): RepositoryDocumentKind {
  const name = fileName.trim()
  const upperName = name.toUpperCase()
  const head = (text || '').slice(0, 12_000)
  const folderPath = options?.folderPath
  const sampleKind = resolveSampleKindFromFolderNames(folderPath ?? [])
  if (sampleKind === 'memo_internal' || sampleKind === 'ketetapan_sementara' || sampleKind === 'brd') {
    return sampleKind
  }
  const memoContext = isMemoContext(name, folderPath)
  const hasBrdDocMarker = BRD_DOC_MARKER_RE.test(head)

  if (MEMO_HEADER_RE.test(head) || MEMO_ALT_HEADER_RE.test(head)) {
    return 'memo_internal'
  }

  if (/\bMEMO[-_\s]INTERNAL\b/i.test(name) || /\bINTERNAL[-_\s]MEMO\b/i.test(name)) {
    return 'memo_internal'
  }

  if (memoContext && !hasBrdDocMarker) {
    return 'memo_internal'
  }

  if (upperName.startsWith('BRD_') || /^BRD[-_.]/i.test(name) || parseBrdStructuredName(name)) {
    return 'brd'
  }

  if (/^KS[-_]/i.test(name) || /\bketetapan\s+sementara\b/i.test(name)) {
    return 'ketetapan_sementara'
  }

  return 'unknown'
}

export function extractMemoMetadataFromDocumentText(text: string): MemoMetadataExtract {
  const head = (text || '').slice(0, 12_000)

  const memoNumber = firstMatch(head, [
    /\bNo\.?\s*([A-Z0-9][A-Z0-9/_\-.]+(?:\/[A-Z0-9][A-Z0-9/_\-.]+)*)/i,
    /\bNomor\s*:?\s*([^\n]+)/i,
  ])

  const subject = firstMatch(head, [
    /\bPerihal\s*:?\s*([^\n]+)/i,
    /\bSubject\s*:?\s*([^\n]+)/i,
    /\bRegarding\s*:?\s*([^\n]+)/i,
  ])

  const fromUnit = firstMatch(head, [
    /\bDari\s*:?\s*([^\n]+)/i,
    /\bFrom\s*:?\s*([^\n]+)/i,
  ])

  const toAudience = firstMatch(head, [
    /\bKepada\s*:?\s*([^\n]+)/i,
    /\bTo\s*:?\s*([^\n]+)/i,
  ])

  const classification = firstMatch(head, [
    /\bKlasifikasi\s*:?\s*([^\n]+)/i,
    /\bClassification\s*:?\s*([^\n]+)/i,
  ])

  const issuedDate = firstMatch(head, [
    /\bTanggal\s+Terbit\s*:?\s*([^\n]+)/i,
    /\bIssued\s*(?:Date)?\s*:?\s*([^\n]+)/i,
  ])

  const effectiveDate = firstMatch(head, [
    /\bTanggal\s+Berlaku\s*:?\s*([^\n]+)/i,
    /\bEffective\s*(?:Date)?\s*:?\s*([^\n]+)/i,
  ])

  const supersedesMemo = firstMatch(head, [
    /\bmemo\s+internal\s+([A-Z0-9][A-Z0-9/_\-.]+(?:\/[A-Z0-9][A-Z0-9/_\-.]+)*)\s+perihal/i,
    /\bmenggantikan\s*:?\s*([^\n]+)/i,
    /\bdigantikan\s*:?\s*([^\n]+)/i,
  ])

  return {
    memoNumber,
    subject,
    fromUnit,
    toAudience,
    classification,
    issuedDate,
    effectiveDate,
    supersedesMemo,
  }
}

export function extractMemoAttachmentEntriesFromDocumentText(text: string): MemoAttachmentEntry[] {
  const source = (text || '').slice(0, 20_000)
  const entries: MemoAttachmentEntry[] = []
  const seen = new Set<string>()

  const patterns = [
    /\b(?:o\s+)?Lampiran\s+(\d+)\s*[—–-]\s*([^\n(]+?)(?:\s*\([^)]*\))?/gi,
    /\bAnnex\s+(\d+|[A-Za-z]+)\s*[—–-]\s*([^\n(]+)/gi,
    /\bAppendix\s+(\d+|[A-Za-z]+)\s*[—–-]\s*([^\n(]+)/gi,
  ]

  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(source)) !== null) {
      const rawId = cleanMemoField(match[1])
      const rawTitle = cleanMemoField(match[2])
      if (!rawId || !rawTitle) continue
      const id = rawId.match(/^\d+$/) ? `L${rawId}` : `L${rawId}`
      const key = `${id}:${rawTitle.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      entries.push({
        id,
        title: rawTitle,
        status: 'pending_upload',
        note: 'Disebut di memo; file lampiran belum diverifikasi di upload ini.',
      })
    }
  }

  return entries
}

export function extractMemoPolicySummaryFromDocumentText(text: string): string | null {
  const blocks = extractMemoPolicySummaryBlocks(text)
  if (blocks.numberedItems.length > 0) {
    const parts: string[] = []
    if (blocks.intro) parts.push(blocks.intro)
    parts.push(...blocks.numberedItems.map((item, index) => `${index + 1}. ${item}`))
    return parts.join('\n').trim() || null
  }
  return blocks.proseTail ?? blocks.intro
}

export type MemoPolicySummaryBlocks = {
  intro: string | null
  numberedItems: string[]
  proseTail: string | null
}

export function extractMemoPolicySummaryBlocks(text: string): MemoPolicySummaryBlocks {
  const source = text || ''
  const markers = [
    /GAMBARAN\s+UMUM\s+KETENTUAN/i,
    /RINGKASAN\s+EKSEKUTIF/i,
    /EXECUTIVE\s+SUMMARY/i,
  ]

  for (const marker of markers) {
    const match = marker.exec(source)
    if (!match) continue
    const tail = source.slice(match.index + match[0].length, match.index + match[0].length + 4000)
    const blocks = extractMemoPolicySummaryBlocksFromBody(tail)
    if (blocks.numberedItems.length >= 2 || blocks.intro || blocks.proseTail) {
      return blocks
    }
  }

  const fallbackBody = extractMemoBodySummaryFallback(source)
  if (!fallbackBody) {
    return { intro: null, numberedItems: [], proseTail: null }
  }
  return extractMemoPolicySummaryBlocksFromBody(fallbackBody)
}

const MEMO_SUMMARY_NOISE_LINE_RE = /^(?:---\s*DOC\s+BODY\s*---|Page\s+\d+\s+of\s+\d+|Klasifikasi\s*:.*|Classification\s*:.*)$/i
const MEMO_SECTION_HEADING_RE = /^(?:\d+[.)]\s*)?(Isu\s+(?:Internal|Eksternal)|Internal\s+Issues?|External\s+Issues?)\s*$/i

function isMemoSummaryNoiseLine(line: string): boolean {
  return MEMO_SUMMARY_NOISE_LINE_RE.test(line.trim())
}

function isMemoSectionHeading(line: string): boolean {
  return MEMO_SECTION_HEADING_RE.test(line.trim())
}

function cleanMemoSummarySourceLines(text: string): string[] {
  const lines = text.replace(/\r/g, '\n').split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim())
  const cleaned: string[] = []
  for (const line of lines) {
    if (!line || isMemoSummaryNoiseLine(line)) continue
    if (
      cleaned.length > 0
      && /Lampiran\s+\d+/i.test(line)
      && /Isu/i.test(line)
      && cleaned.slice(0, 4).some((prev) => /Lampiran\s+\d+/i.test(prev))
    ) {
      continue
    }
    cleaned.push(line)
  }
  return cleaned
}

function rowsToMemoTableHtml(rows: string[][], hasHeader = true): string {
  if (rows.length === 0) return ''
  const width = Math.max(1, rows[0]?.length ?? 1)
  const fit = (row: string[]) => {
    if (row.length === width) return row
    if (row.length > width) return [...row.slice(0, width - 1), row.slice(width - 1).join(' ')]
    return [...row, ...Array.from({ length: width - row.length }, () => '')]
  }
  const cells = (row: string[], tag: 'th' | 'td') =>
    fit(row).map((cell) => `<${tag}>${escapeHtml(cell)}</${tag}>`).join('')

  if (hasHeader) {
    return [
      '<table><thead><tr>',
      cells(rows[0] ?? [], 'th'),
      '</tr></thead><tbody>',
      rows.slice(1).map((row) => `<tr>${cells(row, 'td')}</tr>`).join(''),
      '</tbody></table>',
    ].join('')
  }
  return `<table><tbody>${rows.map((row) => `<tr>${cells(row, 'td')}</tr>`).join('')}</tbody></table>`
}

function splitMemoPipeRowRuns(rows: string[][]): Array<{ table: string[][]; hasHeader: boolean }> {
  const tables: string[][][] = []
  let current: string[][] = []
  let currentHeader: string[] | null = null
  const isNumeric = (cell: string) => /^\d+\.?$/.test(cell.trim())
  const rowNumber = (row: string[]) => {
    const cell = row[0]?.trim().replace(/\.$/, '') ?? ''
    return /^\d+$/.test(cell) ? Number(cell) : null
  }

  for (const row of rows) {
    const repeatedHeader = current.length > 0 && currentHeader != null && row.join('|') === currentHeader.join('|')
    const numberingReset =
      current.length > 0
      && rowNumber(row) === 1
      && (rowNumber(current[current.length - 1] ?? []) ?? 0) > 1
    if (repeatedHeader || numberingReset) {
      tables.push(current)
      current = [row]
      currentHeader = row[0] && !isNumeric(row[0]) ? row : null
    } else {
      if (current.length === 0) currentHeader = row[0] && !isNumeric(row[0]) ? row : null
      current.push(row)
    }
  }
  if (current.length > 0) tables.push(current)
  return tables.map((table) => ({
    table,
    hasHeader: Boolean(table[0]?.[0] && !isNumeric(table[0][0])),
  }))
}

function renderMemoTextSegmentHtml(text: string): string {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.some((line) => isMemoSectionHeading(line))) {
    const parts: string[] = []
    const buffer: string[] = []
    const flush = () => {
      if (buffer.length === 0) return
      const blocks = extractMemoPolicySummaryBlocksFromBody(buffer.join('\n'))
      if (blocks.intro) parts.push(`<p>${escapeHtml(blocks.intro)}</p>`)
      if (blocks.numberedItems.length > 0) {
        parts.push(`<ol>${blocks.numberedItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`)
      } else if (blocks.proseTail) {
        parts.push(`<p>${escapeHtml(blocks.proseTail)}</p>`)
      }
      buffer.length = 0
    }
    for (const line of lines) {
      if (isMemoSectionHeading(line)) {
        flush()
        parts.push(`<h3>${escapeHtml(line.replace(/^\d+[.)]\s*/, '').trim())}</h3>`)
      } else {
        buffer.push(line)
      }
    }
    flush()
    return parts.join('')
  }

  const blocks = extractMemoPolicySummaryBlocksFromBody(text)
  const parts: string[] = []
  if (blocks.intro) parts.push(`<p>${escapeHtml(blocks.intro)}</p>`)
  if (blocks.numberedItems.length > 0) {
    parts.push(`<ol>${blocks.numberedItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`)
  } else if (blocks.proseTail) {
    parts.push(`<p>${escapeHtml(blocks.proseTail)}</p>`)
  }
  return parts.join('')
}

/** Prefer structured tables from pipe-delimited PDF extraction; fall back to numbered lists. */
export function buildMemoPolicySummaryHtml(text: string): string {
  const source = text || ''
  const markerMatch = /GAMBARAN\s+UMUM\s+KETENTUAN|RINGKASAN\s+EKSEKUTIF|EXECUTIVE\s+SUMMARY/i.exec(source)
  const scoped = markerMatch
    ? source.slice(markerMatch.index! + markerMatch[0].length, markerMatch.index! + markerMatch[0].length + 8000)
    : source
  const lines = cleanMemoSummarySourceLines(scoped)

  if (lines.some((line) => line.includes(' | '))) {
    const parts: string[] = []
    const textBuffer: string[] = []
    let index = 0
    const flushText = () => {
      if (textBuffer.length === 0) return
      const rendered = renderMemoTextSegmentHtml(textBuffer.join('\n'))
      if (rendered) parts.push(rendered)
      textBuffer.length = 0
    }
    while (index < lines.length) {
      if (lines[index]?.includes(' | ')) {
        flushText()
        const rows: string[][] = []
        while (index < lines.length && lines[index]?.includes(' | ')) {
          rows.push((lines[index] ?? '').split(' | ').map((cell) => cell.trim()))
          index += 1
        }
        for (const { table, hasHeader } of splitMemoPipeRowRuns(rows)) {
          parts.push(rowsToMemoTableHtml(table, hasHeader))
        }
      } else {
        textBuffer.push(lines[index] ?? '')
        index += 1
      }
    }
    flushText()
    const rendered = parts.join('')
    if (rendered) return rendered
  }

  const blocks = extractMemoPolicySummaryBlocks(text)
  const parts: string[] = []
  if (blocks.intro) parts.push(`<p>${escapeHtml(blocks.intro)}</p>`)
  if (blocks.numberedItems.length > 0) {
    parts.push(`<ol>${blocks.numberedItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`)
  } else if (blocks.proseTail) {
    parts.push(`<p>${escapeHtml(blocks.proseTail)}</p>`)
  }
  return parts.length > 0
    ? parts.join('')
    : '<p>Ringkasan ketentuan belum dapat diekstrak otomatis dari cuplikan dokumen.</p>'
}

function extractMemoPolicySummaryBlocksFromBody(body: string): MemoPolicySummaryBlocks {
  const normalized = body.replace(/\r/g, '\n').trim()
  if (!normalized) {
    return { intro: null, numberedItems: [], proseTail: null }
  }

  const lineItems = extractNumberedItemsFromLines(normalized)
  if (lineItems.items.length >= 2) {
    return {
      intro: lineItems.intro,
      numberedItems: lineItems.items,
      proseTail: null,
    }
  }

  const inlineItems = splitInlineNumberedItems(normalized.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())
  if (inlineItems.items.length >= 2) {
    return {
      intro: inlineItems.intro,
      numberedItems: inlineItems.items,
      proseTail: null,
    }
  }

  const prose = normalized.replace(/\s+/g, ' ').trim()
  return {
    intro: null,
    numberedItems: [],
    proseTail: prose.length >= 40 ? prose : null,
  }
}

function extractNumberedItemsFromLines(body: string): { intro: string | null; items: string[] } {
  const lines = body.split(/\n+/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const introLines: string[] = []
  const items: string[] = []
  let currentItem: string | null = null

  for (const line of lines) {
    if (isMemoSummaryNoiseLine(line)) continue
    const match = line.match(/^(\d+)[\.\)]\s+(.+)$/)
    if (match?.[2]) {
      if (currentItem) items.push(currentItem.trim())
      currentItem = match[2].trim()
      continue
    }

    if (currentItem) {
      currentItem = `${currentItem} ${line}`.trim()
    } else {
      introLines.push(line)
    }
  }

  if (currentItem) items.push(currentItem.trim())

  return {
    intro: introLines.join(' ').trim() || null,
    items,
  }
}

function splitInlineNumberedItems(text: string): { intro: string | null; items: string[] } {
  const matches = [...text.matchAll(/(?:^|\s)(\d+)[\.\)]?\s+(?=[A-Za-zÀ-ÿ])/g)]
  if (matches.length < 2) {
    return { intro: text.trim() || null, items: [] }
  }

  const intro = text.slice(0, matches[0].index ?? 0).trim() || null
  const items: string[] = []

  for (let index = 0; index < matches.length; index += 1) {
    const start = (matches[index].index ?? 0) + matches[index][0].length
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? text.length) : text.length
    const item = text.slice(start, end).trim()
    if (item) items.push(item)
  }

  return { intro, items }
}

function extractMemoBodySummaryFallback(text: string, maxChars = 2400): string | null {
  const lines = text.replace(/\r/g, '\n').split('\n')
  const chunks: string[] = []

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim()
    if (line.length < 28) continue
    if (/^(?:page\s+\d+|klasifikasi\s*:|memo\s+internal|pt\.|adira\b)/i.test(line)) continue
    if (/^no\.\s*[A-Z]{1,5}-\d+/i.test(line)) continue
    if (/^(?:kepada|dari|perihal|lampiran)\s*:/i.test(line)) continue
    chunks.push(line)
    if (chunks.join(' ').length >= maxChars) break
  }

  const summary = chunks.join(' ').slice(0, maxChars).trim()
  return summary.length >= 80 ? summary : null
}

export function buildMemoAttachmentIndexMachineLine(attachments: MemoAttachmentEntry[]): string {
  if (attachments.length === 0) return 'attachment_index: none'
  return `attachment_index: ${attachments.map((item) => `${item.id}:${item.title}:${item.status}`).join(' | ')}`
}

export function buildMemoMetadataTableHtml(metadata: MemoMetadataExtract): string {
  const rows: Array<[string, string | null]> = [
    ['Nomor Memo', metadata.memoNumber],
    ['Perihal', metadata.subject],
    ['Dari', metadata.fromUnit],
    ['Kepada', metadata.toAudience],
    ['Klasifikasi', metadata.classification],
    ['Tanggal Terbit', metadata.issuedDate],
    ['Tanggal Berlaku', metadata.effectiveDate],
    ['Memo Digantikan', metadata.supersedesMemo],
  ]

  const body = rows
    .filter(([, value]) => value)
    .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value!)}</td></tr>`)
    .join('')

  if (!body) {
    return '<p>Metadata memo belum dapat diekstrak otomatis dari cuplikan dokumen.</p>'
  }

  return `<table><tbody>${body}</tbody></table>`
}

export function buildMemoAttachmentIndexHtml(attachments: MemoAttachmentEntry[]): string {
  if (attachments.length === 0) {
    return [
      '<p>Tidak ada lampiran.</p>',
      '<p><code>attachment_index: none</code></p>',
    ].join('')
  }

  const rows = attachments.map((item) => [
    `<tr>`,
    `<td>${escapeHtml(item.id)}</td>`,
    `<td>${escapeHtml(item.title)}</td>`,
    `<td>${escapeHtml(item.status)}</td>`,
    `<td>${escapeHtml(item.note ?? '')}</td>`,
    `</tr>`,
  ].join('')).join('')

  return [
    '<table>',
    '<thead><tr><th>ID</th><th>Judul</th><th>Status</th><th>Catatan</th></tr></thead>',
    `<tbody>${rows}</tbody>`,
    '</table>',
    `<p><code>${escapeHtml(buildMemoAttachmentIndexMachineLine(attachments))}</code></p>`,
  ].join('')
}

function extractH2SectionBody(contentHtml: string, sectionTitle: string): string {
  const pattern = new RegExp(
    `<h2>\\s*${sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</h2>([\\s\\S]*?)(?=<h2>|$)`,
    'i',
  )
  const match = pattern.exec(contentHtml)
  return match?.[1]?.trim() ?? ''
}

export function ensureMemoKbStandardContent(
  contentHtml: string,
  documentText: string,
  standard: MemoInternalToKbContentStandardParsed,
  metadata: MemoMetadataExtract,
  attachments: MemoAttachmentEntry[],
): string {
  if (standard.requiredSections.length === 0) return contentHtml

  const parts: string[] = []

  for (const section of standard.requiredSections) {
    // Always rebuild policy_summary from extracted text so LLM-flattened prose/tables
    // cannot overwrite structured numbering/tables from the source PDF.
    if (section.kind === 'policy_summary') {
      parts.push(`<h2>${escapeHtml(section.title)}</h2>${buildMemoPolicySummaryHtml(documentText)}`)
      continue
    }

    const existing = extractH2SectionBody(contentHtml, section.title)
    if (existing && existing.replace(/<[^>]+>/g, '').trim().length > 40) {
      parts.push(`<h2>${escapeHtml(section.title)}</h2>${existing}`)
      continue
    }

    switch (section.kind) {
      case 'memo_metadata':
        parts.push(`<h2>${escapeHtml(section.title)}</h2>${buildMemoMetadataTableHtml(metadata)}`)
        break
      case 'attachment_index':
        parts.push(`<h2>${escapeHtml(section.title)}</h2>${buildMemoAttachmentIndexHtml(attachments)}`)
        break
      default:
        parts.push(
          `<h2>${escapeHtml(section.title)}</h2><p>Section ini belum dapat dilengkapi otomatis dari cuplikan dokumen.</p>`,
        )
        break
    }
  }

  const optionalFromLlm = standard.optionalSectionTitles
    .map((title) => {
      const body = extractH2SectionBody(contentHtml, title)
      return body ? `<h2>${escapeHtml(title)}</h2>${body}` : ''
    })
    .filter(Boolean)
    .join('')

  return `${parts.join('')}${optionalFromLlm}`
}

export function deriveMemoKbTitle(params: {
  metadata: MemoMetadataExtract
  fallbackTitle?: string | null
  documentTitle: string
  llmTitle?: string | null
  fileName?: string | null
}): string {
  const llm = cleanMemoField(params.llmTitle ?? '')
  if (llm) return llm

  const fileName = params.fileName ?? ''
  const attachment = parseMemoAttachmentFromFileName(fileName)
  const memoNumber = cleanMemoField(params.metadata.memoNumber)

  if (attachment) {
    const label = `Lampiran ${attachment.id.replace(/^L/i, '')}: ${attachment.title}`
    return memoNumber ? `Memo Internal — ${label} (${memoNumber})` : `Memo Internal — ${label}`
  }

  const subject = cleanMemoField(params.metadata.subject)
    || cleanMemoField(params.documentTitle)
    || cleanMemoField(params.fallbackTitle)
    || 'Memo Internal'

  if (memoNumber) return `Memo Internal — ${subject} (${memoNumber})`
  return `Memo Internal — ${subject}`
}

export function buildMemoKbDetectedContextPromptBlock(params: {
  metadata: MemoMetadataExtract
  attachments: MemoAttachmentEntry[]
  policySummary: string | null
}): string {
  const lines = ['Deteksi struktur Memo Internal (gunakan sebagai acuan wajib):']
  const meta = params.metadata
  if (meta.memoNumber) lines.push(`Nomor memo: ${meta.memoNumber}`)
  if (meta.subject) lines.push(`Perihal: ${meta.subject}`)
  if (meta.fromUnit) lines.push(`Dari: ${meta.fromUnit}`)
  if (meta.toAudience) lines.push(`Kepada: ${meta.toAudience}`)
  if (meta.classification) lines.push(`Klasifikasi: ${meta.classification}`)
  if (meta.issuedDate) lines.push(`Tanggal terbit: ${meta.issuedDate}`)
  if (meta.effectiveDate) lines.push(`Tanggal berlaku: ${meta.effectiveDate}`)
  if (meta.supersedesMemo) lines.push(`Memo digantikan: ${meta.supersedesMemo}`)

  if (params.attachments.length > 0) {
    lines.push(
      `Lampiran terdeteksi (${params.attachments.length}): ${
        params.attachments.map((item) => `${item.id} — ${item.title}`).join(' | ')
      }`,
    )
  } else {
    lines.push('Lampiran terdeteksi: (tidak ada — tulis eksplisit di Peta Lampiran)')
  }

  if (params.policySummary) {
    lines.push(`Ringkasan awal terdeteksi: ${params.policySummary.slice(0, 600)}`)
  }

  return lines.join('\n')
}
