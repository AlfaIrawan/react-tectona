import { useId } from 'react'
import { useStore } from 'reactflow'

/** Paint a small endpoint independently of React Flow's larger reconnect hit area. */
export function DiagramEdgeEndpointControls({ sourceX, sourceY, targetX, targetY, selected }: {
  sourceX: number; sourceY: number; targetX: number; targetY: number; selected?: boolean
}) {
  const id = useId()
  const zoom = useStore(state => state.transform[2]) || 1
  if (!selected) return null
  return <g data-diagram-endpoints={id} pointerEvents="none">
    <style>{`[data-diagram-endpoints="${id}"] ~ .react-flow__edgeupdater-source { cx: ${sourceX}px; cy: ${sourceY}px; }
[data-diagram-endpoints="${id}"] ~ .react-flow__edgeupdater-target { cx: ${targetX}px; cy: ${targetY}px; }`}</style>
    {[[sourceX, sourceY], [targetX, targetY]].map(([x,y], index) => <circle key={index} cx={x} cy={y} r={3.25 / zoom} fill="#fff" stroke="#0284c7" strokeWidth={1.25 / zoom} />)}
  </g>
}
