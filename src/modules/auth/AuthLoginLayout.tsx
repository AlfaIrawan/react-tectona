import { useLayoutEffect, useRef, type ReactNode } from 'react'
import './login-presentation.css'

const MOBILE_QUERY = '(max-width: 767px), (max-width: 1023px) and (pointer: coarse)'
const SCALE_PROPERTIES = ['zoom', '--ui-scale', '--app-vw', '--app-vh'] as const

/** One visual shell for platform sign-in pages. Authentication stays in each page. */
export function AuthLoginLayout({ children, footer, background }: {
  children: ReactNode
  footer: ReactNode
  background?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const root = document.documentElement
    const previous = SCALE_PROPERTIES.map(name => [name, root.style.getPropertyValue(name)] as const)
    const hadScaleLock = root.classList.contains('ui-scale-lock')
    const previousLoginLayout = root.dataset.loginLayout
    root.dataset.loginLayout = 'active'
    let viewportKey = ''
    const previousAccent = root.dataset.accent
    root.dataset.accent = 'gradient'

    const sync = () => {
      const element = ref.current
      const width = window.innerWidth
      const height = window.innerHeight
      if (!element || width <= 0 || height <= 0) return
      const mobile = window.matchMedia(MOBILE_QUERY).matches
      const nextViewportKey = `${width}:${height}:${mobile}`
      if (nextViewportKey !== viewportKey) {
        viewportKey = nextViewportKey
        if (mobile || width >= 1920 * 0.995) {
          SCALE_PROPERTIES.forEach(name => root.style.removeProperty(name))
          root.classList.remove('ui-scale-lock')
        } else {
          const scale = width / 1920
          root.style.setProperty('zoom', String(scale))
          root.style.setProperty('--ui-scale', String(scale))
          root.style.setProperty('--app-vw', '1920px')
          root.style.setProperty('--app-vh', `${height / scale}px`)
          root.classList.add('ui-scale-lock')
        }
      }
      if (!mobile) {
        element.style.removeProperty('--login-viewport-height')
        delete element.dataset.compact
      } else if (!(element.contains(document.activeElement) && document.activeElement?.matches('input, textarea'))) {
        const visibleHeight = window.visualViewport?.height ?? height
        element.style.setProperty('--login-viewport-height', `${visibleHeight}px`)
        element.dataset.compact = String(visibleHeight < 700)
      }
    }
    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    window.addEventListener('pageshow', sync)
    window.visualViewport?.addEventListener('resize', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
      window.removeEventListener('pageshow', sync)
      window.visualViewport?.removeEventListener('resize', sync)
      previous.forEach(([name, value]) => value ? root.style.setProperty(name, value) : root.style.removeProperty(name))
      root.classList.toggle('ui-scale-lock', hadScaleLock)
      if (previousAccent === undefined) delete root.dataset.accent
      else root.dataset.accent = previousAccent
      if (previousLoginLayout === undefined) delete root.dataset.loginLayout
      else root.dataset.loginLayout = previousLoginLayout
      // Existing dashboard scale handlers own the viewport again after leaving login.
      window.dispatchEvent(new Event('resize'))
    }
  }, [])

  return (
    <div ref={ref} className="platform-login">
      {background}
      <div className="platform-login-main">
        <div className="liquid-glass-enterprise-panel platform-login-card">{children}</div>
      </div>
      <footer className="platform-login-footer">{footer}</footer>
    </div>
  )
}
