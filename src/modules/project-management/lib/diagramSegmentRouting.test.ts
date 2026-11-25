import { describe, expect, it } from 'vitest'
import { Position } from 'reactflow'
import { compactRoute, moveRouteSegment, readSegmentRoute, roundedRoutePath, segmentRoutePoints, routeThroughControls } from './diagramSegmentRouting'
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
  const edge={id:'rel',source:'a',target:'b',sourceHandle:'source-bottom-31.5',targetHandle:'target-top-67.75',label:'Uses',style:{strokeDasharray:'6 4'},data:{manualConnectionHandles:true,visual:{lineStyle:'dashed',endArrow:'diamond'},segmentRoute:{routingVersion:2 as const,points:moveRouteSegment(segmentRoutePoints(args),1,210,Position.Bottom,Position.Top)}}}
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

describe('whole spans without hidden helper bends',()=>{
 const a={sourceX:0,sourceY:0,targetX:200,targetY:100,sourcePosition:Position.Right,targetPosition:Position.Left}
 it('does not add a terminal kink when a nearby track is saved and rendered repeatedly',()=>{
  const points=[{x:0,y:0},{x:10,y:0},{x:10,y:100},{x:200,y:100}]
  let route={points,routingVersion:2 as const}
  for(let i=0;i<20;i++){
   const rendered=segmentRoutePoints(a,JSON.parse(JSON.stringify(route)))
   expect(rendered).toEqual(points);route={points:rendered,routingVersion:2 as const}
  }
 })
 it('moves an entire collinear span across former serialized points',()=>{
  const points=[{x:0,y:0},{x:100,y:0},{x:100,y:30},{x:100,y:60},{x:100,y:100},{x:200,y:100}]
  for(const index of [1,2,3])expect(moveRouteSegment(points,index,60,Position.Right,Position.Left)).toEqual([{x:0,y:0},{x:60,y:0},{x:60,y:100},{x:200,y:100}])
 })
 it('removes backtracking and closed excursions instead of retaining a hidden loop',()=>{
  expect(compactRoute([{x:0,y:0},{x:18,y:0},{x:10,y:0},{x:10,y:100},{x:200,y:100}])).toEqual([{x:0,y:0},{x:10,y:0},{x:10,y:100},{x:200,y:100}])
  const loop=[{x:0,y:0},{x:0,y:80},{x:200,y:80},{x:200,y:40},{x:100,y:40},{x:100,y:200}]
  expect(compactRoute(loop)).toEqual([{x:0,y:0},{x:0,y:80},{x:100,y:80},{x:100,y:200}])
 })
 it('releases deleted control geometry and routes through remaining manual constraints',()=>{
  expect(routeThroughControls(a,[])).toEqual(segmentRoutePoints(a))
  const control={id:'kept',x:80,y:60,axis:'x' as const}
  const route=routeThroughControls(a,[control])
  expect(orthogonal(route)).toBe(true);expect(route[0]).toEqual({x:0,y:0});expect(route.at(-1)).toEqual({x:200,y:100})
  expect(route.some((p,i)=>i>0&&p.x===80&&route[i-1].x===80&&Math.min(p.y,route[i-1].y)<=60&&Math.max(p.y,route[i-1].y)>=60)).toBe(true)
 })
 it('stays stable through drag/release/reselect and persistence for every node side',()=>{
  for(const sourcePosition of Object.values(Position))for(const targetPosition of Object.values(Position)){
   const pathArgs={...args,sourcePosition,targetPosition};let points=segmentRoutePoints(pathArgs)
   for(let step=0;step<8;step++){
    const i=Math.min(1,points.length-2),horizontal=points[i].y===points[i+1].y
    points=moveRouteSegment(points,i,(horizontal?points[i].y:points[i].x)+(step%2?45:-33),sourcePosition,targetPosition)
    const reloaded=readSegmentRoute(JSON.parse(JSON.stringify({points,routingVersion:2})))!
    expect(segmentRoutePoints(pathArgs,reloaded)).toEqual(points)
    const vector={left:{x:-1,y:0},right:{x:1,y:0},top:{x:0,y:-1},bottom:{x:0,y:1}}
    const first=points[1],last=points[points.length-2],sourceDir=vector[sourcePosition],targetDir=vector[targetPosition]
    expect((first.x-args.sourceX)*sourceDir.x+(first.y-args.sourceY)*sourceDir.y).toBeGreaterThan(0)
    expect((last.x-args.targetX)*targetDir.x+(last.y-args.targetY)*targetDir.y).toBeGreaterThan(0)
    expect(orthogonal(points)).toBe(true);expect(points[0]).toEqual({x:args.sourceX,y:args.sourceY});expect(points.at(-1)).toEqual({x:args.targetX,y:args.targetY})
   }
  }
 })
})

