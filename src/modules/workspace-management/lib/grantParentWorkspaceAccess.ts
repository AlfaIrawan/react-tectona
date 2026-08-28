import {
  createWorkspaceMembership,
  fetchWorkspaceMembers,
  TECTONA_WAC_APP_ID,
  uiRoleToWacRoleCode,
  wacRoleCodeToUiRole,
  type WacMembershipDto,
} from '@/lib/api/workspaceAccessControlApi'
import { ensureWorkspaceDirectoryMembership } from '@/lib/api/workspaceOrgApi'
import { randomUuid } from '@/lib/randomId'
import { DEFAULT_OPERATIONAL_TEAM_VALUE } from '@/lib/workspaceOperationalTeams'
import { defaultParticipationScopeCodeForUiRole } from '@/lib/workspaceParticipationScopes'
import type { WorkspaceMemberUiRole } from '@/lib/workspaceParticipationScopes'

export type ParentWorkspaceAccessTarget = {
  childWorkspaceId: string
  childWorkspaceName: string
  parentWorkspaceId: string
  parentWorkspaceName: string
  subjectIds: string[]
}

/** Optional hints from WM live member panel — avoids extra WAC round-trips. */
export type ParentGrantMemberHint = {
  roleCode?: string
  participationScopeCode?: string
  operationalTeamCode?: string
  participationDurationCode?: string
}

type WorkspaceRef = {
  id: string
  name: string
  parentWorkspaceId: string | null
}

type MemberRef = {
  subjectId: string
  workspaceId: string
}

type AggregatedMemberRef = {
  subjectId: string
  memberships: Array<{ workspaceId: string }>
}

export function resolveParentWorkspaceRecord<T extends WorkspaceRef>(
  workspace: T,
  catalog: T[],
): T | null {
  if (!workspace.parentWorkspaceId) return null
  return catalog.find((row) => row.id === workspace.parentWorkspaceId) ?? null
}

export function subjectIdsMissingParentMembership(
  childWorkspaceId: string,
  parentWorkspaceId: string,
  members: MemberRef[],
): string[] {
  const childSubjects = new Set(
    members.filter((member) => member.workspaceId === childWorkspaceId).map((member) => member.subjectId),
  )
  const parentSubjects = new Set(
    members.filter((member) => member.workspaceId === parentWorkspaceId).map((member) => member.subjectId),
  )
  return [...childSubjects].filter((subjectId) => !parentSubjects.has(subjectId))
}

export function resolveMemberParentAccessTarget<T extends WorkspaceRef>(
  member: AggregatedMemberRef,
  catalog: T[],
  members: MemberRef[],
): Omit<ParentWorkspaceAccessTarget, 'subjectIds'> | null {
  for (const membership of member.memberships) {
    const child = catalog.find((row) => row.id === membership.workspaceId)
    if (!child) continue
    const parent = resolveParentWorkspaceRecord(child, catalog)
    if (!parent) continue
    const hasParent = members.some(
      (row) => row.workspaceId === parent.id && row.subjectId === member.subjectId,
    )
    if (hasParent) continue
    return {
      childWorkspaceId: child.id,
      childWorkspaceName: child.name,
      parentWorkspaceId: parent.id,
      parentWorkspaceName: parent.name,
    }
  }
  return null
}

function operationalTeamCodesFromMembership(row: WacMembershipDto | undefined): string[] {
  if (!row) return []
  const fromList = (row.operational_teams ?? [])
    .map((team) => team.team_code?.trim())
    .filter((code): code is string => Boolean(code))
  if (fromList.length > 0) return fromList
  const single = row.operational_team_code?.trim()
  return single ? [single] : []
}

function operationalTeamCodesFromHint(hint: ParentGrantMemberHint | undefined): string[] {
  const code = hint?.operationalTeamCode?.trim()
  return code ? [code] : []
}

function resolveOperationalTeamCodes(
  childMembership: WacMembershipDto | undefined,
  hint: ParentGrantMemberHint | undefined,
): string[] {
  const fromChild = operationalTeamCodesFromMembership(childMembership)
  if (fromChild.length > 0) return fromChild
  const fromHint = operationalTeamCodesFromHint(hint)
  if (fromHint.length > 0) return fromHint
  return [DEFAULT_OPERATIONAL_TEAM_VALUE]
}

function directoryRoleCode(roleCode: string): 'owner' | 'admin' | 'member' | 'viewer' {
  if (roleCode === 'owner' || roleCode === 'admin' || roleCode === 'viewer') return roleCode
  return 'member'
}

export async function grantParentWorkspaceAccess(
  target: ParentWorkspaceAccessTarget,
  opts: {
    actorId: string
    memberHints?: Record<string, ParentGrantMemberHint>
  },
): Promise<number> {
  const childMembers = await fetchWorkspaceMembers(TECTONA_WAC_APP_ID, target.childWorkspaceId)
  const childBySubject = new Map(
    (childMembers.items ?? []).map((row) => [row.subject_id, row] as const),
  )

  let granted = 0
  for (const subjectId of target.subjectIds) {
    const hint = opts.memberHints?.[subjectId]
    const childMembership = childBySubject.get(subjectId)
    const uiRole = wacRoleCodeToUiRole(childMembership?.role_code ?? hint?.roleCode ?? 'member')
    const roleCode = uiRoleToWacRoleCode(uiRole)
    const operationalTeamCodes = resolveOperationalTeamCodes(childMembership, hint)

    await createWorkspaceMembership(
      TECTONA_WAC_APP_ID,
      target.parentWorkspaceId,
      {
        subject_id: subjectId,
        role_code: roleCode,
        status_code: 'active',
        participation_scope_code:
          childMembership?.participation_scope_code?.trim()
          || hint?.participationScopeCode?.trim()
          || defaultParticipationScopeCodeForUiRole(uiRole as WorkspaceMemberUiRole),
        operational_team_codes: operationalTeamCodes,
        participation_duration_code:
          childMembership?.participation_duration_code
          ?? hint?.participationDurationCode
          ?? 'permanent',
      },
      {
        actorId: opts.actorId,
        idempotencyKey: randomUuid(),
      },
    )

    try {
      await ensureWorkspaceDirectoryMembership(
        target.parentWorkspaceId,
        {
          identity_ref: subjectId,
          role_code: directoryRoleCode(roleCode),
          status_code: 'active',
        },
        { actorId: opts.actorId },
      )
    } catch {
      // WAC membership is authoritative for app access; directory row is best-effort.
    }

    granted += 1
  }

  return granted
}
