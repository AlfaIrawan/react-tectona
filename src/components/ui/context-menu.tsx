import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface ContextMenuProps {
  open: boolean
  x: number
  y: number
  onClose: () => void
  children: React.ReactNode
  className?: string
}

export function ContextMenu({ open, x, y, onClose, children, className }: ContextMenuProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [adjusted, setAdjusted] = React.useState<{ x: number; y: number } | null>(null)

  // Reset adjustment when menu closes or position changes
  React.useEffect(() => {
    if (!open) setAdjusted(null)
  }, [open, x, y])

  // After paint: if menu would overflow bottom/right/left, adjust position so it stays on screen
  React.useEffect(() => {
    if (!open || !ref.current) return
    const el = ref.current
    const measure = () => {
      const rect = el.getBoundingClientRect()
      let newX = x
      let newY = y
      if (rect.bottom > window.innerHeight) {
        newY = Math.max(0, y - rect.height)
      }
      if (rect.right > window.innerWidth) {
        newX = window.innerWidth - rect.width - 8
      }
      if (rect.left < 0) {
        newX = 8
      }
      if (newX !== x || newY !== y) {
        setAdjusted({ x: newX, y: newY })
      }
    }
    const raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [open, x, y])

  React.useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target)) return
      if ((e.target as HTMLElement).closest?.('[data-context-menu-submenu]')) return
      onClose()
    }
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, onClose])

  if (!open) return null

  const posX = adjusted?.x ?? x
  const posY = adjusted?.y ?? y

  const menu = (
    <div
      ref={ref}
      className={cn(
        'fixed w-56 rounded-xl glass-card shadow-2xl z-[100] py-2',
        'border border-border/50 backdrop-blur-xl',
        'animate-in fade-in-0 zoom-in-95 duration-150',
        className
      )}
      style={{ left: posX, top: posY }}
    >
      {children}
    </div>
  )

  return createPortal(menu, document.body)
}

const ContextMenuItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { onSelect?: () => void }
>(({ className, onClick, onSelect, ...props }, ref) => {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onSelect?.()
    onClick?.(e)
  }

  return (
    <div
      ref={ref}
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
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const [open, setOpen] = React.useState(false)
  const [position, setPosition] = React.useState<{ left: number; top: number } | null>(null)
  const timeoutRef = React.useRef<number>(0)

  const submenuRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open || !triggerRef.current) {
      setPosition(null)
      return
    }
    const measure = () => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      const submenuWidth = 136
      const overlapRight = 8
      const overlapLeft = 36
      let left = rect.right - overlapRight
      if (left + submenuWidth > window.innerWidth - 8) {
        left = rect.left - submenuWidth + overlapLeft
      }
      setPosition({ left: Math.max(8, left), top: rect.top })
    }
    const raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [open])

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
      {open && position && createPortal(
        <div
          ref={submenuRef}
          role="menu"
          data-context-menu-submenu
          className={cn(
            'fixed rounded-xl glass-card shadow-2xl z-[101] py-2 min-w-[8rem]',
            'border border-border/50 backdrop-blur-xl',
            'animate-in fade-in-0 zoom-in-95 duration-150'
          )}
          style={{ left: position.left, top: position.top }}
          onMouseEnter={clearCloseTimeout}
          onMouseLeave={scheduleClose}
        >
          {children}
        </div>,
        document.body
      )}
    </>
  )
}

export { ContextMenuItem, ContextMenuSeparator, ContextMenuSubmenu }
