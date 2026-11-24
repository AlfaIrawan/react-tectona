import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { PlatformRouteLoadingFallback } from '@/components/loading'
import { OnboardingUnavailable } from './OnboardingUnavailable'
import { sanitizePostLoginPath } from './loginRedirect'
import { getSession } from './authService'
import type { WorkspaceAccessDependency } from '@/lib/workspaceAccessWarning'
import { useTenantContext } from '@/auth/TenantContext'
import { evaluateWorkspaceSlugAccess } from '@/lib/workspaceSlugAccess'
import {
  isAllWorkspacesRouteScope,
  workspaceScopedPath,
} from '@/lib/workspaceRouting'

type SlugAccessState = { status: 'allowed' | 'denied' | 'unauthenticated' } | { status: 'unavailable'; dependency: WorkspaceAccessDependency }

/** Syncs active tenant from `/w/:workspaceSlug/*` and renders nested shell routes. */
export function WorkspaceSlugLayout() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>()
  const { setActiveTenant, workspaceId: activeWorkspaceId } = useTenantContext()
  const location = useLocation()
  const [attempt, setAttempt] = useState(0)
  const subjectId = getSession()?.user.id
  const verificationKey = JSON.stringify([workspaceSlug, subjectId, attempt])
  const [verification, setVerification] = useState<{ key: string; access: SlugAccessState }>()
  const accessState = verification?.key === verificationKey ? verification.access : undefined
  // Read inside the effect without restarting it (see the dependency note below).
  const activeWorkspaceIdRef = useRef(activeWorkspaceId)
  activeWorkspaceIdRef.current = activeWorkspaceId

  useEffect(() => {
    const normalizedParam = workspaceSlug?.trim()
    if (!normalizedParam) return

    let cancelled = false
    const finish = (access: SlugAccessState) => setVerification({ key: verificationKey, access })

    void evaluateWorkspaceSlugAccess(normalizedParam)
      .then((result) => {
        if (cancelled || getSession()?.user.id !== subjectId) return
        if (result.allowed === false) {
          if (result.reason === 'unavailable') finish({ status: 'unavailable', dependency: result.dependency })
          else if (result.reason === 'unauthenticated') finish({ status: 'unauthenticated' })
          else finish({ status: 'denied' })
          return
        }

        setActiveTenant({
          workspaceId: result.slug.workspace_id,
          orgId: result.slug.org_id,
          slug: result.slug.slug,
          tenantMode: result.slug.tenant_mode,
          displayName: result.slug.display_name,
        }, {
          // Opening another workspace's URL is a choice; the URL the app itself redirected to
          // for the active workspace is not, and must not replace the remembered one.
          remember: result.slug.workspace_id !== activeWorkspaceIdRef.current,
        })
        finish({ status: 'allowed' })
      })
      .catch(() => {
        if (!cancelled && getSession()?.user.id === subjectId) finish({ status: 'unavailable', dependency: 'unknown' })
      })

    return () => {
      cancelled = true
    }
  // Do not restart access evaluation when TenantContext hydrates or normalizes
  // the active tenant. Root/admin hydration changes activeWorkspaceId after
  // mount; including it here resets the route to "pending" and loops API calls.
  }, [workspaceSlug, setActiveTenant, subjectId, verificationKey])

  if (!workspaceSlug?.trim()) {
    return <Navigate to="/idea-backlog" replace />
  }

  if (!accessState) {
    return (
      <PlatformRouteLoadingFallback
        title="Checking workspace access…"
        description="Verifying that you may open this workspace."
      />
    )
  }

  if (accessState.status === 'denied') {
    return <Navigate to="/access-denied" replace state={{ from: location.pathname }} />
  }

  if (accessState.status === 'unauthenticated') {
    const next = sanitizePostLoginPath(location.pathname + location.search)
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }

  if (accessState.status === 'unavailable') {
    return <OnboardingUnavailable embedded dependency={accessState.dependency} onRetry={() => setAttempt((a) => a + 1)} />
  }

  return <Outlet />
}

/** Redirects legacy paths (`/projects`) to workspace-scoped URLs when a slug tenant is active. */
export function WorkspaceScopeRedirectLayout() {
  const { slug, workspaceId } = useTenantContext()
  const location = useLocation()

  if (!isAllWorkspacesRouteScope(workspaceId) && slug?.trim()) {
    const target = workspaceScopedPath(
      slug,
      `${location.pathname}${location.search}${location.hash}`,
      workspaceId,
    )
    if (target !== `${location.pathname}${location.search}${location.hash}`) {
      return <Navigate to={target} replace state={location.state} />
    }
  }

  return <Outlet />
}
