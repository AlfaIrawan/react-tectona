/** Normalize and protect table markup in KB rich HTML. */

const KB_TABLE_BLOCK_RE = /<table\b[\s\S]*?<\/table>/gi

const KNOWN_TABLE_CATEGORIES = [
  'Business Application',
  'SAP — Materials Management',
  'SAP — Finance & Controlling',
  'SAP — User Experience',
  'Aplikasi keamanan',
  'Aplikasi operasional',
  'Aplikasi eksternal',
  'Aplikasi internal',
] as const

const KNOWN_TABLE_TAIL_VALUES = [
  'SAP ERP',
  'Internal',
  'Active',
  'Inactive',
  'ON',
  'OFF',
] as const

const KNOWN_APP_TITLES = [
  'adira.co.id',
  'SAP FIORI',
  'SAP FICO',
  'SAP MM',
  'OneIn',
  'OneEx',
  'ACCTION',
  'AMAN',
] as const

type ParsedTableRow = string[]

function measureLivePx(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value)
}

function cellSizeAttrs(cell: HTMLTableCellElement | null | undefined): string {
  if (!cell) return ''
  const width = parsePxSize(cell.style.width)
    || parsePxSize(cell.getAttribute('width'))
    || measureLivePx(cell.getBoundingClientRect().width)
    || measureLivePx(cell.offsetWidth)
  const height = parsePxSize(cell.style.height)
    || parsePxSize(cell.getAttribute('height'))
    || measureLivePx(cell.getBoundingClientRect().height)
    || measureLivePx(cell.offsetHeight)
  const parts: string[] = []
  if (width) parts.push(` width="${Math.round(width)}"`)
  if (height) parts.push(` height="${Math.round(height)}"`)
  return parts.join('')
}

function rowHeightAttr(row: HTMLTableRowElement | null | undefined): string {
  if (!row) return ''
  const height = parsePxSize(row.style.height)
    || parsePxSize(row.getAttribute('height'))
    || measureLivePx(row.getBoundingClientRect().height)
    || measureLivePx(row.offsetHeight)
  return height ? ` height="${Math.round(height)}"` : ''
}

function parsePxSize(value: string | null | undefined): number | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const asNumber = Number.parseFloat(trimmed)
  if (Number.isFinite(asNumber) && asNumber > 0) return asNumber
  const match = trimmed.match(/^(\d+(?:\.\d+)?)px$/i)
  if (!match) return null
  const px = Number.parseFloat(match[1])
  return Number.isFinite(px) && px > 0 ? px : null
}

function collectColumnWidths(table: HTMLTableElement, columnCount: number): Array<number | null> {
  const widths: Array<number | null> = Array.from({ length: columnCount }, () => null)
  const cols = table.querySelectorAll('colgroup col')
  cols.forEach((col, index) => {
    if (index >= columnCount) return
    widths[index] = parsePxSize((col as HTMLElement).style.width) || parsePxSize(col.getAttribute('width'))
  })
  const firstRow = table.rows[0]
  for (let index = 0; index < columnCount; index += 1) {
    if (widths[index]) continue
    const cell = firstRow?.cells[index]
    if (!cell) continue
    widths[index] = parsePxSize(cell.style.width)
      || parsePxSize(cell.getAttribute('width'))
      || measureLivePx(cell.getBoundingClientRect().width)
      || measureLivePx(cell.offsetWidth)
  }
  for (const row of Array.from(table.rows)) {
    for (let index = 0; index < columnCount; index += 1) {
      if (widths[index]) continue
      const cell = row.cells[index]
      if (!cell) continue
      widths[index] = parsePxSize(cell.style.width)
        || parsePxSize(cell.getAttribute('width'))
        || measureLivePx(cell.getBoundingClientRect().width)
        || measureLivePx(cell.offsetWidth)
    }
  }
  return widths
}

