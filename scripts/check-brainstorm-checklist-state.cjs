const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const ts = require('typescript')
const esbuild = require('esbuild')
const postcss = require('postcss')
const tailwind = require('tailwindcss')
const { pathToFileURL } = require('node:url')

async function main() {
  const { chromium } = require(process.argv[2] || 'playwright')
  const source = (await fs.readFile('src/modules/project-management/pages/IdeaBacklogManagementPage.tsx', 'utf8')).replace(/\r\n/g, '\n')
  const tree = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let callback
  function visit(node) {
    if (ts.isArrowFunction(node) && node.getText(tree).startsWith('(item) => {\n                      const status = item.review_needed')) callback = node.getText(tree)
    ts.forEachChild(node, visit)
  }
  visit(tree)
  assert.ok(callback, 'Use the actual readiness checklist row, not a duplicated implementation')
  const fixture = `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {CircleCheck,Circle} from 'lucide-react'; import {cn} from './src/lib/utils';
    const indonesian=true, formatBrainstormChecklistPrompt=(prompt)=>prompt;
    const items=[
      {id:'active',prompt:'Active mandatory with an open Challenge Question',status:'asked'},
      {id:'candidate',prompt:'Other mandatory question with incidental information',status:'pending',candidate_evidence:['Mentioned earlier']},
      {id:'legacy',prompt:'Legacy answer retained for review',status:'answered',review_needed:true},
      {id:'complete',prompt:'Confirmed active answer',status:'answered',completion_origin:'active_answer'},
    ];
    createRoot(document.getElementById('root')).render(<main className="mx-auto max-w-sm space-y-2 p-4">{items.map(${callback})}</main>);
  `
  const bundle = await esbuild.build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,jsx:'automatic',platform:'browser',define:{'process.env.NODE_ENV':'"production"'}})
  const config = (await import(pathToFileURL(path.resolve('tailwind.config.js')))).default
  const css = await postcss([tailwind({...config,content:[...config.content,{raw:fixture,extension:'tsx'}]})]).process(await fs.readFile('src/index.css','utf8'),{from:path.resolve('src/index.css')})
  const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'
  const server = http.createServer((req,res)=>{
    const js=req.url==='/fixture.js', style=req.url==='/style.css'
    res.setHeader('Content-Type',js?'text/javascript':style?'text/css':'text/html')
    res.end(js?bundle.outputFiles[0].text:style?css.css:html)
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  let browser
  try {
    browser=await chromium.launch({headless:true,channel:process.platform==='win32'?'chrome':undefined})
    const page=await browser.newPage(), errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    const output=await fs.mkdtemp(path.join(os.tmpdir(),'tectona-checklist-state-'))
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:900})
      await page.goto(`http://127.0.0.1:${server.address().port}`)
      await page.getByText('Informasi tersedia, belum dikonfirmasi').waitFor()
      assert.equal(await page.locator('main .bg-emerald-50').count(),1)
      assert.equal(await page.getByText('Jawaban lama perlu ditinjau').count(),1)
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
      await page.screenshot({path:path.join(output,`${width}.png`),fullPage:true})
    }
    assert.deepEqual(errors,[])
    console.log('Checklist pending/active/confirmed/legacy states verified at desktop and mobile:',output)
  } finally {
    if (browser) await browser.close()
    await new Promise(resolve=>server.close(resolve))
  }
}
main().catch(error=>{console.error(error);process.exitCode=1})
