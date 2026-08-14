import { parseApiErrorMessage } from '@/lib/api/httpClient'

/** Turn API/gateway error bodies into short user-facing English text. */
export function humanizePlatformHealthError(raw: string | null | undefined): string | undefined {
  if (!raw?.trim()) return undefined
  const trimmed = raw.trim()
  const friendly = parseApiErrorMessage(trimmed, trimmed)

  const lower = friendly.toLowerCase()
  if (lower.includes('no published route') && lower.includes('platform-health')) {
    return 'Platform health route is not published on the gateway yet.'
  }
  if (lower.includes('no published route')) {
    return 'Gateway route is not published for this environment.'
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Could not reach the platform gateway.'
  }
  if (lower.includes('timed out') || lower.includes('timeout')) {
    return 'Platform health check timed out.'
  }
  if (friendly.startsWith('{') && friendly.length > 120) {
    return 'Gateway returned an error response.'
  }
  return friendly.length > 160 ? `${friendly.slice(0, 157)}…` : friendly
}
