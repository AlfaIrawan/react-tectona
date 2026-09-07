import { describe, expect, it } from 'vitest'
import {
  buildSamplesShareFolderDescription,
  collectDescendantFolderIds,
  listNonPersonalSampleShareTargets,
  parseSamplesShareWorkspaceIds,
  samplesRelativeFolderNames,
} from './samplesShare'

describe('samplesShare', () => {
  it('round-trips shared workspace ids on folder description', () => {
    const encoded = buildSamplesShareFolderDescription(['ws-a', 'ws-a', ' ws-b '])
    expect(parseSamplesShareWorkspaceIds(encoded)).toEqual(['ws-a', 'ws-b'])
    expect(parseSamplesShareWorkspaceIds('tectona_project_id:abc')).toEqual([])
  })

  it('lists only other non-personal workspaces in the same organization', () => {
    const targets = listNonPersonalSampleShareTargets({
      currentWorkspaceId: 'home',
      organizationId: 'org-1',
      workspaces: [
        { id: 'home', name: 'Adira', organizationId: 'org-1', tenantMode: 'organization' },
        { id: 'credit', name: 'Credit', organizationId: 'org-1', tenantMode: 'organization' },
        { id: 'me', name: 'Personal', organizationId: 'org-1', tenantMode: 'personal' },
        { id: 'other', name: 'Innolimit', organizationId: 'org-2', tenantMode: 'organization' },
      ],
    })
    expect(targets.map((row) => row.id)).toEqual(['credit'])
  })

  it('returns the path under Samples, not including Samples itself', () => {
    const folders = [
      { id: 's', name: 'Samples', parent_id: null },
      { id: 'sop', name: 'SOP', parent_id: 's' },
      { id: 'pack', name: 'Pack A', parent_id: 'sop' },
    ]
    expect(samplesRelativeFolderNames('s', folders)).toEqual([])
    expect(samplesRelativeFolderNames('sop', folders)).toEqual(['SOP'])
    expect(samplesRelativeFolderNames('pack', folders)).toEqual(['SOP', 'Pack A'])
    expect(samplesRelativeFolderNames('missing', folders)).toBeNull()
  })

  it('collects the shared folder and its descendants', () => {
    const folders = [
      { id: 's', parent_id: null },
      { id: 'sop', parent_id: 's' },
      { id: 'a', parent_id: 'sop' },
      { id: 'other', parent_id: 's' },
    ]
    expect(collectDescendantFolderIds('sop', folders).sort()).toEqual(['a', 'sop'])
  })
})
