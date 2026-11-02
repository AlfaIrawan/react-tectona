import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

export function mobileCommunicationPanelStyle(viewport: { top: number; height: number }): CSSProperties {
  return {
    position: 'fixed', left: 0, right: 0, top: viewport.top,
    width: '100%', maxWidth: '100%', minWidth: 0,
    height: viewport.height, maxHeight: viewport.height,
    zIndex: 55, borderRadius: 0,
  }
}

function readViewport() {
  const offset = window.visualViewport?.offsetTop ?? 0
  const height = window.visualViewport?.height ?? window.innerHeight
  const headerBottom = document.querySelector('.responsive-topbar')?.getBoundingClientRect().bottom ?? 0
  const top = Math.max(offset, headerBottom)
  return {
    top,
    height: Math.max(0, offset + height - top),
  }
}

/** Follow the visible viewport, including the space left above a phone keyboard. */
export function useCommunicationViewport(active: boolean) {
  const [viewport, setViewport] = useState(readViewport)
  useEffect(() => {
    if (!active) return
    const update = () => setViewport(readViewport())
    update()
    const visual = window.visualViewport
    const header = document.querySelector('.responsive-topbar')
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    if (header) observer?.observe(header)
    visual?.addEventListener('resize', update)
    visual?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      visual?.removeEventListener('resize', update)
      visual?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      observer?.disconnect()
    }
  }, [active])
  return viewport
}
