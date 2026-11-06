import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useReactFlow, useStore, type Position } from 'reactflow'
import { DiagramReconnectContext } from './useDiagramReconnect'
import { moveRouteSegment, type RoutePoint } from './diagramSegmentRouting'

type Identity = { source: string; target: string; sourceHandleId?: string | null; targetHandleId?: string | null }
type Drag = { points: RoutePoint[]; index: number; pointerId: number; start: RoutePoint; client: RoutePoint; grabOffset: number; identity: Identity }
export function useDiagramSegmentDrag(id: string, points: RoutePoint[], sourcePosition: Position, targetPosition: Position, identity: Identity, enabled: boolean) {
  const writable=Boolean(useContext(DiagramReconnectContext))
  const {setEdges,screenToFlowPosition}=useReactFlow()
  const transform=useStore(s=>s.transform),zoom=transform[2]||1
  const [preview,setPreview]=useState<RoutePoint[]|null>(null)
  const pending=useRef<Drag|null>(null)
  const latest=useRef({points,sourcePosition,targetPosition,identity,enabled:enabled&&writable,zoom,screenToFlowPosition,setEdges})
  latest.current={points,sourcePosition,targetPosition,identity,enabled:enabled&&writable,zoom,screenToFlowPosition,setEdges}
  const resolve=useCallback((drag:Drag,client:RoutePoint)=>{
    const now=latest.current
    if(Math.hypot(client.x-drag.start.x,client.y-drag.start.y)<3)return null
    const a=drag.points[drag.index],b=drag.points[drag.index+1],axis=Math.abs(a.y-b.y)<0.001?'y':'x'
    const coordinate=now.screenToFlowPosition(client)[axis]-drag.grabOffset/now.zoom
    return moveRouteSegment(drag.points,drag.index,coordinate,now.sourcePosition,now.targetPosition)
  },[])
  const start=useCallback((index:number,event:ReactPointerEvent<SVGLineElement>)=>{
    const now=latest.current
    if(!now.enabled||pending.current||event.button!==0)return
    event.preventDefault();event.stopPropagation()
    const a=now.points[index],b=now.points[index+1],axis=Math.abs(a.y-b.y)<0.001?'y':'x',client={x:event.clientX,y:event.clientY}
    pending.current={points:now.points,index,pointerId:event.pointerId,start:client,client,identity:now.identity,grabOffset:(now.screenToFlowPosition(client)[axis]-a[axis])*now.zoom}
    try{event.currentTarget.setPointerCapture?.(event.pointerId)}catch{/* Window listeners retain the gesture. */}
  },[])
  useEffect(()=>{
    if(!enabled||!writable)return
    const cancel=()=>{pending.current=null;setPreview(null)}
    const move=(event:PointerEvent)=>{const drag=pending.current;if(!drag||drag.pointerId!==event.pointerId)return;drag.client={x:event.clientX,y:event.clientY};setPreview(resolve(drag,drag.client))}
    const finish=(event:PointerEvent)=>{
      const drag=pending.current;if(!drag||drag.pointerId!==event.pointerId)return
      const next=resolve(drag,{x:event.clientX,y:event.clientY});cancel()
      if(!next||!latest.current.enabled)return
      latest.current.setEdges(edges=>edges.map(edge=>edge.id===id && edge.source===drag.identity.source && edge.target===drag.identity.target
        && (edge.sourceHandle??null)===(drag.identity.sourceHandleId??null) && (edge.targetHandle??null)===(drag.identity.targetHandleId??null)
        ? {...edge,selected:true,data:{...edge.data,segmentRoute:{points:next}}}:edge))
    }
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&pending.current){event.preventDefault();event.stopPropagation();cancel()}}
    window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',finish,true);window.addEventListener('pointercancel',cancel,true);window.addEventListener('blur',cancel);window.addEventListener('keydown',key,true)
    return()=>{window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',finish,true);window.removeEventListener('pointercancel',cancel,true);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key,true)}
  },[id,resolve,enabled,writable])
  useLayoutEffect(()=>{const drag=pending.current;if(drag)setPreview(resolve(drag,drag.client))},[transform[0],transform[1],zoom,resolve])
  useEffect(()=>{if(!enabled||!writable){pending.current=null;setPreview(null)}},[enabled,writable])
  return {points:preview??points,start,editable:enabled&&writable}
}
