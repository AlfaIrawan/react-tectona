import { DiagramConnectionLine } from './DiagramConnectionLine'
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { Hand, ImagePlus, Type, Undo2, Redo2 } from 'lucide-react'
import {
  useStore,
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
  type OnEdgesChange,
  type OnNodesChange,
  type OnSelectionChangeFunc,
  type ReactFlowInstance,
  type Viewport,
} from 'reactflow'
import { connectionClientPoint } from '@/modules/project-management/lib/diagramConnections'
import { CanvasViewportGrid, CanvasViewportRulers } from '@/modules/project-management/components/CanvasViewportRulers'
import { AnchoredSmoothStepEdge } from '@/modules/project-management/components/AnchoredSmoothStepEdge'
import { ErdCrowfootEdge } from '@/modules/project-management/components/ErdCrowfootEdge'
import { integrationArchimateNodeTypes } from '@/modules/project-management/components/integrationArchimateNodeTypes'
import { isArchimateElementData, type ArchimateNodeData } from '@/modules/project-management/lib/integrationArchitectureTypes'

const INTEGRATION_FLOW_DEFAULT_EDGE_OPTIONS = { type: 'smoothstep' as const }
const INTEGRATION_FLOW_FIT_VIEW_OPTIONS = { padding: 0.08, minZoom: 0.1, maxZoom: 1.4 }
const INTEGRATION_PREVIEW_FIT_VIEW_OPTIONS = { padding: 0.22, maxZoom: 1 }
const INTEGRATION_FLOW_PRO_OPTIONS = { hideAttribution: true as const }
const INTEGRATION_EDGE_TYPES: EdgeTypes = { smoothstep: AnchoredSmoothStepEdge, erd: ErdCrowfootEdge }
const INTEGRATION_NODE_TYPES = integrationArchimateNodeTypes
const INTEGRATION_SNAP_GRID: [number, number] = [20, 20]
const EDGE_UPDATE_DRAG_THRESHOLD_PX = 8


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
  defaultViewport?: Viewport
  controlsStyle?: CSSProperties
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  onAddText?: () => void
  onInsertImage?: () => void
  onMoveEnd?: (event: MouseEvent | TouchEvent, viewport: Viewport) => void
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
  snapToGrid = false,
  showRuler = true,
  showConnectionPoints = true,
  preview = false,
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
  const zoom = useStore((state) => state.transform[2]) || 1
  const cancelledRef = useRef(false)
  const pendingEdgeUpdateRef = useRef<{
    original: Edge
    x: number
    y: number
    oldEdge?: Edge
    connection?: Connection
  } | null>(null)
  const reconnectingEdgeRef = useRef(false)
  const [panMode, setPanMode] = useState(false)
  const displayedEdges = useMemo(() => edges.map(edge => ({ ...edge, updatable: !preview && Boolean(edge.selected) })), [edges, preview])
  const hasSelectedEdge = !preview && edges.some((edge) => edge.selected)

  const finishEdgeReconnect = useCallback(() => {
    pendingEdgeUpdateRef.current = null
    window.setTimeout(() => {
      reconnectingEdgeRef.current = false
    }, 0)
  }, [])

  const handleEdgeUpdateStart = useCallback((event: MouseEvent | globalThis.MouseEvent | TouchEvent, edge: Edge) => {
    cancelledRef.current = false
    reconnectingEdgeRef.current = true
    const point = connectionClientPoint(event)
    pendingEdgeUpdateRef.current = {
      original: edge,
      x: point.x,
      y: point.y,
    }
  }, [])

  const handleEdgeUpdate = useCallback((oldEdge: Edge, connection: Connection) => {
    if (cancelledRef.current) return
    const pending = pendingEdgeUpdateRef.current
    if (pending) {
      pendingEdgeUpdateRef.current = { ...pending, oldEdge, connection }
      return
    }
    onEdgeUpdate?.(oldEdge, connection)
  }, [onEdgeUpdate])

  const handleEdgeUpdateEnd = useCallback((event: globalThis.MouseEvent | TouchEvent) => {
    const pending = pendingEdgeUpdateRef.current
    if (!cancelledRef.current && pending?.oldEdge && pending.connection) {
      const point = connectionClientPoint(event)
      const distance = Math.hypot(point.x - pending.x, point.y - pending.y)
      if (distance >= EDGE_UPDATE_DRAG_THRESHOLD_PX) {
        onEdgeUpdate?.(pending.oldEdge, pending.connection)
      }
    }
    finishEdgeReconnect()
  }, [finishEdgeReconnect, onEdgeUpdate])

  const handleConnect = useCallback((connection: Connection) => {
    if (reconnectingEdgeRef.current || cancelledRef.current) return
    onConnect?.(connection)
  }, [onConnect])

  useEffect(() => {
    const cancel = () => {
      if (!store.getState().connectionStartHandle && !reconnectingEdgeRef.current) return
      cancelledRef.current = true
      pendingEdgeUpdateRef.current = null
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
  }, [store])

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
    <>
      <PatchReactFlowOnError />
      <ReactFlow
        className={`integration-flow-canvas h-full w-full${hasSelectedEdge ? ' edge-endpoint-edit' : ''}${panMode ? ' pan-mode' : ''}`}
        nodes={nodes}
        edges={displayedEdges}
        nodeTypes={INTEGRATION_NODE_TYPES}
        edgeTypes={INTEGRATION_EDGE_TYPES}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onConnectStart={() => { cancelledRef.current = false }}
        onConnectEnd={() => { if (!reconnectingEdgeRef.current) cancelledRef.current = false }}
        connectionRadius={18 / zoom}
        autoPanOnConnect={!preview}
        onEdgeUpdateStart={preview || !onEdgeUpdate ? undefined : handleEdgeUpdateStart}
        onEdgeUpdate={preview || !onEdgeUpdate ? undefined : handleEdgeUpdate}
        onEdgeUpdateEnd={preview || !onEdgeUpdate ? undefined : handleEdgeUpdateEnd}
        onSelectionChange={onSelectionChange}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
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
        nodesConnectable={!preview && showConnectionPoints}
        elementsSelectable={!preview}
        edgesFocusable={!preview}
        edgesUpdatable={!preview}
        edgeUpdaterRadius={10 / zoom}
        panOnDrag={preview ? false : panMode ? [0, 1, 2] : [1, 2]}
        selectionOnDrag={!preview && !panMode}
        snapToGrid={!preview && snapToGrid}
        snapGrid={INTEGRATION_SNAP_GRID}
        zoomOnScroll={!preview}
        zoomOnPinch={!preview}
        zoomOnDoubleClick={false}
        minZoom={preview ? 0.2 : 0.1}
        maxZoom={preview ? 1 : 4}
        proOptions={INTEGRATION_FLOW_PRO_OPTIONS}
        defaultEdgeOptions={INTEGRATION_FLOW_DEFAULT_EDGE_OPTIONS}
      >
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
      </ReactFlow>
    </>
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
}: {
  nodes: Node<ArchimateNodeData>[]
  edges: Edge[]
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
          showRuler={false}
          showGuides={false}
          showConnectionPoints={false}
        />
      </ReactFlowProvider>
    </div>
  )
}
