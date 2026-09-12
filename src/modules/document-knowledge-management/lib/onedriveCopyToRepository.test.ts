/**
 * The copy walks a remote tree, so the properties worth pinning are the ones that
 * only show up on messy drives: nesting, loops, failures partway through, and a
 * folder large enough to hang the browser.
 */
import { describe, expect, it, vi } from 'vitest'

import type { MicrosoftDriveListing } from '@/lib/api/microsoftGraphApi'
import {
  MAX_COPY_FILES,
  ONEDRIVE_DRAG_MIME,
  collectOneDriveUploadItems,
  dataTransferHasOneDriveItems,
  decodeOneDriveDragPayload,
  encodeOneDriveDragPayload,
} from './onedriveCopyToRepository'

function listing(items: Array<{ id: string; name: string; kind: 'file' | 'folder' }>): MicrosoftDriveListing {
  return {
    connected: true,
    drive: {},
    folder: { id: 'f', name: 'f' },
    items: items.map((item) => ({ ...item, size: 1 })),
  } as MicrosoftDriveListing
}

const blob = () => new Blob(['x'], { type: 'text/plain' })

describe('drag payload', () => {
  it('round-trips the dragged selection', () => {
    const encoded = encodeOneDriveDragPayload([{ id: '1', name: 'a.docx', kind: 'file' }])
    expect(decodeOneDriveDragPayload(encoded)).toEqual([{ id: '1', name: 'a.docx', kind: 'file' }])
  })

  it('rejects anything that is not our payload', () => {
    expect(decodeOneDriveDragPayload('not json')).toEqual([])
    expect(decodeOneDriveDragPayload('{"id":"1"}')).toEqual([])
    expect(decodeOneDriveDragPayload(null)).toEqual([])
    // A page could put arbitrary JSON on the clipboard; entries must be shaped right.
    expect(decodeOneDriveDragPayload('[{"id":1,"name":"a","kind":"file"}]')).toEqual([])
    expect(decodeOneDriveDragPayload('[{"id":"1","name":"a","kind":"drive"}]')).toEqual([])
  })

  it('detects our own drag from the transfer types', () => {
    expect(dataTransferHasOneDriveItems([ONEDRIVE_DRAG_MIME])).toBe(true)
    expect(dataTransferHasOneDriveItems(['Files'])).toBe(false)
    expect(dataTransferHasOneDriveItems(undefined)).toBe(false)
  })
})

describe('collecting uploads', () => {
  it('copies a single file with no folder path', async () => {
    const result = await collectOneDriveUploadItems({
      items: [{ id: '1', name: 'a.docx', kind: 'file' }],
      listChildren: vi.fn(),
      fetchContent: vi.fn().mockResolvedValue(blob()),
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0].relativeDirectory).toEqual([])
    expect(result.items[0].file?.name).toBe('a.docx')
    expect(result.failures).toEqual([])
  })

  it('recreates nested folder paths', async () => {
    const listChildren = vi.fn(async (id: string) => {
      if (id === 'root') return listing([{ id: 'sub', name: 'Sub', kind: 'folder' }])
      if (id === 'sub') return listing([{ id: 'f1', name: 'deep.txt', kind: 'file' }])
      return listing([])
    })

    const result = await collectOneDriveUploadItems({
      items: [{ id: 'root', name: 'Reports', kind: 'folder' }],
      listChildren,
      fetchContent: vi.fn().mockResolvedValue(blob()),
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0].relativeDirectory).toEqual(['Reports', 'Sub'])
  })

  it('does not loop forever when a folder contains itself', async () => {
    const listChildren = vi.fn(async () => listing([{ id: 'loop', name: 'Loop', kind: 'folder' }]))

    const result = await collectOneDriveUploadItems({
      items: [{ id: 'loop', name: 'Loop', kind: 'folder' }],
      listChildren,
      fetchContent: vi.fn(),
    })

    expect(result.items).toEqual([])
    expect(listChildren).toHaveBeenCalledTimes(1)
  })

  it('reports a failed download instead of dropping the file silently', async () => {
    const result = await collectOneDriveUploadItems({
      items: [
        { id: 'ok', name: 'good.txt', kind: 'file' },
        { id: 'bad', name: 'locked.txt', kind: 'file' },
      ],
      listChildren: vi.fn(),
      fetchContent: vi.fn(async (id: string) => {
        if (id === 'bad') throw new Error('file is 90000000 bytes, above the copy limit')
        return blob()
      }),
    })

    // The good file still goes through — one bad file must not cancel the batch.
    expect(result.items).toHaveLength(1)
    expect(result.failures).toEqual([
      { path: 'locked.txt', reason: 'file is 90000000 bytes, above the copy limit' },
    ])
  })

  it('reports a folder that could not be listed', async () => {
    const result = await collectOneDriveUploadItems({
      items: [{ id: 'x', name: 'NoAccess', kind: 'folder' }],
      listChildren: vi.fn().mockRejectedValue(new Error('consent required')),
      fetchContent: vi.fn(),
    })

    expect(result.failures).toEqual([{ path: 'NoAccess', reason: 'consent required' }])
  })

  it('stops at the file ceiling and says so', async () => {
    const many = Array.from({ length: MAX_COPY_FILES + 5 }, (_, i) => ({
      id: `f${i}`,
      name: `file-${i}.txt`,
      kind: 'file' as const,
    }))

    const result = await collectOneDriveUploadItems({
      items: many,
      listChildren: vi.fn(),
      fetchContent: vi.fn().mockResolvedValue(blob()),
    })

    expect(result.items).toHaveLength(MAX_COPY_FILES)
    expect(result.truncated).toBe(true)
  })

  it('reports progress against a total known before downloading starts', async () => {
    const seen: Array<[number, number]> = []
    await collectOneDriveUploadItems({
      items: [
        { id: '1', name: 'a.txt', kind: 'file' },
        { id: '2', name: 'b.txt', kind: 'file' },
      ],
      listChildren: vi.fn(),
      fetchContent: vi.fn().mockResolvedValue(blob()),
      onProgress: (done, total) => seen.push([done, total]),
    })

    // Total is stable from the first callback — it does not climb as the walk goes.
    expect(seen).toEqual([[1, 2], [2, 2]])
  })

  it('stops early when the caller aborts', async () => {
    const signal = { aborted: false }
    const fetchContent = vi.fn(async () => {
      signal.aborted = true
      return blob()
    })

    const result = await collectOneDriveUploadItems({
      items: [
        { id: '1', name: 'a.txt', kind: 'file' },
        { id: '2', name: 'b.txt', kind: 'file' },
      ],
      listChildren: vi.fn(),
      fetchContent,
      signal,
    })

    expect(result.items).toHaveLength(1)
    expect(fetchContent).toHaveBeenCalledTimes(1)
  })
})
