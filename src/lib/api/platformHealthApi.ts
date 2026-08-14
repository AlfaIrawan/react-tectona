import { GATEWAY_RUNTIME_BASE } from '@/lib/api/gatewayBase'
import { apiFetch, parseApiErrorMessage } from '@/lib/api/httpClient'
import type { PlatformHealthResponse } from './types'

const PLATFORM_HEALTH_URL = `${GATEWAY_RUNTIME_BASE}/v1/platform-health`
const PLATFORM_HEALTH_TIMEOUT_MS = 8_000

export async function fetchPlatformHealth(): Promise<PlatformHealthResponse> {
  const response = await apiFetch(PLATFORM_HEALTH_URL, { headers: { Accept: 'application/json' } }, PLATFORM_HEALTH_TIMEOUT_MS)
  if (!response.ok) {
    const text = await response.text()
    throw new Error(parseApiErrorMessage(text, `HTTP ${response.status}`))
  }
  return response.json() as Promise<PlatformHealthResponse>
}
