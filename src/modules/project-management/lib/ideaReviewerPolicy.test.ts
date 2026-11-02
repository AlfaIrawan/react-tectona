import { beforeEach, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/api/httpClient'
import { loadIdeaReviewerPolicy } from './ideaWorkspaceSelection'

vi.mock('@/lib/api/httpClient', () => ({ apiFetch: vi.fn(), tectonaServiceHeaders: () => ({}) }))
beforeEach(() => vi.mocked(apiFetch).mockReset())

it('queries the selected workspace and intake source without modifying workflow configuration', async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce(new Response(JSON.stringify({ managed_by_workflow: true })))
  expect(await loadIdeaReviewerPolicy('selected ws', 'source')).toBe(true)
  expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('workspace_id=selected+ws&source_workspace_id=source'), { headers: {} })
})

it('preserves manual reviewer selection for an explicit unmanaged response', async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce(new Response(JSON.stringify({ managed_by_workflow: false })))
  expect(await loadIdeaReviewerPolicy('ws')).toBe(false)
})

it('does not interpret request failures or malformed responses as unmanaged', async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce(new Response('', { status: 503 }))
  await expect(loadIdeaReviewerPolicy('ws')).rejects.toThrow('could not be verified')
  vi.mocked(apiFetch).mockResolvedValueOnce(new Response(JSON.stringify({})))
  await expect(loadIdeaReviewerPolicy('ws')).rejects.toThrow('Invalid reviewer assignment policy')
})
