import { useStore } from 'reactflow'
import type { PointerEvent } from 'react'
import type { RoutePoint } from '@/modules/project-management/lib/diagramSegmentRouting'

/** Wide invisible segment hit areas retain small, constant-screen-size visual grips. */
export function DiagramEdgeSegmentControls({points,editable,start}:{points:RoutePoint[];editable:boolean;start:(index:number,event:PointerEvent<SVGLineElement>)=>void}) {
  const zoom=useStore(s=>s.transform[2])||1
  if(!editable)return null
  return <g data-diagram-segments className="nodrag nopan">
    {points.slice(1).map((b,index)=>{
      const a=points[index],length=Math.hypot(b.x-a.x,b.y-a.y)
      if(length<8/zoom)return null
      const horizontal=Math.abs(b.y-a.y)<0.001,inset=Math.min(length/3,12/zoom),dx=(b.x-a.x)/length,dy=(b.y-a.y)/length
      return <g key={index}>
        <line data-diagram-segment={index} aria-label={`Move ${horizontal?'horizontal':'vertical'} segment ${index+1}`} x1={a.x+dx*inset} y1={a.y+dy*inset} x2={b.x-dx*inset} y2={b.y-dy*inset}
          stroke="transparent" strokeWidth={12/zoom} style={{pointerEvents:'stroke',cursor:horizontal?'ns-resize':'ew-resize',touchAction:'none'}}
          onPointerDown={event=>start(index,event)} onClick={event=>event.stopPropagation()}/>
        <rect data-diagram-segment-grip x={(a.x+b.x)/2-2.5/zoom} y={(a.y+b.y)/2-2.5/zoom} width={5/zoom} height={5/zoom} rx={1/zoom}
          fill="#fff" stroke="#0284c7" strokeWidth={1/zoom} pointerEvents="none"/>
      </g>
    })}
  </g>
}
