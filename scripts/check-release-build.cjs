const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const http = require('node:http')
const path = require('node:path')

const contentTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

async function assertInViewport(menu) {
  await menu.waitFor()
  const bounds = await menu.evaluate((element) => {
    const { left, top, right, bottom } = element.getBoundingClientRect()
    return { left, top, right, bottom, width: innerWidth, height: innerHeight }
  })
  assert.ok(bounds.left >= 0 && bounds.top >= 0 && bounds.right <= bounds.width && bounds.bottom <= bounds.height,
    'Menu outside viewport: ' + JSON.stringify(bounds))
}

async function checkProfileRefresh(page, origin) {
  const routePattern = '**/v1/agent/model-catalog'
  const isCatalog = (request) => new URL(request.url()).pathname.endsWith('/v1/agent/model-catalog')
  const pending = []
  const catalog = {
    scope: 'shared_runtime', updatedAt: '2026-01-01T00:00:00Z',
    providers: [{ id: 'fixture', name: 'Fixture Provider', protocol: 'fixture', status: 'configured', region: 'local' }],
    models: [{
      id: 'fixture-model', modelId: 'fixture-model', providerId: 'fixture', providerName: 'Fixture Provider',
      name: 'Fixture Model', type: 'text', capabilities: [], contextWindow: 'fixture', availability: 'Configured',
      isDefault: true, inputPrice: 1000000, outputPrice: 1000000,
      bestFor: '', tectonaCapabilities: [], strengths: [], capabilitySupport: {},
    }],
  }
  const intercept = (route) => {
    if (new URL(route.request().url()).origin !== origin || route.request().method() !== 'GET') return route.abort()
    const next = pending.shift()
    if (!next) return route.fulfill({ status: 503, json: {} })
    next.resolve(route)
    return next.done.promise
  }
  const start = async (action) => {
    const incoming = Promise.withResolvers()
    const done = Promise.withResolvers()
    pending.push({ resolve: incoming.resolve, done })
    const [request] = await Promise.all([page.waitForRequest(isCatalog), action()])
    const route = await incoming.promise
    return {
      request,
      finish: async (status = 200) => {
        try { await route.fulfill({ status, json: status === 200 ? catalog : {} }) }
        finally { done.resolve() }
      },
      releaseAborted: () => done.resolve(),
    }
  }
  const waitForAbort = (request) => page.waitForEvent('requestfailed', { predicate: (failed) => failed === request })
  await page.route(routePattern, intercept)
  try {
    const providers = page.getByRole('button', { name: 'AI provider & models', exact: true })
    const usage = page.getByRole('button', { name: 'AI usage & spending', exact: true })
    const refresh = page.getByRole('button', { name: 'Refresh AI provider catalog' })
    const refreshPricing = page.getByRole('button', { name: 'Refresh AI usage and pricing' })
    const providerFailure = page.getByText('Unable to load AI providers and models', { exact: true })
    const fixtureProvider = page.getByText('Fixture Provider', { exact: true }).first()
    const unavailable = page.getByText('Pricing information is unavailable for one or more exact model deployments.', { exact: true }).first()
    const pricingSpinner = refreshPricing.locator('.animate-spin')

    await (await start(() => providers.click())).finish()
    await fixtureProvider.waitFor()
    const failingRefresh = await start(() => refresh.click())
    assert.equal(await refresh.isDisabled(), true)
    await failingRefresh.finish(503)
    await providerFailure.waitFor()
    assert.equal(await fixtureProvider.isVisible(), true, 'Keep the last successfully synced catalog')

    const retry = await start(() => page.getByRole('button', { name: 'Retry', exact: true }).click())
    await providerFailure.waitFor({ state: 'hidden' })
    assert.equal(await fixtureProvider.isVisible(), true)
    const [pricing, providerAbort] = await Promise.all([start(() => usage.click()), waitForAbort(retry.request)])
    assert.match(providerAbort.failure()?.errorText ?? '', /ABORTED/)
    retry.releaseAborted()
    await pricing.finish()
    await page.getByText(/Estimated using current configured rates/).first().waitFor()

    const older = await start(() => refreshPricing.click())
    await pricingSpinner.waitFor()
    const [newer, pricingAbort] = await Promise.all([start(() => refreshPricing.click()), waitForAbort(older.request)])
    assert.match(pricingAbort.failure()?.errorText ?? '', /ABORTED/)
    older.releaseAborted()
    await pricingSpinner.waitFor()
    await newer.finish(503)
    await pricingSpinner.waitFor({ state: 'hidden' })
    await unavailable.waitFor()
    assert.equal(pending.length, 0)
    console.log('Production Profile catalog retry, stale request aborts, and pricing failure passed with local fixtures')
  } finally {
    await page.unroute(routePattern, intercept)
  }
}

