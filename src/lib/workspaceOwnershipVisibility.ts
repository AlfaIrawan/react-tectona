import type { TenantMode } from '@/lib/onboardingFeature'
import { membershipGrantsOrganizationWorkspaceSwitcherAccess } from '@/lib/corporateWorkspaceAccess'

export type DirectoryMembershipRowRef = {
  subjectId: string
  workspaceId: string
  scopeCode?: string | null
}

export type WorkspaceOwnershipRef = {
  id: string
  metadata?: Record<string, unknown> | null
  owner?: string | null
  businessOwner?: string | null
  technicalOwner?: string | null
  ownerIdentityRef?: string | null
  createdByIdentityRef?: string | null
  /** Audit created_by from workspace-org (identity ref of creator). */
  createdBy?: string | null
  tenantMode?: TenantMode | null
}

export type DirectoryAccessBadge = 'wac_member' | 'creator'

export type WorkspaceOwnershipSubject = {
  id: string
  name?: string | null
  email?: string | null
}

export function normalizePersonName(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/** True when value looks like an identity-lite subject id (UUID), not legacy audit tokens like `migration`. */
export function isLikelyIdentityRef(value: string | null | undefined): boolean {
  const trimmed = value?.trim()
  if (!trimmed) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)
}

export function isWorkspaceOwnedBySubject(
  workspace: WorkspaceOwnershipRef,
  subject: WorkspaceOwnershipSubject,
): boolean {
  const subjectId = subject.id.trim()
  if (!subjectId) return false

  const meta =
    workspace.metadata && typeof workspace.metadata === 'object' ? workspace.metadata : {}

  const identityRef =
    workspace.ownerIdentityRef?.trim()
    || (typeof meta.tectona_owner_identity_ref === 'string' ? meta.tectona_owner_identity_ref.trim() : '')
  if (identityRef && identityRef === subjectId) return true

  const createdByRef =
    workspace.createdByIdentityRef?.trim()
    || (typeof meta.tectona_created_by_identity_ref === 'string'
      ? meta.tectona_created_by_identity_ref.trim()
      : '')
  if (createdByRef && createdByRef === subjectId) return true

  const createdBy = workspace.createdBy?.trim()
  if (createdBy && isLikelyIdentityRef(createdBy) && createdBy === subjectId) return true

  const subjectName = normalizePersonName(subject.name)
  if (!subjectName) return false

  const ownerFields = [
    workspace.businessOwner,
    workspace.owner,
    workspace.technicalOwner,
    meta.tectona_business_owner,
    meta.tectona_owner,
    meta.tectona_technical_owner,
  ]
  for (const field of ownerFields) {
    if (typeof field === 'string' && normalizePersonName(field) === subjectName) {
      return true
    }
  }

  return false
}

/**
 * True when the subject created this workspace (audit / identity ref).
 * Stricter than {@link isWorkspaceOwnedBySubject}: owner name alone does not qualify,
 * and legacy `created_by` tokens like `migration` block name inference.
 */
export function isWorkspaceCreatedBySubject(
  workspace: WorkspaceOwnershipRef,
  subject: WorkspaceOwnershipSubject,
): boolean {
  const subjectId = subject.id.trim()
  if (!subjectId) return false

  const meta =
    workspace.metadata && typeof workspace.metadata === 'object' ? workspace.metadata : {}

  const identityRef =
    workspace.ownerIdentityRef?.trim()
    || (typeof meta.tectona_owner_identity_ref === 'string' ? meta.tectona_owner_identity_ref.trim() : '')
  if (identityRef && identityRef === subjectId) return true

  const createdByRef =
    workspace.createdByIdentityRef?.trim()
    || (typeof meta.tectona_created_by_identity_ref === 'string'
      ? meta.tectona_created_by_identity_ref.trim()
      : '')
  if (createdByRef && createdByRef === subjectId) return true

  const createdBy = workspace.createdBy?.trim()
  if (createdBy && isLikelyIdentityRef(createdBy) && createdBy === subjectId) return true

  if (createdBy && !isLikelyIdentityRef(createdBy)) return false

  const subjectName = normalizePersonName(subject.name)
  if (!subjectName) return false

  const ownerFields = [
    workspace.businessOwner,
    workspace.owner,
    workspace.technicalOwner,
    meta.tectona_business_owner,
    meta.tectona_owner,
    meta.tectona_technical_owner,
  ]
  for (const field of ownerFields) {
    if (typeof field === 'string' && normalizePersonName(field) === subjectName) {
      return true
    }
  }

  return false
}

