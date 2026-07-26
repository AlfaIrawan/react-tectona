import { describe, expect, it } from 'vitest'
import { repairKbInlineBoldHtml } from './kbInlineBoldRepair'

describe('repairKbInlineBoldHtml', () => {
  it('converts bold-only spans to strong', () => {
    const input = '<p><span style="font-weight: 700">Name</span></p>'
    const out = repairKbInlineBoldHtml(input)
    expect(out).toContain('<strong>Name</strong>')
    expect(out).not.toContain('font-weight')
  })

  it('does not destroy heading / doc styles that include font-weight', () => {
    const input = [
      '<h1 data-kb-style="heading" style="font-size: 24px; font-weight: 700; color: #0f766e">',
      'Katalog Aplikasi Adira Finance',
      '</h1>',
      '<p><span style="font-size: 18px; font-weight: 700; color: #dc2626">Teks</span></p>',
    ].join('')

    const out = repairKbInlineBoldHtml(input)

    expect(out).toContain('data-kb-style="heading"')
    expect(out).toMatch(/font-size:\s*24px/i)
    expect(out).toMatch(/color:\s*(#0f766e|rgb\(15,\s*118,\s*110\))/i)
    expect(out).toContain('<h1')
    expect(out).toMatch(/font-size:\s*18px/i)
    expect(out).toMatch(/color:\s*(#dc2626|rgb\(220,\s*38,\s*38\))/i)
    expect(out).toContain('<strong>Teks</strong>')
    expect(out).not.toMatch(/^<strong>/)
  })

  it('repairs empty b/strong that only wrap br onto previous text', () => {
    const input = 'adira.co.id<b><br></b>Website'
    const out = repairKbInlineBoldHtml(input)
    expect(out).toContain('<strong>adira.co.id</strong>')
    expect(out).toContain('<br>')
    expect(out).toContain('Website')
  })
})
