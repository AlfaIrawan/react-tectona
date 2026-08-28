import {
  exchangeAuthorizationCode,
  fetchUserInfo,
  loginWithPassword,
  normalizeLoginEmail,
  refreshAccessToken,
  checkSessionStatus,
  revokeServerSession,
  roleFromEmail,
  bootstrapSsoSession,
  OidcTokenExchangeError,
  type OidcLoginOptions,
} from '@/lib/api/identityApi'
import { enrollPasskey, authenticateWithPasskey } from '@/lib/api/webauthnApi'
import {
  isSessionConflictError,
  isSessionRevokedError,
  isRemoteSessionRevocationError,
  shouldPromptSessionConflict,
} from '@/lib/sessionConflict'
import {
  emitSessionActive,
  emitSessionCleared,
  emitSessionExpired,
  emitSessionTokenRefreshed,
} from '@/auth/sessionEvents'
import { clearStoredUserWorkspaceContext } from '@/lib/storedUserWorkspaceContext'
import { clearCorporateOnboardingSession } from '@/lib/corporateOnboardingSession'
import { invalidateSubjectMembershipsCache } from '@/lib/wacMembershipCache'
import { invalidateWorkspaceOrgDirectoryCache } from '@/lib/workspaceOrgDirectoryCache'
import { invalidateModuleAccessSnapshot } from '@/lib/moduleAccessSnapshot'
import { normalizeUserDisplayName } from '@/lib/userDisplayName'
import { upsertWorkspacePresenceWithToken, sendOfflinePresenceBeacon } from '@/lib/api/collaborationContextApi'
import { TECTONA_CHAT_WORKSPACE_ID } from '@/lib/api/tectonaAgentRuntimeApi'
import { useCollaborationPresenceStore } from '@/stores/collaboration-presence-store'
import { useMyPresenceStore } from '@/stores/my-presence-store'
import { useVoiceRecordRequestStore } from '@/stores/voice-record-request-store'
import { clearSensitiveRuntimeCaches } from '@/lib/pwa/initPwa'
import { maskToken, recordTokenEvent } from '@/lib/tokenTelemetry'

/** Default Tectona accounts (identity-lite bootstrap). */
export const DEFAULT_ACCOUNTS = [
  {
    email: 'root@tectona.local',
    password: 'RootPass1!',
    name: 'Root',
    role: 'root',
  },
  {
    email: 'administrator@tectona.local',
    password: 'AdminPass1!',
    name: 'Administrator',
    role: 'admin',
  },
] as const

export interface Session {
  user: {
    id: string
    name: string
    email: string
    role: string
    roles?: string[]
    jobTitle?: string | null
    organizationalUnit?: string | null
    accountStatus?: string | null
    createdAt?: string | null
  }
  token: string
  refreshToken?: string
  expiresAt?: string
  loginAt: string
}

const SESSION_KEY = 'tectona_session'

/** Refresh access token this many ms before expiry. */
const REFRESH_BUFFER_MS = 5 * 60 * 1000

let refreshInFlight: Promise<Session | null> | null = null
/** Suppress session-expired redirects while the user is intentionally signing out. */
let intentionalSignOutPending = false

function markIntentionalSignOut(): void {
  intentionalSignOutPending = true
}

function resetIntentionalSignOut(): void {
  intentionalSignOutPending = false
}

/** Call when login page loads after an intentional sign-out (clears suppress flag). */
export function acknowledgeIntentionalSignOut(): void {
  resetIntentionalSignOut()
}

/** Whether session-expired events should redirect the user to login. */
export function shouldPropagateSessionExpired(): boolean {
  return !intentionalSignOutPending
}

export function notifySessionExpiredIfNeeded(detail?: { reason?: string }): void {
  if (!shouldPropagateSessionExpired()) return
  emitSessionExpired(detail)
}

function readStoredSession(): Session | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    if (!stored) return null
    return JSON.parse(stored) as Session
  } catch {
    return null
  }
}

function persistSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function getAccessTokenExpiryMs(session: Session): number | null {
  if (!session.expiresAt) return null
  const ms = Date.parse(session.expiresAt)
  return Number.isFinite(ms) ? ms : null
}

export function isAccessTokenExpired(session: Session, skewMs = 0): boolean {
  const expiry = getAccessTokenExpiryMs(session)
  if (expiry == null) return false
  return Date.now() + skewMs >= expiry
}

export function needsTokenRefresh(session: Session, bufferMs = REFRESH_BUFFER_MS): boolean {
  const expiry = getAccessTokenExpiryMs(session)
  if (expiry == null) return false
  return Date.now() + bufferMs >= expiry
}

function applyTokenResponse(session: Session, tokenResponse: {
  access_token: string
  expires_in: number
  refresh_token?: string
}): Session {
  return {
    ...session,
    token: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token ?? session.refreshToken,
    expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString(),
  }
}

function buildSessionFromUserinfo(
  userinfo: { sub: string; email?: string; display_name?: string | null; roles?: string[]; job_title?: string | null; organizational_unit?: string | null; account_status?: string | null; created_at?: string | null },
  normalizedEmail: string,
  tokenResponse: { access_token: string; expires_in: number; refresh_token?: string },
): Session {
  const resolvedEmail = userinfo.email ?? normalizedEmail
  const uiRole =
    userinfo.roles?.includes('tectona_root') ? 'root'
    : userinfo.roles?.includes('tectona_admin') || userinfo.roles?.includes('admin') ? 'admin'
    : roleFromEmail(resolvedEmail)
  return {
    user: {
      id: userinfo.sub,
      name: normalizeUserDisplayName(userinfo.display_name || resolvedEmail),
      email: resolvedEmail,
      role: uiRole,
      roles: userinfo.roles ?? [],
      jobTitle: userinfo.job_title ?? null,
      organizationalUnit: userinfo.organizational_unit ?? null,
      accountStatus: userinfo.account_status ?? null,
      createdAt: userinfo.created_at ?? null,
    },
    token: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString(),
    loginAt: new Date().toISOString(),
  }
}

/**
 * Silent cross-app SSO. When there is no local session, try to bootstrap one from the
 * shared identity-lite SSO cookie (set when the user signed in on a sibling first-party
 * SPA, e.g. Tectona ↔ Platanus). No-op and returns null on any failure, so the normal
 * interactive login still applies.
 */
export async function attemptSilentSso(): Promise<Session | null> {
  const existing = getSession()
  if (existing) return existing
  try {
    const tokenResponse = await bootstrapSsoSession()
    if (!tokenResponse?.access_token) return null
    const userinfo = await fetchUserInfo(tokenResponse.access_token)
    const session = buildSessionFromUserinfo(userinfo, userinfo.email ?? '', tokenResponse)
    persistSession(session)
    recordTokenEvent(session.user.id, {
      source: 'system',
      kind: 'issued',
      event: 'Silent SSO session bootstrap',
      tokenPreview: maskToken(session.token),
      expiresAt: session.expiresAt,
    })
    emitSessionActive()
    return session
  } catch {
    return null
  }
}

/** Enrol a passkey for the currently signed-in user (call while authenticated). */
export async function registerPasskey(label?: string): Promise<void> {
  const session = getSession()
  if (!session?.token) throw new Error('not_authenticated')
  await enrollPasskey(session.token, label)
  recordTokenEvent(session.user.id, {
    source: 'user',
    kind: 'used',
    event: 'Passkey enrollment',
    trigger: 'User clicked Add passkey',
    context: 'Security settings',
    tokenPreview: maskToken(session.token),
    expiresAt: session.expiresAt,
  })
}

/** Sign in with a passkey (usernameless / discoverable) and persist the session. */
export async function loginWithPasskey(): Promise<Session> {
  const tokenResponse = await authenticateWithPasskey()
  const userinfo = await fetchUserInfo(tokenResponse.access_token)
  const session = buildSessionFromUserinfo(userinfo, userinfo.email ?? '', tokenResponse)
  persistSession(session)
  recordTokenEvent(session.user.id, {
    source: 'user',
    kind: 'issued',
    event: 'Passkey sign in',
    tokenPreview: maskToken(session.token),
    expiresAt: session.expiresAt,
  })
  emitSessionActive()
  return session
}

