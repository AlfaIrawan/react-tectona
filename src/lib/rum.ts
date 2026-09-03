import { onCLS, onINP, onLCP } from 'web-vitals'

const DEFAULT_SERVICE_ID = 'frontend-tectona'
/** Production / preview default; in Vite dev use same-origin + `/api/registry` proxy. */
// Browser production builds must never default to localhost: that points to
// the end user's machine, not the Ubuntu host. Nginx exposes the registry
// under the same-origin /api/registry path.
const DEFAULT_REGISTRY_BASE_URL = ''
const FLUSH_INTERVAL_MS = 15_000
const MAX_REASONABLE_LCP_MS = 60_000
const MAX_REASONABLE_INP_MS = 60_000

type WebVitalName = 'lcp' | 'inp' | 'cls'

type RumBucket = {
  lcpMs: number | null
  inpMs: number | null
  clsScore: number | null
  dirtyVitals: Record<WebVitalName, boolean>
  apiLatencySamples: number[]
  pageViewCount: number
  jsErrorCount: number
}

type RumPayload = {
  lcp_ms: number | null
  inp_ms: number | null
  cls_score: number | null
  api_latency_ms: number | null
  api_latency_sample_count: number
  page_view_count: number
  js_error_count: number
  collected_at: string
}

type WebVitalMetric = {
  value: number
}

const bucket: RumBucket = {
  lcpMs: null,
  inpMs: null,
  clsScore: null,
  dirtyVitals: {
    lcp: false,
    inp: false,
    cls: false,
  },
  apiLatencySamples: [],
  pageViewCount: 0,
  jsErrorCount: 0,
}

let initialized = false
let flushInFlight = false
let lastSentSignature: string | null = null
let latestObservedLcp: number | null = null
let lastSentLcpValue: number | null = null
let ingestDisabled = false

function roundMetric(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 1000) / 1000
}

function currentServiceId(): string {
  const fromEnv = (import.meta.env.VITE_OTEL_SERVICE_NAME as string | undefined)?.trim()
  return fromEnv || DEFAULT_SERVICE_ID
}

function currentRegistryBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_REGISTRY_API_URL as string | undefined)?.trim()
  if (fromEnv === 'same-origin' || fromEnv === '/') return ''
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  if (import.meta.env.DEV) return ''
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host !== 'localhost' && host !== '127.0.0.1') return ''
  }
  return DEFAULT_REGISTRY_BASE_URL.replace(/\/+$/, '')
}

function isSameOriginRegistryIngest(): boolean {
  return !currentRegistryBaseUrl()
}

function average(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function currentRumIngestUrl(): string {
  return `${currentRegistryBaseUrl()}/api/registry/services/${encodeURIComponent(currentServiceId())}/rum-metrics`
}

function normalizeUrl(input: Parameters<typeof fetch>[0]): string | null {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url
  return null
}

function isRumIngestRequest(input: Parameters<typeof fetch>[0]): boolean {
  const rawUrl = normalizeUrl(input)
  if (!rawUrl) return false

  try {
    const requestUrl = new URL(rawUrl, window.location.origin)
    return requestUrl.toString() === currentRumIngestUrl()
  } catch {
    return false
  }
}

function markVitalDirty(name: WebVitalName, value: number): void {
  if (!Number.isFinite(value) || value < 0) return
  if (name === 'lcp' && value > MAX_REASONABLE_LCP_MS) return
  if (name === 'inp' && value > MAX_REASONABLE_INP_MS) return

  if (name === 'lcp') {
    if (lastSentLcpValue != null && Math.abs(lastSentLcpValue - value) < 1) return
    bucket.lcpMs = value
  }
  if (name === 'inp') bucket.inpMs = value
  if (name === 'cls') bucket.clsScore = value
  bucket.dirtyVitals[name] = true
}

function markLcpFromObserver(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > MAX_REASONABLE_LCP_MS) return
  latestObservedLcp = value
  if (bucket.lcpMs == null || value > bucket.lcpMs) {
    markVitalDirty('lcp', value)
  }
}

function installLcpFallbackObserver(): void {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      for (const entry of entries) {
        if (entry.entryType === 'largest-contentful-paint') {
          markLcpFromObserver(entry.startTime)
        }
      }
    })

    observer.observe({ type: 'largest-contentful-paint', buffered: true })
  } catch {
    // Browser may not support buffered LCP observation.
  }
}

function flushObservedLcpFallback(): void {
  if (latestObservedLcp == null) return
  markVitalDirty('lcp', latestObservedLcp)
  void postRumSample()
}

