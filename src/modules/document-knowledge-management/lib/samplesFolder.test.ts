import { describe, expect, it } from 'vitest'
import {
  isSamplesRootFolder,
  isSamplesSystemFolder,
} from './samplesFolder'

describe('samplesFolder', () => {
  it('treats Samples at root as the system library', () => {
    const root = { id: 'r1', name: 'Samples', parent_id: null, folder_kind: 'samples_root' as const }
    const child = { id: 'c1', name: 'BRD', parent_id: 'r1', folder_kind: 'samples_category' as const }
    expect(isSamplesRootFolder(root)).toBe(true)
    expect(isSamplesSystemFolder(child, [root, child])).toBe(true)
  })

  it('does not mark a user folder named BRD at root as Samples', () => {
    const folder = { id: 'u1', name: 'BRD', parent_id: null }
    expect(isSamplesSystemFolder(folder, [folder])).toBe(false)
  })
})
