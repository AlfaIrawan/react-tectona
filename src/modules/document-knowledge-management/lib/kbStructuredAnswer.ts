export function kbLooksLikeHtml(content: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(content)
}

export function parseStrictJsonObjectFromAnswer<T extends Record<string, unknown>>(value: string): T | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const tryParseObject = (candidate: string): T | null => {
    const text = candidate.trim()
    if (!text.startsWith('{') || !text.endsWith('}')) return null
    try {
      const parsed = JSON.parse(text)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
      return parsed as T
    } catch {
      return null
    }
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenced?.[1]) {
    const parsedFromFence = tryParseObject(fenced[1])
    if (parsedFromFence) return parsedFromFence
  }

  const parsedDirect = tryParseObject(trimmed)
  if (parsedDirect) return parsedDirect

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const parsedEmbedded = tryParseObject(trimmed.slice(firstBrace, lastBrace + 1))
    if (parsedEmbedded) return parsedEmbedded
  }

  return null
}

function extractStructuredHtmlFromJsonObject(parsed: Record<string, unknown>): string {
  const candidateKeys = ['content_html', 'contentHtml', 'html', 'content', 'body', 'result', 'text'] as const

  for (const key of candidateKeys) {
    const candidate = parsed[key]
    if (typeof candidate !== 'string') continue

    const trimmed = candidate.trim()
    if (!trimmed) continue

    if (kbLooksLikeHtml(trimmed)) {
      return trimmed
    }

    const nestedParsed = parseStrictJsonObjectFromAnswer<Record<string, unknown>>(trimmed)
    if (nestedParsed) {
      const nestedHtml = extractStructuredHtmlFromJsonObject(nestedParsed)
      if (nestedHtml) return nestedHtml
    }
  }

  return ''
}

export function extractKbStructuredHtmlFromAnswer(answer: string): string {
  const parsed = parseStrictJsonObjectFromAnswer<Record<string, unknown>>(answer)
  const parsedHtml = parsed ? extractStructuredHtmlFromJsonObject(parsed) : ''
  const fencedHtml = answer.match(/```(?:html)?\s*([\s\S]*?)\s*```/i)?.[1]?.trim() ?? ''
  const directAnswer = answer.trim()
  const directHtml = kbLooksLikeHtml(directAnswer) ? directAnswer : ''
  return parsedHtml || fencedHtml || directHtml
}