function buildColgroupHtml(widths: Array<number | null>): string {
  if (!widths.some((width) => typeof width === 'number' && width > 0)) return ''
  const cols = widths.map((width) => (
    typeof width === 'number' && width > 0
      ? `<col width="${Math.round(width)}">`
      : '<col>'
  )).join('')
  return `<colgroup>${cols}</colgroup>`
}

const KB_TABLE_CAPABILITY_ATTRS = [
  'data-kb-header-row',
  'data-kb-first-column',
  'data-kb-total-row',
  'data-kb-last-column',
  'data-kb-banded-rows',
  'data-kb-banded-columns',
] as const

function tableCapabilityAttrs(table: HTMLTableElement): string {
  return KB_TABLE_CAPABILITY_ATTRS
    .filter((name) => table.getAttribute(name) === 'true')
    .map((name) => ` ${name}="true"`)
    .join('')
}

function escapeKbTableCell(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Decode HTML entities (including nested &amp;amp;…) back to plain text before re-escaping. */
function decodeHtmlEntities(value: string): string {
  let current = value
  for (let pass = 0; pass < 12; pass += 1) {
    let next: string
    if (typeof document !== 'undefined') {
      const el = document.createElement('textarea')
      el.innerHTML = current
      next = el.value
    } else {
      next = current
        .replace(/&nbsp;/gi, ' ')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&amp;/gi, '&')
    }
    if (next === current) break
    current = next
  }
  return current
}

