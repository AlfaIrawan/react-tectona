import { describe, expect, it } from 'vitest'
import { buildOidcAuthorizeUrl } from './authProviders'

describe('OAuth authorization URL security', () => {
  it.each(['microsoft', 'google', 'meta'] as const)('sends a challenge, never a verifier, for %s', (provider) => {
    const input = {
      state: 'test-state',
      codeChallenge: 'test-challenge',
      codeVerifier: 'secret-verifier',
      oauthIntent: 'signin' as const,
    }
    const url = new URL(buildOidcAuthorizeUrl(provider, 'http://localhost:9411/login/oauth/callback', input), 'http://localhost:9411')
    expect(url.searchParams.get('state')).toBe('test-state')
    expect(url.searchParams.get('code_challenge')).toBe('test-challenge')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.has('code_verifier')).toBe(false)
    expect(url.searchParams.has('idp_code_verifier')).toBe(false)
    expect(url.href).not.toContain('secret-verifier')
  })
})
