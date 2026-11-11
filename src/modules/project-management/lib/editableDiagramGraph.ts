import { parseUseCaseDiagram } from './useCasePlantUml'
import { type Node, type Edge, MarkerType } from 'reactflow'
import { type ArchimateNodeData, type ArchimateElementNodeData } from './integrationArchitectureTypes'
import { hasManualConnectionHandles } from './diagramConnections'
import { type NodeGeometry, pickCenteredAnchoredHandles } from './parsePlantUmlToIntegrationGraph'
import { type UmlView, type UmlDiagram, parseUmlDiagram, umlLinkToCanvasData } from './classErdPlantUml'
import { erdEntityDefaultSize } from './erdEntityLayout'
import { parseC4Graph, type C4ParsedGraph, c4Stereotype, type C4ElementKind, isC4External } from './c4PlantUml'
import { parseBpmnSource } from './bpmnPlantUml'
import { bpmnNodeSizeForType, bpmnDefaultLineColor } from './bpmnNotationSpec'
import { defaultIntegrationNodeTextStyle, defaultIntegrationNodeVisual } from './integrationNodeAppearance'

export type DiagramFormat = 'plantuml' | 'bpmn' | 'c4' | 'class' | 'erd' | 'use-case'

type ParsedKind = 'activity' | 'decision' | 'start' | 'end'

type ParsedNode = { id: string; label: string; kind: ParsedKind; bpmnType?: string; lane?: string }

type ParsedGraph = { nodes: ParsedNode[]; edges: Array<{ id: string; source: string; target: string; label?: string; bpmnFlowType?: string }> }

const NODE_WIDTH = 210

const NODE_HEIGHT = 78

function bpmnStereotype(type: string): string {
  if (type === 'startEvent') return 'Start Event'
  if (type === 'endEvent') return 'End Event'
  if (type === 'userTask') return 'User Task'
  if (type === 'serviceTask') return 'Service Task'
  if (type === 'scriptTask') return 'Script Task'
  if (type === 'exclusiveGateway') return 'Exclusive Gateway'
  if (type === 'parallelGateway') return 'Parallel Gateway'
  if (type === 'inclusiveGateway') return 'Inclusive Gateway'
  if (type === 'textAnnotation') return 'Text Annotation'
  return 'Task'
}

function bpmnNodeSize(type: string): { width: number; height: number } {
  return bpmnNodeSizeForType(type)
}

export function c4RelationEdgeStyle(macro?: string): Pick<Edge, 'style' | 'markerEnd' | 'markerStart' | 'data'> {
  return {
    markerStart: macro === 'BiRel' ? { type: MarkerType.ArrowClosed, color: '#64748b', width: 9, height: 9 } : undefined,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b', width: 9, height: 9 },
    style: { stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '4 4' },
    data: {
      visual: {
        lineEnabled: true,
        lineColor: '#64748b',
        lineWidth: 1.5,
        lineStyle: 'dashed',
        startArrow: macro === 'BiRel' ? 'classic' : 'none',
        endArrow: 'classic',
        startFill: false,
        endFill: true,
        startSize: 6,
        endSize: 6,
        waypoints: 'rounded',
      },
    },
  }
}

const BPMN_LANE_BAND = 36

const BPMN_LANE_HEIGHT = 188

const BPMN_COLUMN_PITCH = 248

const BPMN_LANE_PAD_TOP = 32

const BPMN_LANE_PAD_BOTTOM = 56

const BPMN_STACK_GAP = 20

export const BPMN_LAYOUT_MARK = 'swimlane-layout-2'

