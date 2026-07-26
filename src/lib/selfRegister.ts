import { apiFetch, authHeaders } from '@/lib/api/httpClient'

/**
 * Self-registration with registry-core via the UPSERT /services/register endpoint.
 * Driven entirely by VITE_SELF_SERVICE_* env vars — no hardcoded identity.
 * Idempotent: register endpoint creates or updates, never returns 409.
 * Skipped silently if VITE_SELF_SERVICE_ID is not set.
 */
export async function selfRegisterWithRegistryCore(): Promise<void> {
  const serviceId = (import.meta.env.VITE_SELF_SERVICE_ID as string | undefined)?.trim()
  if (!serviceId) return

  const splitCsv = (val: string | undefined, fallback: string) =>
    (val ?? fallback).split(',').map((s) => s.trim()).filter(Boolean)

  const payload = {
    service_id: serviceId,
    name: (import.meta.env.VITE_SELF_SERVICE_NAME as string | undefined)?.trim() ?? serviceId,
    type: (import.meta.env.VITE_SELF_SERVICE_TYPE as string | undefined)?.trim() ?? 'frontend',
    domains: splitCsv(import.meta.env.VITE_SELF_SERVICE_DOMAINS as string | undefined, ''),
    teams: splitCsv(import.meta.env.VITE_SELF_SERVICE_TEAMS as string | undefined, ''),
    tags: splitCsv(import.meta.env.VITE_SELF_SERVICE_TAGS as string | undefined, 'auto-registered'),
  }

  // Registry-core (8406) — jangan lewat gateway-runtime; route /api/registry-core belum selalu dipublish di 8084.
  const coreUrl = (
    (import.meta.env.VITE_REGISTRY_CORE_API_URL as string | undefined)?.trim() ||
    (import.meta.env.DEV ? '/api/registry-core' : 'http://localhost:8406')
  ).replace(/\/+$/, '')

  try {
    const endpoint = coreUrl.endsWith('/api/registry-core')
      ? `${coreUrl}/v1/services/register`
      : `${coreUrl}/api/registry-core/v1/services/register`

    const res = await apiFetch(endpoint, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })
    if (!res.ok && res.status !== 404) {
      console.warn(`[selfRegister] registry-core returned ${res.status} for ${serviceId}`)
    }
  } catch {
    // Registry-core unavailable — non-fatal, app still loads
  }
}
