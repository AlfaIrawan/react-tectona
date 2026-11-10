import { buildReadOnlyDiagramCanvasGraph } from '../components/EditableDiagramCanvas'
import { canPreviewUmlLosslessly } from './classErdPlantUml'
import { canPreviewBpmnLosslessly } from './bpmnPreviewFidelity'
import { toBpmnEditorSource } from './bpmnPlantUml'
import { parsePlantUmlToIntegrationGraph } from './parsePlantUmlToIntegrationGraph'

export type NativePreviewKind = 'bpmn' | 'class' | 'erd' | 'c4' | 'use-case' | 'archimate'
export type CanonicalPreviewKind = NativePreviewKind | 'sequence'
type CanvasGraph = ReturnType<typeof buildReadOnlyDiagramCanvasGraph>

function normalizedPreviewKind(kind?: string): CanonicalPreviewKind | null {
  if (kind === 'as_is' || kind === 'to_be') return 'bpmn'
  return kind && ['bpmn', 'class', 'erd', 'c4', 'use-case', 'archimate', 'sequence'].includes(kind) ? kind as CanonicalPreviewKind : null
}

export function hasConflictingPreviewKind(source: string, declaredKind?: string): boolean {
  const sourceKinds = [...source.matchAll(/^\s*'\s*tectona-view:\s*([\w-]+)\s*$/gim)]
    .map(match => normalizedPreviewKind(match[1].toLowerCase())).filter(Boolean)
  const declared = normalizedPreviewKind(declaredKind)
  return new Set([...sourceKinds, ...(declared ? [declared] : [])]).size > 1
}

export function canonicalPreviewKind(source: string, notation?: 'bpmn' | 'plantuml', declaredKind?: string, declaredLanguage?: string): CanonicalPreviewKind | null {
  // Typed metadata is a discriminator, not permission to convert another language.
  if ((declaredLanguage && declaredLanguage !== 'plantuml') || /^\s*(?:classDiagram|erDiagram|sequenceDiagram)\b/.test(source)) return null
  if (hasConflictingPreviewKind(source, declaredKind)) return null
  const explicit = /^\s*'\s*tectona-view:\s*([\w-]+)\s*$/im.exec(source)?.[1]?.toLowerCase()
  if (explicit && ['class', 'erd', 'c4', 'use-case', 'archimate', 'sequence'].includes(explicit)) return explicit as CanonicalPreviewKind
  if (declaredKind && ['bpmn', 'class', 'erd', 'c4', 'use-case', 'archimate', 'sequence'].includes(declaredKind)) return declaredKind as CanonicalPreviewKind
  if (declaredKind === 'as_is' || declaredKind === 'to_be') return 'bpmn'
  if (/!include\s*<archimate\//i.test(source)) return 'archimate'
  if (/!include\s*<C4\//i.test(source)) return 'c4'
  if (/^\s*(?:participant|autonumber)\b/m.test(source)) return 'sequence'
  if (/^\s*(?:class|interface|enum)\b/m.test(source)) return 'class'
  if (/^\s*entity\b/m.test(source)) return 'erd'
  if (/^\s*usecase\b/m.test(source)) return 'use-case'
  return notation === 'bpmn' ? 'bpmn' : null
}

function statements(source: string, kind: string): string[] | null {
  const text = source.trim()
  if (!/^@startuml\s*\n/.test(text) || !/\n@enduml$/.test(text)) return null
  const result: string[] = []
  for (const raw of text.split(/\r?\n/).slice(1, -1)) {
    const line = raw.trim()
    if (!line || line === `' tectona-view: ${kind}` || /^' tectona-dimension: [a-z0-9_]+$/.test(line)) continue
    if (/^(?:left to right|top to bottom) direction$/.test(line) || /^skinparam (?:shadowing (?:true|false)|roundcorner \d+)$/.test(line)) continue
    if (/^title [^\r\n]+$/.test(line)) continue
    if (kind === 'c4' && /^!include <C4\/C4_(?:Context|Container|Component)>$/.test(line)) continue
    if (kind === 'archimate' && line === '!include <archimate/Archimate>') continue
    result.push(line)
  }
  return result
}

function macro(line: string): { name: string; args: string[]; quoted: boolean[] } | null {
  const match = /^(\w+)\((.*)\)$/.exec(line)
  if (!match) return null
  const args: string[] = [], quoted: boolean[] = []
  let remaining = match[2].trim()
  while (remaining) {
    const token = /^("(?:[^"\\]|\\["\\n])*"|[A-Za-z_][\w.-]*)\s*(,|$)/.exec(remaining)
    if (!token) return null
    const isQuoted = token[1].startsWith('"')
    args.push(isQuoted ? JSON.parse(token[1]) as string : token[1])
    quoted.push(isQuoted)
    remaining = remaining.slice(token[0].length).trim()
    if (token[2] && !remaining) return null
  }
  return { name: match[1], args, quoted }
}

function c4Preview(source: string): CanvasGraph | null {
  const lines = statements(source, 'c4')
  if (!lines) return null
  const nodes = new Map<string, { title: string; kind: string; description: string[] }>()
  const relations: Array<{ source: string; target: string; label: string; macro: string; technology: string }> = []
  for (const line of lines) {
    const call = macro(line)
    if (!call) return null
    const { name, args, quoted } = call
    if (/^(?:Person(?:_Ext)?|System(?:_Ext|Db)?|Container(?:_Ext|Db)?|Component(?:_Ext|Db)?)$/.test(name)) {
      const container = /^(?:Container|Component)/.test(name)
      if (args.length < 2 || args.length > (container ? 4 : 3) || quoted[0] || quoted.slice(1).some(q => !q) || !args[1] || nodes.has(args[0])) return null
      const technology = container ? args[2] ?? '' : ''
      const description = args[container ? 3 : 2] ?? ''
      nodes.set(args[0], { title: args[1], kind: name, description: [technology ? `[${technology}]` : '', description].filter(Boolean) })
    } else if (/^(?:Rel(?:_[UDLR])?|BiRel)$/.test(name)) {
      if (args.length < 3 || args.length > 4 || quoted[0] || quoted[1] || quoted.slice(2).some(q => !q)) return null
      relations.push({ source: args[0], target: args[1], label: args[2], macro: name, technology: args[3] ?? '' })
    } else return null // Boundaries/extra macro arguments require separately verified support.
  }
  if (!nodes.size || relations.some(r => !nodes.has(r.source) || !nodes.has(r.target))) return null
  const graph = buildReadOnlyDiagramCanvasGraph(source, 'c4')
  if (graph.nodes.length !== nodes.size || graph.edges.length !== relations.length) return null
  if (graph.nodes.some(n => { const original = nodes.get(n.id); return n.data.kind !== 'element' || !original || n.data.title !== original.title || n.data.notationId !== original.kind || JSON.stringify(n.data.description) !== JSON.stringify(original.description) })) return null
  if (graph.edges.some((e, i) => { const r = relations[i]; return e.source !== r.source || e.target !== r.target || e.label !== (r.technology ? `${r.label} [${r.technology}]` : r.label) || e.data?.c4Relation?.macro !== r.macro })) return null
  return graph
}

function useCasePreview(source: string): CanvasGraph | null {
  const lines = statements(source, 'use-case')
  if (!lines) return null
  const nodes = new Map<string, { title: string; kind: string; boundary?: string }>()
  const relations: Array<{ source: string; target: string; label: string; relation: string }> = []
  let boundary: string | undefined
  for (const line of lines) {
    if (line === '}') { if (!boundary) return null; boundary = undefined; continue }
    const node = /^(actor|usecase|rectangle) "([^"\\]+)" as ([\w-]+)(\s*\{)?$/.exec(line)
    if (node) {
      if (nodes.has(node[3]) || !node[2].trim() || (node[1] === 'rectangle' && boundary) || (node[4] && node[1] !== 'rectangle') || (boundary && node[1] === 'actor')) return null
      nodes.set(node[3], { title: node[2], kind: node[1] === 'rectangle' ? 'system-boundary' : node[1], boundary: node[1] === 'usecase' ? boundary : undefined })
      if (node[4]) boundary = node[3]
      continue
    }
    const edge = /^([\w-]+)\s*(--\|>|--|\.\.>)\s*([\w-]+)(?:\s*:\s*(.*))?$/.exec(line)
    if (!edge) return null
    const label = edge[4] ?? ''
    const relation = edge[2] === '--|>' ? 'generalization' : edge[2] === '..>' && /^<<(?:include|extend)>>$/.test(label) ? label.slice(2, -2) : edge[2] === '--' ? 'association' : ''
    if (!relation) return null
    relations.push({ source: edge[1], target: edge[3], label, relation })
  }
  if (boundary || !nodes.size || relations.some(r => !nodes.has(r.source) || !nodes.has(r.target))) return null
  const graph = buildReadOnlyDiagramCanvasGraph(source, 'use-case')
  if (graph.nodes.length !== nodes.size || graph.edges.length !== relations.length) return null
  if (graph.nodes.some(n => { const expected = nodes.get(n.id); return n.data.kind !== 'element' || !expected || n.data.title !== expected.title || n.data.notationId !== expected.kind || JSON.stringify(n.data.description) !== JSON.stringify(expected.boundary ? [`boundary:${expected.boundary}`] : []) })) return null
  if (graph.edges.some((e, i) => { const r = relations[i]; return e.source !== r.source || e.target !== r.target || (e.label ?? '') !== r.label || e.data?.useCaseRelation !== r.relation })) return null
  return graph
}

function archimatePreview(source: string): CanvasGraph | null {
  const lines = statements(source, 'archimate')
  if (!lines) return null
  const nodes = new Map<string, string>()
  for (const line of lines) {
    const call = macro(line)
    if (!call || call.name !== 'Application_Component' || call.args.length !== 2 || call.quoted[0] || !call.quoted[1] || !call.args[1] || /["\\\r\n]/.test(call.args[1]) || nodes.has(call.args[0])) return null
    nodes.set(call.args[0], call.args[1])
  }
  if (!nodes.size) return null
  // Adapt the explicit macro to the existing canonical parser's equivalent node
  // statement. Never add relationships, domain defaults or a combined topic graph.
  const adapted = ['@startuml', ...[...nodes].map(([id, title]) => `component "${title}" as ${id} <<Application Component>>`), '@enduml'].join('\n')
  const graph = parsePlantUmlToIntegrationGraph(adapted)
  const rootPlacementNotice = `${nodes.size} node(s) outside any package will be placed on the canvas root.`
  if (graph.warnings.some(warning => warning !== rootPlacementNotice) || graph.nodes.length !== nodes.size || graph.edges.length) return null
  if (graph.nodes.some(n => n.data.kind !== 'element' || nodes.get(n.id) !== n.data.title || n.data.layer !== 'application' || n.data.stereotype !== 'Application Component')) return null
  return { nodes: graph.nodes, edges: graph.edges }
}

/** A source-only, read-only adapter. Never reads editor state or invokes a model. */
export function buildVerifiedNativePreview(source: string, kind: NativePreviewKind): CanvasGraph | null {
  try {
    const graph = kind === 'bpmn'
      ? canPreviewBpmnLosslessly(source) ? buildReadOnlyDiagramCanvasGraph(toBpmnEditorSource(source), 'bpmn') : null
      : kind === 'class' || kind === 'erd'
        ? canPreviewUmlLosslessly(source, kind) ? buildReadOnlyDiagramCanvasGraph(source, kind) : null
        : kind === 'c4' ? c4Preview(source) : kind === 'use-case' ? useCasePreview(source) : archimatePreview(source)
    if (!graph) return null
    // Per-element ReactFlow flags override its preview-level defaults. In particular
    // the canonical ArchiMate parser marks its nodes draggable for editor usage.
    return {
      nodes: graph.nodes.map(node => ({ ...node, draggable: false, selectable: false, connectable: false, deletable: false, focusable: false })),
      // ReactFlow edge SVGs default to layer 0, underneath opaque BPMN lanes.
      // Keep connections between canonical lane backgrounds (0) and nodes (2).
      edges: graph.edges.map(edge => ({ ...edge, ...(kind === 'bpmn' ? { zIndex: 1 } : {}), selectable: false, deletable: false, focusable: false, updatable: false })),
    }
  } catch { return null }
}
