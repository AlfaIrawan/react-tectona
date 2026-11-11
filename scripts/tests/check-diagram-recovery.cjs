const assert = require('node:assert/strict')
const http = require('node:http')
const path = require('node:path')

async function main() {
  const { build } = await import('vite')
  const { chromium } = require(process.argv[2] ?? 'playwright')
  const fixture = 'scripts/tests/fixtures/diagram-recovery.html'
  const result = await build({
    configFile: false,
    envFile: false,
    plugins: [{
      name: 'fixture-no-service-worker',
      resolveId: id => id === 'virtual:pwa-register' ? '\0fixture-pwa-register' : undefined,
      load: id => id === '\0fixture-pwa-register' ? 'export const registerSW = () => () => Promise.resolve()' : undefined,
    }],
    resolve: { alias: { '@': path.resolve('src') } },
    esbuild: { jsx: 'automatic' },
    build: { write: false, reportCompressedSize: false, rollupOptions: { input: path.resolve(fixture) } },
  })
  const assets = new Map((Array.isArray(result) ? result.flatMap(item => item.output) : result.output)
    .map(asset => ['/' + asset.fileName, asset.type === 'asset' ? asset.source : asset.code]))
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname
    const asset = request.method === 'GET' && assets.get(pathname)
    if (!asset) { response.writeHead(404).end(); return }
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }
    response.setHeader('Content-Type', mime[path.extname(pathname)] ?? 'application/octet-stream')
    response.end(asset)
  })
  let browser
  try {
    await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve))
    const origin = 'http://127.0.0.1:' + server.address().port
    browser = await chromium.launch({ channel: 'chrome', headless: true })
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
    await context.routeWebSocket('**/*', socket => socket.close())
    const responses = new Map()
    const waiting = new Map()
    await context.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.origin !== origin || route.request().method() !== 'GET' || url.pathname.startsWith('/api/')) return route.abort()
      if (url.pathname !== '/fixture-saved-graph') return route.continue()
      const id = url.searchParams.get('key') + ':' + url.searchParams.get('request')
      const title = await new Promise(resolve => {
        responses.set(id, resolve)
        waiting.get(id)?.()
        waiting.delete(id)
      })
      await route.fulfill({ json: { title } })
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const open = async () => {
      await page.goto(origin + '/' + fixture)
      await page.getByRole('button', { name: 'Request saved graph' }).waitFor()
    }
    const node = (title) => page.locator('.react-flow__node').getByText(title, { exact: true })
    const request = async (id) => {
      const received = new Promise(resolve => waiting.set(id, resolve))
      const timeout = setTimeout(() => waiting.get(id)?.(false), 5000)
      try {
        await page.getByRole('button', { name: 'Request saved graph' }).click()
        assert.notEqual(await received, false, 'No intercepted request for ' + id)
      } finally {
        clearTimeout(timeout)
        waiting.delete(id)
      }
    }
    const release = async (id, title) => {
      const response = responses.get(id)
      assert.ok(response, 'Expected pending response ' + id)
      responses.delete(id)
      const finished = page.waitForResponse(res => {
        const url = new URL(res.url())
        return url.pathname === '/fixture-saved-graph' && url.searchParams.get('key') + ':' + url.searchParams.get('request') === id
      })
      response(title)
      await (await finished).finished()
    }
    const reload = page.getByRole('button', { name: 'Reload saved diagram' })
    const discard = page.getByRole('button', { name: 'Discard edits and reload' })
    const addNode = () => page.getByRole('button', { name: 'Use case', exact: true }).click()

    await open()
    await node('Source one').waitFor()
    await request('one:1')
    await release('one:1', 'Normal saved diagram')
    await node('Normal saved diagram').waitFor()
    assert.equal(await reload.count(), 0)
    await addNode()
    const afterEdit = await page.locator('.react-flow__node').count()
    assert.equal(afterEdit, 3)
    await request('one:2')
    await request('one:3')
    await release('one:3', 'Background refresh')
    await page.locator('output[aria-label="Fixture response"]').filter({ hasText: 'Background refresh' }).waitFor()
    await release('one:2', 'Obsolete same-key response')
    await page.locator('output[aria-label="Finished fixture request"]').filter({ hasText: 'one:2' }).waitFor()
    assert.equal(await page.locator('output[aria-label="Fixture response"]').innerText(), 'Background refresh')
    assert.equal(await page.locator('.react-flow__node').count(), afterEdit)
    assert.equal(await node('Background refresh').count(), 0)

    await page.evaluate(() => localStorage.clear())
    await open()
    await node('Source one').waitFor()
    await request('one:1')
    await addNode()
    await release('one:1', 'Late saved diagram')
    await reload.waitFor()
    assert.equal(await page.locator('.react-flow__node').count(), 3)
    await reload.click()
    await page.getByRole('button', { name: 'Keep editing' }).click()
    await discard.waitFor({ state: 'detached' })
    assert.equal(await page.locator('.react-flow__node').count(), 3)
    await open()
    await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length === 3)
    await request('one:1')
    await release('one:1', 'Saved after reopening')
    await reload.waitFor()
    assert.equal(await page.locator('.react-flow__node').count(), 3)
    await request('one:2')
    await reload.click()
    await release('one:2', 'Newest saved diagram')
    await discard.waitFor({ state: 'detached' })
    assert.equal(await page.locator('.react-flow__node').count(), 3)
    await reload.click()
    await discard.click()
    await node('Newest saved diagram').waitFor()
    assert.equal(await page.locator('.react-flow__node').count(), 2)
    assert.equal(await reload.count(), 0)

    await request('one:3')
    await page.getByRole('button', { name: 'Switch diagram' }).click()
    await node('Source two').waitFor()
    await release('one:3', 'Obsolete diagram one')
    await page.locator('output[aria-label="Finished fixture request"]').filter({ hasText: 'one:3' }).waitFor()
    assert.equal(await page.locator('output[aria-label="Fixture response"]').innerText(), 'Waiting')
    await request('two:1')
    await release('two:1', 'Saved diagram two')
    await node('Saved diagram two').waitFor()
    assert.equal(await node('Obsolete diagram one').count(), 0)
    assert.equal(await reload.count(), 0)
    assert.deepEqual(errors, [])
    console.log('Browser diagram recovery: clean load, late edit, cancel, stale confirmation, explicit reload and key switch passed')
  } finally {
    await browser?.close()
    if (server.listening) await new Promise(resolve => server.close(resolve))
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
