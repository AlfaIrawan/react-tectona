import type { CollaborationMessageApi } from '@/lib/api/collaborationContextApi'

export type ChatMessageRealtimePayload = {
  channel_id: string
  message_id: string
  sender_user_id: string
  body: string
  sequence_no: number
  channel_type?: string
  channel_title?: string | null
  workspace_id?: string
}

export const CHAT_MESSAGE_RECEIVED_EVENT = 'tectona:chat-message-received'
export const CHAT_CHANNEL_RECEIPT_EVENT = 'tectona:chat-channel-receipt'
export const NOTIFICATIONS_UPDATED_EVENT = 'tectona:notifications-updated'

export type ChatChannelReceiptPayload = {
  channel_id: string
  user_id: string
  sequence_no: number
  kind: 'read' | 'delivered'
}

export function emitChatMessageReceived(payload: ChatMessageRealtimePayload): void {
  window.dispatchEvent(
    new CustomEvent(CHAT_MESSAGE_RECEIVED_EVENT, {
      detail: payload,
    }),
  )
}

export function emitNotificationsUpdated(payload?: unknown): void {
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT, { detail: payload }))
}

export function emitChatChannelReceipt(payload: ChatChannelReceiptPayload): void {
  window.dispatchEvent(
    new CustomEvent(CHAT_CHANNEL_RECEIPT_EVENT, {
      detail: payload,
    }),
  )
}

export function toCollaborationMessageApi(payload: ChatMessageRealtimePayload): CollaborationMessageApi {
  return {
    id: payload.message_id,
    channel_id: payload.channel_id,
    sender_user_id: payload.sender_user_id,
    message_role: 'user',
    body: payload.body,
    sequence_no: payload.sequence_no,
    message_at: new Date().toISOString(),
  }
}
