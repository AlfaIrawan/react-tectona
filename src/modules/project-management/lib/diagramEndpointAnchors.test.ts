import { describe, expect, it } from 'vitest'
import { centeredDiagramEndpoint, magneticDiagramAnchor, magneticAnchorHandle } from './diagramEndpointAnchors'
import { reconnectDiagramEdge, retainConnectionHandlePercents } from './diagramConnections'
import { mergeDiagramSourceEdges } from './diagramSourceMerge'
import type { Node, Edge } from 'reactflow'
const nodes:Node[]=[{id:'a',type:'bpmnElement',position:{x:100,y:40},style:{width:80,height:80},data:{notationId:'startEvent'}},{id:'b',type:'bpmnElement',position:{x:400,y:200},style:{width:200,height:100},data:{notationId:'task'}}]
describe('stable released connection anchors',()=>{
 it('uses exactly the preview/snap center for saved edges on all four sides',()=>{
  for(const side of ['top','right','bottom','left']){
   // React Flow supplies the outside of the handle box rather than its center.
   const raw={x:250+(side==='left'?-4:side==='right'?4:0),y:150+(side==='top'?-4:side==='bottom'?4:0)}
   expect(centeredDiagramEndpoint(raw.x,raw.y,side,`target-${side}-31`)).toEqual({x:250,y:150})
   expect(centeredDiagramEndpoint(raw.x,raw.y,side,null)).toEqual(raw)
  }
 })
 it('pins an off-center release near a node to its perimeter across zoom, selection and storage round trips',()=>{
  for(const zoom of [0.1,0.55,1,1.4,4]){
   const anchor=magneticDiagramAnchor({x:462,y:200-24/zoom},nodes,'a',zoom)!
   expect(anchor).toMatchObject({nodeId:'b',side:'top',percent:31,point:{x:462,y:200}})
   const original:Edge={id:'flow',source:'a',target:'b',sourceHandle:'source-bottom',targetHandle:'target-top',label:'Yes'}
   const saved=reconnectDiagramEdge(original,{source:'a',target:'b',sourceHandle:'source-bottom',targetHandle:magneticAnchorHandle(anchor,'target')},[original])[0]
   for(const selected of [true,false,true,false]){
    const restored=JSON.parse(JSON.stringify({...saved,selected}))
    expect(mergeDiagramSourceEdges([restored],[{...original}])[0]).toMatchObject({targetHandle:'target-top-31',data:{manualConnectionHandles:true}})
    expect(retainConnectionHandlePercents('top',[12,50,88],[restored.targetHandle])).toContain(31)
   }
  }
 })
 it('does not reconnect empty space or the stationary node, and honors nested node coordinates',()=>{
  expect(magneticDiagramAnchor({x:1000,y:1000},nodes,'a',1)).toBeNull()
  expect(magneticDiagramAnchor({x:140,y:40},nodes,'a',1)).toBeNull()
  const nested:Node[]=[{id:'parent',type:'archimateBoundary',position:{x:300,y:200},style:{width:500,height:400},data:{}},{id:'child',type:'umlClass',parentNode:'parent',position:{x:40,y:50},style:{width:100,height:80},data:{}}]
  expect(magneticDiagramAnchor({x:371,y:240},nested,'a',1)).toMatchObject({nodeId:'child',side:'top',percent:31,point:{x:371,y:250}})
 })
})