export function collectWorkspaceIdsOwnedBySubject(
  workspaces: WorkspaceOwnershipRef[],
  subject: WorkspaceOwnershipSubject,
): string[] {
  return workspaces.filter((workspace) => isWorkspaceOwnedBySubject(workspace, subject)).map((workspace) => workspace.id)
}

export function isWorkspaceDirectoryManagedRole(roleCode: string | null | undefined): boolean {
  const normalized = (roleCode ?? '').trim().toLowerCase()
  return normalized === 'owner' || normalized === 'admin'
}

export function directoryAccessBadgeLabel(badge: DirectoryAccessBadge): string {
  if (badge === 'wac_member') return 'WAC member'
  return 'Creator'
}

export function directoryPendingApprovalBadgeLabel(): string {
  return 'Pending approval'
}

export function resolveWorkspaceOwnerSubject(
  workspace: WorkspaceOwnershipRef,
  identityUsers: ReadonlyArray<{ id: string; display_name?: string | null; email?: string | null }>,
): WorkspaceOwnershipSubject | null {
  const meta =
    workspace.metadata && typeof workspace.metadata === 'object' ? workspace.metadata : {}

  const ownerRef =
    workspace.ownerIdentityRef?.trim()
    || (typeof meta.tectona_owner_identity_ref === 'string' ? meta.tectona_owner_identity_ref.trim() : '')
  if (ownerRef) {
    const user = identityUsers.find((entry) => entry.id.trim() === ownerRef)
    return {
      id: ownerRef,
      name: user?.display_name ?? workspace.owner ?? workspace.businessOwner ?? null,
      email: user?.email ?? null,
    }
  }

  const ownerName = workspace.businessOwner || workspace.owner || workspace.technicalOwner
  const ownerNorm = normalizePersonName(typeof ownerName === 'string' ? ownerName : null)
  if (!ownerNorm) return null

  for (const user of identityUsers) {
    if (normalizePersonName(user.display_name) === ownerNorm) {
      return { id: user.id.trim(), name: user.display_name, email: user.email ?? null }
    }
  }

  return null
}

export function collectMembershipWorkspaceIdsForSubject(
  subjectId: string,
  memberships: ReadonlyArray<{ subjectId: string; workspaceId: string }>,
): Set<string> {
  const normalizedSubjectId = subjectId.trim()
  if (!normalizedSubjectId) return new Set()
  return new Set(
    memberships
      .filter((row) => row.subjectId.trim() === normalizedSubjectId)
      .map((row) => row.workspaceId),
  )
}

/** Full WAC on workspace id for subject (excludes read_only_workspace join tier). */
export function subjectHasFullWacOnWorkspace(
  subjectId: string,
  workspaceId: string,
  membershipWorkspaceIds: ReadonlySet<string>,
  membershipRows?: ReadonlyArray<DirectoryMembershipRowRef>,
): boolean {
  if (!membershipWorkspaceIds.has(workspaceId)) return false
  const row = membershipRows?.find(
    (entry) => entry.subjectId.trim() === subjectId.trim() && entry.workspaceId === workspaceId,
  )
  if (row?.scopeCode != null && row.scopeCode.trim() !== '') {
    return membershipGrantsOrganizationWorkspaceSwitcherAccess(row.scopeCode)
  }
  return true
}

/**
 * WAC member badge on a directory row: membership on this workspace, or on org home
 * for nested personal org-tree rows.
 */
export function subjectHasDirectoryWacMemberBadge(input: {
  workspaceId: string
  subjectId: string
  membershipWorkspaceIds: ReadonlySet<string>
  membershipRows?: ReadonlyArray<DirectoryMembershipRowRef>
  orgHomeWorkspaceId?: string | null
}): boolean {
  const subjectId = input.subjectId.trim()
  if (!subjectId) return false

  if (
    subjectHasFullWacOnWorkspace(
      subjectId,
      input.workspaceId,
      input.membershipWorkspaceIds,
      input.membershipRows,
    )
  ) {
    return true
  }

  const orgHomeId = input.orgHomeWorkspaceId?.trim()
  if (!orgHomeId || orgHomeId === input.workspaceId) return false

  return subjectHasFullWacOnWorkspace(
    subjectId,
    orgHomeId,
    input.membershipWorkspaceIds,
    input.membershipRows,
  )
}

