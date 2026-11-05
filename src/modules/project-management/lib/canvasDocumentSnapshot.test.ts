import { afterEach, expect, it, vi } from 'vitest'
import { toPng } from 'html-to-image'
import { canvasDocumentSnapshot } from './canvasDocumentSnapshot'

vi.mock('html-to-image', () => ({ toPng: vi.fn().mockResolvedValue('data:image/png;base64,snapshot') }))
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })

it('uses actual rendered extents instead of stale model dimensions for grouped diagrams', async () => {
  vi.stubGlobal('DOMMatrixReadOnly', class { a = 0.5 })
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } })
  const root = document.createElement('div')
  root.innerHTML = '<div class="react-flow__viewport"><div class="react-flow__node"></div></div>'
  const viewport = root.firstElementChild as HTMLElement
  viewport.getBoundingClientRect = () => ({ left: 100, top: 100 } as DOMRect)
  ;(viewport.firstElementChild as HTMLElement).getBoundingClientRect = () => ({ left: 110, top: 120, right: 260, bottom: 195, width: 150, height: 75 } as DOMRect)
  expect(await canvasDocumentSnapshot(root, [{ id: 'node', position: { x: 0, y: 0 }, data: {} }])).toBe('snapshot')
  expect(toPng).toHaveBeenCalledWith(viewport, expect.objectContaining({ width: 396, height: 246,
    style: expect.objectContaining({ transform: 'translate(28px, 8px) scale(1)' }) }))
})
