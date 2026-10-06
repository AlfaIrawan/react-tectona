import { Position, getSmoothStepPath, type ConnectionLineComponentProps } from 'reactflow'

const PREVIEW_STROKE = '#64748b'

/** Render the in-progress connection as an arrow, matching a saved workflow edge. */
export function WorkflowConnectionPreview({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
  connectionLineStyle,
}: ConnectionLineComponentProps) {
  const [path] = getSmoothStepPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition ?? Position.Bottom,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition ?? Position.Top,
    borderRadius: 8,
  })

  return (
    <g>
      <defs>
        <filter id="workflow-connection-preview-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <marker
          id="workflow-connection-preview-arrow"
          viewBox="0 0 12 12"
          markerWidth="10"
          markerHeight="10"
          refX="10"
          refY="6"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M2 2 L10 6 L2 10 Z" fill={PREVIEW_STROKE} />
        </marker>
      </defs>
      <path d={path} fill="none" stroke={PREVIEW_STROKE} strokeWidth={7} opacity={0.16} />
      <path
        d={path}
        fill="none"
        markerEnd="url(#workflow-connection-preview-arrow)"
        style={{ ...connectionLineStyle, stroke: PREVIEW_STROKE, strokeWidth: 2.25, filter: 'url(#workflow-connection-preview-glow)' }}
      />
    </g>
  )
}
