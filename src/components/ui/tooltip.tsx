import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface TooltipProps {
  children: React.ReactElement
  /** Content: string (first line = title, rest = list items) or ReactNode for custom layout */
  content: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  /** Jarak dari trigger (px). Default 8; rail nav disarankan 12–14. */
  sideOffset?: number
  size?: 'default' | 'compact'
  className?: string
}

/** Renders tooltip content with consistent SaaS style: title (semibold) + divider + list (normal). */
function renderDefaultContent(content: string, compact: boolean): React.ReactNode {
  const textClass = compact
    ? 'text-[11px] font-medium text-slate-600 dark:text-slate-300 leading-snug'
    : 'text-[13px] font-normal text-slate-700 dark:text-slate-300 leading-relaxed'
  const titleClass = compact
    ? 'text-[11px] font-semibold text-slate-800 dark:text-slate-100'
    : 'text-[13px] font-semibold text-slate-900 dark:text-slate-100'
  const lines = content.split('\n').filter(Boolean)
  if (lines.length === 0) return null
  if (lines.length === 1) {
    return <div className={textClass}>{lines[0]}</div>
  }
  const [title, ...items] = lines
  return (
    <>
      <div className={titleClass}>{title}</div>
      <div className="border-t border-slate-200/80 dark:border-slate-600/80 mt-2 pt-2" />
      <ul className={cn('space-y-1.5 leading-relaxed list-none mt-2', compact ? 'text-[11px]' : 'text-[13px]', 'font-normal text-slate-700 dark:text-slate-300')}>
        {items.map((line, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-slate-400 dark:text-slate-500 shrink-0">•</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function tooltipTransform(side: TooltipProps['side']): string {
  if (side === 'right') return 'translateY(-50%)'
  if (side === 'left') return 'translate(-100%, -50%)'
  return 'translateX(-50%)'
}

export function Tooltip({
  children,
  content,
  side = 'bottom',
  sideOffset = 8,
  size = 'default',
  className,
}: TooltipProps) {
  const compact = size === 'compact'
  const [open, setOpen] = React.useState(false)
  const [coords, setCoords] = React.useState({ left: 0, top: 0 })
  const triggerRef = React.useRef<HTMLElement>(null)
  const tooltipRef = React.useRef<HTMLDivElement>(null)

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const gap = sideOffset
    const padding = 14
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    let left = centerX
    let top: number

    if (side === 'right') {
      left = rect.right + gap
      top = centerY
      if (tooltipRef.current) {
        const w = tooltipRef.current.offsetWidth
        const maxLeft = window.innerWidth - padding - w
        left = Math.min(left, maxLeft)
      }
    } else if (side === 'left') {
      left = rect.left - gap
      top = centerY
      if (tooltipRef.current) {
        const w = tooltipRef.current.offsetWidth
        left = Math.max(padding + w, left)
      }
    } else if (side === 'bottom') {
      top = rect.bottom + gap
      if (tooltipRef.current) {
        const tooltipWidth = tooltipRef.current.offsetWidth
        const halfWidth = tooltipWidth / 2
        const minLeft = padding + halfWidth
        const maxLeft = window.innerWidth - padding - halfWidth
        left = Math.max(minLeft, Math.min(maxLeft, centerX))
      } else {
        const halfMaxW = 160
        const minLeft = padding + halfMaxW
        const maxLeft = window.innerWidth - padding - halfMaxW
        left = Math.max(minLeft, Math.min(maxLeft, centerX))
      }
    } else {
      const tooltipHeight = tooltipRef.current?.offsetHeight ?? (compact ? 28 : 64)
      top = rect.top - gap - tooltipHeight
      if (tooltipRef.current) {
        const tooltipWidth = tooltipRef.current.offsetWidth
        const halfWidth = tooltipWidth / 2
        const minLeft = padding + halfWidth
        const maxLeft = window.innerWidth - padding - halfWidth
        left = Math.max(minLeft, Math.min(maxLeft, centerX))
      } else {
        const halfMaxW = 160
        const minLeft = padding + halfMaxW
        const maxLeft = window.innerWidth - padding - halfMaxW
        left = Math.max(minLeft, Math.min(maxLeft, centerX))
      }
    }

    setCoords({ left, top })
  }, [side, sideOffset, compact])

  const handleMouseEnter = (e: React.MouseEvent) => {
    setOpen(true)
    requestAnimationFrame(() => {
      updatePosition()
      // Recalculate after tooltip renders to get actual width
      requestAnimationFrame(updatePosition)
    })
  }
  const handleMouseLeave = () => setOpen(false)
  
  // Update position when tooltip content changes or window resizes
  React.useEffect(() => {
    if (!open) return
    updatePosition()
    const handleResize = () => updatePosition()
    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleResize, true)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleResize, true)
    }
  }, [open, updatePosition])

  const child = React.Children.only(children)
  const childEl = child as React.ReactElement<any>
  const trigger = React.cloneElement(childEl, {
    ref: (el: HTMLElement | null) => {
      triggerRef.current = el
      const origRef = (childEl as any).ref as React.Ref<unknown> | undefined
      if (typeof origRef === 'function') origRef(el)
      else if (origRef) (origRef as React.MutableRefObject<HTMLElement | null>).current = el
    },
    onMouseEnter: (e: React.MouseEvent) => {
      handleMouseEnter(e)
      childEl.props.onMouseEnter?.(e)
    },
    onMouseLeave: (e: React.MouseEvent) => {
      handleMouseLeave()
      childEl.props.onMouseLeave?.(e)
    },
    onClick: (e: React.MouseEvent) => {
      childEl.props.onClick?.(e)
    },
  })

  const contentNode =
    typeof content === 'string'
      ? renderDefaultContent(content, compact)
      : content

  return (
    <>
      {trigger}
      {open &&
        createPortal(
          <div
            ref={tooltipRef}
            className={cn(
              'fixed z-[9999]',
              compact ? 'max-w-[200px] px-2 py-1' : 'max-w-[320px] px-4 py-3',
              'bg-white dark:bg-slate-800',
              compact ? 'rounded-lg' : 'rounded-[13px]',
              compact
                ? 'shadow-[0_2px_8px_rgba(15,23,42,0.08)] dark:shadow-black/25'
                : 'shadow-md shadow-black/6 dark:shadow-black/20',
              'border border-slate-200/70 dark:border-slate-600/50',
              'animate-in fade-in-0 zoom-in-95 duration-150',
              className
            )}
            style={{
              left: `${coords.left}px`,
              top: `${coords.top}px`,
              transform: tooltipTransform(side),
            }}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            {/* Minimal arrow pointer */}
            {side === 'bottom' && (
              <>
                <div
                  className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-[6px] border-transparent border-b-slate-200/70 dark:border-b-slate-600/50 border-t-0"
                  style={{ left: '50%', bottom: '100%' }}
                  aria-hidden
                />
                <div
                  className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-[5px] border-transparent border-b-white dark:border-b-slate-800 border-t-0"
                  style={{ left: '50%', bottom: 'calc(100% - 1px)' }}
                  aria-hidden
                />
              </>
            )}
            {side === 'top' && (
              <>
                <div
                  className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-[6px] border-transparent border-t-slate-200/70 dark:border-t-slate-600/50 border-b-0"
                  style={{ left: '50%', top: '100%' }}
                  aria-hidden
                />
                <div
                  className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-[5px] border-transparent border-t-white dark:border-t-slate-800 border-b-0"
                  style={{ left: '50%', top: 'calc(100% - 1px)' }}
                  aria-hidden
                />
              </>
            )}
            <div className="relative">{contentNode}</div>
          </div>,
          document.body
        )}
    </>
  )
}
