import { create } from 'zustand'
import type { IdeaFolderApi } from '@/lib/api/ideaFolderApi'
import {
  fetchAllIdeaFolders,
  fetchIdeaFolders,
  createIdeaFolder,
  updateIdeaFolder,
  deleteIdeaFolder,
  type UpdateIdeaFolderPayload,
} from '@/lib/api/ideaFolderApi'
import {
  applyWorkspaceIdFromWrite,
  belongsToActiveWorkspaceScope,
  readActiveWorkspaceScope,
  resolveWorkspaceIdForFetch,
  resolveWorkspaceIdForWrite,
} from '@/lib/tenantWorkspaceScope'
import { buildDuplicateIdeaFolderName } from '../lib/ideaFolderActions'
import { getIdeaFolderClipboard } from '../lib/ideaFolderClipboard'

export interface IdeaBacklogFolderMember {
  userId: string
  displayName: string
  roleCode: string
  roleName: string
}

export interface IdeaBacklogFolder {
  id: string
  workspaceId?: string | null
  name: string
  description?: string
  ownerId: string
  parentId?: string | null
  borderColor?: string | null
  members?: IdeaBacklogFolderMember[]
  ideaCount: number
  childrenCount: number
  createdAt: string
  updatedAt: string
}

function mapApiToFolder(api: IdeaFolderApi): IdeaBacklogFolder {
  return {
    id: api.id,
    workspaceId: api.workspace_id ?? undefined,
    name: api.name,
    description: api.description ?? undefined,
    ownerId: api.owner_id,
    parentId: api.parent_id ?? undefined,
    borderColor: api.border_color ?? undefined,
    members: (api.members ?? []).map((member) => ({
      userId: member.user_id,
      displayName: member.display_name,
      roleCode: member.role_code,
      roleName: member.role_name,
    })),
    ideaCount: api.idea_count,
    childrenCount: api.children_count,
    createdAt: api.created_date,
    updatedAt: api.updated_date ?? api.created_date,
  }
}

interface IdeaFolderState {
  folders: IdeaBacklogFolder[]
  foldersLoading: boolean
  foldersError: string | null
  fetchFolders: (ownerId?: string, parentId?: string | null) => Promise<void>
  addFolder: (
    folderData: Omit<IdeaBacklogFolder, 'id' | 'createdAt' | 'updatedAt' | 'ideaCount' | 'childrenCount'> & {
      ownerId?: string
    },
  ) => Promise<IdeaBacklogFolder>
  updateFolder: (id: string, updates: Partial<Pick<IdeaBacklogFolder, 'name' | 'description' | 'parentId' | 'borderColor'>>) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  getFolder: (id: string) => IdeaBacklogFolder | undefined
  getFoldersByParent: (parentId: string | null) => IdeaBacklogFolder[]
  isFolderNameUnique: (name: string, excludeId?: string, parentId?: string | null) => boolean
  moveFolderToParent: (id: string, parentId: string | null) => Promise<void>
  duplicateFolder: (id: string, targetParentId?: string | null) => Promise<IdeaBacklogFolder>
  pasteFolderFromClipboard: (targetParentId: string | null) => Promise<IdeaBacklogFolder>
  clearLocalCache: () => void
}

