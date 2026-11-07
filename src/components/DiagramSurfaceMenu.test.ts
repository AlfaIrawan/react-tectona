import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DiagramSurfaceMenu, DiagramSurfaceMenuButton, useDiagramSurfaceMenu } from './DiagramSurfaceMenu'

let host: HTMLDivElement, root: Root
const openStudio = vi.fn(), copySource = vi.fn()
const originalWidth = window.innerWidth, originalHeight = window.innerHeight
function Fixture() {
  const menu = useDiagramSurfaceMenu()
  return createElement('div', { onContextMenu: menu.open, 'data-preview': '' },
    createElement(DiagramSurfaceMenu, { menu: menu.menu, children: [
      createElement(DiagramSurfaceMenuButton, { key: 'open', label: 'Open', icon: 'fullscreen', onClick: () => { openStudio(); menu.close() } }),
      createElement(DiagramSurfaceMenuButton, { key: 'copy', label: 'Copy source', icon: 'copy', onClick: () => { copySource('diagram source'); menu.close() } }),
    ] }))
}
const currentMenu = () => document.querySelector<HTMLElement>('[data-diagram-surface-menu]')
async function open(x = 100, y = 100) {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y })
  await act(async () => host.querySelector('[data-preview]')!.dispatchEvent(event))
  expect(event.defaultPrevented).toBe(true)
}
beforeEach(async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.clearAllMocks()
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { x: 0, y: 0, left: 0, top: 0, right: 208, bottom: 80, width: 208, height: 80, toJSON: () => ({}) }
  })
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  await act(async () => root.render(createElement(Fixture)))
})
afterEach(async () => {
  await act(async () => root.unmount()); host.remove()
  vi.restoreAllMocks()
  document.documentElement.classList.remove('ui-scale-lock')
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight })
})

describe('ancillary diagram preview context menus', () => {
  it('keeps pointer interaction inside the menu and routes Open and Copy source to separate callbacks', async () => {
    await open()
    const buttons = currentMenu()!.querySelectorAll('button')
    await act(async () => buttons[0].dispatchEvent(new Event('pointerdown', { bubbles: true })))
    expect(currentMenu()).not.toBeNull()
    await act(async () => buttons[0].click())
    expect(openStudio).toHaveBeenCalledTimes(1)
    expect(copySource).not.toHaveBeenCalled()
    expect(currentMenu()).toBeNull()
    await open()
    await act(async () => currentMenu()!.querySelectorAll('button')[1].click())
    expect(copySource).toHaveBeenCalledTimes(1)
    expect(copySource).toHaveBeenCalledWith('diagram source')
    expect(openStudio).toHaveBeenCalledTimes(1)
    expect(currentMenu()).toBeNull()
  })
  it.each(['escape', 'blur', 'outside'])('dismisses on %s and can reopen', async (kind) => {
    await open()
    await act(async () => {
      if (kind === 'escape') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
      else if (kind === 'blur') window.dispatchEvent(new Event('blur'))
      else document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(currentMenu()).toBeNull()
    expect(openStudio).not.toHaveBeenCalled()
    expect(copySource).not.toHaveBeenCalled()
    await open()
    expect(currentMenu()).not.toBeNull()
  })
  it('clamps the measured menu to all viewport edges and repositions on resize', async () => {
    await open(999, 599)
    expect(currentMenu()!.style.left).toBe('784px')
    expect(currentMenu()!.style.top).toBe('512px')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 500 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 300 })
    await act(async () => window.dispatchEvent(new Event('resize')))
    expect(currentMenu()!.style.left).toBe('284px')
    expect(currentMenu()!.style.top).toBe('212px')
    expect(currentMenu()!.style.maxWidth).toBe('484px')
    expect(currentMenu()!.style.maxHeight).toBe('284px')
    await open(-10, -20)
    expect(currentMenu()!.style.left).toBe('8px')
    expect(currentMenu()!.style.top).toBe('8px')
  })
  it('converts visual coordinates to fixed layout coordinates under page zoom', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 960 })
    document.documentElement.classList.add('ui-scale-lock')
    await open(959, 599)
    expect(currentMenu()!.style.left).toBe('1488px')
    expect(currentMenu()!.style.top).toBe('1024px')
    expect(currentMenu()!.style.maxWidth).toBe('1888px')
    expect(currentMenu()!.style.maxHeight).toBe('1168px')
  })
})
