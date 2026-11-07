import type { ErdForeignKeyMapping } from './erdForeignKeyMapping'
export type UmlRelation = 'association' | 'directed-association' | 'aggregation' | 'composition' | 'generalization' | 'realization' | 'dependency'
export type UmlDecoration = 'none' | 'arrow' | 'triangle' | 'diamond' | 'filled-diamond'

export type UmlView = 'class' | 'erd'

export type UmlBox = {
  id: string
  title: string
  members: string[]
  kind?: 'class' | 'interface' | 'enumeration' | 'entity'
}

export type ErdEnd = {
  many: boolean
  optional: boolean
}

export type UmlLink = {
  erdForeignKey?: ErdForeignKeyMapping
  source: string
  target: string
  label: string
  relation?: UmlRelation
  sourceDecoration?: UmlDecoration
  targetDecoration?: UmlDecoration
  lineStyle?: 'solid' | 'dashed'
  sourceMultiplicity?: string
  targetMultiplicity?: string
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

const BLOCK_RE = /(class|entity|interface|enum)\s+(?:"([^"]+)"|([A-Za-z_][\w-]*))(?:\s+as\s+([A-Za-z_][\w-]*))?\s*\{([^}]*)\}/gi
const BARE_RE = /(class|entity|interface|enum)\s+(?:"([^"]+)"|([A-Za-z_][\w-]*))(?:\s+as\s+([A-Za-z_][\w-]*))?\s*$/gim
const REL_RE = /^([A-Za-z_][\w-]*)\s*(?:"([^"]*)"\s*)?([|{}o<>*+]*)(--+|\.\.+)([|{}o<>*+]*)(?:\s*"([^"]*)")?\s*([A-Za-z_][\w-]*)(?:\s*:\s*(.+))?$/

function decoration(token: string): UmlDecoration {
  if (token.includes('|')) return 'triangle'
  if (token.includes('*')) return 'filled-diamond'
  if (token.includes('o')) return 'diamond'
  if (/[<>]/.test(token)) return 'arrow'
  return 'none'
}
function relationKind(start: UmlDecoration, end: UmlDecoration, dashed: boolean): UmlRelation {
  if (start === 'triangle' || end === 'triangle') return dashed ? 'realization' : 'generalization'
  if (start === 'filled-diamond' || end === 'filled-diamond') return 'composition'
  if (start === 'diamond' || end === 'diamond') return 'aggregation'
  if (dashed) return 'dependency'
  return start === 'arrow' || end === 'arrow' ? 'directed-association' : 'association'
}


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
  const add = (keyword: string, title: string, id: string, members: string) => {
    const boxId = id || slug(title)
    if (!title || seen.has(boxId)) return
    seen.add(boxId)
    const kind = keyword === 'enum' ? 'enumeration' : keyword === 'interface' ? 'interface' : keyword === 'entity' ? 'entity' : 'class'
    boxes.push({ id: boxId, title, members: memberLines(members), kind })
  }

  let rest = extractBody(source).replace(BLOCK_RE, (_match, keyword: string, quoted: string, plain: string, alias: string, members: string) => {
    add(keyword, (quoted || plain || '').trim(), alias || (quoted ? slug(quoted) : plain), members || '')
    return ''
  })
  rest = rest.replace(BARE_RE, (_match, keyword: string, quoted: string, plain: string, alias: string) => {
    add(keyword, (quoted || plain || '').trim(), alias || (quoted ? slug(quoted) : plain), '')
    return ''
  })

  const links: UmlLink[] = []
  for (const line of rest.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("'") || trimmed.startsWith('!') || trimmed.startsWith('@') || /^title\b/i.test(trimmed)) continue
    const match = trimmed.match(REL_RE)
    if (!match) continue
    const sourceId = match[1]
    const targetId = match[7]
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
      label: (match[8] || '').trim(),
      sourceMultiplicity: match[2],
      targetMultiplicity: match[6],
      lineStyle: match[4].startsWith('.') ? 'dashed' : 'solid',
      ...(view === 'erd' ? {
        sourceEnd: parseCardinality(match[3]), targetEnd: parseCardinality(match[5]),
      } : {
        sourceDecoration: decoration(match[3]), targetDecoration: decoration(match[5]),
        relation: relationKind(decoration(match[3]), decoration(match[5]), match[4].startsWith('.')),
      }),
    })
  }
  return { view, boxes, links }
}

function quote(value: string): string {
  return `"${value.replace(/"/g, "'")}"`
}

function boxKeyword(view: UmlView, box: UmlBox): string {
  if (box.kind === 'interface') return 'interface'
  if (box.kind === 'enumeration') return 'enum'
  if (box.kind === 'entity' || view === 'erd') return 'entity'
  return 'class'
}

