/**
 * Shared Identity Lite (Ilex) — OIDC password grant + userinfo for Tectona login.
 */

import { getClientEnvironmentHintsAsync } from '@/lib/clientEnvironment'
import { FetchTimeoutError, fetchWithTimeout } from '@/lib/fetchWithTimeout'
import { IDENTITY_API_BASE, TECTONA_OIDC_CLIENT_ID, serviceApiBase } from './gatewayBase'
import { formatAuthErrorMessage } from '@/lib/authErrorMessages'
import { SessionConflictError, SessionRevokedError } from '@/lib/sessionConflict'
import type { TokenTelemetryEvent } from '@/lib/tokenTelemetry'

/** Thrown when identity-lite does not respond (timeout / network). */
export class IdentityServiceUnavailableError extends Error {
  constructor(message = formatAuthErrorMessage('identity_service_timeout')) {
    super(message)
    this.name = 'IdentityServiceUnavailableError'
  }
}

async function identityFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetchWithTimeout(input, init)
  } catch (err) {
    if (err instanceof FetchTimeoutError) {
      throw new IdentityServiceUnavailableError()
    }
    throw new IdentityServiceUnavailableError(formatAuthErrorMessage('identity_service_unreachable'))
  }
}

/** Token endpoint failure with optional OAuth error code (e.g. invalid_grant). */
export class OidcTokenExchangeError extends Error {
  readonly errorCode?: string
  readonly httpStatus: number

  constructor(message: string, errorCode?: string, httpStatus = 0) {
    super(message)
    this.name = 'OidcTokenExchangeError'
    this.errorCode = errorCode
    this.httpStatus = httpStatus
  }
}

export interface SsoBootstrapTokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
}

export async function fetchTokenAudit(accessToken: string, limit = 80, userId?: string): Promise<TokenTelemetryEvent[]> {
  const runtimeBase = serviceApiBase(
    '/api/tectona-agent-runtime',
    import.meta.env.VITE_TECTONA_AGENT_RUNTIME_API_URL,
  )
  const res = await identityFetch(
    `${runtimeBase}/v1/agent/llm-usage?limit=${encodeURIComponent(String(limit))}${userId ? `&user_id=${encodeURIComponent(userId)}` : ''}`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } },
  )
  if (!res.ok) throw new Error(`LLM usage audit failed (${res.status})`)
  const data = (await res.json()) as {
    events?: Array<{
      id: string
      source?: 'user' | 'system'
      event?: string
      trigger?: string
      context?: string
      model?: string
      provider?: string
      vendor?: string
      input_cost_idr?: number
      output_cost_idr?: number
      total_cost_idr?: number
      latency_ms?: number
      input_tokens?: number
      output_tokens?: number
      total_tokens?: number
      occurred_at: string
    }>
  }
  return (data.events ?? []).map((entry) => ({
    id: entry.id,
    source: entry.source ?? 'system',
    kind: 'used',
    event: entry.event ?? 'AI/LLM completion',
    trigger: entry.trigger ?? 'LLM completion',
    context: entry.context,
    category: 'llm',
    model: entry.model,
    provider: entry.provider,
    vendor: entry.vendor,
    inputCostIdr: entry.input_cost_idr,
    outputCostIdr: entry.output_cost_idr,
    totalCostIdr: entry.total_cost_idr,
    latencyMs: entry.latency_ms,
    inputTokens: entry.input_tokens,
    outputTokens: entry.output_tokens,
    totalTokens: entry.total_tokens,
    occurredAt: entry.occurred_at,
    tokenPreview: `${entry.total_tokens ?? 0} LLM tokens`,
  }))
}

/**
 * Silent cross-app SSO bootstrap. Uses the shared identity-lite SSO cookie (set at
 * token issuance) to obtain a fresh token bundle without an interactive login.
 * Returns null when there is no valid shared session (HTTP 401) or on any error —
 * callers fall through to the normal interactive login.
 */
