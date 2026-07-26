import type { DisappearingMessagesDuration } from './chatDisappearingMessagesStorage'
import { parseDisappearingMessagesDuration } from './chatDisappearingMessagesStorage'

const STORAGE_KEY = 'tectona.chat.disappearingNotices.v1'

export type DisappearingNoticeKind = 'enabled' | 'changed' | 'disabled'

export type DisappearingNoticeRecord = {
  id: string
  channelId: string
  at: number
  kind: DisappearingNoticeKind
  duration: DisappearingMessagesDuration
}

type NoticeMap = Record<string, DisappearingNoticeRecord[]>

function readMap(): NoticeMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as NoticeMap
  } catch {
    return {}
  }
}

function writeMap(map: NoticeMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore quota
  }
}

/** Phrase embedded in system notice copy (e.g. "90 days"). */
export function disappearingNoticeDurationPhrase(duration: DisappearingMessagesDuration): string {
  switch (duration) {
    case '24h':
      return '24 hours'
    case '7d':
      return '7 days'
    case '90d':
      return '90 days'
    default:
      return '24 hours'
  }
}

export function getChannelDisappearingNotices(channelId: string): DisappearingNoticeRecord[] {
  const list = readMap()[channelId] ?? []
  return [...list].sort((a, b) => a.at - b.at)
}

export function recordDisappearingNoticeForActor(
  channelId: string,
  previousDuration: DisappearingMessagesDuration,
  nextDuration: DisappearingMessagesDuration,
): DisappearingNoticeRecord | null {
  const prev = parseDisappearingMessagesDuration(previousDuration)
  const next = parseDisappearingMessagesDuration(nextDuration)
  if (prev === next) return null

  let kind: DisappearingNoticeKind
  if (next === 'off') {
    kind = 'disabled'
  } else if (prev === 'off') {
    kind = 'enabled'
  } else {
    kind = 'changed'
  }

  const record: DisappearingNoticeRecord = {
    id: `dm-notice-${channelId}-${Date.now()}`,
    channelId,
    at: Date.now(),
    kind,
    duration: next === 'off' ? prev : next,
  }

  const map = readMap()
  const existing = map[channelId] ?? []
  map[channelId] = [...existing, record]
  writeMap(map)
  return record
}
