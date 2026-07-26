/**
 * Repair flattened "Sebelum/Sesudah" comparison tables in generated KB HTML.
 *
 * PDF text extraction flattens a 2-column before/after table into run-on prose inside a single
 * <li>/<p> (e.g. "… Sebelum Sesudah <cell1> <cell2> *) footnote"). This mirrors the backend
 * `_repair_flattened_comparison_blocks` (memo_policy_summary_formatter / repository_kb_memo_assembler)
 * and runs as a final client-side pass so it also covers the client-side assembly fallback.
 *
 * Conservative: only rewrites a block when both markers are present AND the two parallel cells can
 * be split; otherwise the block is left untouched (no regression).
 */

const COMPARISON_HEADER_RE = /\bSebelum\s+Sesudah\b/i
const FOOTNOTE_RE = /\*\)/
const BLOCK_RE = /<(li|p)>([\s\S]*?)<\/\1>/gi

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Split a flattened "before after" cell pair — parallel cells share a leading phrase, so split at
 *  the 2nd occurrence of the leading anchor. */
function splitTwoCells(text: string): [string, string] | null {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length < 4) return null
  const lower = text.toLowerCase()
  for (const anchorLen of [4, 3, 2]) {
    if (words.length < anchorLen * 2) continue
    const anchor = words.slice(0, anchorLen).join(' ').toLowerCase()
    const first = lower.indexOf(anchor)
    const second = first !== -1 ? lower.indexOf(anchor, first + anchor.length) : -1
    if (second > 0) {
      const cell1 = text.slice(0, second).trim()
      const cell2 = text.slice(second).trim()
      if (cell1 && cell2) return [cell1, cell2]
    }
  }
  return null
}

function maybeComparisonHtml(item: string): string | null {
  const text = item.replace(/\s+/g, ' ').trim()
  const header = COMPARISON_HEADER_RE.exec(text)
  if (!header) return null

  const intro = text.slice(0, header.index).trim()
  const after = text.slice(header.index + header[0].length).trim()
  if (!after) return null

  let footnote = ''
  let cellsPart = after
  const footnoteMatch = FOOTNOTE_RE.exec(after)
  if (footnoteMatch) {
    cellsPart = after.slice(0, footnoteMatch.index).trim()
    const rest = after.slice(footnoteMatch.index)
    const period = rest.indexOf('.')
    footnote = (period !== -1 ? rest.slice(0, period + 1) : rest).trim()
  }

  const cells = splitTwoCells(cellsPart)
  if (!cells) return null
  const [cell1, cell2] = cells

  const parts: string[] = []
  if (intro) parts.push(`<p>${escapeHtml(intro)}</p>`)
  parts.push(
    '<table><thead><tr><th>Sebelum</th><th>Sesudah</th></tr></thead>'
    + `<tbody><tr><td>${escapeHtml(cell1)}</td><td>${escapeHtml(cell2)}</td></tr></tbody></table>`,
  )
  if (footnote) parts.push(`<p>${escapeHtml(footnote)}</p>`)
  return parts.join('')
}

export function repairFlattenedComparisonBlocks(html: string): string {
  if (!html) return html
  return html.replace(BLOCK_RE, (full, tag: string, inner: string) => {
    const lowered = inner.toLowerCase()
    if (!lowered.includes('sebelum') || !lowered.includes('sesudah') || lowered.includes('<table')) {
      return full
    }
    const plain = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const rebuilt = maybeComparisonHtml(plain)
    return rebuilt ? `<${tag}>${rebuilt}</${tag}>` : full
  })
}
