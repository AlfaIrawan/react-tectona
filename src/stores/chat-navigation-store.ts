import { create } from 'zustand'

import { useChatPanelStore } from '@/stores/chat-panel-store'

export type OpenChatThreadRequest = {
  channelId: string
  senderUserId?: string
  channelType?: string
  channelTitle?: string | null
}

type ChatNavigationState = {
  pendingOpen: OpenChatThreadRequest | null
  requestOpen: (request: OpenChatThreadRequest) => void
  clearPendingOpen: () => void
}

export const useChatNavigationStore = create<ChatNavigationState>((set) => ({
  pendingOpen: null,
  requestOpen: (request) => {
    useChatPanelStore.getState().setOpen(true)
    set({ pendingOpen: request })
  },
  clearPendingOpen: () => set({ pendingOpen: null }),
}))

export function requestOpenChatThread(request: OpenChatThreadRequest): void {
  useChatNavigationStore.getState().requestOpen(request)
}
