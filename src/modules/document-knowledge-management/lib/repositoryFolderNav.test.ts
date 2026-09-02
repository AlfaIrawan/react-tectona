import { describe, expect, it } from 'vitest'
import {
  folderHasVisibleChildren,
  folderParentId,
  isDocumentFolderDescendant,
  listSiblingFolders,
} from './repositoryFolderNav'

const folders = [
  { id: 'root-a', name: 'Ad1Checking', parent_id: null },
  { id: 'root-samples', name: 'Samples', parent_id: null },
  { id: 'root-brd', name: 'BRD', parent_id: null },
  { id: 'samples-brd', name: 'BRD', parent_id: 'root-samples' },
  { id: 'samples-mi', name: 'Memo Internal', parent_id: 'root-samples' },
  { id: 'mi-pack', name: 'KS-023A pack', parent_id: 'samples-mi' },
]

describe('repositoryFolderNav', () => {
  it('lists only folders at the same parent, sorted by name', () => {
    expect(listSiblingFolders(folders, null).map((folder) => folder.id)).toEqual([
      'root-a',
      'root-brd',
      'root-samples',
    ])
    expect(listSiblingFolders(folders, 'root-samples').map((folder) => folder.name)).toEqual([
      'BRD',
      'Memo Internal',
    ])
  })

  it('hides the folder being moved and its descendants', () => {
    expect(listSiblingFolders(folders, null, { excludeFolderId: 'root-a' }).map((folder) => folder.id)).toEqual([
      'root-brd',
      'root-samples',
    ])
    expect(listSiblingFolders(folders, 'root-samples', { excludeFolderId: 'samples-mi' }).map((folder) => folder.id)).toEqual([
      'samples-brd',
    ])
    expect(folderHasVisibleChildren(folders, 'samples-mi', { excludeFolderId: 'samples-mi' })).toBe(false)
  })

  it('walks parents for descendant checks', () => {
    expect(isDocumentFolderDescendant(folders, 'root-samples', 'mi-pack')).toBe(true)
    expect(isDocumentFolderDescendant(folders, 'root-a', 'samples-brd')).toBe(false)
    expect(folderParentId(folders, 'samples-mi')).toBe('root-samples')
    expect(folderParentId(folders, 'missing')).toBeNull()
  })
})