function layoutBpmnPositions(nodes: ParsedNode[], edges: ParsedGraph['edges']): Map<string, { x: number; y: number }> {
  const lanes = swimlaneOrder(nodes)
  if (lanes.length >= 2) return layoutBpmnSwimlanes(nodes, edges, lanes)
  const outgoing = new Map<string, string[]>()
  const indegree = new Map(nodes.map((node) => [node.id, 0]))
  for (const edge of edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target])
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1)
  }
  const level = new Map<string, number>()
  const queue = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id)
  if (!queue.length && nodes[0]) queue.push(nodes[0].id)
  const seen = new Set<string>()
  while (queue.length) {
    const id = queue.shift()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const current = level.get(id) ?? 0
    for (const target of outgoing.get(id) ?? []) {
      level.set(target, Math.max(level.get(target) ?? 0, current + 1))
      queue.push(target)
    }
    if (!level.has(id)) level.set(id, current)
  }
  const buckets = new Map<number, string[]>()
  for (const node of nodes) {
    const depth = level.get(node.id) ?? 0
    buckets.set(depth, [...(buckets.get(depth) ?? []), node.id])
  }
  const positions = new Map<string, { x: number; y: number }>()
  const levelPitch = 148
  const branchGap = 36
  const centerX = 480
  for (const [depth, ids] of buckets) {
    const totalWidth = ids.reduce((width, id) => width + bpmnNodeSize(nodes.find((node) => node.id === id)?.bpmnType ?? 'task').width, 0)
      + Math.max(0, ids.length - 1) * branchGap
    let nextX = centerX - totalWidth / 2
    ids.forEach((id) => {
      const size = bpmnNodeSize(nodes.find((node) => node.id === id)?.bpmnType ?? 'task')
      positions.set(id, {
        x: nextX,
        y: 48 + depth * levelPitch,
      })
      nextX += size.width + branchGap
    })
  }
  return positions
}

function swimlaneOrder(nodes: ParsedNode[]): string[] {
  const order: string[] = []
  for (const node of nodes) {
    if (node.lane && !order.includes(node.lane)) order.push(node.lane)
  }
  return order
}

function bpmnColumnRank(nodes: ParsedNode[], edges: ParsedGraph['edges']): Map<string, number> {
  const outgoing = new Map<string, string[]>()
  const indegree = new Map(nodes.map((node) => [node.id, 0]))
  for (const edge of edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target])
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1)
  }
  const rank = new Map<string, number>()
  const queue = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id)
  if (!queue.length && nodes[0]) queue.push(nodes[0].id)
  const seen = new Set<string>()
  while (queue.length) {
    const id = queue.shift()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const current = rank.get(id) ?? 0
    for (const target of outgoing.get(id) ?? []) {
      rank.set(target, Math.max(rank.get(target) ?? 0, current + 1))
      queue.push(target)
    }
    if (!rank.has(id)) rank.set(id, current)
  }
  return rank
}

function swimlaneFrames(nodes: ParsedNode[], edges: ParsedGraph['edges'], lanes: string[]) {
  const rank = bpmnColumnRank(nodes, edges)
  const slot = new Map<string, number>()
  const used = new Map<string, number>()
  for (const node of nodes) {
    const key = `${node.lane ?? lanes[0]}:${rank.get(node.id) ?? 0}`
    slot.set(node.id, used.get(key) ?? 0)
    used.set(key, (used.get(key) ?? 0) + 1)
  }
  const heights = lanes.map((lane) => {
    const members = nodes.filter((node) => (node.lane ?? lanes[0]) === lane)
    const rows = Math.max(1, ...members.map((node) => (slot.get(node.id) ?? 0) + 1))
    const tallest = Math.max(BPMN_LANE_HEIGHT - BPMN_LANE_PAD_TOP - BPMN_LANE_PAD_BOTTOM, ...members.map((node) => bpmnNodeSize(node.bpmnType ?? 'task').height))
    return Math.max(BPMN_LANE_HEIGHT, BPMN_LANE_PAD_TOP + rows * tallest + Math.max(0, rows - 1) * BPMN_STACK_GAP + BPMN_LANE_PAD_BOTTOM)
  })
  const tops: number[] = []
  let cursor = 0
  for (const height of heights) {
    tops.push(cursor)
    cursor += height
  }
  return { rank, slot, heights, tops }
}

