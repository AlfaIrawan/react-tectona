import { retargetMovedDiagramEdges } from '@/modules/project-management/lib/diagramMovingAnchors'
import { DiagramReconnectContext, useDiagramReconnect } from '@/modules/project-management/lib/useDiagramReconnect'
import { DiagramConnectionLine } from './DiagramConnectionLine'
import { DiagramSmartGuides } from './DiagramSmartGuides'
import { DiagramInteractionContext, type DiagramResizeConstraints } from '../lib/diagramInteractionContext'
import { diagramNodeRect, snapDiagramDrag, snapDiagramResize, type DiagramGuideFeedback, type DiagramResizeSession } from '../lib/diagramSmartGuides'
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { Hand, ImagePlus, Type, Undo2, Redo2 } from 'lucide-react'
import {
  applyNodeChanges,
  useStore,
  useReactFlow,
  ConnectionLineType,
  ConnectionMode,
  ControlButton,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useStoreApi,
  type Connection,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
  type OnEdgesChange,
  type OnNodesChange,
  type OnMove,
  type OnSelectionChangeFunc,
  type ReactFlowInstance,
  type Viewport,
} from 'reactflow'
import { CanvasViewportGrid, CanvasViewportRulers } from '@/modules/project-management/components/CanvasViewportRulers'
import { AnchoredSmoothStepEdge } from '@/modules/project-management/components/AnchoredSmoothStepEdge'
import { ErdCrowfootEdge } from '@/modules/project-management/components/ErdCrowfootEdge'
import {
  ArchimateBoundaryNode,
  ArchimateElementNode,
  ArchimateImageNode,
  ArchimateLegendNode,
  ArchimateNoteNode,
  BpmnElementNode,
  C4ElementNode,
  ErdEntityNode,
  UmlClassNode,
  UmlUseCaseNode,
} from '@/modules/project-management/components/integrationArchimateNodeTypes'
import { isArchimateElementData, type ArchimateNodeData } from '@/modules/project-management/lib/integrationArchitectureTypes'

const INTEGRATION_FLOW_DEFAULT_EDGE_OPTIONS = { type: 'smoothstep' as const }
const INTEGRATION_FLOW_FIT_VIEW_OPTIONS = { padding: 0.08, minZoom: 0.1, maxZoom: 1.4 }
const INTEGRATION_PREVIEW_FIT_VIEW_OPTIONS = { padding: 0.22, minZoom: 0.000001, maxZoom: 1 }
const INTEGRATION_FLOW_PRO_OPTIONS = { hideAttribution: true as const }
const INTEGRATION_EDGE_TYPES: EdgeTypes = { smoothstep: AnchoredSmoothStepEdge, erd: ErdCrowfootEdge }
const INTEGRATION_NODE_TYPES: NodeTypes = {
  archimateElement: ArchimateElementNode,
  archimateBoundary: ArchimateBoundaryNode,
  archimateNote: ArchimateNoteNode,
  archimateImage: ArchimateImageNode,
  archimateLegend: ArchimateLegendNode,
  c4Element: C4ElementNode,
  umlClass: UmlClassNode,
  umlUseCase: UmlUseCaseNode,
  erdEntity: ErdEntityNode,
  bpmnElement: BpmnElementNode,
}
const INTEGRATION_SNAP_GRID: [number, number] = [20, 20]


function handleReactFlowError(messageId: string, message: string) {
  if (messageId === '002') return
  console.warn(`[React Flow]: ${message}`)
}

function PatchReactFlowOnError() {
  const store = useStoreApi()
  if (store.getState().onError !== handleReactFlowError) {
    store.setState({ onError: handleReactFlowError })
  }
  return null
}

function integrationMinimapNodeColor(node: Node): string {
  if (node.type === 'archimateBoundary') return '#e2e8f0'
  if (node.type === 'umlClass') return '#7F8C9B'
  if (node.type === 'erdEntity') return '#C4A35A'
  if (node.type === 'c4Element') {
    const data = node.data
    if (isArchimateElementData(data) && /external/i.test(data.stereotype)) return '#999999'
    return '#438DD5'
  }
  if (node.type === 'archimateImage' || node.id === 'legend' || node.id === 'canvas-notes') return '#f8fafc'
  const data = node.data
  if (isArchimateElementData(data)) {
    if (data.layer === 'business') return '#FFF3B0'
    if (data.layer === 'technology') return '#C8F0C8'
    return '#C8EEF9'
  }
  return '#bfe0ff'
}

