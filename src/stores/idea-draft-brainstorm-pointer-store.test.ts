import { beforeEach, describe, expect, it } from 'vitest'
import { useIdeaDraftBrainstormPointerStore as store } from './idea-draft-brainstorm-pointer-store'

const snapshot = {
  jobId: 'helpdesk-job',
  title: 'Pembuatan Aplikasi Helpdek',
  updatedAt: 1,
  workspaceId: 'workspace-alfa',
  messages: [{ role: 'user' as const, text: 'Tim Cabang dan Tim HO' }],
}

beforeEach(() => {
  store.getState().clearPointer()
  localStorage.clear()
})

describe('brainstorm recovery snapshot lifecycle', () => {
  it.each(['queued', 'running', 'failed', 'completed', 'awaiting_input'])(
    'keeps the conversation when the job is %s',
    (status) => {
      store.getState().setPointer(snapshot)
      store.getState().retainPointer(status, { ...snapshot, messages: [] })
      expect(store.getState().pointer?.messages).toEqual(snapshot.messages)
      const saved = JSON.parse(localStorage.getItem('idea-draft-brainstorm-pointer-storage')!)
      expect(saved.state.pointer.messages).toEqual(snapshot.messages)
    },
  )

  it('does not replace an existing session with an empty new job', () => {
    store.getState().setPointer(snapshot)
    store.getState().retainPointer('running', { jobId: 'new', title: 'New', updatedAt: 2 })
    expect(store.getState().pointer).toEqual(snapshot)
  })

  it('clears only the explicitly cancelled session', () => {
    store.getState().setPointer(snapshot)
    store.getState().retainPointer('cancelled', { ...snapshot, jobId: 'other' })
    expect(store.getState().pointer).toEqual(snapshot)
    store.getState().retainPointer('cancelled', snapshot)
    expect(store.getState().pointer).toBeNull()
  })

  it('persists newly received messages during generation', () => {
    store.getState().retainPointer('running', snapshot)
    expect(store.getState().pointer).toEqual(snapshot)
  })
})
