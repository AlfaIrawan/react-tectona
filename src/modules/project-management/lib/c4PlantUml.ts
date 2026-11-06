const INCLUDE_L1 = '!include <C4/C4_Context>'
const INCLUDE_L2 = '!include <C4/C4_Container>'
const MACRO_START = /^(Person(?:_Ext)?|System_Boundary|Enterprise_Boundary|Container_Boundary|System(?:_Ext|Db)?|Container(?:_Ext|Db)?|Component(?:_Ext|Db)?|BiRel|Rel(?:_[UDLR])?|Boundary)\s*\(/i
export type C4Level = 'L1' | 'L2'
export type C4ElementKind = 'Person' | 'Person_Ext' | 'System' | 'System_Ext' | 'SystemDb' | 'Container' | 'Container_Ext' | 'ContainerDb' | 'Component' | 'Component_Ext' | 'ComponentDb'
export type C4ParsedElement = { id: string; kind: C4ElementKind; title: string; technology: string; description: string; parentId?: string; extraArgs?: string[] }
export type C4ParsedBoundary = { id: string; title: string; kind?: string; parentId?: string; extraArgs?: string[] }
export type C4ParsedRelation = { id: string; source: string; target: string; label: string; technology: string; macro?: string; extraArgs?: string[] }
export type C4ParsedGraph = { title: string; boundaries: C4ParsedBoundary[]; elements: C4ParsedElement[]; relations: C4ParsedRelation[]; extraStatements?: string[] }
type MacroCall = { name: string; args: string[]; parentId?: string }
const ELEMENT_KINDS: C4ElementKind[] = ['Person', 'Person_Ext', 'System', 'System_Ext', 'SystemDb', 'Container', 'Container_Ext', 'ContainerDb', 'Component', 'Component_Ext', 'ComponentDb']
const MACROS = [...ELEMENT_KINDS, 'System_Boundary', 'Enterprise_Boundary', 'Container_Boundary', 'Boundary', 'Rel', 'Rel_U', 'Rel_D', 'Rel_L', 'Rel_R', 'BiRel']
function extractBody(source: string): string {
  return source.replace(/\r\n/g, '\n').replace(/^\s*@startuml[^\n]*(?:\n|$)/i, '').replace(/\n?\s*@enduml\s*$/i, '')
}
function alias(value: string, fallback: string): string {
  if (/^[A-Za-z_][\w.-]*$/.test(value)) return value
  const slug = value.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
  return (/^\d/.test(slug) ? `c_${slug}` : slug) || fallback
}
function quote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
}
function parseArguments(text: string, start: number): { args: string[]; end: number } | null {
  const args: string[] = []
  let current = '', quoted = false, depth = 1
  for (let i = start; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '\\' && i + 1 < text.length) {
        const next = text[++i]
        current += next === 'n' ? '\n' : next === '"' || next === '\\' ? next : `\\${next}`
      } else if (char === '"') quoted = false
      else current += char
    } else if (char === '"') quoted = true
    else if (char === '(') { depth++; current += char }
    else if (char === ')') {
      if (--depth === 0) { args.push(current.trim()); return { args, end: i + 1 } }
      current += char
    } else if (char === ',' && depth === 1) { args.push(current.trim()); current = '' }
    else current += char
  }
  return null
}
// Scan outside comments/strings; boundary scope belongs to the actual braces, never the first boundary.
function collectCalls(body: string): { calls: MacroCall[]; extraStatements: string[] } {
  const calls: MacroCall[] = [], parents: (string | undefined)[] = []
  const remainder = body.split('')
  const erase = (a: number, b: number) => { for (let k = a; k < b; k++) if (remainder[k] !== '\n') remainder[k] = ' ' }
  for (let i = 0; i < body.length;) {
    if (body.slice(i, i + 2) === "/'") {
      const end = body.indexOf("'/", i + 2); i = end < 0 ? body.length : end + 2; continue
    }
    if (body[i] === "'") { const end = body.indexOf('\n', i); i = end < 0 ? body.length : end + 1; continue }
    const match = (i === 0 || !/[\w]/.test(body[i - 1])) ? MACRO_START.exec(body.slice(i)) : null
    if (match) {
      const parsed = parseArguments(body, i + match[0].length)
      if (parsed) {
        const name = MACROS.find(item => item.toLowerCase() === match[1].toLowerCase())!
        calls.push({ name, args: parsed.args, parentId: parents.at(-1) })
        erase(i, parsed.end)
        i = parsed.end
        if (name.endsWith('Boundary')) {
          while (/\s/.test(body[i] ?? '') && i < body.length) i++
          if (body[i] === '{') { parents.push(alias(parsed.args[0], 'boundary')); erase(i, i + 1); i++ }
        }
        continue
      }
    }
    if (body[i] === '"') {
      i++
      while (i < body.length) { if (body[i] === '\\') i += 2; else if (body[i++] === '"') break }
      continue
    }
    if (body[i] === '{') { parents.push(parents.at(-1)); erase(i, i + 1) }
    if (body[i] === '}') { parents.pop(); erase(i, i + 1) }
    i++
  }
  return { calls, extraStatements: remainder.join('').split('\n').map(s => s.trim()).filter(s => s && !/^title\s|^!include\s+.*C4[\/_]/i.test(s)) }
}
export function c4LevelFromDiagramKey(diagramKey: string): C4Level { return /level-1|l1/i.test(diagramKey) ? 'L1' : 'L2' }
export function parseC4Graph(source: string): C4ParsedGraph {
  const body = extractBody(source)
  const title = body.split('\n').find(line => /^\s*title\s+/i.test(line))?.replace(/^\s*title\s+/i, '').trim() ?? ''
  const { calls, extraStatements } = collectCalls(body)
  const graph: C4ParsedGraph = { title, boundaries: [], elements: [], relations: [], extraStatements }
  const seen = new Set<string>()
  for (const { name, args, parentId } of calls) {
    if (name.startsWith('Rel') || name === 'BiRel') {
      if (args.length < 2) continue
      const source = alias(args[0], 'from_el'), target = alias(args[1], 'to_el')
      graph.relations.push({ id: `rel-${source}-${target}-${graph.relations.length}`, source, target, label: args[2] ?? 'uses', technology: args[3] ?? '', macro: name, extraArgs: args.slice(4) })
    } else {
      if (!args.length) continue
      const id = alias(args[0], 'el')
      if (seen.has(id)) continue
      seen.add(id)
      if (name.endsWith('Boundary')) graph.boundaries.push({ id, title: args[1] ?? args[0], kind: name, parentId, extraArgs: args.slice(2) })
      else if (ELEMENT_KINDS.includes(name as C4ElementKind)) {
        const container = name.startsWith('Container') || name.startsWith('Component')
        graph.elements.push({ id, kind: name as C4ElementKind, title: args[1] ?? args[0], technology: container ? args[2] ?? '' : '', description: args[container ? 3 : 2] ?? '', parentId, extraArgs: args.slice(container ? 4 : 3) })
      }
    }
  }
  return graph
}
function renderElement(element: C4ParsedElement): string {
  const container = element.kind.startsWith('Container') || element.kind.startsWith('Component')
  const args = [quote(element.title)]
  if (container && (element.technology || element.description || element.extraArgs?.length)) args.push(quote(element.technology))
  if (element.description || element.extraArgs?.length) args.push(quote(element.description))
  args.push(...(element.extraArgs ?? []).map(quote))
  return `${element.kind}(${element.id}, ${args.join(', ')})`
}
export function serializeC4Graph(graph: C4ParsedGraph, level: C4Level): string {
  const lines = ['@startuml', level === 'L1' ? INCLUDE_L1 : INCLUDE_L2]
  if (graph.title) lines.push(`title ${graph.title}`)
  lines.push(...(graph.extraStatements ?? []))
  const emitted = new Set<string>(), boundaryIds = new Set(graph.boundaries.map(b => b.id))
  const emit = (parentId?: string, indent = '') => {
    for (const item of graph.elements.filter(e => e.parentId === parentId)) { lines.push(indent + renderElement(item)); emitted.add(item.id) }
    for (const boundary of graph.boundaries.filter(b => b.parentId === parentId)) {
      if (emitted.has(boundary.id)) continue
      emitted.add(boundary.id)
      const args = [quote(boundary.title), ...(boundary.extraArgs ?? []).map(quote)]
      lines.push(`${indent}${boundary.kind ?? 'System_Boundary'}(${boundary.id}, ${args.join(', ')}) {`)
      emit(boundary.id, indent + '  ')
      lines.push(indent + '}')
    }
  }
  emit()
  // Keep orphaned items if a containing boundary was deleted.
  for (const element of graph.elements) if (!emitted.has(element.id) && !boundaryIds.has(element.parentId ?? '')) lines.push(renderElement(element))
  for (const boundary of graph.boundaries) if (!emitted.has(boundary.id)) {
    lines.push(`${boundary.kind ?? 'System_Boundary'}(${boundary.id}, ${quote(boundary.title)}) {`)
    emitted.add(boundary.id); emit(boundary.id, '  '); lines.push('}')
  }
  for (const relation of graph.relations) {
    const args = [relation.source, relation.target, quote(relation.label)]
    if (relation.technology || relation.extraArgs?.length) args.push(quote(relation.technology))
    args.push(...(relation.extraArgs ?? []).map(quote))
    lines.push(`${relation.macro ?? 'Rel'}(${args.join(', ')})`)
  }
  lines.push('@enduml')
  return lines.join('\n') + '\n'
}
export function c4Stereotype(kind: C4ElementKind): string {
  if (kind === 'Person') return 'person'
  if (kind === 'Person_Ext') return 'external person'
  if (kind === 'System_Ext') return 'external system'
  if (kind === 'Container_Ext') return 'external container'
  if (kind.startsWith('Container')) return 'container'
  if (kind.startsWith('Component')) return kind.endsWith('_Ext') ? 'external component' : 'component'
  return 'system'
}
export function isC4External(kind: C4ElementKind): boolean { return kind.endsWith('_Ext') }
export function normalizeC4PlantUml(source: string, level: C4Level = 'L2'): string {
  if (!source.trim()) return ''
  // Wrapping source must not rewrite hierarchy, relationship direction, or free-form text.
  const body = extractBody(source.trim()).split('\n').filter(line => !/^\s*!include\s+.*C4[\/_]/i.test(line)).join('\n').trim()
  return ['@startuml', level === 'L1' ? INCLUDE_L1 : INCLUDE_L2, body, '@enduml', ''].join('\n')
}
