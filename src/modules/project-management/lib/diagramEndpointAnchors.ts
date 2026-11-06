import type { Node } from 'reactflow'
import { connectionAnchor } from './diagramConnections'
import { classifyBpmnType } from './bpmnNotationSpec'
export type MagneticDiagramAnchor = { nodeId: string; side: 'top'|'right'|'bottom'|'left'; percent: number; point: { x: number; y: number } }
/** The renderer uses the outside of an 8px handle; previews/snap lookup use its center. */
export function centeredDiagramEndpoint(x: number, y: number, side: string, handleId?: string | null) {
  const half = /^(?:source|target)-(?:top|right|bottom|left)(?:-\d+)?$/.test(handleId ?? '') ? 4 : 0
  return { x: x + (side === 'left' ? half : side === 'right' ? -half : 0), y: y + (side === 'top' ? half : side === 'bottom' ? -half : 0) }
}
export function magneticDiagramAnchor(point: { x:number; y:number }, nodes: Node[], fixedNodeId: string, zoom: number): MagneticDiagramAnchor | null {
  const byId = new Map(nodes.map(node=>[node.id,node]))
  const origin = (node: Node, visited = new Set<string>()): { x:number;y:number } => {
    if (node.positionAbsolute) return node.positionAbsolute
    const parent = node.parentNode && byId.get(node.parentNode)
    if (!parent || visited.has(node.id)) return node.position
    visited.add(node.id); const p = origin(parent,visited)
    return { x:p.x+node.position.x,y:p.y+node.position.y }
  }
  let closest: (MagneticDiagramAnchor & { distance:number; area:number }) | null = null
  for (const node of nodes) {
    if (node.id === fixedNodeId || node.hidden || node.connectable === false || !['bpmnElement','c4Element','umlClass','erdEntity','archimateElement','archimateBoundary','archimateNote'].includes(node.type ?? '')) continue
    const width = Number(node.width ?? node.style?.width), height = Number(node.height ?? node.style?.height)
    if (!(width>0 && height>0)) continue
    const p = origin(node), x = (point.x-p.x)/width*100, y = (point.y-p.y)/height*100
    const family = node.type==='bpmnElement' ? classifyBpmnType(node.data?.notationId ?? 'task').family : ''
    const shape = family==='event' ? 'ellipse' : family==='gateway' ? 'diamond' : 'rectangle'
    const nx=(x-50)/50, ny=(y-50)/50
    const inside=shape==='ellipse' ? nx*nx+ny*ny<=1 : shape==='diamond' ? Math.abs(nx)+Math.abs(ny)<=1 : x>=0 && x<=100 && y>=0 && y<=100
    for (const side of ['top','right','bottom','left'] as const) {
      const percent=Math.round(Math.max(0,Math.min(100,side==='top'||side==='bottom'?x:y)))
      const anchor=connectionAnchor(side,percent,shape)
      const candidate={x:p.x+anchor.x/100*width,y:p.y+anchor.y/100*height}
      const distance=Math.hypot(point.x-candidate.x,point.y-candidate.y)
      if (!inside && distance*zoom>32) continue
      const area=width*height
      if (!closest || distance<closest.distance-0.001 || Math.abs(distance-closest.distance)<0.001 && area<closest.area) closest={nodeId:node.id,side,percent,point:candidate,distance,area}
    }
  }
  return closest
}
export function magneticAnchorHandle(anchor: MagneticDiagramAnchor, type: 'source'|'target') {
  return `${type}-${anchor.side}${anchor.percent===50?'':`-${anchor.percent}`}`
}
