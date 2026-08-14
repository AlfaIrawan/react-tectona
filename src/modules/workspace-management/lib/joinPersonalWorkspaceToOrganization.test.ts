import { describe, expect, it } from 'vitest'

import {
  canRequestJoinOperationalWorkspaceToOrganization,
  canRequestJoinPersonalWorkspaceToOrganization,
  resolveJoinOrganizationMenuTarget,
  resolveJoinOrganizationMode,
} from './joinPersonalWorkspaceToOrganization'

describe('canRequestJoinPersonalWorkspaceToOrganization', () => {
  it('allows standalone personal workspace owned by viewer', () => {
    expect(
      canRequestJoinPersonalWorkspaceToOrganization(
        {
          isPersonalWorkspace: true,
          personalOrgScope: 'standalone',
          ownerIdentityRef: 'sub-1',
        },
        'sub-1',
      ),
    ).toBe(true)
  })

  it('rejects organization_tree personal workspace', () => {
    expect(
      canRequestJoinPersonalWorkspaceToOrganization(
        {
          isPersonalWorkspace: true,
          personalOrgScope: 'organization_tree',
          ownerIdentityRef: 'sub-1',
        },
        'sub-1',
      ),
    ).toBe(false)
  })
})

describe('canRequestJoinOperationalWorkspaceToOrganization', () => {
  it('allows creator-owned operational workspace not yet joined', () => {
    expect(
      canRequestJoinOperationalWorkspaceToOrganization(
        {
          id: 'ws-it',
          isPersonalWorkspace: false,
          type: 'Directorate',
          orgDirectoryJoined: false,
          ownerIdentityRef: 'sub-1',
        },
        'sub-1',
        ['ws-it'],
      ),
    ).toBe(true)
  })
})

describe('resolveJoinOrganizationMode', () => {
  it('returns direct when subject has full WAC on org home', () => {
    expect(
      resolveJoinOrganizationMode('sub-1', 'org-adira', [
        { subjectId: 'sub-1', workspaceId: 'org-adira', scopeCode: 'all' },
      ]),
    ).toBe('direct')
  })

  it('returns approval without org WAC', () => {
    expect(resolveJoinOrganizationMode('sub-1', 'org-adira', [])).toBe('approval')
  })
})

describe('resolveJoinOrganizationMenuTarget', () => {
  const catalog = [
    {
      id: 'org-adira',
      name: 'Adira Finance WS',
      type: 'Organization',
      isPersonalWorkspace: false,
      parentWorkspaceId: null,
      primaryOrganizationId: 'org-1',
    },
    {
      id: 'ws-personal',
      name: 'Henry Halim WS',
      type: 'Personal',
      isPersonalWorkspace: true,
      parentWorkspaceId: null,
      primaryOrganizationId: 'org-1',
    },
  ]

  it('builds join target for standalone personal workspace', () => {
    const target = resolveJoinOrganizationMenuTarget({
      workspace: {
        id: 'ws-personal',
        name: 'Henry Halim WS',
        version: 1,
        type: 'Personal',
        isPersonalWorkspace: true,
        personalOrgScope: 'standalone',
        primaryOrganizationId: 'org-1',
        ownerIdentityRef: 'sub-henry',
      },
      subjectId: 'sub-henry',
      catalog,
      membershipRows: [],
      ownedWorkspaceIds: ['ws-personal'],
    })
    expect(target).toMatchObject({
      workspaceId: 'ws-personal',
      orgWorkspaceId: 'org-adira',
      kind: 'personal',
      mode: 'approval',
    })
  })
})
