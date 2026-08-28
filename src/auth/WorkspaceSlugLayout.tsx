import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { PlatformRouteLoadingFallback } from '@/components/loading'
import { useTenantContext } from '@/auth/TenantContext'
import { evaluateWorkspaceSlugAccess } from '@/lib/workspaceSlugAccess'
import {
  isAllWorkspacesRouteScope,
  workspaceScopedPath,
} from '@/lib/workspaceRouting'

type SlugAccessState = 'pending' | 'allowed' | 'denied'

/** Syncs active tenant from `/w/:workspaceSlug/*` and renders nested shell routes. */
export function WorkspaceSlugLayout() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>()
  const { setActiveTenant } = useTenantContext()
  const location = useLocation()
  const [accessState, setAccessState] = useState<SlugAccessState>('pending')

  useEffect(() => {
    const normalizedParam = workspaceSlug?.trim()
    if (!normalizedParam) {
      setAccessState('denied')
      return
    }

    let cancelled = false
    setAccessState('pending')

    void evaluateWorkspaceSlugAccess(normalizedParam)
      .then((result) => {
        if (cancelled) return
        if (!result.allowed) {
          setAccessState('denied')
          return
        }

        setActiveTenant({
          workspaceId: result.slug.workspace_id,
          orgId: result.slug.org_id,
          slug: result.slug.slug,
          tenantMode: result.slug.tenant_mode,
          displayName: result.slug.display_name,
        })
        setAccessState('allowed')
      })
      .catch(() => {
        if (!cancelled) setAccessState('denied')
      })

    return () => {
      cancelled = true
    }
  // Do not restart access evaluation when TenantContext hydrates or normalizes
  // the active tenant. Root/admin hydration changes activeWorkspaceId after
  // mount; including it here resets the route to "pending" and loops API calls.
  }, [workspaceSlug, setActiveTenant])

  if (!workspaceSlug?.trim()) {
    return <Navigate to="/projects" replace />
  }

  if (accessState === 'pending') {
    return (
      <PlatformRouteLoadingFallback
        title="Checking workspace access…"
        description="Verifying that you may open this workspace."
      />
    )
  }

  if (accessState === 'denied') {
    return <Navigate to="/access-denied" replace state={{ from: location.pathname }} />
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
