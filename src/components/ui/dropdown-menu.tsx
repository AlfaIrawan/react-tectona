import * as React from 'react'
import { enterpriseControlFocusClass } from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'

interface DropdownMenuContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const DropdownMenuContext = React.createContext<DropdownMenuContextType | null>(null)

const DropdownMenu = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { open?: boolean; onOpenChange?: (open: boolean) => void }
>(({ className, open: controlledOpen, onOpenChange, children, ...props }, forwardedRef) => {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const internalRef = React.useRef<HTMLDivElement>(null)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  // Merge refs
  const ref = forwardedRef || internalRef

  const setOpen = React.useCallback((newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen)
    }
    onOpenChange?.(newOpen)
  }, [isControlled, onOpenChange])

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const element = (ref && 'current' in ref) ? ref.current : internalRef.current
      if (isOpen && element) {
        if (!element.contains(event.target as Node)) {
          setOpen(false)
        }
      }
    }

    if (isOpen) {
      // Use setTimeout to avoid immediately closing when opening
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 0)
      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen, setOpen, ref])

  return (
    <DropdownMenuContext.Provider value={{ open: isOpen, setOpen }}>
      <div
        ref={internalRef}
        className={cn('relative', className)}
        {...props}
      >
        {children}
      </div>
    </DropdownMenuContext.Provider>
  )
})
DropdownMenu.displayName = 'DropdownMenu'

const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, children, onClick, asChild, ...props }, ref) => {
  const context = React.useContext(DropdownMenuContext)

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    context?.setOpen(!context.open)
    onClick?.(e)
  }

  if (asChild && React.isValidElement(children)) {
    const childProps = (children as React.ReactElement<any>).props
    const childOnClick = childProps?.onClick
    
    const combinedOnClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      context?.setOpen(!context.open)
      childOnClick?.(e)
    }
    
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: combinedOnClick,
      ref,
    })
  }

  return (
    <button
      ref={ref}
      className={cn(enterpriseControlFocusClass(), className)}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  )
})
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger'

const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { align?: 'start' | 'end'; side?: 'top' | 'bottom' }
>(({ className, align = 'end', side = 'bottom', onCloseAutoFocus: _onCloseAutoFocus, onOpenAutoFocus: _onOpenAutoFocus, ...props }, ref) => {
  const context = React.useContext(DropdownMenuContext)
  const [isAnimating, setIsAnimating] = React.useState(false)

  React.useEffect(() => {
    if (context?.open) {
      requestAnimationFrame(() => {
        setIsAnimating(true)
      })
    } else {
      setIsAnimating(false)
    }
  }, [context?.open])

  if (!context?.open) return null

  const isTop = side === 'top'

  return (
    <div
      ref={ref}
      className={cn(
        'absolute w-56 rounded-xl liquid-glass-enterprise-popover shadow-2xl z-50 py-2',
        'border border-border/60 bg-popover',
        'transition-all duration-200 ease-out',
        isTop ? 'bottom-full mb-2' : 'mt-2 top-full',
        isAnimating
          ? 'opacity-100 scale-100'
          : 'opacity-0 scale-95',
        isTop
          ? (isAnimating ? 'translate-y-0' : 'translate-y-2')
          : (isAnimating ? 'translate-y-0' : '-translate-y-2'),
        align === 'end' ? 'right-0' : 'left-0',
        className
      )}
      {...props}
    />
  )
})
DropdownMenuContent.displayName = 'DropdownMenuContent'

const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    /** When false, keep the menu open after click (e.g. multi-select lists). */
    closeOnSelect?: boolean
    /** Alias for click handlers that should prevent auto-close via preventDefault(). */
    onSelect?: React.MouseEventHandler<HTMLDivElement>
  }
>(({ className, onClick, onSelect, closeOnSelect = true, ...props }, ref) => {
  const context = React.useContext(DropdownMenuContext)

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onSelect?.(e)
    onClick?.(e)
    if (closeOnSelect && !e.defaultPrevented) {
      context?.setOpen(false)
    }
  }

  return (
    <div
      ref={ref}
      className={cn(
        'relative flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer',
        'rounded-lg mx-1',
        'transition-all duration-150 ease-in-out',
        'hover:bg-accent/80 hover:text-accent-foreground',
        'active:scale-[0.98] active:bg-accent',
        'focus:outline-none focus:bg-accent focus:text-accent-foreground',
        'group',
        className
      )}
      onClick={handleClick}
      {...props}
    />
  )
})
DropdownMenuItem.displayName = 'DropdownMenuItem'

const DropdownMenuLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('px-4 py-2 text-sm font-semibold text-foreground', className)}
      {...props}
    />
  )
})
DropdownMenuLabel.displayName = 'DropdownMenuLabel'

const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('my-1 h-px bg-border', className)}
      {...props}
    />
  )
})
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator'

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
}
