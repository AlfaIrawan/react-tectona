export class FetchTimeoutError extends Error {
  constructor(message = 'identity_service_timeout') {
    super(message)
    this.name = 'FetchTimeoutError'
  }
}

const DEFAULT_TIMEOUT_MS = 15_000

/** fetch with AbortController timeout — avoids hung auth when identity-lite is down. */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const { timeoutMs: _omit, ...fetchInit } = init ?? {}
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...fetchInit, signal: controller.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new FetchTimeoutError()
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
