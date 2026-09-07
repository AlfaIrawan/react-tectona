import { describe, expect, it } from 'vitest'
import { listEmptySeededSampleCategoryFolders } from './ensureSamplesLibrary'

describe('listEmptySeededSampleCategoryFolders', () => {
  const folders = [
    { id: 's', name: 'Samples', parent_id: null, document_count: 0 },
    { id: 'sop', name: 'SOP', parent_id: 's', document_count: 0 },
    { id: 'brd', name: 'BRD', parent_id: 's', document_count: 0 },
    { id: 'pack', name: 'Survey pack', parent_id: 's', document_count: 0 },
    { id: 'nested', name: 'SOP', parent_id: 'pack', document_count: 0 },
  ]

  it('prunes empty seeded category racks under Samples', () => {
    const doomed = listEmptySeededSampleCategoryFolders(folders, new Set())
    expect(doomed.map((folder) => folder.id).sort()).toEqual(['brd', 'sop'])
  })

  it('keeps a seeded folder that already has documents', () => {
    const doomed = listEmptySeededSampleCategoryFolders(folders, new Set(['sop']))
    expect(doomed.map((folder) => folder.id)).toEqual(['brd'])
  })

  it('keeps user-named folders under Samples', () => {
    const doomed = listEmptySeededSampleCategoryFolders(folders, new Set())
    expect(doomed.some((folder) => folder.id === 'pack')).toBe(false)
  })
})
