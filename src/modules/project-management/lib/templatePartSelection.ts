import type { DocumentRevisionFillPayload, TemplateAgentSchema } from '@/lib/api/documentKnowledgeApi'

/**
 * Regenerating a document part by part: each part of the template is kept as it is now, taken from
 * an earlier version, or generated again. Only the last kind goes to the model (only_keys); the
 * rest is merged back from the chosen versions before the document service writes the file.
 */

/** Keys the agent runtime sets in code on every generation (orchestrator/document_title_fills.py). */
const SYSTEM_KEY_PATTERNS = [
  /^(?:judul(?:_[a-z0-9]+)?|title|document_title|doc_title|project_?name|business_process_name|nama_proyek(?:_project_name)?|nama_project)$/,
  /^(?:idea_owner(?:_name)?|nama_idea_owner|pemilik_idea|nama_pemilik_idea|nama_pembuat_idea)$/,
  /^(?:job_title|jabatan|idea_owner_job_title|jabatan_idea_owner|jabatan_pemilik_idea)$/,
  /^(?:year|tahun)$/,
  /^(?:docnum|doc_num|document_number_id|nomor_dokumen_id)$/,
  /^(?:version|versi|doc_version|docversion|document_version|versi_dokumen)$/,
]

export function isSystemFilledKey(key: string): boolean {
  const normalized = key.trim().toLowerCase()
  return SYSTEM_KEY_PATTERNS.some((pattern) => pattern.test(normalized))
}

export type TemplatePartKind = 'field' | 'section' | 'table'
export type TemplatePart = {
  key: string
  label: string
  kind: TemplatePartKind
  /** Where the template puts it, when the schema knows (a field's table row, a repeater's table). */
  location?: { table_index?: number; row_index?: number } | null
  /** A table part's column fields, in order. */
  fields?: string[]
}
/** 'keep': the current version's value. A number: that version's value. 'draft': the text a reviewer
 * accepted from a comment proposal (see PartCommentRail), written as is. */
export type TemplatePartChoice = 'keep' | 'generate' | 'draft' | number

/** Parts a comment proposal can rewrite: text parts. A table's rows are not revised by comment yet. */
export function partTakesComments(part: TemplatePart): boolean {
  return part.kind === 'field' || part.kind === 'section'
}

export type PartPayload = Pick<DocumentRevisionFillPayload, 'fills' | 'sections' | 'collections' | 'diagrams'>

function readableName(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, (first) => first.toUpperCase())
}

/** The parts a user can choose for: fields, sections and top-level tables; system fields are left out. */
export function templateParts(schema: TemplateAgentSchema | null | undefined): TemplatePart[] {
  const parts: TemplatePart[] = []
  const seen = new Set<string>()
  const add = (part: TemplatePart) => {
    if (!part.key || seen.has(part.key)) return
    seen.add(part.key)
    parts.push(part)
  }
  for (const item of schema?.placeholders ?? []) {
    const key = String(item?.key ?? '').trim()
    if (key && !isSystemFilledKey(key)) {
      const location = item.location && typeof item.location.table_index === 'number' ? item.location : null
      add({ key, label: String(item.label || readableName(key)), kind: 'field', location })
    }
  }
  for (const item of schema?.sections ?? []) {
    const key = String(item?.id ?? '').trim()
    if (key) add({ key, label: String(item.heading || readableName(key)), kind: 'section' })
  }
  for (const item of schema?.repeaters ?? []) {
    const key = String(item?.collection || item?.id || '').trim()
    if (key && !item.parent_collection) {
      add({ key, label: readableName(key), kind: 'table', location: item.location ?? null, fields: item.fields ?? [] })
    }
  }
  return parts
}

/** The part's value in a version's payload; undefined when that version has none. */
export function partValue(part: TemplatePart, payload: PartPayload | undefined): unknown {
  if (!payload) return undefined
  if (part.kind === 'field') {
    const value = payload.fills?.[part.key]
    return typeof value === 'string' && value.trim() ? value : undefined
  }
  if (part.kind === 'section') {
    const value = payload.sections?.[part.key]
    return typeof value === 'string' && value.trim() ? value : undefined
  }
  const rows = payload.collections?.[part.key]
  return Array.isArray(rows) && rows.length > 0 ? rows : undefined
}

export type PartPreview =
  | { kind: 'text'; text: string; diagram: boolean }
  | { kind: 'table'; columns: string[]; rows: string[][] }

