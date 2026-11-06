import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toCanvas, toSvg } from 'html-to-image'
import { renderDiagramViewportImage, renderDiagramViewportSvg } from './canvasDocumentSnapshot'

vi.mock('html-to-image', () => ({ toPng: vi.fn(), toCanvas: vi.fn().mockResolvedValue('canvas'), toSvg: vi.fn().mockResolvedValue('data:image/svg+xml,rendered') }))
const nodes = ['a', 'b'].map(id => ({ id, position: { x: 0, y: 0 }, data: {} }))
const edges = [{ id: 'flow', source: 'a', target: 'b' }]
const rect = (element: Element, left: number, top: number, width: number, height: number) => {
  element.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height } as DOMRect)
}
let root: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('DOMMatrixReadOnly', class { a = 0.5 })
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } })
  root = document.createElement('div')
  root.innerHTML = `<div class="react-flow__viewport"><div class="react-flow__node" data-id="a"><div data-diagram-node-label></div><div class="react-flow__handle"></div><div class="react-flow__resize-control"></div></div><div class="react-flow__node" data-id="b"></div><svg><g class="react-flow__edge" data-id="flow"><path class="react-flow__edge-path"/><circle class="react-flow__edgeupdater"/></g></svg><div data-diagram-edge-id="flow"></div></div>`
  rect(root.firstElementChild!, 100, 100, 500, 400)
  rect(root.querySelector<HTMLElement>('[data-id="a"]')!, 110, 120, 100, 50)
  rect(root.querySelector<HTMLElement>('[data-diagram-node-label]')!, 100, 100, 140, 20)
  rect(root.querySelector<HTMLElement>('[data-id="b"]')!, 300, 120, 50, 50)
  rect(root.querySelector<HTMLElement>('.react-flow__edge-path')!, 210, 140, 90, 1)
  rect(root.querySelector<HTMLElement>('[data-diagram-edge-id]')!, 220, 105, 50, 20)
})
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })
describe('rendered diagram export', () => {
  it('exports the actual viewport and includes labels outside shape bounds across zoom', async () => {
    await renderDiagramViewportImage(root, nodes, edges)
    expect(toCanvas).toHaveBeenCalledWith(root.firstElementChild, expect.objectContaining({ width: 596, height: 236, style: expect.objectContaining({ transform: 'translate(48px, 48px) scale(1)' }) }))
    const options = vi.mocked(toCanvas).mock.calls[0][1]!
    expect(options.filter!(root.querySelector<HTMLElement>('.react-flow__handle')!)).toBe(false)
    expect(options.filter!(root.querySelector<HTMLElement>('.react-flow__resize-control')!)).toBe(false)
    expect(options.filter!(root.querySelector<HTMLElement>('.react-flow__edgeupdater')!)).toBe(false)
  })
  it('exports only selected nodes and their internal edges and labels', async () => {
    await renderDiagramViewportImage(root, nodes, edges, ['a'])
    const options = vi.mocked(toCanvas).mock.calls[0][1]!
    expect(options.width).toBe(376)
    expect(options.filter!(root.querySelector<HTMLElement>('[data-id="a"]')!)).toBe(true)
    expect(options.filter!(root.querySelector<HTMLElement>('[data-id="b"]')!)).toBe(false)
    expect(options.filter!(root.querySelector<HTMLElement>('.react-flow__edge')!)).toBe(false)
    expect(options.filter!(root.querySelector<HTMLElement>('[data-diagram-edge-id]')!)).toBe(false)
  })
  it('uses SVG serialization rather than wrapping a raster image and handles an empty document', async () => {
    expect(await renderDiagramViewportSvg(root, nodes, edges)).toBe('data:image/svg+xml,rendered')
    expect(toSvg).toHaveBeenCalled()
    expect(await renderDiagramViewportImage(root, [], [])).toBeNull()
  })
})
