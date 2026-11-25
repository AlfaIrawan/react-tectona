import { useLayoutEffect, useRef } from 'react'

/** Size auth pages to the visible phone viewport without compressing an active keyboard. */
export function useAuthMobileViewport() {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const isMobile = () => window.matchMedia('(max-width: 767px), (max-width: 1023px) and (pointer: coarse)').matches
    const syncViewport = () => {
      const element = ref.current
      if (!isMobile() || !element || (element.contains(document.activeElement) && document.activeElement?.matches('input, textarea'))) return
      const height = window.visualViewport?.height ?? window.innerHeight
      element.style.setProperty('--login-viewport-height', `${height}px`)
      element.dataset.compact = String(height < 700)
    }
    const resetPosition = () => {
      syncViewport()
      if (isMobile()) window.scrollTo(0, 0)
    }
    resetPosition()
    window.visualViewport?.addEventListener('resize', syncViewport)
    window.addEventListener('resize', syncViewport)
    window.addEventListener('pageshow', resetPosition)
    return () => {
      window.visualViewport?.removeEventListener('resize', syncViewport)
      window.removeEventListener('resize', syncViewport)
      window.removeEventListener('pageshow', resetPosition)
    }
  }, [])
  return ref
}
