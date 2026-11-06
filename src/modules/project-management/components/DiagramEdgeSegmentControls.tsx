import { useEffect, useRef, useState, type PointerEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useReactFlow, useStore } from 'reactflow'
import { visualPxToLayoutPx } from '@/lib/uiScale'
import { diagramClientToFlow, nearestRouteSegment, type RouteControl } from '@/modules/project-management/lib/diagramManualControls'
import type { RoutePoint } from '@/modules/project-management/lib/diagramSegmentRouting'

/** Segment hit areas stay invisible; only user-created helper points are painted. */
export function DiagramEdgeSegmentControls({edgeId,points,controls,editable,start}:{edgeId:string;points:RoutePoint[];controls:RouteControl[];editable:boolean;start:(index:number,event:PointerEvent<SVGElement>)=>void}) {
  const zoom=useStore(s=>s.transform[2])||1,host=useStore(s=>s.domNode),transform=useStore(s=>s.transform)
  const {setEdges,screenToFlowPosition}=useReactFlow()
  const [menu,setMenu]=useState<{x:number;y:number;point:RoutePoint;index:number;controlId?:string}|null>(null)
  const menuRef=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    if(!menu)return
    const close=(event:Event)=>{if(!menuRef.current?.contains(event.target as Node))setMenu(null)}
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setMenu(null)}}
    window.addEventListener('pointerdown',close,true);window.addEventListener('keydown',key,true);window.addEventListener('blur',close)
    return()=>{window.removeEventListener('pointerdown',close,true);window.removeEventListener('keydown',key,true);window.removeEventListener('blur',close)}
  },[menu])
  useEffect(()=>setMenu(null),[transform[0],transform[1],zoom,editable])
  if(!editable)return null
  const open=(index:number,controlId?:string)=>(event:MouseEvent<SVGElement>)=>{
    event.preventDefault();event.stopPropagation()
    setMenu({x:event.clientX,y:event.clientY,index,controlId,point:diagramClientToFlow({x:event.clientX,y:event.clientY},screenToFlowPosition,host)})
  }
  const update=(remove:boolean)=>{
    if(!menu)return
    const segment=nearestRouteSegment([points[menu.index],points[menu.index+1]],menu.point)
    const next=remove?controls.filter(c=>c.id!==menu.controlId):segment?[...controls,{id:`point-${globalThis.crypto?.randomUUID?.()??Math.random().toString(36).slice(2)}`,...segment.point,axis:segment.axis}]:controls
    setEdges(edges=>edges.map(edge=>edge.id===edgeId?{...edge,selected:true,data:{...edge.data,segmentRoute:{...edge.data?.segmentRoute,points,controls:next}}}:edge))
    setMenu(null)
  }
  return <>
    <g data-diagram-segments className="nodrag nopan">
      {points.slice(1).map((b,index)=>{
        const a=points[index],length=Math.hypot(b.x-a.x,b.y-a.y)
        if(length<8/zoom)return null
        const horizontal=Math.abs(b.y-a.y)<0.001,inset=Math.min(length/3,12/zoom),dx=(b.x-a.x)/length,dy=(b.y-a.y)/length
        return <line key={index} data-diagram-segment={index} aria-label={`Move ${horizontal?'horizontal':'vertical'} segment ${index+1}`} x1={a.x+dx*inset} y1={a.y+dy*inset} x2={b.x-dx*inset} y2={b.y-dy*inset}
          stroke="transparent" strokeWidth={12/zoom} style={{pointerEvents:'stroke',cursor:horizontal?'ns-resize':'ew-resize',touchAction:'none'}}
          onPointerDown={event=>start(index,event)} onClick={event=>event.stopPropagation()} onContextMenu={open(index)}/>
      })}
      {controls.map(control=>{
        const segment=nearestRouteSegment(points,control,control.axis);if(!segment)return null
        return <g key={control.id} data-diagram-manual-control={control.id}>
          <circle cx={control.x} cy={control.y} r={10/zoom} fill="transparent" style={{pointerEvents:'all',cursor:control.axis==='y'?'ns-resize':'ew-resize',touchAction:'none'}}
            onPointerDown={event=>start(segment.index,event)} onClick={event=>event.stopPropagation()} onContextMenu={open(segment.index,control.id)}/>
          <circle data-diagram-control-dot cx={control.x} cy={control.y} r={2.75/zoom} fill="#fff" stroke="#0284c7" strokeWidth={1/zoom} pointerEvents="none"/>
        </g>
      })}
    </g>
    {menu?createPortal(<div ref={menuRef} role="menu" aria-label="Titik bantu relasi" className="nodrag nopan" style={{position:'fixed',left:visualPxToLayoutPx(Math.max(8,Math.min(window.innerWidth-205,menu.x))),top:visualPxToLayoutPx(Math.max(8,Math.min(window.innerHeight-90,menu.y))),zIndex:10000,background:'#fff',color:'#0f172a',border:'1px solid #cbd5e1',borderRadius:8,padding:5,boxShadow:'0 8px 24px #0f172a22',fontSize:13,minWidth:185}} onPointerDown={e=>e.stopPropagation()}>
      <button type="button" role="menuitem" style={{padding:'7px 10px',width:'100%',textAlign:'left'}} onClick={()=>update(false)}>Tambah titik bantu</button>
      {menu.controlId?<button type="button" role="menuitem" style={{padding:'7px 10px',width:'100%',textAlign:'left'}} onClick={()=>update(true)}>Hapus titik bantu</button>:null}
    </div>,document.body):null}
  </>
}
