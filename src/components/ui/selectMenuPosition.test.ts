import { describe, expect, it } from 'vitest'
import { computeSelectMenuStyle } from './select'

function rect(partial: Partial<DOMRectReadOnly>): DOMRectReadOnly {
  const width = partial.width ?? 84
  const height = partial.height ?? 40
  const left = partial.left ?? 0
  const top = partial.top ?? 0
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON() {
      return this
    },
  }
}

describe('computeSelectMenuStyle', () => {
  it('anchors a narrow paging trigger to the right edge instead of 0,0', () => {
    const style = computeSelectMenuStyle(
      rect({ left: 900, top: 400, width: 84, height: 40 }),
      { width: 1280, height: 800 },
    )
    expect(style.position).toBe('fixed')
    expect(style.left).toBe(900 + 84 - 132)
    expect(style.top).toBe(444)
    expect(style.bottom).toBe('auto')
    expect(style.width).toBe(132)
  })

  it('opens upward when there is not enough space below', () => {
    const style = computeSelectMenuStyle(
      rect({ left: 200, top: 740, width: 160, height: 40 }),
      { width: 1280, height: 800 },
    )
    expect(style.top).toBe('auto')
    expect(style.bottom).toBe(800 - 740 + 4)
  })

  it('keeps the menu inside the viewport', () => {
    const style = computeSelectMenuStyle(
      rect({ left: 1200, top: 20, width: 84, height: 40 }),
      { width: 1280, height: 800 },
    )
    expect(Number(style.left)).toBeGreaterThanOrEqual(8)
    expect(Number(style.left) + Number(style.width)).toBeLessThanOrEqual(1272)
  })
})
