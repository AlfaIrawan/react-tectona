import { describe, expect, it, vi } from 'vitest'
import type { DocumentFolder } from '@/lib/api/documentFolderApi'
import { ensureDroppedFolderTree, folderKeyFromRelativeDirectory } from './ensureDroppedFolderTree'

function folder(partial: Partial<DocumentFolder> & Pick<DocumentFolder, 'id' | 'name'>): DocumentFolder {
  return {
    description: null,
    parent_id: null,
    owner_id: 'owner',
    workspace_id: 'ws',
    document_count: 0,
    children_count: 0,
    created_date: '2026-01-01T00:00:00Z',
    updated_date: null,
    ...partial,
  }
}

describe('ensureDroppedFolderTree', () => {
  it('reuses an existing sibling folder and creates nested children', async () => {
    const createFolder = vi.fn(async (payload: { name: string; parent_id: string | null }) =>
      folder({
        id: payload.name === 'Lampiran' ? 'lampiran-id' : 'new-id',
        name: payload.name,
        parent_id: payload.parent_id,
      }),
    )

    const map = await ensureDroppedFolderTree({
      parentFolderId: 'current',
      items: [
        { file: null, relativeDirectory: ['Ketetapan Sementara', 'Lampiran'] },
        { file: new File(['x'], 'a.pdf'), relativeDirectory: ['Ketetapan Sementara'] },
      ],
      workspaceId: 'ws',
      ownerId: 'owner',
      folders: [
        folder({ id: 'ks-id', name: 'Ketetapan Sementara', parent_id: 'current' }),
      ],
      createFolder,
    })

    expect(createFolder).toHaveBeenCalledTimes(1)
    expect(createFolder).toHaveBeenCalledWith({
      name: 'Lampiran',
      parent_id: 'ks-id',
      owner_id: 'owner',
      workspace_id: 'ws',
    })
    expect(map.get(folderKeyFromRelativeDirectory(['Ketetapan Sementara']))).toBe('ks-id')
    expect(map.get(folderKeyFromRelativeDirectory(['Ketetapan Sementara', 'Lampiran']))).toBe('lampiran-id')
  })
})
