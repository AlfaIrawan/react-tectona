import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { expect, it } from 'vitest'

// Exercise the real renderer without mounting the page or accessing live APIs.
const source = readFileSync('src/modules/project-management/pages/IdeaBacklogManagementPage.tsx', 'utf8')
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const renderer = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'plainTextToIdeaRichHtml')
if (!renderer) throw new Error('Production renderer not found')
const output = ts.transpileModule(`export default (${renderer.getText(ast)})`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const module = { exports: {} as { default: (text: string) => string } }
new Function('IDEA_DESCRIPTION_HEADING_LABELS', 'splitMermaidContent', 'module', 'exports', output)(new Set(['objective']), (text: string) => [{ type: 'prose', text }], module, module.exports)
const render = module.exports.default

it.each(['jenis_kendala', 'dampak_pekerjaan', 'waktu_kejadian', 'informasi_belum_diketahui'])('preserves literal field %s in inline code', field => {
  expect(render(`Field: \`${field}\`.`)).toBe(`<p>Field: ${field}.</p>`)
})
it.each(['jenis_kendala', 'informasi_belum_diketahui', 'alpha_beta_gamma_delta', '日本_名前_値'])('preserves unquoted intraword underscores %s', field => {
  expect(render(field)).toBe(`<p>${field}</p>`)
})
it('preserves literal code operators and strips only code delimiters', () => {
  expect(render('Use `a*b*c`, `__name__`, and `_literal_`.')).toBe('<p>Use a*b*c, __name__, and _literal_.</p>')
})
it('still normalizes ordinary markdown emphasis', () => {
  expect(render('**bold** and *italic*, __strong__ and _emphasis_.')).toBe('<p>bold and italic, strong and emphasis.</p>')
})
it('escapes HTML even inside literal code', () => {
  expect(render('`<script>do_bad()</script>`')).toBe('<p>&lt;script&gt;do_bad()&lt;/script&gt;</p>')
})
it('keeps heading and list structure', () => {
  expect(render('# Objective\n- `first_field`\n2. _Next_')).toBe('<h2>Objective</h2><ul><li>first_field</li><li>Next</li></ul>')
})
it('does not merge two literal identifiers through emphasis removal', () => {
  expect(render('jenis_kendala and dampak_pekerjaan')).toBe('<p>jenis_kendala and dampak_pekerjaan</p>')
})

function bindProduction(name: string, dependencies: Record<string, unknown>) {
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)
  if (!fn) throw new Error(`Missing production function ${name}`)
  const js = ts.transpileModule(`export default (${fn.getText(ast)})`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const bound = { exports: {} as { default: (...args: any[]) => any } }
  new Function(...Object.keys(dependencies), 'module', 'exports', js)(...Object.values(dependencies), bound, bound.exports)
  return bound.exports.default
}
const sanitize = bindProduction('sanitizeIdeaDescriptionRichHtml', {})
const extract = bindProduction('extractPlainTextFromIdeaRichHtml', {})
const restore = bindProduction('resolveSavedIdeaRichHtml', { plainTextToIdeaRichHtml: render, sanitizeIdeaDescriptionRichHtml: sanitize, extractPlainTextFromIdeaRichHtml: extract })
const renderLegacy = render as (text: string, legacy?: boolean) => string
it('recovers exact legacy output using authoritative saved text', () => {
  const text = 'Use `jenis_kendala` and `informasi_belum_diketahui`.'
  expect(renderLegacy(text, true)).not.toBe(render(text))
  expect(restore(text, renderLegacy(text, true))).toBe(render(text))
})
it('rejects arbitrary saved text/HTML mismatch', () => {
  expect(restore('Use `jenis_kendala`.', '<p>Different evidence</p>')).toBeNull()
})
it('rejects modified legacy output', () => {
  const text = '`jenis_kendala` and `dampak_pekerjaan`'
  expect(restore(text, renderLegacy(text, true).replace('</p>', ' extra</p>'))).toBeNull()
})
it('preserves matching user rich formatting', () => {
  expect(restore('ordinary text', '<p><strong>ordinary</strong> text</p>')).toBe('<p><strong>ordinary</strong> text</p>')
})
it('preserves identifiers through DOM extraction', () => {
  expect(extract(render('`informasi_belum_diketahui`'))).toBe('informasi_belum_diketahui')
})
