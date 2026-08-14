/** Configurable auth providers for login/register (password + optional social IdPs). */

export type SocialAuthProviderId = 'microsoft' | 'google' | 'meta'

export type SocialAuthProvider = {
  id: SocialAuthProviderId
  label: string
  signInLabel: string
  signUpLabel: string
}

const SOCIAL_PROVIDER_IDS = new Set<SocialAuthProviderId>(['microsoft', 'google', 'meta'])

const SOCIAL_CATALOG: Record<SocialAuthProviderId, SocialAuthProvider> = {
  microsoft: {
    id: 'microsoft',
    label: 'Microsoft',
    signInLabel: 'Sign in with Microsoft',
    signUpLabel: 'Sign up with Microsoft',
  },
  google: {
    id: 'google',
    label: 'Google',
    signInLabel: 'Sign in with Google',
    signUpLabel: 'Sign up with Google',
  },
  meta: {
    id: 'meta',
    label: 'Meta',
    signInLabel: 'Sign in with Meta',
    signUpLabel: 'Sign up with Meta',
  },
}

function envFlag(name: string): string | undefined {
  return (import.meta.env[name] as string | undefined)?.trim()
}

function parseProviderList(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
}

/** All providers from VITE_AUTH_PROVIDERS (default: password only). */
export function parseEnabledAuthProviders(): Set<string> {
  const raw = envFlag('VITE_AUTH_PROVIDERS') ?? 'password'
  return new Set(parseProviderList(raw))
}

export function isPasswordAuthEnabled(): boolean {
  const enabled = parseEnabledAuthProviders()
  return enabled.has('password') || !isSocialAuthSectionEnabled()
}

/** Social buttons to render — order follows VITE_AUTH_PROVIDERS. */
export function listSocialAuthProviders(): SocialAuthProvider[] {
  const enabled = parseEnabledAuthProviders()
  const ordered = parseProviderList(envFlag('VITE_AUTH_PROVIDERS') ?? 'password')

  const ids = ordered.filter((id): id is SocialAuthProviderId =>
    SOCIAL_PROVIDER_IDS.has(id as SocialAuthProviderId) && enabled.has(id),
  )

  // Fallback if social ids enabled but not in ordered list (unlikely)
  if (ids.length === 0) {
    for (const id of SOCIAL_PROVIDER_IDS) {
      if (enabled.has(id)) ids.push(id)
    }
  }

  return ids.map((id) => SOCIAL_CATALOG[id])
}

export function isSocialAuthSectionEnabled(): boolean {
  return listSocialAuthProviders().length > 0
}

export function isSocialProviderEnabled(id: SocialAuthProviderId): boolean {
  return parseEnabledAuthProviders().has(id)
}

export function buildOidcAuthorizeUrl(
  provider: SocialAuthProviderId,
  redirectUri: string,
  opts?: { state?: string; codeChallenge?: string; codeVerifier?: string; oauthIntent?: 'signin' | 'signup' },
): string {
  const base = (envFlag('VITE_IDENTITY_LITE_API_URL') ?? '/api/identity-lite').replace(/\/$/, '')
  const clientId = envFlag('VITE_TECTONA_OIDC_CLIENT_ID') ?? 'tectona-spa'
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid profile email',
    idp: provider,
  })
  if (opts?.state) params.set('state', opts.state)
  if (opts?.codeChallenge) {
    params.set('code_challenge', opts.codeChallenge)
    params.set('code_challenge_method', 'S256')
  }
  if (opts?.codeVerifier && provider === 'microsoft') {
    params.set('idp_code_verifier', opts.codeVerifier)
  }
  if (opts?.oauthIntent) {
    params.set('oauth_intent', opts.oauthIntent)
  }
  return `${base}/oauth2/authorize?${params}`
}

export async function startSocialOAuthLogin(provider: SocialAuthProviderId): Promise<void> {
  if (!isSocialProviderEnabled(provider)) {
    throw new Error(`${SOCIAL_CATALOG[provider].label} sign-in is disabled in VITE_AUTH_PROVIDERS.`)
  }

  const { createPkcePair, createOAuthState, storeOAuthSession, readOAuthIntent } = await import('@/lib/oauthPkce')
  const { storeOAuthProvider } = await import('@/lib/authMethodSession')
  storeOAuthProvider(provider)
  const { verifier, challenge } = await createPkcePair()
  const state = createOAuthState()
  storeOAuthSession(verifier, state)
  const redirectUri = `${window.location.origin}/login/oauth/callback`
  const oauthIntent = readOAuthIntent() ?? 'signin'
  window.location.href = buildOidcAuthorizeUrl(provider, redirectUri, {
    state,
    codeChallenge: challenge,
    codeVerifier: verifier,
    oauthIntent,
  })
}
