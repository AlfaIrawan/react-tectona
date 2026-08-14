/** Maps identity-lite / OAuth error codes to user-facing copy (login, register, SSO). */

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_grant:
    'Incorrect email or password. Check your email spelling and password, then try again.',
  session_revoked:
    'You were signed out because this account was used to sign in on another device or browser.',
  invalid_credentials:
    'Incorrect email or password. Check your email spelling and password, then try again.',
  invalid_client: 'Sign-in is not configured correctly. Please contact your administrator.',
  invalid_request: 'We could not complete sign-in. Please try again.',
  invalid_redirect_uri: 'Sign-in redirect is misconfigured. Please contact your administrator.',
  unsupported_grant_type: 'This sign-in method is not available.',
  unsupported_response_type: 'This sign-in method is not available.',
  account_pending_activation:
    'Your account is waiting for activation. Ask your workspace administrator to approve your access.',
  account_not_active: 'Your account is not active. Contact your workspace administrator.',
  account_not_registered:
    'User belum terdaftar. Silakan Sign up terlebih dahulu sebelum masuk dengan Microsoft.',
  password_grant_disabled: 'Email and password sign-in is disabled for this environment.',
  weak_password: 'Password does not meet security requirements. Use a stronger password.',
  access_denied: 'Sign-in was cancelled or denied.',
  temporarily_unavailable: 'Sign-in service is temporarily unavailable. Please try again shortly.',
  server_error: 'Sign-in service encountered an error. Please try again.',
  identity_service_timeout:
    'Sign-in service is not responding. Restart identity-lite (port 8430) or Docker Desktop, then try again.',
  identity_service_unreachable:
    'Cannot reach the sign-in service. Check that identity-lite is running on port 8430.',
}

function normalizeErrorCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_')
}

function looksLikeMachineErrorCode(raw: string): boolean {
  const t = raw.trim()
  if (!t || t.length > 120) return false
  if (/^aadsts\d/i.test(t)) return true
  if (/^(microsoft|google|meta)_/i.test(t)) return true
  if (/federation/i.test(t) && t.length < 80) return true
  return /^[a-z][a-z0-9_:-]*$/i.test(t)
}

function messageForCode(code: string): string | undefined {
  const normalized = normalizeErrorCode(code)
  if (AUTH_ERROR_MESSAGES[normalized]) return AUTH_ERROR_MESSAGES[normalized]

  if (normalized.startsWith('account_not_active')) {
    return AUTH_ERROR_MESSAGES.account_not_active
  }
  if (looksLikeMachineErrorCode(code)) {
    if (normalized.includes('microsoft') || normalized.includes('federation')) {
      return 'Microsoft sign-in failed. Try again, or sign in with email and password if you created your account that way.'
    }
  }
  return undefined
}

/**
 * Turn raw API/OAuth errors into readable messages. Unknown codes fall back to a generic prompt.
 * Idempotent: already-friendly sentences are returned unchanged.
 */
export function formatAuthErrorMessage(raw: string, status?: number): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    if (status === 502 || status === 503) {
      return 'Identity service is unavailable. Ensure identity-lite is running on port 8430, then try again.'
    }
    if (status === 401) {
      return AUTH_ERROR_MESSAGES.invalid_grant
    }
    if (status === 500) {
      return 'Something went wrong on the sign-in service. Please try again or contact support.'
    }
    return 'Sign-in failed. Please try again.'
  }

  if (trimmed === 'Failed to fetch' || /network|fetch/i.test(trimmed)) {
    return 'Cannot reach the identity service. Check that identity-lite is running (port 8430) and refresh this page.'
  }

  // Already formatted (e.g. returned from identityApi.parseTokenError) — avoid double-mapping
  if (!looksLikeMachineErrorCode(trimmed) && trimmed.length > 32) {
    return trimmed
  }

  const mapped = messageForCode(trimmed)
  if (mapped) return mapped

  // OAuth error_description often starts with AADSTS… — shorten for UI
  if (/^aadsts\d+/i.test(trimmed)) {
    if (/redirect_uri/i.test(trimmed)) {
      return 'Microsoft sign-in redirect is not registered in Azure. Ask IT to add the callback URL for Tectona.'
    }
    if (/consumers|personal microsoft/i.test(trimmed)) {
      return 'This Microsoft app only supports personal accounts (@outlook.com). Use a personal Microsoft account or sign in with email and password.'
    }
    return 'Microsoft sign-in could not be completed. Try again or use email and password.'
  }

  // Avoid showing snake_case codes or JSON blobs
  if (/^[a-z][a-z0-9_]*$/i.test(trimmed) && trimmed.includes('_')) {
    return 'Sign-in failed. Please check your email and password, or try another sign-in method.'
  }

  if (trimmed.length > 160) {
    return `${trimmed.slice(0, 157)}…`
  }

  return trimmed
}

/** OAuth authorization-code exchange — never show password-login copy for invalid_grant. */
export function formatOAuthExchangeError(raw: string, status?: number): string {
  const trimmed = raw.trim()
  const lower = trimmed.toLowerCase()
  if (
    lower === 'invalid_grant'
    || lower.includes('invalid_grant')
    || lower.includes('incorrect email or password')
  ) {
    return 'Microsoft sign-in could not be completed. Go back to the login page and sign in with Microsoft again.'
  }
  return formatAuthErrorMessage(raw, status)
}
