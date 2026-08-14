import {
  linkPersonalWorkspaceToOrgTree,
  patchWorkspaceOrgWorkspace,
  type WorkspaceOrgWorkspaceDto,
} from '@/lib/api/workspaceOrgApi'
import {
  requestCorporateOnboardingAdminApproval,
  TECTONA_WAC_APP_ID,
} from '@/lib/api/workspaceAccessControlApi'
import type { PersonalOrgScope } from '@/lib/workspacePersonalOrgScope'
import { resolveOrgHomeWorkspaceId } from '@/lib/workspacePersonalOrgScope'
import {
  collectMembershipWorkspaceIdsForSubject,
  subjectHasFullWacOnWorkspace,
  type DirectoryMembershipRowRef,
} from '@/lib/workspaceOwnershipVisibility'

export type JoinOrganizationMode = 'direct' | 'approval'
export type JoinOrganizationWorkspaceKind = 'personal' | 'operational'

export type JoinOrganizationMenuTarget = {
  workspaceId: string
  workspaceName: string
  workspaceVersion: number
  workspaceMetadata?: Record<string, unknown> | null
  orgWorkspaceId: string
  orgWorkspaceName: string
  mode: JoinOrganizationMode
  kind: JoinOrganizationWorkspaceKind
}

export function canRequestJoinPersonalWorkspaceToOrganization(
  workspace: {
    isPersonalWorkspace: boolean
    personalOrgScope: PersonalOrgScope | null
    adminApprovalPending?: boolean
    ownerIdentityRef?: string | null
  },
  subjectId: string | null | undefined,
): boolean {
  if (!workspace.isPersonalWorkspace) return false
  if (workspace.personalOrgScope === 'organization_tree') return false
  if (workspace.adminApprovalPending) return false
  const ownerRef = workspace.ownerIdentityRef?.trim()
  const viewerId = subjectId?.trim()
  if (!ownerRef || !viewerId) return false
  return ownerRef === viewerId
}

export function canRequestJoinOperationalWorkspaceToOrganization(
  workspace: {
    id: string
    isPersonalWorkspace: boolean
    type: string
    orgDirectoryJoined?: boolean
    adminApprovalPending?: boolean
    ownerIdentityRef?: string | null
    createdByIdentityRef?: string | null
  },
  subjectId: string | null | undefined,
  ownedWorkspaceIds: ReadonlyArray<string>,
): boolean {
  if (workspace.isPersonalWorkspace || workspace.type === 'Organization') return false
  if (workspace.orgDirectoryJoined === true) return false
  if (workspace.adminApprovalPending) return false
  const viewerId = subjectId?.trim()
  if (!viewerId) return false
  if (ownedWorkspaceIds.includes(workspace.id)) return true
  if (workspace.ownerIdentityRef?.trim() === viewerId) return true
  return workspace.createdByIdentityRef?.trim() === viewerId
}

export function resolveJoinOrganizationMode(
  subjectId: string,
  orgWorkspaceId: string,
  membershipRows: ReadonlyArray<DirectoryMembershipRowRef>,
): JoinOrganizationMode {
  const membershipIds = collectMembershipWorkspaceIdsForSubject(subjectId, membershipRows)
  if (subjectHasFullWacOnWorkspace(subjectId, orgWorkspaceId, membershipIds, membershipRows)) {
    return 'direct'
  }
  return 'approval'
}

export function resolveOrgHomeWorkspaceForJoin(
  workspace: { primaryOrganizationId: string },
  catalog: ReadonlyArray<{
    id: string
    name?: string
    type: string
    isPersonalWorkspace: boolean
    parentWorkspaceId: string | null
    primaryOrganizationId: string
  }>,
  opts?: { preferredOrgWorkspaceId?: string | null },
): { id: string; name: string } | null {
  const preferredId = opts?.preferredOrgWorkspaceId?.trim()
  if (preferredId) {
    const preferred = catalog.find((row) => row.id === preferredId)
    if (preferred && preferred.type === 'Organization' && !preferred.isPersonalWorkspace) {
      return { id: preferred.id, name: preferred.name?.trim() || 'Organization workspace' }
    }
  }

  const orgHomeId = resolveOrgHomeWorkspaceId(catalog, workspace.primaryOrganizationId)
  if (!orgHomeId) return null
  const match = catalog.find((row) => row.id === orgHomeId)
  if (!match) return null
  return { id: match.id, name: match.name?.trim() || 'Organization workspace' }
}

