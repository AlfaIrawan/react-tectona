import { describe, expect, it } from 'vitest'
import {
  collectUploadItemsFromFiles,
  isSkippedDropName,
  relativeDirectoryFromWebkitPath,
  uniqueDirectoryPaths,
} from './droppedFolderUpload'

describe('droppedFolderUpload', () => {
  it('parses nested webkitRelativePath into folder segments', () => {
    expect(relativeDirectoryFromWebkitPath('Ketetapan Sementara/Lampiran/a.pdf')).toEqual([
      'Ketetapan Sementara',
      'Lampiran',
    ])
    expect(relativeDirectoryFromWebkitPath('note.pdf')).toEqual([])
  })

  it('keeps the dropped folder name from webkitRelativePath', () => {
    const file = new File(['hello world'], 'aturan.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'webkitRelativePath', { value: 'Ketetapan Sementara/aturan.pdf' })
    const items = collectUploadItemsFromFiles([file])
    expect(items).toHaveLength(1)
    expect(items[0]?.relativeDirectory).toEqual(['Ketetapan Sementara'])
  })

  it('skips OS junk files and nested junk folders', () => {
    expect(isSkippedDropName('.DS_Store')).toBe(true)
    const junk = new File(['x'], '.DS_Store')
    Object.defineProperty(junk, 'webkitRelativePath', { value: 'KS/.DS_Store' })
    const nestedJunk = new File(['x'], 'note.pdf')
    Object.defineProperty(nestedJunk, 'webkitRelativePath', { value: 'KS/__MACOSX/note.pdf' })
    expect(collectUploadItemsFromFiles([junk, nestedJunk])).toEqual([])
  })

  it('builds parent folders before nested children', () => {
    const paths = uniqueDirectoryPaths([
      { file: null, relativeDirectory: ['KS', 'Lampiran'] },
      { file: null, relativeDirectory: ['KS'] },
    ])
    expect(paths).toEqual([['KS'], ['KS', 'Lampiran']])
  })
})

