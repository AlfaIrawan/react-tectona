import type { TenantContextValue } from '@/auth/TenantContext'
import type { StoredTenantSelection } from '@/lib/onboardingFeature'
import { workspaceScopedPath } from '@/lib/workspaceRouting'

type Location = { pathname: string; search: string; hash: string }
type Workspace = Pick<TenantContextValue, 'workspaceId' | 'orgId' | 'slug' | 'tenantMode' | 'displayName' | 'selectedWorkspaceIds'>

export type BrainstormReturnContext = { tenant: StoredTenantSelection; path: string }

/** The viewing workspace is independent of the destination that owns the draft. */
export function captureBrainstormReturnContext(tenant: Workspace | null, location: Location): BrainstormReturnContext | null {
  if (!tenant?.workspaceId) return null
  return {
    tenant: {
      workspaceId: tenant.workspaceId,
      orgId: tenant.orgId,
      slug: tenant.slug,
      tenantMode: tenant.tenantMode,
      displayName: tenant.displayName,
      selectedWorkspaceIds: [...tenant.selectedWorkspaceIds],
    },
    path: workspaceScopedPath(tenant.slug, `${location.pathname}${location.search}${location.hash}`, tenant.workspaceId),
  }
}

export function restoreBrainstormReturnContext(
  context: BrainstormReturnContext | null,
  tenant: Workspace | null,
  location: Location,
  setActiveTenant: TenantContextValue['setActiveTenant'] | undefined,
  navigate: (path: string, options: { replace: boolean }) => void,
): void {
  if (!context || !setActiveTenant) return
  if (tenant?.workspaceId !== context.tenant.workspaceId) {
    setActiveTenant(context.tenant, { remember: false })
  }
  if (`${location.pathname}${location.search}${location.hash}` !== context.path) {
    navigate(context.path, { replace: true })
  }
}
