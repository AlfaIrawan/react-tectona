import { toPng } from 'html-to-image'
import { getRectOfNodes, type Node } from 'reactflow'
import { absoluteDiagramNodes } from './diagramCanvasExport'

export async function canvasDocumentSnapshot(root: HTMLElement | null, nodes: Node[]): Promise<string> {
  const viewport = root?.querySelector<HTMLElement>('.react-flow__viewport')
  if (!viewport || !nodes.length) throw new Error('CANVAS_SNAPSHOT_UNAVAILABLE')
  await document.fonts.ready
  const bounds = getRectOfNodes(absoluteDiagramNodes(nodes))
  const width = Math.ceil(bounds.width + 96)
  const height = Math.ceil(bounds.height + 96)
  const pixelRatio = Math.min(2, 4096 / Math.max(width, height))
  const image = await toPng(viewport, {
    width, height, pixelRatio, backgroundColor: '#ffffff', skipAutoScale: false,
    style: { width: `${width}px`, height: `${height}px`, transform: `translate(${48 - bounds.x}px, ${48 - bounds.y}px) scale(1)` },
    filter: element => !(element instanceof Element && (
      element.classList.contains('react-flow__handle') || element.classList.contains('react-flow__resize-control')
      || element.classList.contains('react-flow__selection')
    )),
  })
  return image.split(',')[1]
}
