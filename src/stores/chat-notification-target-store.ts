import { create } from 'zustand'

type ChatNotificationTargetState = {
  activeChannelId: string | null
  setActiveChannelId: (channelId: string | null) => void
}

export const useChatNotificationTargetStore = create<ChatNotificationTargetState>((set) => ({
  activeChannelId: null,
  setActiveChannelId: (channelId) => set({ activeChannelId: channelId }),
}))
