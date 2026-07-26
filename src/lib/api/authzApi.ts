/**
 * Shared authorization-policy - decisions via gateway-runtime.
 */

import { apiFetch } from './httpClient'
import { serviceApiBase } from './gatewayBase'
import { TECTONA_AUTHZ_APP_ID } from '@/lib/constants/tectonaAuthz'

const AUTHZ_BASE = serviceApiBase('/api/authz')

export interface AuthorizeRequest {
  app_id: string
  principal: { sub: string }
  scope?: string
  resource_type: string
  resource_id?: string | null
  action: string
}

export interface AuthorizeResult {
  allowed: boolean
  reason_code: string
  matched?: {
    role_code?: string
    permission_code?: string
    scope_type?: string
  } | null
}

export async function postAuthorize(body: AuthorizeRequest): Promise<AuthorizeResult> {
  const res = await apiFetch(`${AUTHZ_BASE}/v1/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: body.app_id,
      principal: body.principal,
      scope: body.scope ?? 'global',
      resource_type: body.resource_type,
      resource_id: body.resource_id ?? null,
      action: body.action,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `authorize failed (${res.status})`)
  }
  return res.json() as Promise<AuthorizeResult>
}

export async function authorizeTectona(
  principalSub: string,
  resourceType: string,
  action: string,
  scope = 'global',
): Promise<AuthorizeResult> {
  return postAuthorize({
    app_id: TECTONA_AUTHZ_APP_ID,
    principal: { sub: principalSub },
    scope,
    resource_type: resourceType,
    action,
  })
}