import { ShieldAlert, ArrowLeft, RotateCw, Settings } from 'lucide-react'
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
  const platformSettingsDenied = Boolean(
    fromPath?.includes('/platform-settings-administration'),
  )
  const workspacePrefix = fromPath?.match(/^\/w\/[^/]+/)?.[0]
  const workspaceSettingsPath = workspacePrefix
    ? `${workspacePrefix}/workspace-management`
    : '/workspace-management'

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="liquid-glass-enterprise-panel rounded-lg p-8 space-y-6">
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
                {platformSettingsDenied
                  ? 'Platform Settings & Administration is restricted to platform administrators. Workspace owners can manage their workspace from Workspace Settings.'
                  : 'You don’t have permission to access this module. If you believe this is a mistake, contact your workspace administrator.'}
              </p>
            </div>
          </div>

          {fromPath ? (
            <p className="text-xs text-muted-foreground">
              Requested page:{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{fromPath}</code>
            </p>
          ) : null}

          <div className={fromPath ? 'grid grid-cols-2 gap-2' : undefined}>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Go back
            </Button>
            {fromPath ? (
              <Button
                type="button"
                className="w-full gap-2"
                onClick={() => navigate(
                  platformSettingsDenied ? workspaceSettingsPath : fromPath,
                  { replace: true },
                )}
              >
                {platformSettingsDenied ? (
                  <Settings className="h-4 w-4" aria-hidden />
                ) : (
                  <RotateCw className="h-4 w-4" aria-hidden />
                )}
                {platformSettingsDenied ? 'Workspace settings' : 'Retry access'}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

