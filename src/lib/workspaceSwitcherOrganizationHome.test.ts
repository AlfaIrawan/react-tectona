import { describe, expect, it } from 'vitest'
import {
  collectSwitcherOrganizationIds,
  selectAdministeredOrgWorkspacesForSwitcher,
  selectOrganizationHomesForSwitcher,
} from './workspaceSwitcherOrganizationHome'

const ADIRA_ORG = '00000000-0000-0000-0001-000000000001'
const OTHER_ORG = '11111111-1111-1111-1111-111111111111'

function orgHome(id: string, organizationId: string, name = 'Adira Finance WS') {
  return {
    id,
    organization_id: organizationId,
    name,
    tenant_mode: 'organization' as const,
    metadata: {
      tectona_workspace_classification: 'Organization',
    },
  }
}

function division(id: string, organizationId: string) {
  return {
    id,
    organization_id: organizationId,
    tenant_mode: 'organization' as const,
    metadata: {
      tectona_workspace_classification: 'Division',
      parent_workspace_id: 'parent-1',
    },
  }
}

describe('selectOrganizationHomesForSwitcher', () => {
  const adiraHome = orgHome('home-adira', ADIRA_ORG)
  const otherHome = orgHome('home-other', OTHER_ORG, 'Other Org WS')
  const itData = division('it-data', ADIRA_ORG)

  it('does not list org home for a regular user', () => {
    expect(
      selectOrganizationHomesForSwitcher([adiraHome, itData], {
        isPlatformAdmin: false,
        isOrganizationAdmin: false,
        alreadyListedOrganizationIds: new Set([ADIRA_ORG]),
      }),
    ).toEqual([])
  })

  it('lists org home for an org admin in an organization they already use', () => {
    expect(
      selectOrganizationHomesForSwitcher([adiraHome, itData, otherHome], {
        isPlatformAdmin: false,
        isOrganizationAdmin: true,
        alreadyListedOrganizationIds: new Set([ADIRA_ORG]),
      }).map((row) => row.id),
    ).toEqual(['home-adira'])
  })

  it('lists every organization workspace in orgs an org admin already uses', () => {
    expect(
      selectAdministeredOrgWorkspacesForSwitcher([adiraHome, itData, otherHome], {
        isPlatformAdmin: false,
        isOrganizationAdmin: true,
        alreadyListedOrganizationIds: new Set([ADIRA_ORG]),
      }).map((row) => row.id),
    ).toEqual(['home-adira', 'it-data'])
  })

  it('does not list another organization workspace for an org admin', () => {
    expect(
      selectAdministeredOrgWorkspacesForSwitcher([adiraHome, otherHome], {
        isPlatformAdmin: false,
        isOrganizationAdmin: true,
        alreadyListedOrganizationIds: new Set([ADIRA_ORG]),
      }).map((row) => row.id),
    ).toEqual(['home-adira'])
  })

  it('lists every organization workspace for a platform admin', () => {
    expect(
      selectAdministeredOrgWorkspacesForSwitcher([adiraHome, otherHome, itData], {
        isPlatformAdmin: true,
        isOrganizationAdmin: false,
        alreadyListedOrganizationIds: new Set(),
      }).map((row) => row.id),
    ).toEqual(['home-adira', 'home-other', 'it-data'])
  })
})

describe('collectSwitcherOrganizationIds', () => {
  it('keeps non-empty organization ids', () => {
    expect(
      collectSwitcherOrganizationIds([ADIRA_ORG, '  ', null, OTHER_ORG, undefined]),
    ).toEqual(new Set([ADIRA_ORG, OTHER_ORG]))
  })
})
