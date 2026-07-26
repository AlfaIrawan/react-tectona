import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

const stripGatewayRuntime = (p: string) => p.replace(/^\/api\/gateway-runtime/, '')

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['vite.svg', 'images/logo.png', 'images/logo-white.png', 'ui-manifest.json'],
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
        globPatterns: ['**/*.{js,css,html,ico,svg,woff,woff2,json,webmanifest}'],
        globIgnores: ['**/images/background-*.png'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        // Keep Vite/dev module graph and API off the SPA fallback.
        navigateFallbackDenylist: [/^\/api\//, /^\/src\//, /^\/@/, /^\/node_modules\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.destination === 'image' || url.pathname.startsWith('/images/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tectona-static-images',
              expiration: {
                maxEntries: 160,
                maxAgeSeconds: 60 * 60 * 24 * 30,
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
        rewrite: (p) => p.replace(/^\/api\/identity-lite/, ''),
      },
      '/api/workspace-access-control': {
        target: 'http://localhost:8421',
        changeOrigin: true,
      },
      '/api/workspace-org': {
        target: 'http://localhost:8424',
        changeOrigin: true,
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
      // NOTE: '/api/work-integration' MUST come before '/api/work' — Vite matches
      // proxy keys by prefix in order, and '/api/work' would otherwise capture
      // '/api/work-integration/*' and send it to 8432 (wrong service → 404).
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
      '/api/notification-service': {
        target: 'http://localhost:8700',
        changeOrigin: true,
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
