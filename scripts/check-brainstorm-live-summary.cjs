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
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { BrainstormLiveSummaryPanel } from './src/modules/project-management/components/BrainstormLiveSummaryPanel';
    const initial = {job_id:'test',brainstorm_messages:[{role:'assistant',text:'Response',summary:'Build a Gen AI assistant for **Credit**.\\n\\n- Retrieve approved policies with RAG.\\n- Embed the chat in DigiLearn.',ai_advice:'Validate policy access with the Credit team.'}],intake_checklist:[{id:'goal',prompt:'Project goal',evidence_status:'confirmed',evidence_text:'Answer Credit policy questions.'},{id:'kpi',prompt:'Success metrics',evidence_status:'inferred',evidence_text:'Accuracy target: 90% (not confirmed).'}],brainstorm_remaining_gaps:['Confirm the current process and policy owners.']};
    function Fixture(){const [job,setJob]=useState(initial);const [busy,setBusy]=useState(false);window.updateSummary=(text)=>setJob({...initial,brainstorm_messages:[{role:'assistant',text:'Updated',summary:text}]});window.summaryBusy=setBusy;
      return <div className="flex h-screen flex-col bg-background text-foreground"><header className="flex h-14 shrink-0 items-center border-b px-4 text-sm font-semibold">Tectona Assistant</header><div className="relative flex min-h-0 flex-1 overflow-hidden"><aside className="hidden w-[416px] shrink-0 border-r p-5 min-[1024px]:block">Draft Readiness</aside><main data-chat className="flex min-w-0 flex-1 flex-col"><div className="min-h-0 flex-1 overflow-auto px-5 py-6"><p className="max-w-xl pr-12">Describe the current Credit policy process.</p></div><div className="border-t p-4"><textarea aria-label="Brainstorm message" className="h-20 w-full resize-none rounded-lg border p-3" placeholder="Ask Tectona Assistant" /></div></main><BrainstormLiveSummaryPanel job={job} confidence={28} busy={busy} /></div></div>;
    }createRoot(document.getElementById('root')).render(<Fixture/>);`
  const bundle = await esbuild.build({
    stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' }, alias: { '@': path.resolve('src') },
    plugins: [{ name: 'non-prose-visuals', setup(build) {
      build.onResolve({ filter: /\/Assistant(?:Mermaid|Chart)Block$/ }, args => ({ path: args.path, namespace: 'visual' }))
      build.onLoad({ filter: /.*/, namespace: 'visual' }, () => ({ contents: 'export const AssistantMermaidBlock=()=>null;export const AssistantChartBlock=()=>null;', loader: 'js' }))
    } }],
  })
  const config = (await import(pathToFileURL(path.resolve('tailwind.config.js')))).default
  const css = await postcss([tailwind({ ...config, content: [...config.content, { raw: fixture, extension: 'tsx' }] })]).process('@tailwind base;@tailwind components;@tailwind utilities;', { from: undefined })
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>:root{--background:0 0% 100%;--foreground:222 25% 15%;--border:215 30% 88%;--muted:215 30% 96%;--muted-foreground:215 16% 45%;--destructive:0 70% 45%}body{font-family:Arial,sans-serif}*{letter-spacing:0}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`
  const server = http.createServer((req, res) => {
    const isJs = req.url === '/fixture.js', isCss = req.url === '/style.css'
    res.setHeader('Content-Type', (isJs ? 'text/javascript' : isCss ? 'text/css' : 'text/html') + '; charset=utf-8')
    res.end(isJs ? bundle.outputFiles[0].text : isCss ? css.css : html)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.TECTONA_BROWSER_CHANNEL || (process.platform === 'win32' ? 'chrome' : undefined) })
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await page.waitForTimeout(1000)
    assert.equal(errors.length, 0, `fixture browser errors: ${errors.join('; ')}`)
    const panel = page.locator('aside[aria-label="Live AI Summary"]')
    await panel.waitFor({ state: 'visible' })
    await page.waitForTimeout(1100)
    const output = await fs.mkdtemp(path.join(os.tmpdir(), 'tectona-live-summary-'))
    const verify = async () => {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow')
      const chat = await page.locator('[data-chat]').boundingBox(), summary = await panel.boundingBox()
      assert.ok(chat.width > 0)
      if (await page.viewportSize().width >= 1440) assert.ok(chat.x + chat.width <= summary.x + 1, 'summary reserves space beside chat')
      assert.equal(await page.locator('[data-summary-section="understanding"] ul li').count(), 4, 'animated and reserved Markdown each render two bullets')
    }
    await verify()
    await page.screenshot({ path: path.join(output, 'desktop.png') })
    await page.getByRole('button', { name: 'Collapse summary', exact: true }).click()
    await page.getByRole('button', { name: 'Open Live AI Summary', exact: true }).filter({ visible: true }).click()
    await page.waitForTimeout(250)
    await verify()
    await page.setViewportSize({ width: 1440, height: 900 })
    await verify()
    await page.screenshot({ path: path.join(output, 'desktop-compact.png') })
    for (const width of [1024, 390]) {
      await page.setViewportSize({ width, height: 844 })
      assert.equal(await panel.isVisible(), false)
      await page.getByRole('button', { name: 'Open Live AI Summary', exact: true }).filter({ visible: true }).click()
      assert.equal(await page.getByRole('dialog', { name: 'Live AI Summary' }).isVisible(), true)
      await verify()
      const bounds = await panel.boundingBox()
      assert.ok(bounds.width <= width && bounds.x >= 0)
      await page.screenshot({ path: path.join(output, `drawer-${width}.png`) })
      await page.keyboard.press('Shift+Tab')
      assert.equal(await page.evaluate(() => Boolean(document.querySelector('[role="dialog"]').contains(document.activeElement))), true)
      await page.keyboard.press('Escape')
      assert.equal(await panel.isVisible(), false)
      assert.equal(await page.getByRole('textbox', { name: 'Brainstorm message' }).isVisible(), true)
    }
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByRole('button', { name: 'Open Live AI Summary', exact: true }).filter({ visible: true }).click()
    await page.evaluate(() => window.updateSummary('Updated Credit scope.'))
    await page.waitForTimeout(100)
    assert.equal(await page.locator('[data-summary-section="understanding"] [data-summary-phase]').getAttribute('data-summary-phase'), 'idle')
    assert.deepEqual(errors, [])
    console.log(`PASS desktop/mobile screenshots, reserved layout, responsive drawer, keyboard focus, Markdown bullets, reduced motion, no overflow or browser errors. Screenshots: ${output}`)
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
