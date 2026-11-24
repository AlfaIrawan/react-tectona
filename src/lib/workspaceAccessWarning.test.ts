import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceApiError, trustedSupportPortalUrl } from '@/lib/workspaceAccessWarning'
import { evaluateWorkspaceSlugAccess } from '@/lib/workspaceSlugAccess'

const getSession = vi.fn()

vi.mock('@/auth/authService', () => ({
  getSession: () => getSession(),
}))

vi.mock('@/lib/api/httpClient', () => ({
  apiFetch: vi.fn(),
  tectonaServiceHeaders: () => ({}),
}))

import { apiFetch } from '@/lib/api/httpClient'

const fetchMock = vi.mocked(apiFetch)

const session = {
  user: {
    id: 'user-1',
    email: 'member@adira.co.id',
    name: 'Member',
    role: 'member',
    roles: ['member'],
  },
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const resolved = {
  workspace_id: 'ws-1',
  org_id: 'org-1',
  slug: 'adira-finance-ws',
  display_name: 'Adira Finance WS',
  tenant_mode: 'personal',
}

function route(input: RequestInfo | URL) {
  return String(input)
}

beforeEach(() => {
  getSession.mockReset()
  getSession.mockReturnValue(session)
  fetchMock.mockReset()
})

describe('workspace dependency disruption', () => {
  it('names the workspace directory when resolve times out or returns 503', async () => {
    fetchMock.mockRejectedValueOnce(new Error('timeout'))
    await expect(evaluateWorkspaceSlugAccess('adira-finance-ws')).resolves.toEqual({
      allowed: false,
      reason: 'unavailable',
      dependency: 'workspace-directory',
    })

    fetchMock.mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
    await expect(evaluateWorkspaceSlugAccess('adira-finance-ws')).resolves.toEqual({
      allowed: false,
      reason: 'unavailable',
      dependency: 'workspace-directory',
    })
  })

  it('names access verification when the membership check returns 503', async () => {
    fetchMock.mockImplementation(async (input) => {
      const path = route(input)
      if (path.includes('/resolve')) return json(resolved)
      if (path.includes('/memberships')) return new Response('unavailable', { status: 503 })
      return json([])
    })
    await expect(evaluateWorkspaceSlugAccess('adira-finance-ws')).resolves.toEqual({
      allowed: false,
      reason: 'unavailable',
      dependency: 'workspace-access',
    })
  })

  it('keeps a real denial and an expired session distinct from a disruption', async () => {
    fetchMock.mockResolvedValueOnce(json({ detail: 'forbidden' }, 403))
    await expect(evaluateWorkspaceSlugAccess('adira-finance-ws')).resolves.toEqual({
      allowed: false,
      reason: 'forbidden',
    })

    fetchMock.mockResolvedValueOnce(json({ detail: 'unauthorized' }, 401))
    await expect(evaluateWorkspaceSlugAccess('adira-finance-ws')).resolves.toEqual({
      allowed: false,
      reason: 'unauthenticated',
    })
  })

  it('opens the workspace after the failed check recovers', async () => {
    let directoryDown = true
    fetchMock.mockImplementation(async (input) => {
      const path = route(input)
      if (path.includes('/resolve')) {
        if (directoryDown) return new Response('unavailable', { status: 503 })
        return json(resolved)
      }
      if (path.includes('/memberships')) {
        return json({
          items: [{ workspace_id: 'ws-1', participation_scope_code: 'member' }],
        })
      }
      if (path.includes('/identities/')) {
        return json([{
          workspace_id: 'ws-1',
          role_code: 'owner',
          membership_status_code: 'active',
        }])
      }
      if (path.includes('/v1/workspaces')) {
        return json({ items: [{ id: 'ws-1', slug: 'adira-finance-ws', tenant_mode: 'personal', metadata: {} }], total: 1 })
      }
      return json({})
    })

    await expect(evaluateWorkspaceSlugAccess('adira-finance-ws')).resolves.toMatchObject({
      allowed: false,
      dependency: 'workspace-directory',
    })
    directoryDown = false
    await expect(evaluateWorkspaceSlugAccess('adira-finance-ws')).resolves.toMatchObject({
      allowed: true,
      slug: { slug: 'adira-finance-ws' },
    })
  })
})

describe('support portal link', () => {
  it('accepts only an approved https portal on another host', () => {
    expect(trustedSupportPortalUrl(undefined, 'https://d3swtxxlumxfkm.cloudfront.net')).toBeNull()
    expect(trustedSupportPortalUrl('http://support.example.com/portal', 'https://d3swtxxlumxfkm.cloudfront.net')).toBeNull()
    expect(trustedSupportPortalUrl('https://d3swtxxlumxfkm.cloudfront.net/help', 'https://d3swtxxlumxfkm.cloudfront.net')).toBeNull()
    expect(trustedSupportPortalUrl('https://support.example.com/portal', 'https://d3swtxxlumxfkm.cloudfront.net')).toBe(
      'https://support.example.com/portal',
    )
  })

  it('uses WorkspaceApiError for HTTP failures', () => {
    const error = new WorkspaceApiError(503, 'HTTP 503')
    expect(error.status).toBe(503)
    expect(error.workspaceSlugNotFound).toBe(false)
  })
})
