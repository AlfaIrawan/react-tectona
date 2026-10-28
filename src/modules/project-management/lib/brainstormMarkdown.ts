const EMPHASIS = /(?<![\\*])\*\*(?!\*)/g
// A list item is its own span. An opener above the list must not pair with a closer inside a bullet.
const LIST_BREAK = /\n\s*(?:[-*•]|\d{1,2}[.)])\s+/

function dropUnpairedEmphasis(paragraph: string): string {
  const markers = [...paragraph.matchAll(EMPHASIS)]
  if (markers.length === 0) return paragraph
  const stack: number[] = []
  const paired = new Set<number>()
  markers.forEach((marker, index) => {
    const open = stack.at(-1)
    const between = open === undefined ? '' : paragraph.slice(markers[open].index! + 2, marker.index)
    if (open !== undefined && !LIST_BREAK.test(between)) {
      paired.add(stack.pop()!)
      paired.add(index)
    } else stack.push(index)
  })
  if (paired.size === markers.length) return paragraph
  let out = paragraph
  for (let index = markers.length - 1; index >= 0; index -= 1) {
    if (paired.has(index)) continue
    const at = markers[index].index!
    out = out.slice(0, at) + out.slice(at + 2)
  }
  return out
}

/** Repair orphan emphasis only outside code; balanced Markdown and literal escapes stay intact. */
export function normalizeBrainstormMarkdown(text: string): string {
  return text.split(/(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]+`)/g).map((part, index) => {
    if (index % 2) return part
    return part.split(/(\n\s*\n)/g).map((paragraph, number) => (
      number % 2 ? paragraph : dropUnpairedEmphasis(paragraph)
    )).join('')
  }).join('')
}

export function splitBrainstormQuestion(text: string, questionText?: string | null) {
  const paragraphs = text.trim().split(/\n{2,}/)
  const last = paragraphs.at(-1) ?? ''
  const cleanLast = last.replace(/(?<!\\)\*\*/g, '').trim()
  const question = questionText?.replace(/(?<!\\)\*\*/g, '').trim() || cleanLast
  if (last.includes('```') || last.includes('~~~') || (!questionText && !cleanLast.endsWith('?'))) return { rest: text, question: '' }
  return { rest: cleanLast === question ? paragraphs.slice(0, -1).join('\n\n') : text, question }
}
