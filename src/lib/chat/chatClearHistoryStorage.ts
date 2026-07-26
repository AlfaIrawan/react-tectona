/**
 * Per-user "clear chat" watermark (local). Messages with sequence_no <= stored value
 * stay hidden after reopen / inbox sync until new messages arrive.
 */

const STORAGE_KEY = 'tectona.chat.clearHistory.v1'

type ClearMap = Record<string, number>

function readMap(): ClearMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as ClearMap
  } catch {
    return {}
  }
}

function writeMap(map: ClearMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore quota
  }
}

export function conversationClearKey(conversationId: string): string {
  return `conv:${conversationId}`
}

/** Highest sequence hidden for this channel and/or conversation row. */
export function getClearBeforeSequence(channelId?: string, conversationId?: string): number {
  const map = readMap()
  const values: number[] = []
  if (channelId && map[channelId] != null) values.push(map[channelId])
  if (conversationId && map[conversationClearKey(conversationId)] != null) {
    values.push(map[conversationClearKey(conversationId)])
  }
  return values.length > 0 ? Math.max(...values) : 0
}

export function recordChatHistoryCleared(
  channelId: string | undefined,
  conversationId: string,
  maxVisibleSequence: number,
): void {
  if (maxVisibleSequence <= 0) return
  const map = readMap()
  const bump = (key: string) => {
    map[key] = Math.max(map[key] ?? 0, maxVisibleSequence)
  }
  bump(conversationClearKey(conversationId))
  if (channelId) bump(channelId)
  writeMap(map)
}

export function applyClearHistoryFilter<T extends { sequenceNo?: number }>(
  messages: T[],
  channelId?: string,
  conversationId?: string,
): T[] {
  const before = getClearBeforeSequence(channelId, conversationId)
  if (before <= 0) return messages
  return messages.filter((m) => (m.sequenceNo ?? 0) > before)
}

export function isChannelPreviewCleared(channelId: string, lastSequenceNo: number): boolean {
  const before = getClearBeforeSequence(channelId)
  return before > 0 && lastSequenceNo > 0 && lastSequenceNo <= before
}
