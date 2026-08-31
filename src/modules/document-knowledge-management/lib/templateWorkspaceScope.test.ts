import { describe, expect, it } from 'vitest'
import {
  belongsToDkmTemplateScope,
  collectWorkspaceShareSearchLabels,
  expandShareSelectionWithChildren,
  descendantWorkspaceIds,
  listTemplateShareWorkspaceOptions,
  type TemplateShareDirectoryWorkspace,
} from './templateWorkspaceScope'

const ADIRA_ORG = 'org-adira'
const ADIRA_WS = 'ws-adira'
const STELLA_WS = 'ws-stella'
const IT_BP_WS = 'ws-itbp'
const OTHER_ORG_WS = 'ws-other'

function row(
  partial: Partial<TemplateShareDirectoryWorkspace> & Pick<TemplateShareDirectoryWorkspace, 'id' | 'name' | 'organizationId'>,
): TemplateShareDirectoryWorkspace {
  return {
    tenantMode: 'organization',
    parentWorkspaceId: null,
    statusCode: 'active',
    ...partial,
  }
}

describe('listTemplateShareWorkspaceOptions', () => {
  it('lists org siblings and nested personal workspaces the current user may not belong to', () => {
    const options = listTemplateShareWorkspaceOptions({
      templateWorkspaceId: ADIRA_WS,
      templateOrganizationId: ADIRA_ORG,
      directory: [
        row({ id: ADIRA_WS, name: 'Adira Finance WS', organizationId: ADIRA_ORG }),
        row({ id: IT_BP_WS, name: 'IT Business Partner WS', organizationId: ADIRA_ORG }),
        row({
          id: STELLA_WS,
          name: 'Stella WS',
          organizationId: 'org-stella-personal',
          tenantMode: 'personal',
          parentWorkspaceId: ADIRA_WS,
        }),
        row({ id: OTHER_ORG_WS, name: 'Other Co WS', organizationId: 'org-other' }),
      ],
    })
    expect(options.map((item) => item.id).sort()).toEqual([IT_BP_WS, STELLA_WS].sort())
    expect(options.find((item) => item.id === STELLA_WS)?.name).toBe('Stella WS')
  })

  it('omits the owner workspace and archived rows', () => {
    const options = listTemplateShareWorkspaceOptions({
      templateWorkspaceId: ADIRA_WS,
      templateOrganizationId: ADIRA_ORG,
      directory: [
        row({ id: ADIRA_WS, name: 'Adira Finance WS', organizationId: ADIRA_ORG }),
        row({ id: 'ws-old', name: 'Archived WS', organizationId: ADIRA_ORG, statusCode: 'archived' }),
      ],
    })
    expect(options).toEqual([])
  })
})

describe('belongsToDkmTemplateScope shared grants', () => {
  it('lets the recipient workspace use a shared template without owner-workspace membership', () => {
    const visible = belongsToDkmTemplateScope(
      {
        id: 'tpl-1',
        workspace_id: ADIRA_WS,
        metadata: { shared_with_workspace_ids: [STELLA_WS] },
      } as never,
      { mode: 'single', workspaceId: STELLA_WS, tenantMode: 'personal' },
      [{ id: STELLA_WS, name: 'Stella WS', organizationId: 'org-stella-personal' }],
    )
    expect(visible).toBe(true)
  })
})

describe('descendant inherit', () => {
  const childA = 'ws-itbp-child'
  const grandchild = 'ws-itbp-grand'

  const directory = [
    row({ id: ADIRA_WS, name: 'Adira Finance WS', organizationId: ADIRA_ORG }),
    row({ id: IT_BP_WS, name: 'IT Business Partner WS', organizationId: ADIRA_ORG }),
    row({ id: childA, name: 'IT BP Delivery WS', organizationId: ADIRA_ORG, parentWorkspaceId: IT_BP_WS }),
    row({ id: grandchild, name: 'IT BP Squad WS', organizationId: ADIRA_ORG, parentWorkspaceId: childA }),
    row({
      id: STELLA_WS,
      name: 'Stella WS',
      organizationId: 'org-stella-personal',
      tenantMode: 'personal',
      parentWorkspaceId: IT_BP_WS,
    }),
  ]

  it('walks nested children including personal workspaces under the parent', () => {
    expect(descendantWorkspaceIds(IT_BP_WS, directory).sort()).toEqual(
      [childA, grandchild, STELLA_WS].sort(),
    )
  })

  it('expands selection only when includeChildren is on', () => {
    expect(expandShareSelectionWithChildren(IT_BP_WS, directory, false)).toEqual([IT_BP_WS])
    expect(expandShareSelectionWithChildren(IT_BP_WS, directory, true).sort()).toEqual(
      [IT_BP_WS, childA, grandchild, STELLA_WS].sort(),
    )
  })
})

describe('collectWorkspaceShareSearchLabels', () => {
  it('matches a person name stored as workspace owner', () => {
    const haystack = collectWorkspaceShareSearchLabels({
      name: 'Stella WS',
      tenantMode: 'personal',
      createdBy: 'stella.user',
      metadata: { tectona_owner: 'Stella Wijaya' },
    })
    expect(haystack).toContain('stella wijaya')
    expect(haystack).toContain('stella ws')
  })
})
