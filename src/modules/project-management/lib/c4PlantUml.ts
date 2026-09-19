const INCLUDE_L1 = '!include <C4/C4_Context>'
const INCLUDE_L2 = '!include <C4/C4_Container>'

const MACRO_START =
  /\b(Person(?:_Ext)?|System_Boundary|Enterprise_Boundary|Container_Boundary|System(?:_Ext|Db)?|Container(?:_Ext|Db)?|Component(?:_Ext|Db)?|BiRel|Rel(?:_[UDLR])?|Boundary)\s*\(/gi

export type C4Level = 'L1' | 'L2'
type MacroCall = { name: string; args: string[] }

function extractBody(source: string): string {
  const text = source.replace(/\r\n/g, '\n').replace(/\\n/g, '\n')
  const start = text.search(/@startuml\b/i)
  const end = text.search(/@enduml\b/i)
  if (start >= 0 && end > start) {
    return text.slice(text.indexOf('\n', start) + 1, end)
  }
  if (start >= 0) return text.slice(text.indexOf('\n', start) + 1)
  return text
}

function cleanArg(value: string): string {
  return value
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[[{(]+|[\]})]+$/g, '')
    .trim()
}

function parseArgumentList(text: string, start: number): { args: string[]; closeAt: number } {
  const args: string[] = []
  let current = ''
  let index = start
  let depth = 1
  let inString = false
  let quote = ''

  while (index < text.length) {
    const char = text[index]
    if (inString) {
      if (char === quote) inString = false
      else if (char === '\n') {
        inString = false
        if (current.trim()) args.push(current.trim())
        current = ''
      } else current += char
      index += 1
      continue
    }
    if (char === '"' || char === "'") {
      inString = true
      quote = char
      index += 1
      continue
    }
    if (char === '[' || char === ']' || char === '{' || char === '}') {
      if (char === ']' && depth === 1) {
        if (current.trim()) args.push(current.trim())
        return { args: args.map(cleanArg).filter(Boolean), closeAt: index }
      }
      index += 1
      continue
    }
    if (char === '(') {
      depth += 1
      current += char
      index += 1
      continue
    }
    if (char === ')') {
      depth -= 1
      if (depth === 0) {
        if (current.trim()) args.push(current.trim())
        return { args: args.map(cleanArg).filter(Boolean), closeAt: index }
      }
      current += char
      index += 1
      continue
    }
    if (char === ',' && depth === 1) {
      if (current.trim()) args.push(current.trim())
      current = ''
      index += 1
      continue
    }
    current += char
    index += 1
  }
  if (current.trim()) args.push(current.trim())
  return { args: args.map(cleanArg).filter(Boolean), closeAt: -1 }
}

function collectCalls(body: string): MacroCall[] {
  const calls: MacroCall[] = []
  MACRO_START.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = MACRO_START.exec(body))) {
    const parsed = parseArgumentList(body, match.index + match[0].length)
    if (parsed.closeAt < 0) continue
    calls.push({ name: canonicalMacro(match[1]), args: parsed.args })
    MACRO_START.lastIndex = parsed.closeAt + 1
  }
  return calls
}

function canonicalMacro(name: string): string {
  const key = name.toLowerCase()
  const map: Record<string, string> = {
    person: 'Person',
    person_ext: 'Person_Ext',
    system: 'System',
    system_ext: 'System_Ext',
    systemdb: 'SystemDb',
    system_boundary: 'System_Boundary',
    enterprise_boundary: 'Enterprise_Boundary',
    boundary: 'Boundary',
    container: 'Container',
    container_ext: 'Container_Ext',
    containerdb: 'ContainerDb',
    container_boundary: 'Container_Boundary',
    component: 'Component',
    component_ext: 'Component_Ext',
    componentdb: 'ComponentDb',
    rel: 'Rel',
    rel_u: 'Rel_U',
    rel_d: 'Rel_D',
    rel_l: 'Rel_L',
    rel_r: 'Rel_R',
    birel: 'BiRel',
  }
  return map[key] ?? name
}

function alias(value: string, fallback: string): string {
  let slug = value.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
  if (/^\d/.test(slug)) slug = `c_${slug}`
  return slug || fallback
}

function quote(value: string): string {
  return `"${cleanArg(value).replace(/"/g, "'").slice(0, 120)}"`
}

function isAlias(value: string): boolean {
  return /^[A-Za-z_][\w.-]*$/.test(value)
}

