import { describe, expect, it } from 'vitest'
import { resolveSampleGoldWorkspacePlan } from './resolveSampleGoldWorkspacePlan'

const ORG = 'org-adira'

const home = {
  id: 'ws-home',
  name: 'Adira Finance WS',
  organizationId: ORG,
  tenantMode: 'organization' as const,
  metadata: { tectona_workspace_classification: 'Organization' },
}

const child = {
  id: 'ws-credit',
  name: 'Credit System',
  organizationId: ORG,
  tenantMode: 'organization' as const,
  metadata: { tectona_workspace_classification: 'Division', parent_workspace_id: 'ws-home' },
}

const personal = {
  id: 'ws-personal',
  name: 'My workspace',
  organizationId: ORG,
  tenantMode: 'personal' as const,
  isNestedOrgPersonal: true,
}

const otherOrg = {
  id: 'ws-innolimit',
  name: 'Innolimit',
  organizationId: 'org-other',
  tenantMode: 'organization' as const,
  metadata: { tectona_workspace_classification: 'Organization' },
}

describe('resolveSampleGoldWorkspacePlan', () => {
  it('keeps personal uploads local-only', () => {
    const plan = resolveSampleGoldWorkspacePlan({
      uploadWorkspaceId: personal.id,
      accessible: [home, child, personal],
      catalog: [home, child, personal],
    })
    expect(plan.mode).toBe('personal_only')
    expect(plan.home).toBeNull()
  })

  it('uses organization home as SoR and other non-personal workspaces as overlays', () => {
    const plan = resolveSampleGoldWorkspacePlan({
      uploadWorkspaceId: child.id,
      accessible: [home, child, personal, otherOrg],
      catalog: [home, child, personal, otherOrg],
    })
    expect(plan.mode).toBe('org_vote')
    expect(plan.home).toEqual({ id: 'ws-home', name: 'Adira Finance WS', role: 'home' })
    expect(plan.overlays.map((row) => row.id)).toEqual(['ws-credit'])
  })

  it('does not mix another organization into overlays', () => {
    const plan = resolveSampleGoldWorkspacePlan({
      uploadWorkspaceId: home.id,
      accessible: [home, otherOrg],
      catalog: [home, otherOrg],
    })
    expect(plan.overlays).toEqual([])
  })
})