function stripHtmlToPlainText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<\s*br\s*\/?>/gi, ' ')
      .replace(/<\/(p|h1|h2|h3|li|div|blockquote|pre)>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

function extractIntroHtmlBeforeTable(content: string): string {
  if (typeof document === 'undefined') {
    const idx = content.search(/No\s*Aplikasi/i)
    return idx > 0 ? content.slice(0, idx).trim() : ''
  }

  const root = document.createElement('div')
  root.innerHTML = content
  const introParts: string[] = []

  for (const child of Array.from(root.childNodes)) {
    const text = (child.textContent ?? '').replace(/\s+/g, '')
    if (/NoAplikasi/i.test(text) || /NoCategory/i.test(text)) break
    if (child.nodeType === Node.ELEMENT_NODE) {
      introParts.push((child as HTMLElement).outerHTML)
    }
  }

  return introParts.join('')
}

function findMashedCatalogHeaderStart(compact: string): number {
  const aplikasi = compact.search(/NoAplikasi/i)
  const category = compact.search(/NoCategory/i)
  if (aplikasi < 0 && category < 0) return -1
  if (aplikasi < 0) return category
  if (category < 0) return aplikasi
  return Math.min(aplikasi, category)
}

function parseMashedHeaderColumns(headerPart: string): string[] {
  if (!/^No/i.test(headerPart)) return []
  const rest = headerPart.replace(/^No/i, '')
  if (!rest) return ['No']
  const columns = rest.split(/(?=[A-Z])/).map((part) => part.trim()).filter(Boolean)
  return ['No', ...columns]
}

function compactToken(value: string): string {
  return value.replace(/\s+/g, '')
}

function restoreCompactAppLabel(value: string): string {
  const compact = compactToken(value)
  for (const title of KNOWN_APP_TITLES) {
    if (compact === compactToken(title)) return title
  }
  return value
}

function extractTailColumnValue(rest: string, lastHeader: string): { value: string; remainder: string } {
  const compactRest = compactToken(rest)
  for (const candidate of KNOWN_TABLE_TAIL_VALUES) {
    const compactCandidate = compactToken(candidate)
    if (compactRest.endsWith(compactCandidate)) {
      return {
        value: candidate,
        remainder: compactRest.slice(0, -compactCandidate.length),
      }
    }
  }

  return { value: '', remainder: compactRest }
}

function parseMashedRowCells(rest: string, headers: string[]): ParsedTableRow {
  const lastHeader = headers[headers.length - 1] ?? ''
  const { value: tailValue, remainder } = extractTailColumnValue(rest, lastHeader)
  const body = remainder

  if (headers.length === 1) {
    return [tailValue ? `${body}${compactToken(tailValue)}` : body]
  }

  const cells: string[] = []
  let category = ''
  for (const candidate of KNOWN_TABLE_CATEGORIES) {
    const compactCandidate = compactToken(candidate)
    const index = body.indexOf(compactCandidate)
    if (index > 0) {
      cells.push(body.slice(0, index))
      category = candidate
      cells.push(candidate)
      cells.push(body.slice(index + compactCandidate.length))
      break
    }
  }

  if (!category) {
    cells.push(body)
    while (cells.length < headers.length - 1) cells.push('')
  }

  if (tailValue) cells.push(tailValue)
  while (cells.length < headers.length) cells.push('')
  return cells.slice(0, headers.length)
}

function parseMashedTableRows(body: string, headers: string[]): ParsedTableRow[] {
  const rows: ParsedTableRow[] = []
  const compactBody = compactToken(body)
  const chunks = compactBody.split(/(?=\d+(?=[A-Za-z@.]))/).map((part) => part.trim()).filter(Boolean)

  for (const chunk of chunks) {
    const numMatch = chunk.match(/^(\d+)/)
    if (!numMatch) continue

    const rowNumber = numMatch[1]
    const rest = chunk.slice(numMatch[0].length)
    const cells = parseMashedRowCells(rest, headers.slice(1))
    rows.push([rowNumber, ...cells])
  }

  return rows
}

function buildGenericTableHtml(headers: string[], rows: ParsedTableRow[]): string {
  const head = headers.map((header) => `<th>${escapeKbTableCell(header)}</th>`).join('')
  const body = rows.map((row) => {
    const cells = row.map((value, index) => {
      const displayValue = index === 1 && headers[1]?.toLowerCase() === 'aplikasi'
        ? restoreCompactAppLabel(value)
        : value
      const escaped = escapeKbTableCell(displayValue)
      if (index === 1 && headers[1]?.toLowerCase() === 'aplikasi') {
        return `<td><strong>${escaped}</strong></td>`
      }
      return `<td>${escaped}</td>`
    }).join('')
    return `<tr>${cells}</tr>`
  }).join('')

  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

/** Rebuild table HTML when tags were lost but header/row text remains mashed together. */
export function repairKbMashedTableHtml(content: string): string {
  if (!kbRichHtmlNeedsTableRepair(content)) return content

  const plain = stripHtmlToPlainText(content)
  const compact = plain.replace(/\s+/g, '')
  const headerStart = findMashedCatalogHeaderStart(compact)
  if (headerStart < 0) return content

  const tableCompact = compact.slice(headerStart)
  const firstRowIndex = tableCompact.search(/\d+(?=[A-Za-z@.])/)
  if (firstRowIndex < 3) return content

  const headerPart = tableCompact.slice(0, firstRowIndex)
  const bodyPart = tableCompact.slice(firstRowIndex)
  const headers = parseMashedHeaderColumns(headerPart)
  if (headers.length < 2) return content

  const rows = parseMashedTableRows(bodyPart, headers)
  if (rows.length === 0) return content

  const intro = extractIntroHtmlBeforeTable(content)
  return `${intro}${buildGenericTableHtml(headers, rows)}`
}

/** @deprecated Use repairKbMashedTableHtml */
export function repairKbMashedCatalogTableHtml(content: string): string {
  return repairKbMashedTableHtml(content)
}

const KB_CATALOG_HEADERS_6 = ['No', 'Aplikasi', 'Category', 'Ringkasan', 'Platform', 'Status'] as const
const KB_CATALOG_HEADERS_5 = ['No', 'Aplikasi', 'Category', 'Ringkasan', 'Platform'] as const

function defaultHeaderLabels(columnCount: number): string[] {
  if (columnCount === KB_CATALOG_HEADERS_6.length) return [...KB_CATALOG_HEADERS_6]
  if (columnCount === KB_CATALOG_HEADERS_5.length) return [...KB_CATALOG_HEADERS_5]
  return Array.from({ length: columnCount }, (_, index) => `Kolom ${index + 1}`)
}

function collectKbTableRows(table: HTMLTableElement): HTMLTableRowElement[] {
  const rows: HTMLTableRowElement[] = []
  if (table.tHead) {
    rows.push(...Array.from(table.tHead.rows))
  }
  for (const tbody of Array.from(table.tBodies)) {
    for (const row of Array.from(tbody.rows)) {
      if (!table.tHead?.contains(row)) rows.push(row)
    }
  }
  for (const child of Array.from(table.children)) {
    if (child.tagName === 'TR') {
      const row = child as HTMLTableRowElement
      if (!rows.includes(row)) rows.push(row)
    }
  }
  return rows
}

function isKbHeaderRow(table: HTMLTableElement, row: HTMLTableRowElement, rowIndex: number): boolean {
  if (table.tHead?.contains(row)) return true
  if (rowIndex !== 0) return false
  const cells = Array.from(row.cells)
  if (cells.length === 0) return false
  if (cells.every((cell) => cell.tagName === 'TH')) return true
  if (cells.some((cell) => cell.tagName === 'TH')) return true
  const text = row.textContent?.replace(/\s+/g, ' ') ?? ''
  return /\bNo\b/i.test(text) && (/\bCategory\b/i.test(text) || /\bAplikasi\b/i.test(text) || /\bRingkasan\b/i.test(text))
}

function cellInnerHtml(cell: HTMLTableCellElement | undefined): string {
  if (!cell) return '<br>'
  const clone = cell.cloneNode(true) as HTMLTableCellElement
  clone.querySelectorAll('div').forEach((block) => {
    const fragment = document.createDocumentFragment()
    while (block.firstChild) {
      fragment.appendChild(block.firstChild)
    }
    block.replaceWith(fragment)
  })
  const html = clone.innerHTML.trim()
  return html || '<br>'
}

function headerLabel(cell: HTMLTableCellElement | undefined, index: number, columnCount: number): string {
  const plain = (cell?.textContent ?? '').trim()
  if (plain) return plain
  return defaultHeaderLabels(columnCount)[index] ?? `Kolom ${index + 1}`
}

type KbGridCell = HTMLTableCellElement | null

/**
 * Build a logical grid that honors colspan/rowspan. contentEditable often merges two `<td>`s while
 * a user edits (producing a `colspan`), which — under a naive positional rebuild — dropped a column
 * and blanked the last one. Expanding spans into grid slots keeps every column aligned: a merged
 * cell's content stays in its first slot and the spanned slots become blanks, so nothing shifts.
 */
function buildKbCellGrid(rows: HTMLTableRowElement[]): KbGridCell[][] {
  const grid: KbGridCell[][] = []
  rows.forEach((row, r) => {
    if (!grid[r]) grid[r] = []
    let col = 0
    for (const cell of Array.from(row.cells)) {
      while (grid[r][col] !== undefined) col += 1 // skip slots already taken by a rowspan from above
      const colSpan = Math.max(1, cell.colSpan || 1)
      const rowSpan = Math.max(1, cell.rowSpan || 1)
      for (let dr = 0; dr < rowSpan; dr += 1) {
        const gr = r + dr
        if (!grid[gr]) grid[gr] = []
        for (let dc = 0; dc < colSpan; dc += 1) {
          grid[gr][col + dc] = dr === 0 && dc === 0 ? cell : null
        }
      }
      col += colSpan
    }
  })
  return grid
}

function rebuildKbTableElement(table: HTMLTableElement): string {
  const rows = collectKbTableRows(table)
  if (rows.length === 0) return '<table></table>'

  const grid = buildKbCellGrid(rows)

  let columnCount = 0
  for (const gridRow of grid) {
    columnCount = Math.max(columnCount, gridRow.length)
  }
  columnCount = Math.max(columnCount, 1)

  // Drop trailing all-empty columns (e.g. a row that over-split into many empty cells) so a stray
  // wide row can't pad the whole table with blank columns.
  let effectiveColumns = 0
  for (const gridRow of grid) {
    for (let index = gridRow.length - 1; index >= 0; index -= 1) {
      if (cellInnerHtml(gridRow[index] ?? undefined) !== '<br>') {
        effectiveColumns = Math.max(effectiveColumns, index + 1)
        break
      }
    }
  }
  if (effectiveColumns > 0) {
    columnCount = Math.min(columnCount, effectiveColumns)
  }

  const hasHeader = isKbHeaderRow(table, rows[0], 0)
  const headerText = hasHeader ? (rows[0].textContent ?? '').replace(/\s+/g, ' ') : ''
  const looksLikeCatalogTable = /\bNo\b/i.test(headerText)
    && /\bCategory\b/i.test(headerText)
    && (/\bRingkasan\b/i.test(headerText) || /\bPlatform\b/i.test(headerText) || /\bStatus\b/i.test(headerText))
  if (looksLikeCatalogTable && columnCount >= 5) {
    columnCount = Math.max(columnCount, KB_CATALOG_HEADERS_6.length)
  }

  // Only emit a header row when there is a real one, or when the width matches the known catalog
  // shape (whose default labels are meaningful). Otherwise render headerless — never synthetic
  // "Kolom N" labels.
  const isCatalogWidth =
    columnCount === KB_CATALOG_HEADERS_5.length || columnCount === KB_CATALOG_HEADERS_6.length
  const renderHeader = hasHeader || isCatalogWidth
  const headerGridRow = grid[0] ?? []
  const headerLabels = hasHeader
    ? Array.from({ length: columnCount }, (_, index) => headerLabel(headerGridRow[index] ?? undefined, index, columnCount))
    : defaultHeaderLabels(columnCount)

  const columnWidths = collectColumnWidths(table, columnCount)
  const colgroupHtml = buildColgroupHtml(columnWidths)
  const hasResizedColumns = columnWidths.some((width) => typeof width === 'number' && width > 0)
  const summedWidths = columnWidths.reduce<number>((sum, width) => sum + (width ?? 0), 0)
  const tableWidth = parsePxSize(table.style.width)
    || parsePxSize(table.getAttribute('width'))
    || (hasResizedColumns ? Math.max(summedWidths, 200) : null)
  // Persist table width whenever columns were resized so fixed layout can reapply after reload.
  const tableAttrs = `${tableWidth ? ` width="${Math.round(tableWidth)}"` : ''}${tableCapabilityAttrs(table)}`

  const dataSourceRows = hasHeader ? rows.slice(1) : rows
  const dataRows = (hasHeader ? grid.slice(1) : grid).map((gridRow, rowIndex) => {
    const sourceRow = dataSourceRows[rowIndex]
    const cells = Array.from({ length: columnCount }, (_, index) => {
      const html = cellInnerHtml(gridRow[index] ?? undefined)
      const sourceCell = sourceRow?.cells[index]
      const sizeAttrs = cellSizeAttrs(sourceCell) || (
        columnWidths[index] ? ` width="${Math.round(columnWidths[index]!)}"` : ''
      )
      if (renderHeader && headerLabels[index]?.toLowerCase() === 'aplikasi' && html !== '<br>') {
        // Decode first — stripping tags alone leaves &amp; as text, and escape would nest it.
        const plain = decodeHtmlEntities(html.replace(/<[^>]+>/g, '')).trim()
        return plain ? `<td${sizeAttrs}><strong>${escapeKbTableCell(plain)}</strong></td>` : `<td${sizeAttrs}><br></td>`
      }
      return `<td${sizeAttrs}>${html}</td>`
    }).join('')
    return `<tr${rowHeightAttr(sourceRow)}>${cells}</tr>`
  })

  const body = dataRows.join('')

  if (!renderHeader) {
    return `<table${tableAttrs}>${colgroupHtml}<tbody>${body}</tbody></table>`
  }
  const headerSourceRow = rows[0]
  const head = headerLabels.map((label, index) => {
    const sourceCell = headerSourceRow?.cells[index]
    const sizeAttrs = cellSizeAttrs(sourceCell) || (
      columnWidths[index] ? ` width="${Math.round(columnWidths[index]!)}"` : ''
    )
    return `<th${sizeAttrs}>${escapeKbTableCell(label)}</th>`
  }).join('')
  return `<table${tableAttrs}>${colgroupHtml}<thead><tr${rowHeightAttr(headerSourceRow)}>${head}</tr></thead><tbody>${body}</tbody></table>`
}

function serializeTableElement(table: HTMLTableElement): string {
  return rebuildKbTableElement(table)
}

/** Serialize editor HTML with explicit table reconstruction from live DOM. */
function serializeKbRichHtmlNode(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim()
    return text ? `<p>${escapeKbTableCell(text)}</p>` : ''
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const element = node as HTMLElement
  const tag = element.tagName.toLowerCase()

  if (tag === 'table') {
    return serializeTableElement(element as HTMLTableElement)
  }
  if (tag === 'br') return '<br>'
  if (tag === 'div') {
    // Preserve styled div wrappers (alignment / doc styles); unwrap only bare layout divs.
    if (element.getAttribute('style') || element.getAttribute('data-kb-style')) {
      return element.outerHTML
    }
    return Array.from(element.childNodes).map((child) => serializeKbRichHtmlNode(child)).join('')
  }
  if (['h1', 'h2', 'h3', 'p', 'ul', 'ol', 'blockquote', 'pre', 'span'].includes(tag)) {
    // Keep style= and data-kb-style so View matches Editor after table-aware serialize.
    return element.outerHTML
  }

  return element.outerHTML
}

export function serializeKbRichHtmlFromRoot(root: HTMLElement): string {
  return Array.from(root.childNodes).map((node) => serializeKbRichHtmlNode(node)).join('')
}

export function captureKbEditorHtml(editor: HTMLElement | null, fallbackHtml: string): string {
  if (!editor) return fallbackHtml
  if (editor.querySelector('table')) {
    return serializeKbRichHtmlFromRoot(editor)
  }
  return editor.innerHTML
}

/** Repair mashed tables, then normalize valid table markup when DOM is available. */
export function prepareKbRichHtmlContent(content: string): string {
  const repaired = repairKbMashedTableHtml(content)
  return normalizeKbRichTableHtml(repaired)
}

export function kbRichHtmlHasTableMarkup(content: string): boolean {
  return /<table[\s>]/i.test(content)
}

/** Detect KB HTML where table tags were lost but column text remains mashed. */
export function kbRichHtmlNeedsTableRepair(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed || kbRichHtmlHasTableMarkup(trimmed)) return false

  const plain = stripHtmlToPlainText(trimmed).replace(/\s+/g, '')
  // Only repair Adira-style catalog tables (NoAplikasi… / NoCategory…), not narrative HTML
  // where words like "Knowledge" falsely match /No(?=[A-Z])/i.
  if (findMashedCatalogHeaderStart(plain) < 0) return false
  if (/<h[1-3]\b/i.test(trimmed) && !/NoAplikasi|NoCategory/i.test(plain)) return false
  if (!/Category/i.test(plain) && !/Ringkasan/i.test(plain)) return false
  return /Platform/i.test(plain) || /Status/i.test(plain) || /Aplikasi/i.test(plain)
}

export function splitKbRichHtmlTableBlocks(content: string): { shell: string; tables: string[] } {
  const tables: string[] = []
  const shell = content.replace(KB_TABLE_BLOCK_RE, (match) => {
    tables.push(match)
    return `@@KB-TABLE-${tables.length - 1}@@`
  })
  return { shell, tables }
}

export function mergeKbRichHtmlTableBlocks(shell: string, tables: string[]): string {
  return tables.reduce(
    (html, table, index) => html.replaceAll(`@@KB-TABLE-${index}@@`, table),
    shell,
  )
}

export function normalizeKbRichTableHtml(content: string): string {
  if (!content || typeof document === 'undefined') return content
  if (!kbRichHtmlHasTableMarkup(content)) return content

  const root = document.createElement('div')
  root.innerHTML = content

  root.querySelectorAll('table').forEach((table) => {
    const rebuilt = rebuildKbTableElement(table)
    const replacement = document.createElement('div')
    replacement.innerHTML = rebuilt
    const nextTable = replacement.querySelector('table')
    if (nextTable) {
      table.replaceWith(nextTable)
    }
  })

  return root.innerHTML
}

/**
 * Convert persisted width/height attributes into inline styles.
 * DOMPurify/nh3 keep width/height attrs but strip style; browsers also ignore bare width attrs
 * unless table-layout is fixed — so we rehydrate layout styles on every sanitize/render.
 */
export function applyKbTableLayoutStylesFromAttrs(content: string): string {
  if (!content || typeof document === 'undefined') return content
  if (!kbRichHtmlHasTableMarkup(content)) return content

  const root = document.createElement('div')
  root.innerHTML = content
  let changed = false

  const isPxNumber = (value: string) => /^\d+(\.\d+)?$/.test(value.trim())

  root.querySelectorAll('table').forEach((node) => {
    const table = node as HTMLTableElement
    const width = table.getAttribute('width')
    const hasColWidths = Boolean(table.querySelector('col[width], td[width], th[width]'))
    if (!width && !hasColWidths) return

    if (table.style.tableLayout !== 'fixed') {
      table.style.tableLayout = 'fixed'
      changed = true
    }
    table.classList.add('kb-table-resized')
    if (width) {
      const next = isPxNumber(width) ? `${width.trim()}px` : width.trim()
      if (table.style.width !== next) {
        table.style.width = next
        changed = true
      }
    } else {
      changed = true
    }
  })

  root.querySelectorAll('col[width], td[width], th[width]').forEach((node) => {
    const el = node as HTMLElement
    const width = el.getAttribute('width')
    if (!width || !isPxNumber(width)) return
    const next = `${width.trim()}px`
    if (el.style.width !== next) {
      el.style.width = next
      changed = true
    }
    if ((el.tagName === 'TD' || el.tagName === 'TH') && el.style.minWidth !== next) {
      el.style.minWidth = next
      changed = true
    }
  })

  root.querySelectorAll('tr[height], td[height], th[height]').forEach((node) => {
    const el = node as HTMLElement
    const height = el.getAttribute('height')
    if (!height || !isPxNumber(height)) return
    const next = `${height.trim()}px`
    if (el.style.height !== next) {
      el.style.height = next
      changed = true
    }
  })

  return changed ? root.innerHTML : content
}

export function sanitizeKbRichHtmlPreservingTables(
  content: string,
  purify: (html: string) => string,
): string {
  if (!kbRichHtmlHasTableMarkup(content)) {
    return purify(content)
  }

  const { shell, tables } = splitKbRichHtmlTableBlocks(content)
  const cleanShell = purify(shell)
  const cleanTables = tables.map((tableHtml) => {
    // Resized tables already carry width/height — purify only.
    // Running normalize/rebuild here was dropping live column sizes before PATCH.
    if (/\bwidth\s*=/i.test(tableHtml) || /\bheight\s*=/i.test(tableHtml)) {
      return purify(tableHtml)
    }
    return purify(normalizeKbRichTableHtml(tableHtml))
  })
  return mergeKbRichHtmlTableBlocks(cleanShell, cleanTables)
}
