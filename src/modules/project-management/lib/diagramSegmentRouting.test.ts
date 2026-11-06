import { describe, expect, it } from 'vitest'
import { Position } from 'reactflow'
import { compactRoute, moveRouteSegment, readSegmentRoute, roundedRoutePath, segmentRoutePoints } from './diagramSegmentRouting'
import { buildPersistentC4Payload, emptyRuntimeC4Analysis, runtimeC4FromPersistent } from './c4ArchitectureService'
import { buildPersistentProcessDiagramPayload, emptyRuntimeProcessDiagramAnalysis, runtimeProcessDiagramFromPersistent } from './processDiagramService'
import { buildPersistentIntegrationPayload, EMPTY_RUNTIME_INTEGRATION_ANALYSIS, graphRecordFromPersistentIntegration } from './integrationArchitectureService'
import { mergeDiagramSourceEdges } from './diagramSourceMerge'
import { defaultIntegrationEdgeVisual } from './integrationEdgeAppearance'

const args={sourceX:100,sourceY:40,targetX:400,targetY:300,sourcePosition:Position.Bottom,targetPosition:Position.Top}
const orthogonal=(points:{x:number;y:number}[])=>points.slice(1).every((p,i)=>Math.abs(p.x-points[i].x)<0.001||Math.abs(p.y-points[i].y)<0.001)
describe('anchored orthogonal segment geometry',()=>{
 it('defaults to rounded corners',()=>{expect(defaultIntegrationEdgeVisual().waypoints).toBe('rounded')})
 it('moves every horizontal/vertical segment and terminal leg without moving either anchor',()=>{
  for(const sourcePosition of Object.values(Position))for(const targetPosition of Object.values(Position)){
   const initial=segmentRoutePoints({...args,sourcePosition,targetPosition})
   for(let i=0;i<initial.length-1;i++){
    const horizontal=initial[i].y===initial[i+1].y,coordinate=(horizontal?initial[i].y:initial[i].x)+63
    const moved=moveRouteSegment(initial,i,coordinate,sourcePosition,targetPosition)
    expect(moved[0]).toEqual(initial[0]);expect(moved.at(-1)).toEqual(initial.at(-1));expect(orthogonal(moved)).toBe(true)
    const rendered=segmentRoutePoints({...args,sourcePosition,targetPosition},{points:moved})
    expect(orthogonal(rendered)).toBe(true);expect(rendered[0]).toEqual(initial[0]);expect(rendered.at(-1)).toEqual(initial.at(-1))
    expect(roundedRoutePath(rendered)[0]).not.toMatch(/NaN|Infinity/)
   }
  }
 })
 it('adds terminal doglegs when a single straight vertical line is moved horizontally',()=>{
  const moved=moveRouteSegment([{x:200,y:100},{x:200,y:400}],0,310,Position.Bottom,Position.Top)
  expect(moved).toEqual([{x:200,y:100},{x:200,y:118},{x:310,y:118},{x:310,y:382},{x:200,y:382},{x:200,y:400}])
  expect(roundedRoutePath(moved)[0]).toContain(' Q ')
 })
 it('reattaches terminal legs after node move/resize/reconnect while keeping the edited track',()=>{
  const moved=moveRouteSegment(segmentRoutePoints(args),1,210,Position.Bottom,Position.Top)
  const points=segmentRoutePoints({...args,sourceX:180,sourceY:75,targetX:580,targetY:430,targetPosition:Position.Left},{points:moved})
  expect(points[0]).toEqual({x:180,y:75});expect(points.at(-1)).toEqual({x:580,y:430});expect(orthogonal(points)).toBe(true)
  expect(points[1].x).toBe(180);expect(points[1].y).toBeGreaterThan(75)
  expect(points.at(-2)!.y).toBe(430);expect(points.at(-2)!.x).toBeLessThan(580)
 })
 it('bounds radius on short legs and rejects corrupt/diagonal saved routes',()=>{
  expect(roundedRoutePath([{x:0,y:0},{x:2,y:0},{x:2,y:2}],20)[0]).toBe('M 0 0 L 1 0 Q 2 0 2 1 L 2 2')
  expect(readSegmentRoute({points:[{x:0,y:0},{x:NaN,y:2}]})).toBeUndefined()
  expect(readSegmentRoute({points:[{x:0,y:0},{x:2,y:2}]})).toBeUndefined()
  expect(compactRoute([{x:0,y:0},{x:0,y:0},{x:0,y:2},{x:0,y:4}])).toEqual([{x:0,y:0},{x:0,y:4}])
 })
 it('round-trips tracks, anchor IDs and styles through process/C4/ArchiMate payloads and source merge',()=>{
  const edge={id:'rel',source:'a',target:'b',sourceHandle:'source-bottom-31.5',targetHandle:'target-top-67.75',label:'Uses',style:{strokeDasharray:'6 4'},data:{manualConnectionHandles:true,visual:{lineStyle:'dashed',endArrow:'diamond'},segmentRoute:{points:moveRouteSegment(segmentRoutePoints(args),1,210,Position.Bottom,Position.Top)}}}
  const graph={nodes:[],edges:[edge],source:'source',viewport:{x:45,y:-30,zoom:0.625},userCustomized:true}
  const process=buildPersistentProcessDiagramPayload({...emptyRuntimeProcessDiagramAnalysis(),canvasGraph:graph},'qa')
  expect(runtimeProcessDiagramFromPersistent(JSON.parse(JSON.stringify({process_json:process.process_json})) as never).canvasGraph?.edges).toEqual([edge])
  const c4=buildPersistentC4Payload({...emptyRuntimeC4Analysis('L1'),canvasGraph:graph},'qa')
  expect(runtimeC4FromPersistent(JSON.parse(JSON.stringify({level:'L1',c4_json:c4.c4_json})) as never).canvasGraph?.edges).toEqual([edge])
  const integration=buildPersistentIntegrationPayload(EMPTY_RUNTIME_INTEGRATION_ANALYSIS,{...graph,plantumlSource:'source',savedAt:'now'},'qa')
  expect(graphRecordFromPersistentIntegration(JSON.parse(JSON.stringify({integration_json:integration.integration_json})) as never).edges).toEqual([edge])
  const merged=mergeDiagramSourceEdges([edge],[{id:'rel',source:'a',target:'b',label:'Updated',data:{technology:'new'}}])[0]
  expect(merged).toMatchObject({...edge,label:'Updated',data:{...edge.data,technology:'new'}})
 })
})
