import { create } from 'zustand'

import { useChatPanelStore } from '@/stores/chat-panel-store'

export type OpenIdeaDiscussChatRequest = {
  ideaId: string
  ideaTitle: string
  sectionKey: string
  sectionLabel: string
  ideaDescription: string
  currentSectionContent: string
  workspaceId?: string | null
  userId?: string | null
  isImpactSection?: boolean
}

export type OpenChatThreadRequest = {
  channelId?: string
  senderUserId?: string
  channelType?: string
  channelTitle?: string | null
  genAi?: OpenIdeaDiscussChatRequest
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

export function requestOpenIdeaDiscussChat(request: OpenIdeaDiscussChatRequest): void {
  useChatNavigationStore.getState().requestOpen({ genAi: request })
}
