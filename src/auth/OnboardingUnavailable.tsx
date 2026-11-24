import { trustedSupportPortalUrl, type WorkspaceAccessDependency } from '@/lib/workspaceAccessWarning'

const titles: Record<WorkspaceAccessDependency, string> = {
  'workspace-directory': 'Workspace directory unavailable',
  'workspace-access': 'Workspace access verification unavailable',
  identity: 'Identity verification unavailable',
  unknown: 'Temporarily unavailable',
}

/** Unknown access is not evidence that the user needs a new workspace. */
export function OnboardingUnavailable({ onRetry, retrying = false, dependency = 'unknown' }: {
  onRetry: () => void
  retrying?: boolean
  dependency?: WorkspaceAccessDependency
}) {
  const supportUrl = trustedSupportPortalUrl(import.meta.env.VITE_TECTONA_SUPPORT_PORTAL_URL, window.location.origin)

  return (
    <section role="alert" className="mx-auto max-w-lg space-y-4 p-8">
      <h1 className="text-lg font-semibold">{titles[dependency]}</h1>
      <p>We couldn't verify your access. Your saved work has not been changed.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="rounded border px-4 py-2" disabled={retrying} onClick={onRetry}>
          {retrying ? 'Checking access...' : 'Try again'}
        </button>
        {supportUrl && (
          <a href={supportUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="rounded border px-4 py-2">
            Create support ticket
          </a>
        )}
      </div>
    </section>
  )
}
