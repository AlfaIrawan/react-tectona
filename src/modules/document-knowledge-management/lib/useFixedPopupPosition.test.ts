import { act, createElement, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { useFixedPopupPosition } from './useFixedPopupPosition'

it('measures before paint, preserves the next two measurements, and resets on a new open cycle', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('innerWidth', 400)
  vi.stubGlobal('innerHeight', 300)
  const frames = new Map<number, FrameRequestCallback>()
  let frameId = 0
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    frames.set(++frameId, fn)
    return frameId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))

  const trigger = document.createElement('button')
  const triggerRef = { current: trigger as HTMLElement | null }
  const panelRef = { current: null as HTMLElement | null }
  let rect = new DOMRect(110, 25, 30, 20)
  const measure = vi.spyOn(trigger, 'getBoundingClientRect').mockImplementation(() => rect)
  const root = createRoot(document.createElement('div'))
  let position: { top: number; left: number } | undefined
  function Harness({ open }: { open: boolean }) {
    const next = useFixedPopupPosition(open, triggerRef, panelRef)
    useLayoutEffect(() => { position = next }, [next])
    return null
  }
  const render = (open: boolean) => act(async () => root.render(createElement(Harness, { open })))
  const frame = () => act(async () => {
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach((callback) => callback(0))
  })

  try {
    await render(false)
    expect(position).toEqual({ top: 0, left: 0 })
    expect(measure).not.toHaveBeenCalled()
    await render(true)
    expect(position).toEqual({ top: 51, left: 8 })
    rect = new DOMRect(370, 235, 28, 20)
    await frame()
    expect(position).toEqual({ top: 61, left: 216 })
    await frame()
    expect(measure).toHaveBeenCalledTimes(3)
    expect(frames.size).toBe(0)

    rect = new DOMRect(250, 25, 30, 20)
    await act(async () => window.dispatchEvent(new Event('resize')))
    expect(position).toEqual({ top: 51, left: 104 })
    await render(false)
    await act(async () => window.dispatchEvent(new Event('resize')))
    expect(measure).toHaveBeenCalledTimes(4)
    expect(position).toEqual({ top: 0, left: 0 })

    await render(true)
    await frame()
    expect(frames.size).toBe(1)
    await render(false)
    expect(frames.size).toBe(0)
    triggerRef.current = null
    await render(true)
    expect(position).toEqual({ top: 0, left: 0 })
  } finally {
    await act(async () => root.unmount())
    measure.mockRestore()
    vi.unstubAllGlobals()
  }
})
