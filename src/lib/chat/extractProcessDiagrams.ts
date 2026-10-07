export type ProcessDiagramKind = 'as_is' | 'to_be' | 'c4' | 'class' | 'erd' | 'unlabeled'
export type TechnicalDiagramKind = 'c4' | 'class' | 'erd'

export type ExtractedProcessDiagram = {
  kind: ProcessDiagramKind
  label: string
  source: string
}

const DIAGRAM_FENCE_RE = /```[ \t]*(?:mermaid|plantuml|tecchart|bpmn)\b[ \t]*\r?\n?[\s\S]*?```/gi
const PROCESS_FENCE_RE = /```[ \t]*(?:mermaid|plantuml)\b[ \t]*\r?\n?([\s\S]*?)```/gi
const TECTONA_DIAGRAM_COMMENT_RE = /<!--tectona-mermaid\b[\s\S]*?-->/gi
const TECTONA_ENCODED_DIAGRAM_COMMENT_RE = /<!--tectona-process-diagram:(?:(as_is|to_be|c4|class|erd|unlabeled):)?([^>]+)-->/gi
const STORED_DIAGRAM_KINDS = new Set<ProcessDiagramKind>(['as_is', 'to_be', 'c4', 'class', 'erd', 'unlabeled'])

function storedDiagramKind(raw: string | undefined): ProcessDiagramKind {
  return raw && STORED_DIAGRAM_KINDS.has(raw as ProcessDiagramKind) ? raw as ProcessDiagramKind : 'unlabeled'
}

function emptyKindCounts(): Record<ProcessDiagramKind, number> {
  return { as_is: 0, to_be: 0, c4: 0, class: 0, erd: 0, unlabeled: 0 }
}

const AS_IS_RE = /\b(as[\s-]?is|proses\s+saat\s+ini|kondisi\s+saat\s+ini)\b/i
const TO_BE_RE = /\b(to[\s-]?be|proses\s+target|kondisi\s+target|expected|diharapkan)\b/i
const NON_PROCESS_DIAGRAM_RE = /!include\s*<\s*(?:c4|archimate)|tectona-view:|tectona-dimension:|^\s*(?:class|entity)\b/im

function classifyPrefix(prefix: string): ProcessDiagramKind {
  const window = prefix.slice(-500)
  const asMatches = [...window.matchAll(new RegExp(AS_IS_RE.source, 'gi'))]
  const toMatches = [...window.matchAll(new RegExp(TO_BE_RE.source, 'gi'))]
  const asIs = asMatches.length > 0
  const toBe = toMatches.length > 0
  if (asIs && !toBe) return 'as_is'
  if (toBe && !asIs) return 'to_be'
  if (asIs && toBe) {
    const asPos = Math.max(...asMatches.map((m) => (m.index ?? -1) + m[0].length))
    const toPos = Math.max(...toMatches.map((m) => (m.index ?? -1) + m[0].length))
    return toPos >= asPos ? 'to_be' : 'as_is'
  }
  return 'unlabeled'
}

function labelFor(kind: ProcessDiagramKind, index: number, counts: Record<ProcessDiagramKind, number>): string {
  const base = kind === 'as_is' ? 'AS-IS'
    : kind === 'to_be' ? 'TO-BE'
      : kind === 'c4' ? 'C4'
        : kind === 'class' ? 'Class'
          : kind === 'erd' ? 'ERD'
            : 'Diagram proses bisnis'
  return counts[kind] > 1 ? `${base} #${index}` : base
}

export function technicalDiagramKind(source: string): TechnicalDiagramKind | null {
  const text = source || ''
  if (/tectona-view:\s*erd/i.test(text) || /^\s*entity\s+/m.test(text)) return 'erd'
  if (/tectona-view:\s*class/i.test(text) || /^\s*class\s+/m.test(text)) return 'class'
  if (/!include\s*<\s*C4\/|tectona-view:\s*c4/i.test(text)) return 'c4'
  return null
}

export function brainstormProcessPersistKey(label: string, index: number): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `brainstorm-${slug || `diagram-${index + 1}`}`
}

export function isBusinessProcessSource(source: string): boolean {
  const text = (source || '').trim()
  if (!text || NON_PROCESS_DIAGRAM_RE.test(text)) return false
  return /process_start|\(\)\s+"|^\s*start\b|^\s*(?:flowchart|graph)\s+|rectangle\s+"/im.test(text)
}

