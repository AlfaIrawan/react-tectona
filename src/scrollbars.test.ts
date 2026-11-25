import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse, type Rule } from 'postcss'
import { describe, expect, it } from 'vitest'

const css = parse(readFileSync(resolve('src/scrollbars.css'), 'utf8'))
const rules: Rule[] = []
css.walkRules((rule) => { rules.push(rule) })
const baseRules = rules.filter((rule) => rule.parent === css)
const declarations = (rule: Rule) => Object.fromEntries(
  rule.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop, node.value]),
)
const findRule = (selector: string) => {
  const rule = baseRules.find((candidate) => candidate.selectors.includes(selector))
  expect(rule, selector).toBeDefined()
  return rule!
}

describe('application-wide native scrollbar policy', () => {
  it('loads once for the entire document, including page, workspace and body portals', () => {
    const main = readFileSync(resolve('src/main.tsx'), 'utf8')
    expect(main.match(/import '\.\/scrollbars\.css'/g)).toHaveLength(1)
    expect(findRule(':root').selectors).toContain(':root *')
    expect(declarations(findRule(':root'))).toMatchObject({
      'scrollbar-width': 'thin',
      'scrollbar-color': 'transparent transparent',
    })
  })

  it('keeps both scrollbar dimensions constant instead of hiding or resizing the box', () => {
    expect(declarations(findRule(':root::-webkit-scrollbar'))).toMatchObject({
      display: 'block', width: '8px', height: '8px', background: 'transparent',
    })
    for (const rule of rules) {
      if (rule.selectors.some((selector) => /:hover|:focus/.test(selector))) {
        expect(Object.keys(declarations(rule))).not.toEqual(expect.arrayContaining(['width']))
        expect(Object.keys(declarations(rule))).not.toEqual(expect.arrayContaining(['height']))
        expect(Object.keys(declarations(rule))).not.toEqual(expect.arrayContaining(['display']))
        expect(Object.keys(declarations(rule))).not.toEqual(expect.arrayContaining(['scrollbar-width']))
      }
    }
  })

  it('reveals only the hovered or focused scroll areas, including keyboard focus within them', () => {
    const standard = findRule(':root *:hover')
    expect(standard.selectors).toContain(':root *:focus-within')
    expect(declarations(standard)['scrollbar-color']).toContain('var(--muted-foreground')
    const webkit = findRule(':root *:hover::-webkit-scrollbar-thumb')
    expect(webkit.selectors).toContain(':root *:focus-within::-webkit-scrollbar-thumb')
    expect(declarations(webkit).background).toContain('var(--muted-foreground')
    expect(declarations(findRule(':root *::-webkit-scrollbar-thumb')).background).toBe('transparent')
  })

  it('overrides legacy hidden scrollbar utilities without altering overflow, focus or motion', () => {
    css.walkDecls((declaration) => {
      expect(declaration.important, declaration.toString()).toBe(true)
      expect(declaration.prop).not.toMatch(/^(overflow|scroll-behavior|scrollbar-gutter|pointer-events|touch-action|outline|animation|transition)/)
      if (declaration.prop === 'scrollbar-width') expect(declaration.value).toBe('thin')
    })
    // Paint is assigned to every element, rather than inherited from a hovered parent.
    // An inactive nested sibling therefore retains the transparent base declaration.
    expect(findRule(':root').selectors).toContain(':root *')
  })

  it('does not require hover on touch devices', () => {
    const touch = rules.filter((rule) => rule.parent?.type === 'atrule'
      && rule.parent.params === '(hover: none), (pointer: coarse)')
    expect(touch).toHaveLength(2)
    expect(declarations(touch[0])['scrollbar-color']).not.toBe('transparent transparent')
    expect(declarations(touch[1]).background).not.toBe('transparent')
  })

  it('always exposes system-colored scrollbars in forced-colors mode', () => {
    const forcedColors = rules.filter((rule) => rule.parent?.type === 'atrule'
      && rule.parent.params === '(forced-colors: active)')
    expect(forcedColors[0].selectors).toEqual(expect.arrayContaining(findRule(':root *:hover').selectors))
    expect(forcedColors[1].selectors).toEqual(expect.arrayContaining(findRule(':root *:hover::-webkit-scrollbar-thumb').selectors))
    expect(forcedColors.map(declarations)).toEqual([
      { 'scrollbar-color': 'auto' }, { background: 'CanvasText' }, { background: 'Canvas' },
    ])
  })
})
