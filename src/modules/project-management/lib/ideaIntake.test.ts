import { beforeEach, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
vi.mock('@/lib/api/httpClient', () => ({ apiFetch: vi.fn(), tectonaServiceHeaders: () => ({ 'Content-Type': 'application/json' }) }))
import { apiFetch } from '@/lib/api/httpClient'
import { createIdeaInIntake, startIdeaIntake } from './ideaWorkspaceSelection'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.stubGlobal('crypto', webcrypto)
})

describe('durable idea intake requests', () => {
  it('starts a session for the chosen source and owning workspace', async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(JSON.stringify({ run_id: 'parent-1' }), { status: 200 }))
    expect(await startIdeaIntake('organization', 'business-partner')).toBe('parent-1')
    const payload = JSON.parse(String(vi.mocked(apiFetch).mock.calls[0][1]?.body))
    expect(payload.source_workspace_id).toBe('organization')
    expect(payload.target_workspace_id).toBe('business-partner')
    expect(payload.request_key).toMatch(/^[0-9a-f-]{36}$/)
  })
  it('recovers the original parent session after a lost creation response', async () => {
    const payload = { title: 'Test idea', workspace_id: 'business-partner' }
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Lost response'))
    await expect(createIdeaInIntake('original-parent', payload, 'creator')).rejects.toThrow('Lost response')
    vi.mocked(apiFetch).mockResolvedValueOnce(new Response(JSON.stringify({ id: 'same-idea' }), { status: 200 }))
    expect(await createIdeaInIntake('new-parent-after-reload', payload, 'creator')).toEqual({ id: 'same-idea' })
    expect(String(vi.mocked(apiFetch).mock.calls[1][0])).toContain('idea-intakes/original-parent/create-idea')
    expect(localStorage.length).toBe(0)
  })
})
