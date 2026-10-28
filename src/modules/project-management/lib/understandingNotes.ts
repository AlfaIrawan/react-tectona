/** Split a brainstorm understanding into separate notes. Not the Live AI Summary sections. */

const BULLET = /^(?:[-*•]|\d+[.)])\s+/

export function parseUnderstandingNotes(text: string): string[] {
  const notes: string[] = []
  let current = ''
  for (const raw of (text || '').replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line || /^#{1,6}\s+/.test(line)) {
      if (current) notes.push(current)
      current = ''
      continue
    }
    if (BULLET.test(line)) {
      if (current) notes.push(current)
      current = line.replace(BULLET, '').trim()
    } else if (!current) {
      current = line
    } else {
      current = `${current} ${line}`
    }
  }
  if (current) notes.push(current)
  return notes.filter(Boolean)
}

export const UNDERSTANDING_PREVIEW_COUNT = 3

export function understandingStartsCollapsed(notes: string[]): boolean {
  return notes.length > UNDERSTANDING_PREVIEW_COUNT
}
