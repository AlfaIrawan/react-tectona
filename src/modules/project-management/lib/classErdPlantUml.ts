export type UmlView = 'class' | 'erd'

export type UmlBox = {
  id: string
  title: string
  members: string[]
}

export type ErdEnd = {
  many: boolean
  optional: boolean
}

export type UmlLink = {
  source: string
  target: string
  label: string
  sourceEnd?: ErdEnd
  targetEnd?: ErdEnd
}

export type UmlDiagram = {
  view: UmlView
  boxes: UmlBox[]
  links: UmlLink[]
}

function extractBody(source: string): string {
  const text = source.replace(/\r\n/g, '\n')
  const start = text.search(/@startuml\b/i)
  const end = text.search(/@enduml\b/i)
  if (start >= 0 && end > start) return text.slice(text.indexOf('\n', start) + 1, end)
  return text
}

function slug(value: string): string {
  const next = value.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
  return next || 'box'
}

function memberLines(body: string): string[] {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && line !== '--' && line !== '..' && line !== '__' && !line.startsWith("'"))
}

const BLOCK_RE = /(?:class|entity|interface)\s+(?:"([^"]+)"|([A-Za-z_][\w]*))(?:\s+as\s+([A-Za-z_][\w]*))?\s*\{([^}]*)\}/gi
const BARE_RE = /(?:class|entity|interface)\s+(?:"([^"]+)"|([A-Za-z_][\w]*))(?:\s+as\s+([A-Za-z_][\w]*))?\s*$/gim
const REL_RE = /^([A-Za-z_][\w]*)\s+([|}.o<>*+]*)\s*((?:--+>?)|(?:\.+>?)|(?:--+)|(?:\.+))\s*([|}.o<>*+]*)\s+([A-Za-z_][\w]*)(?:\s*:\s*(.+))?$/

function parseCardinality(token: string): ErdEnd | undefined {
  if (!token || /^[<>]+$/.test(token)) return undefined
  const many = /[}{*]/.test(token)
  const optional = token.includes('o')
  if (!many && !optional && !token.includes('|')) return undefined
  return { many, optional }
}

export function parseUmlDiagram(source: string, view: UmlView): UmlDiagram {
  const boxes: UmlBox[] = []
  const seen = new Set<string>()
  const add = (title: string, id: string, members: string) => {
    const boxId = id || slug(title)
    if (!title || seen.has(boxId)) return
    seen.add(boxId)
    boxes.push({ id: boxId, title, members: memberLines(members) })
  }

  let rest = extractBody(source).replace(BLOCK_RE, (_match, quoted: string, plain: string, alias: string, members: string) => {
    add((quoted || plain || '').trim(), alias || (quoted ? slug(quoted) : plain), members || '')
    return ''
  })
  rest = rest.replace(BARE_RE, (_match, quoted: string, plain: string, alias: string) => {
    add((quoted || plain || '').trim(), alias || (quoted ? slug(quoted) : plain), '')
    return ''
  })

  const links: UmlLink[] = []
  for (const line of rest.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("'") || trimmed.startsWith('!') || trimmed.startsWith('@') || /^title\b/i.test(trimmed)) continue
    const match = trimmed.match(REL_RE)
    if (!match) continue
    const sourceId = match[1]
    const targetId = match[5]
    if (!seen.has(sourceId)) {
      seen.add(sourceId)
      boxes.push({ id: sourceId, title: sourceId, members: [] })
    }
    if (!seen.has(targetId)) {
      seen.add(targetId)
      boxes.push({ id: targetId, title: targetId, members: [] })
    }
    links.push({
      source: sourceId,
      target: targetId,
      label: (match[6] || '').trim(),
      sourceEnd: parseCardinality(match[2] || ''),
      targetEnd: parseCardinality(match[4] || ''),
    })
  }
  return { view, boxes, links }
}

function quote(value: string): string {
  return `"${value.replace(/"/g, "'")}"`
}

export function serializeUmlDiagram(diagram: UmlDiagram): string {
  const keyword = diagram.view === 'erd' ? 'entity' : 'class'
  const lines = ['@startuml', `' tectona-view: ${diagram.view}`]
  for (const box of diagram.boxes) {
    const simple = box.title === box.id && /^[A-Za-z_]\w*$/.test(box.title)
    const name = simple ? box.title : `${quote(box.title)} as ${box.id}`
    if (box.members.length === 0) {
      lines.push(`${keyword} ${name}`)
      continue
    }
    lines.push(`${keyword} ${name} {`)
    for (const member of box.members) lines.push(`  ${member}`)
    lines.push('}')
  }
  for (const link of diagram.links) {
    lines.push(link.label ? `${link.source} --> ${link.target} : ${link.label}` : `${link.source} --> ${link.target}`)
  }
  lines.push('@enduml')
  return `${lines.join('\n')}\n`
}
