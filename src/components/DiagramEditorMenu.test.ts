import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DiagramEditorMenu, DiagramEditorSubmenu } from './DiagramEditorMenu'

let host: HTMLDivElement, root: Root, scale = 1
const action = vi.fn()
const boundaryRef = { current: null as HTMLDivElement | null }
const originalWidth = window.innerWidth, originalHeight = window.innerHeight
const rect = (left: number, top: number, width: number, height: number): DOMRect => ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON: () => ({}) })
function Fixture({ x = 850, y = 650, submenu = true }: { x?: number; y?: number; submenu?: boolean }) {
  return createElement('div', { ref: boundaryRef, 'data-boundary': '' },
    createElement(DiagramEditorMenu, { boundaryRef, point: { x, y }, className: 'test-main', children:
      createElement('div', { 'data-row': '' }, 'Order', submenu ? createElement(DiagramEditorSubmenu, { className: 'test-submenu', children:
        createElement('button', { onClick: action }, 'Bring to front') }) : null) }))
}
const main = () => document.querySelector<HTMLElement>('.test-main')!
const sub = () => document.querySelector<HTMLElement>('.test-submenu')!
beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  scale = 1; action.mockClear()
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute('data-boundary')) return rect(100, 100, 800, 600)
    if (this.hasAttribute('data-row')) {
      const parent = main().getBoundingClientRect()
      return rect(parent.left, parent.bottom - 40 * scale, parent.width, 40 * scale)
    }
    return rect(parseFloat(this.style.left || '0') * scale, parseFloat(this.style.top || '0') * scale,
      (this.classList.contains('test-main') ? 240 : 200) * scale, (this.classList.contains('test-main') ? 380 : 160) * scale)
  })
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks()
  document.documentElement.classList.remove('ui-scale-lock')
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight })
})

describe('measured editor context-menu placement', () => {
  it('clamps tall main menus and flips the last-row submenu left/up at the lower-right corner', async () => {
    await act(async () => root.render(createElement(Fixture)))
    expect(main().style.left).toBe('652px'); expect(main().style.top).toBe('312px')
    expect(sub().style.left).toBe('452px'); expect(sub().style.top).toBe('532px')
    expect(main().parentElement).toBe(document.body)
    expect(sub().parentElement).toBe(document.body)
    expect(sub().hasAttribute('data-diagram-context-menu')).toBe(true)
    await act(async () => sub().querySelector('button')!.click())
    expect(action).toHaveBeenCalledTimes(1)
  })
  it('opens submenus right when room exists and clamps the top-left edge', async () => {
    await act(async () => root.render(createElement(Fixture, { x: -50, y: -50 })))
    expect(main().style.left).toBe('108px'); expect(main().style.top).toBe('108px')
    expect(sub().style.left).toBe('348px'); expect(sub().style.top).toBe('448px')
  })
  it('measures a newly opened submenu after root placement and repositions when the viewport shrinks', async () => {
    await act(async () => root.render(createElement(Fixture, { submenu: false })))
    expect(sub()).toBeNull()
    await act(async () => root.render(createElement(Fixture)))
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 650 })
    await act(async () => window.dispatchEvent(new Event('resize')))
    expect(main().style.top).toBe('262px')
    expect(sub().style.top).toBe('482px')
    expect(main().style.maxHeight).toBe('534px')
  })
  it('uses visual measurements and layout positions under page CSS zoom', async () => {
    scale = 0.5
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 960 })
    document.documentElement.classList.add('ui-scale-lock')
    await act(async () => root.render(createElement(Fixture)))
    expect(main().style.left).toBe('1544px'); expect(main().style.top).toBe('1004px')
    expect(sub().style.left).toBe('1344px'); expect(sub().style.top).toBe('1224px')
    expect(main().getBoundingClientRect().right).toBe(892)
    expect(sub().getBoundingClientRect().bottom).toBe(692)
  })
})
