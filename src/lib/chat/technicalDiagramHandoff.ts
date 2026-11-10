import { isBusinessProcessSource, stripAttachedProcessCaptions, technicalDiagramKind } from './extractProcessDiagrams'
/** Source retention is not review authority. This helper never reads chat history. */
export type SelectedDiagramSource = {
  source: string
  language: string
  topic?: string
  kind?: string
  provenance: 'selected-text' | 'server-result' | 'server-version' | 'local-unverified'
  reviewedRepresentation: boolean
  shownContext?: string
}

export type SelectedDescription =
  | { ok: true; prose: string; sources: SelectedDiagramSource[]; html?: string; notice?: string }
  | { ok: false; reason: string }

const fence = /```[ \t]*(plantuml|mermaid|bpmn|tecchart)[ \t]*\r?\n([\s\S]*?)```/gi
const encoded = /<!--tectona-process-diagram:(?:(as_is|to_be|c4|class|erd|use-case|sequence|unlabeled):)?([^>]+)-->/gi

/** Keep each selected occurrence and exact internal bytes; no latest-by-kind collapse. */
export function prepareSelectedDescription(text: string, html?: string): SelectedDescription {
  // HTML-held source/images require explicit recovery, not sanitization before validation.
  if (html && /<(?:pre|img|iframe|svg|object|embed)\b|<!--/i.test(html)) {
    return { ok: false, reason: 'This saved HTML contains embedded content. Its original text and selection were kept; recover the embedded source before replacing them.' }
  }
  const matches: Array<{ start: number; end: number; source: string; language: string; kind?: string; topic?: string; shownContext?: string }> = []
  for (const match of text.matchAll(fence)) {
    const start = match.index!
    let kind: string | undefined
    if (isBusinessProcessSource(match[2])) {
      const prefix = text.slice(0, start)
      const lines = [...prefix.matchAll(/^[^\r\n]*(?:\r?\n|$)/gm)]
      for (const line of lines.reverse()) {
        const normalized = line[0].trim().replace(/^#{1,6}\s*/, '').replace(/\*\*|__/g, '').replace(/:\s*$/, '').trim()
        if (!normalized) continue
        const candidate = /^AS[ -]?IS$/i.test(normalized) ? 'as_is' : /^TO[ -]?BE$/i.test(normalized) ? 'to_be' : undefined
        if (!candidate || (kind && kind !== candidate)) break
        kind = candidate
      }
    }
    matches.push({ start, end: match.index! + match[0].length, source: match[2], language: match[1].toLowerCase(), kind })
  }
  for (const match of text.matchAll(encoded)) {
    try {
      matches.push({ start: match.index!, end: match.index! + match[0].length, source: decodeURIComponent(match[2]), language: detectRetainedSourceLanguage(decodeURIComponent(match[2])), kind: match[1] })
    } catch {
      return { ok: false, reason: 'A saved diagram attachment is malformed. The original text and selection were kept.' }
    }
  }
  for (const match of text.matchAll(/<!--tectona-source-reference:([^>]+)-->/g)) {
    try {
      const value = JSON.parse(decodeURIComponent(match[1])) as { version?: unknown; source?: unknown; language?: unknown; topic?: unknown; kind?: unknown; shownContext?: unknown }
      if (value.version !== 1 || typeof value.source !== 'string' || typeof value.language !== 'string') throw new Error('Invalid source')
      matches.push({ start: match.index!, end: match.index! + match[0].length, source: value.source, language: value.language,
        topic: typeof value.topic === 'string' ? value.topic : undefined, kind: typeof value.kind === 'string' ? value.kind : undefined, shownContext: typeof value.shownContext === 'string' ? value.shownContext : undefined })
    } catch { return { ok: false, reason: 'A saved source reference is malformed. Original text and selection were kept.' } }
  }
  matches.sort((a, b) => a.start - b.start)
  const sources: SelectedDiagramSource[] = []
  let prose = '', position = 0
  for (const match of matches) {
    if (match.start < position) return { ok: false, reason: 'Overlapping diagram attachments require recovery before replacing the selection.' }
    const boundedSegment = stripAttachedProcessCaptions(text.slice(position, match.end))
    prose += boundedSegment.slice(0, -(match.end - match.start))
    position = match.end
    const topic = match.topic ?? match.source.match(/^\s*'\s*tectona-dimension:\s*([a-z0-9_]+)\s*$/m)?.[1]
    const kind = match.source.match(/^\s*'\s*tectona-view:\s*([a-z0-9_-]+)\s*$/m)?.[1] ?? match.kind ?? technicalDiagramKind(match.source) ?? (/^\s*erDiagram\b/.test(match.source) ? 'erd' : /^\s*classDiagram\b/.test(match.source) ? 'class' : undefined)
    sources.push({ source: match.source, language: match.language, topic, kind, provenance: 'selected-text', reviewedRepresentation: false, ...(match.shownContext ? { shownContext: match.shownContext } : {}) })
  }
  prose += text.slice(position)
  let contextError = false
  prose = prose.replace(/<!--tectona-source-context:([^>]+)-->/g, (whole, value: string) => {
    try {
      const item = JSON.parse(decodeURIComponent(value)) as { index: number; source: string; context: string }
      if (!Number.isInteger(item.index) || !sources[item.index] || sources[item.index].source !== item.source || typeof item.context !== 'string') throw new Error('Unbound context')
      sources[item.index].shownContext = item.context
      return ''
    } catch { contextError = true; return whole }
  })
  if (contextError) return { ok: false, reason: 'Saved diagram context is not bound to its source. Original selection was kept for recovery.' }
  // Unknown fence languages are left in prose, never discarded or rendered as BPMN.
  return { ok: true, prose, sources, html }
}
/** Description metadata is unverified provenance, never an approval token. */
export const readSelectedSourceReferences = prepareSelectedDescription

export function serializeSelectedSources(prose: string, sources: SelectedDiagramSource[]): string {
  return [prose, ...sources.map(({ source, language, topic, kind, shownContext }, index) => {
    if (kind && ['as_is', 'to_be', 'c4', 'class', 'erd', 'use-case', 'sequence'].includes(kind) && (!topic || source.match(/^\s*'\s*tectona-dimension:\s*([a-z0-9_]+)\s*$/m)?.[1] === topic)) {
      return `<!--tectona-process-diagram:${kind}:${encodeURIComponent(source)}-->` + (shownContext ? `\n<!--tectona-source-context:${encodeURIComponent(JSON.stringify({ index, source, context: shownContext }))}-->` : '')
    }
    // Topic-bearing and unsupported references remain distinct and read-only.
    return `<!--tectona-source-reference:${encodeURIComponent(JSON.stringify({ version: 1, source, language, topic, kind, shownContext }))}-->`
  })].join('\n\n')
}

export type HandoffMode = 'completed' | 'version' | 'resume' | 'assistance' | 'manual'
export function prepareDiagramHandoff(input: {
  text: string; html?: string; mode: HandoffMode
  existing?: SelectedDiagramSource[]
  records?: import('@/lib/api/tectonaAgentRuntimeApi').TechnicalDiagramRecord[]
  status?: 'available' | 'none' | 'unavailable'
}): SelectedDescription {
  const parsed = prepareSelectedDescription(input.text, input.html)
  if (!parsed.ok) return parsed
  if (input.mode === 'completed' && input.status !== 'available' && input.status !== 'none') {
    return { ok: false, reason: 'This completed draft has no verified technical-diagram handoff. Your current text and selected diagrams were kept; regenerate or recover the saved sources.' }
  }
  let sources = parsed.sources
  if (input.mode === 'assistance' && sources.length === 0) sources = input.existing?.map(source => ({ ...source })) ?? []
  if (input.mode === 'resume') sources = sources.map(source => ({ ...source, provenance: 'local-unverified', reviewedRepresentation: false }))
  if (input.mode === 'completed' || input.mode === 'version') {
    // Only the caller's selected server result/version can provide these records.
    // No record is read from HTML, comments, local storage or newer job history.
    for (const record of input.records ?? []) {
      if (record.schema_version !== 1 || record.outcome !== 'affirmed' || record.meaning !== 'reviewed_representation_not_production_approval' || !record.review || !record.source || !record.topic) {
        return { ok: false, reason: 'The selected server diagram handoff is incomplete. Existing text and selection were kept.' }
      }
      const entry: SelectedDiagramSource = { source: record.source, language: 'plantuml', topic: record.topic, kind: record.kind,
        provenance: input.mode === 'version' ? 'server-version' : 'server-result', reviewedRepresentation: true, shownContext: record.shown_context }
      const found = sources.findIndex(source => source.source.trim() === record.source && source.topic === record.topic)
      if (found >= 0) sources = sources.map((source, index) => index === found ? { ...entry, source: source.source } : source)
      else sources = [...sources, entry]
    }
  }
  return { ...parsed, sources, ...(input.mode === 'version' && input.status !== 'available' ? { notice: 'This saved version has no verified diagram metadata. Its own text and sources were restored as unverified; newer history was not used.' } : {}) }
}
export function detectRetainedSourceLanguage(source: string): string {
  if (/^\s*@startuml\b/i.test(source)) return 'plantuml'
  if (/^\s*(?:flowchart|graph|sequenceDiagram|classDiagram|erDiagram)\b/i.test(source)) return 'mermaid'
  if (/^\s*(?:<\?xml[\s\S]*?\?>\s*)?<(?:[\w-]+:)?definitions\b/i.test(source)) return 'bpmn'
  return 'unknown'
}

export function supportsReadOnlyPlantUmlPreview(source: SelectedDiagramSource): boolean {
  return source.language === 'plantuml' && detectRetainedSourceLanguage(source.source) === 'plantuml'
    && ['as_is', 'to_be', 'bpmn', 'c4', 'class', 'erd', 'use-case', 'sequence', 'archimate'].includes(source.kind || '')
}

export function supportsReadOnlyTechnicalPreview(source: SelectedDiagramSource): boolean {
  if (supportsReadOnlyPlantUmlPreview(source)) return true
  return source.language === 'mermaid' && detectRetainedSourceLanguage(source.source) === 'mermaid'
    && /^\s*(?:classDiagram|erDiagram|sequenceDiagram)\b/.test(source.source)
    && ['class', 'erd', 'sequence'].includes(source.kind || '')
}
