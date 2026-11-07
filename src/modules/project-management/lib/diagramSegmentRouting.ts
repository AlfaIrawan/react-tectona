import { getSmoothStepPath, type Position } from 'reactflow'

export type RoutePoint = { x: number; y: number }
export type DiagramSegmentRoute = { routingVersion?:2; points: RoutePoint[]; controls?: import('./diagramManualControls').RouteControl[] }
export type SegmentPathArgs = { sourceX: number; sourceY: number; targetX: number; targetY: number; sourcePosition: Position; targetPosition: Position }
const EPS = 0.001
export const DIAGRAM_CORNER_RADIUS = 12
const directions = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 } }
const same = (a: RoutePoint, b: RoutePoint) => Math.abs(a.x-b.x)<EPS && Math.abs(a.y-b.y)<EPS
const onSegment=(p:RoutePoint,a:RoutePoint,b:RoutePoint)=>
  ((Math.abs(a.x-b.x)<EPS&&Math.abs(p.x-a.x)<EPS)||(Math.abs(a.y-b.y)<EPS&&Math.abs(p.y-a.y)<EPS))&&
  p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS
export function compactRoute(points: RoutePoint[],pinned:RoutePoint[]=[],pruneLegacyKinks=true): RoutePoint[] {
  const result: RoutePoint[] = []
  for (const point of points) {
    if (result.length && same(result[result.length-1],point)) continue
    while (result.length>1) {
      const a=result[result.length-2],b=result[result.length-1]
      const inline=(Math.abs(a.x-b.x)<EPS && Math.abs(b.x-point.x)<EPS)||(Math.abs(a.y-b.y)<EPS && Math.abs(b.y-point.y)<EPS)
      if (!inline || pinned.some(p=>(onSegment(p,a,b)||onSegment(p,b,point))&&!onSegment(p,a,point))) break
      result.pop()
    }
    if (!result.length || !same(result[result.length-1],point)) result.push({x:point.x,y:point.y})
  }
  // A closed relation may be an intentional self-loop on the same node anchor.
  if(result.length>2&&same(result[0],result[result.length-1]))return result
  // An unconstrained overshoot-and-return is a hidden elbow pattern too,
  // even when it does not cross itself (the small kink in Alfa's first image).
  for(let i=0;pruneLegacyKinks&&i<result.length-4;i++){
    const [a,b,c,d,e]=result.slice(i,i+5),horizontal=Math.abs(a.y-b.y)<EPS
    const first=horizontal?b.x-a.x:b.y-a.y,third=horizontal?d.x-c.x:d.y-c.y
    const second=horizontal?c.y-b.y:c.x-b.x,fourth=horizontal?e.y-d.y:e.x-d.x
    const corner=horizontal?{x:d.x,y:a.y}:{x:a.x,y:d.y}
    if(first*third<0&&second*fourth>0&&onSegment(corner,a,b)&&!same(corner,a)&&!same(corner,b)){
      const removed=[a,b,c,d,e]
      if(pinned.some(p=>removed.slice(1).some((q,k)=>onSegment(p,removed[k],q))))continue
      return compactRoute([...result.slice(0,i+1),corner,...result.slice(i+4)],pinned,pruneLegacyKinks)
    }
  }
  // Remove closed excursions at an actual crossing. These are routing artifacts,
  // not additional user waypoints. Collinear runs above also include reversals.
  for (let i=0;i<result.length-3;i++) for (let j=i+2;j<result.length-1;j++) {
    const a=result[i],b=result[i+1],c=result[j],d=result[j+1]
    const horizontal=Math.abs(a.y-b.y)<EPS,otherHorizontal=Math.abs(c.y-d.y)<EPS
    if(horizontal===otherHorizontal)continue
    const cross=horizontal?{x:c.x,y:a.y}:{x:a.x,y:c.y}
    const between=(n:number,l:number,r:number)=>n>=Math.min(l,r)-EPS&&n<=Math.max(l,r)+EPS
    if(between(cross.x,a.x,b.x)&&between(cross.y,a.y,b.y)&&between(cross.x,c.x,d.x)&&between(cross.y,c.y,d.y))
      {
        const removed=result.slice(i,j+2)
        if(pinned.some(p=>!onSegment(p,a,cross)&&!onSegment(p,cross,d)&&removed.slice(1).some((q,k)=>onSegment(p,removed[k],q))))continue
        return compactRoute([...result.slice(0,i+1),cross,...result.slice(j+1)],pinned,pruneLegacyKinks)
      }
  }
  return result
}
export function readSegmentRoute(value: unknown): DiagramSegmentRoute | undefined {
  const points=(value as DiagramSegmentRoute | undefined)?.points
  if (!Array.isArray(points)||points.length<2||points.length>1000||!points.every(p=>p && Number.isFinite(p.x)&&Number.isFinite(p.y))) return
  if (points.some((p,i)=>i>0 && Math.abs(p.x-points[i-1].x)>EPS && Math.abs(p.y-points[i-1].y)>EPS)) return
  const rawControls=(value as DiagramSegmentRoute).controls
  const controls=Array.isArray(rawControls)?rawControls.filter(c=>c && typeof c.id==='string' && (c.axis==='x'||c.axis==='y') && Number.isFinite(c.x) && Number.isFinite(c.y)):undefined
  const routingVersion=(value as DiagramSegmentRoute).routingVersion===2?2:undefined
  return { routingVersion, points: compactRoute(points,controls,routingVersion!==2), ...(controls?.length?{controls}:{}) }
}
const stub = (p: RoutePoint, side: Position) => ({x:p.x+directions[side].x*18,y:p.y+directions[side].y*18})
const facingTerminal=(points:RoutePoint[],side:Position,pinned:RoutePoint[]=[]):RoutePoint[]=>{
  if(points.length<2)return points
  const [anchor,next,following=next]=points,dir=directions[side]
  if((next.x-anchor.x)*dir.x+(next.y-anchor.y)*dir.y>EPS)return points
  const outward=stub(anchor,side)
  // A dragged track may pass behind its node. Go around it rather than
  // reversing on the same line or changing the arrowhead's facing direction.
  const offset=dir.x?{x:0,y:following.y>next.y?-18:18}:{x:following.x>next.x?-18:18,y:0}
  const a={x:outward.x+offset.x,y:outward.y+offset.y}
  const b=dir.x?{x:next.x,y:a.y}:{x:a.x,y:next.y}
  return compactRoute([anchor,outward,a,b,...points.slice(1)],pinned,false)
}
const pinnedTerminals=(points:RoutePoint[],sourcePosition:Position,targetPosition:Position,pinned:RoutePoint[]=[])=>
  facingTerminal(facingTerminal(points,sourcePosition,pinned).slice().reverse(),targetPosition,pinned).reverse()


