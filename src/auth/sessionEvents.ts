/** Dispatched when refresh fails and the user must sign in again. */
export const SESSION_EXPIRED_EVENT = 'tectona:session-expired'

/** Dispatched after a successful login (or restored session on app load). */
export const SESSION_ACTIVE_EVENT = 'tectona:session-active'

export function emitSessionActive(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SESSION_ACTIVE_EVENT))
}

export function onSessionActive(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener(SESSION_ACTIVE_EVENT, handler)
  return () => window.removeEventListener(SESSION_ACTIVE_EVENT, handler)
}

export function emitSessionExpired(detail?: { reason?: string }): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail }))
}

export function onSessionExpired(handler: (detail?: { reason?: string }) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const listener = (event: Event) => {
    const custom = event as CustomEvent<{ reason?: string }>
    handler(custom.detail)
  }
  window.addEventListener(SESSION_EXPIRED_EVENT, listener)
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, listener)
}
