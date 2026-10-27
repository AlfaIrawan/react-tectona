/** Repair orphan emphasis only outside code; balanced Markdown and literal escapes stay intact. */
export function normalizeBrainstormMarkdown(text: string): string {
  return text.split(/(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]+`)/g).map((part, index) => {
    if (index % 2) return part
    return part.split(/(\n\s*\n)/g).map((paragraph, number) => {
      if (number % 2) return paragraph
      const markers = [...paragraph.matchAll(/(?<![\\*])\*\*(?!\*)/g)]
      if (markers.length % 2 === 0) return paragraph
      const at = markers.at(-1)!.index!
      return paragraph.slice(0, at) + paragraph.slice(at + 2)
    }).join('')
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
