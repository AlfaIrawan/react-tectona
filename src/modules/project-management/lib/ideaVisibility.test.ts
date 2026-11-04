import { describe, expect, it, vi, beforeEach } from 'vitest'
import { isIdeaInFolder, isIdeaVisibleInScope } from './ideaVisibility'
import type { WorkspaceScope } from '@/lib/tenantWorkspaceScope'

vi.mock('@/lib/api/httpClient', () => ({ apiFetch: vi.fn(), tectonaServiceHeaders: () => ({}) }))
import { apiFetch } from '@/lib/api/httpClient'
import { fetchAllIdeas, listIdeas } from '@/lib/api/ideaBacklogApi'

const home: WorkspaceScope = { mode: 'single', workspaceId: 'home', tenantMode: 'personal' }

describe('owner-inclusive idea visibility', () => {
  it('keeps an owner submission routed to IT Business Partner in Alfa workspace', () => {
    expect(isIdeaVisibleInScope({ workspace_id: 'business-partner', source_workspace_id: 'home', owner_id: 'alfa' }, home, 'alfa')).toBe(true)
  })
  it('retains the original creator after owner reassignment', () => {
    expect(isIdeaVisibleInScope({ workspace_id: 'target', source_workspace_id: 'home', owner_id: 'reviewer', created_by: 'alfa' }, home, 'alfa')).toBe(true)
  })
  it('does not expose unrelated ideas, missing identities, or partial ID matches', () => {
    const row = { workspace_id: 'target', owner_id: 'someone', created_by: 'someone' }
    expect(isIdeaVisibleInScope(row, home, 'alfa')).toBe(false)
    expect(isIdeaVisibleInScope(row, home, '')).toBe(false)
    expect(isIdeaVisibleInScope({ workspace_id: 'target', owner_id: 'alfa-extra' }, home, 'alfa')).toBe(false)
    expect(isIdeaVisibleInScope({ workspace_id: 'target' }, home, undefined)).toBe(false)
  })
  it('keeps normal target-workspace visibility', () => {
    expect(isIdeaVisibleInScope({ workspace_id: 'home', owner_id: 'someone' }, home, 'alfa')).toBe(true)
  })
  it('never includes an own idea in unrelated workspaces or guesses a legacy origin', () => {
    const row = { workspace_id: 'target', source_workspace_id: 'home', owner_id: 'alfa' }
    expect(isIdeaVisibleInScope(row, { ...home, workspaceId: 'collection' }, 'alfa')).toBe(false)
    expect(isIdeaVisibleInScope({ ...row, source_workspace_id: null }, home, 'alfa')).toBe(false)
    expect(isIdeaVisibleInScope({ ...row, source_workspace_id: 'another-origin' }, home, 'alfa')).toBe(false)
    expect(isIdeaVisibleInScope(row, home, 'other-user')).toBe(false)
  })
  it('retains own ideas in a selected workspace set, but not other users outside it', () => {
    const scope: WorkspaceScope = { mode: 'all', workspaceIds: ['home'] }
    expect(isIdeaVisibleInScope({ workspace_id: 'target', source_workspace_id: 'home', owner_id: 'alfa' }, scope, 'alfa')).toBe(true)
    expect(isIdeaVisibleInScope({ workspace_id: 'target', source_workspace_id: 'elsewhere', owner_id: 'alfa' }, scope, 'alfa')).toBe(false)
    expect(isIdeaVisibleInScope({ workspace_id: 'target', owner_id: 'other' }, scope, 'alfa')).toBe(false)
  })
  it('shows a cross-workspace idea at the list root without changing its real folder', () => {
    const row = { workspace: 'target', folderId: 'target-folder' }
    expect(isIdeaInFolder(row, null, home)).toBe(true)
    expect(isIdeaInFolder(row, 'home-folder', home)).toBe(false)
    expect(row.folderId).toBe('target-folder')
    expect(isIdeaInFolder(row, 'target-folder', { ...home, workspaceId: 'target' })).toBe(true)
    expect(isIdeaInFolder({ workspace: 'home', folderId: 'home-folder' }, null, home)).toBe(false)
  })
})

describe('owner-inclusive query', () => {
  beforeEach(() => vi.clearAllMocks())
  it('explicitly requests own submissions without passing a user ID', async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(JSON.stringify({ items: [], total: 0 })))
    await fetchAllIdeas({ workspace_id: 'home', include_mine: true })
    const url = String(vi.mocked(apiFetch).mock.calls[0][0])
    expect(url).toContain('workspace_id=home')
    expect(url).toContain('include_mine=true')
    expect(url).not.toContain('owner_id')
  })
  it('leaves project-linking and other existing consumers workspace-scoped by default', async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(JSON.stringify({ items: [], total: 0 })))
    await listIdeas({ workspace_id: 'home' })
    expect(String(vi.mocked(apiFetch).mock.calls[0][0])).not.toContain('include_mine')
  })
})
