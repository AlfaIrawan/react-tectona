import { useEffect, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Maximize2 } from 'lucide-react'

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
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
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
  if (!menu || typeof document === 'undefined') return null
  return createPortal(
    <div
      data-diagram-surface-menu=""
      className="fixed z-[80] w-52 rounded-md border border-slate-200 bg-white py-1 text-sm text-slate-700 shadow-xl"
      style={{ left: Math.max(8, menu.x), top: Math.max(8, menu.y) }}
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
