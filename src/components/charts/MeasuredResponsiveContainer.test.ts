import { describe, expect, it } from 'vitest'

import { readChartHostLayoutSize } from '@/components/charts/chartHostLayoutSize'

describe('readChartHostLayoutSize', () => {
  it('uses layout box size, not the scaled visual rect', () => {
    const el = {
      clientWidth: 208,
      clientHeight: 208,
      offsetWidth: 208,
      offsetHeight: 208,
      getBoundingClientRect: () => ({ width: 140, height: 140 }),
    }

    expect(readChartHostLayoutSize(el)).toEqual({ width: 208, height: 208 })
  })
})
