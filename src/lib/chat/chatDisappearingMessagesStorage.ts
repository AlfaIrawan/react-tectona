const STORAGE_KEY = 'tectona.chat.disappearingMessages.v1'

export type DisappearingMessagesDuration = 'off' | '24h' | '7d' | '90d'

type DurationMap = Record<string, DisappearingMessagesDuration>

function readMap(): DurationMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as DurationMap
  } catch {
    return {}
  }
}

export function parseDisappearingMessagesDuration(
  raw: string | null | undefined,
): DisappearingMessagesDuration {
  if (raw === '24h' || raw === '7d' || raw === '90d' || raw === 'off') return raw
  return 'off'
}

export function getChannelDisappearingDuration(channelId: string): DisappearingMessagesDuration {
  const value = readMap()[channelId]
  return parseDisappearingMessagesDuration(value)
}

export function setChannelDisappearingDuration(
  channelId: string,
  duration: DisappearingMessagesDuration,
): void {
  const map = readMap()
  map[channelId] = duration
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore quota
  }
}

export function formatDisappearingDurationLabel(duration: DisappearingMessagesDuration): string {
  switch (duration) {
    case '24h':
      return '24 hours'
    case '7d':
      return '7 days'
    case '90d':
      return '90 days'
    default:
      return 'Off'
  }
}

export function isMessageExpiredByExpiresAt(expiresAtMs: number | undefined): boolean {
  if (expiresAtMs == null || expiresAtMs <= 0) return false
  return Date.now() >= expiresAtMs
}

export function applyDisappearingExpiryFilter<T extends { expiresAt?: number }>(messages: T[]): T[] {
  return messages.filter((m) => !isMessageExpiredByExpiresAt(m.expiresAt))
}