function layoutBpmnSwimlanes(
  nodes: ParsedNode[],
  edges: ParsedGraph['edges'],
  lanes: string[],
): Map<string, { x: number; y: number }> {
  const { rank, slot, tops } = swimlaneFrames(nodes, edges, lanes)
  const positions = new Map<string, { x: number; y: number }>()
  for (const node of nodes) {
    const size = bpmnNodeSize(node.bpmnType ?? 'task')
    const column = rank.get(node.id) ?? 0
    const laneIndex = Math.max(0, lanes.indexOf(node.lane ?? lanes[0]))
    const stack = slot.get(node.id) ?? 0
    positions.set(node.id, {
      x: BPMN_LANE_BAND + 16 + column * BPMN_COLUMN_PITCH + (BPMN_COLUMN_PITCH - size.width) / 2,
      y: (tops[laneIndex] ?? 0) + BPMN_LANE_PAD_TOP + stack * (size.height + BPMN_STACK_GAP),
    })
  }
  return positions
}

function bpmnSwimlaneNodes(nodes: ParsedNode[], edges: ParsedGraph['edges']): Node<ArchimateNodeData>[] {
  const lanes = swimlaneOrder(nodes)
  if (lanes.length < 2) return []
  const { rank, heights, tops } = swimlaneFrames(nodes, edges, lanes)
  const columns = Math.max(1, ...nodes.map((node) => (rank.get(node.id) ?? 0) + 1))
  const width = BPMN_LANE_BAND + 16 + columns * BPMN_COLUMN_PITCH
  return lanes.map((lane, index) => ({
    id: `bpmn-lane-${index}`,
    type: 'bpmnElement',
    position: { x: 0, y: tops[index] ?? 0 },
    zIndex: 0,
    draggable: false,
    selectable: false,
    connectable: false,
    focusable: false,
    style: { width, height: heights[index] ?? BPMN_LANE_HEIGHT, zIndex: 0 },
    data: {
      kind: 'element',
      layer: 'business',
      stereotype: 'Lane',
      title: lane,
      description: [BPMN_LAYOUT_MARK],
      notationId: 'lane',
      visual: {
        fillEnabled: true,
        fillColor: index % 2 === 0 ? '#f8fafc' : '#ffffff',
        lineEnabled: true,
        lineColor: '#0284c7',
        lineWidth: 2,
        lineStyle: 'solid',
        rounded: false,
      },
    },
  }))
}

function toBpmnNode(item: ParsedNode, position: { x: number; y: number }): Node<ArchimateNodeData> {
  const bpmnType = item.bpmnType ?? 'task'
  const size = bpmnNodeSize(bpmnType)
  return {
    id: item.id,
    type: 'bpmnElement',
    position,
    zIndex: 2,
    style: { width: size.width, height: size.height, zIndex: 2 },
    data: {
      kind: 'element',
      layer: 'business',
      stereotype: bpmnStereotype(bpmnType),
      title: item.label || bpmnStereotype(bpmnType),
      description: [],
      notationId: bpmnType,
      bpmnLane: item.lane ?? null,
      visual: {
        fillEnabled: true,
        fillColor: '#ffffff',
        lineEnabled: true,
        lineColor: bpmnDefaultLineColor(bpmnType),
        lineWidth: 2,
        lineStyle: 'solid',
        rounded: true,
      },
      textStyle: {
        ...defaultIntegrationNodeTextStyle(),
        wordWrap: true,
      },
    },
  }
}

function processKindToElement(kind: ParsedKind): Pick<ArchimateElementNodeData, 'layer' | 'stereotype' | 'notationId'> {
  if (kind === 'start' || kind === 'end') {
    return { layer: 'business', stereotype: 'Business Event', notationId: 'business-layer-event' }
  }
  if (kind === 'decision') {
    return { layer: 'business', stereotype: 'Business Function', notationId: 'business-layer-function' }
  }
  return { layer: 'business', stereotype: 'Business Process', notationId: 'business-layer-business-process' }
}

