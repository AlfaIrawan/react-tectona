import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { extractSpreadsheetFromArrayBuffer, extractSpreadsheetTablesFromArrayBuffer, isSpreadsheetFile } from './extractSpreadsheetText'

describe('extractSpreadsheetText', () => {
  it('detects Excel files but not CSV', () => {
    expect(isSpreadsheetFile({ name: 'list.xlsx', type: '' })).toBe(true)
    expect(isSpreadsheetFile({ name: 'old.xls', type: '' })).toBe(true)
    expect(isSpreadsheetFile({ name: 'notes.csv', type: 'text/csv' })).toBe(false)
  })

  it('preserves sheet rows as a Markdown table', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Merk Model')
    sheet.addRow(['Merk', 'Model', 'Usia'])
    sheet.addRow(['Honda', 'Brio', 8])
    const buffer = await workbook.xlsx.writeBuffer()
    const text = await extractSpreadsheetFromArrayBuffer(new Uint8Array(buffer), 8_000)
    expect(text).toContain('SHEET: Merk Model')
    expect(text).toContain('| Merk | Model | Usia |')
    expect(text).toContain('| --- | --- | --- |')
    expect(text).toContain('Honda')
    expect(text).toContain('Brio')
  })

  it('renders deterministic HTML tables for the KB body', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Capability')
    sheet.addRow(['Pillar', 'Status'])
    sheet.addRow(['Channels', 'Existing'])
    const buffer = await workbook.xlsx.writeBuffer()
    const html = await extractSpreadsheetTablesFromArrayBuffer(new Uint8Array(buffer), 8_000)
    expect(html).toContain('<h3>Capability</h3>')
    expect(html).toContain('<th>Pillar</th>')
    expect(html).toContain('<td>Existing</td>')
  })
})
