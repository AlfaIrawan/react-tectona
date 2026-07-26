/**
 * Convert pipe-delimited table rows ("a | b | c") in generated KB HTML into real <table> elements.
 *
 * Table-aware PDF extraction (agent-runtime pdfplumber) emits table cells as pipe-delimited rows.
 * Deterministic sections already render these as tables, but LLM-authored sections / sub-entries can
 * carry the pipe rows through as prose. This is the single, general safety-net pass applied to EVERY
 * KB entry's content right before it is saved (see createKbEntryChecked), so tables render uniformly
 * regardless of which pipeline produced the content.
 *
 * Conservative: only rewrites a <li>/<p> block when it clearly contains a pipe table (>= 2 rows with
 * >= 2 cells, consistent-ish width) and isn't already a <table>. Otherwise the block is untouched.
 */

const BLOCK_RE = /<(li|p)>([\s\S]*?)<\/\1>/gi

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function splitCells(row: string): string[] {
  return row.split('|').map((cell) => cell.trim())
}

function buildTable(rows: string[][], hasHeader: boolean): string {
  // Width is fixed by the FIRST row so a single over-split row (trailing content that captured extra
  // pipes) can't explode the table into many empty columns. Overflow cells merge into the last column.
  const width = Math.max(1, rows[0].length)
  const fit = (row: string[]): string[] => {
    if (row.length === width) return row
    if (row.length > width) return [...row.slice(0, width - 1), row.slice(width - 1).join(' ')]
    return [...row, ...Array(width - row.length).fill('')]
  }
  const cellsHtml = (row: string[], tag: 'th' | 'td'): string =>
    fit(row).map((cell) => `<${tag}>${escapeHtml(cell)}</${tag}>`).join('')
  if (hasHeader) {
    const head = `<thead><tr>${cellsHtml(rows[0], 'th')}</tr></thead>`
    const body = rows.slice(1).map((row) => `<tr>${cellsHtml(row, 'td')}</tr>`).join('')
    return `<table>${head}<tbody>${body}</tbody></table>`
  }
  const body = rows.map((row) => `<tr>${cellsHtml(row, 'td')}</tr>`).join('')
  return `<table><tbody>${body}</tbody></table>`
}

/** Rows given on their own lines (leading/trailing non-pipe lines become intro/footnote paragraphs). */
function convertNewlineRows(plain: string): string | null {
  const lines = plain.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2) return null
  const pipeLineCount = lines.filter((line) => line.includes(' | ')).length
  if (pipeLineCount < 2) return null

  const parts: string[] = []
  const introLines: string[] = []
  const rowLines: string[] = []
  const footnoteLines: string[] = []
  for (const line of lines) {
    if (line.includes(' | ')) {
      rowLines.push(line)
    } else if (rowLines.length === 0) {
      introLines.push(line)
    } else {
      footnoteLines.push(line)
    }
  }
  if (rowLines.length < 2) return null

  const rows = rowLines.map(splitCells)
  const numericFirst = rows.every((row) => /^\d+$/.test(row[0]))
  if (introLines.length) parts.push(escapeHtml(introLines.join(' ')))
  parts.push(buildTable(rows, !numericFirst))
  if (footnoteLines.length) parts.push(escapeHtml(footnoteLines.join(' ')))
  return parts.join('')
}

/** Numbered rows joined into prose: "intro: 1 | a | b 2 | c | d 3 | e | f". Split at incrementing "N |". */
function convertNumberedProseRows(plain: string): string | null {
  const text = plain.replace(/\s+/g, ' ').trim()
  const markRe = /(?:^|\s)(\d+)\s*\|/g
  const marks: Array<{ num: number; start: number }> = []
  let match: RegExpExecArray | null
  while ((match = markRe.exec(text)) !== null) {
    // start index of the digit itself (skip a leading space captured by (?:^|\s))
    const digitStart = match.index + (match[0].length - match[0].trimStart().length)
    marks.push({ num: Number(match[1]), start: digitStart })
  }
  // Keep only a strictly incrementing run starting at 1.
  const seq: Array<{ num: number; start: number }> = []
  let expected = 1
  for (const mark of marks) {
    if (mark.num === expected) {
      seq.push(mark)
      expected += 1
    }
  }
  if (seq.length < 2) return null

  let intro = text.slice(0, seq[0].start).trim()
  const rows: string[][] = []
  for (let i = 0; i < seq.length; i += 1) {
    const start = seq[i].start
    const end = i + 1 < seq.length ? seq[i + 1].start : text.length
    const cells = splitCells(text.slice(start, end).trim())
    if (cells.length >= 2) rows.push(cells)
  }
  if (rows.length < 2) return null

  // Recover a header row that the LLM flattened into the intro tail, e.g.
  // "...sebagai berikut: No. | Isu | Dampak" → header ["No.","Isu","Dampak"], intro "...sebagai berikut:".
  let header: string[] | null = null
  const firstPipe = intro.indexOf(' | ')
  if (firstPipe > 0) {
    const before = intro.slice(0, firstPipe)
    const boundary = Math.max(before.lastIndexOf(': '), before.lastIndexOf('. '))
    const headerStart = boundary >= 0 ? boundary + 1 : 0
    const headerCells = splitCells(intro.slice(headerStart).trim())
    if (headerCells.length >= 2) {
      header = headerCells
      intro = intro.slice(0, headerStart).trim()
    }
  }

  const parts: string[] = []
  if (intro) parts.push(escapeHtml(intro))
  parts.push(header ? buildTable([header, ...rows], true) : buildTable(rows, false))
  return parts.join('')
}

function convertBlockInner(inner: string): string | null {
  if (inner.toLowerCase().includes('<table')) return null
  const plain = inner.replace(/<[^>]+>/g, '\n').replace(/ /g, ' ')
  if (!plain.includes(' | ')) return null
  return convertNewlineRows(plain) ?? convertNumberedProseRows(plain)
}

export function convertPipeTablesToHtml(html: string): string {
  if (!html || !html.includes(' | ')) return html
  return html.replace(BLOCK_RE, (full, tag: string, inner: string) => {
    const converted = convertBlockInner(inner)
    return converted ? `<${tag}>${converted}</${tag}>` : full
  })
}
