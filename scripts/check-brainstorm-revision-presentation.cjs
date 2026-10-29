const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs/promises')
const os = require('node:os')
const http = require('node:http')
const ts = require('typescript')
const esbuild = require('esbuild')
const postcss = require('postcss')
const tailwind = require('tailwindcss')
const { pathToFileURL } = require('node:url')

async function main() {
  const { chromium } = require(process.argv[2] || 'playwright')
  const source = await fs.readFile('src/modules/project-management/pages/IdeaBacklogManagementPage.tsx', 'utf8')
  const tree = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  function find(test) {
    let result
    function visit(node) { if (!result && test(node)) result = node; if (!result) ts.forEachChild(node, visit) }
    visit(tree); assert.ok(result); return result
  }
  const fn = name => find(node => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(tree)
  const badge = find(node => ts.isVariableDeclaration(node) && node.name.getText(tree) === 'BRAINSTORM_QUESTION_KIND').initializer.getText(tree)
  const offer = find(node => ts.isJsxElement(node) && node.openingElement.attributes.getText(tree).includes('space-y-3 rounded-2xl border border-emerald-200')).getText(tree)
  const fixture = String.raw`
    import React from 'react';import {createRoot} from 'react-dom/client';import {cn} from './src/lib/utils';
    import {BrainstormSummaryBox} from './src/modules/project-management/components/BrainstormSummaryBox';
    import {BrainstormConfirmationOptions} from './src/modules/project-management/components/BrainstormConfirmationOptions';
    import {AssistantChatMarkdown} from './src/modules/core-shell/components/AssistantChatMarkdown';
    import {normalizeBrainstormMarkdown,splitBrainstormQuestion} from './src/modules/project-management/lib/brainstormMarkdown';
    import {enterpriseSecondaryButtonClass,enterprisePrimarySolidButtonClass} from './src/lib/enterpriseButtonClasses';
    import {BriefcaseBusiness,Wrench,Sparkles,Wand2} from 'lucide-react';
    const brainstormThreadIndonesian=true,isBrainstormSending=false,isDraftContinuing=false;
    const handleSendBrainstormMessage=text=>{window.lastAction=text},handleContinueIdeaDraft=text=>{window.lastAction=text};
    ${fn('isBrainstormIntakeComplete')}
    window.intakeComplete=isBrainstormIntakeComplete;
    const BRAINSTORM_MARKDOWN_CLASS='text-sm leading-7';const BRAINSTORM_QUESTION_KIND=${badge};
    const BrainstormSummaryDiagrams=()=>null,BrainstormCatalogComparison=()=>null;
    function BrainstormAssistantMessageBody({text}){return <AssistantChatMarkdown content={normalizeBrainstormMarkdown(text)}/>}
    ${fn('brainstormQuestionKind')}
    ${fn('BrainstormAssistantContent')}
    const summary='AS-IS: tim menggunakan **WhatsApp** dan **Ad1ForFlow**.\n\nTO-BE: **Document & Knowledge Management di Tectona** direncanakan, belum dipakai saat ini.';
    const question='Kapan modul Document & Knowledge Management akan diaktifkan dalam rencana TO-BE?';
    createRoot(document.getElementById('root')).render(<main className="mx-auto max-w-2xl space-y-8 p-4">
      <section data-example="legacy"><BrainstormAssistantContent indonesian message={{role:'assistant',text:'**Apakah ada informasi tambahan?',question_kind:'mandatory'}}/></section>
      <section data-example="revision"><BrainstormAssistantContent indonesian onConfirm={()=>{}} message={{role:'assistant',text:summary+'\n\nApakah revisi pemahaman ini sudah tepat?',summary,question_text:'Apakah revisi pemahaman ini sudah tepat?',question_kind:'confirm',confirmation_choices:['Konfirmasi revisi pemahaman','Koreksi isi revisi'],confirmation_actions:['confirm','adjust'],confirmation_explanations:['Terapkan penggantian fakta; progres tetap dipertahankan.','Tulis fakta pengganti yang benar.']}}/></section>
      <section data-example="extended"><BrainstormAssistantContent indonesian message={{role:'assistant',text:summary+'\n\n**'+question+'**',summary,question_text:question,question_kind:'extended',question_focus:'technical'}}/></section>
      <section data-example="completed">${offer}</section>
    </main>);`
  const bundle = await esbuild.build({
    stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false,
    platform: 'browser', format: 'iife', jsx: 'automatic', alias: { '@': path.resolve('src') },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'unused-diagram-surfaces', setup(build) {
      build.onResolve({ filter: /\/Assistant(?:Mermaid|Chart)Block$/ }, args => ({ path: args.path, namespace: 'visual' }))
      build.onLoad({ filter: /.*/, namespace: 'visual' }, () => ({ contents: 'export const AssistantMermaidBlock=()=>null;export const AssistantChartBlock=()=>null;', loader: 'js' }))
    } }],
  })
  const config = (await import(pathToFileURL(path.resolve('tailwind.config.js')))).default
  const css = await postcss([tailwind(config)]).process(await fs.readFile('src/index.css', 'utf8'), { from: path.resolve('src/index.css') })
  const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>:root{--background:0 0% 100%;--foreground:222 25% 15%;--border:215 30% 88%;--primary:220 90% 55%;--primary-foreground:0 0% 100%}body{font-family:Arial,sans-serif}*{letter-spacing:0}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'
  const server = http.createServer((req, res) => {
    const js = req.url === '/fixture.js', style = req.url === '/style.css'
    res.setHeader('Content-Type', (js ? 'text/javascript' : style ? 'text/css' : 'text/html') + '; charset=utf-8')
    res.end(js ? bundle.outputFiles[0].text : style ? css.css : html)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true, channel: process.platform === 'win32' ? 'chrome' : undefined })
    const page = await browser.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    const output = await fs.mkdtemp(path.join(os.tmpdir(), 'tectona-revision-presentation-'))
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1100 })
      await page.goto(`http://127.0.0.1:${server.address().port}`)
      await page.locator('[data-example="extended"]').getByText('Extended Question · Technical', { exact: true }).waitFor({ timeout: 5000 }).catch(error => { throw new Error(error.message + '\nBrowser errors: ' + JSON.stringify(errors)) })
      assert.equal((await page.locator('main').innerText()).includes('**'), false)
      assert.equal(await page.locator('[data-example="revision"]').getByText('Rangkuman Pemahaman', { exact: true }).count(), 1)
      assert.equal(await page.locator('[data-example="extended"]').getByText('Kapan modul Document & Knowledge Management akan diaktifkan dalam rencana TO-BE?', { exact: true }).count(), 1)
      assert.equal(await page.locator('[data-example="revision"]').getByRole('radio').count(), 2)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      const completed = page.locator('[data-example="completed"]')
      await completed.getByRole('button', { name: 'Extended Question · Technical', exact: true }).click()
      assert.equal(await page.evaluate(() => window.lastAction), 'Pertanyaan teknis')
      await completed.getByRole('button', { name: 'Extended Question · Business', exact: true }).click()
      assert.equal(await page.evaluate(() => window.lastAction), 'Pertanyaan bisnis')
      assert.equal(await page.evaluate(() => window.intakeComplete({total:11,answered:10,items:[{id:'goal',status:'answered'},{id:'discovery_security',status:'asked'}]})), true)
      assert.equal(await page.evaluate(() => window.intakeComplete({items:[{id:'goal',status:'asked'}]})), false)
      assert.equal(await page.evaluate(() => window.intakeComplete({items:[{id:'goal',status:'answered',review_needed:true}]})), false)
      await page.screenshot({ path: path.join(output, `revision-${width}.png`), fullPage: true })
    }
    assert.deepEqual(errors, [])
    console.log('PASS actual chat renderer: orphan Markdown hidden, boxed correction, confirmation options, extended badge, no duplicate question and desktop/mobile. Screenshots: '+output)
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