function renderCall(call: MacroCall): string {
  const { name, args } = call
  if (name.startsWith('Rel') || name === 'BiRel') {
    if (args.length < 2) return ''
    const src = alias(args[0], 'from_el')
    const dst = alias(args[1], 'to_el')
    const label = quote(args[2] || 'uses')
    const relationMacro = name === 'BiRel' ? 'Rel' : name
    return args[3]
      ? `${relationMacro}(${src}, ${dst}, ${label}, ${quote(args[3])})`
      : `${relationMacro}(${src}, ${dst}, ${label})`
  }
  if (name.endsWith('Boundary') || name === 'Boundary') {
    if (!args.length) return ''
    return `${name}(${alias(args[0], 'boundary')}, ${quote(args[1] || args[0])})`
  }
  if (!args.length) return ''
  const id = isAlias(args[0]) ? args[0] : alias(args[0], 'el')
  const label = args[1] || args[0]
  if (['Person', 'Person_Ext', 'System', 'System_Ext', 'SystemDb'].includes(name)) {
    return args[2] ? `${name}(${id}, ${quote(label)}, ${quote(args[2])})` : `${name}(${id}, ${quote(label)})`
  }
  if (args[3]) return `${name}(${id}, ${quote(label)}, ${quote(args[2] || 'Application')}, ${quote(args[3])})`
  if (args[2]) return `${name}(${id}, ${quote(label)}, ${quote(args[2])})`
  return `${name}(${id}, ${quote(label)})`
}

function nestBoundary(statements: string[]): string[] {
  const relations = statements.filter((item) => item.startsWith('Rel') || item.startsWith('BiRel'))
  const others = statements.filter((item) => !relations.includes(item))
  const boundary = others.find((item) => item.startsWith('System_Boundary(') || item.startsWith('Enterprise_Boundary('))
  const containers = others.filter((item) => item.startsWith('Container(') || item.startsWith('ContainerDb(') || item.startsWith('Component('))
  const rest = others.filter((item) => item !== boundary && !containers.includes(item))
  if (!boundary || containers.length === 0) return [...others, ...relations]
  return [...rest, `${boundary} {`, ...containers.map((item) => `  ${item}`), '}', ...relations]
}

export function c4LevelFromDiagramKey(diagramKey: string): C4Level {
  return /level-1|l1/i.test(diagramKey) ? 'L1' : 'L2'
}

export type C4ElementKind =
  | 'Person'
  | 'Person_Ext'
  | 'System'
  | 'System_Ext'
  | 'SystemDb'
  | 'Container'
  | 'Container_Ext'
  | 'ContainerDb'
  | 'Component'

export type C4ParsedElement = {
  id: string
  kind: C4ElementKind
  title: string
  technology: string
  description: string
  parentId?: string
}

export type C4ParsedBoundary = {
  id: string
  title: string
}

export type C4ParsedRelation = {
  id: string
  source: string
  target: string
  label: string
  technology: string
}

export type C4ParsedGraph = {
  title: string
  boundaries: C4ParsedBoundary[]
  elements: C4ParsedElement[]
  relations: C4ParsedRelation[]
}

const ELEMENT_KINDS = new Set<string>([
  'Person',
  'Person_Ext',
  'System',
  'System_Ext',
  'SystemDb',
  'Container',
  'Container_Ext',
  'ContainerDb',
  'Component',
])

export function parseC4Graph(source: string): C4ParsedGraph {
  const body = extractBody(source)
  const titleMatch = body.split('\n').map((line) => line.trim()).find((line) => /^title\s+/i.test(line))
  const title = titleMatch ? cleanArg(titleMatch.replace(/^title\s+/i, '')) : ''
  const calls = collectCalls(body)
  const boundaries: C4ParsedBoundary[] = []
  const elements: C4ParsedElement[] = []
  const relations: C4ParsedRelation[] = []
  const seen = new Set<string>()

  for (const call of calls) {
    if (call.name.startsWith('Rel') || call.name === 'BiRel') {
      if (call.args.length < 2) continue
      const sourceId = alias(call.args[0], 'from_el')
      const targetId = alias(call.args[1], 'to_el')
      if (relations.some((relation) => (
        (relation.source === sourceId && relation.target === targetId)
        || (relation.source === targetId && relation.target === sourceId)
      ))) continue
      relations.push({
        id: `rel-${sourceId}-${targetId}-${relations.length}`,
        source: sourceId,
        target: targetId,
        label: call.args[2] || 'uses',
        technology: call.args[3] || '',
      })
      continue
    }
    if (call.name.endsWith('Boundary') || call.name === 'Boundary') {
      if (!call.args.length) continue
      const id = isAlias(call.args[0]) ? call.args[0] : alias(call.args[0], 'boundary')
      if (seen.has(id)) continue
      seen.add(id)
      boundaries.push({ id, title: call.args[1] || call.args[0] })
      continue
    }
    if (!ELEMENT_KINDS.has(call.name) || !call.args.length) continue
    const id = isAlias(call.args[0]) ? call.args[0] : alias(call.args[0], 'el')
    if (seen.has(id)) continue
    seen.add(id)
    const kind = call.name as C4ElementKind
    const isContainerLike = kind.startsWith('Container') || kind === 'Component'
    elements.push({
      id,
      kind,
      title: call.args[1] || call.args[0],
      technology: isContainerLike ? call.args[2] || '' : '',
      description: isContainerLike ? call.args[3] || '' : call.args[2] || '',
    })
  }

  const parentId = boundaries[0]?.id
  if (parentId) {
    for (const element of elements) {
      if (element.kind === 'Container' || element.kind === 'ContainerDb' || element.kind === 'Component') {
        element.parentId = parentId
      }
    }
  }

  return { title, boundaries, elements, relations }
}

