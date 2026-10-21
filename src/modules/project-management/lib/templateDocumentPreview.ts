import DOMPurify from 'dompurify'
import {
  partValue,
  type PartPayload,
  type TemplatePart,
  type TemplatePartChoice,
} from '@/modules/project-management/lib/templatePartSelection'

/**
 * The Generate dialog's document preview: the real .docx (the current version when regenerating,
 * else the template) rendered as HTML, with each template part found in it and shown as it will be
 * written — kept, taken from an earlier version, or regenerated.
 *
 * Parts are found from the template's own data, never by name:
 * - a field with a schema location: that row of that top-level table (the document service fills
 *   and reads table fields the same way);
 * - a field without one: the block holding its current value;
 * - a section: its heading and what follows until the next heading;
 * - a table part: the table whose header row names the part's fields.
 * A part that cannot be found is reported as not located, never guessed.
 */

export type LocatedPart = {
  key: string
  /** The marked elements, in document order. */
  elements: HTMLElement[]
  /** For a table-row field: the value cell. */
  valueCell: HTMLElement | null
  how: 'table-row' | 'text' | 'heading' | 'table'
}

const BLOCK_SELECTOR = 'p, li, td, th, h1, h2, h3, h4, h5, h6'
const HEADING_RE = /^H([1-6])$/

