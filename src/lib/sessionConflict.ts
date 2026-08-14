/** Thrown when identity-lite detects an active session on another device/browser. */
import { getClientEnvironment } from '@/lib/clientEnvironment'

export type ActiveSessionInfo = {
  session_id?: string
  started_at?: string
  device?: string | null
  browser?: string | null
  location?: string | null
}

export class SessionConflictError extends Error {
  readonly code = 'active_session_exists' as const
  readonly activeSession: ActiveSessionInfo

  constructor(activeSession: ActiveSessionInfo) {
    super('active_session_exists')
    this.name = 'SessionConflictError'
    this.activeSession = activeSession
  }
}

export class SessionRevokedError extends Error {
  readonly code = 'session_revoked' as const

  constructor(message?: string) {
    super(message ?? 'session_revoked')
    this.name = 'SessionRevokedError'
  }
}

export function isSessionConflictError(error: unknown): error is SessionConflictError {
  return error instanceof SessionConflictError
}

export function isSessionRevokedError(error: unknown): error is SessionRevokedError {
  return error instanceof SessionRevokedError
}

/** True when the server ended this session because the user signed in elsewhere. */
export function isRemoteSessionRevocationError(error: unknown): boolean {
  if (isSessionRevokedError(error)) return true
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('session_revoked') ||
    msg.includes('signed out because') ||
    msg.includes('signed in on another') ||
    msg.includes('sign in elsewhere') ||
    msg.includes('signed in elsewhere')
  )
}

export function formatActiveSessionStartedAt(startedAt?: string): string | null {
  if (!startedAt) return null
  const ms = Date.parse(startedAt)
  if (!Number.isFinite(ms)) return null
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(ms))
  } catch {
    return startedAt
  }
}

/**
 * Only prompt when the server session clearly belongs to another device/browser.
 * Orphan/stale tokens (unknown metadata or same device+browser) are replaced silently.
 */
export function shouldPromptSessionConflict(activeSession: ActiveSessionInfo): boolean {
  const current = getClientEnvironment()
  const activeDevice = activeSession.device?.trim()
  const activeBrowser = activeSession.browser?.trim()

  if (!activeDevice || activeDevice === 'Unknown device') return false
  if (!activeBrowser || activeBrowser === 'Unknown browser') return false

  if (activeDevice === current.device && activeBrowser === current.browser) return false

  return true
}