function toArchimateNode(item: ParsedNode, index: number): Node<ArchimateNodeData> {
  const meta = processKindToElement(item.kind)
  return {
    id: item.id,
    type: 'archimateElement',
    position: { x: (index % 3) * 260, y: Math.floor(index / 3) * 130 },
    style: { width: NODE_WIDTH, height: NODE_HEIGHT },
    data: {
      kind: 'element',
      layer: meta.layer,
      stereotype: meta.stereotype,
      title: item.label || meta.stereotype,
      description: [],
      notationId: meta.notationId,
      visual: defaultIntegrationNodeVisual(meta.layer),
    },
  }
}

function toArchimateEdges(parsed: ParsedGraph): Edge[] {
  return parsed.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, color: '#334155', width: 10, height: 10 },
    style: { stroke: '#334155', strokeWidth: 1.5 },
  }))
}

function c4Visual(kind: C4ElementKind) {
  const external = isC4External(kind)
  const fillColor = kind.includes('Person')
    ? (external ? '#6C6C6C' : '#08427B')
    : kind === 'Component'
      ? '#85BBF0'
      : kind.startsWith('System')
        ? (external ? '#999999' : '#1168BD')
        : (external ? '#999999' : '#438DD5')
  return {
    fillEnabled: true,
    fillColor,
    lineEnabled: true,
    lineColor: external ? '#8A8A8A' : '#3C7FC0',
    lineWidth: 1.5,
    lineStyle: 'solid' as const,
    rounded: true,
    shadow: true,
  }
}

function toC4ElementNode(
  element: C4ParsedGraph['elements'][number],
  position: { x: number; y: number },
): Node<ArchimateNodeData> {
  const description = [
    element.technology ? `[${element.technology}]` : '',
    element.description,
  ].filter(Boolean)
  return {
    id: element.id,
    type: 'c4Element',
    position,
    parentNode: element.parentId,
    extent: element.parentId ? 'parent' : undefined,
    style: { width: 240, height: element.kind.includes('Person') ? 128 : 120 },
    data: {
      kind: 'element',
      layer: 'application',
      stereotype: c4Stereotype(element.kind),
      title: element.title,
      description,
      notationId: element.kind,
      visual: c4Visual(element.kind),
    },
  }
}

function graphFromC4(source: string): { nodes: Node<ArchimateNodeData>[]; edges: Edge[] } {
  const parsed = parseC4Graph(source)
  const nodes: Node<ArchimateNodeData>[] = []
  const sizes = new Map<string, { width: number; height: number }>()
  const measure = (id: string): { width: number; height: number } => {
    const existing = sizes.get(id)
    if (existing) return existing
    const nested = parsed.boundaries.filter(item => item.parentId === id).map(item => measure(item.id))
    const size = { width: Math.max(300, ...nested.map(item => item.width + 56)), height: Math.max(220, 56 + parsed.elements.filter(item => item.parentId === id).length * 148 + nested.reduce((sum, item) => sum + item.height + 32, 0)) }
    sizes.set(id, size)
    return size
  }
  const appendBoundary = (parent: C4ParsedGraph['boundaries'][number], position: { x: number; y: number }) => {
    nodes.push({ id: parent.id, type: 'archimateBoundary', position, parentNode: parent.parentId,
      extent: parent.parentId ? 'parent' : undefined, style: measure(parent.id), zIndex: 0,
      data: { kind: 'boundary', title: parent.title, visual: { fillEnabled: false, lineEnabled: true, lineColor: '#64748b', lineStyle: 'dashed', rounded: true } } })
    const children = parsed.elements.filter(item => item.parentId === parent.id)
    children.forEach((item, index) => nodes.push({ ...toC4ElementNode(item, { x: 28, y: 40 + index * 148 }), zIndex: 1 }))
    let y = 40 + children.length * 148
    parsed.boundaries.filter(item => item.parentId === parent.id).forEach(item => { appendBoundary(item, { x: 28, y }); y += measure(item.id).height + 32 })
  }
  let boundaryX = 280
  parsed.boundaries.filter(item => !item.parentId).forEach(parent => { appendBoundary(parent, { x: boundaryX, y: 32 }); boundaryX += measure(parent.id).width + 64 })
  parsed.elements.filter(item => !item.parentId).forEach((item, index) => {
    nodes.push(toC4ElementNode(item, { x: item.kind.startsWith('Person') ? 24 : boundaryX, y: 72 + index * 150 }))
  })

  const edges: Edge[] = withFacingHandles(
    nodes,
    parsed.relations
      .filter((relation) => nodes.some((node) => node.id === relation.source) && nodes.some((node) => node.id === relation.target))
      .map((relation) => ({
        id: relation.id,
        source: relation.source,
        target: relation.target,
        label: relation.technology ? `${relation.label} [${relation.technology}]` : relation.label,
        type: 'smoothstep',
        ...c4RelationEdgeStyle(relation.macro),
        data: { ...c4RelationEdgeStyle(relation.macro).data, c4Relation: relation },
      })),
  )

  return { nodes, edges }
}

