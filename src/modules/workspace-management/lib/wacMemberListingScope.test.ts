import { describe, expect, it } from 'vitest'

import { filterWorkspacesEligibleForWacMemberListing } from './wacMemberListingScope'

const workspaces = [
  { id: 'member', parentWorkspaceId: null, isPersonalWorkspace: false },
  { id: 'owned-only', parentWorkspaceId: null, isPersonalWorkspace: false },
  { id: 'child', parentWorkspaceId: 'parent-admin', isPersonalWorkspace: false },
  { id: 'personal', parentWorkspaceId: null, isPersonalWorkspace: true },
]

const emptyScope = {
  isPlatformAdmin: false,
  isOrganizationAdmin: false,
  membershipWorkspaceIds: new Set<string>(),
  adminMembershipWorkspaceIds: new Set<string>(),
}

describe('filterWorkspacesEligibleForWacMemberListing', () => {
  it('includes active memberships and children of administered workspaces', () => {
    const visible = filterWorkspacesEligibleForWacMemberListing(workspaces, {
      ...emptyScope,
      membershipWorkspaceIds: new Set(['member']),
      adminMembershipWorkspaceIds: new Set(['parent-admin']),
    })

    expect(visible.map(({ id }) => id)).toEqual(['member', 'child'])
  })

  it('does not treat ownership or audit visibility as WAC roster permission', () => {
    expect(filterWorkspacesEligibleForWacMemberListing(workspaces, emptyScope)).toEqual([])
  })

  it('limits organization-admin roster access to non-personal workspaces', () => {
    const visible = filterWorkspacesEligibleForWacMemberListing(workspaces, {
      ...emptyScope,
      isOrganizationAdmin: true,
    })

    expect(visible.map(({ id }) => id)).toEqual(['member', 'owned-only', 'child'])
  })

  it('allows platform administrators to read all workspace rosters', () => {
    const visible = filterWorkspacesEligibleForWacMemberListing(workspaces, {
      ...emptyScope,
      isPlatformAdmin: true,
    })

    expect(visible).toEqual(workspaces)
  })
})
