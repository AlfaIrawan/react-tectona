const PKCE_VERIFIER_KEY = 'tectona:oauth:pkce-verifier'
const PKCE_STATE_KEY = 'tectona:oauth:state'
const OAUTH_INTENT_KEY = 'tectona:oauth-intent'

export type OAuthIntent = 'signin' | 'signup'

function randomString(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Base64Url(input: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      'Microsoft sign-in needs a secure connection (HTTPS or localhost). ' +
        'On Ubuntu dev, enable TLS for tectona-dev.adira.co.id or use password sign-in.',
    )
  }
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(digest)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomString(32)
  const challenge = await sha256Base64Url(verifier)
  return { verifier, challenge }
}

export function storeOAuthSession(verifier: string, state: string): void {
  sessionStorage.removeItem('tectona:oauth-processed-code')
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier)
  sessionStorage.setItem(PKCE_STATE_KEY, state)
}

export function readOAuthSession(): { verifier: string | null; state: string | null } {
  return {
    verifier: sessionStorage.getItem(PKCE_VERIFIER_KEY),
    state: sessionStorage.getItem(PKCE_STATE_KEY),
  }
}

export function clearOAuthSession(): void {
  sessionStorage.removeItem(PKCE_VERIFIER_KEY)
  sessionStorage.removeItem(PKCE_STATE_KEY)
  clearOAuthIntent()
}

export function storeOAuthIntent(intent: OAuthIntent): void {
  sessionStorage.setItem(OAUTH_INTENT_KEY, intent)
}

export function readOAuthIntent(): OAuthIntent | null {
  const value = sessionStorage.getItem(OAUTH_INTENT_KEY)
  return value === 'signup' || value === 'signin' ? value : null
}

export function clearOAuthIntent(): void {
  sessionStorage.removeItem(OAUTH_INTENT_KEY)
}

export function createOAuthState(): string {
  return randomString(16)
}
