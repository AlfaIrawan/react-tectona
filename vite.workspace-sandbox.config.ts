import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { devCookieAuth } from './scripts/dev-cookie-auth'

const scenarios = ['enterprise', 'smb', 'startup']

export default defineConfig(({ command }) => {
  const scenario = process.env.TECTONA_WORKSPACE_SCENARIO
  const index = scenarios.indexOf(scenario ?? '')
  if (command !== 'serve' || index < 0) {
    throw new Error('Set TECTONA_WORKSPACE_SCENARIO to enterprise, smb or startup for local development.')
  }

  const hostname = `${scenario}.localhost`
  const port = 9561 + index
  const origin = `http://${hostname}:${port}`
  const services = [
    ['/api/identity-lite', 19611],
    ['/api/workspace-org', 19612],
    ['/api/workspace-access-control', 19613],
  ] as const

  return {
    envDir: false,
    envPrefix: 'TECTONA_SANDBOX_UNUSED_',
    cacheDir: path.resolve(__dirname, 'node_modules', `.vite-workspace-sandbox-${scenario}`),
    define: {
      __APP_VERSION__: JSON.stringify('Workspace sandbox'),
      __APP_BUILD_HASH__: JSON.stringify('sandbox'),
      'import.meta.env.VITE_AUTH_PROVIDERS': JSON.stringify('password'),
      'import.meta.env.VITE_WORKSPACE_ORG_API_URL': JSON.stringify('/api/workspace-org'),
      'import.meta.env.VITE_WORKSPACE_ACCESS_CONTROL_API_URL': JSON.stringify('/api/workspace-access-control'),
      'import.meta.env.VITE_WORKSPACE_SANDBOX': JSON.stringify(scenario),
    },
    plugins: [
      react(),
      devCookieAuth(),
      {
        name: 'tectona-workspace-sandbox-boundary',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.headers.host !== `${hostname}:${port}`) {
              res.writeHead(421).end('Use the assigned sandbox localhost address.')
              return
            }
            if (req.url?.startsWith('/api/') && !services.some(([prefix]) => req.url?.startsWith(prefix + '/'))) {
              res.writeHead(404, { 'Content-Type': 'application/json' }).end('{"error":"unavailable_in_workspace_sandbox"}')
              return
            }
            res.setHeader('Content-Security-Policy', [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "media-src 'self' blob:",
              "worker-src 'self' blob:",
              `connect-src ${origin} ws://${hostname}:${port}`,
              "form-action 'self'",
            ].join('; '))
            next()
          })
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        'virtual:pwa-register': path.resolve(__dirname, 'src/test/virtualPwaRegister.ts'),
      },
    },
    server: {
      host: '127.0.0.1',
      port,
      strictPort: true,
      hmr: { host: hostname, clientPort: port },
      proxy: Object.fromEntries(services.map(([prefix, basePort]) => [
        prefix, {
          target: `http://127.0.0.1:${basePort + index * 10}`,
          rewrite: prefix === '/api/identity-lite'
            ? (requestPath: string) => requestPath.startsWith(prefix + '/v1/') ? requestPath : requestPath.slice(prefix.length)
            : undefined,
        },
      ])),
    },
  }
})