export const useIdeaFolderStore = create<IdeaFolderState>()((set, get) => ({
  folders: [],
  foldersLoading: false,
  foldersError: null,

  fetchFolders: async (ownerId, parentId) => {
    set({ foldersLoading: true, foldersError: null })
    try {
      const scope = readActiveWorkspaceScope()
      const workspace_id = resolveWorkspaceIdForFetch(scope)
      const isScopedFetch = parentId !== undefined
      const apiFolders = isScopedFetch
        ? (
            await fetchIdeaFolders({
              page: 1,
              page_size: 500,
              owner_id: ownerId,
              parent_id: parentId,
              workspace_id,
            })
          ).folders
        : await fetchAllIdeaFolders({ owner_id: ownerId, workspace_id })

      const incoming = apiFolders
        .filter((api) => belongsToActiveWorkspaceScope(api.workspace_id, scope))
        .map(mapApiToFolder)
      const incomingIds = new Set(incoming.map((folder) => folder.id))

      set((state) => {
        if (!isScopedFetch) {
          return { folders: incoming, foldersLoading: false, foldersError: null }
        }
        const normalizedParent = parentId ?? null
        const kept = state.folders.filter((folder) => {
          const folderParent = folder.parentId ?? null
          if (folderParent !== normalizedParent) return true
          return incomingIds.has(folder.id)
        })
        const mergedById = new Map(kept.map((folder) => [folder.id, folder]))
        for (const folder of incoming) {
          mergedById.set(folder.id, folder)
        }
        return {
          folders: Array.from(mergedById.values()),
          foldersLoading: false,
          foldersError: null,
        }
      })
        } catch (e) {
      const raw = e instanceof Error ? e.message : 'Failed to fetch folders'
      const isMissingRoute =
        raw === 'Not Found' || /\b404\b/.test(raw) || raw.toLowerCase().includes('not found')
      if (isMissingRoute) {
        set({ folders: [], foldersLoading: false, foldersError: null })
        return
      }
      const msg =
        raw === 'Failed to fetch' || raw.toLowerCase().includes('network')
          ? 'Unable to connect to the Idea Backlog Service. Make sure python-idea-backlog-service-fastapi is running on port 8511.'
          : raw
      set({ foldersLoading: false, foldersError: msg })
    }
  },

  addFolder: async (folderData) => {
    const scope = readActiveWorkspaceScope()
    const workspace_id = resolveWorkspaceIdForWrite(scope)
    const created = await createIdeaFolder({
      name: folderData.name,
      description: folderData.description,
      parent_id: folderData.parentId ?? null,
      owner_id: folderData.ownerId ?? '00000000-0000-0000-0000-000000000001',
      workspace_id,
      border_color: folderData.borderColor ?? null,
    })
    const folder: IdeaBacklogFolder = {
      ...mapApiToFolder(created),
      workspaceId: applyWorkspaceIdFromWrite(mapApiToFolder(created).workspaceId, workspace_id),
    }
    await get().fetchFolders(folderData.ownerId, folderData.parentId)
    const found = get().folders.find((f) => f.id === folder.id)
    return found ?? folder
  },

  updateFolder: async (id, updates) => {
    const payload: UpdateIdeaFolderPayload = {}
    if (updates.name != null) payload.name = updates.name
    if (updates.description != null) payload.description = updates.description
    if (updates.parentId !== undefined) payload.parent_id = updates.parentId ?? null
    if (updates.borderColor !== undefined) payload.border_color = updates.borderColor ?? null
    if (Object.keys(payload).length === 0) return

    await updateIdeaFolder(id, payload)
    const folder = get().folders.find((f) => f.id === id)
    if (folder) {
      await get().fetchFolders(folder.ownerId, folder.parentId)
    }
  },

  deleteFolder: async (id) => {
    await deleteIdeaFolder(id)
    set((state) => ({
      folders: state.folders.filter((folder) => folder.id !== id),
    }))
  },

  getFolder: (id) => get().folders.find((folder) => folder.id === id),

  getFoldersByParent: (parentId) => {
    const normalizedParent = parentId ?? null
    return get().folders.filter((folder) => (folder.parentId ?? null) === normalizedParent)
  },

  isFolderNameUnique: (name, excludeId, parentId) => {
    const lowerName = name.toLowerCase().trim()
    const normalizedParent = parentId ?? null
    return !get().folders.some(
      (folder) =>
        folder.name.toLowerCase().trim() === lowerName &&
        folder.id !== excludeId &&
        (folder.parentId ?? null) === normalizedParent,
    )
  },

  moveFolderToParent: async (id, parentId) => {
    await get().updateFolder(id, { parentId })
  },

  duplicateFolder: async (id, targetParentId) => {
    const source = get().getFolder(id)
    if (!source) {
      throw new Error('Folder not found')
    }
    const parentId = targetParentId !== undefined ? targetParentId : (source.parentId ?? null)
    const uniqueName = buildDuplicateIdeaFolderName(
      source.name,
      parentId,
      (name, excludeId, parent) => get().isFolderNameUnique(name, excludeId, parent),
    )
    return get().addFolder({
      name: uniqueName,
      description: source.description,
      parentId,
      ownerId: source.ownerId,
      borderColor: source.borderColor,
    })
  },

  pasteFolderFromClipboard: async (targetParentId) => {
    const clip = getIdeaFolderClipboard()
    if (!clip) {
      throw new Error('No folder in clipboard')
    }
    return get().duplicateFolder(clip.folderId, targetParentId)
  },

  clearLocalCache: () => {
    set({ folders: [], foldersLoading: false, foldersError: null })
  },
}))
