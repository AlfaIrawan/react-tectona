import { describe, expect, it } from 'vitest'
import {
  canActivateWorkspaceAsTenant,
  isOrganizationWorkspaceHiddenByDefault,
  membershipGrantsOrganizationWorkspaceSwitcherAccess,
} from './corporateWorkspaceAccess'

describe('canActivateWorkspaceAsTenant', () => {
  it('denies personal workspace without membership for non-admin non-owner', () => {
    expect(
      canActivateWorkspaceAsTenant('personal', {
        isPlatformAdmin: false,
        isCorporateUser: true,
        hasActiveMembership: false,
        isWorkspaceOwner: false,
      }),
    ).toBe(false)
  })

  it('allows personal workspace for owner without WAC membership', () => {
    expect(
      canActivateWorkspaceAsTenant('personal', {
        isPlatformAdmin: false,
        isCorporateUser: true,
        hasActiveMembership: false,
        isWorkspaceOwner: true,
      }),
    ).toBe(true)
  })

  it('allows personal workspace when user has active membership', () => {
    expect(
      canActivateWorkspaceAsTenant('personal', {
        isPlatformAdmin: false,
        isCorporateUser: false,
        hasActiveMembership: true,
        isWorkspaceOwner: false,
      }),
    ).toBe(true)
  })

  it('allows platform admin regardless of membership', () => {
    expect(
      canActivateWorkspaceAsTenant('personal', {
        isPlatformAdmin: true,
        isCorporateUser: true,
        hasActiveMembership: false,
        isWorkspaceOwner: false,
      }),
    ).toBe(true)
  })

  it('denies organization workspace for corporate user without membership', () => {
    expect(
      canActivateWorkspaceAsTenant('organization', {
        isPlatformAdmin: false,
        isCorporateUser: true,
        hasActiveMembership: false,
        isWorkspaceOwner: false,
      }),
    ).toBe(false)
  })

  it('denies read_only_workspace membership for organization tenant', () => {
    expect(
      canActivateWorkspaceAsTenant('organization', {
        isPlatformAdmin: false,
        isCorporateUser: true,
        hasActiveMembership: true,
        membershipParticipationScopeCode: 'read_only_workspace',
        isWorkspaceOwner: false,
      }),
    ).toBe(false)
  })
})

describe('isOrganizationWorkspaceHiddenByDefault', () => {
  it('does not hide personal workspaces for corporate users', () => {
    expect(
      isOrganizationWorkspaceHiddenByDefault('personal', {
        isPlatformAdmin: false,
        isCorporateUser: true,
        hasActiveMembership: false,
      }),
    ).toBe(false)
  })
})

describe('membershipGrantsOrganizationWorkspaceSwitcherAccess', () => {
  it('blocks read_only_workspace participation scope', () => {
    expect(membershipGrantsOrganizationWorkspaceSwitcherAccess('read_only_workspace')).toBe(false)
  })

  it('allows default participation scope', () => {
    expect(membershipGrantsOrganizationWorkspaceSwitcherAccess(null)).toBe(true)
  })
})
