import { create } from 'zustand'

interface ProjectDocsState {
  refreshVersion: number
  bumpRefresh: () => void
}

export const useProjectDocsStore = create<ProjectDocsState>((set) => ({
  refreshVersion: 0,
  bumpRefresh: () => set((state) => ({ refreshVersion: state.refreshVersion + 1 })),
}))
