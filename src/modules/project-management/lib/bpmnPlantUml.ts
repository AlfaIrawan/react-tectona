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

function decodeMermaidLabel(raw: string): string {
  return (raw || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\\n/g, '\n')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

function parseMermaidFlowToBpmn(source: string): BpmnParsedGraph {
  const nodes: BpmnParsedNode[] = []
  const aliases = new Set<string>()
  const add = (id: string, label: string, kind: BpmnParsedKind, bpmnType: string) => {
    if (aliases.has(id)) return
    aliases.add(id)
    nodes.push({ id, label: decodeMermaidLabel(label), kind, bpmnType })
  }

  const declaration =
    /\b([A-Za-z][\w-]*)\s*(?:\[\s*(?:"([^"]*)"|([^\]]+))\s*\]|\{\s*(?:"([^"]*)"|([^}]+))\s*\}|\(\(\s*(?:"([^"]*)"|([^)]+))\s*\)\)|\(\[\s*(?:"([^"]*)"|([^)\]]+))\s*\]\)|\(\s*(?:"([^"]*)"|([^)]+))\s*\))/g
  let match: RegExpExecArray | null
  while ((match = declaration.exec(source))) {
    const id = match[1]
    const box = match[2] || match[3]
    const diamond = match[4] || match[5]
    const circle = match[6] || match[7]
    const stadium = match[8] || match[9]
    const round = match[10] || match[11]
    const label = (box || diamond || circle || stadium || round || id).trim()
    if (diamond) {
      add(id, label, 'decision', 'exclusiveGateway')
      continue
    }
    if (circle || stadium || round) {
      const kind: BpmnParsedKind = /end|selesai|stop|finish/i.test(label) ? 'end' : 'start'
      add(id, label, kind, bpmnTypeFromKind(kind))
      continue
    }
    add(id, label, 'activity', 'task')
  }

  const edges: BpmnParsedGraph['edges'] = []
  const relation = /\b([A-Za-z][\w-]*)\s*-->(?:\|([^|]*)\|)?\s*([A-Za-z][\w-]*)/g
  while ((match = relation.exec(source))) {
    if (aliases.has(match[1]) && aliases.has(match[3])) {
      edges.push({
        id: `edge-${match[1]}-${match[3]}-${edges.length}`,
        source: match[1],
        target: match[3],
        label: match[2]?.trim() || undefined,
      })
    }
  }
  if (!edges.length && nodes.length > 1) {
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

  return { nodes, edges }
}

function isBoundaryNode(node: BpmnParsedNode, boundary: 'start' | 'end'): boolean {
  if (boundary === 'start') {
    return node.kind === 'start' || node.bpmnType === 'startEvent' || /^(start|mulai)$/i.test(node.label.trim())
  }
  return node.kind === 'end' || node.bpmnType === 'endEvent' || /^(end|selesai|stop|finish)$/i.test(node.label.trim())
}

function graphDegree(graph: BpmnParsedGraph, id: string): { incoming: number; outgoing: number } {
  return graph.edges.reduce(
    (degree, edge) => ({
      incoming: degree.incoming + (edge.target === id ? 1 : 0),
      outgoing: degree.outgoing + (edge.source === id ? 1 : 0),
    }),
    { incoming: 0, outgoing: 0 },
  )
}

function uniqueEdges(edges: BpmnParsedGraph['edges']): BpmnParsedGraph['edges'] {
  const seen = new Set<string>()
  return edges.flatMap((edge, index) => {
    const key = `${edge.source}\u0000${edge.target}\u0000${edge.label ?? ''}`
    if (seen.has(key)) return []
    seen.add(key)
    return [{ ...edge, id: edge.id || `edge-${index}` }]
  })
}

/**
 * Keeps generated BPMN readable when a source accidentally places the boundary
 * events after the activities. Only invalid boundary connections are repaired;
 * valid process branches remain untouched.
 */
export function normalizeBpmnGraph(graph: BpmnParsedGraph): BpmnParsedGraph {
  const start = graph.nodes.find((node) => /^(start|mulai)$/i.test(node.label.trim()))
    ?? graph.nodes.find((node) => isBoundaryNode(node, 'start'))
  const end = graph.nodes.find((node) => /^(end|selesai|stop|finish)$/i.test(node.label.trim()))
    ?? graph.nodes.find((node) => isBoundaryNode(node, 'end'))

  const malformedStart = start && graphDegree(graph, start.id).incoming > 0 ? start : undefined
  const malformedEnd = end && graphDegree(graph, end.id).outgoing > 0 ? end : undefined
  let edges = uniqueEdges(graph.edges)

  if (malformedStart || malformedEnd) {
    const repairedIds = new Set([malformedStart?.id, malformedEnd?.id].filter(Boolean))
    edges = edges.filter((edge) => !repairedIds.has(edge.source) && !repairedIds.has(edge.target))

    const internalNodes = graph.nodes.filter((node) => node.id !== start?.id && node.id !== end?.id)
    if (malformedStart) {
      const roots = internalNodes.filter((node) => !edges.some((edge) => edge.target === node.id))
      for (const root of roots) edges.push({ id: `edge-${malformedStart.id}-${root.id}`, source: malformedStart.id, target: root.id })
    }
    if (end) {
      const leaves = internalNodes.filter((node) => !edges.some((edge) => edge.source === node.id))
      for (const leaf of leaves) edges.push({ id: `edge-${leaf.id}-${end.id}`, source: leaf.id, target: end.id })
    }
    edges = uniqueEdges(edges)
  }

  const normalizedNodes = graph.nodes.map((node) => {
    if (start?.id === node.id) return { ...node, kind: 'start' as const, bpmnType: 'startEvent' }
    if (end?.id === node.id) return { ...node, kind: 'end' as const, bpmnType: 'endEvent' }
    return { ...node }
  })
  const orderedNodes = [
    ...(start ? normalizedNodes.filter((node) => node.id === start.id) : []),
    ...normalizedNodes.filter((node) => node.id !== start?.id && node.id !== end?.id),
    ...(end ? normalizedNodes.filter((node) => node.id === end.id) : []),
  ]
  return { nodes: orderedNodes, edges }
}

export function parseBpmnSource(source: string): BpmnParsedGraph {
  if (isBpmnXml(source)) return normalizeBpmnGraph(parseBpmnXml(source))
  if (/^\s*(?:flowchart|graph)\s+(?:TD|LR|TB|RL)\b/im.test(source)) return normalizeBpmnGraph(parseMermaidFlowToBpmn(source))
  return normalizeBpmnGraph(parseBpmnPlantUml(source))
}

export function bpmnGraphToPlantUml(graph: BpmnParsedGraph): string {
  const normalized = normalizeBpmnGraph(graph)
  const lines = [
    '@startuml',
    'skinparam shadowing false',
    'skinparam defaultFontName Arial',
    'skinparam roundcorner 8',
    'top to bottom direction',
  ]
  for (const node of normalized.nodes) {
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
  for (const edge of normalized.edges) {
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
      'top to bottom direction',
      '@enduml',
    ].join('\n')
  }
  if (isBpmnXml(text) || /^\s*@startuml\b/im.test(text) || /^\s*(?:flowchart|graph)\s+/im.test(text)) {
    return bpmnGraphToPlantUml(parseBpmnSource(text))
  }
  return text
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
