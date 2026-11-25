import type { IncomingMessage, ClientRequest, IncomingHttpHeaders } from 'node:http'
import type { Plugin } from 'vite'

/** Match the production Nginx cookie-to-Bearer bridge, on API proxies only. */
export function forwardCookieAuthorization(proxyReq: Pick<ClientRequest, 'setHeader'>, req: IncomingMessage): void {
  if (req.headers.authorization?.trim()) return
  const cookie = req.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith('idl_access='))
  const token = cookie?.slice('idl_access='.length)
  // Identity issues compact JWTs; never forward arbitrary cookie content as a header.
  if (token && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    proxyReq.setHeader('Authorization', `Bearer ${token}`)
  }
}

type LocalClient = 'acacia-spa' | 'tectona-spa'
type LocalRequest = Pick<IncomingMessage, 'headers' | 'rawHeaders' | 'url' | 'method'>
const COMPACT_JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
const IDENTITY = '/api/identity-lite'
const ORG = '/api/workspace-org'
const WAC = '/api/workspace-access-control'
const IDEA_PATH = /^\/api\/gateway-runtime\/api\/idea-backlog\/v1\/(ideas|folders)(?:\/|$)/
const IDEA_PROXY = '^/api/gateway-runtime/api/idea-backlog/v1/(ideas|folders)(?:/|[?]|$)'
const IDEA_TARGET = 'http://127.0.0.1:18511'
const IDEA_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
const QUERY_CREDENTIALS = new Set(['token', 'access_token', 'refresh_token', 'id_token', 'authorization'])

function pilotClient(token: string): unknown {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))?.w06_local
  } catch {
    return null
  }
}
const scopedPrefix = (client: LocalClient) => '/__w06/' + client.slice(0, -4)
const scopedHost = (client: LocalClient) => client === 'acacia-spa' ? 'localhost:9417' : 'localhost:9411'

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + '/')
}

function headerValues(req: LocalRequest, name: string): string[] {
  const values: string[] = []
  for (let index = 0; index < req.rawHeaders.length; index += 2) {
    if (req.rawHeaders[index].toLowerCase() === name) values.push(req.rawHeaders[index + 1])
  }
  return values
}

function credentialAudience(token: string): unknown {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))?.aud
  } catch {
    return null
  }
}

export function prepareLocalRequest(req: LocalRequest, client: LocalClient, websocket = false, ideaEnabled = false): {
  status: number
  headers?: IncomingHttpHeaders
} {
  const host = scopedHost(client)
  if (headerValues(req, 'host').length !== 1 || req.headers.host !== host) return {status: 403}
  const origin = 'http://' + host
  const origins = headerValues(req, 'origin')
  if (origins.length > 1 || (origins.length && origins[0] !== origin)) return {status: 403}
  if (websocket && origins[0] !== origin) return {status: 403}

  let url: URL
  try {
    if (!req.url?.startsWith('/') || req.url.startsWith('//')) return {status: 403}
    url = new URL(req.url, origin)
    const rawPath = req.url.split('?', 1)[0]
    if (url.origin !== origin || rawPath !== url.pathname || /%2e|%2f|%5c|%25/i.test(rawPath)) return {status: 403}
  } catch {
    return {status: 403}
  }
  const identity = matchesPrefix(url.pathname, IDENTITY)
  const workspace = matchesPrefix(url.pathname, ORG) || matchesPrefix(url.pathname, WAC)
  const idea = ideaEnabled && client === 'tectona-spa' && IDEA_PATH.test(url.pathname)
  if (idea && (websocket || !IDEA_METHODS.has(req.method ?? '') || url.pathname.includes('//')
    || [...url.searchParams.keys()].some(key => QUERY_CREDENTIALS.has(key.toLowerCase())))) return {status: 403}
  if (client === 'acacia-spa' && identity) {
    const oidc = new Set([
      '/oauth2/authorize', '/oauth2/token', '/oauth2/userinfo', '/oauth2/logout',
      '/oauth2/session/status', '/oauth2/session/bootstrap',
      '/oauth2/federation/microsoft/start',
    ])
    const relative = url.pathname.slice(IDENTITY.length)
    const internalUsers = /^\/v1\/internal-apps\/acacia-spa\/users(?:\/[0-9a-f-]+)?$/
    const permitted = oidc.has(relative) || relative === '/v1/internal-access/check'
      || internalUsers.test(relative) || relative === '/v1/ws/session'
    if (!permitted) return {status: 403}
  }
  if (!identity && !workspace && !idea) return {status: 403}
  if (websocket && (url.searchParams.has('token') || (client === 'acacia-spa' && workspace))) return {status: 403}

  const explicit = headerValues(req, 'authorization')
  let bearer: string | undefined
  if (explicit.length) {
    const match = explicit.length === 1 && /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(explicit[0])
    if (!match) return {status: 401}
    bearer = match[1]
    if (credentialAudience(bearer) !== client) return {status: 403}
  }
  if (!websocket && (!bearer || identity) && headerValues(req, 'sec-fetch-site').join(',') !== 'same-origin') {
    return {status: 403}
  }

  const access = 'idl_access_' + client
  const refresh = 'idl_refresh_' + client
  const selected = new Map<string, string>()
  for (const header of headerValues(req, 'cookie')) {
    for (const part of header.split(';')) {
      const entry = part.trim()
      const split = entry.indexOf('=')
      if (split < 0) continue
      const name = entry.slice(0, split)
      if (name !== access && !(identity && (name === refresh || name === 'idl_sso'))) continue
      const value = entry.slice(split + 1)
      if (!value || /\s/.test(value) || selected.has(name)) return {status: 401}
      selected.set(name, value)
    }
  }
  const cookieToken = selected.get(access)
  if (!bearer && cookieToken) {
    if (!COMPACT_JWT.test(cookieToken)) return {status: 401}
    // Unverified JWT parsing is deny-only. Services verify signature and current authority.
    if (credentialAudience(cookieToken) !== client) return {status: 403}
    if (!identity || (!websocket && url.pathname.startsWith(IDENTITY + '/v1/'))) bearer = cookieToken
  }
  if (idea && bearer && pilotClient(bearer) !== 'tectona-spa') return {status: 403}
  const headers = {...req.headers}
  delete headers.cookie
  delete headers.authorization
  delete headers['x-token-delivery']
  delete headers['x-w06-local-client']
  if (bearer) headers.authorization = 'Bearer ' + bearer
  if (identity) {
    if (url.searchParams.has('client_id') && url.searchParams.getAll('client_id').some(value => value !== client)) {
      return {status: 403}
    }
    if (url.searchParams.getAll('client_id').length > 1) return {status: 400}
    if (websocket && (bearer || !cookieToken)) return {status: 401}
    if (selected.size) headers.cookie = [...selected].map(([name, value]) => name + '=' + value).join('; ')
    headers['x-token-delivery'] = 'scoped-cookie'
    headers['x-w06-local-client'] = client
  } else if (!bearer) {
    return {status: 401}
  } else if (websocket) {
    headers['x-w06-local-client'] = client
  }
  return {status: 0, headers}
}

