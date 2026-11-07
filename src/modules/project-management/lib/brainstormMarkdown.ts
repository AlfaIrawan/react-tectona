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

/** Presentation only: recognize stored scoped confirmations without rewriting the transcript. */
export function splitScopedConfirmation(text: string) {
  const content = splitScopedConfirmationContent(text)
  return content?.answer ? content : null
}

/** Keep a recognized topic styled consistently even when its answer is unavailable. */
export function splitScopedConfirmationContent(text: string) {
  const heading = /(?:^|\n)(?:\*\*)?(?:Yang ingin aku konfirmasi|Please confirm):[^\S\n]*([^\n]+)(?:\n+|$)/i.exec(text)
  if (!heading) return null
  const tail = text.slice(heading.index + heading[0].length)
  const answer = /^(?:Pemahamanku untuk poin ini|My understanding of this point):\s*([\s\S]+?)(?=\n\s*\n|$)/i.exec(tail)
  return {
    before: text.slice(0, heading.index).trim(),
    question: heading[1].replace(/(?<!\\)\*\*/g, '').trim(),
    answer: answer?.[1].trim() ?? '',
    after: answer ? tail.slice(answer[0].length).trim() : tail.trim(),
  }
}

export function scopedConfirmationAnswerMissing(text: string): boolean {
  return /(?:^|\n)(?:\*\*)?(?:Yang ingin aku konfirmasi|Please confirm):/i.test(text)
    && !splitScopedConfirmation(text)
}

function isClosingQuestion(paragraph: string): boolean {
  return paragraph.endsWith('?') || /\?\s*(?:\([^)]*\)\s*)+$/.test(paragraph)
}

export function splitBrainstormQuestion(text: string, questionText?: string | null) {
  const paragraphs = text.trim().split(/\n{2,}/)
  const last = paragraphs.at(-1) ?? ''
  const cleanLast = last.replace(/(?<!\\)\*\*/g, '').trim()
  const asked = questionText?.replace(/(?<!\\)\*\*/g, '').trim() ?? ''
  const lastHasFence = last.includes('```') || last.includes('~~~')
  if (lastHasFence && !asked) return { rest: text, question: '' }
  const lastAsks = isClosingQuestion(cleanLast)
  if (!lastHasFence && lastAsks && (!asked || cleanLast === asked || (asked.endsWith('?') && cleanLast.startsWith(asked) && /^\s*(?:\([^)]*\)\s*)+$/.test(cleanLast.slice(asked.length))))) {
    return { rest: paragraphs.slice(0, -1).join('\n\n'), question: cleanLast }
  }
  if (!asked) return { rest: text, question: '' }
  // Structured questions may be absent from prose, precede an instruction, or
  // follow a diagram. Never suppress them because a different field contains code.
  // Remove a matching prose occurrence only; leave every surrounding instruction.
  let offset = 0
  for (const [index, part] of text.split(/(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]+`)/g).entries()) {
    if (index % 2 === 0) {
      const pattern = asked.split(/\s+/).map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')
      const plain = part.replace(/(?<!\\)\*\*/g, '')
      const match = new RegExp(pattern).exec(plain)
      // A quoted question inside a recorded answer/instruction is meaningful context.
      // Deduplicate only a question starting its own prose line.
      const suffix = match ? plain.slice(match.index + match[0].length) : ''
      const endsPrompt = /^(?:[^\S\n]*\n|\s*$)/.test(suffix)
        || (/[?!.]$/.test(asked) && /^\s/.test(suffix))
      if (match && endsPrompt && !plain.slice(0, match.index).split('\n').at(-1)?.trim()) {
        // Map the emphasis-free match back to original offsets, retaining other Markdown.
        const positions: number[] = []
        for (let at = 0; at < part.length; at += 1) {
          if (part.slice(at, at + 2) === '**' && part[at - 1] !== '\\') { at += 1; continue }
          positions.push(at)
        }
        let start = positions[match.index], end = positions[match.index + match[0].length - 1] + 1
        if (part.slice(Math.max(0, start - 2), start) === '**' && part.slice(end, end + 2) === '**') { start -= 2; end += 2 }
        return { rest: (text.slice(0, offset + start) + text.slice(offset + end)).trim(), question: asked }
      }
    }
    offset += part.length
  }
  return { rest: text, question: asked }
}
