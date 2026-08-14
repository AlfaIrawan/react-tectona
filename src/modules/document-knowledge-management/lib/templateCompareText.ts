import type { RevisionDiffSegment } from '@/lib/documents/revisionContentHighlight'

const DOCX_BODY_MARKER = /^---\s*DOCX BODY\s*---\s*$/gm
const CLIENT_EXTRACT_MAX_CHARS = 120_000

export function sanitizeExtractedDocumentTextForCompare(text: string): string {
  return text.replace(DOCX_BODY_MARKER, '').replace(/\r\n/g, '\n').trim()
}

function isDocxFile(file: File): boolean {
  const lowerName = file.name.toLowerCase()
  return (
    lowerName.endsWith('.docx')
    || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
}

function isPlainTextFile(file: File): boolean {
  const lowerName = file.name.toLowerCase()
  return file.type.startsWith('text/') || /\.(txt|csv|md|html?)$/i.test(lowerName)
}

/** Client-side extraction for compare + template duplicate checks (no document-parser). */
export async function extractCompareDocumentText(
  file: File,
  maxChars = CLIENT_EXTRACT_MAX_CHARS,
): Promise<string> {
  if (isDocxFile(file)) {
    try {
      const mammoth = await import('mammoth')
      const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
      const sanitized = sanitizeExtractedDocumentTextForCompare(value)
      if (sanitized) return sanitized.slice(0, maxChars)
    } catch {
      /* mammoth-only for docx in compare / duplicate flows */
    }
    return ''
  }

  if (isPlainTextFile(file) && file.size > 0 && file.size <= 20_000_000) {
    try {
      const plain = sanitizeExtractedDocumentTextForCompare(await file.text())
      if (plain) return plain.slice(0, maxChars)
    } catch {
      /* ignore */
    }
  }

  return ''
}

export type CompareDiffSummaryItem = {
  kind: 'added' | 'removed'
  excerpt: string
}

export function summarizeRevisionDiffSegments(segments: RevisionDiffSegment[]): CompareDiffSummaryItem[] {
  const items: CompareDiffSummaryItem[] = []
  for (const segment of segments) {
    if (segment.type === 'equal') continue
    const excerpt = segment.text.replace(/\s+/g, ' ').trim()
    if (!excerpt) continue
    items.push({
      kind: segment.type === 'added' ? 'added' : 'removed',
      excerpt: excerpt.length > 120 ? `${excerpt.slice(0, 117)}…` : excerpt,
    })
  }
  return items
}
