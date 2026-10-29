const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const { JSDOM } = require('jsdom')
const esbuild = require('esbuild')

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' })
  global.window = dom.window
  global.document = dom.window.document
  global.HTMLElement = dom.window.HTMLElement
  Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true })
  global.IS_REACT_ACT_ENVIRONMENT = true
  const React = require('react')
  const { act } = React
  const { createRoot } = require('react-dom/client')
  const built = await esbuild.build({ entryPoints: ['src/modules/project-management/components/BrainstormPainPointOptions.tsx'],
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic', alias: { '@': path.resolve('src') } })
  const loaded = new Module(path.resolve('pain-points-test.cjs'), module)
  loaded.filename = path.resolve('pain-points-test.cjs')
  loaded.paths = module.paths
  loaded._compile(built.outputFiles[0].text, loaded.filename)
  const Component = loaded.exports.BrainstormPainPointOptions
  const root = createRoot(document.getElementById('root'))
  const sent = []
  const props = { indonesian: true, onSubmit: async text => sent.push(text), options: [
    { action: 'choose', label: 'Keputusan terlewat', explanation: 'Detail hilang.', value: 'A' },
    { action: 'choose', label: 'Distribusi terlambat', explanation: 'Peserta menunggu.', value: 'B' },
    { action: 'defer', label: 'Hanya pencatatan manual', explanation: 'Tanpa tambahan.', value: '' },
  ] }
  await act(async () => root.render(React.createElement(Component, props)))
  const boxes = () => document.querySelectorAll('input[type="checkbox"]')
  const submit = () => document.querySelector('button[type="submit"]')
  assert.equal(submit().disabled, true)
  await act(async () => boxes()[0].click())
  await act(async () => boxes()[1].click())
  assert.equal(boxes()[0].checked, true)
  assert.equal(boxes()[1].checked, true)
  assert.equal(sent.length, 0)
  await act(async () => submit().click())
  assert.deepEqual(JSON.parse(sent[0].slice('Pain point selection: '.length)).indexes, [0, 1])
  await act(async () => boxes()[2].click())
  assert.equal(boxes()[0].checked, false)
  assert.equal(boxes()[1].checked, false)
  await act(async () => boxes()[0].click())
  assert.equal(boxes()[2].checked, false)
  const textarea = document.querySelector('textarea')
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(textarea, 'Format tidak konsisten')
    textarea.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  })
  await act(async () => submit().click())
  assert.equal(JSON.parse(sent.at(-1).slice('Pain point selection: '.length)).custom, 'Format tidak konsisten')
  await act(async () => root.render(React.createElement(Component, { ...props, disabled: true })))
  assert.equal(submit().disabled, true)
  await act(async () => root.unmount())
  dom.window.close()
  console.log('Pain point UI checks passed: multiple selection, exclusive baseline, custom input, explicit confirmation, disabled state')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
