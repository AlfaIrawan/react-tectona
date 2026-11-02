const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const esbuild = require('esbuild')
const postcss = require('postcss')
const tailwind = require('tailwindcss')
const { pathToFileURL } = require('node:url')

async function main() {
  const { chromium } = require(process.argv[2] || 'playwright')
  const source = await fs.readFile('src/modules/project-management/pages/IdeaBacklogManagementPage.tsx', 'utf8')
  await esbuild.transform(source, { loader: 'tsx' })
  assert.ok(source.indexOf('<BrainstormConfirmationPanel') < source.indexOf('{message.ai_advice ?'))
  assert.ok(source.includes('{question && !isConfirmation ?'))
  const fixture = `import React from 'react';import {createRoot} from 'react-dom/client';
import {BrainstormConfirmationPanel} from '@/modules/project-management/components/BrainstormConfirmationPanel';
import {BrainstormConfirmationOptions} from '@/modules/project-management/components/BrainstormConfirmationOptions';
import {BrainstormSummaryBox} from '@/modules/project-management/components/BrainstormSummaryBox';
const text='**Yang ingin aku konfirmasi: Jelaskan tujuan utama dari project ini**\\n\\nPemahamanku untuk poin ini: Membantu collector field menanyakan kebijakan secara aman melalui Generative AI.\\n\\nJika ada yang kurang atau keliru, tulis perbaikan atau tambahannya.';
window.sends=[];createRoot(document.getElementById('root')).render(<main className="mx-auto max-w-3xl px-3 py-5">
<BrainstormSummaryBox text={'- Chat Gen AI membantu collector field menanyakan policy.\\n- Pencarian memo saat ini masih manual.'} indonesian/>
<BrainstormConfirmationPanel text={text} question="Apakah rangkuman tujuan proyek sudah benar dan lengkap?" indonesian renderText={value=><p className="text-sm leading-6">{value}</p>}>
<BrainstormConfirmationOptions choices={['Rangkuman tujuan sudah tepat','Perbaiki atau tambahkan tujuan']} explanations={['Hanya mengonfirmasi tujuan proyek.','Tulis koreksi atau tambahan tujuan.']} indonesian onSubmit={value=>{window.sends.push(value)}}/>
</BrainstormConfirmationPanel><aside data-advice className="mt-3 border-l-2 border-teal-500 pl-3 text-sm leading-6"><b>Pertimbangan Tambahan</b><p>Pertimbangkan kontrol akses dan audit pada integrasi data.</p></aside></main>);`
  const bundle = await esbuild.build({ stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, jsx: 'automatic', platform: 'browser', alias: { '@': path.resolve('src') }, define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'isolate-diagrams', setup(build) {
    build.onResolve({ filter: /\/Assistant(?:Mermaid|Chart)Block$/ }, args => ({ path: args.path, namespace: 'visual' }))
    build.onLoad({ filter: /.*/, namespace: 'visual' }, () => ({ contents: 'export const AssistantMermaidBlock=()=>null;export const AssistantChartBlock=()=>null;', loader: 'js' }))
  } }] })
  const config = (await import(pathToFileURL(path.resolve('tailwind.config.js')))).default
  const css = await postcss([tailwind({ ...config, content: [...config.content, { raw: fixture, extension: 'tsx' }] })]).process(await fs.readFile('src/index.css', 'utf8'), { from: path.resolve('src/index.css') })
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', (req.url === '/app.js' ? 'text/javascript' : req.url === '/style.css' ? 'text/css' : 'text/html') + '; charset=utf-8')
    res.end(req.url === '/app.js' ? bundle.outputFiles[0].text : req.url === '/style.css' ? css.css : '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/app.js"></script>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'tectona-confirmation-'))
  try {
    for (const width of [320, 390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 960 } })
      const errors = []; page.on('pageerror', error => errors.push(error.message))
      await page.goto('http://127.0.0.1:' + server.address().port)
      const panel = page.locator('[data-brainstorm-confirmation]')
      await panel.waitFor().catch(error => { throw new Error(errors.join('; ') || error.message) })
      assert.deepEqual(errors, [])
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      const block = await panel.boundingBox(), advice = await page.locator('[data-advice]').boundingBox()
      assert.ok(advice.y >= block.y + block.height)
      assert.equal(await panel.locator('input[type=radio]').count(), 2)
      assert.equal(await page.evaluate(() => window.sends.length), 0)
      await page.screenshot({ path: path.join(output, width + '.png'), fullPage: true })
      await panel.locator('input[type=radio]').first().check()
      await panel.getByRole('button', { name: 'Kirim' }).click()
      assert.deepEqual(await page.evaluate(() => window.sends), ['Rangkuman tujuan sudah tepat'])
      await page.close()
    }
    console.log('PASS: desktop/mobile layout, advice placement, no automatic send, unchanged confirmation action. Screenshots: ' + output)
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
}
main().catch(error => { console.error(error); process.exit(1) })
