const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

async function main() {
  const data = new Map()
  let failWrites = false
  global.localStorage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { if (failWrites) throw new Error('Quota exceeded'); data.set(key, value) },
    removeItem: key => data.delete(key),
  }
  const built = await esbuild.build({
    stdin: {
      contents: "export * from './src/stores/idea-draft-brainstorm-pointer-store'; export * from './src/modules/project-management/lib/closeBrainstorm'",
      resolveDir: process.cwd(), loader: 'ts',
    },
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
  })
  const loaded = new Module(path.resolve('brainstorm-close-test.cjs'), module)
  loaded.filename = path.resolve('brainstorm-close-test.cjs')
  loaded.paths = module.paths
  loaded._compile(built.outputFiles[0].text, loaded.filename)
  const { closeBrainstorm, useIdeaDraftBrainstormPointerStore: store, useIdeaDraftSaveStatusStore: status } = loaded.exports
  const first = { jobId: 'existing-job', draftSessionId: 'session-1', ownerId: 'alice', title: 'MoM', updatedAt: 1, messages: [{ role: 'user', text: 'Meeting context' }] }
  const second = { ...first, jobId: 'other-job', draftSessionId: 'session-2', title: 'Credit', updatedAt: 2 }
  store.getState().retainPointer('awaiting_input', first)
  store.getState().retainPointer('awaiting_input', second)
  const latest = { ...first, updatedAt: 3, composerDraft: 'Unsent question', form: { description: 'Current description', html: '<p>Current description</p>', type: 'Innovation', reviewer: '' } }
  const notifications = []
  const panels = { brainstorm: true, evidence: true, create: true }
  let writes = 0
  const save = () => {
    writes++
    store.getState().retainPointer('awaiting_input', latest)
    return status.getState().status === 'saved'
  }
  const close = () => {
    assert.equal(JSON.parse(data.get('idea-draft-brainstorm-pointer-storage')).state.pointers.find(p => p.jobId === first.jobId).composerDraft, 'Unsent question', 'persist before closing')
    panels.brainstorm = panels.evidence = panels.create = false
  }
  const notify = toast => notifications.push(toast)
  assert.equal(closeBrainstorm({ busy: true, save, close, notify }), false)
  assert.equal(writes, 0)
  assert.equal(panels.create, true)
  assert.equal(notifications.at(-1).variant, 'info')

  failWrites = true
  assert.equal(closeBrainstorm({ busy: false, save, close, notify }), false)
  assert.deepEqual(panels, { brainstorm: true, evidence: true, create: true })
  assert.equal(notifications.at(-1).variant, 'error')
  assert.match(notifications.at(-1).description, /Retry save/)
  assert.equal(notifications.some(n => n.variant === 'success'), false)

  failWrites = false
  assert.equal(closeBrainstorm({ busy: false, save, close, notify }), true, 'retry close saves successfully')
  assert.deepEqual(panels, { brainstorm: false, evidence: false, create: false })
  assert.deepEqual(notifications.at(-1), { title: 'Brainstorm saved', description: 'You can continue it anytime from the Chat panel.', variant: 'success' })
  await store.persist.rehydrate()
  assert.equal(store.getState().pointers.length, 2, 'same session saved without duplicates or removing another draft')
  assert.equal(store.getState().pointers.find(p => p.jobId === first.jobId).composerDraft, 'Unsent question')
  assert.equal(store.getState().pointers.find(p => p.jobId === first.jobId).draftSessionId, first.draftSessionId)
  assert.equal(closeBrainstorm({ busy: false, save: () => { throw Error('Storage blocked') }, close: () => assert.fail('Must stay open'), notify }), false)
  assert.equal(notifications.at(-1).variant, 'error')
  console.log('PASS brainstorm close: save before close, all panels close, informational toast without action, busy/failure guards, retry, reload, composer preservation and independent sessions')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
