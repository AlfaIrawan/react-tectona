import { strict as assert } from 'node:assert'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ProxyOptions, ResolvedConfig, ViteDevServer } from 'vite'
import { test } from 'vitest'
import { prepareLocalRequest, devCookieAuth } from '../../scripts/dev-cookie-auth'

const root = '/api/gateway-runtime/api/idea-backlog/v1'
const path = root + '/ideas?workspace_id=demo'
// Synthetic routing fixtures only. Signature/session validation belongs to the backend.
const jwt = (aud = 'tectona-spa', tag: string | null = aud) => `header.${Buffer.from(JSON.stringify({ aud, w06_local: tag })).toString('base64url')}.signature`
const token = jwt()
function req(url = path, extra: Record<string, string> = {}, method = 'GET'): IncomingMessage {
  const headers = { host: 'localhost:9411', 'sec-fetch-site': 'same-origin', cookie: `idl_access_tectona-spa=${token}`, ...extra }
  return { url, method, headers, rawHeaders: Object.entries(headers).flat() } as IncomingMessage
}
const run = (request: IncomingMessage, enabled = true, websocket = false, client: Parameters<typeof prepareLocalRequest>[1] = 'tectona-spa') => prepareLocalRequest(request, client, websocket, enabled)
const targets = { identity: 'http://127.0.0.1:8430', org: 'http://127.0.0.1:8424', wac: 'http://127.0.0.1:8421' }
const gateway = (): ProxyOptions => ({ target: 'http://localhost:8084', ws: true })
const config = (): ResolvedConfig => ({
  server: { host: '127.0.0.1', strictPort: true, port: 9411, proxy: { '/api/gateway-runtime': gateway() } },
} as unknown as ResolvedConfig)
function configure(plugin: Plugin, value: ResolvedConfig): void {
  const hook = plugin.configResolved
  if (typeof hook !== 'function') throw new Error('Expected synchronous configResolved hook')
  hook.call({} as ThisParameterType<typeof hook>, value)
}
function proxyFor(value: ResolvedConfig, key: string): ProxyOptions {
  const proxy = value.server.proxy?.[key]
  assert.ok(proxy && typeof proxy !== 'string')
  return proxy
}


