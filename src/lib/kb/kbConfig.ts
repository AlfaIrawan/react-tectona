/** Shared browser-local KB connection preferences (aligned with Platform Settings → Knowledge Base). */

export const KB_CONFIG_STORAGE_KEY = 'tectona.kb.config'

/** Via Laurus gateway-runtime (production / nginx). */
export const GATEWAY_KB_SERVICE_BASE = '/api/gateway-runtime/api/tectona-kb'

/** Direct same-origin proxy → localhost:8415 (Vite dev). */
export const DIRECT_KB_SERVICE_BASE = '/api/tectona-kb'

export type KbUiConfig = {
  enabled: boolean
  baseUrl: string
  timeoutSeconds: number
}

const defaultConfig: KbUiConfig = {
  enabled: true,
  baseUrl: import.meta.env.DEV ? DIRECT_KB_SERVICE_BASE : GATEWAY_KB_SERVICE_BASE,
  timeoutSeconds: 15,
}

/**
 * Gateway-runtime in Docker often proxies KB to host.docker.internal:8415 and returns 502
 * while Vite dev proxy (/api/tectona-kb → localhost:8415) works on the workstation.
 */
export function resolveKbServiceBaseUrl(storedBaseUrl?: string | null): string {
  const trimmed = (storedBaseUrl ?? '').trim().replace(/\/+$/, '')
  const fallback = import.meta.env.DEV ? DIRECT_KB_SERVICE_BASE : GATEWAY_KB_SERVICE_BASE

  if (!trimmed) return fallback

  if (import.meta.env.DEV) {
    if (
      trimmed === GATEWAY_KB_SERVICE_BASE
      || trimmed.startsWith(`${GATEWAY_KB_SERVICE_BASE}/`)
      || /host\.docker\.internal:8415/i.test(trimmed)
      || trimmed === 'http://localhost:8084/api/tectona-kb'
    ) {
      return DIRECT_KB_SERVICE_BASE
    }
  }

  return trimmed
}

function maybePersistDevKbMigration(config: KbUiConfig, previousBaseUrl: string): void {
  if (!import.meta.env.DEV) return
  if (config.baseUrl === previousBaseUrl.trim().replace(/\/+$/, '')) return
  try {
    localStorage.setItem(KB_CONFIG_STORAGE_KEY, JSON.stringify(config))
  } catch {
    // ignore quota / private mode
  }
}

export function readKbConfig(): KbUiConfig {
  try {
    const raw = localStorage.getItem(KB_CONFIG_STORAGE_KEY)
    if (!raw) return defaultConfig
    const parsed = JSON.parse(raw) as Partial<KbUiConfig>
    const previousBaseUrl =
      typeof parsed.baseUrl === 'string' && parsed.baseUrl.trim() ? parsed.baseUrl : defaultConfig.baseUrl
    const config: KbUiConfig = {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : defaultConfig.enabled,
      baseUrl: resolveKbServiceBaseUrl(previousBaseUrl),
      timeoutSeconds:
        typeof parsed.timeoutSeconds === 'number' && parsed.timeoutSeconds > 0
          ? Math.round(parsed.timeoutSeconds)
          : defaultConfig.timeoutSeconds,
    }
    maybePersistDevKbMigration(config, previousBaseUrl)
    return config
  } catch {
    return defaultConfig
  }
}
