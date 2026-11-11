import { type DiagramFormat, c4RelationEdgeStyle, BPMN_LAYOUT_MARK, withFacingHandles, graphFromUml, parseSource } from '../lib/editableDiagramGraph'
import { remapErdForeignKey } from '../lib/erdForeignKeyMapping'
import { createUseCaseNode, serializeUseCaseDiagram, getUseCaseConnectionStyle } from '../lib/useCasePlantUml'
import { ErdDdlImportDialog } from './ErdDdlImportDialog'
import type { ErdDdlImportResult } from '../lib/erdDdlImport'
import { ErdDdlDialog } from './ErdDdlDialog'
import { selectErdDdlScope, type ErdDdlSelection } from '../lib/erdDdl'
import { arrangeDiagramSelection, canCutDiagramSelection, deletableDiagramNodeIds, copyDiagramSelection, diagramSelectedRoots, DIAGRAM_ARRANGE_ACTIONS, pasteDiagramSelection, type DiagramArrangeAction, type DiagramClipboard } from '../lib/diagramSelectionActions'
import { DiagramEditorMenu, DiagramEditorSubmenu } from '@/components/DiagramEditorMenu'
import { pasteDiagramNodes, removeDiagramNodes } from '../lib/diagramNodeActions'
import { canDiagramEdgeAction, clearDiagramEdgeWaypoints, reverseDiagramEdge, unpinDiagramEdgeEnds } from '../lib/diagramEdgeActions'
import { orderDiagramNode, listenForDiagramMenuDismissal } from '@/modules/project-management/lib/diagramContextMenuActions'
import { c4GraphFromCanvas, mapC4Relations } from '@/modules/project-management/lib/c4CanvasPersistence'
import { mergeDiagramSourceNodes, mergeDiagramSourceEdges } from '@/modules/project-management/lib/diagramSourceMerge'
import { isStoredDiagramGraph } from '@/modules/project-management/lib/diagramGraphPersistence'
import { useDiagramHistory } from '@/modules/project-management/lib/useDiagramHistory'
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { AppWindow, ArrowDown, ArrowRight, ArrowRightLeft, Check, ChevronRight, ChevronsDown, ChevronsLeft, ChevronsRight, ChevronsUp, Circle, Copy, Crosshair, ExternalLink, Grid3X3, GripVertical, History, ImageDown, Layers, LayoutTemplate, Link2, ListChecks, Magnet, MousePointer2, Paintbrush, PencilLine, RefreshCw, RotateCcw, Ruler, Scissors, Settings2, Sparkles, Trash2, Unlink, Waypoints } from 'lucide-react'
import {
  ReactFlowProvider,
  addEdge,
  MarkerType,
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
import { reconnectDiagramEdge } from '@/modules/project-management/lib/diagramConnections'
import { canvasDocumentSnapshot, renderDiagramViewportImage, renderDiagramViewportSvg } from '@/modules/project-management/lib/canvasDocumentSnapshot'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BpmnNotationPalette } from '@/modules/project-management/components/BpmnNotationPalette'
import { C4ApplicationCatalogPalette } from '@/modules/project-management/components/C4ApplicationCatalogPalette'
import { C4NotationPalette } from '@/modules/project-management/components/C4NotationPalette'
import { UML_PALETTE_MIME, UmlNotationPalette, type UmlPaletteItem, type UmlPaletteRelation } from '@/modules/project-management/components/UmlNotationPalette'
import { DiagramEdgePropertiesPanel } from '@/modules/project-management/components/DiagramEdgePropertiesPanel'
import { IntegrationArchitectureFlow } from '@/modules/project-management/components/IntegrationArchitectureFlow'
import { IntegrationNodePropertiesPanel } from '@/modules/project-management/components/IntegrationNodePropertiesPanel'
import { PlantUmlSourceEditor } from '@/modules/project-management/components/PlantUmlSourceEditor'
import { BPMN_PALETTE_MIME, createBpmnNodeFromPaletteItem, type BpmnPaletteItem } from '@/modules/project-management/lib/bpmnNotationPalette'
import { C4_APPLICATION_CATALOG_MIME, C4_PALETTE_MIME, C4_PALETTE_ITEMS, createC4NodeFromApplicationCatalog, createC4NodeFromPaletteItem, findC4ApplicationCatalogMatch, type C4ApplicationCatalogItem, type C4PaletteItem } from '@/modules/project-management/lib/c4NotationPalette'
import { type DiagramChatDraft } from '@/modules/project-management/lib/diagramChatDraft'
import { isArchimateElementData, type ArchimateElementNodeData, type ArchimateNodeData } from '@/modules/project-management/lib/integrationArchitectureTypes'
import { c4LevelFromDiagramKey, c4Stereotype, isC4External, normalizeC4PlantUml, serializeC4Graph } from '@/modules/project-management/lib/c4PlantUml'
import { serializeUmlDiagram, umlRelationDefaults, umlLinkToCanvasData, umlLinkFromCanvasEdge, erdRelationDefaults, type UmlBox, type UmlRelation } from '@/modules/project-management/lib/classErdPlantUml'
import { isCanvasViewport, type CanvasViewport } from '@/modules/project-management/lib/integrationGraphStorage'
import { serializeBpmnCanvasToPlantUml, toBpmnEditorSource } from '@/modules/project-management/lib/bpmnPlantUml'
import { isBpmnSquareShape } from '@/modules/project-management/lib/bpmnNotationSpec'
import { useTenantContextOptional } from '@/auth/TenantContext'
import { listAllKbEntries } from '@/lib/api/tectonaKbApi'
import { subscribeToApplicationCatalogChanges } from '@/lib/kb/applicationCatalogRealtime'
import { parseSystemKbTableContent } from '@/lib/kb/systemKbTableEditor'
import { belongsToActiveWorkspaceScope, buildWorkspaceScopeFromTenant } from '@/lib/tenantWorkspaceScope'
import { fetchAllWorkspaceOrgWorkspacesCached } from '@/lib/workspaceOrgDirectoryCache'
import { requestOpenIdeaDiscussChat } from '@/stores/chat-navigation-store'
import { createDiagramAiDraftAudit, listDiagramAiDraftAudit, type DiagramAiDraftAuditApi } from '@/lib/api/ideaBacklogApi'
import { chatAuditDraftSummary, chatAuditLabel, chatAuditSnapshotSummary } from '@/modules/project-management/lib/diagramChatDraft'
import {
  copyDiagramImage,
  downloadDiagramImage,
  downloadDiagramPdf,
  downloadDiagramSvgDataUrl,
  printDiagram,
} from '@/modules/project-management/lib/diagramCanvasExport'

type DiagramStore = Record<string, { nodes: Node<ArchimateNodeData>[]; edges: Edge[]; source?: string; viewport?: CanvasViewport; snapToGrid?: boolean; draftBeforeSavedGraph?: boolean }>

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

function umlConnectionStyle(format: DiagramFormat, relation: string): Pick<Edge, 'type' | 'style' | 'markerEnd' | 'markerStart' | 'data' | 'label'> {
  if (format === 'use-case') return getUseCaseConnectionStyle(relation)
  if (format === 'c4') return { type: 'smoothstep', ...c4RelationEdgeStyle() }
  if (format === 'bpmn') return { type: 'smoothstep', ...bpmnConnectEdgeStyle(relation) }
  if (format === 'erd') {
    return { type: 'erd', style: { stroke: '#C4A35A', strokeWidth: 1.5 }, data: erdRelationDefaults(relation) }
  }
  const defaults = umlRelationDefaults(relation as UmlRelation)
  return { type: 'smoothstep', style: { stroke: '#4B5563', strokeWidth: 1.15, strokeDasharray: defaults.lineStyle === 'dashed' ? '5 4' : undefined },
    data: { ...umlLinkToCanvasData({ source: '', target: '', label: '', ...defaults }) } }
}

function createUmlPaletteNode(item: UmlPaletteItem, position: { x: number; y: number }, existingIds: string[]): Node<ArchimateNodeData> {
  const kind = item.nodeKind ?? 'class'
  if (kind === 'actor' || kind === 'usecase' || kind === 'system-boundary') {
    let index = existingIds.length + 1
    while (existingIds.includes(`uc_${index}`)) index++
    return createUseCaseNode(kind, item.label, `uc_${index}`, position)
  }
  const base = kind === 'entity' ? 'Entity' : kind === 'interface' ? 'Interface' : kind === 'enumeration' ? 'Enumeration' : 'Class'
  let index = existingIds.length + 1
  let id = `${kind}_${index}`
  while (existingIds.includes(id)) {
    index += 1
    id = `${kind}_${index}`
  }
  const title = `New${base}`
  const description = kind === 'enumeration' ? ['VALUE'] : kind === 'entity' ? ['* id'] : []
  const height = kind === 'entity' ? 72 : kind === 'enumeration' ? 58 : kind === 'interface' ? 48 : 34
  return {
    id,
    type: kind === 'entity' ? 'erdEntity' : 'umlClass',
    position,
    style: { width: kind === 'entity' ? 168 : 160, height },
    data: {
      kind: 'element',
      layer: 'application',
      notationId: kind,
      stereotype: kind,
      title,
      description,
      visual: {
        fillColor: kind === 'entity' ? '#FFF4CC' : '#FFFFFF',
        lineColor: kind === 'entity' ? '#C4A35A' : '#7F8C9B',
        lineWidth: kind === 'entity' ? 1.5 : 1,
      },
    },
  }
}

function normalizeC4RelationEdges(edges: Edge[]): Edge[] {
  return mapC4Relations(edges, (edge) => {
    return {
      ...edge,
      ...c4RelationEdgeStyle(edge.data?.c4Relation?.macro),
      style: { ...c4RelationEdgeStyle().style, ...edge.style },
      data: {
        ...c4RelationEdgeStyle(edge.data?.c4Relation?.macro).data,
        ...(edge.data as Record<string, unknown> | undefined),
      },
    }
  })
}

function squareSize(width: number, height: number): number {
  return Math.max(width, height)
}

const flowToC4Graph = c4GraphFromCanvas

function isStoredUmlGraph(nodes: Node<ArchimateNodeData>[]): boolean {
  return nodes.some((node) => node.type === 'umlClass')
}

function isStoredC4Graph(nodes: Node<ArchimateNodeData>[]): boolean {
  return nodes.some((node) => node.type === 'c4Element')
}

function isStoredBpmnGraph(nodes: Node<ArchimateNodeData>[]): boolean {
  return nodes.some((node) => node.type === 'bpmnElement')
}

function graphHasSwimlanes(nodes: Node<ArchimateNodeData>[]): boolean {
  return nodes.some((node) => node.type === 'bpmnElement' && node.data.kind === 'element' && node.data.notationId === 'lane')
}

function graphHasFittedSwimlanes(nodes: Node<ArchimateNodeData>[]): boolean {
  return nodes.some((node) => (
    node.type === 'bpmnElement'
    && node.data.kind === 'element'
    && node.data.notationId === 'lane'
    && node.data.description?.includes(BPMN_LAYOUT_MARK)
  ))
}

function mergeCanvasLayout(
  previous: Node<ArchimateNodeData>[],
  next: Node<ArchimateNodeData>[],
): Node<ArchimateNodeData>[] {
  const generatedIds = new Set(next.map(node => node.id))
  const decorations = previous.filter(node => !generatedIds.has(node.id) && (node.type === 'archimateNote' || node.type === 'archimateImage'))
  return mergeDiagramSourceNodes(previous, [...next, ...decorations])
}