async function checkEditor(page, origin) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(origin + '/document-knowledge-management?view=knowledge')
    await page.getByText('Add reference', { exact: true }).waitFor()
    const add = page.getByRole('button', { name: 'Add knowledge entry', exact: true })
    await add.click()
    await page.getByRole('button', { name: 'Open KB editor full window' }).click()
    const editor = page.locator('#kb-content')
    await editor.click()
    const insertTable = page.getByRole('button', { name: 'Sisipkan tabel', exact: true })
    const insertPopup = page.getByRole('dialog', { name: 'Insert Table', exact: true })
    await insertTable.click()
    await assertInViewport(insertPopup)
    await insertTable.click()
    await insertPopup.waitFor({ state: 'hidden' })
    await insertTable.click()
    await assertInViewport(insertPopup)
    await page.getByRole('button', { name: /^Sisipkan tabel 2 baris . 2 kolom$/ }).click()
    const rows = editor.locator('table tr')
    const cells = editor.locator('table :is(th, td)')
    const menu = page.getByRole('menu', { name: 'Table actions' })
    assert.equal(await rows.count(), 2)
    assert.equal(await cells.count(), 4)

    await cells.first().click({ button: 'right' })
    await menu.getByRole('menuitem', { name: 'Insert', exact: true }).hover()
    await assertInViewport(menu.getByRole('menu', { name: 'Insert table parts' }))
    await menu.getByRole('menuitem', { name: 'Insert Rows Below', exact: true }).click()
    assert.equal(await rows.count(), 3)
    await menu.waitFor({ state: 'hidden' })

    await cells.last().dispatchEvent('contextmenu', {
      button: 2, bubbles: true, cancelable: true, clientX: width - 2, clientY: 898,
    })
    await menu.waitFor()
    await page.waitForFunction(() => {
      const menu = document.querySelector('[aria-label="Table actions"]')
      if (!menu) return false
      const rect = menu.getBoundingClientRect()
      return rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight
    })
    await page.keyboard.press('Escape')
    await menu.waitFor({ state: 'hidden' })
    assert.ok(await page.getByRole('button', { name: 'Exit KB editor full window' }).isVisible(),
      'Escape should dismiss the table menu without exiting the full-window editor')

    await cells.last().click({ button: 'right' })
    await menu.getByRole('menuitem', { name: 'Delete Cells...', exact: true }).hover()
    await assertInViewport(menu.getByRole('menu', { name: 'Delete table parts' }))
    await menu.getByRole('menuitem', { name: 'Delete Row', exact: true }).click()
    assert.equal(await rows.count(), 2)
    assert.equal(await cells.count(), 4)
    await menu.waitFor({ state: 'hidden' })
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Open KB editor full window' }).waitFor()
    const closeDrawer = page.getByRole('button', { name: 'Close add knowledge base reference' })
    await page.locator('div.fixed.translate-x-0').filter({ has: closeDrawer }).waitFor()
    await page.keyboard.press('Escape')
    await page.locator('div.fixed.translate-x-full.pointer-events-none').filter({ has: closeDrawer }).waitFor()
    console.log('Production KB editor: table operations and ordered Escape dismissal passed at ' + width + 'px')
  }
}