export function resolveJoinOrganizationMenuTarget(input: {
  workspace: {
    id: string
    name: string
    version: number
    metadata?: Record<string, unknown> | null
    type: string
    isPersonalWorkspace: boolean
    personalOrgScope: PersonalOrgScope | null
    primaryOrganizationId: string
    orgDirectoryJoined?: boolean
    adminApprovalPending?: boolean
    ownerIdentityRef?: string | null
    createdByIdentityRef?: string | null
  }
  subjectId: string | null | undefined
  catalog: ReadonlyArray<{
    id: string
    name?: string
    type: string
    isPersonalWorkspace: boolean
    parentWorkspaceId: string | null
    primaryOrganizationId: string
  }>
  membershipRows: ReadonlyArray<DirectoryMembershipRowRef>
  ownedWorkspaceIds: ReadonlyArray<string>
  preferredOrgWorkspaceId?: string | null
}): JoinOrganizationMenuTarget | null {
  const personalEligible = canRequestJoinPersonalWorkspaceToOrganization(input.workspace, input.subjectId)
  const operationalEligible = canRequestJoinOperationalWorkspaceToOrganization(
    input.workspace,
    input.subjectId,
    input.ownedWorkspaceIds,
  )
  if (!personalEligible && !operationalEligible) return null

  const orgHome = resolveOrgHomeWorkspaceForJoin(input.workspace, input.catalog, {
    preferredOrgWorkspaceId: input.preferredOrgWorkspaceId,
  })
  if (!orgHome) return null

  const subjectId = input.subjectId?.trim()
  if (!subjectId) return null

  return {
    workspaceId: input.workspace.id,
    workspaceName: input.workspace.name,
    workspaceVersion: input.workspace.version,
    workspaceMetadata: input.workspace.metadata ?? null,
    orgWorkspaceId: orgHome.id,
    orgWorkspaceName: orgHome.name,
    mode: resolveJoinOrganizationMode(subjectId, orgHome.id, input.membershipRows),
    kind: personalEligible ? 'personal' : 'operational',
  }
}

function corporateJoinRequestMessage(
  workspaceId: string,
  markerKey: 'personal_workspace_id' | 'operational_workspace_id',
  message?: string,
): string {
  const trimmed = message?.trim()
  const marker = `[${markerKey}=${workspaceId}]`
  if (trimmed) {
    return trimmed.includes(marker) ? trimmed : `${trimmed} ${marker}`
  }
  return `Request to join organization directory. ${marker}`
}

async function patchOperationalWorkspaceOrgDirectoryJoined(
  workspace: { id: string; version: number; metadata?: Record<string, unknown> | null },
  orgWorkspaceId: string,
  actorId: string,
): Promise<WorkspaceOrgWorkspaceDto> {
  const metadata = {
    ...(workspace.metadata && typeof workspace.metadata === 'object' ? workspace.metadata : {}),
    tectona_org_directory_joined: true,
    tectona_admin_approval_pending: false,
    tectona_provisioned_under_workspace_id: orgWorkspaceId,
  }
  delete metadata.pending_org_workspace_id
  return patchWorkspaceOrgWorkspace(
    workspace.id,
    { metadata, version: workspace.version },
    { actorId },
  )
}

async function patchJoinApprovalPendingMetadata(
  workspace: { id: string; version: number; metadata?: Record<string, unknown> | null },
  orgWorkspaceId: string,
  actorId: string,
): Promise<void> {
  const metadata = {
    ...(workspace.metadata && typeof workspace.metadata === 'object' ? workspace.metadata : {}),
    pending_org_workspace_id: orgWorkspaceId,
    tectona_admin_approval_pending: true,
  }
  await patchWorkspaceOrgWorkspace(
    workspace.id,
    { metadata, version: workspace.version },
    { actorId },
  )
}

export async function clearDirectoryJoinApprovalPendingMetadata(
  workspace: { id: string; version: number; metadata?: Record<string, unknown> | null },
  actorId: string,
): Promise<void> {
  const metadata = {
    ...(workspace.metadata && typeof workspace.metadata === 'object' ? workspace.metadata : {}),
  }
  delete metadata.tectona_admin_approval_pending
  delete metadata.pending_org_workspace_id
  await patchWorkspaceOrgWorkspace(
    workspace.id,
    { metadata, version: workspace.version },
    { actorId },
  )
}

