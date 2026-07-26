/** Column visibility limits for KB rich tables (View): hide extras instead of sticky/scroll. */

export type KbTableDensityMode = 'maximize' | 'minimize'

export const KB_TABLE_MAX_VISIBLE_COLUMNS: Record<KbTableDensityMode, number> = {
  maximize: 5,
  minimize: 2,
}

export function getKbTableColumnCount(table: HTMLTableElement): number {
  let max = 0
  for (const row of Array.from(table.rows)) {
    max = Math.max(max, row.cells.length)
  }
  if (max > 0) return max
  const headerRow = table.tHead?.rows[0]
  if (headerRow) return Math.max(headerRow.cells.length, 1)
  return 1
}

export function readKbTableColumnLabels(table: HTMLTableElement): string[] {
  const count = getKbTableColumnCount(table)
  const headerRow = table.tHead?.rows[0] ?? table.rows[0] ?? null
  return Array.from({ length: count }, (_, index) => {
    const cell = headerRow?.cells[index]
    const label = (cell?.textContent ?? '').replace(/\s+/g, ' ').trim()
    return label || `Column ${index + 1}`
  })
}

/** Default: first N columns visible for the density mode. */
export function defaultKbVisibleColumnIndexes(
  columnCount: number,
  mode: KbTableDensityMode,
): number[] {
  const max = KB_TABLE_MAX_VISIBLE_COLUMNS[mode]
  const limit = Math.min(Math.max(columnCount, 0), max)
  return Array.from({ length: limit }, (_, index) => index)
}

/**
 * Keep currently selected columns when switching density, but never exceed the mode max.
 * Prefer keeping earlier indexes when trimming.
 */
export function clampKbVisibleColumnIndexes(
  selected: number[],
  columnCount: number,
  mode: KbTableDensityMode,
): number[] {
  const max = KB_TABLE_MAX_VISIBLE_COLUMNS[mode]
  const unique = Array.from(new Set(selected))
    .filter((index) => Number.isInteger(index) && index >= 0 && index < columnCount)
    .sort((a, b) => a - b)
  if (unique.length === 0) return defaultKbVisibleColumnIndexes(columnCount, mode)
  if (unique.length <= max) return unique
  return unique.slice(0, max)
}

/** Toggle one column while respecting the max for the density mode. */
export function toggleKbVisibleColumnIndex(
  selected: number[],
  columnIndex: number,
  columnCount: number,
  mode: KbTableDensityMode,
): number[] {
  if (columnIndex < 0 || columnIndex >= columnCount) return selected
  const max = KB_TABLE_MAX_VISIBLE_COLUMNS[mode]
  const set = new Set(selected)
  if (set.has(columnIndex)) {
    if (set.size <= 1) return selected // keep at least one column
    set.delete(columnIndex)
  } else {
    if (set.size >= max) return selected
    set.add(columnIndex)
  }
  return Array.from(set).sort((a, b) => a - b)
}

/**
 * Build CSS that hides non-visible columns with !important so it survives
 * Tailwind / table-cell utilities. Pair with stamped data-kb-table-index in HTML.
 * Also forces the table to full container width and redistributes width across
 * only the visible columns (hidden cols must not leave empty space).
 */
export function buildKbTableColumnVisibilityCss(
  scopeSelector: string,
  columnCount: number,
  visibleIndexes: number[],
): string {
  const visible = new Set(
    visibleIndexes.filter((index) => Number.isInteger(index) && index >= 0 && index < columnCount),
  )
  if (visible.size === 0) {
    defaultKbVisibleColumnIndexes(columnCount, 'minimize').forEach((index) => visible.add(index))
  }

  const visibleCount = visible.size
  const colWidth = `${(100 / Math.max(visibleCount, 1)).toFixed(4)}%`
  const sortedVisible = Array.from(visible).sort((a, b) => a - b)

  const layoutRule = [
    `${scopeSelector} {`,
    '  width: 100% !important;',
    '  max-width: 100% !important;',
    '  min-width: 100% !important;',
    '  table-layout: fixed !important;',
    '}',
    `${scopeSelector} colgroup col { display: none !important; width: auto !important; }`,
    `${scopeSelector} tr > th, ${scopeSelector} tr > td {`,
    '  display: none !important;',
    '  width: auto !important;',
    '  min-width: 0 !important;',
    '  max-width: none !important;',
    '}',
  ].join('\n')

  const showCellSelectors = sortedVisible.flatMap((index) => {
    const nth = index + 1
    return [
      `${scopeSelector} tr > th:nth-child(${nth})`,
      `${scopeSelector} tr > td:nth-child(${nth})`,
    ]
  })
  const showColSelectors = sortedVisible.map((index) => (
    `${scopeSelector} colgroup col:nth-child(${index + 1})`
  ))

  const showCellsRule = showCellSelectors.length
    ? `${showCellSelectors.join(', ')} { display: table-cell !important; width: ${colWidth} !important; min-width: 0 !important; }`
    : ''
  const showColsRule = showColSelectors.length
    ? `${showColSelectors.join(', ')} { display: table-column !important; width: ${colWidth} !important; }`
    : ''

  return [layoutRule, showColsRule, showCellsRule].filter(Boolean).join('\n')
}

