import { useLayoutEffect, useMemo, useState, type RefObject } from 'react'
import { getUiLayoutViewportSize, visualRectToLayoutRect } from '@/lib/uiScale'

/** Position a fixed popup under a trigger, then shift inward if it would overflow the viewport. */
export function useFixedPopupPosition(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
): { top: number; left: number } {
  const openCycle = useMemo(() => ({ open }), [open])
  const [position, setPosition] = useState<{ cycle: typeof openCycle; top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!openCycle.open) return

    let cancelled = false
    const update = () => {
      const trigger = triggerRef.current
      if (!trigger || cancelled) return

      const t = visualRectToLayoutRect(trigger.getBoundingClientRect())
      const panel = panelRef.current
      const viewport = getUiLayoutViewportSize()
      const width = panel && panel.offsetWidth > 0 ? panel.offsetWidth : 176
      const height = panel && panel.offsetHeight > 0 ? panel.offsetHeight : 168
      const margin = 8

      // Prefer right-align under trigger (toolbar table button sits near the drawer edge).
      let top = t.bottom + 6
      let left = t.right - width

      if (left < margin) left = margin
      if (left + width > viewport.width - margin) {
        left = Math.max(margin, viewport.width - width - margin)
      }
      if (top + height > viewport.height - margin) {
        top = Math.max(margin, t.top - height - 6)
      }
      if (top < margin) top = margin

      setPosition({ cycle: openCycle, top, left })
    }

    update()
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      update()
      raf2 = requestAnimationFrame(update)
    })
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [openCycle, triggerRef, panelRef])

  return position?.cycle === openCycle
    ? { top: position.top, left: position.left }
    : { top: 0, left: 0 }
}
