import { useCallback, useEffect, useState } from 'react'

import { getUiLayoutScale } from '@/lib/uiScale'

export const APP_MAIN_BODY_SELECTOR = '[data-app-main-body]'
export const APP_MAIN_CANVAS_SELECTOR = '[data-app-main-canvas]'
export const APP_MAIN_CANVAS_LEFT_VAR = '--app-main-canvas-left'

/** Padding horizontal konten di dalam main body (`AppLayout` — `px-10` × 2). Selaras Layout debug `contentW`. */
export const APP_MAIN_BODY_CONTENT_PADDING_X = 80

/**
 * Pin docked enterprise nav to the AppLayout 1920 canvas (inside padding), not the viewport.
 * `position:fixed; left:0` orphans the rail on ultrawide while content is `mx-auto max-w-[1920px]`.
 */
export function syncAppMainCanvasLeft(canvasEl: HTMLElement | null): void {
  const root = document.documentElement
  if (!canvasEl) {
    root.style.removeProperty(APP_MAIN_CANVAS_LEFT_VAR)
    return
  }
  const scale = getUiLayoutScale()
  const rect = canvasEl.getBoundingClientRect()
  const pad = Number.parseFloat(getComputedStyle(canvasEl).paddingLeft) || 0
  const left = Math.max(0, rect.left / scale + pad)
  root.style.setProperty(APP_MAIN_CANVAS_LEFT_VAR, `${Math.round(left)}px`)
}

function readMainBodyWidths(el: HTMLElement): { bodyWidth: number; contentWidth: number } {
  // Layout box, not getBoundingClientRect: an ancestor transform (ui-scale-lock)
  // shrinks the visual rect and would falsely trip the Workspace KPI carousel.
  const bodyWidth = el.offsetWidth || el.clientWidth
  const contentWidth = Math.max(0, bodyWidth - APP_MAIN_BODY_CONTENT_PADDING_X)
  return { bodyWidth, contentWidth }
}

/** Lebar kolom main body + lebar konten efektif (selaras Layout debug). */
export function useAppMainBodyWidth(breakpointPx = 700) {
  const [bodyWidth, setBodyWidth] = useState(0)
  const [contentWidth, setContentWidth] = useState(0)

  const measure = useCallback(() => {
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

  return { bodyWidth, contentWidth, widthForBreakpoint, isBelowBreakpoint }
}