/** Rebuild terminal legs from the current node anchors, including after node moves or resize. */
export function segmentRoutePoints(args: SegmentPathArgs, route?: DiagramSegmentRoute): RoutePoint[] {
  const source={x:args.sourceX,y:args.sourceY},target={x:args.targetX,y:args.targetY}
  if (!route || route.points.length<3) {
    const [path]=getSmoothStepPath({...args,borderRadius:0,offset:18})
    const numbers=[...path.matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)].map(m=>Number(m[0]))
    return compactRoute(Array.from({length:numbers.length/2},(_,i)=>({x:numbers[i*2],y:numbers[i*2+1]})))
  }
  const saved=compactRoute(route.points,route.controls,route.routingVersion!==2)
  // Saved geometry already includes its terminal legs. Rendering it again must
  // not insert another pair of 18px stubs inside those legs.
  if(same(saved[0],source)&&same(saved[saved.length-1],target))return pinnedTerminals(saved,args.sourcePosition,args.targetPosition,route.controls)
  const bends=saved.slice(1,-1),first=bends[0],last=bends[bends.length-1]
  if(!first||!last)return segmentRoutePoints(args)
  const a=stub(source,args.sourcePosition),b=stub(target,args.targetPosition)
  const sourceElbow=directions[args.sourcePosition].x ? {x:a.x,y:first.y}:{x:first.x,y:a.y}
  const targetElbow=directions[args.targetPosition].x ? {x:b.x,y:last.y}:{x:last.x,y:b.y}
  return pinnedTerminals(compactRoute([source,a,sourceElbow,...bends,targetElbow,b,target],route.controls,false),args.sourcePosition,args.targetPosition,route.controls)
}

