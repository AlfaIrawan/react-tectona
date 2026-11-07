import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Maximize2 } from 'lucide-react'
import { visualPxToLayoutPx } from '@/lib/uiScale'

type MenuPoint = { x: number; y: number }

export function useDiagramSurfaceMenu() {
  const [menu, setMenu] = useState<MenuPoint | null>(null)
  useEffect(() => {
    if (!menu) return
    const close = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('[data-diagram-surface-menu]')) return
      setMenu(null)
    }
    const dismiss = () => setMenu(null)
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      dismiss()
    }
    window.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', key, true)
    window.addEventListener('blur', dismiss)
    return () => {
      window.removeEventListener('pointerdown', close, true)
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('blur', dismiss)
    }
  }, [menu])

  const open = (event: ReactMouseEvent | MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY })
  }

  return { menu, open, close: () => setMenu(null) }
}

export function DiagramSurfaceMenu({
  menu,
  children,
}: {
  menu: MenuPoint | null
  children: ReactNode
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = menuRef.current
    if (!menu || !element) return
    const place = () => {
      // Pointer coordinates and DOMRects are visual pixels; fixed styles use layout pixels.
      element.style.maxWidth = `${visualPxToLayoutPx(Math.max(0, window.innerWidth - 16))}px`
      element.style.maxHeight = `${visualPxToLayoutPx(Math.max(0, window.innerHeight - 16))}px`
      const bounds = element.getBoundingClientRect()
      element.style.left = `${visualPxToLayoutPx(Math.max(8, Math.min(menu.x, window.innerWidth - bounds.width - 8)))}px`
      element.style.top = `${visualPxToLayoutPx(Math.max(8, Math.min(menu.y, window.innerHeight - bounds.height - 8)))}px`
    }
    place()
    window.addEventListener('resize', place)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place)
    observer?.observe(element)
    return () => {
      window.removeEventListener('resize', place)
      observer?.disconnect()
    }
  }, [menu, children])
  if (!menu || typeof document === 'undefined') return null
  return createPortal(
    <div
      ref={menuRef}
      data-diagram-surface-menu=""
      className="fixed z-[80] w-52 overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm text-slate-700 shadow-xl"
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}

export function DiagramSurfaceMenuButton({
  label,
  icon,
  onClick,
}: {
  label: string
  icon?: 'copy' | 'fullscreen'
  onClick: () => void
}) {
  const Icon = icon === 'fullscreen' ? Maximize2 : Copy
  return (
    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100" onClick={onClick}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  )
}
