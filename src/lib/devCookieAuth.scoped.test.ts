import { describe, expect, it } from 'vitest'
import { prepareLocalRequest } from '../../scripts/dev-cookie-auth'

const jwt = (aud: string) => `header.${Buffer.from(JSON.stringify({ aud })).toString('base64url')}.signature`
function request(path: string, extra: Record<string, string> = {}) {
  const headers = { host: 'localhost:9411', 'sec-fetch-site': 'same-origin', ...extra }
  return { url: path, headers, rawHeaders: Object.entries(headers).flat() }
}

describe('W06 Tectona scoped boundary', () => {
  it('forwards only the Tectona access token for workspace requests', () => {
    const token = jwt('tectona-spa')
    const result = prepareLocalRequest(request('/api/workspace-org/v1/workspaces', {
      cookie: `idl_access_tectona-spa=${token}; idl_access_acacia-spa=${jwt('acacia-spa')}; idl_refresh_tectona-spa=refresh; idl_sso=sso`,
    }), 'tectona-spa')
    expect(result.status).toBe(0)
    expect(result.headers?.authorization).toBe(`Bearer ${token}`)
    expect(result.headers?.cookie).toBeUndefined()
  })

  it('rejects Acacia credentials on Tectona routes', () => {
    expect(prepareLocalRequest(request('/api/workspace-org/v1/workspaces', {
      authorization: `Bearer ${jwt('acacia-spa')}`,
    }), 'tectona-spa').status).toBe(403)
  })

  it('does not fall back to the old shared access cookie', () => {
    expect(prepareLocalRequest(request('/api/workspace-org/v1/workspaces', {
      cookie: `idl_access=${jwt('tectona-spa')}`,
    }), 'tectona-spa').status).toBe(401)
  })

  it.each([
    '/api/gateway-runtime/api/idea-backlog/v1/ideas',
    '/api/idea-backlog/v1/ideas',
    '/api/gateway-runtime/api/project/v1/projects',
  ])('keeps unaudited service routes closed: %s', (path) => {
    expect(prepareLocalRequest(request(path, {
      authorization: `Bearer ${jwt('tectona-spa')}`,
    }), 'tectona-spa').status).toBe(403)
  })

  it.each([
    { host: 'localhost:9417' },
    { origin: 'http://localhost:9417' },
    { cookie: `idl_access_tectona-spa=${jwt('tectona-spa')}`, 'sec-fetch-site': 'cross-site' },
  ] as Record<string, string>[])('rejects cross-app or cross-site requests', (headers) => {
    expect(prepareLocalRequest(request('/api/workspace-org/v1/workspaces', headers), 'tectona-spa').status).toBe(403)
  })

  it('rejects duplicate selected access cookies', () => {
    const token = jwt('tectona-spa')
    expect(prepareLocalRequest(request('/api/workspace-org/v1/workspaces', {
      cookie: `idl_access_tectona-spa=${token}; idl_access_tectona-spa=${token}`,
    }), 'tectona-spa').status).toBe(401)
  })
})
