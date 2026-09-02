import { describe, expect, it } from 'vitest'
import { computeContextSubmenuPosition } from './contextSubmenuPosition'

const trigger = { left: 400, right: 656, top: 240, bottom: 280 }

describe('computeContextSubmenuPosition', () => {
  it('places the submenu to the right when there is room', () => {
    const placed = computeContextSubmenuPosition({
      trigger,
      submenuWidth: 288,
      submenuHeight: 256,
      viewportWidth: 1920,
      viewportHeight: 1080,
    })
    expect(placed.left).toBe(652)
    expect(placed.top).toBe(240)
    expect(placed.maxHeight).toBe(256)
  })

  it('flips to the left on a narrower viewport instead of covering the parent menu', () => {
    const placed = computeContextSubmenuPosition({
      trigger,
      submenuWidth: 288,
      submenuHeight: 320,
      viewportWidth: 900,
      viewportHeight: 720,
    })
    expect(placed.left).toBe(trigger.left + 4 - 288)
    expect(placed.left + 288).toBeLessThanOrEqual(trigger.left + 4)
  })

  it('shifts up and caps height so a tall submenu stays in the viewport', () => {
    const placed = computeContextSubmenuPosition({
      trigger: { left: 80, right: 336, top: 500, bottom: 540 },
      submenuWidth: 288,
      submenuHeight: 480,
      viewportWidth: 1366,
      viewportHeight: 768,
    })
    expect(placed.top).toBeGreaterThanOrEqual(8)
    expect(placed.top + placed.maxHeight).toBeLessThanOrEqual(760)
    expect(placed.maxHeight).toBeLessThanOrEqual(752)
  })
})
