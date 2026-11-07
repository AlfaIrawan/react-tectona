import { describe,it,expect } from 'vitest'
import { diagramClientToFlow, splitRouteAtControls, projectRouteControls, movedRouteControls } from './diagramManualControls'
import { facingMovedDiagramEdge, retargetMovedDiagramEdges } from './diagramMovingAnchors'
import { readSegmentRoute } from './diagramSegmentRouting'
const points=[{x:100,y:50},{x:100,y:180},{x:400,y:180},{x:400,y:300}]
describe('manual controls and moving anchors',()=>{
 it('projects only explicit controls and carries them with the segment they edit',()=>{
  expect(projectRouteControls([],points)).toEqual([])
  const controls=[{id:'manual',x:240,y:180,axis:'y' as const}]
  const after=[points[0],{x:100,y:230},{x:400,y:230},points[3]]
  expect(movedRouteControls(controls,points,after,1,230)).toEqual([{id:'manual',x:240,y:230,axis:'y'}])
  expect(readSegmentRoute({points,controls})?.controls).toEqual(controls)
  expect(readSegmentRoute({points,controls:'bad'})?.controls).toBeUndefined()
 })
 it.each([0.5,0.625,0.75,1,1.5])('normalizes client pixels under CSS scale %s',scale=>{
  const host={clientWidth:800,getBoundingClientRect:()=>({left:120,top:90,width:800*scale})} as HTMLElement
  const toFlow=(p:{x:number;y:number})=>({x:(p.x-120-40)/2,y:(p.y-90-20)/2})
  expect(diagramClientToFlow({x:120+240*scale,y:90+120*scale},toFlow,host)).toEqual({x:100,y:50})
 })
 it('changes facing sides only while retaining fractional positions, style and manual routing',()=>{
  const edge={id:'r',source:'a',target:'b',sourceHandle:'source-bottom-31.5',targetHandle:'target-top-67.75',data:{manualConnectionHandles:true,segmentRoute:{points},textStyle:{offsetX:44,offsetY:-23},visual:{lineStyle:'dashed'}}}
  const moved=facingMovedDiagramEdge(edge,{x:200,y:100,width:100,height:100},{x:-200,y:100,width:100,height:100})
  expect(moved).toMatchObject({...edge,sourceHandle:'source-left-31.5',targetHandle:'target-right-67.75'})
  expect(moved.data).toBe(edge.data)
  expect(facingMovedDiagramEdge(moved,{x:200,y:100,width:100,height:100},{x:-300,y:100,width:100,height:100})).toBe(moved)
 })
 it('follows nested boundary movement and leaves unrelated/unchanged edges alone',()=>{
  const nodes=[{id:'group',position:{x:600,y:0},data:{}},{id:'a',parentNode:'group',position:{x:20,y:50},style:{width:100,height:100},data:{}},{id:'b',position:{x:100,y:50},style:{width:100,height:100},data:{}}]
  const edge={id:'r',source:'a',target:'b',sourceHandle:'source-right',targetHandle:'target-left'}
  expect(retargetMovedDiagramEdges(nodes,[edge],new Set())[0]).toBe(edge)
  expect(retargetMovedDiagramEdges(nodes,[edge],new Set(['group']))[0]).toMatchObject({sourceHandle:'source-left',targetHandle:'target-right'})
 })
})

it('splits a hit span only at explicit helpers, ordered along the line',()=>{
 const route=[{x:0,y:0},{x:0,y:100}]
 expect(splitRouteAtControls(route,[])).toEqual(route)
 expect(splitRouteAtControls(route,[{id:'last',x:0,y:75,axis:'x'},{id:'first',x:0,y:25,axis:'x'}])).toEqual([{x:0,y:0},{x:0,y:25},{x:0,y:75},{x:0,y:100}])
})
