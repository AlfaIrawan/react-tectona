/**
 * Shared Identity Lite (Ilex) — OIDC password grant + userinfo for Tectona login.
 */

import { IDENTITY_API_BASE, TECTONA_OIDC_CLIENT_ID } from './gatewayBase'

export interface OidcTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope?: string
}

export interface OidcUserInfo {
  sub: string
  email?: string
  email_verified?: boolean
  roles?: string[]
}

export function normalizeLoginEmail(input: string): string {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return trimmed
  if (trimmed.includes('@')) return trimmed
  if (trimmed === 'root') return 'root@tectona.local'
  if (trimmed === 'administrator' || trimmed === 'admin') return 'administrator@tectona.local'
  return `${trimmed}@tectona.local`
}

export function roleFromEmail(email: string): string {
  const e = email.toLowerCase()
  if (e.startsWith('root@')) return 'root'
  if (e.startsWith('administrator@') || e.includes('admin')) return 'admin'
  return 'member'
}

function parseTokenError(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      error?: string | { message?: string; code?: number }
      detail?: string
    }
    const nested =
      parsed.error && typeof parsed.error === 'object' ? parsed.error.message : undefined
    if (nested === 'account_pending_activation') {
      return 'Akun menunggu aktivasi. Hubungi administrator workspace setelah Anda di-invite.'
    }
    if (nested === 'account_not_active') {
      return 'Akun tidak aktif. Hubungi administrator.'
    }
    if (nested) return String(nested)
    if (parsed.detail === 'account_pending_activation') {
      return 'Akun menunggu aktivasi. Hubungi administrator workspace setelah Anda di-invite.'
    }
    if (parsed.detail === 'account_not_active') {
      return 'Akun tidak aktif. Hubungi administrator.'
    }
    if (parsed.detail) return String(parsed.detail)
    if (typeof parsed.error === 'string') return parsed.error
  } catch {
    /* ignore */
  }
  if (status === 500 || status === 502 || status === 503) {
    return 'Identity-lite tidak tersedia (port 8430). Restart python-identity-lite-service-fastapi lalu coba lagi.'
  }
  return body || `Token request failed (${status})`
}

export async function loginWithPassword(email: string, password: string): Promise<OidcTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: TECTONA_OIDC_CLIENT_ID,
    username: normalizeLoginEmail(email),
    password,
  })
  const res = await fetch(`${IDENTITY_API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(parseTokenError(res.status, text))
  }
  return res.json() as Promise<OidcTokenResponse>
}

export async function fetchUserInfo(accessToken: string): Promise<OidcUserInfo> {
  const res = await fetch(`${IDENTITY_API_BASE}/oauth2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`userinfo failed (${res.status})`)
  }
  return res.json() as Promise<OidcUserInfo>
}

/** OIDC refresh_token grant — rotates access + refresh token via identity-lite. */
export async function refreshAccessToken(refreshToken: string): Promise<OidcTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: TECTONA_OIDC_CLIENT_ID,
    refresh_token: refreshToken,
  })
  const res = await fetch(`${IDENTITY_API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(parseTokenError(res.status, text))
  }
  return res.json() as Promise<OidcTokenResponse>
}
