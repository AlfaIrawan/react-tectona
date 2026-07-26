const DEFAULT_POST_LOGIN_PATH = '/workspace-management'

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