/** Lowercase letters and digits only, single-spaced: survives quotes, dashes and bullets. */
export function normText(text: string | null | undefined): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function plainLines(value: string): string[] {
  const text = /<[a-z][\s\S]*>/i.test(value)
    ? value.replace(/<(?:br|\/p|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')
    : value
  return text.split(/\n+/).map((line) => normText(line)).filter((line) => line.length >= 3)
}

function needle(line: string): string {
  return line.length > 60 ? line.slice(0, 60).replace(/\s\S*$/, '') : line
}

/** The body's tables in document order, as the document service counts them: not nested in another
 * table, not in a page header or footer (docx-preview repeats those on every page). */
function topLevelTables(root: HTMLElement): HTMLTableElement[] {
  return Array.from(root.querySelectorAll('table')).filter(
    (table) => !table.parentElement?.closest('table') && !table.closest('header, footer'),
  )
}

function inPageFurniture(el: Element): boolean {
  return Boolean(el.closest('header, footer'))
}

function rowMatchesLabel(row: HTMLTableRowElement, label: string): boolean {
  const first = normText(row.cells[0]?.textContent)
  return Boolean(label) && Boolean(first) && (first === label || first.startsWith(label) || label.startsWith(first))
}

function locateTableRow(root: HTMLElement, part: TemplatePart): LocatedPart | null {
  const tableIndex = part.location?.table_index
  const rowIndex = part.location?.row_index
  if (typeof tableIndex !== 'number' || typeof rowIndex !== 'number') return null
  const tables = topLevelTables(root)
  const label = normText(part.label)
  let row: HTMLTableRowElement | undefined = tables[tableIndex]?.rows[rowIndex]
  // The schema's position is checked against the row's label cell, as the document service does
  // when it reads a version back; a moved row is found by its label instead.
  if (row && !rowMatchesLabel(row, label)) {
    const byLabel = tables.flatMap((table) => Array.from(table.rows)).find((candidate) => rowMatchesLabel(candidate, label))
    if (byLabel) row = byLabel
  }
  if (!row) return null
  const cells = Array.from(row.cells) as HTMLElement[]
  const valueCell = cells.length >= 2 ? cells[cells.length - 1] : cells[0] ?? null
  return { key: part.key, elements: [row], valueCell, how: 'table-row' }
}

function locateByValue(root: HTMLElement, part: TemplatePart, value: unknown, claimed: Set<Element>): LocatedPart | null {
  if (typeof value !== 'string') return null
  const lines = plainLines(value)
  if (lines.length === 0) return null
  const first = needle(lines[0])
  const candidates = (Array.from(root.querySelectorAll(BLOCK_SELECTOR)) as HTMLElement[])
    .filter((el) => !claimed.has(el) && !inPageFurniture(el) && normText(el.textContent).includes(first))
  if (candidates.length === 0) return null
  // The most specific block holding the value's first line.
  const start = candidates.reduce((best, el) => ((el.textContent ?? '').length < (best.textContent ?? '').length ? el : best))
  const elements: HTMLElement[] = [start]
  const last = needle(lines[lines.length - 1])
  if (lines.length > 1 && !normText(start.textContent).includes(last)) {
    let sibling = start.nextElementSibling as HTMLElement | null
    for (let step = 0; sibling && step < 60; step += 1) {
      elements.push(sibling)
      if (normText(sibling.textContent).includes(last)) break
      sibling = sibling.nextElementSibling as HTMLElement | null
    }
    if (!normText(elements[elements.length - 1].textContent).includes(last)) elements.splice(1)
  }
  return { key: part.key, elements, valueCell: start.tagName === 'TD' ? start : null, how: 'text' }
}

// docx-preview writes a Word heading as <p class="<prefix>_heading1">; mammoth as <h1>.
const HEADING_CLASS_RE = /(?:^|\s)\S*_heading([1-6])(?:\s|$)/i

function headingLevel(el: Element): number {
  const tag = HEADING_RE.exec(el.tagName)
  if (tag) return Number(tag[1])
  const styled = HEADING_CLASS_RE.exec(el.className || '')
  return styled ? Number(styled[1]) : 7
}

function isHeading(el: Element): boolean {
  return headingLevel(el) < 7
}

function locateSection(root: HTMLElement, part: TemplatePart, claimed: Set<Element>): LocatedPart | null {
  const label = normText(part.label).replace(/^\d+(?:\s\d+)*\s/, '')
  if (!label) return null
  const heading = (Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6, p')) as HTMLElement[]).find((el) => {
    if (claimed.has(el) || inPageFurniture(el)) return false
    const text = normText(el.textContent).replace(/^\d+(?:\s\d+)*\s/, '')
    return text === label || (text.startsWith(label) && text.length <= label.length + 20)
  })
  if (!heading) return null
  const level = headingLevel(heading)
  const elements: HTMLElement[] = [heading]
  let sibling = heading.nextElementSibling as HTMLElement | null
  for (let step = 0; sibling && step < 80; step += 1) {
    if (isHeading(sibling) && headingLevel(sibling) <= level) break
    elements.push(sibling)
    sibling = sibling.nextElementSibling as HTMLElement | null
  }
  return { key: part.key, elements, valueCell: null, how: 'heading' }
}

function locateTable(root: HTMLElement, part: TemplatePart, claimed: Set<Element>): LocatedPart | null {
  if (typeof part.location?.table_index === 'number') {
    const table = topLevelTables(root)[part.location.table_index]
    if (table && !claimed.has(table)) return { key: part.key, elements: [table], valueCell: null, how: 'table' }
  }
  const fields = (part.fields ?? []).map((field) => normText(field.replace(/[_-]+/g, ' '))).filter(Boolean)
  if (fields.length === 0) return null
  let best: { table: HTMLTableElement; score: number } | null = null
  for (const table of Array.from(root.querySelectorAll('table'))) {
    if (claimed.has(table) || inPageFurniture(table)) continue
    const header = normText(table.rows[0]?.textContent)
    const score = fields.filter((field) => header.includes(field)).length
    if (score > (best?.score ?? 0)) best = { table, score }
  }
  if (!best || best.score < Math.max(1, Math.ceil(fields.length / 2))) return null
  return { key: part.key, elements: [best.table], valueCell: null, how: 'table' }
}

/** Finds every part it can, each element claimed by one part only. */
export function locateParts(root: HTMLElement, parts: TemplatePart[], current: PartPayload | undefined): Map<string, LocatedPart> {
  const located = new Map<string, LocatedPart>()
  const claimed = new Set<Element>()
  const claim = (found: LocatedPart | null) => {
    if (!found) return
    located.set(found.key, found)
    for (const el of found.elements) {
      claimed.add(el)
      el.querySelectorAll('*').forEach((child) => claimed.add(child))
    }
  }
  // Schema locations first: they are exact, and value search must not take their blocks.
  for (const part of parts) if (part.kind === 'field') claim(locateTableRow(root, part))
  for (const part of parts) if (part.kind === 'table') claim(locateTable(root, part, claimed))
  for (const part of parts) if (part.kind === 'section') claim(locateSection(root, part, claimed))
  for (const part of parts) {
    if (part.kind === 'field' && !located.has(part.key)) claim(locateByValue(root, part, partValue(part, current), claimed))
  }
  return located
}

// --- Showing each part as it will be written --------------------------------------------------

export type PartPreviewState =
  | { kind: 'keep' }
  | { kind: 'generate' }
  | { kind: 'version'; version: number; value: unknown; loaded: boolean }
  /** A reviewer accepted this text from a comment; it is written as is. */
  | { kind: 'draft'; value: string }
  /** A comment proposal waiting for the reviewer: shown, not applied. */
  | { kind: 'proposal'; value: string }

export function partPreviewState(
  part: TemplatePart,
  choice: TemplatePartChoice | undefined,
  payloads: Record<number, PartPayload | undefined>,
  comment: { draft?: string; proposal?: string } = {},
): PartPreviewState {
  if (choice === 'draft' && comment.draft) return { kind: 'draft', value: comment.draft }
  if (comment.proposal) return { kind: 'proposal', value: comment.proposal }
  if (choice === undefined || choice === 'keep' || choice === 'draft') return { kind: 'keep' }
  if (choice === 'generate') return { kind: 'generate' }
  const payload = payloads[choice]
  return { kind: 'version', version: choice, value: partValue(part, payload), loaded: payload !== undefined }
}

/** A regenerated part shows its current text dimmed; one from an earlier version is tinted. */
const GENERATE_CLASSES = ['text-slate-400']
const VERSION_CLASSES = ['bg-amber-50']
const COMMENT_CLASSES = ['bg-emerald-50']
const PROPOSAL_CLASSES = ['bg-sky-50']
/** The selected part (cells for a table row). */
export const SELECTED_CLASSES = ['outline', 'outline-2', '-outline-offset-2', 'outline-blue-500/70', 'bg-blue-50/80']

const BADGE_BASE ='tpl-part-badge pointer-events-none mb-1 inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide'
// The preview is a white page in both themes, so badges use fixed light colors.
const BADGE_TONE = {
  generate: 'bg-blue-100 text-blue-800',
  version: 'bg-amber-100 text-amber-900',
  comment: 'bg-emerald-100 text-emerald-800',
  proposal: 'bg-sky-100 text-sky-800',
  muted: 'bg-slate-100 text-slate-600',
}

function badge(text: string, tone: keyof typeof BADGE_TONE, block: boolean): HTMLElement {
  const el = document.createElement(block ? 'div' : 'span')
  el.className = `${BADGE_BASE} ${BADGE_TONE[tone]}${block ? ' flex' : ''}`
  el.textContent = text
  el.setAttribute('aria-hidden', 'true')
  return el
}

/** `paragraphClass`: the replaced paragraph's own class, so the new text keeps the document's style. */
function valueNodes(value: unknown, part: TemplatePart, paragraphClass = ''): Node[] {
  if (part.kind === 'table') return []
  const text = String(value ?? '')
  if (/<[a-z][\s\S]*>/i.test(text)) {
    const holder = document.createElement('div')
    holder.innerHTML = DOMPurify.sanitize(text)
    if (paragraphClass) holder.querySelectorAll('p').forEach((p) => p.classList.add(...paragraphClass.split(/\s+/).filter(Boolean)))
    return Array.from(holder.childNodes)
  }
  return text.split(/\n+/).filter((line) => line.trim()).map((line) => {
    const p = document.createElement('p')
    if (paragraphClass) p.className = paragraphClass
    p.textContent = line
    return p
  })
}

function paragraphClassIn(el: Element | null | undefined): string {
  if (!el) return ''
  const p = el.tagName === 'P' ? el : el.querySelector('p')
  // Only the document's own style classes ("<prefix>_<style>"), not the marks added here.
  return (p?.className ?? '').split(/\s+/).filter((name) => /^[a-z][\w-]*_[\w-]+$/i.test(name)).join(' ')
}

function replaceTableRows(table: HTMLTableElement, rows: unknown, fields: string[]) {
  const records = Array.isArray(rows) ? rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object') : []
  const body = table.tBodies[0] ?? table
  const header = table.rows[0]
  Array.from(table.rows).forEach((row) => {
    if (row !== header) row.remove()
  })
  for (const record of records) {
    const tr = document.createElement('tr')
    const keys = fields.length ? fields : Object.keys(record)
    for (const key of keys) {
      const td = document.createElement('td')
      const cell = record[key]
      td.textContent = typeof cell === 'string' || typeof cell === 'number' ? String(cell) : Array.isArray(cell) ? `${cell.length} item` : ''
      tr.appendChild(td)
    }
    body.appendChild(tr)
  }
}

/** Marks a located part and shows its chosen content in place. */
export function annotatePart(found: LocatedPart, part: TemplatePart, state: PartPreviewState) {
  const [first] = found.elements
  for (const el of found.elements) {
    el.dataset.partKey = found.key
    el.classList.add('tpl-part', 'cursor-pointer', 'transition-colors')
  }
  const inline = found.how === 'table-row' || first.tagName === 'TD' || first.tagName === 'TH'
  const badgeHost = found.valueCell ?? first
  const addBadge = (text: string, tone: keyof typeof BADGE_TONE) => {
    const el = badge(text, tone, !inline)
    if (inline) {
      badgeHost.prepend(el)
      el.insertAdjacentElement('afterend', document.createElement('br'))
    } else {
      el.dataset.partKey = found.key
      first.insertAdjacentElement('beforebegin', el)
    }
  }

  if (state.kind === 'keep') return
  if (state.kind === 'generate') {
    for (const el of found.elements) el.classList.add(...GENERATE_CLASSES)
    addBadge('Regenerate · written again by AI', 'generate')
    return
  }
  let replacement: { value: unknown; label: string; tone: keyof typeof BADGE_TONE; tint: string[]; strikeOld: boolean }
  if (state.kind === 'version') {
    if (!state.loaded) {
      addBadge(`Reading V${state.version}…`, 'muted')
      return
    }
    if (state.value === undefined) {
      for (const el of found.elements) el.classList.add(...VERSION_CLASSES)
      addBadge(`From V${state.version} · empty in that version`, 'version')
      return
    }
    replacement = { value: state.value, label: `From V${state.version}`, tone: 'version', tint: VERSION_CLASSES, strikeOld: false }
  } else if (state.kind === 'draft') {
    replacement = { value: state.value, label: 'Revised by comment', tone: 'comment', tint: COMMENT_CLASSES, strikeOld: false }
  } else {
    replacement = { value: state.value, label: 'Proposed · not applied yet', tone: 'proposal', tint: PROPOSAL_CLASSES, strikeOld: true }
  }
  for (const el of found.elements) el.classList.add(...replacement.tint)
  const paragraphClass = paragraphClassIn(found.valueCell ?? found.elements[found.how === 'heading' ? 1 : 0])
  addBadge(replacement.label, replacement.tone)
  const markedNodes = () => {
    const nodes = valueNodes(replacement.value, part, paragraphClass)
    nodes.forEach((node) => {
      if (node instanceof HTMLElement) {
        node.dataset.partKey = found.key
        node.classList.add('tpl-part', 'cursor-pointer', ...replacement.tint)
      }
    })
    return nodes
  }
  if (found.how === 'table' && first.tagName === 'TABLE') {
    replaceTableRows(first as HTMLTableElement, replacement.value, part.fields ?? [])
  } else if (found.valueCell) {
    const badgeEl = found.valueCell.querySelector('.tpl-part-badge')
    const lineBreak = badgeEl?.nextElementSibling?.tagName === 'BR' ? badgeEl.nextElementSibling : null
    const kept = [badgeEl, lineBreak].filter((node): node is Element => Boolean(node))
    // A proposal shows the text it would replace, struck through, above it.
    const old: Node[] = []
    if (replacement.strikeOld) {
      const struck = document.createElement('del')
      struck.className = 'block text-slate-400'
      struck.append(...Array.from(found.valueCell.childNodes).filter((node) => !kept.includes(node as Element)))
      if (struck.textContent?.trim()) old.push(struck)
    }
    found.valueCell.replaceChildren(...kept, ...old, ...valueNodes(replacement.value, part, paragraphClass))
  } else if (found.how === 'heading') {
    // Keep the heading; what follows it becomes that version's text.
    for (const el of found.elements.slice(1)) el.remove()
    first.after(...markedNodes())
  } else {
    for (const el of found.elements.slice(1)) el.remove()
    first.replaceWith(...markedNodes())
  }
}

/** The elements to light up for a part (cells for a table row: rows take no outline). */
export function highlightTargets(root: HTMLElement, key: string): HTMLElement[] {
  const marked = Array.from(root.querySelectorAll<HTMLElement>('[data-part-key]')).filter((el) => el.dataset.partKey === key)
  return marked.flatMap((el) => (el.tagName === 'TR' ? (Array.from((el as HTMLTableRowElement).cells) as HTMLElement[]) : [el]))
}
