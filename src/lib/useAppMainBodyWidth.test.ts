import { describe, expect, it } from 'vitest'

import { APP_MAIN_CANVAS_LEFT_VAR, syncAppMainCanvasLeft } from '@/lib/useAppMainBodyWidth'

describe('syncAppMainCanvasLeft', () => {
  it('stores canvas left plus padding in layout pixels', () => {
    const canvas = document.createElement('div')
    canvas.style.paddingLeft = '40px'
    canvas.getBoundingClientRect = () =>
      ({
        left: 320,
        top: 0,
        right: 2240,
        bottom: 800,
        width: 1920,
        height: 800,
        x: 320,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect

    syncAppMainCanvasLeft(canvas)
    expect(document.documentElement.style.getPropertyValue(APP_MAIN_CANVAS_LEFT_VAR)).toBe('360px')

    syncAppMainCanvasLeft(null)
    expect(document.documentElement.style.getPropertyValue(APP_MAIN_CANVAS_LEFT_VAR)).toBe('')
  })
})
