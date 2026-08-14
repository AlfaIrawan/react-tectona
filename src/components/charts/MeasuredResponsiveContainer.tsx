import { cloneElement, useEffect, useRef, useState, type ReactElement } from 'react'

type MeasuredResponsiveContainerProps = {
  children: ReactElement
  className?: string
}

/**
 * Measures host size and passes fixed width/height to Recharts charts.
 * Avoids Recharts ResponsiveContainer (internal ResizeObserver + redux store).
 */
export function MeasuredResponsiveContainer({
  children,
  className = 'h-full w-full min-h-0 min-w-0',
}: MeasuredResponsiveContainerProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const childrenRef = useRef(children)
  childrenRef.current = children
  const [size, setSize] = useState({ width: 0, height: 0 })
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const el = hostRef.current
    if (!el) return

    const update = () => {
      if (rafRef.current != null) return
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null
        const rect = el.getBoundingClientRect()
        const width = Math.max(0, Math.floor(rect.width))
        const height = Math.max(0, Math.floor(rect.height))
        setSize((prev) => {
          if (Math.abs(prev.width - width) <= 1 && Math.abs(prev.height - height) <= 1) {
            return prev
          }
          return { width, height }
        })
      })
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => {
      observer.disconnect()
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [])

  const canRender = size.width > 0 && size.height > 0

  return (
    <div ref={hostRef} className={className}>
      {canRender
        ? cloneElement(childrenRef.current, { width: size.width, height: size.height })
        : null}
    </div>
  )
}
