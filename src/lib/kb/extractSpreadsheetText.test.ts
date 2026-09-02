import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { extractSpreadsheetFromArrayBuffer, isSpreadsheetFile } from './extractSpreadsheetText'

describe('extractSpreadsheetText', () => {
  it('detects Excel files but not CSV', () => {
    expect(isSpreadsheetFile({ name: 'list.xlsx', type: '' })).toBe(true)
    expect(isSpreadsheetFile({ name: 'old.xls', type: '' })).toBe(true)
    expect(isSpreadsheetFile({ name: 'notes.csv', type: 'text/csv' })).toBe(false)
  })

  it('flattens sheet rows into searchable text', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Merk Model')
    sheet.addRow(['Merk', 'Model', 'Usia'])
    sheet.addRow(['Honda', 'Brio', 8])
    const buffer = await workbook.xlsx.writeBuffer()
    const text = await extractSpreadsheetFromArrayBuffer(new Uint8Array(buffer), 8_000)
    expect(text).toContain('SHEET: Merk Model')
    expect(text).toContain('Honda')
    expect(text).toContain('Brio')
  })
})
