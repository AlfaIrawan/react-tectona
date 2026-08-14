import { useMemo, useState } from 'react'
import { formatAuthErrorMessage } from '@/lib/authErrorMessages'
import {
  isSocialAuthSectionEnabled,
  listSocialAuthProviders,
  startSocialOAuthLogin,
  type SocialAuthProvider,
} from '@/lib/authProviders'
import { storeOAuthIntent } from '@/lib/oauthPkce'
import { Button } from '@/components/ui/button'
import { authCardButtonClass } from '@/lib/authUiClasses'
import { cn } from '@/lib/utils'
import { providerIcon } from '@/modules/auth/components/authProviderIcons'

type AuthSocialProvidersProps = {
  mode: 'signin' | 'signup'
  className?: string
  id?: string
}

export function AuthSocialProviders({ mode, className, id }: AuthSocialProvidersProps) {
  const providers = useMemo(() => listSocialAuthProviders(), [])
  const [hint, setHint] = useState<string | null>(null)

  if (!isSocialAuthSectionEnabled() || providers.length === 0) {
    return null
  }

  const handleClick = (provider: SocialAuthProvider) => {
    sessionStorage.setItem('tectona:oauth-next', window.location.pathname === '/register' ? '/onboarding' : '/')
    storeOAuthIntent(mode === 'signup' ? 'signup' : 'signin')
    void startSocialOAuthLogin(provider.id).catch((err) => {
      const msg = err instanceof Error ? err.message : 'Failed to start OAuth login.'
      setHint(formatAuthErrorMessage(msg))
    })
  }

  const labelFor = (p: SocialAuthProvider) => (mode === 'signup' ? p.signUpLabel : p.signInLabel)

  return (
    <div id={id} className={cn('space-y-3', className)}>
      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <span className="w-full border-t border-border/60" />
        </div>
        <p className="relative flex justify-center text-xs uppercase tracking-wide text-muted-foreground">
          <span className="bg-card px-2">Or continue with</span>
        </p>
      </div>

      <div className="space-y-2">
        {providers.map((provider) => (
          <Button
            key={provider.id}
            type="button"
            variant="outline"
            className={cn(authCardButtonClass, 'relative font-normal gap-3')}
            onClick={() => handleClick(provider)}
          >
            {providerIcon(provider.id)}
            <span>{labelFor(provider)}</span>
          </Button>
        ))}
      </div>

      {hint && (
        <p className="text-xs text-muted-foreground text-center" role="status">
          {hint}
        </p>
      )}
    </div>
  )
}
