import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTenantContext } from '@/auth/TenantContext'
import { workspaceScopedPath } from '@/lib/workspaceRouting'

export type WorkspaceNavigateOverride = {
  slug?: string | null
  workspaceId?: string | null
}

export function useWorkspaceNavigate() {
  const navigate = useNavigate()
  const { slug, workspaceId } = useTenantContext()

  return useCallback(
    (path: string, override?: WorkspaceNavigateOverride) => {
      navigate(
        workspaceScopedPath(
          override?.slug !== undefined ? override.slug : slug,
          path,
          override?.workspaceId !== undefined ? override.workspaceId : workspaceId,
        ),
      )
    },
    [navigate, slug, workspaceId],
  )
}

export function useWorkspacePath(path: string): string {
  const { slug, workspaceId } = useTenantContext()
  return workspaceScopedPath(slug, path, workspaceId)
}
