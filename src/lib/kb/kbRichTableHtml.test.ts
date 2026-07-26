import { describe, expect, it } from 'vitest'
import DOMPurify from 'dompurify'
import {
  applyKbTableLayoutStylesFromAttrs,
  captureKbEditorHtml,
  kbRichHtmlHasTableMarkup,
  kbRichHtmlNeedsTableRepair,
  mergeKbRichHtmlTableBlocks,
  prepareKbRichHtmlContent,
  repairKbMashedTableHtml,
  sanitizeKbRichHtmlPreservingTables,
  serializeKbRichHtmlFromRoot,
  splitKbRichHtmlTableBlocks,
} from './kbRichTableHtml'

describe('kbRichTableHtml', () => {
  it('detects mashed catalog content without table markup', () => {
    const mashed = [
      '<h2>Katalog Aplikasi Adira Finance</h2>',
      '<p>Daftar aplikasi enterprise.</p>',
      'NoAplikasiCategoryRingkasanPlatform1OneInAplikasi internal',
    ].join('')

    expect(kbRichHtmlNeedsTableRepair(mashed)).toBe(true)
  })

  it('does not flag healthy table html', () => {
    const html = '<h2>Katalog</h2><table><thead><tr><th>No</th><th>Aplikasi</th></tr></thead><tbody><tr><td>1</td><td>OneIn</td></tr></tbody></table>'
    expect(kbRichHtmlNeedsTableRepair(html)).toBe(false)
    expect(kbRichHtmlHasTableMarkup(html)).toBe(true)
  })

  it('does not treat governance narrative HTML as a mashed catalog table', () => {
    const governance = [
      '<h2>Tujuan</h2>',
      '<p>Standar ini mengatur struktur Knowledge Base (KB) untuk dokumen Memo Internal.</p>',
      '<h2>Ringkasan Ketentuan</h2>',
      '<p>Ringkasan substantif. Status active|revoked. deploy ulang aplikasi.</p>',
      '<p>dynamic_sections: Lampiran 0..N, tidak dibatasi angka tetap.</p>',
    ].join('')

    expect(kbRichHtmlNeedsTableRepair(governance)).toBe(false)
    expect(repairKbMashedTableHtml(governance)).toBe(governance)
    expect(kbRichHtmlHasTableMarkup(repairKbMashedTableHtml(governance))).toBe(false)
  })

  it('splits and merges table blocks', () => {
    const html = '<h2>Title</h2><table><tbody><tr><td>1</td></tr></tbody></table>'
    const { shell, tables } = splitKbRichHtmlTableBlocks(html)
    expect(shell).toContain('@@KB-TABLE-0@@')
    expect(tables).toHaveLength(1)
    expect(mergeKbRichHtmlTableBlocks(shell, tables)).toBe(html)
  })

  it('preserves tables through placeholder sanitization', () => {
    const html = '<h2>Katalog</h2><p>intro</p><table><thead><tr><th>No</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>'
    const cleaned = sanitizeKbRichHtmlPreservingTables(html, (value) => value)
    expect(cleaned).toContain('<table>')
    expect(cleaned).toContain('<th>No</th>')
  })

  it('rebuilds mashed catalog rows into a table', () => {
    const mashed = [
      '<h2>Katalog Aplikasi Adira Finance</h2>',
      '<p>Daftar aplikasi enterprise.</p>',
      'NoAplikasiCategoryRingkasanPlatform',
      '1OneInAplikasi internalRingkasan OneIn.Internal',
      '2OneExAplikasi eksternalRingkasan OneEx.Internal',
      '5SAP FIORISAP — User ExperienceRingkasan Fiori.SAP ERP',
      '7SAP MMSAP — Materials ManagementRingkasan MM.SAP ERP',
    ].join('')

    const repaired = repairKbMashedTableHtml(mashed)
    expect(kbRichHtmlHasTableMarkup(repaired)).toBe(true)
    expect(repaired).toContain('<th>Aplikasi</th>')
    expect(repaired).toContain('<strong>OneIn</strong>')
    expect(repaired).toContain('<strong>SAP FIORI</strong>')
    expect(repaired).toContain('<strong>SAP MM</strong>')
    expect(repaired).toContain('SAP ERP')
    expect(repaired).toContain('<h2>Katalog Aplikasi Adira Finance</h2>')
  })

  it('rebuilds mashed custom table with Status column', () => {
    const mashed = [
      '<h2>Daftar Aplikasi</h2>',
      'NoAplikasiCategoryRingkasanStatus',
      '1adira.co.idBusiness ApplicationWebsite sebagai informasi perusahaan untuk customerON',
    ].join('')

    const repaired = repairKbMashedTableHtml(mashed)
    expect(kbRichHtmlHasTableMarkup(repaired)).toBe(true)
    expect(repaired).toContain('<th>Status</th>')
    expect(repaired).toContain('adira.co.id')
    expect(repaired).toContain('Business Application')
    expect(repaired).toContain('>ON</td>')
  })

  it('serializes live editor table markup from DOM', () => {
    const root = document.createElement('div')
    root.innerHTML = [
      '<h2>Daftar Aplikasi</h2>',
      '<table><thead><tr><th>No</th><th>Aplikasi</th></tr></thead>',
      '<tbody><tr><td>1</td><td><strong>adira.co.id</strong></td></tr></tbody></table>',
    ].join('')

    const serialized = serializeKbRichHtmlFromRoot(root)
    expect(serialized).toContain('<table>')
    expect(serialized).toContain('<thead>')
    expect(serialized).toContain('<tbody>')
    expect(serialized).toContain('<strong>adira.co.id</strong>')
    expect(captureKbEditorHtml(root, root.innerHTML)).toBe(serialized)
  })

  it('keeps six aligned columns when a header cell is empty', () => {
    const root = document.createElement('div')
    root.innerHTML = [
      '<table><thead><tr>',
      '<th>No</th><th></th><th>Category</th><th>Ringkasan</th><th>Platform</th><th>Status</th>',
      '</tr></thead><tbody><tr>',
      '<td>1</td><td><strong>adira.co.id</strong></td><td>Business Application</td>',
      '<td>Test</td><td>Web</td><td>ON</td>',
      '</tr></tbody></table>',
    ].join('')

    const serialized = captureKbEditorHtml(root, root.innerHTML)
    expect(serialized).toContain('<th>Aplikasi</th>')
    expect(serialized).toContain('<strong>adira.co.id</strong>')
    expect(serialized).toContain('<td>Test</td>')
    expect(serialized).toContain('<td>Web</td>')
    expect(serialized).toContain('>ON</td>')
    expect(serialized.match(/<td/g)?.length).toBe(6)
    expect(serialized.match(/<th>/g)?.length).toBe(6)
  })

  it('does not shift columns when the browser merges two cells with colspan', () => {
    // contentEditable merged "Test" + "Web" into one colspan=2 cell while editing.
    const root = document.createElement('div')
    root.innerHTML = [
      '<table><thead><tr>',
      '<th>No</th><th>Aplikasi</th><th>Category</th><th>Ringkasan</th><th>Platform</th><th>Status</th>',
      '</tr></thead><tbody><tr>',
      '<td>1</td><td>adira.co.id</td><td>Business Application</td>',
      '<td colspan="2">TestWeb</td><td>ON</td>',
      '</tr></tbody></table>',
    ].join('')

    const serialized = captureKbEditorHtml(root, root.innerHTML)
    // Grid stays 6 wide: merged content in its slot, spanned slot blank, Status keeps "ON" (not shifted/empty).
    expect(serialized.match(/<th>/g)?.length).toBe(6)
    expect(serialized.match(/<td/g)?.length).toBe(6)
    expect(serialized).toContain('TestWeb')
    expect(serialized).toContain('>ON</td>')
    // "ON" must remain the LAST cell (the Status column), not fall off into an empty trailing cell.
    expect(serialized).toMatch(/>ON<\/td><\/tr>/)
    // No colspan leaks into the rebuilt output (spans are expanded into discrete columns).
    expect(serialized).not.toContain('colspan')
  })

  it('keeps a row aligned to the header when a data cell is missing entirely', () => {
    const root = document.createElement('div')
    root.innerHTML = [
      '<table><thead><tr>',
      '<th>No</th><th>Aplikasi</th><th>Category</th><th>Ringkasan</th><th>Platform</th><th>Status</th>',
      '</tr></thead><tbody><tr>',
      '<td>1</td><td>adira.co.id</td><td>Business Application</td><td>Test</td><td>Web</td>',
      '</tr></tbody></table>',
    ].join('')

    const serialized = captureKbEditorHtml(root, root.innerHTML)
    expect(serialized.match(/<th>/g)?.length).toBe(6)
    expect(serialized.match(/<td/g)?.length).toBe(6)
  })

  it('renders a headerless data table without synthetic "Kolom N" and trims trailing empty columns', () => {
    const root = document.createElement('div')
    // Mirrors the stored numbered "Isu" table: 3 real cells + trailing empties.
    root.innerHTML = [
      '<table><tbody>',
      '<tr><td>1</td><td>Strategi dan tujuan bisnis</td><td>Perubahan strategi.</td><td></td><td></td><td></td></tr>',
      '<tr><td>2</td><td>Perubahan organisasi</td><td>Perubahan organisasi.</td><td></td><td></td><td></td></tr>',
      '</tbody></table>',
    ].join('')

    const out = captureKbEditorHtml(root, root.innerHTML)
    expect(out).not.toContain('Kolom')          // no synthetic headers
    expect(out).not.toContain('<thead>')        // headerless stays headerless
    expect(out.match(/<td/g)?.length).toBe(6)   // 2 rows x 3 columns (trailing empties trimmed)
    expect(out).toContain('<td>Strategi dan tujuan bisnis</td>')
  })

  it('preserves resized column widths and row heights when serializing', () => {
    const root = document.createElement('div')
    root.innerHTML = [
      '<table width="400"><colgroup><col width="120"><col width="280"></colgroup><tbody>',
      '<tr height="52"><td width="120" height="52">A</td><td width="280" height="52">B</td></tr>',
      '</tbody></table>',
    ].join('')

    const out = captureKbEditorHtml(root, root.innerHTML)
    expect(out).toContain('width="400"')
    expect(out).toContain('width="120"')
    expect(out).toContain('width="280"')
    expect(out).toContain('height="52"')
    expect(out).toContain('<colgroup>')
  })

  it('keeps table width after prepare + purify-like normalize so resized layout can reapply', () => {
    const root = document.createElement('div')
    root.innerHTML = '<table><tbody><tr><td style="width: 90px" width="90">Name</td><td style="width: 310px" width="310">Desc</td></tr></tbody></table>'
    const table = root.querySelector('table') as HTMLTableElement
    table.style.tableLayout = 'fixed'
    table.style.width = '400px'
    table.setAttribute('width', '400')

    const prepared = prepareKbRichHtmlContent(captureKbEditorHtml(root, root.innerHTML))
    expect(prepared).toMatch(/<table[^>]*width="400"/)
    expect(prepared).toContain('width="90"')
    expect(prepared).toContain('width="310"')
  })

  it('rehydrates table-layout styles from width attributes for display after save/reload', () => {
    const html = '<table width="400"><colgroup><col width="120"><col width="280"></colgroup><tbody><tr><td width="120">A</td><td width="280">B</td></tr></tbody></table>'
    const out = applyKbTableLayoutStylesFromAttrs(html)
    expect(out).toContain('table-layout: fixed')
    expect(out).toContain('width: 400px')
    expect(out).toContain('width: 120px')
    expect(out).toContain('width: 280px')
  })

  it('preserves insert-table capability attributes while rebuilding', () => {
    const root = document.createElement('div')
    root.innerHTML = [
      '<table data-kb-header-row="true" data-kb-first-column="true" ',
      'data-kb-total-row="true" data-kb-last-column="true" ',
      'data-kb-banded-rows="true" data-kb-banded-columns="true">',
      '<thead><tr><th>A</th><th>B</th></tr></thead>',
      '<tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
    ].join('')

    const out = prepareKbRichHtmlContent(captureKbEditorHtml(root, root.innerHTML))
    expect(out).toContain('data-kb-header-row="true"')
    expect(out).toContain('data-kb-first-column="true"')
    expect(out).toContain('data-kb-total-row="true"')
    expect(out).toContain('data-kb-last-column="true"')
    expect(out).toContain('data-kb-banded-rows="true"')
    expect(out).toContain('data-kb-banded-columns="true"')
  })

  it('keeps allowlisted table capability attributes through DOMPurify', () => {
    const html = '<table data-kb-header-row="true" data-kb-banded-rows="true" data-unsafe="x"><tbody><tr><td>A</td></tr></tbody></table>'
    const out = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['table', 'tbody', 'tr', 'td'],
      ALLOWED_ATTR: ['data-kb-header-row', 'data-kb-banded-rows'],
      ALLOW_DATA_ATTR: false,
    })
    expect(out).toContain('data-kb-header-row="true"')
    expect(out).toContain('data-kb-banded-rows="true"')
    expect(out).not.toContain('data-unsafe')
  })
})
