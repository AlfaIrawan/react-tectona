/**
 * Personal workspace organization scope — standalone vs nested under org directory tree.
 * Metadata key: `tectona_personal_org_scope` = `standalone` | `organization_tree`.
 */

export type PersonalOrgScope = 'standalone' | 'organization_tree'

export type PersonalOrgScopeMetadata = {
  tectona_personal_org_scope?: unknown
  onboarding?: unknown
  external_org_member?: unknown
  parent_workspace_id?: unknown
}

export type DirectoryTreeWorkspace = {
  id: string
  type: string
  isPersonalWorkspace: boolean
  personalOrgScope: PersonalOrgScope | null
  parentWorkspaceId: string | null
  provisionedUnderWorkspaceId?: string | null
  primaryOrganizationId: string
  adminApprovalPending?: boolean
  /** Operational: approved into org directory tree (not bootstrap creator admin membership). */
  orgDirectoryJoined?: boolean
  ownerIdentityRef?: string | null
}

export function resolvePersonalOrgScopeFromMetadata(
  meta: PersonalOrgScopeMetadata,
  opts?: { tenantMode?: string | null; parentWorkspaceId?: string | null },
): PersonalOrgScope | null {
  const raw = meta.tectona_personal_org_scope
  if (raw === 'standalone' || raw === 'organization_tree') return raw

  const onboarding = typeof meta.onboarding === 'string' ? meta.onboarding.trim() : ''
  if (onboarding === 'personal_p0') return 'standalone'
  if (onboarding === 'org_personal') return 'organization_tree'

  const tenantMode = opts?.tenantMode?.trim().toLowerCase()
  const parentId =
    typeof meta.parent_workspace_id === 'string' && meta.parent_workspace_id.trim()
      ? meta.parent_workspace_id.trim()
      : opts?.parentWorkspaceId ?? null

  if (tenantMode === 'personal' || onboarding === 'personal_p0' || onboarding === 'org_personal') {
    if (parentId || meta.external_org_member === true) return 'organization_tree'
    return 'standalone'
  }

  return null
}

export function isPersonalWorkspaceMetadata(
  meta: PersonalOrgScopeMetadata,
  tenantMode?: string | null,
  classification?: string | null,
): boolean {
  if (tenantMode === 'personal') return true
  const onboarding = typeof meta.onboarding === 'string' ? meta.onboarding.trim() : ''
  if (onboarding === 'personal_p0' || onboarding === 'org_personal') return true
  return classification?.trim() === 'Personal'
}

export function isNestedOrgPersonalScope(
  scope: PersonalOrgScope | null,
  parentWorkspaceId?: string | null,
): boolean {
  return scope === 'organization_tree' || Boolean(parentWorkspaceId && scope !== 'standalone')
}

/** Lower number = higher in enterprise tree (Organization root). */
export function workspaceClassificationRank(type: string, isPersonalWorkspace: boolean): number {
  if (isPersonalWorkspace || type.trim() === 'Personal') return 100
  const normalized = type.trim()
  if (normalized === 'Organization') return 0
  if (normalized === 'Directorate') return 10
  if (normalized === 'Division') return 15
  if (normalized === 'Department') return 20
  return 50
}

/** Parent link for visibility closure (includes metadata parent before tree layout catches up). */
export function resolveDirectoryVisibilityParentId(
  workspace: DirectoryTreeWorkspace,
  treeParentById: ReadonlyMap<string, string | null>,
): string | null {
  if (workspace.isPersonalWorkspace && workspace.personalOrgScope === 'organization_tree') {
    const explicitParent = workspace.parentWorkspaceId?.trim()
    if (explicitParent) return explicitParent
  }
  return treeParentById.get(workspace.id) ?? null
}

export type DirectoryTreeBuildOptions = {
  wacMembershipWorkspaceIds?: ReadonlySet<string>
  ownedWorkspaceIds?: ReadonlySet<string>
}

/** Operational workspace belongs in org directory tree after explicit org-directory join. */
function isOperationalInOrgDirectoryTree(workspace: DirectoryTreeWorkspace): boolean {
  if (workspace.isPersonalWorkspace || workspace.type === 'Organization') return false
  return workspace.orgDirectoryJoined === true
}

/**
 * Directory tree parents from visible workspace rows:
 * Organization (root) → org-directory-joined operational → personal org-tree.
 * Creator operational without org-directory join stays root-level beside org home.
 */
