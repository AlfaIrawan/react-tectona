import { ensureFreshSession, getSession, clearSession, validateActiveServerSessionIfDue, notifySessionExpiredIfNeeded } from '@/auth/authService'
import { recordApiFailure } from '@/lib/platformHealth/recentApiFailureStore'
import { fetchWithNetworkRecovery } from './networkRecovery'

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

/**
 * Path prefixes served by CloudFront with Origin Access Control in front of a Lambda Function
 * URL (AWS Dev). OAC signs the origin request with SigV4 but cannot hash the body itself, so
 * POST/PUT/PATCH must carry x-amz-content-sha256 or the Function URL rejects them. Empty in
 * every other environment, which leaves requests exactly as they were.
 */
export function parseOacSignedPathPrefixes(raw?: string | null): string[] {
  return (raw ?? '')
    .split(',')
    .map((part) => part.trim().replace(/\/+$/, ''))
    .filter(Boolean)
    .map((part) => (part.startsWith('/') ? part : `/${part}`))
}

const OAC_SIGNED_PATH_PREFIXES = parseOacSignedPathPrefixes(
  import.meta.env.VITE_OAC_SIGNED_PATH_PREFIXES as string | undefined,
)

const OAC_BODY_METHODS = new Set(['POST', 'PUT', 'PATCH'])

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function bodyBytes(body: BodyInit | null | undefined): Promise<ArrayBuffer | Uint8Array | null> {
  if (body == null) return new Uint8Array(0)
  if (typeof body === 'string') return new TextEncoder().encode(body)
  if (body instanceof URLSearchParams) return new TextEncoder().encode(body.toString())
  if (body instanceof ArrayBuffer) return body
  if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body.arrayBuffer()
  // FormData / streams: the browser picks the final bytes (multipart boundary), so we cannot hash them.
  return null
}

/**
 * Hex SHA-256 of the request body when the request goes to an OAC-signed prefix with a body
 * method; otherwise null. Exported for tests.
 */
export async function oacContentSha256(
  input: RequestInfo | URL,
  init?: RequestInit,
  prefixes: string[] = OAC_SIGNED_PATH_PREFIXES,
): Promise<string | null> {
  if (!prefixes.length || typeof crypto === 'undefined' || !crypto.subtle) return null
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  if (!OAC_BODY_METHODS.has(method)) return null
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  const raw = input instanceof Request ? input.url : String(input)
  let url: URL
  try {
    url = new URL(raw, origin)
  } catch {
    return null
  }
  if (url.origin !== origin) return null
  const matches = prefixes.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))
  if (!matches) return null
  const bytes = await bodyBytes(init?.body)
  if (!bytes) return null
  return toHex(await crypto.subtle.digest('SHA-256', bytes as BufferSource))
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
  if (session?.token || session?.cookieSession) {
    await validateActiveServerSessionIfDue()
  }

  const contentSha256 = await oacContentSha256(input, init)
  const requestHeaders = (accessToken?: string): Headers => {
    const headers = mergeRequestHeaders(accessToken, init)
    if (contentSha256) headers.set('x-amz-content-sha256', contentSha256)
    return headers
  }

  const doFetch = async (accessToken?: string) => {
    // Respect a caller-supplied signal (e.g. for cancellable uploads) instead of racing it
    // against our own timeout — only install a timeout when the caller didn't ask to control it.
    if (init?.signal) {
      return fetchWithNetworkRecovery(input, { ...init, headers: requestHeaders(accessToken) })
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetchWithNetworkRecovery(input, {
        ...init,
        headers: requestHeaders(accessToken),
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

  if (isUnauthenticated(response) && (session?.refreshToken || session?.cookieSession)) {
    session = await ensureFreshSession({ force: true })
    if (session) {
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

/**
 * A web server's own HTML error page (nginx "405 Not Allowed", a proxy's "502 Bad Gateway") is not
 * an API answer: showing its markup told the user nothing (a failed idea delete printed the whole
 * nginx page in red). Say what happened and what to do instead.
 */
export function htmlErrorPageMessage(body: string): string | null {
  if (!/^\s*<(?:!doctype|html|head|body)\b/i.test(body)) return null
  const title = body.match(/<title>\s*([^<]{1,120}?)\s*<\/title>/i)?.[1]
  return `The server returned an error page${title ? ` (${title})` : ''} instead of a response. `
    + 'Reload the page and try again; if it keeps happening, contact the administrator.'
}

/** Extract a human-readable message from FastAPI / JSON API error bodies. */
export function parseApiErrorMessage(body: string, fallback = 'Request failed'): string {
  const trimmed = body.trim()
  if (!trimmed) return fallback
  const htmlPage = htmlErrorPageMessage(trimmed)
  if (htmlPage) return htmlPage

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