type IntegrationArchitectureFlowProps = {
  nodes: Node<ArchimateNodeData>[]
  edges: Edge[]
  onNodesChange?: OnNodesChange
  onNodeDragStop?: (event: MouseEvent, node: Node<ArchimateNodeData>, nodes: Node<ArchimateNodeData>[]) => void
  onEdgesChange?: OnEdgesChange
  onConnect?: (connection: Connection) => void
  onEdgeUpdate?: (oldEdge: Edge, newConnection: Connection) => void
  onSelectionChange?: OnSelectionChangeFunc
  onEdgeClick?: (event: MouseEvent, edge: Edge) => void
  onPaneClick?: () => void
  onPaneContextMenu?: (event: MouseEvent) => void
  onNodeContextMenu?: (event: MouseEvent, node: Node<ArchimateNodeData>) => void
  onNodeDoubleClick?: (event: MouseEvent, node: Node<ArchimateNodeData>) => void
  onEdgeContextMenu?: (event: MouseEvent, edge: Edge) => void
  showGrid?: boolean
  showGuides?: boolean
  snapToGrid?: boolean
  showRuler?: boolean
  showConnectionArrows?: boolean
  showConnectionPoints?: boolean
  preview?: boolean
  previewNavigation?: boolean
  defaultViewport?: Viewport
  controlsStyle?: CSSProperties
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  onAddText?: () => void
  onInsertImage?: () => void
  onMoveEnd?: OnMove
}

