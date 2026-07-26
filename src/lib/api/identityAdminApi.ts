/**
 * Identity Lite admin API — user directory for workspace membership enrichment.
 */

import { IDENTITY_API_BASE } from './gatewayBase'
import { apiFetch, tectonaServiceHeaders } from './httpClient'

export type IdentityUserDto = {
  id: string
  email: string
  display_name: string
  status_code: string
  tenant_id?: string | null
  created_date?: string
  job_title?: string | null
  organizational_unit?: string | null
  manager_user_id?: string | null
  manager_display_name?: string | null
  manager_email?: string | null
}

export type IdentityUserListResponse = {
  items: IdentityUserDto[]
  limit: number
  offset: number
}

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const raw = await res.text().catch(() => '')
    throw new Error(raw || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function fetchIdentityUsers(params?: {
  limit?: number
  offset?: number
}): Promise<IdentityUserListResponse> {
  const limit = params?.limit ?? 200
  const offset = params?.offset ?? 0
  const base = IDENTITY_API_BASE.replace(/\/$/, '')
  const res = await apiFetch(`${base}/api/identity-lite/v1/users?limit=${limit}&offset=${offset}`, {
    headers: tectonaServiceHeaders(),
  })
  return handleJson<IdentityUserListResponse>(res)
}

export type IdentityUserProvisionResponse = {
  id: string
  email: string
  display_name: string
  status_code: string
  temporary_password?: string
}

export async function provisionIdentityUser(payload: {
  email: string
  display_name?: string
  status_code?: string
  job_title?: string
  organizational_unit?: string
  manager_email?: string
}): Promise<IdentityUserProvisionResponse> {
  const base = IDENTITY_API_BASE.replace(/\/$/, '')
  const res = await apiFetch(`${base}/api/identity-lite/v1/users/provision`, {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({
      email: payload.email.trim().toLowerCase(),
      display_name: payload.display_name,
      status_code: payload.status_code ?? 'invited',
      job_title: payload.job_title,
      organizational_unit: payload.organizational_unit,
      manager_email: payload.manager_email,
    }),
  })
  return handleJson<IdentityUserProvisionResponse>(res)
}

export async function activateIdentityUser(email: string): Promise<{ email: string; status_code: string }> {
  const normalized = email.trim().toLowerCase()
  const base = IDENTITY_API_BASE.replace(/\/$/, '')
  const res = await apiFetch(
    `${base}/api/identity-lite/v1/users/${encodeURIComponent(normalized)}/activate`,
    {
      method: 'POST',
      headers: tectonaServiceHeaders(),
    }
  )
  return handleJson<{ email: string; status_code: string }>(res)
}