export function resolveDirectoryAccessBadges(
  workspaceId: string,
  workspace: WorkspaceOwnershipRef,
  subject: WorkspaceOwnershipSubject,
  wacMembershipWorkspaceIds: ReadonlySet<string>,
  options?: {
    suppressWacMember?: boolean
    suppressCreator?: boolean
    membershipRows?: ReadonlyArray<DirectoryMembershipRowRef>
    orgHomeWorkspaceId?: string | null
  },
): DirectoryAccessBadge[] {
  const badges: DirectoryAccessBadge[] = []
  if (
    !options?.suppressWacMember
    && subjectHasDirectoryWacMemberBadge({
      workspaceId,
      subjectId: subject.id,
      membershipWorkspaceIds: wacMembershipWorkspaceIds,
      membershipRows: options?.membershipRows,
      orgHomeWorkspaceId: options?.orgHomeWorkspaceId,
    })
  ) {
    badges.push('wac_member')
  }
  if (!options?.suppressCreator && isWorkspaceCreatedBySubject(workspace, subject)) {
    badges.push('creator')
  }
  return badges
}

/**
 * Directory row badges for the active viewer.
 * Platform / audit viewers use the workspace owner's participation so badges match corporate users.
 */
export function resolveDirectoryAccessBadgesForViewer(
  workspaceId: string,
  workspace: WorkspaceOwnershipRef,
  viewer: WorkspaceOwnershipSubject | null,
  viewerWacMembershipWorkspaceIds: ReadonlySet<string>,
  options?: {
    suppressWacMember?: boolean
    suppressCreator?: boolean
    useOwnerPerspective?: boolean
    identityUsers?: ReadonlyArray<{ id: string; display_name?: string | null; email?: string | null }>
    membershipRows?: ReadonlyArray<DirectoryMembershipRowRef>
    workspaceMemberCount?: number
    orgHomeWorkspaceId?: string | null
  },
): DirectoryAccessBadge[] {
  if (!viewer) return []

  let subject = viewer
  let membershipIds = viewerWacMembershipWorkspaceIds

  if (options?.useOwnerPerspective) {
    const ownerSubject = resolveWorkspaceOwnerSubject(workspace, options.identityUsers ?? [])
    if (ownerSubject) {
      subject = ownerSubject
      membershipIds = collectMembershipWorkspaceIdsForSubject(
        ownerSubject.id,
        options.membershipRows ?? [],
      )
      if (
        !membershipIds.has(workspaceId)
        && (options.workspaceMemberCount ?? 0) > 0
        && isWorkspaceOwnedBySubject(workspace, ownerSubject)
      ) {
        membershipIds = new Set([...membershipIds, workspaceId])
      }
    }
  }

  return resolveDirectoryAccessBadges(workspaceId, workspace, subject, membershipIds, {
    suppressWacMember: options?.suppressWacMember,
    suppressCreator: options?.suppressCreator,
    membershipRows: options?.membershipRows,
    orgHomeWorkspaceId: options?.orgHomeWorkspaceId,
  })
}

/** Participation badges for a member row — aligned with Directory (WAC + Creator when both apply). */
export function resolveMemberParticipationBadges(
  workspace: WorkspaceOwnershipRef,
  subject: WorkspaceOwnershipSubject,
  participationSource: 'wac' | 'creator' | undefined,
): DirectoryAccessBadge[] {
  const badges: DirectoryAccessBadge[] = []
  if (participationSource !== 'creator') {
    badges.push('wac_member')
  }
  if (participationSource === 'creator' || isWorkspaceCreatedBySubject(workspace, subject)) {
    badges.push('creator')
  }
  return badges
}

export function resolveWorkspaceCreatorSubjectIds(
  workspace: WorkspaceOwnershipRef,
  identityUsers: ReadonlyArray<{ id: string; display_name?: string | null; email?: string | null }>,
): string[] {
  const identityIds = new Set(identityUsers.map((user) => user.id.trim()).filter(Boolean))
  const ids = new Set<string>()

  const considerRef = (value: string | null | undefined) => {
    const trimmed = value?.trim()
    if (!trimmed) return
    if (isLikelyIdentityRef(trimmed) || identityIds.has(trimmed)) {
      ids.add(trimmed)
    }
  }

  considerRef(workspace.ownerIdentityRef)
  considerRef(workspace.createdByIdentityRef)
  considerRef(workspace.createdBy)

  const meta =
    workspace.metadata && typeof workspace.metadata === 'object' ? workspace.metadata : {}
  considerRef(typeof meta.tectona_owner_identity_ref === 'string' ? meta.tectona_owner_identity_ref : null)
  considerRef(typeof meta.tectona_created_by_identity_ref === 'string' ? meta.tectona_created_by_identity_ref : null)

  const createdByAudit = workspace.createdBy?.trim()
  if (createdByAudit && !isLikelyIdentityRef(createdByAudit)) {
    return [...ids]
  }

  const ownerNorm = normalizePersonName(workspace.owner)
  if (ownerNorm) {
    for (const user of identityUsers) {
      if (normalizePersonName(user.display_name) === ownerNorm) {
        ids.add(user.id.trim())
      }
    }
  }

  return [...ids]
}
