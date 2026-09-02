import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { computeContextSubmenuPosition } from '@/components/ui/contextSubmenuPosition'
import {
  getUiLayoutViewportSize,
  pointerClientToLayout,
  visualRectToLayoutRect,
} from '@/lib/uiScale'

const DEFAULT_CONTEXT_MENU_Z_INDEX = 100

const ContextMenuLayerContext = React.createContext(DEFAULT_CONTEXT_MENU_Z_INDEX)

interface ContextMenuProps {
  open: boolean
  x: number
  y: number
  onClose: () => void
  children: React.ReactNode
  className?: string
  /** Stack order for menu + submenus. Submenus render at zIndex + 1. */
  zIndex?: number
}

export function ContextMenu({
  open,
  x,
  y,
  onClose,
  children,
  className,
  zIndex = DEFAULT_CONTEXT_MENU_Z_INDEX,
}: ContextMenuProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const onCloseRef = React.useRef(onClose)
  const [adjusted, setAdjusted] = React.useState<{ x: number; y: number } | null>(null)

  React.useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const isInsideContextMenu = (target: EventTarget | null) => {
    if (!(target instanceof Node)) return false
    const el = target instanceof HTMLElement ? target : target.parentElement
    if (!el) return false
    return Boolean(
      el.closest('[data-context-menu-root]') || el.closest('[data-context-menu-submenu]'),
    )
  }

  // Reset adjustment when menu closes or position changes
  React.useEffect(() => {
    if (!open) setAdjusted(null)
  }, [open, x, y])

  // After paint: if menu would overflow bottom/right/left, adjust position so it stays on screen
  React.useEffect(() => {
    if (!open || !ref.current) return
    const measure = () => {
      const el = ref.current
      if (!el) return
      const origin = pointerClientToLayout(x, y)
      const rect = visualRectToLayoutRect(el.getBoundingClientRect())
      const viewport = getUiLayoutViewportSize()
      let newX = origin.x
      let newY = origin.y
      if (rect.bottom > viewport.height) {
        newY = Math.max(0, origin.y - rect.height)
      }
      if (rect.right > viewport.width) {
        newX = viewport.width - rect.width - 8
      }
      if (rect.left < 0) {
        newX = 8
      }
      if (newX !== origin.x || newY !== origin.y) {
        setAdjusted({ x: newX, y: newY })
      }
    }
    const raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [open, x, y])

  React.useEffect(() => {
    if (!open) return

    const handleDismiss = (event: MouseEvent | PointerEvent) => {
      if (isInsideContextMenu(event.target)) return
      onCloseRef.current()
    }

    document.addEventListener('mousedown', handleDismiss, true)
    document.addEventListener('pointerdown', handleDismiss, true)
    return () => {
      document.removeEventListener('mousedown', handleDismiss, true)
      document.removeEventListener('pointerdown', handleDismiss, true)
    }
  }, [open])

  if (!open) return null

  const origin = pointerClientToLayout(x, y)
  const posX = adjusted?.x ?? origin.x
  const posY = adjusted?.y ?? origin.y

  const menu = (
    <ContextMenuLayerContext.Provider value={zIndex}>
      <div
        ref={ref}
        className={cn(
          'fixed w-56 rounded-xl liquid-glass-enterprise-panel shadow-2xl py-2',
          'border border-border/50 backdrop-blur-xl',
          'animate-in fade-in-0 zoom-in-95 duration-150',
          className
        )}
        style={{ left: posX, top: posY, zIndex }}
        data-context-menu-root
      >
        {children}
      </div>
    </ContextMenuLayerContext.Provider>
  )

  return createPortal(menu, document.body)
}

const ContextMenuItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    onSelect?: (event: React.MouseEvent<HTMLDivElement>) => void
    disabled?: boolean
  }