export async function bootstrapSsoSession(
  clientId: string = TECTONA_OIDC_CLIENT_ID,
): Promise<SsoBootstrapTokenResponse | null> {
  try {
    const res = await identityFetch(
      `${IDENTITY_API_BASE}/oauth2/session/bootstrap?client_id=${encodeURIComponent(clientId)}`,
      { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } },
    )
    if (!res.ok) return null
    const data = (await res.json()) as SsoBootstrapTokenResponse
    return data?.access_token ? data : null
  } catch {
    return null
  }
}

function identityWebSocketBaseUrl(): string {
  const override = (import.meta.env.VITE_IDENTITY_LITE_API_URL as string | undefined)?.replace(/\/$/, '')
  if (override) return override
  return IDENTITY_API_BASE
}

/** Dev: WS uses Vite proxy `/api/identity-lite` → identity-lite :8430. */
export function createIdentitySessionWebSocketUrl(options?: { token?: string }): string {
  const rawBase = identityWebSocketBaseUrl()
  const url =
    rawBase.startsWith('http://') || rawBase.startsWith('https://')
      ? new URL(rawBase)
      : new URL(rawBase, window.location.origin)

  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/v1/ws/session`
  url.search = ''
  if (options?.token) {
    url.searchParams.set('token', options.token)
  }
  return url.toString()
}

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
  display_name?: string | null
  job_title?: string | null
  organizational_unit?: string | null
  account_status?: string | null
  created_at?: string | null
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

export type OidcLoginOptions = {
  sessionPolicy?: 'replace'
}

async function appendClientEnvironmentHints(body: URLSearchParams): Promise<void> {
  const hints = await getClientEnvironmentHintsAsync()
  if (hints.client_device) body.set('client_device', hints.client_device)
  if (hints.client_browser) body.set('client_browser', hints.client_browser)
  if (hints.client_location) body.set('client_location', hints.client_location)
}

function extractErrorPayload(body: string): {
  error?: string
  error_description?: string
  message?: string
  active_session?: {
    session_id?: string
    started_at?: string
    device?: string | null
    browser?: string | null
    location?: string | null
  }
} | null {
  try {
    const parsed = JSON.parse(body) as {
      detail?: string | {
        error?: string
        error_description?: string
        active_session?: {
    session_id?: string
    started_at?: string
    device?: string | null
    browser?: string | null
    location?: string | null
  }
      }
      error?: string | {
        code?: number
        error?: string
        message?: string
        error_description?: string
        active_session?: {
    session_id?: string
    started_at?: string
    device?: string | null
    browser?: string | null
    location?: string | null
  }
      }
      error_description?: string
      active_session?: {
    session_id?: string
    started_at?: string
    device?: string | null
    browser?: string | null
    location?: string | null
  }
    }
    if (parsed.error && typeof parsed.error === 'object') {
      const nested = parsed.error
      return {
        error: nested.error ?? (typeof nested.message === 'string' ? nested.message : undefined),
        error_description: nested.error_description,
        message: nested.message,
        active_session: nested.active_session,
      }
    }
    if (typeof parsed.error === 'string') {
      return parsed
    }
    if (parsed.detail && typeof parsed.detail === 'object') {
      return parsed.detail
    }
    if (typeof parsed.detail === 'string') {
      return { error: parsed.detail }
    }
    return parsed
  } catch {
    return null
  }
}

function throwTokenError(status: number, body: string): never {
  const payload = extractErrorPayload(body)
  if (status === 409 && payload?.error === 'active_session_exists') {
    throw new SessionConflictError(payload.active_session ?? {})
  }
  if (payload?.error === 'session_revoked') {
    throw new SessionRevokedError(
      typeof payload.error_description === 'string' ? payload.error_description : undefined,
    )
  }
  if (status === 401 && payload?.error === 'invalid_grant') {
    const desc = (payload.error_description ?? '').toLowerCase()
    if (desc.includes('revok') || desc.includes('signed in elsewhere') || desc.includes('signed out')) {
      throw new SessionRevokedError(payload.error_description)
    }
  }
  const errorCode =
    typeof payload?.error === 'string'
      ? payload.error
      : undefined
  throw new OidcTokenExchangeError(parseTokenError(status, body), errorCode, status)
}

function parseTokenError(status: number, body: string): string {
  const payload = extractErrorPayload(body)
  if (payload?.error === 'weak_password') {
    return payload.error_description
      ?? formatAuthErrorMessage('weak_password', status)
  }
  try {
    const parsed = JSON.parse(body) as {
      error?: string | { message?: string; code?: number }
      detail?: string | { error?: string; error_description?: string }
      error_description?: string
    }
    const nested =
      parsed.error && typeof parsed.error === 'object' ? parsed.error.message : undefined
    const detailObj = parsed.detail && typeof parsed.detail === 'object' ? parsed.detail : undefined
    const codeOrDetail =
      detailObj?.error_description
      ?? nested
      ?? (typeof parsed.detail === 'string' ? parsed.detail : undefined)
      ?? parsed.error_description
      ?? (typeof parsed.error === 'string' ? parsed.error : undefined)
      ?? detailObj?.error
    if (codeOrDetail) return formatAuthErrorMessage(String(codeOrDetail), status)
  } catch {
    /* ignore */
  }
  return formatAuthErrorMessage(body, status)
}

export async function loginWithPassword(
  email: string,
  password: string,
  opts?: OidcLoginOptions,
): Promise<OidcTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: TECTONA_OIDC_CLIENT_ID,
    username: normalizeLoginEmail(email),
    password,
  })
  if (opts?.sessionPolicy === 'replace') {
    body.set('session_policy', 'replace')
  }
  await appendClientEnvironmentHints(body)
  const res = await identityFetch(`${IDENTITY_API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throwTokenError(res.status, text)
  }
  return res.json() as Promise<OidcTokenResponse>
}

