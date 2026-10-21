import { useEffect, useState } from 'react'

/**
 * Whether an element's layout width is below `breakpointPx`. Tailwind breakpoints are all 1px in this
 * app (the 1920px canvas is zoomed to the window by ui-scale-lock), so a layout that must change on a
 * narrow container measures the container itself. `offsetWidth` is in layout px, unaffected by the
 * zoom (see useAppMainBodyWidth).
 */
export function useLayoutWidthBelow(element: HTMLElement | null, breakpointPx: number): boolean {
  const [below, setBelow] = useState(false)
  useEffect(() => {
    if (!element) return
    const measure = () => {
      const width = element.offsetWidth || element.clientWidth
      setBelow(width > 0 && width < breakpointPx)
    }
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(element)
    window.addEventListener('resize', measure, { passive: true })
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [element, breakpointPx])
  return below
}
