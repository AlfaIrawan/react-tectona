import { createKbEntry, type KbEntryResponse } from '@/lib/api/tectonaKbApi'

export const MEMO_INTERNAL_TO_KB_CONTENT_STANDARD_TITLE = 'Memo-Internal-To-KB Content Standard'

export type MemoKbRequiredSectionKind =
  | 'memo_metadata'
  | 'policy_summary'
  | 'attachment_index'
  | 'generic'

export type MemoKbRequiredSection = {
  title: string
  kind: MemoKbRequiredSectionKind
}

export type MemoInternalToKbContentStandardParsed = {
  requiredSections: MemoKbRequiredSection[]
  optionalSectionTitles: string[]
  promptExcerpt: string
}

function stripHtmlToPlainText(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeSectionKind(value: string): MemoKbRequiredSectionKind {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'memo_metadata') return 'memo_metadata'
  if (normalized === 'policy_summary') return 'policy_summary'
  if (normalized === 'attachment_index') return 'attachment_index'
  return 'generic'
}

function parseSectionLine(line: string): Array<{ title: string; kind: string }> {
  return line
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const colonIndex = part.indexOf(':')
      if (colonIndex < 0) return { title: part, kind: 'generic' }
      return {
        title: part.slice(0, colonIndex).trim(),
        kind: part.slice(colonIndex + 1).trim() || 'generic',
      }
    })
    .filter((item) => item.title)
}

export function parseMemoInternalToKbContentStandard(
  content: string | null | undefined,
): MemoInternalToKbContentStandardParsed {
  const source = typeof content === 'string' ? content.replace(/<\/?strong>/gi, '') : ''
  const plain = stripHtmlToPlainText(source)
  const requiredMatch = source.match(/required_sections:\s*([^\n<]+)/i)
    ?? plain.match(/required_sections:\s*(.+?)(?:\s+optional_sections:|$)/i)
  const optionalMatch = source.match(/optional_sections:\s*([^\n<]+)/i)
    ?? plain.match(/optional_sections:\s*(.+?)(?:\s+dynamic_sections:|$)/i)

  const requiredSections: MemoKbRequiredSection[] = []
  if (requiredMatch?.[1]) {
    parseSectionLine(requiredMatch[1]).forEach((part) => {
      requiredSections.push({
        title: part.title,
        kind: normalizeSectionKind(part.kind),
      })
    })
  }

  const optionalSectionTitles = optionalMatch?.[1]
    ? parseSectionLine(optionalMatch[1]).map((part) => part.title)
    : []

  return {
    requiredSections,
    optionalSectionTitles,
    promptExcerpt: plain.slice(0, 3200),
  }
}

export function findMemoInternalToKbContentStandardEntry(entries: KbEntryResponse[]): KbEntryResponse | null {
  return entries.find(
    (entry) => entry.title.trim().toLowerCase() === MEMO_INTERNAL_TO_KB_CONTENT_STANDARD_TITLE.toLowerCase(),
  ) ?? null
}

/** Seed only when missing — rules live in KB, not in application code. */
export async function ensureMemoInternalToKbContentStandardEntry(
  entries: KbEntryResponse[],
): Promise<KbEntryResponse | null> {
  const existing = findMemoInternalToKbContentStandardEntry(entries)
  if (existing) return existing

  try {
    return await createKbEntry({
      category: 'governance',
      title: MEMO_INTERNAL_TO_KB_CONTENT_STANDARD_TITLE,
      content: [
        '<p>Standar Memo Internal — lihat seed di python-tectona-knowledge-base-service-fastapi/docs/seeds/memo-internal-to-kb-content-standard.json</p>',
        '<p><strong>required_sections:</strong> Metadata Memo:memo_metadata | Ringkasan Ketentuan:policy_summary | Peta Lampiran:attachment_index</p>',
      ].join(''),
      is_active: true,
      priority: 90,
      workspace_id: null,
      visibility_scope: 'internal',
    })
  } catch {
    return null
  }
}

export function buildMemoKbContentStandardPromptBlock(standard: MemoInternalToKbContentStandardParsed): string[] {
  if (!standard.promptExcerpt.trim()) {
    return ['  - Ikuti standar konten Memo Internal→KB dari Knowledge Base jika tersedia.']
  }

  const sectionLines = standard.requiredSections.length > 0
    ? standard.requiredSections.map(
      (section, index) => `    ${index + 1}) <h2>${section.title}</h2> (kind=${section.kind})`,
    )
    : ['    (required_sections tidak ditemukan — ikuti heading h2 pada standar KB)']

  const optionalLine = standard.optionalSectionTitles.length > 0
    ? `  - Section opsional (buat hanya jika terdeteksi): ${standard.optionalSectionTitles.join(' | ')}`
    : '  - Section opsional: buat hanya jika ada bukti di dokumen.'

  return [
    '  - kb_content_html WAJIB mengikuti Memo-Internal-To-KB Content Standard dari Knowledge Base.',
    '  - Section wajib (urutan disarankan):',
    ...sectionLines,
    optionalLine,
    '  - Lampiran 0..N: jangan asumsikan jumlah tetap; gunakan Peta Lampiran + status linked|inline|pending_upload|external_ref.',
    '  - Ringkasan Ketentuan (policy_summary): pertahankan penomoran 1, 2, 3… sebagai <ol><li>…</li></ol>; paragraf pembuka boleh <p> terpisah di atas list.',
    '  - Patuhi format dan aturan pada cuplikan standar KB di bawah.',
  ]
}
