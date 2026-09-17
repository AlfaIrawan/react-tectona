import type { Edge, Node } from 'reactflow'
import type { ArchimateNodeData } from '@/modules/project-management/lib/integrationArchitectureTypes'

export type BpmnParsedKind = 'activity' | 'decision' | 'start' | 'end'
export type BpmnParsedNode = { id: string; label: string; kind: BpmnParsedKind; bpmnType: string }
export type BpmnParsedGraph = {
  nodes: BpmnParsedNode[]
  edges: Array<{ id: string; source: string; target: string; label?: string }>
}

export function isBpmnXml(source: string): boolean {
  const text = source.trim()
  return (
    text.startsWith('<?xml') ||
    /<(?:[\w.-]+:)?definitions\b/i.test(text) ||
    /<(?:[\w.-]+:)?(?:startEvent|process|task|userTask)\b/i.test(text)
  )
}

export function quotePlantUml(value: string): string {
  return (value || '').replace(/\\/g, '\\\\').replace(/"/g, "'").replace(/\n/g, '\\n')
}

export function aliasPlantUml(id: string): string {
  const alias = id.replace(/[^A-Za-z0-9_]/g, '_')
  return /^[A-Za-z_]/.test(alias) ? alias : `n_${alias}`
}

function bpmnTypeFromKind(kind: BpmnParsedKind, shape?: string): string {
  if (kind === 'start') return 'startEvent'
  if (kind === 'end') return 'endEvent'
  if (kind === 'decision') return 'exclusiveGateway'
  if (shape === 'usecase') return 'userTask'
  return 'task'
}

export function parseBpmnXml(source: string): BpmnParsedGraph {
  const nodes: BpmnParsedNode[] = []
  const ids = new Set<string>()
  const element = /<(?:[\w.-]+:)?(startEvent|endEvent|task|userTask|serviceTask|scriptTask|exclusiveGateway|parallelGateway|inclusiveGateway)\b([^>]*)/g
  let match: RegExpExecArray | null
  while ((match = element.exec(source))) {
    const id = /\bid="([^"]+)"/.exec(match[2])?.[1]
    if (!id) continue
    const label = /\bname="([^"]+)"/.exec(match[2])?.[1] || match[1]
    ids.add(id)
    const bpmnType = match[1]
    const kind: BpmnParsedKind = bpmnType.includes('Gateway')
      ? 'decision'
      : bpmnType === 'startEvent'
        ? 'start'
        : bpmnType === 'endEvent'
          ? 'end'
          : 'activity'
    nodes.push({ id, label, kind, bpmnType })
  }
  const edges: BpmnParsedGraph['edges'] = []
  const flow = /<(?:[\w.-]+:)?sequenceFlow\b([^>]*)/g
  while ((match = flow.exec(source))) {
    const sourceId = /\bsourceRef="([^"]+)"/.exec(match[1])?.[1]
    const targetId = /\btargetRef="([^"]+)"/.exec(match[1])?.[1]
    const label = /\bname="([^"]+)"/.exec(match[1])?.[1]
    if (sourceId && targetId && ids.has(sourceId) && ids.has(targetId)) {
      edges.push({ id: `edge-${edges.length}`, source: sourceId, target: targetId, label })
    }
  }
  if (!edges.length) {
    nodes.slice(1).forEach((current, index) => {
      edges.push({ id: `edge-${index}`, source: nodes[index].id, target: current.id })
    })
  }
  return { nodes, edges }
}