function readCachedGraph(key: string): DiagramStore[string] | undefined {
  try {
    const store = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as DiagramStore
    if (!isStoredDiagramGraph(store[key])) return undefined
    return {
      nodes: store[key].nodes,
      edges: store[key].edges,
      source: store[key].source,
      viewport: isCanvasViewport(store[key].viewport) ? store[key].viewport : undefined,
      snapToGrid: typeof store[key].snapToGrid === 'boolean' ? store[key].snapToGrid : undefined,
      draftBeforeSavedGraph: store[key].draftBeforeSavedGraph === true,
    }
  } catch {
    return undefined
  }
}

function saveGraph(key: string, graph: DiagramStore[string]) {
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
  submenu?: 'order' | 'arrange'
}

type EdgeContextMenuState = {
  edgeId: string
  x: number
  y: number
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
  onPersistGraph?: (graph: { nodes: Node<ArchimateNodeData>[]; edges: Edge[]; source: string; viewport?: CanvasViewport; snapToGrid?: boolean; canvasPngBase64?: string; canvasExportError?: boolean }) => void
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
  const legacyStorageKey = `${ideaId}:${diagramKey}`
  const storageKey = tenant?.workspaceId ? JSON.stringify([tenant.workspaceId, ideaId, diagramKey]) : legacyStorageKey
  // A known draft, unlike a legacy cache entry, may not be replaced on mount.
  const [cachedDraft] = useState(() => {
    if (!editable) return undefined
    const cached = readCachedGraph(storageKey)
    return cached?.draftBeforeSavedGraph ? cached : undefined
  })
  const c4Source = useMemo(
    () => (format === 'c4' ? normalizeC4PlantUml(source, c4LevelFromDiagramKey(diagramKey)) : source),
    [diagramKey, format, source],
  )
  const bpmnEditorSource = useMemo(
    () => (format === 'bpmn' ? toBpmnEditorSource(c4Source) : c4Source),
    [c4Source, format],
  )
  const imported = useMemo(() => parseSource(bpmnEditorSource, format), [bpmnEditorSource, format])
  const shouldMigrateStoredBpmnGraph = format === 'bpmn' && (
    (graphHasSwimlanes(imported.nodes) && Boolean(savedGraph?.nodes?.length) && !graphHasFittedSwimlanes(savedGraph.nodes))
  )
  const initial = useMemo<DiagramStore[string]>(() => {
    if (isStoredDiagramGraph(savedGraph)) {
      if (format === 'bpmn' && savedGraph.nodes.length > 0 && (!isStoredBpmnGraph(savedGraph.nodes) || shouldMigrateStoredBpmnGraph)) {
        return {
          ...imported,
          viewport: savedGraph.viewport,
          snapToGrid: false,
          edges: withFacingHandles(imported.nodes, imported.edges),
        }
      }
      const savedEdges = format === 'c4' ? normalizeC4RelationEdges(savedGraph.edges) : savedGraph.edges
      return { ...savedGraph, edges: withFacingHandles(savedGraph.nodes, savedEdges) }
    }
    if (!editable) return imported
    const stored: DiagramStore[string] = readCachedGraph(storageKey) ?? readCachedGraph(legacyStorageKey) ?? imported
    if (format === 'c4' && stored.nodes.length > 0 && !isStoredC4Graph(stored.nodes)) {
      return {
        ...imported,
        viewport: stored.viewport,
        snapToGrid: false,
        edges: withFacingHandles(imported.nodes, imported.edges),
      }
    }
    if (format === 'class' && stored.nodes.length > 0 && !isStoredUmlGraph(stored.nodes)) {
      return {
        ...imported,
        viewport: stored.viewport,
        snapToGrid: false,
        edges: withFacingHandles(imported.nodes, imported.edges),
      }
    }
    if (format === 'erd' && stored.nodes.length > 0 && !stored.nodes.some((node) => node.type === 'erdEntity')) {
      return {
        ...imported,
        viewport: stored.viewport,
        snapToGrid: false,
        edges: withFacingHandles(imported.nodes, imported.edges),
      }
    }
    if (format === 'bpmn' && stored.nodes.length > 0 && (!isStoredBpmnGraph(stored.nodes) || (graphHasSwimlanes(imported.nodes) && !graphHasFittedSwimlanes(stored.nodes)))) {
      return {
        ...imported,
        viewport: stored.viewport,
        snapToGrid: false,
        edges: withFacingHandles(imported.nodes, imported.edges),
      }
    }
    const storedEdges = format === 'c4' ? normalizeC4RelationEdges(stored.edges) : stored.edges
    return { ...stored, edges: withFacingHandles(stored.nodes, storedEdges) }
  }, [editable, format, imported, legacyStorageKey, savedGraph, shouldMigrateStoredBpmnGraph, storageKey])
  const bootstrap = cachedDraft ?? initial
  const [nodes, setCanvasNodes, onNodesChange] = useNodesState<ArchimateNodeData>(bootstrap.nodes)
  const [edges, setCanvasEdges, onEdgesChange] = useEdgesState(bootstrap.edges)
  const appliedSavedGraphRef = useRef(false)
  const editedBeforeSavedGraphRef = useRef(Boolean(cachedDraft))
  const [editedBeforeSavedGraph, setEditedBeforeSavedGraph] = useState(Boolean(cachedDraft))
  const [confirmSavedGraph, setConfirmSavedGraph] = useState<typeof savedGraph>()
  if (confirmSavedGraph && (confirmSavedGraph !== savedGraph || !editable)) {
    setConfirmSavedGraph(undefined)
  }
  const markLocalEdit = useCallback(() => {
    if (!editable || appliedSavedGraphRef.current || editedBeforeSavedGraphRef.current) return
    editedBeforeSavedGraphRef.current = true
    setEditedBeforeSavedGraph(true)
  }, [editable])
  // User mutations use these setters. Bootstrap, layout maintenance and selection use the raw setters.
  const setNodes = useCallback<typeof setCanvasNodes>((next) => {
    markLocalEdit()
    setCanvasNodes(next)
  }, [markLocalEdit, setCanvasNodes])
  const setEdges = useCallback<typeof setCanvasEdges>((next) => {
    markLocalEdit()
    setCanvasEdges(next)
  }, [markLocalEdit, setCanvasEdges])
  const savedGraphConflict = editedBeforeSavedGraph && isStoredDiagramGraph(savedGraph)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [sidebarPanel, setSidebarPanel] = useState<StudioSidebarPanel>(
    format === 'c4' || format === 'class' || format === 'erd' || format === 'use-case' ? 'diagram' : 'source',
  )
  const [sourceDraft, setSourceDraft] = useState(() => typeof bootstrap.source === 'string' ? bootstrap.source : bpmnEditorSource)
  const c4Level = c4LevelFromDiagramKey(diagramKey)
  const applicationCatalogScope = useMemo(() => tenant ? buildWorkspaceScopeFromTenant(tenant) : null, [tenant])
  const [applicationCatalog, setApplicationCatalog] = useState<C4ApplicationCatalogItem[]>([])
  const [applicationCatalogLoading, setApplicationCatalogLoading] = useState(false)
  const [applicationCatalogLoaded, setApplicationCatalogLoaded] = useState(false)
  const viewportRef = useRef<CanvasViewport | undefined>(bootstrap.viewport)
  const [savedViewport, setSavedViewport] = useState<CanvasViewport | undefined>(bootstrap.viewport)
  const [isStudioPanelCollapsed, setIsStudioPanelCollapsed] = useState(false)
  const [studioPanelPosition, setStudioPanelPosition] = useState(STUDIO_PANEL_DEFAULT_POSITION)
  const [studioPanelSize, setStudioPanelSize] = useState({ width: STUDIO_PANEL_DEFAULT_WIDTH_PX, height: 0 })
  const [propertiesPanelPosition, setPropertiesPanelPosition] = useState<{ x: number; y: number } | null>(null)
  const [propertiesPanelSize, setPropertiesPanelSize] = useState({ width: STUDIO_PANEL_DEFAULT_WIDTH_PX, height: 0 })
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false)
  const [isStudioPanelDragging, setIsStudioPanelDragging] = useState(false)
  const [isStudioPanelResizing, setIsStudioPanelResizing] = useState(false)
  const [isPropertiesPanelDragging, setIsPropertiesPanelDragging] = useState(false)
  const [isPropertiesPanelResizing, setIsPropertiesPanelResizing] = useState(false)
  const [erdDdlImportOpen, setErdDdlImportOpen] = useState(false)
  const [erdDdlSelection, setErdDdlSelection] = useState<ErdDdlSelection | null>(null)
  const [canvasMenu, setCanvasMenu] = useState<CanvasContextMenuState | null>(null)
  const [hasPasteableContent, setHasPasteableContent] = useState(false)
  const [clipboardError, setClipboardError] = useState<string | null>(null)
  const [edgeContextMenu, setEdgeContextMenu] = useState<EdgeContextMenuState | null>(null)
  const [c4NodeMenu, setC4NodeMenu] = useState<C4NodeContextMenuState | null>(null)
  const [pendingChatDraft, setPendingChatDraft] = useState<DiagramChatDraft | null>(null)
  const [lastAppliedChatDraft, setLastAppliedChatDraft] = useState<{ draft: DiagramChatDraft; before: { nodes: Node<ArchimateNodeData>[]; edges: Edge[]; source: string } } | null>(null)
  const [isChatAuditOpen, setIsChatAuditOpen] = useState(false)
  const [chatAudit, setChatAudit] = useState<DiagramAiDraftAuditApi[]>([])
  const [chatAuditLoading, setChatAuditLoading] = useState(false)
  const [pendingAuditWrite, setPendingAuditWrite] = useState<Parameters<typeof createDiagramAiDraftAudit>[2] | null>(null)
  const [chatAuditWriteError, setChatAuditWriteError] = useState<string | null>(null)
  const [c4LinkPickerNodeId, setC4LinkPickerNodeId] = useState<string | null>(null)
  const [selectedC4DrilldownKey, setSelectedC4DrilldownKey] = useState<string | null>(null)
  const [defaultElementStyle, setDefaultElementStyle] = useState<Pick<ArchimateElementNodeData, 'visual' | 'textStyle'> | null>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [showGuides, setShowGuides] = useState(true)
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [bpmnFlowType, setBpmnFlowType] = useState('sequenceFlow')
  const [umlRelation, setUmlRelation] = useState<UmlPaletteRelation>(format === 'erd' ? 'one-to-many' : 'association')
  const [showRuler, setShowRuler] = useState(true)
  const [showConnectionArrows, setShowConnectionArrows] = useState(true)
  const [showConnectionPoints, setShowConnectionPoints] = useState(true)
  const [historyVersion, setHistoryVersion] = useState(0)
  const history = useDiagramHistory({ nodes, edges, source: sourceDraft }, (snapshot) => {
    setNodes(snapshot.nodes)
    setEdges(snapshot.edges)
    setSourceDraft(snapshot.source)
  }, `${storageKey}:${historyVersion}`, reactFlowWrapperRef, editable)

  const applyErdDdlImport = (result: ErdDdlImportResult) => {
    if (!editable || format !== 'erd' || result.errors.length || !result.diagram.boxes.length) return
    const graph = graphFromUml('', 'erd', result.diagram)
    const usedIds = new Set([...nodes.map(node => node.id), ...edges.map(edge => edge.id)])
    const uniqueId = (base: string) => {
      let id = base, index = 1
      while (usedIds.has(id)) id = `${base}_${index++}`
      usedIds.add(id)
      return id
    }
    const ids = new Map(graph.nodes.map(node => [node.id, uniqueId(`import_${node.id}`)]))
    const bottom = nodes.reduce((max, node) => Math.max(max, node.position.y + Number(node.height ?? node.style?.height ?? 100)), 0)
    const addedNodes = graph.nodes.map((node, index) => ({
      ...node, id: ids.get(node.id)!, selected: true,
      position: { ...node.position, y: node.position.y + (nodes.length ? bottom + 72 : 0) },
      data: { ...node.data, erdDdlImport: result.tables[index] },
    }))
    const addedEdges = graph.edges.map(edge => ({ ...edge, id: uniqueId(`import_${edge.id}`), source: ids.get(edge.source)!, target: ids.get(edge.target)!, selected: true, ...(edge.data?.erdForeignKey !== undefined ? { data: { ...edge.data, erdForeignKey: remapErdForeignKey(edge.data.erdForeignKey, ids) } } : {}) }))
    setNodes(current => [...current.map(node => ({ ...node, selected: false })), ...addedNodes])
    setEdges(current => [...current.map(edge => ({ ...edge, selected: false })), ...addedEdges])
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setErdDdlImportOpen(false)
  }

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
  const onPersistGraphRef = useRef(onPersistGraph)
  onPersistGraphRef.current = onPersistGraph
  const appliedStorageKeyRef = useRef<string | null>(null)
  const nodeClipboardRef = useRef<DiagramClipboard<ArchimateNodeData> | null>(null)
  const applicationCatalogRequestRef = useRef(0)

  const loadApplicationCatalog = useCallback(async () => {
    if (format !== 'c4' || c4Level !== 'L1') return
    const requestId = ++applicationCatalogRequestRef.current
    setApplicationCatalogLoading(true)
    setApplicationCatalogLoaded(false)
    try {
      const [{ items }, workspaces] = await Promise.all([
        listAllKbEntries(),
        fetchAllWorkspaceOrgWorkspacesCached().catch(() => []),
      ])
      const workspaceIdByKey = new Map(
        workspaces.map((workspace) => [workspace.workspace_key.trim().toLowerCase(), workspace.id] as const),
      )
      const seen = new Set<string>()
      const applications: C4ApplicationCatalogItem[] = []
      items
        .filter((entry) => entry.is_active && entry.category === 'application_catalog')
        .filter((entry) => {
          if (!applicationCatalogScope || !entry.workspace_id) {
            return !applicationCatalogScope || belongsToActiveWorkspaceScope(entry.workspace_id, applicationCatalogScope)
          }
          const workspaceId = workspaceIdByKey.get(entry.workspace_id.trim().toLowerCase()) ?? entry.workspace_id
          return belongsToActiveWorkspaceScope(workspaceId, applicationCatalogScope)
        })
        .forEach((entry) => {
          const catalog = parseSystemKbTableContent(entry.title, entry.content)
          if (catalog?.specId !== 'aplikasi') return
          catalog.rows.forEach((row) => {
            const name = row.name?.trim()
            if (!name || seen.has(name.toLowerCase())) return
            seen.add(name.toLowerCase())
            applications.push({
              name,
              type: row.type?.trim() || 'Application',
              description: row.description?.trim() || '',
              classification: 'External System',
              isInactive: row.status === 'Inactive',
            })
          })
        })
      if (requestId === applicationCatalogRequestRef.current) {
        setApplicationCatalog(applications.sort((left, right) => left.name.localeCompare(right.name)))
        setApplicationCatalogLoaded(true)
      }
    } catch {
      // Keep the last successful catalog visible while an API request is temporarily unavailable.
    } finally {
      if (requestId === applicationCatalogRequestRef.current) setApplicationCatalogLoading(false)
    }
  }, [applicationCatalogScope, c4Level, format])

  useEffect(() => {
    void loadApplicationCatalog()
    return () => {
      applicationCatalogRequestRef.current += 1
    }
  }, [loadApplicationCatalog])

  useEffect(() => subscribeToApplicationCatalogChanges(() => {
    void loadApplicationCatalog()
  }), [loadApplicationCatalog])

  useEffect(() => {
    if (format !== 'c4' || c4Level !== 'L1' || applicationCatalogLoading || !applicationCatalogLoaded) return
    setCanvasNodes((current) => {
      let changed = false
      const next = current.map((node) => {
        if (node.type !== 'c4Element' || node.data.kind !== 'element') return node
        const isSystem = node.data.notationId === 'System' || node.data.notationId === 'System_Ext'
        const match = isSystem ? findC4ApplicationCatalogMatch(node.data.title, applicationCatalog) : undefined
        const applicationCatalogName = match?.name
        if (node.data.applicationCatalogName === applicationCatalogName) return node
        changed = true
        const data = { ...node.data }
        if (applicationCatalogName) data.applicationCatalogName = applicationCatalogName
        else delete data.applicationCatalogName
        return { ...node, data }
      })
      return changed ? next : current
    })
  }, [applicationCatalog, applicationCatalogLoaded, applicationCatalogLoading, c4Level, format, nodes, setCanvasNodes])

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

  const applyInitialGraph = useCallback(() => {
    skipPersistRef.current = true
    appliedStorageKeyRef.current = storageKey
    appliedSavedGraphRef.current = isStoredDiagramGraph(savedGraph)
    setCanvasNodes(initial.nodes)
    setCanvasEdges(initial.edges)
    viewportRef.current = initial.viewport
    setSavedViewport(initial.viewport)
    setSnapToGrid(false)
    setSourceDraft(typeof initial.source === 'string' ? initial.source : bpmnEditorSource)
  }, [bpmnEditorSource, initial, savedGraph, setCanvasEdges, setCanvasNodes, storageKey])

  useEffect(() => {
    if (editedBeforeSavedGraphRef.current) return
    if (appliedStorageKeyRef.current === storageKey && (!isStoredDiagramGraph(savedGraph) || appliedSavedGraphRef.current)) return
    applyInitialGraph()
  }, [applyInitialGraph, savedGraph, storageKey])

  const replaceWithSavedGraph = () => {
    if (!editable || !savedGraphConflict || confirmSavedGraph !== savedGraph) return
    applyInitialGraph()
    editedBeforeSavedGraphRef.current = false
    setEditedBeforeSavedGraph(false)
    setConfirmSavedGraph(undefined)
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setLastAppliedChatDraft(null)
    setHistoryVersion((version) => version + 1)
  }
  useEffect(() => {
    if (format !== 'class') return
    setCanvasNodes((current) => {
      let changed = false
      const next = current.map((node) => {
        if (node.type !== 'umlClass' || node.data.kind !== 'element') return node
        const attributes = node.data.description.filter((line) => !line.includes('('))
        const methods = node.data.description.filter((line) => line.includes('('))
        const stereotypeExtra = (node.data.stereotype === 'interface' || node.data.stereotype === 'enumeration' ? 14 : 0) + (node.data.umlStereotype ? 14 : 0)
        const width = Number(node.style?.width ?? node.width ?? 180)
        const memberLines = (members: string[]) => members.reduce((total, line) => total + Math.max(1, Math.ceil(line.length * 6.6 / Math.max(40, width - 48))), 0)
        const height = 32 + stereotypeExtra + (attributes.length ? memberLines(attributes) * 16 + 8 : 0) + (methods.length ? memberLines(methods) * 16 + 8 : 0)
        const currentHeight = Number(node.style?.height ?? node.height ?? 0)
        if (Math.abs(currentHeight - height) < 4) return node
        changed = true
        return { ...node, style: { ...node.style, height }, height }
      })
      return changed ? next : current
    })
  }, [format, nodes, setCanvasNodes])
  useEffect(() => {
    if (!canvasMenu && !c4NodeMenu && !edgeContextMenu) return
    return listenForDiagramMenuDismissal(() => {
      setCanvasMenu(null)
      setC4NodeMenu(null)
      setEdgeContextMenu(null)
    })
  }, [canvasMenu, c4NodeMenu, edgeContextMenu])
  useEffect(() => {
    if (format !== 'c4' || c4Level !== 'L1' || c4DrilldownTargets.length === 0) return
    const normalizeTitle = (value: string) => value.trim().toLocaleLowerCase()
    setCanvasNodes((current) => {
      let changed = false
      const next = current.map((node) => {
        if (node.type !== 'c4Element' || node.data.kind !== 'element' || node.data.diagramLink || node.data.diagramLinkCleared) return node
        const nodeTitle = node.data.title
        const target = c4DrilldownTargets.find((item) => (
          item.matchNodeTitle && normalizeTitle(item.matchNodeTitle) === normalizeTitle(nodeTitle)
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
  }, [c4DrilldownTargets, c4Level, format, setCanvasNodes])
  const captureDiagramPendingScope = useEffectEvent(() => ({ ideaId, diagramKey }))

  useEffect(() => {
    if (editable) saveGraph(storageKey, { nodes, edges, source: sourceDraft, viewport: viewportRef.current, snapToGrid, draftBeforeSavedGraph: editedBeforeSavedGraph })
    if (!editable || savedGraphConflict || !onPersistGraphRef.current) return
    if (skipPersistRef.current) {
      skipPersistRef.current = false
      return
    }
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current)
    let cancelled = false
    window.dispatchEvent(new CustomEvent('tectona-diagram-content-pending', { detail: captureDiagramPendingScope() }))
    persistTimerRef.current = window.setTimeout(async () => {
      const graph = { nodes, edges, source: sourceDraft, viewport: viewportRef.current, snapToGrid }
      try {
        const canvasPngBase64 = await canvasDocumentSnapshot(reactFlowWrapperRef.current, nodes, edges)
        if (!cancelled) onPersistGraphRef.current?.({ ...graph, canvasPngBase64 })
      } catch {
        if (!cancelled) onPersistGraphRef.current?.({ ...graph, canvasExportError: true })
      }
    }, 700)
    return () => {
      cancelled = true
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current)
    }
  }, [editable, editedBeforeSavedGraph, edges, nodes, savedGraphConflict, snapToGrid, sourceDraft, storageKey])
  useEffect(() => {
    if (format !== 'c4') return
    setSourceDraft((current) => {
      const next = serializeC4Graph(flowToC4Graph(nodes, edges, current), c4Level)
      return next === current ? current : next
    })
  }, [c4Level, edges, format, nodes])
  useEffect(() => {
    if (format === 'use-case') { setSourceDraft(serializeUseCaseDiagram(nodes, edges)); return }
    if (format !== 'class' && format !== 'erd') return
    setSourceDraft((current) => {
      const boxes = nodes
        .filter((node): node is Node<ArchimateElementNodeData> => (node.type === 'umlClass' || node.type === 'erdEntity') && node.data.kind === 'element')
        .map((node): UmlBox => ({
          id: node.id,
          title: node.data.title,
          members: node.data.description,
          stereotype: node.data.umlStereotype,
          kind: node.data.stereotype === 'interface' || node.data.stereotype === 'enumeration' || node.data.stereotype === 'entity' || node.data.stereotype === 'class'
            ? node.data.stereotype
            : undefined,
        }))
      const links = edges.map((edge) => umlLinkFromCanvasEdge(edge, format))
      const next = serializeUmlDiagram({ view: format, boxes, links })
      return next === current ? current : next
    })
  }, [edges, format, nodes])
  useEffect(() => {
    if (format !== 'bpmn') return
    setSourceDraft((current) => {
      const next = serializeBpmnCanvasToPlantUml(nodes, edges, current)
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
    const removed = deletableDiagramNodeIds(nodesRef.current, edges, new Set(nextChanges.filter(change => change.type === 'remove').map(change => change.id)))
    if (removed.size) {
      setNodes(current => removeDiagramNodes(current, removed))
      setEdges(current => current.filter(edge => !removed.has(edge.source) && !removed.has(edge.target)))
    }
    if (nextChanges.some(change =>
      change.type === 'add' || change.type === 'reset'
      || (change.type === 'position' && change.position && nodesRef.current.some(node =>
        node.id === change.id && (node.position.x !== change.position?.x || node.position.y !== change.position?.y)
      ))
      || (change.type === 'dimensions' && change.dimensions && (change.resizing || change.updateStyle))
    )) markLocalEdit()
    onNodesChange(nextChanges.filter(change => change.type !== 'remove'))
  }, [edges, markLocalEdit, onNodesChange, setEdges, setNodes])
  const nodeLayoutKey = nodes
    .map((node) => `${node.id}:${Math.round(node.position.x)}:${Math.round(node.position.y)}:${Math.round(Number(node.width ?? 0))}:${Math.round(Number(node.height ?? 0))}:${node.parentNode ?? ''}`)
    .join('|')
  useEffect(() => {
    setCanvasNodes((current) => {
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
  }, [nodeLayoutKey, setCanvasNodes])
  useEffect(() => {
    setCanvasEdges((current) => {
      const next = withFacingHandles(nodesRef.current, current)
      const changed = next.some((edge, index) => (
        edge.sourceHandle !== current[index]?.sourceHandle || edge.targetHandle !== current[index]?.targetHandle
      ))
      return changed ? next : current
    })
  }, [nodeLayoutKey, setCanvasEdges])

  const onConnect = useCallback(
    (connection: Connection) => setEdges((current) => withFacingHandles(nodes, addEdge({
      ...connection,
      ...umlConnectionStyle(format, format === 'bpmn' ? bpmnFlowType : umlRelation),
      data: { ...umlConnectionStyle(format, format === 'bpmn' ? bpmnFlowType : umlRelation).data, manualConnectionHandles: true },
    }, current))),
    [bpmnFlowType, format, nodes, setEdges, umlRelation],
  )

  const onEdgeUpdate = useCallback(
    (oldEdge: Edge, connection: Connection) => {
      if (!canDiagramEdgeAction(oldEdge, 'reconnect')) return
      setEdges((current) => {
        const next = reconnectDiagramEdge(oldEdge, connection, current).map((edge) => (
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
    setIsPropertiesPanelOpen(false)
  }, [])

  const clearCanvasSelection = useCallback(() => {
    setCanvasMenu(null)
    setC4NodeMenu(null)
    setEdgeContextMenu(null)
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setIsPropertiesPanelOpen(false)
    setCanvasNodes((current) => current.map((node) => (node.selected ? { ...node, selected: false } : node)))
    setCanvasEdges((current) => current.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)))
  }, [setCanvasEdges, setCanvasNodes])

  const handleEdgeClick = useCallback((_event: ReactMouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id)
    setSelectedNodeId(null)
    setIsPropertiesPanelOpen(false)
    setCanvasNodes((current) => current.map((node) => ({ ...node, selected: false })))
    setCanvasEdges((current) => current.map((item) => ({ ...item, selected: item.id === edge.id })))
  }, [setCanvasEdges, setCanvasNodes])

  const handleEdgeContextMenu = useCallback((event: ReactMouseEvent | MouseEvent, edge: Edge) => {
    event.preventDefault()
    const wrapper = reactFlowWrapperRef.current
    if (!wrapper) return
    const bounds = wrapper.getBoundingClientRect()
    setCanvasMenu(null)
    const selectedEntity = format === 'erd' && edge.selected ? nodes.find(n => n.selected && n.type === 'erdEntity') : undefined
    if (selectedEntity) {
      setEdgeContextMenu(null)
      setSelectedNodeId(selectedEntity.id)
      setSelectedEdgeId(null)
      setC4NodeMenu({ nodeId: selectedEntity.id, x: event.clientX - bounds.left, y: event.clientY - bounds.top })
      return
    }
    setC4NodeMenu(null)
    setCanvasNodes((current) => current.map((node) => ({ ...node, selected: false })))
    setCanvasEdges((current) => current.map((item) => ({ ...item, selected: item.id === edge.id })))
    setSelectedNodeId(null)
    setSelectedEdgeId(edge.id)
    setEdgeContextMenu({
      edgeId: edge.id,
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    })
  }, [format, nodes, setCanvasEdges, setCanvasNodes])

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
    setCanvasNodes((current) => current.map((item) => ({ ...item, selected: item.id === node.id })))
    setSelectedNodeId(node.id)
    setSelectedEdgeId(null)
  }, [nodes, setCanvasNodes])

  const handleBpmnPaletteDragStart = useCallback((event: DragEvent<HTMLButtonElement>, item: BpmnPaletteItem) => {
    event.dataTransfer.setData(BPMN_PALETTE_MIME, JSON.stringify(item))
    event.dataTransfer.effectAllowed = 'copyMove'
  }, [])

  const handleUmlPaletteDragStart = useCallback((event: DragEvent<HTMLButtonElement>, item: UmlPaletteItem) => {
    event.dataTransfer.setData(UML_PALETTE_MIME, JSON.stringify(item))
    event.dataTransfer.effectAllowed = 'copy'
  }, [])

  const addUmlPaletteNode = useCallback((item: UmlPaletteItem) => {
    if (!item.nodeKind) return
    const bounds = reactFlowWrapperRef.current?.getBoundingClientRect()
    const spot = bounds
      ? screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + Math.min(180, bounds.height / 3) })
      : { x: 80, y: 80 }
    const newNode = applyDefaultElementStyle(createUmlPaletteNode(item, spot, nodes.map((node) => node.id)))
    setNodes((current) => [...current, newNode])
    setSelectedNodeId(newNode.id)
    setSelectedEdgeId(null)
  }, [applyDefaultElementStyle, nodes, reactFlowWrapperRef, screenToFlowPosition, setNodes])

  const handleCanvasDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleCanvasDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const umlRaw = event.dataTransfer.getData(UML_PALETTE_MIME)
      if (umlRaw) {
        let item: UmlPaletteItem
        try {
          item = JSON.parse(umlRaw) as UmlPaletteItem
        } catch {
          return
        }
        if (!item.nodeKind) return
        const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
        const newNode = applyDefaultElementStyle(createUmlPaletteNode(item, position, nodes.map((node) => node.id)))
        setNodes((current) => [...current, newNode])
        setSelectedNodeId(newNode.id)
        setSelectedEdgeId(null)
        return
      }
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
        const created = createBpmnNodeFromPaletteItem(item, position, nodes.map((node) => node.id))
        const newNode = applyDefaultElementStyle(created.data.kind === 'element' ? { ...created, data: { ...created.data, bpmnLane: null } } : created)
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
          width: Number(node.width ?? node.style?.width ?? 240),
          height: Number(node.height ?? node.style?.height ?? 120),
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
    if (!selectedEdgeId || !canDiagramEdgeAction(selectedEdge, 'clearWaypoints')) return
    setEdges((current) => current.map((edge) => edge.id === selectedEdgeId ? clearDiagramEdgeWaypoints(edge) : edge))
  }, [selectedEdge, selectedEdgeId, setEdges])

  const unpinSelectedEdgeEnds = useCallback(() => {
    if (!selectedEdgeId || !canDiagramEdgeAction(selectedEdge, 'unpin')) return
    setEdges((current) => withFacingHandles(nodes, current.map((edge) => (
      edge.id === selectedEdgeId ? unpinDiagramEdgeEnds(edge) : edge
    ))))
  }, [nodes, selectedEdge, selectedEdgeId, setEdges])

  const reverseSelectedEdge = useCallback(() => {
    if (!selectedEdgeId || !canDiagramEdgeAction(selectedEdge, 'reverse')) return
    setEdges((current) => withFacingHandles(nodes, current.map((edge) => (
      edge.id === selectedEdgeId
        ? reverseDiagramEdge(edge)
        : edge
    ))))
    setEdgeContextMenu(null)
  }, [nodes, selectedEdge, selectedEdgeId, setEdges])

  const openSelectedEdgeProperties = useCallback(() => {
    if (!canDiagramEdgeAction(selectedEdge, 'format')) return
    setIsPropertiesPanelOpen(true)
    setEdgeContextMenu(null)
  }, [selectedEdge])

  const applySource = useCallback((next: string) => {
    const normalized = format === 'c4'
      ? normalizeC4PlantUml(next, c4LevelFromDiagramKey(diagramKey))
      : format === 'bpmn'
        ? toBpmnEditorSource(next)
        : next
    const graph = parseSource(normalized, format)
    setSourceDraft(normalized)
    setCanvasNodes((current) => {
      const merged = mergeCanvasLayout(current, graph.nodes)
      setCanvasEdges(current => withFacingHandles(merged, mergeDiagramSourceEdges(current, graph.edges)))
      return merged
    })
    setSelectedNodeId(null)
  }, [diagramKey, format, setCanvasEdges, setCanvasNodes])

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
    setNodes((current) => orderDiagramNode(current, selectedNodeId, action))
  }, [selectedNodeId, setNodes])

  const handleRotateSelectedNode90 = useCallback(() => {
    if (!selectedNode || selectedNode.data.kind !== 'element') return
    const angle = (((selectedNode.data.textStyle?.angle ?? 0) + 90) % 360)
    updateSelectedNodeData({ textStyle: { ...selectedNode.data.textStyle, angle } })
  }, [selectedNode, updateSelectedNodeData])

  const deleteSelected = useCallback(() => {
    let nodeIds = new Set(nodes.filter(node => node.selected).map(node => node.id))
    const edgeIds = new Set(edges.filter(edge => edge.selected).map(edge => edge.id))
    if (!nodeIds.size && !edgeIds.size) {
      if (selectedNodeId) nodeIds.add(selectedNodeId)
      else if (selectedEdgeId) edgeIds.add(selectedEdgeId)
    }
    nodeIds = deletableDiagramNodeIds(nodes, edges, nodeIds)
    setNodes(current => removeDiagramNodes(current, nodeIds))
    setEdges(current => current.filter(edge => (!edgeIds.has(edge.id) || !canDiagramEdgeAction(edge, 'delete')) && !nodeIds.has(edge.source) && !nodeIds.has(edge.target)))
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
  }, [edges, nodes, selectedEdgeId, selectedNodeId, setEdges, setNodes])

  const insertCopiedSelection = useCallback((clipboard: DiagramClipboard<ArchimateNodeData>, at?: { x: number; y: number }) => {
    if (!clipboard.nodes.length) return
    const pasted = pasteDiagramSelection(clipboard, crypto.randomUUID(), at)
    setNodes(current => [...current.map(node => ({ ...node, selected: false })), ...pasted.nodes])
    setEdges(current => [...current.map(edge => ({ ...edge, selected: false })), ...pasted.edges])
    setSelectedNodeId(pasted.nodes[0]?.id ?? null)
    setSelectedEdgeId(null)
    setClipboardError(null)
    setC4NodeMenu(null)
  }, [setEdges, setNodes])

  const copyNodeToClipboard = useCallback((nodeId: string) => {
    const copied = copyDiagramSelection(nodes, edges, nodeId)
    if (!copied.nodes.length) { setClipboardError('This selection cannot be copied.'); return }
    nodeClipboardRef.current = copied
    setHasPasteableContent(true)
    setC4NodeMenu(null)
  }, [edges, nodes])

  const deleteNode = useCallback((nodeId: string) => {
    const clicked = nodes.find(node => node.id === nodeId)
    const requested = new Set(clicked?.selected ? nodes.filter(node => node.selected).map(node => node.id) : [nodeId])
    const ids = deletableDiagramNodeIds(nodes, edges, requested)
    if (!ids.size) { setClipboardError('This selection is protected from deletion.'); return }
    setNodes(current => removeDiagramNodes(current, ids))
    setEdges(current => current.filter(edge => !ids.has(edge.source) && !ids.has(edge.target)))
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setC4NodeMenu(null)
  }, [edges, nodes, setEdges, setNodes])

  const cutNode = useCallback((nodeId: string) => {
    const copied = copyDiagramSelection(nodes, edges, nodeId)
    if (!canCutDiagramSelection(copied, nodes, edges)) {
      setClipboardError('This selection contains protected objects or connections and cannot be cut.')
      setC4NodeMenu(null)
      return
    }
    nodeClipboardRef.current = copied
    setHasPasteableContent(true)
    const ids = new Set(copied.nodes.map(node => node.id))
    setNodes(current => removeDiagramNodes(current, ids))
    setEdges(current => current.filter(edge => !ids.has(edge.source) && !ids.has(edge.target)))
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setC4NodeMenu(null)
  }, [edges, nodes, setEdges, setNodes])

  const duplicateNode = useCallback((nodeId: string) => {
    const copied = copyDiagramSelection(nodes, edges, nodeId)
    if (!copied.nodes.length) { setClipboardError('This selection cannot be duplicated.'); return }
    insertCopiedSelection(copied)
  }, [edges, insertCopiedSelection, nodes])

  const pasteCopiedNode = useCallback((at?: { x: number; y: number }) => {
    if (nodeClipboardRef.current) insertCopiedSelection(nodeClipboardRef.current, at)
  }, [insertCopiedSelection])

  const arrangeSelection = useCallback((action: DiagramArrangeAction) => {
    const next = arrangeDiagramSelection(nodes, edges, action)
    if (next.nodes === nodes) return
    setNodes(next.nodes)
    setEdges(next.edges)
    setC4NodeMenu(null)
  }, [edges, nodes, setEdges, setNodes])
  const erdMultiSelection = format === 'erd' && nodes.filter(n => n.selected).length + edges.filter(e => e.selected).length > 1
  const arrangeSelectionCount = diagramSelectedRoots(nodes).length

  const setNodeAsDefaultStyle = useCallback((nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId)
    if (!node || node.data.kind !== 'element') return
    setDefaultElementStyle({
      visual: node.data.visual ? { ...node.data.visual } : undefined,
      textStyle: node.data.textStyle ? { ...node.data.textStyle } : undefined,
    })
    setC4NodeMenu(null)
  }, [nodes])

  const refreshPasteAvailability = useCallback(() => {
    // Clipboard contents are unknown until the user explicitly chooses Paste.
    // Reading here would prompt for permission and blur/dismiss the context menu.
    setHasPasteableContent(Boolean(nodeClipboardRef.current || navigator.clipboard?.readText))
  }, [])

  const handlePaneContextMenu = useCallback((event: ReactMouseEvent | MouseEvent) => {
    event.preventDefault()
    setC4NodeMenu(null)
    void refreshPasteAvailability()
    const wrapper = reactFlowWrapperRef.current
    if (!wrapper) return
    const bounds = wrapper.getBoundingClientRect()
    setCanvasMenu({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      flowPosition: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      submenu: null,
    })
  }, [refreshPasteAvailability, screenToFlowPosition])

  const handleNodeContextMenu = useCallback((event: ReactMouseEvent | MouseEvent, node: Node<ArchimateNodeData>) => {
    event.preventDefault()
    const wrapper = reactFlowWrapperRef.current
    if (!wrapper) return
    const bounds = wrapper.getBoundingClientRect()
    setCanvasMenu(null)
    setEdgeContextMenu(null)
    setCanvasNodes((current) => node.selected ? current : current.map((item) => ({ ...item, selected: item.id === node.id })))
    setCanvasEdges((current) => node.selected ? current : current.map((edge) => ({ ...edge, selected: false })))
    setSelectedNodeId(node.id)
    setSelectedEdgeId(null)
    setC4NodeMenu({
      nodeId: node.id,
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    })
  }, [setCanvasEdges, setCanvasNodes])

  const handleNodeDoubleClick = useCallback((event: ReactMouseEvent | MouseEvent, node: Node<ArchimateNodeData>) => {
    event.preventDefault()
    if (format === 'c4' && isArchimateElementData(node.data) && node.data.diagramLink) {
      onOpenC4Drilldown?.(node.data.diagramLink)
      return
    }
    setSelectedNodeId(node.id)
    setSelectedEdgeId(null)
    setIsPropertiesPanelOpen(true)
  }, [format, onOpenC4Drilldown])

  const openNodeProperties = useCallback(() => {
    setCanvasNodes(current => current.map(node => ({ ...node, selected: node.id === selectedNodeId })))
    setCanvasEdges(current => current.map(edge => ({ ...edge, selected: false })))
    setIsPropertiesPanelOpen(true)
    setC4NodeMenu(null)
  }, [selectedNodeId, setCanvasEdges, setCanvasNodes])

  const openDiagramChat = useCallback((node?: Node<ArchimateNodeData>) => {
    const selected = node ?? nodes.find((item) => item.selected && item.data.kind === 'element')
    const selectedSummary = selected && selected.data.kind === 'element'
      ? `Selected notation: ${selected.data.title} (<<${selected.data.stereotype}>>). Description: ${selected.data.description.join(' ') || 'none'}.`
      : 'No notation is selected.'
    const selectedEdge = edges.find((item) => item.selected)
    const selectionContext = [
      selected ? `Selected notation ID: ${selected.id}.` : null,
      selectedEdge ? `Selected connection ID: ${selectedEdge.id}; source: ${selectedEdge.source}; target: ${selectedEdge.target}; label: ${String(selectedEdge.label ?? '')}.` : null,
    ].filter(Boolean).join('\n')
    requestOpenIdeaDiscussChat({
      ideaId,
      ideaTitle: `${diagramKey} diagram`,
      sectionKey: `diagram:${diagramKey}`,
      sectionLabel: `C4 diagram ${diagramKey}`,
      ideaDescription: 'Architecture diagram editing session.',
      currentSectionContent: `Target diagram key: ${diagramKey}\n${selectedSummary}\n${selectionContext}\n\nCurrent C4 source:\n${sourceDraft.slice(0, 12000)}`,
    })
    setCanvasMenu(null)
    setC4NodeMenu(null)
  }, [diagramKey, edges, ideaId, nodes, sourceDraft])

  const recordChatAudit = useCallback(async (payload: Parameters<typeof createDiagramAiDraftAudit>[2]) => {
    try {
      await createDiagramAiDraftAudit(ideaId, diagramKey, payload)
      setChatAuditWriteError(null)
      setPendingAuditWrite(null)
    } catch {
      setPendingAuditWrite(payload)
      setChatAuditWriteError('AI activity could not be saved to the audit trail.')
    }
  }, [diagramKey, ideaId])

  useEffect(() => {
    const receiveDraft = (event: Event) => {
      const draft = (event as CustomEvent<DiagramChatDraft>).detail
      if (format === 'c4' && draft?.diagramKey === diagramKey) {
        setPendingChatDraft(draft)
        void recordChatAudit({ action: 'requested', draft_json: { ...draft } })
      }
    }
    window.addEventListener('tectona:diagram-chat-draft', receiveDraft)
    return () => window.removeEventListener('tectona:diagram-chat-draft', receiveDraft)
  }, [diagramKey, format, recordChatAudit])

  const applyChatDraft = useCallback(() => {
    if (!pendingChatDraft) return
    let nextNodes = [...nodes]
    let nextEdges = [...edges]
    const usedNodeIds = new Set(nextNodes.map((node) => node.id))
    const usedEdgeIds = new Set(nextEdges.map((edge) => edge.id))
    const origin = canvasCenterPosition()
    const actionPosition = (index: number) => ({ x: origin.x + (index % 3) * 280, y: origin.y + Math.floor(index / 3) * 160 })
    pendingChatDraft.actions.forEach((action, index) => {
      if (action.type === 'add_node') {
        if (usedNodeIds.has(action.id)) return
        const item = C4_PALETTE_ITEMS.find((candidate) => candidate.kind === action.notation)
        if (!item) return
        const node = applyDefaultElementStyle(createC4NodeFromPaletteItem(item, actionPosition(index), usedNodeIds))
        if (!('title' in node.data)) return
        nextNodes.push({ ...node, id: action.id, data: { ...node.data, title: action.title, ...(action.description ? { description: [action.description] } : {}) } })
        usedNodeIds.add(action.id)
      } else if (action.type === 'update_node') {
        nextNodes = nextNodes.map((node) => {
          if (node.id !== action.nodeId || node.data.kind !== 'element') return node
          const item = action.notation ? C4_PALETTE_ITEMS.find((candidate) => candidate.kind === action.notation) : undefined
          return {
            ...node,
            data: {
              ...node.data,
              ...(action.title ? { title: action.title } : {}),
              ...(action.description ? { description: [action.description] } : {}),
              ...(item && item.kind !== 'boundary' ? { notationId: item.kind, stereotype: c4Stereotype(item.kind), visual: { ...node.data.visual, fillColor: item.fill, lineColor: isC4External(item.kind) ? '#8A8A8A' : '#3C7FC0' } } : {}),
            },
          }
        })
      } else if (action.type === 'delete_node') {
        nextNodes = nextNodes.filter((node) => node.id !== action.nodeId)
        nextEdges = nextEdges.filter((edge) => edge.source !== action.nodeId && edge.target !== action.nodeId)
      } else if (action.type === 'add_edge') {
        if (!usedEdgeIds.has(action.id) && usedNodeIds.has(action.source) && usedNodeIds.has(action.target)) {
          nextEdges.push({ id: action.id, source: action.source, target: action.target, type: 'smoothstep', ...(c4RelationEdgeStyle()), ...(action.label ? { label: action.label } : {}) })
          usedEdgeIds.add(action.id)
        }
      } else if (action.type === 'delete_edge') {
        nextEdges = nextEdges.filter((edge) => edge.id !== action.edgeId)
      }
    })
    const before = { nodes, edges, source: sourceDraft }
    const appliedNodes = nextNodes.map((node) => ({ ...node, selected: false }))
    const appliedEdges = withFacingHandles(nextNodes, nextEdges.map((edge) => ({ ...edge, selected: false })))
    setNodes(appliedNodes)
    setEdges(appliedEdges)
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setLastAppliedChatDraft({ draft: pendingChatDraft, before })
    void recordChatAudit({
      action: 'applied',
      draft_json: { ...pendingChatDraft },
      before_graph_json: before,
      after_graph_json: { nodes: appliedNodes, edges: appliedEdges },
    })
    setPendingChatDraft(null)
  }, [applyDefaultElementStyle, canvasCenterPosition, edges, nodes, pendingChatDraft, recordChatAudit, setEdges, setNodes, sourceDraft])

  const discardChatDraft = useCallback(() => {
    if (pendingChatDraft) void recordChatAudit({ action: 'discarded', draft_json: { ...pendingChatDraft } })
    setPendingChatDraft(null)
  }, [pendingChatDraft, recordChatAudit])

  const undoLastChatDraft = useCallback(() => {
    if (!lastAppliedChatDraft) return
    setNodes(lastAppliedChatDraft.before.nodes)
    setEdges(lastAppliedChatDraft.before.edges)
    setSourceDraft(lastAppliedChatDraft.before.source)
    void recordChatAudit({
      action: 'undone',
      draft_json: { ...lastAppliedChatDraft.draft },
      after_graph_json: lastAppliedChatDraft.before,
    })
    setLastAppliedChatDraft(null)
  }, [lastAppliedChatDraft, recordChatAudit, setEdges, setNodes])

  const previewNodes = useMemo(() => {
    if (!pendingChatDraft) return nodes
    const existing = new Set(nodes.map((node) => node.id))
    const anchor = nodes.find((node) => node.selected) ?? nodes[0]
    const start = anchor ? { x: anchor.position.x + 280, y: anchor.position.y } : { x: 280, y: 220 }
    let next = nodes.map((node) => ({ ...node }))
    pendingChatDraft.actions.forEach((action, index) => {
      if (action.type === 'add_node' && !existing.has(action.id)) {
        const item = C4_PALETTE_ITEMS.find((candidate) => candidate.kind === action.notation)
        if (!item) return
        const node = createC4NodeFromPaletteItem(item, { x: start.x + (index % 2) * 270, y: start.y + Math.floor(index / 2) * 150 }, existing)
        if (!('title' in node.data)) return
        next.push({ ...node, id: action.id, className: 'ai-draft-preview-add', style: { ...node.style, outline: '2px solid #16a34a', boxShadow: '0 0 0 4px rgba(22,163,74,.15)' }, data: { ...node.data, title: action.title, ...(action.description ? { description: [action.description] } : {}) } })
        existing.add(action.id)
      } else if (action.type === 'update_node' || action.type === 'delete_node') {
        next = next.map((node) => node.id !== action.nodeId ? node : {
          ...node,
          className: action.type === 'delete_node' ? 'ai-draft-preview-delete' : 'ai-draft-preview-update',
          style: { ...node.style, outline: action.type === 'delete_node' ? '2px solid #dc2626' : '2px solid #2563eb', opacity: action.type === 'delete_node' ? 0.48 : 1, boxShadow: action.type === 'delete_node' ? '0 0 0 4px rgba(220,38,38,.14)' : '0 0 0 4px rgba(37,99,235,.14)' },
        })
      }
    })
    return next
  }, [nodes, pendingChatDraft])

  const previewEdges = useMemo(() => {
    const sourceEdges = format === 'class'
      ? edges.map((edge) => {
        const stroke = String((edge.style as { stroke?: string } | undefined)?.stroke ?? '').toLowerCase()
        if (stroke && stroke !== '#e07a3d') return edge
        return {
          ...edge,
          style: { ...edge.style, stroke: '#4B5563', strokeWidth: 1.15 },
          markerEnd: edge.markerEnd ?? { type: MarkerType.ArrowClosed, color: '#4B5563', width: 10, height: 10 },
        }
      })
      : edges
    if (!pendingChatDraft) return sourceEdges
    const next = sourceEdges.map((edge) => ({ ...edge }))
    pendingChatDraft.actions.forEach((action) => {
      if (action.type === 'delete_edge') {
        const index = next.findIndex((edge) => edge.id === action.edgeId)
        if (index >= 0) next[index] = { ...next[index], style: { ...next[index].style, stroke: '#dc2626', strokeWidth: 2, strokeDasharray: '6 4' }, animated: true }
      }
      if (action.type === 'add_edge' && !next.some((edge) => edge.id === action.id)) next.push({ id: action.id, source: action.source, target: action.target, type: 'smoothstep', label: action.label, ...c4RelationEdgeStyle(), style: { stroke: '#16a34a', strokeWidth: 2, strokeDasharray: '6 4' }, animated: true })
    })
    return withFacingHandles(previewNodes, next)
  }, [edges, format, pendingChatDraft, previewNodes])

  const loadChatAudit = useCallback(async () => {
    if (format !== 'c4') return
    setChatAuditLoading(true)
    try {
      setChatAudit(await listDiagramAiDraftAudit(ideaId, diagramKey))
    } catch {
      setChatAudit([])
    } finally {
      setChatAuditLoading(false)
    }
  }, [diagramKey, format, ideaId])

  useEffect(() => {
    if (isChatAuditOpen) void loadChatAudit()
  }, [isChatAuditOpen, loadChatAudit])

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
    setCanvasNodes((current) => current.map((node) => ({ ...node, selected: selectNodes })))
    setCanvasEdges((current) => current.map((edge) => ({ ...edge, selected: selectEdges })))
    setSelectedNodeId(selectNodes ? nodes[0]?.id ?? null : null)
    setSelectedEdgeId(selectEdges ? edges[0]?.id ?? null : null)
    setCanvasMenu(null)
  }, [edges, nodes, setCanvasEdges, setCanvasNodes])

  const clearDefaultStyle = useCallback(() => {
    setDefaultElementStyle(null)
    setCanvasMenu(null)
  }, [])

  const pasteSourceAtCursor = useCallback(async () => {
    setClipboardError(null)
    if (!canvasMenu) return
    if (nodeClipboardRef.current) {
      pasteCopiedNode(canvasMenu.flowPosition)
      setCanvasMenu(null)
      return
    }
    if (!navigator.clipboard?.readText) return
    try {
      const text = await navigator.clipboard.readText()
      const parsed = parseSource(format === 'c4' ? normalizeC4PlantUml(text, c4Level) : text, format)
      if (parsed.nodes.length === 0) {
        setClipboardError('Clipboard does not contain valid diagram source.')
        return
      }
      const idSuffix = crypto.randomUUID()
      const idMap = new Map(parsed.nodes.map((node) => [node.id, `${node.id}-paste-${idSuffix}`]))
      const pastedNodes = pasteDiagramNodes(parsed.nodes, canvasMenu.flowPosition, idMap)
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
    } catch {
      setClipboardError('Could not paste. Check clipboard access and copy valid diagram source, then try again.')
    } finally {
      setCanvasMenu(null)
    }
  }, [c4Level, canvasMenu, format, pasteCopiedNode, setEdges, setNodes])

  const renderCanvasImage = useCallback(
    (nodeIds?: string[]) => renderDiagramViewportImage(reactFlowWrapperRef.current, nodes, edges, nodeIds),
    [edges, nodes],
  )

  const downloadCanvasImage = useCallback(async (mimeType: 'image/png' | 'image/jpeg') => {
    const canvas = await renderCanvasImage()
    if (canvas) await downloadDiagramImage(canvas, diagramKey, mimeType)
  }, [diagramKey, renderCanvasImage])

  const downloadCanvasSvg = useCallback(async () => {
    const uri = await renderDiagramViewportSvg(reactFlowWrapperRef.current, nodes, edges)
    if (uri) await downloadDiagramSvgDataUrl(uri, diagramKey)
  }, [diagramKey, nodes, edges])

  const downloadCanvasPdf = useCallback(async () => {
    const canvas = await renderCanvasImage()
    if (canvas) downloadDiagramPdf(canvas, diagramKey)
  }, [diagramKey, renderCanvasImage])

  const printCanvas = useCallback(async () => {
    const canvas = await renderCanvasImage()
    if (canvas) printDiagram(canvas, diagramKey)
  }, [diagramKey, renderCanvasImage])

  const copyCanvasAsImage = useCallback(async (nodeIds?: string[]) => {
    const canvas = await renderCanvasImage(nodeIds)
    try {
      if (canvas) await copyDiagramImage(canvas, diagramKey)
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
        cutNode(selectedNodeId)
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault()
        pasteCopiedNode()
        return
      }
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'd' && selectedNodeId) {
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
  }, [clearDefaultStyle, copyNodeToClipboard, cutNode, deleteNode, deleteSelected, duplicateNode, editable, pasteCopiedNode, selectCanvasElements, selectedNodeId, setNodeAsDefaultStyle])

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
  const hasSelectionInspector = isPropertiesPanelOpen && selectedElementCount === 1
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
      nodes={previewNodes}
      edges={previewEdges.map(edge => ({ ...edge, deletable: canDiagramEdgeAction(edge, 'delete') }))}
      onNodesChange={editable ? handleNodesChange : () => undefined}
      onEdgesChange={editable ? (changes) => {
        const allowed = changes.filter(change => change.type !== 'remove' || canDiagramEdgeAction(edges.find(edge => edge.id === change.id), 'delete'))
        if (allowed.some(change => change.type !== 'select')) markLocalEdit()
        onEdgesChange(allowed)
      } : () => undefined}
      onConnect={editable ? onConnect : () => undefined}
      onUndo={history.undo}
      onRedo={history.redo}
      canUndo={history.canUndo}
      canRedo={history.canRedo}
      onEdgeUpdate={editable ? onEdgeUpdate : undefined}
      onSelectionChange={editable ? handleSelectionChange : () => undefined}
      onEdgeClick={editable ? handleEdgeClick : undefined}
      onPaneClick={editable ? clearCanvasSelection : undefined}
      onPaneContextMenu={editable ? handlePaneContextMenu : undefined}
      onNodeContextMenu={editable ? handleNodeContextMenu : undefined}
      onNodeDoubleClick={format === 'c4' ? handleNodeDoubleClick : undefined}
      onEdgeContextMenu={editable ? handleEdgeContextMenu : undefined}
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
        saveGraph(storageKey, { nodes, edges, source: sourceDraft, viewport: next, snapToGrid, draftBeforeSavedGraph: editedBeforeSavedGraph })
        // Panning is view state only; it must not replace a synchronized content snapshot.
      } : undefined}
    />
  )

  const savedGraphRecovery = editable && savedGraphConflict ? (
    <>
      <div role="status" className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        <span>Saved diagram available. Local edits are kept; sync is paused.</span>
        <Button type="button" size="sm" variant="outline" onClick={() => setConfirmSavedGraph(savedGraph)}>
          <RefreshCw className="h-4 w-4" /> Reload saved diagram
        </Button>
      </div>
      <Dialog open={Boolean(confirmSavedGraph && confirmSavedGraph === savedGraph)} onOpenChange={open => {
        if (!open) setConfirmSavedGraph(undefined)
      }}>
        <DialogContent role="dialog" aria-modal="true" aria-labelledby="diagram-reload-title">
          <DialogHeader>
            <DialogTitle id="diagram-reload-title">Replace local edits?</DialogTitle>
            <DialogDescription>Reloading the saved diagram discards the local edits in this canvas.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" autoFocus onClick={() => setConfirmSavedGraph(undefined)}>Keep editing</Button>
            <Button type="button" variant="destructive" onClick={replaceWithSavedGraph}>Discard edits and reload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  ) : null

  if (!studioMode) {
    return (
      <div className={cn('relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg bg-white/75', className)}>
        {savedGraphRecovery}
        <div className="relative min-h-0 flex-1">{flowCanvas}</div>
              {clipboardError ? (
                <div role="alert" className="absolute bottom-4 left-4 z-50 flex max-w-sm items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 shadow-sm">
                  <span>{clipboardError}</span>
                  <button type="button" aria-label="Dismiss clipboard error" className="shrink-0 font-semibold" onClick={() => setClipboardError(null)}>×</button>
                </div>
              ) : null}
      </div>
    )
  }

  const studioSidebarTabs = [
    { id: 'source' as const, label: 'Source', icon: PencilLine },
    { id: 'diagram' as const, label: format === 'class' || format === 'erd' ? 'Notation' : 'Diagram', icon: Layers },
    ...(isC4 && c4Level === 'L1' ? [{ id: 'catalog' as const, label: 'Catalog', icon: AppWindow }] : []),
  ]
  const selectedImageNodeIds = nodes
    .filter((node) => node.selected && node.type !== 'archimateLegend')
    .map((node) => node.id)
  const canCopySelectedNodesAsImage = selectedImageNodeIds.length > 0
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
        c4Mode={isC4}
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
      {savedGraphRecovery}
      {editable && erdDdlSelection ? <ErdDdlDialog selection={erdDdlSelection} onClose={() => setErdDdlSelection(null)} /> : null}
      {editable && format === 'erd' && erdDdlImportOpen ? <ErdDdlImportDialog key={storageKey} onClose={() => setErdDdlImportOpen(false)} onApply={applyErdDdlImport} /> : null}
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageInputChange} />
      {!hideStudioHeader ? (
        <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3">
          <p className="text-xs font-medium text-slate-700">Process diagram</p>
          <div className="flex items-center gap-2">
            {editable && format === 'erd' ? <Button type="button" size="sm" variant="outline" onClick={() => setErdDdlImportOpen(true)}>Import SQL DDL</Button> : null}
            {isC4 ? <Button type="button" size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setIsChatAuditOpen(true)}><History className="h-3.5 w-3.5" /> AI history</Button> : null}
            {lastAppliedChatDraft ? <Button type="button" size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={undoLastChatDraft}><RotateCcw className="h-3.5 w-3.5" /> Undo AI batch</Button> : null}
          </div>
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
              {clipboardError ? (
                <div role="alert" className="absolute bottom-4 left-4 z-50 flex max-w-sm items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 shadow-sm">
                  <span>{clipboardError}</span>
                  <button type="button" aria-label="Dismiss clipboard error" className="shrink-0 font-semibold" onClick={() => setClipboardError(null)}>×</button>
                </div>
              ) : null}
          {editable && canvasMenu ? (
            <DiagramEditorMenu
              className="absolute z-50 w-64 rounded-md border border-slate-200 bg-white py-1 text-sm text-slate-700 shadow-xl"
              data-diagram-context-menu=""
              boundaryRef={reactFlowWrapperRef} point={{ x: canvasMenu.x, y: canvasMenu.y }}
              onContextMenu={(event) => event.preventDefault()}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              {format === 'erd' ? <button type="button" className="flex w-full px-3 py-2 text-left hover:bg-slate-100" onClick={() => { setCanvasMenu(null); setErdDdlImportOpen(true) }}>Import SQL DDL</button> : null}
              {format === 'erd' && nodes.some(n => n.selected && n.type === 'erdEntity') ? <button type="button" className="flex w-full px-3 py-2 text-left hover:bg-slate-100" onClick={() => { const entity = nodes.find(n => n.selected && n.type === 'erdEntity'); if (entity) setErdDdlSelection(selectErdDdlScope(nodes, edges, entity.id)); setCanvasMenu(null) }}>Generate DDL for selection</button> : null}
              <button type="button" disabled={!hasPasteableContent} className={cn('flex w-full items-center gap-2 px-3 py-2 text-left', hasPasteableContent ? 'hover:bg-slate-100' : 'cursor-not-allowed text-slate-400 opacity-50')} onClick={() => void pasteSourceAtCursor()}>
                <Copy className="h-4 w-4" /> Paste here
              </button>
              <button type="button" disabled={!canCopySelectedNodesAsImage} className={cn('flex w-full items-center gap-2 px-3 py-2 text-left', canCopySelectedNodesAsImage ? 'hover:bg-slate-100' : 'cursor-not-allowed text-slate-400 opacity-50')} onClick={() => void copyCanvasAsImage(selectedImageNodeIds)}>
                <ImageDown className="h-4 w-4" /> Copy as image
              </button>
              {isC4 ? <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={() => openDiagramChat()}><Sparkles className="h-4 w-4" /> Ask Gen AI</button> : null}
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
              <div className="relative" onMouseEnter={() => setCanvasMenu((current) => current ? { ...current, submenu: 'options' } : current)}>
                <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100">
                  <span className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Options</span><ChevronRight className="h-4 w-4" />
                </button>
                {canvasMenu.submenu === 'options' ? (
                  <DiagramEditorSubmenu className="w-64 rounded-md border border-slate-200 bg-white py-1 shadow-xl">
                    {([
                      ['Grid', showGrid, setShowGrid, Grid3X3],
                      ['Snap to grid', snapToGrid, setSnapToGrid, Magnet],
                      ['Guides', showGuides, setShowGuides, MousePointer2],
                      ['Ruler', showRuler, setShowRuler, Ruler],
                      ['Connection arrows', showConnectionArrows, setShowConnectionArrows, ArrowRight],
                      ['Connection points', showConnectionPoints, setShowConnectionPoints, Crosshair],
                    ] as const).map(([label, enabled, setter, Icon]) => (
                      <button
                        type="button"
                        key={label}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100"
                        onClick={() => setter(!enabled)}
                      >
                        <span className="w-4 text-sky-500">{enabled ? <Check className="h-4 w-4" /> : null}</span>
                        <Icon className="h-4 w-4 text-slate-500" />{label}
                      </button>
                    ))}
                  </DiagramEditorSubmenu>
                ) : null}
              </div>
              <div className="relative" onMouseEnter={() => setCanvasMenu((current) => current ? { ...current, submenu: 'layout' } : current)}>
                <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100">
                  <span className="flex items-center gap-2"><LayoutTemplate className="h-4 w-4" /> Layout</span><ChevronRight className="h-4 w-4" />
                </button>
                {canvasMenu.submenu === 'layout' ? (
                  <DiagramEditorSubmenu className="w-56 rounded-md border border-slate-200 bg-white py-1 shadow-xl">
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={() => applyCanvasLayout('horizontal')}><ArrowRightLeft className="h-4 w-4" />Horizontal flow</button>
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={() => applyCanvasLayout('vertical')}><ArrowDown className="h-4 w-4" />Vertical flow</button>
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={() => applyCanvasLayout('circle')}><Circle className="h-4 w-4" />Circle</button>
                  </DiagramEditorSubmenu>
                ) : null}
              </div>
            </DiagramEditorMenu>
          ) : null}
          {editable && edgeContextMenu ? (
            <DiagramEditorMenu
              className="absolute z-50 w-60 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm text-slate-700 shadow-xl"
              data-diagram-context-menu=""
              boundaryRef={reactFlowWrapperRef} point={{ x: edgeContextMenu.x, y: edgeContextMenu.y }}
              onContextMenu={(event) => event.preventDefault()}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="px-3 py-2 text-xs font-semibold text-slate-500">Line</div>
              <div className="my-1 border-t border-slate-200" />
              <button disabled={!canDiagramEdgeAction(selectedEdge, 'format')} title={!canDiagramEdgeAction(selectedEdge, 'format') ? 'Disabled by connector properties' : undefined} type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={openSelectedEdgeProperties}>
                <Settings2 className="h-4 w-4" /> Format...
              </button>
              <button disabled={!canDiagramEdgeAction(selectedEdge, 'reverse')} title={!canDiagramEdgeAction(selectedEdge, 'reverse') ? 'Disabled by connector properties' : undefined} type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={reverseSelectedEdge}>
                <ArrowRightLeft className="h-4 w-4" /> Reverse
              </button>
              <button disabled={!canDiagramEdgeAction(selectedEdge, 'clearWaypoints')} title={!canDiagramEdgeAction(selectedEdge, 'clearWaypoints') ? 'Disabled by connector properties' : undefined} type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={() => { clearSelectedEdgeWaypoints(); setEdgeContextMenu(null) }}>
                <Waypoints className="h-4 w-4" /> Clear Waypoints
              </button>
              <button disabled={!canDiagramEdgeAction(selectedEdge, 'unpin')} title={!canDiagramEdgeAction(selectedEdge, 'unpin') ? 'Disabled by connector properties' : undefined} type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={() => { unpinSelectedEdgeEnds(); setEdgeContextMenu(null) }}>
                <Unlink className="h-4 w-4" /> Unpin Connector Ends
              </button>
              <div className="my-1 border-t border-slate-200" />
              <button disabled={!canDiagramEdgeAction(selectedEdge, 'delete')} title={!canDiagramEdgeAction(selectedEdge, 'delete') ? 'Disabled by connector properties' : undefined} type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-700 hover:bg-red-50" onClick={() => { deleteSelected(); setEdgeContextMenu(null) }}>
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </DiagramEditorMenu>
          ) : null}
          {editable && c4NodeMenu && c4MenuNode && c4MenuNode.data.kind !== 'legend' ? (
            <DiagramEditorMenu
              className="absolute z-50 w-60 rounded-md border border-slate-200 bg-white py-1 text-sm text-slate-700 shadow-xl"
              data-diagram-context-menu=""
              boundaryRef={reactFlowWrapperRef} point={{ x: c4NodeMenu.x, y: c4NodeMenu.y }}
              onContextMenu={(event) => event.preventDefault()}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              {format === 'erd' && c4MenuNode.type === 'erdEntity' ? <>
                <div className="px-3 py-2 text-xs font-semibold text-slate-500">{erdMultiSelection ? `Selection: ${nodes.filter(n => n.selected && n.type === 'erdEntity').length} entities, ${edges.filter(e => e.selected).length} relationships` : 'Entity'}</div>
                <button type="button" className="flex w-full px-3 py-2 text-left hover:bg-slate-100" onClick={() => { setErdDdlSelection(selectErdDdlScope(nodes, edges, c4MenuNode.id)); setC4NodeMenu(null) }}>{erdMultiSelection ? 'Generate DDL for selection' : 'Generate DDL for this entity'}</button>
              </> : null}
              <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100" onClick={() => copyNodeToClipboard(c4MenuNode.id)}>
                <span className="flex items-center gap-2"><Copy className="h-4 w-4" /> Copy</span><span className="text-xs text-slate-400">Ctrl+C</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100"
                onClick={() => {
                  void copyCanvasAsImage(copyDiagramSelection(nodes, edges, c4MenuNode.id).nodes.map(node => node.id))
                  setC4NodeMenu(null)
                }}
              >
                <ImageDown className="h-4 w-4" /> Copy as image
              </button>
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" disabled={erdMultiSelection} title={erdMultiSelection ? 'Select one entity to ask about its notation' : undefined} onClick={() => openDiagramChat(c4MenuNode)}>
                <Sparkles className="h-4 w-4" /> Ask Gen AI about this notation
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100"
                onClick={() => {
                  cutNode(c4MenuNode.id)
                }}
              >
                <span className="flex items-center gap-2"><Scissors className="h-4 w-4" /> Cut</span><span className="text-xs text-slate-400">Ctrl+X</span>
              </button>
              <div className="my-1 border-t border-slate-200" />
              <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100" onClick={() => duplicateNode(c4MenuNode.id)}>
                <span className="flex items-center gap-2"><Copy className="h-4 w-4" /> Duplicate</span><span className="text-xs text-slate-400">Ctrl+D</span>
              </button>
              <div className="my-1 border-t border-slate-200" />
              <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100" onClick={() => { if (c4MenuNode.selected && nodes.filter(n => n.selected).length + edges.filter(e => e.selected).length > 1) { deleteSelected(); setC4NodeMenu(null) } else deleteNode(c4MenuNode.id) }}>
                <span className="flex items-center gap-2"><Trash2 className="h-4 w-4" /> Delete</span><span className="text-xs text-slate-400">Delete</span>
              </button>
              <div className="my-1 border-t border-slate-200" />
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" disabled={erdMultiSelection} title={erdMultiSelection ? "Select one entity to edit its styles" : "Styles apply to the right-clicked object"} onClick={openNodeProperties}>
                <Paintbrush className="h-4 w-4" /> Styles &amp; formatting
              </button>
              {c4MenuNode.data.kind === 'element' ? (
                <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100" disabled={erdMultiSelection} title="Use the right-clicked object as the insertion default" onClick={() => setNodeAsDefaultStyle(c4MenuNode.id)}>
                  <span className="flex items-center gap-2"><Paintbrush className="h-4 w-4" /> Set as default style</span><span className="text-xs text-slate-400">Ctrl+Shift+D</span>
                </button>
              ) : null}
              <div className="my-1 border-t border-slate-200" />
              <div className="relative" onMouseEnter={() => setC4NodeMenu((current) => current ? { ...current, submenu: 'arrange' } : current)}>
                <button type="button" aria-haspopup="menu" aria-expanded={c4NodeMenu.submenu === 'arrange'} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100" onClick={() => setC4NodeMenu((current) => current ? { ...current, submenu: 'arrange' } : current)}>
                  <span>Align / Distribute</span><ChevronRight className="h-4 w-4" />
                </button>
                {c4NodeMenu.submenu === 'arrange' ? (
                  <DiagramEditorSubmenu className="w-56 rounded-md border border-slate-200 bg-white py-1 shadow-xl">
                    {DIAGRAM_ARRANGE_ACTIONS.map(({ action, label, minimum }) => (
                      <button key={action} type="button" disabled={arrangeSelectionCount < minimum} title={arrangeSelectionCount < minimum ? `Select at least ${minimum} movable objects` : label} className="flex w-full px-3 py-2 text-left hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => arrangeSelection(action)}>{label}</button>
                    ))}
                  </DiagramEditorSubmenu>
                ) : null}
              </div>
              {!erdMultiSelection ? <div className="relative" onMouseEnter={() => setC4NodeMenu((current) => current ? { ...current, submenu: 'order' } : current)}>
                <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100">
                  <span title="Order applies to the right-clicked object" className="flex items-center gap-2"><Layers className="h-4 w-4" /> Order</span><ChevronRight className="h-4 w-4" />
                </button>
                {c4NodeMenu.submenu === 'order' ? (
                  <DiagramEditorSubmenu className="w-56 rounded-md border border-slate-200 bg-white py-1 shadow-xl">
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={() => { handleLayerAction('front'); setC4NodeMenu(null) }}><ChevronsUp className="h-4 w-4" />Bring to front</button>
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={() => { handleLayerAction('forward'); setC4NodeMenu(null) }}><ArrowRight className="h-4 w-4" />Bring forward</button>
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={() => { handleLayerAction('backward'); setC4NodeMenu(null) }}><ArrowDown className="h-4 w-4" />Send backward</button>
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={() => { handleLayerAction('back'); setC4NodeMenu(null) }}><ChevronsDown className="h-4 w-4" />Send to back</button>
                  </DiagramEditorSubmenu>
                ) : null}
              </div>
              : null}
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
            </DiagramEditorMenu>
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
                    onChange={next => {
                      if (next !== sourceDraft) markLocalEdit()
                      setSourceDraft(next)
                    }}
                    onBlur={applySource}
                    languageLabel={
                      format === 'bpmn' ? 'BPMN PlantUML'
                        : format === 'c4' ? 'C4 PlantUML'
                          : format === 'class' ? 'Class PlantUML'
                            : format === 'erd' ? 'ERD PlantUML'
                              : 'PlantUML'
                    }
                  />
                ) : isC4 && sidebarPanel === 'catalog' ? (
                  <C4ApplicationCatalogPalette
                    applications={applicationCatalog}
                    loading={applicationCatalogLoading}
                    existingNames={new Set(nodes.flatMap(({ data }) => data.kind === 'element' ? [data.title.trim().toLowerCase()] : []))}
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
                ) : format === 'class' || format === 'erd' || format === 'use-case' ? (
                  <UmlNotationPalette
                    view={format}
                    selectedRelation={umlRelation}
                    onDragStart={handleUmlPaletteDragStart}
                    onSelectRelation={setUmlRelation}
                    onAddNode={addUmlPaletteNode}
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
      {editable && format === 'erd' && hideStudioHeader ? <div className="absolute right-3 top-3 z-30 flex gap-2"><Button type="button" size="sm" variant="outline" className="bg-white/95 shadow-sm" onClick={() => setErdDdlImportOpen(true)}>Import SQL DDL</Button></div> : null}
      {isC4 && hideStudioHeader ? (
        <div className="pointer-events-none absolute right-3 top-3 z-30 flex gap-2">
          <Button type="button" size="icon" variant="outline" className="pointer-events-auto h-8 w-8 bg-white/95 shadow-sm" title="AI history" onClick={() => setIsChatAuditOpen(true)}><History className="h-4 w-4" /></Button>
          {lastAppliedChatDraft ? <Button type="button" size="icon" variant="outline" className="pointer-events-auto h-8 w-8 bg-white/95 shadow-sm" title="Undo AI batch" onClick={undoLastChatDraft}><RotateCcw className="h-4 w-4" /></Button> : null}
        </div>
      ) : null}
      {chatAuditWriteError ? (
        <div className="absolute bottom-3 right-3 z-30 flex max-w-sm items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-sm">
          <span>{chatAuditWriteError}</span>
          {pendingAuditWrite ? <Button type="button" size="sm" variant="outline" className="h-7 border-amber-300 bg-white text-xs" onClick={() => void recordChatAudit(pendingAuditWrite)}>Retry</Button> : null}
        </div>
      ) : null}
      <Dialog
        open={Boolean(pendingChatDraft)}
        onOpenChange={(open) => {
          if (!open) setPendingChatDraft(null)
        }}
      >
        <DialogContent className="w-[min(36rem,calc(100vw-2rem))] p-0">
          <DialogHeader className="border-b border-slate-200 px-5 py-4">
            <DialogTitle className="text-base">Apply AI diagram draft</DialogTitle>
            <DialogDescription>
              Review the proposed C4 changes before they are applied to this canvas.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[52vh] space-y-3 overflow-y-auto p-5">
            {pendingChatDraft?.summary ? <p className="text-sm leading-6 text-slate-600">{pendingChatDraft.summary}</p> : null}
            <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Visual preview</p>
              <div className="grid grid-cols-2 gap-2">
                {pendingChatDraft?.actions.filter((action) => action.type === 'add_node' || action.type === 'update_node' || action.type === 'delete_node').map((action, index) => (
                  <div key={`preview-${index}`} className={cn('min-h-14 rounded border px-2 py-2 text-xs', action.type === 'delete_node' ? 'border-rose-200 bg-rose-50 text-rose-800 line-through' : action.type === 'add_node' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-sky-200 bg-sky-50 text-sky-800')}>
                    <span className="block font-semibold">{action.type === 'add_node' ? action.title : action.nodeId}</span>
                    <span className="mt-1 block opacity-80">{action.type === 'add_node' ? action.notation : action.type === 'delete_node' ? 'Removed from canvas' : 'Updated on canvas'}</span>
                  </div>
                ))}
              </div>
              {pendingChatDraft?.actions.some((action) => action.type === 'add_edge' || action.type === 'delete_edge') ? <div className="mt-3 space-y-1 border-t border-slate-200 pt-2 text-xs text-slate-600">{pendingChatDraft.actions.filter((action) => action.type === 'add_edge' || action.type === 'delete_edge').map((action, index) => <p key={`edge-preview-${index}`}>{action.type === 'add_edge' ? `${action.source} -> ${action.target}` : `Remove connection ${action.edgeId}`}</p>)}</div> : null}
            </div>
            <ol className="space-y-2 text-sm text-slate-700">
              {pendingChatDraft?.actions.map((action, index) => (
                <li key={`${action.type}-${index}`} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  {action.type === 'add_node' ? `Add ${action.notation}: ${action.title}` : null}
                  {action.type === 'update_node' ? `Update notation: ${action.nodeId}` : null}
                  {action.type === 'delete_node' ? `Delete notation: ${action.nodeId}` : null}
                  {action.type === 'add_edge' ? `Connect ${action.source} to ${action.target}${action.label ? `: ${action.label}` : ''}` : null}
                  {action.type === 'delete_edge' ? `Delete connection: ${action.edgeId}` : null}
                </li>
              ))}
            </ol>
          </div>
          <DialogFooter className="border-t border-slate-200 px-5 py-4">
            <Button type="button" variant="outline" onClick={discardChatDraft}>Discard</Button>
            <Button type="button" onClick={applyChatDraft}>Apply draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isChatAuditOpen} onOpenChange={setIsChatAuditOpen}>
        <DialogContent className="w-[min(40rem,calc(100vw-2rem))] p-0">
          <DialogHeader className="border-b border-slate-200 px-5 py-4">
            <DialogTitle className="text-base">AI diagram history</DialogTitle>
            <DialogDescription>Draft activity recorded for this diagram.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto p-5">
            {chatAuditLoading ? <p className="text-sm text-slate-500">Loading history...</p> : null}
            {!chatAuditLoading && chatAudit.length === 0 ? <p className="text-sm text-slate-500">No AI draft activity has been recorded.</p> : null}
            <ol className="space-y-3">
              {chatAudit.map((entry) => (
                <li key={entry.id} className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-800">{chatAuditLabel(entry.action)}</p>
                    <time className="shrink-0 text-xs text-slate-500">{new Date(entry.created_at).toLocaleString()}</time>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{entry.actor_id}</p>
                  {chatAuditDraftSummary(entry.draft_json) ? <p className="mt-2 text-sm text-slate-700">{chatAuditDraftSummary(entry.draft_json)}</p> : null}
                  {chatAuditSnapshotSummary(entry.before_graph_json) ? <p className="mt-2 text-xs text-slate-500">Before: {chatAuditSnapshotSummary(entry.before_graph_json)}</p> : null}
                  {chatAuditSnapshotSummary(entry.after_graph_json) ? <p className="mt-1 text-xs text-slate-500">After: {chatAuditSnapshotSummary(entry.after_graph_json)}</p> : null}
                </li>
              ))}
            </ol>
          </div>
          <DialogFooter className="border-t border-slate-200 px-5 py-4">
            <Button type="button" variant="outline" onClick={() => void loadChatAudit()}>Refresh</Button>
            <Button type="button" onClick={() => setIsChatAuditOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  const tenant = useTenantContextOptional()
  const scope = JSON.stringify([tenant?.workspaceId ?? null, props.ideaId, props.diagramKey])
  return (
    <ReactFlowProvider key={scope}>
      <EditableDiagramCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
