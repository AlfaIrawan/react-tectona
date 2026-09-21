import { memo, useCallback, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { Hand, ImagePlus, Type } from 'lucide-react'
import {
  ConnectionLineType,
  ConnectionMode,
  ControlButton,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useStoreApi,
  type Connection,
  type ConnectionLineComponentProps,
  type Edge,
  type EdgeTypes,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
  type OnSelectionChangeFunc,
  type ReactFlowInstance,
  type Viewport,
} from 'reactflow'
import { CanvasViewportGrid, CanvasViewportRulers } from '@/modules/project-management/components/CanvasViewportRulers'
import { AnchoredSmoothStepEdge } from '@/modules/project-management/components/AnchoredSmoothStepEdge'
import { integrationArchimateNodeTypes } from '@/modules/project-management/components/integrationArchimateNodeTypes'
import { isArchimateElementData, type ArchimateNodeData } from '@/modules/project-management/lib/integrationArchitectureTypes'

const INTEGRATION_FLOW_DEFAULT_EDGE_OPTIONS = { type: 'smoothstep' as const }
const INTEGRATION_FLOW_FIT_VIEW_OPTIONS = { padding: 0.08, minZoom: 0.7 }
const INTEGRATION_PREVIEW_FIT_VIEW_OPTIONS = { padding: 0.22, maxZoom: 1 }
const INTEGRATION_FLOW_PRO_OPTIONS = { hideAttribution: true as const }
const INTEGRATION_EDGE_TYPES: EdgeTypes = { smoothstep: AnchoredSmoothStepEdge }
const INTEGRATION_NODE_TYPES = integrationArchimateNodeTypes
const INTEGRATION_SNAP_GRID: [number, number] = [20, 20]
const EDGE_UPDATE_DRAG_THRESHOLD_PX = 8

function DiagramConnectionLine({ fromX, fromY, toX, toY }: ConnectionLineComponentProps) {
  const horizontal = Math.abs(toX - fromX) >= Math.abs(toY - fromY)
  const bendX = fromX + (toX - fromX) / 2
  const bendY = fromY + (toY - fromY) / 2
  const path = horizontal
    ? `M ${fromX},${fromY} L ${bendX},${fromY} L ${bendX},${toY} L ${toX},${toY}`
    : `M ${fromX},${fromY} L ${fromX},${bendY} L ${toX},${bendY} L ${toX},${toY}`

  return (
    <g>
      <defs>
        <marker id="tectona-connection-preview-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="strokeWidth">
          <path d="M 0 0 L 9 4.5 L 0 9 z" fill="#64748b" />
        </marker>
      </defs>
      <path
        d={path}
        fill="none"
        stroke="#64748b"
        strokeWidth={1.5}
        strokeDasharray="4 4"
        markerEnd="url(#tectona-connection-preview-arrow)"
      />
    </g>
  )
}

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
  if (node.type === 'bpmnElement') return '#ffffff'
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
  snapToGrid = true,
  showRuler = true,
  showConnectionPoints = true,
  preview = false,
  defaultViewport,
  controlsStyle,
  onAddText,
  onInsertImage,
  onMoveEnd,
}: IntegrationArchitectureFlowProps) {
  const pendingEdgeUpdateRef = useRef<{
    original: Edge
    x: number
    y: number
    oldEdge?: Edge
    connection?: Connection
  } | null>(null)
  const reconnectingEdgeRef = useRef(false)
  const [panMode, setPanMode] = useState(false)
  const hasSelectedEdge = !preview && edges.some((edge) => edge.selected)

  const finishEdgeReconnect = useCallback(() => {
    pendingEdgeUpdateRef.current = null
    window.setTimeout(() => {
      reconnectingEdgeRef.current = false
    }, 0)
  }, [])

  const handleEdgeUpdateStart = useCallback((event: MouseEvent, edge: Edge) => {
    reconnectingEdgeRef.current = true
    pendingEdgeUpdateRef.current = {
      original: edge,
      x: event.clientX,
      y: event.clientY,
    }
  }, [])

  const handleEdgeUpdate = useCallback((oldEdge: Edge, connection: Connection) => {
    const pending = pendingEdgeUpdateRef.current
    if (pending) {
      pendingEdgeUpdateRef.current = { ...pending, oldEdge, connection }
      return
    }
    onEdgeUpdate?.(oldEdge, connection)
  }, [onEdgeUpdate])

  const handleEdgeUpdateEnd = useCallback((event: MouseEvent | TouchEvent) => {
    const pending = pendingEdgeUpdateRef.current
    if (pending?.oldEdge && pending.connection) {
      const point = 'clientX' in event ? event : { clientX: pending.x, clientY: pending.y }
      const distance = Math.hypot(point.clientX - pending.x, point.clientY - pending.y)
      if (distance >= EDGE_UPDATE_DRAG_THRESHOLD_PX) {
        onEdgeUpdate?.(pending.oldEdge, pending.connection)
      }
    }
    finishEdgeReconnect()
  }, [finishEdgeReconnect, onEdgeUpdate])

  const handleConnect = useCallback((connection: Connection) => {
    if (reconnectingEdgeRef.current) return
    onConnect?.(connection)
  }, [onConnect])

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
        edges={edges}
        nodeTypes={INTEGRATION_NODE_TYPES}
        edgeTypes={INTEGRATION_EDGE_TYPES}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
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
        edgesUpdatable={!preview ? 'selected' : false}
        edgeUpdaterRadius={14}
        panOnDrag={preview ? false : panMode ? [0, 1, 2] : [1, 2]}
        selectionOnDrag={!preview && !panMode}
        snapToGrid={!preview && snapToGrid}
        snapGrid={INTEGRATION_SNAP_GRID}
        zoomOnScroll={!preview}
        zoomOnPinch={!preview}
        zoomOnDoubleClick={false}
        minZoom={preview ? 0.2 : 0.55}
        maxZoom={preview ? 1 : 1.4}
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
