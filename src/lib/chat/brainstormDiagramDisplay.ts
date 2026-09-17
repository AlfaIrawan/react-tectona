/** Split brainstorm assistant text so PlantUML process diagrams render without raw source leaking. */

export type BrainstormDisplayPart =
  | { type: 'prose'; text: string }
  | { type: 'png'; src: string }
  | { type: 'mermaid'; source: string }
  | { type: 'plantuml'; source: string }

const PART_RE =
  /!\[[^\]]*\]\((data:image\/(?:png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=\s]+)\)|```bpmn\b[\s\S]*?```|<!--tectona-mermaid\s*\r?\n([\s\S]*?)-->|```[ \t]*mermaid\b[ \t]*\r?\n([\s\S]*?)```|```[ \t]*plantuml\b[ \t]*\r?\n([\s\S]*?)```|(?<![\w:/])(data:image\/(?:png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=\s]{80,})/gi

function compactDataUrl(raw: string): string {
  const compact = raw.replace(/\s+/g, '')
  return compact.startsWith('data:image/') ? compact : ''
}

export function splitBrainstormDisplayParts(text: string): BrainstormDisplayPart[] {
  const input = text || ''
  if (!input.trim()) return []
  const parts: BrainstormDisplayPart[] = []
  let cursor = 0
  PART_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = PART_RE.exec(input)) !== null) {
    if (match.index > cursor) {
      parts.push({ type: 'prose', text: input.slice(cursor, match.index) })
    }
    const dataUrl = match[1] || match[5]
    const commentMermaid = match[2]
    const fenceMermaid = match[3]
    const fencePlantUml = match[4]
    if (dataUrl) {
      const src = compactDataUrl(dataUrl)
      if (src) parts.push({ type: 'png', src })
    } else if (commentMermaid?.trim()) {
      parts.push({ type: 'mermaid', source: commentMermaid.trim() })
    } else if (fenceMermaid?.trim()) {
      parts.push({ type: 'mermaid', source: fenceMermaid.trim() })
    } else if (fencePlantUml?.trim()) {
      parts.push({ type: 'plantuml', source: fencePlantUml.trim() })
    }
    // ```bpmn fences are dropped from the visible bubble.
    cursor = match.index + match[0].length
  }
  if (cursor < input.length) {
    parts.push({ type: 'prose', text: input.slice(cursor) })
  }
  const filtered = parts.filter((part) => part.type !== 'prose' || part.text.trim().length > 0)
  const hasPng = filtered.some((part) => part.type === 'png')
  if (!hasPng) return filtered
  return filtered.filter((part) => part.type !== 'mermaid' && part.type !== 'plantuml')
}

export function brainstormTypingCutoff(text: string): number {
  const markers = ['```mermaid', '```plantuml', '![Diagram', 'data:image/', '```bpmn', '<!--tectona-mermaid']
  let cut = text.length
  for (const marker of markers) {
    const idx = text.indexOf(marker)
    if (idx >= 0 && idx < cut) cut = idx
  }
  return cut
}
