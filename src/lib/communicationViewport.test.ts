import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mobileCommunicationPanelStyle, useCommunicationViewport } from '../hooks/useCommunicationViewport'

afterEach(() => vi.unstubAllGlobals())

describe('mobile communication viewport', () => {
  it('overrides the desktop 30% width limit and uses visible height', () => {
    expect(mobileCommunicationPanelStyle({ top: 12, height: 420 })).toMatchObject({
      position: 'fixed', width: '100%', maxWidth: '100%', top: 12, height: 420, maxHeight: 420,
    })
  })

  it('reserves the topbar on keyboard and viewport scroll, then removes listeners', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const viewport = Object.assign(new EventTarget(), { offsetTop: 0, height: 780 })
    const remove = vi.spyOn(viewport, 'removeEventListener')
    vi.stubGlobal('visualViewport', viewport)
    const host = document.createElement('div')
    const header = document.createElement('header')
    header.className = 'responsive-topbar'
    header.getBoundingClientRect = () => ({ bottom: 108 }) as DOMRect
    document.body.append(header)
    document.body.append(host)
    const root = createRoot(host)
    function Fixture() {
      const rect = useCommunicationViewport(true)
      return createElement('div', { style: mobileCommunicationPanelStyle(rect) })
    }
    await act(async () => root.render(createElement(Fixture)))
    expect((host.firstChild as HTMLElement).style.height).toBe('672px')
    expect((host.firstChild as HTMLElement).style.top).toBe('108px')
    await act(async () => {
      viewport.height = 390
      viewport.offsetTop = 18
      viewport.dispatchEvent(new Event('resize'))
      viewport.dispatchEvent(new Event('scroll'))
    })
    expect((host.firstChild as HTMLElement).style.height).toBe('300px')
    expect((host.firstChild as HTMLElement).style.top).toBe('108px')
    await act(async () => root.unmount())
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function))
    host.remove()
    header.remove()
  })
})
