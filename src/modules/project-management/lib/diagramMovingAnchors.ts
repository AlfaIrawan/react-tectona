import type { Edge, Node } from 'reactflow'
import { pickCenteredAnchoredHandles, type NodeGeometry } from './parsePlantUmlToIntegrationGraph'

/** Direction changes follow actual node movement; selection/reload must never repick anchors. */
export function facingMovedDiagramEdge(edge:Edge,source:NodeGeometry,target:NodeGeometry):Edge {
  const facing=pickCenteredAnchoredHandles(source,target)
  const handle=(old:string|null|undefined,next:string)=>{
    const match=/^(source|target)-(top|right|bottom|left)(?:-(\d+(?:\.\d+)?))?$/.exec(old??'')
    if(!match)return next
    const side=next.split('-')[1]
    if(match[2]===side)return old
    return `${match[1]}-${side}${match[3]?'-'+match[3]:''}`
  }
  const sourceHandle=handle(edge.sourceHandle,facing.sourceHandle),targetHandle=handle(edge.targetHandle,facing.targetHandle)
  return sourceHandle===edge.sourceHandle&&targetHandle===edge.targetHandle?edge:{...edge,sourceHandle,targetHandle}
}
export function retargetMovedDiagramEdges(nodes:Node[],edges:Edge[],movedIds:Set<string>):Edge[] {
  const byId=new Map(nodes.map(node=>[node.id,node]))
  const geometry=(id:string,seen=new Set<string>()):NodeGeometry|null=>{
    const node=byId.get(id);if(!node||seen.has(id))return null
    seen.add(id);const parent=node.parentNode?geometry(node.parentNode,seen):null
    return{x:node.position.x+(parent?.x??0),y:node.position.y+(parent?.y??0),width:Number(node.width??node.style?.width)||200,height:Number(node.height??node.style?.height)||80}
  }
  const moved=(id:string)=>{const seen=new Set<string>();let node=byId.get(id);while(node&&!seen.has(node.id)){if(movedIds.has(node.id))return true;seen.add(node.id);node=node.parentNode?byId.get(node.parentNode):undefined}return false}
  return edges.map(edge=>{if(!moved(edge.source)&&!moved(edge.target))return edge;const from=geometry(edge.source),to=geometry(edge.target);return from&&to?facingMovedDiagramEdge(edge,from,to):edge})
}
