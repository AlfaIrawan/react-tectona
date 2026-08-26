import { describe, expect, it } from 'vitest'

import {
  isWorkspaceOwnedBySubject,
  resolveDirectoryAccessBadgesForViewer,
  subjectHasDirectoryWacMemberBadge,
} from './workspaceOwnershipVisibility'

describe('isWorkspaceOwnedBySubject', () => {
  it('recognizes legacy creator display names for the matching subject', () => {
    expect(
      isWorkspaceOwnedBySubject(
        { id: 'it-ws', createdBy: 'Ricky Gunawan' },
        { id: 'ricky-id', name: 'Ricky Gunawan', email: 'ricky.gunawan@example.com' },
      ),
    ).toBe(true)
  })
})

describe('subjectHasDirectoryWacMemberBadge', () => {
  const orgId = 'org-adira'
  const henryPersonalId = 'ws-henry'
  const henrySubjectId = 'sub-henry'

  it('shows badge on personal row when owner has org-home WAC', () => {
    const membershipIds = new Set([henryPersonalId, orgId])
    const rows = [
      { subjectId: henrySubjectId, workspaceId: henryPersonalId, scopeCode: 'project_only' },
      { subjectId: henrySubjectId, workspaceId: orgId, scopeCode: 'all' },
    ]
    expect(
      subjectHasDirectoryWacMemberBadge({
        workspaceId: henryPersonalId,
        subjectId: henrySubjectId,
        membershipWorkspaceIds: membershipIds,
        membershipRows: rows,
        orgHomeWorkspaceId: orgId,
      }),
    ).toBe(true)
  })

  it('hides badge when org-home membership is read_only_workspace', () => {
    const membershipIds = new Set([orgId])
    const rows = [{ subjectId: henrySubjectId, workspaceId: orgId, scopeCode: 'read_only_workspace' }]
    expect(
      subjectHasDirectoryWacMemberBadge({
        workspaceId: henryPersonalId,
        subjectId: henrySubjectId,
        membershipWorkspaceIds: membershipIds,
        membershipRows: rows,
        orgHomeWorkspaceId: orgId,
      }),
    ).toBe(false)
  })
})

describe('resolveDirectoryAccessBadgesForViewer', () => {
  it('uses owner perspective with org-home WAC for nested personal row', () => {
    const orgId = 'org-adira'
    const henryPersonalId = 'ws-henry'
    const henrySubjectId = 'sub-henry'

    const badges = resolveDirectoryAccessBadgesForViewer(
      henryPersonalId,
      {
        id: henryPersonalId,
        owner: 'Henry Halim',
        ownerIdentityRef: henrySubjectId,
      },
      { id: 'viewer-admin', name: 'Admin' },
      new Set<string>(),
      {
        useOwnerPerspective: true,
        identityUsers: [{ id: henrySubjectId, display_name: 'Henry Halim', email: 'henry@example.com' }],
        membershipRows: [
          { subjectId: henrySubjectId, workspaceId: henryPersonalId, scopeCode: 'project_only' },
          { subjectId: henrySubjectId, workspaceId: orgId, scopeCode: 'all' },
        ],
        orgHomeWorkspaceId: orgId,
      },
    )

    expect(badges).toContain('wac_member')
  })
})
