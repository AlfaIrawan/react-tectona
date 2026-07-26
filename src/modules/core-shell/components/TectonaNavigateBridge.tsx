import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/** Listens for assistant `app.navigate` actions and routes within the SPA. */
export function TectonaNavigateBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ pathname?: string; search?: string | null }>).detail
      const pathname = detail?.pathname?.trim()
      if (!pathname?.startsWith('/')) return
      navigate({ pathname, search: detail.search ?? undefined })
    }
    window.addEventListener('tectona:navigate', handler)
    return () => window.removeEventListener('tectona:navigate', handler)
  }, [navigate])

  return null
}
