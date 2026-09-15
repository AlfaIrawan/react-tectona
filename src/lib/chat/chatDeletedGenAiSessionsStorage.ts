/**
 * Local tombstones for Gen AI sidebar sessions the user deleted.
 * Prevents an in-flight list or a merge of leftover local rows from putting them back.
 */

const STORAGE_KEY = 'tectona.chat.deletedGenAiSessions.v1'

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  } catch {
    return []
  }
}

function writeIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(-400)))
  } catch {
    // ignore quota
  }
}

export function getDeletedGenAiSessionIds(): Set<string> {
  return new Set(readIds())
}

export function rememberDeletedGenAiSessionIds(ids: string[]): void {
  const next = getDeletedGenAiSessionIds()
  for (const id of ids) {
    const trimmed = id.trim()
    if (trimmed) next.add(trimmed)
  }
  writeIds([...next])
}

export function isGenAiSessionTombstoned(id: string): boolean {
  return getDeletedGenAiSessionIds().has(id)
}
