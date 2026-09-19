import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { AppWindow, ArrowDown, ArrowRight, ArrowRightLeft, Check, ChevronRight, ChevronsDown, ChevronsLeft, ChevronsRight, ChevronsUp, Circle, Copy, Crosshair, ExternalLink, Grid3X3, GripVertical, ImageDown, Layers, LayoutTemplate, Link2, ListChecks, Magnet, MousePointer2, Paintbrush, PencilLine, Ruler, Scissors, Settings2, Trash2, Unlink, Waypoints } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BpmnNotationPalette } from '@/modules/project-management/components/BpmnNotationPalette'
import { C4ApplicationCatalogPalette } from '@/modules/project-management/components/C4ApplicationCatalogPalette'
import { C4NotationPalette } from '@/modules/project-management/components/C4NotationPalette'
import { DiagramEdgePropertiesPanel } from '@/modules/project-management/components/DiagramEdgePropertiesPanel'
import { IntegrationArchitectureFlow } from '@/modules/project-management/components/IntegrationArchitectureFlow'
import { IntegrationNodePropertiesPanel } from '@/modules/project-management/components/IntegrationNodePropertiesPanel'
import { PlantUmlSourceEditor } from '@/modules/project-management/components/PlantUmlSourceEditor'
import { BPMN_PALETTE_MIME, createBpmnNodeFromPaletteItem, type BpmnPaletteItem } from '@/modules/project-management/lib/bpmnNotationPalette'
import { C4_APPLICATION_CATALOG_MIME, C4_PALETTE_MIME, createC4NodeFromApplicationCatalog, createC4NodeFromPaletteItem, type C4ApplicationCatalogItem, type C4PaletteItem } from '@/modules/project-management/lib/c4NotationPalette'
import { isArchimateElementData, type ArchimateElementNodeData, type ArchimateNodeData } from '@/modules/project-management/lib/integrationArchitectureTypes'
import { c4LevelFromDiagramKey, c4Stereotype, isC4External, normalizeC4PlantUml, parseC4Graph, serializeC4Graph, type C4ElementKind, type C4ParsedGraph } from '@/modules/project-management/lib/c4PlantUml'
import { isCanvasViewport, type CanvasViewport } from '@/modules/project-management/lib/integrationGraphStorage'
import { defaultIntegrationNodeTextStyle, defaultIntegrationNodeVisual } from '@/modules/project-management/lib/integrationNodeAppearance'
import { pickCenteredAnchoredHandles, type NodeGeometry } from '@/modules/project-management/lib/parsePlantUmlToIntegrationGraph'
import { parseBpmnSource, serializeBpmnCanvasToPlantUml, toBpmnEditorSource } from '@/modules/project-management/lib/bpmnPlantUml'
import { bpmnDefaultLineColor, bpmnNodeSizeForType, isBpmnSquareShape } from '@/modules/project-management/lib/bpmnNotationSpec'
import { useTenantContextOptional } from '@/auth/TenantContext'
import { listAllKbEntries } from '@/lib/api/tectonaKbApi'
import { parseSystemKbTableContent } from '@/lib/kb/systemKbTableEditor'
import { belongsToActiveWorkspaceScope, buildWorkspaceScopeFromTenant } from '@/lib/tenantWorkspaceScope'
import { jsPDF } from 'jspdf'

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

function c4RelationEdgeStyle(): Pick<Edge, 'style' | 'markerEnd' | 'markerStart' | 'data'> {
  return {
    markerStart: undefined,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b', width: 9, height: 9 },
    style: { stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '4 4' },
    data: {
      visual: {
        lineEnabled: true,
        lineColor: '#64748b',
        lineWidth: 1.5,
        lineStyle: 'dashed',
        startArrow: 'none',
        endArrow: 'classic',
        startFill: false,
        endFill: true,
        startSize: 6,
        endSize: 6,
        waypoints: 'sharp',
      },
    },
  }
}

