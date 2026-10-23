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
  const built = await esbuild.build({
    entryPoints: ['src/modules/project-management/components/BrainstormConfirmationOptions.tsx'],
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic',
    alias: { '@': path.resolve('src') },
  })
  const loaded = new Module(path.resolve('confirmation-test.cjs'), module)
  loaded.filename = path.resolve('confirmation-test.cjs')
  loaded.paths = module.paths
  loaded._compile(built.outputFiles[0].text, loaded.filename)
  const Component = loaded.exports.BrainstormConfirmationOptions
  const root = createRoot(document.getElementById('root'))
  const sent = []
  const props = { choices: ['Gunakan tujuan Credit ini', 'Ubah target Credit'], actions: ['confirm', 'adjust'], explanations: ['Alur Credit sesuai; integrasi belum dikonfirmasi.', 'Sumber kebijakan Credit dapat dikoreksi.'], indonesian: true, onSubmit: async text => { sent.push(text) } }
  await act(async () => root.render(React.createElement(Component, props)))
  const radios = document.querySelectorAll('input[type="radio"]')
  const submit = () => document.querySelector('button[type="submit"]')
  assert.equal(radios.length, 2)
  assert.equal(submit().disabled, true)
  assert.match(document.body.textContent, /Sumber kebijakan Credit/)
  await act(async () => radios[1].click())
  assert.equal(sent.length, 0)
  assert.equal(submit().disabled, true)
  const textarea = document.querySelector('textarea')
  assert.ok(textarea)
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(textarea, 'Eskalasi melalui tiket')
    textarea.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  })
  assert.equal(submit().disabled, false)
  await act(async () => submit().click())
  assert.deepEqual(sent, ['Ubah target Credit: Eskalasi melalui tiket'])
  await act(async () => radios[0].click())
  assert.equal(radios[1].checked, false)
  assert.equal(document.querySelector('textarea'), null)
  await act(async () => submit().click())
  assert.equal(sent[1], 'Gunakan tujuan Credit ini')
  await act(async () => root.render(React.createElement(Component, { ...props, disabled: true })))
  assert.equal(submit().disabled, true)
  const suggestionProps = {
    ...props, choices: ['Gunakan peran MoM', 'Sesuaikan reviewer', 'Tentukan akses nanti'],
    actions: ['choose', 'adjust', 'defer'],
    explanations: ['Gunakan tanggung jawab rapat.', 'Ubah siapa yang mengesahkan MoM.', 'Simpan sebagai keputusan terbuka.'],
  }
  await act(async () => root.render(React.createElement(Component, { ...suggestionProps, key: 'suggestion' })))
  assert.equal(document.querySelectorAll('input[type="radio"]').length, 3)
  assert.equal(submit().disabled, true)
  assert.match(document.body.textContent, /keputusan terbuka/)
  await act(async () => document.querySelectorAll('input[type="radio"]')[2].click())
  assert.equal(document.querySelector('textarea'), null)
  await act(async () => submit().click())
  assert.equal(sent.at(-1), 'Tentukan akses nanti')
  await act(async () => document.querySelectorAll('input[type="radio"]')[1].click())
  assert.ok(document.querySelector('textarea'))
  assert.equal(submit().disabled, true)
  await act(async () => root.render(React.createElement(Component, { ...suggestionProps, key: 'revised' })))
  assert.equal(submit().disabled, true)
  assert.equal(document.querySelector('input:checked'), null)
  await act(async () => root.unmount())
  dom.window.close()
  console.log('Confirmation UI checks passed: selection, explanations, correction, send, disabled state')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
