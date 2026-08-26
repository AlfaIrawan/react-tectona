import { ensureFreshSession, getSession, clearSession, validateActiveServerSessionIfDue, notifySessionExpiredIfNeeded } from '@/auth/authService'
import { recordApiFailure } from '@/lib/platformHealth/recentApiFailureStore'

/** Attach Bearer token when present. */
export function authHeadersForToken(token?: string | null, extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(extra as Record<string, string> | undefined),
  }
  const resolved = token?.trim()
  if (resolved) {
    headers.Authorization = `Bearer ${resolved}`
  }
  return headers
}

/** Attach Bearer token from identity-lite session when present. */
export function authHeaders(extra?: HeadersInit): HeadersInit {
  return authHeadersForToken(getSession()?.token, extra)
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

/**
 * Merge caller headers with auth headers. Caller-supplied Authorization is ignored because
 * apiFetch may refresh tokens after headers were captured (e.g. tectonaServiceHeaders()).
 */
function mergeRequestHeaders(accessToken: string | undefined, init?: RequestInit): Headers {
  const merged = new Headers(init?.headers)
  merged.delete('Authorization')
  const auth = authHeadersForToken(accessToken)
  return mergeHeaders(auth, merged)
}

/** 401 = unauthenticated; 403 is often authorization and must not clear the session. */
function isUnauthenticated(response: Response): boolean {
  return response.status === 401
}

/** Default request timeout — matches the convention already used for agent-runtime calls
 * (see `fetchWithTimeout` in tectonaAgentRuntimeApi.ts). Without this, a backend call that
 * stalls (rather than erroring) leaves the caller's promise unsettled forever — the classic
 * symptom being an action button stuck on "Running..." with no visible error. */
const DEFAULT_API_FETCH_TIMEOUT_MS = 60_000

/**
 * Fetch with proactive token refresh and one 401 retry after forced refresh.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_API_FETCH_TIMEOUT_MS,
): Promise<Response> {
  let session = await ensureFreshSession()
  if (session?.token) {
    await validateActiveServerSessionIfDue()
  }

  const doFetch = async (accessToken?: string) => {
    // Respect a caller-supplied signal (e.g. for cancellable uploads) instead of racing it
    // against our own timeout — only install a timeout when the caller didn't ask to control it.
    if (init?.signal) {
      return fetch(input, { ...init, headers: mergeRequestHeaders(accessToken, init) })
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(input, {
        ...init,
        headers: mergeRequestHeaders(accessToken, init),
        signal: controller.signal,
      })
    } catch (error) {
      if (controller.signal.aborted) {
        const timeoutError = new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s. Please try again.`)
        recordApiFailure(input, timeoutError)
        throw timeoutError
      }
      recordApiFailure(input, error)
      throw error
    } finally {
      window.clearTimeout(timer)
    }
  }

  let response = await doFetch(session?.token)

  if (isUnauthenticated(response) && session?.refreshToken) {
    session = await ensureFreshSession({ force: true })
    if (session?.token) {
      response = await doFetch(session.token)
    }
  }

  if (isUnauthenticated(response) && getSession()) {
    clearSession()
    notifySessionExpiredIfNeeded({ reason: 'unauthorized' })
  }

  if (!response.ok && response.status >= 500) {
    recordApiFailure(input, new Error(`HTTP ${response.status}`), response.status)
  }

  return response
}

/** Extract a human-readable message from FastAPI / JSON API error bodies. */
export function parseApiErrorMessage(body: string, fallback = 'Request failed'): string {
  const trimmed = body.trim()
  if (!trimmed) return fallback

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (typeof parsed === 'string') return parsed
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>
      const detail = record.detail
      if (typeof detail === 'string') return detail
      if (Array.isArray(detail)) {
        const parts = detail
          .map((item) => {
            if (typeof item === 'string') return item
            if (item && typeof item === 'object' && 'msg' in item) {
              return String((item as { msg: unknown }).msg)
            }
            return null
          })
          .filter((part): part is string => Boolean(part))
        if (parts.length > 0) return parts.join('; ')
      }
      if (typeof record.message === 'string') return record.message
      if (typeof record.error === 'string') return record.error
      const nestedError = record.error
      if (nestedError && typeof nestedError === 'object') {
        const nestedMessage = (nestedError as { message?: unknown }).message
        if (typeof nestedMessage === 'string' && nestedMessage.trim()) return nestedMessage
      }
    }
  } catch {
    // not JSON — use raw body below
  }

  return trimmed
}
