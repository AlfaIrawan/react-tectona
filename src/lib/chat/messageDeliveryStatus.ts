/** WhatsApp-style outbound ticks for People (DM) chat. */

import type { ChatMode } from '@/lib/chat/chatContactDirectory'

export type OutboundDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read'

/** Highest sequence_no from messages the peer sent (for read receipts we emit). */
export function maxInboundMessageSequence(
  messages: { role: string; sequenceNo?: number }[],
  mode: ChatMode,
): number {
  if (mode === 'team') {
    return messages
      .filter((m) => m.role === 'assistant')
      .reduce((max, m) => Math.max(max, m.sequenceNo ?? 0), 0)
  }
  return 0
}

/** Highest sequence_no visible in the thread (own read cursor on server). */
export function maxVisibleMessageSequence(messages: { sequenceNo?: number }[]): number {
  return messages.reduce((max, m) => Math.max(max, m.sequenceNo ?? 0), 0)
}

export function resolveOutboundDeliveryStatus(
  sequenceNo: number | undefined,
  peerLastReadSequence: number,
  peerLastDeliveredSequence: number,
): OutboundDeliveryStatus {
  if (sequenceNo == null || sequenceNo <= 0) return 'pending'
  if (peerLastReadSequence >= sequenceNo) return 'read'
  if (peerLastDeliveredSequence >= sequenceNo) return 'delivered'
  return 'sent'
}
