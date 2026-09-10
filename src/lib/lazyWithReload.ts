import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

const STALE_CHUNK_RELOAD_KEY = 'tectona:stale-chunk-reload'

export function isStaleChunkError(err: unknown): boolean {
  const name = err instanceof Error ? err.name : ''
  const message = err instanceof Error ? err.message : String(err ?? '')
  return (
    name === 'ChunkLoadError'
    || /Failed to fetch dynamically imported module/i.test(message)
    || /error loading dynamically imported module/i.test(message)
    || /Importing a module script failed/i.test(message)
    || /Loading chunk [\w.-]+ failed/i.test(message)
    || /Unable to preload CSS/i.test(message)
  )
}

export function clearStaleChunkReloadFlag(): void {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(STALE_CHUNK_RELOAD_KEY)
}

/** Reload once after a deploy leaves the current tab with hashed /assets/* that 404. */
export function reloadOnceForStaleChunk(err: unknown): boolean {
  if (typeof window === 'undefined' || !isStaleChunkError(err)) return false
  if (sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY) === '1') return false
  sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, '1')
  window.location.reload()
  return true
}

/**
 * React.lazy wrapper: retry a failed route chunk, then hard-reload once.
 * Without this, a 404 on DocumentKnowledgeManagementPage-*.js unmounts the whole tree (white screen).
 */
export function lazyWithReload<P extends object>(
  importer: () => Promise<{ default: ComponentType<P> }>,
): LazyExoticComponent<ComponentType<P>> {
  return lazy(async () => {
    try {
      const loaded = await importer()
      clearStaleChunkReloadFlag()
      return loaded
    } catch (first) {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 350)
      })
      try {
        const loaded = await importer()
        clearStaleChunkReloadFlag()
        return loaded
      } catch (second) {
        reloadOnceForStaleChunk(second)
        throw second
      }
    }
  })
}
