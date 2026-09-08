import { describe, expect, it } from 'vitest'

import { sliceDirectoryTreePage } from './directoryTreePagination'

const rows = [
  { workspace: 'org', depth: 0 },
  { workspace: 'it', depth: 1 },
  { workspace: 'dept', depth: 2 },
  { workspace: 'credit', depth: 1 },
  { workspace: 'alfa', depth: 2, isLinkedReference: true },
  { workspace: 'digital', depth: 1 },
]

describe('sliceDirectoryTreePage', () => {
  it('returns the first page unchanged', () => {
    expect(sliceDirectoryTreePage(rows, 1, 2).map((row) => row.workspace)).toEqual(['org', 'it'])
  })

  it('repeats ancestors so a later page is not a false root', () => {
    const page = sliceDirectoryTreePage(rows, 2, 2)
    expect(page.map((row) => row.workspace)).toEqual(['org', 'it', 'dept', 'credit'])
    expect(page[0]?.depth).toBe(0)
  })

  it('walks past linked rows when resolving ancestors', () => {
    const page = sliceDirectoryTreePage(rows, 3, 2)
    expect(page.map((row) => row.workspace)).toEqual(['org', 'credit', 'alfa', 'digital'])
  })
})
