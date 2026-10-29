const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs/promises')
const os = require('node:os')
const http = require('node:http')
const { pathToFileURL } = require('node:url')
const esbuild = require('esbuild')
const postcss = require('postcss')
const tailwind = require('tailwindcss')

async function main() {
  const { chromium } = require(process.argv[2] || 'playwright')
  const fixture = `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {IdeaWorkflowDecisionDialog} from './src/modules/project-management/components/IdeaWorkflowDecisionDialog';
    window.calls=[];window.saved=0;
    createRoot(document.getElementById('root')).render(<IdeaWorkflowDecisionDialog
      idea={{id:'idea',title:'Business process improvement with a complete evidence-based evaluation'}}
      mode="reject" userId="reviewer" onClose={()=>{}} onSaved={()=>window.saved++}/>);`
  const mock = `
    export async function listIdeaWorkflowRuns(){return [{id:'run',status:'waiting_approval',current_node_id:'gate'}]}
    export async function listWorkflowApprovals(){return location.search.includes('unassigned')?[]:[{id:'approval',run_id:'run',node_id:'gate',subject_id:'reviewer',status:'pending',subject_context:{idea_id:'idea'}}]}
    export async function approveWorkflowRun(){throw Error('Unexpected approval')}
    export async function rejectWorkflowRun(...args){window.calls.push(args);await new Promise(r=>setTimeout(r,100));if(location.search.includes('failure'))throw Error('Server refused the decision');return {}}
  `
  const bundle = await esbuild.build({
    stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false,
    platform: 'browser', format: 'iife', jsx: 'automatic', alias: { '@': path.resolve('src') },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'mock-workflow-transport', setup(build) {
      build.onResolve({ filter: /workflowAutomationApi$/ }, () => ({ path: 'workflow-api', namespace: 'fixture' }))
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: mock, loader: 'js' }))
    } }],
  })
  const config = (await import(pathToFileURL(path.resolve('tailwind.config.js')))).default
  const css = await postcss([tailwind(config)]).process(await fs.readFile('src/index.css', 'utf8'), { from: path.resolve('src/index.css') })
  const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>:root{--background:0 0% 100%;--card:0 0% 100%;--foreground:222 25% 15%;--border:215 30% 88%;--radius:0.5rem;--primary:220 90% 55%;--primary-foreground:0 0% 100%;--destructive:0 75% 45%;--destructive-foreground:0 0% 100%;--input:215 30% 88%}body{font-family:Arial,sans-serif}*{letter-spacing:0}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'
  const server = http.createServer((request, response) => {
    const js = request.url === '/fixture.js', style = request.url === '/style.css'
    response.setHeader('Content-Type', js ? 'text/javascript' : style ? 'text/css' : 'text/html')
    response.end(js ? bundle.outputFiles[0].text : style ? css.css : html)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true, channel: process.platform === 'win32' ? 'chrome' : undefined })
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const output = await fs.mkdtemp(path.join(os.tmpdir(), 'tectona-idea-decision-'))
    const url = `http://127.0.0.1:${server.address().port}`
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(url)
      await page.getByLabel('Reason (required)').waitFor()
      const submit = page.getByRole('button', { name: 'Reject', exact: true })
      assert.equal(await submit.isDisabled(), true)
      await page.getByLabel('Reason (required)').fill('This proposal duplicates an approved initiative.')
      await page.screenshot({ path: path.join(output, `reject-${width}.png`) })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      const dialog = await page.getByRole('dialog').boundingBox()
      assert.ok(dialog.x >= 0 && dialog.x + dialog.width <= width)
      await submit.click()
      await page.waitForFunction(() => window.saved === 1)
      assert.deepEqual(await page.evaluate(() => window.calls), [['run', 'This proposal duplicates an approved initiative.', 'reject', 'approval']])
    }
    await page.goto(url + '?failure')
    await page.getByLabel('Reason (required)').fill('Insufficient evidence')
    await page.getByRole('button', { name: 'Reject', exact: true }).click()
    await page.getByRole('alert').waitFor()
    assert.equal(await page.evaluate(() => window.saved), 0)
    assert.match(await page.getByRole('alert').innerText(), /Server refused/)
    await page.goto(url + '?unassigned')
    await page.getByText(/No active idea approval/).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Reject', exact: true }).isDisabled(), true)
    assert.deepEqual(errors, [])
    console.log('PASS actual approval dialog, mandatory reason, exact workflow payload, failure retention, unassigned protection, desktop/mobile and no overflow. Screenshots: ' + output)
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
