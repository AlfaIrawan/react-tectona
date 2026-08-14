import type { SocialAuthProvider } from '@/lib/authProviders'

export function providerIcon(id: SocialAuthProvider['id']) {
  const common = 'h-4 w-4 shrink-0'
  switch (id) {
    case 'microsoft':
      return (
        <svg className={common} viewBox="0 0 24 24" aria-hidden>
          <rect x="1" y="1" width="10" height="10" fill="#f25022" />
          <rect x="13" y="1" width="10" height="10" fill="#7fba00" />
          <rect x="1" y="13" width="10" height="10" fill="#00a4ef" />
          <rect x="13" y="13" width="10" height="10" fill="#ffb900" />
        </svg>
      )
    case 'google':
      return (
        <svg className={common} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      )
    case 'meta':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="#0866FF" aria-hidden>
          <path d="M12 2C6.48 2 2 6.15 2 11.25c0 2.65 1.3 5.02 3.33 6.55L4.5 22l4.55-2.38c.95.26 1.95.4 2.95.4 5.52 0 10-4.15 10-9.25S17.52 2 12 2zm0 16.5c-.88 0-1.74-.12-2.55-.35l-.18-.05-2.45 1.28.52-2.38-.12-.18A7.2 7.2 0 0 1 4.75 11.25C4.75 7.28 8.03 4 12 4s7.25 3.28 7.25 7.25-3.28 7.25-7.25 7.25z" />
        </svg>
      )
    default:
      return null
  }
}