export async function fetchUserInfo(accessToken: string): Promise<OidcUserInfo> {
  const res = await identityFetch(`${IDENTITY_API_BASE}/oauth2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`userinfo failed (${res.status})`)
  }
  return res.json() as Promise<OidcUserInfo>
}

export type RegisterResponse = {
  subject_id: string
  email: string
  status: string
  message?: string
}

export async function registerWithEmail(input: {
  email: string
  password: string
  displayName?: string
}): Promise<RegisterResponse> {
  const res = await identityFetch(`${IDENTITY_API_BASE}/v1/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      email: normalizeLoginEmail(input.email),
      password: input.password,
      display_name: input.displayName?.trim() || undefined,
      client_id: TECTONA_OIDC_CLIENT_ID,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (res.status === 409) {
      throw new Error('Email is already registered. Use a different email or sign in to your account.')
    }
    throw new Error(parseTokenError(res.status, text))
  }
  return res.json() as Promise<RegisterResponse>
}

export async function exchangeAuthorizationCode(
  input: {
    code: string
    redirectUri: string
    codeVerifier: string
  },
  opts?: OidcLoginOptions,
): Promise<OidcTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: TECTONA_OIDC_CLIENT_ID,
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
  })
  if (opts?.sessionPolicy === 'replace') {
    body.set('session_policy', 'replace')
  }
  await appendClientEnvironmentHints(body)
  const res = await identityFetch(`${IDENTITY_API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throwTokenError(res.status, text)
  }
  return res.json() as Promise<OidcTokenResponse>
}

/** OIDC refresh_token grant — rotates access + refresh token via identity-lite. */
export async function refreshAccessToken(refreshToken: string): Promise<OidcTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: TECTONA_OIDC_CLIENT_ID,
    refresh_token: refreshToken,
  })
  const res = await identityFetch(`${IDENTITY_API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throwTokenError(res.status, text)
  }
  return res.json() as Promise<OidcTokenResponse>
}

/** Validates server-side session (sid) — detects remote sign-out before refresh is needed. */
export async function checkSessionStatus(accessToken: string): Promise<{ active: boolean }> {
  const res = await identityFetch(`${IDENTITY_API_BASE}/oauth2/session/status`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throwTokenError(res.status, text)
  }
  return res.json() as Promise<{ active: boolean }>
}