export function serializeC4Graph(graph: C4ParsedGraph, level: C4Level): string {
  const include = level === 'L1' ? INCLUDE_L1 : INCLUDE_L2
  const statements: string[] = []
  const parentId = graph.boundaries[0]?.id
  const inside = graph.elements.filter((item) => item.parentId && item.parentId === parentId)
  const outside = graph.elements.filter((item) => !inside.includes(item))

  for (const element of outside) {
    statements.push(renderElement(element))
  }
  if (graph.boundaries[0]) {
    statements.push(`System_Boundary(${graph.boundaries[0].id}, ${quote(graph.boundaries[0].title)}) {`)
    for (const element of inside) {
      statements.push(`  ${renderElement(element)}`)
    }
    statements.push('}')
  }
  for (const relation of graph.relations) {
    const tech = relation.technology ? `, ${quote(relation.technology)}` : ''
    statements.push(`Rel(${relation.source}, ${relation.target}, ${quote(relation.label || 'uses')}${tech})`)
  }
  const lines = ['@startuml', include]
  if (graph.title) lines.push(`title ${graph.title}`)
  lines.push(...statements)
  lines.push('@enduml')
  return `${lines.join('\n')}\n`
}

function renderElement(element: C4ParsedElement): string {
  const title = quote(element.title)
  if (element.kind === 'Person' || element.kind === 'Person_Ext' || element.kind === 'System' || element.kind === 'System_Ext' || element.kind === 'SystemDb') {
    return element.description
      ? `${element.kind}(${element.id}, ${title}, ${quote(element.description)})`
      : `${element.kind}(${element.id}, ${title})`
  }
  if (element.description) {
    return `${element.kind}(${element.id}, ${title}, ${quote(element.technology || 'Application')}, ${quote(element.description)})`
  }
  if (element.technology) {
    return `${element.kind}(${element.id}, ${title}, ${quote(element.technology)})`
  }
  return `${element.kind}(${element.id}, ${title})`
}

export function c4Stereotype(kind: C4ElementKind): string {
  if (kind === 'Person') return 'person'
  if (kind === 'Person_Ext') return 'external person'
  if (kind === 'System_Ext') return 'external system'
  if (kind === 'SystemDb') return 'system'
  if (kind === 'Container_Ext') return 'external container'
  if (kind === 'Container' || kind === 'ContainerDb') return 'container'
  if (kind === 'Component') return 'component'
  return 'system'
}

export function isC4External(kind: C4ElementKind): boolean {
  return kind.endsWith('_Ext')
}

export function normalizeC4PlantUml(source: string, level: C4Level = 'L2'): string {
  const raw = source.trim()
  if (!raw) return ''
  const body = extractBody(raw)
  const include = level === 'L1' ? INCLUDE_L1 : INCLUDE_L2
  const titleMatch = body.split('\n').map((line) => line.trim()).find((line) => /^title\s+/i.test(line))
  const title = titleMatch ? cleanArg(titleMatch.replace(/^title\s+/i, '')) : ''
  const statements = collectCalls(body).map(renderCall).filter(Boolean)
  const lines = ['@startuml', include]
  if (title) lines.push(`title ${title}`)
  lines.push(...nestBoundary(statements))
  lines.push('@enduml')
  return `${lines.join('\n')}\n`
}
