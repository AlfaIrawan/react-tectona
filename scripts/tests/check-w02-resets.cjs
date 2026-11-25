const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const ts = require('typescript')

function section(file, start, end) {
  const source = fs.readFileSync(file, 'utf8')
  const from = source.indexOf(start)
  const to = source.indexOf(end, from + start.length)
  assert.ok(from >= 0 && to > from, 'Missing fixture boundary in ' + file)
  return source.slice(from, to)
}

async function main() {
  const { build } = await import('vite')
  const { chromium } = require(process.argv[2] ?? 'playwright')
  const fixture = 'scripts/tests/fixtures/w02-resets.html'
  // Use the production state/route logic without starting the full workflow page.
  const workflow = section('src/modules/workflow-automation-engine/pages/WorkflowAutomationEnginePage.tsx',
    '  const [builder, setBuilder]', '  const [workflows, setWorkflows]')
  const picker = section('src/modules/document-knowledge-management/pages/DocumentKnowledgeManagementPage.tsx',
    'function MeetingPeopleMultiSelect(', 'function formatVoiceElapsed(')
  const typewriter = section('src/modules/core-shell/components/ChatSidebarPanel.tsx',
    'function AssistantTypewriterText(', 'function WhatsAppChatBubble(')
  const extracted = ts.transpileModule(`
    import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
    import { useSearchParams } from 'react-router-dom'
    import { Search, X } from 'lucide-react'
    import { Label } from '@/components/ui/label'
    import { Input } from '@/components/ui/input'
    export function useFixtureWorkflowLink() {
      ${workflow}
      return [builder, setBuilder]
    }
    export ${picker}
    const AssistantChatMarkdown = ({ content }) => <article>{content}</article>
    export ${typewriter}
  `, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const { output } = await build({
    configFile: false, envFile: false,
    resolve: { alias: { '@': path.resolve('src') } },
    esbuild: { jsx: 'automatic' },
    plugins: [{
      name: 'reset-fixture',
      resolveId: (id) => ['virtual:w02-resets', 'virtual:pwa-register'].includes(id) ? '\0' + id : undefined,
      load: (id) => id === '\0virtual:w02-resets' ? extracted
        : id === '\0virtual:pwa-register' ? 'export const registerSW = () => () => Promise.resolve()' : undefined,
    }],
    build: { write: false, reportCompressedSize: false, rollupOptions: { input: path.resolve(fixture) } },
  })
  const assets = new Map(output.map(asset => ['/' + asset.fileName, asset.type === 'asset' ? asset.source : asset.code]))
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    const asset = req.method === 'GET' && assets.get(url.pathname)
    if (!asset) { res.writeHead(404).end(); return }
    res.setHeader('Content-Type', url.pathname.endsWith('.html') ? 'text/html' : 'application/javascript')
    res.end(asset)
  })
  let browser
  try {
    await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve))
    const origin = 'http://127.0.0.1:' + server.address().port
    browser = await chromium.launch({ channel: 'chrome', headless: true })
    const context = await browser.newContext({ serviceWorkers: 'block' })
    await context.routeWebSocket('**/*', socket => socket.close())
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      return url.origin === origin && route.request().method() === 'GET' && assets.has(url.pathname)
        ? route.continue() : route.abort()
    })
    const page = await context.newPage()
    page.setDefaultTimeout(8000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(origin + '/' + fixture)
    const button = (name) => page.getByRole('button', { name, exact: true })
    const visible = (value) => page.getByText(value, { exact: true }).waitFor()
    const next = () => button('Next').click()
    const search = page.getByRole('textbox', { name: 'Search inbox requests' })
    await visible('1/3')
    await next()
    await next()
    await visible('3/3')
    await button('Shrink inbox').click()
    await visible('2/2')
    await button('Restore inbox').click()
    await visible('2/3')
    await search.fill('request')
    await visible('1/3')
    await next()
    await visible('2/3')
    await button('Switch project with stale update').click()
    await visible('1/3')
    await next()
    await visible('2/3')
    await button('Toggle loading').click()
    await visible('1/1')
    assert.equal(await button('Next').isDisabled(), true)
    await button('Toggle loading').click()
    await visible('2/3')
    await search.fill('does-not-exist')
    await visible('No matches for your search')
    await visible('1/1')
    await search.fill('')
    await visible('1/3')
    const panel = page.locator('#panel-inbox')
    assert.match(await panel.evaluate(el => el.style.height), /px$/)
    await button('Expand inbox to fullscreen').click()
    await button('Exit inbox fullscreen').waitFor()
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
    await page.setViewportSize({ width: 1000, height: 800 })
    await page.keyboard.press('Escape')
    await button('Expand inbox to fullscreen').waitFor()
    assert.equal(await page.evaluate(() => document.body.style.overflow), '')
    assert.match(await panel.evaluate(el => el.style.height), /px$/)
    console.log('Inbox search, project switch, clamp, loading, and fullscreen reset passed')

    const dialog = page.getByRole('dialog', { name: 'Workflow builder' })
    await visible('POP /workflow?view=runs')
    assert.equal(await dialog.count(), 0)
    await button('First workflow').click()
    await visible('first runs one')
    await visible('REPLACE /workflow')
    await button('Close workflow builder').click()
    await dialog.waitFor({ state: 'hidden' })
    await button('Competing workflow links').click()
    await visible('latest builder new')
    assert.equal(await page.getByText('stale builder old', { exact: true }).count(), 0)
    await visible('REPLACE /workflow')
    await button('Close workflow builder').click()
    await button('Workflow back').click()
    await visible('POP /workflow')
    assert.equal(await dialog.count(), 0)
    console.log('Workflow negative link, latest destination, and consumed-link history passed')

    const picker = page.getByPlaceholder('Search Tectona members…')
    await picker.fill('Taylor')
    await visible('Fixture Taylor')
    await button('Toggle meeting picker').evaluate(el => el.click())
    await page.getByText('Fixture Taylor', { exact: true }).waitFor({ state: 'hidden' })
    assert.equal(await picker.inputValue(), '')
    await button('Toggle meeting picker').click()
    await visible('Fixture Alice')
    await picker.fill('Taylor')
    await page.getByRole('button', { name: /^Fixture Taylor/ }).click()
    await button('Remove Fixture Taylor').waitFor()
    await button('Remove Fixture Alice').waitFor()
    assert.equal(await picker.inputValue(), '')
    console.log('Knowledge participant picker resets its search without losing selected participants')

    const clockStart = Date.now()
    await page.clock.install({ time: clockStart })
    await page.clock.pauseAt(clockStart + 1000)
    const chooseMessage = (name) => button(name).evaluate(el => el.click())
    await chooseMessage('Start Chat fixture')
    await visible('Active message: first')
    await page.clock.runFor(800)
    await visible('Completed: first')
    await chooseMessage('Replace with identical Chat text')
    await visible('Active message: second')
    await page.clock.runFor(799)
    await visible('Completed: first')
    await page.clock.runFor(1)
    await visible('Completed: first,second')
    await chooseMessage('Show instant Chat message')
    await visible('Completed: first,second,instant')
    await chooseMessage('Clear Chat message')
    await visible('Active message: empty')
    await page.clock.runFor(1600)
    await visible('Completed: first,second,instant')
    assert.deepEqual(errors, [])
    console.log('Chat same-text replacement, instant and empty states passed in Chrome')
  } finally {
    try { await browser?.close() } finally { await new Promise(resolve => server.close(resolve)) }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
