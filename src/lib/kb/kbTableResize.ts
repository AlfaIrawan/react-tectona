/** Column/row resize helpers for KB contentEditable tables. */

import { scrubLiveKbElementStyles } from './kbInlineStyleScrub'

const EDGE_PX = 10
const MIN_COL_PX = 48
const MIN_ROW_PX = 28

export type KbTableResizeHit =
  | { mode: 'col'; table: HTMLTableElement; colIndex: number; startSize: number; tableWidth: number; siblingWidths: number[] }
  | { mode: 'row'; table: HTMLTableElement; row: HTMLTableRowElement; startSize: number }

export type KbTableResizeSession = KbTableResizeHit & {
  startPos: number
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

function measurePx(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value)
}

function setImportantPx(el: HTMLElement, prop: 'width' | 'minWidth' | 'height' | 'tableLayout', value: string): void {
  el.style.setProperty(prop === 'minWidth' ? 'min-width' : prop === 'tableLayout' ? 'table-layout' : prop, value, 'important')
}

export function readKbCellWidthPx(cell: HTMLTableCellElement | null | undefined): number | null {
  if (!cell) return null
  return (
    parsePxSize(cell.style.width)
    || parsePxSize(cell.getAttribute('width'))
    || measurePx(cell.getBoundingClientRect().width)
    || measurePx(cell.offsetWidth)
  )
}

export function readKbRowHeightPx(row: HTMLTableRowElement | null | undefined): number | null {
  if (!row) return null
  return (
    parsePxSize(row.style.height)
    || parsePxSize(row.getAttribute('height'))
    || measurePx(row.getBoundingClientRect().height)
    || measurePx(row.offsetHeight)
  )
}

function ensureColgroup(table: HTMLTableElement, columnCount: number): HTMLTableColElement[] {
  let colgroup = table.querySelector('colgroup')
  if (!colgroup) {
    colgroup = document.createElement('colgroup')
    table.insertBefore(colgroup, table.firstChild)
  }
  while (colgroup.children.length < columnCount) {
    colgroup.appendChild(document.createElement('col'))
  }
  while (colgroup.children.length > columnCount) {
    colgroup.lastElementChild?.remove()
  }
  return Array.from(colgroup.children) as HTMLTableColElement[]
}

function writeColumnWidth(table: HTMLTableElement, colIndex: number, widthPx: number): void {
  const next = Math.max(MIN_COL_PX, Math.round(widthPx))
  const columnCount = table.rows[0]?.cells.length ?? 0
  const cols = ensureColgroup(table, columnCount)
  const col = cols[colIndex]
  if (col) {
    setImportantPx(col, 'width', `${next}px`)
    col.setAttribute('width', String(next))
  }
  for (const row of Array.from(table.rows)) {
    const cell = row.cells[colIndex]
    if (!cell) continue
    setImportantPx(cell, 'width', `${next}px`)
    setImportantPx(cell, 'minWidth', `${next}px`)
    cell.setAttribute('width', String(next))
  }
}

function writeTableWidth(table: HTMLTableElement, widthPx: number): void {
  const next = Math.max(MIN_COL_PX, Math.round(widthPx))
  setImportantPx(table, 'tableLayout', 'fixed')
  setImportantPx(table, 'width', `${next}px`)
  table.setAttribute('width', String(next))
  table.classList.add('kb-table-resized')
}

/**
 * Stamp the current visual column/row sizes into width/height attributes + styles.
 * Call before save and after resize so sizes survive sanitize/reload.
 *
 * @param force When true, stamp every table (save path). When false, only tables already
 *              marked as resized / carrying width attrs.
 */
export function persistLiveKbTableSizes(root: HTMLElement, force = false): boolean {
  const tables = Array.from(root.querySelectorAll('table'))
  if (tables.length === 0) return false
  let changed = false

  for (const table of tables) {
    const firstRow = table.rows[0]
    if (!firstRow || firstRow.cells.length === 0) continue

    const hasWidthHints = Boolean(
      table.getAttribute('width')
      || table.classList.contains('kb-table-resized')
      || table.querySelector('col[width], td[width], th[width]'),
    )
    if (!force && !hasWidthHints) continue

    const columnCount = firstRow.cells.length
    const widths: number[] = []
    for (let index = 0; index < columnCount; index += 1) {
      const sample = firstRow.cells[index]
      const width = readKbCellWidthPx(sample) ?? MIN_COL_PX
      widths.push(Math.max(MIN_COL_PX, width))
    }

    const tableWidth = Math.max(
      widths.reduce((sum, width) => sum + width, 0),
      measurePx(table.getBoundingClientRect().width) ?? 0,
      measurePx(table.offsetWidth) ?? 0,
      200,
    )

    writeTableWidth(table, tableWidth)
    for (let index = 0; index < columnCount; index += 1) {
      writeColumnWidth(table, index, widths[index]!)
    }

    for (const row of Array.from(table.rows)) {
      const height = readKbRowHeightPx(row)
      if (!height) continue
      const next = Math.max(MIN_ROW_PX, height)
      setImportantPx(row, 'height', `${next}px`)
      row.setAttribute('height', String(next))
      for (const cell of Array.from(row.cells)) {
        setImportantPx(cell, 'height', `${next}px`)
        cell.setAttribute('height', String(next))
      }
    }

    changed = true
  }

  return changed
}