function normalizeC4RelationEdges(edges: Edge[]): Edge[] {
  const relatedPairs = new Set<string>()
  return edges.flatMap((edge) => {
    const pair = [edge.source, edge.target].sort().join('\u0000')
    if (relatedPairs.has(pair)) return []
    relatedPairs.add(pair)
    return [{
      ...edge,
      ...c4RelationEdgeStyle(),
      data: {
        ...(edge.data as Record<string, unknown> | undefined),
        ...c4RelationEdgeStyle().data,
      },
    }]
  })
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
        ...c4RelationEdgeStyle(),
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
  const merged = next.map((node) => {
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
  const generatedIds = new Set(merged.map((node) => node.id))
  const decorations = previous.filter((node) => (
    !generatedIds.has(node.id) && (node.type === 'archimateNote' || node.type === 'archimateImage')
  ))
  return [...merged, ...decorations]
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

type StudioSidebarPanel = 'source' | 'catalog' | 'diagram'
type CanvasMenuSubmenu = 'options' | 'layout' | null
type CanvasContextMenuState = {
  x: number
  y: number
  flowPosition: { x: number; y: number }
  submenu: CanvasMenuSubmenu
}

export type C4DiagramDrilldownTarget = {
  diagramKey: string
  title: string
  description: string
  matchNodeTitle?: string
}

type C4NodeContextMenuState = {
  nodeId: string
  x: number
  y: number
  submenu?: 'order'
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
  c4DrilldownTargets?: C4DiagramDrilldownTarget[]
  onOpenC4Drilldown?: (diagramKey: string) => void
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
  c4DrilldownTargets = [],
  onOpenC4Drilldown,
}: EditableDiagramCanvasProps) {
  const { screenToFlowPosition } = useReactFlow()
  const tenant = useTenantContextOptional()
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
      const savedEdges = format === 'c4' ? normalizeC4RelationEdges(savedGraph.edges) : savedGraph.edges
      return { ...savedGraph, edges: withFacingHandles(savedGraph.nodes, savedEdges) }
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
    const storedEdges = format === 'c4' ? normalizeC4RelationEdges(stored.edges) : stored.edges
    return { ...stored, edges: withFacingHandles(stored.nodes, storedEdges) }
  }, [editable, format, imported, savedGraph, storageKey])
  const [nodes, setNodes, onNodesChange] = useNodesState<ArchimateNodeData>(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [sidebarPanel, setSidebarPanel] = useState<StudioSidebarPanel>(format === 'c4' ? 'diagram' : 'source')
  const [sourceDraft, setSourceDraft] = useState(() => (format === 'bpmn' ? toBpmnEditorSource(c4Source) : c4Source))
  const c4Level = c4LevelFromDiagramKey(diagramKey)
  const applicationCatalogScope = useMemo(() => tenant ? buildWorkspaceScopeFromTenant(tenant) : null, [tenant])
  const [applicationCatalog, setApplicationCatalog] = useState<C4ApplicationCatalogItem[]>([])
  const [applicationCatalogLoading, setApplicationCatalogLoading] = useState(false)
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
  const [c4NodeMenu, setC4NodeMenu] = useState<C4NodeContextMenuState | null>(null)
  const [c4LinkPickerNodeId, setC4LinkPickerNodeId] = useState<string | null>(null)
  const [selectedC4DrilldownKey, setSelectedC4DrilldownKey] = useState<string | null>(null)
  const [defaultElementStyle, setDefaultElementStyle] = useState<Pick<ArchimateElementNodeData, 'visual' | 'textStyle'> | null>(null)
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
  const imageInputRef = useRef<HTMLInputElement | null>(null)
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
  const nodeClipboardRef = useRef<Node<ArchimateNodeData> | null>(null)
  const appliedSavedGraphRef = useRef(false)

  useEffect(() => {
    if (format !== 'c4' || c4Level !== 'L1') return
    let active = true
    setApplicationCatalogLoading(true)
    void listAllKbEntries()
      .then(({ items }) => {
        if (!active) return
        const seen = new Set<string>()
        const applications: C4ApplicationCatalogItem[] = []
        items
          .filter((entry) => entry.is_active && entry.category === 'application_catalog')
          .filter((entry) => !applicationCatalogScope || belongsToActiveWorkspaceScope(entry.workspace_id, applicationCatalogScope))
          .forEach((entry) => {
            const catalog = parseSystemKbTableContent(entry.title, entry.content)
            if (catalog?.specId !== 'aplikasi') return
            catalog.rows.forEach((row) => {
              const name = row.name?.trim()
              if (!name || row.status === 'Inactive' || seen.has(name.toLowerCase())) return
              seen.add(name.toLowerCase())
              applications.push({
                name,
                type: row.type?.trim() || 'Application',
                description: row.description?.trim() || '',
                classification: 'System',
              })
            })
          })
        setApplicationCatalog(applications.sort((left, right) => left.name.localeCompare(right.name)))
      })
      .catch(() => { if (active) setApplicationCatalog([]) })
      .finally(() => { if (active) setApplicationCatalogLoading(false) })
    return () => { active = false }
  }, [applicationCatalogScope, c4Level, format])

  const applyDefaultElementStyle = useCallback((node: Node<ArchimateNodeData>): Node<ArchimateNodeData> => {
    if (!defaultElementStyle || node.data.kind !== 'element') return node
    return {
      ...node,
      data: {
        ...node.data,
        visual: defaultElementStyle.visual ? { ...defaultElementStyle.visual } : node.data.visual,
        textStyle: defaultElementStyle.textStyle ? { ...defaultElementStyle.textStyle } : node.data.textStyle,
      },
    }
  }, [defaultElementStyle])

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
    if (format !== 'c4' || c4Level !== 'L1' || c4DrilldownTargets.length === 0) return
    const normalizeTitle = (value: string) => value.trim().toLocaleLowerCase()
    setNodes((current) => {
      let changed = false
      const next = current.map((node) => {
        if (node.type !== 'c4Element' || node.data.kind !== 'element' || node.data.diagramLink || node.data.diagramLinkCleared) return node
        const target = c4DrilldownTargets.find((item) => (
          item.matchNodeTitle && normalizeTitle(item.matchNodeTitle) === normalizeTitle(node.data.title)
        ))
        if (!target) return node
        changed = true
        return {
          ...node,
          data: { ...node.data, diagramLink: target.diagramKey, diagramLinkCleared: false },
        }
      })
      return changed ? next : current
    })
  }, [c4DrilldownTargets, c4Level, format, setNodes])
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
      ...(format === 'c4'
        ? c4RelationEdgeStyle()
        : bpmnConnectEdgeStyle(format === 'bpmn' ? bpmnFlowType : 'sequenceFlow')),
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
    setC4NodeMenu(null)
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

  const addApplicationCatalogNode = useCallback((application: C4ApplicationCatalogItem, position?: { x: number; y: number }) => {
    const wrapper = reactFlowWrapperRef.current
    const bounds = wrapper?.getBoundingClientRect()
    const fallbackPosition = bounds
      ? screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 })
      : { x: 360, y: 240 }
    const nextPosition = position ?? fallbackPosition
    const newNode = applyDefaultElementStyle(createC4NodeFromApplicationCatalog(application, nextPosition, nodes.map((node) => node.id)))
    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), newNode])
    setSelectedNodeId(newNode.id)
    setSelectedEdgeId(null)
  }, [applyDefaultElementStyle, nodes, screenToFlowPosition, setNodes])

  const canvasCenterPosition = useCallback(() => {
    const bounds = reactFlowWrapperRef.current?.getBoundingClientRect()
    return bounds
      ? screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 })
      : { x: 360, y: 240 }
  }, [screenToFlowPosition])

  const addCanvasText = useCallback(() => {
    const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const newNode: Node<ArchimateNodeData> = {
      id,
      type: 'archimateNote',
      position: canvasCenterPosition(),
      style: { width: 220, height: 100 },
      data: {
        kind: 'note',
        title: 'Text',
        lines: ['Edit this text in the properties panel.'],
      },
    }
    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), newNode])
    setSelectedNodeId(id)
    setSelectedEdgeId(null)
  }, [canvasCenterPosition, setNodes])

  const requestImageInsert = useCallback(() => imageInputRef.current?.click(), [])

  const handleImageInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const id = `image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const newNode: Node<ArchimateNodeData> = {
        id,
        type: 'archimateImage',
        position: canvasCenterPosition(),
        style: { width: 260, height: 180 },
        data: {
          kind: 'image',
          src: String(reader.result),
          alt: file.name,
        },
      }
      setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), newNode])
      setSelectedNodeId(id)
      setSelectedEdgeId(null)
    }
    reader.readAsDataURL(file)
  }, [canvasCenterPosition, setNodes])

  const focusApplicationCatalogNode = useCallback((application: C4ApplicationCatalogItem) => {
    const node = nodes.find((item) => item.data.kind === 'element' && item.data.title.trim().toLowerCase() === application.name.trim().toLowerCase())
    if (!node) return
    setNodes((current) => current.map((item) => ({ ...item, selected: item.id === node.id })))
    setSelectedNodeId(node.id)
    setSelectedEdgeId(null)
  }, [nodes, setNodes])

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
        const newNode = applyDefaultElementStyle(createBpmnNodeFromPaletteItem(item, position, nodes.map((node) => node.id)))
        setNodes((current) => [...current, newNode])
        setSelectedNodeId(newNode.id)
        setSelectedEdgeId(null)
        return
      }
      const applicationRaw = event.dataTransfer.getData(C4_APPLICATION_CATALOG_MIME)
      if (applicationRaw) {
        let application: C4ApplicationCatalogItem
        try {
          application = JSON.parse(applicationRaw) as C4ApplicationCatalogItem
        } catch {
          return
        }
        if (!application.name?.trim()) return
        const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
        addApplicationCatalogNode(application, position)
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
      const newNode = applyDefaultElementStyle(createC4NodeFromPaletteItem(item, position, nodes.map((node) => node.id)))
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
    [addApplicationCatalogNode, applyDefaultElementStyle, nodes, screenToFlowPosition, setNodes],
  )

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) ?? null : null),
    [nodes, selectedNodeId],
  )
  const selectedEdge = useMemo(
    () => (selectedEdgeId ? edges.find((edge) => edge.id === selectedEdgeId) ?? null : null),
    [edges, selectedEdgeId],
  )
  const selectedElementCount = useMemo(
    () => nodes.filter((node) => node.selected).length + edges.filter((edge) => edge.selected).length,
    [edges, nodes],
  )
  const c4MenuNode = useMemo(
    () => (c4NodeMenu ? nodes.find((node) => node.id === c4NodeMenu.nodeId) ?? null : null),
    [c4NodeMenu, nodes],
  )
  const c4LinkedDiagramKey = c4MenuNode && isArchimateElementData(c4MenuNode.data)
    ? c4MenuNode.data.diagramLink
    : undefined
  const c4LinkedTarget = useMemo(
    () => (c4LinkedDiagramKey ? c4DrilldownTargets.find((target) => target.diagramKey === c4LinkedDiagramKey) ?? null : null),
    [c4DrilldownTargets, c4LinkedDiagramKey],
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

  const copyNodeToClipboard = useCallback((nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId)
    if (!node) return
    nodeClipboardRef.current = structuredClone(node)
    setC4NodeMenu(null)
  }, [nodes])

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((current) => current.filter((node) => node.id !== nodeId))
    setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setC4NodeMenu(null)
  }, [setEdges, setNodes])

  const duplicateNode = useCallback((nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId)
    if (!node) return
    const id = `${node.id}-copy-${crypto.randomUUID()}`
    const duplicate: Node<ArchimateNodeData> = {
      ...structuredClone(node),
      id,
      position: { x: node.position.x + 32, y: node.position.y + 32 },
      selected: true,
    }
    setNodes((current) => [...current.map((item) => ({ ...item, selected: false })), duplicate])
    setSelectedNodeId(id)
    setSelectedEdgeId(null)
    setC4NodeMenu(null)
  }, [nodes, setNodes])

  const pasteCopiedNode = useCallback(() => {
    const copied = nodeClipboardRef.current
    if (!copied) return
    const id = `${copied.id}-copy-${crypto.randomUUID()}`
    const duplicate: Node<ArchimateNodeData> = {
      ...structuredClone(copied),
      id,
      position: { x: copied.position.x + 32, y: copied.position.y + 32 },
      selected: true,
    }
    setNodes((current) => [...current.map((item) => ({ ...item, selected: false })), duplicate])
    setSelectedNodeId(id)
    setSelectedEdgeId(null)
  }, [setNodes])

  const setNodeAsDefaultStyle = useCallback((nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId)
    if (!node || node.data.kind !== 'element') return
    setDefaultElementStyle({
      visual: node.data.visual ? { ...node.data.visual } : undefined,
      textStyle: node.data.textStyle ? { ...node.data.textStyle } : undefined,
    })
    setC4NodeMenu(null)
  }, [nodes])

  const handlePaneContextMenu = useCallback((event: ReactMouseEvent | MouseEvent) => {
    event.preventDefault()
    setC4NodeMenu(null)
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

  const handleNodeContextMenu = useCallback((event: ReactMouseEvent | MouseEvent, node: Node<ArchimateNodeData>) => {
    event.preventDefault()
    const wrapper = reactFlowWrapperRef.current
    if (!wrapper) return
    const bounds = wrapper.getBoundingClientRect()
    setCanvasMenu(null)
    setNodes((current) => current.map((item) => ({ ...item, selected: item.id === node.id })))
    setEdges((current) => current.map((edge) => ({ ...edge, selected: false })))
    setSelectedNodeId(node.id)
    setSelectedEdgeId(null)
    setC4NodeMenu({
      nodeId: node.id,
      x: Math.min(event.clientX - bounds.left, bounds.width - 260),
      y: Math.min(event.clientY - bounds.top, bounds.height - 360),
    })
  }, [setEdges, setNodes])

  const setC4NodeDrilldown = useCallback((nodeId: string, diagramKey: string | null) => {
    setNodes((current) => current.map((node) => {
      if (node.id !== nodeId || node.data.kind !== 'element') return node
      return {
        ...node,
        data: {
          ...node.data,
          diagramLink: diagramKey ?? undefined,
          diagramLinkCleared: diagramKey === null,
        },
      }
    }))
  }, [setNodes])

  const openC4LinkPicker = useCallback((nodeId: string) => {
    setC4NodeMenu(null)
    setC4LinkPickerNodeId(nodeId)
    setSelectedC4DrilldownKey(c4DrilldownTargets[0]?.diagramKey ?? null)
  }, [c4DrilldownTargets])

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
    if (!canvasMenu) return
    const copiedNode = nodeClipboardRef.current
    if (copiedNode) {
      const id = `${copiedNode.id}-copy-${crypto.randomUUID()}`
      const pastedNode: Node<ArchimateNodeData> = {
        ...structuredClone(copiedNode),
        id,
        parentNode: undefined,
        extent: undefined,
        position: { ...canvasMenu.flowPosition },
        selected: true,
      }
      setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), pastedNode])
      setEdges((current) => current.map((edge) => ({ ...edge, selected: false })))
      setSelectedNodeId(id)
      setSelectedEdgeId(null)
      setCanvasMenu(null)
      return
    }
    if (!navigator.clipboard?.readText) return
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

  const renderCanvasImage = useCallback((nodeIds?: string[]) => {
    const selectedIds = nodeIds ? new Set(nodeIds) : null
    const drawableNodes = nodes.filter((node) => node.type !== 'archimateLegend' && (!selectedIds || selectedIds.has(node.id)))
    if (drawableNodes.length === 0) return null
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
    if (!context) return null
    const roundedRect = (x: number, y: number, width: number, height: number, radius: number) => {
      const safeRadius = Math.min(radius, width / 2, height / 2)
      context.beginPath()
      context.moveTo(x + safeRadius, y)
      context.lineTo(x + width - safeRadius, y)
      context.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
      context.lineTo(x + width, y + height - safeRadius)
      context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
      context.lineTo(x + safeRadius, y + height)
      context.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
      context.lineTo(x, y + safeRadius)
      context.quadraticCurveTo(x, y, x + safeRadius, y)
      context.closePath()
    }
    const wrapText = (text: string, maxWidth: number) => {
      const words = text.trim().split(/\s+/).filter(Boolean)
      const lines: string[] = []
      let line = ''
      words.forEach((word) => {
        const next = line ? `${line} ${word}` : word
        if (line && context.measureText(next).width > maxWidth) {
          lines.push(line)
          line = word
        } else line = next
      })
      if (line) lines.push(line)
      return lines
    }
    const isDarkColor = (color: string) => {
      const match = /^#([\da-f]{6})$/i.exec(color)
      if (!match) return false
      const value = Number.parseInt(match[1], 16)
      const red = value >> 16
      const green = (value >> 8) & 255
      const blue = value & 255
      return (red * 299 + green * 587 + blue * 114) / 1000 < 145
    }
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    edges.forEach((edge) => {
      const sourceNode = drawableNodes.find((node) => node.id === edge.source)
      const targetNode = drawableNodes.find((node) => node.id === edge.target)
      if (!sourceNode || !targetNode) return
      const sourceSize = dimensions(sourceNode)
      const targetSize = dimensions(targetNode)
      const sourceCenter = { x: sourceNode.position.x - minX + sourceSize.width / 2, y: sourceNode.position.y - minY + sourceSize.height / 2 }
      const targetCenter = { x: targetNode.position.x - minX + targetSize.width / 2, y: targetNode.position.y - minY + targetSize.height / 2 }
      const horizontal = Math.abs(targetCenter.x - sourceCenter.x) >= Math.abs(targetCenter.y - sourceCenter.y)
      const start = horizontal
        ? { x: sourceCenter.x + (targetCenter.x >= sourceCenter.x ? sourceSize.width / 2 : -sourceSize.width / 2), y: sourceCenter.y }
        : { x: sourceCenter.x, y: sourceCenter.y + (targetCenter.y >= sourceCenter.y ? sourceSize.height / 2 : -sourceSize.height / 2) }
      const end = horizontal
        ? { x: targetCenter.x + (targetCenter.x >= sourceCenter.x ? -targetSize.width / 2 : targetSize.width / 2), y: targetCenter.y }
        : { x: targetCenter.x, y: targetCenter.y + (targetCenter.y >= sourceCenter.y ? -targetSize.height / 2 : targetSize.height / 2) }
      const stroke = typeof edge.style?.stroke === 'string' ? edge.style.stroke : '#64748b'
      const width = typeof edge.style?.strokeWidth === 'number' ? edge.style.strokeWidth : 1.5
      context.beginPath()
      context.strokeStyle = stroke
      context.lineWidth = width
      context.setLineDash(typeof edge.style?.strokeDasharray === 'string' ? edge.style.strokeDasharray.split(/[ ,]+/).map(Number).filter(Boolean) : [])
      context.moveTo(start.x, start.y)
      context.lineTo(end.x, end.y)
      context.stroke()
      context.setLineDash([])
      const angle = Math.atan2(end.y - start.y, end.x - start.x)
      context.fillStyle = stroke
      context.beginPath()
      context.moveTo(end.x, end.y)
      context.lineTo(end.x - 9 * Math.cos(angle - Math.PI / 6), end.y - 9 * Math.sin(angle - Math.PI / 6))
      context.lineTo(end.x - 9 * Math.cos(angle + Math.PI / 6), end.y - 9 * Math.sin(angle + Math.PI / 6))
      context.closePath()
      context.fill()
      if (edge.label) {
        const label = String(edge.label)
        context.font = '12px "Courier New", monospace'
        const labelWidth = Math.min(Math.max(88, context.measureText(label).width + 18), 420)
        const labelX = (start.x + end.x) / 2 - labelWidth / 2
        const labelY = (start.y + end.y) / 2 + 12
        roundedRect(labelX, labelY, labelWidth, 24, 5)
        context.fillStyle = '#ffffff'
        context.fill()
        context.strokeStyle = '#cbd5e1'
        context.lineWidth = 1
        context.stroke()
        context.fillStyle = '#0f172a'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(label, labelX + labelWidth / 2, labelY + 12, labelWidth - 12)
      }
    })
    drawableNodes.forEach((node) => {
      const { width, height } = dimensions(node)
      const x = node.position.x - minX
      const y = node.position.y - minY
      const visual = node.data.visual
      const fillColor = visual?.fillEnabled === false ? '#ffffff' : visual?.fillColor ?? '#ffffff'
      const lineColor = visual?.lineEnabled === false ? 'transparent' : visual?.lineColor ?? '#334155'
      const textColor = node.data.textStyle?.fontColorEnabled
        ? node.data.textStyle.fontColor ?? '#0f172a'
        : isDarkColor(fillColor) ? '#ffffff' : '#0f172a'
      if (visual?.shadow) {
        context.shadowColor = 'rgba(15,23,42,0.2)'
        context.shadowBlur = 10
        context.shadowOffsetY = 4
      }
      roundedRect(x, y, width, height, visual?.rounded === false ? 3 : 12)
      context.globalAlpha = (visual?.opacity ?? 100) / 100
      context.fillStyle = fillColor
      context.fill()
      context.shadowColor = 'transparent'
      context.globalAlpha = 1
      if (lineColor !== 'transparent') {
        context.strokeStyle = lineColor
        context.lineWidth = visual?.lineWidth ?? 1.5
        context.setLineDash(visual?.lineStyle === 'dashed' ? [7, 4] : visual?.lineStyle === 'dotted' ? [2, 3] : [])
        context.stroke()
        context.setLineDash([])
      }
      const elementData = node.data.kind === 'element' ? node.data : null
      if (elementData?.notationId.includes('Person')) {
        const personColor = lineColor === 'transparent' ? '#0f5d9d' : lineColor
        const centerX = x + width / 2
        context.strokeStyle = personColor
        context.fillStyle = fillColor
        context.lineWidth = 1.5
        context.beginPath()
        context.arc(centerX, y - 6, 6, 0, Math.PI * 2)
        context.fill()
        context.stroke()
        context.beginPath()
        context.moveTo(centerX - 14, y + 14)
        context.bezierCurveTo(centerX - 12, y + 4, centerX - 4, y, centerX, y)
        context.bezierCurveTo(centerX + 4, y, centerX + 12, y + 4, centerX + 14, y + 14)
        context.closePath()
        context.fill()
        context.stroke()
      }
      const fontFamily = node.data.textStyle?.fontFamily ?? 'Arial'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      if (elementData?.stereotype) {
        context.fillStyle = textColor
        context.font = `italic ${Math.max(9, (node.data.textStyle?.fontSize ?? 12) - 2)}px ${fontFamily}`
        context.fillText(`<<${elementData.stereotype.toLowerCase()}>>`, x + width / 2, y + 23, width - 20)
      }
      const title = node.data.kind === 'element' || node.data.kind === 'boundary' || node.data.kind === 'note' ? node.data.title : node.id
      context.fillStyle = textColor
      context.font = `${node.data.textStyle?.bold === false ? 500 : 700} ${Math.max(11, node.data.textStyle?.fontSize ?? 14)}px ${fontFamily}`
      const titleLines = wrapText(title, Math.max(40, width - 20)).slice(0, 2)
      const titleY = elementData?.stereotype ? y + 46 : y + height / 2 - 8
      titleLines.forEach((line, index) => context.fillText(line, x + width / 2, titleY + index * 16, width - 20))
      const description = elementData?.description.filter((line) => !/^\[.*\]$/.test(line)) ?? (node.data.kind === 'note' ? node.data.lines : [])
      if (description.length) {
        context.font = `${Math.max(9, (node.data.textStyle?.fontSize ?? 12) - 2)}px ${fontFamily}`
        const descriptionLines = description.flatMap((line) => wrapText(line, Math.max(40, width - 24))).slice(0, 3)
        const descriptionY = titleY + titleLines.length * 16 + 12
        descriptionLines.forEach((line, index) => context.fillText(line, x + width / 2, descriptionY + index * 12, width - 24))
      }
    })
    return canvas
  }, [edges, nodes])

  const downloadCanvasImage = useCallback(async (mimeType: 'image/png' | 'image/jpeg') => {
    const canvas = renderCanvasImage()
    if (!canvas) return
    const extension = mimeType === 'image/png' ? 'png' : 'jpeg'
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, 0.95))
    if (!blob) return
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${diagramKey}.${extension}`
    link.click()
    URL.revokeObjectURL(link.href)
  }, [diagramKey, renderCanvasImage])

  const downloadCanvasSvg = useCallback(() => {
    const canvas = renderCanvasImage()
    if (!canvas) return
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><image href="${canvas.toDataURL('image/png')}" width="${canvas.width}" height="${canvas.height}" /></svg>`
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
    link.download = `${diagramKey}.svg`
    link.click()
    URL.revokeObjectURL(link.href)
  }, [diagramKey, renderCanvasImage])

  const downloadCanvasPdf = useCallback(() => {
    const canvas = renderCanvasImage()
    if (!canvas) return
    const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait'
    const pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.width, canvas.height] })
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height)
    pdf.save(`${diagramKey}.pdf`)
  }, [diagramKey, renderCanvasImage])

  const printCanvas = useCallback(() => {
    const canvas = renderCanvasImage()
    if (!canvas) return
    const printWindow = window.open('', '_blank', 'width=1200,height=900')
    if (!printWindow) return
    printWindow.opener = null
    printWindow.document.write(`<!doctype html><html><head><title>${diagramKey}</title><style>body{margin:24px;background:#fff}img{display:block;max-width:100%;height:auto}</style></head><body><img src="${canvas.toDataURL('image/png')}" alt="${diagramKey}" /></body></html>`)
    printWindow.document.close()
    printWindow.addEventListener('load', () => printWindow.print(), { once: true })
  }, [diagramKey, renderCanvasImage])

  const copyCanvasAsImage = useCallback(async (nodeIds?: string[]) => {
    const canvas = renderCanvasImage(nodeIds)
    if (!canvas) return
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
  }, [diagramKey, renderCanvasImage])

  useEffect(() => {
    if (!editable) return
    const handleExport = (event: Event) => {
      const detail = (event as CustomEvent<{ diagramKey?: string; action?: string }>).detail
      if (detail?.diagramKey !== diagramKey) return
      if (detail.action === 'png') void downloadCanvasImage('image/png')
      if (detail.action === 'jpeg') void downloadCanvasImage('image/jpeg')
      if (detail.action === 'svg') downloadCanvasSvg()
      if (detail.action === 'pdf') downloadCanvasPdf()
      if (detail.action === 'copy-image') void copyCanvasAsImage()
      if (detail.action === 'print') printCanvas()
    }
    window.addEventListener('tectona-diagram-export', handleExport)
    return () => window.removeEventListener('tectona-diagram-export', handleExport)
  }, [copyCanvasAsImage, diagramKey, downloadCanvasImage, downloadCanvasPdf, downloadCanvasSvg, editable, printCanvas])

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
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && selectedNodeId) {
        event.preventDefault()
        copyNodeToClipboard(selectedNodeId)
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'x' && selectedNodeId) {
        event.preventDefault()
        copyNodeToClipboard(selectedNodeId)
        deleteNode(selectedNodeId)
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault()
        pasteCopiedNode()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && selectedNodeId) {
        event.preventDefault()
        duplicateNode(selectedNodeId)
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
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'd' && selectedNodeId) {
        event.preventDefault()
        setNodeAsDefaultStyle(selectedNodeId)
        return
      }
      if (event.key === 'Escape') {
        setCanvasMenu(null)
        setC4NodeMenu(null)
        return
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      event.preventDefault()
      deleteSelected()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [clearDefaultStyle, copyNodeToClipboard, deleteNode, deleteSelected, duplicateNode, editable, pasteCopiedNode, selectCanvasElements, selectedNodeId, setNodeAsDefaultStyle])

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
  const hasSelectionInspector = selectedElementCount === 1
    && (Boolean(selectedNode && selectedNode.type !== 'archimateLegend') || Boolean(selectedEdgeId))

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
      onNodeContextMenu={editable ? handleNodeContextMenu : undefined}
      onEdgeContextMenu={editable ? handlePaneContextMenu : undefined}
      showGrid={studioMode && showGrid}
      showGuides={studioMode && showGuides}
      snapToGrid={studioMode && snapToGrid}
      showRuler={studioMode && showRuler}
      showConnectionArrows={showConnectionArrows}
      showConnectionPoints={studioMode && showConnectionPoints}
      preview={!editable}
      defaultViewport={editable ? savedViewport : undefined}
      controlsStyle={studioMode ? {
        left: studioPanelPosition.x + (isStudioPanelCollapsed ? STUDIO_PANEL_COLLAPSED_WIDTH_PX : studioPanelSize.width) + STUDIO_PANEL_MARGIN_PX,
        bottom: STUDIO_PANEL_MARGIN_PX,
        zIndex: 40,
      } : undefined}
      onAddText={studioMode && editable ? addCanvasText : undefined}
      onInsertImage={studioMode && editable ? requestImageInsert : undefined}
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
    ...(isC4 && c4Level === 'L1' ? [{ id: 'catalog' as const, label: 'Catalog', icon: AppWindow }] : []),
  ]
  const studioPanelTabClass = (active: boolean) =>
    cn(
      'flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors',
      active ? 'border-slate-900/80 text-slate-900' : 'border-transparent text-slate-600 hover:text-slate-800',
    )

  const selectionInspector =
    hasSelectionInspector && selectedNode && selectedNode.type !== 'archimateLegend' ? (
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
    ) : hasSelectionInspector && selectedEdge ? (
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
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageInputChange} />
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
          {c4NodeMenu && c4MenuNode && c4MenuNode.data.kind !== 'legend' ? (
            <div
              className="absolute z-50 w-60 rounded-md border border-slate-200 bg-white py-1 text-sm text-slate-700 shadow-xl"
              style={{ left: Math.max(8, c4NodeMenu.x), top: Math.max(8, c4NodeMenu.y) }}
              onContextMenu={(event) => event.preventDefault()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100" onClick={() => copyNodeToClipboard(c4MenuNode.id)}>
                <span className="flex items-center gap-2"><Copy className="h-4 w-4" /> Copy</span><span className="text-xs text-slate-400">Ctrl+C</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100"
                onClick={() => {
                  void copyCanvasAsImage([c4MenuNode.id])
                  setC4NodeMenu(null)
                }}
              >
                <ImageDown className="h-4 w-4" /> Copy as image
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100"
                onClick={() => {
                  copyNodeToClipboard(c4MenuNode.id)
                  deleteNode(c4MenuNode.id)
                }}
              >
                <span className="flex items-center gap-2"><Scissors className="h-4 w-4" /> Cut</span><span className="text-xs text-slate-400">Ctrl+X</span>
              </button>
              <div className="my-1 border-t border-slate-200" />
              <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100" onClick={() => duplicateNode(c4MenuNode.id)}>
                <span className="flex items-center gap-2"><Copy className="h-4 w-4" /> Duplicate</span><span className="text-xs text-slate-400">Ctrl+D</span>
              </button>
              <div className="my-1 border-t border-slate-200" />
              <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100" onClick={() => deleteNode(c4MenuNode.id)}>
                <span className="flex items-center gap-2"><Trash2 className="h-4 w-4" /> Delete</span><span className="text-xs text-slate-400">Delete</span>
              </button>
              {c4MenuNode.data.kind === 'element' ? (
                <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100" onClick={() => setNodeAsDefaultStyle(c4MenuNode.id)}>
                  <span className="flex items-center gap-2"><Paintbrush className="h-4 w-4" /> Set as default style</span><span className="text-xs text-slate-400">Ctrl+Shift+D</span>
                </button>
              ) : null}
              <div className="my-1 border-t border-slate-200" />
              <div className="relative" onMouseEnter={() => setC4NodeMenu((current) => current ? { ...current, submenu: 'order' } : current)}>
                <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100">
                  <span className="flex items-center gap-2"><Layers className="h-4 w-4" /> Order</span><ChevronRight className="h-4 w-4" />
                </button>
                {c4NodeMenu.submenu === 'order' ? (
                  <div className="absolute left-full top-0 w-56 rounded-md border border-slate-200 bg-white py-1 shadow-xl">
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={() => { handleLayerAction('front'); setC4NodeMenu(null) }}><ChevronsUp className="h-4 w-4" />Bring to front</button>
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={() => { handleLayerAction('forward'); setC4NodeMenu(null) }}><ArrowRight className="h-4 w-4" />Bring forward</button>
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={() => { handleLayerAction('backward'); setC4NodeMenu(null) }}><ArrowDown className="h-4 w-4" />Send backward</button>
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={() => { handleLayerAction('back'); setC4NodeMenu(null) }}><ChevronsDown className="h-4 w-4" />Send to back</button>
                  </div>
                ) : null}
              </div>
              {format === 'c4' && c4Level === 'L1' && c4MenuNode.data.kind === 'element' ? (
                <>
                  <div className="my-1 border-t border-slate-200" />
                  {c4LinkedTarget ? (
                <>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100"
                    onClick={() => {
                      setC4NodeMenu(null)
                      onOpenC4Drilldown?.(c4LinkedTarget.diagramKey)
                    }}
                  >
                    <ExternalLink className="h-4 w-4" /> Open {c4LinkedTarget.title}
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100"
                    onClick={() => {
                      setC4NodeDrilldown(c4MenuNode.id, null)
                      setC4NodeMenu(null)
                    }}
                  >
                    <Unlink className="h-4 w-4" /> Clear {c4LinkedTarget.title} link
                  </button>
                </>
                  ) : c4LinkedDiagramKey ? (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100"
                      onClick={() => {
                        setC4NodeDrilldown(c4MenuNode.id, null)
                        setC4NodeMenu(null)
                      }}
                    >
                      <Unlink className="h-4 w-4" /> Clear diagram link
                    </button>
                  ) : c4DrilldownTargets.length > 0 ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100"
                  onClick={() => openC4LinkPicker(c4MenuNode.id)}
                >
                  <Link2 className="h-4 w-4" /> Link C4 diagram...
                </button>
                  ) : null}
                </>
              ) : null}
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
                ) : isC4 && sidebarPanel === 'catalog' ? (
                  <C4ApplicationCatalogPalette
                    applications={applicationCatalog}
                    loading={applicationCatalogLoading}
                    existingNames={new Set(nodes.filter((node) => node.data.kind === 'element').map((node) => node.data.title.trim().toLowerCase()))}
                    onAdd={addApplicationCatalogNode}
                    onFocusExisting={focusApplicationCatalogNode}
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
      <Dialog
        open={Boolean(c4LinkPickerNodeId)}
        onOpenChange={(open) => {
          if (open) return
          setC4LinkPickerNodeId(null)
          setSelectedC4DrilldownKey(null)
        }}
      >
        <DialogContent className="w-[min(32rem,calc(100vw-2rem))] p-0">
          <DialogHeader className="border-b border-slate-200 px-5 py-4">
            <DialogTitle className="text-base">Select C4 diagram</DialogTitle>
            <DialogDescription>
              Choose the diagram that details this system.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[52vh] space-y-2 overflow-y-auto p-4">
            {c4DrilldownTargets.map((target) => {
              const selected = selectedC4DrilldownKey === target.diagramKey
              return (
                <button
                  key={target.diagramKey}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedC4DrilldownKey(target.diagramKey)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-md border p-3 text-left transition',
                    selected ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/50',
                  )}
                >
                  <Layers className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-800">{target.title}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500">{target.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <DialogFooter className="border-t border-slate-200 px-5 py-4">
            <Button type="button" variant="outline" onClick={() => setC4LinkPickerNodeId(null)}>Cancel</Button>
            <Button
              type="button"
              disabled={!c4LinkPickerNodeId || !selectedC4DrilldownKey}
              onClick={() => {
                if (!c4LinkPickerNodeId || !selectedC4DrilldownKey) return
                setC4NodeDrilldown(c4LinkPickerNodeId, selectedC4DrilldownKey)
                setC4LinkPickerNodeId(null)
                setSelectedC4DrilldownKey(null)
              }}
            >
              Link diagram
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
