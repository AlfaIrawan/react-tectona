import { ALL_WORKSPACES_ID } from '@/lib/onboardingFeature'

export function normalizeWorkspaceSlug(slug: string | null | undefined): string {
  return (slug ?? '').trim().toLowerCase().replace(/_/g, '-')
}

export function workspaceSlugsMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = normalizeWorkspaceSlug(left)
  const b = normalizeWorkspaceSlug(right)
  return Boolean(a) && a === b
}

export const WORKSPACE_ROUTE_PREFIX = '/w'

export function isAllWorkspacesRouteScope(workspaceId: string | null | undefined): boolean {
  return !workspaceId || workspaceId === ALL_WORKSPACES_ID
}

export function workspaceScopedPath(
  slug: string | null | undefined,
  path: string,
  workspaceId?: string | null,
): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (isAllWorkspacesRouteScope(workspaceId) || !slug?.trim()) {
    if (normalized.startsWith(`${WORKSPACE_ROUTE_PREFIX}/`)) {
      const { path: innerPath } = stripWorkspaceRoutePrefix(normalized)
      return innerPath.startsWith('/') ? innerPath : `/${innerPath}`
    }
    return normalized
  }
  const slugSegment = encodeURIComponent(slug.trim())
  if (normalized.startsWith(`${WORKSPACE_ROUTE_PREFIX}/${slugSegment}`)) {
    return normalized
  }
  if (normalized.startsWith(`${WORKSPACE_ROUTE_PREFIX}/`)) {
    const { path: innerPath } = stripWorkspaceRoutePrefix(normalized)
    return `${WORKSPACE_ROUTE_PREFIX}/${slugSegment}${innerPath === '/' ? '' : innerPath}`
  }
  return `${WORKSPACE_ROUTE_PREFIX}/${slugSegment}${normalized === '/' ? '' : normalized}`
}

export function stripWorkspaceRoutePrefix(pathname: string): {
  slug: string | null
  path: string
} {
  const match = pathname.match(/^\/w\/([^/]+)(\/.*|$)/)
  if (!match) {
    return { slug: null, path: pathname || '/' }
  }
  const slug = decodeURIComponent(match[1])
  const rest = match[2] || '/'
  return { slug, path: rest.startsWith('/') ? rest : `/${rest}` }
}

export function legacyAppPathFromLocation(pathname: string, search = '', hash = ''): string {
  const { path } = stripWorkspaceRoutePrefix(pathname)
  return `${path}${search}${hash}`
}
