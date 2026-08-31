import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'

const stripGatewayRuntime = (p: string) => p.replace(/^\/api\/gateway-runtime/, '')

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))

function gitShortHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim()
  } catch {
    return 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version as string),
    __APP_BUILD_HASH__: JSON.stringify(gitShortHash()),
  },
  plugins: [
    react(),
    {
      name: 'tectona-cache-background-media-dev',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.match(/^\/images\/background-.*\.(mp4|png|webp)$/i)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          }
          next()
        })
      },
    },
    VitePWA({
      // Activate a newly deployed worker automatically. Prompt mode left the
      // previous worker active indefinitely, so browsers could keep serving an
      // old hashed JS bundle after a deployment.
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: [
        'vite.svg',
        'images/logo.png',
        'images/logo-white.png',
        'images/background-1.mp4',
        'ui-manifest.json',
      ],
      manifest: {
        id: '/',
        name: 'Tectona — Project Management',
        short_name: 'Tectona',
        description: 'Tectona project management platform for Adira Dinamika Multifinance.',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: '/images/logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/images/logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/images/logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cacheId: 'tectona-direct-agent-runtime',
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,svg,woff,woff2,json,webmanifest,png,webp}'],
        // Large illustration packs stay network-first via runtime rule scope (/images/ only).
        globIgnores: [
          '**/images/project-templates/**',
          '**/images/project-templates-section/**',
          // This 6.84 MiB hero image is served through the image runtime cache,
          // not precached into the service worker manifest.
          '**/images/background-1.png',
        ],
        additionalManifestEntries: [
          { url: '/images/background-1.mp4', revision: null },
        ],
        // Main app chunk can exceed 3 MiB after feature growth; Workbox default is 2 MiB.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        // Keep Vite/dev module graph and API off the SPA fallback.
        navigateFallbackDenylist: [/^\/api\//, /^\/src\//, /^\/@/, /^\/node_modules\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Background/login hero video.
            // Do not import workbox-* plugin classes in this config — on Node 20.17
            // Vite fails to load the config (CJS/ESM mismatch → exit 1). Use
            // declarative cacheableResponse instead; Range seeks hit network.
            urlPattern: ({ sameOrigin, url }) =>
              sameOrigin &&
              url.pathname.startsWith('/images/') &&
              /\.(mp4|webm|mov|m4v)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tectona-background-media',
              expiration: {
                maxEntries: 8,
                maxAgeSeconds: 60 * 60 * 24 * 90,
              },
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
          {
            // Same-origin static UI only — do not cache MinIO/chat/API image URLs.
            urlPattern: ({ sameOrigin, url }) =>
              sameOrigin &&
              url.pathname.startsWith('/images/') &&
              !/\.(mp4|webm|mov|m4v)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tectona-static-images',
              expiration: {
                maxEntries: 160,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Same-origin /api only. Matching every host with pathname /api/
            // (e.g. localhost:8084, :8432) makes Workbox NetworkOnly throw
            // uncaught `no-response` when those backends are down.
            urlPattern: ({ sameOrigin, url }) =>
              sameOrigin && url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    allowedHosts: ['host.docker.internal'],
    host: true,
    port: 9411,
    strictPort: true,
    proxy: {
      // Laurus API Gateway runtime — Tectona API clients use /api/gateway-runtime/...
      '/api/gateway-runtime': {
        target: 'http://localhost:8084',
        changeOrigin: true,
        ws: true,
        rewrite: stripGatewayRuntime,
      },
      // Gateway control plane (admin / teams) — optional
      '/api/gateway': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/api\/gateway/, ''),
      },
      // Shared Identity Lite (Ilex) — login / OIDC (not via gateway-runtime)
      '/api/identity-lite': {
        target: 'http://localhost:8430',
        changeOrigin: true,
        ws: true,
        // OIDC lives at /oauth2/*; REST admin/register at /api/identity-lite/v1/*
        rewrite: (p) =>
          p.startsWith('/api/identity-lite/v1')
            ? p
            : p.replace(/^\/api\/identity-lite/, ''),
      },
      '/api/workspace-access-control': {
        target: 'http://localhost:8421',
        changeOrigin: true,
        ws: true,
      },
      '/api/workspace-org': {
        target: 'http://localhost:8424',
        changeOrigin: true,
        ws: true,
      },
      '/api/workspace-governance': {
        target: 'http://localhost:8428',
        changeOrigin: true,
      },
      '/api/governance-config': {
        target: 'http://localhost:8428',
        changeOrigin: true,
      },
      '/api/tectona-kb': {
        target: 'http://localhost:8415',
        changeOrigin: true,
      },
      '/api/tectona-knowledge-index': {
        target: 'http://localhost:8417',
        changeOrigin: true,
      },
      '/api/document-parser': {
        target: 'http://localhost:8427',
        changeOrigin: true,
      },
      '/api/tectona-voice': {
        // Direct to voice STT service — strip prefix so FastAPI sees /v1/voice/...
        // (service mounts at /v1/voice, not /api/tectona-voice/v1/...).
        target: 'http://127.0.0.1:8418',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/tectona-voice/, ''),
      },
      '/api/tectona-agent-runtime': {
        // Use IPv4 loopback explicitly so dev proxy hits the patched local runtime
        // instead of Docker's localhost IPv6 listener on the same port.
        target: 'http://127.0.0.1:8414',
        changeOrigin: true,
      },
      '/api/collaboration-context': {
        target: 'http://localhost:8429',
        changeOrigin: true,
        ws: true,
      },
      // NOTE: '/api/work-integration' and '/api/workflow-automation' MUST come before
      // '/api/work' — Vite matches proxy keys by prefix in order, and '/api/work' would
      // otherwise capture '/api/work-integration/*' and '/api/workflow-automation/*'
      // and send them to 8432 (wrong service → 404).
      '/api/workflow-automation': {
        target: 'http://localhost:8521',
        changeOrigin: true,
      },
      '/api/work-integration': {
        target: 'http://localhost:8433',
        changeOrigin: true,
      },
      '/api/work': {
        target: 'http://localhost:8432',
        changeOrigin: true,
        ws: true,
      },
      '/api/task-work-execution': {
        target: 'http://localhost:8432',
        changeOrigin: true,
      },
      '/api/registry-core': {
        target: 'http://localhost:8406',
        changeOrigin: true,
      },
      '/api/registry': {
        target: 'http://localhost:8405',
        changeOrigin: true,
      },
      '/api/notification-service': {
        target: 'http://localhost:8700',
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/api\/notification-service/, ''),
      },
      '/api/tectona-mail': {
        target: 'http://localhost:8434',
        changeOrigin: true,
      },
      '/api/tectona-activity': {
        target: 'http://localhost:8435',
        changeOrigin: true,
      },
      '/api/plantuml': {
        // plantuml-server's actual published host port is 8091 (see
        // ops/ubuntu-dev/compose/tectona-images.yml and infra-dev-domains.md) — this proxy
        // previously pointed at 8090, which nothing listens on, so every PlantUML PNG render
        // (C4 diagrams) silently 500'd.
        target: 'http://127.0.0.1:8091',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/plantuml/, ''),
      },
      '/onlyoffice-ds': {
        target: 'http://127.0.0.1:8085',
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/onlyoffice-ds/, '') || '/',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
})
