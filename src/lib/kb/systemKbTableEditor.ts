export type SystemKbTableSpecId =
  | 'istilah'
  | 'singkatan'
  | 'aplikasi'
  | 'raci'
  | 'proses_as_is'
  | 'penyebutan'
  | 'org_overlay'
  | 'app_notes'

export type SystemKbTableColumn = {
  key: string
  label: string
  aliases?: string[]
}

export type SystemKbTableSpec = {
  id: SystemKbTableSpecId
  title: string
  titlePattern: RegExp
  intro: string
  columns: SystemKbTableColumn[]
}

export type SystemKbTableEditModel = {
  specId: SystemKbTableSpecId
  intro: string
  rows: Array<Record<string, string>>
}

export const SYSTEM_KB_TABLE_SPECS: SystemKbTableSpec[] = [
  {
    id: 'istilah',
    title: 'Glossary (Default)',
    titlePattern: /^(?:list istilah|glossary|list of terms)(?: \(default\))?$/i,
    intro: 'Business glossary for this workspace. Add term rows in the table. Turn off Use for AI if an official glossary is already connected.',
    columns: [
      { key: 'term', label: 'Term', aliases: ['Istilah'] },
      { key: 'definition', label: 'Definition', aliases: ['Definisi'] },
      { key: 'context', label: 'Context', aliases: ['Konteks'] },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    id: 'singkatan',
    title: 'Abbreviation List (Default)',
    titlePattern: /^(?:list singkatan|abbreviation list)(?: \(default\))?$/i,
    intro: 'Operational acronyms. Keep this separate from the term glossary. Turn off Use for AI if abbreviations are managed in another system.',
    columns: [
      { key: 'abbr', label: 'Abbreviation', aliases: ['Singkatan'] },
      { key: 'expansion', label: 'Expanded form', aliases: ['Kepanjangan'] },
      { key: 'domain', label: 'Domain' },
      { key: 'not_confused_with', label: 'Do not confuse with', aliases: ['Jangan disamakan dengan'] },
    ],
  },
  {
    id: 'aplikasi',
    title: 'Application Catalog (Default)',
    titlePattern: /^(?:katalog aplikasi|application catalog)(?: \(default\))?$/i,
    intro: 'Application catalog for this workspace. List systems the team uses. Turn off Use for AI when Application Portfolio Monitoring is connected.',
    columns: [
      { key: 'name', label: 'Name', aliases: ['Nama'] },
      { key: 'type', label: 'Type', aliases: ['Tipe'] },
      { key: 'owner', label: 'Owner' },
      { key: 'status', label: 'Status' },
      { key: 'notes', label: 'Notes', aliases: ['Catatan'] },
    ],
  },
  {
    id: 'raci',
    title: 'Stakeholder & RACI (Default)',
    titlePattern: /^stakeholder & raci(?: \(default\))?$/i,
    intro: 'RACI for this workspace — not an HR list. Record who is Accountable or Responsible for ideas, documents, and decisions. Turn off Use for AI if RACI already lives in another system.',
    columns: [
      { key: 'name', label: 'Name or role', aliases: ['Nama atau peran'] },
      { key: 'raci', label: 'RACI' },
      { key: 'area', label: 'Area' },
      { key: 'decision', label: 'Decisions owned', aliases: ['Keputusan yang dipegang'] },
    ],
  },
  {
    id: 'proses_as_is',
    title: 'AS-IS Process List (Default)',
    titlePattern: /^(?:daftar proses as-is|as-is process list)(?: \(default\))?$/i,
    intro: 'AS-IS process names (not full SOPs). Link each process to applications and pain points from Idea Intake. Turn off Use for AI if BPM or process mining is the source of truth.',
    columns: [
      { key: 'process', label: 'Process name', aliases: ['Nama proses'] },
      { key: 'owner', label: 'Process owner', aliases: ['Pemilik proses'] },
      { key: 'apps', label: 'Related applications', aliases: ['Aplikasi terkait'] },
      { key: 'pain', label: 'Pain point' },
    ],
  },
  {
    id: 'penyebutan',
    title: 'Naming Rules (Default)',
    titlePattern: /^(?:aturan penyebutan|naming rules)(?: \(default\))?$/i,
    intro: 'Official naming and spelling so AI output stays consistent. Example: company names, product names, and abbreviations that must not be invented.',
    columns: [
      { key: 'official', label: 'Official name', aliases: ['Sebutan resmi'] },
      { key: 'avoid', label: 'Do not write', aliases: ['Jangan tulis'] },
      { key: 'context', label: 'Context', aliases: ['Konteks'] },
      { key: 'notes', label: 'Notes', aliases: ['Catatan'] },
    ],
  },
  {
    id: 'org_overlay',
    title: 'Org Context (Default)',
    titlePattern: /^(?:org context|konteks org)(?: \(default\))?$/i,
    intro: 'Overlay on Workspace Org — not an HR directory. Record aliases, expertise, and topics to avoid for people or units that already exist in org. Leave empty if org data is enough.',
    columns: [
      { key: 'org_ref', label: 'Org ref', aliases: ['Referensi org', 'Nama atau unit'] },
      { key: 'alias', label: 'Alias' },
      { key: 'expertise', label: 'Expertise' },
      { key: 'do_not_contact_for', label: 'Do not contact for', aliases: ['Jangan dihubungi untuk'] },
    ],
  },
  {
    id: 'app_notes',
    title: 'Application Notes (Default)',
    titlePattern: /^(?:application notes|catatan aplikasi)(?: \(default\))?$/i,
    intro: 'Aliases and working notes for applications — not a master catalog. Official names live in the portfolio or Application Catalog. Turn off Use for AI if unused.',
    columns: [
      { key: 'app_ref', label: 'App ref', aliases: ['Aplikasi', 'Nama aplikasi'] },
      { key: 'alias', label: 'Alias' },
      { key: 'note', label: 'Note', aliases: ['Catatan'] },
      { key: 'official_source', label: 'Official source', aliases: ['Sumber resmi'] },
    ],
  },
]

export function resolveSystemKbTableSpec(title: string): SystemKbTableSpec | null {
  return SYSTEM_KB_TABLE_SPECS.find((spec) => spec.titlePattern.test(title.trim())) ?? null
}

export function getSystemKbTableSpec(specId: SystemKbTableSpecId): SystemKbTableSpec {
  const spec = SYSTEM_KB_TABLE_SPECS.find((item) => item.id === specId)
  if (!spec) throw new Error(`Unknown system KB table spec: ${specId}`)
  return spec
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function stripHtmlCell(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeLabel(value: string): string {
  return stripHtmlCell(value).toLowerCase().replace(/\s+/g, ' ')
}

function columnHeaderMatches(column: SystemKbTableColumn, cell: string): boolean {
  const normalized = normalizeLabel(cell)
  const candidates = [column.label, ...(column.aliases ?? [])]
  return candidates.some((candidate) => normalizeLabel(candidate) === normalized)
}

function emptyRow(spec: SystemKbTableSpec): Record<string, string> {
  return Object.fromEntries(spec.columns.map((column) => [column.key, '']))
}

function looksLikeDefaultIndonesianIntro(intro: string): boolean {
  const normalized = intro.toLowerCase()
  return (
    normalized.includes('pakai untuk ai')
    || normalized.includes('glosarium bisnis')
    || normalized.includes('bukan daftar hr')
    || normalized.includes('inventaris nama proses')
    || normalized.includes('daftar sistem yang dipakai')
    || normalized.includes('sebutan resmi')
  )
}

export function serializeSystemKbTable(model: SystemKbTableEditModel): string {
  const spec = getSystemKbTableSpec(model.specId)
  const intro = model.intro.trim() || spec.intro
  const header = spec.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')
  const body = model.rows
    .map((row) => {
      const cells = spec.columns.map((column) => `<td>${escapeHtml((row[column.key] ?? '').trim())}</td>`).join('')
      return `<tr>${cells}</tr>`
    })
    .join('')
  return [
    `<p>${escapeHtml(intro)}</p>`,
    `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`,
  ].join('')
}

export function defaultSystemKbTableHtml(specId: SystemKbTableSpecId): string {
  const spec = getSystemKbTableSpec(specId)
  return serializeSystemKbTable({ specId, intro: spec.intro, rows: [] })
}

export function parseSystemKbTableContent(title: string, content: string): SystemKbTableEditModel | null {
  const spec = resolveSystemKbTableSpec(title)
  if (!spec) return null

  const introMatch = content.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)
  const parsedIntro = introMatch ? stripHtmlCell(introMatch[1]) : spec.intro
  const intro = looksLikeDefaultIndonesianIntro(parsedIntro) ? spec.intro : parsedIntro
  const rows: Array<Record<string, string>> = []
  const rowMatches = content.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)

  for (const match of rowMatches) {
    const cells = [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => stripHtmlCell(cell[1]))
    if (cells.length === 0) continue
    const isHeader = cells.every((cell, index) => {
      const column = spec.columns[index]
      return column ? columnHeaderMatches(column, cell) : false
    })
    if (isHeader) continue
    const row = emptyRow(spec)
    spec.columns.forEach((column, index) => {
      row[column.key] = cells[index] ?? ''
    })
    rows.push(row)
  }

  return {
    specId: spec.id,
    intro: intro || spec.intro,
    rows,
  }
}

export function systemKbTablePlainLength(model: SystemKbTableEditModel): number {
  const spec = getSystemKbTableSpec(model.specId)
  const cells = model.rows.flatMap((row) => spec.columns.map((column) => row[column.key] ?? ''))
  return [model.intro, ...cells].join('\n').length
}

export function addSystemKbTableRow(model: SystemKbTableEditModel): SystemKbTableEditModel {
  return {
    ...model,
    rows: [...model.rows, emptyRow(getSystemKbTableSpec(model.specId))],
  }
}
