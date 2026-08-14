import { describe, expect, it } from 'vitest'
import {
  belongsToDkmRepositoryScope,
  filterDkmFoldersForRepositoryScope,
  type WorkspaceScope,
} from './tenantWorkspaceScope'

describe('belongsToDkmRepositoryScope', () => {
  const single: WorkspaceScope = {
    mode: 'single',
    workspaceId: 'ws-adira',
    tenantMode: 'organization',
  }

  it('hides untagged legacy rows even for organization workspaces', () => {
    expect(belongsToDkmRepositoryScope(null, single)).toBe(false)
    expect(belongsToDkmRepositoryScope(undefined, single)).toBe(false)
    expect(belongsToDkmRepositoryScope('', single)).toBe(false)
  })

  it('lets callers include untagged legacy rows', () => {
    expect(belongsToDkmRepositoryScope(null, single, { includeUntaggedLegacy: true })).toBe(true)
    expect(belongsToDkmRepositoryScope('ws-adira', single, { includeUntaggedLegacy: true })).toBe(true)
    expect(belongsToDkmRepositoryScope('ws-other', single, { includeUntaggedLegacy: true })).toBe(false)
  })

  it('can force-exclude a workspace corpus (e.g. Adira for root)', () => {
    const excludeAdira = (workspaceId: string) =>
      workspaceId === '00000000-0000-0000-0001-000000000100'
    expect(
      belongsToDkmRepositoryScope('00000000-0000-0000-0001-000000000100', single, {
        isWorkspaceExcluded: excludeAdira,
      }),
    ).toBe(false)
    expect(
      belongsToDkmRepositoryScope('ws-adira', single, {
        isWorkspaceExcluded: excludeAdira,
      }),
    ).toBe(true)
  })

  it('keeps rows tagged to the active workspace', () => {
    expect(belongsToDkmRepositoryScope('ws-adira', single)).toBe(true)
    expect(belongsToDkmRepositoryScope('ws-other', single)).toBe(false)
  })

  it('includes tagged rows in federated all-workspaces mode when allow-list is empty', () => {
    const allScope: WorkspaceScope = { mode: 'all' }
    expect(belongsToDkmRepositoryScope('ws-adira', allScope)).toBe(true)
    expect(belongsToDkmRepositoryScope(null, allScope)).toBe(false)
  })

  it('respects explicit multi-workspace selection in federated mode', () => {
    const allScope: WorkspaceScope = { mode: 'all', workspaceIds: ['ws-a', 'ws-b'] }
    expect(belongsToDkmRepositoryScope('ws-a', allScope)).toBe(true)
    expect(belongsToDkmRepositoryScope('ws-c', allScope)).toBe(false)
  })
})

describe('filterDkmFoldersForRepositoryScope', () => {
  const folders = [
    { id: 'root-brd', name: 'BRD', parent_id: null, owner_id: 'system', document_count: 5, children_count: 1 },
    { id: 'child', name: 'Child', parent_id: 'root-brd', owner_id: 'system', document_count: 1, children_count: 0 },
    { id: 'mine', name: 'My folder', parent_id: null, owner_id: 'jokowi', document_count: 0, children_count: 0 },
  ]

  it('hides system leftover folders when no in-scope documents reference them', () => {
    const visible = filterDkmFoldersForRepositoryScope(folders, [], 'jokowi')
    expect(visible.map((folder) => folder.id)).toEqual(['mine'])
  })

  it('keeps ancestors of in-scope document folders and recounts docs', () => {
    const visible = filterDkmFoldersForRepositoryScope(folders, ['child'], null)
    expect(visible.map((folder) => folder.id).sort()).toEqual(['child', 'root-brd'])
    expect(visible.find((folder) => folder.id === 'child')?.document_count).toBe(1)
    expect(visible.find((folder) => folder.id === 'root-brd')?.document_count).toBe(0)
    expect(visible.find((folder) => folder.id === 'root-brd')?.children_count).toBe(1)
  })
})
