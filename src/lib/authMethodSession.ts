const AUTH_METHOD_KEY = 'tectona:auth-method'
const OAUTH_PROVIDER_KEY = 'tectona:oauth-provider'

export type AuthMethod = 'password' | 'microsoft' | 'google' | 'meta'

export function storeOAuthProvider(provider: AuthMethod): void {
  sessionStorage.setItem(OAUTH_PROVIDER_KEY, provider)
}

export function readOAuthProvider(): AuthMethod | null {
  const value = sessionStorage.getItem(OAUTH_PROVIDER_KEY)
  if (value === 'microsoft' || value === 'google' || value === 'meta') return value
  return null
}

export function clearOAuthProvider(): void {
  sessionStorage.removeItem(OAUTH_PROVIDER_KEY)
}

/** Persist how the user signed in (survives onboarding wizard). */
export function persistAuthMethod(method: AuthMethod): void {
  sessionStorage.setItem(AUTH_METHOD_KEY, method)
}

export function readAuthMethod(): AuthMethod | null {
  const value = sessionStorage.getItem(AUTH_METHOD_KEY)
  if (value === 'password' || value === 'microsoft' || value === 'google' || value === 'meta') {
    return value
  }
  return null
}

export function clearAuthMethod(): void {
  sessionStorage.removeItem(AUTH_METHOD_KEY)
}
