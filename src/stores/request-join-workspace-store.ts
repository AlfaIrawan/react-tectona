import { create } from 'zustand'

type RequestJoinWorkspaceStore = {
  open: boolean
  setOpen: (open: boolean) => void
  openPanel: () => void
  closePanel: () => void
}

export const useRequestJoinWorkspaceStore = create<RequestJoinWorkspaceStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  openPanel: () => set({ open: true }),
  closePanel: () => set({ open: false }),
}))
