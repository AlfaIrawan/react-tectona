import type { Workbook as ExcelWorkbook } from 'exceljs'

const MAX_SPREADSHEET_BYTES = 15 * 1024 * 1024
const MAX_SHEETS = 12

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

/** Flatten workbook sheets into tab-separated text for KB generation. */
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

  const lines: string[] = []
  let used = 0
  for (const sheet of workbook.worksheets.slice(0, MAX_SHEETS)) {
    const heading = `--- SHEET: ${sheet.name} ---`
    lines.push(heading)
    used += heading.length + 1
    sheet.eachRow({ includeEmpty: false }, (row) => {
      if (used >= maxChars) return
      const values = Array.isArray(row.values) ? row.values.slice(1) : []
      const line = values.map((cell) => cellToPlain(cell)).join('\t').replace(/\t+$/g, '')
      if (!line.trim()) return
      lines.push(line)
      used += line.length + 1
    })
    if (used >= maxChars) break
  }

  return lines.join('\n').trim().slice(0, maxChars)
}

export async function extractSpreadsheetText(file: File, maxChars: number): Promise<string> {
  const buffer = typeof file.arrayBuffer === 'function'
    ? await file.arrayBuffer()
    : await new Response(file).arrayBuffer()
  return extractSpreadsheetFromArrayBuffer(buffer, maxChars)
}
