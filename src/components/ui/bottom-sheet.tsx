import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface BottomSheetContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const BottomSheetContext = React.createContext<BottomSheetContextType | null>(null)

interface BottomSheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  /** Optional: close on swipe down (touch drag) */
  swipeToClose?: boolean
  /** When set, overlay is portaled into this container (e.g. Todo drawer) and positioned absolute */
  containerEl?: HTMLElement | null
}

const BottomSheet = ({
  open: controlledOpen,
  onOpenChange,
  children,
  swipeToClose = true,
  containerEl,
}: BottomSheetProps) => {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  const [isExiting, setIsExiting] = React.useState(false)
  const wasOpenRef = React.useRef(false)

  const setOpen = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) setInternalOpen(newOpen)
      onOpenChange?.(newOpen)
    },
    [isControlled, onOpenChange]
  )

  const requestClose = React.useCallback(() => {
    setIsExiting(true)
  }, [])

  React.useEffect(() => {
    if (isOpen) wasOpenRef.current = true
  }, [isOpen])

  React.useEffect(() => {
    if (!isOpen && wasOpenRef.current) {
      setIsExiting(true)
    }
  }, [isOpen])

  React.useEffect(() => {
    if (!isExiting) return
    const t = setTimeout(() => {
      wasOpenRef.current = false
      setIsExiting(false)
      setOpen(false)
    }, 300)
    return () => clearTimeout(t)
  }, [isExiting, setOpen])

  React.useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    document.addEventListener('keydown', handleEscape)
    if (!containerEl) document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      if (!containerEl) document.body.style.overflow = ''
    }
  }, [isOpen, requestClose, containerEl])

  const visible = isOpen || isExiting
  if (!visible) return null

  const inline = Boolean(containerEl)
  const overlay = (
    <BottomSheetOverlay
      swipeToClose={swipeToClose}
      isExiting={isExiting}
      onClose={requestClose}
      children={children}
      inline={inline}
    />
  )
  const portalTarget = containerEl ?? document.body

  return (
    <BottomSheetContext.Provider value={{ open: true, setOpen: requestClose }}>
      {createPortal(overlay, portalTarget)}
    </BottomSheetContext.Provider>
  )
}

interface BottomSheetOverlayProps {
  isExiting: boolean
  onClose: () => void
  children: React.ReactNode
  swipeToClose: boolean
  inline?: boolean
}

function BottomSheetOverlay({ isExiting, onClose, children, swipeToClose, inline = false }: BottomSheetOverlayProps) {
  const sheetRef = React.useRef<HTMLDivElement>(null)
  const dragStartY = React.useRef(0)
  const [isEntering, setIsEntering] = React.useState(true)
  React.useEffect(() => {
    const t = requestAnimationFrame(() => setIsEntering(false))
    return () => cancelAnimationFrame(t)
  }, [])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!swipeToClose) return
    dragStartY.current = e.touches[0].clientY
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipeToClose || !sheetRef.current) return
    const y = e.touches[0].clientY
    const delta = y - dragStartY.current
    if (delta > 0) {
      sheetRef.current.style.transform = `translateY(${Math.min(delta, 120)}px)`
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!swipeToClose || !sheetRef.current) return
    const y = e.changedTouches[0].clientY
    const delta = y - dragStartY.current
    sheetRef.current.style.transform = ''
    if (delta > 80) onClose()
  }

  return (
    <div
      className={cn(
        'z-50 flex items-end justify-center',
        inline ? 'absolute inset-0' : 'fixed inset-0'
      )}
      onClick={handleOverlayClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Darkened blurred overlay — rgba black 40% + backdrop-blur-md */}
      <div
        className={cn(
          'absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity duration-300',
          isExiting ? 'opacity-0' : 'opacity-100'
        )}
        aria-hidden
      />
      {/* Sheet: frosted glass, rounded top, shadow, slide-up */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 w-full',
          'rounded-t-[32px]',
          'bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl',
          'border border-slate-200/50 dark:border-slate-700/50 border-b-0',
          'shadow-xl',
          'transition-transform duration-300 ease-out',
          isExiting ? 'translate-y-full' : isEntering ? 'translate-y-full' : 'translate-y-0'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Optional: swipe handle hint — 16–20px spacing below */}
        {swipeToClose && (
          <div className="flex justify-center pt-4 pb-2">
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" aria-hidden />
          </div>
        )}
        <div className="px-6 pt-4 pb-7 flex flex-col gap-6">{children}</div>
      </div>
    </div>
  )
}

const BottomSheetHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col', className)} {...props} />
))
BottomSheetHeader.displayName = 'BottomSheetHeader'

const BottomSheetTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn('text-lg font-semibold tracking-tight text-foreground', className)}
    {...props}
  />
))
BottomSheetTitle.displayName = 'BottomSheetTitle'

/** Subtle divider under title */
const BottomSheetDivider = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('border-b border-slate-200/80 dark:border-slate-700/80 mb-6', className)}
    {...props}
  />
))
BottomSheetDivider.displayName = 'BottomSheetDivider'

const BottomSheetContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('space-y-5 min-h-0', className)} {...props} />
))
BottomSheetContent.displayName = 'BottomSheetContent'

const BottomSheetFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center justify-end gap-3 pt-5', className)}
    {...props}
  />
))
BottomSheetFooter.displayName = 'BottomSheetFooter'

export {
  BottomSheet,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDivider,
  BottomSheetContent,
  BottomSheetFooter,
  BottomSheetContext,
}
