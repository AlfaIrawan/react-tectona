import { getSession } from '@/auth/authService'
import { hasOrganizationAdminAccess, hasPlatformAdminAccess } from '@/lib/auth/platformAccess'
import { fetchSubjectMemberships, TECTONA_WAC_APP_ID } from '@/lib/api/workspaceAccessControlApi'
import {
  fetchAllWorkspaceOrgWorkspaces,
  fetchIdentityWorkspaceOrgMemberships,
  resolveSlug,
  type SlugResolveResponse,
  type WorkspaceOrgWorkspaceDto,
} from '@/lib/api/workspaceOrgApi'
import { canActivateWorkspaceAsTenant } from '@/lib/corporateWorkspaceAccess'
import { isConsumerEmail } from '@/lib/onboardingFeature'
import {
  isOrganizationHomeWorkspace,
  isWorkspaceDirectoryManagedRole,
  isWorkspaceOwnedBySubject,
} from '@/lib/workspaceOwnershipVisibility'

export type WorkspaceSlugAccessResult =
  | { allowed: true; slug: SlugResolveResponse; workspace: WorkspaceOrgWorkspaceDto }
  | { allowed: false; reason: 'invalid_slug' | 'forbidden' | 'unauthenticated' }

function sessionRoles(): string[] {
  const session = getSession()
  if (!session) return []
  if (session.user.roles?.length) return session.user.roles
  if (session.user.role === 'root') return ['tectona_root']
  if (session.user.role === 'admin') return ['tectona_admin']
  return []
}

export async function evaluateWorkspaceSlugAccess(slug: string): Promise<WorkspaceSlugAccessResult> {
  const normalizedSlug = slug.trim()
  if (!normalizedSlug) {
    return { allowed: false, reason: 'invalid_slug' }
  }

  const session = getSession()
  const subjectId = session?.user.id?.trim()
  if (!subjectId) {
    return { allowed: false, reason: 'unauthenticated' }
  }

  let resolved: SlugResolveResponse
  try {
    resolved = await resolveSlug(normalizedSlug)
  } catch {
    return { allowed: false, reason: 'invalid_slug' }
  }

  const isPlatformAdmin = hasPlatformAdminAccess(sessionRoles(), session?.user.role)
  const isOrganizationAdmin = hasOrganizationAdminAccess(sessionRoles())
  const email = session.user.email?.trim().toLowerCase() ?? ''
  const isCorporateUser = Boolean(email) && !isConsumerEmail(email)

  // Platform admins/root are allowed to open any workspace route. Do not run
  // membership and directory lookups for them: those checks are unnecessary
  // and can leave the route in a pending loop when admin-scoped APIs reject or
  // return incomplete data.
  if (isPlatformAdmin) {
    return {
      allowed: true,
      slug: resolved,
      workspace: {
        id: resolved.workspace_id,
        organization_id: resolved.org_id,
        workspace_key: resolved.slug,
        name: resolved.display_name,
        slug: resolved.slug,
        tenant_mode: resolved.tenant_mode,
        metadata: {},
      } as WorkspaceOrgWorkspaceDto,
    }
  }

  const subject = {
    id: subjectId,
    name: session.user.name,
    email: session.user.email,
  }

  const [memberships, directoryMemberships, workspaces] = await Promise.all([
    fetchSubjectMemberships(TECTONA_WAC_APP_ID, subjectId, { activeOnly: true }).catch(() => ({ items: [] })),
    fetchIdentityWorkspaceOrgMemberships(subjectId).catch(() => []),
    fetchAllWorkspaceOrgWorkspaces().catch(() => [] as WorkspaceOrgWorkspaceDto[]),
  ])

  const workspace =
    workspaces.find((item) => item.id === resolved.workspace_id)
    ?? ({
      id: resolved.workspace_id,
      organization_id: resolved.org_id,
      workspace_key: resolved.slug,
      name: resolved.display_name,
      slug: resolved.slug,
      tenant_mode: resolved.tenant_mode,
      metadata: {},
    } as WorkspaceOrgWorkspaceDto)

  const activeMembership = (memberships.items ?? []).find(
    (item) => item.workspace_id === resolved.workspace_id,
  )
  const hasActiveMembership = Boolean(activeMembership)
  const hasDirectoryManagedRole = directoryMemberships.some(
    (row) =>
      row.workspace_id === resolved.workspace_id
      && isWorkspaceDirectoryManagedRole(row.role_code),
  )
  const isOwner = isWorkspaceOwnedBySubject(
    {
      id: workspace.id,
      metadata: workspace.metadata,
      createdBy: workspace.created_by ?? null,
      tenantMode: workspace.tenant_mode ?? resolved.tenant_mode ?? null,
    },
    subject,
  )

  const allowed = canActivateWorkspaceAsTenant(resolved.tenant_mode ?? workspace.tenant_mode ?? null, {
    isPlatformAdmin,
    isOrganizationAdmin,
    isCorporateUser,
    hasActiveMembership,
    membershipParticipationScopeCode: activeMembership?.participation_scope_code,
    isWorkspaceOwner: isOwner || hasDirectoryManagedRole,
    isOrganizationHomeWorkspace: isOrganizationHomeWorkspace(workspace),
  })

  if (!allowed) {
    return { allowed: false, reason: 'forbidden' }
  }

  return { allowed: true, slug: resolved, workspace }
}
