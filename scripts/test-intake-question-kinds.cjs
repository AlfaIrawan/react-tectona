const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { JSDOM } = require('jsdom')

async function main() {
  const built = await esbuild.build({
    entryPoints: ['src/modules/project-management/components/IdeaIntakeAnswerList.tsx'],
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic',
    alias: { '@': path.resolve('src') },
  })
  const loaded = new Module(path.resolve('intake-kinds-test.cjs'), module)
  loaded.filename = path.resolve('intake-kinds-test.cjs')
  loaded.paths = module.paths
  loaded._compile(built.outputFiles[0].text, loaded.filename)
  const Component = loaded.exports.IdeaIntakeAnswerList
  const render = props => new JSDOM(renderToStaticMarkup(React.createElement(Component, { disabled: false, onSave: async () => {}, ...props }))).window.document
  const answers = [{ id: 'mandatory', question: 'Deskripsi proyek', answer: 'Chat Credit', turn: 0 }]
  const doc = render({
    answers,
    followups: [
      { question: 'Target keberhasilan', answer: '90 persen', turn: 4, question_kind: 'extended' },
      { question: 'Sumber data', answer: 'Tectona', turn: 1, question_kind: 'challenge' },
      { question: 'Pertanyaan lama', answer: 'Jawaban lama', turn: 8 },
    ],
    openPoints: ['Akses data', 'Risiko lanjutan', 'Pertanyaan tanpa metadata'],
    openPointTurns: [2, 5, null], openPointQuestionKinds: ['challenge', 'extended', null],
  })
  const cards = [...doc.querySelectorAll('article')]
  assert.equal(cards.length, 7)
  const expected = [
    ['Mandatory Question', 'Deskripsi proyek', 'Chat Credit'],
    ['Challenge Question', 'Sumber data', 'Tectona'],
    ['Challenge Question', 'Akses data', 'Not answered'],
    ['Extended Question', 'Target keberhasilan', '90 persen'],
    ['Extended Question', 'Risiko lanjutan', 'Not answered'],
    ['Additional Question', 'Pertanyaan lama', 'Jawaban lama'],
    ['Additional Question', 'Pertanyaan tanpa metadata', 'Not answered'],
  ]
  expected.forEach((values, index) => values.forEach(value => assert.ok(cards[index].textContent.includes(value), `card ${index}: ${value}`)))
  assert.match(cards[1].className, /border-amber/)
  assert.match(cards[2].className, /border-dashed/)
  assert.match(cards[3].className, /border-violet/)
  assert.doesNotMatch(doc.body.textContent, /AI follow-up/i)
  const legend = doc.querySelector('p.flex')
  for (const label of ['Mandatory Question', 'Challenge Question', 'Extended Question', 'Additional Question']) {
    assert.equal(legend.textContent.split(label).length - 1, 1)
  }
  const legacy = render({ answers, followups: [{ question: 'Target?', answer: 'Belum pasti' }], openPoints: ['Risiko?'] })
  assert.equal([...legacy.querySelectorAll('article')].filter(card => card.textContent.includes('Additional Question')).length, 2)
  assert.equal(legacy.body.textContent.includes('Extended Question'), false, 'do not guess kinds from question wording')
  assert.equal(render({ answers }).querySelectorAll('article').length, 1)
  console.log('PASS intake question types: original labels, colours, legend, chronological answers, skipped questions and legacy fallback')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
