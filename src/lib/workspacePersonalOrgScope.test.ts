import { describe, expect, it } from 'vitest'

import {
  buildDirectoryTreeParentById,
  dominantDirectoryHostIds,
  isNestedOrgPersonalTenantActiveWorkspace,
  isStrictDirectoryTreeAncestor,
  selectPersonalDirectoryLinkedHostIds,
  shouldHideCanonicalPersonalDirectoryPlacement,
  shouldHideOperationalFromPersonalTenantDirectory,
  shouldHideSiblingPersonalFromPersonalTenantDirectory,
  shouldHideStandalonePersonalFromOrgDirectory,
  toDirectoryTreeWorkspace,
} from './workspacePersonalOrgScope'

const ORG_ID = 'org-adira'
const ORG_HOME = 'ws-org-home'
const IT_BP = 'ws-it-bp'
const HENRY_PERSONAL = 'ws-henry-personal'
const MANUEL_PERSONAL = 'ws-manuel-personal'

function row(
  partial: Parameters<typeof toDirectoryTreeWorkspace>[0],
): ReturnType<typeof toDirectoryTreeWorkspace> {
  return toDirectoryTreeWorkspace({
    primaryOrganizationId: ORG_ID,
    personalOrgScope: null,
    parentWorkspaceId: null,
    ...partial,
  })
}

describe('buildDirectoryTreeParentById', () => {
  it('nests org-directory-joined operational under org home without viewer WAC membership', () => {
    const workspaces = [
      row({
        id: ORG_HOME,
        type: 'Organization',
        isPersonalWorkspace: false,
      }),
      row({
        id: IT_BP,
        type: 'Division',
        isPersonalWorkspace: false,
        orgDirectoryJoined: true,
        ownerIdentityRef: 'sub-henry',
      }),
    ]

    const parents = buildDirectoryTreeParentById(workspaces)
    expect(parents.get(IT_BP)).toBe(ORG_HOME)
  })

  it('nests owner personal workspace under owned operational workspace', () => {
    const workspaces = [
      row({
        id: ORG_HOME,
        type: 'Organization',
        isPersonalWorkspace: false,
      }),
      row({
        id: IT_BP,
        type: 'Division',
        isPersonalWorkspace: false,
        orgDirectoryJoined: true,
        ownerIdentityRef: 'sub-henry',
      }),
      row({
        id: HENRY_PERSONAL,
        type: 'Personal',
        isPersonalWorkspace: true,
        personalOrgScope: 'organization_tree',
        parentWorkspaceId: ORG_HOME,
        ownerIdentityRef: 'sub-henry',
      }),
      row({
        id: MANUEL_PERSONAL,
        type: 'Personal',
        isPersonalWorkspace: true,
        personalOrgScope: 'organization_tree',
        parentWorkspaceId: ORG_HOME,
        ownerIdentityRef: 'sub-manuel',
      }),
    ]

    const parents = buildDirectoryTreeParentById(workspaces)
    expect(parents.get(HENRY_PERSONAL)).toBe(IT_BP)
    expect(parents.get(MANUEL_PERSONAL)).toBe(ORG_HOME)
  })
})