function plainText(html: string): string {
  return html
    .replace(/<(?:br|\/p|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return plainText(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `${value.length} item`
  return ''
}

/** What a version holds for the part, readable: text for fields and sections, rows for tables. */
export function partPreview(part: TemplatePart, payload: PartPayload | undefined): PartPreview | undefined {
  const value = partValue(part, payload)
  if (value === undefined) return undefined
  if (part.kind !== 'table') {
    const text = plainText(String(value))
    return text ? { kind: 'text', text, diagram: Boolean(part.kind === 'field' && payload?.diagrams?.[part.key]) } : undefined
  }
  const records = (value as unknown[]).filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row))
  const columns: string[] = []
  for (const record of records) {
    for (const [key, cell] of Object.entries(record)) {
      // Nested tables (a use case's steps) are counted, not drawn.
      if (!columns.includes(key) && !(Array.isArray(cell) && cell.length === 0)) columns.push(key)
    }
  }
  return {
    kind: 'table',
    columns: columns.map(readableName),
    rows: records.map((record) => columns.map((key) => cellText(record[key]))),
  }
}

/** One line for the collapsed row. */
export function partPreviewSummary(preview: PartPreview): string {
  if (preview.kind === 'text') return `${preview.diagram ? 'Diagram · ' : ''}${preview.text.replace(/\n+/g, ' · ')}`
  const first = preview.rows[0]?.find((cell) => cell.trim()) ?? ''
  return `${preview.rows.length} baris${first ? ` · ${first}` : ''}`
}

/** Keep what the current version has; generate what it lacks. */
export function defaultPartChoices(
  parts: TemplatePart[],
  current: PartPayload | undefined,
): Record<string, TemplatePartChoice> {
  return Object.fromEntries(parts.map((part) => [part.key, partValue(part, current) === undefined ? 'generate' : 'keep']))
}

export function keysToGenerate(parts: TemplatePart[], choices: Record<string, TemplatePartChoice>): string[] {
  return parts.filter((part) => (choices[part.key] ?? 'generate') === 'generate').map((part) => part.key)
}

/** The version numbers whose payloads the merge reads. */
export function versionsNeeded(
  parts: TemplatePart[],
  choices: Record<string, TemplatePartChoice>,
  currentVersion: number,
): number[] {
  const versions = new Set<number>()
  for (const part of parts) {
    const choice = choices[part.key] ?? 'generate'
    if (choice === 'keep') versions.add(currentVersion)
    else if (typeof choice === 'number') versions.add(choice)
  }
  return [...versions].sort((a, b) => a - b)
}

/**
 * The payload to write: the generated parts as the model wrote them (with the fields set in code),
 * every other part from the version chosen for it. `missing` lists parts the chosen version lacks.
 */
export function mergePartChoices(input: {
  parts: TemplatePart[]
  choices: Record<string, TemplatePartChoice>
  currentVersion: number
  generated: PartPayload
  payloads: Record<number, PartPayload | undefined>
  /** Accepted comment texts, by part key (for choice 'draft'). */
  drafts?: Record<string, string>
}): { payload: PartPayload; missing: TemplatePart[] } {
  const fills = { ...(input.generated.fills ?? {}) }
  const sections = { ...(input.generated.sections ?? {}) }
  const collections = { ...(input.generated.collections ?? {}) }
  const diagrams = { ...(input.generated.diagrams ?? {}) }
  const missing: TemplatePart[] = []
  for (const part of input.parts) {
    const choice = input.choices[part.key] ?? 'generate'
    if (choice === 'generate') continue
    if (choice === 'draft') {
      const draft = input.drafts?.[part.key]
      if (!draft?.trim() || !partTakesComments(part)) {
        missing.push(part)
      } else if (part.kind === 'field') {
        fills[part.key] = draft
        // The reviewed text replaces any picture the field had.
        delete diagrams[part.key]
      } else {
        sections[part.key] = draft
      }
      continue
    }
    const version = choice === 'keep' ? input.currentVersion : choice
    const source = input.payloads[version]
    const value = partValue(part, source)
    if (value === undefined) {
      missing.push(part)
      continue
    }
    if (part.kind === 'field') {
      fills[part.key] = value as string
      // A kept diagram field keeps its picture too, when that version stored it.
      const picture = source?.diagrams?.[part.key]
      if (picture) diagrams[part.key] = picture
      else delete diagrams[part.key]
    } else if (part.kind === 'section') {
      sections[part.key] = value as string
    } else {
      collections[part.key] = value
    }
  }
  return { payload: { fills, sections, collections, diagrams }, missing }
}
