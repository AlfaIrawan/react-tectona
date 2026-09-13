import type { Workbook as ExcelWorkbook } from 'exceljs'

const MAX_SPREADSHEET_BYTES = 15 * 1024 * 1024
const MAX_SHEETS = 12
const MAX_TABLE_COLUMNS = 20
const MAX_TABLE_ROWS_PER_SHEET = 250

export function isSpreadsheetFile(file: Pick<File, 'name' | 'type'>): boolean {
  const name = file.name.toLowerCase()
  const type = (file.type || '').toLowerCase()
  if (name.endsWith('.csv')) return false
  return (
    name.endsWith('.xlsx')
    || name.endsWith('.xlsm')
    || name.endsWith('.xls')
    || type.includes('spreadsheetml')
    || type.includes('ms-excel')
  )
}

function cellToPlain(value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim()
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'object') {
    const obj = value as {
      text?: unknown
      result?: unknown
      richText?: Array<{ text?: string }>
      hyperlink?: unknown
    }
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((part) => part.text ?? '').join('').trim()
    }
    if (obj.result != null) return cellToPlain(obj.result)
    if (typeof obj.text === 'string') return obj.text.trim()
    if (typeof obj.hyperlink === 'string') return obj.hyperlink.trim()
  }
  return ''
}

function normalizeCell(value: string): string {
  return value.replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim()
}

function escapeMarkdownCell(value: string): string {
  return normalizeCell(value).replace(/\\/g, '\\\\').replace(/\|/g, '\\|')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

type SpreadsheetSheet = {
  name: string
  rows: string[][]
}

function readWorkbookSheets(workbook: ExcelWorkbook): SpreadsheetSheet[] {
  return workbook.worksheets.slice(0, MAX_SHEETS).flatMap((sheet) => {
    let firstColumn = Number.POSITIVE_INFINITY
    let lastColumn = 0
    const populatedRows: number[] = []

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      let hasValue = false
      row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
        const source = cell.isMerged ? cell.master : cell
        if (!normalizeCell(cellToPlain(source.value))) return
        hasValue = true
        firstColumn = Math.min(firstColumn, columnNumber)
        lastColumn = Math.max(lastColumn, columnNumber)
      })
      if (hasValue) populatedRows.push(rowNumber)
    })

    if (!populatedRows.length || !Number.isFinite(firstColumn) || lastColumn < firstColumn) return []
    const columnCount = Math.min(MAX_TABLE_COLUMNS, lastColumn - firstColumn + 1)
    const rows = populatedRows.slice(0, MAX_TABLE_ROWS_PER_SHEET).map((rowNumber) => {
      const row = sheet.getRow(rowNumber)
      return Array.from({ length: columnCount }, (_, index) => {
        const cell = row.getCell(firstColumn + index)
        const source = cell.isMerged ? cell.master : cell
        return normalizeCell(cellToPlain(source.value))
      })
    })

    return [{ name: sheet.name, rows }]
  })
}

function renderMarkdownTables(sheets: SpreadsheetSheet[], maxChars: number): string {
  const lines: string[] = []
  let used = 0
  const push = (line: string) => {
    if (used >= maxChars) return false
    lines.push(line)
    used += line.length + 1
    return used < maxChars
  }

  for (const sheet of sheets) {
    if (!sheet.rows.length || !push(`--- SHEET: ${sheet.name} ---`)) break
    const [header, ...body] = sheet.rows
    const heading = header.map(escapeMarkdownCell)
    if (!push(`| ${heading.join(' | ')} |`)) break
    if (!push(`| ${heading.map(() => '---').join(' | ')} |`)) break
    for (const row of body) {
      if (!push(`| ${row.map(escapeMarkdownCell).join(' | ')} |`)) break
    }
    if (used >= maxChars) break
    push('')
  }

  return lines.join('\n').trim().slice(0, maxChars)
}

function renderHtmlTables(sheets: SpreadsheetSheet[], maxChars: number): string {
  const chunks: string[] = []
  let used = 0
  for (const sheet of sheets) {
    if (!sheet.rows.length || used >= maxChars) break
    const [header, ...body] = sheet.rows
    const head = `<thead><tr>${header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead>`
    const rows: string[] = []
    for (const row of body) {
      const html = `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`
      if (used + head.length + html.length > maxChars) break
      rows.push(html)
      used += html.length
    }
    const table = `<h3>${escapeHtml(sheet.name)}</h3><table>${head}<tbody>${rows.join('')}</tbody></table>`
    if (used + table.length > maxChars) break
    chunks.push(table)
    used += table.length
  }
  return chunks.join('')
}

async function getWorkbookConstructor(): Promise<new () => ExcelWorkbook> {
  if (import.meta.env.MODE !== 'test') {
    const exceljsBrowser = await import('exceljs/dist/exceljs.min.js') as {
      Workbook?: new () => ExcelWorkbook
      default?: { Workbook?: new () => ExcelWorkbook }
    }
    const Workbook = exceljsBrowser.Workbook ?? exceljsBrowser.default?.Workbook
    if (Workbook) return Workbook
  }
  const ExcelJS = await import('exceljs')
  const Workbook = ExcelJS.Workbook
    ?? (ExcelJS as { default?: { Workbook?: new () => ExcelWorkbook } }).default?.Workbook
  if (!Workbook) throw new Error('Excel engine is unavailable.')
  return Workbook
}

/** Preserve workbook rows and columns as Markdown tables for KB generation. */
export async function extractSpreadsheetFromArrayBuffer(
  data: ArrayBuffer | Uint8Array,
  maxChars: number,
): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_SPREADSHEET_BYTES) return ''
  const Workbook = await getWorkbookConstructor()
  const workbook = new Workbook()
  try {
    await workbook.xlsx.load(bytes)
  } catch {
    return ''
  }

  return renderMarkdownTables(readWorkbookSheets(workbook), maxChars)
}

export async function extractSpreadsheetText(file: File, maxChars: number): Promise<string> {
  const buffer = typeof file.arrayBuffer === 'function'
    ? await file.arrayBuffer()
    : await new Response(file).arrayBuffer()
  return extractSpreadsheetFromArrayBuffer(buffer, maxChars)
}

/** Deterministic HTML tables for the KB body; independent of LLM table formatting. */
export async function extractSpreadsheetTablesFromArrayBuffer(
  data: ArrayBuffer | Uint8Array,
  maxChars: number,
): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_SPREADSHEET_BYTES) return ''
  const Workbook = await getWorkbookConstructor()
  const workbook = new Workbook()
  try {
    await workbook.xlsx.load(bytes)
  } catch {
    return ''
  }
  return renderHtmlTables(readWorkbookSheets(workbook), maxChars)
}

export async function extractSpreadsheetTablesHtml(file: File, maxChars: number): Promise<string> {
  const buffer = typeof file.arrayBuffer === 'function'
    ? await file.arrayBuffer()
    : await new Response(file).arrayBuffer()
  return extractSpreadsheetTablesFromArrayBuffer(buffer, maxChars)
}
