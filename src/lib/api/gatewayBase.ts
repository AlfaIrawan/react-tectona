/**
 * API traffic for Tectona dev goes through Laurus gateway-runtime (8084).
 */

export const GATEWAY_RUNTIME_BASE = (
  (import.meta.env.VITE_GATEWAY_RUNTIME_URL as string | undefined) ?? ''
).replace(/\/$/, '') || '/api/gateway-runtime'

export const IDENTITY_API_BASE = (
  (import.meta.env.VITE_IDENTITY_LITE_API_URL as string | undefined) ?? ''
).replace(/\/$/, '') || '/api/identity-lite'
/**
 * User preferences (8436). Its own service rather than part of identity-lite: UI
 * preferences are product state, and the auth service is the wrong place to widen
 * with a document any signed-in user may write.
 */
export const USER_PREFERENCES_API_BASE = (
  (import.meta.env.VITE_USER_PREFERENCES_API_URL as string | undefined) ?? ''
).replace(/\/$/, '') || '/api/user-preferences'

export const TECTONA_OIDC_CLIENT_ID =
  (import.meta.env.VITE_TECTONA_OIDC_CLIENT_ID as string | undefined)?.trim() || 'tectona-spa'

export function serviceApiBase(servicePrefix: string, envOverride?: string): string {
  const override = envOverride?.trim()
  if (override) return override.replace(/\/$/, '')
  const prefix = servicePrefix.startsWith('/') ? servicePrefix : `/${servicePrefix}`
  return `${GATEWAY_RUNTIME_BASE}${prefix}`
}

/**
 * Agent runtime (8414). Default is the nginx same-origin prefix — never gateway-runtime.
 * Chat via `/api/gateway-runtime/api/tectona-agent-runtime/...` returns 500 on tectona-dev.
 */
export function tectonaAgentRuntimeApiBase(envOverride?: string): string {
  const fromArg = envOverride?.trim()
  const fromRuntime = (import.meta.env.VITE_TECTONA_AGENT_RUNTIME_API_URL as string | undefined)?.trim()
  const fromLegacy = (import.meta.env.VITE_TECTONA_AGENT_API_URL as string | undefined)?.trim()
  return (fromArg || fromRuntime || fromLegacy || '/api/tectona-agent-runtime').replace(/\/$/, '')
}
