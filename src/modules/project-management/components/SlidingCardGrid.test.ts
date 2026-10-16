import { describe, expect, it } from 'vitest'
import { columnsForWidth, slidingLayout } from './SlidingCardGrid'

describe('columnsForWidth', () => {
  it('follows the grid breakpoints', () => {
    expect(columnsForWidth(500, false)).toBe(1)
    expect(columnsForWidth(800, false)).toBe(2)
    expect(columnsForWidth(1280, false)).toBe(4)
  })

  it('is one column in list view at any width', () => {
    expect(columnsForWidth(1600, true)).toBe(1)
  })
})

describe('slidingLayout', () => {
  const card = 220
  const gap = 16

  it('turns sliding off when the whole grid fits below the header', () => {
    // 8 cards in 4 columns = 2 rows; the space holds 3 rows.
    const layout = slidingLayout({ itemCount: 8, columns: 4, rowHeight: card, gap, availableHeight: 3 * card + 2 * gap })
    expect(layout.sliding).toBe(false)
    expect(layout.pageCount).toBe(1)
  })

  it('turns sliding on when the grid is taller than the screen, with one page per screenful', () => {
    // 14 cards in 4 columns = 4 rows; the space holds 2 rows → 8 cards per page, 2 pages.
    const layout = slidingLayout({ itemCount: 14, columns: 4, rowHeight: card, gap, availableHeight: 2 * card + gap })
    expect(layout.sliding).toBe(true)
    expect(layout.rowsFit).toBe(2)
    expect(layout.pageSize).toBe(8)
    expect(layout.pageCount).toBe(2)
  })

  it('keeps at least one row on screen even when the space is tiny', () => {
    const layout = slidingLayout({ itemCount: 5, columns: 2, rowHeight: card, gap, availableHeight: 10 })
    expect(layout.rowsFit).toBe(1)
    expect(layout.pageSize).toBe(2)
    expect(layout.pageCount).toBe(3)
  })

  it('a grid that exactly fills the space is not sliding', () => {
    const layout = slidingLayout({ itemCount: 4, columns: 4, rowHeight: card, gap, availableHeight: card })
    expect(layout.sliding).toBe(false)
  })
})
