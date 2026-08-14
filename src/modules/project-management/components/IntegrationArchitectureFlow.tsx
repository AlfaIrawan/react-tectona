import { memo } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeTypes,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
  type OnSelectionChangeFunc,
} from 'reactflow'
import { integrationArchimateNodeTypes } from '@/modules/project-management/components/integrationArchimateNodeTypes'
import { isArchimateElementData, type ArchimateNodeData } from '@/modules/project-management/lib/integrationArchitectureTypes'

const INTEGRATION_FLOW_DEFAULT_EDGE_OPTIONS = { type: 'smoothstep' as const }
const INTEGRATION_FLOW_FIT_VIEW_OPTIONS = { padding: 0.08, minZoom: 0.7 }
const INTEGRATION_FLOW_PRO_OPTIONS = { hideAttribution: true as const }
const INTEGRATION_EDGE_TYPES: EdgeTypes = {}

function handleReactFlowError(messageId: string, message: string) {
  // React Flow v11 + React StrictMode double-mount triggers #002 in dev even with stable types.
  if (messageId === '002') return
  console.warn(message)
}

function integrationMinimapNodeColor(node: Node): string {
  if (node.type === 'archimateBoundary') return '#e2e8f0'
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
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: (connection: Connection) => void
  onSelectionChange: OnSelectionChangeFunc
}

function IntegrationArchitectureFlowInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onSelectionChange,
}: IntegrationArchitectureFlowProps) {
  return (
    <ReactFlow
      className="h-full w-full"
      nodes={nodes}
      edges={edges}
      nodeTypes={integrationArchimateNodeTypes}
      edgeTypes={INTEGRATION_EDGE_TYPES}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onSelectionChange={onSelectionChange}
      onError={handleReactFlowError}
      fitView
      fitViewOptions={INTEGRATION_FLOW_FIT_VIEW_OPTIONS}
      nodesDraggable
      nodesConnectable
      elementsSelectable
      panOnDrag
      zoomOnScroll
      zoomOnPinch
      minZoom={0.55}
      maxZoom={1.4}
      proOptions={INTEGRATION_FLOW_PRO_OPTIONS}
      defaultEdgeOptions={INTEGRATION_FLOW_DEFAULT_EDGE_OPTIONS}
    >
      <MiniMap
        zoomable
        pannable
        nodeColor={integrationMinimapNodeColor}
        maskColor="rgba(15, 23, 42, 0.08)"
        className="!bg-white/95 !border !border-slate-200"
      />
      <Controls showInteractive />
      <Background color="#d7dee8" gap={22} />
    </ReactFlow>
  )
}

export const IntegrationArchitectureFlow = memo(IntegrationArchitectureFlowInner)
