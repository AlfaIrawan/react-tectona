const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')
const { JSDOM } = require('jsdom')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

async function main() {
  const result = await esbuild.build({
    stdin: {
      contents: "export { BrainstormSummaryBox } from './src/modules/project-management/components/BrainstormSummaryBox'; export { normalizeBrainstormSummary } from './src/modules/project-management/lib/normalizeBrainstormSummary'",
      resolveDir: process.cwd(), loader: 'tsx',
    },
    bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    alias: { '@': path.resolve('src') },
    plugins: [{ name: 'non-prose-visuals', setup(build) {
      build.onResolve({ filter: /\/Assistant(?:Mermaid|Chart)Block$/ }, args => ({ path: args.path, namespace: 'visual' }))
      build.onLoad({ filter: /.*/, namespace: 'visual' }, () => ({
        contents: 'export const AssistantMermaidBlock = () => null; export const AssistantChartBlock = () => null;', loader: 'js',
      }))
    } }],
  })
  const loaded = new Module(path.resolve('summary-test.cjs'), module)
  loaded.filename = path.resolve('summary-test.cjs')
  loaded.paths = module.paths
  loaded._compile(result.outputFiles[0].text, loaded.filename)
  const { BrainstormSummaryBox, normalizeBrainstormSummary: normalize } = loaded.exports
  const bullet = '\u2022'
  const fixture = `Berdasarkan proposal Collection, fungsi untuk Credit meliputi: ${bullet} **Document & Knowledge Management** - kebijakan disimpan. ${bullet} **Integrasi RAG** - menjawab pertanyaan. ${bullet} **Chat UI DigiLearn** - antarmuka percakapan.`
  const render = text => new JSDOM(renderToStaticMarkup(React.createElement(BrainstormSummaryBox, { text, indonesian: true }))).window.document
  const doc = render(fixture)
  assert.equal(doc.querySelectorAll('ul > li').length, 3)
  assert.equal(doc.querySelectorAll('strong').length, 3)
  assert.match(doc.body.textContent, /Rangkuman Pemahaman/)
  assert.match(doc.body.textContent, /Berdasarkan proposal Collection/)
  assert.equal(doc.querySelectorAll('ul').length, 1)
  assert.equal(normalize(normalize(fixture)), normalize(fixture))
  assert.equal(doc.body.textContent.replace(/\s/g, ''), `Rangkuman Pemahaman${fixture.replaceAll(bullet, '').replaceAll('**', '')}`.replace(/\s/g, ''))

  const nested = '- **Aktor**\n  - Peserta\n  - Notulis\n\n1. Siapkan\n2. Kirim\n\nPenutup.'
  assert.equal(normalize(nested), nested)
  const structured = render(nested)
  assert.equal(structured.querySelectorAll('ul ul > li').length, 2)
  assert.equal(structured.querySelectorAll('ol > li').length, 2)
  assert.match(structured.body.textContent, /Penutup/)
  assert.equal(render(`${bullet} Satu\n${bullet} Dua`).querySelectorAll('ul > li').length, 2)
  for (const untouched of [
    `Produk a ${bullet} b ${bullet} c`,
    `Contoh: \`x ${bullet} y ${bullet} z\``,
    `\`\`\`text\n${fixture}\n\`\`\``,
    `~~~text\n${fixture}\n~~~`,
    `    ${fixture}`, '| A | B |\n| --- | --- |\n| satu | dua |',
  ]) assert.equal(normalize(untouched), untouched)
  console.log('PASS: summary screenshot regression, real Markdown lists, nested/ordered lists, content preservation, code/math/table safeguards and idempotence')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
