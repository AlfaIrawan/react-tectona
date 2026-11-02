import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  UI_DESIGN_WIDTH_PX,
  getUiLayoutScale,
  pointerClientToLayout,
  visualPxToLayoutPx,
  visualRectToLayoutRect,
  syncUiScaleLock,
} from './uiScale'

describe('uiScale layout coordinates', () => {
  const originalInnerWidth = window.innerWidth

  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.removeAttribute('style')
    document.documentElement.classList.remove('ui-scale-lock')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth })
  })

  it.each([390, 844])('removes stale desktop scaling on a phone at %s px', (width) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    document.documentElement.classList.add('ui-scale-lock')
    document.documentElement.style.setProperty('zoom', '0.2')
    syncUiScaleLock()
    expect(getUiLayoutScale()).toBe(1)
    expect(document.documentElement.style.getPropertyValue('zoom')).toBe('')
    expect(document.documentElement.classList.contains('ui-scale-lock')).toBe(false)
  })

  it('keeps the desktop scaling behavior for a narrower desktop window', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
    syncUiScaleLock()
    expect(getUiLayoutScale()).toBe(0.75)
    expect(document.documentElement.classList.contains('ui-scale-lock')).toBe(true)
  })

  it('keeps visual pixels unchanged when the canvas is not scaled', () => {
    document.documentElement.classList.remove('ui-scale-lock')
    expect(getUiLayoutScale()).toBe(1)
    expect(visualPxToLayoutPx(400)).toBe(400)
    expect(pointerClientToLayout(100, 50)).toEqual({ x: 100, y: 50 })
  })

  it('converts visual getBoundingClientRect into 1920-canvas layout px', () => {
    document.documentElement.classList.add('ui-scale-lock')
    const innerWidth = UI_DESIGN_WIDTH_PX / 2
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: innerWidth })
    expect(getUiLayoutScale()).toBeCloseTo(0.5)
    expect(visualPxToLayoutPx(400)).toBeCloseTo(800)
    expect(visualRectToLayoutRect({
      top: 100,
      left: 200,
      right: 300,
      bottom: 180,
      width: 100,
      height: 80,
    })).toEqual({
      top: 200,
      left: 400,
      right: 600,
      bottom: 360,
      width: 200,
      height: 160,
    })
  })
})
