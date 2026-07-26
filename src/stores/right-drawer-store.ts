import { create } from 'zustand'

/**
 * Tracks whether a right-side detail drawer (e.g. Workspace Details) is open, so the
 * comm/chat panel can switch to FLOATING mode while the drawer would otherwise cover it,
 * and return to docked when the drawer closes.
 */
interface RightDrawerState {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useRightDrawerStore = create<RightDrawerState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
