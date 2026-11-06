import { getSmoothStepPath, type Position } from 'reactflow'

export type RoutePoint = { x: number; y: number }
export type DiagramSegmentRoute = { points: RoutePoint[] }
export type SegmentPathArgs = { sourceX: number; sourceY: number; targetX: number; targetY: number; sourcePosition: Position; targetPosition: Position }
const EPS = 0.001
export const DIAGRAM_CORNER_RADIUS = 12
const directions = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 } }
const same = (a: RoutePoint, b: RoutePoint) => Math.abs(a.x-b.x)<EPS && Math.abs(a.y-b.y)<EPS
export function compactRoute(points: RoutePoint[]): RoutePoint[] {
  const result: RoutePoint[] = []
  for (const point of points) {
    if (result.length && same(result[result.length-1],point)) continue
    while (result.length>1) {
      const a=result[result.length-2],b=result[result.length-1]
      const inline=(Math.abs(a.x-b.x)<EPS && Math.abs(b.x-point.x)<EPS)||(Math.abs(a.y-b.y)<EPS && Math.abs(b.y-point.y)<EPS)
      if (!inline || (b.x-a.x)*(point.x-b.x)+(b.y-a.y)*(point.y-b.y)<0) break
      result.pop()
    }
    result.push({...point})
  }
  return result
}
export function readSegmentRoute(value: unknown): DiagramSegmentRoute | undefined {
  const points=(value as DiagramSegmentRoute | undefined)?.points
  if (!Array.isArray(points)||points.length<2||points.length>1000||!points.every(p=>p && Number.isFinite(p.x)&&Number.isFinite(p.y))) return
  if (points.some((p,i)=>i>0 && Math.abs(p.x-points[i-1].x)>EPS && Math.abs(p.y-points[i-1].y)>EPS)) return
  return { points: compactRoute(points) }
}
const stub = (p: RoutePoint, side: Position) => ({x:p.x+directions[side].x*18,y:p.y+directions[side].y*18})

/** Rebuild terminal legs from the current node anchors, including after node moves or resize. */
export function segmentRoutePoints(args: SegmentPathArgs, route?: DiagramSegmentRoute): RoutePoint[] {
  const source={x:args.sourceX,y:args.sourceY},target={x:args.targetX,y:args.targetY}
  if (!route || route.points.length<3) {
    const [path]=getSmoothStepPath({...args,borderRadius:0,offset:18})
    const numbers=[...path.matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)].map(m=>Number(m[0]))
    return compactRoute(Array.from({length:numbers.length/2},(_,i)=>({x:numbers[i*2],y:numbers[i*2+1]})))
  }
  const bends=route.points.slice(1,-1),first=bends[0],last=bends[bends.length-1]
  const a=stub(source,args.sourcePosition),b=stub(target,args.targetPosition)
  const sourceElbow=directions[args.sourcePosition].x ? {x:a.x,y:first.y}:{x:first.x,y:a.y}
  const targetElbow=directions[args.targetPosition].x ? {x:b.x,y:last.y}:{x:last.x,y:b.y}
  return compactRoute([source,a,sourceElbow,...bends,targetElbow,b,target])
}

/** Move a whole segment perpendicular to itself; terminal doglegs leave node anchors pinned. */
export function moveRouteSegment(points: RoutePoint[], index: number, coordinate: number, sourcePosition: Position, targetPosition: Position): RoutePoint[] {
  if (!Number.isFinite(coordinate)||index<0||index>=points.length-1) return points
  const a=points[index],b=points[index+1],axis=Math.abs(a.y-b.y)<EPS?'y':'x'
  const shift=(p:RoutePoint)=>({...p,[axis]:coordinate})
  const start=index===0 ? [a,stub(a,sourcePosition),shift(stub(a,sourcePosition))] : [...points.slice(0,index),shift(a)]
  const end=index===points.length-2 ? [shift(stub(b,targetPosition)),stub(b,targetPosition),b] : [shift(b),...points.slice(index+2)]
  return compactRoute([...start,...end])
}

export function roundedRoutePath(points: RoutePoint[], radius=DIAGRAM_CORNER_RADIUS): [string,number,number] {
  if (!points.length) return ['',0,0]
  let path=`M ${points[0].x} ${points[0].y}`,distance=0
  const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y))
  const total=lengths.reduce((sum,n)=>sum+n,0)
  let middle=points[0]
  for(let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i],c=points[i+1],length=lengths[i-1]
    if(distance<=total/2 && distance+length>=total/2 && length>0){const t=(total/2-distance)/length;middle={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}}
    distance+=length
    if(!c){path+=` L ${b.x} ${b.y}`;continue}
    const next=lengths[i],r=Math.max(0,Math.min(radius,length/2,next/2))
    const corner=Math.abs((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x))>EPS
    if(!r||!corner){path+=` L ${b.x} ${b.y}`;continue}
    const entry={x:b.x-(b.x-a.x)/length*r,y:b.y-(b.y-a.y)/length*r}
    const exit={x:b.x+(c.x-b.x)/next*r,y:b.y+(c.y-b.y)/next*r}
    path+=` L ${entry.x} ${entry.y} Q ${b.x} ${b.y} ${exit.x} ${exit.y}`
  }
  return [path,middle.x,middle.y]
}
