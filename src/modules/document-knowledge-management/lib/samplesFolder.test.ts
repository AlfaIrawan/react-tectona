import { describe, expect, it } from 'vitest'
import {
  isFolderInSamplesTree,
  isSamplesLibraryFolder,
  isSamplesRootFolder,
  isSamplesSystemFolder,
} from './samplesFolder'

describe('samplesFolder', () => {
  it('locks only the Samples root, not category folders inside it', () => {
    const root = { id: 'r1', name: 'Samples', parent_id: null, folder_kind: 'samples_root' as const }
    const child = { id: 'c1', name: 'BRD', parent_id: 'r1', folder_kind: 'samples_category' as const }
    expect(isSamplesRootFolder(root)).toBe(true)
    expect(isSamplesSystemFolder(root)).toBe(true)
    expect(isSamplesSystemFolder(child)).toBe(false)
    expect(isSamplesLibraryFolder(child, [root, child])).toBe(true)
  })

  it('does not mark a user folder named BRD at root as Samples', () => {
    const folder = { id: 'u1', name: 'BRD', parent_id: null }
    expect(isSamplesSystemFolder(folder)).toBe(false)
    expect(isSamplesLibraryFolder(folder, [folder])).toBe(false)
    expect(isFolderInSamplesTree(folder.id, [folder])).toBe(false)
  })

  it('treats nested folders under Samples as inside the Samples tree', () => {
    const root = { id: 'r1', name: 'Samples', parent_id: null, folder_kind: 'samples_root' as const }
    const child = { id: 'c1', name: 'BRD', parent_id: 'r1', folder_kind: 'samples_category' as const }
    const nested = { id: 'n1', name: '2024', parent_id: 'c1' }
    expect(isFolderInSamplesTree(root.id, [root, child, nested])).toBe(true)
    expect(isFolderInSamplesTree(child.id, [root, child, nested])).toBe(true)
    expect(isFolderInSamplesTree(nested.id, [root, child, nested])).toBe(true)
    expect(isFolderInSamplesTree(null, [root, child, nested])).toBe(false)
  })
})