describe('personal directory linked placements', () => {
  const DEPT = 'ws-it-data-ai'
  const DIV_A = 'ws-div-a'
  const DIV_B = 'ws-div-b'
  const CHRISTOPHE = 'ws-christophe-personal'

  const parentById = new Map<string, string | null>([
    [ORG_HOME, null],
    [DEPT, ORG_HOME],
    [DIV_A, ORG_HOME],
    [DIV_B, ORG_HOME],
    [IT_BP, ORG_HOME],
    [CHRISTOPHE, ORG_HOME],
  ])

  it('treats org home as ancestor of a department', () => {
    expect(isStrictDirectoryTreeAncestor(ORG_HOME, DEPT, parentById)).toBe(true)
    expect(isStrictDirectoryTreeAncestor(DEPT, ORG_HOME, parentById)).toBe(false)
  })

  it('drops ancestor hosts when a descendant host is also present', () => {
    expect(dominantDirectoryHostIds([ORG_HOME, DEPT, IT_BP], parentById).sort()).toEqual(
      [DEPT, IT_BP].sort(),
    )
  })

  it('keeps a single department membership and hides the org-home canonical row', () => {
    const linked = selectPersonalDirectoryLinkedHostIds({
      primaryParentId: ORG_HOME,
      extraHostIds: [DEPT],
      parentById,
    })
    expect(linked).toEqual([DEPT])
    expect(
      shouldHideCanonicalPersonalDirectoryPlacement({
        isPersonalWorkspace: true,
        personalOrgScope: 'organization_tree',
        parentWorkspaceId: ORG_HOME,
        primaryParentId: ORG_HOME,
        linkedHostIds: linked,
        parentById,
      }),
    ).toBe(true)
  })

  it('hides a false root row when org home is not visible but a child membership is', () => {
    const linked = selectPersonalDirectoryLinkedHostIds({
      primaryParentId: null,
      extraHostIds: [DEPT],
      parentById,
    })
    expect(linked).toEqual([DEPT])
    expect(
      shouldHideCanonicalPersonalDirectoryPlacement({
        isPersonalWorkspace: true,
        personalOrgScope: 'organization_tree',
        parentWorkspaceId: ORG_HOME,
        primaryParentId: null,
        linkedHostIds: linked,
        parentById,
      }),
    ).toBe(true)
  })

  it('keeps both sibling division memberships and hides org-home', () => {
    const linked = selectPersonalDirectoryLinkedHostIds({
      primaryParentId: ORG_HOME,
      extraHostIds: [DIV_A, DIV_B],
      parentById,
    })
    expect(linked.sort()).toEqual([DIV_A, DIV_B].sort())
    expect(
      shouldHideCanonicalPersonalDirectoryPlacement({
        isPersonalWorkspace: true,
        personalOrgScope: 'organization_tree',
        parentWorkspaceId: ORG_HOME,
        primaryParentId: ORG_HOME,
        linkedHostIds: linked,
        parentById,
      }),
    ).toBe(true)
  })

  it('keeps canonical under owned division plus a sibling division membership', () => {
    const linked = selectPersonalDirectoryLinkedHostIds({
      primaryParentId: DIV_A,
      extraHostIds: [DIV_A, DIV_B],
      parentById,
    })
    expect(linked).toEqual([DIV_B])
    expect(
      shouldHideCanonicalPersonalDirectoryPlacement({
        isPersonalWorkspace: true,
        personalOrgScope: 'organization_tree',
        parentWorkspaceId: ORG_HOME,
        primaryParentId: DIV_A,
        linkedHostIds: linked,
        parentById,
      }),
    ).toBe(false)
  })

  it('does not hide a standalone personal workspace at root', () => {
    expect(
      shouldHideCanonicalPersonalDirectoryPlacement({
        isPersonalWorkspace: true,
        personalOrgScope: 'standalone',
        parentWorkspaceId: null,
        primaryParentId: null,
        linkedHostIds: [DEPT],
        parentById,
      }),
    ).toBe(false)
  })
})

describe('shouldHideOperationalFromPersonalTenantDirectory', () => {
  it('hides joined operational workspace without ownership or membership', () => {
    expect(
      shouldHideOperationalFromPersonalTenantDirectory(
        {
          id: IT_BP,
          isPersonalWorkspace: false,
          type: 'Division',
          orgDirectoryJoined: true,
        },
        new Set(['ws-org-home']),
        new Set(['ws-ricky-personal']),
      ),
    ).toBe(true)
  })

  it('keeps owned operational workspace in personal tenant directory', () => {
    expect(
      shouldHideOperationalFromPersonalTenantDirectory(
        {
          id: 'ws-it-owned',
          isPersonalWorkspace: false,
          type: 'Directorate',
          orgDirectoryJoined: false,
        },
        new Set(),
        new Set(['ws-it-owned']),
      ),
    ).toBe(false)
  })

  it('hides not-yet-joined operational workspace without ownership or membership', () => {
    expect(
      shouldHideOperationalFromPersonalTenantDirectory(
        {
          id: IT_BP,
          isPersonalWorkspace: false,
          type: 'Division',
          orgDirectoryJoined: false,
        },
        new Set(['ws-org-home']),
        new Set(['ws-ricky-personal']),
      ),
    ).toBe(true)
  })
})

