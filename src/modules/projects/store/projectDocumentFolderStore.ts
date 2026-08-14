import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ProjectDocumentFolderState {
  /** Project id → document repository folder id */
  byProjectId: Record<string, string>
  getFolderId: (projectId: string) => string | undefined
  setFolderMapping: (projectId: string, folderId: string) => void
  removeFolderMapping: (projectId: string) => void
}

export const useProjectDocumentFolderStore = create<ProjectDocumentFolderState>()(
  persist(
    (set, get) => ({
      byProjectId: {},
      getFolderId: (projectId) => get().byProjectId[projectId],
      setFolderMapping: (projectId, folderId) =>
        set((state) => ({
          byProjectId: { ...state.byProjectId, [projectId]: folderId },
        })),
      removeFolderMapping: (projectId) =>
        set((state) => {
          const next = { ...state.byProjectId }
          delete next[projectId]
          return { byProjectId: next }
        }),
    }),
    { name: 'project-document-folder-storage' },
  ),
)
