import { LifeBuoy, RotateCw } from 'lucide-react'
import { AccessStatusScreen } from '@/components/enterprise/AccessStatusScreen'
import { Button, buttonVariants } from '@/components/ui/button'
import { trustedSupportPortalUrl, type WorkspaceAccessDependency } from '@/lib/workspaceAccessWarning'

const titles: Record<WorkspaceAccessDependency, string> = {
  'workspace-directory': 'Workspace directory unavailable',
  'workspace-access': 'Workspace access verification unavailable',
  identity: 'Identity verification unavailable',
  unknown: 'Temporarily unavailable',
}

/** Unknown access is not evidence that the user needs a new workspace. */
export function OnboardingUnavailable({ onRetry, retrying = false, dependency = 'unknown', embedded = false }: {
  onRetry: () => void
  retrying?: boolean
  embedded?: boolean
  dependency?: WorkspaceAccessDependency
}) {
  const supportUrl = trustedSupportPortalUrl(import.meta.env.VITE_TECTONA_SUPPORT_PORTAL_URL, window.location.origin)

  return (
    <AccessStatusScreen
      title={titles[dependency]}
      description="We couldn't verify your access. Your saved work has not been changed."
      announce
      embedded={embedded}
      actions={
        <div className={supportUrl ? 'grid grid-cols-1 gap-2 sm:grid-cols-2' : undefined}>
          {supportUrl && (
            <a href={supportUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
              data-theme-button="outline"
              className={buttonVariants({ variant: 'outline', className: 'w-full gap-2' })}>
              <LifeBuoy className="h-4 w-4" aria-hidden />
              Create support ticket
            </a>
          )}
          <Button type="button" className="w-full gap-2" disabled={retrying} onClick={onRetry}>
            <RotateCw className="h-4 w-4" aria-hidden />
            {retrying ? 'Checking access...' : 'Try again'}
          </Button>
        </div>
      }
    />
  )
}
