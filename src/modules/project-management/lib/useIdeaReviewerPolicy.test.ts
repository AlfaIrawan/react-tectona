import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useIdeaReviewerPolicy } from './useIdeaReviewerPolicy'
import { loadIdeaReviewerPolicy } from './ideaWorkspaceSelection'

vi.mock('./ideaWorkspaceSelection', () => ({ loadIdeaReviewerPolicy: vi.fn() }))
let root: Root
let container: HTMLDivElement
let state: ReturnType<typeof useIdeaReviewerPolicy>
function Harness({ workspaceId, open = true }: { workspaceId: string; open?: boolean }) {
  state = useIdeaReviewerPolicy(open, workspaceId, 'source')
  return createElement('output', null, JSON.stringify(state))
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.mocked(loadIdeaReviewerPolicy).mockReset()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })

it('hides the reviewer only when the selected workspace policy manages it', async () => {
  vi.mocked(loadIdeaReviewerPolicy).mockResolvedValueOnce(true).mockResolvedValueOnce(false)
  await act(async () => root.render(createElement(Harness, { workspaceId: 'bp' })))
  expect(state).toEqual({ managed: true, loading: false, error: '' })
  expect(loadIdeaReviewerPolicy).toHaveBeenCalledWith('bp', 'source')
  await act(async () => root.render(createElement(Harness, { workspaceId: 'unmanaged' })))
  expect(state).toEqual({ managed: false, loading: false, error: '' })
})

it('ignores stale workspace responses and disables manual selection while checking', async () => {
  let resolveOld!: (managed: boolean) => void
  let resolveNew!: (managed: boolean) => void
  vi.mocked(loadIdeaReviewerPolicy)
    .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
    .mockImplementationOnce(() => new Promise((resolve) => { resolveNew = resolve }))
  await act(async () => root.render(createElement(Harness, { workspaceId: 'old' })))
  expect(state.loading).toBe(true)
  await act(async () => root.render(createElement(Harness, { workspaceId: 'new' })))
  await act(async () => resolveOld(true))
  expect(state).toEqual({ managed: false, loading: true, error: '' })
  await act(async () => resolveNew(false))
  expect(state).toEqual({ managed: false, loading: false, error: '' })
})

it('does not assume manual reviewer ownership when the policy request fails', async () => {
  vi.mocked(loadIdeaReviewerPolicy).mockRejectedValueOnce(new Error('Policy unavailable'))
  await act(async () => root.render(createElement(Harness, { workspaceId: 'ws' })))
  expect(state).toEqual({ managed: false, loading: false, error: 'Policy unavailable' })
  await act(async () => root.render(createElement(Harness, { workspaceId: 'ws', open: false })))
  expect(state).toEqual({ managed: false, loading: false, error: '' })
})