/** Extract canonical PlantUML and legacy Mermaid diagrams from idea text. */
export function extractProcessDiagramsFromText(text: string): ExtractedProcessDiagram[] {
  const input = (text || '').replace(/\r\n?/g, '\n')
  if (!input.trim()) return []

  const commentSources: Array<{ source: string; kind: ProcessDiagramKind }> = []
  let encodedCommentMatch: RegExpExecArray | null
  while ((encodedCommentMatch = TECTONA_ENCODED_DIAGRAM_COMMENT_RE.exec(input)) !== null) {
    try {
      const source = decodeURIComponent(encodedCommentMatch[2] || '').trim()
      const kind = storedDiagramKind(encodedCommentMatch[1])
      if (source) commentSources.push({ source, kind })
    } catch {
      // Ignore malformed hidden diagram metadata.
    }
  }

  const commentRe = /<!--tectona-mermaid\s*\r?\n([\s\S]*?)-->/gi
  let commentMatch: RegExpExecArray | null
  while ((commentMatch = commentRe.exec(input)) !== null) {
    const source = (commentMatch[1] || '').trim()
    if (source) commentSources.push({ source, kind: 'unlabeled' })
  }

  const results: ExtractedProcessDiagram[] = []
  const seen = new Set<string>()

  let fenceMatch: RegExpExecArray | null
  while ((fenceMatch = PROCESS_FENCE_RE.exec(input)) !== null) {
    const source = (fenceMatch[1] || '').trim()
    if (!source) continue
    const key = source.replace(/\s+/g, ' ').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const kind = classifyPrefix(input.slice(Math.max(0, fenceMatch.index - 500), fenceMatch.index))
    results.push({ kind, label: '', source })
  }

  for (const comment of commentSources) {
    const key = comment.source.replace(/\s+/g, ' ').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    results.push({ kind: comment.kind, label: '', source: comment.source })
  }

  const counts = emptyKindCounts()
  for (const item of results) counts[item.kind] += 1
  const counters = emptyKindCounts()
  return results.map((item) => {
    counters[item.kind] += 1
    return {
      ...item,
      label: labelFor(item.kind, counters[item.kind], counts),
    }
  })
}

/**
 * The gallery should not list every sketch from brainstorming. Keep the last
 * business-process picture of each lane. A later unlabeled revision replaces
 * the lane that was just being drawn.
 */
function headingLanes(text: string): Array<'as_is' | 'to_be'> {
  const prose = text.split('<!--tectona-process-diagram:')[0] ?? text
  const lanes: Array<'as_is' | 'to_be'> = []
  for (const line of prose.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.length > 180) continue
    const kind = classifyPrefix(trimmed)
    if (kind === 'as_is' || kind === 'to_be') lanes.push(kind)
  }
  return lanes
}

export function latestRevisedProcessDiagrams(text: string): ExtractedProcessDiagram[] {
  const latest: Partial<Record<'as_is' | 'to_be', ExtractedProcessDiagram>> = {}
  let openLane: 'as_is' | 'to_be' | null = null
  let headingIndex = 0
  const headings = headingLanes(text)
  for (const diagram of extractProcessDiagramsFromText(text)) {
    if (!isBusinessProcessSource(diagram.source)) continue
    let lane: 'as_is' | 'to_be' | null = diagram.kind === 'as_is' || diagram.kind === 'to_be' ? diagram.kind : null
    if (!lane && headingIndex < headings.length) lane = headings[headingIndex++] ?? null
    if (!lane) lane = openLane
    if (lane !== 'as_is' && lane !== 'to_be') continue
    openLane = lane
    latest[lane] = { ...diagram, kind: lane, label: lane === 'as_is' ? 'AS-IS' : 'TO-BE' }
  }
  return [latest.as_is, latest.to_be].filter((diagram): diagram is ExtractedProcessDiagram => Boolean(diagram))
}

const TECHNICAL_LABEL: Record<TechnicalDiagramKind, string> = {
  c4: 'C4',
  class: 'Class',
  erd: 'ERD',
}

/** Last confirmed C4, class, and ERD picture from brainstorming. Earlier sketches are dropped. */
export function latestValidatedTechnicalDiagrams(text: string): ExtractedProcessDiagram[] {
  const latest: Partial<Record<TechnicalDiagramKind, ExtractedProcessDiagram>> = {}
  for (const diagram of extractProcessDiagramsFromText(text)) {
    const kind = diagram.kind === 'c4' || diagram.kind === 'class' || diagram.kind === 'erd'
      ? diagram.kind
      : technicalDiagramKind(diagram.source)
    if (!kind) continue
    latest[kind] = { ...diagram, kind, label: TECHNICAL_LABEL[kind] }
  }
  return [latest.c4, latest.class, latest.erd].filter((diagram): diagram is ExtractedProcessDiagram => Boolean(diagram))
}

/** Remove diagram implementation text from prose that is shown in a rich-text editor. */
export function stripProcessDiagramsFromText(text: string): string {
  return (text || '')
    .replace(TECTONA_ENCODED_DIAGRAM_COMMENT_RE, '')
    .replace(TECTONA_DIAGRAM_COMMENT_RE, '')
    .replace(DIAGRAM_FENCE_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Keep diagrams in the persisted draft without exposing their source to the editor. */
export function appendProcessDiagramsToText(
  prose: string,
  diagrams: Array<Pick<ExtractedProcessDiagram, 'source'> & { kind?: ProcessDiagramKind }>,
): string {
  const seen = new Set<string>()
  const sources = diagrams
    .filter((diagram) => {
      const source = diagram.source.trim()
      if (!source) return false
      const key = source.replace(/\s+/g, ' ').toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((diagram) => {
      const kind = storedDiagramKind(diagram.kind)
      return `<!--tectona-process-diagram:${kind}:${encodeURIComponent(diagram.source.trim())}-->`
    })

  return [stripProcessDiagramsFromText(prose), ...sources].filter(Boolean).join('\n\n').trim()
}