export function buildDirectoryTreeParentById(
  workspaces: ReadonlyArray<DirectoryTreeWorkspace>,
  options?: DirectoryTreeBuildOptions,
): Map<string, string | null> {
  const byId = new Map(workspaces.map((workspace) => [workspace.id, workspace]))
  const orgHomeByOrgId = new Map<string, string>()
  for (const workspace of workspaces) {
    if (
      workspace.type === 'Organization'
      && !workspace.isPersonalWorkspace
      && !workspace.parentWorkspaceId
    ) {
      orgHomeByOrgId.set(workspace.primaryOrganizationId, workspace.id)
    }
  }

  const result = new Map<string, string | null>()
  for (const workspace of workspaces) {
    if (workspace.adminApprovalPending) {
      const linkedOrgPersonal =
        workspace.isPersonalWorkspace
        && workspace.personalOrgScope === 'organization_tree'
        && Boolean(workspace.parentWorkspaceId?.trim())
      if (!linkedOrgPersonal) {
        result.set(workspace.id, null)
        continue
      }
    }

    if (workspace.type === 'Organization' && !workspace.isPersonalWorkspace) {
      result.set(workspace.id, null)
      continue
    }

    const orgHomeId = orgHomeByOrgId.get(workspace.primaryOrganizationId) ?? null

    // An explicit parent pointing at some *other* workspace in the tree (not the org
    // home) reflects a deliberate placement choice -- Create Child Workspace, or moving
    // a personal workspace under someone's operational workspace -- and always wins
    // over the heuristics below, regardless of org-directory-join status.
    const explicitParent = workspace.parentWorkspaceId?.trim() || null
    if (explicitParent && explicitParent !== orgHomeId && byId.has(explicitParent)) {
      result.set(workspace.id, explicitParent)
      continue
    }

    if (!workspace.isPersonalWorkspace) {
      if (!isOperationalInOrgDirectoryTree(workspace)) {
        result.set(workspace.id, null)
        continue
      }

      const anchor = workspace.provisionedUnderWorkspaceId?.trim() || orgHomeId || null
      result.set(workspace.id, anchor && byId.has(anchor) ? anchor : null)
      continue
    }

    if (workspace.personalOrgScope !== 'organization_tree') {
      result.set(workspace.id, null)
      continue
    }

    // The same-owner guess below is the default for workspaces with no parent, or with
    // the standard org-home parent every org-tree personal workspace gets at onboarding.
    // It must not kick in when a *different*, deliberately-chosen parent (Create Child
    // Workspace / an explicit move) was set but isn't resolvable right now (e.g.
    // archived) -- that would silently reassign the workspace to an unrelated place
    // instead of honestly falling back to org home.
    const hasUnresolvedDeliberateParent =
      explicitParent !== null && explicitParent !== orgHomeId && !byId.has(explicitParent)
    if (!hasUnresolvedDeliberateParent) {
      const joinedOperationalCandidates = workspaces.filter(
        (candidate) =>
          candidate.id !== workspace.id
          && candidate.primaryOrganizationId === workspace.primaryOrganizationId
          && isOperationalInOrgDirectoryTree(candidate),
      )
      const ownerRef = workspace.ownerIdentityRef?.trim()
      if (ownerRef && joinedOperationalCandidates.length > 0) {
        const ownedOperational = joinedOperationalCandidates.find(
          (candidate) => candidate.ownerIdentityRef?.trim() === ownerRef,
        )
        if (ownedOperational) {
          result.set(workspace.id, ownedOperational.id)
          continue
        }
      }
    }

    if (orgHomeId && byId.has(orgHomeId)) {
      result.set(workspace.id, orgHomeId)
      continue
    }

    result.set(workspace.id, null)
  }

  return result
}

/** @deprecated Prefer buildDirectoryTreeParentById for multi-row tree layout. */
export function directoryTreeParentWorkspaceId(input: {
  isPersonalWorkspace: boolean
  personalOrgScope: PersonalOrgScope | null
  parentWorkspaceId: string | null
  adminApprovalPending?: boolean
}): string | null {
  if (input.adminApprovalPending) return null
  if (!input.isPersonalWorkspace) return null
  if (input.personalOrgScope !== 'organization_tree') return null
  return input.parentWorkspaceId
}

