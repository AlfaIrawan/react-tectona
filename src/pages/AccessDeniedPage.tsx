import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function AccessDeniedPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const fromPath =
    typeof location.state === 'object' &&
    location.state !== null &&
    'from' in location.state &&
    typeof (location.state as { from?: string }).from === 'string'
      ? (location.state as { from: string }).from
      : null

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-lg shadow-2xl p-8 space-y-6">
          <div className="space-y-2 text-center">
            <img
              src="/images/logo.png"
              alt="Tectona"
              className="mx-auto h-24 w-auto object-contain"
            />
          </div>

          <div className="flex items-start gap-3 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3">
            <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 text-destructive" aria-hidden />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-foreground">Access denied</p>
              <p className="text-muted-foreground leading-relaxed">
                You don’t have permission to access this module. If you believe this is a mistake,
                contact your workspace administrator.
              </p>
            </div>
          </div>

          {fromPath ? (
            <p className="text-xs text-muted-foreground">
              Requested page:{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{fromPath}</code>
            </p>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Go back
          </Button>
        </div>
      </div>
    </div>
  )
}