function nodeStyleSize(node: Node): { width: number; height: number } {
  const width = Number(node.width ?? node.style?.width ?? NODE_WIDTH)
  const height = Number(node.height ?? node.style?.height ?? NODE_HEIGHT)
  return { width: width || NODE_WIDTH, height: height || NODE_HEIGHT }
}

function absoluteNodePosition(nodes: Node<ArchimateNodeData>[], node: Node<ArchimateNodeData>): { x: number; y: number } {
  if (!node.parentNode) return node.position
  const parent = nodes.find((item) => item.id === node.parentNode)
  if (!parent) return node.position
  const origin = absoluteNodePosition(nodes, parent)
  return { x: origin.x + node.position.x, y: origin.y + node.position.y }
}

function readNodeGeometry(nodes: Node<ArchimateNodeData>[], nodeId: string): NodeGeometry | null {
  const node = nodes.find((item) => item.id === nodeId)
  if (!node) return null
  const position = absoluteNodePosition(nodes, node)
  const size = nodeStyleSize(node)
  return { x: position.x, y: position.y, width: size.width, height: size.height }
}

export function withFacingHandles(nodes: Node<ArchimateNodeData>[], edges: Edge[]): Edge[] {
  return edges.map((edge) => {
    if (hasManualConnectionHandles(edge)) return edge
    const from = readNodeGeometry(nodes, edge.source)
    const to = readNodeGeometry(nodes, edge.target)
    if (!from || !to) return edge
    const handles = pickCenteredAnchoredHandles(from, to)
    if (edge.sourceHandle === handles.sourceHandle && edge.targetHandle === handles.targetHandle) return edge
    return { ...edge, sourceHandle: handles.sourceHandle, targetHandle: handles.targetHandle }
  })
}

function graphFromPlantUml(source: string): ParsedGraph {
  const nodes: ParsedNode[] = []
  const aliases = new Set<string>()
  const add = (id: string, label: string, kind: ParsedKind) => {
    if (aliases.has(id)) return
    aliases.add(id)
    nodes.push({ id, label, kind })
  }

  if (/^\s*flowchart\b/im.test(source)) {
    const declaration = /\b([A-Za-z][\w-]*)\s*(?:\["?([^\]"]+)|\{"?([^}"]+)|\(\("?([^)"]+))/g
    let mermaid: RegExpExecArray | null
    while ((mermaid = declaration.exec(source))) {
      add(mermaid[1], (mermaid[2] || mermaid[3] || mermaid[4] || mermaid[1]).trim(), mermaid[3] ? 'decision' : 'activity')
    }
    const edges: ParsedGraph['edges'] = []
    const relation = /\b([A-Za-z][\w-]*)\s*--?>\|?[^\n|]*\|?\s*([A-Za-z][\w-]*)/g
    while ((mermaid = relation.exec(source))) {
      if (aliases.has(mermaid[1]) && aliases.has(mermaid[2])) {
        edges.push({ id: `edge-${edges.length}`, source: mermaid[1], target: mermaid[2] })
      }
    }
    return { nodes, edges }
  }

  const startAlias = /^\s*\(\*\)\s+as\s+([\w.-]+)/gim
  let match: RegExpExecArray | null
  while ((match = startAlias.exec(source))) {
    add(match[1], match[1].toLowerCase().includes('end') ? 'End' : 'Start', match[1].toLowerCase().includes('end') ? 'end' : 'start')
  }

  const declaration = /^\s*(rectangle|component|database|actor|cloud|node|hexagon|usecase|interface)\s+"([^"]+)"\s+as\s+([\w.-]+)/gim
  while ((match = declaration.exec(source))) {
    add(match[3], match[2], match[1] === 'hexagon' ? 'decision' : 'activity')
  }

  const activities = Array.from(source.matchAll(/^\s*:\s*([^;\n]+);/gm), (item) => item[1].trim())
  for (const label of activities) {
    add(`activity-${nodes.length + 1}`, label, 'activity')
  }

  if (!nodes.length) {
    const lines = source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('@') && !line.startsWith('skinparam') && !line.startsWith('!'))
    for (const label of lines.slice(0, 12)) {
      add(`step-${nodes.length + 1}`, label.replace(/^[:]/, '').replace(/;$/, ''), 'activity')
    }
  }

  const edges: ParsedGraph['edges'] = []
  const relation = /^\s*([\w.-]+)\s*--?>\s*([\w.-]+)(?:\s*:\s*(.+))?/gm
  while ((match = relation.exec(source))) {
    if (aliases.has(match[1]) && aliases.has(match[2])) {
      edges.push({ id: `edge-${match[1]}-${match[2]}-${edges.length}`, source: match[1], target: match[2], label: match[3]?.trim() })
    }
  }
  if (!edges.length) {
    nodes.slice(1).forEach((current, index) => {
      edges.push({ id: `edge-${index}`, source: nodes[index].id, target: current.id })
    })
  }
  return { nodes, edges }
}

