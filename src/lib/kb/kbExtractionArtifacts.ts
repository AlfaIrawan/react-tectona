/**
 * Strip PDF running-header/footer artifacts that bleed into generated KB text.
 *
 * PDF text extraction has no notion of page chrome, so repeated page footers/headers land inside
 * content (e.g. a list item ends with "… Page 2 of 10 Klasifikasi : Internal TUJUAN"). These are
 * noise, never authored content. Conservative: only removes well-known page-number/classification
 * tokens and a curated set of trailing memo section headings; leaves everything else intact.
 */

const PAGE_NUMBER_EN_RE = /\s*\bPage\s+\d+\s+of\s+\d+\b/gi
const PAGE_NUMBER_ID_RE = /\s*\bHalaman\s+\d+\s+(?:dari|of)\s+\d+\b/gi
const CLASSIFICATION_RE = /\s*\bKlasifikasi\s*:\s*(?:Internal|Confidential|Rahasia|Terbatas|Restricted|Publik|Public)\b/gi
// A memo section heading (ALL CAPS) that leaked to the END of a list item / paragraph.
const TRAILING_SECTION_HEADING_RE =
  /\s+(?:TUJUAN|KETENTUAN|LATAR\s+BELAKANG|DASAR\s+HUKUM|RUANG\s+LINGKUP|LAMPIRAN|PENUTUP|DEFINISI|REFERENSI|ISI\s+MEMO)\s*(?=<\/li>|<\/p>|<\/td>|$)/g

/**
 * Remove running headers/footers from raw extracted document text using the standard frequency
 * technique: a short line that repeats across many pages (page numbers, classification banners,
 * running document titles) is page chrome, not content. Digits are masked before counting so page
 * numbers like "Page 2 of 10" / "Page 3 of 10" group together. Conservative: only strips lines that
 * repeat >= REPEAT_THRESHOLD times and are short (<= 120 chars), so real repeated sentences survive.
 */
const RUNNING_LINE_REPEAT_THRESHOLD = 3
const RUNNING_LINE_MAX_LEN = 120

function normalizeLineForFrequency(line: string): string {
  return line.trim().replace(/\s+/g, ' ').replace(/\d+/g, '#').toLowerCase()
}

export function stripRepeatedRunningLines(text: string): string {
  if (!text) return text
  const lines = text.split('\n')
  const freq = new Map<string, number>()
  for (const line of lines) {
    const key = normalizeLineForFrequency(line)
    if (key.length >= 3 && key.length <= RUNNING_LINE_MAX_LEN) {
      freq.set(key, (freq.get(key) ?? 0) + 1)
    }
  }
  const running = new Set(
    [...freq.entries()].filter(([, count]) => count >= RUNNING_LINE_REPEAT_THRESHOLD).map(([key]) => key),
  )
  if (running.size === 0) return text

  const kept = lines.filter((line) => {
    const key = normalizeLineForFrequency(line)
    if (key.length < 3 || key.length > RUNNING_LINE_MAX_LEN) return true
    return !running.has(key)
  })
  return kept.join('\n')
}

export function scrubKbExtractionArtifacts(html: string): string {
  if (!html) return html
  let out = html
  out = out.replace(PAGE_NUMBER_EN_RE, ' ')
  out = out.replace(PAGE_NUMBER_ID_RE, ' ')
  out = out.replace(CLASSIFICATION_RE, ' ')
  // Run twice: removing a page-number can leave the trailing heading adjacent to the close tag.
  out = out.replace(TRAILING_SECTION_HEADING_RE, '')
  out = out.replace(TRAILING_SECTION_HEADING_RE, '')
  // Collapse whitespace introduced by removals and tidy space before punctuation / close tags.
  out = out.replace(/[ \t ]{2,}/g, ' ')
  out = out.replace(/\s+([.,;:)])/g, '$1')
  out = out.replace(/\s+<\/(li|p|td|th|h[1-3])>/gi, '</$1>')
  return out
}
