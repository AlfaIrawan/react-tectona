import { create } from 'zustand'

import type { PresenceUiStatus } from '@/lib/chat/presenceUi'

interface MyPresenceState {
  status: PresenceUiStatus
  setStatus: (status: PresenceUiStatus) => void
}

export const useMyPresenceStore = create<MyPresenceState>((set) => ({
  status: 'offline',
  setStatus: (status) => set({ status }),
}))