const ERD_FILLS = ['#EDE4F7', '#E5F4E0', '#FFF4CC', '#F4F4F4', '#FDE8D8', '#DCEBFA']

const ERD_LINES = ['#8E6BB0', '#6B9B63', '#C4A35A', '#8A8A8A', '#C4895A', '#6A94C4']

function erdMemberName(raw: string): string {
  return raw.replace(/^\*\s*/, '').replace(/<<[^>]+>>/g, '').replace(/\s*:\s*.+$/, '').trim().toLowerCase()
}

function entityReferences(fromMembers: string[], toId: string, toTitle: string): boolean {
  const keys = new Set([toId, toTitle, `${toId}_id`, `${toTitle}_id`].map((value) => value.toLowerCase()))
  return fromMembers.some((member) => keys.has(erdMemberName(member)))
}

export function graphFromUml(source: string, view: UmlView, diagram?: UmlDiagram): { nodes: Node<ArchimateNodeData>[]; edges: Edge[] } {
  const parsed = diagram ?? parseUmlDiagram(source, view)
  const erd = view === 'erd'
  const stroke = erd ? '#C4A35A' : '#4B5563'
  const placed: Node<ArchimateNodeData>[] = []
  let x = 48
  let y = 48
  let column = 0
  let rowHeight = 0
  const columns = 3
  for (const box of parsed.boxes) {
    const attributes = box.members.filter((line) => !line.includes('('))
    const methods = box.members.filter((line) => line.includes('('))
    const boxKind = erd ? 'entity' : box.kind === 'interface' || box.kind === 'enumeration' ? box.kind : 'class'
    const stereotypeExtra = (boxKind === 'interface' || boxKind === 'enumeration' ? 14 : 0) + (box.stereotype ? 14 : 0)
    const longest = Math.max(box.title.length + 2, ...box.members.map((line) => erdMemberName(line).length + (erd ? 0 : 10)))
    const erdSize = erdEntityDefaultSize(box.title, box.members)
    const width = erd ? erdSize.width : Math.min(280, Math.max(148, longest * 6.6 + 40))
    const memberLines = (members: string[]) => members.reduce((total, line) => total + Math.max(1, Math.ceil(line.length * 6.6 / (width - 48))), 0)
    const height = erd
      ? erdSize.height + (box.stereotype ? 14 : 0)
      : 32 + stereotypeExtra + (attributes.length ? memberLines(attributes) * 16 + 8 : 0) + (methods.length ? memberLines(methods) * 16 + 8 : 0)
    if (column === columns) {
      column = 0
      x = 48
      y += rowHeight + 72
      rowHeight = 0
    }
    const fill = ERD_FILLS[placed.length % ERD_FILLS.length]
    const line = ERD_LINES[placed.length % ERD_LINES.length]
    placed.push({
      id: box.id,
      type: erd ? 'erdEntity' : 'umlClass',
      position: { x, y },
      style: { width, height },
      data: {
        kind: 'element',
        layer: 'application',
        stereotype: boxKind,
        umlStereotype: box.stereotype,
        title: box.title,
        description: box.members,
        notationId: boxKind,
        visual: {
          fillEnabled: true,
          fillColor: erd ? fill : '#ffffff',
          lineEnabled: true,
          lineColor: erd ? line : stroke,
          lineWidth: erd ? 1.5 : 1,
          lineStyle: 'solid',
          rounded: false,
          shadow: false,
        },
      },
    })
    rowHeight = Math.max(rowHeight, height)
    x += width + 80
    column += 1
  }
  const boxesById = new Map(parsed.boxes.map((box) => [box.id, box]))
  const edges = withFacingHandles(placed, parsed.links.map((link, index) => {
    const from = boxesById.get(link.source)
    const to = boxesById.get(link.target)
    const sourceFk = from && to ? entityReferences(from.members, to.id, to.title) : false
    const targetFk = from && to ? entityReferences(to.members, from.id, from.title) : false
    const sourceEnd = link.sourceEnd ?? (sourceFk && !targetFk ? { many: true, optional: false } : { many: false, optional: false })
    const targetEnd = link.targetEnd ?? (targetFk && !sourceFk ? { many: true, optional: false } : sourceFk ? { many: false, optional: false } : { many: true, optional: false })
    if (erd) {
      return {
        id: `uml-${link.source}-${link.target}-${index}`,
        source: link.source,
        target: link.target,
        label: link.label || undefined,
        type: 'erd' as const,
        data: {
          ...umlLinkToCanvasData(link),
          ...(link.erdForeignKey ? { erdForeignKey: link.erdForeignKey } : {}),
          sourceMany: sourceEnd.many,
          sourceOptional: sourceEnd.optional,
          targetMany: targetEnd.many,
          targetOptional: targetEnd.optional,
        },
      }
    }
    return {
      id: `uml-${link.source}-${link.target}-${index}`,
      source: link.source,
      target: link.target,
      label: link.label || undefined,
      type: 'smoothstep' as const,
      data: umlLinkToCanvasData(link),
      style: { stroke, strokeWidth: 1.75, strokeDasharray: link.lineStyle === 'dashed' ? '5 4' : undefined },
    }
  }))
  return { nodes: placed, edges }
}