export async function joinPersonalWorkspaceToOrganization(input: {
  personalWorkspace: {
    id: string
    version: number
    metadata?: Record<string, unknown> | null
  }
  orgWorkspaceId: string
  subjectId: string
  message?: string
  membershipRows: ReadonlyArray<DirectoryMembershipRowRef>
}): Promise<JoinOrganizationMode> {
  const mode = resolveJoinOrganizationMode(
    input.subjectId,
    input.orgWorkspaceId,
    input.membershipRows,
  )

  if (mode === 'direct') {
    await linkPersonalWorkspaceToOrgTree(
      input.orgWorkspaceId,
      {
        identity_ref: input.subjectId,
        personal_workspace_id: input.personalWorkspace.id,
      },
      { actorId: input.subjectId },
    )
    return 'direct'
  }

  await patchJoinApprovalPendingMetadata(
    input.personalWorkspace,
    input.orgWorkspaceId,
    input.subjectId,
  )

  await requestCorporateOnboardingAdminApproval({
    appId: TECTONA_WAC_APP_ID,
    workspaceId: input.personalWorkspace.id,
    orgWorkspaceId: input.orgWorkspaceId,
    subjectId: input.subjectId,
    message: corporateJoinRequestMessage(
      input.personalWorkspace.id,
      'personal_workspace_id',
      input.message,
    ),
  })

  return 'approval'
}

export async function joinOperationalWorkspaceToOrganization(input: {
  operationalWorkspace: {
    id: string
    version: number
    metadata?: Record<string, unknown> | null
  }
  orgWorkspaceId: string
  subjectId: string
  message?: string
  membershipRows: ReadonlyArray<DirectoryMembershipRowRef>
}): Promise<JoinOrganizationMode> {
  const mode = resolveJoinOrganizationMode(
    input.subjectId,
    input.orgWorkspaceId,
    input.membershipRows,
  )

  if (mode === 'direct') {
    await patchOperationalWorkspaceOrgDirectoryJoined(
      input.operationalWorkspace,
      input.orgWorkspaceId,
      input.subjectId,
    )
    return 'direct'
  }

  await patchJoinApprovalPendingMetadata(
    input.operationalWorkspace,
    input.orgWorkspaceId,
    input.subjectId,
  )

  await requestCorporateOnboardingAdminApproval({
    appId: TECTONA_WAC_APP_ID,
    workspaceId: input.operationalWorkspace.id,
    orgWorkspaceId: input.orgWorkspaceId,
    subjectId: input.subjectId,
    message: corporateJoinRequestMessage(
      input.operationalWorkspace.id,
      'operational_workspace_id',
      input.message,
    ),
  })

  return 'approval'
}

export async function joinWorkspaceToOrganization(
  target: JoinOrganizationMenuTarget,
  input: {
    subjectId: string
    membershipRows: ReadonlyArray<DirectoryMembershipRowRef>
    message?: string
  },
): Promise<JoinOrganizationMode> {
  if (target.kind === 'personal') {
    return joinPersonalWorkspaceToOrganization({
      personalWorkspace: {
        id: target.workspaceId,
        version: target.workspaceVersion,
        metadata: target.workspaceMetadata,
      },
      orgWorkspaceId: target.orgWorkspaceId,
      subjectId: input.subjectId,
      message: input.message,
      membershipRows: input.membershipRows,
    })
  }

  return joinOperationalWorkspaceToOrganization({
    operationalWorkspace: {
      id: target.workspaceId,
      version: target.workspaceVersion,
      metadata: target.workspaceMetadata,
    },
    orgWorkspaceId: target.orgWorkspaceId,
    subjectId: input.subjectId,
    message: input.message,
    membershipRows: input.membershipRows,
  })
}

export async function completeApprovedDirectoryJoinRequest(input: {
  kind: JoinOrganizationWorkspaceKind
  workspaceId: string
  workspaceVersion: number
  workspaceMetadata?: Record<string, unknown> | null
  orgWorkspaceId: string
  subjectId: string
  actorId: string
}): Promise<WorkspaceOrgWorkspaceDto | null> {
  if (input.kind === 'operational') {
    return patchOperationalWorkspaceOrgDirectoryJoined(
      {
        id: input.workspaceId,
        version: input.workspaceVersion,
        metadata: input.workspaceMetadata,
      },
      input.orgWorkspaceId,
      input.actorId,
    )
  }

  return linkPersonalWorkspaceToOrgTree(
    input.orgWorkspaceId,
    {
      identity_ref: input.subjectId,
      personal_workspace_id: input.workspaceId,
    },
    { actorId: input.actorId },
  )
}
