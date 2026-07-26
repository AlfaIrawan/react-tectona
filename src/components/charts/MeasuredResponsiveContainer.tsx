import { useEffect, useRef, useState, type ReactElement } from 'react'
import { ResponsiveContainer } from 'recharts'

type MeasuredResponsiveContainerProps = {
  children: ReactElement
  className?: string
}

/**
 * Renders Recharts only after the host element has a positive size.
 * Avoids console warnings when charts mount inside hidden/zero-size panels.
 */
export function MeasuredResponsiveContainer({
  children,
  className = 'h-full w-full min-h-0 min-w-0',
}: MeasuredResponsiveContainerProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = hostRef.current
    if (!el) return

    const update = () => {
      const rect = el.getBoundingClientRect()
      const width = Math.max(0, Math.floor(rect.width))
      const height = Math.max(0, Math.floor(rect.height))
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      )
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={hostRef} className={className}>
      {size.width > 0 && size.height > 0 ? (
        <ResponsiveContainer width={size.width} height={size.height} minWidth={0}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  )
}