test('default remains closed', () => assert.equal(run(req(), false).status, 403))
for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
  test(`scoped Tectona ${method} is forwarded as bearer only`, () => {
    const result = run(req(path, { cookie: `idl_access_tectona-spa=${token}; idl_refresh_tectona-spa=secret; idl_sso=secret; idl_access_acacia-spa=${jwt('acacia-spa')}` }, method))
    assert.equal(result.status, 0)
    assert.equal(result.headers?.authorization, 'Bearer ' + token)
    assert.equal(result.headers?.cookie, undefined)
  })
}
for (const method of ['HEAD', 'OPTIONS', 'CONNECT', 'TRACE', '']) {
  test(`unimplemented ${method || 'empty'} method remains closed`, () => assert.equal(run(req(path, {}, method)).status, 403))
}
test('folder resource allowed', () => assert.equal(run(req(root + '/folders?workspace_id=demo')).status, 0))
test('explicit synthetic pilot bearer retained', () => assert.equal(run(req(path, { authorization: 'Bearer ' + token })).headers?.authorization, 'Bearer ' + token))
test('wrong bearer audience rejected', () => assert.equal(run(req(path, { authorization: 'Bearer ' + jwt('acacia-spa') })).status, 403))
test('wrong cookie audience rejected', () => assert.equal(run(req(path, { cookie: 'idl_access_tectona-spa=' + jwt('acacia-spa') })).status, 403))
test('untagged Tectona token rejected', () => assert.equal(run(req(path, { authorization: 'Bearer ' + jwt('tectona-spa', null) })).status, 403))
test('wrong pilot tag rejected', () => assert.equal(run(req(path, { authorization: 'Bearer ' + jwt('tectona-spa', 'acacia-spa') })).status, 403))
test('legacy cookie is not fallback', () => assert.equal(run(req(path, { cookie: 'idl_access=' + token })).status, 401))
test('missing credential rejected', () => assert.equal(run(req(path, { cookie: '' })).status, 401))
test('duplicate selected cookie rejected', () => assert.equal(run(req(path, { cookie: `idl_access_tectona-spa=${token}; idl_access_tectona-spa=${token}` })).status, 401))
test('Acacia cannot access route', () => assert.equal(run(req(path, { host: 'localhost:9417', cookie: 'idl_access_acacia-spa=' + jwt('acacia-spa') }), true, false, 'acacia-spa').status, 403))
test('cross origin rejected', () => assert.equal(run(req(path, { origin: 'http://localhost:9417' })).status, 403))
test('cookie cross-site rejected', () => assert.equal(run(req(path, { 'sec-fetch-site': 'cross-site' })).status, 403))
test('duplicate host rejected', () => { const r = req(); r.rawHeaders.push('Host', 'localhost:9411'); assert.equal(run(r).status, 403) })
test('duplicate authorization rejected', () => { const r = req(path, { authorization: 'Bearer ' + token }); r.rawHeaders.push('Authorization', 'Bearer ' + token); assert.equal(run(r).status, 401) })
test('websocket is denied', () => assert.equal(run(req(path, { origin: 'http://localhost:9411' }), true, true).status, 403))
for (const key of ['token', 'access_token', 'refresh_token', 'id_token', 'authorization', 'TOKEN', '%74oken']) {
  test(`query credential ${key} denied`, () => assert.equal(run(req(path + '&' + key + '=value')).status, 403))
}
for (const candidate of [
  '/api/gateway-runtime/api/project/v1/projects', '/api/idea-backlog/v1/ideas',
  root + '/ideas-evil', root + '/folders-evil', root + '/other',
  root + '/ideas/../folders', root + '/ideas/%2e%2e/folders', root + '/ideas/%252e%252e',
  root + '/ideas/%2fother', root + '/ideas/%5cother', root + '/ideas//other',
  '//evil.example/api/gateway-runtime/api/idea-backlog/v1/ideas',
]) test(`unapproved or ambiguous path denied: ${candidate}`, () => assert.equal(run(req(candidate)).status, 403))
test('routing hints and cookies removed', () => {
  const r = run(req(path, { 'x-token-delivery': 'scoped-cookie', 'x-w06-local-client': 'acacia-spa' }))
  assert.equal(r.status, 0)
  assert.equal(r.headers?.['x-token-delivery'], undefined)
  assert.equal(r.headers?.['x-w06-local-client'], undefined)
})
test('opt-in route precedes broad gateway, rewrites only gateway prefix and has no WS', () => {
  const c = config()
  configure(devCookieAuth('tectona-spa', true, { ...targets, idea: 'http://127.0.0.1:18511' }), c)
  const key = Object.keys(c.server.proxy ?? {})[0]
  const proxy = proxyFor(c, key)
  assert.equal(key, '^/api/gateway-runtime/api/idea-backlog/v1/(ideas|folders)(?:/|[?]|$)')
  assert.equal(proxy.target, 'http://127.0.0.1:18511')
  assert.equal(proxy.ws, false)
  assert.equal(proxy.rewrite?.(path), '/api/idea-backlog/v1/ideas?workspace_id=demo')
  assert.equal(proxyFor(c, '/api/gateway-runtime').target, 'http://localhost:8084')
  assert.equal(proxyFor(c, '/api/gateway-runtime').ws, false)
})
test('no opt-in means no added route', () => {
  const c = config(); configure(devCookieAuth('tectona-spa', true, targets), c)
  assert.deepEqual(Object.keys(c.server.proxy ?? {}), ['/api/gateway-runtime'])
})
for (const target of ['http://localhost:18511', 'http://127.0.0.1:8511', 'https://evil.example', '']) {
  test(`wrong sidecar target rejected: ${target}`, () => assert.throws(() => devCookieAuth('tectona-spa', true, { ...targets, idea: target })))
}
test('idea option requires scoped mode', () => assert.throws(() => devCookieAuth('tectona-spa', false, { ...targets, idea: 'http://127.0.0.1:18511' })))
test('idea option unavailable to Acacia', () => assert.throws(() => devCookieAuth('acacia-spa', true, { ...targets, idea: 'http://127.0.0.1:18511' })))
test('invalid Vite host rejected', () => { const c = config(); c.server.host = true; assert.throws(() => configure(devCookieAuth('tectona-spa', true, { ...targets, idea: 'http://127.0.0.1:18511' }), c)) })
test('HTTP middleware passes only prepared headers', () => {
  type Middleware = (request: IncomingMessage, response: ServerResponse, next: () => void) => void
  let middleware: Middleware | undefined
  const server = { middlewares: { use: (handler: Middleware) => { middleware = handler } } } as unknown as ViteDevServer
  const hook = devCookieAuth('tectona-spa', true, { ...targets, idea: 'http://127.0.0.1:18511' }).configureServer
  if (typeof hook !== 'function') throw new Error('Expected configureServer hook')
  hook.call({} as ThisParameterType<typeof hook>, server)
  assert.ok(middleware)
  const r = req(); let next = false
  middleware(r, {} as ServerResponse, () => { next = true })
  assert.equal(next, true); assert.equal(r.headers.cookie, undefined); assert.equal(r.headers.authorization, 'Bearer ' + token)
})

// Vite matches its proxy key against raw req.url, including the query string.
// A pathname-only assertion misses collection queries falling through to Gateway.
function firstProxyKey(value: ResolvedConfig, url: string): string | undefined {
  return Object.keys(value.server.proxy ?? {}).find(key => key.startsWith('^')
    ? new RegExp(key).test(url)
    : url.startsWith(key))
}
for (const suffix of [
  '/ideas', '/ideas?workspace_id=demo', '/ideas?workspace_id=demo&page=2',
  '/folders', '/folders?workspace_id=demo', '/folders?parent_id=null&workspace_id=demo',
  '/ideas/object?include_mine=false', '/ideas/object/summary?workspace_id=demo',
]) {
  test(`raw URL selects protected sidecar before Gateway: ${suffix}`, () => {
    const c = config()
    configure(devCookieAuth('tectona-spa', true, { ...targets, idea: 'http://127.0.0.1:18511' }), c)
    const selected = firstProxyKey(c, root + suffix)
    assert.ok(selected)
    assert.equal(proxyFor(c, selected).target, 'http://127.0.0.1:18511')
    assert.notEqual(selected, '/api/gateway-runtime')
  })
}
for (const suffix of ['/ideas-evil?workspace_id=demo', '/folders-evil', '/other?workspace_id=demo']) {
  test(`wrong resource is denied even if broad Gateway would match: ${suffix}`, () => {
    const c = config()
    configure(devCookieAuth('tectona-spa', true, { ...targets, idea: 'http://127.0.0.1:18511' }), c)
    assert.equal(run(req(root + suffix)).status, 403)
    assert.equal(firstProxyKey(c, root + suffix), '/api/gateway-runtime')
  })
}