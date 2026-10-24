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
  Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
  let reduced = false
  const motionListeners = new Set()
  window.matchMedia = query => ({ get matches() { return query.includes('reduced-motion') && reduced }, addEventListener: (_, fn) => motionListeners.add(fn), removeEventListener: (_, fn) => motionListeners.delete(fn) })
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
  const job = { job_id: 'one', brainstorm_messages: [{ role: 'assistant', summary: 'Chat for Collection.\n\nKeep audit logs.', text: 'Summary', ai_advice: 'Consider an API.' }], intake_checklist: [
    { id: 'goal', prompt: 'Project goal', status: 'answered', evidence_status: 'confirmed', evidence_text: 'Assist Collection' },
    { id: 'kpi', prompt: 'Success target', status: 'answered', evidence_status: 'inferred', evidence_text: '90% accuracy' },
    { id: 'asis', prompt: 'Current process', evidence_status: 'missing', evidence_text: '' },
    { id: 'legacy', prompt: 'Unknown confirmation', status: 'answered', evidence_text: 'Not confirmed' },
  ], brainstorm_remaining_gaps: ['Current process', 'Current process'] }
  const model = build(job, 28)
  assert.equal(model.confirmed, 1)
  assert.equal(model.total, 4)
  assert.equal(model.sections.find(s => s.id === 'evidence:kpi').kind, 'pending')
  assert.equal(model.sections.find(s => s.id === 'evidence:legacy').kind, 'pending')
  assert.equal(model.sections.find(s => s.id === 'gaps').text, '- Current process')
  assert.equal(model.sections.find(s => s.id === 'advice').kind, 'suggestion')
  assert.equal(build({ ...job, brainstorm_messages: [...job.brainstorm_messages, { role: 'assistant', text: 'Next question' }] }, 10).sections.some(s => s.id === 'understanding'), false, 'do not carry obsolete summaries into newer replies')
  assert.equal(build(null, NaN).confidence, 0)
  for (const [before, after] of [['Alpha Collection Omega', 'Alpha Credit Omega'], ['hello', ''], ['', 'new'], ['A😀B', 'A🧠B']]) {
    const change = diff(before, after)
    assert.equal(change.prefix + change.removed.join('') + change.suffix, before)
    assert.equal(change.prefix + change.added.join('') + change.suffix, after)
  }
  const root = createRoot(document.getElementById('root'))
  let props = { job, confidence: 28, busy: false }
  const render = async patch => { props = { ...props, ...patch }; await act(async () => root.render(React.createElement(Component, props))) }
  const wait = async ms => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)) })
  const body = () => document.querySelector('[data-summary-section="understanding"] [aria-hidden="true"]:nth-child(2)')?.textContent
  await render({})
  await wait(1100)
  assert.equal(body(), 'Chat for Collection.\nKeep audit logs.')
  const next = { ...job, brainstorm_messages: [{ role: 'assistant', summary: 'Chat for Credit.\n\nKeep audit logs.', text: 'Summary' }] }
  await render({ job: next, busy: true, confidence: 34 })
  await wait(100)
  assert.match(body(), /Collection/)
  assert.match(document.querySelector('[role="status"]').textContent, /Updating/)
  await render({ busy: false, error: 'Network error' })
  assert.match(body(), /Collection/)
  assert.match(document.querySelector('[role="status"]').textContent, /Update failed/)
  await render({ error: '' })
  assert.equal(document.querySelector('[data-summary-section="understanding"] [data-summary-phase]').dataset.summaryPhase, 'deleting')
  await wait(1100)
  assert.match(body(), /Credit/)
  assert.doesNotMatch(body(), /Collection/)
  assert.match(body(), /Keep audit logs/)
  assert.match(document.body.textContent, /Confidence 34%/)
  await render({ job: { ...next, brainstorm_messages: [{ role: 'assistant', text: 'Summary', summary: 'First replacement' }] } })
  await wait(40)
  await render({ job: { ...next, brainstorm_messages: [{ role: 'assistant', text: 'Summary', summary: 'Latest replacement' }] } })
  await wait(1100)
  assert.equal(body(), 'Latest replacement', 'rapid updates must cancel older animation timers')
  reduced = true
  await act(async () => motionListeners.forEach(fn => fn()))
  await render({ job: { ...next, brainstorm_messages: [{ role: 'assistant', text: 'Summary', summary: 'No motion' }] } })
  assert.equal(body(), 'No motion')
  assert.equal(document.querySelector('[data-summary-section="understanding"] [data-summary-phase]').dataset.summaryPhase, 'idle')
  const open = document.querySelector('button[aria-expanded="false"][aria-label="Open Live AI Summary"]')
  open.focus()
  await act(async () => open.click())
  assert.equal(document.querySelectorAll('[role="dialog"]').length, 1)
  assert.equal(document.querySelectorAll('#brainstorm-live-summary-title').length, 1)
  await act(async () => window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(document.querySelector('[role="dialog"]'), null)
  assert.equal(document.activeElement, open)
  await act(async () => root.unmount())
  console.log('PASS live summary: canonical evidence, no guessed confirmation, deduped gaps, partial delete/type, rapid updates, stale/error guards, reduced motion, drawer Escape and focus restoration')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
