import { create } from 'zustand'

/**
 * Tracks modal-like overlays (Dialog, context menu) so chrome such as the comm panel
 * resize line can hide while any of them is open.
 */
interface UiOverlayState {
  blockingOverlayCount: number
  incBlockingOverlay: () => void
  decBlockingOverlay: () => void
}

export const useUiOverlayStore = create<UiOverlayState>((set) => ({
  blockingOverlayCount: 0,
  incBlockingOverlay: () => set((s) => ({ blockingOverlayCount: s.blockingOverlayCount + 1 })),
  decBlockingOverlay: () =>
    set((s) => ({ blockingOverlayCount: Math.max(0, s.blockingOverlayCount - 1) })),
}))
