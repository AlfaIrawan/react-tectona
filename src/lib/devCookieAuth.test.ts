import { describe, expect, it, vi } from 'vitest'
import type { IncomingMessage } from 'node:http'
import { forwardCookieAuthorization, devCookieAuth } from '../../scripts/dev-cookie-auth'

describe('dev cookie authorization bridge', () => {
  function forward(headers: Record<string, string>) {
    const setHeader = vi.fn()
    forwardCookieAuthorization({ setHeader }, { headers } as IncomingMessage)
    return setHeader
  }

  it('forwards only the access JWT, not refresh or SSO cookies', () => {
    const setHeader = forward({ cookie: 'idl_refresh=secret; idl_access=header.payload.signature; idl_sso=secret' })
    expect(setHeader).toHaveBeenCalledOnce()
    expect(setHeader).toHaveBeenCalledWith('Authorization', 'Bearer header.payload.signature')
  })

  it('preserves explicit authorization', () => {
    expect(forward({ authorization: 'Bearer explicit', cookie: 'idl_access=a.b.c' })).not.toHaveBeenCalled()
  })

  it.each(['', 'idl_refresh=a.b.c', 'other_idl_access=a.b.c', 'idl_access=invalid', 'idl_access=a.b.c\r\nx: bad'])('ignores missing or malformed tokens: %s', (cookie) => {
    expect(forward({ cookie })).not.toHaveBeenCalled()
  })

  it('installs both HTTP and WebSocket bridges only for configured API proxies', () => {
    const existingConfigure = vi.fn()
    const api = { configure: existingConfigure }
    const staticProxy = { target: 'http://localhost:9000' }
    const plugin = devCookieAuth()
    const config = { server: { proxy: { '/api/test': api, '/assets': staticProxy } } }
    ;(plugin.configResolved as Function)(config)
    const on = vi.fn()
    api.configure({ on }, {})
    expect(existingConfigure).toHaveBeenCalledOnce()
    expect(on).toHaveBeenCalledWith('proxyReq', forwardCookieAuthorization)
    expect(on).toHaveBeenCalledWith('proxyReqWs', forwardCookieAuthorization)
    expect(staticProxy).not.toHaveProperty('configure')
  })
})