describe('shouldHideStandalonePersonalFromOrgDirectory', () => {
  it('hides a standalone personal workspace from the org-wide directory', () => {
    expect(
      shouldHideStandalonePersonalFromOrgDirectory({
        isPersonalTenant: false,
        isPersonalWorkspace: true,
        personalOrgScope: 'standalone',
      }),
    ).toBe(true)
  })

  it('keeps an org-tree personal workspace visible in the org-wide directory', () => {
    expect(
      shouldHideStandalonePersonalFromOrgDirectory({
        isPersonalTenant: false,
        isPersonalWorkspace: true,
        personalOrgScope: 'organization_tree',
      }),
    ).toBe(false)
  })

  it('never hides from within the personal tenant itself', () => {
    expect(
      shouldHideStandalonePersonalFromOrgDirectory({
        isPersonalTenant: true,
        isPersonalWorkspace: true,
        personalOrgScope: 'standalone',
      }),
    ).toBe(false)
  })
})

describe('shouldHideSiblingPersonalFromPersonalTenantDirectory', () => {
  it('hides another user\'s personal workspace from a personal-tenant view', () => {
    expect(
      shouldHideSiblingPersonalFromPersonalTenantDirectory(
        { id: MANUEL_PERSONAL, isPersonalWorkspace: true },
        { id: HENRY_PERSONAL, isPersonalWorkspace: true },
      ),
    ).toBe(true)
  })

  it('keeps the active personal workspace itself visible', () => {
    expect(
      shouldHideSiblingPersonalFromPersonalTenantDirectory(
        { id: HENRY_PERSONAL, isPersonalWorkspace: true },
        { id: HENRY_PERSONAL, isPersonalWorkspace: true },
      ),
    ).toBe(false)
  })

  it('never hides operational rows, even from a personal-tenant view', () => {
    expect(
      shouldHideSiblingPersonalFromPersonalTenantDirectory(
        { id: IT_BP, isPersonalWorkspace: false },
        { id: HENRY_PERSONAL, isPersonalWorkspace: true },
      ),
    ).toBe(false)
  })
})

describe('isNestedOrgPersonalTenantActiveWorkspace', () => {
  it('is true for a personal tenant on an org-tree-linked personal workspace', () => {
    expect(
      isNestedOrgPersonalTenantActiveWorkspace({
        isPersonalTenant: true,
        activeWorkspaceId: HENRY_PERSONAL,
        isPersonalWorkspace: true,
        personalOrgScope: null,
        parentWorkspaceId: ORG_HOME,
      }),
    ).toBe(true)
  })

  it('is false for a standalone personal workspace (no cross-user leak filter applies)', () => {
    expect(
      isNestedOrgPersonalTenantActiveWorkspace({
        isPersonalTenant: true,
        activeWorkspaceId: HENRY_PERSONAL,
        isPersonalWorkspace: true,
        personalOrgScope: 'standalone',
        parentWorkspaceId: null,
      }),
    ).toBe(false)
  })

  it('is false when viewing from an org tenant, not a personal one', () => {
    expect(
      isNestedOrgPersonalTenantActiveWorkspace({
        isPersonalTenant: false,
        activeWorkspaceId: IT_BP,
        isPersonalWorkspace: false,
        personalOrgScope: null,
        parentWorkspaceId: ORG_HOME,
      }),
    ).toBe(false)
  })
})
