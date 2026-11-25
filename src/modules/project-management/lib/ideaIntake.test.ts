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
    expect(payload).not.toHaveProperty('idea_inputs')
  })
  it('sends workspace inputs with the intake and keeps retry identity separate', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(new Response(JSON.stringify({ run_id: 'with-ticket' }), { status: 200 }))
    await startIdeaIntake('organization', 'portfolio', { ticket_number: '001-A' })
    expect(JSON.parse(String(vi.mocked(apiFetch).mock.calls[0][1]?.body))).toMatchObject({
      target_workspace_id: 'portfolio', idea_inputs: { ticket_number: '001-A' },
    })
    const payload = { title: 'Test idea', workspace_id: 'portfolio' }
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Lost response'))
    await expect(createIdeaInIntake('with-ticket', payload, 'creator', { ticket_number: '001-A' })).rejects.toThrow('Lost response')
    vi.mocked(apiFetch).mockResolvedValueOnce(new Response(JSON.stringify({ id: 'idea' }), { status: 200 }))
    await createIdeaInIntake('different-ticket', payload, 'creator', { ticket_number: '002-B' })
    expect(String(vi.mocked(apiFetch).mock.calls[2][0])).toContain('/different-ticket/create-idea')
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
