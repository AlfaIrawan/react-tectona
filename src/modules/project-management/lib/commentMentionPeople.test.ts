import { describe, expect, it } from 'vitest'
import { activeMemberIds, organizationHomeWorkspaceId } from './commentMentionPeople'

const home = { id: 'org-home', organization_id: 'org-1', metadata: { tectona_workspace_classification: 'Organization' } }
const division = { id: 'div', organization_id: 'org-1', metadata: { parent_workspace_id: 'org-home' } }
const team = { id: 'team', organization_id: 'org-1', metadata: { parent_workspace_id: 'div' } }

describe('organizationHomeWorkspaceId', () => {
  it('walks up the parent chain to the organization home', () => {
    expect(organizationHomeWorkspaceId('team', [home, division, team])).toBe('org-home')
    expect(organizationHomeWorkspaceId('org-home', [home, division, team])).toBe('org-home')
  })

  it('falls back to the home of the same organization when the chain is broken', () => {
    const orphan = { id: 'orphan', organization_id: 'org-1', metadata: { parent_workspace_id: 'gone' } }
    expect(organizationHomeWorkspaceId('orphan', [home, orphan])).toBe('org-home')
  })

  it('is null when nothing is known', () => {
    expect(organizationHomeWorkspaceId('x', [home])).toBeNull()
    const personal = { id: 'p', organization_id: 'org-2', metadata: {} }
    expect(organizationHomeWorkspaceId('p', [home, personal])).toBeNull()
  })
})

describe('activeMemberIds', () => {
  it('keeps active members once', () => {
    expect(activeMemberIds([
      { subject_id: 'a' },
      { subject_id: 'a', membership_status: 'ACTIVE' },
      { subject_id: 'b', status_code: 'inactive' },
      { subject_id: 'c', membership_status: 'active' },
    ])).toEqual(['a', 'c'])
  })
})
