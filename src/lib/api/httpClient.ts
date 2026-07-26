import { ensureFreshSession, getSession, logout } from '@/auth/authService'
import { emitSessionExpired } from '@/auth/sessionEvents'

/** Attach Bearer token from identity-lite session when present. */
export function authHeaders(extra?: HeadersInit): HeadersInit {
  const session = getSession()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(extra as Record<string, string> | undefined),
  }
  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`
  }
  return headers
}

/**
 * Auth headers plus the acting user's id/name, WITHOUT forcing a JSON Content-Type — use for
 * multipart/form-data requests (e.g. file uploads) where the browser must set the boundary itself.
 */
export function actorHeaders(extra?: Record<string, string>): HeadersInit {
  const session = getSession()
  return authHeaders({
    'X-Actor-Id': session?.user.id ?? 'anonymous',
    'X-Actor-Name': session?.user.name ?? session?.user.email ?? 'anonymous',
    ...extra,
  })
}

/** Standard headers for Tectona backend calls (includes JWT when logged in). */
export function tectonaServiceHeaders(extra?: Record<string, string>): HeadersInit {
  const session = getSession()
  return authHeaders({
    'Content-Type': 'application/json',
    'X-App-Sub': 'tectona-ui',
    'X-App-Role': session?.user.role ?? 'member',
    'X-Actor-Id': session?.user.id ?? 'anonymous',
    'X-Actor-Name': session?.user.name ?? session?.user.email ?? 'anonymous',
    ...extra,
  })
}

function mergeHeaders(base: HeadersInit, extra?: HeadersInit): Headers {
  const merged = new Headers(base)
  if (extra) {
    new Headers(extra).forEach((value, key) => merged.set(key, value))
  }
  return merged
}

/** 401 = unauthenticated; 403 is often authorization and must not clear the session. */
function isUnauthenticated(response: Response): boolean {
  return response.status === 401
}

/**
 * Fetch with proactive token refresh and one 401 retry after forced refresh.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  await ensureFreshSession()

  const doFetch = () => {
    const headers = mergeHeaders(authHeaders(), init?.headers)
    return fetch(input, { ...init, headers })
  }

  let response = await doFetch()

  if (isUnauthenticated(response)) {
    const session = getSession()
    if (session?.refreshToken) {
      const refreshed = await ensureFreshSession({ force: true })
      if (refreshed) {
        response = await doFetch()
      }
    }
  }

  if (isUnauthenticated(response)) {
    logout()
    emitSessionExpired({ reason: 'unauthorized' })
  }

  return response
}
