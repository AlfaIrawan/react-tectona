import { create } from 'zustand'

/** Matches Workspace Management's detail drawers, the original caller of this store. */
export const DEFAULT_RIGHT_DRAWER_WIDTH = 480

/**
 * Tracks whether a right-side panel (e.g. Workspace Details drawer, a project's sidebar) is
 * open, so the comm/chat panel can switch to FLOATING mode — parked clear of that panel — while
 * it would otherwise cover a docked chat, and return to docked when the panel closes.
 */
interface RightDrawerState {
  open: boolean
  /** Pixel width to reserve so the floating chat doesn't overlap the open panel. */
  width: number
  setOpen: (open: boolean) => void
  setWidth: (width: number) => void
}

export const useRightDrawerStore = create<RightDrawerState>((set) => ({
  open: false,
  width: DEFAULT_RIGHT_DRAWER_WIDTH,
  setOpen: (open) => set({ open }),
  setWidth: (width) => set({ width }),
}))
