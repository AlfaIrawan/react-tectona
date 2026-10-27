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
  const testDiagrams = process.env.TECTONA_SUMMARY_DIAGRAMS === '1'
  const diagramSource = '@startuml\nstart\n:Organizer: hold meeting;\n:PIC: write MoM;\n:PIC: email MoM;\nstop\n@enduml'
  const proposedSource = diagramSource.replace(':PIC: write MoM;', ':AI: generate MoM;')
  const diagramMessages = testDiagrams ? [
    { role: 'assistant', text: 'AS-IS — current process:\n\n```plantuml\n' + diagramSource + '\n```' },
    { role: 'assistant', text: 'Great, the AS-IS flow is confirmed.' },
    { role: 'assistant', text: 'TO-BE — expected process:\n\n```plantuml\n' + proposedSource + '\n```' },
  ] : []
  const fixture = `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { BrainstormLiveSummaryPanel } from './src/modules/project-management/components/BrainstormLiveSummaryPanel';
    import { BrainstormReadinessFrame } from './src/modules/project-management/components/BrainstormReadinessFrame';
    import { BrainstormSummaryBox } from './src/modules/project-management/components/BrainstormSummaryBox';
    import { BrainstormSummaryDiagrams } from './src/modules/project-management/components/BrainstormSummaryDiagrams';
    import { buildSummaryDiagramAttachments } from './src/modules/project-management/lib/brainstormSummaryDiagrams';
    const initial = {job_id:'test',brainstorm_messages:[{role:'assistant',text:'Response',summary:'Build a Gen AI assistant for **Credit**.\\n\\n- Retrieve approved policies with RAG.\\n- Embed the chat in DigiLearn.',ai_advice:'Validate policy access with the Credit team.'}],intake_checklist:[{id:'goal',prompt:'Project goal',evidence_status:'confirmed',evidence_text:'Answer Credit policy questions.'},{id:'kpi',prompt:'Success metrics',evidence_status:'inferred',evidence_text:'Accuracy target: 90% (not confirmed).'}],brainstorm_remaining_gaps:['Confirm the current process and policy owners.']};
    initial.revision='r1';initial.live_summary={status:'ready',source_revision:'r1',source_fingerprint:'test',text:'Structured proposal',sections:[{key:'objective',title:'Tujuan',body:'Build a Gen AI assistant for **Credit**.\\n\\n- Retrieve approved policies with RAG.\\n- Embed the chat in DigiLearn.',evidence_ids:['goal']},{key:'problem',title:'Permasalahan',body:'Credit staff currently search policy documents manually.',evidence_ids:['problem']},{key:'as_is_evidence',title:'Evidence AS-IS',body:'- Policy lookup is manual.\\n- Staff consult internal policy documents.',evidence_ids:['asis']}]};
    initial.live_summary.recovery_mode='evidence_rebuild';
    initial.brainstorm_messages.push(...${JSON.stringify(diagramMessages)});
    const chatRecap='Alur AS-IS: rapat selesai, PIC membuat MoM, lalu mengirimkannya lewat email.';
    const chatAttachments=buildSummaryDiagramAttachments([...initial.brainstorm_messages.filter(message=>!message.text.startsWith('TO-BE')),{role:'assistant',text:chatRecap,summary:chatRecap}]);
    function ChatSummaryFixture(){return ${testDiagrams}?<div data-chat-summary-fixture className="mx-auto max-w-xl"><BrainstormSummaryBox text="Alur AS-IS sudah dikonfirmasi." indonesian><BrainstormSummaryDiagrams diagrams={chatAttachments.at(-2)||[]} indonesian /></BrainstormSummaryBox><BrainstormSummaryBox text={chatRecap} indonesian><BrainstormSummaryDiagrams diagrams={chatAttachments.at(-1)||[]} indonesian /></BrainstormSummaryBox></div>:null;}
    function Fixture(){const [job,setJob]=useState({...initial,live_summary:null,brainstorm_messages:[{role:'assistant',text:'Hello. Describe your project.'}]});const [busy,setBusy]=useState(false);const [longChat,setLongChat]=useState(false);const [readinessCollapsed,setReadinessCollapsed]=useState(false);const [longReadiness,setLongReadiness]=useState(false);window.longReadiness=setLongReadiness;window.fillChat=setLongChat;window.startSummary=()=>setJob(initial);window.updateSummary=(text)=>setJob({...initial,live_summary:{...initial.live_summary,sections:initial.live_summary.sections.map((section,index)=>index===0?{...section,body:text}:section)}});window.summaryBusy=setBusy;
      return <div className="flex h-screen flex-col bg-background text-foreground"><header className="flex h-14 shrink-0 items-center border-b px-4 text-sm font-semibold">Tectona Assistant</header><div data-chat-surface className="relative flex min-h-0 flex-1 overflow-hidden bg-background"><div className="hidden min-h-0 min-[1024px]:flex"><BrainstormReadinessFrame collapsed={readinessCollapsed} onToggleCollapsed={()=>setReadinessCollapsed(v=>!v)} confidence={7}>
        <p className="shrink-0 text-xs text-muted-foreground">AI confidence and AS-IS evidence progress before draft generation.</p>
        <div data-readiness-confidence className="shrink-0 border-b pb-4 text-center"><p className="py-6 text-xl">7%</p><p className="text-sm font-semibold">Just started - continue the discussion</p></div>
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden"><h3 className="mb-3 shrink-0 text-xs font-semibold">Evidence progress 2/10</h3><div role="region" aria-label="Readiness questions" tabIndex={0} data-readiness-scroll className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">{Array.from({length:longReadiness?80:10},(_,i)=><p key={i} className="py-2 text-xs">{i+1}. Confirm the Credit project context.</p>)}</div></section>
        <div data-readiness-initiative className="shrink-0 border-t pt-4 text-xs">Initiative direction</div>
      </BrainstormReadinessFrame></div><main data-chat className="flex min-w-0 flex-1 flex-col bg-background"><div role="region" aria-label="Brainstorm conversation" tabIndex={0} className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-5 py-6"><p className="max-w-xl pr-12">Describe the current Credit policy process.</p><ChatSummaryFixture />{longChat?Array.from({length:80},(_,i)=><p key={i} className="py-4">Confirmed context from the Credit policy discussion.</p>):null}</div><div data-composer className="p-4"><textarea aria-label="Brainstorm message" className="h-20 w-full resize-none rounded-lg border p-3" placeholder="Ask Tectona Assistant" /></div></main><BrainstormLiveSummaryPanel job={job} busy={busy} /></div></div>;
    }createRoot(document.getElementById('root')).render(<Fixture/>);`
  const bundle = await esbuild.build({
    stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' }, alias: { '@': path.resolve('src') }, loader: { '.css': 'empty' },
    plugins: [{ name: 'non-prose-visuals', setup(build) {
      build.onResolve({ filter: /\/Assistant(?:Mermaid|Chart)Block$/ }, args => testDiagrams && args.path.endsWith('AssistantMermaidBlock') ? undefined : ({ path: args.path, namespace: 'visual' }))
      build.onLoad({ filter: /.*/, namespace: 'visual' }, () => ({ contents: 'export const AssistantMermaidBlock=()=>null;export const AssistantChartBlock=()=>null;', loader: 'js' }))
      if (testDiagrams) {
        build.onResolve({ filter: /tectonaAgentRuntimeApi$/ }, args => ({ path: args.path, namespace: 'diagram-api' }))
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="170" viewBox="0 0 900 170"><rect width="900" height="170" fill="white"/><g fill="white" stroke="#111" stroke-width="2"><circle cx="35" cy="85" r="18"/><rect x="90" y="45" width="200" height="80" rx="6"/><rect x="350" y="45" width="200" height="80" rx="6"/><rect x="610" y="45" width="200" height="80" rx="6"/><circle cx="860" cy="85" r="18"/><path d="M53 85H90M290 85H350M550 85H610M810 85H842"/></g><g font-family="Arial" font-size="18" text-anchor="middle"><text x="190" y="90">Hold meeting</text><text x="450" y="90">Write MoM</text><text x="710" y="90">Email MoM</text></g></svg>'
        build.onLoad({ filter: /.*/, namespace: 'diagram-api' }, () => ({ contents: `export async function renderProcessDiagram(source){window.__diagramSources=(window.__diagramSources||[]).concat(source);return {url:${JSON.stringify('data:image/svg+xml,' + encodeURIComponent(svg))},notation:'bpmn'}}`, loader: 'js' }))
      }
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
    await page.addInitScript(sources => { window.__expectedDiagrams = sources }, [diagramSource, proposedSource])
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await page.waitForTimeout(1000)
    assert.equal(errors.length, 0, `fixture browser errors: ${errors.join('; ')}`)
    await page.evaluate(() => document.documentElement.style.setProperty('--radius', '0.5rem'))
    const panel = page.locator('aside[aria-label="Live AI Summary"]')
    const readiness = page.getByRole('complementary', { name: 'Draft Readiness', exact: true })
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
    if (testDiagrams) {
      const chatSummary = page.locator('[data-chat-summary-fixture]')
      assert.equal(await chatSummary.locator('figure').count(), 1, 'only first confirmation previews the diagram')
      const button = chatSummary.getByRole('button', { name: 'Lihat diagram AS-IS', exact: true })
      await button.click()
      assert.equal(await chatSummary.locator('figure').count(), 2)
      await chatSummary.locator('figure').last().getByRole('button', { name: 'Fullscreen', exact: true }).click()
      await page.getByRole('dialog', { name: 'Fullscreen diagram' }).waitFor()
      await page.keyboard.press('Escape')
      await chatSummary.getByRole('button', { name: 'Tutup diagram AS-IS', exact: true }).click()
      assert.equal(await chatSummary.locator('figure').count(), 1)
    }
    assert.ok(originalChat.width - (await page.locator('[data-chat]').boundingBox()).width > 350)
    assert.doesNotMatch(await panel.textContent(), /Open points|Confidence|Confirmed evidence|Evidence \(/)
    assert.doesNotMatch(await panel.textContent(), /Current understanding/)
    for (const title of ['Tujuan', 'Permasalahan', 'Evidence AS-IS']) assert.equal(await panel.getByRole('heading', { name: title, exact: true }).count(), 1)
    assert.equal(await panel.getByText('Summary rebuilt from saved evidence.', { exact: true }).count(), 1)
    assert.doesNotMatch(await panel.textContent(), /Update failed/)
    const verify = async () => {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow')
      const chat = await page.locator('[data-chat]').boundingBox(), summary = await panel.boundingBox()
      assert.ok(chat.width > 0)
      if (testDiagrams) {
        const figure = panel.locator('[data-summary-diagram="as_is"]')
        await figure.scrollIntoViewIfNeeded()
        const image = figure.locator('img')
        await image.waitFor()
        await page.waitForFunction(() => document.querySelector('[data-summary-diagram] img')?.naturalWidth > 0)
        assert.ok((await image.boundingBox()).height <= 141, 'compact thumbnail height is bounded')
        assert.ok((await image.boundingBox()).width <= (await figure.boundingBox()).width, 'thumbnail fits narrow panel')
        assert.equal(await page.evaluate(() => window.__diagramSources.every(source => window.__expectedDiagrams.includes(source))), true, 'render the saved source without AI redrawing')
        const tobe = panel.locator('[data-summary-diagram="to_be"]')
        assert.equal(await tobe.getAttribute('data-diagram-status'), 'awaiting_confirmation')
        await tobe.scrollIntoViewIfNeeded()
        await tobe.locator('img').waitFor()
        await page.screenshot({ path: path.join(output, `pending-tobe-${page.viewportSize().width}.png`) })
        await figure.getByRole('button', { name: 'Fullscreen', exact: true }).click()
        await page.getByRole('dialog', { name: 'Fullscreen diagram' }).waitFor()
        await page.keyboard.press('Escape')
        assert.equal(await page.getByRole('dialog', { name: 'Fullscreen diagram' }).count(), 0)
        assert.equal(await panel.isVisible(), true, 'closing the diagram must not close the summary drawer')
      }
      if (await page.viewportSize().width >= 1440) assert.ok(chat.x + chat.width <= summary.x + 1, 'summary reserves space beside chat')
      assert.equal(await page.locator('[data-summary-section="objective"] ul li').count(), 4, 'animated and reserved Markdown each render two bullets')
      if (page.viewportSize().width >= 1440) {
        assert.ok(summary.y >= 80 && summary.x + summary.width <= page.viewportSize().width - 24, 'floating panel has generous top and right margins')
        assert.ok(summary.height <= 761 && summary.y + summary.height < page.viewportSize().height, 'not a full-height sidebar')
        assert.equal(await panel.evaluate(element => getComputedStyle(element).position), 'absolute')
        assert.equal(await panel.evaluate(element => getComputedStyle(element).borderRadius), '8px')
        const shadow = await panel.evaluate(element => getComputedStyle(element).boxShadow)
        assert.match(shadow, /32px/, 'visible elevation must not regress to a nearly flat shadow')
        assert.match(shadow, /8px/, 'floating panel has layered elevation')
        const leftBounds = await readiness.boundingBox()
        assert.equal(leftBounds.x, 24)
        assert.equal(leftBounds.y, summary.y)
        assert.equal(leftBounds.width, summary.width)
        assert.ok(Math.abs(leftBounds.height - (page.viewportSize().height - 104)) <= 1, 'readiness fills available height, not the summary height cap')
        for (const property of ['boxShadow', 'borderRadius', 'borderColor', 'backgroundColor']) {
          assert.equal(await readiness.evaluate((element, property) => getComputedStyle(element)[property], property), await panel.evaluate((element, property) => getComputedStyle(element)[property], property), `matching panel ${property}`)
        }
        assert.equal(await readiness.locator('header').evaluate(element => element.offsetHeight), await panel.locator('header').evaluate(element => element.offsetHeight))
        assert.ok(leftBounds.x + leftBounds.width < chat.x, 'readiness does not overlap the conversation')
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
    const readinessScroll = readiness.getByRole('region', { name: 'Readiness questions', exact: true })
    await page.evaluate(() => window.longReadiness(true))
    const fixedSelectors = ['header', '[data-readiness-confidence]', '[data-readiness-initiative]']
    const fixedBefore = await Promise.all(fixedSelectors.map(selector => readiness.locator(selector).boundingBox()))
    await assertHiddenScrollbar(readinessScroll)
    await page.mouse.wheel(0, 400)
    await page.waitForTimeout(200)
    assert.ok(await readinessScroll.evaluate(element => element.scrollTop > 0), 'readiness content remains scrollable')
    for (let index = 0; index < fixedSelectors.length; index++) {
      assert.deepEqual(await readiness.locator(fixedSelectors[index]).boundingBox(), fixedBefore[index], 'only the question list scrolls; header, confidence and initiative remain fixed')
    }
    assert.equal(await readiness.locator('[data-readiness-body]').evaluate(element => element.scrollTop), 0)
    await readinessScroll.evaluate(element => { element.scrollTop = 0; element.focus() })
    await page.keyboard.press('PageDown')
    await page.waitForTimeout(200)
    assert.ok(await readinessScroll.evaluate(element => element.scrollTop > 0), 'question list retains keyboard scrolling')
    await page.evaluate(() => window.longReadiness(false))
    await readiness.getByRole('button', { name: 'Collapse readiness panel', exact: true }).click()
    await page.waitForTimeout(300)
    assert.equal((await readiness.boundingBox()).width, 48)
    await readiness.getByRole('button', { name: 'Expand readiness panel', exact: true }).click()
    await page.waitForTimeout(300)
    assert.match(await readiness.textContent(), /7%/)
    await verify()
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
      if (testDiagrams) {
        const chatPreview = page.locator('[data-chat-summary-fixture] figure').first()
        await chatPreview.scrollIntoViewIfNeeded()
        assert.ok((await chatPreview.locator('img').boundingBox()).width <= width - 20, 'chat diagram fits the mobile conversation')
        await page.screenshot({ path: path.join(output, `chat-diagram-${width}.png`) })
      }
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
    console.log(`PASS matching readiness/summary floating panels, collapse/expand, hidden scrollbars, animated layout, desktop/mobile screenshots, keyboard focus, reduced motion and no overflow. Screenshots: ${output}`)
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