async function main() {
  const [distPath, playwrightModule = 'playwright'] = process.argv.slice(2)
  assert.ok(distPath, 'Usage: node scripts/check-release-build.cjs <dist> [playwright module path]')
  const { chromium } = require(playwrightModule)
  const dist = await fs.realpath(distPath)
  const index = await fs.readFile(path.join(dist, 'index.html'))
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname)
      if (req.method !== 'GET' || pathname.startsWith('/api/')) {
        res.writeHead(404).end()
        return
      }
      const file = path.resolve(dist, '.' + pathname)
      if (path.relative(dist, file).startsWith('..')) {
        res.writeHead(404).end()
        return
      }
      const ext = path.extname(file)
      res.setHeader('Content-Type', ext ? contentTypes[ext] ?? 'application/octet-stream' : 'text/html')
      res.end(ext ? await fs.readFile(file) : index)
    } catch {
      res.writeHead(404).end()
    }
  })
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve))
  const origin = 'http://127.0.0.1:' + server.address().port
  let browser
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true })
    const context = await browser.newContext({ serviceWorkers: 'block' })
    const user = { id: '01010101-0000-4000-8000-000000000001', name: 'Release Smoke', email: 'smoke@example.invalid', role: 'member' }
    const workspace = {
      id: '01010101-0000-4000-8000-000000000002',
      organization_id: '01010101-0000-4000-8000-000000000003',
      workspace_key: 'release-smoke', slug: 'release-smoke', name: 'Release Smoke Workspace',
      status_code: 'active', tenant_mode: 'standalone', version: 1,
    }
    const idea = {
      id: '01010101-0000-4000-8000-000000000006',
      workspace_id: workspace.id, title: 'Release Smoke Idea',
      description: 'Synthetic idea for the local release smoke.',
      status_code: 'draft', tags: [], artifacts: [], version: 1,
      created_date: '2026-01-01T00:00:00Z', created_by: user.id,
    }
    const errors = []
    const lazyFailures = []
    const ideaUpload = { active: false, pdfCalls: 0, jobCalls: 0, unexpectedWrites: 0 }
    const uploadExcerpt = 'Operators receive a local fixture alert.'
    const uploadMatch = {
      source_kind: 'idea', source_id: 'idea:' + idea.id, source_title: idea.title,
      capability: 'Fixture alert', relation: 'equivalent', same_initiative: true,
      uploaded_excerpt: uploadExcerpt, existing_excerpt: uploadExcerpt,
    }
    await context.routeWebSocket('**/*', (socket) => socket.close())
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (url.origin !== origin) return route.abort()
      if (!url.pathname.startsWith('/api/')) return route.continue()
      const method = route.request().method()
      if (ideaUpload.active && url.pathname.endsWith('/v1/agent/extract-idea-pdf') && method === 'POST') {
        ideaUpload.pdfCalls++
        if (ideaUpload.pdfCalls === 1) return route.fulfill({ status: 422, json: { detail: 'PDF_PARSE_FAILED' } })
        return route.fulfill({ json: { text: uploadExcerpt, coverage: { complete: true, warnings: [] } } })
      }
      if (ideaUpload.active && url.pathname.endsWith('/v1/agent/idea-extraction-jobs') && method === 'POST') {
        ideaUpload.jobCalls++
        return route.fulfill({ status: 202, json: { job_id: 'b02-smoke', status: 'queued', progress_percent: 0 } })
      }
      if (ideaUpload.active && url.pathname.endsWith('/v1/agent/idea-extraction-jobs/b02-smoke') && method === 'GET') {
        const candidate = (title, status, match) => ({
          title, category: 'Improvement', description: uploadExcerpt, confidence: 0.9, tags: [],
          source_excerpt: uploadExcerpt, capabilities: [{ name: 'Fixture alert', source_excerpt: uploadExcerpt, source_pages: [1] }],
          overlap_analysis: { status, matches: [match], checked_sources: 1, coverage_complete: true, warnings: [] },
        })
        return route.fulfill({ json: { status: 'completed', result: { warnings: [], candidates: [
          candidate('Fixture duplicate', 'possible_duplicate', uploadMatch),
          candidate('Fixture feature overlap', 'partial_overlap', { ...uploadMatch, relation: 'partial', same_initiative: false }),
        ] } } })
      }
      if (method !== 'GET') {
        if (ideaUpload.active && /\/(?:ideas|documents|attachments)(?:\/|$)/.test(url.pathname)) ideaUpload.unexpectedWrites++
        return route.fulfill({ status: 405, json: {} })
      }
      if (url.pathname.endsWith('/oauth2/session/status')) return route.fulfill({ json: { active: true } })
      if (url.pathname.endsWith('/oauth2/userinfo')) {
        return route.fulfill({ json: { sub: user.id, display_name: user.name, email: user.email, roles: ['member'] } })
      }
      const subject = url.pathname.match(/\/v1\/apps\/([^/]+)\/subjects\/([^/]+)\/(memberships|onboarding)$/)
      if (subject?.[2] === user.id && subject[3] === 'onboarding') {
        return route.fulfill({ json: { onboarding_status: 'active', active_membership_count: 1, active_workspace_id: workspace.id } })
      }
      if (subject?.[2] === user.id && subject[3] === 'memberships') {
        return route.fulfill({ json: { total: 1, items: [{
          id: '01010101-0000-4000-8000-000000000004', app_id: subject[1], subject_id: user.id,
          workspace_id: workspace.id, role_id: '01010101-0000-4000-8000-000000000005',
          role_code: 'member', status_code: 'active', version: 1,
        }] } })
      }
      if (url.pathname.endsWith('/v1/workspaces')) {
        return route.fulfill({ json: { items: [workspace], total: 1, page: 1, page_size: 100 } })
      }
      if (url.pathname === '/api/workspace-org/v1/slugs/' + workspace.slug + '/resolve') {
        return route.fulfill({ json: {
          workspace_id: workspace.id, org_id: workspace.organization_id, slug: workspace.slug,
          display_name: workspace.name, tenant_mode: workspace.tenant_mode,
        } })
      }
      if (url.pathname.endsWith('/api/tectona-kb/v1/entries')) {
        return route.fulfill({ json: { items: [], total: 0 } })
      }
      if (url.pathname === '/api/work/v1/work-items') {
        return route.fulfill({ json: { items: [], total: 0 } })
      }
      if (url.pathname.endsWith('/v1/ideas')) {
        return route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 200 } })
      }
      if (url.pathname.endsWith('/v1/ideas/' + idea.id)) return route.fulfill({ json: idea })
      return route.fulfill({ status: 503, json: { detail: 'Not used by offline release smoke' } })
    })
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('response', (response) => {
      if (response.url().startsWith(origin + '/assets/') && !response.ok()) lazyFailures.push(response.url())
    })
    await page.goto(origin + '/login')
    await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor()
    console.log('Production login rendered')

    await page.evaluate((user) => {
      const now = new Date()
      localStorage.setItem('tectona_session', JSON.stringify({
        user, token: '', cookieSession: true, loginAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 3600000).toISOString(),
      }))
      const usage = [12, 25, 40].map((inputTokens, index) => ({
        id: 'release-smoke-' + index, source: 'user', kind: 'used', event: 'QA completion',
        category: 'llm', trigger: 'qa', model: 'fixture-model', inputTokens, outputTokens: 5, totalTokens: inputTokens + 5,
        occurredAt: now.toISOString(),
      }))
      localStorage.setItem('tectona_token_telemetry:' + user.id, JSON.stringify(usage))
    }, user)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(origin + '/profile')
      await page.getByRole('button', { name: 'AI usage & spending' }).click()
      const heading = page.getByRole('heading', { name: 'AI Call Distribution', includeHidden: true })
      await heading.waitFor({ state: 'attached' })
      await heading.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      try {
        await heading.waitFor({ timeout: 10000 })
        await page.locator('.recharts-pie-sector path[d]').first().waitFor({ state: 'visible' })
        await page.locator('.recharts-bar-rectangle path[d]').first().waitFor({ state: 'visible' })
      } catch (error) {
        const layout = await heading.evaluate((element) => {
          const ancestors = []
          for (let node = element; node; node = node.parentElement) {
            const style = getComputedStyle(node)
            const { width, height } = node.getBoundingClientRect()
            ancestors.push([node.tagName, style.display, style.visibility, Math.round(width), Math.round(height)])
          }
          return ancestors
        })
        throw new Error('Chart unavailable at ' + width + 'px: ' + JSON.stringify({ errors, lazyFailures, layout }), { cause: error })
      }
      const surfaces = await page.locator('.recharts-surface').evaluateAll((elements) =>
        elements.map((element) => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })),
      )
      assert.ok(surfaces.filter(({ width, height }) => width > 0 && height > 0).length >= 2)
      assert.deepEqual(errors, [])
      assert.deepEqual(lazyFailures, [])
      console.log('Production Profile pie and bar chart rendered at ' + width + 'px')
    }

    await checkProfileRefresh(page, origin)

    const assets = await fs.readdir(path.join(dist, 'assets'))
    for (const name of [
      'WorkspaceManagementPage', 'IdeaBacklogManagementPage', 'DocumentKnowledgeManagementPage',
      'PlanningSchedulingPage', 'TaskWorkManagementPage',
    ]) {
      const chunks = assets.filter((file) => file.startsWith(name + '-') && file.endsWith('.js'))
      assert.equal(chunks.length, 1, 'Expected one production chunk for ' + name)
      const exported = await page.evaluate(async (url) => Object.keys(await import(url)), origin + '/assets/' + chunks[0])
      assert.ok(exported.includes(name), 'Expected the production page export for ' + name)
      console.log('Production lazy chunk imported: ' + name)
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(origin + '/w/' + workspace.slug + '/idea-backlog/' + idea.id)
    try {
      const title = page.getByRole('button', { name: 'Edit idea title', exact: true }).filter({ hasText: idea.title })
      await title.waitFor()
      assert.equal(await title.innerText(), idea.title)
    } catch (error) {
      const view = await page.locator('body').innerText().then((value) => value.slice(0, 1000))
      throw new Error('Idea Detail smoke failed: ' + JSON.stringify({ path: new URL(page.url()).pathname, errors, view }), { cause: error })
    }
    console.log('Production Idea Detail rendered with the local fixture')
    const openChat = page.getByRole('button', { name: 'Open chat', exact: true })
    const closeChat = page.getByRole('button', { name: 'Close chat panel', exact: true })
    await openChat.click()
    await page.getByRole('heading', { name: 'Chat', exact: true }).waitFor()
    await closeChat.click()
    await closeChat.waitFor({ state: 'hidden' })
    console.log('Production Chat panel opened and closed on the local Idea Detail fixture')

    await page.goto(origin + '/w/' + workspace.slug + '/task-work-management')
    await page.getByRole('button', { name: 'Work Directory', exact: true }).click()
    await page.getByRole('button', { name: 'New Work Item', exact: true }).click()
    const workItemTitle = page.locator('#work-item-title')
    await workItemTitle.fill('Unsaved local smoke item')
    const assignee = page.locator('#work-item-assignee')
    const assigneeOptions = page.getByRole('listbox', { name: 'Assignee options' })
    await assignee.click()
    await assigneeOptions.waitFor()
    await workItemTitle.press('Escape')
    await assigneeOptions.waitFor({ state: 'hidden' })
    const workItemHeading = page.getByRole('heading', { name: 'Add Work Item', exact: true })
    await page.locator('div.fixed.translate-x-full').filter({ has: workItemHeading }).waitFor({ state: 'attached' })
    assert.equal(await workItemTitle.inputValue(), '')
    await page.getByRole('button', { name: 'New Work Item', exact: true }).click()
    assert.equal(await assignee.getAttribute('aria-expanded'), 'false')
    await assignee.click()
    await assigneeOptions.waitFor()
    await workItemTitle.press('Escape')
    await assigneeOptions.waitFor({ state: 'hidden' })
    console.log('Production Work Item drawer cleared its title and reset the Assignee portal on close/reopen')

    await page.goto(origin + '/w/' + workspace.slug + '/idea-backlog')
    await page.getByRole('button', { name: 'Upload Idea', exact: true }).click()
    const uploadDrawer = page.locator('div.fixed').filter({ has: page.getByRole('heading', { name: 'Upload Idea', exact: true }) })
    const uploadInput = uploadDrawer.locator('input[type=file]')
    ideaUpload.active = true
    await uploadInput.setInputFiles({ name: 'broken-fixture.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\ninvalid') })
    await uploadDrawer.getByText('The PDF could not be parsed.', { exact: false }).waitFor()
    assert.equal(ideaUpload.jobCalls, 0)
    const { jsPDF } = require('jspdf')
    const uploadPdf = new jsPDF()
    uploadPdf.text(uploadExcerpt, 12, 12)
    await uploadInput.setInputFiles({ name: 'synthetic-fixture.pdf', mimeType: 'application/pdf', buffer: Buffer.from(uploadPdf.output('arraybuffer')) })
    await uploadDrawer.getByText('Possible existing idea: review before creating', { exact: true }).waitFor()
    await uploadDrawer.getByText('Feature or capability overlap found', { exact: true }).waitFor()
    await uploadDrawer.getByRole('button', { name: 'Create 1 accepted idea', exact: true }).waitFor()
    await uploadDrawer.getByRole('button', { name: 'Close upload idea', exact: true }).click()
    assert.equal(ideaUpload.pdfCalls, 2)
    assert.equal(ideaUpload.jobCalls, 1)
    assert.equal(ideaUpload.unexpectedWrites, 0)
    ideaUpload.active = false
    console.log('Production Upload Idea malformed-PDF retry and mixed overlap review passed with synthetic fixtures')

    try {
      await checkEditor(page, origin)
    } catch (error) {
      const view = await page.locator('body').innerText().then((value) => value.slice(0, 1400))
      throw new Error('KB editor smoke failed: ' + JSON.stringify({ path: new URL(page.url()).pathname, errors, view }), { cause: error })
    }
    assert.deepEqual(errors, [])
    assert.deepEqual(lazyFailures, [])
  } finally {
    try {
      await browser?.close()
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