/** Keep only layout size styles; drop Tailwind --tw-* / paste bloat before serialize. */
export function normalizeKbTableSizeStylesForSave(root: HTMLElement): void {
  scrubLiveKbElementStyles(root)
}

function snapshotColumnWidths(table: HTMLTableElement): number[] {
  const firstRow = table.rows[0]
  if (!firstRow) return []
  return Array.from(firstRow.cells).map((cell) => readKbCellWidthPx(cell) ?? MIN_COL_PX)
}

function measureTableWidthPx(table: HTMLTableElement): number {
  return Math.max(
    measurePx(table.getBoundingClientRect().width) ?? 0,
    measurePx(table.offsetWidth) ?? 0,
    snapshotColumnWidths(table).reduce((sum, width) => sum + width, 0),
    200,
  )
}

function setKbColumnWidth(
  table: HTMLTableElement,
  colIndex: number,
  widthPx: number,
  siblingWidths: number[],
  tableWidth: number,
): void {
  const firstRow = table.rows[0]
  if (!firstRow) return
  const columnCount = firstRow.cells.length
  if (columnCount === 0) return

  const next = Math.max(MIN_COL_PX, Math.round(widthPx))
  const widths = siblingWidths.map((width, index) => (index === colIndex ? next : Math.max(MIN_COL_PX, Math.round(width))))

  // Keep overall table width stable: borrow/return space from the neighbor column.
  // This stays visible even when CSS clamps the table to the panel width.
  const neighborIndex = colIndex < columnCount - 1 ? colIndex + 1 : colIndex - 1
  if (neighborIndex >= 0 && neighborIndex < columnCount) {
    const others = widths.reduce((sum, width, index) => (index === neighborIndex ? sum : sum + width), 0)
    widths[neighborIndex] = Math.max(MIN_COL_PX, Math.round(tableWidth - others))
  }

  writeTableWidth(table, tableWidth)
  for (let index = 0; index < columnCount; index += 1) {
    writeColumnWidth(table, index, widths[index]!)
  }
}

function setKbRowHeight(row: HTMLTableRowElement, heightPx: number): void {
  const next = Math.max(MIN_ROW_PX, Math.round(heightPx))
  setImportantPx(row, 'height', `${next}px`)
  row.setAttribute('height', String(next))
  for (const cell of Array.from(row.cells)) {
    setImportantPx(cell, 'height', `${next}px`)
    cell.setAttribute('height', String(next))
  }
}

/** Detect resize target from pointer position near a cell edge. */
export function hitTestKbTableResize(
  target: EventTarget | null,
  clientX: number,
  clientY: number,
): KbTableResizeHit | null {
  if (!(target instanceof Element)) return null
  const cell = target.closest('td,th') as HTMLTableCellElement | null
  if (!cell) return null
  const table = cell.closest('table')
  if (!table) return null

  const rect = cell.getBoundingClientRect()
  const nearRight = Math.abs(clientX - rect.right) <= EDGE_PX
  const nearBottom = Math.abs(clientY - rect.bottom) <= EDGE_PX

  if (nearRight) {
    const siblingWidths = snapshotColumnWidths(table)
    const startSize = siblingWidths[cell.cellIndex] ?? rect.width
    return {
      mode: 'col',
      table,
      colIndex: cell.cellIndex,
      startSize,
      tableWidth: measureTableWidthPx(table),
      siblingWidths,
    }
  }

  if (nearBottom) {
    const row = cell.parentElement as HTMLTableRowElement | null
    if (!row) return null
    return {
      mode: 'row',
      table,
      row,
      startSize: readKbRowHeightPx(row) ?? rect.height,
    }
  }

  return null
}

export function cursorForKbTableResizeHit(hit: KbTableResizeHit | null): string {
  if (!hit) return ''
  return hit.mode === 'col' ? 'col-resize' : 'row-resize'
}

export function beginKbTableResize(hit: KbTableResizeHit, clientX: number, clientY: number): KbTableResizeSession {
  if (hit.mode === 'col') {
    // Lock current visual widths once at drag start (not on every mousemove).
    writeTableWidth(hit.table, hit.tableWidth)
    for (let index = 0; index < hit.siblingWidths.length; index += 1) {
      writeColumnWidth(hit.table, index, hit.siblingWidths[index]!)
    }
  }
  return {
    ...hit,
    startPos: hit.mode === 'col' ? clientX : clientY,
  }
}

export function applyKbTableResize(session: KbTableResizeSession, clientX: number, clientY: number): void {
  if (session.mode === 'col') {
    const delta = clientX - session.startPos
    setKbColumnWidth(
      session.table,
      session.colIndex,
      session.startSize + delta,
      session.siblingWidths,
      session.tableWidth,
    )
    return
  }
  const delta = clientY - session.startPos
  setKbRowHeight(session.row, session.startSize + delta)
}

export function endKbTableResize(editor: HTMLElement | null): void {
  if (!editor) return
  persistLiveKbTableSizes(editor)
}

export function syncKbTableResizeCursor(editor: HTMLElement, clientX: number, clientY: number): void {
  const hit = hitTestKbTableResize(
    document.elementFromPoint(clientX, clientY),
    clientX,
    clientY,
  )
  const cursor = cursorForKbTableResizeHit(hit)
  if (cursor) {
    editor.style.cursor = cursor
  } else if (editor.style.cursor === 'col-resize' || editor.style.cursor === 'row-resize') {
    editor.style.cursor = ''
  }
}
