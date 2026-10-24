const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')
const { JSDOM } = require('jsdom')

async function main() {
  const dom = new JSDOM('<button id="outside">Chat</button><div id="root"></div>', { url: 'http://localhost' })
  global.window = dom.window
  global.document = dom.window.document
  global.HTMLElement = dom.window.HTMLElement
  global.requestAnimationFrame = fn => setTimeout(fn, 1)
  global.cancelAnimationFrame = id => clearTimeout(id)
  Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
  let reduced = false
  let wide = true
  const motionListeners = new Set()
  window.matchMedia = query => ({ get matches() { return query.includes('reduced-motion') ? reduced : wide }, addEventListener: (_, fn) => motionListeners.add(fn), removeEventListener: (_, fn) => motionListeners.delete(fn) })
  global.IS_REACT_ACT_ENVIRONMENT = true
  const React = require('react'), { act } = React, { createRoot } = require('react-dom/client')
  const built = await esbuild.build({
    stdin: { contents: "export * from './src/modules/project-management/components/BrainstormLiveSummaryPanel'; export * from './src/modules/project-management/lib/brainstormLiveSummary'", resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
    external: ['react', 'react-dom', 'react/jsx-runtime'], alias: { '@': path.resolve('src') },
    plugins: [{ name: 'non-prose-visuals', setup(build) {
      build.onResolve({ filter: /\/Assistant(?:Mermaid|Chart)Block$/ }, args => ({ path: args.path, namespace: 'visual' }))
      build.onLoad({ filter: /.*/, namespace: 'visual' }, () => ({ contents: 'export const AssistantMermaidBlock = () => null; export const AssistantChartBlock = () => null;', loader: 'js' }))
    } }],
  })
  const loaded = new Module(path.resolve('live-summary-test.cjs'), module)
  loaded.filename = path.resolve('live-summary-test.cjs'); loaded.paths = module.paths
  loaded._compile(built.outputFiles[0].text, loaded.filename)
  const { BrainstormLiveSummaryPanel: Component, buildBrainstormLiveSummary: build, summaryTextChange: diff } = loaded.exports
  const live = text => ({ status: 'ready', source_revision: 'r1', source_fingerprint: 'evidence-v1', text, sections: [{ key: 'objective', title: 'Tujuan', body: text, evidence_ids: ['intake:goal'] }] })
  const job = { job_id: 'one', brainstorm_messages: [{ role: 'assistant', summary: 'Chat for Collection.\n\nKeep audit logs.', text: 'Summary', ai_advice: 'Consider an API.' }], intake_checklist: [
    { id: 'goal', prompt: 'Project goal', status: 'answered', evidence_status: 'confirmed', evidence_text: 'Assist Collection' },
    { id: 'kpi', prompt: 'Success target', status: 'answered', evidence_status: 'inferred', evidence_text: '90% accuracy' },
    { id: 'asis', prompt: 'Current process', evidence_status: 'missing', evidence_text: '' },
    { id: 'legacy', prompt: 'Unknown confirmation', status: 'answered', evidence_text: 'Not confirmed' },
  ], brainstorm_remaining_gaps: ['Current process', 'Current process'], revision: 'r1', live_summary: live('Chat for Collection.\n\nKeep audit logs.') }
  const model = build(job)
  assert.deepEqual(model.sections.map(s => s.id), ['objective'], 'use canonical proposal sections')
  assert.equal(model.sections[0].title, 'Tujuan')
  const greeting = { ...job, live_summary: null, brainstorm_messages: [{ role: 'assistant', summary: 'This is only a chat recap.', text: 'Hello. Describe your project.', ai_advice: 'Consider an API.' }] }
  assert.deepEqual(build(greeting).sections, [], 'gaps, checklist and advice alone must not trigger a summary')
  assert.deepEqual(build(null).sections, [])
  assert.equal(build({ ...job, revision: 'changed' }).sections.length, 0, 'reject stale summaries after edits')
  assert.equal(build({ ...job, brainstorm_messages: [{ role: 'assistant', summary: 'Different chat recap' }] }).sections[0].text, job.live_summary.sections[0].body, 'never copy the per-turn recap')
  for (const [before, after] of [['Alpha Collection Omega', 'Alpha Credit Omega'], ['hello', ''], ['', 'new'], ['A😀B', 'A🧠B']]) {
    const change = diff(before, after)
    assert.equal(change.prefix + change.removed.join('') + change.suffix, before)
    assert.equal(change.prefix + change.added.join('') + change.suffix, after)
  }
  const root = createRoot(document.getElementById('root'))
  let props = { job: greeting, busy: false }
  const render = async patch => { props = { ...props, ...patch }; await act(async () => root.render(React.createElement(Component, props))) }
  const wait = async ms => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)) })
  const body = () => document.querySelector('[data-summary-section="objective"] [aria-hidden="true"]:nth-child(2)')?.textContent
  await render({})
  assert.equal(document.querySelector('aside'), null)
  assert.equal(document.querySelector('[aria-label="Open Live AI Summary"]'), null)
  await render({ job, busy: true })
  assert.equal(document.querySelector('aside'), null, 'pending replies must not open the panel')
  await render({ busy: false, error: 'Failed request' })
  assert.equal(document.querySelector('aside'), null, 'failed first responses must not open the panel')
  await render({ error: '' })
  assert.equal(document.querySelector('aside').dataset.summaryEntered, 'false')
  await wait(350)
  assert.equal(document.querySelector('aside').dataset.summaryEntered, 'true')
  await wait(1100)
  assert.equal(body(), 'Chat for Collection.\nKeep audit logs.')
  assert.doesNotMatch(document.body.textContent, /Open points|Confidence|Confirmed evidence|Success target|Consider an API/)
  assert.equal(document.querySelector('[role="status"]'), null, 'no permanent status row')
  const next = { ...job, live_summary: live('Chat for Credit.\n\nKeep audit logs.') }
  await render({ job: next, busy: true })
  await wait(100)
  assert.match(body(), /Collection/)
  assert.match(document.querySelector('[role="status"]').textContent, /Updating/)
  await render({ busy: false, error: 'Network error' })
  assert.match(body(), /Collection/)
  assert.match(document.querySelector('[role="status"]').textContent, /Update failed/)
  await render({ error: '' })
  assert.equal(document.querySelector('[data-summary-section="objective"] [data-summary-phase]').dataset.summaryPhase, 'deleting')
  await wait(1100)
  assert.match(body(), /Credit/)
  assert.doesNotMatch(body(), /Collection/)
  assert.match(body(), /Keep audit logs/)
  await act(async () => document.querySelector('[aria-label="Collapse summary"]').click())
  await render({ job: { ...next, live_summary: live('Updated while collapsed.') } })
  assert.ok(document.querySelector('aside button[aria-label="Open Live AI Summary"]'))
  assert.equal(document.querySelector('aside [aria-label="Summary updated"]')?.getAttribute('role'), 'status')
  assert.equal(document.querySelector('[aria-label="Collapse summary"]').closest('div.flex-col').classList.contains('hidden'), true, 'updates do not reopen a collapsed panel')
  await act(async () => document.querySelector('aside button[aria-label="Open Live AI Summary"]').click())
  assert.equal(document.querySelector('aside [aria-label="Summary updated"]'), null)
  await render({ job: { ...next, live_summary: live('First replacement') } })
  await wait(40)
  await render({ job: { ...next, live_summary: live('Latest replacement') } })
  await wait(1100)
  assert.equal(body(), 'Latest replacement', 'rapid updates must cancel older animation timers')
  reduced = true
  await act(async () => motionListeners.forEach(fn => fn()))
  await render({ job: { ...next, live_summary: live('No motion') } })
  assert.equal(body(), 'No motion')
  assert.equal(document.querySelector('[data-summary-section="objective"] [data-summary-phase]').dataset.summaryPhase, 'idle')
  await render({ job: { ...next, live_summary: { ...live('Unavailable'), status: 'unavailable' } } })
  assert.equal(body(), 'No motion', 'failed synthesis retains the previous proposal, never substitutes a chat recap')
  await render({ job: { ...next, live_summary: live('No motion') } })
  wide = false
  await act(async () => motionListeners.forEach(fn => fn()))
  const open = document.querySelector('button[aria-expanded="false"][aria-label="Open Live AI Summary"]')
  open.focus()
  await act(async () => open.click())
  assert.equal(document.querySelectorAll('[role="dialog"]').length, 1)
  assert.equal(document.querySelectorAll('#brainstorm-live-summary-title').length, 1)
  await act(async () => window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(document.querySelector('[role="dialog"]'), null)
  assert.equal(document.activeElement, open)
  await render({ job: greeting })
  await wait(10)
  assert.equal(document.querySelector('aside'), null, 'a successful response with no summary cannot leave stale narrative on screen')
  assert.equal(document.querySelector('[aria-label="Open Live AI Summary"]'), null)
  await act(async () => root.unmount())
  console.log('PASS summary-only panel: hidden before data, success-only entrance, layout-before-typing, no metrics/checklist, collapse preference and update marker, partial delete/type, stale/error guards, reduced motion, drawer and focus')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
