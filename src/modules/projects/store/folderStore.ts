import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FolderApi } from '@/lib/api/folderApi'
import {
  fetchFolders as fetchFoldersApi,
  createFolder as createFolderApi,
  updateFolder as updateFolderApi,
  deleteFolder as deleteFolderApi,
  fetchFolderTree as fetchFolderTreeApi,
} from '@/lib/api/folderApi'

export interface Folder {
  id: string
  name: string
  description?: string
  ownerId: string
  isShared?: boolean
  parentId?: string | null
  projectCount: number
  childrenCount: number
  createdAt: string
  updatedAt: string
}

function mapApiToFolder(api: FolderApi): Folder {
  return {
    id: api.id,
    name: api.name,
    description: api.description ?? undefined,
    ownerId: api.owner_id,
    isShared: false,
    parentId: api.parent_id ?? undefined,
    projectCount: api.project_count,
    childrenCount: api.children_count,
    createdAt: api.created_date,
    updatedAt: api.updated_date ?? api.created_date,
  }
}

interface FolderState {
  folders: Folder[]
  foldersLoading: boolean
  foldersError: string | null
  fetchFolders: (ownerId?: string, parentId?: string | null) => Promise<void>
  addFolder: (folderData: Omit<Folder, 'id' | 'createdAt' | 'updatedAt' | 'projectCount' | 'childrenCount'> & { ownerId?: string }) => Promise<Folder>
  updateFolder: (id: string, updates: Partial<Folder>) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  getFolder: (id: string) => Folder | undefined
  getFolders: () => Folder[]
  getFoldersByParent: (parentId: string | null) => Folder[]
  isFolderNameUnique: (name: string, excludeId?: string, parentId?: string | null) => boolean
}

export const useFolderStore = create<FolderState>()(
  persist(
    (set, get) => ({
      folders: [],
      foldersLoading: false,
      foldersError: null,

      fetchFolders: async (ownerId, parentId) => {
        set({ foldersLoading: true, foldersError: null })
        try {
          const res = await fetchFoldersApi({
            page: 1,
            page_size: 100,
            owner_id: ownerId,
            parent_id: parentId,
          })
          const folders = res.folders.map(mapApiToFolder)
          set({ folders, foldersLoading: false, foldersError: null })
        } catch (e) {
          const raw = e instanceof Error ? e.message : 'Failed to fetch folders'
          const msg =
            raw === 'Failed to fetch' || raw.toLowerCase().includes('network')
              ? 'Tidak dapat terhubung ke Project Service. Pastikan python-project-service-fastapi berjalan di port 8500 (atau set VITE_PROJECT_API_URL di .env).'
              : raw
          set({ foldersLoading: false, foldersError: msg })
        }
      },

      addFolder: async (folderData) => {
        const created = await createFolderApi({
          name: folderData.name,
          description: folderData.description,
          parent_id: folderData.parentId ?? null,
          owner_id: folderData.ownerId ?? '00000000-0000-0000-0000-000000000001',
        })
        await get().fetchFolders(folderData.ownerId, folderData.parentId)
        const folder = mapApiToFolder(created)
        const found = get().folders.find((f) => f.id === folder.id)
        return found ?? folder
      },

      updateFolder: async (id, updates) => {
        const payload: { name?: string; description?: string; parent_id?: string | null } = {}
        if (updates.name != null) payload.name = updates.name
        if (updates.description != null) payload.description = updates.description
        if (updates.parentId !== undefined) payload.parent_id = updates.parentId ?? null

        const hasApiPayload = Object.keys(payload).length > 0
        if (!hasApiPayload && updates.isShared !== undefined) {
          set((state) => ({
            folders: state.folders.map((f) =>
              f.id === id ? { ...f, isShared: updates.isShared } : f
            ),
          }))
          return
        }
        
        await updateFolderApi(id, payload)
        const folder = get().folders.find((f) => f.id === id)
        if (folder) {
          await get().fetchFolders(folder.ownerId, folder.parentId)
          if (updates.isShared !== undefined) {
            set((state) => ({
              folders: state.folders.map((f) =>
                f.id === id ? { ...f, isShared: updates.isShared } : f
              ),
            }))
          }
        }
      },

      deleteFolder: async (id) => {
        await deleteFolderApi(id)
        const folder = get().folders.find((f) => f.id === id)
        if (folder) {
          await get().fetchFolders(folder.ownerId, folder.parentId)
        }
      },

      getFolder: (id) => {
        return get().folders.find((folder) => folder.id === id)
      },

      getFolders: () => {
        return get().folders
      },

      getFoldersByParent: (parentId) => {
        return get().folders.filter((folder) => folder.parentId === parentId)
      },

      isFolderNameUnique: (name, excludeId, parentId) => {
        const lowerName = name.toLowerCase().trim()
        return !get().folders.some(
          (folder) =>
            folder.name.toLowerCase().trim() === lowerName &&
            folder.id !== excludeId &&
            folder.parentId === parentId
        )
      },
    }),
    {
      name: 'folder-storage',
      partialize: (state) => ({ folders: state.folders }),
    }
  )
)
