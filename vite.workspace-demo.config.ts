import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => {
  if (command !== 'serve') throw new Error('Workspace fixtures are available on the local development server only.')

  const source = path.resolve(__dirname, 'src')
  return {
    root: path.join(source, 'modules/workspace-management/demo'),
    cacheDir: path.resolve(__dirname, 'node_modules/.vite-workspace-demo'),
    appType: 'mpa',
    envDir: false,
    publicDir: false,
    plugins: [react()],
    resolve: { alias: { '@': source } },
    server: {
      host: '127.0.0.1',
      port: 5497,
      strictPort: true,
      fs: { allow: [source, path.resolve(__dirname, 'node_modules')] },
    },
  }
})
