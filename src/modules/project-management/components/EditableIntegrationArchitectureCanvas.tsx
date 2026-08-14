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
import { GripVertical, Layers, PencilLine, Sparkles, Trash2 } from 'lucide-react'
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
  type OnSelectionChangeFunc,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { enterpriseIndigoGradientActionButtonClass } from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'
import { IntegrationArchitectureFlow } from '@/modules/project-management/components/IntegrationArchitectureFlow'
import { ArchimateNotationPalette } from '@/modules/project-management/components/ArchimateNotationPalette'
import { IntegrationNodePropertiesPanel } from '@/modules/project-management/components/IntegrationNodePropertiesPanel'
import {
  cloneDefaultIntegrationArchitecture,
  normalizeIntegrationNodesForCanvas,
} from '@/modules/project-management/lib/integrationArchitectureDefaults'
import {
  loadIntegrationGraph,
  saveIntegrationGraph,
  type IntegrationGraphRecord,
} from '@/modules/project-management/lib/integrationGraphStorage'
import { DEFAULT_INTEGRATION_PLANTUML } from '@/modules/project-management/lib/integrationPlantUmlDefaults'
import {
  integrationGraphToPlantUml,
  parsePlantUmlToIntegrationGraph,
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
      }
    }
    return {
      nodes: defaultGraph.nodes,
      edges: defaultGraph.edges,
      plantumlSource: DEFAULT_INTEGRATION_PLANTUML,
      userCustomized: false,
    }
  }, [ideaId, defaultGraph])

  const [nodes, setNodes, onNodesChange] = useNodesState<ArchimateNodeData>(initialState.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialState.edges)
  const [plantumlSource, setPlantumlSource] = useState(initialState.plantumlSource)
  plantumlSourceRef.current = plantumlSource
  const [userCustomized, setUserCustomized] = useState(initialState.userCustomized)
  const [viewMode, setViewMode] = useState<IntegrationViewMode>('canvas')
  const [sidebarPanel, setSidebarPanel] = useState<StudioSidebarPanel>('source')
  const [studioPanelPosition, setStudioPanelPosition] = useState(STUDIO_PANEL_DEFAULT_POSITION)
  const [isStudioPanelDragging, setIsStudioPanelDragging] = useState(false)
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
    ) => {
      saveIntegrationGraph(ideaId, {
        nodes: nextNodes,
        edges: nextEdges,
        plantumlSource: nextPlantumlSource,
        userCustomized: customized,
        savedAt: new Date().toISOString(),
      })
    },
    [ideaId],
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
    } else {
      setNodes(defaultGraph.nodes)
      setEdges(defaultGraph.edges)
      setPlantumlSource(DEFAULT_INTEGRATION_PLANTUML)
      setUserCustomized(false)
    }
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setApplyError(null)
    setApplyWarnings([])
    setViewMode('canvas')
    setSidebarPanel('source')
    setStudioPanelPosition(STUDIO_PANEL_DEFAULT_POSITION)
  }, [ideaId, defaultGraph, setEdges, setNodes])

  useEffect(() => {
    if (!bootstrapRecord) return
    skipNextSaveRef.current = true
    skipSourceApplyRef.current = true
    if (bootstrapRecord.nodes.length > 0) {
      setNodes(normalizeIntegrationNodesForCanvas(bootstrapRecord.nodes))
      setEdges(bootstrapRecord.edges)
    }
    setPlantumlSource(bootstrapRecord.plantumlSource ?? DEFAULT_INTEGRATION_PLANTUML)
    setUserCustomized(bootstrapRecord.userCustomized)
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setApplyError(null)
    setApplyWarnings([])
  }, [bootstrapKey, bootstrapRecord, setEdges, setNodes])

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
  }, [nodes, edges, userCustomized, persistGraph])

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

  const updateSelectedNodeData = useCallback(
    (patch: Record<string, unknown>) => {
      if (!selectedNodeId) return
      markCustomized()
      setNodes((current) =>
        current.map((node) =>
          node.id === selectedNodeId ? { ...node, data: { ...node.data, ...patch } as ArchimateNodeData } : node,
        ),
      )
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
      setNodes((current) => [...current, newNode])
      setSelectedNodeId(newNode.id)
      setSelectedEdgeId(null)
      if (fillHeight) setSidebarPanel('source')
      else setViewMode('canvas')
    },
    [fillHeight, markCustomized, nodes, screenToFlowPosition, setNodes],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const onCanvas = fillHeight || viewMode === 'canvas'
      if (!onCanvas) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      if (selectedEdgeId) {
        event.preventDefault()
        deleteSelectedEdge()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [deleteSelectedEdge, fillHeight, selectedEdgeId, viewMode])

  const viewTabs: Array<{ id: IntegrationViewMode; label: string; icon: typeof Layers }> = [
    { id: 'canvas', label: 'Canvas', icon: Layers },
    { id: 'source', label: 'Source PlantUML', icon: PencilLine },
    { id: 'notations', label: 'ArchiMate', icon: Layers },
  ]

  const studioMode = fillHeight
  const hasSelectionInspector = Boolean(selectedNode && selectedNode.type !== 'archimateLegend') || selectedEdgeId

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
    selectedNode && selectedNode.type !== 'archimateLegend' ? (
      <IntegrationNodePropertiesPanel
        selectedNode={selectedNode}
        onUpdateData={updateSelectedNodeData}
        onUpdateSize={updateSelectedNodeSize}
        onUpdatePosition={updateSelectedNodePosition}
        onLayerAction={handleLayerAction}
        onRotate90={handleRotateSelectedNode90}
        dragHandleProps={propertiesPanelDragHandleProps}
      />
    ) : selectedEdgeId ? (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center border-b border-white/35 bg-white/15">
          <div
            role="button"
            tabIndex={0}
            aria-label="Geser panel Properties"
            className={cn(
              'flex shrink-0 touch-none cursor-grab select-none items-center border-r border-white/25 px-2 active:cursor-grabbing',
              isPropertiesPanelDragging && 'cursor-grabbing',
            )}
            onPointerDown={propertiesPanelDragHandleProps.onPointerDown}
            onPointerMove={propertiesPanelDragHandleProps.onPointerMove}
            onPointerUp={propertiesPanelDragHandleProps.onPointerUp}
            onPointerCancel={propertiesPanelDragHandleProps.onPointerCancel}
          >
            <GripVertical className="h-4 w-4 text-slate-500" />
          </div>
          <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Edge</p>
        </div>
        <div className="flex flex-col gap-2 p-3">
          <p className="text-xs text-slate-600">Koneksi dipilih — tekan Delete atau hapus manual.</p>
          <Button type="button" variant="outline" size="sm" className="h-8 w-fit" onClick={deleteSelectedEdge}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Hapus koneksi
          </Button>
        </div>
      </div>
    ) : null

  const flowCanvas = (
    <IntegrationArchitectureFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={handleNodesChange}
      onEdgesChange={handleEdgesChange}
      onConnect={onConnect}
      onSelectionChange={handleSelectionChange}
    />
  )

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
    'bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.22)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.96))] [background-size:22px_22px]'

  const studioFloatingPanelShellClass =
    'pointer-events-none absolute z-30 w-[min(420px,36%)] max-w-[460px]'

  const studioFloatingPanelClass = cn(
    'pointer-events-auto flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border liquid-glass-enterprise-panel',
    isStudioPanelDragging && 'shadow-2xl ring-1 ring-white/50',
  )

  const studioPropertiesShellClass =
    'pointer-events-none absolute z-20 w-[min(320px,34%)] max-w-[360px]'

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
              className={cn('absolute inset-0 overflow-hidden', canvasSurfaceClass)}
              onDragOver={handleCanvasDragOver}
              onDrop={handleCanvasDrop}
            >
              {flowCanvas}
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
                height: `calc(100% - ${STUDIO_PANEL_MARGIN_PX * 2}px)`,
              }}
            >
              <aside className={studioFloatingPanelClass}>
                <div className="flex shrink-0 border-b border-white/35 bg-white/15">
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
                  {studioSidebarTabs.map((tab) => {
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
                  })}
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {sidebarPanel === 'source' ? (
                    <>
                      <Textarea
                        value={plantumlSource}
                        onChange={(event) => handlePlantumlSourceChange(event.target.value)}
                        onBlur={(event) => flushPlantumlSourceApply(event.target.value)}
                        spellCheck={false}
                        className={cn(
                          'min-h-0 flex-1 resize-none rounded-none border-0 bg-white/20 px-3 py-2 font-mono text-xs leading-5 text-slate-900 shadow-none focus-visible:bg-white/30 focus-visible:ring-0',
                          STUDIO_PANEL_SCROLL_CLASS,
                        )}
                      />
                      {applyError || applyWarnings.length > 0 ? (
                        <div className={cn('max-h-28 shrink-0', STUDIO_PANEL_SCROLL_CLASS)}>{sourceEditorFeedback}</div>
                      ) : null}
                    </>
                  ) : (
                    notationPanelBody
                  )}
                </div>

                {(toolbarExtra || sidebarPanel === 'source') ? (
                  <div className={STUDIO_FOOTER_ACTIONS_CLASS}>
                    {toolbarExtra}
                    {sidebarPanel === 'source' ? sourceActionButtons : null}
                  </div>
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
              fillHeight ? 'min-h-0 flex-1' : 'h-[620px]',
            )}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
          >
            {flowCanvas}
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
