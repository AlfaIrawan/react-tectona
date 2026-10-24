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
  const key = 'idea-draft-brainstorm-pointer-storage'
  const a = { jobId: 'a', ownerId: 'alice', title: 'Idea A', workspaceId: 'w1', updatedAt: 10, composerDraft: 'Unsent A', form: { description: 'Draft A', html: '<p>Draft A</p>', type: 'Innovation', reviewer: 'reviewer-a' }, messages: [{ role: 'user', text: 'A context', summary: 'A summary' }] }
  const b = { ...a, jobId: 'b', title: 'Idea B', workspaceId: 'w2', updatedAt: 20, messages: [{ role: 'user', text: 'B context' }] }
  data.set(key, JSON.stringify({ state: { pointer: a }, version: 0 }))
  const built = await esbuild.build({ entryPoints: ['src/stores/idea-draft-brainstorm-pointer-store.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external' })
  const loaded = new Module(path.resolve('draft-sessions-test.cjs'), module)
  loaded.filename = path.resolve('draft-sessions-test.cjs')
  loaded.paths = module.paths
  loaded._compile(built.outputFiles[0].text, loaded.filename)
  const store = loaded.exports.useIdeaDraftBrainstormPointerStore
  const status = loaded.exports.useIdeaDraftSaveStatusStore
  await store.persist.rehydrate()
  assert.equal(store.getState().pointers[0].jobId, 'a', 'legacy draft migrates without data loss')
  store.getState().retainPointer('awaiting_input', b)
  assert.deepEqual(store.getState().pointers.map(p => p.jobId), ['b', 'a'])
  store.getState().retainPointer('failed', { ...a, messages: [] })
  assert.deepEqual(store.getState().pointers.find(p => p.jobId === 'a').messages, a.messages)
  await store.persist.rehydrate()
  assert.equal(store.getState().pointers.length, 2, 'refresh preserves both drafts')
  assert.equal(store.getState().pointers.find(p => p.jobId === 'a').composerDraft, 'Unsent A')
  assert.equal(store.getState().pointers.find(p => p.jobId === 'a').form.html, '<p>Draft A</p>')
  store.getState().mergePointers([{ jobId: 'a', ownerId: 'alice', title: 'Server A', updatedAt: 30 }])
  assert.deepEqual(store.getState().pointers.find(p => p.jobId === 'a').messages, a.messages)
  store.getState().markCreated('a', 'idea-123')
  store.getState().mergePointers([{ ...a, updatedAt: 40, ideaId: null }])
  assert.equal(store.getState().pointers.find(p => p.jobId === 'a').ideaId, 'idea-123')
  store.getState().replacePointer('b', { ...b, jobId: 'restored-b' })
  assert.deepEqual(store.getState().pointers.map(p => p.jobId).sort(), ['a', 'restored-b'])
  store.getState().clearPointer('a')
  store.getState().mergePointers([a, b])
  assert.deepEqual(store.getState().pointers.map(p => p.jobId), ['restored-b'], 'late list cannot resurrect removed or replaced sessions')
  store.getState().retainPointer('cancelled', { ...b, jobId: 'other' })
  assert.equal(store.getState().pointers.length, 1, 'cancelling another job does not remove this draft')
  failWrites = true
  assert.doesNotThrow(() => store.getState().setPointer({ ...a, jobId: 'offline' }))
  assert.equal(status.getState().status, 'failed', 'quota failure is visible without losing in-memory state')
  failWrites = false
  store.getState().setPointer(store.getState().pointer)
  assert.equal(status.getState().status, 'saved')
  assert.ok(JSON.parse(data.get(key)).state.pointers.some(p => p.jobId === 'offline'))
  const otherTab = JSON.parse(data.get(key))
  otherTab.state.pointers.push({ ...b, jobId: 'other-tab', updatedAt: 50 })
  data.set(key, JSON.stringify(otherTab))
  store.getState().setPointer({ ...a, jobId: 'this-tab', updatedAt: 60 })
  await store.persist.rehydrate()
  assert.ok(store.getState().pointers.some(p => p.jobId === 'other-tab'), 'another tab draft survives an index write')
  console.log('PASS: migration, multiple drafts, refresh, metadata sync, creation, restore, targeted deletion, late responses, failed save, retry and independent tab writes')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
