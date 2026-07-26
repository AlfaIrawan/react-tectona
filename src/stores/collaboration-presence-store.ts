import { create } from 'zustand'

import type { CollaborationPresenceApi } from '@/lib/api/collaborationContextApi'

interface CollaborationPresenceState {
  byUserId: Record<string, CollaborationPresenceApi>
  applyRealtimeUpdate: (update: CollaborationPresenceApi) => void
  replaceFromApiRows: (rows: CollaborationPresenceApi[]) => void
  clear: () => void
}

export const useCollaborationPresenceStore = create<CollaborationPresenceState>((set) => ({
  byUserId: {},
  applyRealtimeUpdate: (update) =>
    set((state) => {
      if (update.status === 'offline') {
        const { [update.user_id]: _removed, ...rest } = state.byUserId
        return { byUserId: rest }
      }
      return { byUserId: { ...state.byUserId, [update.user_id]: update } }
    }),
  replaceFromApiRows: (rows) =>
    set(() => {
      const byUserId: Record<string, CollaborationPresenceApi> = {}
      for (const row of rows) {
        if (row.status !== 'offline') {
          byUserId[row.user_id] = row
        }
      }
      return { byUserId }
    }),
  clear: () => set({ byUserId: {} }),
}))