/** Revoke all server refresh sessions for the user on explicit sign-out. */
export async function revokeServerSession(
  refreshToken?: string | null,
  accessToken?: string | null,
): Promise<void> {
  if (!refreshToken?.trim() && !accessToken?.trim()) return
  const body = new URLSearchParams()
  if (refreshToken?.trim()) {
    body.set('refresh_token', refreshToken.trim())
    body.set('client_id', TECTONA_OIDC_CLIENT_ID)
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  }
  if (accessToken?.trim()) {
    headers.Authorization = `Bearer ${accessToken.trim()}`
  }
  try {
    await fetchWithTimeout(`${IDENTITY_API_BASE}/oauth2/logout`, {
      method: 'POST',
      headers,
      body,
    })
  } catch {
    /* Best-effort server logout when identity-lite is unreachable. */
  }
}

export type VerifyEmailResponse = {
  verified: boolean
  email?: string | null
  subject_id?: string | null
  app_id?: string | null
  workspace_id?: string | null
  organization_name?: string | null
  workspace_name?: string | null
}

export async function verifyEmailToken(token: string): Promise<VerifyEmailResponse> {
  const q = new URLSearchParams({ token })
  const res = await identityFetch(`${IDENTITY_API_BASE}/v1/verify-email?${q}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const payload = extractErrorPayload(text)
    const code = typeof payload?.error === 'string' ? payload.error : typeof payload?.detail === 'string' ? payload.detail : ''
    if (res.status === 400 || /invalid_or_expired_token/i.test(code) || /invalid_or_expired_token/i.test(text)) {
      throw new Error(
        'This confirmation link is invalid or has already been used. Request a new verification email from onboarding, then use the latest message.',
      )
    }
    throw new Error('Email verification failed. Try the latest confirmation link, or sign in and resend the email.')
  }
  return res.json() as Promise<VerifyEmailResponse>
}

export async function resendDomainOnboardingVerificationEmail(input: {
  email: string
  subjectId: string
  appId?: string
  workspaceId?: string
  organizationName?: string
  workspaceName?: string
}): Promise<void> {
  const { TECTONA_AUTHZ_APP_ID } = await import('@/lib/constants/tectonaAuthz')
  const { fetchOnboardingStatus } = await import('./workspaceAccessControlApi')
  const onboarding = await fetchOnboardingStatus(input.appId ?? TECTONA_AUTHZ_APP_ID, input.subjectId)
  const workspaceId = input.workspaceId ?? onboarding.active_workspace_id
  if (!workspaceId) {
    throw new Error('No pending workspace onboarding found to resend verification.')
  }
  const res = await identityFetch(`${IDENTITY_API_BASE}/v1/email-verification/domain-onboarding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      email: normalizeLoginEmail(input.email),
      subject_id: input.subjectId,
      app_id: input.appId ?? TECTONA_AUTHZ_APP_ID,
      workspace_id: workspaceId,
      organization_name: input.organizationName,
      workspace_name: input.workspaceName,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(parseTokenError(res.status, text))
  }
}

export async function fetchEmailDeliveryStatus(): Promise<{ smtpConfigured: boolean }> {
  const res = await identityFetch(`${IDENTITY_API_BASE}/v1/email-delivery`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    return { smtpConfigured: false }
  }
  const data = (await res.json()) as { smtp_configured?: boolean }
  return { smtpConfigured: data.smtp_configured === true }
}

export async function sendWorkspaceInviteEmail(input: {
  accessToken: string
  email: string
  memberName?: string
  organizationName?: string
  workspaceNames: string[]
  role: string
  invitedBy?: string
}): Promise<void> {
  const res = await identityFetch(`${IDENTITY_API_BASE}/v1/email/workspace-invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify({
      email: normalizeLoginEmail(input.email),
      member_name: input.memberName,
      organization_name: input.organizationName,
      workspace_names: input.workspaceNames,
      role: input.role,
      invited_by: input.invitedBy,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(parseTokenError(res.status, text) || 'Could not send the invitation email.')
  }
}
