import { useCallback, useEffect, useState } from 'react'

export const APP_MAIN_BODY_SELECTOR = '[data-app-main-body]'

/** Padding horizontal konten di dalam main body (`AppLayout` — `px-10` × 2). Selaras Layout debug `contentW`. */
export const APP_MAIN_BODY_CONTENT_PADDING_X = 80

function readMainBodyWidths(el: HTMLElement): { bodyWidth: number; contentWidth: number } {
  // Layout box, not getBoundingClientRect: an ancestor transform (ui-scale-lock)
  // shrinks the visual rect and would falsely trip the Workspace KPI carousel.
  const bodyWidth = el.offsetWidth || el.clientWidth
  const contentWidth = Math.max(0, bodyWidth - APP_MAIN_BODY_CONTENT_PADDING_X)
  return { bodyWidth, contentWidth }
}

function readDesktopCanvasLock(): boolean {
  return document.documentElement.classList.contains('ui-scale-lock')
}

/** Lebar kolom main body + lebar konten efektif (selaras Layout debug). */
export function useAppMainBodyWidth(breakpointPx = 700) {
  const [bodyWidth, setBodyWidth] = useState(0)
  const [contentWidth, setContentWidth] = useState(0)
  const [desktopCanvasLock, setDesktopCanvasLock] = useState(false)

  const measure = useCallback(() => {
    setDesktopCanvasLock(readDesktopCanvasLock())
    const el = document.querySelector(APP_MAIN_BODY_SELECTOR)
    if (!(el instanceof HTMLElement)) {
      setBodyWidth(0)
      setContentWidth(0)
      return
    }
    const next = readMainBodyWidths(el)
    setBodyWidth(next.bodyWidth)
    setContentWidth(next.contentWidth)
  }, [])

  useEffect(() => {
    measure()
    const el = document.querySelector(APP_MAIN_BODY_SELECTOR)
    if (!(el instanceof HTMLElement)) {
      window.addEventListener('resize', measure, { passive: true })
      return () => window.removeEventListener('resize', measure)
    }

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    const row = el.parentElement
    if (row instanceof HTMLElement) ro?.observe(row)

    window.addEventListener('resize', measure, { passive: true })
    const t0 = window.setTimeout(measure, 0)
    const t1 = window.setTimeout(measure, 100)
    const raf = window.requestAnimationFrame(() => {
      measure()
      window.requestAnimationFrame(measure)
    })

    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', measure)
      window.clearTimeout(t0)
      window.clearTimeout(t1)
      window.cancelAnimationFrame(raf)
    }
  }, [measure])

  const widthForBreakpoint = contentWidth > 0 ? contentWidth : bodyWidth
  const isBelowBreakpoint = widthForBreakpoint > 0 && widthForBreakpoint < breakpointPx

  return { bodyWidth, contentWidth, widthForBreakpoint, isBelowBreakpoint, desktopCanvasLock }
}
