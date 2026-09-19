import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { ArrowDown, ArrowRight, ArrowRightLeft, Check, ChevronRight, ChevronsLeft, ChevronsRight, Circle, Copy, Crosshair, Grid3X3, GripVertical, ImageDown, Layers, LayoutTemplate, ListChecks, Magnet, MousePointer2, Paintbrush, PencilLine, Ruler, Settings2, Sparkles, Waypoints } from 'lucide-react'
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
  type OnSelectionChangeFunc,
  type Viewport,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { enterpriseIndigoGradientActionButtonClass } from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'
import { IntegrationArchitectureFlow } from '@/modules/project-management/components/IntegrationArchitectureFlow'
import { PlantUmlSourceEditor } from '@/modules/project-management/components/PlantUmlSourceEditor'
import { ArchimateNotationPalette } from '@/modules/project-management/components/ArchimateNotationPalette'
import { DiagramEdgePropertiesPanel } from '@/modules/project-management/components/DiagramEdgePropertiesPanel'
import { IntegrationNodePropertiesPanel } from '@/modules/project-management/components/IntegrationNodePropertiesPanel'
import {
  cloneDefaultIntegrationArchitecture,
  isIntegrationNodeContainable,
  normalizeIntegrationNodesForCanvas,
} from '@/modules/project-management/lib/integrationArchitectureDefaults'
import {
  isCanvasViewport,
  loadIntegrationGraph,
  saveIntegrationGraph,
  type CanvasViewport,
  type IntegrationGraphRecord,
} from '@/modules/project-management/lib/integrationGraphStorage'
import { DEFAULT_INTEGRATION_PLANTUML } from '@/modules/project-management/lib/integrationPlantUmlDefaults'
import {
  integrationGraphToPlantUml,
  parsePlantUmlToIntegrationGraph,
  pickAnchoredHandles,
} from '@/modules/project-management/lib/parsePlantUmlToIntegrationGraph'
import {
  ARCHIMATE_GENERAL_PALETTE_ITEMS,
  ARCHIMATE_PALETTE_MIME,
  createNodeFromPaletteItem,
  type ArchimatePaletteItem,
} from '@/modules/project-management/lib/integrationArchimatePalette'
import type { ArchimateNodeData } from '@/modules/project-management/lib/integrationArchitectureTypes'

type IntegrationViewMode = 'canvas' | 'source' | 'notations'
type StudioSidebarPanel = 'source' | 'notations'
type CanvasMenuSubmenu = 'options' | 'layout' | null
type CanvasContextMenuState = {
  x: number
  y: number
  flowPosition: { x: number; y: number }
  submenu: CanvasMenuSubmenu
}

const STUDIO_PANEL_MARGIN_PX = 12
const STUDIO_PANEL_DEFAULT_POSITION = { x: STUDIO_PANEL_MARGIN_PX, y: STUDIO_PANEL_MARGIN_PX }
const STUDIO_PANEL_SCROLL_CLASS =
  'overflow-y-auto overscroll-y-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
const STUDIO_FOOTER_ACTIONS_CLASS =
  'flex shrink-0 items-stretch gap-2 border-t border-white/35 bg-white/15 p-2 [&>button]:min-w-0 [&>button]:flex-1 [&>button]:justify-center'
const SOURCE_APPLY_DEBOUNCE_MS = 150
const PRESERVED_SOURCE_SYNC_NODE_IDS = new Set(['legend', 'canvas-notes'])
const SOURCE_ACTION_BUTTON_CLASS = cn(
  enterpriseIndigoGradientActionButtonClass(),
  'min-w-0 flex-1 justify-center',
)

type EditableIntegrationArchitectureCanvasProps = {
  ideaId: string
  bootstrapKey?: number
  bootstrapRecord?: IntegrationGraphRecord | null
  isGenerating?: boolean
  fillHeight?: boolean
  toolbarExtra?: ReactNode
  /** Floating info panels rendered inside the canvas studio (status, brief, alerts). */
  studioOverlay?: ReactNode
  studioTitle?: string
  /** When true, outer page shell owns the panel title (Project List style header). */
  hideStudioHeader?: boolean
  /** Persists user edits to the idea record after the local canvas cache is updated. */
  onPersistGraph?: (graph: IntegrationGraphRecord) => void
}