describe('temporary terminal detours',()=>{
 const original=[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:200,y:100}]
 const transforms=([false,true] as const).flatMap(transposed=>[1,-1].flatMap(flipX=>[1,-1].map(flipY=>({transposed,flipX,flipY}))))
 it.each(transforms)('removes obsolete source and target safety bends after crossing and returning ($transposed/$flipX/$flipY)',({transposed,flipX,flipY})=>{
  const initial=original.map(p=>({x:(transposed?p.y:p.x)*flipX||0,y:(transposed?p.x:p.y)*flipY||0}))
  const source=transposed?(flipY===1?Position.Bottom:Position.Top):(flipX===1?Position.Right:Position.Left)
  const target=transposed?(flipY===1?Position.Top:Position.Bottom):(flipX===1?Position.Left:Position.Right)
  const direction=transposed?flipY:flipX
  let points=initial
  for(const coordinate of [-50,100,250,100,-30,100].map(value=>value*direction)){
   const index=points.findIndex((p,i)=>i<points.length-1 && (transposed?p.y===points[i+1].y:p.x===points[i+1].x)
    && Math.abs(transposed?points[i+1].x-p.x:points[i+1].y-p.y)>=100)
   points=moveRouteSegment(points,index,coordinate,source,target)
   expect(points[0]).toEqual(initial[0]);expect(points.at(-1)).toEqual(initial.at(-1))
   expect(orthogonal(points)).toBe(true)
   if(coordinate===100*direction)expect(points).toEqual(initial)
   const route=readSegmentRoute(JSON.parse(JSON.stringify({points,routingVersion:2})))!
   const pathArgs={sourceX:initial[0].x,sourceY:initial[0].y,targetX:initial.at(-1)!.x,targetY:initial.at(-1)!.y,sourcePosition:source,targetPosition:target}
   expect(segmentRoutePoints(pathArgs,route)).toEqual(points)
  }
 })
 it('preserves explicit helpers on the generated detour',()=>{
  const detour=moveRouteSegment(original,1,-50,Position.Right,Position.Left)
  for(const control of [{x:18,y:-10},{x:18,y:0}]){
   const result=moveRouteSegment(detour,3,100,Position.Right,Position.Left,[control])
   expect(result).toEqual([{x:0,y:0},{x:18,y:0},{x:18,y:-18},{x:100,y:-18},{x:100,y:100},{x:200,y:100}])
  }
 })
 it('does not collapse an intentionally sized terminal route',()=>{
  const authored=[{x:0,y:0},{x:18,y:0},{x:18,y:-35},{x:100,y:-35},{x:100,y:100},{x:200,y:100}]
  expect(moveRouteSegment(authored,3,120,Position.Right,Position.Left)).toEqual(authored.map((p,i)=>i===3||i===4?{...p,x:120}:p))
 })
})

describe('explicit points bound a span',()=>{
 it('keeps a manual point fixed while only its adjoining span is moved',()=>{
  const control={x:100,y:50,id:'kept',axis:'x' as const}
  const points=[{x:0,y:0},{x:100,y:0},control,{x:100,y:100},{x:200,y:100}]
  const moved=moveRouteSegment(points,1,60,Position.Right,Position.Left,[control])
  expect(moved).toEqual([{x:0,y:0},{x:60,y:0},{x:60,y:50},{x:100,y:50},{x:100,y:100},{x:200,y:100}])
  expect(readSegmentRoute({points:moved,controls:[control]})?.controls).toEqual([control])
 })
 it('does not remove a loop that is constrained by an explicit manual point',()=>{
  const loop=[{x:0,y:0},{x:0,y:80},{x:200,y:80},{x:200,y:40},{x:100,y:40},{x:100,y:200}]
  expect(compactRoute(loop,[{x:200,y:60}])).toEqual(loop)
 })
})

it('retains an intentional closed self-relation',()=>{const route=[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100},{x:0,y:0}];expect(compactRoute(route)).toEqual(route)})

it('removes a small unconstrained overshoot kink but keeps an explicit constraint',()=>{
 const route=[{x:98,y:19},{x:40,y:19},{x:40,y:40},{x:57,y:40},{x:57,y:59}]
 expect(compactRoute(route)).toEqual([{x:98,y:19},{x:57,y:19},{x:57,y:59}])
 expect(compactRoute(route,[{x:40,y:30}])).toEqual(route)
})

it('cleans a legacy hidden kink but preserves newly edited span geometry after JSON reload',()=>{const points=[{x:98,y:19},{x:40,y:19},{x:40,y:40},{x:57,y:40},{x:57,y:59}];expect(readSegmentRoute({points})!.points).toHaveLength(3);const route=JSON.parse(JSON.stringify({points,routingVersion:2}));expect(readSegmentRoute(route)!.points).toEqual(points);expect(readSegmentRoute(route)!.routingVersion).toBe(2)})
