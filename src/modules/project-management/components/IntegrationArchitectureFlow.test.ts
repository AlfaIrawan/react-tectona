import { act, createElement, useState, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Position, type Edge, type EdgeProps, type Node } from 'reactflow'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDiagramReconnectPreview } from '../lib/useDiagramReconnect'
import { IntegrationArchitectureFlow } from './IntegrationArchitectureFlow'
import { ErdCrowfootEdge } from './ErdCrowfootEdge'
import { AnchoredSmoothStepEdge } from './AnchoredSmoothStepEdge'
import { connectionAnchor, reconnectDiagramEdge } from '../lib/diagramConnections'
import type { ArchimateNodeData } from '../lib/integrationArchitectureTypes'
const state=vi.hoisted(()=>({zoom:1,panX:0,panY:0,otherRenders:0,flow:null as Record<string,any>|null,nodes:[] as any[],render:null as ((p:any)=>any)|null,setEdges:null as any,store:{onError:null,connectionStartHandle:null,cancelConnection:vi.fn(),isValidConnection:vi.fn(()=>true),domNode:null as any,panBy:vi.fn(async()=>false)}}))
vi.mock('reactflow',async importOriginal=>({
 ...await importOriginal<typeof import('reactflow')>(),
 EdgeLabelRenderer:({children}:{children:any})=>children,
 ReactFlow:(props:Record<string,unknown>)=>{state.flow=props;return state.render?.(props)??null},
 useStore:(select:(s:unknown)=>unknown)=>select({transform:[state.panX,state.panY,state.zoom]}),
 useStoreApi:()=>({getState:()=>state.store,setState:(value:object)=>Object.assign(state.store,value)}),
 useReactFlow:()=>({setNodes:vi.fn(),setEdges:(value:any)=>state.setEdges(value),getNodes:()=>state.nodes,screenToFlowPosition:(p:{x:number;y:number})=>({x:(p.x-180-state.panX)/state.zoom,y:(p.y-120-state.panY)/state.zoom})}),
}))
const fixtureNodes:Node<ArchimateNodeData>[]=[['a',100,40,80,80],['b',400,200,200,100],['c',800,400,200,100]].map(([id,x,y,width,height])=>({id:String(id),type:'bpmnElement',position:{x:Number(x),y:Number(y)},style:{width,height},data:{kind:'element',layer:'application',stereotype:'task',notationId:'task',title:String(id),description:[]}}))
const original:Edge={id:'flow',source:'a',target:'b',sourceHandle:'source-bottom',targetHandle:'target-top',selected:true,data:{visual:{lineColor:'#c026d3',lineWidth:2,lineStyle:'solid',endArrow:'classic',endSize:9}}}
function UnrelatedEdgeProbe(){useDiagramReconnectPreview('unrelated-edge');state.otherRenders++;return null}
let host:HTMLDivElement,root:Root,current:Edge[],initial:Edge[]
function Harness(){
 const [edges,setEdges]=useState(initial);current=edges;state.setEdges=setEdges
 return createElement(IntegrationArchitectureFlow,{nodes:fixtureNodes,edges,showGrid:false,showRuler:false,
 onEdgeUpdate:(edge,connection)=>setEdges(list=>reconnectDiagramEdge(edge,connection,list)),
 onPaneClick:()=>setEdges(list=>list.map(e=>({...e,selected:false}))),
 onEdgeClick:()=>setEdges(list=>list.map(e=>({...e,selected:true}))),
 } satisfies ComponentProps<typeof IntegrationArchitectureFlow>)
}
const screen=(x:number,y:number)=>({clientX:180+state.panX+x*state.zoom,clientY:120+state.panY+y*state.zoom})
const pointer=(type:string,p:{clientX:number;clientY:number})=>{const e=new MouseEvent(type,{...p,button:0,bubbles:true,cancelable:true});Object.defineProperty(e,'pointerId',{value:1});return e}
const hit=(side:'source'|'target')=>host.querySelector(`[data-diagram-endpoint-hit="${side}"]`)!
const path=()=>host.querySelector<SVGPathElement>('.react-flow__edge-path')!
const rawPoint=(node:Node,handle:string)=>{const match=/(top|right|bottom|left)(?:-(\d+(?:\.\d+)?))?$/.exec(handle)!;const position=match[1] as Position;const p=connectionAnchor(position,Number(match[2]??50));const center={x:node.position.x+p.x/100*Number(node.style!.width),y:node.position.y+p.y/100*Number(node.style!.height)};return{...center,position,x:center.x+(position==='left'?-4:position==='right'?4:0),y:center.y+(position==='top'?-4:position==='bottom'?4:0)}}
beforeEach(()=>{
 (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true
 host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);initial=[structuredClone(original)];state.nodes=fixtureNodes;state.zoom=1;state.panX=0;state.panY=0;state.store.isValidConnection.mockReturnValue(true);state.store.domNode=null;state.store.panBy.mockReset().mockResolvedValue(false)
 state.render=props=>{const edge=props.edges[0] as Edge;const a=rawPoint(fixtureNodes.find(n=>n.id===edge.source)!,edge.sourceHandle!);const b=rawPoint(fixtureNodes.find(n=>n.id===edge.target)!,edge.targetHandle!);return createElement('svg',null,createElement(UnrelatedEdgeProbe),createElement('g',{'data-testid':'real-edge'},createElement(edge.type === 'erd' ? ErdCrowfootEdge : AnchoredSmoothStepEdge,{...edge,sourceX:a.x,sourceY:a.y,targetX:b.x,targetY:b.y,sourcePosition:a.position,targetPosition:b.position,sourceHandleId:edge.sourceHandle,targetHandleId:edge.targetHandle} as EdgeProps)))}
})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.useRealTimers()})
describe('real endpoint pointer interactions',()=>{
 it('keeps the same path, arrow and chosen style mounted on pointerdown anywhere within the endpoint hit area',async()=>{
  await act(async()=>root.render(createElement(Harness)))
  const element=path(),before=element.getAttribute('d'),arrow=host.querySelector('polygon')!.outerHTML,style=element.getAttribute('style')
  await act(async()=>hit('target').dispatchEvent(pointer('pointerdown',screen(495,203))))
  expect(path()).toBe(element);expect(path().getAttribute('d')).toBe(before);expect(path().getAttribute('style')).toBe(style);expect(host.querySelector('polygon')!.outerHTML).toBe(arrow)
  await act(async()=>window.dispatchEvent(pointer('pointermove',{clientX:screen(495,203).clientX+1,clientY:screen(495,203).clientY+1})))
  expect(path().getAttribute('d')).toBe(before)
  expect(path().style.strokeDasharray).toBe('')
  expect(state.flow!.edgesUpdatable).toBe(false);expect(state.flow!.edges[0].updatable).toBe(false)
  await act(async()=>window.dispatchEvent(pointer('pointerup',screen(495,203))))
  expect(current[0]).toEqual(original)
 })
 it('preserves the grab offset and anchor through drag, release, selection, pan/zoom and reload',async()=>{
  for(const [i,zoom] of [0.1,0.55,1,1.4,4].entries()){
   state.zoom=zoom;state.panX=70+i*20;state.panY=-35+i*10;initial=[structuredClone(original)]
   await act(async()=>root.render(createElement(Harness,{key:`drag-${i}`})))
   const start=screen(500,200);start.clientX-=5;start.clientY+=3
   await act(async()=>hit('target').dispatchEvent(pointer('pointerdown',start)))
   const drop=screen(462,200-24/zoom);drop.clientX-=5;drop.clientY+=3
   await act(async()=>window.dispatchEvent(pointer('pointermove',drop)))
   expect(current[0].targetHandle).toBe('target-top')
   expect(host.querySelector('polygon')!.getAttribute('points')!.split(' ')[0]).toBe('462,200')
   expect(path().style.strokeDasharray).toBe('')
   await act(async()=>window.dispatchEvent(pointer('pointerup',drop)))
   expect(current[0]).toMatchObject({id:'flow',targetHandle:'target-top-31',data:{manualConnectionHandles:true}})
   expect(current[0].data.visual).toEqual(original.data.visual)
   await act(async()=>state.flow!.onPaneClick());await act(async()=>state.flow!.onEdgeClick())
   expect(current[0].targetHandle).toBe('target-top-31')
   initial=JSON.parse(JSON.stringify(current));state.panX+=300;state.panY-=150
   await act(async()=>root.render(createElement(Harness,{key:`reload-${i}`})))
   expect(current[0].targetHandle).toBe('target-top-31')
  }
 })
 it('allows a four-pixel adjustment at high zoom without jumping to a whole-percent anchor',async()=>{
  state.zoom=4
  await act(async()=>root.render(createElement(Harness)))
  await act(async()=>hit('target').dispatchEvent(pointer('pointerdown',screen(500,200))))
  const drop=screen(501,200)
  await act(async()=>window.dispatchEvent(pointer('pointermove',drop)))
  expect(host.querySelector('polygon')!.getAttribute('points')!.split(' ')[0]).toBe('501,200')
  await act(async()=>window.dispatchEvent(pointer('pointerup',drop)))
  expect(current[0].targetHandle).toBe('target-top-50.5')
  expect(host.querySelector('polygon')!.getAttribute('points')!.split(' ')[0]).toBe('501,200')
 })
 it('updates the dragged edge without rerendering unrelated edge subscribers on every pointer movement',async()=>{
  await act(async()=>root.render(createElement(Harness)))
  await act(async()=>hit('target').dispatchEvent(pointer('pointerdown',screen(500,200))))
  const renders=state.otherRenders
  for(let i=0;i<10;i++) await act(async()=>window.dispatchEvent(pointer('pointermove',screen(460+i,176))))
  expect(state.otherRenders).toBe(renders)
  await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})))
 })
 it('keeps the endpoint under the same cursor grab offset when zoom and pan change during a drag',async()=>{
  await act(async()=>root.render(createElement(Harness)))
  const start=screen(500,200);start.clientX-=5;start.clientY+=3
  await act(async()=>hit('target').dispatchEvent(pointer('pointerdown',start)))
  const moved=screen(462,200);moved.clientX-=5;moved.clientY+=3
  await act(async()=>window.dispatchEvent(pointer('pointermove',moved)))
  state.zoom=2;state.panX=40;state.panY=20
  await act(async()=>root.render(createElement(Harness)))
  const drop=screen(462,200);drop.clientX-=5;drop.clientY+=3
  await act(async()=>window.dispatchEvent(pointer('pointermove',drop)))
  expect(host.querySelector('polygon')!.getAttribute('points')!.split(' ')[0]).toBe('462,200')
  await act(async()=>window.dispatchEvent(pointer('pointerup',drop)))
  expect(current[0].targetHandle).toBe('target-top-31')
 })
 it('continues auto-pan near canvas edges without committing the preview',async()=>{
  vi.useFakeTimers()
  state.store.domNode={getBoundingClientRect:()=>({left:180,top:120,right:980,bottom:720,width:800,height:600})}
  state.store.panBy.mockImplementation(async (delta?:{x:number;y:number})=>{state.panX+=delta?.x??0;state.panY+=delta?.y??0;return true})
  await act(async()=>root.render(createElement(Harness)))
  await act(async()=>hit('target').dispatchEvent(pointer('pointerdown',screen(500,200))))
  await act(async()=>window.dispatchEvent(pointer('pointermove',{clientX:185,clientY:320})))
  await act(async()=>vi.advanceTimersByTimeAsync(20))
  expect(state.store.panBy).toHaveBeenCalledWith({x:8,y:0})
  expect(current[0]).toEqual(original)
  await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})))
 })
 it('keeps the real target arrow at the target when dragging the source',async()=>{
  await act(async()=>root.render(createElement(Harness)))
  const arrow=host.querySelector('polygon')!.getAttribute('points')!.split(' ')[0]
  await act(async()=>hit('source').dispatchEvent(pointer('pointerdown',screen(140,120))))
  await act(async()=>window.dispatchEvent(pointer('pointermove',screen(862,524))))
  expect(host.querySelector('polygon')!.getAttribute('points')!.split(' ')[0]).toBe(arrow)
  await act(async()=>window.dispatchEvent(pointer('pointerup',screen(862,524))))
  expect(current[0]).toMatchObject({source:'c',sourceHandle:'source-bottom-31',target:'b',targetHandle:'target-top'})
 })
 it('restores the same solid path on Escape, pointercancel, blur and invalid release',async()=>{
  await act(async()=>root.render(createElement(Harness)))
  const before=path().getAttribute('d')
  for(const cancel of ['Escape','pointercancel','blur','invalid']){
   await act(async()=>hit('target').dispatchEvent(pointer('pointerdown',screen(500,200))))
   await act(async()=>window.dispatchEvent(pointer('pointermove',screen(462,176))))
   if(cancel==='invalid')state.store.isValidConnection.mockReturnValue(false)
   else await act(async()=>window.dispatchEvent(cancel==='Escape'?new KeyboardEvent('keydown',{key:'Escape'}):new Event(cancel)))
   await act(async()=>window.dispatchEvent(pointer('pointerup',screen(462,176))))
   expect(current[0]).toEqual(original);expect(path().getAttribute('d')).toBe(before);expect(path().style.strokeDasharray).toBe('')
  }
 })
 it('does not overwrite a label or chosen style updated while the endpoint is being dragged',async()=>{
  await act(async()=>root.render(createElement(Harness)))
  await act(async()=>hit('target').dispatchEvent(pointer('pointerdown',screen(500,200))))
  await act(async()=>window.dispatchEvent(pointer('pointermove',screen(462,176))))
  await act(async()=>state.setEdges((edges:Edge[])=>edges.map(edge=>({...edge,label:'Updated label',data:{...edge.data,visual:{...edge.data.visual,lineStyle:'dotted'}}}))))
  const pattern=path().style.strokeDasharray
  await act(async()=>window.dispatchEvent(pointer('pointerup',screen(462,176))))
  expect(current[0].label).toBe('Updated label');expect(current[0].data.visual.lineStyle).toBe('dotted');expect(path().style.strokeDasharray).toBe(pattern)
 })
 it('retains every chosen line pattern and route shape throughout reconnect',async()=>{
  for(const lineStyle of ['solid','dashed','dotted','dashdot']) for(const waypoints of ['sharp','rounded','curved']) {
    initial=[{...original,data:{visual:{lineStyle,lineWidth:3,startArrow:'diamond',endArrow:'open',waypoints}}}]
    await act(async()=>root.render(createElement(Harness,{key:lineStyle+waypoints})))
    const before=path().style.strokeDasharray,markers=host.querySelectorAll('polygon,polyline').length,d=path().getAttribute('d')
    await act(async()=>hit('target').dispatchEvent(pointer('pointerdown',screen(500,200))))
    expect(path().getAttribute('d')).toBe(d)
    await act(async()=>window.dispatchEvent(pointer('pointermove',screen(462,176))))
    expect(path().style.strokeDasharray).toBe(before);expect(host.querySelectorAll('polygon,polyline')).toHaveLength(markers)
    await act(async()=>window.dispatchEvent(pointer('pointerup',screen(462,176))))
    expect(current[0].data.visual).toEqual(initial[0].data.visual)
  }
 })
 it('preserves ERD crowfoot and optionality markers during an endpoint drag',async()=>{
  initial=[{...original,type:'erd',data:{sourceMany:true,targetMany:true,targetOptional:true}}]
  await act(async()=>root.render(createElement(Harness)))
  const markers=host.querySelectorAll('path:not(.react-flow__edge-path):not(.react-flow__edge-interaction),line,circle:not([data-diagram-endpoint-hit]):not([data-diagram-endpoint-dot])').length
  await act(async()=>hit('target').dispatchEvent(pointer('pointerdown',screen(500,200))))
  await act(async()=>window.dispatchEvent(pointer('pointermove',screen(462,176))))
  expect(host.querySelectorAll('path:not(.react-flow__edge-path):not(.react-flow__edge-interaction),line,circle:not([data-diagram-endpoint-hit]):not([data-diagram-endpoint-dot])')).toHaveLength(markers)
  await act(async()=>window.dispatchEvent(pointer('pointerup',screen(462,176))))
  expect(current[0].data).toMatchObject({sourceMany:true,targetMany:true,targetOptional:true,manualConnectionHandles:true})
 })
})
