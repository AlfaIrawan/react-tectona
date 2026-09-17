import { memo, useCallback, useRef, type MouseEvent } from 'react'
import {
  ConnectionLineType,
  ConnectionMode,
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
  if (node.id === 'legend' || node.id === 'canvas-notes') return '#f8fafc'
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
  onNodeContextMenu?: (event: MouseEvent) => void
  onEdgeContextMenu?: (event: MouseEvent) => void
  showGrid?: boolean
  showGuides?: boolean
  snapToGrid?: boolean
  showRuler?: boolean
  showConnectionArrows?: boolean
  showConnectionPoints?: boolean
  preview?: boolean
  defaultViewport?: Viewport
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
  onEdgeContextMenu,
  showGrid = true,
  showGuides = true,
  snapToGrid = true,
  showRuler = true,
  showConnectionArrows = true,
  showConnectionPoints = true,
  preview = false,
  defaultViewport,
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
        className={`integration-flow-canvas h-full w-full${hasSelectedEdge ? ' edge-endpoint-edit' : ''}`}
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
        onEdgeContextMenu={onEdgeContextMenu}
        onMoveEnd={preview ? undefined : onMoveEnd}
        onError={handleReactFlowError}
        onInit={handleInit}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.SmoothStep}
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
        panOnDrag={!preview}
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
      {!preview ? <Controls showInteractive /> : null}
        {showGrid ? <CanvasViewportGrid /> : null}
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
