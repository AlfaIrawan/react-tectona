/**
 * AWS Dev: CloudFront Origin Access Control (OAC) signs requests to Lambda Function URLs with
 * SigV4 but cannot hash the body, so POST/PUT/PATCH to an OAC-signed prefix must carry
 * x-amz-content-sha256. Shared by apiFetch, fetchWithTimeout and the raw-fetch API clients.
 */
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

/** Return `init` with x-amz-content-sha256 added when the request needs it (no-op elsewhere). */
export async function withOacContentSha256<T extends RequestInit | undefined>(
  input: RequestInfo | URL,
  init: T,
): Promise<T> {
  const digest = await oacContentSha256(input, init ?? undefined)
  if (!digest) return init
  const headers = new Headers(init?.headers)
  if (!headers.has('x-amz-content-sha256')) headers.set('x-amz-content-sha256', digest)
  return { ...(init ?? {}), headers } as T
}
