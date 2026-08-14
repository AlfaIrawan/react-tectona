import { describe, expect, it } from 'vitest'

import {
  buildDirectoryTreeParentById,
  shouldHideOperationalFromPersonalTenantDirectory,
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
})