>(({ className, onClick, onSelect, disabled, ...props }, ref) => {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return
    onSelect?.(e)
    onClick?.(e)
  }

  return (
    <div
      ref={ref}
      role="menuitem"
      aria-disabled={disabled || undefined}
      className={cn(
        'relative flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer',
        'rounded-lg mx-1',
        'transition-all duration-150 ease-in-out',
        'hover:bg-accent/80 hover:text-accent-foreground',
        'active:scale-[0.98] active:bg-accent',
        'focus:outline-none focus:bg-accent focus:text-accent-foreground',
        disabled && 'pointer-events-none cursor-not-allowed opacity-50',
        className
      )}
      onClick={handleClick}
      {...props}
    />
  )
})
ContextMenuItem.displayName = 'ContextMenuItem'

function ContextMenuSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="separator"
      className={cn('my-1 h-px bg-border mx-2', className)}
      {...props}
    />
  )
}

const SUBMENU_HOVER_DELAY = 120

interface ContextMenuSubmenuProps {
  trigger: React.ReactNode
  children: React.ReactNode
  className?: string
}

function ContextMenuSubmenu({ trigger, children, className }: ContextMenuSubmenuProps) {
  const menuZIndex = React.useContext(ContextMenuLayerContext)
  const submenuZIndex = menuZIndex + 1
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const submenuRef = React.useRef<HTMLDivElement>(null)
  const [open, setOpen] = React.useState(false)
  const [position, setPosition] = React.useState<{ left: number; top: number; maxHeight: number } | null>(null)
  const timeoutRef = React.useRef<number>(0)

  const updatePosition = React.useCallback(() => {
    const triggerEl = triggerRef.current
    const submenuEl = submenuRef.current
    if (!triggerEl || !submenuEl) return
    const rect = visualRectToLayoutRect(triggerEl.getBoundingClientRect())
    const viewport = getUiLayoutViewportSize()
    const next = computeContextSubmenuPosition({
      trigger: rect,
      submenuWidth: submenuEl.offsetWidth || 288,
      submenuHeight: submenuEl.scrollHeight || submenuEl.offsetHeight || 256,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
    })
    setPosition((prev) => {
      if (
        prev
        && Math.abs(prev.left - next.left) < 1
        && Math.abs(prev.top - next.top) < 1
        && Math.abs(prev.maxHeight - next.maxHeight) < 1
      ) {
        return prev
      }
      return next
    })
  }, [])

  React.useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    updatePosition()
    const raf = requestAnimationFrame(updatePosition)
    const submenuEl = submenuRef.current
    const observer = submenuEl ? new ResizeObserver(() => updatePosition()) : null
    if (submenuEl && observer) observer.observe(submenuEl)
    window.addEventListener('resize', updatePosition)
    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, children, updatePosition])

  const clearCloseTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = 0
    }
  }

  const scheduleClose = () => {
    clearCloseTimeout()
    timeoutRef.current = window.setTimeout(() => setOpen(false), SUBMENU_HOVER_DELAY)
  }

  return (
    <>
      <div
        ref={triggerRef}
        role="menuitem"
        className={cn(
          'relative flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer',
          'rounded-lg mx-1',
          'transition-all duration-150 ease-in-out',
          'hover:bg-accent/80 hover:text-accent-foreground',
          'active:scale-[0.98] active:bg-accent',
          'focus:outline-none focus:bg-accent focus:text-accent-foreground',
          className
        )}
        onMouseEnter={() => {
          clearCloseTimeout()
          setOpen(true)
        }}
        onMouseLeave={scheduleClose}
      >
        {trigger}
      </div>
      {open && createPortal(
        <div
          ref={submenuRef}
          role="menu"
          data-context-menu-submenu
          className={cn(
            'fixed overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl liquid-glass-enterprise-panel shadow-2xl py-2',
            'w-[min(18rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)]',
            'border border-border/50 backdrop-blur-xl',
            'animate-in fade-in-0 zoom-in-95 duration-150',
          )}
          style={{
            left: position?.left ?? -9999,
            top: position?.top ?? 0,
            zIndex: submenuZIndex,
            maxHeight: position?.maxHeight ?? 'min(20rem, calc(100vh - 1rem))',
            visibility: position ? 'visible' : 'hidden',
          }}
          onMouseEnter={clearCloseTimeout}
          onMouseLeave={scheduleClose}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  )
}

export { ContextMenuItem, ContextMenuSeparator, ContextMenuSubmenu }
