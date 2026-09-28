/**
 * Board Note as a status label plus numbered points. Mirrors agent-runtime
 * orchestrator/board_note_format.py, so notes generated before that change
 * (one paragraph, e.g. "WATCH: Lanjutkan …") render as a list too.
 */
const STATUS_RE = /^\s*\**\s*(WATCH|GO|NO[\s-]?GO|HOLD|PROCEED|CAUTION|STOP)\s*\**\s*[:\-–—]\s*/i
const LIST_MARKER_RE = /^\s*(?:\d+[.)]|[-*•])\s+/
const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=[A-Z0-9(])/
const MAX_POINTS = 4

export type BoardNote = { status: string; lead: string; points: string[] }

export function boardNotePoints(text: string | null | undefined): BoardNote {
  let body = (text ?? '').trim()
  let status = ''
  const match = STATUS_RE.exec(body)
  if (match) {
    status = match[1].toUpperCase().replace(/\s+/g, '-')
    body = body.slice(match[0].length).trim()
  }
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean)
  // A written list ("fokus pada:" then "1. …", "2. …"): an intro line stays a lead
  // sentence above the list, it is never split into points of its own.
  if (lines.some((l) => LIST_MARKER_RE.test(l))) {
    const lead: string[] = []
    const points: string[] = []
    for (const line of lines) {
      if (LIST_MARKER_RE.test(line)) points.push(line.replace(LIST_MARKER_RE, '').trim())
      else if (points.length) points[points.length - 1] += ` ${line}`
      else lead.push(line)
    }
    return { status, lead: lead.join(' '), points: points.filter(Boolean).slice(0, MAX_POINTS) }
  }
  const points = body.replace(/\s+/g, ' ').split(SENTENCE_SPLIT_RE).map((p) => p.trim()).filter(Boolean)
  return { status, lead: '', points: points.slice(0, MAX_POINTS) }
}
