import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface DisplayOrderState {
  /** Urutan ID project di root (tanpa folder). Persisted. */
  rootProjectOrder: string[]
  /** Urutan ID project per folder. Key = folderId, value = array project IDs. Persisted. */
  projectOrderByFolder: Record<string, string[]>
  /** Urutan ID folder. Persisted. */
  folderOrder: string[]

  setRootProjectOrder: (order: string[]) => void
  setFolderOrder: (order: string[]) => void
  setProjectOrderForFolder: (folderId: string, order: string[]) => void

  /** Reorder: pindahkan item dari oldIndex ke newIndex. */
  reorderRootProjects: (oldIndex: number, newIndex: number) => void
  reorderFolders: (oldIndex: number, newIndex: number) => void
  reorderProjectsInFolder: (folderId: string, oldIndex: number, newIndex: number) => void

  /** Dapatkan urutan tampilan: gabung order yang tersimpan + item yang belum ada di order. */
  getOrderedIds: (currentIds: string[], savedOrder: string[]) => string[]
}

export const useDisplayOrderStore = create<DisplayOrderState>()(
  persist(
    (set, get) => ({
      rootProjectOrder: [],
      projectOrderByFolder: {},
      folderOrder: [],

      setRootProjectOrder: (order) => set({ rootProjectOrder: order }),
      setFolderOrder: (order) => set({ folderOrder: order }),
      setProjectOrderForFolder: (folderId, order) =>
        set((s) => ({
          projectOrderByFolder: { ...s.projectOrderByFolder, [folderId]: order },
        })),

      reorderRootProjects: (oldIndex, newIndex) => {
        const { rootProjectOrder } = get()
        if (oldIndex === newIndex || oldIndex < 0 || newIndex < 0) return
        const next = [...rootProjectOrder]
        const [removed] = next.splice(oldIndex, 1)
        next.splice(newIndex, 0, removed)
        set({ rootProjectOrder: next })
      },

      reorderFolders: (oldIndex, newIndex) => {
        const { folderOrder } = get()
        if (oldIndex === newIndex || oldIndex < 0 || newIndex < 0) return
        const next = [...folderOrder]
        const [removed] = next.splice(oldIndex, 1)
        next.splice(newIndex, 0, removed)
        set({ folderOrder: next })
      },

      reorderProjectsInFolder: (folderId, oldIndex, newIndex) => {
        const { projectOrderByFolder } = get()
        const order = projectOrderByFolder[folderId] ?? []
        if (oldIndex === newIndex || oldIndex < 0 || newIndex < 0) return
        const next = [...order]
        const [removed] = next.splice(oldIndex, 1)
        next.splice(newIndex, 0, removed)
        set((s) => ({
          projectOrderByFolder: { ...s.projectOrderByFolder, [folderId]: next },
        }))
      },

      getOrderedIds: (currentIds, savedOrder) => {
        if (currentIds.length === 0) return []
        const orderSet = new Set(savedOrder)
        const ordered = savedOrder.filter((id) => currentIds.includes(id))
        const rest = currentIds.filter((id) => !orderSet.has(id))
        return [...ordered, ...rest]
      },
    }),
    { name: 'projects-display-order' }
  )
)
