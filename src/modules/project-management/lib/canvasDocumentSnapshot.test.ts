import { afterEach, expect, it, vi } from 'vitest'
import { toPng, toCanvas, toSvg } from 'html-to-image'
import { canvasDocumentSnapshot, renderDiagramViewportImage, renderDiagramViewportSvg } from './canvasDocumentSnapshot'

vi.mock('html-to-image', () => ({ toPng: vi.fn().mockResolvedValue('data:image/png;base64,snapshot'), toCanvas: vi.fn().mockResolvedValue({}), toSvg: vi.fn().mockResolvedValue('svg') }))
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })

it('uses actual rendered extents instead of stale model dimensions for grouped diagrams', async () => {
  vi.stubGlobal('DOMMatrixReadOnly', class { a = 0.5 })
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } })
  const root = document.createElement('div')
  root.innerHTML = '<div class="react-flow__viewport"><div class="react-flow__node" data-id="node"></div></div>'
  const viewport = root.firstElementChild as HTMLElement
  viewport.getBoundingClientRect = () => ({ left: 100, top: 100 } as DOMRect)
  ;(viewport.firstElementChild as HTMLElement).getBoundingClientRect = () => ({ left: 110, top: 120, right: 260, bottom: 195, width: 150, height: 75 } as DOMRect)
  expect(await canvasDocumentSnapshot(root, [{ id: 'node', position: { x: 0, y: 0 }, data: {} }])).toBe('snapshot')
  expect(toPng).toHaveBeenCalledWith(viewport, expect.objectContaining({ width: 396, height: 246,
    style: expect.objectContaining({ transform: 'translate(28px, 8px) scale(1)' }) }))
})


it('includes detours and external labels while excluding editor controls', async () => {
  vi.stubGlobal('DOMMatrixReadOnly', class { a = 1 })
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } })
  const root = document.createElement('div')
  root.innerHTML = '<div class="react-flow__viewport"><div class="react-flow__node" data-id="a"><span data-diagram-node-label></span></div><div class="react-flow__edge" data-id="e"><svg><path class="react-flow__edge-path"/></svg></div><div data-diagram-edge-id="e"></div></div>'
  const viewport = root.firstElementChild as HTMLElement
  const rect = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom, width: right - left, height: bottom - top } as DOMRect)
  viewport.getBoundingClientRect = () => rect(0, 0, 10, 10)
  const selectors = ['.react-flow__node', '[data-diagram-node-label]', '.react-flow__edge-path', '[data-diagram-edge-id]']
  const bounds = [rect(0,0,100,50), rect(-40,0,120,20), rect(50,-100,50,200), rect(140,180,200,220)]
  selectors.forEach((selector, i) => { viewport.querySelector(selector)!.getBoundingClientRect = () => bounds[i] })
  await canvasDocumentSnapshot(root, [{ id: 'a', data: {}, position: { x: 0, y: 0 } }], [{ id: 'e', source: 'a', target: 'a' }])
  expect(toPng).toHaveBeenLastCalledWith(viewport, expect.objectContaining({ width: 336, height: 416 }))
  const options = vi.mocked(toPng).mock.calls.at(-1)![1]!
  const control = document.createElement('div'); control.setAttribute('data-diagram-endpoints', '')
  expect(options.filter!(control)).toBe(false)
})

it('shares PNG/SVG/document frames and filters selected-only exports', async () => {
  vi.stubGlobal('DOMMatrixReadOnly', class { a = 1 })
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } })
  const root = document.createElement('div')
  root.innerHTML = '<div class="react-flow__viewport"><div class="react-flow__node" data-id="a"></div><div class="react-flow__node" data-id="b"></div><div class="react-flow__edge" data-id="e"><svg><path class="react-flow__edge-path"/></svg></div><div data-diagram-edge-id="e"></div></div>'
  const viewport = root.firstElementChild as HTMLElement
  const rect = (left: number, right: number) => ({ left, right, top: 0, bottom: 50, width: right-left, height: 50 } as DOMRect)
  viewport.getBoundingClientRect = () => rect(0, 0)
  const selected = viewport.children[0] as HTMLElement, excluded = viewport.children[1] as HTMLElement
  selected.getBoundingClientRect = () => rect(0, 100)
  excluded.getBoundingClientRect = () => rect(300, 400)
  viewport.querySelector('path')!.getBoundingClientRect = () => rect(100, 300)
  viewport.querySelector('[data-diagram-edge-id]')!.getBoundingClientRect = () => rect(200, 250)
  const nodes = ['a','b'].map(id => ({ id, data: {}, position: { x: 0, y: 0 } }))
  const edges = [{ id: 'e', source: 'a', target: 'b' }]
  await canvasDocumentSnapshot(root, nodes, edges)
  await renderDiagramViewportImage(root, nodes, edges)
  await renderDiagramViewportSvg(root, nodes, edges)
  const documentOptions = vi.mocked(toPng).mock.calls.at(-1)![1]!
  for (const fn of [toCanvas, toSvg]) {
    const options = vi.mocked(fn).mock.calls.at(-1)![1]!
    expect(options).toEqual({ ...documentOptions, filter: expect.any(Function) })
    expect(options.filter!(excluded)).toBe(true)
  }
  await renderDiagramViewportImage(root, nodes, edges, ['a'])
  const options = vi.mocked(toCanvas).mock.calls.at(-1)![1]!
  expect(options.width).toBe(196)
  expect(options.filter!(selected)).toBe(true)
  expect(options.filter!(excluded)).toBe(false)
  expect(options.filter!(viewport.querySelector('.react-flow__edge')!)).toBe(false)
  expect(options.filter!(viewport.querySelector('[data-diagram-edge-id]')!)).toBe(false)
})
