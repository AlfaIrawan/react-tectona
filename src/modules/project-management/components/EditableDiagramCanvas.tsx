import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { ArrowDown, ArrowRight, ArrowRightLeft, Check, ChevronRight, ChevronsLeft, ChevronsRight, Circle, Copy, Crosshair, Grid3X3, GripVertical, ImageDown, Layers, LayoutTemplate, ListChecks, Magnet, MousePointer2, Paintbrush, PencilLine, Ruler, Settings2, Waypoints } from 'lucide-react'
import {
  ReactFlowProvider,
  addEdge,
  MarkerType,
  updateEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type OnSelectionChangeFunc,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { cn } from '@/lib/utils'
import { BpmnNotationPalette } from '@/modules/project-management/components/BpmnNotationPalette'
import { C4NotationPalette } from '@/modules/project-management/components/C4NotationPalette'
import { DiagramEdgePropertiesPanel } from '@/modules/project-management/components/DiagramEdgePropertiesPanel'
import { IntegrationArchitectureFlow } from '@/modules/project-management/components/IntegrationArchitectureFlow'
import { IntegrationNodePropertiesPanel } from '@/modules/project-management/components/IntegrationNodePropertiesPanel'
import { PlantUmlSourceEditor } from '@/modules/project-management/components/PlantUmlSourceEditor'
import { BPMN_PALETTE_MIME, createBpmnNodeFromPaletteItem, type BpmnPaletteItem } from '@/modules/project-management/lib/bpmnNotationPalette'
import { C4_PALETTE_MIME, createC4NodeFromPaletteItem, type C4PaletteItem } from '@/modules/project-management/lib/c4NotationPalette'
import type { ArchimateElementNodeData, ArchimateNodeData } from '@/modules/project-management/lib/integrationArchitectureTypes'
import { c4LevelFromDiagramKey, c4Stereotype, isC4External, normalizeC4PlantUml, parseC4Graph, serializeC4Graph, type C4ElementKind, type C4ParsedGraph } from '@/modules/project-management/lib/c4PlantUml'
import { isCanvasViewport, type CanvasViewport } from '@/modules/project-management/lib/integrationGraphStorage'
import { defaultIntegrationNodeVisual } from '@/modules/project-management/lib/integrationNodeAppearance'
import { pickCenteredAnchoredHandles, type NodeGeometry } from '@/modules/project-management/lib/parsePlantUmlToIntegrationGraph'
import { parseBpmnSource, serializeBpmnCanvasToPlantUml, toBpmnEditorSource } from '@/modules/project-management/lib/bpmnPlantUml'
import { bpmnDefaultLineColor, bpmnNodeSizeForType, isBpmnSquareShape } from '@/modules/project-management/lib/bpmnNotationSpec'

type DiagramFormat = 'plantuml' | 'bpmn' | 'c4'
type ParsedKind = 'activity' | 'decision' | 'start' | 'end'
type ParsedNode = { id: string; label: string; kind: ParsedKind; bpmnType?: string }
type ParsedGraph = { nodes: ParsedNode[]; edges: Array<{ id: string; source: string; target: string; label?: string }> }
type DiagramStore = Record<string, { nodes: Node<ArchimateNodeData>[]; edges: Edge[]; source?: string; viewport?: CanvasViewport; snapToGrid?: boolean }>

const STORAGE_KEY = 'tectona-idea-editable-diagrams-v2'
const STUDIO_PANEL_MARGIN_PX = 8
const CANVAS_RULER_INSET_PX = 22
const STUDIO_PANEL_INSET_PX = CANVAS_RULER_INSET_PX + STUDIO_PANEL_MARGIN_PX
const STUDIO_PANEL_DEFAULT_POSITION = { x: STUDIO_PANEL_INSET_PX, y: STUDIO_PANEL_INSET_PX }
const STUDIO_PANEL_DEFAULT_WIDTH_PX = 400
const STUDIO_PANEL_MIN_WIDTH_PX = 240
const STUDIO_PANEL_MIN_HEIGHT_PX = 160
const STUDIO_PANEL_COLLAPSED_WIDTH_PX = 140
const STUDIO_PANEL_COLLAPSED_HEIGHT_PX = 44
type StudioPanelResizeEdge = 'e' | 's' | 'se'
type PropertiesPanelResizeEdge = 'e' | 's' | 'se' | 'w' | 'sw'
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

function isBpmnSquareLocked(node: Node<ArchimateNodeData>): boolean {
  if (node.type !== 'bpmnElement' || node.data.kind !== 'element') return false
  return isBpmnSquareShape(node.data.notationId)
}

function bpmnConnectEdgeStyle(flowType: string): Pick<Edge, 'style' | 'markerEnd' | 'markerStart' | 'data' | 'label'> {
  const isMessage = flowType === 'messageFlow'
  const isDefault = flowType === 'defaultSequenceFlow'
  const isExpression = flowType === 'expressionSequenceFlow'
  return {
    label: isExpression ? '/' : isDefault ? '\\' : undefined,
    markerStart: isMessage ? { type: MarkerType.ArrowClosed, color: '#334155', width: 6, height: 6 } : undefined,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#334155', width: 10, height: 10 },
    style: {
      stroke: '#334155',
      strokeWidth: 1.5,
      strokeDasharray: isMessage ? '6 4' : undefined,
    },
    data: { bpmnFlowType: flowType },
  }
}

function squareSize(width: number, height: number): number {
  return Math.max(width, height)
}

function layoutBpmnPositions(nodes: ParsedNode[], edges: ParsedGraph['edges']): Map<string, { x: number; y: number }> {
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
  const rowPitch = 140
  for (const [depth, ids] of buckets) {
    ids.forEach((id, index) => {
      const size = bpmnNodeSize(nodes.find((node) => node.id === id)?.bpmnType ?? 'task')
      const rowCenter = 48 + index * rowPitch + rowPitch / 2
      positions.set(id, {
        x: 48 + depth * 220,
        y: rowCenter - size.height / 2,
      })
    })
  }
  return positions
}

function toBpmnNode(item: ParsedNode, position: { x: number; y: number }): Node<ArchimateNodeData> {
  const bpmnType = item.bpmnType ?? 'task'
  const size = bpmnNodeSize(bpmnType)
  return {
    id: item.id,
    type: 'bpmnElement',
    position,
    style: { width: size.width, height: size.height },
    data: {
      kind: 'element',
      layer: 'business',
      stereotype: bpmnStereotype(bpmnType),
      title: item.label || bpmnStereotype(bpmnType),
      description: [],
      notationId: bpmnType,
      visual: {
        fillEnabled: true,
        fillColor: '#ffffff',
        lineEnabled: true,
        lineColor: bpmnDefaultLineColor(bpmnType),
        lineWidth: 2,
        lineStyle: 'solid',
        rounded: true,
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
  const parent = parsed.boundaries[0]
  const children = parent ? parsed.elements.filter((item) => item.parentId === parent.id) : []
  const outside = parent ? parsed.elements.filter((item) => item.parentId !== parent.id) : parsed.elements

  if (parent) {
    nodes.push({
      id: parent.id,
      type: 'archimateBoundary',
      position: { x: 280, y: 32 },
      style: { width: 300, height: Math.max(220, 56 + children.length * 148) },
      zIndex: 0,
      data: {
        kind: 'boundary',
        title: parent.title,
        visual: {
          fillEnabled: false,
          lineEnabled: true,
          lineColor: '#64748b',
          lineStyle: 'dashed',
          rounded: true,
        },
      },
    })
    children.forEach((item, index) => {
      nodes.push({ ...toC4ElementNode(item, { x: 28, y: 40 + index * 148 }), zIndex: 1 })
    })
  }

  outside.forEach((item, index) => {
    const isPerson = item.kind.startsWith('Person')
    nodes.push(toC4ElementNode(item, isPerson ? { x: 24, y: 72 + index * 150 } : { x: 640, y: 72 + index * 150 }))
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
        markerEnd: { type: MarkerType.ArrowClosed, color: '#334155', width: 10, height: 10 },
        style: { stroke: '#334155', strokeWidth: 1.5 },
      })),
  )

  return { nodes, edges }
}

function flowToC4Graph(nodes: Node<ArchimateNodeData>[], edges: Edge[], previous: string): C4ParsedGraph {
  const normalized = normalizeC4PlantUml(previous, 'L2')
  const title = parseC4Graph(normalized).title
  const boundaries = nodes
    .filter((node) => node.type === 'archimateBoundary' && node.data.kind === 'boundary')
    .map((node) => ({ id: node.id, title: node.data.title }))
  const elements = nodes
    .filter((node) => node.type === 'c4Element' && node.data.kind === 'element')
    .map((node) => {
      const data = node.data
      const kind = (ELEMENT_KIND_SET.has(data.notationId) ? data.notationId : 'System') as C4ElementKind
      const techLine = data.description.find((line) => line.startsWith('[') && line.endsWith(']'))
      return {
        id: node.id,
        kind,
        title: data.title,
        technology: techLine ? techLine.slice(1, -1) : '',
        description: data.description.filter((line) => line !== techLine).join(' '),
        parentId: node.parentNode,
      }
    })
  const relations = edges.map((edge, index) => {
    const raw = String(edge.label ?? 'uses')
    const techMatch = /\s*\[([^\]]+)\]\s*$/.exec(raw)
    return {
      id: edge.id || `rel-${index}`,
      source: edge.source,
      target: edge.target,
      label: techMatch ? raw.slice(0, techMatch.index).trim() : raw,
      technology: techMatch?.[1] ?? '',
    }
  })
  return { title, boundaries, elements, relations }
}

const ELEMENT_KIND_SET = new Set([
  'Person', 'Person_Ext', 'System', 'System_Ext', 'SystemDb', 'Container', 'Container_Ext', 'ContainerDb', 'Component',
])

function isStoredC4Graph(nodes: Node<ArchimateNodeData>[]): boolean {
  return nodes.some((node) => node.type === 'c4Element')
}

function isStoredBpmnGraph(nodes: Node<ArchimateNodeData>[]): boolean {
  return nodes.some((node) => node.type === 'bpmnElement')
}

function nodeStyleSize(node: Node): { width: number; height: number } {
  const width = Number(node.measured?.width ?? node.width ?? node.style?.width ?? NODE_WIDTH)
  const height = Number(node.measured?.height ?? node.height ?? node.style?.height ?? NODE_HEIGHT)
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

function withFacingHandles(nodes: Node<ArchimateNodeData>[], edges: Edge[]): Edge[] {
  return edges.map((edge) => {
    const from = readNodeGeometry(nodes, edge.source)
    const to = readNodeGeometry(nodes, edge.target)
    if (!from || !to) return edge
    const handles = pickCenteredAnchoredHandles(from, to)
    if (edge.sourceHandle === handles.sourceHandle && edge.targetHandle === handles.targetHandle) return edge
    return { ...edge, sourceHandle: handles.sourceHandle, targetHandle: handles.targetHandle }
  })
}

function mergeCanvasLayout(
  previous: Node<ArchimateNodeData>[],
  next: Node<ArchimateNodeData>[],
): Node<ArchimateNodeData>[] {
  const previousById = new Map(previous.map((node) => [node.id, node]))
  return next.map((node) => {
    const prior = previousById.get(node.id)
    if (!prior) return node
    return {
      ...node,
      position: prior.position,
      parentNode: prior.parentNode,
      extent: prior.extent,
      zIndex: prior.zIndex,
      style: { ...node.style, ...prior.style },
      width: prior.width,
      height: prior.height,
    }
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

function parseSource(source: string, format: DiagramFormat) {
  if (format === 'c4') return graphFromC4(source)
  if (format === 'bpmn') {
    const parsed = parseBpmnSource(source)
    const positions = layoutBpmnPositions(parsed.nodes, parsed.edges)
    const nodes = parsed.nodes.map((item) => toBpmnNode(item, positions.get(item.id) ?? { x: 48, y: 48 }))
    return { nodes, edges: withFacingHandles(nodes, toArchimateEdges(parsed)) }
  }
  const parsed = graphFromPlantUml(source)
  const nodes = parsed.nodes.map((item, index) => toArchimateNode(item, index))
  const edges = withFacingHandles(nodes, toArchimateEdges(parsed))
  return { nodes, edges }
}

function loadGraph(key: string, fallback: { nodes: Node<ArchimateNodeData>[]; edges: Edge[] }) {
  try {
    const store = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as DiagramStore
    if (!store[key]?.nodes?.length) return { ...fallback, viewport: undefined as CanvasViewport | undefined, snapToGrid: undefined as boolean | undefined }
    return {
      nodes: store[key].nodes,
      edges: store[key].edges,
      viewport: isCanvasViewport(store[key].viewport) ? store[key].viewport : undefined,
      snapToGrid: typeof store[key].snapToGrid === 'boolean' ? store[key].snapToGrid : undefined,
    }
  } catch {
    return { ...fallback, viewport: undefined as CanvasViewport | undefined, snapToGrid: undefined as boolean | undefined }
  }
}

function saveGraph(key: string, graph: { nodes: Node<ArchimateNodeData>[]; edges: Edge[]; source: string; viewport?: CanvasViewport; snapToGrid?: boolean }) {
  try {
    const store = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as DiagramStore
    store[key] = graph
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* Browser storage is optional. */
  }
}

type StudioSidebarPanel = 'source' | 'diagram'
type CanvasMenuSubmenu = 'options' | 'layout' | null
type CanvasContextMenuState = {
  x: number
  y: number
  flowPosition: { x: number; y: number }
  submenu: CanvasMenuSubmenu
}

type EditableDiagramCanvasProps = {
  ideaId: string
  diagramKey: string
  source: string
  format: DiagramFormat
  editable?: boolean
  fillHeight?: boolean
  hideStudioHeader?: boolean
  className?: string
  savedGraph?: { nodes: Node<ArchimateNodeData>[]; edges: Edge[]; viewport?: CanvasViewport; snapToGrid?: boolean }
  onPersistGraph?: (graph: { nodes: Node<ArchimateNodeData>[]; edges: Edge[]; source: string; viewport?: CanvasViewport; snapToGrid?: boolean }) => void
}

function EditableDiagramCanvasInner({
  ideaId,
  diagramKey,
  source,
  format,
  editable = false,
  fillHeight = false,
  hideStudioHeader = false,
  className,
  savedGraph,
  onPersistGraph,
}: EditableDiagramCanvasProps) {
  const { screenToFlowPosition } = useReactFlow()
  const reactFlowWrapperRef = useRef<HTMLDivElement | null>(null)
  const storageKey = `${ideaId}:${diagramKey}`
  const c4Source = useMemo(
    () => (format === 'c4' ? normalizeC4PlantUml(source, c4LevelFromDiagramKey(diagramKey)) : source),
    [diagramKey, format, source],
  )
  const imported = useMemo(() => parseSource(c4Source, format), [c4Source, format])
  const initial = useMemo(() => {
    if (savedGraph?.nodes?.length) {
      if (format === 'bpmn' && !isStoredBpmnGraph(savedGraph.nodes)) {
        return {
          ...imported,
          viewport: savedGraph.viewport,
          snapToGrid: savedGraph.snapToGrid,
          edges: withFacingHandles(imported.nodes, imported.edges),
        }
      }
      return { ...savedGraph, edges: withFacingHandles(savedGraph.nodes, savedGraph.edges) }
    }
    if (!editable) return imported
    const stored = loadGraph(storageKey, imported)
    if (format === 'c4' && !isStoredC4Graph(stored.nodes)) {
      return {
        ...imported,
        viewport: stored.viewport,
        snapToGrid: stored.snapToGrid,
        edges: withFacingHandles(imported.nodes, imported.edges),
      }
    }
    if (format === 'bpmn' && !isStoredBpmnGraph(stored.nodes)) {
      return {
        ...imported,
        viewport: stored.viewport,
        snapToGrid: stored.snapToGrid,
        edges: withFacingHandles(imported.nodes, imported.edges),
      }
    }
    return { ...stored, edges: withFacingHandles(stored.nodes, stored.edges) }
  }, [editable, format, imported, savedGraph, storageKey])
  const [nodes, setNodes, onNodesChange] = useNodesState<ArchimateNodeData>(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [sidebarPanel, setSidebarPanel] = useState<StudioSidebarPanel>(format === 'c4' ? 'diagram' : 'source')
  const [sourceDraft, setSourceDraft] = useState(() => (format === 'bpmn' ? toBpmnEditorSource(c4Source) : c4Source))
  const c4Level = c4LevelFromDiagramKey(diagramKey)
  const viewportRef = useRef<CanvasViewport | undefined>(initial.viewport)
  const [savedViewport, setSavedViewport] = useState<CanvasViewport | undefined>(initial.viewport)
  const [isStudioPanelCollapsed, setIsStudioPanelCollapsed] = useState(false)
  const [studioPanelPosition, setStudioPanelPosition] = useState(STUDIO_PANEL_DEFAULT_POSITION)
  const [studioPanelSize, setStudioPanelSize] = useState({ width: STUDIO_PANEL_DEFAULT_WIDTH_PX, height: 0 })
  const [propertiesPanelPosition, setPropertiesPanelPosition] = useState<{ x: number; y: number } | null>(null)
  const [propertiesPanelSize, setPropertiesPanelSize] = useState({ width: STUDIO_PANEL_DEFAULT_WIDTH_PX, height: 0 })
  const [isStudioPanelDragging, setIsStudioPanelDragging] = useState(false)
  const [isStudioPanelResizing, setIsStudioPanelResizing] = useState(false)
  const [isPropertiesPanelDragging, setIsPropertiesPanelDragging] = useState(false)
  const [isPropertiesPanelResizing, setIsPropertiesPanelResizing] = useState(false)
  const [canvasMenu, setCanvasMenu] = useState<CanvasContextMenuState | null>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [showGuides, setShowGuides] = useState(true)
  const [snapToGrid, setSnapToGrid] = useState(initial.snapToGrid ?? true)
  const [bpmnFlowType, setBpmnFlowType] = useState('sequenceFlow')
  const [showRuler, setShowRuler] = useState(true)
  const [showConnectionArrows, setShowConnectionArrows] = useState(true)
  const [showConnectionPoints, setShowConnectionPoints] = useState(true)
  const canvasZoneRef = useRef<HTMLDivElement | null>(null)
  const studioPanelShellRef = useRef<HTMLDivElement | null>(null)
  const propertiesPanelShellRef = useRef<HTMLDivElement | null>(null)
  const studioPanelDragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null)
  const studioPanelResizeRef = useRef<{
    pointerId: number
    edge: StudioPanelResizeEdge
    startX: number
    startY: number
    originWidth: number
    originHeight: number
  } | null>(null)
  const propertiesPanelDragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null)
  const propertiesPanelResizeRef = useRef<{
    pointerId: number
    edge: PropertiesPanelResizeEdge
    startX: number
    startY: number
    originX: number
    originY: number
    originWidth: number
    originHeight: number
  } | null>(null)
  const persistTimerRef = useRef<number | null>(null)
  const skipPersistRef = useRef(true)
  const appliedStorageKeyRef = useRef<string | null>(null)
  const appliedSavedGraphRef = useRef(false)

  useEffect(() => {
    if (appliedStorageKeyRef.current !== storageKey) appliedSavedGraphRef.current = false
  const shouldApplySaved = Boolean(savedGraph?.nodes?.length) && !appliedSavedGraphRef.current
    if (appliedStorageKeyRef.current === storageKey && !shouldApplySaved) return
    skipPersistRef.current = true
    appliedStorageKeyRef.current = storageKey
    appliedSavedGraphRef.current = Boolean(savedGraph?.nodes?.length)
    setNodes(initial.nodes)
    setEdges(initial.edges)
    viewportRef.current = initial.viewport
    setSavedViewport(initial.viewport)
    setSnapToGrid(initial.snapToGrid ?? true)
    setSourceDraft(format === 'bpmn' ? toBpmnEditorSource(c4Source) : c4Source)
  }, [c4Source, initial.edges, initial.nodes, initial.snapToGrid, initial.viewport, savedGraph, setEdges, setNodes, storageKey])
  useEffect(() => {
    if (editable) saveGraph(storageKey, { nodes, edges, source: sourceDraft, viewport: viewportRef.current, snapToGrid })
    if (!editable || !onPersistGraph) return
    if (skipPersistRef.current) {
      skipPersistRef.current = false
      return
    }
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current)
    persistTimerRef.current = window.setTimeout(() => {
      onPersistGraph({ nodes, edges, source: sourceDraft, viewport: viewportRef.current, snapToGrid })
    }, 700)
    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current)
    }
  }, [editable, edges, nodes, onPersistGraph, snapToGrid, sourceDraft, storageKey])
  useEffect(() => {
    if (format !== 'c4') return
    setSourceDraft((current) => {
      const next = serializeC4Graph(flowToC4Graph(nodes, edges, current), c4Level)
      return next === current ? current : next
    })
  }, [c4Level, edges, format, nodes])
  useEffect(() => {
    if (format !== 'bpmn') return
    setSourceDraft((current) => {
      const next = serializeBpmnCanvasToPlantUml(nodes, edges)
      return next === current ? current : next
    })
  }, [edges, format, nodes])

  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const nextChanges = changes.map((change) => {
      if (change.type !== 'dimensions' || !change.dimensions) return change
      const node = nodesRef.current.find((item) => item.id === change.id)
      if (!node || !isBpmnSquareLocked(node)) return change
      const size = squareSize(change.dimensions.width, change.dimensions.height)
      return { ...change, dimensions: { width: size, height: size } }
    })
    onNodesChange(nextChanges)
  }, [onNodesChange])
  const nodeLayoutKey = nodes
    .map((node) => `${node.id}:${Math.round(node.position.x)}:${Math.round(node.position.y)}:${Math.round(Number(node.width ?? 0))}:${Math.round(Number(node.height ?? 0))}:${node.parentNode ?? ''}`)
    .join('|')
  useEffect(() => {
    setNodes((current) => {
      let changed = false
      const next = current.map((node) => {
        if (!isBpmnSquareLocked(node)) return node
        const width = Number(node.width ?? node.style?.width ?? 0)
        const height = Number(node.height ?? node.style?.height ?? 0)
        if (!width || !height || Math.abs(width - height) < 0.5) return node
        const size = squareSize(width, height)
        changed = true
        return { ...node, width: size, height: size, style: { ...node.style, width: size, height: size } }
      })
      return changed ? next : current
    })
  }, [nodeLayoutKey, setNodes])
  useEffect(() => {
    setEdges((current) => {
      const next = withFacingHandles(nodesRef.current, current)
      const changed = next.some((edge, index) => (
        edge.sourceHandle !== current[index]?.sourceHandle || edge.targetHandle !== current[index]?.targetHandle
      ))
      return changed ? next : current
    })
  }, [nodeLayoutKey, setEdges])

  const onConnect = useCallback(
    (connection: Connection) => setEdges((current) => withFacingHandles(nodes, addEdge({
      ...connection,
      type: 'smoothstep',
      ...bpmnConnectEdgeStyle(format === 'bpmn' ? bpmnFlowType : 'sequenceFlow'),
    }, current))),
    [bpmnFlowType, format, nodes, setEdges],
  )

  const onEdgeUpdate = useCallback(
    (oldEdge: Edge, connection: Connection) => {
      setEdges((current) => {
        const next = updateEdge(oldEdge, connection, current).map((edge) => (
          edge.id === oldEdge.id ? { ...edge, selected: true } : edge
        ))
        if (connection.sourceHandle && connection.targetHandle) return next
        return withFacingHandles(nodes, next)
      })
      setSelectedEdgeId(oldEdge.id)
      setSelectedNodeId(null)
    },
    [nodes, setEdges],
  )

  const handleSelectionChange = useCallback<OnSelectionChangeFunc>(({ nodes: selectedNodes, edges: selectedEdges }) => {
    setSelectedNodeId(selectedNodes[0]?.id ?? null)
    setSelectedEdgeId(selectedEdges[0]?.id ?? null)
  }, [])

  const clearCanvasSelection = useCallback(() => {
    setCanvasMenu(null)
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setNodes((current) => current.map((node) => (node.selected ? { ...node, selected: false } : node)))
    setEdges((current) => current.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)))
  }, [setEdges, setNodes])

  const handleEdgeClick = useCallback((_event: MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id)
    setSelectedNodeId(null)
    setNodes((current) => current.map((node) => ({ ...node, selected: false })))
    setEdges((current) => current.map((item) => ({ ...item, selected: item.id === edge.id })))
  }, [setEdges, setNodes])

  const handlePaletteDragStart = useCallback((event: DragEvent<HTMLButtonElement>, item: C4PaletteItem) => {
    event.dataTransfer.setData(C4_PALETTE_MIME, JSON.stringify(item))
    event.dataTransfer.effectAllowed = 'copyMove'
  }, [])

  const handleBpmnPaletteDragStart = useCallback((event: DragEvent<HTMLButtonElement>, item: BpmnPaletteItem) => {
    event.dataTransfer.setData(BPMN_PALETTE_MIME, JSON.stringify(item))
    event.dataTransfer.effectAllowed = 'copyMove'
  }, [])

  const handleCanvasDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleCanvasDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const bpmnRaw = event.dataTransfer.getData(BPMN_PALETTE_MIME)
      if (bpmnRaw) {
        let item: BpmnPaletteItem
        try {
          item = JSON.parse(bpmnRaw) as BpmnPaletteItem
        } catch {
          return
        }
        if (item.kind === 'flow') {
          setBpmnFlowType(item.bpmnType)
          return
        }
        const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
        const newNode = createBpmnNodeFromPaletteItem(item, position, nodes.map((node) => node.id))
        setNodes((current) => [...current, newNode])
        setSelectedNodeId(newNode.id)
        setSelectedEdgeId(null)
        return
      }
      const raw = event.dataTransfer.getData(C4_PALETTE_MIME)
      if (!raw) return
      let item: C4PaletteItem
      try {
        item = JSON.parse(raw) as C4PaletteItem
      } catch {
        return
      }
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const newNode = createC4NodeFromPaletteItem(item, position, nodes.map((node) => node.id))
      setNodes((current) => {
        if (item.kind === 'boundary') return [...current, newNode]
        const nodeById = new Map(current.map((node) => [node.id, node]))
        const absolutePosition = (node: Node<ArchimateNodeData>): { x: number; y: number } => {
          if (!node.parentNode) return node.position
          const parent = nodeById.get(node.parentNode)
          if (!parent) return node.position
          const parentPosition = absolutePosition(parent)
          return { x: parentPosition.x + node.position.x, y: parentPosition.y + node.position.y }
        }
        const dimensions = (node: Node<ArchimateNodeData>) => ({
          width: Number(node.measured?.width ?? node.width ?? node.style?.width ?? 240),
          height: Number(node.measured?.height ?? node.height ?? node.style?.height ?? 120),
        })
        const size = dimensions(newNode)
        const center = { x: position.x + size.width / 2, y: position.y + size.height / 2 }
        const target = current
          .filter((node) => node.type === 'archimateBoundary')
          .map((node) => ({ node, position: absolutePosition(node), size: dimensions(node) }))
          .filter(({ position: targetPosition, size: targetSize }) =>
            center.x >= targetPosition.x &&
            center.x <= targetPosition.x + targetSize.width &&
            center.y >= targetPosition.y &&
            center.y <= targetPosition.y + targetSize.height,
          )
          .sort((a, b) => a.size.width * a.size.height - b.size.width * b.size.height)[0]
        if (!target) return [...current, newNode]
        return [
          ...current,
          {
            ...newNode,
            parentNode: target.node.id,
            extent: 'parent' as const,
            position: { x: position.x - target.position.x, y: position.y - target.position.y },
          },
        ]
      })
      setSelectedNodeId(newNode.id)
      setSelectedEdgeId(null)
    },
    [nodes, screenToFlowPosition, setNodes],
  )

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) ?? null : null),
    [nodes, selectedNodeId],
  )
  const selectedEdge = useMemo(
    () => (selectedEdgeId ? edges.find((edge) => edge.id === selectedEdgeId) ?? null : null),
    [edges, selectedEdgeId],
  )

  const updateSelectedEdge = useCallback((patch: Partial<Edge>) => {
    if (!selectedEdgeId) return
    setEdges((current) => current.map((edge) => {
      if (edge.id !== selectedEdgeId) return edge
      return {
        ...edge,
        ...patch,
        style: { ...edge.style, ...patch.style },
        data: patch.data ? { ...edge.data, ...patch.data } : edge.data,
      }
    }))
  }, [selectedEdgeId, setEdges])

  const clearSelectedEdgeWaypoints = useCallback(() => {
    if (!selectedEdgeId) return
    setEdges((current) => withFacingHandles(nodes, current.map((edge) => (
      edge.id === selectedEdgeId ? { ...edge, sourceHandle: undefined, targetHandle: undefined } : edge
    ))))
  }, [nodes, selectedEdgeId, setEdges])

  const applySource = useCallback((next: string) => {
    const normalized = format === 'c4'
      ? normalizeC4PlantUml(next, c4LevelFromDiagramKey(diagramKey))
      : format === 'bpmn'
        ? toBpmnEditorSource(next)
        : next
    const graph = parseSource(normalized, format)
    setSourceDraft(normalized)
    setNodes((current) => {
      const merged = mergeCanvasLayout(current, graph.nodes)
      setEdges(withFacingHandles(merged, graph.edges))
      return merged
    })
    setSelectedNodeId(null)
  }, [diagramKey, format, setEdges, setNodes])

  const updateSelectedNodeData = useCallback((patch: Record<string, unknown>) => {
    if (!selectedNodeId) return
    setNodes((current) => current.map((node) => (
      node.id === selectedNodeId ? { ...node, data: { ...node.data, ...patch } as ArchimateNodeData } : node
    )))
  }, [selectedNodeId, setNodes])

  const updateSelectedNodeSize = useCallback((width: number, height: number) => {
    if (!selectedNodeId) return
    setNodes((current) => current.map((node) => (
      node.id === selectedNodeId
        ? { ...node, style: { ...node.style, width: Math.max(24, width), height: Math.max(24, height) } }
        : node
    )))
  }, [selectedNodeId, setNodes])

  const updateSelectedNodePosition = useCallback((x: number, y: number) => {
    if (!selectedNodeId) return
    setNodes((current) => current.map((node) => (node.id === selectedNodeId ? { ...node, position: { x, y } } : node)))
  }, [selectedNodeId, setNodes])

  const handleLayerAction = useCallback((action: 'front' | 'back' | 'forward' | 'backward') => {
    if (!selectedNodeId) return
    setNodes((current) => {
      const ordered = [...current].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
      const index = ordered.findIndex((node) => node.id === selectedNodeId)
      if (index < 0) return current
      const next = [...ordered]
      const [selected] = next.splice(index, 1)
      if (action === 'front') next.push(selected)
      else if (action === 'back') next.unshift(selected)
      else if (action === 'forward') next.splice(Math.min(index + 1, next.length), 0, selected)
      else next.splice(Math.max(index - 1, 0), 0, selected)
      return next.map((node, zIndex) => ({ ...node, zIndex }))
    })
  }, [selectedNodeId, setNodes])

  const handleRotateSelectedNode90 = useCallback(() => {
    if (!selectedNode || selectedNode.data.kind !== 'element') return
    const angle = (((selectedNode.data.textStyle?.angle ?? 0) + 90) % 360)
    updateSelectedNodeData({ textStyle: { ...selectedNode.data.textStyle, angle } })
  }, [selectedNode, updateSelectedNodeData])

  const deleteSelected = useCallback(() => {
    if (selectedNodeId) {
      setNodes((current) => current.filter((item) => item.id !== selectedNodeId))
      setEdges((current) => current.filter((item) => item.source !== selectedNodeId && item.target !== selectedNodeId))
      setSelectedNodeId(null)
      return
    }
    if (selectedEdgeId) {
      setEdges((current) => current.filter((item) => item.id !== selectedEdgeId))
      setSelectedEdgeId(null)
    }
  }, [selectedEdgeId, selectedNodeId, setEdges, setNodes])

  const handlePaneContextMenu = useCallback((event: ReactMouseEvent | MouseEvent) => {
    event.preventDefault()
    const wrapper = reactFlowWrapperRef.current
    if (!wrapper) return
    const bounds = wrapper.getBoundingClientRect()
    setCanvasMenu({
      x: Math.min(event.clientX - bounds.left, bounds.width - 280),
      y: Math.min(event.clientY - bounds.top, bounds.height - 280),
      flowPosition: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      submenu: null,
    })
  }, [screenToFlowPosition])

  const selectCanvasElements = useCallback((kind: 'nodes' | 'edges' | 'all') => {
    const selectNodes = kind === 'nodes' || kind === 'all'
    const selectEdges = kind === 'edges' || kind === 'all'
    setNodes((current) => current.map((node) => ({ ...node, selected: selectNodes })))
    setEdges((current) => current.map((edge) => ({ ...edge, selected: selectEdges })))
    setSelectedNodeId(selectNodes ? nodes[0]?.id ?? null : null)
    setSelectedEdgeId(selectEdges ? edges[0]?.id ?? null : null)
    setCanvasMenu(null)
  }, [edges, nodes, setEdges, setNodes])

  const clearDefaultStyle = useCallback(() => {
    const selectedIds = new Set(nodes.filter((node) => node.selected).map((node) => node.id))
    setNodes((current) => current.map((node) => {
      if (selectedIds.size > 0 && !selectedIds.has(node.id)) return node
      if (node.data.kind !== 'element') return node
      return {
        ...node,
        data: {
          ...node.data,
          visual: { ...node.data.visual, fillEnabled: false, shadow: false },
        },
      }
    }))
    setCanvasMenu(null)
  }, [nodes, setNodes])

  const pasteSourceAtCursor = useCallback(async () => {
    if (!canvasMenu || !navigator.clipboard?.readText) return
    try {
      const text = await navigator.clipboard.readText()
      const parsed = parseSource(format === 'c4' ? normalizeC4PlantUml(text, c4Level) : text, format)
      if (parsed.nodes.length === 0) return
      const minX = Math.min(...parsed.nodes.map((node) => node.position.x))
      const minY = Math.min(...parsed.nodes.map((node) => node.position.y))
      const idSuffix = crypto.randomUUID()
      const idMap = new Map(parsed.nodes.map((node) => [node.id, `${node.id}-paste-${idSuffix}`]))
      const pastedNodes = parsed.nodes.map((node) => ({
        ...node,
        id: idMap.get(node.id) ?? node.id,
        parentNode: node.parentNode ? idMap.get(node.parentNode) : undefined,
        extent: node.extent,
        selected: true,
        position: {
          x: canvasMenu.flowPosition.x + node.position.x - minX,
          y: canvasMenu.flowPosition.y + node.position.y - minY,
        },
      }))
      const pastedEdges = withFacingHandles(pastedNodes, parsed.edges.map((edge) => ({
        ...edge,
        id: `${edge.id}-paste-${idSuffix}`,
        source: idMap.get(edge.source) ?? edge.source,
        target: idMap.get(edge.target) ?? edge.target,
      })))
      setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), ...pastedNodes])
      setEdges((current) => [...current.map((edge) => ({ ...edge, selected: false })), ...pastedEdges])
      setSelectedNodeId(pastedNodes[0]?.id ?? null)
      setSelectedEdgeId(null)
    } finally {
      setCanvasMenu(null)
    }
  }, [c4Level, canvasMenu, format, setEdges, setNodes])

  const copyCanvasAsImage = useCallback(async () => {
    const drawableNodes = nodes.filter((node) => node.type !== 'archimateLegend')
    if (drawableNodes.length === 0) return
    const dimensions = (node: Node<ArchimateNodeData>) => ({
      width: Number(node.measured?.width ?? node.width ?? node.style?.width ?? 180),
      height: Number(node.measured?.height ?? node.height ?? node.style?.height ?? 72),
    })
    const minX = Math.min(...drawableNodes.map((node) => node.position.x)) - 40
    const minY = Math.min(...drawableNodes.map((node) => node.position.y)) - 40
    const maxX = Math.max(...drawableNodes.map((node) => node.position.x + dimensions(node).width)) + 40
    const maxY = Math.max(...drawableNodes.map((node) => node.position.y + dimensions(node).height)) + 40
    const canvas = document.createElement('canvas')
    canvas.width = Math.min(2400, Math.max(640, Math.ceil(maxX - minX)))
    canvas.height = Math.min(1800, Math.max(420, Math.ceil(maxY - minY)))
    const context = canvas.getContext('2d')
    if (!context) return
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.strokeStyle = '#475569'
    context.lineWidth = 2
    edges.forEach((edge) => {
      const sourceNode = drawableNodes.find((node) => node.id === edge.source)
      const targetNode = drawableNodes.find((node) => node.id === edge.target)
      if (!sourceNode || !targetNode) return
      const sourceSize = dimensions(sourceNode)
      const targetSize = dimensions(targetNode)
      context.beginPath()
      context.moveTo(sourceNode.position.x - minX + sourceSize.width / 2, sourceNode.position.y - minY + sourceSize.height / 2)
      context.lineTo(targetNode.position.x - minX + targetSize.width / 2, targetNode.position.y - minY + targetSize.height / 2)
      context.stroke()
    })
    drawableNodes.forEach((node) => {
      const { width, height } = dimensions(node)
      const x = node.position.x - minX
      const y = node.position.y - minY
      context.fillStyle = '#ffffff'
      context.strokeStyle = '#334155'
      context.lineWidth = 1.5
      context.fillRect(x, y, width, height)
      context.strokeRect(x, y, width, height)
      context.fillStyle = '#0f172a'
      context.font = '14px Arial'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      const label = node.data.kind === 'element' || node.data.kind === 'boundary' || node.data.kind === 'note'
        ? node.data.title
        : node.id
      context.fillText(label, x + width / 2, y + height / 2, Math.max(40, width - 14))
    })
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    } catch {
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${diagramKey}.png`
      link.click()
      URL.revokeObjectURL(link.href)
    } finally {
      setCanvasMenu(null)
    }
  }, [diagramKey, edges, nodes])

  const applyCanvasLayout = useCallback((layout: 'horizontal' | 'vertical' | 'circle') => {
    const selected = nodes.filter((node) => node.selected && !node.parentNode)
    const targets = selected.length > 0
      ? selected
      : nodes.filter((node) => !node.parentNode && node.type !== 'archimateLegend')
    if (targets.length === 0) return
    const center = { x: 500, y: 360 }
    setNodes((current) => current.map((node) => {
      const index = targets.findIndex((target) => target.id === node.id)
      if (index < 0) return node
      if (layout === 'horizontal') return { ...node, position: { x: 120 + index * 260, y: center.y } }
      if (layout === 'vertical') return { ...node, position: { x: center.x, y: 100 + index * 150 } }
      const angle = (Math.PI * 2 * index) / targets.length - Math.PI / 2
      return { ...node, position: { x: center.x + Math.cos(angle) * 300, y: center.y + Math.sin(angle) * 220 } }
    }))
    setCanvasMenu(null)
  }, [nodes, setNodes])

  useEffect(() => {
    if (!editable) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        selectCanvasElements('all')
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'i') {
        event.preventDefault()
        selectCanvasElements('nodes')
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'e') {
        event.preventDefault()
        selectCanvasElements('edges')
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'r') {
        event.preventDefault()
        clearDefaultStyle()
        return
      }
      if (event.key === 'Escape') {
        setCanvasMenu(null)
        return
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      event.preventDefault()
      deleteSelected()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [clearDefaultStyle, deleteSelected, editable, selectCanvasElements])

  const clampStudioPanelPosition = useCallback((x: number, y: number, width: number, height: number) => {
    const zone = canvasZoneRef.current
    if (!zone) return { x, y }
    const maxX = Math.max(STUDIO_PANEL_INSET_PX, zone.clientWidth - width - STUDIO_PANEL_MARGIN_PX)
    const maxY = Math.max(STUDIO_PANEL_INSET_PX, zone.clientHeight - height - STUDIO_PANEL_MARGIN_PX)
    return {
      x: Math.min(Math.max(STUDIO_PANEL_INSET_PX, x), maxX),
      y: Math.min(Math.max(STUDIO_PANEL_INSET_PX, y), maxY),
    }
  }, [])

  const clampStudioPanelSize = useCallback((width: number, height: number, position = studioPanelPosition) => {
    const zone = canvasZoneRef.current
    const maxWidth = zone
      ? Math.max(STUDIO_PANEL_MIN_WIDTH_PX, zone.clientWidth - position.x - STUDIO_PANEL_MARGIN_PX)
      : STUDIO_PANEL_DEFAULT_WIDTH_PX
    const maxHeight = zone
      ? Math.max(STUDIO_PANEL_MIN_HEIGHT_PX, zone.clientHeight - position.y - STUDIO_PANEL_MARGIN_PX)
      : 480
    return {
      width: Math.min(Math.max(STUDIO_PANEL_MIN_WIDTH_PX, width), maxWidth),
      height: Math.min(Math.max(height > 0 ? height : maxHeight, STUDIO_PANEL_MIN_HEIGHT_PX), maxHeight),
    }
  }, [studioPanelPosition])

  useLayoutEffect(() => {
    setStudioPanelSize((current) => {
      const next = clampStudioPanelSize(current.width, current.height)
      return next.width === current.width && next.height === current.height ? current : next
    })
  }, [clampStudioPanelSize, isStudioPanelCollapsed])

  const clampPropertiesPanelPosition = useCallback((x: number, y: number, width: number, height: number) => {
    const zone = canvasZoneRef.current
    if (!zone) return { x, y }
    const maxX = Math.max(STUDIO_PANEL_INSET_PX, zone.clientWidth - width - STUDIO_PANEL_MARGIN_PX)
    const maxY = Math.max(STUDIO_PANEL_INSET_PX, zone.clientHeight - height - STUDIO_PANEL_MARGIN_PX)
    return {
      x: Math.min(Math.max(STUDIO_PANEL_INSET_PX, x), maxX),
      y: Math.min(Math.max(STUDIO_PANEL_INSET_PX, y), maxY),
    }
  }, [])

  const clampPropertiesPanelSize = useCallback((width: number, height: number, position: { x: number; y: number } | null) => {
    const zone = canvasZoneRef.current
    const left = position?.x ?? STUDIO_PANEL_INSET_PX
    const top = position?.y ?? STUDIO_PANEL_INSET_PX
    const maxWidth = zone
      ? Math.max(STUDIO_PANEL_MIN_WIDTH_PX, zone.clientWidth - left - STUDIO_PANEL_MARGIN_PX)
      : STUDIO_PANEL_DEFAULT_WIDTH_PX
    const maxHeight = zone
      ? Math.max(STUDIO_PANEL_MIN_HEIGHT_PX, zone.clientHeight - top - STUDIO_PANEL_MARGIN_PX)
      : 480
    return {
      width: Math.min(Math.max(STUDIO_PANEL_MIN_WIDTH_PX, width), maxWidth),
      height: Math.min(Math.max(height > 0 ? height : maxHeight, STUDIO_PANEL_MIN_HEIGHT_PX), maxHeight),
    }
  }, [])

  const handleStudioPanelDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    studioPanelDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: studioPanelPosition.x,
      originY: studioPanelPosition.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsStudioPanelDragging(true)
  }
  const handleStudioPanelDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = studioPanelDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const width = isStudioPanelCollapsed ? STUDIO_PANEL_COLLAPSED_WIDTH_PX : studioPanelSize.width
    const height = isStudioPanelCollapsed
      ? STUDIO_PANEL_COLLAPSED_HEIGHT_PX
      : (studioPanelSize.height || studioPanelShellRef.current?.offsetHeight || STUDIO_PANEL_MIN_HEIGHT_PX)
    setStudioPanelPosition(clampStudioPanelPosition(
      drag.originX + event.clientX - drag.startX,
      drag.originY + event.clientY - drag.startY,
      width,
      height,
    ))
  }
  const handleStudioPanelDragEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (studioPanelDragRef.current?.pointerId !== event.pointerId) return
    studioPanelDragRef.current = null
    setIsStudioPanelDragging(false)
  }

  const handleStudioPanelResizeStart = (edge: StudioPanelResizeEdge) => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    event.preventDefault()
    studioPanelResizeRef.current = {
      pointerId: event.pointerId,
      edge,
      startX: event.clientX,
      startY: event.clientY,
      originWidth: studioPanelSize.width,
      originHeight: studioPanelSize.height || studioPanelShellRef.current?.offsetHeight || STUDIO_PANEL_MIN_HEIGHT_PX,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsStudioPanelResizing(true)
  }
  const handleStudioPanelResizeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resize = studioPanelResizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    const deltaX = event.clientX - resize.startX
    const deltaY = event.clientY - resize.startY
    const nextWidth = resize.edge === 's' ? resize.originWidth : resize.originWidth + deltaX
    const nextHeight = resize.edge === 'e' ? resize.originHeight : resize.originHeight + deltaY
    setStudioPanelSize(clampStudioPanelSize(nextWidth, nextHeight))
  }
  const handleStudioPanelResizeEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (studioPanelResizeRef.current?.pointerId !== event.pointerId) return
    studioPanelResizeRef.current = null
    setIsStudioPanelResizing(false)
  }

  const handlePropertiesPanelDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    const origin = propertiesPanelPosition ?? { x: STUDIO_PANEL_INSET_PX, y: STUDIO_PANEL_INSET_PX }
    propertiesPanelDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsPropertiesPanelDragging(true)
  }
  const handlePropertiesPanelDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = propertiesPanelDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const height = propertiesPanelSize.height || propertiesPanelShellRef.current?.offsetHeight || STUDIO_PANEL_MIN_HEIGHT_PX
    setPropertiesPanelPosition(clampPropertiesPanelPosition(
      drag.originX + event.clientX - drag.startX,
      drag.originY + event.clientY - drag.startY,
      propertiesPanelSize.width,
      height,
    ))
  }
  const handlePropertiesPanelDragEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (propertiesPanelDragRef.current?.pointerId !== event.pointerId) return
    propertiesPanelDragRef.current = null
    setIsPropertiesPanelDragging(false)
  }

  const handlePropertiesPanelResizeStart = (edge: PropertiesPanelResizeEdge) => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    event.preventDefault()
    const origin = propertiesPanelPosition ?? { x: STUDIO_PANEL_INSET_PX, y: STUDIO_PANEL_INSET_PX }
    propertiesPanelResizeRef.current = {
      pointerId: event.pointerId,
      edge,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
      originWidth: propertiesPanelSize.width,
      originHeight: propertiesPanelSize.height || propertiesPanelShellRef.current?.offsetHeight || STUDIO_PANEL_MIN_HEIGHT_PX,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsPropertiesPanelResizing(true)
  }
  const handlePropertiesPanelResizeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resize = propertiesPanelResizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    const deltaX = event.clientX - resize.startX
    const deltaY = event.clientY - resize.startY
    const fromWest = resize.edge === 'w' || resize.edge === 'sw'
    const fromEast = resize.edge === 'e' || resize.edge === 'se'
    const fromSouth = resize.edge === 's' || resize.edge === 'sw' || resize.edge === 'se'
    const nextWidth = fromWest ? resize.originWidth - deltaX : fromEast ? resize.originWidth + deltaX : resize.originWidth
    const nextHeight = fromSouth ? resize.originHeight + deltaY : resize.originHeight
    const nextX = fromWest ? resize.originX + resize.originWidth - Math.max(STUDIO_PANEL_MIN_WIDTH_PX, nextWidth) : resize.originX
    const size = clampPropertiesPanelSize(nextWidth, nextHeight, { x: fromWest ? nextX : resize.originX, y: resize.originY })
    const anchoredX = fromWest ? resize.originX + resize.originWidth - size.width : resize.originX
    setPropertiesPanelSize(size)
    setPropertiesPanelPosition(clampPropertiesPanelPosition(anchoredX, resize.originY, size.width, size.height))
  }
  const handlePropertiesPanelResizeEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (propertiesPanelResizeRef.current?.pointerId !== event.pointerId) return
    propertiesPanelResizeRef.current = null
    setIsPropertiesPanelResizing(false)
  }

  const studioMode = Boolean(editable && fillHeight)
  const isC4 = format === 'c4'
  const hasSelectionInspector = Boolean(selectedNode && selectedNode.type !== 'archimateLegend') || Boolean(selectedEdgeId)

  useLayoutEffect(() => {
    if (!studioMode || !hasSelectionInspector) return
    const zone = canvasZoneRef.current
    if (!zone) return
    setPropertiesPanelSize((current) => {
      if (current.height > 0) return current
      return clampPropertiesPanelSize(current.width, 0, { x: STUDIO_PANEL_INSET_PX, y: STUDIO_PANEL_INSET_PX })
    })
    setPropertiesPanelPosition((current) => {
      if (current) return current
      return {
        x: Math.max(STUDIO_PANEL_INSET_PX, zone.clientWidth - STUDIO_PANEL_DEFAULT_WIDTH_PX - STUDIO_PANEL_MARGIN_PX),
        y: STUDIO_PANEL_INSET_PX,
      }
    })
  }, [clampPropertiesPanelSize, hasSelectionInspector, studioMode])

  const flowCanvas = (
    <IntegrationArchitectureFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={editable ? handleNodesChange : () => undefined}
      onEdgesChange={editable ? onEdgesChange : () => undefined}
      onConnect={editable ? onConnect : () => undefined}
      onEdgeUpdate={editable ? onEdgeUpdate : undefined}
      onSelectionChange={editable ? handleSelectionChange : () => undefined}
      onEdgeClick={editable ? handleEdgeClick : undefined}
      onPaneClick={editable ? clearCanvasSelection : undefined}
      onPaneContextMenu={editable ? handlePaneContextMenu : undefined}
      onNodeContextMenu={editable ? handlePaneContextMenu : undefined}
      onEdgeContextMenu={editable ? handlePaneContextMenu : undefined}
      showGrid={showGrid}
      showGuides={studioMode && showGuides}
      snapToGrid={studioMode && snapToGrid}
      showRuler={studioMode && showRuler}
      showConnectionArrows={showConnectionArrows}
      showConnectionPoints={studioMode && showConnectionPoints}
      preview={!editable}
      defaultViewport={editable ? savedViewport : undefined}
      onMoveEnd={editable ? (_event, viewport) => {
        const next = { x: viewport.x, y: viewport.y, zoom: viewport.zoom }
        viewportRef.current = next
        setSavedViewport(next)
        saveGraph(storageKey, { nodes, edges, source: sourceDraft, viewport: next, snapToGrid })
        if (!onPersistGraph) return
        if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current)
        persistTimerRef.current = window.setTimeout(() => {
          onPersistGraph({ nodes, edges, source: sourceDraft, viewport: next, snapToGrid })
        }, 700)
      } : undefined}
    />
  )

  if (!studioMode) {
    return (
      <div className={cn('relative h-full min-h-0 overflow-hidden rounded-lg bg-white/75', className)}>
        {flowCanvas}
      </div>
    )
  }

  const studioSidebarTabs = [
    { id: 'source' as const, label: 'Source', icon: PencilLine },
    { id: 'diagram' as const, label: 'Diagram', icon: Layers },
  ]
  const studioPanelTabClass = (active: boolean) =>
    cn(
      'flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors',
      active ? 'border-slate-900/80 text-slate-900' : 'border-transparent text-slate-600 hover:text-slate-800',
    )

  const selectionInspector =
    selectedNode && selectedNode.type !== 'archimateLegend' ? (
      <IntegrationNodePropertiesPanel
        selectedNode={selectedNode as Node<ArchimateNodeData>}
        onUpdateData={updateSelectedNodeData}
        onUpdateSize={updateSelectedNodeSize}
        onUpdatePosition={updateSelectedNodePosition}
        onLayerAction={handleLayerAction}
        onRotate90={handleRotateSelectedNode90}
        dragHandleProps={{
          isDragging: isPropertiesPanelDragging,
          onPointerDown: handlePropertiesPanelDragStart,
          onPointerMove: handlePropertiesPanelDragMove,
          onPointerUp: handlePropertiesPanelDragEnd,
          onPointerCancel: handlePropertiesPanelDragEnd,
        }}
      />
    ) : selectedEdge ? (
      <DiagramEdgePropertiesPanel
        edge={selectedEdge}
        onChange={updateSelectedEdge}
        onDelete={deleteSelected}
        onClearWaypoints={clearSelectedEdgeWaypoints}
        dragHandleProps={{
          isDragging: isPropertiesPanelDragging,
          onPointerDown: handlePropertiesPanelDragStart,
          onPointerMove: handlePropertiesPanelDragMove,
          onPointerUp: handlePropertiesPanelDragEnd,
          onPointerCancel: handlePropertiesPanelDragEnd,
        }}
      />
    ) : null

  return (
    <div className={cn('relative flex h-full min-h-0 flex-col overflow-hidden border border-border/40', className)}>
      {!hideStudioHeader ? (
        <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3">
          <p className="text-xs font-medium text-slate-700">Process diagram</p>
        </div>
      ) : null}
      <div ref={canvasZoneRef} className="relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={reactFlowWrapperRef}
          className="absolute inset-0 overflow-hidden rounded-2xl border border-white/60 bg-white/75 backdrop-blur-xl"
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
        >
          {flowCanvas}
          {canvasMenu ? (
            <div
              className="absolute z-50 w-64 rounded-md border border-slate-200 bg-white py-1 text-sm text-slate-700 shadow-xl"
              style={{ left: Math.max(8, canvasMenu.x), top: Math.max(8, canvasMenu.y) }}
              onContextMenu={(event) => event.preventDefault()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={() => void pasteSourceAtCursor()}>
                <Copy className="h-4 w-4" /> Paste here
              </button>
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={() => void copyCanvasAsImage()}>
                <ImageDown className="h-4 w-4" /> Copy as image
              </button>
              <div className="my-1 border-t border-slate-200" />
              <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100" onClick={clearDefaultStyle}>
                <span className="flex items-center gap-2"><Paintbrush className="h-4 w-4" /> Clear default style</span><span className="text-xs text-slate-400">Ctrl+Shift+R</span>
              </button>
              <div className="my-1 border-t border-slate-200" />
              <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100" onClick={() => selectCanvasElements('nodes')}>
                <span className="flex items-center gap-2"><MousePointer2 className="h-4 w-4" /> Select vertices</span><span className="text-xs text-slate-400">Ctrl+Shift+I</span>
              </button>
              <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100" onClick={() => selectCanvasElements('edges')}>
                <span className="flex items-center gap-2"><Waypoints className="h-4 w-4" /> Select edges</span><span className="text-xs text-slate-400">Ctrl+Shift+E</span>
              </button>
              <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100" onClick={() => selectCanvasElements('all')}>
                <span className="flex items-center gap-2"><ListChecks className="h-4 w-4" /> Select all</span><span className="text-xs text-slate-400">Ctrl+A</span>
              </button>
              <div className="my-1 border-t border-slate-200" />
              <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100" onClick={() => setSnapToGrid((current) => !current)}>
                <span className="flex items-center gap-2"><Magnet className="h-4 w-4" /> Snap to grid</span>
                <span className="w-4 text-sky-500">{snapToGrid ? <Check className="h-4 w-4" /> : null}</span>
              </button>
              <div className="relative" onMouseEnter={() => setCanvasMenu((current) => current ? { ...current, submenu: 'options' } : current)}>
                <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100">
                  <span className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Options</span><ChevronRight className="h-4 w-4" />
                </button>
                {canvasMenu.submenu === 'options' ? (
                  <div className="absolute left-full top-0 w-64 rounded-md border border-slate-200 bg-white py-1 shadow-xl">
                    {[
                      ['Grid', showGrid, setShowGrid, Grid3X3],
                      ['Snap to grid', snapToGrid, setSnapToGrid, Magnet],
                      ['Guides', showGuides, setShowGuides, MousePointer2],
                      ['Ruler', showRuler, setShowRuler, Ruler],
                      ['Connection arrows', showConnectionArrows, setShowConnectionArrows, ArrowRight],
                      ['Connection points', showConnectionPoints, setShowConnectionPoints, Crosshair],
                    ].map(([label, enabled, setter, Icon]) => (
                      <button
                        type="button"
                        key={label as string}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100"
                        onClick={() => (setter as (value: boolean) => void)(!(enabled as boolean))}
                      >
                        <span className="w-4 text-sky-500">{enabled ? <Check className="h-4 w-4" /> : null}</span>
                        {Icon ? <Icon className="h-4 w-4 text-slate-500" /> : null}{label as string}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="relative" onMouseEnter={() => setCanvasMenu((current) => current ? { ...current, submenu: 'layout' } : current)}>
                <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100">
                  <span className="flex items-center gap-2"><LayoutTemplate className="h-4 w-4" /> Layout</span><ChevronRight className="h-4 w-4" />
                </button>
                {canvasMenu.submenu === 'layout' ? (
                  <div className="absolute bottom-0 left-full w-56 rounded-md border border-slate-200 bg-white py-1 shadow-xl">
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={() => applyCanvasLayout('horizontal')}><ArrowRightLeft className="h-4 w-4" />Horizontal flow</button>
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={() => applyCanvasLayout('vertical')}><ArrowDown className="h-4 w-4" />Vertical flow</button>
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={() => applyCanvasLayout('circle')}><Circle className="h-4 w-4" />Circle</button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div
          ref={studioPanelShellRef}
          className="pointer-events-none absolute z-30"
          style={{
            left: studioPanelPosition.x,
            top: studioPanelPosition.y,
            width: isStudioPanelCollapsed ? STUDIO_PANEL_COLLAPSED_WIDTH_PX : studioPanelSize.width,
            height: isStudioPanelCollapsed
              ? STUDIO_PANEL_COLLAPSED_HEIGHT_PX
              : (studioPanelSize.height || `calc(100% - ${STUDIO_PANEL_INSET_PX + STUDIO_PANEL_MARGIN_PX}px)`),
          }}
        >
          <aside
            className={cn(
              'pointer-events-auto relative flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border liquid-glass-enterprise-panel',
              (isStudioPanelDragging || isStudioPanelResizing) && 'shadow-2xl ring-1 ring-white/50',
            )}
          >
            <div className="relative flex shrink-0 border-b border-white/35 bg-white/15">
              <div
                role="button"
                tabIndex={0}
                aria-label="Geser panel Source"
                className={cn(
                  'flex shrink-0 touch-none cursor-grab select-none items-center border-r border-white/25 px-2 active:cursor-grabbing',
                  isStudioPanelDragging && 'cursor-grabbing',
                )}
                onPointerDown={handleStudioPanelDragStart}
                onPointerMove={handleStudioPanelDragMove}
                onPointerUp={handleStudioPanelDragEnd}
                onPointerCancel={handleStudioPanelDragEnd}
              >
                <GripVertical className="h-4 w-4 text-slate-500" />
              </div>
              {isStudioPanelCollapsed ? (
                <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 truncate px-2 text-xs font-semibold text-slate-700">
                  Menu
                </span>
              ) : null}
              {!isStudioPanelCollapsed
                ? studioSidebarTabs.map((tab) => {
                    const Icon = tab.icon
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        className={studioPanelTabClass(sidebarPanel === tab.id)}
                        onClick={() => setSidebarPanel(tab.id)}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {tab.label}
                      </button>
                    )
                  })
                : null}
              <button
                type="button"
                className="ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center text-slate-500 transition hover:bg-white/25 hover:text-slate-800"
                onClick={() => setIsStudioPanelCollapsed((current) => !current)}
                aria-expanded={!isStudioPanelCollapsed}
                aria-label={isStudioPanelCollapsed ? 'Expand Source and Diagram panel' : 'Collapse Source and Diagram panel'}
              >
                {isStudioPanelCollapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
              </button>
            </div>
            {!isStudioPanelCollapsed ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {sidebarPanel === 'source' ? (
                  <PlantUmlSourceEditor
                    value={sourceDraft}
                    onChange={setSourceDraft}
                    onBlur={applySource}
                    languageLabel={format === 'bpmn' ? 'BPMN PlantUML' : format === 'c4' ? 'C4 PlantUML' : 'PlantUML'}
                  />
                ) : isC4 ? (
                  <C4NotationPalette onDragStart={handlePaletteDragStart} />
                ) : format === 'bpmn' ? (
                  <BpmnNotationPalette
                    onDragStart={handleBpmnPaletteDragStart}
                    selectedFlowType={bpmnFlowType}
                    onSelectFlow={(item) => setBpmnFlowType(item.bpmnType)}
                  />
                ) : (
                  <div className="flex flex-1 items-center justify-center px-6 text-center text-xs leading-5 text-slate-500">
                    Pilih dan geser node langsung di canvas. Gunakan handle untuk membuat koneksi.
                  </div>
                )}
              </div>
            ) : null}
          </aside>
          {!isStudioPanelCollapsed ? (
            <>
              <div
                role="separator"
                aria-label="Ubah lebar panel"
                aria-orientation="vertical"
                className="pointer-events-auto absolute inset-y-3 right-0 z-40 w-1.5 cursor-ew-resize rounded-full hover:bg-sky-400/40"
                onPointerDown={handleStudioPanelResizeStart('e')}
                onPointerMove={handleStudioPanelResizeMove}
                onPointerUp={handleStudioPanelResizeEnd}
                onPointerCancel={handleStudioPanelResizeEnd}
              />
              <div
                role="separator"
                aria-label="Ubah tinggi panel"
                aria-orientation="horizontal"
                className="pointer-events-auto absolute inset-x-3 bottom-0 z-40 h-1.5 cursor-ns-resize rounded-full hover:bg-sky-400/40"
                onPointerDown={handleStudioPanelResizeStart('s')}
                onPointerMove={handleStudioPanelResizeMove}
                onPointerUp={handleStudioPanelResizeEnd}
                onPointerCancel={handleStudioPanelResizeEnd}
              />
              <div
                role="separator"
                aria-label="Ubah ukuran panel"
                className="pointer-events-auto absolute bottom-0 right-0 z-40 h-3.5 w-3.5 cursor-nwse-resize"
                onPointerDown={handleStudioPanelResizeStart('se')}
                onPointerMove={handleStudioPanelResizeMove}
                onPointerUp={handleStudioPanelResizeEnd}
                onPointerCancel={handleStudioPanelResizeEnd}
              />
            </>
          ) : null}
        </div>

        {hasSelectionInspector ? (
          <div
            ref={propertiesPanelShellRef}
            className="pointer-events-none absolute z-20"
            style={{
              left: propertiesPanelPosition?.x,
              top: propertiesPanelPosition?.y ?? STUDIO_PANEL_INSET_PX,
              right: propertiesPanelPosition ? undefined : STUDIO_PANEL_MARGIN_PX,
              width: propertiesPanelSize.width,
              height: propertiesPanelSize.height || `calc(100% - ${STUDIO_PANEL_INSET_PX + STUDIO_PANEL_MARGIN_PX}px)`,
            }}
          >
            <aside
              className={cn(
                'pointer-events-auto relative flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border liquid-glass-enterprise-panel',
                (isPropertiesPanelDragging || isPropertiesPanelResizing) && 'shadow-2xl ring-1 ring-white/50',
              )}
            >
              <div className="min-h-0 flex-1">{selectionInspector}</div>
            </aside>
            <div
              role="separator"
              aria-label="Ubah lebar panel Properties dari kiri"
              aria-orientation="vertical"
              className="pointer-events-auto absolute inset-y-3 left-0 z-40 w-1.5 cursor-ew-resize rounded-full hover:bg-sky-400/40"
              onPointerDown={handlePropertiesPanelResizeStart('w')}
              onPointerMove={handlePropertiesPanelResizeMove}
              onPointerUp={handlePropertiesPanelResizeEnd}
              onPointerCancel={handlePropertiesPanelResizeEnd}
            />
            <div
              role="separator"
              aria-label="Ubah lebar panel Properties"
              aria-orientation="vertical"
              className="pointer-events-auto absolute inset-y-3 right-0 z-40 w-1.5 cursor-ew-resize rounded-full hover:bg-sky-400/40"
              onPointerDown={handlePropertiesPanelResizeStart('e')}
              onPointerMove={handlePropertiesPanelResizeMove}
              onPointerUp={handlePropertiesPanelResizeEnd}
              onPointerCancel={handlePropertiesPanelResizeEnd}
            />
            <div
              role="separator"
              aria-label="Ubah tinggi panel Properties"
              aria-orientation="horizontal"
              className="pointer-events-auto absolute inset-x-3 bottom-0 z-40 h-1.5 cursor-ns-resize rounded-full hover:bg-sky-400/40"
              onPointerDown={handlePropertiesPanelResizeStart('s')}
              onPointerMove={handlePropertiesPanelResizeMove}
              onPointerUp={handlePropertiesPanelResizeEnd}
              onPointerCancel={handlePropertiesPanelResizeEnd}
            />
            <div
              role="separator"
              aria-label="Ubah ukuran panel Properties"
              className="pointer-events-auto absolute bottom-0 left-0 z-40 h-3.5 w-3.5 cursor-nesw-resize"
              onPointerDown={handlePropertiesPanelResizeStart('sw')}
              onPointerMove={handlePropertiesPanelResizeMove}
              onPointerUp={handlePropertiesPanelResizeEnd}
              onPointerCancel={handlePropertiesPanelResizeEnd}
            />
            <div
              role="separator"
              aria-label="Ubah ukuran panel Properties"
              className="pointer-events-auto absolute bottom-0 right-0 z-40 h-3.5 w-3.5 cursor-nwse-resize"
              onPointerDown={handlePropertiesPanelResizeStart('se')}
              onPointerMove={handlePropertiesPanelResizeMove}
              onPointerUp={handlePropertiesPanelResizeEnd}
              onPointerCancel={handlePropertiesPanelResizeEnd}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function EditableDiagramCanvas(props: EditableDiagramCanvasProps) {
  return (
    <ReactFlowProvider>
      <EditableDiagramCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
