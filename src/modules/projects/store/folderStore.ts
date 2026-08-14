import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FolderApi } from '@/lib/api/folderApi'
import {
  fetchFolders as fetchFoldersApi,
  fetchAllFolders,
  createFolder as createFolderApi,
  updateFolder as updateFolderApi,
  deleteFolder as deleteFolderApi,
} from '@/lib/api/folderApi'
import { buildDuplicateFolderName, buildDuplicateProjectName } from '../lib/folderActions'
import { getFolderClipboard } from '../lib/folderClipboard'
import {
  applyWorkspaceIdFromWrite,
  belongsToActiveWorkspaceScope,
  readActiveWorkspaceScope,
  resolveWorkspaceIdForFetch,
  resolveWorkspaceIdForWrite,
} from '@/lib/tenantWorkspaceScope'
import { useFolderNotesStore } from './folderNotesStore'
import { useProjectStore } from './projectStore'

export interface Folder {
  id: string
  workspaceId?: string | null
  name: string
  description?: string
  ownerId: string
  isShared?: boolean
  members?: {
    userId: string
    displayName: string
    roleCode: string
    roleName: string
  }[]
  parentId?: string | null
  borderColor?: string
  projectCount: number
  childrenCount: number
  createdAt: string
  updatedAt: string
}

function mapApiToFolder(
  api: FolderApi,
  extras?: Partial<Pick<Folder, 'borderColor'>>,
): Folder {
  const members = (api.members ?? []).map((member) => ({
    userId: member.user_id,
    displayName: member.display_name,
    roleCode: member.role_code,
    roleName: member.role_name,
  }))
  return {
    id: api.id,
    workspaceId: api.workspace_id ?? undefined,
    name: api.name,
    description: api.description ?? undefined,
    ownerId: api.owner_id,
    isShared: members.length > 1,
    members,
    parentId: api.parent_id ?? undefined,
    borderColor: extras?.borderColor,
    projectCount: api.project_count,
    childrenCount: api.children_count,
    createdAt: api.created_date,
    updatedAt: api.updated_date ?? api.created_date,
  }
}