async function postRumSample(): Promise<void> {
  if (flushInFlight || ingestDisabled) return

  const apiLatencyMs = average(bucket.apiLatencySamples)
  const apiLatencySampleCount = bucket.apiLatencySamples.length
  const shouldSendLcp = bucket.dirtyVitals.lcp && bucket.lcpMs != null
  const shouldSendInp = bucket.dirtyVitals.inp && bucket.inpMs != null
  const shouldSendCls = bucket.dirtyVitals.cls && bucket.clsScore != null

  const hasData =
    shouldSendLcp ||
    shouldSendInp ||
    shouldSendCls ||
    apiLatencyMs != null ||
    bucket.pageViewCount > 0 ||
    bucket.jsErrorCount > 0

  if (!hasData) return

  const apiKey = (import.meta.env.VITE_REGISTRY_RUM_API_KEY as string | undefined)?.trim()
  // Registry returns 401 when REGISTRY_RUM_INGEST_API_KEY is set and the
  // browser omits X-API-Key. Do not POST without a key — same-origin nginx
  // does not bypass that check, and a 401 still appears in DevTools.
  if (!apiKey) {
    ingestDisabled = true
    return
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
  }

  const payload: RumPayload = {
    lcp_ms: shouldSendLcp ? roundMetric(bucket.lcpMs) : null,
    inp_ms: shouldSendInp ? roundMetric(bucket.inpMs) : null,
    cls_score: shouldSendCls ? roundMetric(bucket.clsScore) : null,
    api_latency_ms: roundMetric(apiLatencyMs),
    api_latency_sample_count: apiLatencySampleCount,
    page_view_count: bucket.pageViewCount,
    js_error_count: bucket.jsErrorCount,
    collected_at: new Date().toISOString(),
  }
  const payloadSignature = JSON.stringify({
    lcp_ms: payload.lcp_ms,
    inp_ms: payload.inp_ms,
    cls_score: payload.cls_score,
    api_latency_ms: payload.api_latency_ms,
    api_latency_sample_count: payload.api_latency_sample_count,
    page_view_count: payload.page_view_count,
    js_error_count: payload.js_error_count,
  })

  if (payloadSignature === lastSentSignature) {
    if (shouldSendLcp) bucket.dirtyVitals.lcp = false
    if (shouldSendInp) bucket.dirtyVitals.inp = false
    if (shouldSendCls) bucket.dirtyVitals.cls = false
    bucket.apiLatencySamples = []
    bucket.pageViewCount = 0
    bucket.jsErrorCount = 0
    return
  }

  try {
    flushInFlight = true
    const response = await fetch(currentRumIngestUrl(), {
      method: 'POST',
      mode: isSameOriginRegistryIngest() ? 'same-origin' : 'cors',
      keepalive: true,
      headers,
      body: JSON.stringify(payload),
    })

    if (response.status === 401 || response.status === 403) {
      ingestDisabled = true
      return
    }
    if (!response.ok) return

    lastSentSignature = payloadSignature
    bucket.apiLatencySamples = []
    bucket.pageViewCount = 0
    bucket.jsErrorCount = 0

    if (shouldSendLcp) {
      bucket.dirtyVitals.lcp = false
      lastSentLcpValue = payload.lcp_ms
    }
    if (shouldSendInp) bucket.dirtyVitals.inp = false
    if (shouldSendCls) bucket.dirtyVitals.cls = false
  } catch {
    // RUM collection must never block app usage.
  } finally {
    flushInFlight = false
  }
}

function installFetchObserver(): void {
  if (typeof window === 'undefined' || !window.fetch) return

  const nativeFetch = window.fetch.bind(window)
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    if (isRumIngestRequest(args[0])) {
      return nativeFetch(...args)
    }

    const startedAt = performance.now()
    try {
      const response = await nativeFetch(...args)
      const elapsed = performance.now() - startedAt
      if (Number.isFinite(elapsed) && elapsed > 0) {
        bucket.apiLatencySamples.push(elapsed)
      }
      return response
    } catch (error) {
      const elapsed = performance.now() - startedAt
      if (Number.isFinite(elapsed) && elapsed > 0) {
        bucket.apiLatencySamples.push(elapsed)
      }
      throw error
    }
  }
}

// web-vitals' own CLS handler intermittently reads .startTime off an undefined
// PerformanceEntry inside a requestIdleCallback/timeout it schedules internally
// (Chrome-only race). Upstream closed this as not-planned:
// https://github.com/GoogleChrome/web-vitals/issues/274 — it never affects app
// behavior, so filter it out instead of letting it spam the console and inflate
// our own error count.
function isKnownHarmlessRumError(message: string): boolean {
  return message.includes("reading 'startTime'")
}

function installErrorObserver(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('error', (event) => {
    if (isKnownHarmlessRumError(event.message)) {
      event.preventDefault()
      return
    }
    bucket.jsErrorCount += 1
  })
  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason instanceof Error ? event.reason.message : String(event.reason ?? '')
    if (isKnownHarmlessRumError(message)) {
      event.preventDefault()
      return
    }
    bucket.jsErrorCount += 1
  })
}

export function initRum(): boolean {
  if (initialized) return true
  initialized = true

  if (typeof window === 'undefined') return false

  bucket.pageViewCount += 1
  installFetchObserver()
  installErrorObserver()
  installLcpFallbackObserver()
  void postRumSample()

  onLCP((metric: WebVitalMetric) => {
    markVitalDirty('lcp', metric.value)
    void postRumSample()
  })
  onINP((metric: WebVitalMetric) => {
    markVitalDirty('inp', metric.value)
    void postRumSample()
  })
  onCLS((metric: WebVitalMetric) => {
    markVitalDirty('cls', metric.value)
  })

  window.setInterval(() => {
    void postRumSample()
  }, FLUSH_INTERVAL_MS)
  window.addEventListener('load', () => {
    window.setTimeout(() => {
      flushObservedLcpFallback()
    }, 2_000)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushObservedLcpFallback()
      void postRumSample()
    }
  })
  window.addEventListener('beforeunload', () => {
    flushObservedLcpFallback()
    void postRumSample()
  })

  return true
}
