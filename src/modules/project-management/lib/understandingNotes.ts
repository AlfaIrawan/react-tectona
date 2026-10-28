/** Split a brainstorm understanding into numbered notes. Not the Live AI Summary sections. */

const BULLET = /^(\s*)(?:[-*•]|\d+[.)])\s+(.*)$/
const LABELED_ITEM = /^[^:\n]{1,48}:\s+\S/

export type UnderstandingNote = {
  text: string
  children: UnderstandingNote[]
}

export function parseUnderstandingNotes(text: string): UnderstandingNote[] {
  const rows: { depth: number; text: string }[] = []
  let current: { depth: number; text: string } | null = null
  for (const raw of (text || '').replace(/\r\n/g, '\n').split('\n')) {
    const bullet = raw.match(BULLET)
    const line = raw.trim()
    if (!line || /^#{1,6}\s+/.test(line)) {
      if (current) rows.push(current)
      current = null
      continue
    }
    if (bullet) {
      if (current) rows.push(current)
      current = { depth: Math.floor(bullet[1].replace(/\t/g, '  ').length / 2), text: bullet[2].trim() }
    } else if (!current) {
      current = { depth: 0, text: line }
    } else {
      current = { ...current, text: `${current.text} ${line}` }
    }
  }
  if (current) rows.push(current)
  return nestIntroducedLists(toTree(rows))
}

function toTree(rows: { depth: number; text: string }[]): UnderstandingNote[] {
  const root: UnderstandingNote[] = []
  const stack: { depth: number; node: UnderstandingNote }[] = []
  for (const row of rows) {
    const node: UnderstandingNote = { text: row.text, children: [] }
    while (stack.length > 0 && stack[stack.length - 1].depth >= row.depth) stack.pop()
    const parent = stack[stack.length - 1]
    ;(parent ? parent.node.children : root).push(node)
    stack.push({ depth: row.depth, node })
  }
  return root.filter(note => note.text)
}

/** "…meliputi:" then "WhatsApp: …" is 1 / 1.1, including when the source lost its indent. */
function nestIntroducedLists(notes: UnderstandingNote[]): UnderstandingNote[] {
  const result: UnderstandingNote[] = []
  for (let index = 0; index < notes.length; index += 1) {
    const note: UnderstandingNote = {
      text: notes[index].text,
      children: nestIntroducedLists(notes[index].children),
    }
    if (note.children.length === 0 && /:\s*$/.test(note.text)) {
      const children: UnderstandingNote[] = []
      while (
        index + 1 < notes.length
        && notes[index + 1].children.length === 0
        && LABELED_ITEM.test(notes[index + 1].text)
      ) {
        index += 1
        children.push({ text: notes[index].text, children: [] })
      }
      note.children = children
    }
    result.push(note)
  }
  return result
}

export function countUnderstandingNotes(notes: UnderstandingNote[]): number {
  return notes.reduce((total, note) => total + 1 + countUnderstandingNotes(note.children), 0)
}

export const UNDERSTANDING_PREVIEW_COUNT = 3

export function understandingStartsCollapsed(notes: UnderstandingNote[]): boolean {
  return countUnderstandingNotes(notes) > UNDERSTANDING_PREVIEW_COUNT
}

/** First N notes in reading order, keeping a parent when one of its children is shown. */
export function previewUnderstandingNotes(notes: UnderstandingNote[], limit: number): UnderstandingNote[] {
  const kept: UnderstandingNote[] = []
  let taken = 0
  for (const note of notes) {
    if (taken >= limit) break
    taken += 1
    const children = previewUnderstandingNotes(note.children, limit - taken)
    taken += countUnderstandingNotes(children)
    kept.push({ text: note.text, children })
  }
  return kept
}
