const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')
const { JSDOM } = require('jsdom')

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' })
  global.window = dom.window
  global.document = dom.window.document
  global.HTMLElement = dom.window.HTMLElement
  Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
  global.IS_REACT_ACT_ENVIRONMENT = true
  const React = require('react'), { act } = React, { createRoot } = require('react-dom/client')
  const built = await esbuild.build({
    stdin: { contents: "export * from './src/modules/project-management/components/BrainstormSummaryDiagrams'; export * from './src/modules/project-management/components/BrainstormSummaryBox'; export * from './src/modules/project-management/lib/brainstormSummaryDiagrams'", resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
    external: ['react', 'react-dom', 'react/jsx-runtime'], alias: { '@': path.resolve('src') },
    plugins: [{ name: 'diagram-transport', setup(build) {
      build.onResolve({ filter: /\/Assistant(?:Mermaid|Chart)Block$/ }, args => ({ path: args.path, namespace: 'visual' }))
      build.onLoad({ filter: /.*/, namespace: 'visual' }, () => ({ contents: "import React from 'react';export const AssistantMermaidBlock=({source,notation,compact})=>React.createElement('div',{'data-source':source,'data-notation':notation,'data-compact':compact});export const AssistantChartBlock=()=>null", loader: 'js' }))
    } }],
  })
  const loaded = new Module(path.resolve('summary-diagrams-test.cjs'), module)
  loaded.filename = path.resolve('summary-diagrams-test.cjs'); loaded.paths = module.paths
  loaded._compile(built.outputFiles[0].text, loaded.filename)
  const { buildSummaryDiagramAttachments: build, BrainstormSummaryDiagrams: Diagrams, BrainstormSummaryBox: Box } = loaded.exports
  const source = '@startuml\nstart\n:PIC: write MoM;\nstop\n@enduml'
  const draw = s => ({ role: 'assistant', text: 'AS-IS — current process:\n```plantuml\n' + s + '\n```' })
  const ack = { role: 'assistant', text: 'Siap, flow AS-IS sudah terkonfirmasi.' }
  const recap = { role: 'assistant', text: 'Alur AS-IS sudah tepat.', summary: 'Alur AS-IS: menulis MoM.' }
  const messages = [draw(source), { role: 'user', text: 'sudah tepat' }, ack, recap, recap]
  const attachments = build(messages)
  assert.deepEqual(attachments.slice(0, 2), [[], []])
  assert.equal(attachments[2][0].presentation, 'preview')
  assert.equal(attachments[3][0].presentation, 'link')
  assert.equal(attachments[4][0].presentation, 'link')
  assert.equal(attachments[3][0].source, source)
  assert.deepEqual(build([recap, ...messages])[0], [], 'no future diagram leaks into old summaries')
  assert.deepEqual(build([...messages, draw(source + '\nnew'), recap]).at(-1), [], 'pending redraw has no confirmed attachment')
  assert.deepEqual(build([draw(source), recap]).at(-1), [], 'no confirmation means no link')
  assert.deepEqual(build(messages.slice(0, 2)).flat(), [], 'editing away confirmation removes the attachment')
  const future = { role: 'assistant', text: 'TO-BE — expected process:\n```plantuml\n' + source.replace('write', 'generate') + '\n```' }
  const both = build([...messages, future, { role: 'assistant', text: 'Great, the TO-BE flow is confirmed.' },
    { role: 'assistant', text: 'Summary', summary: 'Compare AS-IS and TO-BE.' }])
  assert.equal(both.at(-2)[0].lane, 'to_be')
  assert.equal(both.at(-2)[0].presentation, 'preview')
  assert.deepEqual(both.at(-1).map(d => [d.lane, d.presentation]), [['as_is', 'link'], ['to_be', 'link']])
  const root = createRoot(document.getElementById('root'))
  const render = async (diagrams, indonesian = true) => act(async () => root.render(
    React.createElement(Box, { text: '**MoM** masih manual.', indonesian }, React.createElement(Diagrams, { diagrams, indonesian })),
  ))
  await render(attachments[2])
  assert.equal(document.querySelector('[data-source]').dataset.source, source)
  assert.equal(document.querySelector('[data-source]').dataset.notation, 'bpmn')
  assert.ok(document.querySelector('strong'))
  await render(attachments[3])
  assert.equal(document.querySelector('[data-source]'), null, 'repeated recap is collapsed by default')
  const button = document.querySelector('button')
  assert.match(button.textContent, /Lihat diagram AS-IS/)
  assert.equal(button.getAttribute('aria-expanded'), 'false')
  await act(async () => button.click())
  assert.equal(button.getAttribute('aria-expanded'), 'true')
  assert.equal(document.querySelector('[data-source]').dataset.source, source)
  assert.ok(document.getElementById(button.getAttribute('aria-controls')))
  await act(async () => button.click())
  assert.equal(document.querySelector('[data-source]'), null)
  await render(attachments[3], false)
  assert.match(document.querySelector('button').textContent, /View AS-IS diagram/)
  await act(async () => root.unmount())
  console.log('PASS confirmed diagram history, preview once, repeated recap links, pending/edit guards, exact source, Markdown, localized labels and accessible expand/collapse')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
