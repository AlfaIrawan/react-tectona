import {
  createWorkspaceMembership,
  patchWorkspaceMembership,
  TECTONA_WAC_APP_ID,
  uiRoleToWacRoleCode,
  wacRoleCodeToUiRole,
} from '@/lib/api/workspaceAccessControlApi'
import { ensureWorkspaceDirectoryMembership } from '@/lib/api/workspaceOrgApi'
import { membershipGrantsOrganizationWorkspaceSwitcherAccess } from '@/lib/corporateWorkspaceAccess'
import { PARTICIPATION_SCOPE_CODE } from '@/lib/participationScopeRules'
import { DEFAULT_OPERATIONAL_TEAM_VALUE } from '@/lib/workspaceOperationalTeams'
import type { PersonalOrgScope } from '@/lib/workspacePersonalOrgScope'

export type OrgWacMemberGrantTarget = {
  orgWorkspaceId: string
  orgWorkspaceName: string
  subjectIds: string[]
  /** Personal workspace row the admin invoked the action from. */
  sourceWorkspaceId?: string
  sourceWorkspaceName?: string
}

type WorkspaceCatalogRef = {
  id: string
  name?: string
  type: string
  isPersonalWorkspace: boolean
  parentWorkspaceId: string | null
  personalOrgScope: PersonalOrgScope | null
  ownerIdentityRef?: string | null
  createdByIdentityRef?: string | null
}

type MemberRef = {
  subjectId: string
  workspaceId: string
  scopeCode?: string
  id?: string
  version?: number
  roleCode?: string
}

export type OrgWacGrantMemberHint = {
  roleCode?: string
  operationalTeamCode?: string
  participationDurationCode?: string
}

/** Full org workspace WAC — canonical scope `all` (not legacy `organization_wide`). */
export const ORG_WAC_MEMBER_PARTICIPATION_SCOPE = PARTICIPATION_SCOPE_CODE.ALL

/** Organization home at directory root (e.g. Adira Finance WS). */
export function isRootOrganizationHomeWorkspace(workspace: {
  type: string
  isPersonalWorkspace: boolean
  parentWorkspaceId: string | null
}): boolean {
  if (workspace.isPersonalWorkspace) return false
  if (workspace.type.trim() !== 'Organization') return false
  return !workspace.parentWorkspaceId?.trim()
}

export function collectDescendantWorkspaceIds(
  rootWorkspaceId: string,
  catalog: ReadonlyArray<{ id: string; parentWorkspaceId: string | null }>,
): Set<string> {
  const byParent = new Map<string | null, string[]>()
  for (const workspace of catalog) {
    const parent = workspace.parentWorkspaceId?.trim() || null
    const list = byParent.get(parent) ?? []
    list.push(workspace.id)
    byParent.set(parent, list)
  }

  const out = new Set<string>()
  const walk = (parentId: string) => {
    for (const childId of byParent.get(parentId) ?? []) {
      out.add(childId)
      walk(childId)
    }
  }
  walk(rootWorkspaceId)
  return out
}

/** Org-tree users without full WAC on the organization home workspace. */
export function subjectIdsEligibleForOrgWacMemberGrant(
  orgWorkspaceId: string,
  catalog: ReadonlyArray<WorkspaceCatalogRef>,
  members: ReadonlyArray<MemberRef>,
): string[] {
  const descendantIds = collectDescendantWorkspaceIds(orgWorkspaceId, catalog)
  if (descendantIds.size === 0) return []

  const candidateSubjects = new Set<string>()

  for (const workspace of catalog) {
    if (!descendantIds.has(workspace.id) || !workspace.isPersonalWorkspace) continue
    const ownerRef =
      workspace.ownerIdentityRef?.trim() || workspace.createdByIdentityRef?.trim() || ''
    if (ownerRef) candidateSubjects.add(ownerRef)
  }

  for (const member of members) {
    if (descendantIds.has(member.workspaceId)) {
      candidateSubjects.add(member.subjectId)
    }
  }

  const eligible: string[] = []
  for (const subjectId of candidateSubjects) {
    const orgMembership = members.find(
      (row) => row.subjectId === subjectId && row.workspaceId === orgWorkspaceId,
    )
    if (!orgMembership) {
      eligible.push(subjectId)
      continue
    }
    if (!membershipGrantsOrganizationWorkspaceSwitcherAccess(orgMembership.scopeCode)) {
      eligible.push(subjectId)
    }
  }

  return eligible.sort()
}

export function resolveOrganizationHomeWorkspace<
  T extends {
    id: string
    type: string
    isPersonalWorkspace: boolean
    parentWorkspaceId: string | null
  },
>(workspace: T, catalog: ReadonlyArray<T>): T | null {
  const byId = new Map(catalog.map((row) => [row.id, row]))
  let current: T | undefined = workspace
  let orgHome: T | null = null

  while (current) {
    if (isRootOrganizationHomeWorkspace(current)) {
      orgHome = current
      break
    }
    const parentId = current.parentWorkspaceId?.trim()
    if (!parentId) break
    current = byId.get(parentId)
  }

  return orgHome
}

/** Personal workspace nested in the org directory tree (not org home itself). */
export function isOrgTreePersonalWorkspace(workspace: {
  isPersonalWorkspace: boolean
  personalOrgScope: PersonalOrgScope | null
  parentWorkspaceId: string | null
}): boolean {
  if (!workspace.isPersonalWorkspace) return false
  if (workspace.personalOrgScope === 'organization_tree') return true
  return Boolean(workspace.parentWorkspaceId?.trim())
}

