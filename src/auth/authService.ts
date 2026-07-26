import {
  fetchUserInfo,
  loginWithPassword,
  normalizeLoginEmail,
  refreshAccessToken,
  roleFromEmail,
} from '@/lib/api/identityApi'
import { emitSessionActive, emitSessionExpired } from '@/auth/sessionEvents'
import { upsertWorkspacePresenceWithToken, sendOfflinePresenceBeacon } from '@/lib/api/collaborationContextApi'
import { TECTONA_CHAT_WORKSPACE_ID } from '@/lib/api/tectonaAgentRuntimeApi'
import { useCollaborationPresenceStore } from '@/stores/collaboration-presence-store'
import { useMyPresenceStore } from '@/stores/my-presence-store'
import { useVoiceRecordRequestStore } from '@/stores/voice-record-request-store'

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
  {
    email: 'ricky.gunawan@tectona.local',
    password: 'RickyPass1!',
    name: 'Ricky Gunawan',
    role: 'portfolio_head',
  },
  {
    email: 'teguh.putera@tectona.local',
    password: 'TeguhPass1!',
    name: 'Teguh Supriyatna Putera',
    role: 'planning_governance_head',
  },
  {
    email: 'brian.reynaldo@tectona.local',
    password: 'BrianPass1!',
    name: 'Brian Reynaldo',
    role: 'portfolio_head',
  },
  {
    email: 'wahyu.satria@tectona.local',
    password: 'WahyuPass1!',
    name: 'Wahyu Satria Pamungkas',
    role: 'portfolio_officer',
  },
  {
    email: 'henry.halim@tectona.local',
    password: 'HenryPass1!',
    name: 'Henry Halim',
    role: 'business_partner_head',
  },
  {
    email: 'stella.mathilda@tectona.local',
    password: 'StellaPass1!',
    name: 'Stella Mathilda',
    role: 'brm_head',
  },
  {
    email: 'tri.untari@tectona.local',
    password: 'TriPass1!',
    name: 'Tri Untari',
    role: 'brm_head',
  },
  {
    email: 'puspa.arundini@tectona.local',
    password: 'PuspaPass1!',
    name: 'Puspa Arundini',
    role: 'business_analyst',
  },
  {
    email: 'dorkas.mahulae@tectona.local',
    password: 'DorkasPass1!',
    name: 'Dorkas Mahulae',
    role: 'business_analyst',
  },
  {
    email: 'ferli.kumolontang@tectona.local',
    password: 'FerliPass1!',
    name: 'Ferli Kumolontang',
    role: 'business_analyst',
  },
] as const

export interface Session {
  user: {
    id: string
    name: string
    email: string
    role: string
    roles?: string[]
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
  userinfo: { sub: string; email?: string; roles?: string[] },
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
      name: resolvedEmail.split('@')[0] ?? 'User',
      email: resolvedEmail,
      role: uiRole,
      roles: userinfo.roles ?? [],
    },
    token: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString(),
    loginAt: new Date().toISOString(),
  }
}

async function performRefresh(session: Session): Promise<Session | null> {
  if (!session.refreshToken) {
    logout()
    emitSessionExpired({ reason: 'no_refresh_token' })
    return null
  }
  try {
    const tokenResponse = await refreshAccessToken(session.refreshToken)
    const updated = applyTokenResponse(session, tokenResponse)
    persistSession(updated)
    return updated
  } catch {
    logout()
    emitSessionExpired({ reason: 'refresh_failed' })
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
      logout()
      emitSessionExpired({ reason: 'expired' })
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

export async function login(email: string, password: string): Promise<Session> {
  const normalizedEmail = normalizeLoginEmail(email)
  const tokenResponse = await loginWithPassword(normalizedEmail, password)
  const userinfo = await fetchUserInfo(tokenResponse.access_token)
  const session = buildSessionFromUserinfo(userinfo, normalizedEmail, tokenResponse)
  persistSession(session)
  void import('@/lib/chat/chatContactDirectory')
    .then(({ publishCollaborationPresenceWithToken }) =>
      publishCollaborationPresenceWithToken(session.token, 'online'),
    )
    .catch(() => undefined)
  emitSessionActive()
  useMyPresenceStore.getState().setStatus('online')
  return session
}

async function publishOfflinePresence(session: Session | null): Promise<void> {
  if (!session) return
  let token = session.token
  if (session.refreshToken && isAccessTokenExpired(session)) {
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

export function logout(): void {
  const session = readStoredSession()
  localStorage.removeItem(SESSION_KEY)
  useCollaborationPresenceStore.getState().clear()
  useVoiceRecordRequestStore.getState().clear()
  useMyPresenceStore.getState().setStatus('offline')
  void publishOfflinePresence(session).catch(() => undefined)
}

/** Await offline publish before navigation (explicit Sign out). */
export async function logoutAsync(): Promise<void> {
  const session = readStoredSession()
  localStorage.removeItem(SESSION_KEY)
  useCollaborationPresenceStore.getState().clear()
  useVoiceRecordRequestStore.getState().clear()
  useMyPresenceStore.getState().setStatus('offline')
  try {
    await publishOfflinePresence(session)
  } catch {
    // ignore
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
    logout()
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
