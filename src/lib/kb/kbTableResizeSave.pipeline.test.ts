import { describe, expect, it } from 'vitest'
import DOMPurify from 'dompurify'
import {
  applyKbTableLayoutStylesFromAttrs,
  sanitizeKbRichHtmlPreservingTables,
} from './kbRichTableHtml'
import {
  applyKbTableResize,
  beginKbTableResize,
  normalizeKbTableSizeStylesForSave,
  persistLiveKbTableSizes,
} from './kbTableResize'

const ALLOWED_TAGS = ['p','br','strong','b','em','i','u','ul','ol','li','h1','h2','h3','blockquote','a','pre','code','table','thead','tbody','tr','th','td','colgroup','col']
const ALLOWED_ATTR = ['href','target','rel','colspan','rowspan','width','height','style']

function purify(html: string) {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOW_DATA_ATTR: false })
}

/** Mirrors readKbEditorContentForSave: stamp → normalize styles → purify (no rebuild). */
function savePipeline(root: HTMLElement): string {
  persistLiveKbTableSizes(root, true)
  normalizeKbTableSizeStylesForSave(root)
  const purified = sanitizeKbRichHtmlPreservingTables(root.innerHTML, purify)
  return applyKbTableLayoutStylesFromAttrs(purified)
}

describe('resize save pipeline', () => {
  it('keeps resized widths through the real save path (no table rebuild)', () => {
    const root = document.createElement('div')
    root.innerHTML = '<table><tbody><tr><td><strong>adira.co.id</strong></td><td>Website sebagai informasi</td></tr><tr><td><strong>ACCTION</strong></td><td>Loan Origination</td></tr></tbody></table>'
    document.body.appendChild(root)
    const table = root.querySelector('table') as HTMLTableElement
    const cell0 = table.rows[0].cells[0]
    const cell1 = table.rows[0].cells[1]

    Object.defineProperty(cell0, 'getBoundingClientRect', {
      value: () => ({ width: 100, height: 24, top: 0, left: 0, right: 100, bottom: 24, x: 0, y: 0, toJSON: () => ({}) }),
    })
    Object.defineProperty(cell1, 'getBoundingClientRect', {
      value: () => ({ width: 300, height: 24, top: 0, left: 100, right: 400, bottom: 24, x: 100, y: 0, toJSON: () => ({}) }),
    })
    Object.defineProperty(table, 'getBoundingClientRect', {
      value: () => ({ width: 400, height: 48, top: 0, left: 0, right: 400, bottom: 48, x: 0, y: 0, toJSON: () => ({}) }),
    })
    Object.defineProperty(table, 'offsetWidth', { value: 400 })
    Object.defineProperty(cell0, 'offsetWidth', { value: 100 })
    Object.defineProperty(cell1, 'offsetWidth', { value: 300 })

    const session = beginKbTableResize(
      {
        mode: 'col',
        table,
        colIndex: 0,
        startSize: 100,
        tableWidth: 400,
        siblingWidths: [100, 300],
      },
      100,
      0,
    )
    applyKbTableResize(session, 140, 0)

    const saved = savePipeline(root)

    expect(saved).toMatch(/width="140"/)
    expect(saved).toMatch(/<table[^>]*width="\d+"/)
    expect(saved).toContain('table-layout: fixed')
    expect(saved).toContain('width: 140px')

    // Simulate backend keep + reload rehydrate
    const reloaded = applyKbTableLayoutStylesFromAttrs(purify(saved))
    expect(reloaded).toMatch(/width="140"/)
    expect(reloaded).toContain('width: 140px')

    document.body.removeChild(root)
  })
})
