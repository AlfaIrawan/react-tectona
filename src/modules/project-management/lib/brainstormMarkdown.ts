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

export type NotedAnswer = { question: string; answer: string }

const NOTED_ANSWER = /^(?:Untuk pertanyaan|For)\s+["“«]([\s\S]+?)["”»]\s*,\s*(?:dari ceritamu aku catat|from what you told me I noted)\s*:\s*([\s\S]+)$/i

/** "Untuk pertanyaan \"…\", dari ceritamu aku catat: …" is one question plus the answer being confirmed. */
export function parseNotedAnswer(paragraph: string): NotedAnswer | null {
  const clean = paragraph.replace(/(?<!\\)\*\*/g, '').trim()
  const match = clean.match(NOTED_ANSWER)
  if (!match) return null
  const question = match[1].trim()
  const answer = match[2].trim()
  if (!question || !answer) return null
  return { question, answer }
}

function isClosingQuestion(paragraph: string): boolean {
  return paragraph.endsWith('?') || /\?\s*(?:\([^)]*\)\s*)+$/.test(paragraph)
}

export function splitBrainstormQuestion(text: string, questionText?: string | null) {
  const paragraphs = text.trim().split(/\n{2,}/)
  const last = paragraphs.at(-1) ?? ''
  const cleanLast = last.replace(/(?<!\\)\*\*/g, '').trim()
  const asked = questionText?.replace(/(?<!\\)\*\*/g, '').trim() ?? ''
  if (last.includes('```') || last.includes('~~~')) return { rest: text, question: '' }
  const lastAsks = isClosingQuestion(cleanLast)
  if (lastAsks && (!asked || cleanLast === asked || cleanLast.startsWith(asked))) {
    return { rest: paragraphs.slice(0, -1).join('\n\n'), question: cleanLast }
  }
  if (!asked) return { rest: text, question: '' }
  return { rest: cleanLast === asked ? paragraphs.slice(0, -1).join('\n\n') : text, question: asked }
}
