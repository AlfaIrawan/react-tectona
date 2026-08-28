/** Desktop layout width. Scale = viewport width / this value so 1920 CSS px stays 1:1. */
export const UI_DESIGN_WIDTH_PX = 1920

const OPT_OUT_KEY = 'tectona:ui-scale-lock'

export function isUiScaleLockEnabled(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) !== '0'
  } catch {
    return true
  }
}

export function syncUiScaleLock(): void {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  if (!isUiScaleLockEnabled()) {
    root.classList.remove('ui-scale-lock')
    root.style.removeProperty('--ui-scale')
    root.style.removeProperty('--app-vw')
    root.style.removeProperty('--app-vh')
    root.style.removeProperty('--ui-offset-x')
    root.style.removeProperty('--ui-offset-y')
    root.style.removeProperty('zoom')
    return
  }

  // Use layout viewport (not visualViewport): device-mode / browser chrome
  // often reports a smaller visual size and was shrinking 1920×1080 to a postage stamp.
  const vw = window.innerWidth
  const vh = window.innerHeight
  const scale = vw / UI_DESIGN_WIDTH_PX
  const layoutHeight = vh / scale

  root.classList.add('ui-scale-lock')
  root.style.setProperty('--ui-scale', String(scale))
  root.style.setProperty('--app-vw', `${UI_DESIGN_WIDTH_PX}px`)
  root.style.setProperty('--app-vh', `${layoutHeight}px`)
  root.style.setProperty('--ui-offset-x', '0px')
  root.style.setProperty('--ui-offset-y', '0px')
}

export function initUiScaleLock(): void {
  syncUiScaleLock()
  window.addEventListener('resize', syncUiScaleLock)
  window.addEventListener('orientationchange', syncUiScaleLock)
}