export function resolveSubjectIdsForPersonalWorkspace(
  workspace: Pick<WorkspaceCatalogRef, 'id' | 'ownerIdentityRef' | 'createdByIdentityRef'>,
  members: ReadonlyArray<MemberRef>,
): string[] {
  const subjects = new Set<string>()
  const ownerRef =
    workspace.ownerIdentityRef?.trim() || workspace.createdByIdentityRef?.trim() || ''
  if (ownerRef) subjects.add(ownerRef)
  for (const member of members) {
    if (member.workspaceId === workspace.id) subjects.add(member.subjectId)
  }
  return [...subjects]
}

export function subjectIdsMissingOrgWacMembership(
  orgWorkspaceId: string,
  subjectIds: ReadonlyArray<string>,
  members: ReadonlyArray<MemberRef>,
): string[] {
  return subjectIds.filter((subjectId) => {
    const orgMembership = members.find(
      (row) => row.subjectId === subjectId && row.workspaceId === orgWorkspaceId,
    )
    if (!orgMembership) return true
    return !membershipGrantsOrganizationWorkspaceSwitcherAccess(orgMembership.scopeCode)
  })
}

/**
 * Grant target for a single directory row (personal org-tree user), not org home bulk grant.
 */
export function resolveWorkspaceRowOrgWacMemberGrantTarget(
  workspace: WorkspaceCatalogRef,
  catalog: ReadonlyArray<WorkspaceCatalogRef>,
  members: ReadonlyArray<MemberRef>,
): OrgWacMemberGrantTarget | null {
  if (!isOrgTreePersonalWorkspace(workspace)) return null
  const orgHome = resolveOrganizationHomeWorkspace(workspace, catalog)
  if (!orgHome) return null

  const candidateSubjects = resolveSubjectIdsForPersonalWorkspace(workspace, members)
  const eligible = subjectIdsMissingOrgWacMembership(orgHome.id, candidateSubjects, members)
  if (eligible.length === 0) return null

  return {
    orgWorkspaceId: orgHome.id,
    orgWorkspaceName: orgHome.name?.trim() || 'Organization workspace',
    subjectIds: eligible,
    sourceWorkspaceId: workspace.id,
    sourceWorkspaceName: workspace.name?.trim() || undefined,
  }
}

function directoryRoleCode(roleCode: string): 'owner' | 'admin' | 'member' | 'viewer' {
  if (roleCode === 'owner' || roleCode === 'admin' || roleCode === 'viewer') return roleCode
  return 'member'
}

function resolveRoleCode(
  subjectId: string,
  orgWorkspaceId: string,
  descendantIds: Set<string>,
  members: ReadonlyArray<MemberRef>,
  hint: OrgWacGrantMemberHint | undefined,
): string {
  if (hint?.roleCode?.trim()) return hint.roleCode.trim()
  const childMembership = members.find(
    (row) => row.subjectId === subjectId && descendantIds.has(row.workspaceId),
  )
  if (childMembership?.roleCode?.trim()) {
    return uiRoleToWacRoleCode(wacRoleCodeToUiRole(childMembership.roleCode))
  }
  return 'member'
}

export async function grantOrgWorkspaceWacMembership(
  target: OrgWacMemberGrantTarget,
  opts: {
    actorId: string
    catalog: ReadonlyArray<WorkspaceCatalogRef>
    members: ReadonlyArray<MemberRef>
    memberHints?: Record<string, OrgWacGrantMemberHint>
  },
): Promise<number> {
  const descendantIds = collectDescendantWorkspaceIds(target.orgWorkspaceId, opts.catalog)
  let granted = 0

  for (const subjectId of target.subjectIds) {
    const hint = opts.memberHints?.[subjectId]
    const existing = opts.members.find(
      (row) => row.subjectId === subjectId && row.workspaceId === target.orgWorkspaceId,
    )
    const roleCode = resolveRoleCode(
      subjectId,
      target.orgWorkspaceId,
      descendantIds,
      opts.members,
      hint,
    )

    if (
      existing
      && existing.id
      && !membershipGrantsOrganizationWorkspaceSwitcherAccess(existing.scopeCode)
    ) {
      await patchWorkspaceMembership(
        TECTONA_WAC_APP_ID,
        existing.id,
        {
          participation_scope_code: ORG_WAC_MEMBER_PARTICIPATION_SCOPE,
          role_code: roleCode,
          version: existing.version,
        },
        { actorId: opts.actorId },
      )
    } else if (!existing) {
      await createWorkspaceMembership(
        TECTONA_WAC_APP_ID,
        target.orgWorkspaceId,
        {
          subject_id: subjectId,
          role_code: roleCode,
          status_code: 'active',
          participation_scope_code: ORG_WAC_MEMBER_PARTICIPATION_SCOPE,
          operational_team_codes: hint?.operationalTeamCode?.trim()
            ? [hint.operationalTeamCode.trim()]
            : [DEFAULT_OPERATIONAL_TEAM_VALUE],
          participation_duration_code: hint?.participationDurationCode ?? 'permanent',
        },
        {
          actorId: opts.actorId,
          idempotencyKey:
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `org-wac-grant-${Date.now()}-${subjectId}`,
        },
      )
    } else {
      continue
    }

    try {
      await ensureWorkspaceDirectoryMembership(
        target.orgWorkspaceId,
        {
          identity_ref: subjectId,
          role_code: directoryRoleCode(roleCode),
          status_code: 'active',
        },
        { actorId: opts.actorId },
      )
    } catch {
      // WAC membership is authoritative; directory row is best-effort.
    }

    granted += 1
  }

  return granted
}
