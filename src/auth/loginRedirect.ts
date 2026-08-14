const DEFAULT_POST_LOGIN_PATH = '/projects'

export type LoginAuthNotice =
  | 'session_expired'
  | 'session_revoked_elsewhere'
  | 'oauth_signin_retry'
  | 'account_already_exists'
  | 'account_not_registered'
  | 'check_email'
  | 'email_verified'

/**
 * Resolve a safe in-app path after login. Strips nested /login?next=... chains from redirect loops.
 */
export function sanitizePostLoginPath(
  raw: string | null | undefined,
  fallback = DEFAULT_POST_LOGIN_PATH,
): string {
  if (!raw?.trim()) return fallback

  let candidate = raw.trim()
  for (let depth = 0; depth < 8; depth += 1) {
    if (!candidate.startsWith('/login')) {
      break
    }
    try {
      const queryIndex = candidate.indexOf('?')
      const query = queryIndex >= 0 ? candidate.slice(queryIndex + 1) : ''
      const inner = new URLSearchParams(query).get('next')
      if (!inner) return fallback
      candidate = decodeURIComponent(inner)
    } catch {
      return fallback
    }
  }

  if (!candidate.startsWith('/') || candidate.startsWith('/login')) {
    return fallback
  }
  return candidate
}

export function buildLoginSearchParams(options: {
  next?: string | null
  reason?: string
}): URLSearchParams {
  const params = new URLSearchParams()
  const safeNext = sanitizePostLoginPath(options.next)
  params.set('next', safeNext)
  if (options.reason) {
    params.set('reason', options.reason)
  }
  return params
}

/** Map session-loss event detail → login `reason` query (undefined = no banner). */
export function resolveLoginAuthNoticeReason(detail?: { reason?: string }): LoginAuthNotice | undefined {
  if (
    detail?.reason === 'session_revoked_elsewhere'
    || detail?.reason === 'session_revoked'
  ) {
    return 'session_revoked_elsewhere'
  }
  if (
    detail?.reason === 'expired'
    || detail?.reason === 'no_refresh_token'
    || detail?.reason === 'refresh_failed'
    || detail?.reason === 'unauthorized'
    || detail?.reason === 'session_expired'
  ) {
    return 'session_expired'
  }
  return undefined
}

export function parseLoginAuthNotice(raw: string | null | undefined): LoginAuthNotice | undefined {
  if (
    raw === 'session_revoked_elsewhere'
    || raw === 'session_expired'
    || raw === 'oauth_signin_retry'
    || raw === 'account_already_exists'
    || raw === 'account_not_registered'
    || raw === 'check_email'
    || raw === 'email_verified'
  ) {
    return raw
  }
  return undefined
}

/** Intentional sign-out — never attach `reason` (no banner on login). */
export function buildLoginPathAfterSignOut(next?: string | null): string {
  if (!next?.trim()) return '/login'
  const params = new URLSearchParams()
  params.set('next', sanitizePostLoginPath(next))
  return `/login?${params.toString()}`
}