export function localIdentityPath(path: string, client: LocalClient): string {
  const url = new URL(path, 'http://' + scopedHost(client))
  if (['/oauth2/userinfo', '/oauth2/session/status', '/api/identity-lite/v1/ws/session'].includes(url.pathname)) {
    if (!url.searchParams.has('client_id')) url.searchParams.set('client_id', client)
  }
  return url.pathname + url.search
}

type LocalTargets = {identity?: string; org?: string; wac?: string; idea?: string}
const verifiedTargets = {
  identity: 'http://127.0.0.1:8430', org: 'http://127.0.0.1:8424', wac: 'http://127.0.0.1:8421',
} as const

export function devCookieAuth(client: LocalClient = 'tectona-spa', scoped = false, targets?: LocalTargets): Plugin {
  if (scoped && (!targets || targets.identity !== verifiedTargets.identity
    || targets.org !== verifiedTargets.org || targets.wac !== verifiedTargets.wac)) {
    throw new Error('W06 scoped mode requires the explicit verified loopback service targets')
  }
  const ideaEnabled = targets?.idea !== undefined
  if (ideaEnabled && (!scoped || client !== 'tectona-spa' || targets?.idea !== IDEA_TARGET)) {
    throw new Error('W06 Idea requires Tectona scoped mode and the explicit protected loopback target')
  }
  return {
    name: 'tectona-dev-cookie-auth',
    apply: 'serve',
    configureServer(server) {
      if (!scoped) return
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        const result = prepareLocalRequest(req, client, false, ideaEnabled)
        if (!result.headers) {
          res.statusCode = result.status
          res.setHeader('Cache-Control', 'no-store')
          res.end()
          return
        }
        req.headers = result.headers
        next()
      })
    },
    configResolved(config) {
      if (scoped && (config.server.host !== '127.0.0.1' || !config.server.strictPort
        || config.server.port !== Number(scopedHost(client).split(':')[1]))) {
        throw new Error('W06 scoped mode requires the exact localhost selector')
      }
      if (ideaEnabled) {
        // First match wins in Vite. Only this protected resource prefix bypasses Gateway.
        config.server.proxy = {
          [IDEA_PROXY]: {
            target: IDEA_TARGET, changeOrigin: true, ws: false,
            rewrite: path => path.replace(/^\/api\/gateway-runtime/, ''),
          },
          ...Object.fromEntries(Object.entries(config.server.proxy ?? {}).filter(([key]) => key !== IDEA_PROXY)),
        }
      }
      for (const [prefix, options] of Object.entries(config.server.proxy ?? {})) {
        if (!prefix.startsWith('/api/') || typeof options === 'string') continue
        const configure = options.configure
        if (scoped) {
          const rewrite = options.rewrite
          if (prefix === IDENTITY) options.target = verifiedTargets.identity
          if (prefix === ORG) options.target = verifiedTargets.org
          if (prefix === WAC) options.target = verifiedTargets.wac
          if (prefix === IDENTITY) {
            options.rewrite = path => scopedPrefix(client) + localIdentityPath(rewrite?.(path) ?? path, client)
          } else if (prefix === ORG || prefix === WAC) {
            options.rewrite = path => scopedPrefix(client) + (rewrite?.(path) ?? path)
          }
          if (client === 'acacia-spa' && (prefix === ORG || prefix === WAC)) {
            options.ws = false
          } else if (![IDENTITY, ORG, WAC].includes(prefix)) {
            options.ws = false
          }
          options.configure = (proxy, proxyOptions) => {
            configure?.(proxy, proxyOptions)
            proxy.on('proxyReqWs', (proxyReq, req, socket) => {
              const result = prepareLocalRequest(req, client, true, ideaEnabled)
              if (!result.headers) {
                proxyReq.destroy()
                socket.destroy()
                return
              }
              for (const name of ['cookie', 'authorization', 'x-token-delivery', 'x-w06-local-client']) {
                const value = result.headers[name]
                if (value === undefined) proxyReq.removeHeader(name)
                else proxyReq.setHeader(name, value)
              }
            })
          }
          continue
        }
        options.configure = (proxy, proxyOptions) => {
          configure?.(proxy, proxyOptions)
          proxy.on('proxyReq', forwardCookieAuthorization)
          proxy.on('proxyReqWs', forwardCookieAuthorization)
        }
      }
    },
  }
}