function EditableIntegrationArchitectureCanvasInner({
  ideaId,
  bootstrapKey = 0,
  bootstrapRecord = null,
  isGenerating = false,
  fillHeight = false,
  toolbarExtra = null,
  studioOverlay = null,
  studioTitle = 'Integration diagram',
  hideStudioHeader = false,
  onPersistGraph,
}: EditableIntegrationArchitectureCanvasProps) {
  const defaultGraph = useMemo(() => cloneDefaultIntegrationArchitecture(), [])
  const saveTimerRef = useRef<number | null>(null)
  const sourceApplyTimerRef = useRef<number | null>(null)
  const plantumlSourceRef = useRef('')
  const skipNextSaveRef = useRef(false)
  const skipSourceApplyRef = useRef(true)
  const reactFlowWrapperRef = useRef<HTMLDivElement | null>(null)
  const canvasZoneRef = useRef<HTMLDivElement | null>(null)
  const studioPanelShellRef = useRef<HTMLDivElement | null>(null)
  const propertiesPanelShellRef = useRef<HTMLDivElement | null>(null)
  const studioPanelDragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const propertiesPanelDragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const { screenToFlowPosition } = useReactFlow()

  const initialState = useMemo(() => {
    const stored = loadIntegrationGraph(ideaId)
    if (stored) {
      return {
        nodes: normalizeIntegrationNodesForCanvas(stored.nodes),
        edges: stored.edges,
        plantumlSource: stored.plantumlSource ?? DEFAULT_INTEGRATION_PLANTUML,
        userCustomized: stored.userCustomized,
        viewport: isCanvasViewport(stored.viewport) ? stored.viewport : undefined,
        snapToGrid: stored.snapToGrid,
      }
    }
    return {
      nodes: defaultGraph.nodes,
      edges: defaultGraph.edges,
      plantumlSource: DEFAULT_INTEGRATION_PLANTUML,
      userCustomized: false,
      viewport: undefined as CanvasViewport | undefined,
      snapToGrid: undefined as boolean | undefined,
    }
  }, [ideaId, defaultGraph])

  const [nodes, setNodes, onNodesChange] = useNodesState<ArchimateNodeData>(initialState.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialState.edges)
  const [plantumlSource, setPlantumlSource] = useState(initialState.plantumlSource)
  useEffect(() => {
    plantumlSourceRef.current = plantumlSource
  }, [plantumlSource])
  const [userCustomized, setUserCustomized] = useState(initialState.userCustomized)
  const [savedViewport, setSavedViewport] = useState<CanvasViewport | undefined>(initialState.viewport)
  const viewportRef = useRef<CanvasViewport | undefined>(initialState.viewport)
  const viewportPersistTimerRef = useRef<number | null>(null)
  const [viewMode, setViewMode] = useState<IntegrationViewMode>('canvas')
  const [sidebarPanel, setSidebarPanel] = useState<StudioSidebarPanel>('source')
  const [canvasMenu, setCanvasMenu] = useState<CanvasContextMenuState | null>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [showGuides, setShowGuides] = useState(true)
  const [snapToGrid, setSnapToGrid] = useState(initialState.snapToGrid ?? true)
  const [showRuler, setShowRuler] = useState(true)
  const [showConnectionArrows, setShowConnectionArrows] = useState(true)
  const [showConnectionPoints, setShowConnectionPoints] = useState(true)
  const [studioPanelPosition, setStudioPanelPosition] = useState(STUDIO_PANEL_DEFAULT_POSITION)
  const [isStudioPanelDragging, setIsStudioPanelDragging] = useState(false)
  const [isStudioPanelCollapsed, setIsStudioPanelCollapsed] = useState(false)
  const [propertiesPanelPosition, setPropertiesPanelPosition] = useState<{ x: number; y: number } | null>(null)
  const [isPropertiesPanelDragging, setIsPropertiesPanelDragging] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [applyWarnings, setApplyWarnings] = useState<string[]>([])

  const persistGraph = useCallback(
    (
      nextNodes: Node<ArchimateNodeData>[],
      nextEdges: Edge[],
      nextPlantumlSource: string,
      customized: boolean,
      nextViewport: CanvasViewport | undefined = viewportRef.current,
    ) => {
      const graph = {
        nodes: nextNodes,
        edges: nextEdges,
        plantumlSource: nextPlantumlSource,
        userCustomized: customized,
        savedAt: new Date().toISOString(),
        viewport: nextViewport,
        snapToGrid,
      }
      saveIntegrationGraph(ideaId, graph)
      onPersistGraph?.(graph)
    },
    [ideaId, onPersistGraph, snapToGrid],
  )

  const persistViewport = useCallback(
    (viewport: Viewport) => {
      const nextViewport: CanvasViewport = { x: viewport.x, y: viewport.y, zoom: viewport.zoom }
      viewportRef.current = nextViewport
      const stored = loadIntegrationGraph(ideaId)
      const graph: IntegrationGraphRecord = {
        nodes: stored?.nodes ?? nodes,
        edges: stored?.edges ?? edges,
        plantumlSource: stored?.plantumlSource ?? plantumlSourceRef.current,
        userCustomized: stored?.userCustomized ?? userCustomized,
        savedAt: new Date().toISOString(),
        viewport: nextViewport,
        snapToGrid: stored?.snapToGrid ?? snapToGrid,
      }
      saveIntegrationGraph(ideaId, graph)
      if (viewportPersistTimerRef.current) window.clearTimeout(viewportPersistTimerRef.current)
      viewportPersistTimerRef.current = window.setTimeout(() => {
        onPersistGraph?.(graph)
      }, 500)
    },
    [edges, ideaId, nodes, onPersistGraph, snapToGrid, userCustomized],
  )

  useEffect(() => {
    skipNextSaveRef.current = true
    skipSourceApplyRef.current = true
    const stored = loadIntegrationGraph(ideaId)
    if (stored) {
      setNodes(normalizeIntegrationNodesForCanvas(stored.nodes))
      setEdges(stored.edges)
      setPlantumlSource(stored.plantumlSource ?? DEFAULT_INTEGRATION_PLANTUML)
      setUserCustomized(stored.userCustomized)
      viewportRef.current = isCanvasViewport(stored.viewport) ? stored.viewport : undefined
      setSavedViewport(viewportRef.current)
      setSnapToGrid(stored.snapToGrid ?? true)
    } else {
      setNodes(defaultGraph.nodes)
      setEdges(defaultGraph.edges)
      setPlantumlSource(DEFAULT_INTEGRATION_PLANTUML)
      setUserCustomized(false)
      viewportRef.current = undefined
      setSavedViewport(undefined)
      setSnapToGrid(true)
    }
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setApplyError(null)
    setApplyWarnings([])
    setViewMode('canvas')
    setSidebarPanel('source')
    setStudioPanelPosition(STUDIO_PANEL_DEFAULT_POSITION)
    setIsStudioPanelCollapsed(false)
  }, [ideaId, defaultGraph, setEdges, setNodes])

  useEffect(() => {
    if (!bootstrapRecord) return
    const localGraph = loadIntegrationGraph(ideaId)
    const localSavedAt = localGraph?.savedAt ? Date.parse(localGraph.savedAt) : Number.NEGATIVE_INFINITY
    const remoteSavedAt = bootstrapRecord.savedAt ? Date.parse(bootstrapRecord.savedAt) : Number.NEGATIVE_INFINITY
    // Preserve a newer, manually edited browser layout while upgrading it to the
    // server-backed record. Generated or stale cached graphs never win this check.
    if (localGraph?.userCustomized && localSavedAt > remoteSavedAt) {
      skipNextSaveRef.current = true
      skipSourceApplyRef.current = true
      setNodes(normalizeIntegrationNodesForCanvas(localGraph.nodes))
      setEdges(localGraph.edges)
      setPlantumlSource(localGraph.plantumlSource ?? DEFAULT_INTEGRATION_PLANTUML)
      setUserCustomized(true)
      viewportRef.current = isCanvasViewport(localGraph.viewport) ? localGraph.viewport : viewportRef.current
      setSavedViewport(viewportRef.current)
      setSnapToGrid(localGraph.snapToGrid ?? true)
      onPersistGraph?.(localGraph)
      return
    }
    skipNextSaveRef.current = true
    skipSourceApplyRef.current = true
    // Always sync from the backend-confirmed record, even when it's genuinely empty (e.g. AI
    // returned insufficient_data) — skipping the update here left whatever the mount-time
    // localStorage/default fallback had rendered untouched, so a fresh empty result could never
    // clear out stale (possibly pre-bugfix, possibly unrelated) cached content.
    setNodes(normalizeIntegrationNodesForCanvas(bootstrapRecord.nodes))
    setEdges(bootstrapRecord.edges)
    setPlantumlSource(bootstrapRecord.plantumlSource ?? DEFAULT_INTEGRATION_PLANTUML)
    setUserCustomized(bootstrapRecord.userCustomized)
    const nextViewport = loadIntegrationGraph(ideaId)?.viewport ?? bootstrapRecord.viewport
    if (isCanvasViewport(nextViewport)) {
      viewportRef.current = nextViewport
      setSavedViewport(nextViewport)
    }
    setSnapToGrid(bootstrapRecord.snapToGrid ?? true)
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setApplyError(null)
    setApplyWarnings([])
  }, [bootstrapKey, bootstrapRecord, ideaId, onPersistGraph, setEdges, setNodes])

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      return
    }
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      const nextSource = integrationGraphToPlantUml(nodes, edges)
      skipSourceApplyRef.current = true
      setPlantumlSource(nextSource)
      persistGraph(nodes, edges, nextSource, userCustomized)
    }, 400)
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    }
  }, [nodes, edges, snapToGrid, userCustomized, persistGraph])

  useEffect(() => {
    return () => {
      if (viewportPersistTimerRef.current) window.clearTimeout(viewportPersistTimerRef.current)
      const stored = loadIntegrationGraph(ideaId)
      if (!stored || !viewportRef.current) return
      saveIntegrationGraph(ideaId, {
        ...stored,
        viewport: viewportRef.current,
        savedAt: new Date().toISOString(),
      })
    }
  }, [ideaId])

  const markCustomized = useCallback(() => setUserCustomized(true), [])

  const onConnect = useCallback(
    (connection: Connection) => {
      markCustomized()
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed, color: '#334155' },
            style: { stroke: '#334155', strokeWidth: 2 },
          },
          current,
        ),
      )
    },
    [markCustomized, setEdges],
  )

  const onEdgeUpdate = useCallback(
    (oldEdge: Edge, connection: Connection) => {
      markCustomized()
      setEdges((current) =>
        updateEdge(oldEdge, connection, current).map((edge) => (
          edge.id === oldEdge.id ? { ...edge, selected: true } : edge
        )),
      )
    },
    [markCustomized, setEdges],
  )

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      const moved = changes.some((change) => change.type === 'position' && change.dragging === false)
      if (moved) markCustomized()
      onNodesChange(changes)
    },
    [markCustomized, onNodesChange],
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

  const updateSelectedEdge = useCallback((patch: Partial<Edge>) => {
    if (!selectedEdgeId) return
    markCustomized()
    setEdges((current) => current.map((edge) => {
      if (edge.id !== selectedEdgeId) return edge
      return {
        ...edge,
        ...patch,
        style: { ...edge.style, ...patch.style },
        data: patch.data ? { ...edge.data, ...patch.data } : edge.data,
      }
    }))
  }, [markCustomized, selectedEdgeId, setEdges])

  const clearSelectedEdgeWaypoints = useCallback(() => {
    if (!selectedEdgeId) return
    markCustomized()
    setEdges((current) => {
      const nodeById = new Map(nodes.map((node) => [node.id, node]))
      const absolutePosition = (node: Node<ArchimateNodeData>): { x: number; y: number } => {
        if (!node.parentNode) return node.position
        const parent = nodeById.get(node.parentNode)
        if (!parent) return node.position
        const parentPosition = absolutePosition(parent)
        return { x: parentPosition.x + node.position.x, y: parentPosition.y + node.position.y }
      }
      const geometry = (nodeId: string) => {
        const node = nodeById.get(nodeId)
        if (!node) return null
        const position = absolutePosition(node)
        const width = Number(node.measured?.width ?? node.width ?? node.style?.width ?? 0)
        const height = Number(node.measured?.height ?? node.height ?? node.style?.height ?? 0)
        if (!width || !height) return null
        return { x: position.x, y: position.y, width, height }
      }
      return current.map((edge) => {
        if (edge.id !== selectedEdgeId) return edge
        const sourceGeometry = geometry(edge.source)
        const targetGeometry = geometry(edge.target)
        const handles = sourceGeometry && targetGeometry ? pickAnchoredHandles(sourceGeometry, targetGeometry) : undefined
        return {
          ...edge,
          sourceHandle: handles?.sourceHandle,
          targetHandle: handles?.targetHandle,
        }
      })
    })
  }, [markCustomized, nodes, selectedEdgeId, setEdges])

  const updateSelectedNodeData = useCallback(
    (patch: Record<string, unknown>) => {
      if (!selectedNodeId) return
      markCustomized()
      setNodes((current) => {
        const selected = current.find((node) => node.id === selectedNodeId)
        if (!selected) return current

        const nextSelected = { ...selected, data: { ...selected.data, ...patch } as ArchimateNodeData }
        const containable = patch.arrange?.containable
        if (typeof containable !== 'boolean') {
          return current.map((node) => (node.id === selectedNodeId ? nextSelected : node))
        }

        if (containable) {
          return normalizeIntegrationNodesForCanvas(
            current.map((node) => (node.id === selectedNodeId ? nextSelected : node)),
          )
        }

        const absolutePosition = (node: typeof selected): { x: number; y: number } => {
          if (!node.parentNode) return node.position
          const parent = current.find((candidate) => candidate.id === node.parentNode)
          if (!parent) return node.position
          const parentPosition = absolutePosition(parent)
          return { x: parentPosition.x + node.position.x, y: parentPosition.y + node.position.y }
        }

        const detachedChildren = new Set(
          current.filter((node) => node.parentNode === selectedNodeId).map((node) => node.id),
        )
        return normalizeIntegrationNodesForCanvas(current.map((node) => {
          if (node.id === selectedNodeId) return nextSelected
          if (!detachedChildren.has(node.id)) return node
          return { ...node, parentNode: undefined, extent: undefined, position: absolutePosition(node) }
        }))
      })
    },
    [markCustomized, selectedNodeId, setNodes],
  )


  const updateSelectedNodeSize = useCallback(
    (width: number, height: number) => {
      if (!selectedNodeId) return
      markCustomized()
      setNodes((current) =>
        current.map((node) =>
          node.id === selectedNodeId
            ? { ...node, style: { ...node.style, width: Math.max(24, width), height: Math.max(24, height) } }
            : node,
        ),
      )
    },
    [markCustomized, selectedNodeId, setNodes],
  )

  const updateSelectedNodePosition = useCallback(
    (x: number, y: number) => {
      if (!selectedNodeId) return
      markCustomized()
      setNodes((current) =>
        current.map((node) => (node.id === selectedNodeId ? { ...node, position: { x, y } } : node)),
      )
    },
    [markCustomized, selectedNodeId, setNodes],
  )

  const handleLayerAction = useCallback(
    (action: 'front' | 'back' | 'forward' | 'backward') => {
      if (!selectedNodeId) return
      markCustomized()
      setNodes((current) => {
        const ordered = [...current].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
        const index = ordered.findIndex((node) => node.id === selectedNodeId)
        if (index < 0) return current

        const zValues = ordered.map((node) => node.zIndex ?? 0)
        const minZ = Math.min(...zValues, 0)
        const maxZ = Math.max(...zValues, 0)
        let nextZ = ordered[index].zIndex ?? 0

        if (action === 'front') nextZ = maxZ + 1
        if (action === 'back') nextZ = minZ - 1
        if (action === 'forward' && index < ordered.length - 1) nextZ = (ordered[index + 1].zIndex ?? 0) + 1
        if (action === 'backward' && index > 0) nextZ = Math.max(0, (ordered[index - 1].zIndex ?? 0) - 1)

        return current.map((node) => (node.id === selectedNodeId ? { ...node, zIndex: nextZ } : node))
      })
    },
    [markCustomized, selectedNodeId, setNodes],
  )

  const handleRotateSelectedNode90 = useCallback(() => {
    if (!selectedNodeId) return
    markCustomized()
    setNodes((current) =>
      current.map((node) => {
        if (node.id !== selectedNodeId) return node
        const currentAngle = node.data.textStyle?.angle ?? 0
        const nextAngle = (currentAngle + 90) % 360
        return {
          ...node,
          data: {
            ...node.data,
            textStyle: { ...node.data.textStyle, angle: nextAngle },
          } as ArchimateNodeData,
        }
      }),
    )
  }, [markCustomized, selectedNodeId, setNodes])

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      if (changes.some((change) => change.type === 'remove')) markCustomized()
      onEdgesChange(changes)
    },
    [markCustomized, onEdgesChange],
  )

  const deleteSelectedEdge = useCallback(() => {
    if (!selectedEdgeId) return
    markCustomized()
    setEdges((current) => current.filter((edge) => edge.id !== selectedEdgeId))
    setSelectedEdgeId(null)
  }, [markCustomized, selectedEdgeId, setEdges])

  const handleSelectionChange = useCallback<OnSelectionChangeFunc>(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      setSelectedNodeId(selectedNodes[0]?.id ?? null)
      setSelectedEdgeId(selectedEdges[0]?.id ?? null)
    },
    [],
  )

  const clampFloatingPanelPosition = useCallback((x: number, y: number, panelEl: HTMLDivElement | null) => {
    const zone = canvasZoneRef.current
    if (!zone || !panelEl) {
      return { x, y }
    }
    const zoneWidth = zone.clientWidth
    const zoneHeight = zone.clientHeight
    const panelWidth = panelEl.offsetWidth
    const panelHeight = panelEl.offsetHeight
    const maxX = Math.max(STUDIO_PANEL_MARGIN_PX, zoneWidth - panelWidth - STUDIO_PANEL_MARGIN_PX)
    const maxY = Math.max(STUDIO_PANEL_MARGIN_PX, zoneHeight - panelHeight - STUDIO_PANEL_MARGIN_PX)
    return {
      x: Math.min(Math.max(STUDIO_PANEL_MARGIN_PX, x), maxX),
      y: Math.min(Math.max(STUDIO_PANEL_MARGIN_PX, y), maxY),
    }
  }, [])

  const clampStudioPanelPosition = useCallback(
    (x: number, y: number) => clampFloatingPanelPosition(x, y, studioPanelShellRef.current),
    [clampFloatingPanelPosition],
  )

  const clampPropertiesPanelPosition = useCallback(
    (x: number, y: number) => clampFloatingPanelPosition(x, y, propertiesPanelShellRef.current),
    [clampFloatingPanelPosition],
  )

  const handleStudioPanelDragStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      studioPanelDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: studioPanelPosition.x,
        originY: studioPanelPosition.y,
      }
      setIsStudioPanelDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [studioPanelPosition.x, studioPanelPosition.y],
  )

  const handleStudioPanelDragMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = studioPanelDragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const next = clampStudioPanelPosition(
        drag.originX + event.clientX - drag.startX,
        drag.originY + event.clientY - drag.startY,
      )
      setStudioPanelPosition(next)
    },
    [clampStudioPanelPosition],
  )

  const handleStudioPanelDragEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = studioPanelDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    studioPanelDragRef.current = null
    setIsStudioPanelDragging(false)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  const handlePropertiesPanelDragStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      const panel = propertiesPanelShellRef.current
      const zone = canvasZoneRef.current
      if (!panel || !zone) return

      let origin = propertiesPanelPosition
      if (!origin) {
        const zoneRect = zone.getBoundingClientRect()
        const panelRect = panel.getBoundingClientRect()
        origin = clampPropertiesPanelPosition(
          panelRect.left - zoneRect.left,
          panelRect.top - zoneRect.top,
        )
        setPropertiesPanelPosition(origin)
      }

      propertiesPanelDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: origin.x,
        originY: origin.y,
      }
      setIsPropertiesPanelDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [clampPropertiesPanelPosition, propertiesPanelPosition],
  )

  const handlePropertiesPanelDragMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = propertiesPanelDragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const next = clampPropertiesPanelPosition(
        drag.originX + event.clientX - drag.startX,
        drag.originY + event.clientY - drag.startY,
      )
      setPropertiesPanelPosition(next)
    },
    [clampPropertiesPanelPosition],
  )

  const handlePropertiesPanelDragEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = propertiesPanelDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    propertiesPanelDragRef.current = null
    setIsPropertiesPanelDragging(false)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  const propertiesPanelDragHandleProps = useMemo(
    () => ({
      isDragging: isPropertiesPanelDragging,
      onPointerDown: handlePropertiesPanelDragStart,
      onPointerMove: handlePropertiesPanelDragMove,
      onPointerUp: handlePropertiesPanelDragEnd,
      onPointerCancel: handlePropertiesPanelDragEnd,
    }),
    [
      handlePropertiesPanelDragEnd,
      handlePropertiesPanelDragMove,
      handlePropertiesPanelDragStart,
      isPropertiesPanelDragging,
    ],
  )

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, draggedNode: Node<ArchimateNodeData>) => {
      if (draggedNode.type === 'archimateLegend') return

      let nextNodes: Node<ArchimateNodeData>[] = []
      setNodes((current) => {
        const currentNode = current.find((node) => node.id === draggedNode.id)
        if (!currentNode) return current
        const nodeById = new Map(current.map((node) => [node.id, node]))
        const absolutePosition = (node: Node<ArchimateNodeData>): { x: number; y: number } => {
          if (!node.parentNode) return node.position
          const parent = nodeById.get(node.parentNode)
          if (!parent) return node.position
          const parentPosition = absolutePosition(parent)
          return { x: parentPosition.x + node.position.x, y: parentPosition.y + node.position.y }
        }
        const dimensions = (node: Node<ArchimateNodeData>) => ({
          width: Number(node.measured?.width ?? node.width ?? node.style?.width ?? 0),
          height: Number(node.measured?.height ?? node.height ?? node.style?.height ?? 0),
        })
        const isDescendant = (candidateId: string, ancestorId: string) => {
          let candidate = nodeById.get(candidateId)
          const visited = new Set<string>()
          while (candidate?.parentNode && !visited.has(candidate.id)) {
            if (candidate.parentNode === ancestorId) return true
            visited.add(candidate.id)
            candidate = nodeById.get(candidate.parentNode)
          }
          return false
        }

        const movedAbsolute = draggedNode.positionAbsolute ?? absolutePosition(currentNode)
        const movedSize = dimensions(currentNode)
        const center = {
          x: movedAbsolute.x + movedSize.width / 2,
          y: movedAbsolute.y + movedSize.height / 2,
        }
        const target = current
          .filter((node) => node.id !== currentNode.id && !isDescendant(node.id, currentNode.id))
          .filter(isIntegrationNodeContainable)
          .map((node) => {
            const position = absolutePosition(node)
            const size = dimensions(node)
            return { node, position, size }
          })
          .filter(({ position, size }) =>
            center.x >= position.x &&
            center.x <= position.x + size.width &&
            center.y >= position.y &&
            center.y <= position.y + size.height,
          )
          .sort((a, b) => a.size.width * a.size.height - b.size.width * b.size.height)[0]?.node

        markCustomized()
        if (!target) {
          nextNodes = current.map((node) =>
            node.id === currentNode.id
              ? {
                  ...node,
                  parentNode: undefined,
                  extent: undefined,
                  position: movedAbsolute,
                }
              : node,
          )
          return nextNodes
        }

        const targetAbsolute = absolutePosition(target)
        nextNodes = current.map((node) =>
            node.id === currentNode.id
            ? {
                ...node,
                parentNode: target.id,
                extent: undefined,
                position: { x: movedAbsolute.x - targetAbsolute.x, y: movedAbsolute.y - targetAbsolute.y },
              }
            : node,
        )
        return nextNodes
      })

      // A fixed sourceHandle/targetHandle chosen when the diagram was first laid out keeps pointing
      // at whichever side used to face the other node — after a manual drag that side can easily be
      // wrong (the classic "arrow leaves from the back instead of the front" complaint). Refresh the
      // handle choice for every edge touching the node that just moved, using its POST-drag position.
      setEdges((current) => {
        if (nextNodes.length === 0) return current
        const nodeById = new Map(nextNodes.map((node) => [node.id, node]))
        const absolutePosition = (node: Node<ArchimateNodeData>): { x: number; y: number } => {
          if (!node.parentNode) return node.position
          const parent = nodeById.get(node.parentNode)
          if (!parent) return node.position
          const parentPosition = absolutePosition(parent)
          return { x: parentPosition.x + node.position.x, y: parentPosition.y + node.position.y }
        }
        const geometry = (nodeId: string) => {
          const node = nodeById.get(nodeId)
          if (!node) return null
          const position = absolutePosition(node)
          const width = Number(node.measured?.width ?? node.width ?? node.style?.width ?? 0)
          const height = Number(node.measured?.height ?? node.height ?? node.style?.height ?? 0)
          if (!width || !height) return null
          return { x: position.x, y: position.y, width, height }
        }

        return current.map((edge) => {
          if (edge.source !== draggedNode.id && edge.target !== draggedNode.id) return edge
          const sourceGeometry = geometry(edge.source)
          const targetGeometry = geometry(edge.target)
          if (!sourceGeometry || !targetGeometry) return edge
          const handles = pickAnchoredHandles(sourceGeometry, targetGeometry)
          return { ...edge, sourceHandle: handles.sourceHandle, targetHandle: handles.targetHandle }
        })
      })
    },
    [markCustomized, setNodes, setEdges],
  )

  const applyPlantUmlSourceToCanvas = useCallback(
    (source: string) => {
      try {
        const parsed = parsePlantUmlToIntegrationGraph(source)
        skipNextSaveRef.current = true
        let mergedNodes: Node<ArchimateNodeData>[] = []
        setNodes((current) => {
          mergedNodes = normalizeIntegrationNodesForCanvas([
            ...current.filter(
              (node) => node.type === 'archimateLegend' || PRESERVED_SOURCE_SYNC_NODE_IDS.has(node.id),
            ),
            ...parsed.nodes,
          ])
          return mergedNodes
        })
        setEdges(parsed.edges)
        setUserCustomized(true)
        setSelectedNodeId(null)
        setSelectedEdgeId(null)
        setApplyError(null)
        setApplyWarnings(parsed.warnings)
        persistGraph(mergedNodes, parsed.edges, source, true)
        if (!fillHeight) setViewMode('canvas')
      } catch (error) {
        setApplyError(error instanceof Error ? error.message : 'Gagal menerapkan PlantUML ke canvas.')
        setApplyWarnings([])
      }
    },
    [fillHeight, persistGraph, setEdges, setNodes],
  )

  const handlePlantumlSourceChange = useCallback((value: string) => {
    skipSourceApplyRef.current = false
    setPlantumlSource(value)
  }, [])

  const flushPlantumlSourceApply = useCallback(
    (sourceOverride?: string) => {
      if (sourceApplyTimerRef.current) {
        window.clearTimeout(sourceApplyTimerRef.current)
        sourceApplyTimerRef.current = null
      }
      if (skipSourceApplyRef.current) return
      applyPlantUmlSourceToCanvas(sourceOverride ?? plantumlSourceRef.current)
    },
    [applyPlantUmlSourceToCanvas],
  )

  useEffect(() => {
    if (skipSourceApplyRef.current) {
      skipSourceApplyRef.current = false
      return
    }
    if (sourceApplyTimerRef.current) window.clearTimeout(sourceApplyTimerRef.current)
    sourceApplyTimerRef.current = window.setTimeout(() => {
      applyPlantUmlSourceToCanvas(plantumlSourceRef.current)
    }, SOURCE_APPLY_DEBOUNCE_MS)
    return () => {
      if (sourceApplyTimerRef.current) window.clearTimeout(sourceApplyTimerRef.current)
    }
  }, [applyPlantUmlSourceToCanvas, plantumlSource])

  const handlePaletteDragStart = useCallback((event: DragEvent<HTMLElement>, item: ArchimatePaletteItem) => {
    event.dataTransfer.setData(ARCHIMATE_PALETTE_MIME, JSON.stringify(item))
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleCanvasDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const handleCanvasDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const raw = event.dataTransfer.getData(ARCHIMATE_PALETTE_MIME)
      if (!raw || !reactFlowWrapperRef.current) return

      let item: ArchimatePaletteItem
      try {
        item = JSON.parse(raw) as ArchimatePaletteItem
      } catch {
        return
      }

      const bounds = reactFlowWrapperRef.current.getBoundingClientRect()
      const position = screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })

      const newNode = createNodeFromPaletteItem(
        item,
        position,
        nodes.map((node) => node.id),
      )

      markCustomized()
      setNodes((current) => {
        const nodeById = new Map(current.map((node) => [node.id, node]))
        const absolutePosition = (node: Node<ArchimateNodeData>): { x: number; y: number } => {
          if (!node.parentNode) return node.position
          const parent = nodeById.get(node.parentNode)
          if (!parent) return node.position
          const parentPosition = absolutePosition(parent)
          return { x: parentPosition.x + node.position.x, y: parentPosition.y + node.position.y }
        }
        const dimensions = (node: Node<ArchimateNodeData>) => ({
          width: Number(node.measured?.width ?? node.width ?? node.style?.width ?? 200),
          height: Number(node.measured?.height ?? node.height ?? node.style?.height ?? 90),
        })
        const newSize = dimensions(newNode)
        const center = {
          x: position.x + newSize.width / 2,
          y: position.y + newSize.height / 2,
        }
        const target = current
          .filter(isIntegrationNodeContainable)
          .map((node) => {
            const targetPosition = absolutePosition(node)
            const targetSize = dimensions(node)
            return { node, position: targetPosition, size: targetSize }
          })
          .filter(({ position: targetPosition, size: targetSize }) =>
            center.x >= targetPosition.x &&
            center.x <= targetPosition.x + targetSize.width &&
            center.y >= targetPosition.y &&
            center.y <= targetPosition.y + targetSize.height,
          )
          .sort((a, b) => a.size.width * a.size.height - b.size.width * b.size.height)[0]

        if (!target) return [...current, newNode]
        const targetPosition = target.position
        return [
          ...current,
          {
            ...newNode,
            parentNode: target.node.id,
            extent: undefined,
            position: { x: position.x - targetPosition.x, y: position.y - targetPosition.y },
          },
        ]
      })
      setSelectedNodeId(newNode.id)
      setSelectedEdgeId(null)
      if (fillHeight) setSidebarPanel('source')
      else setViewMode('canvas')
    },
    [fillHeight, markCustomized, nodes, screenToFlowPosition, setNodes],
  )

  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
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
    },
    [screenToFlowPosition],
  )

  const selectCanvasElements = useCallback(
    (kind: 'nodes' | 'edges' | 'all') => {
      const selectNodes = kind === 'nodes' || kind === 'all'
      const selectEdges = kind === 'edges' || kind === 'all'
      setNodes((current) => current.map((node) => ({ ...node, selected: selectNodes })))
      setEdges((current) => current.map((edge) => ({ ...edge, selected: selectEdges })))
      setSelectedNodeId(selectNodes ? nodes[0]?.id ?? null : null)
      setSelectedEdgeId(selectEdges ? edges[0]?.id ?? null : null)
      setCanvasMenu(null)
    },
    [edges, nodes, setEdges, setNodes],
  )

  const clearDefaultStyle = useCallback(() => {
    const selectedIds = new Set(nodes.filter((node) => node.selected).map((node) => node.id))
    markCustomized()
    setNodes((current) => current.map((node) => {
      if (selectedIds.size > 0 && !selectedIds.has(node.id)) return node
      return {
        ...node,
        data: {
          ...node.data,
          visual: { ...node.data.visual, fillEnabled: false, shadow: false },
        } as ArchimateNodeData,
      }
    }))
    setCanvasMenu(null)
  }, [markCustomized, nodes, setNodes])

  const pastePlantUmlAtCursor = useCallback(async () => {
    if (!canvasMenu || !navigator.clipboard?.readText) return
    try {
      const source = await navigator.clipboard.readText()
      const parsed = parsePlantUmlToIntegrationGraph(source)
      if (parsed.nodes.length === 0) return
      const minX = Math.min(...parsed.nodes.map((node) => node.position.x))
      const minY = Math.min(...parsed.nodes.map((node) => node.position.y))
      const idSuffix = crypto.randomUUID()
      const idMap = new Map(parsed.nodes.map((node) => [node.id, `${node.id}-paste-${idSuffix}`]))
      const pastedNodes = parsed.nodes.map((node) => ({
        ...node,
        id: idMap.get(node.id) ?? node.id,
        parentNode: undefined,
        extent: undefined,
        selected: true,
        position: {
          x: canvasMenu.flowPosition.x + node.position.x - minX,
          y: canvasMenu.flowPosition.y + node.position.y - minY,
        },
      }))
      const pastedEdges = parsed.edges.map((edge) => ({
        ...edge,
        id: `${edge.id}-paste-${idSuffix}`,
        source: idMap.get(edge.source) ?? edge.source,
        target: idMap.get(edge.target) ?? edge.target,
      }))
      markCustomized()
      setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), ...pastedNodes])
      setEdges((current) => [...current.map((edge) => ({ ...edge, selected: false })), ...pastedEdges])
      setSelectedNodeId(pastedNodes[0]?.id ?? null)
      setSelectedEdgeId(null)
    } catch {
      setApplyError('Clipboard tidak berisi source PlantUML yang valid.')
    } finally {
      setCanvasMenu(null)
    }
  }, [canvasMenu, markCustomized, setEdges, setNodes])

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
      const source = drawableNodes.find((node) => node.id === edge.source)
      const target = drawableNodes.find((node) => node.id === edge.target)
      if (!source || !target) return
      const sourceSize = dimensions(source)
      const targetSize = dimensions(target)
      context.beginPath()
      context.moveTo(source.position.x - minX + sourceSize.width / 2, source.position.y - minY + sourceSize.height / 2)
      context.lineTo(target.position.x - minX + targetSize.width / 2, target.position.y - minY + targetSize.height / 2)
      context.stroke()
    })
    drawableNodes.forEach((node) => {
      const { width, height } = dimensions(node)
      const x = node.position.x - minX
      const y = node.position.y - minY
      context.fillStyle = '#e0f2fe'
      context.strokeStyle = '#334155'
      context.lineWidth = 1.5
      context.fillRect(x, y, width, height)
      context.strokeRect(x, y, width, height)
      context.fillStyle = '#0f172a'
      context.font = '14px Arial'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(node.data.label ?? node.id, x + width / 2, y + height / 2, Math.max(40, width - 14))
    })
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    } catch {
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'integration-diagram.png'
      link.click()
      URL.revokeObjectURL(link.href)
    } finally {
      setCanvasMenu(null)
    }
  }, [edges, nodes])

  const applyCanvasLayout = useCallback((layout: 'horizontal' | 'vertical' | 'circle') => {
    const selected = nodes.filter((node) => node.selected && !node.parentNode)
    const targets = (selected.length > 0 ? selected : nodes.filter((node) => !node.parentNode && node.type !== 'archimateLegend'))
    if (targets.length === 0) return
    const center = { x: 500, y: 360 }
    markCustomized()
    setNodes((current) => current.map((node) => {
      const index = targets.findIndex((target) => target.id === node.id)
      if (index < 0) return node
      if (layout === 'horizontal') return { ...node, position: { x: 120 + index * 260, y: center.y } }
      if (layout === 'vertical') return { ...node, position: { x: center.x, y: 100 + index * 150 } }
      const angle = (Math.PI * 2 * index) / targets.length - Math.PI / 2
      return { ...node, position: { x: center.x + Math.cos(angle) * 300, y: center.y + Math.sin(angle) * 220 } }
    }))
    setCanvasMenu(null)
  }, [markCustomized, nodes, setNodes])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const onCanvas = fillHeight || viewMode === 'canvas'
      if (!onCanvas) return
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
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      if (selectedEdgeId) {
        event.preventDefault()
        deleteSelectedEdge()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [clearDefaultStyle, deleteSelectedEdge, fillHeight, selectCanvasElements, selectedEdgeId, viewMode])

  const viewTabs: Array<{ id: IntegrationViewMode; label: string; icon: typeof Layers }> = [
    { id: 'canvas', label: 'Canvas', icon: Layers },
    { id: 'source', label: 'Source PlantUML', icon: PencilLine },
    { id: 'notations', label: 'ArchiMate', icon: Layers },
  ]

  const studioMode = fillHeight
  const hasSelectionInspector = selectedElementCount === 1
    && (Boolean(selectedNode && selectedNode.type !== 'archimateLegend') || Boolean(selectedEdgeId))

  useEffect(() => {
    if (!hasSelectionInspector) {
      setPropertiesPanelPosition(null)
    }
  }, [hasSelectionInspector])

  useLayoutEffect(() => {
    if (!studioMode || !hasSelectionInspector) return
    const zone = canvasZoneRef.current
    const panel = propertiesPanelShellRef.current
    if (!zone || !panel) return

    setPropertiesPanelPosition((current) => {
      if (current) {
        return clampPropertiesPanelPosition(current.x, current.y)
      }
      return {
        x: Math.max(STUDIO_PANEL_MARGIN_PX, zone.clientWidth - panel.offsetWidth - STUDIO_PANEL_MARGIN_PX),
        y: STUDIO_PANEL_MARGIN_PX,
      }
    })
  }, [clampPropertiesPanelPosition, hasSelectionInspector, selectedEdgeId, selectedNodeId, studioMode])

  const selectionInspector =
    hasSelectionInspector && selectedNode && selectedNode.type !== 'archimateLegend' ? (
      <IntegrationNodePropertiesPanel
        selectedNode={selectedNode}
        onUpdateData={updateSelectedNodeData}
        onUpdateSize={updateSelectedNodeSize}
        onUpdatePosition={updateSelectedNodePosition}
        onLayerAction={handleLayerAction}
        onRotate90={handleRotateSelectedNode90}
        dragHandleProps={propertiesPanelDragHandleProps}
      />
    ) : hasSelectionInspector && selectedEdge ? (
      <DiagramEdgePropertiesPanel
        edge={selectedEdge}
        onChange={updateSelectedEdge}
        onDelete={deleteSelectedEdge}
        onClearWaypoints={clearSelectedEdgeWaypoints}
        dragHandleProps={propertiesPanelDragHandleProps}
      />
    ) : null

  const flowCanvas = (
    <IntegrationArchitectureFlow
      key={ideaId}
      nodes={nodes}
      edges={edges}
      onNodesChange={handleNodesChange}
      onNodeDragStop={handleNodeDragStop}
      onEdgesChange={handleEdgesChange}
      onConnect={onConnect}
      onEdgeUpdate={onEdgeUpdate}
      onSelectionChange={handleSelectionChange}
      onPaneClick={() => setCanvasMenu(null)}
      onPaneContextMenu={handlePaneContextMenu}
      showGrid={showGrid}
      showGuides={showGuides}
      snapToGrid={snapToGrid}
      showRuler={showRuler}
      showConnectionArrows={showConnectionArrows}
      showConnectionPoints={showConnectionPoints}
      defaultViewport={savedViewport}
      onMoveEnd={(_event, viewport) => persistViewport(viewport)}
    />
  )

  const canvasContextMenu = canvasMenu ? (
    <div
      className="absolute z-50 w-64 rounded-md border border-slate-200 bg-white py-1 text-sm text-slate-700 shadow-xl"
      style={{ left: Math.max(8, canvasMenu.x), top: Math.max(8, canvasMenu.y) }}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={pastePlantUmlAtCursor}>
        <Copy className="h-4 w-4" /> Paste here
      </button>
      <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={copyCanvasAsImage}>
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
  ) : null

  const notationPanelBody = (
    <ArchimateNotationPalette
      generalItems={ARCHIMATE_GENERAL_PALETTE_ITEMS}
      scrollClassName={STUDIO_PANEL_SCROLL_CLASS}
      onDragStart={handlePaletteDragStart}
    />
  )

  const sourceActionButtons = (
    <button
      type="button"
      className={SOURCE_ACTION_BUTTON_CLASS}
      onClick={() => handlePlantumlSourceChange(DEFAULT_INTEGRATION_PLANTUML)}
    >
      Template AI
    </button>
  )

  const sourceEditorFeedback = (
    <>
      {applyError ? <p className="px-3 text-xs text-rose-600">{applyError}</p> : null}
      {applyWarnings.length > 0 ? (
        <div className="mx-3 mb-3 rounded-lg border border-amber-200/70 bg-amber-50/75 px-3 py-2 text-xs text-amber-900 backdrop-blur-sm">
          {applyWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
    </>
  )

  const studioSidebarTabs: Array<{ id: StudioSidebarPanel; label: string; icon: typeof PencilLine }> = [
    { id: 'source', label: 'Source', icon: PencilLine },
    { id: 'notations', label: 'ArchiMate', icon: Layers },
  ]

  const studioHeader = (
    <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50">
          <Sparkles className="h-3.5 w-3.5 text-slate-600" />
        </span>
        <span className="truncate text-sm font-semibold text-slate-900">{studioTitle}</span>
        {isGenerating ? <span className="hidden text-[11px] text-sky-700 lg:inline">Menunggu agent…</span> : null}
      </div>
    </div>
  )

  const canvasSurfaceClass =
    'rounded-2xl border border-white/60 bg-white/75 backdrop-blur-xl'

  const studioFloatingPanelShellClass =
    'pointer-events-none absolute z-30 w-[min(420px,36%)] max-w-[460px]'

  const studioFloatingPanelClass = cn(
    'pointer-events-auto flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border liquid-glass-enterprise-panel',
    isStudioPanelDragging && 'shadow-2xl ring-1 ring-white/50',
  )

  const studioPropertiesShellClass =
    'pointer-events-none absolute z-20 w-[min(280px,38%)] max-w-[300px]'

  const studioPropertiesPanelClass = cn(
    'pointer-events-auto flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border liquid-glass-enterprise-panel',
    isPropertiesPanelDragging && 'shadow-2xl ring-1 ring-white/50',
  )

  const studioPanelTabClass = (active: boolean) =>
    cn(
      'flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors',
      active
        ? 'border-slate-900/80 text-slate-900'
        : 'border-transparent text-slate-600 hover:text-slate-800',
    )

  return (
    <div
      className={cn(
        studioMode ? 'relative flex h-full min-h-0 flex-col overflow-hidden border border-border/40' : 'space-y-3',
        !studioMode && fillHeight && 'flex h-full min-h-0 flex-col',
      )}
    >
      {!studioMode && (
        <>
          <div className={cn('flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 bg-slate-50/80 px-3 py-2', fillHeight && 'shrink-0')}>
            <p className="text-xs text-slate-600">
              {isGenerating
                ? 'Menunggu hasil agent runtime…'
                : 'Edit di canvas atau lewat PlantUML; perubahan otomatis tersinkron dua arah.'}
            </p>
          </div>

          <div className={cn('flex flex-wrap gap-2', fillHeight && 'shrink-0')}>
            {viewTabs.map((tab) => {
              const Icon = tab.icon
              return (
                <Button
                  key={tab.id}
                  type="button"
                  size="sm"
                  variant={viewMode === tab.id ? 'default' : 'outline'}
                  className="h-8"
                  onClick={() => setViewMode(tab.id)}
                >
                  <Icon className="mr-1.5 h-3.5 w-3.5" />
                  {tab.label}
                </Button>
              )
            })}
          </div>
        </>
      )}

      {studioMode ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {!hideStudioHeader ? studioHeader : null}

          <div ref={canvasZoneRef} className="relative min-h-0 flex-1 overflow-hidden">
            <div
              ref={reactFlowWrapperRef}
              className={cn('absolute inset-0 overflow-hidden rounded-2xl', canvasSurfaceClass)}
              onDragOver={handleCanvasDragOver}
              onDrop={handleCanvasDrop}
            >
              {flowCanvas}
              {canvasContextMenu}
            </div>

            {studioOverlay ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 max-h-28 overflow-y-auto px-3 py-2">
                <div className="pointer-events-auto space-y-2">{studioOverlay}</div>
              </div>
            ) : null}

            <div
              ref={studioPanelShellRef}
              className={studioFloatingPanelShellClass}
              style={{
                left: studioPanelPosition.x,
                top: studioPanelPosition.y,
                height: isStudioPanelCollapsed ? 44 : `calc(100% - ${STUDIO_PANEL_MARGIN_PX * 2}px)`,
                maxHeight: isStudioPanelCollapsed ? 44 : undefined,
                width: isStudioPanelCollapsed ? 140 : undefined,
                maxWidth: isStudioPanelCollapsed ? 140 : undefined,
              }}
            >
              <aside className={cn(studioFloatingPanelClass, 'transition-[width] duration-200 ease-out')}>
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
                        const active = sidebarPanel === tab.id
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            className={studioPanelTabClass(active)}
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
                    aria-label={isStudioPanelCollapsed ? 'Expand Source and ArchiMate panel' : 'Collapse Source and ArchiMate panel'}
                    title={isStudioPanelCollapsed ? 'Expand editor panel' : 'Collapse editor panel'}
                  >
                    {isStudioPanelCollapsed ? (
                      <ChevronsRight className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <ChevronsLeft className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                </div>

                {!isStudioPanelCollapsed ? <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {sidebarPanel === 'source' ? (
                    <>
                      <PlantUmlSourceEditor
                        value={plantumlSource}
                        onChange={handlePlantumlSourceChange}
                        onBlur={flushPlantumlSourceApply}
                      />
                      {applyError || applyWarnings.length > 0 ? (
                        <div className={cn('max-h-28 shrink-0', STUDIO_PANEL_SCROLL_CLASS)}>{sourceEditorFeedback}</div>
                      ) : null}
                    </>
                  ) : (
                    notationPanelBody
                  )}
                </div> : null}

                {!isStudioPanelCollapsed && toolbarExtra ? (
                  <div className={STUDIO_FOOTER_ACTIONS_CLASS}>{toolbarExtra}</div>
                ) : null}
              </aside>
            </div>

            {hasSelectionInspector ? (
              <div
                ref={propertiesPanelShellRef}
                className={studioPropertiesShellClass}
                style={
                  propertiesPanelPosition
                    ? {
                        left: propertiesPanelPosition.x,
                        top: propertiesPanelPosition.y,
                        height: `calc(100% - ${STUDIO_PANEL_MARGIN_PX * 2}px)`,
                      }
                    : {
                        right: STUDIO_PANEL_MARGIN_PX,
                        top: STUDIO_PANEL_MARGIN_PX,
                        height: `calc(100% - ${STUDIO_PANEL_MARGIN_PX * 2}px)`,
                      }
                }
              >
                <aside className={studioPropertiesPanelClass}>
                  <div className="min-h-0 flex-1">{selectionInspector}</div>
                </aside>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {!studioMode && viewMode === 'source' && (
        <div className={cn('space-y-3 rounded-xl border border-border/50 bg-white/90 p-3', fillHeight && 'min-h-0 flex-1 overflow-y-auto')}>
          <div className={cn(STUDIO_FOOTER_ACTIONS_CLASS, 'rounded-lg border border-border/50 bg-slate-50/80')}>
            {sourceActionButtons}
          </div>
          <Textarea
            value={plantumlSource}
            onChange={(event) => handlePlantumlSourceChange(event.target.value)}
            onBlur={(event) => flushPlantumlSourceApply(event.target.value)}
            rows={18}
            spellCheck={false}
            className="font-mono text-xs leading-5"
          />
          {applyError ? <p className="text-xs text-rose-600">{applyError}</p> : null}
          {applyWarnings.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {applyWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {!studioMode && viewMode === 'notations' && (
        <div className={cn('rounded-xl border border-border/50 bg-white/90', fillHeight && 'min-h-0 flex-1 overflow-y-auto')}>
          {notationPanelBody}
        </div>
      )}

      {!studioMode && viewMode === 'canvas' && hasSelectionInspector && (
        <div className="rounded-xl border border-border/50 bg-white/90 p-3">{selectionInspector}</div>
      )}

      {!studioMode && viewMode === 'canvas' && (
        <div
          className={cn(
            'rounded-2xl border border-border/40 bg-white/80 p-3',
            fillHeight && 'min-h-0 flex flex-1 flex-col',
          )}
        >
          <div
            ref={reactFlowWrapperRef}
            className={cn(
              'rounded-[22px] border border-slate-200/80 overflow-hidden',
              canvasSurfaceClass,
              fillHeight ? 'min-h-[420px] flex-1' : 'h-[620px]',
            )}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
          >
            {flowCanvas}
            {canvasContextMenu}
          </div>
        </div>
      )}
    </div>
  )
}

export function EditableIntegrationArchitectureCanvas(props: EditableIntegrationArchitectureCanvasProps) {
  return (
    <ReactFlowProvider>
      <EditableIntegrationArchitectureCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
