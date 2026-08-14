import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { PlatformRouteLoadingFallback } from '@/components/loading'
import { useTenantContext } from '@/auth/TenantContext'
import { evaluateWorkspaceSlugAccess } from '@/lib/workspaceSlugAccess'
import { workspaceScopedPath } from '@/lib/workspaceRouting'

export function TenantDeepLinkPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { setActiveTenant } = useTenantContext()
  const [error, setError] = useState('')

  useEffect(() => {
    const normalized = slug?.trim()
    if (!normalized) {
      setError('Invalid slug.')
      return
    }

    let cancelled = false
    void evaluateWorkspaceSlugAccess(normalized)
      .then((result) => {
        if (cancelled) return
        if (!result.allowed) {
          if (result.reason === 'invalid_slug') {
            setError('Workspace not found.')
            return
          }
          navigate('/access-denied', { replace: true })
          return
        }

        setActiveTenant({
          workspaceId: result.slug.workspace_id,
          orgId: result.slug.org_id,
          slug: result.slug.slug,
          tenantMode: result.slug.tenant_mode,
          displayName: result.slug.display_name,
        })
        navigate(workspaceScopedPath(result.slug.slug, '/projects', result.slug.workspace_id), {
          replace: true,
        })
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Workspace not found.')
      })

    return () => {
      cancelled = true
    }
  }, [slug, navigate, setActiveTenant])

  if (error) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-3 p-4">
        <p className="text-sm text-destructive text-center">{error}</p>
        <button
          type="button"
          className="text-sm text-primary hover:underline"
          onClick={() => navigate('/onboarding', { replace: true })}
        >
          Back to onboarding
        </button>
      </div>
    )
  }

  return (
    <PlatformRouteLoadingFallback
      title="Loading page…"
      description="Opening the requested workspace."
    />
  )
}