export function workspaceDirectoryTypeLabel(input: {
  type: string
  isPersonalWorkspace: boolean
  personalOrgScope: PersonalOrgScope | null
  primaryOrganizationLabel?: string
}): string {
  if (!input.isPersonalWorkspace) return input.type
  if (input.personalOrgScope === 'organization_tree') {
    const org = input.primaryOrganizationLabel?.trim()
    return org ? `Personal · ${org}` : 'Personal · Organization'
  }
  return 'Personal · Standalone'
}

export function shouldHideStandalonePersonalFromOrgDirectory(input: {
  isPersonalTenant: boolean
  isPersonalWorkspace: boolean
  personalOrgScope: PersonalOrgScope | null
}): boolean {
  return !input.isPersonalTenant && input.isPersonalWorkspace && input.personalOrgScope === 'standalone'
}

/**
 * Personal tenant on nested org personal WS — hide other users' personal rows;
 * org home and non-personal rows stay visible.
 */
export function shouldHideSiblingPersonalFromPersonalTenantDirectory(
  workspace: { id: string; isPersonalWorkspace: boolean },
  activeWorkspace: { id: string; isPersonalWorkspace: boolean },
): boolean {
  if (!activeWorkspace.isPersonalWorkspace) return false
  if (!workspace.isPersonalWorkspace) return false
  return workspace.id !== activeWorkspace.id
}

/**
 * Personal tenant directory — hide org-directory operational workspaces the viewer
 * neither owns nor holds WAC membership on (e.g. another user's Division).
 */
export function shouldHideOperationalFromPersonalTenantDirectory(
  workspace: {
    id: string
    isPersonalWorkspace: boolean
    type: string
    orgDirectoryJoined?: boolean
  },
  membershipWorkspaceIds: ReadonlySet<string>,
  ownedWorkspaceIds: ReadonlySet<string>,
): boolean {
  if (workspace.isPersonalWorkspace || workspace.type === 'Organization') return false
  if (ownedWorkspaceIds.has(workspace.id)) return false
  if (membershipWorkspaceIds.has(workspace.id)) return false
  return workspace.orgDirectoryJoined === true
}

export function isNestedOrgPersonalTenantActiveWorkspace(input: {
  isPersonalTenant: boolean
  activeWorkspaceId: string | null | undefined
  isPersonalWorkspace: boolean
  personalOrgScope: PersonalOrgScope | null
  parentWorkspaceId: string | null
}): boolean {
  if (!input.isPersonalTenant || !input.activeWorkspaceId) return false
  if (!input.isPersonalWorkspace) return false
  return isNestedOrgPersonalScope(input.personalOrgScope, input.parentWorkspaceId)
}

/** Org home workspace (Organization classification) — provisioning anchor, not active tenant. */
export function resolveOrgHomeWorkspaceId(
  workspaces: ReadonlyArray<{
    id: string
    primaryOrganizationId: string
    type: string
    isPersonalWorkspace: boolean
    parentWorkspaceId: string | null
  }>,
  organizationId: string,
): string | null {
  const normalizedOrgId = organizationId.trim()
  if (!normalizedOrgId) return null
  const match = workspaces.find(
    (workspace) =>
      workspace.primaryOrganizationId === normalizedOrgId
      && !workspace.isPersonalWorkspace
      && workspace.type === 'Organization'
      && !workspace.parentWorkspaceId,
  )
  return match?.id ?? null
}

export function toDirectoryTreeWorkspace(input: {
  id: string
  type: string
  isPersonalWorkspace: boolean
  personalOrgScope: PersonalOrgScope | null
  parentWorkspaceId: string | null
  provisionedUnderWorkspaceId?: string | null
  primaryOrganizationId: string
  adminApprovalPending?: boolean
  orgDirectoryJoined?: boolean
  ownerIdentityRef?: string | null
}): DirectoryTreeWorkspace {
  return {
    id: input.id,
    type: input.type,
    isPersonalWorkspace: input.isPersonalWorkspace,
    personalOrgScope: input.personalOrgScope,
    parentWorkspaceId: input.parentWorkspaceId,
    provisionedUnderWorkspaceId: input.provisionedUnderWorkspaceId ?? null,
    primaryOrganizationId: input.primaryOrganizationId,
    adminApprovalPending: input.adminApprovalPending === true,
    orgDirectoryJoined: input.orgDirectoryJoined === true,
    ownerIdentityRef: input.ownerIdentityRef?.trim() || null,
  }
}