async function performRefresh(session: Session): Promise<Session | null> {
  if (!session.refreshToken) {
    clearSession()
    if (shouldPropagateSessionExpired()) {
      notifySessionExpiredIfNeeded({ reason: 'no_refresh_token' })
    }
    return null
  }
  try {
    const tokenResponse = await refreshAccessToken(session.refreshToken)
    const updated = applyTokenResponse(session, tokenResponse)
    persistSession(updated)
    recordTokenEvent(session.user.id, {
      source: 'system',
      kind: 'refreshed',
      event: 'Automatic token refresh',
      tokenPreview: maskToken(updated.token),
      expiresAt: updated.expiresAt,
    })
    emitSessionTokenRefreshed()
    return updated
  } catch (err) {
    clearSession()
    if (shouldPropagateSessionExpired()) {
      notifySessionExpiredIfNeeded({
        reason: isRemoteSessionRevocationError(err) ? 'session_revoked_elsewhere' : 'refresh_failed',
      })
    }
    return null
  }
}

/**
 * Returns a session with a valid access token, refreshing when needed.
 * Single-flight: concurrent callers share one refresh request.
 */
export async function ensureFreshSession(options?: { force?: boolean }): Promise<Session | null> {
  const session = readStoredSession()
  if (!session) return null

  const force = options?.force === true
  if (!force && !needsTokenRefresh(session) && !isAccessTokenExpired(session)) {
    return session
  }

  if (!session.refreshToken) {
    if (isAccessTokenExpired(session)) {
      clearSession()
      if (shouldPropagateSessionExpired()) {
        notifySessionExpiredIfNeeded({ reason: 'expired' })
      }
      return null
    }
    return session
  }

  if (!refreshInFlight) {
    refreshInFlight = performRefresh(session).finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

async function completeLogin(
  normalizedEmail: string,
  tokenResponse: { access_token: string; expires_in: number; refresh_token?: string },
): Promise<Session> {
  const userinfo = await fetchUserInfo(tokenResponse.access_token)
  const session = buildSessionFromUserinfo(userinfo, normalizedEmail, tokenResponse)
  persistSession(session)
  recordTokenEvent(session.user.id, {
    source: 'user',
    kind: 'issued',
    event: 'Sign in',
    tokenPreview: maskToken(session.token),
    expiresAt: session.expiresAt,
  })
  clearStoredUserWorkspaceContext()
  resetIntentionalSignOut()
  void import('@/lib/chat/chatContactDirectory')
    .then(({ publishCollaborationPresenceWithToken }) =>
      publishCollaborationPresenceWithToken(session.token, 'online'),
    )
    .catch(() => undefined)
  emitSessionActive()
  useMyPresenceStore.getState().setStatus('online')
  void import('@/lib/corporateOnboardingSession')
    .then(async ({ takePendingEmailVerifiedOnboarding }) => {
      const pending = takePendingEmailVerifiedOnboarding()
      if (!pending || pending.subjectId !== session.user.id) return
      const { confirmEmailVerifiedOnboarding } = await import('@/lib/api/onboardingApi')
      await confirmEmailVerifiedOnboarding(pending)
    })
    .catch(() => undefined)
  return session
}

function resolveLoginSessionPolicy(
  normalizedEmail: string,
  opts?: OidcLoginOptions,
): OidcLoginOptions | undefined {
  if (opts?.sessionPolicy === 'replace') {
    return { sessionPolicy: 'replace' }
  }
  const stored = readStoredSession()
  if (stored && normalizeLoginEmail(stored.user.email) !== normalizedEmail) {
    return { sessionPolicy: 'replace' }
  }
  return opts
}

/** Retry with session_policy=replace when the server session is stale on this browser. */
async function exchangeLoginTokens(
  fetchTokens: (opts?: OidcLoginOptions) => Promise<{
    access_token: string
    expires_in: number
    refresh_token?: string
  }>,
  opts?: OidcLoginOptions,
) {
  try {
    return await fetchTokens(opts)
  } catch (err) {
    if (
      isSessionConflictError(err)
      && opts?.sessionPolicy !== 'replace'
      && !shouldPromptSessionConflict(err.activeSession)
    ) {
      return await fetchTokens({ sessionPolicy: 'replace' })
    }
    throw err
  }
}

export async function login(email: string, password: string, opts?: OidcLoginOptions): Promise<Session> {
  const normalizedEmail = normalizeLoginEmail(email)
  const stored = readStoredSession()
  if (
    stored &&
    normalizeLoginEmail(stored.user.email) !== normalizedEmail
  ) {
    clearLocalSession(stored)
  }
  const loginOpts = resolveLoginSessionPolicy(normalizedEmail, opts)
  const tokenResponse = await exchangeLoginTokens(
    (policy) => loginWithPassword(normalizedEmail, password, policy),
    loginOpts,
  )
  return completeLogin(normalizedEmail, tokenResponse)
}

export async function loginWithAuthorizationCode(
  code: string,
  redirectUri: string,
  codeVerifier: string,
  opts?: OidcLoginOptions,
): Promise<Session> {
  const loginOpts =
    opts?.sessionPolicy === 'replace' ? { sessionPolicy: 'replace' as const } : opts
  const tokenResponse = await exchangeLoginTokens(
    (policy) =>
      exchangeAuthorizationCode({ code, redirectUri, codeVerifier }, policy),
    loginOpts,
  )
  const userinfo = await fetchUserInfo(tokenResponse.access_token)
  const email = userinfo.email ?? 'user@tectona.local'
  return completeLogin(email, tokenResponse)
}

async function publishOfflinePresence(
  session: Session | null,
  options?: { allowRefresh?: boolean },
): Promise<void> {
  if (!session) return
  let token = session.token
  if (
    options?.allowRefresh !== false &&
    session.refreshToken &&
    isAccessTokenExpired(session)
  ) {
    try {
      const refreshed = await refreshAccessToken(session.refreshToken)
      token = refreshed.access_token
    } catch {
      // access + refresh invalid (session_expired) — server TTL will clear stale online
    }
  }
  if (!token) return
  await upsertWorkspacePresenceWithToken(token, TECTONA_CHAT_WORKSPACE_ID, 'offline')
}

function clearLocalSession(session: Session | null): void {
  refreshInFlight = null
  invalidateSubjectMembershipsCache()
  invalidateWorkspaceOrgDirectoryCache()
  invalidateModuleAccessSnapshot()
  void clearSensitiveRuntimeCaches()
  localStorage.removeItem(SESSION_KEY)
  useCollaborationPresenceStore.getState().clear()
  useVoiceRecordRequestStore.getState().clear()
  useMyPresenceStore.getState().setStatus('offline')
  clearStoredUserWorkspaceContext()
  if (session?.user.id) clearCorporateOnboardingSession(session.user.id)
  emitSessionCleared()
}

/** Clears local session without revoking server tokens (session expiry, auth errors). */
export function clearSession(): void {
  clearLocalSession(readStoredSession())
}

/** Intentional sign-out: clear local state first, then revoke server sessions. */
export function logout(): void {
  markIntentionalSignOut()
  const session = readStoredSession()
  const refreshToken = session?.refreshToken
  const accessToken = session?.token
  if (session?.user.id && accessToken) {
    recordTokenEvent(session.user.id, {
      source: 'user',
      kind: 'revoked',
      event: 'Sign out and revoke session',
      tokenPreview: maskToken(accessToken),
    })
  }
  clearLocalSession(session)
  void publishOfflinePresence(session, { allowRefresh: false }).catch(() => undefined)
  if (refreshToken || accessToken) {
    void revokeServerSession(refreshToken, accessToken).catch(() => undefined)
  }
}

/** Await offline publish before navigation (explicit Sign out). */
export async function logoutAsync(): Promise<void> {
  markIntentionalSignOut()
  const session = readStoredSession()
  const refreshToken = session?.refreshToken
  const accessToken = session?.token
  if (session?.user.id && accessToken) {
    recordTokenEvent(session.user.id, {
      source: 'user',
      kind: 'revoked',
      event: 'Sign out and revoke session',
      tokenPreview: maskToken(accessToken),
    })
  }
  clearLocalSession(session)
  try {
    await publishOfflinePresence(session, { allowRefresh: false })
  } catch {
    // ignore
  }
  try {
    if (refreshToken || accessToken) {
      await revokeServerSession(refreshToken, accessToken)
    }
  } catch {
    // ignore revoke failures during sign-out
  }
}

export function publishOfflinePresenceOnPageHide(): void {
  const session = readStoredSession()
  useMyPresenceStore.getState().setStatus('offline')
  if (!session?.token) return
  sendOfflinePresenceBeacon(session.token, TECTONA_CHAT_WORKSPACE_ID)
}

/**
 * Synchronous session read. Does not refresh tokens; use ensureFreshSession before API calls.
 * Keeps session when access token expired but refresh token exists (refresh on next ensureFreshSession).
 */
export function getSession(): Session | null {
  const session = readStoredSession()
  if (!session) return null
  if (isAccessTokenExpired(session) && !session.refreshToken) {
    clearSession()
    return null
  }
  return session
}

export function isAuthenticated(): boolean {
  return getSession() !== null
}

export async function isAuthenticatedAsync(): Promise<boolean> {
  const session = await ensureFreshSession()
  return session != null
}

export function requireAuth(): Session | null {
  return getSession()
}

function invalidateServerSession(reason: string): false {
  clearSession()
  if (shouldPropagateSessionExpired()) {
    notifySessionExpiredIfNeeded({ reason })
  }
  return false
}

export async function validateActiveServerSession(): Promise<boolean> {
  const session = readStoredSession()
  if (!session?.token) return false
  try {
    await checkSessionStatus(session.token)
    recordTokenEvent(session.user.id, {
      source: 'system',
      kind: 'used',
      event: 'Session status check',
      trigger: 'App focus / API preflight',
      context: 'Automatic session validation',
      tokenPreview: maskToken(session.token),
      expiresAt: session.expiresAt,
    })
    return true
  } catch (err) {
    if (isSessionRevokedError(err)) {
      return invalidateServerSession('session_revoked_elsewhere')
    }
    if (err instanceof OidcTokenExchangeError && err.httpStatus === 401) {
      return invalidateServerSession('unauthorized')
    }
    // Transient/network errors — keep local session; apiFetch will retry on the next call.
    return true
  }
}

let lastServerSessionCheckAt = 0
const SERVER_SESSION_CHECK_THROTTLE_MS = 4_000

/**
 * Lightweight server session check — throttled for API calls; use `{ force: true }` on focus/poll.
 */
export async function validateActiveServerSessionIfDue(options?: { force?: boolean }): Promise<boolean> {
  const session = readStoredSession()
  if (!session?.token) return false

  const now = Date.now()
  if (!options?.force && now - lastServerSessionCheckAt < SERVER_SESSION_CHECK_THROTTLE_MS) {
    return true
  }
  lastServerSessionCheckAt = now
  return validateActiveServerSession()
}

/** Refresh tokens and verify the server session is still active (remote sign-out detection). */
export async function maintainActiveSession(options?: { forceStatusCheck?: boolean }): Promise<void> {
  const session = await ensureFreshSession()
  if (!session) return
  await validateActiveServerSessionIfDue({ force: options?.forceStatusCheck === true })
}

export function getDevelopmentAccounts() {
  return DEFAULT_ACCOUNTS.map(({ email, password, role, name }) => ({
    email,
    password,
    role,
    name,
  }))
}

/** @deprecated Use getDevelopmentAccounts */
export function getDemoAccounts() {
  return getDevelopmentAccounts()
}

/** @deprecated Use DEFAULT_ACCOUNTS */
export const DEMO_USERS = DEFAULT_ACCOUNTS
