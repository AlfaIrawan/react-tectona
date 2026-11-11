import { act, createElement, useEffect, type RefObject } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getEditorSubmenuPlacement, useEditorContextMenuPosition } from './useEditorContextMenuPosition'

let root: Root
let menuRef: RefObject<HTMLDivElement | null>
let position: ReturnType<typeof useEditorContextMenuPosition>
let frames: Map<number, FrameRequestCallback>
let menuWidth: number
let menuHeight: number

function Menu({ open, x, y }: { open: boolean; x: number; y: number }) {
  const next = useEditorContextMenuPosition(menuRef, open, x, y)
  useEffect(() => { position = next }, [next])
  return null
}

const render = (x: number, y: number, open = true) =>
  act(async () => root.render(createElement(Menu, { open, x, y })))

const paint = () => act(async () => {
  for (const [id, callback] of frames) {
    frames.delete(id)
    callback(0)
  }
})

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('innerWidth', 960)
  vi.stubGlobal('innerHeight', 600)
  frames = new Map()
  let id = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (frame: number) => frames.delete(frame))
  menuWidth = 200
  menuHeight = 100
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, menuWidth, menuHeight))
  menuRef = { current: document.createElement('div') }
  root = createRoot(document.createElement('div'))
})

afterEach(async () => {
  await act(async () => root.unmount())
  document.documentElement.classList.remove('ui-scale-lock')
  document.documentElement.style.removeProperty('--app-vh')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('flips at the edge, then anchors to a new click while still open', async () => {
  await render(930, 580)
  await paint()
  expect(position).toEqual({ x: 752, y: 480 })

  await render(220, 180)
  expect(position).toEqual({ x: 220, y: 180 })
  await paint()
  expect(position).toEqual({ x: 220, y: 180 })
})

it('cancels a pending measurement and measures again when reopened at the same point', async () => {
  await render(930, 580)
  await paint()
  await render(950, 580)
  expect(frames.size).toBe(1)
  await render(950, 580, false)
  expect(frames.size).toBe(0)
  menuWidth = 120
  await render(930, 580)
  expect(position).toEqual({ x: 930, y: 580 })
  await paint()
  expect(position).toEqual({ x: 832, y: 480 })
})

it('uses layout coordinates under desktop zoom and keeps an oversized menu origin visible', async () => {
  document.documentElement.classList.add('ui-scale-lock')
  document.documentElement.style.setProperty('--app-vh', '1200px')
  await render(930, 580)
  await paint()
  expect(position).toEqual({ x: 1512, y: 960 })

  menuWidth = 1000
  menuHeight = 650
  await render(940, 590)
  await paint()
  expect(position).toEqual({ x: 8, y: 8 })
})

it('checks both submenu widths against the layout viewport, not the scaled window', () => {
  expect(getEditorSubmenuPlacement(500, 220, 230)).toEqual({ left: '100%', marginLeft: -4 })
  expect(getEditorSubmenuPlacement(510, 220, 230)).toEqual({ right: '100%', marginRight: -4 })
  document.documentElement.classList.add('ui-scale-lock')
  expect(getEditorSubmenuPlacement(1480, 220, 200)).toEqual({ left: '100%', marginLeft: -4 })
  expect(getEditorSubmenuPlacement(1480, 220, 230)).toEqual({ right: '100%', marginRight: -4 })
})

it('overlaps the parent only when the submenu fits neither side', () => {
  vi.stubGlobal('innerWidth', 390)
  expect(getEditorSubmenuPlacement(115, 220, 230)).toEqual({ left: 0, maxWidth: 230 })
  expect(getEditorSubmenuPlacement(162, 220, 230)).toEqual({ left: -17, maxWidth: 230 })
  expect(getEditorSubmenuPlacement(162, 220, 200)).toEqual({ left: 0, maxWidth: 200 })
})
