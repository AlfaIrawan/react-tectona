const STORAGE_KEY = 'tectona.chat.mutedChannels'

function readSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

export function isChannelMuted(channelId: string): boolean {
  return readSet().has(channelId)
}

export function setChannelMuted(channelId: string, muted: boolean): void {
  const set = readSet()
  if (muted) set.add(channelId)
  else set.delete(channelId)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch {
    // ignore quota
  }
}