/** Apply column visibility directly on live DOM (editor). CSS may also be injected by callers. */
export function applyKbTableColumnVisibility(
  table: HTMLTableElement,
  visibleIndexes: number[],
): void {
  const columnCount = getKbTableColumnCount(table)
  const visible = new Set(
    visibleIndexes.filter((index) => Number.isInteger(index) && index >= 0 && index < columnCount),
  )
  if (visible.size === 0) {
    defaultKbVisibleColumnIndexes(columnCount, 'minimize').forEach((index) => visible.add(index))
  }

  const visibleCount = Math.max(visible.size, 1)
  const colWidth = `${(100 / visibleCount).toFixed(4)}%`

  table.classList.add('kb-table-column-limited')
  table.style.setProperty('width', '100%', 'important')
  table.style.setProperty('max-width', '100%', 'important')
  table.style.setProperty('table-layout', 'fixed', 'important')
  table.removeAttribute('width')

  for (const row of Array.from(table.rows)) {
    for (let index = 0; index < row.cells.length; index += 1) {
      const cell = row.cells[index]
      if (!cell) continue
      const show = visible.has(index)
      cell.hidden = !show
      if (show) {
        cell.style.setProperty('display', 'table-cell', 'important')
        cell.style.setProperty('width', colWidth, 'important')
        cell.style.setProperty('min-width', '0', 'important')
      } else {
        cell.style.setProperty('display', 'none', 'important')
      }
    }
  }

  table.querySelectorAll('colgroup col').forEach((node, index) => {
    const col = node as HTMLElement
    if (visible.has(index)) {
      col.style.setProperty('display', 'table-column', 'important')
      col.style.setProperty('width', colWidth, 'important')
    } else {
      col.style.setProperty('display', 'none', 'important')
    }
  })

  table.setAttribute(
    'data-kb-visible-cols',
    Array.from(visible).sort((a, b) => a - b).join(','),
  )
}

/** Stamp stable table indexes into HTML so column CSS survives React innerHTML refreshes.
 * Also drops fixed table width attrs so visible columns can expand to the container.
 */
export function stampKbTableIndexesInHtml(html: string): string {
  if (!html || !/<table\b/i.test(html)) return html
  let index = 0
  return html.replace(/<table\b([^>]*)>/gi, (_full, attrs: string) => {
    let cleaned = String(attrs)
      .replace(/\sdata-kb-table-index\s*=\s*(['"]).*?\1/gi, '')
      .replace(/\sdata-kb-table-index\s*=\s*[^\s>]+/gi, '')
      .replace(/\swidth\s*=\s*(['"]).*?\1/gi, '')
      .replace(/\swidth\s*=\s*[^\s>]+/gi, '')

    const classMatch = cleaned.match(/\sclass\s*=\s*(['"])(.*?)\1/i)
    if (classMatch) {
      const classes = new Set(classMatch[2].split(/\s+/).filter(Boolean))
      classes.add('kb-table-column-limited')
      cleaned = cleaned.replace(/\sclass\s*=\s*(['"]).*?\1/i, ` class="${Array.from(classes).join(' ')}"`)
    } else {
      cleaned = `${cleaned} class="kb-table-column-limited"`
    }

    return `<table${cleaned} data-kb-table-index="${index++}">`
  })
}
