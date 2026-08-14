import { inferServiceFromApiUrl } from './inferServiceFromApiUrl'

export type RecentApiFailureKind = 'network' | 'timeout' | 'service' | 'database' | 'auth'

export interface RecentApiFailure {
  at: number
  serviceId: string
  serviceLabel: string
  kind: RecentApiFailureKind
  message: string
}

const MAX_FAILURES = 12
const failures: RecentApiFailure[] = []

function classifyMessage(message: string, status?: number): RecentApiFailureKind {
  const lower = message.toLowerCase()
  if (lower.includes('timed out') || lower.includes('timeout') || lower.includes('abort')) {
    return 'timeout'
  }
  if (status === 401 || status === 403 || lower.includes('unauthorized') || lower.includes('session')) {
    return 'auth'
  }
  if (
    status === 503
    || lower.includes('database')
    || lower.includes('postgres')
    || lower.includes('db unavailable')
  ) {
    return 'database'
  }
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('load failed')) {
    return 'network'
  }
  return 'service'
}

export function recordApiFailure(input: RequestInfo | URL, error: unknown, status?: number): void {
  const message = error instanceof Error ? error.message : String(error ?? 'Request failed')
  const service = inferServiceFromApiUrl(input)
  const kind = classifyMessage(message, status)
  failures.unshift({
    at: Date.now(),
    serviceId: service?.id ?? 'unknown',
    serviceLabel: service?.label ?? 'Platform API',
    kind,
    message: message.slice(0, 240),
  })
  if (failures.length > MAX_FAILURES) {
    failures.length = MAX_FAILURES
  }
}

export function getRecentApiFailures(maxAgeMs = 120_000): RecentApiFailure[] {
  const cutoff = Date.now() - maxAgeMs
  return failures.filter((entry) => entry.at >= cutoff)
}

export function formatRecentFailureHighlight(failure: RecentApiFailure): string {
  if (failure.kind === 'network' || failure.kind === 'timeout') {
    return `${failure.serviceLabel} request failed — network or service may be unreachable.`
  }
  if (failure.kind === 'database') {
    return `${failure.serviceLabel} — database is unreachable.`
  }
  if (failure.kind === 'auth') {
    return `Session or permissions for ${failure.serviceLabel} need to be refreshed.`
  }
  return `${failure.serviceLabel} is experiencing a service issue.`
}
