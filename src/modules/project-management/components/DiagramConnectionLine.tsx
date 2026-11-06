import { useId } from 'react'
import { getSmoothStepPath, useStore, type ConnectionLineComponentProps } from 'reactflow'
import { connectionPreviewTargetPosition } from '@/modules/project-management/lib/diagramConnections'

export function DiagramConnectionLine({ fromX, fromY, toX, toY, fromPosition, toPosition }: ConnectionLineComponentProps) {
  const markerId = useId()
  const hoveredHandleId = useStore(state => state.connectionEndHandle?.handleId)
  const targetPosition = connectionPreviewTargetPosition(fromX, fromY, toX, toY, toPosition, hoveredHandleId)
  const [path] = getSmoothStepPath({ sourceX: fromX, sourceY: fromY, targetX: toX, targetY: toY,
    sourcePosition: fromPosition, targetPosition, borderRadius: 0, offset: 18 })

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
