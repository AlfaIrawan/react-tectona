import { toPng } from 'html-to-image'
import type { Node } from 'reactflow'

export async function canvasDocumentSnapshot(root: HTMLElement | null, nodes: Node[]): Promise<string> {
  const viewport = root?.querySelector<HTMLElement>('.react-flow__viewport')
  if (!viewport || !nodes.length) throw new Error('CANVAS_SNAPSHOT_UNAVAILABLE')
  await document.fonts.ready
  // Measure the rendered DOM: stored widths can be stale after a font or theme change.
  const origin = viewport.getBoundingClientRect()
  const scale = new DOMMatrixReadOnly(getComputedStyle(viewport).transform).a || 1
  const rendered = Array.from(viewport.querySelectorAll<HTMLElement>('.react-flow__node'))
    .map(element => element.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0)
  if (!rendered.length) throw new Error('CANVAS_LAYOUT_NOT_READY')
  const x = (Math.min(...rendered.map(rect => rect.left)) - origin.left) / scale
  const y = (Math.min(...rendered.map(rect => rect.top)) - origin.top) / scale
  const bounds = { x, y,
    width: (Math.max(...rendered.map(rect => rect.right)) - origin.left) / scale - x,
    height: (Math.max(...rendered.map(rect => rect.bottom)) - origin.top) / scale - y }
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
