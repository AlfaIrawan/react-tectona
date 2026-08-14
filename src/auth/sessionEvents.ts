/** Dispatched when refresh fails and the user must sign in again. */
export const SESSION_EXPIRED_EVENT = 'tectona:session-expired'

/** Dispatched after a successful login (or restored session on app load). */
export const SESSION_ACTIVE_EVENT = 'tectona:session-active'

/** Dispatched when the local session is cleared (sign out). */
export const SESSION_CLEARED_EVENT = 'tectona:session-cleared'

/** Dispatched after access/refresh tokens are rotated in-place (same browser tab). */
export const SESSION_TOKEN_REFRESHED_EVENT = 'tectona:session-token-refreshed'

export function emitSessionActive(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SESSION_ACTIVE_EVENT))
}

export function emitSessionCleared(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SESSION_CLEARED_EVENT))
}

export function onSessionActive(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener(SESSION_ACTIVE_EVENT, handler)
  return () => window.removeEventListener(SESSION_ACTIVE_EVENT, handler)
}

export function onSessionCleared(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener(SESSION_CLEARED_EVENT, handler)
  return () => window.removeEventListener(SESSION_CLEARED_EVENT, handler)
}

export function emitSessionTokenRefreshed(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SESSION_TOKEN_REFRESHED_EVENT))
}

export function onSessionTokenRefreshed(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener(SESSION_TOKEN_REFRESHED_EVENT, handler)
  return () => window.removeEventListener(SESSION_TOKEN_REFRESHED_EVENT, handler)
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