function IntegrationArchitectureFlowInner({
  nodes,
  edges,
  onNodesChange,
  onNodeDragStop,
  onEdgesChange,
  onConnect,
  onEdgeUpdate,
  onSelectionChange,
  onEdgeClick,
  onPaneClick,
  onPaneContextMenu,
  onNodeContextMenu,
  onNodeDoubleClick,
  onEdgeContextMenu,
  showGrid = true,
  showGuides = true,
  snapToGrid = false,
  showRuler = true,
  showConnectionArrows = true,
  showConnectionPoints = true,
  preview = false,
  previewNavigation = false,
  defaultViewport,
  controlsStyle,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onAddText,
  onInsertImage,
  onMoveEnd,
}: IntegrationArchitectureFlowProps) {
  const store = useStoreApi()
  const { getNodes, screenToFlowPosition, setEdges } = useReactFlow()
  const transform = useStore((state) => state.transform)
  const zoom = transform[2] || 1
  const resizeSession = useRef<DiagramResizeSession | null>(null)
  const [guideFeedback, setGuideFeedback] = useState<DiagramGuideFeedback>({ lines: [] })
  const clearGuides = useCallback(() => setGuideFeedback({ lines: [] }), [])
  const beginResize = useCallback((nodeId: string, constraints: DiagramResizeConstraints) => {
    const current = getNodes(), node = current.find(item => item.id === nodeId)
    if (!node || preview) return
    const initial = diagramNodeRect(node, current)
    resizeSession.current = { ...constraints, nodeId, initial }
    setGuideFeedback({ lines: [], size: initial })
  }, [getNodes, preview])
  const endResize = useCallback(() => { resizeSession.current = null; clearGuides() }, [clearGuides])
  const interactions = useMemo(() => ({ showConnectionArrows: !preview && showConnectionArrows,
    showConnectionPoints: !preview && showConnectionPoints, beginResize, endResize }),
  [preview, showConnectionArrows, showConnectionPoints, beginResize, endResize])
  const changeNodes: OnNodesChange = useCallback(changes => {
    let nextChanges = changes
    if (!preview) {
      if (resizeSession.current) {
        const result = snapDiagramResize(changes, nodes, resizeSession.current, zoom, !showGuides || snapToGrid)
        nextChanges = result.changes
        if (result.feedback.size) setGuideFeedback(showGuides ? result.feedback : { lines: [], size: result.feedback.size })
      } else if (changes.some(change => change.type === 'position' && change.dragging !== undefined)) {
        const result = showGuides ? snapDiagramDrag(changes, nodes, zoom, snapToGrid) : { changes, feedback: { lines: [] } }
        nextChanges = result.changes
        setGuideFeedback(changes.some(change => change.type === 'position' && change.dragging) ? result.feedback : { lines: [] })
      }
      if (changes.some(change => change.type === 'remove' || change.type === 'reset' || change.type === 'dimensions' && change.resizing === false)) clearGuides()
    }
    const moved = new Set(nextChanges.flatMap(change => change.type === 'position' && change.position ? [change.id] : []))
    if (!preview && onEdgeUpdate && moved.size) {
      const nextNodes = applyNodeChanges(nextChanges, nodes)
      setEdges(current => retargetMovedDiagramEdges(nextNodes, current, moved))
    }
    onNodesChange?.(nextChanges)
  }, [nodes, onNodesChange, onEdgeUpdate, preview, setEdges, zoom, showGuides, snapToGrid, clearGuides])
  const cancelledRef = useRef(false)
  const [panMode, setPanMode] = useState(false)
  const displayedEdges = useMemo(() => edges.map(edge => ({ ...edge, updatable: false })), [edges])
  const hasSelectedEdge = !preview && edges.some((edge) => edge.selected)
  const reconnect = useDiagramReconnect(edges, getNodes, screenToFlowPosition, zoom, preview ? undefined : onEdgeUpdate,
    connection => !store.getState().isValidConnection || store.getState().isValidConnection!(connection),
    point => {
      const state = store.getState(), bounds = state.domNode?.getBoundingClientRect()
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) return false
      const x = point.x < bounds.left + 32 ? 8 : point.x > bounds.right - 32 ? -8 : 0
      const y = point.y < bounds.top + 32 ? 8 : point.y > bounds.bottom - 32 ? -8 : 0
      return x || y ? state.panBy({ x, y }) : false
    }, transform.join(':'))

  const handleConnect = useCallback((connection: Connection) => {
    if (cancelledRef.current) return
    onConnect?.(connection)
  }, [onConnect])

  useEffect(() => {
    const cancel = () => {
      endResize()
      if (!store.getState().connectionStartHandle) return
      cancelledRef.current = true
      store.getState().cancelConnection()
    }
    const keyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel() }
    window.addEventListener('keydown', keyDown)
    window.addEventListener('blur', cancel)
    window.addEventListener('touchcancel', cancel)
    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('touchcancel', cancel)
    }
  }, [store, endResize])

  const handleInit = useCallback((instance: ReactFlowInstance) => {
    if (preview) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          instance.fitView({ padding: 0.22, maxZoom: 1, duration: 0 })
        })
      })
      return
    }
    if (defaultViewport) instance.setViewport(defaultViewport, { duration: 0 })
  }, [defaultViewport, preview])

  return (
    <DiagramInteractionContext.Provider value={interactions}>
    <DiagramReconnectContext.Provider value={preview || !onEdgeUpdate ? null : reconnect}>
      <PatchReactFlowOnError />
      <ReactFlow
        className={`integration-flow-canvas h-full w-full${hasSelectedEdge ? ' edge-endpoint-edit' : ''}${panMode ? ' pan-mode' : ''}${preview || !showConnectionArrows ? ' hide-connection-arrows' : ''}${preview || !showConnectionPoints ? ' hide-connection-points' : ''}`}
        nodes={nodes}
        edges={displayedEdges}
        nodeTypes={INTEGRATION_NODE_TYPES}
        edgeTypes={INTEGRATION_EDGE_TYPES}
        onNodesChange={changeNodes}
        onNodeDragStop={(event, node, draggedNodes) => { clearGuides(); onNodeDragStop?.(event, node, draggedNodes) }}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onConnectStart={() => { cancelledRef.current = false }}
        onConnectEnd={() => { cancelledRef.current = false }}
        connectionRadius={18 / zoom}
        autoPanOnConnect={!preview}
        onSelectionChange={onSelectionChange}
        onEdgeClick={onEdgeClick}
        onPaneClick={() => { clearGuides(); onPaneClick?.() }}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeContextMenu={onEdgeContextMenu}
        onMoveEnd={preview ? undefined : onMoveEnd}
        onError={handleReactFlowError}
        onInit={handleInit}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.SmoothStep}
        connectionLineComponent={DiagramConnectionLine}
        fitView={preview || !defaultViewport}
        fitViewOptions={preview ? INTEGRATION_PREVIEW_FIT_VIEW_OPTIONS : INTEGRATION_FLOW_FIT_VIEW_OPTIONS}
        defaultViewport={defaultViewport}
        nodesDraggable={!preview}
        selectNodesOnDrag={!preview}
        nodesConnectable={!preview && (showConnectionPoints || showConnectionArrows)}
        elementsSelectable={!preview}
        edgesFocusable={!preview}
        edgesUpdatable={false}
        elevateEdgesOnSelect
        edgeUpdaterRadius={10 / zoom}
        panOnDrag={preview ? previewNavigation ? [0, 1] : false : panMode ? [0, 1] : [1]}
        selectionOnDrag={!preview && !panMode}
        snapToGrid={!preview && snapToGrid}
        snapGrid={INTEGRATION_SNAP_GRID}
        zoomOnScroll={!preview}
        zoomOnPinch={!preview || previewNavigation}
        zoomOnDoubleClick={false}
        minZoom={preview ? 0.000001 : 0.1}
        maxZoom={preview && !previewNavigation ? 1 : 4}
        proOptions={INTEGRATION_FLOW_PRO_OPTIONS}
        defaultEdgeOptions={INTEGRATION_FLOW_DEFAULT_EDGE_OPTIONS}
      >
      {preview && previewNavigation ? <Controls showInteractive={false} fitViewOptions={INTEGRATION_PREVIEW_FIT_VIEW_OPTIONS} position="bottom-left" /> : null}
      {!preview ? (
        <MiniMap
          zoomable
          pannable
          nodeColor={integrationMinimapNodeColor}
          maskColor="rgba(15, 23, 42, 0.08)"
          className="!bg-white/95 !border !border-slate-200"
        />
      ) : null}
      {!preview ? (
        <Controls showInteractive className="canvas-flow-controls" position="bottom-left" style={controlsStyle}>
          {onUndo ? <ControlButton onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 /></ControlButton> : null}
          {onRedo ? <ControlButton onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo"><Redo2 /></ControlButton> : null}
          <ControlButton
            onClick={() => setPanMode((current) => !current)}
            className={panMode ? 'is-active' : undefined}
            title={panMode ? 'Exit pan mode' : 'Pan canvas'}
            aria-label={panMode ? 'Exit pan mode' : 'Pan canvas'}
          >
            <Hand />
          </ControlButton>
          {onAddText ? <ControlButton onClick={onAddText} title="Add text" aria-label="Add text"><Type /></ControlButton> : null}
          {onInsertImage ? <ControlButton onClick={onInsertImage} title="Insert image" aria-label="Insert image"><ImagePlus /></ControlButton> : null}
        </Controls>
      ) : null}
        {showGrid && !preview ? <CanvasViewportGrid /> : null}
        {showRuler && !preview ? <CanvasViewportRulers /> : null}
        {!preview && (guideFeedback.size || showGuides && guideFeedback.lines.length > 0) ? <DiagramSmartGuides feedback={guideFeedback} /> : null}
      </ReactFlow>
    </DiagramReconnectContext.Provider>
    </DiagramInteractionContext.Provider>
  )
}

export const IntegrationArchitectureFlow = memo(IntegrationArchitectureFlowInner)

const NOOP_CHANGE: OnNodesChange = () => undefined
const NOOP_EDGES: OnEdgesChange = () => undefined
const NOOP_CONNECT = () => undefined
const NOOP_SELECTION: OnSelectionChangeFunc = () => undefined

export function IntegrationArchitecturePreview({
  nodes,
  edges,
  navigation = false,
}: {
  nodes: Node<ArchimateNodeData>[]
  edges: Edge[]
  navigation?: boolean
}) {
  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-white/75">
      <ReactFlowProvider>
        <IntegrationArchitectureFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={NOOP_CHANGE}
          onEdgesChange={NOOP_EDGES}
          onConnect={NOOP_CONNECT}
          onSelectionChange={NOOP_SELECTION}
          preview
          previewNavigation={navigation}
          showRuler={false}
          showGuides={false}
          showConnectionPoints={false}
        />
      </ReactFlowProvider>
    </div>
  )
}
