import { ArrowLeft, RotateCw, Settings } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AccessStatusScreen } from '@/components/enterprise/AccessStatusScreen'

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
    <AccessStatusScreen
      title="Access denied"
      description={platformSettingsDenied
        ? 'Platform Settings & Administration is restricted to platform administrators. Workspace owners can manage their workspace from Workspace Settings.'
        : 'You don’t have permission to access this module. If you believe this is a mistake, contact your workspace administrator.'}
      context={
        fromPath ? (
          <p className="text-xs text-muted-foreground">
            Requested page:{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{fromPath}</code>
          </p>
        ) : null
      }
      actions={
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
      }
    />
  )
}