/** Move a whole segment perpendicular to itself; terminal doglegs leave node anchors pinned. */
export function moveRouteSegment(points: RoutePoint[], index: number, coordinate: number, sourcePosition: Position, targetPosition: Position,controls:RoutePoint[]=[]): RoutePoint[] {
  if (!Number.isFinite(coordinate)||index<0||index>=points.length-1) return points
  let endIndex=index+1
  const horizontal=Math.abs(points[index].y-points[endIndex].y)<EPS
  const sameRun=(a:RoutePoint,b:RoutePoint)=>horizontal?Math.abs(a.y-b.y)<EPS:Math.abs(a.x-b.x)<EPS
  while(index>0&&!controls.some(p=>same(p,points[index]))&&sameRun(points[index-1],points[index]))index--
  while(endIndex<points.length-1&&!controls.some(p=>same(p,points[endIndex]))&&sameRun(points[endIndex],points[endIndex+1]))endIndex++
  const a=points[index],b=points[endIndex],axis=horizontal?'y':'x'
  const shift=(p:RoutePoint)=>({...p,[axis]:coordinate})
  const start=index===0 ? [a,stub(a,sourcePosition),shift(stub(a,sourcePosition))] : controls.some(p=>same(p,a)) ? [...points.slice(0,index+1),shift(a)] : [...points.slice(0,index),shift(a)]
  const end=endIndex===points.length-1 ? [shift(stub(b,targetPosition)),stub(b,targetPosition),b] : controls.some(p=>same(p,b)) ? [shift(b),...points.slice(endIndex)] : [shift(b),...points.slice(endIndex+1)]
  return pinnedTerminals(compactRoute([...start,...end],controls,false),sourcePosition,targetPosition,controls)
}

/** Removing a helper releases its old bend pattern, not just its painted dot. */
export function routeThroughControls(args:SegmentPathArgs,controls:import('./diagramManualControls').RouteControl[]):RoutePoint[] {
  if(!controls.length)return segmentRoutePoints(args)
  const anchors=[{x:args.sourceX,y:args.sourceY},...controls,{x:args.targetX,y:args.targetY}]
  const side=(from:RoutePoint,to:RoutePoint,axis:'x'|'y'):Position=>
    (axis==='y'?(to.x>=from.x?'right':'left'):(to.y>=from.y?'bottom':'top')) as Position
  const result:RoutePoint[]=[]
  for(let i=0;i<anchors.length-1;i++){
    const a=anchors[i],b=anchors[i+1]
    result.push(...segmentRoutePoints({sourceX:a.x,sourceY:a.y,targetX:b.x,targetY:b.y,
      sourcePosition:i===0?args.sourcePosition:side(a,b,controls[i-1].axis),
      targetPosition:i===controls.length?args.targetPosition:side(b,a,controls[i].axis)}))
  }
  return compactRoute(result,controls,false)
}

export function roundedRoutePath(points: RoutePoint[], radius=DIAGRAM_CORNER_RADIUS): [string,number,number] {
  points=points.filter((p,i)=>{const a=points[i-1],b=points[i+1];return !a||!b||Math.abs((p.x-a.x)*(b.y-p.y)-(p.y-a.y)*(b.x-p.x))>EPS||(p.x-a.x)*(b.x-p.x)+(p.y-a.y)*(b.y-p.y)<0})
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
