import { act, createElement, useState, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Edge, Node } from 'reactflow'
import { IntegrationArchitectureFlow } from './IntegrationArchitectureFlow'
import { reconnectDiagramEdge } from '../lib/diagramConnections'
import type { ArchimateNodeData } from '../lib/integrationArchitectureTypes'
const state=vi.hoisted(()=>({zoom:1,panX:0,panY:0,flow:null as Record<string,any>|null,nodes:[] as any[],store:{onError:null,connectionStartHandle:null,cancelConnection:vi.fn(),isValidConnection:vi.fn(()=>true)}}))
vi.mock('reactflow',async importOriginal=>({
 ...await importOriginal<typeof import('reactflow')>(),
 ReactFlow:(props:Record<string,unknown>)=>{state.flow=props;return null},
 useStore:(select:(s:unknown)=>unknown)=>select({transform:[state.panX,state.panY,state.zoom]}),
 useStoreApi:()=>({getState:()=>state.store,setState:(value:object)=>Object.assign(state.store,value)}),
 useReactFlow:()=>({getNodes:()=>state.nodes,screenToFlowPosition:(p:{x:number;y:number})=>({x:(p.x-180-state.panX)/state.zoom,y:(p.y-120-state.panY)/state.zoom})}),
}))
const fixtureNodes:Node<ArchimateNodeData>[]=[['a',100,40,80,80],['b',400,200,200,100],['c',800,400,200,100]].map(([id,x,y,width,height])=>({id:String(id),type:'bpmnElement',position:{x:Number(x),y:Number(y)},style:{width,height},data:{kind:'element',layer:'application',stereotype:'task',notationId:'task',title:String(id),description:[]}}))
const original:Edge={id:'flow',source:'a',target:'b',sourceHandle:'source-bottom',targetHandle:'target-top',selected:true}
let host:HTMLDivElement,root:Root,current:Edge[],initial:Edge[]
function Harness(){
 const [edges,setEdges]=useState(initial);current=edges
 return createElement(IntegrationArchitectureFlow,{nodes:fixtureNodes,edges,showGrid:false,showRuler:false,
 onEdgeUpdate:(edge,connection)=>setEdges(list=>reconnectDiagramEdge(edge,connection,list)),
 onPaneClick:()=>setEdges(list=>list.map(e=>({...e,selected:false}))),
 onEdgeClick:()=>setEdges(list=>list.map(e=>({...e,selected:true}))),
 } satisfies ComponentProps<typeof IntegrationArchitectureFlow>)
}
const screen=(x:number,y:number)=>({clientX:180+state.panX+x*state.zoom,clientY:120+state.panY+y*state.zoom})
beforeEach(()=>{(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);initial=[{...original}];state.nodes=fixtureNodes;state.zoom=1;state.panX=0;state.panY=0;state.store.isValidConnection.mockReturnValue(true)})
afterEach(async()=>{await act(async()=>root.unmount());host.remove()})
describe('reconnect release, click and reload regression',()=>{
 it('commits the off-center perimeter release and preserves it through deselect, reselect, pan/zoom and saved reload',async()=>{
  for(const [i,zoom] of [0.1,0.55,1,1.4,4].entries()){
   state.zoom=zoom;state.panX=70+i*20;state.panY=-35+i*10;initial=[{...original}]
   await act(async()=>root.render(createElement(Harness,{key:`drag-${i}`})))
   await act(async()=>state.flow!.onEdgeUpdateStart(new MouseEvent('mousedown',{...screen(500,200)}),current[0],'source'))
   // This release is between registered dots and 24px outside the node: native reconnect did not emit onEdgeUpdate.
   await act(async()=>state.flow!.onEdgeUpdateEnd(new MouseEvent('mouseup',{...screen(462,200-24/zoom)})))
   expect(current[0]).toMatchObject({id:'flow',source:'a',target:'b',sourceHandle:'source-bottom',targetHandle:'target-top-31',data:{manualConnectionHandles:true}})
   await act(async()=>state.flow!.onPaneClick())
   expect(current[0].targetHandle).toBe('target-top-31')
   await act(async()=>state.flow!.onEdgeClick())
   expect(current[0].targetHandle).toBe('target-top-31')
   initial=JSON.parse(JSON.stringify(current));state.panX+=300;state.panY-=150
   await act(async()=>root.render(createElement(Harness,{key:`reload-${i}`})))
   expect(current[0].targetHandle).toBe('target-top-31')
  }
 })
 it('supports moving the source endpoint while retaining the stationary target handle',async()=>{
  await act(async()=>root.render(createElement(Harness)))
  await act(async()=>state.flow!.onEdgeUpdateStart(new MouseEvent('mousedown',screen(140,120)),current[0],'target'))
  await act(async()=>state.flow!.onEdgeUpdateEnd(new MouseEvent('mouseup',screen(862,524))))
  expect(current[0]).toMatchObject({id:'flow',source:'c',sourceHandle:'source-bottom-31',target:'b',targetHandle:'target-top'})
 })
 it('honors the existing connection validator when projecting a perimeter release',async()=>{
  await act(async()=>root.render(createElement(Harness)))
  state.store.isValidConnection.mockReturnValue(false)
  await act(async()=>state.flow!.onEdgeUpdateStart(new MouseEvent('mousedown',screen(500,200)),current[0],'source'))
  await act(async()=>state.flow!.onEdgeUpdateEnd(new MouseEvent('mouseup',screen(462,176))))
  expect(current[0]).toEqual(original)
 })
 it('keeps the original anchor for a click, Escape cancellation and release in empty space',async()=>{
  await act(async()=>root.render(createElement(Harness)))
  const originalPoint=screen(500,200)
  await act(async()=>state.flow!.onEdgeUpdateStart(new MouseEvent('mousedown',originalPoint),current[0],'source'))
  await act(async()=>state.flow!.onEdgeUpdateEnd(new MouseEvent('mouseup',originalPoint)))
  expect(current[0]).toEqual(original)
  await act(async()=>state.flow!.onEdgeUpdateStart(new MouseEvent('mousedown',originalPoint),current[0],'source'))
  await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})))
  await act(async()=>state.flow!.onEdgeUpdateEnd(new MouseEvent('mouseup',screen(462,176))))
  expect(current[0]).toEqual(original)
  await act(async()=>state.flow!.onEdgeUpdateStart(new MouseEvent('mousedown',originalPoint),current[0],'source'))
  await act(async()=>state.flow!.onEdgeUpdateEnd(new MouseEvent('mouseup',screen(2000,2000))))
  expect(current[0]).toEqual(original)
 })
})
