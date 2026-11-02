import type { IncomingMessage, ClientRequest } from 'node:http'
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

export function devCookieAuth(): Plugin {
  return {
    name: 'tectona-dev-cookie-auth',
    apply: 'serve',
    configResolved(config) {
      for (const [prefix, options] of Object.entries(config.server.proxy ?? {})) {
        if (!prefix.startsWith('/api/') || typeof options === 'string') continue
        const configure = options.configure
        options.configure = (proxy, proxyOptions) => {
          configure?.(proxy, proxyOptions)
          proxy.on('proxyReq', forwardCookieAuthorization)
          proxy.on('proxyReqWs', forwardCookieAuthorization)
        }
      }
    },
  }
}