export function parseBpmnPlantUml(source: string): BpmnParsedGraph {
  const nodes: BpmnParsedNode[] = []
  const aliases = new Set<string>()
  const add = (id: string, label: string, kind: BpmnParsedKind, bpmnType: string) => {
    if (aliases.has(id)) return
    aliases.add(id)
    nodes.push({ id, label, kind, bpmnType })
  }

  const circle = /^\s*(?:\(\)|circle)\s+"([^"]+)"\s+as\s+([\w.-]+)/gim
  let match: RegExpExecArray | null
  while ((match = circle.exec(source))) {
    const label = match[1]
    const kind: BpmnParsedKind = /end|selesai|stop|finish/i.test(label) ? 'end' : 'start'
    add(match[2], label, kind, bpmnTypeFromKind(kind))
  }

  const startAlias = /^\s*\(\*\)\s+as\s+([\w.-]+)/gim
  while ((match = startAlias.exec(source))) {
    const kind: BpmnParsedKind = match[1].toLowerCase().includes('end') ? 'end' : 'start'
    add(match[1], kind === 'end' ? 'End' : 'Start', kind, bpmnTypeFromKind(kind))
  }

  const declaration = /^\s*(rectangle|component|hexagon|usecase|interface|card|note)\s+"([^"]+)"\s+as\s+([\w.-]+)/gim
  while ((match = declaration.exec(source))) {
    const shape = match[1].toLowerCase()
    const kind: BpmnParsedKind = shape === 'hexagon' ? 'decision' : 'activity'
    const bpmnType = shape === 'note' || shape === 'card' ? 'textAnnotation' : bpmnTypeFromKind(kind, shape)
    add(match[3], match[2], kind, bpmnType)
  }

  const activities = Array.from(source.matchAll(/^\s*:\s*([^;\n]+);/gm), (item) => item[1].trim())
  for (const label of activities) {
    add(`activity_${nodes.length + 1}`, label, 'activity', 'task')
  }

  if (/^\s*start\b/im.test(source) && !nodes.some((node) => node.kind === 'start')) {
    add('process_start', 'Start', 'start', 'startEvent')
  }
  if (/^\s*(?:stop|end)\b/im.test(source) && !nodes.some((node) => node.kind === 'end')) {
    add('process_end', 'End', 'end', 'endEvent')
  }

  const edges: BpmnParsedGraph['edges'] = []
  const relation = /^\s*([\w.-]+)\s*--?>\s*([\w.-]+)(?:\s*:\s*(.+))?/gm
  while ((match = relation.exec(source))) {
    if (aliases.has(match[1]) && aliases.has(match[2])) {
      edges.push({
        id: `edge-${match[1]}-${match[2]}-${edges.length}`,
        source: match[1],
        target: match[2],
        label: match[3]?.trim(),
      })
    }
  }
  if (!edges.length && nodes.length > 1) {
    nodes.slice(1).forEach((current, index) => {
      edges.push({ id: `edge-${index}`, source: nodes[index].id, target: current.id })
    })
  }

  const incoming = new Map(nodes.map((node) => [node.id, 0]))
  const outgoing = new Map(nodes.map((node) => [node.id, 0]))
  for (const edge of edges) {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1)
    outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1)
  }
  for (const node of nodes) {
    if (node.kind !== 'start' && node.kind !== 'end') continue
    if ((outgoing.get(node.id) ?? 0) === 0 && (incoming.get(node.id) ?? 0) > 0) {
      node.kind = 'end'
      node.bpmnType = 'endEvent'
    } else if ((incoming.get(node.id) ?? 0) === 0 && (outgoing.get(node.id) ?? 0) > 0) {
      node.kind = 'start'
      node.bpmnType = 'startEvent'
    }
  }

  return { nodes, edges }
}

export function parseBpmnSource(source: string): BpmnParsedGraph {
  return isBpmnXml(source) ? parseBpmnXml(source) : parseBpmnPlantUml(source)
}

export function bpmnGraphToPlantUml(graph: BpmnParsedGraph): string {
  const lines = [
    '@startuml',
    'skinparam shadowing false',
    'skinparam defaultFontName Arial',
    'skinparam roundcorner 8',
    'left to right direction',
  ]
  for (const node of graph.nodes) {
    const id = aliasPlantUml(node.id)
    const title = quotePlantUml(node.label)
    if (node.kind === 'start' || node.kind === 'end' || node.bpmnType === 'startEvent' || node.bpmnType === 'endEvent') {
      lines.push(`() "${title}" as ${id}`)
    } else if (node.kind === 'decision' || node.bpmnType.toLowerCase().includes('gateway')) {
      lines.push(`hexagon "${title}" as ${id}`)
    } else if (node.bpmnType === 'userTask') {
      lines.push(`usecase "${title}" as ${id}`)
    } else if (node.bpmnType === 'textAnnotation') {
      lines.push(`note "${title}" as ${id}`)
    } else {
      lines.push(`rectangle "${title}" as ${id}`)
    }
  }
  for (const edge of graph.edges) {
    const label = edge.label?.trim() ? ` : ${quotePlantUml(edge.label.trim())}` : ''
    lines.push(`${aliasPlantUml(edge.source)} --> ${aliasPlantUml(edge.target)}${label}`)
  }
  lines.push('@enduml')
  return lines.join('\n')
}

export function bpmnXmlToPlantUml(source: string): string {
  return bpmnGraphToPlantUml(parseBpmnXml(source))
}

export function toBpmnEditorSource(source: string): string {
  const text = source.trim()
  if (!text) {
    return [
      '@startuml',
      'skinparam shadowing false',
      'left to right direction',
      '@enduml',
    ].join('\n')
  }
  return isBpmnXml(text) ? bpmnXmlToPlantUml(text) : text
}

function nodeTitle(node: Node<ArchimateNodeData>): string {
  return node.data.kind === 'element' || node.data.kind === 'boundary' || node.data.kind === 'note'
    ? node.data.title
    : node.id
}

export function serializeBpmnCanvasToPlantUml(nodes: Node<ArchimateNodeData>[], edges: Edge[]): string {
  const elements = nodes.filter((node) => node.type === 'bpmnElement' && node.data.kind === 'element')
  return bpmnGraphToPlantUml({
    nodes: elements.map((node) => {
      const bpmnType = node.data.notationId || 'task'
      const kind: BpmnParsedKind = bpmnType.includes('Gateway')
        ? 'decision'
        : bpmnType === 'startEvent'
          ? 'start'
          : bpmnType === 'endEvent'
            ? 'end'
            : 'activity'
      return { id: node.id, label: nodeTitle(node), kind, bpmnType }
    }),
    edges: edges.map((edge, index) => ({
      id: edge.id || `edge-${index}`,
      source: edge.source,
      target: edge.target,
      label: typeof edge.label === 'string' ? edge.label : undefined,
    })),
  })
}
