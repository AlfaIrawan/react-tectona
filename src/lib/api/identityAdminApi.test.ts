import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchWorkspaceManagementIdentityDirectory } from './identityAdminApi'

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('./httpClient', () => ({
  apiFetch,
  tectonaServiceHeaders: () => ({}),
}))

const accounts = Array.from({ length: 1001 }, (_, index) => ({ id: `fixture-${index}` }))

function usePagedDirectory() {
  apiFetch.mockImplementation(async (url: string) => {
    const params = new URL(url, 'http://localhost').searchParams
    const limit = Number(params.get('limit'))
    const offset = Number(params.get('offset'))
    return { ok: true, json: async () => ({ items: accounts.slice(offset, offset + limit), limit, offset }) }
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
  apiFetch.mockReset()
})

describe('Workspace Management identity directory', () => {
  it('loads identities beyond the first API page in the sandbox', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_WORKSPACE_SANDBOX', 'enterprise')
    usePagedDirectory()

    expect((await fetchWorkspaceManagementIdentityDirectory()).items).toEqual(accounts)
  })

  it('retains the existing first page request in standard Tectona', async () => {
    vi.stubEnv('VITE_WORKSPACE_SANDBOX', '')
    usePagedDirectory()

    expect((await fetchWorkspaceManagementIdentityDirectory()).items).toHaveLength(500)
    expect(apiFetch).toHaveBeenCalledTimes(1)
  })
})
