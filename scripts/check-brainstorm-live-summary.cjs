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
    initial.revision='r1';initial.live_summary={status:'ready',source_revision:'r1',source_fingerprint:'test',text:'Structured proposal',sections:[{key:'objective',title:'Tujuan',body:'Build a Gen AI assistant for **Credit**.\\n\\n- Retrieve approved policies with RAG.\\n- Embed the chat in DigiLearn.',evidence_ids:['goal']},{key:'problem',title:'Permasalahan',body:'Credit staff currently search policy documents manually.',evidence_ids:['problem']},{key:'as_is_evidence',title:'Evidence AS-IS',body:'- Policy lookup is manual.\\n- Staff consult internal policy documents.',evidence_ids:['asis']}]};
    function Fixture(){const [job,setJob]=useState({...initial,live_summary:null,brainstorm_messages:[{role:'assistant',text:'Hello. Describe your project.'}]});const [busy,setBusy]=useState(false);const [longChat,setLongChat]=useState(false);window.fillChat=setLongChat;window.startSummary=()=>setJob(initial);window.updateSummary=(text)=>setJob({...initial,live_summary:{...initial.live_summary,sections:initial.live_summary.sections.map((section,index)=>index===0?{...section,body:text}:section)}});window.summaryBusy=setBusy;
      return <div className="flex h-screen flex-col bg-background text-foreground"><header className="flex h-14 shrink-0 items-center border-b px-4 text-sm font-semibold">Tectona Assistant</header><div data-chat-surface className="relative flex min-h-0 flex-1 overflow-hidden bg-background"><aside className="hidden w-[416px] shrink-0 border-r p-5 min-[1024px]:block">Draft Readiness</aside><main data-chat className="flex min-w-0 flex-1 flex-col bg-background"><div role="region" aria-label="Brainstorm conversation" tabIndex={0} className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-5 py-6"><p className="max-w-xl pr-12">Describe the current Credit policy process.</p>{longChat?Array.from({length:80},(_,i)=><p key={i} className="py-4">Confirmed context from the Credit policy discussion.</p>):null}</div><div data-composer className="p-4"><textarea aria-label="Brainstorm message" className="h-20 w-full resize-none rounded-lg border p-3" placeholder="Ask Tectona Assistant" /></div></main><BrainstormLiveSummaryPanel job={job} busy={busy} /></div></div>;
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
  const css = await postcss([tailwind({ ...config, content: [...config.content, { raw: fixture, extension: 'tsx' }] })]).process(await fs.readFile('src/index.css', 'utf8'), { from: path.resolve('src/index.css') })
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
    await page.evaluate(() => document.documentElement.style.setProperty('--radius', '0.5rem'))
    const panel = page.locator('aside[aria-label="Live AI Summary"]')
    const output = await fs.mkdtemp(path.join(os.tmpdir(), 'tectona-live-summary-'))
    assert.equal(await panel.count(), 0, 'no reserved panel before summary data')
    assert.equal(await page.getByRole('button', { name: 'Open Live AI Summary', exact: true }).count(), 0)
    const originalChat = await page.locator('[data-chat]').boundingBox()
    await page.screenshot({ path: path.join(output, 'before-summary.png') })
    await page.evaluate(() => { window.summaryBusy(true); window.startSummary() })
    await page.waitForTimeout(100)
    assert.equal(await panel.count(), 0, 'do not show pending data')
    const widths = await page.evaluate(async () => {
      window.summaryBusy(false)
      const samples = []
      for (let i = 0; i < 35; i++) {
        await new Promise(requestAnimationFrame)
        samples.push(document.querySelector('[data-summary-space]')?.getBoundingClientRect().width ?? 0)
      }
      return samples
    })
    assert.ok(widths.some(width => width > 1 && width < 415), 'reserved space animates and chat reflows gradually')
    await panel.waitFor({ state: 'visible' })
    await page.waitForTimeout(1100)
    assert.ok(originalChat.width - (await page.locator('[data-chat]').boundingBox()).width > 350)
    assert.doesNotMatch(await panel.textContent(), /Open points|Confidence|Confirmed evidence|Evidence \(/)
    assert.doesNotMatch(await panel.textContent(), /Current understanding/)
    for (const title of ['Tujuan', 'Permasalahan', 'Evidence AS-IS']) assert.equal(await panel.getByRole('heading', { name: title, exact: true }).count(), 1)
    const verify = async () => {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow')
      const chat = await page.locator('[data-chat]').boundingBox(), summary = await panel.boundingBox()
      assert.ok(chat.width > 0)
      if (await page.viewportSize().width >= 1440) assert.ok(chat.x + chat.width <= summary.x + 1, 'summary reserves space beside chat')
      assert.equal(await page.locator('[data-summary-section="objective"] ul li').count(), 4, 'animated and reserved Markdown each render two bullets')
      if (page.viewportSize().width >= 1440) {
        assert.ok(summary.y >= 64 && summary.x + summary.width <= page.viewportSize().width - 12, 'floating panel has top and right margins')
        assert.ok(summary.height <= 761 && summary.y + summary.height < page.viewportSize().height, 'not a full-height sidebar')
        assert.equal(await panel.evaluate(element => getComputedStyle(element).position), 'absolute')
        assert.equal(await panel.evaluate(element => getComputedStyle(element).borderRadius), '8px')
      }
    }
    await verify()
    await page.screenshot({ path: path.join(output, 'desktop.png') })
    const conversation = page.getByRole('region', { name: 'Brainstorm conversation', exact: true })
    const assertHiddenScrollbar = async region => {
      assert.equal(await region.evaluate(element => getComputedStyle(element).scrollbarWidth), 'none')
      assert.equal(await region.evaluate(element => getComputedStyle(element, '::-webkit-scrollbar').display), 'none')
      await region.hover()
      assert.equal(await region.evaluate(element => getComputedStyle(element).scrollbarWidth), 'none', 'hover must not reveal scrollbar')
    }
    await page.evaluate(() => window.fillChat(true))
    await assertHiddenScrollbar(conversation)
    await page.mouse.wheel(0, 400)
    await page.waitForTimeout(200)
    assert.ok(await conversation.evaluate(element => element.scrollTop > 0), 'conversation still scrolls with the wheel')
    await conversation.evaluate(element => { element.scrollTop = 0; element.focus() })
    await page.keyboard.press('PageDown')
    await page.waitForTimeout(200)
    assert.ok(await conversation.evaluate(element => element.scrollTop > 0), 'conversation still scrolls with keyboard')
    await page.evaluate(() => window.fillChat(false))
    const surfaceColour = await page.locator('[data-chat-surface]').evaluate(element => getComputedStyle(element).backgroundColor)
    assert.equal(await page.locator('[data-chat]').evaluate(element => getComputedStyle(element).backgroundColor), surfaceColour)
    assert.equal(await panel.evaluate(element => getComputedStyle(element).backgroundColor), surfaceColour, 'summary floats on the same chat surface')
    assert.equal(await page.locator('[data-composer]').evaluate(element => getComputedStyle(element).borderTopWidth), '0px')
    await page.evaluate(() => window.updateSummary(Array(100).fill('A grounded paragraph about the Credit policy process.').join('\n\n')))
    await page.waitForTimeout(1000)
    assert.ok((await panel.boundingBox()).height <= 761)
    assert.equal(await panel.locator('[data-summary-scroll]').evaluate(element => element.scrollHeight > element.clientHeight), true, 'long proposals scroll within the floating panel')
    const summaryScroll = panel.getByRole('region', { name: 'Idea summary', exact: true })
    await assertHiddenScrollbar(summaryScroll)
    await page.mouse.wheel(0, 400)
    await page.waitForTimeout(200)
    assert.ok(await summaryScroll.evaluate(element => element.scrollTop > 0), 'summary still scrolls with the wheel')
    await summaryScroll.evaluate(element => { element.scrollTop = 0; element.focus() })
    await page.keyboard.press('PageDown')
    await page.waitForTimeout(200)
    assert.ok(await summaryScroll.evaluate(element => element.scrollTop > 0), 'summary still scrolls with keyboard')
    await page.evaluate(() => window.startSummary())
    await page.waitForTimeout(1000)
    await page.getByRole('button', { name: 'Collapse summary', exact: true }).click()
    await page.evaluate(() => window.updateSummary('Build a Gen AI assistant for **Credit**.\n\n- Retrieve approved policies with RAG.\n- Embed the chat in DigiLearn.\n\nUpdated policy scope.'))
    await page.waitForTimeout(300)
    assert.ok((await panel.boundingBox()).width <= 49, 'summary updates respect collapsed preference')
    assert.equal(await panel.getByRole('status', { name: 'Summary updated' }).isVisible(), true)
    await page.screenshot({ path: path.join(output, 'collapsed-updated.png') })
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
    assert.equal(await page.locator('[data-summary-section="objective"] [data-summary-phase]').getAttribute('data-summary-phase'), 'idle')
    await page.reload()
    await page.waitForTimeout(150)
    assert.equal(await panel.count(), 0, 'mobile also starts without panel or trigger')
    assert.equal(await page.getByRole('button', { name: 'Open Live AI Summary', exact: true }).count(), 0)
    await page.evaluate(() => window.startSummary())
    await page.getByRole('dialog', { name: 'Live AI Summary' }).waitFor({ state: 'visible' })
    await page.keyboard.press('Escape')
    await page.evaluate(() => window.updateSummary('Second mobile summary.'))
    await page.waitForTimeout(100)
    assert.equal(await panel.isVisible(), false, 'later updates do not reopen a dismissed mobile drawer')
    assert.equal(await page.getByRole('status', { name: 'Summary updated' }).filter({ visible: true }).count(), 1)
    assert.deepEqual(errors, [])
    console.log(`PASS no panel before data, animated entrance and layout, narrative-only content, collapsed update marker, desktop/mobile screenshots, keyboard focus, reduced motion and no overflow. Screenshots: ${output}`)
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
