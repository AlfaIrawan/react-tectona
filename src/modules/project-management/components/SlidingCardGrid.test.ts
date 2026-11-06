import { describe, expect, it } from 'vitest'
import { columnsForWidth, gridAvailableLayoutHeight, slidingLayout, wheelPageDelta } from './SlidingCardGrid'

describe('wheelPageDelta', () => {
  const wheel = { deltaX: 0, deltaY: 100, deltaMode: 0, ctrlKey: false, metaKey: false }
  it('maps mouse wheel down/up to right/left', () => {
    expect(wheelPageDelta(wheel, 500)).toBe(100)
    expect(wheelPageDelta({ ...wheel, deltaY: -100 }, 500)).toBe(-100)
  })
  it('preserves horizontal and Shift-wheel direction', () => {
    expect(wheelPageDelta({ ...wheel, deltaX: -120, deltaY: 2 }, 500)).toBe(-120)
  })
  it('normalizes line and page scroll units', () => {
    expect(wheelPageDelta({ ...wheel, deltaY: 3, deltaMode: 1 }, 500)).toBe(48)
    expect(wheelPageDelta({ ...wheel, deltaY: -1, deltaMode: 2 }, 500)).toBe(-500)
  })
  it('does not intercept browser zoom', () => {
    expect(wheelPageDelta({ ...wheel, ctrlKey: true }, 500)).toBe(0)
    expect(wheelPageDelta({ ...wheel, metaKey: true }, 500)).toBe(0)
  })
})

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


describe('scaled and variable-height paging boundaries', () => {
  it('compares viewport space and cards in the same coordinate system at every UI scale', () => {
    for (const scale of [0.5,0.625,0.75,1,1.25,1.5]) {
      const available = gridAvailableLayoutHeight({ viewportHeight: 100 + 24 + 464 * scale, top: 100, renderedWidth: 1200 * scale, layoutWidth: 1200 })
      expect(available).toBeCloseTo(464)
      expect(slidingLayout({itemCount:8,columns:4,rowHeight:224,gap:16,availableHeight:available}).sliding).toBe(false)
      expect(slidingLayout({itemCount:8,columns:4,rowHeight:224,gap:16,availableHeight:available-1}).sliding).toBe(true)
    }
  })
  it('does not page merely because the first row is taller than the remaining rows', () => {
    expect(slidingLayout({itemCount:12,columns:4,rowHeight:300,rowHeights:[300,100,100],gap:16,availableHeight:532}).sliding).toBe(false)
  })
  it('accounts for tall cards on later pages and keeps each page within the bottom boundary', () => {
    const layout=slidingLayout({itemCount:16,columns:4,rowHeight:100,rowHeights:[100,100,300,300],gap:16,availableHeight:450})
    expect(layout).toMatchObject({sliding:true,rowsFit:1,pageSize:4,pageCount:4})
  })
  it('handles partial rows, list view and an empty grid without inventing extra pages', () => {
    expect(slidingLayout({itemCount:5,columns:4,rowHeight:200,rowHeights:[200,120],gap:16,availableHeight:336}).sliding).toBe(false)
    expect(slidingLayout({itemCount:3,columns:1,rowHeight:200,rowHeights:[100,80,120],gap:16,availableHeight:332}).sliding).toBe(false)
    expect(slidingLayout({itemCount:0,columns:4,rowHeight:200,gap:16,availableHeight:0})).toMatchObject({sliding:false,pageCount:1})
  })
})
