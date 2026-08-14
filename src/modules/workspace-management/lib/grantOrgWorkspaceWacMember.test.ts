import { describe, expect, it } from 'vitest'

import {
  ORG_WAC_MEMBER_PARTICIPATION_SCOPE,
  isOrgTreePersonalWorkspace,
  isRootOrganizationHomeWorkspace,
  resolveWorkspaceRowOrgWacMemberGrantTarget,
  subjectIdsEligibleForOrgWacMemberGrant,
} from './grantOrgWorkspaceWacMember'

describe('isRootOrganizationHomeWorkspace', () => {
  it('matches organization home without parent', () => {
    expect(
      isRootOrganizationHomeWorkspace({
        type: 'Organization',
        isPersonalWorkspace: false,
        parentWorkspaceId: null,
      }),
    ).toBe(true)
  })

  it('rejects personal and nested organization rows', () => {
    expect(
      isRootOrganizationHomeWorkspace({
        type: 'Organization',
        isPersonalWorkspace: true,
        parentWorkspaceId: null,
      }),
    ).toBe(false)
    expect(
      isRootOrganizationHomeWorkspace({
        type: 'Directorate',
        isPersonalWorkspace: false,
        parentWorkspaceId: 'org-1',
      }),
    ).toBe(false)
  })
})

describe('isOrgTreePersonalWorkspace', () => {
  it('matches personal rows in organization tree', () => {
    expect(
      isOrgTreePersonalWorkspace({
        isPersonalWorkspace: true,
        personalOrgScope: 'organization_tree',
        parentWorkspaceId: 'org-1',
      }),
    ).toBe(true)
  })

  it('rejects org home and standalone personal', () => {
    expect(
      isOrgTreePersonalWorkspace({
        isPersonalWorkspace: false,
        personalOrgScope: null,
        parentWorkspaceId: null,
      }),
    ).toBe(false)
  })
})

describe('subjectIdsEligibleForOrgWacMemberGrant', () => {
  const orgId = 'org-adira'
  const henryPersonalId = 'ws-henry'
  const henrySubjectId = 'sub-henry'

  const catalog = [
    {
      id: orgId,
      type: 'Organization',
      isPersonalWorkspace: false,
      parentWorkspaceId: null,
      personalOrgScope: null,
      ownerIdentityRef: 'sub-ricky',
    },
    {
      id: henryPersonalId,
      type: 'Personal',
      isPersonalWorkspace: true,
      parentWorkspaceId: orgId,
      personalOrgScope: 'organization_tree' as const,
      ownerIdentityRef: henrySubjectId,
    },
  ]

  it('includes org-tree owner without org WAC membership', () => {
    const eligible = subjectIdsEligibleForOrgWacMemberGrant(orgId, catalog, [
      { subjectId: henrySubjectId, workspaceId: henryPersonalId, scopeCode: 'project_only' },
    ])
    expect(eligible).toEqual([henrySubjectId])
  })

  it('excludes users who already have full org WAC membership', () => {
    const eligible = subjectIdsEligibleForOrgWacMemberGrant(orgId, catalog, [
      { subjectId: henrySubjectId, workspaceId: henryPersonalId, scopeCode: 'project_only' },
      {
        subjectId: henrySubjectId,
        workspaceId: orgId,
        scopeCode: ORG_WAC_MEMBER_PARTICIPATION_SCOPE,
      },
    ])
    expect(eligible).toEqual([])
  })

  it('includes users with read_only_workspace on org home (upgrade path)', () => {
    const eligible = subjectIdsEligibleForOrgWacMemberGrant(orgId, catalog, [
      { subjectId: henrySubjectId, workspaceId: henryPersonalId, scopeCode: 'project_only' },
      {
        subjectId: henrySubjectId,
        workspaceId: orgId,
        scopeCode: 'read_only_workspace',
      },
    ])
    expect(eligible).toEqual([henrySubjectId])
  })
})

describe('ORG_WAC_MEMBER_PARTICIPATION_SCOPE', () => {
  it('uses canonical all scope for org WAC grant', () => {
    expect(ORG_WAC_MEMBER_PARTICIPATION_SCOPE).toBe('all')
  })
})

describe('resolveWorkspaceRowOrgWacMemberGrantTarget', () => {
  const orgId = 'org-adira'
  const henryPersonalId = 'ws-henry'
  const rickyPersonalId = 'ws-ricky'
  const henrySubjectId = 'sub-henry'
  const rickySubjectId = 'sub-ricky'

  const catalog = [
    {
      id: orgId,
      name: 'Adira Finance WS',
      type: 'Organization',
      isPersonalWorkspace: false,
      parentWorkspaceId: null,
      personalOrgScope: null,
      ownerIdentityRef: rickySubjectId,
    },
    {
      id: henryPersonalId,
      name: 'Henry Halim WS',
      type: 'Personal',
      isPersonalWorkspace: true,
      parentWorkspaceId: orgId,
      personalOrgScope: 'organization_tree' as const,
      ownerIdentityRef: henrySubjectId,
    },
    {
      id: rickyPersonalId,
      name: 'Ricky Gunawan WS',
      type: 'Personal',
      isPersonalWorkspace: true,
      parentWorkspaceId: orgId,
      personalOrgScope: 'organization_tree' as const,
      ownerIdentityRef: rickySubjectId,
    },
  ]

  const members = [
    { subjectId: henrySubjectId, workspaceId: henryPersonalId, scopeCode: 'project_only' },
    { subjectId: rickySubjectId, workspaceId: rickyPersonalId, scopeCode: 'project_only' },
    { subjectId: rickySubjectId, workspaceId: orgId, scopeCode: ORG_WAC_MEMBER_PARTICIPATION_SCOPE },
  ]

  it('returns grant target for personal row without org WAC', () => {
    const henry = catalog[1]
    const target = resolveWorkspaceRowOrgWacMemberGrantTarget(henry, catalog, members)
    expect(target).toEqual({
      orgWorkspaceId: orgId,
      orgWorkspaceName: 'Adira Finance WS',
      subjectIds: [henrySubjectId],
      sourceWorkspaceId: henryPersonalId,
      sourceWorkspaceName: 'Henry Halim WS',
    })
  })

  it('returns null for org home row', () => {
    expect(resolveWorkspaceRowOrgWacMemberGrantTarget(catalog[0], catalog, members)).toBeNull()
  })

  it('returns null when personal owner already has org WAC', () => {
    expect(resolveWorkspaceRowOrgWacMemberGrantTarget(catalog[2], catalog, members)).toBeNull()
  })
})