export function serializeUmlDiagram(diagram: UmlDiagram): string {
  const lines = ['@startuml', `' tectona-view: ${diagram.view}`]
  for (const box of diagram.boxes) {
    const keyword = boxKeyword(diagram.view, box)
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
    const connector = umlLinkConnector(link, diagram.view)
    const sourceMultiplicity = link.sourceMultiplicity !== undefined ? ` ${quote(link.sourceMultiplicity)}` : ''
    const targetMultiplicity = link.targetMultiplicity !== undefined ? `${quote(link.targetMultiplicity)} ` : ''
    lines.push(`${link.source}${sourceMultiplicity} ${connector} ${targetMultiplicity}${link.target}${link.label ? ` : ${link.label}` : ''}`)
  }
  lines.push('@enduml')
  return `${lines.join('\n')}\n`
}

export function umlRelationDefaults(relation: UmlRelation): Pick<UmlLink, 'relation' | 'sourceDecoration' | 'targetDecoration' | 'lineStyle'> {
  return { relation, sourceDecoration: relation === 'aggregation' ? 'diamond' : relation === 'composition' ? 'filled-diamond' : 'none',
    targetDecoration: relation === 'generalization' || relation === 'realization' ? 'triangle' : relation === 'dependency' || relation === 'directed-association' ? 'arrow' : 'none',
    lineStyle: relation === 'dependency' || relation === 'realization' ? 'dashed' : 'solid' }
}
export function umlLinkConnector(link: UmlLink, view: UmlView): string {
  const line = link.lineStyle === 'dashed' ? '..' : '--'
  if (view === 'erd' && (link.sourceEnd || link.targetEnd)) {
    const start = link.sourceEnd ?? { many: false, optional: false }
    const end = link.targetEnd ?? { many: false, optional: false }
    return `${start.many ? '}' : '|'}${start.optional ? 'o' : '|'}${line}${end.optional ? 'o' : '|'}${end.many ? '{' : '|'}`
  }
  const defaults = umlRelationDefaults(link.relation ?? 'directed-association')
  const start = link.sourceDecoration ?? defaults.sourceDecoration
  const end = link.targetDecoration ?? defaults.targetDecoration
  const token = (value: UmlDecoration | undefined, source: boolean) => value === 'triangle' ? (source ? '<|' : '|>') : value === 'diamond' ? 'o' : value === 'filled-diamond' ? '*' : value === 'arrow' ? (source ? '<' : '>') : ''
  return `${token(start, true)}${link.lineStyle ? line : defaults.lineStyle === 'dashed' ? '..' : '--'}${token(end, false)}`
}

type CanvasUmlEdge = { source: string; target: string; label?: unknown; data?: Record<string, unknown>; style?: { strokeDasharray?: unknown } }
export function umlLinkToCanvasData(link: UmlLink): Record<string, unknown> {
  return { umlRelation: link.relation, sourceDecoration: link.sourceDecoration, targetDecoration: link.targetDecoration,
    lineStyle: link.lineStyle, sourceMultiplicity: link.sourceMultiplicity, targetMultiplicity: link.targetMultiplicity,
    sourceMany: link.sourceEnd?.many, sourceOptional: link.sourceEnd?.optional,
    targetMany: link.targetEnd?.many, targetOptional: link.targetEnd?.optional }
}
export function umlLinkFromCanvasEdge(edge: CanvasUmlEdge, view: UmlView): UmlLink {
  const data = edge.data ?? {}
  const visual = data.visual as { lineStyle?: string } | undefined
  const lineStyle = visual?.lineStyle === 'solid' ? 'solid' : visual?.lineStyle ? 'dashed' : data.lineStyle ?? (edge.style?.strokeDasharray ? 'dashed' : undefined)
  return { source: edge.source, target: edge.target, label: String(edge.label ?? ''),
    relation: data.umlRelation as UmlRelation | undefined,
    sourceDecoration: data.sourceDecoration as UmlDecoration | undefined,
    targetDecoration: data.targetDecoration as UmlDecoration | undefined,
    lineStyle: lineStyle as UmlLink['lineStyle'],
    sourceMultiplicity: data.sourceMultiplicity as string | undefined, targetMultiplicity: data.targetMultiplicity as string | undefined,
    ...(view === 'erd' ? { sourceEnd: { many: !!data.sourceMany, optional: !!data.sourceOptional }, targetEnd: { many: !!data.targetMany, optional: !!data.targetOptional } } : {}) }
}
export function erdRelationDefaults(relation: string): Record<string, boolean> {
  return { sourceMany: relation === 'many-to-many', targetMany: !['one-to-one', 'one-to-zero-or-one'].includes(relation),
    sourceOptional: false, targetOptional: relation === 'one-to-zero-or-one' || relation === 'one-to-zero-or-many' }
}