export function parseSource(source: string, format: DiagramFormat) {
  if (format === 'use-case') { const graph = parseUseCaseDiagram(source); return { ...graph, edges: withFacingHandles(graph.nodes, graph.edges) } }
  if (format === 'class' || format === 'erd') return graphFromUml(source, format)
  if (format === 'c4') return graphFromC4(source)
  if (format === 'bpmn') {
    const parsed = parseBpmnSource(source)
    const positions = layoutBpmnPositions(parsed.nodes, parsed.edges)
    const nodes = [
      ...bpmnSwimlaneNodes(parsed.nodes, parsed.edges),
      ...parsed.nodes.map((item) => toBpmnNode(item, positions.get(item.id) ?? { x: 48, y: 48 })),
    ]
    return { nodes, edges: withFacingHandles(nodes, toArchimateEdges(parsed)) }
  }
  const parsed = graphFromPlantUml(source)
  const nodes = parsed.nodes.map((item, index) => toArchimateNode(item, index))
  const edges = withFacingHandles(nodes, toArchimateEdges(parsed))
  return { nodes, edges }
}

/** Build canonical preview data without mounting editor effects or accessing storage. */
export function buildReadOnlyDiagramCanvasGraph(source: string, format: DiagramFormat) {
  return parseSource(source, format)
}
