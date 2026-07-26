/** Shared browser-local KB connection preferences (aligned with Platform Settings → Knowledge Base). */

export const KB_CONFIG_STORAGE_KEY = 'tectona.kb.config'

export type KbUiConfig = {
  enabled: boolean
  baseUrl: string
  timeoutSeconds: number
}

const defaultConfig: KbUiConfig = {
  enabled: true,
  // Gateway-runtime service prefix (tectonaKbApi appends /v1, not /api/tectona-kb/v1 again).
  baseUrl: '/api/gateway-runtime/api/tectona-kb',
  timeoutSeconds: 15,
}

export function readKbConfig(): KbUiConfig {
  try {
    const raw = localStorage.getItem(KB_CONFIG_STORAGE_KEY)
    if (!raw) return defaultConfig
    const parsed = JSON.parse(raw) as Partial<KbUiConfig>
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : defaultConfig.enabled,
      baseUrl: typeof parsed.baseUrl === 'string' && parsed.baseUrl.trim() ? parsed.baseUrl : defaultConfig.baseUrl,
      timeoutSeconds:
        typeof parsed.timeoutSeconds === 'number' && parsed.timeoutSeconds > 0
          ? Math.round(parsed.timeoutSeconds)
          : defaultConfig.timeoutSeconds,
    }
  } catch {
    return defaultConfig
  }
}
