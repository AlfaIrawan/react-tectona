const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

async function main() {
  const built = await esbuild.build({ entryPoints: ['src/modules/project-management/components/BrainstormCatalogComparison.tsx'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic' })
  const loaded = new Module(path.resolve('catalog-test.cjs'), module)
  loaded.filename = path.resolve('catalog-test.cjs')
  loaded.paths = module.paths
  loaded._compile(built.outputFiles[0].text, loaded.filename)
  const Component = loaded.exports.BrainstormCatalogComparison
  const matches = [
    { application: 'MeetingHub', documented_function: 'Meeting recordings', proposed_fit: 'Potential recording source' },
    { application: 'MailHub', documented_function: 'Document delivery', proposed_fit: 'Potential distribution channel' },
  ]
  const render = props => renderToStaticMarkup(React.createElement(Component, { indonesian: true, ...props }))
  const current = render({ status: 'matched', mode: 'current', matches })
  assert.match(current, /<table/)
  assert.match(current, /MeetingHub/)
  assert.match(current, /bukan bukti pemakaian saat ini/)
  assert.match(current, /Hipotesis kecocokan/)
  const proposed = render({ status: 'matched', mode: 'proposed', matches: matches.slice(0, 1) })
  assert.doesNotMatch(proposed, /<table/)
  assert.match(proposed, /masih perlu divalidasi/)
  assert.match(render({ status: 'no_match' }), /Belum ditemukan kandidat relevan/)
  assert.match(render({ status: 'unavailable' }), /belum dapat dibandingkan/)
  assert.equal(render({}), '')
  const escaped = render({ status: 'matched', matches: [{ ...matches[0], application: '<script>bad()</script>' }] })
  assert.doesNotMatch(escaped, /<script>/)
  const graphBuilt = await esbuild.build({ entryPoints: ['src/modules/project-management/lib/bpmnPlantUml.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external' })
  const graphModule = new Module(path.resolve('catalog-bpmn-test.cjs'), module)
  graphModule.filename = path.resolve('catalog-bpmn-test.cjs')
  graphModule.paths = module.paths
  graphModule._compile(graphBuilt.outputFiles[0].text, graphModule.filename)
  const graph = graphModule.exports.parseBpmnSource(`@startuml
() "Online meeting selesai" as process_start
rectangle "Salah satu peserta: menyusun MoM manual" as write
rectangle "Salah satu peserta: mengirim MoM kepada seluruh undangan" as send
() "Seluruh undangan rapat: MoM dikirim" as process_end
process_start --> write
write --> send
send --> process_end
@enduml`)
  assert.equal(graph.nodes.find(node => node.id === 'process_start').kind, 'start')
  assert.equal(graph.nodes.find(node => node.id === 'write').lane, 'Salah satu peserta')
  assert.equal(graph.nodes.find(node => node.id === 'process_end').lane, 'Seluruh undangan rapat')
  assert.equal(graph.nodes.filter(node => node.kind === 'activity').length, 2)
  assert.match(graph.nodes.find(node => node.id === 'send').label, /seluruh undangan/)
  const legacy = graphModule.exports.parseBpmnSource(`@startuml
rectangle "Cabang temukan isu" as task1
rectangle "Tim HO proses isu" as task2
() "Start" as process_start
() "End" as process_end
task1 --> task2
task2 --> process_start
process_start --> process_end
@enduml`)
  assert.ok(legacy.edges.some(edge => edge.source === 'process_start' && edge.target === 'task1'))
  assert.ok(legacy.edges.some(edge => edge.source === 'task2' && edge.target === 'process_end'))
  const unnamed = graphModule.exports.parseBpmnSource('flowchart TD\na(("Meeting selesai")) --> b["Peserta: buat MoM"]\nb --> c(("MoM dikirim"))')
  assert.equal(unnamed.nodes.find(node => node.id === 'a').kind, 'start')
  assert.equal(unnamed.nodes.find(node => node.id === 'c').kind, 'end')
  console.log('Catalogue UI checks passed: comparison table, single candidate, AS-IS/TO-BE distinction, unavailable state, escaping')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
