import { useEffect, useMemo, useState, type RefObject } from 'react'
import { getUiLayoutViewportSize, pointerClientToLayout, visualRectToLayoutRect } from '@/lib/uiScale'

export function getEditorSubmenuPlacement(menuX: number, menuWidth: number, submenuWidth: number) {
  const margin = 8
  const viewportWidth = getUiLayoutViewportSize().width
  if (menuX + menuWidth + submenuWidth <= viewportWidth - margin) {
    return { left: '100%', marginLeft: -4 }
  }
  if (menuX - submenuWidth >= margin) {
    return { right: '100%', marginRight: -4 }
  }
  // The submenu is positioned inside the menu's padded row. Allow overlap on narrow screens.
  const rowInset = 7
  const visibleWidth = Math.min(submenuWidth, Math.max(0, viewportWidth - margin * 2))
  const left = Math.max(margin, Math.min(menuX + rowInset, viewportWidth - margin - visibleWidth))
  return { left: left - menuX - rowInset, maxWidth: visibleWidth }
}

export function useEditorContextMenuPosition(
  ref: RefObject<HTMLDivElement | null>,
  open: boolean,
  x: number,
  y: number,
): { x: number; y: number } {
  const request = useMemo(() => open ? { x, y } : null, [open, x, y])
  const [measured, setMeasured] = useState<{ request: NonNullable<typeof request>; x: number; y: number } | null>(null)

  useEffect(() => {
    if (!request || !ref.current) return
    const el = ref.current
    const frame = requestAnimationFrame(() => {
      const origin = pointerClientToLayout(request.x, request.y)
      const { width, height } = visualRectToLayoutRect(el.getBoundingClientRect())
      const viewport = getUiLayoutViewportSize()
      const margin = 8
      const maxX = Math.max(margin, viewport.width - width - margin)
      const maxY = Math.max(margin, viewport.height - height - margin)
      const preferredY = origin.y + height > viewport.height - margin ? origin.y - height : origin.y
      setMeasured({
        request,
        x: Math.max(margin, Math.min(maxX, origin.x)),
        y: Math.max(margin, Math.min(maxY, preferredY)),
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [ref, request])

  return measured && measured.request === request
    ? { x: measured.x, y: measured.y }
    : pointerClientToLayout(x, y)
}
