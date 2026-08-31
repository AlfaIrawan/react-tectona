import { splitMermaidContent } from '@/lib/chat/normalizeMermaidFences'

export type ProcessDiagramKind = 'as_is' | 'to_be' | 'unlabeled'

export type ExtractedProcessDiagram = {
  kind: ProcessDiagramKind
  label: string
  source: string
}

const AS_IS_RE = /\b(as[\s-]?is|proses\s+saat\s+ini|kondisi\s+saat\s+ini)\b/i
const TO_BE_RE = /\b(to[\s-]?be|proses\s+target|kondisi\s+target|expected|diharapkan)\b/i

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
  const base =
    kind === 'as_is' ? 'AS-IS' : kind === 'to_be' ? 'TO-BE' : 'Diagram proses bisnis'
  return counts[kind] > 1 ? `${base} #${index}` : base
}

/** Extract Mermaid process diagrams from idea description / brainstorm draft text. */
export function extractProcessDiagramsFromText(text: string): ExtractedProcessDiagram[] {
  const input = (text || '').replace(/\r\n?/g, '\n')
  if (!input.trim()) return []

  const commentSources: string[] = []
  const commentRe = /<!--tectona-mermaid\s*\r?\n([\s\S]*?)-->/gi
  let commentMatch: RegExpExecArray | null
  while ((commentMatch = commentRe.exec(input)) !== null) {
    const source = (commentMatch[1] || '').trim()
    if (source) commentSources.push(source)
  }

  const segments = splitMermaidContent(input)
  const results: ExtractedProcessDiagram[] = []
  let cursor = 0
  const seen = new Set<string>()

  for (const source of commentSources) {
    const key = source.replace(/\s+/g, ' ').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    results.push({ kind: 'unlabeled', label: '', source })
  }

  for (const segment of segments) {
    if (segment.type === 'prose') {
      cursor = input.indexOf(segment.text, cursor)
      if (cursor >= 0) cursor += segment.text.length
      continue
    }
    if (segment.type !== 'mermaid') continue

    const source = segment.source.trim()
    if (!source) continue
    const key = source.replace(/\s+/g, ' ').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const fenceIdx = input.toLowerCase().indexOf('```mermaid', Math.max(0, cursor - 200))
    const prefix = fenceIdx >= 0 ? input.slice(Math.max(0, fenceIdx - 500), fenceIdx) : input.slice(0, cursor)
    const kind = classifyPrefix(prefix)
    results.push({ kind, label: '', source })
    cursor = fenceIdx >= 0 ? fenceIdx + 10 : cursor + source.length
  }

  const counts: Record<ProcessDiagramKind, number> = { as_is: 0, to_be: 0, unlabeled: 0 }
  for (const item of results) counts[item.kind] += 1
  const counters: Record<ProcessDiagramKind, number> = { as_is: 0, to_be: 0, unlabeled: 0 }
  return results.map((item) => {
    counters[item.kind] += 1
    return {
      ...item,
      label: labelFor(item.kind, counters[item.kind], counts),
    }
  })
}
