import { describe, expect, it } from 'vitest'
import { diagramScrollSurface, fittedDiagramSize } from './diagramFullscreenFrame'

describe('diagram fullscreen frame', () => {
  it('fits the whole diagram at zoom 1', () => {
    const fitted = fittedDiagramSize({ width: 2000, height: 400 }, { width: 800, height: 600 }, 1)
    expect(fitted).toEqual({ width: 800, height: 160 })
  })

  it('grows past the viewer when zoomed, and the scroll surface still covers both edges', () => {
    const viewport = { width: 800, height: 600 }
    const fitted = fittedDiagramSize({ width: 2000, height: 400 }, viewport, 2)
    expect(fitted).toEqual({ width: 1600, height: 320 })
    const surface = diagramScrollSurface(fitted!, viewport)
    expect(surface.width).toBeGreaterThanOrEqual(fitted!.width)
    expect(surface.height).toBeGreaterThanOrEqual(viewport.height)
    expect(surface.width).toBe(1600)
  })
})
