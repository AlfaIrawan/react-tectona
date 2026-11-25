import { DIAGRAM_CORNER_RADIUS } from '@/modules/project-management/lib/diagramSegmentRouting'
import { magneticDiagramAnchor, magneticAnchorHandle } from '@/modules/project-management/lib/diagramEndpointAnchors'
import { useId } from 'react'
import { getSmoothStepPath, useStore, type ConnectionLineComponentProps } from 'reactflow'
import { connectionPreviewTargetPosition } from '@/modules/project-management/lib/diagramConnections'

export function DiagramConnectionLine({ fromX, fromY, toX, toY, fromPosition, toPosition, fromNode, connectionStatus }: ConnectionLineComponentProps) {
  const markerId = useId()
  const hoveredHandleId = useStore(state => state.connectionEndHandle?.handleId)
  const nodeInternals = useStore(state => state.nodeInternals)
  const nodes = nodeInternals ? Array.from(nodeInternals.values()) : []
  const zoom = useStore(state => state.transform[2]) || 1
  const magnetic = connectionStatus !== 'valid' && fromNode ? magneticDiagramAnchor({ x: toX, y: toY }, nodes, fromNode.id, zoom) : null
  const target = magnetic?.point ?? { x: toX, y: toY }
  const targetPosition = connectionPreviewTargetPosition(fromX, fromY, target.x, target.y, toPosition, magnetic ? magneticAnchorHandle(magnetic, 'target') : hoveredHandleId)
  const [path] = getSmoothStepPath({ sourceX: fromX, sourceY: fromY, targetX: target.x, targetY: target.y,
    sourcePosition: fromPosition, targetPosition, borderRadius: DIAGRAM_CORNER_RADIUS, offset: 18 })

  return (
    <g>
      <defs>
        <marker id={markerId} markerWidth="9" markerHeight="9" refX="9" refY="4.5" orient="auto" markerUnits="strokeWidth">
          <path d="M 0 0 L 9 4.5 L 0 9 z" fill="#64748b" />
        </marker>
      </defs>
      <path
        d={path}
        fill="none"
        stroke="#64748b"
        strokeWidth={1.5}
        strokeDasharray="4 4"
        markerEnd={`url(#${markerId})`}
      />
    </g>
  )
}
