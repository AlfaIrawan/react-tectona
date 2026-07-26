/**
 * Repair common LLM Mermaid fence mistakes and split prose vs diagram segments
 * so the UI can render flowcharts without relying on react-markdown code fences.
 */

export type MermaidContentSegment =
  | { type: 'prose'; text: string }
  | { type: 'mermaid'; source: string }
  | { type: 'tecchart'; source: string }

const OPEN_FENCE_RE = /```[ \t]*(mermaid|tecchart)\b[ \t]*/gi
const TRAILING_QUESTION_RE =
  /(?:\n\n|\s{2,})((?:apakah|does|is this|sudah|cek|please|tolong|can you).{0,200}\?)\s*$/i
const BARE_FLOWCHART_RE = /\b(flowchart\s+(?:TD|LR|TB|RL)\b[\s\S]*)$/i
const DIAGRAM_LINE_RE =
  /^(?:\s*(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|C4Context)\b|\s*[A-Za-z][\w-]*\s*(?:\[|\(|\{|--|==|-.|~~)|subgraph\b|\s*end\b|\s*%%|\s*direction\b|\s*style\b|\s*classDef\b|\s*linkStyle\b|\s*click\b)/i

function peelTrailingProseFromDiagram(body: string): { source: string; trailing: string } {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  let cut = lines.length
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]?.trim() ?? ''
    if (!line) {
      cut = i
      continue
    }
    if (DIAGRAM_LINE_RE.test(line) || /-->|==>|-\.-|---|===/.test(line)) {
      break
    }
    // Trailing conversational prose after the diagram body.
    if (/^[A-ZÀ-ÖØ-Þa-zà-öø-ÿ]/.test(line) || /[?？]$/.test(line)) {
      cut = i
      continue
    }
    break
  }
  if (cut >= lines.length) {
    return { source: body.trim(), trailing: '' }
  }
  const source = lines.slice(0, cut).join('\n').trim()
  const trailing = lines.slice(cut).join('\n').trim()
  return { source: source || body.trim(), trailing }
}

/**
 * Repair glued/unclosed fences. Also splits ```Tolong... (closing fence + prose on one line).
 */
export function normalizeMermaidFences(text: string): string {
  if (!text || (!text.includes('```') && !/\bflowchart\s+(TD|LR|TB|RL)\b/i.test(text))) {
    return text
  }

  const segments = splitMermaidContent(text)
  return segments
    .map((segment) => {
      if (segment.type === 'prose') return segment.text
      if (segment.type === 'mermaid') return `\n\n\`\`\`mermaid\n${segment.source}\n\`\`\`\n\n`
      return `\n\n\`\`\`tecchart\n${segment.source}\n\`\`\`\n\n`
    })
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Split assistant text into prose + diagram segments (preferred render path). */
export function splitMermaidContent(text: string): MermaidContentSegment[] {
  if (!text.trim()) return []

  const result: MermaidContentSegment[] = []
  let cursor = 0
  const input = text
  OPEN_FENCE_RE.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = OPEN_FENCE_RE.exec(input)) !== null) {
    const fenceStart = match.index
    const lang = (match[1] || 'mermaid').toLowerCase()
    let bodyStart = fenceStart + match[0].length
    if (input[bodyStart] === '\r') bodyStart += 1
    if (input[bodyStart] === '\n') bodyStart += 1

    // Closing fence: line that is only ```, OR ``` followed by prose on the same line.
    const closeMatch = input.slice(bodyStart).match(/```[^\n]*/)
    let bodyEnd: number
    let afterEnd: number
    let sameLineTrailing = ''

    if (closeMatch && closeMatch.index != null) {
      bodyEnd = bodyStart + closeMatch.index
      afterEnd = bodyEnd + closeMatch[0].length
      const afterTicks = closeMatch[0].slice(3).trim()
      if (afterTicks) sameLineTrailing = afterTicks
    } else {
      const question = TRAILING_QUESTION_RE.exec(input.slice(bodyStart))
      if (question && question.index != null) {
        bodyEnd = bodyStart + question.index
        afterEnd = input.length
        sameLineTrailing = question[1].trim()
      } else {
        bodyEnd = input.length
        afterEnd = input.length
      }
    }

    const before = input.slice(cursor, fenceStart)
    if (before.trim()) result.push({ type: 'prose', text: before })

    let body = input.slice(bodyStart, bodyEnd).replace(/^\s+|\s+$/g, '')
    const peeled = peelTrailingProseFromDiagram(body)
    body = peeled.source
    const trailingParts = [peeled.trailing, sameLineTrailing].filter(Boolean)

    if (body) {
      if (lang === 'tecchart') result.push({ type: 'tecchart', source: body })
      else result.push({ type: 'mermaid', source: body })
    }
    if (trailingParts.length > 0) {
      result.push({ type: 'prose', text: trailingParts.join('\n\n') })
    }

    cursor = afterEnd
    OPEN_FENCE_RE.lastIndex = afterEnd
  }

  const rest = input.slice(cursor)
  if (rest.trim()) {
    if (!result.some((s) => s.type === 'mermaid') && BARE_FLOWCHART_RE.test(rest)) {
      const bare = rest.match(BARE_FLOWCHART_RE)
      if (bare && bare.index != null) {
        const before = rest.slice(0, bare.index)
        if (before.trim()) result.push({ type: 'prose', text: before })
        const peeled = peelTrailingProseFromDiagram(bare[1].trim())
        result.push({ type: 'mermaid', source: peeled.source })
        if (peeled.trailing) result.push({ type: 'prose', text: peeled.trailing })
      } else {
        result.push({ type: 'prose', text: rest })
      }
    } else {
      result.push({ type: 'prose', text: rest })
    }
  }

  return result.filter((segment) => segment.type !== 'prose' || segment.text.trim())
}
