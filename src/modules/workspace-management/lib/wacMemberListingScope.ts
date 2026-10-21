export type WacMemberListingWorkspace = {
  id: string
  parentWorkspaceId?: string | null
  isPersonalWorkspace: boolean
}

export type WacMemberListingScope = {
  isPlatformAdmin: boolean
  isOrganizationAdmin: boolean
  membershipWorkspaceIds: ReadonlySet<string>
  adminMembershipWorkspaceIds: ReadonlySet<string>
}

/** Mirrors WAC roster-read access; UI visibility and workspace ownership do not grant it. */
export function filterWorkspacesEligibleForWacMemberListing<T extends WacMemberListingWorkspace>(
  workspaces: T[],
  scope: WacMemberListingScope,
): T[] {
  if (scope.isPlatformAdmin) return workspaces

  return workspaces.filter((workspace) => {
    if (scope.membershipWorkspaceIds.has(workspace.id)) return true
    if (scope.isOrganizationAdmin && !workspace.isPersonalWorkspace) return true

    const parentId = workspace.parentWorkspaceId?.trim()
    return Boolean(parentId && scope.adminMembershipWorkspaceIds.has(parentId))
  })
}
