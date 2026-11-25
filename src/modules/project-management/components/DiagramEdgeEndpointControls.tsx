import { useContext } from 'react'
import { useStore, type Position } from 'reactflow'
import { DiagramReconnectContext } from '@/modules/project-management/lib/useDiagramReconnect'

/** The small painted dot and its larger hit target share the exact same anchor. */
export function DiagramEdgeEndpointControls({ edgeId, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected }: {
  edgeId: string; sourceX: number; sourceY: number; targetX: number; targetY: number; sourcePosition: Position; targetPosition: Position; selected?: boolean
}) {
  const reconnect = useContext(DiagramReconnectContext)
  const zoom = useStore(state => state.transform[2]) || 1
  if (!selected) return null
  const source = { x: sourceX, y: sourceY, position: sourcePosition }, target = { x: targetX, y: targetY, position: targetPosition }
  return <g data-diagram-endpoints pointerEvents="none">
    {(['source', 'target'] as const).map(type => <g key={type}>
      {reconnect ? <circle data-diagram-endpoint-hit={type} cx={type === 'source' ? sourceX : targetX} cy={type === 'source' ? sourceY : targetY} r={10 / zoom}
        fill="transparent" stroke="none" style={{ pointerEvents: 'all', cursor: reconnect.getPreview(edgeId) ? 'grabbing' : 'grab', touchAction: 'none' }}
        onPointerDown={event => reconnect.start({ edgeId, source, target, movingEnd: type }, event)} /> : null}
      <circle data-diagram-endpoint-dot={type} cx={type === 'source' ? sourceX : targetX} cy={type === 'source' ? sourceY : targetY} r={3.25 / zoom} fill="#fff" stroke="#0284c7" strokeWidth={1.25 / zoom} />
    </g>)}
  </g>
}
