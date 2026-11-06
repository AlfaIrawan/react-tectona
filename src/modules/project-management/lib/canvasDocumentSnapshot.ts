import { toPng, toCanvas, toSvg } from 'html-to-image'
import type { Node, Edge } from 'reactflow'

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

/** Capture the same shapes and routed paths the editor displays, including external labels. */
function viewportExport(root: HTMLElement | null, nodes: Node[], edges: Edge[], nodeIds?: string[]) {
  const viewport = root?.querySelector<HTMLElement>('.react-flow__viewport')
  if (!viewport || !nodes.length) return null
  const selectedNodes = new Set(nodeIds ?? nodes.map(node => node.id))
  const selectedEdges = new Set(edges.filter(edge => selectedNodes.has(edge.source) && selectedNodes.has(edge.target)).map(edge => edge.id))
  const visibleNodes = Array.from(viewport.querySelectorAll<HTMLElement>('.react-flow__node'))
    .filter(element => selectedNodes.has(element.dataset.id ?? ''))
  const elements: Element[] = visibleNodes.flatMap(node => [node, ...node.querySelectorAll('[data-diagram-node-label]')])
  viewport.querySelectorAll<HTMLElement>('.react-flow__edge').forEach(edge => {
    if (selectedEdges.has(edge.dataset.id ?? '')) elements.push(...edge.querySelectorAll('.react-flow__edge-path'))
  })
  viewport.querySelectorAll<HTMLElement>('[data-diagram-edge-id]').forEach(label => {
    if (selectedEdges.has(label.dataset.diagramEdgeId ?? '')) elements.push(label)
  })
  const rects = elements.map(element => element.getBoundingClientRect()).filter(rect => rect.width > 0 || rect.height > 0)
  if (!rects.length) return null
  const origin = viewport.getBoundingClientRect()
  const scale = new DOMMatrixReadOnly(getComputedStyle(viewport).transform).a || 1
  const x = (Math.min(...rects.map(rect => rect.left)) - origin.left) / scale
  const y = (Math.min(...rects.map(rect => rect.top)) - origin.top) / scale
  const width = Math.ceil((Math.max(...rects.map(rect => rect.right)) - origin.left) / scale - x + 96)
  const height = Math.ceil((Math.max(...rects.map(rect => rect.bottom)) - origin.top) / scale - y + 96)
  const options = {
    width, height, pixelRatio: Math.min(2, 4096 / Math.max(width, height)), backgroundColor: '#ffffff', skipAutoScale: false,
    style: { width: `${width}px`, height: `${height}px`, transform: `translate(${48 - x}px, ${48 - y}px) scale(1)` },
    filter: (element: HTMLElement) => {
      if (!(element instanceof Element)) return true
      if (element.matches('.react-flow__handle, .react-flow__resize-control, .react-flow__selection, .react-flow__nodesselection, .react-flow__edgeupdater, .react-flow__edge-interaction, [data-diagram-endpoints]')) return false
      if (element.classList.contains('react-flow__node')) return selectedNodes.has(element.dataset.id ?? '')
      if (element.classList.contains('react-flow__edge')) return selectedEdges.has(element.dataset.id ?? '')
      if (element.hasAttribute('data-diagram-edge-id')) return selectedEdges.has(element.dataset.diagramEdgeId ?? '')
      return true
    },
  }
  return { viewport, options }
}

export async function renderDiagramViewportImage(root: HTMLElement | null, nodes: Node[], edges: Edge[], nodeIds?: string[]): Promise<HTMLCanvasElement | null> {
  await document.fonts.ready
  const frame = viewportExport(root, nodes, edges, nodeIds)
  return frame ? toCanvas(frame.viewport, frame.options) : null
}

export async function renderDiagramViewportSvg(root: HTMLElement | null, nodes: Node[], edges: Edge[], nodeIds?: string[]): Promise<string | null> {
  await document.fonts.ready
  const frame = viewportExport(root, nodes, edges, nodeIds)
  return frame ? toSvg(frame.viewport, frame.options) : null
}
