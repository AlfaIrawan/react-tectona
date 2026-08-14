import { LogOut, Mail, ShieldAlert } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { logoutAsync } from '@/auth/authService'
import { authCardButtonClass } from '@/lib/authUiClasses'

export function NoWorkspaceAccessPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const fromPath =
    typeof location.state === 'object' &&
    location.state !== null &&
    'from' in location.state &&
    typeof (location.state as { from?: string }).from === 'string'
      ? (location.state as { from: string }).from
      : null

  const handleSignOut = async () => {
    await logoutAsync()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-lg shadow-2xl p-8 space-y-6">

          {/* Header — selaras dengan LoginPage */}
          <div className="space-y-2 text-center">
            <img
              src="/images/logo.png"
              alt="Tectona"
              className="mx-auto h-24 w-auto object-contain"
            />
          </div>

          {/* Alert block */}
          <div className="flex items-start gap-3 rounded-md bg-amber-500/10 border border-amber-500/30 px-4 py-3">
            <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-amber-900 dark:text-amber-100">
                No workspace access
              </p>
              <p className="text-amber-800/80 dark:text-amber-200/80 leading-relaxed">
                Your identity has been verified, but you are not yet registered as a member of any
                Tectona workspace. Ask your workspace administrator to invite you via{' '}
                <strong className="font-semibold">Workspace Management → Invite Member</strong>.
              </p>
            </div>
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <span>
              Once invited, your account will be activated and you can sign in again.
            </span>
          </div>

          {/* Requested path */}
          {fromPath && (
            <p className="text-xs text-muted-foreground">
              Requested page:{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{fromPath}</code>
            </p>
          )}

          {/* Sign-out button — full width, same style as Login submit */}
          <Button
            type="button"
            variant="outline"
            className={authCardButtonClass}
            onClick={() => void handleSignOut()}
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </Button>

        </div>
      </div>
    </div>
  )
}
