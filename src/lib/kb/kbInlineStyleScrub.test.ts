import { describe, expect, it } from 'vitest'
import { scrubKbInlineStyles } from './kbInlineStyleScrub'
import { transformKbTextCase } from './kbRichTextTypography'

describe('scrubKbInlineStyles', () => {
  it('strips Tailwind --tw-* dumps from br and keeps table width styles', () => {
    const twDump = [
      '--tw-border-spacing-x: 0',
      '--tw-border-spacing-y: 0',
      '--tw-translate-x: 0',
      '--tw-ring-offset-width: 0px',
      '--tw-shadow: 0 0 #0000',
    ].join('; ')
    const input = [
      '<h2>Katalog</h2>',
      `<table style="table-layout: fixed; width: 400px; ${twDump}" width="400">`,
      `<tbody><tr><td width="140" style="width: 140px; ${twDump}">`,
      `<strong>adira.co.id</strong><br style="${twDump}">`,
      '</td><td>Website</td></tr></tbody></table>',
    ].join('')

    const out = scrubKbInlineStyles(input)

    expect(out).not.toContain('--tw-')
    expect(out).not.toMatch(/<br[^>]*style=/i)
    expect(out).toContain('width="140"')
    expect(out).toMatch(/style="[^"]*width:\s*140px/)
    expect(out).toMatch(/table-layout:\s*fixed/)
    expect(out.length).toBeLessThan(input.length / 2)
  })

  it('keeps text-align on block tags and drops other style props', () => {
    const input = [
      '<p style="text-align: center; color: red">Judul</p>',
      '<div style="text-align: right; --tw-shadow: 0">Samping</div>',
      '<h2 style="text-align: justify">Blok</h2>',
    ].join('')

    const out = scrubKbInlineStyles(input)

    expect(out).toMatch(/text-align:\s*center/)
    expect(out).toMatch(/text-align:\s*right/)
    expect(out).toMatch(/text-align:\s*justify/)
    expect(out).not.toContain('color')
    expect(out).not.toContain('--tw-')
  })

  it('keeps indent margin-left and drops oversized or unsafe values', () => {
    const input = [
      '<p style="margin-left: 40px; color: blue">Indented</p>',
      '<div style="padding-left: 2em; margin-left: 999px">Cap</div>',
      '<li style="margin-left: 80px; background: red">Item</li>',
    ].join('')

    const out = scrubKbInlineStyles(input)

    expect(out).toMatch(/margin-left:\s*40px/)
    expect(out).toMatch(/padding-left:\s*2em/)
    expect(out).toMatch(/margin-left:\s*80px/)
    expect(out).not.toContain('999px')
    expect(out).not.toContain('color')
    expect(out).not.toContain('background')
  })

  it('keeps font-family and font-size on spans', () => {
    const input = [
      '<span style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: red">Hi</span>',
      '<p style="font-size: 99px">Too big</p>',
    ].join('')

    const out = scrubKbInlineStyles(input)

    expect(out).toMatch(/font-family:\s*Arial/)
    expect(out).toMatch(/font-size:\s*14px/)
    expect(out).not.toContain('99px')
    // Named color "red" is rejected; hex/rgb only.
    expect(out).not.toMatch(/color:\s*red/i)
  })

  it('keeps hex text and highlight colors', () => {
    const input = '<span style="color: #dc2626; background-color: #fef08a; border: 1px solid red">Hi</span>'
    const out = scrubKbInlineStyles(input)
    // Browsers may normalize hex → rgb when reading via CSSOM.
    expect(out).toMatch(/color:\s*(#dc2626|rgb\(\s*220\s*,\s*38\s*,\s*38\s*\))/i)
    expect(out).toMatch(/background-color:\s*(#fef08a|rgb\(\s*254\s*,\s*240\s*,\s*138\s*\))/i)
    expect(out).not.toContain('border')
  })
})

describe('transformKbTextCase', () => {
  it('applies common case modes', () => {
    expect(transformKbTextCase('hello WORLD', 'upper')).toBe('HELLO WORLD')
    expect(transformKbTextCase('Hello WORLD', 'lower')).toBe('hello world')
    expect(transformKbTextCase('hello world', 'title')).toBe('Hello World')
    expect(transformKbTextCase('Hello World', 'toggle')).toBe('hELLO wORLD')
    expect(transformKbTextCase('hello. world', 'sentence')).toBe('Hello. World')
  })
})
