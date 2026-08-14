/**
 * Passkey (WebAuthn) ceremonies via identity-lite.
 * Uses @simplewebauthn/browser to handle the base64url / ArrayBuffer conversions so the
 * options from py_webauthn map straight through.
 */
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'
import { IDENTITY_API_BASE, TECTONA_OIDC_CLIENT_ID } from './gatewayBase'

export interface PasskeyTokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
}

async function postJson<T>(path: string, body: unknown, accessToken?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const res = await fetch(`${IDENTITY_API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const j = await res.json()
      detail = (j?.detail as string) || detail
    } catch {
      /* ignore parse error */
    }
    throw new Error(detail)
  }
  return (await res.json()) as T
}

/** Enrol a new passkey for the signed-in user. Requires the current access token. */
export async function enrollPasskey(
  accessToken: string,
  label?: string,
): Promise<{ credential_id: string }> {
  const begin = await postJson<{ options: unknown; ceremony: string }>(
    '/webauthn/register/begin',
    {},
    accessToken,
  )
  const attResp = await startRegistration(begin.options as never)
  return postJson(
    '/webauthn/register/complete',
    { ceremony: begin.ceremony, credential: attResp, label },
    accessToken,
  )
}

/** Maps raw WebAuthn / ceremony errors to friendly, human copy. */
export function passkeyErrorMessage(err: unknown, mode: 'signin' | 'enroll' = 'signin'): string {
  const name = (err as { name?: string })?.name
  const msg = err instanceof Error ? err.message : String(err)

  if (name === 'NotAllowedError' || /not allowed|timed out|operation either/i.test(msg)) {
    return mode === 'enroll'
      ? 'Setup was cancelled or timed out. Please try adding the passkey again.'
      : 'Passkey sign-in was cancelled or timed out. If you haven’t set up a passkey yet, sign in another way first, then add one in your Profile.'
  }
  if (name === 'InvalidStateError' || /already/i.test(msg)) {
    return 'A passkey for your account is already set up on this device.'
  }
  if (name === 'NotSupportedError' || /not supported|no available authenticator/i.test(msg)) {
    return 'This device or browser doesn’t support passkeys.'
  }
  if (name === 'SecurityError') {
    return 'Passkey was blocked for security reasons. Make sure you’re on the correct site.'
  }
  if (/unknown_credential|no_sso|account_not_active|HTTP 401|(^|\D)401(\D|$)/i.test(msg)) {
    return 'This passkey isn’t recognized. Add a passkey from your Profile first, then try again.'
  }
  return mode === 'enroll'
    ? 'Could not add the passkey. Please try again.'
    : 'Could not sign in with a passkey. Please try again or use another sign-in method.'
}

/** Sign in with a passkey (usernameless / discoverable). Returns an OIDC token bundle. */
export async function authenticateWithPasskey(
  clientId: string = TECTONA_OIDC_CLIENT_ID,
): Promise<PasskeyTokenResponse> {
  const begin = await postJson<{ options: unknown; ceremony: string }>(
    '/webauthn/authenticate/begin',
    {},
  )
  const asseResp = await startAuthentication(begin.options as never)
  return postJson('/webauthn/authenticate/complete', {
    ceremony: begin.ceremony,
    credential: asseResp,
    client_id: clientId,
  })
}
