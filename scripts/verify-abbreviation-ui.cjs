/* Run against the local Vite server; API responses are isolated test fixtures. */
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')

async function main() {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' })
  const output = path.join(process.env.TEMP || '.', 'tectona-abbreviation-ui')
  fs.mkdirSync(output, { recursive: true })
  const errors = []
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport })
      const page = await context.newPage()
      page.on('pageerror', (error) => { errors.push(error.message); console.error('Page error:', error.message) })
      page.on('console', (message) => { if (message.type() === 'error') console.error('Browser:', message.text()) })
      page.on('requestfailed', (request) => console.error('Failed request:', request.url()))
      await page.route('**/__abbreviation_check__', (route) => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><link rel="stylesheet" href="/src/index.css"></head><body><div id="root" style="max-width:460px;margin:20px auto;padding:8px"></div><script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
        const { default: React } = await import('/node_modules/.vite/deps/react.js');
        const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
        const { AbbreviationTableEditor } = await import('/src/modules/document-knowledge-management/components/AbbreviationTableEditor.tsx');
        function Harness(){const [model,setModel]=React.useState({specId:'singkatan',intro:'Operational abbreviations',rows:[]});window.testModel=model;return React.createElement(AbbreviationTableEditor,{model,onChange:setModel,workspaceId:'w1',entryId:'entry1'})}
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
        </script></body></html>` }))
      const state = { scan_id: 'fixture', workspace_id: 'w1', scope: 'workspace', status: 'running', phase: 'scanning', label: 'Scanning 1/2 - BRD Finance.docx', percent: 0, processed: 0, total: 2, skipped: [], warnings: [], candidates: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(), usage: { total_tokens: 0 } }
      await page.route('**/v1/agent/abbreviation-scans**', async (route) => {
        const url = route.request().url()
        if (url.endsWith('/advance')) {
          state.processed++
          state.percent = state.processed * 50
          if (state.processed === 2) {
            state.status = 'completed'; state.label = 'Scan completed. Review suggestions.'
            state.candidates = [{ abbr: 'CRM', expansion: 'Customer Relationship Management', domain: 'Customer', not_confused_with: '', status: 'supported', evidence: [{ kind: 'Document', id: 'd1', workspace_id: 'w1', title: 'BRD Finance.docx', quote: 'Customer Relationship Management (CRM)' }] }, { abbr: 'XYZ', expansion: '', domain: '', not_confused_with: '', status: 'needs_review', evidence: [{ kind: 'KB', id: 'k1', title: 'Operations', quote: 'Use XYZ for reconciliation' }] }]
          }
          await new Promise((r) => setTimeout(r, 200))
        }
        if (url.endsWith('/pause') && state.status !== 'completed') state.status = 'paused'
        await route.fulfill({ json: state })
      })
      await page.goto('http://localhost:9411/__abbreviation_check__')
      for (const control of [page.getByRole('textbox', { name: 'Search abbreviations', exact: true }), page.getByRole('button', { name: 'Scan suggestions', exact: true }), page.getByRole('button', { name: 'Add abbreviation', exact: true })]) {
        assert.equal((await control.boundingBox()).height, 40, 'Drawer controls must be 40px high')
      }
      const styles = await page.getByRole('button', { name: 'Add abbreviation', exact: true }).evaluate((button) => {
        const css = getComputedStyle(button)
        return { background: css.backgroundColor, image: css.backgroundImage, shadow: css.getPropertyValue('--tw-shadow').trim() }
      })
      assert.notEqual(styles.background, 'rgba(0, 0, 0, 0)', 'Primary action must have a theme color')
      assert.equal(styles.image, 'none', 'Primary action must not have a gradient')
      assert.equal(styles.shadow, '0 0 #0000', 'Primary action must not have glow')
      const table = page.getByRole('region', { name: 'Abbreviation table', exact: true })
      await page.mouse.move(0, 0)
      assert.equal(await table.evaluate((node) => getComputedStyle(node).scrollbarWidth), 'none', 'Table scrollbar must hide outside the table')
      await table.hover()
      assert.equal(await table.evaluate((node) => getComputedStyle(node).scrollbarWidth), 'thin', 'Table scrollbar must show on hover')
      await page.mouse.move(0, 0)
      await table.focus()
      assert.equal(await table.evaluate((node) => getComputedStyle(node).scrollbarWidth), 'thin', 'Keyboard focus must expose the scrollbar')
      await page.getByRole('textbox', { name: 'Search abbreviations', exact: true }).focus()
      assert.equal(await table.evaluate((node) => getComputedStyle(node).scrollbarWidth), 'none', 'Scrollbar must hide after focus leaves')
      const drawerPrimary = await page.evaluate(() => {
        const reference = document.createElement('button')
        reference.className = 'bg-primary'
        document.body.append(reference)
        const color = getComputedStyle(reference).backgroundColor
        reference.remove()
        return color
      })
      assert.notEqual(styles.background, drawerPrimary, 'Editor action must differ from drawer primary color')
      await page.getByRole('button', { name: 'Add abbreviation', exact: true }).click()
      await page.getByRole('textbox', { name: 'Abbreviation', exact: true }).fill('LOS')
      await page.getByRole('textbox', { name: 'Expanded form', exact: true }).fill('Loan Origination System')
      await page.getByRole('button', { name: 'Save & close', exact: true }).click()
      assert.equal(await page.getByRole('dialog').count(), 0, 'Save & close must close the dialog')
      assert.equal(await page.evaluate(() => window.testModel.rows.length), 1)
      await page.getByRole('button', { name: 'Edit LOS', exact: true }).click()
      await page.getByRole('textbox', { name: 'Domain', exact: true }).fill('Finance')
      await page.getByRole('button', { name: 'Save & close', exact: true }).click()
      await page.getByRole('button', { name: 'Scan suggestions', exact: true }).click()
      const start = page.getByRole('button', { name: 'Start scan', exact: true })
      assert.notEqual(await start.evaluate((node) => getComputedStyle(node).backgroundColor), drawerPrimary, 'Scan control must differ from primary action')
      const popupScroll = page.locator('.abbreviation-scan-scroll')
      await page.mouse.move(0, 0)
      const hiddenScrollbar = await popupScroll.evaluate((node) => getComputedStyle(node).scrollbarColor)
      await page.getByRole('button', { name: 'Close', exact: true }).hover()
      assert.notEqual(await popupScroll.evaluate((node) => getComputedStyle(node).scrollbarColor), hiddenScrollbar, 'Scrollbar must appear anywhere inside popup')
      await page.getByRole('textbox', { name: 'Search suggestions', exact: true }).focus()
      await page.mouse.move(0, 0)
      assert.equal(await popupScroll.evaluate((node) => getComputedStyle(node).scrollbarColor), hiddenScrollbar, 'Scrollbar must hide outside popup even with input focus')
      await page.getByRole('button', { name: 'Start scan', exact: true }).click()
      await page.getByRole('checkbox', { name: 'Select CRM', exact: true }).waitFor()
      assert.equal(await page.getByRole('checkbox', { name: 'Select XYZ', exact: true }).isDisabled(), true)
      await page.getByRole('checkbox', { name: 'Select CRM', exact: true }).check()
      await page.screenshot({ path: path.join(output, `review-${viewport.width}.png`), fullPage: true })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Page must not overflow horizontally')
      await page.getByRole('button', { name: 'Add selected', exact: true }).click()
      await page.waitForFunction(() => window.testModel.rows.length === 2)
      assert.equal(await page.evaluate(() => window.testModel.rows.length), 2)
      await page.screenshot({ path: path.join(output, `table-${viewport.width}.png`), fullPage: true })
      await context.close()
    }
    assert.deepEqual(errors, [])
    console.log(`Desktop/mobile UI passed. Screenshots: ${output}`)
  } finally { await browser.close() }
}
main().catch((err) => { console.error(err); process.exitCode = 1 })
