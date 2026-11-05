import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getIdeaContentLock } from '@/lib/api/ideaBacklogApi'
import { updateIdeaContentRevision } from '@/lib/api/workflowAutomationApi'
import { useIdeaContentLock } from './useIdeaContentLock'

vi.mock('@/lib/api/ideaBacklogApi', () => ({ getIdeaContentLock: vi.fn() }))
vi.mock('@/lib/api/workflowAutomationApi', () => ({ updateIdeaContentRevision: vi.fn() }))

let root: Root
let container: HTMLDivElement
let state: ReturnType<typeof useIdeaContentLock>
function Harness({ id = 'idea', revision = 0, enforced = true }) {
  state = useIdeaContentLock(id, revision, enforced)
  return createElement('output', null, JSON.stringify(state))
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.mocked(getIdeaContentLock).mockReset()
  vi.mocked(updateIdeaContentRevision).mockReset().mockResolvedValue(undefined)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

it('fails closed if a previously editable protected Idea cannot be verified', async () => {
  vi.mocked(getIdeaContentLock).mockResolvedValueOnce({ state: 'draft', locked: false, run_id: null })
  await act(async () => root.render(createElement(Harness)))
  expect(state.locked).toBe(false)
  vi.mocked(getIdeaContentLock).mockRejectedValueOnce(new Error('Network unavailable'))
  await act(async () => root.render(createElement(Harness, { revision: 1 })))
  expect(state.locked).toBe(true)
  expect(state.error).toBe('Network unavailable')
})

it('reconciles the committed decision and reopens only a revision', async () => {
  vi.mocked(getIdeaContentLock)
    .mockResolvedValueOnce({ state: 'submitted', locked: true, run_id: 'run-test:2' })
    .mockResolvedValueOnce({ state: 'revision', locked: false, run_id: 'run-test:2' })
  await act(async () => root.render(createElement(Harness)))
  expect(updateIdeaContentRevision).toHaveBeenCalledWith('run-test', 'reconcile-content-lock')
  expect(state.locked).toBe(false)
  expect(state.value?.state).toBe('revision')
})

it('does not unlock a protected Idea while switching away from another Idea', async () => {
  vi.mocked(getIdeaContentLock).mockResolvedValueOnce({ state: 'draft', locked: false, run_id: null })
  await act(async () => root.render(createElement(Harness, { id: 'old' })))
  vi.mocked(getIdeaContentLock).mockImplementationOnce(() => new Promise(() => {}))
  await act(async () => root.render(createElement(Harness, { id: 'new' })))
  expect(state.locked).toBe(true)
  expect(state.value).toBeNull()
})

it('preserves the last known lock even when the policy has been removed', async () => {
  vi.mocked(getIdeaContentLock).mockResolvedValueOnce({ state: 'approved', locked: true, run_id: 'run-test:1' })
  await act(async () => root.render(createElement(Harness, { enforced: false })))
  vi.mocked(getIdeaContentLock).mockRejectedValueOnce(new Error('Unavailable'))
  await act(async () => root.render(createElement(Harness, { enforced: false, revision: 1 })))
  expect(state.locked).toBe(true)
})
