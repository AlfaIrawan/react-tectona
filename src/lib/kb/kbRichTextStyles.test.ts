import { describe, expect, it } from 'vitest'
import {
  getKbDocStyleById,
  hydrateKbDocStyleInlineStyles,
  KB_DOC_STYLES,
} from './kbRichTextStyles'
import { repairKbInlineBoldHtml } from './kbInlineBoldRepair'
import { scrubKbInlineStyles } from './kbInlineStyleScrub'

describe('kbRichTextStyles', () => {
  it('exposes the Word-like styles gallery set', () => {
    expect(KB_DOC_STYLES).toHaveLength(15)
    expect(getKbDocStyleById('heading')?.blockTag).toBe('h1')
    expect(getKbDocStyleById('heading-2')?.blockTag).toBe('h2')
    expect(getKbDocStyleById('strong')?.kind).toBe('inline')
    expect(getKbDocStyleById('intense-quote')?.kind).toBe('block')
  })

  it('hydrates missing doc styles without overwriting Edit overrides', () => {
    const input = [
      '<h1 data-kb-style="heading">Bare heading</h1>',
      '<h1 data-kb-style="heading" style="font-size: 24px; font-weight: 700; color: #dc2626">Custom red</h1>',
    ].join('')

    const out = hydrateKbDocStyleInlineStyles(input)

    expect(out).toMatch(/font-size:\s*24px[^"]*">Bare heading/i)
    expect(out).toMatch(/color:\s*(#0f766e|rgb\(15,\s*118,\s*110\))[^"]*">Bare heading/i)
    expect(out).toMatch(/color:\s*(#dc2626|rgb\(220,\s*38,\s*38\))[^"]*">Custom red/i)
    expect(out).not.toMatch(/color:\s*(#0f766e|rgb\(15,\s*118,\s*110\))[^"]*">Custom red/i)
  })

  it('keeps Edit typography through save-style pipeline into View HTML', () => {
    const edited = [
      '<h1 data-kb-style="heading" style="margin: 0.75rem 0 0.4rem; font-size: 24px; font-weight: 700; color: #0f766e; line-height: 1.25">',
      'Katalog Aplikasi Adira Finance',
      '</h1>',
      '<p><span style="font-family: Georgia, serif; font-size: 18px; color: #dc2626">Body text</span></p>',
    ].join('')

    const repaired = repairKbInlineBoldHtml(edited)
    const scrubbed = scrubKbInlineStyles(repaired)
    const hydrated = hydrateKbDocStyleInlineStyles(scrubbed)
    const again = scrubKbInlineStyles(hydrated)

    expect(again).toContain('data-kb-style="heading"')
    expect(again).toMatch(/font-size:\s*24px/i)
    expect(again).toMatch(/color:\s*(#0f766e|rgb\(15,\s*118,\s*110\))/i)
    expect(again).toMatch(/font-family:\s*Georgia/i)
    expect(again).toMatch(/font-size:\s*18px/i)
    expect(again).toMatch(/color:\s*(#dc2626|rgb\(220,\s*38,\s*38\))/i)
    expect(again).not.toMatch(/<strong>Katalog/)
  })
})
