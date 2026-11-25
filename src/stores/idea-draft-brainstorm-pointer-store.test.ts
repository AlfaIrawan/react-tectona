import { beforeEach, describe, expect, it } from 'vitest'
import { useIdeaDraftBrainstormPointerStore as store } from './idea-draft-brainstorm-pointer-store'
import { prepareDiagramHandoff, serializeSelectedSources } from '@/lib/chat/technicalDiagramHandoff'

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
  it('preserves origin when merging legacy server metadata and after creating the idea', () => {
    store.getState().setPointer({ ...snapshot, ownerId: 'alice', sourceWorkspaceId: 'origin', sourceWorkspaceName: 'Original workspace' })
    store.getState().mergePointers([{ ...snapshot, ownerId: 'alice', sourceWorkspaceId: undefined, updatedAt: 2 }])
    store.getState().markCreated(snapshot.jobId, 'new-idea')
    expect(store.getState().pointers[0].sourceWorkspaceId).toBe('origin')
    expect(store.getState().pointers[0].workspaceId).toBe('workspace-alfa')
    expect(store.getState().pointers[0].ideaId).toBe('new-idea')
  })
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


it('preserves genuine message timing through server-list refresh and local rehydration', async () => {
  const messages = [
    { role: 'user' as const, text: 'Helpdesk', sentAt: '2026-11-07T09:54:00Z' },
    { role: 'assistant' as const, text: 'Apa tujuannya?', respondedAt: '2026-11-07T09:54:40Z' },
    { role: 'assistant' as const, text: 'Konfirmasi.', respondedAt: '2026-11-07T10:06:47Z' },
  ]
  store.getState().setPointer({ ...snapshot, messages })
  store.getState().mergePointers([{ ...snapshot, updatedAt: 2, messages: messages.map(({ role, text }) => ({ role, text })) }])
  expect(store.getState().pointers[0].messages).toEqual(messages)
  await store.persist.rehydrate()
  expect(store.getState().pointers[0].messages).toEqual(messages)
})


it.each([false, true])('rehydrates the exact selected attachment state, explicitlyEmpty=%s', async explicitlyEmpty => {
  const source = "@startuml\n' tectona-dimension: operations\n' tectona-view: archimate\ncomponent Mock\n@enduml"
  const description = explicitlyEmpty ? '' : serializeSelectedSources('Selected text.', [{ source, language: 'plantuml', topic: 'operations', kind: 'archimate', provenance: 'selected-text', reviewedRepresentation: false }])
  const form = { description, html: explicitlyEmpty ? '' : '<p>Selected text.</p>', type: 'business', reviewer: '', sourceSelectionVersion: 1 as const }
  store.getState().setPointer({ ...snapshot, form })
  await store.persist.rehydrate()
  expect(store.getState().pointers[0].form).toEqual(form)
  store.getState().mergePointers([{ ...snapshot, status: 'completed', updatedAt: 2 }])
  await store.persist.rehydrate()
  const saved = store.getState().pointers[0].form!
  expect(saved).toEqual(form)
  expect(JSON.parse(localStorage.getItem('idea-draft-brainstorm-pointer-storage')!).state.pointers[0].form).toEqual(form)
  const prepared = prepareDiagramHandoff({ text: saved.description, html: saved.html, mode: 'resume', existing: [{ source: 'newer unrelated source', language: 'unknown', provenance: 'local-unverified', reviewedRepresentation: false }] })
  expect(prepared.ok).toBe(true)
  if (prepared.ok) {
    expect(prepared.sources.map(item => item.source)).toEqual(explicitlyEmpty ? [] : [source])
    expect(prepared.sources.every(item => !item.reviewedRepresentation)).toBe(true)
  }
})
