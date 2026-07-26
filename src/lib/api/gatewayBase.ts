/**
 * API traffic for Tectona dev goes through Laurus gateway-runtime (8084).
 */

export const GATEWAY_RUNTIME_BASE = (
  (import.meta.env.VITE_GATEWAY_RUNTIME_URL as string | undefined) ?? ''
).replace(/\/$/, '') || '/api/gateway-runtime'

export const IDENTITY_API_BASE = (
  (import.meta.env.VITE_IDENTITY_LITE_API_URL as string | undefined) ?? ''
).replace(/\/$/, '') || '/api/identity-lite'
export const TECTONA_OIDC_CLIENT_ID =
  (import.meta.env.VITE_TECTONA_OIDC_CLIENT_ID as string | undefined)?.trim() || 'tectona-spa'

export function serviceApiBase(servicePrefix: string, envOverride?: string): string {
  const override = envOverride?.trim()
  if (override) return override.replace(/\/$/, '')
  const prefix = servicePrefix.startsWith('/') ? servicePrefix : `/${servicePrefix}`
  return `${GATEWAY_RUNTIME_BASE}${prefix}`
}
