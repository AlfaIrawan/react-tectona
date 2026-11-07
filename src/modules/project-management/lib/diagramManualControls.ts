import type { RoutePoint } from './diagramSegmentRouting'
export type RouteControl = RoutePoint & { id: string; axis: 'x' | 'y' }
export function nearestRouteSegment(points: RoutePoint[], point: RoutePoint, axis?: 'x'|'y') {
  let best: {index:number;point:RoutePoint;axis:'x'|'y';distance:number}|undefined
  for(let index=0;index<points.length-1;index++) {
    const a=points[index],b=points[index+1],horizontal=Math.abs(a.y-b.y)<0.001,currentAxis=horizontal?'y':'x'
    if(axis&&axis!==currentAxis)continue
    const p=horizontal?{x:Math.max(Math.min(a.x,b.x),Math.min(Math.max(a.x,b.x),point.x)),y:a.y}:{x:a.x,y:Math.max(Math.min(a.y,b.y),Math.min(Math.max(a.y,b.y),point.y))}
    const distance=Math.hypot(point.x-p.x,point.y-p.y)
    if(!best||distance<best.distance)best={index,point:p,axis:currentAxis,distance}
  }
  return best
}
export function projectRouteControls(controls: RouteControl[], points: RoutePoint[]): RouteControl[] {
  return controls.flatMap(control=>{const segment=nearestRouteSegment(points,control,control.axis);return segment?[{...control,...segment.point}]:[]})
}
export function movedRouteControls(controls:RouteControl[],before:RoutePoint[],after:RoutePoint[],index:number,coordinate:number):RouteControl[] {
  return controls.flatMap(control=>{
    const segment=nearestRouteSegment(before,control,control.axis)
    if(!segment)return[]
    const desired=segment.index===index?{...control,[control.axis]:coordinate}:control
    return projectRouteControls([desired],after)
  })
}

/** React Flow expects unscaled host coordinates; html zoom/ancestor transforms scale client pixels. */
export function diagramClientToFlow(client:RoutePoint,toFlow:(point:RoutePoint)=>RoutePoint,host?:HTMLElement|null):RoutePoint {
  if(!host)return toFlow(client)
  const rect=host.getBoundingClientRect(),scale=host.clientWidth>0?rect.width/host.clientWidth:1
  if(!Number.isFinite(scale)||scale<=0||Math.abs(scale-1)<0.001)return toFlow(client)
  return toFlow({x:rect.left+(client.x-rect.left)/scale,y:rect.top+(client.y-rect.top)/scale})
}

/** Explicit points, unlike old serialized vertices, bound a draggable span. */
export function splitRouteAtControls(points:RoutePoint[],controls:RouteControl[]):RoutePoint[]{
 const result:RoutePoint[]=[]
 for(let i=0;i<points.length-1;i++){
  const a=points[i],b=points[i+1],length=Math.hypot(b.x-a.x,b.y-a.y)
  result.push(a)
  if(length<0.001)continue
  const inside=controls.filter(p=>Math.abs(Math.hypot(p.x-a.x,p.y-a.y)+Math.hypot(p.x-b.x,p.y-b.y)-length)<0.001&&Math.hypot(p.x-a.x,p.y-a.y)>0.001&&Math.hypot(p.x-b.x,p.y-b.y)>0.001)
  inside.sort((p,q)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(q.x-a.x,q.y-a.y))
  for(const point of inside)if(!result.some(p=>Math.hypot(p.x-point.x,p.y-point.y)<0.001))result.push({x:point.x,y:point.y})
 }
 if(points.length)result.push(points[points.length-1])
 return result
}
