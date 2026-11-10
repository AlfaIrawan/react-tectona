import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/index.css'
import '@/tectona-themes.css'
import { WorkspaceDemoPage } from './WorkspaceDemoPage'

if (import.meta.env.DEV) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <WorkspaceDemoPage />
    </StrictMode>,
  )
}
