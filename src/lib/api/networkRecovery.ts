function aborted(signal?: AbortSignal | null): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Request aborted', 'AbortError')
}

function pause(ms: number, signal?: AbortSignal | null): Promise<void> {
  aborted(signal)
  return new Promise((resolve, reject) => {
    const finish = () => { signal?.removeEventListener('abort', cancel); resolve() }
    const timer = setTimeout(finish, ms)
    const cancel = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); reject(signal?.reason ?? new DOMException('Request aborted', 'AbortError')) }
    signal?.addEventListener('abort', cancel, { once: true })
  })
}

/** Retry a failed read once; never replay writes or HTTP authorization failures. */
export async function fetchWithNetworkRecovery(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = typeof Request !== 'undefined' && input instanceof Request ? input : undefined
  const method = (init?.method ?? request?.method ?? 'GET').toUpperCase()
  const signal = init?.signal ?? request?.signal
  aborted(signal)
  try {
    return await fetch(input, init)
  } catch (error) {
    aborted(signal)
    const networkError = error instanceof TypeError && /failed to fetch|networkerror|load failed|fetch failed|network.changed/i.test(error.message)
    if (!networkError || !['GET', 'HEAD'].includes(method)) throw error
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw error
    await pause(600, signal)
    aborted(signal)
    return fetch(input, init)
  }
}
