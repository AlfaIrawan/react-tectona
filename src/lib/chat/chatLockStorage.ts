import {
  enableChannelChatLock,
  removeChannelChatLock,
  setChannelChatLock,
  verifyChannelChatLock,
  type CollaborationChannelApi,
} from '@/lib/api/collaborationContextApi'

export function hasChatLockPassword(hasPasswordFlag?: boolean): boolean {
  return hasPasswordFlag === true
}

/** Chat memakai kode rahasia (terkunci di server atau sudah punya password). */
export function isConversationChatLockActive(conv: {
  isLocked?: boolean
  hasChatLockPassword?: boolean
}): boolean {
  return hasChatLockPassword(conv.hasChatLockPassword) || conv.isLocked === true
}

export async function saveChatLockPassword(
  channelId: string,
  password: string,
): Promise<CollaborationChannelApi> {
  return setChannelChatLock(channelId, password)
}

export async function enableChatLock(channelId: string): Promise<CollaborationChannelApi> {
  return enableChannelChatLock(channelId)
}

export async function verifyChatLockPassword(
  channelId: string,
  password: string,
): Promise<boolean> {
  return verifyChannelChatLock(channelId, password)
}

export async function clearChatLockPassword(
  channelId: string,
  password?: string,
): Promise<CollaborationChannelApi> {
  return removeChannelChatLock(channelId, password)
}
