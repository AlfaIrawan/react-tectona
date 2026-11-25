import { createContext, useContext, useLayoutEffect, useRef, type HTMLAttributes, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { visualPxToLayoutPx } from '@/lib/uiScale'

type Bounds = { left: number; top: number; right: number; bottom: number }
type Point = { x: number; y: number }
const Boundary = createContext<RefObject<HTMLElement | null> | null>(null)
const positionedEvent = 'tectona-diagram-menu-positioned'

function clampDiagramMenu(point: Point, size: { width: number; height: number }, bounds: Bounds): Point {
  return { x: Math.max(bounds.left + 8, Math.min(point.x, bounds.right - size.width - 8)),
    y: Math.max(bounds.top + 8, Math.min(point.y, bounds.bottom - size.height - 8)) }
}
function visibleBounds(element: HTMLElement | null): Bounds {
  const rect = element?.getBoundingClientRect()
  return { left: Math.max(0, rect?.left ?? 0), top: Math.max(0, rect?.top ?? 0),
    right: Math.min(window.innerWidth, rect?.right ?? window.innerWidth), bottom: Math.min(window.innerHeight, rect?.bottom ?? window.innerHeight) }
}
function fitMenu(element: HTMLElement, bounds: Bounds, point: Point) {
  element.style.maxWidth = `${visualPxToLayoutPx(Math.max(0, bounds.right - bounds.left - 16))}px`
  element.style.maxHeight = `${visualPxToLayoutPx(Math.max(0, bounds.bottom - bounds.top - 16))}px`
  const next = clampDiagramMenu(point, element.getBoundingClientRect(), bounds)
  element.style.left = `${visualPxToLayoutPx(next.x)}px`
  element.style.top = `${visualPxToLayoutPx(next.y)}px`
}

export function DiagramEditorMenu({ boundaryRef, point, children, style, ...props }: HTMLAttributes<HTMLDivElement> & {
  boundaryRef: RefObject<HTMLElement | null>; point: Point; children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const place = () => {
      const boundary = boundaryRef.current?.getBoundingClientRect()
      fitMenu(element, visibleBounds(boundaryRef.current), { x: (boundary?.left ?? 0) + point.x, y: (boundary?.top ?? 0) + point.y })
      window.dispatchEvent(new Event(positionedEvent))
    }
    place()
    // A containing canvas mounted in the same commit gets its ref after child layout effects.
    let active = true
    if (!boundaryRef.current) queueMicrotask(() => { if (active) place() })
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place)
    observer?.observe(element)
    if (boundaryRef.current) observer?.observe(boundaryRef.current)
    return () => { active = false; observer?.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [boundaryRef, point.x, point.y, children])
  return createPortal(<Boundary.Provider value={boundaryRef}><div {...props} ref={ref} style={{ ...style, position: 'fixed', zIndex: 10000, overflow: 'auto' }}>{children}</div></Boundary.Provider>, document.body)
}

export function DiagramEditorSubmenu({ children, className }: { children: ReactNode; className?: string }) {
  const boundary = useContext(Boundary)
  const anchor = useRef<HTMLSpanElement>(null), ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const place = () => {
      const element = ref.current, row = anchor.current?.parentElement?.getBoundingClientRect()
      if (!element || !row) return
      const bounds = visibleBounds(boundary?.current ?? null)
      const width = element.getBoundingClientRect().width
      const x = row.right + width <= bounds.right - 8 ? row.right : row.left - width
      fitMenu(element, bounds, { x, y: row.top })
    }
    place()
    window.addEventListener(positionedEvent, place)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place)
    if (ref.current) observer?.observe(ref.current)
    return () => { observer?.disconnect(); window.removeEventListener(positionedEvent, place); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [boundary, children])
  return <><span ref={anchor} />{createPortal(<div ref={ref} data-diagram-context-menu="" className={className}
    style={{ position: 'fixed', zIndex: 10001, overflow: 'auto' }} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onContextMenu={event => event.preventDefault()}>{children}</div>, document.body)}</>
}