function mergeFolderPresentation(prev: Folder | undefined, mapped: Folder): Folder {
  if (!prev) return mapped
  return {
    ...mapped,
    borderColor: prev.borderColor ?? mapped.borderColor,
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
  moveFolderToParent: (id: string, parentId: string | null) => Promise<void>
  duplicateFolder: (id: string, targetParentId?: string | null) => Promise<Folder>
  pasteFolderFromClipboard: (targetParentId: string | null) => Promise<Folder>
  clearLocalCache: () => void
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
          const scope = readActiveWorkspaceScope()
          const workspace_id = resolveWorkspaceIdForFetch(scope)
          const isScopedFetch = parentId !== undefined
          const apiFolders = isScopedFetch
            ? (
                await fetchFoldersApi({
                  page: 1,
                  page_size: 500,
                  owner_id: ownerId,
                  parent_id: parentId,
                  workspace_id,
                })
              ).folders
            : await fetchAllFolders({ owner_id: ownerId, workspace_id })

          const prevById = new Map(get().folders.map((folder) => [folder.id, folder]))
          let incoming = apiFolders
            .filter((api) => belongsToActiveWorkspaceScope(api.workspace_id, scope))
            .map((api) => mergeFolderPresentation(prevById.get(api.id), mapApiToFolder(api)))
          const incomingIds = new Set(incoming.map((folder) => folder.id))

          set((state) => {
            if (!isScopedFetch) {
              return {
                folders: incoming,
                foldersLoading: false,
                foldersError: null,
              }
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
          const msg =
            raw === 'Failed to fetch' || raw.toLowerCase().includes('network')
              ? 'Unable to connect to the Project Service. Make sure python-project-service-fastapi is running on port 8500 (or set VITE_PROJECT_API_URL in .env).'
              : raw
          set({ foldersLoading: false, foldersError: msg })
        }
      },

      addFolder: async (folderData) => {
        const scope = readActiveWorkspaceScope()
        const workspace_id = resolveWorkspaceIdForWrite(scope)
        const created = await createFolderApi({
          name: folderData.name,
          description: folderData.description,
          parent_id: folderData.parentId ?? null,
          owner_id: folderData.ownerId ?? '00000000-0000-0000-0000-000000000001',
          workspace_id,
        })
        const mapped = mapApiToFolder(created, {
          borderColor: folderData.borderColor,
        })
        const folder: Folder = {
          ...mapped,
          workspaceId: applyWorkspaceIdFromWrite(mapped.workspaceId, workspace_id) ?? mapped.workspaceId,
        }

        const upsertFolder = (folders: Folder[]) => {
          const index = folders.findIndex((f) => f.id === folder.id)
          if (index < 0) return [...folders, folder]
          const next = [...folders]
          next[index] = { ...next[index], ...folder }
          return next
        }

        await get().fetchFolders(folderData.ownerId, folderData.parentId)
        // fetchFolders may drop the row when workspace scope filters untagged API rows — re-upsert the create result.
        set((state) => ({ folders: upsertFolder(state.folders) }))
        const found = get().folders.find((f) => f.id === folder.id)
        return found ?? folder
      },

      updateFolder: async (id, updates) => {
        const payload: { name?: string; description?: string; parent_id?: string | null } = {}
        if (updates.name != null) payload.name = updates.name
        if (updates.description != null) payload.description = updates.description
        if (updates.parentId !== undefined) payload.parent_id = updates.parentId ?? null

        const hasLocalOnlyUpdate =
          updates.borderColor !== undefined || updates.isShared !== undefined
        const hasApiPayload = Object.keys(payload).length > 0

        if (hasLocalOnlyUpdate) {
          set((state) => ({
            folders: state.folders.map((f) =>
              f.id === id
                ? {
                    ...f,
                    ...(updates.borderColor !== undefined && { borderColor: updates.borderColor }),
                    ...(updates.isShared !== undefined && { isShared: updates.isShared }),
                  }
                : f,
            ),
          }))
        }

        if (!hasApiPayload) {
          return
        }
        
        await updateFolderApi(id, payload)
        const folder = get().folders.find((f) => f.id === id)
        if (folder) {
          const preservedBorderColor = folder.borderColor
          const preservedIsShared = folder.isShared
          await get().fetchFolders(folder.ownerId, folder.parentId)
          if (preservedBorderColor !== undefined || preservedIsShared !== undefined) {
            set((state) => ({
              folders: state.folders.map((f) =>
                f.id === id
                  ? {
                      ...f,
                      ...(preservedBorderColor !== undefined && { borderColor: preservedBorderColor }),
                      ...(preservedIsShared !== undefined && { isShared: preservedIsShared }),
                    }
                  : f,
              ),
            }))
          }
        }
      },

      deleteFolder: async (id) => {
        await deleteFolderApi(id)
        set((state) => ({
          folders: state.folders.filter((folder) => folder.id !== id),
        }))
      },

      getFolder: (id) => {
        return get().folders.find((folder) => folder.id === id)
      },

      getFolders: () => {
        return get().folders
      },

      getFoldersByParent: (parentId) => {
        const normalizedParent = parentId ?? null
        return get().folders.filter(
          (folder) => (folder.parentId ?? null) === normalizedParent,
        )
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
        const parentId =
          targetParentId !== undefined ? targetParentId : (source.parentId ?? null)
        const uniqueName = buildDuplicateFolderName(
          source.name,
          get().folders,
          parentId,
          (name, excludeId, parent) => get().isFolderNameUnique(name, excludeId, parent),
        )

        const created = await get().addFolder({
          name: uniqueName,
          description: source.description,
          parentId,
          ownerId: source.ownerId,
          borderColor: source.borderColor,
        })

        const sourceProjects = useProjectStore.getState().getProjectsByFolder(id)
        const usedProjectNames = new Set<string>()
        for (const project of sourceProjects) {
          const duplicateName = buildDuplicateProjectName(project.name, usedProjectNames)
          usedProjectNames.add(duplicateName.toLowerCase())
          await useProjectStore.getState().addProject({
            name: duplicateName,
            description: project.description,
            tags: project.tags,
            iconName: project.iconName,
            borderColor: project.borderColor,
            folderId: created.id,
          })
        }

        await useProjectStore.getState().fetchProjects()
        useFolderNotesStore.getState().duplicateNotesToFolder(id, created.id)
        return created
      },

      pasteFolderFromClipboard: async (targetParentId) => {
        const clip = getFolderClipboard()
        if (!clip) {
          throw new Error('No folder in clipboard')
        }
        return get().duplicateFolder(clip.folderId, targetParentId)
      },

      clearLocalCache: () => {
        set({ folders: [], foldersLoading: false, foldersError: null })
      },
    }),
    {
      name: 'folder-storage-v2',
      partialize: (state) => ({ folders: state.folders }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const scope = readActiveWorkspaceScope()
        state.folders = state.folders.filter((folder) =>
          belongsToActiveWorkspaceScope(folder.workspaceId, scope),
        )
      },
    }
  )
)
