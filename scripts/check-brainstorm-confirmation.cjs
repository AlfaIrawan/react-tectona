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
  assert.ok(source.includes('decisionText={message.decision_text} decisionLabel={message.decision_label}'))
  assert.ok(source.includes('{message.decision_text && !isConfirmation ?'))
  const fixture = `import React from 'react';import {createRoot} from 'react-dom/client';
import {BrainstormConfirmationPanel} from '@/modules/project-management/components/BrainstormConfirmationPanel';
import {BrainstormConfirmationOptions} from '@/modules/project-management/components/BrainstormConfirmationOptions';
import {BrainstormSummaryBox} from '@/modules/project-management/components/BrainstormSummaryBox';
import {brainstormConfirmationContent} from '@/modules/project-management/lib/brainstormConfirmationContent';
const phase='Fase pertama dokumen diunggah melalui modul Document & Knowledge Management di Tectona. Gen AI menggunakan API Knowledge Index. Belum ada integrasi ke Ad1ForFlow.';
const phaseMessage={role:'assistant',question_kind:'confirm',text:'Apakah batasan fase ini sudah tepat?',question_text:'Apakah batasan fase ini sudah tepat?',decision_label:'Batasan fase',decision_text:phase,confirmation_choices:['Konfirmasi batasan fase','Koreksi batasan fase']};
function StoredPhase({message,status}){const content=brainstormConfirmationContent(message);return <div data-phase-case>{content.isConfirmation?<BrainstormConfirmationPanel text={content.text} question={content.question} decisionText={message.decision_text} decisionLabel={message.decision_label} indonesian status={status} renderText={value=><p>{value}</p>}/>:<p data-completion>{message.text}</p>}</div>}
const text='**Yang ingin aku konfirmasi: Jelaskan tujuan utama dari project ini**\\n\\nPemahamanku untuk poin ini: Tujuan utama: \u2022 Membantu **collector field** menanyakan kebijakan secara aman. \u2022 Mempercepat pencarian kebijakan melalui **Generative AI**.\\n\\nJika ada yang kurang atau keliru, tulis perbaikan atau tambahannya.';
const systems='**Yang ingin aku konfirmasi: Sebutkan sistem yang terdampak atas pengerjaan project ini**\\n\\nPemahamanku untuk poin ini:\\n- **DigiLearn**\\n- **Tectona**\\n\\nJika ada yang kurang atau keliru, tulis perbaikan atau tambahannya.';
window.sends=[];createRoot(document.getElementById('root')).render(<main className="mx-auto max-w-3xl px-3 py-5">
<BrainstormSummaryBox text={'- Chat Gen AI membantu collector field menanyakan policy.\\n- Pencarian memo saat ini masih manual.'} indonesian/>
<BrainstormConfirmationPanel text={text} question="Apakah rangkuman tujuan proyek sudah benar dan lengkap?" indonesian renderText={value=><p className="text-sm leading-6">{value}</p>}>
<BrainstormConfirmationOptions choices={['Rangkuman tujuan sudah tepat','Perbaiki atau tambahkan tujuan']} explanations={['Hanya mengonfirmasi tujuan proyek.','Tulis koreksi atau tambahan tujuan.']} indonesian onSubmit={value=>{window.sends.push(value)}}/>
</BrainstormConfirmationPanel><aside data-advice className="mt-3 border-l-2 border-teal-500 pl-3 text-sm leading-6"><b>Pertimbangan Tambahan</b><p>Pertimbangkan kontrol akses dan audit pada integrasi data.</p></aside>
<BrainstormConfirmationPanel text={'**Yang ingin aku konfirmasi: Sebutkan User Bisnis terdampak dari project ini**\\n\\nJika ada yang kurang, tulis perbaikannya.'} question="Apakah rangkuman pengguna bisnis sudah lengkap?" indonesian renderText={value=><p className="text-sm leading-6">{value}</p>}>
<BrainstormConfirmationOptions choices={['Pengguna bisnis sudah tepat','Perbaiki pengguna bisnis']} indonesian disabled onSubmit={value=>{window.sends.push(value)}}/>
</BrainstormConfirmationPanel>
<BrainstormConfirmationPanel text={text} question="Apakah rangkuman tujuan proyek sudah benar dan lengkap?" indonesian status="confirmed" renderText={value=><p className="text-sm leading-6">{value}</p>}/>
<StoredPhase message={phaseMessage} status="pending"/>
<StoredPhase message={phaseMessage} status="confirmed"/>
<StoredPhase message={{role:'assistant',question_kind:'confirm',summary:'Rangkuman yang sudah diterima.',text:'Rangkuman yang sudah diterima.\\n\\nKlarifikasi sudah dicatat. Pertanyaan wajib sudah selesai.'}} status="confirmed"/>
<BrainstormConfirmationPanel text={systems} question="Apakah daftar sistem terdampak ini sudah lengkap dan tepat?" indonesian renderText={value=><p>{value}</p>}>
<BrainstormConfirmationOptions choices={['Daftar sistem ini sudah lengkap','Ada sistem yang kurang atau keliru']} indonesian onSubmit={value=>{window.sends.push(value)}}/>
</BrainstormConfirmationPanel>
</main>);`
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
      const panels = page.locator('[data-brainstorm-confirmation]')
      const panel = panels.first()
      await panel.waitFor().catch(error => { throw new Error(errors.join('; ') || error.message) })
      assert.deepEqual(errors, [])
      assert.equal(await panels.count(), 6)
      assert.equal(await page.locator('[data-completion]').count(), 1)
      for (const index of [3, 4]) {
        const phasePanel = panels.nth(index)
        assert.equal(await phasePanel.getByText('Batasan fase', { exact: true }).count(), 1)
        assert.equal(await phasePanel.getByText('Fase pertama dokumen diunggah', { exact: false }).count(), 1)
        assert.equal(await phasePanel.locator('[role=alert]').count(), 0)
        assert.equal(await phasePanel.getAttribute('data-confirmation-status'), index === 3 ? 'pending' : 'confirmed')
      }
      const systemsPanel = panels.nth(5)
      assert.equal(await systemsPanel.locator('ul > li').count(), 2)
      assert.deepEqual(await systemsPanel.locator('ul > li').allTextContents(), ['DigiLearn', 'Tectona'])
      assert.equal(await systemsPanel.getAttribute('data-confirmation-status'), 'pending')
      assert.equal(await systemsPanel.locator('input[type=radio]').count(), 2)
      assert.equal((await systemsPanel.textContent()).includes('Yang ingin aku konfirmasi:'), false)
      assert.equal((await systemsPanel.textContent()).includes('Oke, aku catat:'), false)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      const block = await panel.boundingBox(), advice = await page.locator('[data-advice]').boundingBox()
      assert.ok(advice.y >= block.y + block.height)
      assert.equal(await panel.locator('input[type=radio]').count(), 2)
      assert.equal(await panel.locator('strong').count(), 2)
      assert.equal(await panel.locator('ul > li').count(), 2)
      assert.equal(await panels.nth(2).locator('ul > li').count(), 2)
      assert.equal((await panel.textContent()).includes('\u2022'), false)
      assert.equal((await panel.textContent()).includes('**'), false)
      assert.equal(await panels.nth(2).locator('strong').count(), 2)
      assert.equal(await panels.nth(1).getByRole('button', { name: 'Kirim' }).isDisabled(), true)
      assert.equal(await panel.getAttribute('data-confirmation-status'), 'pending')
      assert.equal(await panels.nth(2).getAttribute('data-confirmation-status'), 'confirmed')
      assert.ok((await panel.getAttribute('class')).includes('bg-amber-50'))
      assert.ok((await panels.nth(2).getAttribute('class')).includes('bg-emerald-50'))
      assert.equal(await panels.nth(1).getByText('Yang ingin aku konfirmasi:', { exact: false }).count(), 0)
      assert.equal(await panels.nth(1).locator('p').filter({hasText:'Sebutkan User Bisnis terdampak dari project ini'}).first().getAttribute('class'), await panel.locator('p').filter({hasText:'Jelaskan tujuan utama dari project ini'}).first().getAttribute('class'))
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
